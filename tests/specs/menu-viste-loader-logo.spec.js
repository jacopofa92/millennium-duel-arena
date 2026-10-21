const path = require('path');

module.exports = {
    name: 'Menu: font locale del logo e loader sulle pagine Negozio/Cartoteca',
    standalone: true,
    async run({ browser, assert }) {
        const root = path.join(__dirname, '..', '..');
        const url = 'file:///' + path.join(root, 'index.html').replace(/\\/g, '/');
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
        await context.addInitScript(() => {
            window.AUTH_GATE_SKIP = true;
            try { sessionStorage.setItem('ygoSplashShown', '1'); } catch (e) { /* file:// può limitarlo */ }
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.PageLoader && customElements.get('game-logo'));

        const logo = await page.evaluate(async () => {
            await document.fonts.load('900 32px "Duel Arena Inscription"');
            const title = document.querySelector('game-logo .gl-riga2');
            return {
                family: getComputedStyle(title).fontFamily,
                loaded: document.fonts.check('900 32px "Duel Arena Inscription"')
            };
        });
        assert(logo.family.includes('Duel Arena Inscription'), `Font del logo non applicato: ${logo.family}`);
        assert(logo.loaded, 'Il font locale del titolo non è stato caricato');

        // Negozio e Cartoteca sono pagine dedicate (non piu' viste del menu): il loader generale compare da solo ad
        // ogni apertura e sparisce a pagina pronta.
        for (const pagina of ['negozio.html', 'cartoteca.html']) {
            const p2 = await context.newPage();
            const errori2 = [];
            p2.on('pageerror', (error) => errori2.push(error.message));
            await p2.goto('file:///' + path.join(root, pagina).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
            const compare = await p2.evaluate(() => !!document.getElementById('pageLoader'));
            assert(compare, `Il loader generale non compare aprendo ${pagina}`);
            await p2.waitForFunction(() => document.querySelector('#pageLoader').classList.contains('page-loader-hidden'),
                null, { timeout: 30000 });
            assert(errori2.length === 0, `Errori JS in ${pagina}: ${errori2.join(' | ')}`);
            await p2.close();
        }
        assert(errors.length === 0, `Errori JS nel menu: ${errors.join(' | ')}`);
        await context.close();
    }
};
