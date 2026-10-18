// @ts-check
/**
 * visual-effects-library.js — Libreria di effetti visivi NOMINATI,
 * riutilizzabili da qualunque carta senza scrivere codice — pensata per
 * il futuro Card Maker, stesso spirito di js/engine/effect-templates.js ma per
 * l'aspetto invece che per la regola.
 *
 * Una carta può dichiarare in data/cards.json (o via js/data/custom-cards.js):
 *
 *   "visualEffect": "glow-oro"
 *
 * VisualEffects.applyPreset(...) viene chiamata da
 * FX.playCardActivateCenterScreen() in js/ui/effects.js (il pulse "carta a
 * centro schermo" che gira per OGNI attivazione, vedi lì) — quindi non
 * serve toccare nessuno degli ~8 punti del motore che già chiamano
 * quella funzione: il preset si aggiunge SOPRA il pulse standard, mai al
 * posto suo, così una carta senza visualEffect (le 508 attuali) resta
 * visivamente identica a prima.
 *
 * VIDEO DA FILE (ripresa della specifica "evocazioni con filmato" della
 * roadmap, generalizzata): VisualEffects.getVideoFor(id, kind) verifica
 * se esiste video/<kind>/<id>.mp4 SENZA usare fetch() (bloccato sotto
 * file://, vedi il commento in js/data/cards-db.js/scripts/build-cards-data.js
 * per lo stesso problema incontrato con data/cards.json) — usa invece un
 * elemento <video src> e i suoi eventi error/loadedmetadata, la stessa
 * tecnica già in uso per il fallback degli avatar in js/duel-session.js.
 * La cartella video/ ora contiene filmati veri (video/evocazioni/*.mp4,
 * video/vittorie/exodiawin.mp4) riprodotti da playVideoOverlay/
 * playMonsterSummonEffect/playInstantWinCinematic in js/ui/effects.js.
 */
(function () {
    'use strict';

    const PRESETS = {
        'glow-oro': (card, wrapper, cardEl) => {
            cardEl.style.filter = 'drop-shadow(0 0 26px rgba(255, 215, 0, 0.85))';
            burst(wrapper, { count: 30, colors: ['#ffd700', '#fff4c2', '#ffffff'], speed: 4.5, life: 700, gravity: -0.05 });
        },
        'glow-viola': (card, wrapper, cardEl) => {
            cardEl.style.filter = 'drop-shadow(0 0 26px rgba(155, 89, 182, 0.85))';
            burst(wrapper, { count: 30, colors: ['#9b59b6', '#d9b3ff', '#ffffff'], speed: 4.5, life: 700, gravity: -0.05 });
        },
        'glow-rosso': (card, wrapper, cardEl) => {
            cardEl.style.filter = 'drop-shadow(0 0 26px rgba(231, 76, 60, 0.85))';
            burst(wrapper, { count: 34, colors: ['#e74c3c', '#ff9d90', '#ffffff'], speed: 5.5, life: 600, gravity: 0.05 });
        },
        'glow-blu-ghiaccio': (card, wrapper, cardEl) => {
            cardEl.style.filter = 'drop-shadow(0 0 26px rgba(93, 173, 226, 0.85))';
            burst(wrapper, { count: 26, colors: ['#5dade2', '#d6eaf8', '#ffffff'], speed: 3.5, life: 800, gravity: -0.08 });
        }
    };

    function burst(wrapper, particleOpts) {
        if (!window.FX || typeof FX.spawnParticles !== 'function') return;
        setTimeout(() => {
            const rect = wrapper.getBoundingClientRect();
            FX.spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, particleOpts);
        }, 260); // stesso ritardo del suono di attivazione, vedi playCardActivateCenterScreen in effects.js
    }

    /**
     * Applica il preset di `card.visualEffect` (se esiste) sopra la carta
     * già mostrata a centro schermo da playCardActivateCenterScreen —
     * `wrapper` è il contenitore posizionato/animato via CSS, `cardEl` la
     * carta vera e propria dentro di esso. Non fa nulla se la carta non
     * dichiara nessun visualEffect (comportamento di sempre) o se il nome
     * dichiarato non corrisponde a nessun preset registrato (con un
     * warning in console, per aiutare a scovare un refuso in
     * data/cards.json invece di fallire in silenzio).
     */
    function applyPreset(card, wrapper, cardEl) {
        if (!card || !card.visualEffect) return;
        const preset = PRESETS[card.visualEffect];
        if (typeof preset !== 'function') {
            console.warn(`[VisualEffects] preset "${card.visualEffect}" non trovato per "${card.name}".`);
            return;
        }
        preset(card, wrapper, cardEl);
    }

    /** Registra un nuovo preset (o sovrascrive uno esistente) — usata anche da un futuro Card Maker per preset definiti dall'utente stesso. */
    function register(name, fn) {
        PRESETS[name] = fn;
    }

    /**
     * Verifica se esiste un filmato dedicato per questa carta.
     * `kind`: 'evocazioni' | 'magie' | 'trappole' (le tre cartelle
     * previste dalla roadmap, vedi video/<kind>/<id>.mp4). Ritorna una
     * Promise che si risolve col percorso del file se esiste, o null se
     * non esiste/non carica — mai un errore non gestito, così un
     * chiamante futuro può sempre fare
     * `const path = await VisualEffects.getVideoFor(card.id, 'evocazioni'); if (path) {...} else {usa il preset CSS/l'animazione standard}`
     * esattamente come richiesto dalla specifica originale.
     */
    function getVideoFor(cardId, kind) {
        return new Promise((resolve) => {
            const path = `video/${kind}/${cardId}.mp4`;
            const probe = document.createElement('video');
            probe.preload = 'metadata';
            probe.onloadedmetadata = () => resolve(path);
            probe.onerror = () => resolve(null);
            probe.src = path;
        });
    }

    window.VisualEffects = {
        applyPreset: applyPreset,
        register: register,
        getVideoFor: getVideoFor,
        PRESETS: PRESETS
    };
})();
