// Lo splash d'apertura con il Puzzle del Millennio in WebGL (js/ui/splash-webgl.js): parte alla prima apertura, mostra un progresso che
// non torna mai indietro e arriva al 100% solo col verdetto della pagina, poi cede il posto al resto; senza WebGL resta lo splash di
// sempre (nessun canvas, nessun errore) e si chiude lo stesso. Nessun raggio che gira (richiesta esplicita dell'utente).
const path = require('path');
const url = 'file:///' + path.join(__dirname, '..', '..', 'index.html').replace(/\\/g, '/');

module.exports = {
    name: 'Splash 3D: Puzzle in WebGL col progresso vero, e ripiego senza WebGL',
    standalone: true,
    async run({ browser, assert }) {
        // --- con WebGL
        const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1000, height: 600 } });
        const page = await ctx.newPage();
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await page.goto(url);
            await page.waitForFunction(() => window.SplashWebgl && SplashWebgl.attivo, null, { timeout: 8000 });
            const iniziale = await page.evaluate(() => ({
                canvas: !!document.querySelector('.splash-webgl-canvas'),
                raggi: !!document.querySelector('.splash-raggi'),
                classe: document.getElementById('splashScreen').classList.contains('splash-webgl-on'),
                errore: window.SPLASH_WEBGL_ERRORE || ''
            }));
            assert(iniziale.canvas && iniziale.classe && !iniziale.errore, `lo splash 3D deve partire senza errori di shader: ${JSON.stringify(iniziale)}`);
            assert(!iniziale.raggi, 'nessun raggio che gira attorno allo splash');
            // il progresso mostrato cresce e non torna mai indietro
            const valori = [];
            const t0 = Date.now();
            let nascosto = false;
            while (Date.now() - t0 < 25000 && !nascosto) {
                const s = await page.evaluate(() => { const sp = document.getElementById('splashScreen'); return { p: parseInt((document.querySelector('.splash-perc') || {}).textContent || '0', 10), nascosto: !sp || sp.style.display === 'none' || sp.classList.contains('splash-hidden') }; });
                valori.push(s.p); nascosto = s.nascosto;
                await page.waitForTimeout(250);
            }
            assert(nascosto, 'lo splash deve chiudersi da solo a caricamento finito');
            assert(valori.every((v, i) => i === 0 || v >= valori[i - 1]), `il progresso non deve mai tornare indietro: ${valori.join(',')}`);
            assert(Math.max(...valori) >= 99, `prima di chiudersi il progresso deve arrivare in fondo: max ${Math.max(...valori)}`);
            assert(errori.length === 0, `errori di pagina: ${errori.join(' | ')}`);
        } finally { await ctx.close(); }

        // --- interruttore di emergenza: ?splash3d=0 spegne lo splash 3D (e lo ricorda), ?splash3d=1 lo riaccende
        const ctx3 = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1000, height: 600 } });
        const page3 = await ctx3.newPage();
        try {
            await page3.goto(url + '?splash3d=0');
            await page3.waitForTimeout(800);
            const spento = await page3.evaluate(() => ({ attivo: !!(window.SplashWebgl && SplashWebgl.attivo), canvas: !!document.querySelector('.splash-webgl-canvas'), mem: localStorage.getItem('ygoSplash3D') }));
            assert(!spento.attivo && !spento.canvas && spento.mem === '0', `?splash3d=0 deve spegnerlo e ricordarlo: ${JSON.stringify(spento)}`);
            await page3.evaluate(() => sessionStorage.clear());
            await page3.goto(url);   // senza parametro: resta spento (memoria del dispositivo)
            await page3.waitForTimeout(800);
            assert(!(await page3.evaluate(() => !!document.querySelector('.splash-webgl-canvas'))), 'spento sul dispositivo: anche senza parametro resta lo splash di sempre');
            await page3.evaluate(() => sessionStorage.clear());
            await page3.goto(url + '?splash3d=1');
            await page3.waitForFunction(() => window.SplashWebgl && SplashWebgl.attivo, null, { timeout: 8000 });
            assert((await page3.evaluate(() => localStorage.getItem('ygoSplash3D'))) === null, '?splash3d=1 deve riaccenderlo e togliere la memoria');
        } finally { await ctx3.close(); }

        // --- senza WebGL: resta lo splash di sempre
        const ctx2 = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1000, height: 600 } });
        await ctx2.addInitScript(() => {
            const orig = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (tipo, ...resto) { return /webgl/.test(String(tipo)) ? null : orig.call(this, tipo, ...resto); };
        });
        const page2 = await ctx2.newPage();
        const errori2 = [];
        page2.on('pageerror', (e) => errori2.push(e.message));
        try {
            await page2.goto(url);
            await page2.waitForTimeout(1500);
            const s = await page2.evaluate(() => ({ attivo: !!(window.SplashWebgl && SplashWebgl.attivo), canvas: !!document.querySelector('.splash-webgl-canvas'), classe: document.getElementById('splashScreen').classList.contains('splash-webgl-on') }));
            assert(!s.attivo && !s.canvas && !s.classe, `senza WebGL lo splash 3D non deve attivarsi: ${JSON.stringify(s)}`);
            await page2.waitForFunction(() => { const sp = document.getElementById('splashScreen'); return !sp || sp.style.display === 'none' || sp.classList.contains('splash-hidden'); }, null, { timeout: 15000 });
            assert(errori2.length === 0, `errori di pagina senza WebGL: ${errori2.join(' | ')}`);
        } finally { await ctx2.close(); }
    }
};
