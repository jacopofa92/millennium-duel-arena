// Multiplayer su rete lenta: l'arena si scarica mentre si aspetta, e in parallelo.
//
// Prima gli ~100 script dell'arena si scaricavano uno alla volta DOPO il conto alla rovescia (ognuno partiva a
// scaricarsi solo quando il precedente aveva finito di eseguire): con 300 ms di latenza erano decine di secondi
// di pagina mezza costruita. Ora, appena l'avversario entra in stanza, la sala chiede al browser di precaricare
// documento, script e fogli dell'arena (`precaricaArena`): quando si preme "pronto" sono gia' in cache.
//
// `standalone: true`: due pagine e un relay vero (vedi multiplayer-lobby-abbandono.spec.js).
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

module.exports = {
    name: 'Multiplayer: entrato l\'avversario, gli script dell\'arena vengono precaricati in parallelo',
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
            const conta = (page) => page.evaluate(() => document.querySelectorAll('head link[rel="preload"][as="script"]').length);

            assert((await conta(host)) === 0, 'Prima che l\'avversario entri non si precarica nulla');

            await host.click('#mpCreateBtn');
            await host.waitForFunction(() => { const el = document.getElementById('mpRoomCodeValue'); return el && /^[A-Z0-9]{5}$/.test(el.textContent.trim()); }, { timeout: 15000 });
            assert((await conta(host)) === 0, 'Da soli in stanza non si precarica nulla');
            const codice = (await host.textContent('#mpRoomCodeValue')).trim();
            await ospite.click('#mpTabJoin');
            await ospite.fill('#mpJoinCode', codice);
            await ospite.click('#mpJoinBtn');
            await host.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
            await ospite.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });

            // Il documento dell'arena si scarica e si legge in modo asincrono: si aspetta il fatto, non un tempo.
            for (const [nome, page] of [['host', host], ['ospite', ospite]]) {
                await page.waitForFunction(() => document.querySelectorAll('head link[rel="preload"][as="script"]').length >= 40, null, { timeout: 20000 });
                const href = await page.evaluate(() => Array.from(document.querySelectorAll('head link[rel="preload"][as="script"]')).map((l) => l.getAttribute('href')));
                assert(href.some((h) => /game-flow\.js$/.test(h)), `${nome}: il motore dell'arena non e' tra gli script precaricati`);
                assert(href.some((h) => /multiplayer\/multiplayer\.js$/.test(h)), `${nome}: multiplayer.js non e' tra gli script precaricati`);
                assert(new Set(href).size === href.length, `${nome}: uno script precaricato due volte`);
            }
            assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
        } finally {
            await context.close();
            await room.close();
            await statics.close();
        }
    }
};
