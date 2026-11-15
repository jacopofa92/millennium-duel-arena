// Strategia della cache PWA verificata senza browser: esegue sw.js in un
// contesto con Cache Storage e rete finte. Protegge due invarianti che una
// semplice ricerca nel sorgente non dimostrerebbe:
//  - una risorsa già installata viene restituita senza chiamare la rete;
//  - una cache miss non aspetta la scrittura locale prima di mostrare il file;
//  - i 404/500 e i segmenti 206 non vengono memorizzati.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = {
    name: 'Service worker: app shell cache-first, cache miss non bloccanti e redirect coerenti',
    standalone: true,
    async run({ assert }) {
        const sorgente = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
        const gestori = {};
        const scritture = [];
        let rispostaInCache = null;
        let rispostaDiRete = null;
        let rispostaAliasHtml = null;
        let rispostaRedirect = null;
        let risolviScrittura = null;
        let chiamateRete = 0;
        const atteseBackground = [];
        const ricercheCache = [];

        const cache = {
            match: async (richiesta, opzioni) => {
                const url = typeof richiesta === 'string' ? richiesta : richiesta.url;
                ricercheCache.push({ url, opzioni });
                const percorso = new URL(url).pathname;
                if (rispostaAliasHtml && percorso.endsWith('/storia.html')) return rispostaAliasHtml;
                if (rispostaRedirect && percorso.endsWith('/duello-libero.html')) return rispostaRedirect;
                if (rispostaInCache && percorso.endsWith('/js/version.js')) return rispostaInCache;
                return null;
            },
            put: (richiesta, risposta) => {
                scritture.push({ richiesta, risposta });
                return new Promise((resolve) => { risolviScrittura = resolve; });
            }
        };
        const contesto = {
            console,
            URL,
            Request,
            Response: { redirect: (url, status) => ({ status, headers: { get: () => url } }) },
            self: {
                location: { origin: 'https://gioco.test' },
                addEventListener: (nome, fn) => { gestori[nome] = fn; },
                skipWaiting: async () => {},
                clients: { claim: async () => {} }
            },
            caches: {
                open: async () => cache,
                match: async () => rispostaInCache,
                keys: async () => [],
                delete: async () => true
            },
            setTimeout,
            clearTimeout,
            fetch: async () => { chiamateRete++; return rispostaDiRete; }
        };
        vm.runInNewContext(sorgente, contesto, { filename: 'sw.js' });
        assert(typeof gestori.fetch === 'function', 'sw.js deve registrare il gestore fetch');

        // Il redirect .html -> URL pulita va conservato come risposta 307
        // sintetica, con il corpo cacheato anche sulla destinazione finale.
        const redirectScritti = [];
        await contesto.salvaRispostaAppShell({
            put: async (richiesta, risposta) => { redirectScritti.push({ richiesta, risposta }); }
        }, new Request('https://gioco.test/duello-libero.html'), {
            ok: true,
            redirected: true,
            url: 'https://gioco.test/duello-libero',
            clone: () => ({ copia: 'pagina' })
        });
        assert(redirectScritti.length === 2, 'Un redirect seguito deve creare le due voci cache');
        assert(redirectScritti[0].risposta.status === 307, 'La URL .html deve mantenere il redirect canonico');
        assert(redirectScritti[1].richiesta === 'https://gioco.test/duello-libero',
            'La pagina pulita deve avere una voce cache diretta');
        rispostaRedirect = { status: 307, headers: { get: () => 'https://gioco.test/duello-libero' } };
        const redirectConParametri = await intercetta('duello-libero.html?mode=tournament&difficulty=hard');
        assert(redirectConParametri.status === 307
            && redirectConParametri.headers.get('location') === 'https://gioco.test/duello-libero?mode=tournament&difficulty=hard',
        'Il redirect cache-first deve conservare i parametri della modalità');
        await atteseBackground.shift();
        rispostaRedirect = null;

        function risposta(ok, etichetta, status) {
            return { ok, etichetta, status: status || (ok ? 200 : 500), clone: () => ({ copiaDi: etichetta }) };
        }

        function intercetta(percorso, range) {
            let promessa;
            gestori.fetch({
                request: {
                    method: 'GET',
                    url: `https://gioco.test/${percorso}`,
                    headers: { get: (nome) => nome.toLowerCase() === 'range' ? range || null : null }
                },
                respondWith: (p) => { promessa = Promise.resolve(p); },
                waitUntil: (p) => { atteseBackground.push(Promise.resolve(p)); }
            });
            return promessa;
        }

        // Una cache miss restituisce subito la rete, mentre la scrittura
        // resta in background per non bloccare il primo accesso online.
        rispostaDiRete = risposta(true, 'js-nuovo');
        const richiestaJs = intercetta('js/version.js');
        await new Promise((resolve) => setImmediate(resolve));
        assert((await richiestaJs) === rispostaDiRete, 'La cache miss deve mostrare subito la risposta di rete');
        assert(scritture.length === 1, 'Un JS valido deve aggiornare la Cache Storage');
        assert(atteseBackground.length === 1, 'La scrittura deve restare sotto waitUntil');
        risolviScrittura();
        await atteseBackground.shift();

        // App shell non valida: passa al chiamante, ma non sovrascrive la
        // copia buona che servirà al prossimo avvio offline.
        rispostaDiRete = risposta(false, 'errore-500');
        const primaErrore = scritture.length;
        const erroreRestituito = await intercetta('js/version.js');
        assert(erroreRestituito === rispostaDiRete, 'Online resta visibile la risposta HTTP non valida');
        assert(scritture.length === primaErrore, 'Una risposta HTTP non valida non deve entrare in cache');

        // Una risorsa installata parte dalla cache senza toccare la rete,
        // anche se la rete è lenta o assente.
        rispostaInCache = risposta(true, 'js-in-cache');
        const retePrimaCacheHit = chiamateRete;
        const lenta = intercetta('js/version.js');
        assert((await lenta) === rispostaInCache, 'Una risorsa già installata si serve dalla cache');
        assert(chiamateRete === retePrimaCacheHit, 'Una cache hit non deve fare richieste di rete');

        // Gli URL puliti /storia recuperano la pagina precaricata come
        // /storia.html, ignorando i parametri di modalità nella chiave.
        rispostaInCache = null;
        rispostaAliasHtml = risposta(true, 'storia-precaricata');
        assert((await intercetta('storia?mode=anime')) === rispostaAliasHtml,
            'Un URL pulito deve trovare il corrispondente file .html anche con query');
        assert(ricercheCache.some((r) => new URL(r.url).pathname.endsWith('/storia.html') && r.opzioni.ignoreSearch),
            'La ricerca dell\'alias .html deve ignorare i parametri della navigazione');
        rispostaAliasHtml = null;

        // I media restano cache-first e non dipendono dal cambiamento app shell.
        rispostaInCache = null;

        // Media già presente: cache-first puro, senza chiamare la rete.
        rispostaInCache = risposta(true, 'campo-in-cache');
        const retePrima = chiamateRete;
        const mediaRestituito = await intercetta('images/fields/anticoEgittoGiorno_1.jpg');
        assert(mediaRestituito === rispostaInCache, 'Un media già memorizzato viene servito dalla cache');
        assert(chiamateRete === retePrima, 'Con un media in cache la rete non viene interrogata');

        // Media nuovo valido: stessa garanzia sulla scrittura completata.
        rispostaInCache = null;
        rispostaDiRete = risposta(true, 'campo-nuovo');
        const primaMedia = scritture.length;
        const richiestaMedia = intercetta('images/fields/anticoEgittoGiorno_2.jpg');
        let mediaConcluso = false;
        richiestaMedia.then(() => { mediaConcluso = true; });
        await new Promise((resolve) => setImmediate(resolve));
        assert(scritture.length === primaMedia + 1, 'Un media nuovo e valido viene memorizzato al primo uso');
        assert(!mediaConcluso, 'Anche la risposta media deve attendere cache.put');
        risolviScrittura();
        await richiestaMedia;
        assert(mediaConcluso, 'La richiesta media termina dopo la scrittura');

        rispostaDiRete = risposta(true, 'segmento-audio', 206);
        const primaRange = scritture.length;
        const segmento = await intercetta('audio/soundtracks/56.%20Battle.mp3', 'bytes=0-65535');
        assert(segmento === rispostaDiRete, 'La risposta 206 deve essere restituita direttamente');
        assert(scritture.length === primaRange, 'Una richiesta Range non deve mai entrare in Cache Storage');
    }
};
