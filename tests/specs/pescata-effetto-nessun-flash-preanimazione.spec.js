module.exports = {
    name: 'Pescata da effetto: nessun render intermedio mostra le carte prima dell’animazione',
    async run(t) {
        const immediate = await t.evaluate(() => {
            const templates = cardDatabase.filter((c) => c.type === 'monster').slice(0, 3);
            gameState.playerHand = [{ ...templates[0], uid: 'draw-old-card' }];
            gameState.playerDeck = [
                { ...templates[1], uid: 'draw-new-a' },
                { ...templates[2], uid: 'draw-new-b' }
            ];
            gameState.playerDeckCount = 2;
            updateUI();
            DuelEngine.actions.drawCards('player', 2);

            // Simula esattamente il render intermedio che faceva riapparire
            // il bug tramite trigger o risoluzione della carta.
            updateUI();
            const nuove = ['draw-new-a', 'draw-new-b'].map((uid) =>
                document.querySelector(`#playerHand .card[data-uid="${uid}"]`));
            return {
                present: nuove.every(Boolean),
                pending: nuove.every((el) => el.classList.contains('pending-deal')),
                opacity: nuove.map((el) => parseFloat(getComputedStyle(el).opacity) || 0),
                oldVisible: (parseFloat(getComputedStyle(document.querySelector('[data-uid="draw-old-card"]')).opacity) || 0) > .5
            };
        });

        t.assert(immediate.present && immediate.pending && immediate.opacity.every((v) => v === 0),
            `Le carte nuove devono nascere invisibili anche nel render intermedio (${JSON.stringify(immediate.opacity)})`);
        t.assert(immediate.oldVisible, 'Le carte già presenti in mano devono restare visibili');

        await new Promise((resolve) => setTimeout(resolve, 850));
        const final = await t.evaluate(() => ['draw-new-a', 'draw-new-b'].map((uid) => {
            const el = document.querySelector(`#playerHand .card[data-uid="${uid}"]`);
            return { pending: el && el.classList.contains('pending-deal'), opacity: el && parseFloat(getComputedStyle(el).opacity) };
        }));
        t.assert(final.every((v) => v && !v.pending && v.opacity > .5),
            'Dopo la distribuzione entrambe le carte devono essere normalmente visibili');

        const refresh = await t.evaluate(() => {
            const prima = ['draw-new-a', 'draw-new-b'].map((uid) =>
                document.querySelector(`#playerHand .card[data-uid="${uid}"]`));
            const artworkPrima = prima.map((el) => el && el.querySelector('.card-art-image, .card-image'));
            updateUI();
            const dopo = ['draw-new-a', 'draw-new-b'].map((uid) =>
                document.querySelector(`#playerHand .card[data-uid="${uid}"]`));
            const artworkDopo = dopo.map((el) => el && el.querySelector('.card-art-image, .card-image'));
            return {
                stessiNodi: prima.every((el, i) => el && el.isSameNode(dopo[i])),
                stessoArtwork: artworkPrima.every((el, i) => !el || el.isSameNode(artworkDopo[i]))
            };
        });
        t.assert(refresh.stessiNodi && refresh.stessoArtwork,
            `Un render a fine effetto non deve ricreare le carte pescate né ricaricarne l’artwork: ${JSON.stringify(refresh)}`);
    }
};
