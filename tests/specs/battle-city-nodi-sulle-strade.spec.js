// Battle City, quartieri a 20 nodi sulle strade vere (1.6.4): ogni quartiere ha 20 nodi connessi, con anelli (almeno due vie dove
// la geometria lo permette), nodi ben distanziati, varchi che si corrispondono fra quartieri, e le mappe salvate con 25 caselle si
// rigenerano senza far ricomparire una Locazione gia' raccolta. La posizione "su una superficie percorribile" non si puo' misurare
// da un test: la si guarda sugli sfondi (vedi il commento di CITY_LAYOUTS); qui si sorvegliano le proprieta' del grafo.
const path = require('path');

module.exports = {
    standalone: true,
    name: 'Battle City: 20 nodi per quartiere, grafo connesso con anelli, varchi coerenti, migrazione dalle mappe a 25 caselle',
    async run(t) {
        const url = 'file:///' + path.join(__dirname, '..', '..', 'torneo-battle-city.html').replace(/\\/g, '/');
        const page = await t.browser.newPage({ viewport: { width: 1280, height: 800 } });
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        try {
            await page.goto(url);
            await page.waitForFunction(() => !!(window.SaveManager && window.BoardPieces), null, { timeout: 25000 });

            const analisi = await page.evaluate(() => {
                const out = {};
                CITY_DISTRICTS.forEach((d) => {
                    const L = CITY_LAYOUTS[d.id], n = L.nodes.length;
                    const adj = cityLinks[d.id];
                    // connessione
                    const visti = new Set([0]); const coda = [0];
                    while (coda.length) { const x = coda.pop(); adj[x].forEach((y) => { if (!visti.has(y)) { visti.add(y); coda.push(y); } }); }
                    // distanza minima fra due nodi, in frazione della larghezza dell'immagine
                    let minDist = Infinity;
                    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) minDist = Math.min(minDist, Math.hypot(L.nodes[i][0] - L.nodes[j][0], L.nodes[i][1] - L.nodes[j][1]) / d.imageSize[0]);
                    out[d.id] = {
                        n: n, connesso: visti.size === n, archi: L.edges.length,
                        gradoMin: Math.min.apply(null, adj.map((a) => a.length)),
                        conDueVie: adj.filter((a) => a.length >= 2).length,
                        minDist: minDist,
                        dentro: L.nodes.every((p) => p[0] > 0 && p[0] < d.imageSize[0] && p[1] > 0 && p[1] < d.imageSize[1]),
                        viaOk: L.edges.every((e) => e[0] !== e[1] && e[0] < n && e[1] < n),
                        celle: GRID_W * GRID_H
                    };
                });
                // i varchi: l'arrivo e' un varco che riporta al quartiere di partenza
                const varchiOk = Object.keys(DISTRICT_GATES).every((id) => DISTRICT_GATES[id].every((g) => (DISTRICT_GATES[g.to] || []).some((h) => h.index === g.entry && h.to === id)));
                return { out: out, varchiOk: varchiOk };
            });
            for (const [id, a] of Object.entries(analisi.out)) {
                t.assert(a.n === 20 && a.celle === 20, `${id}: 20 nodi (${a.n}) e 20 celle (${a.celle})`);
                t.assert(a.connesso, `${id}: ogni nodo e' raggiungibile`);
                t.assert(a.archi >= a.n, `${id}: ci sono anelli (archi ${a.archi} >= nodi ${a.n}): almeno due vie`);
                t.assert(a.gradoMin >= 1 && a.conDueVie >= a.n - 5, `${id}: quasi tutti i nodi hanno almeno due strade (${a.conDueVie}/${a.n}, grado minimo ${a.gradoMin})`);
                t.assert(a.minDist >= 0.045, `${id}: nodi ben distanziati (minimo ${(a.minDist * 100).toFixed(1)}% della larghezza)`);
                t.assert(a.dentro && a.viaOk, `${id}: nodi dentro l'immagine e archi validi`);
            }
            t.assert(analisi.varchiOk, 'I varchi si corrispondono fra i quartieri (andata e ritorno)');

            // Migrazione: una mappa salvata con 25 caselle e una Locazione gia' raccolta si rigenera a 20 senza rimettere la Locazione.
            const migrato = await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                const s = makeInitialState('Medio');
                buildSector(s);
                const vecchia = { w: 5, h: 5, playerIndex: 12, districtId: 'centro', cells: Array.from({ length: 25 }, (_, i) => ({ kind: i === 3 ? 'locator' : 'empty', revealed: true, resolved: i === 3 || i === 12 })) };
                s.grid = vecchia; s.sector = 1; delete s.cityLayoutVersion;
                saveState(s);
                const m = loadState();
                return { celle: m.grid.cells.length, loc: m.grid.cells.filter((c) => c.kind === 'locator').length, versione: m.cityLayoutVersion, riscosse: m.locazioniRiscosse, player: m.grid.playerIndex };
            });
            t.assert(migrato.celle === 20 && migrato.versione === 4, `la mappa a 25 caselle si rigenera a 20 (${migrato.celle}, versione ${migrato.versione})`);
            t.assert(migrato.loc === 0 && migrato.riscosse && migrato.riscosse.centro, `una Locazione gia' raccolta non ricompare: ${JSON.stringify(migrato)}`);
            t.assert(errori.length === 0, `nessun errore JS: ${errori.join(' | ')}`);
        } finally {
            await page.close();
        }
    }
};
