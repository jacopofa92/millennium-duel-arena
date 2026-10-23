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

float h(float n){return fract(sin(n*91.3458)*47453.5453);}

// L'illustrazione 'contain' nel riquadro (come object-fit: contain): rgb + quanto il punto sta dentro l'immagine.
vec4 campiona(vec2 uv){
  vec2 s=vec2(min(1.,uImgAsp/uAsp),min(1.,uAsp/uImgAsp));
  vec2 q=(uv-.5)/s+.5;
  if(q.x<0.||q.x>1.||q.y<0.||q.y>1.) return vec4(0.);
  return vec4(texture2D(uTex,q).rgb,1.);
}

void main(){
  vec2 uv=vUv;
  // GLITCH: ogni tanto, per una frazione di secondo, strisce orizzontali che scivolano e canali che si separano.
  float gt=uT*.45+uSeed*7.;
  float ev=floor(gt);
  float gl=step(.94,fract(gt))*step(.55,h(ev+uSeed));
  float banda=floor(uv.y*16.);
  float sh=(h(banda*1.7+ev)-.5)*.10*gl;
  float ca=.0035+gl*.012;
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
  float d=length((uv-vec2(.5,.46))/vec2(.56,.64));
  float m=1.-smoothstep(.44,1.,d);
  m=m*(.6+.4*m);
  float alpha=coperto*m*.88;

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
  float base=exp(-bx*bx*1.6)*exp(-by*by*1.3)*.62*(.75+.25*sin(uT*2.4+uSeed));
  vec3 bc=vec3(.47,.84,1.);

  float aa=clamp(alpha+base*.9+linea*m,0.,1.)*uAlpha;
  vec3 rgb=(col*alpha+bc*base+vec3(.7,1.,1.)*linea*m)*uAlpha;
  gl_FragColor=vec4(min(rgb,vec3(aa+.3)),aa);
}`;

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
        return document.getElementById('monsterHologramLayer');
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
            ['uRes', 'uTex', 'uT', 'uSeed', 'uBorn', 'uAsp', 'uImgAsp', 'uAlpha', 'uPx'].forEach((n) => { uni[n] = gl.getUniformLocation(prog, n); });
            bufPos = gl.createBuffer();
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
        canvas = null; gl = null; prog = null;
        vivi.clear();
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

    function disegna(ora) {
        rid = 0;
        if (!gl || guasto || !canvas) return;
        if (sospeso) { rid = requestAnimationFrame(disegna); return; }
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
            const inset = r.w * 0.075;
            const insTop = o.segno > 0 ? inset : 0;
            const insBot = o.segno > 0 ? 0 : inset;
            const y0 = r.top + bob; const y1 = r.top + r.h + bob;
            const v = new Float32Array([
                r.left + insTop, y0, 0, 0,
                r.left + r.w - insTop, y0, 1, 0,
                r.left + insBot, y1, 0, 1,
                r.left + r.w - insBot, y1, 1, 1
            ]);
            gl.bufferData(gl.ARRAY_BUFFER, v, gl.DYNAMIC_DRAW);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, voce.tex);
            gl.uniform1f(uni.uSeed, o.seme);
            gl.uniform1f(uni.uBorn, (ora - o.nato) / 1000);
            gl.uniform1f(uni.uAsp, r.w / r.h);
            gl.uniform1f(uni.uImgAsp, voce.w / voce.h);
            gl.uniform1f(uni.uAlpha, 1);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            disegnati++;
        });
        if (vivi.size) rid = requestAnimationFrame(disegna);
    }

    function avvia() { if (!rid && gl && !guasto && vivi.size) rid = requestAnimationFrame(disegna); }

    window.MonsterHologramGL = {
        /** Si può usare adesso? Crea il contesto alla prima richiesta. */
        disponibile() {
            if (guasto || window.OLOGRAMMA_WEBGL_OFF || menoMovimento()) return false;
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
                    o = { voce: caricaTexture(src), nato: ora, seme: Math.random() * 10, segno: 1, rect: e.rect, nascostoFinoA: 0 };
                    vivi.set(e.uid, o);
                }
                o.segno = e.owner === 'bot' ? -1 : 1;
                o.rect = e.rect;
            });
            vivi.forEach((_, uid) => { if (!attesi.has(uid)) vivi.delete(uid); });
            if (guasto) return false;
            avvia();
            return true;
        },
        /** La proiezione di UN mostro si spegne per un attimo (il mostro sta partendo all'attacco). */
        nascondiPer(uid, ms) {
            const o = vivi.get(uid);
            if (o) o.nascostoFinoA = performance.now() + ms;
        },
        sospendi() { sospeso = true; },
        riprendi() { sospeso = false; avvia(); },
        /** Quanti ologrammi sta disegnando adesso (per i test). */
        attivi() { let n = 0; vivi.forEach((o) => { if (o.voce && o.voce.stato === 'pronta') n++; }); return n; },
        guasto() { return guasto; }
    };
})();
