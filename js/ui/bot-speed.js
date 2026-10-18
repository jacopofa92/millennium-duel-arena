// @ts-check
/**
 * bot-speed.js — Velocità del bot scelta dal giocatore.
 * ------------------------------------------------------------------
 * Due livelli: 'normale' (il ritmo di sempre) e 'veloce' (le pause
 * fra una mossa e l'altra del bot si accorciano). Cambia SOLO le pause
 * di ritmo del bot (js/ai/bot.js): le animazioni, le cinematiche e le
 * attese che hanno un motivo (un modale aperto, un filmato in corso)
 * restano com'erano, perché accorciarle farebbe agire il bot sopra
 * qualcosa che il giocatore sta ancora guardando.
 *
 * Preferenza del DISPOSITIVO (localStorage, non il salvataggio): stesso
 * schema e stessa motivazione di js/ui/video-quality.js.
 *
 * `botMs(ms)` è l'unico punto d'uso: ogni pausa di ritmo in bot.js passa
 * da lì. Se questo script non è caricato, bot.js ripiega su `ms` intatto.
 */
(function () {
    'use strict';

    const CHIAVE = 'ygoBotSpeed';
    const NORMALE = 'normale';
    const VELOCE = 'veloce';
    /** Fattore applicato alle pause: 'veloce' le porta a poco più di un terzo. */
    const FATTORE = { normale: 1, veloce: 0.35 };

    function leggi() {
        try {
            const v = localStorage.getItem(CHIAVE);
            return v === VELOCE ? VELOCE : NORMALE;
        } catch (e) {
            return NORMALE;
        }
    }

    function imposta(livello) {
        const valido = livello === VELOCE ? VELOCE : NORMALE;
        try { localStorage.setItem(CHIAVE, valido); } catch (e) { /* vale per questa sessione */ }
        return valido;
    }

    window.BotSpeed = {
        NORMALE: NORMALE,
        VELOCE: VELOCE,
        get: leggi,
        set: imposta,
        isVeloce: () => leggi() === VELOCE,
        scale: (ms) => Math.round(ms * FATTORE[leggi()])
    };
})();
