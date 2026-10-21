// Guardrail statico (nessuna pagina aperta, solo lettura dei sorgenti)
// sulle liste di <script> delle 18 pagine HTML.
// =====================================================================
// PERCHÉ ESISTE. Questo progetto non ha bundler: ogni pagina ripete a
// mano la propria lista di <script>, da 10 a 50 tag ciascuna. È il
// debito strutturale più concreto del repository, e ha già morso due
// volte per davvero:
//   - profilo.html e la vista Profilo fusa in index.html erano andate a
//     divergere su un vero fix ("Cambia account" senza signOut);
//   - sfide.html non caricava affatto js/economy/rewards.js, quindi la
//     pagina non sapeva dire cosa dà una Sfida e una completata lì non
//     avrebbe pagato nulla. Trovato per caso implementando i premi.
//
// PERCHÉ UN CONTROLLO E NON UN LOADER CONDIVISO. Un loader che inietta i
// tag a runtime sembrerebbe la soluzione "vera", ma romperebbe tutte e
// 18 le pagine: ognuna ha in fondo un <script> inline che chiama i global
// appena caricati (PageTopbar.render, initAudioManager, renderChallenges).
// Gli script iniettati dinamicamente vengono eseguiti DOPO che il parser
// ha già incontrato quegli inline, quindi i global non esisterebbero
// ancora. Un controllo statico invece elimina il RISCHIO (la deriva
// silenziosa) senza toccare di una virgola il modo in cui le pagine si
// caricano — e senza un refactor che andrebbe verificato 18 volte.
//
// Il cache-busting sui tag <script> (?v=...) è stato deliberatamente NON
// aggiunto: sw.js precarica l'intera app shell con `cache: 'reload'` ed è
// network-first, quindi il problema "html nuovo, js vecchio" è già
// risolto lì (e i commenti in quel file raccontano che era stato visto
// davvero su telefono). Mettere un ?v= su ~400 tag vorrebbe dire
// aggiornarli tutti ad ogni modifica: churn con un rischio nuovo, per un
// problema già chiuso altrove.
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');

// Lo "scheletro" che ogni pagina di gioco deve caricare. Non è una lista
// di comodo: sono i pezzi senza cui una pagina o non si apre, o si apre
// senza le protezioni comuni (banner d'errore, gate d'accesso, velo di
// caricamento, registrazione del service worker).
const SCHELETRO = [
    'js/ui/error-recovery.js',
    'js/vendor/supabase.min.js',
    'js/cloud/supabase-config.js',
    'js/cloud/cloud-sync.js',
    'js/pwa-register.js',
    'js/ui/page-loader.js'
];

// auth-gate.js è obbligatorio ovunque TRANNE dove l'eccezione è voluta e
// documentata: index.html mostra lui stesso il login, quindi un gate che
// lo rimandasse a index.html sarebbe un ciclo infinito.
const GATE = 'js/cloud/auth-gate.js';
const SENZA_GATE = ['index.html'];

// "Se la pagina USA questo global, deve caricare questo file." È il
// controllo che avrebbe colto il caso di sfide.html/rewards.js.
const GLOBAL_RICHIEDE = {
    'Rewards': 'js/economy/rewards.js',
    'SaveManager': 'js/save-manager.js',
    'ChallengeTracker': 'js/challenges/challenge-tracker.js',
    'PageTopbar': 'js/ui/topbar.js',
    'Icons': 'js/ui/icon-library.js',
    'CloudSync': 'js/cloud/cloud-sync.js',
    'DeckSwitcher': 'js/ui/deck-switcher.js'
};

function pagineHtml() {
    // Le pagine che iniziano per "_" sono prove locali di sviluppo (ignorate da git, non pubblicate).
    return fs.readdirSync(RADICE).filter((f) => f.endsWith('.html') && f.charAt(0) !== '_');
}

