// Il cancello lato server (worker/gate.mjs): chi non e' approvato non riceve il gioco. Prova il Worker senza rete e senza
// Cloudflare: ASSETS e Supabase sono finti, il resto (cookie firmato, percorsi pubblici/riservati, /__acc) e' il codice vero.
const path = require('path');
const { pathToFileURL } = require('url');

module.exports = {
    standalone: true,
    name: 'Cancello: senza cookie niente motore del duello, con account non approvato niente cookie, cookie falsi o scaduti respinti',
    async run(t) {
        const RADICE = path.join(__dirname, '..', '..');
        const G = await import(pathToFileURL(path.join(RADICE, 'worker', 'gate.mjs')).href);
        const { elencoPubblico } = require(path.join(RADICE, 'scripts', 'elenco-pubblico.js'));
        const SEGRETO = 'segreto-di-prova-0123456789';
        const elenco = elencoPubblico(RADICE);

        // 0) Cio' che deve restare RISERVATO (il motore e le altre pagine) non e' fra i file pubblici; l'accesso si'.
        const riservati = ['/duelMonstersCore.html', '/js/engine/duel-engine.js', '/js/engine/card-effects.js', '/js/ai/ai-hard.js', '/js/data/cards-data.generated.js', '/cartoteca.html', '/negozio.html', '/js/modes/caccia-mode.js'];
        riservati.forEach((p) => t.assert(!G.eAperto(p, { pubblici: elenco }), `${p} deve richiedere l'accesso`));
        ['/', '/index.html', '/index', '/js/cloud/cloud-sync.js', '/js/vendor/supabase.min.js', '/manifest.json', '/sw.js', '/images/ui/prova'].forEach((p) => t.assert(G.eAperto(p, { pubblici: elenco }), `${p} deve essere consegnabile per fare l'accesso`));

        // 1) Cookie: firma, scadenza, manomissione, segreto sbagliato.
        const ID = '11111111-2222-3333-4444-555555555555';
        const adesso = Math.floor(Date.now() / 1000);
        const buono = await G.creaCookie(SEGRETO, ID, adesso + 600);
        t.assert(await G.cookieValido(SEGRETO, buono), 'Un cookie firmato e non scaduto deve valere');
        t.assert(!(await G.cookieValido(SEGRETO, await G.creaCookie(SEGRETO, ID, adesso - 5))), 'Un cookie scaduto non deve valere');
        t.assert(!(await G.cookieValido('altro-segreto', buono)), 'Un cookie firmato con un altro segreto non deve valere');
        const [a, b, c] = buono.split('.');
        t.assert(!(await G.cookieValido(SEGRETO, `${a}.${Number(b) + 99999}.${c}`)), 'Cambiare la scadenza invalida la firma');
        t.assert(!(await G.cookieValido(SEGRETO, `22222222-2222-3333-4444-555555555555.${b}.${c}`)), 'Cambiare l\'utente invalida la firma');
        t.assert(!(await G.cookieValido(SEGRETO, '')) && !(await G.cookieValido(SEGRETO, 'abc')) && !(await G.cookieValido('', buono)), 'Cookie vuoto, malformato o senza segreto: no');

        // 2) Il Worker sulle richieste ai file.
        G.azzeraElencoPerTest();
        const assets = { fetch: async (req) => {
            const p = new URL(req.url).pathname;
            if (p === '/_pubblici.json') return new Response(JSON.stringify({ pubblici: elenco }));
            return new Response('contenuto ' + p, { headers: { 'ETag': '"x"' } });
        } };
        const env = { ASSETS: assets, COOKIE_SECRET: SEGRETO, SUPABASE_URL: 'https://db.finto', SUPABASE_ANON_KEY: 'anon' };
        const chiedi = (p, init = {}, e = env) => G.default.fetch(new Request('https://sito.test' + p, init), e);

        t.assert((await chiedi('/')).status === 200, 'La pagina di accesso e\' sempre consegnata');
        t.assert((await chiedi('/images/ui/prova')).status === 200, 'La grafica e\' aperta');
        const pag = await chiedi('/duelMonstersCore.html', { headers: { Accept: 'text/html' }, redirect: 'manual' });
        t.assert(pag.status === 302 && /\/index\.html\?accesso=1$/.test(pag.headers.get('Location')), `Una pagina riservata senza cookie riporta all'accesso (${pag.status} ${pag.headers.get('Location')})`);
        t.assert((await chiedi('/js/engine/duel-engine.js')).status === 401, 'Il motore senza cookie e\' un 401');
        t.assert((await chiedi('/_pubblici.json', { headers: { Cookie: 'ygo_acc=' + buono } })).status === 404, 'L\'elenco dei file pubblici non si consegna a nessuno');
        const con = await chiedi('/js/engine/duel-engine.js', { headers: { Cookie: 'ygo_acc=' + buono } });
        t.assert(con.status === 200 && (await con.text()).includes('duel-engine') && /private/.test(con.headers.get('Cache-Control')), 'Con il cookie giusto il motore si consegna, solo come contenuto privato');
        const falso = await chiedi('/js/engine/duel-engine.js', { headers: { Cookie: 'ygo_acc=' + await G.creaCookie('altro', ID, adesso + 600) } });
        t.assert(falso.status === 401, 'Un cookie firmato con un altro segreto e\' respinto');
        t.assert((await chiedi('/js/engine/duel-engine.js', {}, Object.assign({}, env, { COOKIE_SECRET: undefined }))).status === 503, 'Senza segreto configurato il cancello resta CHIUSO per i file riservati (mai aperto)');
        // Transizione: senza segreto E con CANCELLO_MODO = transizione il sito resta aperto (prima pubblicazione); con il segreto no.
        const transizione = await chiedi('/js/engine/duel-engine.js', {}, Object.assign({}, env, { COOKIE_SECRET: undefined, CANCELLO_MODO: 'transizione' }));
        t.assert(transizione.status === 200, 'In transizione, senza segreto, il sito resta aperto');
        t.assert((await chiedi('/js/engine/duel-engine.js', {}, Object.assign({}, env, { CANCELLO_MODO: 'transizione' }))).status === 401, 'In transizione ma CON il segreto il cancello e\' chiuso');
        t.assert((await chiedi('/', {}, Object.assign({}, env, { COOKIE_SECRET: undefined }))).status === 200, '...ma la pagina di accesso resta raggiungibile');

        // 3) /__acc: il cookie lo da' solo un account approvato.
        const realFetch = globalThis.fetch;
        const profili = { 'tok-ok': { id: ID, status: 'approved' }, 'tok-admin': { id: ID, status: 'pending', is_admin: true }, 'tok-attesa': { id: ID, status: 'pending' }, 'tok-rifiutato': { id: ID, status: 'rejected' } };
        globalThis.fetch = async (url, init) => {
            const tok = ((init && init.headers && init.headers.Authorization) || '').replace('Bearer ', '');
            if (!profili[tok]) return new Response('{}', { status: 401 });
            if (String(url).includes('/auth/v1/user')) return new Response(JSON.stringify({ id: ID }));
            return new Response(JSON.stringify([profili[tok]]));
        };
        try {
            const acc = (metodo, tok) => chiedi('/__acc', { method: metodo, headers: tok ? { Authorization: 'Bearer ' + tok } : {} });
            const ok = await acc('POST', 'tok-ok');
            const setCookie = ok.headers.get('Set-Cookie') || '';
            t.assert(ok.status === 200 && /ygo_acc=[^;]+;/.test(setCookie) && /HttpOnly/.test(setCookie) && /Secure/.test(setCookie) && /SameSite=Lax/.test(setCookie), `Un approvato riceve il cookie sicuro: ${ok.status} ${setCookie}`);
            const valore = /ygo_acc=([^;]+)/.exec(setCookie)[1];
            t.assert(await G.cookieValido(SEGRETO, valore), 'Il cookie emesso e\' valido');
            t.assert((await acc('POST', 'tok-admin')).status === 200, 'Un amministratore entra');
            const attesa = await acc('POST', 'tok-attesa');
            t.assert(attesa.status === 403 && !/ygo_acc=[^;]+;/.test(attesa.headers.get('Set-Cookie') || '').valueOf(), `Un account in attesa NON riceve il cookie: ${attesa.status}`);
            t.assert((await acc('POST', 'tok-rifiutato')).status === 403, 'Un account rifiutato NON riceve il cookie');
            t.assert((await acc('POST', 'tok-falso')).status === 401, 'Un token non valido e\' un 401');
            t.assert((await acc('POST', null)).status === 401, 'Senza token e\' un 401');
            t.assert((await acc('GET', 'tok-ok')).status === 405, 'Solo POST e DELETE');
            t.assert(/Max-Age=0/.test((await acc('DELETE', null)).headers.get('Set-Cookie') || ''), 'DELETE toglie il cookie');
        } finally {
            globalThis.fetch = realFetch;
        }
    }
};
