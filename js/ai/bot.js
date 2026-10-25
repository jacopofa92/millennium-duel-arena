/**
 * Il turno completo dell'IA che gioca dal posto `io` ('player' o 'bot', vedi
 * js/engine/tavolo.js): pescata, Standby, Evocazione, Magie/Trappole,
 * battaglia, End Phase — con le stesse funzioni di fase che usa la persona.
 * Parte quando tocca a un posto controllato dall'IA (changeTurn, fasi.js).
 * Fino alla Priorità 3 del piano l'IA sapeva giocare solo dal posto 'bot':
 * ogni funzione di questo file riceve ora il posto da cui gioca, e chi non
 * lo passa ottiene 'bot', come prima.
 */
/** Timer dell'IA che non scade sotto al velo di pausa dell'app offline. */
function timerIA(fn, ms) {
    return (typeof PausaDuello !== 'undefined') ? PausaDuello.dopo(fn, ms) : setTimeout(fn, ms);
}

function turnoIA(io = 'bot') {
    clearPhaseTransitionTimeout();
    enterDrawPhase(false, () => {
        // Una vittoria alla pescata (Exodia: la cinematica parte subito,
        // gameOver arriva quando finisce) chiude il turno qui. Senza, l'IA
        // entrava lo stesso in Standby Phase, mentre il turno guidato dalle
        // fasi automatiche (persona, o posto remoto a passo comune) si
        // fermava: preso dal duello gemello.
        if (gameState.gameOver || gameState.instantWinCinematicPlaying) return;
        enterStandbyPhase(false);
        // Lo stesso dopo la Standby: un costo pagato lì (Scatola delle Fate,
        // 500 LP) può chiudere il duello, e endDuel ha già cancellato i timer
        // di fase — quello della Main Phase 1 qui sotto partirebbe dopo.
        if (gameState.gameOver) return;
        // Finestra di priorità per il giocatore durante la Standby Phase del
        // bot (DuelEngine.openPriorityWindow): se ha un Effetto Veloce
        // utilizzabile glielo offre, altrimenti prosegue subito. Il resto
        // del turno parte solo a finestra chiusa.
        const dopoLaStandby = (fn) => (window.DuelEngine && typeof DuelEngine.openPriorityWindow === 'function')
            ? DuelEngine.openPriorityWindow(Tavolo.avversario(io), 'standby', fn)
            : fn();
        dopoLaStandby(() => { phaseTransitionTimeout = timerIA(() => {
            enterMainPhase1();
            // PRIMA di Evocare: se in mano c'è una Magia come Buco Nero
            // (distrugge anche il proprio Terreno) e vale davvero la pena
            // attivarla ORA — vedi AI_SHARED.isMassDestructionWorthwhile —
            // lo fa subito, sul campo COM'È PRIMA di qualunque Evocazione
            // di questo turno. Senza questo passaggio il bot Evocava un
            // mostro e SUBITO DOPO lo distruggeva da solo con la stessa
            // Buco Nero nello stesso turno — segnalato dall'utente come
            // "non ha senso, al massimo prima Buco Nero e poi il mostro".
            // Ogni altra Magia/Trappola resta dove è sempre stata, DOPO
            // l'Evocazione (attemptBotSpellTrap poco più sotto): solo un
            // effetto che colpisce anche il proprio Terreno ha un motivo
            // strutturale per passare prima.
            const summonPromise = attemptBotMassDestructionBeforeSummon(io)
                .then(pausaTraMosse)
                .then(() => attemptBotTacticalSpellBeforeSummon(io))
                .then(pausaTraMosse)
                // La Difficile sa avviare anche le procedure proprie dei
                // mostri in mano (Valkyrion, Toon, Megacyber, ecc.). Prima
                // questo comando esisteva solo per il click della persona.
                .then(() => attemptBotHandSpecialSummon(io))
                .then(waitForSummonCinematics)
                .then(pausaTraMosse)
                .then(() => {
                // Come per botPerformAttacks() più sotto: aspetta la
                // RISOLUZIONE PIENA dell'Evocazione (compresa un'eventuale
                // finestra "vuoi attivare Buco Trappola?" del giocatore, che può
                // richiedere un tempo arbitrario) prima di procedere alla Battle
                // Phase — altrimenti il bot entrerebbe in battaglia dopo un
                // timer fisso anche se quel modale è ancora aperto in attesa di
                // una decisione, lasciando l'avversario "scavalcato".
                return (Tavolo.mano(io).some((card) => canUseNormalSummonQuota(io, card))) ? attemptBotSummon(io) : Promise.resolve();
            });
            summonPromise
                // Se l'Evocazione ha fatto partire un filmato o la
                // convergenza di un Livello 7+, il bot si ferma finche'
                // non finisce: continuare a giocare sotto a un'animazione
                // che copre tutto lo schermo significa far perdere al
                // giocatore quello che e' successo.
                .then(waitForSummonCinematics)
                .then(pausaTraMosse)
                // X/Y/Z e ogni futura combinazione che bandisce materiali
                // dal Terreno passano dallo stesso comando del giocatore.
                .then(() => attemptBotBanishFusion(io))
                .then(waitForSummonCinematics)
                .then(pausaTraMosse)
                // Dopo l'Evocazione (o il Set) del mostro, il bot valuta se
                // Settare Trappole e/o attivare Magie dalla mano — una vera
                // novità: prima il bot non toccava MAI le proprie Magie/
                // Trappole se non in risposta a un'azione del giocatore,
                // lasciandole morte in mano per l'intera partita. Vedi
                // attemptBotSpellTrap più sotto e js/ai/ai-medium.js /
                // js/ai/ai-hard.js per quanto ogni livello ne approfitta.
                .then(() => attemptBotSpellTrap(io))
                .then(pausaTraMosse)
                // Poi valuta se attivare PROATTIVAMENTE una propria carta
                // già Set in un turno precedente o un Ignition identitario
                // (Hard in generale; Media solo per boss esplicitamente
                // gestiti, vedi ai-medium.js).
                .then(() => attemptBotActivateSetCards(io))
                .then(pausaTraMosse)
                // Offerta Suprema e future carte equivalenti possono aver
                // riaperto l'Evocazione Normale: sfruttala nello stesso
                // turno, senza concedere una seconda mossa gratuitamente.
                .then(() => (Tavolo.mano(io).some((card) => canUseNormalSummonQuota(io, card)))
                    ? attemptBotSummon(io) : Promise.resolve())
                .then(waitForSummonCinematics)
                .then(pausaTraMosse)
                // Una Magia Terreno del GIOCATORE che "il giocatore di turno"
                // può usare (Cancello di Fusione id 887): nel suo turno il
                // bot la sfrutta come farebbe con la propria.
                .then(() => attemptBotUseTurnPlayerFieldSpell(io))
                .then(pausaTraMosse)
                // Hard rimette in Attacco i mostri difensivi dei turni
                // precedenti quando hanno un bersaglio utile o via libera
                // agli LP. La Media conserva il comportamento storico.
                .then(() => attemptBotPositionChanges(io))
                // NON un semplice setTimeout: `attendiPoi` ricontrolla le
                // cinematiche allo SCADERE dell'attesa, non solo prima di
                // farla partire. Una cinematica puo' cominciare DOPO il
                // controllo di riga 21 — una Magia del bot che Evoca
                // Specialmente un mostro con un filmato dedicato, per dire —
                // e con un'attesa fissa il bot entrava in battaglia e
                // attaccava mentre il filmato copriva ancora lo schermo:
                // esattamente il bug segnalato con il Drago Bianco Occhi
                // Blu (filmato da 6,6s contro i 2,9s di attesa fissa).
                .then(() => attendiPoi(1500))
                .then(() => {
                    // Guardia difensiva, stesso motivo di attemptBotSummon
                    // qui sotto: un'attesa scaduta in ritardo non deve mai far
                    // avanzare la Battle Phase/attaccare fuori dal vero
                    // turno del bot.
                    if (gameState.currentPlayer !== io || gameState.gameOver) return;
                    if (gameState.turn === 1) {
                        addToLog('❌ Il bot non può entrare in Battle Phase nel primo turno.');
                        return faseIA(io, 'end');
                    }
                    addToLog('🤖 Il bot entra in Battle Phase.');
                    // Attende che il banner "Battaglia" (stesso stile e stessa
                    // durata delle altre fasi, ~1.3s) finisca prima di far
                    // partire gli attacchi del bot — e, di nuovo, che non ci
                    // sia una cinematica ancora a schermo. Prima ancora,
                    // l'eventuale Effetto Veloce del giocatore all'inizio
                    // della Battle Phase deve essersi risolto.
                    return faseIA(io, 'battle').then(waitForPriorityWindow).then(() => attendiPoi(1400))
                        .then(() => {
                            if (gameState.currentPlayer !== io || gameState.gameOver) return;
                            // Anche qui: un'Evocazione Speciale durante la
                            // Battle Phase puo' far partire una cinematica,
                            // e la End Phase non deve arrivarle sopra.
                            return botPerformAttacks(0, null, io)
                                .then(waitForSummonCinematics)
                                .then(() => attendiPoi(1000))
                                // Seconda Battle Phase (Bollettino Meteo id
                                // 1035): passa da Main Phase 2 e rientra in
                                // Battaglia una volta, come farebbe il
                                // giocatore dallo stepper delle fasi.
                                .then(() => {
                                    if (gameState.currentPlayer !== io || gameState.gameOver) return;
                                    const eb = gameState.extraBattlePhase;
                                    if (!eb || eb.owner !== io || eb.turn !== gameState.turn || eb.used) return;
                                    return faseIA(io, 'main2').then(() => attendiPoi(1200)).then(() => {
                                        if (gameState.currentPlayer !== io || gameState.gameOver) return;
                                        if (!Comandi.esegui(io, { tipo: 'fase', verso: 'battle2' })) return;
                                        return attendiPoi(1400)
                                            .then(() => botPerformAttacks(0, null, io))
                                            .then(waitForSummonCinematics)
                                            .then(() => attendiPoi(1000));
                                    });
                                })
                                .then(() => {
                                    if (gameState.currentPlayer !== io || gameState.gameOver) return;
                                    return faseIA(io, 'end');
                                });
                        });
                });
        }, botMs(500)); });
    });
}

