// Tre carte con un divieto di Evocazione, ciascuno col suo perimetro:
//   - Guardiano Falce del Terrore (282): niente Evocazione Normale/Set né
//     Special Summon di altri mostri, per chi la controlla.
//   - L'Ultimo Guerriero di un Altro Pianeta (1045): niente SPECIAL Summon
//     per entrambi i giocatori; l'Evocazione Normale/Set resta libera.
//   - Capro Espiatorio (434): nel turno in cui si attiva niente Evocazioni
//     scoperte né Special Summon, ma il Set sì; dal turno dopo tutto libero.
module.exports = {
    name: 'Divieti di Evocazione: 282, 1045 e 434 (Normale, Set e Special Summon)',
    async run(t) {
        const { page, assert } = t;
        await page.waitForTimeout(500);

        const r = await page.evaluate(async () => {
            const out = {};
            const mostro = (uid, livello) => ({ id: 9000 + livello, uid, name: 'Prova ' + uid, type: 'monster', level: livello || 4, attack: 1500, defense: 1000 });
            const svuota = () => {
                gameState.playerMonsterField = [null, null, null, null, null];
                gameState.botMonsterField = [null, null, null, null, null];
                gameState.playerHand = [];
                gameState.hasNormalSummoned = false;
            };
            const guarda = () => new Promise((r2) => setTimeout(r2, 1800));
            gameState.currentPlayer = 'player';
            gameState.phase = 'main1';

            // --- 1045: solo Special Summon -------------------------------
            svuota();
            gameState.botMonsterField[0] = { card: { id: 1045, uid: 'ult1045', name: 'Ultimo Guerriero', type: 'monster', level: 8, attack: 3000, defense: 3000 }, position: 'attack', isFaceDown: false };
            DuelEngine.recomputeStaticEffects && DuelEngine.recomputeStaticEffects();
            out.flag1045 = JSON.stringify(gameState.specialSummonBlockedFor);
            out.normaleBloccata1045 = JSON.stringify(gameState.otherMonsterSummonsBlockedFor);
            out.ssGiocatore = DuelEngine.actions.specialSummon('player', mostro('ss1'), 0, 'attack');
            out.ssBot = DuelEngine.actions.specialSummon('bot', mostro('ss2'), 1, 'attack');
            out.normaleOk1045 = AI_SHARED.canNormalSummonNow(mostro('n1'), gameState, 'bot');

            // --- 282: anche l'Evocazione Normale -------------------------
            svuota();
            gameState.playerMonsterField[0] = { card: { id: 282, uid: 'falce282', name: 'Guardiano Falce', type: 'monster', level: 8, attack: 2500, defense: 2000 }, position: 'attack', isFaceDown: false };
            DuelEngine.recomputeStaticEffects && DuelEngine.recomputeStaticEffects();
            out.flag282 = JSON.stringify(gameState.otherMonsterSummonsBlockedFor);
            out.normaleOk282Bot = AI_SHARED.canNormalSummonNow(mostro('n2'), gameState, 'player');

            // --- 434: Set sì, scoperto no, Special Summon no, poi libero -
            svuota();
            DuelEngine.recomputeStaticEffects && DuelEngine.recomputeStaticEffects();
            const capro = DuelEngine.getDefinition(434);
            capro.activate(DuelEngine.makeContext('player', { sourceCard: { id: 434, uid: 'capro' } }));
            out.vieta434 = DuelEngine.isSummonBannedThisTurn('player');
            out.vietaAvversario = DuelEngine.isSummonBannedThisTurn('bot');
            const token = gameState.playerMonsterField.filter((s) => s).length;
            out.token = token;

            // Bandit non deve poter usare i Token di Capro Espiatorio per
            // Evocare Drago Revolver. La regola per UID esiste già; questo
            // controlla che Media e Difficile la applichino anche quando
            // scelgono autonomamente i Tributi.
            const tokensBandit = gameState.playerMonsterField.filter(Boolean).slice(0, 2);
            gameState.botMonsterField = [tokensBandit[0], tokensBandit[1], null, null, null];
            gameState.botHand = [{ ...mostro('drago-revolver-prova', 7), attack: 3500, defense: 3000 }];
            const soloTokenMedia = AI_MEDIUM.chooseSummon(gameState, 'bot');
            const soloTokenHard = AI_HARD.chooseSummon(gameState, 'bot');
            out.soloTokenMedia = !!soloTokenMedia;
            out.soloTokenHard = !!soloTokenHard;
            gameState.botMonsterField[2] = { card: { ...mostro('tributo-valido-1', 4), attack: 500 }, position: 'attack', isFaceDown: false };
            gameState.botMonsterField[3] = { card: { ...mostro('tributo-valido-2', 4), attack: 600 }, position: 'attack', isFaceDown: false };
            const conMostriValidi = AI_HARD.chooseSummon(gameState, 'bot');
            out.tributiHard = conMostriValidi ? conMostriValidi.tributeIndices : null;

            gameState.playerMonsterField = [null, null, null, null, null];
            const a = mostro('scoperto'); gameState.playerHand = [a];
            summonMonster(a, 0, 'attack', 0);
            await guarda();
            out.scopertoRifiutato = !gameState.playerMonsterField[0] && gameState.playerHand.length === 1;
            gameState.hasNormalSummoned = false;
            const b = mostro('set'); gameState.playerHand = [b];
            summonMonster(b, 0, 'defense', 0);
            await guarda();
            out.setRiuscito = !!gameState.playerMonsterField[0] && gameState.playerMonsterField[0].isFaceDown === true;
            out.specialRifiutata = DuelEngine.actions.specialSummon('player', mostro('ss3'), 1, 'attack');
            gameState.turn++; // il turno dopo il divieto non vale più
            out.vietaDopo = DuelEngine.isSummonBannedThisTurn('player');
            return out;
        });

        assert(r.flag1045 === '{"player":true,"bot":true}', `1045 vieta le Special Summon a entrambi: ${r.flag1045}`);
        assert(r.normaleBloccata1045 === '{"player":false,"bot":false}', `1045 NON blocca l'Evocazione Normale (flag di 282 spento): ${r.normaleBloccata1045}`);
        assert(r.ssGiocatore === false && r.ssBot === false, `Special Summon rifiutate con 1045 in campo: ${r.ssGiocatore}/${r.ssBot}`);
        assert(r.normaleOk1045 === true, 'Con 1045 in campo l\'Evocazione Normale resta possibile');
        assert(r.flag282 === '{"player":true,"bot":false}', `282 blocca solo chi la controlla: ${r.flag282}`);
        assert(r.normaleOk282Bot === false, '282 blocca anche l\'Evocazione Normale/Set del suo controllore');
        assert(r.token === 4 && r.vieta434 === true && r.vietaAvversario === false, `434: 4 Token e divieto solo per chi l\'ha attivata: ${JSON.stringify([r.token, r.vieta434, r.vietaAvversario])}`);
        assert(!r.soloTokenMedia && !r.soloTokenHard, 'I Token di Capro Espiatorio non devono permettere un’Evocazione Tributo all’IA Media o Difficile');
        assert(JSON.stringify(r.tributiHard) === '[2,3]', `L’IA Difficile deve scegliere solo i due mostri sacrificabili, non i Token: ${JSON.stringify(r.tributiHard)}`);
        assert(r.scopertoRifiutato, '434: un\'Evocazione scoperta nello stesso turno viene rifiutata');
        assert(r.setRiuscito, '434: un Set coperto nello stesso turno è permesso');
        assert(r.specialRifiutata === false, '434: nessuna Special Summon nello stesso turno');
        assert(r.vietaDopo === false, '434: il turno dopo il divieto non vale più');
    }
};
