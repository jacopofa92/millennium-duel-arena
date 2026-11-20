// Ombra degli Occhi (id 438): "quando 1 o piu' mostri vengono Set sul Terreno del tuo avversario: scegli come bersaglio
// 1 di quei mostri Set; giralo scoperto in Posizione di Attacco".
//
// Bug trovato dall'audit delle Trappole reattive (tools/audit-attivazioni-ia.js --reattive --non-scattate): la carta non
// poteva scattare MAI. Il suo hook era onOpponentSummon, ma un mostro Set coperto non apre la finestra delle Evocazioni
// (non va rivelato: niente effetti "quando Evocato", niente Buco Trappola), e il suo canActivate voleva proprio un mostro
// coperto: due richieste che non si incontravano mai. Ora ha un hook e una finestra suoi (onOpponentSet,
// DuelEngine.openSetResponseWindow), che si apre solo se l'avversario ha una carta che reagisce a un Set.
//
// Duello senza testa (Node): chi risponde e' l'IA vera. Standalone: non apre pagine.
const path = require('path');
const vm = require('vm');

module.exports = {
    name: 'Ombra degli Occhi (438): risponde a un mostro Set e lo gira scoperto in Attacco; un Set normale non apre finestre',
    standalone: true,
    async run({ assert }) {
        const { creaContesto } = require(path.join(__dirname, '..', '..', 'tools', 'duello-senza-testa.js'));
        const respiro = () => new Promise((r) => setImmediate(r));

        const gioca = async (conOmbra) => {
            const { contesto, orologio } = creaContesto({ avversario: 'kaiba', livello: 'hard', seme: 11 });
            const esegui = (c) => vm.runInContext(c, contesto);
            esegui('resetGameState(); Tavolo.imposta({ player: "ia", bot: "ia" }); gameState.livelloIA = { player: "hard", bot: "hard" };');
            esegui(`(function () {
                const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && !DuelEngine.getDefinition(c.id) && c.level === 4);
                const m = (uid, atk, def, nome) => Object.assign({}, base, { uid, attack: atk, defense: def, name: nome });
                gameState.turn = 6; gameState.currentPlayer = 'bot'; gameState.phase = 'main1';
                gameState.botLP = 8000; gameState.playerLP = 8000;
                gameState.botMonsterField = [null, null, null, null, null];
                gameState.playerMonsterField = [null, null, null, null, null];
                gameState.botHand = [m('DA-SETTARE', 1600, 1200, 'Mostro-Set')];
                gameState.hasNormalSummoned = false;
                // L'avversario di chi Setta (il 'player') ha Ombra degli Occhi coperta da un turno.
                gameState.playerSTField = [${conOmbra ? "{ card: Object.assign({}, cardDatabase.find((c) => c.id === 438), { uid: 'OMBRA' }), isFaceDown: true, setOnTurn: 1 }" : 'null'}, null, null, null, null];
                gameState.botSTField = [null, null, null, null, null];
                DuelEngine.recomputeStaticEffects();
            })()`);
            esegui('__logDuello.length = 0;');
            esegui("Comandi.esegui('bot', { tipo: 'evoca', carta: 'DA-SETTARE', mano: 0, casella: 0, posizione: 'defense' })");
            for (let giri = 0, vuoti = 0; giri < 1500 && vuoti < 4; giri++) {
                await respiro();
                if (orologio.inCoda > 0) { orologio.passo(); vuoti = 0; } else if (esegui('DuelEngine.isChainActive()')) vuoti = 0; else vuoti++;
            }
            return {
                log: esegui('__logDuello.slice()').join(' | '),
                mostro: esegui('(function () { const s = gameState.botMonsterField[0]; return s ? { scoperto: !s.isFaceDown, pos: s.position } : null; })()'),
                catenaAperta: esegui('DuelEngine.isChainActive()')
            };
        };

        // 1) Il bot Setta un mostro, il lato avversario ha Ombra degli Occhi: lo gira scoperto in Posizione di Attacco.
        const con = await gioca(true);
        assert(con.mostro && con.mostro.scoperto && con.mostro.pos === 'attack',
            `Ombra degli Occhi deve girare scoperto in Attacco il mostro Set (stato ${JSON.stringify(con.mostro)}; log: ${con.log})`);
        assert(/Ombra degli Occhi gira scoperto/.test(con.log), `Il registro racconta la carta (log: ${con.log})`);
        assert(!con.catenaAperta, 'La Catena si chiude: nessun blocco dopo la risposta');

        // 2) Senza la carta un Set resta coperto e in Difesa, e non succede niente (nessuna finestra in piu').
        const senza = await gioca(false);
        assert(senza.mostro && !senza.mostro.scoperto && senza.mostro.pos === 'defense',
            `Un Set normale resta coperto in Difesa (stato ${JSON.stringify(senza.mostro)}; log: ${senza.log})`);
        assert(!senza.catenaAperta, 'Nessuna Catena rimasta aperta dopo un Set normale');
    }
};
