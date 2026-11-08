// Battle City, "citta' viva" (1.5.132): solo presentazione, nessuna regola toccata.
// La pedina VERA del giocatore al posto della puntina, strade curve con le orme del cammino, la pedina che CAMMINA fra le caselle,
// la luce del distretto (giorno/tramonto/notte secondo le Carte Locazione), le Locazioni che volano al contatore e la posa "grido"
// dello sfidante quando ci si va incontro (non quella di danno subito).
const path = require('path');
const fs = require('fs');

module.exports = {
    standalone: true,
    name: 'Battle City: citta\' viva (pedina che cammina, strade curve e orme, luce, Locazioni che volano, posa grido)',
    async run(t) {
        const RADICE = path.join(__dirname, '..', '..');
        const url = 'file:///' + path.join(RADICE, 'torneo-battle-city.html').replace(/\\/g, '/');
        const page = await t.browser.newPage({ viewport: { width: 1280, height: 900 } });
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        try {
            await page.goto(url);
            await page.waitForFunction(() => !!(window.SaveManager && window.BoardPieces), null, { timeout: 25000 });
            const prepara = (extra) => page.evaluate((extra) => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                const s = makeInitialState('Medio');
                buildSector(s);
                s.grid.cells.forEach((c) => { c.revealed = true; });
                s.grid.cells[6] = { kind: 'empty', revealed: true, resolved: false };
                s.intermezziVisti = ['prologue', 'city', 'intro'];
                s.locators = extra && extra.locators != null ? extra.locators : 1;
                if (extra && extra.cella6) s.grid.cells[6] = Object.assign({ revealed: true, resolved: false }, extra.cella6 === 'duelist' ? { kind: 'duelist', characterId: PRELIM_IDS[0] } : { kind: extra.cella6 });
                saveState(s);
            }, extra);

            // --- pedina, strade curve ---
            await prepara();
            await page.reload();
            await page.waitForSelector('.city-cell', { timeout: 15000 });
            await page.waitForFunction(() => document.querySelectorAll('.city-routes .route').length > 0, null, { timeout: 5000 });
            const base = await page.evaluate(() => ({
                pedina: (document.querySelector('.city-player-token .cp-pedina') || {}).src || '',
                curve: Array.from(document.querySelectorAll('.city-routes .route-line')).every((p) => /Q/.test(p.getAttribute('d')) && !/ L/.test(p.getAttribute('d'))),
                n: document.querySelectorAll('.city-routes .route').length,
                ora: document.body.dataset.ora, luce: !!document.getElementById('cityLuce')
            }));
            t.assert(/pedine\/mirror\.png/.test(base.pedina), `il segnalino e' la pedina del giocatore: ${base.pedina}`);
            t.assert(base.n === 5 && base.curve, `le strade sono curve (Bezier), una per casella raggiungibile: ${JSON.stringify(base)}`);
            t.assert(base.ora === 'giorno' && base.luce, `con poche Locazioni e' giorno e il velo di luce esiste: ${base.ora}`);

            // --- la pedina cammina, poi arriva esatta; restano le orme ---
            await page.click('.city-cell[data-index="6"]');
            await page.waitForFunction(() => document.getElementById('cityGrid').dataset.player === '6', null, { timeout: 5000 });
            const cammina = await page.evaluate(() => new Promise((ok) => {
                const fine = Date.now() + 500;
                const g = () => { if (document.querySelector('.city-player-token.cammina')) return ok(true); if (Date.now() > fine) return ok(false); requestAnimationFrame(g); };
                g();
            }));
            t.assert(cammina, 'durante lo spostamento la pedina cammina (classe .cammina)');
            await page.waitForTimeout(800);
            const dopo = await page.evaluate(() => {
                const g = document.getElementById('cityGrid');
                const tok = document.querySelector('.city-player-token').getBoundingClientRect();
                const c = document.querySelector(`.city-cell[data-index="${g.dataset.player}"]`).getBoundingClientRect();
                return {
                    centrato: Math.abs((tok.left + tok.width / 2) - (c.left + c.width / 2)) < 3,
                    ancoraCammina: !!document.querySelector('.city-player-token.cammina'),
                    percorso: g.dataset.percorso, orme: document.querySelectorAll('.city-orme ellipse').length
                };
            });
            t.assert(dopo.centrato && !dopo.ancoraCammina, `a fine camminata la pedina sta esatta sulla casella: ${JSON.stringify(dopo)}`);
            t.assert(/,6$/.test(dopo.percorso) && dopo.orme > 0, `il cammino lascia le orme: ${JSON.stringify(dopo)}`);

            // --- la luce segue il tempo che passa (cityTime) ---
            const luce = await page.evaluate(() => {
                const r = {};
                for (const l of [0, 42, 84, 90]) { const s = loadState(); s.cityTime = l; saveState(s); render(); r[l] = document.body.dataset.ora; }
                return r;
            });
            t.assert(luce[0] === 'giorno' && luce[42] === 'tramonto' && luce[84] === 'notte' && luce[90] === 'notte', `giorno, tramonto, notte: ${JSON.stringify(luce)}`);

            // --- una Locazione raccolta vola al contatore ---
            await prepara({ locators: 1, cella6: 'locator' });
            await page.reload();
            await page.waitForSelector('.city-cell.reachable[data-index="6"]', { timeout: 15000 });
            await page.click('.city-cell[data-index="6"]');
            await page.waitForSelector('.city-locazione-volo', { timeout: 3000 });
            t.assert(true, 'la Carta Locazione guadagnata vola al contatore');

            // --- verso uno sfidante: posa grido, poi la puntata ---
            await prepara({ locators: 2, cella6: 'duelist' });
            await page.reload();
            await page.waitForSelector('.city-cell.reachable[data-index="6"]', { timeout: 15000 });
            await page.click('.city-cell[data-index="6"]');
            await page.waitForFunction(() => document.getElementById('wagerModal').classList.contains('open'), null, { timeout: 4000 });
            const grido = await page.evaluate(() => ({
                modale: (document.querySelector('#wagerPortrait img') || {}).src || '',
                casella: (document.querySelector('.city-cell[data-index="6"] image') || { getAttribute: () => '' }).getAttribute('href') || '',
                inSospeso: /Duello in sospeso/.test(document.getElementById('content').textContent)
            }));
            t.assert(/pedine-esclamazione\/thumbs\//.test(grido.modale), `nella puntata lo sfidante fa la posa grido: ${grido.modale}`);
            t.assert(!/pedine-danno-sorpresa/.test(grido.modale + grido.casella), 'mai la posa di danno subito');
            t.assert(!grido.inSospeso, 'dietro la puntata c\'e\' la mappa, non la schermata "duello in sospeso"');
            t.assert(fs.readdirSync(path.join(RADICE, 'images', 'characters', 'pedine-esclamazione', 'thumbs')).length >= 60, 'miniature grido presenti');

            t.assert(errori.length === 0, `nessun errore JS: ${errori.join(' | ')}`);
        } finally {
            await page.close();
        }
    }
};
