// Con tutte e 5 le caselle Mostro occupate, l'Evocazione Tributo deve
// essere avviabile cliccando/trascinando anche una casella occupata (era
// impossibile prima: il vecchio codice rifiutava sempre una casella
// occupata prima ancora di sapere se serviva un Sacrificio). Dopo il
// Sacrificio, se resta un'unica casella libera va usata subito; se ne
// restano di più, va chiesta esplicitamente.
module.exports = {
    name: 'Evocazione Tributo avviabile anche su caselle occupate a campo pieno',
    async run(t) {
        await t.evaluate(() => {
            gameState.currentPlayer = 'player';
            gameState.phase = 'main1';
            gameState.hasNormalSummoned = false;
            const filler = (n) => ({ ...cardDatabase.find((c) => c.id === 4), uid: `filler-${n}` });
            gameState.playerMonsterField = [0, 1, 2, 3, 4].map((n) => ({ card: filler(n), position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: false, summonedOnTurn: 1 }));
            const bigCard = { ...cardDatabase.find((c) => c.id === 6), uid: 'big-1' };
            gameState.playerHand = [bigCard];
            gameState.playerGraveyard = [];
            updateUI();
            handleCardClick(bigCard, 'hand', 0, 'player');
            handleCardClick(gameState.playerMonsterField[2].card, 'monster', 2, 'player', false);
        });

        const started = await t.evaluate(() => ({
            pendingTributeSummon: !!gameState.pendingTributeSummon,
            tributesNeeded: gameState.pendingTributeSummon ? gameState.pendingTributeSummon.tributesNeeded : null
        }));
        t.assert(started.pendingTributeSummon, 'Cliccare una casella occupata deve avviare la selezione dei Sacrifici');
        t.assert(started.tributesNeeded === 1, 'Cavaliere Oscuro (Lv.6) richiede esattamente 1 Sacrificio');

        await t.evaluate(() => { handleTributeSelectClick(0); });
        await t.page.waitForTimeout(900);
        // Dopo un Tributo la Posizione non si sceglie più: un'Evocazione Tributo si
        // fa sempre scoperta in Attacco (vedi eseguiEvocazioneNormale, evocazioni.js),
        // quindi nessun popover Attacco/Difesa e la carta arriva da sola.
        const popover = await t.evaluate(() => !!document.getElementById('quickPopover'));
        t.assert(!popover, 'Dopo il Sacrificio non deve chiedere Attacco/Difesa: un Tributo si Evoca sempre in Attacco');
        await t.page.waitForTimeout(1500);
        const final = await t.evaluate(() => {
            const s = gameState.playerMonsterField[0];
            return s && s.card.uid === 'big-1' ? { posizione: s.position, coperto: s.isFaceDown } : null;
        });
        t.assert(final, 'La carta evocata deve finire nella casella liberata dal Sacrificio');
        t.assert(final.posizione === 'attack' && !final.coperto, 'e deve essere scoperta in Attacco: ' + JSON.stringify(final));
    }
};
