const path = require('path');

// Duello Libero e Tag Team locale mostrano cosa paga una vittoria al livello scelto.
// I numeri devono essere QUELLI di Rewards (nessuna copia a mano) e seguire il livello.
module.exports = {
    standalone: true,
    name: 'Premi della vittoria mostrati in Duello Libero e Tag Team, per livello',
    async run(t) {
        const root = path.join(__dirname, '..', '..');
        const url = (f) => 'file:///' + path.join(root, f).replace(/\\/g, '/');
        const page = await t.browser.newPage();
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        try {
            // --- Duello Libero: la finestra della sfida ---
            await page.goto(url('duello-libero.html'));
            await page.waitForSelector('.cube:not(.cube--bloccato)');
            await page.click('.cube:not(.cube--bloccato)');
            await page.waitForSelector('#diffModal.open');
            for (const [key, credito] of [['Facile', 30], ['Medio', 50], ['Difficile', 80]]) {
                await page.click(`.sl-liv[data-livello="${key}"]`);
                const r = await page.evaluate((k) => ({
                    sommario: document.querySelector('[data-sl="premiSommario"]').textContent,
                    corpo: document.querySelector('[data-sl="premiCorpo"]').textContent,
                    atteso: window.Rewards.preview(k)
                }), key);
                t.assert(r.sommario.includes(`+${credito} crediti`), `Sommario di ${key} senza +${credito}: ${r.sommario}`);
                t.assert(r.atteso.crediti === credito || r.atteso.ridotta, `Rewards.preview(${key}) incoerente`);
                t.assert(/Stella/.test(r.corpo) && /Carta Locazione/.test(r.corpo) && /Carta del Millennio/.test(r.corpo),
                    `Elenco ritrovamenti incompleto per ${key}: ${r.corpo}`);
            }
            // Le percentuali sono quelle EFFETTIVE (il drop si ferma al primo): mai sopra la nominale.
            const eff = await page.evaluate(() => Rewards.preview('Difficile').drops.map((d) => d.chance));
            t.assert(Math.abs(eff[0] - 0.09) < 1e-9, 'La Stella a Difficile deve valere esattamente 9%');
            t.assert(eff[1] < 0.03 && eff[1] > 0.027, `Locazione effettiva fuori scala: ${eff[1]}`);
            t.assert(eff[2] < 0.008 && eff[2] > 0.007, `Millennio effettivo fuori scala: ${eff[2]}`);

            // --- Tag Team: il riquadro segue il livello scelto ---
            await page.goto(url('tag.html'));
            await page.waitForSelector('#premiTag .rw-anteprima');
            const testo = () => page.evaluate(() => document.getElementById('premiTag').textContent);
            let s = await testo();
            t.assert(s.includes('Tag Team') && s.includes('+50 crediti'), `Tag a Normale deve mostrare +50: ${s}`);
            await page.evaluate(() => {
                const b = Array.from(document.querySelectorAll('#regolaLivello button')).find((x) => /Difficile/.test(x.textContent));
                b.click();
            });
            await page.waitForFunction(() => document.getElementById('premiTag').textContent.includes('+80 crediti'));
            await page.evaluate(() => {
                const b = Array.from(document.querySelectorAll('#regolaLivello button')).find((x) => /Facile/.test(x.textContent));
                b.click();
            });
            await page.waitForFunction(() => document.getElementById('premiTag').textContent.includes('+30 crediti'));

            // Nessuno sbordo laterale a 390px.
            await page.setViewportSize({ width: 390, height: 844 });
            const sbordo = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
            t.assert(!sbordo, 'Il riquadro dei premi non deve far scorrere la pagina in orizzontale');
        } finally {
            await page.close();
        }
    }
};
