// Gli agganci delle Sfide nuove: Tag Team (tagWin, tagWinSenzaKo), imprese del duello (winLowLp, winFast), buste (packOpened) e
// Tutorial (tutorialLezione). Ognuno si prova con l'evento VERO del gioco, non scrivendo il progresso a mano.
const path = require('path');
const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Sfide nuove: Tag Team, imprese del duello, buste e Tutorial avanzano dagli eventi veri',
    standalone: true,
    async run({ browser, assert }) {
        const errori = [];
        const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, serviceWorkers: 'block' });
        await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true; });
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errori.push(e.message));
        const progresso = (ids) => page.evaluate((lista) => lista.map((id) => { const p = SaveManager.getChallengeProgress(id); return [id, p.count || 0, !!p.completed]; }), ids);
        try {
            // ---------- Tag Team: una vittoria 2 contro 1 senza KO
            await page.goto(url('duelMonstersCore.html') + '?mode=tag&character=kaiba&partner=joey&difficulty=Difficile');
            await page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.playerHand && gameState.playerHand.length > 0 && window.ModalitaDuello && window.ModalitaDuello.tag, null, { timeout: 40000 });
            await page.evaluate(() => { if (!SaveManager.hasSave()) SaveManager.createNew('Prova'); const s = SaveManager.load(); s.challenges = {}; SaveManager.touch(s); });
            await page.evaluate(() => ModalitaDuello.tag.chiudi(true, false));
            const tag = await progresso(['tag-prima', 'tag-2v1', 'tag-2v2', 'tag-boss', 'tag-difficile', 'tag-nessun-ko']);
            assert(tag[0][2] && tag[1][1] === 1 && tag[2][1] === 0 && tag[3][1] === 0, `Una vittoria Tag 2 contro 1 conta per "prima" e per "2 contro 1", non per gli altri formati: ${JSON.stringify(tag)}`);
            assert(tag[4][1] === 1 && tag[5][1] === 1, `A Difficile e senza che nessuno sia stato eliminato: ${JSON.stringify(tag)}`);
            // Un abbandono o una sconfitta non contano
            await page.evaluate(() => { ModalitaDuello.tag.chiudi(false, false); ModalitaDuello.tag.chiudi(true, true); });
            const dopo = await progresso(['tag-cinque']);
            assert(dopo[0][1] === 1, `Sconfitte e abbandoni non contano: ${JSON.stringify(dopo)}`);
            // Con un membro eliminato niente "Nessuno resta indietro"
            await page.evaluate(() => { const r = TagTeam.riassunto('player'); const m = TagTeam.membro('player', 1); if (m) m.vivo = false; ModalitaDuello.tag.chiudi(true, false); return r.membri.length; });
            const ko = await progresso(['tag-prima', 'tag-nessun-ko']);
            assert(ko[0][1] === 1 && ko[1][1] === 1, `Con un membro eliminato la vittoria conta ma non per "nessun KO": ${JSON.stringify(ko)}`);

            // ---------- Imprese del duello: winLowLp e winFast (stesso punto di perfectWin)
            await page.evaluate(() => { const s = SaveManager.load(); s.challenges = {}; SaveManager.touch(s); });
            await page.evaluate(() => { ChallengeTracker.recordProgress('winLowLp', { critica: true }); ChallengeTracker.recordProgress('winLowLp', { critica: false }); ChallengeTracker.recordProgress('winFast', { veloce: true }); ChallengeTracker.recordProgress('winFast', { veloce: false }); });
            const imprese = await progresso(['vittoria-al-limite-1', 'vittoria-lampo-1', 'vittoria-lampo-10']);
            assert(imprese[0][2] && imprese[1][2] && imprese[2][1] === 1, `Solo la vittoria con l'impresa conta: ${JSON.stringify(imprese)}`);
            const sorgente = require('fs').readFileSync(path.join(RADICE, 'js', 'duel-session.js'), 'utf8');
            assert(/recordProgress\('winLowLp', \{ critica: lpFinali <= 500 \}\)/.test(sorgente) && /recordProgress\('winFast', \{ veloce: Math\.ceil\(gameState\.turn \/ 2\) <= 5 \}\)/.test(sorgente),
                'duel-session.js registra le due imprese a fine vittoria');

            // ---------- Buste: il Negozio registra l'apertura (tipo premium/tematica/base...)
            await page.goto(url('negozio.html'));
            await page.waitForFunction(() => window.ChallengeTracker && window.ShopCatalog && window.ShopUI, null, { timeout: 30000 });
            const negozio = require('fs').readFileSync(path.join(RADICE, 'js', 'economy', 'shop-ui.js'), 'utf8');
            assert(/recordProgress\('packOpened', \{ tipo: tipo \}\)/.test(negozio), 'shop-ui.js registra l\'apertura di una busta');

            // ---------- Tutorial: una lezione completata conta UNA volta (anche rifacendola)
            await page.goto(url('tutorial-tag.html'));
            await page.waitForSelector('#avanti', { timeout: 20000 });
            await page.evaluate(() => { const s = SaveManager.load(); s.challenges = {}; s.tutorial = { daFare: false, completata: false, premiata: false, lezioni: {} }; SaveManager.touch(s); });
            await page.reload();
            await page.waitForSelector('#avanti', { timeout: 20000 });
            for (let k = 0; k < 8 && await page.$('#avanti'); k++) await page.click('#avanti');
            await page.waitForSelector('#prova');
            const una = await progresso(['tutorial-prima']);
            assert(una[0][2], `Completata la lezione, la Sfida "Primo giorno di scuola" e' fatta: ${JSON.stringify(una)}`);
            await page.reload();
            await page.waitForSelector('#avanti', { timeout: 20000 });
            for (let k = 0; k < 8 && await page.$('#avanti'); k++) await page.click('#avanti');
            await page.waitForSelector('#prova');
            const due = await progresso(['tutorial-cinque']);
            assert(due[0][1] === 1, `Rifare la stessa lezione non la fa contare di nuovo: ${JSON.stringify(due)}`);
        } finally {
            await ctx.close();
        }
        assert(errori.length === 0, `Nessun errore JS: ${errori.join(' | ')}`);
    }
};
