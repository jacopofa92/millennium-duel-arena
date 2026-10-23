// Cartoteca: la scheda di un mostro ha "Vedi ologramma" (js/ui/ologramma-vetrina.js). Su un server (http) l'ologramma e'
// quello WebGL del duello, su un livello portato sopra la vetrina; chiudendo, il livello torna a posto e non resta nulla.
// Su file:// le texture sono rifiutate e si vede il ripiego in CSS. Una Magia non ha il pulsante.
//
// `standalone`: serve una pagina aperta in due modi (http e file://).
const path = require('path');
const { startStaticServer } = require('../helpers/local-servers');

const RADICE = path.join(__dirname, '..', '..');

async function apri(browser, url) {
    const context = await browser.newContext({ viewport: { width: 900, height: 800 }, serviceWorkers: 'block' });
    await context.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
    const page = await context.newPage();
    const errori = [];
    page.on('pageerror', (e) => errori.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.CardDetail && window.OlogrammaVetrina && window.MonsterHologramGL && typeof cardDatabase !== 'undefined', null, { timeout: 30000 });
    return { context, page, errori };
}

module.exports = {
    name: 'Cartoteca: "Vedi ologramma" apre la vetrina (WebGL su http, CSS su file://) e la chiude',
    standalone: true,
    async run({ browser, assert }) {
        const server = await startStaticServer();
        try {
            {
                const { context, page, errori } = await apri(browser, server.origin + '/cartoteca.html');
                const senza = await page.evaluate(() => {
                    CardDetail.open(cardDatabase.find((c) => c.type === 'spell'));
                    return !!document.querySelector('.cd-olo');
                });
                assert(!senza, 'Una Magia non ha il pulsante ologramma');
                await page.evaluate(() => { CardDetail.close(); CardDetail.open(cardDatabase.find((c) => c.id === 1)); });
                assert(await page.locator('.cd-olo').count() === 1, 'Un mostro ha il pulsante ologramma');
                await page.locator('.cd-olo').click();
                await page.waitForFunction(() => MonsterHologramGL.attivi() === 1, null, { timeout: 10000 });
                const aperta = await page.evaluate(() => ({
                    vetrina: !!document.querySelector('.ov-vetrina'),
                    canvas: !!document.querySelector('#monsterHologramLayer > canvas'),
                    z: document.getElementById('monsterHologramLayer').style.zIndex,
                    css: !!document.querySelector('.ov-css')
                }));
                assert(aperta.vetrina && aperta.canvas && aperta.z === '760' && !aperta.css, `Con WebGL: vetrina e canvas sopra: ${JSON.stringify(aperta)}`);
                await page.locator('.ov-vetrina').click({ position: { x: 5, y: 5 } });
                await page.waitForFunction(() => MonsterHologramGL.attivi() === 0, null, { timeout: 5000 });
                const chiusa = await page.evaluate(() => ({ z: document.getElementById('monsterHologramLayer').style.zIndex, aperta: OlogrammaVetrina.aperta() }));
                assert(chiusa.z === '' && !chiusa.aperta, `Alla chiusura il livello torna a posto: ${JSON.stringify(chiusa)}`);
                assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
                await context.close();
            }
            {
                const { context, page, errori } = await apri(browser, 'file:///' + RADICE.replace(/\\/g, '/') + '/cartoteca.html');
                await page.evaluate(() => CardDetail.open(cardDatabase.find((c) => c.id === 1)));
                await page.locator('.cd-olo').click();
                await page.waitForSelector('.ov-css', { timeout: 5000 });
                assert(errori.length === 0, `Errori di pagina nel ripiego: ${errori.join(' | ')}`);
                await context.close();
            }
        } finally {
            await server.close();
        }
    }
};
