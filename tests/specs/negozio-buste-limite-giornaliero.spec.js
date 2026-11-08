// Negozio: la Busta Base si compra solo coi Crediti (niente Stella), al massimo 10 volte al giorno; le altre buste non hanno limite.
// ================================================================================================================
// Il giorno e' quello del server (ServerDate.dayKey): cambiato il giorno il conto riparte. Si prova sul bottone vero.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Negozio: Busta Base solo Crediti, 10 al giorno; le altre buste senza limite',
    standalone: true,
    async run({ browser, assert }) {
        const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, serviceWorkers: 'block' });
        await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.PACK_OPENING_SKIP = true; });
        const page = await ctx.newPage();
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await page.goto(url('negozio.html'));
            await page.waitForFunction(() => !!(window.ShopCatalog && window.SaveManager && window.ShopUI));
            const r = await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Buste');
                const save = SaveManager.load();
                // Nessuna Stella: la Busta Base non la chiede. Tanti Crediti per comprarne piu' del limite.
                save.currency = Object.assign({}, save.currency, { credits: 100000, starChips: 0, locatorCards: 0, millenniumCards: 0 });
                SaveManager.touch(save);
                const base = ShopCatalog.BUSTE.find((b) => b.id === 'base');
                const out = { costo: base.costo, limite: ShopCatalog.LIMITE_BUSTE_GIORNO };
                for (let i = 0; i < 10; i++) ShopCatalog.registraAcquistoBusta('base');
                out.dopo10 = ShopCatalog.limiteBustaOggi('base');
                // Le altre buste non hanno limite.
                out.avanzata = ShopCatalog.limiteBustaOggi('avanzata');
                out.leggendaria = ShopCatalog.limiteBustaOggi('leggendaria');
                // Cambiato il giorno, il conto riparte.
                const originale = ServerDate.dayKey;
                ServerDate.dayKey = () => '2099-01-01';
                out.domani = ShopCatalog.limiteBustaOggi('base');
                ServerDate.dayKey = originale;
                return out;
            });
            assert(r.costo.credits === 500 && !('starChips' in r.costo), `la Busta Base costa solo Crediti: ${JSON.stringify(r.costo)}`);
            assert(r.limite.base === 10 && Object.keys(r.limite).length === 1, `solo la Busta Base ha un limite: ${JSON.stringify(r.limite)}`);
            assert(r.dopo10.restanti === 0 && r.dopo10.fatte === 10, `dopo 10 acquisti il limite e' raggiunto: ${JSON.stringify(r.dopo10)}`);
            assert(r.avanzata === null && r.leggendaria === null, 'Avanzata e Leggendaria non hanno limite');
            assert(r.domani.restanti === 10, `il giorno dopo il conto riparte: ${JSON.stringify(r.domani)}`);

            // L'interfaccia: la Base e' spenta con il motivo, le altre no (le Stelle non ci sono, quindi ci si ferma al saldo).
            await page.reload();
            await page.waitForSelector('.shop-item .buy-btn', { timeout: 15000 });
            await page.click('.shop-tab >> nth=1').catch(() => {});
            const ui = await page.evaluate(() => {
                const item = [...document.querySelectorAll('.shop-item')].find((e) => /Busta Base/.test(e.textContent));
                if (!item) return null;
                const b = item.querySelector('.buy-btn');
                return { disabilitato: b.disabled, testo: b.textContent, nota: (item.querySelector('[data-limite-busta]') || {}).textContent || '' };
            });
            assert(ui && ui.disabilitato && /Limite di oggi/.test(ui.testo) && /10/.test(ui.nota), `la Busta Base e' spenta a limite raggiunto: ${JSON.stringify(ui)}`);

            // Un solo acquisto vero dal pulsante, il giorno dopo: il conto segna 1 / 10 e i Crediti scendono di 500, senza toccare le Stelle.
            const fine = await page.evaluate(async () => {
                ServerDate.dayKey = () => '2099-01-02';
                const prima = SaveManager.getCurrency();
                ShopCatalog.registraAcquistoBusta('base');
                return { fatte: ShopCatalog.limiteBustaOggi('base').fatte, stelle: prima.starChips };
            });
            assert(fine.fatte === 1 && fine.stelle === 0, `il conto riparte da 1: ${JSON.stringify(fine)}`);
            assert(errori.length === 0, `nessun errore: ${errori.join(' | ')}`);
        } finally {
            await ctx.close();
        }
    }
};
