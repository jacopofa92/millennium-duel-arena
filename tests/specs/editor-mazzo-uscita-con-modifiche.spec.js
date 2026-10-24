// Editor dei mazzi: uscire per sbaglio con modifiche non salvate (segnalato dall'utente: "sono uscito per errore e ho perso il
// deck"). Un tocco su un link che porta fuori dalla pagina (la freccia Indietro) chiede conferma SOLO se il mazzo e' cambiato
// rispetto all'apertura; "No" resta nell'editor con tutto com'era; "Si" esce. Con l'editor chiuso o senza modifiche niente domande.
const path = require('path');
const url = 'file:///' + path.join(__dirname, '..', '..', 'creazione-deck.html').replace(/\\/g, '/');

module.exports = {
    name: 'Editor mazzi: la freccia Indietro chiede conferma solo con modifiche non salvate',
    standalone: true,
    async run({ browser, assert }) {
        const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
        await context.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await context.newPage();
        try {
            await page.goto(url);
            await page.waitForFunction(() => typeof openEditor === 'function' && !!window.SaveManager);
            await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                openEditor({ id: 'prova', name: 'Prova', main: [], extra: [] });
                // Il click sul link verrebbe seguito: lo si ferma DOPO la nostra guardia (fase di bolla) e si conta.
                window.__navigazioni = 0;
                document.querySelector('.back-btn').addEventListener('click', (e) => { window.__navigazioni++; e.preventDefault(); });
            });
            const aperta = () => page.evaluate(() => document.getElementById('confirmBackdrop').classList.contains('open'));

            await page.click('.back-btn');
            assert(!(await aperta()), 'senza modifiche la freccia Indietro non deve fare domande');
            assert((await page.evaluate(() => window.__navigazioni)) === 1, 'senza modifiche il click deve passare');

            await page.evaluate(() => { document.getElementById('deckNameInput').value = 'Prova modificata'; });
            await page.click('.back-btn');
            assert(await aperta(), 'con modifiche non salvate la freccia Indietro deve chiedere conferma');
            assert((await page.evaluate(() => window.__navigazioni)) === 1, 'finche\' non si risponde il click non deve passare');

            await page.click('#confirmNoBtn');
            const dopoNo = await page.evaluate(() => ({ editor: document.getElementById('screenEditor').style.display !== 'none', nome: document.getElementById('deckNameInput').value }));
            assert(dopoNo.editor && dopoNo.nome === 'Prova modificata', 'dopo "No" si resta nell\'editor con le modifiche');

            // Tornando com'era (stesso nome) l'impronta coincide: niente piu' domande.
            await page.evaluate(() => { document.getElementById('deckNameInput').value = 'Prova'; });
            await page.click('.back-btn');
            assert(!(await aperta()), 'rimesso com\'era non ci sono piu\' modifiche da perdere');
        } finally {
            await context.close();
        }
    }
};
