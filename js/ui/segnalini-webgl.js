/**
 * segnalini-webgl.js — i SEGNALINI sulle carte (card.counters) disegnati in WebGL.
 * =======================================================================================
 * Prima erano un disco giallo CSS appeso in alto a destra della carta. Ora stanno in BASSO, CENTRATI sulla carta (come il contatore dei
 * turni), e sono una piccola sfera d'oro: rilievo e luce, bordo che brilla, scintille che le girano attorno, alone che respira, il
 * numero inciso al centro; quando il numero cambia parte un anello di luce, alla comparsa si ingrandisce con una curva morbida
 * (niente rimbalzi, regola del progetto per gli effetti 3D).
 *
 * UN SOLO CANVAS per tutti i segnalini (su telefono i contesti WebGL sono pochi): sta in un livello fisso a tutto schermo, sopra le carte e
 * sotto i modali. NON decide niente: legge i badge `.field-counter-badge` che game-flow.js disegna gia' (la fonte vera del numero e della
 * posizione) e li ridisegna in WebGL; il badge DOM resta nella pagina ma invisibile (classe html.segnalini-gl), cosi' la posizione e' la
 * stessa e un test, o un lettore di schermo, lo trova ancora. Le posizioni si rileggono a OGNI fotogramma: la zoomata d'ingresso e i
 * trascinamenti spostano le carte senza ridisegnare il Terreno.
 *
 * SE NON SI PUO', RESTA IL CSS (un disco d'oro, anch'esso in basso al centro): senza WebGL, con Dettagli video "Normali", col movimento
 * ridotto, con window.SEGNALINI_WEBGL_OFF, o dopo un guasto (contesto perso). Il numero e' disegnato da un atlante di cifre in una tela 2D:
 * funziona anche su file:// (nessuna immagine come texture).
 */
