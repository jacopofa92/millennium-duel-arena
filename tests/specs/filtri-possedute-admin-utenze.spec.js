const path = require('path');
const { creaFintoCloud } = require('../helpers/finto-cloud');
const url = (file) => 'file:///' + path.join(__dirname, '../..', file).replace(/\\/g, '/');

module.exports = {
    name: 'Solo possedute nei due cataloghi e gestione account con note persistenti',
    standalone: true,
    async run({ browser, assert }) {
        const { cloud, collega } = creaFintoCloud();
        cloud.profili = [
            { id: 'utente-prova', email: 'admin@prova.it', status: 'approved', is_admin: true },
            { id: 'giocatore', email: 'giocatore@prova.it', status: 'approved', is_admin: false }
        ];
        const context = await browser.newContext({ viewport: { width: 412, height: 900 }, serviceWorkers: 'block' });
        await collega(context);
        const page = await context.newPage();
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await page.goto(url('admin.html'));
            const row = () => page.locator('#adminUsersList .admin-row').filter({ hasText: 'giocatore@prova.it' });
            await row().getByRole('button', { name: 'Sospendi', exact: true }).waitFor();
            const nota = 'Contattato per assistenza <nessun markup>.';
            await row().locator('textarea').fill(nota);
            await row().getByRole('button', { name: 'Sospendi', exact: true }).click();
            await row().getByRole('button', { name: 'Riattiva', exact: true }).waitFor();
            assert(cloud.profili[1].status === 'suspended', 'Sospensione persistita nel cloud');
            assert(await row().locator('textarea').inputValue() === nota, 'Cambio stato conserva la bozza delle note');
            await row().getByRole('button', { name: 'Salva note', exact: true }).click();
            await page.waitForFunction(() => document.getElementById('adminGlobalStatus').textContent.includes('Note salvate'));
            await page.reload();
            await row().locator('textarea').waitFor();
            assert(await row().locator('textarea').inputValue() === nota, 'Note ritrovate dopo ricaricamento');
            await row().getByRole('button', { name: 'Riattiva', exact: true }).click();
            await row().getByRole('button', { name: 'Sospendi', exact: true }).waitFor();
            assert(cloud.profili[1].status === 'approved', 'Riattivazione persistita');
            const admin = page.locator('#adminUsersList .admin-row').filter({ hasText: 'admin@prova.it' });
            assert(await admin.getByRole('button', { name: 'Sospendi', exact: true }).count() === 0, 'Admin protetto da sospensione accidentale');

            // Una sola carta posseduta: verifica la selezione reale, non soltanto lo stato del checkbox.
            for (const file of ['cartoteca.html', 'creazione-deck.html']) {
                await page.goto(url(file));
                const editor = file === 'creazione-deck.html';
                if (editor) await page.locator('#newDeckBtn').click();
                await page.waitForFunction(() => window.SaveManager && typeof cardDatabase !== 'undefined');
                await page.evaluate(() => {
                    const id = cardDatabase.find((c) => c.type === 'monster').id;
                    SaveManager.getOwnedCount = (cardId) => Number(cardId) === Number(id) ? 1 : 0;
                });
                const owned = page.locator(editor ? '#editorOwnedOnly' : '[data-ct="ownedOnly"]');
                await page.locator(editor ? '#editorFilterToggleBtn' : '[data-ct="filterToggleBtn"]').click();
                await owned.check();
                const grid = editor ? '#editorResultsGrid' : '[data-ct="cartotecaGrid"]';
                await page.waitForFunction((s) => document.querySelector(s).querySelectorAll('.card').length === 1, grid);
                assert(await owned.isChecked(), file + ': filtro attivo');
                await page.locator(editor ? '#editorResetBtn' : '[data-ct="resetBtn"]').click();
                assert(!await owned.isChecked(), file + ': azzera spegne il filtro');
                await page.waitForFunction((s) => document.querySelector(s).querySelectorAll('.card').length > 1, grid);
            }
            // Un account già entrato viene fermato alla riconferma online,
            // senza attendere che scada il marcatore di accesso recente.
            cloud.profili[0].is_admin = false;
            cloud.profili[0].status = 'suspended';
            await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
            await page.waitForURL(/index\.html\?blocked=suspended/);
            const messaggio = await page.evaluate(async () => {
                try { await CloudSync.signIn('admin@prova.it', 'prova'); return ''; }
                catch (e) { return e.message; }
            });
            assert(messaggio.includes('sospeso'), 'Il login spiega la sospensione');
            assert(errori.length === 0, 'Errori JavaScript: ' + errori.join(' | '));
        } finally { await context.close(); }
    }
};
