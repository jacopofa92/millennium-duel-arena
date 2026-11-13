// I 3 Dei Egizi (Obelisk id 30, Slifer id 31, Ra id 472): statistiche di
// base corrette (in particolare Slifer, storicamente sbagliato: 0/0, non
// una base fissa sommata al bonus per carte in mano), i due floodgate
// condivisi (blocksActivationsOnOwnNormalSummon, cannotBeTargetedByCardEffects
// — quest'ultimo SOLO su Obelisk/Ra, non su Slifer), e il pagamento LP di
// Ra come vera scelta del giocatore (non più automatico).
module.exports = {
    name: 'I 3 Dei Egizi: statistiche, floodgate e scelta LP di Ra',
    async run(t) {
        const stats = await t.evaluate(() => ({
            obelisk: { attack: cardDatabase.find((c) => c.id === 30).attack, defense: cardDatabase.find((c) => c.id === 30).defense, vanilla: !!cardDatabase.find((c) => c.id === 30).vanilla },
            slifer: { attack: cardDatabase.find((c) => c.id === 31).attack, defense: cardDatabase.find((c) => c.id === 31).defense, vanilla: !!cardDatabase.find((c) => c.id === 31).vanilla },
            ra: { attack: cardDatabase.find((c) => c.id === 472).attack, defense: cardDatabase.find((c) => c.id === 472).defense, vanilla: !!cardDatabase.find((c) => c.id === 472).vanilla }
        }));
        t.assert(stats.obelisk.attack === 4000 && stats.obelisk.defense === 4000, 'Obelisk deve essere 4000/4000');
        t.assert(stats.slifer.attack === 0 && stats.slifer.defense === 0, 'Slifer deve essere 0/0 di base (il bonus è solo nell\'effetto)');
        t.assert(stats.ra.attack === 0 && stats.ra.defense === 0, 'Ra deve essere 0/0 di base');
        t.assert(!stats.obelisk.vanilla && !stats.slifer.vanilla && !stats.ra.vanilla, 'Nessuno dei 3 Dei Egizi deve essere marcato vanilla: hanno un\'implementazione reale');

        const sliferBonus = await t.evaluate(() => {
            const slifer = { ...cardDatabase.find((c) => c.id === 31), uid: 'slifer-1' };
            gameState.playerHand = [{ ...cardDatabase.find((c) => c.id === 4) }, { ...cardDatabase.find((c) => c.id === 5) }, { ...cardDatabase.find((c) => c.id === 6) }];
            gameState.atkDefBonus = {};
            const ctx = DuelEngine.makeContext('player', { card: slifer });
            DuelEngine.getDefinition(31).static(ctx);
            return DuelEngine.getEffectiveAtk(slifer);
        });
        t.assert(sliferBonus === 3000, `Slifer con 3 carte in mano deve avere 3000 ATK effettivo, non sommato a una base sbagliata (ottenuto ${sliferBonus})`);

        const flags = await t.evaluate(() => ({
            obeliskBlocks: !!DuelEngine.getDefinition(30).blocksActivationsOnOwnNormalSummon,
            sliferBlocks: !!DuelEngine.getDefinition(31).blocksActivationsOnOwnNormalSummon,
            raBlocks: !!DuelEngine.getDefinition(472).blocksActivationsOnOwnNormalSummon,
            obeliskImmune: !!DuelEngine.getDefinition(30).cannotBeTargetedByCardEffects,
            sliferImmune: !!DuelEngine.getDefinition(31).cannotBeTargetedByCardEffects,
            raImmune: !!DuelEngine.getDefinition(472).cannotBeTargetedByCardEffects
        }));
        t.assert(flags.obeliskBlocks && flags.sliferBlocks && flags.raBlocks, 'Tutti e 3 devono bloccare le risposte alla propria Evocazione Normale');
        t.assert(flags.obeliskImmune, 'Obelisk deve essere immune al targeting da effetti Carta');
        t.assert(!flags.sliferImmune, 'Slifer NON deve essere immune al targeting (il testo reale non lo prevede)');
        t.assert(!flags.raImmune, 'Ra NON deve essere immune al targeting (a differenza di Obelisk, il testo reale non lo prevede)');

        const lifecycle = await t.evaluate(() => {
            resetGameState();
            gameState.turn = 7;
            gameState.currentPlayer = 'player';
            const gods = [30, 31, 472].map((id) => ({
                ...cardDatabase.find((card) => card.id === id), uid: `god-special-${id}`
            }));
            const summonResults = gods.map((god, index) => DuelEngine.specialSummon('player', god, index, 'attack', 'hand'));
            const summonMarkers = gameState.playerMonsterField.slice(0, 3).map((slot) => slot && slot.specialSummonedOnTurn);
            gameState.turn = 8;
            DuelEngine.firePhaseTrigger(DuelEngine.TRIGGER.ON_END_PHASE, 'player');
            const stillThereNextTurn = gameState.playerMonsterField.slice(0, 3).every(Boolean);
            gameState.turn = 7;
            DuelEngine.firePhaseTrigger(DuelEngine.TRIGGER.ON_END_PHASE, 'player');
            return {
                summonAllowed: summonResults.every(Boolean),
                summonMarkers: summonMarkers.every((turn) => turn === 7),
                stillThereNextTurn,
                sentAtSummonTurnEnd: gods.every((god) => gameState.playerGraveyard.some((card) => card.uid === god.uid))
            };
        });
        t.assert(lifecycle.summonAllowed && lifecycle.summonMarkers && lifecycle.stillThereNextTurn && lifecycle.sentAtSummonTurnEnd,
            `Gli Dei devono poter essere Special Summonati e andare al Cimitero solo nella End Phase del turno di arrivo: ${JSON.stringify(lifecycle)}`);

        const obeliskCost = await t.evaluate(() => new Promise((resolve) => {
            resetGameState();
            gameState.currentPlayer = 'bot';
            const copy = (id, uid) => ({ ...cardDatabase.find((card) => card.id === id), uid });
            CardEffects.register(99001, { cannotBeTributed: true });
            CardEffects.register(99003, { cannotBeTributedForEffect: true });
            const obelisk = copy(30, 'obelisk-cost-source');
            const token = { ...copy(4, 'obelisk-scapegoat-token'), id: 99001, name: 'Token non sacrificabile per Evocazione Tributo' };
            const valido = copy(4, 'obelisk-valid-a');
            const altroValido = copy(5, 'obelisk-valid-b');
            const vietato = { ...copy(6, 'obelisk-forbidden-effect'), id: 99003, name: 'Mostro non tributabile per effetti' };
            const nemico = copy(6, 'obelisk-opponent');
            const slot = (card) => ({ card, position: 'attack', isFaceDown: false });
            gameState.botMonsterField[0] = slot(obelisk);
            gameState.botMonsterField[1] = slot(token);
            gameState.botMonsterField[2] = slot(valido);
            gameState.botMonsterField[3] = slot(altroValido);
            gameState.botMonsterField[4] = slot(vietato);
            gameState.playerMonsterField[0] = slot(nemico);
            const def = DuelEngine.getDefinition(30);
            const ctx = DuelEngine.makeContext('bot', { card: obelisk });
            const canActivate = def.canActivate(ctx);
            const activationStarted = DuelEngine.activateCard('bot', 'monster', 0);
            const costPaidBeforeResolution = gameState.botGraveyard.some((card) => card.uid === obelisk.uid)
                && gameState.botGraveyard.some((card) => card.uid === token.uid)
                && gameState.botMonsterField[3]?.card.uid === altroValido.uid;
            const started = Date.now();
            const waitForChain = () => {
                if ((!gameState.chain || (!gameState.chain.active && !gameState.chain.resolving)) || Date.now() - started > 10000) {
                    resolve({
                        canActivate,
                        activationStarted,
                        costPaidBeforeResolution,
                        tributeSummonOnlyRestrictionDoesNotApply: gameState.botGraveyard.some((card) => card.uid === token.uid),
                        absoluteRestrictionRemains: gameState.botMonsterField[4]?.card.uid === vietato.uid,
                        selectedExactlyTwo: costPaidBeforeResolution,
                        destroyedOpponent: !gameState.playerMonsterField[0],
                        chainClosed: !gameState.chain || (!gameState.chain.active && !gameState.chain.resolving)
                    });
                    return;
                }
                setTimeout(waitForChain, 50);
            };
            setTimeout(waitForChain, 50);
        }));
        t.assert(Object.values(obeliskCost).every(Boolean),
            `Obelisk deve offrire 2 Tributi legali, incluso se stesso, e lasciare intatti i mostri non sacrificabili: ${JSON.stringify(obeliskCost)}`);

        const sliferChain = await t.evaluate(() => new Promise((resolve) => {
            resetGameState();
            gameState.turn = 4;
            gameState.currentPlayer = 'player';
            const slifer = { ...cardDatabase.find((card) => card.id === 31), uid: 'slifer-chain-source' };
            const summoned = { id: 99002, uid: 'slifer-chain-target', name: 'Mostro di prova', type: 'monster', attack: 3000, defense: 1000 };
            gameState.botMonsterField[0] = { card: slifer, position: 'attack', isFaceDown: false };
            const def = DuelEngine.getDefinition(31);
            const original = def.onEnemyMonsterSummoned;
            window.__sliferEffectResolvedInsideChain = false;
            def.onEnemyMonsterSummoned = function (ctx) {
                window.__sliferEffectResolvedInsideChain = !!(gameState.chain && gameState.chain.resolving);
                return original(ctx);
            };
            DuelEngine.specialSummon('player', summoned, 0, 'attack', 'hand');
            const started = Date.now();
            const waitForChain = () => {
                if ((!gameState.chain || (!gameState.chain.active && !gameState.chain.resolving)) || Date.now() - started > 10000) {
                    def.onEnemyMonsterSummoned = original;
                    resolve({
                        resolvedInsideChain: window.__sliferEffectResolvedInsideChain,
                        attackAfterEffect: summoned.attack,
                        chainClosed: !gameState.chain || (!gameState.chain.active && !gameState.chain.resolving)
                    });
                    return;
                }
                setTimeout(waitForChain, 50);
            };
            setTimeout(waitForChain, 50);
        }));
        t.assert(sliferChain.resolvedInsideChain && sliferChain.attackAfterEffect === 1000 && sliferChain.chainClosed,
            `L'effetto di Slifer deve risolversi come Link di Chain dopo una Evocazione in Attacco: ${JSON.stringify(sliferChain)}`);

        // Ra: il pagamento LP è una VERA scelta (card._raPayLp), non automatico.
        const raChoice = await t.evaluate(() => {
            const ra = { ...cardDatabase.find((c) => c.id === 472), uid: 'ra-lp-1' };
            ra._raPayLp = false;
            gameState.playerLP = 8000;
            const ctx = DuelEngine.makeContext('player', { summonedCard: ra, summonedVia: 'normal' });
            DuelEngine.getDefinition(472).onSummon(ctx);
            return { lpUnchangedOnDecline: gameState.playerLP === 8000 };
        });
        t.assert(raChoice.lpUnchangedOnDecline, 'Se il giocatore rifiuta (_raPayLp:false), i LP di Ra non devono cambiare');
    }
};
