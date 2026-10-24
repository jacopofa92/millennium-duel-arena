// Due dispositivi, stesso account: un dispositivo rimasto INDIETRO non deve
// mai sovrascrivere i progressi fatti sull'altro.
//
// Il difetto (segnalato dall'utente: "se entro con lo stesso account su un
// altro dispositivo, sul primo rimane dentro... c'è rischio di
// sovrascrittura"): il controllo "non sovrascrivo un cloud più recente"
// confrontava le date di MODIFICA, ma ogni azione locale aggiorna quella
// data prima del caricamento. Un dispositivo vecchio, alla prima azione,
// risultava "più recente" e cancellava le ore giocate sull'altro.
//
// Ora ogni dispositivo ricorda da quale versione del cloud è partito
// (js/cloud/cloud-sync.js, "Base di sincronizzazione") e il caricamento è
// atomico. Qui si provano, con due dispositivi veri e UN cloud condiviso
// (tests/helpers/finto-cloud.js):
//   1) il dispositivo rimasto indietro NON sovrascrive, si riallinea, e le sue
//      modifiche restano in una copia di sicurezza;
//   2) senza modifiche proprie, un dispositivo rimasto indietro si aggiorna
//      senza copie né allarmi;
//   3) una scrittura altrui che cade fra la lettura e la scrittura (la
//      finestra che il confronto atomico chiude) viene rifiutata;
//   4) una scrittura propria di cui si è perso l'esito NON è scambiata per
//      una altrui.
//
// Il segno dei progressi sono i CREDITI, letti dal salvataggio grezzo (un
// amministratore ne vede sempre 999999, e una carta si ferma a 3 copie:
// non basterebbe per contare più modifiche).
const path = require('path');
const { creaFintoCloud } = require('../helpers/finto-cloud.js');

const RADICE = path.join(__dirname, '..', '..');
const INDEX = 'file:///' + path.join(RADICE, 'index.html').replace(/\\/g, '/');

