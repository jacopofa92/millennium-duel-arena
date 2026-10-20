// @ts-check
/**
 * duel-fx-webgl.js — lo sfondo animato in WebGL delle schermate di inizio e fine duello.
 * ------------------------------------------------------------------------------------
 * Al posto dei raggi che ruotavano (tolti) dietro la presentazione "VS / It's time to duel!" e dietro
 * Vittoria, Sconfitta e Pareggio, un solo shader a tutto schermo con quattro scene:
 *
 *   intro   due fiumi di energia, azzurro dal lato del giocatore e rosso da quello dell'avversario, che scorrono
 *           e convergono al centro dove sta il "VS"; al momento di "DUEL!" un'onda d'urto e un lampo;
 *   won     un alone dorato che respira, colonne di luce che salgono, braci che si alzano e un anello che si
 *           allarga all'arrivo;
 *   lost    cenere che cade nel buio freddo, nebbia lenta, un bagliore di tempesta che passa ogni tanto;
 *   draw    pulviscolo neutro che si muove piano.
 *
 * Il canvas sta SOTTO il contenuto dell'overlay (e' il primo figlio), non cattura il tocco, gira solo finche'
 * l'overlay e' nel documento e a risoluzione ridotta; se il dispositivo non regge scende di risoluzione e poi
 * si spegne da solo (resta lo sfondo sfumato dell'overlay). Con "riduci movimento" si disegna un solo fotogramma.
 */
