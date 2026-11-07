const net = require('net');
const path = require('path');

// "Annulla" nel modale della console KaibaCorp (2026-11-07): interrompe il collegamento al server, chiude il modale, lascia la
// sala com'era (pulsanti di nuovo attivi, nessun errore rosso) e non lascia socket aperti. Si prova con un server che accetta la
// connessione e non risponde mai, quindi il collegamento resta appeso finche' non lo si annulla. Vale anche il tasto Esc, e dopo
// un annullamento si puo' riprovare.
const RADICE = path.join(__dirname, '..', '..');
const URL = 'file:///' + path.join(RADICE, 'multiplayer.html').replace(/\\/g, '/') + '?modo=duello';

module.exports = {
    standalone: true,
    name: 'Multiplayer: Annulla nel modale di connessione interrompe il collegamento e libera la sala',
    async run(t) {
        const aperti = new Set();
        // `resume()`: senza leggere i dati il flusso resta in pausa e Node non vede mai la chiusura del socket ('close' non scatta).
        const muto = net.createServer((s) => { aperti.add(s); s.on('close', () => aperti.delete(s)); s.on('error', () => {}); s.resume(); });
        await new Promise((r) => muto.listen(0, '127.0.0.1', r));
        const porta = muto.address().port;
        const ctx = await t.browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
        await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await ctx.newPage();
        try {
            await page.goto(URL);
            await page.waitForSelector('#mpCreateBtn');
            await page.evaluate((p) => { document.getElementById('mpServerUrl').value = 'ws://127.0.0.1:' + p; }, porta);

            for (const come of ['pulsante', 'esc', 'ancora-il-pulsante']) {
                await page.click('#mpCreateBtn');
                await page.waitForSelector('#mpTermModal #mpTermAnnulla', { timeout: 10000 });
                await page.waitForTimeout(600);
                if (come === 'esc') await page.keyboard.press('Escape');
                else await page.click('#mpTermAnnulla');
                // Il modale sparisce subito, senza aspettare la scenetta ne' il lampo rosso.
                await page.waitForSelector('#mpTermModal', { state: 'detached', timeout: 3000 });
                const m = await page.evaluate(() => ({
                    stato: document.getElementById('mpStatus').textContent,
                    errore: document.getElementById('mpStatus').classList.contains('mp-status-error'),
                    creaAttivo: !document.getElementById('mpCreateBtn').disabled,
                    scrollBloccato: document.body.classList.contains('mp-term-aperto')
                }));
                t.assert(/annullata/i.test(m.stato) && !m.errore, `${come}: deve dire "Connessione annullata" senza errore rosso (${JSON.stringify(m)})`);
                t.assert(m.creaAttivo, `${come}: il pulsante di apertura stanza deve tornare attivo`);
                t.assert(!m.scrollBloccato, `${come}: la pagina deve tornare scorrevole`);
                // Il socket in apertura e' stato chiuso: il server non ne vede piu' di aperti.
                // Il server se ne accorge in modo asincrono: si aspetta fino a 3 secondi invece di un tempo fisso.
                const t0 = Date.now();
                while (aperti.size > 0 && Date.now() - t0 < 3000) await page.waitForTimeout(100);
                t.assert(aperti.size === 0, `${come}: restano ${aperti.size} socket aperti dopo l'annullamento`);
            }
        } finally {
            await ctx.close();
            aperti.forEach((s) => s.destroy());
            muto.close();
        }
    }
};
