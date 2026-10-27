// L'IA non attiva una Magia che SOLO Special Summona (Mostro Resuscitato 35, Carica Anime 59...) quando la sua
// zona Mostri e' piena: la carta si consumerebbe senza fare niente (segnalato giocando).
module.exports = {
    name: 'IA: nessuna Special Summon da Magia con la zona Mostri piena',
    async run(t) {
        const r = await t.evaluate(() => {
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            const mostro = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            const piena = () => [0, 1, 2, 3, 4].map((i) => ({ card: { ...mostro, uid: 'm' + i }, position: 'attack', isFaceDown: false }));
            const reborn = cardDatabase.find((c) => c.id === 35);
            const potenza = cardDatabase.find((c) => c.id === 1 + 0 && false) || cardDatabase.find((c) => c.type === 'spell' && c.subtype === 'normal' && /Distruggi/.test(c.effect || ''));
            gameState.botGraveyard = [{ ...mostro, uid: 'g1' }];
            gameState.botMonsterField = piena();
            const out = {};
            out.piena = AI_SHARED.attivazioneSensata({ ...reborn, uid: 'r1' }, 'bot', 'hand');
            gameState.botMonsterField = [null, ...piena().slice(1)];
            out.libera = AI_SHARED.attivazioneSensata({ ...reborn, uid: 'r2' }, 'bot', 'hand');
            gameState.botMonsterField = piena();
            out.altraMagia = potenza ? AI_SHARED.attivazioneSensata({ ...potenza, uid: 'p1' }, 'bot', 'hand') : true;
            return out;
        });
        t.assert(r.piena === false, 'Zona piena: Mostro Resuscitato vietato: ' + JSON.stringify(r));
        t.assert(r.libera === true, 'Una casella libera: permesso: ' + JSON.stringify(r));
        t.assert(r.altraMagia === true, 'Una Magia che non evoca non e\' toccata: ' + JSON.stringify(r));
    }
};
