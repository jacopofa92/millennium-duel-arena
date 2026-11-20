// Primo accesso su un dispositivo "pulito" (dati dell'app cancellati): la registrazione del dispositivo attivo NON deve essere
// interrotta dal ricaricamento della pagina.
//
// Segnalato dall'utente su APK: cancella cache e dati, apre l'app, accede, fa una modifica che carica/salva il profilo e
// viene buttato fuori con "accesso da un altro dispositivo", anche se non c'e' nessun altro dispositivo. I log di Supabase
// (2026-11-20) mostrano login e logout dallo STESSO telefono a un minuto di distanza, e fra il login e il logout la richiesta
// `claim_active_device_session` parte (OPTIONS) ma non arriva mai (niente POST).
//
// Causa: dopo "cancella dati" la cache dei permessi di contenuto e' vuota. Al login fetchProfile -> rememberContents vede una
// differenza (per un amministratore e' sempre cosi') e lancia `contenuti:aggiornati`, che RICARICA la pagina
// (content-access.js). Il ricaricamento taglia la richiesta di registrazione ancora in volo: il server non sa quale e' il
// dispositivo attivo, al controllo successivo la sessione risulta "sostituita" e l'app fa il logout globale.
//
// Il cloud finto ha una latenza sulle chiamate a funzione (ritardoRpc) interrotta da un ricaricamento, come una richiesta vera.
const path = require('path');
const { creaFintoCloud } = require('../helpers/finto-cloud');
const url = (file) => 'file:///' + path.join(__dirname, '../..', file).replace(/\\/g, '/');

module.exports = {
    name: 'Accesso su dispositivo pulito: la registrazione del dispositivo attivo finisce prima del ricaricamento dei contenuti',
    standalone: true,
    async run({ browser, assert }) {
        const { cloud, collega } = creaFintoCloud();
        // Contenuti abilitati dall'account: con la cache vuota e' una differenza, quindi un ricaricamento.
        cloud.profili = [{ id: 'utente-prova', email: 'admin@prova.it', status: 'approved', is_admin: false, content_ww1: true, content_ww2: false, content_extra: false }];
        const context = await browser.newContext({ viewport: { width: 412, height: 900 }, serviceWorkers: 'block' });
        await collega(context, { ritardoRpc: 400 });
        const page = await context.newPage();
        try {
            await page.goto(url('index.html'));
            await page.waitForFunction(() => window.CloudSync && CloudSync.available, null, { timeout: 30000 });
            // Il primo caricamento puo' ricaricarsi da solo (la cache dei permessi nasce ora): si aspetta che la pagina si fermi.
            await page.waitForTimeout(2500);
            await page.waitForFunction(() => window.CloudSync && CloudSync.available, null, { timeout: 30000 });
            // Dispositivo "pulito": nessun ricordo dei permessi di questo account.
            await page.evaluate(() => { Object.keys(localStorage).filter((k) => k.indexOf('ygoContentAccess') === 0).forEach((k) => localStorage.removeItem(k)); });
            const prima = cloud.richieste.filter((r) => r === 'rpc:claim_active_device_session').length;
            await page.evaluate(() => { window.__segnoPagina = 'stessa'; });

            // L'accesso vero. Il ricaricamento dei contenuti puo' distruggere il contesto della pagina: e' proprio il caso.
            await page.evaluate(() => { CloudSync.signIn('admin@prova.it', 'x').catch(() => {}); });

            let registrata = false;
            for (let i = 0; i < 60 && !registrata; i++) {
                await page.waitForTimeout(100);
                registrata = cloud.richieste.filter((r) => r === 'rpc:claim_active_device_session').length > prima;
            }
            assert(registrata, 'Il dispositivo attivo deve essere registrato (claim_active_device_session) anche se i contenuti cambiano al login');

            // Registrato il dispositivo, la pagina NON si ricarica ancora: chi ha chiamato signIn sta caricando il salvataggio
            // (index.html: afterGateSignIn) e un ricaricamento a meta' lo interromperebbe. Il segno sta nella pagina: se si
            // ricarica sparisce.
            await page.waitForTimeout(1500);
            assert(await page.evaluate(() => window.__segnoPagina === 'stessa'), 'Dopo la registrazione la pagina non deve ricaricarsi finche\' l\'accesso non e\' concluso');

            // Concluso l'accesso, il cambio di contenuti c'e' comunque: la pagina si ricarica col catalogo giusto.
            await page.evaluate(() => CloudSync.concludiAccesso());
            let ricaricata = false;
            for (let i = 0; i < 50 && !ricaricata; i++) {
                await page.waitForTimeout(100);
                ricaricata = await page.evaluate(() => window.__segnoPagina !== 'stessa').catch(() => true);
            }
            assert(ricaricata, 'A accesso concluso il cambio di contenuti deve ricaricare la pagina');
        } finally {
            await context.close();
        }
    }
};
