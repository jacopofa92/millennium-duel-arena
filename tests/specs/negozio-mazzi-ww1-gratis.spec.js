// I mazzi della Grande Guerra sono GRATIS e si prendono UNA volta sola (`gratis: true` in
// js/data/starter-structure-decks.js, letto da ShopCatalog.mazziInVendita e dal Negozio):
//   - costano 0 Stelle e 0 Crediti e non chiedono carte speciali;
//   - prenderli non fa salire il prezzo degli altri mazzi dello stesso tipo;
//   - dal Negozio si prendono con un tocco, e poi risultano "Già acquistato";
//   - gli altri mazzi restano a pagamento.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Negozio: i mazzi della Grande Guerra sono gratis, una sola volta, e non rincarano gli altri',
    standalone: true,
    async run({ browser, assert }) {
        const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, serviceWorkers: 'block' });
        await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await ctx.newPage();
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await page.goto(url('negozio.html'));
            await page.waitForFunction(() => !!(window.ShopCatalog && window.SaveManager && window.ShopUI));
            const r = await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Prova');
                const mazzi = ShopCatalog.mazziInVendita();
                const ww1 = mazzi.filter((d) => /ww1/.test(d.packId));
                const altri = mazzi.filter((d) => !/ww1/.test(d.packId));
                const prima = ShopCatalog.costoMazzo('starter');
                SaveManager.addOwnedPack('starter_ww1_kuk');
                const dopo = ShopCatalog.costoMazzo('starter');
                return {
                    quanti: ww1.map((d) => d.packId),
                    costi: ww1.map((d) => [d.costo.starChips, d.costo.credits, d.costo.richiedeExtra, d.gratis]),
                    altriGratis: altri.filter((d) => d.gratis || (d.costo.starChips === 0 && d.costo.credits === 0)).length,
                    rincaro: [prima.starChips, dopo.starChips, prima.credits, dopo.credits]
                };
            });
            assert(r.quanti.length >= 3, `i tre mazzi della Grande Guerra sono in vendita: ${JSON.stringify(r.quanti)}`);
            assert(r.costi.every((c) => c[0] === 0 && c[1] === 0 && c[2] === false && c[3] === true), `costano 0 e non chiedono carte speciali: ${JSON.stringify(r.costi)}`);
            assert(r.altriGratis === 0, 'gli altri mazzi restano a pagamento');
            assert(r.rincaro[0] === r.rincaro[1] && r.rincaro[2] === r.rincaro[3], `prenderne uno non rincara gli altri: ${JSON.stringify(r.rincaro)}`);

            // Dal Negozio: un tocco, poi "Già acquistato".
            await page.reload();
            await page.waitForFunction(() => !!(window.ShopCatalog && window.ShopUI));
            await page.evaluate(() => { if (!SaveManager.hasSave()) SaveManager.createNew('Prova'); });
            await page.reload();
            await page.waitForSelector('.deck-box');
            const prima = await page.evaluate(() => ({ posseduto: SaveManager.ownsPack('starter_ww1_regio_esercito'), bottoni: Array.from(document.querySelectorAll('.buy-btn')).filter((b) => /Gratis/.test(b.textContent)).length }));
            assert(prima.bottoni >= 2 && !prima.posseduto, `i pulsanti "Gratis" ci sono: ${JSON.stringify(prima)}`);
            await page.locator('.buy-btn', { hasText: 'Gratis' }).first().click();
            await page.waitForTimeout(600);
            const dopo = await page.evaluate(() => {
                const posseduti = SaveManager.getOwnedPacks().filter((p) => /ww1/.test(p));
                return { posseduti, gratisRimasti: Array.from(document.querySelectorAll('.buy-btn')).filter((b) => /Gratis/.test(b.textContent)).length };
            });
            assert(dopo.posseduti.length >= 1, `il mazzo e' stato preso: ${JSON.stringify(dopo)}`);
            const doppio = await page.evaluate(() => {
                const prima = SaveManager.getOwnedPacks().length;
                SaveManager.addOwnedPack(SaveManager.getOwnedPacks().find((p) => /ww1/.test(p)));
                return SaveManager.getOwnedPacks().length - prima;
            });
            assert(doppio === 0, 'una seconda volta non aggiunge nulla');
            assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
        } finally {
            await ctx.close();
        }
    }
};
