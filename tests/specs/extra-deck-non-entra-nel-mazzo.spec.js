// Gli effetti generici di ritorno/rimescolamento devono rispettare sempre
// la zona Extra Deck per Fusioni e altre carte extra.
module.exports = {
    name: 'Extra Deck: i ritorni nel Deck principale instradano correttamente le carte extra',
    async run(t) {
        const r = await t.evaluate(() => {
            const extraCard = cardDatabase.find((card) => card.extraDeck);
            if (!extraCard) return { missingFixture: true };
            const fusion = { ...extraCard, uid: 'extra-deck-routing-test' };
            gameState.playerDeck = [{ id: 1, uid: 'main-deck-sentinel', type: 'monster' }];
            gameState.playerExtraDeck = [];
            const ctx = DuelEngine.makeContext('player', {});
            const returned = ctx.returnCardToDeck('player', fusion, 'top');
            const deckAfterReturn = gameState.playerDeck.some((card) => card.uid === fusion.uid);
            const extraAfterReturn = gameState.playerExtraDeck.some((card) => card.uid === fusion.uid);

            const shuffledFusion = { ...extraCard, uid: 'extra-deck-shuffle-test' };
            const shuffled = ctx.shuffleIntoDeck('player', [shuffledFusion]);
            return {
                returned, deckAfterReturn, extraAfterReturn, shuffled,
                shuffledIntoMain: gameState.playerDeck.some((card) => card.uid === shuffledFusion.uid),
                shuffledIntoExtra: gameState.playerExtraDeck.some((card) => card.uid === shuffledFusion.uid)
            };
        });
        t.assert(!r.missingFixture, 'Il database deve contenere almeno una carta Extra Deck');
        t.assert(r.returned && !r.deckAfterReturn && r.extraAfterReturn,
            `Il ritorno singolo va all’Extra Deck: ${JSON.stringify(r)}`);
        t.assert(r.shuffled && !r.shuffledIntoMain && r.shuffledIntoExtra,
            `Anche il rimescolamento separa le carte Extra Deck: ${JSON.stringify(r)}`);
    }
};
