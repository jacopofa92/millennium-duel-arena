// Tag Team: il campo del compagno in panchina si può guardare (sola lettura), come nell'Assalto al Boss.
// Il visore è lo stesso (js/multiplayer/mp-raid-campo.js): un tasto col ritratto del compagno che NON è davanti e un pannello con
// il suo campo — mostri, Magie/Trappole (anche coperte: è un alleato), mano, Life Point — ma senza il blocco del Boss.
// Il suo stato è già in memoria (ogni membro in panchina tiene il proprio in `stato`), quindi non viaggia niente.
const path = require('path');
const { waitForOpeningCascade } = require('../helpers/harness');

const RADICE = path.join(__dirname, '..', '..');
const DUELLO = 'file:///' + path.join(RADICE, 'duelMonstersCore.html').replace(/\\/g, '/');
const TAG2V2 = DUELLO + '?mode=tag&character=kaiba&character2=pegasus&difficulty=Facile&partner=joey&lp=membro';

module.exports = {
    standalone: true,
    name: 'Tag Team: il tasto del compagno in panchina apre il suo campo in sola lettura',
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
            await page.waitForFunction(() => typeof gameState !== 'undefined' && window.TagTeam && TagTeam.eSquadra('player') && window.MpRaidCampo, null, { timeout: 30000 });
            await waitForOpeningCascade(page);
            await page.waitForFunction(() => gameState.phase === 'main1' && gameState.currentPlayer === 'player', null, { timeout: 30000 });
            await page.evaluate(() => { window.changeTurn = function () {}; window.turnoIA = function () {}; window.DuelEngineUI = null; });

            // Il compagno (membro 1) è in panchina: gli do un mostro scoperto e una Trappola coperta.
            await page.evaluate(() => {
                const stato = TagTeam.membro('player', 1).stato;
                stato.MonsterField[0] = { card: Object.assign({}, cardDatabase.find((c) => c.id === 1), { uid: 'amico-m' }), position: 'attack', isFaceDown: false };
                stato.STField[0] = { card: Object.assign({}, cardDatabase.find((c) => c.id === 10), { uid: 'amico-t' }), position: 'attack', isFaceDown: true };
                updateUI();
            });
            await page.waitForSelector('.mpr-tasto', { timeout: 5000 });
            const tasti = await page.evaluate(() => Array.from(document.querySelectorAll('.mpr-tasto')).map((b) => b.dataset.id));
            const idAmico = await page.evaluate(() => 'tag-' + TagTeam.membro('player', 1).id);
            const idAvv = await page.evaluate(() => 'tag-' + TagTeam.membro('bot', 1).id);
            t.assert(tasti.length === 2 && tasti[0] === idAmico && tasti[1] === idAvv, 'Due tasti: il compagno e l\'avversario in panchina: ' + JSON.stringify(tasti));

            const prima = await page.evaluate(() => JSON.stringify({ m: gameState.playerMonsterField.map((s) => s && s.card && s.card.uid), h: gameState.playerHand.length }));
            await page.click('.mpr-tasto[data-id="' + idAmico + '"]');
            await page.waitForSelector('#mpRaidCampo .mpr-slot', { timeout: 5000 });
            const aperto = await page.evaluate(() => ({
                carte: document.querySelectorAll('#mpRaidCampo .mpr-slot .card').length,
                boss: document.querySelectorAll('#mpRaidCampo .mpr-boss').length,
                nome: document.querySelector('#mpRaidCampo .mpr-nome-giocatore').textContent,
                lp: document.querySelector('#mpRaidCampo .mpr-sub').textContent
            }));
            t.assert(aperto.carte === 2, 'Il pannello mostra le due carte del compagno: ' + JSON.stringify(aperto));
            t.assert(aperto.boss === 0, 'Nessun blocco del Boss nel Tag: ' + JSON.stringify(aperto));
            t.assert(/Joey/i.test(aperto.nome) && /LP/.test(aperto.lp), 'Nome e Life Point del compagno: ' + JSON.stringify(aperto));
            const dopo = await page.evaluate(() => JSON.stringify({ m: gameState.playerMonsterField.map((s) => s && s.card && s.card.uid), h: gameState.playerHand.length }));
            t.assert(prima === dopo, 'Sola lettura: il tuo campo non cambia');
            const trapelati = await page.evaluate(() => JSON.stringify(gameState).includes('raid-'));
            t.assert(!trapelati, 'Le carte del visore (uid finti) non entrano nello stato del duello');

            await page.click('#mpRaidCampo .mpr-chiudi');
            // L'avversario in panchina: una carta scoperta e una coperta; la coperta resta un dorso senza nome (nessuna 'i').
            await page.evaluate(() => {
                const stato = TagTeam.membro('bot', 1).stato;
                stato.MonsterField[0] = { card: Object.assign({}, cardDatabase.find((c) => c.id === 1), { uid: 'avv-m' }), position: 'attack', isFaceDown: false };
                stato.MonsterField[1] = { card: Object.assign({}, cardDatabase.find((c) => c.id === 7), { uid: 'avv-c' }), position: 'defense', isFaceDown: true };
                updateUI();
            });
            await page.click('.mpr-tasto[data-id="' + idAvv + '"]');
            await page.waitForFunction(() => document.querySelectorAll('#mpRaidCampo .mpr-slot .card').length === 2, null, { timeout: 5000 });
            const avv = await page.evaluate(() => ({
                nome: document.querySelector('#mpRaidCampo .mpr-nome-giocatore').textContent,
                leggibili: document.querySelectorAll('#mpRaidCampo .mpr-leggibile').length,
                notaCoperta: document.querySelectorAll('#mpRaidCampo .mpr-coperta-nota').length,
                boss: document.querySelectorAll('#mpRaidCampo .mpr-boss').length,
                testo: document.getElementById('mpRaidCampo').textContent
            }));
            t.assert(/Pegasus/i.test(avv.nome) && avv.boss === 0, 'Il pannello e\' quello dell\'avversario in panchina: ' + JSON.stringify(avv.nome));
            t.assert(avv.leggibili === 1 && avv.notaCoperta === 0, 'Dell\'avversario si legge solo la carta scoperta: ' + JSON.stringify(avv));
            t.assert(!/Buco Nero/i.test(avv.testo), 'Il nome della carta coperta dell\'avversario non compare');
            await page.click('#mpRaidCampo .mpr-chiudi');

            // Il compagno entra in campo (scambio): il suo tasto sparisce e compare quello di chi ora è in panchina.
            await page.evaluate(() => { TagTeam.scambia('player', 1); updateUI(); });
            await page.waitForFunction((id) => !document.querySelector('.mpr-tasto[data-id="' + id + '"]'), idAmico, { timeout: 5000 });
            t.assert(await page.evaluate(() => document.querySelectorAll('.mpr-tasto').length === 2), 'Restano due tasti: il nuovo compagno in panchina e l\'avversario');

            // Compagno eliminato: resta solo il tasto dell'avversario.
            await page.evaluate(() => { TagTeam.membro('player', 0).vivo = false; updateUI(); });
            await page.waitForFunction((id) => { const b = Array.from(document.querySelectorAll('.mpr-tasto')); return b.length === 1 && b[0].dataset.id === id; }, idAvv, { timeout: 5000 });
            t.assert(errori.length === 0, 'Errori nella pagina: ' + errori.join(' | '));
        } finally {
            await page.close();
        }
    }
};
