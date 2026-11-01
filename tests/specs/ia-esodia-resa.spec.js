// L'IA tiene in mano i pezzi di Exodia solo finche' il piano e' vivo (AI_SHARED.shouldHoldForExodia con gameState e posto):
//  - un pezzo gia' perso (Cimitero, bandito o sul Terreno) chiude il piano: gli altri pezzi tornano mostri normali;
//  - dal turno 12 con meno di 4 pezzi in mano il piano si arrende; con 4 pezzi si continua;
//  - senza contesto (chiamata storica) il pezzo si tiene sempre (ia-trattiene-pezzi-exodia).
// Misura su Yugi Muto: i duelli con 3+ pezzi fermi in mano a fine partita scendono dal 13-20% a meno del 5%.
module.exports = {
    name: 'IA: i pezzi di Exodia si tengono finche\' il piano e\' vivo, poi tornano mostri normali',
    async run(t) {
        const r = await t.evaluate(() => {
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            const pezzo = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
            const [P1, P2, P3, P4, P5] = EXODIA_PIECE_IDS;
            const prova = (turno, mano, cimitero, campo) => {
                gameState.turn = turno;
                gameState.botHand = mano.map((id, i) => pezzo(id, 'm' + i));
                gameState.botGraveyard = (cimitero || []).map((id, i) => pezzo(id, 'g' + i));
                gameState.botBanished = [];
                gameState.botMonsterField = [0, 1, 2, 3, 4].map((i) => (campo && campo[i] ? { card: pezzo(campo[i], 'c' + i), position: 'attack', isFaceDown: false } : null));
                return AI_SHARED.shouldHoldForExodia(pezzo(P1, 'x'), gameState, 'bot');
            };
            return {
                storico: AI_SHARED.shouldHoldForExodia(pezzo(P1, 'x')),
                nonUnPezzo: AI_SHARED.shouldHoldForExodia({ id: 2 }, gameState, 'bot'),
                presto: prova(3, [P1, P2], [], null),
                persoNelCimitero: prova(3, [P1, P2, P3], [P4], null),
                sulTerreno: prova(3, [P1, P2], [], [P5]),
                tardiPochi: prova(13, [P1, P2], [], null),
                tardiQuattro: prova(13, [P1, P2, P3, P4], [], null)
            };
        });
        t.assert(r.storico === true, `Senza contesto il pezzo si tiene sempre: ${JSON.stringify(r)}`);
        t.assert(r.nonUnPezzo === false, `Una carta qualunque non e' un pezzo: ${JSON.stringify(r)}`);
        t.assert(r.presto === true, `Presto e con il piano intatto si tiene: ${JSON.stringify(r)}`);
        t.assert(r.persoNelCimitero === false, `Un pezzo nel Cimitero chiude il piano: ${JSON.stringify(r)}`);
        t.assert(r.sulTerreno === false, `Un pezzo sul Terreno chiude il piano: ${JSON.stringify(r)}`);
        t.assert(r.tardiPochi === false, `Dal turno 12 con 2 pezzi il piano si arrende: ${JSON.stringify(r)}`);
        t.assert(r.tardiQuattro === true, `Con 4 pezzi in mano si continua anche tardi: ${JSON.stringify(r)}`);
    }
};
