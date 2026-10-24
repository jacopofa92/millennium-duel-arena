/**
 * fasi.js — il flusso del turno: fasi, cambio turno, pescata, fine duello.
 * =====================================================================
 * Nucleo senza testa (piano di attacco, Priorità 2). Sono le REGOLE del
 * turno, separate dal disegno del campo che resta in game-flow.js: le
 * funzioni qui sotto non costruiscono elementi e non leggono il DOM per
 * decidere. Dove ancora chiamano l'interfaccia (updateUI, gli annunci di
 * fase, le animazioni) lo fanno per nome, e il passo successivo del piano
 * è farle passare da una porta sostituibile, così che lo stesso codice
 * giri anche in Node senza browser.
 *
 * Script classico: le funzioni restano globali come prima (chi le chiama,
 * pulsanti compresi, non cambia). Va caricato dopo stato.js e prima di
 * game-flow.js: nessuna riga qui gira al caricamento, sono solo
 * dichiarazioni, e le costanti/variabili che usano (in stato.js e
 * game-flow.js) si leggono al momento della chiamata.
 *
 * Spostate parola per parola da game-flow.js (tools/sposta-funzioni.js);
 * impronta di tools/impronta-funzioni.js uguale prima e dopo.
 */

/**
 * Sostituisce un `phaseTransitionTimeout = setTimeout(fn, delay)` diretto:
 * quando il timer scade, se una scelta bloccante (isBlockingModalOpen) è
 * ancora a schermo, si riprova dopo un breve intervallo invece di far
 * avanzare la fase sopra al modale ancora aperto — la causa concreta della
 * "sovrapposizione" segnalata dall'utente (un cambio fase, o l'inizio del
 * turno del bot, che scattava a tempo fisso indipendentemente da cosa
 * stesse aspettando il giocatore). Non sostituisce OGNI setTimeout del
 * motore (bot.js incatena già le proprie Promise attorno a scelte note,
 * vedi botTurn) — usarla per i punti di transizione fase generici in
 * questo file, quelli che possono scattare mentre il giocatore ha
 * qualunque tipo di scelta ancora aperta.
 */
function dopoPausaDuello(fn, delay) {
    return (typeof PausaDuello !== 'undefined') ? PausaDuello.dopo(fn, delay) : setTimeout(fn, delay);
}

function schedulePhaseTransition(fn, delay) {
    phaseTransitionTimeout = setTimeout(function retry() {
        if (isBlockingModalOpen()) {
            phaseTransitionTimeout = setTimeout(retry, 300);
            return;
        }
        fn();
    }, delay);
}

/**
 * Gemella di schedulePhaseTransition qui sopra, per chi NON è una
 * transizione di fase: stessa attesa ("solo quando non c'è niente di
 * bloccante a schermo"), ma con un timer PROPRIO invece di
 * `phaseTransitionTimeout`.
 *
 * La differenza conta: quel timer è uno solo, e riusarlo qui
 * cancellerebbe una transizione di fase già in coda — la Chain e il
 * cambio fase possono benissimo essere in attesa nello stesso momento.
 *
 * Serve soprattutto ai FILMATI DI EVOCAZIONE, segnalato dall'utente
 * ("tutto il gioco deve attendere la fine del video"). Il filmato copre
 * lo schermo e intercetta i click, ma quello che continuava a girare
 * SOTTO non erano i click: era la risoluzione della Catena, che avanzava
 * a tempo fisso — gli effetti si risolvevano, il campo cambiava, e a
 * video finito ci si ritrovava davanti a una situazione diversa senza
 * aver visto succedere niente.
 */
function afterBlockingUi(fn, delay) {
    setTimeout(function retry() {
        if (isBlockingModalOpen()) {
            setTimeout(retry, 200);
            return;
        }
        fn();
    }, delay);
}

/**
 * Pesca `amount` carte per il giocatore indicato. Se resetGameState() ha
 * potuto costruire un mazzo REALE (gameState.playerDeck/botDeck — vedi
 * lì per quando succede: partite offline, con un deck del giocatore
 * salvato e/o un avversario con un deck a tema), si pesca da lì, nel
 * vero ordine mescolato. Altrimenti (Multiplayer, o il Bot generico del
 * Duello Demo che non ha un deck proprio) resta il vecchio comportamento:
 * un semplice contatore e una carta casuale dall'intero pool.
 */
function drawCardsToHand(owner, amount, queueEffectAnimation) {
    const handKey = Tavolo.chiave(owner, 'Hand');
    const deckKey = Tavolo.chiave(owner, 'Deck');
    const countKey = Tavolo.chiave(owner, 'DeckCount');
    const realDeck = gameState[deckKey];
    let drawn = 0;
    const drawnUids = [];

    for (let i = 0; i < amount; i++) {
        if (realDeck) {
            if (realDeck.length === 0) break;
            const card = realDeck.pop();
            gameState[countKey] = realDeck.length;
            // Una carta può sostituire la propria pescata con un'azione
            // obbligatoria (Parassita Paracida): l'hook gira prima che la
            // carta entri in mano, evitando anche un flash grafico errato.
            const def = card && window.DuelEngine ? DuelEngine.getDefinition(card.id) : null;
            const handled = !!(def && typeof def.onDrawn === 'function'
                && def.onDrawn(DuelEngine.makeContext(owner, { card: card, drawnFromDeck: true })) === true);
            if (!handled) {
                gameState[handKey].push(card);
                if (card && card.uid) drawnUids.push(card.uid);
            }
        } else {
            if (gameState[countKey] <= 0) break;
            gameState[countKey] -= 1;
            const card = createRandomCard();
            gameState[handKey].push(card);
            if (card && card.uid) drawnUids.push(card.uid);
        }
        drawn++;
    }

    // Marca gli uid PRIMA dei trigger: anche un render intermedio crea le
    // nuove carte già invisibili, eliminando il flash pre-animazione.
    if (queueEffectAnimation && owner === 'player' && drawnUids.length > 0) {
        const pending = gameState._pendingDrawAnimation;
        gameState._pendingDrawAnimation = {
            owner,
            count: (pending && pending.owner === owner ? pending.count : 0) + drawnUids.length,
            uids: (pending && pending.owner === owner && Array.isArray(pending.uids) ? pending.uids : []).concat(drawnUids)
        };
        schedulePendingEffectDraw();
    }

    // Una sola volta per CHIAMATA (non per singola carta pescata) — vedi il
    // commento su DuelEngine.TRIGGER.ON_DRAW_CARDS per il perché. Dopo, non
    // prima: una carta reattiva (es. Desideri Solenni id 875) deve vedere
    // già riflesso nel log/gameState l'avvenuta pescata.
    if (drawn > 0 && window.DuelEngine) {
        DuelEngine.firePhaseTrigger(DuelEngine.TRIGGER.ON_DRAW_CARDS, owner);
    }

    return drawn;
}

function schedulePendingEffectDraw() {
    if (pendingEffectDrawScheduled) return;
    pendingEffectDrawScheduled = true;
    dopoPausaDuello(() => {
        pendingEffectDrawScheduled = false;
        const pending = gameState._pendingDrawAnimation;
        if (!pending) return;
        updateUI();
        gameState._pendingDrawAnimation = null;
        EventiDuello.emetti('pescata-da-effetto', pending.owner, pending);
    }, 0);
}

