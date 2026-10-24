// "Recupera le modifiche": il pulsante nel Profilo + il riquadro che mostra la
// differenza fra il salvataggio di adesso e la copia di sicurezza lasciata da
// un conflitto di sincronizzazione (js/ui/recupero-copia.js).
//   - senza copia il pulsante non c'è;
//   - con una copia compare, e il riquadro mostra i numeri giusti con la
//     differenza (+/−);
//   - il riquadro sta dentro lo schermo (telefono verticale, orizzontale,
//     desktop) senza scorrimento orizzontale;
//   - ripristinare vuole DUE tocchi, applica la copia e conserva il salvataggio
//     di prima (annullabile);
//   - scartare vuole DUE tocchi e fa sparire il pulsante.
const path = require('path');
const { creaFintoCloud } = require('../helpers/finto-cloud.js');

const RADICE = path.join(__dirname, '..', '..');
const INDEX = 'file:///' + path.join(RADICE, 'profilo.html').replace(/\\/g, '/');
const CHIAVE = 'ygoSalvataggioDivergente';

module.exports = {
    name: 'Recupero copia di sicurezza: pulsante, riquadro responsive, ripristino e scarto',
    standalone: true,
    async run({ browser, assert }) {
        const { collega } = creaFintoCloud();
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
        await collega(ctx);
        const page = await ctx.newPage();
        const crediti = () => page.evaluate(() => JSON.parse(localStorage.getItem('ygoSaveData') || 'null'));
        try {
            await page.goto(INDEX);
            await page.waitForFunction(() => !!(window.SaveManager && window.CloudSync));
            await page.evaluate(() => { SaveManager.createNew('Admin'); SaveManager.addCurrency('credits', 100); });
            const prima = await page.evaluate(() => SaveManager.load().currency.credits);

            // --- Senza copia: nessun pulsante ---
            await page.evaluate(() => { localStorage.removeItem('ygoSalvataggioDivergente'); localStorage.removeItem('ygoSalvataggiDivergenti'); });
            await page.waitForTimeout(800);
            const senza = await page.evaluate(() => {
                const m = document.getElementById('recuperoCopiaMount');
                return { esiste: !!m, visibile: !!m && getComputedStyle(m).display !== 'none' };
            });
            assert(senza.esiste && !senza.visibile, 'senza una copia di sicurezza il pulsante non si vede');

            // --- Con una copia (più crediti, una carta in più, un mazzo in più) ---
            await page.evaluate((chiave) => {
                const copia = JSON.parse(JSON.stringify(SaveManager.load()));
                copia.currency.credits += 900;
                copia.collection = Object.assign({}, copia.collection, { 7: 2 });
                copia.decks = copia.decks.concat([{ id: 'extra-prova', name: 'Prova', main: [], extra: [] }]);
                copia.player.lastSaved = new Date(Date.now() - 3600 * 1000).toISOString();
                localStorage.setItem(chiave, JSON.stringify({ conservataIl: new Date().toISOString(), data: copia }));
                RecuperoCopia.monta(document.getElementById('recuperoCopiaMount'));
            }, CHIAVE);
            const pulsante = page.locator('#recuperoCopiaMount .rc-apri');
            assert(await pulsante.isVisible(), 'con una copia il pulsante compare');

            // --- Il riquadro e i numeri ---
            await pulsante.click();
            await page.waitForSelector('#recuperoCopia .rc-box');
            const testo = await page.locator('#recuperoCopia').innerText();
            assert(/Modifiche non sincronizzate/.test(testo), 'il titolo spiega di cosa si tratta');
            const righe = await page.evaluate(() => [...document.querySelectorAll('#recuperoCopia .rc-riga')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
            const rigaCrediti = righe.find((r) => /^Crediti/.test(r)) || '';
            assert(/\+900/.test(rigaCrediti), 'la riga dei crediti mostra +900: ' + rigaCrediti);
            const rigaMazzi = righe.find((r) => /^Mazzi/.test(r)) || '';
            assert(/\+1/.test(rigaMazzi), 'la riga dei mazzi mostra +1: ' + rigaMazzi);

            // --- Responsive: dentro lo schermo, nessuno scorrimento orizzontale ---
            const misure = async () => page.evaluate(() => {
                const b = document.querySelector('#recuperoCopia .rc-box').getBoundingClientRect();
                const az = document.querySelector('#recuperoCopia .rc-azioni').getBoundingClientRect();
                return { l: b.left, r: b.right, t: b.top, b: b.bottom, vw: innerWidth, vh: innerHeight, azB: az.bottom, scrollX: document.documentElement.scrollWidth > innerWidth + 1 };
            });
            for (const [w, h] of [[1280, 800], [390, 844], [844, 390], [360, 640]]) {
                await page.setViewportSize({ width: w, height: h });
                await page.waitForTimeout(150);
                const m = await misure();
                assert(m.l >= -0.5 && m.r <= m.vw + 0.5 && m.t >= -0.5 && m.b <= m.vh + 0.5, `${w}x${h}: il riquadro esce dallo schermo ${JSON.stringify(m)}`);
                assert(m.azB <= m.vh + 0.5, `${w}x${h}: i pulsanti devono restare visibili`);
                assert(!m.scrollX, `${w}x${h}: scorrimento orizzontale`);
            }
            await page.setViewportSize({ width: 1280, height: 800 });

            // --- Ripristino: due tocchi ---
            const bottoneRipristina = page.locator('#recuperoCopia .rc-btn--ok');
            await bottoneRipristina.click();
            assert(await page.evaluate(() => SaveManager.load().currency.credits) === prima, 'il primo tocco non cambia nulla');
            await bottoneRipristina.click();
            await page.waitForFunction((n) => SaveManager.load().currency.credits === n, prima + 900, { timeout: 8000 });
            const dopo = await page.evaluate((chiave) => ({
                carta7: SaveManager.load().collection[7],
                copiaOra: CloudSync.copiaDivergente().data.currency.credits
            }), CHIAVE);
            assert(dopo.carta7 === 2, 'la copia è diventata il salvataggio (la carta in più c\'è)');
            assert(dopo.copiaOra === prima, 'il salvataggio di prima è stato conservato al posto della copia: ' + dopo.copiaOra);
            await page.waitForSelector('#recuperoCopia .rc-esito--ok');

            // --- Scarto: due tocchi, il pulsante sparisce ---
            await page.evaluate(() => document.querySelector('#recuperoCopia .rc-azioni .rc-btn--ok').click && 0);
            await page.keyboard.press('Escape');
            await page.waitForSelector('#recuperoCopia', { state: 'detached' });
            await page.evaluate(() => RecuperoCopia.monta(document.getElementById('recuperoCopiaMount')));
            await page.locator('#recuperoCopiaMount .rc-apri').click();
            const scarta = page.locator('#recuperoCopia .rc-btn--no');
            await scarta.click();
            assert(await page.evaluate(() => !!CloudSync.copiaDivergente()), 'il primo tocco non scarta');
            await scarta.click();
            await page.waitForSelector('#recuperoCopia', { state: 'detached' });
            assert(await page.evaluate(() => !CloudSync.copiaDivergente()), 'la copia è stata scartata');
            const nascosto = await page.evaluate(() => getComputedStyle(document.getElementById('recuperoCopiaMount')).display === 'none');
            assert(nascosto, 'dopo lo scarto il pulsante sparisce');
        } finally {
            await ctx.close();
        }
    }
};
