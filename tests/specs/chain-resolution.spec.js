// La vera Chain con priorità (js/engine/duel-engine.js): risoluzione LIFO,
// più risposte incatenate, e un'attivazione manuale con una Trappola
// avversaria pronta a rispondere PRIMA che l'effetto si risolva.
//
// NOTA IMPORTANTE per chi tocca questo file: resolveChain() è asincrona
// (ogni link aspetta ~2s reali prima di risolversi, per non accavallare
// il pulse di attivazione con l'effetto — vedi il commit che l'ha resa
// tale). Questo dà al ciclo di turno naturale della pagina il tempo reale
// di continuare a girare in parallelo alle manipolazioni dirette di
// gameState fatte qui sotto, e può arrivare a rubare le carte finte
// lasciate nei campi condivisi da un blocco precedente — due sessioni di
// Chain indipendenti che finiscono per litigarsi lo stesso
// gameState.chain.links. Per questo run-all.js chiama SEMPRE
// freezeNaturalGameLoop() prima di ogni test (vedi tests/helpers/harness.js) —
// se lo disattivi con `freeze: false` in un test che tocca la Chain,
// aspettati esattamente questo tipo di interferenza.
module.exports = {
    name: 'Chain: risoluzione LIFO, risposte multiple, attivazione manuale',
    async run(t) {
        await t.evaluate(() => {
            CardEffects.register(90001, {
                canActivate() { return true; },
                activate(ctx) { window.__testLog.push('SPELL_RESOLVE:' + ctx.owner); }
            });
            CardEffects.register(90002, {
                canActivate() { return true; },
                activate(ctx) { window.__testLog.push('TRAP_RESOLVE:' + ctx.owner); }
            });
            CardEffects.register(90003, {
                canActivate() { return true; },
                onOpponentSummon() { window.__testLog.push('TRAP_ONSUMMON_RESOLVE'); }
            });
            CardEffects.register(90005, {
                canActivate() { return true; },
                onOpponentSummon() { window.__testLog.push('KURIBOH_RESOLVE'); }
            });
            CardEffects.register(90006, {
                canActivate() { return true; },
                activate() { window.__testLog.push('FIELD_SPELL_RESOLVE'); }
            });
        });

        // --- Caso 1: un solo trigger + una sola Trappola di risposta (Buco Trappola-style). ---
        const r1 = await t.evaluate(() => {
            return new Promise((resolve) => {
                window.__testLog = [];
                gameState.turn = 5;
                gameState.botSTField = Array(5).fill(null);
                gameState.botSTField[0] = { card: { id: 90003, uid: 'trap-onsummon', name: 'Test Trap OnSummon', type: 'trap' }, isFaceDown: true, setOnTurn: gameState.turn - 1 };
                gameState.botHand = [];
                gameState.playerHand = [];
                DuelEngine.fireTrigger(
                    DuelEngine.TRIGGER.ON_NORMAL_SUMMON,
                    DuelEngine.makeContext('player', { summonedCard: { id: 90004, uid: 'fake-monster', name: 'Fake Monster', type: 'monster', attack: 100 }, summonedSlotIndex: 0, summonedPosition: 'attack' }),
                    () => resolve({
                        log: window.__testLog.slice(),
                        trapConsumed: gameState.botSTField[0] === null,
                        trapInGraveyard: gameState.botGraveyard.some((c) => c.id === 90003)
                    })
                );
            });
        });
        t.assert(r1.log.includes('TRAP_ONSUMMON_RESOLVE'), 'Caso 1: la Trappola deve rispondere alla Evocazione');
        t.assert(r1.trapConsumed, 'Caso 1: la Trappola deve lasciare il Terreno dopo aver risposto');
        t.assert(r1.trapInGraveyard, 'Caso 1: la Trappola deve finire al Cimitero');

        // --- Caso 2: due risposte allo stesso trigger, con ordine LIFO verificato. ---
        const r2 = await t.evaluate(() => {
            return new Promise((resolve) => {
                window.__testLog = [];
                gameState.turn = 5;
                gameState.botSTField = Array(5).fill(null);
                gameState.botSTField[0] = { card: { id: 90003, uid: 'trap-onsummon-2', name: 'Test Trap OnSummon', type: 'trap' }, isFaceDown: true, setOnTurn: gameState.turn - 1 };
                gameState.botHand = [{ id: 90005, uid: 'kuriboh-fake', name: 'Fake Kuriboh', type: 'monster' }];
                // L'ordine di scelta deve essere ripetibile: la Trappola viene
                // aggiunta per prima (campo prima della mano), Kuriboh per
                // secondo. La Catena deve quindi risolverli nell'ordine opposto.
                const chooseChainResponse = BotAI.chooseChainResponse;
                BotAI.chooseChainResponse = (candidates) => candidates[0] || null;
                DuelEngine.fireTrigger(
                    DuelEngine.TRIGGER.ON_NORMAL_SUMMON,
                    DuelEngine.makeContext('player', { summonedCard: { id: 90004, uid: 'fake-monster-2', name: 'Fake Monster', type: 'monster', attack: 100 }, summonedSlotIndex: 1, summonedPosition: 'attack' }),
                    () => {
                        BotAI.chooseChainResponse = chooseChainResponse;
                        resolve({
                            log: window.__testLog.slice(),
                            bothConsumed: gameState.botSTField[0] === null && gameState.botHand.length === 0
                        });
                    }
                );
            });
        });
        t.assert(r2.bothConsumed, 'Caso 2: entrambe le risposte devono essere aggiunte alla Catena');
        t.assert(
            JSON.stringify(r2.log) === JSON.stringify(['KURIBOH_RESOLVE', 'TRAP_ONSUMMON_RESOLVE']),
            `Caso 2: l’ultima risposta deve risolversi per prima (ordine: ${r2.log.join(' → ')})`
        );

        // --- Caso 3: attivazione manuale di una Magia, con una Trappola avversaria pronta a rispondere. ---
        const r3 = await t.evaluate(() => {
            return new Promise((resolve) => {
                window.__testLog = [];
                gameState.turn = 5;
                gameState.playerHand = [{ id: 90001, uid: 'spell-fake', name: 'Fake Spell', type: 'spell', subtype: 'normal' }];
                gameState.playerGraveyard = [];
                gameState.botSTField = Array(5).fill(null);
                gameState.botSTField[0] = { card: { id: 90002, uid: 'trap-fake', name: 'Fake Trap', type: 'trap' }, isFaceDown: true, setOnTurn: gameState.turn - 1 };
                gameState.botGraveyard = [];
                const attendiMiniatura = window.CatenaGL && CatenaGL.attendiMiniatura;
                if (window.CatenaGL) {
                    // Verifica che l'engine deleghi alla scena la sincronizzazione
                    // prima di invocare gli effetti che possono aprire modali.
                    CatenaGL.attendiMiniatura = (callback) => {
                        window.__testLog.push('SCENA_MINIATURA');
                        callback();
                        return true;
                    };
                }
                const activated = DuelEngine.activateCard('player', 'hand', 0);
                const chainActiveRightAfterCall = DuelEngine.isChainActive();
                const start = Date.now();
                const poll = () => {
                    if (!DuelEngine.isChainActive() || Date.now() - start > 15000) {
                        if (window.CatenaGL && attendiMiniatura) CatenaGL.attendiMiniatura = attendiMiniatura;
                        resolve({
                            activated,
                            chainActiveRightAfterCall,
                            log: window.__testLog.slice(),
                            miniatureSyncSupported: typeof attendiMiniatura === 'function',
                            trapInGraveyard: gameState.botGraveyard.some((c) => c.id === 90002),
                            spellInGraveyard: gameState.playerGraveyard.some((c) => c.id === 90001),
                            chainActiveAfter: DuelEngine.isChainActive()
                        });
                        return;
                    }
                    setTimeout(poll, 100);
                };
                setTimeout(poll, 100);
            });
        });
        t.assert(r3.activated, 'Caso 3: activateCard deve accettare l\'attivazione');
        t.assert(r3.chainActiveRightAfterCall, 'Caso 3: la Chain deve restare attiva subito dopo la chiamata sincrona (prova che la risoluzione è davvero asincrona)');
        t.assert(!r3.chainActiveAfter, 'Caso 3: la Chain deve chiudersi al termine');
        t.assert(r3.log.includes('TRAP_RESOLVE:bot'), 'Caso 3: la Trappola del bot deve rispondere e risolversi');
        t.assert(r3.log.includes('SPELL_RESOLVE:player'), 'Caso 3: la Magia deve infine risolversi anche lei');
        t.assert(r3.trapInGraveyard, 'Caso 3: la Trappola deve finire al Cimitero');
        t.assert(r3.spellInGraveyard, 'Caso 3: la Magia deve finire al Cimitero');
        const scenaPronta = r3.log.indexOf('SCENA_MINIATURA');
        const primoEffetto = r3.log.indexOf('TRAP_RESOLVE:bot');
        if (r3.miniatureSyncSupported) {
            t.assert(scenaPronta !== -1 && scenaPronta < primoEffetto, 'Caso 3: la scena deve ridursi a miniatura prima della risoluzione e dei relativi modali');
        }

        // --- Caso 4: sostituire la Magia Terreno non deve animare la vecchia
        // carta sopra l'attivazione della nuova, né perdere il suo slot sorgente. ---
        const r4 = await t.evaluate(() => new Promise((resolve) => {
            window.__testLog = [];
            window.__fieldTransitions = [];
            gameState.turn = 7;
            gameState.currentPlayer = 'player';
            gameState.phase = 'main1';
            gameState.playerHand = [{ id: 90006, uid: 'new-field-spell', name: 'New Field Spell', type: 'spell', subtype: 'field' }];
            gameState.playerGraveyard = [];
            gameState.playerFieldSpell = { card: { id: 90007, uid: 'old-field-spell', name: 'Old Field Spell', type: 'spell', subtype: 'field' }, isFaceDown: false };
            gameState.botHand = [];
            gameState.botSTField = Array(5).fill(null);
            gameState.botFieldSpell = null;
            const stop = EventiDuello.ascolta('transizione-carta', (movement) => {
                if (movement.carta && movement.carta.uid === 'old-field-spell') window.__fieldTransitions.push(movement);
            });
            updateUI();
            const accepted = DuelEngine.activateCard('player', 'hand', 0);
            const start = Date.now();
            const poll = () => {
                if (!DuelEngine.isChainActive() || Date.now() - start > 15000) {
                    stop();
                    const movement = window.__fieldTransitions[0];
                    resolve({
                        accepted,
                        oldInGrave: gameState.playerGraveyard.some((card) => card.uid === 'old-field-spell'),
                        newOnField: gameState.playerFieldSpell && gameState.playerFieldSpell.card.uid === 'new-field-spell',
                        transitionCount: window.__fieldTransitions.length,
                        sourceKind: movement && movement.da.kind,
                        destinationKind: movement && movement.a.kind,
                        variant: movement && movement.variante,
                        sourceRect: movement && movement.da.rect,
                        effectResolved: window.__testLog.includes('FIELD_SPELL_RESOLVE')
                    });
                    return;
                }
                setTimeout(poll, 100);
            };
            setTimeout(poll, 100);
        }));
        t.assert(r4.accepted && r4.oldInGrave && r4.newOnField, 'Caso 4: la nuova Magia Terreno sostituisce quella precedente e resta attiva');
        t.assert(r4.effectResolved, 'Caso 4: l’effetto della nuova Magia Terreno deve risolversi');
        t.assert(r4.transitionCount === 1, `Caso 4: la vecchia carta deve partire una sola volta (transizioni: ${r4.transitionCount})`);
        t.assert(r4.sourceKind === 'fieldSpell' && r4.destinationKind === 'graveyard' && r4.variant === 'replace', 'Caso 4: l’uscita deve essere una sostituzione, non una distruzione');
        t.assert(r4.sourceRect && r4.sourceRect.width > 0, 'Caso 4: l’animazione deve conservare le coordinate della vecchia zona Terreno');
    }
};
