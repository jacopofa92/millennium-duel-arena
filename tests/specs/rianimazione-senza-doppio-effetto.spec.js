// Le carte che hanno una cinematica propria per la rianimazione (Mostro Resuscitato id 35) non devono far partire anche il
// volo generico Cimitero -> campo (FX.playCardFromGraveyard): sarebbero due animazioni sovrapposte. Una rianimazione
// qualunque (nessuna cinematica propria) lo deve invece far partire una volta.
const { openDuel, freezeNaturalGameLoop } = require('../helpers/harness');

module.exports = {
    name: 'Rianimazione: Mostro Resuscitato non fa il volo generico dal Cimitero, una Special Summon qualunque si',
    async run({ page, assert }) {
        await openDuel(page);
        if (typeof freezeNaturalGameLoop === 'function') await freezeNaturalGameLoop(page);
        await page.waitForFunction(() => !!window.FX && !!window.DuelEngine);
        const r = await page.evaluate(async () => {
            let voli = 0;
            const originale = FX.playCardFromGraveyard;
            FX.playCardFromGraveyard = function () { voli++; return originale.apply(this, arguments); };
            const mk = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
            // 1) Mostro Resuscitato, giocato dal bot (sceglie da solo).
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.botGraveyard = [mk(4, 'g1')];
            gameState.playerGraveyard = [];
            const ctx = DuelEngine.makeContext('bot', { card: mk(35, 'rinascita') });
            DuelEngine.getDefinition(35).activate(ctx);
            for (let i = 0; i < 80 && !gameState.botMonsterField.some((s) => s); i++) await new Promise((s) => setTimeout(s, 100));
            const rinascita = { voli, inCampo: gameState.botMonsterField.some((s) => s && s.card.uid === 'g1') };
            // 2) Una rianimazione qualunque: il volo c'e', una volta.
            voli = 0;
            gameState.botGraveyard = [mk(7, 'g2')];
            const card = gameState.botGraveyard.pop();
            DuelEngine.makeContext('bot', {}).specialSummon('bot', card, 3, 'attack', 'graveyard');
            const generica = { voli };
            FX.playCardFromGraveyard = originale;
            return { rinascita, generica };
        });
        assert(r.rinascita.inCampo && r.rinascita.voli === 0, `Mostro Resuscitato: il mostro torna e non c'e' il volo generico: ${JSON.stringify(r.rinascita)}`);
        assert(r.generica.voli === 1, `Una Special Summon dal Cimitero qualunque fa il volo, una volta: ${JSON.stringify(r.generica)}`);
    }
};
