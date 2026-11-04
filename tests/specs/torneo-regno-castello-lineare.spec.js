const path = require('path');
const fs = require('fs');

module.exports = {
    standalone: true,
    name: 'Regno dei Duellanti: il Castello conserva solo i nodi già affrontati al suo interno',
    async run(t) {
        const radice = path.join(__dirname, '..', '..');
        const url = 'file:///' + path.join(radice, 'torneo-regno-duellanti.html').replace(/\\/g, '/');
        const page = await t.browser.newPage({ viewport: { width: 1280, height: 800 } });
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        try {
            const sorgente = fs.readFileSync(path.join(radice, 'torneo-regno-duellanti.html'), 'utf8');
            t.assert(/insideCastle\s*\?\s*'arenaCastelloPegasus\.jpg'\s*:\s*'arenaRegnoDeiDuellanti\.jpg'/.test(sorgente),
                'Fuori dal Castello il torneo deve usare arenaRegnoDeiDuellanti.jpg e dentro l’arena del Castello');
            await page.goto(url);
            await page.waitForFunction(() => !!window.SaveManager);
            await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                SaveManager.setTournamentState('duelistKingdom', {
                    difficulty: 'Medio', stars: 12, step: 7,
                    history: [
                        { kind: 'win', label: 'Nodo isola 1', x: 300, y: 250 },
                        { kind: 'prize', label: 'Nodo isola 2', x: 520, y: 330 }
                    ],
                    pendingRoutes: null, pendingEncounter: null,
                    castleReached: true, castleStage: 'semifinal',
                    castleSemifinalOpponent: 'rex',
                    castleFinalists: ['rex', 'mai', 'mako'],
                    eliminated: false
                });
            });
            await page.reload();
            await page.waitForSelector('.map-node.choice');

            let nodi = await page.locator('.map-node').allTextContents();
            t.assert(nodi.length === 1 && /Rex Raptor/i.test(nodi[0]),
                `Entrando nel Castello deve restare solo Rex Raptor, senza percorso dell'isola: ${JSON.stringify(nodi)}`);
            const posizioneRex = await page.locator('.map-node').evaluate((el) => ({
                x: parseFloat(el.style.left), y: parseFloat(el.style.top)
            }));
            t.assert(posizioneRex.x < 1280 / 3 && Math.abs(posizioneRex.y - 800 / 2) < 30,
                `Il primo sfidante deve stare sul tappeto, a metà altezza nella zona sinistra: ${JSON.stringify(posizioneRex)}`);
            const migrato = await page.evaluate(() => SaveManager.getTournamentState('duelistKingdom'));
            t.assert(migrato.history.length === 0 && migrato.castleMapReset === true,
                'Una scalata già nel Castello deve eliminare una volta sola la vecchia history dell’isola');

            await page.evaluate(() => {
                const state = SaveManager.getTournamentState('duelistKingdom');
                state.pendingRoutes = null;
                state.pendingEncounter = { characterId: 'rex', wager: 0, isKaibaGate: false, castleStage: 'semifinal' };
                SaveManager.setTournamentState('duelistKingdom', state);
                sessionStorage.setItem('ygoLastDuelOutcome', JSON.stringify({
                    mode: 'tournament', tournamentId: 'duelistKingdom', playerWon: true
                }));
            });
            await page.reload();
            await page.waitForSelector('.map-node.choice');
            nodi = await page.locator('.map-node').allTextContents();
            t.assert(nodi.length === 2 && /Rex Raptor/i.test(nodi[0]) && !/Rex Raptor/i.test(nodi[1]),
                `Dopo Rex devono restare il suo nodo completato e il solo sfidante successivo: ${JSON.stringify(nodi)}`);
            const posizioneFinale = await page.locator('.map-node.choice').evaluate((el) => parseFloat(el.style.left));
            t.assert(posizioneFinale > posizioneRex.x && Math.abs(posizioneFinale - 1280 / 2) < 40,
                `Lo sfidante successivo deve avanzare da sinistra verso il centro (x=${posizioneFinale})`);
            const collegamento = await page.locator('.map-line.choice-line').evaluate((line) => ({
                x1: Number(line.getAttribute('x1')),
                y1: Number(line.getAttribute('y1')),
                x2: Number(line.getAttribute('x2')),
                y2: Number(line.getAttribute('y2'))
            }));
            t.assert(Math.abs(collegamento.x1 - posizioneRex.x) < 1 && Math.abs(collegamento.y1 - posizioneRex.y) < 1,
                `La nuova linea deve partire dall'ultimo nodo del Castello, non dall'origine invisibile: ${JSON.stringify(collegamento)}`);
            t.assert(Math.abs(collegamento.x2 - posizioneFinale) < 1,
                `La nuova linea deve terminare sullo sfidante corrente: ${JSON.stringify(collegamento)}`);
        } finally {
            await page.close();
        }
    }
};
