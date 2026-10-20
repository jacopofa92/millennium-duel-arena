// @ts-check
/**
 * page-loader.js — schermata di caricamento condivisa per OGNI cambio
 * pagina del gioco (menu, Cartoteca, Creazione Deck, Duello Libero,
 * ecc.) — diversa dallo splash d'apertura di index.html (.splash-screen,
 * mostrato una sola volta per sessione di scheda, alla primissima
 * apertura dell'app): questa compare ad OGNI navigazione tra pagine,
 * per camuffare il tempo di caricamento reale (script/dati) dietro
 * un'animazione a tema invece di uno schermo bianco — stesso principio
 * dello splash, ma un componente condiviso (come js/ui/topbar.js) invece
 * di duplicare markup/CSS/JS in ogni pagina.
 *
 * USO: in ogni pagina che deve mostrarla,
 *   <head>: <link rel="stylesheet" href="js/ui/page-loader.css">
 *   <body>: <script src="js/ui/page-loader.js"></script>  ← PRIMISSIMO
 *           elemento di <body> (prima di qualunque altro markup), così
 *           copre il resto della pagina dal primissimo frame dipinto,
 *           esattamente come faceva #preIntroCover in duelMonstersCore.html
 *           (ora sostituito da questo stesso componente, vedi
 *           duel-session.js#start()).
 *
 * Per default si nasconde da sola dopo ALMENO 1 secondo (MIN_MS più
 * sotto — richiesta esplicita dell'utente, prima erano 2s) dal momento
 * in cui questo script viene eseguito, aspettando anche il vero
 * window.load (cosicché la pagina reale sia già pronta sotto di lei —
 * stessa garanzia di hideSplashThen() in index.html, che ha un proprio
 * minimo SEPARATO — vedi lì se va cambiato anche quello). Una pagina
 * con un proprio momento più preciso in cui sparire (es.
 * duelMonstersCore.html, che aspetta l'inizio della propria cinematica
 * invece del window.load generico — la regola già esistente lì è "il
 * caricamento del duello non deve MAI aspettare nient'altro", quindi
 * niente minimo in quel caso) imposta `window.PAGE_LOADER_MANUAL_HIDE = true`
 * PRIMA di questo script e chiama `PageLoader.hide()` da sola quando è pronta.
 */
