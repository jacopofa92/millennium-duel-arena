// Nobiluomo dello Sterminio (id 881) e, in generale, ogni effetto che DISTRUGGE una Magia/Trappola e fa scegliere fra carte che sono
// TUTTE del suo controllore: il bot non distrugge una sua carta (chooseFieldCardTarget, card-effects.js), quindi non sceglie nulla.
//
// Bug trovato da un duello senza testa (pegasus/hard, seme 1311, turno 24): il giocatore attivava Nobiluomo, il bot rispondeva
// girando L'Occhio della Verita' (l'unica Trappola avversaria Set), e a quel punto restava solo una Trappola Set PROPRIA del
// giocatore: il rifiuto del bot usciva con `return false` senza chiamare niente, ma Nobiluomo aveva gia' chiesto l'attesa della
// Catena (attendiScelta). La Catena restava «in risoluzione» per sempre e il duello si fermava in Draw Phase. Ora chi rifiuta
// libera l'attesa (options.onNessunaScelta), per Nobiluomo e per gli helper chooseFieldCardTargetWaiting e in sequenza.
//
// Duello senza testa (Node). Standalone: non apre pagine.
const path = require('path');
const vm = require('vm');

module.exports = {
    name: 'Catena: se il bot rifiuta di distruggere una carta propria, l\'attesa si chiude (Nobiluomo dello Sterminio)',
    standalone: true,
    async run({ assert }) {
        const { creaContesto } = require(path.join(__dirname, '..', '..', 'tools', 'duello-senza-testa.js'));
        const respiro = () => new Promise((r) => setImmediate(r));
        const { contesto, orologio, erroriCarte } = creaContesto({ avversario: 'kaiba', livello: 'hard', seme: 3 });
        const esegui = (c) => vm.runInContext(c, contesto);
        esegui('resetGameState(); Tavolo.imposta({ player: "ia", bot: "ia" }); gameState.livelloIA = { player: "hard", bot: "hard" };');
        esegui(`(function () {
            const vuoto = () => [null, null, null, null, null];
            const carta = (id, uid) => Object.assign({}, cardDatabase.find((c) => c.id === id), { uid });
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && !DuelEngine.getDefinition(c.id) && c.level === 4);
            gameState.turn = 6; gameState.currentPlayer = 'player'; gameState.phase = 'main1';
            gameState.playerLP = 8000; gameState.botLP = 8000;
            gameState.playerMonsterField = vuoto(); gameState.botMonsterField = vuoto(); gameState.playerSTField = vuoto(); gameState.botSTField = vuoto();
            gameState.botMonsterField[0] = { card: Object.assign({}, base, { uid: 'B1' }), position: 'attack', isFaceDown: false };
            gameState.playerMonsterField[0] = { card: Object.assign({}, base, { uid: 'P1' }), position: 'attack', isFaceDown: false };
            // Nobiluomo dello Sterminio (881) in mano; il bot ha UNA sola Trappola Set (L'Occhio della Verita', 466: Continua, che
            // risponde girandosi); il giocatore ha una Trappola Set PROPRIA (Maschera Toon, 482): dopo la risposta e' l'unica coperta.
            gameState.playerHand = [carta(881, 'MAGIA')];
            gameState.botSTField[0] = { card: carta(466, 'OCCHIO'), isFaceDown: true, setOnTurn: 1 };
            gameState.playerSTField[0] = { card: carta(482, 'MASCHERA'), isFaceDown: true, setOnTurn: 1 };
            DuelEngine.recomputeStaticEffects();
        })()`);
        esegui('__logDuello.length = 0;');
        esegui("Comandi.esegui('player', { tipo: 'attiva', zona: 'hand', indice: 0, carta: 'MAGIA' })");
        for (let giri = 0, vuoti = 0; giri < 1500 && vuoti < 4; giri++) {
            await respiro();
            if (orologio.inCoda > 0) { orologio.passo(); vuoti = 0; } else if (esegui('DuelEngine.isChainActive()')) vuoti = 0; else vuoti++;
        }
        const log = esegui('__logDuello.slice()').join(' | ');
        const catena = esegui('(function () { const c = gameState.chain; return c ? { attiva: !!c.active, inRisoluzione: !!c.resolving, link: (c.links || []).length } : null; })()');
        assert(/Il bot ha attivato L'Occhio della Verità/.test(log), `Preparazione: il bot deve rispondere girando L'Occhio della Verita' (log: ${log})`);
        assert(!esegui('DuelEngine.isChainActive()') && catena && !catena.attiva && !catena.inRisoluzione,
            `La Catena deve chiudersi: il bot non sceglie nulla ma l'attesa viene liberata (stato ${JSON.stringify(catena)}; log: ${log})`);
        // La Trappola propria del giocatore NON viene distrutta dal bot al posto suo.
        assert(esegui("gameState.playerSTField[0] && gameState.playerSTField[0].card.uid === 'MASCHERA'"), 'Il bot non distrugge e non banda la Trappola Set del giocatore');
        assert(!erroriCarte.length, `Nessun errore di carta (${erroriCarte.join(' | ')})`);
    }
};
