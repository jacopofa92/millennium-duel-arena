// Attacco diretto con DUE opzioni (richiesta esplicita): l'avversario ha
// mostri, ma il mio mostro può comunque colpire i Life Point. Allora:
//  1) appena prendo il mostro per attaccare compaiono le bande laterali
//     "ATTACCO DIRETTO", tenui (la mossa c'è, non l'ho ancora scelta);
//  2) se porto la freccia oltre i mostri avversari si AGGANCIA alla mano
//     dell'avversario, la mano si accende e le bande tornano piene;
//     rilasciando lì parte l'attacco diretto.
// Senza permesso, niente bande e niente aggancio. La regola è una sola,
// puoAttaccareDirettamente (battaglia.js).
//
// Trascinamento VERO col mouse (page.mouse), non chiamate dirette: è
// l'interazione che si sta provando.
module.exports = {
    name: 'Attacco diretto possibile: bande tenui, aggancio alla mano, attacco al rilascio',
    async run(t) {
        const page = t.page;
        const prepara = (permesso) => t.evaluate((permesso) => {
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            const c = (id, uid) => ({ ...cardDatabase.find((x) => x.id === id), uid });
            gameState.gameOver = false;
            gameState.playerLP = 8000;
            gameState.botLP = 8000;
            gameState.turn = 3;
            gameState.currentPlayer = 'player';
            gameState.phase = 'battle';
            gameState.chain = { links: [], active: false };
            gameState.playerMonsterField = [{ card: c(1, 'attaccante'), position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedOnTurn: 0 }, null, null, null, null];
            gameState.botMonsterField = [null, null, { card: c(4, 'difensore'), position: 'attack', isFaceDown: false, hasAttacked: false, summonedOnTurn: 0 }, null, null];
            gameState.playerSTField = [null, null, null, null, null];
            gameState.botSTField = [null, null, null, null, null];
            gameState.directAttackAllowedFor = permesso ? { attaccante: true } : {};
            gameState.directAttackAllowedUids = {};
            DuelEngine.recomputeStaticEffects();
            updateUI();
        }, permesso);
        const punti = () => t.evaluate(() => {
            const centro = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
            return {
                attaccante: centro(document.querySelector('#playerFieldBoard .field-slot[data-type="monster"][data-index="0"] .card')),
                difensore: centro(document.querySelector('#botFieldBoard .field-slot[data-type="monster"][data-index="2"]')),
                // Una casella Magia/Trappola dell'avversario: sta oltre la
                // sua fila di mostri.
                oltre: centro(document.querySelector('#botFieldBoard .field-slot[data-type="spell-trap"][data-index="2"], #botFieldBoard .field-slot[data-index="2"]:not([data-type="monster"])')),
                mano: centro(document.getElementById('botHand')),
            };
        });
        const stato = () => t.evaluate(() => {
            const bande = document.getElementById('directAttackHint');
            // La punta della freccia: il mirino sta sempre sul suo estremo (la linea è ora un percorso curvo).
            const linea = document.getElementById('attack-arrow-target');
            return {
                bande: !!bande, tenui: !!bande && bande.classList.contains('daw-in-attesa'),
                manoAccesa: document.getElementById('botHand').classList.contains('attack-target-hover'),
                mostroAcceso: !!document.querySelector('#botFieldBoard .field-slot.attack-target-hover'),
                x2: +linea.getAttribute('cx'), y2: +linea.getAttribute('cy'),
            };
        });

        // --- Senza permesso: niente bande, niente aggancio ---
        await prepara(false);
        let p = await punti();
        await page.mouse.move(p.attaccante.x, p.attaccante.y);
        await page.mouse.down();
        let s = await stato();
        t.assert(!s.bande, 'senza permesso di attacco diretto non devono comparire le bande');
        await page.mouse.move(p.oltre.x, p.oltre.y, { steps: 8 });
        s = await stato();
        t.assert(!s.manoAccesa, 'senza permesso la freccia non si aggancia alla mano');
        await page.mouse.move(p.attaccante.x, p.attaccante.y, { steps: 4 });
        await page.mouse.up();

        // --- Con permesso: bande tenui, mostro bersaglio, poi aggancio ---
        await prepara(true);
        p = await punti();
        await page.mouse.move(p.attaccante.x, p.attaccante.y);
        await page.mouse.down();
        s = await stato();
        t.assert(s.bande && s.tenui, 'con il permesso le bande compaiono subito, tenui: ' + JSON.stringify(s));

        await page.mouse.move(p.difensore.x, p.difensore.y, { steps: 8 });
        s = await stato();
        t.assert(s.mostroAcceso && !s.manoAccesa && s.tenui, 'sopra un mostro si mira il mostro, bande ancora tenui: ' + JSON.stringify(s));

        await page.mouse.move(p.oltre.x, p.oltre.y, { steps: 8 });
        s = await stato();
        t.assert(s.manoAccesa && !s.mostroAcceso, 'oltre i mostri la freccia si aggancia alla mano: ' + JSON.stringify(s));
        t.assert(s.bande && !s.tenui, 'agganciata, le bande tornano piene');
        t.assert(Math.abs(s.x2 - p.mano.x) < 2 && Math.abs(s.y2 - p.mano.y) < 2,
            `la punta della freccia sta sul centro della mano (${s.x2},${s.y2} contro ${p.mano.x},${p.mano.y})`);

        // Tornando sul mostro l'aggancio si stacca.
        await page.mouse.move(p.difensore.x, p.difensore.y, { steps: 6 });
        s = await stato();
        t.assert(!s.manoAccesa && s.tenui, 'tornando sul mostro la freccia si stacca dalla mano');

        await page.mouse.move(p.oltre.x, p.oltre.y, { steps: 6 });
        await page.mouse.up();
        await page.waitForFunction(() => gameState.botLP < 8000, null, { timeout: 15000 });
        const esito = await t.evaluate(() => ({ lp: gameState.botLP, difensore: !!gameState.botMonsterField[2], manoAccesa: document.getElementById('botHand').classList.contains('attack-target-hover') }));
        t.assert(esito.lp === 8000 - 3000, 'il rilascio agganciato è un attacco diretto (3000 danni): LP ' + esito.lp);
        t.assert(esito.difensore, 'il mostro avversario non è stato toccato');
        t.assert(!esito.manoAccesa, 'a trascinamento finito la mano si spegne');
    }
};