/** Gli <script src="..."> di una pagina, nell'ordine in cui compaiono. */
function scriptDi(html) {
    return [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((m) => m[1]);
}

/** Il codice INLINE di una pagina (tutto ciò che sta in <script> senza src). */
function codiceInline(html) {
    return [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
        .map((m) => m[1]).join('\n');
}

module.exports = {
    name: 'Guardrail: le liste di <script> delle pagine non vanno alla deriva',
    async run(t) {
        const pagine = pagineHtml();
        t.assert(pagine.length >= 15, `Preparazione: attese almeno 15 pagine HTML, trovate ${pagine.length}`);

        const problemi = [];

        pagine.forEach((nome) => {
            const html = fs.readFileSync(path.join(RADICE, nome), 'utf8');
            const script = scriptDi(html);
            const inline = codiceInline(html);

            SCHELETRO.forEach((s) => {
                if (!script.includes(s)) problemi.push(`${nome}: manca ${s} (fa parte dello scheletro comune a ogni pagina)`);
            });

            if (!SENZA_GATE.includes(nome) && !script.includes(GATE)) {
                problemi.push(`${nome}: manca ${GATE} — senza, la pagina è raggiungibile con un account non approvato`);
            }

            Object.keys(GLOBAL_RICHIEDE).forEach((globale) => {
                const file = GLOBAL_RICHIEDE[globale];
                if (script.includes(file)) return;
                // Se la pagina nomina il global, deve caricarne il file.
                // PUNTO — nessuna esenzione per gli usi "protetti" da un
                // `if (window.X)`.
                //
                // Un primo tentativo esentava proprio quelli, ragionando
                // che una guardia segnali una funzionalità opzionale. È
                // sbagliato, e l'ho verificato simulando il bug vero:
                // sfide.html usa `if (!window.Rewards ...) return ''`
                // come difesa, ma di rewards.js ha bisogno eccome — con
                // quella regola il controllo lasciava passare
                // esattamente il caso per cui era stato scritto.
                //
                // Una guardia dice "non schiantarti se manca", non
                // "funziona lo stesso": il default giusto è "se lo usi,
                // caricalo", con le eccezioni dichiarate qui sotto una
                // per una invece che dedotte da una forma di codice.
                if (new RegExp(`\\b${globale}\\.`).test(inline)) {
                    problemi.push(`${nome}: usa ${globale}.* nel proprio codice inline ma non carica ${file}`);
                }
            });
        });

        t.assert(problemi.length === 0,
            `Deriva rilevata fra le liste di <script> delle pagine:\n  - ${problemi.join('\n  - ')}`);

        // --- Terzo controllo: l'app shell del Service Worker ------------
        // APP_SHELL in sw.js è una lista scritta a mano di TUTTO ciò che
        // serve per far partire il gioco offline. Un file nuovo referenziato
        // da una pagina ma non elencato lì non rompe niente online — e per
        // questo passa inosservato — ma offline quella pagina si apre
        // monca.
        const sw = fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8');
        const blocco = /const APP_SHELL = \[([\s\S]*?)\];/.exec(sw);
        t.assert(blocco, 'sw.js deve dichiarare un array APP_SHELL (è la lista dei file precaricati per l\'uso offline)');
        const vociShell = [...blocco[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
        const nellaShell = new Set(vociShell);

        // L'audit del 2026-10-06 ha confermato che la shell contiene solo
        // codice, pagine, font e le quattro icone dell'app: immagini dei
        // campi/carte e audio restano cache-on-demand. Questi controlli
        // impediscono sia un refuso silenzioso sia il ritorno accidentale
        // dei media pesanti nel download di installazione.
        const duplicatiShell = vociShell.filter((voce, i) => vociShell.indexOf(voce) !== i);
        t.assert(duplicatiShell.length === 0,
            `Voci duplicate in APP_SHELL: ${[...new Set(duplicatiShell)].join(', ')}`);

        const inesistentiShell = vociShell
            .filter((voce) => voce !== './')
            .filter((voce) => !fs.existsSync(path.join(RADICE, voce)));
        t.assert(inesistentiShell.length === 0,
            `File dichiarati in APP_SHELL ma inesistenti: ${inesistentiShell.join(', ')}`);

        const estensioneMedia = /\.(?:avif|gif|jpe?g|mp3|mp4|ogg|png|webm|webp)$/i;
        const mediaPesanti = vociShell.filter((voce) => estensioneMedia.test(voce) && !voce.startsWith('images/icons/'));
        t.assert(mediaPesanti.length === 0,
            `Media da lasciare cache-on-demand entrati in APP_SHELL: ${mediaPesanti.join(', ')}`);

        const pesoShell = vociShell.reduce((totale, voce) => {
            if (voce === './') return totale;
            const stat = fs.statSync(path.join(RADICE, voce));
            return totale + (stat.isFile() ? stat.size : 0);
        }, 0);
        t.assert(pesoShell < 12 * 1024 * 1024,
            `APP_SHELL è cresciuta oltre 12 MiB non compressi (${(pesoShell / 1024 / 1024).toFixed(2)} MiB): verificare cosa è entrato nel precache`);

        // ⚠️ TEMPORANEO, va via col commit delle scorciatoie di prova:
        // js/dev/ contiene aiuti per lo sviluppo che NON devono finire
        // nella cache offline. Sono inerti senza un parametro nell'URL, e
        // precaricarli vorrebbe dire spedirli a tutti — l'opposto di
        // quello che sono. Quando si toglie js/dev/test-shortcuts.js,
        // questa riga se ne va con lui.
        const soloPerSviluppo = (percorso) => percorso.startsWith('js/dev/');

        const mancantiOffline = [];
        pagine.forEach((nome) => {
            const html = fs.readFileSync(path.join(RADICE, nome), 'utf8');
            if (!nellaShell.has(nome)) mancantiOffline.push(`la pagina ${nome} non è in APP_SHELL`);
            scriptDi(html).forEach((s) => {
                if (soloPerSviluppo(s)) return;
                if (!nellaShell.has(s)) mancantiOffline.push(`${s} (usato da ${nome})`);
            });
            [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].forEach((m) => {
                if (!nellaShell.has(m[1])) mancantiOffline.push(`${m[1]} (usato da ${nome})`);
            });
        });

        const unici = [...new Set(mancantiOffline)];
        t.assert(unici.length === 0,
            `File referenziati dalle pagine ma assenti da APP_SHELL in sw.js: offline quelle pagine si aprirebbero monche.\n  - ${unici.join('\n  - ')}`);
    }
};
