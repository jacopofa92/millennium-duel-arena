// La Cartoteca esiste in due forme: la pagina autonoma (cartoteca.html) e la vista dentro il menu (index.html).
// Questo spec fa le STESSE verifiche su tutte e due, usando solo selettori di classe comuni (mai id: le due forme li
// avevano diversi): e' la rete di sicurezza che permette di tenere UNA sola implementazione (js/ui/cartoteca-view.js).
//   caricamento a blocchi (300 carte, skeleton sparito), ricerca, azzeramento, filtro per tipo, filtro "con effetto"
//   (senza motore del duello), paginazione, scheda carta con la X che chiude, nessun errore di pagina.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const URL_PAGINA = 'file:///' + RADICE.replace(/\\/g, '/') + '/cartoteca.html';
const URL_MENU = 'file:///' + RADICE.replace(/\\/g, '/') + '/index.html';

async function verifica(page, assert, etichetta) {
    let passo = 'avvio';
    try { await verificaPassi(page, assert, etichetta, (p) => { passo = p; }); } catch (e) { throw new Error('[' + etichetta + ' / ' + passo + '] ' + e.message.split('\n')[0]); }
}

async function verificaPassi(page, assert, etichetta, segna) {
    const tile = '.cartoteca-grid .card:not(.card-skeleton)';
    const nTile = () => page.evaluate((s) => document.querySelectorAll(s).length, tile);
    const attendiTile = (n) => page.waitForFunction(([s, n]) => document.querySelectorAll(s).length === n, [tile, n], { timeout: 20000 });

    segna('1 caricamento');
    // 1) 300 carte per pagina, a blocchi, e lo skeleton se ne va
    await attendiTile(300);
    assert(await page.evaluate(() => document.querySelectorAll('.cartoteca-grid .card-skeleton').length) === 0, `[${etichetta}] lo skeleton deve sparire quando arrivano le carte vere`);
    const conteggio = await page.evaluate(() => (document.querySelector('.cartoteca-count') || {}).textContent || '');
    assert(/\d+\s+cart/.test(conteggio), `[${etichetta}] il badge "N carte" deve esserci (letto: "${conteggio}")`);
    const stato1 = await page.evaluate(() => (document.querySelector('.pager-status') || {}).textContent || '');
    assert(/Pagina\s+1\s+di\s+\d+/.test(stato1.replace(/\s+/g, ' ')), `[${etichetta}] la paginazione parte da pagina 1 (letto: "${stato1.trim().slice(0, 40)}")`);
    const primoUid = await page.evaluate((s) => document.querySelector(s).textContent.replace(/\s+/g, ' ').slice(0, 60), tile);   // le carte del catalogo non hanno uid: si confronta il testo

    segna('2 ricerca');
    // 2) ricerca per nome (con il ritardo di digitazione), poi azzeramento
    await page.fill('.filter-search input', 'drago bianco');
    await page.waitForFunction((s) => { const n = document.querySelectorAll(s).length; return n > 0 && n < 300; }, tile, { timeout: 8000 });
    const nomi = await page.evaluate((s) => Array.from(document.querySelectorAll(s + ' .card-name, ' + s + ' [class*="name"]')).slice(0, 3).map((e) => e.textContent), tile);
    assert(await nTile() > 0, `[${etichetta}] la ricerca "drago bianco" trova carte (nomi letti: ${nomi.join(' | ')})`);
    await page.click('.filter-toggle-btn');
    await page.waitForSelector('.filter-panel.open');
    await page.click('.filter-reset');
    await attendiTile(300);
    assert(await page.evaluate(() => document.querySelector('.filter-search input').value) === '', `[${etichetta}] "Azzera filtri" svuota la ricerca`);

    segna('3 tipo');
    // 3) filtro per tipo: solo Magie
    await page.click('.filter-chips .chip:has-text("Magia")');
    await page.waitForFunction((s) => { const t = document.querySelectorAll(s); return t.length > 0 && Array.from(t).every((e) => e.dataset.type === 'spell'); }, tile, { timeout: 8000 });
    assert(await page.evaluate(() => document.querySelector('.filter-toggle-badge').classList.contains('show')), `[${etichetta}] il badge dei filtri attivi si accende`);
    await page.click('.filter-reset');
    await attendiTile(300);

    segna('4 categoria');
    // 4) "Categoria Mostro: con effetto" — deve funzionare anche senza il motore del duello
    const etichettaEffetto = await page.evaluate(() => MONSTER_CATEGORY_LABELS.effect);
    await page.click(`.filter-chips .chip:text-is("${etichettaEffetto}")`);
    await page.waitForFunction((s) => { const t = document.querySelectorAll(s); return t.length > 0 && Array.from(t).every((e) => e.dataset.type === 'monster'); }, tile, { timeout: 8000 });
    assert(await nTile() > 0, `[${etichetta}] il filtro "${etichettaEffetto}" trova mostri`);
    await page.click('.filter-reset');
    await attendiTile(300);

    segna('5 pagina 2');
    // 5) pagina 2 col pulsante "successiva"
    await page.click('.cartoteca-pager.top .pager-btn[data-page="next"]');
    await page.waitForFunction((uid) => { const e = document.querySelector('.cartoteca-grid .card:not(.card-skeleton)'); return e && e.textContent.replace(/\s+/g, ' ').slice(0, 60) !== uid; }, primoUid, { timeout: 15000 });
    const stato2 = await page.evaluate(() => document.querySelector('.pager-status').textContent.replace(/\s+/g, ' '));
    assert(/Pagina\s+2\s+di/.test(stato2), `[${etichetta}] dopo "successiva" si e' a pagina 2 (letto: "${stato2.trim().slice(0, 40)}")`);

    segna('6 scheda');
    // 6) la scheda della carta si apre al tocco e la X la chiude
    await page.evaluate((s) => document.querySelector(s).click(), tile);
    await page.waitForSelector('.cd-backdrop.open', { timeout: 8000 });
    await page.click('.cd-close');
    await page.waitForFunction(() => !document.querySelector('.cd-backdrop.open'), null, { timeout: 5000 });
}

module.exports = {
    name: 'Cartoteca: pagina autonoma e vista del menu si comportano allo stesso modo',
    standalone: true,
    async run({ browser, assert }) {
        for (const forma of ['pagina', 'menu']) {
            const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
            const page = await context.newPage();
            const errori = [];
            page.on('pageerror', (e) => errori.push(e.message));
            await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.PAGE_LOADER_SKIP = true; });
            try {
                if (forma === 'pagina') {
                    await page.goto(URL_PAGINA, { waitUntil: 'load' });
                } else {
                    await page.goto(URL_MENU, { waitUntil: 'load' });
                    await page.waitForFunction(() => typeof showView === 'function', null, { timeout: 15000 });
                    await page.evaluate(() => showView('cartoteca'));
                }
                await verifica(page, assert, forma);
                assert(errori.length === 0, `[${forma}] nessun errore di pagina: ${errori.slice(0, 3).join(' | ')}`);
            } finally {
                await context.close();
            }
        }
    }
};
