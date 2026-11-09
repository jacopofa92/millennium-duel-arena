/**
 * stats-duello.js — i numeri del duello APPENA GIOCATO, per la schermata di Vittoria/Sconfitta.
 * ============================================================================================
 * Solo conteggio, nessuna regola: il motore chiama `StatsDuello.registra(...)` negli stessi punti dove avvisa le Sfide
 * (Evocazione di un mostro, attivazione di una carta) e il danno arriva dall'evento `danno-subito`. Ogni duello e' una pagina
 * nuova, quindi i contatori partono da zero da soli; `azzera()` serve ai test e a una partita ricominciata nella stessa pagina.
 * Conta SOLO cio' che fa il giocatore (posto 'player': nel Tag Team e' la squadra); il danno distingue chi lo infligge.
 *
 * Tipi di `registra`:
 *  - 'mostro'  (Evocazione Normale o Speciale di un mostro del giocatore, mai un Token)
 *  - 'magia' / 'trappola'  (attivazione andata a buon fine)
 *  - 'tributo' (un'Evocazione/Set con Tributo pagato)
 */
(function () {
    'use strict';

    const vuoto = () => ({ mostri: 0, magie: 0, trappole: 0, tributi: 0, dannoMax: 0, dannoInflitto: 0, dannoSubito: 0 });
    let dati = vuoto();

    const StatsDuello = {
        azzera() { dati = vuoto(); },
        /** @param {'mostro'|'magia'|'trappola'|'tributo'} tipo */
        registra(tipo) {
            if (tipo === 'mostro') dati.mostri++;
            else if (tipo === 'magia') dati.magie++;
            else if (tipo === 'trappola') dati.trappole++;
            else if (tipo === 'tributo') dati.tributi++;
        },
        /** Danno SUBITO da `owner` ('player' = tu, 'bot' = l'avversario): quello subito dall'avversario e' il tuo danno inflitto. */
        danno(owner, quanto) {
            const n = Number(quanto) || 0;
            if (n <= 0) return;
            if (owner === 'bot') { dati.dannoInflitto += n; dati.dannoMax = Math.max(dati.dannoMax, n); }
            else dati.dannoSubito += n;
        },
        /** Fotografia da mostrare a fine duello. `turni`, `lpFinali` li sa il chiamante (gameState). */
        riepilogo() { return Object.assign({}, dati); },
        /**
         * Confronta questo duello con i RECORD PERSONALI (salvati in save.modalita.recordDuello, quindi viaggiano col cloud)
         * e li aggiorna. Torna quali sono nuovi: { dannoMax, dannoInflitto, turniVittoria } (true = battuto un record
         * precedente; il PRIMO valore mai registrato non e' un "nuovo record", altrimenti ogni primo duello li festeggerebbe
         * tutti). I turni contano solo in vittoria e il record e' il numero PIU' BASSO. Mai per Demo/Sandbox/Tutorial/Puzzle.
         * @param {string} modalita  @param {boolean} vinto  @param {number} turni
         */
        record(modalita, vinto, turni) {
            const nuovi = { dannoMax: false, dannoInflitto: false, turniVittoria: false };
            if (['demo', 'sandbox', 'tutorial', 'puzzle'].indexOf(modalita) !== -1) return nuovi;
            if (!window.SaveManager || !SaveManager.getModeState) return nuovi;
            const r = Object.assign({ dannoMax: 0, dannoInflitto: 0, turniVittoria: 0 }, SaveManager.getModeState('recordDuello') || {});
            if (dati.dannoMax > r.dannoMax) { nuovi.dannoMax = r.dannoMax > 0; r.dannoMax = dati.dannoMax; }
            if (dati.dannoInflitto > r.dannoInflitto) { nuovi.dannoInflitto = r.dannoInflitto > 0; r.dannoInflitto = dati.dannoInflitto; }
            if (vinto && turni > 0 && (r.turniVittoria === 0 || turni < r.turniVittoria)) { nuovi.turniVittoria = r.turniVittoria > 0; r.turniVittoria = turni; }
            SaveManager.setModeState('recordDuello', r);
            return nuovi;
        }
    };
    window.StatsDuello = StatsDuello;

    if (window.EventiDuello) {
        EventiDuello.ascolta('danno-subito', (owner, amount) => StatsDuello.danno(owner, amount));
        EventiDuello.ascolta('partita-azzerata', () => StatsDuello.azzera());
    }
})();