function resetGameState() {
    // Il ricordo di quante carte aveva ogni pila vive fuori da gameState
    // (è puro stato di presentazione), quindi sopravviverebbe al duello
    // precedente: senza questo azzeramento, il primo render di una
    // partita nuova confronterebbe il Deck da 40 con quello rimasto a
    // fine partita scorsa, vedrebbe una crescita e farebbe partire
    // l'animazione "è arrivata una carta" su una pila che invece sta
    // solo nascendo.
    // Stesso motivo per gli agganci Equip: un duello nuovo non deve
    // ereditare le coppie di quello prima. Entrambi i ricordi vivono in
    // game-flow.js (il disegno del campo), che li azzera ascoltando questo
    // avviso; senza pagina non c'è niente da azzerare.
    EventiDuello.emetti('partita-azzerata');

    pendingEffectDrawScheduled = false;
    gameState = {
        currentPlayer: 'player',
        phase: 'draw',
        turn: 1,
        // Identità opzionale del duellante seduto in ciascun posto. Serve
        // soltanto ai playbook IA: null mantiene il comportamento generale
        // per Multiplayer, WW1, sandbox e carte/personaggi custom.
        personaggioPerPosto: { player: null, bot: null },
        playerLP: 8000,
        botLP: 8000,
        playerHand: [],
        botHand: [],
        playerMonsterField: Array(5).fill(null),
        botMonsterField: Array(5).fill(null),
        playerSTField: Array(5).fill(null),
        botSTField: Array(5).fill(null),
        playerDeckCount: 40,
        botDeckCount: 40,
        playerGraveyard: [],
        botGraveyard: [],
        // Zona Bandite: carte rimosse dal gioco in modo persistente (es.
        // Sfera Esplosiva/Spadaccino di Fiamma Blu, alcuni costi di
        // Evocazione Fusione, Special Summon dal Cimitero bandendo
        // materiali) — a differenza del Cimitero, informazione PUBBLICA
        // come nel gioco vero, mai un bersaglio di piazzamento. Popolata
        // da ACTIONS.banish/banishTemporarily/banishFromHandWithCountdown/
        // banishFusionSummon in js/engine/duel-engine.js — vedi lì per
        // come ogni singolo effetto la usa.
        playerBanished: [],
        botBanished: [],
        // Ondata Gelida (id 159): "fino al tuo prossimo turno, né tu né
        // il tuo avversario potete giocare o Set Magie/Trappole" — a
        // differenza di gameState.noSpellActivationFor/noTrapActivationFor
        // (azzerati ad OGNI cambio turno, durata "solo per il resto di
        // questo turno"), questo NON si azzera da solo: resta finché non
        // torna il turno di chi l'ha attivato — vedi il controllo dedicato
        // in changeTurn() qui sotto (stesso schema di skipNextTurnFor) e
        // DuelEngine.isColdWaveActive(), consultata da canActivate.
        coldWaveActiveFor: {},
        // 395 — Orgoth l'Implacabile: bonus ATK/DEF (x100 sul totale di 3
        // lanci di dado) e indistruttibilità concessi "fino alla fine del
        // turno del tuo avversario" — a differenza di temporaryAtkDefBonus
        // (svuotato ad OGNI End Phase, quindi solo "fino a fine di QUESTO
        // turno"), questi non si azzerano da soli: restano finché non
        // torna il turno di chi ha lanciato i dadi, stesso schema/stesso
        // punto di coldWaveActiveFor qui sopra (vedi il controllo dedicato
        // in changeTurn()). Set di uid per proprietario: quali carte hanno
        // ancora un bonus/un'indistruttibilità Orgoth pendente da revocare.
        orgothActiveUidsFor: { player: new Set(), bot: new Set() },
        // Spada Sigillante di Orichalcos (id 396), seconda clausola: "se
        // hai una carta in Field Zone, estendi la negazione a un altro
        // mostro Effetto fino alla fine del turno avversario" — stesso
        // schema/stesso motivo di orgothActiveUidsFor qui sopra (store
        // separato, scaduto in changeTurn quando torna il turno di chi
        // l'ha concesso), perché gameState.monsterEffectsNegatedUidsFor
        // (duel-engine.js) viene azzerato e ricostruito da zero ad OGNI
        // render dalla sola clausola base (equip), non da questa estensione.
        orichalcosExtendedNegationUidsFor: { player: new Set(), bot: new Set() },
        // Bonus ATK/DEF vero e proprio (uid -> {atk, def}) concesso da
        // Orgoth l'Implacabile — store dedicato, MAI toccato da
        // recomputeStaticEffects() (duel-engine.js), a differenza di
        // gameState.atkDefBonus che invece viene azzerato e ricostruito da
        // zero ad OGNI render (solo per effetti CONTINUI): un bonus
        // one-shot come questo ci sparirebbe al render successivo se
        // scritto lì. Letto da getEffectiveAtk/getEffectiveDef
        // (duel-engine.js) insieme ad atkDefBonus/temporaryAtkDefBonus.
        orgothAtkDefBonus: {},
        // Sottoinsieme di orgothActiveUidsFor qui sopra: uid attualmente
        // indistruttibili grazie a un lancio 1-2 (o un tris). Set globale
        // (non per proprietario): l'uid da solo è già univoco in tutta la
        // partita, e i punti che lo consultano (cardIsIndestructibleByBattle
        // in actions.js, ACTIONS.destroyMonster in duel-engine.js) non hanno
        // sempre a portata di mano l'owner del bersaglio.
        orgothIndestructibleUids: new Set(),
        playerFieldSpell: null,
        botFieldSpell: null,
        // Extra Deck: mostri Fusione posseduti da ciascun lato, mai
        // pescati normalmente — popolato più sotto da
        // buildExtraDeckFromSpec() (js/data/cards-db.js) se c'è un deck reale
        // con una sezione extra; altrimenti resta vuoto (Duello Demo senza
        // un vero mazzo: l'Evocazione Fusione semplicemente non è
        // disponibile). Consultato da ACTIONS.fusionSummon/getFusableMonsters
        // in js/engine/duel-engine.js.
        playerExtraDeck: [],
        botExtraDeck: [],
        selectedCard: { type: null, card: null, index: -1 },
        pendingSummon: null,
        pendingTributeSummon: null,
        // Scelta della VERA casella Mostro di destinazione dopo un
        // Sacrificio già completato, quando più di una casella resta
        // libera — vedi resolveTributeSummonPlacement/handleSlotClick in
        // js/engine/actions.js. null quando non c'è nessuna scelta in sospeso
        // (il caso comune: un solo Tributo libera esattamente una casella,
        // usata subito senza chiedere nulla).
        pendingTributePlacement: null,
        // Scarto obbligatorio in corso per il limite di 6 carte in mano a
        // fine turno — vedi startHandDiscardSelection() in js/engine/actions.js,
        // richiamata da enterEndPhase() qui sotto.
        pendingHandDiscard: null,
        // Spade Rivelatrici (id 8): diventa true SOLO quando le spade
        // mobili dell'animazione di attivazione hanno finito di calare —
        // vedi playSwordsOfRevealingLight (effects.js) e il suo chiamante
        // in card-effects.js. renderFields() (qui sotto) mostra il segno
        // fisso .field-sword-mark sul Terreno solo da quel momento, mai
        // prima, e tickContinuousEffectDurations() lo rimette a false
        // quando l'effetto scade — a differenza di gameState.revealedFor,
        // che invece si ricalcola sempre da zero ad ogni render.
        revealedSwordsLanded: {},
        hasNormalSummoned: false,
        // Permesso per una Evocazione Tributo aggiuntiva (Canto Antico).
        // Non sostituisce hasNormalSummoned e non autorizza un normale Set.
        additionalTributeSummonFor: { player: false, bot: false },
        // Attacco Forza del Tuono: dopo la pescata, per il resto del turno
        // può dichiarare attacchi un solo mostro del giocatore indicato.
        // Il Set degli uid che hanno già attaccato permette allo stesso
        // mostro di usare eventuali attacchi aggiuntivi senza aprire la
        // restrizione a un secondo attaccante.
        onlyOneAttackingMonsterFor: { player: false, bot: false },
        // Pugno del Fato: nomi originali i cui effetti Mostro sono negati
        // fino alla fine del turno, oltre al singolo bersaglio iniziale.
        monsterEffectNamesNegatedThisTurn: new Set(),
        // Canto Antico bandito dal Cimitero: il prossimo Ra Evocato tramite
        // Tributo in questo turno riceve le statistiche originali dei suoi
        // Tributi. Il numero del turno evita ogni possibile trascinamento.
        ancientChantRaBoostTurnFor: { player: null, bot: null },
        // Effetti Ignition dei mostri (es. Soldato Cannone): chiave = uid
        // della carta -> true se già attivato in questo turno. Resettato
        // ad ogni cambio turno in changeTurn() qui sotto.
        usedIgnitionThisTurn: {},
        // Tracciamento generico "una volta per turno" per effetti che non
        // sono un Ignition di mostro (vedi ctx.hasUsedOncePerTurn/
        // markUsedOncePerTurn in duel-engine.js, es. Signore del Rosso id
        // 354). Chiave scelta da chi la usa. Resettato ad ogni cambio
        // turno in changeTurn() qui sotto, come usedIgnitionThisTurn.
        usedOncePerTurnEffect: {},
        // Bonus ATK/DEF "fino a fine turno" (vedi ctx.grantTemporaryAtkDefBonus/
        // clearTemporaryAtkDefBonus in duel-engine.js, es. Drenaggio di
        // Energia id 227, Rimozione del Limitatore id 350). Svuotato ad
        // ogni End Phase in enterEndPhase() qui sotto, non al cambio turno.
        temporaryAtkDefBonus: {},
        // Chiave = uid della carta -> true se questo mostro può attaccare
        // direttamente ANCHE se l'avversario controlla mostri, in questo
        // turno (es. Golem Meccanico la Fortezza Mobile, dopo aver pagato
        // 800 LP) — consultato in endAttackDrag() (game-flow.js). Resettato
        // ad ogni cambio turno.
        directAttackAllowedFor: {},
        // Chiave = 'player'/'bot' -> true se quel giocatore, in questo
        // turno, non subisce danno da battaglia / non può perdere mostri
        // per distruzione da battaglia (es. Waboku, id 503) — controllati
        // rispettivamente in applyDamage/resolveBattleDamage (actions.js).
        // Resettati ad ogni cambio turno come directAttackAllowedFor sopra.
        noBattleDamageFor: {},
        noBattleDestructionFor: {},
        // Chiave = 'player'/'bot' -> true se quel giocatore deve saltare
        // per intero il proprio prossimo turno (es. Azzardo, id 255) —
        // consultato UNA VOLTA in changeTurn() (game-flow.js), poi
        // azzerato subito lì stesso (non ha bisogno di un reset a parte
        // qui sotto in changeTurn come gli altri flag "per questo turno").
        skipNextTurnFor: {},
        // Chiave = 'player'/'bot' -> true se quel giocatore, in questo
        // turno, manda l'intera mano al Cimitero durante la propria End
        // Phase (es. Carta della Rovina, id 140) — consultato UNA VOLTA in
        // enterEndPhase() (game-flow.js) e azzerato subito lì, come
        // skipNextTurnFor sopra.
        discardHandAtEndPhaseFor: {},
        // Chiave = 'player'/'bot' -> true se quel giocatore, in questo
        // turno, non subisce ALCUN danno (non solo da battaglia, a
        // differenza di noBattleDamageFor — es. Carta della Rovina, id
        // 140: "il tuo avversario non subisce danni") — controllato
        // direttamente in ACTIONS.dealDamage (duel-engine.js), l'unico
        // punto per cui passa ogni variazione di LP. Resettato ad ogni
        // cambio turno come gli altri flag "per questo turno" qui sopra.
        noDamageFor: {},
        // Bando temporaneo con ritorno programmato (es. Buco Dimensionale,
        // Ninja d'Assalto): array di { card, owner, returnTrigger } — vedi
        // ACTIONS.banishTemporarily/processTemporaryBanishmentReturns in
        // duel-engine.js.
        temporaryBanishments: [],
        // Chiave = uid della carta -> { owner } se questo mostro deve
        // tornare in mano alla prossima End Phase del proprio controllore
        // (es. Cavaliere Missile, dopo aver usato il proprio effetto
        // Ignition) — consultato in enterEndPhase() tramite ON_END_PHASE.
        returnToHandOnEndPhase: {},
        gameOver: false,
        // Livello di difficoltà del bot ('easy'/'medium'/'hard' — vedi
        // js/ai/ai-controller.js): preso dalla scelta Facile/Medio/Difficile
        // fatta in duello-libero.html (DuelSession.aiDifficultyKey, vedi
        // js/duel-session.js), o 'medium' di default nel Duello Demo (nessuna
        // scelta esplicita) — cioè il comportamento del bot di sempre.
        botDifficulty: (window.DuelSession && DuelSession.aiDifficultyKey) || 'medium'
    };

    // Mazzo REALE del giocatore: se ha un deck salvato attivo si pesca da
    // lì (vedi drawCardsToHand()); altrimenti (Duello Demo, o Duello Libero
    // senza un deck attivo) non si ricade più sul vecchio pescaggio a
    // singola carta casuale dall'intero database — nessuna coerenza di
    // rapporto mostri/magie/trappole né curva di Livello — ma su un mazzo
    // di 40 carte generato al volo con un bilanciamento da vero Structure
    // Deck (vedi buildBalancedDemoDeckSpec() in js/data/cards-db.js). In
    // Multiplayer ogni client gestisce solo il proprio lato comunque,
    // quindi questo tocca solo "player".
    const playerDeckSpec = (window.SaveManager && SaveManager.getActiveDeck())
        || (typeof buildBalancedDemoDeckSpec === 'function' ? buildBalancedDemoDeckSpec() : null);
    if (playerDeckSpec && typeof buildDeckFromSpec === 'function') {
        const built = buildDeckFromSpec(playerDeckSpec);
        if (built) {
            gameState.playerDeck = built;
            gameState.playerDeckCount = built.length;
        }
        if (typeof buildExtraDeckFromSpec === 'function') {
            gameState.playerExtraDeck = buildExtraDeckFromSpec(playerDeckSpec);
        }
    }

    if (!window.MULTIPLAYER_MODE) {
        const opponent = window.DuelSession ? DuelSession.opponent : null;
        let botDeckSpec = null;
        if (opponent && opponent.id === 'mirror') {
            botDeckSpec = playerDeckSpec; // Te Stesso: lo stesso mazzo del giocatore
        } else if (opponent && opponent.id && typeof getCharacterDeck === 'function') {
            // Difficoltà passata esplicitamente (gameState.botDifficulty è
            // già stato impostato qui sopra in questa stessa funzione) —
            // IA Normale riceve una versione leggermente indebolita dello
            // stesso mazzo a tema, vedi il commento su getCharacterDeck in
            // js/data/character-decks.js.
            botDeckSpec = getCharacterDeck(opponent.id, gameState.botDifficulty);
        }
        if (botDeckSpec && typeof buildDeckFromSpec === 'function') {
            const built = buildDeckFromSpec(botDeckSpec);
            if (built) {
                gameState.botDeck = built;
                gameState.botDeckCount = built.length;
            }
            if (typeof buildExtraDeckFromSpec === 'function') {
                gameState.botExtraDeck = buildExtraDeckFromSpec(botDeckSpec);
            }
        }
    }
}