/** Il turno dell'IA dal posto 'bot': il nome storico, usato da game-flow.js e dal resto della pagina. */
function botTurn() {
    turnoIA('bot');
}

/**
 * L'IA passa alla fase `verso` ('battle', 'main2', 'end') con il comando
 * 'fase', come farebbe la persona dallo stepper. Il comando rifiuta se c'è
 * ancora una Catena o una finestra di priorità aperta: allora si riprova
 * poco dopo, invece di saltare la fase (l'IA resterebbe ferma lì). Dopo un
 * tetto di tentativi si va avanti lo stesso, come faceva l'IA prima dei
 * comandi, per non bloccare mai il duello.
 */
function faseIA(io, verso) {
    return new Promise((resolve) => {
        let tentativi = 0;
        const prova = () => {
            if (gameState.gameOver || gameState.currentPlayer !== io) { resolve(); return; }
            if (Comandi.esegui(io, { tipo: 'fase', verso: verso })) { resolve(); return; }
            if (++tentativi > 100) {
                console.warn(`IA: la fase "${verso}" resta rifiutata, si forza`);
                if (verso === 'battle') enterBattlePhase();
                else if (verso === 'main2') enterMainPhase2();
                else enterEndPhase();
                resolve();
                return;
            }
            timerIA(prova, 150);
        };
        prova();
    });
}

/**
 * Si risolve quando la finestra di priorità "a vuoto" (un Effetto Veloce
 * del giocatore all'inizio della Battle Phase del bot, vedi
 * DuelEngine.openPriorityWindow) è chiusa, Catena compresa. Senza, il bot
 * attaccherebbe mentre la Catena aperta dal giocatore si sta ancora
 * risolvendo: il modale si chiude al click, ma la risoluzione dura ancora
 * qualche secondo.
 */
function waitForPriorityWindow() {
    return new Promise((resolve) => {
        const poll = () => {
            const aperta = window.DuelEngine && typeof DuelEngine.isPriorityWindowOpen === 'function' && DuelEngine.isPriorityWindowOpen();
            if (aperta) { timerIA(poll, 150); return; }
            resolve();
        };
        poll();
    });
}

/**
 * Multiplayer a passo comune (js/engine/passo-comune.js): una mossa locale
 * parte solo a duello fermo — niente Catena, nessuna scelta aperta su uno
 * dei due client, nessun comando a metà — e fuori da lì viene rifiutata.
 * L'IA quindi aspetta prima di ogni mossa. Fuori dal passo comune (o con il
 * duello già fermo) `fn` parte SUBITO, nello stesso giro: il ritmo
 * dell'IA offline non cambia di un millisecondo.
 */
function aspettaDuelloFermo(fn) {
    if (!sceltaDelGiocatoreAperta() && (typeof PassoComune === 'undefined' || !PassoComune.attivo() || PassoComune.fermo())) { fn(); return; }
    timerIA(() => aspettaDuelloFermo(fn), 50);
}

