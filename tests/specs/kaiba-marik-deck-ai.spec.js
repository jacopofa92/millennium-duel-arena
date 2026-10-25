// Audit congiunto dei deck AVVERSARI di Seto Kaiba e Marik Ishtar.
// Starter/Structure non entrano in questo test: qui si proteggono le tre
// liste characterDeckDatabase e le linee che il bot deve saper giocare.
module.exports = {
    name: 'Kaiba e Marik avversari: boss e combo realmente usati dalla IA',
    async run(t) {
        const risultato = await t.evaluate(() => {
            const qty = (personaggio, livello, id) => {
                const voce = characterDeckDatabase[personaggio][livello].main.find((e) => e.id === id);
                return voce ? voce.qty : 0;
            };
            const totale = (personaggio, livello) => characterDeckDatabase[personaggio][livello].main
                .reduce((somma, voce) => somma + voce.qty, 0);
            const copia = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
            const slot = (card) => ({ card, position: 'attack', isFaceDown: false, canChangePosition: true });

            resetGameState();
            Tavolo.imposta({ player: 'ia', bot: 'ia' });
            gameState.currentPlayer = 'bot';
            gameState.phase = 'main1';
            gameState.personaggioPerPosto = { player: null, bot: 'kaiba' };

            // Signore dei D. + Flauto + Drago Bianco: la Magia deve essere
            // una vera azione candidata, non semplice colore nella lista.
            gameState.botMonsterField = [slot(copia(353, 'lord')), null, null, null, null];
            gameState.botSTField = [null, null, null, null, null];
            gameState.botHand = [copia(578, 'flute'), copia(1, 'blue-eyes')];
            const sceltaFlauto = AI_MEDIUM.chooseNextSpellTrapAction(gameState, {}, 'bot');

            // X + Y sul Terreno, una carta da scartare e un bersaglio:
            // la combinazione XY compensa la perdita dei due corpi grazie
            // alla rimozione immediatamente disponibile.
            gameState.botMonsterField = [slot(copia(510, 'x')), slot(copia(513, 'y')), null, null, null];
            gameState.botExtraDeck = [copia(511, 'xy')];
            gameState.botHand = [copia(8, 'discard')];
            gameState.playerMonsterField = [slot(copia(4, 'target')), null, null, null, null];
            gameState.playerSTField = [{ card: copia(8, 'target-spell'), isFaceDown: false }, null, null, null, null];
            const sceltaCombinazione = AI_MEDIUM.chooseBanishFusion(gameState, 'bot');

            gameState.botMonsterField = [slot(copia(511, 'xy-field')), null, null, null, null];
            const sceltaCannone = AI_MEDIUM.chooseSetCardActivation(gameState, 'bot');

            // Obelisk: tre corpi deboli bastano e la IA deve riconoscere il
            // 4000/4000 senza playbook speciale.
            gameState.personaggioPerPosto.bot = 'kaiba';
            gameState.botMonsterField = [0, 1, 2].map((n) => slot(copia(22, `k-${n}`))).concat([null, null]);
            gameState.botHand = [copia(30, 'obelisk')];
            gameState.playerMonsterField = [null, null, null, null, null];
            const sceltaObelisk = AI_HARD.chooseSummon(gameState, 'bot');

            gameState.botMonsterField = [slot(copia(22, 'ok-1')), slot(copia(22, 'ok-2')), null, null, null];
            gameState.botHand = [copia(30, 'obelisk-wait'), copia(1, 'blue-eyes-wait'), copia(510, 'x-build')];
            const sceltaPreparazioneObelisk = AI_HARD.chooseSummon(gameState, 'bot');

            gameState.botMonsterField = [slot(copia(513, 'y-build')), null, null, null, null];
            gameState.botHand = [copia(510, 'x-complete'), copia(502, 'vorse-alternative')];
            const sceltaCompletaXY = AI_HARD.chooseSummon(gameState, 'bot');

            // Ra: 0/0 è soltanto il valore stampato. A campo nemico libero
            // Marik deve stimare il pagamento LP e scegliere i tre Tributi.
            gameState.personaggioPerPosto.bot = 'marik';
            gameState.botLP = 8000;
            gameState.botMonsterField = [0, 1, 2].map((n) => slot(copia(22, `m-${n}`))).concat([null, null]);
            gameState.botHand = [copia(472, 'ra'), copia(8, 's1'), copia(35, 's2')];
            const sceltaRa = AI_HARD.chooseSummon(gameState, 'bot');
            const pagaRaSicuro = AI_SHARED.shouldPayRaLp(gameState, 'bot');
            gameState.playerMonsterField[0] = slot(copia(4, 'threat'));
            const pagaRaConMinaccia = AI_SHARED.shouldPayRaLp(gameState, 'bot');

            gameState.botMonsterField = [slot(copia(22, 'ra-build-1')), null, null, null, null];
            gameState.botHand = [copia(472, 'ra-wait'), copia(1123, 'helpoemer-wait'), copia(265, 'gil-build')];
            const sceltaPreparazioneRa = AI_HARD.chooseSummon(gameState, 'bot');

            gameState.turn = 2;
            gameState.hasNormalSummoned = true;
            gameState.botSTField = [{ card: copia(559, 'offerta'), isFaceDown: true, setOnTurn: 1 }, null, null, null, null];
            gameState.botHand = [copia(265, 'gil-follow-up')];
            const sceltaOfferta = AI_HARD.chooseSetCardActivation(gameState, 'bot');

            return {
                totaliKaiba: ['easy', 'medium', 'hard'].map((l) => totale('kaiba', l)),
                totaliMarik: ['easy', 'medium', 'hard'].map((l) => totale('marik', l)),
                draghiBianchi: ['easy', 'medium', 'hard'].map((l) => qty('kaiba', l, 1)),
                obelisk: ['easy', 'medium', 'hard'].map((l) => qty('kaiba', l, 30)),
                ra: ['easy', 'medium', 'hard'].map((l) => qty('marik', l, 472)),
                sceltaFlauto: sceltaFlauto && sceltaFlauto.card.id,
                sceltaCombinazione: sceltaCombinazione && sceltaCombinazione.card.id,
                sceltaCannone: sceltaCannone && sceltaCannone.card.id,
                sceltaObelisk: sceltaObelisk && sceltaObelisk.card.id,
                tributiObelisk: sceltaObelisk && sceltaObelisk.tributeIndices.length,
                sceltaPreparazioneObelisk: sceltaPreparazioneObelisk && sceltaPreparazioneObelisk.card.id,
                sceltaCompletaXY: sceltaCompletaXY && sceltaCompletaXY.card.id,
                sceltaRa: sceltaRa && sceltaRa.card.id,
                tributiRa: sceltaRa && sceltaRa.tributeIndices.length,
                sceltaPreparazioneRa: sceltaPreparazioneRa && sceltaPreparazioneRa.card.id,
                sceltaOfferta: sceltaOfferta && sceltaOfferta.card.id,
                pagaRaSicuro,
                pagaRaConMinaccia
            };
        });

        t.assert(risultato.totaliKaiba.every((n) => n === 40) && risultato.totaliMarik.every((n) => n === 40),
            `I sei deck devono restare da 40 carte: ${JSON.stringify(risultato)}`);
        t.assert(risultato.draghiBianchi.every((n) => n === 3),
            `Kaiba possiede canonicamente tre Draghi Bianchi: ${risultato.draghiBianchi.join('/')}`);
        t.assert(risultato.obelisk.join('/') === '0/0/1' && risultato.ra.join('/') === '0/0/1',
            `Le Divinità devono restare esclusive del Difficile: ${JSON.stringify(risultato)}`);
        t.assert(risultato.sceltaFlauto === 578, `La IA deve usare il Flauto con Signore dei D. e un Drago: ${JSON.stringify(risultato)}`);
        t.assert(risultato.sceltaCombinazione === 511 && risultato.sceltaCannone === 511,
            `La IA deve combinare X/Y e poi usare la rimozione del Cannone: ${JSON.stringify(risultato)}`);
        t.assert(risultato.sceltaObelisk === 30 && risultato.tributiObelisk === 3,
            `Kaiba Difficile deve poter Evocare Obelisk con tre Tributi: ${JSON.stringify(risultato)}`);
        t.assert(risultato.sceltaPreparazioneObelisk === 510 && risultato.sceltaCompletaXY === 510,
            `Kaiba deve preservare i Tributi e completare intenzionalmente X/Y: ${JSON.stringify(risultato)}`);
        t.assert(risultato.sceltaRa === 472 && risultato.tributiRa === 3,
            `Marik Difficile deve poter Evocare Ra con tre Tributi: ${JSON.stringify(risultato)}`);
        t.assert(risultato.sceltaPreparazioneRa === 265 && risultato.sceltaOfferta === 559,
            `Marik deve preservare il campo per Ra e sfruttare Offerta Suprema: ${JSON.stringify(risultato)}`);
        // Con 8000 LP il bot paga una somma misurata (3000: l'obiettivo minimo) sia a campo libero sia davanti a un mostro da 1400, senza
        // restare a 100 (la politica completa, soglie ed eccezione \"scacco\", e' in ia-ra-somma-da-pagare.spec.js).
        t.assert(risultato.pagaRaSicuro && risultato.pagaRaConMinaccia,
            `Il bot deve pagare per Ra quando puo' farlo senza rischiare: ${JSON.stringify(risultato)}`);
    }
};
