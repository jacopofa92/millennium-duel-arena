// Le caselle verdi appartengono SOLO alla carta selezionata: passando da una Trappola a un Mostro (e
// viceversa) quelle della prima devono spegnersi, non sommarsi.
module.exports = {
    name: 'UX mano: le caselle evidenziate seguono solo la carta selezionata (Mostro <-> Magia/Trappola)',
    async run(t) {
        await t.evaluate(() => {
            gameState.currentPlayer = 'player';
            gameState.phase = 'main1';
            gameState.hasNormalSummoned = false;
            gameState.playerHand = [
                { ...cardDatabase.find((card) => card.id === 10), uid: 'evid-trappola' },
                { ...cardDatabase.find((card) => card.id === 4), uid: 'evid-mostro' }
            ];
            gameState.selectedCard = { type: null, card: null, index: -1 };
            updateUI();
        });
        const conta = () => t.evaluate(() => ({
            mostri: document.querySelectorAll('.field-slot[data-owner="player"][data-type="monster"].action-highlight').length,
            st: document.querySelectorAll('.field-slot[data-owner="player"][data-type="st"].action-highlight').length
        }));
        const tocca = async (i) => {
            const c = await t.page.evaluate((n) => {
                const r = document.querySelectorAll('#playerHand .card')[n].getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }, i);
            await t.page.mouse.click(c.x, c.y);
            await t.page.waitForTimeout(250);
        };

        await tocca(0);
        let s = await conta();
        t.assert(s.st > 0 && s.mostri === 0, `Trappola: solo le caselle Magia/Trappola: ${JSON.stringify(s)}`);
        await tocca(1);
        s = await conta();
        t.assert(s.mostri > 0 && s.st === 0, `Dopo il Mostro: solo le caselle Mostro: ${JSON.stringify(s)}`);
        await tocca(0);
        s = await conta();
        t.assert(s.st > 0 && s.mostri === 0, `Di nuovo la Trappola: solo le caselle Magia/Trappola: ${JSON.stringify(s)}`);
    }
};
