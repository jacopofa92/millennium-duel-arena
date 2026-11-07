// Tribute Set (regola vera, ripristinata il 2026-11-07 su richiesta dell'utente): pagato il Tributo la persona sceglie fra Attacco
// e Difesa coperta. Qui si sceglie la DIFESA per un mostro da Livello 6; per un Dio Egizio (def.cannotBeSet) non c'e' nessuna
// scelta da fare e la carta arriva da sola in Attacco.
module.exports = {
    name: 'Tribute Set: dopo un Tributo la persona puo\' scegliere la Difesa coperta (non per i Dei Egizi)',
    async run(t) {
        const prepara = (idCarta) => t.evaluate((id) => {
            gameState.currentPlayer = 'player';
            gameState.phase = 'main1';
            gameState.hasNormalSummoned = false;
            gameState.pendingSummon = null; gameState.pendingTributeSummon = null; gameState.pendingTributePlacement = null;
            const filler = (n) => ({ ...cardDatabase.find((c) => c.id === 4), uid: `filler-${id}-${n}` });
            gameState.playerMonsterField = [0, 1, 2, 3, 4].map((n) => ({ card: filler(n), position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: false, summonedOnTurn: 1 }));
            const grande = { ...cardDatabase.find((c) => c.id === id), uid: 'big-' + id };
            gameState.playerHand = [grande];
            gameState.playerGraveyard = [];
            updateUI();
            handleCardClick(grande, 'hand', 0, 'player');
            handleCardClick(gameState.playerMonsterField[2].card, 'monster', 2, 'player', false);
            return gameState.pendingTributeSummon ? gameState.pendingTributeSummon.tributesNeeded : null;
        }, idCarta);

        // 1) Cavaliere Oscuro (id 6, Livello 6): 1 Tributo, poi Difesa -> Tribute Set coperto.
        const servono = await prepara(6);
        t.assert(servono === 1, 'Cavaliere Oscuro richiede 1 Sacrificio: ' + servono);
        await t.evaluate(() => { handleTributeSelectClick(0); });
        await t.page.waitForSelector('#quickPopover #qpSummonDefense', { timeout: 5000 });
        await t.page.click('#qpSummonDefense');
        await t.page.waitForTimeout(1500);
        const set = await t.evaluate(() => { const s = gameState.playerMonsterField[0]; return s && s.card.uid === 'big-6' ? { posizione: s.position, coperto: s.isFaceDown } : null; });
        t.assert(set && set.posizione === 'defense' && set.coperto, 'Tribute Set: Difesa coperta nella casella liberata: ' + JSON.stringify(set));

        // 2) Obelisco (id 30, Dio Egizio): 3 Tributi, nessuna scelta di Posizione, esce in Attacco.
        const serv3 = await prepara(30);
        t.assert(serv3 === 3, 'Obelisco richiede 3 Sacrifici: ' + serv3);
        await t.evaluate(() => { handleTributeSelectClick(0); handleTributeSelectClick(1); handleTributeSelectClick(3); });
        await t.page.waitForTimeout(1500);
        // Tre caselle liberate: si sceglie dove piazzare il Dio (poi, per lui, nessuna scelta di Posizione).
        await t.evaluate(() => { if (gameState.pendingTributePlacement) handleSlotClick('player', 'monster', 0); });
        await t.page.waitForTimeout(2500);
        const popover = await t.evaluate(() => !!document.getElementById('qpSummonDefense'));
        t.assert(!popover, 'Per un Dio Egizio non si offre la Difesa: un Tributo vuol dire solo Attacco');
        const dio = await t.evaluate(() => {
            const s = gameState.playerMonsterField.find((x) => x && x.card.uid === 'big-30');
            return s ? { posizione: s.position, coperto: s.isFaceDown } : null;
        });
        t.assert(dio && dio.posizione === 'attack' && !dio.coperto, 'Il Dio Egizio arriva in Attacco scoperto: ' + JSON.stringify(dio));
    }
};
