// @ts-check
/**
 * challenge-banner.js — Banner "Sfida completata" in alto a destra,
 * condiviso da ogni pagina che lo include (vedi js/ui/challenge-banner.css
 * per lo stile). Nato per essere generico: ChallengeBanner.show(def) può
 * essere chiamata da chiunque, ma il chiamante normale è
 * js/challenges/challenge-tracker.js quando una sfida viene completata.
 *
 * Al proprio avvio (init(), chiamata automaticamente in fondo a questo
 * file) svuota anche l'eventuale coda di sfide completate su un'ALTRA
 * pagina che non aveva questo banner caricato — vedi
 * ChallengeTracker.drainPendingBanners().
 *
 * Le sfide si accodano (una `queue`, mai sovrapposte): se più di una si
 * completa nello stesso istante (es. un'Evocazione che soddisfa due
 * sfide diverse) vengono mostrate una dopo l'altra, non impilate.
 */
(function () {
    'use strict';

    const SHOW_MS = 4200;
    const FADE_MS = 400;

    let queue = [];
    let showing = false;

    function ensureElement() {
        let el = document.getElementById('challengeBanner');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'challengeBanner';
        el.className = 'challenge-banner';
        el.innerHTML = `
            <div class="challenge-banner-icon"></div>
            <div class="challenge-banner-body">
                <div class="challenge-banner-title">🏆 Sfida completata!</div>
                <div class="challenge-banner-label"></div>
                <div class="challenge-banner-desc"></div>
                <div class="challenge-banner-rewards"></div>
            </div>
        `;
        document.body.appendChild(el);
        return el;
    }

    function showNext() {
        if (showing || queue.length === 0) return;
        showing = true;
        const def = queue.shift();
        const el = ensureElement();
        el.querySelector('.challenge-banner-icon').textContent = def.icon || '🏆';
        el.querySelector('.challenge-banner-label').textContent = def.label || '';
        el.querySelector('.challenge-banner-desc').textContent = def.description || '';

        // Che cosa ha FRUTTATO. Senza questa riga il banner diceva solo
        // "completata" e i crediti comparivano nel Profilo senza che
        // niente li avesse annunciati — e in questo gioco vale la regola
        // che ogni guadagno deve mostrare anche la ragione per cui è
        // arrivato, mai il solo numero.
        //
        // Le voci sono già accreditate a monte (Rewards.forChallenge) e
        // arrivano qui solo per essere mostrate: questo file non tocca
        // mai le valute.
        const premiEl = /** @type {HTMLElement} */ (el.querySelector('.challenge-banner-rewards'));
        const voci = def.rewards || [];
        // Testo costruito qui da valori di nostri file di dati (icona,
        // nome valuta, importo numerico), mai da input dell'utente.
        premiEl.innerHTML = voci.length === 0 ? '' : voci.map((r) =>
            `<span class="challenge-banner-reward"><span class="challenge-banner-reward-icon">${r.icon}</span>+${r.amount} ${r.nome}</span>`
        ).join('');
        premiEl.style.display = voci.length === 0 ? 'none' : '';
        // Un frame vuoto prima di 'show': altrimenti, se l'elemento è appena
        // stato creato, il browser potrebbe fondere lo stato iniziale e
        // quello finale nello stesso frame e la transizione non si
        // vedrebbe (stesso accorgimento già usato per gli overlay di
        // duel-cinematics.js, `void el.offsetWidth`).
        void el.offsetWidth;
        el.classList.add('show');
        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => {
                showing = false;
                showNext();
            }, FADE_MS);
        }, SHOW_MS);
    }

    /**
     * Mostra (o accoda, se un'altra è già a schermo) il banner per la
     * sfida `def` (serve almeno {icon, label, description}).
     *
     * `premi` è l'elenco di voci GIÀ accreditate da
     * Rewards.forChallenge — opzionale, perché una sfida può non dare
     * nulla e perché una coda salvata da una versione precedente del
     * gioco non ce l'ha. Viene attaccato alla copia messa in coda, così
     * showNext() lo ritrova insieme al resto: la coda passa da
     * sessionStorage e deve restare un oggetto solo, serializzabile.
     */
    function show(def, premi) {
        if (!def) return;
        queue.push(Object.assign({}, def, { rewards: premi || def.rewards || [] }));
        showNext();
    }

    function init() {
        if (window.ChallengeTracker && typeof ChallengeTracker.drainPendingBanners === 'function') {
            ChallengeTracker.drainPendingBanners().forEach(show);
        }
    }

    window.ChallengeBanner = { show: show, init: init };

    // js/challenges/challenge-tracker.js potrebbe non essere ancora
    // presente nell'ordine degli script quando questo file viene
    // eseguito — DOMContentLoaded copre comunque il caso normale (tutti
    // gli script sono già stati eseguiti a quel punto).
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
