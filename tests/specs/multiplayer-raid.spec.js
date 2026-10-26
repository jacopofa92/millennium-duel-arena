// Multiplayer: RAID COOPERATIVO (regola della stanza, js/multiplayer/mp-lobby.js + mp-raid.js).
// Ognuno duella da solo contro lo stesso Boss; il danno dell'uno scala la barra dell'altro e viceversa.
// `standalone: true`: due pagine e un relay vero.
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

const BOSS = 'kaiba';

module.exports = {
    name: 'Multiplayer: raid cooperativo, la barra del Boss e\' una sola',
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
                await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_RPS_SKIP = true; window.DUEL_FAST_OPENING = true; });
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

            // L'ospite non puo' toccare la regola; l'host la accende.
            const bloccato = await ospite.evaluate(() => document.getElementById('mpRaidOn').disabled);
            assert(bloccato, 'L\'ospite vede il raid in sola lettura');
            await host.check('#mpRaidOn');
            await host.selectOption('#mpRaidBoss', BOSS);
            await ospite.waitForFunction((id) => document.getElementById('mpRaidOn').checked && document.getElementById('mpRaidBoss').value === id, BOSS, { timeout: 10000 });

            await host.click('#mpReadyBtn');
            await ospite.click('#mpReadyBtn');

            const pronto = (page) => page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.botLP > 0 && !!document.getElementById('mpRaidBar') && window.MP_RAID === true, null, { timeout: 90000 });
            await Promise.all([pronto(host), pronto(ospite)]);
            const lp = (page) => page.evaluate(() => gameState.botLP);
            // Dopo il primo giro del controllo la barra comune e' piena su entrambi.
            await host.waitForFunction(() => gameState.botLP === 16000, null, { timeout: 10000 });
            await ospite.waitForFunction(() => gameState.botLP === 16000, null, { timeout: 10000 });

            // L'host colpisce il Boss per 3000: la barra dell'ospite scende uguale.
            await host.evaluate(() => { gameState.botLP -= 3000; });
            await ospite.waitForFunction(() => gameState.botLP === 13000, null, { timeout: 10000 });
            // L'ospite colpisce per 2000: scende anche quella dell'host, e nessuno dei due ricontano i colpi dell'altro.
            await ospite.evaluate(() => { gameState.botLP -= 2000; });
            await host.waitForFunction(() => gameState.botLP === 11000, null, { timeout: 10000 });
            await new Promise((r) => setTimeout(r, 1500));
            assert((await lp(host)) === 11000 && (await lp(ospite)) === 11000, `Barra comune uguale: ${await lp(host)} / ${await lp(ospite)}`);
            // Un compagno scorretto (totale enorme, negativo, non intero) non azzera ne' cura il Boss oltre la barra.
            await ospite.evaluate(() => { MpRaid.ricevi({ kind: 'raid', tipo: 'colpo', inflitti: -5000 }); MpRaid.ricevi({ kind: 'raid', tipo: 'colpo', inflitti: 1.5 }); });
            const dopoNegativo = await ospite.evaluate(() => gameState.botLP);
            assert(dopoNegativo <= 16000 && dopoNegativo >= 0, `Totale negativo ignorato oltre la barra: ${dopoNegativo}`);
            await ospite.evaluate(() => MpRaid.ricevi({ kind: 'raid', tipo: 'colpo', inflitti: 99999999 }));
            const dopoEnorme = await ospite.evaluate(() => gameState.botLP);
            assert(dopoEnorme >= 0 && dopoEnorme <= 16000, `Totale enorme contenuto nella barra: ${dopoEnorme}`);
            assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);        } finally {
            await context.close();
            await room.close();
            await statics.close();
        }
    }
};
