// Il Service Worker non deve mai rispondere a una navigazione con una risposta "redirected".
//
// Il sito pubblicato (Cloudflare Workers) gira `/pagina.html` a `/pagina` con un 307. L'installazione scarica
// `pagina.html` seguendo il redirect, quindi in Cache Storage c'e' una risposta con `redirected: true`; il browser
// rifiuta una risposta cosi' per una navigazione (net::ERR_FAILED). In 1.4.74 la scadenza di rete serviva proprio
// quella copia al posto del redirect, e l'app mostrava "Pagina web non disponibile" su ogni pagina (visto sul
// telefono subito dopo il push). Qui un server che si comporta come Cloudflare, e il Service Worker VERO in un
// browser vero: con la rete pronta e con la rete lenta (scadenza che scatta).
//
// `standalone: true`: serve un server proprio e un contesto con i Service Worker abilitati.
const http = require('http');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf', '.txt': 'text/plain' };

module.exports = {
    name: 'Service worker: con i redirect del sito (.html -> senza estensione) le pagine si aprono, anche a rete lenta',
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
            // 1) Prima visita (passa dal redirect) e attesa dell'installazione: la cache si riempie di risposte "redirected".
            await page.goto(origine + '/sfide.html', { waitUntil: 'domcontentloaded' });
            await page.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 30000))])).then((ok) => assert(ok, 'Il Service Worker non si e\' installato'));
            const stato = () => page.evaluate(async () => { const k = await caches.keys(); return { chiavi: k, voci: k.length ? (await (await caches.open(k[0])).keys()).length : 0 }; });
            await page.waitForFunction(async () => {
                const chiavi = await caches.keys();
                if (!chiavi.length) return false;
                const cache = await caches.open(chiavi[0]);
                return (await cache.keys()).length > 100;
            }, null, { timeout: 40000 }).catch(async (e) => { throw new Error('Cache non riempita: ' + JSON.stringify(await stato()) + ' problemi: ' + problemi.slice(0, 8).join(' | ')); });
            const marcate = await page.evaluate(async () => {
                const cache = await caches.open((await caches.keys())[0]);
                const r = await cache.match('duello-libero.html');
                return !!r && r.redirected;
            });
            assert(marcate, 'Il caso da provare non si e\' creato: la copia in cache dovrebbe essere "redirected" (il server finto non redirige?)');

            // 2) Rete pronta: la navigazione a /pagina.html deve riuscire (il redirect lo segue il browser).
            await page.goto(origine + '/duello-libero.html', { waitUntil: 'domcontentloaded' });
            assert(/\/duello-libero$/.test(page.url()), `Dopo il redirect si dovrebbe essere su /duello-libero, non su ${page.url()}`);
            assert((await page.title()).length > 0, 'La pagina dopo il redirect non si e\' caricata');

            // 3) Rete lenta: scatta la scadenza e si serve la copia in cache, ma una navigazione non puo' ricevere
            // una risposta "redirected": il Service Worker la ricostruisce.
            ritardoMs = 4000;
            await page.goto(origine + '/storia.html', { waitUntil: 'commit' });
            // Con ~100 file e 1,5 s di scadenza ciascuno la pagina intera ci mette molto: basta che il documento sia arrivato.
            await page.waitForFunction(() => document.title.length > 0, null, { timeout: 30000 });
            assert((await page.title()).length > 0, 'A rete lenta la pagina servita dalla cache non si e\' aperta');
        } finally {
            await context.close();
            await new Promise((resolve) => server.close(resolve));
        }
    }
};
