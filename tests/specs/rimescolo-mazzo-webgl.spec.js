// Il rimescolamento del Mazzo in WebGL (FX.playDeckShuffle in js/ui/fx-webgl-scena.js, evento 'mazzo-rimescolato').
//
// Quando un effetto rimescola il Deck (ACTIONS.shuffleIntoDeck, e le carte che rimescolano "a mano"), la pila si apre in sei
// dorsi che si intrecciano, con un anello freddo sul bordo. Si controlla che: i sei dorsi compaiano dopo l'attesa di 500 ms,
// la luce si spenga da sola, i dorsi spariscano, e non ci siano errori. La PESCATA non ha questo effetto: l'unica versione
// con una scia luminosa e' stata provata sul telefono e tolta (il lampo restava sopra il dorso arrivato in mano).
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'Rimescolo del Mazzo WebGL: i dorsi si aprono e si intrecciano, poi tutto torna a riposo',
    async run({ page, assert }) {
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error' && /shader|webgl|glsl/i.test(m.text())) errori.push('console: ' + m.text()); });
        await openDuel(page);
        await page.waitForFunction(() => !!window.FxWebglScena && !!window.FX && !!window.FxWebgl);
        await page.evaluate(() => { window.FX_BACKEND = 'webgl'; });
        await page.waitForTimeout(500);
        const mescolata = await page.evaluate(async () => {
            if (!Array.isArray(gameState.playerDeck)) gameState.playerDeck = [];
            const carta = gameState.playerHand.pop();
            const ok = DuelEngine.makeContext('player', {}).shuffleIntoDeck('player', [carta]);
            await new Promise((s) => setTimeout(s, 900)); // 500 ms di attesa + l'apertura dei dorsi
            const durante = document.querySelectorAll('.fx-gsap-draw-card').length;
            await new Promise((s) => setTimeout(s, 1800));
            return { ok, durante, restanti: document.querySelectorAll('.fx-gsap-draw-card').length, fine: FxWebgl.attivi() };
        });
        assert(mescolata.ok, `shuffleIntoDeck e' andato a buon fine: ${JSON.stringify(mescolata)}`);
        assert(mescolata.durante === 6, `La pila si apre in sei dorsi: ${JSON.stringify(mescolata)}`);
        assert(mescolata.restanti === 0 && mescolata.fine === 0, `Finito il rimescolo tutto torna a riposo: ${JSON.stringify(mescolata)}`);
        assert(errori.length === 0, `Errori: ${errori.join(' | ')}`);
    }
};
