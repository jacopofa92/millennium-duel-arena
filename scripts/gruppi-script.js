/**
 * gruppi-script.js — l'UNICA lista dei gruppi di <script> che più pagine
 * caricano insieme.
 * =====================================================================
 * Le pagine di questo progetto non hanno bundler: ogni pagina ripete a
 * mano i propri <script src>. Un caricatore a runtime è stato scartato
 * (vedi tests/specs/guardrail-script-delle-pagine.spec.js): gli script
 * iniettati partirebbero DOPO gli <script> inline che li usano subito.
 * Restano quindi tag statici, ma generati: si modifica un gruppo QUI,
 * poi `node scripts/sync-script-groups.js` lo riscrive in ogni pagina fra
 * i due marcatori
 *
 *     <!-- gruppo-script:NOME -->  ...  <!-- /gruppo-script:NOME -->
 *
 * o, dentro un array JavaScript (la vista Cartoteca di index.html, che lo
 * carica a richiesta, e APP_SHELL di sw.js),
 *
 *     // gruppo-script:NOME  ...  // /gruppo-script:NOME
 *
 * Un controllo (pre-commit e tests/specs/guardrail-gruppi-script.spec.js)
 * ferma un commit in cui una pagina non è allineata a questa lista.
 *
 * L'ORDINE conta: è quello in cui i file vengono caricati.
 */
'use strict';

module.exports = {
    // Il motore del duello e gli effetti delle carte. card-effects.js
    // (helper condivisi) va prima delle sue 8 parti, duel-engine.js prima
    // di tutto il resto. Un file nuovo del nucleo si aggiunge qui.
    motore: [
        // La casualità di gioco (seme condiviso in Multiplayer a passo comune).
        'js/engine/casuale.js',
        // L'unico punto da cui le regole toccano la pagina.
        'js/engine/porta-ui.js',
        // Il canale con cui le regole avvisano l'interfaccia: prima di
        // chiunque emetta o ascolti.
        'js/engine/eventi-duello.js',
        // I numeri del duello per la schermata di fine (ascolta eventi-duello).
        'js/stats/stats-duello.js',
        // I due posti al tavolo e chi li controlla (persona, IA, remoto).
        'js/engine/tavolo.js',
        'js/engine/duel-engine.js',
        // Ogni scelta del duello (chi risponde: avversario remoto, persona
        // davanti allo schermo o scelta automatica). Prima delle carte.
        'js/engine/decisioni.js',
        'js/engine/effect-templates.js',
        'js/engine/card-effects.js',
        'js/engine/card-effects-1.js',
        'js/engine/card-effects-2.js',
        'js/engine/card-effects-3.js',
        'js/engine/card-effects-4.js',
        'js/engine/card-effects-5.js',
        'js/engine/card-effects-6.js',
        'js/engine/card-effects-7.js',
        'js/engine/card-effects-8.js'
    ],

    // La partita vera e propria: stato, regole del turno, disegno del campo
    // e azioni del giocatore. Solo duelMonstersCore.html (e, attraverso
    // lei, la pagina del Multiplayer, che ne esegue gli script) più
    // l'elenco offline di sw.js.
    // ORDINE: duel-sandbox.js e stato.js/fasi.js PRIMA di game-flow.js,
    // perché il fondo di game-flow.js avvia il duello in modo sincrono
    // appena il file è letto (DuelSession.start -> initGame ->
    // resetGameState, in fasi.js).
    partita: [
        'js/engine/duel-sandbox.js',
        'js/engine/stato.js',
        // Congela timer e IA nei duelli offline quando l'app va in background.
        'js/engine/pausa-duello.js',
        // addToLog/updateUI/clearSelection/isBlockingModalOpen/endDuel:
        // la parte di regola, prima di game-flow.js che le usa al boot.
        'js/engine/canale-partita.js',
        // Le mosse dei giocatori come comandi (un esecutore per mossa, col
        // posto come parametro): base del Multiplayer a passo comune.
        'js/engine/comandi.js',
        // Il Multiplayer a passo comune: i comandi e le decisioni che
        // viaggiano fra i due client. Spento finché nessuno lo avvia.
        'js/engine/passo-comune.js',
        'js/engine/fasi.js',
        'js/engine/battaglia.js',
        'js/engine/evocazioni.js',
        'js/engine/game-flow.js',
        'js/engine/actions.js'
    ]
};
