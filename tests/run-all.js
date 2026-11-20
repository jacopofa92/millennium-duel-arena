#!/usr/bin/env node
// tests/run-all.js
// =====================================================================
// Esegue ogni tests/specs/*.spec.js in una pagina Playwright isolata
// (un browser Chromium condiviso, una nuova pagina per ciascuno — così
// uno stato lasciato sporco da un test non contamina il successivo,
// stesso principio già imparato a caro prezzo in questa sessione con
// l'interferenza sulla Chain condivisa). Uscita 0 se tutti passano, 1 se
// anche uno solo fallisce — pensato per essere lanciato con `npm test`
// prima di ogni commit, non solo a mano quando ci si ricorda.
//
// Un file .spec.js esporta: `module.exports = { name: '...', run: async (t) => { ... t.assert(cond, msg); } }`
// Vedi tests/helpers/harness.js per cosa espone `t`.
// =====================================================================
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openDuel, freezeNaturalGameLoop, waitForOpeningCascade, makeAssert } = require('./helpers/harness');

const SPECS_DIR = path.join(__dirname, 'specs');

/**
 * Ogni argomento passato a riga di comando è un filtro sul NOME DEL FILE
 * dello spec (sottostringa, senza distinzione di maiuscole): più argomenti
 * si sommano, basta che uno corrisponda. Senza argomenti girano tutti.
 * Serve per riesaminare un singolo test sospetto di flakiness senza
 * aspettare gli altri 60 — `node tests/run-all.js helpoemer`.
 */
function discoverSpecs(filtri) {
    return fs.readdirSync(SPECS_DIR)
        .filter((f) => f.endsWith('.spec.js'))
        .filter((f) => filtri.length === 0 || filtri.some((q) => f.toLowerCase().includes(q)))
        .sort()
        .map((f) => path.join(SPECS_DIR, f));
}

/**
 * Uno spec `standalone: true` NON riceve una pagina già aperta sul duello:
 * riceve il BROWSER e se la costruisce da sé. Serve ai test che hanno
 * bisogno di più di una pagina o di un server proprio — il primo caso è
 * il Multiplayer, che vuole due client e il server di stanze vero.
 * Restano loro la responsabilità di chiudere ciò che aprono.
 */
async function runStandalone(browser, spec, relName) {
    const start = Date.now();
    try {
        await spec.run({ browser, assert: makeAssert() });
        const ms = Date.now() - start;
        console.log(`  \x1b[32m✓\x1b[0m ${spec.name || relName} \x1b[2m(${ms}ms)\x1b[0m`);
        return { ok: true, name: spec.name || relName };
    } catch (err) {
        const ms = Date.now() - start;
        console.log(`  \x1b[31m✗\x1b[0m ${spec.name || relName} \x1b[2m(${ms}ms)\x1b[0m`);
        console.log(`    \x1b[31m${err.message}\x1b[0m`);
        return { ok: false, name: spec.name || relName, error: err.message };
    }
}

async function runOne(browser, specPath) {
    const spec = require(specPath);
    const relName = path.relative(process.cwd(), specPath);
    if (spec.standalone) return runStandalone(browser, spec, relName);

    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const pageErrors = [];
    // Oltre al messaggio, le prime righe dello stack: un errore che salta
    // fuori solo in certe partite casuali (es. "Cannot read properties of
    // null") senza sapere DA DOVE arriva non si ritrova più.
    page.on('pageerror', (err) => {
        // "AbortError: Transition was skipped": rifiuto standard della View Transitions API (@view-transition in ogni pagina) quando
        // si naviga via prima che la transizione finisca. Il gioco lo giudica innocuo e lo filtra (duel-engine.js, error-recovery.js):
        // contarlo qui rendeva instabili gli spec che premono Indietro/Abbandona (es. duello-finito-non-rientra-con-indietro).
        if (/transition was skipped/i.test(err.message || '')) return;
        const dove = err.stack ? err.stack.split('\n').slice(1, 4).map((r) => r.trim()).join(' <- ') : '';
        pageErrors.push(dove ? `${err.message} [${dove}]` : err.message);
    });

    const start = Date.now();
    try {
        // Uno spec con `freeze: false` sta esaminando il flusso naturale
        // del gioco: niente acceleratore dell'apertura, o misurerebbe
        // tempi che nessun giocatore vede mai.
        await openDuel(page, spec.url, { fastOpening: spec.freeze !== false });
        if (spec.freeze !== false) {
            await freezeNaturalGameLoop(page);
            // E POI si aspetta che la sequenza di apertura sia davvero
            // finita. Il freeze da solo non basta: annulla il timer
            // pendente in quel momento, ma intro della telecamera e
            // distribuzione della mano finiscono DOPO e programmano le
            // proprie transizioni, che il freeze non ha mai visto. Senza
            // questa attesa ogni spec parte a cascata ancora in volo e
            // se la contende — vedi il commento completo su
            // waitForOpeningCascade in helpers/harness.js, e la flakiness
            // reale che ha causato in forced-attack-mechanism.
            await waitForOpeningCascade(page);
        }

        const t = {
            page,
            assert: makeAssert(),
            evaluate: (fn, ...args) => page.evaluate(fn, ...args)
        };
        await spec.run(t);

        if (pageErrors.length > 0) {
            throw new Error(`Errori JS non gestiti nella pagina durante il test: ${pageErrors.join(' | ')}`);
        }
        const ms = Date.now() - start;
        console.log(`  \x1b[32m✓\x1b[0m ${spec.name || relName} \x1b[2m(${ms}ms)\x1b[0m`);
        return { ok: true, name: spec.name || relName };
    } catch (err) {
        const ms = Date.now() - start;
        console.log(`  \x1b[31m✗\x1b[0m ${spec.name || relName} \x1b[2m(${ms}ms)\x1b[0m`);
        console.log(`    \x1b[31m${err.message}\x1b[0m`);
        if (pageErrors.length > 0) {
            console.log(`    Errori pagina: ${pageErrors.join(' | ')}`);
        }
        return { ok: false, name: spec.name || relName, error: err.message };
    } finally {
        await page.close();
    }
}

