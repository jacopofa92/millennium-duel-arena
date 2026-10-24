// Multiplayer: nome e avatar dell'avversario in sala e nel duello.
// =====================================================================
// Segnalato giocando: in sala non si vedeva il nome dell'avversario, nel duello usciva "Bot" e a fine duello "undefined" al posto
// del nome. Due cause:
//  1. in js/duel-session.js la voce GENERIC_OPPONENTS.multiplayer era finita dentro un commento (due "\n" letterali nel testo:
//     la riga restava una sola) — quindi mancava del tutto, e l'avversario online ricadeva sul Bot (e senza nome nella schermata
//     finale);
//  2. il nome non viaggiava: il messaggio "pronto" portava la pedina ma non il nome del profilo.
// Qui: due giocatori con due profili diversi (due contesti, o condividerebbero il salvataggio), la sala mostra il nome dell'altro,
// e nel duello DuelSession.opponent ha quel nome (non "Bot", non undefined) e il suo pannello lo scrive.
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

module.exports = {
    name: 'Multiplayer: il nome dell\'avversario si vede in sala e nel duello',
    standalone: true,
    async run({ browser, assert }) {
        const statics = await startStaticServer();
        const room = await startRoomServer();
        const errori = [];
        const contexts = [];
        try {
            const apri = async (etichetta, nome) => {
                const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
                contexts.push(context);
                const page = await context.newPage();
                page.on('pageerror', (e) => errori.push(`[${etichetta}] ${e.message}`));
                await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_RPS_SKIP = true; window.DUEL_FAST_OPENING = true; });
                await page.goto(statics.origin + '/multiplayer.html', { waitUntil: 'load' });
                await page.waitForSelector('#mpCreateBtn');
                await page.waitForFunction(() => { const el = document.getElementById('pageLoader'); return !el || el.classList.contains('page-loader-hidden'); }, { timeout: 15000 });
                await page.evaluate((n) => { SaveManager.createNew(n); const av = document.querySelector('.mp-advanced'); if (av) av.open = true; }, nome);
                return page;
            };
            const A = await apri('A', 'Yugi Prova');
            const B = await apri('B', 'Kaiba Prova');
            await A.fill('#mpServerUrl', room.wsUrl);
            await B.fill('#mpServerUrl', room.wsUrl);
            await A.click('#mpCreateBtn');
            await A.waitForFunction(() => { const el = document.getElementById('mpRoomCodeValue'); return el && /^[A-Z0-9]{5}$/.test(el.textContent.trim()); }, { timeout: 15000 });
            const code = (await A.textContent('#mpRoomCodeValue')).trim();
            await B.click('#mpTabJoin');
            await B.fill('#mpJoinCode', code);
            await B.click('#mpJoinBtn');
            await A.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
            await B.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });

            // --- In sala: ognuno legge il nome dell'altro, e il tondo ha una pedina (mai vuoto)
            await A.waitForFunction(() => document.getElementById('mpSeatOppName').textContent.trim() === 'Kaiba Prova', null, { timeout: 10000 });
            await B.waitForFunction(() => document.getElementById('mpSeatOppName').textContent.trim() === 'Yugi Prova', null, { timeout: 10000 });
            const sala = await A.evaluate(() => { const av = document.getElementById('mpSeatOppAvatar'); return { img: av.classList.contains('mp-seat-avatar--img'), bg: av.style.backgroundImage }; });
            assert(sala.img && /url\(/.test(sala.bg), `in sala l'avversario deve avere il suo avatar: ${JSON.stringify(sala)}`);

            // --- Nel duello: DuelSession.opponent ha il nome vero
            await A.click('#mpReadyBtn');
            await B.click('#mpReadyBtn');
            for (const [pagina, atteso] of [[A, 'Kaiba Prova'], [B, 'Yugi Prova']]) {
                await pagina.waitForFunction(() => window.DuelSession && DuelSession.opponent && typeof gameState !== 'undefined', null, { timeout: 90000 });
                const duello = await pagina.evaluate(() => ({ nome: DuelSession.opponent.name, immagine: DuelSession.opponent.image, pannello: (document.getElementById('botInfo') || {}).textContent || '' }));
                assert(duello.nome === atteso, `nel duello l'avversario deve chiamarsi "${atteso}" (non Bot, non undefined): ${JSON.stringify(duello)}`);
                assert(!!duello.immagine, 'l\'avversario deve avere un\'immagine');
                assert(duello.pannello.includes(atteso), `il suo pannello deve scrivere il nome: "${duello.pannello.trim().slice(0, 80)}"`);
            }
            assert(errori.length === 0, `Errori JS: ${errori.join(' | ')}`);
        } finally {
            for (const c of contexts) await c.close().catch(() => {});
            await room.close();
            await statics.close();
        }
    }
};
