// Le Magie Rapide (subtype 'quick-play') come risposta in Catena, con l'opzione
// "Magie Rapide nel turno dell'avversario" (Impostazioni > Regole di gioco).
//
// Regole che si tengono ferme:
//  - dalla MANO una Rapida risponde solo nel proprio turno;
//  - da Set non risponde nel turno in cui e' stata Set;
//  - nel turno dell'avversario una Rapida Set risponde SOLO con l'opzione accesa;
//  - una Magia Normale non risponde mai (velocita' 1);
//  - il bot non e' mai candidato;
//  - con una Trappola Contatore in cima alla Catena nessuna Rapida risponde;
//  - la domanda si apre davvero in una Catena vera.
module.exports = {
    name: 'Magie Rapide in Catena: mano e Set nel proprio turno, Set nel turno avversario solo con l\'opzione',
    async run(t) {
        await t.evaluate(() => {
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            gameState.gameOver = false;
            gameState.turn = 20;
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.playerSTField = [null, null, null, null, null];
            gameState.botSTField = [null, null, null, null, null];
            gameState.playerHand = [];
            gameState.botHand = [];
            gameState.chain = { links: [], active: false };
            gameState.phase = 'main1';
            gameState.currentPlayer = 'player';
            // un mostro scoperto, perche' Guardiano Affidabile (595) ha un bersaglio
            gameState.playerMonsterField[0] = { card: { ...cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck), uid: 'mostro-p' }, position: 'attack', isFaceDown: false };
            SaveManager.setSetting('magieRapideTurnoAvversario', false);
        });
        const cand = (chi) => t.evaluate((chi) => DuelEngine.findQuickPlaySpellCandidates(chi, new Set()).map((c) => c.zone + ':' + c.card.id), chi);
        const rapida = (uid) => ({ id: 595, uid });

        // 1) Mano, proprio turno: risponde
        await t.evaluate((r) => { gameState.playerHand = [{ ...cardDatabase.find((c) => c.id === 595), uid: r }]; }, 'r-mano');
        t.assert(JSON.stringify(await cand('player')) === '["hand:595"]', 'Rapida in mano, proprio turno: candidata');

        // 2) Mano, turno dell'avversario: mai
        await t.evaluate(() => { gameState.currentPlayer = 'bot'; });
        t.assert((await cand('player')).length === 0, 'Rapida in mano nel turno avversario: non risponde');
        await t.evaluate(() => { gameState.playerHand = []; });

        // 3) Set: turno avversario spento = no, acceso = si, ma non se Set in questo turno
        await t.evaluate(() => {
            gameState.playerSTField[0] = { card: { ...cardDatabase.find((c) => c.id === 595), uid: 'r-set' }, isFaceDown: true, setOnTurn: 19 };
        });
        t.assert((await cand('player')).length === 0, 'Rapida Set, turno avversario, opzione spenta: non risponde');
        await t.evaluate(() => SaveManager.setSetting('magieRapideTurnoAvversario', true));
        t.assert(JSON.stringify(await cand('player')) === '["st:595"]', 'Rapida Set, turno avversario, opzione accesa: risponde');
        await t.evaluate(() => { gameState.playerSTField[0].setOnTurn = 20; });
        t.assert((await cand('player')).length === 0, 'Rapida Set in questo stesso turno: non risponde');
        await t.evaluate(() => { gameState.playerSTField[0].setOnTurn = 19; });

        // 4) Proprio turno con l'opzione spenta: la Set risponde
        await t.evaluate(() => { SaveManager.setSetting('magieRapideTurnoAvversario', false); gameState.currentPlayer = 'player'; });
        t.assert(JSON.stringify(await cand('player')) === '["st:595"]', 'Rapida Set, proprio turno: risponde anche a opzione spenta');

        // 5) Il bot non e' mai candidato; una Normale non lo e' mai
        await t.evaluate(() => {
            gameState.botSTField[0] = { card: { ...cardDatabase.find((c) => c.id === 595), uid: 'r-bot' }, isFaceDown: true, setOnTurn: 19 };
            const normale = cardDatabase.find((c) => c.type === 'spell' && c.subtype === 'normal' && DuelEngine.getDefinition(c.id));
            gameState.playerSTField[1] = { card: { ...normale, uid: 'normale' }, isFaceDown: true, setOnTurn: 19 };
        });
        t.assert((await cand('bot')).length === 0, 'Il bot non e\' mai candidato');
        t.assert(JSON.stringify(await cand('player')) === '["st:595"]', 'Una Magia Normale Set non risponde');

        // 6) Trappola Contatore in cima: nessuna Rapida
        await t.evaluate(() => {
            const contatore = cardDatabase.find((c) => c.type === 'trap' && c.subtype === 'counter');
            gameState.chain = { active: true, links: [{ owner: 'bot', card: { ...contatore, uid: 'cont' }, def: {}, handlerName: 'activate', ctx: {} }] };
        });
        t.assert((await cand('player')).length === 0, 'Con una Trappola Contatore in cima nessuna Rapida risponde');
        await t.evaluate(() => { gameState.chain = { links: [], active: false }; });

        // 6b) Finestra di priorita' a vuoto nel turno avversario: spenta = passa subito, accesa = si apre
        await t.evaluate(() => { gameState.currentPlayer = 'bot'; gameState.quickEffectsDeclined = null; });
        const spenta = await t.evaluate(() => { window.__pf = false; DuelEngine.openPriorityWindow('player', 'end', () => { window.__pf = true; }); return window.__pf; });
        t.assert(spenta === true, 'Opzione spenta: la finestra a vuoto passa subito');
        await t.evaluate(() => SaveManager.setSetting('magieRapideTurnoAvversario', true));
        const accesa = await t.evaluate(() => { window.__pf = false; DuelEngine.openPriorityWindow('player', 'end', () => { window.__pf = true; }); return { fatta: window.__pf, aperta: DuelEngine.isPriorityWindowOpen() }; });
        t.assert(!accesa.fatta && accesa.aperta, 'Opzione accesa: la finestra a vuoto offre la Rapida Set');
        await t.page.waitForFunction(() => document.getElementById('activateModal').classList.contains('open'), null, { timeout: 20000 });
        await t.evaluate(() => { document.getElementById('activateModal').classList.remove('open'); });
        await t.page.waitForFunction(() => !DuelEngine.isPriorityWindowOpen(), null, { timeout: 20000 }).catch(() => {});
        await t.evaluate(() => { gameState.currentPlayer = 'player'; SaveManager.setSetting('magieRapideTurnoAvversario', false); gameState.chain = { links: [], active: false }; });

        // 7) Catena vera: il bot attiva una Magia, la Rapida Set del giocatore e' offerta
        await t.evaluate(() => {
            window.__catenaFinita = false;
            const magia = cardDatabase.find((c) => c.type === 'spell' && c.subtype === 'normal' && DuelEngine.getDefinition(c.id));
            DuelEngine.openActivationWindow({
                owner: 'bot', card: { ...magia, uid: 'm-bot' }, handlerName: 'activate',
                def: { activate() {} }, ctx: { owner: 'bot' }, isManualActivation: true, alreadyAnnounced: true, activatedAt: 0
            }, () => { window.__catenaFinita = true; });
        });
        await t.page.waitForFunction(() => document.getElementById('activateModal').classList.contains('open'), null, { timeout: 20000 });
        t.assert(true, 'La domanda di risposta si apre con una Rapida Set a disposizione');
    }
};
