// @ts-check
/**
 * fx-webgl-scena.js — gli spettacoli di carta in WebGL, tutti sullo stesso motore.
 * ------------------------------------------------------------------------
 * Sta sopra js/ui/fx-webgl.js (che porta il canvas, il ciclo e i primi tre effetti) e si
 * registra come parte dello stesso backend 'webgl'.
 *
 * L'IDEA. Invece di scrivere uno shader a mano per ognuno dei ~35 spettacoli, c'e' UNO shader
 * "di scena" che sa disegnare un piccolo vocabolario di PRIMITIVE (lampo, anello d'urto, fulmine,
 * scintille, sigillo magico, vortice, velo a tutto schermo, raggio fra due punti, colonna di luce,
 * fumo, voragine, tromba d'aria, luna, cuore, occhio, cappello, sfera, pannello, moneta, dado), ognuna
 * con un inizio, una durata e un colore. Ogni effetto e' allora una funzione JS corta che
 * dice "a questo istante, in questo punto, metti questa primitiva" — la stessa descrizione
 * temporale che prima stava dentro una timeline GSAP o dentro una pagina di CSS.
 * Le CARTE vere (quelle che cadono in una voragine, volano dal Cimitero, si ribaltano) restano
 * elementi della pagina, animati con la sola `transform` (WAAPI), perche' hanno la loro grafica:
 * e' la parte che a suo tempo scattava.
 *
 * COSA RESTA IDENTICO A PRIMA, perche' il duello ne dipende: le firme, le callback d'impatto
 * (chiamate allo stesso istante, una volta sola, con la rete di scorta alla fine), e il
 * conteggio delle cinematiche (FX.beginSummonCinematic/endSummonCinematic: il bot aspetta).
 * Se WebGL manca, `lancia` lancia un errore PRIMA che sia successo qualsiasi cosa e effects.js
 * ripiega sul backend successivo.
 *
 * COME AGGIUNGERE UN EFFETTO. Una funzione che costruisce una `Scena`, un `esegui()` e una voce
 * in `impls`; se la funzione non e' ancora avvolta da `viaBackend` in effects.js, avvolgerla.
 */
