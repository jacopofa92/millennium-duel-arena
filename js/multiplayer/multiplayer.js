// @ts-check
/**
 * multiplayer.js — stato della connessione DURANTE un duello.
 * =====================================================================
 * Le mosse non passano più da qui: `mp-passo-comune.js` trasporta comandi
 * e decisioni numerati, mentre `passo-comune.js` li esegue nello stesso
 * ordine sui due motori. Questo file conserva soltanto ciò che non è una
 * regola di gioco:
 *  - banner di disconnessione/rientro;
 *  - vittoria a tavolino quando l'avversario lascia definitivamente;
 *  - `game-over` come rete di sicurezza sull'esito finale.
 *
 * Il nome del file resta invariato per non cambiare il caricamento dinamico
 * della lobby e la lista dell'app shell soltanto per un rinominare cosmetico.
 */
(function () {
    'use strict';

    const net = window.DuelNetwork;
    if (!net) return;

    /**
     * Un solo banner, riusato per gli stati transitori e definitivi della
     * connessione. I messaggi sono interni, ma si costruisce comunque il DOM
     * senza innerHTML perché questo componente non deve diventare un varco
     * se in futuro il relay aggiunge un dettaglio testuale.
     */
    function showMpBanner(message, { permanent = false } = {}) {
        let banner = document.getElementById('mpConnectionBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'mpConnectionBanner';
            banner.className = 'mp-opponent-left-banner';
            document.body.appendChild(banner);
        }
        banner.replaceChildren();
        const testo = document.createElement('span');
        testo.textContent = message;
        banner.appendChild(testo);
        if (permanent) {
            const torna = document.createElement('a');
            torna.href = 'index.html';
            torna.textContent = 'Torna al Menu';
            banner.appendChild(torna);
        }
    }

    function hideMpBanner() {
        const banner = document.getElementById('mpConnectionBanner');
        if (banner) banner.remove();
    }

    /** Applica l'esito già espresso dal punto di vista di chi riceve. */
    function applyRemoteGameOver(opponentWon) {
        if (typeof gameState === 'undefined' || gameState.gameOver) return;
        // Flag dedicato soltanto a evitare che chiudiDuelloASchermo rimandi
        // indietro lo stesso esito. Non protegge mosse: quelle viaggiano nel
        // passo comune e non vengono mai applicate da questo file.
        window.MP_ricezioneEsito = true;
        try {
            if (typeof endDuel === 'function') endDuel(opponentWon);
        } finally {
            window.MP_ricezioneEsito = false;
        }
    }

    // TAG TEAM IN RETE (window.MP_POSTI, la disposizione dei posti scritta da
    // js/multiplayer/mp-passo-comune.js): più di un altro client, ognuno con
    // la sua squadra. Messaggi e uscite dicono CHI (`da`, id pubblico).
    /** @returns {any} */
    function posti() { return /** @type {any} */ (window).MP_POSTI || null; }

    /** La squadra di un client ('A'/'B'), o null. @param {string} client */
    function squadraDelClient(client) {
        const cfg = posti();
        if (!cfg) return null;
        const k = Object.keys(cfg.posti).find((p) => cfg.posti[p] && cfg.posti[p].tipo === 'persona' && cfg.posti[p].client === client);
        return k ? k.charAt(0) : null;
    }

    /**
     * Una persona lascia il Tag Team in rete: il duello non può proseguire
     * (il suo posto non avrebbe più chi lo gioca, e farlo passare a un'IA
     * dovrebbe succedere nello stesso punto della partita su tutti i client).
     * Vince la squadra di chi è rimasto: se a uscire è un compagno, la tua
     * squadra perde. Tutti i client ricevono la stessa uscita e decidono
     * la stessa cosa.
     * @param {string} chi
     */
    function uscitaInTag(chi) {
        const cfg = posti();
        const sua = squadraDelClient(chi);
        const arenaPronta = typeof gameState !== 'undefined' && !!gameState;
        if (!sua || (arenaPronta && gameState.gameOver)) return;
        const compagno = sua === cfg.miaSquadra;
        const testo = compagno ? '🏳️ Il tuo compagno ha lasciato la partita: la tua squadra perde.' : '🏳️ Un avversario ha lasciato la partita: vince la tua squadra.';
        if (typeof addToLog === 'function') addToLog(testo);
        if (arenaPronta && typeof endDuel === 'function') {
            showMpBanner(testo);
            window.MP_ricezioneEsito = true;
            try { endDuel(!compagno); } finally { window.MP_ricezioneEsito = false; }
            return;
        }
        showMpBanner(testo, { permanent: true });
    }

    // Uscita definitiva: chi resta vince. Una caduta momentanea usa invece
    // opponent-disconnected e lascia al relay la finestra di riconnessione.
    net.on('opponent-left', (msg) => {
        if (!window.MULTIPLAYER_MODE) return;
        if (posti()) { uscitaInTag(msg && msg.da); return; }
        if (typeof addToLog === 'function') addToLog('⚠️ Il tuo avversario ha lasciato la partita.');
        const arenaPronta = typeof gameState !== 'undefined' && !!gameState;
        if (arenaPronta && gameState.gameOver) return;
        if (arenaPronta && typeof endDuel === 'function') {
            showMpBanner('🏳️ Il tuo avversario ha lasciato la partita: vinci tu.');
            endDuel(true);
            return;
        }
        showMpBanner('⚠️ Il tuo avversario ha lasciato la partita.', { permanent: true });
    });

    /** "Il tuo avversario", oppure nel Tag Team in rete "Il tuo compagno"/"Un avversario". @param {any} msg */
    function chiE(msg) {
        if (!posti()) return 'Il tuo avversario';
        const sua = squadraDelClient(msg && msg.da);
        return sua && sua === posti().miaSquadra ? 'Il tuo compagno' : 'Un avversario';
    }

    net.on('opponent-disconnected', (msg) => {
        if (!window.MULTIPLAYER_MODE) return;
        const chi = chiE(msg);
        if (typeof addToLog === 'function') addToLog(`🔌 ${chi} ha perso la connessione, in attesa che torni...`);
        showMpBanner(`🔌 ${chi} ha perso la connessione, in attesa che torni...`);
    });

    net.on('opponent-reconnected', (msg) => {
        if (!window.MULTIPLAYER_MODE) return;
        const chi = chiE(msg);
        if (typeof addToLog === 'function') addToLog(`✅ ${chi} è tornato in partita!`);
        showMpBanner(`✅ ${chi} è tornato in partita!`);
        setTimeout(hideMpBanner, 3000);
    });

    net.on('reconnecting', (attempt) => {
        if (!window.MULTIPLAYER_MODE) return;
        if (typeof addToLog === 'function') addToLog(`🔌 Connessione persa, tentativo di riconnessione (${attempt})...`);
        showMpBanner(`🔌 Connessione persa, tentativo di riconnessione (${attempt})...`);
    });

    net.on('reconnected', () => {
        if (!window.MULTIPLAYER_MODE) return;
        if (typeof addToLog === 'function') addToLog('✅ Riconnesso! Recupero le mosse mancanti...');
        showMpBanner('✅ Riconnesso! Recupero le mosse mancanti...');
        setTimeout(hideMpBanner, 3000);
        // MpPassoComune ascolta lo stesso evento e richiede i messaggi
        // numerati mancanti. Nessuna fotografia sovrascrive il motore.
    });

    net.on('reconnect-failed', () => {
        if (!window.MULTIPLAYER_MODE) return;
        if (typeof addToLog === 'function') addToLog('❌ Impossibile riconnettersi al server.');
        showMpBanner('❌ Impossibile riconnettersi al server.', { permanent: true });
    });

    net.on('disconnected', () => {
        if (window.MULTIPLAYER_MODE && typeof addToLog === 'function') {
            addToLog('⚠️ Connessione al server persa.');
        }
    });

    net.on('game-action', (msg) => {
        const action = msg && msg.action;
        if (!action || action.kind !== 'game-over') return;
        // A posti l'esito dice QUALE squadra vince: lo stesso messaggio vale per compagni e avversari di chi lo manda.
        const cfg = posti();
        if (cfg && action.vinceSquadra) {
            // applyRemoteGameOver vuole "ho vinto io" (endDuel di chi riceve).
            applyRemoteGameOver(action.vinceSquadra === 'draw' ? 'draw' : action.vinceSquadra === cfg.miaSquadra);
            return;
        }
        applyRemoteGameOver(action.opponentWon);
    });
})();
