// La distruzione di un mostro è una DISINTEGRAZIONE (js/ui/fx-webgl-scena.js, T.DUST): l'originale si
// nasconde subito e al suo posto resta una copia fuori dal campo con una maschera che sale; a fine effetto
// la copia sparisce da sola e il motore WebGL torna a riposo. La copia sta in un contenitore NON ruotato
// (anche per un mostro in Difesa) grande quanto l'ingombro della carta.
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'Distruzione di un mostro: disintegrazione WebGL con copia mascherata, pulita a fine effetto',
    async run({ page, assert }) {
        await openDuel(page);
        await page.waitForFunction(() => !!window.FxWebglScena && !!window.FX && !!window.FxWebgl);
        await page.evaluate(() => {
            window.FX_BACKEND = 'webgl';
            const mk = (uid) => ({ ...cardDatabase.find((c) => c.id === 4), uid });
            gameState.botMonsterField = [null, null, { card: mk('d-att'), position: 'attack', isFaceDown: false }, { card: mk('d-dif'), position: 'defense', isFaceDown: false }, null];
            renderFields();
        });
        await page.waitForTimeout(400);

        for (const [indice, nome] of [[2, 'Attacco'], [3, 'Difesa']]) {
            const r = await page.evaluate(async (i) => {
                const el = document.querySelector(`#botFieldBoard .field-slot[data-owner="bot"][data-type="monster"][data-index="${i}"] .card`);
                const rect = el.getBoundingClientRect();
                FX.playBattleDestroyEffect(el);
                await new Promise((s) => setTimeout(s, 150));
                const involucri = [...document.querySelectorAll('body > div')].filter((d) => d.style.maskImage || d.style.webkitMaskImage);
                const inv = involucri[0];
                const ir = inv ? inv.getBoundingClientRect() : null;
                const durante = {
                    nascosto: el.style.visibility === 'hidden',
                    involucri: involucri.length,
                    copia: !!(inv && inv.querySelector('.card')),
                    stessoIngombro: !!ir && Math.abs(ir.width - rect.width) < 1.5 && Math.abs(ir.height - rect.height) < 1.5,
                    attivi: FxWebgl.attivi()
                };
                await new Promise((s) => setTimeout(s, 1400));
                const dopo = {
                    involucri: [...document.querySelectorAll('body > div')].filter((d) => d.style.maskImage || d.style.webkitMaskImage).length,
                    attivi: FxWebgl.attivi()
                };
                return { durante, dopo };
            }, indice);
            assert(r.durante.nascosto, `${nome}: la carta originale si nasconde subito`);
            assert(r.durante.involucri === 1 && r.durante.copia, `${nome}: una copia mascherata prende il suo posto: ${JSON.stringify(r.durante)}`);
            assert(r.durante.stessoIngombro, `${nome}: il contenitore ha l'ingombro della carta (anche ruotata): ${JSON.stringify(r.durante)}`);
            assert(r.durante.attivi > 0, `${nome}: la luce WebGL è in corso: ${JSON.stringify(r.durante)}`);
            assert(r.dopo.involucri === 0 && r.dopo.attivi === 0, `${nome}: a fine effetto la copia sparisce e il motore torna a riposo: ${JSON.stringify(r.dopo)}`);
        }
    }
};
