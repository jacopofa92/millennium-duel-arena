// @ts-check
/**
 * ambiente-webgl.js — l'ambiente del campo disegnato da UNO shader.
 * ------------------------------------------------------------------
 * PERCHÉ ESISTE. field-ambience.js costruiva ogni effetto con decine di
 * <div> larghi quanto lo schermo, molti con `mix-blend-mode: screen`,
 * mossi da GSAP. Il costo non stava in GSAP (cambia due valori a frame)
 * ma nella COMPOSIZIONE: ogni strato con blend obbliga la GPU a rileggere
 * e rimescolare tutto ciò che sta sotto, a ogni frame. Misurato (CPU x4,
 * 844x390@2x, duello IA vs IA): 17 fps con l'ambiente, 52 senza.
 *
 * Qui l'ambiente è UN <canvas> per piano (fondo dietro le carte,
 * primo piano sopra): il rumore, le striature e la miscelazione additiva
 * avvengono DENTRO lo shader, in un solo passaggio. Aggiungere un
 * effetto costa qualche istruzione nello shader, non un altro strato da
 * ricomporre. Si disegna a risoluzione RIDOTTA (`scala`): sono effetti
 * morbidi, e il browser li ingrandisce senza che si noti.
 *
 * COME SI USA. `AmbienteWebGL.avvia(nome, opzioni)` torna true se ha
 * acceso l'ambiente, false se WebGL manca (o il contesto è stato perso e
 * non ritorna): in quel caso field-ambience.js ripiega sugli strati DOM di
 * sempre. Gli ambienti disponibili sono in `SHADER`.
 *
 * Il modulo NON decide quando accendersi (Dettagli video, movimento
 * ridotto, arena): lo decide field-ambience.js, che lo chiama.
 */
