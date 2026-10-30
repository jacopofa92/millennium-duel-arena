// @ts-check
/**
 * game-logo.js — Il logo del gioco, uno solo per tutte le schermate.
 * =====================================================================
 * `<game-logo variante="splash">` nello splash d'apertura, `<game-logo
 * variante="menu">` nel menu principale e nella schermata d'accesso.
 * Prima il logo era una "✦" pulsante sopra due righe di testo, scritto a
 * mano identico in tre punti di index.html: un componente solo vuol dire
 * che un ritocco al logo si fa una volta e si vede ovunque, invece di
 * tre copie che vanno alla deriva (è già successo altrove in questo
 * progetto con la topbar e il Profilo).
 *
 * COM'È FATTO. Un emblema e una scritta.
 *   - L'emblema è il Puzzle del Millennio visto di fronte: la piramide
 *     rovesciata d'oro con l'Occhio di Wedjat, dentro due anelli che
 *     girano in versi opposti — il più esterno a tacche, come una fascia
 *     di geroglifici. È SVG, non un'immagine: resta nitido a qualunque
 *     grandezza (lo stesso disegno fa da emblema di 190px nello splash e
 *     di 60px nel menu) e ogni pezzo si anima per conto suo.
 *   - La scritta resta "YU-GI-OH! / DUEL ARENA", in un carattere con le
 *     monumentali: `Duel Arena Inscription` è incluso localmente sotto assets/fonts
 *     (licenza OFL), quindi funziona offline, da file:// e nell'APK senza
 *     richieste esterne. Un riflesso di luce lo attraversa ogni pochi secondi.
 *
 * VARIANTI. Il disegno è lo stesso; cambia solo cosa si muove, e lo
 * decide il CSS (js/ui/game-logo.css) leggendo l'attributo:
 *   splash  la sequenza d'ingresso (gli anelli si disegnano, la piramide
 *           si compone, l'Occhio si apre con un'onda di luce, la scritta
 *           entra lettera per lettera), poi il movimento lento;
 *   menu    niente ingresso, solo il movimento lento — ci si torna tante
 *           volte, e rifare lo spettacolo ogni volta stancherebbe.
 *
 * Custom element SENZA shadow DOM, apposta: le regole di game-logo.css e
 * gli override delle singole pagine (le misure ridotte di index.html su
 * schermi bassi) arrivano normalmente. Va caricato NEL <head>: così
 * l'elemento è già definito quando il parser lo incontra, e si disegna
 * al primo fotogramma invece di comparire vuoto per un istante.
 */
