// Dietro la presentazione "VS / It's time to duel!" e dietro Vittoria, Sconfitta e Pareggio non girano piu' i raggi:
// c'e' lo sfondo WebGL di js/ui/duel-fx-webgl.js, come primo figlio dell'overlay (sotto il contenuto), che si
// spegne da solo quando l'overlay lascia il documento. Con DUEL_FX_WEBGL_OFF resta lo sfondo sfumato.
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'Inizio e fine duello: sfondo WebGL al posto dei raggi ruotanti',
    async run({ page, assert }) {
        await openDuel(page);
        await page.waitForFunction(() => !!window.DuelFxWebgl && !!window.DuelCinematics);
        const r = await page.evaluate(async () => {
            const out = {};
            for (const scena of ['intro', 'won', 'lost', 'draw']) {
                const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#000';
                const figlio = document.createElement('div'); figlio.textContent = 'x'; o.appendChild(figlio);
                document.body.appendChild(o);
                const stop = DuelFxWebgl.monta(o, scena, { impattoMs: 300 });
                await new Promise((x) => setTimeout(x, 250));
                out[scena] = { canvas: o.firstChild && o.firstChild.tagName === 'CANVAS', tocco: getComputedStyle(o.firstChild).pointerEvents, stop: typeof stop };
                o.remove();
                await new Promise((x) => setTimeout(x, 150));
            }
            // il ripiego
            window.DUEL_FX_WEBGL_OFF = true;
            const o2 = document.createElement('div'); document.body.appendChild(o2);
            out.spento = DuelFxWebgl.monta(o2, 'won'); o2.remove(); window.DUEL_FX_WEBGL_OFF = false;
            return out;
        });
        ['intro', 'won', 'lost', 'draw'].forEach((s) => {
            assert(r[s].canvas && r[s].tocco === 'none' && r[s].stop === 'function', `Scena ${s}: canvas come primo figlio, senza tocco, con la sua funzione di spegnimento: ${JSON.stringify(r[s])}`);
        });
        assert(r.spento === null, 'Con DUEL_FX_WEBGL_OFF non si monta nulla');
        const sorg = await page.evaluate(async () => {
            const css = await (await fetch('js/ui/duel-cinematics.css').catch(() => ({ text: async () => '' }))).text();
            return css;
        });
        assert(!/\.di-rays\s*\{|\.do-rays\s*\{|doRaysSpin|diRaysSpin/.test(sorg), 'Le regole dei raggi ruotanti non esistono piu\' nel CSS');
    }
};
