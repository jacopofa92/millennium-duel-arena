// Multiplayer a passo comune: la somma di Life Point che si sceglie di pagare per Ra (id 472) arriva sull'altro client.
// =====================================================================
// La scelta ("quanti LP pago?", maybeAskRaLpChoice in actions.js) e' un NUMERO dentro il comando 'evoca' (`pagaLpRa`): chi riceve
// il comando la rimette su card._raPayLp e l'effetto di Ra la legge (CardEffects.register(472).onSummon). Qui si prova con due
// pagine vere e il relay vero: A Evoca Ra tributando tre mostri e paga 3000, e su ENTRAMBI i lati devono risultare gli stessi LP,
// lo stesso bonus ATK/DEF e la stessa impronta della partita (nessuna divergenza).
//
// Lo stato di partenza (Ra in mano, tre mostri in campo) lo si scrive IDENTICO su entrambi i client — stesso uid, stesse carte —
// perche' a passo comune i due conoscono ogni mano: cambiarlo solo da una parte separerebbe le due partite.
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

module.exports = {
    name: 'Multiplayer: la somma pagata per Ra viaggia e i due client restano uguali',
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
                page.on('console', (m) => { if (m.type() === 'error' && m.text().includes('PassoComune')) divergenze.push(`[${label}] ${m.text()}`); });
                await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_RPS_SKIP = true; });
                await page.goto(statics.origin + '/multiplayer.html', { waitUntil: 'load' });
                await page.waitForSelector('#mpCreateBtn');
                await page.waitForFunction(() => { const el = document.getElementById('pageLoader'); return !el || el.classList.contains('page-loader-hidden'); }, null, { timeout: 15000 });
                await page.evaluate(() => { const av = document.querySelector('.mp-advanced'); if (av) av.open = true; });
                await page.fill('#mpServerUrl', room.wsUrl);
                return page;
            };
            const pageA = await openLobby('A');
            const pageB = await openLobby('B');
            await pageA.click('#mpCreateBtn');
            await pageA.waitForFunction(() => { const el = document.getElementById('mpRoomCodeValue'); return el && /^[A-Z0-9]{5}$/.test(el.textContent.trim()); }, null, { timeout: 15000 });
            const code = (await pageA.textContent('#mpRoomCodeValue')).trim();
            await pageB.click('#mpTabJoin');
            await pageB.fill('#mpJoinCode', code);
            await pageB.click('#mpJoinBtn');
            await pageA.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
            await pageB.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
            await pageA.click('#mpReadyBtn');
            await pageB.click('#mpReadyBtn');

            const duelloAcceso = (page) => page.waitForFunction(
                () => window.MP_PASSO_COMUNE === true && typeof PassoComune !== 'undefined' && PassoComune.attivo()
                    && Array.isArray(gameState.botDeck) && gameState.botDeck.length > 0
                    && gameState.playerHand.length >= 5 && gameState.botHand.length >= 5,
                null, { timeout: 45000 });
            await Promise.all([duelloAcceso(pageA), duelloAcceso(pageB)]);
            await Promise.all([pageA, pageB].map((p) => p.evaluate(() => { window.DuelEngineUI = null; })));

            const fermoInMain1 = (page) => page.waitForFunction(
                () => gameState.turn === 1 && gameState.phase === 'main1' && PassoComune.fermo() && PassoComune.stato().inArrivo === 0,
                null, { timeout: 40000 });
            await Promise.all([fermoInMain1(pageA), fermoInMain1(pageB)]);
            await pageA.waitForTimeout(500);

            // Chi e' di turno e' "S" (chi Evoca); l'altro e' "R". Lo stesso stato su due lati: per S e' il proprio campo, per R e' quello dell'avversario.
            const sPage = (await pageA.evaluate(() => gameState.currentPlayer === 'player')) ? pageA : pageB;
            const rPage = sPage === pageA ? pageB : pageA;
            const prepara = (page, lato) => page.evaluate((lato) => {
                const mk = (id, uid) => { const c = JSON.parse(JSON.stringify(cardDatabase.find((x) => x.id === id))); c.uid = uid; return c; };
                const slot = (id, uid) => ({ card: mk(id, uid), position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedOnTurn: 0 });
                const mano = lato === 'mio' ? gameState.playerHand : gameState.botHand;
                const campo = lato === 'mio' ? gameState.playerMonsterField : gameState.botMonsterField;
                mano[0] = mk(472, 'RA-MP');
                campo.fill(null);
                for (let i = 0; i < 3; i++) campo[i] = slot(4, 'TRIB-MP-' + i);
                updateUI();
            }, lato);
            await Promise.all([prepara(sPage, 'mio'), prepara(rPage, 'altrui')]);
            const [i0, i1] = await Promise.all([sPage.evaluate(() => PassoComune.impronta()), rPage.evaluate(() => PassoComune.impronta())]);
            assert(i0 === i1, `prima della mossa i due lati sono identici.\n  S: ${i0}\n  R: ${i1}`);

            // La mossa vera: Tributi (comando 'tributa'), poi l'Evocazione con la somma scelta (3000) nel comando 'evoca'.
            await sPage.evaluate(() => {
                const idx = () => gameState.playerHand.findIndex((c) => c && c.uid === 'RA-MP');
                Comandi.esegui('player', { tipo: 'tributa', indici: [0, 1, 2], perCarta: 'RA-MP', attesaMs: 0 }, {
                    dopo: () => {
                        const i = idx();
                        const ra = gameState.playerHand[i];
                        ra._raPayLp = 3000;   // quello che scrive maybeAskRaLpChoice quando la persona preme "Paga"
                        summonMonster(ra, 0, 'attack', i);
                    }
                });
            });

            const raInCampo = (page, lato) => page.waitForFunction((lato) => {
                const campo = lato === 'mio' ? gameState.playerMonsterField : gameState.botMonsterField;
                return !!(campo[0] && campo[0].card.id === 472) && PassoComune.fermo() && PassoComune.stato().inArrivo === 0;
            }, lato, { timeout: 30000 });
            await Promise.all([raInCampo(sPage, 'mio'), raInCampo(rPage, 'altrui')]);
            await sPage.waitForTimeout(800);

            const leggi = (page, lato) => page.evaluate((lato) => {
                const campo = lato === 'mio' ? gameState.playerMonsterField : gameState.botMonsterField;
                const ra = campo[0].card;
                return {
                    lp: lato === 'mio' ? gameState.playerLP : gameState.botLP,
                    pagati: ra.raPaidLp || 0,
                    atk: DuelEngine.getEffectiveAtk(ra), def: DuelEngine.getEffectiveDef(ra),
                    tributati: campo.slice(1, 3).every((s) => s === null)
                };
            }, lato);
            const [s, r] = await Promise.all([leggi(sPage, 'mio'), leggi(rPage, 'altrui')]);
            assert(s.lp === 5000 && s.pagati === 3000 && s.atk === 3000 && s.def === 3000, `su chi Evoca: 3000 LP pagati, Ra 3000/3000: ${JSON.stringify(s)}`);
            assert(r.lp === 5000 && r.pagati === 3000 && r.atk === 3000 && r.def === 3000, `su chi riceve il comando: stessa somma, stessi LP, stesso bonus: ${JSON.stringify(r)}`);
            assert(s.tributati && r.tributati, 'i tre Tributi sono usciti dal Terreno su entrambi i lati');

            const [fs, fr] = await Promise.all([sPage.evaluate(() => PassoComune.impronta()), rPage.evaluate(() => PassoComune.impronta())]);
            assert(fs === fr, `dopo l'Evocazione le due partite sono identiche.\n  S: ${fs}\n  R: ${fr}`);
            assert(divergenze.length === 0, `Il passo comune ha segnalato problemi:\n  ${divergenze.join('\n  ')}`);
            assert(pageErrors.length === 0, `Errori nelle pagine:\n  ${pageErrors.join('\n  ')}`);
        } finally {
            await context.close();
            await room.close();
            await statics.close();
        }
    }
};
