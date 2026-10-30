// @ts-check
/**
 * Cerimonia per una carta GUADAGNATA (drop, Storia o Sfida).
 * Non decide né accredita nulla: visualizza un premio già persistito.
 * Una coda impedisce a due ricompense simultanee di sovrapporsi.
 */
(function () {
    'use strict';
    const STORAGE_KEY = 'duelArenaPendingCardDrops';
    // Prima di questo istante la carta sta ancora compiendo la rotazione
    // d'ingresso: permettere di chiudere il fondale produceva una cerimonia
    // troncata e, con premi in coda, due animazioni quasi sovrapposte.
    const REVEAL_TEXT_MS = 1650;
    const REVEAL_READY_MS = 2450;
    const queue = [];
    let active = false;

    function reducedMotion() {
        try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }
    function cardById(id) {
        const db = typeof cardDatabase !== 'undefined' ? cardDatabase : (window.cardDatabase || []);
        return db.find((c) => c.id === Number(id)) || null;
    }
    function rarity(id) {
        if (window.CardRarity) return CardRarity.of(Number(id));
        if ([30, 31, 472].indexOf(Number(id)) !== -1) return 'mythic';
        if ([11, 41, 42, 43, 44, 246, 866, 867, 868, 869, 870].indexOf(Number(id)) !== -1) return 'secret';
        return 'legendary';
    }
    function label(r) {
        return window.CardRarity ? CardRarity.label(r) : ({ mythic: 'Mitica', secret: 'Segreta', legendary: 'Leggendaria' }[r] || r);
    }
    function make(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }
    // La carta si disegna SEMPRE con il renderer di tutte le altre carte
    // (js/ui/card-renderer.js + js/ui/card.css): ogni pagina che carica
    // questo file carica anche quelli, lo controlla il guardrail
    // tests/specs/guardrail-pagine-con-carte.spec.js. Prima qui c'era una
    // seconda cornice di ripiego, con un suo stile e un percorso
    // dell'illustrazione sbagliato per le carte non Yu-Gi-Oh (stanno in
    // images/cards/non-ygo/, e il ripiego le cercava in images/cards/).
    // Una carta che non esiste nel database resta coperta: meglio un dorso
    // di una carta inventata.
    function cardNode(entry) {
        return window.createCardElement(cardById(entry.cardId));
    }
    function particles(root, amount) {
        const layer = make('div', 'cdrop-particles');
        for (let i = 0; i < amount; i++) {
            const p = make('i', 'cdrop-particle');
            p.style.setProperty('--a', `${(360 / amount) * i + (i % 3) * 7}deg`);
            p.style.setProperty('--d', `${80 + (i * 37) % 190}px`);
            p.style.setProperty('--delay', `${(i % 7) * 35}ms`);
            p.style.setProperty('--size', `${2 + (i % 4)}px`);
            layer.appendChild(p);
        }
        root.appendChild(layer);
    }

    function showNext() {
        if (active || !queue.length || !document.body) return;
        active = true;
        const entry = queue.shift();
        const r = rarity(entry.cardId);
        const overlay = make('div', `cdrop-overlay cdrop-${r}`);
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-label', `Carta ottenuta: ${entry.nome || ''}`);

        const depth = make('div', 'cdrop-depth');
        depth.appendChild(make('div', 'cdrop-horizon'));
        depth.appendChild(make('div', 'cdrop-ring cdrop-ring-a'));
        depth.appendChild(make('div', 'cdrop-ring cdrop-ring-b'));
        depth.appendChild(make('div', 'cdrop-ring cdrop-ring-c'));
        overlay.appendChild(depth);
        // Poche particelle ben separate sono piu leggibili e molto meno
        // costose dei vecchi 42-72 punti, soprattutto nella WebView Android.
        particles(overlay, r === 'mythic' ? 36 : r === 'secret' ? 30 : 24);

        const content = make('div', 'cdrop-content');
        content.appendChild(make('div', 'cdrop-kicker', 'RICOMPENSA OTTENUTA'));
        const stage = make('div', 'cdrop-stage');
        const card = make('div', 'cdrop-card');
        // Il dorso è quello di ogni altra carta coperta del gioco (stesso
        // renderer, stesso retro costruito interamente in CSS), non un motivo
        // disegnato apposta per questa schermata.
        const back = make('div', 'cdrop-card-back');
        back.appendChild(window.createCardElement(null));
        card.appendChild(back);
        const face = make('div', 'cdrop-card-front');
        const fronte = cardNode(entry);
        face.appendChild(fronte);
        card.appendChild(face);
        stage.appendChild(make('div', 'cdrop-beam'));
        stage.appendChild(card);
        // La carta vinta si inclina e brilla secondo la sua rarità. Si
        // inclina il PALCO e non la carta: la carta sta dentro una faccia
        // che si gira e ne ritaglia i bordi.
        if (window.CartaViva) CartaViva.rendi(fronte, cardById(entry.cardId), { modo: 'grande', bersaglio: stage, area: overlay });
        content.appendChild(stage);
        content.appendChild(make('div', 'cdrop-name', entry.nome || `Carta #${entry.cardId}`));
        content.appendChild(make('div', 'cdrop-rarity', label(r)));
        if (entry.rule) content.appendChild(make('div', 'cdrop-rule', entry.rule));
        // La carta è già nel salvataggio: il pulsante chiude soltanto la
        // cerimonia, quindi non deve fingere di effettuare ora l'accredito.
        const button = make('button', 'cdrop-continue', 'Continua ›');
        button.type = 'button';
        button.disabled = !reducedMotion();
        button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
        content.appendChild(button);
        overlay.appendChild(content);
        document.body.appendChild(overlay);

        const close = () => {
            if (button.disabled) return;
            if (overlay.classList.contains('cdrop-leaving')) return;
            overlay.classList.add('cdrop-leaving');
            setTimeout(() => { overlay.remove(); active = false; showNext(); }, reducedMotion() ? 20 : 380);
        };
        button.onclick = close;
        requestAnimationFrame(() => overlay.classList.add('cdrop-visible'));
        if (window.NativeHaptics) NativeHaptics.success();
        if (window.SFX && typeof SFX.summon === 'function') SFX.summon('effect');
        if (reducedMotion()) {
            overlay.classList.add('cdrop-reduced', 'cdrop-revealed', 'cdrop-ready');
        } else {
            setTimeout(() => {
                if (overlay.isConnected && !overlay.classList.contains('cdrop-leaving')) {
                    overlay.classList.add('cdrop-revealed');
                }
            }, REVEAL_TEXT_MS);
            setTimeout(() => {
                if (!overlay.isConnected || overlay.classList.contains('cdrop-leaving')) return;
                button.disabled = false;
                button.setAttribute('aria-disabled', 'false');
                overlay.classList.add('cdrop-ready');
                button.focus({ preventScroll: true });
            }, REVEAL_READY_MS);
        }
    }

    function enqueue(entry) {
        if (!entry || !entry.cardId) return;
        // Illustrazione scaricata e decodificata prima che la carta compaia (1.4.183, vedi precaricaCarte in pack-opening.js).
        try {
            const c = (typeof cardDatabase !== 'undefined' ? cardDatabase : []).find((x) => x.id === entry.cardId);
            if (c && typeof window.getCardImagePath === 'function') { const im = new Image(); im.decoding = 'async'; im.src = window.getCardImagePath(c); (window.__cdropPre = window.__cdropPre || []).push(im); }
        } catch (e) { /* il precaricamento e' un di piu' */ }
        queue.push(Object.assign({}, entry));
        showNext();
    }
    function persist(entry) {
        try {
            const values = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
            values.push(entry);
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(values));
        } catch (e) { /* Il premio è già nel save: si perde solo la cerimonia. */ }
    }
    function drain() {
        try {
            const values = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
            sessionStorage.removeItem(STORAGE_KEY);
            values.forEach(enqueue);
        } catch (e) { /* noop */ }
    }

    window.CardDropAnimation = { enqueue, persist, drain };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', drain);
    else drain();
})();