(function () {
    'use strict';

    // Ogni istanza ha i SUOI id per i gradienti SVG. Non è pignoleria: lo
    // splash, il menu e l'accesso stanno nella stessa pagina, e se due
    // SVG dichiarassero lo stesso id il riferimento andrebbe al primo —
    // che è lo splash, messo a display:none appena finisce. Un gradiente
    // definito dentro un SVG non visualizzato non viene dipinto (Chrome),
    // quindi il logo del menu resterebbe senza oro.
    let contatore = 0;

    function emblema(id) {
        const g = (nome) => `gl-${nome}-${id}`;
        // GEOMETRIA DALLA FOTO del Puzzle vero (vedi js/ui/splash-webgl.js): unita' "e" = pixel della foto / 375, mezza larghezza in
        // cima = 1, ey verso l'alto con 0 al centro dell'iride. Qui diventano unita' SVG: X = 62 * ex, y = -5.9 - 62 * ey.
        const X = (ex) => +(62 * ex).toFixed(1), Y = (ey) => +(-5.9 - 62 * ey).toFixed(1);
        const pt = (ex, ey) => `${X(ex)},${Y(ey)}`;
        const poli = (punti) => 'M' + punti.map((q) => pt(q[0], q[1])).join(' L');
        // Le scanalature a gradini (meta' sinistra; la destra e' lo specchio): le stesse del shader.
        const gradini = [
            [[-.627, .453], [-.627, .333], [-.747, .333], [-.667, .248], [-.741, .155], [-.515, .048], [-.328, -.125], [-.368, -.227], [-.195, -.227], [-.115, -.293], [0, -.39]],
            [[-.28, .44], [-.28, .248], [-.475, .248], [-.408, .155], [-.515, .048]],
            [[-.141, .44], [-.141, .248], [.141, .248], [.141, .44]],
            [[0, -.387], [0, -.533]], [[-.181, -.536], [.181, -.536]]
        ];
        const speculare = (a) => a.map((q) => [-q[0], q[1]]);
        const giunture = gradini.map((a, i) => i < 2 ? poli(a) + ' ' + poli(speculare(a)) : poli(a)).join(' ');
        // Spirale della Wedjat (centro in basso a destra, ~1,5 giri): punti dalla formula r = .012 + .0105*T.
        const spirale = (() => {
            const c = [.215, -.345], pts = [];
            for (let T = 9.74; T >= 0.3; T -= 0.3) pts.push([c[0] + (.012 + .0105 * T) * Math.cos(T), c[1] + (.012 + .0105 * T) * Math.sin(T)]);
            return poli(pts);
        })();
        // Le 8 gemme sull'anello di mezzo, ogni 45 gradi.
        const gemme = Array.from({ length: 8 }, (_, i) =>
            `<path class="gl-gemma" d="M0,-80 L3,-76 L0,-72 L-3,-76 Z" transform="rotate(${i * 45})"/>`).join('');
        return `
<svg class="gl-emblema" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
    <defs>
        <linearGradient id="${g('oro')}" x1="0" y1="-1" x2="0.35" y2="1">
            <stop offset="0" stop-color="#fff8e1"/>
            <stop offset="0.28" stop-color="#f7d774"/>
            <stop offset="0.62" stop-color="#f39c12"/>
            <stop offset="1" stop-color="#8a4f06"/>
        </linearGradient>
        <linearGradient id="${g('lama')}" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#fff" stop-opacity="0"/>
            <stop offset="0.5" stop-color="#fff" stop-opacity="0.85"/>
            <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
        <radialGradient id="${g('alone')}">
            <stop offset="0" stop-color="#f7d774" stop-opacity="0.55"/>
            <stop offset="0.55" stop-color="#f39c12" stop-opacity="0.16"/>
            <stop offset="1" stop-color="#f39c12" stop-opacity="0"/>
        </radialGradient>
        <clipPath id="${g('taglio')}">
            <path d="M-62,-34 L62,-34 L0,62 Z"/>
        </clipPath>
    </defs>

    <circle class="gl-alone" r="98" fill="url(#${g('alone')})"/>
    <circle class="gl-onda" r="46"/>

    <g class="gl-anello gl-anello--esterno">
        <circle class="gl-traccia" r="92" pathLength="100"/>
        <circle class="gl-tacche" r="86"/>
    </g>
    <g class="gl-anello gl-anello--medio">
        <circle class="gl-traccia" r="76" pathLength="100"/>
        ${gemme}
    </g>

    <g class="gl-piramide">
        <path class="gl-piramide-corpo" d="M-62,-34 L62,-34 L0,62 Z" pathLength="100" fill="url(#${g('oro')})"/>
        <!-- Le giunture dei pezzi del Puzzle: si vede che è composto. -->
        <path class="gl-giunture" d="${giunture}"/>
        <!-- Il riflesso che attraversa la piramide. Il movimento sta sul
             GRUPPO e l'inclinazione sul rettangolo: un transform CSS
             sostituisce quello scritto come attributo, quindi animare il
             rettangolo stesso gli toglierebbe la rotazione. -->
        <g clip-path="url(#${g('taglio')})">
            <g class="gl-lama">
                <rect x="-11" y="-70" width="22" height="150" fill="url(#${g('lama')})" transform="rotate(18)"/>
            </g>
        </g>
        <g class="gl-occhio">
            <!-- L'Occhio e' IN RILIEVO, non disegnato in nero: le sagome si definiscono una volta sola e si disegnano tre volte —
                 un'ombra scura appena spostata in basso a destra, il corpo in oro chiaro, e un filo di luce in alto a sinistra. -->
            <defs>
                <path id="${g('sopracciglio')}" fill="none" d="M${pt(-.405, .075)} Q${pt(0, .115)} ${pt(.405, .075)}" style="stroke-width:calc(var(--k,1)*6.4px)"/>
                <path id="${g('palpebra')}" fill="none" style="stroke-width:calc(var(--k,1)*4px)" d="M${pt(-.405, -.025)} L${pt(.405, -.025)}"/>
                <path id="${g('inferiore')}" fill="none" style="stroke-width:calc(var(--k,1)*4.2px)" d="M${pt(-.405, -.03)} Q${pt(0, -.23)} ${pt(.405, -.03)}"/>
                <circle id="${g('iride')}" fill="none" style="stroke-width:calc(var(--k,1)*4px)" cx="0" cy="${Y(0)}" r="7.4"/>
                <circle id="${g('pupilla')}" stroke="none" cx="0" cy="${Y(0)}" r="3.4"/>
                <!-- Le due gambe sotto l'occhio (la sinistra con il piede, la destra che si arrotola) e la spirale. -->
                <path id="${g('segno')}" fill="none" style="stroke-width:calc(var(--k,1)*4.4px)" d="M${pt(-.067, -.17)} L${pt(-.067, -.31)} Q${pt(-.075, -.385)} ${pt(-.235, -.435)} M${pt(.058, -.17)} L${pt(.058, -.31)} Q${pt(.065, -.35)} ${pt(.105, -.375)} ${spirale.replace('M', 'M')}"/>
                <linearGradient id="${g('rilievo')}" gradientUnits="userSpaceOnUse" x1="-30" y1="-40" x2="30" y2="28">
                    <stop offset="0" stop-color="#f1c04a"/>
                    <stop offset="0.5" stop-color="#d79a1c"/>
                    <stop offset="1" stop-color="#9a6208"/>
                </linearGradient>
            </defs>            <g class="gl-rilievo gl-rilievo--ombra" transform="translate(1.1,1.8)">
                <use href="#${g('sopracciglio')}"/><use href="#${g('palpebra')}"/><use href="#${g('inferiore')}"/><use href="#${g('iride')}"/><use href="#${g('pupilla')}"/><use href="#${g('segno')}"/>
            </g>
            <g class="gl-rilievo gl-rilievo--corpo" style="--gl-rilievo: url(#${g('rilievo')})">
                <use href="#${g('sopracciglio')}"/><use href="#${g('palpebra')}"/><use href="#${g('inferiore')}"/><use class="gl-iride" href="#${g('iride')}"/><use href="#${g('pupilla')}"/><use href="#${g('segno')}"/>
            </g>
            <g class="gl-rilievo gl-rilievo--luce" transform="translate(-0.5,-0.8)">
                <use href="#${g('sopracciglio')}"/><use href="#${g('palpebra')}"/><use href="#${g('inferiore')}"/><use href="#${g('iride')}"/><use href="#${g('segno')}"/>
            </g>
        </g>
    </g>
</svg>`;
    }

    function scritta() {
        // La prima riga lettera per lettera: nello splash entrano una
        // dopo l'altra (--i è l'indice, letto dal CSS per il ritardo).
        const riga1 = Array.from('YU-GI-OH!').map((c, i) =>
            `<span class="gl-lettera" style="--i:${i}">${c}</span>`).join('');
        // "Yu-Gi-Oh! Millennium Duel Arena": la riga grande è MILLENNIUM
        // (dieci lettere, quante ne aveva "DUEL ARENA": stessa misura e
        // nessun rischio di uscire dai bordi), e sotto, piccola e spaziata
        // come la prima riga, DUEL ARENA.
        return `
<div class="gl-scritta">
    <span class="gl-riga1">${riga1}</span>
    <span class="gl-riga2" data-testo="MILLENNIUM">MILLENNIUM</span>
    <span class="gl-riga3">DUEL ARENA</span>
</div>`;
    }

    class GameLogo extends HTMLElement {
        connectedCallback() {
            // Già disegnato: un elemento spostato nel DOM richiama
            // connectedCallback, e ridisegnarlo farebbe ripartire le
            // animazioni a metà.
            if (this.__disegnato) return;
            this.__disegnato = true;
            if (!this.getAttribute('variante')) this.setAttribute('variante', 'menu');
            this.setAttribute('role', 'img');
            this.setAttribute('aria-label', 'Yu-Gi-Oh! Millennium Duel Arena');
            this.innerHTML = emblema(++contatore) + scritta();
        }
    }

    if (window.customElements && !customElements.get('game-logo')) {
        customElements.define('game-logo', GameLogo);
    }
})();