/** Come aspettaDuelloFermo, per una mossa che torna una Promise: subito se si può, nello stesso giro. */
function quandoFermo(fn) {
    if (!sceltaDelGiocatoreAperta() && (typeof PassoComune === 'undefined' || !PassoComune.attivo() || PassoComune.fermo())) return Promise.resolve(fn());
    return new Promise((fatto) => aspettaDuelloFermo(fatto)).then(fn);
}

/**
 * La RISOLUZIONE DI UNA SCELTA DEL GIOCATORE HA LA PRECEDENZA su qualunque mossa
 * dell'IA. Una scelta aperta (un modale, un popover, i Tributi da scegliere, uno
 * scarto, una decisione in sospeso) può cambiare il campo — un mostro che
 * compare, uno che sparisce, una Posizione che cambia — e quindi cambiare cosa
 * conviene fare dopo: il bot non deve né decidere né agire finché non è chiusa.
 * Vale per OGNI mossa che passa da aspettaDuelloFermo/quandoFermo (Magie, Set,
 * Evocazioni, Fusioni, cambi di Posizione, attacchi), non solo per un effetto in
 * particolare (segnalato con il Drago Mascherato, ma il difetto era generale).
 * Chi aspetta qui non ha tetto: il giocatore ha il tempo che gli serve.
 */
function sceltaDelGiocatoreAperta() {
    if (typeof isBlockingModalOpen === 'function' && isBlockingModalOpen()) return true;
    if (window.Decisioni && typeof Decisioni.inSospeso === 'function' && Decisioni.inSospeso()) return true;
    return !!(window.gameState && gameState.pendingTributePlacement);
}

/**
 * Pausa di RITMO del bot, scalata dalla preferenza "Velocità del bot"
 * (js/ui/bot-speed.js). Solo per le pause che esistono per farsi seguire:
 * le attese con un motivo (modale aperto, cinematica in corso) non passano
 * di qui e non si accorciano mai.
 */
function botMs(ms) {
    return (window.BotSpeed && typeof BotSpeed.scale === 'function') ? BotSpeed.scale(ms) : ms;
}

/**
 * UNA MOSSA ALLA VOLTA, CHE SI CAPISCA. Ogni mossa dell'IA (un'Evocazione, una
 * Magia, un Set, una Fusione) segna di essere avvenuta con `segnaMossa()`; la
 * pausa fra una mossa e la successiva (`pausaTraMosse`) aspetta che la scena
 * sia ferma (nessuna scelta aperta, nessuna cinematica) e poi lascia un respiro
 * visibile. Se nessuna mossa è avvenuta, la pausa non c'è: un turno senza
 * niente da fare non diventa più lento. Segnalato giocando: il bot attivava due
 * Magie ed Evocava 'tutto insieme' e non si capiva cosa fosse successo.
 */
let mossaFattaDallIA = false;
function segnaMossa() { mossaFattaDallIA = true; }
function pausaTraMosse() {
    if (!mossaFattaDallIA) return Promise.resolve();
    mossaFattaDallIA = false;
    return waitForSceneSettled().then(() => new Promise((resolve) => timerIA(resolve, botMs(800))));
}

/**
 * Attiva SUBITO, prima di qualunque Evocazione di questo turno, l'unica
 * Magia in mano che (a) distrugge in massa e colpisce anche il proprio
 * Terreno (AI_SHARED.hasOwnSideCost — es. Buco Nero, non Raigeki) e (b)
 * vale davvero la pena attivare ORA secondo il campo attuale
 * (AI_SHARED.isMassDestructionWorthwhile). Guarda solo la mano, non il
 * retrocampo già Set: una Trappola così va comunque attivata dall'
 * avversario, non dal bot che l'ha Settata — qui serve solo il caso
 * "Magia in mano" che genererebbe il difetto segnalato dall'utente.
 * Nessun conteggio "una sola Magia a turno" qui: è una correzione
 * strutturale (evita di autodistruggersi il mostro appena Evocato), non
 * una nuova risorsa che il bot guadagna — resta indipendente dal budget
 * di attemptBotSpellTrap più sotto.
 */
function attemptBotMassDestructionBeforeSummon(io) {
    return new Promise((resolve) => aspettaDuelloFermo(() => {
        // Stessa guardia di attemptBotSummon/attemptBotSpellTrap: mai
        // agire fuori dal vero turno del bot.
        if (gameState.currentPlayer !== io || gameState.gameOver || !window.AI_SHARED) { resolve(); return; }
        const hand = Tavolo.mano(io);
        const candidato = hand
            .map((card, handIndex) => ({ card: card, handIndex: handIndex }))
            .find((e) => e.card.type === 'spell'
                && window.DuelEngine && DuelEngine.canActivate(io, 'hand', e.handIndex)
                && AI_SHARED.hasOwnSideCost(e.card)
                && AI_SHARED.isMassDestructionWorthwhile(e.card, gameState, io));
        if (!candidato) { resolve(); return; }
        const started = Comandi.esegui(io, { tipo: 'attiva', zona: 'hand', indice: candidato.handIndex, carta: candidato.card.uid });
        if (!started) { resolve(); return; } // difensivo: canActivate era già stato controllato sopra
        segnaMossa();
        waitForBotChainToClear(() => { updateUI(); resolve(); });
    }));
}

/**
 * Solo il livello che espone la decisione tattica (oggi Hard) può usare una
 * Magia di pescata/ricerca prima dell'Evocazione Normale. Si aspetta la Chain
 * completa: il mostro appena ottenuto deve essere davvero in mano prima che
 * chooseSummon valuti le opzioni del turno.
 */
function attemptBotTacticalSpellBeforeSummon(io) {
    return new Promise((resolve) => aspettaDuelloFermo(() => {
        if (gameState.currentPlayer !== io || gameState.gameOver || !window.BotAI) { resolve(); return; }
        const decision = BotAI.choosePreSummonSpellAction(gameState, io);
        if (!decision) { resolve(); return; }
        const started = Comandi.esegui(io, {
            tipo: 'attiva', zona: 'hand', indice: decision.handIndex,
            carta: decision.card && decision.card.uid
        });
        if (!started) { resolve(); return; }
        segnaMossa();
        waitForBotChainToClear(() => { updateUI(); resolve(); });
    }));
}

/**
 * Chiede a BotAI (js/ai/ai-controller.js — il livello di difficoltà
 * attivo in gameState.botDifficulty) quale mostro evocare, poi esegue
 * DAVVERO quella decisione (animazioni, stato). Ritorna una Promise che
 * si risolve quando l'Evocazione (compresa un'eventuale finestra di
 * risposta del giocatore) è DAVVERO finita — vedi botTurn(), che aspetta
 * questa Promise prima di passare alla Battle Phase.
 */
