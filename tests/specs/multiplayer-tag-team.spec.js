// Tag Team in rete, end-to-end: tre pagine vere, il relay vero.
// =====================================================================
// La sala (js/multiplayer/mp-tag-sala.js): l'host apre una stanza 2 contro 2,
// gli altri due entrano col codice e SI SIEDONO da soli in un posto libero,
// l'host sistema le coppie (sposta un giocatore: i due si scambiano), il
// posto rimasto vuoto lo gioca l'IA sul client dell'host, si sceglie lo
// scambio "su richiesta", tutti confermano e si parte.
// Il duello: passo comune a posti fra tre client (mp-passo-comune.js), la
// variante a squadre preparata uguale ovunque (tag-mode.js), turni giocati
// dalle persone con le funzioni dell'interfaccia e dall'IA da sola. A ogni
// turno di una persona, a duello fermo su tutti e tre, l'impronta deve
// essere identica. Una richiesta di scambio (D2) parte da un client e la
// risposta del compagno, su un ALTRO client, deve arrivare uguale a tutti.
//
// standalone: pagine sue, come gli altri spec Multiplayer.
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

const TURNI_PERSONA = 6;

module.exports = {
    name: 'Multiplayer Tag Team: tre client veri, la sala dei posti e la stessa partita a squadre',
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
                await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_RPS_SKIP = true; });
                await page.goto(statics.origin + '/multiplayer.html?modo=tag', { waitUntil: 'load' });
                await page.waitForSelector('#mpCreateBtn');
                await page.waitForFunction(() => {
                    const el = document.getElementById('pageLoader');
                    return !el || el.classList.contains('page-loader-hidden');
                }, null, { timeout: 15000 });
                await page.evaluate(() => { const a = document.querySelector('.mp-advanced'); if (a) a.open = true; });
                await page.fill('#mpServerUrl', room.wsUrl);
                return page;
            };
            const H = await openLobby('H');
            const P = await openLobby('P');
            const Q = await openLobby('Q');

            // --- La sala ---
            assert(await H.isVisible('#mpTagFormato .tg-formato[data-formato="2v2"]'), 'Nel Tag Team si sceglie il formato prima di aprire la stanza');
            await H.click('#mpTagFormato .tg-formato[data-formato="2v2"]');
            await H.click('#mpCreateBtn');
            await H.waitForFunction(() => /^[A-Z0-9]{5}$/.test((document.getElementById('mpTagCodiceTesto') || {}).textContent || ''), null, { timeout: 15000 });
            const code = (await H.textContent('#mpTagCodiceTesto')).trim();
            for (const g of [P, Q]) {
                await g.click('#mpTabJoin');
                await g.fill('#mpJoinCode', code);
                await g.click('#mpJoinBtn');
                await g.waitForSelector('#mpTagSala .tg-posto', { timeout: 20000 });
            }
            const posti = (page) => page.evaluate(() => MpTagSala._stato().stato.posti);
            const sala = (page) => page.evaluate(() => MpTagSala._stato());
            const ids = await Promise.all([H, P, Q].map((p) => p.evaluate(() => MpTagSala._stato().io)));
            const [idH, idP, idQ] = ids;
            assert((await posti(H)).A0 === idH, 'L\'host apre la stanza seduto nel primo posto');

            // Ognuno si siede da sé in un posto libero.
            await P.click('#mpTagSala [data-posto="B0"] button');
            await H.waitForFunction((id) => MpTagSala._stato().stato.posti.B0 === id, idP, { timeout: 10000 });
            await Q.waitForFunction((id) => MpTagSala._stato().stato.posti.B0 === id, idP, { timeout: 10000 });
            await Q.click('#mpTagSala [data-posto="A1"] button');
            await H.waitForFunction((id) => MpTagSala._stato().stato.posti.A1 === id, idQ, { timeout: 10000 });

            // L'host sistema le coppie: sposta P sul posto di Q (si scambiano).
            await H.click('#mpTagSala [data-posto="B0"] button:has-text("Sposta")');
            await H.click('#mpTagSala [data-posto="A1"] button:has-text("Scambia qui")');
            for (const g of [H, P, Q]) {
                await g.waitForFunction(([p, q]) => {
                    const s = MpTagSala._stato().stato;
                    return s && s.posti.A1 === p && s.posti.B0 === q && s.posti.B1 === null;
                }, [idP, idQ], { timeout: 10000 });
            }
            const testoIA = await Q.textContent('#mpTagSala [data-posto="B1"]');
            assert(/IA/.test(testoIA), 'Il posto rimasto vuoto lo gioca l\'IA, e tutti lo vedono: ' + testoIA);

            // Regola dello scambio scelta dall'host, vista da tutti.
            await H.selectOption('#mpTagSala select[aria-label="Turni nella squadra"]', 'libero');
            await P.waitForFunction(() => MpTagSala._stato().stato.scambio === 'libero', null, { timeout: 10000 });
            assert(await P.isDisabled('#mpTagSala select[aria-label="Turni nella squadra"]'), 'Le regole le cambia solo l\'host');

            // Pronti: si parte solo quando lo sono tutti.
            await P.click('#mpTagPronto');
            await Q.click('#mpTagPronto');
            await H.waitForFunction(() => {
                const s = MpTagSala._stato().stato;
                return Object.keys(s.persone).filter((k) => s.persone[k].pronto).length === 2;
            }, null, { timeout: 10000 });
            assert(!(await sala(H)).avviata, 'Con l\'host non ancora pronto non si parte');
            await H.click('#mpTagPronto');

            // --- Il duello ---
            const duelloAcceso = (page) => page.waitForFunction(
                () => window.MP_PASSO_COMUNE === true && typeof PassoComune !== 'undefined' && PassoComune.attivo()
                    && PassoComune.posti() && window.TagTeam && TagTeam.eSquadra('player') && TagTeam.eSquadra('bot')
                    && gameState.playerHand.length >= 5 && gameState.botHand.length >= 5,
                null, { timeout: 60000 }
            );
            await Promise.all([H, P, Q].map(duelloAcceso));
            await Promise.all([H, P, Q].map((p) => p.evaluate(() => { window.DuelEngineUI = null; })));

            const squadreViste = await Promise.all([H, P, Q].map((p) => p.evaluate(() => ({
                mia: PassoComune.posti().miaSquadra,
                // Chi gioca ogni membro visto da qui.
                membri: ['player', 'bot'].map((posto) => TagTeam.riassunto(posto).membri.map((m) => m.controllore + '/' + m.natura).join(','))
            }))));
            assert(squadreViste[0].mia === 'A' && squadreViste[1].mia === 'A' && squadreViste[2].mia === 'B', 'H e P nella squadra A, Q nella B: ' + JSON.stringify(squadreViste));
            assert(squadreViste[0].membri[1] === 'remoto/persona,ia/ia', 'Sull\'host il secondo avversario è l\'IA che gira qui: ' + squadreViste[0].membri[1]);
            assert(squadreViste[2].membri[0] === 'persona/persona,remoto/ia', 'Per Q il compagno IA gira altrove: ' + squadreViste[2].membri[0]);

            const tutti = [H, P, Q];
            const nomi = ['H', 'P', 'Q'];
            const fotografia = (page) => page.evaluate(() => ({
                turno: gameState.turn, fase: gameState.phase, diTurno: gameState.currentPlayer,
                controllore: Tavolo.controllore(gameState.currentPlayer), nonFermo: PassoComune.motivoNonFermo(), passo: PassoComune.stato(),
                fine: !!gameState.gameOver
            }));
            const impronta = (page) => page.evaluate(() => PassoComune.impronta());

            /** La pagina in cui tocca a una persona, ferma nella Main Phase 1 (le altre la stanno aspettando). */
            const prossimaPersona = async () => {
                const limite = Date.now() + 90000;
                while (Date.now() < limite) {
                    for (let i = 0; i < tutti.length; i++) {
                        const ok = await tutti[i].evaluate(() => !gameState.gameOver && gameState.currentPlayer === 'player'
                            && Tavolo.controllore('player') === 'persona' && gameState.phase === 'main1' && PassoComune.fermo());
                        if (ok) return i;
                    }
                    if (await H.evaluate(() => !!gameState.gameOver)) return -1;
                    await H.waitForTimeout(300);
                }
                const f = await Promise.all(tutti.map(fotografia));
                throw new Error('Nessuna persona arriva al suo turno: ' + JSON.stringify(f));
            };

            let richiestaFatta = false;
            let turniGiocati = 0;
            const chiHaGiocato = new Set();
            while (turniGiocati < TURNI_PERSONA) {
                const i = await prossimaPersona();
                if (i === -1) break;
                const page = tutti[i];
                const turno = await page.evaluate(() => gameState.turn);
                // Tutti e tre allo stesso punto, fermi: stesso stato.
                await Promise.all(tutti.map((p) => p.waitForFunction((t) => gameState.turn === t && gameState.phase === 'main1'
                    && PassoComune.fermo() && PassoComune.stato().inArrivo === 0, turno, { timeout: 40000 })));
                await H.waitForTimeout(300);
                const impronte = await Promise.all(tutti.map(impronta));
                assert(impronte.every((x) => x === impronte[0]), `Turno ${turno}: le tre partite devono essere identiche.\n  ` + impronte.map((x, k) => nomi[k] + ': ' + x).join('\n  '));
                chiHaGiocato.add(nomi[i]);

                // Una mossa vera, poi la richiesta di scambio (una volta, da un membro della squadra A), poi fine turno.
                await page.evaluate(() => {
                    const mano = gameState.playerHand;
                    const k = mano.findIndex((c) => c && c.type === 'monster' && !c.extraDeck && (c.level || 0) <= 4
                        && DuelEngine.normalSummonBlockReason('player', c) === null);
                    const casella = gameState.playerMonsterField.findIndex((s) => !s);
                    if (k !== -1 && casella !== -1 && !gameState.hasNormalSummoned) summonMonster(mano[k], casella, 'attack', k);
                });
                await page.waitForFunction(() => PassoComune.fermo(), null, { timeout: 30000 });
                if (!richiestaFatta && (nomi[i] === 'H' || nomi[i] === 'P')) {
                    richiestaFatta = await page.evaluate(() => TagTeam.chiediScambio('player') !== null);
                }
                await page.waitForTimeout(400);
                await page.evaluate(() => endTurn());
                await page.waitForTimeout(1500);
                await page.evaluate(() => {
                    const p = gameState.pendingHandDiscard;
                    if (!p) return;
                    p.selected = gameState.playerHand.map((_, k) => k).slice(-p.needed);
                    performHandDiscard();
                });
                turniGiocati++;
            }
            assert(turniGiocati >= 4, 'Almeno quattro turni giocati da persone: ' + turniGiocati);
            assert(chiHaGiocato.size >= 2, 'Hanno giocato almeno due persone diverse: ' + Array.from(chiHaGiocato).join(','));

            // La risposta alla richiesta di scambio è la stessa ovunque (per Q la squadra A è l'avversario).
            assert(richiestaFatta, 'Una richiesta di scambio è partita');
            const risposte = await Promise.all(tutti.map((p) => p.evaluate(() => {
                const r = TagTeam.riassunto(PassoComune.postoDelMotore('A'));
                return JSON.stringify(r && r.ultimaRisposta ? { accetta: r.ultimaRisposta.accetta, gioca: r.ultimaRisposta.gioca, turno: r.ultimaRisposta.turno } : null);
            })));
            assert(risposte[0] !== 'null' && risposte.every((x) => x === risposte[0]), 'La risposta del compagno arriva uguale a tutti: ' + risposte.join(' | '));

            assert(divergenze.length === 0, `Il passo comune ha segnalato problemi:\n  ${divergenze.join('\n  ')}`);
            assert(pageErrors.length === 0, `Errori nelle pagine:\n  ${pageErrors.join('\n  ')}`);
        } finally {
            await context.close();
            await room.close();
            await statics.close();
        }
    }
};
