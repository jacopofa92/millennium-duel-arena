// Trascinando una carta dalla mano le caselle dove può essere lasciata si evidenziano (come al tocco), e
// tornano normali al rilascio.
module.exports = {
    name: 'UX mano: il trascinamento evidenzia le caselle valide',
    async run(t) {
        await t.evaluate(() => {
            gameState.currentPlayer = 'player';
            gameState.phase = 'main1';
            gameState.hasNormalSummoned = false;
            gameState.playerHand = [{ ...cardDatabase.find((card) => card.id === 4), uid: 'drag-evidenzia' }];
            gameState.selectedCard = { type: null, card: null, index: -1 };
            updateUI();
        });
        const c = await t.page.evaluate(() => {
            const r = document.querySelector('#playerHand .card').getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        await t.page.mouse.move(c.x, c.y);
        await t.page.mouse.down();
        await t.page.mouse.move(c.x + 40, c.y - 120, { steps: 6 });
        const durante = await t.evaluate(() => ({
            evidenziate: document.querySelectorAll('.field-slot.action-highlight').length,
            anteprima: !!document.querySelector('.drag-preview')
        }));
        t.assert(durante.anteprima, 'Il trascinamento deve mostrare il fantasma della carta');
        t.assert(durante.evidenziate > 0, 'Durante il trascinamento le caselle valide devono essere evidenziate');
        // Rilascio lontano da qualunque casella: nessuna evidenziazione deve restare.
        await t.page.mouse.move(5, 5, { steps: 4 });
        await t.page.mouse.up();
        // Con il mouse un rilascio fuori dalle caselle vale come tocco (seleziona la carta, e le caselle
        // restano evidenziate come per un tocco): l'importante è che il fantasma sparisca.
        const dopo = await t.evaluate(() => !!document.querySelector('.drag-preview'));
        t.assert(!dopo, 'Al rilascio il fantasma deve sparire');
    }
};
