// Negozio: le carte COMUNI e RARE in rotazione costano solo Crediti (nessuna Stella); la Super 1 Stella, l'Ultra 3.
// Con zero Stelle in tasca una comune e una rara si devono poter comprare, una Super no.
//
// `standalone`: serve negozio.html, non la pagina del duello.
const path = require('path');

module.exports = {
    name: 'Negozio: carte comuni e rare solo Crediti, dalle Super anche Stelle',
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
                    super: per('super').map((c) => c.costo),
                    ultra: per('ultra').map((c) => c.costo),
                    stelle: SaveManager.getCurrency().starChips
                };
            });
            assert(dati.stelle === 0, 'Prerequisito: zero Stelle in tasca');
            assert(dati.comuni.length === 3, `Le comuni in rotazione sono 3 (trovate ${dati.comuni.length})`);
            assert(dati.comuni.every((c) => c.credits === 150 && !('starChips' in c)),
                `Le comuni costano solo 150 Crediti: ${JSON.stringify(dati.comuni)}`);
            assert(dati.rare.length === 2 && dati.rare.every((c) => c.credits === 450 && !('starChips' in c)),
                `Le rare costano solo 450 Crediti: ${JSON.stringify(dati.rare)}`);
            assert(dati.super.length === 1 && dati.super.every((c) => c.starChips === 1),
                `La Super chiede 1 Stella: ${JSON.stringify(dati.super)}`);
            assert(dati.ultra.length === 1 && dati.ultra.every((c) => c.starChips === 3),
                `L'Ultra chiede 3 Stelle: ${JSON.stringify(dati.ultra)}`);

            // UI: con zero Stelle i pulsanti di comuni e rare sono attivi e non citano le Stelle; quello della Super è spento.
            const bottoni = await page.evaluate(() => [...document.querySelectorAll('.shop-grid:not(.packs):not(.decks) .shop-item')].map((item) => {
                const badge = item.querySelector('.shop-badge');
                const b = item.querySelector('.buy-btn');
                return { rarita: badge ? badge.textContent.trim().toLowerCase() : '', disabilitato: b.disabled, testo: b.textContent };
            }));
            const trova = (re) => bottoni.find((b) => re.test(b.rarita));
            const comune = trova(/comun/);
            const rara = trova(/^rar/);
            const superRara = trova(/super/);
            assert(comune && !comune.disabilitato && !/⭐/.test(comune.testo), `Pulsante di una comune: ${JSON.stringify(comune)}`);
            assert(rara && !rara.disabilitato && !/⭐/.test(rara.testo), `Pulsante di una rara: ${JSON.stringify(rara)}`);
            assert(superRara && superRara.disabilitato && /⭐/.test(superRara.testo), `Pulsante di una Super: ${JSON.stringify(superRara)}`);

            // Comprare davvero una rara senza Stelle: scala solo 450 Crediti.
            const prima = await page.evaluate(() => SaveManager.getCurrency().credits);
            await page.evaluate(() => {
                const item = [...document.querySelectorAll('.shop-grid:not(.packs):not(.decks) .shop-item')]
                    .find((i) => /^rar/i.test(((i.querySelector('.shop-badge') || {}).textContent || '').trim()));
                item.querySelector('.buy-btn').click();
            });
            await page.waitForTimeout(800);
            const dopo = await page.evaluate(() => SaveManager.getCurrency());
            assert(dopo.credits === prima - 450 && dopo.starChips === 0, `Acquisto: -450 Crediti e Stelle invariate (${prima} -> ${JSON.stringify(dopo)})`);
            assert(erroriPagina.length === 0, `Errori di pagina: ${erroriPagina.join(' | ')}`);
        } finally {
            await context.close();
        }
    }
};
