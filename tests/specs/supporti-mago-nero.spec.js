module.exports = {
    name: 'Supporti Mago Nero: pacchetto moderno completo',
    async run(t) {
        const result = await t.evaluate(() => {
            const copy = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });

            resetGameState();
            const rod = copy(1254, 'rod');
            const knives = copy(474, 'knives');
            gameState.botDeck = [knives];
            gameState.botDeckCount = 1;
            DuelEngine.getDefinition(1254).onSummon(DuelEngine.makeContext('bot', {
                card: rod, summonedCard: rod, summonedVia: 'normal'
            }));
            const rodSearches = gameState.botHand.some((c) => c.uid === knives.uid);

            resetGameState();
            gameState.currentPlayer = 'player';
            const graveRod = copy(1254, 'grave-rod');
            const tribute = copy(188, 'spellcaster-tribute');
            const activatedTrap = copy(1252, 'activated-trap');
            gameState.botGraveyard = [graveRod];
            gameState.botMonsterField[0] = { card: tribute, position: 'attack', isFaceDown: false };
            const graveCtx = DuelEngine.makeContext('bot', {
                card: graveRod, zone: 'graveyard', activatedCard: activatedTrap, activatedOwner: 'bot'
            });
            const rodGraveReady = DuelEngine.getDefinition(1254).canActivateOnCardActivatedWhileInGraveyard(graveCtx);
            DuelEngine.getDefinition(1254).onCardActivatedWhileInGraveyard(graveCtx);
            const rodReturns = gameState.botHand.some((c) => c.uid === graveRod.uid)
                && gameState.botGraveyard.some((c) => c.uid === tribute.uid)
                && !gameState.botMonsterField[0];

            resetGameState();
            const circle = copy(1255, 'circle');
            const darkMagician = copy(2, 'dm-deck');
            const fillerA = copy(3, 'filler-a');
            const fillerB = copy(4, 'filler-b');
            gameState.botDeck = [fillerA, fillerB, darkMagician];
            gameState.botDeckCount = 3;
            gameState.botSTField[0] = { card: circle, isFaceDown: false };
            const circleDef = DuelEngine.getDefinition(1255);
            const circleCtx = DuelEngine.makeContext('bot', { card: circle, zone: 'st', index: 0 });
            circleDef.activate(circleCtx);
            const circleSearches = gameState.botHand.some((c) => c.uid === darkMagician.uid)
                && gameState.botDeck.length === 2;
            const summoned = copy(2, 'dm-field');
            const enemy = copy(3, 'enemy');
            gameState.botMonsterField[0] = { card: summoned, position: 'attack', isFaceDown: false };
            gameState.playerMonsterField[0] = { card: enemy, position: 'attack', isFaceDown: false };
            DuelEngine.recomputeStaticEffects();
            circleDef.onAnySpecialSummon(DuelEngine.makeContext('bot', {
                card: circle, zone: 'st', index: 0, summonedCard: summoned
            }));
            const circleBanishes = !gameState.playerMonsterField[0]
                && gameState.playerBanished.some((c) => c.uid === enemy.uid);

            // "Puoi" significa che il giocatore può non prendere nulla;
            // le carte viste devono comunque poter tornare in cima
            // nell'ordine scelto (il Deck pesca con pop()).
            resetGameState();
            const optionalCircle = copy(1255, 'circle-optional');
            const bottom = copy(5, 'circle-bottom');
            const topA = copy(2, 'circle-top-a');
            const topB = copy(474, 'circle-top-b');
            const topC = copy(1256, 'circle-top-c');
            gameState.playerDeck = [bottom, topA, topB, topC];
            gameState.playerDeckCount = 4;
            gameState.playerSTField[0] = { card: optionalCircle, isFaceDown: false };
            circleDef.activate(DuelEngine.makeContext('player', { card: optionalCircle, zone: 'st', index: 0 }));
            const offeredOptionalChoice = !!Decisioni.inSospeso();
            Decisioni.rispondi(null); // non aggiunge alcuna carta
            let pending = Decisioni.inSospeso();
            Decisioni.rispondi(pending.candidati.findIndex((c) => c.uid === topB.uid)); // prima pescata
            pending = Decisioni.inSospeso();
            Decisioni.rispondi(pending.candidati.findIndex((c) => c.uid === topC.uid)); // seconda pescata
            const circleOptionalAndOrdered = gameState.playerHand.length === 0
                && gameState.playerDeck.length === 4
                && gameState.playerDeck[gameState.playerDeck.length - 1].uid === topB.uid
                && gameState.playerDeck[gameState.playerDeck.length - 2].uid === topC.uid
                && gameState.playerDeck[0].uid === bottom.uid;

            resetGameState();
            const soul = copy(1256, 'soul');
            const protectedDm = copy(2, 'protected-dm');
            const raigeki = copy(4, 'enemy-effect');
            gameState.botSTField[0] = { card: soul, isFaceDown: false };
            gameState.botMonsterField[0] = { card: protectedDm, position: 'attack', isFaceDown: false };
            DuelEngine.recomputeStaticEffects();
            DuelEngine.makeContext('player', { card: raigeki }).destroyMonster('bot', 0);
            const soulProtects = !!gameState.botMonsterField[0];
            gameState.botSTField[0] = null;
            gameState.botGraveyard.push(soul);
            DuelEngine.getDefinition(1256).onSentToGraveyardFromField(DuelEngine.makeContext('bot', { card: soul }));
            const soulPunishes = !gameState.botMonsterField[0]
                && gameState.botGraveyard.some((c) => c.uid === protectedDm.uid);

            resetGameState();
            const salvation = copy(1257, 'salvation');
            const eternalToSet = copy(1256, 'eternal-to-set');
            gameState.botDeck = [eternalToSet];
            gameState.botDeckCount = 1;
            const salvationDef = DuelEngine.getDefinition(1257);
            salvationDef.activate(DuelEngine.makeContext('bot', { card: salvation, zone: 'fieldSpell' }));
            const salvationSets = gameState.botSTField.some((s) => s && s.isFaceDown && s.card.uid === eternalToSet.uid);
            const summonedDm = copy(2, 'salvation-dm');
            const graveGirl = copy(188, 'salvation-girl');
            gameState.botMonsterField[0] = { card: summonedDm, position: 'attack', isFaceDown: false };
            gameState.botGraveyard.push(graveGirl);
            salvationDef.onAnySpecialSummon(DuelEngine.makeContext('bot', {
                card: salvation, zone: 'fieldSpell', summonedCard: summonedDm
            }));
            const salvationRevives = gameState.botMonsterField.some((s) => s && s.card.uid === graveGirl.uid);

            resetGameState();
            const servant = copy(1258, 'servant');
            const topDm = copy(2, 'top-dm');
            gameState.botDeck = [topDm];
            gameState.botDeckCount = 1;
            const servantDef = DuelEngine.getDefinition(1258);
            const servantCtx = DuelEngine.makeContext('bot', { card: servant, zone: 'hand' });
            servantDef.activate(servantCtx);
            const servantStacks = gameState.botDeck[gameState.botDeck.length - 1].uid === topDm.uid;
            gameState.botGraveyard = [servant, copy(2, 'draw-dm'), copy(188, 'draw-girl')];
            gameState.botDeck = [copy(3, 'draw-1'), copy(4, 'draw-2')];
            gameState.botDeckCount = 2;
            servantDef.activateFromGraveyardMainPhase(DuelEngine.makeContext('bot', { card: servant, zone: 'graveyard' }));
            const servantDraws = gameState.botHand.length === 2
                && gameState.botBanished.some((c) => c.uid === servant.uid);

            resetGameState();
            const secrets = copy(1259, 'secrets');
            const materialDm = copy(2, 'fusion-dm');
            const materialGirl = copy(188, 'fusion-girl');
            const boss = copy(1260, 'dark-magicians');
            gameState.botHand = [materialDm, materialGirl];
            gameState.botExtraDeck = [boss];
            const fusionPlan = DuelEngine.getFusableExtraDeckMonsters('bot').find((entry) => entry.card.uid === boss.uid);
            const flexibleFusion = !!fusionPlan && fusionPlan.materialLocations.length === 2;
            const oldFx = window.FX;
            window.FX = null;
            DuelEngine.getDefinition(1259).activate(DuelEngine.makeContext('bot', { card: secrets, zone: 'hand' }));
            window.FX = oldFx;
            const secretsFuses = gameState.botMonsterField.some((s) => s && s.card.uid === boss.uid)
                && gameState.botGraveyard.some((c) => c.uid === materialDm.uid)
                && gameState.botGraveyard.some((c) => c.uid === materialGirl.uid);

            resetGameState();
            const ritualSecrets = copy(1259, 'ritual-secrets');
            const chaosMagician = copy(854, 'chaos-magician');
            const ritualDm = copy(2, 'ritual-dm');
            const ritualLevel = copy(22, 'ritual-level');
            gameState.botHand = [chaosMagician, ritualDm, ritualLevel];
            const oldRitualFx = window.FX;
            window.FX = null;
            DuelEngine.getDefinition(1259).activate(DuelEngine.makeContext('bot', { card: ritualSecrets, zone: 'hand' }));
            window.FX = oldRitualFx;
            const secretsRituals = gameState.botMonsterField.some((s) => s && s.card.uid === chaosMagician.uid)
                && gameState.botGraveyard.some((c) => c.uid === ritualDm.uid)
                && gameState.botGraveyard.some((c) => c.uid === ritualLevel.uid);

            resetGameState();
            const drawingBoss = copy(1260, 'drawing-boss');
            const drawnTrap = copy(382, 'drawn-trap');
            gameState.botMonsterField[0] = { card: drawingBoss, position: 'attack', isFaceDown: false };
            gameState.botDeck = [drawnTrap];
            gameState.botDeckCount = 1;
            DuelEngine.getDefinition(1260).onCardActivated(DuelEngine.makeContext('bot', {
                card: drawingBoss, activatedCard: copy(474, 'activation'), activatedOwner: 'bot'
            }));
            const bossDrawSets = gameState.botSTField.some((s) => s && s.card.uid === drawnTrap.uid
                && s.isFaceDown && s.setOnTurn < gameState.turn);

            resetGameState();
            const destroyedBoss = copy(1260, 'destroyed-boss');
            const returnDm = copy(2, 'return-dm');
            const returnGirl = copy(188, 'return-girl');
            gameState.botGraveyard = [destroyedBoss, returnDm];
            gameState.botDeck = [returnGirl];
            gameState.botDeckCount = 1;
            DuelEngine.getDefinition(1260).onDestroy(DuelEngine.makeContext('bot', { card: destroyedBoss }));
            const bossReplacesItself = gameState.botMonsterField.filter(Boolean).length === 2
                && gameState.botMonsterField.some((s) => s.card.uid === returnDm.uid)
                && gameState.botMonsterField.some((s) => s.card.uid === returnGirl.uid);

            return {
                rodSearches, rodGraveReady, rodReturns, circleSearches, circleBanishes,
                offeredOptionalChoice, circleOptionalAndOrdered, soulProtects, soulPunishes,
                salvationSets, salvationRevives, servantStacks, servantDraws, flexibleFusion, secretsFuses,
                secretsRituals, bossDrawSets, bossReplacesItself
            };
        });
        Object.entries(result).forEach(([name, value]) => t.assert(value, `${name} deve essere vero: ${JSON.stringify(result)}`));
    }
};
