// @ts-check
/**
 * icone-posizione-webgl.js — le icone Attacco/Difesa animate in WebGL.
 * ------------------------------------------------------------------
 * Quando si evoca un mostro il popover offre due pulsanti tondi: spada (Attacco) e scudo (Difesa).
 * Qui le due icone statiche diventano piccole scene animate: due spade che calano, si incrociano
 * con un lampo e un anello d'urto, e uno scudo che si forma, respira e viene attraversato da un
 * riflesso. Stessa scelta del resto dei backend WebGL (js/ui/fx-webgl.js): se WebGL manca, o
 * l'utente ha chiesto meno movimento, l'icona di prima resta com'e' (senza WebGL) o diventa un solo fotogramma fermo.
 *
 * COME FUNZIONA. UN solo contesto WebGL fuori schermo disegna entrambe le icone a turno e ognuna viene
 * copiata (drawImage) nel suo <canvas> 2D dentro il pulsante: cosi' un popover con due icone non costa
 * due contesti, e il ciclo gira solo finche' c'e' un'icona agganciata al documento (si ferma da solo
 * quando il popover viene chiuso).
 *
 * USO. `IconePosizione.monta(radice)` sostituisce, dentro `radice`, ogni `[data-icon="attackPos"]` e
 * `[data-icon="defensePos"]`. Si chiama dopo aver creato il popover (actions.js).
 */
