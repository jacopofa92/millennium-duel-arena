// Carte che bersagliano MAGIE/TRAPPOLE sul Terreno: la scelta è del
// giocatore.
// =====================================================================
// Esisteva un helper per far scegliere fra i MOSTRI sul Terreno
// (chooseFieldMonsterTarget, nato per Dispositivo di Evacuazione Forzata),
// ma niente per le carte il cui testo dice "1 Magia/Trappola sul Terreno"
// — quelle si prendevano la prima casella occupata che trovavano. E per
// "N carte sul Terreno" senza distinzione di zona non c'era proprio nulla.
//
// Ora c'è `collectFieldTargets`, che raccoglie i bersagli da una zona o
// da entrambe portandosi dietro la `zone` di ciascuno (serve a chi agisce
// dopo: distruggere un mostro e distruggere una Trappola passano da due
// funzioni diverse del motore).
//
// Il test sceglie sempre il SECONDO candidato: con un solo candidato una
// scelta vera e un auto-pick darebbero lo stesso risultato, e il test non
// proverebbe nulla.
module.exports = {
    name: 'Scelta del bersaglio fra Magie/Trappole sul Terreno (219 Tornado di Polvere, 647 Distruzione con Zampata)',
    async run(t) {
        // --- 219 Tornado di Polvere: 1 Magia/Trappola dell'avversario ---
        const setupTornado = await t.evaluate(() => {
            // Il vortice in DOM e' la versione "css" dell'effetto: col backend WebGL lo stesso
            // vortice e' disegnato su canvas e nel DOM non c'e' nulla da trovare.
            window.FX_BACKEND = 'css';
            const trappole = cardDatabase.filter((c) => c.type === 'trap').slice(0, 2);
            gameState.botSTField = [
                { card: { ...trappole[0], uid: 'SUA-1' }, isFaceDown: true, setOnTurn: 1 },
                { card: { ...trappole[1], uid: 'SUA-2' }, isFaceDown: true, setOnTurn: 1 },
                null, null, null
            ];
            gameState.playerSTField = [null, null, null, null, null];
            gameState.playerHand = [];
            gameState.playerGraveyard = [];
            gameState.botGraveyard = [];
            updateUI();
            const tornado = { ...cardDatabase.find((c) => c.id === 219), uid: 'tornado' };
            DuelEngine.getDefinition(219).activate(
                DuelEngine.makeContext('player', { card: tornado, zone: 'st', index: 0 })
            );
            return { modaleAperto: document.getElementById('cardListPickerModal').classList.contains('open') };
        });
        t.assert(setupTornado.modaleAperto,
            'Con 2 Magie/Trappole avversarie, Tornado di Polvere deve APRIRE un picker: prima distruggeva sempre la prima casella');

        const voci = await t.page.locator('#cardListPickerRow .card-list-item').count();
        t.assert(voci === 2, `Il picker deve mostrare entrambe le carte avversarie (rilevate ${voci})`);
        await t.page.locator('#cardListPickerRow .card-list-item').nth(1).click();
        const vorticeVisibile = await t.evaluate(() => !!document.querySelector('.fx-dust-tornado'));
        t.assert(vorticeVisibile, 'Tornado di Polvere deve creare il vortice dedicato sulla carta scelta');
        await t.page.waitForFunction(() => gameState.botGraveyard.some((c) => c.uid === 'SUA-2'), null, { timeout: 4000 });

        const dopoTornado = await t.evaluate(() => ({
            rimaste: gameState.botSTField.filter(Boolean).map((s) => s.card.uid),
            nelCimitero: gameState.botGraveyard.map((c) => c.uid)
        }));
        t.assert(dopoTornado.nelCimitero.includes('SUA-2'),
            `Deve essere distrutta ESATTAMENTE la carta scelta (SUA-2), non la prima (Cimitero: ${JSON.stringify(dopoTornado.nelCimitero)})`);
        t.assert(dopoTornado.rimaste.includes('SUA-1'),
            `L'altra carta deve restare sul Terreno (rimaste: ${JSON.stringify(dopoTornado.rimaste)})`);

        // --- 647 Distruzione con Zampata: 1 Magia/Trappola su ENTRAMBI i
        // lati, e il danno va a chi la controlla — quindi colpire una
        // propria carta è una decisione con conseguenze, non un dettaglio.
        const setupZampata = await t.evaluate(() => {
            const drago = cardDatabase.find((c) => c.type === 'monster' && c.race === 'Drago' && !c.extraDeck);
            const trappole = cardDatabase.filter((c) => c.type === 'trap').slice(0, 2);
            gameState.playerMonsterField = [
                { card: { ...drago, uid: 'DRAGO' }, position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: false },
                null, null, null, null
            ];
            gameState.playerSTField = [{ card: { ...trappole[0], uid: 'MIA' }, isFaceDown: false }, null, null, null, null];
            gameState.botSTField = [{ card: { ...trappole[1], uid: 'SUA' }, isFaceDown: false }, null, null, null, null];
            gameState.playerLP = 8000;
            gameState.botLP = 8000;
            gameState.playerGraveyard = [];
            gameState.botGraveyard = [];
            updateUI();
            const zampata = { ...cardDatabase.find((c) => c.id === 647), uid: 'zampata' };
            DuelEngine.getDefinition(647).activate(
                DuelEngine.makeContext('player', { card: zampata, zone: 'st', index: 1 })
            );
            return {
                modaleAperto: document.getElementById('cardListPickerModal').classList.contains('open'),
                candidati: document.querySelectorAll('#cardListPickerRow .card-list-item').length
            };
        });
        t.assert(setupZampata.modaleAperto && setupZampata.candidati === 2,
            `Distruzione con Zampata deve far scegliere fra le Magie/Trappole di ENTRAMBI i lati ` +
            `(modale: ${setupZampata.modaleAperto}, candidati: ${setupZampata.candidati})`);

        // Si sceglie la PROPRIA: è il caso che prova davvero la scelta,
        // perché l'automatismo di prima preferiva sempre l'avversario.
        const indiceMia = await t.evaluate(() => {
            const voci = [...document.querySelectorAll('#cardListPickerRow .card-list-item')];
            return voci.findIndex((v) => v.querySelector('.card[data-uid="MIA"]'));
        });
        t.assert(indiceMia !== -1, 'Fra i candidati deve esserci anche la propria Magia/Trappola');
        await t.page.locator('#cardListPickerRow .card-list-item').nth(indiceMia).click();
        await t.page.waitForTimeout(250);

        const dopoZampata = await t.evaluate(() => ({
            mieLP: gameState.playerLP,
            sueLP: gameState.botLP,
            mioCimitero: gameState.playerGraveyard.map((c) => c.uid),
            suoTerreno: gameState.botSTField.filter(Boolean).map((s) => s.card.uid)
        }));
        t.assert(dopoZampata.mioCimitero.includes('MIA'),
            `Deve essere distrutta la carta scelta, anche se è la propria (mio Cimitero: ${JSON.stringify(dopoZampata.mioCimitero)})`);
        t.assert(dopoZampata.mieLP === 7500 && dopoZampata.sueLP === 8000,
            `I 500 danni vanno a chi CONTROLLA la carta distrutta, cioè a me in questo caso ` +
            `(miei LP: ${dopoZampata.mieLP}, suoi: ${dopoZampata.sueLP})`);
        t.assert(dopoZampata.suoTerreno.includes('SUA'),
            'La Magia/Trappola dell\'avversario non scelta deve restare intatta');
    }
};
