// @ts-check
/**
 * ambiente-webgl.js — gli ambienti dei campi disegnati da shader.
 * ------------------------------------------------------------------
 * PERCHÉ ESISTE. field-ambience.js costruiva ogni effetto con decine di
 * <div> larghi quanto lo schermo, molti con `mix-blend-mode: screen`,
 * mossi da GSAP. Il costo non stava in GSAP (cambia due valori a frame)
 * ma nella COMPOSIZIONE: ogni strato con blend obbliga la GPU a rileggere
 * e rimescolare tutto ciò che sta sotto, a ogni frame. Misurato (CPU x4,
 * 844x390@2x, duello IA vs IA): 17 fps con l'ambiente, 52 senza.
 *
 * Qui ogni ambiente è UN <canvas> per piano (fondo dietro le carte,
 * primo piano sopra): rumore, particelle, raggi e miscelazione avvengono
 * DENTRO lo shader, in un solo passaggio. Aggiungere un effetto costa
 * qualche istruzione, non un altro strato da ricomporre. Si disegna a
 * risoluzione RIDOTTA (`scala`): sono effetti morbidi, e il browser li
 * ingrandisce senza che si noti.
 *
 * COME È FATTO.
 *   - MODULI: funzioni GLSL riusabili (strisce di vento, nebbia,
 *     particelle, raggi di luce, caustiche, braciere, scansione, scintille,
 *     fulmine, flash degli spalti, vortice, glitch). Ognuno restituisce un
 *     colore premoltiplicato e si somma agli altri con `over`.
 *   - CAMPI: una voce per arena. Dice la tavolozza (A/B/C), quali moduli
 *     stanno sul fondo e quali sul primo piano, con che parametri, e ogni
 *     quanto scatta l'EVENTO (una folata, un fulmine, una scansione...).
 *     Per cambiare l'aspetto di un'arena basta toccare la sua voce: nessun
 *     GLSL da scrivere a mano, a meno di un modulo nuovo.
 *   - EVENTO: tre uniformi (`ev` inviluppo 0..1, `evp` avanzamento
 *     0..1 oppure -1 a riposo, `evs` seme). Il moto di fondo è SEMPRE a
 *     velocità costante (la fase è il tempo, mai un prodotto con
 *     l'intensità: farlo muoverebbe le strisce a scatti ogni volta che la
 *     folata cambia); l'evento agisce solo su intensità e forma.
 *
 * Il modulo NON decide quando accendersi (Dettagli video, movimento
 * ridotto, arena): lo decide field-ambience.js, che lo chiama.
 * `avvia` torna false se WebGL manca: field-ambience ripiega sugli strati
 * DOM di sempre. Se il dispositivo non regge (fps bassi per qualche
 * secondo) il modulo scende di risoluzione e, in extremis, si spegne da sé.
 */
