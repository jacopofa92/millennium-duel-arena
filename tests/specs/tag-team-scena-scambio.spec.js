// Tag Team: la scena dello scambio (js/ui/tag-scambio.js), solo grafica.
//  - scambio fra compagni = blu, fra avversari = rosso, eliminazione = KO;
//  - il campo del lato che cambia resta nascosto finche' entra il nuovo membro, poi torna visibile;
//  - un tocco la salta, a fine tempo si toglie da sola, e la regola dello scambio non ne dipende;
//  - con la suite (DUEL_FAST_OPENING) senza TAG_SCAMBIO_FORZA la scena non parte.
const path = require('path');
const { waitForOpeningCascade } = require('../helpers/harness');

const RADICE = path.join(__dirname, '..', '..');
const DUELLO = 'file:///' + path.join(RADICE, 'duelMonstersCore.html').replace(/\\/g, '/');
const TAG2V2 = DUELLO + '?mode=tag&character=kaiba&character2=pegasus&difficulty=Facile&partner=joey&lp=membro';

module.exports = {
    standalone: true,
    name: 'Tag Team: la scena dello scambio (compagni blu, avversari rossi, KO) e il campo che si ricompone',
    async run(t) {
        const page = await t.browser.newPage({ viewport: { width: 1400, height: 900 } });
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        await page.addInitScript(() => {
            window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true;
            try { localStorage.setItem('ygoVideoDetail', 'alti'); localStorage.setItem('ygoVideoDetailScelto', '1'); } catch (e) { /* niente storage */ }
        });
        try {
            await page.goto(TAG2V2);
            try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
            await page.waitForFunction(() => typeof gameState !== 'undefined' && window.TagTeam && TagTeam.eSquadra('bot') && window.TagScambio, null, { timeout: 30000 });
            await waitForOpeningCascade(page);
            await page.waitForFunction(() => gameState.phase === 'main1' && gameState.currentPlayer === 'player', null, { timeout: 30000 });
            await page.evaluate(() => { window.changeTurn = function () {}; window.turnoIA = function () {}; window.DuelEngineUI = null; });

            // Con la suite la scena e' spenta: la regola funziona lo stesso.
            await page.evaluate(() => TagTeam.scambia('player', 1));
            t.assert(await page.evaluate(() => !document.getElementById('tagScambio') && TagTeam.membroAttivo('player').id === TagTeam.membro('player', 1).id), 'Con DUEL_FAST_OPENING la scena non parte ma lo scambio avviene');
            await page.evaluate(() => TagTeam.scambia('player', 0));

            await page.evaluate(() => { window.TAG_SCAMBIO_FORZA = true; });

            // Scambio fra compagni: blu, TAG!, due ritratti con i nomi giusti.
            await page.evaluate(() => TagTeam.scambia('player', 1));
            await page.waitForSelector('#tagScambio', { timeout: 3000 });
            const mio = await page.evaluate(() => {
                const r = document.getElementById('tagScambio');
                return { classe: r.className, ritratti: r.querySelectorAll('.tgs-ritr').length, nomi: Array.from(r.querySelectorAll('.tgs-nome')).map((n) => n.textContent), testo: r.querySelector('.tgs-testo').textContent, tocco: getComputedStyle(r).pointerEvents };
            });
            t.assert(/tgs--mio/.test(mio.classe) && !/tgs--ko/.test(mio.classe) && mio.ritratti === 2 && mio.testo === 'TAG!' && mio.tocco === 'none', 'Scambio fra compagni: scena blu con TAG!: ' + JSON.stringify(mio));
            t.assert(/Joey/i.test(mio.nomi[1]), 'Entra Joey: ' + JSON.stringify(mio.nomi));
            // Il campo del tuo lato e' nascosto all'inizio...
            const nascosto = await page.evaluate(() => Number(getComputedStyle(document.getElementById('playerFieldBoard')).opacity));
            t.assert(nascosto < 0.5, 'All\'inizio il campo del lato che cambia e\' nascosto (opacita ' + nascosto + ')');
            // ...e a fine scena e' tornato visibile, la scena e' sparita da sola.
            await page.waitForFunction(() => !document.getElementById('tagScambio'), null, { timeout: 5000 });
            const finale = await page.evaluate(() => ({ campo: getComputedStyle(document.getElementById('playerFieldBoard')).opacity, mano: getComputedStyle(document.getElementById('playerHand')).opacity }));
            t.assert(finale.campo === '1' && finale.mano === '1', 'A fine scena campo e mano sono di nuovo visibili: ' + JSON.stringify(finale));

            // Scambio fra avversari: rosso, e un tocco la salta.
            await page.evaluate(() => TagTeam.scambia('bot', 1));
            await page.waitForSelector('#tagScambio', { timeout: 3000 });
            t.assert(await page.evaluate(() => /tgs--avv/.test(document.getElementById('tagScambio').className)), 'Scambio fra avversari: scena rossa');
            await page.waitForTimeout(350);
            await page.mouse.click(700, 450);
            await page.waitForFunction(() => !document.getElementById('tagScambio'), null, { timeout: 1500 });
            t.assert(await page.evaluate(() => getComputedStyle(document.getElementById('botFieldBoard')).opacity === '1'), 'Saltata con un tocco: il campo avversario torna subito visibile');

            // Eliminazione: KO, il ritratto di chi esce porta la X.
            await page.evaluate(() => TagTeam.scambia('bot', 0));
            await page.waitForFunction(() => !document.getElementById('tagScambio'), null, { timeout: 5000 });
            await page.evaluate(() => TagTeam.scambia('player', 0));
            await page.waitForFunction(() => !document.getElementById('tagScambio'), null, { timeout: 5000 });
            await page.evaluate(() => { TagTeam.membro('player', 0).vivo = false; TagTeam.scambia('player', 1); });
            await page.waitForSelector('#tagScambio', { timeout: 3000 });
            const ko = await page.evaluate(() => { const r = document.getElementById('tagScambio'); return { classe: r.className, testo: r.querySelector('.tgs-testo').textContent, x: r.querySelectorAll('.tgs-x').length }; });
            t.assert(/tgs--ko/.test(ko.classe) && ko.testo === 'KO!' && ko.x === 1, 'Eliminazione: KO con la X sul ritratto: ' + JSON.stringify(ko));
            await page.waitForFunction(() => !document.getElementById('tagScambio'), null, { timeout: 5000 });

            // Dettagli "Normali": versione leggera, il campo non viene nascosto.
            await page.evaluate(() => { VideoQuality.set('normali'); TagTeam.membro('player', 0).vivo = true; TagTeam.scambia('player', 0); });
            await page.waitForSelector('#tagScambio', { timeout: 3000 });
            const leggera = await page.evaluate(() => Number(getComputedStyle(document.getElementById('playerFieldBoard')).opacity));
            t.assert(leggera === 1, 'Con Normali il campo non viene nascosto');
            t.assert(errori.length === 0, 'Errori nella pagina: ' + errori.join(' | '));
        } finally {
            await page.close();
        }
    }
};
