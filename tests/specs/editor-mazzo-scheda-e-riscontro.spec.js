// Editor dei mazzi (creazione-deck.html), richiesta esplicita: vedere il
// dettaglio delle carte (quelle nel mazzo e quelle da aggiungere) come in
// Cartoteca, e un'aggiunta/rimozione "più evidente, con animazione e
// messaggio", gestita bene anche da telefono.
//
// Si prova sulla pagina vera, su desktop e su un telefono:
//  - un click/tocco su una carta dei risultati apre la scheda condivisa con
//    i pulsanti per il mazzo (su telefono è l'unico modo di aggiungere);
//  - aggiungere fa volare la carta, aggiorna il conteggio, e dà un
//    messaggio con "Annulla" che rimette tutto com'era;
//  - al limite di copie il pulsante si spegne e il motivo si LEGGE;
//  - toccare una riga del mazzo apre la scheda, il "−" toglie con messaggio;
//  - su telefono mazzo e ricerca stanno in due schede.
const path = require('path');
const url = 'file:///' + path.join(__dirname, '..', '..', 'creazione-deck.html').replace(/\\/g, '/');

async function prepara(browser, vista) {
    const context = await browser.newContext({ ...vista, serviceWorkers: 'block' });
    await context.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
    const page = await context.newPage();
    const errori = [];
    page.on('pageerror', (e) => errori.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => typeof openEditor === 'function' && !!window.SaveManager && !!window.CardDetail);
    // Una carta Limitata posseduta (per il pulsante spento) e una normale.
    const ids = await page.evaluate(() => {
        if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
        const normale = cardDatabase.find((c) => !c.extraDeck && c.type === 'monster' && getCardCopyLimit(c) >= 3);
        const limitata = cardDatabase.find((c) => !c.extraDeck && getCardCopyLimit(c) === 1);
        [normale, limitata].forEach((c) => SaveManager.addOwnedCards(c.id, 3));
        openEditor({ id: 'prova', name: 'Prova', main: [{ id: normale.id, qty: 1 }], extra: [] });
        return { normale: normale.id, limitata: limitata.id };
    });
    return { context, page, errori, ids };
}

module.exports = {
    name: 'Editor mazzi: scheda carta con azioni, volo, messaggio con Annulla, schede su telefono',
    standalone: true,
    async run({ browser, assert }) {
        for (const vista of [
            { nome: 'desktop', viewport: { width: 1366, height: 820 } },
            { nome: 'telefono', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
        ]) {
            const { context, page, errori, ids } = await prepara(browser, { viewport: vista.viewport, isMobile: vista.isMobile, hasTouch: vista.hasTouch });
            const n = vista.nome;
            const conta = () => page.evaluate(() => deckListCountLocal(editingDeck.main));
            try {
                if (n === 'telefono') {
                    const schede = await page.evaluate(() => ({
                        scheda: document.getElementById('screenEditor').dataset.scheda,
                        visibili: getComputedStyle(document.querySelector('.editor-tabs')).display !== 'none',
                        destra: getComputedStyle(document.querySelector('.editor-right')).display
                    }));
                    assert(schede.visibili && schede.scheda === 'mazzo' && schede.destra === 'none',
                        `${n}: un mazzo esistente apre sulla scheda "Il mio mazzo", con la ricerca nascosta: ${JSON.stringify(schede)}`);
                    await page.click('#tabCarteBtn');
                }

                // --- Dalla scheda: aggiungi, vola, messaggio, annulla ------
                await page.evaluate((id) => { document.getElementById('editorSearchInput').value = cardDatabase.find((c) => c.id === id).name; document.getElementById('editorSearchInput').dispatchEvent(new Event('input')); }, ids.normale);
                await page.click('#editorResultsGrid .card');
                await page.waitForSelector('.cd-backdrop.open .cd-azione--primaria');
                const prima = await conta();
                await page.click('.cd-azione--primaria');
                const volo = await page.evaluate(() => !!document.querySelector('.carta-in-volo'));
                assert(volo, `${n}: aggiungendo, una copia della carta vola verso il contatore`);
                assert(await conta() === prima + 1, `${n}: la carta è nel mazzo`);
                const messaggio = await page.evaluate(() => {
                    const toast = document.getElementById('toast');
                    const r = toast.getBoundingClientRect();
                    return {
                        testo: toast.innerText,
                        annulla: !!document.querySelector('#toast.show .toast-azione'),
                        larghezza: r.width,
                        altezza: r.height,
                        viewport: { larghezza: innerWidth, altezza: innerHeight }
                    };
                });
                assert(/aggiunta al Main Deck/.test(messaggio.testo) && messaggio.annulla, `${n}: messaggio di aggiunta con "Annulla": ${JSON.stringify(messaggio)}`);
                assert(messaggio.larghezza <= Math.min(560, messaggio.viewport.larghezza - 18) && messaggio.altezza <= 150,
                    `${n}: il messaggio Annulla deve essere una notifica compatta, non un pannello a schermo intero: ${JSON.stringify(messaggio)}`);
                const pulsanti = await page.evaluate(() => [...document.querySelectorAll('.cd-azione')].map((b) => b.textContent));
                assert(pulsanti.some((t) => /Togli una copia/.test(t)), `${n}: ora la scheda offre anche di togliere una copia: ${pulsanti}`);
                await page.click('#toast .toast-azione');
                assert(await conta() === prima, `${n}: "Annulla" toglie la copia appena aggiunta`);
                await page.keyboard.press('Escape');

                // --- Limite di copie: pulsante spento e motivo leggibile --
                await page.evaluate((id) => {
                    editingDeck.main.push({ id, qty: 1 });
                    renderEditorLists();
                    apriSchedaEditor(cardDatabase.find((c) => c.id === id));
                }, ids.limitata);
                const limite = await page.evaluate(() => ({
                    spento: document.querySelector('.cd-azione--primaria').disabled,
                    motivo: (document.querySelector('.cd-motivo') || {}).textContent || ''
                }));
                assert(limite.spento && /Limitata/.test(limite.motivo), `${n}: al limite il pulsante si spegne e il motivo si legge: ${JSON.stringify(limite)}`);
                await page.keyboard.press('Escape');

                // --- Righe del mazzo: tocco = scheda, "−" = togli ---------
                if (n === 'telefono') await page.click('#tabMazzoBtn');
                await page.click(`#mainDeckList .deck-row[data-card-id="${ids.normale}"] .deck-row-name`);
                await page.waitForSelector('.cd-backdrop.open');
                assert(await page.evaluate(() => document.querySelector('.cd-backdrop.open .cd-name').textContent) ===
                    await page.evaluate((id) => cardDatabase.find((c) => c.id === id).name, ids.normale), `${n}: toccare una riga apre la scheda di quella carta`);
                await page.keyboard.press('Escape');
                const primaTolta = await conta();
                await page.click(`#mainDeckList .deck-row[data-card-id="${ids.normale}"] .deck-row-remove`);
                assert(await conta() === primaTolta - 1, `${n}: il "−" toglie una copia`);
                const tolta = await page.evaluate(() => document.getElementById('toast').innerText);
                assert(/tolta dal Main Deck/.test(tolta) && /non è più nel mazzo/.test(tolta), `${n}: messaggio di rimozione dell'ultima copia: ${tolta}`);
                await page.click('#toast .toast-azione');
                await page.waitForTimeout(260);
                assert(await conta() === primaTolta, `${n}: "Annulla" rimette la copia tolta`);
                assert(!errori.length, `${n}: errori nella pagina: ${errori.join(' | ')}`);
            } finally {
                await context.close();
            }
        }
    }
};
