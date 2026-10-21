// L'audit 1.0.37 ha portato una trentina di carte a far passare il proprio
// bersaglio dal checkpoint di targeting condiviso (ctx.declareTarget), per
// lo più con l'opzione `dichiara: true` di chooseFieldCardTarget, più tutte
// le Magie Equipaggiamento (equipToChosenTarget) e i Mostri Union
// (attachUnionMonster). Qui si prova che le protezioni le vedano davvero,
// e che senza protezioni le stesse carte facciano ancora quello di prima.
module.exports = {
    name: 'Checkpoint di targeting: Equip, Jeroid Oscuro, Nega Attacco e Mura del Castello lo rispettano',
    async run(t) {
        const prepara = () => t.evaluate(() => {
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            window.DuelEngineUI = null; // scelte automatiche: qui conta il checkpoint
            gameState.playerLP = 8000;
            gameState.botLP = 8000;
            gameState.gameOver = false;
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.playerSTField = [null, null, null, null, null];
            gameState.botSTField = [null, null, null, null, null];
            gameState.playerFieldSpell = null;
            gameState.botFieldSpell = null;
            gameState.chain = { links: [], active: false };
            DuelEngine.recomputeStaticEffects();
        });

        // --- Equip su un Drago: senza Signore dei D. si aggancia, con no ---
        for (const conSignore of [false, true]) {
            await prepara();
            const esito = await t.evaluate((conSignore) => {
                const dr = { ...cardDatabase.find((c) => c.type === 'monster' && c.race === 'Drago' && !c.extraDeck), uid: 'drago-eq' };
                gameState.playerMonsterField[0] = { card: dr, position: 'attack', isFaceDown: false };
                if (conSignore) gameState.botMonsterField[0] = { card: { ...cardDatabase.find((c) => c.id === 353), uid: 'signore' }, position: 'attack', isFaceDown: false };
                const ciondolo = { ...cardDatabase.find((c) => c.id === 117), uid: 'ciondolo' };
                gameState.playerSTField[0] = { card: ciondolo, isFaceDown: false };
                DuelEngine.getDefinition(117).activate(DuelEngine.makeContext('player', { card: ciondolo, zone: 'st', index: 0 }));
                return ciondolo.equippedToUid || null;
            }, conSignore);
            if (conSignore) t.assert(esito === null, `Con Signore dei D. in campo un Drago non si può equipaggiare (agganciata a ${esito})`);
            else t.assert(esito === 'drago-eq', `Senza protezioni l'Equip si aggancia come prima (${esito})`);
        }

        // --- Jeroid Oscuro contro un Dio Egizio: nessun effetto ---
        await prepara();
        const jeroid = await t.evaluate(() => {
            const obelisk = { ...cardDatabase.find((c) => c.id === 30), uid: 'obelisk' };
            gameState.botMonsterField[0] = { card: obelisk, position: 'attack', isFaceDown: false };
            const j = { ...cardDatabase.find((c) => c.id === 186), uid: 'jeroid' };
            gameState.playerMonsterField[0] = { card: j, position: 'attack', isFaceDown: false };
            DuelEngine.getDefinition(186).onSummon(DuelEngine.makeContext('player', { card: j, summonedCard: j, summonedVia: 'normal' }));
            return obelisk.attack;
        });
        t.assert(jeroid === 4000, `Obelisk non può essere bersaglio: l'ATK resta 4000 (${jeroid})`);

        // --- Jeroid Oscuro senza protezioni: -800 come prima ---
        await prepara();
        const jeroidNormale = await t.evaluate(() => {
            const base = { ...cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && !DuelEngine.getDefinition(c.id)), attack: 2000, uid: 'bers' };
            gameState.botMonsterField[0] = { card: base, position: 'attack', isFaceDown: false };
            const j = { ...cardDatabase.find((c) => c.id === 186), uid: 'jeroid2' };
            gameState.playerMonsterField[0] = { card: j, position: 'attack', isFaceDown: false };
            DuelEngine.getDefinition(186).onSummon(DuelEngine.makeContext('player', { card: j, summonedCard: j, summonedVia: 'normal' }));
            return base.attack;
        });
        t.assert(jeroidNormale === 1200, `Senza protezioni Jeroid toglie 800 ATK (${jeroidNormale})`);

        // --- Nega Attacco: non può bersagliare un attaccante Drago protetto ---
        for (const conSignore of [false, true]) {
            await prepara();
            const annullato = await t.evaluate((conSignore) => {
                const dr = { ...cardDatabase.find((c) => c.type === 'monster' && c.race === 'Drago' && !c.extraDeck), uid: 'drago-att' };
                gameState.botMonsterField[0] = { card: dr, position: 'attack', isFaceDown: false };
                if (conSignore) gameState.botMonsterField[1] = { card: { ...cardDatabase.find((c) => c.id === 353), uid: 'signore2' }, position: 'attack', isFaceDown: false };
                let cancellato = false;
                const nega = { ...cardDatabase.find((c) => c.id === 820), uid: 'nega' };
                DuelEngine.getDefinition(820).onAttackDeclare(DuelEngine.makeContext('player', {
                    card: nega, attackerOwner: 'bot', attackerIndex: 0, targetIndex: -1,
                    cancelAttack: () => { cancellato = true; }
                }));
                return cancellato;
            }, conSignore);
            if (conSignore) t.assert(!annullato, 'Nega Attacco non può scegliere come bersaglio un attaccante Drago sotto Signore dei D.');
            else t.assert(annullato, 'Senza protezioni Nega Attacco annulla l\'attacco come prima');
        }

        // --- Mura del Castello: il bersaglio passa dal checkpoint ---
        await prepara();
        const mura = await t.evaluate(() => {
            const obelisk = { ...cardDatabase.find((c) => c.id === 30), uid: 'obelisk2' };
            gameState.playerMonsterField[0] = { card: obelisk, position: 'attack', isFaceDown: false };
            const prima = DuelEngine.getEffectiveDef(obelisk);
            const m = { ...cardDatabase.find((c) => c.id === 143), uid: 'mura' };
            DuelEngine.getDefinition(143).activate(DuelEngine.makeContext('player', { card: m, zone: 'st', index: 0 }));
            DuelEngine.recomputeStaticEffects();
            return { prima, dopo: DuelEngine.getEffectiveDef(obelisk) };
        });
        t.assert(mura.prima === mura.dopo, `Mura del Castello non rinforza un Dio Egizio, che non può essere bersaglio (${JSON.stringify(mura)})`);

        // --- Great Dezard (1129) e Fushioh Richie (1130): annullano la
        // Trappola che li bersaglia. Great Dezard solo dopo aver distrutto
        // un mostro in battaglia; Fushioh Richie sempre. ---
        const muraSu = (id, distrutti) => t.evaluate(({ id, distrutti }) => {
            const carta = { ...cardDatabase.find((c) => c.id === id), uid: 'protetto-' + id };
            if (distrutti) carta._battleDestructionCount = distrutti;
            gameState.playerMonsterField[0] = { card: carta, position: 'attack', isFaceDown: false };
            const prima = DuelEngine.getEffectiveDef(carta);
            const m = { ...cardDatabase.find((c) => c.id === 143), uid: 'mura-' + id + '-' + distrutti };
            DuelEngine.getDefinition(143).activate(DuelEngine.makeContext('player', { card: m, zone: 'st', index: 0 }));
            DuelEngine.recomputeStaticEffects();
            return DuelEngine.getEffectiveDef(carta) - prima;
        }, { id, distrutti });
        await prepara();
        t.assert(await muraSu(1130, 0) === 0, 'Fushioh Richie annulla la Trappola che la bersaglia');
        await prepara();
        t.assert(await muraSu(1129, 0) === 500, 'Great Dezard senza distruzioni in battaglia non protegge ancora: +500 DEF');
        await prepara();
        t.assert(await muraSu(1129, 1) === 0, 'Great Dezard dopo una distruzione in battaglia annulla la Trappola che la bersaglia');

        // --- Controllore del Nemico (226): scelta fra i due effetti ---
        // Senza interfaccia la scelta è quella del bot: sacrifica il proprio
        // mostro PIÙ DEBOLE (prima: il primo trovato) e prende il più forte.
        await prepara();
        const controllore = await t.evaluate(() => {
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && !DuelEngine.getDefinition(c.id));
            // Anche la DEF va fissata: il bot valuta il sacrificio col massimo fra ATK e DEF, e quella
            // della carta di base (qualunque sia) farebbe sembrare il costo troppo alto per convenire.
            gameState.playerMonsterField[0] = { card: { ...base, attack: 1800, defense: 1000, uid: 'mio-forte' }, position: 'attack', isFaceDown: false };
            gameState.playerMonsterField[1] = { card: { ...base, attack: 300, defense: 200, uid: 'mio-debole' }, position: 'attack', isFaceDown: false };
            gameState.botMonsterField[0] = { card: { ...base, attack: 1000, defense: 1000, uid: 'suo-debole' }, position: 'attack', isFaceDown: false };
            gameState.botMonsterField[1] = { card: { ...base, attack: 2500, defense: 1000, uid: 'suo-forte' }, position: 'attack', isFaceDown: false };
            gameState.playerGraveyard = [];
            DuelEngine.getDefinition(226).activate(DuelEngine.makeContext('player', { card: { ...cardDatabase.find((c) => c.id === 226), uid: 'contr' } }));
            return {
                miei: gameState.playerMonsterField.filter(Boolean).map((s) => s.card.uid).sort(),
                cimitero: gameState.playerGraveyard.map((c) => c.uid)
            };
        });
        t.assert(controllore.cimitero.includes('mio-debole'), `226: sacrifica il proprio mostro più debole (${JSON.stringify(controllore)})`);
        t.assert(JSON.stringify(controllore.miei) === JSON.stringify(['mio-forte', 'suo-forte']), `226: prende il controllo del mostro avversario più forte (${JSON.stringify(controllore)})`);
    }
};
