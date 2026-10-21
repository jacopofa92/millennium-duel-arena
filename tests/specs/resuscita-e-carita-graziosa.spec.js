// Mostro Resuscitato (35) e Carità Graziosa (272): segnalati giocando.
// =====================================================================
//  1) l'animazione parte dal Cimitero GIUSTO: dall'avversario se la carta viene da lì;
//  2) chiudere il riquadro di scelta NON annulla la Magia (era "buttata" e la decisione restava appesa):
//     un effetto già attivato si porta a termine, quindi il riquadro si riapre;
//  3) Carità Graziosa: pesca 3 e scarta 2 A SCELTA del giocatore (prima scartava le ultime due della mano).
module.exports = {
    name: 'Mostro Resuscitato: animazione dal Cimitero giusto e scelta non annullabile; Carità Graziosa: lo scarto lo sceglie il giocatore',
    async run(t) {
        // --- 1) e 2) Mostro Resuscitato ---------------------------------------------------------------
        const avvio = await t.evaluate(() => {
            const mostri = cardDatabase.filter((c) => c.type === 'monster' && !c.extraDeck && (c.level || 4) <= 4 && !DuelEngine.getDefinition(c.id)?.cannotBeSpecialSummoned);
            window.__rinascite = [];
            const realFX = window.FX;
            window.__realFX = realFX;
            window.FX = { ...realFX, playMonsterReborn(graveyardOwner, card, targetOwner, targetIndex, done) { window.__rinascite.push({ graveyardOwner, uid: card.uid, targetOwner, targetIndex }); done(); } };
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.playerGraveyard = [{ ...mostri[0], uid: 'MIO-1' }];
            gameState.botGraveyard = [{ ...mostri[1], uid: 'SUO-1' }];
            const spell = { ...cardDatabase.find((c) => c.id === 35), uid: 'resuscita' };
            DuelEngine.getDefinition(35).activate(DuelEngine.makeContext('player', { card: spell }));
            return { aperto: document.getElementById('cardListPickerModal').classList.contains('open'), inSospeso: !!Decisioni.inSospeso() };
        });
        t.assert(avvio.aperto && avvio.inSospeso, 'Mostro Resuscitato con due Cimiteri pieni deve aprire la scelta');

        // chiudo il riquadro con la X: la scelta deve restare aperta (riaperta), non sparire
        await t.page.locator('#cardListPickerCloseBtn').click();
        await t.page.waitForTimeout(150);
        const dopoChiusura = await t.evaluate(() => ({
            aperto: document.getElementById('cardListPickerModal').classList.contains('open'),
            inSospeso: !!Decisioni.inSospeso()
        }));
        t.assert(dopoChiusura.inSospeso, 'Chiudere il riquadro non deve annullare Mostro Resuscitato: la decisione resta in attesa');
        t.assert(dopoChiusura.aperto, 'Il riquadro di scelta deve riaprirsi: la Magia va portata a termine');

        // scelgo il mostro nel Cimitero dell'AVVERSARIO (il secondo), poi l'Attacco
        const voci = await t.page.locator('#cardListPickerRow .card-list-item').count();
        t.assert(voci === 2, `Devono comparire i mostri di entrambi i Cimiteri (${voci})`);
        await t.page.locator('#cardListPickerRow .card-list-item').nth(1).click();
        await t.page.waitForTimeout(200);
        await t.page.locator('#qpPositionAttack').click();
        await t.page.waitForTimeout(300);
        const fine = await t.evaluate(() => {
            const r = window.__rinascite.slice();
            window.FX = window.__realFX;
            return { rinascite: r, campo: gameState.playerMonsterField.filter(Boolean).map((s) => s.card.uid), cimBot: gameState.botGraveyard.length, cimMio: gameState.playerGraveyard.length };
        });
        t.assert(fine.rinascite.length === 1 && fine.rinascite[0].graveyardOwner === 'bot' && fine.rinascite[0].targetOwner === 'player',
            `L'animazione deve partire dal Cimitero dell'avversario verso il campo del giocatore (${JSON.stringify(fine.rinascite)})`);
        t.assert(fine.campo.includes('SUO-1') && fine.cimBot === 0 && fine.cimMio === 1,
            `Il mostro dell'avversario arriva nel mio campo e il mio Cimitero resta intatto (${JSON.stringify(fine)})`);

        // --- 1b) la versione di base (CSS, quella dei telefoni senza WebGL): la carta parte DAVVERO dal Cimitero ---
        // Le variabili CSS ('--reborn-x') erano scritte con Object.assign(el.style, ...), che non le passa al CSS:
        // l'animazione partiva da un punto qualunque, qualunque Cimitero fosse quello giusto.
        const css = await t.evaluate(async () => {
            window.FX_BACKEND = 'css';
            const m = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            gameState.playerMonsterField = [null, null, null, null, null];
            updateUI();
            const centro = (o) => { const e = document.querySelector(`#${o === 'player' ? 'playerFieldBoard' : 'botFieldBoard'} .field-slot[data-owner="${o}"][data-zone="graveyard"]`); const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
            FX.playMonsterReborn('bot', { ...m, uid: 'FX-1' }, 'player', 2, () => {});
            await new Promise((r) => setTimeout(r, 200));
            const g = document.querySelector('.fx-reborn-card');
            const out = { atteso: centro('bot'), x: g && parseFloat(g.style.getPropertyValue('--reborn-x')), y: g && parseFloat(g.style.getPropertyValue('--reborn-y')) };
            window.FX_BACKEND = undefined;
            return out;
        });
        t.assert(Math.abs(css.x - css.atteso[0]) < 2 && Math.abs(css.y - css.atteso[1]) < 2,
            `Nella versione CSS la carta deve partire dal centro del Cimitero avversario (${JSON.stringify(css)})`);
        await t.page.waitForTimeout(2000);

        // --- 3) Carità Graziosa -----------------------------------------------------------------------
        const carita = await t.evaluate(() => {
            const base = cardDatabase.filter((c) => c.type === 'monster' && !c.extraDeck);
            gameState.playerHand = [{ ...base[0], uid: 'M-0' }, { ...base[1], uid: 'M-1' }];
            gameState.playerDeck = [{ ...base[2], uid: 'D-0' }, { ...base[3], uid: 'D-1' }, { ...base[4], uid: 'D-2' }, { ...base[5], uid: 'D-3' }];
            gameState.playerDeckCount = gameState.playerDeck.length;
            gameState.playerGraveyard = [];
            const spell = { ...cardDatabase.find((c) => c.id === 272), uid: 'carita' };
            DuelEngine.getDefinition(272).activate(DuelEngine.makeContext('player', { card: spell }));
            return { aperto: document.getElementById('cardListPickerModal').classList.contains('open'), mano: gameState.playerHand.map((c) => c.uid) };
        });
        t.assert(carita.aperto, 'Carità Graziosa deve far scegliere quale carta scartare');
        t.assert(carita.mano.length === 5, `Dopo la pescata la mano ha 5 carte (${JSON.stringify(carita.mano)})`);
        // scarto la PRIMA della mano (M-0): prima il motore avrebbe scartato le ultime due pescate
        await t.page.locator('#cardListPickerRow .card-list-item').nth(0).click();
        await t.page.waitForTimeout(250);
        const secondo = await t.evaluate(() => ({ aperto: document.getElementById('cardListPickerModal').classList.contains('open'), cim: gameState.playerGraveyard.map((c) => c.uid) }));
        t.assert(secondo.aperto && secondo.cim.length === 1 && secondo.cim[0] === 'M-0', `Dopo il primo scarto se ne chiede un secondo (${JSON.stringify(secondo)})`);
        await t.page.locator('#cardListPickerRow .card-list-item').nth(0).click();
        await t.page.waitForTimeout(250);
        const esito = await t.evaluate(() => ({ cim: gameState.playerGraveyard.map((c) => c.uid), mano: gameState.playerHand.map((c) => c.uid) }));
        t.assert(esito.cim.length === 2 && esito.cim.includes('M-0') && esito.cim.includes('M-1'),
            `Gli scarti sono le due carte scelte (M-0, M-1), non le ultime pescate (${JSON.stringify(esito)})`);
        t.assert(esito.mano.length === 3, `Restano 3 carte in mano (${JSON.stringify(esito.mano)})`);
    }
};
