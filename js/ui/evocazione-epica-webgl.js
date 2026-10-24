// @ts-check
/**
 * evocazione-epica-webgl.js — l'Evocazione dei mostri di Livello 7+ in WebGL ("Il Risveglio").
 * ------------------------------------------------------------------------------------------------
 * Rimpiazza SOLO `playElementalConvergence` (la sequenza di ~4 s in GSAP/CSS che c'era per ogni mostro di Livello 7+) con una
 * scena a tutto schermo disegnata da UNO shader, ~5,2 secondi, nello stile dell'Attributo. Resta identico tutto il resto:
 *   - un filmato dedicato (video/evocazioni/<id>.mp4) VINCE sempre (decide effects.js, prima di arrivare qui);
 *   - senza WebGL, con "Dettagli video: Normali" o con il movimento ridotto si ricade sulla versione GSAP/CSS di sempre
 *     (questo backend non si attiva: vedi `EvocazioneEpicaPronta`);
 *   - il duello aspetta la durata che questa funzione RESTITUISCE (effects.js: `durata = runElementalConvergence(...)`).
 *
 * LA SCENA (tempi in secondi dall'avvio; TI = istante dell'impatto):
 *   0.0-0.5  il mondo si oscura, il bordo dello schermo si stringe (niente bande nere: scelta dell'utente).
 *   0.1-1.0  sul pavimento sotto la carta si disegna un SIGILLO (anelli, tacche, esagramma, rune) visto in prospettiva.
 *   0.2-2.6  una spirale di particelle di energia converge sul mostro; da ~0.8 gli archi di energia (fulmini) lo cercano.
 *   1.0-2.6  dal sigillo sale una COLONNA di luce che si allarga; la carta si carica e svanisce nel suo nucleo.
 *   2.4-2.7  tutto si ritira in un punto (anticipazione) e per un battito resta il buio.
 *   2.7      IMPATTO: lampo bianco, tre onde d'urto (due sul pavimento, una a tutto schermo), riga anamorfica, raggiera
 *            di scintille, scossa dello schermo; la carta ricompare col suo colpo e dietro sale la sua ILLUSTRAZIONE
 *            come uno spirito (DOM: funziona anche su file://, dove le texture WebGL non si possono caricare).
 *   3.0-4.9  il titolo con il nome vero della carta e le stelle del Livello; la luce si spegne a braci.
 *
 * LA FIRMA DELL'ATTRIBUTO (uTipo): LUCE raggi di sole e corona, OSCURITÀ un vuoto con anello di accrescimento e tentacoli,
 * FUOCO fiamme e crepe di lava, ACQUA un vortice a spirale e onde sul pavimento, VENTO un ciclone di strisce, TERRA crepe
 * e schegge di roccia con la polvere, DIVINO una raggiera dorata, raggi che cadono dall'alto e una doppia aureola.
 *
 * CANVAS PROPRIO (non quello condiviso di fx-webgl.js): serve la risoluzione scelta qui (le linee sottili sono il punto
 * debole di una scala bassa) e il tempo e' dichiarato dall'effetto, non dal motore. Il canvas nasce all'avvio e viene
 * RILASCIATO alla fine (`loseContext`): su telefono i contesti sono pochi.
 *
 * PER PROVARLA: `_anteprima-evocazioni.html`. `window.FX_WEBGL_T = <secondi>` congela lo shader a quell'istante (per gli
 * screenshot), `window.FX_WEBGL_VEL = 0.25` lo rallenta. `window.EVOCAZIONE_EPICA_OFF = true` lo spegne.
 */
