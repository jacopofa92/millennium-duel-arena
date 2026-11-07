// Segnalato dall'utente: entrando in Battle Phase, toccando una carta della mano non compariva il pannello info.
// Causa: `gameState.pendingSummon` (impostato all'inizio di un'Evocazione dall'interfaccia) si azzerava solo ANNULLANDO, quindi dopo
// un'Evocazione riuscita restava acceso e isGameplaySelectionActive() sopprimeva il pannello (in Main Phase il ramo della mano lo
// riapre da solo, per questo li' non si vedeva). Qui si gioca il flusso VERO: trascinare un mostro sul campo, scegliere Attacco,
// passare in Battle Phase e toccare una carta della mano.
module.exports = {
    name: 'Info carta: dopo un\'Evocazione dall\'interfaccia il pannello compare ancora toccando la mano in Battle Phase',
    async run(t) {
        const page = t.page;
        // Il banco di prova (tests/helpers/harness.js) ha gia' atteso la cascata d'apertura e fermato il ciclo naturale del duello.
        await t.evaluate(() => {
            gameState.currentPlayer = 'player'; gameState.phase = 'main1'; gameState.turn = 3; gameState.hasNormalSummoned = false;
            gameState.playerHand = [4, 10, 1, 7, 36].map((id, i) => ({ ...cardDatabase.find((c) => c.id === id), uid: 'ic-' + i }));
            updateUI();
        });
        await page.waitForTimeout(600);
        const carta = await (await page.$$('#playerHand .card'))[0].boundingBox();
        const slot = await (await page.$$('.field-slot[data-owner="player"][data-type="monster"]'))[0].boundingBox();
        await page.mouse.move(carta.x + carta.width / 2, carta.y + carta.height / 2);
        await page.mouse.down();
        await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2, { steps: 12 });
        await page.mouse.up();
        await page.waitForSelector('#quickPopover #qpSummonAttack', { timeout: 5000 });
        const durante = await t.evaluate(() => !!gameState.pendingSummon);
        t.assert(durante, 'Durante la scelta della Posizione l\'Evocazione e\' in corso (pendingSummon acceso)');
        await page.click('#qpSummonAttack');
        await page.waitForTimeout(2500);
        const dopo = await t.evaluate(() => ({ pendingSummon: !!gameState.pendingSummon, mostro: gameState.playerMonsterField.filter(Boolean).length, sopp: isGameplaySelectionActive() }));
        t.assert(dopo.mostro === 1, 'Il mostro e\' stato Evocato: ' + JSON.stringify(dopo));
        t.assert(!dopo.pendingSummon && !dopo.sopp, 'Conclusa l\'Evocazione nessuna scelta resta "in corso": ' + JSON.stringify(dopo));

        await t.evaluate(() => handlePhaseStepperClick('battle'));
        await page.waitForTimeout(3500);
        for (const i of [0, 2]) {
            await t.evaluate(() => updateCardInfoPanel(null));
            const c = await (await page.$$('#playerHand .card'))[i].boundingBox();
            await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
            await page.waitForTimeout(400);
            const vis = await t.evaluate(() => { const p = document.querySelector('.card-info-panel'); return !!(p && p.classList.contains('visible')); });
            t.assert(vis, `In Battle Phase toccare la carta ${i} della mano deve mostrare il pannello info`);
        }
    }
};
