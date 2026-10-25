// Ra - Fenice della Divinita' Egizia (id 1276): "Una volta per turno, durante la End Phase: manda questa carta al Cimitero e, se lo fai,
// Evoca Specialmente 1 Modalita' Sfera". Il testo non dice "tua": vale per la End Phase di OGNI giocatore (lo confermano le fonti
// ufficiali: scatta ad ogni End Phase, di chiunque). Qui si prova la End Phase dell'AVVERSARIO con un vero cambio di turno: la
// Sfera compare in mano SOLO durante il turno del bot (alla End Phase del giocatore non c'e' nessuna Sfera, quindi li' non scatta
// nulla), e alla fine del turno del bot la Fenice deve scambiarsi lo stesso.
const path = require('path');
const URL = 'file:///' + path.join(__dirname, '..', '..', 'duelMonstersCore.html').replace(/\\/g, '/');

module.exports = {
    standalone: true,
    name: 'Fenice di Ra: lo scambio con la Sfera scatta anche nella End Phase dell\'avversario',
    async run(t) {
        const page = await t.browser.newPage({ viewport: { width: 1366, height: 820 } });
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true; });
        try {
            await page.goto(URL);
            await page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.playerHand && gameState.playerHand.length > 0 && window.DuelEngine, null, { timeout: 40000 });
            await page.waitForTimeout(3500);

            await page.evaluate(() => {
                const mk = (id, uid) => { const c = JSON.parse(JSON.stringify(cardDatabase.find((x) => x.id === id))); c.uid = uid; return c; };
                gameState.phase = 'main1'; gameState.currentPlayer = 'player'; gameState.hasNormalSummoned = false;
                gameState.playerHand.length = 0;
                gameState.playerMonsterField.fill(null); gameState.botMonsterField.fill(null);
                gameState.playerSTField.fill(null); gameState.botSTField.fill(null);
                gameState.playerMonsterField[0] = { card: mk(1276, 'FENICE'), position: 'defense', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedOnTurn: 0 };
                // Il bot non deve poter attaccare la Fenice ne' Evocare mostri: mano e mazzo di sole Trappole.
                gameState.botHand = [mk(10, 'b-mano')];
                gameState.botDeck = Array.from({ length: 12 }, (_, i) => mk(10, 'b-mazzo-' + i));
                updateUI();
            });
            const dove = () => page.evaluate(() => ({
                turno: gameState.turn, di: gameState.currentPlayer,
                fenice: gameState.playerMonsterField.some((s) => s && s.card.id === 1276),
                sfera: gameState.playerMonsterField.some((s) => s && s.card.id === 1275),
                feniceNelCimitero: gameState.playerGraveyard.some((c) => c.id === 1276)
            }));

            // Fine del MIO turno: nessuna Sfera da nessuna parte, quindi la Fenice resta dov'e'.
            await page.waitForTimeout(2000);
            await page.evaluate(() => endTurn());
            await page.waitForFunction(() => gameState.currentPlayer === 'bot', null, { timeout: 30000 });
            const inizioTurnoBot = await dove();
            t.assert(inizioTurnoBot.fenice && !inizioTurnoBot.sfera, `senza Sfera disponibile la Fenice resta in campo: ${JSON.stringify(inizioTurnoBot)}`);

            // Durante il turno del bot compare la Sfera nella mia mano.
            await page.evaluate(() => {
                const c = JSON.parse(JSON.stringify(cardDatabase.find((x) => x.id === 1275))); c.uid = 'SFERA-TARDI';
                gameState.playerHand.push(c);
            });

            // Alla fine del turno del bot la Fenice si scambia con la Sfera.
            let finale = null;
            const scadenza = Date.now() + 120000;
            while (Date.now() < scadenza) {
                await page.waitForTimeout(1500);
                await page.evaluate(() => { document.querySelectorAll('.modal-backdrop.open').forEach((m) => m.classList.remove('open')); });
                const d = await dove();
                if (d.turno >= 3 && d.di === 'player') { finale = d; break; }
            }
            t.assert(finale, 'il turno del bot e\' finito');
            t.assert(finale.sfera && !finale.fenice && finale.feniceNelCimitero,
                `alla End Phase dell'avversario la Fenice e' andata al Cimitero e la Sfera e' in campo: ${JSON.stringify(finale)}`);
            t.assert(errori.length === 0, `Nessun errore in pagina: ${JSON.stringify(errori)}`);
        } finally {
            await page.close();
        }
    }
};
