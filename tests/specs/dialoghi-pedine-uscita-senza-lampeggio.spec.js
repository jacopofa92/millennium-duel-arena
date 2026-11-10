const path = require('path');

module.exports = {
    standalone: true,
    name: 'Dialoghi: dissolvenza della pedina integra, caricamenti senza immagine rotta e cambi rapidi protetti',
    async run({ browser, assert }) {
        const page = await browser.newPage({ viewport: { width: 412, height: 900 }, reducedMotion: 'no-preference' });
        const root = path.join(__dirname, '../..');
        await page.route('https://pedine.test/**', async (route) => {
            if (route.request().url().includes('lenta')) await new Promise((r) => setTimeout(r, 250));
            if (route.request().url().includes('assente')) return route.fulfill({ status: 404, body: '' });
            await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200"><rect width="100" height="200" fill="gold"/></svg>' });
        });
        try {
            await page.setContent('<!doctype html><html><body></body></html>');
            await page.addStyleTag({ path: path.join(root, 'js/ui/story-cutscene.css') });
            await page.addScriptTag({ path: path.join(root, 'js/ui/story-cutscene.js') });
            await page.evaluate(() => {
                window.scenaFinita = StoryCutscene.play([
                    { nome: 'Kaiba', ritratto: 'https://pedine.test/buona.svg', testo: 'A' },
                    { testo: 'Il narratore prende la parola.' },
                    { nome: 'Yugi', ritratto: 'https://pedine.test/lenta.svg', testo: 'B' },
                    { nome: 'Voce', ritratto: 'https://pedine.test/assente.svg', testo: 'C' }
                ]);
            });
            await page.waitForFunction(() => {
                const img = document.querySelector('.sc-ritratto img');
                return img && img.naturalWidth > 0 && Number(getComputedStyle(img.parentElement).opacity) > 0.9;
            });
            const uscita = await page.evaluate(async () => {
                document.querySelector('.sc-avanti').click();
                const p = document.querySelector('.sc-ritratto');
                const img = p.querySelector('img');
                const conservata = !!img.getAttribute('src') && img.naturalWidth > 0;
                let frameRotti = 0;
                const fino = performance.now() + 450;
                do {
                    await new Promise(requestAnimationFrame);
                    if (Number(getComputedStyle(p).opacity) > 0 && getComputedStyle(img).visibility !== 'hidden'
                        && (!img.getAttribute('src') || (img.complete && !img.naturalWidth))) frameRotti++;
                } while (performance.now() < fino);
                return { conservata, frameRotti };
            });
            assert(uscita.conservata && uscita.frameRotti === 0, 'Durante l’uscita il ritratto resta integro: ' + JSON.stringify(uscita));
            // Completa la narrazione, poi passa alla pedina ancora in caricamento.
            await page.locator('.sc-box').click();
            await page.waitForFunction(() => document.querySelector('.sc-ritratto img').getAttribute('src').includes('lenta'));
            assert(await page.locator('.sc-ritratto img').evaluate((img) => getComputedStyle(img).visibility === 'hidden' || img.naturalWidth > 0), 'Caricamento senza placeholder rotto');
            await page.waitForFunction(() => document.querySelector('.sc-ritratto img').naturalWidth > 0);
            await page.locator('.sc-box').click();
            await page.waitForSelector('.sc-ritratto.is-sigillo');
            assert(await page.locator('.sc-ritratto img').evaluate((img) => getComputedStyle(img).visibility === 'hidden'), 'File assente nascosto dietro al sigillo');
            await page.locator('.sc-salta').click();
            await page.evaluate(() => window.scenaFinita);

            const opacita = await page.evaluate(async () => {
                window.scenaFinita = StoryCutscene.play([
                    { nome: 'Kaiba', ritratto: 'https://pedine.test/buona.svg', testo: 'A' },
                    { testo: 'Narratore.' }
                ]);
                await new Promise(requestAnimationFrame);
                const scena = document.querySelector('.sc-scena');
                scena.click(); scena.click();
                await new Promise(requestAnimationFrame);
                await new Promise(requestAnimationFrame);
                return document.querySelector('.sc-ritratto').style.opacity;
            });
            assert(opacita === '0', 'Un ingresso pendente non riaccende la pedina sulla battuta del narratore');
        } finally { await page.close(); }
    }
};