(function () {
    'use strict';

    const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

    // Rumore a valori + fbm: il minimo che serve a un vento che si torce.
    const COMUNE = `
precision mediump float;
uniform vec2 r;      // dimensione del canvas in pixel
uniform float t;     // secondi
uniform float raff;  // 0..1: intensità della folata del momento
uniform float dir;   // +1 / -1: verso del vento
uniform vec3 tinta;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return s;}
`;

    // Il vento del Dirigibile. `PIANO` vale 0 per il fondo (nubi larghe e
    // lente) e 1 per il primo piano (striature veloci, sottili, che si
    // torcono attorno alla scena). Un solo sorgente, due compilazioni.
    const VENTO = COMUNE + `
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  float asp=r.x/r.y;
  float v=(PIANO>0.5?.55:.18)*(1.+raff*1.6);
  // Il vento torce l'aria: si deforma lo spazio prima di leggere le striature.
  vec2 q=vec2(uv.x*asp,uv.y);
  vec2 w=vec2(fbm(q*1.6+vec2(-t*.10*dir,t*.05)),fbm(q*1.6+vec2(5.2,1.3)-t*.07));
  q+=(w-.5)*(PIANO>0.5?.34:.5);
  // Striature: molto allungate lungo il vento, strette di traverso.
  vec2 s=vec2((q.x-t*v*dir)*(PIANO>0.5?2.4:.9),q.y*(PIANO>0.5?13.:3.4));
  float c=fbm(s);
  float soglia=PIANO>0.5?.52-.10*raff:.40;
  float k=smoothstep(soglia,soglia+.22,c);
  // Sfuma in alto e in basso: la corrente occupa una fascia, non tutto lo schermo.
  float fascia=smoothstep(.0,.28,uv.y)*smoothstep(1.,.62,uv.y);
  float a=k*fascia*(PIANO>0.5?.30:.17)*(.55+.75*raff);
  gl_FragColor=vec4(tinta*a,a);
}`;

    /** @type {Record<string, {fondo:string, primopiano:string}>} */
    const SHADER = {
        vento: {
            fondo: VENTO.replace(/PIANO/g, '0.0'),
            primopiano: VENTO.replace(/PIANO/g, '1.0')
        }
    };

    /** @type {{ canvas: HTMLCanvasElement, gl: WebGLRenderingContext, prog: WebGLProgram, uni: Record<string, WebGLUniformLocation|null> }[]} */
    let piani = [];
    let rid = 0;
    let t0 = 0;
    let pausaA = 0;
    let sospeso = false;
    let ultimoDisegno = 0;
    let verso = 1;
    let raffica = 0;
    let bersaglioRaffica = 0;
    let prossimaRaffica = 0;
    let perso = false;
    let tintaRGB = [1, 1, 1];

    function menoAnimazioni() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function compila(gl, tipo, src) {
        const o = gl.createShader(tipo);
        if (!o) return null;
        gl.shaderSource(o, src);
        gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) return null;
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
        ['r', 't', 'raff', 'dir', 'tinta'].forEach((n) => { uni[n] = gl.getUniformLocation(prog, n); });
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); perso = true; });
        document.body.appendChild(canvas);
        return { canvas: canvas, gl: gl, prog: prog, uni: uni };
    }

    function disegna(ora) {
        rid = requestAnimationFrame(disegna);
        if (sospeso || perso) return;
        // Tetto a ~40 fps: un velo di vento non guadagna nulla da 60, e su
        // telefono il margine che si libera va alle carte e agli attacchi.
        if (ora - ultimoDisegno < 24) return;
        ultimoDisegno = ora;
        const sec = (ora - t0) / 1000;
        // Folata: ogni tanto un bersaglio nuovo, l'intensità lo insegue piano.
        if (ora > prossimaRaffica) {
            bersaglioRaffica = Math.random() < 0.34 ? 0.75 + Math.random() * 0.25 : Math.random() * 0.22;
            prossimaRaffica = ora + 1800 + Math.random() * 3200;
        }
        raffica += (bersaglioRaffica - raffica) * 0.04;
        piani.forEach((p) => {
            const gl = p.gl;
            gl.uniform2f(p.uni.r, p.canvas.width, p.canvas.height);
            gl.uniform1f(p.uni.t, sec);
            gl.uniform1f(p.uni.raff, raffica);
            gl.uniform1f(p.uni.dir, verso);
            gl.uniform3f(p.uni.tinta, tintaRGB[0], tintaRGB[1], tintaRGB[2]);
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
        perso = false;
    }

    /**
     * Accende un ambiente. Torna false (senza lasciare nulla nel DOM) se
     * non si può: WebGL assente, shader che non compila, movimento ridotto.
     * @param {string} nome  chiave di SHADER
     * @param {{ scala?: number, tinta?: number[], conPrimoPiano?: boolean }} [opzioni]
     */
    function avvia(nome, opzioni) {
        ferma();
        const def = SHADER[nome];
        if (!def || menoAnimazioni() || window.AMBIENTE_WEBGL_OFF) return false;
        const o = opzioni || {};
        const scala = o.scala || 0.4;
        const fondo = creaPiano('fondo', def.fondo, scala);
        const primo = fondo && creaPiano('primopiano', def.primopiano, scala);
        if (!fondo || !primo) {
            if (fondo) fondo.canvas.remove();
            return false;
        }
        piani = [fondo, primo];
        tintaRGB = o.tinta || [1, 1, 1];
        verso = Math.random() < 0.5 ? -1 : 1;
        raffica = 0.1; bersaglioRaffica = 0.1; prossimaRaffica = 0;
        t0 = performance.now();
        ultimoDisegno = 0;
        sospeso = false;
        rid = requestAnimationFrame(disegna);
        return true;
    }

    function sospendi(si) {
        if (si === sospeso) return;
        sospeso = si;
        if (si) pausaA = performance.now();
        else t0 += performance.now() - pausaA; // il tempo fermo non conta: niente salto
    }

    window.AmbienteWebGL = {
        avvia: avvia,
        ferma: ferma,
        sospendi: sospendi,
        attivo: () => piani.length > 0,
        /** Forza l'intensità della folata (0..1) per `ms`: serve alle prove e alle verifiche visive. */
        folata: (v, ms) => { raffica = bersaglioRaffica = v; prossimaRaffica = performance.now() + (ms || 4000); },
        /** Per le verifiche: i canvas attualmente accesi. */
        canvas: () => piani.map((p) => p.canvas),
        NOMI: Object.keys(SHADER)
    };
})();