/**
 * Usa la Magia Terreno del giocatore quando il suo testo la concede a
 * chiunque sia di turno (def.canActivateAsTurnPlayer/activateAsTurnPlayer,
 * oggi solo Cancello di Fusione id 887). Il bot la usa sempre quando può:
 * Evocare per Fusione è quasi sempre una mossa che conviene. Torna una
 * Promise che aspetta un attimo, per lasciar partire l'effetto visivo
 * della Fusione prima della mossa successiva.
 */
function attemptBotUseTurnPlayerFieldSpell(io) {
    return quandoFermo(() => {
    if (gameState.currentPlayer !== io || gameState.gameOver || !window.DuelEngine) return Promise.resolve();
    // I controlli (Terreno scoperto, carta che lo concede, condizione)
    // li fa l'esecutore del comando: se torna false non è successo nulla.
    if (!Comandi.esegui(io, { tipo: 'usaTerrenoAltrui' })) return Promise.resolve();
    segnaMossa();
    return new Promise((resolve) => timerIA(resolve, 1200)).then(waitForSummonCinematics);
    });
}

/** Combina dall'Extra Deck solo la linea scelta dal livello IA corrente. */
function attemptBotBanishFusion(io) {
    return quandoFermo(() => {
        if (gameState.currentPlayer !== io || gameState.gameOver || !window.BotAI) return Promise.resolve();
        const decision = BotAI.chooseBanishFusion(gameState, io);
        if (!decision) return Promise.resolve();
        segnaMossa();
        Comandi.esegui(io, {
            tipo: 'fusioneBandendo',
            extraDeck: decision.extraDeckIndex,
            materiali: decision.materialFieldIndices
        });
        return new Promise((resolve) => timerIA(resolve, 1200));
    });
}

function attemptBotPositionChanges(io) {
    return new Promise((resolve) => {
        if (gameState.currentPlayer !== io || gameState.gameOver || !window.BotAI) { resolve(); return; }
        const indici = BotAI.choosePositionChanges(gameState, io);
        let posizione = 0;
        const prossimo = () => aspettaDuelloFermo(() => {
            if (gameState.currentPlayer !== io || gameState.gameOver || posizione >= indici.length) { resolve(); return; }
            const indice = indici[posizione++];
            Comandi.esegui(io, { tipo: 'posizione', casella: indice });
            segnaMossa();
            waitForBotChainToClear(() => pausaTraMosse().then(prossimo));
        });
        prossimo();
    });
}

function attemptBotSummon(io) {
    return quandoFermo(() => evocaSeConviene(io));
}

/** Esegue l'eventuale auto-Evocazione Speciale scelta dal livello IA. */
function attemptBotHandSpecialSummon(io) {
    return quandoFermo(() => {
        if (gameState.currentPlayer !== io || gameState.gameOver || !window.BotAI) return Promise.resolve();
        const decision = BotAI.chooseHandSpecialSummon(gameState, io);
        if (!decision) return Promise.resolve();
        const started = Comandi.esegui(io, {
            tipo: 'specialeDaMano',
            carta: decision.card.uid,
            mano: decision.handIndex,
            posizione: 'attack'
        });
        if (started) { segnaMossa(); updateUI(); }
        return Promise.resolve();
    });
}

function evocaSeConviene(io) {
    // Guardia difensiva: se un setTimeout/Promise di un botTurn() precedente
    // arriva TARDI (es. il duello è stato resettato/ricaricato dal
    // sandbox Duello Demo mentre la catena era ancora in volo, o
    // gameState.currentPlayer è già tornato al giocatore per qualunque
    // altro motivo), questa funzione non deve mai agire fuori dal vero
    // turno del bot — bug reale scoperto: senza questo controllo, il bot
    // poteva Evocare/attivare carte durante il turno del giocatore.
    if (gameState.currentPlayer !== io || gameState.gameOver) return Promise.resolve();
    const decision = window.BotAI ? BotAI.chooseSummon(gameState, io) : null;
    if (!decision) return Promise.resolve();
    return botSummonMonster(decision.card, decision.tributeIndices, decision.emptySlotHint, decision.position, decision.faceDown, io);
}

/**
 * Evoca (o Setta in Difesa coperta) il mostro scelto dall'IA, con gli
 * stessi comandi della persona: 'tributa' per gli eventuali Sacrifici, poi
 * 'evoca' (vedi js/engine/comandi.js). Un'unica versione della mossa per
 * tutti — prima l'IA ne aveva una sua, che fra l'altro poteva Evocare un
 * mostro SCOPERTO in Difesa, cosa che un'Evocazione Normale non permette
 * (in Difesa si Setta coperto; scoperto in Difesa resta solo dove una
 * carta lo impone, Luce dell'Intervento id 634 o un mostro che non si può
 * Settare: lo decide l'esecutore).
 *
 * `position`/`faceDown` arrivano da AI_SHARED.decideMonsterPosture
 * (js/ai/ai-shared.js): qualunque Difesa diventa un Set. Se tributeIndices
 * non è vuoto, sacrifica prima quei mostri (con animazione) e poi occupa
 * la prima casella liberata. Ritorna una Promise che si risolve solo dopo
 * che l'eventuale finestra di risposta dell'avversario (es. Buco Trappola)
 * si è chiusa per davvero.
 */
