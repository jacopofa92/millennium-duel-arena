// Terza ondata prima serie: 11 Mostri Flip (id 1020-1030). Un test per
// meccanismo non banale, non uno per carta — quelle con un solo dealDamage
// diretto (Poison Mummy) o una destroyAllMonsters filtrata (Ladybug) sono
// già coperte a sufficienza da pattern identici testati altrove.
module.exports = {
    name: 'Terza ondata prima serie: Mostri Flip con Ignition/Deck/controllo temporaneo (id 1020-1030)',
    async run(t) {
        // Bomba a Tempo (315, Jigen Bakudan): esplode da sola alla Standby Phase del suo controllore — distrugge tutti i mostri
        // che controlla (se stessa inclusa) e infligge metà del totale ATK degli altri. (Prima di eliminare l'alias "Bomba a
        // Orologeria", id 1024, questo test provava la versione attivabile a mano di quella carta.)
        const jigenResult = await t.evaluate(() => {
            const jigen = { ...cardDatabase.find((c) => c.id === 315), uid: 'jigen-1' };
            const ally = { ...cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck), uid: 'ally-1', attack: 1000 };
            gameState.playerMonsterField = [{ card: jigen, position: 'attack', isFaceDown: false }, { card: ally, position: 'attack', isFaceDown: false }, null, null, null];
            gameState.botLP = 8000;
            const ctx = DuelEngine.makeContext('player', { card: jigen, slotIndex: 0 });
            DuelEngine.getDefinition(315).onStandbyPhase(ctx);
            return { fieldCleared: gameState.playerMonsterField.every((s) => s === null), botLP: gameState.botLP };
        });
        t.assert(jigenResult.fieldCleared, 'Bomba a Tempo deve distruggere tutti i mostri (se stessa inclusa)');
        t.assert(8000 - jigenResult.botLP === 500, `Il danno deve essere la metà dell'ATK dell'alleato (1000/2=500), rilevato ${8000 - jigenResult.botLP}`);

        // Parassita Bubbonico (1023): FLIP, cerca copia nel Deck, Special Summon in Difesa coperta, rimescola.
        const bubonicResult = await t.evaluate(() => {
            const vermin = { ...cardDatabase.find((c) => c.id === 1023), uid: 'vermin-1' };
            const copy = { ...cardDatabase.find((c) => c.id === 1023) };
            gameState.playerMonsterField = [{ card: vermin, position: 'defense', isFaceDown: false }, null, null, null, null];
            gameState.playerDeck = [copy, { ...cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck) }];
            const ctx = DuelEngine.makeContext('player', { card: vermin });
            DuelEngine.getDefinition(1023).onFlip(ctx);
            const summoned = gameState.playerMonsterField.find((s) => s && s.card.id === 1023 && s.card.uid !== 'vermin-1');
            return { summoned: !!summoned, faceDown: summoned ? summoned.isFaceDown : null, deckSize: gameState.playerDeck.length };
        });
        t.assert(bubonicResult.summoned, 'Deve Special Summonare una seconda copia di Parassita Bubbonico dal Deck');
        t.assert(bubonicResult.faceDown === true, 'La copia Special Summonata deve essere in Difesa coperta');
        t.assert(bubonicResult.deckSize === 1, 'Il Deck deve perdere la copia trovata (1 carta rimasta)');

        // Un Gufo Fortunato (1026): senza Necrovalley -> in cima al Deck (ultimo elemento, pop() pesca da lì). Con Necrovalley -> in mano.
        const owlWithoutNecro = await t.evaluate(() => {
            const owl = { ...cardDatabase.find((c) => c.id === 1026), uid: 'owl-1' };
            const fieldSpell = { ...cardDatabase.find((c) => c.type === 'spell' && c.subtype === 'field') };
            gameState.playerHand = [];
            gameState.playerDeck = [{ ...cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck) }, fieldSpell];
            gameState.botFieldSpell = null;
            gameState.playerFieldSpell = null;
            const ctx = DuelEngine.makeContext('player', { card: owl });
            DuelEngine.getDefinition(1026).onFlip(ctx);
            return { topOfDeck: gameState.playerDeck[gameState.playerDeck.length - 1]?.id, handEmpty: gameState.playerHand.length === 0 };
        });
        t.assert(owlWithoutNecro.handEmpty, 'Senza Necrovalley, la Magia Campo NON deve finire in mano');
        const fieldSpellSample = await t.evaluate(() => cardDatabase.find((c) => c.type === 'spell' && c.subtype === 'field').id);
        t.assert(owlWithoutNecro.topOfDeck === fieldSpellSample, 'Senza Necrovalley, la Magia Campo trovata deve finire in cima al Deck');

        const owlWithNecro = await t.evaluate(() => {
            const owl = { ...cardDatabase.find((c) => c.id === 1026), uid: 'owl-2' };
            const fieldSpell = { ...cardDatabase.find((c) => c.type === 'spell' && c.subtype === 'field') };
            const necrovalley = { ...cardDatabase.find((c) => c.id === 890) };
            gameState.playerHand = [];
            gameState.playerDeck = [fieldSpell];
            gameState.playerFieldSpell = { card: necrovalley, isFaceDown: false };
            const ctx = DuelEngine.makeContext('player', { card: owl });
            DuelEngine.getDefinition(1026).onFlip(ctx);
            return { handHasIt: gameState.playerHand.some((c) => c.type === 'spell' && c.subtype === 'field'), deckEmpty: gameState.playerDeck.length === 0 };
        });
        t.assert(owlWithNecro.handHasIt, 'Con Necrovalley scoperta, la Magia Campo trovata deve finire in MANO invece che nel Deck');
        t.assert(owlWithNecro.deckEmpty, 'La carta deve comunque lasciare il Deck');

        // Manipolatore di Draghi (1028): controllo temporaneo di un Drago avversario, torna al proprietario alla End Phase.
        const dragonControlResult = await t.evaluate(() => {
            const manipulator = { ...cardDatabase.find((c) => c.id === 1028), uid: 'manip-1' };
            const dragon = { ...cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && c.race === 'Drago'), uid: 'dragon-1' };
            gameState.playerMonsterField = [{ card: manipulator, position: 'attack', isFaceDown: false }, null, null, null, null];
            gameState.botMonsterField = [{ card: dragon, position: 'attack', isFaceDown: false }, null, null, null, null];
            const ctx = DuelEngine.makeContext('player', { card: manipulator });
            DuelEngine.getDefinition(1028).onFlip(ctx);
            const controlledNow = gameState.playerMonsterField.some((s) => s && s.card.uid === 'dragon-1');
            gameState.currentPlayer = 'player';
            gameState.turn = 5;
            DuelEngine.processTemporaryControlReturns();
            const returnedAfterEndPhase = gameState.botMonsterField.some((s) => s && s.card.uid === 'dragon-1');
            return { controlledNow: controlledNow, returnedAfterEndPhase: returnedAfterEndPhase };
        });
        t.assert(dragonControlResult.controlledNow, 'Il Drago avversario deve passare subito sotto il controllo del proprietario di Manipolatore di Draghi');
        t.assert(dragonControlResult.returnedAfterEndPhase, 'Il Drago deve tornare al proprietario originale dopo processTemporaryControlReturns (End Phase)');

        // L'Immortale del Tuono (1025): +3000 LP al FLIP, -5000 LP quando lasciato al Cimitero.
        const immortalResult = await t.evaluate(() => {
            const immortal = { ...cardDatabase.find((c) => c.id === 1025), uid: 'immortal-1' };
            gameState.playerLP = 8000;
            gameState.playerMonsterField = [{ card: immortal, position: 'attack', isFaceDown: false }, null, null, null, null];
            gameState.playerGraveyard = [];
            const flipCtx = DuelEngine.makeContext('player', { card: immortal });
            DuelEngine.getDefinition(1025).onFlip(flipCtx);
            const lpAfterFlip = gameState.playerLP;
            DuelEngine.actions.destroyMonster('player', 0);
            return { lpAfterFlip: lpAfterFlip, lpAfterDestroy: gameState.playerLP };
        });
        t.assert(immortalResult.lpAfterFlip - 8000 === 3000, `Deve guadagnare 3000 LP al FLIP (rilevato +${immortalResult.lpAfterFlip - 8000})`);
        t.assert(immortalResult.lpAfterFlip - immortalResult.lpAfterDestroy === 5000, `Deve perdere 5000 LP quando distrutto e mandato al Cimitero (rilevato -${immortalResult.lpAfterFlip - immortalResult.lpAfterDestroy})`);

        // Barattolo Cobra (1030): Special Summon di un Token in Posizione di Attacco (scoperto).
        const cobraResult = await t.evaluate(() => {
            const cobra = { ...cardDatabase.find((c) => c.id === 1030), uid: 'cobra-1' };
            gameState.playerMonsterField = [{ card: cobra, position: 'attack', isFaceDown: false }, null, null, null, null];
            const ctx = DuelEngine.makeContext('player', { card: cobra });
            DuelEngine.getDefinition(1030).onFlip(ctx);
            const tokenSlot = gameState.playerMonsterField.find((s) => s && s.card.isToken);
            return tokenSlot ? { position: tokenSlot.position, isFaceDown: tokenSlot.isFaceDown, attack: tokenSlot.card.attack } : null;
        });
        t.assert(cobraResult && cobraResult.position === 'attack' && !cobraResult.isFaceDown, 'Il Token Serpente Velenoso deve entrare in Posizione di Attacco scoperto');
        t.assert(cobraResult && cobraResult.attack === 1200, 'Il Token deve avere 1200 ATK');
    }
};