(function () {
    'use strict';
    if (!window.FX || typeof window.FX.registerBackend !== 'function' || !window.FxWebgl) return;

    /** Istante dell'impatto e durata totale, in secondi: la scena intera e il DOM attorno si regolano su questi. */
    const TI = 2.7;
    const DUR = 5.2;
    const Z_CANVAS = 10052;
    const Z_APPARIZIONE = 10053;   // SOPRA il canvas: l'illustrazione non deve passare sotto il velo scuro della scena
    const Z_TITOLO = 10054;

    const TIPI = { 'LUCE': 0, 'OSCURITÀ': 1, 'FUOCO': 2, 'ACQUA': 3, 'VENTO': 4, 'TERRA': 5, 'DIVINO': 6 };

    // =================================================================================================================
    // Lo shader
    // =================================================================================================================
    // Le unita' sono "carte": p = (pixel - centro) / uS, con y verso l'ALTO, quindi la carta e' alta circa 1 e la scena
    // si adatta da sola a un telefono e a un monitor. L'uscita e' PREMOLTIPLICATA: rgb e' luce additiva, alpha e' solo
    // l'oscuramento del mondo (risultato = luce + sfondo * (1 - alpha)).
    const FS = window.FxWebgl.BASE + `
uniform vec2 uC;
uniform float uS;
uniform float uTipo;
uniform vec3 c1;
uniform vec3 c2;
uniform vec3 c3;
uniform float uSeed;
uniform float uFus;
const float PI=3.14159265;
const float TI=${TI.toFixed(2)};
const float DUR=${DUR.toFixed(2)};
float ease(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}
float gs(float d,float w){return exp(-d*d/(w*w));}
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float hh=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*hh);}

void main(){
  vec2 P=css()-uC;
  vec2 p=vec2(P.x,-P.y)/uS;
  float tt=t;
  float rr=length(p);
  float an=atan(p.y,p.x);
  float imp=tt-TI;
  float post=max(imp,0.);
  float dopo=step(0.,imp);
  float carica=ease(tt/TI);
  vec3 L=vec3(0.);
  float dark=0.;

  // ---- il mondo si oscura (di piu' lontano dal centro), con un battito di buio totale prima del colpo
  float dimIn=ease(tt/.45);
  float dimOut=1.-ease((tt-4.4)/.8);
  dark=.9*dimIn*dimOut*(.72+.28*smoothstep(.8,9.,rr));
  dark=max(dark,.55*smoothstep(TI-.3,TI-.06,tt)*(1.-dopo));

  // ---- pavimento: un piano sotto la carta, schiacciato in prospettiva
  vec2 g=vec2(p.x,(p.y+.55)*2.7);
  float gr=length(g);
  float ga=atan(g.y,g.x);

  // ---- SIGILLO
  float sA=ease(tt/.9)*(1.-ease((tt-4.0)/.9));
  float R=1.75*sA;
  float rot=tt*.9;
  float sig=0.;
  if(gr<R*1.3+.1){
    sig+=gs(gr-R,.05)*1.0+gs(gr-R*.8,.03)*.75+gs(gr-R*1.08,.02)*.5;
    sig+=smoothstep(.5,.95,sin((ga-rot)*40.))*gs(gr-R*.92,.04)*.9;
    float ds=9.;
    for(int i=0;i<6;i++){
      float a0=rot*.55+float(i)*1.0472;
      float a1=a0+2.0944;
      vec2 v0=R*.84*vec2(cos(a0),sin(a0));
      vec2 v1=R*.84*vec2(cos(a1),sin(a1));
      ds=min(ds,seg(g,v0,v1));
    }
    sig+=gs(ds,.028)*.95;
    float sec=(ga-rot*.4)/6.2832*24.;
    float cell=fract(sec);
    float on=step(.38,h(vec2(floor(sec+24.),uSeed)));
    sig+=on*smoothstep(.12,.3,cell)*smoothstep(.88,.7,cell)*gs(gr-R*.7,.035)*.9;
    sig+=exp(-gr*gr*3.5)*.25*sA;
  }
  sig*=sA*(.75+.5*carica)*(1.+2.2*exp(-post*3.5)*dopo);
  L+=mix(c2,c1,.45)*sig*1.4;

  // ---- COLONNA di luce che sale dal sigillo
  float y=p.y+.3;
  float apPil=ease((tt-1.0)/.9)*(1.-ease((imp-.15)/1.7));
  float pw=.08+.5*ease((tt-1.0)/1.6)*(1.-ease(imp/1.4)*dopo)+.95*exp(-post*3.)*dopo;
  float colx=gs(p.x,pw);
  float stre=.55+.95*fbm(vec2(p.x*7.,y*.6-tt*7.));
  float pil=colx*stre*smoothstep(-.35,.3,y)*exp(-max(y,0.)*.1)*apPil;
  L+=mix(c2,c1,.35+.55*colx)*pil*1.45;
  L+=c1*gs(p.x,pw*.22)*smoothstep(-.3,.2,y)*exp(-max(y,0.)*.07)*apPil*1.1;

  // ---- spirale di particelle di energia che converge
  float inten=ease((tt-.15)/.9)*(1.-ease((imp+.05)/.22));
  if(inten>.001){
    float acc=0.;
    for(int q=0;q<3;q++){
      float fq=float(q);
      float sectors=64.+fq*34.;
      float sw=an+(2.4+fq*.5)/(rr+.35);
      float sidf=sw/6.2832*sectors;
      float hs=h(vec2(floor(sidf+sectors),fq*7.3+uSeed));
      float phase=fract(hs+tt*(.22+.14*hs+fq*.05));
      float Rp=mix(8.5,0.,phase*phase);
      float da=fract(sidf)-.5;
      float tang=da*6.2832*max(rr,.06)/sectors;
      float rad=rr-Rp;
      float sz=.028+hs*.03;
      acc+=exp(-(tang*tang+rad*rad*.18)/(sz*sz))*smoothstep(0.,.12,phase)*(.5+phase);
    }
    L+=mix(c1,c2,.35)*acc*inten*1.35;
  }

  // ---- FUSIONE: un vortice a bracci che si stringe e accelera attorno ai materiali, con un anello di raccolta
  if(uFus>.5){
    float vv=ease((tt-.1)/.7)*(1.-ease((imp+.05)/.25));
    float spv=an+3.2*log(rr+.35)-tt*(2.+tt*1.3);
    float arms=pow(.5+.5*cos(spv*3.),3.);
    float fadeV=smoothstep(.0,.5,rr)*exp(-rr*.3);
    L+=mix(c2,c1,arms)*arms*fadeV*vv*1.6;
    L+=c2*exp(-rr*rr*1.1)*vv*.7;
    L+=c1*gs(rr-mix(5.,.45,ease(tt/2.5)),.07)*vv*.9;
  }

  // ---- archi di energia che cercano il mostro
  float bo=0.;
  float tb=floor(tt*14.);
  for(int k=0;k<6;k++){
    float fk=float(k);
    float a=fk*1.0472+h(vec2(fk,uSeed))*.9;
    vec2 dir=vec2(cos(a),sin(a));
    float u=dot(p,dir);
    float v=dot(p,vec2(-dir.y,dir.x));
    float Lk=3.4+2.2*h(vec2(fk,3.3));
    if(u>0.&&u<Lk){
      float jag=(n(vec2(u*5.+fk*9.,tb))-.5)*.5*(.25+u/Lk)+(n(vec2(u*17.,fk+tb))-.5)*.12;
      float dv=abs(v-jag);
      float fl=step(.38,h(vec2(tb,fk)));
      float en=smoothstep(.8+fk*.12,1.5+fk*.12,tt)*(1.-ease(imp/.15)*dopo)*(1.-smoothstep(Lk*.7,Lk,u));
      bo+=(gs(dv,.02)*1.7+gs(dv,.1)*.35)*fl*en;
    }
  }
  L+=mix(c1,vec3(1.),.45)*bo;

  // ---- nucleo di carica: la carta viene risucchiata in un punto
  float cr=.12+.6*carica*carica;
  float nuc=exp(-rr*rr/(cr*cr))*ease(tt/1.0)*(1.-ease(imp/.28)*dopo);
  L+=mix(c1,vec3(1.),.55)*nuc*1.9+c2*exp(-rr*rr/(cr*cr*7.))*.55*ease(tt/1.0)*(1.-ease(imp/.4)*dopo);

  // ---- FIRMA DELL'ATTRIBUTO
  float visC=ease((tt-.5)/1.6)*(1.-ease((imp-.2)/1.9));
  vec3 sg=vec3(0.);
  float darkX=0.;
  if(uTipo<.5){
    // LUCE: raggi di sole che ruotano e una corona
    float rays=pow(.5+.5*sin(an*18.+tt*.7),5.)*pow(.5+.5*sin(an*7.-tt*.4+1.3),2.);
    sg+=c1*rays*smoothstep(.3,1.,rr)*exp(-rr*.15)*visC*1.2;
    sg+=c1*gs(rr-(1.05+.18*sin(tt*3.)),.08)*visC*.9;
    float star=pow(max(0.,cos(an*4.)),40.)+pow(max(0.,cos(an*4.+PI/4.)),60.)*.6;
    sg+=c1*star*exp(-rr*.9)*exp(-post*2.4)*dopo*1.6;
  } else if(uTipo<1.5){
    // OSCURITA': un vuoto che cresce, con anello di accrescimento e tentacoli di buio
    float Rv=(.1+.78*carica*carica)*(1.-ease(imp/.35)*dopo);
    float vis=ease(tt/1.2);
    darkX=smoothstep(Rv,Rv*.55,rr)*.97*vis;
    float acr=gs(rr-Rv*1.2,.05+.05*Rv)*(.55+.9*pow(.5+.5*cos(an-tt*3.2),3.));
    sg+=c1*acr*1.5*vis*(1.-ease(imp/.35)*dopo);
    float ten=fbm(vec2(an*3.5+tt*.6,rr*1.6-tt*1.5));
    darkX=max(darkX,smoothstep(.55,.82,ten)*smoothstep(3.4,.5,rr)*.6*visC);
    sg+=c2*gs(rr-(.6+post*5.),.25)*exp(-post*2.)*dopo*1.2;
  } else if(uTipo<2.5){
    // FUOCO: fiamme nella colonna e crepe di lava sul pavimento
    float fy=max(p.y+.2,0.);
    float fw=.34+.5*ease((tt-1.)/1.5);
    float fn=fbm(vec2(p.x*3.6,p.y*1.6-tt*5.8));
    float fl=smoothstep(0.,1.,fn*(1.-fy*.1)*1.75-abs(p.x)/fw*.95)*step(-.3,p.y)*visC;
    sg+=mix(c3,mix(c2,c1,fl),fl)*fl*1.7;
    float crk=abs(sin(ga*7.+fbm(vec2(ga*2.,gr*3.))*4.));
    sg+=c2*smoothstep(.14,.0,crk)*gs(gr-R*.75,.7)*sA*1.1*(.7+.6*sin(tt*6.+gr*9.));
    // braci tonde (una per cella, in posizione casuale): senza il disco la cella intera si accenderebbe come un rettangolo
    vec2 ec=vec2(p.x*9.,p.y*4.-tt*3.);
    vec2 eid=floor(ec);
    float em=h(eid);
    vec2 eo=vec2(h(eid+3.7),h(eid+8.1))*.6+.2;
    float ed=length((fract(ec)-eo)*vec2(1.,2.2));
    sg+=c1*step(.9,em)*smoothstep(.16,.02,ed)*smoothstep(-.3,2.,p.y)*visC*1.6;
  } else if(uTipo<3.5){
    // ACQUA: vortice a spirale e onde sul pavimento
    float sp=sin(an*3.+log(rr+.05)*5.5-tt*4.5);
    sg+=mix(c2,c1,.5)*smoothstep(.82,1.,sp)*smoothstep(.2,.6,rr)*exp(-rr*.28)*visC*1.3;
    float wv=.5+.5*sin(gr*14.-tt*6.);
    sg+=c2*smoothstep(.85,1.,wv)*gs(gr-R*.55,.9)*sA*.8;
    float cau=abs(sin(p.x*9.+tt*2.)*sin(p.y*7.-tt*1.7)+sin(p.x*5.-p.y*6.+tt));
    sg+=c1*smoothstep(.2,.0,cau)*colx*apPil*.9;
  } else if(uTipo<4.5){
    // VENTO: ciclone di strisce e scintille nella spirale
    float st=fbm(vec2(an*6.+tt*3.2+rr*2.,rr*1.5-tt*2.));
    sg+=mix(c2,c1,.5)*smoothstep(.58,.82,st)*smoothstep(.15,.7,rr)*exp(-rr*.22)*visC*1.3;
    float cone=gs(p.x,pw+max(y,0.)*.12);
    sg+=c1*cone*(.4+.8*fbm(vec2(an*2.,y*3.-tt*6.)))*apPil*.55;
  } else if(uTipo<5.5){
    // TERRA: crepe che si aprono dal centro, schegge di roccia che salgono, polvere
    float crk=abs(sin(an*9.+fbm(vec2(an*3.,rr*2.))*3.5));
    sg+=mix(c2,c1,.4)*smoothstep(.08,.0,crk)*smoothstep(.1,.6,rr)*smoothstep(4.5,1.,rr)*visC*1.3;
    vec2 rc=vec2(p.x*5.,p.y*3.-tt*1.4);
    vec2 cid=floor(rc);
    float hh=h(cid+uSeed);
    vec2 lc=fract(rc)-.5;
    float ang=hh*6.28+tt*2.;
    vec2 rq=vec2(cos(ang)*lc.x-sin(ang)*lc.y,sin(ang)*lc.x+cos(ang)*lc.y);
    float rock=smoothstep(.2,.08,max(abs(rq.x)*1.1,abs(rq.y)))*step(.82,hh);
    sg+=mix(c2,c1,hh)*rock*visC*smoothstep(-.4,1.2,p.y)*1.1;
    darkX=max(darkX,gs(gr-(.4+post*4.5),.7)*.3*exp(-post*1.1)*dopo);
  } else {
    // DIVINO: raggiera dorata, raggi che cadono dall'alto, doppia aureola
    float rays=pow(.5+.5*sin(an*16.+tt*.5),3.);
    sg+=c1*rays*smoothstep(.2,1.,rr)*exp(-rr*.13)*visC*1.4;
    sg+=c2*gs(rr-1.0,.06)*visC*1.1+c1*gs(rr-1.35,.04)*visC*.9;
    for(int b=0;b<5;b++){
      float fb=float(b);
      float bx=(fb-2.)*.55+(h(vec2(fb,uSeed))-.5)*.2;
      float fall=smoothstep(.0,1.,(tt-.5-fb*.18)/.9);
      float front=mix(7.,-.3,ease(fall));
      sg+=c1*gs(p.x-bx,.05)*step(front,p.y)*(1.-ease(imp/.4)*dopo)*visC*.9;
    }
  }
  L+=sg;
  dark=max(dark,darkX);

  // ---- IMPATTO
  float fl2=exp(-post*7.)*dopo;
  L+=vec3(1.)*fl2*(exp(-rr*rr*.3)*1.4)+c1*fl2*.9;
  float f3=exp(-post*3.)*dopo;
  L+=mix(c1,vec3(1.),.6)*gs(p.y,.03+.02*post)*exp(-abs(p.x)*.26)*f3*1.7;
  for(int k=0;k<3;k++){
    float fk=float(k);
    float tr=imp-fk*.10;
    if(tr>0.){
      float Rk=tr*(6.5+fk*2.8);
      float dd=(k<2)?length(vec2(p.x*.62,(p.y+.4)*1.9)):rr;
      float wd=.09+tr*.34;
      float rg=gs(dd-Rk,wd)*exp(-tr*1.25)*(1.-fk*.18);
      L+=mix(c2,c1,.5+.15*fk)*rg*1.7;
    }
  }
  if(dopo>.5){
    float spk=0.;
    for(int q=0;q<3;q++){
      float fq=float(q);
      float sectors=54.+fq*26.;
      float sidf=an/6.2832*sectors;
      float hs=h(vec2(floor(sidf+sectors),fq*5.1+uSeed));
      float cell=fract(sidf)-.5;
      float Rp=imp*(3.+hs*8.);
      float tang=cell*6.2832*max(rr,.06)/sectors;
      float life=exp(-imp*(.9+hs*.8));
      spk+=gs(tang,.02+.015*hs)*gs(rr-Rp,.18+imp*.06)*life*step(.55,h(vec2(floor(sidf+sectors),fq)));
    }
    L+=mix(c1,vec3(1.),.4)*spk*1.7;
  }
  // bagliore residuo a braci
  L+=c2*exp(-rr*rr*.8)*.22*dopo*(1.-ease((imp-.8)/2.2));

  L=vec3(1.)-exp(-L*0.62);
  gl_FragColor=vec4(L,clamp(dark,0.,.97));
}`;

    // =================================================================================================================
    // Regia
    // =================================================================================================================

    const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

    function colore(testo, ripiego) {
        const s = String(testo || '').trim();
        let m = /^#([0-9a-f]{6})$/i.exec(s);
        if (m) return [parseInt(m[1].slice(0, 2), 16) / 255, parseInt(m[1].slice(2, 4), 16) / 255, parseInt(m[1].slice(4, 6), 16) / 255];
        m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(s);
        if (m) return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
        return ripiego;
    }

    function menoMovimento() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    function dettagliAlti() {
        return !window.VideoQuality || typeof window.VideoQuality.isAlti !== 'function' || window.VideoQuality.isAlti();
    }

    let provaGl = null;
    /** WebGL con highp nel fragment shader (senza, il rumore e' inaffidabile): una sola prova, in cache. */
    function webglAdatto() {
        if (provaGl === null) {
            try {
                const c = document.createElement('canvas');
                const g = c.getContext('webgl');
                const pr = g && g.getShaderPrecisionFormat(g.FRAGMENT_SHADER, g.HIGH_FLOAT);
                provaGl = !!(g && pr && pr.precision > 0);
                const e = g && g.getExtension('WEBGL_lose_context');
                if (e) e.loseContext();
            } catch (e) { provaGl = false; }
        }
        return provaGl;
    }

    // Il backend si attiva solo se serve davvero: WebGL, Dettagli "Alti", niente movimento ridotto, non spento a mano.
    Object.defineProperty(window, 'EvocazioneEpicaPronta', {
        configurable: true,
        get() { return !window.EVOCAZIONE_EPICA_OFF && !menoMovimento() && dettagliAlti() && webglAdatto(); }
    });

    /** Le carte il cui effetto di Evocazione e' gia' stato mostrato dalla scena della Fusione (vedi `rivelazioneFusioneFatta`). */
    const fusioniMostrate = new WeakSet();

    let stileIniettato = false;
    function iniettaStile() {
        if (stileIniettato) return;
        stileIniettato = true;
        const s = document.createElement('style');
        s.id = 'evocazioneEpicaStile';
        s.textContent = `
.ee-titolo{position:fixed;left:50%;z-index:${Z_TITOLO};pointer-events:none;text-align:center;white-space:nowrap;transform:translate(-50%,-50%);opacity:0}
.ee-titolo-nome{display:block;font-family:Georgia,'Times New Roman',serif;font-weight:900;font-size:clamp(1.5rem,5.4vw,3.2rem);letter-spacing:.12em;text-transform:uppercase;color:#fff;
  text-shadow:0 0 14px var(--ee-c2),0 0 34px var(--ee-c3),0 3px 10px rgba(0,0,0,.9)}
.ee-titolo-sotto{display:block;margin-top:.5em;font-family:system-ui,sans-serif;font-weight:700;font-size:clamp(.7rem,2vw,1rem);letter-spacing:.5em;color:var(--ee-c1);text-shadow:0 0 12px var(--ee-c2);text-transform:uppercase}
.ee-titolo-stelle{display:block;margin-top:.4em;font-size:clamp(.8rem,2.4vw,1.25rem);letter-spacing:.25em;color:var(--ee-c1);text-shadow:0 0 10px var(--ee-c2)}
.ee-apparizione{position:fixed;z-index:${Z_APPARIZIONE};pointer-events:none;background-size:cover;background-position:center;opacity:0;
  -webkit-mask-image:radial-gradient(closest-side,#000 74%,transparent 100%);mask-image:radial-gradient(closest-side,#000 74%,transparent 100%)}
.ee-stat{display:flex;justify-content:center;gap:1.6em;margin-top:.7em;font-family:Georgia,'Times New Roman',serif;font-weight:900;font-size:clamp(1rem,3.2vw,1.9rem);letter-spacing:.06em;color:#fff;text-shadow:0 0 12px var(--ee-c2),0 2px 8px rgba(0,0,0,.95)}
.ee-stat b{font-size:.6em;letter-spacing:.2em;margin-right:.5em;color:var(--ee-c1);vertical-align:.18em}
.ee-stelle span{display:inline-block}
.ee-stelle{display:flex;min-height:1em;justify-content:center;gap:.12em;margin-top:.5em;font-size:clamp(1rem,3.4vw,1.9rem);line-height:1;color:#ffd96b;text-shadow:0 0 10px #ff9d00,0 2px 6px rgba(0,0,0,.9)}
`;
        document.head.appendChild(s);
    }

    function stelle(livello) {
        const n = Math.max(0, Math.min(13, livello | 0));
        return n ? '★'.repeat(n) : '';
    }

    /**
     * La scena. Torna la durata in millisecondi: effects.js la usa per far aspettare il duello (e per liberare il lock della
     * cinematica), quindi TUTTO quello che questa funzione crea sparisce entro quel tempo, su qualunque strada.
     * Lancia un errore PRIMA di aver fatto qualcosa se non puo' partire: viaBackend ricade allora sul backend successivo (GSAP).
     * @param {HTMLElement} monsterElement
     * @param {any} card
     * @param {{ bright?: string, mid?: string, midSoft?: string, deep?: string, particleColors?: string[] }} theme
     * @returns {number}
     */
    function playElementalConvergence(monsterElement, card, theme) {
        if (!monsterElement || !theme) return 0;
        return scena(monsterElement, card, theme, null);
    }

    /**
     * La scena vera, per due usi: l'Evocazione di un mostro di Livello 7+ (`fus` nullo: c'e' la carta sul Terreno) e la Fusione
     * (`fus` = { materiali, owner, onDone }: la carta NON c'e' ancora, i materiali girano in un vortice al centro dello schermo, e
     * `onDone` fa entrare il mostro solo a fine scena). Nella Fusione dopo il vortice si riprende la stessa seconda parte
     * dell'Evocazione (impatto, grande illustrazione, nome, stelle, ATK/DEF), sempre sul fondo scuro.
     */
    function scena(monsterElement, card, theme, fus) {
        iniettaStile();

        const W = window.innerWidth;
        const H = window.innerHeight;
        const rect = monsterElement ? monsterElement.getBoundingClientRect() : null;
        const cx = rect ? rect.left + rect.width / 2 : W / 2;
        const cy = rect ? rect.top + rect.height / 2 : H * 0.5;
        const S = rect ? Math.max(80, Math.min(150, rect.height || 100)) : Math.max(90, Math.min(150, H * 0.18));
        const tipo = Object.prototype.hasOwnProperty.call(TIPI, card && card.attribute) ? TIPI[card.attribute] : 0;
        // Il rosso del tema del FUOCO nella luce additiva vira al rosa: lo si scalda verso l'arancio.
        const midC = tipo === TIPI['FUOCO'] ? [1, .46, .12] : colore(theme.mid, [1, .8, .3]);
        const deep = colore(theme.deep, [.8, .4, .1]);
        // `bright` nel tema e' quasi sempre bianco: usato tal quale scolora ogni Attributo nello stesso bianco. Il "caldo" della
        // scena e' quindi il colore dell'Attributo spinto verso il chiaro solo in parte; il bianco puro lo mette lo shader
        // dove serve (nucleo, lampo).
        const bright0 = colore(theme.bright, [1, 1, 1]);
        const bright = midC.map((v, k) => v + (bright0[k] - v) * 0.3);
        const mid = midC;
        const rilievo = (c, min) => c.map((v) => Math.max(v, min));

        // --- canvas e programma (se qualcosa va storto, si lancia PRIMA di toccare la pagina)
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        const gl = /** @type {WebGLRenderingContext|null} */ (canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' }));
        if (!gl) throw new Error('webgl-non-disponibile');
        const compila = (tipoSh, src) => {
            const o = gl.createShader(tipoSh);
            if (!o) return null;
            gl.shaderSource(o, src);
            gl.compileShader(o);
            if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { window.EVOCAZIONE_EPICA_ERRORE = String(gl.getShaderInfoLog(o)); return null; }
            return o;
        };
        const vs = compila(gl.VERTEX_SHADER, VS);
        const fs = compila(gl.FRAGMENT_SHADER, FS);
        const prog = gl.createProgram();
        if (!vs || !fs || !prog) { rilascia(gl); throw new Error('shader-non-compilato'); }
        gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { rilascia(gl); throw new Error('shader-non-collegato'); }

        // Risoluzione: piu' alta di quella condivisa (le linee sottili ne hanno bisogno), con un tetto sul totale dei pixel.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const scala = Math.min(0.95, Math.max(0.5, Math.sqrt(1.5e6 / (W * H * dpr * dpr)) * dpr));
        canvas.width = Math.max(64, Math.round(W * scala));
        canvas.height = Math.max(64, Math.round(H * scala));
        canvas.style.cssText = `position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:${Z_CANVAS};`;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        const u = (nome) => gl.getUniformLocation(prog, nome);
        gl.uniform2f(u('r'), canvas.width, canvas.height);
        gl.uniform1f(u('k'), 1 / scala);
        gl.uniform1f(u('H'), H);
        gl.uniform2f(u('uC'), cx, cy);
        gl.uniform1f(u('uS'), S);
        gl.uniform1f(u('uTipo'), tipo);
        gl.uniform1f(u('uFus'), fus ? 1 : 0);
        gl.uniform3fv(u('c1'), rilievo(bright, .35));
        gl.uniform3fv(u('c2'), rilievo(mid, .3));
        gl.uniform3fv(u('c3'), rilievo(deep, .25));
        gl.uniform1f(u('uSeed'), Math.random() * 40);
        const uT = u('t');
        document.body.appendChild(canvas);

        const extra = [];            // elementi DOM da togliere alla fine
        const animazioni = [];       // animazioni da annullare alla fine
        let chiusa = false;
        let rid = 0;
        const t0 = performance.now();

        const chiudi = () => {
            if (chiusa) return;
            chiusa = true;
            cancelAnimationFrame(rid);
            animazioni.forEach((a) => { try { a.cancel(); } catch (e) { /* gia' finita */ } });
            extra.forEach((el) => el.remove());
            canvas.remove();
            rilascia(gl);
            // Fusione: a scena finita il mostro entra davvero (la regola e' sincrona, il motore l'aveva solo rimandata) e il
            // duello puo' riprendere. Una sola volta, qualunque strada abbia portato a chiudere.
            if (fus) {
                fusioniMostrate.add(card);
                if (window.FX && typeof FX.endSummonCinematic === 'function') FX.endSummonCinematic();
                if (typeof fus.onDone === 'function') { try { fus.onDone(); } catch (e) { console.error(e); } }
            }
        };

        // --- Fusione: le carte dei materiali girano in un vortice in prospettiva e vengono risucchiate nel nucleo.
        let orbita = [];
        if (fus) {
            const mat = (fus.materiali || []).slice(0, 8);
            const larg = S * 0.72;
            orbita = mat.map((m, i) => {
                const guscio = document.createElement('div');
                guscio.style.cssText = `position:fixed;left:0;top:0;width:${larg}px;height:${S}px;z-index:${Z_APPARIZIONE};pointer-events:none;will-change:transform,opacity;opacity:0;`;
                if (typeof window.createCardElement === 'function') {
                    const c = createCardElement(m, false, 'attack');
                    c.style.cssText = 'width:100%!important;height:100%!important;margin:0!important;position:static!important;';
                    guscio.appendChild(c);
                }
                document.body.appendChild(guscio); extra.push(guscio);
                return { el: guscio, base: i * (Math.PI * 2 / Math.max(1, mat.length)), larg };
            });
        }
        const R0 = Math.min(W, H) * 0.34;
        const aggiornaOrbita = (tempo) => {
            const f = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
            orbita.forEach((o) => {
                const ang = o.base + 2.0 * tempo + 0.95 * tempo * tempo;
                const raggio = R0 * (1 - f((tempo - 0.3) / 2.25));
                const fronte = Math.sin(ang);                       // +1 = davanti (piu' grande), -1 = dietro
                const scala = (0.35 + 0.65 * (raggio / R0)) * (1 + 0.28 * fronte) * (0.9 + 0.1 * f(tempo / 0.5));
                const x = cx + Math.cos(ang) * raggio;
                const y = cy + fronte * raggio * 0.42;
                const op = f(tempo / 0.45) * (1 - f((tempo - 2.35) / 0.3));
                o.el.style.transform = `translate(${x - o.larg / 2}px,${y - S / 2}px) rotate(${(Math.cos(ang) * -14).toFixed(1)}deg) scale(${scala.toFixed(3)})`;
                o.el.style.opacity = String(op);
                o.el.style.zIndex = String(Z_APPARIZIONE + (fronte > 0 ? 1 : -1));
            });
        };

        const ciclo = (ora) => {
            if (chiusa) return;
            const congelato = typeof window.FX_WEBGL_T === 'number';
            const vel = typeof window.FX_WEBGL_VEL === 'number' ? window.FX_WEBGL_VEL : 1;
            const tempo = congelato ? window.FX_WEBGL_T : ((ora - t0) / 1000) * vel;
            if (!congelato && tempo > DUR) { chiudi(); return; }
            if (orbita.length) aggiornaOrbita(tempo);
            if (!document.hidden) {
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.uniform1f(uT, tempo);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
            }
            rid = requestAnimationFrame(ciclo);
        };
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); chiudi(); });
        rid = requestAnimationFrame(ciclo);

        const aggiungi = (el) => { document.body.appendChild(el); extra.push(el); return el; };
        const css3 = (c) => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;


        // --- la carta evocata NON si vede finche' non scatta l'impatto: poi compare nel lampo. Il nascondiglio e' una regola
        //     per uid (non un'animazione sul nodo): un ridisegno del Terreno sostituisce il nodo, e la regola vale anche per il nuovo.
        const uidCarta = card && card.uid ? String(card.uid).replace(/["\\]/g, '') : '';
        if (fus) {
            // Fusione: il mostro non e' ancora sul Terreno, non c'e' niente da nascondere. A fine scena i materiali sono spariti
            // e il mostro entra; il motore NON rifa' l'effetto di Evocazione (lo ha gia' visto: vedi `rivelazioneFusioneFatta`).
        } else if (uidCarta) {
            const nascondi = aggiungi(document.createElement('style'));
            // Anche il badge ATK/DEF sotto la carta (fratello della carta nella casella) resta spento fino all'impatto.
            nascondi.textContent = `[data-uid="${uidCarta}"],.field-slot:has([data-uid="${uidCarta}"]) .field-stats-badge{opacity:0 !important}`;
            // L'ologramma WebGL del mostro (se acceso) nasce al primo ridisegno dopo la carta: lo si tiene spento fino all'impatto.
            const guardia = setInterval(() => {
                if (chiusa || !window.MonsterHologramGL) { clearInterval(guardia); return; }
                MonsterHologramGL.nascondiPer(card.uid, TI * 1000 - (performance.now() - t0) + 150);
            }, 80);
            setTimeout(() => clearInterval(guardia), TI * 1000);
            setTimeout(() => {
                nascondi.remove();
                const el = document.querySelector(`[data-uid="${uidCarta}"]`) || monsterElement;
                try {
                    const a = el.animate([
                        { opacity: 0, filter: 'brightness(7)', scale: '1.3' },
                        { opacity: 1, filter: 'brightness(1)', scale: '1' }
                    ], { duration: 650, easing: 'cubic-bezier(.1,.7,.2,1)' });
                    animazioni.push(a);
                } catch (e) { /* senza WAAPI compare e basta */ }
            }, TI * 1000);
        } else if (monsterElement) {
            monsterElement.style.visibility = 'hidden';
            setTimeout(() => { monsterElement.style.removeProperty('visibility'); }, TI * 1000);
        }

        // --- l'illustrazione che sale come uno spirito
        const percorso = (typeof window.getCardImagePath === 'function' && card) ? window.getCardImagePath(card) : null;
        if (percorso) {
            const lato = Math.max(300, Math.min(W, H) * 0.62, S * 3.6);
            const sp = aggiungi(document.createElement('div'));
            sp.className = 'ee-apparizione';
            sp.style.cssText = `left:${cx - lato / 2}px;top:${cy - lato / 2}px;width:${lato}px;height:${lato}px;background-image:url('${String(percorso).replace(/'/g, "\\'")}');filter:saturate(1.2) contrast(1.06) drop-shadow(0 0 22px ${css3(mid)});`;
            try {
                const a = sp.animate([
                    { opacity: 0, transform: 'translateY(50px) scale(.55)', offset: 0, easing: 'cubic-bezier(.1,.7,.2,1)' },
                    { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.18, easing: 'ease-out' },
                    { opacity: 1, transform: 'translateY(-4px) scale(1.02)', offset: 0.72, easing: 'ease-in' },
                    { opacity: 0, transform: 'translateY(-12px) scale(1.04)', offset: 1 }
                ], { duration: 2400, delay: TI * 1000, fill: 'both' });
                animazioni.push(a);
            } catch (e) { sp.remove(); }
        }

        // --- titolo col nome vero della carta e le stelle del Livello
        const titolo = aggiungi(document.createElement('div'));
        titolo.className = 'ee-titolo';
        titolo.style.top = (cy < H / 2 ? H * 0.74 : H * 0.27) + 'px';
        titolo.style.setProperty('--ee-c1', css3(rilievo(bright, .6)));
        titolo.style.setProperty('--ee-c2', css3(rilievo(mid, .4)));
        titolo.style.setProperty('--ee-c3', css3(rilievo(deep, .35)));
        const nome = document.createElement('span'); nome.className = 'ee-titolo-nome'; nome.textContent = String((card && card.name) || 'Evocazione');
        const sotto = document.createElement('span'); sotto.className = 'ee-titolo-sotto'; sotto.textContent = fus ? 'Evocazione per Fusione' : 'Evocazione';
        // Stelle del Livello e ATK/DEF, come nella presentazione di Master Duel: i valori sono quelli ATTUALI della carta in campo.
        const st = document.createElement('div'); st.className = 'ee-stelle';
        // Le stelle compaiono UNA ALLA VOLTA (come in Master Duel), dopo il nome: un colpo di scala + lampo per ognuna.
        const nStelle = Math.max(0, Math.min(13, ((card && card.level) | 0)));
        for (let k = 0; k < nStelle; k++) {
            const s = document.createElement('span');
            s.textContent = '★';
            s.style.opacity = '0';
            st.appendChild(s);
            try {
                const a = s.animate([
                    { opacity: 0, transform: 'scale(2.6)', filter: 'brightness(4) blur(3px)' },
                    { opacity: 1, transform: 'scale(.9)', filter: 'brightness(2)', offset: 0.5 },
                    { opacity: 1, transform: 'scale(1)', filter: 'brightness(1)' }
                ], { duration: 260, delay: (TI + 0.55 + k * 0.12) * 1000, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
                animazioni.push(a);
            } catch (e) { s.style.opacity = '1'; }
        }
        const valore = (nomeFn, grezzo) => {
            try {
                const eng = window.DuelEngine;
                if (eng && typeof eng[nomeFn] === 'function' && card && card.uid) {
                    for (const owner of ['player', 'bot']) {
                        const campo = window.gameState && gameState[owner + 'MonsterField'];
                        const i = campo ? campo.findIndex((s) => s && s.card && s.card.uid === card.uid) : -1;
                        if (i >= 0) { const v = eng[nomeFn](owner, i); if (typeof v === 'number') return v; }
                    }
                }
            } catch (e) { /* ripiego sul valore stampato */ }
            return grezzo;
        };
        const atk = valore('getEffectiveAtk', card && card.attack);
        const dif = valore('getEffectiveDef', card && card.defense);
        const stat = document.createElement('div'); stat.className = 'ee-stat';
        stat.innerHTML = `<span><b>ATK</b>${Number.isFinite(atk) ? atk : '?'}</span><span><b>DEF</b>${Number.isFinite(dif) ? dif : '?'}</span>`;
        titolo.append(sotto, nome, st, stat);
        // Disposizione a colonna: prima il blocco col nome, stelle e ATK/DEF, subito sotto l'illustrazione — mai una sopra l'altra.
        // Se lo schermo e' basso l'illustrazione si rimpicciolisce quanto serve (il blocco di testo ha la sua altezza vera, misurata).
        {
            const hT = titolo.offsetHeight || 170;
            const gap = 12;
            const latoMax = Math.max(120, Math.min(H * 0.95 - hT - gap, W * 0.9));
            const sp = /** @type {HTMLElement|null} */ (document.querySelector('.ee-apparizione'));
            const latoF = sp ? Math.min(parseFloat(sp.style.width) || latoMax, latoMax) : 0;
            const totale = hT + (sp ? gap + latoF : 0);
            const alto = Math.max(4, (H - totale) / 2);
            titolo.style.top = (alto + hT / 2) + 'px';
            if (sp) {
                sp.style.left = (W / 2 - latoF / 2) + 'px';
                sp.style.top = (alto + hT + gap) + 'px';
                sp.style.width = sp.style.height = latoF + 'px';
            }
        }
        try {
            const a = titolo.animate([
                { opacity: 0, transform: 'translate(-50%,-50%) scale(1.25)', filter: 'blur(14px)', letterSpacing: '.7em', offset: 0, easing: 'cubic-bezier(.1,.7,.2,1)' },
                { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', filter: 'blur(0)', letterSpacing: '.12em', offset: 0.2, easing: 'linear' },
                { opacity: 1, transform: 'translate(-50%,-50%) scale(1.03)', filter: 'blur(0)', offset: 0.8, easing: 'ease-in' },
                { opacity: 0, transform: 'translate(-50%,-50%) scale(1.08)', filter: 'blur(6px)', offset: 1 }
            ], { duration: 2000, delay: (TI + 0.3) * 1000, fill: 'both' });
            animazioni.push(a);
        } catch (e) { titolo.style.opacity = '1'; }

        // --- scossa dello schermo e particelle all'impatto
        setTimeout(() => {
            if (chiusa) return;
            const contenitore = document.querySelector('.game-container') || document.body;
            contenitore.classList.add('fx-shake');
            setTimeout(() => contenitore.classList.remove('fx-shake'), 500);
        }, TI * 1000);

        // Rete di sicurezza: qualunque cosa accada, tutto sparisce poco dopo la durata dichiarata.
        setTimeout(chiudi, DUR * 1000 + 400);
        return DUR * 1000;
    }

    function rilascia(gl) {
        try { const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } catch (e) { /* gia' perso */ }
    }

    /** Fusione in WebGL: vortice di carte, poi la seconda parte dell'Evocazione epica. Torna la durata (ms) che il motore deve aspettare. */
    function playFusionMaterialEffect(materiali, fusionCard, owner, onDone) {
        if (!Array.isArray(materiali) || !materiali.length || !fusionCard) throw new Error('fusione-senza-dati');
        const temi = window.FX && FX.summonThemes;
        const theme = temi && (temi[fusionCard.attribute] || temi['LUCE']);
        if (!theme) throw new Error('nessun-tema');
        // Il suono di sempre della Fusione (file reale audio/standard/fusion.mp3 o ripiego sintetizzato).
        if (window.SFX && typeof SFX.fusion === 'function') SFX.fusion();
        // Se la scena non parte (WebGL assente), lancia PRIMA di aver toccato qualcosa e vale la versione di sempre.
        const durata = (() => {
            FX.beginSummonCinematic();
            try { return scena(null, fusionCard, theme, { materiali, owner, onDone }); } catch (e) { FX.endSummonCinematic(); throw e; }
        })();
        return durata;
    }

    /** Il motore lo chiede quando una carta entra per Fusione: se questa scena l'ha gia' mostrata, niente secondo effetto di Evocazione. */
    function rivelazioneFusioneFatta(card) {
        const si = fusioniMostrate.has(card);
        fusioniMostrate.delete(card);
        return si;
    }

    window.EvocazioneEpica = { DURATA_MS: DUR * 1000, ISTANTE_IMPATTO_S: TI, esegui: playElementalConvergence, fusione: playFusionMaterialEffect, tipi: TIPI };
    window.FX.rivelazioneFusioneFatta = rivelazioneFusioneFatta;
    window.FX.registerBackend('webgl', { requires: ['EvocazioneEpicaPronta'], impls: { playElementalConvergence: playElementalConvergence, playFusionMaterialEffect: playFusionMaterialEffect } });
})();
