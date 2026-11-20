// Eruzione Vulcanica (817): Trappola Normale che scatta da sola nella End Phase del proprietario se controlla Mondo
// Giurassico. Sta Set: prima il filtro «solo carte scoperte» di firePhaseTrigger la lasciava morta (mai scattata).
// Uccello Tornado (1032): «Magie/Trappole sul Terreno», anche coperte: prima collectFieldTargets le escludeva.
//
// Duello senza testa (Node), standalone: non apre pagine. Chiama direttamente firePhaseTrigger e l'effetto Flip.
const path = require('path');
const vm = require('vm');

module.exports = {
    name: 'Eruzione Vulcanica (817) scatta da Set nella End Phase; Uccello Tornado (1032) rimanda in mano anche le coperte',
    standalone: true,
    async run({ assert }) {
        const { creaContesto } = require(path.join(__dirname, '..', '..', 'tools', 'duello-senza-testa.js'));
        const nuovo = () => {
            const { contesto } = creaContesto({ avversario: 'kaiba', livello: 'hard', seme: 3 });
            const esegui = (c) => vm.runInContext(c, contesto);
            esegui('resetGameState(); Tavolo.imposta({ player: "ia", bot: "ia" });');
            return esegui;
        };
        const prepara = `
            const vuoto = () => [null, null, null, null, null];
            const carta = (id, uid) => Object.assign({}, cardDatabase.find((c) => c.id === id), { uid });
            gameState.turn = 6; gameState.currentPlayer = 'player'; gameState.phase = 'end';
            gameState.playerMonsterField = vuoto(); gameState.botMonsterField = vuoto(); gameState.playerSTField = vuoto(); gameState.botSTField = vuoto();
            gameState.playerGraveyard = []; gameState.botGraveyard = [];
        `;

        // Con Mondo Giurassico scoperto e la Trappola Set da un turno: distrugge le carte sul Terreno, se stessa compresa.
        const esegui1 = nuovo();
        const scattata = esegui1(`(function () { ${prepara}
            gameState.playerFieldSpell = { card: carta(812, 'GIU'), isFaceDown: false, setOnTurn: 1 };
            gameState.playerSTField[0] = { card: carta(817, 'ERU'), isFaceDown: true, setOnTurn: 1 };
            gameState.botSTField[0] = { card: carta(40, 'BT'), isFaceDown: true, setOnTurn: 1 };
            DuelEngine.firePhaseTrigger('onEndPhase', 'player');
            return { mieST: gameState.playerSTField.filter(Boolean).length, botST: gameState.botSTField.filter(Boolean).length, terreno: !!gameState.playerFieldSpell };
        })()`);
        assert(scattata.mieST === 0 && scattata.botST === 0, `Eruzione Vulcanica Set deve scattare e distruggere le carte sul Terreno (restano mie ${scattata.mieST}, bot ${scattata.botST})`);

        // Senza Mondo Giurassico: resta coperta, non succede niente.
        const esegui2 = nuovo();
        const senza = esegui2(`(function () { ${prepara}
            gameState.playerSTField[0] = { card: carta(817, 'ERU'), isFaceDown: true, setOnTurn: 1 };
            gameState.botSTField[0] = { card: carta(40, 'BT'), isFaceDown: true, setOnTurn: 1 };
            DuelEngine.firePhaseTrigger('onEndPhase', 'player');
            return { mia: gameState.playerSTField[0] && gameState.playerSTField[0].isFaceDown, botST: gameState.botSTField.filter(Boolean).length };
        })()`);
        assert(senza.mia === true && senza.botST === 1, `Senza Mondo Giurassico la Trappola resta coperta e non distrugge niente (${JSON.stringify(senza)})`);

        // Posata in questo stesso turno: non puo' ancora scattare, come ogni Trappola.
        const esegui3 = nuovo();
        const stessoTurno = esegui3(`(function () { ${prepara}
            gameState.playerFieldSpell = { card: carta(812, 'GIU'), isFaceDown: false, setOnTurn: 1 };
            gameState.playerSTField[0] = { card: carta(817, 'ERU'), isFaceDown: true, setOnTurn: gameState.turn };
            DuelEngine.firePhaseTrigger('onEndPhase', 'player');
            return gameState.playerSTField.filter(Boolean).length;
        })()`);
        assert(stessoTurno === 1, `Eruzione Vulcanica posata nello stesso turno non deve scattare (restano ${stessoTurno} carte)`);

        // Uccello Tornado: l'avversario ha solo Trappole Set; devono tornare in mano (fino a 2).
        const esegui4 = nuovo();
        const uccello = esegui4(`(function () { ${prepara}
            const bird = carta(1032, 'BIRD');
            gameState.playerMonsterField[0] = { card: bird, position: 'attack', isFaceDown: false };
            gameState.botSTField[0] = { card: carta(40, 'BT1'), isFaceDown: true, setOnTurn: 1 };
            gameState.botSTField[1] = { card: carta(40, 'BT2'), isFaceDown: true, setOnTurn: 1 };
            gameState.botSTField[2] = { card: carta(40, 'BT3'), isFaceDown: true, setOnTurn: 1 };
            gameState.botHand = [];
            DuelEngine.getDefinition(1032).onFlip(DuelEngine.makeContext('player', { card: bird }));
            return { botMano: gameState.botHand.length, botST: gameState.botSTField.filter(Boolean).length };
        })()`);
        assert(uccello.botMano === 2 && uccello.botST === 1, `Uccello Tornado rimanda in mano fino a 2 Trappole Set (mano ${uccello.botMano}, restano ${uccello.botST})`);
    }
};
