// Scorrimento della mano con il dito (1.4.184, actions.js handleDragMove).
// Su touch un gesto che parte sulla mano e va soprattutto di LATO non trascina la carta: scorre la mano, sollevando una carta alla volta
// (quella sotto il dito) con il suo box info. Il gesto verso l'ALTO resta il trascinamento. Qui si provano con eventi pointer di tipo touch.
module.exports = {
    name: 'Mano su touch: scorrere di lato solleva una carta alla volta, salire in alto la trascina',
    async run(t) {
        const prepara = async (fase) => {
            await t.evaluate((f) => {
                gameState.currentPlayer = 'player';
                gameState.phase = f;
                gameState.hasNormalSummoned = false;
                gameState.playerHand = [4, 10, 1, 7, 36].map((id, i) => ({ ...cardDatabase.find((c) => c.id === id), uid: 'sc-' + i }));
                gameState.selectedCard = { type: null, card: null, index: -1 };
                updateUI();
            }, fase);
            await t.page.waitForTimeout(500);
        };
        // Invia una sequenza di punti come pointer touch: prima sulla carta `da`, poi lungo i punti dati. Torna lo stato a gesto in corso.
        const gesto = (da, punti, rilascia) => t.evaluate(([da, punti, rilascia]) => {
            const carte = [...document.querySelectorAll('#playerHand .card')];
            const b = carte[da].getBoundingClientRect();
            const x0 = b.left + b.width / 2, y0 = b.top + b.height / 2;
            const ev = (tipo, x, y) => new PointerEvent(tipo, { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y });
            carte[da].dispatchEvent(ev('pointerdown', x0, y0));
            const letti = [];
            punti.forEach(([dx, dy]) => {
                document.dispatchEvent(ev('pointermove', x0 + dx, y0 + dy));
                letti.push({
                    alte: carte.map((c) => c.classList.contains('selected')),
                    fantasma: !!document.querySelector('.drag-preview'),
                    sorgenteNascosta: carte.some((c) => c.classList.contains('dragging-source'))
                });
            });
            if (rilascia) document.dispatchEvent(ev('pointerup', x0 + punti[punti.length - 1][0], y0 + punti[punti.length - 1][1]));
            return letti;
        }, [da, punti, rilascia]);
        const larghezza = () => t.evaluate(() => document.querySelector('#playerHand .card').getBoundingClientRect().width);

        // 1) Main Phase: scorrimento laterale = una carta alla volta, nessun trascinamento
        await prepara('main1');
        const w = await larghezza();
        let r = await gesto(0, [[12, 1], [w * 0.8, 2], [w * 1.6, 3], [w * 2.6, 3]], true);
        t.assert(r.every((x) => !x.fantasma && !x.sorgenteNascosta), 'Scorrendo di lato non deve nascere il fantasma del trascinamento: ' + JSON.stringify(r));
        t.assert(r[1].alte[1] && r[1].alte.filter(Boolean).length === 1, 'Sopra la seconda carta si solleva solo la seconda: ' + JSON.stringify(r[1]));
        t.assert(r[3].alte[2] && r[3].alte.filter(Boolean).length === 1, 'Oltre, si solleva solo la terza: ' + JSON.stringify(r[3]));
        const dopo = await t.evaluate(() => ({ mano: gameState.playerHand.length, campo: gameState.playerMonsterField.filter(Boolean).length, sel: gameState.selectedCard.index }));
        t.assert(dopo.mano === 5 && dopo.campo === 0, 'Lo scorrimento non deve giocare nessuna carta: ' + JSON.stringify(dopo));
        t.assert(dopo.sel === 2, 'Al rilascio resta selezionata l\'ultima carta sfiorata: ' + JSON.stringify(dopo));

        // 2) Gesto verso l'alto: trascinamento normale
        await prepara('main1');
        r = await gesto(1, [[2, -6], [3, -30], [4, -90]], false);
        t.assert(r[r.length - 1].fantasma, 'Un gesto verso l\'alto deve far nascere il fantasma del trascinamento: ' + JSON.stringify(r));
        await t.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7, pointerType: 'touch', bubbles: true })));

        // 3) Scorrimento che poi sale oltre la mano: diventa il trascinamento della carta che aveva sotto
        await prepara('main1');
        r = await gesto(0, [[12, 0], [w * 1.5, 2], [w * 1.5, -120]], false);
        t.assert(r[2].fantasma, 'Salendo oltre la mano dopo lo scorrimento il gesto diventa un trascinamento: ' + JSON.stringify(r[2]));
        const cartaTrascinata = await t.evaluate(() => (dragState && dragState.card && dragState.card.uid) || null);
        t.assert(cartaTrascinata === 'sc-1', 'Si trascina la carta che era sotto il dito (la seconda): ' + cartaTrascinata);
        await t.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7, pointerType: 'touch', bubbles: true })));

        // 4) Fuori dalla Main Phase lo scorrimento funziona uguale
        await prepara('battle');
        r = await gesto(0, [[12, 0], [w * 0.9, 1], [w * 2.0, 1]], true);
        t.assert(r[1].alte[1] && r[2].alte[2], 'Anche in Battle Phase lo scorrimento solleva una carta alla volta: ' + JSON.stringify(r));

        // 5) Il mouse non cambia: un movimento orizzontale con il mouse e' ancora un trascinamento
        await prepara('main1');
        const mouse = await t.evaluate(() => {
            const carte = [...document.querySelectorAll('#playerHand .card')];
            const b = carte[0].getBoundingClientRect(); const x0 = b.left + b.width / 2, y0 = b.top + b.height / 2;
            const ev = (tipo, x, y) => new PointerEvent(tipo, { pointerId: 9, pointerType: 'mouse', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y });
            carte[0].dispatchEvent(ev('pointerdown', x0, y0));
            document.dispatchEvent(ev('pointermove', x0 + 60, y0 + 2));
            const fantasma = !!document.querySelector('.drag-preview');
            document.dispatchEvent(ev('pointercancel', x0 + 60, y0 + 2));
            return fantasma;
        });
        t.assert(mouse, 'Con il mouse nulla cambia: il movimento orizzontale e\' ancora un trascinamento');
    }
};
