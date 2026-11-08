// Battle City, mappa della città: le caselle sono pedine 3D in SVG (non più
// emoji) e le caselle raggiungibili sono EVIDENTI — accese, con un percorso
// dal segnalino a ciascuna, e le sole ad avere l'etichetta. Richiesta
// dell'utente: "rendi più evidente dove il giocatore può spostarsi... e al
// posto delle emoticon metti qualcosa in 3D".
//
// Controlla le PROPRIETÀ, non il disegno: un percorso per ogni casella
// raggiungibile (e solo per quelle), nessuna emoji rimasta nelle caselle o
// nella legenda, il segnalino che segue la mossa. Il disegno si giudica a
// occhio, una misura non lo dice.
//
// `standalone`: la pagina del torneo vive per conto suo.
const path = require('path');

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}❓❗]/u;

module.exports = {
    standalone: true,
    name: 'Battle City: pedine 3D al posto delle emoji, e percorsi verso le sole caselle raggiungibili',
    async run(t) {
        const RADICE = path.join(__dirname, '..', '..');
        const url = 'file:///' + path.join(RADICE, 'torneo-battle-city.html').replace(/\\/g, '/');
        const page = await t.browser.newPage({ viewport: { width: 1280, height: 900 } });
        const erroriPagina = [];
        page.on('pageerror', (e) => erroriPagina.push(e.message));
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });

        try {
            await page.goto(url);
            await page.waitForFunction(() => !!(window.SaveManager && window.BoardPieces), null, { timeout: 25000 });
            // Settore costruito dal codice vero, con la casella a destra
            // dell'inizio forzata a "libera": cliccarla deve spostare il
            // segnalino senza aprire duelli o eventi.
            const { V, vicine } = await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                const s = makeInitialState('Medio');
                buildSector(s);
                s.grid.cells.forEach((c) => { c.revealed = true; });
                const V = cityLinks[s.grid.districtId || 'centro'][s.grid.playerIndex][0];
                s.grid.cells[V] = { kind: 'empty', revealed: true, resolved: false };
                s.intermezziVisti = ['prologue', 'city', 'intro'];
                saveState(s);
                return { V: V, vicine: cityLinks[s.grid.districtId || 'centro'][s.grid.playerIndex].length };
            });
            await page.reload();
            await page.waitForSelector('.city-cell', { timeout: 15000 });
            await page.waitForFunction(() => document.querySelectorAll('.city-routes .route').length > 0, null, { timeout: 5000 });

            const leggi = () => page.evaluate(() => {
                const g = document.getElementById('cityGrid');
                const reach = Array.from(document.querySelectorAll('.city-cell.reachable')).map((el) => el.dataset.index);
                const attesi = (g.dataset.reachable || '').split(',').filter(Boolean);
                const testoCaselle = Array.from(document.querySelectorAll('.city-cell, .legend')).map((el) => el.textContent).join(' ');
                const etichetteVisibili = Array.from(document.querySelectorAll('.city-cell > .cell-label'))
                    .filter((el) => getComputedStyle(el).display !== 'none')
                    .map((el) => el.parentElement);
                const tok = document.querySelector('.city-player-token').getBoundingClientRect();
                const cella = document.querySelector(`.city-cell[data-index="${g.dataset.player}"]`).getBoundingClientRect();
                return {
                    player: g.dataset.player,
                    reach: reach.sort(), attesi: attesi.sort(),
                    percorsi: document.querySelectorAll('.city-routes .route').length,
                    frecce: document.querySelectorAll('.city-routes .route-arrow').length,
                    pedine: document.querySelectorAll('.city-cell .bp-piece').length,
                    pedineLegenda: document.querySelectorAll('.legend .bp-piece').length,
                    testoCaselle: testoCaselle,
                    etichetteFuoriPosto: etichetteVisibili.filter((c) => !c.classList.contains('reachable') && !c.classList.contains('heliport') && !c.classList.contains('district-gate')).length,
                    segnalinoCentrato: Math.abs((tok.left + tok.width / 2) - (cella.left + cella.width / 2)) < 3
                };
            });

            const prima = await leggi();
            t.assert(prima.reach.length === vicine, `Dal punto di partenza le caselle raggiungibili sono ${vicine}, lette ${prima.reach.length}`);
            t.assert(JSON.stringify(prima.reach) === JSON.stringify(prima.attesi),
                `Le caselle accese devono essere esattamente le vicine del segnalino: ${prima.reach} contro ${prima.attesi}`);
            t.assert(prima.percorsi === prima.reach.length && prima.frecce === prima.reach.length,
                `Un percorso con la sua freccia per ogni casella raggiungibile: ${prima.percorsi} percorsi, ${prima.frecce} frecce, ${prima.reach.length} caselle`);
            t.assert(prima.pedine > 0, `Le caselle devono usare le pedine SVG (${prima.pedine} in mappa)`);
            t.assert(!EMOJI.test(prima.testoCaselle), `Nessuna emoji deve restare nelle caselle o nella legenda: "${(prima.testoCaselle.match(EMOJI) || [])[0]}"`);
            t.assert(prima.etichetteFuoriPosto === 0, `L'etichetta si vede solo sulle caselle raggiungibili (e sul decollo): ${prima.etichetteFuoriPosto} fuori posto`);
            t.assert(prima.segnalinoCentrato, 'Il segnalino deve stare sulla casella del giocatore');

            await page.setViewportSize({ width: 1280, height: 900 });

            // Una sola Carta Locazione da raccogliere per distretto.
            const raccolte = await page.evaluate(() => {
                let massimo = 0; let minimo = 99;
                for (let i = 0; i < 40; i++) {
                    const s = makeInitialState('Medio');
                    buildSector(s);
                    const n = s.grid.cells.filter((c) => c.kind === 'locator').length;
                    massimo = Math.max(massimo, n); minimo = Math.min(minimo, n);
                }
                return { massimo, minimo };
            });
            t.assert(raccolte.massimo === 1 && raccolte.minimo === 1,
                `Ogni distretto ha UNA sola Carta Locazione da raccogliere (trovate da ${raccolte.minimo} a ${raccolte.massimo})`);

            await page.click(`.city-cell[data-index="${V}"]`);
            await page.waitForFunction((v) => document.getElementById('cityGrid').dataset.player === String(v), V, { timeout: 5000 });
            await page.waitForTimeout(700);
            const dopo = await leggi();
            t.assert(JSON.stringify(dopo.reach) === JSON.stringify(dopo.attesi) && dopo.reach.indexOf(String(V)) === -1,
                `Dopo la mossa si accendono le vicine della NUOVA casella: ${dopo.reach}`);
            t.assert(dopo.percorsi === dopo.reach.length, `I percorsi seguono la mossa: ${dopo.percorsi} per ${dopo.reach.length} caselle`);
            t.assert(dopo.segnalinoCentrato, 'Il segnalino deve aver raggiunto la casella cliccata');

            // Fallback: un Duellante senza PNG ritagliato ripiega da solo
            // sulla pedina standard; uno col PNG (darkNite) ne mostra il ritaglio.
            await page.evaluate(() => {
                const box = document.createElement('div');
                box.id = 'provaRitratti';
                box.innerHTML = '<div id="mancante">' + BoardPieces.markup('duelist', null, { image: 'images/characters/pedine/nonEsiste.png' }) + '</div>'
                    + '<div id="presente">' + BoardPieces.markup('duelist', null, { image: 'images/characters/pedine/darkNite.png' }) + '</div>';
                document.body.appendChild(box);
            });
            await page.waitForFunction(() => !document.querySelector('#mancante image'), null, { timeout: 5000 });
            const ritratti = await page.evaluate(() => ({
                mancanteHaImmagine: !!document.querySelector('#mancante image'),
                mancanteHaPedina: !!document.querySelector('#mancante svg ellipse'),
                presenteHaImmagine: !!document.querySelector('#presente image'),
                markupDiNuovo: BoardPieces.markup('duelist', null, { image: 'images/characters/pedine/nonEsiste.png' }).indexOf('<image') === -1
            }));
            t.assert(!ritratti.mancanteHaImmagine && ritratti.mancanteHaPedina, 'Senza il PNG la pedina deve ripiegare su quella standard, non restare vuota');
            t.assert(ritratti.presenteHaImmagine, 'Con il PNG presente deve restare il ritaglio del personaggio');
            t.assert(ritratti.markupDiNuovo, 'Un ritratto già risultato mancante non va richiesto di nuovo ad ogni render');

            // Nome del PNG = nome del file avatar: Joey -> joeyWheeler.png.
            const abbinamento = await page.evaluate(() => PRELIM_IDS.map((id) => {
                const nome = getCharacter(id).image.split('/').pop().replace(/\.[^.]+$/, '');
                return { id, nome };
            }));
            const fs = require('fs');
            const cartella = path.join(RADICE, 'images', 'characters', 'pedine');
            const presenti = abbinamento.filter((a) => fs.existsSync(path.join(cartella, a.nome + '.png')));
            t.assert(presenti.length >= 4, `Almeno 4 Duellanti della città devono avere il PNG col nome dell'avatar: ${presenti.map((a) => a.nome)}`);
            t.assert(!fs.existsSync(path.join(cartella, 'joey.png')) && !fs.existsSync(path.join(cartella, 'duke.png')),
                'I PNG si chiamano come gli avatar (dukeDevlin.png), non come l\'id (duke.png)');

            // Rare Hunter: ritaglio dedicato, e fallback sulla propria pedina
            // standard (non quella del Duellante) se il file manca.
            const hunter = await page.evaluate(() => {
                const box = document.createElement('div');
                box.innerHTML = '<div id="hOk">' + BoardPieces.markup('hunter', null, { image: 'images/characters/pedine/rareHunter.png' }) + '</div>'
                    + '<div id="hKo">' + BoardPieces.markup('hunter', null, { image: 'images/characters/pedine/nonEsisteHunter.png' }) + '</div>';
                document.body.appendChild(box);
                return { conImmagine: !!document.querySelector('#hOk image') };
            });
            await page.waitForFunction(() => !document.querySelector('#hKo image'), null, { timeout: 5000 });
            const fallbackHunter = await page.evaluate(() => document.querySelector('#hKo svg').dataset.bpKind);
            t.assert(hunter.conImmagine, 'Il Rare Hunter deve usare il ritaglio rareHunter.png');
            t.assert(fallbackHunter === 'hunter','Il fallback di un Rare Hunter resta di tipo hunter');
            t.assert(fs.existsSync(path.join(cartella, 'rareHunter.png')), 'rareHunter.png deve esistere in pedine/');

            t.assert(erroriPagina.length === 0, 'Nessun errore JS deve comparire in pagina: ' + erroriPagina.join(' | '));
        } finally {
            await page.close();
        }
    }
};
