// Con i pulsanti flottanti di una carta aperti (es. "Attiva"), il tap su UN'ALTRA carta della mano deve
// abbassare la prima e selezionare la seconda al primo tentativo: il catcher del popover copre la mano
// e prima inghiottiva il tap, lasciando la prima carta sollevata.
module.exports = {
    name: 'UX mano: dal popover di una carta a un\'altra carta con un solo tap',
    async run(t) {
        await t.evaluate(() => {
            gameState.currentPlayer = 'player';
            gameState.phase = 'main1';
            gameState.hasNormalSummoned = false;
            gameState.playerHand = [
                { ...cardDatabase.find((card) => card.id === 36), uid: 'cambio-magia' },
                { ...cardDatabase.find((card) => card.id === 4), uid: 'cambio-mostro' }
            ];
            gameState.selectedCard = { type: null, card: null, index: -1 };
            updateUI();
        });

        const centro = async (i) => t.page.evaluate((n) => {
            const r = document.querySelectorAll('#playerHand .card')[n].getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, i);

        const a = await centro(0);
        await t.page.mouse.click(a.x, a.y);
        await t.page.waitForSelector('#quickPopover', { timeout: 5000 });

        const b = await centro(1);
        await t.page.mouse.click(b.x, b.y);
        const stato = await t.evaluate(() => ({
            popover: !!document.getElementById('quickPopover'),
            catcher: !!document.getElementById('quickPopoverCatcher'),
            sollevate: [...document.querySelectorAll('#playerHand .card')].map((el) => el.classList.contains('selected')),
            indice: gameState.selectedCard.index
        }));
        t.assert(!stato.popover && !stato.catcher, 'I pulsanti flottanti della prima carta devono chiudersi');
        t.assert(stato.sollevate[0] === false, 'La prima carta deve abbassarsi');
        t.assert(stato.sollevate[1] === true && stato.indice === 1, `La seconda carta deve sollevarsi al primo tap: ${JSON.stringify(stato)}`);
    }
};
