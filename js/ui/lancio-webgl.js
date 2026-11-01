/**
 * lancio-webgl.js — il lancio di MONETA e DADO del duello in WebGL, con un vero oggetto 3D.
 * =====================================================================
 * Prima erano un'emoji che ruotava con una trasformazione CSS (effects.js: playCoinFlip/playDiceRoll). Ora un solo
 * shader disegna l'oggetto a "sphere tracing": una moneta d'oro col Sole su una faccia e la Luna sull'altra, incisi
 * nel metallo, o un dado d'avorio con i puntini scavati. Nessuna texture e nessun modello (funziona anche su file://).
 *
 * SOLO GRAFICA. L'esito e' GIA' deciso da chi chiama (in Multiplayer deve uscire uguale sui due client: vedi
 * `ctx.random` in duel-engine.js): qui si calcola la rotazione finale che porta la faccia giusta verso la camera, e
 * l'animazione ci arriva rallentando, SENZA rimbalzi (regola dei 3D del gioco). Il motore non aspetta niente.
 *
 * Il canvas e' proprio di ogni lancio e viene RILASCIATO alla fine (su telefono i contesti WebGL sono pochi).
 * Parte solo con Dettagli video "Alti", WebGL con highp e senza movimento ridotto; altrimenti `moneta`/`dado`
 * tornano false ed effects.js disegna la versione di sempre. `window.LANCIO_GL_OFF = true` la spegne;
 * `window.LANCIO_GL_T = <secondi>` congela il tempo (per guardarla in uno screenshot).
 */
