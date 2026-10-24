/**
 * monster-hologram-webgl.js — gli ologrammi dei mostri disegnati in WebGL.
 * ------------------------------------------------------------------------
 * Gli ologrammi CSS (js/ui/monster-hologram.js/.css) sono un'immagine con una maschera, una tinta e
 * una scanline. Qui la stessa idea ha una vera resa da proiezione: UN canvas dentro lo stesso
 * `#monsterHologramLayer` disegna ogni mostro come TEXTURE dell'illustrazione, con
 *   - aberrazione cromatica (i canali RGB si sdoppiano) e, ogni tanto, un GLITCH: strisce che scivolano di
 *     lato per un attimo, come un segnale instabile;
 *   - due strati arretrati e più scuri, che danno spessore alla figura (profondità finta ma vera);
 *   - scanline fini che scorrono e una banda di luce che attraversa la figura dal basso;
 *   - un ingresso da SCANNER: la figura si compone dal basso verso l'alto, con una linea luminosa sul fronte;
 *   - la base luminosa che la "attacca" alla carta, e il galleggiamento con l'inclinazione di prima.
 *
 * LO STATO È DI MONSTER-HOLOGRAM.JS. Questo file non decide quali mostri hanno un ologramma, né dove:
 * riceve la lista già pronta (`aggiorna`) e la disegna. Sparisce un mostro dal Terreno, sparisce da qui.
 *
 * SE NON SI PUÒ, SI TORNA AL CSS. `disponibile()` è falso senza WebGL, con il movimento ridotto, con
 * `window.OLOGRAMMA_WEBGL_OFF`, o dopo un guasto. Un guasto può arrivare anche a gioco avviato — contesto
 * perso (su telefono i contesti sono pochi) o texture rifiutata (su `file://` le immagini non si possono
 * usare come texture: il browser le considera di un'altra origine): in quel caso il modulo si spegne da
 * solo, toglie il suo canvas e chiede a MonsterHolograms di ridisegnare con il CSS. Online (https) e su un
 * server locale le texture funzionano.
 */
