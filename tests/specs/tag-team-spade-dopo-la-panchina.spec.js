// Tag Team: Spade Rivelatrici avversarie, il membro che le ha giocate va in panchina e rientra.
// Segnalato giocando: al rientro l'effetto tornava (non si poteva attaccare) ma le spade fisse
// sul campo non si vedevano più. Il motore azzerava il segno "lame atterrate" appena la carta
// lasciava il campo attivo, e niente lo rimetteva: ora lo ricorda la casella della carta
// (spadeAtterrate) e il ricalcolo degli effetti continui lo riporta.
// Si gioca la carta davvero (activateCard) e si aspetta l'atterraggio; lo scambio è quello della variante.
const path = require('path');
const { waitForOpeningCascade } = require('../helpers/harness');

const RADICE = path.join(__dirname, '..', '..');
const DUELLO = 'file:///' + path.join(RADICE, 'duelMonstersCore.html').replace(/\\/g, '/');
const TAG2V2 = DUELLO + '?mode=tag&character=kaiba&character2=pegasus&difficulty=Facile&partner=joey&lp=membro';

module.exports = {
    standalone: true,
    name: 'Tag Team: le Spade Rivelatrici avversarie restano visibili quando il loro membro rientra dalla panchina',
    async run(t) {
        const page = await t.browser.newPage({ viewport: { width: 1400, height: 900 } });
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        await page.addInitScript(() => {
            window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true;
            try { localStorage.setItem('ygoVideoDetail', 'normali'); localStorage.setItem('ygoVideoDetailScelto', '1'); } catch (e) { /* niente storage */ }
        });
        try {
            await page.goto(TAG2V2);
            try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
            await page.waitForFunction(() => typeof gameState !== 'undefined' && window.TagTeam && TagTeam.eSquadra('bot'), null, { timeout: 30000 });
            await waitForOpeningCascade(page);
            await page.waitForFunction(() => gameState.phase === 'main1' && gameState.currentPlayer === 'player', null, { timeout: 30000 });
            await page.evaluate(() => { window.changeTurn = function () {}; window.turnoIA = function () {}; window.DuelEngineUI = null; });

            // Kaiba (davanti nella squadra avversaria) gioca Spade Rivelatrici contro di te.
            const attivata = await page.evaluate(() => {
                const spade = Object.assign({}, cardDatabase.find((c) => c.id === 8), { uid: 'spade-prova' });
                gameState.botHand.push(spade);
                gameState.currentPlayer = 'bot';
                return DuelEngine.activateCard('bot', 'hand', gameState.botHand.length - 1);
            });
            t.assert(attivata !== false, 'Spade Rivelatrici si attiva');
            await page.waitForFunction(() => gameState.revealedSwordsLanded && gameState.revealedSwordsLanded.player === true, null, { timeout: 20000 });
            await page.waitForFunction(() => !DuelEngine.isChainActive(), null, { timeout: 20000 });
            const vista = () => page.evaluate(() => {
                updateUI();
                return { blocco: DuelEngine.isCannotAttackFor ? DuelEngine.isCannotAttackFor('player') : !!gameState.cannotAttackFor.player, segni: document.querySelectorAll('#playerFieldBoard .field-sword-mark').length };
            });
            const prima = await vista();
            t.assert(prima.blocco && prima.segni > 0, 'Spade attive: non puoi attaccare e le spade si vedono: ' + JSON.stringify(prima));

            // Kaiba va in panchina (entra Pegasus): la carta non è più sul campo attivo, niente effetto né spade.
            await page.evaluate(() => TagTeam.scambia('bot', 1));
            const fuori = await vista();
            t.assert(!fuori.blocco && fuori.segni === 0, 'Con Kaiba in panchina le Spade non agiscono e non si vedono: ' + JSON.stringify(fuori));

            // Kaiba rientra: effetto E spade di nuovo, senza una nuova attivazione.
            await page.evaluate(() => TagTeam.scambia('bot', 0));
            const dopo = await vista();
            t.assert(dopo.blocco && dopo.segni > 0, 'Al rientro di Kaiba l\'effetto torna e le spade si vedono di nuovo: ' + JSON.stringify(dopo));
            t.assert(errori.length === 0, 'Errori nella pagina: ' + errori.join(' | '));
        } finally {
            await page.close();
        }
    }
};
