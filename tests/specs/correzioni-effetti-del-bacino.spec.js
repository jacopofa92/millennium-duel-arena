// Due difetti trovati da tools/cernita-effetti.js (cernita degli effetti generici, 1500 duelli senza testa):
//
// 1) Maschera del Maledetto (372), onStandbyPhase: il gancio partiva con il mostro equipaggiato GIA' andato via (il motore manda al
//    Cimitero l'Equip orfana solo al prossimo ricalcolo degli effetti, e fra uno e l'altro puo' arrivare la Standby Phase) e
//    equippedTarget() lanciava "Cannot read properties of null (reading 'card')". L'effetto veniva saltato con un errore in console.
// 2) Decreto Reale (426), aiCanActivate: escludeva se stessa con `slot.card.id !== 426`, un id scritto nel codice. Una carta con un
//    id diverso (la stessa definizione riusata da una carta nuova) contava se stessa fra le Trappole e il bot non la attivava piu'.
const { openDuel, freezeNaturalGameLoop } = require('../helpers/harness');

module.exports = {
    standalone: true,
    name: 'Maschera del Maledetto senza mostro non lancia errori; Decreto Reale non dipende dal proprio id',
    async run(t) {
        const errori = [];
        const page = await t.browser.newPage({ viewport: { width: 1400, height: 900 } });
        page.on('pageerror', (e) => errori.push(e.message));
        await openDuel(page, '?mode=free&character=kaiba&difficulty=Normale');
        await freezeNaturalGameLoop(page);

        const esito = await page.evaluate(() => {
            const modello = (id) => cardDatabase.find((c) => c.id === id);
            // --- 1) Maschera del Maledetto ---
            const maschera = (conMostro) => {
                const equip = Object.assign({}, modello(372), { uid: 'maschera-prova', equippedToOwner: 'player', equippedToIndex: 0, equippedToUid: 'mostro-prova' });
                gameState.playerMonsterField = [null, null, null, null, null];
                if (conMostro) gameState.playerMonsterField[0] = { card: Object.assign({}, modello(22), { uid: 'mostro-prova' }), position: 'attack', isFaceDown: false };
                gameState.playerSTField = [{ card: equip, isFaceDown: false }, null, null, null, null];
                gameState.playerLP = 8000;
                let errore = null;
                try { DuelEngine.getDefinition(372).onStandbyPhase(DuelEngine.makeContext('player', { card: equip, zone: 'st', index: 0 })); } catch (e) { errore = e.message; }
                return { errore, lp: gameState.playerLP };
            };
            // --- 2) Decreto Reale con un id diverso dal suo ---
            const decreto = Object.assign({}, modello(426), { id: 900426, uid: 'decreto-prova' });
            const trappola = (uid) => ({ card: Object.assign({}, modello(10), { uid }), isFaceDown: true });
            gameState.playerSTField = [{ card: decreto, isFaceDown: false }, null, null, null, null];
            gameState.botSTField = [trappola('t1'), trappola('t2'), null, null, null];
            const ctx = DuelEngine.makeContext('player', { card: decreto, zone: 'st', index: 0 });
            const decretoConIdDiverso = DuelEngine.getDefinition(426).aiCanActivate(ctx);
            return { senzaMostro: maschera(false), conMostro: maschera(true), decretoConIdDiverso };
        });

        t.assert(esito.senzaMostro.errore === null, `Senza il mostro equipaggiato la Maschera non deve lanciare: ${esito.senzaMostro.errore}`);
        t.assert(esito.senzaMostro.lp === 8000, `Senza il mostro non infligge danni (LP ${esito.senzaMostro.lp})`);
        t.assert(esito.conMostro.errore === null && esito.conMostro.lp === 7500, `Con il mostro infligge 500 danni al suo controllore (${JSON.stringify(esito.conMostro)})`);
        t.assert(esito.decretoConIdDiverso === true, 'Decreto Reale con un id diverso da 426 deve poter essere attivato dal bot (non conta se stesso fra le Trappole)');
        t.assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
        await page.close();
    }
};
