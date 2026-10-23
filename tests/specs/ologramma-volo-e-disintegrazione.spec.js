// Con gli ologrammi WebGL e' la FIGURA a muoversi (js/ui/monster-hologram-webgl.js):
//  - attacco: l'ologramma parte e torna (volo con arco e scia), la carta NON riceve `is-attacking`;
//  - distruzione: il soggetto si disintegra e sopravvive al mostro uscito dal Terreno finche' non ha finito,
//    senza la copia mascherata della carta.
// Senza ologramma WebGL (qui: l'interruttore) restano la rincorsa della carta e la copia di sempre.
//
// `standalone`: serve un server http (le texture su file:// sono rifiutate).
const path = require('path');
const { startStaticServer } = require('../helpers/local-servers');

async function apriDuello(browser, url, init) {
    const context = await browser.newContext({ viewport: { width: 900, height: 800 }, serviceWorkers: 'block' });
    await context.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true; });
    if (init) await context.addInitScript(init);
    const page = await context.newPage();
    const errori = [];
    page.on('pageerror', (e) => errori.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.playerHand && gameState.playerHand.length > 0 && window.MonsterHolograms && window.MonsterHologramGL && window.FX, null, { timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
        const mk = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
        gameState.currentPlayer = 'player';
        gameState.playerMonsterField = [null, { card: mk(1, 'v1'), position: 'attack', isFaceDown: false }, null, null, null];
        gameState.botMonsterField = [null, { card: mk(4, 'v2'), position: 'attack', isFaceDown: false }, null, null, null];
        updateUI();
    });
    return { context, page, errori };
}

module.exports = {
    name: 'Ologramma WebGL: vola in attacco (la carta resta ferma) e si disintegra in distruzione',
    standalone: true,
    async run({ browser, assert }) {
        const server = await startStaticServer();
        try {
            const url = server.origin + '/duelMonstersCore.html';
            {
                const { context, page, errori } = await apriDuello(browser, url);
                await page.waitForFunction(() => MonsterHologramGL.attivi() === 2, null, { timeout: 10000 });
                const att = await page.evaluate(async () => {
                    const el = document.querySelector('#playerFieldBoard .card[data-uid="v1"]');
                    const bers = document.querySelector('#botFieldBoard .card[data-uid="v2"]');
                    showBattleEffect(el, bers, null);
                    await new Promise((s) => setTimeout(s, 150));
                    return { carta: el.classList.contains('is-attacking'), ologramma: MonsterHologramGL.visibile('v1') };
                });
                assert(!att.carta && att.ologramma, `Attacco: vola la figura, la carta non si muove: ${JSON.stringify(att)}`);

                const dis = await page.evaluate(async () => {
                    const el = document.querySelector('#botFieldBoard .card[data-uid="v2"]');
                    window.FX_BACKEND = 'webgl';
                    FX.playBattleDestroyEffect(el);
                    gameState.botMonsterField[1] = null; updateUI();
                    await new Promise((s) => setTimeout(s, 300));
                    const durante = { vivo: MonsterHologramGL.attivi(), copie: [...document.querySelectorAll('body > div')].filter((d) => d.style.maskImage || d.style.webkitMaskImage).length };
                    await new Promise((s) => setTimeout(s, 1400));
                    return { durante, dopo: MonsterHologramGL.attivi() };
                });
                assert(dis.durante.vivo === 2 && dis.durante.copie === 0, `Distruzione: la figura resta finche' si disintegra, nessuna copia della carta: ${JSON.stringify(dis)}`);
                assert(dis.dopo === 1, `Distruzione: a fine effetto la figura sparisce: ${JSON.stringify(dis)}`);
                assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
                await context.close();
            }
            {
                const { context, page } = await apriDuello(browser, url, () => { window.OLOGRAMMA_WEBGL_OFF = true; });
                await page.waitForFunction(() => document.querySelectorAll('.mh-item').length === 2, null, { timeout: 10000 });
                const att = await page.evaluate(() => {
                    const el = document.querySelector('#playerFieldBoard .card[data-uid="v1"]');
                    showBattleEffect(el, document.querySelector('#botFieldBoard .card[data-uid="v2"]'), null);
                    return el.classList.contains('is-attacking');
                });
                assert(att, 'Senza ologramma WebGL la carta si lancia come sempre');
                await context.close();
            }
        } finally {
            await server.close();
        }
    }
};