function nextPhase() {
    // Non avanzare fase mentre una finestra di priorità della Chain è
    // aperta (es. si sta ancora aspettando la scelta del giocatore se
    // rispondere con una Trappola) — vedi DuelEngine.isChainActive() in
    // js/engine/duel-engine.js.
    if (window.DuelEngine && DuelEngine.isChainActive()) return;
    // Nemmeno con una finestra di priorità aperta (vedi
    // DuelEngine.openPriorityWindow): in Multiplayer chi è di turno non ha
    // nessun modale davanti mentre l'avversario decide, e avanzare di fase
    // in quel momento lascerebbe i due client su due fasi diverse.
    if (window.DuelEngine && DuelEngine.isPriorityWindowOpen && DuelEngine.isPriorityWindowOpen()) return;
    // Tributi gia' pagati e Evocazione non finita: il cambio di fase (e il clearSelection qui sotto) la annullerebbe e il mostro
    // sacrificato andrebbe perso. Vedi evocazioneTributoInSospeso in actions.js.
    if (Tavolo.ePersona(gameState.currentPlayer) && EventiDuello.chiedi('evocazione-in-sospeso', false) === true) return;
    clearSelection();
    switch (gameState.phase) {
        case 'main1':
            Comandi.esegui(gameState.currentPlayer, { tipo: 'fase', verso: 'battle' });
            break;
        case 'battle':
            Comandi.esegui(gameState.currentPlayer, { tipo: 'fase', verso: 'main2' });
            break;
    }
}

function endTurn() {
    // Il pulsante "fine turno" è della persona: un turno dell'IA o del
    // remoto non si chiude da qui.
    if (!Tavolo.ePersona(gameState.currentPlayer)) return;
    // Stessa guardia di nextPhase() qui sopra: niente fine turno con una
    // Chain ancora aperta.
    if (window.DuelEngine && DuelEngine.isChainActive()) return;
    if (window.DuelEngine && DuelEngine.isPriorityWindowOpen && DuelEngine.isPriorityWindowOpen()) return;
    Comandi.esegui(gameState.currentPlayer, { tipo: 'fase', verso: 'end' });
}

/**
 * Fa scendere di 1 il conto alla rovescia delle Magie/Trappole Continue a
 * durata limitata (es. Spada Rivelatrice, 3 turni; Gabbia d'Acciaio
 * dell'Incubo, 2 turni) e le manda al Cimitero da sole quando arrivano a
 * 0 — invece di restare per sempre come le Magie Continue normali. Il
 * conteggio scende una volta per ogni turno dell'AVVERSARIO di chi ha
 * attivato la carta. Chiamata da enterEndPhase() (non da changeTurn()):
 * il testo reale di entrambe le carte dice "distrutta durante la N-esima
 * End Phase dell'avversario", quindi la carta deve restare attiva per
 * TUTTO l'ultimo turno dell'avversario (Battle Phase inclusa), non
 * sparire già al suo inizio — bug di fedeltà corretto in sessione
 * (prima veniva distrutta all'inizio di quel turno, non alla sua fine).
 */
function tickContinuousEffectDurations() {
    Tavolo.ordine().forEach((owner) => {
        const opponent = Tavolo.avversario(owner);
        if (gameState.currentPlayer !== opponent) return;
        const field = Tavolo.magieTrappole(owner);
        const graveyard = Tavolo.cimitero(owner);
        field.forEach((slot, index) => {
            if (!slot || slot.isFaceDown || typeof slot.turnsLeft !== 'number') return;
            slot.turnsLeft -= 1;
            if (slot.turnsLeft <= 0) {
                addToLog(`⌛ ${slot.card.name} ${owner === 'player' ? 'ti' : 'gli'} ha esaurito il suo effetto e va al Cimitero.`);
                graveyard.push(slot.card);
                field[index] = null;
                // Spade Rivelatrici (id 8): se una futura riattivazione
                // colpisse di nuovo lo stesso giocatore, il segno fisso non
                // deve ricomparire all'istante prima che le spade mobili
                // abbiano rifatto la loro caduta — vedi la dichiarazione di
                // revealedSwordsLanded in resetGameState() qui sopra.
                if (slot.card.id === 8 && gameState.revealedSwordsLanded) {
                    gameState.revealedSwordsLanded[opponent] = false;
                }
            }
        });
    });
}

function changeTurn() {
    clearPhaseTransitionTimeout();
    addToLog(`🔄 Turno ${gameState.turn} terminato.`);
    gameState.turn++;
    gameState.currentPlayer = Tavolo.avversario(gameState.currentPlayer);
    // Blocco Trappole/Magie "per il resto del turno" (es. Manta
    // Perforante Strisciante id 693, famiglia Ingranaggio Antico) — vedi
    // gameState.noTrapActivationFor/noSpellActivationFor, controllati in
    // canActivate() (duel-engine.js).
    gameState.noTrapActivationFor = {};
    gameState.noSpellActivationFor = {};
    // Sentinella Cremisi (id 1063): "distrutto in battaglia DURANTE
    // QUESTO TURNO" — stesso schema "per il resto del turno" di sopra,
    // popolato in fireOnDestroy (actions.js).
    gameState.battleDestroyedThisTurnFor = { player: [], bot: [] };
    // Ala del Tiranno (id 496, Wing of the Great Tyrant): "se il mostro
    // equipaggiato con questa carta tramite questo effetto ha attaccato
    // un mostro dell'avversario in questo turno" — Set per-uid di
    // ATTACCANTI che hanno dichiarato un attacco contro un vero mostro
    // (non diretto) in questo turno, popolato in resolveAttack (actions.js).
    gameState.attackedMonsterUidsThisTurn = new Set();
    gameState.onlyOneAttackingMonsterFor = { player: false, bot: false };
    gameState.monsterEffectNamesNegatedThisTurn = new Set();
    gameState.ancientChantRaBoostTurnFor = { player: null, bot: null };
    // Guardiana delle Fate (id 1069): "Magia mandata al TUO Cimitero da
    // un effetto dell'AVVERSARIO durante QUESTO turno" — stesso schema,
    // popolato in ACTIONS.destroySpellTrap (duel-engine.js).
    gameState.spellsSentToGraveyardByOpponentThisTurnFor = { player: [], bot: [] };
    // "Non puoi condurre la tua Battle Phase in questo turno" (es. Makiu,
    // la Nebbia Magica id 366; Carica dell'Anima/Soul Charge id 59) —
    // vedi il controllo in enterBattlePhase() qui sopra.
    gameState.skipBattlePhaseFor = {};
    // Fata della Primavera (id 728)/Trapano Ingranaggio Antico (id 842):
    // "in questo turno, quella carta specifica non può essere attivata" —
    // stesso schema "per il resto del turno" di sopra, ma per uid di
    // carta invece che per proprietario/tipo — vedi
    // gameState.blockedCardUidsThisTurn in DuelEngine.canActivate.
    gameState.blockedCardUidsThisTurn = new Set();
    // Obelisk il Tormentatore (id 30): "questa carta non può dichiarare
    // un attacco nel turno in cui viene attivato questo effetto" — set
    // per uid, stesso schema "per il resto del turno" di sopra, azzerato
    // qui a ogni cambio turno.
    gameState.cannotAttackUidsThisTurn = new Set();
    // Maledizione di Anubis (id 655): "non possono cambiare Posizione di
    // Battaglia per il resto del turno" — stesso schema "per uid, per il
    // resto del turno" di cannotAttackUidsThisTurn qui sopra, ma per il
    // cambio Posizione. A differenza di gameState.cannotChangePositionUids
    // (ricalcolato ad ogni render da un effetto CONTINUO, es. Incantesimo
    // Ombra id 439 — si azzererebbe da solo al render successivo se
    // usato da un effetto non continuo come questo, un Trappola Normale
    // one-shot), questo Set sopravvive fino al prossimo cambio turno.
    gameState.cannotChangePositionUidsThisTurn = new Set();
    // Scintilla dell'Estasi Triangolare (id 789): "fino alla fine di
    // questo turno, annulla tutti gli effetti Trappola dell'avversario
    // sul Terreno" — stesso schema "per il resto del turno", consultato
    // da DuelEngine.areTrapsNegatedFor.
    gameState.trapsNegatedUntilEndOfTurnFor = {};
    // Tempesta di Piume delle Arpie (id 292): stesso schema "per il resto
    // del turno" qui sopra, ma per gli effetti Mostro invece che
    // Trappola — consultato da DuelEngine.areMonsterEffectsNegatedFor.
    gameState.monsterEffectsNegatedUntilEndOfTurnFor = {};
    // Occhio di Gorgone (id 271): "fino alla fine di questo turno, gli
    // effetti dei mostri in Posizione di Difesa sono annullati" — stesso
    // schema "per il resto del turno" di sopra, consultato in
    // DuelEngine.canActivate (Ignition) e recomputeStaticEffects
    // (static continui) — vedi duel-engine.js.
    gameState.defenseMonsterEffectsNegated = false;
    // Benedizione di Sebek (id 813): "attivabile solo quando un tuo
    // mostro ha attaccato direttamente l'avversario; guadagni Life
    // Points pari al danno da battaglia inflitto" — Magia Rapida
    // attivabile dalla mano DOPO che il danno è già stato inflitto (non
    // una risposta "nel momento", come una Trappola), quindi basta
    // ricordarsi l'ultimo danno da attacco diretto di ciascun
    // proprietario in questo turno (sovrascritto ad ogni nuovo attacco
    // diretto, vedi actions.js/resolveAttack), azzerato qui ad ogni
    // cambio turno.
    gameState.directAttackDamageFor = {};
    // Turno saltato per intero (es. Azzardo, id 255, se si sbaglia il
    // lancio di moneta): richiamare changeTurn() di nuovo, subito, passa
    // dritti al turno DOPO — stesso effetto pratico di "salta il tuo
    // turno successivo", senza dover introdurre una fase-fantasma vuota
    // solo per poi passare oltre.
    // Ondata Gelida (id 159): torna il turno di chi l'ha attivata -> il
    // blocco si esaurisce, stesso schema/stesso punto di skipNextTurnFor
    // qui sotto (gameState.currentPlayer è già il NUOVO giocatore di
    // turno a questo punto della funzione).
    gameState.coldWaveActiveFor = gameState.coldWaveActiveFor || {};
    if (gameState.coldWaveActiveFor[gameState.currentPlayer]) {
        gameState.coldWaveActiveFor[gameState.currentPlayer] = false;
        addToLog(`❄️ Ondata Gelida smette di fare effetto: ${gameState.currentPlayer === 'player' ? 'puoi' : 'il bot può'} di nuovo giocare Magie/Trappole.`);
    }
    // 395 — Orgoth l'Implacabile: il bonus ATK/DEF e l'indistruttibilità
    // durano "fino alla fine del turno dell'avversario" di chi li ha
    // attivati — cioè finché non torna il turno di quel giocatore, esattamente
    // come Ondata Gelida qui sopra (gameState.currentPlayer è già il NUOVO
    // giocatore di turno a questo punto della funzione).
    gameState.orgothActiveUidsFor = gameState.orgothActiveUidsFor || { player: new Set(), bot: new Set() };
    gameState.orgothIndestructibleUids = gameState.orgothIndestructibleUids || new Set();
    gameState.orgothAtkDefBonus = gameState.orgothAtkDefBonus || {};
    const orgothSet = gameState.orgothActiveUidsFor[gameState.currentPlayer];
    if (orgothSet && orgothSet.size) {
        orgothSet.forEach((uid) => {
            delete gameState.orgothAtkDefBonus[uid];
            gameState.orgothIndestructibleUids.delete(uid);
        });
        addToLog('🎲 Il bonus ATK/DEF e l\'indistruttibilità di Orgoth l\'Implacabile terminano.');
        orgothSet.clear();
    }
    // Spada Sigillante di Orichalcos (id 396): stessa identica durata
    // "fino alla fine del turno avversario" di Orgoth qui sopra, per
    // l'estensione della negazione effetti a un secondo mostro.
    gameState.orichalcosExtendedNegationUidsFor = gameState.orichalcosExtendedNegationUidsFor || { player: new Set(), bot: new Set() };
    const orichalcosSet = gameState.orichalcosExtendedNegationUidsFor[gameState.currentPlayer];
    if (orichalcosSet && orichalcosSet.size) {
        addToLog('⚔️ L\'estensione di Spada Sigillante di Orichalcos termina.');
        orichalcosSet.clear();
    }
    // Store GENERICO e riusabile per "bonus ATK/DEF fino alla fine del
    // turno dell'AVVERSARIO" (nato per Bazoo il Divora-Anime, id 1107,
    // ma pensato per qualunque futura carta con lo stesso bisogno, senza
    // duplicare per la terza volta lo stesso schema di orgothAtkDefBonus/
    // orgothActiveUidsFor sopra) — stessa identica semantica: la voce è
    // salvata sotto la chiave del CONTROLLORE che l'ha concessa e scade
    // quando torna il SUO turno (cioè alla fine del turno avversario).
    gameState.untilOpponentTurnActiveUidsFor = gameState.untilOpponentTurnActiveUidsFor || { player: new Set(), bot: new Set() };
    gameState.untilOpponentTurnAtkDefBonus = gameState.untilOpponentTurnAtkDefBonus || {};
    const untilOpponentTurnSet = gameState.untilOpponentTurnActiveUidsFor[gameState.currentPlayer];
    if (untilOpponentTurnSet && untilOpponentTurnSet.size) {
        untilOpponentTurnSet.forEach((uid) => { delete gameState.untilOpponentTurnAtkDefBonus[uid]; });
        addToLog('⏳ Un bonus ATK/DEF "fino alla fine del turno avversario" termina.');
        untilOpponentTurnSet.clear();
    }
    gameState.skipNextTurnFor = gameState.skipNextTurnFor || {};
    if (gameState.skipNextTurnFor[gameState.currentPlayer]) {
        gameState.skipNextTurnFor[gameState.currentPlayer] = false;
        addToLog(`⏭️ ${gameState.currentPlayer === 'player' ? 'Il tuo turno viene saltato' : 'Il turno del bot viene saltato'} (Azzardo)!`);
        changeTurn();
        return;
    }
    EventiDuello.emetti('orologio');
    if (window.SFX) SFX.turnChange();
    const isPlayerTurn = gameState.currentPlayer === 'player';
    // Il cambio turno è il momento più "importante" del duello: qui, e non
    // più all'inizio della Battle Phase, va l'annuncio cinematografico da
    // 3 secondi (flash, barre, raggi, parole che si scontrano). Il turno
    // del giocatore ha la sua battuta iconica in stile anime; quello del
    // bot resta "TURNO" + nome, split in due parole che si scontrano.
    if (isPlayerTurn) {
        // "TURNO" + nome di chi gioca, come per l'avversario (richiesta
        // dell'utente al posto di "È il mio turno!"). DuelSession.player.name
        // vale anche per un protagonista di Storia/Rivincite (es. Atem).
        const nomeGiocatore = (window.DuelSession && window.DuelSession.player && window.DuelSession.player.name) || 'Giocatore';
        EventiDuello.emetti('annuncio-turno', 'TURNO', nomeGiocatore, `Turno ${gameState.turn}`);
    } else {
        // Nome vero dell'avversario (es. "Seto Kaiba"), non più il generico
        // "BOT" — window.DuelSession lo risolve già correttamente per ogni
        // modalità (Duello Demo -> "Bot", Duello Libero/Storia -> il
        // personaggio scelto, Multiplayer -> "Avversario").
        const wordRight = (window.DuelSession && window.DuelSession.opponent && window.DuelSession.opponent.name) || 'BOT';
        EventiDuello.emetti('annuncio-turno', 'TURNO', wordRight, `Turno ${gameState.turn}`);
    }
    gameState.hasNormalSummoned = false;
    gameState.additionalTributeSummonFor = { player: false, bot: false };
    gameState.usedIgnitionThisTurn = {};
    gameState.usedOncePerTurnEffect = {};
    gameState.directAttackAllowedFor = {};
    gameState.noBattleDamageFor = {};
    gameState.noBattleDestructionFor = {};
    gameState.noDamageFor = {};
    const field = Tavolo.mostri(gameState.currentPlayer);
    field.forEach(slot => {
        if (slot) {
            slot.hasAttacked = false;
            slot.canChangePosition = true;
            // Attacchi extra nella stessa Battle Phase (es. Cavaliere
            // Hayabusa id 294, Riavvolgimento Toon id 485, Samurai Armato -
            // Ben Kei id 721): "quanti già usati" e "concesso da un'altra
            // carta" si azzerano un turno per volta, come hasAttacked qui
            // sopra — vedi resolveAttack in actions.js.
            slot.extraAttacksUsedThisTurn = 0;
            slot.extraAttackGranted = false;
            slot.extraAttacksGrantedCount = 0;
        }
    });
    // 199 — "deve attaccare tutti i mostri avversari": l'obbligo dura
    // solo il turno in cui è stato concesso, come extraAttacksGrantedCount
    // qui sopra.
    gameState.mustAttackTargetUidsFor = {};
    gameState.negatesEffectsOnForcedAttackFor = new Set();
    clearSelection();
    updateUI();
    // Il turno vero e proprio parte solo a annuncio concluso, così non si
    // sovrappone alla scena cinematografica. Chi lo guida dipende da chi
    // controlla il posto (js/engine/tavolo.js): l'IA gioca il turno intero
    // da sola; per la persona le fasi avanzano fino alla Main Phase e poi
    // aspettano i suoi click; un posto remoto (Multiplayer) lo guida
    // l'altro client.
    const diTurno = gameState.currentPlayer;
    const controllore = Tavolo.controllore(diTurno);
    // A passo comune (js/engine/passo-comune.js) anche il turno del posto
    // remoto si gioca di qua: pescata, Standby e Main Phase 1 avanzano da
    // sole come per la persona, e da lì in poi arrivano i suoi comandi.
    const remotoAPassoComune = controllore === 'remoto' && typeof PassoComune !== 'undefined' && PassoComune.attivo();
    if (controllore === 'ia') {
        dopoPausaDuello(() => turnoIA(diTurno), 3000);
    } else if (controllore === 'persona' || remotoAPassoComune) {
        dopoPausaDuello(() => enterDrawPhase(true), 3000);
    }
}

