// @ts-check
/**
 * comandi.js — le mosse dei giocatori come COMANDI.
 * =====================================================================
 * Priorità 3 del piano, Multiplayer "a passo comune". Ogni mossa fatta da
 * un giocatore (Evocare, Settare, attaccare, attivare, avanzare di fase)
 * diventa un comando: un piccolo oggetto con TUTTE le scelte già dentro,
 * per esempio { tipo: 'evoca', carta: <uid>, casella: 2, posizione:
 * 'attack' }. Lo esegue una funzione sola, con il posto come parametro.
 *
 * Perché: nel passo comune i due telefoni eseguono l'intera partita. La
 * mossa della persona, sul suo telefono, si esegue dal click; sul telefono
 * dell'avversario arriva dalla rete come lo stesso comando, e si esegue
 * con lo STESSO codice per il posto remoto. Due versioni della stessa
 * mossa (una "mia", una "dell'avversario") prima o poi divergono — è
 * successo, più volte, con i messaggi che descrivevano le mosse.
 *
 * Un comando porta la carta per uid (carta), non solo per posizione nella
 * mano: dalla pressione del pulsante all'esecuzione la mano può cambiare,
 * e un uid non si sposta. `extra` porta ciò che serve solo all'animazione
 * di chi la mossa l'ha fatta (da dove parte il volo della carta): non
 * viaggia, e il codice delle regole non ci conta.
 *
 * Script classico, gruppo "partita" (scripts/gruppi-script.js): gli
 * esecutori vivono nei file della loro mossa (evocazioni.js, battaglia.js,
 * fasi.js) e questo file li elenca.
 */

