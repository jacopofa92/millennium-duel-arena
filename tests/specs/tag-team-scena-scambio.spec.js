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

            await page.evaluate(() => {
                window.TAG_SCAMBIO_FORZA = true;
                window.__suoniScambio = 0;
                const orig = SFX.tagSwitch;
                SFX.tagSwitch = function (...a) { window.__suoniScambio++; return orig.apply(this, a); };
            });
            t.assert(require('fs').existsSync(path.join(RADICE, 'audio', 'standard', 'tagSwitch.mp3')), 'Il suono dello scambio e\' audio/standard/tagSwitch.mp3');

            // Scambio fra compagni: blu, TAG!, due ritratti con i nomi giusti.
            await page.evaluate(() => TagTeam.scambia('player', 1));
            await page.waitForSelector('#tagScambio', { timeout: 3000 });
            const mio = await page.evaluate(() => {
                const r = document.getElementById('tagScambio');
                return { classe: r.className, ritratti: r.querySelectorAll('.tgs-ritr').length, nomi: Array.from(r.querySelectorAll('.tgs-nome')).map((n) => n.textContent), testo: r.querySelector('.tgs-testo').textContent, tocco: getComputedStyle(r).pointerEvents };
            });
            t.assert(/tgs--mio/.test(mio.classe) && !/tgs--ko/.test(mio.classe) && mio.ritratti === 2 && mio.testo === 'TAG!' && mio.tocco === 'none', 'Scambio fra compagni: scena blu con TAG!: ' + JSON.stringify(mio));
            t.assert(/Joey/i.test(mio.nomi[1]), 'Entra Joey: ' + JSON.stringify(mio.nomi));
            t.assert((await page.evaluate(() => window.__suoniScambio)) === 1, 'Il suono dello scambio parte una volta per scena');
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

        // Cambio turno vero (changeTurn): UNA scena da 3 secondi al posto dell'annuncio standard, che racconta lo scambio e dice il
        // nome di chi gioca davvero (l'annuncio standard diceva "TURNO Seto Kaiba" anche con Pegasus davanti).
        const pagina3 = await t.browser.newPage({ viewport: { width: 1400, height: 900 } });
        const errori3 = [];
        pagina3.on('pageerror', (e) => errori3.push(e.message));
        await pagina3.addInitScript(() => {
            window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true; window.TAG_SCAMBIO_FORZA = true;
            try { localStorage.setItem('ygoVideoDetail', 'alti'); localStorage.setItem('ygoVideoDetailScelto', '1'); } catch (e) { /* niente storage */ }
        });
        try {
            await pagina3.goto(TAG2V2);
            try { await pagina3.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
            await pagina3.waitForFunction(() => typeof gameState !== 'undefined' && window.TagTeam && TagTeam.eSquadra('bot') && window.TagScambio && window.AnnuncioTurnoModalita, null, { timeout: 30000 });
            await waitForOpeningCascade(pagina3);
            await pagina3.waitForFunction(() => gameState.phase === 'main1' && gameState.currentPlayer === 'player', null, { timeout: 30000 });
            await pagina3.evaluate(() => { window.turnoIA = function () {}; window.enterDrawPhase = function () {}; });
            // Tre cambi turno di fila: al quarto turno tocca al bot, e davanti c'e' il SECONDO avversario (Pegasus).
            await pagina3.evaluate(() => { changeTurn(); changeTurn(); changeTurn(); });
            await pagina3.waitForSelector('#tagScambio', { timeout: 3000 });
            const scena = await pagina3.evaluate(() => {
                const r = document.getElementById('tagScambio');
                const classico = document.getElementById('battleStartOverlay');
                return {
                    scene: document.querySelectorAll('#tagScambio').length,
                    classici: document.querySelectorAll('#battleStartOverlay').length,
                    parole: classico ? Array.from(classico.querySelectorAll('.battle-start-word')).map((w) => w.textContent) : [],
                    sotto: classico ? classico.querySelector('.battle-start-sub').textContent : '',
                    pedine: r.querySelectorAll('.tgs-ritr').length,
                    fascia: r.querySelectorAll('.tgs-fascia').length,
                    nomi: Array.from(r.querySelectorAll('.tgs-nome')).map((n) => n.textContent),
                    davanti: TagTeam.membroAttivo('bot').nome,
                    di: gameState.currentPlayer,
                    nascosta: document.body.classList.contains('tgs-turno-attivo')
                };
            });
            // E' il cambio turno CLASSICO (un solo annuncio, stessi font e fasce) con le pedine sopra: nessuna fascia nostra.
            t.assert(scena.scene === 1 && scena.classici === 1 && scena.fascia === 0 && scena.pedine === 2, 'Il cambio turno classico + due pedine, senza una seconda fascia: ' + JSON.stringify(scena));
            t.assert(scena.di === 'bot' && /Pegasus/.test(scena.davanti) && scena.parole[0] === 'TURNO' && scena.parole[1] === scena.davanti && scena.nomi[scena.nomi.length - 1] === scena.davanti, 'L\'annuncio dice il nome di chi gioca davvero: ' + JSON.stringify(scena));
            t.assert(/TAG!/i.test(scena.sotto) && /Turno 4/i.test(scena.sotto) && scena.nascosta, 'Sottotitolo "TAG! · Turno 4" e scelte nascoste durante la scena: ' + JSON.stringify(scena));
            // Dura come un cambio turno normale (3 s): ancora a schermo dopo 2,4 s, sparita dopo 3,6 s.
            await pagina3.waitForTimeout(2200);
            t.assert(await pagina3.evaluate(() => !!document.getElementById('tagScambio')), 'La scena dura quanto un cambio turno normale (ancora a schermo dopo 2,4 s)');
            await pagina3.waitForFunction(() => !document.getElementById('tagScambio') && !document.body.classList.contains('tgs-turno-attivo'), null, { timeout: 4000 });
            t.assert(errori3.length === 0, 'Errori nella pagina: ' + errori3.join(' | '));
        } finally {
            await pagina3.close();
        }

        // Caduto nel turno AVVERSARIO: il KO si vede subito (nessun compagno che entra), il compagno entra all'inizio del TUO turno (TAG!).
        const pagina2 = await t.browser.newPage({ viewport: { width: 1400, height: 900 } });
        const errori2 = [];
        pagina2.on('pageerror', (e) => errori2.push(e.message));
        await pagina2.addInitScript(() => {
            window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true; window.TAG_SCAMBIO_FORZA = true;
            try { localStorage.setItem('ygoVideoDetail', 'alti'); localStorage.setItem('ygoVideoDetailScelto', '1'); } catch (e) { /* niente storage */ }
        });
        try {
            await pagina2.goto(TAG2V2);
            try { await pagina2.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
            await pagina2.waitForFunction(() => typeof gameState !== 'undefined' && window.TagTeam && TagTeam.eSquadra('player') && window.TagScambio, null, { timeout: 30000 });
            await waitForOpeningCascade(pagina2);
            await pagina2.waitForFunction(() => gameState.phase === 'main1' && gameState.currentPlayer === 'player', null, { timeout: 30000 });
            await pagina2.evaluate(() => { window.changeTurn = function () {}; window.turnoIA = function () {}; window.DuelEngineUI = null; });
            await pagina2.evaluate(() => { gameState.currentPlayer = 'bot'; gameState.playerLP = 0; checkGameOver(); });
            await pagina2.waitForSelector('#tagScambio', { timeout: 3000 });
            const koScena = await pagina2.evaluate(() => { const r = document.getElementById('tagScambio'); return { testo: r.querySelector('.tgs-testo').textContent, ritratti: r.querySelectorAll('.tgs-ritr').length, ko: /tgs--ko/.test(r.className), attivo: TagTeam.riassunto('player').attivo }; });
            t.assert(koScena.testo === 'KO!' && koScena.ritratti === 1 && koScena.ko, 'Il KO si vede subito, senza compagno che entra: ' + JSON.stringify(koScena));
            t.assert(koScena.attivo === 0, 'Il caduto resta davanti nel turno avversario');
            await pagina2.waitForFunction(() => !document.getElementById('tagScambio'), null, { timeout: 5000 });
            await pagina2.evaluate(() => { gameState.currentPlayer = 'player'; gameState.turn++; EventiDuello.emetti('inizio-turno', 'player'); });
            await pagina2.waitForSelector('#tagScambio', { timeout: 3000 });
            const tagScena = await pagina2.evaluate(() => { const r = document.getElementById('tagScambio'); return { testo: r.querySelector('.tgs-testo').textContent, ritratti: r.querySelectorAll('.tgs-ritr').length, esceKO: !!r.querySelector('.tgs-esce--ko'), attivo: TagTeam.riassunto('player').attivo }; });
            t.assert(tagScena.testo === 'TAG!' && tagScena.ritratti === 2 && tagScena.esceKO && tagScena.attivo === 1, 'All\'inizio del tuo turno entra il compagno: scena TAG! col caduto grigio: ' + JSON.stringify(tagScena));
            t.assert(errori2.length === 0, 'Errori nella pagina: ' + errori2.join(' | '));
        } finally {
            await pagina2.close();
        }
    }
};