function clearPhaseTransitionTimeout() {
    if (phaseTransitionTimeout) {
        if (typeof PausaDuello !== 'undefined') PausaDuello.annulla(phaseTransitionTimeout);
        else clearTimeout(phaseTransitionTimeout);
        phaseTransitionTimeout = null;
    }
}

/**
 * 755 — Maharaghi: "quando questa carta viene Evocata Normalmente o
 * girata scoperta, guarda la prima carta del tuo Deck alla tua prossima
 * Draw Phase (PRIMA di pescare) e scegli se lasciarla in cima (la
 * pescherai) o mandarla in fondo (ne pescherai un'altra)" — effetto
 * RITARDATO che sopravvive al ritorno in mano di Maharaghi stessa a fine
 * turno (gameState.pendingMaharaghiPeekFor, per owner, impostato da
 * onSummon/onFlip in card-effects.js). Wrapper attorno alla vera
 * enterDrawPhase (rinominata enterDrawPhaseInner qui sotto): se c'è un
 * obbligo in sospeso per gameState.currentPlayer, mostra la scelta
 * PRIMA di procedere con la Draw Phase vera e propria, invece di
 * toccare la logica di pesca già esistente (temporizzata, con finestre
 * di risposta) — un solo nuovo punto d'ingresso, zero rischio per il
 * flusso normale quando non c'è nulla in sospeso.
 */
function enterDrawPhase(autoAdvance = true, onComplete = null) {
    const owner = gameState.currentPlayer;
    const deck = Tavolo.mazzo(owner);
    if (gameState.pendingMaharaghiPeekFor && gameState.pendingMaharaghiPeekFor[owner] && Array.isArray(deck) && deck.length > 0) {
        gameState.pendingMaharaghiPeekFor[owner] = false;
        const topCard = deck[deck.length - 1];
        const proceed = () => enterDrawPhaseInner(autoAdvance, onComplete);
        if (Decisioni.rispondeUnaPersona(owner)) {
            addToLog(`🔮 Maharaghi: guardi la prima carta del tuo Deck (${topCard.name})!`);
            Decisioni.chiedi({
                chi: owner,
                tipo: 'coppia',
                titolo: `🔮 Maharaghi: ${topCard.name} — lasciarla in cima o mandarla in fondo?`,
                candidati: [
                    {
                        icon: '⬆️', label: 'Lasciala in cima',
                        onSelect: () => { addToLog('🔮 Maharaghi: la carta resta in cima al Deck.'); proceed(); }
                    },
                    {
                        icon: '⬇️', label: 'Mandala in fondo',
                        onSelect: () => {
                            deck.splice(deck.length - 1, 1);
                            deck.unshift(topCard);
                            addToLog('🔮 Maharaghi: la carta va in fondo al Deck.');
                            proceed();
                        }
                    }
                ]
            }, (scelta) => {
                if (scelta) scelta.onSelect();
            });
            return;
        }
        // Bot: mantiene la prima carta se è vantaggiosa (mostro/Magia/Trappola
        // sempre benvenuti), altrimenti la manda in fondo — euristica minima,
        // nessuna vera IA dedicata per questa scelta di nicchia.
        addToLog('🔮 Maharaghi: il bot guarda la prima carta del suo Deck.');
        proceed();
        return;
    }
    enterDrawPhaseInner(autoAdvance, onComplete);
}

