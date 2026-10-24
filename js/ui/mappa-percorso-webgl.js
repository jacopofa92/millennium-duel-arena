/**
 * mappa-percorso-webgl.js — il SENTIERO e la tappa corrente delle mappe a nodi, in WebGL.
 * ------------------------------------------------------------------------------------
 * Le mappe della Storia hanno gia' un ambiente per ogni disegno (js/ui/ambiente-mappe-storia.js: nebbia, fiamme,
 * fulmini...), ma e' legato all'immagine: le mappe senza voce, e tutte le mappe disegnate a mano come quelle dei Tornei,
 * restano ferme, e nessuna dice a colpo d'occhio DOVE andare. Questo modulo disegna cio' che e' del PERCORSO e non del
 * disegno:
 *   - sulle tratte gia' percorse una luce lenta e tenue, che racconta la strada fatta;
 *   - sulla tratta che porta alla tappa corrente una cometa piu' viva e veloce, che indica la direzione;
 *   - attorno alla tappa corrente un faro: un nucleo che respira e due onde che si allargano.
 *
 * UN canvas dentro il mondo della mappa (come l'ambiente), quindi scorre e si ingrandisce con lei. Una sola passata:
 * geometria costruita una volta (un riquadro per tratta, uno per il faro) e uno shader che anima tutto col tempo.
 * Niente texture, quindi funziona anche su file://. Si accende solo con i Dettagli video "Alti" e senza movimento
 * ridotto, come gli altri ambienti; altrimenti NodeMap resta com'era (le sole linee SVG).
 */
