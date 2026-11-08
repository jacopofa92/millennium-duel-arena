// Multiplayer: l'avversario se ne va MENTRE si è ancora in sala d'attesa.
// =====================================================================
// Compagno di multiplayer-end-to-end.spec.js, che copre il duello già
// avviato. Qui si resta prima: nella lobby, dove il protocollo è lo
// stesso ma a gestirlo è js/multiplayer/mp-lobby.js invece di
// js/multiplayer/multiplayer.js — e proprio quella divisione era il buco.
//
// IL BUG CHE QUESTO TEST GUARDA. mp-lobby.js non ascoltava affatto
// 'opponent-left'/'opponent-disconnected': quegli eventi li gestiva solo
// multiplayer.js, che però viene caricato SOLO quando il duello è già
// partito. Chiudendo la scheda dell'avversario, la sala dell'altro
// restava a mostrare "Pronto", "2/2 duellanti", e l'invito "tocca a te" —
// e premendo "Sono pronto" partiva un duello intero contro nessuno, da cui
// si usciva solo ricaricando la pagina. In più, nessuno chiamava mai
// net.leaveRoom(): il server teneva il posto occupato per 45 secondi
// (RECONNECT_GRACE_MS) aspettando un rientro impossibile, perché il
// playerId per il 'rejoin-room' vive solo in memoria e muore con la pagina.
//
// `standalone: true` (vedi tests/run-all.js): come lo spec end-to-end,
// questo non vuole la pagina già aperta sul duello — se ne costruisce due.
// Serve un server HTTP vero per le stesse ragioni spiegate lì.
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

module.exports = {
    name: 'Multiplayer: l\'avversario che lascia la sala libera il posto',
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
                }, { timeout: 15000 });
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
            }, { timeout: 15000 });
            const code = (await pageA.textContent('#mpRoomCodeValue')).trim();
            await pageB.click('#mpTabJoin');
            await pageB.fill('#mpJoinCode', code);
            await pageB.click('#mpJoinBtn');
            await pageA.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
            await pageB.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });

            // Se ne va A, cioè proprio chi ha creato la stanza, e se ne va
            // DOPO essersi dichiarato pronto: è la sequenza peggiore delle
            // due possibili — lasciava B a un solo click da un duello
            // fantasma, e in più senza più nessun padrone di casa.
            await pageA.click('#mpReadyBtn');
            await pageB.waitForFunction(
                () => document.getElementById('mpReadyOpp').classList.contains('is-pronto'),
                { timeout: 10000 }
            );
            await pageA.close();

            // Il posto deve tornare libero SUBITO, non dopo la finestra di
            // grazia del server: chiudere una scheda non è una caduta di
            // linea da cui si rientra.
            await pageB.waitForFunction(
                () => document.getElementById('mpOccupancy').textContent.trim() === '1',
                { timeout: 15000 }
            );
            const sala = await pageB.evaluate(() => ({
                postoPieno: !!document.querySelector('#mpSeatOpponent.mp-seat--filled'),
                ruoloAvversario: document.getElementById('mpSeatOppRole').textContent.trim(),
                spiaAvversarioAccesa: document.getElementById('mpReadyOpp').classList.contains('is-pronto'),
                barraPronto: !document.getElementById('mpReadyBar').hidden,
                stato: document.getElementById('mpStatus').textContent,
                ruoloMio: document.getElementById('mpSeatYouRole').textContent.trim(),
                notaSetup: document.getElementById('mpSetupNote').textContent.trim()
            }));
            assert(!sala.postoPieno, 'Il posto dell\'avversario deve tornare vuoto quando lascia la sala');
            assert(sala.ruoloAvversario === 'Posto libero', `Il posto deve tornare a dirsi libero (ottenuto: "${sala.ruoloAvversario}")`);
            assert(!sala.spiaAvversarioAccesa, 'La sua dichiarazione di prontezza deve andarsene con lui, o resterebbe accesa per nessuno');
            assert(!sala.barraPronto, 'Senza avversario la barra "Pronto" non ha più senso e deve sparire');
            assert(/lasciat/i.test(sala.stato), `Il giocatore deve essere avvisato che l'altro se n'è andato (stato: "${sala.stato}")`);

            // Chi resta eredita la stanza. Arena e musica le sceglie l'host
            // e le TRASMETTE: una stanza rimasta senza padrone di casa
            // manderebbe i due prossimi duellanti in due arene diverse, ognuno
            // ad aspettare invano le impostazioni dell'altro.
            assert(sala.ruoloMio === 'Padrone di casa',
                `Andandosene l'host, chi resta deve ereditare la stanza (ottenuto: "${sala.ruoloMio}")`);
            assert(/scegli tu/i.test(sala.notaSetup),
                `Il nuovo padrone di casa deve poter scegliere arena e musica (nota: "${sala.notaSetup}")`);

            // E il duello non deve poter partire: era questo il danno vero.
            await pageB.evaluate(() => {
                const btn = document.getElementById('mpReadyBtn');
                if (btn) btn.click(); // click diretto: il pulsante ora è nascosto insieme alla barra
            });
            await pageB.waitForTimeout(3000);
            const partito = await pageB.evaluate(() => ({
                inDuello: window.MULTIPLAYER_MODE === true,
                arenaCaricata: typeof gameState !== 'undefined'
            }));
            assert(!partito.inDuello && !partito.arenaCaricata,
                'Dichiararsi pronti da soli non deve far partire un duello contro nessuno');

            assert(pageErrors.length === 0, `Errori JS non gestiti nella sala d'attesa: ${pageErrors.join(' | ')}`);
        } finally {
            await context.close();
            await room.close();
            await statics.close();
        }
    }
};