(function () {
    'use strict';
    if (!window.FX || !window.FxWebgl || typeof window.FX.registerBackend !== 'function') return;

    const Z = window.FxWebgl.Z_INDEX;
    const MAX = 40;

    // Tipi di primitiva (devono coincidere con l'ordine delle `if` dello shader qui sotto).
    const T = { FLASH: 0, RING: 1, BOLT: 2, BURST: 3, SEAL: 4, VORTEX: 5, WASH: 6, LINE: 7, PILLAR: 8, SMOKE: 9, PIT: 10, TWISTER: 11, MOON: 12, HEART: 13, EYE: 14, HAT: 15, ORB: 16, PANEL: 17, COIN: 18, DIE: 19, ANKH: 20, PORTAL: 21, DUST: 22, SHIELD: 23 };
    // Colori: indici nella tavolozza dello shader.
    const C = { CALDO: 0, ORO: 1, ROSSO: 2, ARANCIO: 3, CIANO: 4, BLU: 5, VIOLA: 6, MAGENTA: 7, VERDE: 8, BIANCO: 9, SCURO: 10, GHIACCIO: 11, VERDE_SCURO: 12 };

    // =====================================================================
    // Le primitive: un programma per tipo, disegnato in una passata ristretta al suo riquadro
    // =====================================================================
    // Prima c'era un solo shader con un ciclo su tutte le primitive: corretto, ma ogni pixel
    // attraversava tutte le diramazioni e (misurato) un Tributo Torrenziale scendeva a 12 fps dove un
    // Buco Nero a 60. Ora ogni primitiva e' un programma piccolo e disegnato SOLO sul rettangolo
    // che puo' toccare (scissor): il costo e' proporzionale all'area, non al numero di primitive.

    const COMUNE = window.FxWebgl.BASE + `
uniform vec4 IA;    // x, y, a, b (dipende dal tipo)
uniform vec4 IB;    // inizio (s), durata (s), -, parametro w
uniform vec3 col;
const float PI=3.14159265;
float easeOut(float x){x=clamp(x,0.,1.);return 1.-pow(1.-x,3.);}
float easeIO(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}
float pop(float u){return (1.-u)*(1.-u)*smoothstep(0.,.08,u);}
float campana(float u,float a,float b){return smoothstep(0.,a,u)*(1.-smoothstep(1.-b,1.,u));}
float pip(vec2 q,vec2 c){return smoothstep(.13,.1,length(q-c));}
float dado(vec2 q,float v){
  float s=0.;
  if(v>.5&&mod(v,2.)>.5) s+=pip(q,vec2(0.));
  if(v>1.5) s+=pip(q,vec2(-.5,-.5))+pip(q,vec2(.5,.5));
  if(v>3.5) s+=pip(q,vec2(.5,-.5))+pip(q,vec2(-.5,.5));
  if(v>5.5) s+=pip(q,vec2(-.5,0.))+pip(q,vec2(.5,0.));
  return clamp(s,0.,1.);
}
`;

    const COLORI = [[1, .95, .8], [1, .8, .3], [1, .25, .2], [1, .55, .15], [.4, .9, 1], [.3, .5, 1], [.7, .4, 1], [1, .35, .8], [.4, 1, .55], [1, 1, 1], [.02, .01, .06], [.7, 1, 1], [.0, .05, .035]];

    /** @type {Record<number,string>} */
    const CORPI = {};

    // LAMPO: alone morbido con nucleo caldo.
    CORPI[T.FLASH] = `
  vec2 d=(P-A.xy)/A.z; float r2=dot(d,d); float e=pop(u)*1.4;
  s=vec4(c*(exp(-r2*2.5)*.7+exp(-r2*16.)*1.4)*e,clamp(exp(-r2*3.)*.7*e,0.,1.));`;

    // ANELLO: onda d'urto che si allarga (B.w<0: si stringe).
    CORPI[T.RING] = `
  float inv=step(B.w,-.5);
  float R0=A.z*mix(easeOut(u),1.-easeOut(u),inv);
  float dd=abs(length(P-A.xy)-R0); float g=exp(-dd*dd/(A.w*A.w));
  float e=mix(1.-u,campana(u,.2,.3),inv);
  s=vec4(c*g*e*1.4,g*e*.85);`;

    // FULMINE dall'alto fino a (x,y).
    CORPI[T.BOLT] = `
  float y01=clamp(P.y/max(A.y,1.),0.,1.);
  float wob=(fbm(vec2(y01*7.,B.w))-.5)*70.+(fbm(vec2(y01*19.,B.w*2.3))-.5)*16.;
  float dx=abs(P.x-(A.x+wob*(1.-y01*.6)));
  float vive=step(P.y,A.y)*(1.-smoothstep(.5,.85,u))*smoothstep(0.,.08,u);
  float fl=.7+.3*step(.5,fract(u*14.));
  float nu=exp(-dx*dx/(A.z*A.z*.15)); float al=exp(-dx*dx/(A.z*A.z*12.));
  s=vec4(mix(c,vec3(1.),.6)*(nu*1.5+al*.55)*fl*vive,clamp((nu+al*.4)*vive,0.,1.));`;

    // SCINTILLE a raggiera (A.w: gravita' in px).
    CORPI[T.BURST] = `
  float acc=0.;
  for(int j=0;j<14;j++){
    float fj=float(j);
    float ang=h(vec2(fj,B.w))*6.2832; float sp=.35+h(vec2(fj+9.,B.w))*.65;
    vec2 pos=A.xy+vec2(cos(ang),sin(ang))*A.z*sp*easeOut(u); pos.y+=A.w*u*u;
    acc+=smoothstep(2.8*(1.-u)+.6,0.,length(P-pos));
  }
  s=vec4(c*acc*1.3,clamp(acc,0.,1.)*(1.-u*.6));`;

    // SIGILLO magico: anelli, tacche e due triangoli che girano (B.w: schiacciamento in prospettiva).
    CORPI[T.SEAL] = `
  vec2 q=(P-A.xy)/A.z; q.y/=max(B.w,.05); float rr=length(q); float ang=atan(q.y,q.x);
  float e=campana(u,.18,.3); float rot=t*1.2;
  float ra=exp(-pow((rr-1.)/.03,2.)); float rb=exp(-pow((rr-.84)/.02,2.));
  float tk=step(.55,fract((ang+rot*.5)*12./(2.*PI)))*exp(-pow((rr-.93)/.05,2.))*.8;
  float st=0.;
  for(int j=0;j<2;j++){
    float sg=1.-2.*float(j);
    float a2=mod(ang+rot*.7*sg+float(j)*PI/3.,2.*PI/3.)-PI/3.;
    float ed=rr*cos(a2)-.5; st+=exp(-ed*ed*600.)*step(rr,.78);
  }
  float g=ra+rb*.7+tk+st*.8+exp(-rr*rr*2.5)*.18;
  s=vec4(c*g*e*1.4,clamp(g*e*.8,0.,1.));`;

    // VORTICE a spirale.
    CORPI[T.VORTEX] = `
  vec2 q=(P-A.xy)/A.z; q.y/=max(B.w,.05); float rr=length(q); float ang=atan(q.y,q.x);
  float arms=pow(.5+.5*sin(3.*(ang+4.*log(rr+.05))-t*5.),2.5);
  float disc=smoothstep(1.,.75,rr)*smoothstep(0.,.15,rr); float core=exp(-rr*rr*30.);
  float e=campana(u,.2,.3); float g=arms*disc*.9+core;
  s=vec4(c*g*e*1.3,clamp(g*e*.8,0.,1.));`;

    // VELO a tutto schermo: B.w = 0 uniforme, 1 dall'alto, 2 dal basso, 3 vignetta, 4 barra di scansione, 5 raffiche di vento.
    CORPI[T.WASH] = `
  float e=campana(u,.2,.35); float g=1.; float md=B.w;
  if(md>5.5){
    // IMPATTO A META' SCHERMO (6 = metà alta, 7 = metà bassa): lampo rosso, vignetta, crepe e filo di luce sul bordo interno
    float yy=md<6.5?P.y:(R.y-P.y); float H=R.y*.52; float inn=clamp(yy/H,0.,1.)*step(yy,H);
    float qx=(P.x/R.x-.5)*2.; float qy=yy/H;
    float fl=.55*smoothstep(.1,1.,inn)*smoothstep(0.,.08,u)*(1.-smoothstep(.08,1.,u));
    float vg=.5*(1.-smoothstep(0.,.95,length(vec2(qx*.55,qy))))*step(yy,H)*smoothstep(0.,.18,u)*(1.-smoothstep(.18,1.,u));
    float gr=mix(.2,1.,easeOut(u/.22)); float env3=smoothstep(0.,.22,u)*(1.-smoothstep(.22,1.,u));
    float xm=smoothstep(.88*gr,.7*gr,abs(qx));
    float dEdge=yy-H;
    float lin=(exp(-dEdge*dEdge/9.)*1.2+exp(-dEdge*dEdge/700.)*.6)*xm*env3*step(yy,H+40.);
    float p1=fract((P.x*.906+P.y*.4226)/108.); float p2=fract((P.x*.906-P.y*.4226)/150.);
    float cr=(step(.426,p1)*step(p1,.444)*.16+step(.467,p2)*step(p2,.48)*.1)*step(yy,H)*smoothstep(0.,.14,u)*(1.-smoothstep(.14,1.,u));
    vec3 ec=mix(vec3(1.,.23,.23),vec3(1.),exp(-qx*qx*8.));
    vec3 col2=vec3(.9,0.,0.)*fl+vec3(.47,0.,0.)*vg+ec*lin+vec3(1.,.86,.78)*cr;
    float a2=clamp(fl+vg+lin*.8+cr,0.,1.);
    s=vec4(min(col2,vec3(a2)),a2);
  } else {
  if(md>.5&&md<1.5) g=1.-smoothstep(0.,R.y*.7,P.y);
  else if(md>1.5&&md<2.5) g=smoothstep(R.y*.3,R.y,P.y);
  else if(md>2.5&&md<3.5) g=smoothstep(.2,.95,length((P-R*.5)/R*1.5));
  else if(md>3.5&&md<4.5){ float y0=u*R.y*1.2-R.y*.1; g=.15+exp(-pow((P.y-y0)/max(A.w,10.),2.))*1.6; }
  else if(md>4.5){ g=smoothstep(.55,.85,fbm(vec2((P.x-t*700.)*.004,P.y*.05+1.3)))*1.4; }
  float a=A.z*e*g;
  s=vec4(c*a*(md>3.5?1.3:1.),md>3.5?a*.8:a);
  }`;

    // RAGGIO fra due punti, che cresce da (x,y) a (z,w); spessore B.w.
    CORPI[T.LINE] = `
  vec2 p1=A.xy; vec2 p2=A.zw; float gr=smoothstep(0.,.35,u);
  vec2 pe=mix(p1,p2,gr); vec2 pa=P-p1; vec2 ba=pe-p1;
  float hh=clamp(dot(pa,ba)/max(dot(ba,ba),1.),0.,1.); float d=length(pa-ba*hh);
  float w=B.w; float core=exp(-d*d/(w*w*.25)); float glow=exp(-d*d/(w*w*8.));
  float pul=.7+.3*sin(hh*30.-t*20.); float e=1.-smoothstep(.55,1.,u);
  s=vec4(mix(c,vec3(1.),.5)*(core*1.5+glow*.6)*pul*e,clamp((core+glow*.5)*e,0.,1.));`;

    // COLONNA di luce che sale da (x,y) fino al bordo alto.
    CORPI[T.PILLAR] = `
  float dx=abs(P.x-A.x); float len=max(A.y,1.); float rel=clamp((A.y-P.y)/len,0.,1.);
  float body=smoothstep(A.z,A.z*.2,dx)*step(P.y,A.y)*(1.-rel*.8);
  float stk=.7+.5*fbm(vec2(P.x*.05,P.y*.01-t*3.)); float e=campana(u,.15,.4);
  s=vec4(c*body*stk*e*1.1,clamp(body*e*.7,0.,1.));`;

    // FUMO: macchia che si dissolve (un colore scuro oscura invece di illuminare). A.w: opacita'.
    CORPI[T.SMOKE] = `
  float d=length(P-A.xy)/A.z; float nn=fbm(P*.02+vec2(u*1.5,0.));
  float a=smoothstep(1.,.2,d+(nn-.5)*.9)*campana(u,.15,.6)*A.w;
  s=vec4(c*a,a*.9);`;

    // VORAGINE / varco: ellisse scura con bordo luminoso e spirale.
    CORPI[T.PIT] = `
  vec2 q=(P-A.xy)/A.z; q.y/=max(B.w,.05); float rr=length(q);
  float e=campana(u,.2,.25); float hole=smoothstep(1.,.92,rr); float rim=exp(-pow((rr-1.)/.07,2.));
  float sw=pow(.5+.5*sin(4.*(atan(q.y,q.x)+3.*rr)-t*6.),3.)*hole*.35*e;
  vec4 d2=vec4(c*rim*e*1.4,rim*e*.8); vec4 d1=vec4(0.,0.,0.,hole*.95*e);
  s=d2+d1*(1.-d2.a); s.rgb+=c*sw;`;

    // TROMBA D'ARIA: imbuto che si allarga verso l'alto (base in (x,y), altezza A.w, semilarghezza in cima A.z).
    CORPI[T.TWISTER] = `
  float yy=(A.y-P.y)/A.w;
  if(yy>0.&&yy<1.){
    float hw=A.z*(.15+.85*yy); float dx=(P.x-A.x)/hw+sin(yy*8.-t*9.)*.15;
    float body=smoothstep(1.,.5,abs(dx)); float strk=pow(.5+.5*sin(dx*5.+yy*14.-t*12.),2.);
    float g=body*(.35+.65*strk); float e=campana(u,.2,.3);
    s=vec4(c*g*e,clamp(g*.8*e,0.,1.));
  }`;

    // LUNA crescente con alone.
    CORPI[T.MOON] = `
  float d1=length(P-A.xy)/A.z; float d2=length(P-A.xy-vec2(A.z*.45,-A.z*.08))/A.z;
  float moon=smoothstep(1.,.97,d1)*(1.-smoothstep(1.,.97,d2)); float halo=exp(-d1*d1*1.2)*.3; float e=campana(u,.2,.3);
  s=vec4(c*(moon*1.3+halo)*e,clamp((moon+halo*.6)*e,0.,1.));`;

    // CUORE che pulsa.
    CORPI[T.HEART] = `
  vec2 p=(P-A.xy)/(A.z*(1.+.08*sin(t*14.))); p.y=-p.y;
  float x=p.x*1.25; float y=p.y*1.25+.15;
  float f=pow(x*x+y*y-1.,3.)-x*x*y*y*y;
  float box=step(abs(p.x),1.1)*step(abs(p.y),1.1);
  float inn=smoothstep(.03,-.03,f)*box; float edge=exp(-f*f*60.)*box; float e=campana(u,.2,.3);
  s=vec4(c*(inn*.7+edge*1.2)*e,clamp((inn*.8+edge*.5)*e,0.,1.));`;

    // OCCHIO con pupilla a fessura.
    CORPI[T.EYE] = `
  vec2 q=(P-A.xy)/A.z; float lens=.45*(1.-q.x*q.x);
  float ed=abs(abs(q.y)-lens)*step(abs(q.x),1.); float line=exp(-ed*ed*400.);
  float inside=step(abs(q.y),lens)*step(abs(q.x),1.);
  float iris=smoothstep(.3,.26,length(q))*inside; float pup=smoothstep(.07,.04,abs(q.x))*smoothstep(.3,.24,abs(q.y))*inside;
  float e=campana(u,.2,.3); float gl=exp(-dot(q,q)*1.5)*.25;
  s=vec4(c*(line*1.3+iris*.9-pup*.9+gl)*e,clamp((line+iris+gl*.5)*e,0.,1.));`;

    // CAPPELLO a cono con tesa e fascia.
    CORPI[T.HAT] = `
  vec2 q=(P-A.xy)/A.z; float brim=smoothstep(1.,.92,length(vec2(q.x/.9,(q.y-.25)/.14)));
  float hw=.5*(q.y+.85)/1.1; float cone=step(-.85,q.y)*step(q.y,.25)*smoothstep(hw,hw*.85,abs(q.x));
  float band=step(.05,q.y)*step(q.y,.17)*cone;
  float e=campana(u,.2,.3);
  vec3 cc=mix(c,vec3(1.,.85,.3),band);
  s=vec4(cc*(brim*.9+cone*.8)*e*1.2,clamp((brim+cone)*e,0.,1.));`;

    // SFERA con coda che viaggia da (x,y) a (z,w); raggio B.w.
    CORPI[T.ORB] = `
  float acc=0.;
  for(int j=0;j<6;j++){
    float uu=clamp(u-float(j)*.025,0.,1.); float ee=easeIO(uu);
    vec2 pos=mix(A.xy,A.zw,ee); pos.y-=sin(PI*ee)*60.;
    float d=length(P-pos); acc+=exp(-d*d/(B.w*B.w*(1.+float(j)*.6)))*(1.-float(j)*.15);
  }
  float e=1.-smoothstep(.85,1.,u);
  s=vec4(c*acc*1.4*e,clamp(acc*e,0.,1.));`;

    // PANNELLO tecnologico: cornice e righe di scansione (semi-larghezza A.z, semi-altezza A.w).
    CORPI[T.PANEL] = `
  vec2 q=abs(P-A.xy)-vec2(A.z,A.w); float sd=max(q.x,q.y); float e=campana(u,.12,.2);
  float fr=exp(-sd*sd/2.5); float fill=step(sd,0.)*(.12+.1*sin(P.y*.8-t*6.));
  s=vec4(c*(fr*1.4+fill)*e,clamp((fr+fill)*e,0.,1.));`;

    // MONETA che vola, gira e si ferma sulla faccia giusta (B.w: 1 = testa). A.w: altezza del lancio.
    CORPI[T.COIN] = `
  float f=clamp(u/.7,0.,1.);
  float arc=sin(PI*f); vec2 pos=vec2(A.x,A.y-A.w*arc);
  float th=f*PI*2.*5.+(B.w>.5?0.:PI); float cs=cos(th); float sq=max(abs(cs),.07);
  float sh=exp(-pow(length((P-vec2(A.x,A.y+A.z*.9))/vec2(A.z*(1.-.4*arc),A.z*.25*(1.-.4*arc))),2.)*2.)*(.45-.3*arc);
  vec2 q=(P-pos)/A.z; q.y/=sq; float rr=length(q);
  float disc=smoothstep(1.,.96,rr); float rim=smoothstep(.8,.9,rr)*disc;
  float sym=0.;
  if(cs>0.){ sym=smoothstep(.05,.0,abs(rr-.42))+smoothstep(.2,.17,rr); }
  else { sym=step(abs(q.x),.5)*(smoothstep(.07,.04,abs(q.y+.3))+smoothstep(.07,.04,abs(q.y))+smoothstep(.07,.04,abs(q.y-.3))); }
  float spec=.5+.5*sin(q.x*3.+th*2.);
  vec3 gold=mix(vec3(.75,.5,.12),vec3(1.,.9,.5),spec*.6+rim*.4)-sym*.35*vec3(1.,1.,.8);
  float fade=1.-smoothstep(.9,1.,u);
  vec4 coin=vec4(gold*disc*fade,disc*fade);
  s=coin+vec4(0.,0.,0.,sh*fade)*(1.-coin.a);`;

    // DADO che rotola e si ferma sul numero estratto (B.w). A.w: altezza del lancio.
    CORPI[T.DIE] = `
  float f=clamp(u/.7,0.,1.); float arc=sin(PI*f)*(1.-.35*f);
  vec2 pos=vec2(A.x+(1.-f)*-40.,A.y-A.w*arc*.8);
  float ang=(1.-easeOut(f))*PI*5.;
  vec2 q=P-pos; q=vec2(cos(ang)*q.x+sin(ang)*q.y,-sin(ang)*q.x+cos(ang)*q.y)/A.z;
  float sh=exp(-pow(length((P-vec2(A.x,A.y+A.z*.9))/vec2(A.z*1.1,A.z*.25)),2.)*2.)*(.4-.25*arc);
  vec2 bq=abs(q)-vec2(.82); float sd=length(max(bq,0.))+min(max(bq.x,bq.y),0.)-.14;
  float body=smoothstep(.02,-.02,sd);
  float val=mix(floor(mod(f*24.,6.))+1.,B.w,step(.7,f));
  float pp=dado(q/.82,val);
  vec3 cc=mix(vec3(.95,.93,.88),vec3(.7,.68,.62),smoothstep(-.3,.8,q.y))*(1.-pp*.9)+vec3(.15,.02,.02)*pp;
  float fade=1.-smoothstep(.9,1.,u);
  vec4 dv=vec4(cc*body*fade,body*fade);
  s=dv+vec4(0.,0.,0.,sh*fade)*(1.-dv.a);`;

    // ANKH (Rinascita del Mostro): croce ansata di luce con anello, asta e braccia; A.z = mezza altezza.
    // La stessa sagoma dell'originale in CSS: anello in alto, asta al centro, due braccia a meta'.
    CORPI[T.ANKH] = `
  vec2 q=(P-A.xy)/A.z; q.y=-q.y;
  float sc=mix(.2,1.,easeOut(u/.28))*(1.+.25*smoothstep(.76,1.,u));
  q/=sc; q.x/=1.-.0;
  float dr=abs(length(q-vec2(0.,.46))-.3)-.075;
  vec2 b1=abs(q-vec2(0.,-.36))-vec2(.07,.6);
  vec2 b2=abs(q-vec2(0.,.0))-vec2(.46,.065);
  float d=min(dr,min(max(b1.x,b1.y),max(b2.x,b2.y)));
  float core=smoothstep(.025,-.025,d); float glow=exp(-max(d,0.)*10.)*.8; float glow2=exp(-max(d,0.)*3.)*.35;
  float e=smoothstep(0.,.24,u)*(1.-smoothstep(.76,1.,u));
  s=vec4((vec3(.9,1.,.96)*core+c*glow+c*glow2*.6)*e,clamp((core+glow*.7+glow2*.4)*e,0.,1.));`;

    // PORTAL (Rinascita): ellisse piatta con il centro scuro, un anello verde luminoso e un alone morbido.
    CORPI[T.PORTAL] = `
  vec2 q=(P-A.xy)/A.z; q.y/=max(B.w,.05);
  float sc=mix(.1,1.,easeOut(u/.3))*(1.-.7*smoothstep(.7,1.,u)); q/=sc;
  float rr=length(q);
  float e=smoothstep(0.,.3,u)*(1.-smoothstep(.7,1.,u));
  float hole=smoothstep(.34,.3,rr); float ring=exp(-pow((rr-.46)/.12,2.)); float halo=smoothstep(1.,.3,rr)*.35;
  vec3 col=c*(ring*1.5+halo)*e;
  s=vec4(col*(1.-hole)+vec3(0.,.02,.012)*hole*e,clamp((ring+halo+hole*.95)*e,0.,1.));`;

    // DISINTEGRAZIONE di una carta (A: centro x, y e mezza larghezza, mezza altezza in z, w; B.w: seme).
    // Il fronte di fuoco sale dal basso (u da 0 a .5) e la parte gia' bruciata e' trasparente: la carta
    // vera la sfuma una maschera CSS sullo stesso fronte (vedi disintegraCarta). Qui si disegna solo la
    // luce: il bordo incandescente, un velo di braci dietro il fronte e i granelli che nascono sul fronte,
    // salgono e sbandano a destra spegnendosi. Niente texture: i granelli sono quadratini di brace, nel
    // colore c e, per i piu' recenti, quasi bianchi.
    CORPI[T.DUST] = `
  vec2 org=A.xy-A.zw; float W=A.z*2.; float Hh=A.w*2.; float sc=A.z/26.;
  float f=clamp(u/.5,0.,1.);
  float yF=org.y+Hh*(1.-f);
  float inside=step(org.x,P.x)*step(P.x,org.x+W);
  float dE=P.y-yF;
  float vivo=step(.001,f)*step(f,.999);
  float edge=exp(-dE*dE/(5.*sc*sc+3.))*inside*vivo*(.6+.4*fbm(vec2(P.x*.15/sc,t*7.)));
  float bruc=smoothstep(0.,10.*sc,dE)*(1.-smoothstep(0.,Hh*.45,dE))*step(P.y,org.y+Hh)*inside*vivo;
  float brace=bruc*.4*(.7+.3*fbm(vec2(P.x*.2/sc,P.y*.2/sc-t*3.)));
  float acc=0.; vec3 cc=vec3(0.);
  for(int j=0;j<72;j++){
    float fj=float(j);
    float ts=h(vec2(fj,B.w))*.5;
    float v=(u-ts)/.55;
    if(v<0.||v>1.) continue;
    float px=org.x+h(vec2(fj+7.,B.w))*W;
    float py=org.y+Hh*(1.-ts/.5);
    float sp=.5+h(vec2(fj+13.,B.w));
    vec2 pos=vec2(px+(18.+30.*h(vec2(fj+3.,B.w)))*v*sp*sc+sin(v*6.+fj)*5.*sc,
                  py-(40.+90.*h(vec2(fj+5.,B.w)))*v*sp*(1.-.3*v)*sc);
    // L'ESPLOSIONE: ogni granello viene prima spinto via dal centro della carta (frenando), e solo dopo sale.
    vec2 dir=normalize(vec2(px,py)-A.xy+(vec2(h(vec2(fj+19.,B.w)),h(vec2(fj+23.,B.w)))-.5)*W*.6+vec2(.001));
    pos+=dir*(25.+70.*h(vec2(fj+21.,B.w)))*(1.-pow(1.-clamp(v*1.6,0.,1.),3.))*sc;
    float sz=(2.6+3.4*h(vec2(fj+17.,B.w)))*(1.-.5*v)*sc;
    vec2 dd=abs(P-pos); float sq=max(dd.x,dd.y);
    float a=smoothstep(sz,sz*.5,sq)*(1.-v)*(.6+.4*sin(t*20.+fj));
    float hot=1.-v;
    cc+=mix(c,vec3(1.,.9,.6),hot*hot)*a;
    acc+=a;
  }
  s=vec4(c*(edge*1.7+brace)+cc*1.2+vec3(1.,.9,.7)*edge*.5,clamp(edge+brace*.8+acc,0.,1.));`;

    // BARRIERA ESAGONALE (attacco respinto; A: centro e raggio del bersaglio, B.w: angolo verso chi ha attaccato).
    // Una cupola di celle esagonali si forma attorno al bersaglio; dal punto in cui il colpo arriva parte un'onda
    // che accende le celle in sequenza, poi la barriera si incrina e si dissolve. Niente texture: solo geometria.
    CORPI[T.SHIELD] = `
  vec2 q=(P-A.xy)/(A.z*1.15); float rr=length(q);
  vec2 ip=vec2(cos(B.w),sin(B.w))*.92;
  float dI=length(q-ip);
  float form=smoothstep(0.,.1,u); float fade=1.-smoothstep(.5,1.,u);
  // celle esagonali
  vec2 g=q*4.2; vec2 sx=vec2(1.7320508,1.);
  vec2 a1=mod(g,sx)-sx*.5; vec2 b1=mod(g-sx*.5,sx)-sx*.5;
  vec2 gv=dot(a1,a1)<dot(b1,b1)?a1:b1; vec2 p2=abs(gv);
  float hd=max(dot(p2,normalize(vec2(1.,1.7320508))),p2.x);
  float bordo=smoothstep(.36,.47,hd);
  vec2 cid=floor(g*.7);
  float lampeggia=.55+.45*h(cid+floor(t*9.));
  // l'onda d'urto che si allarga dal punto d'impatto
  float onda=exp(-pow((dI-u*3.4)*3.2,2.));
  float cupola=smoothstep(1.12,.9,rr);
  float rim=exp(-pow((rr-1.04)/.07,2.))*(.6+.4*h(vec2(floor(atan(q.y,q.x)*6.),floor(t*14.))));
  float flash=exp(-dI*dI*16.)*pop(u*1.8)*1.6;
  float cell=bordo*cupola*(.28*lampeggia+onda*2.2);
  float g2=(cell+rim*.8+flash)*form*fade;
  vec3 caldo=mix(c,vec3(1.),clamp(onda*.7+flash*.5,0.,1.));
  s=vec4(caldo*g2*1.3,clamp(g2*.85,0.,1.));`;

    /** Il programma di un tipo (costruito una volta sola e messo in cache dal motore). */
    const SORGENTI = {};
    function sorgente(tipo) {
        if (!SORGENTI[tipo]) {
            SORGENTI[tipo] = COMUNE + 'void main(){\n  vec2 P=css(); vec2 R=r*k; vec4 A=IA; vec4 B=IB; float u=(t-B.x)/B.y; vec3 c=col; vec4 s=vec4(0.);\n'
                + '  if(u>=0.&&u<=1.){' + CORPI[tipo] + '\n  }\n  gl_FragColor=s;\n}\n';
        }
        return SORGENTI[tipo];
    }

    /** Il riquadro (px CSS, y dall'alto) che una primitiva puo' toccare; null = tutto lo schermo. */
    function bbox(tipo, A, w) {
        const x = A[0]; const y = A[1]; const z = A[2]; const q = A[3]; const tl = Math.max(w, 0.05); let e;
        switch (tipo) {
            case T.FLASH: e = z * 2.4; return [x - e, y - e, x + e, y + e];
            case T.RING: e = z + q * 4 + 4; return [x - e, y - e, x + e, y + e];
            case T.BOLT: e = 60 + z * 6; return [x - e, 0, x + e, y + 4];
            case T.BURST: e = z + Math.abs(q) + 12; return [x - e, y - e, x + e, y + e];
            case T.SEAL: case T.VORTEX: return [x - z * 1.15, y - z * 1.15 * tl - 4, x + z * 1.15, y + z * 1.15 * tl + 4];
            case T.WASH: return null;
            case T.LINE: e = w * 4 + 8; return [Math.min(x, z) - e, Math.min(y, q) - e, Math.max(x, z) + e, Math.max(y, q) + e];
            case T.PILLAR: e = z * 1.2; return [x - e, 0, x + e, y];
            case T.SMOKE: e = z * 1.5; return [x - e, y - e, x + e, y + e];
            case T.PIT: return [x - z * 1.2, y - z * 1.2 * tl - 4, x + z * 1.2, y + z * 1.2 * tl + 4];
            case T.TWISTER: e = z * 1.3; return [x - e, y - q, x + e, y + 2];
            case T.MOON: e = z * 3; return [x - e, y - e, x + e, y + e];
            case T.HEART: case T.EYE: case T.HAT: e = z * 1.5; return [x - e, y - e, x + e, y + e];
            case T.ORB: e = w * 5 + 70; return [Math.min(x, z) - e, Math.min(y, q) - e, Math.max(x, z) + e, Math.max(y, q) + e];
            case T.ANKH: e = z * 1.6; return [x - e, y - e, x + e, y + e];
            case T.PORTAL: return [x - z * 1.2, y - z * 1.2 * Math.max(w, 0.05) - 6, x + z * 1.2, y + z * 1.2 * Math.max(w, 0.05) + 6];
            case T.PANEL: return [x - z - 20, y - q - 20, x + z + 20, y + q + 20];
            // Disintegrazione: i granelli salgono fino a ~8 mezze larghezze e sbandano a destra.
            // (l'esplosione spinge i granelli anche di lato e verso il basso: ~90 px in scala della carta).
            case T.DUST: return [x - z * 5, y - q - z * 8, x + z * 7, y + q + z * 5];
            case T.SHIELD: e = z * 1.6; return [x - e, y - e, x + e, y + e];
            default: e = z * 3; return [x - e, y - q - e, x + e, y + e];   // moneta e dado
        }
    }
    // =====================================================================
    // Strumenti
    // =====================================================================

    const tavolo = (o) => (o === 'player' ? 'playerFieldBoard' : 'botFieldBoard');
    const slotEl = (owner, tipo, i) => document.querySelector(`#${tavolo(owner)} .field-slot[data-owner="${owner}"][data-type="${tipo}"][data-index="${i}"]`);
    const rectDi = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? r : null; };
    const cen = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    /** Rettangolo della carta (o, se non c'e', della casella) di un mostro. */
    const rectMostro = (owner, i) => { const s = slotEl(owner, 'monster', i); return rectDi(s && s.querySelector('.card')) || rectDi(s); };
    const rectSt = (owner, i) => { const s = slotEl(owner, 'st', i); return rectDi(s && s.querySelector('.card')) || rectDi(s); };
    const rectZona = (owner, zona) => rectDi(document.querySelector(`#${tavolo(owner)} .field-slot[data-owner="${owner}"][data-zone="${zona}"]`));
    /**
     * Il rettangolo "in piedi" di una carta sul Terreno (anche se in Difesa, dove il suo riquadro a schermo e' ruotato):
     * stesso centro della carta, misure vere. Se la casella e' vuota (la carta sta per ARRIVARCI) si stima dalla casella.
     */
    const rettaCarta = (owner, tipo, i) => {
        const sl = slotEl(owner, tipo, i); if (!sl) return null;
        const el = sl.querySelector('.card');
        const rs = rectDi(sl);
        if (el && el.offsetWidth) {
            const rc = rectDi(el); if (!rc) return null;
            const c = { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2 };
            return { left: c.x - el.offsetWidth / 2, top: c.y - el.offsetHeight / 2, width: el.offsetWidth, height: el.offsetHeight };
        }
        if (!rs) return null;
        const h = rs.height * 0.9; const w = h * 0.69; const c = { x: rs.left + rs.width / 2, y: rs.top + rs.height / 2 };
        return { left: c.x - w / 2, top: c.y - h / 2, width: w, height: h };
    };
    /** Il modulo degli ologrammi WebGL, se questo mostro ne ha uno visibile (per farlo uscire di scena insieme alla carta). */
    const olograma = (uid) => { const g = window.MonsterHologramGL; return uid && g && typeof g.disintegra === 'function' && g.visibile(uid) ? g : null; };
    const easeIO = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const easeOut = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
    const lerp = (a, b, k) => a + (b - a) * k;

    function Scena() { this.v = []; this.cb = []; this.fan = []; }
    /** Aggiunge una primitiva: tipo, colore, inizio e durata in secondi, parametri A=[x,y,a,b] e w. */
    Scena.prototype.add = function (tipo, col, t0, dur, A, w) { if (this.v.length < MAX) this.v.push([tipo, col, t0, dur, A, w || 0]); return this; };
    Scena.prototype.dopo = function (ms, fn) { this.cb.push([ms, fn]); return this; };

    function sfx(nome, ms) {
        setTimeout(() => { try { if (window.SFX && typeof window.SFX[nome] === 'function') window.SFX[nome](); } catch (e) { /* un suono non rompe il duello */ } }, ms || 0);
    }

    /** Una callback da cui dipende il duello: parte una volta sola, qualunque cosa succeda. */
    function unaVolta(fn) { let fatto = false; return function () { if (fatto) return; fatto = true; if (typeof fn === 'function') fn(); }; }

    /** I tipi di primitiva usati da una scena (ognuno e' un programma da compilare). */
    const tipiDi = (sc) => Array.from(new Set(sc.v.map((e) => e[0])));

    /** Disegna una scena al tempo `t`: una passata ristretta per ogni primitiva attiva. */
    function disegnaScena(sc, t, ctx) {
        sc.v.forEach((e) => {
            const tipo = e[0]; const t0 = e[2]; const dur = e[3]; const A = e[4]; const w = e[5];
            if (t < t0 || t > t0 + dur) return;
            const c = COLORI[e[1]] || COLORI[0];
            ctx.passata('scena-' + tipo, sorgente(tipo), t, bbox(tipo, A, w), (u, g) => {
                g.uniform4f(u('IA'), A[0], A[1], A[2], A[3]); g.uniform4f(u('IB'), t0, dur, 0, w); g.uniform3f(u('col'), c[0], c[1], c[2]);
            });
        });
    }

    /**
     * Lancia la scena. Se WebGL manca o uno dei programmi non compila, lancia PRIMA che cambi qualsiasi
     * cosa (nessuna cinematica aperta, nessuna callback programmata) e effects.js passa al backend successivo.
     */
    function esegui(sc, durMs) {
        verifica(sc);
        window.FxWebgl.lancia('scena', null, durMs / 1000 + 0.1, null, null, (t, ctx) => disegnaScena(sc, t, ctx));
        window.FX.beginSummonCinematic();
        let chiuso = false;
        setTimeout(() => { if (chiuso) return; chiuso = true; window.FX.endSummonCinematic(); }, durMs);
        sc.cb.forEach((c) => setTimeout(() => { try { c[1](); } catch (e) { console.warn('[FX webgl]', e); } }, c[0]));
        sc.fan.forEach((f) => { try { f(); } catch (e) { /* una carta fantasma non rompe nulla */ } });
        return durMs;
    }

    /** Controlla che WebGL ci sia e che i programmi della scena compilino (e' lo stesso che li prepara in cache). */
    function verifica(sc) {
        tipiDi(sc).forEach((tipo) => { if (!window.FxWebgl.compilabile('scena-' + tipo, sorgente(tipo))) throw new Error('shader-non-compilato'); });
    }
    /** Una carta vera (elemento della pagina) animata con SOLA transform/opacita': f(u) -> {x,y,s,rot,rx,ry,op} (x,y = angolo alto-sinistro). */
    function fantasma(card, rect, f, delayMs, durMs) {
        if (!card || typeof window.createCardElement !== 'function') return;
        const g = window.createCardElement(card);
        Object.assign(g.style, {
            position: 'fixed', left: '0px', top: '0px', width: `${rect.width}px`, height: `${rect.height}px`, margin: '0',
            zIndex: String(Z + 6), pointerEvents: 'none', transition: 'none', filter: 'none', willChange: 'transform, opacity', transformOrigin: '50% 50%'
        });
        document.body.appendChild(g);
        const N = 16; const frames = [];
        for (let s = 0; s <= N; s++) {
            const u = s / N; const q = f(u);
            frames.push({
                transform: `translate3d(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px, 0) perspective(800px) rotateX(${(q.rx || 0).toFixed(1)}deg) rotateY(${(q.ry || 0).toFixed(1)}deg) rotate(${(q.rot || 0).toFixed(1)}deg) scale(${(q.s == null ? 1 : q.s).toFixed(3)})`,
                opacity: q.op == null ? 1 : q.op, offset: u
            });
        }
        const a = g.animate(frames, { duration: durMs, delay: delayMs, easing: 'linear', fill: 'both' });
        a.onfinish = () => g.remove();
        setTimeout(() => g.remove(), delayMs + durMs + 500);
    }

    /** Scritta che compare, resta e svanisce (transform e opacita'). */
    function testo(str, x, y, delayMs, durMs, opz) {
        const o = opz || {};
        const el = document.createElement('div');
        el.textContent = str;
        el.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:${Z + 7};pointer-events:none;white-space:nowrap;`
            + `font:900 ${o.size || 28}px system-ui,sans-serif;letter-spacing:.14em;color:${o.color || '#fff'};`
            + `text-shadow:0 0 14px ${o.glow || '#fff'},0 2px 0 rgba(0,0,0,.6);opacity:0;will-change:transform,opacity;`;
        document.body.appendChild(el);
        const a = el.animate([
            { opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' },
            { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)', offset: .15 },
            { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .75 },
            { opacity: 0, transform: 'translate(-50%,-50%) scale(1.04)' }
        ], { duration: durMs, delay: delayMs, fill: 'both' });
        a.onfinish = () => el.remove();
        setTimeout(() => el.remove(), delayMs + durMs + 500);
    }

    // =====================================================================
    // Gli spettacoli
    // =====================================================================

    const imp = {};

    /** Forza dello Specchio: lastra davanti al difensore e cinque raggi sui mostri in Attacco. */
    imp.playMirrorForce = function (attackerOwner, attackIndices) {
        const allowed = Array.isArray(attackIndices) ? new Set(attackIndices.map(Number)) : null;
        const targets = Array.from(document.querySelectorAll(`#${tavolo(attackerOwner)} .field-slot[data-owner="${attackerOwner}"][data-type="monster"]`))
            .filter((s) => !allowed || allowed.has(Number(/** @type {HTMLElement} */ (s).dataset.index))).map((s) => rectDi(s.querySelector('.card'))).filter(Boolean);
        if (!targets.length) return 0;
        const W = innerWidth; const H = innerHeight; const mx = W / 2; const my = attackerOwner === 'player' ? H * 0.37 : H * 0.63; const m = Math.min(W, H);
        const s = new Scena();
        s.add(T.WASH, C.SCURO, 0, 2.1, [0, 0, 0.5, 0], 3);
        s.add(T.SEAL, C.CIANO, 0.05, 1.5, [mx, my, m * 0.2, 0], 0.5);
        s.add(T.FLASH, C.BIANCO, 0.3, 0.5, [mx, my, m * 0.22, 0]);
        s.add(T.RING, C.CIANO, 0.32, 0.8, [mx, my, m * 0.3, 6]);
        targets.slice(0, 5).forEach((r, i) => {
            const c = cen(r); const t0 = 0.76 + i * 0.055;
            s.add(T.LINE, C.BIANCO, 0.36 + i * 0.055, 0.62, [mx, my, c.x, c.y], 8);
            s.add(T.FLASH, C.CALDO, t0, 0.5, [c.x, c.y, r.width * 1.1, 0]);
            s.add(T.RING, C.CIANO, t0, 0.6, [c.x, c.y, r.width * 1.2, 5]);
            s.add(T.BURST, C.CALDO, t0, 0.8, [c.x, c.y, r.width * 1.2, 40], i + 1);
        });
        const d = esegui(s, 2200); sfx('activateTrap', 0); return d;
    };

    /** Cilindro Magico: due portali deviano il colpo verso la mano dell'attaccante. */
    imp.playMagicCylinder = function (attackerOwner, attackerIndex, damagedOwner, damage) {
        const attacker = rectDi(document.querySelector(`#${tavolo(attackerOwner)} .field-slot[data-owner="${attackerOwner}"][data-type="monster"][data-index="${attackerIndex}"] .card`));
        const anchor = rectDi(document.querySelector(damagedOwner === 'player' ? '#playerHand' : '#botHand'));
        if (!attacker || !anchor) return 0;
        const from = cen(attacker); const to = cen(anchor);
        const en = { x: from.x + (to.x - from.x) * 0.28, y: from.y + (to.y - from.y) * 0.24 };
        const ex = { x: from.x + (to.x - from.x) * 0.64, y: from.y + (to.y - from.y) * 0.62 };
        const s = new Scena();
        s.add(T.WASH, C.SCURO, 0, 2.1, [0, 0, 0.45, 0], 3);
        s.add(T.VORTEX, C.CIANO, 0.1, 1.4, [en.x, en.y, 70, 0], 1);
        s.add(T.VORTEX, C.VIOLA, 0.2, 1.4, [ex.x, ex.y, 70, 0], 1);
        s.add(T.SEAL, C.VIOLA, 0.1, 1.6, [ex.x, ex.y, 105, 0], 0.5);
        s.add(T.LINE, C.CIANO, 0.25, 0.55, [from.x, from.y, en.x, en.y], 9);
        s.add(T.LINE, C.BIANCO, 0.55, 0.55, [en.x, en.y, ex.x, ex.y], 11);
        s.add(T.LINE, C.MAGENTA, 0.95, 0.55, [ex.x, ex.y, to.x, to.y], 10);
        s.add(T.FLASH, C.CALDO, 1.45, 0.6, [to.x, to.y, 90, 0]);
        s.add(T.RING, C.ARANCIO, 1.45, 0.7, [to.x, to.y, 130, 6]);
        s.add(T.BURST, C.ORO, 1.45, 0.8, [to.x, to.y, 130, 60], 3);
        if (damage) testo(`-${damage} LP`, to.x, to.y, 1500, 900, { size: 34, color: '#ffd9d0', glow: '#ff5040' });
        const d = esegui(s, 2200); sfx('directHit', 900); return d;
    };

    /**
     * Rinascita del Mostro, fedele alla versione originale (effects.css, "fx-monster-reborn"): scena scura e
     * verdastra, il portale piatto verde sul Cimitero, l'Ankh di luce che si apre sul bersaglio, e la carta
     * che sale inclinata dal Cimitero e si raddrizza sul Terreno. L'impatto cade a 1120 ms, come prima.
     */
    imp.playMonsterReborn = function (graveyardOwner, card, targetOwner, targetIndex, onImpact) {
        const target = rectDi(slotEl(targetOwner, 'monster', targetIndex));
        if (!target || typeof window.createCardElement !== 'function') { if (typeof onImpact === 'function') onImpact(); return 0; }
        const gr = rectZona(graveyardOwner, 'graveyard');
        const sx = gr ? gr.left + gr.width / 2 : innerWidth / 2; const sy = gr ? gr.top + gr.height / 2 : innerHeight / 2;
        const e = cen(target); const W = innerWidth;
        const ankhH = Math.max(165, Math.min(370, W * 0.23)); const portW = Math.max(100, Math.min(210, W * 0.14));
        const s = new Scena();
        s.add(T.WASH, C.VERDE_SCURO, 0, 1.9, [0, 0, 0.82, 0], 3);
        s.add(T.PORTAL, C.VERDE, 0, 1.6, [sx, sy, portW / 2, 0], 0.22);
        s.add(T.ANKH, C.VERDE, 0, 1.85, [e.x, e.y - ankhH * 0.02, ankhH / 2, 0]);
        const w = Math.max(52, target.width); const h = w * (target.height / target.width);
        fantasma(card, { width: w, height: h }, (u) => {
            // Keyframe dell'originale: invisibile fino al 18%, compare al 36%, arriva al 78%, svanisce al 100%.
            const k = u < 0.18 ? 0 : easeIO(Math.min(1, (u - 0.18) / 0.6));
            const tilt = u < 0.78 ? 68 * (1 - k) : 0;
            const sc = u < 0.78 ? lerp(0.18, 1.08, k) : lerp(1.08, 1, (u - 0.78) / 0.22);
            const op = u < 0.18 ? 0 : (u < 0.36 ? (u - 0.18) / 0.18 : (u > 0.78 ? 1 - (u - 0.78) / 0.22 : 1));
            return { x: lerp(sx - w / 2, e.x - w / 2, k), y: lerp(sy - h / 2, e.y - h / 2, k), rx: tilt, s: sc, op: op };
        }, 0, 1450);
        const imp1 = unaVolta(onImpact);
        s.dopo(1120, imp1); s.dopo(1900, imp1);
        const d = esegui(s, 1900); sfx('summon', 0); return d;
    };

    /** Buco Trappola: la casella si apre e il mostro cade nella voragine. */
    imp.playTrapHole = function (owner, index, card) {
        const rect = rectDi(slotEl(owner, 'monster', index)); if (!rect) return 0;
        const c = cen(rect); const py = rect.top + rect.height * 0.72;
        const s = new Scena();
        s.add(T.PIT, C.ARANCIO, 0, 1.4, [c.x, py, rect.width * 0.85, 0], 0.4);
        s.add(T.SMOKE, C.CALDO, 0.35, 1.0, [c.x, py, rect.width * 1.0, 0.45]);
        s.add(T.BURST, C.ARANCIO, 0.55, 0.8, [c.x, py, rect.width * 0.9, 60], 2);
        if (card) fantasma(card, rect, (u) => { const k = u * u; return { x: rect.left, y: rect.top + k * rect.height * 0.55, s: 1 - 0.7 * k, rot: k * 30, rx: k * 55, op: u > 0.8 ? (1 - u) / 0.2 : 1 }; }, 330, 800);
        const d = esegui(s, 1450); sfx('destroy', 570); return d;
    };

    /** Tributo Torrenziale: un fronte d'acqua attraversa entrambi i campi. */
    imp.playTorrentialTribute = function () {
        const W = innerWidth; const H = innerHeight; const s = new Scena();
        s.add(T.WASH, C.SCURO, 0, 1.7, [0, 0, 0.5, 0], 3);
        s.add(T.PILLAR, C.GHIACCIO, 0.1, 1.5, [W * 0.2, H, W * 0.16, 0], 1);
        s.add(T.PILLAR, C.CIANO, 0.2, 1.4, [W * 0.5, H, W * 0.2, 0], 1);
        s.add(T.PILLAR, C.GHIACCIO, 0.15, 1.5, [W * 0.8, H, W * 0.16, 0], 1);
        s.add(T.WASH, C.CIANO, 0.25, 1.4, [0, 0, 0.35, 0], 2);
        s.add(T.SMOKE, C.BIANCO, 0.5, 1.2, [W * 0.3, H * 0.55, W * 0.28, 0.5]);
        s.add(T.SMOKE, C.BIANCO, 0.6, 1.1, [W * 0.7, H * 0.5, W * 0.26, 0.5]);
        const d = esegui(s, 1800); sfx('destroy', 720); return d;
    };

    /** Anello della Distruzione: collare esplosivo e onda verso i LP. */
    imp.playRingOfDestruction = function (owner, index, damage) {
        const rect = rectMostro(owner, index); if (!rect) return 0;
        const c = cen(rect); const W = innerWidth; const H = innerHeight;
        const pl = { x: W * 0.88, y: H * 0.9 }; const bo = { x: W * 0.12, y: H * 0.1 };
        const s = new Scena();
        s.add(T.WASH, C.SCURO, 0, 1.7, [0, 0, 0.45, 0], 3);
        s.add(T.RING, C.ORO, 0.1, 0.55, [c.x, c.y, rect.width * 1.1, 4], -1);
        s.add(T.SEAL, C.ARANCIO, 0.05, 1.0, [c.x, c.y, rect.width * 0.85, 0], 1);
        s.add(T.FLASH, C.ROSSO, 0.62, 0.7, [c.x, c.y, rect.width * 1.8, 0]);
        s.add(T.RING, C.ARANCIO, 0.62, 0.8, [c.x, c.y, rect.width * 2.4, 6]);
        s.add(T.BURST, C.ORO, 0.62, 0.9, [c.x, c.y, rect.width * 2, 50], 4);
        s.add(T.LINE, C.ARANCIO, 0.75, 0.6, [c.x, c.y, pl.x, pl.y], 9);
        s.add(T.LINE, C.ARANCIO, 0.75, 0.6, [c.x, c.y, bo.x, bo.y], 9);
        s.add(T.FLASH, C.ROSSO, 1.1, 0.5, [pl.x, pl.y, 90, 0]);
        s.add(T.FLASH, C.ROSSO, 1.1, 0.5, [bo.x, bo.y, 90, 0]);
        if (damage) { testo(`-${damage} LP`, pl.x, pl.y - 40, 1100, 600, { size: 30, color: '#ffd9d0', glow: '#ff3a2a' }); testo(`-${damage} LP`, bo.x, bo.y + 40, 1100, 600, { size: 30, color: '#ffd9d0', glow: '#ff3a2a' }); }
        const d = esegui(s, 1750); sfx('destroy', 650); return d;
    };

    /** Tempesta Pesante: nubi e raffiche sulle file M/T, poi risolve il lotto. */
    imp.playHeavyStorm = function (onImpact) {
        const W = innerWidth; const H = innerHeight; const s = new Scena();
        s.add(T.WASH, C.SCURO, 0, 1.7, [0, 0, 0.6, 0], 1);
        s.add(T.SMOKE, C.SCURO, 0, 1.6, [W * 0.3, H * 0.15, W * 0.35, 0.9]);
        s.add(T.SMOKE, C.SCURO, 0.1, 1.5, [W * 0.75, H * 0.2, W * 0.35, 0.9]);
        s.add(T.WASH, C.GHIACCIO, 0.1, 1.5, [0, 0, 0.55, 0], 5);
        s.add(T.WASH, C.CIANO, 0.35, 1.3, [0, 0, 0.45, 0], 5);
        s.add(T.BURST, C.BIANCO, 0.5, 1.2, [W * 0.3, H * 0.45, W * 0.3, 0], 2);
        s.add(T.BURST, C.BIANCO, 0.6, 1.1, [W * 0.7, H * 0.55, W * 0.3, 0], 5);
        s.add(T.FLASH, C.BIANCO, 1.05, 0.5, [W / 2, H / 2, Math.min(W, H) * 0.6, 0]);
        s.add(T.RING, C.GHIACCIO, 1.05, 0.7, [W / 2, H / 2, Math.min(W, H) * 0.7, 8]);
        const imp1 = unaVolta(onImpact); s.dopo(1050, imp1); s.dopo(1800, imp1);
        const d = esegui(s, 1800); sfx('wind', 0); return d;
    };

    /** Tifone dello Spazio Mistico: un imbuto di vento solleva la carta e la strappa dal Terreno. */
    imp.playMysticalSpaceTyphoon = function (owner, index, onImpact) {
        const rect = rectDi(slotEl(owner, 'st', index));
        if (!rect) { if (typeof onImpact === 'function') onImpact(); return 0; }
        const c = cen(rect); const s = new Scena(); const sz = Math.max(rect.width * 2.7, 150);
        s.add(T.SEAL, C.CIANO, 0, 1.5, [c.x, rect.bottom, sz * 0.5, 0], 0.3);
        s.add(T.TWISTER, C.GHIACCIO, 0, 1.5, [c.x, rect.bottom, sz * 0.42, sz * 1.45]);
        s.add(T.TWISTER, C.CIANO, 0.15, 1.3, [c.x, rect.bottom, sz * 0.3, sz * 1.2]);
        s.add(T.FLASH, C.BIANCO, 0.78, 0.6, [c.x, c.y, rect.width * 1.5, 0]);
        s.add(T.BURST, C.GHIACCIO, 0.82, 0.7, [c.x, c.y, sz * 0.5, 30], 6);
        let carta = null;
        try { const arr = owner === 'player' ? window.gameState.playerSTField : window.gameState.botSTField; carta = arr && arr[index] && arr[index].card; } catch (e) { carta = null; }
        if (carta) fantasma(carta, rect, (u) => { const k = u * u; return { x: rect.left + Math.sin(u * 14) * rect.width * 0.18 * u, y: rect.top - k * rect.height * 1.4, rot: u * 720, s: 1 - 0.55 * k, op: u > 0.7 ? (1 - u) / 0.3 : 1 }; }, 150, 750);
        const imp1 = unaVolta(onImpact); s.dopo(820, imp1); s.dopo(1540, imp1);
        const d = esegui(s, 1540); sfx('wind', 0); return d;
    };

    /** Occhio/cuore sul bersaglio prima del normale viaggio di controllo. */
    imp.playMindControl = function (card, owner, index, mode) {
        const rect = rectMostro(owner, index); if (!rect) return 0;
        const c = cen(rect); const s = new Scena(); const heart = mode === 'heart';
        s.add(T.WASH, C.SCURO, 0, 1.2, [0, 0, 0.35, 0], 3);
        s.add(T.SEAL, heart ? C.MAGENTA : C.VIOLA, 0.05, 1.1, [c.x, c.y, rect.width * 1.1, 0], 1);
        s.add(T.VORTEX, heart ? C.MAGENTA : C.VIOLA, 0.1, 1.0, [c.x, c.y, rect.width * 0.9, 0], 1);
        if (heart) s.add(T.HEART, C.MAGENTA, 0.15, 1.0, [c.x, c.y, rect.width * 0.6, 0]);
        else s.add(T.EYE, C.VIOLA, 0.15, 1.0, [c.x, c.y, rect.width * 0.8, 0]);
        s.add(T.RING, heart ? C.MAGENTA : C.VIOLA, 0.55, 0.6, [c.x, c.y, rect.width * 1.5, 5]);
        const d = esegui(s, 1250); sfx('activateSpell', 0); return d;
    };

    /** Richiamo degli Infestati: nebbia, catene e il mostro che risale dal Cimitero. */
    imp.playCallOfTheHaunted = function (owner, card, targetIndex, onImpact) {
        const target = rectDi(slotEl(owner, 'monster', targetIndex));
        if (!target || typeof window.createCardElement !== 'function') { if (typeof onImpact === 'function') onImpact(); return 0; }
        const gr = rectZona(owner, 'graveyard');
        const sx = gr ? gr.left + gr.width / 2 : innerWidth / 2; const sy = gr ? gr.top + gr.height / 2 : innerHeight / 2; const e = cen(target);
        const s = new Scena();
        s.add(T.WASH, C.SCURO, 0, 1.7, [0, 0, 0.55, 0], 3);
        s.add(T.SMOKE, C.VERDE, 0, 1.5, [sx, sy, Math.max(120, target.width * 2), 0.5]);
        s.add(T.SEAL, C.VERDE, 0.05, 1.3, [sx, sy, Math.max(70, target.width), 0], 0.5);
        s.add(T.LINE, C.VERDE, 0.2, 0.8, [sx - target.width * 0.5, sy, e.x - target.width * 0.4, e.y], 6);
        s.add(T.LINE, C.VERDE, 0.28, 0.8, [sx + target.width * 0.5, sy, e.x + target.width * 0.4, e.y], 6);
        s.add(T.SEAL, C.VIOLA, 0.6, 1.0, [e.x, e.y, target.width * 1.3, 0], 0.5);
        s.add(T.FLASH, C.VERDE, 1.0, 0.7, [e.x, e.y, target.width * 1.4, 0]);
        s.add(T.RING, C.VERDE, 1.05, 0.7, [e.x, e.y, target.width * 1.5, 5]);
        const w = Math.max(52, target.width); const h = w * (target.height / target.width);
        fantasma(card, { width: w, height: h }, (u) => { const k = easeIO(u); return { x: lerp(sx - w / 2, e.x - w / 2, k), y: lerp(sy - h / 2, e.y - h / 2, k) - Math.sin(Math.PI * k) * 50, s: lerp(0.4, 1, k), rot: (1 - k) * -120, op: u < 0.15 ? u / 0.15 : 1 }; }, 200, 900);
        const imp1 = unaVolta(onImpact); s.dopo(1060, imp1); s.dopo(1750, imp1);
        const d = esegui(s, 1750); sfx('activateTrap', 0); return d;
    };

    /** Buco Trappola senza Fondo: portale dimensionale viola. */
    imp.playBottomlessTrapHole = function (owner, index, card) {
        const rect = rectDi(slotEl(owner, 'monster', index)); if (!rect) return 0;
        const c = cen(rect); const py = rect.top + rect.height * 0.72;
        const s = new Scena();
        s.add(T.WASH, C.SCURO, 0, 1.5, [0, 0, 0.4, 0], 3);
        s.add(T.PIT, C.VIOLA, 0, 1.5, [c.x, py, rect.width * 1.05, 0], 0.4);
        s.add(T.VORTEX, C.MAGENTA, 0.1, 1.2, [c.x, py, rect.width * 1.0, 0], 0.4);
        s.add(T.RING, C.VIOLA, 0.45, 0.8, [c.x, py, rect.width * 1.5, 5]);
        if (card) fantasma(card, rect, (u) => { const k = u * u; return { x: lerp(rect.left, c.x - rect.width / 2, k), y: lerp(rect.top, py - rect.height / 2, k), s: 1 - 0.95 * k, rot: k * 420, rx: k * 60, op: u > 0.85 ? (1 - u) / 0.15 : 1 }; }, 300, 950);
        const d = esegui(s, 1550); sfx('destroy', 620); return d;
    };

    /** Armatura Sakuretsu: piastre in prospettiva serrano l'attaccante e collassano. */
    imp.playSakuretsuArmor = function (owner, index) {
        const rect = rectMostro(owner, index); if (!rect) return 0;
        const c = cen(rect); const w = rect.width; const s = new Scena();
        s.add(T.WASH, C.SCURO, 0, 1.4, [0, 0, 0.4, 0], 3);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy], i) => s.add(T.LINE, C.ORO, 0.05 + i * 0.05, 0.5, [c.x + dx * w * 1.5, c.y + dy * w * 1.2, c.x + dx * w * 0.5, c.y + dy * w * 0.4], 12));
        s.add(T.RING, C.ARANCIO, 0.25, 0.5, [c.x, c.y, w * 1.4, 5], -1);
        s.add(T.SEAL, C.ORO, 0.2, 0.9, [c.x, c.y, w * 0.8, 0], 1);
        s.add(T.FLASH, C.CALDO, 0.62, 0.6, [c.x, c.y, w * 1.6, 0]);
        s.add(T.RING, C.ORO, 0.62, 0.7, [c.x, c.y, w * 2.2, 6]);
        s.add(T.BURST, C.ORO, 0.62, 0.8, [c.x, c.y, w * 1.8, 60], 8);
        const d = esegui(s, 1450); sfx('destroy', 650); return d;
    };

    /** Giudizio Solenne: tribunale celeste e sigillo che tronca l'azione negata. */
    imp.playSolemnJudgment = function (owner, cost) {
        const W = innerWidth; const H = innerHeight; const cy = owner === 'player' ? H * 0.66 : H * 0.34; const s = new Scena();
        s.add(T.WASH, C.CALDO, 0, 1.7, [0, 0, 0.5, 0], 1);
        s.add(T.PILLAR, C.ORO, 0.1, 1.4, [W / 2, H * 0.62, W * 0.12, 0], 1);
        s.add(T.SEAL, C.ORO, 0.25, 1.35, [W / 2, cy, Math.min(W, H) * 0.24, 0], 0.55);
        s.add(T.FLASH, C.CALDO, 0.45, 0.6, [W / 2, cy, Math.min(W, H) * 0.3, 0]);
        s.add(T.RING, C.ORO, 0.45, 0.8, [W / 2, cy, Math.min(W, H) * 0.4, 6]);
        testo('ANNULLATO', W / 2, H / 2, 450, 1200, { size: Math.min(54, W * 0.07), color: '#fff3c8', glow: '#ffb400' });
        if (cost) testo(`-${cost} LP`, W / 2, H / 2 + 50, 650, 1000, { size: 26, color: '#ffd9d0', glow: '#ff5040' });
        const d = esegui(s, 1750); sfx('activateTrap', 0); return d;
    };

    /** Libro della Luna: luna e sigillo sullo slot, la carta si ribalta. */
    imp.playBookOfMoon = function (owner, index, card) {
        const rect = rectMostro(owner, index); if (!rect) return 0;
        const c = cen(rect); const w = rect.width; const s = new Scena();
        s.add(T.WASH, C.SCURO, 0, 1.25, [0, 0, 0.4, 0], 3);
        s.add(T.SEAL, C.BLU, 0.05, 1.1, [c.x, c.y, w * 1.2, 0], 0.5);
        s.add(T.MOON, C.GHIACCIO, 0.05, 1.2, [c.x, c.y - w * 0.95, w * 0.7, 0]);
        s.add(T.PILLAR, C.BLU, 0.2, 0.9, [c.x, c.y, w * 0.4, 0], 1);
        s.add(T.RING, C.GHIACCIO, 0.5, 0.6, [c.x, c.y, w * 1.4, 5]);
        if (card) fantasma(card, rect, (u) => { const k = easeIO(u); return { x: rect.left, y: rect.top - Math.sin(Math.PI * k) * 18, ry: k * 180, s: 1 + 0.08 * Math.sin(Math.PI * k), op: u > 0.9 ? (1 - u) / 0.1 : 1 }; }, 200, 800);
        const d = esegui(s, 1300); sfx('activateSpell', 0); return d;
    };

    /** Virus Distruggi-Carte: scansione infetta sugli slot colpiti. */
    imp.playCrushCardVirus = function (owner, targetIndices) {
        const victim = owner === 'player' ? 'bot' : 'player'; const allowed = new Set((targetIndices || []).map(Number));
        const targets = Array.from(document.querySelectorAll(`#${tavolo(victim)} .field-slot[data-owner="${victim}"][data-type="monster"]`))
            .filter((sl) => allowed.has(Number(/** @type {HTMLElement} */ (sl).dataset.index))).map((sl) => rectDi(sl.querySelector('.card'))).filter(Boolean);
        const W = innerWidth; const H = innerHeight; const s = new Scena();
        s.add(T.WASH, C.VERDE, 0, 1.7, [0, 0, 0.3, 0], 3);
        s.add(T.VORTEX, C.VERDE, 0.05, 1.4, [W / 2, H / 2, Math.min(W, H) * 0.25, 0], 0.7);
        s.add(T.WASH, C.VERDE, 0.2, 1.1, [0, 0, 0.6, 38], 4);
        targets.slice(0, 5).forEach((r, i) => { const c = cen(r); const t0 = 0.42 + i * 0.09;
            s.add(T.PANEL, C.VERDE, t0, 0.9, [c.x, c.y, r.width * 0.72, r.height * 0.58]);
            s.add(T.FLASH, C.VERDE, t0 + 0.2, 0.5, [c.x, c.y, r.width * 1.1, 0]);
            s.add(T.BURST, C.VERDE, t0 + 0.2, 0.7, [c.x, c.y, r.width * 1.2, 30], i + 3); });
        testo('VIRUS DISTRUGGI-CARTE', W / 2, H * 0.5, 250, 1400, { size: Math.min(34, W * 0.045), color: '#d4ffd8', glow: '#2eea58' });
        const d = esegui(s, 1800); sfx('activateTrap', 0); return d;
    };

    /** Nega Attacco: un varco assorbe il colpo. */
    imp.playNegateAttack = function (attackerOwner, attackerIndex) {
        const rect = rectMostro(attackerOwner, attackerIndex); if (!rect) return 0;
        const p = cen(rect); const W = innerWidth; const H = innerHeight; const gx = W / 2; const gy = H / 2; const s = new Scena();
        s.add(T.WASH, C.SCURO, 0, 1.5, [0, 0, 0.5, 0], 3);
        s.add(T.VORTEX, C.BLU, 0.1, 1.3, [gx, gy, Math.min(W, H) * 0.16, 0], 0.55);
        s.add(T.SEAL, C.CIANO, 0.1, 1.3, [gx, gy, Math.min(W, H) * 0.2, 0], 0.55);
        s.add(T.LINE, C.ROSSO, 0.2, 0.6, [p.x, p.y, gx, gy], 10);
        s.add(T.FLASH, C.CIANO, 0.7, 0.6, [gx, gy, Math.min(W, H) * 0.22, 0]);
        s.add(T.RING, C.CIANO, 0.7, 0.7, [gx, gy, Math.min(W, H) * 0.35, 6]);
        testo('ATTACCO NEGATO', gx, gy + Math.min(W, H) * 0.3, 350, 1100, { size: Math.min(40, W * 0.05), color: '#d8f4ff', glow: '#3fb6ff' });
        const d = esegui(s, 1550); sfx('activateTrap', 0); return d;
    };

    /** Capro Espiatorio: spiriti sugli slot dei Token appena creati. */
    imp.playScapegoat = function (owner, tokenIndices) {
        const targets = (tokenIndices || []).map((i) => rectDi(slotEl(owner, 'monster', i))).filter(Boolean);
        if (!targets.length) return 0;
        const W = innerWidth; const H = innerHeight; const s = new Scena();
        s.add(T.WASH, C.GHIACCIO, 0, 1.6, [0, 0, 0.25, 0], 3);
        targets.slice(0, 5).forEach((r, i) => { const c = cen(r); const t0 = i * 0.105;
            s.add(T.SMOKE, C.BIANCO, t0 + 0.1, 1.2, [c.x, c.y, r.width * 1.0, 0.3]);
            s.add(T.FLASH, C.GHIACCIO, t0 + 0.25, 0.7, [c.x, c.y, r.width * 0.7, 0]);
            s.add(T.RING, C.CIANO, t0 + 0.3, 0.7, [c.x, c.y, r.width * 1.3, 4]);
            s.add(T.BURST, C.BIANCO, t0 + 0.3, 0.8, [c.x, c.y, r.width * 1.1, -25], i + 2); });
        testo('CAPRO ESPIATORIO', W / 2, owner === 'player' ? H * 0.4 : H * 0.6, 200, 1350, { size: Math.min(34, W * 0.045), color: '#f0fbff', glow: '#7ee0ff' });
        const d = esegui(s, 1650); sfx('activateSpell', 0); return d;
    };

    /** Scatola Mistica: due cabine, lama e passaggio di controllo. */
    imp.playMysticBox = function (destroyedTarget, offeredTarget) {
        if (!destroyedTarget || !offeredTarget) return 0;
        const rd = rectDi(slotEl(destroyedTarget.owner, 'monster', destroyedTarget.index));
        const ro = rectDi(slotEl(offeredTarget.owner, 'monster', offeredTarget.index));
        if (!rd || !ro) return 0;
        const a = cen(rd); const b = cen(ro); const s = new Scena();
        s.add(T.WASH, C.SCURO, 0, 1.7, [0, 0, 0.45, 0], 3);
        s.add(T.PANEL, C.VIOLA, 0.1, 1.3, [a.x, a.y, rd.width * 0.8, rd.height * 0.65]);
        s.add(T.PANEL, C.CIANO, 0.15, 1.3, [b.x, b.y, ro.width * 0.8, ro.height * 0.65]);
        s.add(T.PILLAR, C.MAGENTA, 0.2, 1.1, [a.x, a.y, rd.width * 0.35, 0], 1);
        s.add(T.LINE, C.BIANCO, 0.5, 0.6, [a.x - rd.width, a.y - rd.height, a.x + rd.width, a.y + rd.height], 7);
        s.add(T.ORB, C.CIANO, 0.7, 0.8, [a.x, a.y, b.x, b.y], 16);
        s.add(T.FLASH, C.CALDO, 0.9, 0.6, [a.x, a.y, rd.width * 1.3, 0]);
        s.add(T.RING, C.CIANO, 1.4, 0.6, [b.x, b.y, ro.width * 1.4, 5]);
        if (destroyedTarget.card) fantasma(destroyedTarget.card, rd, (u) => ({ x: rd.left + (u > 0.35 ? Math.sin(u * 60) * 4 : 0), y: rd.top, s: u > 0.5 ? Math.max(0.02, 1 - (u - 0.5) * 2) : 1, op: u > 0.5 ? 1 - (u - 0.5) * 2 : 1 }), 200, 1100);
        const d = esegui(s, 1750); sfx('activateSpell', 0); return d;
    };

    /** Rimozione del Limitatore: sovraccarica solo le Macchine coinvolte. */
    imp.playLimiterRemoval = function (owner, machineIndices) {
        const targets = (machineIndices || []).map((i) => rectMostro(owner, i)).filter(Boolean);
        if (!targets.length) return 0;
        const W = innerWidth; const H = innerHeight; const s = new Scena();
        s.add(T.WASH, C.ROSSO, 0, 1.5, [0, 0, 0.3, 0], 3);
        s.add(T.WASH, C.ARANCIO, 0.1, 1.2, [0, 0, 0.4, 28], 4);
        targets.slice(0, 5).forEach((r, i) => { const c = cen(r); const t0 = i * 0.08;
            s.add(T.SEAL, C.ARANCIO, t0, 1.2, [c.x, c.y, r.width * 0.95, 0], 1);
            s.add(T.FLASH, C.ORO, t0 + 0.2, 0.6, [c.x, c.y, r.width * 1.3, 0]);
            s.add(T.RING, C.ROSSO, t0 + 0.3, 0.7, [c.x, c.y, r.width * 1.6, 5]);
            s.add(T.BURST, C.ORO, t0 + 0.3, 0.8, [c.x, c.y, r.width * 1.5, 30], i + 1); });
        testo('LIMITATORE RIMOSSO', W / 2, owner === 'player' ? H * 0.42 : H * 0.58, 250, 1250, { size: Math.min(34, W * 0.045), color: '#fff0d0', glow: '#ff7a1a' });
        const d = esegui(s, 1600); sfx('activateSpell', 0); return d;
    };

    /** Incantesimo Ombra: catene d'ombra sull'attaccante. */
    imp.playShadowSpell = function (owner, index) {
        const rect = rectMostro(owner, index); if (!rect) return 0;
        const c = cen(rect); const w = rect.width; const s = new Scena();
        s.add(T.WASH, C.SCURO, 0, 1.35, [0, 0, 0.5, 0], 3);
        s.add(T.SMOKE, C.SCURO, 0, 1.3, [c.x, c.y, w * 1.4, 0.9]);
        s.add(T.SEAL, C.VIOLA, 0.1, 1.1, [c.x, c.y, w * 0.95, 0], 1);
        [[-1, -1], [1, -1], [0, 1.4]].forEach(([dx, dy], i) => s.add(T.LINE, C.VIOLA, 0.1 + i * 0.07, 0.8, [c.x + dx * w * 1.6, c.y + dy * w * 1.3, c.x, c.y], 7));
        s.add(T.FLASH, C.VIOLA, 0.55, 0.6, [c.x, c.y, w * 1.1, 0]);
        const d = esegui(s, 1400); sfx('activateTrap', 0); return d;
    };

    /** Cerchio Ammaliante: sigillo sull'attaccante (la catena persistente la disegna il renderer). */
    imp.playSpellbindingCircle = function (owner, index) {
        const rect = rectMostro(owner, index); if (!rect) return 0;
        const c = cen(rect); const w = rect.width; const s = new Scena();
        s.add(T.SEAL, C.ORO, 0, 1.3, [c.x, c.y, w * 1.05, 0], 1);
        s.add(T.SEAL, C.MAGENTA, 0.12, 1.1, [c.x, c.y, w * 0.7, 0], 1);
        s.add(T.RING, C.ORO, 0.4, 0.8, [c.x, c.y, w * 1.5, 5]);
        s.add(T.FLASH, C.CALDO, 0.35, 0.6, [c.x, c.y, w * 1.0, 0]);
        const d = esegui(s, 1350); sfx('activateTrap', 0); return d;
    };

    /** Cappelli Magici: tre cappelli si materializzano sopra gli slot. */
    imp.playMagicalHats = function (owner, indices) {
        const targets = (indices || []).map((i) => rectDi(slotEl(owner, 'monster', i))).filter(Boolean);
        if (!targets.length) return 0;
        const s = new Scena();
        s.add(T.WASH, C.SCURO, 0, 1.6, [0, 0, 0.35, 0], 3);
        targets.slice(0, 5).forEach((r, i) => { const c = cen(r); const t0 = i * 0.1;
            s.add(T.SMOKE, C.VIOLA, t0, 1.0, [c.x, c.y, r.width * 1.0, 0.6]);
            s.add(T.HAT, C.VIOLA, t0 + 0.1, 1.3, [c.x, c.y, r.width * 0.75, 0]);
            s.add(T.BURST, C.ORO, t0 + 0.3, 0.8, [c.x, c.y, r.width * 1.1, -25], i + 1); });
        const d = esegui(s, 1650); sfx('activateTrap', 0); return d;
    };

    /** Moltiplicazione: il Kuriboh centrale si divide verso i Token. */
    imp.playMultiply = function (owner, sourceIndex, tokenIndices) {
        const src = rectDi(slotEl(owner, 'monster', sourceIndex)); if (!src) return 0;
        const a = cen(src); const s = new Scena();
        s.add(T.SEAL, C.CALDO, 0, 1.2, [a.x, a.y, src.width * 0.9, 0], 1);
        (tokenIndices || []).slice(0, 5).forEach((i, k) => { const r = rectDi(slotEl(owner, 'monster', i)); if (!r) return; const b = cen(r); const t0 = 0.1 + k * 0.08;
            s.add(T.ORB, C.MAGENTA, t0, 0.8, [a.x, a.y, b.x, b.y], 14);
            s.add(T.FLASH, C.ORO, t0 + 0.75, 0.5, [b.x, b.y, r.width * 1.0, 0]);
            s.add(T.RING, C.MAGENTA, t0 + 0.75, 0.5, [b.x, b.y, r.width * 1.2, 4]); });
        const d = esegui(s, 1550); sfx('activateSpell', 0); return d;
    };

    /** Controllore del Nemico: pannello e comando scelto. */
    imp.playEnemyController = function (owner, index, mode) {
        const rect = rectMostro(owner, index); if (!rect) return 0;
        const c = cen(rect); const s = new Scena();
        s.add(T.WASH, C.SCURO, 0, 1.3, [0, 0, 0.35, 0], 3);
        s.add(T.PANEL, C.CIANO, 0.05, 1.25, [c.x, c.y, rect.width * 1.08, rect.height * 0.68]);
        s.add(T.PANEL, C.BLU, 0.2, 1.05, [c.x, c.y, rect.width * 0.9, rect.height * 0.5]);
        s.add(T.FLASH, C.CIANO, 0.6, 0.5, [c.x, c.y, rect.width * 1.2, 0]);
        testo(mode === 'controllo' ? 'CONTROL' : 'POSITION', c.x, c.y - rect.height * 0.15, 300, 950, { size: 20, color: '#d8f4ff', glow: '#3fb6ff' });
        testo('↑ ↓ ← → A B', c.x, c.y + rect.height * 0.15, 400, 850, { size: 16, color: '#bfe9ff', glow: '#3fb6ff' });
        const d = esegui(s, 1350); sfx('activateSpell', 0); return d;
    };

    /** Buco Dimensionale: varco netto sul proprio slot prima del bando. */
    imp.playDimensionHole = function (owner, index, card) {
        const rect = rectDi(slotEl(owner, 'monster', index)); if (!rect) return 0;
        const c = cen(rect); const w = rect.width; const s = new Scena();
        s.add(T.WASH, C.SCURO, 0, 1.45, [0, 0, 0.4, 0], 3);
        s.add(T.PIT, C.CIANO, 0, 1.4, [c.x, c.y, w * 0.95, 0], 1);
        s.add(T.VORTEX, C.VIOLA, 0.05, 1.3, [c.x, c.y, w * 0.95, 0], 1);
        s.add(T.RING, C.CIANO, 0.4, 0.8, [c.x, c.y, w * 1.5, 5]);
        if (card) fantasma(card, rect, (u) => { const k = u * u; return { x: rect.left, y: rect.top, s: 1 - 0.97 * k, rot: k * 360, op: u > 0.85 ? (1 - u) / 0.15 : 1 }; }, 300, 900);
        const d = esegui(s, 1450); return d;
    };

    /** Tornado di Polvere sulla singola Magia/Trappola. */
    imp.playDustTornado = function (owner, index, onImpact) {
        const rect = rectDi(slotEl(owner, 'st', index));
        if (!rect) { if (typeof onImpact === 'function') onImpact(); return 0; }
        const c = cen(rect); const sz = Math.max(rect.width * 2.5, 130); const s = new Scena();
        s.add(T.SMOKE, C.CALDO, 0, 1.3, [c.x, rect.bottom, rect.width * 1.1, 0.6]);
        s.add(T.TWISTER, C.CALDO, 0, 1.3, [c.x, rect.bottom, sz * 0.36, sz * 1.1]);
        s.add(T.TWISTER, C.ARANCIO, 0.1, 1.1, [c.x, rect.bottom, sz * 0.26, sz * 0.9]);
        s.add(T.BURST, C.CALDO, 0.88, 0.7, [c.x, c.y, sz * 0.4, 20], 9);
        const imp1 = unaVolta(onImpact); s.dopo(900, imp1); s.dopo(1330, imp1);
        const d = esegui(s, 1330); sfx('wind', 0); return d;
    };

    /** Piumino delle Arpie: folata larga sull'intera fila Magie/Trappole. */
    imp.playHarpiesFeatherDuster = function (owner, onImpact) {
        const rects = Array.from(document.querySelectorAll(`#${tavolo(owner)} .field-slot[data-owner="${owner}"][data-type="st"]`)).map(rectDi).filter(Boolean);
        if (!rects.length) { if (typeof onImpact === 'function') onImpact(); return 0; }
        const left = Math.min(...rects.map((r) => r.left)); const right = Math.max(...rects.map((r) => r.right));
        const top = Math.min(...rects.map((r) => r.top)); const bottom = Math.max(...rects.map((r) => r.bottom));
        const cy = (top + bottom) / 2; const s = new Scena();
        s.add(T.WASH, C.CALDO, 0.1, 1.3, [0, 0, 0.5, 0], 5);
        s.add(T.WASH, C.GHIACCIO, 0.3, 1.0, [0, 0, 0.4, 0], 5);
        s.add(T.LINE, C.BIANCO, 0.05, 0.7, [left - 40, cy - 14, right + 40, cy - 14], 10);
        s.add(T.LINE, C.GHIACCIO, 0.15, 0.7, [left - 40, cy + 12, right + 40, cy + 12], 9);
        [0.2, 0.4, 0.6, 0.8].forEach((f, i) => s.add(T.BURST, C.BIANCO, 0.9 + i * 0.03, 0.8, [lerp(left, right, f), cy, (right - left) * 0.12, -20], i + 1));
        s.add(T.FLASH, C.CALDO, 1.05, 0.5, [(left + right) / 2, cy, (right - left) * 0.4, 0]);
        const imp1 = unaVolta(onImpact); s.dopo(1050, imp1); s.dopo(1570, imp1);
        const d = esegui(s, 1570); sfx('wind', 0); return d;
    };

    // ---------------------------------------------------------------------
    // Gli effetti "di tutti i giorni" (gia' sostituiti da GSAP, qui rifatti)
    // ---------------------------------------------------------------------

    imp.playSummonShockwave = function (el) {
        const r = rectDi(el); if (!r) return;
        const c = cen(r); const s = new Scena();
        // Carta evocata sul campo (in Attacco o in Difesa, scoperta o coperta): CONTENUTA. Un solo anello sottile e
        // freddo che non esce dalla carta, e un lampo bianco appena accennato. Niente gialli, niente scintille.
        s.add(T.RING, C.GHIACCIO, 0, 0.5, [c.x, c.y, Math.max(r.width, r.height) * 0.62, 2.2]);
        s.add(T.FLASH, C.BIANCO, 0, 0.3, [c.x, c.y, Math.max(r.width, r.height) * 0.32, 0]);
        breve(s, 0.55);
    };

    imp.playSummonCircle = function (el) {
        const r = rectDi(el); if (!r) return;
        const c = cen(r); const sz = Math.max(r.width, r.height) * 1.3; const s = new Scena();
        // Come sopra: un anello sottile e freddo attorno alla carta e un lampo tenue, nient'altro.
        s.add(T.RING, C.GHIACCIO, 0, 0.55, [c.x, c.y, sz * 0.5, 2.2]);
        s.add(T.FLASH, C.BIANCO, 0, 0.3, [c.x, c.y, sz * 0.26, 0]);
        breve(s, 0.6);
    };

    /**
     * Pescata, fedele alla versione GSAP: il dorso di una carta parte dal mazzo, inclinato di -10 gradi, e
     * va sulla carta appena arrivata in mano (300 ms, ease inOut) mentre il mazzo manda un bagliore azzurro
     * sul bordo. La carta vera NON si tocca (ha la sua entrata .deal-in). Qui niente GSAP: sola transform/opacita'.
     */
    imp.playDrawEffect = function (cardElement) {
        if (!cardElement) return;
        const arrivo = cardElement.getBoundingClientRect(); if (!arrivo.width) return;
        const mazzo = document.querySelector('#playerFieldBoard .field-slot[data-zone="deck"]') || document.querySelector('.field-slot[data-zone="deck"]');
        if (!mazzo) return;
        const p = mazzo.getBoundingClientRect(); if (!p.width) return;
        const raggio = getComputedStyle(cardElement).borderRadius || '6px';
        const volante = document.createElement('div');
        volante.className = 'fx-gsap-draw-card'; // lo stile del dorso sta in card.css
        volante.style.cssText = 'position:fixed;left:' + p.left + 'px;top:' + p.top + 'px;width:' + p.width + 'px;height:' + p.height + 'px;'
            + 'pointer-events:none;z-index:10040;border-radius:' + raggio + ';will-change:transform,opacity;transform-origin:0 0;'
            + 'box-shadow:0 8px 24px rgba(0,0,0,0.55),0 0 18px rgba(125,211,252,0.45);';
        document.body.appendChild(volante);
        const dx = arrivo.left - p.left; const dy = arrivo.top - p.top; const sx = arrivo.width / p.width; const sy = arrivo.height / p.height;
        const a = volante.animate([
            { transform: 'translate(0px,0px) rotate(-10deg) scale(1,1)', opacity: 1, offset: 0 },
            { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(0deg) scale(' + sx + ',' + sy + ')', opacity: 1, offset: 0.73 },
            { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(0deg) scale(' + sx + ',' + sy + ')', opacity: 0, offset: 1 }
        ], { duration: 300, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
        a.onfinish = () => volante.remove(); setTimeout(() => volante.remove(), 900);
        const bag = document.createElement('div');
        bag.style.cssText = 'position:fixed;left:' + p.left + 'px;top:' + p.top + 'px;width:' + p.width + 'px;height:' + p.height + 'px;pointer-events:none;z-index:10039;'
            + 'border-radius:' + raggio + ';opacity:0;box-shadow:0 0 0 2px rgba(125,211,252,0.9),0 0 26px 6px rgba(125,211,252,0.55);';
        document.body.appendChild(bag);
        const b = bag.animate([{ opacity: 0 }, { opacity: 1, offset: 0.21 }, { opacity: 0 }], { duration: 430, fill: 'forwards' });
        b.onfinish = () => bag.remove(); setTimeout(() => bag.remove(), 900);
    };

    // ---------------------------------------------------------------------
    // Gli impatti di battaglia (danno ai Life Point, scontro, distruzione). Identici a quelli GSAP nei tempi e
    // nei movimenti; la differenza e' che i lampi, gli anelli, il fumo e le scintille sono disegnati sulla
    // tela WebGL e le carte e la scossa del campo si muovono con la sola proprieta' `translate`/`scale`
    // (compositor), invece di tween GSAP su `x`/`filter` che a ogni colpo facevano ridipingere il campo.
    // ---------------------------------------------------------------------

    /** Scossa orizzontale con la proprieta' `translate` (non tocca `transform`, quindi convive con le pose della carta/del campo). */
    function scossa(el, passi, ritardoMs) {
        if (!el || typeof el.animate !== 'function') return;
        const tot = passi.reduce((a, q) => a + q[1], 0); let tt = 0;
        const fr = [{ translate: '0px 0px', offset: 0 }];
        passi.forEach((q) => { tt += q[1]; fr.push({ translate: `${q[0]}px 0px`, offset: Math.min(1, tt / tot) }); });
        const prima = el.style.willChange; el.style.willChange = 'translate';
        const a = el.animate(fr, { duration: tot * 1000, delay: ritardoMs || 0, easing: 'linear' });
        const fine = () => { if (el.style.willChange === 'translate') el.style.willChange = prima; };
        a.onfinish = fine; a.oncancel = fine;
    }

    const IN_CUBICA = 'cubic-bezier(.55,.05,.67,.19)';
    const OUT_CUBICA = 'cubic-bezier(.215,.61,.355,1)';

    /** Danno ai Life Point: scossa del campo, vignetta rossa, il numero che sale. */
    imp.playDamageEffect = function (amount, opts) {
        const container = document.querySelector('.game-container') || document.body;
        const forza = Math.min(18, 6 + (Number(amount) || 0) / 260);
        const touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        const target = (opts && opts.anchorEl) || null;
        const r = target ? rectDi(target) : null;
        const p = r ? cen(r) : { x: window.innerWidth / 2, y: window.innerHeight * 0.42 };
        const s = new Scena();
        s.add(T.WASH, C.ROSSO, 0, 0.54, [0, 0, 0.55, 0], 3);
        // Impatto a mezzo schermo (lampo, vignetta, crepe, filo sul bordo) e alone dietro il numero grande: prima erano
        // strati DOM con gradienti, blend e filtri animati, i veri responsabili dei cali di frame al colpo.
        const owner = opts && opts.owner;
        if (owner) s.add(T.WASH, C.ROSSO, 0, 0.9, [0, 0, 1, 0], owner === 'bot' ? 6 : 7);
        s.add(T.FLASH, C.ROSSO, 0, 1.1, [window.innerWidth / 2, window.innerHeight * 0.42, Math.min(window.innerWidth * 0.3, 190), 0]);
        if (touch) s.add(T.RING, C.ROSSO, 0, 0.34, [p.x, p.y, 74, 3]);
        verifica(s);
        if (!touch && container !== document.body) scossa(container, [[-forza, 0.05], [forza * 0.8, 0.06], [-forza * 0.5, 0.06], [forza * 0.25, 0.06], [0, 0.08]]);
        breve(s, 0.56);
        // Il numero: 0.22s sale a 1.15, 0.1s si assesta, resta 0.25s, poi sale di 42px svanendo in 0.5s.
        const el = document.createElement('div');
        el.textContent = '-' + (Number(amount) || 0);
        el.style.cssText = `position:fixed;left:${p.x}px;top:${p.y}px;z-index:${Z + 7};pointer-events:none;white-space:nowrap;`
            + 'color:#ff5b5b;font-weight:900;font-size:clamp(1.6rem,5vw,3rem);will-change:transform,opacity;opacity:0;'
            + 'text-shadow:0 0 12px rgba(255,0,0,.8),0 2px 6px rgba(0,0,0,.9);';
        document.body.appendChild(el);
        const T0 = 1.07; const f = (sc, y) => `translate(-50%, calc(-50% + ${y}px)) scale(${sc})`;
        const an = el.animate([
            { transform: f(0.4, 0), opacity: 0, offset: 0, easing: OUT_CUBICA },
            { transform: f(1.15, 0), opacity: 1, offset: 0.22 / T0 },
            { transform: f(1, 0), opacity: 1, offset: 0.32 / T0 },
            { transform: f(1, 0), opacity: 1, offset: 0.57 / T0, easing: 'cubic-bezier(.11,0,.5,0)' },
            { transform: f(1, -42), opacity: 0, offset: 1 }
        ], { duration: T0 * 1000, fill: 'both' });
        an.onfinish = () => el.remove(); setTimeout(() => el.remove(), T0 * 1000 + 600);
    };

    /** Scontro: l'attaccante rincula e carica, lampo al punto d'impatto, il bersaglio trema, scintille. */
    imp.playBattleClashEpic = function (attackerEl, targetEl) {
        const ra = attackerEl ? rectDi(attackerEl) : null; const rt = targetEl ? rectDi(targetEl) : null;
        const a = ra ? cen(ra) : null; const t = rt ? cen(rt) : null; const point = t || a;
        if (!point) return;
        const both = !!(a && t);
        const midX = both ? (a.x + t.x) / 2 : point.x; const midY = both ? (a.y + t.y) / 2 : point.y;
        const t0 = both ? 0.32 : 0;   // l'impatto della rincorsa CSS (chargeAttack, 46% di 700ms)
        const s = new Scena();
        s.add(T.FLASH, C.CALDO, t0, 0.46, [midX, midY, 120, 0]);
        // Il colpo sul bersaglio (prima .battle-hit, un riquadro con gradiente): lampo bianco-oro sulla carta.
        if (rt) s.add(T.FLASH, C.CALDO, both ? t0 : 0, 0.55, [t.x, t.y, Math.max(rt.width, rt.height) * 0.8, 0]);
        for (let i = 0; i < 3; i++) s.add(T.BURST, C.CALDO, t0, 0.8, [midX, midY, 120 + i * 30, 36], 3 + i * 7.3);
        verifica(s);
        // La rincorsa dell'attaccante e' UNA sola, quella CSS (chargeAttack): qui solo l'impatto.
        if (targetEl && targetEl.animate) {
            const fr = []; for (let i = 0; i <= 6; i++) fr.push({ translate: (i % 2 ? '0px' : '6px') + ' 0px', offset: i / 6 });
            fr[0].translate = '0px 0px'; fr[1].translate = '6px 0px'; fr[2].translate = '0px 0px'; fr[3].translate = '6px 0px'; fr[4].translate = '0px 0px'; fr[5].translate = '6px 0px'; fr[6].translate = '0px 0px';
            targetEl.animate(fr, { duration: 300, delay: both ? 330 : 20, easing: 'linear' });
        }
        breve(s, t0 + 0.9);
    };

    /**
     * L'attacco si infrange: il bersaglio ha retto (indistruttibile, o DEF piu' alta). Una barriera esagonale si
     * forma attorno al bersaglio, il colpo la accende dal lato di chi ha attaccato, le scintille rimbalzano
     * indietro verso l'attaccante e il bersaglio incassa con un lieve scossone. Solo luce: la regola e' gia' decisa.
     */
    imp.playAttackBlocked = function (attackerEl, targetEl) {
        const rt = targetEl ? rectDi(targetEl) : null; if (!rt) return;
        const ra = attackerEl ? rectDi(attackerEl) : null;
        const t = cen(rt); const a = ra ? cen(ra) : null;
        const ang = a ? Math.atan2(a.y - t.y, a.x - t.x) : -Math.PI / 2;
        const raggio = Math.max(rt.width, rt.height) * 0.62;
        const ix = t.x + Math.cos(ang) * raggio * 1.15 * 0.92; const iy = t.y + Math.sin(ang) * raggio * 1.15 * 0.92;
        const s = new Scena();
        s.add(T.SHIELD, C.CIANO, 0, 0.95, [t.x, t.y, raggio, 0], ang);
        s.add(T.FLASH, C.BIANCO, 0, 0.3, [ix, iy, raggio * 0.7, 0]);
        s.add(T.RING, C.GHIACCIO, 0, 0.45, [ix, iy, raggio * 0.9, 3]);
        for (let i = 0; i < 3; i++) s.add(T.BURST, C.GHIACCIO, 0, 0.7, [ix, iy, 90 + i * 24, 30], 4 + i * 5.1);
        verifica(s);
        if (targetEl && targetEl.animate) {
            const dx = Math.cos(ang + Math.PI) * 5; const dy = Math.sin(ang + Math.PI) * 5;
            targetEl.animate([{ translate: '0px 0px' }, { translate: dx + 'px ' + dy + 'px' }, { translate: '0px 0px' }], { duration: 260, easing: 'ease-out' });
        }
        breve(s, 1.0);
    };

    /**
     * Una carta lascia il Terreno e finisce nel Cimitero: un'anima di luce parte dalla carta e vola alla pila, che
     * la "ingoia" con un lampo e un anello; la carta si rimpicciolisce e si dissolve lungo il percorso. Se il mostro ha
     * un ologramma, si disintegra sul posto. Va chiamata PRIMA di svuotare la casella.
     */
    imp.playCardToGraveyard = function (card, fieldOwner, fieldIndex, graveOwner, type) {
        const rf = rettaCarta(fieldOwner, type || 'monster', fieldIndex);
        const rg = rectZona(graveOwner == null ? fieldOwner : graveOwner, 'graveyard');
        if (!rf || !rg) return;
        const a = cen(rf); const b = cen(rg);
        const GL = olograma(card && card.uid); if (GL) GL.disintegra(card.uid, 60, 600);
        const s = new Scena();
        s.add(T.RING, C.GHIACCIO, 0, 0.4, [a.x, a.y, rf.width * 0.8, 3]);
        s.add(T.ORB, C.GHIACCIO, 0.08, 0.55, [a.x, a.y, b.x, b.y], 7);
        s.add(T.FLASH, C.GHIACCIO, 0.6, 0.35, [b.x, b.y, rg.width * 0.7, 0]);
        s.add(T.RING, C.VIOLA, 0.6, 0.4, [b.x, b.y, rg.width * 0.9, 3]);
        verifica(s);
        fantasma(card, rf, (u) => { const k = easeIO(u); return { x: lerp(rf.left, b.x - rf.width / 2, k), y: lerp(rf.top, b.y - rf.height / 2, k) - Math.sin(Math.PI * k) * 30, s: 1 - 0.7 * k, rot: -14 * k, op: u > 0.5 ? 1 - (u - 0.5) / 0.5 : 1 }; }, 40, 560);
        breve(s, 1.0);
    };

    /** Il contrario: un'anima viola esce dalla pila e la carta si compone sulla casella con un'onda (rianimazioni). */
    imp.playCardFromGraveyard = function (card, graveOwner, toOwner, toIndex) {
        const rg = rectZona(graveOwner, 'graveyard');
        const rt = rettaCarta(toOwner, 'monster', toIndex);
        if (!rg || !rt) return;
        const a = cen(rg); const b = cen({ left: rt.left, top: rt.top, width: rt.width, height: rt.height });
        const s = new Scena();
        s.add(T.FLASH, C.VIOLA, 0, 0.35, [a.x, a.y, rg.width * 0.8, 0]);
        s.add(T.ORB, C.VIOLA, 0.05, 0.55, [a.x, a.y, b.x, b.y], 8);
        s.add(T.RING, C.VIOLA, 0.55, 0.5, [b.x, b.y, rt.width * 1.1, 4]);
        s.add(T.FLASH, C.BIANCO, 0.55, 0.35, [b.x, b.y, rt.width * 0.9, 0]);
        s.add(T.BURST, C.VIOLA, 0.55, 0.7, [b.x, b.y, rt.width * 1.3, -80], 3.3);
        verifica(s);
        // La carta arriva in primo piano e NON svanisce: la vera comparira' li' sotto al render successivo.
        fantasma(card, rt, (u) => { const k = easeIO(u); return { x: lerp(a.x - rt.width / 2, b.x - rt.width / 2, k), y: lerp(a.y - rt.height / 2, b.y - rt.height / 2, k), s: 0.4 + 0.6 * k, op: u < 0.2 ? u / 0.2 : 1 }; }, 30, 600);
        breve(s, 1.2);
    };

    /**
     * Cambio di controllo (Cambio di Cuore, Controllo Mentale...): un sigillo si accende sul mostro, un filo di energia lo
     * lega alla nuova casella e la carta ci viaggia girando su se' stessa. Viola all'andata, azzurro al ritorno.
     */
    imp.playControlSwitch = function (card, fromOwner, fromIndex, toOwner, toIndex, tornaIndietro) {
        const rf = rettaCarta(fromOwner, 'monster', fromIndex);
        const rt = rettaCarta(toOwner, 'monster', toIndex);
        if (!rf || !rt || !card) return;
        const a = cen({ left: rf.left, top: rf.top, width: rf.width, height: rf.height }); const b = cen({ left: rt.left, top: rt.top, width: rt.width, height: rt.height });
        const col = tornaIndietro ? C.CIANO : C.VIOLA;
        const s = new Scena();
        s.add(T.SEAL, col, 0, 0.5, [a.x, a.y, rf.width * 0.9, 0], 0.55);
        s.add(T.LINE, col, 0.1, 0.6, [a.x, a.y, b.x, b.y], 6);
        s.add(T.ORB, col, 0.15, 0.5, [a.x, a.y, b.x, b.y], 9);
        s.add(T.RING, col, 0.6, 0.5, [b.x, b.y, rt.width * 1.2, 4]);
        s.add(T.FLASH, C.BIANCO, 0.6, 0.3, [b.x, b.y, rt.width, 0]);
        verifica(s);
        fantasma(card, rf, (u) => { const k = easeIO(u); return { x: lerp(rf.left, rt.left, k), y: lerp(rf.top, rt.top, k) - Math.sin(Math.PI * k) * 24, ry: k * 360, s: 1 + 0.08 * Math.sin(Math.PI * k) }; }, 60, 560);
        breve(s, 1.2);
    };

    /**
     * Sacrificio per Tributo: la carta si disintegra in polvere viola mentre una colonna di luce sale dal suo posto
     * (verso il mostro che sta per essere Evocato). Un ologramma dello stesso mostro si disintegra con lei.
     */
    imp.playTributeSacrifice = function (cardEl) {
        const r = cardEl ? rectDi(cardEl) : null; if (!r) return;
        const uid = cardEl.dataset && cardEl.dataset.uid;
        const GL = olograma(uid); const rh = GL ? GL.disintegra(uid, 60, 600) : null;
        const rd = rh || r; const c = cen(r); const cd = cen(rd);
        const s = new Scena();
        s.add(T.PILLAR, C.VIOLA, 0, 0.8, [c.x, c.y + r.height / 2, r.width * 0.5, 0]);
        s.add(T.FLASH, C.ORO, 0, 0.4, [c.x, c.y, r.width * 1.2, 0]);
        s.add(T.DUST, C.VIOLA, DUST_RITARDO_S, DUST_DURATA_S, [cd.x, cd.y, rd.width / 2, rd.height / 2], Math.random() * 50);
        verifica(s);
        if (rh) setTimeout(() => { cardEl.style.visibility = 'hidden'; }, 160);
        else disintegraCarta(cardEl, r);
        breve(s, DUST_RITARDO_S + DUST_DURATA_S + 0.1);
    };

    /** Equip che si aggancia: una sfera d'oro corre dalla Carta Equipaggiamento al mostro, che si accende all'arrivo. */
    imp.playEquipAttach = function (x1, y1, x2, y2, targetEl) {
        const rt = targetEl ? rectDi(targetEl) : null; const w = rt ? rt.width : 60;
        const s = new Scena();
        s.add(T.FLASH, C.ORO, 0, 0.25, [x1, y1, 50, 0]);
        s.add(T.ORB, C.ORO, 0, 0.5, [x1, y1, x2, y2], 7);
        s.add(T.RING, C.ORO, 0.42, 0.5, [x2, y2, w * 0.9, 3]);
        s.add(T.FLASH, C.CALDO, 0.42, 0.4, [x2, y2, w * 0.8, 0]);
        s.add(T.BURST, C.ORO, 0.42, 0.6, [x2, y2, 60, 30], 7);
        verifica(s);
        breve(s, 1.0);
    };

    /**
     * Mostro messo in DIFESA: la stessa barriera esagonale dell'attacco respinto si forma attorno alla carta e svanisce.
     * `lato` = 'up' se l'avversario sta sopra (il lampo d'incontro parte da quel lato).
     */
    imp.playPositionDefense = function (cardEl, lato) {
        const r = cardEl ? rectDi(cardEl) : null; if (!r) return;
        const c = cen(r);
        const lato2 = Math.max(r.width, r.height);
        const s = new Scena();
        s.add(T.SHIELD, C.CIANO, 0, 0.8, [c.x, c.y, lato2 * 0.62, 0], lato === 'down' ? Math.PI / 2 : -Math.PI / 2);
        s.add(T.RING, C.GHIACCIO, 0, 0.5, [c.x, c.y, lato2 * 0.8, 3]);
        verifica(s);
        breve(s, 0.9);
    };

    /** Mostro messo in ATTACCO: un lampo caldo, un'onda sul terreno e scintille che salgono verso l'avversario. */
    imp.playPositionAttack = function (cardEl, lato) {
        const r = cardEl ? rectDi(cardEl) : null; if (!r) return;
        const c = cen(r);
        const lato2 = Math.max(r.width, r.height);
        const su = lato !== 'down';
        const s = new Scena();
        s.add(T.FLASH, C.ARANCIO, 0, 0.45, [c.x, c.y, lato2 * 0.9, 0]);
        s.add(T.RING, C.ORO, 0, 0.5, [c.x, c.y, lato2 * 0.95, 4]);
        // Le scintille salgono (gravita' negativa) verso la meta' campo dell'avversario.
        for (let i = 0; i < 3; i++) s.add(T.BURST, C.CALDO, 0.04, 0.7, [c.x, c.y, 50 + i * 16, su ? -(120 + i * 24) : 120 + i * 24], 2 + i * 6.3);
        verifica(s);
        breve(s, 0.8);
    };

    /**
     * Distruzione in battaglia: ESPLOSIONE + DISINTEGRAZIONE. Il colpo è quello di prima — vampata grande
     * bianca e rossa, due onde d'urto, nucleo incandescente, fumo, due ondate di scintille, scossa piena —
     * e la carta trema per un istante. Poi cede: un fronte di fuoco la mangia dal basso verso l'alto e la
     * parte bruciata esplode in braci (T.DUST) che prima schizzano verso l'esterno e poi salgono sbandando a
     * destra. Le due cose si sovrappongono: la carta non sparisce "dopo" lo scoppio, si consuma dentro.
     */
    imp.playBattleDestroyEffect = function (cardElement) {
        if (!cardElement) return;
        let r = rectDi(cardElement); if (!r) return;
        // Con l'ologramma WebGL e' LUI a disintegrarsi (la carta e' solo il portale e sparisce al colpo): la polvere
        // si centra sulla figura, il fronte e' lo stesso della polvere (sale in meta' della durata).
        const GL = window.MonsterHologramGL;
        const uid = cardElement.dataset && cardElement.dataset.uid;
        const rh = uid && GL && typeof GL.disintegra === 'function' && GL.visibile(uid)
            ? GL.disintegra(uid, DUST_RITARDO_S * 1000, DUST_DURATA_S * 550) : null;
        if (rh) r = rh;
        const c = cen(r); const w = r.width;
        const s = new Scena();
        // Vampata: grande, bianca al centro e rossa ai bordi (1,5 volte la carta).
        s.add(T.FLASH, C.BIANCO, 0, 0.3, [c.x, c.y, w * 1.3, 0]);
        s.add(T.FLASH, C.CALDO, 0, 0.6, [c.x, c.y, w * 1.7, 0]);
        s.add(T.FLASH, C.ARANCIO, 0.04, 0.5, [c.x, c.y, w * 1.2, 0]);
        // Due onde d'urto sfalsate.
        s.add(T.RING, C.ORO, 0, 0.6, [c.x, c.y, 130, 6]);
        s.add(T.RING, C.ARANCIO, 0.12, 0.6, [c.x, c.y, 180, 3]);
        // Nucleo incandescente.
        s.add(T.FLASH, C.BIANCO, 0, 0.35, [c.x, c.y, w * 1.6, 0]);
        // Fumo che sale dopo il botto.
        for (let i = 0; i < 4; i++) s.add(T.SMOKE, C.SCURO, 0.06 + i * 0.04, 1.0, [c.x + (i * 17 % 40) - 20, c.y + (i * 11 % 24) - 12, 46, 0.8]);
        // La disintegrazione parte subito dopo il colpo e dura 1,1 s: il fronte attraversa la carta in 0,55 s.
        s.add(T.DUST, C.ARANCIO, DUST_RITARDO_S, DUST_DURATA_S, [c.x, c.y, r.width / 2, r.height / 2], Math.random() * 50);
        // Due ondate di scintille: la prima secca e veloce, la seconda più lenta e pesante che ricade.
        for (let i = 0; i < 4; i++) s.add(T.BURST, C.CALDO, 0, 0.6, [c.x, c.y, 150 + i * 22, 40 + i * 6], 5.1 + i * 3.7);
        for (let i = 0; i < 3; i++) s.add(T.BURST, C.ARANCIO, 0.11, 0.95, [c.x, c.y, 80 + i * 18, 180 + i * 20], 11.7 + i * 4.3);
        verifica(s);
        if (rh) setTimeout(() => { cardElement.style.visibility = 'hidden'; }, 160);
        else disintegraCarta(cardElement, r);
        const campo = document.querySelector('.game-container');
        scossa(campo, [[-6, 0.045], [5, 0.05], [-3, 0.05], [0, 0.07]]);
        breve(s, DUST_RITARDO_S + DUST_DURATA_S + 0.1);
    };

    const DUST_RITARDO_S = 0.1;
    const DUST_DURATA_S = 1.1;

    /**
     * La carta vera che si sfarina. L'originale si nasconde subito e al suo posto resta una COPIA, fuori dal
     * campo: così un ridisegno del Terreno nel mezzo non può farla sparire a metà (i nodi del campo si
     * sostituiscono). La copia sta in un contenitore NON ruotato, grande quanto l'ingombro della carta, e la
     * maschera (un gradiente verticale che scorre con la sola `mask-position`) vive lì: in Difesa la carta è
     * ruotata, ma il fronte sale comunque in verticale sullo schermo, come la luce di T.DUST.
     */
    function disintegraCarta(cardElement, r) {
        const cs = getComputedStyle(cardElement);
        const copia = /** @type {HTMLElement} */ (cardElement.cloneNode(true));
        copia.classList.remove('destroying', 'selected', 'attack-target-hover');
        const larg = cardElement.offsetWidth || r.width;
        const alt = cardElement.offsetHeight || r.height;
        Object.assign(copia.style, {
            position: 'absolute', left: '50%', top: '50%', margin: '0', width: larg + 'px', height: alt + 'px',
            transform: 'translate(-50%, -50%) ' + (cs.transform && cs.transform !== 'none' ? cs.transform : ''),
            transition: 'none', animation: 'none', pointerEvents: 'none', visibility: 'visible', opacity: '1'
        });
        const involucro = document.createElement('div');
        // Sotto la luce (Z) e sopra il campo: il bordo che brucia e i granelli si sommano alla carta.
        const grad = 'linear-gradient(to bottom, #000 0%, #000 33.3%, rgba(0,0,0,0) 40%, rgba(0,0,0,0) 100%)';
        involucro.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`
            + `z-index:${Z - 1};pointer-events:none;-webkit-mask-image:${grad};mask-image:${grad};`
            + '-webkit-mask-size:100% 300%;mask-size:100% 300%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;';
        involucro.appendChild(copia);
        document.body.appendChild(involucro);
        cardElement.style.visibility = 'hidden';
        if (involucro.animate) {
            // Il colpo: la carta trema per un istante (come prima dell'esplosione) mentre il fronte non è ancora partito.
            const tremito = []; for (let i = 0; i <= 6; i++) tremito.push({ translate: (i % 2 ? '5px' : '-5px') + ' 0px', offset: i / 6 });
            tremito[0].translate = '0px 0px'; tremito[6].translate = '0px 0px';
            involucro.animate(tremito, { duration: DUST_RITARDO_S * 1000 + 40, easing: 'linear' });
        }
        if (involucro.animate) {
            // Il fronte e' al bordo alto a meta' corsa (p = .5): quindi la corsa intera dura il doppio del fronte.
            involucro.animate([
                { webkitMaskPosition: '0% 0%', maskPosition: '0% 0%' },
                { webkitMaskPosition: '0% 100%', maskPosition: '0% 100%' }
            ], { duration: DUST_DURATA_S * 1000, delay: DUST_RITARDO_S * 1000, easing: 'linear', fill: 'both' });
        }
        // Dopo il fronte la carta e' interamente trasparente: la copia non serve piu'.
        setTimeout(() => involucro.remove(), (DUST_RITARDO_S + DUST_DURATA_S * 0.55 + 0.1) * 1000);
    }
    /** Per gli effetti brevi che NON aprono una cinematica (non fermano il bot, nessuna callback): solo il disegno. */
    function breve(sc, durS) {
        verifica(sc);
        window.FxWebgl.lancia('scena', null, durS, null, null, (t, ctx) => disegnaScena(sc, t, ctx));
    }
    window.FX.registerBackend('webgl', { requires: ['FxWebglPronto'], impls: imp });
    // Lo shader di scena e' grande: lo si compila a pagina tranquilla, non al primo effetto.
    const scaldaTutto = () => Object.keys(CORPI).forEach((tipo) => window.FxWebgl.scalda('scena-' + tipo, sorgente(Number(tipo))));
    if (window.requestIdleCallback) window.requestIdleCallback(scaldaTutto, { timeout: 5000 });
    else setTimeout(scaldaTutto, 3000);
    window.FxWebglScena = { T: T, C: C, Scena: Scena, esegui: esegui, NOMI: Object.keys(imp) };
})();
