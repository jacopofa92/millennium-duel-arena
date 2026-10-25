// Le 4 missioni giornaliere generiche (js/data/missions-db.js): alla portata di tutti, senza chiedere una carta o un Duellante
// preciso. Si provano con gli eventi VERI del gioco (un'Evocazione, l'attivazione di una Magia), non solo con recordProgress.
const fs = require('fs');
const path = require('path');
const RADICE = path.join(__dirname, '..', '..');

module.exports = {
    name: 'Missioni giornaliere: 4 generiche, si completano giocando normalmente',
    async run(t) {
        await t.page.waitForTimeout(2500);   // lascia assestare la cascata delle fasi (vedi tests/README.md)
        await t.evaluate(() => { if (!SaveManager.hasSave()) SaveManager.createNew('Tester'); });

        // Il catalogo: esattamente 4 giornaliere, e tutte generiche.
        const catalogo = await t.evaluate(() => {
            const g = missionsDatabase.filter((m) => m.scope === 'daily' || m.scope === 'both');
            return { n: g.length, tipi: g.map((m) => m.type + ':' + JSON.stringify(m.match)) };
        });
        t.assert(catalogo.n === 4, `4 missioni giornaliere in tutto: ${JSON.stringify(catalogo)}`);

        // Un elenco di oggi salvato PRIMA dell'aggiornamento (missioni a tema che non sono piu' giornaliere) non deve lasciare la
        // scheda vuota: si rifa.
        const rifatto = await t.evaluate(() => {
            SaveManager.setMissionRoster('daily', ServerDate.dayKey(), ['m-summon-kuriboh', 'm-beat-joey', 'm-activate-swords']);
            return ChallengeTracker.getMissions('daily').map((m) => m.id);
        });
        t.assert(rifatto.length === 4 && rifatto.every((id) => id.indexOf('m-daily-') === 0), `un elenco vecchio viene rifatto: ${rifatto}`);

        const stato = () => t.evaluate(() => Object.fromEntries(ChallengeTracker.getMissions('daily').map((m) => [m.id, { n: m.count, di: m.target, fatta: m.completed }])));
        const prima = await stato();
        t.assert(Object.values(prima).every((m) => m.n === 0 && !m.fatta), `si parte da zero: ${JSON.stringify(prima)}`);

        // Un'attivazione VERA di una Magia (Vaso dell'Avidita') conta; l'effetto di un mostro no.
        await t.evaluate(() => {
            gameState.phase = 'main1'; gameState.currentPlayer = 'player';
            gameState.playerHand.length = 0;
            const c = JSON.parse(JSON.stringify(cardDatabase.find((x) => x.id === 36))); c.uid = 'pot-1';
            gameState.playerHand.push(c);
            DuelEngine.activateCard('player', 'hand', 0);
        });
        await t.page.waitForFunction(() => ChallengeTracker.getMissions('daily').find((m) => m.id === 'm-daily-spelltrap').count === 1, null, { timeout: 20000 });
        await t.evaluate(() => ChallengeTracker.recordProgress('activateCard', { cardId: 99999, cardType: 'monster' }));
        t.assert((await stato())['m-daily-spelltrap'].n === 1, 'l\'effetto di un mostro non conta fra le Magie e Trappole');
        await t.evaluate(() => ChallengeTracker.recordProgress('activateCard', { cardId: 40, cardType: 'trap' }));
        t.assert((await stato())['m-daily-spelltrap'].fatta, 'una Trappola conta: 2 su 2');

        // Evocazioni: qualunque mostro, e tre bastano (anche Speciali).
        await t.evaluate(() => {
            gameState.playerMonsterField.fill(null);
            for (let i = 0; i < 3; i++) {
                const c = JSON.parse(JSON.stringify(cardDatabase.find((x) => x.id === 4))); c.uid = 'ev-' + i;
                DuelEngine.makeContext('player', {}).specialSummon('player', c, i, 'attack', 'hand', { ignoreSummoningConditions: true });
            }
        });
        await t.page.waitForFunction(() => ChallengeTracker.getMissions('daily').find((m) => m.id === 'm-daily-summon').completed, null, { timeout: 20000 });

        // Giocare un duello conta anche perdendo; vincerlo e' un'altra missione.
        await t.evaluate(() => ChallengeTracker.recordProgress('playDuel', { mode: 'free' }));
        const finale = await stato();
        t.assert(finale['m-daily-play'].fatta && !finale['m-daily-win'].fatta, `giocare completa "In campo" ma non "Una vittoria": ${JSON.stringify(finale)}`);
        await t.evaluate(() => ChallengeTracker.recordProgress('winDuels', {}));
        t.assert((await stato())['m-daily-win'].fatta, 'una vittoria completa "Una vittoria"');

        // Le descrizioni al singolare/plurale giusto.
        const testi = await t.evaluate(() => Object.fromEntries(ChallengeTracker.getMissions('daily').map((m) => [m.id, m.description])));
        t.assert(testi['m-daily-play'] === 'Gioca 1 Duello fino alla fine', `singolare: ${testi['m-daily-play']}`);
        t.assert(testi['m-daily-summon'] === 'Evoca 3 mostri' && testi['m-daily-spelltrap'] === 'Attiva 2 carte Magia o Trappola', `plurale: ${JSON.stringify(testi)}`);

        // L'aggancio "duello giocato" sta davvero nella chiusura del duello, e non conta un abbandono.
        const sessione = fs.readFileSync(path.join(RADICE, 'js', 'duel-session.js'), 'utf8');
        t.assert(/recordProgress\('playDuel'/.test(sessione) && /!abbandono && mode !== 'demo' && mode !== 'sandbox'/.test(sessione),
            'duel-session.js segnala playDuel a fine duello, mai per abbandono, Demo o sandbox');
        // Ogni pagina che carica il tracker deve avere ANCHE i due cataloghi: senza missions-db.js il tracker ignora in silenzio le
        // missioni (e senza challenges-db.js le Sfide). Era il caso del duello e dei tre tornei: nulla avanzava da li'.
        const mancanti = [];
        fs.readdirSync(RADICE).filter((n) => n.endsWith('.html')).forEach((n) => {
            const html = fs.readFileSync(path.join(RADICE, n), 'utf8');
            if (!html.includes('challenge-tracker.js')) return;
            ['js/data/challenges-db.js', 'js/data/missions-db.js'].forEach((s) => { if (!html.includes(s)) mancanti.push(n + ' senza ' + s); });
        });
        t.assert(mancanti.length === 0, `pagine col tracker ma senza un catalogo: ${mancanti.join('; ')}`);
        const chiamanoTornei = fs.readdirSync(RADICE).filter((n) => /^torneo-.*\.html$/.test(n))
            .filter((n) => fs.readFileSync(path.join(RADICE, n), 'utf8').includes('Rewards.forTournament') && !fs.readFileSync(path.join(RADICE, n), 'utf8').includes('challenge-tracker.js'));
        t.assert(chiamanoTornei.length === 0, `le pagine dei tornei devono caricare il tracker (completeTournament): ${chiamanoTornei.join(', ')}`);
    }
};
