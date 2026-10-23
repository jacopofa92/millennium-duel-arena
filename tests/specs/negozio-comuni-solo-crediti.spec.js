// Negozio: le carte COMUNI in rotazione costano solo Crediti (nessuna Stella); dalle rare in su servono anche
// le Stelle. Con zero Stelle in tasca una comune si deve poter comprare, una rara no.
//
// `standalone`: serve negozio.html, non la pagina del duello.
const path = require('path');

module.exports = {
    name: 'Negozio: le carte comuni costano solo Crediti',
    standalone: true,
    async run({ browser, assert }) {
        const RADICE = path.join(__dirname, '..', '..');
        const url = 'file:///' + RADICE.replace(/\\/g, '/') + '/negozio.html';
        const context = await browser.newContext({ viewport: { width: 900, height: 950 }, serviceWorkers: 'block' });
        await context.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await context.newPage();
        const erroriPagina = [];
        page.on('pageerror', (e) => erroriPagina.push(e.message));
        try {
            await page.goto(url);
            await page.waitForFunction(() => !!(window.ShopCatalog && window.SaveManager), null, { timeout: 20000 });
            await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                const w = SaveManager.getCurrency();
                SaveManager.addCurrency('credits', 100000 - w.credits);
                SaveManager.addCurrency('starChips', -w.starChips);   // zero Stelle
            });
            await page.reload();
            await page.waitForSelector('.shop-item', { timeout: 20000 });

            const dati = await page.evaluate(() => {
                const carte = ShopCatalog.carteDelGiorno();
                const per = (r) => carte.filter((c) => c.rarity === r);
                return {
                    comuni: per('common').map((c) => c.costo),
                    rare: per('rare').map((c) => c.costo),
                    stelle: SaveManager.getCurrency().starChips
                };
            });
            assert(dati.stelle === 0, 'Prerequisito: zero Stelle in tasca');
            assert(dati.comuni.length === 3, `Le comuni in rotazione sono 3 (trovate ${dati.comuni.length})`);
            assert(dati.comuni.every((c) => c.credits === 150 && !('starChips' in c)),
                `Le comuni costano solo 150 Crediti: ${JSON.stringify(dati.comuni)}`);
            assert(dati.rare.every((c) => c.starChips === 2), `Le rare chiedono ancora 2 Stelle: ${JSON.stringify(dati.rare)}`);

            // UI: con zero Stelle il pulsante di una comune è attivo e non cita le Stelle; quello di una rara è spento.
            const bottoni = await page.evaluate(() => [...document.querySelectorAll('.shop-grid:not(.packs):not(.decks) .shop-item')].map((item) => {
                const badge = item.querySelector('.shop-badge');
                const b = item.querySelector('.buy-btn');
                return { rarita: badge ? badge.textContent.trim().toLowerCase() : '', disabilitato: b.disabled, testo: b.textContent };
            }));
            const comune = bottoni.find((b) => /comun/.test(b.rarita));
            const rara = bottoni.find((b) => /^rar/.test(b.rarita));
            assert(comune && !comune.disabilitato && !/⭐/.test(comune.testo), `Pulsante di una comune: ${JSON.stringify(comune)}`);
            assert(rara && rara.disabilitato && /⭐/.test(rara.testo), `Pulsante di una rara: ${JSON.stringify(rara)}`);

            // Comprare davvero una comune senza Stelle.
            const prima = await page.evaluate(() => SaveManager.getCurrency().credits);
            await page.evaluate(() => {
                const item = [...document.querySelectorAll('.shop-grid:not(.packs):not(.decks) .shop-item')]
                    .find((i) => /comun/i.test((i.querySelector('.shop-badge') || {}).textContent || ''));
                item.querySelector('.buy-btn').click();
            });
            await page.waitForTimeout(800);
            const dopo = await page.evaluate(() => SaveManager.getCurrency());
            assert(dopo.credits === prima - 150 && dopo.starChips === 0, `Acquisto: -150 Crediti e Stelle invariate (${prima} -> ${JSON.stringify(dopo)})`);
            assert(erroriPagina.length === 0, `Errori di pagina: ${erroriPagina.join(' | ')}`);
        } finally {
            await context.close();
        }
    }
};
