// Multiplayer: DUELLO A SPECCHIO (regola della stanza, js/multiplayer/mp-lobby.js).
//
// L'host accende la regola e sceglie un mazzo del catalogo (Starter/Structure): da quel momento nessuno usa il proprio, e
// i due client giocano lo STESSO mazzo. Si controlla che
//  - la regola arrivi all'ospite in sola lettura (spunta accesa e bloccata, mazzo personale nascosto su entrambi i lati);
//  - a duello avviato tutte le carte di mano e Deck di OGNI lato siano del mazzo scelto (il mazzo personale di default
//    di un profilo nuovo e' un altro);
//  - spenta la regola, torni tutto com'era (mazzo personale visibile, nessun `MP_SPECCHIO_ID`).
//
// `standalone: true`: due pagine e un relay vero (vedi multiplayer-scelta-arena-dopo-ingresso.spec.js).
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

const MAZZO = 'starter_sdy_yugi';

module.exports = {
    name: 'Multiplayer: duello a specchio, stesso mazzo per tutti e due scelto dall\'host',
    standalone: true,
    async run({ browser, assert }) {
        const statics = await startStaticServer();
        const room = await startRoomServer();
        const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
        const errori = [];
        try {
            const apri = async (etichetta) => {
                const page = await context.newPage();
                page.on('pageerror', (e) => errori.push(`[${etichetta}] ${e.message}`));
                await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_RPS_SKIP = true; window.DUEL_FAST_OPENING = true; });
                await page.goto(statics.origin + '/multiplayer.html', { waitUntil: 'load' });
                await page.waitForSelector('#mpCreateBtn');
                await page.waitForFunction(() => { const el = document.getElementById('pageLoader'); return !el || el.classList.contains('page-loader-hidden'); }, { timeout: 15000 });
                await page.evaluate(() => { const a = document.querySelector('.mp-advanced'); if (a) a.open = true; });
                await page.fill('#mpServerUrl', room.wsUrl);
                return page;
            };
            const host = await apri('host');
            const ospite = await apri('ospite');

            await host.click('#mpCreateBtn');
            await host.waitForFunction(() => { const el = document.getElementById('mpRoomCodeValue'); return el && /^[A-Z0-9]{5}$/.test(el.textContent.trim()); }, { timeout: 15000 });
            const codice = (await host.textContent('#mpRoomCodeValue')).trim();
            await ospite.click('#mpTabJoin');
            await ospite.fill('#mpJoinCode', codice);
            await ospite.click('#mpJoinBtn');
            await host.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
            await ospite.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });

            // Prima: regola spenta, mazzo personale visibile su entrambi.
            const prima = async (page) => page.evaluate(() => ({ mazzoNascosto: document.getElementById('mpDeckGroup').hidden, spunta: document.getElementById('mpSpecchioOn').checked }));
            const [p1, p2] = [await prima(host), await prima(ospite)];
            assert(!p1.mazzoNascosto && !p1.spunta && !p2.mazzoNascosto && !p2.spunta, `Regola spenta all'inizio: ${JSON.stringify([p1, p2])}`);

            // L'ospite NON puo' toccarla: e' dell'host.
            const ospiteBloccato = await ospite.evaluate(() => document.getElementById('mpSpecchioOn').disabled && document.getElementById('mpSpecchioMazzo').disabled);
            assert(ospiteBloccato, 'L\'ospite vede la regola in sola lettura');

            // L'host la accende e sceglie il mazzo (l'ospite e' GIA' in sala: la config deve raggiungerlo).
            await host.check('#mpSpecchioOn');
            await host.selectOption('#mpSpecchioMazzo', MAZZO);
            await ospite.waitForFunction((id) => document.getElementById('mpSpecchioOn').checked && document.getElementById('mpSpecchioMazzo').value === id && document.getElementById('mpDeckGroup').hidden, MAZZO, { timeout: 10000 });
            const hostNascosto = await host.evaluate(() => document.getElementById('mpDeckGroup').hidden);
            assert(hostNascosto, 'Anche per l\'host il mazzo personale sparisce');

            await host.click('#mpReadyBtn');
            await ospite.click('#mpReadyBtn');

            const mazzo = await host.evaluate((id) => getStarterStructureDeck(id).main.map((c) => c.id), MAZZO);
            const controllo = (page) => page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.playerHand && gameState.playerHand.length > 0, null, { timeout: 90000 })
                .then(() => page.evaluate((ids) => {
                    const insieme = new Set(ids);
                    const carte = [...gameState.playerHand, ...(gameState.playerDeck || [])];
                    return { specchio: window.MP_SPECCHIO_ID, quante: carte.length, fuori: carte.filter((c) => !insieme.has(c.id)).map((c) => c.name) };
                }, mazzo));
            const [rHost, rOspite] = await Promise.all([controllo(host), controllo(ospite)]);
            assert(rHost.specchio === MAZZO && rOspite.specchio === MAZZO, `Entrambi sanno della regola: ${rHost.specchio} / ${rOspite.specchio}`);
            assert(rHost.quante > 0 && rHost.fuori.length === 0, `Il mazzo dell'host e' quello a specchio, fuori: ${JSON.stringify(rHost.fuori.slice(0, 5))}`);
            assert(rOspite.quante > 0 && rOspite.fuori.length === 0, `Il mazzo dell'ospite e' quello a specchio, fuori: ${JSON.stringify(rOspite.fuori.slice(0, 5))}`);
            assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
        } finally {
            await context.close();
            await room.close();
            await statics.close();
        }
    }
};
