// Strategia della cache PWA verificata senza browser: esegue sw.js in un
// contesto con Cache Storage e rete finte. Protegge due invarianti che una
// semplice ricerca nel sorgente non dimostrerebbe:
//  - un 404/500 non deve avvelenare una copia valida già installata;
//  - la risposta intercettata resta pendente finché cache.put non termina,
//    così il browser non può sospendere il worker a scrittura incompleta.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = {
    name: 'Service worker: risposte valide attese in cache, errori HTTP mai persistiti',
    standalone: true,
    async run({ assert }) {
        const sorgente = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
        const gestori = {};
        const scritture = [];
        let rispostaInCache = null;
        let rispostaDiRete = null;
        let risolviScrittura = null;
        let chiamateRete = 0;
        let reteBloccata = null; // se impostata, la fetch non risponde finche' non la si risolve
        const timer = [];

        const cache = {
            match: async () => rispostaInCache,
            put: (richiesta, risposta) => {
                scritture.push({ richiesta, risposta });
                return new Promise((resolve) => { risolviScrittura = resolve; });
            }
        };
        const contesto = {
            console,
            URL,
            Request,
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
            // Orologio finto: la scadenza dell'app shell si fa scattare a mano, senza attese vere.
            setTimeout: (fn, ms) => { timer.push({ fn, ms, attivo: true }); return timer.length - 1; },
            clearTimeout: (id) => { if (timer[id]) timer[id].attivo = false; },
            fetch: async () => { chiamateRete++; if (reteBloccata) await reteBloccata; return rispostaDiRete; }
        };
        vm.runInNewContext(sorgente, contesto, { filename: 'sw.js' });
        assert(typeof gestori.fetch === 'function', 'sw.js deve registrare il gestore fetch');

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
                respondWith: (p) => { promessa = Promise.resolve(p); }
            });
            return promessa;
        }

        // App shell valida: viene scritta e la risposta non si conclude
        // finché la scrittura controllata non è stata risolta.
        rispostaDiRete = risposta(true, 'js-nuovo');
        const richiestaJs = intercetta('js/version.js');
        let jsConcluso = false;
        richiestaJs.then(() => { jsConcluso = true; });
        await new Promise((resolve) => setImmediate(resolve));
        assert(scritture.length === 1, 'Un JS valido deve aggiornare la Cache Storage');
        assert(!jsConcluso, 'La risposta JS deve attendere cache.put');
        risolviScrittura();
        const jsRestituito = await richiestaJs;
        assert(jsConcluso && jsRestituito === rispostaDiRete, 'Dopo cache.put viene restituita la risposta di rete originale');

        // App shell non valida: passa al chiamante, ma non sovrascrive la
        // copia buona che servirà al prossimo avvio offline.
        rispostaDiRete = risposta(false, 'errore-500');
        const primaErrore = scritture.length;
        const erroreRestituito = await intercetta('js/version.js');
        assert(erroreRestituito === rispostaDiRete, 'Online resta visibile la risposta HTTP non valida');
        assert(scritture.length === primaErrore, 'Una risposta HTTP non valida non deve entrare in cache');

        // Rete lenta con la copia gia' in cache: dopo la scadenza si parte dalla cache, e la rete che arriva
        // dopo aggiorna comunque la copia per la volta successiva.
        rispostaInCache = risposta(true, 'js-in-cache');
        rispostaDiRete = risposta(true, 'js-arrivato-tardi');
        let sbloccaRete = null;
        reteBloccata = new Promise((resolve) => { sbloccaRete = resolve; });
        const prima = timer.length;
        const scrittureLente = scritture.length;
        const lenta = intercetta('js/version.js');
        let lentaConclusa = false;
        lenta.then(() => { lentaConclusa = true; });
        await new Promise((resolve) => setImmediate(resolve));
        assert(timer.length === prima + 1 && timer[prima].ms === 1500, 'Con la copia in cache la rete ha una scadenza di 1,5 secondi');
        assert(!lentaConclusa, 'Prima della scadenza si aspetta ancora la rete');
        timer[prima].fn();
        assert((await lenta) === rispostaInCache, 'Scaduta l\'attesa si serve la copia in cache');
        sbloccaRete();
        await new Promise((resolve) => setImmediate(resolve));
        assert(scritture.length === scrittureLente + 1, 'La rete arrivata dopo la scadenza aggiorna comunque la cache');
        risolviScrittura();

        // Rete veloce con la copia in cache: vince la rete (e la scadenza viene annullata).
        reteBloccata = null;
        rispostaDiRete = risposta(true, 'js-fresco');
        const veloce = intercetta('js/version.js');
        await new Promise((resolve) => setImmediate(resolve));
        risolviScrittura();
        assert((await veloce) === rispostaDiRete, 'Se la rete risponde in tempo vince la rete, non la copia');

        // Rete che risponde con un errore, copia buona in cache: resta la copia.
        rispostaDiRete = risposta(false, 'errore-503', 503);
        const conErrore = await intercetta('js/version.js');
        assert(conErrore === rispostaInCache, 'Un errore HTTP non batte una copia buona in cache');
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
