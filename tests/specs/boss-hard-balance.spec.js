'use strict';

module.exports = {
    name: 'Boss Hard: liste da 40 carte e identita strategiche protette',
    async run(t) {
        const esito = await t.evaluate(() => {
            const ids = ['yugiMuto', 'bakura', 'gozaburo', 'noah', 'heishin', 'nitemare'];
            const qty = (deck, id) => (deck.main.find((c) => c.id === id) || { qty: 0 }).qty;
            const mazzi = Object.fromEntries(ids.map((id) => [id, getCharacterDeck(id, 'hard')]));
            return {
                validi: ids.every((id) => deckListCount(mazzi[id].main) === 40
                    && mazzi[id].main.every((c) => c.qty >= 1 && c.qty <= 3)),
                yugi: [qty(mazzi.yugiMuto, 433), qty(mazzi.yugiMuto, 508), qty(mazzi.yugiMuto, 409)],
                bakura: [qty(mazzi.bakura, 866), qty(mazzi.bakura, 192), qty(mazzi.bakura, 891)],
                gozaburo: [qty(mazzi.gozaburo, 230), qty(mazzi.gozaburo, 161), qty(mazzi.gozaburo, 251)],
                noah: [qty(mazzi.noah, 1007), qty(mazzi.noah, 1001), qty(mazzi.noah, 884)],
                heishin: [qty(mazzi.heishin, 409), qty(mazzi.heishin, 382), qty(mazzi.heishin, 36)],
                nitemare: [qty(mazzi.nitemare, 409), qty(mazzi.nitemare, 382), qty(mazzi.nitemare, 36), qty(mazzi.nitemare, 17)],
                separati: mazzi.nitemare !== getCharacterDeck('darkNite', 'hard')
                    && mazzi.nitemare.main !== getCharacterDeck('darkNite', 'hard').main
            };
        });
        t.assert(esito.validi, 'Tutti i boss devono avere 40 carte e non piu di tre copie per carta');
        t.assert(JSON.stringify(esito.yugi) === '[2,2,1]', 'Yugi Hard deve conservare il motore di ricerca Exodia');
        t.assert(JSON.stringify(esito.bakura) === '[1,2,2]', 'Bakura Hard deve conservare Destiny Board/Necropaura');
        t.assert(JSON.stringify(esito.gozaburo) === '[1,1,2]', 'Gozaburo Hard deve conservare il motore Exodia Necross');
        t.assert(JSON.stringify(esito.noah) === '[3,3,2]', 'Noah Hard deve restare centrato sui Mostri Spirito');
        // 1.4.97: Heishin e Nitemare ammorbiditi su richiesta (Raigeki 409 e Controllo/Anfora in meno,
        // Jinzo 17 in piu' per Nitemare): restano i boss piu' duri ma non piu' un muro (4% -> 16%).
        t.assert(JSON.stringify(esito.heishin) === '[0,1,2]', 'Heishin Hard deve avere consistenza da superboss');
        t.assert(JSON.stringify(esito.nitemare) === '[0,1,1,3]', 'Nitemare Hard deve restare il boss estremo');
        t.assert(esito.separati, 'Nitemare non deve tornare a condividere il deck di DarkNite');
    }
};
