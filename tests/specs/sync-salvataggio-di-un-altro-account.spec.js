// Cambio account sullo STESSO dispositivo (admin -> altro -> admin): il salvataggio locale e' uno solo per
// dispositivo, e prima non diceva di quale account fosse. Al rientro la regola "vince il piu' recente" lo CARICAVA SOPRA
// il cloud dell'account che entrava, cancellandone i deck (segnalato dall'utente: "ho perso tutti i deck").
//
// Ora il dispositivo ricorda a chi appartiene il salvataggio locale (js/cloud/cloud-sync.js, "A CHI APPARTIENE"):
//   1) se chi e' collegato NON e' il proprietario, il locale non si carica MAI: viene messo da parte in una copia per
//      account e il cloud resta intatto;
//   2) un dispositivo senza marcatore (aggiornato da poco) lo ricava dall'ultima base di sincronizzazione;
//   3) per il proprietario vero niente cambia: carica e scarica come sempre.
// Un solo utente nel cloud finto: il "cambio di account" si simula con il marcatore di proprieta' del dispositivo.
const path = require('path');
const { creaFintoCloud } = require('../helpers/finto-cloud.js');

const RADICE = path.join(__dirname, '..', '..');
const INDEX = 'file:///' + path.join(RADICE, 'index.html').replace(/\\/g, '/');

module.exports = {
    name: 'Sync: il salvataggio di un altro account non viene mai caricato sul cloud di chi entra',
    standalone: true,
    async run({ browser, assert }) {
        const { cloud, collega } = creaFintoCloud();
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
        await collega(ctx);
        const page = await ctx.newPage();
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        const creditiCloud = () => { const r = cloud.saves['utente-prova']; return r && r.data.currency ? (r.data.currency.credits || 0) : null; };
        try {
            await page.goto(INDEX);
            await page.waitForFunction(() => !!(window.SaveManager && window.CloudSync && window.AutoSync));
            await page.waitForTimeout(800);

            // Il proprietario vero carica il suo salvataggio.
            await page.evaluate(() => { SaveManager.createNew('Admin'); SaveManager.addCurrency('credits', 1000); });
            const V1 = await page.evaluate(() => SaveManager.load().currency.credits);
            await page.evaluate(() => AutoSync.caricaOra());
            assert(creditiCloud() === V1, `il proprietario carica: ${creditiCloud()}`);
            const marc = await page.evaluate(() => CloudSync.proprietarioLocale());
            assert(marc === 'utente-prova', `il dispositivo ricorda a chi appartiene il salvataggio: ${marc}`);

            // 1) Il salvataggio locale diventa di un ALTRO account e piu' recente: non deve mai finire sul cloud.
            await page.evaluate(() => {
                SaveManager.addCurrency('credits', 4000);
                localStorage.setItem('ygoProprietarioSalvataggio', 'altro-account');
            });
            const esito = await page.evaluate(() => CloudSync.pushSave().then(() => 'caricato', (e) => e.code || e.message));
            assert(esito === 'SALVATAGGIO_DI_ALTRO_ACCOUNT', `il locale di un altro account non si carica: ${esito}`);
            assert(creditiCloud() === V1, `il cloud resta intatto: ${creditiCloud()}`);
            const dopo = await page.evaluate(() => ({
                haSalvataggio: SaveManager.hasSave(),
                copia: (CloudSync.copieDiAltriAccount()['altro-account'] || {}).data
            }));
            assert(!dopo.haSalvataggio, 'il dispositivo e\' stato liberato');
            assert(dopo.copia && dopo.copia.currency && dopo.copia.currency.credits === V1 + 4000, `ma i dati dell'altro account sono conservati in una copia: ${JSON.stringify(dopo.copia && dopo.copia.currency)}`);

            // Chi entra riparte dal SUO cloud.
            await page.evaluate(() => CloudSync.pullSave());
            const scaricato = await page.evaluate(() => ({ crediti: SaveManager.load().currency.credits, proprietario: CloudSync.proprietarioLocale() }));
            assert(scaricato.crediti === V1 && scaricato.proprietario === 'utente-prova', `riparte dal proprio cloud: ${JSON.stringify(scaricato)}`);

            // 2) Dispositivo senza marcatore: lo ricava dall'ultima base (qui di un altro utente).
            await page.evaluate(() => {
                SaveManager.addCurrency('credits', 7000);
                localStorage.removeItem('ygoProprietarioSalvataggio');
                localStorage.setItem('ygoCloudBase', JSON.stringify({ uid: 'altro-account', updatedAt: new Date().toISOString() }));
            });
            await page.evaluate(() => CloudSync.fetchCloudSave());
            const senzaMarcatore = await page.evaluate(() => ({ ha: SaveManager.hasSave(), copia: !!CloudSync.copieDiAltriAccount()['altro-account'] }));
            assert(!senzaMarcatore.ha && senzaMarcatore.copia, `senza marcatore vale l'ultima base: ${JSON.stringify(senzaMarcatore)}`);

            // 3) Controllo in positivo: il proprietario carica come sempre.
            await page.evaluate(() => CloudSync.pullSave());
            await page.evaluate(() => { SaveManager.addCurrency('credits', 500); });
            const V3 = await page.evaluate(() => SaveManager.load().currency.credits);
            const esito3 = await page.evaluate(() => CloudSync.pushSave().then(() => 'caricato', (e) => e.code || e.message));
            assert(esito3 === 'caricato' && creditiCloud() === V3, `il proprietario vero carica normalmente: ${esito3} ${creditiCloud()} vs ${V3}`);
            assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
        } finally {
            await ctx.close();
        }
    }
};
