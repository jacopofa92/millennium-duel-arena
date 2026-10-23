// La cerimonia di apertura bustina ha una luce WebGL (js/economy/pack-opening-webgl.js): un canvas creato
// all'apertura e RILASCIATO alla chiusura (su telefono i contesti sono pochi), che dalla Super in su si
// accorda con la fascia della carta. Con il movimento ridotto non si crea. Il riepilogo annuncia anche
// le fasce oltre l'ultra rara (prima Super e Leggendaria erano trattate come comuni).
//
// `standalone`: serve negozio.html, non la pagina del duello.
const path = require('path');

module.exports = {
    name: 'Apertura bustina: luce WebGL creata e rilasciata, fasce alte annunciate',
    standalone: true,
    async run({ browser, assert }) {
        const RADICE = path.join(__dirname, '..', '..');
        const url = 'file:///' + RADICE.replace(/\\/g, '/') + '/negozio.html';
        const context = await browser.newContext({ viewport: { width: 411, height: 780 }, serviceWorkers: 'block' });
        await context.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await context.newPage();
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await page.goto(url);
            await page.waitForFunction(() => !!(window.PackOpening && window.PackOpeningGL && window.CardRarity), null, { timeout: 20000 });
            const ids = await page.evaluate(() => ['common', 'rare', 'super', 'ultra', 'legendary'].map((r) => CardRarity.idsByRarity(r)[0]));
            assert(ids.every(Boolean), `Servono carte di ogni fascia: ${JSON.stringify(ids)}`);

            await page.evaluate((ids) => {
                window.__chiusa = false;
                PackOpening.apri({ nome: 'Prova', nomeBreve: 'PROVA', carte: 5, colore: '#1d4f9e' }, ids, [], () => { window.__chiusa = true; });
            }, ids);
            await page.waitForSelector('.po-bustina');
            const conLuce = await page.evaluate(() => !!document.querySelector('.po-backdrop > canvas'));
            assert(conLuce, 'Con WebGL disponibile la cerimonia ha il suo canvas di luce');

            // Si strappa la bustina e si salta alla fine (tocco sullo sfondo): il riepilogo annuncia la fascia più alta.
            await page.evaluate(() => document.querySelector('.po-bustina').click());
            await page.waitForSelector('.po-palco', { timeout: 8000 });
            await page.waitForTimeout(600);
            await page.evaluate(() => document.querySelector('.po-backdrop').click());
            await page.waitForSelector('.po-riepilogo', { timeout: 5000 });
            const riepilogo = await page.evaluate(() => document.querySelector('.po-riepilogo').textContent);
            assert(/LEGGENDARIA/.test(riepilogo), `Il riepilogo annuncia la leggendaria: "${riepilogo}"`);

            await page.evaluate(() => document.querySelector('.po-chiudi').click());
            await page.waitForFunction(() => window.__chiusa === true, null, { timeout: 5000 });
            const dopo = await page.evaluate(() => ({ backdrop: !!document.querySelector('.po-backdrop'), canvas: document.querySelectorAll('canvas').length }));
            assert(!dopo.backdrop, 'Alla chiusura la cerimonia sparisce');
            assert(dopo.canvas === 0, `Alla chiusura non resta alcun canvas (contesto rilasciato): ${dopo.canvas}`);

            // Movimento ridotto: nessuna luce, resta la cerimonia senza movimento.
            await page.emulateMedia({ reducedMotion: 'reduce' });
            const ridotto = await page.evaluate(() => PackOpeningGL.crea(document.body));
            assert(ridotto === null, 'Con il movimento ridotto la luce WebGL non si crea');
            assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
        } finally {
            await context.close();
        }
    }
};
