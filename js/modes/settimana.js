/**
 * settimana.js — La logica del Duello della Settimana, condivisa da settimana.html
 * (che mostra regola, avversario e premi) e dal duello (js/modes/settimana-mode.js).
 * =====================================================================
 * Un posto solo per le regole, perché due pagine diverse le usano: due copie
 * della stessa regola andrebbero alla deriva alla prima modifica.
 *
 * COSA VALE QUESTA SETTIMANA lo decide il numero della settimana (lunedì UTC,
 * ora del SERVER via ServerDate quando c'è): tutti vedono la stessa regola e lo
 * stesso avversario, e cambiano nello stesso istante.
 *
 * COME SI APPLICA LA REGOLA senza toccare il motore: prima della prima pescata
 * i mostri del mazzo che non la rispettano vengono tolti e rimpiazzati da mostri
 * validi (`conformaMazzo`). Il mazzo resta di quante carte era, Magie e Trappole
 * non si toccano, e il duello è un duello normale.
 *
 * Stato salvato (SaveManager.getModeState('settimana')):
 *   { chiave: '<numero settimana>', vinte: { Facile?: true, Medio?: true, Difficile?: true } }
 * Se la chiave non è quella di questa settimana le vittorie sono di una
 * settimana passata e non contano: ogni lunedì si riparte.
 */