(function () {
    'use strict';

    const DUR_MS = 2100;          // vita del lancio (sfondo compreso)
    const TUMBLE_S = 1.15;        // tempo in cui l'oggetto gira, poi riposa sulla faccia del risultato

    const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

    const FS = `
precision highp float;
uniform vec2 uR;
uniform float uMode;               // 0 moneta, 1 dado
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2;   // colonne della rotazione oggetto -> mondo
uniform vec3 uC;                   // centro in coordinate mondo
uniform float uS;                  // scala uniforme
const float RB = 1.7;

mat3 Rm(){ return mat3(uC0, uC1, uC2); }

// --- rilievi della moneta -------------------------------------------------------------------------------------------
float sole(vec2 u){
  float r = length(u);
  float disco = 1. - smoothstep(.25, .29, r);
  float a = atan(u.y, u.x);
  float k = abs(fract(a * 12. / 6.2831853) - .5) * 2.;
  float raggio = smoothstep(.5, .78, k) * step(.37, r) * (1. - step(.6, r));
  return max(disco, raggio);
}
float luna(vec2 u){
  float a = 1. - smoothstep(-.02, .02, length(u) - .46);
  float b = smoothstep(-.02, .02, length(u - vec2(.2, .09)) - .39);
  float stella = 1. - smoothstep(.0, .035, length(u - vec2(.46, -.3)) - .04);
  return max(a * b, stella);
}
float anello(float r){ return 1. - smoothstep(.012, .034, abs(r - .8)); }

float moneta(vec3 q){
  float rr = .06;
  vec2 w = vec2(length(q.xy) - (1. - rr), abs(q.z) - (.11 - rr));
  float d = min(max(w.x, w.y), 0.) + length(max(w, 0.)) - rr;
  vec2 u = q.z > 0. ? q.xy : vec2(q.x, -q.y);
  float m = max(q.z > 0. ? sole(u) : luna(u), anello(length(u)));
  return d + .024 * m;
}

// --- puntini del dado -------------------------------------------------------------------------------------------------
float pipDist(vec2 uv, float w, float n){
  float d = 10.;
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      float fi = float(i); float fj = float(j);
      bool on = false;
      if (i == 0 && j == 0) on = mod(n, 2.) > .5;
      else if (i == 0) on = false;
      else if (j == 0) on = n > 5.5;
      else if (i == j) on = n > 1.5;
      else on = n > 3.5;
      if (on) d = min(d, length(vec3(uv - vec2(fi, fj) * .29, w - .62)) - .1);
    }
  }
  return d;
}
// Facce: +z=1, -z=6, +x=3, -x=4, +y=2, -y=5 (le opposte fanno 7).
float pips(vec3 q){
  vec3 a = abs(q);
  if (a.z >= a.x && a.z >= a.y) return pipDist(vec2(q.x * sign(q.z), q.y), a.z, q.z > 0. ? 1. : 6.);
  if (a.x >= a.y) return pipDist(vec2(q.z * sign(q.x), q.y), a.x, q.x > 0. ? 3. : 4.);
  return pipDist(vec2(q.x, q.z * sign(q.y)), a.y, q.y > 0. ? 2. : 5.);
}
float dado(vec3 q){
  vec3 a = abs(q) - vec3(.5);
  float d = length(max(a, 0.)) + min(max(a.x, max(a.y, a.z)), 0.) - .12;
  return max(d, -pips(q));
}

float mondo(vec3 w){
  vec3 q = ((w - uC) * Rm()) / uS;
  return (uMode < .5 ? moneta(q) : dado(q)) * uS;
}

void main(){
  vec2 p = (gl_FragCoord.xy * 2. - uR) / uR.y;
  vec3 ro = vec3(0., 0., 5.);
  vec3 rd = normalize(vec3(p * .34, -1.));
  vec3 oc = ro - uC;
  float b = dot(oc, rd);
  float h = b * b - (dot(oc, oc) - RB * RB * uS * uS);
  if (h < 0.) { gl_FragColor = vec4(0.); return; }
  float t = max(-b - sqrt(h), 0.);
  float tmax = -b + sqrt(h);
  float hit = 0.; float dmin = 1e5; float tmin = t;
  for (int i = 0; i < 72; i++) {
    float d = mondo(ro + rd * t);
    if (d < dmin) { dmin = d; tmin = t; }
    if (d < .0012 * uS) { hit = 1.; break; }
    t += d * .85;
    if (t > tmax) break;
  }
  float pix = tmin * .68 / uR.y;
  float alfa = hit > .5 ? 1. : 1. - smoothstep(0., pix * 1.4, dmin);
  if (alfa <= .003) { gl_FragColor = vec4(0.); return; }
  t = hit > .5 ? t : tmin;
  vec3 w = ro + rd * t;
  float e = .0025 * uS;
  vec3 n = normalize(vec3(
    mondo(w + vec3(e, 0., 0.)) - mondo(w - vec3(e, 0., 0.)),
    mondo(w + vec3(0., e, 0.)) - mondo(w - vec3(0., e, 0.)),
    mondo(w + vec3(0., 0., e)) - mondo(w - vec3(0., 0., e))));
  vec3 q = ((w - uC) * Rm()) / uS;
  vec3 L = normalize(vec3(-.45, .62, .64));
  float dif = max(dot(n, L), 0.);
  vec3 r = reflect(rd, n);
  float fres = pow(1. - max(dot(n, -rd), 0.), 3.);
  vec3 col;
  if (uMode < .5) {
    vec2 u = q.z > 0. ? q.xy : vec2(q.x, -q.y);
    float inciso = max(q.z > 0. ? sole(u) : luna(u), anello(length(u)));
    vec3 oro = vec3(1., .76, .28) * (1. - .22 * inciso);
    vec3 amb = mix(vec3(.16, .1, .05), vec3(1., .86, .6), smoothstep(-.5, .9, r.y));
    amb += vec3(.85) * smoothstep(.6, .95, sin(r.x * 3.2 + r.y * 2.1));
    col = oro * (.2 + .5 * dif) + oro * amb * .5 + vec3(1., .95, .75) * pow(max(dot(r, L), 0.), 70.) * 1.1 + vec3(1., .8, .4) * fres * .45;
  } else {
    float pd = pips(q);
    float dentro = 1. - smoothstep(.0, .035, pd + .02);
    vec3 avorio = mix(vec3(.97, .92, .78), vec3(.24, .08, .04), dentro);
    vec3 amb = mix(vec3(.22, .17, .12), vec3(.95, .88, .72), smoothstep(-.5, .9, r.y));
    col = avorio * (.24 + .62 * dif) + avorio * amb * .22 + vec3(1., .96, .85) * pow(max(dot(r, L), 0.), 34.) * .55 + vec3(1., .8, .4) * fres * .3;
  }
  col = vec3(1.) - exp(-col * 1.25);
  gl_FragColor = vec4(col * alfa, alfa);
}`;

    function menoMovimento() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }
    function dettagliAlti() {
        return !window.VideoQuality || typeof window.VideoQuality.isAlti !== 'function' || window.VideoQuality.isAlti();
    }
    let provaGl = null;
    function webglAdatto() {
        if (provaGl === null) {
            try {
                const c = document.createElement('canvas');
                const g = c.getContext('webgl');
                const pr = g && g.getShaderPrecisionFormat(g.FRAGMENT_SHADER, g.HIGH_FLOAT);
                provaGl = !!(g && pr && pr.precision > 0);
                const x = g && g.getExtension('WEBGL_lose_context');
                if (x) x.loseContext();
            } catch (e) { provaGl = false; }
        }
        return provaGl;
    }
    function pronto() {
        return !window.LANCIO_GL_OFF && !menoMovimento() && dettagliAlti() && webglAdatto();
    }

    // --- piccola algebra 3x3 (matrici come array di tre righe) ---------------------------------------------------------
    const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
    function assangolo(ax, ang) {
        const l = Math.hypot(ax[0], ax[1], ax[2]);
        const x = ax[0] / l, y = ax[1] / l, z = ax[2] / l;
        const c = Math.cos(ang), s = Math.sin(ang), k = 1 - c;
        return [
            [c + x * x * k, x * y * k - z * s, x * z * k + y * s],
            [y * x * k + z * s, c + y * y * k, y * z * k - x * s],
            [z * x * k - y * s, z * y * k + x * s, c + z * z * k]
        ];
    }
    const RX = (a) => assangolo([1, 0, 0], a);
    const RY = (a) => assangolo([0, 1, 0], a);
    const RZ = (a) => assangolo([0, 0, 1], a);
    /** Rotazione che porta la faccia con normale `n` (locale) verso +z, cioe' verso la camera. */
    function portaAvanti(n) {
        if (n[2] > .999) return RX(0);
        if (n[2] < -.999) return RX(Math.PI);
        // asse = n x z, angolo = acos(n.z)
        const ax = [n[1], -n[0], 0];
        return assangolo(ax, Math.acos(n[2]));
    }
    // Normale locale della faccia di ogni numero del dado (vedi pips() nello shader).
    const FACCE_DADO = { 1: [0, 0, 1], 6: [0, 0, -1], 3: [1, 0, 0], 4: [-1, 0, 0], 2: [0, 1, 0], 5: [0, -1, 0] };

    /**
     * Fa partire il lancio. `modo` 0 = moneta, 1 = dado; `faccia`: per la moneta true = Testa (Sole), per il dado 1-6.
     * Torna true se l'ha preso in carico.
     */
    function lancia(modo, faccia, etichetta) {
        if (!pronto()) return false;
        const sfondo = document.createElement('div');
        sfondo.className = 'fx-randomizer-backdrop';
        sfondo.style.animationDuration = (DUR_MS / 1000) + 's';
        const lato = Math.round(Math.min(window.innerWidth, window.innerHeight) * .62);
        const canvas = document.createElement('canvas');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = canvas.height = Math.max(160, Math.round(lato * dpr));
        canvas.style.cssText = `width:${lato}px;height:${lato}px;filter:drop-shadow(0 0 22px rgba(243,156,18,.45));`;
        canvas.setAttribute('aria-hidden', 'true');
        const gl = /** @type {WebGLRenderingContext|null} */ (canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false }));
        if (!gl) return false;
        const sh = (tipo, src) => {
            const o = gl.createShader(tipo);
            if (!o) return null;
            gl.shaderSource(o, src); gl.compileShader(o);
            if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { window.LANCIO_GL_ERRORE = String(gl.getShaderInfoLog(o)); return null; }
            return o;
        };
        const vs = sh(gl.VERTEX_SHADER, VS); const fs = sh(gl.FRAGMENT_SHADER, FS);
        const prog = gl.createProgram();
        const rilascia = () => { try { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) { /* gia' perso */ } };
        if (!vs || !fs || !prog) { rilascia(); return false; }
        gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { rilascia(); return false; }
        gl.useProgram(prog);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        const u = (nome) => gl.getUniformLocation(prog, nome);

        sfondo.appendChild(canvas);
        const scritta = document.createElement('div');
        scritta.className = modo === 0 ? 'fx-coinflip-label' : 'fx-dice-label';
        scritta.textContent = etichetta;
        scritta.style.marginTop = Math.round(lato * .36) + 'px';
        scritta.style.animationDelay = (TUMBLE_S - .05) + 's';
        sfondo.appendChild(scritta);
        document.body.appendChild(sfondo);

        // Orientamento finale: la faccia del risultato verso la camera, con una leggera inclinazione che lascia
        // vedere lo spessore (senza, una moneta di fronte sembrerebbe un disco piatto).
        const portata = modo === 0 ? (faccia ? RX(0) : RX(Math.PI)) : portaAvanti(FACCE_DADO[faccia] || FACCE_DADO[1]);
        const vista = mul(RX(.42), RY(modo === 0 ? -.22 : -.5));
        const asse = modo === 0 ? [1, .16, .05] : [.7, .55, .4];
        const giri = modo === 0 ? 7 : 3.4;
        const t0 = performance.now();
        let fine = false;
        const chiudi = () => { if (fine) return; fine = true; sfondo.remove(); rilascia(); };
        const frame = () => {
            if (fine) return;
            const t = typeof window.LANCIO_GL_T === 'number' ? window.LANCIO_GL_T : (performance.now() - t0) / 1000;
            if (t * 1000 > DUR_MS) { chiudi(); return; }
            const p = Math.min(t / TUMBLE_S, 1);
            const ease = 1 - Math.pow(1 - p, 3);                        // decelera fino a fermarsi: niente rimbalzi
            const ang = giri * 2 * Math.PI * (1 - ease);
            const R = mul(vista, mul(assangolo(asse, ang), portata));
            const alto = .5 * Math.sin(Math.PI * p);                   // lancio verso l'alto e ritorno al centro
            const scala = (.62 + .38 * (1 - Math.pow(1 - Math.min(t / .5, 1), 3))) * (1 + .1 * Math.sin(Math.PI * p));
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.uniform2f(u('uR'), canvas.width, canvas.height);
            gl.uniform1f(u('uMode'), modo);
            gl.uniform3f(u('uC0'), R[0][0], R[1][0], R[2][0]);
            gl.uniform3f(u('uC1'), R[0][1], R[1][1], R[2][1]);
            gl.uniform3f(u('uC2'), R[0][2], R[1][2], R[2][2]);
            gl.uniform3f(u('uC'), 0, alto, 0);
            gl.uniform1f(u('uS'), scala);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        // Rete di sicurezza: se i fotogrammi si fermano (scheda in secondo piano) lo sfondo non resta a vita.
        setTimeout(chiudi, DUR_MS + 400);
        return true;
    }

    window.LancioGL = {
        pronto,
        /** @param {boolean} testa */
        moneta(testa) { return lancia(0, !!testa, testa ? 'TESTA' : 'CROCE'); },
        /** @param {number} risultato 1-6 */
        dado(risultato) { const n = Math.min(6, Math.max(1, Math.round(risultato) || 1)); return lancia(1, n, `RISULTATO: ${n}`); }
    };
})();