function enterDrawPhaseInner(autoAdvance = true, onComplete = null) {
    clearPhaseTransitionTimeout();
    gameState.phase = 'draw';
    // Al rientro dopo "Pesca normalmente" di Freed (id 888, più sotto) la
    // battuta d'inizio turno è già stata detta: non va ripetuta.
    if (window.DuelDialogues && gameState.turn > 1 && gameState.freedChoiceTurn !== gameState.turn) {
        DuelDialogues.say(gameState.currentPlayer, 'turnStart');
    }
    // Avidità Sconsiderata (id 653): "pesca 2 carte e salta le tue
    // prossime 2 Draw Phase" — gameState.skipDrawFor[owner] è un
    // contatore (non un booleano) per coprire il "2 volte", stesso
    // spirito di skipNextTurnFor ma granulare sulla sola Draw Phase
    // invece che sull'intero turno.
    gameState.skipDrawFor = gameState.skipDrawFor || {};
    if (gameState.skipDrawFor[gameState.currentPlayer] > 0) {
        gameState.skipDrawFor[gameState.currentPlayer]--;
        addToLog(`🚫 ${gameState.currentPlayer === 'player' ? 'Salti' : 'Il bot salta'} la Draw Phase (Cupidigia Insaziabile)!`);
        if (typeof onComplete === 'function') onComplete();
        else if (autoAdvance) schedulePhaseTransition(() => enterStandbyPhase(true), 500);
        return;
    }
    // Freed il Generale Senza Rivali (id 888): "durante la tua Draw
    // Phase, invece della pescata normale, puoi aggiungere 1 mostro
    // Guerriero di Livello 4 o inferiore dal tuo Deck alla mano" — stesso
    // schema hardcoded qui (non in card-effects.js) di skipDrawFor/
    // pendingMaharaghiPeekFor qui sopra/sotto: una sostituzione della
    // pescata vive per forza a questo livello, non in un normale hook di
    // card-effects.js. È un "puoi": il giocatore sceglie con un popover se
    // pescare o cercare, e se cerca sceglie QUALE Guerriero. Scegliendo di
    // pescare, la funzione si richiama da capo con la scelta già fatta
    // (gameState.freedChoiceTurn) e prosegue con la pescata normale. Il bot
    // cerca sempre (la carta scelta vale più di una pescata a caso); in
    // Multiplayer la ricerca resta automatica per entrambi, perché questa
    // scelta non viaggia fra i due client.
    const freedOwner = gameState.currentPlayer;
    const freedField = Tavolo.mostri(freedOwner);
    const freedSlot = (freedField || []).find((s) => s && !s.isFaceDown && s.card.id === 888);
    if (freedSlot && gameState.freedChoiceTurn !== gameState.turn) {
        const freedDeckKey = Tavolo.chiave(freedOwner, 'Deck');
        const freedDeck = gameState[freedDeckKey];
        const isTarget = (c) => c.type === 'monster' && c.race === 'Guerriero' && (c.level || 0) <= 4;
        const candidati = Array.isArray(freedDeck) ? freedDeck.filter(isTarget) : [];
        if (candidati.length > 0) {
            const prosegui = () => {
                if (typeof onComplete === 'function') onComplete();
                else if (autoAdvance) schedulePhaseTransition(() => enterStandbyPhase(true), 500);
            };
            const cerca = (scelta) => {
                const i = freedDeck.indexOf(scelta);
                if (i === -1) { prosegui(); return; }
                freedDeck.splice(i, 1);
                Tavolo.mano(freedOwner).push(scelta);
                gameState[freedDeckKey === 'playerDeck' ? 'playerDeckCount' : 'botDeckCount'] = freedDeck.length;
                addToLog(`⚔️ Freed il Generale Senza Avversari cerca ${freedOwner === 'player' ? scelta.name : 'un Guerriero'} dal Deck invece di pescare!`);
                updateUI();
                prosegui();
            };
            if (!Decisioni.rispondeUnaPersona(freedOwner) || window.MULTIPLAYER_MODE) {
                cerca(candidati[0]);
                return;
            }
            Decisioni.chiedi({
                chi: freedOwner,
                tipo: 'coppia',
                titolo: '⚔️ Freed il Generale: pescare o cercare?',
                candidati: [
                    {
                        icon: '🔍', label: 'Cerca 1 Guerriero di Livello 4 o inferiore',
                        onSelect: () => {
                            if (candidati.length === 1) { cerca(candidati[0]); return; }
                            Decisioni.chiedi({
                                chi: freedOwner,
                                candidati: candidati,
                                titolo: '⚔️ Freed il Generale',
                                testo: 'Scegli quale Guerriero aggiungere alla mano al posto della pescata.',
                                annullabile: true
                            }, (card) => {
                                if (card === null) {
                                    cerca(candidati[0]);
                                    return;
                                }
                                cerca(candidati.find((c) => c.uid === card.uid) || candidati[0]);
                            });
                        }
                    },
                    {
                        icon: '🎴', label: 'Pesca normalmente',
                        onSelect: () => {
                            gameState.freedChoiceTurn = gameState.turn;
                            enterDrawPhaseInner(autoAdvance, onComplete);
                        }
                    }
                ]
            }, (scelta) => {
                if (scelta) scelta.onSelect();
            });
            return;
        }
    }
    // Hino-Kagu-Tsuchi (Mostro Spirito): "se infligge danno da battaglia,
    // l'avversario scarta l'intera mano durante la sua prossima Draw
    // Phase, PRIMA di pescare" — booleano che sopravvive al cambio turno
    // (stesso principio di skipNextBattlePhaseFor più sopra in questo
    // file), consumato qui perché il momento esatto "prima della pescata"
    // esiste solo dentro questa funzione.
    gameState.discardHandBeforeDrawFor = gameState.discardHandBeforeDrawFor || {};
    if (gameState.discardHandBeforeDrawFor[gameState.currentPlayer]) {
        gameState.discardHandBeforeDrawFor[gameState.currentPlayer] = false;
        const handKey = Tavolo.chiave(gameState.currentPlayer, 'Hand');
        const graveyardKey = Tavolo.chiave(gameState.currentPlayer, 'Graveyard');
        const discardedAll = gameState[handKey].splice(0, gameState[handKey].length);
        gameState[graveyardKey].push(...discardedAll);
        if (discardedAll.length > 0) {
            addToLog(`🔥 ${gameState.currentPlayer === 'player' ? 'Scarti' : 'Il bot scarta'} l'intera mano prima di pescare (Hino-Kagu-Tsuchi)!`);
        }
    }
    const opponentLabel = (window.DuelSession && window.DuelSession.opponent && window.DuelSession.opponent.name) || 'Bot';
    EventiDuello.emetti('annuncio-fase', 'Pesca', gameState.currentPlayer === 'player' ? 'Draw Phase' : `Draw Phase - ${opponentLabel}`);
    addToLog(`--- ${gameState.currentPlayer === 'player' ? 'Tuo Turno' : `Turno ${opponentLabel}`} ${gameState.turn} ---`);
    addToLog('🎴 Draw Phase');

    // `animateNewCard`: la carta appena pescata scorre in mano da destra,
    // stesso identico effetto (e stessa durata, 0.3s) della mano iniziale
    // — vedi .card.deal-in in CSS. Va animata DOPO updateUI(), che è il
    // momento in cui la carta compare davvero nel DOM della mano.
    const finishDrawEffect = (animateNewCard) => {
        updateUI();
        if (animateNewCard) EventiDuello.emetti('carta-pescata-in-mano');
        if (typeof onComplete === 'function') {
            onComplete();
        } else if (autoAdvance) {
            schedulePhaseTransition(() => enterStandbyPhase(true), 700);
        }
    };

    const boardId = gameState.currentPlayer === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
    const deckSlot = PortaUI.query(`#${boardId} .field-slot[data-zone="deck"]`);
    if (deckSlot) {
        deckSlot.classList.add('draw-effect');
    }

    if (gameState.turn > 1) {
        addToLog(`${gameState.currentPlayer === 'player' ? '🃏 Stai pescando una carta dal deck...' : '🃏 Il bot sta pescando una carta dal deck...'}`);
        schedulePhaseTransition(() => {
            let drawnToPlayerHand = false;
            let drawnCard = null;
            if (gameState.currentPlayer === 'player') {
                const drawn = drawCardsToHand('player', 1);
                if (drawn > 0) {
                    drawnCard = gameState.playerHand[gameState.playerHand.length - 1];
                    addToLog(`Hai pescato: ${drawnCard.name}`);
                    drawnToPlayerHand = true;
                } else {
                    // Mazzo esaurito (regole.html, Capitolo 1 e 2): non è più
                    // solo un messaggio nel log, chi deve pescare e non può
                    // perde subito il duello — endDuel() ferma da sola ogni
                    // timer di fase in corso, quindi si esce da questa
                    // funzione senza chiamare finishDrawEffect().
                    addToLog('💀 Il tuo mazzo è vuoto: non puoi pescare e perdi il duello!');
                    if (deckSlot) deckSlot.classList.remove('draw-effect');
                    endDuel(false);
                    return;
                }
            } else {
                const drawn = drawCardsToHand('bot', 1);
                if (drawn > 0) {
                    drawnCard = gameState.botHand[gameState.botHand.length - 1];
                    addToLog('Il bot ha pescato una carta.');
                } else {
                    addToLog('🎉 Il mazzo del bot è vuoto: non può pescare e perde il duello!');
                    if (deckSlot) deckSlot.classList.remove('draw-effect');
                    endDuel(true);
                    return;
                }
            }
            if (deckSlot) {
                deckSlot.classList.remove('draw-effect');
            }
            // Finestra di risposta per l'avversario di chi ha appena
            // pescato (es. Fuori Gioco, id 216) PRIMA di completare
            // l'animazione/passare avanti — se non c'è nulla con cui
            // rispondere, DuelEngine.openDrawResponseWindow richiama subito
            // il proprio onDone, comportamento identico a prima per tutti
            // gli altri turni.
            if (window.DuelEngine && typeof DuelEngine.openDrawResponseWindow === 'function') {
                DuelEngine.openDrawResponseWindow(gameState.currentPlayer, drawnCard, () => finishDrawEffect(drawnToPlayerHand));
            } else {
                finishDrawEffect(drawnToPlayerHand);
            }
        }, 900);
    } else {
        addToLog('Le carte iniziali sono già state distribuite.');
        if (deckSlot) {
            deckSlot.classList.remove('draw-effect');
        }
        finishDrawEffect();
    }
}

function enterStandbyPhase(autoAdvance = true) {
    clearPhaseTransitionTimeout();
    gameState.phase = 'standby';
    EventiDuello.emetti('annuncio-fase', 'Standby', 'Standby Phase');
    addToLog('⏳ Standby Phase');
    if (window.DuelEngine) {
        DuelEngine.processTemporaryBanishmentReturns('standby', gameState.currentPlayer);
        DuelEngine.processDelayedHandReturns(gameState.currentPlayer);
        DuelEngine.processDelayedGraveyardRevivals(gameState.currentPlayer);
        DuelEngine.processPendingBlastSphereDetonations(gameState.currentPlayer);
        DuelEngine.processKiseitaiLifeGain(gameState.currentPlayer);
        DuelEngine.processPendingStandbyAtkBuffs(gameState.currentPlayer);
        DuelEngine.firePhaseTrigger(DuelEngine.TRIGGER.ON_STANDBY_PHASE, gameState.currentPlayer);
    }
    updateUI();
    if (autoAdvance) {
        // Finestra di priorità per chi non è di turno (vedi
        // passaIlTurnoDopoLaPriorita più sotto): senza candidati prosegue
        // subito. Nel turno del bot (autoAdvance false) la apre botTurn.
        const nonDiTurno = Tavolo.avversario(gameState.currentPlayer);
        if (window.DuelEngine && typeof DuelEngine.openPriorityWindow === 'function') {
            DuelEngine.openPriorityWindow(nonDiTurno, 'standby', () => schedulePhaseTransition(() => enterMainPhase1(), 500));
        } else {
            schedulePhaseTransition(() => enterMainPhase1(), 500);
        }
    }
}