(function () {
    'use strict';

    const VS = `
attribute vec2 aPos; attribute vec2 aUv; attribute vec2 aInfo;
uniform vec2 uWorld;
varying vec2 vUv; varying vec2 vInfo;
void main(){ vec2 c=aPos/uWorld*2.-1.; gl_Position=vec4(c.x,-c.y,0.,1.); vUv=aUv; vInfo=aInfo; }`;

    // aInfo.x = lunghezza della tratta in px (o raggio del faro), aInfo.y = tipo: 0 percorsa, 1 prossima, 2 faro.
    // highp quando c'e': con mediump (16 bit sui telefoni) `x*len` si quantizza a gradini di decine di pixel e le comete
    // avanzano a scatti, seghettate; lo stesso vale per uT quando la mappa resta aperta a lungo.
    const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv; varying vec2 vInfo;
uniform float uT;
void main(){
  float kind=vInfo.y; vec3 col=vec3(0.); float a=0.;
  if(kind<1.5){
    float y=vUv.y; float x=vUv.x; float len=vInfo.x;
    // Il riquadro della tratta ha un bordo netto: la luce si spegne PRIMA di raggiungerlo (niente rettangoli visibili).
    float lato=smoothstep(1.,.62,abs(y));
    float core=exp(-y*y*16.); float glow=exp(-y*y*3.2)*lato;
    float ends=smoothstep(0.,.04,x)*smoothstep(1.,.96,x);
    if(kind<.5){
      // percorsa: luce ferma e fioca, con un'onda lenta che la attraversa
      // q=0 e' la TESTA (davanti, verso la tappa), che cresce piano e poi lascia una coda dietro: prima il profilo era
      // girato (coda davanti) e col fronte tagliato netto, il "dente di sega" che si vedeva avanzare.
      float q=1.-fract(x*len/220.-uT*.18);
      float onda=exp(-q*6.)*smoothstep(0.,.14,q);
      a=(core*.32+glow*.10+onda*glow*.5)*ends;
      col=vec3(1.,.82,.45);
    } else {
      // prossima: comete vive nella direzione del cammino
      float q=1.-fract(x*len/130.-uT*.75);
      float cometa=exp(-q*8.)*smoothstep(0.,.14,q);
      a=(core*.55+glow*.18+cometa*(core*1.5+glow*.8))*ends;
      col=mix(vec3(1.,.55,.2),vec3(1.,.97,.8),cometa);
    }
  } else {
    // faro: nucleo che respira e due onde sfasate che si allargano e svaniscono
    float r=length(vUv);
    float respiro=.72+.28*sin(uT*3.1);
    float nucleo=exp(-r*r*9.)*.55*respiro;
    float f1=fract(uT*.45); float f2=fract(uT*.45+.5);
    float o1=exp(-pow((r-(.28+f1*.72))*11.,2.))*(1.-f1);
    float o2=exp(-pow((r-(.28+f2*.72))*11.,2.))*(1.-f2);
    float lim=smoothstep(1.,.85,r);
    a=(nucleo+(o1+o2)*.55)*lim;
    col=mix(vec3(1.,.8,.4),vec3(1.,.95,.8),nucleo);
  }
  a=clamp(a,0.,1.);
  gl_FragColor=vec4(col*a,a);
}`;

    function menoMovimento() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    function compila(gl, tipo, src) {
        const o = gl.createShader(tipo); gl.shaderSource(o, src); gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(o));
        return o;
    }

    /**
     * Accende il sentiero dentro `contenitore` (il mondo della mappa).
     * @param {HTMLElement} contenitore
     * @param {{ larghezza: number, altezza: number, tratte: {x1:number,y1:number,x2:number,y2:number,tipo:'fatta'|'prossima'}[], corrente?: {x:number,y:number}|null }} op
     * @returns {HTMLCanvasElement|null} il canvas (da mettere nel DOM nel punto giusto), o null se non si puo'
     */
    function crea(op) {
        if (window.MAPPA_PERCORSO_WEBGL_OFF || menoMovimento()) return null;
        if (!(window.VideoQuality && typeof window.VideoQuality.isAlti === 'function' && window.VideoQuality.isAlti())) return null;
        const L = op.larghezza; const H = op.altezza;
        if (!L || !H || (!op.tratte.length && !op.corrente)) return null;
        let canvas; let gl; let rid = 0;
        try {
            canvas = document.createElement('canvas');
            canvas.className = 'nm-percorso-gl';
            canvas.setAttribute('aria-hidden', 'true');
            canvas.style.cssText = 'position:absolute;left:0;top:0;width:' + L + 'px;height:' + H + 'px;pointer-events:none;';
            // La risoluzione segue la densita' di pixel dello schermo (prima era al piu' 1 pixel per px CSS, quindi su un
            // telefono a 2-3x la luce veniva ingrandita e si vedeva a gradini), ma con un tetto sul totale dei pixel:
            // il mondo di una mappa e' grande (fino a ~2600 px) e un canvas enorme costa piu' di quanto renda.
            const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
            const scala = Math.min(dpr, Math.sqrt(3.2e6 / (L * H)));
            canvas.width = Math.max(64, Math.round(L * scala)); canvas.height = Math.max(64, Math.round(H * scala));
            gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
            if (!gl) return null;
            const prog = gl.createProgram();
            gl.attachShader(prog, compila(gl, gl.VERTEX_SHADER, VS));
            gl.attachShader(prog, compila(gl, gl.FRAGMENT_SHADER, FS));
            gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
            gl.useProgram(prog);

            // Geometria: per ogni tratta un riquadro lungo la tratta, per il faro un riquadro attorno alla tappa.
            const v = [];
            const quad = (p0, p1, p2, p3, uv0, uv1, uv2, uv3, info) => {
                [[p0, uv0], [p1, uv1], [p2, uv2], [p0, uv0], [p2, uv2], [p3, uv3]].forEach((e) => v.push(e[0][0], e[0][1], e[1][0], e[1][1], info[0], info[1]));
            };
            op.tratte.forEach((t) => {
                const dx = t.x2 - t.x1; const dy = t.y2 - t.y1; const len = Math.hypot(dx, dy); if (len < 4) return;
                const nx = -dy / len; const ny = dx / len; const w = t.tipo === 'prossima' ? 26 : 20;
                quad([t.x1 + nx * w, t.y1 + ny * w], [t.x2 + nx * w, t.y2 + ny * w], [t.x2 - nx * w, t.y2 - ny * w], [t.x1 - nx * w, t.y1 - ny * w],
                    [0, 1], [1, 1], [1, -1], [0, -1], [len, t.tipo === 'prossima' ? 1 : 0]);
            });
            if (op.corrente) {
                const R = 120; const c = op.corrente;
                quad([c.x - R, c.y - R], [c.x + R, c.y - R], [c.x + R, c.y + R], [c.x - R, c.y + R], [-1, -1], [1, -1], [1, 1], [-1, 1], [R, 2]);
            }
            const dati = new Float32Array(v);
            const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, dati, gl.STATIC_DRAW);
            const attr = (nome, n, off) => { const l = gl.getAttribLocation(prog, nome); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 24, off); };
            attr('aPos', 2, 0); attr('aUv', 2, 8); attr('aInfo', 2, 16);
            gl.uniform2f(gl.getUniformLocation(prog, 'uWorld'), L, H);
            const uT = gl.getUniformLocation(prog, 'uT');
            gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.viewport(0, 0, canvas.width, canvas.height);
            const n = dati.length / 6;
            const t0 = performance.now();
            const ciclo = (ora) => {
                // Rilasciata appena la mappa viene ridisegnata (il suo contenitore svuotato): i contesti sono pochi.
                if (!canvas.isConnected) {
                    try { const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } catch (e2) { /* pulizia */ }
                    return;
                }
                if (!document.hidden) {
                    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
                    gl.uniform1f(uT, (ora - t0) / 1000);
                    gl.drawArrays(gl.TRIANGLES, 0, n);
                }
                rid = requestAnimationFrame(ciclo);
            };
            rid = requestAnimationFrame(ciclo);
            canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (rid) cancelAnimationFrame(rid); canvas.remove(); });
            return canvas;
        } catch (e) {
            if (window.console) console.warn('[mappa percorso WebGL] disattivato:', e && e.message || e);
            if (rid) cancelAnimationFrame(rid);
            return null;
        }
    }

    window.MappaPercorsoGL = { crea: crea };
})();
