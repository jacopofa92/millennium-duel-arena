const path = require('path');

module.exports = {
    name: 'Negozio: buste tematiche coerenti con creature base garantite',
    standalone: true,
    async run({ browser, assert }) {
        const root = path.join(__dirname, '..', '..').replace(/\\/g, '/');
        const context = await browser.newContext({ serviceWorkers: 'block' });
        await context.addInitScript(() => { localStorage.clear(); window.AUTH_GATE_SKIP = true; });
        const page = await context.newPage();
        try {
            await page.goto('file:///' + root + '/negozio.html');
            await page.waitForFunction(() => !!window.ShopCatalog && typeof cardDatabase !== 'undefined');
            const verifica = await page.evaluate(() => {
                const bossStructure = starterStructureDeckDatabase
                    .filter((deck) => deck.kind === 'structure' && deck.bossCardId)
                    .map((deck) => ({ deck: deck.packId, id: deck.bossCardId }));
                const vietate = Array.from(new Set([
                    ...CardRarity.LOCKED_IDS,
                    ...bossStructure.map((boss) => boss.id)
                ]));
                const bossAmmessi = bossStructure.filter((boss) =>
                    ShopCatalog.isCartaAmmessaInBusta(boss.id));
                const comuniBaseFuoriSoglia = ['common', 'rare'].flatMap((rarity) =>
                    CardRarity.idsByRarity(rarity).filter((id) => {
                        const carta = cardDatabase.find((c) => c.id === id);
                        return carta && carta.type === 'monster'
                            && (!Number.isFinite(Number(carta.attack)) || Number(carta.attack) > 1200)
                            && ShopCatalog.isCartaAmmessaInBusta(id, { id: 'base' });
                    }));
                const bustaBase = { id: 'base', carte: 10, composizione: { common: 9, rare: 1 } };
                const apertureBaseFuoriSoglia = [];
                for (let i = 0; i < 100; i++) {
                    ShopCatalog.apriBusta(bustaBase).forEach((id) => {
                        const carta = cardDatabase.find((c) => c.id === id);
                        if (carta && carta.type === 'monster'
                            && (!Number.isFinite(Number(carta.attack)) || Number(carta.attack) > 1200)) {
                            apertureBaseFuoriSoglia.push(id);
                        }
                    });
                }
                const risultati = ShopCatalog.TEMI.flatMap((tema) => [4, 2].map((deboli) => {
                    const busta = {
                        id: (deboli === 2 ? 'premium-' : 'tema-') + tema.id,
                        carte: 10, temaId: tema.id, deboliGarantiti: deboli,
                        composizione: deboli === 2
                            ? { common: 3, rare: 3, super: 2, ultra: 1, legendary: 1 }
                            : { common: 5, rare: 3, super: 1, ultra: 1 }
                    };
                    const ids = ShopCatalog.apriBusta(busta);
                    const carte = ids.map((id) => cardDatabase.find((c) => c.id === id));
                    const deboliTrovati = carte.filter((c) => c && c.type === 'monster'
                        && (c.level || 0) <= 4 && (c.attack || 0) <= 1400 && (c.defense || 0) <= 1600).length;
                    return {
                        tema: tema.id, richieste: deboli, count: ids.length,
                        tutteTema: carte.every((c) => c && tema.test(c)),
                        deboliTrovati,
                        vietate: ids.filter((id) => vietate.includes(id))
                    };
                }));

                // Un solo sorteggio non sorveglierebbe bene il fallback di
                // una fascia rara. Ripetiamo ogni busta abbastanza volte da
                // attraversare pool e sostituzioni delle creature base.
                const fughe = [];
                ShopCatalog.TEMI.forEach((tema) => [4, 2].forEach((deboli) => {
                    const busta = {
                        id: (deboli === 2 ? 'premium-' : 'tema-') + tema.id,
                        carte: 10, temaId: tema.id, deboliGarantiti: deboli,
                        composizione: deboli === 2
                            ? { common: 3, rare: 3, super: 2, ultra: 1, legendary: 1 }
                            : { common: 5, rare: 3, super: 1, ultra: 1 }
                    };
                    for (let i = 0; i < 50; i++) {
                        ShopCatalog.apriBusta(busta).forEach((id) => {
                            if (vietate.includes(id)) fughe.push({ tema: tema.id, id });
                        });
                    }
                }));
                return { risultati, fughe, bossStructure, bossAmmessi,
                    comuniBaseFuoriSoglia, apertureBaseFuoriSoglia };
            });
            const risultati = verifica.risultati;
            risultati.forEach((r) => {
                assert(r.count === 10, `${r.tema}: la busta contiene ${r.count} carte invece di 10`);
                assert(r.tutteTema, `${r.tema}: è uscita almeno una carta fuori tema`);
                assert(r.deboliTrovati >= r.richieste,
                    `${r.tema}: attese ${r.richieste} creature base, trovate ${r.deboliTrovati}`);
                assert(r.vietate.length === 0,
                    `${r.tema}: la busta contiene carte riservate: ${r.vietate.join(', ')}`);
            });
            assert(verifica.fughe.length === 0,
                `Carte riservate comparse nei pool delle buste: ${JSON.stringify(verifica.fughe.slice(0, 10))}`);
            assert(verifica.bossStructure.length === 10,
                `Attesi i 10 boss degli Structure Deck TCG, trovati ${verifica.bossStructure.length}`);
            assert(verifica.bossAmmessi.length === 0,
                `Boss Structure ammessi in busta: ${JSON.stringify(verifica.bossAmmessi)}`);
            assert(verifica.comuniBaseFuoriSoglia.length === 0,
                `Mostri oltre 1200 ATK ammessi nel pool comune/raro della Busta Base: ${verifica.comuniBaseFuoriSoglia.join(', ')}`);
            assert(verifica.apertureBaseFuoriSoglia.length === 0,
                `Mostri oltre 1200 ATK usciti dalla Busta Base: ${verifica.apertureBaseFuoriSoglia.join(', ')}`);

            const simboli = await page.evaluate(() => ({
                temi: ShopCatalog.TEMI.map((t) => ({
                    id: t.id,
                    mostroId: t.mostroSimboloId,
                    carta: cardDatabase.find((c) => c.id === t.mostroSimboloId)
                })),
                generiche: ShopCatalog.BUSTE.map((b) => ({ emblema: b.emblema, mostroId: b.mostroSimboloId }))
            }));
            simboli.temi.forEach((tema) => {
                assert(tema.mostroId && tema.carta && tema.carta.type === 'monster',
                    `${tema.id}: manca un mostro simbolo valido`);
            });
            simboli.generiche.forEach((busta) => {
                assert(Array.isArray(busta.emblema), 'una busta generica non ha il proprio emblema originale');
                assert(!busta.mostroId, 'una busta generica usa per errore il mostro di una tematica');
            });
        } finally {
            await context.close();
        }
    }
};
