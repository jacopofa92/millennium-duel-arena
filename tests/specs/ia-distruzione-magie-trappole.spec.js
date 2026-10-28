// L'IA non spazza le Magie/Trappole quando le conviene poco o niente (segnalato giocando: Bakura Difficile usò Tempesta
// Potente contro un giocatore SENZA Magie/Trappole, avendone lui 2, Spada Rivelatrice compresa).
module.exports = {
    name: 'IA: distruzione di massa di Magie e Trappole solo se all\'avversario ne toglie di più',
    async run(t) {
        const r = await t.evaluate(() => {
            const carta = (id) => cardDatabase.find((c) => c.id === id);
            const st = (n) => Array.from({ length: 5 }, (_, i) => (i < n ? { card: { ...carta(10), uid: 'st' + i }, isFaceDown: true } : null));
            const prova = (id, sueBot, sueGiocatore) => {
                gameState.botSTField = st(sueBot);
                gameState.playerSTField = st(sueGiocatore);
                return AI_SHARED.isMassDestructionWorthwhile(carta(id), gameState, 'bot');
            };
            return {
                tempestaAvversarioVuoto: prova(646, 2, 0),   // il caso segnalato
                tempestaPari: prova(646, 2, 2),
                tempestaConviene: prova(646, 0, 2),
                tempestaPocoMeno: prova(646, 1, 2),
                spolverinoVuoto: prova(291, 0, 0),
                spolverinoConUna: prova(291, 3, 1),
                attaccoMagoNeroVuoto: prova(748, 0, 0)
            };
        });
        t.assert(r.tempestaAvversarioVuoto === false, 'Tempesta Potente con l\'avversario senza Magie/Trappole: no');
        t.assert(r.tempestaPari === false, 'Tempesta Potente con lo stesso numero di carte: no');
        t.assert(r.tempestaConviene === true && r.tempestaPocoMeno === true, 'Tempesta Potente quando l\'avversario ne perde di più: sì');
        t.assert(r.spolverinoVuoto === false && r.attaccoMagoNeroVuoto === false, 'Gli effetti che colpiscono solo l\'avversario non partono a vuoto');
        t.assert(r.spolverinoConUna === true, 'Spolverino dell\'Arpia con una carta avversaria da distruggere: sì');
    }
};
