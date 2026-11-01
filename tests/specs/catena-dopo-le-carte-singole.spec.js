// La Catena (pannello o scena) compare SOLO a Catena decisa, dopo l'animazione di ogni carta singola:
//  - ogni carta, anche la RISPOSTA, ha la sua carta a centro schermo nel momento in cui viene attivata (una volta sola);
//  - finche' qualcuno puo' ancora rispondere (chain.resolving spento) il pannello della Catena resta spento;
//  - il pannello compare alla risoluzione, quando le animazioni singole sono gia' tutte partite.
// Segnalato giocando: rispondendo a una carta avversaria si vedevano insieme la Catena e la carta singola.
module.exports = {
    name: 'Catena: compare dopo le animazioni delle carte singole, mai insieme',
    async run(t) {
        const r = await t.evaluate(() => new Promise((resolve) => {
            window.__testLog = [];
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            CardEffects.register(90001, { canActivate() { return true; }, activate() {} });
            CardEffects.register(90002, { canActivate() { return true; }, activate() {} });
            gameState.currentPlayer = 'player';
            gameState.turn = 5;
            gameState.playerHand = [{ id: 90001, uid: 'spell-fake', name: 'Fake Spell', type: 'spell', subtype: 'normal' }];
            gameState.playerGraveyard = [];
            gameState.botSTField = Array(5).fill(null);
            gameState.botSTField[0] = { card: { id: 90002, uid: 'trap-fake', name: 'Fake Trap', type: 'trap' }, isFaceDown: true, setOnTurn: gameState.turn - 1 };
            gameState.botGraveyard = [];
            const t0 = Date.now();
            const pulse = [];
            const origine = FX.playCardActivateCenterScreen;
            FX.playCardActivateCenterScreen = function (card) { pulse.push({ nome: card && card.name, t: Date.now() - t0 }); return origine.apply(this, arguments); };
            const pannello = [];
            const campione = setInterval(() => {
                const el = document.getElementById('chainStack');
                const ch = gameState.chain;
                pannello.push({ t: Date.now() - t0, visibile: !!(el && el.classList.contains('show')), risolvendo: !!(ch && ch.resolving) });
            }, 50);
            DuelEngine.activateCard('player', 'hand', 0);
            const fine = () => {
                if (DuelEngine.isChainActive() && Date.now() - t0 < 20000) return setTimeout(fine, 100);
                clearInterval(campione);
                FX.playCardActivateCenterScreen = origine;
                resolve({ pulse, pannello });
            };
            setTimeout(fine, 200);
        }));
        const nomi = r.pulse.map((p) => p.nome);
        t.assert(nomi.filter((n) => n === 'Fake Spell').length === 1, `La Magia ha la sua carta singola una volta sola: ${JSON.stringify(r.pulse)}`);
        t.assert(nomi.filter((n) => n === 'Fake Trap').length === 1, `La risposta ha la sua carta singola una volta sola: ${JSON.stringify(r.pulse)}`);
        t.assert(nomi.indexOf('Fake Spell') < nomi.indexOf('Fake Trap'), `Prima la carta attivata, poi la risposta: ${JSON.stringify(r.pulse)}`);
        const abusi = r.pannello.filter((c) => c.visibile && !c.risolvendo);
        t.assert(abusi.length === 0, `Il pannello della Catena non compare mentre la Catena si costruisce: ${JSON.stringify(abusi.slice(0, 3))}`);
        const primoPannello = r.pannello.find((c) => c.visibile);
        const ultimoPulse = Math.max(...r.pulse.map((p) => p.t));
        t.assert(primoPannello && primoPannello.t >= ultimoPulse, `Il pannello compare dopo l'ultima animazione singola: pannello ${primoPannello && primoPannello.t}, pulse ${ultimoPulse}`);
    }
};
