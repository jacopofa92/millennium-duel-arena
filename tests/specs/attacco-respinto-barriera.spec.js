// Un attacco che si infrange su un mostro che regge (js/ui/fx-webgl-scena.js, T.SHIELD): una barriera esagonale in
// WebGL attorno al bersaglio. Lo spec controlla che lo shader compili, che la luce parta e che a fine effetto il motore
// torni a riposo, e che la carta non resti spostata.
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'Attacco respinto: barriera esagonale WebGL, luce che parte e poi torna a riposo',
    async run({ page, assert }) {
        await openDuel(page);
        await page.waitForFunction(() => !!window.FxWebglScena && !!window.FX && !!window.FxWebgl);
        await page.evaluate(() => {
            window.FX_BACKEND = 'webgl';
            const mk = (uid) => ({ ...cardDatabase.find((c) => c.id === 4), uid });
            gameState.botMonsterField = [null, null, { card: mk('b-1'), position: 'defense', isFaceDown: false }, null, null];
            gameState.playerMonsterField = [null, null, { card: mk('p-1'), position: 'attack', isFaceDown: false }, null, null];
            renderFields();
        });
        await page.waitForTimeout(400);
        const r = await page.evaluate(async () => {
            const bers = document.querySelector('#botFieldBoard .field-slot[data-owner="bot"][data-type="monster"][data-index="2"] .card');
            const att = document.querySelector('#playerFieldBoard .field-slot[data-owner="player"][data-type="monster"][data-index="2"] .card');
            FX.playAttackBlocked(att, bers);
            await new Promise((s) => setTimeout(s, 250));
            const durante = FxWebgl.attivi();
            await new Promise((s) => setTimeout(s, 1500));
            return { durante, dopo: FxWebgl.attivi(), nascosta: bers.style.visibility === 'hidden' };
        });
        assert(r.durante > 0, `La barriera e' in corso: ${JSON.stringify(r)}`);
        assert(r.dopo === 0 && !r.nascosta, `A fine effetto il motore torna a riposo e la carta e' intatta: ${JSON.stringify(r)}`);
    }
};
