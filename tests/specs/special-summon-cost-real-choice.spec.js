// Corregge un bug reale, correlato ma diverso da quello di
// deck-search-real-choice.spec.js: diverse carte con un costo di Special
// Summon dalla mano "banisci N mostri di un requisito dal Cimitero" o
// "tributa N mostri dal Terreno" (Inferno id 677, Fenrir id 698,
// Stregone del Caos id 740 — 1 LUCE + 1 OSCURITÀ, Gigantes id 757,
// Silpheed id 779, Necropaura Oscura id 891, Anima di Purezza e Luce id
// 1093, Spirito delle Fiamme/Roccia/Acqua/Vento id 1094/1101/1103/1104,
// Drago Toon Occhi Blu id 123, Manga Ryu-Ran id 606) sceglievano da sole
// le prime N carte trovate invece di offrire una vera scelta quando ne
// esistevano di più.
//
// A differenza del Deck/Cimitero "reattivo" (dove aprire un picker DOPO
// il fatto è sicuro), qui il valore di ritorno di paySpecialSummonCost
// GATE sincronamente se DuelEngine.trySpecialSummonFromHand (duel-engine.js)
// procede con la vera Special Summon: un picker asincrono dentro
// paySpecialSummonCost stessa tornerebbe true PRIMA che la scelta sia
// fatta. La scelta va quindi fatta PRIMA, nel click handler
// (offerSpecialSummonBanishChoice/offerSpecialSummonTributeChoice,
// actions.js — funzioni globali, actions.js non usa il pattern IIFE),
// che deposita gli uid scelti in gameState.pendingSpecialSummonBanishUids/
// Uids, letti e consumati da resolveSpecialSummonBanishCost/
// resolveSpecialSummonTributeCost (card-effects.js) — la carta resta
// quindi sincrona come ogni altra. Testato qui chiamando quelle 2
// funzioni globali direttamente (bypassando il popover "Special Summon"
// stesso, non toccato da questa correzione), ma interagendo con il VERO
// modale #cardListPickerModal per ogni passo della scelta in sequenza.
module.exports = {
    name: 'Special Summon dalla mano: vera scelta per costi banisci/tributa N carte (Inferno/Fenrir/Stregone del Caos/Drago Toon Occhi Blu)',
    async run(t) {
        // Inferno (677): richiede 1 solo mostro FUOCO, ma il Cimitero ne
        // ha 2 diversi -> deve aprirsi una vera scelta, non il primo trovato.
        // Fra una scena e l'altra il blocco cala per un attimo: si controlla due volte a distanza, altrimenti il comando finale cadrebbe nel vuoto.
        const sbloccato = () => t.page.waitForFunction(() => !EventiDuello.chiedi('azioni-bloccate-da-animazione', false), null, { timeout: 30000 });
        const libera = async () => { await sbloccato(); await t.page.waitForTimeout(700); await sbloccato(); };
        const infernoOpen = await t.evaluate(() => {
            const filler = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            const inferno = { ...cardDatabase.find((c) => c.id === 677), uid: 'inferno-1' };
            gameState.playerHand = [inferno];
            gameState.playerGraveyard = [
                { ...filler, uid: 'fire-a', attribute: 'FUOCO' },
                { ...filler, uid: 'fire-b', attribute: 'FUOCO' }
            ];
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.playerBanished = [];
            const def = DuelEngine.getDefinition(677);
            const opened = offerSpecialSummonBanishChoice(inferno, 0, def.getSpecialSummonBanishFilters());
            return { opened: opened, modalOpen: document.getElementById('cardListPickerModal').classList.contains('open') };
        });
        t.assert(infernoOpen.opened && infernoOpen.modalOpen, 'Inferno con 2 candidati FUOCO nel Cimitero deve aprire un vero picker');
        let count = await t.page.locator('#cardListPickerRow .card-list-item').count();
        t.assert(count === 2, `Il picker di Inferno deve mostrare 2 candidati (rilevati ${count})`);
        await t.page.locator('#cardListPickerRow .card-list-item').nth(1).click();
        await t.page.waitForTimeout(150);
        const afterInferno = await t.evaluate(() => ({
            banishedUids: gameState.playerBanished.map((c) => c.uid),
            onField: gameState.playerMonsterField.some((s) => s && s.card.uid === 'inferno-1'),
            handEmpty: gameState.playerHand.length === 0
        }));
        t.assert(afterInferno.banishedUids.includes('fire-b'), `Deve bandire ESATTAMENTE la carta scelta (fire-b), rilevato ${JSON.stringify(afterInferno.banishedUids)}`);
        t.assert(afterInferno.onField, 'Inferno deve essere Special Summonata dopo la scelta');
        t.assert(afterInferno.handEmpty, 'Inferno deve lasciare la mano');

        // Fenrir (698): richiede 2 mostri ACQUA, il Cimitero ne ha 3 ->
        // 2 scelte vere in sequenza (il pool si restringe ad ogni passo).
        await libera();
        const fenrirOpen = await t.evaluate(() => {
            const filler = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            const fenrir = { ...cardDatabase.find((c) => c.id === 698), uid: 'fenrir-1' };
            gameState.playerHand = [fenrir];
            gameState.playerGraveyard = [
                { ...filler, uid: 'water-a', attribute: 'ACQUA' },
                { ...filler, uid: 'water-b', attribute: 'ACQUA' },
                { ...filler, uid: 'water-c', attribute: 'ACQUA' }
            ];
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.playerBanished = [];
            const def = DuelEngine.getDefinition(698);
            return { opened: offerSpecialSummonBanishChoice(fenrir, 0, def.getSpecialSummonBanishFilters()) };
        });
        t.assert(fenrirOpen.opened, 'Fenrir con 3 candidati ACQUA (2 richiesti) deve aprire una scelta');
        count = await t.page.locator('#cardListPickerRow .card-list-item').count();
        t.assert(count === 3, `Primo picker di Fenrir deve mostrare 3 candidati (rilevati ${count})`);
        await t.page.locator('#cardListPickerRow .card-list-item').nth(2).click();
        await t.page.waitForTimeout(150);
        count = await t.page.locator('#cardListPickerRow .card-list-item').count();
        t.assert(count === 2, `Secondo picker di Fenrir deve mostrare i 2 candidati rimasti (rilevati ${count})`);
        await t.page.locator('#cardListPickerRow .card-list-item').nth(0).click();
        // Si aspetta l'effetto della scelta, non un tempo fisso: il bando avviene dopo che la scena d'Evocazione ha fatto il suo.
        await t.page.waitForFunction(() => gameState.playerBanished.length >= 2, null, { timeout: 15000 }).catch(() => {});
        const afterFenrir = await t.evaluate(() => ({
            banishedUids: gameState.playerBanished.map((c) => c.uid).sort(),
            onField: gameState.playerMonsterField.some((s) => s && s.card.uid === 'fenrir-1')
        }));
        t.assert(JSON.stringify(afterFenrir.banishedUids) === JSON.stringify(['water-a', 'water-c']), `Deve bandire ESATTAMENTE le 2 carte scelte in sequenza, rilevato ${JSON.stringify(afterFenrir.banishedUids)}`);
        t.assert(afterFenrir.onField, 'Fenrir deve essere Special Summonato dopo le 2 scelte');

        // Stregone del Caos (740): 1 LUCE + 1 OSCURITÀ, requisiti DIVERSI
        // (non un conteggio omogeneo come Fenrir) -> ogni passo del
        // picker deve mostrare SOLO i candidati del proprio Attributo.
        await libera();
        const chaosOpen = await t.evaluate(() => {
            const filler = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            const chaos = { ...cardDatabase.find((c) => c.id === 740), uid: 'chaos-1' };
            gameState.playerHand = [chaos];
            gameState.playerGraveyard = [
                { ...filler, uid: 'light-a', attribute: 'LUCE' },
                { ...filler, uid: 'light-b', attribute: 'LUCE' },
                { ...filler, uid: 'dark-a', attribute: 'OSCURITÀ' },
                { ...filler, uid: 'dark-b', attribute: 'OSCURITÀ' }
            ];
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.playerBanished = [];
            const def = DuelEngine.getDefinition(740);
            return { opened: offerSpecialSummonBanishChoice(chaos, 0, def.getSpecialSummonBanishFilters()) };
        });
        t.assert(chaosOpen.opened, 'Stregone del Caos con 2 LUCE + 2 OSCURITÀ deve aprire una scelta');
        count = await t.page.locator('#cardListPickerRow .card-list-item').count();
        t.assert(count === 2, `Primo picker (LUCE) dello Stregone del Caos deve mostrare 2 candidati (rilevati ${count})`);
        await t.page.locator('#cardListPickerRow .card-list-item').nth(1).click();
        await t.page.waitForTimeout(150);
        count = await t.page.locator('#cardListPickerRow .card-list-item').count();
        t.assert(count === 2, `Secondo picker (OSCURITÀ) deve mostrare 2 candidati (rilevati ${count})`);
        await t.page.locator('#cardListPickerRow .card-list-item').nth(0).click();
        await t.page.waitForTimeout(150);
        const afterChaos = await t.evaluate(() => ({
            banishedUids: gameState.playerBanished.map((c) => c.uid).sort(),
            onField: gameState.playerMonsterField.some((s) => s && s.card.uid === 'chaos-1')
        }));
        t.assert(JSON.stringify(afterChaos.banishedUids) === JSON.stringify(['dark-a', 'light-b']), `Deve bandire esattamente le 2 carte scelte (una per Attributo richiesto), rilevato ${JSON.stringify(afterChaos.banishedUids)}`);
        t.assert(afterChaos.onField, 'Stregone del Caos deve essere Special Summonato dopo le 2 scelte');

        // Drago Toon Occhi Blu (123), deroga anime controllata: tributa
        // 1 mostro Toon. Tre Toon sul Terreno devono produrre una vera
        // scelta singola, senza coinvolgere mostri non Toon.
        await libera();
        const dragonOpen = await t.evaluate(() => {
            const filler = cardDatabase.find((c) => c.id === 481);
            const dragon = { ...cardDatabase.find((c) => c.id === 123), uid: 'dragon-1' };
            const toonWorld = { ...cardDatabase.find((c) => c.id === 487), uid: 'toonworld-1' };
            gameState.playerHand = [dragon];
            gameState.playerSTField = [{ card: toonWorld, isFaceDown: false }, null, null, null, null];
            gameState.playerMonsterField = [
                { card: { ...filler, uid: 'trib-a' }, position: 'attack', isFaceDown: false },
                { card: { ...filler, uid: 'trib-b' }, position: 'attack', isFaceDown: false },
                { card: { ...filler, uid: 'trib-c' }, position: 'attack', isFaceDown: false },
                null, null
            ];
            gameState.playerGraveyard = [];
            const def = DuelEngine.getDefinition(123);
            return { opened: offerSpecialSummonTributeChoice(dragon, 0, def.getSpecialSummonTributeFilters()) };
        });
        t.assert(dragonOpen.opened, 'Drago Toon Occhi Blu con 3 Toon sul Terreno deve aprire una scelta');
        count = await t.page.locator('#cardListPickerRow .card-list-item').count();
        t.assert(count === 3, `Primo picker del Drago Toon Occhi Blu deve mostrare 3 candidati (rilevati ${count})`);
        await t.page.locator('#cardListPickerRow .card-list-item').nth(2).click();
        await t.page.waitForTimeout(150);
        const afterDragon = await t.evaluate(() => ({
            graveUids: gameState.playerGraveyard.map((c) => c.uid).sort(),
            onField: gameState.playerMonsterField.some((s) => s && s.card.uid === 'dragon-1')
        }));
        t.assert(JSON.stringify(afterDragon.graveUids) === JSON.stringify(['trib-c']), `Deve tributare ESATTAMENTE il Toon scelto, rilevato ${JSON.stringify(afterDragon.graveUids)}`);
        t.assert(afterDragon.onField, 'Drago Toon Occhi Blu deve essere Special Summonato dopo la scelta');

        // Gigantes (757): un solo candidato TERRA disponibile -> nessuna
        // scelta reale, il fallback deterministico dentro
        // resolveSpecialSummonBanishCost deve continuare a funzionare da
        // solo (chiamata diretta a trySpecialSummonFromHand, come farebbe
        // il bot o un test che salta il click handler).
        const gigantesResult = await t.evaluate(() => {
            const filler = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            const gigantes = { ...cardDatabase.find((c) => c.id === 757), uid: 'gigantes-1' };
            gameState.playerHand = [gigantes];
            gameState.playerGraveyard = [{ ...filler, uid: 'earth-only', attribute: 'TERRA' }];
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.playerBanished = [];
            const summoned = DuelEngine.trySpecialSummonFromHand('player', 0);
            return { summoned: summoned, banished: gameState.playerBanished.some((c) => c.uid === 'earth-only') };
        });
        t.assert(gigantesResult.summoned && gigantesResult.banished, 'Gigantes con un solo candidato TERRA deve Special Summonarsi senza alcun picker (fallback deterministico invariato)');

        // Exxod (753): riusa il meccanismo PREESISTENTE (id 486,
        // getSpecialSummonSacrificeCandidates) invece dei nuovi hook —
        // verifica solo che ora restituisca ENTRAMBE le Sfingi in campo
        // (prima sceglieva sempre la prima trovata da sola).
        const exxodCandidates = await t.evaluate(() => {
            const filler = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            const exxod = { ...cardDatabase.find((c) => c.id === 753), uid: 'exxod-1' };
            const sfinge1 = { ...filler, uid: 'sfinge-1', name: 'Sfinge Guardiana' };
            const sfinge2 = { ...filler, uid: 'sfinge-2', name: 'Hieracosfinge' };
            gameState.playerMonsterField = [
                { card: sfinge1, position: 'attack', isFaceDown: false },
                { card: sfinge2, position: 'attack', isFaceDown: false },
                null, null, null
            ];
            const def = DuelEngine.getDefinition(753);
            const candidates = def.getSpecialSummonSacrificeCandidates(DuelEngine.makeContext('player', { card: exxod }));
            return { count: candidates.length };
        });
        t.assert(exxodCandidates.count === 2, `Exxod deve riconoscere ENTRAMBE le Sfingi come candidati validi per il tributo (rilevati ${exxodCandidates.count})`);
    }
};
