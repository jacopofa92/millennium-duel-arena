// Seconda ondata di carte "prima serie" (batch Legacy of Darkness/Metal
// Raiders/Spell Ruler, id 1001-1019): il ciclo di 8 Mostri Spirito di
// LOD, il cluster "attacca direttamente" di MRD, e 3 coppie Mostro
// Rituale + Magia Rituale di SRL — un test per meccanismo condiviso,
// non uno per carta, stesso spirito di return-to-hand-mechanism.spec.js.
module.exports = {
    name: 'Seconda ondata prima serie: Mostri Spirito, attacco diretto, Evocazione Rituale (id 1001-1019)',
    async run(t) {
        // Questo test piazza mostri e risolve attacchi manipolando
        // gameState direttamente: va prima lasciata assestare la cascata di
        // transizione fase del caricamento (Draw -> Standby -> Main Phase
        // 1), che freezeNaturalGameLoop NON ferma — congela solo le
        // decisioni autonome del bot (vedi tests/README.md, "Un'insidia
        // reale già presa in questa suite"). Sotto il carico della suite
        // completa quella cascata arrivava in mezzo al primo attacco e i
        // danni risultavano zero: il test falliva solo in `npm test`, mai
        // da solo (2 volte su 2 verde in isolamento). Stesso rimedio già
        // applicato a graveyard-search-real-choice,
        // lod-helpoemer-graveyard-battle-phase-end e
        // forced-attack-mechanism: si aspetta il segnale VERO di fine
        // cascata, la fase che si ferma su 'main1'.
        // (`gameState` è una `let` globale: esiste ma NON è una proprietà
        // di window, quindi va controllata con typeof.)
        await t.page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.phase === 'main1', null, { timeout: 15000 });

        async function runBattle(setupFn) {
            await t.evaluate(() => { window.__battleDone = false; });
            await t.evaluate(setupFn);
            await t.evaluate(() => { gameState.phase = 'battle'; });
            await t.page.waitForFunction(() => window.__battleDone === true, { timeout: 8000 });
        }

        // Soldato di Susa (1007): il danno da battaglia che infligge è dimezzato.
        await runBattle(() => {
            const susa = { ...cardDatabase.find((c) => c.id === 1007), uid: 'susa-1' };
            gameState.playerMonsterField = [{ card: susa, position: 'attack', isFaceDown: false, hasAttacked: false }, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            window.__lpBefore = gameState.botLP;
            resolveAttack('player', 0, -1, () => { window.__battleDone = true; });
        });
        const susaResult = await t.evaluate(() => gameState.botLP);
        const lpBeforeSusa = await t.evaluate(() => window.__lpBefore);
        t.assert(lpBeforeSusa - susaResult === 1000, `Soldato di Susa (2000 ATK) deve infliggere solo 1000 danni diretti dimezzati, non 2000 (rilevati ${lpBeforeSusa - susaResult})`);

        // Fushi No Tori (1002): guadagna LP pari al danno da battaglia inflitto.
        await runBattle(() => {
            const fushi = { ...cardDatabase.find((c) => c.id === 1002), uid: 'fushi-1' };
            gameState.playerMonsterField = [{ card: fushi, position: 'attack', isFaceDown: false, hasAttacked: false }, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.playerLP = 8000;
            window.__lpBefore = gameState.playerLP;
            resolveAttack('player', 0, -1, () => { window.__battleDone = true; });
        });
        const fushiResult = await t.evaluate(() => ({ playerLP: gameState.playerLP, lpBefore: window.__lpBefore }));
        t.assert(fushiResult.playerLP - fushiResult.lpBefore === 1200, `Fushi No Tori (1200 ATK) deve guadagnare 1200 LP dopo il danno da battaglia inflitto (rilevati +${fushiResult.playerLP - fushiResult.lpBefore})`);

        // Grande Naso Lungo (1003): se infligge danno da battaglia, l'avversario salta la sua prossima Battle Phase.
        await runBattle(() => {
            const gnl = { ...cardDatabase.find((c) => c.id === 1003), uid: 'gnl-1' };
            gameState.playerMonsterField = [{ card: gnl, position: 'attack', isFaceDown: false, hasAttacked: false }, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            resolveAttack('player', 0, -1, () => { window.__battleDone = true; });
        });
        const skipArmed = await t.evaluate(() => !!(gameState.skipNextBattlePhaseFor && gameState.skipNextBattlePhaseFor.bot));
        t.assert(skipArmed, 'Grande Naso Lungo deve armare skipNextBattlePhaseFor per il bot dopo aver inflitto danno da battaglia');
        const battleSkipped = await t.evaluate(() => {
            gameState.currentPlayer = 'bot';
            gameState.turn = 5;
            // Si parte da una fase DIVERSA da 'battle': runBattle qui sopra
            // lascia gameState.phase su 'battle' per far risolvere
            // l'attacco, e senza questa riga si verificherebbe "la Battle
            // Phase non è cominciata" partendo da una fase che è già
            // quella — l'asserzione passava solo quando il ciclo naturale
            // della pagina, nel frattempo, aveva per caso cambiato fase da
            // sé. Isolato succedeva, sotto il carico della suite no: da qui
            // un fallimento che compariva solo in `npm test`.
            gameState.phase = 'main1';
            enterBattlePhase();
            return gameState.phase !== 'battle';
        });
        t.assert(battleSkipped, 'La Battle Phase del bot deve essere saltata davvero (skipNextBattlePhaseFor consumato)');
        const flagCleared = await t.evaluate(() => gameState.skipNextBattlePhaseFor.bot === false);
        t.assert(flagCleared, 'skipNextBattlePhaseFor deve azzerarsi dopo essere stato consumato (non blocca anche il turno successivo)');

        // Hino-Kagu-Tsuchi (1004): se infligge danno da battaglia, l'avversario scarta l'intera mano alla sua prossima Draw Phase, prima di pescare.
        await runBattle(() => {
            const hino = { ...cardDatabase.find((c) => c.id === 1004), uid: 'hino-1' };
            gameState.playerMonsterField = [{ card: hino, position: 'attack', isFaceDown: false, hasAttacked: false }, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            resolveAttack('player', 0, -1, () => { window.__battleDone = true; });
        });
        const discardArmed = await t.evaluate(() => !!(gameState.discardHandBeforeDrawFor && gameState.discardHandBeforeDrawFor.bot));
        t.assert(discardArmed, 'Hino-Kagu-Tsuchi deve armare discardHandBeforeDrawFor per il bot dopo aver inflitto danno da battaglia');
        await t.evaluate(() => {
            gameState.currentPlayer = 'bot';
            gameState.turn = 5;
            gameState.botHand = [{ ...cardDatabase.find((c) => c.id === 4), uid: 'bh-a' }, { ...cardDatabase.find((c) => c.id === 5), uid: 'bh-b' }];
            gameState.botDeck = cardDatabase.filter((c) => c.type === 'monster' && !c.extraDeck).slice(0, 10).map((c) => ({ ...c }));
            window.__drawDone = false;
            enterDrawPhaseInner(false, () => { window.__drawDone = true; });
        });
        const graveyardHasDiscards = await t.evaluate(() => gameState.botGraveyard.some((c) => c.uid === 'bh-a') && gameState.botGraveyard.some((c) => c.uid === 'bh-b'));
        t.assert(graveyardHasDiscards, 'Le 2 carte della mano del bot devono finire scartate nel Cimitero PRIMA della pescata');
        // La pescata vera gira dentro un setTimeout (900ms nominali, vedi
        // enterDrawPhaseInner in game-flow.js) — aspetta il segnale reale
        // invece di un tempo indovinato, stesso principio già noto da
        // battle-resolution.spec.js.
        await t.page.waitForFunction(() => window.__drawDone === true, { timeout: 8000 });
        const handAfterDraw = await t.evaluate(() => gameState.botHand.length);
        t.assert(handAfterDraw === 1, `Dopo lo scarto totale, il bot deve comunque pescare normalmente (attese 1 carta, rilevate ${handAfterDraw})`);

        // Coniglio Bianco di Inaba (1005) e Jinzo #7 (1009): possono attaccare direttamente anche se il bot controlla mostri.
        for (const [id, name] of [[1005, 'Coniglio Bianco Inaba'], [1009, 'Jinzo #7']]) {
            const canHit = await t.evaluate((cardId) => {
                const attacker = { ...cardDatabase.find((c) => c.id === cardId), uid: `direct-${cardId}` };
                const blocker = { ...cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck), uid: 'blocker-1', attack: 5000, defense: 5000 };
                gameState.playerMonsterField = [{ card: attacker, position: 'attack', isFaceDown: false, hasAttacked: false }, null, null, null, null];
                gameState.botMonsterField = [{ card: blocker, position: 'attack', isFaceDown: false, hasAttacked: false }, null, null, null, null];
                DuelEngine.recomputeStaticEffects ? DuelEngine.recomputeStaticEffects() : updateUI();
                return !!(gameState.directAttackAllowedUids && gameState.directAttackAllowedUids[attacker.uid]);
            }, id);
            t.assert(canHit, `${name} deve avere il permesso di attacco diretto (gameState.directAttackAllowedUids) anche con un mostro avversario in campo`);
        }

        // Otohime (1006): quando Evocata Normalmente, cambia la Posizione di Battaglia di 1 mostro scoperto avversario.
        const otohimeResult = await t.evaluate(() => {
            const otohime = { ...cardDatabase.find((c) => c.id === 1006), uid: 'oto-1' };
            const target = { ...cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck), uid: 'oto-target-1' };
            gameState.playerMonsterField = [{ card: otohime, position: 'attack', isFaceDown: false }, null, null, null, null];
            gameState.botMonsterField = [{ card: target, position: 'attack', isFaceDown: false }, null, null, null, null];
            const ctx = DuelEngine.makeContext('player', { card: otohime, summonedVia: 'normal' });
            DuelEngine.getDefinition(1006).onSummon(ctx);
            return gameState.botMonsterField[0].position;
        });
        t.assert(otohimeResult === 'defense', `Otohime deve cambiare la Posizione di Battaglia del mostro avversario da attacco a difesa (rilevato: ${otohimeResult})`);

        // Ricetta dell'Hamburger (1015): sacrifica per Livello totale >= 6, poi Special Summon Hamburger Famelico (1014) dalla mano.
        const ritualStart = await t.evaluate(() => {
            const recipe = { ...cardDatabase.find((c) => c.id === 1015), uid: 'recipe-1' };
            const burger = { ...cardDatabase.find((c) => c.id === 1014), uid: 'burger-1' };
            const fodder = { ...cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck), uid: 'fodder-1', level: 6 };
            gameState.playerMonsterField = [{ card: fodder, position: 'attack', isFaceDown: false }, null, null, null, null];
            gameState.playerHand = [burger];
            gameState.playerGraveyard = [];
            const ctx = DuelEngine.makeContext('player', { card: recipe });
            const canActivate = DuelEngine.getDefinition(1015).canActivate(ctx);
            DuelEngine.getDefinition(1015).activate(ctx);
            return {
                canActivate: canActivate,
                fodderSacrificed: !gameState.playerMonsterField.some((s) => s && s.card.uid === 'fodder-1'),
                sceneVisible: !!document.querySelector('.fx-ritual-scene'),
                burgerSummonedTooSoon: gameState.playerMonsterField.some((s) => s && s.card.uid === 'burger-1')
            };
        });
        t.assert(ritualStart.canActivate, 'Ricetta dell\'Hamburger deve essere attivabile con Livello totale sufficiente (6) sul Terreno');
        t.assert(ritualStart.fodderSacrificed, 'Il mostro Livello 6 sacrificato deve lasciare il Terreno');
        t.assert(ritualStart.sceneVisible && !ritualStart.burgerSummonedTooSoon,
            'La cinematica Rituale deve partire prima che Hamburger Famelico compaia sul Terreno');
        await t.page.waitForFunction(() => gameState.playerMonsterField.some((s) => s && s.card.uid === 'burger-1'), null, { timeout: 6000 });
        const burgerSummoned = await t.evaluate(() => gameState.playerMonsterField.some((s) => s && s.card.uid === 'burger-1'));
        t.assert(burgerSummoned, 'Hamburger Famelico deve essere Special Summonato sul Terreno dalla mano dopo la cinematica');

        // Hamburger Famelico (1014): non Evocabile Normalmente né Special Summonabile per un'altra via.
        const burgerLocked = await t.evaluate(() => {
            const def = DuelEngine.getDefinition(1014);
            return !!def.cannotNormalSummon && !!def.cannotBeSpecialSummoned;
        });
        t.assert(burgerLocked, 'Hamburger Famelico deve vietare Evocazione Normale e ogni Special Summon che non passi dalla sua Magia Rituale');
    }
};
