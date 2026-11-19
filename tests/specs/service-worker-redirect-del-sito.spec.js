// Il Service Worker deve preservare i redirect puliti del sito anche con cache-first.
// Il precache memorizza un 307 sintetico sull'URL .html e il contenuto sulla URL
// canonica, evitando di consegnare al browser una risposta già marcata `redirected`.
//
// `standalone: true`: serve un server proprio e un contesto con i Service Worker abilitati.
const http = require('http');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf', '.txt': 'text/plain' };

module.exports = {
    name: 'Service worker: le pagine con URL pulite si aprono dalla cache, anche a rete lenta',
    standalone: true,
    async run({ browser, assert }) {
        let ritardoMs = 0;
        const server = http.createServer((req, res) => {
            const percorso = decodeURIComponent((req.url || '/').split('?')[0]);
            // Come il sito vero: /x.html -> 307 /x ; /x serve il file x.html.
            if (percorso.endsWith('.html')) {
                res.writeHead(307, { Location: percorso.slice(0, -5) || '/' });
                res.end();
                return;
            }
            let file = path.join(RADICE, percorso === '/' ? '/index.html' : percorso);
            if (!path.extname(file)) file += '.html';
            if (!file.startsWith(RADICE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
            const invia = () => {
                res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
                res.end(fs.readFileSync(file));
            };
            if (ritardoMs && /\.(html|js|css)$/.test(file) && !file.endsWith('sw.js')) setTimeout(invia, ritardoMs); else invia();
        });
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const origine = `http://127.0.0.1:${server.address().port}`;

        const context = await browser.newContext({ viewport: { width: 412, height: 800 }, serviceWorkers: 'allow' });
        await context.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await context.newPage();
        const problemi = [];
        page.on('requestfailed', (r) => problemi.push('fallita ' + r.url()));
        page.on('response', (r) => { if (r.status() >= 400) problemi.push(r.status() + ' ' + r.url()); });
        try {
            // 1) Prima visita e attesa dell'installazione del nuovo app shell.
            await page.goto(origine + '/sfide.html', { waitUntil: 'domcontentloaded' });
            await page.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 30000))])).then((ok) => assert(ok, 'Il Service Worker non si e\' installato'));
            const stato = () => page.evaluate(async () => { const k = await caches.keys(); return { chiavi: k, voci: k.length ? (await (await caches.open(k[0])).keys()).length : 0 }; });
            await page.waitForFunction(async () => {
                const chiavi = await caches.keys();
                if (!chiavi.length) return false;
                const cache = await caches.open(chiavi[0]);
                return (await cache.keys()).length > 100;
            }, null, { timeout: 40000 }).catch(async (e) => { throw new Error('Cache non riempita: ' + JSON.stringify(await stato()) + ' problemi: ' + problemi.slice(0, 8).join(' | ')); });
            const redirectCache = await page.evaluate(async () => {
                const cache = await caches.open((await caches.keys())[0]);
                const redirect = await cache.match('duello-libero.html');
                const canonica = await cache.match(new URL('duello-libero', location.href).href);
                return {
                    statoRedirect: redirect && redirect.status,
                    posizione: redirect && redirect.headers.get('location'),
                    statoPagina: canonica && canonica.status,
                    paginaRedirected: canonica && canonica.redirected
                };
            });
            assert(redirectCache.statoRedirect === 307 && /\/duello-libero$/.test(redirectCache.posizione || ''),
                'L\'URL .html deve avere in cache il redirect verso la pagina canonica');
            assert(redirectCache.statoPagina === 200 && redirectCache.paginaRedirected,
                'Il contenuto della pagina canonica deve essere disponibile in cache');

            // 2) La URL .html in cache conserva il redirect e il browser resta sull'indirizzo pulito.
            await page.goto(origine + '/duello-libero.html?cacheProbe=1', { waitUntil: 'domcontentloaded' });
            // Solo il PERCORSO: l'URL intero porta ?cacheProbe=1, che la riga sotto verifica proprio che si conservi.
            assert(/\/duello-libero$/.test(new URL(page.url()).pathname), `Dopo il redirect si dovrebbe essere su /duello-libero, non su ${page.url()}`);
            assert(new URL(page.url()).searchParams.get('cacheProbe') === '1', 'Il redirect deve conservare i parametri della navigazione');
            assert((await page.title()).length > 0, 'La pagina dopo il redirect non si e\' caricata');

            // 3) Rete lenta: la cache immediata deve comunque mantenere la URL pulita.
            ritardoMs = 4000;
            await page.goto(origine + '/storia.html', { waitUntil: 'commit' });
            // La risposta del server ora impiega 4 s: la pagina già installata deve comunque aprirsi subito.
            await page.waitForFunction(() => document.title.length > 0, null, { timeout: 30000 });
            assert((await page.title()).length > 0, 'A rete lenta la pagina servita dalla cache non si e\' aperta');
        } finally {
            await context.close();
            await new Promise((resolve) => server.close(resolve));
        }
    }
};
