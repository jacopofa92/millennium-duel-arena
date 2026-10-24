// Pannello Admin: "ultimo accesso online" dei giocatori.
//
// Il gioco dice al server che l'account e' qui (`segna_visto()`, che scrive `profiles.last_seen_at` con l'ora del
// SERVER) all'apertura di ogni pagina e ogni 5 minuti in primo piano, al massimo una volta ogni 5 minuti per
// dispositivo. Il pannello Admin mostra per ogni account quanto tempo fa, con "Online ora" entro 10 minuti, e mette
// per primo chi e' stato visto per ultimo.
//
// Cloud finto in memoria (tests/helpers/finto-cloud.js): le chiamate a funzione finiscono in `cloud.richieste`.
const path = require('path');
const { creaFintoCloud } = require('../helpers/finto-cloud.js');

const RADICE = path.join(__dirname, '..', '..');
const ADMIN = 'file:///' + path.join(RADICE, 'admin.html').replace(/\\/g, '/');

module.exports = {
    name: 'Admin: l\'ultimo accesso online dei giocatori e il segnale che lo alimenta',
    standalone: true,
    async run({ browser, assert }) {
        const { cloud, collega } = creaFintoCloud();
        const adesso = Date.now();
        const fa = (min) => new Date(adesso - min * 60000).toISOString();
        cloud.profili = [
            { id: 'mai', email: 'mai@prova.it', status: 'approved', is_admin: false, created_at: fa(9999), last_seen_at: null },
            { id: 'tre-giorni', email: 'tregiorni@prova.it', status: 'approved', is_admin: false, created_at: fa(9999), last_seen_at: fa(3 * 24 * 60) },
            { id: 'online', email: 'online@prova.it', status: 'approved', is_admin: false, created_at: fa(9999), last_seen_at: fa(2) },
            { id: 'ieri', email: 'ieri@prova.it', status: 'rejected', is_admin: false, created_at: fa(9999), last_seen_at: fa(30 * 60) },
            { id: 'attesa', email: 'attesa@prova.it', status: 'pending', is_admin: false, created_at: fa(9999), last_seen_at: fa(45) }
        ];
        const context = await browser.newContext({ viewport: { width: 412, height: 900 }, serviceWorkers: 'block' });
        await collega(context);
        const page = await context.newPage();
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        const segnali = () => cloud.richieste.filter((r) => r === 'rpc:segna_visto').length;
        try {
            await page.goto(ADMIN);
            await page.waitForFunction(() => document.querySelectorAll('#adminPendingList .admin-row, #adminUsersList .admin-row').length >= 5, null, { timeout: 30000 });

            // 1) Il segnale parte all'apertura della pagina, una volta sola.
            await page.waitForFunction(() => true);
            for (let i = 0; i < 40 && segnali() === 0; i++) await page.waitForTimeout(100);
            assert(segnali() === 1, `All'apertura il gioco deve segnare l'accesso UNA volta (segnali: ${segnali()})`);

            // 2) Le righe: testo giusto per ognuno.
            const righe = await page.evaluate(() => Array.from(document.querySelectorAll('#adminPendingList .admin-row, #adminUsersList .admin-row')).map((r) => ({
                email: r.querySelector('.admin-row-email').textContent,
                visto: r.querySelector('.admin-row-seen').textContent,
                online: r.querySelector('.admin-row-seen').classList.contains('is-online')
            })));
            const per = (e) => righe.find((r) => r.email === e);
            assert(per('online@prova.it').visto === '● Online ora' && per('online@prova.it').online, `Visto 2 minuti fa deve essere "Online ora": ${JSON.stringify(per('online@prova.it'))}`);
            assert(per('ieri@prova.it').visto === 'Ultimo accesso: ieri', `30 ore fa deve dire "ieri": ${per('ieri@prova.it').visto}`);
            assert(per('tregiorni@prova.it').visto === 'Ultimo accesso: 3 giorni fa', `3 giorni: ${per('tregiorni@prova.it').visto}`);
            assert(per('mai@prova.it').visto === 'Ultimo accesso: mai', `Mai visto: ${per('mai@prova.it').visto}`);
            assert(per('attesa@prova.it').visto === 'Ultimo accesso: 45 min fa', `Anche chi e' in attesa ha l'ultimo accesso: ${per('attesa@prova.it').visto}`);

            // 3) L'elenco degli altri account e' ordinato dal visto piu' di recente al mai visto.
            const ordine = await page.evaluate(() => Array.from(document.querySelectorAll('#adminUsersList .admin-row-email')).map((e) => e.textContent));
            const sotto = ordine.filter((e) => e !== 'attesa@prova.it');
            assert(sotto.join(',') === 'online@prova.it,ieri@prova.it,tregiorni@prova.it,mai@prova.it',
                `Ordine per ultimo accesso: ${sotto.join(',')}`);

            // 4) Riaprire subito la pagina NON richiama il server: il limite e' per dispositivo.
            await page.reload();
            await page.waitForFunction(() => document.querySelectorAll('#adminPendingList .admin-row, #adminUsersList .admin-row').length >= 5, null, { timeout: 30000 });
            await page.waitForTimeout(800);
            assert(segnali() === 1, `Entro 5 minuti non si segna di nuovo (segnali: ${segnali()})`);

            // 5) Passati 5 minuti (segno in localStorage invecchiato) si segna di nuovo.
            await page.evaluate(() => {
                const v = JSON.parse(localStorage.getItem('ygoUltimoVisto'));
                v.at = Date.now() - 6 * 60 * 1000;
                localStorage.setItem('ygoUltimoVisto', JSON.stringify(v));
            });
            await page.reload();
            for (let i = 0; i < 40 && segnali() < 2; i++) await page.waitForTimeout(100);
            assert(segnali() === 2, `Dopo 5 minuti si segna di nuovo (segnali: ${segnali()})`);
            assert(errori.length === 0, 'Errori di pagina: ' + errori.join(' | '));
        } finally {
            await context.close();
        }
    }
};
