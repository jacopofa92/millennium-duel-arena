// Oppressione Reale (id 882): verifica che una Special Summon negata non
// raggiunga i trigger di Evocazione e che la Continua possa usarla chiunque.
module.exports = {
    name: 'Oppressione Reale: la usa anche l\'avversario di chi la controlla',
    async run(t) {
        const prepara = (coperta, daEffetto) => t.evaluate(({ coperta, daEffetto }) => {
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            gameState.playerLP = 8000;
            gameState.botLP = 8000;
            gameState.gameOver = false;
            gameState.turn = 6;
            gameState.currentPlayer = 'bot';
            gameState.phase = 'main1';
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.playerSTField = [null, null, null, null, null];
            gameState.botSTField = [null, null, null, null, null];
            gameState.playerHand = [];
            gameState.botGraveyard = [];
            gameState.chain = { links: [], active: false };
            // Oppressione Reale è del BOT.
            gameState.botSTField[0] = {
                card: { ...cardDatabase.find((c) => c.id === 882), uid: 'oppressione' },
                isFaceDown: coperta, setOnTurn: gameState.turn - 1
            };
            DuelEngine.recomputeStaticEffects();
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && !DuelEngine.getDefinition(c.id));
            window.__evocato = { ...base, uid: 'evocato-bot' };
            // Il BOT Special Summona: risponde il giocatore.
            const contesto = daEffetto
                ? { card: { id: 1, uid: 'fonte-effetto', name: 'Effetto evocante' } }
                : {};
            DuelEngine.makeContext('bot', contesto).specialSummon('bot', window.__evocato, 0, 'attack', 'hand');
        }, { coperta, daEffetto });

        // --- Scoperta: il giocatore la usa e la Special Summon è annullata ---
        await prepara(false);
        await t.page.waitForFunction(() => document.getElementById('activateModal') && document.getElementById('activateModal').classList.contains('open'), null, { timeout: 10000 });
        const testo = await t.evaluate(() => document.getElementById('activateModal').textContent);
        t.assert(testo.includes('Oppressione Reale'), `Il giocatore si vede offrire la carta del bot (${testo.slice(0, 120)})`);
        await t.page.click('#activateConfirmBtn');
        await t.page.waitForFunction(() => !DuelEngine.isChainActive(), null, { timeout: 15000 });
        const esito = await t.evaluate(() => ({
            lpPlayer: gameState.playerLP,
            lpBot: gameState.botLP,
            mostroVivo: gameState.botMonsterField.some((s) => s && s.card.uid === 'evocato-bot'),
            mostroNelCimitero: gameState.botGraveyard.some((c) => c.uid === 'evocato-bot'),
            cartaAlBot: !!(gameState.botSTField[0] && gameState.botSTField[0].card.uid === 'oppressione' && !gameState.botSTField[0].isFaceDown)
        }));
        t.assert(esito.lpPlayer === 7200 && esito.lpBot === 8000, `Paga chi risponde, non chi la controlla (${JSON.stringify(esito)})`);
        t.assert(!esito.mostroVivo && esito.mostroNelCimitero, `La Special Summon viene annullata prima che il mostro entri nel campo (${JSON.stringify(esito)})`);
        t.assert(esito.cartaAlBot, `La carta resta scoperta sul Terreno del bot: è Continua e non viene consumata (${JSON.stringify(esito)})`);

        // Una risposta dopo la risoluzione non può annullare retroattivamente
        // l'effetto di una carta che ha già prodotto la Special Summon.
        await prepara(false, true);
        await t.page.waitForTimeout(3500);
        const evocazioneDaEffetto = await t.evaluate(() => ({
            modale: !!(document.getElementById('activateModal') && document.getElementById('activateModal').classList.contains('open')),
            mostroVivo: gameState.botMonsterField.some((s) => s && s.card.uid === 'evocato-bot'),
            lpPlayer: gameState.playerLP
        }));
        t.assert(!evocazioneDaEffetto.modale && evocazioneDaEffetto.mostroVivo && evocazioneDaEffetto.lpPlayer === 8000,
            `Oppressione non si attiva a effetto evocante già risolto (${JSON.stringify(evocazioneDaEffetto)})`);

        // --- Coperta: è del bot, il giocatore non può usarla ---
        await prepara(true);
        await t.page.waitForTimeout(3500);
        const coperta = await t.evaluate(() => ({
            modale: !!(document.getElementById('activateModal') && document.getElementById('activateModal').classList.contains('open')),
            mostroVivo: gameState.botMonsterField.some((s) => s && s.card.uid === 'evocato-bot'),
            lpPlayer: gameState.playerLP
        }));
        t.assert(!coperta.modale && coperta.mostroVivo && coperta.lpPlayer === 8000, `Coperta non viene offerta al giocatore (${JSON.stringify(coperta)})`);
    }
};
