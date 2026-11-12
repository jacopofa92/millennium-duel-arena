// L'IA deve evitare di sacrificare una copia del Toon che sta evocando se
// esiste un altro Toon legale, preferendo quello di valore inferiore.
module.exports = {
    name: 'IA Toon: conserva la copia della carta evocata quando ha un tributo alternativo',
    async run(t) {
        const r = await t.evaluate(() => {
            Tavolo.azzera();
            Tavolo.imposta({ bot: 'ia' });
            const blueEyesToon = { id: 123, uid: 'blue-eyes-toon-field', name: 'Drago Toon Occhi Blu', type: 'monster', isToon: true, attack: 3000 };
            const weakToon = { id: 481, uid: 'weak-toon-field', name: 'Alligatore Toon', type: 'monster', isToon: true, attack: 800 };
            const summonTarget = { id: 123, uid: 'blue-eyes-toon-hand', name: 'Drago Toon Occhi Blu', type: 'monster', isToon: true, attack: 3000 };
            gameState.botMonsterField = [
                { card: blueEyesToon, isFaceDown: false },
                { card: weakToon, isFaceDown: false }, null, null, null
            ];
            gameState.botGraveyard = [];
            gameState.pendingSpecialSummonTributeUids = null;
            const ctx = DuelEngine.makeContext('bot', { card: summonTarget });
            const paid = CardEffectsShared.resolveSpecialSummonTributeCost(ctx,
                [(card) => card.isToon], 'test tribute');
            const result = {
                paid,
                flagshipRemains: gameState.botMonsterField.some((slot) => slot && slot.card.uid === blueEyesToon.uid),
                weakToonTributed: gameState.botGraveyard.some((card) => card.uid === weakToon.uid)
            };
            Tavolo.azzera();
            return result;
        });
        t.assert(r.paid && r.flagshipRemains && r.weakToonTributed,
            `L'IA conserva il Drago Toon Occhi Blu e sacrifica il Toon meno forte: ${JSON.stringify(r)}`);
    }
};
