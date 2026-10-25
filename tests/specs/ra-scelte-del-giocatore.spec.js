// Il Drago Alato di Ra (id 472) e la sua Modalità Sfera (id 1275): le scelte che spettano al giocatore.
//  1. All'Evocazione Normale si paga "FINO A che te ne rimangono solo 100": si sceglie QUANTO (prima: tutto o niente).
//  2. L'effetto da 1000 LP lascia scegliere il mostro da distruggere (prima prendeva da solo il più forte avversario).
//  3. La Sfera si offre in Tributo solo da scoperta sul Terreno (prima era "attivabile" anche in mano) e anche con il
//     Terreno pieno, perché la sua casella si libera prima che Ra entri.
module.exports = {
    name: 'Ra: la somma da pagare e il bersaglio li sceglie il giocatore; la Sfera si attiva solo dal Terreno',
    async run(t) {
        await t.page.waitForTimeout(2500);   // lascia assestare la cascata delle fasi (vedi tests/README.md)

        // --- 1) Il popover: slider da 0 a LP-100, "Metà", "Tutto", "Paga", "Non pagare" ---------------------------------
        const popover = await t.evaluate(() => {
            gameState.playerLP = 8000;
            const ra = { ...cardDatabase.find((c) => c.id === 472), uid: 'ra-pop' };
            const slotEl = document.querySelector('#playerFieldBoard .field-slot') || document.body;
            let proceduto = 0;
            maybeAskRaLpChoice(ra, slotEl, () => { proceduto++; });
            const range = document.getElementById('qpRaRange');
            const out = { max: range && range.max, valoreIniziale: range && range.value, info: document.getElementById('qpRaInfo').textContent };
            document.getElementById('qpRaMeta').click();
            out.meta = range.value;
            document.getElementById('qpRaTutto').click();
            out.tutto = range.value;
            range.value = '3000';
            range.dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('qpRaPayYes').click();
            out.scelto = ra._raPayLp;
            out.proceduto = proceduto;
            return out;
        });
        t.assert(popover.max === '7900' && popover.valoreIniziale === '7900', `lo slider arriva a LP-100: ${JSON.stringify(popover)}`);
        t.assert(popover.meta === '3950' || popover.meta === '4000', `"Metà" mette circa la metà: ${popover.meta}`);
        t.assert(popover.tutto === '7900', `"Tutto" torna al massimo: ${popover.tutto}`);
        t.assert(popover.scelto === 3000 && popover.proceduto === 1, `"Paga" salva la somma scelta e prosegue: ${JSON.stringify(popover)}`);

        const rifiuto = await t.evaluate(() => {
            gameState.playerLP = 8000;
            const ra = { ...cardDatabase.find((c) => c.id === 472), uid: 'ra-no' };
            maybeAskRaLpChoice(ra, document.body, () => {});
            document.getElementById('qpRaPayNo').click();
            return ra._raPayLp;
        });
        t.assert(rifiuto === false, `"Non pagare" vale false: ${rifiuto}`);

        // --- 2) onSummon paga esattamente la somma scelta --------------------------------------------------------------
        const paga = await t.evaluate(() => {
            const prova = (scelta, lp) => {
                gameState.playerLP = lp;
                gameState.atkDefBonus = {};
                const ra = { ...cardDatabase.find((c) => c.id === 472), uid: 'ra-' + String(scelta) + lp };
                if (scelta !== undefined) ra._raPayLp = scelta;
                DuelEngine.getDefinition(472).onSummon(DuelEngine.makeContext('player', { summonedCard: ra, summonedVia: 'normal' }));
                return { lp: gameState.playerLP, pagati: ra.raPaidLp || 0 };
            };
            return { tremila: prova(3000, 8000), troppo: prova(99999, 8000), zero: prova(0, 8000), tutto: prova(true, 8000), nonScelto: prova(undefined, 5000), basso: prova(500, 300) };
        });
        t.assert(paga.tremila.lp === 5000 && paga.tremila.pagati === 3000, `3000 scelti: ne paga 3000 e restano 5000 (${JSON.stringify(paga.tremila)})`);
        t.assert(paga.troppo.lp === 100 && paga.troppo.pagati === 7900, `una somma oltre il massimo si ferma a LP-100 (${JSON.stringify(paga.troppo)})`);
        t.assert(paga.zero.lp === 8000 && paga.zero.pagati === 0, `0 non paga nulla (${JSON.stringify(paga.zero)})`);
        t.assert(paga.tutto.lp === 100 && paga.nonScelto.lp === 100, `true o niente = tutto come prima (${JSON.stringify([paga.tutto, paga.nonScelto])})`);
        t.assert(paga.basso.lp === 100 && paga.basso.pagati === 200, `con 300 LP e 500 chiesti si paga al massimo 200 e restano 100: ${JSON.stringify(paga.basso)}`);

        // --- 3) L'effetto da 1000 LP lascia scegliere il bersaglio ------------------------------------------------------
        const bersaglio = await t.evaluate(() => {
            const mk = (id) => { const c = JSON.parse(JSON.stringify(cardDatabase.find((x) => x.id === id))); c.uid = 'rb' + id + '_' + Math.random(); return c; };
            const slot = (id) => ({ card: mk(id), position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedOnTurn: 0 });
            gameState.phase = 'main1'; gameState.currentPlayer = 'player';
            gameState.playerMonsterField.fill(null); gameState.botMonsterField.fill(null);
            gameState.playerMonsterField[0] = slot(472);
            gameState.playerMonsterField[1] = slot(4);     // un mostro MIO: ora si può scegliere anche lui
            gameState.botMonsterField[0] = slot(1);        // il più forte avversario (il vecchio auto-pick)
            gameState.botMonsterField[1] = slot(4);
            gameState.playerLP = 5000;
            const nomiPrima = gameState.botMonsterField.map((s) => s && s.card.name);
            const attivabile = DuelEngine.canActivate('player', 'monster', 0);
            DuelEngine.activateCard('player', 'monster', 0);
            return { attivabile, nomiPrima };
        });
        t.assert(bersaglio.attivabile, 'Ra e\' attivabile con 1000+ LP e un bersaglio');
        await t.page.waitForFunction(() => !!(window.Decisioni && Decisioni.inSospeso()), null, { timeout: 15000 });
        const aperta = await t.evaluate(() => {
            const d = Decisioni.inSospeso();
            return { n: d.candidati.length, proprietari: d.candidati.map((c) => c.owner), lp: gameState.playerLP };
        });
        t.assert(aperta.n === 3, `la lista offre i 2 mostri avversari e quello mio (non Ra stesso): ${JSON.stringify(aperta)}`);
        t.assert(aperta.lp === 5000, 'finché non si sceglie non si paga niente');
        // Si sceglie il SECONDO dell'avversario (non il più forte): con l'auto-pick di prima sarebbe stato impossibile.
        await t.evaluate(() => { const d = Decisioni.inSospeso(); Decisioni.rispondi(d.candidati.findIndex((c) => c.owner === 'bot' && c.index === 1)); });
        await t.page.waitForFunction(() => gameState.botMonsterField[1] === null, null, { timeout: 15000 });
        const dopo = await t.evaluate(() => ({ lp: gameState.playerLP, forte: !!gameState.botMonsterField[0], raInCampo: !!gameState.playerMonsterField[0] }));
        t.assert(dopo.lp === 4000 && dopo.forte && dopo.raInCampo, `distrutto il mostro scelto, pagati 1000, il più forte è intatto: ${JSON.stringify(dopo)}`);

        // --- 4) La Sfera: solo dal Terreno, anche a Terreno pieno ------------------------------------------------------
        const sfera = await t.evaluate(() => {
            const mk = (id) => { const c = JSON.parse(JSON.stringify(cardDatabase.find((x) => x.id === id))); c.uid = 'sf' + id + '_' + Math.random(); return c; };
            const slot = (id) => ({ card: mk(id), position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedOnTurn: 0 });
            gameState.phase = 'main1'; gameState.currentPlayer = 'player';
            gameState.playerMonsterField.fill(null); gameState.botMonsterField.fill(null);
            gameState.playerHand.length = 0;
            gameState.playerHand.push(mk(1275), mk(472));
            const inMano = DuelEngine.canActivate('player', 'hand', 0);
            gameState.playerHand.length = 0; gameState.playerHand.push(mk(472));
            gameState.playerMonsterField[0] = slot(1275);
            for (let i = 1; i < 5; i++) gameState.playerMonsterField[i] = slot(4);   // Terreno PIENO
            const pieno = DuelEngine.canActivate('player', 'monster', 0);
            return { inMano, pieno };
        });
        t.assert(sfera.inMano === false, 'la Sfera in mano non e\' attivabile');
        t.assert(sfera.pieno === true, 'la Sfera sul Terreno pieno e\' attivabile: la sua casella si libera per Ra');
    }
};
