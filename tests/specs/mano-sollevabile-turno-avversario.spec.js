// Richiesta dell'utente: nel turno dell'avversario le carte della mano si possono comunque SOLLEVARE (e leggere), ma non si puo'
// fare nessuna azione: niente popover, Evocazione, attivazione o trascinamento sul campo.
module.exports = {
    name: 'Mano: nel turno dell\'avversario le carte si sollevano e si leggono, ma nessuna azione',
    async run(t) {
        const page = t.page;
        await t.evaluate(() => {
            gameState.currentPlayer = 'bot'; gameState.phase = 'main1'; gameState.turn = 3; gameState.hasNormalSummoned = false;
            // Una Magia attivabile e un mostro Evocabile: in turno proprio aprirebbero un popover o selezionerebbero caselle.
            gameState.playerHand = [4, 10, 1, 7, 36].map((id, i) => ({ ...cardDatabase.find((c) => c.id === id), uid: 'tv-' + i }));
            gameState.selectedCard = { type: null, card: null, index: -1 };
            updateUI(); updateCardInfoPanel(null);
        });
        await page.waitForTimeout(600);
        const stato = () => t.evaluate(() => {
            const p = document.querySelector('.card-info-panel');
            return {
                alte: [...document.querySelectorAll('#playerHand .card')].map((c) => c.classList.contains('selected')),
                pannello: !!(p && p.classList.contains('visible')),
                mano: gameState.playerHand.length,
                campo: gameState.playerMonsterField.filter(Boolean).length + gameState.playerSTField.filter(Boolean).length,
                popover: !!document.getElementById('quickPopover'),
                caselle: document.querySelectorAll('.field-slot.action-highlight, .field-slot.tribute-highlight').length,
                fantasma: !!document.querySelector('.drag-preview'),
                turno: gameState.currentPlayer
            };
        });
        const centro = async (i) => { const b = await (await page.$$('#playerHand .card'))[i].boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };

        // 1) Un tocco solleva la carta e mostra le info.
        let [x, y] = await centro(2);
        await page.mouse.click(x, y);
        await page.waitForTimeout(400);
        let s = await stato();
        t.assert(s.alte[2] && s.alte.filter(Boolean).length === 1, 'Nel turno avversario il tocco solleva la carta: ' + JSON.stringify(s));
        t.assert(s.pannello, 'Nel turno avversario il tocco mostra le info della carta: ' + JSON.stringify(s));
        t.assert(!s.popover && s.caselle === 0, 'Nessun popover ne\' caselle evidenziate (nessuna azione): ' + JSON.stringify(s));

        // 2) Toccarne un'altra sposta il sollevamento.
        [x, y] = await centro(3);
        await page.mouse.click(x, y);
        await page.waitForTimeout(400);
        s = await stato();
        t.assert(s.alte[3] && s.alte.filter(Boolean).length === 1, 'Toccando un\'altra carta si solleva quella: ' + JSON.stringify(s));

        // 3) Trascinare una carta sul campo NON la gioca (niente fantasma, niente Evocazione).
        [x, y] = await centro(0);
        const slot = await (await page.$$('.field-slot[data-owner="player"][data-type="monster"]'))[0].boundingBox();
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2, { steps: 12 });
        s = await stato();
        t.assert(!s.fantasma, 'Nel turno avversario il trascinamento non crea il fantasma: ' + JSON.stringify(s));
        await page.mouse.up();
        await page.waitForTimeout(600);
        s = await stato();
        t.assert(s.mano === 5 && s.campo === 0 && !s.popover, 'Nessuna carta giocata ne\' popover dopo il rilascio sul campo: ' + JSON.stringify(s));
        t.assert(s.turno === 'bot', 'Il turno resta dell\'avversario');
    }
};