function enterMainPhase1() {
    clearPhaseTransitionTimeout();
    // Divoratempo (id 480): "se distrugge in battaglia un mostro
    // dell'avversario, l'avversario salta la sua prossima Main Phase 1" —
    // stesso spirito granulare di skipDrawFor (Draw Phase) qui sopra, ma
    // booleano invece di contatore (il testo reale copre una sola volta).
    // Salta subito alla Battle Phase, come farebbe normalmente il
    // giocatore dopo un Main Phase 1 senza azioni.
    gameState.skipMainPhase1For = gameState.skipMainPhase1For || {};
    if (gameState.skipMainPhase1For[gameState.currentPlayer]) {
        gameState.skipMainPhase1For[gameState.currentPlayer] = false;
        addToLog(`🚫 ${gameState.currentPlayer === 'player' ? 'Salti' : 'Il bot salta'} la Main Phase 1 (Divoratempo)!`);
        if (gameState.turn > 1) {
            schedulePhaseTransition(() => enterBattlePhase(), 500);
            return;
        }
    }
    gameState.phase = 'main1';
    EventiDuello.emetti('annuncio-fase', 'Main Phase 1');
    addToLog('⚡ Main Phase 1');
    if (window.DuelEngine) {
        DuelEngine.fireOwnMainPhase1GraveyardActivations(gameState.currentPlayer);
    }
    updateUI();
}

function enterBattlePhase() {
    if (gameState.turn === 1) {
        addToLog('❌ Non puoi entrare in Battle Phase nel primo turno. Rimani in Main Phase 1 o vai direttamente a End Phase.');
        return;
    }
    // "Non puoi condurre la tua Battle Phase in questo turno" (es. Makiu,
    // la Nebbia Magica id 366; Carica dell'Anima/Soul Charge id 59) —
    // per-proprietario, per-turno: gameState.skipBattlePhaseFor,
    // azzerato ad ogni cambio turno (changeTurn(), qui sotto).
    if (gameState.skipBattlePhaseFor && gameState.skipBattlePhaseFor[gameState.currentPlayer]) {
        addToLog(`❌ ${gameState.currentPlayer === 'player' ? 'Non puoi' : 'Il bot non può'} condurre la Battle Phase in questo turno.`);
        return;
    }
    // Grande Naso Lungo (Mostro Spirito): "se infligge danno da battaglia,
    // l'avversario salta la sua PROSSIMA Battle Phase" — a differenza di
    // skipBattlePhaseFor qui sopra (azzerato ad ogni changeTurn(), quindi
    // valido solo per il turno IN CORSO di chi lo subisce), questo store è
    // un booleano che sopravvive al cambio turno e si consuma qui, stesso
    // schema di skipMainPhase1For (enterMainPhase1 qui sopra) ma per la
    // Battle Phase — impostato da un turno PRIMA che l'avversario stesso
    // ci arrivi.
    if (gameState.skipNextBattlePhaseFor && gameState.skipNextBattlePhaseFor[gameState.currentPlayer]) {
        gameState.skipNextBattlePhaseFor[gameState.currentPlayer] = false;
        addToLog(`❌ ${gameState.currentPlayer === 'player' ? 'Salti' : 'Il bot salta'} la Battle Phase (Grande Naso Lungo)!`);
        return;
    }
    gameState.phase = 'battle';
    EventiDuello.emetti('annuncio-fase', 'Battaglia', 'Battle Phase', 'battle');
    addToLog('⚔️ Battle Phase! Clicca e trascina da un tuo mostro per attaccare.');
    // "All'inizio della Battle Phase" (es. Prigione dei Dadi, id 197) —
    // stesso schema/stesso nome dinamico di 'onBattlePhaseEnd' (già usato
    // da Bestia Mitica Cerbero id 734/Cavaliere del Miraggio id 381), solo
    // all'INIZIO invece che alla fine — ma chiamato per ENTRAMBI i lati
    // (non solo gameState.currentPlayer): una Magia Terreno come id 197
    // resta valida indipendentemente da chi sta vivendo il proprio
    // turno/la propria Battle Phase, a differenza di un Mostro/Trappola
    // "del proprio turno" tipico di onEndPhase/onStandbyPhase qui sopra.
    if (window.DuelEngine) {
        DuelEngine.firePhaseTrigger('onBattlePhaseStart', 'player');
        DuelEngine.firePhaseTrigger('onBattlePhaseStart', 'bot');
    }
    updateUI();
    // Finestra di priorità per chi non è di turno, prima degli attacchi
    // (vedi passaIlTurnoDopoLaPriorita più sotto). Il bot, nel suo turno,
    // aspetta che si chiuda prima di attaccare (DuelEngine.isPriorityWindowOpen,
    // botTurn in bot.js); il giocatore non può dichiarare attacchi mentre il
    // modale o la Catena sono aperti.
    if (window.DuelEngine && typeof DuelEngine.openPriorityWindow === 'function') {
        const nonDiTurno = Tavolo.avversario(gameState.currentPlayer);
        DuelEngine.openPriorityWindow(nonDiTurno, 'battle', () => updateUI());
    }
}

/**
 * Seconda Battle Phase (Bollettino Meteo id 1035: "puoi eseguire la Battle
 * Phase due volte in questo turno, o nel tuo prossimo se attivato durante
 * il turno avversario"). La carta scrive gameState.extraBattlePhase =
 * { owner, turn, used }; qui si legge. Si rientra in Battle Phase da Main
 * Phase 2 una volta sola, e prima di rientrare ogni proprio mostro torna a
 * poter attaccare (hasAttacked e gli attacchi extra si azzerano: è una
 * Battle Phase nuova). Il giocatore lo fa cliccando di nuovo "Battaglia"
 * nello stepper; il bot lo fa da solo (botTurn, bot.js).
 */
function canConductSecondBattlePhase(owner) {
    const eb = gameState.extraBattlePhase;
    if (!eb || eb.owner !== owner || eb.turn !== gameState.turn || eb.used) return false;
    if (gameState.currentPlayer !== owner || gameState.phase !== 'main2' || gameState.turn === 1) return false;
    if (gameState.skipBattlePhaseFor && gameState.skipBattlePhaseFor[owner]) return false;
    return true;
}

function startSecondBattlePhase(owner) {
    if (!canConductSecondBattlePhase(owner)) return false;
    gameState.extraBattlePhase.used = true;
    const campo = Tavolo.mostri(owner);
    campo.forEach((slot) => {
        if (!slot) return;
        slot.hasAttacked = false;
        slot.extraAttacksUsedThisTurn = 0;
        slot.attackedEnemyUidsTurn = null;
    });
    addToLog(`🌦️ ${owner === 'player' ? 'Conduci' : 'Il bot conduce'} una seconda Battle Phase (Previsioni Meteo)!`);
    enterBattlePhase();
    return true;
}

function enterMainPhase2() {
    clearPhaseTransitionTimeout();
    gameState.phase = 'main2';
    EventiDuello.emetti('annuncio-fase', 'Main Phase 2');
    addToLog('⚡ Main Phase 2');
    if (canConductSecondBattlePhase('player')) {
        addToLog('🌦️ Puoi condurre una seconda Battle Phase: clicca di nuovo "Battaglia".');
    }
    updateUI();
}

