// Richiesta dell'utente (2026-11-07): i nomi dei duellanti non vanno a capo ("Maximillion Pegasus puo' estendersi ancora oltre").
// Prima, sul telefono, il nome era limitato a 32vw e si spezzava come "MAXIMILLIO / N PEGASUS". Ora sta su una riga sola e ha tutto
// lo spazio fino al cluster Tempo/Turno/Difficolta' dall'altra parte.
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'Nome del duellante: una riga sola e mai troncato per i nomi lunghi, su telefono e desktop',
    standalone: true,
    async run({ browser, assert }) {
        const casi = [
            ['pegasus', 360, 780, true], ['pegasus', 412, 915, true], ['pegasus', 915, 412, true], ['pegasus', 1366, 768, false],
            ['paradoxBrothers', 360, 780, true], ['albertoAngela', 412, 915, true]
        ];
        for (const [id, w, h, touch] of casi) {
            const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
            const page = await ctx.newPage();
            try {
                await openDuel(page, '?mode=free&character=' + id + '&difficulty=Facile');
                await page.waitForTimeout(800);
                const m = await page.evaluate(() => {
                    const n = document.querySelector('#botInfo .name-text');
                    const hud = document.querySelector('.hud-sistema, #duelTimer, .duel-timer');
                    const r = n.getBoundingClientRect();
                    const riga = parseFloat(getComputedStyle(n).lineHeight) || parseFloat(getComputedStyle(n).fontSize) * 1.12;
                    return { testo: n.textContent.trim(), alt: r.height, riga, troncato: n.scrollWidth > n.clientWidth + 1, dx: r.right, iw: innerWidth };
                });
                const dove = `${id} ${w}x${h}: ${JSON.stringify(m)}`;
                assert(m.alt <= m.riga * 1.35, 'il nome va a capo: ' + dove);
                assert(!m.troncato, 'il nome e\' troncato con i puntini: ' + dove);
                assert(m.dx < m.iw, 'il nome esce dallo schermo: ' + dove);
            } finally { await ctx.close(); }
        }
    }
};
