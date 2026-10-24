// Indicatore dello stato del salvataggio (js/ui/stato-salvataggio.js + AutoSync.stato/onStato).
//
// Racconta soltanto: cloud / in arrivo / offline. Qui si prova il componente montato su una pagina che carica
// AutoSync (admin.html, con il cloud finto e un utente collegato) e si pilota la rete con il contesto del browser.
const path = require('path');
const { creaFintoCloud } = require('../helpers/finto-cloud.js');

const RADICE = path.join(__dirname, '..', '..');
const PAGINA = 'file:///' + path.join(RADICE, 'admin.html').replace(/\\/g, '/');

module.exports = {
    name: 'Menu: l\'indicatore dice se i progressi sono sul cloud, in arrivo o solo su questo dispositivo',
    standalone: true,
    async run({ browser, assert }) {
        const { collega } = creaFintoCloud();
        const context = await browser.newContext({ viewport: { width: 412, height: 900 }, serviceWorkers: 'block' });
        await collega(context);
        const page = await context.newPage();
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await page.goto(PAGINA);
            await page.waitForFunction(() => window.AutoSync && typeof AutoSync.stato === 'function' && window.CloudSync, null, { timeout: 30000 });
            await page.addScriptTag({ path: path.join(RADICE, 'js', 'ui', 'stato-salvataggio.js') });
            await page.evaluate(() => {
                const d = document.createElement('div'); d.id = 'prova'; document.body.appendChild(d);
                StatoSalvataggio.monta(d);
            });
            const leggi = () => page.evaluate(() => {
                const el = document.querySelector('#prova .stato-salvataggio');
                return el ? { nascosto: el.hidden, testo: el.querySelector('.stato-salvataggio-testo').textContent, classe: el.className } : null;
            });

            // 1) Con un account e senza niente da mandare: "salvato".
            await page.waitForFunction(() => AutoSync.stato() === 'salvato', null, { timeout: 10000 });
            await page.waitForFunction(() => !document.querySelector('#prova .stato-salvataggio').hidden, null, { timeout: 5000 });
            let s = await leggi();
            assert(s && /salvati sul cloud/i.test(s.testo) && /--ok/.test(s.classe), `Con tutto allineato deve dire che e' sul cloud: ${JSON.stringify(s)}`);

            // 2) Offline: lo dice, e dice che i progressi restano qui.
            await context.setOffline(true);
            await page.evaluate(() => window.dispatchEvent(new Event('offline')));
            await page.waitForFunction(() => /offline/i.test(document.querySelector('#prova .stato-salvataggio-testo').textContent), null, { timeout: 5000 });
            s = await leggi();
            assert(/questo dispositivo/i.test(s.testo) && /--avviso/.test(s.classe), `Offline deve avvisare: ${JSON.stringify(s)}`);

            // 3) Torna la rete: torna "salvato".
            await context.setOffline(false);
            await page.evaluate(() => window.dispatchEvent(new Event('online')));
            await page.waitForFunction(() => /salvati sul cloud/i.test(document.querySelector('#prova .stato-salvataggio-testo').textContent), null, { timeout: 5000 });

            // 4) Un salvataggio in coda si vede come "in arrivo".
            await page.evaluate(() => { localStorage.setItem('ygoSyncInSospeso', '1'); });
            assert(await page.evaluate(() => AutoSync.stato()) === 'in-attesa', 'Con un salvataggio in coda lo stato e\' "in-attesa"');
            await page.evaluate(() => { localStorage.removeItem('ygoSyncInSospeso'); });
            assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
        } finally { await context.close(); }
    }
};
