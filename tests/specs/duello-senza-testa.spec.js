// Il nucleo senza testa: duelli interi in Node, senza browser.
//
// Traguardo della Priorità 2 del piano di attacco. tools/duello-senza-testa.js
// carica solo dati, motore, regole e IA (niente game-flow.js né actions.js,
// nessun DOM) e fa giocare duelli fino alla fine. Questo spec ne gioca
// alcuni a seme fisso, con la diagnosi accesa, e boccia se:
//  - una partita si ferma senza un vincitore (stallo del motore);
//  - una carta lancia un errore (nel browser finirebbe solo in console);
//  - un invariante si rompe (Life Points non numerici, una carta non-mostro
//    nella zona Mostri).
// Al primo giro ha trovato quattro difetti veri, presenti anche nel
// browser: gli Spirito che non tornavano in mano, quattro Magie Rituali
// che potevano Evocare la carta sbagliata, Egoista Elegante che Evocava una
// Magia, il Bozzolo dell'Evoluzione in errore ad ogni ricalcolo.
//
// Dalla Priorità 3 (posti al tavolo, js/engine/tavolo.js) i due lati sono
// entrambi l'IA vera: alcune partite danno al posto 'player' il mazzo di un
// personaggio, e una prova a parte controlla che quel posto vinca almeno
// una volta — cioè che l'IA giochi davvero anche da lì, non solo che il
// duello arrivi in fondo.
//
// Standalone: non apre pagine. Gira in pochi secondi.
const path = require('path');

const PARTITE = [
    { avversario: 'kaiba', livello: 'hard', seme: 900 },
    { avversario: 'kaiba', livello: 'hard', giocatore: 'yamiYugi', livelloGiocatore: 'hard', seme: 100 },
    { avversario: 'pegasus', livello: 'medium', giocatore: 'joey', livelloGiocatore: 'easy', seme: 7 },
    { avversario: 'yamiYugi', livello: 'hard', seme: 501 },
    { avversario: 'pegasus', livello: 'medium', seme: 300 },
    { avversario: 'mai', livello: 'medium', seme: 305 },
    { avversario: 'joey', livello: 'easy', seme: 302 },
    { avversario: 'marik', livello: 'hard', seme: 304 },
    { avversario: 'espa_roba', livello: 'easy', seme: 505 },
    { avversario: 'bandit_keith', livello: 'hard', seme: 204 }
];

