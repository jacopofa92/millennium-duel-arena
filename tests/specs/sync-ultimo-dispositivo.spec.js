// "Ultimo salvataggio da un altro dispositivo": il salvataggio sul cloud porta
// il segno di CHI l'ha scritto per ultimo (js/cloud/cloud-sync.js,
// ultimoDispositivo), e il Profilo lo dice. Due dispositivi veri, un cloud
// condiviso (tests/helpers/finto-cloud.js):
//   - dopo che il telefono ha caricato, il desktop vede "un altro dispositivo"
//     col nome del telefono, e il telefono vede "questo dispositivo";
//   - il segno vive nella riga del cloud, MAI nel salvataggio di gioco locale;
//   - nel Profilo (vista del menu) la riga compare con il testo giusto.
const path = require('path');
const { creaFintoCloud } = require('../helpers/finto-cloud.js');

const RADICE = path.join(__dirname, '..', '..');
const INDEX = 'file:///' + path.join(RADICE, 'profilo.html').replace(/\\/g, '/');

module.exports = {
    name: 'Sync: il Profilo dice se l\'ultimo salvataggio è di un altro dispositivo',
    standalone: true,
    async run({ browser, assert }) {
        const { cloud, collega } = creaFintoCloud();
        const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
        const telefono = await browser.newContext({
            viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block',
            userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
        });
        await collega(desktop);
        await collega(telefono);
        const aspettaMenu = (page) => page.waitForFunction(() => {
            return !!document.getElementById('cloudUltimo') && !!window.CloudSync;
        }, null, { timeout: 20000 });
        try {
            const tel = await telefono.newPage();
            await tel.goto(INDEX);
            await tel.waitForFunction(() => !!(window.SaveManager && window.CloudSync));
            await tel.evaluate(() => { SaveManager.createNew('Admin'); SaveManager.addCurrency('credits', 500); });
            await tel.evaluate(() => AutoSync.caricaOra());

            const riga = cloud.saves['utente-prova'];
            assert(riga && riga.data.ultimoDispositivo && riga.data.ultimoDispositivo.id, 'il cloud porta il segno del dispositivo');
            assert(/Android/.test(riga.data.ultimoDispositivo.nome), 'il nome dice che è un Android: ' + riga.data.ultimoDispositivo.nome);

            const dalTelefono = await tel.evaluate(() => CloudSync.ultimoDispositivo());
            assert(dalTelefono && dalTelefono.questo === true, 'il telefono riconosce il proprio salvataggio');

            const desk = await desktop.newPage();
            await desk.addInitScript(() => { window.__primoUltimo = null; new MutationObserver(() => { const e = document.getElementById('cloudUltimo'); if (e && e.textContent && !window.__primoUltimo) window.__primoUltimo = e.textContent; }).observe(document, { childList: true, subtree: true, characterData: true }); });
            await desk.goto(INDEX);
            await aspettaMenu(desk);
            const locale = await desk.evaluate(() => JSON.stringify(SaveManager.load()));
            assert(!/ultimoDispositivo/.test(locale), 'il segno non entra nel salvataggio di gioco locale');

            // La riga nel Profilo: il PRIMO testo mostrato, prima che la pagina riallinei il salvataggio.
            await desk.waitForFunction(() => !!window.__primoUltimo, null, { timeout: 20000 });
            const testo = await desk.evaluate(() => window.__primoUltimo);
            assert(testo && /altro dispositivo/.test(testo) && /Android/.test(testo), 'il Profilo lo dice: ' + testo);
        } finally {
            await desktop.close();
            await telefono.close();
        }
    }
};
