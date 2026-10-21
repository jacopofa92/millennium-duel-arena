/**
 * battaglia.js — la risoluzione di un attacco e del suo danno.
 * =====================================================================
 * Nucleo senza testa (piano di attacco, Priorità 2). resolveAttack
 * (dichiarazione, risposte, Catena) e resolveBattleDamage (confronto ATK/
 * DEF, distruzioni, danno ai Life Points) sono REGOLE: vivevano in
 * actions.js insieme ai click, ai trascinamenti e alle modali, che lì
 * restano. Dove ancora chiamano l'interfaccia (effetti visivi, updateUI)
 * lo fanno per nome; il passo successivo del piano le fa passare da una
 * porta sostituibile.
 *
 * Script classico: le funzioni restano globali come prima. Caricato prima
 * di game-flow.js e actions.js (gruppo "partita" in
 * scripts/gruppi-script.js); qui ci sono solo dichiarazioni.
 *
 * Spostate parola per parola da actions.js (tools/sposta-funzioni.js);
 * impronta di tools/impronta-funzioni.js uguale prima e dopo.
 */

function fieldOfOwner(owner) {
    return Tavolo.mostri(owner);
}

/**
 * I bersagli che il mostro in `slot` ha già attaccato in QUESTO turno
 * (uid, oppure '__diretto' per un attacco diretto) — vedi
 * def.attacksEachEnemyOnce in resolveAttack. Un registro di un turno
 * passato vale come vuoto: niente da azzerare a mano.
 */
function attackedEnemyUidsOf(slot) {
    if (!slot || slot.attackedEnemyUidsTurn !== gameState.turn || !slot.attackedEnemyUids) return new Set();
    return new Set(slot.attackedEnemyUids);
}

function graveyardOfOwner(owner) {
    return Tavolo.cimitero(owner);
}

/**
 * Il mostro in `attackerIndex` di `attackerOwner` può attaccare
 * DIRETTAMENTE adesso? Una risposta sola per chi deve saperlo PRIMA di
 * dichiarare l'attacco — l'interfaccia, che mostra le bande "ATTACCO
 * DIRETTO" e aggancia la freccia alla mano avversaria quando la mossa è
 * davvero disponibile, anche con mostri avversari in campo.
 *
 * Due condizioni: il permesso, poi i divieti.
 *  - Permesso: l'avversario non ha mostri, oppure questo mostro ha un
 *    permesso speciale per il turno (gameState.directAttackAllowedFor, es.
 *    Golem Meccanico dopo il suo costo) o continuo
 *    (gameState.directAttackAllowedUids, es. i Toon, ricalcolato dagli
 *    effetti continui).
 *  - Divieti: gli stessi che resolveAttack applica a un attacco diretto
 *    (def.cannotAttackDirectly, il bersaglio obbligato di Anello
 *    Magnetico, def.attacksEachEnemyOnce dopo aver già attaccato un
 *    mostro, def.mustTargetFilterIfPresent). Se se ne aggiunge uno là,
 *    va aggiunto anche qui, o l'interfaccia prometterebbe un attacco che
 *    poi viene rifiutato.
 * Non ripete i controlli che valgono per OGNI attacco (Posizione, già
 * attaccato, Spada Rivelatrice...): chi chiede ha già un mostro che può
 * attaccare, e quei controlli restano comunque in resolveAttack.
 */
function puoAttaccareDirettamente(attackerOwner, attackerIndex) {
    const attackerSlot = fieldOfOwner(attackerOwner)[attackerIndex];
    if (!attackerSlot || !attackerSlot.card) return false;
    const uid = attackerSlot.card.uid;
    const defenderOwner = Tavolo.avversario(attackerOwner);
    const defenderField = fieldOfOwner(defenderOwner);
    const difensoreHaMostri = defenderField.some((slot) => slot !== null);
    const permesso = !difensoreHaMostri
        || !!(gameState.directAttackAllowedFor && gameState.directAttackAllowedFor[uid])
        || !!(gameState.directAttackAllowedUids && gameState.directAttackAllowedUids[uid]);
    if (!permesso) return false;
    const def = window.DuelEngine && DuelEngine.getDefinition(attackerSlot.card.id);
    if (def && def.cannotAttackDirectly) return false;
    const obbligati = window.DuelEngine && DuelEngine.forcedAttackTargetIndexes
        ? DuelEngine.forcedAttackTargetIndexes(defenderOwner) : [];
    if (obbligati.length > 0) return false;
    if (def && def.attacksEachEnemyOnce && attackedEnemyUidsOf(attackerSlot).size > 0) return false;
    if (def && typeof def.mustTargetFilterIfPresent === 'function'
        && defenderField.some((slot) => slot && !slot.isFaceDown && def.mustTargetFilterIfPresent(slot.card, attackerOwner))) {
        return false;
    }
    return true;
}

/**
 * Risolve un'intera battaglia, chiunque l'abbia dichiarata (giocatore,
 * bot, o la sua replica in multiplayer). Sequenza:
 *   1) apre la finestra di risposta ON_ATTACK_DECLARE (Forza Riflessa /
 *      Cilindro Magico / Kuriboh da mano — vedi js/engine/duel-engine.js);
 *   2) SOLO dopo che quella finestra si è chiusa (onDone), se l'attacco
 *      non è stato annullato, gioca le animazioni e calcola i danni.
 * Il passo 1 può essere asincrono (il giocatore umano deve confermare
 * un prompt), per questo tutto il resto vive dentro la callback onDone.
 *
 * `onComplete`, se passato, viene richiamato esattamente una volta,
 * quando l'INTERA battaglia (finestra di risposta compresa) è davvero
 * finita — non un timer a tempo fisso. botPerformAttacks() in bot.js lo
 * usa per aspettare la risoluzione piena di un attacco (incluso un
 * eventuale "vuoi rispondere?" del giocatore) prima di dichiararne un
 * altro, così due finestre di risposta non si sovrappongono mai.
 */
