// I riflessi delle carte vive (rarita') sono UNO shader per carta (js/ui/carta-viva-webgl.js) al posto dei quattro
// strati DOM con blend mode. Qui: (1) la scheda grande ha un canvas e nessuno strato DOM, per ogni rarita';
// (2) il canvas ha davvero pixel accesi (non e' vuoto) e li cambia quando cambia la luce;
// (3) in griglia il canvas nasce solo sotto il mouse e sparisce all'uscita, riusando i contesti;
// (4) con CARTA_VIVA_WEBGL_OFF tornano gli strati di sempre.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Carte vive in WebGL: un canvas per carta, luce che si aggiorna, griglia solo sotto il mouse, ripiego sugli strati',
    standalone: true,
    async run({ browser, assert }) {
        const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, serviceWorkers: 'block' });
        await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await ctx.newPage();
        try {
            await page.goto(url('cartoteca.html'));
            await page.waitForFunction(() => window.CardDetail && window.CardRarity && window.CartaVivaGL && document.querySelector('.card.carta-viva'), null, { timeout: 30000 });
            assert(await page.evaluate(() => CartaVivaGL.disponibile()), 'WebGL deve essere disponibile nel browser di prova');

            // (1) e (2): una carta per rarita' nella scheda grande
            for (const rarita of ['common', 'rare', 'super', 'ultra', 'legendary', 'secret', 'mythic']) {
                const r = await page.evaluate(async (rarita) => {
                    const carta = cardDatabase.find((c) => (!c.origin || c.origin === 'yu-gi-oh') && CardRarity.of(c.id) === rarita);
                    CardDetail.open(carta);
                    await new Promise((x) => setTimeout(x, 350));
                    const el = document.querySelector('.cd-preview .card');
                    const cv = el.querySelector('canvas.cv-gl');
                    let accesi = 0;
                    if (cv) {
                        // si legge il canvas con un 2D: copia dell'ultimo frame disegnato
                        const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
                        const x2 = c2.getContext('2d'); x2.drawImage(cv, 0, 0);
                        const d = x2.getImageData(0, 0, c2.width, c2.height).data;
                        for (let i = 3; i < d.length; i += 4) if (d[i] > 0 || d[i - 1] > 0) accesi++;
                    }
                    return { rarita: el.dataset.rarita, canvas: !!cv, strati: el.querySelectorAll('.cv-riflesso,.cv-bordo,.cv-olo,.cv-grana').length, accesi: accesi };
                }, rarita);
                assert(r.rarita === rarita && r.canvas && r.strati === 0, `Scheda ${rarita}: un canvas e nessuno strato DOM: ${JSON.stringify(r)}`);
                assert(r.accesi > 50, `Scheda ${rarita}: il canvas deve avere pixel accesi (la luce passa su ogni carta): ${JSON.stringify(r)}`);
            }

            // la luce che cambia (variabili CSS) ridisegna il canvas
            const luce = await page.evaluate(async () => {
                CardDetail.open(cardDatabase.find((c) => CardRarity.of(c.id) === 'ultra'));
                await new Promise((x) => setTimeout(x, 300));
                const el = document.querySelector('.cd-preview .card');
                const cv = el.querySelector('canvas.cv-gl');
                const somma = () => { const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height; const x2 = c2.getContext('2d'); x2.drawImage(cv, 0, 0);
                    const d = x2.getImageData(0, 0, c2.width, c2.height).data; let s = 0; for (let i = 0; i < d.length; i += 40) s += d[i] + d[i + 1] * 3 + d[i + 2] * 7; return s; };
                el.style.animation = 'none';
                el.style.setProperty('--luce-x', '20%'); el.style.setProperty('--luce-y', '20%'); el.style.setProperty('--forza', '0.9');
                await new Promise((x) => setTimeout(x, 120)); const a = somma();
                el.style.setProperty('--luce-x', '80%'); el.style.setProperty('--luce-y', '75%'); el.style.setProperty('--forza', '0.2');
                await new Promise((x) => setTimeout(x, 120)); const b = somma();
                return { a: a, b: b };
            });
            assert(luce.a !== luce.b, `Cambiando luce e forza il canvas deve cambiare: ${JSON.stringify(luce)}`);
            await page.evaluate(() => CardDetail.close());
            await page.waitForTimeout(100);
            const dopoChiusura = await page.evaluate(() => CartaVivaGL.attive());

            // (3) griglia: canvas solo sotto il mouse
            const tile = page.locator('#cartotecaGrid .card').first();
            await tile.scrollIntoViewIfNeeded();
            const prima = await page.evaluate(() => document.querySelectorAll('#cartotecaGrid canvas.cv-gl').length);
            await tile.hover();
            await page.waitForTimeout(150);
            const sotto = await page.evaluate(() => document.querySelectorAll('#cartotecaGrid canvas.cv-gl').length);
            await page.mouse.move(2, 2);
            await page.waitForTimeout(150);
            const dopo = await page.evaluate(() => document.querySelectorAll('#cartotecaGrid canvas.cv-gl').length);
            assert(prima === 0 && sotto === 1 && dopo === 0, `In griglia il canvas esiste solo sotto il mouse: ${prima}/${sotto}/${dopo}`);
            assert(dopoChiusura <= 1, `Chiusa la scheda i contesti tornano disponibili: ${dopoChiusura}`);

            // (4) ripiego
            const rip = await page.evaluate(async () => {
                window.CARTA_VIVA_WEBGL_OFF = true;
                CardDetail.open(cardDatabase.find((c) => CardRarity.of(c.id) === 'super'));
                await new Promise((x) => setTimeout(x, 250));
                const el = document.querySelector('.cd-preview .card');
                return { canvas: !!el.querySelector('canvas.cv-gl'), strati: el.querySelectorAll('.cv-riflesso,.cv-bordo,.cv-olo').length };
            });
            assert(!rip.canvas && rip.strati === 3, `Con il WebGL spento tornano gli strati DOM: ${JSON.stringify(rip)}`);
        } finally {
            await ctx.close();
        }
    }
};