(function () {
    'use strict';

    // =================================================================
    // Moduli GLSL
    // =================================================================

    const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

    const COMUNE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 r;      // dimensione del canvas in pixel
uniform float t;     // secondi (fase del moto di fondo, sempre costante)
uniform float ev;    // inviluppo dell'evento, 0..1
uniform float evp;   // avanzamento dell'evento 0..1, -1 a riposo
uniform float evs;   // seme dell'evento corrente
// Hash senza sin(): su GPU mobili sin() di numeri grandi e' impreciso e il
// rumore diventa piatto (nessun effetto visibile).
float h(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec2 h2(vec2 p){return vec2(h(p),h(p+vec2(37.7,11.3)));}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm3(vec2 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*n(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return s;}
vec4 over(vec4 top,vec4 bot){return top+bot*(1.-top.a);}
`;

    /** @type {Record<string,string>} */
    const MOD = {};

    // Striature d'aria o di sabbia: lunghe lungo il vento, strette di traverso,
    // con lo spazio torto da due campi di rumore lenti.
    MOD.strisce = `
vec4 m_strisce(vec2 uv,float asp,float t,vec3 c,float vel,float stretch,float dens,float a,float y0,float y1,float ev){
  vec2 q=vec2(uv.x*asp,uv.y);
  vec2 w=vec2(fbm3(q*1.6+vec2(-t*.10*vel,t*.05)),fbm3(q*1.6+vec2(5.2,1.3)-t*.07));
  q+=(w-.5)*.4;
  vec2 s=vec2((q.x-t*.5*vel)*stretch,q.y*dens);
  float k=smoothstep(.5,.72,fbm3(s));
  float fascia=smoothstep(y0,y0+.25,uv.y)*smoothstep(y1,y1-.3,uv.y);
  float al=k*fascia*a*(.75+.6*ev);
  return vec4(c*al,al);
}`;

    // Nebbia / nubi / fumo: massa lenta. Con un colore SCURO oscura invece di illuminare.
    MOD.nebbia = `
vec4 m_nebbia(vec2 uv,float asp,float t,vec3 c,float vel,float sc,float a,float y0,float y1,float ev){
  vec2 q=vec2(uv.x*asp,uv.y)*sc;
  float f=fbm3(q+vec2(-t*.05*vel,t*.02)+fbm3(q*1.3+t*.03)*.8);
  f=smoothstep(.38,.85,f);
  float fascia=smoothstep(y0,y0+.3,uv.y)*smoothstep(y1,y1-.3,uv.y);
  float al=f*fascia*a*(.8+.5*ev);
  return vec4(c*al,al);
}`;

    // Particelle a celle, tre profondità: polvere, polline, neve, braci, bolle,
    // lucciole, foglie, petali. `forma`: 0 tonda, 1 rombo, 2 ovale (foglia), 3 croce.
    MOD.particelle = `
vec4 m_particelle(vec2 uv,float asp,float t,vec3 c,float vx,float vy,float dens,float dim,float lamp,float osc,float forma,float a,float ev){
  vec2 base=vec2(uv.x*asp,uv.y);
  float acc=0.;
  for(int i=0;i<3;i++){
    float fi=float(i);
    vec2 p=base*dens*(1.+fi*.65);
    p-=vec2(vx,vy)*t*(1.+fi*.4);
    p.x+=sin(t*(.6+fi*.2)+p.y*1.7+fi*2.)*osc;
    vec2 id=floor(p);
    vec2 d=fract(p)-.5-(h2(id+fi*5.1)-.5)*.5;
    float rnd=h(id+fi*17.3);
    float ex=h(id+fi*9.7+3.);
    float s;
    if(forma<.5) s=length(d);
    else if(forma<1.5) s=(abs(d.x)+abs(d.y))*.8;
    else if(forma<2.5) s=length(d*vec2(1.,2.4));
    else s=min(abs(d.x),abs(d.y))*4.+length(d)*.6;
    float rr=dim*(.45+rnd*.75);
    float tw=lamp>.5?(.5+.5*sin(t*(1.3+rnd*2.5)+rnd*40.)):1.;
    acc+=smoothstep(rr,rr*.15,s)*step(.52-.22*ev,ex)*tw*(1.-fi*.18);
  }
  float al=clamp(acc*a,0.,1.);
  return vec4(c*al*1.3,al*.85);
}`;

    // Raggi di luce (sole, luna, riflettori) da un punto sopra lo schermo.
    MOD.raggi = `
vec4 m_raggi(vec2 uv,float asp,float t,vec3 c,float ox,float ang,float cnt,float a,float ev){
  vec2 p=(uv-vec2(ox,1.25))*vec2(asp,1.);
  float th=atan(p.x,-p.y)+ang;
  float r1=sin(th*cnt+t*.12)*.5+.5;
  float r2=sin(th*cnt*1.7-t*.09+1.3)*.5+.5;
  float rays=pow(r1*r2,1.6);
  float fade=smoothstep(1.6,.0,length(p));
  float al=rays*fade*a*(.85+.25*sin(t*.35)+.3*ev);
  return vec4(c*al*1.2,al*.7);
}`;

    // Luce rifratta dall'acqua.
    MOD.caustiche = `
vec4 m_caustiche(vec2 uv,float asp,float t,vec3 c,float sc,float a,float ev){
  vec2 q=vec2(uv.x*asp,uv.y)*sc;
  float v=0.;
  for(int i=0;i<3;i++){
    q+=vec2(cos(q.y*1.1+t*.45+float(i)),sin(q.x*1.2-t*.38))*.7;
    v+=1./(1.+14.*abs(sin(q.x)*sin(q.y)));
  }
  float k=v*.33;
  float al=clamp(k*k*a*(.85+.4*ev),0.,1.);
  return vec4(c*al*1.3,al*.7);
}`;

    // Bagliore tremolante di torce e bracieri sui bordi e in basso.
    MOD.braciere = `
vec4 m_braciere(vec2 uv,float asp,float t,vec3 c,float a,float ev){
  float fl=.72+.18*sin(t*8.3)+.1*sin(t*13.7+1.)+.25*ev;
  float lato=exp(-uv.x*uv.x*26.)+exp(-(1.-uv.x)*(1.-uv.x)*26.);
  float basso=exp(-uv.y*uv.y*40.)*.7;
  float g=(lato*smoothstep(.75,.0,uv.y)+basso)*fl;
  float al=g*a*(.85+.15*n(vec2(uv.y*6.,t*1.5)));
  return vec4(c*al*1.1,al*.6);
}`;

    // Campo olografico: griglia appena accennata e, a ogni evento, una lama che
    // sale e la rivela.
    MOD.scan = `
vec4 m_scan(vec2 uv,float asp,float t,vec3 c,float a,float ev,float evp){
  vec2 g=vec2(uv.x*asp,uv.y)*9.;
  float grid=max(smoothstep(.94,1.,fract(g.x)),smoothstep(.94,1.,fract(g.y)));
  float al=grid*a*.16;
  if(evp>=0.){
    float by=evp*1.25-.12;
    float beam=exp(-pow((uv.y-by)*16.,2.));
    float trail=smoothstep(0.,.55,by-uv.y);
    al+=grid*a*(1.-trail)*step(uv.y,by)*.9+beam*a*1.2;
  }
  al=clamp(al,0.,1.);
  return vec4(c*al*1.2,al*.8);
}`;

    // Scintille che schizzano da un punto a caso a ogni evento.
    MOD.scintille = `
vec4 m_scintille(vec2 uv,float asp,float t,vec3 c,float a,float ev,float evp,float evs){
  if(evp<0.) return vec4(0.);
  vec2 p=vec2(uv.x*asp,uv.y);
  vec2 o=vec2((.15+.7*h(vec2(evs,1.7)))*asp,.1+.5*h(vec2(evs,4.2)));
  float acc=0.;
  for(int i=0;i<16;i++){
    float fi=float(i);
    float ang=h(vec2(fi,evs))*6.2832;
    float sp=.2+h(vec2(fi+9.,evs))*.5;
    vec2 pos=o+vec2(cos(ang),sin(ang))*sp*evp;
    pos.y-=.5*evp*evp;
    acc+=smoothstep(.014,.0,length(p-pos))*(1.-evp);
  }
  acc+=exp(-length(p-o)*9.)*pow(1.-evp,3.)*.6;
  float al=clamp(acc*a,0.,1.);
  return vec4(c*al*1.5,al*.9);
}`;

    // Fulmine: un solo ramo seghettato con bagliore, che sfarfalla.
    MOD.fulmine = `
vec4 m_fulmine(vec2 uv,float asp,vec3 c,float a,float ev,float evp,float evs){
  if(evp<0.) return vec4(0.);
  float x0=.15+.7*h(vec2(evs,2.3));
  float wob=(fbm3(vec2(uv.y*7.,evs*13.))-.5)*.22+(fbm3(vec2(uv.y*19.,evs*7.))-.5)*.05;
  float d=abs(uv.x-(x0+wob))*asp;
  float flick=step(.5,fract(evp*6.))*.5+.5;
  float bolt=exp(-d*d*5000.)*smoothstep(.1,.4,uv.y);
  float glow=exp(-d*d*60.)*smoothstep(.1,.5,uv.y);
  float f=ev*flick*a;
  return vec4(c*(bolt*1.6+glow*.45+.05)*f,clamp(bolt*f,0.,1.));
}`;

    // Flash di macchine fotografiche e luci dagli spalti (solo la gradinata, vedi `on`).
    MOD.flash = `
vec4 m_flash(vec2 uv,float asp,float t,vec3 c,float a,float ev){
  vec2 g=vec2(uv.x*asp,uv.y)*vec2(26.,12.);
  vec2 id=floor(g);
  vec2 f=fract(g)-.5;
  float rn=h(id+floor(t*5.)*3.1);
  // Solo sugli spalti: la gradinata alta e le due laterali, mai sull'arena al centro ne' in basso (la mano).
  float alta=step(.75,uv.y)*step(.12,uv.x)*step(uv.x,.88);
  float lati=(step(uv.x,.16)+step(.84,uv.x))*step(.12,uv.y)*step(uv.y,.88);
  float on=step(.985-.05*ev,rn)*clamp(alta+lati,0.,1.);
  float d=length(f);
  float croce=max(smoothstep(.05,0.,abs(f.x))*smoothstep(.5,0.,abs(f.y)),smoothstep(.05,0.,abs(f.y))*smoothstep(.5,0.,abs(f.x)));
  float s=(smoothstep(.2,0.,d)+croce*.8)*on*(1.-fract(t*5.));
  float al=clamp(s*a,0.,1.);
  return vec4(c*al*1.5,al*.9);
}`;

    // Spirale d'energia al centro del campo.
    MOD.vortice = `
vec4 m_vortice(vec2 uv,float asp,float t,vec3 c,float a,float ev){
  vec2 p=(uv-vec2(.5,.5))*vec2(asp,1.);
  float rr=length(p);
  float th=atan(p.y,p.x);
  float arms=pow(sin(th*3.+log(rr+.03)*-7.+t*.9)*.5+.5,3.);
  float fade=smoothstep(.0,.18,rr)*smoothstep(.85,.25,rr);
  float al=arms*fade*a*(.5+.9*ev);
  return vec4(c*al*1.2,al*.7);
}`;

    // Disturbo digitale: barre orizzontali che compaiono e si spostano.
    MOD.glitch = `
vec4 m_glitch(vec2 uv,float t,vec3 c,float a,float ev){
  float row=floor(uv.y*46.);
  float tick=floor(t*9.);
  float on=step(.965-.08*ev,h(vec2(row,tick)));
  float x0=h(vec2(row,tick+7.));
  float w=.1+.35*h(vec2(row,tick+3.));
  float al=on*step(x0,uv.x)*step(uv.x,x0+w)*a;
  return vec4(c*al,al*.9);
}`;

    // Una fiamma di torcia o di braciere in un punto preciso del campo: lingua
    // che ondeggia, nucleo caldo e alone che illumina attorno, con un tremolio
    // proprio (il seme sfasa ogni fiamma dalle altre). `f` e' la posizione
    // nell'IMMAGINE del campo (0..1, y verso l'alto); `ia` il suo rapporto
    // d'aspetto: lo sfondo e' dipinto con `cover`, quindi su uno schermo piu'
    // largo o piu' alto la stessa fiamma cade in un punto diverso dello
    // schermo, e va ricalcolata (stessa regola dello sfondo, ritagli compresi).
    MOD.fiamme = `
vec4 m_fiamma(vec2 uv,float asp,float t,vec3 c1,vec3 c2,vec2 f,float s,float seed,float ia,float a){
  vec2 sp=asp>ia?vec2(f.x,.5+(f.y-.5)*(asp/ia)):vec2(.5+(f.x-.5)*(ia/asp),f.y);
  vec2 d=(uv-sp)*vec2(asp,1.);
  float fl=.72+.2*sin(t*(6.+seed*4.)+seed*40.)+.12*sin(t*(11.+seed*3.)+seed*13.)+.1*n(vec2(t*3.,seed*9.));
  float r2=dot(d,d);
  float core=exp(-r2*(1100./(s*s)));
  float halo=exp(-r2*(75./(s*s)));
  float dy=d.y;
  float w=.012*s*(1.-clamp(dy/(.07*s),0.,1.))+.002;
  float wob=sin(t*(9.+seed*5.)+dy*60.)*.004*s;
  float lingua=exp(-pow((d.x-wob)/w,2.))*smoothstep(-.01*s,.012*s,dy)*smoothstep(.075*s,.0,dy);
  vec3 col=c1*(lingua*1.6+core*1.4)+c2*halo*.9;
  float al=clamp(lingua*.7+core*.5+halo*.22,0.,1.);
  return vec4(col*fl*a,al*fl*a);
}`;

    // Fronte di guerra, fondo: cannoneggiamento continuo. Niente evento a
    // scadenza: tre "canali" con cicli di durata diversa (4.3 / 6 / 7.7 s)
    // sorteggiano ognuno un punto d'impatto nuovo a ogni ciclo, quindi le
    // esplosioni si sovrappongono e non cadono mai a ritmo regolare. Ogni
    // impatto e' un lampo secco, una palla di fuoco, un anello d'urto e una
    // nube di fumo che sale e si dissolve. Usa A = fuoco, B = fumo.
    MOD.impatti = `
vec4 impatto(vec2 p,vec2 o,float ph,float seme,vec3 fuoco,vec3 fumo){
  float d=length(p-o);
  float flash=exp(-d*d*220.)*smoothstep(.07,.0,ph)*1.6;
  float R=.03+ph*.22;
  float palla=smoothstep(R,R*.35,d)*(1.-smoothstep(.0,.3,ph))*smoothstep(.0,.015,ph);
  float onda=exp(-pow((d-ph*.9)*28.,2.))*(1.-smoothstep(.0,.25,ph))*smoothstep(.0,.01,ph);
  vec2 q=p-o-vec2(0.,ph*.12);
  float Rf=.05+ph*.16;
  float fu=smoothstep(Rf,Rf*.2,length(q*vec2(1.,1.2))+(fbm3(q*9.+seme)-.5)*.05)
    *smoothstep(.0,.08,ph)*(1.-smoothstep(.35,1.,ph));
  float aF=clamp(flash*.7+palla*.8+onda*.4,0.,1.);
  vec4 luce=vec4(fuoco*(flash+palla*1.2+onda*.5),aF*.6);
  vec4 nube=vec4(fumo*fu*.6,fu*.6);
  return over(luce,nube);
}
vec4 m_impatti(vec2 uv,float asp,float t,vec3 fuoco,vec3 fumo,float a){
  vec2 p=vec2(uv.x*asp,uv.y);
  vec4 acc=vec4(0.);
  for(int i=0;i<3;i++){
    float fi=float(i);
    float cyc=t/(4.3+fi*1.7)+fi*.37;
    float id=floor(cyc);
    float ph=fract(cyc)/.6;
    if(ph<1.){
      vec2 o=vec2((.2+.6*h(vec2(id,fi+1.)))*asp,.25+.5*h(vec2(id,fi+7.)));
      acc=over(impatto(p,o,ph,id*3.1+fi,fuoco,fumo),acc);
    }
  }
  // Artiglieria lontana: un lampo sul bordo alto o basso, fuori campo.
  float cl=t/3.1;
  float pl=fract(cl);
  float xl=(.1+.8*h(vec2(floor(cl),21.)))*asp;
  float lont=exp(-pow((p.x-xl)*1.6,2.))*(exp(-uv.y*6.)+exp(-(1.-uv.y)*6.))*smoothstep(.06,.0,pl)*.6;
  acc=over(vec4(fuoco*lont,lont*.4),acc);
  return acc*a;
}`;

    // Fronte di guerra, primo piano: proiettili traccianti verticali, in
    // entrambi i versi. Sei canali con periodi diversi, non ogni ciclo
    // spara (step su un hash): grappoli e pause arrivano da soli.
    MOD.traccianti = `
vec4 m_traccianti(vec2 uv,float asp,float t,vec3 c,float a){
  vec2 p=vec2(uv.x*asp,uv.y);
  float acc=0.;
  for(int i=0;i<6;i++){
    float fi=float(i);
    float cyc=t/(1.3+fi*.37)+fi*.53;
    float id=floor(cyc);
    float u=fract(cyc)/.28;
    float on=step(.45,h(vec2(id,fi+3.)))*step(u,1.);
    float x=(.2+.6*h(vec2(id,fi+11.)))*asp;
    float dir=h(vec2(id,fi+5.))<.5?-1.:1.;
    float y0=dir>0.?.15:.85;
    float head=y0+dir*clamp(u,0.,1.)*.55;
    float along=(p.y-head)*-dir;
    float seg=step(0.,along)*smoothstep(.07,0.,along);
    float line=smoothstep(.0035,.0,abs(p.x-x))*seg;
    float glow=smoothstep(.012,.0,abs(p.x-x))*seg*.35;
    acc+=(line+glow)*on*(.7+.3*sin(t*60.+fi));
  }
  float al=clamp(acc*a,0.,1.);
  return vec4(c*al*1.4,al*.9);
}`;

    // Come si scrive la chiamata di ogni modulo (c = 'A' | 'B' | 'C').
    const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
    /** @type {Record<string, { def: Record<string, any>, call: (c: string, o: any) => string }>} */
    const CALL = {
        strisce: { def: { vel: 1, stretch: 1.6, dens: 9, a: .22, y0: -.2, y1: 1.2 },
            call: (c, o) => `m_strisce(uv,asp,t,${c},${f(o.vel)},${f(o.stretch)},${f(o.dens)},${f(o.a)},${f(o.y0)},${f(o.y1)},ev)` },
        nebbia: { def: { vel: 1, sc: 1.5, a: .2, y0: -.4, y1: 1.4 },
            call: (c, o) => `m_nebbia(uv,asp,t,${c},${f(o.vel)},${f(o.sc)},${f(o.a)},${f(o.y0)},${f(o.y1)},ev)` },
        particelle: { def: { vx: 0, vy: 0, dens: 10, dim: .12, lamp: 0, osc: .15, forma: 0, a: 1 },
            call: (c, o) => `m_particelle(uv,asp,t,${c},${f(o.vx)},${f(o.vy)},${f(o.dens)},${f(o.dim)},${f(o.lamp)},${f(o.osc)},${f(o.forma)},${f(o.a)},ev)` },
        raggi: { def: { ox: .5, ang: 0, cnt: 7, a: .3 },
            call: (c, o) => `m_raggi(uv,asp,t,${c},${f(o.ox)},${f(o.ang)},${f(o.cnt)},${f(o.a)},ev)` },
        caustiche: { def: { sc: 5, a: .5 },
            call: (c, o) => `m_caustiche(uv,asp,t,${c},${f(o.sc)},${f(o.a)},ev)` },
        braciere: { def: { a: .55 },
            call: (c, o) => `m_braciere(uv,asp,t,${c},${f(o.a)},ev)` },
        scan: { def: { a: .5 },
            call: (c, o) => `m_scan(uv,asp,t,${c},${f(o.a)},ev,evp)` },
        scintille: { def: { a: 1 },
            call: (c, o) => `m_scintille(uv,asp,t,${c},${f(o.a)},ev,evp,evs)` },
        fulmine: { def: { a: 1 },
            call: (c, o) => `m_fulmine(uv,asp,${c},${f(o.a)},ev,evp,evs)` },
        flash: { def: { a: 1 },
            call: (c, o) => `m_flash(uv,asp,t,${c},${f(o.a)},ev)` },
        vortice: { def: { a: .35 },
            call: (c, o) => `m_vortice(uv,asp,t,${c},${f(o.a)},ev)` },
        // Una fiamma per ogni punto di `pts` ([x, y, grandezza], posizioni nell'immagine
        // del campo, y verso l'alto). Colori: `c1` nucleo, `c2` alone; se mancano valgono
        // A e B della tavolozza. `sz` scala tutte le fiamme insieme, `ia` e' il rapporto
        // d'aspetto dell'immagine del campo.
        fiamme: { def: { pts: [], sz: 1, ia: 1.772, a: 1 },
            call: (c, o) => o.pts.reduce((e, p, i) =>
                `over(m_fiamma(uv,asp,t,${o.c1 ? cost(o.c1) : 'A'},${o.c2 ? cost(o.c2) : 'B'},vec2(${f(p[0])},${f(p[1])}),${f(p[2] * o.sz)},${f(i + 1)},${f(o.ia)},${f(o.a)}),${e})`, 'vec4(0.)') },
        // impatti usa la tavolozza intera: A = fuoco, B = fumo (il colore del modulo e' ignorato).
        impatti: { def: { a: 1 },
            call: (c, o) => `m_impatti(uv,asp,t,A,B,${f(o.a)})` },
        traccianti: { def: { a: 1 },
            call: (c, o) => `m_traccianti(uv,asp,t,${c},${f(o.a)})` },
        glitch: { def: { a: .5 },
            call: (c, o) => `m_glitch(uv,t,${c},${f(o.a)},ev)` }
    };

    // =================================================================
    // Catalogo dei campi
    // =================================================================

    const rgb = (r, g, b) => [r / 255, g / 255, b / 255];

    // Tavolozze riusate da più arene (A = luce principale, B = secondaria, C = accento).
    const PAL = {
        sabbiaGiorno: [rgb(255, 244, 214), rgb(255, 208, 130), rgb(255, 232, 170)],
        sabbiaNotte: [rgb(196, 214, 255), rgb(120, 150, 230), rgb(236, 242, 255)],
        vento: [rgb(232, 244, 255), rgb(255, 255, 255), rgb(190, 222, 255)],
        natura: [rgb(214, 255, 150), rgb(255, 238, 170), rgb(120, 205, 120)],
        spiriti: [rgb(190, 150, 255), rgb(70, 30, 120), rgb(120, 255, 230)],
        oro: [rgb(255, 214, 120), rgb(255, 170, 60), rgb(255, 240, 190)],
        fuoco: [rgb(255, 150, 60), rgb(255, 80, 20), rgb(255, 224, 140)],
        acqua: [rgb(170, 245, 255), rgb(70, 190, 240), rgb(230, 255, 255)],
        ghiaccio: [rgb(240, 250, 255), rgb(150, 210, 255), rgb(255, 255, 255)],
        tech: [rgb(120, 225, 255), rgb(60, 140, 255), rgb(220, 250, 255)],
        rosso: [rgb(255, 90, 110), rgb(150, 20, 60), rgb(255, 200, 210)]
    };

    // Posizioni delle torce e dei bracieri nelle illustrazioni dei campi, trovate
    // sulle immagini stesse (macchie calde luminose, raggruppate) e controllate
    // a occhio. Coordinate 0..1 nell'immagine, y verso l'alto, [x, y, grandezza].
    // Se si cambia un'illustrazione vanno rifatte.
    const TORCE = {
        tempioOscuro: [[0.794,0.693,0.8],[0.101,0.432,0.8],[0.899,0.432,0.8],[0.211,0.693,0.8],[0.923,0.18,0.8],[0.672,0.821,0.8],[0.266,0.634,0.8],[0.738,0.633,0.8],[0.26,0.392,0.8],[0.268,0.163,0.8],[0.737,0.16,0.8]],
        piazzaNotte: [[0.734,0.355,1.6],[0.301,0.336,1.6],[0.731,0.542,1.6],[0.718,0.761,1.56],[0.267,0.363,1.52],[0.276,0.764,1.51],[0.269,0.543,1.47],[0.55,0.114,1.33],[0.557,0.297,1.31],[0.684,0.707,1.3],[0.438,0.298,1.3],[0.309,0.706,1.28],[0.443,0.117,1.17],[0.205,0.2,1.02],[0.01,0.16,0.98],[0.777,0.295,0.96]],
        arenaNotte: [[0.257,0.302,1.1],[0.779,0.229,1.1],[0.74,0.301,1.04],[0.218,0.225,1.04],[0.249,0.817,1.02],[0.803,0.317,1],[0.75,0.816,0.96],[0.471,0.225,0.94],[0.409,0.076,0.94],[0.258,0.251,0.92],[0.587,0.076,0.89],[0.197,0.318,0.85],[0.428,0.25,0.85],[0.738,0.252,0.85]],
        rovineNotte: [[0.223,0.268,1.08],[0.778,0.265,1.02],[0.76,0.868,0.98],[0.072,0.552,0.96],[0.029,0.286,0.89],[0.24,0.869,0.87],[0.174,0.804,0.69],[0.887,0.231,0.66],[0.43,0.151,0.66],[0.188,0.32,0.6],[0.202,0.452,0.6],[0.267,0.167,0.6],[0.573,0.155,0.6],[0.366,0.934,0.6],[0.804,0.428,0.6],[0.928,0.061,0.6]],
        tempio: [[0.102,0.399,1.6],[0.896,0.403,1.6],[0.433,0.233,1.52],[0.791,0.712,1.5],[0.178,0.247,1.4],[0.567,0.238,1.39],[0.435,0.924,1.31],[0.712,0.376,1.28],[0.82,0.243,1.28],[0.201,0.73,1.22],[0.566,0.928,1.17],[0.606,0.784,1.17],[0.562,0.12,1.15],[0.222,0.649,1.13],[0.391,0.786,1.11],[0.776,0.652,1.11]],
        // I quattro bracieri agli angoli dei campi all'aperto (foresta, prato, montagna, acqua, ghiaccio).
        angoli: [[0.22,0.26,1],[0.78,0.26,1],[0.24,0.87,1],[0.76,0.88,1]]
    };
    const FIAMMA_CALDA = { c1: [1, .86, .5], c2: [1, .42, .08] };

    /**
     * @typedef {[string, string, Record<string, any>?]} Mod  // [modulo, colore A|B|C, parametri]
     * @typedef {{ pal: number[][], fondo?: Mod[], primo?: Mod[], ev?: { ogni: number[], dur: number } }} Campo
     */

    /** @type {Record<string, Campo>} */
    const CAMPI = {
        // ---- Antico Egitto: sabbia ------------------------------------------------
        'egitto-geroglifici-solari': {
            pal: PAL.sabbiaGiorno,
            fondo: [['raggi', 'B', { ox: .72, cnt: 6, a: .26 }], ['strisce', 'A', { vel: .9, a: .2, dens: 8, y0: -.3, y1: .8 }]],
            primo: [['particelle', 'A', { vx: 1.1, vy: -.05, dens: 16, dim: .06, osc: .08, a: .8 }]],
            ev: { ogni: [5, 10], dur: 5 }
        },
        'valle-dei-re': {
            pal: PAL.sabbiaGiorno,
            fondo: [['raggi', 'B', { ox: .25, cnt: 5, a: .3 }], ['strisce', 'A', { vel: 1.3, a: .3, dens: 11, y0: -.3, y1: .9 }]],
            primo: [['particelle', 'A', { vx: 1.6, vy: -.08, dens: 18, dim: .07, osc: .1, a: .95 }], ['strisce', 'C', { vel: 1.8, stretch: 2.4, dens: 14, a: .22, y0: 0, y1: 1 }]],
            ev: { ogni: [4, 8], dur: 5 }
        },
        'egitto-luna-blu': {
            pal: PAL.sabbiaNotte,
            fondo: [['raggi', 'C', { ox: .35, cnt: 5, a: .22 }], ['strisce', 'A', { vel: .8, a: .2, dens: 9, y0: -.3, y1: .7 }]],
            primo: [['particelle', 'C', { vx: .9, vy: -.04, dens: 15, dim: .06, osc: .08, lamp: 1, a: .8 }]],
            ev: { ogni: [6, 12], dur: 5 }
        },
        'nilo-notturno': {
            pal: PAL.sabbiaNotte,
            fondo: [['nebbia', 'A', { sc: 1.4, a: .24, y0: -.5, y1: .5 }], ['caustiche', 'C', { sc: 6, a: .28 }], ['raggi', 'C', { ox: .6, cnt: 4, a: .18 }]],
            primo: [['particelle', 'C', { vx: .05, vy: .08, dens: 11, dim: .09, lamp: 1, osc: .2, a: .9 }]],
            ev: { ogni: [7, 13], dur: 5 }
        },
        'tempio-crepe-arcane': {
            pal: PAL.oro,
            fondo: [['vortice', 'A', { a: .22 }], ['nebbia', 'B', { sc: 1.6, a: .12, y0: -.4, y1: .6 }]],
            primo: [['particelle', 'C', { vx: 0, vy: .22, dens: 12, dim: .08, lamp: 1, osc: .1, forma: 1, a: .95 }], ['fulmine', 'C', { a: 1 }]],
            ev: { ogni: [4, 9], dur: 1.4 }
        },
        'palazzo-raggi-lunari': {
            pal: PAL.sabbiaNotte,
            fondo: [['raggi', 'C', { ox: .5, cnt: 8, a: .42 }], ['nebbia', 'A', { sc: 1.8, a: .14, y0: -.4, y1: .6 }]],
            primo: [['particelle', 'C', { vx: .02, vy: -.03, dens: 12, dim: .07, lamp: 1, osc: .25, a: .85 }]],
            ev: { ogni: [6, 12], dur: 5 }
        },
        // ---- Regno dei Duellanti / Pegasus -------------------------------------------
        'rovine-edera': {
            pal: PAL.natura,
            fondo: [['raggi', 'B', { ox: .3, cnt: 6, a: .3 }], ['nebbia', 'C', { sc: 1.5, a: .1, y0: -.4, y1: .5 }]],
            primo: [['particelle', 'A', { vx: .35, vy: -.18, dens: 9, dim: .13, osc: .45, forma: 2, a: .9 }], ['particelle', 'B', { vx: .05, vy: .04, dens: 14, dim: .05, lamp: 1, a: .8 }]],
            ev: { ogni: [6, 12], dur: 5 }
        },
        'rovine-spiriti': {
            pal: PAL.spiriti,
            fondo: [['nebbia', 'B', { sc: 1.3, a: .42, y0: -.5, y1: .8 }], ['nebbia', 'A', { sc: 2.4, vel: -.7, a: .1, y0: -.3, y1: .9 }]],
            primo: [['particelle', 'C', { vx: .02, vy: .16, dens: 8, dim: .1, lamp: 1, osc: .3, forma: 1, a: .95 }]],
            ev: { ogni: [6, 11], dur: 5 }
        },
        'arena-bosco': {
            pal: PAL.natura,
            fondo: [['raggi', 'B', { ox: .68, cnt: 7, a: .36 }]],
            primo: [['particelle', 'A', { vx: .3, vy: -.15, dens: 8, dim: .14, osc: .5, forma: 2, a: .9 }], ['particelle', 'B', { vx: .04, vy: .05, dens: 15, dim: .05, lamp: 1, a: .8 }]],
            ev: { ogni: [6, 12], dur: 5 }
        },
        'castello-candele': {
            pal: [rgb(210, 140, 255), rgb(130, 50, 220), rgb(255, 210, 160)],
            fondo: [['braciere', 'A', { a: .5 }], ['nebbia', 'B', { sc: 1.5, a: .18, y0: -.5, y1: .6 }]],
            primo: [['particelle', 'C', { vx: .05, vy: .3, dens: 11, dim: .07, lamp: 1, osc: .15, a: .95 }]],
            ev: { ogni: [5, 10], dur: 3 }
        },
        'torre-vento-verde': {
            pal: [rgb(220, 255, 220), rgb(180, 240, 190), rgb(255, 205, 225)],
            fondo: [['nebbia', 'A', { sc: 1.1, a: .2, y0: -.3, y1: 1.3 }], ['strisce', 'B', { vel: 1.2, a: .2, dens: 9, y0: -.2, y1: 1.1 }]],
            primo: [['particelle', 'C', { vx: 1.1, vy: -.12, dens: 9, dim: .12, osc: .4, forma: 2, a: .95 }]],
            ev: { ogni: [4, 8], dur: 5 }
        },
        // ---- Kaiba -------------------------------------------------------------------
        'stadio-flash-spalti': {
            pal: [rgb(235, 249, 255), rgb(97, 190, 255), rgb(255, 255, 255)],
            fondo: [['raggi', 'B', { ox: .2, cnt: 4, a: .24 }], ['raggi', 'A', { ox: .8, cnt: 4, ang: .6, a: .2 }]],
            primo: [['flash', 'C', { a: 1 }]],
            ev: { ogni: [3, 7], dur: 3 }
        },
        'dirigibile-alta-quota': {
            pal: PAL.vento,
            fondo: [['nebbia', 'A', { sc: 1.5, a: .17, y0: -.3, y1: 1.3 }], ['strisce', 'A', { vel: 1, a: .18, dens: 7, stretch: 1.1, y0: -.1, y1: 1 }]],
            primo: [['strisce', 'B', { vel: 1.5, a: .32, dens: 13, stretch: 2.4, y0: 0, y1: 1 }], ['particelle', 'C', { vx: 2.2, vy: -.05, dens: 20, dim: .05, a: .7 }]],
            ev: { ogni: [3, 7], dur: 5 }
        },
        'torre-cielo': {
            pal: [rgb(255, 244, 206), rgb(255, 214, 130), rgb(255, 255, 240)],
            fondo: [['raggi', 'A', { ox: .5, cnt: 8, a: .36 }], ['nebbia', 'C', { sc: 1.2, a: .2, y0: -.3, y1: .6 }]],
            primo: [['strisce', 'B', { vel: 1.2, a: .22, dens: 10, stretch: 1.8, y0: 0, y1: 1 }]],
            ev: { ogni: [4, 9], dur: 5 }
        },
        'torre-colosseo': {
            pal: PAL.tech,
            fondo: [['scan', 'A', { a: .5 }], ['raggi', 'B', { ox: .5, cnt: 6, a: .16 }]],
            primo: [['particelle', 'C', { vx: 0, vy: .2, dens: 14, dim: .05, lamp: 1, forma: 1, a: .9 }]],
            ev: { ogni: [5, 10], dur: 2.6 }
        },
        'torre-shadow': {
            pal: PAL.spiriti,
            fondo: [['vortice', 'A', { a: .3 }], ['nebbia', 'B', { sc: 1.6, a: .45, y0: -.5, y1: .8 }]],
            primo: [['particelle', 'C', { vx: 0, vy: -.16, dens: 10, dim: .09, lamp: 1, forma: 1, a: .9 }]],
            ev: { ogni: [5, 9], dur: 4 }
        },
        'gozaburo-glitch': {
            pal: PAL.rosso,
            fondo: [['scan', 'A', { a: .45 }], ['vortice', 'A', { a: .16 }]],
            primo: [['glitch', 'C', { a: .45 }], ['particelle', 'A', { vx: 0, vy: -.25, dens: 14, dim: .05, forma: 3, a: .8 }]],
            ev: { ogni: [3, 7], dur: 1.6 }
        },
        'industria-scariche': {
            pal: [rgb(173, 231, 255), rgb(255, 120, 70), rgb(255, 255, 220)],
            fondo: [['scan', 'A', { a: .4 }], ['nebbia', 'B', { sc: 1.5, a: .12, y0: -.5, y1: .5 }]],
            primo: [['scintille', 'C', { a: 1 }], ['particelle', 'B', { vx: .1, vy: .25, dens: 12, dim: .05, lamp: 1, a: .8 }]],
            ev: { ogni: [2.5, 6], dur: 1.6 }
        },
        // ---- Città e natura ------------------------------------------------------------
        'citta-brezza': {
            pal: [rgb(255, 238, 186), rgb(120, 190, 150), rgb(255, 255, 230)],
            fondo: [['raggi', 'A', { ox: .6, cnt: 6, a: .22 }]],
            primo: [['particelle', 'B', { vx: .8, vy: -.2, dens: 9, dim: .12, osc: .45, forma: 2, a: .85 }], ['strisce', 'C', { vel: 1, a: .1, dens: 10, y0: 0, y1: .7 }]],
            ev: { ogni: [5, 10], dur: 4 }
        },
        'prateria-pollini': {
            pal: PAL.natura,
            fondo: [['fiamme', 'A', { pts: TORCE.angoli, c1: FIAMMA_CALDA.c1, c2: FIAMMA_CALDA.c2, sz: .8, a: .9 }], ['raggi', 'B', { ox: .55, cnt: 7, a: .3 }]],
            primo: [['particelle', 'B', { vx: .25, vy: .06, dens: 13, dim: .06, lamp: 1, osc: .4, a: .9 }], ['particelle', 'A', { vx: .5, vy: -.08, dens: 7, dim: .12, osc: .5, forma: 2, a: .7 }]],
            ev: { ogni: [5, 10], dur: 5 }
        },
        'ghiaccio-nevicata': {
            pal: PAL.ghiaccio,
            fondo: [['fiamme', 'A', { pts: TORCE.angoli, c1: FIAMMA_CALDA.c1, c2: FIAMMA_CALDA.c2, sz: .8, a: .9 }], ['nebbia', 'B', { sc: 1.4, a: .2, y0: -.4, y1: .6 }], ['strisce', 'A', { vel: 1.4, a: .16, dens: 12, y0: -.2, y1: 1 }]],
            primo: [['particelle', 'A', { vx: .35, vy: -.35, dens: 13, dim: .08, osc: .35, a: .95 }], ['particelle', 'C', { vx: 0, vy: 0, dens: 16, dim: .04, lamp: 1, forma: 3, a: .8 }]],
            ev: { ogni: [5, 10], dur: 5 }
        },
        'acqua-caustiche': {
            pal: PAL.acqua,
            fondo: [['fiamme', 'A', { pts: TORCE.angoli, c1: FIAMMA_CALDA.c1, c2: FIAMMA_CALDA.c2, sz: .8, a: .9 }], ['caustiche', 'A', { sc: 5.5, a: .6 }], ['raggi', 'C', { ox: .5, cnt: 6, a: .26 }]],
            primo: [['particelle', 'C', { vx: .03, vy: .28, dens: 11, dim: .09, osc: .3, a: .65 }]],
            ev: { ogni: [6, 12], dur: 5 }
        },
        'foresta-lucciole': {
            pal: [rgb(255, 245, 150), rgb(150, 240, 130), rgb(190, 255, 190)],
            fondo: [['fiamme', 'A', { pts: TORCE.angoli, c1: FIAMMA_CALDA.c1, c2: FIAMMA_CALDA.c2, sz: .8, a: .9 }], ['raggi', 'C', { ox: .3, cnt: 5, a: .24 }], ['nebbia', 'B', { sc: 1.6, a: .14, y0: -.5, y1: .5 }]],
            primo: [['particelle', 'A', { vx: .03, vy: .04, dens: 9, dim: .1, lamp: 1, osc: .5, a: 1 }]],
            ev: { ogni: [5, 10], dur: 5 }
        },
        'montagna-nuvole': {
            pal: PAL.vento,
            fondo: [['fiamme', 'A', { pts: TORCE.angoli, c1: FIAMMA_CALDA.c1, c2: FIAMMA_CALDA.c2, sz: .8, a: .9 }], ['nebbia', 'A', { sc: 1.1, a: .3, y0: -.5, y1: .7 }], ['strisce', 'B', { vel: 1.1, a: .16, dens: 8, y0: -.2, y1: 1 }]],
            primo: [['nebbia', 'B', { sc: 2, vel: 1.6, a: .12, y0: -.5, y1: .4 }], ['particelle', 'C', { vx: 1.4, vy: -.1, dens: 14, dim: .05, a: .7 }]],
            ev: { ogni: [4, 8], dur: 5 }
        },
        // ---- Rovine, piazze, arene egizie ----------------------------------------------
        'rovine-deserto': {
            pal: PAL.sabbiaGiorno,
            fondo: [['raggi', 'B', { ox: .6, cnt: 5, a: .24 }], ['strisce', 'A', { vel: 1, a: .22, y0: -.3, y1: .8 }]],
            primo: [['particelle', 'A', { vx: 1.3, vy: -.05, dens: 16, dim: .06, a: .85 }]],
            ev: { ogni: [5, 10], dur: 5 }
        },
        'rovine-egizie-sole': {
            pal: [rgb(255, 238, 190), rgb(255, 190, 90), rgb(255, 220, 150)],
            fondo: [['raggi', 'B', { ox: .35, cnt: 6, a: .34 }], ['nebbia', 'C', { sc: 1.3, a: .12, y0: -.5, y1: .5 }]],
            primo: [['particelle', 'A', { vx: .8, vy: .06, dens: 14, dim: .06, lamp: 1, a: .8 }]],
            ev: { ogni: [5, 10], dur: 5 }
        },
        'rovine-egizie-luna': {
            pal: [rgb(255, 170, 90), rgb(255, 90, 30), rgb(190, 215, 255)],
            fondo: [['fiamme', 'A', { pts: TORCE.rovineNotte, sz: .75, a: .9 }], ['raggi', 'C', { ox: .7, cnt: 5, a: .18 }]],
            primo: [['particelle', 'A', { vx: .08, vy: .32, dens: 11, dim: .06, lamp: 1, osc: .2, a: .95 }]],
            ev: { ogni: [5, 10], dur: 3 }
        },
        'arena-egizia-fontane': {
            pal: PAL.acqua,
            fondo: [['caustiche', 'A', { sc: 5, a: .5 }], ['raggi', 'C', { ox: .5, cnt: 6, a: .3 }]],
            primo: [['particelle', 'C', { vx: .02, vy: .3, dens: 10, dim: .08, osc: .25, a: .6 }]],
            ev: { ogni: [6, 11], dur: 4 }
        },
        'arena-egizia-torce': {
            pal: [rgb(255, 214, 140), rgb(255, 120, 40), rgb(255, 235, 190)],
            fondo: [['fiamme', 'A', { pts: TORCE.arenaNotte, sz: .7, a: .9 }], ['nebbia', 'B', { sc: 1.5, a: .12, y0: -.5, y1: .5 }]],
            primo: [['particelle', 'C', { vx: .05, vy: .3, dens: 11, dim: .06, lamp: 1, a: .95 }]],
            ev: { ogni: [5, 10], dur: 3 }
        },
        'arena-zorc': {
            pal: [rgb(255, 80, 60), rgb(150, 20, 30), rgb(255, 200, 120)],
            fondo: [['vortice', 'A', { a: .3 }], ['nebbia', 'B', { sc: 1.4, a: .36, y0: -.5, y1: .7 }], ['braciere', 'A', { a: .4 }]],
            primo: [['particelle', 'C', { vx: .05, vy: .38, dens: 11, dim: .07, lamp: 1, a: .95 }], ['fulmine', 'C', { a: 1 }]],
            ev: { ogni: [3, 7], dur: 1.4 }
        },
        'piazza-calore': {
            pal: PAL.sabbiaGiorno,
            fondo: [['raggi', 'B', { ox: .5, cnt: 7, a: .3 }], ['strisce', 'A', { vel: .8, a: .16, y0: -.3, y1: .6 }]],
            primo: [['particelle', 'A', { vx: .7, vy: .05, dens: 14, dim: .06, a: .75 }]],
            ev: { ogni: [6, 12], dur: 5 }
        },
        'piazza-torce': {
            pal: PAL.fuoco,
            fondo: [['fiamme', 'A', { pts: TORCE.piazzaNotte, sz: .55, a: .8 }], ['raggi', 'C', { ox: .5, cnt: 5, a: .1 }]],
            primo: [['particelle', 'A', { vx: .06, vy: .34, dens: 11, dim: .06, lamp: 1, osc: .2, a: .95 }]],
            ev: { ogni: [5, 10], dur: 3 }
        },
        'tempio-fiamme': {
            pal: PAL.oro,
            fondo: [['raggi', 'A', { ox: .5, cnt: 7, a: .26 }], ['fiamme', 'A', { pts: TORCE.tempio, sz: .6, a: .8 }]],
            primo: [['particelle', 'C', { vx: .02, vy: .12, dens: 13, dim: .06, lamp: 1, osc: .2, forma: 1, a: .9 }]],
            ev: { ogni: [5, 10], dur: 4 }
        },
        // ---- Grande Guerra: fronte di battaglia -----------------------------------------
        // Cannoneggiamento continuo senza evento a scadenza (vedi MOD.impatti):
        // A = fuoco, B = fumo, C = traccianti.
        'guerra-fronte-diurno': {
            pal: [rgb(255, 196, 96), rgb(105, 92, 76), rgb(255, 232, 150)],
            fondo: [['nebbia', 'B', { sc: 1.2, vel: .6, a: .3, y0: -.4, y1: .7 }], ['impatti', 'A', { a: 1 }]],
            primo: [['traccianti', 'C', { a: 1 }], ['particelle', 'B', { vx: .1, vy: -.1, dens: 12, dim: .05, osc: .3, a: .6 }]]
        },
        'guerra-fronte-notturno': {
            pal: [rgb(255, 160, 60), rgb(34, 36, 46), rgb(255, 177, 59)],
            fondo: [['nebbia', 'B', { sc: 1.3, vel: .5, a: .45, y0: -.4, y1: .8 }], ['impatti', 'A', { a: 1.1 }]],
            primo: [['traccianti', 'C', { a: 1.1 }], ['particelle', 'A', { vx: .06, vy: .2, dens: 12, dim: .05, lamp: 1, a: .8 }]]
        },
        'tempio-bracieri-horus': {
            pal: [rgb(255, 151, 48), rgb(255, 84, 20), rgb(255, 230, 150)],
            fondo: [['fiamme', 'A', { pts: TORCE.tempioOscuro, sz: 1.15, a: 1 }], ['nebbia', 'B', { sc: 1.4, a: .16, y0: -.5, y1: .55 }]],
            primo: [['particelle', 'C', { vx: .08, vy: .36, dens: 10, dim: .07, lamp: 1, osc: .2, a: 1 }]],
            ev: { ogni: [4, 8], dur: 2.5 }
        }
    };

    // =================================================================
    // Composizione degli shader
    // =================================================================

    const cost = (v) => `vec3(${f(v[0])},${f(v[1])},${f(v[2])})`;

    /** Sorgente del fragment shader di un piano, o null se il piano è vuoto. */
    function componi(campo, piano) {
        const lista = campo[piano];
        if (!lista || !lista.length) return null;
        const usati = {};
        const righe = lista.map((m) => {
            const def = CALL[m[0]];
            usati[m[0]] = true;
            const o = Object.assign({}, def.def, m[2] || {});
            return `  acc=over(${def.call(m[1], o)},acc);`;
        });
        const pal = campo.pal;
        return COMUNE
            + Object.keys(usati).map((k) => MOD[k]).join('\n')
            + `\nconst vec3 A=${cost(pal[0])};const vec3 B=${cost(pal[1])};const vec3 C=${cost(pal[2])};\n`
            + 'void main(){\n  vec2 uv=gl_FragCoord.xy/r;\n  float asp=r.x/r.y;\n  vec4 acc=vec4(0.);\n'
            + righe.join('\n') + '\n  gl_FragColor=acc;\n}\n';
    }

    // =================================================================
    // Esecuzione
    // =================================================================

    /** @typedef {{ canvas: HTMLCanvasElement, gl: WebGLRenderingContext, uni: Record<string, WebGLUniformLocation|null> }} Piano */
    /** @type {Piano[]} */
    let piani = [];
    /** @type {Campo|null} */
    let campoAttivo = null;
    let rid = 0;
    let t0 = 0;
    let pausaA = 0;
    let sospeso = false;
    let ultimoDisegno = 0;
    let perso = false;
    let scalaAttuale = 0.4;
    // Evento corrente: quando è partito (ms), quanto dura, quando scatta il prossimo.
    let evInizio = -1;
    let evDurata = 4000;
    let evProssimo = 0;
    let evSeme = 0;
    /** @type {number|null} */
    let evFisso = null;
    // Regolatore: media mobile del tempo fra due frame del browser.
    let mediaFrame = 16;
    let lentoDa = 0;
    let ultimoRaf = 0;
    let ultimoErrore = '';

    function menoAnimazioni() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function compila(gl, tipo, src) {
        const o = gl.createShader(tipo);
        if (!o) return null;
        gl.shaderSource(o, src);
        gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) {
            ultimoErrore = String(gl.getShaderInfoLog(o));
            return null;
        }
        return o;
    }

    /**
     * Un canvas per piano. Nasce con le stesse regole di impilamento degli
     * strati DOM di field-ambience.css: il fondo (z-index 1) sta DIETRO le
     * carte, il primo piano (z-index 3) davanti.
     */
    function creaPiano(piano, sorgente, scala) {
        const canvas = document.createElement('canvas');
        canvas.className = 'aw-canvas aw-canvas--' + piano;
        canvas.setAttribute('aria-hidden', 'true');
        canvas.width = Math.max(64, Math.round(window.innerWidth * scala));
        canvas.height = Math.max(64, Math.round(window.innerHeight * scala));
        canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;'
            + 'pointer-events:none;z-index:' + (piano === 'fondo' ? 1 : 3) + ';';
        const gl = /** @type {WebGLRenderingContext|null} */ (canvas.getContext('webgl', {
            alpha: true, premultipliedAlpha: true, antialias: false, depth: false,
            stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false
        }));
        if (!gl) return null;
        // Senza highp nel fragment shader il rumore e' inaffidabile: meglio gli
        // strati DOM che un canvas che non mostra nulla.
        const prec = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        if (!prec || prec.precision === 0) return null;
        const vs = compila(gl, gl.VERTEX_SHADER, VS);
        const fs = compila(gl, gl.FRAGMENT_SHADER, sorgente);
        if (!vs || !fs) return null;
        const prog = gl.createProgram();
        if (!prog) return null;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        // Un solo triangolo che copre lo schermo: niente quad, niente indici.
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        const uni = {};
        ['r', 't', 'ev', 'evp', 'evs'].forEach((n) => { uni[n] = gl.getUniformLocation(prog, n); });
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); perso = true; });
        document.body.appendChild(canvas);
        return { canvas: canvas, gl: gl, uni: uni };
    }

    /** Inviluppo dell'evento: sale in fretta, scende piano. */
    function inviluppo(p) {
        const x = p < 0.18 ? p / 0.18 : (1 - p) / 0.82;
        return Math.max(0, x) * Math.max(0, x);
    }

    function aggiornaEvento(ora) {
        const cfg = campoAttivo && campoAttivo.ev;
        if (evFisso !== null) return { p: evFisso, env: inviluppo(evFisso) };
        if (!cfg) return { p: -1, env: 0 };
        if (evInizio < 0 && ora >= evProssimo) {
            evInizio = ora;
            evDurata = cfg.dur * 1000;
            evSeme = Math.random() * 100;
        }
        if (evInizio >= 0) {
            const p = (ora - evInizio) / evDurata;
            if (p >= 1) {
                evInizio = -1;
                evProssimo = ora + (cfg.ogni[0] + Math.random() * (cfg.ogni[1] - cfg.ogni[0])) * 1000;
                return { p: -1, env: 0 };
            }
            return { p: p, env: inviluppo(p) };
        }
        return { p: -1, env: 0 };
    }

    function ridimensiona(scala) {
        scalaAttuale = scala;
        piani.forEach((p) => {
            p.canvas.width = Math.max(64, Math.round(window.innerWidth * scala));
            p.canvas.height = Math.max(64, Math.round(window.innerHeight * scala));
            p.gl.viewport(0, 0, p.canvas.width, p.canvas.height);
        });
    }

    /**
     * Regolatore di fps: se il dispositivo non regge, prima si scende di
     * risoluzione (gli effetti sono morbidi: si nota poco), poi ci si spegne.
     * Meglio un campo senza ambiente che un duello a scatti.
     */
    function regola(ora) {
        if (ultimoRaf) mediaFrame = mediaFrame * 0.9 + Math.min(200, ora - ultimoRaf) * 0.1;
        ultimoRaf = ora;
        if (sospeso) { lentoDa = 0; return; }
        if (mediaFrame > 46) {
            if (!lentoDa) lentoDa = ora;
            if (ora - lentoDa > 2500) {
                lentoDa = 0;
                if (scalaAttuale > 0.28) ridimensiona(scalaAttuale * 0.72);
                else if (scalaAttuale > 0.2) ridimensiona(0.2);
                else { ferma(); window.dispatchEvent(new CustomEvent('ygo:ambiente-webgl-spento')); }
                mediaFrame = 16;
            }
        } else {
            lentoDa = 0;
        }
    }

    function disegna(ora) {
        rid = requestAnimationFrame(disegna);
        regola(ora);
        if (sospeso || perso || !piani.length) return;
        // Tetto a ~40 fps: un velo non guadagna nulla da 60, e su telefono il
        // margine che si libera va alle carte e agli attacchi.
        if (ora - ultimoDisegno < 24) return;
        ultimoDisegno = ora;
        const sec = ((ora - t0) / 1000) % 7200;
        const e = aggiornaEvento(ora);
        piani.forEach((p) => {
            const gl = p.gl;
            gl.uniform2f(p.uni.r, p.canvas.width, p.canvas.height);
            gl.uniform1f(p.uni.t, sec);
            gl.uniform1f(p.uni.ev, e.env);
            gl.uniform1f(p.uni.evp, e.p);
            gl.uniform1f(p.uni.evs, evSeme);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        });
    }

    function ferma() {
        cancelAnimationFrame(rid);
        rid = 0;
        piani.forEach((p) => {
            const ext = p.gl.getExtension('WEBGL_lose_context');
            p.canvas.remove();
            if (ext) ext.loseContext();
        });
        piani = [];
        campoAttivo = null;
        perso = false;
    }

    /**
     * Accende l'ambiente di un campo. Torna false (senza lasciare nulla nel
     * DOM) se non si può: campo senza voce, WebGL assente, shader rifiutato,
     * movimento ridotto.
     * @param {string} nome  chiave di CAMPI
     * @param {{ scala?: number }} [opzioni]
     */
    function avvia(nome, opzioni) {
        ferma();
        const campo = CAMPI[nome];
        if (!campo || menoAnimazioni() || window.AMBIENTE_WEBGL_OFF) return false;
        const scala = (opzioni && opzioni.scala) || 0.4;
        const nuovi = [];
        for (const piano of ['fondo', 'primo']) {
            const src = componi(campo, piano);
            if (!src) continue;
            const p = creaPiano(piano === 'primo' ? 'primopiano' : 'fondo', src, scala);
            if (!p) { nuovi.forEach((x) => x.canvas.remove()); return false; }
            nuovi.push(p);
        }
        if (!nuovi.length) return false;
        piani = nuovi;
        campoAttivo = campo;
        scalaAttuale = scala;
        t0 = performance.now();
        ultimoDisegno = 0; ultimoRaf = 0; mediaFrame = 16; lentoDa = 0;
        evInizio = -1; evFisso = null;
        const prima = campo.ev ? campo.ev.ogni[0] : 5;
        evProssimo = t0 + Math.min(2500, prima * 400); // il primo evento arriva presto: si vede subito che c'e' vita
        sospeso = false;
        rid = requestAnimationFrame(disegna);
        return true;
    }

    function sospendi(si) {
        if (si === sospeso) return;
        sospeso = si;
        if (si) pausaA = performance.now();
        else {
            const dt = performance.now() - pausaA;
            t0 += dt; // il tempo fermo non conta: niente salto
            if (evInizio >= 0) evInizio += dt;
            evProssimo += dt;
            ultimoRaf = 0; mediaFrame = 16;
        }
    }

    window.addEventListener('resize', () => { if (piani.length) ridimensiona(scalaAttuale); });

    window.AmbienteWebGL = {
        avvia: avvia,
        ferma: ferma,
        sospendi: sospendi,
        attivo: () => piani.length > 0,
        /** Per le verifiche: i canvas attualmente accesi. */
        canvas: () => piani.map((p) => p.canvas),
        /** Congela l'evento a un avanzamento 0..1 (null: torna al ritmo normale). Serve a prove e screenshot. */
        fissaEvento: (p) => { evFisso = p; if (p !== null) evSeme = 42.5; },
        /** Fa scattare subito l'evento del campo (la sandbox lo usa per provare un'arena senza aspettare). */
        scatta: () => { evInizio = -1; evProssimo = 0; },
        /** Il sorgente GLSL di un piano, per le verifiche (distinte, senza segnaposto). */
        sorgente: (nome, piano) => (CAMPI[nome] ? componi(CAMPI[nome], piano) : null),
        errore: () => ultimoErrore,
        NOMI: Object.keys(CAMPI)
    };
})();
