// Multiplayer a passo comune, end-to-end: due pagine vere, il relay vero.
// =====================================================================
// Il protocollo è già verificato in Node dal duello gemello
// (duello-gemello.spec.js): qui si verifica che la PAGINA lo porti sulla
// rete davvero — la sala d'attesa che lo accende, lo scambio dei mazzi e del
// seme all'avvio (js/multiplayer/mp-passo-comune.js), initGame che prepara lo
// stesso duello sui due lati, il relay che lascia passare i messaggi nuovi
// (server/server.js), l'invio a lotti, e la ripresa dopo una caduta di linea.
//
// Si gioca con le stesse funzioni che chiama l'interfaccia (summonMonster,
// endTurn), sempre con carte VERE della mano: a passo comune i due client
// conoscono entrambe le mani, e sostituire una carta "di nascosto" (come
// fanno gli spec del protocollo vecchio) separerebbe le due partite per
// davvero. Le scelte le fa il motore da sé (DuelEngineUI = null: nessuna
// interfaccia che le mostri), uguali sui due lati.
//
// Ad ogni turno, a duello fermo su entrambi i lati, l'impronta dello stato
// (PassoComune.impronta) deve essere identica. Al terzo turno un lato perde
// la linea MENTRE si gioca: i messaggi persi devono tornare con la ripresa
// ('passo-riprendi'), e le due partite restare uguali.
//
// standalone: due pagine sue, come gli altri spec Multiplayer.
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

const TURNI = 6;

