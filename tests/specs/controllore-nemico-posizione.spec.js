// Regressione trovata dall'audit dei Duellanti Forbidden Memories:
// Sacerdote Seto usa Controllore Nemico anche senza un proprio mostro da
// offrire. In quel ramo la carta deve cambiare Posizione al bersaglio; una
// variabile rimasta dalla vecchia implementazione faceva invece saltare
// l'effetto con ReferenceError.
module.exports = {
    name: 'Controllore Nemico cambia Posizione senza mostro da offrire',
    async run(t) {
        const risultato = await t.evaluate(() => {
            resetGameState();
            const carta = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
            const controller = carta(226, 'controller');
            const bersaglio = carta(4, 'bersaglio');
            gameState.currentPlayer = 'bot';
            // Il test chiama direttamente la definizione senza attraversare
            // l'avvio completo del duello, quindi inizializza il registro
            // per-istanza normalmente creato dal ricalcolo degli statici.
            gameState.immuneToCardEffectsExceptDestinyBoardUids = {};
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.playerMonsterField = [
                { card: bersaglio, position: 'attack', isFaceDown: false },
                null, null, null, null
            ];
            DuelEngine.recomputeStaticEffects();
            const errori = [];
            const originale = console.error;
            console.error = (...args) => errori.push(args.map(String).join(' '));
            try {
                DuelEngine.getDefinition(226).activate(DuelEngine.makeContext('bot', { card: controller }));
            } finally {
                console.error = originale;
            }
            return {
                posizione: gameState.playerMonsterField[0]?.position,
                errori
            };
        });
        t.assert(risultato.posizione === 'defense',
            `Senza sacrificio il bersaglio deve passare in Difesa: ${JSON.stringify(risultato)}`);
        t.assert(risultato.errori.length === 0,
            `L'effetto non deve lanciare errori: ${JSON.stringify(risultato.errori)}`);
    }
};
