// Carte "vive" (CartaViva in js/ui/card-renderer.js) e parallasse del menu
// (index.html), con la loro fonte comune js/ui/inclinazione.js.
//
// Cosa si sorveglia:
//   - ogni rarità riceve i SUOI livelli di riflesso (comune solo la luce,
//     rara il bordo, super l'arcobaleno, segreta la grana) — è
//     l'informazione che il lucido porta, non solo decorazione;
//   - la carta della scheda si inclina sotto il mouse e col giroscopio;
//   - con "riduci movimento" nulla si muove ma il lucido resta;
//   - il menu sposta i suoi livelli seguendo il mouse, e con "riduci
//     movimento" resta fermo.
const path = require('path');
const fs = require('fs');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

async function apriCartoteca(browser, opzioni) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' }, opzioni || {}));
    await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
    const page = await ctx.newPage();
    await page.goto(url('cartoteca.html'));
    await page.waitForFunction(() => window.CardDetail && window.CardRarity && typeof cardDatabase !== 'undefined'
        && document.querySelector('.card.carta-viva'), null, { timeout: 30000 });
    return { ctx, page };
}

/** Apre la scheda della prima carta Yu-Gi-Oh di quella rarità e torna i livelli della carta in anteprima. */
function apriSchedaPerRarita(page, rarita) {
    return page.evaluate((rarita) => {
        const carta = cardDatabase.find((c) => (!c.origin || c.origin === 'yu-gi-oh') && CardRarity.of(c.id) === rarita);
        CardDetail.open(carta);
        const el = document.querySelector('.cd-preview .card');
        return {
            rarita: el.dataset.rarita,
            modo: el.dataset.viva,
            livelli: ['cv-riflesso', 'cv-olo', 'cv-grana'].filter((c) => el.querySelector('.' + c))
        };
    }, rarita);
}

const leggiInclinazione = (page) => page.evaluate(() => {
    const el = document.querySelector('.cd-preview .card');
    return { y: el.style.getPropertyValue('--inc-y'), ozio: el.classList.contains('cv-ozio'), ferma: el.classList.contains('cv-ferma') };
});

