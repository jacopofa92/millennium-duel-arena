// Evocazione Tributo: pagati i Tributi non si puo' piu' "uscire" senza Evocare (segnalato giocando: "ho tributato un mostro, sono
// riuscito a uscire dalla Evocazione e l'ho perso senza fare niente").
//
// Il caso: dopo il Sacrificio restano piu' caselle libere, quindi si apre la scelta "in quale casella?" (pendingTributePlacement).
// Quella scelta non aveva alcuna protezione: un pulsante di fase o "Fine turno" (nextPhase/endTurn/stepper) passava, e il
// clearSelection() del cambio di fase la azzerava. Il mostro sacrificato era gia' nel Cimitero, la carta restava in mano.
// Ora: finche' c'e' una carta con il segno _tributoPerEvocazione in mano, nessun cambio di fase (e nessun altro click sulle carte);
// se la scelta non e' piu' a schermo, si RIAPRE. Alla fine si Evoca per davvero.
const { openDuel, freezeNaturalGameLoop } = require('../helpers/harness');

module.exports = {
    name: 'Evocazione Tributo: pagati i Tributi non si esce senza Evocare',
    standalone: true,
    async run({ browser, assert }) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
        const page = await context.newPage();
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await openDuel(page);
            await freezeNaturalGameLoop(page);
            await page.waitForFunction(() => gameState.currentPlayer === 'player' && gameState.phase === 'main1', null, { timeout: 15000 });

            // Un mostro da 1 Tributo (Livello 5-6) in mano, e un mostro qualunque da sacrificare sul Terreno.
            await page.evaluate(() => {
                const alto = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && getTributesRequired(c) === 1 && !(DuelEngine.getDefinition(c.id) || {}).canTributeSet);
                const basso = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && getTributesRequired(c) === 0 && c.level <= 4);
                gameState.playerHand.length = 0;
                gameState.playerHand.push({ ...alto, uid: 'alto' });
                gameState.playerMonsterField[0] = { card: { ...basso, uid: 'basso' }, position: 'attack', canChangePosition: true, hasAttacked: false };
                gameState.hasNormalSummoned = false;
                updateUI();
                attemptMonsterSummon(gameState.playerHand[0], 0, 3);
            });
            await page.waitForFunction(() => !!gameState.pendingTributeSummon, null, { timeout: 5000 });
            await page.evaluate(() => handleTributeSelectClick(0));
            await page.waitForFunction(() => !!gameState.pendingTributePlacement, null, { timeout: 8000 });

            const stato = () => page.evaluate(() => ({
                fase: gameState.phase,
                inMano: gameState.playerHand.some((c) => c.uid === 'alto'),
                scelta: !!gameState.pendingTributePlacement,
                sacrificato: !gameState.playerMonsterField[0],
                incampo: gameState.playerMonsterField.some((s) => s && s.card.uid === 'alto')
            }));
            const prima = await stato();
            assert(prima.sacrificato && prima.inMano && prima.scelta, `dopo il Sacrificio la scelta della casella deve essere aperta: ${JSON.stringify(prima)}`);

            // 1) il pulsante delle fasi e "Fine turno" non passano
            await page.evaluate(() => { nextPhase(); });
            await page.evaluate(() => { endTurn(); });
            await page.evaluate(() => { handlePhaseStepperClick('battle'); handlePhaseStepperClick('end'); });
            await page.waitForTimeout(400);
            const dopoFase = await stato();
            assert(dopoFase.fase === 'main1' && dopoFase.scelta && dopoFase.inMano, `nessun cambio di fase con l'Evocazione a meta': ${JSON.stringify(dopoFase)}`);

            // 2) un click su un'altra carta o un trascinamento non azzera la scelta
            await page.evaluate(() => { handleCardClick(gameState.playerHand[0], 'hand', 0, 'player'); });
            const dopoClick = await stato();
            assert(dopoClick.scelta, `un click sulla carta non deve annullare la scelta: ${JSON.stringify(dopoClick)}`);

            // 3) se la scelta sparisce per un'altra strada, il tentativo di uscire la RIAPRE (e non la perde)
            await page.evaluate(() => { gameState.pendingTributePlacement = null; document.body.classList.remove('placement-mode'); });
            await page.evaluate(() => { nextPhase(); });
            await page.waitForTimeout(300);
            const riaperta = await stato();
            assert(riaperta.fase === 'main1' && riaperta.scelta, `la scelta persa si riapre: ${JSON.stringify(riaperta)}`);

            // 4) si sceglie la casella: l'Evocazione si completa davvero
            await page.evaluate(() => handleSlotClick('player', 'monster', 3));
            await page.waitForFunction(() => gameState.playerMonsterField.some((s) => s && s.card.uid === 'alto'), null, { timeout: 10000 });
            const fine = await stato();
            assert(fine.incampo && !fine.inMano && !fine.scelta, `l'Evocazione deve concludersi: ${JSON.stringify(fine)}`);

            // 5) concluso, il segno e la protezione spariscono: le fasi tornano libere (non si prova a cambiare fase davvero: nel primo
            //    turno la Battle Phase non esiste)
            const libero = await page.evaluate(() => ({
                chiede: EventiDuello.chiedi('evocazione-in-sospeso', false),
                segno: gameState.playerHand.some((c) => c._tributoPerEvocazione)
            }));
            assert(libero.chiede === false && !libero.segno, `a Evocazione conclusa non deve restare nessun blocco: ${JSON.stringify(libero)}`);
            assert(errori.length === 0, `errori JS: ${errori.join(' | ')}`);
        } finally {
            await context.close();
        }
    }
};
