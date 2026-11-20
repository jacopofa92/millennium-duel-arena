// Spostamento / Cambio (id 622): "quando il tuo avversario designa esattamente 1 mostro che controlli come bersaglio per
// un ATTACCO, o con un effetto Magia/Trappola: scegli un altro mostro come nuovo bersaglio".
//
// Bug trovato dall'audit delle Trappole reattive (tools/audit-attivazioni-ia.js --reattive --non-scattate): la carta non
// scattava MAI su un attacco. findTriggerCandidates filtra ogni candidata con def.canActivate, e quello di Spostamento
// guardava solo la meta' "effetto" (ctx.sourceType spell/trap): in un attacco quel campo non esiste, quindi la meta'
// d'attacco non veniva offerta a nessuno (ne' al bot ne' a una persona). Il test esistente (targeting-ridirezione-scelta)
// copre solo la meta' dell'effetto.
//
// Duello senza testa (Node): il bot e' l'IA vera e risponde da solo. Standalone: non apre pagine.
const path = require('path');
const vm = require('vm');

module.exports = {
    name: 'Spostamento (622): ridirige anche l\'ATTACCO verso un altro mostro, e non risponde senza un altro mostro',
    standalone: true,
    async run({ assert }) {
        const { creaContesto } = require(path.join(__dirname, '..', '..', 'tools', 'duello-senza-testa.js'));
        const respiro = () => new Promise((r) => setImmediate(r));

        const gioca = async (mostriBot, bersaglio) => {
            const { contesto, orologio } = creaContesto({ avversario: 'kaiba', livello: 'hard', seme: 7 });
            const esegui = (c) => vm.runInContext(c, contesto);
            esegui('resetGameState(); Tavolo.imposta({ player: "ia", bot: "ia" }); gameState.livelloIA = { player: "hard", bot: "hard" };');
            esegui(`(function () {
                const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && !DuelEngine.getDefinition(c.id) && c.level === 4);
                let n = 0;
                const m = (atk, def, nome) => Object.assign({}, base, { uid: 'T' + (++n), attack: atk, defense: def, name: nome });
                const slot = (c) => ({ card: c, position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedOnTurn: 0 });
                gameState.turn = 6; gameState.currentPlayer = 'player'; gameState.phase = 'battle';
                gameState.botLP = 8000; gameState.playerLP = 8000;
                gameState.botMonsterField = ${JSON.stringify(mostriBot)}.map((a, i) => slot(m(a, 1000, i === 0 ? 'B-debole' : 'B-forte')));
                while (gameState.botMonsterField.length < 5) gameState.botMonsterField.push(null);
                gameState.playerMonsterField = [slot(m(2400, 1500, 'G-forte')), null, null, null, null];
                gameState.botSTField = [{ card: Object.assign({}, cardDatabase.find((c) => c.id === 622), { uid: 'SPOSTAMENTO' }), isFaceDown: true, setOnTurn: 1 }, null, null, null, null];
                gameState.playerSTField = [null, null, null, null, null];
                DuelEngine.recomputeStaticEffects();
            })()`);
            esegui('__logDuello.length = 0;');
            esegui(`Comandi.esegui('player', { tipo: 'attacca', attaccante: 0, bersaglio: ${bersaglio} })`);
            for (let giri = 0, vuoti = 0; giri < 1500 && vuoti < 4; giri++) {
                await respiro();
                if (orologio.inCoda > 0) { orologio.passo(); vuoti = 0; } else if (esegui('DuelEngine.isChainActive()')) vuoti = 0; else vuoti++;
            }
            return esegui('__logDuello.slice()').join(' | ');
        };

        // 1) Il bot ha due mostri e viene attaccato il debole: Spostamento deve scattare e ridirigere verso l'altro.
        const conDue = await gioca([1000, 2600], 0);
        assert(/Il bot ha attivato Spostamento|Il bot ha attivato Cambio/.test(conDue), `Spostamento deve rispondere a un attacco (log: ${conDue})`);
        assert(/ridirige l'attacco verso B-forte/.test(conDue), `L'attacco deve passare al mostro piu' forte (log: ${conDue})`);
        assert(/G-forte attacca B-forte/.test(conDue), `Dopo la ridirezione si combatte contro il nuovo bersaglio (log: ${conDue})`);

        // 2) Un solo mostro: non c'e' un altro bersaglio, la carta non deve scattare (e non deve rompere l'attacco).
        const conUno = await gioca([1000], 0);
        assert(!/ridirige/.test(conUno), `Senza un altro mostro Spostamento non scatta (log: ${conUno})`);
        assert(/G-forte attacca B-debole/.test(conUno), `L'attacco prosegue normalmente (log: ${conUno})`);

        // 3) Attacco DIRETTO (nessun mostro bersaglio): niente da ridirigere.
        const diretto = await gioca([1000, 2600], -1);
        assert(!/ridirige/.test(diretto), `Un attacco diretto non ha un bersaglio-mostro da ridirigere (log: ${diretto})`);
    }
};