module.exports = {
    name: 'Sync: un dispositivo rimasto indietro non sovrascrive i progressi dell\'altro',
    standalone: true,
    async run({ browser, assert }) {
        const { cloud, collega } = creaFintoCloud();
        const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
        const telefono = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
        await collega(desktop);
        await collega(telefono);
        const crediti = (page) => page.evaluate(() => { const s = SaveManager.load(); return s && s.currency ? (s.currency.credits || 0) : null; });
        const creditiNelCloud = () => {
            const riga = cloud.saves['utente-prova'];
            return riga && riga.data.currency ? (riga.data.currency.credits || 0) : null;
        };
        const aspettaMenu = (page) => page.waitForFunction(() => {
            const m = document.getElementById('menuShell');
            return m && getComputedStyle(m).display !== 'none';
        }, null, { timeout: 20000 });
        /** Aspetta, anche attraverso un ricaricamento della pagina, che il salvataggio locale abbia quei crediti. */
        const aspettaCrediti = async (page, n) => {
            const scadenza = Date.now() + 25000;
            while (Date.now() < scadenza) {
                try { if (await crediti(page) === n) return true; } catch (e) { /* pagina che si ricarica */ }
                await page.waitForTimeout(300);
            }
            return false;
        };
        /** La pagina ha finito un eventuale ricaricamento ed è pronta a fare una mossa. */
        const pronta = async (page) => {
            const scadenza = Date.now() + 20000;
            while (Date.now() < scadenza) {
                try { if (await page.evaluate(() => !!(window.SaveManager && window.CloudSync && window.AutoSync))) return; } catch (e) { /* ricarica */ }
                await page.waitForTimeout(250);
            }
        };
        try {
            // --- Il telefono parte e carica ------------------------------------
            const tel = await telefono.newPage();
            await tel.goto(INDEX);
            await tel.waitForFunction(() => !!(window.SaveManager && window.CloudSync));
            await tel.evaluate(() => { SaveManager.createNew('Admin'); SaveManager.addCurrency('credits', 1000); });
            const V1 = await crediti(tel);
            await tel.evaluate(() => AutoSync.caricaOra());
            assert(creditiNelCloud() === V1, 'il telefono carica il suo salvataggio: ' + creditiNelCloud());
            const baseTel = await tel.evaluate(() => JSON.parse(localStorage.getItem('ygoCloudBase')));
            assert(baseTel && baseTel.updatedAt, 'dopo il caricamento il telefono ricorda da quale versione del cloud è partito: ' + JSON.stringify(baseTel));

            // --- Il desktop si allinea e gioca tanto ---------------------------
            const desk = await desktop.newPage();
            await desk.goto(INDEX);
            await aspettaMenu(desk);
            assert(await crediti(desk) === V1, 'il desktop prende il salvataggio del cloud');
            assert(await desk.evaluate(() => !!localStorage.getItem('ygoCloudBase')), 'e ne ricorda la versione');
            await desk.evaluate(() => { SaveManager.addCurrency('credits', 2000); });
            const V2 = V1 + 2000;
            await desk.evaluate(() => AutoSync.caricaOra());
            assert(creditiNelCloud() === V2, 'le ore di gioco del desktop sul cloud: ' + creditiNelCloud());

            // --- 1) Il telefono, rimasto indietro, fa UNA azione e prova a caricare ---
            // Con la vecchia regola per data questa azione lo rendeva "più
            // recente" e cancellava i progressi del desktop con i suoi.
            await tel.evaluate(() => { SaveManager.addCurrency('credits', 10); });
            assert(await crediti(tel) === V1 + 10, 'il telefono ha la sua modifica locale');
            await tel.evaluate(() => AutoSync.caricaOra());
            await tel.waitForTimeout(1500);
            assert(creditiNelCloud() === V2, 'NIENTE sovrascrittura: il cloud resta com\'era: ' + creditiNelCloud());
            assert(await aspettaCrediti(tel, V2), 'il telefono si riallinea al cloud: ' + await crediti(tel).catch(() => '?'));
            await pronta(tel);
            const copia = await tel.evaluate(() => { const c = CloudSync.copiaDivergente(); return c && c.data && c.data.currency ? c.data.currency.credits : null; });
            assert(copia === V1 + 10, 'le modifiche del telefono restano in una copia di sicurezza: ' + copia);

            // --- 2) Rimasto indietro SENZA modifiche: si aggiorna, nessuna copia -----
            await tel.evaluate(() => { localStorage.removeItem('ygoSalvataggioDivergente'); localStorage.removeItem('ygoSalvataggiDivergenti'); });
            await desk.evaluate(() => { SaveManager.addCurrency('credits', 500); });
            const V3 = V2 + 500;
            await desk.evaluate(() => AutoSync.caricaOra());
            assert(creditiNelCloud() === V3, 'il desktop gioca ancora: ' + creditiNelCloud());
            await tel.evaluate(() => {
                sessionStorage.setItem('ygoUltimaRiconciliazione', String(Date.now() - 10 * 60 * 1000));
                document.dispatchEvent(new Event('visibilitychange'));
            });
            assert(await aspettaCrediti(tel, V3), 'il telefono, senza modifiche proprie, si aggiorna da solo');
            await pronta(tel);
            const nessunaCopia = await tel.evaluate(() => CloudSync.copiaDivergente());
            assert(!nessunaCopia, 'e senza conservare nessuna copia: non c\'era niente di suo da salvare');

            // --- 3) Una scrittura altrui FRA la lettura e la scrittura ---------
            await tel.evaluate(() => { SaveManager.addCurrency('credits', 7); });   // modifica legittima: la base è quella giusta
            const V4 = V3 + 9000;
            // Un altro dispositivo scrive proprio ora (dopo che il telefono ha
            // letto il cloud, prima che scriva).
            cloud.primaDelloUpdate = () => {
                const riga = cloud.saves['utente-prova'];
                const dati = JSON.parse(JSON.stringify(riga.data));
                dati.currency.credits = dati.currency.credits + 9000;
                cloud.saves['utente-prova'] = { data: dati, updated_at: new Date(Date.now() + 5000).toISOString() };
            };
            await tel.evaluate(() => AutoSync.caricaOra());
            await tel.waitForTimeout(1500);
            assert(creditiNelCloud() === V4, 'la scrittura arrivata nel frattempo NON è stata sovrascritta (atomicità): ' + creditiNelCloud());
            assert(await aspettaCrediti(tel, V4), 'e il telefono si allinea a quella');
            await pronta(tel);

            // --- 4) Un esito perso non si scambia per una scrittura altrui --------
            await tel.evaluate(() => { SaveManager.addCurrency('credits', 3); });
            await tel.evaluate(() => AutoSync.caricaOra());
            assert(creditiNelCloud() === V4 + 3, 'una modifica normale arriva sul cloud: ' + creditiNelCloud());
            // Si finge che la risposta dell'ultimo caricamento sia andata persa:
            // la base è rimasta a una versione più vecchia, ma `inVolo` porta
            // quella che sul cloud c'è davvero.
            await tel.evaluate(() => {
                const b = JSON.parse(localStorage.getItem('ygoCloudBase'));
                b.inVolo = b.updatedAt; b.updatedAt = '2020-01-01T00:00:00.000Z';
                localStorage.setItem('ygoCloudBase', JSON.stringify(b));
            });
            await tel.evaluate(() => { SaveManager.addCurrency('credits', 3); });
            await tel.evaluate(() => AutoSync.caricaOra());
            await tel.waitForTimeout(800);
            assert(creditiNelCloud() === V4 + 6, 'una scrittura propria di cui si è perso l\'esito non blocca il caricamento: ' + creditiNelCloud());
        } finally {
            await desktop.close();
            await telefono.close();
        }
    }
};