(function () {
    'use strict';

    // Via di fuga generica (es. index.html sulla PRIMISSIMA apertura
    // dell'app, quando deve comparire SOLO lo splash screen dedicato,
    // .splash-screen — vedi lì —, mai insieme a questo loader generico:
    // impostare window.PAGE_LOADER_SKIP = true PRIMA di questo script
    // salta la creazione dell'overlay per intero, window.PageLoader
    // resta undefined). Ogni chiamante di PageLoader.hide()/hideWhenReady()
    // in questo progetto controlla già `if (window.PageLoader)` prima di
    // invocarla, quindi funziona senza altre modifiche.
    if (window.PAGE_LOADER_SKIP) return;

    // Catturato SUBITO (primo statement eseguibile di questo script,
    // che è già il primissimo elemento del body): stesso identico scopo
    // di window.__splashStart in index.html, per garantire ALMENO 2
    // secondi a partire da QUI, non da quando il window.load arriva
    // (che potrebbe già essere "il caricamento è praticamente finito").
    window.__pageLoaderStart = performance.now();

    var el = document.createElement('div');
    el.id = 'pageLoader';
    el.className = 'page-loader';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', 'Caricamento della schermata');
    el.innerHTML =
        '<div class="page-loader-stage" aria-hidden="true">' +
            '<div class="page-loader-aura page-loader-aura--outer"></div>' +
            '<div class="page-loader-aura page-loader-aura--inner"></div>' +
            '<div class="page-loader-spark page-loader-spark--1"></div>' +
            '<div class="page-loader-spark page-loader-spark--2"></div>' +
            '<div class="page-loader-spark page-loader-spark--3"></div>' +
            '<div class="page-loader-card">' +
                '<div class="page-loader-face page-loader-card-back"><span></span></div>' +
                '<div class="page-loader-face page-loader-card-front">' +
                    '<div class="page-loader-card-title"></div>' +
                    '<div class="page-loader-card-art"><i></i></div>' +
                    '<div class="page-loader-card-lines"></div>' +
                '</div>' +
            '</div>' +
            '<div class="page-loader-shadow"></div>' +
        '</div>' +
        '<div class="page-loader-bar"><div class="page-loader-bar-fill"></div></div>' +
        '<p class="page-loader-text">Caricamento…</p>';

    // document.currentScript è questo stesso tag <script> (un classico
    // script sincrono, mai async/defer/module) — inserire SUBITO DOPO
    // di lui, invece che in coda a document.body, è l'unico modo per
    // garantire che l'overlay compaia PRIMA che il resto del body (che
    // deve ancora essere parsato, essendo questo il primissimo script)
    // venga dipinto — stesso principio di #preIntroCover/.splash-screen,
    // che invece erano markup HTML letterale per lo stesso identico
    // motivo: qui l'unico modo di restare un componente condiviso
    // (niente markup duplicato in ogni pagina) senza perdere quella
    // garanzia.
    var currentScript = document.currentScript;
    if (currentScript && currentScript.parentNode) {
        currentScript.parentNode.insertBefore(el, currentScript.nextSibling);
    } else if (document.body) {
        document.body.insertBefore(el, document.body.firstChild);
    }

    // Energia dorata in WebGL attorno alla carta (al posto dei raggi che giravano sul dorso): particelle che
    // salgono a spirale verso la carta e un alone che respira. Un canvas piccolo, fermo quando il loader e'
    // nascosto; se WebGL manca resta la sola carta CSS.
    var glRaf = 0, glAttivo = null;
    (function () {
        try {
            if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            var stage = el.querySelector('.page-loader-stage');
            var cv = document.createElement('canvas');
            cv.width = 300; cv.height = 340; cv.className = 'page-loader-gl'; cv.style.opacity = '0'; // si mostra solo dopo il primo fotogramma disegnato
            var gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
            if (!gl) return;
            var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
            var fs = 'precision highp float;uniform vec2 r;uniform float t;' +
                'float h(float n){return fract(n*43758.5453+.137*n*n);}' +
                'void main(){vec2 uv=gl_FragCoord.xy/r;vec2 d=(uv-vec2(.5,.5))*vec2(r.x/r.y,1.);float rc=length(d);' +
                'float res=.82+.18*sin(t*2.2);' +
                'float al=exp(-rc*rc*14.)*.5*res+exp(-pow((rc-.3)/.05,2.))*.12*res;' +
                'vec3 c=vec3(1.,.62,.14)*al;float a=al*.8;' +
                'for(int i=0;i<22;i++){float fi=float(i);float ph=fract(t*.28+h(fi+1.)*1.);' +
                'float rr=mix(.5,.1,ph);float an=h(fi+7.)*6.283+t*1.1*(.6+h(fi)*.8)+ph*4.;' +
                'vec2 q=vec2(cos(an),sin(an))*rr;float s=smoothstep(.016+.012*h(fi+3.),0.,length(d-q))*sin(ph*3.1416);' +
                'c+=vec3(1.,.9,.55)*s;a+=s;}' +
                'float fin=smoothstep(.5,.3,abs(uv.x-.5))*smoothstep(.5,.3,abs(uv.y-.5));c*=fin;a*=fin;a=clamp(a,0.,1.);gl_FragColor=vec4(min(c,vec3(a)),a);}';
            function sh(tp, src) { var o = gl.createShader(tp); gl.shaderSource(o, src); gl.compileShader(o); return o; }
            var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
            if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
            gl.useProgram(pr);
            var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
            var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
            var uR = gl.getUniformLocation(pr, 'r'), uT = gl.getUniformLocation(pr, 't');
            gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(uR, cv.width, cv.height);
            var t0 = performance.now();
            function giro(now) {
                gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
                gl.uniform1f(uT, (now - t0) / 1000);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
                if (cv.style.opacity === '0') cv.style.opacity = '1';
                glRaf = requestAnimationFrame(giro);
            }
            stage.insertBefore(cv, stage.firstChild);
            glAttivo = { via: function () { if (!glRaf) glRaf = requestAnimationFrame(giro); }, ferma: function () { cancelAnimationFrame(glRaf); glRaf = 0; } };
            glAttivo.via();
        } catch (e) { glAttivo = null; }
    })();
    var MIN_MS = 1000; // richiesta esplicita dell'utente: 1s invece di 2s
    var hidden = false;
    var hideTimer = null;
    var safetyTimer = null;
    function hide() {
        if (hidden) return;
        hidden = true;
        el.classList.add('page-loader-hidden');
        if (glAttivo) setTimeout(function () { if (hidden) glAttivo.ferma(); }, 600);
        clearTimeout(hideTimer);
        clearTimeout(safetyTimer);
    }
    function hideWhenReady() {
        var elapsed = performance.now() - window.__pageLoaderStart;
        var remaining = Math.max(0, MIN_MS - elapsed);
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, remaining);
    }
    // Le viste fuse di index.html non cambiano documento: riusano questa
    // stessa istanza del loader quando devono caricare moduli lazy pesanti.
    function show() {
        clearTimeout(hideTimer);
        clearTimeout(safetyTimer);
        window.__pageLoaderStart = performance.now();
        hidden = false;
        el.classList.remove('page-loader-hidden');
        if (glAttivo) glAttivo.via();
    }

    window.PageLoader = { show: show, hide: hide, hideWhenReady: hideWhenReady };

    if (!window.PAGE_LOADER_MANUAL_HIDE) {
        // Se js/cloud/auth-gate.js è caricato in questa pagina e sta ancora
        // aspettando la conferma di sessione (window.__authGatePending),
        // non nascondersi al window.load come al solito: aspettare che
        // l'overlay di auth-gate sparisca prima ('authgate:approved') e
        // SOLO allora far partire il conto alla rovescia del minimo di
        // visualizzazione — altrimenti la propria dissolvenza (0.5s) può
        // già essere a metà quando l'overlay nero di auth-gate sparisce
        // sopra di lei, e per un istante il disco animato "flasha" da
        // sotto prima del vero contenuto della pagina (bug reale
        // segnalato dall'utente su Cartoteca). Su una pagina senza
        // auth-gate (es. index.html) __authGatePending resta undefined:
        // comportamento invariato, nessun'attesa aggiuntiva.
        window.addEventListener('load', function () {
            if (window.__authGatePending) {
                window.addEventListener('authgate:approved', hideWhenReady, { once: true });
            } else {
                hideWhenReady();
            }
        });
    } else {
        // Rete di sicurezza SOLO per la modalità manuale (es.
        // duelMonstersCore.html): se per qualunque motivo chi doveva
        // chiamare PageLoader.hide() non lo fa mai (un errore più a
        // monte nel boot del motore, un percorso mai raggiunto), questo
        // schermo non deve restare bloccato per sempre a coprire la
        // pagina — a differenza del vecchio #preIntroCover statico (mai
        // rimosso da solo), un'animazione ferma per sempre sembrerebbe un
        // gioco rotto, non un caricamento lento. Tempo generoso apposta
        // (10s): non deve MAI scattare nel percorso normale, è solo
        // un'ultima ancora di salvezza.
        safetyTimer = setTimeout(hide, 10000);
    }
})();
