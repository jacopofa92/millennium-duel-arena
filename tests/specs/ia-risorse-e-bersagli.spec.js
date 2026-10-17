module.exports = {
    name: 'IA non spreca Mondo Toon, Fusione, mostri o buff sul nemico',
    async run(t) {
        const r = await t.evaluate(() => {
            const carta = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });

            resetGameState();
            gameState.currentPlayer = 'bot';
            gameState.phase = 'main1';
            gameState.botHand = [carta(487, 'toon-world-hand')];
            gameState.botSTField[0] = { card: carta(487, 'toon-world-field'), isFaceDown: false };
            const secondoMondo = AI_MEDIUM.chooseNextSpellTrapAction(gameState, {}, 'bot');

            resetGameState();
            gameState.currentPlayer = 'bot';
            gameState.phase = 'main1';
            gameState.botHand = [carta(38, 'poly'), carta(416, 'relinquished'), carta(475, 'idol')];
            gameState.botExtraDeck = [carta(476, 'restrict')];
            gameState.playerMonsterField = [null, null, null, null, null];
            const fusioneSenzaBersaglio = AI_MEDIUM.chooseNextSpellTrapAction(gameState, {}, 'bot');

            resetGameState();
            gameState.currentPlayer = 'bot';
            gameState.phase = 'main1';
            gameState.botMonsterField = [
                { card: carta(320, 'kaiser'), position: 'attack', isFaceDown: false },
                null, null, null, null
            ];
            gameState.playerMonsterField = [
                { card: carta(24, 'elfi'), position: 'attack', isFaceDown: false },
                null, null, null, null
            ];
            DuelEngine.recomputeStaticEffects();
            DuelEngine.getDefinition(226).activate(DuelEngine.makeContext('bot', { card: carta(226, 'controller-safe') }));
            const conservaKaiser = gameState.botMonsterField.some((slot) => slot?.card.uid === 'kaiser');
            const cambiaPosizione = gameState.playerMonsterField[0]?.position === 'defense';

            resetGameState();
            gameState.currentPlayer = 'bot';
            gameState.phase = 'main1';
            gameState.botMonsterField = [
                { card: carta(11, 'debole'), position: 'attack', isFaceDown: false },
                null, null, null, null
            ];
            gameState.playerMonsterField = [
                { card: carta(320, 'forte'), position: 'attack', isFaceDown: false },
                null, null, null, null
            ];
            DuelEngine.recomputeStaticEffects();
            DuelEngine.getDefinition(226).activate(DuelEngine.makeContext('bot', { card: carta(226, 'controller-value') }));
            const usaControlloConVantaggio = gameState.botMonsterField.some((slot) => slot?.card.uid === 'forte')
                && gameState.botGraveyard.some((card) => card.uid === 'debole');

            resetGameState();
            gameState.currentPlayer = 'bot';
            gameState.phase = 'main1';
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.playerMonsterField = [
                { card: carta(24, 'enemy-buff'), position: 'defense', isFaceDown: false },
                null, null, null, null
            ];
            const ctxBuff = DuelEngine.makeContext('bot', { card: carta(595, 'guardian') });
            const buffAttivabileSulSoloNemico = DuelEngine.getDefinition(595).canActivate(ctxBuff);

            return {
                secondoMondo,
                fusioneSenzaBersaglio,
                conservaKaiser,
                cambiaPosizione,
                usaControlloConVantaggio,
                buffAttivabileSulSoloNemico,
                controllori: cardDatabase.filter((card) => /Controllore (?:del )?Nemico/.test(card.name)).map((card) => card.id)
            };
        });

        t.assert(r.secondoMondo === null, `L'IA non deve attivare un secondo Mondo Toon: ${JSON.stringify(r)}`);
        t.assert(r.fusioneSenzaBersaglio === null, `L'IA non deve fondere Mille Occhi a 0/0 senza bersaglio: ${JSON.stringify(r)}`);
        t.assert(r.conservaKaiser && r.cambiaPosizione,
            `Controllore deve conservare Kaiser contro un 1900 e usare il cambio Posizione: ${JSON.stringify(r)}`);
        t.assert(r.usaControlloConVantaggio,
            `Controllore deve ancora sacrificare un mostro debole per un bersaglio molto forte: ${JSON.stringify(r)}`);
        t.assert(!r.buffAttivabileSulSoloNemico,
            `Il bot non deve attivare un buff DEF se esiste solo un bersaglio avversario: ${JSON.stringify(r)}`);
        t.assert(r.controllori.length === 1 && r.controllori[0] === 226,
            `In Cartoteca deve restare una sola copia canonica di Controllore del Nemico: ${JSON.stringify(r)}`);
    }
};
