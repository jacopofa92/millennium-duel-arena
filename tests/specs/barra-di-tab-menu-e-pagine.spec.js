// La barra di tab del menu "app" (js/ui/menu-mobile.js, js/ui/tab-bar.js).
// =====================================================================
// Tre promesse:
//  1) il menu principale ha la veste a tab su OGNI schermo (telefono e desktop), senza scorrere di lato;
//  2) su telefono le pagine principali (Impostazioni, Sfide, Profilo, Negozio, Cartoteca) hanno la stessa barra, con la tab della loro
//     sezione accesa, e la barra NON copre il medaglione "Indietro" ne' l'ultimo contenuto (segnalato dall'utente su Impostazioni: la barra
//     copriva parte del box Regole di gioco e il pulsante Indietro);
//  3) su desktop le pagine NON hanno la barra (e' una cosa da telefono).
// `standalone`: serve index.html e le pagine, con finestre diverse da quella del duello.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + RADICE.replace(/\\/g, '/') + '/' + f;

async function apri(browser, opzioni, file) {
    const context = await browser.newContext(Object.assign({ serviceWorkers: 'block' }, opzioni));
    // Come in tutta la suite: il gate di accesso non si puo' superare davvero.
    await context.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
    const page = await context.newPage();
    await page.goto(url(file));
    await page.waitForTimeout(2800);
    return { context, page };
}

module.exports = {
    name: 'Barra di tab: menu a tab su ogni schermo, barra sulle pagine solo su telefono, senza coprire Indietro',
    standalone: true,
    async run({ browser, assert }) {
        // ---- 1) il menu, su desktop e su telefono
        for (const [nome, opz] of [
            ['desktop', { viewport: { width: 1280, height: 800 } }],
            ['telefono', { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true }]
        ]) {
            const { context, page } = await apri(browser, opz, 'index.html');
            try {
                await page.evaluate(() => {
                    const splash = document.getElementById('splashScreen');
                    if (splash) splash.style.display = 'none';
                    if (window.SaveManager && !SaveManager.hasSave()) SaveManager.createNew('Tester');
                    window.showMenu();
                });
                await page.waitForTimeout(600);
                const m = await page.evaluate(() => ({
                    tab: Array.from(document.querySelectorAll('#menuShell .mm-tab')).map((e) => e.textContent.trim()),
                    tessere: document.querySelectorAll('#menuShell .mm-tessera').length,
                    vecchie: document.querySelectorAll('#menuShell .menu-item').length,
                    extra: document.documentElement.scrollWidth - document.documentElement.clientWidth
                }));
                assert(m.tab.length === 5 && m.tessere > 0 && m.vecchie === 0, `Menu ${nome}: ${JSON.stringify(m)}`);
                assert(m.extra <= 1, `Il menu ${nome} scorre di lato di ${m.extra}px`);
            } finally { await context.close(); }
        }

        // ---- 2) le pagine su telefono
        const PAGINE = { 'impostazioni.html': 'Altro', 'sfide.html': 'Sfide', 'profilo.html': 'Altro', 'negozio.html': 'Carte', 'cartoteca.html': 'Carte' };
        for (const [file, tabAttesa] of Object.entries(PAGINE)) {
            const { context, page } = await apri(browser, { viewport: { width: 393, height: 780 }, isMobile: true, hasTouch: true }, file);
            try {
                await page.waitForSelector('.mm-barra', { timeout: 8000 });
                await page.evaluate(() => { document.querySelectorAll('.page-loader, #pageLoader').forEach((e) => e.remove()); });
                await page.evaluate(() => window.scrollTo(0, 1e7));
                await page.waitForTimeout(800);
                const r = await page.evaluate(() => {
                    const barra = document.querySelector('.mm-barra').getBoundingClientRect();
                    const back = document.querySelector('.topbar .back-btn');
                    const br = back ? back.getBoundingClientRect() : null;
                    const spazio = document.querySelector('.mm-spazio');
                    return {
                        attiva: (document.querySelector('.mm-tab--attiva') || {}).textContent,
                        barraTop: barra.top,
                        backBottom: br ? br.bottom : null,
                        backFisso: back ? getComputedStyle(back).position === 'fixed' : false,
                        spazio: !!spazio,
                        extra: document.documentElement.scrollWidth - document.documentElement.clientWidth
                    };
                });
                assert(new RegExp(tabAttesa, 'i').test(r.attiva || ''), `${file}: tab accesa "${r.attiva}", attesa ${tabAttesa}`);
                assert(r.spazio, `${file}: manca lo spazio in fondo (.mm-spazio): l'ultimo contenuto finirebbe sotto la barra`);
                if (r.backFisso) assert(r.backBottom <= r.barraTop + 0.5, `${file}: il medaglione Indietro (fondo ${r.backBottom}) e' coperto dalla barra (cima ${r.barraTop})`);
                assert(r.extra <= 1, `${file}: scorre di lato di ${r.extra}px`);
            } finally { await context.close(); }
        }

        // Toccare un'altra tab porta al menu su quella tab
        {
            const { context, page } = await apri(browser, { viewport: { width: 393, height: 780 }, isMobile: true, hasTouch: true }, 'impostazioni.html');
            try {
                await page.waitForSelector('.mm-barra', { timeout: 8000 });
                await page.evaluate(() => {
                    const t = Array.from(document.querySelectorAll('.mm-tab')).find((e) => /Carte/i.test(e.textContent));
                    t.click();
                });
                await page.waitForTimeout(1500);
                const dopo = await page.evaluate(() => ({ url: location.pathname.split('/').pop(), tab: sessionStorage.getItem('ygoMenuTab') }));
                assert(dopo.url === 'index.html' && dopo.tab === 'carte', `Il tocco su "Carte" doveva aprire il menu sulla tab Carte: ${JSON.stringify(dopo)}`);
            } finally { await context.close(); }
        }

        // ---- 3) desktop: nessuna barra sulle pagine
        {
            const { context, page } = await apri(browser, { viewport: { width: 1280, height: 800 } }, 'impostazioni.html');
            try {
                await page.waitForTimeout(800);
                const n = await page.evaluate(() => document.querySelectorAll('.mm-barra').length);
                assert(n === 0, `Su desktop le pagine non devono avere la barra di tab (trovate ${n})`);
            } finally { await context.close(); }
        }
    }
};
