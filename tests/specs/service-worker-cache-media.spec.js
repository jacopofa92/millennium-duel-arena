// Le immagini (media) stanno in una cache PROPRIA che sopravvive agli aggiornamenti del gioco: prima erano nella cache dell'app shell,
// che `activate` butta ad ogni rilascio, e su rete lenta ogni aggiornamento voleva dire riscaricare tutte le carte.
// Verificato senza browser: sw.js gira in un contesto con una Cache Storage finta che distingue le cache per NOME.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = {
    name: 'Service worker: i media stanno in una cache propria che un aggiornamento non butta',
    standalone: true,
    async run({ assert }) {
        const sorgente = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
        const gestori = {};
        const archivio = new Map();   // nome cache -> Map(url -> risposta)
        const cancellate = [];
        const cacheDi = (nome) => {
            if (!archivio.has(nome)) archivio.set(nome, new Map());
            const voci = archivio.get(nome);
            return {
                match: async (req) => voci.get(typeof req === 'string' ? req : req.url) || null,
                put: async (req, risposta) => { voci.set(typeof req === 'string' ? req : req.url, risposta); },
                addAll: async () => {}
            };
        };
        const contesto = vm.createContext({
            console, URL, Request,
            self: {
                location: { origin: 'https://gioco.test' },
                addEventListener: (nome, fn) => { gestori[nome] = fn; },
                skipWaiting: async () => {},
                clients: { claim: async () => {} }
            },
            caches: {
                open: async (nome) => cacheDi(nome),
                match: async (req) => {
                    for (const voci of archivio.values()) { const r = voci.get(typeof req === 'string' ? req : req.url); if (r) return r; }
                    return null;
                },
                keys: async () => Array.from(archivio.keys()),
                delete: async (nome) => { cancellate.push(nome); return archivio.delete(nome); }
            },
            setTimeout: (fn) => { fn(); return 0; },
            clearTimeout: () => {},
            fetch: async () => ({ ok: true, status: 200, clone() { return { copia: true }; } })
        });
        vm.runInContext(sorgente, contesto, { filename: 'sw.js' });
        const CACHE_NAME = vm.runInContext('CACHE_NAME', contesto);
        const MEDIA_CACHE = vm.runInContext('MEDIA_CACHE', contesto);
        assert(MEDIA_CACHE && MEDIA_CACHE !== CACHE_NAME, 'sw.js deve avere una cache dei media diversa da quella dell\'app shell');
        assert(!/v\d+$/.test(MEDIA_CACHE) || MEDIA_CACHE.includes('media'), 'il nome della cache dei media non deve seguire la versione dell\'app shell');

        function intercetta(percorso) {
            let promessa;
            gestori.fetch({
                request: { method: 'GET', url: `https://gioco.test/${percorso}`, headers: { get: () => null } },
                respondWith: (p) => { promessa = Promise.resolve(p); }
            });
            return promessa;
        }

        // Una miniatura di carta, richiesta la prima volta: finisce nella cache dei media e NON in quella dell'app shell.
        await intercetta('images/cards/thumbs/1.webp');
        const media = archivio.get(MEDIA_CACHE);
        assert(media && media.has('https://gioco.test/images/cards/thumbs/1.webp'), 'la miniatura deve finire nella cache dei media');
        assert(!archivio.has(CACHE_NAME) || !archivio.get(CACHE_NAME).has('https://gioco.test/images/cards/thumbs/1.webp'), 'la miniatura non deve finire nella cache dell\'app shell');

        // Un file dell'app shell invece resta nella sua cache.
        await intercetta('js/version.js');
        assert(archivio.get(CACHE_NAME) && archivio.get(CACHE_NAME).has('https://gioco.test/js/version.js'), 'un file JS deve restare nella cache dell\'app shell');

        // Un aggiornamento: esistono una vecchia cache dell'app shell, quella corrente e quella dei media.
        archivio.set('ygo-duel-arena-v1', new Map([['https://gioco.test/js/vecchio.js', {}]]));
        archivio.set('ygo-duel-arena-v2', new Map());
        let attesa;
        gestori.activate({ waitUntil: (p) => { attesa = p; } });
        await attesa;
        assert(cancellate.includes('ygo-duel-arena-v1') && cancellate.includes('ygo-duel-arena-v2'), 'le cache vecchie dell\'app shell vanno buttate');
        assert(!cancellate.includes(CACHE_NAME), 'la cache corrente dell\'app shell non va buttata');
        assert(!cancellate.includes(MEDIA_CACHE), 'la cache dei media NON va buttata dall\'aggiornamento');
        assert(archivio.has(MEDIA_CACHE) && archivio.get(MEDIA_CACHE).has('https://gioco.test/images/cards/thumbs/1.webp'), 'dopo l\'aggiornamento le immagini gia\' scaricate devono esserci ancora');

        // E una carta gia' in cache dei media si serve senza rete.
        let chiamateRete = 0;
        contesto.fetch = async () => { chiamateRete++; return { ok: true, status: 200, clone() { return {}; } }; };
        const servita = await intercetta('images/cards/thumbs/1.webp');
        assert(servita === media.get('https://gioco.test/images/cards/thumbs/1.webp') && chiamateRete === 0, 'una miniatura in cache si serve senza interrogare la rete');
    }
};
