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

            // Scatola Mistica deve scegliere il miglior nemico che ha giustificato
            // il veto IA e trasferire il proprio mostro in modo permanente.
            resetGameState();
            gameState.currentPlayer = 'bot';
            gameState.phase = 'main1';
            gameState.botMonsterField = [
                { card: carta(11, 'box-sacrifice'), position: 'attack', isFaceDown: false },
                null, null, null, null
            ];
            gameState.playerMonsterField = [
                { card: carta(11, 'box-weak-target'), position: 'attack', isFaceDown: false },
                { card: carta(320, 'box-strong-target'), position: 'attack', isFaceDown: false },
                null, null, null
            ];
            DuelEngine.recomputeStaticEffects();
            const boxCtx = DuelEngine.makeContext('bot', { card: carta(388, 'box-spell') });
            const boxWorthwhile = DuelEngine.getDefinition(388).aiCanActivate(boxCtx);
            DuelEngine.getDefinition(388).activate(boxCtx);
            const scatolaSceglieIlMigliore = gameState.playerGraveyard.some((card) => card.uid === 'box-strong-target')
                && gameState.playerMonsterField.some((slot) => slot?.card.uid === 'box-sacrifice')
                && !(gameState.temporaryControls || []).some((entry) => entry.uid === 'box-sacrifice');

            // Anima Oscura: Tributo come costo, trasferimento permanente e
            // distruzione dei mostri eccedenti rispetto alle Zone libere.
            resetGameState();
            gameState.currentPlayer = 'bot';
            gameState.phase = 'main1';
            const mostro = (uid, attack, level = 2) => ({
                id: -1, uid, name: uid, type: 'monster', level, race: 'Demone',
                attribute: 'OSCURITÀ', attack, defense: attack, effect: ''
            });
            gameState.botMonsterField = [
                { card: carta(405, 'dark-soul'), position: 'attack', isFaceDown: false },
                { card: mostro('occupante-1', 900, 4), position: 'attack', isFaceDown: false },
                { card: mostro('occupante-2', 900, 4), position: 'attack', isFaceDown: false },
                { card: mostro('occupante-3', 900, 4), position: 'attack', isFaceDown: false },
                { card: mostro('occupante-4', 900, 4), position: 'attack', isFaceDown: false }
            ];
            gameState.playerMonsterField = [
                { card: mostro('dark-soul-weak', 700), position: 'attack', isFaceDown: false },
                { card: mostro('dark-soul-strong', 1900), position: 'attack', isFaceDown: false },
                null, null, null
            ];
            DuelEngine.recomputeStaticEffects();
            const darkCtx = DuelEngine.makeContext('bot', { card: carta(405, 'dark-soul'), index: 0 });
            const animaWorthwhile = DuelEngine.getDefinition(405).aiCanActivate(darkCtx);
            const targetsWithLowValue = gameState.playerMonsterField;
            gameState.playerMonsterField = [
                { card: mostro('dark-soul-tiny', 100), position: 'attack', isFaceDown: false },
                null, null, null, null
            ];
            const animaNonSpreca = !DuelEngine.getDefinition(405).aiCanActivate(darkCtx);
            gameState.playerMonsterField = targetsWithLowValue;
            DuelEngine.getDefinition(405).activate(darkCtx);
            const animaSceglieInBaseAiPosti = gameState.botMonsterField.some((slot) => slot?.card.uid === 'dark-soul-strong')
                && !gameState.botMonsterField.some((slot) => slot?.card.uid === 'dark-soul-weak')
                && gameState.playerGraveyard.some((card) => card.uid === 'dark-soul-weak')
                && gameState.botGraveyard.some((card) => card.uid === 'dark-soul')
                && (gameState.temporaryControls || []).length === 0;
            DuelEngine.processTemporaryControlReturns();
            const animaRestaPermanente = gameState.botMonsterField.some((slot) => slot?.card.uid === 'dark-soul-strong');

            return {
                secondoMondo,
                fusioneSenzaBersaglio,
                conservaKaiser,
                cambiaPosizione,
                usaControlloConVantaggio,
                buffAttivabileSulSoloNemico,
                boxWorthwhile,
                scatolaSceglieIlMigliore,
                animaSceglieInBaseAiPosti,
                animaRestaPermanente,
                animaWorthwhile,
                animaNonSpreca,
                controllori: cardDatabase.filter((card) => /Controllore (?:del )?Nemico|Controlla-Avversario/.test(card.name)).map((card) => card.id)
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
        t.assert(r.boxWorthwhile && r.scatolaSceglieIlMigliore,
            `Scatola Mistica deve distruggere il bersaglio forte valutato e lasciare permanente il controllo ceduto: ${JSON.stringify(r)}`);
        t.assert(r.animaWorthwhile && r.animaNonSpreca && r.animaSceglieInBaseAiPosti && r.animaRestaPermanente,
            `Anima Oscura deve valutare il costo, scegliere in base agli slot e mantenere il controllo: ${JSON.stringify(r)}`);
        t.assert(r.controllori.length === 1 && r.controllori[0] === 226,
            `In Cartoteca deve restare una sola copia canonica di Controllore del Nemico: ${JSON.stringify(r)}`);
    }
};
