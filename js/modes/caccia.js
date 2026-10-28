/**
 * caccia.js — La logica della Caccia al Boss, condivisa da caccia-boss.html
 * (che mostra il Boss e i premi) e dal duello (js/modes/caccia-mode.js).
 * =====================================================================
 * Il Boss della settimana lo decide il numero della settimana (lunedì UTC, ora
 * del SERVER quando c'è): tutti cacciano lo stesso Boss e cambia per tutti nello
 * stesso istante. Lo stato salvato (SaveManager.getModeState('caccia')):
 *   { chiave, tentativi, vinta, migliorTurni }
 * Se la chiave non è quella di questa settimana i dati sono della settimana
 * scorsa e si riparte da zero.
 */
const Caccia = (function () {
    'use strict';

    const MS_SETTIMANA = 7 * 24 * 60 * 60 * 1000;
    const PRIMO_LUNEDI = Date.UTC(1970, 0, 5);
    const db = () => window.cacciaDatabase || cacciaDatabase;

    function adesso() {
        return window.ServerDate ? ServerDate.now().getTime() : Date.now();
    }
    function indiceSettimana() {
        return Math.floor((adesso() - PRIMO_LUNEDI) / MS_SETTIMANA);
    }
    function msAlProssimo() {
        return Math.max(0, PRIMO_LUNEDI + (indiceSettimana() + 1) * MS_SETTIMANA - adesso());
    }
    const chiave = () => String(indiceSettimana());

    /** Il Boss di questa settimana: { id, titolo }. */
    function boss() {
        const b = db().boss;
        return b[indiceSettimana() % b.length];
    }

    function stato() {
        const s = window.SaveManager ? SaveManager.getModeState('caccia') : null;
        if (!s || s.chiave !== chiave()) return { chiave: chiave(), tentativi: 0, vinta: false, migliorTurni: null };
        return { chiave: s.chiave, tentativi: s.tentativi || 0, vinta: !!s.vinta, migliorTurni: s.migliorTurni == null ? null : s.migliorTurni };
    }

    function salva(s) {
        if (window.SaveManager) SaveManager.setModeState('caccia', s);
    }

    /** Si è iniziata una caccia (conta i tentativi della settimana). */
    function registraTentativo() {
        const s = stato();
        s.tentativi++;
        salva(s);
    }

    /**
     * Fine di una caccia VINTA in `turni` turni del giocatore. Torna { primaVolta, premio } dove premio è
     * { crediti, stelle, veloce } SOLO per la prima vittoria della settimana.
     */
    function registraVittoria(turni) {
        const s = stato();
        const primaVolta = !s.vinta;
        s.vinta = true;
        s.migliorTurni = s.migliorTurni == null ? turni : Math.min(s.migliorTurni, turni);
        salva(s);
        if (!primaVolta) return { primaVolta: false, premio: null };
        const p = db().premio;
        const veloce = turni <= p.bonusVeloce.entroTurni;
        return { primaVolta: true, premio: { crediti: p.crediti, stelle: p.stelle + (veloce ? p.bonusVeloce.stelle : 0), veloce: veloce } };
    }

    return {
        indiceSettimana: indiceSettimana,
        msAlProssimo: msAlProssimo,
        chiave: chiave,
        boss: boss,
        stato: stato,
        registraTentativo: registraTentativo,
        registraVittoria: registraVittoria
    };
})();
