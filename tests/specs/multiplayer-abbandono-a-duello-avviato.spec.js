// Multiplayer: se l'avversario se ne va A DUELLO AVVIATO, chi resta vince.
// =====================================================================
// La sala d'attesa sapeva già reggere l'uscita dell'altro (vedi
// multiplayer-lobby-abbandono.spec.js). Il duello no: all'arrivo di
// 'opponent-left' compariva un cartello permanente e basta, sopra una
// partita che non poteva più proseguire — l'avversario non avrebbe mai
// più mosso, quindi il turno non sarebbe mai tornato indietro. Nessuna
// schermata finale, nessun premio, nessun risultato: solo un "Torna al
// Menu" da cliccare a mano, come se quella partita non fosse mai esistita.
//
// 'opponent-left' il server lo manda solo quando non c'è più nulla da
// aspettare (uscita volontaria, o finestra di grazia scaduta): la caduta
// di linea momentanea è un altro evento, e quella si continua ad
// aspettare. Quindi qui chi resta ha vinto, esattamente come già succede
// a chi preme Abbandona, visto dall'altra parte.
//
// Chiudere la scheda è la via più realistica per provarlo: fa partire il
// 'pagehide' che manda 'leave-room', quindi il server toglie subito il
// posto invece di tenerlo per i 45 secondi della finestra di grazia.
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

module.exports = {
    name: 'Multiplayer: se l\'avversario se ne va a duello avviato, chi resta vince',
    standalone: true,
    async run({ browser, assert }) {
        const statics = await startStaticServer();
        const room = await startRoomServer();
        const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
        const pageErrors = [];

        try {
            const openLobby = async (label) => {
                const page = await context.newPage();
                page.on('pageerror', (err) => pageErrors.push(`[${label}] ${err.message}`));
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

            const arenaReady = (page) => page.waitForFunction(
                () => window.MULTIPLAYER_MODE === true && typeof gameState !== 'undefined'
                    && typeof DuelEngine !== 'undefined' && Array.isArray(gameState.playerHand)
                    && gameState.playerHand.length >= 5,
                null, { timeout: 40000 }
            );
            await Promise.all([arenaReady(pageA), arenaReady(pageB)]);
            for (const page of [pageA, pageB]) {
                try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
            }

            // Preparazione: il duello dev'essere DAVVERO in corso, o non
            // si starebbe provando nulla.
            const primaDellUscita = await pageA.evaluate(() => gameState.gameOver);
            assert(primaDellUscita !== true,
                'Preparazione: il duello deve essere ancora in corso prima che l\'avversario se ne vada');

            // Con quale esito si chiude il duello lo si legge intercettando
            // endDuel: il pannello del log non è il posto giusto (la
            // schermata finale gli passa sopra, e a duello concluso non è
            // detto che sia ancora leggibile).
            await pageA.evaluate(() => {
                window.__esitoDichiarato = 'nessuno';
                const originale = window.endDuel;
                window.endDuel = function (haVinto) {
                    window.__esitoDichiarato = haVinto;
                    return originale.apply(this, arguments);
                };
            });

            // B se ne va chiudendo la scheda, come farebbe una persona.
            await pageB.close();

            // A deve concludere il duello come VITTORIA. Tetto stretto di
            // proposito: molto sotto i 45 secondi della finestra di grazia,
            // così un test verde non può dipendere da quella.
            await pageA.waitForFunction(() => gameState.gameOver === true, null, { timeout: 12000 })
                .catch(() => { /* ci pensa l'assert qui sotto, con un messaggio leggibile */ });

            const finito = await pageA.evaluate(() => gameState.gameOver === true);
            assert(finito,
                'Chi resta deve vedere il duello concluso, non un cartello sopra una partita che non può più proseguire');

            // E deve averlo VINTO, non semplicemente "finito".
            const esito = await pageA.evaluate(() => window.__esitoDichiarato);
            assert(esito === true,
                `Chi resta deve aver VINTO per abbandono dell'altro (endDuel è stato chiamato con: ${JSON.stringify(esito)})`);

            assert(pageErrors.length === 0, `Errori JS non gestiti: ${pageErrors.join(' | ')}`);
        } finally {
            await context.close();
            await room.close();
            await statics.close();
        }
    }
};
