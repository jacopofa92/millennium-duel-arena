// @ts-check
/**
 * pausa-duello.js — pausa cooperativa del motore offline.
 * ======================================================
 * Android e i browser congelano i timer quando la pagina va in background,
 * ma al ritorno possono consegnarli tutti insieme. Per un duello questo e'
 * pericoloso: l'IA puo' saltare una scelta o avanzare due fasi nello stesso
 * frame. Questo piccolo arbitro mantiene in coda i timer di REGOLA scaduti
 * durante la sospensione e li libera soltanto quando la UI conferma la
 * ripresa.
 *
 * Non decide quando mettere in pausa e non tocca il DOM: il ciclo vita della
 * pagina vive in game-flow.js. Il Multiplayer non lo attiva, perche' fermare
 * un solo client separerebbe i due motori a passo comune.
 */
const PausaDuello = (function () {
    'use strict';

    const motivi = new Set();
    const scaduti = new Set();
    const ascoltatori = new Set();
    let progressivo = 0;

    function inPausa() {
        return motivi.size > 0;
    }

    function avvisa() {
        const stato = inPausa();
        ascoltatori.forEach((fn) => {
            try { fn(stato, Array.from(motivi)); } catch (e) { console.error('Pausa duello:', e); }
        });
    }

    function esegui(token) {
        if (!token || token.annullato || token.eseguito) return;
        if (inPausa()) {
            scaduti.add(token);
            return;
        }
        token.eseguito = true;
        scaduti.delete(token);
        token.fn();
    }

    function sospendi(motivo) {
        const prima = inPausa();
        motivi.add(motivo || 'pausa');
        if (!prima) avvisa();
    }

    function riprendi(motivo) {
        if (motivo) motivi.delete(motivo);
        else motivi.clear();
        if (inPausa()) return;
        avvisa();
        // I callback vengono rimessi nella coda dei task, non eseguiti dentro
        // il click del pulsante: il velo puo' sparire e il browser puo'
        // ridisegnare prima che riparta l'IA.
        Array.from(scaduti).forEach((token) => setTimeout(() => esegui(token), 0));
    }

    function dopo(fn, ms) {
        const token = {
            __pausaDuelloTimer: true,
            id: ++progressivo,
            timer: null,
            fn: fn,
            annullato: false,
            eseguito: false
        };
        token.timer = setTimeout(() => {
            token.timer = null;
            esegui(token);
        }, Math.max(0, Number(ms) || 0));
        return token;
    }

    function annulla(token) {
        if (!token || !token.__pausaDuelloTimer) {
            clearTimeout(token);
            return;
        }
        token.annullato = true;
        if (token.timer !== null) clearTimeout(token.timer);
        scaduti.delete(token);
    }

    function ascolta(fn) {
        ascoltatori.add(fn);
        return () => ascoltatori.delete(fn);
    }

    return { sospendi, riprendi, inPausa, dopo, annulla, ascolta };
})();

/** @type {any} */ (globalThis).PausaDuello = PausaDuello;
