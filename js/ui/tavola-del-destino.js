/**
 * tavola-del-destino.js — Tavola del Destino (Destiny Board): campo nel Regno delle Ombre e lettere di FUMO.
 * ---------------------------------------------------------------------------------------------------------
 * Le 5 carte (id 866 Tavola del Destino + 867-870 Spirit Message) scoperte in zona Magia/Trappola scrivono insieme la
 * parola DEATH (D-E-A-T-H, come le lettere dipinte sulle illustrazioni delle carte; il banner di vittoria dice lo stesso).
 * Qui si legge SOLO lo stato del Terreno, a ogni ridisegno (`sync`, chiamato da ridisegnaDuello come DuelFeedback), e si disegna:
 *   - appena una delle cinque e' scoperta, il campo si oscura nel Regno delle Ombre: velo viola-nero con nebbia che
 *     scorre, SOTTO le carte (z-index 1; `.game-container` sta a 2), piu' fitto con l'aumentare delle carte;
 *   - sopra ogni carta scoperta, la sua lettera SCRITTA CON IL FUMO: la forma della lettera (un atlante di glifi) passa
 *     per uno shader che la deforma con turbolenza che scorre, la sfuma e ne stacca code di fumo che salgono. Quando la
 *     carta compare la lettera si "scrive" dall'alto verso il basso, dentro una nebbia che si raccoglie; poi respira.
 * Nessuna regola qui: carte e vittoria stanno nel motore (card-effects-7.js, hasDestinyBoardComplete in fasi.js).
 *
 * Il fumo e' una tela WebGL a tutto schermo con un quadrato per lettera (si dipinge solo li'), con i Dettagli video "Alti"
 * e senza movimento ridotto; altrimenti restano il velo scuro e le lettere come testo sfumato. L'atlante dei glifi e' una
 * tela 2D (funziona anche su file://: non e' un'immagine caricata). La tela WebGL esiste solo mentre c'e' una lettera.
 */