(function () {
    'use strict';

    const Z = 32;                  // sopra gli ologrammi (30), sotto i riscontri (10040) e i modali
    const MAX = 24;                // segnalini disegnabili insieme
    const ALONE = 1.7;             // il quadrato e' 1,7 volte il disco: dentro c'e' lo spazio per alone e scintille

    const VS = `
attribute vec2 aPos; attribute vec2 aUv; attribute vec4 aP;
uniform vec2 uRes;
varying vec2 vUv; varying vec4 vP;
void main(){ vec2 c=aPos/uRes*2.-1.; gl_Position=vec4(c.x,-c.y,0.,1.); vUv=aUv; vP=aP; }`;

    const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv; varying vec4 vP;   // vP: x = seme, y = comparsa 0..1, z = impulso 0..1 (numero cambiato), w = valore
uniform sampler2D uAtl;
uniform float uT;
uniform float uAlone;

// Una cifra dall'atlante (10 celle in fila): alfa e luce, nel riquadro centrato in c con altezza h.
vec2 cifra(vec2 q, vec2 c, float h, float d){
  float w=h*.667;
  vec2 l=(q-c)/vec2(w,h)+.5;
  if(l.x<0.||l.x>1.||l.y<0.||l.y>1.) return vec2(0.);
  // l.y cresce verso il BASSO come le righe della tela 2D caricata senza flip: niente "1.-" (era il numero capovolto).
  vec4 t=texture2D(uAtl,vec2((d+l.x)/10.,l.y));
  return vec2(t.a,t.r);
}

void main(){
  float seed=vP.x;
  float pop=1.-pow(1.-clamp(vP.y,0.,1.),3.);     // comparsa morbida
  float sc=mix(.55,1.,pop);
  vec2 q=vUv*uAlone/sc;                          // il disco ha raggio 1
  float r=length(q);
  float imp=vP.z;

  // ---- alone che respira + onda quando il numero cambia
  float respiro=.6+.25*sin(uT*2.6+seed*6.283);
  float alone=exp(-max(r-1.,0.)*2.7)*respiro*(1.+imp*1.4)*smoothstep(2.4,1.,r);
  float onda=exp(-pow((r-(1.05+(1.-imp)*1.15))*8.,2.))*imp;

  // ---- il disco: una sfera illuminata da in alto a sinistra
  float cov=smoothstep(1.,.93,r);
  float z=sqrt(max(0.,1.-min(r,1.)*min(r,1.)));
  vec3 n=normalize(vec3(q.x,-q.y,z));
  vec3 L=normalize(vec3(-.45,.6,.66));
  float dif=max(dot(n,L),0.);
  float spec=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),22.);
  float rim=pow(1.-z,2.4);
  vec3 oro=mix(vec3(.42,.22,.03),vec3(1.,.80,.30),dif*.85+.15);
  // un anello inciso poco dentro il bordo, e una luce che gira lenta sul rilievo
  float inciso=smoothstep(.05,0.,abs(r-.78));
  oro*=1.-inciso*.55;
  oro+=vec3(1.,.9,.55)*smoothstep(.04,0.,abs(r-.70))*.22;
  float giro=pow(max(0.,cos(atan(q.y,q.x)-uT*1.4+seed*6.)),10.)*smoothstep(.9,.6,abs(r-.86))*.5;
  vec3 col=oro+vec3(1.,.95,.7)*spec*.85+vec3(1.,.55,.08)*rim*.75+vec3(1.,.85,.4)*giro*cov;

  // ---- il numero: bianco caldo con un bordo scuro, un filo di bagliore
  float v=floor(vP.w+.5);
  float dec=floor(v/10.);
  float uni=v-dec*10.;
  vec2 ca;
  if(v<10.){ ca=cifra(q,vec2(0.,.02),.86,uni); }
  else { vec2 a=cifra(q,vec2(-.23,.02),.72,dec); vec2 b=cifra(q,vec2(.23,.02),.72,uni); ca=vec2(max(a.x,b.x),max(a.y,b.y)); }
  vec3 numCol=mix(vec3(.22,.11,.01),vec3(1.,.97,.86),ca.y);
  col=mix(col,numCol,ca.x*cov);

  // ---- scintille che girano attorno al disco
  float sp=0.;
  for(int i=0;i<3;i++){
    float fi=float(i);
    float a=uT*(.9+.28*fi)+seed*6.283+fi*2.094;
    vec2 p=vec2(cos(a),sin(a))*(1.2+.07*sin(uT*3.+fi));
    sp+=exp(-pow(length(q-p)*8.5,2.))*(.7+.3*sin(uT*7.+fi*2.+seed*9.));
  }

  vec3 hc=vec3(1.,.62,.12);
  vec3 rgb=col*cov+hc*alone*.9*(1.-cov*.7)+vec3(1.,.93,.7)*onda*.9+vec3(1.,.92,.65)*sp*.9;
  float a=clamp(cov+alone*.75+onda+sp*.6,0.,1.);
  gl_FragColor=vec4(min(rgb,vec3(a+.35))*pop,a*pop);
}`;

    let radice = null;       // il livello fisso
    let canvas = null;
    let gl = null;
    let prog = null;
    let buf = null;
    let atlante = null;
    let loc = null;
    let guasto = false;
    let raf = 0;
    let t0 = 0;
    const dati = new Float32Array(MAX * 6 * 8);
    /** uid -> { valore, nato, cambio, seme } */
    const memoria = new Map();
    let W = 0, H = 0, dpr = 1;

    function movimentoRidotto() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    function dettagliAlti() {
        try { return !window.VideoQuality || typeof VideoQuality.isAlti !== 'function' || VideoQuality.isAlti(); } catch (e) { return true; }
    }
    function disponibile() {
        return !window.SEGNALINI_WEBGL_OFF && !guasto && !movimentoRidotto() && dettagliAlti();
    }

    /** L'atlante delle cifre: dieci celle 64x96 su una tela 2D (alfa = forma col bordo, rosso = luce del riempimento). */
    function disegnaAtlante() {
        const c = document.createElement('canvas');
        c.width = 640; c.height = 96;
        const g = c.getContext('2d');
        g.clearRect(0, 0, 640, 96);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '900 78px "Arial Black","Segoe UI Black",Impact,system-ui,sans-serif';
        for (let d = 0; d < 10; d++) {
            const x = d * 64 + 32;
            // bordo (alfa pieno, luce 0 = scuro) poi riempimento (alfa pieno, luce 1 = chiaro)
            g.lineJoin = 'round';
            g.lineWidth = 10;
            g.strokeStyle = 'rgb(0,0,0)';
            g.strokeText(String(d), x, 52);
            g.fillStyle = 'rgb(255,255,255)';
            g.fillText(String(d), x, 52);
        }
        return c;
    }

    function compila(tipo, src) {
        const s = gl.createShader(tipo);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('segnalini: ' + gl.getShaderInfoLog(s));
        return s;
    }

    function avvia() {
        radice = document.createElement('div');
        radice.id = 'segnaliniLayer';
        radice.setAttribute('aria-hidden', 'true');
        radice.style.cssText = `position:fixed;inset:0;z-index:${Z};pointer-events:none;`;
        canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%';
        radice.appendChild(canvas);
        document.body.appendChild(radice);
        gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
        if (!gl) throw new Error('segnalini: webgl non disponibile');
        prog = gl.createProgram();
        gl.attachShader(prog, compila(gl.VERTEX_SHADER, VS));
        gl.attachShader(prog, compila(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('segnalini: link fallito');
        gl.useProgram(prog);
        loc = {
            pos: gl.getAttribLocation(prog, 'aPos'), uv: gl.getAttribLocation(prog, 'aUv'), p: gl.getAttribLocation(prog, 'aP'),
            res: gl.getUniformLocation(prog, 'uRes'), t: gl.getUniformLocation(prog, 'uT'), atl: gl.getUniformLocation(prog, 'uAtl'),
            alone: gl.getUniformLocation(prog, 'uAlone')
        };
        buf = gl.createBuffer();
        atlante = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, atlante);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, disegnaAtlante());
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        canvas.addEventListener('webglcontextlost', contestoPerso);
        t0 = performance.now();
        ridimensiona();
        window.addEventListener('resize', ridimensiona);
    }

    function ridimensiona() {
        if (!canvas) return;
        W = window.innerWidth; H = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(2, Math.round(W * dpr));
        canvas.height = Math.max(2, Math.round(H * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    /** Un contesto perso DA SOLO (telefono con pochi contesti) e' un guasto; quello che rilascio io no (vedi smonta). */
    function contestoPerso(e) { e.preventDefault(); spegniPerGuasto(); }

    function smonta() {
        cancelAnimationFrame(raf); raf = 0;
        window.removeEventListener('resize', ridimensiona);
        // Il rilascio volontario del contesto genera lo stesso evento di una perdita vera: va ignorato, o il modulo si
        // crederebbe guasto e non ripartirebbe piu' (il Terreno senza segnalini e poi di nuovo con).
        if (canvas) canvas.removeEventListener('webglcontextlost', contestoPerso);
        if (gl) { try { const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } catch (err) { /* gia' perso */ } }
        if (radice && radice.parentNode) radice.parentNode.removeChild(radice);
        radice = canvas = gl = prog = buf = atlante = loc = null;
    }

    /** Un guasto (contesto perso) spegne il modulo e restituisce i badge al CSS: il gioco non deve perdere i numeri. */
    function spegniPerGuasto() {
        guasto = true;
        smonta();
        document.documentElement.classList.remove('segnalini-gl');
    }

    function badgeVisibili() {
        const out = [];
        document.querySelectorAll('.field-counter-badge').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) return;
            if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return;
            const slot = el.parentElement;
            const carta = slot && slot.querySelector('.card');
            const uid = (carta && carta.dataset.uid) || (slot && slot.dataset.owner + ':' + slot.dataset.type + ':' + slot.dataset.index) || String(out.length);
            out.push({ el, r, uid, valore: Math.max(0, Math.min(99, parseInt(el.textContent, 10) || 0)) });
        });
        return out.slice(0, MAX);
    }

    function frame() {
        raf = 0;
        if (!gl || guasto) return;
        const lista = badgeVisibili();
        const ora = performance.now();
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (!lista.length) { memoria.clear(); return; }   // niente da disegnare: il ciclo si ferma, sync() lo riaccende
        const vivi = new Set();
        let k = 0;
        lista.forEach((b) => {
            vivi.add(b.uid);
            let m = memoria.get(b.uid);
            if (!m) { m = { valore: b.valore, nato: ora, cambio: -1e9, seme: Math.random() }; memoria.set(b.uid, m); }
            if (m.valore !== b.valore) { m.valore = b.valore; m.cambio = ora; }
            const cx = b.r.left + b.r.width / 2;
            const cy = b.r.top + b.r.height / 2;
            const R = (Math.max(b.r.width, b.r.height) / 2) * ALONE;
            const comparsa = Math.min(1, (ora - m.nato) / 380);
            const impulso = Math.max(0, 1 - (ora - m.cambio) / 700);
            const x0 = cx - R, x1 = cx + R, y0 = cy - R, y1 = cy + R;
            const v = [
                [x0, y0, -1, -1], [x1, y0, 1, -1], [x0, y1, -1, 1],
                [x1, y0, 1, -1], [x1, y1, 1, 1], [x0, y1, -1, 1]
            ];
            v.forEach((p) => {
                const o = k * 8;
                dati[o] = p[0]; dati[o + 1] = p[1]; dati[o + 2] = p[2]; dati[o + 3] = p[3];
                dati[o + 4] = m.seme; dati[o + 5] = comparsa; dati[o + 6] = impulso; dati[o + 7] = b.valore;
                k++;
            });
        });
        memoria.forEach((_, uid) => { if (!vivi.has(uid)) memoria.delete(uid); });
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, dati.subarray(0, k * 8), gl.DYNAMIC_DRAW);
        const S = 8 * 4;
        gl.enableVertexAttribArray(loc.pos); gl.vertexAttribPointer(loc.pos, 2, gl.FLOAT, false, S, 0);
        gl.enableVertexAttribArray(loc.uv); gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, S, 8);
        gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 4, gl.FLOAT, false, S, 16);
        gl.uniform2f(loc.res, W, H);
        gl.uniform1f(loc.t, (ora - t0) / 1000);
        gl.uniform1f(loc.alone, ALONE);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, atlante);
        gl.uniform1i(loc.atl, 0);
        gl.drawArrays(gl.TRIANGLES, 0, k);
        if (!document.hidden) raf = requestAnimationFrame(frame);
    }

    /** Chiamata dopo ogni ridisegno del duello (game-flow.js): accende o spegne tutto in base ai badge presenti. */
    function sync() {
        const presenti = document.querySelector('.field-counter-badge');
        if (!presenti || !disponibile()) {
            document.documentElement.classList.remove('segnalini-gl');
            if (radice && !presenti) { memoria.clear(); smonta(); }
            else if (radice && !disponibile()) smonta();
            return;
        }
        try {
            if (!radice) avvia();
        } catch (e) {
            window.SEGNALINI_GL_ERRORE = String(e && e.message || e);
            guasto = true;
            if (radice) smonta();
            document.documentElement.classList.remove('segnalini-gl');
            return;
        }
        document.documentElement.classList.add('segnalini-gl');
        if (!raf) raf = requestAnimationFrame(frame);
    }

    document.addEventListener('visibilitychange', () => { if (!document.hidden && radice && !raf) raf = requestAnimationFrame(frame); });

    window.SegnaliniGL = { sync: sync, disponibile: disponibile, attivo: () => !!radice, _canvas: () => canvas };
})();
