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
            // Il tiro dei ritrovamenti deve dare a OGNI livello le probabilita' scritte: Locazione 3% e
            // Millennio 0,8% identiche a Facile, Normale e Difficile (con tiri in sequenza uscivano meno
            // dove la Stella e' piu' frequente). Campione uniforme di tiri al posto del caso.
            const conti = await page.evaluate(() => {
                const N = 100000, out = {};
                const orig = Math.random;
                for (const liv of ['Facile', 'Medio', 'Difficile']) {
                    const c = { starChips: 0, locatorCards: 0, millenniumCards: 0, niente: 0 };
                    for (let i = 0; i < N; i++) {
                        Math.random = () => (i + 0.5) / N;
                        const d = Rewards._rollDrop(liv);
                        c[d ? d.currency : 'niente']++;
                    }
                    out[liv] = c;
                }
                Math.random = orig;
                return { out, N, nominali: ['Facile', 'Medio', 'Difficile'].map((l) => Rewards.preview(l).drops.map((d) => d.chance)) };
            });
            ['Facile', 'Medio', 'Difficile'].forEach((liv, k) => {
                const c = conti.out[liv], n = conti.nominali[k];
                t.assert(Math.abs(c.starChips / conti.N - n[0]) < 0.001, `Stella a ${liv}: ${c.starChips / conti.N} invece di ${n[0]}`);
                t.assert(Math.abs(c.locatorCards / conti.N - 0.03) < 0.001, `Locazione a ${liv} non e' 3%: ${c.locatorCards / conti.N}`);
                t.assert(Math.abs(c.millenniumCards / conti.N - 0.008) < 0.001, `Millennio a ${liv} non e' 0,8%: ${c.millenniumCards / conti.N}`);
            });

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
