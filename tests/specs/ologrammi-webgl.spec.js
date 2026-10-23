// Gli ologrammi dei mostri in WebGL (js/ui/monster-hologram-webgl.js).
//  - su un server (http) le texture sono ammesse: gli ologrammi stanno in UN canvas dentro #monsterHologramLayer
//    e quelli CSS (.mh-item) non esistono; un mostro coperto non ne ha, uno che sparisce lo toglie;
//  - su file:// il browser non lascia usare un'immagine come texture: il WebGL non si prova nemmeno e
//    MonsterHolograms disegna subito con il CSS di sempre (un guasto a gioco avviato — contesto perso — fa lo stesso);
//  - `window.OLOGRAMMA_WEBGL_OFF` forza il CSS.
//
// `standalone`: serve una pagina aperta in modi diversi (http e file://).
const path = require('path');
const { startStaticServer } = require('../helpers/local-servers');

const RADICE = path.join(__dirname, '..', '..');

async function apriDuello(browser, url, init) {
    const context = await browser.newContext({ viewport: { width: 900, height: 800 }, serviceWorkers: 'block' });
    await context.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true; });
    if (init) await context.addInitScript(init);
    const page = await context.newPage();
    const errori = [];
    page.on('pageerror', (e) => errori.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.playerHand && gameState.playerHand.length > 0 && window.MonsterHolograms && window.MonsterHologramGL, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    return { context, page, errori };
}

async function mettiMostri(page, coperto) {
    await page.evaluate((coperto) => {
        const mk = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
        gameState.currentPlayer = 'player';
        gameState.playerMonsterField = [null, { card: mk(1, 'w1'), position: 'attack', isFaceDown: false }, { card: mk(7, 'w2'), position: 'attack', isFaceDown: !!coperto }, null, null];
        gameState.botMonsterField = [null, { card: mk(4, 'w3'), position: 'attack', isFaceDown: false }, null, null, null];
        updateUI();
    }, !!coperto);
}

module.exports = {
    name: 'Ologrammi WebGL: un canvas su http, ripiego sul CSS su file:// e con l\'interruttore',
    standalone: true,
    async run({ browser, assert }) {
        const server = await startStaticServer();
        try {
            // --- http: WebGL
            {
                const { context, page, errori } = await apriDuello(browser, server.origin + '/duelMonstersCore.html');
                await mettiMostri(page, true);   // il secondo è COPERTO: niente ologramma
                await page.waitForFunction(() => MonsterHologramGL.attivi() === 2, null, { timeout: 10000 });
                let s = await page.evaluate(() => ({
                    gl: MonsterHologramGL.attivi(), dom: document.querySelectorAll('.mh-item').length,
                    canvas: !!document.querySelector('#monsterHologramLayer > canvas'), guasto: MonsterHologramGL.guasto()
                }));
                assert(s.gl === 2 && s.dom === 0 && s.canvas && !s.guasto, `Con WebGL: 2 ologrammi nel canvas (il coperto no), nessuno in CSS: ${JSON.stringify(s)}`);

                // Scoperto: ora sono 3. Poi un mostro sparisce dal Terreno: tornano 2.
                await mettiMostri(page, false);
                await page.waitForFunction(() => MonsterHologramGL.attivi() === 3, null, { timeout: 10000 });
                await page.evaluate(() => { gameState.botMonsterField[1] = null; updateUI(); });
                await page.waitForFunction(() => MonsterHologramGL.attivi() === 2, null, { timeout: 10000 });
                // La proiezione di un mostro che parte all'attacco si spegne un attimo senza errori.
                await page.evaluate(() => MonsterHolograms.nascondiPer('w1', 200));
                await page.waitForTimeout(300);
                assert(errori.length === 0, `Errori di pagina con WebGL: ${errori.join(' | ')}`);
                await context.close();
            }

            // --- file://: la texture viene rifiutata, si torna al CSS
            {
                const { context, page, errori } = await apriDuello(browser, 'file:///' + RADICE.replace(/\\/g, '/') + '/duelMonstersCore.html');
                await mettiMostri(page, false);
                // Su file:// il WebGL non si prova nemmeno (le texture sarebbero rifiutate): CSS subito, senza attesa.
                await page.waitForFunction(() => document.querySelectorAll('.mh-item').length === 3, null, { timeout: 10000 });
                const s = await page.evaluate(() => ({ dom: document.querySelectorAll('.mh-item').length, canvas: !!document.querySelector('#monsterHologramLayer > canvas') }));
                assert(s.dom === 3 && !s.canvas, `Su file:// si ricade sul CSS: ${JSON.stringify(s)}`);
                assert(errori.length === 0, `Errori di pagina nel ripiego: ${errori.join(' | ')}`);
                await context.close();
            }

            // --- interruttore: OLOGRAMMA_WEBGL_OFF forza il CSS anche dove il WebGL funzionerebbe
            {
                const { context, page } = await apriDuello(browser, server.origin + '/duelMonstersCore.html', () => { window.OLOGRAMMA_WEBGL_OFF = true; });
                await mettiMostri(page, false);
                await page.waitForFunction(() => document.querySelectorAll('.mh-item').length === 3, null, { timeout: 10000 });
                const s = await page.evaluate(() => ({ gl: MonsterHologramGL.attivi(), canvas: !!document.querySelector('#monsterHologramLayer > canvas') }));
                assert(s.gl === 0 && !s.canvas, `Con l'interruttore acceso il WebGL non parte: ${JSON.stringify(s)}`);
                await context.close();
            }
        } finally {
            await server.close();
        }
    }
};