(function () {
    'use strict';

    const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 r; uniform float t; uniform float modo; uniform float imp;   // modo 0 intro, 1 vittoria, 2 sconfitta, 3 pareggio; imp = secondi dall'impatto (-1 prima)
float h(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return s;}
vec4 over(vec4 top,vec4 bot){return top+bot*(1.-top.a);}

// Particelle a celle che salgono (vy>0) o cadono (vy<0): 3 profondita'. dim in unita' di altezza.
vec4 particelle(vec2 uv,float asp,float tt,vec3 c,float vy,float vx,float dens,float dim,float lamp,float osc){
  vec2 base=vec2(uv.x*asp,uv.y); float acc=0.;
  for(int i=0;i<3;i++){
    float fi=float(i); vec2 p=base*dens*(1.+fi*.7);
    p-=vec2(vx,vy)*tt*(1.+fi*.45); p.x+=sin(tt*(.5+fi*.2)+p.y*1.6+fi*2.)*osc;
    vec2 id=floor(p); vec2 d=fract(p)-.5-(vec2(h(id+fi*5.1),h(id+fi*5.1+3.7))-.5)*.5;
    float rnd=h(id+fi*17.3); float ex=h(id+fi*9.7+3.);
    float tw=lamp>.5?(.5+.5*sin(tt*(1.3+rnd*2.5)+rnd*40.)):1.;
    acc+=smoothstep(dim*(.45+rnd*.75),dim*.1,length(d))*step(.6,ex)*tw*(1.-fi*.2);
  }
  float a=clamp(acc,0.,1.); return vec4(c*a*1.3,a*.85);
}

void main(){
  vec2 uv=gl_FragCoord.xy/r; float asp=r.x/r.y; vec4 o=vec4(0.);
  if(modo<.5){
    // ---------- INTRO: due fiumi di energia che convergono al VS ----------
    // due fiumi che partono dai bordi, SI SPINGONO oltre il centro e si sovrappongono (i colori si sommano in un bianco-viola)
    float lum=0.; vec3 acc3=vec3(0.);
    for(int k=0;k<2;k++){
      float s=k==0?1.:-1.;                          // +1 fiume di sinistra (blu), -1 di destra (rosso)
      float p=s>0.?uv.x:1.-uv.x;                    // distanza dal proprio bordo, 0..1
      float q=max(1.-p*2.,0.);                      // 1 sul bordo, 0 al centro (e oltre)
      float avanza=smoothstep(0.,1.4,t)*.64;        // la testa del fiume avanza fino a oltre il centro
      float testa=smoothstep(avanza,avanza-.16,p);
      vec3 cl=s>0.?vec3(.22,.62,1.):vec3(1.,.3,.2);
      float yc=.47+(.085*sin(q*7.-t*2.6*s+s)*q+.03*sin(q*17.+t*3.))*(.4+.6*q);
      float w=.034+.06*q;
      float d=uv.y-yc;
      float fl=fbm(vec2(p*9.-t*1.7*s,uv.y*22.+s*3.));
      float core=exp(-d*d/(w*w*.4))*(.55+.9*fl);
      float alone=exp(-d*d/(w*w*9.))*.55;
      float yc2=.47-.07*sin(q*9.+t*2.1*s)*q;
      float d2=uv.y-yc2; float core2=exp(-d2*d2/(w*w*.25))*(.35+.8*fbm(vec2(p*11.+t*1.4*s,uv.y*27.)));
      float conv=.55+pow(1.-q,1.4)*1.3;             // piu' luminoso verso il centro
      float l=(core+core2*.8+alone)*conv*testa*smoothstep(1.,.9,q+.0)*smoothstep(0.,.5,t);
      acc3+=cl*l; lum+=l;
    }
    o=over(vec4(acc3,clamp(lum*.5,0.,1.)),o);
    // dove si incontrano si fondono: colonna d'energia che sale e scende
    float xm=abs(uv.x-.5)*asp;
    float fusione=smoothstep(1.1,2.1,t);
    float colonna=exp(-xm*xm*520.)*(.5+.8*fbm(vec2(uv.y*14.-t*3.,t*.7)))*exp(-pow((uv.y-.47)/.34,2.))*fusione;
    o=over(vec4(vec3(.95,.82,1.)*colonna*.95,clamp(colonna*.55,0.,1.)),o);
    // il centro: un nucleo che cresce e pulsa
    vec2 dc=(uv-vec2(.5,.47))*vec2(asp,1.);
    float rc=length(dc);
    float nucleo=exp(-rc*rc*28.)*(.7+.3*sin(t*7.))*smoothstep(.3,1.6,t);
    o=over(vec4(vec3(1.,.95,.85)*nucleo,nucleo*.7),o);
    // scintille che schizzano dal centro verso i lati
    for(int j=0;j<10;j++){
      float fj=float(j); float cy=fract(t*.6+fj*.137); float an=(h(vec2(fj,floor(t*.6+fj*.137)))-.5)*1.2;
      float dir=mod(fj,2.)<.5?-1.:1.;
      vec2 pp=vec2(dir*cy*.55*asp*.7,sin(an)*cy*.35);
      float s=smoothstep(.012,0.,length(dc-pp))*(1.-cy)*smoothstep(.4,1.2,t);
      o+=vec4(vec3(1.,.85,.6)*s,s);
    }
    // impatto di DUEL!: onda d'urto e lampo
    if(imp>=0.){
      float ring=exp(-pow((rc-imp*1.5)/.05,2.))*exp(-imp*3.);
      float fl=exp(-rc*rc*8.)*exp(-imp*7.)*1.3;
      o+=vec4(vec3(1.,.93,.8)*(ring*1.2+fl),clamp(ring+fl,0.,1.));
    }
  } else if(modo<1.5){
    // ---------- VITTORIA: oro che sale ----------
    vec2 dc=(uv-vec2(.5,.42))*vec2(asp,1.); float rc=length(dc);
    float respiro=.78+.22*sin(t*1.3);
    float alone=exp(-rc*rc*3.6)*respiro*smoothstep(0.,.8,t);
    o=over(vec4(vec3(1.,.8,.35)*alone*.55,alone*.4),o);
    // colonne di luce che salgono dal basso
    for(int j=0;j<7;j++){
      float fj=float(j); float x=.1+.8*h(vec2(fj,3.))+.03*sin(t*.4+fj*2.);
      float w=.012+.02*h(vec2(fj,9.));
      float colonna=exp(-pow((uv.x-x)*asp/w,2.))*pow(1.-uv.y,1.4)*smoothstep(0.,.3,uv.y+.2);
      float fl=.55+.45*sin(t*(.8+fj*.17)+fj*3.);
      float a=colonna*fl*.2*smoothstep(.3,1.4,t);
      o+=vec4(vec3(1.,.82,.4)*a,a*.5);
    }
    // anello d'arrivo
    float ring=exp(-pow((rc-t*.7)/.06,2.))*exp(-t*1.4)*1.1;
    o+=vec4(vec3(1.,.88,.55)*ring,clamp(ring,0.,1.));
    // braci
    o=over(particelle(uv,asp,t,vec3(1.,.78,.32),.12,.0,9.,.07,1.,.35),o);
    o=over(particelle(uv,asp,t+7.,vec3(1.,.95,.75),.2,.02,15.,.04,1.,.25),o);
  } else if(modo<2.5){
    // ---------- SCONFITTA: cenere e nebbia fredda ----------
    float nebbia=fbm(vec2(uv.x*asp*1.4-t*.04,uv.y*1.6+t*.02)+fbm(uv*2.+t*.03)*.8);
    float nb=smoothstep(.42,.9,nebbia)*.3*smoothstep(0.,1.,t);
    o=over(vec4(vec3(.32,.4,.55)*nb,nb*.8),o);
    // bagliore lontano di tempesta, ogni tanto
    float ciclo=mod(t,7.); float lamp=exp(-pow((ciclo-3.2)*5.,2.))*.5+exp(-pow((ciclo-3.55)*8.,2.))*.3;
    float dir=exp(-pow((uv.x-.78)*1.6,2.))*(1.-uv.y*.6);
    o+=vec4(vec3(.5,.62,.9)*lamp*dir*.35,lamp*dir*.2);
    // cenere che cade
    o=over(particelle(uv,asp,t,vec3(.62,.66,.74),-.1,.015,8.,.06,0.,.4),o);
    o=over(particelle(uv,asp,t+11.,vec3(.8,.84,.92),-.18,.02,13.,.035,1.,.3),o);
  } else {
    // ---------- PAREGGIO: pulviscolo neutro ----------
    float nebbia=fbm(vec2(uv.x*asp*1.2+t*.03,uv.y*1.4)+t*.02);
    float nb=smoothstep(.45,.9,nebbia)*.2;
    o=over(vec4(vec3(.6)*nb,nb*.7),o);
    o=over(particelle(uv,asp,t,vec3(.82,.82,.82),.03,.03,9.,.05,1.,.45),o);
    o=over(particelle(uv,asp,t+5.,vec3(1.),.05,.02,14.,.035,1.,.3),o);
  }
  gl_FragColor=o;
}`;

    function menoMovimento() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /**
     * Monta lo sfondo WebGL dentro un overlay. Torna una funzione che lo spegne (si spegne anche da sola quando
     * l'overlay lascia il documento). Torna null se WebGL non c'e' (l'overlay resta col suo sfondo sfumato).
     * @param {HTMLElement} overlay @param {'intro'|'won'|'lost'|'draw'} scena @param {{ impattoMs?: number }} [opz]
     */
    function monta(overlay, scena, opz) {
        if (!overlay || window.DUEL_FX_WEBGL_OFF) return null;
        const o = opz || {};
        const cv = document.createElement('canvas');
        cv.className = 'dfx-gl';
        cv.setAttribute('aria-hidden', 'true');
        cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block;';
        const gl = /** @type {WebGLRenderingContext|null} */ (cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }));
        if (!gl) return null;
        const pr = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        if (!pr || pr.precision === 0) return null;
        const sh = (tipo, src) => { const s = /** @type {WebGLShader} */ (gl.createShader(tipo)); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
        const vs = sh(gl.VERTEX_SHADER, VS); const fs = sh(gl.FRAGMENT_SHADER, FS);
        if (!vs || !fs) return null;
        const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
        gl.useProgram(prog);
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        const uR = gl.getUniformLocation(prog, 'r'); const uT = gl.getUniformLocation(prog, 't');
        const uM = gl.getUniformLocation(prog, 'modo'); const uI = gl.getUniformLocation(prog, 'imp');
        const modo = { intro: 0, won: 1, lost: 2, draw: 3 }[scena] || 0;
        let scala = window.innerWidth <= 900 ? 0.4 : 0.5;
        const misura = () => {
            cv.width = Math.max(64, Math.round(window.innerWidth * scala)); cv.height = Math.max(64, Math.round(window.innerHeight * scala));
            gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(uR, cv.width, cv.height);
        };
        misura();
        overlay.insertBefore(cv, overlay.firstChild);
        const t0 = performance.now();
        const tImpatto = o.impattoMs == null ? -1 : t0 + o.impattoMs;
        let rid = 0; let media = 16; let ultimo = 0; let lentoDa = 0; let spento = false;
        const disegna = (ora) => {
            const t = (ora - t0) / 1000;
            gl.uniform1f(uT, t); gl.uniform1f(uM, modo);
            gl.uniform1f(uI, tImpatto >= 0 && ora >= tImpatto ? (ora - tImpatto) / 1000 : -1);
            gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        };
        const spegni = () => {
            if (spento) return; spento = true; cancelAnimationFrame(rid);
            const ext = gl.getExtension('WEBGL_lose_context'); if (cv.parentNode) cv.remove(); if (ext) ext.loseContext();
        };
        const ciclo = (ora) => {
            if (spento) return;
            if (!overlay.isConnected) { spegni(); return; }
            if (ultimo) media = media * 0.9 + Math.min(200, ora - ultimo) * 0.1;
            ultimo = ora;
            // Regolatore: se il dispositivo non regge si scende di risoluzione e poi ci si spegne.
            if (media > 46) { if (!lentoDa) lentoDa = ora; if (ora - lentoDa > 1800) { lentoDa = 0; media = 16; if (scala > 0.26) { scala *= 0.7; misura(); } else { spegni(); return; } } } else lentoDa = 0;
            disegna(ora);
            rid = requestAnimationFrame(ciclo);
        };
        if (menoMovimento()) { disegna(t0 + (modo === 0 ? 1800 : 2200)); } else { rid = requestAnimationFrame(ciclo); }
        return spegni;
    }

    window.DuelFxWebgl = { monta: monta };
})();
