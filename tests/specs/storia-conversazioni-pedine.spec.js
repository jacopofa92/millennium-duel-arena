const path = require('path');

module.exports = {
    standalone: true,
    name: 'Storia: nelle conversazioni parla sempre la pedina, anche per il protagonista scritto a mano',
    async run(t) {
        const radice = path.join(__dirname, '..', '..');
        const page = await t.browser.newPage({ viewport: { width: 1280, height: 800 } });
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        try {
            await page.goto('file:///' + path.join(radice, 'storia.html').replace(/\\/g, '/') + '?campaign=anime');
            await page.waitForFunction(() => typeof StoryCutscene !== 'undefined' && typeof getCharacterPawnImage === 'function', null, { timeout: 15000 });
            // Una riga del roster, una con ritratto scritto a mano (il protagonista, `io: true`)
            // e una con l'aspetto di contesto: tutte devono arrivare come pedina.
            const fonti = await page.evaluate(async () => {
                StoryCutscene.play([
                    { chi: 'joey', testo: 'Prima riga' },
                    { chi: 'yugiMuto', io: true, ritratto: 'images/characters/yugiMuto.jpg', testo: 'Seconda riga' },
                    { chi: 'tea', testo: 'Terza riga' }
                ], { titolo: 'Prova' });
                const out = [];
                for (let i = 0; i < 4; i++) {
                    await new Promise((s) => setTimeout(s, 700));
                    const img = document.querySelector('.sc-ritratto img');
                    out.push(img ? (img.getAttribute('src') || '') : '');
                    const avanti = document.querySelector('.sc-avanti') || document.querySelector('.sc-scena');
                    if (avanti) avanti.click();
                }
                return out;
            });
            const conImmagine = fonti.filter(Boolean);
            t.assert(conImmagine.length >= 3, `Attese almeno tre immagini di ritratto, lette: ${JSON.stringify(fonti)}`);
            t.assert(conImmagine.every((src) => src.includes('/pedine/')),
                `Ogni ritratto di una conversazione deve essere una pedina: ${JSON.stringify(conImmagine)}`);
        } finally {
            await page.close();
        }
    }
};
