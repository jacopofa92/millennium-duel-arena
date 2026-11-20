// Spolverino dell'Arpia (291), Ritorno Totale (262), Attacco Magico Oscuro (748): «tutte le Magie/Trappole sul Terreno».
// Colpiscono ANCHE quelle Set, ed e' il caso tipico (l'avversario ha quasi solo carte coperte).
//
// Bug trovati dall'audit delle Trappole reattive (tools/audit-attivazioni-ia.js): il canActivate di 291 contava solo le carte
// SCOPERTE (la carta non risultava attivabile contro sole Trappole Set), e 262 e 748 non toccavano mai le coperte. In piu'
// MASS_EFFECT_KEYWORD (ai-shared.js) non conosceva «tutte le Magie/Trappole»: il bot trattava queste carte da «rimozione di UN
// mostro» e scartava Ali di Grifone (612), che le annulla, aspettando un mostro avversario «che valga abbastanza».
//
// Duello senza testa (Node): chi risponde e' l'IA vera. Standalone: non apre pagine.
const path = require('path');
const vm = require('vm');

module.exports = {
    name: 'Magie/Trappole di massa colpiscono anche le Set (291, 262, 748) e il bot risponde con Ali di Grifone (612)',
    standalone: true,
    async run({ assert }) {
        const { creaContesto } = require(path.join(__dirname, '..', '..', 'tools', 'duello-senza-testa.js'));
        const respiro = () => new Promise((r) => setImmediate(r));

        const gioca = async (idMagia, preparaExtra) => {
            const { contesto, orologio } = creaContesto({ avversario: 'kaiba', livello: 'hard', seme: 3 });
            const esegui = (c) => vm.runInContext(c, contesto);
            esegui('resetGameState(); Tavolo.imposta({ player: "ia", bot: "ia" }); gameState.livelloIA = { player: "hard", bot: "hard" };');
            esegui(`(function () {
                const vuoto = () => [null, null, null, null, null];
                const carta = (id, uid) => Object.assign({}, cardDatabase.find((c) => c.id === id), { uid });
                const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && !DuelEngine.getDefinition(c.id) && c.level === 4);
                const m = (uid) => ({ card: Object.assign({}, base, { uid }), position: 'attack', isFaceDown: false });
                gameState.turn = 6; gameState.currentPlayer = 'player'; gameState.phase = 'main1';
                gameState.playerLP = 8000; gameState.botLP = 8000;
                gameState.playerMonsterField = vuoto(); gameState.botMonsterField = vuoto(); gameState.playerSTField = vuoto(); gameState.botSTField = vuoto();
                gameState.playerMonsterField[0] = m('P1'); gameState.botMonsterField[0] = m('B1');
                gameState.playerHand = [carta(${idMagia}, 'MAGIA')];
                // SOLO carte coperte: e' il caso che prima non funzionava.
                gameState.botSTField[0] = { card: carta(40, 'BT1'), isFaceDown: true, setOnTurn: 1 };
                gameState.botSTField[1] = { card: carta(40, 'BT2'), isFaceDown: true, setOnTurn: 1 };
                ${preparaExtra || ''}
                DuelEngine.recomputeStaticEffects();
            })()`);
            const attivabile = esegui("DuelEngine.canActivate('player', 'hand', 0)");
            esegui('__logDuello.length = 0;');
            esegui("Comandi.esegui('player', { tipo: 'attiva', zona: 'hand', indice: 0, carta: 'MAGIA' })");
            for (let giri = 0, vuoti = 0; giri < 1500 && vuoti < 4; giri++) {
                await respiro();
                if (orologio.inCoda > 0) { orologio.passo(); vuoti = 0; } else if (esegui('DuelEngine.isChainActive()')) vuoti = 0; else vuoti++;
            }
            return {
                attivabile,
                log: esegui('__logDuello.slice()').join(' | '),
                botST: esegui('gameState.botSTField.filter(Boolean).length'),
                botMano: esegui('gameState.botHand.length'),
                playerST: esegui('gameState.playerSTField.filter(Boolean).length')
            };
        };

        // 291 Spolverino dell'Arpia: attivabile contro sole Trappole Set, e le distrugge.
        const piumino = await gioca(291);
        assert(piumino.attivabile === true, `Spolverino dell'Arpia deve essere attivabile contro sole carte coperte (log: ${piumino.log})`);
        assert(piumino.botST === 0, `Spolverino dell'Arpia distrugge anche le Trappole Set (restano ${piumino.botST}; log: ${piumino.log})`);

        // 262 Ritorno Totale: fa tornare in mano TUTTE le Magie/Trappole, anche le Set, di entrambi i lati.
        const trunade = await gioca(262, "gameState.playerSTField[0] = { card: carta(40, 'PT1'), isFaceDown: true, setOnTurn: 1 };");
        assert(trunade.attivabile === true, `Ritorno Totale deve essere attivabile con sole carte coperte (log: ${trunade.log})`);
        assert(trunade.botST === 0 && trunade.playerST === 0, `Ritorno Totale rimanda in mano anche le coperte (bot ${trunade.botST}, giocatore ${trunade.playerST}; log: ${trunade.log})`);

        // 748 Attacco Magico Oscuro: con un Mago Nero scoperto distrugge tutte le Magie/Trappole, Set comprese.
        const attacco = await gioca(748, "gameState.playerMonsterField[1] = { card: carta(2, 'MN'), position: 'attack', isFaceDown: false };");
        assert(attacco.attivabile === true, `Attacco Magico Oscuro deve essere attivabile contro sole coperte (log: ${attacco.log})`);
        assert(attacco.botST === 0, `Attacco Magico Oscuro distrugge anche le Trappole Set (restano ${attacco.botST}; log: ${attacco.log})`);

        // 612 Ali di Grifone: il bot la usa contro lo Spolverino (annulla e distrugge), invece di scartarla.
        const ali = await gioca(291, "gameState.botSTField[2] = { card: carta(612, 'ALI'), isFaceDown: true, setOnTurn: 1 }; gameState.playerSTField[0] = { card: carta(40, 'PT1'), isFaceDown: true, setOnTurn: 1 };");
        assert(/Il bot ha attivato Ali di Grifone/.test(ali.log), `Il bot deve rispondere con Ali di Grifone (log: ${ali.log})`);
        assert(/attivazione di Spolverino dell'Arpia è stata negata|negata/.test(ali.log) && ali.botST >= 2, `Lo Spolverino e' annullato: le Trappole del bot restano (${ali.botST}; log: ${ali.log})`);
    }
};
