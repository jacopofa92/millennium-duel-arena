// La morra cinese del Multiplayer: chi vince sceglie, e il pannello si
// chiude su ENTRAMBI gli schermi.
// =====================================================================
// Segnalato dall'utente giocando su due dispositivi: alla fine della morra
// ognuno doveva premere il proprio "Inizia il duello", e chi non l'aveva
// ancora premuto restava fermo davanti al pannello mentre l'altro era già in
// partita. Ora il vincitore sceglie ("Comincio io" / "Comincia lui", come
// contro l'IA), la scelta viaggia su un messaggio 'rps' col campo
// `iniziaChiManda` (js/multiplayer/mp-lobby.js, js/ui/duel-rps.js), e chi ha
// perso vede il pannello chiudersi da solo.
//
// Qui il vincitore sceglie di far cominciare L'ALTRO apposta: con "Comincio
// io" il risultato coinciderebbe con la regola vecchia ("chi vince
// comincia") e il test non distinguerebbe la scelta viaggiata dal ripiego.
// Verificato al contrario: senza l'invio della scelta il pannello di chi ha
// perso resta aperto.
//
// standalone: due pagine sue, come gli altri spec Multiplayer.
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

module.exports = {
    name: 'Multiplayer: la morra cinese si chiude su entrambi appena il vincitore sceglie chi comincia',
    standalone: true,
    async run({ browser, assert }) {
        const statics = await startStaticServer();
        const room = await startRoomServer();
        const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' });
        const pageErrors = [];
        try {
            const openLobby = async (label) => {
                const page = await context.newPage();
                page.on('pageerror', (err) => pageErrors.push(`[${label}] ${err.message}`));
                // Niente DUEL_RPS_SKIP: la morra è proprio quello che si prova.
                await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.SALA_CLASSICA = true; });
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

            // Dopo il conto alla rovescia, la morra su entrambi.
            await pageA.waitForSelector('#duelRpsOverlay .rps-choice', { timeout: 20000 });
            await pageB.waitForSelector('#duelRpsOverlay .rps-choice', { timeout: 20000 });
            // Sasso batte forbice: vince A, niente pareggio da rigiocare.
            await pageA.click('#duelRpsOverlay .rps-choice[data-choice="sasso"]');
            await pageB.click('#duelRpsOverlay .rps-choice[data-choice="forbice"]');

            // A ha vinto e vede le due scelte; B legge che A sta scegliendo
            // e non ha pulsanti da premere.
            await pageA.waitForFunction(() => {
                const b = document.querySelector('#duelRpsOverlay [data-role="actSecondary"]');
                return b && b.style.visibility === 'visible' && /Comincia lui/.test(b.textContent);
            }, null, { timeout: 10000 });
            const attesaB = await pageB.waitForFunction(() => {
                const sub = document.querySelector('#duelRpsOverlay [data-role="resultSub"]');
                return sub && /sta scegliendo/.test(sub.textContent) ? sub.textContent : null;
            }, null, { timeout: 10000 });
            assert(!!(await attesaB.jsonValue()), 'Chi ha perso deve leggere che il vincitore sta scegliendo');
            const pulsanteB = await pageB.evaluate(() => {
                const p = document.querySelector('#duelRpsOverlay [data-role="actPrimary"]');
                return p ? getComputedStyle(p).visibility : 'assente';
            });
            assert(pulsanteB === 'hidden', `Chi ha perso non deve avere un pulsante da premere (visibilità: ${pulsanteB})`);

            // A sceglie di far cominciare B. Nessun click su B.
            await pageA.click('#duelRpsOverlay [data-role="actSecondary"]');
            await Promise.all([pageA, pageB].map((p) => p.waitForFunction(
                () => !document.getElementById('duelRpsOverlay'), null, { timeout: 8000 })));

            // Le due partite partono d'accordo: comincia B.
            const pronto = (page) => page.waitForFunction(
                () => window.MULTIPLAYER_MODE === true && typeof gameState !== 'undefined'
                    && Array.isArray(gameState.playerHand) && gameState.playerHand.length >= 5,
                null, { timeout: 45000 });
            await Promise.all([pronto(pageA), pronto(pageB)]);
            const [chiA, chiB] = await Promise.all([pageA, pageB].map((p) => p.evaluate(() => gameState.currentPlayer)));
            assert(chiA === 'bot' && chiB === 'player',
                `Il vincitore ha fatto cominciare l'altro: di qua deve risultare 'bot', di là 'player' (A: ${chiA}, B: ${chiB})`);

            assert(pageErrors.length === 0, `Errori nelle pagine:\n  ${pageErrors.join('\n  ')}`);
        } finally {
            await context.close();
            await room.close();
            await statics.close();
        }
    }
};
