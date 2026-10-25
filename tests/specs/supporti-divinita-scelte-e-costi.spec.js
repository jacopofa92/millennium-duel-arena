// Supporti delle Divinità Egizie non coperti dagli altri spec: Attacco Forza del Tuono (1271), Pugno del Fato (1272) e il costo
// in Life Point della Fenice (1276). Ogni caso parte da un campo preparato a mano e risponde alle scelte come farebbe una persona.
module.exports = {
    standalone: false,
    name: 'Supporti Divinità: Forza del Tuono, Pugno del Fato e il costo della Fenice',
    async run(t) {
        await t.page.waitForTimeout(2500);   // lascia assestare la cascata delle fasi (vedi tests/README.md)
        await t.evaluate(() => {
            window.__mk = (id) => { const c = JSON.parse(JSON.stringify(cardDatabase.find((x) => x.id === id))); c.uid = 'S' + id + '_' + Math.random(); return c; };
            window.__slot = (id, extra) => Object.assign({ card: __mk(id), position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedOnTurn: 0 }, extra || {});
            window.__prep = () => {
                document.querySelectorAll('.modal-backdrop.open').forEach((m) => m.classList.remove('open'));
                gameState.phase = 'main1'; gameState.currentPlayer = 'player'; gameState.hasNormalSummoned = false;
                gameState.playerHand.length = 0;
                [gameState.playerMonsterField, gameState.botMonsterField, gameState.playerSTField, gameState.botSTField].forEach((z) => z.fill(null));
                gameState.playerLP = 8000; gameState.botLP = 8000; gameState.oncePerTurnUsed = {};
                gameState.noDamageFor = {}; gameState.pendingNoDamageExpiry = [];
                gameState.onlyOneAttackingMonsterFor = { player: false, bot: false };
                gameState.monsterEffectNamesNegatedThisTurn = new Set();
                updateUI();
            };
        });
        const inSospeso = (dove) => t.page.waitForFunction(() => !!(window.Decisioni && Decisioni.inSospeso()), null, { timeout: 20000 }).catch(() => { throw new Error('nessuna scelta aperta: ' + dove); });
        // La Catena della carta precedente puo' ancora star risolvendo (impulsi di ~2 s): un nuovo caso parte a Catena ferma.
        const aCatenaFerma = () => t.page.waitForFunction(() => !DuelEngine.isChainActive(), null, { timeout: 20000 }).then(() => t.page.waitForTimeout(400));
        // Rispondere via Decisioni non chiude il modale che la mostrava (lo farebbe il clic): lo chiudiamo noi, o la Catena lo aspetta.
        const rispondi = (indice) => t.evaluate((i) => {
            Decisioni.rispondi(i);
            document.querySelectorAll('.modal-backdrop.open').forEach((m) => m.classList.remove('open'));
            const p = document.getElementById('quickPopover'); if (p) p.remove();
        }, indice);

        // --- 1271: distrugge SOLO i mostri scoperti, poi pesca quanti ne sono finiti nel Cimitero -----------------------
        await t.evaluate(() => {
            __prep();
            gameState.playerMonsterField[0] = __slot(31);                                      // Slifer
            gameState.botMonsterField[0] = __slot(1);
            gameState.botMonsterField[1] = __slot(4);
            gameState.botMonsterField[2] = __slot(4, { isFaceDown: true, position: 'defense' });  // coperto: resta
            gameState.playerHand.push(__mk(1271));
        });
        t.assert(await t.evaluate(() => DuelEngine.canActivate('player', 'hand', 0)), 'Forza del Tuono e\' attivabile con Slifer e mostri scoperti avversari');
        await t.evaluate(() => DuelEngine.activateCard('player', 'hand', 0));
        await inSospeso('1271');
        const scelta = await t.evaluate(() => Decisioni.inSospeso().testo);
        t.assert(/Pescare 2 carte/.test(scelta), `chiede di pescare 2 carte (i mostri scoperti distrutti): ${scelta}`);
        const manoPrima = await t.evaluate(() => gameState.playerHand.length);
        await rispondi(0);
        await t.page.waitForFunction((m) => gameState.playerHand.length === m + 2, manoPrima, { timeout: 15000 });
        const dopo1271 = await t.evaluate(() => ({
            bot: gameState.botMonsterField.map((s) => s && (s.isFaceDown ? 'coperto' : 'scoperto')),
            soloUno: gameState.onlyOneAttackingMonsterFor.player
        }));
        t.assert(dopo1271.bot[0] === null && dopo1271.bot[1] === null && dopo1271.bot[2] === 'coperto', `distrutti i soli scoperti: ${JSON.stringify(dopo1271)}`);
        t.assert(dopo1271.soloUno === true, 'dopo aver pescato si puo\' attaccare con un solo mostro');
        await aCatenaFerma();
        t.assert(await t.evaluate(() => { __prep(); gameState.botMonsterField[0] = __slot(1); gameState.playerHand.push(__mk(1271)); return !DuelEngine.canActivate('player', 'hand', 0); }),
            'senza Slifer non si attiva');

        await aCatenaFerma();
        // --- 1272: sceglie un Mostro con Effetto, annulla il suo nome, poi distrugge le Magie/Trappole ---------------------
        await t.evaluate(() => {
            __prep();
            gameState.playerMonsterField[0] = __slot(30);                                      // Obelisk
            gameState.botMonsterField[0] = __slot(4);                                          // vanilla: non bersagliabile
            gameState.botMonsterField[1] = __slot(29);                                         // con effetto
            gameState.botMonsterField[2] = __slot(33);                                         // con effetto (due bersagli: la scelta non e' automatica)
            gameState.botSTField[0] = { card: __mk(10), isFaceDown: true, setOnTurn: 0 };
            gameState.playerHand.push(__mk(1272));
        });
        await t.evaluate(() => DuelEngine.activateCard('player', 'hand', 0));
        await inSospeso('1272 bersaglio');
        const candidati = await t.evaluate(() => Decisioni.inSospeso().candidati.map((c) => (c.card || c).name));
        t.assert(candidati.length === 2 && candidati.includes('Drago Occhi Blu Finale') && candidati.includes('Guardiano del Cancello'), `solo i Mostri con Effetto sono bersagli (il Guardiano Celtico no): ${JSON.stringify(candidati)}`);
        await t.evaluate(() => { const d = Decisioni.inSospeso(); Decisioni.rispondi(d.candidati.findIndex((c) => (c.card || c).name === 'Drago Occhi Blu Finale')); document.querySelectorAll('.modal-backdrop.open').forEach((m) => m.classList.remove('open')); });
        await t.page.waitForFunction(() => { const d = Decisioni.inSospeso(); return d && d.tipo === 'opzioni'; }, null, { timeout: 20000 }).catch(() => { throw new Error('1272: manca la scelta Distruggi tutte'); });
        await rispondi(0);   // "Distruggi tutte"
        await t.page.waitForFunction(() => gameState.botSTField[0] === null, null, { timeout: 15000 });
        const dopo1272 = await t.evaluate(() => ({
            mostro: gameState.botMonsterField[1], vanilla: !!gameState.botMonsterField[0],
            nomi: [...gameState.monsterEffectNamesNegatedThisTurn]
        }));
        t.assert(dopo1272.mostro === null && dopo1272.vanilla, `distrutto solo il mostro scelto: ${JSON.stringify(dopo1272)}`);
        t.assert(dopo1272.nomi.includes('Drago Occhi Blu Finale'), `gli effetti dei mostri con quel nome sono annullati per il turno: ${JSON.stringify(dopo1272.nomi)}`);

        await aCatenaFerma();
        // --- 1276: pagare 1000 LP e' un costo, non un danno: i blocchi dei danni non lo saltano -----------------------------
        await t.evaluate(() => {
            __prep();
            gameState.playerMonsterField[0] = __slot(1276);
            gameState.playerMonsterField[1] = __slot(4);       // un secondo bersaglio: con uno solo la scelta sarebbe automatica
            gameState.botMonsterField[0] = __slot(1);
            gameState.playerLP = 5000;
            gameState.noDamageFor = { player: true };       // come con Carta della Rovina
        });
        await t.evaluate(() => DuelEngine.activateCard('player', 'monster', 0));
        await inSospeso('1276');
        await t.evaluate(() => { const d = Decisioni.inSospeso(); Decisioni.rispondi(d.candidati.findIndex((c) => c.owner === 'bot')); document.querySelectorAll('.modal-backdrop.open').forEach((m) => m.classList.remove('open')); });
        await t.page.waitForFunction(() => gameState.botMonsterField[0] === null, null, { timeout: 15000 });
        const lp = await t.evaluate(() => gameState.playerLP);
        t.assert(lp === 4000, `con il blocco dei danni acceso la Fenice paga comunque i 1000 LP: ${lp}`);
        await t.evaluate(() => { gameState.noDamageFor = {}; });
    }
};
