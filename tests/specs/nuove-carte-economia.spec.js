// Censimento economico del lotto 1131-1160: rarità curate, prima copia
// delle due carte firma e busta tematica che rende perseguibili le Fusioni.
const path = require('path');

module.exports = {
    name: 'Economia: rarità e ottenibilità delle 30 nuove carte TCG',
    standalone: true,
    async run({ browser, assert }) {
        const root = path.join(__dirname, '..', '..').replace(/\\/g, '/');
        const context = await browser.newContext({ serviceWorkers: 'block' });
        await context.addInitScript(() => { localStorage.clear(); window.AUTH_GATE_SKIP = true; });
        const page = await context.newPage();
        try {
            await page.goto('file:///' + root + '/negozio.html');
            await page.waitForFunction(() => !!(window.ShopCatalog && window.CardAcquisition && window.CardRarity && window.SaveManager));
            const result = await page.evaluate(() => {
                SaveManager.createNew('Audit nuove carte');
                const expected = {
                    common: [1141, 1146, 1148, 1157, 1158, 1159, 1160],
                    rare: [1132, 1134, 1135, 1136, 1138, 1140, 1142, 1143, 1144, 1145, 1147, 1149, 1150, 1151, 1152, 1154, 1156],
                    super: [1131, 1137, 1139, 1153],
                    ultra: [1155],
                    legendary: [746, 1133]
                };
                const wrongRarities = Object.entries(expected).flatMap(([rarity, ids]) =>
                    ids.filter((id) => CardRarity.of(id) !== rarity).map((id) => ({ id, expected: rarity, actual: CardRarity.of(id) })));

                const magePowerLockedBefore = !CardAcquisition.isSignatureUnlocked(746);
                const magePowerSource = CardAcquisition.sourceFor(746);
                const spellcastersDeck = starterStructureDeckDatabase.find((deck) => deck.packId === 'structure_sd6_spellcasters_judgment');
                const magePowerInDeck = !!spellcastersDeck && spellcastersDeck.main.some((entry) => entry.id === 746);
                SaveManager.addOwnedCards(746, 1);
                const magePowerUnlockedAfterDeck = CardAcquisition.isSignatureUnlocked(746);

                const parasiteLockedBefore = !CardAcquisition.isSignatureUnlocked(1139);
                for (let i = 0; i < 14; i++) CardAcquisition.onDuelWin({ difficulty: 'Difficile', opponentId: 'weevil', playerLP: 8000, lpLost: 0 });
                const parasiteAt14 = SaveManager.getOwnedCount(1139);
                CardAcquisition.onDuelWin({ difficulty: 'Difficile', opponentId: 'weevil', playerLP: 8000, lpLost: 0 });
                const parasiteAt15 = SaveManager.getOwnedCount(1139);

                for (let i = 0; i < 19; i++) CardAcquisition.onDuelWin({ difficulty: 'Difficile', opponentId: 'marik', playerLP: 8000, lpLost: 0 });
                const lavaAt19 = SaveManager.getOwnedCount(1133);
                CardAcquisition.onDuelWin({ difficulty: 'Difficile', opponentId: 'marik', playerLP: 8000, lpLost: 0 });
                const lavaAt20 = SaveManager.getOwnedCount(1133);
                // Altre vittorie non devono distribuire copie infinite.
                for (let i = 0; i < 10; i++) CardAcquisition.onDuelWin({ difficulty: 'Difficile', opponentId: 'marik', playerLP: 8000, lpLost: 0 });
                const lavaAfterMore = SaveManager.getOwnedCount(1133);

                const fusionTheme = ShopCatalog.TEMI.find((t) => t.id === 'fusioni');
                const newCards = cardDatabase.filter((c) => c.id >= 1131 && c.id <= 1160);
                const noSource = newCards.filter((c) => !CardAcquisition.sourceFor(c.id));
                const forgeContainsWholeFusionLot = !!fusionTheme
                    && newCards.filter((c) => c.id >= 1141).every((c) => fusionTheme.test(c));
                const pack = {
                    id: 'tema-fusioni', carte: 10, temaId: 'fusioni', deboliGarantiti: 4,
                    composizione: { common: 5, rare: 3, super: 1, ultra: 1 }
                };
                const pulls = ShopCatalog.apriBusta(pack);
                const forgeCoherent = pulls.length === 10 && pulls.every((id) => fusionTheme.test(cardDatabase.find((c) => c.id === id)));

                return {
                    wrongRarities, parasiteLockedBefore, parasiteAt14, parasiteAt15,
                    lavaAt19, lavaAt20, lavaAfterMore, noSource: noSource.map((c) => c.id),
                    magePowerLockedBefore, magePowerUnlockedAfterDeck, magePowerInDeck, magePowerSource,
                    forgeContainsWholeFusionLot, forgeCoherent,
                    parasiteUnlockedAfter: CardAcquisition.isSignatureUnlocked(1139),
                    lavaUnlockedAfter: CardAcquisition.isSignatureUnlocked(1133)
                };
            });

            assert(result.wrongRarities.length === 0, `Rarità errate: ${JSON.stringify(result.wrongRarities)}`);
            assert(result.magePowerLockedBefore && result.magePowerUnlockedAfterDeck && result.magePowerInDeck,
                'Potere del Mago deve restare fuori dai pool commerciali finché la prima copia non arriva dallo Structure Deck SD6');
            assert(result.magePowerSource.includes('Battle City I') && result.magePowerSource.includes('Leggendaria'),
                'La Cartoteca deve spiegare il percorso raro di Potere del Mago');
            assert(result.parasiteLockedBefore && result.parasiteAt14 === 0 && result.parasiteAt15 === 1 && result.parasiteUnlockedAfter,
                'Parassita Paracida deve sbloccarsi esattamente alla 15ª vittoria difficile su Weevil');
            assert(result.lavaAt19 === 0 && result.lavaAt20 === 1 && result.lavaAfterMore === 1 && result.lavaUnlockedAfter,
                'Golem di Lava deve sbloccarsi alla 20ª vittoria difficile su Marik, una sola volta');
            assert(result.noSource.length === 0, `Nuove carte prive di fonte leggibile: ${result.noSource.join(', ')}`);
            assert(result.forgeContainsWholeFusionLot && result.forgeCoherent,
                'Forgia delle Fusioni deve includere il lotto 1141-1160 e produrre solo carte a tema');
        } finally {
            await context.close();
        }
    }
};