function botSummonMonster(card, tributeIndices, emptySlotHint, position, faceDown, io = 'bot') {
    segnaMossa();
    position = position === 'defense' ? 'defense' : 'attack';
    // Un'Evocazione Tributo si fa sempre scoperta in Attacco (regola generale,
    // vedi eseguiEvocazioneNormale in evocazioni.js): l'IA non deve nemmeno
    // pagare il Tributo pensando di Settare il mostro. Segnalato giocando: il
    // bot sacrificava mostri per un Drago Bianco Occhi Blu coperto in Difesa.
    const defTributo = window.DuelEngine && DuelEngine.getDefinition(card.id);
    if (tributeIndices && tributeIndices.length > 0 && !(defTributo && defTributo.canTributeSet)) position = 'attack';
    const customDef = window.DuelEngine && DuelEngine.getDefinition(card.id);
    if (customDef && typeof customDef.beginCustomNormalSummon === 'function') {
        return new Promise((resolve) => {
            customDef.beginCustomNormalSummon(DuelEngine.makeContext(io, {
                card,
                handIndex: Tavolo.mano(io).indexOf(card)
            }));
            // Le scelte dell'IA sono sincrone; la finestra di risposta
            // dell'Evocazione continua poi nel normale passo comune.
            resolve();
        });
    }
    // Capro Espiatorio (id 434): in quel turno si può solo Settare; "puoi
    // controllarne solo 1 scoperto" (id 899) con una copia già scoperta:
    // idem. L'IA ripiega sul Set invece di far rifiutare la mossa.
    if (position === 'attack' && window.DuelEngine
        && (DuelEngine.isSummonBannedThisTurn(io) || DuelEngine.isFaceUpDuplicateBlocked(io, card))) {
        position = 'defense';
    }
    // Il Drago Alato di Ra (id 472): "puoi pagare Life Points fino a
    // restarne con 100" è un "puoi" — lato persona lo decide un popover
    // (maybeAskRaLpChoice, actions.js), qui il bot sceglie QUANTO pagare
    // (AI_SHARED.raLpDaPagare: un obiettivo di ATK, una soglia di LP da non
    // toccare e l'eccezione "scacco", vedi il commento sulla funzione).
    // Conosce già i Tributi: i mostri sacrificati non contano come
    // attaccanti pronti. È un NUMERO (0 = non paga) e viaggia nel comando
    // ('pagaLpRa'), che lo rimette su card._raPayLp per
    // CardEffects.register(472).onSummon.
    const pagaLpRa = card.id === 472
        ? (window.AI_SHARED ? AI_SHARED.raLpDaPagare(gameState, io, { tributi: tributeIndices || [] }) : 0)
        : undefined;
    return new Promise((resolve) => {
        const evoca = (casella) => {
            if (casella === -1 || casella === undefined) { resolve(); return; }
            // La posizione in mano si legge ADESSO, a Sacrifici fatti: è il
            // ripiego per una carta senza uid (vedi Comandi.indiceInMano).
            const comando = { tipo: 'evoca', carta: card.uid, mano: Tavolo.mano(io).indexOf(card), casella: casella, posizione: position };
            if (pagaLpRa !== undefined) comando.pagaLpRa = pagaLpRa;
            Comandi.esegui(io, comando, { alTermine: resolve });
        };
        if (!tributeIndices || tributeIndices.length === 0) {
            evoca(emptySlotHint);
            return;
        }
        // La prima casella che il Sacrificio libera: è lì che va il mostro.
        const liberata = tributeIndices.find((idx) => Tavolo.mostri(io)[idx]);
        Comandi.esegui(io, { tipo: 'tributa', indici: tributeIndices, perCarta: card.uid, attesaMs: botMs(700) }, {
            dopo: () => evoca(liberata === undefined ? -1 : liberata)
        });
    });
}