function resolveAttack(attackerOwner, attackerIndex, targetIndex, onComplete) {
    const done = typeof onComplete === 'function' ? onComplete : function () {};
    // Una volta che i LP di qualcuno sono a zero il duello è chiuso: qui
    // passano TUTTI gli attacchi (giocatore, bot e mosse remote), quindi
    // basta questo controllo perché nulla si muova più sotto la schermata
    // di Vittoria/Sconfitta.
    if (gameState.gameOver) { done(); return; }
    const defenderOwner = Tavolo.avversario(attackerOwner);
    const attackerField = fieldOfOwner(attackerOwner);
    const defenderField = fieldOfOwner(defenderOwner);
    const attackerSlot = attackerField[attackerIndex];
    if (!attackerSlot || attackerSlot.hasAttacked) { done(); return; }
    // Un mostro in Posizione di Difesa (coperto O scoperto) non può MAI
    // dichiarare un attacco, per regola — controllo centralizzato qui,
    // l'unico punto per cui passa ogni attacco (giocatore, bot, mosse
    // remote in multiplayer), invece di fidarsi che ogni chiamante lo
    // filtri da solo a monte (l'UI del giocatore già lo fa via
    // slot.position==='attack' in game-flow.js, ma l'elenco di
    // candidati-attaccanti del bot in js/ai/bot.js non lo controllava
    // affatto: bug reale osservato, un mostro in Difesa del bot poteva
    // attaccare).
    // "Non può attaccare il turno in cui viene Special Summonata" (es.
    // Drago Toon Occhi Blu id 123, Manga Ryu-Ran id 606 —
    // def.cannotAttackTurnSummoned): riusa slot.summonedOnTurn, già
    // tracciato dal motore per OGNI mostro (Normale, Special o Flip) fin
    // dalla sua creazione — stesso campo già consultato da id 308
    // Congedo Infinito per uno scopo diverso.
    const attackerDefForTurnCheck = window.DuelEngine && DuelEngine.getDefinition(attackerSlot.card.id);
    if (attackerDefForTurnCheck && attackerDefForTurnCheck.cannotAttackTurnSummoned && attackerSlot.summonedOnTurn === gameState.turn) {
        addToLog(`🚫 ${attackerSlot.card.name} non può attaccare nel turno in cui è stata Special Summonata.`);
        done();
        return;
    }
    if (attackerSlot.position !== 'attack') {
        addToLog(`🚫 ${attackerSlot.card.name} è in Posizione di Difesa: non può dichiarare un attacco.`);
        done();
        return;
    }
    // "Questa carta non può dichiarare un attacco nel turno in cui viene
    // attivato questo effetto" (es. Obelisk il Tormentatore, id 30, dopo
    // aver usato il suo Ignition di sacrificio) — per uid, valido SOLO
    // per il resto DI QUESTO turno, azzerato in changeTurn() (game-flow.js),
    // stesso schema di blockedCardUidsThisTurn.
    if (gameState.cannotAttackUidsThisTurn && gameState.cannotAttackUidsThisTurn.has(attackerSlot.card.uid)) {
        addToLog(`🚫 ${attackerSlot.card.name} non può attaccare in questo turno.`);
        done();
        return;
    }
    if (gameState.onlyOneAttackingMonsterFor && gameState.onlyOneAttackingMonsterFor[attackerOwner]) {
        const giaAttaccanti = gameState.attackedMonsterUidsThisTurn || new Set();
        const altroMostroHaAttaccato = Array.from(giaAttaccanti).some((uid) => uid !== attackerSlot.card.uid);
        if (altroMostroHaAttaccato) {
            addToLog(`🚫 Dopo Attacco Forza del Tuono, solo il mostro che ha già attaccato può continuare ad attaccare in questo turno.`);
            done();
            return;
        }
    }
    // "Questa carta non può attaccare direttamente il tuo avversario"
    // (es. Zombyra l'Oscuro, id 625) — per-carta, fissa (non condizionata
    // dal campo avversario come il divieto normale di attacco diretto).
    if (targetIndex === -1) {
        const attackerDef = window.DuelEngine && DuelEngine.getDefinition(attackerSlot.card.id);
        if (attackerDef && attackerDef.cannotAttackDirectly) {
            addToLog(`🚫 ${attackerSlot.card.name} non può attaccare direttamente il tuo avversario.`);
            done();
            return;
        }
    }
    if (window.DuelEngine && DuelEngine.cannotAttack(attackerOwner)) {
        addToLog(`🚫 ${attackerOwner === 'player' ? 'I tuoi mostri non possono' : 'I mostri del bot non possono'} attaccare in questo momento (es. Spada Rivelatrice).`);
        done();
        return;
    }
    // def.canDeclareAttack(ctx) => bool: una condizione SULLA CARTA per
    // poter dichiarare un attacco, valutata adesso sul Terreno (Drago della
    // Caverna id 1040: "non può dichiarare un attacco a meno che tu non
    // controlli un altro mostro Tipo Drago"). Il bot la consulta già prima
    // di scegliere un attaccante (botPerformAttacks, bot.js).
    const attackerDefForCondition = window.DuelEngine && DuelEngine.getDefinition(attackerSlot.card.id);
    if (attackerDefForCondition && typeof attackerDefForCondition.canDeclareAttack === 'function'
        && !attackerDefForCondition.canDeclareAttack(DuelEngine.makeContext(attackerOwner, { card: attackerSlot.card, slotIndex: attackerIndex }))) {
        addToLog(`🚫 ${attackerSlot.card.name} non può dichiarare un attacco in questo momento.`);
        done();
        return;
    }
    // Divieto d'attacco per QUESTO SOLO mostro (a differenza del divieto
    // per l'intero giocatore qui sopra) — es. Incantesimo Ombra (id 439):
    // vedi gameState.cannotAttackUids, ricalcolato ad ogni render da un
    // effetto-carta continuo in card-effects.js (mai una proprietà
    // persistente sullo slot, altrimenti non si azzererebbe mai da sola).
    if (gameState.cannotAttackUids && gameState.cannotAttackUids[attackerSlot.card.uid]) {
        addToLog(`🚫 ${attackerSlot.card.name} non può attaccare in questo momento.`);
        done();
        return;
    }
    // Divieto d'attacco PERMANENTE per uid (es. Controllo Mentale/Mind
    // Control, id 130: "il mostro preso non può attaccare") — a
    // differenza di cannotAttackUids qui sopra (ricalcolato/azzerato ad
    // ogni render da un effetto continuo ancora sul Terreno), questo Set
    // non si azzera mai da solo: la carta che l'ha imposto (una Magia
    // Normale) è già finita nel Cimitero, quindi non c'è nessun effetto
    // continuo che possa ricalcolarlo ogni volta.
    if (gameState.cannotAttackUidsPermanent && gameState.cannotAttackUidsPermanent.has(attackerSlot.card.uid)) {
        addToLog(`🚫 ${attackerSlot.card.name} non può attaccare.`);
        done();
        return;
    }
    // Divieto d'attacco per UN TURNO PRECISO nel futuro (es. Lucertola
    // Elettrica, id 222: "il mostro che l'attacca non può attaccare nel
    // suo turno successivo") — a differenza di cannotAttackUids qui sopra
    // (ricalcolato ad ogni render da un effetto continuo), questo è un
    // numero di turno fisso salvato al momento del trigger: gameState.turn
    // avanza di 1 ad ogni cambio giocatore, quindi "il tuo turno
    // successivo" da quando l'evento scatta è sempre gameState.turn + 2
    // (regola: nessuna cancellazione esplicita necessaria, il confronto
    // smette da solo di corrispondere una volta passato quel turno).
    if (gameState.attackLockedUntilTurn && gameState.attackLockedUntilTurn[attackerSlot.card.uid] === gameState.turn) {
        addToLog(`🚫 ${attackerSlot.card.name} non può attaccare in questo turno.`);
        done();
        return;
    }
    // Patrizio dell'Oscurità: soltanto dopo aver convalidato l'attaccante,
    // il difensore sceglie il bersaglio. La scelta passa da Decisioni,
    // quindi funziona anche per persona e posto remoto. Il token evita di
    // riaprire il prompt nella chiamata ricorsiva col bersaglio deciso.
    const patricianPresent = defenderField.some((slot) => slot && !slot.isFaceDown
        && DuelEngine.getDefinition(slot.card.id)?.controllerChoosesOpponentAttackTargets);
    const patricianKey = `${gameState.turn}:${attackerSlot.card.uid}`;
    gameState.patricianAttackChoiceDone = gameState.patricianAttackChoiceDone || new Set();
    if (patricianPresent && !gameState.patricianAttackChoiceDone.has(patricianKey)) {
        const forced = DuelEngine.forcedAttackTargetIndexes ? DuelEngine.forcedAttackTargetIndexes(defenderOwner) : [];
        const attackerDefinition = DuelEngine.getDefinition(attackerSlot.card.id);
        const filterRequired = attackerDefinition && typeof attackerDefinition.mustTargetFilterIfPresent === 'function'
            && defenderField.some((slot) => slot && !slot.isFaceDown && attackerDefinition.mustTargetFilterIfPresent(slot.card, attackerOwner));
        const alreadyAttacked = attackerDefinition && attackerDefinition.attacksEachEnemyOnce
            ? attackedEnemyUidsOf(attackerSlot) : null;
        const candidates = defenderField.map((slot, index) => {
            if (!slot) return null;
            const blocked = gameState.cannotBeAttackTargetUids && gameState.cannotBeAttackTargetUids[slot.card.uid];
            const isBlocked = typeof blocked === 'function' ? blocked(attackerSlot.card) : !!blocked;
            if (isBlocked || (forced.length > 0 && !forced.includes(index))) return null;
            if (filterRequired && (slot.isFaceDown || !attackerDefinition.mustTargetFilterIfPresent(slot.card, attackerOwner))) return null;
            if (alreadyAttacked && alreadyAttacked.has(slot.card.uid)) return null;
            return { slot, index, card: slot.card };
        }).filter(Boolean);
        if (candidates.length > 0) {
            Decisioni.chiedi({
                chi: defenderOwner,
                tipo: 'carte',
                candidati: candidates.map((candidate) => candidate.card),
                titolo: '🌑 Patrizio dell’Oscurità',
                testo: 'Scegli quale tuo mostro verrà attaccato.',
                // Il database usa attack/defense (non le abbreviazioni
                // stampate ATK/DEF): il difensore IA sceglie il muro più
                // alto, comportamento prudente e riproducibile.
                automatica: (list) => list.slice().sort((a, b) => Math.max(b.attack || 0, b.defense || 0) - Math.max(a.attack || 0, a.defense || 0))[0],
                automaticaSeUnica: true
            }, (chosen) => {
                if (!chosen) { done(); return; }
                const chosenCandidate = candidates.find((candidate) => candidate.card.uid === chosen.uid);
                if (!chosenCandidate) { done(); return; }
                gameState.patricianAttackChoiceDone.add(patricianKey);
                resolveAttack(attackerOwner, attackerIndex, chosenCandidate.index, done);
            });
            return;
        }
    }
    gameState.patricianAttackChoiceDone.delete(patricianKey);
    // Divieto di essere scelto come BERSAGLIO per QUESTO SOLO mostro
    // difensore (es. Capitano Predone id 714: "l'avversario non può
    // bersagliare i Guerrieri con gli attacchi, eccetto questa carta") —
    // stesso schema dei controlli sull'attaccante qui sopra, ma sul lato
    // del difensore. Non copre l'attacco diretto (targetIndex === -1):
    // quella scelta non passa da un mostro bersaglio. La voce può essere
    // `true` (divieto assoluto, per QUALUNQUE attaccante) o una funzione
    // (attackerCard) => bool (divieto CONDIZIONATO, es. Kaitoptera id
    // 322: "i mostri dell'avversario, eccetto quelli VENTO, non possono
    // bersagliarla").
    if (targetIndex !== -1) {
        const targetSlot = defenderField[targetIndex];
        const blockEntry = targetSlot && gameState.cannotBeAttackTargetUids && gameState.cannotBeAttackTargetUids[targetSlot.card.uid];
        const isBlocked = typeof blockEntry === 'function' ? blockEntry(attackerSlot.card) : !!blockEntry;
        if (isBlocked) {
            addToLog(`🚫 ${targetSlot.card.name} non può essere scelta come bersaglio per un attacco in questo momento.`);
            done();
            return;
        }
    }
    // Bersaglio obbligato imposto dal DIFENSORE (Anello Magnetico id 420:
    // "i mostri dell'avversario possono attaccare solo il mostro
    // equipaggiato con questa carta, se attaccano"): se il difensore ha
    // mostri in gameState.mustBeAttackedUidsFor (ricalcolato a ogni render
    // da uno static(), azzerato in recomputeStaticEffects), l'attacco deve
    // puntare uno di quelli — niente altri mostri e niente attacco diretto.
    // È il contrario di mustAttackTargetUidsFor (id 199), che obbliga un
    // PROPRIO attaccante. Vale solo finché quel mostro è davvero sul
    // Terreno del difensore. Il bot restringe la scelta allo stesso modo
    // (DuelEngine.forcedAttackTargetIndexes, usato da bot.js).
    const obbligati = window.DuelEngine && DuelEngine.forcedAttackTargetIndexes
        ? DuelEngine.forcedAttackTargetIndexes(defenderOwner) : [];
    if (obbligati.length > 0 && obbligati.indexOf(targetIndex) === -1) {
        addToLog(`🚫 ${attackerSlot.card.name} può attaccare solo ${obbligati.map((i) => defenderField[i].card.name).join(' o ')}.`);
        done();
        return;
    }
    // def.attacksEachEnemyOnce (Sacerdote di Asura id 1001: "può attaccare
    // tutti i mostri dell'avversario, una volta ciascuno"): quali bersagli
    // questo mostro ha già attaccato in questo turno sta sullo slot
    // (attackedEnemyUids, valido solo col timbro del turno, così non serve
    // azzerarlo). Niente secondo attacco allo stesso mostro, e niente attacco
    // diretto dopo averne attaccato uno. Il NUMERO di attacchi lo dà
    // def.getExtraAttackCount della carta, che legge lo stesso registro
    // (attackedEnemyUidsOf, qui sotto).
    const defOgniNemico = window.DuelEngine && DuelEngine.getDefinition(attackerSlot.card.id);
    if (defOgniNemico && defOgniNemico.attacksEachEnemyOnce) {
        const registro = attackedEnemyUidsOf(attackerSlot);
        const bersaglioUid = targetIndex === -1 ? '__diretto' : (defenderField[targetIndex] && defenderField[targetIndex].card.uid);
        if (targetIndex === -1 && registro.size > 0) {
            addToLog(`🚫 ${attackerSlot.card.name} ha già attaccato un mostro: non può attaccare direttamente.`);
            done();
            return;
        }
        if (bersaglioUid && registro.has(bersaglioUid)) {
            addToLog(`🚫 ${attackerSlot.card.name} ha già attaccato quel mostro in questo turno.`);
            done();
            return;
        }
        if (bersaglioUid) {
            registro.add(bersaglioUid);
            attackerSlot.attackedEnemyUids = registro;
            attackerSlot.attackedEnemyUidsTurn = gameState.turn;
        }
    }
    // Vincolo sul lato dell'ATTACCANTE (es. Manga Ryu-Ran, id 606: "può
    // attaccare direttamente, a meno che l'avversario controlli un
    // mostro Toon, nel qual caso deve bersagliare un mostro Toon") —
    // def.mustTargetFilterIfPresent((card) => bool), consultato solo se
    // il difensore controlla ALMENO un mostro scoperto che la soddisfa
    // (altrimenti l'attacco resta libero, diretto incluso). Funzione
    // invece di un valore fisso (a differenza di cannotBeAttackTargetUids
    // qui sopra, per uid) perché "Toon" non è un Tipo/Attributo ma una
    // convenzione sul nome (vedi isToon, più sotto in questo file).
    const mustTargetFilter = window.DuelEngine && DuelEngine.getDefinition(attackerSlot.card.id)?.mustTargetFilterIfPresent;
    if (typeof mustTargetFilter === 'function' && defenderField.some((slot) => slot && !slot.isFaceDown && mustTargetFilter(slot.card, attackerOwner))) {
        const targetSlot = targetIndex !== -1 ? defenderField[targetIndex] : null;
        const targetMatches = targetSlot && !targetSlot.isFaceDown && mustTargetFilter(targetSlot.card, attackerOwner);
        if (!targetMatches) {
            addToLog(`🚫 ${attackerSlot.card.name} deve scegliere come bersaglio un mostro specifico!`);
            done();
            return;
        }
    }

    const attackerBoardId = attackerOwner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
    const defenderBoardId = defenderOwner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
    // Interroga il DOM per gli elementi carta attaccante/bersaglio: NON va
    // fatto qui, va rifatto DOPO l'updateUI() dentro la callback di
    // fireTrigger qui sotto. renderFields() (chiamata da updateUI) ricrea
    // da zero l'intero field-board con innerHTML='', quindi qualunque nodo
    // preso PRIMA di quella chiamata risulta "staccato" dal documento
    // (isConnected: false, getBoundingClientRect() tutto a zero) — le
    // animazioni di carica/scontro applicate a un nodo così sono invisibili
    // o compaiono in un angolo (0,0) invece che sulla carta vera.
    const queryBattleElements = (effectiveTargetIndex, targetBoardId, targetOwnerForHand) => ({
        // [data-type="monster"] è OBBLIGATORIO qui: la zona Magia/Trappola
        // e la zona Mostri condividono gli stessi valori di data-index
        // (0-4 ciascuna), quindi un selettore senza data-type può
        // agganciarsi al .field-slot SBAGLIATO (es. una Magia/Trappola
        // Set nella stessa colonna) se quello compare per primo nel DOM —
        // bug reale osservato: l'animazione d'attacco mostrava la carta
        // coperta in zona Magia/Trappola al posto del vero mostro
        // attaccante/bersaglio.
        attackerCardEl: PortaUI.query(`#${attackerBoardId} .field-slot[data-type="monster"][data-index="${attackerIndex}"] .card`),
        // Attacco diretto: la freccia/rincorsa punta ora verso la mano di
        // chi lo subisce (le sue carte, il "bersaglio" concettuale di un
        // attacco senza un mostro a fare da scudo), non più verso il box
        // LP — quello resta comunque il punto dove i Life Points scendono
        // davvero (vedi renderLifePoints più sotto, indipendente da qui).
        // targetBoardId di default è quello del difensore (defenderBoardId),
        // ma può essere quello dell'ATTACCANTE se il bersaglio è stato
        // ridiretto sul suo stesso campo (vedi redirectAttack/Ragno della
        // Roulette qui sopra).
        targetAnchor: effectiveTargetIndex === -1
            ? PortaUI.byId((targetOwnerForHand || defenderOwner) === 'player' ? 'playerHand' : 'botHand')
            : PortaUI.query(`#${targetBoardId || defenderBoardId} .field-slot[data-type="monster"][data-index="${effectiveTargetIndex}"] .card`)
    });

    // Ala del Tiranno (id 496): traccia chi ha dichiarato un attacco
    // contro un vero mostro (non diretto) in questo turno — svuotato in
    // changeTurn() (game-flow.js). Segnato alla dichiarazione, non al
    // danno effettivo: il testo reale è "ha attaccato", non "ha
    // distrutto"/"ha inflitto danno".
    if (targetIndex !== -1) {
        gameState.attackedMonsterUidsThisTurn = gameState.attackedMonsterUidsThisTurn || new Set();
        gameState.attackedMonsterUidsThisTurn.add(attackerSlot.card.uid);
    }
    if (window.DuelDialogues) DuelDialogues.say(attackerOwner, 'attack');
    const attackState = { cancelled: false, damageNegated: false, attackerAtkZeroed: false, redirectedTargetIndex: null, redirectedTargetOwner: null };
    const declareCtx = DuelEngine.makeContext(attackerOwner, {
        attackerOwner: attackerOwner,
        attackerIndex: attackerIndex,
        targetIndex: targetIndex,
        attackerAtk: DuelEngine.getEffectiveAtk(attackerSlot.card),
        cancelAttack: () => { attackState.cancelled = true; },
        negateDamage: () => { attackState.damageNegated = true; },
        // Es. Suijin/Kazejin: "durante il calcolo dei danni, rendi 0 l'ATK
        // dell'attaccante" — diverso da negateDamage() (che annulla solo i
        // Life Points persi), qui l'ATK usato nel confronto di battaglia
        // stesso diventa 0, quindi l'attaccante può anche essere distrutto
        // dalla DEF del difensore.
        zeroAttackerAtk: () => { attackState.attackerAtkZeroed = true; },
        // Es. Spiritello dei Sogni (id 214): il DIFENDENTE designa un altro
        // proprio mostro come nuovo bersaglio di QUESTO attacco (l'attacco
        // in sé non viene annullato, solo ridiretto) — `newIndex` deve
        // essere uno slot occupato del campo del difensore, altrimenti il
        // ridirezionamento viene ignorato più sotto. `newOwner` è opzionale
        // e serve SOLO a Ragno della Roulette (id 425, risultato 4 del
        // dado: "scegli un altro mostro che controlla l'AVVERSARIO [di chi
        // controlla Ragno della Roulette, cioè l'attaccante] e cambia il
        // bersaglio dell'attacco su di esso") — l'unico caso in questo
        // dataset in cui il nuovo bersaglio sta sul campo dell'ATTACCANTE
        // stesso, non del difensore: senza `newOwner` il default resta il
        // campo del difensore, comportamento invariato per ogni altro
        // effetto che chiama redirectAttack con un solo argomento.
        redirectAttack: (newIndex, newOwner) => {
            attackState.redirectedTargetIndex = newIndex;
            attackState.redirectedTargetOwner = newOwner || defenderOwner;
        },
        // Es. Ragno della Roulette (id 425, risultato 2 del dado): "rendi
        // quell'attacco un attacco diretto" — stesso meccanismo di
        // redirectAttack qui sopra, ma verso targetIndex -1 (nessun
        // mostro, i Life Points del difensore incassano tutto l'ATK
        // dell'attaccante) invece che verso un altro mostro.
        forceDirectAttack: () => {
            attackState.redirectedTargetIndex = -1;
            attackState.redirectedTargetOwner = defenderOwner;
        }
    });

    DuelEngine.fireTrigger(DuelEngine.TRIGGER.ON_ATTACK_DECLARE, declareCtx, () => {
        updateUI(); // mostra subito eventuali effetti della risposta (es. distruzioni di Forza Riflessa)

        // L'attacco si ferma qui se è stato annullato esplicitamente
        // (Cilindro Magico) oppure se il mostro attaccante non esiste
        // più (es. Forza Riflessa lo ha appena distrutto insieme a tutti
        // gli altri mostri in Posizione di Attacco del suo proprietario).
        if (attackState.cancelled || !attackerField[attackerIndex]) {
            addToLog('🚫 L\'attacco è stato annullato.');
            if (attackerField[attackerIndex]) attackerField[attackerIndex].hasAttacked = true;
            if (attackerOwner === 'player') clearSelection(); else updateUI();
            done();
            return;
        }

        // Bersaglio effettivo di questo attacco: quello ridiretto da
        // redirectAttack(), se presente e ancora valido (uno slot
        // realmente occupato sul campo del difensore o — solo per Ragno
        // della Roulette, vedi redirectAttack più sopra — dell'attaccante
        // stesso), altrimenti quello dichiarato in origine. effectiveDefenderOwner
        // resta 'defenderOwner' per ogni caso normale: cambia SOLO quando un
        // redirect valido ha esplicitamente designato l'altro campo.
        let effectiveDefenderOwner = defenderOwner;
        let effectiveTargetIndex = targetIndex;
        if (attackState.redirectedTargetIndex !== null) {
            const candidateOwner = attackState.redirectedTargetOwner || defenderOwner;
            if (attackState.redirectedTargetIndex === -1) {
                // forceDirectAttack(): -1 è sempre "valido" di per sé, non
                // punta a nessuno slot da verificare sul campo.
                effectiveDefenderOwner = candidateOwner;
                effectiveTargetIndex = -1;
            } else {
                const candidateField = fieldOfOwner(candidateOwner);
                if (candidateField[attackState.redirectedTargetIndex]) {
                    effectiveDefenderOwner = candidateOwner;
                    effectiveTargetIndex = attackState.redirectedTargetIndex;
                }
            }
        }
        const effectiveDefenderField = fieldOfOwner(effectiveDefenderOwner);
        const effectiveDefenderBoardId = effectiveDefenderOwner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';

        // Presi ORA, dopo l'updateUI() qui sopra: sono i nodi realmente
        // visibili a schermo in questo momento (vedi commento su
        // queryBattleElements più sopra).
        const { attackerCardEl, targetAnchor } = queryBattleElements(effectiveTargetIndex, effectiveDefenderBoardId, effectiveDefenderOwner);

        // Attacco diretto: nessun mostro-bersaglio verso cui lanciarsi, la
        // rincorsa va dritta verso la metà alta (il Bot subisce) o bassa
        // (il giocatore subisce) dello schermo — vedi showBattleEffect.
        const directDirection = effectiveTargetIndex === -1 ? (effectiveDefenderOwner === 'bot' ? 'up' : 'down') : null;
        EventiDuello.emetti('effetto-battaglia', attackerCardEl, targetAnchor, directDirection);
        if (window.SFX) SFX.attackSwing();
        if (effectiveTargetIndex !== -1 && window.FX) {
            FX.playBattleClashEpic(attackerCardEl, targetAnchor);
        }
        if (effectiveTargetIndex !== -1 && window.SFX) {
            setTimeout(() => SFX.clash(), 270);
        }
        // Feedback tattile sull'impatto (vedi js/native/haptics.js, no-op
        // sul web): scontro tra due mostri è più "pesante" di un attacco
        // diretto, stessa distinzione già fatta qui sopra per l'effetto
        // visivo/sonoro (FX.playBattleClashEpic/SFX.clash solo se c'è
        // davvero un bersaglio). Sincronizzato con SFX.clash (270ms), non
        // con lo swing iniziale: è il momento in cui l'attacco "arriva".
        if (window.NativeHaptics) {
            if (effectiveTargetIndex !== -1) {
                setTimeout(() => NativeHaptics.medium(), 270);
            } else {
                NativeHaptics.light();
            }
        }

        // "Durante il calcolo dei danni, puoi..." (es. Iniezione della Fata
        // Giglio id 889): le scelte di quel momento si fanno QUI, con la
        // battaglia ormai certa, e il danno si calcola solo dopo — vedi
        // runBeforeDamageCalculation in duel-engine.js.
        PassoComune.dopo(() => DuelEngine.runBeforeDamageCalculation(attackerOwner, attackerIndex, effectiveDefenderOwner, effectiveTargetIndex, () => {
            // Una scelta fatta qui sopra non toglie mai l'attaccante dal
            // campo, ma resolveBattleDamage legge la sua carta senza
            // controlli: meglio uscire pulito che rompersi a metà.
            //
            // Il campo si RILEGGE adesso, non si usa quello ricordato a
            // inizio battaglia: se nel frattempo l'elenco delle caselle è
            // stato sostituito da uno nuovo, il vecchio conteneva ancora lo
            // slot e il controllo passava, mentre resolveBattleDamage (che
            // rilegge il campo) trovava un vuoto — "Cannot read properties
            // of null (reading 'card')". Visto sulla suite di GitHub nel
            // test del bot (annotazione "Test instabile").
            const campoAttaccanteOra = fieldOfOwner(attackerOwner);
            const campoDifensoreOra = fieldOfOwner(effectiveDefenderOwner);
            if (attackerField[attackerIndex] !== attackerSlot || campoAttaccanteOra[attackerIndex] !== attackerSlot) {
                if (attackerOwner === 'player') clearSelection(); else updateUI();
                done();
                return;
            }
            // Lo stesso per il BERSAGLIO: una risposta in Catena o una
            // scelta "durante il calcolo dei danni" può toglierlo dal campo
            // (distrutto, bandito, tornato in mano), e resolveBattleDamage
            // leggeva la sua casella senza controlli — "Cannot read
            // properties of null (reading 'card')", e il turno restava
            // fermo lì. Era l'errore raro uscito una volta nel test del bot
            // e mai riprodotto: l'IA contro IA del duello senza testa lo
            // ha reso ripetibile. SEMPLIFICAZIONE: nel gioco vero scatta la
            // "ripetizione dell'attacco" (l'attaccante può sceglierne un
            // altro o rinunciare); qui l'attacco si ferma e conta come fatto.
            if (effectiveTargetIndex !== -1 && (!effectiveDefenderField[effectiveTargetIndex] || !campoDifensoreOra[effectiveTargetIndex])) {
                addToLog('🌫️ Il bersaglio non è più sul Terreno: l\'attacco si ferma.');
                attackerSlot.hasAttacked = true;
                if (attackerOwner === 'player') clearSelection(); else updateUI();
                done();
                return;
            }
            resolveBattleDamage(attackerOwner, effectiveDefenderOwner, attackerIndex, effectiveTargetIndex, attackState.damageNegated, attackState.attackerAtkZeroed);
            attackerSlot.hasAttacked = true;
            // Attacco extra nella stessa Battle Phase: SOLO se l'attaccante
            // è sopravvissuto a QUESTA battaglia (attackerField[attackerIndex]
            // è ancora lui stesso, non null/un altro mostro). Il NUMERO di
            // attacchi extra concessi (non più solo "sì/no") somma tre fonti
            // indipendenti, ciascuna eleggibile al massimo una volta a
            // testa per turno:
            //   - def.canAttackTwice (es. Cavaliere Hayabusa id 294): +1 fisso.
            //   - slot.extraAttackGranted (es. Riavvolgimento Toon id 485):
            //     +1 concesso una tantum da un'altra carta, azzerato ogni
            //     turno in changeTurn()/game-flow.js.
            //   - slot.extraAttacksGrantedCount (es. Movimento d'Onda
            //     Diffuso id 199/Onda di Diffusione id 747): +N concesso
            //     una tantum da un'altra carta a un bersaglio SCELTO (non
            //     un effetto proprio del mostro come getExtraAttackCount
            //     qui sotto) — stesso schema di extraAttackGranted ma
            //     numerico invece che booleano, per "deve poter attaccare
            //     tutti i mostri avversari" (N = quanti erano sul campo
            //     nemico al momento dell'attivazione). Azzerato ogni turno
            //     insieme a extraAttackGranted.
            //   - def.getExtraAttackCount(ctx) (es. Samurai Armato - Ben
            //     Kei id 721): +N DINAMICO, ricalcolato ad ogni attacco (nel
            //     suo caso, 1 per ogni Carta Equipaggiamento attualmente
            //     agganciata) — a differenza delle prime due, può cambiare
            //     nel corso dello stesso turno (es. se una Carta Equip
            //     viene distrutta a metà Battle Phase).
            // slot.extraAttacksUsedThisTurn (numero, azzerato ogni turno
            // insieme a extraAttackGranted) traccia quanti ne sono già
            // stati usati, confrontato col totale concesso ORA.
            if (attackerField[attackerIndex] === attackerSlot) {
                const attackerDef = DuelEngine.getDefinition(attackerSlot.card.id);
                let totalExtraAllowed = 0;
                if (attackerDef && attackerDef.canAttackTwice) totalExtraAllowed += 1;
                if (attackerSlot.extraAttackGranted) totalExtraAllowed += 1;
                totalExtraAllowed += attackerSlot.extraAttacksGrantedCount || 0;
                if (attackerDef && typeof attackerDef.getExtraAttackCount === 'function') {
                    totalExtraAllowed += attackerDef.getExtraAttackCount(DuelEngine.makeContext(attackerOwner, { card: attackerSlot.card, slotIndex: attackerIndex }));
                }
                const extraUsedSoFar = attackerSlot.extraAttacksUsedThisTurn || 0;
                if (extraUsedSoFar < totalExtraAllowed) {
                    attackerSlot.hasAttacked = false;
                    attackerSlot.extraAttacksUsedThisTurn = extraUsedSoFar + 1;
                    addToLog(`⚔️ ${attackerSlot.card.name} può attaccare di nuovo in questa Battle Phase!`);
                }
            }

            // "Se questa carta attacca: viene cambiata in Posizione di
            // Difesa a fine Battle Phase, e non può cambiare Posizione
            // fino alla End Phase del tuo turno successivo" (es. Forza
            // d'Attacco Goblin, id 269 — def.forcesDefenseAfterAttack).
            // SEMPLIFICAZIONE: applicato SUBITO invece che a fine Battle
            // Phase (equivalente in pratica: nessun'altra azione di questo
            // attaccante può più accadere prima della fine della Battle
            // Phase), e sbloccato all'inizio del turno successivo del
            // proprietario invece che alla sua End Phase (changeTurn() in
            // game-flow.js resetta canChangePosition per l'intero campo di
            // chi inizia il turno) — un turno di blocco in meno rispetto
            // alla regola vera, stesso genere di scorciatoia già preso per
            // altri effetti "fino a un momento preciso di un turno futuro"
            // in questo file. Solo se l'attaccante è sopravvissuto a questa
            // battaglia.
            if (attackerField[attackerIndex] === attackerSlot) {
                const attackerDef = DuelEngine.getDefinition(attackerSlot.card.id);
                // Ragnatela (id 456, Magia Terreno): stesso effetto di
                // Forza d'Attacco Goblin qui sopra, ma per QUALUNQUE mostro
                // che attacca, di ENTRAMBI i lati, finché questa Magia
                // Terreno resta scoperta sul Terreno (di uno qualunque dei
                // due giocatori — non ha un "proprietario" ai fini di
                // questo controllo, come da regola vera). Stessa
                // SEMPLIFICAZIONE sul momento esatto di applicazione/sblocco
                // spiegata sopra.
                const ragnatelaActive = ['playerFieldSpell', 'botFieldSpell'].some((key) => {
                    const fs = gameState[key];
                    return fs && !fs.isFaceDown && fs.card.id === 456;
                });
                const forcesDefense = (attackerDef && attackerDef.forcesDefenseAfterAttack) || ragnatelaActive;
                if (forcesDefense && attackerSlot.position === 'attack') {
                    attackerSlot.position = 'defense';
                    attackerSlot.canChangePosition = false;
                    addToLog(`🛡️ ${attackerSlot.card.name} passa in Posizione di Difesa dopo aver attaccato!`);
                }
            }

            // Il contatore LP parte a scendere SUBITO, in sincrono con il
            // flash/numero di danno epico (già mostrati da resolveBattleDamage
            // qui sopra tramite applyDamage): renderLifePoints() da sola
            // (non il pesante updateUI/renderFields più sotto, che invece
            // aspetta la fine dell'esplosione) tocca solo i box LP, fissi
            // fuori dal field-board, quindi è sicura da chiamare qui.
            EventiDuello.emetti('life-points');

            // L'esplosione (FX.playBattleDestroyEffect) va scatenata QUI,
            // finché il campo mostrato a schermo è ancora quello di PRIMA
            // di questo attacco: updateUI()/clearSelection() più sotto
            // ricostruiscono l'intero field-board da gameState (che ora ha
            // già lo slot a null), staccando dal documento la carta
            // distrutta. Se triggerDestroyEffect girasse DOPO quel
            // ricalcolo — come succedeva prima — troverebbe lo slot già
            // vuoto e l'esplosione non partirebbe mai: la carta spariva di
            // colpo, senza alcuna animazione.
            if (effectiveTargetIndex !== -1) {
                const destroyedSlots = [];
                if (attackerField[attackerIndex] === null) destroyedSlots.push({ owner: attackerOwner, index: attackerIndex });
                if (effectiveDefenderField[effectiveTargetIndex] === null) destroyedSlots.push({ owner: effectiveDefenderOwner, index: effectiveTargetIndex });
                destroyedSlots.forEach(item => EventiDuello.emetti('distruzione', item.owner, item.index, 'monster'));

                // Caso simmetrico: il bersaglio ha RETTO il colpo (il suo
                // slot e' ancora occupato dopo il calcolo). Va letto qui e
                // non altrove per lo stesso motivo dell'esplosione qui
                // sopra — e' l'ultimo istante in cui il campo a schermo e'
                // ancora quello di PRIMA dell'attacco e la carta e' un
                // elemento vivo nel documento.
                if (effectiveDefenderField[effectiveTargetIndex] !== null) {
                    EventiDuello.emetti('attacco-bloccato', effectiveDefenderOwner, effectiveTargetIndex, 'monster', attackerCardEl);
                }
            }

            PassoComune.dopo(() => {
                if (attackerCardEl) attackerCardEl.classList.remove('is-attacking');
                PortaUI.queryAll('.damage-shake').forEach(el => el.classList.remove('damage-shake'));
                if (attackerOwner === 'player') clearSelection(); else updateUI();
                done();
            }, 700);
        }), 500);
    });
}

