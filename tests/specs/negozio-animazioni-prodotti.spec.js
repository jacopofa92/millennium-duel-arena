const path = require('path');

module.exports = {
    name: 'Negozio: apertura busta e acquisto deck riusano i prodotti reali',
    standalone: true,
    async run({ browser, assert }) {
        const root = path.join(__dirname, '..', '..');
        const url = 'file:///' + path.join(root, 'negozio.html').replace(/\\/g, '/');
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        await context.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await context.newPage();
        try {
            await page.goto(url);
            await page.waitForFunction(() => !!(window.PackOpening && window.DeckBox && typeof cardDatabase !== 'undefined'));

            await page.evaluate(() => PackOpening.apri({
                nome: 'Busta prova', nomeBreve: 'PROVA', colore: '#275ba8', icona: '👁', carte: 1
            }, [1], [1]));
            await page.waitForSelector('.po-pack-body');
            const busta = await page.evaluate(() => ({
                colore: document.querySelector('.po-bustina').style.getPropertyValue('--pack-base'),
                titolo: document.querySelector('.po-pack-band').textContent,
                conteggio: document.querySelector('.po-pack-count').textContent
            }));
            assert(busta.colore === '#275ba8' && busta.titolo === 'PROVA' && /1 CARTE/.test(busta.conteggio),
                `La cinematica non riproduce la busta acquistata: ${JSON.stringify(busta)}`);
            await page.locator('.po-bustina').dispatchEvent('click');
            assert(await page.locator('.po-bustina-strappata .po-pack-tear').count() === 1,
                'Lo strappo deve animare la linguetta della busta reale');
            await page.locator('.po-backdrop').evaluate((el) => el.remove());

            await page.evaluate(() => PackOpening.festeggiaMazzo({
                nome: 'Deck prova', packId: 'starter_sdy_yugi', coverCardId: 1
            }, [1, 2, 3, 4, 5]));
            await page.waitForSelector('.po-scatola .deck-box-art');
            // La scatola si apre dopo l'atto di carica (circa 0,9 s con la luce WebGL, 0,3 s senza): si aspetta il fatto, non un tempo.
            await page.waitForFunction(() => document.querySelector('.po-scatola').classList.contains('po-scatola-aperta'), null, { timeout: 5000 });
            const deck = await page.evaluate(() => ({
                cover: !!document.querySelector('.po-scatola .dbx-cover'),
                aperto: document.querySelector('.po-scatola').classList.contains('po-scatola-aperta'),
                aura: !!document.querySelector('.po-deck-aura'),
                sigillo: (document.querySelector('.po-deck-sigillo') || {}).textContent || '',
                carte: document.querySelectorAll('.po-ventaglio-carta').length
            }));
            assert(deck.cover && deck.aperto && deck.aura && deck.carte === 5 && deck.sigillo === 'MAZZO ACQUISITO',
                `La celebrazione deck non usa tutti gli elementi del prodotto: ${JSON.stringify(deck)}`);
        } finally {
            await context.close();
        }
    }
};
