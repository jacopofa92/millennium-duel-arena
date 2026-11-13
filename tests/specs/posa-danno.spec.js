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
            gameState[lato + 'LP'] -= persi;   // la stessa cosa che fa ACTIONS.dealDamage
            EventiDuello.emetti('danno-subito', lato, persi);
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

        // 3) In uscita la posa rincula ma non sfuma: il cambio è coperto da un lampo breve.
        await page.waitForFunction(() => {
            const img = document.querySelector('#botInfo .duelist-avatar--corner img.posa-danno');
            return img && img.getAnimations().some((a) => a.effect.getTiming().duration === 320);
        }, null, { timeout: 5000 });
        const ritorno = await page.evaluate(() => {
            const img = document.querySelector('#botInfo .duelist-avatar--corner img.posa-danno');
            return img && img.getAnimations().find((a) => a.effect.getTiming().duration === 320).effect.getKeyframes();
        });
        t.assert(ritorno && ritorno.every((f) => f.opacity === undefined || f.opacity === 1),
            `La posa rientra con rinculo senza dissolvenza: ${JSON.stringify(ritorno)}`);
        t.assert(await page.evaluate(() => document.querySelector('#botInfo .duelist-avatar--corner').classList.contains('posa-danno-ritorno')),
            'Il cambio di posa è coperto dal lampo di ritorno');
        await page.waitForFunction(() => !document.querySelector('#botInfo .duelist-avatar--corner img.posa-danno'), null, { timeout: 5000 });
        t.assert(await page.evaluate(() => !document.querySelector('#botInfo .duelist-avatar--corner').classList.contains('posa-danno-attiva')), 'A posa finita la pedina normale torna visibile');

        // 4) Soglia relativa: a pochi LP anche 10% basta (500 su 4000).
        await page.evaluate(() => { gameState.botLP = 4000; });
        await colpo('bot', 500);
        await attendi('bot');

        // 4b) Un COSTO pagato in LP (Ra, ecc.) si sottrae direttamente e non e' un danno: niente posa, nemmeno se enorme.
        await page.waitForFunction(() => !document.querySelector('#botInfo .duelist-avatar--corner img.posa-danno'), null, { timeout: 5000 });
        await page.evaluate(() => { gameState.botLP -= 3500; EventiDuello.emetti('life-points'); EventiDuello.emetti('ridisegna'); });
        await page.waitForTimeout(700);
        t.assert((await posa('bot')) === null, 'Un costo pagato in Life Point non e\' un danno: niente posa');

        // 4c) Il danno VERO passa da ACTIONS.dealDamage (battaglia ed effetti): li' la posa parte.
        await page.evaluate(() => { gameState.botLP = 8000; DuelEngine.actions.dealDamage('bot', 2000); });
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