module.exports = {
    name: 'Carte vive: riflessi per rarità, inclinazione col mouse e col telefono; parallasse del menu',
    standalone: true,
    async run({ browser, assert }) {
        // La Cartoteca e' UNA sola implementazione (js/ui/cartoteca-view.js), usata dalla pagina autonoma e dalla vista
        // del menu: il limite di 300 carte per pagina sta li' e vale per entrambe.
        const sorgente = fs.readFileSync(path.join(RADICE, 'js/ui/cartoteca-view.js'), 'utf8');
        assert(/const CARDS_PER_PAGE = 300;/.test(sorgente), 'la Cartoteca usa 300 carte per pagina');
        // --- Riflessi per rarità ----------------------------------------
        const { ctx, page } = await apriCartoteca(browser);
        try {
            const attesi = {
                common: ['cv-riflesso'],
                rare: ['cv-riflesso'],
                super: ['cv-riflesso', 'cv-olo'],
                secret: ['cv-riflesso', 'cv-olo', 'cv-grana']
            };
            for (const [rarita, livelli] of Object.entries(attesi)) {
                const r = await apriSchedaPerRarita(page, rarita);
                assert(r.rarita === rarita, `la carta in scheda porta la sua rarità (${rarita}): ${r.rarita}`);
                assert(r.modo === 'grande', 'la carta della scheda è nel modo "grande"');
                assert(JSON.stringify(r.livelli) === JSON.stringify(livelli),
                    `livelli di riflesso per ${rarita}: attesi ${livelli.join(',')}, trovati ${r.livelli.join(',')}`);
            }
            await page.evaluate(() => CardDetail.close());
            const griglia = await page.evaluate(() => {
                const tile = document.querySelector('[data-ct="cartotecaGrid"] .card');
                const riflesso = tile && tile.querySelector('.cv-riflesso');
                return tile ? {
                    modo: tile.dataset.viva,
                    riflessoARiposo: riflesso ? getComputedStyle(riflesso).display : null
                } : null;
            });
            assert(griglia && griglia.modo === 'griglia', 'le carte della Cartoteca sono vive in modo "griglia": ' + JSON.stringify(griglia));
            assert(griglia.riflessoARiposo === 'none', 'i livelli costosi della griglia riposano finché la carta non è osservata');

            const ordineCatalogo = await page.evaluate(() => CartotecaView.ordina([
                { id: 1240, name: 'WW1 prima', origin: 'ww1' },
                { id: 40, name: 'YGO seconda', origin: 'yu-gi-oh' },
                { id: 2, name: 'YGO prima', origin: 'yu-gi-oh' }
            ], 'default').map((c) => c.id));
            assert(JSON.stringify(ordineCatalogo) === JSON.stringify([2, 40, 1240]),
                'il catalogo conserva gli ID, ordina Yu-Gi-Oh per ID e lascia WW1 in fondo: ' + JSON.stringify(ordineCatalogo));

            const tile = page.locator('[data-ct="cartotecaGrid"] .card').first();
            await tile.scrollIntoViewIfNeeded();
            await tile.hover();
            await page.waitForTimeout(50);
            const riflessoHover = await tile.evaluate((el) => ({
                display: getComputedStyle(el.querySelector('.cv-riflesso')).display,
                hover: el.matches(':hover'),
                classi: el.className
            }));
            assert(riflessoHover.display !== 'none', 'il riflesso della griglia si accende sotto il puntatore: ' + JSON.stringify(riflessoHover));
            const costoGriglia = await tile.evaluate((el) => ({
                luceX: el.style.getPropertyValue('--luce-x'),
                forza: el.style.getPropertyValue('--forza')
            }));
            assert(costoGriglia.luceX === '38%' && costoGriglia.forza === '0.72',
                'in griglia il foil resta acceso ma la luce non viene ridipinta a ogni frame: ' + JSON.stringify(costoGriglia));

            // Livello 12: la fila non deve sforare la cornice della carta.
            const stelle = await page.evaluate(() => {
                CardDetail.open(cardDatabase.find((c) => Number(c.id) === 29));
                const el = document.querySelector('.cd-preview .card-frame-stars');
                return el ? { clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, wrap: getComputedStyle(el).flexWrap } : null;
            });
            assert(stelle && stelle.scrollWidth <= stelle.clientWidth + 1 && stelle.wrap === 'nowrap',
                'le 12 stelle del Drago Bianco Definitivo restano nella loro riga: ' + JSON.stringify(stelle));

            // --- Mouse: la scheda si inclina e torna a ondeggiare --------
            await apriSchedaPerRarita(page, 'ultra');
            await page.waitForTimeout(300);
            const box = await (await page.$('.cd-preview .card')).boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.5, { steps: 5 });
            await page.waitForTimeout(100);
            const col = await leggiInclinazione(page);
            assert(parseFloat(col.y) > 5, 'col mouse a destra la carta ruota verso destra: ' + col.y);
            assert(!col.ozio, 'mentre il mouse la guida, la carta non ondeggia da sola');
            await page.mouse.move(5, 5);
            await page.waitForTimeout(100);
            const fuori = await leggiInclinazione(page);
            assert(fuori.ozio && !fuori.y, 'uscito il mouse torna a riposo e ondeggia: ' + JSON.stringify(fuori));

            // --- Giroscopio: un telefono inclinato a destra --------------
            await page.evaluate(async () => {
                const manda = (beta, gamma) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: beta, gamma: gamma }));
                manda(40, 0);                     // posizione di riposo: come lo si tiene
                await new Promise((r) => requestAnimationFrame(() => r()));
                manda(40, 15);                    // inclinato a destra
                await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
            });
            const giro = await leggiInclinazione(page);
            assert(parseFloat(giro.y) > 5, 'inclinando il telefono a destra la carta lo segue: ' + giro.y);
            assert(!giro.ozio, 'col giroscopio attivo la carta non ondeggia da sola');
        } finally {
            await ctx.close();
        }

        // --- Movimento ridotto: fermo, ma il lucido resta ---------------
        const ridotto = await apriCartoteca(browser, { reducedMotion: 'reduce' });
        try {
            const r = await apriSchedaPerRarita(ridotto.page, 'super');
            assert(r.livelli.includes('cv-olo'), 'con movimento ridotto il riflesso della rarità resta');
            const box = await (await ridotto.page.$('.cd-preview .card')).boundingBox();
            await ridotto.page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.5, { steps: 5 });
            const stato = await leggiInclinazione(ridotto.page);
            assert(stato.ferma && !stato.y && !stato.ozio, 'con movimento ridotto la carta non si inclina né ondeggia: ' + JSON.stringify(stato));
        } finally {
            await ridotto.ctx.close();
        }

        // --- Parallasse del menu ------------------------------------------
        for (const caso of [{ nome: 'normale', opz: {} }, { nome: 'ridotto', opz: { reducedMotion: 'reduce' } }]) {
            const c = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' }, caso.opz));
            try {
                const menu = await c.newPage();
                await menu.goto(url('index.html'));
                await menu.waitForFunction(() => !!window.Inclinazione);
                await menu.mouse.move(640, 400);
                await menu.mouse.move(1270, 790, { steps: 8 });
                await menu.waitForTimeout(1200);
                const par = await menu.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--par-x')) || 0);
                if (caso.nome === 'normale') assert(par > 0.5, 'il menu segue il mouse (parallasse): --par-x = ' + par);
                else assert(par === 0, 'con movimento ridotto il menu resta fermo: --par-x = ' + par);
            } finally {
                await c.close();
            }
        }
    }
};
