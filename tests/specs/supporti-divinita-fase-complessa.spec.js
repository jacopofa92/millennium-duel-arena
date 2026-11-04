module.exports = {
    name: 'Supporti Divinità complessi: Incrocio di Anime e ciclo completo di Ra',
    async run(t) {
        const result = await t.evaluate(async () => {
            const copy = (id, uid) => ({ ...cardDatabase.find((card) => card.id === id), uid });
            const slot = (card) => ({ card, position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true });

            // Incrocio di Anime: il bot preferisce i tre mostri avversari,
            // Evoca il Dio dalla mano e attiva il limite temporaneo.
            resetGameState();
            gameState.currentPlayer = 'bot';
            gameState.phase = 'main1';
            const crossing = copy(1274, 'crossing');
            const obelisk = copy(30, 'obelisk-crossing');
            gameState.botHand = [obelisk];
            gameState.playerMonsterField[0] = slot(copy(4, 'p1'));
            gameState.playerMonsterField[1] = slot(copy(5, 'p2'));
            gameState.playerMonsterField[2] = slot(copy(6, 'p3'));
            const cinematica = { grido: false, evocazione: false };
            const attendiOriginale = EventiDuello.attendi;
            EventiDuello.attendi = (nome, dati, fatto) => {
                if (nome !== 'grido-evocazione') return attendiOriginale.call(EventiDuello, nome, dati, fatto);
                if (dati.posto === 'bot' && dati.carta && dati.carta.id === 30) cinematica.grido = true;
                if (typeof fatto === 'function') fatto();
            };
            const fxOriginale = FX.playMonsterSummonEffect;
            FX.playMonsterSummonEffect = (carta) => {
                if (carta && carta.id === 30) cinematica.evocazione = true;
            };
            const crossingDef = DuelEngine.getDefinition(1274);
            const crossingCan = crossingDef.canActivate(DuelEngine.makeContext('bot', { card: crossing }));
            crossingDef.activate(DuelEngine.makeContext('bot', { card: crossing }));
            // La presentazione parte dopo che il Terreno e' stato ridisegnato:
            // aspettiamo quel breve passaggio asincrono prima di resettare lo stato.
            await new Promise((resolve) => setTimeout(resolve, 100));
            EventiDuello.attendi = attendiOriginale;
            FX.playMonsterSummonEffect = fxOriginale;
            const crossingWorked = gameState.botMonsterField.some((entry) => entry && entry.card.uid === obelisk.uid)
                && gameState.playerMonsterField.every((entry) => !entry)
                && gameState.playerGraveyard.length === 3
                && gameState.soulCrossingActivationLimitFor.bot.usedOnTurn === gameState.turn;

            // Modalità Sfera: tre Tributi sul Terreno avversario, quindi
            // comparsa su quel lato con proprietario originale preservato.
            resetGameState();
            gameState.currentPlayer = 'bot';
            gameState.phase = 'main1';
            const sphere = copy(1275, 'sphere');
            gameState.botHand = [sphere];
            gameState.playerMonsterField[0] = slot(copy(4, 's1'));
            gameState.playerMonsterField[1] = slot(copy(5, 's2'));
            gameState.playerMonsterField[2] = slot(copy(6, 's3'));
            const sphereDef = DuelEngine.getDefinition(1275);
            sphereDef.beginCustomNormalSummon(DuelEngine.makeContext('bot', { card: sphere, handIndex: 0 }));
            const sphereSlot = gameState.playerMonsterField.find((entry) => entry && entry.card.uid === sphere.uid);
            const sphereWorked = !!sphereSlot && sphereSlot.originalOwner === 'bot'
                && gameState.botHand.length === 0 && gameState.playerGraveyard.length === 3;

            // La Sfera richiama Ra ignorando soltanto per questo effetto il
            // suo divieto di Special Summon e gli assegna 4000/4000.
            const ra = copy(472, 'ra-from-sphere');
            gameState.playerDeck = [ra];
            sphereDef.activate(DuelEngine.makeContext('player', { card: sphere, slot: sphereSlot, slotIndex: gameState.playerMonsterField.indexOf(sphereSlot), zone: 'monster' }));
            const summonedRa = gameState.playerMonsterField.find((entry) => entry && entry.card.uid === ra.uid);
            const sphereToRa = !!summonedRa && summonedRa.card.attack === 4000 && summonedRa.card.defense === 4000;

            // Fenice nel Cimitero risorge quando Ra lascia il Terreno;
            // il suo effetto Ignition manda (non distrugge) un mostro.
            resetGameState();
            const phoenix = copy(1276, 'phoenix');
            const sentRa = copy(472, 'ra-sent');
            gameState.playerGraveyard = [phoenix, sentRa];
            DuelEngine.notifyOwnMonsterSentToGraveyard('player', sentRa);
            const phoenixIndex = gameState.playerMonsterField.findIndex((entry) => entry && entry.card.uid === phoenix.uid);
            const phoenixRevived = phoenixIndex !== -1 && !gameState.playerGraveyard.some((card) => card.uid === phoenix.uid);
            const victim = copy(4, 'victim');
            gameState.botMonsterField[0] = slot(victim);
            const phoenixDef = DuelEngine.getDefinition(1276);
            phoenixDef.activate(DuelEngine.makeContext('player', { card: phoenix, slotIndex: phoenixIndex, zone: 'monster' }));
            const phoenixSentVictim = !gameState.botMonsterField[0]
                && gameState.botGraveyard.some((card) => card.uid === victim.uid)
                && gameState.playerLP === 7000;

            // L'IA riconosce la procedura non standard della Sfera anche
            // quando non possiede tre mostri, ma l'avversario sì.
            resetGameState();
            gameState.currentPlayer = 'bot';
            gameState.phase = 'main1';
            gameState.botDifficulty = 'hard';
            const aiSphere = copy(1275, 'sphere-ai');
            gameState.botHand = [aiSphere];
            gameState.playerMonsterField[0] = slot(copy(4, 'ai1'));
            gameState.playerMonsterField[1] = slot(copy(5, 'ai2'));
            gameState.playerMonsterField[2] = slot(copy(6, 'ai3'));
            const aiDecision = BotAI.chooseSummon(gameState, 'bot');
            const aiUnderstandsSphere = !!aiDecision && aiDecision.card.uid === aiSphere.uid
                && aiDecision.customNormalSummon === true;

            return { crossingCan, crossingWorked, cinematica, sphereWorked, sphereToRa, phoenixRevived, phoenixSentVictim, aiUnderstandsSphere };
        });

        t.assert(result.crossingCan && result.crossingWorked,
            `Incrocio di Anime deve usare legalmente il Terreno avversario: ${JSON.stringify(result)}`);
        t.assert(result.cinematica.grido && result.cinematica.evocazione,
            `Incrocio di Anime deve conservare grido e presentazione del Dio evocato: ${JSON.stringify(result)}`);
        t.assert(result.sphereWorked && result.sphereToRa,
            `Modalità Sfera deve rispettare lato di Evocazione e trasformazione in Ra: ${JSON.stringify(result)}`);
        t.assert(result.phoenixRevived && result.phoenixSentVictim,
            `Fenice deve risorgere e mandare un mostro al Cimitero pagando 1000 LP: ${JSON.stringify(result)}`);
        t.assert(result.aiUnderstandsSphere,
            `L'IA deve riconoscere l'Evocazione di Modalità Sfera sul campo avversario: ${JSON.stringify(result)}`);
    }
};
