/**
 * emoji-tema.js — le emoji di sistema sostituite dalle icone del TEMA (js/ui/icon-library.js).
 * =======================================================================================
 * Molte schermate nascono con emoji (le Sfide ne portano una per ognuna, i titoli dei gruppi, le pagine delle modalita'): su telefono
 * escono con i colori e lo stile del sistema, fuori dal linguaggio oro-e-pietra del gioco. Questo modulo le trova nei nodi di testo
 * di un contenitore e le cambia con l'icona SVG corrispondente (stessa forma e colore del testo che le circonda: currentColor).
 *
 *   EmojiTema.idrata(contenitore, { fallback: 'medal' });
 *
 * Con `fallback` OGNI altra emoji pittografica viene sostituita da quell'icona (le Sfide ne usano un centinaio diverse: una mappa per
 * ognuna sarebbe lunga e fragile); senza, le emoji sconosciute restano com'erano. Idempotente: le icone gia' messe non sono testo.
 */
(function () {
    'use strict';

    // Emoji -> nome icona di icon-library.js. Raggruppate per significato, non una a una.
    const GRUPPI = {
        attackPos: ['⚔', '🗡', '🔥', '⚡', '🪓', '🔪', '🥊'],
        defensePos: ['🛡', '🪤', '🚧'],
        target: ['🎯', '🏹', '🎣', '🔺'],
        medal: ['🏅', '🥇', '🥈', '🥉', '🎖', '🌟', '🌠', '❤', '💍', '🟤', '🌸'],
        tournament: ['🏆', '🏟'],
        crown: ['👑', '♛'],
        star: ['⭐', '★', '✨', '💎', '☆'],
        puzzle: ['🧩'],
        tower: ['🗼', '🏛', '🏢', '🏙', '🧱', '🚪', '🏔', '🏰'],
        fusionDeck: ['🐲', '🐉', '🦖', '🐘', '🦅', '🐺', '🐧', '🦋', '🐛', '🪽', '🪶', '🐍', '🦂'],
        duel: ['▶'],
        skull: ['🩸', '💀', '💔', '😈', '👹', '👻', '🕸', '🕳', '☠'],
        multiplayer: ['🌐', '🤝'],
        story: ['📖', '📜', '📌', '📕', '📚'],
        pack: ['📦', '🎁'],
        cards: ['🎴', '🃏', '🎩', '🎭', '🎲', '🎓'],
        arena: ['🏝', '🌊', '🌑', '☀', '🌪', '🌅', '🌙'],
        eye: ['🔮', '🪄', '🧙', '🧠', '🔱', '👁', '📿', '🪞'],
        rules: ['⚖'],
        calendar: ['📅', '🗓'],
        sandbox: ['🎮', '🎥', '📺', '🤖', '🔧'],
        save: ['💾'],
        collection: ['🏺', '🗿', '⚱', '🖼'],
        profile: ['🧍', '🕴'],
        graveyard: ['♻', '🌀'],
        exchange: ['🔁', '🔄', '⛓'],
        bulb: ['💡'],
        coin: ['💰', '🪙'],
        map: ['🗺'],
        check: ['✓', '✅', '✔'],
        close: ['✕', '✖'],
        fieldSpell: ['🌀']
    };
    const MAPPA = {};
    Object.keys(GRUPPI).forEach((icona) => GRUPPI[icona].forEach((e) => { if (!MAPPA[e]) MAPPA[e] = icona; }));

    // Una emoji (con eventuale selettore di variante) o un segno gia' mappato; \p{Extended_Pictographic} prende il resto.
    const RE = /(\p{Extended_Pictographic}|\p{Regional_Indicator}+|[✓✕★☆♛])️?(‍\p{Extended_Pictographic}️?)*/gu;

    function idrata(radice, opzioni) {
        if (!radice || !window.Icons || !Icons.buildIcon) return;
        const fallback = opzioni && opzioni.fallback;
        const nodi = [];
        const cammina = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT);
        while (cammina.nextNode()) {
            const n = cammina.currentNode;
            if (n.parentNode && /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(n.parentNode.nodeName)) continue;
            RE.lastIndex = 0;
            if (RE.test(n.nodeValue)) nodi.push(n);
        }
        nodi.forEach((nodo) => {
            const testo = nodo.nodeValue;
            const frammento = document.createDocumentFragment();
            let ultimo = 0;
            let cambiato = false;
            RE.lastIndex = 0;
            let m;
            while ((m = RE.exec(testo))) {
                const base = m[1];
                const nome = MAPPA[base] || fallback;
                if (!nome) continue;
                const svg = Icons.buildIcon(nome);
                if (!svg) continue;
                if (m.index > ultimo) frammento.appendChild(document.createTextNode(testo.slice(ultimo, m.index)));
                svg.classList.add('emoji-tema', 'emoji-tema--' + nome);
                frammento.appendChild(svg);
                ultimo = m.index + m[0].length;
                cambiato = true;
            }
            if (!cambiato) return;
            if (ultimo < testo.length) frammento.appendChild(document.createTextNode(testo.slice(ultimo)));
            nodo.parentNode.replaceChild(frammento, nodo);
        });
    }

    /**
     * Tiene un contenitore sempre "a tema": ad ogni cambio del suo contenuto idrata i segnaposto <span data-icon> (Icons.hydrate)
     * e sostituisce le emoji (idrata). Serve alle pagine che ridisegnano una schermata con `innerHTML` (le tre pagine dei tornei:
     * Campione, Eliminato, Duello in sospeso...) senza dover ricordare di chiamarlo dopo ogni render. L'osservatore si scollega
     * mentre lavora, cosi' le proprie modifiche non lo richiamano; `idrata` e' comunque idempotente.
     */
    function segui(radice, opzioni) {
        if (!radice || !window.MutationObserver) return;
        const config = { childList: true, subtree: true };
        const lavora = () => {
            osservatore.disconnect();
            try {
                if (window.Icons && Icons.hydrate) Icons.hydrate(radice);
                idrata(radice, opzioni);
            } finally {
                osservatore.observe(radice, config);
            }
        };
        const osservatore = new MutationObserver(lavora);
        lavora();
    }

    // Stile minimo: in riga col testo, della sua misura.
    const stile = document.createElement('style');
    stile.textContent = '.emoji-tema { width: 1.1em; height: 1.1em; vertical-align: -0.2em; margin: 0 0.15em; }';
    document.head.appendChild(stile);

    window.EmojiTema = { idrata: idrata, segui: segui, MAPPA: MAPPA };
})();
