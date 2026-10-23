// Avvio del duello su connessione lenta: copertura inline e campo giusto fin dall'<head>.
//
// Segnalato dall'utente: "si vede il field default, poi loading, poi stock". Il body veniva dipinto col campo di
// default prima che arrivasse lo script del loader (che sta nel body ed e' un file esterno), e il campo VERO
// (?field=) si applicava solo a fine pagina. Ora l'<head> contiene, INLINE: una copertura (`avvio-in-corso` su <html>)
// che il loader toglie quando prende il suo posto, e lo sfondo + il preload del campo richiesto.
//
// `standalone`: apre duelMonstersCore.html con ?field= diversi.
const path = require('path');

module.exports = {
    name: 'Duello: copertura d\'avvio e campo richiesto scritti nell\'<head>',
    standalone: true,
    async run({ browser, assert }) {
        const RADICE = path.join(__dirname, '..', '..');
        const url = (qs) => 'file:///' + RADICE.replace(/\\/g, '/') + '/duelMonstersCore.html' + qs;
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
        await context.addInitScript(() => {
            window.AUTH_GATE_SKIP = true;
            window.DUEL_FAST_OPENING = true;
            // Storia della classe sull'<html>: dev'essere aggiunta e poi tolta, in quest'ordine.
            window.__storiaCopertura = [];
            new MutationObserver(() => {
                const c = document.documentElement.classList.contains('avvio-in-corso');
                const s = window.__storiaCopertura;
                if (s[s.length - 1] !== c) s.push(c);
            }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
        });
        const page = await context.newPage();
        try {
            await page.goto(url('?field=anticoEgittoNotte_2.jpg'));
            await page.waitForFunction(() => !!document.getElementById('pageLoader'), null, { timeout: 20000 });
            const info = await page.evaluate(() => ({
                precarica: Array.from(document.querySelectorAll('head link[rel="preload"][as="image"]')).map((l) => l.getAttribute('href')),
                stileCampo: Array.from(document.querySelectorAll('head style')).map((s) => s.textContent).find((t) => /html body \{ background-image/.test(t)) || '',
                storia: window.__storiaCopertura,
                copertoOra: document.documentElement.classList.contains('avvio-in-corso')
            }));
            assert(info.precarica.some((h) => /images\/fields\/(mobile\/)?anticoEgittoNotte_2\.jpg$/.test(h)), `Il campo richiesto non e' precaricato: ${info.precarica.join(', ')}`);
            assert(!info.precarica.some((h) => /dirigibileKaibaCorp/.test(h)), 'Il campo di default non va scaricato se ne e\' richiesto un altro');
            assert(/anticoEgittoNotte_2\.jpg/.test(info.stileCampo), 'Lo sfondo del campo richiesto deve essere scritto subito, non a fine pagina');
            assert(info.storia.length >= 1 && info.storia[0] === true, 'La copertura d\'avvio deve esserci dal primo momento');
            assert(info.copertoOra === false, 'Il loader, quando nasce, deve togliere la copertura d\'avvio');
        } finally {
            await context.close();
        }

        // Un campo ritirato dal gioco ha il suo sostituto anche nel preload.
        const contesto2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
        await contesto2.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; });
        const p2 = await contesto2.newPage();
        try {
            await p2.goto(url('?field=kaibaStadium_1.jpg'));
            await p2.waitForFunction(() => !!document.getElementById('pageLoader'), null, { timeout: 20000 });
            const hrefs = await p2.evaluate(() => Array.from(document.querySelectorAll('head link[rel="preload"][as="image"]')).map((l) => l.getAttribute('href')));
            assert(hrefs.some((h) => /stadioKaiba\.jpg$/.test(h)), `Il campo ritirato non e' stato sostituito nel preload: ${hrefs.join(', ')}`);

            // Senza ?field= resta il campo di sempre.
            await p2.goto(url(''));
            await p2.waitForFunction(() => !!document.getElementById('pageLoader'), null, { timeout: 20000 });
            const hrefs2 = await p2.evaluate(() => Array.from(document.querySelectorAll('head link[rel="preload"][as="image"]')).map((l) => l.getAttribute('href')));
            assert(hrefs2.some((h) => /dirigibileKaibaCorp\.jpg$/.test(h)), 'Senza ?field= si precarica il campo di default');
        } finally {
            await contesto2.close();
        }
    }
};