async function botPerformAttacks(giro = 0, soloUids = null, io = 'bot') {
    // Guardia difensiva, stesso motivo di attemptBotSummon qui sopra.
    if (gameState.currentPlayer !== io || gameState.gameOver) return;
    // Quanti attacchi sono partiti in questo giro: se almeno uno è partito
    // e qualche mostro può ancora attaccare (attacco extra: Hayabusa,
    // Sacerdote di Asura, Ben Kei...), alla fine si fa un altro giro. Senza,
    // il bot usava sempre e solo il primo attacco di ogni mostro.
    // Nei giri successivi al primo tornano in gioco SOLO i mostri che hanno
    // attaccato nel giro prima (`soloUids`): chi aveva rinunciato non deve
    // ripagare un costo d'attacco (LP, Sacrificio) per rinunciare di nuovo.
    const hannoAttaccato = new Set();
    if (window.DuelEngine && DuelEngine.cannotAttack(io)) {
        addToLog('🚫 I mostri del bot non possono attaccare in questo momento (es. Spada Rivelatrice).');
        return;
    }
    // Un mostro in Posizione di Difesa non può mai attaccare — vedi anche
    // il controllo centralizzato in resolveAttack() (actions.js), che
    // resta comunque il vero cancello di sicurezza; qui filtrato PRIMA
    // così l'IA non spreca la sua valutazione (chooseAttackTarget) su un
    // candidato che verrebbe comunque respinto.
    let attackers = Tavolo.mostri(io).map((slot, index) => ({ slot, index })).filter(item => item.slot && !item.slot.hasAttacked && item.slot.position === 'attack'
        && (!soloUids || soloUids.has(item.slot.card.uid)));
    if (window.BotAI) {
        attackers = BotAI.orderAttackers(attackers, io);
        const difensori = Tavolo.mostri(Tavolo.avversario(io))
            .map((slot, index) => ({ slot, index })).filter((item) => item.slot);
        const letale = BotAI.estimateLethal(attackers, difensori, Tavolo.lp(Tavolo.avversario(io)), io);
        if (letale.possible) BotAI.explainDecision('linea-letale', { dannoStimato: letale.damage, attaccanti: attackers.length });
    }
    for (let posizioneAttaccante = 0; posizioneAttaccante < attackers.length; posizioneAttaccante++) {
        const attackerItem = attackers[posizioneAttaccante];
        // Se un attacco precedente ha già chiuso il duello, non restiamo
        // ad aspettare gli attacchi rimanenti sotto la schermata finale.
        if (gameState.gameOver) return;
        // PRIMA di scegliere il bersaglio: l'attacco di prima può aver fatto
        // partire una scelta del giocatore (Drago Mascherato che cerca un
        // Drago nel Deck, una finestra di risposta) o una cinematica. Il campo
        // avversario va guardato DOPO, quando la scena è ferma: decidere prima
        // portava a un attacco diretto 'al campo vuoto' mentre il giocatore
        // stava ancora scegliendo il mostro che sarebbe comparso.
        await waitForSceneSettled();
        if (gameState.currentPlayer !== io || gameState.gameOver) return;
        // La scelta appena risolta può aver cambiato anche il MIO campo e le regole
        // d'attacco (un mostro tolto o girato in Difesa, "non puoi attaccare").
        // L'elenco degli attaccanti era stato fatto all'inizio: si ricontrolla
        // l'attaccante com'è ADESSO, invece di usarlo com'era.
        if (window.DuelEngine && DuelEngine.cannotAttack(io)) return;
        const slotAdesso = Tavolo.mostri(io)[attackerItem.index];
        if (!slotAdesso || slotAdesso.card.uid !== attackerItem.slot.card.uid || slotAdesso.position !== 'attack' || slotAdesso.hasAttacked) continue;
        attackerItem.slot = slotAdesso;
        // "Questa carta non può dichiarare un attacco a meno che tu non
        // sacrifichi 1 mostro" (es. Guerriero Pantera, id 399 —
        // def.requiresTributeToAttack): costo da pagare PRIMA di dichiarare
        // l'attacco, stesso principio di executeAttack() in actions.js per
        // il giocatore. L'IA sacrifica il proprio mostro più debole (mai
        // se stesso, escluso dal filtro qui sotto), o salta del tutto
        // questo attaccante se non ha nessun altro mostro da sacrificare —
        // non ha senso indebolire il proprio campo per un attacco che
        // potrebbe anche perdere.
        const attackerDef = window.DuelEngine && DuelEngine.getDefinition(attackerItem.slot.card.id);
        // def.canDeclareAttack (Drago della Caverna id 1040): stessa
        // condizione di resolveAttack, controllata PRIMA di pagare costi o
        // scegliere bersagli, così il bot non paga LP o Sacrifici per un
        // attacco che verrebbe poi rifiutato.
        if (attackerDef && typeof attackerDef.canDeclareAttack === 'function'
            && !attackerDef.canDeclareAttack(DuelEngine.makeContext(io, { card: attackerItem.slot.card, slotIndex: attackerItem.index }))) continue;
        // "Paga N Life Points per dichiarare un attacco" (es. Drago Toon
        // Occhi Blu id 123, Manga Ryu-Ran id 606) — stesso principio di
        // requiresTributeToAttack qui sotto, ma senza bisogno di scegliere
        // un bersaglio: il bot salta questo attaccante se non ha
        // abbastanza LP da spendere.
        // I costi d'attacco li paga il comando 'attacca' (eseguiAttacco,
        // battaglia.js) al momento dell'attacco vero: qui solo se sono
        // pagabili, e per il Sacrificio QUALE mostro (il più debole, mai
        // l'attaccante). Prima l'IA pagava qui, PRIMA di scegliere il
        // bersaglio: se poi non trovava un attacco conveniente, il
        // Sacrificio restava pagato per niente.
        if (attackerDef && attackerDef.requiresLifePointsToAttack && Tavolo.lp(io) <= attackerDef.requiresLifePointsToAttack) continue;
        let tributoPerAttaccare;
        if (attackerDef && attackerDef.requiresTributeToAttack) {
            // Maschera della Restrizione (id 371, gameState.tributesBlocked):
            // nessun giocatore può sacrificare carte — stesso controllo
            // lato giocatore in executeAttack (js/engine/actions.js).
            if (gameState.tributesBlocked) continue;
            const tributeCandidates = Tavolo.mostri(io)
                .map((slot, index) => ({ slot, index }))
                .filter((item) => item.slot && item.index !== attackerItem.index);
            if (tributeCandidates.length === 0) continue;
            tributeCandidates.sort((a, b) => DuelEngine.getEffectiveAtk(a.slot.card) - DuelEngine.getEffectiveAtk(b.slot.card));
            tributoPerAttaccare = tributeCandidates[0].index;
        }
        // Esclude i mostri che non possono essere scelti come bersaglio in
        // questo momento (es. Capitano Predone id 714) — stesso filtro
        // applicato lato server in resolveAttack() (actions.js), ma qui
        // evita anche di sprecare la scelta strategica dell'IA su un
        // bersaglio che verrebbe comunque rifiutato.
        // Una voce può essere `true` o una FUNZIONE (attaccante) => bool
        // (Kaitoptera id 322, Il Sigillo di Orichalcos id 469): va valutata,
        // non letta come vero/falso — una funzione è sempre "vera" e
        // escluderebbe quel mostro anche quando l'attacco è permesso.
        let playerMonsters = Tavolo.mostri(Tavolo.avversario(io)).map((slot, index) => ({ slot, index })).filter((item) => {
            if (!item.slot) return false;
            const voce = gameState.cannotBeAttackTargetUids && gameState.cannotBeAttackTargetUids[item.slot.card.uid];
            return !(typeof voce === 'function' ? voce(attackerItem.slot.card) : voce);
        });
        // Manga Ryu-Ran (id 606): stesso vincolo lato bot di
        // mustTargetFilterIfPresent (resolveAttack, actions.js) — se un
        // bersaglio idoneo esiste, restringe la scelta dell'IA a quelli
        // soli, invece di lasciarla scegliere un bersaglio che poi
        // verrebbe comunque rifiutato.
        const mustTargetFilter = attackerDef && attackerDef.mustTargetFilterIfPresent;
        if (typeof mustTargetFilter === 'function') {
            const matches = playerMonsters.filter((item) => !item.slot.isFaceDown && mustTargetFilter(item.slot.card, io));
            if (matches.length > 0) playerMonsters = matches;
        }
        // Anello Magnetico (id 420) sul Terreno del giocatore: si può
        // attaccare solo il mostro equipaggiato (stessa regola di
        // resolveAttack, letta dallo stesso punto del motore).
        const obbligati = window.DuelEngine && DuelEngine.forcedAttackTargetIndexes ? DuelEngine.forcedAttackTargetIndexes(Tavolo.avversario(io)) : [];
        if (obbligati.length > 0) {
            playerMonsters = playerMonsters.filter((item) => obbligati.indexOf(item.index) !== -1);
            if (playerMonsters.length === 0) continue;
        }
        // Sacerdote di Asura (id 1001, def.attacksEachEnemyOnce): niente
        // secondo attacco allo stesso mostro, e niente attacco diretto dopo
        // averne attaccato uno — stesse regole di resolveAttack.
        if (attackerDef && attackerDef.attacksEachEnemyOnce) {
            const fatti = attackedEnemyUidsOf(attackerItem.slot);
            if (fatti.size > 0) {
                playerMonsters = playerMonsters.filter((item) => !fatti.has(item.slot.card.uid));
                if (playerMonsters.length === 0) continue;
            }
        }
        // 341 — Ultimo Turno: se questo attaccante ha un obbligo ancora
        // aperto (gameState.mustAttackTargetUidsFor), attacca quel
        // bersaglio direttamente, ignorando la normale valutazione di
        // convenienza dell'IA (che potrebbe altrimenti trattenersi, es.
        // perché il danno di questa battaglia è sempre 0) — stesso store
        // già consultato da handlePhaseStepperClick per il lato giocatore.
        const forcedUids = gameState.mustAttackTargetUidsFor && gameState.mustAttackTargetUidsFor[attackerItem.slot.card.uid];
        let targetIndex;
        if (forcedUids && forcedUids.size > 0) {
            const forcedTarget = playerMonsters.find((item) => forcedUids.has(item.slot.card.uid));
            targetIndex = forcedTarget ? forcedTarget.index : null;
        } else {
            targetIndex = window.BotAI ? BotAI.chooseAttackTarget(attackerItem.slot, playerMonsters, io) : null;
        }
        // Nessun bersaglio conveniente: il bot trattiene questo mostro
        // invece di sacrificarlo in uno scambio sfavorevole.
        if (targetIndex === null) continue;
        // Com'era il campo avversario quando si è deciso: se cambia prima di
        // attaccare (un mostro comparso, uno sparito) la decisione è vecchia.
        const firmaCampo = () => Tavolo.mostri(Tavolo.avversario(io))
            .map((s) => (s ? s.card.uid + (s.isFaceDown ? 'c' : 's') + s.position : '-')).join('|');
        const firmaDecisione = firmaCampo();
        hannoAttaccato.add(attackerItem.slot.card.uid);
        // Aspetta la RISOLUZIONE PIENA dell'attacco (compresa un'eventuale
        // finestra "vuoi rispondere?" del giocatore, che può richiedere un
        // tempo arbitrario), non solo un timer fisso: altrimenti un secondo
        // attacco potrebbe partire mentre il modale di risposta al primo è
        // ancora aperto, sovrascrivendone i pulsanti di conferma/annulla.
        const esito = await new Promise(resolve => {
            timerIA(() => {
                // Se nel frattempo il giocatore ha una scelta aperta (o una
                // cinematica è partita), l'attacco aspetta che finisca.
                waitForSceneSettled().then(() => aspettaDuelloFermo(() => {
                    if (gameState.currentPlayer !== io || gameState.gameOver) { resolve('fine'); return; }
                    // Il campo è cambiato mentre si aspettava: si decide da capo.
                    if (firmaCampo() !== firmaDecisione) { resolve('cambiato'); return; }
                    // Lo stesso comando della persona (eseguiAttacco,
                    // battaglia.js): paga il costo e attacca.
                    Comandi.esegui(io, { tipo: 'attacca', attaccante: attackerItem.index, bersaglio: targetIndex, tributo: tributoPerAttaccare }, { alTermine: () => resolve('fatto') });
                }));
            }, botMs(1200));
        });
        if (esito === 'cambiato') {
            hannoAttaccato.delete(attackerItem.slot.card.uid);
            const restanti = new Set(attackers.slice(posizioneAttaccante).map((x) => x.slot.card.uid));
            return botPerformAttacks(giro, restanti, io);
        }
    }
    // Un altro giro solo se qualcosa è successo (altrimenti chi ha rinunciato
    // rinuncerebbe di nuovo all'infinito) e con un tetto, per sicurezza.
    const ancoraPronti = Tavolo.mostri(io).some((s) => s && !s.hasAttacked && s.position === 'attack' && hannoAttaccato.has(s.card.uid));
    if (ancoraPronti && giro < 4 && !gameState.gameOver && gameState.currentPlayer === io) {
        await botPerformAttacks(giro + 1, hannoAttaccato, io);
    }
}

