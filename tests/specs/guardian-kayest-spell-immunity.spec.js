// Guardiano Kay'est (id 285): "non è influenzata dagli effetti delle
// Magie" copriva finora solo il targeting diretto (cannotBeTargetedBySpells).
// Verifica il nuovo unaffectedBySpellEffects contro i 4 punti concreti del
// dataset dove una Magia la toccherebbe SENZA sceglierla come bersaglio:
// bonus/malus ATK/DEF ACQUA-wide (id 79, 349), riduzione di Livello
// (id 79) e distruzione di massa (id 706) — e conferma che un mostro ACQUA
// "normale" nello stesso scenario resta invece pienamente influenzato.
module.exports = {
    name: 'Guardiano Kay\'est è immune agli effetti di massa delle Magie, non solo al targeting diretto (id 285)',
    async run(t) {
        const r1 = await t.evaluate(() => {
            const kayest = { ...cardDatabase.find((c) => c.id === 285), uid: 'kayest-1' };
            const normalWater = { ...cardDatabase.find((c) => c.id === 71), uid: 'normalwater-1' }; // Suijin, ACQUA, Livello 7
            const ocean = { ...cardDatabase.find((c) => c.id === 79), uid: 'ocean-1' };

            gameState.playerMonsterField = [{ card: kayest, position: 'attack', isFaceDown: false }, { card: normalWater, position: 'attack', isFaceDown: false }, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.playerFieldSpell = { card: ocean, isFaceDown: false };
            gameState.botFieldSpell = null;
            gameState.playerSTField = [null, null, null, null, null];
            gameState.botSTField = [null, null, null, null, null];
            DuelEngine.recomputeStaticEffects();

            return {
                kayestAtk: DuelEngine.getEffectiveAtk(kayest),
                normalWaterAtk: DuelEngine.getEffectiveAtk(normalWater),
                kayestLevel: getEffectiveLevel(kayest),
                normalWaterLevel: getEffectiveLevel(normalWater)
            };
        });
        t.assert(r1.kayestAtk === 1000, `Guardiano Kay'est (1000 ATK stampato) non deve ricevere il bonus ACQUA di Un Oceano Leggendario (letto: ${r1.kayestAtk})`);
        t.assert(r1.normalWaterAtk === 2700, `Suijin (2500 ATK stampato) deve ricevere il bonus +200 ACQUA di Un Oceano Leggendario (letto: ${r1.normalWaterAtk})`);
        t.assert(r1.kayestLevel === 4, `Guardiano Kay'est (Livello 4 stampato) non deve subire la riduzione di Livello di Un Oceano Leggendario (letto: ${r1.kayestLevel})`);
        t.assert(r1.normalWaterLevel === 6, `Suijin (Livello 7 stampato) deve scendere a Livello 6 con Un Oceano Leggendario attivo (letto: ${r1.normalWaterLevel})`);

        // Grande Onda Piccola Onda (706): distrugge tutti i propri mostri
        // ACQUA scoperti -> Kay'est deve sopravvivere, un ACQUA normale no.
        const r2 = await t.evaluate(() => {
            const kayest2 = { ...cardDatabase.find((c) => c.id === 285), uid: 'kayest-2' };
            const normalWater2 = { ...cardDatabase.find((c) => c.id === 71), uid: 'normalwater-2' };
            const bigWave = { ...cardDatabase.find((c) => c.id === 706), uid: 'bigwave-1' };

            gameState.playerMonsterField = [{ card: kayest2, position: 'attack', isFaceDown: false }, { card: normalWater2, position: 'attack', isFaceDown: false }, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.playerFieldSpell = null;
            gameState.playerHand = [];
            gameState.playerGraveyard = [];

            const ctx = DuelEngine.makeContext('player', { card: bigWave });
            DuelEngine.getDefinition(706).activate(ctx);

            return {
                kayestSurvived: gameState.playerMonsterField.some((s) => s && s.card.uid === 'kayest-2'),
                normalWaterDestroyed: !gameState.playerMonsterField.some((s) => s && s.card.uid === 'normalwater-2'),
                normalWaterInGraveyard: gameState.playerGraveyard.some((c) => c.uid === 'normalwater-2')
            };
        });
        t.assert(r2.kayestSurvived, 'Guardiano Kay\'est deve sopravvivere a Grande Onda Piccola Onda: distruzione di massa non a bersaglio, ma è comunque un effetto Magia');
        t.assert(r2.normalWaterDestroyed, 'Un mostro ACQUA normale deve essere distrutto da Grande Onda Piccola Onda');
        t.assert(r2.normalWaterInGraveyard, 'Il mostro ACQUA normale distrutto deve finire nel Cimitero');
    }
};
