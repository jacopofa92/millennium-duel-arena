module.exports = {
    name: 'Life Points: il ridisegno non interrompe il conteggio e i danni ravvicinati si accodano',
    async run(t) {
        await t.evaluate(() => {
            gameState.playerLP = 8000;
            gameState.botLP = 8000;
            const lp = document.getElementById('playerLP');
            lp.dataset.lpValue = '8000';
            lp.textContent = '8000';
            gameState.playerLP = 6000;
            EventiDuello.emetti('life-points');
        });

        await t.page.waitForTimeout(450);
        await t.evaluate(() => updateUI());
        const dopoRidisegno = await t.evaluate(() => Number(document.getElementById('playerLP').textContent));
        t.assert(dopoRidisegno < 8000 && dopoRidisegno > 6000,
            `Un updateUI durante il conteggio deve lasciarlo in corso, non saltare a 6000: ${dopoRidisegno}`);

        await t.evaluate(() => {
            gameState.playerLP = 4000;
            EventiDuello.emetti('life-points');
        });
        await t.page.waitForTimeout(250);
        await t.evaluate(() => updateUI());
        await t.page.waitForTimeout(1850);
        const finale = await t.evaluate(() => Number(document.getElementById('playerLP').textContent));
        t.assert(finale === 4000, `Dopo due variazioni ravvicinate il contatore deve terminare sul valore reale: ${finale}`);
    }
};
