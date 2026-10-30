// La cinematica Rituale deve precedere la comparsa del mostro: durante il
// sigillo i materiali sono gia' consumati, ma lo slot resta vuoto; soltanto
// alla chiusura parte la normale Special Summon.
module.exports = {
    name: 'Evocazione Rituale: materiali, cinematica, poi mostro sul Terreno',
    async run(t) {
        const setup = await t.evaluate(() => {
            const ritual = { ...cardDatabase.find((c) => c.id === 55), uid: 'ritual-target' };
            const material = { ...cardDatabase.find((c) => c.id === 1), uid: 'ritual-material' };
            gameState.currentPlayer = 'player';
            gameState.phase = 'main1';
            gameState.playerHand = [ritual];
            gameState.playerMonsterField = [{ card: material, position: 'attack', isFaceDown: false }, null, null, null, null];
            gameState.playerGraveyard = [];
            updateUI();

            const ctx = DuelEngine.makeContext('player', { card: { id: 56, uid: 'ritual-spell' } });
            CardEffectsShared.performRitualTribute(ctx, 8, 0);
            const ritualCard = gameState.playerHand.splice(0, 1)[0];
            ctx.specialSummon('player', ritualCard, 0, 'attack', 'graveyard');
            return {
                category: ritualCard.category,
                slotImmediatelyOccupied: !!gameState.playerMonsterField[0],
                sceneVisible: !!document.querySelector('.fx-ritual-scene') || !!(window.FxWebgl && window.FxWebgl.attivi() > 0),
                materialInGraveyard: gameState.playerGraveyard.some((c) => c.uid === 'ritual-material'),
                cinematicLocked: FX.isCinematicPlaying()
            };
        });

        t.assert(setup.category === 'ritual', 'La carta di prova deve essere un vero Mostro Rituale');
        t.assert(setup.materialInGraveyard, 'Il materiale deve essere consumato prima della cinematica');
        t.assert(setup.sceneVisible && setup.cinematicLocked, 'La scena Rituale deve essere visibile e bloccare il duello');
        t.assert(!setup.slotImmediatelyOccupied, 'Il mostro Rituale non deve comparire mentre la cinematica e ancora attiva');

        await t.page.waitForTimeout(3150);
        const after = await t.evaluate(() => ({
            ritualScene: !!document.querySelector('.fx-ritual-scene') || Array.from(document.body.children).some((e) => e.classList && e.classList.contains('card') && getComputedStyle(e).position === 'fixed'),
            summonedUid: gameState.playerMonsterField[0] && gameState.playerMonsterField[0].card.uid
        }));
        t.assert(!after.ritualScene, 'La scena Rituale deve ripulirsi alla fine');
        t.assert(after.summonedUid === 'ritual-target', 'Il mostro Rituale deve entrare sul Terreno soltanto dopo la scena');
    }
};
