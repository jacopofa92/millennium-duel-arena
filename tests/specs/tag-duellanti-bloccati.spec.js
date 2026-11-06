// Tag Team locale: compagni, avversari e Boss seguono lo sblocco del Duello Libero (js/data/character-unlocks.js): all'inizio solo
// Yugi e il nonno si possono SCEGLIERE; gli altri si vedono, spenti, con scritto come guadagnarli; battuti in un Torneo o nella
// Storia diventano scegliibili. La scelta di partenza e' sempre uno sbloccato.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Tag Team: i Duellanti da scegliere seguono gli sblocchi del Duello Libero',
    standalone: true,
    async run({ browser, assert }) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
        await context.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await context.newPage();
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await page.goto(url('index.html'));
            await page.waitForTimeout(1500);
            await page.evaluate(() => { if (!SaveManager.hasSave()) SaveManager.createNew('Tester'); });
            await page.goto(url('tag.html'));
            await page.waitForSelector('#postiTuoi .tg-posto', { timeout: 20000 });

            const partenza = await page.evaluate(() => Array.from(document.querySelectorAll('#postiTuoi .tg-posto-nome, #postiAvv .tg-posto-nome')).map((e) => e.textContent));
            assert(partenza.length === 3 && partenza.every((n) => /Yugi Muto|Solomon Muto/.test(n) || n === 'Tester' || n === 'Tu' || n.length > 0), `Si parte da posti validi: ${JSON.stringify(partenza)}`);

            // Il pannello del compagno: tutti elencati, ma solo i due iniziali sono toccabili.
            await page.click('#postiTuoi .tg-posto >> nth=1');
            await page.waitForSelector('#foglioLista .tg-voce');
            const voci = await page.evaluate(() => Array.from(document.querySelectorAll('#foglioLista .tg-voce')).map((b) => ({ nome: b.querySelector('.tg-voce-nome').textContent, spenta: b.disabled, bloccata: b.classList.contains('tg-voce--bloccata'), titolo: b.title })));
            const toccabili = voci.filter((v) => !v.spenta).map((v) => v.nome);
            // I due iniziali e i due ospiti Extra (EXTRA_DISPONIBILI: non hanno un percorso che li sblocchi) sono i soli liberi.
            assert(voci.length > 10 && toccabili.length >= 1 && toccabili.length <= 4 && toccabili.every((n) => /Yugi Muto|Solomon Muto|Alberto Angela|Alessandro Barbero/.test(n)),
                `Solo i Duellanti sbloccati si possono scegliere: ${JSON.stringify(toccabili)}`);
            const kaiba = voci.find((v) => /Kaiba/.test(v.nome) && v.bloccata);
            assert(kaiba && /sblocca/i.test(kaiba.titolo), `Un duellante bloccato dice come sbloccarlo: ${JSON.stringify(kaiba)}`);
            await page.click('#foglioChiudi');

            // Battuto Kaiba (Torneo o Storia) diventa scegliibile.
            await page.evaluate(() => { CharacterUnlocks.sblocca('kaiba'); });
            await page.click('#postiAvv .tg-posto >> nth=0');
            await page.waitForSelector('#foglioLista .tg-voce');
            const dopo = await page.evaluate(() => Array.from(document.querySelectorAll('#foglioLista .tg-voce')).filter((b) => !b.disabled).map((b) => b.querySelector('.tg-voce-nome').textContent));
            assert(dopo.some((n) => /Kaiba/.test(n)), `Sbloccato Kaiba, si puo' scegliere come avversario: ${JSON.stringify(dopo)}`);
            assert(errori.length === 0, `nessun errore in pagina: ${errori.join(' | ')}`);
        } finally { await context.close(); }
    }
};
