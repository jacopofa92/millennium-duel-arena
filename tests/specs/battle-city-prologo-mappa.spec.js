const path = require('path');

module.exports = {
    standalone: true,
    name: 'Battle City: prologo prima della mappa urbana a tutto schermo',
    async run(t) {
        const radice = path.join(__dirname, '..', '..');
        const url = 'file:///' + path.join(radice, 'torneo-battle-city.html').replace(/\\/g, '/');
        const page = await t.browser.newPage({ viewport: { width: 1280, height: 800 } });
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        try {
            await page.goto(url);
            await page.waitForFunction(() => !!(window.SaveManager && document.getElementById('startBtn')));
            await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                SaveManager.setTournamentState('battleCity', null);
            });
            await page.reload();
            await page.waitForSelector('#startBtn');
            await page.click('#startBtn');
            await page.waitForSelector('.sc-scena');

            const prologo = await page.evaluate(() => ({
                visto: (SaveManager.getTournamentState('battleCity').intermezziVisti || []).includes('prologue'),
                sfondo: document.querySelector('.sc-sfondo').style.backgroundImage,
                mappaPrematura: !!document.getElementById('cityGrid')
            }));
            t.assert(prologo.visto, 'Il prologo deve essere registrato nella nuova scalata');
            t.assert(!prologo.mappaPrematura, 'La mappa non deve comparire sotto la scena prima della sua conclusione');

            await page.locator('.sc-salta').click();
            await page.waitForSelector('#cityGrid');
            const layout = await page.evaluate(() => {
                const main = document.querySelector('.main');
                const grid = document.getElementById('cityGrid');
                return {
                    mainWidth: main.getBoundingClientRect().width,
                    gridWidth: grid.getBoundingClientRect().width,
                    viewportWidth: innerWidth,
                    background: document.body.style.backgroundImage,
                    gridBackground: getComputedStyle(grid).backgroundColor,
                    gridBorder: getComputedStyle(grid).borderTopWidth,
                    buttons: grid.querySelectorAll('button.city-cell').length,
                    token: !!grid.querySelector('.city-player-token'),
                    modalitaCitta: document.body.classList.contains('city-map-active')
                };
            });
            t.assert(layout.mainWidth >= layout.viewportWidth - 2,
                `La mappa deve usare tutta la larghezza dello schermo (${layout.mainWidth}/${layout.viewportWidth})`);
            // A 800px di altezza la griglia è quadrata e limitata dall'ALTEZZA
            // (100dvh meno intestazione, riga oggetti e legenda): 535px. La
            // soglia serve solo a escludere il vecchio tetto del contenitore.
            t.assert(layout.gridWidth > 500,
                `La griglia desktop non deve restare bloccata al vecchio limite di 640px contenitore (griglia ${layout.gridWidth}px)`);
            t.assert(/citta\.jpg/i.test(layout.background),
                `Lo sfondo della fase urbana deve essere citta.jpg: ${layout.background}`);
            t.assert(layout.gridBackground === 'rgba(0, 0, 0, 0)' && layout.gridBorder === '0px' && layout.modalitaCitta,
                `La struttura della griglia non deve essere percepibile sopra la città: ${JSON.stringify(layout)}`);
            t.assert(layout.buttons === 20, `Le 20 celle devono essere controlli interattivi accessibili (${layout.buttons})`);
            t.assert(layout.token, 'Il giocatore deve avere un segnalino persistente separato dalle celle');

            const fluidita = await page.evaluate(async () => {
                const grid = document.getElementById('cityGrid');
                const firstCell = grid.querySelector('.city-cell');
                const token = grid.querySelector('.city-player-token');
                const oldLeft = token.style.left + '|' + token.style.top;
                const state = SaveManager.getTournamentState('battleCity');
                const target = neighborsOf(state.grid, state.grid.playerIndex)[0];
                state.grid.cells[target].kind = 'empty';
                state.grid.cells[target].revealed = true;
                state.grid.cells[target].resolved = true;
                SaveManager.setTournamentState('battleCity', state);
                moveToCell(target);
                await new Promise((resolve) => setTimeout(resolve, 520));
                return {
                    sameCell: firstCell === grid.querySelector('.city-cell'),
                    sameToken: token === grid.querySelector('.city-player-token'),
                    moved: oldLeft !== token.style.left + '|' + token.style.top
                };
            });
            t.assert(fluidita.sameCell && fluidita.sameToken,
                'Muovendosi la mappa e i suoi nodi devono restare gli stessi elementi DOM');
            t.assert(fluidita.moved, 'Il segnalino del giocatore deve scorrere verso la nuova posizione');

            const hunters = await page.evaluate(() => {
                const state = SaveManager.getTournamentState('battleCity');
                const preassigned = state.grid.cells.filter((c) => c.kind === 'hunter').some((c) => !!c.characterId);
                state.rareHuntersSeen = [];
                const firstCycle = Array.from({ length: HUNTER_IDS.length }, () => pickRareHunter(state));
                const afterReset = pickRareHunter(state);
                return { preassigned, pool: HUNTER_IDS.slice(), firstCycle, afterReset };
            });
            t.assert(!hunters.preassigned, 'I nodi Rare Hunter devono restare anonimi fino a quando vengono affrontati');
            t.assert(new Set(hunters.firstCycle).size === hunters.pool.length,
                `Il primo ciclo Rare Hunter non deve avere doppioni: ${hunters.firstCycle.join(', ')}`);
            t.assert(hunters.pool.includes(hunters.afterReset), 'Dopo avere esaurito il pool deve iniziare un nuovo sorteggio valido');
        } finally {
            await page.close();
        }
    }
};