/**
 * Il calcolo vero e proprio del confronto ATK/DEF: chi viene distrutto,
 * quanti Life Points si perdono. `damageNegated` arriva da un effetto
 * come Kuriboh, che annulla SOLO il danno di questo attacco (le regole
 * vere dicono "annulla il danno", non "annulla la battaglia": i mostri
 * coinvolti si distruggono comunque secondo il normale confronto ATK/DEF).
 */
function resolveBattleDamage(attackerOwner, defenderOwner, attackerIndex, targetIndex, damageNegated, attackerAtkZeroed) {
    const attackerField = fieldOfOwner(attackerOwner);
    const defenderField = fieldOfOwner(defenderOwner);
    const attackerSlot = attackerField[attackerIndex];
    const attacker = attackerSlot.card;
    // ATK effettivo (base + eventuale bonus continuo, es. Maga Oscura):
    // vedi DuelEngine.getEffectiveAtk/getEffectiveDef in duel-engine.js. Il
    // bonus valido SOLO per questo Damage Step (es. Soldati Insetto del
    // Cielo, Soldato Cinetico — DuelEngine.getDamageStepBonus) si aggiunge
    // più sotto, quando/se l'avversario di questa battaglia è noto (non
    // esiste per un attacco diretto).
    const attackerBaseAtk = DuelEngine.getEffectiveAtk(attacker);
    const attackerIsPlayer = attackerOwner === 'player';
    const attackerPrefix = attackerIsPlayer ? '' : '🤖 ';
    // "il tuo"/"" davanti al nome di una carta del difensore, per far
    // capire subito di chi è la carta coinvolta.
    const yourPrefix = defenderOwner === 'player' ? 'il tuo ' : '';

    // `involvedCard` (opzionale) è la carta del giocatore `owner` coinvolta
    // in QUESTA battaglia (l'attaccante se il danno va a attackerOwner, il
    // difensore se va a defenderOwner) — assente per un attacco diretto,
    // dove il giocatore che subisce danno non ha nessun proprio mostro in
    // campo coinvolto. Permette a carte come Amazzone Combattente/
    // Spadaccina di intercettare il PROPRIO danno da battaglia.
    const applyDamage = (owner, amount, involvedCard) => {
        if (damageNegated) {
            addToLog('🐰 Il danno da battaglia di questo attacco è stato annullato!');
            return;
        }
        // Es. Waboku (id 503): "non subisci danno da battaglia in questo
        // turno" — flag per-giocatore con scadenza a fine turno, vedi
        // gameState.noBattleDamageFor (resettato in changeTurn(),
        // game-flow.js) e la registrazione della carta in card-effects.js.
        if (gameState.noBattleDamageFor && gameState.noBattleDamageFor[owner]) {
            addToLog(`🙏 ${owner === 'player' ? 'Non subisci' : 'Il bot non subisce'} danno da battaglia in questo turno!`);
            return;
        }
        // Muro del Tornado (id 489): a differenza di Waboku qui sopra (un
        // flag "per questo turno" impostato una tantum), questa protezione
        // è CONTINUA finché la carta e "Umi" (id 497) restano scoperte sul
        // Terreno — controllata direttamente qui, non tramite
        // gameState.noBattleDamageFor, per non confonderla col reset "una
        // volta a turno" di quel flag in changeTurn() (game-flow.js).
        const umiOnField = ['playerFieldSpell', 'botFieldSpell'].some((key) => {
            const fs = gameState[key];
            return fs && !fs.isFaceDown && fs.card.id === 497;
        });
        if (umiOnField) {
            const ownerSTField = Tavolo.magieTrappole(owner);
            if (ownerSTField.some((slot) => slot && !slot.isFaceDown && slot.card.id === 489)) {
                addToLog(`🌪️ Muro Tornado protegge ${owner === 'player' ? 'te' : 'il bot'} dal danno da battaglia finché "Umi" resta sul Terreno!`);
                return;
            }
        }
        const involvedDef = involvedCard && DuelEngine.getDefinition(involvedCard.id);
        if (involvedDef && involvedDef.redirectOwnBattleDamageToOpponent) {
            const opp = Tavolo.avversario(owner);
            addToLog(`🔄 ${involvedCard.name} redirige il danno da battaglia al tuo avversario!`);
            DuelEngine.actions.dealDamage(opp, amount);
            const oppInfoEl = PortaUI.byId(opp === 'player' ? 'playerInfo' : 'botInfo');
            if (oppInfoEl) oppInfoEl.classList.add('damage-shake');
            EventiDuello.emetti('danno-fluttuante', amount, oppInfoEl, opp);
            return;
        }
        if (involvedDef && involvedDef.preventOwnBattleDamage) {
            addToLog(`🛡️ ${involvedCard.name} impedisce il danno da battaglia!`);
            return;
        }
        DuelEngine.actions.dealDamage(owner, amount);
        const infoEl = PortaUI.byId(owner === 'player' ? 'playerInfo' : 'botInfo');
        if (infoEl) infoEl.classList.add('damage-shake');
        EventiDuello.emetti('danno-fluttuante', amount, infoEl, owner);
        // Vero solo se il danno è DAVVERO arrivato a `owner` (nessuno dei
        // return early qui sopra è scattato) — usato da chi chiama per
        // sapere se registrare quel danno altrove (es. Benedizione di
        // Sebek, id 813: "guadagni Life Points pari al danno da battaglia
        // inflitto con un attacco diretto", solo se il danno non è stato
        // annullato/prevenuto/rediretto).
        return true;
    };

    // Effetto "quando questa carta viene distrutta [in battaglia] e
    // mandata al Cimitero" (es. Germe Gigante, Pomodoro Mistico): va
    // chiamato QUI, subito dopo aver spinto la carta nel suo Cimitero e
    // svuotato lo slot, per ciascun mostro che questa battaglia distrugge
    // — stesso punto d'aggancio già usato per ON_FLIP più sotto in questa
    // funzione.
    // `opponentBattleCard` (opzionale) è l'ALTRO mostro coinvolto in
    // QUESTA battaglia (chi ha attaccato, se `card` era il difensore
    // distrutto; chi difendeva, se `card` era l'attaccante distrutto) —
    // esposto come ctx.destroyedByOpponentCard a onDestroy(ctx), es.
    // Ossigeddon (id 804): "se distrutta in battaglia da un mostro Tipo
    // Piroico". SEMPLIFICAZIONE: presente SOLO per distruzioni in
    // battaglia (qui in resolveBattleDamage) — una distruzione da
    // effetto Carta (ACTIONS.destroyMonster, duel-engine.js) non ha un
    // "altro mostro della battaglia" concettualmente, quindi
    // ctx.destroyedByOpponentCard resta null in quel caso, distinguibile
    // da chi legge il campo.
    // `destroyedWasAttackPosition` (opzionale, boolean): vera se `card`
    // era in Posizione di ATTACCO al momento della distruzione — serve
    // solo a def.onDestroysMonsterByBattle (es. Winged Sage Falcos, id
    // 1109: "quando questa carta distrugge in battaglia un mostro
    // AVVERSARIO scoperto in Posizione di Attacco"), passata dai
    // chiamanti che già sanno la posizione (ognuno dei 6 punti sotto in
    // resolveBattleDamage), `undefined` altrove.
    const fireOnDestroy = (owner, index, card, opponentBattleCard, destroyedWasAttackPosition) => {
        // 747 — Onda di Diffusione: "gli effetti dei mostri distrutti da
        // questi attacchi non possono attivarsi e vengono annullati" —
        // gameState.negatesEffectsOnForcedAttackFor (Set di uid attaccanti,
        // concesso solo da 747, non da 199) marca il bersaglio PRIMA che il
        // suo ON_DESTROY scatti, stesso store/stesso schema di 833 Bestia
        // Ingranaggio Antico (monsterEffectsNegatedUidsFor per l'immediato,
        // negatedEffectsForeverUids per il Cimitero).
        if (opponentBattleCard && gameState.negatesEffectsOnForcedAttackFor && gameState.negatesEffectsOnForcedAttackFor.has(opponentBattleCard.uid)) {
            gameState.monsterEffectsNegatedUidsFor = gameState.monsterEffectsNegatedUidsFor || { player: new Set(), bot: new Set() };
            gameState.monsterEffectsNegatedUidsFor[owner].add(card.uid);
            gameState.negatedEffectsForeverUids = gameState.negatedEffectsForeverUids || new Set();
            gameState.negatedEffectsForeverUids.add(card.uid);
        }
        // Sovrano Oscuro Ha Des (id 1118, Dark Ruler Ha Des): "nega gli
        // effetti dei mostri distrutti in battaglia dai TUOI mostri
        // Demone" — stesso identico schema/store di Onda di Diffusione
        // qui sopra, ma la condizione è "chi ha distrutto `card` era un
        // Demone controllato da chi controlla un Sovrano Oscuro Ha Des
        // scoperto" invece di un uid specifico. gameState.negatesFiendBattleKillsFor
        // (per-owner, ricalcolato ogni render dentro static(), duel-engine.js).
        if (opponentBattleCard && opponentBattleCard.race === 'Demone') {
            const destroyerOwner = Tavolo.avversario(owner);
            if (gameState.negatesFiendBattleKillsFor && gameState.negatesFiendBattleKillsFor[destroyerOwner]) {
                gameState.monsterEffectsNegatedUidsFor = gameState.monsterEffectsNegatedUidsFor || { player: new Set(), bot: new Set() };
                gameState.monsterEffectsNegatedUidsFor[owner].add(card.uid);
                gameState.negatedEffectsForeverUids = gameState.negatedEffectsForeverUids || new Set();
                gameState.negatedEffectsForeverUids.add(card.uid);
            }
        }
        // def.negatesEffectsOfBattleVictims sulla carta CHE distrugge: "gli
        // effetti dei mostri distrutti in battaglia da questa carta vengono
        // annullati" (Balter Oscuro il Terribile id 1043; Lupo Bicefalo id
        // 1114, solo per i Mostri FLIP e solo se controlli un altro Demone).
        // `true` per ogni vittima, oppure una funzione
        // (destroyerOwner, destroyerCard, victimCard) => bool per una
        // condizione. Sta qui, nell'unica funzione da cui passano TUTTI e 6 i
        // modi in cui una battaglia distrugge un mostro, quindi vale sia in
        // attacco sia in difesa (prima 1114 stava su onDestroysMonsterInBattle,
        // che scatta solo quando è l'attaccante a vincere). Stesso schema di
        // Onda di Diffusione qui sopra: si marca PRIMA che l'ON_DESTROY della
        // vittima scatti, così il suo "quando viene distrutta" non parte.
        // Un distruttore con gli effetti a sua volta annullati non annulla
        // niente.
        if (opponentBattleCard) {
            const destroyerOwner = Tavolo.avversario(owner);
            const killerDef = DuelEngine.getDefinition(opponentBattleCard.id);
            const regola = killerDef && killerDef.negatesEffectsOfBattleVictims;
            const negatoIlDistruttore = DuelEngine.isMonsterCardEffectsNegated(destroyerOwner, opponentBattleCard.uid);
            const applica = !negatoIlDistruttore && (regola === true
                || (typeof regola === 'function' && regola(destroyerOwner, opponentBattleCard, card)));
            if (applica) {
                gameState.monsterEffectsNegatedUidsFor = gameState.monsterEffectsNegatedUidsFor || { player: new Set(), bot: new Set() };
                gameState.monsterEffectsNegatedUidsFor[owner].add(card.uid);
                gameState.negatedEffectsForeverUids = gameState.negatedEffectsForeverUids || new Set();
                gameState.negatedEffectsForeverUids.add(card.uid);
                addToLog(`🚫 ${opponentBattleCard.name} annulla gli effetti di ${card.name}!`);
            }
        }
        // `card.battleDestroyedDamageToOpponent` (per-istanza, sulla carta
        // distrutta): "quando questa carta viene distrutta in battaglia,
        // infliggi N danni all'avversario" — nato per il Token di Barattolo
        // Cobra (id 1030), che non ha una registrazione propria a cui
        // appendere un effetto. L'avversario è chi controllava l'altro
        // mostro della battaglia.
        if (opponentBattleCard && card.battleDestroyedDamageToOpponent) {
            const contro = Tavolo.avversario(owner);
            DuelEngine.actions.dealDamage(contro, card.battleDestroyedDamageToOpponent);
            addToLog(`☠️ ${card.name} distrutto in battaglia: ${card.battleDestroyedDamageToOpponent} danni all'avversario!`);
        }
        // Sentinella Cremisi (id 1063, Crimson Sentry): "1 tuo mostro
        // distrutto in battaglia DURANTE QUESTO TURNO" — nuovo tracker
        // generico gameState.battleDestroyedThisTurnFor (per proprietario,
        // azzerato in changeTurn() come ogni altro "per il resto del
        // turno" in questo file, vedi game-flow.js), popolato SOLO qui
        // (l'unico punto per cui passa una distruzione da battaglia,
        // opponentBattleCard non-null lo garantisce) — riusabile da
        // qualunque futura carta con lo stesso bisogno.
        if (opponentBattleCard) {
            gameState.battleDestroyedThisTurnFor = gameState.battleDestroyedThisTurnFor || { player: [], bot: [] };
            gameState.battleDestroyedThisTurnFor[owner].push(card);
        }
        // def.onDestroysMonsterByBattle(ctx) — la carta CHE HA DISTRUTTO
        // `card` in battaglia reagisce dal proprio lato (es. Vampire Baby
        // id 1106/Winged Sage Falcos id 1108/Cavaliere Mistico di
        // Sciacallo id 1109: "quando questa carta ne distrugge un'altra
        // in battaglia"). ATTENZIONE, esiste GIÀ un hook per un bisogno
        // simile, def.onDestroysMonsterInBattle (applyBattleDestroyBonus
        // qui sopra in questo file, usato da id 480/526/625/727/833) —
        // NON sono duplicati/intercambiabili: quell'hook più vecchio
        // scatta SOLO quando l'ATTACCANTE vince distruggendo il
        // difensore (mai su un pareggio o quando è il DIFENSORE a
        // distruggere l'attaccante), mentre questo qui scatta da TUTTI E
        // 6 i punti di fireOnDestroy in resolveBattleDamage, coprendo
        // anche quei 2 casi mancanti — necessario per Vampire Baby/Falcos/
        // Sciacallo, che devono reagire a QUALUNQUE distruzione causata,
        // non solo a un attacco vinto. Nessun conflitto pratico: nessuna
        // carta di questo dataset dichiara entrambi gli hook sulla stessa
        // definizione. Lasciati DELIBERATAMENTE separati invece di
        // consolidarli in uno solo, per non rischiare una regressione nel
        // codice di risoluzione battaglia già testato e stabile che usa
        // onDestroysMonsterInBattle — una futura sessione con più tempo
        // a disposizione potrebbe unificarli. `opponentBattleCard`
        // appartiene sempre all'altro lato rispetto a `owner` (una
        // battaglia coinvolge solo i due giocatori).
        if (opponentBattleCard) {
            const destroyerOwner = Tavolo.avversario(owner);
            const destroyerDef = DuelEngine.getDefinition(opponentBattleCard.id);
            if (destroyerDef && typeof destroyerDef.onDestroysMonsterByBattle === 'function') {
                destroyerDef.onDestroysMonsterByBattle(DuelEngine.makeContext(destroyerOwner, { card: opponentBattleCard, destroyedCard: card, destroyedCardOwner: owner, destroyedWasAttackPosition: !!destroyedWasAttackPosition }));
            }
        }
        DuelEngine.fireTrigger(DuelEngine.TRIGGER.ON_DESTROY, DuelEngine.makeContext(owner, { slotIndex: index, card: card, destroyedByOpponentCard: opponentBattleCard || null }));
    };

    /**
     * Moltiplicatore del danno da battaglia inflitto da `card` (es.
     * Soldato di Susa, "il danno da battaglia inflitto da questa carta è
     * dimezzato" -> 0.5) — def.battleDamageMultiplier, fisso per
     * definizione. 1 se non dichiarato: nessun cambiamento per ogni altra
     * carta del dataset. Applicato ad ognuno dei 3 punti che calcolano un
     * danno da battaglia PRIMA di chiamare applyDamage (attacco diretto,
     * vittoria in Posizione di Attacco, perforazione) — troppo tardi per
     * farlo dentro fireOwnBattleDamageDealt qui sotto, che scatta DOPO che
     * i Life Points sono già scesi.
     */
    const getOwnBattleDamageMultiplier = (card) => {
        const def = window.DuelEngine && DuelEngine.getDefinition(card.id);
        return (def && typeof def.battleDamageMultiplier === 'number') ? def.battleDamageMultiplier : 1;
    };

    /**
     * "Quando questa carta infligge danno da Battaglia ai Life Points del
     * tuo avversario: [effetto]" (es. Cappello Magico Bianco, id 591) —
     * chiamata SOLO nei due rami più comuni (l'attaccante vince in
     * Posizione di Attacco, o perfora in Posizione di Difesa): non nel
     * pareggio o nella ridirezione del danno (redirectOwnBattleDamageToOpponent),
     * dove "chi ha davvero inflitto danno" è ambiguo — SEMPLIFICAZIONE
     * accettata per una carta di nicchia. `damage`: l'importo EFFETTIVO
     * già applicato (dopo un eventuale battleDamageMultiplier) — es.
     * Fushi No Tori, "guadagna LP pari al danno da battaglia inflitto".
     */
    const fireOwnBattleDamageDealt = (attackerCard, victimOwner, effectiveTargetIndex, damage) => {
        const attackerDef = DuelEngine.getDefinition(attackerCard.id);
        // Vassallo dei Guardiani della Tomba (id 893): "il danno da
        // battaglia inflitto da questa carta è trattato come danno da
        // EFFETTO" — nessuna carta che reagisce specificamente al danno
        // da BATTAGLIA (onDealsBattleDamage sopra, onOwnMonsterDealsBattleDamage
        // sotto, es. Goblin Ladro id 610) deve quindi scattare per il suo
        // danno. I Life Points scendono comunque regolarmente (quella
        // parte vive in applyDamage/dealDamage, invariata) — questo
        // flag tocca SOLO le reazioni "sai che era danno da battaglia".
        if (attackerDef && attackerDef.treatBattleDamageAsEffect) return;
        if (attackerDef && typeof attackerDef.onDealsBattleDamage === 'function') {
            // ctx.card = l'attaccante stesso (es. Chimera/Drago Gadjiltron
            // Ingranaggio Antico, id 824/825: leggono flag per-istanza tipo
            // ctx.card._gadjiltronRedGadget) — aggiunto qui, additivo:
            // nessun handler esistente lo leggeva prima, quindi nessun
            // comportamento cambia per chi non lo usa.
            // `damagedOwner`, non `opponent`: quasi sempre coincidono, ma
            // con la ridirezione del danno di Abbandonato (id 416) il
            // danno torna indietro a CHI ATTACCA, e chiamare "opponent" il
            // proprio lato faceva lavorare al contrario ogni carta che
            // legge ctx.opponent qui dentro (Don Zaloog farebbe scartare
            // il proprio controllore, Fenrir salterebbe la PROPRIA
            // pescata). Ora ctx.opponent resta sempre l'avversario vero e
            // chi ha davvero incassato il danno ha un nome suo.
            attackerDef.onDealsBattleDamage(DuelEngine.makeContext(attackerOwner, { card: attackerCard, damagedOwner: victimOwner, targetIndex: effectiveTargetIndex, damage: damage }));
        }
        // "Ogni volta che un mostro che controlli infligge danno da
        // battaglia [...]" (es. Goblin Ladro, id 610) — a differenza di
        // onDealsBattleDamage qui sopra (proprietà del mostro attaccante
        // stesso), questa reagisce dalle Magie/Trappole Continue scoperte
        // sul Terreno di chi controlla l'attaccante, stesso spirito di
        // reactToAnyNormalOrFlipSummon (duel-engine.js) ma per il danno da
        // battaglia.
        const stField = Tavolo.magieTrappole(attackerOwner);
        stField.forEach((slot) => {
            if (!slot || slot.isFaceDown) return;
            const def = DuelEngine.getDefinition(slot.card.id);
            if (def && typeof def.onOwnMonsterDealsBattleDamage === 'function') {
                def.onOwnMonsterDealsBattleDamage(DuelEngine.makeContext(attackerOwner, { damagedOwner: victimOwner, attackerCard: attackerCard }));
            }
        });
    };

    /**
     * "Alla fine del Damage Step, se questa carta ha combattuto [...]"
     * (es. Ryu Kokki id 663, D.D. Guerriera id 716, Guerriero D.D. id
     * 179, Testa di Martello Iper id 800): a differenza di
     * onDealsBattleDamage/applyBattleDestroyBonus qui sopra (solo quando
     * l'attaccante VINCE davvero), questo scatta ogni volta che `card` ha
     * effettivamente combattuto in questo Damage Step E resta ancora sul
     * Terreno dopo la risoluzione — MAI per un attacco diretto (nessun
     * "avversario di battaglia" lì) e MAI per una carta appena distrutta
     * in QUESTA stessa battaglia (SEMPLIFICAZIONE: niente "ultima
     * informazione nota" per una carta già rimossa dal campo, coerente
     * con altre semplificazioni già accettate in questo file).
     * `opponentSurvived` indica se `opponentCard` è ancora sul Terreno
     * dopo la stessa risoluzione (es. Testa di Martello Iper, id 800, ne
     * ha bisogno).
     */
    const fireOwnBattled = (card, owner, opponentCard, opponentSurvived) => {
        // Marcatore generico "ha combattuto in questa Battle Phase" (es.
        // Bestia Mitica Cerbero, id 734: "alla fine della Battle Phase,
        // se questa carta ha combattuto") — scritto per OGNI carta che
        // sopravvive a una battaglia, non solo quelle con un proprio
        // onBattled, così un handler 'onBattlePhaseEnd' (game-flow.js/
        // enterEndPhase) può controllarlo in un secondo momento. Si
        // auto-consuma: chi lo legge lo azzera anche, nessun reset
        // separato necessario.
        card.battledThisBattlePhase = true;
        const def = DuelEngine.getDefinition(card.id);
        if (def && typeof def.onBattled === 'function') {
            def.onBattled(DuelEngine.makeContext(owner, { card: card, opponentCard: opponentCard, opponentSurvived: opponentSurvived }));
        }
        // Una Carta Equipaggiamento agganciata a `card` può reagire anche
        // lei alla battaglia del mostro a cui è agganciata (es. Pugno
        // Ingranaggio Antico, id 840) — stesso spirito di
        // onOwnMonsterDealsBattleDamage qui sopra, ma per l'Equip invece
        // che per una Magia/Trappola Continua qualsiasi sul Terreno.
        const ownerStField = Tavolo.magieTrappole(owner);
        ownerStField.forEach((slot) => {
            if (!slot || slot.isFaceDown || slot.card.equippedToUid !== card.uid) return;
            const eqDef = DuelEngine.getDefinition(slot.card.id);
            if (eqDef && typeof eqDef.onEquippedMonsterBattled === 'function') {
                eqDef.onEquippedMonsterBattled(DuelEngine.makeContext(owner, { equippedCard: card, opponentCard: opponentCard, opponentSurvived: opponentSurvived }));
            }
        });
        // "Se questa carta viene distrutta in battaglia: il mostro che
        // l'ha distrutta [effetto]" (es. Guerriero di Ardesia, id 776) —
        // reazione della carta APPENA distrutta in QUESTA battaglia
        // (`opponentCard`, quando non è sopravvissuta), dal punto di
        // vista del SUO proprietario, con `card` (chi l'ha distrutta)
        // passato come bersaglio dell'effetto — l'unico punto in cui
        // questo motore conosce sia il distruttore sia il distrutto nello
        // stesso momento (SEMPLIFICAZIONE: non scatta se entrambi i lati
        // sono stati distrutti nello stesso pareggio, dato che a quel
        // punto anche `card` è già andata al Cimitero e l'effetto
        // sarebbe comunque ininfluente).
        if (!opponentSurvived) {
            const opponentDef = DuelEngine.getDefinition(opponentCard.id);
            if (opponentDef && typeof opponentDef.onDestroyedInBattle === 'function') {
                const destroyedOwner = Tavolo.avversario(owner);
                opponentDef.onDestroyedInBattle(DuelEngine.makeContext(destroyedOwner, { destroyerCard: card }));
            }
        }
    };

    /**
     * Es. Waboku (id 503): "i tuoi mostri non possono essere distrutti in
     * battaglia in questo turno" — vedi gameState.noBattleDestructionFor
     * (resettato in changeTurn(), game-flow.js). `owner` è il
     * CONTROLLORE del mostro che sta per essere distrutto (attaccante o
     * difensore, la protezione non dipende da chi dei due ha dichiarato
     * l'attacco).
     */
    const survivesBattleDestruction = (owner) => !!(gameState.noBattleDestructionFor && gameState.noBattleDestructionFor[owner]);
    // "Questa carta non può essere distrutta in battaglia" (es. Mietitore
    // Spirituale/Spirit Reaper, id 661) — immunità PER CARTA, sempre
    // attiva, a differenza di survivesBattleDestruction() qui sopra
    // (Waboku, per-PROPRIETARIO, solo per il turno). Controllata in
    // aggiunta ad essa in ognuno dei rami di distruzione qui sotto.
    // def.cannotBeDestroyedByBattle può essere `true` (sempre) oppure una
    // funzione (opponentAtk) => bool per un'immunità CONDIZIONATA (es.
    // Guardiano Celtico Sgradito, id 712: "non distrutta da un mostro con
    // 1900+ ATK" — opponentAtk è l'ATK effettivo dell'altro mostro
    // coinvolto in QUESTO scontro).
    const cardIsIndestructibleByBattle = (card, opponentAtk) => {
        const flag = DuelEngine.getDefinition(card.id)?.cannotBeDestroyedByBattle;
        if (typeof flag === 'function') return !!flag(opponentAtk);
        if (flag) return true;
        // Protezione dalla battaglia per NOME fino alla fine del turno, per
        // i mostri di un giocatore (Amuleto di Shabti id 1059: "fino alla End
        // Phase, i mostri Guardiani della Tomba che controlli non possono
        // essere distrutti in battaglia"): gameState.battleProtectionByName,
        // elenco di { owner, turn, nameIncludes }. Vale per chi li controlla
        // ADESSO (anche se Evocati dopo l'attivazione), e smette da sola al
        // cambio di turno (il confronto col turno non corrisponde più).
        const protezioni = gameState.battleProtectionByName || [];
        if (protezioni.length && card.name) {
            const lato = Tavolo.ordine().find((owner) => Tavolo.mostri(owner).some((s) => s && s.card.uid === card.uid)) || null;
            if (lato && protezioni.some((p) => p.owner === lato && p.turn === gameState.turn && card.name.includes(p.nameIncludes))) return true;
        }
        // 395 — Orgoth l'Implacabile: indistruttibilità TEMPORANEA per uid
        // (lancio dado 1-2), non un flag fisso sulla definizione come sopra
        // — vedi gameState.orgothIndestructibleUids/orgothActiveUidsFor
        // (game-flow.js/changeTurn) per come viene concessa e revocata.
        return !!(gameState.orgothIndestructibleUids && gameState.orgothIndestructibleUids.has(card.uid));
    };

    /**
     * "Quando QUESTA carta distrugge un mostro in battaglia: [danno
     * extra]" (es. Skull Servant, id 526: def.damageOnBattleDestroy = 500)
     * — chiamata SOLO quando l'attaccante vince davvero lo scontro (mai su
     * un pareggio o su una difesa che sopravvive), stesso pattern-flag già
     * usato per redirectOwnBattleDamageToOpponent/preventOwnBattleDamage
     * più sopra in questa funzione.
     */
    const applyBattleDestroyBonus = (attackerCard, victimOwner, attackerOwner, victimCard) => {
        const def = DuelEngine.getDefinition(attackerCard.id);
        const bonus = def?.damageOnBattleDestroy;
        if (bonus) {
            applyDamage(victimOwner, bonus);
            addToLog(`💀 ${attackerCard.name} infligge ${bonus} danni extra per aver distrutto un mostro in battaglia!`);
        }
        // "Quando QUESTA carta distrugge un mostro in battaglia: perde X
        // ATK" (es. Zombyra l'Oscuro, id 625) — riduzione PERMANENTE,
        // scritta direttamente su attackerCard.attack (stesso pattern già
        // usato altrove in card-effects.js per un calo di ATK definitivo),
        // non un bonus turno-per-turno come grantTemporaryAtkDefBonus.
        const atkLoss = def?.atkLossOnBattleDestroy;
        if (atkLoss) {
            attackerCard.attack = Math.max(0, attackerCard.attack - atkLoss);
            addToLog(`💀 ${attackerCard.name} perde ${atkLoss} ATK per aver distrutto un mostro in battaglia!`);
        }
        // Aggancio generico per un effetto CUSTOM (non solo danno/calo ATK
        // fissi) "quando questa carta distrugge un mostro in battaglia" —
        // es. Divoratempo (id 480: l'avversario salta la sua prossima Main
        // Phase 1, vedi gameState.skipMainPhase1For in game-flow.js).
        if (typeof def?.onDestroysMonsterInBattle === 'function') {
            def.onDestroysMonsterInBattle(DuelEngine.makeContext(attackerOwner, { card: attackerCard, destroyedCard: victimCard || null }));
        }
        // Anche una Carta Equipaggiamento agganciata all'attaccante può
        // avere il proprio onDestroysMonsterInBattle (es. Flamberge del
        // Male Infranto - Baou, id 727: "annulla gli effetti dei mostri
        // dell'avversario distrutti in battaglia dal mostro equipaggiato")
        // — stesso spirito/stessa ricerca sui due stField di
        // getDamageStepBonus (duel-engine.js), qui per un evento invece
        // che per un bonus numerico. ctx.owner è il lato DOVE SIEDE
        // FISICAMENTE la Carta Equipaggiamento (il suo vero controllore,
        // che può essere diverso dal controllore del mostro equipaggiato,
        // es. Baou equipaggiata a un mostro avversario) — "il tuo
        // avversario" nel testo reale è sempre relativo a QUESTO lato, non
        // al controllore dell'attaccante.
        Tavolo.ordine().forEach((stOwner) => {
            (Tavolo.magieTrappole(stOwner)).forEach((slot) => {
                if (!slot || slot.isFaceDown) return;
                const eqDef = DuelEngine.getDefinition(slot.card.id);
                if (!eqDef || !eqDef.isEquip || slot.card.equippedToUid !== attackerCard.uid) return;
                if (typeof eqDef.onDestroysMonsterInBattle !== 'function') return;
                eqDef.onDestroysMonsterInBattle(DuelEngine.makeContext(stOwner, { card: slot.card, equippedCard: attackerCard, equippedCardOwner: attackerOwner, destroyedCard: victimCard || null, destroyedCardOwner: victimOwner }));
            });
        });
    };

    // Mostri Union (def.isUnion, es. Testa di Drago Y id 513, Carro Armato
    // Metallico Z id 515): "se il mostro equipaggiato dovrebbe essere
    // distrutto, questa carta viene distrutta al suo posto" — anche da
    // BATTAGLIA, non solo da effetto Carta (quello passa già da
    // ACTIONS.destroyMonster/duel-engine.js). Stesso identico schema delle
    // immunità già presenti (survivesBattleDestruction/
    // cardIsIndestructibleByBattle): se un Mostro Union protegge `card`,
    // DuelEngine.tryRedirectUnionDestroy distrugge lui al suo posto (side
    // effect) e questa funzione torna true, così il chiamante tratta
    // `card` come sopravvissuto — un solo punto condiviso da tutti i rami
    // di distruzione da battaglia qui sotto, invece di ripetere la stessa
    // logica in ognuno.
    // def.onWouldBeDestroyedInBattle(ctx) — es. Abbandonato/Relinquished
    // (id 416), Restrizione dai Mille Occhi (id 476): "se questa carta
    // dovrebbe essere distrutta IN BATTAGLIA, distruggi il mostro
    // equipaggiato/assorbito al posto suo" — un secondo opt-in, generico
    // come tryRedirectUnionDestroy qui sopra ma nella direzione OPPOSTA
    // (protegge la carta STESSA sacrificando quella che tiene agganciata,
    // non il contrario). ctx.cancel()-style: torna true se ha gestito il
    // redirect (la carta sopravvive), false/undefined altrimenti.
    const survivesOrUnionRedirected = (owner, card, opponentAtk, extraSurviveCondition) => {
        if (extraSurviveCondition || survivesBattleDestruction(owner) || cardIsIndestructibleByBattle(card, opponentAtk)) return true;
        if (window.DuelEngine && DuelEngine.tryProtectToonWithWorld(owner, card)) return true;
        if (window.DuelEngine && DuelEngine.tryRedirectUnionDestroy(owner, card.uid, card.name)) return true;
        const def = window.DuelEngine && DuelEngine.getDefinition(card.id);
        if (def && typeof def.onWouldBeDestroyedInBattle === 'function') {
            return !!def.onWouldBeDestroyedInBattle(DuelEngine.makeContext(owner, { card: card }));
        }
        return false;
    };

    if (targetIndex === -1) {
        EventiDuello.emetti('avviso-attacco-diretto');
        if (window.SFX) SFX.directHit();
        // Nessun "altro mostro" in un attacco diretto: i bonus Damage Step
        // condizionati a un avversario specifico (es. Soldati Insetto del
        // Cielo) non si applicano mai qui, coerentemente con le regole vere.
        const attackerAtk = attackerBaseAtk + DuelEngine.getDamageStepBonus(attacker, null, 'attacker').atk;
        const damage = Math.floor(attackerAtk * getOwnBattleDamageMultiplier(attacker));
        const damageLanded = applyDamage(defenderOwner, damage);
        // Benedizione di Sebek (id 813): ricordato per proprietario
        // dell'ATTACCANTE (non del difensore che l'ha subito), azzerato
        // ad ogni cambio turno (changeTurn(), game-flow.js) — sovrascrive
        // un eventuale attacco diretto precedente nello stesso turno
        // (SEMPLIFICAZIONE: solo l'ultimo resta utilizzabile).
        if (damageLanded) {
            gameState.directAttackDamageFor = gameState.directAttackDamageFor || {};
            gameState.directAttackDamageFor[attackerOwner] = damage;
        }
        fireOwnBattleDamageDealt(attacker, defenderOwner, -1, damage);
        addToLog(`${attackerPrefix}🔥 Attacco diretto! ${attacker.name} ${damageNegated ? 'avrebbe inflitto' : 'infligge'} ${damage} danni!`);
    } else {
        const targetSlot = defenderField[targetIndex];
        const target = targetSlot.card;
        // Bonus valido solo per QUESTO Damage Step, su entrambi i lati
        // della battaglia (es. Soldati Insetto del Cielo se attacca,
        // Soldato Cinetico se attacca O difende) — vedi damageStepBonus(ctx)
        // in card-effects.js.
        // Es. Suijin/Kazejin (zeroAttackerAtk in declareCtx, ON_ATTACK_DECLARE):
        // l'ATK dell'attaccante diventa 0 per QUESTO scontro, prima ancora
        // del bonus Damage Step (che comunque non si applica più: 0 resta 0).
        const attackerAtk = attackerAtkZeroed ? 0 : attackerBaseAtk + DuelEngine.getDamageStepBonus(attacker, target, 'attacker').atk;
        const targetDmgBonus = DuelEngine.getDamageStepBonus(target, attacker, 'defender');
        const targetAtk = DuelEngine.getEffectiveAtk(target) + targetDmgBonus.atk;
        const targetDef = DuelEngine.getEffectiveDef(target) + targetDmgBonus.def;
        addToLog(`${attackerPrefix}⚔️ ${attacker.name} attacca ${yourPrefix}${target.name}!`);
        if (attackerAtkZeroed) addToLog(`💧 L'ATK di ${attacker.name} è stato azzerato per questo scontro!`);

        // 199/747 — "deve attaccare tutti i mostri avversari, una volta
        // ciascuno": questo attacco appena dichiarato soddisfa l'obbligo
        // per `target` (a prescindere dall'esito — la regola vera chiede
        // solo di dichiarare l'attacco, non di distruggerlo), tolto dal
        // Set che handlePhaseStepperClick (game-flow.js) controlla prima
        // di lasciare uscire dalla Battle Phase.
        if (gameState.mustAttackTargetUidsFor && gameState.mustAttackTargetUidsFor[attacker.uid]) {
            gameState.mustAttackTargetUidsFor[attacker.uid].delete(target.uid);
        }

        if (targetSlot.position === 'attack') {
            if (attackerAtk > targetAtk) {
                const damage = Math.floor((attackerAtk - targetAtk) * getOwnBattleDamageMultiplier(attacker));
                const targetSurvivesThisBattle = survivesOrUnionRedirected(defenderOwner, target, attackerAtk);
                // Abbandonato (id 416): "se distrutta in battaglia, il
                // mostro assorbito viene distrutto al suo posto E il danno
                // da quella battaglia va all'avversario invece che al
                // proprietario" — target._redirectBattleDamageToOpponent,
                // impostato dal proprio onWouldBeDestroyedInBattle (dentro
                // survivesOrUnionRedirected qui sopra) SOLO per questa
                // carta. Per questo la sopravvivenza va calcolata PRIMA di
                // applicare il danno, non dopo come per ogni altra
                // battaglia: qui è l'UNICO punto che sa già a chi va
                // davvero indirizzato.
                const redirectDamage = targetSurvivesThisBattle && target._redirectBattleDamageToOpponent;
                if (redirectDamage) target._redirectBattleDamageToOpponent = false;
                const damageOwner = redirectDamage ? attackerOwner : defenderOwner;
                applyDamage(damageOwner, damage, target);
                fireOwnBattleDamageDealt(attacker, damageOwner, targetIndex, damage);
                if (targetSurvivesThisBattle) {
                    addToLog(`🙏 ${yourPrefix}${target.name} non viene distrutto in battaglia in questo turno!`);
                    fireOwnBattled(target, defenderOwner, attacker, true);
                } else {
                    graveyardOfOwner(defenderOwner).push(target);
                    if (window.DuelEngine) DuelEngine.redirectToBanishIfFlagged(defenderOwner, target);
                    defenderField[targetIndex] = null;
                    addToLog(`💥 ${yourPrefix}${target.name} distrutto! ${defenderOwner === 'player' ? 'Perdi' : 'Il bot perde'} ${damage} LP.`);
                    applyBattleDestroyBonus(attacker, defenderOwner, attackerOwner, target);
                    fireOnDestroy(defenderOwner, targetIndex, target, attacker, true);
                }
                fireOwnBattled(attacker, attackerOwner, target, targetSurvivesThisBattle);
            } else if (attackerAtk < targetAtk) {
                const damage = targetAtk - attackerAtk;
                const attackerSurvivesThisBattle = survivesOrUnionRedirected(attackerOwner, attacker, targetAtk);
                // Abbandonato (id 416): stesso redirect di sopra, ma quando
                // è l'ATTACCANTE (non il difensore) a controllare
                // Abbandonato e a sopravvivere grazie al mostro assorbito.
                const redirectDamage = attackerSurvivesThisBattle && attacker._redirectBattleDamageToOpponent;
                if (redirectDamage) attacker._redirectBattleDamageToOpponent = false;
                const damageOwner = redirectDamage ? defenderOwner : attackerOwner;
                applyDamage(damageOwner, damage, attacker);
                if (attackerSurvivesThisBattle) {
                    addToLog(`🙏 ${attackerIsPlayer ? '' : 'Il '}${attacker.name}${attackerIsPlayer ? '' : ' del bot'} non viene distrutto in battaglia in questo turno!`);
                    fireOwnBattled(attacker, attackerOwner, target, true);
                } else {
                    graveyardOfOwner(attackerOwner).push(attacker);
                    if (window.DuelEngine) DuelEngine.redirectToBanishIfFlagged(attackerOwner, attacker);
                    attackerField[attackerIndex] = null;
                    addToLog(`💀 ${attackerIsPlayer ? '' : 'Il '}${attacker.name}${attackerIsPlayer ? '' : ' del bot'} distrutto! ${attackerOwner === 'player' ? 'Perdi' : 'Il bot perde'} ${damage} LP.`);
                    fireOnDestroy(attackerOwner, attackerIndex, attacker, target, true);
                }
                fireOwnBattled(target, defenderOwner, attacker, attackerSurvivesThisBattle);
            } else {
                // Pareggio: normalmente entrambe distrutte, salvo
                // un'immunità specifica come quella di Kaiser Glider (id
                // 320) — "non può essere distrutta in battaglia da un
                // mostro con lo stesso ATK" — o Waboku (id 503) per uno o
                // entrambi i lati.
                const attackerSurvives = survivesOrUnionRedirected(attackerOwner, attacker, targetAtk, !!DuelEngine.getDefinition(attacker.id)?.survivesEqualAtkBattle);
                const targetSurvives = survivesOrUnionRedirected(defenderOwner, target, attackerAtk, !!DuelEngine.getDefinition(target.id)?.survivesEqualAtkBattle);
                if (!attackerSurvives) {
                    graveyardOfOwner(attackerOwner).push(attacker);
                    if (window.DuelEngine) DuelEngine.redirectToBanishIfFlagged(attackerOwner, attacker);
                    attackerField[attackerIndex] = null;
                }
                if (!targetSurvives) {
                    graveyardOfOwner(defenderOwner).push(target);
                    if (window.DuelEngine) DuelEngine.redirectToBanishIfFlagged(defenderOwner, target);
                    defenderField[targetIndex] = null;
                }
                addToLog(attackerSurvives || targetSurvives
                    ? `💫 Pareggio, ma ${attackerSurvives ? attacker.name : target.name} è immune e sopravvive!`
                    : '💫 Entrambe le carte sono distrutte!');
                if (!attackerSurvives) fireOnDestroy(attackerOwner, attackerIndex, attacker, target, true);
                if (!targetSurvives) fireOnDestroy(defenderOwner, targetIndex, target, attacker, true);
                if (attackerSurvives) fireOwnBattled(attacker, attackerOwner, target, targetSurvives);
                if (targetSurvives) fireOwnBattled(target, defenderOwner, attacker, attackerSurvives);
            }
        } else {
            // def.instantlyDestroysFaceDownDefender: "All'inizio del Damage
            // Step, se questa carta attacca un mostro coperto in
            // Posizione di Difesa: distruggilo (niente danno né calcolo)"
            // — es. Paladino del Drago Bianco (id 398), Spadaccino Mistico
            // LV2 (id 718) — caso speciale isolato, PRIMA di qualunque
            // confronto ATK/DEF o rivelazione normale: il mostro coperto
            // viene distrutto direttamente.
            if (DuelEngine.getDefinition(attacker.id)?.instantlyDestroysFaceDownDefender && targetSlot.isFaceDown) {
                graveyardOfOwner(defenderOwner).push(target);
                DuelEngine.redirectToBanishIfFlagged(defenderOwner, target);
                defenderField[targetIndex] = null;
                addToLog(`⚔️ ${attacker.name} distrugge istantaneamente ${yourPrefix}il mostro coperto, senza calcolo dei danni!`);
                applyBattleDestroyBonus(attacker, defenderOwner, attackerOwner, target);
                fireOnDestroy(defenderOwner, targetIndex, target, attacker, false);
                fireOwnBattled(attacker, attackerOwner, target, false);
                return;
            }
            // Sfera Esplosiva / Blast Sphere (id 120): "se un mostro
            // dell'avversario attacca questa carta coperta in Posizione di
            // Difesa: si equipaggia al mostro attaccante, senza calcolo dei
            // danni. Distruggi il mostro equipaggiato e questa carta alla
            // Standby Phase del prossimo turno del tuo avversario e
            // infliggigli danno pari all'ATK del mostro equipaggiato" —
            // stesso caso speciale isolato di id 398 qui sopra (PRIMA di
            // qualunque confronto ATK/DEF), ma con detonazione ritardata
            // invece di distruzione immediata (vedi
            // gameState.pendingBlastSphereDetonations,
            // DuelEngine.processPendingBlastSphereDetonations).
            if (target.id === 120 && targetSlot.isFaceDown) {
                defenderField[targetIndex] = null;
                gameState.pendingBlastSphereDetonations = gameState.pendingBlastSphereDetonations || [];
                gameState.pendingBlastSphereDetonations.push({ sferaCard: target, sferaOwner: defenderOwner, attackerUid: attacker.uid, attackerOwner: attackerOwner, standbysRemaining: 1 });
                addToLog(`💣 ${yourPrefix}${target.name} si equipaggia a ${attacker.name}, senza calcolo dei danni! Detonerà alla prossima Standby Phase ${attackerOwner === 'player' ? 'tua' : 'del bot'}.`);
                fireOwnBattled(attacker, attackerOwner, target, true);
                return;
            }
            // Kiseitai (id 328): stesso caso speciale isolato di Sfera
            // Esplosiva/id 120 qui sopra (si equipaggia all'attaccante,
            // senza calcolo dei danni), ma PERSISTENTE invece che a
            // conto alla rovescia: cura Life Points pari a metà dell'ATK
            // del mostro equipaggiato ad OGNI Standby Phase dell'attaccante
            // (gameState.kiseitaiEquips, DuelEngine.processKiseitaiLifeGain),
            // finché il mostro equipaggiato resta sul Terreno.
            if (target.id === 328 && targetSlot.isFaceDown) {
                defenderField[targetIndex] = null;
                gameState.kiseitaiEquips = gameState.kiseitaiEquips || [];
                gameState.kiseitaiEquips.push({ kiseitaiCard: target, kiseitaiOwner: defenderOwner, attackerUid: attacker.uid, attackerOwner: attackerOwner });
                addToLog(`🦠 ${yourPrefix}${target.name} si equipaggia a ${attacker.name}, senza calcolo dei danni!`);
                fireOwnBattled(attacker, attackerOwner, target, true);
                return;
            }
            // def.alwaysDestroysDefensePositionTarget (es. Paladino del
            // Drago Oscuro, id 855): "a inizio Damage Step, se questa carta
            // attacca un mostro in Posizione di Difesa: distruggilo" — a
            // differenza di instantlyDestroysFaceDownDefender (id 398/718,
            // salta TUTTO il calcolo danni ed è solo per bersagli coperti),
            // qui il calcolo danni si applica normalmente (l'attaccante
            // subisce comunque il rimbalzo se ATK < DEF), il difensore
            // viene distrutto in OGNI caso, non solo quando ATK > DEF.
            const forcedDefenseDestroy = !!(window.DuelEngine && DuelEngine.getDefinition(attacker.id)?.alwaysDestroysDefensePositionTarget);
            const willBeDestroyed = attackerAtk > targetDef || forcedDefenseDestroy;
            // Un Mostro Union che protegge `target` (controllo PURO, senza
            // eseguire ancora il redirect): se disponibile, il difensore
            // NON verrà davvero distrutto (solo l'equip Union lo sarà, più
            // sotto) — serve qui solo per far comportare il flip
            // 3D/ON_FLIP come se il difensore sopravvivesse, dato che è
            // proprio quello che succede con l'union redirect.
            const unionMightProtectTarget = willBeDestroyed && window.DuelEngine && DuelEngine.hasUnionProtector(defenderOwner, target.uid);
            const revealsAsIfSurviving = !willBeDestroyed || unionMightProtectTarget;
            let targetSurvivedThisBattle = true;
            if (targetSlot.isFaceDown) {
                targetSlot.isFaceDown = false;
                addToLog(`🔎 ${yourPrefix ? 'Il tuo mostro coperto' : 'Il mostro coperto'} era ${target.name}!`);
                // Il flip 3D si vede solo se il mostro SOPRAVVIVE alla
                // rivelazione: se sta per essere distrutto qui sotto,
                // l'esplosione (triggerDestroyEffect, scatenata dopo il
                // ritorno di questa funzione) è già di per sé la sua
                // "rivelazione" — farle partire entrambe sullo stesso
                // elemento nello stesso istante le farebbe accavallare.
                if (revealsAsIfSurviving && window.CardRenderer && typeof CardRenderer.playFlipReveal === 'function') {
                    const defenderBoardId = defenderOwner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
                    const targetSlotEl = PortaUI.query(`#${defenderBoardId} .field-slot[data-owner="${defenderOwner}"][data-type="monster"][data-index="${targetIndex}"]`);
                    if (targetSlotEl) CardRenderer.playFlipReveal(targetSlotEl, target, 'defense');
                }
                // Effetto FLIP (es. Insetto Divoratore Mostruoso, id 49): il
                // punto d'aggancio TRIGGER.ON_FLIP esisteva già in
                // duel-engine.js ma non veniva mai richiamato da nessuna
                // parte del gioco, quindi nessuna carta FLIP poteva mai
                // attivarsi. Solo se sopravvive (stesso motivo del flip 3D
                // qui sopra: una carta appena distrutta non ha più un
                // effetto da attivare) — questa stessa regola generale
                // soddisfa già per costruzione il testo di Lady Arpia 2
                // (id 783, "annulla gli effetti dei Mostri Flip che questa
                // carta distrugge in battaglia"): un Mostro Flip distrutto
                // in battaglia non attiva MAI il proprio effetto in questo
                // motore, per qualunque attaccante, quindi nessuna
                // registrazione dedicata serve per quella clausola.
                if (revealsAsIfSurviving && window.DuelEngine) {
                    const flipCtx = DuelEngine.makeContext(defenderOwner, { card: target, slotIndex: targetIndex });
                    DuelEngine.fireTrigger(DuelEngine.TRIGGER.ON_FLIP, flipCtx);
                }
            }
            if (willBeDestroyed && survivesOrUnionRedirected(defenderOwner, target, attackerAtk)) {
                addToLog(`🙏 ${yourPrefix}${target.name} non viene distrutto in battaglia in questo turno!`);
            } else if (willBeDestroyed) {
                targetSurvivedThisBattle = false;
                graveyardOfOwner(defenderOwner).push(target);
                if (window.DuelEngine) DuelEngine.redirectToBanishIfFlagged(defenderOwner, target);
                defenderField[targetIndex] = null;
                addToLog(`🛡️ ${yourPrefix}${target.name} è stato distrutto in Posizione di Difesa!`);
                // Danno perforante (es. Parshath il Cavaliere Alato, id 82):
                // se l'attaccante ha def.piercing, l'eccesso di ATK sopra la
                // DEF del difensore passa come danno diretto — stesso
                // meccanismo del ramo "Posizione di Attacco" più sopra, solo
                // per le carte che lo dichiarano esplicitamente (la regola
                // vera: normalmente un mostro in Difesa NON infligge/subisce
                // danno da LP quando viene distrutto in battaglia).
                // def.piercing: fisso sulla carta (es. Parshath). hasRacePiercing:
                // esteso a un intero Tipo mostro da un effetto continuo
                // ALTROVE sul campo (es. Furia del Drago, id 212, "i propri
                // mostri Tipo Drago infliggono danno perforante") — vedi
                // gameState.piercingRacesFor in duel-engine.js. Solo se
                // attackerAtk > targetDef: con forcedDefenseDestroy (id
                // 855) il difensore può essere distrutto anche con ATK <=
                // DEF, dove "l'eccesso" sarebbe negativo/nullo.
                const attackerPiercing = attackerAtk > targetDef && (DuelEngine.getDefinition(attacker.id)?.piercing || DuelEngine.hasRacePiercing(attackerOwner, attacker.race) || DuelEngine.hasUidPiercing(attackerOwner, attacker.uid));
                if (attackerPiercing) {
                    const pierceDamage = Math.floor((attackerAtk - targetDef) * getOwnBattleDamageMultiplier(attacker));
                    applyDamage(defenderOwner, pierceDamage, target);
                    fireOwnBattleDamageDealt(attacker, defenderOwner, targetIndex, pierceDamage);
                    addToLog(`🗡️ Danno perforante! ${defenderOwner === 'player' ? 'Perdi' : 'Il bot perde'} ${pierceDamage} LP.`);
                }
                // 855 — Paladino del Drago Oscuro: "il calcolo dei danni si
                // applica normalmente" — se ATK < DEF, l'attaccante subisce
                // comunque il normale rimbalzo di danno (stesso calcolo del
                // ramo "attackerAtk < targetDef" più sotto, che qui non
                // viene mai raggiunto perché willBeDestroyed è già true).
                if (forcedDefenseDestroy && attackerAtk < targetDef) {
                    const bounceDamage = targetDef - attackerAtk;
                    applyDamage(attackerOwner, bounceDamage, attacker);
                    addToLog(`🧱 ${attackerIsPlayer ? '' : 'Il bot '}subisce comunque il rimbalzo del danno! ${attackerOwner === 'player' ? 'Perdi' : 'Il bot perde'} ${bounceDamage} LP.`);
                }
                applyBattleDestroyBonus(attacker, defenderOwner, attackerOwner, target);
                fireOnDestroy(defenderOwner, targetIndex, target, attacker, false);
            } else if (attackerAtk < targetDef) {
                let damage = targetDef - attackerAtk;
                // Canyon (id 767): raddoppia questo danno se il difensore è
                // Tipo Roccia e Canyon è scoperta come Magia Terreno (di
                // uno qualsiasi dei due giocatori: una Magia Terreno
                // riguarda l'intero Terreno, non solo chi la controlla,
                // stesso spirito di Umi/id 497) — unico punto in cui
                // l'attaccante subisce danno per aver attaccato un mostro
                // in Difesa più forte, quindi il posto giusto per un
                // moltiplicatore così di nicchia.
                const canyonActive = Tavolo.ordine().map((owner) => Tavolo.magiaTerreno(owner))
                    .some((fs) => fs && !fs.isFaceDown && fs.card.id === 767);
                if (target.race === 'Roccia' && canyonActive) {
                    damage *= 2;
                    addToLog('🏜️ Canyon raddoppia il danno da battaglia!');
                }
                // Statua di Pietra degli Aztechi (id 758): "Double any
                // Battle Damage your opponent takes when they attack this
                // monster" — raddoppio legato alla carta stessa (si somma
                // moltiplicativamente a Canyon qui sopra, sono due
                // moltiplicatori distinti e indipendenti).
                if (target.id === 758) {
                    damage *= 2;
                    addToLog('🗿 Statua di Pietra degli Aztechi raddoppia il danno da battaglia!');
                }
                applyDamage(attackerOwner, damage, attacker);
                addToLog(`🧱 L'attacco ${attackerIsPlayer ? '' : 'del bot '}rimbalza! ${attackerOwner === 'player' ? 'Perdi' : 'Il bot perde'} ${damage} LP.`);
            } else {
                addToLog(`🛡️ L'attacco ${attackerIsPlayer ? '' : 'del bot '}non ha effetto.`);
            }
            // L'attaccante non viene MAI distrutto attaccando un mostro in
            // Posizione di Difesa in questo motore (coerente con le regole
            // vere): sopravvive sempre a questo ramo.
            fireOwnBattled(attacker, attackerOwner, target, targetSurvivedThisBattle);
            if (targetSurvivedThisBattle) fireOwnBattled(target, defenderOwner, attacker, true);
        }
    }
}

