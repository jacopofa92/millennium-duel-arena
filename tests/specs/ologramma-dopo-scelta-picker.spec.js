// Una carta arrivata in campo passando da un picker deve avere il suo
// ologramma.
// =====================================================================
// Bug reale segnalato dall'utente: "Richiamo della Mummia, evocando
// Genesi del Vampiro, non compare poi l'ologramma".
//
// La causa non era la cinematica di Evocazione (Genesi è Livello 8,
// quindi l'Evocazione è quella lunga — è lì che veniva naturale
// guardare) ma l'incontro fra due meccanismi indipendenti:
//   - `openCardListPicker` (actions.js) costruisce CARTE VERE per
//     mostrarle nella lista, e quando il modale si chiude quegli
//     elementi restano nel documento, nascosti — quindi con un
//     rettangolo 0x0 e lo stesso `data-uid` della carta vera;
//   - `MonsterHolograms.sync()` cercava la carta con un
//     `document.querySelector` sull'INTERO documento, che restituisce
//     il primo elemento in ordine di documento: quello del picker.
//     Misurandolo otteneva 0x0 e rinunciava, quindi l'ologramma non
//     nasceva mai.
//
// Chiuso con `findFieldCardElementByUid` (game-flow.js), che cerca nei
// soli due tabelloni, dove un uid è unico. Lo stesso helper è usato
// anche da `renderEquipLinks`, che aveva identico difetto.
//
// Questo spec sorveglia la trappola, non solo il sintomo: verifica
// ESPLICITAMENTE che la copia del picker sia ancora nel documento (se un
// domani venisse ripulita alla chiusura del modale, il test smetterebbe
// di provare quello che dice di provare, e va saputo).
module.exports = {
    name: "Ologramma presente anche per una carta scelta da un picker (Richiamo della Mummia 670 -> Genesi del Vampiro 656)",
    async run(t) {
        await t.evaluate(() => {
            // L'impostazione dedicata è accesa di default, ma un test non
            // deve dipendere da com'è rimasto il localStorage.
            if (window.HologramSetting) HologramSetting.set(true);

            const mummia = { ...cardDatabase.find((c) => c.id === 670), uid: 'MUMMIA' };
            const genesi = { ...cardDatabase.find((c) => c.id === 656), uid: 'GENESI' };
            const altro = {
                ...cardDatabase.filter((c) => c.type === 'monster' && c.race === 'Zombie' && !c.extraDeck && c.id !== 656)[0],
                uid: 'ALTRO-ZOMBIE'
            };
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.playerHand = [altro, genesi];
            gameState.usedOncePerTurnEffect = {};
            mummia._mummyCallOnField = true; // già scoperta in campo
            gameState.playerSTField[0] = { card: mummia, isFaceDown: false, setOnTurn: 0 };
            updateUI();
            const ctx = DuelEngine.makeContext('player', { card: mummia, zone: 'st', index: 0 });
            DuelEngine.getDefinition(670).activate(ctx);
        });
        await t.page.waitForTimeout(250);

        const voci = await t.page.locator('#cardListPickerRow .card-list-item').count();
        t.assert(voci === 2, `Preparazione: il picker deve mostrare i 2 Zombie in mano (rilevati ${voci})`);
        // Il SECONDO è Genesi del Vampiro: sceglierlo distingue una
        // scelta vera da un auto-pick del primo.
        await t.page.locator('#cardListPickerRow .card-list-item').nth(1).click();
        // Genesi e' di Livello 8: la sua proiezione compare solo a fine cinematica di Evocazione (filmato o convergenza,
        // poi la carta si solleva e cade), non subito dopo la scelta. Si aspetta la comparsa vera; se non arriva,
        // l'asserzione sotto lo dice.
        await t.page.waitForFunction(() => !!document.querySelector('#monsterHologramLayer .mh-item[data-uid="GENESI"]'), null, { timeout: 30000 }).catch(() => {});
        await t.page.waitForTimeout(200);

        const esito = await t.evaluate(() => ({
            inCampo: (gameState.playerMonsterField || []).some((s) => s && s.card && s.card.uid === 'GENESI'),
            // Quanti elementi con quell'uid esistono in tutto il
            // documento, e quanti di essi hanno una dimensione reale.
            copieNelDocumento: document.querySelectorAll('.card[data-uid="GENESI"]').length,
            copieLargheZero: [...document.querySelectorAll('.card[data-uid="GENESI"]')]
                .filter((el) => el.getBoundingClientRect().width === 0).length,
            ologrammi: [...document.querySelectorAll('#monsterHologramLayer .mh-item')].map((el) => el.dataset.uid),
            ologrammaLargo: (() => {
                const el = document.querySelector('#monsterHologramLayer .mh-item[data-uid="GENESI"]');
                return el ? Math.round(el.getBoundingClientRect().width) : 0;
            })()
        }));

        t.assert(esito.inCampo, 'Preparazione: Genesi del Vampiro deve essere arrivata sul Terreno');
        t.assert(esito.copieNelDocumento >= 2 && esito.copieLargheZero >= 1,
            `Questo test ha senso solo se il picker lascia davvero una copia larga zero nel documento ` +
            `(copie trovate: ${esito.copieNelDocumento}, di cui larghe zero: ${esito.copieLargheZero}). ` +
            `Se il picker è stato ripulito alla chiusura, questo spec va riscritto: non sta più provando nulla.`);
        t.assert(esito.ologrammi.includes('GENESI'),
            `La carta scelta dal picker deve avere il suo ologramma (ologrammi presenti: ${JSON.stringify(esito.ologrammi)}) — ` +
            `prima sync() misurava la copia del picker, larga zero, e non lo creava affatto`);
        t.assert(esito.ologrammaLargo > 0,
            `L'ologramma deve avere una dimensione reale, non essere piazzato su un rettangolo nullo (larghezza ${esito.ologrammaLargo}px)`);
    }
};
