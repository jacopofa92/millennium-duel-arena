module.exports = {
    name: 'Controllo della Mente e Scudo da Braccio Magico rispettano le scadenze TCG',
    async run(t) {
        const esito = await t.evaluate(() => {
            const crea = (uid) => ({
                card: { id: 1, uid, name: uid, type: 'monster', attack: 1000, defense: 1000 },
                position: 'attack', isFaceDown: false
            });

            resetGameState();
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.botMonsterField = [crea('mind-control-target'), null, null, null, null];
            gameState.cannotAttackUidsUntilEndPhase = new Set(['mind-control-target']);
            gameState.cannotBeTributedUids = new Set(['mind-control-target']);
            DuelEngine.actions.takeControl('player', 'bot', 0, false, 'endPhase');
            DuelEngine.processTemporaryControlReturns('battlePhaseEnd');
            const mindControlRestaFinoEndPhase = gameState.playerMonsterField.some((s) => s && s.card.uid === 'mind-control-target');
            DuelEngine.processTemporaryControlReturns('endPhase');
            const mindControlRitornaEndPhase = gameState.botMonsterField.some((s) => s && s.card.uid === 'mind-control-target');
            const restrizioniRimosse = !gameState.cannotAttackUidsUntilEndPhase.has('mind-control-target')
                && !gameState.cannotBeTributedUids.has('mind-control-target');

            resetGameState();
            gameState.playerMonsterField = [crea('arm-shield-target'), null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            DuelEngine.actions.takeControl('bot', 'player', 0, false, 'battlePhaseEnd');
            DuelEngine.processTemporaryControlReturns('endPhase');
            const armShieldRestaFinoAllaBattlePhase = gameState.botMonsterField.some((s) => s && s.card.uid === 'arm-shield-target');
            DuelEngine.processTemporaryControlReturns('battlePhaseEnd');
            const armShieldRitornaAllaBattlePhase = gameState.playerMonsterField.some((s) => s && s.card.uid === 'arm-shield-target');

            resetGameState();
            gameState.playerMonsterField = [crea('arm-shield-main2'), null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            DuelEngine.actions.takeControl('bot', 'player', 0, false, 'battlePhaseEnd');
            gameState.phase = 'battle';
            enterMainPhase2();
            const restituitoPrimaDellaMain2 = gameState.playerMonsterField.some((s) => s && s.card.uid === 'arm-shield-main2');

            // Strappa Possesso perde il bersaglio: il controllo torna
            // subito al vero proprietario e non resta una voce temporanea.
            resetGameState();
            const snatch = { ...cardDatabase.find((c) => c.id === 645), uid: 'snatch-equip' };
            gameState.playerMonsterField = [crea('snatch-target'), null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.playerSTField = [{ card: snatch, isFaceDown: false }, null, null, null, null];
            DuelEngine.actions.takeControl('player', 'bot', 0, true);
            snatch.snatchStealTargetUid = 'snatch-target';
            DuelEngine.getDefinition(645).onSTDestroyed(DuelEngine.makeContext('player', { card: snatch, index: 0 }));
            const snatchRestituisceSubito = gameState.botMonsterField.some((s) => s && s.card.uid === 'snatch-target')
                && !(gameState.temporaryControls || []).some((entry) => entry.uid === 'snatch-target');

            // Se il campo del proprietario è pieno, il mostro non resta
            // sotto controllo altrui: finisce nel Cimitero corretto.
            resetGameState();
            const snatchFull = { ...cardDatabase.find((c) => c.id === 645), uid: 'snatch-equip-full' };
            const owned = (uid) => crea(uid);
            gameState.botMonsterField = [owned('snatch-full-target'), null, null, null, null];
            gameState.playerMonsterField = [null, null, null, null, null];
            DuelEngine.actions.takeControl('player', 'bot', 0, true);
            snatchFull.snatchStealTargetUid = 'snatch-full-target';
            gameState.botMonsterField = [owned('full-1'), owned('full-2'), owned('full-3'), owned('full-4'), owned('full-5')];
            gameState.playerSTField = [{ card: snatchFull, isFaceDown: false }, null, null, null, null];
            DuelEngine.getDefinition(645).onSTDestroyed(DuelEngine.makeContext('player', { card: snatchFull, index: 0 }));
            const snatchPienoGestito = gameState.botGraveyard.some((card) => card.uid === 'snatch-full-target')
                && !gameState.playerMonsterField.some((s) => s && s.card.uid === 'snatch-full-target');

            // Necropaura restituisce il mostro senza creare un falso
            // ritorno differito alla prossima End Phase.
            resetGameState();
            const necrofear = { ...cardDatabase.find((c) => c.id === 891), uid: 'necrofear-equip', _necrofearControlledUid: 'necrofear-target' };
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.botMonsterField = [owned('necrofear-target'), null, null, null, null];
            DuelEngine.actions.takeControl('player', 'bot', 0, true);
            gameState.playerSTField = [{ card: necrofear, isFaceDown: false }, null, null, null, null];
            DuelEngine.getDefinition(891).onSTDestroyed(DuelEngine.makeContext('player', { card: necrofear, index: 0 }));
            const necrofearRitornoPulito = gameState.botMonsterField.some((s) => s && s.card.uid === 'necrofear-target')
                && !(gameState.temporaryControls || []).some((entry) => entry.uid === 'necrofear-target');

            return {
                mindControlRestaFinoEndPhase,
                mindControlRitornaEndPhase,
                restrizioniRimosse,
                armShieldRestaFinoAllaBattlePhase,
                armShieldRitornaAllaBattlePhase,
                restituitoPrimaDellaMain2,
                snatchRestituisceSubito,
                snatchPienoGestito,
                necrofearRitornoPulito
            };
        });

        t.assert(esito.mindControlRestaFinoEndPhase && esito.mindControlRitornaEndPhase && esito.restrizioniRimosse,
            `Controllo della Mente deve restituire il mostro alla End Phase e rimuovere i vincoli: ${JSON.stringify(esito)}`);
        t.assert(esito.armShieldRestaFinoAllaBattlePhase && esito.armShieldRitornaAllaBattlePhase && esito.restituitoPrimaDellaMain2,
            `Scudo da Braccio Magico deve restituire il mostro alla fine della Battle Phase, prima della Main Phase 2: ${JSON.stringify(esito)}`);
        t.assert(esito.snatchRestituisceSubito && esito.snatchPienoGestito,
            `Strappa Possesso deve restituire il mostro quando l'Equip lascia il Terreno e gestire il campo originale pieno: ${JSON.stringify(esito)}`);
        t.assert(esito.necrofearRitornoPulito,
            `Necropaura Oscura deve restituire il mostro senza lasciare una scadenza temporanea: ${JSON.stringify(esito)}`);
    }
};
