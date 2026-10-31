// Tag Team, fase 2 (docs/planning/PIANO_TAG_TEAM.md): Boss a squadre e scambio "su richiesta" (D2 libero).
// Cosa si controlla:
//  1) Boss a squadre (&boss=1): il Boss ha tagDatabase.lpBoss Life Point (anche quelli mostrati), la coppia
//     4000 a testa; con la regola "a turno" non si può chiedere uno scambio (né pulsante né API);
//  2) scambio su richiesta (&scambio=libero), a duello fermo, col pulsante vero del riquadro: chiedere e
//     ritirare; il compagno ACCETTA quando a chi giocherebbe conviene (Life Point e carte in mano almeno pari)
//     e gioca chi ha chiesto; RIFIUTA quando no e si va a turno; si può chiedere anche "gioca tu"; la risposta
//     compare a schermo.
const path = require('path');
const { waitForOpeningCascade } = require('../helpers/harness');

const RADICE = path.join(__dirname, '..', '..');
const DUELLO = 'file:///' + path.join(RADICE, 'duelMonstersCore.html').replace(/\\/g, '/');
const BOSS = DUELLO + '?mode=tag&character=kaiba&boss=1&difficulty=Difficile&partner=joey&lp=membro';
const LIBERO = DUELLO + '?mode=tag&character=kaiba&difficulty=Facile&partner=joey&lp=membro&scambio=libero';

const PRELUDIO = () => {
    window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true;
    try {
        localStorage.setItem('ygoVideoDetail', 'normali');
        localStorage.setItem('ygoVideoDetailScelto', '1');
        localStorage.setItem('ygoBotSpeed', 'veloce');
    } catch (e) { /* senza storage restano i valori predefiniti */ }
};

