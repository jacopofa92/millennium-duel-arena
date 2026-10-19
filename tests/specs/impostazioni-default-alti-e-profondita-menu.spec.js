// Due impostazioni richieste dall'utente:
//   - "Dettagli video" parte da "Alti" (prima "Normali"), anche per chi
//     aveva "Normali" scritto in cache o nel salvataggio solo perché era il
//     vecchio default; una scelta FATTA dal giocatore resta la sua;
//   - "Profondità del menu" (la parallasse di index.html) si spegne e si
//     riaccende dalle Impostazioni, accesa di default.
// standalone: ogni caso vuole un browser nuovo, con lo storage che
// prepara lui.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

async function contesto(browser, storage) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await ctx.addInitScript((s) => {
        if (sessionStorage.getItem('__preparato')) return;
        sessionStorage.setItem('__preparato', '1');
        window.AUTH_GATE_SKIP = true;
        Object.entries(s || {}).forEach(([k, v]) => localStorage.setItem(k, v));
    }, storage);
    return ctx;
}

const parX = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--par-x')) || 0);

async function muoviVersoAngolo(page) {
    await page.mouse.move(640, 400);
    await page.mouse.move(1270, 790, { steps: 8 });
    await page.waitForTimeout(1200);
}

module.exports = {
    name: 'Impostazioni: Dettagli video "Alti" di default, Profondità del menu attivabile',
    standalone: true,
    async run({ browser, assert }) {
        // --- Dettagli video ----------------------------------------------
        const casi = [
            { nome: 'mai scelto', storage: {}, atteso: 'alti' },
            { nome: '"Normali" ereditato dal vecchio default', storage: { ygoVideoDetail: 'normali' }, atteso: 'alti' },
            { nome: '"Normali" scelto dal giocatore', storage: { ygoVideoDetail: 'normali', ygoVideoDetailScelto: '1' }, atteso: 'normali' }
        ];
        for (const caso of casi) {
            const ctx = await contesto(browser, caso.storage);
            try {
                const page = await ctx.newPage();
                await page.goto(url('impostazioni.html'));
                await page.waitForFunction(() => !!window.VideoQuality);
                const r = await page.evaluate(() => ({
                    livello: VideoQuality.get(),
                    html: document.documentElement.dataset.dettagli,
                    premuto: document.querySelector('#videoDetailSeg [aria-pressed="true"]').dataset.livello
                }));
                assert(r.livello === caso.atteso && r.html === caso.atteso && r.premuto === caso.atteso,
                    `Dettagli video, ${caso.nome}: atteso ${caso.atteso}, trovato ${JSON.stringify(r)}`);
            } finally {
                await ctx.close();
            }
        }

        // Su un dispositivo touch (telefono, WebView dell'APK) il default è
        // "Normali": gli strati di field-ambience.js pesano ~3x sulla GPU
        // mobile (misurato). Una scelta esplicita vale comunque.
        for (const caso of [
            { nome: 'touch, mai scelto', storage: {}, atteso: 'normali' },
            { nome: 'touch, "Alti" scelto dal giocatore', storage: { ygoVideoDetail: 'alti', ygoVideoDetailScelto: '1' }, atteso: 'alti' }
        ]) {
            const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
            await ctx.addInitScript((s) => {
                window.AUTH_GATE_SKIP = true;
                Object.entries(s || {}).forEach(([k, v]) => localStorage.setItem(k, v));
            }, caso.storage);
            try {
                const page = await ctx.newPage();
                await page.goto(url('impostazioni.html'));
                await page.waitForFunction(() => !!window.VideoQuality);
                const livello = await page.evaluate(() => VideoQuality.get());
                assert(livello === caso.atteso, `Dettagli video, ${caso.nome}: atteso ${caso.atteso}, trovato ${livello}`);
            } finally {
                await ctx.close();
            }
        }

        // Il vecchio default dentro un SALVATAGGIO (senza il segno di scelta)
        // non deve riportare "Normali"; una scelta salvata sì.
        const ctxSalv = await contesto(browser, {});
        try {
            const page = await ctxSalv.newPage();
            await page.goto(url('impostazioni.html'));
            await page.waitForFunction(() => !!(window.SaveManager && window.VideoQuality));
            const r = await page.evaluate(() => {
                const base = SaveManager.createNew('Prova');
                base.settings = Object.assign({}, base.settings, { videoDetail: 'normali', videoDetailScelto: false });
                const ereditato = SaveManager.applyExternalSave(JSON.parse(JSON.stringify(base))).settings.videoDetail;
                const ereditatoVisto = VideoQuality.get();
                base.settings = Object.assign({}, base.settings, { videoDetail: 'normali', videoDetailScelto: true });
                const scelto = SaveManager.applyExternalSave(JSON.parse(JSON.stringify(base))).settings.videoDetail;
                return { ereditato, ereditatoVisto, scelto, sceltoVisto: VideoQuality.get() };
            });
            assert(r.ereditato === 'alti' && r.ereditatoVisto === 'alti', 'un "Normali" mai scelto nel salvataggio diventa "Alti": ' + JSON.stringify(r));
            assert(r.scelto === 'normali' && r.sceltoVisto === 'normali', 'un "Normali" scelto nel salvataggio resta: ' + JSON.stringify(r));

            // Scegliere dalla pagina accende il segno.
            await page.click('#videoDetailSeg [data-livello="normali"]');
            const dopo = await page.evaluate(() => ({ livello: VideoQuality.get(), segno: localStorage.getItem('ygoVideoDetailScelto') }));
            assert(dopo.livello === 'normali' && dopo.segno === '1', 'scegliere "Normali" dalle Impostazioni lo ricorda come scelta: ' + JSON.stringify(dopo));
        } finally {
            await ctxSalv.close();
        }

        // --- Profondità del menu -------------------------------------------
        const ctxMenu = await contesto(browser, {});
        try {
            const page = await ctxMenu.newPage();
            await page.goto(url('index.html'));
            await page.waitForFunction(() => !!window.Inclinazione);
            assert(await page.evaluate(() => Inclinazione.parallasseMenuAttiva()), 'la profondità del menu è accesa di default');
            await muoviVersoAngolo(page);
            assert(await parX(page) > 0.5, 'accesa, il menu segue il mouse');

            // Spenta (come fa l'interruttore della vista Impostazioni, nella
            // stessa pagina): il menu torna al centro e smette di seguire.
            await page.evaluate(() => Inclinazione.impostaParallasseMenu(false));
            // Il rientro è un rallentamento per fotogramma, e senza finestra
            // i fotogrammi sono più lenti: si aspetta il valore, non un tempo.
            await page.waitForFunction(() => Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--par-x')) || 0) < 0.05, null, { timeout: 8000 })
                .catch(() => {});
            assert(Math.abs(await parX(page)) < 0.05, 'spenta, il menu torna al centro: ' + await parX(page));
            await page.mouse.move(5, 5, { steps: 8 });
            await page.waitForTimeout(800);
            assert(Math.abs(await parX(page)) < 0.05, 'spenta, il menu non segue più il mouse: ' + await parX(page));

            // Resta spenta riaprendo il gioco, e l'interruttore lo mostra.
            await page.reload();
            await page.waitForFunction(() => !!window.Inclinazione);
            await muoviVersoAngolo(page);
            assert(Math.abs(await parX(page)) < 0.05, 'riaprendo, resta spenta: ' + await parX(page));
            const impostazioni = await ctxMenu.newPage();
            await impostazioni.goto(url('impostazioni.html'));
            await impostazioni.waitForFunction(() => !!window.Inclinazione);
            assert(await impostazioni.isChecked('#parallaxToggleInput') === false, 'l\'interruttore la mostra spenta');
            // Clic sull'elemento e non alle coordinate: per il primo secondo la
            // pagina ha sopra il velo di caricamento (js/ui/page-loader.js).
            await impostazioni.$eval('#parallaxToggleInput', (el) => el.click());
            assert(await impostazioni.evaluate(() => Inclinazione.parallasseMenuAttiva()), 'riaccesa dall\'interruttore');
            await page.reload();
            await page.waitForFunction(() => !!window.Inclinazione);
            await muoviVersoAngolo(page);
            assert(await parX(page) > 0.5, 'riaccesa, il menu torna a seguire il mouse');
        } finally {
            await ctxMenu.close();
        }
    }
};
