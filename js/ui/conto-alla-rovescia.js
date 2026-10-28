/**
 * conto-alla-rovescia.js — il campo che si oscura e le 20 fiammelle di "Conto alla Rovescia Finale" (id 1283).
 * ---------------------------------------------------------------------------------------------------------
 * La carta (card-effects-8.js) scrive soltanto `gameState.contoAllaRovescia = { owner, startTurn, durata }`.
 * Tutto quello che si vede nasce da QUELLO STATO: qui lo si legge a ogni ridisegno del duello (`sync`, chiamato da
 * ridisegnaDuello in game-flow.js, come DuelFeedback) e si disegna
 *   - un velo scuro con vignetta, SOTTO le carte (z-index 1: `.game-container` sta a 2), cosi' il campo resta leggibile;
 *   - `durata` fiammelle su un arco, di cui ne restano accese `durata - (turno - startTurno)`: una si spegne ad ogni
 *     cambio turno (quella in fondo all'arco), con un breve sfumare, e lascia un tizzone rosso.
 *
 * Nessuna regola qui dentro e nessuna vittoria: la carta, per ora, avvia soltanto il conto (vedi la sua missingEffectNote).
 * Un duello nuovo sostituisce `gameState`, quindi il conto sparisce da solo al primo `sync`.
 *
 * Con i Dettagli video "Alti" (e senza movimento ridotto) le fiamme sono uno shader su un canvas; altrimenti sono
 * elementi CSS, con la stessa disposizione. Il canvas esiste solo mentre il conto e' attivo e si RILASCIA alla fine.
 */
