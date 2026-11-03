const path = require('path');

module.exports = {
    name: 'Drop carta: cerimonia 3D in coda e contenuta su mobile',
    standalone: true,
    async run({ browser, assert }) {
        const root = path.join(__dirname, '..', '..').replace(/\\/g, '/');
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
        await context.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); window.AUTH_GATE_SKIP = true; });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        try {
            await page.goto('file:///' + root + '/storia.html');
            await page.waitForFunction(() => !!window.CardDropAnimation);
            await page.evaluate(() => {
                CardDropAnimation.enqueue({ cardId: 472, nome: 'Drago Alato di Ra', rule: 'Ricompensa di prova' });
                CardDropAnimation.enqueue({ cardId: 31, nome: 'Slifer il Drago del Cielo', rule: 'Seconda ricompensa' });
            });
            await page.waitForSelector('.cdrop-overlay.cdrop-visible');
            const first = await page.evaluate(() => {
                const overlay = document.querySelector('.cdrop-overlay');
                const card = overlay.querySelector('.cdrop-card').getBoundingClientRect();
                const button = overlay.querySelector('.cdrop-continue').getBoundingClientRect();
                return {
                    name: overlay.querySelector('.cdrop-name').textContent,
                    z: Number(getComputedStyle(overlay).zIndex),
                    particles: overlay.querySelectorAll('.cdrop-particle').length,
                    fascia: overlay.classList.contains('cdrop-mythic'),
                    impatto: !!overlay.querySelector('.cdrop-impact'),
                    backgroundOpaque: getComputedStyle(overlay).backgroundImage.indexOf('rgba') === -1,
                    cardInside: card.left >= 0 && card.right <= innerWidth && card.top >= 0 && card.bottom <= innerHeight,
                    buttonInside: button.bottom <= innerHeight && button.left >= 0 && button.right <= innerWidth
                };
            });
            assert(first.name.includes('Ra'), 'La prima carta della coda deve essere Ra');
            assert(first.z > 100000, 'La cerimonia deve stare sopra alla UI di gioco');
            assert(first.fascia && first.impatto, 'La ricompensa usa la cerimonia e l\'impatto della propria rarità');
            assert(first.particles <= 36 && first.backgroundOpaque,
                'La scena deve restare leggera e coprire davvero la pagina sottostante');
            assert(first.cardInside && first.buttonInside, 'Carta e pulsante devono restare nello schermo mobile');
            // Un tocco impaziente durante la rotazione non deve troncare il
            // premio né far partire subito quello successivo.
            await page.locator('.cdrop-continue').dispatchEvent('click');
            await page.waitForTimeout(250);
            assert(await page.locator('.cdrop-name').textContent().then((t) => t.includes('Ra')),
                'La ricompensa non deve chiudersi prima della rivelazione completa');
            await page.waitForSelector('.cdrop-overlay.cdrop-ready');
            await page.click('.cdrop-continue');
            await page.waitForFunction(() => document.querySelector('.cdrop-name')?.textContent.includes('Slifer'));
            await page.waitForSelector('.cdrop-overlay.cdrop-ready');
            await page.click('.cdrop-continue');
            await page.waitForFunction(() => !document.querySelector('.cdrop-overlay'));
            assert(errors.length === 0, 'Errori JS: ' + errors.join(' | '));
        } finally {
            await context.close();
        }
    }
};