/**
 * Sposta una Trappola dalla mano del bot al primo slot Magia/Trappola
 * libero, coperta — SENZA rivelarne il nome nel log: il giocatore umano
 * non deve poter sapere cosa il bot ha appena Settato, esattamente come
 * vale per un Set del giocatore stesso (mai annunciato via nome finché
 * non si scopre/attiva). Ritorna una Promise risolta dopo la breve
 * animazione.
 */
function botSetTrapCard(card, handIndex, io = 'bot') {
    return new Promise((resolve) => {
        // Onda Sismica (id 818): il bot deve rispettare anche lui le Zone bloccate.
        const slotIndex = window.DuelEngine ? DuelEngine.findFreeSTSlot(io) : Tavolo.magieTrappole(io).findIndex((s) => s === null);
        if (slotIndex === -1) { resolve(); return; }
        // Lo stesso comando della persona (eseguiSetMagiaTrappola,
        // evocazioni.js), atterraggio compreso: il nome non si annuncia.
        Comandi.esegui(io, { tipo: 'settaMT', carta: card.uid, mano: handIndex, casella: slotIndex }, {
            alTermine: () => timerIA(resolve, 400)
        });
    });
}

/**
 * Attende che un'eventuale Chain aperta da un'attivazione manuale del bot
 * (Magia dalla mano, carta già Set) si chiuda per davvero — comprese le
 * eventuali risposte del giocatore — prima di procedere alla prossima
 * decisione. DuelEngine.activateCard() non espone un callback di
 * completamento come fireTrigger(): qui si sonda DuelEngine.isChainActive()
 * finché non torna false, con un tetto massimo di sicurezza (non dovrebbe
 * mai scattare davvero, ma evita un blocco totale se qualcosa va storto).
 */
/**
 * Attende che un'eventuale cinematica di Evocazione lunga (il filmato
 * dedicato di una carta, o la convergenza elementale di un Livello 7+)
 * finisca, prima che il bot faccia la mossa successiva. Senza, il bot
 * evocava un mostro importante e continuava a giocare SOTTO al filmato,
 * che copre tutto lo schermo: si tornava al campo con la partita gia'
 * andata avanti senza averla vista.
 *
 * Stesso schema di waitForBotChainToClear qui sotto (sondaggio + tetto di
 * sicurezza) e per lo stesso motivo: non c'e' un callback di
 * completamento da agganciare, il flag lo tiene FX.
 */
function waitForSummonCinematics() {
    return new Promise((resolve) => {
        const start = Date.now();
        const poll = () => {
            // Un modale/una scelta del giocatore aperta (risposta con una
            // Trappola/Magia, picker, Tributi...) ferma il bot SENZA
            // tetto: il giocatore ha il tempo che gli serve. Il tetto di
            // 20s vale solo per una cinematica che non finisce mai.
            if (typeof isBlockingModalOpen === 'function' && PortaUI.query('.modal-backdrop.open, #quickPopover')) {
                timerIA(poll, 150);
                return;
            }
            const inCorso = window.FX && typeof FX.isCinematicPlaying === 'function' && FX.isCinematicPlaying();
            if (!inCorso || Date.now() - start > 20000) { resolve(); return; }
            timerIA(poll, 150);
        };
        poll();
    });
}

/** Si risolve solo quando nessuna scelta del giocatore è aperta (modali, popover, Tributi, scarto). */
function waitForNoBlockingModal() {
    return new Promise((resolve) => {
        const poll = () => {
            if (sceltaDelGiocatoreAperta()) { timerIA(poll, 150); return; }
            resolve();
        };
        poll();
    });
}

/**
 * Si risolve quando non c'è nessuna scelta del giocatore aperta né una
 * cinematica in corso, E la cosa resta vera per un momento. Il "momento" conta:
 * l'effetto di una carta distrutta in battaglia (Drago Mascherato) può aprire
 * la sua scelta qualche istante DOPO la fine dell'attacco, e un controllo
 * istantaneo la mancherebbe. Se in quell'attimo spunta qualcosa, si riparte.
 */
