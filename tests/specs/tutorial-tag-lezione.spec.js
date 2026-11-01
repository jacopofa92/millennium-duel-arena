// La lezione sul Tag Team (tutorial-tag.html) e' una pagina che si sfoglia, senza duello: compare nel menu Tutorial,
// si percorre dall'inizio alla fine, e solo arrivati all'ultima pagina viene segnata come fatta.
const path = require('path');
const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Tutorial: la lezione sul Tag Team si sfoglia e si segna fatta solo alla fine',
    standalone: true,
    async run({ browser, assert }) {
        const errori = [];
        const ctx = await browser.newContext({ viewport: { width: 420, height: 800 }, serviceWorkers: 'block' });
        await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await page.goto(url('tutorial.html'));
            await page.waitForSelector('[data-lezione="tagRegole"]', { timeout: 15000 });
            const href = await page.getAttribute('[data-lezione="tagRegole"]', 'href');
            assert(href === 'tutorial-tag.html', `La voce porta alla pagina della lezione, non a un duello: ${href}`);
            assert((await page.textContent('[data-lezione="tagRegole"] .tut-stato')).includes('Da fare'), 'Prima di leggerla la lezione e\' "Da fare"');

            await page.goto(url('tutorial-tag.html'));
            await page.waitForSelector('#avanti', { timeout: 15000 });
            const pagineViste = [];
            for (let k = 0; k < 10 && await page.$('#avanti'); k++) {
                pagineViste.push(await page.textContent('.tt-titolo'));
                const fatta = await page.evaluate(() => !!SaveManager.getTutorial().lezioni.tagRegole);
                assert(!fatta, 'A meta\' lezione non e\' ancora segnata come fatta');
                await page.click('#avanti');
            }
            assert(pagineViste.length === 5 && new Set(pagineViste).size === 5, `Cinque pagine prima dell'ultima: ${JSON.stringify(pagineViste)}`);
            assert(await page.$('#prova'), 'L\'ultima pagina invita a provare un Tag Team');
            assert((await page.getAttribute('#prova', 'href')) === 'tag.html', 'Il pulsante finale porta alla pagina del Tag Team');
            assert(await page.evaluate(() => !!SaveManager.getTutorial().lezioni.tagRegole), 'Arrivati in fondo la lezione e\' segnata come fatta');
            const largo = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
            assert(largo, 'Nessuno scorrimento laterale su telefono');

            await page.goto(url('tutorial.html'));
            await page.waitForSelector('[data-lezione="tagRegole"]');
            assert((await page.textContent('[data-lezione="tagRegole"] .tut-stato')).includes('Completata'), 'Nel menu la lezione risulta completata');
        } finally {
            await ctx.close();
        }
        assert(errori.length === 0, `Nessun errore JS: ${errori.join(' | ')}`);
    }
};

