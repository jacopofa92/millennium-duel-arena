// Importare un file di salvataggio NON deve più sostituire il salvataggio in
// silenzio: prima si fa vedere cosa cambia, e quello di adesso resta recuperabile.
//   - un file rovinato (JSON sbagliato, nessun mazzo, valute non numeriche) viene
//     rifiutato con un messaggio e NON tocca il salvataggio;
//   - un file valido apre il riquadro di confronto con gli avvisi giusti (nome
//     giocatore diverso, file più vecchio);
//   - "Annulla" non cambia niente e non lascia nessuna copia;
//   - "Importa" vuole DUE tocchi, applica il file e conserva il salvataggio di
//     prima come copia di sicurezza (si ritrova in «Recupera le modifiche»);
//   - il riquadro sta dentro lo schermo su un telefono.
const path = require('path');
const { creaFintoCloud } = require('../helpers/finto-cloud.js');

const RADICE = path.join(__dirname, '..', '..');
const INDEX = 'file:///' + path.join(RADICE, 'profilo.html').replace(/\\/g, '/');
const CHIAVE = 'ygoSalvataggioDivergente';

const come = (testo, nome) => ({ name: nome || 'backup.json', mimeType: 'application/json', buffer: Buffer.from(testo) });

module.exports = {
    name: 'Importa salvataggio: controllo del file, conferma con confronto, copia di sicurezza',
    standalone: true,
    async run({ browser, assert }) {
        const { collega } = creaFintoCloud();
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
        await collega(ctx);
        const page = await ctx.newPage();
        const crediti = () => page.evaluate(() => (SaveManager.hasSave() ? SaveManager.load().currency.credits : null));
        try {
            await page.goto(INDEX);
            await page.waitForFunction(() => !!(window.SaveManager && window.CloudSync));
            await page.evaluate(() => { SaveManager.createNew('Jacopo'); SaveManager.addCurrency('credits', 500); localStorage.removeItem('ygoSalvataggioDivergente'); });
            await page.waitForFunction(() => !!window.RecuperoCopia, null, { timeout: 15000 });
            const prima = await page.evaluate(() => SaveManager.load().currency.credits);
            const input = page.locator('#importInput');

            // --- File rovinati: rifiutati, niente cambia ---
            const brutti = [
                ['non è JSON', 'questo non è un salvataggio'],
                ['senza mazzi', JSON.stringify({ player: { name: 'X' }, decks: [] })],
                ['mazzi rovinati', JSON.stringify({ decks: [{ id: 'a' }] })],
                ['valute non numeriche', JSON.stringify({ decks: [{ id: 'a', main: [] }], currency: { credits: 'tanti' } })],
                ['collezione rovinata', JSON.stringify({ decks: [{ id: 'a', main: [] }], collection: { 7: 'x' } })]
            ];
            for (const [etichetta, testo] of brutti) {
                await input.setInputFiles(come(testo));
                await page.waitForTimeout(400);
                assert(await page.locator('#recuperoCopia').count() === 0, `file ${etichetta}: non deve aprirsi nessun riquadro d'importazione`);
                assert(await crediti() === prima, `file ${etichetta}: il salvataggio non si tocca`);
            }
            assert(await page.evaluate((c) => !localStorage.getItem(c), CHIAVE), 'i file rifiutati non lasciano nessuna copia');

            // --- Un file valido, di un'altra persona e più vecchio ---
            const file = await page.evaluate(() => {
                const s = JSON.parse(JSON.stringify(SaveManager.load()));
                s.player.name = 'Altra Persona';
                s.player.lastSaved = new Date(Date.now() - 5 * 86400000).toISOString();
                s.currency.credits = 3;
                s.collection[7] = 2;
                return JSON.stringify(s);
            });
            await input.setInputFiles(come(file, 'vecchio.json'));
            await page.waitForSelector('#recuperoCopia .rc-box');
            const avvisi = await page.locator('#recuperoCopia .rc-attenzione').allInnerTexts();
            assert(avvisi.some((a) => /Altra Persona/.test(a) && /Jacopo/.test(a)), 'avvisa che il nome giocatore è diverso: ' + avvisi.join(' | '));
            assert(avvisi.some((a) => /più vecchio/.test(a)), 'avvisa che il file è più vecchio: ' + avvisi.join(' | '));
            const righe = await page.evaluate(() => [...document.querySelectorAll('#recuperoCopia .rc-riga')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
            assert(/−\s?497/.test(righe.find((r) => /crediti/i.test(r)) || ''), 'mostra la differenza dei crediti: ' + righe.find((r) => /crediti/i.test(r)));

            // Dentro lo schermo, anche col telefono in orizzontale.
            for (const [w, h] of [[390, 844], [844, 390]]) {
                await page.setViewportSize({ width: w, height: h });
                await page.waitForTimeout(150);
                const m = await page.evaluate(() => {
                    const b = document.querySelector('#recuperoCopia .rc-box').getBoundingClientRect();
                    const az = document.querySelector('#recuperoCopia .rc-azioni').getBoundingClientRect();
                    return { l: b.left, r: b.right, t: b.top, b: b.bottom, azB: az.bottom, vw: innerWidth, vh: innerHeight, scrollX: document.documentElement.scrollWidth > innerWidth + 1 };
                });
                assert(m.l >= -0.5 && m.r <= m.vw + 0.5 && m.t >= -0.5 && m.b <= m.vh + 0.5 && m.azB <= m.vh + 0.5 && !m.scrollX, `${w}x${h}: il riquadro non sta nello schermo ${JSON.stringify(m)}`);
            }
            await page.setViewportSize({ width: 390, height: 844 });

            // --- Annulla: niente cambia ---
            await page.locator('#recuperoCopia .rc-btn', { hasText: 'Annulla' }).click();
            await page.waitForSelector('#recuperoCopia', { state: 'detached' });
            assert(await crediti() === prima, 'annullando il salvataggio resta quello di prima');
            assert(await page.evaluate((c) => !localStorage.getItem(c), CHIAVE), 'annullando non resta nessuna copia');

            // --- Importa: due tocchi ---
            await input.setInputFiles(come(file, 'vecchio.json'));
            await page.waitForSelector('#recuperoCopia .rc-box');
            const importa = page.locator('#recuperoCopia .rc-btn--ok');
            await importa.click();
            assert(await crediti() === prima, 'il primo tocco non importa ancora');
            await importa.click();
            await page.waitForSelector('#recuperoCopia .rc-esito--ok');
            assert(await crediti() === 3, 'il file è diventato il salvataggio: ' + await crediti());
            const copia = await page.evaluate((c) => JSON.parse(localStorage.getItem(c)).data.currency.credits, CHIAVE);
            assert(copia === prima, 'il salvataggio di prima è conservato come copia di sicurezza: ' + copia);

            // --- Dopo "Fatto" il pulsante di recupero compare, e riporta indietro ---
            await page.locator('#recuperoCopia .rc-btn--ok').click();
            await page.waitForSelector('#recuperoCopia', { state: 'detached' });
            const pulsante = page.locator('#recuperoCopiaMount .rc-apri');
            assert(await pulsante.isVisible(), 'dopo l\'importazione compare «Recupera le modifiche»');
        } finally {
            await ctx.close();
        }
    }
};
