// Moneta e dado del duello in WebGL (js/ui/lancio-webgl.js): con Dettagli "Alti" un oggetto 3D su un canvas proprio,
// rilasciato a fine lancio; con "Normali" (o spento) la versione di sempre. Solo grafica: l'esito lo decide chi chiama.
const path = require('path');
const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Moneta e dado: 3D in WebGL con Dettagli Alti, canvas rilasciato a fine lancio, ripiego con Normali',
    standalone: true,
    async run({ browser, assert }) {
        const errori = [];
        const ctx = await browser.newContext({ viewport: { width: 900, height: 600 }, serviceWorkers: 'block' });
        await ctx.addInitScript(() => {
            window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true;
            localStorage.setItem('ygoVideoDetail', 'alti'); localStorage.setItem('ygoVideoDetailScelto', '1');
        });
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await page.goto(url('duelMonstersCore.html'));
            await page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.playerHand && gameState.playerHand.length > 0 && window.LancioGL, null, { timeout: 40000 });
            await page.waitForTimeout(2000);
            assert(await page.evaluate(() => LancioGL.pronto()), 'Con Alti e WebGL la scena e\' pronta');

            // Moneta: Testa e Croce, canvas dentro lo sfondo di sempre, etichetta col risultato
            for (const testa of [true, false]) {
                await page.evaluate((t) => { document.querySelectorAll('.fx-randomizer-backdrop').forEach((e) => e.remove()); FX.playCoinFlip(t); }, testa);
                const m = await page.evaluate(() => {
                    const s = document.querySelector('.fx-randomizer-backdrop');
                    return { sfondo: !!s, canvas: !!(s && s.querySelector('canvas')), emoji: !!(s && s.querySelector('.fx-coinflip-coin')), testo: s && s.querySelector('.fx-coinflip-label') ? s.querySelector('.fx-coinflip-label').textContent : null };
                });
                assert(m.sfondo && m.canvas && !m.emoji, `La moneta e' un canvas WebGL, non l'emoji: ${JSON.stringify(m)}`);
                assert(m.testo === (testa ? 'TESTA' : 'CROCE'), `L'etichetta dice l'esito deciso: ${m.testo}`);
            }
            // Dado: ogni risultato
            for (const n of [1, 2, 3, 4, 5, 6]) {
                await page.evaluate((x) => { document.querySelectorAll('.fx-randomizer-backdrop').forEach((e) => e.remove()); FX.playDiceRoll(x); }, n);
                const d = await page.evaluate(() => { const s = document.querySelector('.fx-randomizer-backdrop'); return { canvas: !!(s && s.querySelector('canvas')), cubo: !!(s && s.querySelector('.fx-dice-cube')), testo: s && s.querySelector('.fx-dice-label') ? s.querySelector('.fx-dice-label').textContent : null }; });
                assert(d.canvas && !d.cubo && d.testo === `RISULTATO: ${n}`, `Dado ${n}: canvas WebGL e etichetta giusta: ${JSON.stringify(d)}`);
            }
            assert(!(await page.evaluate(() => window.LANCIO_GL_ERRORE)), 'Lo shader compila');

            // A fine lancio lo sfondo sparisce (e con lui il canvas: il contesto viene rilasciato)
            await page.waitForFunction(() => !document.querySelector('.fx-randomizer-backdrop'), null, { timeout: 8000 });

            // "Normali": vale la versione di sempre
            await page.evaluate(() => VideoQuality.set('normali'));
            await page.evaluate(() => FX.playCoinFlip(true));
            const n = await page.evaluate(() => { const s = document.querySelector('.fx-randomizer-backdrop'); return { sfondo: !!s, canvas: !!(s && s.querySelector('canvas')) }; });
            assert(n.sfondo && !n.canvas, `Con Normali niente canvas WebGL: ${JSON.stringify(n)}`);
        } finally {
            await ctx.close();
        }
        assert(errori.length === 0, `Nessun errore JS: ${errori.join(' | ')}`);
    }
};