function enterEndPhase() {
    clearPhaseTransitionTimeout();
    // Catturato PRIMA di sovrascrivere gameState.phase qui sotto: serve
    // per sapere se questa End Phase arriva DAVVERO dalla Battle Phase
    // (non da un Main Phase 1 senza combattimento) — vedi
    // 'onBattlePhaseEnd' più sotto.
    const wasInBattlePhase = gameState.phase === 'battle';
    gameState.phase = 'end';
    EventiDuello.emetti('annuncio-fase', 'Fine', 'End Phase');
    addToLog('🏁 End Phase');
    // Waboku (id 503) protegge solo "in questo turno": la barriera e i
    // due effetti di battaglia devono sparire appena inizia la End Phase,
    // non restare visibili durante l'attesa del cambio turno. changeTurn
    // continua comunque ad azzerarli come rete di sicurezza.
    gameState.noBattleDamageFor = {};
    gameState.noBattleDestructionFor = {};
    gameState.wabokuProtectionUidFor = {};
    tickContinuousEffectDurations();
    // 637 Tribù dei D./153 Notte Meccanica: "considerati di Tipo X fino
    // alla End Phase" — gameState.raceOverridesUntilEndOfTurn (array di
    // {card, originalRace}, popolato da ctx.overrideRaceUntilEndOfTurn in
    // duel-engine.js) ripristina qui il Tipo originale di ogni carta
    // coinvolta, poi svuota la lista.
    if (gameState.raceOverridesUntilEndOfTurn && gameState.raceOverridesUntilEndOfTurn.length > 0) {
        gameState.raceOverridesUntilEndOfTurn.forEach(({ card, originalRace }) => { card.race = originalRace; });
        gameState.raceOverridesUntilEndOfTurn = [];
        addToLog('🔄 Il Tipo dei mostri coinvolti torna quello originale.');
    }
    // Tribù dei D. (id 637): il floodgate che estendeva l'override anche
    // ai mostri Evocati DOPO l'attivazione (vedi fireTrigger, duel-engine.js)
    // smette di valere qui, stessa fine turno del resto.
    gameState.raceOverrideFloodgateFor = {};
    // Ultimo Turno (id 341): il verdetto si valuta qui, alla End Phase
    // DELLO STESSO turno in cui è stata attivata — non nell'onEndPhase
    // della carta stessa, perché essendo una Trappola Normale è già
    // finita nel Cimitero non appena si è risolta (una carta lì non
    // riceve mai trigger di fase). gameState.pendingUltimateTurnCheck
    // (impostato da activate(), card-effects.js) porta con sé forTurn:
    // il numero di turno al momento dell'attivazione, per assicurarsi che
    // sia DAVVERO la End Phase dello stesso turno (non una successiva,
    // se per qualche motivo il flag non venisse ripulito).
    if (gameState.pendingUltimateTurnCheck && gameState.pendingUltimateTurnCheck.forTurn === gameState.turn) {
        const check = gameState.pendingUltimateTurnCheck;
        gameState.pendingUltimateTurnCheck = null;
        const playerHasMonster = gameState.playerMonsterField.some((s) => s);
        const botHasMonster = gameState.botMonsterField.some((s) => s);
        if (playerHasMonster && !botHasMonster) {
            addToLog('⏳ Ultimo Turno: solo il tuo mostro resta sul Terreno. Vittoria!');
            endDuel(true);
            return;
        }
        if (botHasMonster && !playerHasMonster) {
            addToLog('⏳ Ultimo Turno: solo il mostro del bot resta sul Terreno. Il bot vince!');
            endDuel(false);
            return;
        }
        addToLog('⏳ Ultimo Turno: nessuno dei due resta da solo sul Terreno. Pareggio!');
        endDuel('draw');
        return;
    }
    // Necropaura Oscura (id 891): "equipaggiala a 1 mostro scoperto
    // avversario e prendine il controllo", alla END PHASE dello STESSO
    // turno in cui è stata distrutta dall'avversario — vedi onDestroy/
    // gameState.pendingNecrofearRevival (card-effects.js). Stesso
    // principio già usato qui sopra per Ultimo Turno: una carta nel
    // Cimitero non riceve mai i normali trigger di fase, quindi il
    // controllo va fatto esplicitamente qui, non con un hook sulla carta.
    if (gameState.pendingNecrofearRevival && window.DuelEngine) {
        Object.keys(gameState.pendingNecrofearRevival).forEach((uid) => {
            const pending = gameState.pendingNecrofearRevival[uid];
            delete gameState.pendingNecrofearRevival[uid];
            if (pending.forTurn !== gameState.turn) return;
            const owner = pending.owner;
            const opponent = Tavolo.avversario(owner);
            const grave = Tavolo.cimitero(owner);
            const graveIdx = grave.findIndex((c) => c.uid === uid);
            if (graveIdx === -1) return; // non più nel Cimitero (bandita/rimescolata/ecc. nel frattempo)
            const oppField = Tavolo.mostri(Tavolo.avversario(owner));
            // Il bersaglio lo sceglie chi controlla la carta: prendersi il
            // mostro sbagliato e' l'unico modo di sprecare questo effetto.
            // I candidati partono ordinati per ATK decrescente perche' e'
            // quello che il codice sceglieva da solo, ed e' ancora quello
            // che prende il bot (primo della lista).
            const candidati = [];
            oppField.forEach((slot, i) => {
                if (!slot || slot.isFaceDown) return;
                candidati.push({ owner: opponent, index: i, zone: 'monster', card: slot.card, slot: slot });
            });
            if (candidati.length === 0) return; // nessun mostro scoperto avversario da bersagliare
            // Necrovalley (id 890): la carta non può lasciare il Cimitero
            // per equipaggiarsi. Vedi ACTIONS.graveyardMoveNegated.
            if (DuelEngine.makeContext(owner, { card: grave.find((c) => c.uid === uid) }).graveyardMoveNegated(owner)) return;
            candidati.sort((a, b) => DuelEngine.getEffectiveAtk(b.card) - DuelEngine.getEffectiveAtk(a.card));
            // game-flow.js non e' una IIFE e non importa nulla: l'helper si
            // legge da window, con una guardia perche' questa e' l'unica
            // chiamata a CardEffectsShared fuori da js/engine/card-effects*.js.
            const scegli = window.CardEffectsShared && window.CardEffectsShared.chooseFieldCardTarget;
            if (!scegli) return;
            const ctx = DuelEngine.makeContext(owner, {});
            scegli(ctx, candidati, {
                title: '🃏 Paura Oscura',
                text: 'Scegli il mostro avversario da equipaggiare e di cui prendere il controllo.'
            }, (scelto) => {
                // Tutto si ricontrolla QUI: fra l'apertura del picker e il
                // click il Cimitero e il Terreno possono essere cambiati,
                // e questo gira in End Phase, non dentro un'attivazione.
                const idx = grave.findIndex((c) => c.uid === uid);
                if (idx === -1) return;
                const targetSlot = oppField[scelto.index];
                if (!targetSlot || targetSlot.card.uid !== scelto.card.uid) return;
                const stSlotIndex = DuelEngine.findFreeSTSlot(owner);
                if (stSlotIndex === -1) return; // nessuna zona Magia/Trappola libera
                const targetCard = targetSlot.card;
                const [card] = grave.splice(idx, 1);
                card._necrofearControlledUid = targetCard.uid;
                const stField = Tavolo.magieTrappole(owner);
                stField[stSlotIndex] = { card: card, isFaceDown: false };
                // permanent:true — il controllo NON deve tornare da solo a
                // fine turno (a differenza di Cambio di Cuore): dura finché
                // questa carta resta equipaggiata (vedi
                // onSTDestroyed/onBanished/onReturnedToHandSelf, card-effects.js).
                DuelEngine.actions.takeControl(owner, opponent, scelto.index, true);
                addToLog(`🃏 Paura Oscura si equipaggia a ${targetCard.name} e ne prende il controllo!`);
            });
        });
    }
    if (window.DuelEngine) {
        DuelEngine.processTemporaryBanishmentReturns('endphase', gameState.currentPlayer);
        DuelEngine.processNoDamageExpiry();
        DuelEngine.processSelfDestructAtOpponentEndPhase(gameState.currentPlayer);
        DuelEngine.processDelayedDestroyAtOpponentEndPhase(gameState.currentPlayer);
        DuelEngine.firePhaseTrigger(DuelEngine.TRIGGER.ON_END_PHASE, gameState.currentPlayer);
        // "Alla fine della Battle Phase, se questa carta ha combattuto"
        // (es. Bestia Mitica Cerbero id 734, Cavaliere del Miraggio id
        // 381 — "ha attaccato O È STATA attaccata") — SOLO se questo End
        // Phase arriva davvero dalla Battle Phase. Su ENTRAMBI i lati (a
        // differenza di ON_END_PHASE qui sopra, solo il proprietario di
        // turno): un mostro può aver combattuto anche da difensore,
        // quindi appartenere all'altro giocatore. Handler generico
        // 'onBattlePhaseEnd', riusa firePhaseTrigger con un nome
        // dinamico invece di uno dei TRIGGER.* fissi (quella funzione
        // accetta già qualunque stringa, nessuna modifica lì necessaria).
        if (wasInBattlePhase) {
            DuelEngine.firePhaseTrigger('onBattlePhaseEnd', gameState.currentPlayer);
            DuelEngine.firePhaseTrigger('onBattlePhaseEnd', Tavolo.avversario(gameState.currentPlayer));
            // Cappelli Magici (id 363): le 2 carte del Deck travestite da
            // Mostri vanno distrutte qui — la carta Cappelli Magici stessa
            // è già finita nel Cimitero (Trappola Normale, non Continua)
            // molto prima di questo momento, quindi non può reagire da
            // sola con un proprio onBattlePhaseEnd: lista pendente globale,
            // stesso schema di gameState.pendingUltimateTurnCheck qui sopra.
            Tavolo.ordine().forEach((owner) => {
                const pending = gameState.pendingMagicalHatsDestroy && gameState.pendingMagicalHatsDestroy[owner];
                if (!pending || pending.length === 0) return;
                const field = Tavolo.mostri(owner);
                pending.forEach((uid) => {
                    const idx = field.findIndex((s) => s && s.card.uid === uid);
                    if (idx !== -1) DuelEngine.actions.destroyMonster(owner, idx);
                });
                gameState.pendingMagicalHatsDestroy[owner] = [];
            });
        }
        // Bonus ATK/DEF "fino a fine turno" (es. Drenaggio di Energia id
        // 227, Rimozione del Limitatore id 350): scadono qui, con le
        // eventuali distruzioni previste — vedi ACTIONS.clearTemporaryAtkDefBonus
        // in duel-engine.js.
        DuelEngine.actions.clearTemporaryAtkDefBonus();
        // Trappola Inversa (id 558): l'inversione dei bonus/malus ATK/DEF
        // dura solo "fino alla End Phase" — si azzera qui, stesso punto di
        // clearTemporaryAtkDefBonus qui sopra.
        gameState.reverseAtkDefBonusUntilEndOfTurn = false;
        // Restituisce ai veri proprietari i mostri presi temporaneamente
        // sotto controllo (es. Cambio di Cuore) — "fino alla tua End
        // Phase" è sempre quella dello stesso turno in cui il controllo è
        // stato preso, stessa scelta di clearTemporaryAtkDefBonus() qui
        // sopra. Vedi ACTIONS.takeControl in duel-engine.js.
        DuelEngine.processTemporaryControlReturns();
    }
    // Carta della Rovina (id 140): manda l'intera mano al Cimitero nella
    // propria End Phase — consultato una volta sola e subito azzerato,
    // stesso spirito di skipNextTurnFor in changeTurn() qui sotto.
    if (gameState.discardHandAtEndPhaseFor && gameState.discardHandAtEndPhaseFor[gameState.currentPlayer]) {
        gameState.discardHandAtEndPhaseFor[gameState.currentPlayer] = false;
        const owner = gameState.currentPlayer;
        const hand = Tavolo.mano(owner);
        const graveyard = Tavolo.cimitero(owner);
        if (hand.length > 0) {
            graveyard.push(...hand.splice(0, hand.length));
            addToLog(`🗑️ ${owner === 'player' ? 'Mandi' : 'Il bot manda'} l'intera mano al Cimitero (Carta dell'Oblio)!`);
        }
    }
    updateUI();

    // Limite di carte in mano (regole.html, Capitolo 2/3): chi finisce il
    // turno con più di MAX_HAND_SIZE carte deve scartare fino a tornarci
    // PRIMA che il turno passi. Il bot lo fa da solo, in automatico; il
    // giocatore sceglie lui stesso cosa scartare (vedi
    // startHandDiscardSelection in js/engine/actions.js) — in quel caso il timer
    // che cambia turno riparte solo a scelta completata, non su un tempo
    // fisso, esattamente come già succede per l'Evocazione Tributo.
    const handKey = Tavolo.chiave(gameState.currentPlayer, 'Hand');
    const stKey = Tavolo.chiave(gameState.currentPlayer, 'STField');
    // Carte Infinite (id 307): "non c'è alcun limite al numero di carte
    // nella mano dei giocatori" — sopprime lo scarto per eccesso mentre è
    // scoperta sul Terreno di CHI sta terminando il turno (stesso spirito
    // di "regola vera": la carta annulla il limite per ENTRAMBI, ma qui
    // basta controllarla dal lato di chi in questo momento supererebbe il
    // limite, dato che il motore applica il controllo un giocatore alla
    // volta).
    const hasInfiniteCards = (gameState[stKey] || []).some((s) => s && !s.isFaceDown && s.card.id === 307);
    const excess = hasInfiniteCards ? 0 : gameState[handKey].length - MAX_HAND_SIZE;
    if (excess > 0) {
        // Lo sceglie la persona davanti allo schermo; senza interfaccia
        // (nessun ascoltatore) non c'è nessuno a cui chiederlo, e il turno
        // passa come prima.
        if (Tavolo.ePersona(gameState.currentPlayer) && EventiDuello.ascoltato('scarto-fine-turno')) {
            EventiDuello.attendi('scarto-fine-turno', excess, () => {
                passaIlTurnoDopoLaPriorita(700);
            });
            return;
        }
        // Scarta da sola solo l'IA, con lo stesso comando della persona
        // ('scartaFineTurno'): così, a passo comune, lo scarto viaggia.
        if (Tavolo.eIA(gameState.currentPlayer)) {
            const diTurno = gameState.currentPlayer;
            const scarta = () => autoDiscardHandExcess(diTurno, excess, () => passaIlTurnoDopoLaPriorita(1500));
            // A passo comune ogni comando parte a duello fermo, e qui siamo
            // ancora DENTRO il comando 'fase' che ha portato alla End Phase:
            // lo scarto parte appena quello è concluso. L'altro client, nello
            // stesso punto, lo sta aspettando (scartoFineTurnoAtteso qui sotto).
            if (typeof PassoComune !== 'undefined' && PassoComune.attivo()) setTimeout(scarta, 0);
            else scarta();
            return;
        }
        // Il posto remoto, a passo comune (js/engine/passo-comune.js): quali
        // carte scartare lo decide l'altro client, e il suo comando arriverà.
        // Il turno passa solo dopo, come per la persona. (Nel Multiplayer di
        // prima lo scarto arrivava come fotografia di stato e il turno
        // passava subito: vedi performHandDiscard.)
        if (Tavolo.eRemoto(gameState.currentPlayer) && typeof PassoComune !== 'undefined' && PassoComune.attivo()) {
            scartoFineTurnoAtteso = { posto: gameState.currentPlayer, poi: () => passaIlTurnoDopoLaPriorita(700) };
            return;
        }
    }

    passaIlTurnoDopoLaPriorita(1500);
}

/**
 * Il seguito di uno scarto di fine turno che il posto remoto deve ancora
 * fare (vedi enterEndPhase): lo consuma eseguiScartoFineTurno
 * (evocazioni.js) quando il comando arriva.
 */
let scartoFineTurnoAtteso = null;

