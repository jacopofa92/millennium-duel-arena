// Un Set coperto non attiva l'effetto di Breaker il Guerriero Magico e non
// deve rivelare la carta con l'animazione automatica di un effetto sul campo.
module.exports = {
    name: 'Breaker coperto: niente Segnalino o animazione effetto; il Set conta per Castello-Ingranaggio',
    async run(t) {
        const r = await t.evaluate(async () => {
            const breaker = { ...cardDatabase.find((c) => c.id === 131), uid: 'breaker-set-test' };
            const castle = { ...cardDatabase.find((c) => c.id === 843), uid: 'castle-set-test' };
            gameState.playerMonsterField = Array(5).fill(null);
            gameState.botMonsterField = Array(5).fill(null);
            gameState.playerSTField = Array(5).fill(null);
            gameState.botSTField = Array(5).fill(null);
            gameState.playerFieldSpell = null;
            gameState.botFieldSpell = null;
            gameState.playerSTField[0] = { card: castle, isFaceDown: false, setOnTurn: 1 };
            gameState.playerHand = [breaker];
            gameState.botHand = [];
            gameState.playerGraveyard = [];
            gameState.botGraveyard = [];
            gameState.currentPlayer = 'player';
            gameState.phase = 'main1';
            gameState.turn = 2;
            gameState.hasNormalSummoned = false;
            gameState.normalSummonsUsed = { player: 0, bot: 0 };
            const original = FX.playAutomaticFieldActivation;
            let automaticAnimation = 0;
            FX.playAutomaticFieldActivation = () => { automaticAnimation++; return true; };
            await new Promise((resolve) => Comandi.esegui('player', {
                tipo: 'evoca', carta: breaker.uid, mano: 0, casella: 0, posizione: 'defense'
            }, { alTermine: resolve }));
            FX.playAutomaticFieldActivation = original;
            const setSlot = gameState.playerMonsterField[0];
            return {
                faceDown: !!(setSlot && setSlot.isFaceDown),
                counters: setSlot && setSlot.card.counters || 0,
                castleCounters: castle.counters || 0,
                automaticAnimation
            };
        });
        t.assert(r.faceDown, 'Breaker deve restare coperto in Difesa: ' + JSON.stringify(r));
        t.assert(r.counters === 0, 'Un Set non deve attivare onSummon di Breaker: ' + JSON.stringify(r));
        t.assert(r.automaticAnimation === 0, 'Un Set non deve mostrare l’effetto automatico della carta coperta: ' + JSON.stringify(r));
        t.assert(r.castleCounters === 1, 'Il Castello deve continuare a contare le Evocazioni Normali/Set: ' + JSON.stringify(r));
    }
};
