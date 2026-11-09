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
        medal: ['🏅', '🥇', '🥈', '🥉', '🎖', '🌟', '🌠', '💍', '🟤', '🌸'],
        // Segni di interfaccia (1.6.25): avvisi, stati e comandi, prima emoji di sistema.
        warning: ['⚠'],
        info: ['ℹ'],
        lock: ['🔒', '🔐'],
        hourglass: ['⏳', '⌛'],
        heart: ['❤', '💗', '💖'],
        fist: ['✊'],
        hand: ['✋', '🖐'],
        scissors: ['✌'],
        key: ['🔑'],
        flag: ['🏳', '🏁'],
        plug: ['🔌'],
        cart: ['🛒'],
        list: ['📋', '🗂', '📓'],
        tag: ['🏷', '🎫'],
        users: ['👥', '👤', '🧑'],
        clock: ['🕓', '🕐'],
        minus: ['➖'],
        plus: ['➕'],
        undo: ['↩'],
        ban: ['🚫'],
        trash: ['🗑'],
        pencil: ['✏'],
        search: ['🔍'],
        cloudUp: ['⬆'],
        cloudDown: ['⬇'],
        cloud: ['☁'],
        exit: ['🚪'],
        tournament: ['🏆', '🏟'],
        crown: ['👑', '♛'],
        star: ['⭐', '★', '✨', '💎', '☆'],
        puzzle: ['🧩'],
        tower: ['🗼', '🏛', '🏢', '🏙', '🧱', '🏔', '🏰'],
        fusionDeck: ['🐲', '🐉', '🦖', '🐘', '🦅', '🐺', '🐧', '🦋', '🐛', '🪽', '🪶', '🐍', '🦂'],
        duel: ['▶'],
        skull: ['🩸', '💀', '💔', '😈', '👹', '👻', '🕸', '🕳', '☠'],
        multiplayer: ['🌐', '🤝'],
        story: ['📖', '📜', '📌', '📕', '📚'],
        pack: ['📦', '🎁'],
        cards: ['🎴', '🃏', '🎩', '🎭', '🎲', '🎓', '🂠'],
        arena: ['🏝', '🌊', '🌑', '☀', '🌪', '🌅', '🌙'],
        eye: ['🔮', '🪄', '🧙', '🧠', '🔱', '👁', '📿', '🪞'],
        rules: ['⚖'],
        calendar: ['📅', '🗓'],
        sandbox: ['🎮', '🎥', '📺', '🤖', '🔧', '🛠'],
        save: ['💾'],
        collection: ['🏺', '🗿', '⚱', '🖼'],
        profile: ['🧍', '🕴'],
        graveyard: ['♻', '🌀'],
        exchange: ['🔁', '🔄', '⛓'],
        bulb: ['💡'],
        coin: ['💰', '🪙'],
        map: ['🗺'],
        check: ['✓', '✅', '✔'],
        close: ['✕', '✖', '❌'],
        fieldSpell: ['🌀']
    };
    const MAPPA = {};
    Object.keys(GRUPPI).forEach((icona) => GRUPPI[icona].forEach((e) => { if (!MAPPA[e]) MAPPA[e] = icona; }));

    // Una emoji (con eventuale selettore di variante) o un segno gia' mappato; \p{Extended_Pictographic} prende il resto.
    const RE = /(\p{Extended_Pictographic}|\p{Regional_Indicator}+|[✓✕★☆♛])️?(‍\p{Extended_Pictographic}️?)*/gu;

    function idrata(radice, opzioni) {
        if (!radice || !window.Icons || !Icons.buildIcon) return;
        const fallback = opzioni && opzioni.fallback;
        const escludi = (opzioni && opzioni.escludi) || '';
        const nodi = [];
        const cammina = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT);
        while (cammina.nextNode()) {
            const n = cammina.currentNode;
            if (n.parentNode && /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|TITLE|NOSCRIPT)$/.test(n.parentNode.nodeName)) continue;
            RE.lastIndex = 0;
            if (!RE.test(n.nodeValue)) continue;
            // `escludi`: sottoalberi da lasciare com'erano (un registro di cronaca, le carte). Si controlla solo per i nodi con emoji.
            if (escludi && n.parentElement && n.parentElement.closest(escludi)) continue;
            nodi.push(n);
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

    /**
     * Modalita' per una pagina intera: idrata subito e poi, ad ogni nodo AGGIUNTO o testo cambiato, solo quel pezzo (non rilegge
     * tutto il documento: costa poco anche su pagine che ridisegnano spesso). Il testo che JS scrive dopo (avvisi, stati, schermate
     * costruite con innerHTML) si converte da solo, senza che ogni punto si ricordi di chiamarlo.
     *   EmojiTema.automatico();                                   // tutta la pagina
     *   EmojiTema.automatico({ solo: ['#modale', '.hud'] });      // solo questi contenitori (il resto, es. un registro, resta com'e')
     *   opzioni.escludi: selettore di sottoalberi da non toccare; opzioni.fallback: come per idrata.
     */
    function automatico(opzioni) {
        opzioni = opzioni || {};
        const escludi = opzioni.escludi || '';
        const radici = opzioni.solo
            ? [].concat.apply([], opzioni.solo.map((s) => Array.from(document.querySelectorAll(s))))
            : [document.body];
        const dentro = (el) => radici.some((r) => r === el || r.contains(el));
        const saltato = (el) => !el.isConnected || (escludi && el.closest && el.closest(escludi)) || (el.closest && el.closest('svg'));
        let inAttesa = new Set();
        let pianificato = false;
        const lavora = () => {
            pianificato = false;
            const elenco = Array.from(inAttesa);
            inAttesa = new Set();
            elenco.forEach((el) => { if (!saltato(el)) idrata(el, opzioni); });
        };
        const segna = (el) => {
            if (!el || el.nodeType !== 1 || !dentro(el)) return;
            inAttesa.add(el);
            if (!pianificato) { pianificato = true; requestAnimationFrame(lavora); }
        };
        radici.forEach((r) => idrata(r, opzioni));
        if (!window.MutationObserver) return;
        new MutationObserver((mutazioni) => {
            mutazioni.forEach((m) => {
                if (m.type === 'characterData') segna(m.target.parentElement);
                else m.addedNodes.forEach((n) => segna(n.nodeType === 1 ? n : n.parentElement));
            });
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    // Stile minimo: in riga col testo, della sua misura.
    const stile = document.createElement('style');
    stile.textContent = '.emoji-tema { width: 1.1em; height: 1.1em; vertical-align: -0.2em; margin: 0 0.15em; }';
    document.head.appendChild(stile);

    window.EmojiTema = { idrata: idrata, segui: segui, automatico: automatico, MAPPA: MAPPA };
})();
