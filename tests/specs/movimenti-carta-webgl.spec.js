// Gli spostamenti di carta in WebGL (js/ui/fx-webgl-scena.js): al Cimitero, dal Cimitero, cambio di controllo, Tributo,
// aggancio di una Equip. Per ognuno: lo shader compila, la luce parte (FxWebgl.attivi() > 0), a fine effetto il motore
// torna a riposo, non resta alcuna carta fantasma e nessun errore di pagina.
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'Movimenti di carta WebGL: Cimitero, rianimazione, controllo, Tributo, Equip',
    async run({ page, assert }) {
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        await openDuel(page);
        await page.waitForFunction(() => !!window.FxWebglScena && !!window.FX && !!window.FxWebgl);
        await page.evaluate(() => {
            window.FX_BACKEND = 'webgl';
            const mk = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
            gameState.playerMonsterField = [null, { card: mk(1, 'm1'), position: 'attack', isFaceDown: false }, { card: mk(4, 'm2'), position: 'defense', isFaceDown: false }, null, null];
            gameState.botMonsterField = [null, { card: mk(7, 'n1'), position: 'attack', isFaceDown: false }, null, null, null];
            renderFields();
        });
        await page.waitForTimeout(500);

        const casi = {
            'Cimitero': () => FX.playCardToGraveyard(gameState.playerMonsterField[1].card, 'player', 1, 'player'),
            'Cimitero (Difesa)': () => FX.playCardToGraveyard(gameState.playerMonsterField[2].card, 'player', 2, 'player'),
            'Rianimazione': () => FX.playCardFromGraveyard(cardDatabase.find((c) => c.id === 4), 'player', 'player', 3),
            'Controllo': () => FX.playControlSwitch(gameState.botMonsterField[1].card, 'bot', 1, 'player', 3),
            'Controllo (ritorno)': () => FX.playControlSwitch(gameState.botMonsterField[1].card, 'bot', 1, 'player', 3, true),
            'Tributo': () => FX.playTributeSacrifice(document.querySelector('#playerFieldBoard .field-slot[data-type="monster"][data-index="1"] .card')),
            'Equip': () => {
                const el = document.querySelector('#playerFieldBoard .field-slot[data-type="monster"][data-index="1"] .card');
                FX.playEquipAttach(100, 400, 300, 300, el);
            }
        };
        // Le funzioni stanno nel contesto della pagina: si costruiscono li' dal loro testo.
        const esiti = await page.evaluate(async (testi) => {
            const out = {};
            for (const [nome, src] of Object.entries(testi)) {
                // eslint-disable-next-line no-new-func
                const fn = new Function('return (' + src + ')')();
                fn();
                await new Promise((s) => setTimeout(s, 250));
                const durante = FxWebgl.attivi();
                await new Promise((s) => setTimeout(s, 1600));
                out[nome] = { durante, dopo: FxWebgl.attivi(), fantasmi: document.querySelectorAll('body > .card').length };
            }
            return out;
        }, Object.fromEntries(Object.entries(casi).map(([k, f]) => [k, f.toString()])));
        for (const [nome, e] of Object.entries(esiti)) {
            assert(e.durante > 0, `${nome}: la luce parte: ${JSON.stringify(e)}`);
            assert(e.dopo === 0 && e.fantasmi === 0, `${nome}: a fine effetto tutto torna a riposo: ${JSON.stringify(e)}`);
        }
        assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
    }
};
