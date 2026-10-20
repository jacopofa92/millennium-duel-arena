// Trappola Fasulla (id 600, redirectsTrapDestroyToSelf): "quando
// l'avversario attiverebbe un effetto che distruggerebbe 1+ Trappole
// che controlli, distruggi questa carta al loro posto" — deve proteggere
// OGNI Trappola colpita nella stessa attivazione (es. Piumino delle
// Arpie id 291, che distrugge tutto il campo Magia/Trappola in un colpo
// solo), non solo la prima. Verifica il nuovo batchToken condiviso di
// destroySpellTrap (duel-engine.js).
module.exports = {
    name: 'Trappola Fasulla protegge OGNI Trappola dello stesso lotto, non solo la prima (id 600)',
    async run(t) {
        // Lo spec guarda l'elemento DOM della folata: esiste solo nella versione di base (CSS), non in quella WebGL.
        await t.page.evaluate(() => { window.FX_BACKEND = 'css'; });
        const start = await t.evaluate(() => {
            const fakeTrap = { ...cardDatabase.find((c) => c.id === 600), uid: 'faketrap-1' };
            const trapA = { ...cardDatabase.find((c) => c.type === 'trap' && c.id !== 600), uid: 'trapA-1' };
            const trapB = { ...cardDatabase.find((c) => c.type === 'trap' && c.id !== 600 && c.id !== trapA.id), uid: 'trapB-1' };
            const feathers = { ...cardDatabase.find((c) => c.id === 291), uid: 'feathers-1' };

            // Le 3 Trappole del giocatore, Set in un turno PRECEDENTE (mai
            // attivabili/rispondenti nel turno stesso in cui sono Set).
            gameState.playerSTField = [
                { card: fakeTrap, isFaceDown: true, setOnTurn: gameState.turn - 1 },
                { card: trapA, isFaceDown: true, setOnTurn: gameState.turn - 1 },
                { card: trapB, isFaceDown: true, setOnTurn: gameState.turn - 1 },
                null, null
            ];
            gameState.playerGraveyard = [];
            gameState.botSTField = [null, null, null, null, null];

            const ctx = DuelEngine.makeContext('bot', { card: feathers });
            DuelEngine.getDefinition(291).activate(ctx);
            return { gustVisible: !!document.querySelector('.fx-harpie-gust') };
        });
        t.assert(start.gustVisible, 'Piumino delle Arpie deve far partire la folata sulla fila Magie/Trappole');
        await t.page.waitForTimeout(1250);
        const r1 = await t.evaluate(() => ({
                fakeTrapDestroyed: gameState.playerGraveyard.some((c) => c.uid === 'faketrap-1'),
                trapAStillOnField: gameState.playerSTField.some((s) => s && s.card.uid === 'trapA-1'),
                trapBStillOnField: gameState.playerSTField.some((s) => s && s.card.uid === 'trapB-1'),
                trapAInGraveyard: gameState.playerGraveyard.some((c) => c.uid === 'trapA-1'),
                trapBInGraveyard: gameState.playerGraveyard.some((c) => c.uid === 'trapB-1')
            }));

        t.assert(r1.fakeTrapDestroyed, 'Trappola Fasulla stessa deve essere distrutta (si sacrifica al posto delle altre)');
        t.assert(r1.trapAStillOnField, 'La prima Trappola colpita deve sopravvivere, protetta da Trappola Fasulla');
        t.assert(r1.trapBStillOnField, 'La SECONDA Trappola colpita nello stesso lotto deve sopravvivere anche lei, non solo la prima');
        t.assert(!r1.trapAInGraveyard, 'La prima Trappola non deve finire nel Cimitero');
        t.assert(!r1.trapBInGraveyard, 'La seconda Trappola non deve finire nel Cimitero');
    }
};
