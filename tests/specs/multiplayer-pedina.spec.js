// Multiplayer: ognuno sceglie la PROPRIA pedina in sala, e quella si vede nel duello.
// =====================================================================
// Oltre a mazzo, arena e musica (richiesta dell'utente): la pedina e' il ritratto con cui ci si presenta. Parte dal
// predefinito ("Te stesso", lo specchio); la scelta viaggia nel messaggio 'ready' come id del personaggio, e ognuno la
// cerca nel proprio elenco. Si vede sul posto in sala, e poi nel duello (angolo, VS, schermata finale) per entrambi.
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

module.exports = {
    name: 'Multiplayer: ognuno sceglie la propria pedina, e l\'avversario la vede in sala e nel duello',
    standalone: true,
    async run({ browser, assert }) {
        const statics = await startStaticServer();
        const room = await startRoomServer();
        const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
        const errori = [];
        try {
            const apri = async (label) => {
                const page = await context.newPage();
                page.on('pageerror', (e) => errori.push(`[${label}] ${e.message}`));
                await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_RPS_SKIP = true; window.DUEL_FAST_OPENING = true; });
                await page.goto(statics.origin + '/multiplayer.html', { waitUntil: 'load' });
                await page.waitForSelector('#mpCreateBtn');
                await page.waitForFunction(() => { const el = document.getElementById('pageLoader'); return !el || el.classList.contains('page-loader-hidden'); }, null, { timeout: 15000 });
                await page.evaluate(() => { const a = document.querySelector('.mp-advanced'); if (a) a.open = true; });
                await page.fill('#mpServerUrl', room.wsUrl);
                return page;
            };
            const A = await apri('A');
            const B = await apri('B');

            await A.click('#mpCreateBtn');
            await A.waitForFunction(() => { const el = document.getElementById('mpRoomCodeValue'); return el && /^[A-Z0-9]{5}$/.test(el.textContent.trim()); }, null, { timeout: 20000 });
            const codice = (await A.textContent('#mpRoomCodeValue')).trim();
            await B.click('#mpTabJoin');
            await B.fill('#mpJoinCode', codice);
            await B.click('#mpJoinBtn');
            await A.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
            await B.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });

            // Predefinito: nessuno ha toccato niente, e il posto avversario mostra lo specchio.
            const predefinita = await A.evaluate(() => document.getElementById('mpSeatYouAvatar').style.backgroundImage);
            assert(/mirror\.jpg/.test(predefinita), 'Senza scelta la pedina e\' quella personale di sempre (lo specchio): ' + predefinita);

            // A sceglie Solomon Muto, B Yugi Muto (entrambi sbloccati dall'inizio).
            const scegli = async (page, id) => {
                await page.click('.mp-pedina-attuale');
                await page.click(`.mp-pedina-voce[data-id="${id}"]`);
            };
            await scegli(A, 'solomonMuto');
            await scegli(B, 'yugiMuto');

            // Ognuno vede la propria pedina sul proprio posto e quella dell'altro sul posto avversario.
            await A.waitForFunction(() => /yugiMuto\.jpg/.test(document.getElementById('mpSeatOppAvatar').style.backgroundImage), null, { timeout: 10000 });
            await B.waitForFunction(() => /solomonMuto\.jpg/.test(document.getElementById('mpSeatOppAvatar').style.backgroundImage), null, { timeout: 10000 });
            const miaA = await A.evaluate(() => document.getElementById('mpSeatYouAvatar').style.backgroundImage);
            assert(/solomonMuto\.jpg/.test(miaA), 'La propria scelta compare sul proprio posto: ' + miaA);

            // Un id inventato non puo' far caricare un'immagine qualunque: si cerca nell'elenco locale.
            const sconosciuta = await A.evaluate(() => MpPedina.risolvi('../../etc/passwd').id);
            assert(sconosciuta === 'player', 'Un id sconosciuto ricade sulla pedina predefinita');

            // Si parte: nel duello ognuno ha la sua pedina e vede quella dell'altro.
            await A.click('#mpReadyBtn');
            await B.click('#mpReadyBtn');
            for (const p of [A, B]) {
                await p.waitForFunction(() => window.DuelSession && DuelSession.player && DuelSession.opponent && typeof gameState !== 'undefined', null, { timeout: 45000 });
            }
            const sessioneA = await A.evaluate(() => ({ io: DuelSession.player.image, lui: DuelSession.opponent.image }));
            const sessioneB = await B.evaluate(() => ({ io: DuelSession.player.image, lui: DuelSession.opponent.image }));
            assert(/solomonMuto/.test(sessioneA.io) && /yugiMuto/.test(sessioneA.lui), 'Nel duello di A: io Solomon, lui Yugi (' + JSON.stringify(sessioneA) + ')');
            assert(/yugiMuto/.test(sessioneB.io) && /solomonMuto/.test(sessioneB.lui), 'Nel duello di B: io Yugi, lui Solomon (' + JSON.stringify(sessioneB) + ')');
            assert(errori.length === 0, 'Nessun errore di pagina: ' + errori.join(' | '));
        } finally {
            await context.close();
            await room.close();
            await statics.close();
        }
    }
};