/** Chiamata a scarto fatto: se quel posto era atteso, il turno riparte. */
function consumaScartoFineTurnoAtteso(posto) {
    const atteso = scartoFineTurnoAtteso;
    if (!atteso || atteso.posto !== posto) return;
    scartoFineTurnoAtteso = null;
    atteso.poi();
}

/**
 * Prima che il turno passi, chi NON è di turno ha un'ultima occasione per
 * un Effetto Veloce (DuelEngine.openPriorityWindow, duel-engine.js): se ne
 * ha uno utilizzabile gli viene offerto, altrimenti si prosegue subito e
 * il cambio turno parte esattamente come prima. Uno dei tre momenti della
 * finestra di priorità, insieme a Standby Phase e inizio Battle Phase.
 */
function passaIlTurnoDopoLaPriorita(delay) {
    const nonDiTurno = Tavolo.avversario(gameState.currentPlayer);
    if (window.DuelEngine && typeof DuelEngine.openPriorityWindow === 'function') {
        DuelEngine.openPriorityWindow(nonDiTurno, 'end', () => schedulePhaseTransition(changeTurn, delay));
        return;
    }
    schedulePhaseTransition(changeTurn, delay);
}

/**
 * Scarto automatico dell'IA (dal posto `owner`) quando supera il limite di
 * mano a fine turno (vedi enterEndPhase qui sopra) — nessuna vera IA di
 * scelta: scarta le ultime carte in mano (le più recenti pescate, in fondo
 * all'array), la stessa semplificazione "nessun criterio di valore"
 * documentata altrove in questo motore per le scelte automatiche del bot.
 */
function autoDiscardHandExcess(owner, excess, poi) {
    const mano = Tavolo.mano(owner);
    addToLog(`🗑️ ${owner === 'player' ? 'Hai' : 'Il bot ha'} più di ${MAX_HAND_SIZE} carte in mano: ${owner === 'player' ? 'scarti' : 'scarta'} ${excess} cart${excess > 1 ? 'e' : 'a'}.`);
    // Le ultime carte in mano (nessun criterio di valore, comportamento
    // invariato), con lo stesso comando della persona: eseguiScartoFineTurno
    // (evocazioni.js) passa da ctx.discardChosenFromHand, quindi scattano
    // def.onSentToGraveyardFromHand (Roc dalla Valle della Foschia id 781)
    // e gli altri avvisi. Le posizioni accompagnano gli uid per una carta
    // costruita a mano che non ne ha uno.
    const indici = [];
    for (let i = mano.length - excess; i < mano.length; i++) indici.push(i);
    Comandi.esegui(owner, {
        tipo: 'scartaFineTurno',
        carte: indici.map((i) => (mano[i] && mano[i].uid !== undefined ? mano[i].uid : null)),
        indici: indici
    }, { dopo: poi });
}

function hasExodiaAssembled(hand) {
    return EXODIA_PIECE_IDS.every((pieceId) => hand.some((card) => card.id === pieceId));
}

function hasDestinyBoardComplete(owner) {
    const stField = Tavolo.magieTrappole(owner);
    return DESTINY_BOARD_CARD_IDS.every((id) => stField.some((slot) => slot && !slot.isFaceDown && slot.card.id === id));
}

/**
 * Come hasExodiaAssembled() qui sopra, ma controlla il Cimitero invece
 * della mano — usata da "Contratto con Exodia" (id 161, card-effects.js), che
 * richiede tutti e 5 i pezzi nel Cimitero, non in mano. Non collegata a
 * checkGameOver(): la vittoria automatica resta SOLO per i pezzi in mano,
 * come da regola vera (id 161 li manda al Cimitero apposta per pagare il
 * proprio costo, non per vincere).
 */
function hasExodiaInGraveyard(owner) {
    const graveyard = Tavolo.cimitero(owner);
    return EXODIA_PIECE_IDS.every((pieceId) => graveyard.some((card) => card.id === pieceId));
}

/**
 * Punto condiviso da OGNI condizione di vittoria istantanea/alternativa
 * (Exodia, Destiny Board, Elefante Volante — vedi checkGameOver qui sotto,
 * che le richiama tutte): imposta il guardrail anti-rientranza, aspetta la
 * cinematica dedicata (evento 'vittoria-istantanea': game-flow.js la
 * suona, con un filmato se esiste video/vittorie/<tipo>.mp4, altrimenti una
 * sequenza CSS — vedi FX.playInstantWinCinematic) e SOLO alla fine
 * registra il messaggio e dichiara la vittoria vera con endDuel(). Senza
 * interfaccia l'attesa finisce subito. Una FUTURA vittoria istantanea deve
 * solo chiamare questa, non reinventare guardrail/log/endDuel da capo.
 *
 * gameState.instantWinCinematicPlaying blocca chiamate rientranti a
 * checkGameOver() mentre la cinematica gira (updateUI(), che la richiama,
 * viene invocata molto spesso durante il duello) — non va mai resettato
 * esplicitamente: endDuel() imposta gameState.gameOver, che fa uscire
 * checkGameOver() dal SUO PRIMO controllo, prima ancora di arrivare a
 * leggere questo flag.
 *
 * Spostata qui da game-flow.js (nucleo senza testa): la cinematica è
 * disegno, ma il guardrail, la Sfida e la fine del duello sono regole.
 */
function triggerInstantWin(kind, logMessage, playerWon) {
    gameState.instantWinCinematicPlaying = true;
    // Sfide di tipo 'winInstantly' (js/data/challenges-db.js): `kind` è
    // già il nome della condizione, quindi una sfida futura su una NUOVA
    // vittoria alternativa non richiede di tornare qui — basta che quella
    // vittoria passi da questa funzione, come devono fare tutte.
    if (playerWon === true && window.ChallengeTracker) {
        ChallengeTracker.recordProgress('winInstantly', { kind: kind });
    }
    EventiDuello.attendi('vittoria-istantanea', kind, playerWon, () => {
        addToLog(logMessage);
        endDuel(playerWon);
    });
}

/** "5 pezzi di Exodia riuniti". */
function triggerExodiaWin(playerWon) {
    triggerInstantWin('exodiawin', playerWon
        ? '✨ Hai riunito tutti e 5 i pezzi di Exodia il Proibito! Vittoria automatica!'
        : '✨ Il bot ha riunito tutti e 5 i pezzi di Exodia il Proibito! Vittoria automatica!', playerWon);
}

/**
 * "Destiny Board completo" (Santuario Oscuro id 866 + le 4 Spirit
 * Message id 867-870, tutte scoperte insieme in zona Magia/Trappola).
 */
function triggerDestinyBoardWin(playerWon) {
    triggerInstantWin('destinyboard', playerWon
        ? '💀 Tavola del Destino è completo: "FINAL" è scritto sul tuo Terreno! Vittoria automatica!'
        : '💀 Il bot ha completato Tavola del Destino: "FINAL" è scritto sul suo Terreno! Vittoria automatica!', playerWon);
}

/** Elefante Volante (id 246): una carta sola, nessun "insieme di pezzi". */
function triggerFlyingElephantWin(playerWon) {
    triggerInstantWin('flyingelephant', '🐘 Elefante Volante infligge danno da attacco diretto dopo essere sopravvissuto nella End Phase avversaria: vittoria automatica!', playerWon);
}

function checkGameOver() {
    if (gameState.gameOver) return;
    // updateUI() chiama checkGameOver() molto spesso: mentre una
    // cinematica di vittoria istantanea sta girando (gameState.gameOver
    // ancora false, endDuel() non ancora chiamato) una nuova chiamata
    // rientrante la riavvierebbe da capo — bloccata qui, azzerata
    // implicitamente appena endDuel() imposta gameState.gameOver (il
    // controllo qui sopra prende il sopravvento).
    if (gameState.instantWinCinematicPlaying) return;

    if (hasExodiaAssembled(gameState.playerHand)) {
        triggerExodiaWin(true);
        return;
    }
    if (hasExodiaAssembled(gameState.botHand)) {
        triggerExodiaWin(false);
        return;
    }

    if (hasDestinyBoardComplete('player')) {
        triggerDestinyBoardWin(true);
        return;
    }
    if (hasDestinyBoardComplete('bot')) {
        triggerDestinyBoardWin(false);
        return;
    }

    // 246 — Elefante Volante: "se questo [sopravvivere a un effetto
    // distruttivo avversario] è successo nella End Phase dell'avversario,
    // e questa carta infligge danno da attacco diretto nel turno
    // successivo del suo controllore: vittoria automatica". L'armamento
    // (gameState.flyingElephantWinPendingUids) avviene in ACTIONS.destroyMonster
    // (duel-engine.js) quando la distruzione viene prevenuta durante la
    // End Phase avversaria; il consumo (gameState.flyingElephantWinnerOwner)
    // avviene in onDealsBattleDamage (card-effects.js, id 246) quando
    // quella stessa carta infligge danno da attacco diretto. Controllato
    // qui, non direttamente da card-effects.js, per lo stesso motivo di
    // hasExodiaAssembled qui sopra: endDuel() va chiamato da un punto
    // "pulito" della catena di updateUI(), non da metà di resolveAttack()
    // (actions.js), che dopo aver chiamato onDealsBattleDamage continua
    // ancora con la propria logica (animazioni, hasAttacked, ecc.).
    if (gameState.flyingElephantWinnerOwner) {
        const winnerOwner = gameState.flyingElephantWinnerOwner;
        gameState.flyingElephantWinnerOwner = null;
        triggerFlyingElephantWin(winnerOwner === 'player');
        return;
    }

    const playerLost = gameState.playerLP <= 0;
    const botLost = gameState.botLP <= 0;
    if (!playerLost && !botLost) return;

    // ATTENZIONE all'ordine: updateUI() termina chiamando checkGameOver(),
    // quindi la bandierina gameOver va alzata PRIMA di toccare l'interfaccia,
    // altrimenti le due funzioni si richiamano a vicenda all'infinito e la
    // schermata finale non compare mai. Per lo stesso motivo qui aggiorniamo
    // i Life Point con renderLifePoints() invece che con updateUI().
    gameState.gameOver = true;
    if (playerLost) gameState.playerLP = 0;
    if (botLost) gameState.botLP = 0;
    EventiDuello.emetti('life-points');

    // Se cadono entrambi nello stesso momento il duello è perso, come già
    // faceva la versione precedente del controllo.
    endDuel(!playerLost);
}

/**
 * 199 — "deve attaccare tutti i mostri avversari, una volta ciascuno":
 * vero se un attaccante con un obbligo ancora aperto (gameState.
 * mustAttackTargetUidsFor, popolato da grantAttackAllEnemiesOncEach in
 * card-effects.js) è ancora in campo E può ancora attaccare — in quel
 * caso la Battle Phase non può essere abbandonata. Se l'attaccante non
 * può più attaccare (distrutto, o attacchi extra esauriti) l'obbligo
 * diventa impossibile da soddisfare e smette di bloccare: coerente col
 * fatto che un attaccante rimosso a metà Battle Phase non può più agire.
 */
function hasUnfulfilledForcedAttack() {
    if (!gameState.mustAttackTargetUidsFor) return false;
    return Object.keys(gameState.mustAttackTargetUidsFor).some((attackerUid) => {
        const remaining = gameState.mustAttackTargetUidsFor[attackerUid];
        if (!remaining || remaining.size === 0) return false;
        const slot = gameState.playerMonsterField.find((s) => s && s.card.uid === attackerUid);
        return !!slot && !slot.hasAttacked;
    });
}