module.exports = {
    standalone: true,
    name: 'Tag Team: Boss a squadre e scambio su richiesta (il compagno accetta o si va a turno)',
    async run(t) {
        const errori = [];
        const apri = async (url) => {
            const page = await t.browser.newPage({ viewport: { width: 1400, height: 900 } });
            page.on('pageerror', (e) => errori.push(e.message));
            await page.addInitScript(PRELUDIO);
            await page.goto(url);
            try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
            await page.waitForFunction(() => typeof gameState !== 'undefined' && window.TagTeam && TagTeam.eSquadra('player'), null, { timeout: 30000 });
            await waitForOpeningCascade(page);
            await page.waitForFunction(() => gameState.phase === 'main1' && gameState.currentPlayer === 'player', null, { timeout: 30000 });
            // Duello fermo: i cambi turno li fa il test emettendo 'inizio-turno'.
            await page.evaluate(() => { window.changeTurn = function () {}; window.botPerformAttacks = async function () {}; window.turnoIA = function () {}; });
            return page;
        };

        // ---------- 1) Boss a squadre
        {
            const page = await apri(BOSS);
            try {
                const r = await page.evaluate(() => ({
                    lpBoss: gameState.botLP,
                    mostrati: Number(document.getElementById('botLP').textContent),
                    squadraAvversaria: TagTeam.eSquadra('bot'),
                    coppia: TagTeam.riassunto('player').membri.map((m) => m.lp),
                    livello: gameState.botDifficulty,
                    richiesta: TagTeam.chiediScambio('player'),
                    pulsante: !!document.querySelector('#tagPanchina [data-azione="scambio"]')
                }));
                t.assert(r.lpBoss === 12000 && r.mostrati === 12000 && !r.squadraAvversaria, 'Il Boss ha 12000 Life Point, anche a schermo: ' + JSON.stringify(r));
                t.assert(JSON.stringify(r.coppia) === '[4000,4000]' && r.livello === 'hard', 'La coppia 4000 a testa, il Boss col mazzo Difficile: ' + JSON.stringify(r));
                t.assert(r.richiesta === null && !r.pulsante, 'Con la regola "a turno" nessuna richiesta di scambio: ' + JSON.stringify(r));
            } finally {
                await page.close();
            }
        }

        // ---------- 2) Scambio su richiesta
        {
            const page = await apri(LIBERO);
            try {
                const testoPulsante = () => page.evaluate(() => {
                    const b = document.querySelector('#tagPanchina [data-azione="scambio"]');
                    return b ? b.textContent : null;
                });
                const cambioTurno = (fino) => page.evaluate((n) => {
                    gameState.currentPlayer = 'bot'; gameState.turn = n - 1;
                    EventiDuello.emetti('inizio-turno', 'bot');
                    gameState.currentPlayer = 'player'; gameState.turn = n;
                    EventiDuello.emetti('inizio-turno', 'player');
                    const r = TagTeam.riassunto('player');
                    const a = document.getElementById('tagRispostaCompagno');
                    return { attivo: r.attivo, risposta: r.ultimaRisposta, avviso: a && !a.hidden ? a.textContent : null, richiesta: r.richiesta };
                }, fino);

                // Turno 1 tuo: il prossimo toccherebbe a Joey. Chiedi di giocare tu, ritira, richiedi.
                t.assert((await testoPulsante()) === '🔄 Chiedi di giocare tu il prossimo turno', 'Pulsante "gioco io": ' + await testoPulsante());
                await page.click('#tagPanchina [data-azione="scambio"]');
                const chiesta = await page.evaluate(() => TagTeam.riassunto('player').richiesta);
                t.assert(chiesta === 0, 'La richiesta "gioco io" è registrata: ' + chiesta);
                t.assert((await testoPulsante()) === '↩ Ritira la richiesta', 'Il pulsante ora ritira: ' + await testoPulsante());
                await page.click('#tagPanchina [data-azione="scambio"]');
                t.assert((await page.evaluate(() => TagTeam.riassunto('player').richiesta)) === null, 'Richiesta ritirata');
                await page.click('#tagPanchina [data-azione="scambio"]');

                // Turno 3: Life Point pari, tu hai almeno tante carte in mano -> Joey accetta e giochi tu.
                const accetta = await cambioTurno(3);
                t.assert(accetta.attivo === 0 && accetta.risposta && accetta.risposta.accetta === true && accetta.richiesta === null,
                    'Joey accetta: il turno 3 lo giochi tu: ' + JSON.stringify(accetta));
                t.assert(accetta.avviso && accetta.avviso.indexOf('accetta') !== -1, 'La risposta compare a schermo: ' + accetta.avviso);

                // Turno 5: chiedi di nuovo di giocare tu, ma hai meno Life Point di Joey -> rifiuta, si va a turno.
                await page.evaluate(() => { gameState.playerLP = 1000; });
                await page.click('#tagPanchina [data-azione="scambio"]');
                const rifiuta = await cambioTurno(5);
                t.assert(rifiuta.attivo === 1 && rifiuta.risposta && rifiuta.risposta.accetta === false,
                    'Joey rifiuta (meno Life Point): il turno 5 lo gioca lui: ' + JSON.stringify(rifiuta));
                t.assert(rifiuta.avviso && rifiuta.avviso.indexOf('preferisce andare a turno') !== -1, 'Il rifiuto compare a schermo: ' + rifiuta.avviso);

                // Turno 7 toccherebbe a te: chiedi a Joey di giocare lui. Lui ha più Life Point e più carte in mano -> accetta.
                t.assert((await testoPulsante()) === '🔄 Chiedi a Joey di giocare il prossimo turno', 'Pulsante "gioca tu": ' + await testoPulsante());
                await page.evaluate(() => { TagTeam.membro('player', 0).stato.Hand.splice(1); });
                await page.click('#tagPanchina [data-azione="scambio"]');
                const giocaLui = await cambioTurno(7);
                t.assert(giocaLui.attivo === 1 && giocaLui.risposta && giocaLui.risposta.accetta === true,
                    '"Gioca tu": Joey accetta e gioca anche il turno 7: ' + JSON.stringify(giocaLui));

                // Il turno dopo, senza richieste, si torna all'alternanza: tocca a te.
                const dopo = await cambioTurno(9);
                t.assert(dopo.attivo === 0, 'Senza richiesta si va a turno: il turno 9 è tuo: ' + JSON.stringify(dopo));
                t.assert(errori.length === 0, 'Errori nella pagina: ' + errori.join(' | '));
            } finally {
                await page.close();
            }
        }
    }
};
