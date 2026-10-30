// La barra di tab del menu "app" (js/ui/menu-mobile.js, js/ui/tab-bar.js).
// =====================================================================
// Tre promesse:
//  1) il menu principale ha la veste a tab su OGNI schermo (telefono e desktop), senza scorrere di lato;
//  2) su telefono le pagine principali (senza la barra in alto: sparisce, resta il medaglione Indietro) (Impostazioni, Sfide, Profilo, Negozio, Cartoteca) hanno la stessa barra, con la tab della loro
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
                assert(m.tab.length === 4 && !m.tab.some((t) => /Sfide/i.test(t)) && m.tessere > 0 && m.vecchie === 0, `Menu ${nome}: ${JSON.stringify(m)}`);
                assert(m.extra <= 1, `Il menu ${nome} scorre di lato di ${m.extra}px`);
            } finally { await context.close(); }
        }

        // ---- 1b) swipe fra le tab del menu (eventi di tocco sintetici sulla lista: lo stesso percorso del dito)
        {
            const { context, page } = await apri(browser, { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true }, 'index.html');
            try {
                await page.evaluate(() => {
                    const splash = document.getElementById('splashScreen');
                    if (splash) splash.style.display = 'none';
                    if (window.SaveManager && !SaveManager.hasSave()) SaveManager.createNew('Tester');
                    sessionStorage.setItem('ygoMenuTab', 'duelli');
                    window.showMenu();
                });
                await page.waitForTimeout(500);
                const attiva = () => page.evaluate(() => (document.querySelector('.mm-tab--attiva') || {}).textContent.trim());
                const swipe = async (x1, x2, y) => {
                    await page.evaluate(([a, b, yy]) => {
                        const el = document.getElementById('menuList');
                        const mk = (t, x) => new TouchEvent(t, { bubbles: true, cancelable: true, touches: t === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: x, clientY: yy })], changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: yy })] });
                        el.dispatchEvent(mk('touchstart', a));
                        el.dispatchEvent(mk('touchmove', (a + b) / 2));
                        el.dispatchEvent(mk('touchend', b));
                    }, [x1, x2, y]);
                    await page.waitForTimeout(400);
                };
                assert(/Duelli/i.test(await attiva()), 'Si parte da Duelli');
                await swipe(320, 60, 400);
                assert(/Carte/i.test(await attiva()), 'Swipe verso sinistra: doveva aprire Carte');
                await swipe(320, 60, 400); await swipe(320, 60, 400);
                assert(/Altro/i.test(await attiva()), 'Dopo tre swipe a sinistra: doveva essere Altro');
                await swipe(320, 60, 400);
                assert(/Altro/i.test(await attiva()), 'All ultima tab lo swipe a sinistra non deve fare nulla');
                await swipe(60, 320, 400);
                assert(/Online/i.test(await attiva()), 'Swipe verso destra: doveva tornare a Online');
                await swipe(200, 240, 400);
                assert(/Online/i.test(await attiva()), 'Un gesto corto non deve cambiare tab');
                // Gesto piu' alto che largo: e'' uno scorrimento verticale, non uno swipe
                const prima = await attiva();
                await page.evaluate(() => {
                    const el = document.getElementById('menuList');
                    const T = (x, y) => new Touch({ identifier: 2, target: el, clientX: x, clientY: y });
                    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [T(200, 600)], changedTouches: [T(200, 600)] }));
                    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [T(130, 200)] }));
                });
                await page.waitForTimeout(300);
                assert((await attiva()) === prima, 'Uno scorrimento verticale non deve cambiare tab');
            } finally { await context.close(); }
        }

        // ---- 2) le pagine figlie su telefono: barra CONTESTUALE (madre > figlia selezionata ... opzioni), niente barra in alto
        const PAGINE = {
            'impostazioni.html': ['Altro', 'Impostazioni'], 'sfide.html': ['Duelli', 'Sfide'], 'profilo.html': ['Altro', 'Profilo'],
            'negozio.html': ['Carte', 'Negozio'], 'cartoteca.html': ['Carte', 'Cartoteca'],
            'duello-libero.html': ['Duelli', 'Duello Libero'], 'storia.html': ['Duelli', 'Storia']
        };
        for (const [file, [madreAttesa, figlioAtteso]] of Object.entries(PAGINE)) {
            const { context, page } = await apri(browser, { viewport: { width: 393, height: 780 }, isMobile: true, hasTouch: true }, file);
            try {
                await page.waitForSelector('.mm-barra', { timeout: 8000 });
                await page.evaluate(() => { document.querySelectorAll('.page-loader, #pageLoader').forEach((e) => e.remove()); });
                await page.waitForTimeout(800);
                await page.evaluate(() => window.scrollTo(0, 1e7));
                await page.waitForTimeout(800);
                const r = await page.evaluate(() => {
                    const barra = document.querySelector('.mm-barra').getBoundingClientRect();
                    const back = document.querySelector('.topbar .back-btn');
                    const br = back ? back.getBoundingClientRect() : null;
                    const av = document.querySelector('.mm-ctx-slot .dsw-avatar');
                    return {
                        ctx: document.querySelector('.mm-barra').classList.contains('mm-barra--ctx'),
                        madre: (document.querySelector('.mm-ctx-padre') || {}).textContent,
                        figlio: (document.querySelector('.mm-ctx-figlio') || {}).textContent,
                        tabAltre: document.querySelectorAll('.mm-barra .mm-tab').length,
                        barraTop: barra.top,
                        backBottom: br ? br.bottom : null,
                        backVisibile: !!(back && getComputedStyle(back).display !== 'none'),
                        spazio: !!document.querySelector('.mm-spazio'),
                        topbar: document.querySelector('.topbar').getBoundingClientRect().height,
                        titoloVisibile: Array.from(document.querySelectorAll('.topbar .topbar-title')).some((e) => e.getBoundingClientRect().height > 0),
                        avatarVisibile: !!(av && getComputedStyle(av).display !== 'none'),
                        badge: (() => { const e = document.querySelector('.mm-ctx-slot #resultCount'); return e && e.getBoundingClientRect().height > 0 ? e.textContent.trim() : ''; })(),
                        filtri: (() => { const f = document.querySelector('.cartoteca-filters'); return f ? f.getBoundingClientRect().top : null; })(),
                        extra: document.documentElement.scrollWidth - document.documentElement.clientWidth
                    };
                });
                assert(r.ctx && r.tabAltre === 0, file + ': la barra deve essere contestuale (niente tab del menu)');
                assert(new RegExp(madreAttesa, 'i').test(r.madre || ''), file + ': voce madre "' + r.madre + '", attesa ' + madreAttesa);
                assert(new RegExp(figlioAtteso, 'i').test(r.figlio || ''), file + ': voce figlia "' + r.figlio + '", attesa ' + figlioAtteso);
                assert(r.topbar <= 1 && !r.titoloVisibile, file + ': la barra in alto non deve esserci su telefono (alta ' + r.topbar + 'px)');
                assert(!r.avatarVisibile, file + ': il ritratto del giocatore non deve stare nella barra in basso');
                assert(r.spazio, file + ': manca lo spazio in fondo (.mm-spazio)');
                if (file === 'cartoteca.html') assert(/carte/i.test(r.badge), 'cartoteca.html: il badge con il numero di carte deve stare nella barra in basso');
                assert(!r.backVisibile, file + ': il medaglione Indietro flottante non serve piu (la voce madre della barra fa da Indietro)');
                if (r.filtri !== null) assert(r.filtri <= 1, file + ': i filtri sticky devono stare in cima (top ' + r.filtri + ')');
                assert(r.extra <= 1, file + ': scorre di lato di ' + r.extra + 'px');
            } finally { await context.close(); }
        }

        // Toccare la voce madre porta al menu su quella tab
        {
            const { context, page } = await apri(browser, { viewport: { width: 393, height: 780 }, isMobile: true, hasTouch: true }, 'cartoteca.html');
            try {
                await page.waitForSelector('.mm-ctx-padre', { timeout: 8000 });
                await page.evaluate(() => document.querySelector('.mm-ctx-padre').click());
                await page.waitForTimeout(1500);
                const dopo = await page.evaluate(() => ({ url: location.pathname.split('/').pop(), tab: sessionStorage.getItem('ygoMenuTab') }));
                assert(dopo.url === 'index.html' && dopo.tab === 'carte', 'Il tocco sulla voce madre (Carte) doveva aprire il menu sulla tab Carte: ' + JSON.stringify(dopo));
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