module.exports = {
    name: 'Nucleo senza testa: duelli interi in Node, senza errori di carta né invarianti rotti',
    standalone: true,
    async run({ assert }) {
        const { giocaPartita } = require(path.join(__dirname, '..', '..', 'tools', 'duello-senza-testa.js'));
        const problemi = [];
        for (const p of PARTITE) {
            const r = await giocaPartita(Object.assign({ diagnosi: true, turni: 60 }, p), 0);
            const dove = `${p.avversario} ${p.livello} seme ${p.seme}`;
            const finita = r.esito === true || r.esito === false || r.esito === 'draw' || r.alLimite;
            if (!finita) problemi.push(`${dove}: ferma al turno ${r.turno} in fase ${r.fasi} (di turno ${r.chi})`);
            if (r.erroriCarte.length) problemi.push(`${dove}: errori di carta — ${[...new Set(r.erroriCarte)].slice(0, 3).join(' | ')}`);
            if (r.invarianti.length) problemi.push(`${dove}: ${r.invarianti.join(' | ')}`);
        }
        assert(problemi.length === 0, `Duelli senza testa:\n  - ${problemi.join('\n  - ')}`);

        // L'IA gioca davvero dal posto 'player': fra Yami Yugi e Kaiba (stesso
        // livello, mazzi di pari peso) su quattro partite a seme fisso ne
        // vince almeno una. Con l'IA ferma su quel lato perderebbe sempre.
        // Dodici partite (si ferma alla prima vittoria): erano quattro, ma i mazzi di Kaiba sono diventati piu' forti (Divinita',
        // limiti di copie) e Yami ne vince circa 3 su 12, quindi il campione di 4 poteva non contenerne nessuna con l'IA sana.
        let vittoriePlayer = 0;
        for (let n = 0; n < 12 && vittoriePlayer === 0; n++) {
            const r = await giocaPartita({ avversario: 'kaiba', livello: 'hard', giocatore: 'yamiYugi', livelloGiocatore: 'hard', seme: 100, turni: 60 }, n);
            if (r.esito === true) vittoriePlayer++;
        }
        assert(vittoriePlayer >= 1, `L'IA dal posto 'player' (Yami Yugi) non vince nessuna delle 12 partite contro Kaiba: gioca davvero da quel lato?`);

        // Per l'audit fattoriale IA e deck avversario devono essere due
        // variabili indipendenti: stessa IA hard, ma liste easy/hard diverse.
        const deckEasy = await giocaPartita({ avversario: 'kaiba', livello: 'hard', livelloDeckAvversario: 'easy', seme: 812, turni: 10 }, 0);
        const deckHard = await giocaPartita({ avversario: 'kaiba', livello: 'hard', livelloDeckAvversario: 'hard', seme: 812, turni: 10 }, 0);
        assert(deckEasy.deckBotIniziale && deckHard.deckBotIniziale
            && deckEasy.deckBotIniziale !== deckHard.deckBotIniziale,
        'Il duello senza testa deve poter cambiare il deck avversario senza cambiare il livello della sua IA');

        // Il bersaglio di un attacco che lascia il campo prima del calcolo dei danni (battaglia.js, resolveAttack): prima
        // resolveBattleDamage leggeva la sua casella vuota ed esplodeva ("Cannot read properties of null (reading 'card')", l'errore
        // raro del test del bot). Dal 2026-11-20 la situazione e' COSTRUITA A MANO: una Trappola di prova del bot distrugge il
        // proprio mostro attaccato in risposta all'attacco. Prima la si cercava in una partita a seme fisso, e ogni ritocco ai
        // mazzi o all'IA (anche una correzione di una carta) poteva far smettere di attraversarla: lo si era dovuto ricercare
        // due volte (2026-10-21, 2026-11-09).
        const vm = require('vm');
        const { creaContesto } = require(path.join(__dirname, '..', '..', 'tools', 'duello-senza-testa.js'));
        const { contesto, orologio, erroriCarte } = creaContesto({ avversario: 'kaiba', livello: 'hard', seme: 21 });
        const esegui = (c) => vm.runInContext(c, contesto);
        esegui('resetGameState(); Tavolo.imposta({ player: "ia", bot: "ia" }); gameState.livelloIA = { player: "hard", bot: "hard" };');
        esegui(`(function () {
            const vuoto = () => [null, null, null, null, null];
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && !DuelEngine.getDefinition(c.id) && c.level === 4);
            const m = (uid, atk) => ({ card: Object.assign({}, base, { uid, attack: atk, defense: 1000 }), position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedOnTurn: 0 });
            // Trappola di prova: in risposta a un attacco distrugge il mostro attaccato (il bersaglio sparisce prima del calcolo).
            cardDatabase.push({ id: 99100, name: 'Trappola di prova (toglie il bersaglio)', type: 'trap', subtype: 'normal', effect: 'Prova.', attribute: '', race: '', level: 0, attack: 0, defense: 0, origin: 'yu-gi-oh' });
            CardEffects.register(99100, {
                canActivate(ctx) { return typeof ctx.targetIndex === 'number' && ctx.targetIndex !== -1; },
                onAttackDeclare(ctx) { ctx.destroyMonster(ctx.owner, ctx.targetIndex); ctx.log('Trappola di prova: il mostro attaccato lascia il campo.'); }
            });
            gameState.turn = 6; gameState.currentPlayer = 'player'; gameState.phase = 'battle';
            gameState.playerLP = 8000; gameState.botLP = 8000;
            gameState.playerMonsterField = vuoto(); gameState.botMonsterField = vuoto(); gameState.playerSTField = vuoto(); gameState.botSTField = vuoto();
            gameState.playerMonsterField[0] = m('ATT', 2400);
            gameState.botMonsterField[0] = m('BER', 1000);
            gameState.botSTField[0] = { card: Object.assign({}, cardDatabase.find((c) => c.id === 99100), { uid: 'TRAPPOLA' }), isFaceDown: true, setOnTurn: 1 };
            DuelEngine.recomputeStaticEffects();
        })()`);
        esegui('__logDuello.length = 0;');
        esegui("Comandi.esegui('player', { tipo: 'attacca', attaccante: 0, bersaglio: 0 })");
        const respiro = () => new Promise((r) => setImmediate(r));
        for (let giri = 0, vuoti = 0; giri < 1500 && vuoti < 4; giri++) {
            await respiro();
            if (orologio.inCoda > 0) { orologio.passo(); vuoti = 0; } else if (esegui('DuelEngine.isChainActive()')) vuoti = 0; else vuoti++;
        }
        const logSparito = esegui('__logDuello.slice()').join(' | ');
        assert(/Il bersaglio non è più sul Terreno/.test(logSparito),
            `L'attacco con il bersaglio sparito deve attraversare il caso e fermarsi senza errori (log: ${logSparito})`);
        assert(!erroriCarte.length && !esegui('DuelEngine.isChainActive()') && esegui('gameState.playerMonsterField[0] && gameState.playerMonsterField[0].hasAttacked === true'),
            `Nessun errore di carta, Catena chiusa e l'attaccante segnato come "ha attaccato" (errori: ${erroriCarte.join(' | ')})`);    }
};
