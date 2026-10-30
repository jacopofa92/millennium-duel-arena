// @ts-check
/**
 * catena-webgl.js — la Catena (Chain) in WebGL, nello stile di Master Duel.
 * ------------------------------------------------------------------------------------------------
 * Rimpiazza il vecchio pannello laterale (#chainStack, DOM, in game-flow.js `renderChainStack`) con una SCENA A TUTTO SCHERMO:
 *   - il mondo si oscura e dalla carta che si attiva ai Link precedenti corre una CATENA di acciaio vera (maglie che si
 *     incastrano, disegnate da uno shader: niente immagini, funziona anche su file://);
 *   - ogni Link e' la carta del gioco (createCardElement, quindi la NOSTRA grafica) che "piomba" sulla scena con un'onda
 *     d'urto, un numero luminoso al suo angolo e la scritta CATENA; il colore dice di chi e' (azzurro tu, rosso l'avversario);
 *   - alla RISOLUZIONE (dall'ultimo al primo, come nelle regole) la carta in corso si ingrandisce e si accende, la maglia
 *     che la regge si spezza in scintille, poi la carta svanisce e si passa alla precedente;
 *   - finita la Catena la scena si chiude da sola e il canvas viene RILASCIATO (`loseContext`: su telefono i contesti sono pochi).
 *
 * COME SI AGGANCIA: `renderChainStack` (game-flow.js) chiama `CatenaGL.aggiorna(displayLinks, resolvingLink)` ad ogni Link
 * aggiunto o risolto. Se torna `true` la scena se ne occupa e il vecchio pannello resta spento; se torna `false` (WebGL
 * assente, "Dettagli video: Normali", movimento ridotto, spento a mano, guasto) vale il pannello di sempre. Il motore non sa
 * nulla di tutto questo: la regola e' quella di prima, qui si disegna soltanto.
 *
 * UN SOLO LINK NON FA SCENA: come in Master Duel la scena nasce al SECONDO Link. Una carta che si attiva da sola ha gia' la
 * sua carta a centro schermo (`FX.playCardActivateCenterScreen`); la scena della Catena non deve coprirla.
 *
 * SOPRA IL DUELLO, SOTTO I MODALI: il canvas sta a z-index 10086 e non intercetta il tocco (`pointer-events: none`); la
 * finestra "Rispondere?" e tutti i modali stanno a 100000, quindi restano cliccabili e davanti alla scena.
 *
 * PER PROVARLA senza giocare: duello aperto con "Dettagli video: Alti", poi da console
 *   gameState.chain = { active: true, links: [...] }; renderChainStack();
 * (vedi tests/specs/catena-webgl.spec.js). `window.CATENA_GL_OFF = true` la spegne.
 */
