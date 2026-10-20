// @ts-check
/**
 * carta-viva-webgl.js — i riflessi delle carte "vive" (rarita') disegnati da UNO shader.
 * ------------------------------------------------------------------------------------
 * Prima ogni carta viva aveva fino a quattro strati DOM (cv-riflesso, cv-bordo, cv-olo, cv-grana), ognuno con
 * gradienti, maschere e `mix-blend-mode`: sul telefono la scheda grande e la Cartoteca li pagavano a ogni
 * movimento della luce. Qui gli stessi effetti stanno in un solo <canvas> per carta, con la STESSA resa:
 *
 *   riflesso   la luce bianca che passa (tutte le carte): gradiente radiale che segue --luce-x/--luce-y;
 *   bordo      rara e oltre: un filo lucido sul bordo con una banda di luce che scorre (115 gradi);
 *   arcobaleno super e oltre: strisce arcobaleno sull'illustrazione (ultra piu' acceso), in oro per
 *              leggendaria e mitica; la mitica lo stende su tutta la carta;
 *   grana      segreta e mitica: scintille minute accese solo attorno alla luce (passo di 9 e 13 px).
 *
 * Le formule (angoli, posizioni dei gradienti, opacita' in funzione di --forza) sono quelle di card.css, "Carta viva".
 * I fusi `soft-light`/`color-dodge`/`overlay` si ottengono con un velo di luce (alpha premoltiplicato valido): senza leggere la carta che sta
 * sotto, perche' un'immagine di file:// non si puo' campionare in WebGL.
 *
 * COSA NON CAMBIA: chi muove la luce e' sempre card-renderer.js, che scrive --luce-x, --luce-y e --forza (mouse,
 * giroscopio, ondeggio a riposo); qui si LEGGONO dagli stili calcolati, quindi anche le animazioni CSS delle
 * variabili funzionano. Si ridisegna solo quando un valore cambia. Nelle griglie il canvas esiste solo sulla carta
 * sotto il mouse (come gli strati di prima): i contesti WebGL sono pochi e riusati da un piccolo insieme.
 *
 * Senza WebGL `disponibile()` e' falso e card-renderer.js crea gli strati DOM di sempre.
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
uniform vec2 sz;      // la carta in px CSS
uniform vec2 res;     // il canvas in pixel (sz per la densita' di pixel)
uniform vec2 luce;    // posizione della luce, 0..1, y dall'alto
uniform float forza;
uniform vec4 art;     // finestra dell'illustrazione (frazioni, y dall'alto): x0 y0 x1 y1
uniform vec4 cfg;     // x: bordo (0/1), y: arcobaleno (0 no, 1 arcobaleno, 2 oro), z: arcobaleno su tutta la carta (0/1), w: grana (0/1)
uniform float oloOp;  // opacita' dell'arcobaleno (gia' calcolata da --forza come in card.css)
const float PI=3.14159265;
const vec2 D115=vec2(.9063,.4226);   // direzione di un gradiente a 115 gradi (CSS: sin, -cos, con y verso il basso)

// Gradiente lineare CSS a 115deg dentro una scatola di dimensione \`box\`: parametro 0..1 lungo la linea.
float lin115(vec2 q,vec2 box){ float L=abs(box.x*D115.x)+abs(box.y*D115.y); return dot(q-box*.5,D115)/L+.5; }

vec3 arcobaleno(float x){      // 5 colori su un periodo, come repeating-linear-gradient
  float k=fract(x)*5.; float i=floor(k); float f=k-i;
  vec3 a=vec3(1.,.353,.522); vec3 b=vec3(1.,.82,.4); vec3 c=vec3(.369,.941,.69); vec3 d=vec3(.361,.784,1.); vec3 e=vec3(.725,.549,1.);
  if(i<.5) return mix(a,b,f); if(i<1.5) return mix(b,c,f); if(i<2.5) return mix(c,d,f); if(i<3.5) return mix(d,e,f); return mix(e,a,f);
}
vec3 oro(float x){
  float k=fract(x)*5.; float i=floor(k); float f=k-i;
  vec3 a=vec3(1.,.953,.769); vec3 b=vec3(.969,.843,.455); vec3 c=vec3(.953,.612,.07); vec3 d=vec3(1.,.973,.875); vec3 e=vec3(.878,.69,.29);
  if(i<.5) return mix(a,b,f); if(i<1.5) return mix(b,c,f); if(i<2.5) return mix(c,d,f); if(i<3.5) return mix(d,e,f); return mix(e,a,f);
}

void main(){
  vec2 uv=vec2(gl_FragCoord.x/res.x, 1.-gl_FragCoord.y/res.y);   // y dall'alto
  vec2 p=uv*sz;
  vec2 L=luce*sz;
  float Rf=length(max(L,sz-L));                                 // 'farthest-corner' dei gradienti radiali
  float dl=length(p-L)/Rf;
  vec3 add=vec3(0.);                                            // luce sommata (alpha 0): rende soft-light, color-dodge, overlay
  vec4 ring=vec4(0.);                                           // il bordo lucido: dipinto senza fusione
  vec4 vel=vec4(0.);                                            // l'oro (overlay in card.css): una velatura che tinge, non che sbianca

  // --- riflesso: bianco .75 al centro, .2 al 28%, niente al 60%; opacita' forza*.9; soft-light ~ meta' dell'effetto sommato
  float ra=dl<.28?mix(.75,.2,dl/.28):(dl<.6?mix(.2,0.,(dl-.28)/.32):0.);
  add+=vec3(ra*forza*.9*.32);

  // --- bordo lucido (anello di spessore 5% della larghezza)
  if(cfg.x>.5){
    float th=.05*sz.x; float de=min(min(p.x,sz.x-p.x),min(p.y,sz.y-p.y));
    float inRing=1.-smoothstep(th-.6,th+.6,de);
    vec2 img=sz*2.2; vec2 off=(sz-img)*luce; vec2 q=p-off;
    float t=lin115(q,img); float band=clamp(1.-abs(t-.5)/.2,0.,1.)*.9;
    float t2=dot(p-sz*.5,vec2(.7071))/((sz.x+sz.y)*.7071)+.5;
    vec4 under=t2<.5?mix(vec4(1.,.98,.882,.32),vec4(1.,.925,.667,.08),t2/.5):mix(vec4(1.,.925,.667,.08),vec4(1.,.98,.882,.32),(t2-.5)/.5);
    vec4 top=vec4(vec3(1.,.992,.941)*band,band);
    vec4 comp=top+vec4(under.rgb*under.a,under.a)*(1.-top.a);
    float op=.55+forza*.45;
    ring=comp*inRing*op;
  }

  // --- arcobaleno / oro sull'illustrazione (o su tutta la carta)
  if(cfg.y>.5){
    vec2 o0=cfg.z>.5?vec2(0.):vec2(art.x,art.y)*sz; vec2 o1=cfg.z>.5?sz:vec2(art.z,art.w)*sz;
    vec2 box=o1-o0;
    if(p.x>=o0.x&&p.x<=o1.x&&p.y>=o0.y&&p.y<=o1.y){
      float sc=cfg.y>1.5?1.:1.;
      vec2 img=box*2.4; vec2 off=(box-img)*luce; vec2 q=p-o0-off;
      float t=lin115(q,img);
      vec3 col=cfg.y>1.5?oro(t/.40):arcobaleno(t/.35);
      float gain=cfg.y>1.5?.28:.95;
      float edge=min(min(p.x-o0.x,o1.x-p.x),min(p.y-o0.y,o1.y-p.y));
      float k=smoothstep(0.,1.2,edge);
      if(cfg.y>1.5){ float v=cfg.z>.5?.32:.5; vel=vec4(col*oloOp*v*k,oloOp*v*k); }
      else { float v=cfg.z>.5?.7:.92; vel=vec4(col*oloOp*v*k,oloOp*v*k); }   // arcobaleno: velo che tinge (color-dodge in card.css, che non si puo' leggere da qui)
    }
  }

  // --- grana: puntini di 9 e 13 px, accesi attorno alla luce (maschera radiale: 1, .35 al 35%, 0 al 70%)
  if(cfg.w>.5){
    float d1=length(mod(p,9.)-4.5); float s1=1.-smoothstep(.6,1.2,d1);
    float d2=length(mod(p-vec2(4.,6.),13.)-6.5); float s2=(1.-smoothstep(.5,1.,d2))*.85;
    float m=dl<.35?mix(1.,.35,dl/.35):(dl<.7?mix(.35,0.,(dl-.35)/.35):0.);
    add+=vec3(1.,.96,.8)*(s1*.95+s2*.85)*m*(.35+forza*.6);
  }

  vec4 base=ring+vel*(1.-ring.a);
  // La luce sommata si scrive come alpha premoltiplicato VALIDO (rgb <= alpha): una fusione normale con un velo di quel colore,
  // che e' quasi uguale a sommare per i valori piccoli e funziona su ogni browser (rgb > alpha non e' garantito da nessuno).
  vec3 Lu=min(add*(1.-ring.a*.5),vec3(1.));
  float la=max(max(Lu.r,Lu.g),Lu.b);
  vec3 c=base.rgb+Lu*(1.-base.a);
  gl_FragColor=vec4(c,base.a+la*(1.-base.a));
}`;

    /** @typedef {{ cv: HTMLCanvasElement, gl: WebGLRenderingContext, u: Record<string, WebGLUniformLocation|null>, uso: boolean }} Istanza */
    /** @type {Istanza[]} */
    const insieme = [];
    let provato = null;
    const MAX_ISTANZE = 8;

    function nuovaIstanza() {
        const cv = document.createElement('canvas');
        cv.className = 'cv-gl';
        cv.setAttribute('aria-hidden', 'true');
        const gl = /** @type {WebGLRenderingContext|null} */ (cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: true }));   // il frame resta: si ridisegna solo quando cambia la luce
        if (!gl) return null;
        const pr = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        if (!pr || pr.precision === 0) return null;
        const sh = (tipo, src) => { const o = /** @type {WebGLShader} */ (gl.createShader(tipo)); gl.shaderSource(o, src); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
        const vs = sh(gl.VERTEX_SHADER, VS); const fs = sh(gl.FRAGMENT_SHADER, FS);
        if (!vs || !fs) return null;
        const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
        gl.useProgram(prog);
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        const u = {};
        ['sz', 'res', 'luce', 'forza', 'art', 'cfg', 'oloOp'].forEach((n) => { u[n] = gl.getUniformLocation(prog, n); });
        return { cv: cv, gl: gl, u: u, uso: false };
    }

    /** Un'istanza libera (o nuova, finche' non si superano MAX_ISTANZE): i contesti WebGL sono pochi e preziosi. */
    function prendi() {
        let i = insieme.find((x) => !x.uso);
        if (!i && insieme.length < MAX_ISTANZE) { i = nuovaIstanza() || undefined; if (i) insieme.push(i); }
        if (!i) return null;
        i.uso = true;
        return i;
    }
    function rilascia(i) { i.uso = false; if (i.cv.parentNode) i.cv.remove(); }

    function disponibile() {
        if (provato === null) {
            try { provato = !!(window.WebGLRenderingContext && !window.CARTA_VIVA_WEBGL_OFF && nuovaIstanza()); } catch (e) { provato = false; }
        }
        return provato && !window.CARTA_VIVA_WEBGL_OFF;
    }

    /** La finestra dell'illustrazione dentro la carta, in frazioni (y dall'alto), dai layout (non cambiano con l'inclinazione). */
    function finestra(el) {
        const art = el.querySelector('.card-frame-art');
        const W = el.offsetWidth || 1; const H = el.offsetHeight || 1;
        if (!art || el.querySelector('.card-image')) return [0, 0, 1, 1];
        let x = 0; let y = 0; let n = /** @type {HTMLElement|null} */ (art);
        while (n && n !== el) { x += n.offsetLeft; y += n.offsetTop; n = /** @type {HTMLElement|null} */ (n.offsetParent); }
        if (n !== el) return [0.075, 0.19, 0.925, 0.72];
        return [x / W, y / H, (x + /** @type {HTMLElement} */ (art).offsetWidth) / W, (y + /** @type {HTMLElement} */ (art).offsetHeight) / H];
    }

    const num = (s) => parseFloat(String(s));
    /** Le tre variabili della luce, come le ha scritte card-renderer.js (o le sta animando il CSS). */
    function leggiLuce(stile) {
        const lx = num(stile.getPropertyValue('--luce-x')); const ly = num(stile.getPropertyValue('--luce-y')); const f = num(stile.getPropertyValue('--forza'));
        return [isNaN(lx) ? 50 : lx, isNaN(ly) ? 30 : ly, isNaN(f) ? 0 : f];
    }

    /** L'opacita' dell'arcobaleno, con le stesse formule e gli stessi casi di card.css. */
    function opacitaOlo(rarita, forza, intera) {
        if (rarita === 'legendary' || rarita === 'mythic') return 0.3 + forza * 0.45;
        if (rarita === 'ultra') return 0.22 + forza * 0.4;
        return intera ? 0.08 + forza * 0.2 : 0.14 + forza * 0.3;
    }

    /**
     * Collega i riflessi WebGL a una carta viva. Torna false se WebGL non c'e' (il chiamante usa gli strati DOM).
     * @param {HTMLElement} el la carta  @param {string} rarita  @param {{ modo: string, bersaglio: HTMLElement, area: HTMLElement }} o
     */
    function collega(el, rarita, o) {
        if (!disponibile()) return false;
        const bordo = ['rare', 'super', 'ultra', 'legendary', 'secret', 'mythic'].indexOf(rarita) >= 0;
        const arco = ['super', 'ultra', 'legendary', 'secret', 'mythic'].indexOf(rarita) >= 0;
        const grana = rarita === 'secret' || rarita === 'mythic';
        const oro = rarita === 'legendary' || rarita === 'mythic';
        const grande = o.modo === 'grande';
        /** @type {Istanza|null} */ let ist = null;
        let rid = 0;
        let ultimo = '';

        const disegna = () => {
            if (!ist) return;
            const W = el.offsetWidth; const H = el.offsetHeight;
            if (!W || !H) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const [lx, ly, f] = leggiLuce(getComputedStyle(o.bersaglio));
            const chiave = lx + '|' + ly + '|' + f + '|' + W + '|' + H;
            if (chiave === ultimo) return;
            ultimo = chiave;
            const cw = Math.round(W * dpr); const ch = Math.round(H * dpr);
            if (ist.cv.width !== cw || ist.cv.height !== ch) { ist.cv.width = cw; ist.cv.height = ch; }
            const gl = ist.gl; const u = ist.u;
            gl.viewport(0, 0, cw, ch);
            gl.uniform2f(u.sz, W, H);
            gl.uniform2f(u.res, cw, ch);
            gl.uniform2f(u.luce, lx / 100, ly / 100);
            gl.uniform1f(u.forza, f);
            const a = finestra(el);
            gl.uniform4f(u.art, a[0], a[1], a[2], a[3]);
            const intera = !!(arco && (rarita === 'mythic' || a[0] === 0 && a[2] === 1));
            gl.uniform4f(u.cfg, bordo ? 1 : 0, arco ? (oro ? 2 : 1) : 0, intera ? 1 : 0, grana ? 1 : 0);
            gl.uniform1f(u.oloOp, opacitaOlo(rarita, f, intera));
            gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        };
        const ciclo = () => {
            rid = 0;
            if (!ist || !el.isConnected) { fine(); return; }
            if (!o.bersaglio.classList.contains('cv-sospesa')) disegna();
            rid = requestAnimationFrame(ciclo);
        };
        const inizio = () => {
            if (ist) return;
            ist = prendi();
            if (!ist) return;
            ultimo = '';
            el.appendChild(ist.cv);
            disegna();
            if (!rid) rid = requestAnimationFrame(ciclo);
        };
        const fine = () => {
            cancelAnimationFrame(rid); rid = 0;
            if (ist) { rilascia(ist); ist = null; }
        };

        if (grande) {
            inizio();
        } else {
            // Nelle griglie e nelle file: solo sotto il mouse (non al tocco), come gli strati DOM di prima.
            const mouse = !(window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches);
            if (mouse) {
                o.area.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') inizio(); });
                o.area.addEventListener('pointerleave', fine);
            }
        }
        return true;
    }

    window.CartaVivaGL = { collega: collega, disponibile: disponibile, attive: () => insieme.filter((i) => i.uso).length };
})();
