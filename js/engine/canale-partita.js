// @ts-check
/**
 * canale-partita.js — le cinque funzioni con cui le regole avvisano
 * l'interfaccia, chiamate da centinaia di punti.
 * =====================================================================
 * Nucleo senza testa (piano di attacco, Priorità 2). addToLog, updateUI,
 * clearSelection, isBlockingModalOpen ed endDuel stavano in game-flow.js e
 * actions.js, e mescolavano due cose: un pezzo di REGOLA (ricalcolare gli
 * effetti continui, controllare se il duello è finito, azzerare la
 * selezione, segnare la fine del duello) e un pezzo di DISEGNO.
 *
 * Qui resta la regola, col nome di sempre, così nessuno dei circa 300
 * punti che le chiamano (motore, carte, IA, interfaccia) ha dovuto
 * cambiare. Il disegno è passato agli ascoltatori del canale degli eventi
 * (js/engine/eventi-duello.js), registrati in cima a game-flow.js e
 * actions.js. Senza pagina — nel duello senza testa — nessuno ascolta, e
 * resta solo la regola.
 *
 * Script classico, gruppo "partita" (scripts/gruppi-script.js): le
 * funzioni restano globali come prima.
 */

/** Una riga del registro del duello (il pannello del log a schermo). */
function addToLog(message) {
    EventiDuello.emetti('registro', message);
}

// ATTENZIONE: non è solo disegno. recomputeStaticEffects (in testa) e
// checkGameOver (in fondo) sono REGOLE, e il motore conta su updateUI per
// tenerle aggiornate dopo ogni mossa: senza, gli effetti continui (chi è
// non bersagliabile, i bonus ATK/DEF...) resterebbero quelli vecchi. In
// mezzo l'avviso 'ridisegna' (ridisegnaDuello in game-flow.js): lo stesso
// ordine di quando le tre cose stavano in una funzione sola, che conta —
// una vittoria istantanea cerca a schermo le carte coinvolte, quindi il
// campo deve essere già ridisegnato quando checkGameOver la scopre.
function updateUI() {
    if (gameState.gameOver) return;
    // Ricalcola gli effetti continui (es. Jinzo nega le Trappole, Spada
    // Rivelatrice blocca gli attacchi) PRIMA di disegnare qualunque cosa,
    // così il render riflette sempre lo stato corrente del campo — vedi
    // js/engine/duel-engine.js.
    if (window.DuelEngine) DuelEngine.recomputeStaticEffects();
    EventiDuello.emetti('ridisegna');
    checkGameOver();
}

/**
 * Azzera la carta selezionata e le selezioni in corso (Tributi, casella
 * dopo un Sacrificio), chiude prompt ed evidenziazioni a schermo
 * ('selezione-azzerata', chiudiSelezioneASchermo in actions.js) e
 * ridisegna.
 */
function clearSelection() {
    gameState.selectedCard = { type: null, card: null, index: -1 };
    gameState.pendingTributeSummon = null;
    gameState.pendingTributePlacement = null;
    EventiDuello.emetti('selezione-azzerata');
    updateUI();
}

/**
 * Vero SOLO mentre una scelta bloccante aspetta un click umano: le due
 * selezioni "clicca sul campo/sulla mano" (gameState.pendingTributeSummon/
 * pendingHandDiscard, che non sono un elemento DOM ma bloccano comunque
 * ogni altro click) e — chiesto all'interfaccia ('interfaccia-occupata',
 * interfacciaOccupata in game-flow.js) — un modale o un popover aperto, o
 * una cinematica di Evocazione lunga. Bug reale segnalato dall'utente
 * ("se modale selezione aperto di qualche tipo, il gioco deve aspettare la
 * chiusura del modale"): senza un unico punto che sappia rispondere "è
 * aperto qualcosa?", ogni nuovo tipo di scelta rischiava di dimenticare la
 * propria verifica in un punto e non nell'altro — usare SEMPRE questa
 * funzione per un futuro controllo simile, invece di ripetere la lista a
 * mano.
 */
function isBlockingModalOpen() {
    if (typeof PausaDuello !== 'undefined' && PausaDuello.inPausa()) return true;
    if (gameState.pendingTributeSummon) return true;
    if (gameState.pendingHandDiscard) return true;
    // A passo comune, anche una scelta aperta sull'altro client (o una mia
    // appena presa, che sta per applicarsi): vedi PassoComune.inPausa.
    if (typeof PassoComune !== 'undefined' && PassoComune.inPausa()) return true;
    return EventiDuello.chiedi('interfaccia-occupata', false) === true;
}

/**
 * Chiude il duello. `playerWon`: true, false o 'draw' (Pareggio, es.
 * Ultimo Turno id 341). `opzioni.abbandono`: il giocatore si è ritirato
 * (cambia solo i premi, vedi chiudiDuelloASchermo in game-flow.js).
 *
 * Prima l'avviso, poi la regola: chi ascolta (chiudiDuelloASchermo) deve
 * ancora vedere gameState.gameOver com'era, perché in Multiplayer comunica
 * l'esito all'avversario solo se il duello non era già finito. Poi il
 * duello è finito anche senza nessuno ad ascoltare: nessuna fase avanza
 * più.
 */
function endDuel(playerWon, opzioni) {
    EventiDuello.emetti('fine-duello', playerWon, opzioni);
    gameState.gameOver = true;
    clearPhaseTransitionTimeout();
}
