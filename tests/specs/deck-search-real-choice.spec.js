// Correzione di un bug reale segnalato dall'utente: diverse carte con un
// vero "cerca 1 carta con una categoria di requisiti dal Deck" (Sangan
// id 433, Uccello Sonico id 601, e la famiglia "1500 ATK/DEF dal Deck"
// — Kamakiri Volante #1 id 248, Pomodoro Mistico id 390, Strega della
// Foresta Nera id 508, Ratto Gigante id 614, Drago Mascherato id 644,
// Tartaruga UFO id 675, Madre Grizzly id 695, Angelo Splendente id 878)
// usavano deck.findIndex(...) — il PRIMO candidato nell'ordine del Deck
// mescolato, mai una vera scelta — senza nemmeno un missingEffectNote
// che lo documentasse. Nuovo helper condiviso searchDeckWithChoice
// (card-effects.js) apre un vero picker (DuelEngineUI.openCardListPicker)
// per il giocatore umano quando ci sono più candidati diversi, con
// fallback all'euristica "il primo trovato" per il bot — verificato qui
// con entrambi i lati.
module.exports = {
    name: 'searchDeckWithChoice: vera scelta per il giocatore, auto-pick invariato per il bot (Sangan id 433 e famiglia "1500 dal Deck")',
    async run(t) {
        // Il giocatore vede DAVVERO il picker con TUTTI i candidati, e la
        // sua scelta (non il primo del Deck) viene rispettata.
        const playerChoiceResult = await t.evaluate(() => {
            const sangan = { ...cardDatabase.find((c) => c.id === 433), uid: 'sangan-1' };
            const cand1 = { ...cardDatabase.find((c) => c.type === 'monster' && c.attack <= 1500 && !c.extraDeck), uid: 'cand-1' };
            const cand2 = { ...cardDatabase.find((c) => c.type === 'monster' && c.attack <= 1500 && !c.extraDeck && c.id !== cand1.id), uid: 'cand-2' };
            gameState.playerDeck = [cand1, cand2];
            gameState.playerHand = [];
            gameState.usedOncePerTurnEffect = {};
            const ctx = DuelEngine.makeContext('player', { card: sangan });
            DuelEngine.getDefinition(433).onDestroy(ctx);
            return { modalOpen: document.getElementById('cardListPickerModal').classList.contains('open') };
        });
        t.assert(playerChoiceResult.modalOpen, 'Sangan (giocatore, 2+ candidati diversi) deve aprire un vero picker, non scegliere da solo');

        // Seleziona il SECONDO candidato mostrato (non il primo/quello che
        // findIndex avrebbe preso automaticamente) e verifica che sia
        // DAVVERO quello che finisce in mano.
        const items = await t.page.locator('#cardListPickerRow .card-list-item').count();
        t.assert(items === 2, `Il picker deve mostrare esattamente 2 candidati (rilevati ${items})`);
        await t.page.locator('#cardListPickerRow .card-list-item').nth(1).click();
        await t.page.waitForTimeout(150);
        const afterPick = await t.evaluate(() => ({
            handUids: gameState.playerHand.map((c) => c.uid),
            deckLength: gameState.playerDeck.length
        }));
        t.assert(afterPick.handUids.includes('cand-2'), `Deve finire in mano ESATTAMENTE la carta scelta dal giocatore (cand-2), non la prima del Deck (rilevato ${JSON.stringify(afterPick.handUids)})`);
        t.assert(afterPick.deckLength === 1, 'Il Deck deve perdere esattamente 1 carta (quella scelta)');

        // Il BOT non ha alcun modale: deve continuare a scegliere da solo
        // (comportamento identico a prima, nessuna regressione).
        const botResult = await t.evaluate(() => {
            const sangan = { ...cardDatabase.find((c) => c.id === 433), uid: 'sangan-2' };
            const cand1 = { ...cardDatabase.find((c) => c.type === 'monster' && c.attack <= 1500 && !c.extraDeck), uid: 'bot-cand-1' };
            const cand2 = { ...cardDatabase.find((c) => c.type === 'monster' && c.attack <= 1500 && !c.extraDeck && c.id !== cand1.id), uid: 'bot-cand-2' };
            gameState.botDeck = [cand1, cand2];
            gameState.botHand = [];
            gameState.usedOncePerTurnEffect = {};
            const ctx = DuelEngine.makeContext('bot', { card: sangan });
            DuelEngine.getDefinition(433).onDestroy(ctx);
            return { handLength: gameState.botHand.length, deckLength: gameState.botDeck.length };
        });
        t.assert(botResult.handLength === 1, 'Il bot deve comunque ottenere 1 carta in mano senza alcun picker (auto-pick invariato)');
        t.assert(botResult.deckLength === 1, 'Il Deck del bot deve perdere esattamente 1 carta');

        // Nessun candidato disponibile: nessun errore, nessun picker, il "una volta per turno" non si consuma a vuoto.
        const noneResult = await t.evaluate(() => {
            const sangan = { ...cardDatabase.find((c) => c.id === 433), uid: 'sangan-3' };
            gameState.playerDeck = [{ ...cardDatabase.find((c) => c.type === 'monster' && c.attack > 1500), uid: 'too-strong-1' }];
            gameState.playerHand = [];
            gameState.usedOncePerTurnEffect = {};
            const ctx = DuelEngine.makeContext('player', { card: sangan });
            DuelEngine.getDefinition(433).onDestroy(ctx);
            return { handLength: gameState.playerHand.length, usedOnce: !!gameState.usedOncePerTurnEffect[`sangan-name:player`] };
        });
        t.assert(noneResult.handLength === 0, 'Senza alcun candidato idoneo, la mano non deve cambiare');
        t.assert(!noneResult.usedOnce, 'Senza alcun candidato idoneo, il vincolo "una volta per turno" non deve consumarsi a vuoto');

        // Famiglia "Special Summon dal Deck": un solo candidato -> nessun
        // picker necessario (scelta automatica dell'unico disponibile),
        // stesso comportamento sensato già visto per altri picker del motore.
        const singleCandidateResult = await t.evaluate(() => {
            const kamakiri = { ...cardDatabase.find((c) => c.id === 248), uid: 'kamakiri-1' };
            const onlyCandidate = { ...cardDatabase.find((c) => c.type === 'monster' && c.attribute === 'VENTO' && c.attack <= 1500 && !c.extraDeck), uid: 'only-wind-1' };
            gameState.playerDeck = [onlyCandidate];
            gameState.playerMonsterField = [null, null, null, null, null];
            // Kamakiri Volante si attiva solo se viene distrutto in
            // battaglia: il test della scelta singola deve fornire quel contesto.
            const ctx = DuelEngine.makeContext('player', { card: kamakiri, destroyedInBattle: true });
            DuelEngine.getDefinition(248).onDestroy(ctx);
            return {
                modalOpen: document.getElementById('cardListPickerModal').classList.contains('open'),
                onField: gameState.playerMonsterField.some((s) => s && s.card.uid === 'only-wind-1')
            };
        });
        t.assert(!singleCandidateResult.modalOpen, 'Con un solo candidato non deve aprirsi alcun picker');
        t.assert(singleCandidateResult.onField, 'L\'unico candidato deve comunque essere Special Summonato automaticamente');
    }
};
