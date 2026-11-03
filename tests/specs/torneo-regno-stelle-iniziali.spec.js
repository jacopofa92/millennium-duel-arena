// Il torneo "Regno dei Duellanti" deve DAVVERO partire con STARTING_STARS
// (2) Stelle interne al torneo, e quella dote di partenza non deve mai
// finire nel portafoglio reale del giocatore. Vale sia per la dote iniziale
// sia per bonus e puntate: sono gettoni temporanei per entrare nel Castello,
// non ricompense economiche del profilo.
//
// Bug reale chiuso qui: il vecchio codice chiamava
// `addStars(STARTING_STARS - currentStars())` PRIMA che lo stato del
// torneo esistesse ancora — `addStars` esce subito (`if (!state) return
// 0`) quando non trova uno stato da aggiornare, quindi quella chiamata
// era un no-op silenzioso e il torneo partiva sempre da ZERO Stelle
// nonostante la schermata iniziale promettesse "Parti con 2 Stelle".
//
// `standalone`: la pagina del torneo vive per conto suo.
const path = require('path');

module.exports = {
    standalone: true,
    name: 'Torneo Regno dei Duellanti: tutte le Stelle della scalata restano nel contatore interno',
    async run(t) {
        const RADICE = path.join(__dirname, '..', '..');
        const url = 'file:///' + path.join(RADICE, 'torneo-regno-duellanti.html').replace(/\\/g, '/');
        const page = await t.browser.newPage({ viewport: { width: 1280, height: 900 } });
        const erroriPagina = [];
        page.on('pageerror', (e) => erroriPagina.push(e.message));
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });

        try {
            await page.goto(url);
            await page.waitForFunction(() => !!(window.SaveManager && document.getElementById('startTournamentBtn')), null, { timeout: 25000 });

            // Baseline pulita: nessun torneo in corso, portafoglio Stelle a
            // un valore noto e diverso da zero, per poter distinguere "non
            // e' cambiato" da "e' per caso rimasto a zero".
            await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                SaveManager.setTournamentState('duelistKingdom', null);
                const attuali = SaveManager.getCurrency().starChips || 0;
                if (attuali > 0) SaveManager.addCurrency('starChips', -attuali);
                SaveManager.addCurrency('starChips', 7);
            });
            await page.reload();
            await page.waitForFunction(() => !!(window.SaveManager && document.getElementById('startTournamentBtn')), null, { timeout: 25000 });

            const primaDelClick = await page.evaluate(() => SaveManager.getCurrency().starChips);
            t.assert(primaDelClick === 7, `Portafoglio di partenza atteso a 7, letto ${primaDelClick}`);

            await page.click('#startTournamentBtn');
            await page.waitForFunction(() => {
                const s = window.SaveManager && SaveManager.getTournamentState('duelistKingdom');
                return !!s;
            }, null, { timeout: 10000 });
            await page.waitForSelector('.sc-scena', { timeout: 5000 });
            const durantePrologo = await page.evaluate(() => ({
                visto: (SaveManager.getTournamentState('duelistKingdom').intermezziVisti || []).includes('prologue'),
                mappaVisibile: !!document.querySelector('.map-viewport')
            }));
            t.assert(durantePrologo.visto, 'Il prologo deve essere registrato una sola volta nella scalata');
            t.assert(!durantePrologo.mappaVisibile, 'La mappa deve comparire soltanto dopo la conclusione del prologo');

            const dopo = await page.evaluate(() => ({
                stelleTorneo: SaveManager.getTournamentState('duelistKingdom').stars,
                portafoglio: SaveManager.getCurrency().starChips
            }));

            t.assert(dopo.stelleTorneo === 2, `Il torneo deve partire con 2 Stelle interne, non ${dopo.stelleTorneo}`);
            t.assert(dopo.portafoglio === 7, `La dote di partenza non deve toccare il portafoglio reale (atteso invariato a 7, letto ${dopo.portafoglio})`);

            const dopoEventi = await page.evaluate(() => {
                const state = SaveManager.getTournamentState('duelistKingdom');
                addStars(2, state);
                // Come resolveChosenRoute: dopo addStars lo stesso stato
                // viene ancora modificato e risalvato. È proprio il giro
                // che prima annullava silenziosamente il bonus.
                state.step++;
                SaveManager.setTournamentState('duelistKingdom', state);
                addStars(-1, state);
                state.step++;
                SaveManager.setTournamentState('duelistKingdom', state);
                return {
                    stelleTorneo: SaveManager.getTournamentState('duelistKingdom').stars,
                    portafoglio: SaveManager.getCurrency().starChips
                };
            });
            t.assert(dopoEventi.stelleTorneo === 3,
                `Da 2 Stelle, bonus +2 e malus -1 devono lasciare il contatore del torneo a 3 (letto ${dopoEventi.stelleTorneo})`);
            t.assert(dopoEventi.portafoglio === 7,
                `Bonus e malus della scalata non devono toccare il profilo: atteso 7, letto ${dopoEventi.portafoglio}`);

            await page.goto('file:///' + path.join(RADICE, 'tornei.html').replace(/\\/g, '/'));
            await page.waitForFunction(() => document.getElementById('duelistKingdomStatus'));
            const riepilogo = await page.locator('#duelistKingdomStatus').textContent();
            t.assert(/3\s*⭐/.test(riepilogo),
                `La selezione dei tornei deve mostrare le 3 Stelle della scalata, non il portafoglio: ${riepilogo}`);

            t.assert(erroriPagina.length === 0, 'Nessun errore JS deve comparire in pagina: ' + erroriPagina.join(' | '));
        } finally {
            await page.close();
        }
    }
};