(function () {
    'use strict';

    const Z_ROOT = 10086;
    const MAX_ANCORE = 8;           // l'ultimo N di maglie disegnate dallo shader; le carte in piu' restano nel DOM
    const RAPPORTO = 0.685;         // larghezza / altezza di una carta (--card-ratio in card.css)
    const DUR_PIOMBO_MS = 430;      // quanto ci mette una carta a cadere sulla scena
    const ISTANTE_COLPO_MS = 300;   // dentro il volo, quando tocca: onda, scossa, numero
    const DUR_CHIUSURA_MS = 480;

    // =================================================================================================================
    // Lo shader: UNA catena fra le carte, onde d'urto, buio attorno. Unita' in pixel CSS (y verso il BASSO).
    // =================================================================================================================
    const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const FS = `
precision highp float;
uniform vec2 r;          // dimensione del canvas in pixel
uniform float k;         // pixel CSS per pixel del canvas
uniform float uT;
uniform float uL;        // dimensione di una maglia, in pixel CSS
uniform float uN;        // numero di tratti di catena
uniform vec2 uPa[7];     // inizio di ogni tratto (sul bordo della carta da cui parte)
uniform vec2 uPb[7];     // fine di ogni tratto (sul bordo della carta a cui arriva)
uniform vec3 uS[7];      // per tratto: x = quanto e' disegnato 0..1, y = quanto e' spezzato 0..1, z = 0 tuo / 1 avversario
uniform float uF[7];     // lampo del tratto (una carta e' appena piombata)
uniform vec4 uB[3];      // onde d'urto: x, y, eta' in secondi (<0 = spenta), tipo (0 azzurro, 1 rosso, 2 oro)

vec3 own(float o){ return mix(vec3(.28,.86,1.), vec3(1.,.3,.24), o); }

// Capsula con l'asse sul segmento (-a,0)-(a,0): torna la distanza col raggio b tolto, e la direzione del gradiente.
float cap(vec2 p, float a, float b, out vec2 g){
  vec2 v = p - vec2(clamp(p.x, -a, a), 0.);
  float d = length(v);
  g = d > 1e-4 ? v / d : vec2(0., 1.);
  return d - b;
}

void tratto(vec2 P, vec2 A, vec2 B, vec3 st, float fl, float idx, inout vec4 col, inout vec3 glow){
  vec2 d = B - A;
  float len = max(length(d), 1.);
  vec2 dir = d / len;
  vec2 nr = vec2(-dir.y, dir.x);
  vec2 q = P - A;
  float s = dot(q, dir);
  float c = dot(q, nr);
  float rev = st.x * (len + uL * .5);
  float m = len * .5;
  float gap = st.y * len * .62;
  vec3 oc = own(st.z);

  // Scintille alla testa della catena che si disegna e ai due capi dello spezzamento.
  if (st.x > .01 && st.x < .995) glow += vec3(1., .92, .7) * exp(-length(P - (A + dir * rev)) / (uL * .55)) * 1.3;
  if (st.y > .001 && st.y < .98) {
    float fa = (1. - st.y) * 1.2;
    glow += vec3(1., .8, .4) * (exp(-length(P - (A + dir * (m - gap))) / (uL * .7)) + exp(-length(P - (A + dir * (m + gap))) / (uL * .7))) * fa;
  }

  if (s < -uL * .6 || s > len + uL * .6 || abs(c) > uL * 1.3) return;

  float vis = 1. - smoothstep(rev - k * 2., rev + k * 2., s);
  if (st.y > .001) vis *= 1. - smoothstep(m - gap - k * 3., m - gap, s) * (1. - smoothstep(m + gap, m + gap + k * 3., s));
  if (vis <= .001) return;

  float pitch = uL * .72;
  float kk = floor(s / pitch);
  float Ha = uL * .5;
  float Hb = uL * .30;
  float t = uL * .09;
  float bestZ = -1e4;
  float bestD = 1e4;
  float bestCov = 0.;
  vec3 bestC = vec3(0.);
  for (int j = -1; j <= 1; j++) {
    float kc = kk + float(j);
    float u = s - (kc + .5) * pitch;
    bool ring = mod(kc, 2.) < .5;
    vec2 p = vec2(u, c);
    vec2 g;
    float dd;
    float rr;
    vec2 n2;
    float zf;
    if (ring) {
      // Maglia vista di fronte: un anello a stadio, a sezione tonda.
      float sd = cap(p, Ha - Hb, Hb, g);
      float ax = abs(sd);
      dd = ax - t;
      rr = clamp(ax / t, 0., 1.);
      n2 = g * (sd >= 0. ? 1. : -1.) * rr;
      zf = c;
    } else {
      // Maglia vista di taglio: una barretta tonda.
      float tb = t * 1.3;
      float sd = cap(p, Ha * .78 - tb, tb, g);
      dd = sd;
      rr = clamp((sd + tb) / tb, 0., 1.);
      n2 = g * rr;
      zf = -c;
    }
    float cov = 1. - smoothstep(-k, k, dd);
    bestD = min(bestD, dd);
    if (cov > .3 && zf > bestZ) {
      vec2 nw = dir * n2.x + nr * n2.y;
      float h = sqrt(max(0., 1. - rr * rr));
      vec3 n = normalize(vec3(nw, h));
      vec3 Ld = normalize(vec3(-.5, -.62, .62));
      float df = max(dot(n, Ld), 0.);
      float sp = pow(max(dot(reflect(-Ld, n), vec3(0., 0., 1.)), 0.), 30.);
      float env = smoothstep(.35, .65, n.y * .5 + .5);
      vec3 steel = mix(vec3(.10, .12, .17), vec3(.74, .80, .92), .22 + .6 * df + .25 * env);
      steel *= 1. - .5 * rr * rr * rr;
      steel += vec3(1., .98, .92) * sp * 1.25;
      steel = mix(steel, steel * oc * 1.5, .16);
      bestZ = zf;
      bestCov = cov;
      bestC = steel;
    }
  }

  // Un'onda di luce corre lungo la catena (energia che passa da un Link all'altro).
  float pp = fract(uT * .5 + idx * .31) * (len + uL);
  float pulse = exp(-pow((s - pp) / (uL * 1.3), 2.));
  float flash = fl * exp(-pow((s - len * .5) / (len * .7), 2.));
  bestC += oc * (pulse * .9 + flash * .9) + vec3(1.) * flash * .5;

  float cv = bestCov * vis;
  col.rgb = bestC * cv + col.rgb * (1. - cv);
  col.a = cv + col.a * (1. - cv);
  // Ombra morbida attorno alle maglie, e alone del colore di chi ha attivato il Link.
  float sh = (1. - smoothstep(0., uL * .32, bestD)) * .5 * vis * (1. - cv);
  col.a = col.a + sh * (1. - col.a);
  glow += oc * exp(-max(bestD, 0.) / (uL * .22)) * vis * (.2 + pulse * .8 + flash * 1.6);
}

void main(){
  vec2 P = vec2(gl_FragCoord.x, r.y - gl_FragCoord.y) * k;
  vec4 col = vec4(0.);
  vec3 glow = vec3(0.);
  for (int i = 0; i < 7; i++) {
    if (float(i) >= uN) break;
    tratto(P, uPa[i], uPb[i], uS[i], uF[i], float(i), col, glow);
  }
  for (int b = 0; b < 3; b++) {
    float age = uB[b].z;
    if (age < 0.) continue;
    float dist = length(P - uB[b].xy);
    float typ = uB[b].w;
    vec3 bc = typ < .5 ? own(0.) : (typ < 1.5 ? own(1.) : vec3(1., .82, .4));
    float rad = (1. - exp(-age * 3.6)) * uL * 14.;
    float th = uL * (.35 + age * .9);
    float ring = exp(-pow((dist - rad) / th, 2.)) * exp(-age * 2.6);
    float fl = exp(-dist / (uL * 2.2)) * exp(-age * 7.);
    glow += bc * ring * 1.1 + vec3(1.) * fl * 1.1 + bc * fl * .8;
  }
  // Il buio attorno e' un velo DOM sotto le carte (.cgl-buio): qui si disegna solo cio' che sta SOPRA le carte.
  vec3 L = vec3(1.) - exp(-glow * 1.1);
  gl_FragColor = vec4(col.rgb + L, col.a);
}`;

    // =================================================================================================================
    // Condizioni per partire
    // =================================================================================================================
    function menoMovimento() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    function dettagliAlti() {
        return !window.VideoQuality || typeof window.VideoQuality.isAlti !== 'function' || window.VideoQuality.isAlti();
    }

    let provaGl = null;
    /** WebGL con highp nel fragment shader (le maglie sottili lo vogliono): una sola prova, in cache. */
    function webglAdatto() {
        if (provaGl === null) {
            try {
                const c = document.createElement('canvas');
                const g = c.getContext('webgl');
                const pr = g && g.getShaderPrecisionFormat(g.FRAGMENT_SHADER, g.HIGH_FLOAT);
                provaGl = !!(g && pr && pr.precision > 0);
                const e = g && g.getExtension('WEBGL_lose_context');
                if (e) e.loseContext();
            } catch (e) { provaGl = false; }
        }
        return provaGl;
    }

    let guasto = false;   // se la scena non riesce a partire (shader, contesto) si resta sul pannello di sempre
    function pronta() {
        return !guasto && !window.CATENA_GL_OFF && !menoMovimento() && dettagliAlti() && webglAdatto();
    }

    // =================================================================================================================
    // Stile del DOM (carte, numeri, scritta)
    // =================================================================================================================
    let stileIniettato = false;
    function iniettaStile() {
        if (stileIniettato) return;
        stileIniettato = true;
        const s = document.createElement('style');
        s.id = 'catenaGLStile';
        s.textContent = `
#catenaGL{position:fixed;inset:0;z-index:${Z_ROOT};pointer-events:none;overflow:hidden;transform-origin:0 50%;
  transition:opacity ${DUR_CHIUSURA_MS}ms ease,transform .55s cubic-bezier(.2,.8,.2,1)}
/* RISOLUZIONE: la scena si riduce a una striscia sul bordo sinistro e il velo scuro sparisce, cosi' gli effetti che si risolvono
   sotto (distruzioni, danni, Evocazioni) restano TUTTI visibili. Durante la costruzione della Catena torna a tutto schermo. */
#catenaGL.cgl-compatta{transform:translateX(4px) scale(.26)}
#catenaGL.cgl-compatta .cgl-buio{opacity:0!important}
#catenaGL.cgl-compatta .cgl-titolo{display:none}
#catenaGL canvas{position:absolute;left:0;top:0;width:100%;height:100%}
.cgl-buio{position:absolute;inset:0;transition:opacity .3s ease;
  background:radial-gradient(ellipse at 50% 50%,rgba(3,8,20,.5) 0%,rgba(2,5,14,.78) 62%,rgba(1,3,9,.9) 100%)}
.cgl-pos{position:absolute;left:0;top:0;transition:left .5s cubic-bezier(.2,.8,.2,1),top .5s cubic-bezier(.2,.8,.2,1),transform .5s cubic-bezier(.2,.8,.2,1);will-change:left,top,transform}
.cgl-in{position:relative;transform-origin:50% 50%}
.cgl-carta{position:relative;filter:drop-shadow(0 0 16px var(--cgl-c)) drop-shadow(0 12px 18px rgba(0,0,0,.65))}
.cgl-carta .card{margin:0}
.cgl-num{position:absolute;z-index:2;line-height:.8;font-family:'Arial Black','Segoe UI Black',Impact,system-ui,sans-serif;font-style:italic;font-weight:900;color:#fff;
  -webkit-text-stroke:.045em var(--cgl-c);paint-order:stroke fill;
  text-shadow:0 0 .22em var(--cgl-c),0 0 .55em var(--cgl-c),0 .06em .18em rgba(0,0,0,.7)}
.cgl-chi{position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:.5em;z-index:2;white-space:nowrap;
  padding:.18em .9em .2em;border-radius:999px;font-family:system-ui,'Segoe UI',sans-serif;font-weight:900;letter-spacing:.16em;color:#fff;
  background:linear-gradient(180deg,var(--cgl-c),rgba(0,0,0,.55));border:1px solid rgba(255,255,255,.55);
  box-shadow:0 0 .9em var(--cgl-c),0 .2em .5em rgba(0,0,0,.6);text-shadow:0 1px 3px rgba(0,0,0,.85)}
.cgl-titolo{position:absolute;left:50%;top:50%;z-index:3;opacity:0;white-space:nowrap;text-align:center;
  font-family:'Arial Black','Segoe UI Black',Impact,system-ui,sans-serif;font-style:italic;font-weight:900;letter-spacing:.03em;color:#fff;
  font-size:clamp(2.8rem,min(15vw,21vh),8.5rem);
  text-shadow:0 0 .12em rgba(255,255,255,.9),0 0 .4em rgba(120,220,255,.85),0 .05em .25em rgba(0,0,0,.7)}
`;
        document.head.appendChild(s);
    }

    // =================================================================================================================
    // La scena
    // =================================================================================================================
    /** @type {any} */
    let st = null;

    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);

    function rilascia(gl) {
        try { const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } catch (e) { /* gia' perso */ }
    }

    /** Il campo della scena in funzione di quante carte ci sono: posizione (centro), inclinazione e grandezza di ognuna. */
    function disegnoCarte(n, W, H) {
        const verticale = H > W * 1.05;
        const f = n <= 3 ? 1 : n === 4 ? .9 : n === 5 ? .8 : n === 6 ? .72 : .64;
        // In verticale le carte si sfalsano su una colonna: l'altezza e' limitata dal passo fra l'una e l'altra, cosi' non si
        // sovrappongono e fra di loro resta posto per vedere la catena.
        // (misurato sul telefono: con carte che riempiono il passo le maglie restano nascoste, serve un vuoto fra l'una e l'altra)
        const passoV = n <= 1 ? H : (H * .66) / (n - 1);
        const alta = Math.max(verticale ? 84 : 110, verticale
            ? Math.min(H * .27, (W * .42) / RAPPORTO, passoV * .76)
            : Math.min(H * .37, (W * .27) / RAPPORTO) * f);
        const rot = [-7, 5, -4, 7, -6, 4, -5, 6];
        const pos = [];
        for (let i = 0; i < n; i++) {
            let x, y;
            if (verticale) {
                const passo = n <= 1 ? 0 : Math.min(.40, .66 / (n - 1));
                y = H * (.5 + (i - (n - 1) / 2) * passo);
                x = W * (i % 2 === 0 ? .30 : .70);
            } else {
                const passo = n <= 1 ? 0 : Math.min(.30, .62 / (n - 1));
                x = W * (.5 + (i - (n - 1) / 2) * passo);
                y = H * (i % 2 === 0 ? .41 : .59);
            }
            pos.push({ x, y, rot: rot[i % 8], scala: i === n - 1 ? 1.1 : .94 });
        }
        return { alta, larga: alta * RAPPORTO, pos, verticale };
    }

    function avvia() {
        iniettaStile();
        const W = window.innerWidth;
        const H = window.innerHeight;

        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        const gl = /** @type {WebGLRenderingContext|null} */ (canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' }));
        if (!gl) throw new Error('webgl-non-disponibile');
        const compila = (tipo, src) => {
            const o = gl.createShader(tipo);
            if (!o) return null;
            gl.shaderSource(o, src);
            gl.compileShader(o);
            if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { window.CATENA_GL_ERRORE = String(gl.getShaderInfoLog(o)); return null; }
            return o;
        };
        const vs = compila(gl.VERTEX_SHADER, VS);
        const fs = compila(gl.FRAGMENT_SHADER, FS);
        const prog = gl.createProgram();
        if (!vs || !fs || !prog) { rilascia(gl); throw new Error('shader-non-compilato'); }
        gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { rilascia(gl); throw new Error('shader-non-collegato'); }

        // Ordine dal basso: velo scuro, carte, catena (SOPRA le carte, come in Master Duel: le maglie passano sul bordo), scritta.
        const root = document.createElement('div');
        root.id = 'catenaGL';
        root.style.opacity = '1';
        const buio = document.createElement('div');
        buio.className = 'cgl-buio';
        buio.style.opacity = '0';
        root.appendChild(buio);
        const livello = document.createElement('div');
        livello.className = 'cgl-carte';
        root.appendChild(livello);
        root.appendChild(canvas);
        const titolo = document.createElement('div');
        titolo.className = 'cgl-titolo';
        titolo.textContent = 'CATENA';
        root.appendChild(titolo);
        document.body.appendChild(root);
        requestAnimationFrame(() => { buio.style.opacity = '1'; });

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        st = {
            root, canvas, gl, prog, livello, titolo,
            u: (nome) => gl.getUniformLocation(prog, nome),
            voci: [], boom: [], rid: 0, t0: performance.now(), chiudendo: false, tChiusura: 0,
            ultimoAggiorna: performance.now(), animTitolo: null, W: 0, H: 0, scala: 1, L: 40,
            adatta: 1, dtMedio: 0, ultimoFrame: 0, contaFrame: 0
        };
        ridimensiona();
        window.addEventListener('resize', ridimensiona);
        st.rid = requestAnimationFrame(frame);
    }

    function ridimensiona() {
        if (!st) return;
        const W = window.innerWidth;
        const H = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        // Le maglie sono linee sottili: serve risoluzione, con un tetto sul totale dei pixel (telefoni).
        const scala = Math.min(0.95, Math.max(0.5, Math.sqrt(1.6e6 / (W * H * dpr * dpr)) * dpr)) * st.adatta;
        st.canvas.width = Math.max(64, Math.round(W * scala));
        st.canvas.height = Math.max(64, Math.round(H * scala));
        st.gl.viewport(0, 0, st.canvas.width, st.canvas.height);
        st.W = W; st.H = H; st.scala = scala;
        st.L = Math.max(26, Math.min(64, Math.min(W, H) * .052));
        riposiziona();
    }

    function vive() { return st.voci.filter((v) => !v.fuori); }

    /** Mette (o rimette, con una transizione) ogni carta al suo posto: dipende da quante sono, non dall'ordine in cui sono arrivate. */
    function riposiziona() {
        if (!st) return;
        const vv = vive();
        const d = disegnoCarte(vv.length, st.W, st.H);
        vv.forEach((v, i) => {
            const p = d.pos[i];
            v.el.style.left = p.x + 'px';
            v.el.style.top = p.y + 'px';
            v.el.style.transform = `translate(-50%,-50%) rotate(${p.rot}deg) scale(${p.scala})`;
            v.el.style.setProperty('--cgl-w', d.larga + 'px');
            const carta = v.el.querySelector('.card');
            if (carta) {
                carta.style.setProperty('--card-w', d.larga + 'px');
                carta.style.setProperty('--card-h', d.alta + 'px');
            }
            if (v.chi) v.chi.style.fontSize = Math.max(10, Math.round(d.larga * .125)) + 'px';
            const num = v.num;
            if (num) {
                num.style.fontSize = Math.round(d.larga * .62) + 'px';
                // L'angolo del numero e' quello LONTANO dalla catena (che esce verso le carte vicine): in verticale il lato
                // esterno dello schermo (sopra la prima carta, sotto l'ultima), in orizzontale il lato esterno in alto o in basso.
                const n = vv.length;
                let v1, o1;
                if (d.verticale) {
                    o1 = p.x < st.W / 2 ? 'l' : 'r';
                    v1 = i === 0 ? 't' : i === n - 1 ? 'b' : (i % 2 === 0 ? 'b' : 't');
                } else {
                    v1 = p.y < st.H / 2 ? 't' : 'b';
                    o1 = i === 0 ? 'l' : i === n - 1 ? 'r' : (i % 2 === 0 ? 'r' : 'l');
                }
                const ang = v1 + o1;
                // La scritta di chi e' la carta sta dal lato OPPOSTO al numero, cosi' i due non si sovrappongono.
                if (v.chi) {
                    const sotto = v1 === 't';
                    v.chi.style.top = sotto ? '100%' : 'auto';
                    v.chi.style.bottom = sotto ? 'auto' : '100%';
                    v.chi.style.margin = sotto ? '.5em 0 0' : '0 0 .5em';
                }
                const fuori = -d.larga * .16;
                num.style.top = num.style.bottom = num.style.left = num.style.right = 'auto';
                if (ang[0] === 't') num.style.top = (fuori * 1.1) + 'px'; else num.style.bottom = (fuori * 1.1) + 'px';
                if (ang[1] === 'l') num.style.left = fuori + 'px'; else num.style.right = fuori + 'px';
            }
        });
    }

    function nuovaVoce(link, istantanea) {
        const colore = link.owner === 'bot' ? '255,84,64' : '70,215,255';
        const pos = document.createElement('div');
        pos.className = 'cgl-pos';
        pos.style.setProperty('--cgl-c', `rgb(${colore})`);
        const dentro = document.createElement('div');
        dentro.className = 'cgl-in';
        const cartaBox = document.createElement('div');
        cartaBox.className = 'cgl-carta';
        if (typeof window.createCardElement === 'function') cartaBox.appendChild(window.createCardElement(link.card));
        const num = document.createElement('span');
        num.className = 'cgl-num';
        // Chi ha attivato la carta, scritto: il colore dell'alone da solo non basta a capirlo al volo.
        const chi = document.createElement('span');
        chi.className = 'cgl-chi';
        chi.textContent = link.owner === 'bot' ? 'AVVERSARIO' : 'TU';
        dentro.appendChild(cartaBox);
        dentro.appendChild(num);
        dentro.appendChild(chi);
        pos.appendChild(dentro);
        st.livello.appendChild(pos);
        const voce = {
            link, el: pos, dentro, num, chi, owner: link.owner === 'bot' ? 1 : 0,
            tNasc: performance.now(), tRivela: performance.now() + (istantanea ? 0 : 120),
            risolvendo: false, tRisolve: 0, fuori: false, istantanea
        };
        st.voci.push(voce);
        return voce;
    }

    function animaIngresso(voce) {
        if (voce.istantanea) {
            try { voce.dentro.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, easing: 'ease-out', fill: 'both' }); } catch (e) { /* pazienza */ }
            return;
        }
        try {
            voce.dentro.animate([
                { opacity: 0, transform: 'scale(2.4) rotate(12deg)', filter: 'blur(12px) brightness(2)', offset: 0, easing: 'cubic-bezier(.16,.84,.3,1)' },
                { opacity: 1, transform: 'scale(.97) rotate(0deg)', filter: 'blur(0) brightness(1.35)', offset: .7, easing: 'ease-out' },
                { opacity: 1, transform: 'scale(1) rotate(0deg)', filter: 'blur(0) brightness(1)', offset: 1 }
            ], { duration: DUR_PIOMBO_MS, fill: 'both' });
        } catch (e) { /* pazienza */ }
        setTimeout(() => colpo(voce), ISTANTE_COLPO_MS);
    }

    /** La carta tocca la scena: onda d'urto, scossa, numero che si pianta e scritta CATENA. */
    function colpo(voce) {
        if (!st || st.chiudendo || voce.fuori) return;
        const r = voce.el.getBoundingClientRect();
        spara(r.left + r.width / 2, r.top + r.height / 2, voce.owner);
        const contenitore = document.querySelector('.game-container');
        if (contenitore) { contenitore.classList.add('fx-shake'); setTimeout(() => contenitore.classList.remove('fx-shake'), 380); }
        try {
            voce.num.animate([
                { opacity: 0, transform: 'scale(2.6)', filter: 'blur(6px)', offset: 0, easing: 'cubic-bezier(.2,.9,.3,1)' },
                { opacity: 1, transform: 'scale(1)', filter: 'blur(0)', offset: 1 }
            ], { duration: 280, fill: 'both' });
        } catch (e) { voce.num.style.opacity = '1'; }
        mostraTitolo();
    }

    function mostraTitolo() {
        const t = st.titolo;
        const cx = st.W / 2, cy = st.H / 2;
        t.style.left = cx + 'px';
        t.style.top = cy + 'px';
        if (st.animTitolo) { try { st.animTitolo.cancel(); } catch (e) { /* gia' finita */ } }
        try {
            st.animTitolo = t.animate([
                { opacity: 0, transform: 'translate(-50%,-50%) scale(1.5) skewX(-8deg)', filter: 'blur(14px)', offset: 0, easing: 'cubic-bezier(.1,.7,.2,1)' },
                { opacity: .95, transform: 'translate(-50%,-50%) scale(1) skewX(-8deg)', filter: 'blur(0)', offset: .22, easing: 'linear' },
                { opacity: .95, transform: 'translate(-50%,-50%) scale(1.02) skewX(-8deg)', filter: 'blur(0)', offset: .7, easing: 'ease-in' },
                { opacity: 0, transform: 'translate(-50%,-50%) scale(1.08) skewX(-8deg)', filter: 'blur(5px)', offset: 1 }
            ], { duration: 1150, fill: 'both' });
        } catch (e) { t.style.opacity = '0'; }
    }

    function spara(x, y, tipo) {
        st.boom.push({ x, y, t0: performance.now(), tipo });
        if (st.boom.length > 3) st.boom.shift();
    }

    function risolvi(voce) {
        voce.risolvendo = true;
        voce.tRisolve = performance.now();
        voce.el.style.zIndex = '5';   // la carta in risoluzione passa davanti alle altre mentre si ingrandisce
        const r = voce.el.getBoundingClientRect();
        spara(r.left + r.width / 2, r.top + r.height / 2, 2);
        try {
            voce.dentro.animate([
                { transform: 'scale(1)', filter: 'brightness(1)', offset: 0, easing: 'cubic-bezier(.2,.9,.3,1)' },
                { transform: 'scale(1.26)', filter: 'brightness(1.55)', offset: .28, easing: 'ease-in-out' },
                { transform: 'scale(1.2)', filter: 'brightness(1.15)', offset: 1 }
            ], { duration: 760, fill: 'both' });
            voce.num.animate([
                { transform: 'scale(1)', offset: 0 }, { transform: 'scale(1.5)', offset: .3 }, { transform: 'scale(1.2)', offset: 1 }
            ], { duration: 560, fill: 'both' });
        } catch (e) { /* pazienza */ }
    }

    function esci(voce) {
        if (voce.fuori) return;
        voce.fuori = true;
        const el = voce.el;
        try {
            const a = el.animate([
                { opacity: 1, filter: 'blur(0)' },
                { opacity: 0, filter: 'blur(10px)' }
            ], { duration: 420, easing: 'ease-in', fill: 'both' });
            voce.dentro.animate([
                { transform: 'scale(1.2) translateY(0)', offset: 0 },
                { transform: 'scale(.6) translateY(-40px) rotate(-8deg)', offset: 1 }
            ], { duration: 420, easing: 'ease-in', fill: 'both' });
            a.onfinish = () => el.remove();
        } catch (e) { el.remove(); }
        setTimeout(() => el.remove(), 600);
        riposiziona();
    }

    /**
     * Chiamata da renderChainStack ad ogni Link aggiunto o risolto. `displayLinks` e' in ordine di attivazione e comprende il
     * Link in risoluzione (che il motore ha gia' tolto dall'array vero); `resolvingLink` e' quello che si sta risolvendo ORA.
     * Torna true se la scena se ne occupa (anche se per ora non c'e' niente da mostrare), false se vale il pannello di sempre.
     * @param {any[]} displayLinks
     * @param {any} [resolvingLink]
     */
    function aggiorna(displayLinks, resolvingLink) {
        if (!pronta()) return false;
        const n = displayLinks.length;
        if (st) st.ultimoAggiorna = performance.now();
        if (n === 0) { if (st && !st.chiudendo) chiudi(); return true; }
        if (st && st.chiudendo) finisci();      // una Catena nuova mentre la vecchia si spegne: si ricomincia pulito
        if (!st) {
            if (n < 2) return true;             // un Link solo non fa scena: c'e' gia' la sua carta a centro schermo
            try { avvia(); } catch (e) {
                guasto = true;
                console.error('[catena-webgl] scena non partita, resta il pannello di sempre:', e);
                return false;
            }
        }
        const primo = st.voci.length === 0;
        displayLinks.forEach((link, i) => {
            if (!st.voci.some((v) => v.link === link)) {
                const voce = nuovaVoce(link, primo && i < n - 1);
                voce.num.textContent = String(link.linkNumber || (i + 1));
            }
        });
        st.voci.filter((v) => !v.fuori && !displayLinks.includes(v.link)).forEach(esci);
        riposiziona();
        st.voci.forEach((v) => { if (!v.animato) { v.animato = true; animaIngresso(v); } });
        if (resolvingLink) {
            const v = st.voci.find((x) => x.link === resolvingLink);
            if (v && !v.risolvendo && !v.fuori) risolvi(v);
        }
        // In risoluzione la scena si fa da parte (vedi .cgl-compatta nello stile): niente piu' effetti nascosti dalla Catena.
        st.root.classList.toggle('cgl-compatta', !!resolvingLink);
        return true;
    }

    function chiudi() {
        if (!st || st.chiudendo) return;
        st.chiudendo = true;
        st.tChiusura = performance.now();
        st.voci.filter((v) => !v.fuori).forEach(esci);
        st.root.style.opacity = '0';
        setTimeout(finisci, DUR_CHIUSURA_MS + 120);
    }

    /** Smonta tutto: canvas rilasciato, DOM tolto. Una sola volta, qualunque strada abbia portato qui. */
    function finisci() {
        if (!st) return;
        const s = st;
        st = null;
        cancelAnimationFrame(s.rid);
        window.removeEventListener('resize', ridimensiona);
        if (s.animTitolo) { try { s.animTitolo.cancel(); } catch (e) { /* gia' finita */ } }
        s.root.remove();
        rilascia(s.gl);
    }

    // =================================================================================================================
    // Il disegno, ogni fotogramma
    // =================================================================================================================
    function frame() {
        if (!st) return;
        const s = st;
        const gl = s.gl;
        const now = performance.now();
        const t = (now - s.t0) / 1000;
        s.rid = requestAnimationFrame(frame);

        // Rete di sicurezza: una scena rimasta aperta senza Catena (qualcosa non ha avvisato la fine) si chiude da sola.
        // (`gameState` e' una variabile globale dichiarata con let/var negli script del duello, non sempre una proprieta' di window.)
        const catena = typeof gameState !== 'undefined' && gameState ? gameState.chain : null;
        if (!s.chiudendo && now - s.ultimoAggiorna > 8000 && !(catena && catena.active)) { chiudi(); return; }
        if (!s.chiudendo && now - s.t0 > 120000) { chiudi(); return; }

        // Telefoni deboli: se i fotogrammi sono lenti si scende di risoluzione (mai sotto il 35%) invece di scattare.
        if (s.ultimoFrame) {
            const dt = now - s.ultimoFrame;
            s.dtMedio = s.dtMedio ? s.dtMedio * .9 + dt * .1 : dt;
            if (++s.contaFrame % 24 === 0 && s.dtMedio > 40 && s.adatta > .45) { s.adatta *= .78; ridimensiona(); }
        }
        s.ultimoFrame = now;

        const vv = vive().slice(-MAX_ANCORE);
        const Pa = new Float32Array(7 * 2);
        const Pb = new Float32Array(7 * 2);
        const S = new Float32Array(7 * 3);
        const F = new Float32Array(7);
        const C = vv.map((v) => {
            const r = v.el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, hw: r.width / 2, hh: r.height / 2 };
        });
        for (let i = 1; i < vv.length; i++) {
            const v = vv[i];
            const seg = i - 1;
            const a = C[i - 1], b = C[i];
            // La catena va dal BORDO di una carta al bordo dell'altra (non da centro a centro: coprirebbe l'illustrazione)
            // e si disegna SOPRA le carte, come in Master Duel: le prime maglie poggiano sulla cornice.
            let dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            dx /= len; dy /= len;
            const bordo = (c) => Math.min(c.hw / Math.max(Math.abs(dx), 1e-3), c.hh / Math.max(Math.abs(dy), 1e-3)) * 0.8;
            let sa = bordo(a), sb = len - bordo(b);
            // Se le carte quasi si toccano la catena resta lunga almeno un paio di maglie, centrata fra le due.
            if (sb - sa < s.L * 1.6) { const m = (sa + sb) / 2; sa = m - s.L * 0.8; sb = m + s.L * 0.8; }
            Pa[seg * 2] = a.x + dx * sa; Pa[seg * 2 + 1] = a.y + dy * sa;
            Pb[seg * 2] = a.x + dx * sb; Pb[seg * 2 + 1] = a.y + dy * sb;
            S[seg * 3] = easeOut((now - v.tRivela) / 460);
            S[seg * 3 + 1] = v.risolvendo ? easeOut((now - v.tRisolve - 180) / 520) : 0;
            S[seg * 3 + 2] = v.owner;
            const eta = (now - v.tRivela - 330) / 1000;
            F[seg] = eta > 0 ? Math.pow(Math.max(0, 1 - eta / 0.8), 2) : 0;
        }
        const B = new Float32Array(12);
        for (let i = 0; i < 3; i++) {
            const b = s.boom[i];
            const eta = b ? (now - b.t0) / 1000 : -1;
            B[i * 4] = b ? b.x : 0; B[i * 4 + 1] = b ? b.y : 0; B[i * 4 + 2] = eta > 2.2 ? -1 : eta; B[i * 4 + 3] = b ? b.tipo : 0;
        }

        gl.uniform2f(s.u('r'), s.canvas.width, s.canvas.height);
        gl.uniform1f(s.u('k'), 1 / s.scala);
        gl.uniform1f(s.u('uT'), t);
        gl.uniform1f(s.u('uL'), s.L);
        gl.uniform1f(s.u('uN'), Math.max(0, vv.length - 1));
        gl.uniform2fv(s.u('uPa'), Pa);
        gl.uniform2fv(s.u('uPb'), Pb);
        gl.uniform3fv(s.u('uS'), S);
        gl.uniform1fv(s.u('uF'), F);        gl.uniform4fv(s.u('uB'), B);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    window.CatenaGL = {
        pronta,
        aggiorna,
        chiudi,
        /**
         * La scena sta mostrando QUESTO Link? Il motore lo chiede prima di rifare la carta grande a centro schermo alla
         * risoluzione: se la scena la mostra gia', un secondo effetto sulla stessa carta sarebbe solo confusione.
         * @param {any} link
         */
        mostra(link) {
            return !!(st && !st.chiudendo && st.voci.some((v) => v.link === link && !v.fuori));
        },
        /** Per i test: com'e' la scena adesso (null se non c'e'). */
        stato() {
            return st ? { voci: st.voci.filter((v) => !v.fuori).length, chiudendo: st.chiudendo, canvas: !!st.canvas.isConnected } : null;
        },
        /** Per i test: smonta subito, senza aspettare la dissolvenza. */
        _subito() { finisci(); }
    };
})();
