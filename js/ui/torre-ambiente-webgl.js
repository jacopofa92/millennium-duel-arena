/**
 * torre-ambiente-webgl.js — la tempesta attorno alla Torre dei Duellanti, in WebGL.
 * --------------------------------------------------------------------------------
 * La Torre (torre.html) e' una struttura immobile di proposito (vedi CLAUDE.md, "Revamp Torre"): i piani non si
 * muovono. Qui si anima l'ARIA attorno, con un solo canvas sopra la torre (pointer-events: none) che non tocca il
 * layout: nebbia che scorre, braci che salgono dal basso, un fulmine ogni tanto con il lampo che tinge tutto,
 * un'aura d'oro sulla corona in cima e un bagliore che pulsa attorno al piano dove sei.
 *
 * Una sola passata, nessuna texture. Si accende solo con i Dettagli video "Alti" e senza movimento ridotto, come
 * gli ambienti dei duelli e delle mappe; altrimenti la torre resta com'era.
 */
(function () {
    'use strict';

    const VS = 'attribute vec2 aPos; varying vec2 vUv; void main(){ vUv=aPos*.5+.5; vUv.y=1.-vUv.y; gl_Position=vec4(aPos,0.,1.); }';

    const FS = `
precision mediump float;
varying vec2 vUv;
uniform vec2 uRes;      // dimensioni del canvas in px CSS
uniform float uT;
uniform vec4 uCur;      // piano corrente: centro x, y, mezza larghezza, mezza altezza (px CSS; w<0 = nessuno)
uniform vec3 uCrown;    // corona: x, y, raggio
float h(float n){return fract(sin(n*91.3458)*47453.5453);}
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h2(i),h2(i+vec2(1.,0.)),f.x),mix(h2(i+vec2(0.,1.)),h2(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*noise(p);p*=2.03;a*=.5;}return s;}
void main(){
  vec2 P=vUv*uRes; float W=uRes.x, H=uRes.y;
  vec3 rgb=vec3(0.); float al=0.;

  // NEBBIA: fasce azzurre che scorrono lente, piu' fitte in alto
  float n=fbm(P*vec2(.006,.010)+vec2(uT*.018,-uT*.012));
  float m=smoothstep(.46,.86,n)*.17*mix(.55,1.,1.-vUv.y);
  rgb+=vec3(.55,.7,1.)*m;

  // BRACI che salgono dal fondo, con un po' di sbandata
  for(int i=0;i<26;i++){
    float fi=float(i);
    float sp=.025+.035*h(fi+3.);
    float ph=h(fi+7.);
    float yy=1.-fract(uT*sp+ph);
    vec2 pos=vec2((h(fi)+.04*sin(uT*.6+fi*1.7))*W, yy*H);
    float d=length(P-pos);
    float tw=.6+.4*sin(uT*5.+fi*2.3);
    float e=exp(-d*d/(2.2+2.*h(fi+11.)))*tw*smoothstep(0.,.08,yy)*smoothstep(1.,.85,yy);
    rgb+=mix(vec3(1.,.5,.15),vec3(1.,.85,.5),h(fi+5.))*e*.9;
  }

  // FULMINE: ogni ~7 s, un tratto sottile con il lampo che schiarisce il cielo un istante
  float T=7.;
  float id=floor(uT/T); float ph2=mod(uT,T);
  float dt=ph2-(1.5+h(id)*3.);
  if(dt>0.&&dt<.5){
    float k=1.-dt/.5;
    float fl=step(.4,fract(dt*16.))*.7+.3;
    float x0=(.1+.8*h(id+3.))*W;
    float yEnd=H*(.35+.4*h(id+5.));
    float xb=x0+(fbm(vec2(P.y*.012,id))-.5)*110.+sin(P.y*.02+id)*12.;
    float d=abs(P.x-xb);
    float bolt=(exp(-d*d/2.2)+exp(-d*d/160.)*.35)*step(P.y,yEnd)*smoothstep(yEnd,yEnd*.8,P.y);
    rgb+=vec3(.75,.85,1.)*bolt*k*fl*1.4;
    rgb+=vec3(.35,.45,.8)*.10*k*fl;
  }

  // AURA d'oro sulla corona
  if(uCrown.z>0.){
    float r=length(P-uCrown.xy)/uCrown.z;
    float aura=exp(-r*r*3.)*.32*(.8+.2*sin(uT*1.7));
    rgb+=vec3(1.,.8,.35)*aura;
  }

  // BAGLIORE attorno al piano corrente: un riquadro che pulsa
  if(uCur.z>0.){
    vec2 q=abs(P-uCur.xy)-uCur.zw;
    float dd=length(max(q,0.))+min(max(q.x,q.y),0.);
    float puls=.55+.45*sin(uT*2.3);
    float glow=exp(-max(dd,0.)/12.)*puls*.5*step(-3.,dd)+exp(-dd*dd/6.)*.5;
    rgb+=vec3(1.,.78,.3)*glow;
  }

  al=clamp(max(rgb.r,max(rgb.g,rgb.b))*.85,0.,1.);
  gl_FragColor=vec4(min(rgb,vec3(1.)),al);
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
     * Monta la tempesta sopra la torre `tw` (l'elemento `.tw`). Chiamabile a ogni ridisegno della pagina: il canvas
     * precedente, se c'e', si rimuove e si rilascia il suo contesto.
     * @param {HTMLElement|null} tw
     * @returns {boolean} se e' acceso
     */
    function monta(tw) {
        if (!tw) return false;
        const vecchio = tw.querySelector('canvas.tw-ambiente-gl');
        if (vecchio) vecchio.remove();   // il suo ciclo se ne accorge e rilascia il contesto
        if (window.TORRE_AMBIENTE_WEBGL_OFF || menoMovimento()) return false;
        if (!(window.VideoQuality && typeof window.VideoQuality.isAlti === 'function' && window.VideoQuality.isAlti())) return false;
        let gl = null; let canvas = null; let rid = 0;
        try {
            canvas = document.createElement('canvas');
            canvas.className = 'tw-ambiente-gl';
            canvas.setAttribute('aria-hidden', 'true');
            canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:6;';
            gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
            if (!gl) return false;
            const prog = gl.createProgram();
            gl.attachShader(prog, compila(gl, gl.VERTEX_SHADER, VS));
            gl.attachShader(prog, compila(gl, gl.FRAGMENT_SHADER, FS));
            gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
            gl.useProgram(prog);
            const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
            const l = gl.getAttribLocation(prog, 'aPos'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
            const U = {}; ['uRes', 'uT', 'uCur', 'uCrown'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
            gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            tw.appendChild(canvas);

            let w = 0; let h = 0; let cur = [0, 0, -1, 0]; let crown = [0, 0, 0];
            const misura = () => {
                const r = tw.getBoundingClientRect();
                w = Math.max(1, r.width); h = Math.max(1, r.height);
                // Poca risoluzione: sono nebbie e luci morbide, e la torre e' alta (anche piu' di 1500 px).
                const sc = Math.min(1, 1100 / Math.max(w, h));
                canvas.width = Math.max(32, Math.round(w * sc)); canvas.height = Math.max(32, Math.round(h * sc));
                gl.viewport(0, 0, canvas.width, canvas.height);
                const rel = (el) => { const e = el.getBoundingClientRect(); return { x: e.left - r.left + e.width / 2, y: e.top - r.top + e.height / 2, hw: e.width / 2, hh: e.height / 2 }; };
                const qui = tw.querySelector('.tw-piano.is-attuale');
                cur = qui ? (() => { const p = rel(qui); return [p.x, p.y, p.hw + 2, p.hh + 2]; })() : [0, 0, -1, 0];
                const cima = tw.querySelector('.tw-cima-corona') || tw.querySelector('.tw-cima');
                crown = cima ? (() => { const p = rel(cima); return [p.x, p.y, Math.max(70, p.hw * 2.2)]; })() : [0, 0, 0];
            };
            misura();
            const onResize = () => { if (canvas.isConnected) misura(); };
            window.addEventListener('resize', onResize);
            const t0 = performance.now();
            const ciclo = (ora) => {
                if (!canvas.isConnected) {
                    window.removeEventListener('resize', onResize);
                    try { const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } catch (e2) { /* pulizia */ }
                    return;
                }
                if (!document.hidden) {
                    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
                    gl.uniform2f(U.uRes, w, h); gl.uniform1f(U.uT, (ora - t0) / 1000);
                    gl.uniform4f(U.uCur, cur[0], cur[1], cur[2], cur[3]); gl.uniform3f(U.uCrown, crown[0], crown[1], crown[2]);
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                }
                rid = requestAnimationFrame(ciclo);
            };
            rid = requestAnimationFrame(ciclo);
            canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); canvas.remove(); });
            return true;
        } catch (e) {
            if (window.console) console.warn('[torre ambiente WebGL] disattivato:', e && e.message || e);
            if (rid) cancelAnimationFrame(rid);
            if (canvas) canvas.remove();
            return false;
        }
    }

    window.TorreAmbienteGL = { monta: monta };
})();
