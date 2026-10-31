// Tag Team, regola dell'autore (aggancio A5): non si attacca un avversario che non ha ancora giocato
// il suo primo turno. Il divieto passa da DuelEngine.cannotAttack, lo stesso cancello di Spade
// Rivelatrici: lo leggono il trascinamento dell'attacco, l'IA (bot.js) e la risoluzione dell'attacco.
// 2 contro 2 (tu + Joey contro Kaiba + Pegasus), comincia il giocatore.
const path = require('path');
const { waitForOpeningCascade } = require('../helpers/harness');

const RADICE = path.join(__dirname, '..', '..');
const DUELLO = 'file:///' + path.join(RADICE, 'duelMonstersCore.html').replace(/\\/g, '/');
const TAG2V2 = DUELLO + '?mode=tag&character=kaiba&character2=pegasus&difficulty=Facile&partner=joey&lp=membro';

module.exports = {
    standalone: true,
    name: 'Tag Team: non si attacca un avversario che non ha ancora giocato il suo primo turno',
    async run(t) {
        const page = await t.browser.newPage({ viewport: { width: 1400, height: 900 } });
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        await page.addInitScript(() => {
            window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true; window.DUEL_STARTING_ROLE = 'player';
            try { localStorage.setItem('ygoVideoDetail', 'normali'); localStorage.setItem('ygoVideoDetailScelto', '1'); } catch (e) { /* niente storage */ }
        });
        try {
            await page.goto(TAG2V2);
            try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
            await page.waitForFunction(() => typeof gameState !== 'undefined' && window.TagTeam && TagTeam.eSquadra('bot'), null, { timeout: 30000 });
            await waitForOpeningCascade(page);
            await page.waitForFunction(() => gameState.phase === 'main1' && gameState.currentPlayer === 'player', null, { timeout: 30000 });
            await page.evaluate(() => { window.changeTurn = function () {}; window.turnoIA = function () {}; window.DuelEngineUI = null; });

            const stato = () => page.evaluate(() => ({
                tu: DuelEngine.cannotAttack('player'),
                loro: DuelEngine.cannotAttack('bot'),
                giocatiBot: TagTeam.riassunto('bot').membri.map((m) => m.giocato),
                giocatiTuoi: TagTeam.riassunto('player').membri.map((m) => m.giocato)
            }));

            const inizio = await stato();
            t.assert(JSON.stringify(inizio.giocatiTuoi) === '[true,false]' && JSON.stringify(inizio.giocatiBot) === '[false,false]',
                'All\'inizio ha giocato solo chi comincia: ' + JSON.stringify(inizio));
            t.assert(inizio.tu === true, 'Kaiba non ha ancora giocato: non lo puoi attaccare');

            // Turno di Kaiba: entra per il suo turno e ora ha giocato. Lui può attaccare te (hai giocato).
            await page.evaluate(() => { gameState.currentPlayer = 'bot'; gameState.turn = 2; EventiDuello.emetti('inizio-turno', 'bot'); });
            const dopoKaiba = await stato();
            t.assert(dopoKaiba.giocatiBot[0] === true && dopoKaiba.loro === false, 'Kaiba ha giocato e può attaccare te, che hai già giocato: ' + JSON.stringify(dopoKaiba));

            // Se davanti c'è Joey (non ha ancora giocato), Kaiba non può attaccare.
            await page.evaluate(() => TagTeam.scambia('player', 1));
            t.assert((await stato()).loro === true, 'Davanti c\'è Joey, che non ha ancora giocato: Kaiba non può attaccare');
            await page.evaluate(() => TagTeam.scambia('player', 0));

            // Tuo turno 3 (gioca Joey, a turno): Kaiba davanti ha giocato, Pegasus no.
            await page.evaluate(() => { gameState.currentPlayer = 'player'; gameState.turn = 3; EventiDuello.emetti('inizio-turno', 'player'); });
            const turno3 = await page.evaluate(() => ({ attivo: TagTeam.riassunto('player').attivo, botAttivo: TagTeam.riassunto('bot').attivo }));
            if (turno3.botAttivo !== 0) await page.evaluate(() => TagTeam.scambia('bot', 0));
            t.assert((await stato()).tu === false, 'Contro Kaiba, che ha giocato, si attacca: ' + JSON.stringify(turno3));
            await page.evaluate(() => TagTeam.scambia('bot', 1));
            t.assert((await stato()).tu === true, 'Contro Pegasus, che non ha ancora giocato, no');

            // Pegasus gioca il suo turno: da lì in poi si può attaccare anche lui.
            await page.evaluate(() => { gameState.currentPlayer = 'bot'; gameState.turn = 6; EventiDuello.emetti('inizio-turno', 'bot'); });
            const dopoPegasus = await stato();
            t.assert(dopoPegasus.giocatiBot.every(Boolean), 'Dopo il suo turno anche Pegasus ha giocato: ' + JSON.stringify(dopoPegasus));
            await page.evaluate(() => { gameState.currentPlayer = 'player'; gameState.turn = 7; if (TagTeam.riassunto('bot').attivo !== 1) TagTeam.scambia('bot', 1); });
            t.assert((await stato()).tu === false, 'Ora anche contro Pegasus si attacca');
            t.assert(errori.length === 0, 'Errori nella pagina: ' + errori.join(' | '));
        } finally {
            await page.close();
        }
    }
};
