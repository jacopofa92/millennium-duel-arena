// Forza Riflessa (id 382): con l'animazione i mostri in Attacco dell'avversario spariscono all'URTO del colpo riflesso
// (~1,12 s), non all'inizio della scena (segnalato giocando: si vedevano le carte morire mentre l'effetto era appena partito).
// La battaglia aspetta (attendiScelta); senza animazione (nessun WebGL) si distrugge subito, come sempre.
module.exports = {
    name: 'Forza Riflessa: i mostri vengono distrutti quando il colpo riflesso li raggiunge, non all\'inizio',
    async run(t) {
        const r = await t.evaluate(() => new Promise((resolve) => {
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            const mostro = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
            const prepara = () => {
                gameState.botMonsterField = [0, 1, 2, 3, 4].map((i) => (i < 2 ? { card: mostro(1, 'bb' + i), position: 'attack', isFaceDown: false } : null));
                gameState.botGraveyard = [];
            };
            const def = DuelEngine.getDefinition(382);
            const lancia = (animata) => {
                const originale = FX.playMirrorForce;
                FX.playMirrorForce = () => (animata ? 1950 : 0);
                prepara();
                const ctx = DuelEngine.makeContext('player', { card: mostro(382, 'forza'), attackerAtk: 3000 });
                let attesa = 0; let rilasciata = 0;
                ctx.waitForChoice = () => { attesa++; return () => { rilasciata++; }; };
                def.onAttackDeclare(ctx);
                const subito = gameState.botMonsterField.filter(Boolean).length;
                FX.playMirrorForce = originale;
                return { subito, attesa, ctx, rilasciata: () => rilasciata, vivi: () => gameState.botMonsterField.filter(Boolean).length };
            };
            // 1) senza animazione: distrutti subito, nessuna attesa
            const senza = lancia(false);
            const senzaRis = { subito: senza.subito, attesa: senza.attesa };
            // 2) con animazione: ancora vivi a 300 ms, distrutti a 1500 ms, e la battaglia viene rilasciata
            const con = lancia(true);
            const conSubito = { subito: con.subito, attesa: con.attesa, rilasciataSubito: con.rilasciata() };
            setTimeout(() => {
                const aMeta = con.vivi();
                setTimeout(() => resolve({ senzaRis, conSubito, aMeta, dopo: con.vivi(), rilasciata: con.rilasciata(), cimitero: gameState.botGraveyard.length }), 1200);
            }, 300);
        }));
        t.assert(r.senzaRis.subito === 0 && r.senzaRis.attesa === 0, `Senza animazione i mostri spariscono subito e nessuno aspetta: ${JSON.stringify(r.senzaRis)}`);
        t.assert(r.conSubito.subito === 2 && r.conSubito.attesa === 1 && r.conSubito.rilasciataSubito === 0, `Con l'animazione, subito dopo l'attivazione i mostri ci sono ancora e la battaglia aspetta: ${JSON.stringify(r.conSubito)}`);
        t.assert(r.aMeta === 2, `A 300 ms (il colpo e' ancora in volo) i mostri ci sono ancora: ${r.aMeta}`);
        t.assert(r.dopo === 0 && r.rilasciata === 1 && r.cimitero >= 2, `All'urto vengono distrutti e la battaglia riparte: ${JSON.stringify({ dopo: r.dopo, rilasciata: r.rilasciata, cimitero: r.cimitero })}`);
    }
};
