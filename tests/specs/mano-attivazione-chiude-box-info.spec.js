// Attivare un effetto dalla mano chiude il box info carta, che altrimenti resterebbe aperto sul campo.
module.exports = {
    name: 'UX mano: attivare un effetto dalla mano chiude il box info',
    async run(t) {
        await t.evaluate(() => {
            gameState.currentPlayer = 'player';
            gameState.phase = 'main1';
            gameState.hasNormalSummoned = false;
            gameState.playerHand = [{ ...cardDatabase.find((card) => card.id === 36), uid: 'info-attiva' }];
            gameState.selectedCard = { type: null, card: null, index: -1 };
            updateUI();
        });
        const c = await t.page.evaluate(() => {
            const r = document.querySelector('#playerHand .card').getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        await t.page.mouse.click(c.x, c.y);
        await t.page.waitForSelector('#qpSpellActivate', { timeout: 5000 });
        t.assert(await t.evaluate(() => document.getElementById('cardInfoPanel').classList.contains('visible')),
            'Prerequisito: il tocco sulla carta apre il box info');
        await t.page.click('#qpSpellActivate');
        // Il cursore resta fermo sopra la mano: il passaggio su una carta non deve riaprire il box.
        await t.page.waitForTimeout(500);
        t.assert(!(await t.evaluate(() => document.getElementById('cardInfoPanel').classList.contains('visible'))),
            'Attivando l\'effetto il box info deve chiudersi');
    }
};
