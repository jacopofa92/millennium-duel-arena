// Il Negozio cambia le valute, ma solo entro un tetto settimanale (ShopCatalog.CONVERSIONI / converti).
// =====================================================================================
// Scelte dell'utente: 500 crediti = 1 Stella; 20 Stelle = 1 Carta Locazione; 20 Stelle = 1 Carta del Millennio; NESSUN
// cambio fra Locazione e Millennio (in nessun verso) e niente Stelle -> crediti. Il tetto riparte con la chiave settimana.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Negozio: cambio valute entro un tetto settimanale, senza Locazione <-> Millennio',
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
                if (!SaveManager.hasSave()) SaveManager.createNew('Cambiavalute');
                const save = SaveManager.load();
                save.currency = Object.assign({}, save.currency, { credits: 20000, starChips: 100, locatorCards: 0, millenniumCards: 0 });
                SaveManager.touch(save);
                const w = () => SaveManager.getCurrency();
                const out = {};
                // Tabella: solo i tre cambi voluti.
                out.ids = ShopCatalog.CONVERSIONI.map((c) => c.id + ':' + c.da + '>' + c.a + ':' + c.costo);
                // 500 crediti = 1 Stella.
                out.c1 = ShopCatalog.converti('crediti-stelle', 3);
                out.dopoCrediti = [w().credits, w().starChips];
                // Il tetto (10 a settimana): 7 restanti, 8 non passano e non cambiano nulla.
                out.oltre = ShopCatalog.converti('crediti-stelle', 8);
                out.dopoOltre = [w().credits, w().starChips];
                // 20 Stelle = 1 Carta Locazione, 20 Stelle = 1 Carta del Millennio.
                out.l1 = ShopCatalog.converti('stelle-locazione', 1);
                out.m1 = ShopCatalog.converti('stelle-millennio', 1);
                out.carte = [w().locatorCards, w().millenniumCards, w().starChips];
                // Millennio: tetto 1 a settimana.
                out.m2 = ShopCatalog.converti('stelle-millennio', 1);
                // Un cambio che non esiste (carte speciali fra loro) non passa.
                out.inverso = ShopCatalog.converti('locazione-millennio', 1);
                out.inverso2 = ShopCatalog.converti('millennio-locazione', 1);
                // Saldo insufficiente: nessun cambio parziale.
                const s2 = SaveManager.load();
                s2.currency.credits = 400;
                SaveManager.touch(s2);
                out.povero = ShopCatalog.converti('crediti-stelle', 1);
                // La settimana dopo il tetto riparte.
                const originale = window.ServerDate && ServerDate.weekKey;
                window.ServerDate.weekKey = () => '2099-W01';
                out.statoNuovaSettimana = ShopCatalog.statoConversione('stelle-millennio').restanti;
                window.ServerDate.weekKey = originale;
                return out;
            });
            assert(r.ids.length === 3 && r.ids.includes('crediti-stelle:credits>starChips:500') && r.ids.includes('stelle-locazione:starChips>locatorCards:20') && r.ids.includes('stelle-millennio:starChips>millenniumCards:20'),
                `i tre cambi voluti, e solo quelli: ${JSON.stringify(r.ids)}`);
            assert(r.c1.ok && r.dopoCrediti[0] === 20000 - 1500 && r.dopoCrediti[1] === 103, `500 crediti = 1 Stella: ${JSON.stringify(r.dopoCrediti)}`);
            assert(!r.oltre.ok && r.dopoOltre[0] === r.dopoCrediti[0] && r.dopoOltre[1] === r.dopoCrediti[1], `oltre il tetto non cambia niente: ${JSON.stringify(r.oltre)}`);
            assert(r.l1.ok && r.m1.ok && r.carte[0] === 1 && r.carte[1] === 1 && r.carte[2] === 103 - 40, `20 Stelle = 1 Locazione e 20 Stelle = 1 Millennio: ${JSON.stringify(r.carte)}`);
            assert(!r.m2.ok, 'il tetto del Millennio (1 a settimana) vale');
            assert(!r.inverso.ok && !r.inverso2.ok, 'nessun cambio fra Locazione e Millennio');
            assert(!r.povero.ok, 'con un saldo che non basta non si cambia');
            assert(r.statoNuovaSettimana === 1, `il tetto riparte la settimana dopo: ${r.statoNuovaSettimana}`);

            // L'interfaccia: la sezione c'e', una riga per cambio, con tetto e pulsanti.
            await page.reload();
            await page.click('.shop-tab >> nth=3');   // il cambio sta nella scheda Cambio
        await page.waitForSelector('.cambio-riga', { timeout: 15000 });
            const righe = await page.$$eval('.cambio-riga', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ')));
            assert(righe.length === 3, `una riga per cambio nel Negozio: ${righe.length}`);
            assert(righe.every((t) => /Questa settimana: \d+\/\d+/.test(t)), `ogni riga dice il tetto: ${JSON.stringify(righe)}`);
            assert(errori.length === 0, `nessun errore: ${errori.join(' | ')}`);
        } finally {
            await ctx.close();
        }
    }
};
