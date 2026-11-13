// @ts-check
/**
 * ai-controller.js — Punto d'accesso UNICO alle decisioni del bot.
 * js/ai/bot.js (l'ESECUTORE: animazioni, timer, applica la decisione al
 * gameState) chiama sempre BotAI.*, mai direttamente AI_MEDIUM/AI_HARD —
 * così cambiare/aggiungere un livello di difficoltà non richiede toccare
 * bot.js. Il livello attivo è gameState.botDifficulty ('easy' | 'medium' |
 * 'hard'), default 'medium' (= comportamento del bot di sempre per chi
 * non sceglie nulla, es. il Duello Demo).
 *
 * STORIA, per chi si chiede perché 'easy' non ha un proprio ramo qui
 * sotto: un "Facile" era già esistito come una TERZA IA vera e propria,
 * rimosso su richiesta esplicita dell'utente perché "troppo poco
 * distinguibile dagli altri due, restava solo rumore" — la differenza di
 * COMPORTAMENTO fra un'IA e l'altra era troppo sottile per notarla
 * giocando. Richiesto di nuovo, più tardi, ma stavolta 'easy' usa
 * DELIBERATAMENTE la stessa IA di 'medium' (vedi currentLevel() qui
 * sotto: qualunque valore diverso da 'hard' cade già su AI_MEDIUM, senza
 * bisogno di un ramo dedicato) — la differenza vera sta nel MAZZO
 * dell'avversario, molto più debole (vedi
 * i mazzi `easy` e le REGOLE_PER_LIVELLO in js/data/character-decks.js), non nell'IA: è
 * quello il problema segnalato ("i deck sono troppo forti"), e stavolta
 * la differenza si VEDE sul campo invece di dover essere dedotta dallo
 * stile di gioco del bot.
 *
 * Solo lato client: come il resto del motore, non richiede nulla dal
 * server (vedi server/server.js, un puro relay) — compatibile con
 * Multiplayer perché ogni client valuta solo le PROPRIE decisioni (il
 * bot non esiste nemmeno in una partita Multiplayer reale, ma questi
 * stessi livelli restano lì pronti per un eventuale "gioca contro IA"
 * anche in quel contesto in futuro).
 *
 * DEBUG: imposta window.AI_DEBUG = true in console per vedere ogni
 * decisione (livello, dati in ingresso, scelta) loggata qui sotto.
 */
