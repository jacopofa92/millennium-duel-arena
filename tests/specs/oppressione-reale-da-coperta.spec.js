// Oppressione Reale (id 882) SET: chi la controlla puo' usarla per negare la Special Summon dell'avversario, senza doverla
// prima girare (non ha `activate`, quindi nulla poteva girarla: da Set era una carta morta).
//
// Trovato dall'audit delle Trappole reattive: la finestra di risposta (specialSummon, duel-engine.js) si apriva solo se c'era
// una Oppressione SCOPERTA. Ora si apre anche per una copia coperta di CHI RISPONDE (l'avversario di chi Evoca); la copia
// coperta di chi Evoca non risponde a se' stesso. Il bot non scende sotto 2000 LP per usarla (aiCanActivate).
//
// Duello senza testa (Node): chi risponde e' l'IA vera. Standalone: non apre pagine.
const path = require('path');
const vm = require('vm');

module.exports = {
    name: 'Oppressione Reale da Set: il bot nega la Special Summon, resta scoperta; non risponde a se stessa ne\' con pochi LP',
    standalone: true,
    async run({ assert }) {
        const { creaContesto } = require(path.join(__dirname, '..', '..', 'tools', 'duello-senza-testa.js'));
        const respiro = () => new Promise((r) => setImmediate(r));

        // lato: dove sta la Oppressione ('bot' = avversario di chi Evoca, 'player' = chi Evoca); lp: Life Point del bot.
        const gioca = async (lato, lpBot) => {
            const { contesto, orologio } = creaContesto({ avversario: 'kaiba', livello: 'hard', seme: 5 });
            const esegui = (c) => vm.runInContext(c, contesto);
            esegui('resetGameState(); Tavolo.imposta({ player: "ia", bot: "ia" }); gameState.livelloIA = { player: "hard", bot: "hard" };');
            esegui(`(function () {
                const vuoto = () => [null, null, null, null, null];
                const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && !DuelEngine.getDefinition(c.id) && c.level === 4);
                gameState.turn = 6; gameState.currentPlayer = 'player'; gameState.phase = 'main1';
                gameState.playerLP = 8000; gameState.botLP = ${lpBot};
                gameState.playerMonsterField = vuoto(); gameState.botMonsterField = vuoto(); gameState.playerSTField = vuoto(); gameState.botSTField = vuoto();
                gameState.botMonsterField[0] = { card: Object.assign({}, base, { uid: 'B1' }), position: 'attack', isFaceDown: false };
                gameState.playerHand = [];
                for (const c of cardDatabase) {
                    if (c.type !== 'monster' || c.extraDeck || !DuelEngine.getDefinition(c.id)) continue;
                    gameState.playerHand.unshift(Object.assign({}, c, { uid: 'SPECIALE' }));
                    if (DuelEngine.canSpecialSummonFromHand('player', 0)) break;
                    gameState.playerHand.shift();
                }
                const oppressione = { card: Object.assign({}, cardDatabase.find((c) => c.id === 882), { uid: 'OPPRESSIONE' }), isFaceDown: true, setOnTurn: 1 };
                if ('${lato}' === 'bot') gameState.botSTField[0] = oppressione; else gameState.playerSTField[0] = oppressione;
                DuelEngine.recomputeStaticEffects();
            })()`);
            esegui('__logDuello.length = 0;');
            esegui("Comandi.esegui('player', { tipo: 'specialeDaMano', carta: 'SPECIALE', mano: 0, posizione: 'attack' })");
            for (let giri = 0, vuoti = 0; giri < 1500 && vuoti < 4; giri++) {
                await respiro();
                if (orologio.inCoda > 0) { orologio.passo(); vuoti = 0; } else if (esegui('DuelEngine.isChainActive()')) vuoti = 0; else vuoti++;
            }
            return esegui(`({
                log: __logDuello.slice().join(' | '),
                mostroInCampo: gameState.playerMonsterField.some((s) => s && s.card.uid === 'SPECIALE'),
                botLP: gameState.botLP,
                oppressione: (function () { const s = gameState.botSTField[0] || gameState.playerSTField[0]; return s ? { scoperta: !s.isFaceDown } : null; })()
            })`);
        };

        // 1) Copia coperta del BOT (avversario di chi Evoca), 8000 LP: nega, paga 800, resta scoperta in campo.
        const nega = await gioca('bot', 8000);
        assert(!nega.mostroInCampo && nega.botLP === 7200, `Da Set deve negare e pagare 800 LP (mostro in campo: ${nega.mostroInCampo}, LP bot ${nega.botLP}; log: ${nega.log})`);
        assert(nega.oppressione && nega.oppressione.scoperta, `Dopo l'uso resta scoperta sul Terreno (Continua): ${JSON.stringify(nega.oppressione)}`);

        // 2) Con pochi LP (2500) il bot non la usa: scenderebbe sotto 2000.
        const povero = await gioca('bot', 2500);
        assert(povero.mostroInCampo && povero.botLP === 2500, `Con 2500 LP il bot non paga 800 per negare (mostro in campo: ${povero.mostroInCampo}, LP ${povero.botLP}; log: ${povero.log})`);

        // 3) Copia coperta di CHI EVOCA: non risponde alla propria Evocazione.
        const propria = await gioca('player', 8000);
        assert(propria.mostroInCampo, `Una Oppressione coperta di chi Evoca non nega la sua stessa Special Summon (log: ${propria.log})`);
    }
};