(function () {
    'use strict';

    const VS = `
attribute vec2 aPos; attribute vec2 aUv;
uniform vec2 uRes;
varying vec2 vUv;
void main(){ vec2 c=aPos/uRes*2.-1.; gl_Position=vec4(c.x,-c.y,0.,1.); vUv=aUv; }`;

    const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uT;        // secondi dall'avvio del modulo
uniform float uSeed;     // un numero per ologramma: desincronizza glitch e riflessi
uniform float uBorn;     // secondi dalla comparsa (l'ingresso da scanner)
uniform float uAsp;      // larghezza/altezza del riquadro
uniform float uImgAsp;   // larghezza/altezza dell'illustrazione
uniform float uAlpha;    // 0..1: per far sparire/riapparire senza scatti
uniform float uPx;       // pixel CSS per pixel del canvas (le scanline sono in px CSS)
uniform float uGlitch;   // 0..1: durante il volo glitch e aberrazione sono al massimo
uniform float uDis;      // -1 = intero; 0..1 = disintegrazione dal basso verso l'alto

float h(float n){return fract(sin(n*91.3458)*47453.5453);}

// L'illustrazione 'contain' nel riquadro (come object-fit: contain): rgb + QUANTO il punto è visibile.
// I BORDI NON SI DEVONO VEDERE (le illustrazioni sono rettangoli pieni, e non se ne possono rifare senza bordo):
// la visibilità non è un sì/no al limite dell'immagine ma una SFUMATURA calcolata sull'immagine stessa —
//   1) ogni lato sfuma per il ~26% verso l'esterno, e agli angoli i due effetti si MOLTIPLICANO: lì si perde di più;
//   2) un ovale centrato sull'immagine mangia del tutto gli angoli, che sono la parte più dura da nascondere.
// Il taglio netto "fuori dall'immagine" (che dava il bordo seghettato) non esiste più: si arriva a zero PRIMA.
vec4 campiona(vec2 uv){
  vec2 s=vec2(min(1.,uImgAsp/uAsp),min(1.,uAsp/uImgAsp));
  vec2 q=(uv-.5)/s+.5;
  vec2 e=min(q,1.-q);
  float f=smoothstep(0.,.14,e.x)*smoothstep(0.,.14,e.y);
  float r=length((q-.5)*2.);
  f*=1.-smoothstep(.92,1.38,r);
  // Il soggetto (chiaro, saturo) a ridosso del bordo non va smussato: la sfumatura serve a nascondere lo SFONDO
  // (di solito scuro). Dove il pixel e' luminoso o colorato la sfumatura si attenua, e la testa resta intera.
  vec3 tx=texture2D(uTex,clamp(q,.002,.998)).rgb;
  float lum=dot(tx,vec3(.299,.587,.114));
  float sat=max(tx.r,max(tx.g,tx.b))-min(tx.r,min(tx.g,tx.b));
  float soggetto=max(smoothstep(.38,.72,lum),smoothstep(.30,.60,sat)*.7);
  float inDentro=step(0.,q.x)*step(q.x,1.)*step(0.,q.y)*step(q.y,1.);
  f=mix(f,max(f,.95),soggetto*.9)*inDentro;
  if(f<=0.) return vec4(0.);
  return vec4(tx,f);
}

void main(){
  vec2 uv=vUv;
  // GLITCH: ogni tanto, per una frazione di secondo, strisce orizzontali che scivolano e canali che si separano.
  float gt=uT*.45+uSeed*7.;
  float ev=floor(gt);
  float gl=max(step(.94,fract(gt))*step(.55,h(ev+uSeed)),uGlitch);
  float banda=floor(uv.y*16.);
  float sh=(h(banda*1.7+ev+floor(uT*30.)*uGlitch)-.5)*(.10+.08*uGlitch)*gl;
  float ca=.0035+gl*.012+uGlitch*.016;
  vec2 u2=uv+vec2(sh,0.);
  vec4 a=campiona(u2+vec2(ca,0.));
  vec4 b=campiona(u2);
  vec4 c3=campiona(u2-vec2(ca,0.));
  vec3 col=vec3(a.r,b.g,c3.b);
  float cov=b.a;

  // PROFONDITA': due copie piu' grandi e scure, appena spostate, dietro la figura.
  vec2 off=vec2(sin(uT*.8+uSeed)*.012,.018);
  vec4 l1=campiona((u2-.5)*1.06+.5+off);
  vec4 l2=campiona((u2-.5)*1.12+.5+off*2.);
  vec3 dietro=(l1.rgb*.22+l2.rgb*.12)*vec3(.5,.9,1.1);
  float cb=max(l1.a*.5,l2.a*.35);

  // La tinta: l'arte vira al ciano e perde contrasto, come uno schermo che la proietta.
  float lum=dot(col,vec3(.299,.587,.114));
  col=mix(vec3(lum),col,.68)*vec3(.88,1.04,1.16)*1.12;
  col+=dietro*(1.-cov);
  float coperto=max(cov,cb*.6);

  // La maschera: il centro pieno, i bordi che si perdono nell'aria (la stessa dell'ologramma CSS).
  // (La sfumatura vera dei bordi sta in campiona(); questa maschera sul riquadro resta solo per far svanire anche la
  // base dell'ologramma e il galleggiamento verso l'aria, ed è più larga di prima: non fa più da bordo.)
  float d=length((uv-vec2(.5,.46))/vec2(.62,.70));
  float m=1.-smoothstep(.5,1.,d);
  m=m*(.6+.4*m);
  float alpha=coperto*m*.9;

  // Scanline fini che scorrono, e una banda di luce che sale attraversando la figura.
  float yPx=gl_FragCoord.y*uPx;
  float sl=smoothstep(.55,.9,fract((yPx+uT*28.)/4.));
  col*=1.-.18*sl;
  col+=vec3(.59,.9,1.)*.10*sl*alpha;
  float sw=exp(-pow((uv.y-(1.3-fract(uT*.22+uSeed)*1.3)-.15)*9.,2.))*.35;
  col+=vec3(.5,.9,1.)*sw*alpha;

  // INGRESSO DA SCANNER: la figura si compone dal basso verso l'alto, con una linea luminosa sul fronte.
  float r=clamp(uBorn/.7,0.,1.);
  float yb=1.-uv.y;
  float fronte=r*1.12;
  float vis=smoothstep(fronte+.03,fronte-.05,yb);
  float linea=exp(-pow((yb-fronte)*28.,2.))*step(r,.999)*1.4;
  alpha*=vis;

  // LA BASE: il fascio che attacca la figura alla carta.
  float bx=(uv.x-.5)/.43;
  float by=(1.-uv.y)/.26;
  // La luce è al massimo in basso: senza una dissolvenza propria si taglierebbe in una riga netta sul bordo del riquadro.
  float base=exp(-bx*bx*1.6)*exp(-by*by*1.3)*.62*(.75+.25*sin(uT*2.4+uSeed))
            *smoothstep(1.,.84,uv.y)*smoothstep(0.,.1,uv.x)*smoothstep(1.,.9,uv.x);
  vec3 bc=vec3(.47,.84,1.);

  // DISINTEGRAZIONE: un fronte frastagliato sale dal basso e cio' che sta sotto sparisce; sul fronte, una linea incandescente.
  float visD=1.,fuoco=0.;
  if(uDis>=0.){
    float lim=1.-uDis*1.12+(h(floor(uv.x*46.)+uSeed)-.5)*.07;
    visD=1.-smoothstep(lim-.01,lim+.04,yb);
    fuoco=exp(-pow((yb-lim)*22.,2.))*step(uDis,.995);
  }
  alpha*=visD; base*=visD;
  float aa=clamp(alpha+base*.9+linea*m+fuoco*m,0.,1.)*uAlpha;
  vec3 rgb=(col*alpha+bc*base+vec3(.7,1.,1.)*linea*m+vec3(1.,.55,.18)*fuoco*m*1.5)*uAlpha;
  gl_FragColor=vec4(min(rgb,vec3(aa+.3)),aa);
}`;

    // ---------------------------------------------------------------------------------------------
    // CARTA SETTATA (coperta): un riflesso che attraversa il dorso e un respiro di luce sul bordo, e un lampo quando si scopre.
    // Nello STESSO canvas degli ologrammi (un contesto WebGL in meno: sui telefoni sono pochi), con un programma suo,
    // SENZA texture — quindi funziona anche su file://, dove gli ologrammi no.
    // REGOLA DI GIOCO, non di grafica: l'effetto e' IDENTICO per ogni carta coperta. Un colore diverso per Magia, Trappola
    // o mostro direbbe all'avversario cos'e' una carta Settata, quindi qui non arriva nemmeno il tipo: solo dove sta.
    // ---------------------------------------------------------------------------------------------
    const FS_SETTATA = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform float uT;      // secondi dall'avvio del modulo
uniform float uSeed;   // sfasa una carta dall'altra
uniform float uAsp;    // larghezza/altezza della carta
uniform float uFlash;  // -1: nessun lampo; 0..1: avanzamento del lampo di rivelazione
uniform float uAlpha;

// distanza con segno da un rettangolo arrotondato (negativa dentro)
float rr(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }

void main(){
  vec2 p=(vUv-.5)*vec2(uAsp,1.);
  if(uFlash>=0.){
    // RIVELAZIONE: un anello che si apre dal centro e un lampo caldo che svanisce.
    float u=uFlash; float r=length(p);
    float ring=exp(-pow((r-.25-u*.9)*7.,2.))*(1.-u);
    float core=exp(-r*r*5.)*(1.-u)*(1.-u)*1.3;
    float a=clamp(ring*.9+core,0.,1.)*uAlpha;
    vec3 c=mix(vec3(1.,.82,.45),vec3(1.),core);
    gl_FragColor=vec4(c*a,a);
    return;
  }
  float d=rr(p,vec2(uAsp,1.)*.5,.075);
  float dentro=1.-smoothstep(-.01,.004,d);
  // il fascio di luce: ogni ~5,5 s attraversa il dorso in diagonale, poi riposa
  float ph=fract(uT/5.5+uSeed);
  float va=clamp(ph/.5,0.,1.); float attivo=1.-step(.5,ph);
  float s=dot(vUv,vec2(.62,.78))/1.4;
  float pos=-.3+va*1.6;
  float fascio=exp(-pow((s-pos)*6.5,2.))*attivo*(sin(va*3.14159));
  // il respiro del bordo: appena percepibile, mai fermo del tutto
  float respiro=.5+.5*sin(uT*1.6+uSeed*6.283);
  float bordo=exp(-pow(d/.03,2.))*(.38+.34*respiro);
  vec3 oro=vec3(1.,.84,.5);
  float a=clamp(fascio*.8*dentro+bordo,0.,1.)*uAlpha;
  gl_FragColor=vec4(mix(oro,vec3(1.),fascio*.6)*a,a);
}`;
    /** @type {WebGLProgram|null} */ let progS = null;
    /** @type {Record<string, WebGLUniformLocation|null>|null} */ let uniS = null;
    let guastoSettata = false;
    let ultimoDisegno = 0;
    /** Le carte coperte sul Terreno, per chiave (lato:zona:posto): { rect, seme }. */
    const settate = new Map();
    /** I lampi di rivelazione in corso: { rect, t0 }. */
    const lampi = [];

    /** @type {HTMLCanvasElement|null} */ let canvas = null;
    /** @type {WebGLRenderingContext|null} */ let gl = null;
    let prog = null;
    let uni = null;
    let bufPos = null;
    let guasto = false;
    let sospeso = false;
    let rid = 0;
    const t0 = performance.now();
    /** Texture per percorso immagine: { tex, w, h, stato: 'carico' | 'pronta' | 'errore' }. */
    const texture = new Map();
    /** Gli ologrammi vivi, per uid: rettangolo di destinazione, lato, comparsa, nascosto fino a. */
    const vivi = new Map();
    let ultimaScala = 1;

    function menoMovimento() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    /** Il contenitore degli ologrammi (lo crea monster-hologram.js se non esiste ancora: nasce con il primo). */
    function layer() {
        if (window.MonsterHolograms && typeof MonsterHolograms.layer === 'function') return MonsterHolograms.layer();
        // Pagine senza il duello (la Cartoteca, con la vetrina dell'ologramma): il livello lo crea questo modulo,
        // con lo stesso stile che gli darebbe monster-hologram.css.
        let el = document.getElementById('monsterHologramLayer');
        if (!el && document.body) {
            el = document.createElement('div');
            el.id = 'monsterHologramLayer';
            el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:30;overflow:hidden;';
            document.body.appendChild(el);
        }
        return el;
    }

    /** Crea canvas, contesto e programma, una volta sola. Torna false se non si può (e non ci riprova). */
    function assicura() {
        if (gl && canvas && canvas.isConnected) return true;
        if (guasto) return false;
        const host = layer();
        if (!host) return false;
        try {
            canvas = document.createElement('canvas');
            canvas.setAttribute('aria-hidden', 'true');
            canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
            gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
            if (!gl) throw new Error('niente-webgl');
            const prec = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
            if (!prec || prec.precision === 0) throw new Error('precisione');
            const compila = (tipo, src) => {
                const o = gl.createShader(tipo); gl.shaderSource(o, src); gl.compileShader(o);
                if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(o));
                return o;
            };
            prog = gl.createProgram();
            gl.attachShader(prog, compila(gl.VERTEX_SHADER, VS));
            gl.attachShader(prog, compila(gl.FRAGMENT_SHADER, FS));
            gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
            gl.useProgram(prog);
            uni = {};
            ['uRes', 'uTex', 'uT', 'uSeed', 'uBorn', 'uAsp', 'uImgAsp', 'uAlpha', 'uPx', 'uGlitch', 'uDis'].forEach((n) => { uni[n] = gl.getUniformLocation(prog, n); });
            bufPos = gl.createBuffer();
            // Il programma della carta Settata: se NON si compila, cade solo lui (niente riflesso), gli ologrammi restano.
            try {
                progS = gl.createProgram();
                gl.attachShader(progS, compila(gl.VERTEX_SHADER, VS));
                gl.attachShader(progS, compila(gl.FRAGMENT_SHADER, FS_SETTATA));
                gl.linkProgram(progS);
                if (!gl.getProgramParameter(progS, gl.LINK_STATUS)) throw new Error('link-settata');
                uniS = {};
                ['uRes', 'uT', 'uSeed', 'uAsp', 'uFlash', 'uAlpha'].forEach((n) => { /** @type {any} */ (uniS)[n] = gl.getUniformLocation(progS, n); });
            } catch (e) {
                progS = null; uniS = null; guastoSettata = true;
                if (window.console) console.warn('[carta Settata WebGL] disattivata:', e && e.message || e);
            }
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); rompi('contesto-perso'); });
            host.appendChild(canvas);
            adatta();
            return true;
        } catch (e) {
            rompi(String(e && e.message || e));
            return false;
        }
    }

    function adatta() {
        if (!canvas) return;
        // Risoluzione piena del dispositivo (con un tetto a 2): le figure sono piccole e l'arte si legge meglio nitida.
        const s = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(64, Math.round(window.innerWidth * s));
        const h = Math.max(64, Math.round(window.innerHeight * s));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        ultimaScala = s;
        if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', adatta);

    /** Un guasto: il modulo si spegne e MonsterHolograms torna agli ologrammi CSS, senza che il giocatore perda nulla. */
    function rompi(motivo) {
        guasto = true;
        if (rid) { cancelAnimationFrame(rid); rid = 0; }
        try {
            const ext = gl && gl.getExtension('WEBGL_lose_context');
            if (ext) ext.loseContext();
        } catch (e) { /* e' solo pulizia */ }
        if (canvas) canvas.remove();
        canvas = null; gl = null; prog = null; progS = null; uniS = null;
        vivi.clear(); settate.clear(); lampi.length = 0;
        if (window.console) console.warn('[ologrammi WebGL] disattivati, si torna al CSS:', motivo);
        if (window.MonsterHolograms && typeof MonsterHolograms.sync === 'function') setTimeout(() => MonsterHolograms.sync(), 0);
    }

    function caricaTexture(src) {
        let voce = texture.get(src);
        if (voce) return voce;
        voce = { tex: null, w: 1, h: 1, stato: 'carico' };
        texture.set(src, voce);
        const img = new Image();
        img.onload = () => {
            if (!gl || guasto) return;
            try {
                const tex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                voce.tex = tex; voce.w = img.naturalWidth || 1; voce.h = img.naturalHeight || 1; voce.stato = 'pronta';
                avvia();
            } catch (e) {
                // Tipico di file://: il browser non lascia usare come texture un'immagine di un'altra origine.
                rompi('texture-rifiutata: ' + (e && e.name || e));
            }
        };
        img.onerror = () => { voce.stato = 'errore'; };
        img.src = src;
        return voce;
    }

    function srcDi(card) {
        return typeof window.getCardImagePath === 'function' ? window.getCardImagePath(card) : '';
    }

    const DISCESA_S = 0.7;

    /**
     * Il volo d'attacco: spostamento (ox, oy) e scala al tempo `ora`, o null fuori dal volo.
     * Andata decelerata fino al bersaglio (impatto al 46%, come la rincorsa della carta), un attimo fermo,
     * ritorno morbido; lungo il percorso una curva ad arco (perpendicolare alla direzione) e una scala che cresce
     * avvicinandosi.
     */
    function posVolo(v, ora) {
        const p = (ora - v.t0) / v.dur;
        if (p < 0 || p > 1) return null;
        let s;
        if (p < 0.46) { const e = p / 0.46; s = 1 - Math.pow(1 - e, 2.2); }
        else if (p < 0.58) s = 1;
        else { const e = (p - 0.58) / 0.42; s = 1 - e * e * (3 - 2 * e); }
        const len = Math.hypot(v.dx, v.dy) || 1;
        const arco = Math.sin(Math.PI * s) * len * v.curva;
        return { ox: v.dx * s + (-v.dy / len) * arco, oy: v.dy * s + (v.dx / len) * arco, sc: 1 + 0.25 * s };
    }

    /** Disegna UN riquadro di ologramma (anche una copia-scia o uno che si disintegra). */
    function quad(o, voce, bob, ox, oy, sc, alpha, glitch, dis, nascita) {
        const r = o.rect;
        const cx = r.left + r.w / 2 + ox; const cy = r.top + r.h / 2 + bob + oy;
        const hw = r.w / 2 * sc; const hh = r.h / 2 * sc;
        const inset = r.w * 0.075 * sc;
        const insTop = o.segno > 0 ? inset : 0;
        const insBot = o.segno > 0 ? 0 : inset;
        const v = new Float32Array([
            cx - hw + insTop, cy - hh, 0, 0,
            cx + hw - insTop, cy - hh, 1, 0,
            cx - hw + insBot, cy + hh, 0, 1,
            cx + hw - insBot, cy + hh, 1, 1
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, v, gl.DYNAMIC_DRAW);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, voce.tex);
        gl.uniform1f(uni.uSeed, o.seme);
        gl.uniform1f(uni.uBorn, nascita);
        gl.uniform1f(uni.uAsp, r.w / r.h);
        gl.uniform1f(uni.uImgAsp, voce.w / voce.h);
        gl.uniform1f(uni.uAlpha, alpha);
        gl.uniform1f(uni.uGlitch, glitch);
        gl.uniform1f(uni.uDis, dis);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /** C'e' qualcosa da disegnare? Il ciclo si ferma da solo quando non c'e' niente (batteria). */
    function haLavoro() { return vivi.size > 0 || settate.size > 0 || lampi.length > 0; }

    /**
     * Le carte Settate e i lampi di rivelazione, dopo gli ologrammi. Un quadrato per carta, leggermente piu' grande
     * (il respiro del bordo esce un poco dalla carta); il lampo e' piu' ampio, perche' l'anello si apre oltre la carta.
     */
    function disegnaSettate(ora, t) {
        if (!progS || !uniS || (!settate.size && !lampi.length)) return;
        const u = /** @type {any} */ (uniS);
        gl.useProgram(progS);
        gl.uniform2f(u.uRes, window.innerWidth, window.innerHeight);
        gl.uniform1f(u.uT, t);
        gl.uniform1f(u.uAlpha, 1);
        const locPos = gl.getAttribLocation(progS, 'aPos');
        const locUv = gl.getAttribLocation(progS, 'aUv');
        gl.bindBuffer(gl.ARRAY_BUFFER, bufPos);
        gl.enableVertexAttribArray(locPos);
        gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(locUv);
        gl.vertexAttribPointer(locUv, 2, gl.FLOAT, false, 16, 8);
        const riquadro = (r, mx, my) => {
            const x0 = r.left - mx; const y0 = r.top - my; const x1 = r.left + r.w + mx; const y1 = r.top + r.h + my;
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x0, y0, 0, 0, x1, y0, 1, 0, x0, y1, 0, 1, x1, y1, 1, 1]), gl.DYNAMIC_DRAW);
            gl.uniform1f(u.uAsp, (r.w + mx * 2) / (r.h + my * 2));
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        };
        gl.uniform1f(u.uFlash, -1);
        settate.forEach((o) => {
            gl.uniform1f(u.uSeed, o.seme);
            riquadro(o.rect, o.rect.w * 0.08, o.rect.h * 0.08);
        });
        for (let i = lampi.length - 1; i >= 0; i--) {
            const l = lampi[i];
            const p = (ora - l.t0) / LAMPO_MS;
            if (p >= 1) { lampi.splice(i, 1); continue; }
            if (p < 0) continue;
            gl.uniform1f(u.uSeed, 0);
            gl.uniform1f(u.uFlash, p);
            riquadro(l.rect, l.rect.w * 0.9, l.rect.h * 0.9);
        }
        gl.useProgram(prog);
    }

    const LAMPO_MS = 650;

    function disegna(ora) {
        rid = 0;
        if (!gl || guasto || !canvas) return;
        if (sospeso) { rid = requestAnimationFrame(disegna); return; }
        // Con le sole carte Settate (nessun ologramma) 30 fotogrammi al secondo bastano: il riflesso e' lento.
        if (!vivi.size && !lampi.length && ora - ultimoDisegno < 33) { rid = requestAnimationFrame(disegna); return; }
        ultimoDisegno = ora;
        const t = (ora - t0) / 1000;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(prog);
        gl.uniform2f(uni.uRes, window.innerWidth, window.innerHeight);
        gl.uniform1f(uni.uT, t);
        gl.uniform1f(uni.uPx, 1 / ultimaScala);
        gl.uniform1i(uni.uTex, 0);
        const locPos = gl.getAttribLocation(prog, 'aPos');
        const locUv = gl.getAttribLocation(prog, 'aUv');
        gl.bindBuffer(gl.ARRAY_BUFFER, bufPos);
        gl.enableVertexAttribArray(locPos);
        gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(locUv);
        gl.vertexAttribPointer(locUv, 2, gl.FLOAT, false, 16, 8);
        let disegnati = 0;
        vivi.forEach((o) => {
            const voce = o.voce;
            if (!voce || voce.stato !== 'pronta') return;
            if (o.nascostoFinoA && ora < o.nascostoFinoA) return;
            const r = o.rect;
            // Galleggia come l'ologramma CSS (3,4 s, fino al -5% dell'altezza) e si inclina: il lato lontano e' piu' stretto.
            const bob = (0.5 - 0.5 * Math.cos(2 * Math.PI * (t / 3.4))) * -0.05 * r.h;
            const nascita = (ora - o.nato) / 1000;
            // INGRESSO: scende dall'alto componendosi (lo scanner dello shader sale nello stesso tempo).
            let ox = 0; let oy = 0; let sc = 1;
            if (nascita < DISCESA_S) {
                const e = 1 - Math.pow(1 - Math.max(0, nascita) / DISCESA_S, 3);
                oy = -(1 - e) * 0.45 * r.h; sc = 0.78 + 0.22 * e;
            }
            // DISINTEGRAZIONE (se in corso): 0..1, o -1 se intero. Prima del ritardo resta intero.
            let dis = -1;
            if (o.morente) {
                if (ora >= o.morente.t0 + o.morente.dur) { vivi.delete(o.uid); return; }
                dis = ora < o.morente.t0 ? -1 : (ora - o.morente.t0) / o.morente.dur;
            }
            const volo = o.volo ? posVolo(o.volo, ora) : null;
            if (o.volo && ora > o.volo.t0 + o.volo.dur) o.volo = null;
            if (volo) {
                // La scia: tre copie sbiadite dove l'ologramma era pochi istanti fa.
                for (let k = 3; k >= 1; k--) {
                    const g = posVolo(o.volo, ora - k * 42);
                    if (g) quad(o, voce, bob, g.ox, g.oy, g.sc, 0.34 / k, 1, -1, 9);
                }
                ox = volo.ox; oy = volo.oy; sc = volo.sc;
            }
            quad(o, voce, bob, ox, oy, sc, 1, volo ? 1 : 0, dis, nascita);
            disegnati++;
        });
        disegnaSettate(ora, t);
        if (haLavoro()) rid = requestAnimationFrame(disegna);
    }

    function avvia() { if (!rid && gl && !guasto && haLavoro()) rid = requestAnimationFrame(disegna); }

    window.MonsterHologramGL = {
        /** Si può usare adesso? Crea il contesto alla prima richiesta. */
        disponibile() {
            if (guasto || window.OLOGRAMMA_WEBGL_OFF || menoMovimento()) return false;
            // Su file:// le immagini non si possono usare come texture (origine diversa): inutile provare e aspettare
            // il rifiuto, che ritarderebbe di un po' la comparsa dell'ologramma CSS. Si va dritti al CSS.
            if (window.location && window.location.protocol === 'file:') return false;
            return assicura();
        },
        /**
         * La lista completa degli ologrammi che devono esistere ADESSO: [{ uid, owner, card, rect: { left, top, w, h } }].
         * Si aggiungono i nuovi (che partono dall'ingresso da scanner), si tolgono gli spariti, si riposizionano gli altri.
         */
        aggiorna(lista) {
            if (!this.disponibile()) return false;
            const attesi = new Set();
            const ora = performance.now();
            lista.forEach((e) => {
                attesi.add(e.uid);
                let o = vivi.get(e.uid);
                if (!o) {
                    const src = srcDi(e.card);
                    if (!src) return;
                    o = { uid: e.uid, voce: caricaTexture(src), nato: ora, seme: Math.random() * 10, segno: 1, rect: e.rect, nascostoFinoA: 0, volo: null, morente: null };
                    vivi.set(e.uid, o);
                }
                if (o.morente) return;   // si sta disintegrando: resta dov'e', non lo si riposiziona
                o.segno = e.owner === 'bot' ? -1 : 1;
                o.rect = e.rect;
            });
            // Un ologramma che si sta disintegrando sopravvive al mostro uscito dal Terreno: finisce da solo.
            vivi.forEach((o, uid) => { if (!attesi.has(uid) && !o.morente) vivi.delete(uid); });
            if (guasto) return false;
            avvia();
            return true;
        },
        /** La proiezione di UN mostro si spegne per un attimo (il mostro sta partendo all'attacco). */
        nascondiPer(uid, ms) {
            const o = vivi.get(uid);
            if (o) o.nascostoFinoA = performance.now() + ms;
        },
        /** Si vede adesso? (esiste, la texture e' pronta, non e' nascosto): serve a decidere se la carta deve restare ferma. */
        visibile(uid) {
            const o = vivi.get(uid);
            return !!(o && !guasto && o.voce && o.voce.stato === 'pronta' && !(o.nascostoFinoA && performance.now() < o.nascostoFinoA));
        },
        /**
         * L'ologramma parte dal suo slot verso il bersaglio (spostamento del CENTRO in px) e torna: arco, scia,
         * glitch al massimo. Torna true se lo ha preso in carico (allora la carta non si muove), false altrimenti.
         */
        lancia(uid, dx, dy, durMs, curva) {
            const o = vivi.get(uid);
            if (!this.visibile(uid) || o.morente) return false;
            // Traiettoria DRITTA (come la freccia d'attacco, scelta dell'utente): `curva` esiste ma di default e' zero.
            o.volo = { t0: performance.now(), dur: durMs || 700, dx, dy, curva: (curva || 0) * (o.segno > 0 ? 1 : -1) };
            avvia();
            return true;
        },
        /**
         * Il soggetto si disintegra: dopo `ritardoMs` il fronte sale dal basso in `durMs`. Torna il rettangolo
         * dell'ologramma (per centrare la polvere) o null se non c'e' un ologramma da disintegrare.
         */
        disintegra(uid, ritardoMs, durMs) {
            const o = vivi.get(uid);
            if (!o || guasto || !o.voce || o.voce.stato !== 'pronta') return null;
            if (o.morente) return { left: o.rect.left, top: o.rect.top, width: o.rect.w, height: o.rect.h };   // gia' in corso: una sola volta
            o.nascostoFinoA = 0;
            o.volo = null;
            o.morente = { t0: performance.now() + (ritardoMs || 0), dur: durMs };
            avvia();
            return { left: o.rect.left, top: o.rect.top, width: o.rect.w, height: o.rect.h };
        },
        /**
         * Si possono disegnare le carte Settate? A differenza degli ologrammi NON servono texture, quindi vale anche su
         * file://. Si spegne con il movimento ridotto, con `window.SETTATA_WEBGL_OFF`, o se il suo programma non si compila.
         */
        settateDisponibili() {
            if (guasto || guastoSettata || window.SETTATA_WEBGL_OFF || menoMovimento()) return false;
            return assicura() && !!progS;
        },
        /**
         * Le carte coperte che devono brillare ADESSO: [{ chiave, rect: { left, top, w, h } }]. La chiave e' dove sta la
         * carta (lato:zona:posto), mai cosa e': l'effetto e' uguale per tutte, e deve restare impossibile sapere dalla luce
         * se una carta Settata e' una Magia, una Trappola o un mostro. Lista vuota = spenge tutto.
         */
        aggiornaSettate(lista) {
            if (!lista.length) {
                if (settate.size) settate.clear();
                return true;
            }
            if (!this.settateDisponibili()) return false;
            const attese = new Set();
            lista.forEach((e) => {
                attese.add(e.chiave);
                const o = settate.get(e.chiave);
                if (o) o.rect = e.rect;
                else settate.set(e.chiave, { rect: e.rect, seme: Math.random() });
            });
            settate.forEach((_, k) => { if (!attese.has(k)) settate.delete(k); });
            avvia();
            return true;
        },
        /** Una carta Settata si e' appena scoperta: un lampo e un anello sul suo posto. */
        lampoSettata(rect) {
            if (!rect || !this.settateDisponibili()) return false;
            lampi.push({ rect: rect, t0: performance.now() });
            avvia();
            return true;
        },
        /** Quante carte Settate sta disegnando adesso (per i test). */
        settateAttive() { return settate.size; },
        /** Quanti lampi di rivelazione sono in corso (per i test). */
        lampiAttivi() { return lampi.length; },
        /** I campi che il modulo conosce di ogni Settata (per provare che non porta il tipo della carta). */
        campiSettata() { const o = settate.values().next().value; return o ? Object.keys(o) : []; },
        sospendi() { sospeso = true; },
        riprendi() { sospeso = false; avvia(); },
        /** Quanti ologrammi sta disegnando adesso (per i test). */
        attivi() { let n = 0; vivi.forEach((o) => { if (o.voce && o.voce.stato === 'pronta') n++; }); return n; },
        guasto() { return guasto; }
    };
})();
