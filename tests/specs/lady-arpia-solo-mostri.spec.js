// "Lady Arpia" nei testi delle carte di supporto vuol dire un MOSTRO.
//
// Trovato dal duello senza testa (tools/duello-senza-testa.js) e confermato
// nel browser: isHarpieLadySupport riconosceva le Lady Arpia dal solo nome,
// e "Lady Arpia Formazione Fenice" (id 289) è una Magia il cui nome
// comincia allo stesso modo. Egoista Elegante (id 787) la Special
// Summonava dalla mano come un mostro, senza ATK: i Life Points di chi la
// attaccava diventavano NaN.
module.exports = {
    name: 'Lady Arpia: le carte di supporto contano solo i mostri, non la Magia 289 (787)',
    async run(t) {
        const r = await t.evaluate(() => {
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            const lady = cardDatabase.find((c) => c.name === 'Lady Arpia' && c.type === 'monster');
            const ragazza = cardDatabase.find((c) => c.type === 'monster' && c.name && c.name.startsWith('Lady Arpia') && c.id !== lady.id);
            gameState.botMonsterField = [{ card: { ...lady, uid: 'lady' }, position: 'attack', isFaceDown: false }, null, null, null, null];
            // In mano prima la Magia, poi un vero mostro Lady Arpia: Egoista
            // Elegante deve saltare la Magia e prendere il mostro.
            gameState.botHand = [{ ...cardDatabase.find((c) => c.id === 289), uid: 'fenice' }, { ...ragazza, uid: 'vera' }];
            const ego = { ...cardDatabase.find((c) => c.id === 787), uid: 'ego' };
            DuelEngine.getDefinition(787).activate(DuelEngine.makeContext('bot', { card: ego }));
            return {
                campo: gameState.botMonsterField.filter(Boolean).map((s) => ({ uid: s.card.uid, tipo: s.card.type })),
                mano: gameState.botHand.map((c) => c.uid)
            };
        });
        t.assert(r.campo.every((s) => s.tipo === 'monster'), `Nessuna Magia nella zona Mostri (${JSON.stringify(r)})`);
        t.assert(r.campo.some((s) => s.uid === 'vera') && r.mano.join() === 'fenice', `Evocato il vero mostro Lady Arpia, la Magia resta in mano (${JSON.stringify(r)})`);
    }
};
