const path = require('path');

module.exports = {
    name: 'Cartoteca: fonti e progresso delle carte speciali sono consultabili',
    standalone: true,
    async run({ browser, assert }) {
        const root = path.join(__dirname, '..', '..').replace(/\\/g, '/');
        const context = await browser.newContext({ serviceWorkers: 'block' });
        await context.addInitScript(() => { localStorage.clear(); window.AUTH_GATE_SKIP = true; });
        const page = await context.newPage();
        try {
            await page.goto('file:///' + root + '/cartoteca.html');
            await page.waitForFunction(() => !!(window.CardAcquisition && window.SaveManager));
            const risultato = await page.evaluate(() => {
                SaveManager.createNew('Tester');
                SaveManager.setCardAcquisitionState({
                    claimed: {}, completedChapters: {}, completedChaptersByDifficulty: {}, unlockedPacks: {},
                    exodiaPity: 73,
                    counters: { seekerHard: 6, sliferStringsHard: 12, sliferStringsHealthy: 1 }
                });
                SaveManager.setChallengeProgress('carta-kaiba-drago-bianco-50', { count: 18, completed: false });
                SaveManager.setChallengeProgress('carta-kaiba-drago-bianco-100', { count: 18, completed: false });

                const leggi = (id) => {
                    CardDetail.open(cardDatabase.find((c) => c.id === id));
                    // La scheda è quella condivisa (js/ui/card-detail.js).
                    const box = document.querySelector('.cd-backdrop.open .cd-acquisition');
                    return box ? box.innerText : '';
                };
                return { slifer: leggi(31), exodia: leggi(11), drago: leggi(1) };
            });
            assert(/Strings: 12\/30/.test(risultato.slifer) && /4000 LP: 1\/1/.test(risultato.slifer),
                'Slifer deve mostrare requisiti e progresso personale');
            assert(/0,90%/.test(risultato.exodia) && /73\/250/.test(risultato.exodia) && /6\/10/.test(risultato.exodia),
                'Exodia deve mostrare probabilità, pity e progresso Seeker');
            assert(/50.*100 vittorie/.test(risultato.drago) && /18\/50.*18\/100/.test(risultato.drago),
                'Il Drago Bianco deve mostrare entrambe le soglie e il progresso');
        } finally {
            await context.close();
        }
    }
};
