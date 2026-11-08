// Battle City: Radar potenziato, Scudo del Duel Disk, Blackout e Missione
// secondaria. Si prova la LOGICA con le funzioni vere della pagina (moveToCell
// su un settore costruito dal codice), forzando Math.random per scegliere
// l'esito di un evento invece di sperare in un lancio fortunato.
//
// `standalone`: la pagina del torneo vive per conto suo.
const path = require('path');

module.exports = {
    standalone: true,
    name: 'Battle City: oggetti (Radar, Scudo), Blackout e Missione secondaria',
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

            // Prepara un settore con: giocatore al centro, `kind` nella casella
            // a destra, tutto il resto vuoto e già rivelato (salvo `nascoste`).
            const prepara = (opts) => page.evaluate((o) => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                const s = makeInitialState('Medio');
                buildSector(s);
                s.grid.cells = s.grid.cells.map(() => ({ kind: 'empty', revealed: true, resolved: false }));
                const w = s.grid.w;
                const centro = DISTRICT_START[s.grid.districtId || 'centro'] != null ? DISTRICT_START[s.grid.districtId || 'centro'] : 0;
                s.grid.playerIndex = centro;
                s.grid.cells[centro].resolved = true;
                const vicina = cityLinks[s.grid.districtId || 'centro'][centro][0];
                s.grid.cells[vicina] = Object.assign({ revealed: true, resolved: false }, o.cella);
                s.grid.cells.map((c, i) => i).filter((i) => i !== centro && i !== vicina).slice(0, (o.nascoste || []).length).forEach((i) => { s.grid.cells[i].revealed = false; });
                s.intermezziVisti = ['prologue', 'city', 'intro'];
                s.locators = 3;
                s.items = Object.assign({ radar: 0, shield: 0 }, o.items || {});
                s.blackout = o.blackout || 0;
                s.quest = o.quest || null;
                saveState(s);
                window.__vicina = vicina;
                window.__centro = centro;
                return { vicina, centro, w };
            }, opts);
            const stato = () => page.evaluate(() => loadState());
            const muovi = (rnd) => page.evaluate((r) => {
                if (r !== undefined) { const orig = Math.random; Math.random = () => r; window.__ripristina = () => { Math.random = orig; }; }
                // Il giocatore sta al centro, la casella di prova è la sua destra
                // (ricalcolata qui: un reload azzera le variabili della pagina).
                moveToCell(cityLinks[loadState().grid.districtId || 'centro'][loadState().grid.playerIndex][0]);
                if (window.__ripristina) { window.__ripristina(); window.__ripristina = null; }
            }, rnd);

            // --- Negozio: dà esattamente un oggetto, e il tetto vale.
            await prepara({ cella: { kind: 'shop' } });
            await page.reload();
            await page.waitForSelector('.city-cell', { timeout: 15000 });
            await muovi(0.1); // < 0.55 -> Radar
            let s = await stato();
            t.assert(s.items.radar === 1 && s.items.shield === 0, `Il Negozio dà un Radar (radar ${s.items.radar}, scudo ${s.items.shield})`);

            await prepara({ cella: { kind: 'shop' }, items: { radar: 3, shield: 0 } });
            await muovi(0.1); // Radar al tetto -> ripiega sullo Scudo
            s = await stato();
            t.assert(s.items.radar === 3 && s.items.shield === 1, `Con il Radar al tetto il Negozio ripiega sullo Scudo (radar ${s.items.radar}, scudo ${s.items.shield})`);

            // --- Evento cattivo: senza Scudo -1 carta, con Scudo nessuna perdita.
            await prepara({ cella: { kind: 'event' } });
            await muovi(0.5); // 0.4..0.75 -> cattivo
            s = await stato();
            t.assert(s.locators === 2, `Evento cattivo senza Scudo: -1 Carta Locazione (ora ${s.locators})`);

            await prepara({ cella: { kind: 'event' }, items: { shield: 1 } });
            await muovi(0.5);
            s = await stato();
            t.assert(s.locators === 3 && s.items.shield === 0, `Evento cattivo con Scudo: nessuna carta persa e Scudo consumato (carte ${s.locators}, scudo ${s.items.shield})`);

            // --- Blackout: senza Scudo parte, con Scudo viene respinto.
            await prepara({ cella: { kind: 'event' } });
            await muovi(0.7); // 0.62..0.82 -> blackout
            s = await stato();
            t.assert(s.blackout === 3 && s.locators === 3, `Blackout: 3 mosse e nessuna carta persa (blackout ${s.blackout}, carte ${s.locators})`);

            await prepara({ cella: { kind: 'event' }, items: { shield: 1 } });
            await muovi(0.7);
            s = await stato();
            t.assert(s.blackout === 0 && s.items.shield === 0, `Lo Scudo respinge il Blackout (blackout ${s.blackout}, scudo ${s.items.shield})`);

            // --- Blackout attivo: le celle rivelate ma non attraversate tornano
            // "ignote", e una mossa consuma una mossa di blackout.
            const p = await prepara({ cella: { kind: 'empty' }, blackout: 2 });
            await page.reload();
            await page.waitForSelector('.city-cell', { timeout: 15000 });
            const nascosteInBlackout = await page.evaluate(() => {
                const s = loadState();
                const ignote = Array.from(document.querySelectorAll('.city-cell')).filter((el) => el.querySelector('.bp-piece[data-bp-kind="hidden"], svg[data-bp-kind="hidden"]')).length;
                return { ignote, totali: s.grid.cells.length, risolte: s.grid.cells.filter((c) => c.resolved).length };
            });
            t.assert(nascosteInBlackout.ignote >= nascosteInBlackout.totali - nascosteInBlackout.risolte - 3,   // meno i due varchi, sempre visibili
                `In Blackout le celle non attraversate mostrano l'Ignoto (${nascosteInBlackout.ignote} su ${nascosteInBlackout.totali}, ${nascosteInBlackout.risolte} risolte)`);
            await muovi();
            s = await stato();
            t.assert(s.blackout === 1, `Una mossa consuma una mossa di Blackout (resta ${s.blackout})`);

            // --- Radar: rivela tutto e spegne il blackout; non si consuma se inutile.
            await prepara({ cella: { kind: 'empty' }, items: { radar: 2 }, nascoste: [2, 3, 4], blackout: 2 });
            await page.reload();
            await page.waitForSelector('#useRadarBtn', { timeout: 15000 });
            await page.click('#useRadarBtn');
            await page.waitForFunction(() => loadState().items.radar === 1, null, { timeout: 5000 });
            s = await stato();
            t.assert(s.grid.cells.every((c) => c.revealed) && s.blackout === 0, 'Il Radar rivela tutto il distretto e finisce il Blackout');
            const disabilitato = await page.evaluate(() => document.getElementById('useRadarBtn').disabled);
            t.assert(disabilitato, 'Con tutto già visibile e nessun blackout il Radar è disattivato (non si spreca)');

            // --- Missione: soffiata -> bersaglio rivelato ed evidenziato.
            await prepara({ cella: { kind: 'quest' }, nascoste: [] });
            await page.evaluate(() => {
                const s = loadState();
                const lontano = s.grid.cells.length - 1;   // una casella normale: gli ultimi indici sono varchi
                s.grid.cells[lontano] = { kind: 'duelist', characterId: 'joey', revealed: false, resolved: false };
                saveState(s);
            });
            await muovi();
            s = await stato();
            t.assert(s.quest && s.quest.characterId === 'joey' && s.quest.rewardCredits > 0, 'La soffiata assegna una missione sul Duellante presente nel distretto');
            t.assert(s.grid.cells[s.quest.cellIndex].revealed, 'Il bersaglio della missione viene rivelato');
            await page.reload();
            await page.waitForSelector('.city-cell', { timeout: 15000 });
            const evidenziato = await page.evaluate(() => document.querySelectorAll('.city-cell.quest-target').length);
            t.assert(evidenziato === 1, `Il bersaglio ha l'anello dorato (${evidenziato} evidenziati)`);
            const chip = await page.evaluate(() => !!document.getElementById('questChip'));
            t.assert(chip, 'La missione in corso compare nella riga sotto l\'intestazione');

            // Una seconda soffiata con una missione già in corso non ne assegna un'altra.
            await prepara({ cella: { kind: 'quest' }, quest: { characterId: 'joey', cellIndex: 0, reward: 2, sector: 1 } });
            await muovi();
            s = await stato();
            t.assert(s.quest && s.quest.characterId === 'joey' && s.quest.cellIndex === 0, 'Con una missione in corso la seconda soffiata non la sostituisce');

            // Il pezzo SVG della missione esiste.
            const pezzo = await page.evaluate(() => BoardPieces.markup('quest').length > 0);
            t.assert(pezzo, 'BoardPieces ha il pezzo "quest"');

            t.assert(erroriPagina.length === 0, 'Nessun errore JS in pagina: ' + erroriPagina.join(' | '));
        } finally {
            await page.close();
        }
    }
};
