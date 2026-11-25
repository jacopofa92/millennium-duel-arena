// Sfide (js/data/challenges-db.js + js/challenges/challenge-tracker.js):
// verifica i DUE veri punti di aggancio nel motore, non solo la logica del
// tracker isolata — ACTIONS.specialSummon (duel-engine.js, esposta su un
// ctx tramite DuelEngine.makeContext — ACTIONS stessa è un const privato
// dell'IIFE, mai un vero global) deve far avanzare una sfida
// 'summonMonster' passando dal dispatcher condiviso ON_SPECIAL_SUMMON, e
// SOLO per la persona al controllo del posto (mai per il bot alleato, né per
// il bot avversario o un Token id -1).
// Il secondo aggancio (DuelSession.finish() in duel-session.js per
// 'defeatCharacter'/'winDuels') non è testabile qui (DuelSession non è
// caricato dalla sandbox demo) — coperto invece dalla verifica manuale
// con Playwright descritta in CLAUDE.md/nella sessione che ha introdotto
// questa funzionalità.
const { freezeNaturalGameLoop } = require('../helpers/harness');

module.exports = {
    name: 'Sfide: evocazioni e attivazioni contano solo se le esegue una persona, non il compagno IA',
    async run(t) {
        await freezeNaturalGameLoop(t.page);

        const result = await t.evaluate(() => {
            if (!SaveManager.hasSave()) SaveManager.createNew('TestSfide');
            // Sfida nota dal catalogo reale: 'summon-blue-eyes-5' (cardId 1, target 5).
            const before = SaveManager.getChallengeProgress('summon-blue-eyes-5');

            const blueEyes = { ...cardDatabase.find((c) => c.id === 1), uid: 'be-1' };
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            const ctx = DuelEngine.makeContext('player', {});

            // 1) Giocatore: deve avanzare di 1.
            ctx.specialSummon('player', blueEyes, 0, 'attack');
            const afterPlayer = SaveManager.getChallengeProgress('summon-blue-eyes-5');

            // 2) Bot: NON deve avanzare oltre (stesso cardId, owner diverso).
            const blueEyes2 = { ...cardDatabase.find((c) => c.id === 1), uid: 'be-2' };
            ctx.specialSummon('bot', blueEyes2, 0, 'attack');
            const afterBot = SaveManager.getChallengeProgress('summon-blue-eyes-5');

            // In Tag Team il compagno IA agisce dal posto `player`: il lato
            // da solo non basta a distinguere chi ha fatto la mossa.
            Tavolo.imposta({ player: 'ia' });
            const blueEyesAlly = { ...cardDatabase.find((c) => c.id === 1), uid: 'be-ally' };
            ctx.specialSummon('player', blueEyesAlly, 2, 'attack');
            const afterAllySummon = SaveManager.getChallengeProgress('summon-blue-eyes-5');
            Tavolo.azzera();

            // Anche le sfide di attivazione ignorano le carte giocate dal
            // compagno IA mentre controlla il posto della squadra.
            SaveManager.setChallengeProgress('activate-pot-of-greed-10', { count: 1, completed: false });
            Tavolo.imposta({ player: 'ia' });
            gameState.phase = 'main1'; gameState.currentPlayer = 'player';
            gameState.playerHand.length = 0;
            const pot = { ...cardDatabase.find((c) => c.id === 36), uid: 'pot-ally' };
            gameState.playerHand.push(pot);
            DuelEngine.activateCard('player', 'hand', 0);
            Tavolo.azzera();

            // La sfida Yugi in Duello Libero non deve avanzare se la vittoria avviene nella Storia.
            SaveManager.setChallengeProgress('defeat-yugi-5', { count: 0, completed: false });
            ChallengeTracker.recordProgress('defeatCharacter', { characterId: 'yugiMuto', mode: 'story' });
            const afterStoryWin = SaveManager.getChallengeProgress('defeat-yugi-5');
            ChallengeTracker.recordProgress('defeatCharacter', { characterId: 'yugiMuto', mode: 'free' });
            const afterFreeWin = SaveManager.getChallengeProgress('defeat-yugi-5');

            // 3) Token (id -1) del giocatore: NON deve avanzare nessuna sfida 'summonMonster' inesistente per id -1 né rompere nulla.
            let tokenThrew = false;
            try {
                const token = { id: -1, name: 'Token di prova', type: 'monster', attack: 0, defense: 0, level: 1, race: 'Guerriero', attribute: 'TERRA' };
                ctx.specialSummon('player', token, 1, 'attack');
            } catch (e) { tokenThrew = true; }

            return { before, afterPlayer, afterBot, afterAllySummon, afterStoryWin, afterFreeWin, tokenThrew };
        });

        t.assert(result.before.count === 0, `Prima di qualunque evocazione il conteggio deve essere 0, ottenuto ${result.before.count}`);
        t.assert(result.afterPlayer.count === 1, `Dopo un'Evocazione Speciale del GIOCATORE il conteggio deve salire a 1, ottenuto ${result.afterPlayer.count}`);
        t.assert(result.afterBot.count === 1, `Un'Evocazione del BOT non deve far avanzare la sfida (deve restare 1), ottenuto ${result.afterBot.count}`);
        t.assert(result.afterAllySummon.count === 1, `Un'Evocazione del compagno IA dal posto player non deve avanzare la sfida, ottenuto ${result.afterAllySummon.count}`);
        await t.page.waitForFunction(() => gameState.chain && !gameState.chain.active && !gameState.chain.resolving, null, { timeout: 15000 });
        t.assert((await t.evaluate(() => SaveManager.getChallengeProgress('activate-pot-of-greed-10').count)) === 1,
            'L’attivazione del Vaso dell’Avidità da parte del compagno IA non deve avanzare la sfida');
        t.assert(result.afterStoryWin.count === 0, `Una vittoria in Storia non deve avanzare la sfida riservata al Duello Libero, ottenuto ${result.afterStoryWin.count}`);
        t.assert(result.afterFreeWin.count === 1, `Una vittoria in Duello Libero deve avanzare la sfida riservata, ottenuto ${result.afterFreeWin.count}`);
        t.assert(!result.tokenThrew, 'Evocare un Token (id -1) non deve lanciare eccezioni nel checkpoint delle Sfide');
    }
};