module.exports = {
    name: 'Multiplayer a passo comune: due client veri giocano la stessa partita, anche dopo una caduta di linea',
    standalone: true,
    async run({ browser, assert }) {
        const statics = await startStaticServer();
        const room = await startRoomServer();
        const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' });
        const pageErrors = [];
        const divergenze = [];

        try {
            const openLobby = async (label) => {
                const page = await context.newPage();
                page.on('pageerror', (err) => pageErrors.push(`[${label}] ${err.message}`));
                page.on('console', (m) => {
                    if (m.type() === 'error' && m.text().includes('PassoComune')) divergenze.push(`[${label}] ${m.text()}`);
                });
                await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.SALA_CLASSICA = true; window.DUEL_RPS_SKIP = true; });
                await page.goto(statics.origin + '/multiplayer.html', { waitUntil: 'load' });
                await page.waitForSelector('#mpCreateBtn');
                await page.waitForFunction(() => {
                    const el = document.getElementById('pageLoader');
                    return !el || el.classList.contains('page-loader-hidden');
                }, null, { timeout: 15000 });
                await page.evaluate(() => {
                    const avanzate = document.querySelector('.mp-advanced');
                    if (avanzate) avanzate.open = true;
                });
                await page.fill('#mpServerUrl', room.wsUrl);
                return page;
            };
            const pageA = await openLobby('A');
            const pageB = await openLobby('B');

            await pageA.click('#mpCreateBtn');
            await pageA.waitForFunction(() => {
                const el = document.getElementById('mpRoomCodeValue');
                return el && /^[A-Z0-9]{5}$/.test(el.textContent.trim());
            }, null, { timeout: 15000 });
            const code = (await pageA.textContent('#mpRoomCodeValue')).trim();
            await pageB.click('#mpTabJoin');
            await pageB.fill('#mpJoinCode', code);
            await pageB.click('#mpJoinBtn');
            await pageA.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
            await pageB.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
            await pageA.click('#mpReadyBtn');
            await pageB.click('#mpReadyBtn');

            // Il duello a passo comune è partito su ENTRAMBI: scambio dei mazzi
            // fatto, PassoComune acceso, le due mani da 5 e il Deck dell'altro
            // davvero in memoria (non più segnaposto).
            const duelloAcceso = (page) => page.waitForFunction(
                () => window.MP_PASSO_COMUNE === true && typeof PassoComune !== 'undefined' && PassoComune.attivo()
                    && Array.isArray(gameState.botDeck) && gameState.botDeck.length > 0
                    && gameState.playerHand.length >= 5 && gameState.botHand.length >= 5,
                null, { timeout: 45000 }
            );
            await Promise.all([duelloAcceso(pageA), duelloAcceso(pageB)]);
            // Le scelte le fa il motore, uguali sui due lati (vedi in cima).
            await Promise.all([pageA, pageB].map((p) => p.evaluate(() => { window.DuelEngineUI = null; })));

            const manoVera = await pageB.evaluate(() => gameState.botHand.every((c) => c && c.id !== -1 && c.name !== '???'));
            assert(manoVera, 'A passo comune la mano dell\'avversario è quella vera (in memoria), non fatta di segnaposto');

            /** Lo stato di un lato, quando è fermo nella Main Phase 1 del turno `turno`. */
            const fotografia = (page) => page.evaluate(() => ({
                turno: gameState.turn, fase: gameState.phase, diTurno: gameState.currentPlayer,
                nonFermo: PassoComune.motivoNonFermo(), passo: PassoComune.stato(),
                ultimoRicevuto: PassoComune.ultimoRicevuto(),
                log: Array.from(document.querySelectorAll('#gameLog .log-entry, #gameLog > div')).slice(-8).map((e) => e.textContent.trim())
            }));
            const fermoInMain1 = async (page, turno) => {
                try {
                    await page.waitForFunction((t) => gameState.turn === t
                        && gameState.phase === 'main1' && PassoComune.fermo() && PassoComune.stato().inArrivo === 0,
                    turno, { timeout: 40000 });
                } catch (err) {
                    const [sa, sb] = await Promise.all([fotografia(pageA), fotografia(pageB)]);
                    throw new Error(`Turno ${turno}: un lato non arriva fermo in Main Phase 1.\n  A: ${JSON.stringify(sa)}\n  B: ${JSON.stringify(sb)}`);
                }
            };
            const impronta = (page) => page.evaluate(() => PassoComune.impronta());

            let ripresaFatta = false;
            for (let turno = 1; turno <= TURNI; turno++) {
                await Promise.all([fermoInMain1(pageA, turno), fermoInMain1(pageB, turno)]);
                // Un attimo perché anche l'ultimo lotto in volo sia arrivato.
                await pageA.waitForTimeout(300);
                const [ia, ib] = await Promise.all([impronta(pageA), impronta(pageB)]);
                assert(ia === ib, `Turno ${turno}: le due partite devono essere identiche nella Main Phase 1.\n  A: ${ia}\n  B: ${ib}`);

                const aDiTurno = await pageA.evaluate(() => gameState.currentPlayer === 'player');
                const diTurno = aDiTurno ? pageA : pageB;

                // Al terzo turno cade la linea di B, MENTRE si gioca: le mosse
                // di questo turno (sue o di A) partono senza che il relay
                // possa consegnarle, e devono tornare con la ripresa.
                if (turno === 3) {
                    await pageB.evaluate(() => DuelNetwork._simulateUnexpectedDisconnect());
                    ripresaFatta = true;
                }

                // Una mossa vera: Evocare un mostro di Livello 4 o meno che sia
                // davvero in mano, nella prima casella libera.
                await diTurno.evaluate(() => {
                    const mano = gameState.playerHand;
                    const i = mano.findIndex((c) => c && c.type === 'monster' && !c.extraDeck && (c.level || 0) <= 4
                        && DuelEngine.normalSummonBlockReason('player', c) === null);
                    const casella = gameState.playerMonsterField.findIndex((s) => !s);
                    if (i !== -1 && casella !== -1 && !gameState.hasNormalSummoned) summonMonster(mano[i], casella, 'attack', i);
                });
                await diTurno.waitForFunction(() => PassoComune.fermo(), null, { timeout: 30000 });
                await diTurno.waitForTimeout(400);
                await diTurno.evaluate(() => endTurn());
                // Più di 6 carte in mano: lo scarto di fine turno lo sceglie la
                // persona (startHandDiscardSelection), e l'altro client lo
                // aspetta. Si scartano le ultime, come farebbe chi clicca.
                await diTurno.waitForTimeout(1500);
                await diTurno.evaluate(() => {
                    const p = gameState.pendingHandDiscard;
                    if (!p) return;
                    p.selected = gameState.playerHand.map((_, i) => i).slice(-p.needed);
                    performHandDiscard();
                });
            }

            await Promise.all([fermoInMain1(pageA, TURNI + 1), fermoInMain1(pageB, TURNI + 1)]);
            await pageA.waitForTimeout(300);
            const [fa, fb] = await Promise.all([impronta(pageA), impronta(pageB)]);
            assert(fa === fb, `Dopo ${TURNI} turni, caduta di linea compresa, le due partite devono essere identiche.\n  A: ${fa}\n  B: ${fb}`);

            const stati = await Promise.all([pageA, pageB].map((p) => p.evaluate(() => PassoComune.stato())));
            assert(ripresaFatta && stati.every((s) => s.inviati > 0 && s.ricevuti > 0),
                `I due client devono essersi scambiati comandi e decisioni: ${JSON.stringify(stati)}`);
            // Ciò che uno ha mandato l'altro l'ha ricevuto tutto, in fila
            // (la ripresa ha riempito il buco della caduta di linea).
            const ultimi = await Promise.all([pageA, pageB].map((p) => p.evaluate(() => PassoComune.ultimoRicevuto())));
            assert(ultimi[0] === stati[1].inviati && ultimi[1] === stati[0].inviati,
                `Ogni messaggio mandato deve essere arrivato: A ha ricevuto ${ultimi[0]} di ${stati[1].inviati}, B ${ultimi[1]} di ${stati[0].inviati}`);

            assert(divergenze.length === 0, `Il passo comune ha segnalato problemi:\n  ${divergenze.join('\n  ')}`);
            assert(pageErrors.length === 0, `Errori nelle pagine:\n  ${pageErrors.join('\n  ')}`);
        } finally {
            await context.close();
            await room.close();
            await statics.close();
        }
    }
};
