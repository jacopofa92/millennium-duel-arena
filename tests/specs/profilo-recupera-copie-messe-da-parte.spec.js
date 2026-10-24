// Profilo: riprendere i salvataggi messi da parte (CloudSync.copieRecuperabili / ripristinaCopiaMessaDaParte +
// i pulsanti di js/ui/recupero-copia.js).
//   - si vedono SOLO le copie dell'account collegato e quelle senza proprietario, mai quelle di un altro account;
//   - ripristinare vuole due tocchi, applica la copia, conserva il salvataggio di adesso come copia di sicurezza
//     e toglie la copia usata dall'elenco;
//   - un account non puo' ripristinare la copia di un altro nemmeno chiamando la funzione a mano.
const path = require('path');
const { creaFintoCloud } = require('../helpers/finto-cloud.js');

const RADICE = path.join(__dirname, '..', '..');
const PROFILO = 'file:///' + path.join(RADICE, 'profilo.html').replace(/\\/g, '/');

module.exports = {
    name: 'Profilo: riprendere un salvataggio messo da parte, senza toccare quelli degli altri account',
    standalone: true,
    async run({ browser, assert }) {
        const { collega } = creaFintoCloud();
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
        await collega(ctx);
        const page = await ctx.newPage();
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await page.goto(PROFILO);
            await page.waitForFunction(() => !!(window.SaveManager && window.CloudSync && CloudSync.getUser && CloudSync.getUser()), null, { timeout: 30000 });
            await page.evaluate(() => { SaveManager.createNew('Admin'); SaveManager.addCurrency('credits', 100); });
            const prima = await page.evaluate(() => SaveManager.load().currency.credits);

            // Tre copie: una dell'account collegato, una senza proprietario, una di un ALTRO account.
            await page.evaluate(() => {
                const me = CloudSync.getUser().id;
                const copia = (extra) => {
                    const c = JSON.parse(JSON.stringify(SaveManager.load()));
                    c.currency.credits += extra;
                    c.player.lastSaved = new Date(Date.now() - 3600 * 1000).toISOString();
                    return { conservataIl: new Date().toISOString(), data: c };
                };
                const mappa = {};
                mappa[me] = copia(500);
                mappa.sconosciuto = copia(300);
                mappa['altro-account'] = copia(9000);
                localStorage.setItem('ygoSalvataggiDiAltriAccount', JSON.stringify(mappa));
                RecuperoCopia.monta(document.getElementById('recuperoCopiaMount'));
            });
            const elenco = await page.evaluate(() => CloudSync.copieRecuperabili().map((c) => ({ uid: c.uid, tipo: c.tipo, crediti: c.data.currency.credits })));
            assert(elenco.length === 2, `Solo due copie sono recuperabili (la tua e quella senza proprietario): ${JSON.stringify(elenco)}`);
            assert(!elenco.some((c) => c.uid === 'altro-account'), 'La copia di un altro account non si vede');
            const bottoni = await page.locator('#recuperoCopiaMount .rc-apri').count();
            assert(bottoni === 2, `Un pulsante per copia (2), trovati ${bottoni}`);

            // Un account non puo' prendersi la copia di un altro nemmeno a mano.
            const rifiutata = await page.evaluate(() => CloudSync.ripristinaCopiaMessaDaParte('altro-account', 0).then(() => false, () => true));
            assert(rifiutata, 'Ripristinare la copia di un altro account deve essere rifiutato');
            assert(await page.evaluate(() => SaveManager.load().currency.credits) === prima, 'e il salvataggio non cambia');

            // Ripristino della propria copia: due tocchi.
            await page.locator('#recuperoCopiaMount .rc-apri', { hasText: 'Tuo salvataggio' }).click();
            await page.waitForSelector('#recuperoCopia .rc-box');
            const ok = page.locator('#recuperoCopia .rc-btn--ok');
            await ok.click();
            assert(await page.evaluate(() => SaveManager.load().currency.credits) === prima, 'il primo tocco non cambia nulla');
            await ok.click();
            await page.waitForFunction((n) => SaveManager.load().currency.credits === n, prima + 500, { timeout: 8000 });
            const dopo = await page.evaluate(() => ({
                sicurezza: CloudSync.copiaDivergente() ? CloudSync.copiaDivergente().data.currency.credits : null,
                rimaste: CloudSync.copieRecuperabili().map((c) => c.uid),
                altroIntatta: !!CloudSync.copieDiAltriAccount()['altro-account']
            }));
            assert(dopo.sicurezza === prima, `Il salvataggio di prima e' diventato la copia di sicurezza: ${dopo.sicurezza}`);
            assert(dopo.rimaste.length === 1 && dopo.rimaste[0] === 'sconosciuto', `La copia usata esce dall'elenco, resta l'altra: ${JSON.stringify(dopo.rimaste)}`);
            assert(dopo.altroIntatta, 'La copia dell\'altro account non e\' stata toccata');
            assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
        } finally {
            await ctx.close();
        }
    }
};
