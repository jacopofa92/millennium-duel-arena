// Regno dei Duellanti, mappa "viva" (1.5.129): pedine al posto dei cerchi, sentieri curvi con le orme, partenza a sinistra sotto il fiume,
// falo' al centro in basso, luce del mondo e Castello nella barra delle Stelle. Solo presentazione: le regole non cambiano.
const path = require('path');

module.exports = {
    standalone: true,
    name: 'Regno dei Duellanti: mappa viva (pedine, sentieri curvi, partenza a sinistra, falo\' al centro, luce)',
    async run(t) {
        const radice = path.join(__dirname, '..', '..');
        const url = 'file:///' + path.join(radice, 'torneo-regno-duellanti.html').replace(/\\/g, '/');
        const page = await t.browser.newPage({ viewport: { width: 1280, height: 800 } });
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.PAGE_LOADER_SKIP = true; });
        try {
            await page.goto(url);
            await page.waitForFunction(() => !!window.SaveManager);
            const imposta = (stelle, history) => page.evaluate(([st, hist]) => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                SaveManager.setTournamentState('duelistKingdom', {
                    step: 3, stars: st, difficulty: 'Medio', castleReached: false, eliminated: false, atKaibaGate: false,
                    pendingEncounter: null, scenesShown: { prologue: true }, history: hist,
                    pendingRoutes: [
                        { kind: 'opponent', characterId: 'mai', x: 840, y: 230 },
                        { kind: 'deadEnd', depth: 2, x: 850, y: 360 },
                        { kind: 'prize', amount: 1, x: 840, y: 490 }
                    ]
                });
            }, [stelle, history]);
            await imposta(8, [{ kind: 'prize', label: '+1', x: 230, y: 330 }, { kind: 'win', label: 'v', x: 420, y: 260 }, { kind: 'prize', label: '+2', x: 610, y: 340 }]);
            await page.reload();
            await page.waitForSelector('.map-node.choice');

            const m = await page.evaluate(() => ({
                pedineGiocatore: document.querySelectorAll('.map-node.current .map-pedina-img').length,
                pedinaSfidante: !!document.querySelector('.map-node.choice.duel .map-pedina-img'),
                sagome: document.querySelectorAll('.map-node.choice.mystery .map-pedina-img').length,
                interrogativi: document.querySelectorAll('.map-node.choice.mystery .map-punto-int').length,
                curve: document.querySelectorAll('path.map-line.choice-line').length,
                rette: document.querySelectorAll('line.map-line').length,
                orme: document.querySelectorAll('.map-orme ellipse').length,
                ora: document.body.dataset.ora,
                luce: !!document.getElementById('mapLuce'),
                castello: document.getElementById('starsCastello').style.getPropertyValue('--p'),
                falo: (() => { const e = document.querySelector('.map-campfire'); return { x: parseFloat(e.style.left) + 41, y: parseFloat(e.style.top) + 36 }; })(),
                canvas: { w: parseFloat(document.getElementById('mapCanvas').style.width), h: parseFloat(document.getElementById('mapCanvas').style.height) }
            }));
            t.assert(m.pedineGiocatore === 1, `la pedina del giocatore sta sul punto "sei qui": ${JSON.stringify(m)}`);
            t.assert(m.pedinaSfidante && m.sagome === 2 && m.interrogativi === 2, `lo sfidante e' una pedina, gli ignoti sagome con il punto interrogativo: ${JSON.stringify(m)}`);
            t.assert(m.curve === 3 && m.rette === 0, `i sentieri sono curve, non rette: ${JSON.stringify(m)}`);
            t.assert(m.orme > 10, `il tratto percorso lascia le orme (${m.orme})`);
            t.assert(m.luce && m.ora === 'tramonto', `con 8 Stelle e' il tramonto: ${m.ora}`);
            t.assert(m.castello === '80', `l'anello del Castello segue le Stelle (8 su 10): ${m.castello}`);
            // Il falo': al centro (della prima schermata) e in basso, sotto il fiume e lontano da lui.
            t.assert(Math.abs(m.falo.x - m.canvas.w / 2) < 60 || Math.abs(m.falo.x - 640) < 60, `il falo' sta al centro: ${JSON.stringify(m.falo)}`);
            t.assert(m.falo.y > 640, `il falo' sta in basso, ben sotto il fiume (sponda a ~590): ${JSON.stringify(m.falo)}`);

            // La luce cambia con le Stelle: 10 = crepuscolo; l'anello del Castello si accende.
            await imposta(10, [{ kind: 'prize', label: '+1', x: 230, y: 330 }, { kind: 'win', label: 'v', x: 420, y: 260 }, { kind: 'prize', label: '+2', x: 610, y: 340 }]);
            await page.reload();
            await page.waitForSelector('.map-node.choice');
            const sera = await page.evaluate(() => ({ ora: document.body.dataset.ora, acceso: document.getElementById('starsCastello').classList.contains('acceso') }));
            t.assert(sera.ora === 'crepuscolo' && sera.acceso, `alla soglia del Castello e' il crepuscolo e l'anello si accende: ${JSON.stringify(sera)}`);

            // L'approdo (partenza): a sinistra, poco sotto il fiume; i primi bivi nascono da li' verso destra.
            await page.evaluate(() => SaveManager.setTournamentState('duelistKingdom', null));
            await page.reload();
            await page.waitForSelector('#startTournamentBtn');
            await page.waitForFunction(() => !document.documentElement.classList.contains('avvio-in-corso'), null, { timeout: 20000 });
            await page.click('#startTournamentBtn');
            for (let i = 0; i < 8 && !(await page.$('.map-node.choice')); i++) {
                const salta = await page.$('button:has-text("SALTA")');
                if (salta) await salta.click().catch(() => {});
                await page.waitForTimeout(400);
            }
            await page.waitForSelector('.map-node.choice', { timeout: 15000 });
            const via = await page.evaluate(() => {
                const c = document.querySelector('.map-node.current');
                return { x: parseFloat(c.style.left), y: parseFloat(c.style.top), scelte: [...document.querySelectorAll('.map-node.choice')].map((e) => parseFloat(e.style.left)), alte: [...document.querySelectorAll('.map-node.choice')].map((e) => parseFloat(e.style.top)) };
            });
            t.assert(via.x === 130 && via.y === 610, `si parte a sinistra, poco sotto il fiume: ${JSON.stringify(via)}`);
            t.assert(via.scelte.length >= 2 && via.scelte.every((x) => x > via.x + 100), `i primi bivi nascono da li' verso destra: ${JSON.stringify(via)}`);
            // Da li' i bivi si diramano sia verso l'alto sia verso il basso (non tutti dalla stessa parte).
            t.assert(via.alte.some((y) => y < via.y - 20) && via.alte.some((y) => y > via.y + 20), `i bivi vanno uno in alto e uno in basso: ${JSON.stringify(via)}`);
            t.assert(errori.length === 0, `nessun errore: ${errori.join(' | ')}`);
        } finally {
            await page.close();
        }
    }
};
