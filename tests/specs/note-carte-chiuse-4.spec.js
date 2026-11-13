// Le ultime 17 carte con uno scostamento reale dal testo (categoria A dei
// missingEffectNote), chiuse con meccanismi generici del motore. Si
// sorveglia il COMPORTAMENTO; le battaglie passano da resolveAttack vero.
module.exports = {
    name: 'Note chiuse (4): le 17 carte della categoria A',
    async run(t) {
        const prepara = () => t.evaluate(() => {
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            window.__battleDone = false;
            window.DuelEngineUI = null;
            gameState.playerLP = 99999;
            gameState.botLP = 99999;
            gameState.gameOver = false;
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.playerSTField = [null, null, null, null, null];
            gameState.botSTField = [null, null, null, null, null];
            gameState.playerFieldSpell = null;
            gameState.botFieldSpell = null;
            gameState.playerGraveyard = [];
            gameState.botGraveyard = [];
            gameState.playerBanished = [];
            gameState.botBanished = [];
            gameState.monsterEffectsNegatedUidsFor = { player: new Set(), bot: new Set() };
            gameState.negatedEffectsForeverUids = new Set();
            gameState.chain = { links: [], active: false };
            gameState.currentPlayer = 'player';
            gameState.phase = 'main1';
            DuelEngine.recomputeStaticEffects();
        });
        const battaglia = async (setup) => {
            await prepara();
            await t.evaluate(() => { gameState.phase = 'battle'; });
            await t.evaluate(setup);
            await t.page.waitForFunction(() => window.__battleDone === true, null, { timeout: 8000 });
        };

        // --- 1110 Mummia Errante: rimescola SOLO le coperte in Difesa ---
        await prepara();
        const mummia = await t.evaluate(() => {
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            const mum = { ...cardDatabase.find((c) => c.id === 1110), uid: 'mum' };
            const cop = (u) => ({ card: { ...base, uid: u }, position: 'defense', isFaceDown: true });
            gameState.playerMonsterField = [{ card: mum, position: 'attack', isFaceDown: false }, cop('c1'), { card: { ...base, uid: 'su' }, position: 'attack', isFaceDown: false }, cop('c2'), cop('c3')];
            const orig = Math.random; Math.random = () => 0;
            DuelEngine.getDefinition(1110).activate(DuelEngine.makeContext('player', { card: mum, zone: 'monster', index: 0 }));
            Math.random = orig;
            return gameState.playerMonsterField.map((s) => s && s.card.uid);
        });
        t.assert(mummia[2] === 'su', `La carta scoperta non si muove: ${JSON.stringify(mummia)}`);
        t.assert(JSON.stringify([...mummia].sort()) === JSON.stringify(['c1', 'c2', 'c3', 'mum', 'su']), `Nessuna carta persa o duplicata: ${JSON.stringify(mummia)}`);
        t.assert(JSON.stringify(mummia) !== JSON.stringify(['mum', 'c1', 'su', 'c2', 'c3']), `Le coperte devono essere state rimescolate: ${JSON.stringify(mummia)}`);

        // --- 1030 Barattolo Cobra: il Token distrutto in battaglia infligge 500 ---
        await battaglia(() => {
            DuelEngine.getDefinition(1030).onFlip(DuelEngine.makeContext('player', { card: { ...cardDatabase.find((c) => c.id === 1030), uid: 'cobra' } }));
            const iToken = gameState.playerMonsterField.findIndex((s) => s && s.card.isToken);
            window.__lpBot = gameState.botLP;
            gameState.botMonsterField[0] = { card: { ...cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck), attack: 3000, uid: 'att-cobra' }, position: 'attack', isFaceDown: false, hasAttacked: false };
            resolveAttack('bot', 0, iToken, () => { window.__battleDone = true; });
        });
        const cobra = await t.evaluate(() => window.__lpBot - gameState.botLP);
        t.assert(cobra === 500, `Il Token Serpente Velenoso distrutto in battaglia infligge 500 all'avversario (ne ha inflitti ${cobra})`);

        // --- 154 Clonazione: statistiche originali, Token distrutto col bersaglio ---
        await prepara();
        const clone = await t.evaluate(() => {
            const orig = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && c.level && c.attack > 0);
            const evocato = { ...orig, attack: orig.attack + 777, uid: 'clonato' };
            gameState.botMonsterField[0] = { card: evocato, position: 'attack', isFaceDown: false };
            DuelEngine.getDefinition(154).onOpponentSummon(DuelEngine.makeContext('player', { card: { ...cardDatabase.find((c) => c.id === 154), uid: 'clon-trap' }, summonedCard: evocato, summonedSlotIndex: 0 }));
            const token = gameState.playerMonsterField.find((s) => s && s.card.isToken);
            const atk = token && token.card.attack;
            DuelEngine.actions.destroyMonster('bot', 0);
            return { atk, originale: orig.attack, tokenSopravvive: gameState.playerMonsterField.some((s) => s && s.card.isToken) };
        });
        t.assert(clone.atk === clone.originale, `Il Token copia l'ATK ORIGINALE (${clone.atk} contro ${clone.originale})`);
        t.assert(!clone.tokenSopravvive, 'Distrutto il bersaglio, il Token di Clonazione viene distrutto con lui');

        // --- 1080 Kycoo: l'avversario non può bandire dal Cimitero ---
        await prepara();
        const kycoo = await t.evaluate(() => {
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            gameState.playerMonsterField[0] = { card: { ...cardDatabase.find((c) => c.id === 1080), uid: 'kycoo' }, position: 'attack', isFaceDown: false };
            gameState.playerGraveyard = [{ ...base, uid: 'g1' }, { ...base, uid: 'g2' }];
            DuelEngine.recomputeStaticEffects();
            const avversario = DuelEngine.makeContext('bot', {}).banishFromGraveyard('player', gameState.playerGraveyard[0]);
            const proprio = DuelEngine.makeContext('player', {}).banishFromGraveyard('player', gameState.playerGraveyard[0]);
            return { avversario, proprio };
        });
        t.assert(kycoo.avversario === false && kycoo.proprio === true, `Con Kycoo scoperto l'avversario non bandisce dal Cimitero, il suo controllore sì: ${JSON.stringify(kycoo)}`);

        // --- 198 Drago della Dimensione Diversa ---
        await prepara();
        const ddd = await t.evaluate(() => {
            const mettiDrago = () => { gameState.playerMonsterField[0] = { card: { ...cardDatabase.find((c) => c.id === 198), uid: 'ddd' }, position: 'attack', isFaceDown: false }; };
            const magia = { ...cardDatabase.find((c) => c.type === 'spell'), uid: 'mag-ddd' };
            const mostro = { ...cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck), uid: 'mon-ddd' };
            mettiDrago();
            DuelEngine.makeContext('bot', { card: magia }).destroyMonster('player', 0);
            const nonMirata = !!gameState.playerMonsterField[0];
            mettiDrago();
            const ctxMirata = DuelEngine.makeContext('bot', { card: magia });
            ctxMirata.destroyTargetedMonster('player', 0);
            const mirata = !!gameState.playerMonsterField[0];
            mettiDrago();
            DuelEngine.makeContext('bot', { card: mostro }).destroyMonster('player', 0);
            const daMostro = !!gameState.playerMonsterField[0];
            return { nonMirata, mirata, daMostro };
        });
        t.assert(ddd.nonMirata === true, 'Una Magia che non lo bersaglia non lo distrugge');
        t.assert(ddd.mirata === false, 'Una Magia che lo sceglie come bersaglio lo distrugge');
        t.assert(ddd.daMostro === false, 'L\'immunità vale solo contro Magie/Trappole, non contro un effetto Mostro');

        // --- 423 Bastone del Silenzio, 888 Freed: negano (e distruggono) la Magia che bersaglia ---
        await prepara();
        const silenzio = await t.evaluate(() => {
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            gameState.playerMonsterField[0] = { card: { ...base, uid: 'protetto' }, position: 'attack', isFaceDown: false };
            gameState.playerSTField[0] = { card: { ...cardDatabase.find((c) => c.id === 423), uid: 'bastone', equippedToUid: 'protetto', equippedToOwner: 'player', equippedToIndex: 0 }, isFaceDown: false };
            const equipNemico = { ...cardDatabase.find((c) => c.type === 'spell' && c.subtype === 'equip' && c.id !== 423), uid: 'magia-nemica' };
            gameState.botSTField[0] = { card: equipNemico, isFaceDown: false };
            const daMagia = DuelEngine.makeContext('bot', { card: equipNemico }).declareTarget('player', 0);
            const trappola = { ...cardDatabase.find((c) => c.type === 'trap'), uid: 'trap-nemica' };
            const daTrappola = DuelEngine.makeContext('bot', { card: trappola }).declareTarget('player', 0);
            const res = { magiaBloccata: !daMagia.allowed, magiaDistrutta: !gameState.botSTField[0], trappolaPassa: daTrappola.allowed };
            // Freed
            gameState.playerMonsterField[1] = { card: { ...cardDatabase.find((c) => c.id === 888), uid: 'freed' }, position: 'attack', isFaceDown: false };
            gameState.botSTField[1] = { card: { ...equipNemico, uid: 'magia-freed' }, isFaceDown: false };
            const suFreed = DuelEngine.makeContext('bot', { card: gameState.botSTField[1].card }).declareTarget('player', 1);
            res.freedBlocca = !suFreed.allowed;
            res.freedDistrugge = !gameState.botSTField[1];
            return res;
        });
        t.assert(silenzio.magiaBloccata && silenzio.magiaDistrutta, `Bastone del Silenzio nega e distrugge la Magia Equip che bersaglia il mostro: ${JSON.stringify(silenzio)}`);
        t.assert(silenzio.trappolaPassa, 'Contro una Trappola il Bastone non fa nulla');
        t.assert(silenzio.freedBlocca && silenzio.freedDistrugge, 'Freed nega e distrugge una Magia che resta in campo e lo bersaglia');

        // --- 888 Freed: in Draw Phase si sceglie se pescare o cercare (e quale Guerriero) ---
        await prepara();
        await t.evaluate(() => {
            const guerrieri = cardDatabase.filter((c) => c.type === 'monster' && c.race === 'Guerriero' && (c.level || 0) <= 4 && !c.extraDeck).slice(0, 2);
            gameState.playerMonsterField[0] = { card: { ...cardDatabase.find((c) => c.id === 888), uid: 'freed-d' }, position: 'attack', isFaceDown: false };
            gameState.playerDeck = [{ ...guerrieri[0], uid: 'w1' }, { ...guerrieri[1], uid: 'w2' }];
            gameState.playerHand = [];
            gameState.freedChoiceTurn = null;
            window.__fatto = false;
            window.DuelEngineUI = {
                openChoicePopover(a, o) { o.choiceA.onSelect(); },
                openCardListPicker(cards, o) { o.onSelect(cards[1]); }
            };
            enterDrawPhaseInner(false, () => { window.__fatto = true; });
        });
        await t.page.waitForFunction(() => window.__fatto === true, null, { timeout: 5000 });
        const freedCerca = await t.evaluate(() => ({ mano: gameState.playerHand.map((c) => c.uid), deck: gameState.playerDeck.map((c) => c.uid) }));
        t.assert(JSON.stringify(freedCerca.mano) === '["w2"]' && JSON.stringify(freedCerca.deck) === '["w1"]',
            `Scegliendo di cercare si prende il Guerriero scelto, non il primo: ${JSON.stringify(freedCerca)}`);

        // --- 1001 Sacerdote di Asura: attacca ogni mostro una volta ---
        await battaglia(() => {
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            gameState.playerMonsterField[0] = { card: { ...cardDatabase.find((c) => c.id === 1001), attack: 3000, uid: 'asura' }, position: 'attack', isFaceDown: false, hasAttacked: false };
            gameState.botMonsterField = [{ card: { ...base, attack: 100, defense: 100, uid: 'v1' }, position: 'attack', isFaceDown: false }, { card: { ...base, attack: 100, defense: 100, uid: 'v2' }, position: 'attack', isFaceDown: false }, null, null, null];
            resolveAttack('player', 0, 0, () => { window.__battleDone = true; });
        });
        // Sulla suite di GitHub (Linux, più lenta) qui il Sacerdote non era più
        // nella sua casella, e il test si fermava su un "null" senza dire
        // altro. Ora, se manca, l'errore racconta dove è finito e cosa dice il
        // registro del duello: è da lì che si capirà la causa vera.
        const asura1 = await t.evaluate(() => {
            const slot = gameState.playerMonsterField[0];
            if (slot && slot.card && slot.card.uid === 'asura') {
                return {
                    presente: true,
                    puoAncora: !slot.hasAttacked,
                    // Per capire un fallimento visto solo su GitHub: il
                    // registro degli attacchi vale solo col timbro del turno
                    // corrente (vedi attackedEnemyUidsOf in battaglia.js).
                    turno: gameState.turn,
                    timbroRegistro: slot.attackedEnemyUidsTurn,
                    registro: slot.attackedEnemyUids ? Array.from(slot.attackedEnemyUids) : null,
                    avversari: gameState.botMonsterField.map((s) => s && s.card && s.card.uid),
                    fase: gameState.phase, diChi: gameState.currentPlayer
                };
            }
            const dove = (z) => (gameState[z] || []).some((c) => c && (c.uid === 'asura' || (c.card && c.card.uid === 'asura')));
            const log = Array.from(document.querySelectorAll('#gameLog .log-entry, #gameLog p, #gameLog div')).slice(-8).map((e) => e.textContent.trim()).filter(Boolean);
            return {
                presente: false,
                casella0: slot ? (slot.card && slot.card.uid) : null,
                campo: gameState.playerMonsterField.map((s) => s && s.card && s.card.uid),
                cimitero: dove('playerGraveyard'), banditi: dove('playerBanished'),
                fase: gameState.phase, turno: gameState.turn, diChi: gameState.currentPlayer, log
            };
        });
        t.assert(asura1.presente, `Il Sacerdote di Asura deve essere ancora in campo dopo il primo attacco: ${JSON.stringify(asura1)}`);
        t.assert(asura1.puoAncora, `Dopo aver attaccato un mostro, il Sacerdote di Asura può attaccare ancora (resta un altro mostro): ${JSON.stringify(asura1)}`);
        await t.evaluate(() => { window.__battleDone = false; resolveAttack('player', 0, 1, () => { window.__battleDone = true; }); });
        await t.page.waitForFunction(() => window.__battleDone === true, null, { timeout: 8000 });
        const asura2 = await t.evaluate(() => new Promise((ok) => {
            const finito = gameState.playerMonsterField[0].hasAttacked;
            const lp = gameState.botLP;
            gameState.playerMonsterField[0].hasAttacked = false; // forza: anche così niente attacco diretto dopo aver attaccato mostri
            resolveAttack('player', 0, -1, () => ok({ finito, direttoRifiutato: gameState.botLP === lp }));
        }));
        t.assert(asura2.finito, 'Attaccati tutti i mostri, gli attacchi finiscono');
        t.assert(asura2.direttoRifiutato, 'Dopo aver attaccato dei mostri non può attaccare direttamente');

        // --- 1035 Bollettino Meteo: seconda Battle Phase ---
        await prepara();
        const meteo = await t.evaluate(() => {
            gameState.botSTField[0] = { card: { ...cardDatabase.find((c) => c.id === 8), uid: 'spade' }, isFaceDown: false };
            gameState.turn = 5;
            DuelEngine.getDefinition(1035).onFlip(DuelEngine.makeContext('player', { card: { ...cardDatabase.find((c) => c.id === 1035), uid: 'meteo' } }));
            const spadeVia = !gameState.botSTField[0];
            gameState.playerMonsterField[0] = { card: { ...cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck), uid: 'm-meteo' }, position: 'attack', isFaceDown: false, hasAttacked: true };
            gameState.phase = 'main2';
            const puo = canConductSecondBattlePhase('player');
            startSecondBattlePhase('player');
            return { spadeVia, puo, fase: gameState.phase, attaccoRestituito: !gameState.playerMonsterField[0].hasAttacked, unaVolta: canConductSecondBattlePhase('player') };
        });
        t.assert(meteo.spadeVia && meteo.puo, `Distrutta una Spada Rivelatrice, si può condurre una seconda Battle Phase: ${JSON.stringify(meteo)}`);
        t.assert(meteo.fase === 'battle' && meteo.attaccoRestituito, 'Nella seconda Battle Phase i mostri possono attaccare di nuovo');
        t.assert(meteo.unaVolta === false, 'La seconda Battle Phase si conduce una volta sola');

        // --- 146 Catena di Distruzione: anche sulla PROPRIA Evocazione ---
        await prepara();
        const catena = await t.evaluate(() => {
            const nome = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && c.attack <= 2000);
            gameState.playerHand = [{ ...nome, uid: 'h-copia' }];
            gameState.playerDeck = [{ ...nome, uid: 'd-copia' }, { ...cardDatabase.find((c) => c.type === 'spell'), uid: 'altro' }];
            DuelEngine.getDefinition(146).onOwnSummonResponse(DuelEngine.makeContext('player', { card: { ...cardDatabase.find((c) => c.id === 146), uid: 'cat' }, summonedCard: { ...nome, uid: 'evocato' } }));
            return { mano: gameState.playerHand.length, deck: gameState.playerDeck.map((c) => c.uid) };
        });
        t.assert(catena.mano === 0 && JSON.stringify(catena.deck) === '["altro"]', `Sulla propria Evocazione distrugge le PROPRIE copie: ${JSON.stringify(catena)}`);

        // --- 882 Oppressione Reale: Continua, e serve LP per pagare ---
        const oppressione = await t.evaluate(() => {
            const def = DuelEngine.getDefinition(882);
            gameState.playerLP = 700;
            // Oppressione è un trigger opzionale sull'Evocazione Speciale,
            // non un'attivazione manuale: il motore la interroga con questo hook.
            const senzaLp = def.canRespondToSpecialSummonAttempt(DuelEngine.makeContext('player', { summonedVia: 'special', summonedCard: {} }));
            gameState.playerLP = 99999;
            return { continua: !!def.continuous, senzaLp };
        });
        t.assert(oppressione.continua && oppressione.senzaLp === false, 'Oppressione Reale resta in campo (Continua) e non si usa senza 800 LP da pagare');

        // --- 469 Il Sigillo di Orichalcos ---
        await prepara();
        const sigillo = await t.evaluate(() => {
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            gameState.orichalcosActivatedFor = {};
            gameState.playerMonsterField = [
                { card: { ...base, attack: 1000, uid: 'ss' }, position: 'attack', isFaceDown: false, wasSpecialSummoned: true },
                { card: { ...base, attack: 1500, uid: 'n1' }, position: 'attack', isFaceDown: false },
                { card: { ...base, attack: 2500, uid: 'n2' }, position: 'attack', isFaceDown: false }, null, null];
            const sig = { ...cardDatabase.find((c) => c.id === 469), uid: 'sigillo' };
            const def = DuelEngine.getDefinition(469);
            def.activate(DuelEngine.makeContext('player', { card: sig, zone: 'fieldSpell' }));
            gameState.playerFieldSpell = { card: sig, isFaceDown: false };
            const ssDistrutto = !gameState.playerMonsterField.some((s) => s && s.card.uid === 'ss');
            const secondaVolta = def.canActivate(DuelEngine.makeContext('player', { card: sig }));
            DuelEngine.recomputeStaticEffects();
            const voceDebole = gameState.cannotBeAttackTargetUids.n1;
            const voceForte = gameState.cannotBeAttackTargetUids.n2;
            const debolePro = typeof voceDebole === 'function' ? voceDebole({}) : !!voceDebole;
            const fortePro = typeof voceForte === 'function' ? voceForte({}) : !!voceForte;
            const extraBloccato = DuelEngine.isExtraDeckSummonBlocked('player');
            const primo = DuelEngine.actions.destroyFieldSpell('player');
            const secondo = DuelEngine.actions.destroyFieldSpell('player');
            return { ssDistrutto, secondaVolta, debolePro, fortePro, extraBloccato, primo, secondo };
        });
        t.assert(sigillo.ssDistrutto, 'All\'attivazione distrugge i propri mostri Special Summonati');
        t.assert(sigillo.secondaVolta === false, 'Si attiva una sola volta per Duello');
        t.assert(sigillo.debolePro && !sigillo.fortePro, `Con 2+ mostri in Attacco è protetto dagli attacchi solo quello con l'ATK più basso: ${JSON.stringify(sigillo)}`);
        t.assert(sigillo.extraBloccato, 'Niente Special Summon dall\'Extra Deck finché è in campo');
        t.assert(sigillo.primo === false && sigillo.secondo === true, 'La prima distruzione del turno è assorbita, la seconda no');

        // --- 890 Necrovalley: niente rianimazioni né recuperi dal Cimitero ---
        await prepara();
        const necro = await t.evaluate(() => {
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            gameState.playerFieldSpell = { card: { ...cardDatabase.find((c) => c.id === 890), uid: 'necro' }, isFaceDown: false };
            const morto = { ...base, uid: 'morto' };
            const evocato = DuelEngine.actions.specialSummon('player', morto, 0, 'attack', 'graveyard');
            const tornatoNelCimitero = gameState.playerGraveyard.some((c) => c.uid === 'morto');
            const ctx = DuelEngine.makeContext('player', {});
            const preso = CardEffectsShared.searchGraveyardWithChoice(ctx, 'player', () => true, {}, () => {});
            return { evocato, tornatoNelCimitero, campoVuoto: !gameState.playerMonsterField[0], preso };
        });
        t.assert(necro.evocato === false && necro.campoVuoto && necro.tornatoNelCimitero, `Con Necrovalley una rianimazione è negata e la carta resta nel Cimitero: ${JSON.stringify(necro)}`);
        t.assert(necro.preso === false, 'Con Necrovalley non si recupera nulla dal Cimitero');

        // --- 900 Sentinella: dalla mano nega un'attivazione che fa scartare ---
        await prepara();
        const sentinella = await t.evaluate(() => {
            const def = DuelEngine.getDefinition(900);
            const faScartare = { ...cardDatabase.find((c) => c.type === 'spell' && /scart/i.test(c.effect || '') && !/^\s*(scarta|paga)/i.test(c.effect || '')), uid: 'scarto-x' };
            const innocua = { ...cardDatabase.find((c) => c.type === 'spell' && !/scart/i.test(c.effect || '')), uid: 'innocua' };
            const ctx = DuelEngine.makeContext('player', { card: { ...cardDatabase.find((c) => c.id === 900), uid: 'sent' }, zone: 'hand', index: 0 });
            gameState.chain = { links: [{ owner: 'bot', card: innocua, negated: false }], active: true };
            const controInnocua = def.canActivateFromHand(ctx);
            gameState.chain = { links: [{ owner: 'bot', card: faScartare, negated: false }], active: true };
            const controScarto = def.canActivateFromHand(ctx);
            def.activateFromHand(ctx);
            const negata = gameState.chain.links[0].negated === true;
            gameState.chain = { links: [], active: false };
            return { controInnocua, controScarto, negata, nome: faScartare.name };
        });
        t.assert(sentinella.controInnocua === false, 'La Sentinella non risponde a un\'attivazione che non fa scartare');
        t.assert(sentinella.controScarto && sentinella.negata, `La Sentinella nega un'attivazione che fa scartare (${sentinella.nome})`);

        // --- 1059 Amuleto di Shabti: i Guardiani della Tomba non muoiono in battaglia ---
        await battaglia(() => {
            const gk = { ...cardDatabase.find((c) => c.type === 'monster' && c.name && c.name.includes('Guardiani della Tomba')), attack: 100, defense: 100, uid: 'gk' };
            gameState.playerMonsterField[0] = { card: gk, position: 'attack', isFaceDown: false };
            gameState.botMonsterField[0] = { card: { ...cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck), attack: 3000, uid: 'att-gk' }, position: 'attack', isFaceDown: false, hasAttacked: false };
            const ctx = DuelEngine.makeContext('player', { card: { ...cardDatabase.find((c) => c.id === 1059), uid: 'shabti' }, attackerOwner: 'bot', attackerIndex: 0, targetIndex: 0 });
            window.__shabtiPuo = DuelEngine.getDefinition(1059).canActivate(ctx);
            DuelEngine.getDefinition(1059).onAttackDeclare(ctx);
            resolveAttack('bot', 0, 0, () => { window.__battleDone = true; });
        });
        const shabti = await t.evaluate(() => ({ puo: window.__shabtiPuo, vivo: gameState.playerMonsterField.some((s) => s && s.card.uid === 'gk') }));
        t.assert(shabti.puo && shabti.vivo, `Amuleto di Shabti protegge il Guardiano della Tomba attaccato: ${JSON.stringify(shabti)}`);
    }
};
