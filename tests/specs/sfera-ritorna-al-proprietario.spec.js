// Ra - Modalita' Sfera (id 1275) Evocata sul Terreno AVVERSARIO: resta li' durante il turno dell'avversario (senza poter attaccare) e
// "passa sotto il controllo del proprietario durante la End Phase del prossimo turno". Si prova con un vero cambio di turno: il bot
// gioca davvero il suo turno (la chiamata diretta dell'handler, come negli altri spec della Sfera, non prova che il motore lo faccia
// scattare alla fase giusta).
const path = require('path');
const URL = 'file:///' + path.join(__dirname, '..', '..', 'duelMonstersCore.html').replace(/\\/g, '/');

module.exports = {
    standalone: true,
    name: 'Modalita\' Sfera sul Terreno avversario: torna al proprietario alla fine del turno dopo',
    async run(t) {
        const page = await t.browser.newPage({ viewport: { width: 1366, height: 820 } });
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true; });
        try {
            await page.goto(URL);
            await page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.playerHand && gameState.playerHand.length > 0 && window.DuelEngine, null, { timeout: 40000 });
            await page.waitForTimeout(3500);

            const dove = () => page.evaluate(() => {
                const trova = (campo) => campo.findIndex((s) => s && s.card.id === 1275);
                const iM = trova(gameState.playerMonsterField), iB = trova(gameState.botMonsterField);
                return {
                    turno: gameState.turn, di: gameState.currentPlayer, fase: gameState.phase,
                    sfera: iM !== -1 ? 'mia' : iB !== -1 ? 'del bot' : 'altrove',
                    attaccato: iB !== -1 ? !!gameState.botMonsterField[iB].hasAttacked : false,
                    ritorno: iB !== -1 ? gameState.botMonsterField[iB].card._sphereReturnAfterTurn : null
                };
            });
            const chiudiScelte = () => page.evaluate(() => {
                document.querySelectorAll('.modal-backdrop.open').forEach((m) => m.classList.remove('open'));
                const p = document.getElementById('quickPopover'); if (p) p.remove();
            });

            // Sfera in mano, Terreno avversario con tre mostri: la Evocazione sceglie da sola l'unico lato possibile.
            await page.evaluate(() => {
                const mk = (id) => { const c = JSON.parse(JSON.stringify(cardDatabase.find((x) => x.id === id))); c.uid = 'SF' + id + '_' + Math.random(); return c; };
                const slot = (id) => ({ card: mk(id), position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedOnTurn: 0 });
                gameState.phase = 'main1'; gameState.currentPlayer = 'player'; gameState.hasNormalSummoned = false;
                gameState.playerHand.length = 0; gameState.playerHand.push(mk(1275));
                gameState.playerMonsterField.fill(null); gameState.botMonsterField.fill(null);
                for (let i = 0; i < 3; i++) gameState.botMonsterField[i] = slot(4);
                updateUI();
                attemptMonsterSummon(gameState.playerHand[0], 0, 0, null);
            });
            for (let i = 0; i < 10; i++) {
                await page.waitForTimeout(500);
                if (!(await page.evaluate(() => !!Decisioni.inSospeso()))) break;
                await page.evaluate(() => Decisioni.rispondi(0));
                await chiudiScelte();
            }
            await page.waitForFunction(() => gameState.botMonsterField.some((s) => s && s.card.id === 1275), null, { timeout: 15000 });
            const iniziale = await dove();
            t.assert(iniziale.sfera === 'del bot' && iniziale.ritorno === iniziale.turno + 1,
                `la Sfera entra sul Terreno avversario e segna il ritorno al turno dopo: ${JSON.stringify(iniziale)}`);

            // Si passa il turno e si lascia giocare il bot. Durante il suo turno la Sfera e' sua ma non attacca.
            await page.waitForTimeout(2500);
            await page.evaluate(() => endTurn());
            let durante = null;
            let finale = null;
            const scadenza = Date.now() + 120000;
            while (Date.now() < scadenza) {
                await page.waitForTimeout(1500);
                await page.evaluate(() => {
                    const p = gameState.pendingHandDiscard;
                    if (p) { p.selected = gameState.playerHand.map((_, i) => i).slice(-p.needed); performHandDiscard(); }
                });
                await chiudiScelte();
                const d = await dove();
                if (d.di === 'bot' && d.sfera === 'del bot') durante = durante || d;
                if (d.di === 'bot' && d.attaccato) t.assert(false, `la Sfera non puo' attaccare: ${JSON.stringify(d)}`);
                if (d.turno >= 3 && d.di === 'player') { finale = d; break; }
            }
            t.assert(durante, 'durante il turno del bot la Sfera sta sul suo Terreno');
            t.assert(finale && finale.sfera === 'mia', `alla fine del turno del bot la Sfera e' tornata a me: ${JSON.stringify(finale)}`);
            t.assert(errori.length === 0, `Nessun errore in pagina: ${JSON.stringify(errori)}`);
        } finally {
            await page.close();
        }
    }
};
