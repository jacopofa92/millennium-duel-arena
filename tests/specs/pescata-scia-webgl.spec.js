// La scia della pescata in WebGL (T.COMETA in js/ui/fx-webgl-scena.js, usata da imp.playDrawEffect).
//
// Il dorso che vola dal mazzo alla mano ha ora dietro una cometa sottile in LINEA RETTA (niente particelle: le ha scartate
// l'utente). Si controlla che: lo shader compili e parta (FxWebgl.attivi() > 0), la luce si spenga da sola (attivi() torna a
// 0), il volante e il bagliore del mazzo spariscano, e non ci siano errori di pagina.
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'Pescata WebGL: scia in linea retta dal mazzo alla mano, poi tutto torna a riposo',
    async run({ page, assert }) {
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error' && /shader|webgl|glsl/i.test(m.text())) errori.push('console: ' + m.text()); });
        await openDuel(page);
        await page.waitForFunction(() => !!window.FxWebglScena && !!window.FX && !!window.FxWebgl);
        await page.evaluate(() => { window.FX_BACKEND = 'webgl'; });
        await page.waitForTimeout(500);
        const esito = await page.evaluate(async () => {
            const carta = document.querySelector('#playerHand .card');
            if (!carta) return { errore: 'nessuna carta in mano' };
            FX.playDrawEffect(carta);
            await new Promise((s) => setTimeout(s, 150));
            const durante = FxWebgl.attivi();
            const volanti = document.querySelectorAll('.fx-gsap-draw-card').length;
            await new Promise((s) => setTimeout(s, 1500));
            return { durante, volanti, dopo: FxWebgl.attivi(), restanti: document.querySelectorAll('.fx-gsap-draw-card').length, nome: Object.keys(FxWebglScena.T).includes('COMETA') };
        });
        assert(!esito.errore, esito.errore || '');
        assert(esito.nome, 'La primitiva COMETA esiste');
        assert(esito.durante > 0, `La scia parte: ${JSON.stringify(esito)}`);
        assert(esito.volanti >= 1, `Il dorso vola come prima: ${JSON.stringify(esito)}`);
        assert(esito.dopo === 0 && esito.restanti === 0, `A fine volo tutto torna a riposo: ${JSON.stringify(esito)}`);
        // RIMESCOLAMENTO: un effetto che rimescola il Deck (qui il vero ctx.shuffleIntoDeck) fa aprire e intrecciare la pila.
        const mescolata = await page.evaluate(async () => {
            if (!Array.isArray(gameState.playerDeck)) gameState.playerDeck = [];
            const carta = gameState.playerHand.pop();
            const ok = DuelEngine.makeContext('player', {}).shuffleIntoDeck('player', [carta]);
            await new Promise((s) => setTimeout(s, 900)); // 500 ms di attesa + l'apertura dei dorsi
            const durante = document.querySelectorAll('.fx-gsap-draw-card').length;
            const attivi = FxWebgl.attivi();
            await new Promise((s) => setTimeout(s, 1800));
            return { ok, durante, attivi, restanti: document.querySelectorAll('.fx-gsap-draw-card').length, fine: FxWebgl.attivi() };
        });
        assert(mescolata.ok, `shuffleIntoDeck e' andato a buon fine: ${JSON.stringify(mescolata)}`);
        assert(mescolata.durante === 6, `La pila si apre in sei dorsi: ${JSON.stringify(mescolata)}`);
        assert(mescolata.restanti === 0 && mescolata.fine === 0, `Finito il rimescolo tutto torna a riposo: ${JSON.stringify(mescolata)}`);
        assert(errori.length === 0, `Errori: ${errori.join(' | ')}`);
    }
};
