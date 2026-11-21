// Macchina del Tempo (478) non puo' far rientrare un Mostro-Trappola distrutto.
//
// Trovato dalla simulazione dei duelli senza testa (1.9.11): il mazzo di Odion ha Macchina del Tempo e Roccaforte della
// Fortezza Movente (849). Distrutta, la Roccaforte va al Cimitero come TRAPPOLA (duel-engine.js: wasTrapMonster rimette
// type 'trap' prima di ON_DESTROY) e Macchina del Tempo la rimetteva nella zona Mostri con type 'trap': l'invariante
// "solo mostri nella zona Mostri" saltava (~4-8 duelli su 51.000). Una Trappola nel Cimitero non si puo' Special Summonare.
const { openDuel, freezeNaturalGameLoop } = require('../helpers/harness');

module.exports = {
    standalone: true,
    name: 'Macchina del Tempo: un Mostro-Trappola distrutto resta nel Cimitero, un mostro normale rientra',
    async run(t) {
        const errori = [];
        const page = await t.browser.newPage({ viewport: { width: 1400, height: 900 } });
        page.on('pageerror', (e) => errori.push(e.message));
        await openDuel(page, '?mode=free&character=kaiba&difficulty=Normale');
        await freezeNaturalGameLoop(page);

        const esito = await page.evaluate(() => {
            const def = DuelEngine.getDefinition(478);
            const prova = (carta) => {
                gameState.playerMonsterField = [null, null, null, null, null];
                gameState.playerGraveyard = [carta];
                def.onOwnMonsterDestroyed(DuelEngine.makeContext('player', { destroyedCard: carta }));
                return {
                    nelCimitero: gameState.playerGraveyard.includes(carta),
                    nelCampo: gameState.playerMonsterField.filter(Boolean).map((s) => s.card.name + ' (' + s.card.type + ')')
                };
            };
            const modello = (id) => cardDatabase.find((c) => c.id === id);
            // La Roccaforte com'e' quando arriva nel Cimitero: type 'trap'.
            const roccaforte = Object.assign({}, modello(849), { uid: 'roccaforte-prova', type: 'trap' });
            const kuriboh = Object.assign({}, modello(22), { uid: 'kuriboh-prova' });
            return { trappola: prova(roccaforte), mostro: prova(kuriboh), kuribohType: kuriboh.type };
        });

        t.assert(esito.trappola.nelCimitero === true, 'La Roccaforte (Trappola nel Cimitero) deve restare nel Cimitero, non sparire');
        t.assert(esito.trappola.nelCampo.length === 0, `La Roccaforte non deve entrare nella zona Mostri: ${JSON.stringify(esito.trappola.nelCampo)}`);
        t.assert(esito.kuribohType === 'monster', 'Il mostro di prova e\' un mostro');
        t.assert(esito.mostro.nelCimitero === false && esito.mostro.nelCampo.length === 1, `Un mostro normale rientra in campo: ${JSON.stringify(esito.mostro)}`);
        t.assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
        await page.close();
    }
};
