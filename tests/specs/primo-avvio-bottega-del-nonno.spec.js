// Primo avvio (js/ui/onboarding.js + obbligaLezioneSeDaFare in index.html):
//  - durante la bottega del nonno c'e' uno sfondo FISSO dietro le scene (fra una scena e l'altra non riaffiora il login) e
//    suona la musica del Negozio;
//  - se l'app si riapre prima di aver concluso il primo avvio (nessun segno di sessione), la bottega riparte da ZERO invece
//    di saltare alla lezione; se invece il primo avvio e' appena finito in questa sessione, si va dritti alla lezione.
const path = require('path');

module.exports = {
    standalone: true,
    name: 'Primo avvio: sfondo fisso e musica del Negozio nella bottega, e ripartenza da zero se si riapre a meta\'',
    async run(t) {
        const RADICE = path.join(__dirname, '..', '..');
        const url = 'file:///' + RADICE.replace(/\\/g, '/') + '/index.html';
        const errori = [];

        const apri = async (conSegno) => {
            const ctx = await t.browser.newContext({ viewport: { width: 1100, height: 700 }, serviceWorkers: 'block' });
            const page = await ctx.newPage();
            page.on('pageerror', (e) => errori.push(e.message));
            await page.addInitScript((segno) => {
                window.AUTH_GATE_SKIP = true;
                try { if (segno) sessionStorage.setItem('ygoIntroInCorso', '1'); else sessionStorage.removeItem('ygoIntroInCorso'); } catch (e) { /* noop */ }
            }, conSegno);
            await page.goto(url);
            await page.waitForTimeout(2500);
            await page.evaluate(() => {
                const splash = document.getElementById('splashScreen');
                if (splash) splash.style.display = 'none';
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                SaveManager.setTutorial({ daFare: true });
                window.showMenu();
            });
            return { ctx, page };
        };

        // 1) App riaperta a meta' (nessun segno): riparte la bottega, con sfondo fisso e musica del Negozio, senza lasciare index.
        {
            const { ctx, page } = await apri(false);
            await page.waitForSelector('.ob-fondo-fisso', { timeout: 5000 });
            const stato = await page.evaluate(() => ({
                url: location.pathname,
                traccia: window.DuelMusic && DuelMusic.getTrack ? DuelMusic.getTrack() : null,
                fondoOpaco: getComputedStyle(document.querySelector('.ob-fondo-fisso')).backgroundColor,
                z: Number(getComputedStyle(document.querySelector('.ob-fondo-fisso')).zIndex)
            }));
            t.assert(/index\.html$/.test(stato.url), `La bottega riparte su index.html, non salta alla lezione (${stato.url})`);
            t.assert(/Duel Ground/.test(stato.traccia || ''), `Nella bottega suona la musica del Negozio (${stato.traccia})`);
            t.assert(stato.fondoOpaco && stato.fondoOpaco !== 'rgba(0, 0, 0, 0)' && stato.z > 0, `Lo sfondo fisso e' opaco e sopra il login: ${JSON.stringify(stato)}`);
            // Il login non si vede mai: sfondo fisso presente per tutto il tempo (si campiona per ~2 s).
            let sempre = true;
            for (let i = 0; i < 8; i++) { await page.waitForTimeout(250); sempre = sempre && await page.evaluate(() => !!document.querySelector('.ob-fondo-fisso')); }
            t.assert(sempre, 'Lo sfondo fisso resta per tutta la bottega');
            await ctx.close();
        }

        // 2) Primo avvio appena concluso in questa sessione (segno presente): si va dritti alla lezione col nonno.
        {
            const { ctx, page } = await apri(true);
            await page.waitForURL(/duelMonstersCore\.html.*mode=tutorial/, { timeout: 8000 });
            t.assert(true, 'Con il primo avvio concluso si va alla lezione');
            await ctx.close();
        }

        // 3) Il duello della lezione col nonno suona la musica dei duelli del primo arco dell'anime ("Preliminary Face-Off").
        {
            const ctx = await t.browser.newContext({ viewport: { width: 1100, height: 700 }, serviceWorkers: 'block' });
            const page = await ctx.newPage();
            page.on('pageerror', (e) => errori.push(e.message));
            await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
            await page.goto('file:///' + RADICE.replace(/\\/g, '/') + '/duelMonstersCore.html?mode=tutorial&character=solomonMuto&difficulty=Facile&field=citta.jpg');
            await page.waitForFunction(() => window.DuelMusic && DuelMusic.getTrack, null, { timeout: 20000 });
            const traccia = await page.evaluate(() => DuelMusic.getTrack());
            t.assert(/Preliminary Face-Off/.test(traccia), `Nel duello tutorial suona la musica dei duelli del primo arco (${traccia})`);
            await ctx.close();
        }

        t.assert(errori.length === 0, 'Errori JS: ' + errori.join(' | '));
    }
};