const Settimana = (function () {
    'use strict';

    const MS_SETTIMANA = 7 * 24 * 60 * 60 * 1000;
    /** Lunedì 5 gennaio 1970, 00:00 UTC: il primo lunedì dell'epoca. */
    const PRIMO_LUNEDI = Date.UTC(1970, 0, 5);
    /** Il numero massimo di copie della stessa carta in un mazzo. */
    const MAX_COPIE = 3;

    const db = () => window.settimanaDatabase || settimanaDatabase;

    /** Millisecondi "adesso": quelli del server se la sincronizzazione è riuscita. */
    function adesso() {
        return window.ServerDate ? ServerDate.now().getTime() : Date.now();
    }

    /** Il numero della settimana (cresce di 1 ogni lunedì UTC). */
    function indiceSettimana() {
        return Math.floor((adesso() - PRIMO_LUNEDI) / MS_SETTIMANA);
    }

    /** Millisecondi al prossimo cambio di regola. */
    function msAlProssimo() {
        const prossimo = PRIMO_LUNEDI + (indiceSettimana() + 1) * MS_SETTIMANA;
        return Math.max(0, prossimo - adesso());
    }

    function chiave() {
        return String(indiceSettimana());
    }

    /** La regola in vigore questa settimana. */
    function regola() {
        const r = db().regole;
        return r[indiceSettimana() % r.length];
    }

    /** L'id dell'avversario di questa settimana (passo 3: due settimane vicine non ripetono la stessa coppia regola/avversario). */
    function avversario() {
        const a = db().avversari;
        return a[(indiceSettimana() * 3 + 1) % a.length];
    }

    /** @returns {{ chiave: string, vinte: Object<string, boolean> }} */
    function stato() {
        const s = window.SaveManager ? SaveManager.getModeState('settimana') : null;
        if (!s || s.chiave !== chiave()) return { chiave: chiave(), vinte: {} };
        return { chiave: s.chiave, vinte: Object.assign({}, s.vinte || {}) };
    }

    /**
     * Segna la vittoria a un livello. Torna { primaVolta, premio } dove premio è
     * { crediti, stelle } SOLO la prima volta di questa settimana a quel livello.
     */
    function registraVittoria(livello) {
        const s = stato();
        const primaVolta = !s.vinte[livello];
        s.vinte[livello] = true;
        if (window.SaveManager) SaveManager.setModeState('settimana', s);
        return { primaVolta: primaVolta, premio: primaVolta ? (db().premi[livello] || null) : null };
    }

    // ----- La regola applicata a una carta e a un mazzo -----

    /** Vero se `carta` (un mostro) rispetta la regola. */
    function ammette(r, carta) {
        const f = r.filtro;
        if (f.tipo === 'attributo') return carta.attribute === f.valore;
        if (f.tipo === 'razza') return carta.race === f.valore;
        if (f.tipo === 'livelloMax') return (carta.level || 0) <= f.valore;
        return true;
    }

    /** Una carta che si può mettere nel mazzo come rimpiazzo: mostro normale, non divino, non della Grande Guerra. */
    function rimpiazzabile(c) {
        if (c.type !== 'monster' || c.extraDeck) return false;
        if (c.origin === 'ww1' || c.attribute === 'DIVINO') return false;
        // EXODIA_PIECE_IDS e' un `const` di game-flow.js: non e' una proprieta' di window.
        if (typeof EXODIA_PIECE_IDS !== 'undefined' && EXODIA_PIECE_IDS.indexOf(c.id) !== -1) return false;
        return true;
    }

    /** Quanto un candidato è lontano dalla carta da sostituire: prima il Livello, poi l'ATK. */
    function distanza(da, candidata) {
        return Math.abs((da.level || 0) - (candidata.level || 0)) * 600 + Math.abs((da.attack || 0) - (candidata.attack || 0));
    }

    /**
     * Adatta un mazzo alla regola. I mostri non ammessi sono tolti e rimpiazzati
     * da mostri ammessi di Livello e ATK simili (al massimo MAX_COPIE per carta);
     * le altre carte restano dove sono. Torna { mazzo, sostituite }.
     *
     * @param {any[]} mazzo le carte (con uid), com'è uscito da buildDeckFromSpec
     * @param {any} r la regola
     * @param {{ catalogo: any[], copieMassime?: (carta: any) => number }} opzioni
     *   `catalogo`: le carte tra cui scegliere i rimpiazzi; `copieMassime`: quante copie di una carta si
     *   possono usare (per chi ha una collezione: non più di quelle possedute).
     */
    function conformaMazzo(mazzo, r, opzioni) {
        const catalogo = opzioni.catalogo.filter((c) => rimpiazzabile(c) && ammette(r, c));
        const copie = new Map();
        const tenute = [];
        const daSostituire = [];
        mazzo.forEach((c) => {
            if (c.type === 'monster' && !ammette(r, c)) { daSostituire.push(c); return; }
            tenute.push(c);
            copie.set(c.id, (copie.get(c.id) || 0) + 1);
        });
        let progressivo = 0;
        daSostituire.forEach((vecchia) => {
            const scelta = catalogo
                .map((c) => ({ c: c, d: distanza(vecchia, c) }))
                .sort((a, b) => a.d - b.d)
                .find((x) => (copie.get(x.c.id) || 0) < Math.min(MAX_COPIE, opzioni.copieMassime ? opzioni.copieMassime(x.c) : MAX_COPIE));
            if (!scelta) { tenute.push(vecchia); return; } // nessun rimpiazzo possibile: meglio una carta in più che un mazzo più corto
            copie.set(scelta.c.id, (copie.get(scelta.c.id) || 0) + 1);
            progressivo++;
            tenute.push(Object.assign({}, scelta.c, { uid: 'sett_' + Date.now() + '_' + progressivo + '_' + scelta.c.id }));
        });
        // Rimescolamento: i rimpiazzi non devono restare tutti in fondo.
        const rnd = (typeof casualeDiGioco === 'function') ? casualeDiGioco : Math.random;
        for (let i = tenute.length - 1; i > 0; i--) {
            const j = Math.floor(rnd() * (i + 1));
            [tenute[i], tenute[j]] = [tenute[j], tenute[i]];
        }
        return { mazzo: tenute, sostituite: daSostituire.length };
    }

    /** L'Extra Deck: si tengono solo i mostri che rispettano la regola (non si rimpiazza nulla). */
    function conformaExtra(extra, r) {
        return (extra || []).filter((c) => ammette(r, c));
    }

    return {
        indiceSettimana: indiceSettimana,
        msAlProssimo: msAlProssimo,
        chiave: chiave,
        regola: regola,
        avversario: avversario,
        stato: stato,
        registraVittoria: registraVittoria,
        ammette: ammette,
        conformaMazzo: conformaMazzo,
        conformaExtra: conformaExtra
    };
})();