(function () {
    'use strict';

    const LATO = 128; // pixel del contesto fuori schermo (le icone sono ~34 px CSS: basta e avanza anche a 3x)
    const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 r; uniform float t; uniform float modo; uniform float fase;
// modo: 0 spade, 1 scudo, 2 scintilla (Attiva effetto), 3 annulla, 4 conferma, 5 carta (seleziona), 6 evocazione.
// fase: 0..1 per una scena singola (sulla carta in campo); -1 = ciclo continuo che si ripete (pulsanti).
const float PI=3.14159265;
float easeOut(float x){x=clamp(x,0.,1.);return 1.-pow(1.-x,3.);}
float easeIO(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}
float stella(vec2 q){return 1./(1.+abs(q.x*q.y)*70.)*exp(-dot(q,q)*3.2);}
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}

// Una spada con la punta in alto, centrata in (0,0): lama rastremata con nervatura, guardia, impugnatura, pomo.
vec4 spada(vec2 p,vec3 acciaio,vec3 bagliore){
  float lama=smoothstep(.02,-.006,max(abs(p.x)-.075*(1.-clamp((p.y-.05)/.6,0.,1.)*.92),max(-p.y+.0,p.y-.64)));
  float guardia=smoothstep(.02,-.006,max(abs(p.x)-.2,abs(p.y+.015)-.03));
  float elsa=smoothstep(.02,-.006,max(abs(p.x)-.032,abs(p.y+.17)-.14));
  float pomo=smoothstep(.02,-.006,length(p-vec2(0.,-.33))-.055);
  float nerv=exp(-pow(p.x/.018,2.))*lama;
  float lato=.5+.5*sign(p.x);
  vec3 lm=mix(acciaio*.62,acciaio*1.15,lato)+nerv*.35;
  vec3 oro=vec3(1.,.78,.3)*(.85+.25*(p.y+.2));
  vec3 col=lm*lama+oro*guardia+vec3(.45,.22,.1)*elsa+oro*pomo;
  float a=clamp(lama+guardia+elsa+pomo,0.,1.);
  float alo=exp(-pow(max(abs(p.x)-.075*(1.-clamp((p.y-.05)/.6,0.,1.)*.92),0.)/.05,2.))*step(-.02,p.y)*step(p.y,.66)*.5;
  return vec4(col*a+bagliore*alo*(1.-a),max(a,alo*.65));
}
vec4 ruota(vec2 p,vec2 c,float ang,float s,vec3 ac,vec3 bag){
  vec2 q=(p-c)/s; float cs=cos(ang),sn=sin(ang); q=vec2(cs*q.x+sn*q.y,-sn*q.x+cs*q.y);
  return spada(q,ac,bag);
}

void main(){
  vec2 p=(gl_FragCoord.xy/r)*2.-1.;
  vec4 o=vec4(0.);
  if(modo<.5){
    // ---- SPADE: calano dai due lati, si incrociano con un lampo, restano, svaniscono ----
    float ph=fase>=0.?fase:mod(t,2.6)/2.6;
    float dentro=easeOut(ph/.24);
    float fuori=1.-smoothstep(.86,1.,ph);
    float ang=mix(1.35,.66,dentro);                 // da quasi orizzontale a una X
    vec2 off=vec2(mix(.9,0.,dentro),mix(-.7,.0,dentro));
    vec3 ac=vec3(.86,.9,.98); vec3 bag=vec3(1.,.35,.28);
    vec4 s1=ruota(p,vec2(-off.x,off.y)+vec2(0.,.0),-ang,1.28,ac,bag);
    vec4 s2=ruota(p,vec2(off.x,off.y),ang,1.28,ac,bag);
    float sh=.5+.5*sin(t*6.);
    vec4 sw=s2+s1*(1.-s2.a);
    // brillio che corre sulle lame dopo l'impatto
    float after=smoothstep(.24,.3,ph);
    sw.rgb+=vec3(1.,.9,.75)*after*(.14+.12*sh)*sw.a*step(0.,p.y+p.x*.2);
    o=sw*fuori;
    // lampo e anello d'urto all'incrocio
    float c=ph-.24;
    if(c>0.){
      float d=length(p-vec2(0.,-.04));
      float fl=exp(-d*d*38.)*exp(-c*14.)*1.5;
      float ring=exp(-pow((d-c*1.6)/.05,2.))*exp(-c*7.)*1.2;
      vec3 sp=vec3(1.,.55,.35)*(fl+ring)+vec3(1.)*fl*.6;
      o+=vec4(sp,clamp(fl+ring,0.,1.))*fuori*(1.-o.a*.4);
    }
    // scintille che schizzano
    for(int j=0;j<7;j++){
      float fj=float(j); float an=fj*.9+.3; float v=.55+.35*fract(fj*.37);
      float tt=ph-.24; if(tt>0.&&tt<.35){
        vec2 q=vec2(cos(an),sin(an))*v*easeOut(tt/.35)*.7+vec2(0.,-.04);
        float s=smoothstep(.045,.0,length(p-q))*(1.-tt/.35);
        o+=vec4(vec3(1.,.8,.5)*s,s);
      }
    }
  } else if(modo<1.5){
    // ---- SCUDO: si forma, respira, un riflesso lo attraversa ----
    float ph=fase>=0.?fase:mod(t,2.6)/2.6;
    float nasce=easeOut(ph/.22);
    float fuori=1.-smoothstep(.88,1.,ph);
    float resp=1.+.03*sin(t*3.2);
    vec2 q=p/(.95*resp*mix(.6,1.,nasce)); q.y+=.04;
    // forma a scudo: larga in alto, a punta in basso
    float w=.78*(1.-.5*smoothstep(-.1,1.,q.y+.0)) ;
    float yy=q.y;
    float forma=max(abs(q.x)-mix(.78,.05,smoothstep(-.1,.95,yy)),max(-yy-.82,yy-.82+.0));
    forma=max(forma,abs(q.x)-.78);
    float inside=smoothstep(.03,-.03,forma);
    float bordo=smoothstep(.09,.0,abs(forma+.045))*.9;
    vec3 base=mix(vec3(.12,.5,.32),vec3(.35,.95,.6),.5+.5*q.y);
    vec3 oro=vec3(1.,.82,.4);
    // croce / emblema al centro
    float croce=max(smoothstep(.07,.03,abs(q.x))*smoothstep(.5,.46,abs(q.y-.02)),smoothstep(.07,.03,abs(q.y-.02))*smoothstep(.42,.38,abs(q.x)))*inside;
    float gem=smoothstep(.12,.07,length(q-vec2(0.,.02)));
    vec3 col=base*inside*.85+oro*bordo+oro*croce*.8+vec3(.9,1.,.95)*gem*.5;
    // riflesso diagonale
    float diag=q.x*.8+q.y*.6-(ph*3.2-1.6);
    float riflesso=exp(-diag*diag*28.)*inside*.9;
    col+=vec3(.9,1.,.95)*riflesso;
    // anello che si espande alla nascita
    float d=length(q);
    float onda=exp(-pow((d-easeOut(ph/.5)*1.5)/.06,2.))*(1.-smoothstep(0.,.5,ph))*1.1;
    col+=vec3(.5,1.,.7)*onda;
    float a=clamp(inside+bordo+onda,0.,1.);
    // alone morbido
    float alo=exp(-max(forma,0.)*max(forma,0.)*40.)*.3*nasce;
    col+=vec3(.3,1.,.6)*alo*(1.-a);
    o=vec4(col*(1.-0.),clamp(a+alo*.6,0.,1.))*fuori;
  } else {
    // ---- ALTRE ICONE FLOTTANTI (scintilla, annulla, conferma, carta, evocazione) ----
    float ph=fase>=0.?fase:mod(t,2.6)/2.6;
    float fuori=1.-smoothstep(.88,1.,ph);
    float nasce=easeOut(ph/.2);
    if(modo<2.5){
      // SCINTILLA (Attiva effetto): stella a quattro punte che pulsa, con due piccole che brillano.
      float pul=1.+.12*sin(t*5.);
      float s1=stella(p/(.85*pul*mix(.35,1.,nasce)));
      float s2=stella((p-vec2(.58,.52))/(.34*(.6+.4*sin(t*4.+1.))));
      float s3=stella((p-vec2(-.6,-.48))/(.28*(.6+.4*sin(t*4.+3.))));
      float s=s1+s2*.8+s3*.7;
      float ring=exp(-pow((length(p)-easeOut(ph/.45)*.85)/.07,2.))*(1.-smoothstep(0.,.45,ph));
      vec3 col=mix(vec3(1.,.78,.3),vec3(1.,.97,.85),clamp(s*s,0.,1.))*s+vec3(1.,.8,.4)*ring;
      o=vec4(col,clamp(s*1.1+ring,0.,1.))*fuori;
    } else if(modo<3.5){
      // ANNULLA: una croce che si traccia e pulsa.
      float k1=easeOut(ph/.16); float k2=easeOut((ph-.1)/.16);
      vec2 a1=vec2(-.5,.5); vec2 a2=vec2(.5,.5);
      float d=min(seg(p,a1,mix(a1,vec2(.5,-.5),k1)),seg(p,a2,mix(a2,vec2(-.5,-.5),k2)));
      float pul=1.+.08*sin(t*5.);
      float core=smoothstep(.095*pul,.06*pul,d); float glow=exp(-d*d*55.)*.7;
      vec3 col=vec3(.88,.92,1.)*core+vec3(.55,.65,1.)*glow;
      o=vec4(col,clamp(core+glow*.6,0.,1.))*fuori;
    } else if(modo<4.5){
      // CONFERMA: il segno di spunta si traccia e poi un anello si espande.
      vec2 A=vec2(-.52,.02); vec2 B=vec2(-.16,-.4); vec2 C=vec2(.56,.5);
      float k1=easeOut(ph/.18); float k2=easeOut((ph-.14)/.22);
      float d=min(seg(p,A,mix(A,B,k1)),seg(p,B,mix(B,C,k2)));
      float c=max(ph-.4,0.);
      float ring=exp(-pow((length(p)-c*2.)/.07,2.))*exp(-c*4.)*step(.4,ph);
      float core=smoothstep(.1,.065,d); float glow=exp(-d*d*50.)*.75;
      vec3 col=vec3(.8,.97,1.)*core+vec3(.35,.7,1.)*glow+vec3(.5,.85,1.)*ring;
      o=vec4(col,clamp(core+glow*.6+ring,0.,1.))*fuori;
    } else if(modo<5.5){
      // CARTA (seleziona): dorso di carta che fluttua con un riflesso che la attraversa.
      vec2 q=p; q.y+=.04*sin(t*3.); float ang=-.22; float cs=cos(ang),sn=sin(ang); q=vec2(cs*q.x+sn*q.y,-sn*q.x+cs*q.y); q/=mix(.5,1.,nasce);
      vec2 b=abs(q)-vec2(.44,.62); float sd=length(max(b,0.))+min(max(b.x,b.y),0.)-.06;
      float body=smoothstep(.025,-.025,sd);
      float bordo=smoothstep(.055,0.,abs(sd+.05));
      float l=length(q/vec2(.26,.38)); float ovale=exp(-pow((l-1.)/.14,2.))*.8+exp(-l*l*3.)*.2;
      float riflesso=exp(-pow((q.x*.7+q.y*.5-(ph*2.6-1.3))/.12,2.))*body;
      vec3 col=vec3(.42,.17,.1)*body+vec3(1.,.78,.3)*bordo+vec3(1.,.7,.3)*ovale*body+vec3(1.,.95,.85)*riflesso*.8;
      o=vec4(col,clamp(body+bordo,0.,1.))*fuori;
    } else {
      // EVOCAZIONE (triangolo): piramide che si accende, con un raggio che sale dalla punta.
      float sc=mix(.5,1.,nasce); vec2 q=p/sc;
      vec2 ap=vec2(0.,.55);
      float d=max(max(-q.y-.4,dot(q-ap,vec2(.885,.466))),dot(q-ap,vec2(-.885,.466)));
      float fill=smoothstep(.03,-.03,d); float edge=smoothstep(.06,0.,abs(d+.05));
      float pul=.75+.25*sin(t*4.);
      vec3 base=mix(vec3(.9,.2,.12),vec3(1.,.7,.3),clamp((q.y+.4)/.95,0.,1.));
      float beam=exp(-q.x*q.x*45.)*smoothstep(.5,.62,q.y)*exp(-(q.y-.55)*1.4)*pul;
      float glow=exp(-max(d,0.)*max(d,0.)*40.)*.35;
      vec3 col=base*fill*(.55+.35*pul)+vec3(1.,.85,.5)*edge+vec3(1.,.8,.45)*beam+vec3(1.,.4,.2)*glow*(1.-fill);
      o=vec4(col,clamp(fill+edge+beam*.7+glow*.5,0.,1.))*fuori;
    }
  }
  gl_FragColor=o;
}`;

    /** Le altre icone flottanti, per nome (attributo data-ico). Il testo dentro lo span (l'emoji di prima) resta finche' non si monta. */
    const MODI = { spark: 2, cancel: 3, ok: 4, card: 5, summon: 6 };

    /** @type {HTMLCanvasElement|null} */ let off = null;
    /** @type {WebGLRenderingContext|null} */ let gl = null;
    let prog = null; let u = {};
    let pronto = null;
    /** @type {{ cv: HTMLCanvasElement, ctx: CanvasRenderingContext2D, modo: number, t0: number, dur?: number }[]} */
    let icone = [];
    let rid = 0;

    function menoMovimento() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function prepara() {
        if (pronto !== null) return pronto;
        pronto = false;
        try {
            off = document.createElement('canvas'); off.width = LATO; off.height = LATO;
            gl = /** @type {WebGLRenderingContext|null} */ (off.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false }));
            if (!gl) return false;
            const prec = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
            if (!prec || prec.precision === 0) return false;
            const sh = (tipo, src) => { const o = /** @type {WebGLShader} */ (gl.createShader(tipo)); gl.shaderSource(o, src); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
            const vs = sh(gl.VERTEX_SHADER, VS); const fs = sh(gl.FRAGMENT_SHADER, FS);
            if (!vs || !fs) return false;
            prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
            gl.useProgram(prog);
            const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
            const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
            gl.viewport(0, 0, LATO, LATO); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            ['r', 't', 'modo', 'fase'].forEach((n) => { u[n] = gl.getUniformLocation(prog, n); });
            gl.uniform2f(u.r, LATO, LATO);
            off.addEventListener('webglcontextlost', (e) => { e.preventDefault(); pronto = false; fermaCiclo(); });
            pronto = true;
        } catch (e) { pronto = false; }
        return pronto;
    }

    function disegna(ic, t) {
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(u.t, t); gl.uniform1f(u.modo, ic.modo);
        gl.uniform1f(u.fase, ic.dur ? Math.min(1, t / ic.dur) : -1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        ic.ctx.clearRect(0, 0, ic.cv.width, ic.cv.height);
        ic.ctx.drawImage(off, 0, 0, ic.cv.width, ic.cv.height);
    }

    function ciclo(ora) {
        // Le scene singole (sulla carta) escono da sole alla fine della loro durata.
        icone = icone.filter((ic) => ic.cv.isConnected && !(ic.dur && (ora - ic.t0) / 1000 > ic.dur + 0.05) || (ic.dur && ic.cv.remove(), false));
        if (!icone.length || !pronto) { rid = 0; return; }
        icone.forEach((ic) => disegna(ic, (ora - ic.t0) / 1000));
        rid = requestAnimationFrame(ciclo);
    }
    function fermaCiclo() { cancelAnimationFrame(rid); rid = 0; icone = []; }

    /**
     * Sostituisce le icone Attacco/Difesa dentro `radice` con le versioni animate.
     * Non fa nulla (e lascia le icone di prima) se WebGL manca o c'e' la richiesta di meno movimento.
     * @param {ParentNode} radice
     */
    function monta(radice) {
        if (!radice || window.ICONE_POSIZIONE_WEBGL_OFF) return false;
        const spade = radice.querySelectorAll('[data-icon="attackPos"]');
        const scudi = radice.querySelectorAll('[data-icon="defensePos"]');
        const altre = radice.querySelectorAll('[data-ico]');
        if (!spade.length && !scudi.length && !altre.length) return false;
        if (!prepara()) return false;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const crea = (el, modo) => {
            const cv = document.createElement('canvas');
            const lato = 34;
            cv.width = Math.round(lato * dpr); cv.height = Math.round(lato * dpr);
            cv.style.cssText = `width:${lato}px;height:${lato}px;display:block;pointer-events:none;`;
            cv.setAttribute('aria-hidden', 'true');
            const ctx = cv.getContext('2d');
            if (!ctx) return;
            el.removeAttribute('data-icon'); // cosi' icon-library non la sostituisce di nuovo
            el.removeAttribute('data-ico');
            el.textContent = ''; el.appendChild(cv);
            const ic = { cv: cv, ctx: ctx, modo: modo, t0: performance.now() };
            if (menoMovimento()) { disegna(ic, 0.55); return; } // un solo fotogramma, fermo
            icone.push(ic); disegna(ic, 0);
        };
        spade.forEach((el) => crea(el, 0));
        scudi.forEach((el) => crea(el, 1));
        altre.forEach((el) => { const m = MODI[el.getAttribute('data-ico')]; if (m !== undefined) crea(el, m); });
        if (icone.length && !rid) rid = requestAnimationFrame(ciclo);
        return true;
    }

    /**
     * Una scena singola di ~1,1 s SOPRA la carta appena messa in Attacco (due spade che si incrociano)
     * o in Difesa (lo scudo che si forma). E' un canvas fisso sullo schermo, non figlio della carta:
     * il Terreno viene ridisegnato di continuo e un nodo figlio sparirebbe a meta'.
     * Torna false (e il chiamante usa il vecchio distintivo) se WebGL manca o c'e' meno movimento.
     * @param {HTMLElement} cardEl @param {'attack'|'defense'} posizione
     */
    function sullaCarta(cardEl, posizione) {
        if (!cardEl || window.ICONE_POSIZIONE_WEBGL_OFF || menoMovimento() || !prepara()) return false;
        const r = cardEl.getBoundingClientRect();
        if (!r.width) return false;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        // Una carta in Difesa e' ruotata: il suo rettangolo e' orizzontale, ma l'icona sta in un quadrato.
        const lato = Math.max(r.width, r.height) * 1.25;
        const cv = document.createElement('canvas');
        cv.width = Math.round(lato * dpr); cv.height = Math.round(lato * dpr);
        cv.style.cssText = 'position:fixed;left:' + (r.left + r.width / 2 - lato / 2) + 'px;top:' + (r.top + r.height / 2 - lato / 2)
            + 'px;width:' + lato + 'px;height:' + lato + 'px;pointer-events:none;z-index:10040;';
        cv.setAttribute('aria-hidden', 'true');
        const ctx = cv.getContext('2d'); if (!ctx) return false;
        document.body.appendChild(cv);
        const ic = { cv: cv, ctx: ctx, modo: posizione === 'defense' ? 1 : 0, t0: performance.now(), dur: 1.1 };
        icone.push(ic); disegna(ic, 0);
        if (!rid) rid = requestAnimationFrame(ciclo);
        setTimeout(() => cv.remove(), 1400);
        return true;
    }

    window.IconePosizione = { monta: monta, sullaCarta: sullaCarta, attive: () => icone.length };
})();
