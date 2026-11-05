// Attivare un effetto dalla mano chiude il box info carta, che altrimenti resterebbe aperto sul campo.
module.exports = {
    name: 'UX mano: attivare un effetto dalla mano chiude il box info',
    async run(t) {
        await t.evaluate(() => {
            gameState.currentPlayer = 'player';
            gameState.phase = 'main1';
            gameState.hasNormalSummoned = false;
            gameState.playerHand = [{ ...cardDatabase.find((card) => card.id === 36), uid: 'info-attiva' }];
            gameState.selectedCard = { type: null, card: null, index: -1 };
            window.__transizioniAttivazione = [];
            window.__smettiTransizioniAttivazione = EventiDuello.ascolta('transizione-carta', (movimento) => {
                window.__transizioniAttivazione.push({
                    uid: movimento.carta && movimento.carta.uid,
                    da: movimento.da && movimento.da.kind,
                    a: movimento.a && movimento.a.kind,
                    variante: movimento.variante,
                    origine: movimento.da && movimento.da.rect
                });
            });
            const playCentro = FX.playCardActivateCenterScreen;
            FX.playCardActivateCenterScreen = (carta) => {
                if (carta && carta.uid === 'info-attiva') {
                    const r = document.querySelector('#playerHand .card[data-uid="info-attiva"]').getBoundingClientRect();
                    window.__origineRealeMano = { left: r.left, top: r.top, width: r.width, height: r.height };
                }
                return playCentro(carta);
            };
            updateUI();
            window.__larghezzaCartaAttivataInMano = document.querySelector('#playerHand .card').getBoundingClientRect().width;
        });
        const c = await t.page.evaluate(() => {
            const r = document.querySelector('#playerHand .card').getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        await t.page.mouse.click(c.x, c.y);
        await t.page.waitForSelector('#qpSpellActivate', { timeout: 5000 });
        t.assert(await t.evaluate(() => document.getElementById('cardInfoPanel').classList.contains('visible')),
            'Prerequisito: il tocco sulla carta apre il box info');
        await t.page.click('#qpSpellActivate');
        // Il cursore resta fermo sopra la mano: il passaggio su una carta non deve riaprire il box.
        await t.page.waitForTimeout(500);
        t.assert(!(await t.evaluate(() => document.getElementById('cardInfoPanel').classList.contains('visible'))),
            'Attivando l\'effetto il box info deve chiudersi');
        await t.page.waitForFunction(() => window.__transizioniAttivazione.some((m) => (
            m.uid === 'info-attiva' && m.da === 'hand' && m.a === 'graveyard' && m.variante === 'resolve'
        )), { timeout: 6000 });
        t.assert(await t.evaluate(() => {
            const fantasma = document.querySelector('.fx-card-travel[data-uid="info-attiva"]');
            const movimento = window.__transizioniAttivazione.find((m) => m.uid === 'info-attiva');
            const origine = window.__origineRealeMano;
            return fantasma && origine && movimento && movimento.origine
                && Math.abs(parseFloat(fantasma.style.width) - origine.width) < 2
                && Math.abs(parseFloat(fantasma.style.left) - origine.left) < 1
                && Math.abs(parseFloat(fantasma.style.top) - origine.top) < 1
                && Math.abs(movimento.origine.left - origine.left) < 1
                && Math.abs(movimento.origine.top - origine.top) < 1;
        }), 'Il clone in viaggio deve partire dalle coordinate esatte della carta in mano salvate prima dell’animazione centrale, mai dal clone centrale o dal centro della mano');
        await t.evaluate(() => {
            if (window.__smettiTransizioniAttivazione) window.__smettiTransizioniAttivazione();
        });
    }
};