function waitForSceneSettled() {
    return new Promise((resolve) => {
        const controlla = () => {
            waitForNoBlockingModal().then(waitForSummonCinematics).then(() => {
                timerIA(() => {
                    const ancora = (typeof isBlockingModalOpen === 'function' && isBlockingModalOpen())
                        || !!(window.FX && typeof FX.isCinematicPlaying === 'function' && FX.isCinematicPlaying());
                    if (ancora) controlla(); else resolve();
                }, botMs(450));
            });
        };
        controlla();
    });
}

/**
 * Una pausa del ciclo del bot che al RISVEGLIO ricontrolla se nel
 * frattempo è partita una cinematica, e in quel caso aspetta anche
 * quella.
 *
 * È la differenza fra "aspetto prima di cominciare" e "aspetto fino a
 * quando si può davvero proseguire": un'attesa a tempo fisso decisa
 * PRIMA non sa nulla di ciò che accade durante: una Magia del bot che
 * Evoca Specialmente un mostro con filmato dedicato fa partire
 * un'animazione a schermo intero DOPO che il timer è già in corsa, e alla
 * scadenza il bot tirava dritto — entrando in Battle Phase e attaccando
 * sotto al filmato. Segnalato dall'utente con il Drago Bianco Occhi Blu,
 * il cui filmato dura 6,6s contro i 2,9s di attesa fissa fra Evocazione e
 * primo attacco.
 *
 * Passa sempre per `phaseTransitionTimeout`, così una fine partita o un
 * abbandono possono annullarla come qualunque altra transizione.
 */
function attendiPoi(ms) {
    return new Promise((resolve) => {
        phaseTransitionTimeout = timerIA(() => {
            waitForSummonCinematics().then(resolve);
        }, botMs(ms));
    });
}

function waitForBotChainToClear(callback) {
    const start = Date.now();
    const poll = () => {
        // Il tetto di 15s non vale se il giocatore ha un modale aperto
        // (sta decidendo se rispondere nella Catena).
        const modaleAperto = !!PortaUI.query('.modal-backdrop.open, #quickPopover');
        if (!window.DuelEngine || !DuelEngine.isChainActive() || (!modaleAperto && Date.now() - start > 15000)) {
            callback();
            return;
        }
        timerIA(poll, 200);
    };
    timerIA(poll, 200);
}

/**
 * Durante la propria Main Phase, il bot decide ripetutamente — una carta
 * alla volta, vedi BotAI.chooseNextSpellTrapAction — se Settare una
 * Trappola o attivare direttamente una Magia dalla mano, finché l'IA del
 * livello attivo non ha più nulla da fare. Prima di questa aggiunta il
 * bot non toccava MAI le proprie Magie/Trappole se non in risposta a
 * un'azione del giocatore, lasciandole morte in mano per l'intera
 * partita — vedi js/ai/ai-medium.js (si ferma presto) e js/ai/ai-hard.js
 * (usa tutto quello che può) per quanto ogni livello ne approfitta
 * davvero.
 */
function attemptBotSpellTrap(io) {
    return new Promise((resolve) => {
        const usedThisTurn = {};
        let iterations = 0;
        const MAX_ITERATIONS = 10; // sicurezza: mai un loop infinito
        const step = () => aspettaDuelloFermo(passo);
        const passo = () => {
            iterations++;
            // Guardia difensiva (bug reale scoperto: senza questo
            // controllo, un setTimeout in ritardo poteva far attivare al
            // bot le proprie Magie/Trappole durante il turno del
            // giocatore) — vedi la stessa guardia in attemptBotSummon.
            if (iterations > MAX_ITERATIONS || gameState.gameOver || gameState.currentPlayer !== io) { resolve(); return; }
            const decision = window.BotAI ? BotAI.chooseNextSpellTrapAction(gameState, usedThisTurn, io) : null;
            if (!decision) { resolve(); return; }
            if (decision.action === 'set') {
                segnaMossa(); botSetTrapCard(decision.card, decision.handIndex, io).then(() => pausaTraMosse().then(step));
            } else {
                const started = Comandi.esegui(io, { tipo: 'attiva', zona: 'hand', indice: decision.handIndex, carta: decision.card && decision.card.uid });
                if (!started) { resolve(); return; } // difensivo: canActivate era già stato controllato da chi ha deciso
                segnaMossa();
                waitForBotChainToClear(() => { updateUI(); pausaTraMosse().then(step); });
            }
        };
        step();
    });
}

/**
 * Durante la propria Main Phase, il bot valuta ripetutamente se conviene
 * attivare ORA una propria carta già Set in un turno precedente O
 * l'effetto Ignition di un proprio mostro già in campo (non in risposta
 * a un trigger avversario) — vedi BotAI.chooseSetCardActivation, che
 * torna anche `decision.zone` ('st' o 'monster', richiesta esplicita
 * dell'utente per far usare al bot anche le proprie abilità Ignition
 * proattivamente, non solo Magie/Trappole già Set). Solo IA_DIFFICILE lo
 * fa mai (IA_MEDIA resta puramente reattiva sul proprio retrocampo/i
 * propri mostri): è questa la differenza di comportamento più visibile
 * tra i due livelli, oltre a quanto ciascuno usa la mano.
 */
function attemptBotActivateSetCards(io) {
    return new Promise((resolve) => {
        let iterations = 0;
        // Ridotto da 5 a 2 (richiesta esplicita dell'utente: "non così
        // tante magie e trappole potenti... riequilibra un po'" — IA_MEDIA
        // già si ferma da sola (chooseSetCardActivation torna sempre
        // null), questo limite tocca solo IA_DIFFICILE. Ogni iterazione che
        // non risolve subito corrisponde a un'attivazione riuscita, quindi
        // il cap resta comunque un limite per-turno "morbido", non un
        // conteggio esatto — coerente con MAX_ACTIVATE_PER_TURN/
        // MAX_SET_PER_TURN in js/ai/ai-hard.js per lo stesso motivo.
        const MAX_ITERATIONS = 2;
        const step = () => aspettaDuelloFermo(passo);
        const passo = () => {
            iterations++;
            // Guardia difensiva, stesso motivo di attemptBotSummon/attemptBotSpellTrap.
            if (iterations > MAX_ITERATIONS || gameState.gameOver || gameState.currentPlayer !== io) { resolve(); return; }
            const decision = window.BotAI ? BotAI.chooseSetCardActivation(gameState, io) : null;
            if (!decision) { resolve(); return; }
            const started = Comandi.esegui(io, { tipo: 'attiva', zona: decision.zone || 'st', indice: decision.index });
            if (!started) { resolve(); return; }
            segnaMossa();
            waitForBotChainToClear(() => { updateUI(); pausaTraMosse().then(step); });
        };
        step();
    });
}
