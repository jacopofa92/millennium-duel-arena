// Posa di danno/sorpresa (js/ui/posa-danno.js): compare nel riquadro del duellante che perde molti Life Point, solo se la posa esiste.
const { openDuel, freezeNaturalGameLoop } = require('../helpers/harness');

module.exports = {
    standalone: true,
    name: 'Posa di danno: soglia (1000 LP o 10%), vale per entrambi, durata, e niente se la posa non esiste',
    async run(t) {
        const errori = [];
        const page = await t.browser.newPage({ viewport: { width: 1400, height: 900 } });
        page.on('pageerror', (e) => errori.push(e.message));
        await openDuel(page, '?mode=free&character=kaiba&difficulty=Difficile');
        await freezeNaturalGameLoop(page);
        await page.waitForSelector('#botInfo .duelist-avatar--corner img');

        const colpo = (lato, persi) => page.evaluate(({ lato, persi }) => {
            window.PosaDanno.sync();   // fotografa i LP di adesso
            gameState[lato + 'LP'] -= persi;
            EventiDuello.emetti('life-points');
        }, { lato, persi });
        const posa = (lato) => page.evaluate((l) => {
            const img = document.querySelector(`#${l}Info .duelist-avatar--corner img.posa-danno`);
            return img ? img.getAttribute('src') : null;
        }, lato);
        const attendi = (lato) => page.waitForFunction((l) => !!document.querySelector(`#${l}Info .duelist-avatar--corner img.posa-danno`), lato, { timeout: 4000 });

        // 1) Una perdita piccola (300 su 8000: meno di 1000 e meno del 10%) non fa niente.
        await colpo('bot', 300);
        await page.waitForTimeout(500);
        t.assert((await posa('bot')) === null, 'Una perdita piccola non mostra la posa');

        // 2) Una perdita pesante dell'AVVERSARIO mostra la sua posa, dalle miniature con trasparenza.
        await colpo('bot', 1500);
        await attendi('bot');
        const src = await posa('bot');
        t.assert(/pedine-danno-sorpresa\/thumbs\/[^/]+\.webp$/.test(src || ''), `La posa e' la miniatura WebP: ${src}`);
        t.assert(await page.evaluate(() => document.querySelector('#botInfo .duelist-avatar--corner').classList.contains('posa-danno-attiva')), 'La pedina normale si spegne mentre la posa e\' a vista');

        // 3) Dopo ~2 secondi la posa sparisce e il riquadro torna com'era.
        await page.waitForFunction(() => !document.querySelector('#botInfo .duelist-avatar--corner img.posa-danno'), null, { timeout: 5000 });
        t.assert(await page.evaluate(() => !document.querySelector('#botInfo .duelist-avatar--corner').classList.contains('posa-danno-attiva')), 'A posa finita la pedina normale torna visibile');

        // 4) Soglia relativa: a pochi LP anche 10% basta (500 su 4000).
        await page.evaluate(() => { gameState.botLP = 4000; window.PosaDanno.sync(); });
        await colpo('bot', 500);
        await attendi('bot');

        // 5) Nessuna posa per quel nome (un file che non esiste): non succede niente e nessun errore.
        await page.evaluate(() => {
            const img = document.querySelector('#playerInfo .duelist-avatar--corner img');
            img.setAttribute('src', 'images/characters/pedine/personaggioInesistente.png');
        });
        await colpo('player', 3000);
        await page.waitForTimeout(800);
        t.assert((await posa('player')) === null, 'Senza una posa per quel personaggio non si fa niente');

        await page.close();
        t.assert(errori.length === 0, `Nessun errore di pagina: ${errori.join(' | ')}`);
    }
};