(function () {
    'use strict';

    /**
     * Il livello dell'IA che gioca dal posto `io` (vedi js/engine/tavolo.js).
     * Ogni posto può averne uno suo (`gameState.livelloIA[io]`, impostato
     * per esempio dal duello senza testa per un IA contro IA); se manca vale
     * `gameState.botDifficulty`, il livello scelto per l'avversario, come
     * prima che l'IA potesse sedersi anche dall'altra parte.
     */
    /** @param {Owner} [io] @returns {string} */
    function currentLevelName(io) {
        if (typeof gameState === 'undefined') return 'medium';
        const perPosto = gameState.livelloIA && io && gameState.livelloIA[io];
        return perPosto || gameState.botDifficulty || 'medium';
    }

    /** Il modulo IA del livello attivo, con ripiego su IA_MEDIA se quel livello non è caricato per qualche motivo. */
    /** @param {Owner} [io] @returns {AIHard | AIMedium | null} */
    function currentLevel(io) {
        const name = currentLevelName(io);
        if (name === 'hard' && window.AI_HARD) return window.AI_HARD;
        return window.AI_MEDIUM || window.AI_HARD || null;
    }

    /** @param {string} label @param {unknown} data @param {Owner} [io] */
    function debugLog(label, data, io) {
        if (window.AI_DEBUG) {
            console.log(`[BotAI:${io || 'bot'}:${currentLevelName(io)}] ${label}`, data);
        }
    }

    // `io`, in ogni funzione qui sotto: il posto da cui gioca l'IA ('bot'
    // se omesso, come sempre). Vedi js/engine/tavolo.js.
    /** @param {GameState} gameStateArg @param {Owner} [io] @returns {AISummonDecision | null} */
    function chooseSummon(gameStateArg, io = 'bot') {
        const level = currentLevel(io);
        const decision = level ? level.chooseSummon(gameStateArg, io) : null;
        debugLog('chooseSummon', decision ? { card: decision.card.name, tributi: decision.tributeIndices.length } : null, io);
        return decision;
    }

    /** @param {GameState} gameStateArg @param {Owner} [io] @returns {{ card: Card; handIndex: number } | null} */
    function chooseHandSpecialSummon(gameStateArg, io = 'bot') {
        const level = currentLevel(io);
        const decision = level && typeof level.chooseHandSpecialSummon === 'function'
            ? level.chooseHandSpecialSummon(gameStateArg, io) : null;
        debugLog('chooseHandSpecialSummon', decision ? { card: decision.card.name } : null, io);
        return decision;
    }

    /** @param {GameState} gameStateArg @param {Owner} [io] @returns {AIHandAction | null} */
    function choosePreSummonSpellAction(gameStateArg, io = 'bot') {
        const level = currentLevel(io);
        const decision = level && typeof level.choosePreSummonSpellAction === 'function'
            ? level.choosePreSummonSpellAction(gameStateArg, io) : null;
        debugLog('choosePreSummonSpellAction', decision ? { card: decision.card.name } : null, io);
        return decision;
    }

    /** @param {AIAttacker[]} attackers @param {Owner} [io] @returns {AIAttacker[]} */
    function orderAttackers(attackers, io = 'bot') {
        const level = currentLevel(io);
        const ordered = level && typeof level.orderAttackers === 'function'
            ? level.orderAttackers(attackers) : attackers;
        debugLog('orderAttackers', ordered.map((item) => item.slot.card.name), io);
        return ordered;
    }

    /** @param {AIAttacker[]} attackers @param {AIAttacker[]} defenders @param {number} opponentLp @param {Owner} [io] @returns {AILethalEstimate} */
    function estimateLethal(attackers, defenders, opponentLp, io = 'bot') {
        const level = currentLevel(io);
        return level && typeof level.estimateLethal === 'function'
            ? level.estimateLethal(attackers, defenders, opponentLp, io)
            : { possible: false, damage: 0 };
    }

    /** @param {GameState} gameStateArg @param {Owner} [io] @returns {number[]} */
    function choosePositionChanges(gameStateArg, io = 'bot') {
        const level = currentLevel(io);
        const changes = level && typeof level.choosePositionChanges === 'function'
            ? level.choosePositionChanges(gameStateArg, io) : [];
        debugLog('choosePositionChanges', changes, io);
        return changes;
    }

    /** @param {GameState} gameStateArg @param {Owner} [io] @returns {AIBanishFusionCandidate | null} */
    function chooseBanishFusion(gameStateArg, io = 'bot') {
        const level = currentLevel(io);
        const decision = level && typeof level.chooseBanishFusion === 'function'
            ? level.chooseBanishFusion(gameStateArg, io) : null;
        debugLog('chooseBanishFusion', decision ? { card: decision.card.name, materiali: decision.materialFieldIndices } : null, io);
        return decision;
    }

    /** @param {MonsterSlot} attackerSlot @param {AIAttacker[]} playerMonsters @param {Owner} [io] @returns {number | null} */
    function chooseAttackTarget(attackerSlot, playerMonsters, io = 'bot') {
        const level = currentLevel(io);
        const decision = level ? level.chooseAttackTarget(attackerSlot, playerMonsters, io) : null;
        debugLog('chooseAttackTarget', { attaccante: attackerSlot.card.name, scelta: decision }, io);
        return decision;
    }

    /** @param {AIResponseCandidate[]} candidates @param {Owner} [io] @returns {AIResponseCandidate | null} */
    function chooseChainResponse(candidates, io = 'bot') {
        const level = currentLevel(io);
        const decision = level ? level.chooseChainResponse(candidates, io) : (candidates[0] || null);
        debugLog('chooseChainResponse', { candidati: candidates.map((c) => c.card.name), scelta: decision && decision.card.name }, io);
        return decision;
    }

    /**
     * Prossima azione da fare con una Magia/Trappola in mano durante la
     * propria Main Phase — vedi bot.js, che la richiama ripetutamente
     * (una carta alla volta) finché ritorna null o non ci sono più slot/
     * carte utili. `usedThisTurn` è un piccolo oggetto che bot.js passa
     * invariato tra le chiamate dello stesso turno, così ogni livello può
     * tenere il proprio conteggio (es. IA_MEDIA si ferma dopo 1 Set + 1
     * Magia) senza che i livelli si condizionino a vicenda.
     */
    /** @param {GameState} gameStateArg @param {{ activateCount?: number; setCount?: number }} [usedThisTurn] @param {Owner} [io] @returns {AIHandAction | null} */
    function chooseNextSpellTrapAction(gameStateArg, usedThisTurn, io = 'bot') {
        const level = currentLevel(io);
        const decision = level && typeof level.chooseNextSpellTrapAction === 'function'
            ? level.chooseNextSpellTrapAction(gameStateArg, usedThisTurn, io) : null;
        debugLog('chooseNextSpellTrapAction', decision ? { card: decision.card.name, action: decision.action } : null, io);
        return decision;
    }

    /** Vero se conviene attivare ORA una propria carta già Set o l'effetto Ignition di un proprio mostro in campo (decision.zone dice quale), durante la propria Main Phase (non in risposta a un trigger) — solo IA_DIFFICILE lo fa mai. */
    /** @param {GameState} gameStateArg @param {Owner} [io] @returns {AIFieldAction | null} */
    function chooseSetCardActivation(gameStateArg, io = 'bot') {
        const level = currentLevel(io);
        const decision = level && typeof level.chooseSetCardActivation === 'function'
            ? level.chooseSetCardActivation(gameStateArg, io) : null;
        debugLog('chooseSetCardActivation', decision ? { card: decision.card.name } : null, io);
        return decision;
    }

    /** Punteggio di valutazione campo (solo IA_DIFFICILE lo calcola davvero) — utile per il debug/log, non usato dall'esecutore. */
    function explainDecision(label, data) {
        debugLog(label, data);
    }

    window.BotAI = {
        chooseSummon: chooseSummon,
        chooseHandSpecialSummon: chooseHandSpecialSummon,
        choosePreSummonSpellAction: choosePreSummonSpellAction,
        orderAttackers: orderAttackers,
        estimateLethal: estimateLethal,
        choosePositionChanges: choosePositionChanges,
        chooseBanishFusion: chooseBanishFusion,
        chooseAttackTarget: chooseAttackTarget,
        chooseChainResponse: chooseChainResponse,
        chooseNextSpellTrapAction: chooseNextSpellTrapAction,
        chooseSetCardActivation: chooseSetCardActivation,
        explainDecision: explainDecision
    };
})();