async function main() {
    const filtri = process.argv.slice(2).map((a) => a.toLowerCase());
    const specPaths = discoverSpecs(filtri);
    if (specPaths.length === 0) {
        // Un filtro che non corrisponde a nulla è un errore, non "tutto a posto":
        // altrimenti un refuso nel nome farebbe uscire il runner con 0 test
        // eseguiti e codice di uscita 0, sembrando una suite verde.
        console.log(filtri.length > 0
            ? `Nessuno spec corrisponde a: ${filtri.join(', ')}`
            : 'Nessun file tests/specs/*.spec.js trovato.');
        process.exit(1);
    }

    console.log(`\nEsecuzione di ${specPaths.length} test da tests/specs/...\n`);
    const browser = await chromium.launch();
    const results = [];
    // Su GitHub Actions un test fallito si ripete UNA volta. La macchina di
    // GitHub (Linux, lenta, condivisa) fa uscire ogni tanto dei fallimenti di
    // TEMPI che qui non si vedono mai, e ognuno teneva la suite rossa per
    // giorni. La ripetizione non nasconde nulla:
    //  - se passa al secondo colpo, la suite resta verde ma il test esce
    //    come "instabile" in un'annotazione ::warning pubblica, con l'errore
    //    del primo tentativo — l'elenco di quelli da sistemare non si perde;
    //  - se fallisce di nuovo, è un fallimento vero e la suite resta rossa.
    // In locale non si ripete (risposta immediata a chi sta lavorando), a
    // meno di chiederlo con RIPETI_FALLITI=1.
    const ripeti = !!(process.env.GITHUB_ACTIONS || process.env.RIPETI_FALLITI);
    const instabili = [];
    try {
        for (const specPath of specPaths) {
            let esito = await runOne(browser, specPath);
            if (!esito.ok && ripeti) {
                console.log(`    \x1b[33m↻ ripeto una volta: ${esito.name}\x1b[0m`);
                // Modulo ricaricato da capo: uno spec può tenere stato fra
                // una funzione e l'altra, e non deve ereditarlo dal tentativo
                // fallito.
                delete require.cache[require.resolve(specPath)];
                const secondo = await runOne(browser, specPath);
                if (secondo.ok) {
                    instabili.push({ name: esito.name, error: esito.error });
                    esito = secondo;
                }
            }
            results.push(esito);
        }
    } finally {
        await browser.close();
    }

    // GitHub accetta una riga sola per annotazione: gli a capo vanno
    // codificati (%0A), e per regola anche % e \r. Il titolo non può avere
    // virgole e due punti (sono separatori della sintassi).
    const codifica = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    const titolo = (s) => codifica(s).replace(/[:,]/g, ' ');
    if (instabili.length > 0) {
        console.log(`\n\x1b[33m${instabili.length} test instabili (falliti al primo colpo, passati al secondo):\x1b[0m`);
        instabili.forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
        if (process.env.GITHUB_ACTIONS) {
            instabili.forEach((r) => {
                console.log(`::warning title=${titolo('Test instabile: ' + r.name)}::${codifica('Fallito al primo tentativo, passato al secondo. Errore del primo: ' + String(r.error).slice(0, 1400))}`);
            });
        }
    }

    const passed = results.filter((r) => r.ok).length;
    const failed = results.length - passed;
    console.log(`\n${passed}/${results.length} test passati.`);
    if (failed > 0) {
        console.log(`\x1b[31m${failed} test falliti:\x1b[0m`);
        results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
        // Su GitHub Actions ogni test fallito diventa anche un'ANNOTAZIONE
        // del job (comando "::error"). I log di un job si leggono solo da
        // loggati, le annotazioni invece sono pubbliche anche via API
        // (/check-runs/<id>/annotations): così si sa QUALE test è fallito
        // e perché senza dover entrare in GitHub.
        if (process.env.GITHUB_ACTIONS) {
            results.filter((r) => !r.ok).forEach((r) => {
                console.log(`::error title=${titolo('Test fallito: ' + r.name)}::${codifica(String(r.error).slice(0, 1500))}`);
            });
        }
        process.exit(1);
    }
    process.exit(0);
}

main().catch((err) => {
    console.error('Errore fatale nel runner dei test:', err);
    process.exit(1);
});