/**
 * Comando 'attacca': il mostro del posto `posto` nella casella
 * `c.attaccante` attacca il bersaglio `c.bersaglio` (-1 = attacco diretto).
 * Paga prima il costo della carta, se ne ha uno:
 *  - "paga N Life Points per dichiarare un attacco" (def.requiresLifePointsToAttack,
 *    Drago Toon Occhi Blu id 123, Manga Ryu-Ran id 606): lo calcola
 *    l'esecutore dalla carta, uguale sui due telefoni;
 *  - "sacrifica 1 mostro" (def.requiresTributeToAttack, Guerriero Pantera
 *    id 399): QUALE mostro è una scelta, e arriva nel comando (c.tributo).
 *    Senza, l'attacco non parte.
 * `extra.alTermine`: richiamata a battaglia risolta (chi l'aspetta).
 */
function eseguiAttacco(posto, c, extra) {
    const alTermine = extra && typeof extra.alTermine === 'function' ? extra.alTermine : undefined;
    // Un attacco rifiutato chiama comunque alTermine: chi lo aspetta (l'IA)
    // resterebbe fermo per sempre.
    const rifiutato = () => { if (alTermine) alTermine(); };
    const attackerSlot = Tavolo.mostri(posto)[c.attaccante];
    if (!attackerSlot) { rifiutato(); return; }
    const def = window.DuelEngine && DuelEngine.getDefinition(attackerSlot.card.id);
    if (def && def.requiresLifePointsToAttack) {
        const cost = def.requiresLifePointsToAttack;
        if (Tavolo.lp(posto) <= cost) { rifiutato(); return; }
        DuelEngine.actions.dealDamage(posto, cost);
        addToLog(`💸 ${attackerSlot.card.name} paga ${cost} Life Points per attaccare!`);
    }
    if (def && def.requiresTributeToAttack) {
        const sacrificato = typeof c.tributo === 'number' ? Tavolo.mostri(posto)[c.tributo] : null;
        if (!sacrificato || c.tributo === c.attaccante) { rifiutato(); return; }
        // Un Sacrificio come COSTO, non per un'Evocazione Tributo: nessuna
        // carta per cui si sacrifica (notifySacrificedForTribute in
        // duel-engine.js distingue i due casi proprio da lì) e nessuna
        // animazione da aspettare — attesa 0, la carta sparisce subito.
        // Prima, in Multiplayer, l'avversario aspettava sempre i 700ms di
        // un'Evocazione Tributo, e nel frattempo arrivava già l'attacco:
        // calcolato con il mostro GIÀ nel Cimitero da una parte e ANCORA in
        // campo dall'altra.
        eseguiTributo(posto, { indici: [c.tributo], attesaMs: 0 }, {});
        addToLog(`🔻 ${perChi(posto, 'Sacrifichi', 'L\'avversario sacrifica')} ${sacrificato.card.name} per permettere l'attacco.`);
    }
    resolveAttack(posto, c.attaccante, c.bersaglio, alTermine);
}
