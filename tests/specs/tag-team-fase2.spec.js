// Tag Team, fase 2 (docs/planning/PIANO_TAG_TEAM.md): 2 contro 2 contro l'IA.
// Cosa si controlla:
//  1) nella pagina, a duello fermo: la squadra avversaria (character2) nasce con il suo riquadro e il riquadro
//     dei Life Point dell'avversario segue chi è davanti; chi attacca dall'IA affronta chi ha giocato per ultimo
//     (D12 predefinito); a inizio turno tuo compare la domanda "Chi affronti?" e la scelta porta davanti il membro
//     scelto (D12); dopo due turni di fila contro lo stesso membro la scelta è obbligata sull'altro (D13);
//  2) senza pagina: partite intere a squadre, IA contro IA, 2 contro 1 e 2 contro 2, finiscono senza errori,
//     invarianti rotti o stalli (lo strumento di bilanciamento tools/tag-senza-testa.js).
const path = require('path');
const { waitForOpeningCascade } = require('../helpers/harness');

const RADICE = path.join(__dirname, '..', '..');
const DUELLO = 'file:///' + path.join(RADICE, 'duelMonstersCore.html').replace(/\\/g, '/');
const TAG2V2 = DUELLO + '?mode=tag&character=kaiba&character2=pegasus&difficulty=Facile&partner=joey&lp=membro';

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
    name: 'Tag Team fase 2: squadra avversaria, scelta di chi affrontare (D12) e limite di due turni (D13)',
    async run(t) {
        const errori = [];
        // ---------- 1) Nella pagina
        {
            const page = await t.browser.newPage({ viewport: { width: 1400, height: 900 } });
            page.on('pageerror', (e) => errori.push(e.message));
            await page.addInitScript(PRELUDIO);
            try {
                await page.goto(TAG2V2);
                try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
                await page.waitForFunction(() => typeof gameState !== 'undefined' && window.TagTeam && TagTeam.eSquadra('player') && TagTeam.eSquadra('bot'), null, { timeout: 30000 });
                await waitForOpeningCascade(page);
                await page.waitForFunction(() => gameState.phase === 'main1' && gameState.currentPlayer === 'player', null, { timeout: 30000 });
                await page.evaluate(() => { window.changeTurn = function () {}; window.botPerformAttacks = async function () {}; window.turnoIA = function () {}; });

                const inizio = await page.evaluate(() => ({
                    bot: TagTeam.riassunto('bot'),
                    pannello: !!document.getElementById('tagPanchinaAvv'),
                    nomeBox: document.querySelector('#botInfo .name-text').textContent,
                    personaggio: gameState.personaggioPerPosto.bot,
                    controllore: Tavolo.controllore('bot'),
                    lp: [TagTeam.riassunto('player').membri.map((m) => m.lp), TagTeam.riassunto('bot').membri.map((m) => m.lp)]
                }));
                t.assert(JSON.stringify(inizio.lp) === '[[8000,8000],[8000,8000]]', 'D19: nel 2 contro 2 tutti hanno 8000 Life Point: ' + JSON.stringify(inizio.lp));
                t.assert(inizio.bot && inizio.bot.membri[0].nome === 'Seto Kaiba' && inizio.bot.membri[1].nome === 'Maximillion Pegasus',
                    'Squadra avversaria Kaiba + Pegasus: ' + JSON.stringify(inizio.bot && inizio.bot.membri.map((m) => m.nome)));
                t.assert(inizio.bot.membri[1].mano === 5 && inizio.bot.membri[1].mazzo > 20, 'Pegasus ha la sua mano e il suo Mazzo: ' + JSON.stringify(inizio.bot.membri[1]));
                t.assert(inizio.pannello && inizio.nomeBox === 'Seto Kaiba' && inizio.personaggio === 'kaiba' && inizio.controllore === 'ia',
                    'Riquadro della squadra avversaria e riquadro dei Life Point su Kaiba: ' + JSON.stringify(inizio));

                // Turno 2, Kaiba (IA) attacca la tua squadra: affronta chi ha giocato per ultimo (tu), senza domande.
                const t2 = await page.evaluate(() => {
                    gameState.currentPlayer = 'bot'; gameState.turn = 2;
                    EventiDuello.emetti('inizio-turno', 'bot');
                    return { davantiBot: TagTeam.riassunto('bot').attivo, fronteTua: TagTeam.riassunto('player').fronte, domanda: Decisioni.inSospeso() };
                });
                t.assert(t2.davantiBot === 0 && t2.fronteTua && t2.fronteTua.indice === 0 && t2.fronteTua.fila === 1 && !t2.domanda,
                    'D12 predefinito: l\'IA affronta chi ha giocato per ultimo: ' + JSON.stringify(t2));

                // Turno 3, Joey (IA) affronta Kaiba (chi ha giocato per ultimo); turno 4, Pegasus affronta Joey.
                const t34 = await page.evaluate(() => {
                    gameState.currentPlayer = 'player'; gameState.turn = 3;
                    EventiDuello.emetti('inizio-turno', 'player');
                    const tre = { davantiTu: TagTeam.riassunto('player').attivo, fronteBot: TagTeam.riassunto('bot').fronte };
                    gameState.currentPlayer = 'bot'; gameState.turn = 4;
                    EventiDuello.emetti('inizio-turno', 'bot');
                    return { tre, davantiBot: TagTeam.riassunto('bot').attivo, fronteTua: TagTeam.riassunto('player').fronte };
                });
                t.assert(t34.tre.davantiTu === 1 && t34.tre.fronteBot.indice === 0 && t34.tre.fronteBot.fila === 1,
                    'Turno 3: gioca Joey e affronta Kaiba: ' + JSON.stringify(t34));
                t.assert(t34.davantiBot === 1 && t34.fronteTua.indice === 1, 'Turno 4: gioca Pegasus e affronta Joey: ' + JSON.stringify(t34));

                // Turno 5, tocca a te: la domanda "Chi affronti?" sullo schermo. Scegli Kaiba (non è chi ha giocato per ultimo).
                await page.evaluate(() => {
                    gameState.currentPlayer = 'player'; gameState.turn = 5;
                    EventiDuello.emetti('inizio-turno', 'player');
                });
                const domanda = await page.evaluate(() => ({
                    d: Decisioni.inSospeso(),
                    popover: (document.getElementById('quickPopover') || {}).textContent || '',
                    occupata: isBlockingModalOpen()
                }));
                t.assert(domanda.d && domanda.d.chi === 'player' && domanda.d.tipo === 'opzioni' && domanda.d.candidati.length === 2,
                    'D12: a inizio turno tuo la scelta di chi affrontare: ' + JSON.stringify(domanda.d));
                t.assert(domanda.popover.indexOf('Chi affronti') !== -1 && domanda.popover.indexOf('Seto Kaiba') !== -1 && domanda.popover.indexOf('Maximillion Pegasus') !== -1,
                    'La domanda è a schermo con i due avversari: ' + domanda.popover.slice(0, 160));
                t.assert(domanda.occupata, 'Finché non scegli il duello aspetta (interfaccia occupata)');
                await page.click('#quickPopover .quick-popover-option[data-option="0"]');
                await page.waitForFunction(() => TagTeam.riassunto('bot').attivo === 0, null, { timeout: 5000 });
                const scelto = await page.evaluate(() => ({
                    fronteBot: TagTeam.riassunto('bot').fronte,
                    nomeBox: document.querySelector('#botInfo .name-text').textContent,
                    personaggio: gameState.personaggioPerPosto.bot
                }));
                t.assert(scelto.fronteBot.indice === 0 && scelto.fronteBot.fila === 2 && scelto.nomeBox === 'Seto Kaiba' && scelto.personaggio === 'kaiba',
                    'D12: Kaiba torna davanti e il riquadro lo segue (seconda volta di fila): ' + JSON.stringify(scelto));

                // Turno 6 Kaiba gioca (alternanza della squadra avversaria: dopo Pegasus tocca a Kaiba), turno 7 Joey:
                // Kaiba è già stato affrontato due turni di fila, quindi D13 obbliga Joey ad affrontare Pegasus.
                const d13 = await page.evaluate(() => {
                    gameState.currentPlayer = 'bot'; gameState.turn = 6;
                    EventiDuello.emetti('inizio-turno', 'bot');
                    const giocaKaiba = TagTeam.riassunto('bot').attivo === 0;
                    const righe = [];
                    const via = EventiDuello.ascolta('registro', (m) => righe.push(String(m)));
                    gameState.currentPlayer = 'player'; gameState.turn = 7;
                    EventiDuello.emetti('inizio-turno', 'player');
                    if (typeof via === 'function') via();
                    return { giocaKaiba, davantiTu: TagTeam.riassunto('player').attivo, bot: TagTeam.riassunto('bot'), domanda: Decisioni.inSospeso(), righe };
                });
                t.assert(d13.giocaKaiba && d13.davantiTu === 1, 'Turno 6 di Kaiba, turno 7 di Joey: ' + JSON.stringify(d13));
                t.assert(d13.bot.attivo === 1 && d13.bot.fronte.indice === 1 && d13.bot.fronte.fila === 1 && !d13.domanda,
                    'D13: dopo due turni di fila contro Kaiba si affronta Pegasus: ' + JSON.stringify(d13.bot));
                t.assert(d13.righe.some((r) => r.indexOf('turni di fila') !== -1), 'Il registro spiega la scelta obbligata: ' + JSON.stringify(d13.righe));
                t.assert(errori.length === 0, 'Errori nella pagina: ' + errori.join(' | '));
            } finally {
                await page.close();
            }
        }

        // ---------- 2) Senza pagina: partite intere a squadre
        {
            const { giocaTag } = require(path.join(RADICE, 'tools', 'tag-senza-testa.js'));
            const base = { giocatore: 'yugiMuto', compagno: 'joey', avversario: 'kaiba', livello: 'medium', livelloGiocatore: 'hard', mazzoCompagno: 'medium', seme: 77, turni: 80, limite: 2 };
            const esiti = [];
            for (const [formato, opz] of [['2v1', {}], ['2v2', { avversario2: 'pegasus' }], ['2v2 lato', { avversario2: 'pegasus', lp: 'lato' }]]) {
                for (let n = 0; n < 4; n++) {
                    const r = await giocaTag(Object.assign({ lp: 'membro' }, base, opz), n, n % 2 === 1);
                    esiti.push(r.esito);
                    t.assert(r.erroriCarte.length === 0 && r.invarianti.length === 0, `${formato} partita ${n + 1}: errori ${r.erroriCarte.slice(0, 2).join(' | ')} ${r.invarianti.join(' | ')}`);
                    t.assert(r.esito === true || r.esito === false || r.esito === 'draw' || r.alLimite,
                        `${formato} partita ${n + 1}: ferma senza vincitore al turno ${r.turno}, fase ${r.fasi}, di turno ${r.chi}\n    ${r.log.join('\n    ')}`);
                }
            }
            t.assert(esiti.includes(true) && esiti.includes(false), 'Nel campione vince a volte una squadra, a volte l\'altra: ' + JSON.stringify(esiti));
        }
    }
};
