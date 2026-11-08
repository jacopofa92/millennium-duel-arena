/**
 * statistiche.js — il CONTATORE dei duelli per modalità (e le serie), per il Profilo.
 * ------------------------------------------------------------------------------------------
 * Il Profilo (js/ui/profile-stats.js) mostra le statistiche di OGNI modalità e quelle generali. Molte modalità hanno già un proprio stato
 * (Torre, Puzzle, Rivincite, Caccia, Settimana, Tornei, Storia...) e il Profilo lo legge da lì; quello che mancava era un conto UNIFORME dei duelli
 * giocati/vinti/persi/pareggiati per modalità, più la serie di vittorie e i turni giocati. Lo scrive `DuelSession.finish` (fuori dal motore),
 * una volta per duello, e vive in `save.modalita.statistiche` (quindi viaggia col salvataggio sul cloud):
 *
 *   { dal: 'AAAA-MM-GG' (da quando si conta), turni: totale dei tuoi turni,
 *     serieAttuale, serieMigliore,
 *     modalita: { libero|storia|tornei|tag|online|torre|rivincita|settimana|caccia: { giocati, vinti, persi, pareggi } } }
 *
 * I conti per modalità partono dal giorno in cui questo file è arrivato: per i duelli di prima esistono solo i totali per Duellante
 * (`save.records`), che il Profilo continua a usare per i totali generali. Il Profilo lo dice, invece di far finta.
 * Un abbandono conta come sconfitta (come per `records`); il Demo, la Sandbox, il Tutorial e i Puzzle non sono partite e non si contano.
 */
(function () {
    'use strict';

    const CHIAVE = 'statistiche';

    /** Le modalità contate: id (il parametro `mode` del duello, tradotto), nome, icona del tema. L'ordine è quello del Profilo. */
    const MODALITA = [
        { id: 'libero', nome: 'Duello Libero', icona: 'freeDuel', mode: ['free'] },
        { id: 'storia', nome: 'Storia', icona: 'story', mode: ['story'] },
        { id: 'tornei', nome: 'Tornei', icona: 'tournament', mode: ['tournament'] },
        { id: 'torre', nome: 'Torre dei Duellanti', icona: 'tower', mode: ['torre'] },
        { id: 'rivincita', nome: 'Rivincite', icona: 'rematch', mode: ['rivincita'] },
        { id: 'settimana', nome: 'Duello della Settimana', icona: 'calendar', mode: ['settimana'] },
        { id: 'caccia', nome: 'Caccia al Boss', icona: 'target', mode: ['caccia'] },
        { id: 'tag', nome: 'Tag Team', icona: 'multiplayer', mode: ['tag'] },
        { id: 'online', nome: 'Battaglie online', icona: 'multiplayer', mode: ['multiplayer'] }
    ];

    /** L'id della modalità per il parametro `mode` del duello, o null se quel duello non si conta. */
    function modalitaDi(mode) {
        const m = MODALITA.find((x) => x.mode.indexOf(mode) !== -1);
        return m ? m.id : null;
    }

    function leggi() {
        const s = (window.SaveManager && SaveManager.getModeState) ? SaveManager.getModeState(CHIAVE) : null;
        return {
            dal: (s && s.dal) || '',
            turni: Number(s && s.turni) || 0,
            serieAttuale: Number(s && s.serieAttuale) || 0,
            serieMigliore: Number(s && s.serieMigliore) || 0,
            modalita: Object.assign({}, (s && s.modalita) || {})
        };
    }

    /** Conto di una modalità: { giocati, vinti, persi, pareggi } (zeri se non c'è). */
    function di(id) {
        const m = leggi().modalita[id] || {};
        return { giocati: m.giocati || 0, vinti: m.vinti || 0, persi: m.persi || 0, pareggi: m.pareggi || 0 };
    }

    /**
     * Registra un duello finito. `esito`: 'vinto' | 'perso' | 'pareggio'. `turni`: i turni giocati DAL GIOCATORE (facoltativo).
     * Torna true se è stato contato (la modalità conta e c'è un salvataggio).
     */
    function registraDuello(mode, esito, turni) {
        const id = modalitaDi(mode);
        if (!id || !window.SaveManager || !SaveManager.setModeState) return false;
        const s = leggi();
        const c = Object.assign({ giocati: 0, vinti: 0, persi: 0, pareggi: 0 }, s.modalita[id] || {});
        c.giocati++;
        if (esito === 'vinto') c.vinti++;
        else if (esito === 'pareggio') c.pareggi++;
        else c.persi++;
        s.modalita[id] = c;
        // La serie conta solo le vittorie di fila: un pareggio non la spezza ne' la allunga, una sconfitta la azzera.
        if (esito === 'vinto') { s.serieAttuale++; if (s.serieAttuale > s.serieMigliore) s.serieMigliore = s.serieAttuale; }
        else if (esito === 'perso') s.serieAttuale = 0;
        s.turni += Math.max(0, Math.floor(Number(turni) || 0));
        if (!s.dal) s.dal = (window.ServerDate && ServerDate.dayKey) ? ServerDate.dayKey() : new Date().toISOString().slice(0, 10);
        SaveManager.setModeState(CHIAVE, s);
        return true;
    }

    window.Statistiche = { MODALITA, modalitaDi, leggi, di, registraDuello };
})();
