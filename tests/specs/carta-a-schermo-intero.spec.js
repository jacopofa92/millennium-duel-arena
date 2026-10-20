// Dalla scheda di una carta (CardDetail: Cartoteca, Creazione Deck, Negozio)
// un tocco sulla carta la mostra a TUTTO SCHERMO, con le stesse proporzioni
// e con il suo effetto "carta viva"; un nuovo tocco (sulla carta o fuori) la
// riporta alla scheda, e Esc chiude prima lei e poi la scheda.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

const SCHERMI = [
    { nome: 'desktop', opzioni: { viewport: { width: 1366, height: 820 } } },
    { nome: 'telefono verticale', opzioni: { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true } },
    { nome: 'telefono orizzontale', opzioni: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } }
];

module.exports = {
    name: 'Scheda carta: un tocco sulla carta la mostra a tutto schermo, proporzioni intatte, con effetto',
    standalone: true,
    async run({ browser, assert }) {
        for (const schermo of SCHERMI) {
            const ctx = await browser.newContext(Object.assign({ serviceWorkers: 'block' }, schermo.opzioni));
            await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
            const page = await ctx.newPage();
            try {
                await page.goto(url('cartoteca.html'));
                await page.waitForFunction(() => window.CardDetail && window.CardRarity && typeof cardDatabase !== 'undefined'
                    && document.querySelector('.card.carta-viva'), null, { timeout: 30000 });
                await page.evaluate(() => {
                    CardDetail.open(cardDatabase.find((c) => (!c.origin || c.origin === 'yu-gi-oh') && CardRarity.of(c.id) === 'ultra'));
                });
                await page.waitForTimeout(300);
                const prima = await page.evaluate(() => {
                    const r = document.querySelector('.cd-preview .card').getBoundingClientRect();
                    return { w: r.width, h: r.height, schermo: !!document.querySelector('.cd-schermo-intero') };
                });
                assert(!prima.schermo, `${schermo.nome}: all'apertura della scheda la carta NON è a tutto schermo`);

                // Un tocco sulla carta della scheda: si apre a tutto schermo.
                await page.click('.cd-preview .card');
                await page.waitForSelector('.cd-schermo-intero--aperto');
                await page.waitForTimeout(400);
                const grande = await page.evaluate(() => {
                    const el = document.querySelector('.cd-schermo-intero .card');
                    const r = el.getBoundingClientRect();
                    return {
                        w: r.width, h: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom,
                        vw: innerWidth, vh: innerHeight,
                        viva: el.classList.contains('carta-viva'), riflesso: !!el.querySelector('.cv-riflesso'), olo: !!el.querySelector('.cv-olo'),
                        rarita: el.dataset.rarita
                    };
                });
                const rapportoPrima = prima.w / prima.h;
                const rapportoGrande = grande.w / grande.h;
                assert(Math.abs(rapportoPrima - rapportoGrande) < 0.01,
                    `${schermo.nome}: proporzioni intatte (${rapportoPrima.toFixed(3)} contro ${rapportoGrande.toFixed(3)})`);
                assert(grande.w > prima.w * 1.2 || grande.h > prima.h * 1.2, `${schermo.nome}: la carta è più grande di prima (${Math.round(prima.w)} -> ${Math.round(grande.w)})`);
                assert(grande.left >= -1 && grande.top >= -1 && grande.right <= grande.vw + 1 && grande.bottom <= grande.vh + 1,
                    `${schermo.nome}: la carta sta tutta nello schermo: ${JSON.stringify(grande)}`);
                // Occupa quasi tutta la dimensione limitante.
                const riempie = Math.max(grande.w / grande.vw, grande.h / grande.vh);
                assert(riempie > 0.88, `${schermo.nome}: la carta riempie lo schermo (${riempie.toFixed(2)})`);
                assert(grande.viva && grande.riflesso && grande.olo && grande.rarita === 'ultra',
                    `${schermo.nome}: a tutto schermo la carta ha il suo effetto di rarità: ${JSON.stringify(grande)}`);

                // Un nuovo tocco sulla carta: torna la scheda.
                await page.click('.cd-schermo-intero .card');
                await page.waitForFunction(() => !document.querySelector('.cd-schermo-intero'), null, { timeout: 3000 });
                assert(await page.evaluate(() => CardDetail.isOpen()), `${schermo.nome}: chiuso l'ingrandimento la scheda resta aperta`);

                // Esc: prima chiude la carta grande, poi la scheda.
                await page.click('.cd-preview .card');
                await page.waitForSelector('.cd-schermo-intero--aperto');
                await page.keyboard.press('Escape');
                await page.waitForFunction(() => !document.querySelector('.cd-schermo-intero'), null, { timeout: 3000 });
                assert(await page.evaluate(() => CardDetail.isOpen()), `${schermo.nome}: il primo Esc chiude solo la carta grande`);
                await page.keyboard.press('Escape');
                assert(!(await page.evaluate(() => CardDetail.isOpen())), `${schermo.nome}: il secondo Esc chiude la scheda`);

                // Chiudere la scheda chiude anche l'ingrandimento.
                await page.evaluate(() => {
                    CardDetail.open(cardDatabase.find((c) => (!c.origin || c.origin === 'yu-gi-oh') && CardRarity.of(c.id) === 'common'));
                });
                await page.click('.cd-preview .card');
                await page.waitForSelector('.cd-schermo-intero--aperto');
                await page.evaluate(() => CardDetail.close());
                await page.waitForFunction(() => !document.querySelector('.cd-schermo-intero'), null, { timeout: 3000 });
            } finally {
                await ctx.close();
            }
        }
    }
};
