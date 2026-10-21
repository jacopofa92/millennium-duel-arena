// Otto carte erano la STESSA carta reale di un'altra (due voci per Black Luster Soldier, Giant Trunade...) e sono state
// eliminate (2026-10-21). Qui si sorveglia che:
//   - le otto carte non esistano piu' (dati ed effetti) e quelle che restano si'; Raigeki e Folgore Fulminante restano entrambe;
//   - un salvataggio che le conteneva (collezione e mazzi, anche da cloud o da file) le ritrovi sulla carta che resta;
//   - le parti piu' fedeli degli alias siano finite sulle carte che restano: la clausola di annullamento di Esplosione a Onde
//     Soniche (199), la scelta delle carte di Rilascio delle Anime (452) e del bersaglio di Clown Stupido (530).
const ELIMINATE = { 616: 55, 617: 56, 163: 530, 747: 199, 668: 262, 1024: 315, 723: 349, 609: 452 };

module.exports = {
    name: 'Carte doppie eliminate: sparite dai dati, salvataggi migrati, effetti portati sulle carte che restano',
    async run(t) {
        await t.page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.phase === 'main1', null, { timeout: 15000 });

        // 1) dati ed effetti
        const stato = await t.evaluate((eliminate) => {
            const sparite = Object.keys(eliminate).filter((id) => cardDatabase.some((c) => c.id === Number(id)) || DuelEngine.getDefinition(Number(id)));
            const mancanti = Object.values(eliminate).filter((id) => !cardDatabase.some((c) => c.id === id));
            return { sparite, mancanti, raigeki: !!cardDatabase.find((c) => c.id === 409), folgore: !!cardDatabase.find((c) => c.id === 37) };
        }, ELIMINATE);
        t.assert(stato.sparite.length === 0, `Queste carte dovevano sparire (dati o effetto): ${stato.sparite.join(', ')}`);
        t.assert(stato.mancanti.length === 0, `Queste carte dovevano restare: ${stato.mancanti.join(', ')}`);
        t.assert(stato.raigeki && stato.folgore, 'Raigeki (409) e Folgore Fulminante (37) restano entrambe');

        // 2) migrazione di un salvataggio che contiene gli id eliminati
        const mig = await t.evaluate(() => {
            const parsed = {
                player: { name: 'Prova', lastSaved: new Date().toISOString() },
                decks: [{ id: 'd1', name: 'Test', main: [{ id: 616, qty: 2 }, { id: 55, qty: 2 }, { id: 668, qty: 1 }, { id: 10, qty: 3 }], extra: [] }],
                collection: { 616: 2, 55: 2, 668: 1, 609: 1, 10: 3 },
                activeDeckId: 'd1'
            };
            SaveManager.applyExternalSave(parsed);
            const s = SaveManager.load();
            return { collection: s.collection, main: s.decks[0].main };
        });
        t.assert(mig.collection[55] === 3 && mig.collection[616] === undefined, `616 -> 55 con tetto 3 copie (collezione: ${JSON.stringify(mig.collection)})`);
        t.assert(mig.collection[262] === 1 && mig.collection[668] === undefined, 'la copia di 668 passa a 262');
        t.assert(mig.collection[452] === 1 && mig.collection[609] === undefined, 'la copia di 609 passa a 452');
        t.assert(mig.collection[10] === 3, 'le altre carte restano come sono');
        const q = (id) => (mig.main.find((e) => e.id === id) || {}).qty;
        t.assert(q(55) === 3 && q(616) === undefined, `nel mazzo 616 e 55 si uniscono (max 3): ${JSON.stringify(mig.main)}`);
        t.assert(q(262) === 1 && q(668) === undefined && q(10) === 3, 'nel mazzo 668 -> 262, le altre voci intatte');
        const idem = await t.evaluate(() => JSON.stringify(SaveManager.load().collection));
        t.assert(idem === JSON.stringify(mig.collection), 'la migrazione e\' idempotente');

        // 3) Esplosione a Onde Soniche: clausola di annullamento (era dell'alias eliminato)
        const onde = await t.evaluate(() => {
            const caster = { ...cardDatabase.find((c) => c.type === 'monster' && c.race === 'Incantatore' && c.level >= 7), uid: 'caster-n' };
            const nemico = { ...cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && c.id !== 199), uid: 'nemico-n' };
            gameState.playerLP = 8000; gameState.gameOver = false;
            gameState.playerMonsterField = [{ card: caster, position: 'attack', isFaceDown: false, hasAttacked: false }, null, null, null, null];
            gameState.botMonsterField = [{ card: nemico, position: 'attack', isFaceDown: false, hasAttacked: false }, null, null, null, null];
            const wave = { ...cardDatabase.find((c) => c.id === 199), uid: 'wave-n' };
            const ctx = DuelEngine.makeContext('player', { card: wave });
            DuelEngine.getDefinition(199).activate(ctx);
            return { annulla: !!(gameState.negatesEffectsOnForcedAttackFor && gameState.negatesEffectsOnForcedAttackFor.has('caster-n')) };
        });
        t.assert(onde.annulla, 'Esplosione a Onde Soniche deve annullare gli effetti dei mostri distrutti da questi attacchi');

        // 4) Rilascio delle Anime: bandisce fino a 5 carte da ENTRAMBI i Cimiteri
        // (senza interfaccia: le scelte vengono prese in automatico, vedi CLAUDE.md su DuelEngineUI)
        await t.evaluate(() => { window.DuelEngineUI = null; });
        const anime = await t.evaluate(() => {
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            gameState.playerGraveyard = [1, 2, 3].map((n) => ({ ...base, uid: 'mio-' + n }));
            gameState.botGraveyard = [1, 2, 3, 4].map((n) => ({ ...base, uid: 'suo-' + n }));
            const carta = { ...cardDatabase.find((c) => c.id === 452), uid: 'rilascio' };
            DuelEngine.getDefinition(452).activate(DuelEngine.makeContext('player', { card: carta }));
            return null;
        });
        await t.page.waitForFunction(() => gameState.playerGraveyard.length + gameState.botGraveyard.length === 2, null, { timeout: 8000 });
        const resto = await t.evaluate(() => ({ mio: gameState.playerGraveyard.length, suo: gameState.botGraveyard.length }));
        t.assert(resto.mio + resto.suo === 2, `Rilascio delle Anime banditi 5 su 7 carte (restano ${JSON.stringify(resto)})`);

        // 5) Clown Stupido: rimanda in mano un mostro avversario
        const clown = await t.evaluate(() => {
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && c.id !== 530);
            const mio = { ...cardDatabase.find((c) => c.id === 530), uid: 'clown' };
            gameState.playerMonsterField = [{ card: mio, position: 'attack', isFaceDown: false }, null, null, null, null];
            gameState.botMonsterField = [{ card: { ...base, uid: 'b1' }, position: 'attack', isFaceDown: false }, { card: { ...base, uid: 'b2' }, position: 'attack', isFaceDown: false }, null, null, null];
            gameState.botHand = [];
            const ctx = DuelEngine.makeContext('player', { card: mio, fromPosition: 'defense', toPosition: 'attack', slotIndex: 0 });
            DuelEngine.getDefinition(530).onPositionChange(ctx);
            return null;
        });
        await t.page.waitForFunction(() => gameState.botHand.length === 1, null, { timeout: 8000 });
        const rimasti = await t.evaluate(() => gameState.botMonsterField.filter(Boolean).length);
        t.assert(rimasti === 1, `Clown Stupido rimanda in mano 1 mostro avversario (restano ${rimasti} sul Terreno)`);
    }
};
