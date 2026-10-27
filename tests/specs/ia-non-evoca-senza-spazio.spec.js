// L'IA non attiva una Magia/Trappola che SOLO Special Summona (Mostro Resuscitato 35, Carica Anime 59, Spirito
// Occhi Rossi 1252, Festa Isterica 790...) quando la sua zona Mostri e' piena: la carta si consumerebbe senza
// fare niente (segnalato giocando). Non deve invece vietare le carte che liberano una casella, quelle che
// hanno solo un'abilita' da usare dopo, ne' una Magia che non evoca.
module.exports = {
    name: 'IA: nessuna Special Summon da Magia con la zona Mostri piena',
    async run(t) {
        const r = await t.evaluate(() => {
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            const mostro = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            const campo = () => [0, 1, 2, 3, 4].map((i) => ({ card: { ...mostro, uid: 'm' + i }, position: 'attack', isFaceDown: false }));
            const prova = (id, piena) => {
                gameState.botMonsterField = piena ? campo() : [null, ...campo().slice(1)];
                return AI_SHARED.attivazioneSensata({ ...cardDatabase.find((c) => c.id === id), uid: 'x' }, 'bot', 'hand');
            };
            gameState.botGraveyard = [{ ...mostro, uid: 'g1' }];
            const out = {};
            // evocano e basta: vietate a zona piena, permesse con una casella libera
            [35, 59, 1252, 434].forEach((id) => { out['piena' + id] = prova(id, true); out['libera' + id] = prova(id, false); });
            // libera una casella (Tributo/Sacrificio): non si vieta
            out.tributo415 = prova(415, true);
            // Continua con solo un'abilita' successiva (Una volta per turno): non si vieta
            out.abilita670 = prova(670, true) === prova(670, false);
            // una Magia che non evoca
            const altra = cardDatabase.find((c) => c.type === 'spell' && c.subtype === 'normal' && /Distruggi/.test(c.effect || '') && !/Summon/.test(c.effect || ''));
            gameState.botMonsterField = campo();
            out.altra = AI_SHARED.attivazioneSensata({ ...altra, uid: 'p1' }, 'bot', 'hand');
            return out;
        });
        [35, 59, 1252, 434].forEach((id) => {
            t.assert(r['piena' + id] === false, `Zona piena: carta ${id} vietata: ${JSON.stringify(r)}`);
        });
        [35, 59, 434].forEach((id) => {
            t.assert(r['libera' + id] === true, `Una casella libera: carta ${id} permessa: ${JSON.stringify(r)}`);
        });
        t.assert(r.abilita670, `Una Continua con abilita' successiva non cambia: ${JSON.stringify(r)}`);
        t.assert(r.altra === true, `Una Magia che non evoca non e' toccata: ${JSON.stringify(r)}`);
    }
};
