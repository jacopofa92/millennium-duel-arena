// La scheda di dettaglio di una carta è UNA sola in tutto il gioco
// (js/ui/card-detail.js, CardDetail.open). Prima ce n'erano quattro copie
// scritte a mano — Cartoteca, la sua copia nella vista del menu, Creazione
// Deck, e quella condivisa usata da Negozio e sbustamento — andate alla
// deriva fra loro: la copia del menu aveva perso il riquadro "Come si
// ottiene", e due copie mettevano il nome della carta in innerHTML senza
// proteggerlo (una carta personalizzata è testo libero dell'utente).
//
// Qui si prova, sulle pagine vere, che ognuna apre la scheda condivisa, e
// con un controllo sui sorgenti che nessuna pagina torni ad averne una sua.
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Scheda carta unica: Cartoteca, menu e Creazione Deck aprono la stessa',
    standalone: true,
    async run({ browser, assert }) {
        // --- Nessuna pagina ha più una scheda sua --------------------------
        const copie = fs.readdirSync(RADICE).filter((f) => f.endsWith('.html')).filter((f) =>
            /\.(card-modal|card-detail)-(backdrop|preview|info|name)\b/.test(fs.readFileSync(path.join(RADICE, f), 'utf8')));
        assert(!copie.length, 'pagine con una scheda carta scritta a mano invece di CardDetail: ' + copie.join(', '));

        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
        await context.addInitScript(() => {
            window.AUTH_GATE_SKIP = true;
            try { sessionStorage.setItem('ygoSplashShown', '1'); } catch (e) { /* storage bloccato */ }
        });
        const page = await context.newPage();
        const scheda = () => page.evaluate(() => {
            const b = document.querySelector('.cd-backdrop.open');
            return b ? { nome: b.querySelector('.cd-name').textContent, comeSiOttiene: !!b.querySelector('.cd-acquisition') } : null;
        });
        try {
            // --- Cartoteca ------------------------------------------------
            await page.goto(url('cartoteca.html'));
            await page.waitForFunction(() => !!(window.CardDetail && window.SaveManager), null, { timeout: 20000 });
            await page.evaluate(() => { if (!SaveManager.hasSave()) SaveManager.createNew('Tester'); });
            await page.waitForSelector('.cartoteca-grid .card');
            const nomeInGriglia = await page.evaluate(() => document.querySelector('.cartoteca-grid .card .card-name-text').textContent);
            await page.click('.cartoteca-grid .card');
            let s = await scheda();
            assert(s && s.nome === nomeInGriglia, `Cartoteca: il click apre la scheda condivisa della carta giusta (${JSON.stringify(s)} / ${nomeInGriglia})`);
            await page.keyboard.press('Escape');
            assert(!(await scheda()), 'Cartoteca: Esc chiude la scheda');

            // Il nome di una carta personalizzata è testo dell'utente.
            const xss = await page.evaluate(() => {
                CardDetail.open({ id: -1, name: '<img src=x onerror="window.__xss=1">Carta', type: 'spell', effect: '<b>grassetto</b>' });
                const b = document.querySelector('.cd-backdrop.open');
                return { img: !!b.querySelector('.cd-name img'), grassetto: !!b.querySelector('.cd-effect b'), testo: b.querySelector('.cd-name').textContent };
            });
            assert(!xss.img && !xss.grassetto && /<img/.test(xss.testo), 'il nome e l\'effetto di una carta vanno mostrati come testo, mai come HTML: ' + JSON.stringify(xss));
            await page.keyboard.press('Escape');

            // --- Creazione Deck: la scheda sta SOPRA la lista carte -------
            await page.goto(url('creazione-deck.html'));
            await page.waitForFunction(() => !!(window.CardDetail && typeof openCardDetailModal === 'function'), null, { timeout: 20000 });
            await page.evaluate(() => {
                document.getElementById('cardsModalBackdrop').classList.add('open');
                openCardDetailModal(cardDatabase.find((c) => c.id === 1));
            });
            s = await scheda();
            assert(s && s.nome === cardDatabase_nome1(), 'Creazione Deck: si apre la scheda condivisa');
            await page.keyboard.press('Escape');
            const dopoUno = await page.evaluate(() => ({ scheda: !!document.querySelector('.cd-backdrop.open'), lista: document.getElementById('cardsModalBackdrop').classList.contains('open') }));
            assert(!dopoUno.scheda && dopoUno.lista, 'Creazione Deck: il primo Esc chiude solo la scheda, la lista resta: ' + JSON.stringify(dopoUno));
            await page.keyboard.press('Escape');
            assert(!(await page.evaluate(() => document.getElementById('cardsModalBackdrop').classList.contains('open'))), 'il secondo Esc chiude la lista');

            // --- La Cartoteca (pagina dedicata, usata anche dal menu) ------
            await page.goto(url('cartoteca.html'));
            await page.waitForSelector('.cartoteca-grid .card:not(.card-skeleton)', { timeout: 30000 });
            await page.click('.cartoteca-grid .card:not(.card-skeleton)');
            await page.waitForSelector('.cd-backdrop.open', { timeout: 10000 });
            s = await scheda();
            assert(s && s.comeSiOttiene, 'Cartoteca: la scheda ha il riquadro "Come si ottiene": ' + JSON.stringify(s));
        } finally {
            await context.close();
        }

        function cardDatabase_nome1() { return 'Drago Bianco Occhi Blu'; }
    }
};