(function () {
    'use strict';

    const LETTERE = { 866: 'D', 867: 'E', 868: 'A', 869: 'T', 870: 'H' };
    const ORDINE = ['D', 'E', 'A', 'T', 'H'];   // colonna di ogni lettera nell'atlante
    const CELLA = 256;                          // lato di una cella dell'atlante (px)

    // Il quadrato di ogni lettera in coordinate locali: la lettera sta in 0..1, il resto e' margine per code e volute.
    const LOC = { x0: -0.35, x1: 1.35, y0: -1.0, y1: 1.3 };

    let layer = null;        // il velo scuro (div)
    let testi = null;        // le lettere di ripiego (solo senza WebGL)
    let tela = null;
    let gl = null;
    let prog = null;
    let U = null;
    let rid = 0;
    const lettere = new Map();   // uid -> { uid, lettera, nato, x, y, s, visibile, seme }

    function menoMovimento() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }
    function fumoConsentito() {
        if (window.TAVOLA_DESTINO_FUMO_OFF || menoMovimento()) return false;
        return !!(window.VideoQuality && typeof window.VideoQuality.isAlti === 'function' && window.VideoQuality.isAlti());
    }

    /** Le carte delle cinque scoperte nelle zone Magia/Trappola di entrambi i lati: [{ uid, id }]. */
    function carteInGioco() {
        const out = [];
        if (typeof gameState === 'undefined' || !gameState) return out;
        ['player', 'bot'].forEach((posto) => {
            let st = [];
            try { st = Tavolo.magieTrappole(posto) || []; } catch (e) { st = []; }
            st.forEach((slot) => {
                if (slot && slot.card && !slot.isFaceDown && LETTERE[slot.card.id]) out.push({ uid: slot.card.uid, id: slot.card.id });
            });
        });
        return out;
    }

    // ---------- Il velo: Regno delle Ombre ----------
    function montaVelo() {
        if (layer) return;
        layer = document.createElement('div');
        layer.id = 'tavolaDestinoLayer';
        layer.setAttribute('aria-hidden', 'true');
        layer.innerHTML = '<div class="td-buio"></div><div class="td-nebbia td-nebbia-a"></div><div class="td-nebbia td-nebbia-b"></div><div class="td-nebbia td-nebbia-c"></div>';
        document.body.appendChild(layer);
    }

    // ---------- Il fumo (WebGL) ----------
    const VS = `
attribute vec2 aQ;                 // angolo del quadrato, 0..1
uniform vec2 uRes;                 // px CSS dello schermo
uniform vec4 uBox;                 // lettera: centro x, centro y, lato, (non usato)
uniform vec4 uLoc;                 // x0, x1, y0, y1 in coordinate locali
varying vec2 vP;
void main(){
  vP = vec2(mix(uLoc.x, uLoc.y, aQ.x), mix(uLoc.z, uLoc.w, aQ.y));
  vec2 px = uBox.xy + (vP - .5) * uBox.z;          // la lettera (0..1) e' centrata su (x, y)
  vec2 c = px / uRes * 2. - 1.;
  gl_Position = vec4(c.x, -c.y, 0., 1.);
}`;

    const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vP;
uniform sampler2D uAtl;
uniform float uIdx;                // colonna della lettera nell'atlante
uniform float uT;                  // secondi
uniform float uEta;                // secondi dalla comparsa della carta
uniform float uSeme;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h2(i), h2(i + vec2(1., 0.)), f.x), mix(h2(i + vec2(0., 1.)), h2(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * nz(p); p = p * 2.03 + 11.7; a *= .5; } return s; }
// Glifo: x = nitido (corpo), y = sfumato (alone). Fuori dalla cella: niente.
vec2 glifo(vec2 p){
  if (p.x < 0. || p.x > 1. || p.y < 0. || p.y > 1.) return vec2(0.);
  vec2 uv = vec2((uIdx + p.x) / 5., p.y * .5);
  return vec2(texture2D(uAtl, uv).r, texture2D(uAtl, uv + vec2(0., .5)).r);
}
void main(){
  vec2 p = vP;
  float t = uT;
  // Scrittura: la lettera si forma dall'alto in basso e dal disordine all'ordine (f: 0 -> 1 in ~3 s)
  float f = clamp(uEta / 3.2, 0., 1.);
  float disord = 1. - smoothstep(0., 1., f);
  // Turbolenza che scorre verso l'alto: piu' forte alla comparsa e nelle code
  vec2 q = p * 3.2 + vec2(uSeme, 0.);
  vec2 w = vec2(fbm(q + vec2(0., -t * .35)), fbm(q + vec2(5.2, 1.3) - vec2(0., t * .30))) - .5;
  float amp = .055 + .22 * disord;
  // Corpo e code di fumo: ogni passo campiona un po' piu' IN BASSO (il fumo che sale viene dalla lettera) con piu' deformazione
  float dens = 0.;
  for (int k = 0; k < 7; k++) {
    float fk = float(k);
    vec2 pk = p + vec2(0., fk * .052) + w * (amp + fk * .045);
    vec2 g = glifo(pk);
    float peso = (k == 0) ? 1. : exp(-fk * .55) * .65;
    dens += (g.x * .75 + g.y * .6) * peso;
  }
  // Rivelazione: la lettera appare scritta dall'alto, con il bordo mosso dalla nebbia
  float rev = smoothstep(0., .22, f * 1.55 - p.y * .75 - w.x * .35);
  dens *= rev;
  // Venature di fumo dentro la forma (nuvole piu' dense e piu' rade)
  float ven = .35 + 1.15 * fbm(p * 5.5 + vec2(uSeme * 1.7, -t * .45) + w * 2.);
  dens *= ven;
  // Respiro lento
  dens *= .88 + .12 * sin(t * 1.3 + uSeme);
  dens = clamp(dens, 0., 1.);
  float a = smoothstep(.05, .95, dens) * .8;
  // Colore: fumo viola in ombra, quasi bianco-lilla dove e' denso
  vec3 col = mix(vec3(.42, .26, .72), vec3(.96, .90, 1.), smoothstep(.15, 1., dens));
  col += vec3(.25, .10, .45) * (1. - dens) * .35;
  gl_FragColor = vec4(col * a, a);
}`;

    function compila(tipo, src) {
        const o = gl.createShader(tipo); gl.shaderSource(o, src); gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(o));
        return o;
    }

    /** L'atlante dei glifi: riga alta = lettera nitida, riga bassa = la stessa sfumata (alone). Una tela 2D, niente immagini. */
    function creaAtlante() {
        const c = document.createElement('canvas');
        c.width = CELLA * ORDINE.length; c.height = CELLA * 2;
        const x = c.getContext('2d');
        x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = `900 ${Math.round(CELLA * 0.86)}px Impact, "Arial Black", "Segoe UI Black", sans-serif`;
        ORDINE.forEach((l, i) => {
            const cx = i * CELLA + CELLA / 2; const cy = CELLA / 2 + CELLA * 0.04;
            x.fillStyle = '#fff'; x.shadowColor = 'transparent'; x.shadowBlur = 0;
            x.fillText(l, cx, cy);
            // sfumato: il testo dipinto fuori dalla tela e la sua ombra sfocata portata dentro (funziona anche senza ctx.filter)
            x.save();
            x.beginPath(); x.rect(i * CELLA, CELLA, CELLA, CELLA); x.clip();
            x.shadowColor = '#fff'; x.shadowBlur = CELLA * 0.09; x.shadowOffsetX = 4000;
            for (let r = 0; r < 2; r++) x.fillText(l, cx - 4000, cy + CELLA);
            x.restore();
        });
        return c;
    }

    function montaTela() {
        if (tela) return true;
        try {
            const c = document.createElement('canvas');
            c.id = 'tavolaDestinoFumo';
            c.setAttribute('aria-hidden', 'true');
            const ctxGl = c.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
            if (!ctxGl) return false;
            gl = ctxGl;
            prog = gl.createProgram();
            gl.attachShader(prog, compila(gl.VERTEX_SHADER, VS));
            gl.attachShader(prog, compila(gl.FRAGMENT_SHADER, FS));
            gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
            gl.useProgram(prog);
            const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
            const l = gl.getAttribLocation(prog, 'aQ'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
            U = {};
            ['uRes', 'uBox', 'uLoc', 'uAtl', 'uIdx', 'uT', 'uEta', 'uSeme'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, creaAtlante());
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.uniform1i(U.uAtl, 0);
            gl.uniform4f(U.uLoc, LOC.x0, LOC.x1, LOC.y0, LOC.y1);
            gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            document.body.appendChild(c);
            tela = c;
            misuraTela();
            window.addEventListener('resize', onResize);
            rid = requestAnimationFrame(ciclo);
            return true;
        } catch (e) {
            smontaTela();
            return false;
        }
    }

    function misuraTela() {
        if (!tela) return;
        const w = Math.max(32, window.innerWidth); const h = Math.max(32, window.innerHeight);
        // Risoluzione piena fino a 2x (i bordi del fumo devono restare morbidi ma la lettera leggibile), con un tetto di pixel
        const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2500000 / (w * h)));
        tela.width = Math.round(w * dpr); tela.height = Math.round(h * dpr);
        gl.viewport(0, 0, tela.width, tela.height);
    }

    function ciclo(ts) {
        if (!tela || !gl) return;
        const t = ts / 1000;
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(U.uRes, window.innerWidth, window.innerHeight);
        gl.uniform1f(U.uT, t);
        lettere.forEach((L) => {
            if (!L.visibile) return;
            gl.uniform4f(U.uBox, L.x, L.y, L.s, 0);
            gl.uniform1f(U.uIdx, ORDINE.indexOf(L.lettera));
            gl.uniform1f(U.uEta, Math.max(0, t - L.nato));
            gl.uniform1f(U.uSeme, L.seme);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        });
        rid = requestAnimationFrame(ciclo);
    }

    function onResize() { misuraTela(); posiziona(); }

    function smontaTela() {
        if (rid) cancelAnimationFrame(rid);
        rid = 0;
        window.removeEventListener('resize', onResize);
        try { const e = gl && gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } catch (e) { /* niente */ }
        if (tela && tela.parentNode) tela.parentNode.removeChild(tela);
        tela = null; gl = null; prog = null; U = null;
    }

    /** Rilegge dove sta ogni carta (rettangolo a schermo) e ci appoggia la lettera: centrata SOPRA la carta. */
    function posiziona() {
        lettere.forEach((L) => {
            const el = document.querySelector(`#playerFieldBoard [data-uid="${L.uid}"], #botFieldBoard [data-uid="${L.uid}"]`);
            if (!el) { L.visibile = false; return; }
            const q = el.getBoundingClientRect();
            if (q.width < 2) { L.visibile = false; return; }
            L.visibile = true;
            const lato = Math.max(q.width, q.height);
            L.s = lato * 1.25;
            L.x = q.left + q.width / 2;
            L.y = q.top - q.height * 0.42;
        });
    }

    /** Lettere di ripiego (senza WebGL): testo sfumato, una per carta, che respira. */
    function sincronizzaTesto(carte) {
        // Le lettere stanno in un contenitore PROPRIO sul body: il velo e' uno strato a z-index 1 (sotto le carte) e il suo
        // z-index interno non uscirebbe da li'.
        if (!testi) { testi = document.createElement('div'); testi.id = 'tavolaDestinoTesti'; testi.setAttribute('aria-hidden', 'true'); document.body.appendChild(testi); }
        testi.querySelectorAll('.td-lettera').forEach((e) => { if (!carte.some((c) => c.uid === e.dataset.uid)) e.remove(); });
        carte.forEach((c) => {
            const L = lettere.get(c.uid);
            let el = testi.querySelector(`.td-lettera[data-uid="${c.uid}"]`);
            if (!el) {
                el = document.createElement('div');
                el.className = 'td-lettera'; el.dataset.uid = c.uid; el.textContent = LETTERE[c.id];
                testi.appendChild(el);
            }
            if (L && L.visibile) {
                el.style.left = L.x + 'px'; el.style.top = L.y + 'px'; el.style.fontSize = (L.s * 0.9) + 'px';
                el.style.display = '';
            } else el.style.display = 'none';
        });
    }

    function rimuoviTutto() {
        smontaTela();
        lettere.clear();
        if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
        layer = null;
        if (testi) { testi.remove(); testi = null; }
    }

    /**
     * Allinea quello che si vede alle carte scoperte. Sicuro a ogni ridisegno: senza nessuna delle cinque toglie ogni
     * traccia (anche cambiando duello: `gameState` nuovo).
     */
    function sync() {
        const carte = carteInGioco();
        if (!carte.length) { if (layer || tela) rimuoviTutto(); return; }
        montaVelo();
        // Piu' carte della parola sono in gioco, piu' fitto e' il buio (0,55 con una, 1 con tutte e cinque).
        layer.style.setProperty('--td-intensita', String(0.55 + 0.1125 * Math.min(5, carte.length)));
        const ora = performance.now() / 1000;
        const uids = new Set(carte.map((c) => c.uid));
        lettere.forEach((_, uid) => { if (!uids.has(uid)) lettere.delete(uid); });
        carte.forEach((c) => {
            if (!lettere.has(c.uid)) lettere.set(c.uid, { uid: c.uid, lettera: LETTERE[c.id], nato: ora, x: 0, y: 0, s: 80, visibile: false, seme: Math.random() * 40 });
        });
        posiziona();
        if (fumoConsentito() && montaTela()) {
            if (testi) { testi.remove(); testi = null; }
        } else {
            smontaTela();
            sincronizzaTesto(carte);
        }
    }

    window.TavolaDestino = { sync: sync, rimuovi: rimuoviTutto, lettere: () => Array.from(lettere.values()).map((L) => ({ uid: L.uid, lettera: L.lettera, visibile: L.visibile })) };
})();
