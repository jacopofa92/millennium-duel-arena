// Multiplayer: l'arena che l'host sceglie DOPO l'ingresso dell'ospite deve arrivare al duello.
//
// Il difetto (segnalato dall'utente: "terreno e forse musica: anche se l'host seleziona, esce casuale"): l'host
// risolveva e trasmetteva le sue scelte UNA volta sola, a `room-ready`. Ma la stanza di solito si riempie subito e i
// selettori si toccano DOPO, mentre si aspetta: quelle scelte venivano ignorate e il duello partiva con il valore di
// default (casuale) fissato all'ingresso. Ora ogni cambio dell'host, a ospite presente, rimanda `room-config`.
//
// `standalone: true`: due pagine e un relay vero (vedi multiplayer-lobby-abbandono.spec.js).
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

module.exports = {
    name: 'Multiplayer: l\'arena scelta dall\'host dopo l\'ingresso dell\'ospite arriva al duello',
    standalone: true,
    async run({ browser, assert }) {
        const statics = await startStaticServer();
        const room = await startRoomServer();
        const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
        const errori = [];
        try {
            const apri = async (etichetta) => {
                const page = await context.newPage();
                page.on('pageerror', (e) => errori.push(`[${etichetta}] ${e.message}`));
                await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_RPS_SKIP = true; });
                await page.goto(statics.origin + '/multiplayer.html', { waitUntil: 'load' });
                await page.waitForSelector('#mpCreateBtn');
                await page.waitForFunction(() => { const el = document.getElementById('pageLoader'); return !el || el.classList.contains('page-loader-hidden'); }, { timeout: 15000 });
                await page.evaluate(() => { const a = document.querySelector('.mp-advanced'); if (a) a.open = true; });
                await page.fill('#mpServerUrl', room.wsUrl);
                return page;
            };
            const host = await apri('host');
            const ospite = await apri('ospite');

            await host.click('#mpCreateBtn');
            await host.waitForFunction(() => { const el = document.getElementById('mpRoomCodeValue'); return el && /^[A-Z0-9]{5}$/.test(el.textContent.trim()); }, { timeout: 15000 });
            const codice = (await host.textContent('#mpRoomCodeValue')).trim();
            await ospite.click('#mpTabJoin');
            await ospite.fill('#mpJoinCode', codice);
            await ospite.click('#mpJoinBtn');
            await host.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
            await ospite.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });

            // L'ospite e' GIA' in sala: ora l'host sceglie un'arena precisa (non la prima, non il casuale).
            const scelta = await host.evaluate(() => {
                const campi = Array.from(document.querySelectorAll('#mpSetupMount .ds-field:not(.ds-field--random)'));
                const el = campi[Math.min(5, campi.length - 1)];
                el.click();
                return el.dataset.file;
            });
            assert(!!scelta, 'l\'host ha scelto un\'arena');
            // L'ospite la vede evidenziata (la config e' arrivata)...
            await ospite.waitForFunction((file) => {
                const el = document.querySelector('#mpSetupMount .ds-field[data-file="' + file + '"]');
                return !!el && /selected|is-sel|active|on/.test(el.className);
            }, scelta, { timeout: 10000 }).catch(() => null);

            // ...e quando partono, il duello usa QUELLA arena su entrambi i lati.
            await host.click('#mpReadyBtn');
            await ospite.click('#mpReadyBtn');
            const arena = async (page) => page.waitForFunction(() => new URLSearchParams(location.search).get('field'), null, { timeout: 60000 })
                .then(() => page.evaluate(() => new URLSearchParams(location.search).get('field')));
            const [campoHost, campoOspite] = await Promise.all([arena(host), arena(ospite)]);
            assert(campoHost === scelta, `il duello dell'host usa l'arena scelta: ${campoHost} vs ${scelta}`);
            assert(campoOspite === scelta, `il duello dell'ospite usa l'arena scelta dall'host: ${campoOspite} vs ${scelta}`);
            assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
        } finally {
            await context.close();
            await room.close();
            await statics.close();
        }
    }
};