const Comandi = (function () {
    'use strict';

    /**
     * Gli esecutori, per tipo di comando. Ciascuno riceve (posto, comando,
     * extra) e fa la mossa per quel posto. Un tipo nuovo si aggiunge qui.
     */
    const ESECUTORI = {
        evoca: (posto, c, extra) => eseguiEvocazioneNormale(posto, c, extra),
        tributa: (posto, c, extra) => eseguiTributo(posto, c, extra),
        settaMT: (posto, c, extra) => eseguiSetMagiaTrappola(posto, c, extra),
        terreno: (posto, c, extra) => eseguiSetMagiaTerreno(posto, c, extra),
        posizione: (posto, c) => eseguiCambioPosizione(posto, c),
        attacca: (posto, c, extra) => eseguiAttacco(posto, c, extra),
        scartaFineTurno: (posto, c, extra) => eseguiScartoFineTurno(posto, c, extra),
        attiva: (posto, c) => eseguiAttivazione(posto, c),
        specialeDaMano: (posto, c) => eseguiSpecialeDaMano(posto, c),
        fusioneBandendo: (posto, c) => DuelEngine.banishFusionSummon(posto, c.extraDeck, c.materiali),
        fase: (posto, c) => eseguiFase(posto, c),
        usaTerrenoAltrui: (posto) => eseguiUsoTerrenoAltrui(posto)
    };

    /**
     * Comando 'usaTerrenoAltrui': chi è di turno usa la Magia Terreno
     * dell'AVVERSARIO, quando il suo testo la concede a chiunque sia di
     * turno (def.canActivateAsTurnPlayer/activateAsTurnPlayer, oggi solo
     * Cancello di Fusione id 887).
     */
    function eseguiUsoTerrenoAltrui(posto) {
        const fs = Tavolo.magiaTerreno(Tavolo.avversario(posto));
        if (!fs || fs.isFaceDown) return false;
        const def = DuelEngine.getDefinition(fs.card.id);
        if (!def || typeof def.activateAsTurnPlayer !== 'function') return false;
        const ctx = DuelEngine.makeContext(posto, { card: fs.card, zone: 'fieldSpell', borrowedFrom: Tavolo.avversario(posto) });
        if (typeof def.canActivateAsTurnPlayer === 'function' && !def.canActivateAsTurnPlayer(ctx)) return false;
        addToLog(`${perChi(posto, 'Usi', 'L\'avversario usa')} ${fs.card.name} del ${perChi(posto, 'suo', 'tuo')} Terreno.`);
        def.activateAsTurnPlayer(ctx);
        updateUI();
        return true;
    }

    /**
     * Comando 'attiva': la carta in `c.zona` ('hand', 'st', 'monster',
     * 'fieldSpell') all'indice `c.indice` — per la mano ritrovata per uid
     * (c.carta). Tutto il resto (costi, bersagli, Catena) lo fa il motore,
     * e le scelte dentro l'effetto passano da Decisioni.
     */
    function eseguiAttivazione(posto, c) {
        let indice = c.indice;
        if (c.zona === 'hand') {
            // Senza uid (una carta costruita a mano) vale l'indice.
            indice = indiceInMano(posto, { carta: c.carta, mano: c.indice });
            if (indice === -1) return false;
        }
        return DuelEngine.activateCard(posto, c.zona, indice);
    }

    /**
     * Comando 'specialeDaMano': la carta si Evoca Specialmente da sé dalla
     * mano (le circa 33 carte con paySpecialSummonCost). Le scelte del
     * costo (Posizione, carte da bandire, da sacrificare) arrivano nel
     * comando e si rimettono dove trySpecialSummonFromHand le legge: i
     * campi gameState.pendingSpecialSummon*, consumati da lui.
     */
    function eseguiSpecialeDaMano(posto, c) {
        const indice = indiceInMano(posto, c);
        if (indice === -1) return false;
        if (c.posizione !== undefined) gameState.pendingSpecialSummonPosition = c.posizione;
        if (c.banditi !== undefined) gameState.pendingSpecialSummonBanishUids = c.banditi;
        if (c.tributi !== undefined) gameState.pendingSpecialSummonTributeUids = c.tributi;
        if (c.tributiMisti !== undefined) gameState.pendingSpecialSummonMixedTributeUids = c.tributiMisti;
        if (c.sacrificio !== undefined) gameState.pendingSpecialSummonSacrificeUid = c.sacrificio;
        return DuelEngine.trySpecialSummonFromHand(posto, indice);
    }

    /**
     * Il comando 'specialeDaMano' per la persona: prende le scelte che
     * l'interfaccia ha già messo nei campi gameState.pendingSpecialSummon*
     * e le porta nel comando (dove viaggeranno), poi lo esegue.
     */
    function specialeDaManoDellaPersona(handIndex) {
        const carta = Tavolo.mano('player')[handIndex];
        if (!carta) return false;
        const comando = { tipo: 'specialeDaMano', carta: carta.uid, mano: handIndex };
        const campi = { posizione: 'pendingSpecialSummonPosition', banditi: 'pendingSpecialSummonBanishUids', tributi: 'pendingSpecialSummonTributeUids', tributiMisti: 'pendingSpecialSummonMixedTributeUids', sacrificio: 'pendingSpecialSummonSacrificeUid' };
        Object.keys(campi).forEach((k) => {
            if (gameState[campi[k]] !== undefined && gameState[campi[k]] !== null) comando[k] = gameState[campi[k]];
        });
        return esegui('player', comando);
    }

    /**
     * Comando 'fase': chi è di turno passa a un'altra fase a mano —
     * c.verso: 'battle', 'main2', 'battle2' (la seconda Battle Phase,
     * Bollettino Meteo id 1035) o 'end'. Le fasi che avanzano da sole
     * (pescata, Standby, Main Phase 1) NON sono comandi: avvengono uguali
     * su entrambi i telefoni senza che nessuno le chieda.
     */
    function eseguiFase(posto, c) {
        if (gameState.currentPlayer !== posto || gameState.gameOver) return false;
        // Niente cambi di fase con una Catena o una finestra di priorità
        // aperta: stessa guardia di nextPhase()/endTurn() in fasi.js.
        if (window.DuelEngine && (DuelEngine.isChainActive() || (DuelEngine.isPriorityWindowOpen && DuelEngine.isPriorityWindowOpen()))) return false;
        // E nemmeno con un'Evocazione Tributo a meta' (Tributi gia' pagati): vale per ogni strada verso una nuova fase, compreso il
        // pulsante delle fasi e "Fine turno" che non passano da nextPhase().
        if (Tavolo.ePersona(posto) && EventiDuello.chiedi('evocazione-in-sospeso', false) === true) return false;
        switch (c.verso) {
            case 'battle': enterBattlePhase(); return true;
            case 'main2': enterMainPhase2(); return true;
            case 'battle2': return startSecondBattlePhase(posto);
            case 'end': enterEndPhase(); return true;
            default:
                console.error(`Comandi: fase sconosciuta "${c.verso}"`);
                return false;
        }
    }

    /**
     * La posizione in mano della carta del comando: per uid se c'è (la
     * via sicura), altrimenti per indice.
     * @returns {number} -1 se la carta non è più in mano
     */
    function indiceInMano(posto, comando) {
        const mano = Tavolo.mano(posto);
        if (comando.carta !== undefined && comando.carta !== null) {
            return mano.findIndex((c) => c && c.uid === comando.carta);
        }
        return typeof comando.mano === 'number' && mano[comando.mano] ? comando.mano : -1;
    }

    /**
     * Esegue un comando per il posto `posto`.
     * @param {string} posto
     * @param {object} comando  { tipo, ...le scelte }
     * @param {object} [extra]  solo per l'animazione locale, non viaggia
     */
    function esegui(posto, comando, extra) {
        const esecutore = comando && ESECUTORI[comando.tipo];
        if (!esecutore) {
            console.error(`Comandi: tipo sconosciuto "${comando && comando.tipo}"`);
            return false;
        }
        // La pausa automatica esiste soltanto offline. Bloccare anche qui e'
        // la cintura di sicurezza per un timer dell'IA gia' scaduto nello
        // stesso istante in cui Android nasconde la WebView.
        if (typeof PausaDuello !== 'undefined' && PausaDuello.inPausa()
            && (typeof PassoComune === 'undefined' || !PassoComune.attivo())) return false;
        // Multiplayer a passo comune (js/engine/passo-comune.js): il comando
        // di un posto locale parte per l'altro client, e la sua fine si
        // sorveglia (fino ad allora il duello non è "fermo").
        if (typeof PassoComune !== 'undefined' && PassoComune.attivo()) {
            return PassoComune.comando(posto, comando, extra || {}, (sorvegliato) => esecutore(posto, comando, sorvegliato));
        }
        return esecutore(posto, comando, extra || {});
    }

    return { esegui, indiceInMano, specialeDaManoDellaPersona, TIPI: Object.keys(ESECUTORI) };
})();

/**
 * Due modi di dire la stessa cosa nel registro, a seconda di chi ha fatto
 * la mossa: la persona davanti allo schermo ("Hai Evocato...") o l'altro
 * posto ("L'avversario ha Evocato...").
 */
function perChi(posto, perMe, perLaltro) {
    return posto === 'player' ? perMe : perLaltro;
}