(function () {
    'use strict';

    const MAX_FIAMME = 40;           // tetto di sicurezza per l'array dello shader
    const SPEGNIMENTO_S = 1.1;       // quanto dura lo spegnersi di una fiamma

    /**
 * Le posizioni (in frazioni dello schermo) delle n fiamme: un anello CHIUSO attorno a tutto il campo, fuori dalle caselle.
 * La forma e' una superellisse (esponente 4) centrata sul rettangolo che contiene tutte le `.field-slot`: tondeggiante come
 * un ovale (in orizzontale diventa piu' larga che alta) ma molto piu' aderente di un'ellisse vera, che per lasciare fuori gli
 * angoli del campo dovrebbe allargarsi del 41% e uscire dallo schermo. Con k = 1,19 gli angoli del rettangolo toccano la curva.
 * Le fiamme sono distribuite a distanza uguale lungo la curva, a partire dal centro in alto, in senso orario: cosi' spegnendosi
 * dalla fine "mangiano" l'anello un pezzo alla volta. Se lo schermo e' troppo stretto per l'anello (telefono in verticale) la
 * curva si ferma a un margine dal bordo: li' le fiamme possono sfiorare le caselle piu' esterne, non c'e' altro posto.
 */
function calcolaPosizioni(n) {
    const W = window.innerWidth || 1; const H = window.innerHeight || 1;
    const m = Math.min(W, H);
    let l = Infinity; let t = Infinity; let r = -Infinity; let b = -Infinity;
    document.querySelectorAll('.field-slot').forEach((el) => {
        const q = el.getBoundingClientRect();
        if (q.width < 2 || q.height < 2) return;
        l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
    });
    if (!isFinite(l)) { l = W * 0.2; r = W * 0.8; t = H * 0.2; b = H * 0.8; }   // nessuna casella: un anello centrato
    const cx = (l + r) / 2; const cy = (t + b) / 2;
    const margine = m * 0.05; const bordo = m * 0.035;
    const a = Math.min((r - l) / 2 * 1.19 + margine, cx - bordo, W - cx - bordo);
    const bb = Math.min((b - t) / 2 * 1.19 + margine, cy - bordo, H - cy - bordo);
    // Si campiona la curva fitta e si prendono n punti equidistanti per lunghezza d'arco.
    const N = 720; const pts = [];
    for (let k = 0; k <= N; k++) {
        const ang = -Math.PI / 2 + 2 * Math.PI * k / N;      // da in alto, in senso orario (y verso il basso)
        const c = Math.cos(ang); const s = Math.sin(ang);
        pts.push({ x: cx + a * Math.sign(c) * Math.pow(Math.abs(c), 0.5), y: cy + bb * Math.sign(s) * Math.pow(Math.abs(s), 0.5) });
    }
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum[k] = cum[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
    const out = []; let k = 0;
    for (let i = 0; i < n; i++) {
        const target = cum[cum.length - 1] * i / n;
        while (k < cum.length - 2 && cum[k + 1] < target) k++;
        out.push({ x: pts[k].x / W, y: pts[k].y / H });
    }
    return out;
}
const VS = 'attribute vec2 aPos; varying vec2 vUv; void main(){ vUv=aPos*.5+.5; vUv.y=1.-vUv.y; gl_Position=vec4(aPos,0.,1.); }';

    function creaFS(n) {
        return `
precision mediump float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uT;
uniform float uBuio;
uniform float uV[${n}];
uniform vec2 uP[${n}];
float h(float k){return fract(sin(k*91.3458)*47453.5453);}
void main(){
  vec2 P=vUv*uRes;
  float m=min(uRes.x,uRes.y);
  // VELO: scurisce tutto, di piu' ai bordi
  float vig=smoothstep(.15,.95,length(vUv-vec2(.5,.52))*1.35);
  float buio=uBuio*(.62+.28*vig);
  vec3 rgb=vec3(0.);
  float luce=0.;
  for(int i=0;i<${n};i++){
    float fi=float(i);
    vec2 c=uP[i]*uRes;
    float life=uV[i];
    float sz=m*.045*(.35+.65*life);
    vec2 q=(P-c)/sz; q.y=-q.y;              // y verso l'alto
    // Fiamma: una goccia che si stringe in alto, con ondeggiamento
    float hh=clamp(q.y,-.6,2.4);
    float w=(1.-clamp(hh/2.3,0.,1.))*.62+.05;
    float wob=.22*sin(uT*6.+fi*2.1+hh*2.6)*clamp(hh,0.,2.)*.6+.06*sin(uT*11.+fi*5.);
    float dx=(q.x+wob)/w;
    float corpo=exp(-dx*dx*1.5)*smoothstep(-.6,.05,q.y)*smoothstep(2.4,1.2,q.y);
    float nucleo=exp(-dx*dx*5.)*smoothstep(-.4,.1,q.y)*smoothstep(1.3,.3,q.y);
    float sfarf=.85+.15*sin(uT*9.+fi*3.7+h(fi)*6.);
    float f=life*sfarf;
    vec3 col=mix(vec3(1.,.28,.04),vec3(1.,.72,.2),clamp(1.-hh/2.2,0.,1.));
    rgb+=col*corpo*f*1.25+vec3(1.,.95,.7)*nucleo*f*.9;
    // Alone sul campo scuro, tanto piu' forte quanto la fiamma e' viva
    float r=length(P-c)/(m*.16);
    luce+=exp(-r*r*2.2)*life*.55;
    rgb+=vec3(1.,.45,.1)*exp(-r*r*2.2)*life*.22;
    // Tizzone della fiamma spenta (ne resta il posto, cosi' si contano)
    float dr=length(P-c)/(m*.012);
    rgb+=vec3(.6,.08,.02)*exp(-dr*dr)*(1.-life)*.9;
  }
  luce=clamp(luce,0.,1.);
  float al=clamp(max(buio*(1.-luce*.8),max(rgb.r,max(rgb.g,rgb.b))),0.,1.);
  // premultiplied: il nero del velo ha colore 0, le fiamme sommano il loro
  gl_FragColor=vec4(min(rgb,vec3(1.)),al);
}`;
    }

    let ora = null;   // { layer, canvas?, gl?, rid, vive[], bersaglio[], t0, ... }

    function menoMovimento() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    function webglConsentito() {
        if (window.CONTO_ROVESCIA_WEBGL_OFF || menoMovimento()) return false;
        return !!(window.VideoQuality && typeof window.VideoQuality.isAlti === 'function' && window.VideoQuality.isAlti());
    }

    function compila(gl, tipo, src) {
        const o = gl.createShader(tipo); gl.shaderSource(o, src); gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(o));
        return o;
    }

    /** Smonta tutto, canvas compreso (e ne rilascia il contesto WebGL). */
    function rimuovi() {
        if (!ora) return;
        if (ora.rid) cancelAnimationFrame(ora.rid);
        window.removeEventListener('resize', misura);
        try { const e = ora.gl && ora.gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } catch (e) { /* niente */ }
        if (ora.layer && ora.layer.parentNode) ora.layer.parentNode.removeChild(ora.layer);
        ora = null;
    }

    function creaLayer() {
        const layer = document.createElement('div');
        layer.id = 'contoRovesciaLayer';
        layer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(layer);
        return layer;
    }

    /** Fiamme CSS: stessa disposizione dell'arco, usate quando il WebGL non c'e' o e' spento. */
    function montaCss(layer, n) {
        layer.classList.add('cr-css');
        const buio = document.createElement('div');
        buio.className = 'cr-buio';
        layer.appendChild(buio);
        const fiamme = [];
        for (let i = 0; i < n; i++) {
            const p = ora.pos[i];
            const f = document.createElement('span');
            f.className = 'cr-fiamma';
            f.style.left = (p.x * 100) + '%';
            f.style.top = (p.y * 100) + '%';
            f.style.animationDelay = (-(i * 0.37) % 2).toFixed(2) + 's';
            layer.appendChild(f);
            fiamme.push(f);
        }
        return fiamme;
    }

    function montaWebgl(layer, n) {
        const canvas = document.createElement('canvas');
        canvas.className = 'cr-canvas';
        const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
        if (!gl) return null;
        // highp serve per i gradienti larghi dello shader; senza, meglio le fiamme CSS.
        const hp = gl.getShaderPrecisionFormat && gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        if (!hp || hp.precision <= 0) return null;
        const prog = gl.createProgram();
        gl.attachShader(prog, compila(gl, gl.VERTEX_SHADER, VS));
        gl.attachShader(prog, compila(gl, gl.FRAGMENT_SHADER, creaFS(n)));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
        gl.useProgram(prog);
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const l = gl.getAttribLocation(prog, 'aPos'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
        const U = { uRes: gl.getUniformLocation(prog, 'uRes'), uT: gl.getUniformLocation(prog, 'uT'), uBuio: gl.getUniformLocation(prog, 'uBuio'), uV: gl.getUniformLocation(prog, 'uV'), uP: gl.getUniformLocation(prog, 'uP') };
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        layer.appendChild(canvas);
        return { canvas: canvas, gl: gl, U: U };
    }

    /** Ricalcola dove stanno le fiamme attorno al campo e lo riporta su canvas (uniform) e su fiamme CSS. */
    function aggiornaPosizioni() {
        if (!ora) return;
        ora.pos = calcolaPosizioni(ora.n);
        ora.posPiatte = new Float32Array(ora.n * 2);
        ora.pos.forEach((p, i) => { ora.posPiatte[i * 2] = p.x; ora.posPiatte[i * 2 + 1] = p.y; });
        if (ora.fiammeCss) ora.fiammeCss.forEach((f, i) => { f.style.left = (ora.pos[i].x * 100) + '%'; f.style.top = (ora.pos[i].y * 100) + '%'; });
    }

    function misura() {
        if (!ora || !ora.canvas) return;
        aggiornaPosizioni();
        const w = window.innerWidth || 1; const hgt = window.innerHeight || 1;
        // Luci morbide: poca risoluzione basta (e risparmia batteria sul telefono).
        const sc = Math.min(1, 900 / Math.max(w, hgt));
        ora.canvas.width = Math.max(32, Math.round(w * sc));
        ora.canvas.height = Math.max(32, Math.round(hgt * sc));
        ora.gl.viewport(0, 0, ora.canvas.width, ora.canvas.height);
    }

    function ciclo(ts) {
        if (!ora || !ora.gl) return;
        const t = ts / 1000;
        const dt = Math.min(0.1, ora.ultimo ? t - ora.ultimo : 0.016);
        ora.ultimo = t;
        // Ogni fiamma si avvicina al suo obiettivo (1 accesa, 0 spenta) in SPEGNIMENTO_S secondi.
        for (let i = 0; i < ora.n; i++) {
            const v = ora.vive[i]; const b = ora.bersaglio[i];
            ora.vive[i] = v < b ? Math.min(b, v + dt / SPEGNIMENTO_S) : Math.max(b, v - dt / SPEGNIMENTO_S);
        }
        ora.buio = Math.min(1, ora.buio + dt / 1.2);   // il campo si oscura piano, in poco piu' di un secondo
        const { gl, U } = ora;
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(U.uRes, ora.canvas.width, ora.canvas.height);
        gl.uniform1f(U.uT, t);
        gl.uniform1f(U.uBuio, ora.buio);
        gl.uniform1fv(U.uV, new Float32Array(ora.vive));
        gl.uniform2fv(U.uP, ora.posPiatte);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        ora.rid = requestAnimationFrame(ciclo);
    }

    /** Quante fiamme sono ancora accese per lo stato dato. */
    function fiammeAccese(c, turno) {
        return Math.max(0, Math.min(c.durata, c.durata - (turno - c.startTurn)));
    }

    /**
     * Allinea quello che si vede a `gameState.contoAllaRovescia`. Sicuro da chiamare a ogni ridisegno: se nulla e'
     * cambiato non fa niente, e senza un conto attivo toglie ogni traccia.
     */
    function sync() {
        const c = (typeof gameState !== 'undefined' && gameState) ? gameState.contoAllaRovescia : null;
        if (!c || !(c.durata > 0)) { rimuovi(); return; }
        const n = Math.min(MAX_FIAMME, c.durata);
        const accese = fiammeAccese(c, gameState.turn);
        // Un conto diverso da quello a schermo (altro duello, altra durata): si ricomincia.
        if (ora && (ora.n !== n || ora.start !== c.startTurn || ora.owner !== c.owner)) rimuovi();
        if (!ora) {
            const layer = creaLayer();
            let web = null;
            try { if (webglConsentito()) web = montaWebgl(layer, n); } catch (e) { web = null; layer.textContent = ''; }
            ora = { layer: layer, n: n, start: c.startTurn, owner: c.owner, buio: 0, vive: [], bersaglio: [], ultimo: 0, rid: 0 };
            for (let i = 0; i < n; i++) { ora.vive[i] = i < accese ? 1 : 0; ora.bersaglio[i] = ora.vive[i]; }
            aggiornaPosizioni();
            if (web) {
                ora.canvas = web.canvas; ora.gl = web.gl; ora.U = web.U;
                misura();
                window.addEventListener('resize', misura);
                ora.rid = requestAnimationFrame(ciclo);
            } else {
                ora.fiammeCss = montaCss(layer, n);
            }
        }
        for (let i = 0; i < n; i++) ora.bersaglio[i] = i < accese ? 1 : 0;
        aggiornaPosizioni();   // il campo puo' essersi spostato (rotazione, altro duello nella stessa pagina)
        if (ora.fiammeCss) ora.fiammeCss.forEach((f, i) => f.classList.toggle('cr-spenta', i >= accese));
    }

    window.ContoAllaRovescia = { sync: sync, fiammeAccese: fiammeAccese, rimuovi: rimuovi, posizioni: () => (ora ? ora.pos : null) };
})();
