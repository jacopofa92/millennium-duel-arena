// tests/helpers/harness.js
// =====================================================================
// Piccolo harness condiviso da ogni file *.spec.js in tests/specs/, così
// nessuno di loro deve reimplementare da zero "apri la pagina, salta
// l'intro, aspetta che il motore sia vivo" — lo stesso preambolo che
// prima veniva riscritto a mano in ogni script Playwright temporaneo
// nella cartella scratch (mai versionato, quindi perso a fine sessione).
//
// Un file .spec.js esporta una funzione async che riceve un oggetto `t`
// con: `t.page` (la pagina Playwright già pronta), `t.assert(cond, msg)`
// (lancia un errore leggibile se `cond` è falso — questo È il test:
// fallisce con un messaggio chiaro invece di limitarsi a stampare un
// JSON che va confrontato a occhio), `t.evaluate(fn, ...args)` (scorciatoia
// per `page.evaluate`). Vedi tests/specs/*.spec.js per esempi concreti,
// e tests/run-all.js per come vengono scoperti ed eseguiti.
// =====================================================================
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
// La cartella da cui si apre il GIOCO: di solito il progetto stesso, ma
// con YGO_RADICE_GIOCO=dist la suite gioca sulla copia minificata preparata
// da scripts/pubblica.js — è così che si verifica che la versione da
// pubblicare funzioni davvero, non solo che si apra. I file sorgente letti
// dai guardrail restano quelli del progetto (PROJECT_ROOT).
const GAME_ROOT = process.env.YGO_RADICE_GIOCO ? path.resolve(PROJECT_ROOT, process.env.YGO_RADICE_GIOCO) : PROJECT_ROOT;
const GAME_URL = 'file:///' + path.join(GAME_ROOT, 'duelMonstersCore.html').split(path.sep).join('/');

/**
 * Apre duelMonstersCore.html su `page`, salta l'eventuale intro, e aspetta che
 * il motore (gameState/DuelEngine/CardEffects) sia realmente pronto —
 * non un timeout fisso indovinato a caso, ma un vero waitForFunction.
 * `urlOverride` (opzionale, es. `?mode=free&character=kaiba`) sostituisce
 * l'URL di default — usato dai test su Duello Libero/altre modalità che
 * si selezionano dalla query string.
 */
async function openDuel(page, urlOverride, opzioni) {
    // js/cloud/auth-gate.js (accesso con approvazione admin OBBLIGATORIO
    // per giocare, vedi CLAUDE.md) rimanderebbe questa pagina a
    // index.html prima ancora che gameState/DuelEngine finiscano di
    // caricare, dato che questa suite non ha (né deve avere) un vero
    // account Supabase da usare — addInitScript imposta il flag di
    // opt-out PRIMA che qualunque script della pagina (auth-gate.js
    // compreso) giri, esattamente come farebbe un reale utente sviluppatore
    // che aprisse la pagina con quel flag già impostato: nessuna modifica
    // al comportamento REALE del gate per un utente vero, che questo
    // flag non lo imposta mai.
    await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
    await require('./contenuti').consentiTuttiIContenuti(page);
    // Stesso principio del flag qui sopra, per la morra cinese che decide
    // chi gioca per primo (js/ui/duel-rps.js): saltandola i test restano
    // deterministici (comincia sempre il giocatore, come prima che
    // esistesse) e non devono cliccare una schermata in più prima di ogni
    // singolo test. Un utente vero non imposta mai questo flag.
    await page.addInitScript(() => { window.DUEL_RPS_SKIP = true; });
    // Dettagli video "Normali", come un giocatore che li abbia scelti: il
    // default del gioco è diventato "Alti" (js/ui/video-quality.js), ma la
    // suite è nata e misurata con gli effetti ambientali spenti, e
    // accenderli in ogni duello di prova ne cambierebbe i tempi. Solo se
    // nessuno ha già scelto: uno spec che prova gli effetti alti
    // (VideoQuality.set('alti')) li ritrova dopo un ricaricamento.
    await page.addInitScript(() => {
        try {
            if (localStorage.getItem('ygoVideoDetailScelto') !== '1') {
                localStorage.setItem('ygoVideoDetail', 'normali');
                localStorage.setItem('ygoVideoDetailScelto', '1');
            }
        } catch (e) { /* senza storage resta il default */ }
    });
    // Comprime intro della telecamera e distribuzione della mano iniziale
    // (vedi playCameraIntro/FAST_DEAL in js/engine/game-flow.js). Serve
    // perché ogni spec deve comunque aspettare che la sequenza di
    // apertura finisca prima di toccare lo stato — vedi
    // waitForOpeningCascade qui sotto — e senza questo flag sono ~3,5
    // secondi di attesa MOLTIPLICATI per ogni spec della suite. Il gioco
    // vero non lo imposta mai, quindi resta identico.
    //
    // MA NON per gli spec che verificano il FLUSSO NATURALE (quelli con
    // `freeze: false`): il loro oggetto d'esame è proprio la sequenza
    // reale, coi suoi tempi reali, quindi accelerarla vorrebbe dire
    // misurare qualcosa di diverso da ciò che vede un giocatore. Errore
    // preso davvero: con l'acceleratore attivo ovunque,
    // bot-waits-for-summon-cinematic non arrivava più in Battle Phase e
    // falliva in modo deterministico.
    if (!opzioni || opzioni.fastOpening !== false) {
        await page.addInitScript(() => { window.DUEL_FAST_OPENING = true; });
    }
    await page.goto(urlOverride ? GAME_URL + urlOverride : GAME_URL, { waitUntil: 'load' });
    try {
        await page.click('.di-skip', { timeout: 5000 });
    } catch (e) {
        // Nessun prompt di intro da saltare (o già oltre) — non è un errore.
    }
    await page.waitForFunction(
        () => typeof gameState !== 'undefined' && typeof DuelEngine !== 'undefined' && typeof CardEffects !== 'undefined',
        { timeout: 20000 }
    );
    // NESSUNA attesa qui prima di tornare: ogni millisecondo in più lascia
    // al ciclo di turno naturale della demo (già avviato dalla pagina) il
    // tempo di correre — run-all.js chiama freezeNaturalGameLoop() SUBITO
    // dopo, il prima possibile, non dopo un'attesa. Uno spec che ha
    // davvero bisogno di lasciar completare la sequenza naturale (es.
    // duello-libero-smoke.spec.js, con freeze:false) aspetta lui stesso,
    // esplicitamente, dopo aver disattivato il freeze.
}

/**
 * Ferma il ciclo di turno autonomo della pagina (bot/avanzamento fase)
 * per i test che manipolano gameState direttamente, chiamando funzioni
 * interne del motore fuori dal normale flusso a turni — senza questo,
 * il ciclo naturale della demo può continuare a girare IN PARALLELO
 * (soprattutto ora che la risoluzione della Chain è asincrona, vedi
 * resolveChain in duel-engine.js) e interferire con lo stato che il test
 * sta manipolando. Vedi la correzione reale che questo esatto problema
 * ha richiesto in tests/specs/chain-resolution.spec.js per il perché.
 */
async function freezeNaturalGameLoop(page) {
    await page.evaluate(() => {
        // clearPhaseTransitionTimeout() (game-flow.js) annulla il VERO
        // setTimeout già in coda dalla sequenza di apertura naturale della
        // pagina — ogni passo della cascata (enterDrawPhase -> ... ->
        // changeTurn) lo richiama già da sé all'inizio come primo gesto,
        // quindi interromperla UNA volta qui basta: nessun passo
        // successivo può ripartire da solo.
        if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
        // Neutralizza SOLO le decisioni AUTONOME del bot (cosa fare di
        // propria iniziativa), MAI le funzioni di transizione fase
        // (enterDrawPhase/enterMainPhase1/ecc. o handlePhaseStepperClick
        // stesso) — quelle sono l'unico modo legittimo con cui i test
        // stessi avanzano fase quando serve davvero. Bug reale trovato
        // proprio scrivendo questa suite: sovrascriverle come no-op faceva
        // sì che handlePhaseStepperClick('main2') superasse ogni controllo
        // ma poi non cambiasse mai davvero gameState.phase, perché la
        // funzione che l'avrebbe fatto era stata resa inerte qui.
        window.botTurn = function () {};
        window.attemptBotSummon = function () { return Promise.resolve(); };
        window.botPerformAttacks = async function () {};
        window.changeTurn = function () {};
        // NIENTE gameState.gameOver = true qui: è un interruttore troppo
        // grezzo — non ferma solo il ciclo naturale, disattiva anche
        // meccaniche vere che molti test devono esercitare (es.
        // resolveAttack in actions.js controlla proprio questo flag e si
        // rifiuta di risolvere una battaglia se true).
    });
}

/**
 * Aspetta che la sequenza di APERTURA del duello sia davvero finita, non
 * solo che abbia toccato la Main Phase 1.
 *
 * Perché serve, misurato e non supposto. `freezeNaturalGameLoop` annulla
 * il timer di transizione fase PENDENTE in quel momento, ma la sequenza
 * di apertura non è ancora arrivata a programmare i suoi: l'intro della
 * telecamera (~1.7s) e la distribuzione della mano (~1.6s) finiscono
 * DOPO il freeze, e solo allora `enterDrawPhase` programma la fase
 * successiva, poi `enterStandbyPhase` la sua, e così via. Quei timer il
 * freeze non li ha mai visti.
 *
 * Il risultato è che uno spec che aspetti soltanto `phase === 'main1'`
 * riparte NELLO STESSO ISTANTE in cui la cascata ci arriva — verificato
 * strumentando la pagina: "il test comincia qui" e il passaggio
 * standby -> main1 cadevano sullo stesso millisecondo. Da lì in poi il
 * test e la cascata si contendono `gameState.phase`, ed è la causa della
 * flakiness di forced-attack-mechanism (fallito ~1 volta su 3 nella
 * suite completa, mai in isolamento, con asserzioni diverse ogni volta
 * — il sintomo tipico di una corsa, non di un bug logico).
 *
 * Il segnale di "finita" non è una fase in particolare ma la STABILITÀ:
 * la fase non cambia più da sola per un po'. Poi si annullano anche le
 * transizioni eventualmente rimaste in coda, che ora esistono davvero e
 * quindi possono essere cancellate sul serio.
 */
async function waitForOpeningCascade(page) {
    const STABILE_MS = 400;
    // PRIMA la cascata deve essere ARRIVATA, poi essersi fermata. La sola
    // stabilità non basta ed è un errore già preso: prima che la cascata
    // parta ci sono ~3 secondi di silenzio (intro della telecamera e
    // distribuzione della mano) in cui la fase resta ferma su 'draw', e
    // una verifica di sola stabilità li scambia per "finita" — sbloccando
    // il test proprio un attimo prima che la cascata cominci, cioè nel
    // momento peggiore possibile.
    //
    // Se per qualche motivo la Main Phase 1 non arrivasse (uno spec che
    // apre la pagina con parametri particolari), si prosegue lo stesso
    // dopo l'attesa di stabilità invece di far fallire lo spec per un
    // dettaglio dell'infrastruttura di test.
    try {
        await page.waitForFunction(
            () => typeof gameState !== 'undefined' && gameState && gameState.phase === 'main1',
            null,
            { timeout: 15000 }
        );
    } catch (e) {
        // Nessuna Main Phase 1 in vista: resta valida l'attesa qui sotto.
    }
    await page.waitForFunction((ms) => {
        if (typeof gameState === 'undefined' || !gameState) return false;
        const ora = gameState.phase;
        if (window.__faseOsservata !== ora) {
            window.__faseOsservata = ora;
            window.__faseFermaDa = performance.now();
            return false;
        }
        return (performance.now() - (window.__faseFermaDa || 0)) >= ms;
    }, STABILE_MS, { timeout: 20000 });
    await page.evaluate(() => {
        if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
    });
}

/** Lanciata da t.assert(...) quando la condizione è falsa — un vero fallimento di test, non solo un log. */
class AssertionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AssertionError';
    }
}

function makeAssert() {
    return function assert(condition, message) {
        if (!condition) {
            throw new AssertionError(message || 'Asserzione fallita');
        }
    };
}

/**
 * Toglie di mezzo ciò che sta SOPRA una pagina appena caricata e si
 * prenderebbe un click: la schermata di caricamento condivisa (resta almeno
 * un secondo, js/ui/page-loader.js) e i riquadri "Carta ottenuta" dei premi
 * (js/economy/card-drop-animation.js, arrivano da una coda in sessionStorage
 * e si mostrano al caricamento successivo). Nel gioco vero li chiude il
 * giocatore; uno spec che clicca subito dopo un reload deve prima chiamare
 * questa, o il click scade dopo 30 secondi con "intercepts pointer events".
 */
async function liberaLaPagina(page) {
    await page.waitForFunction(() => {
        const loader = document.getElementById('pageLoader');
        return !loader || loader.classList.contains('page-loader-hidden');
    }, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => {
        // Stessa chiave di STORAGE_KEY in card-drop-animation.js. Togliendo
        // il riquadro a mano la sua coda resta "occupata" e non ne mostra
        // altri: per uno spec è quello che serve.
        try { sessionStorage.removeItem('duelArenaPendingCardDrops'); } catch (e) { /* noop */ }
        document.querySelectorAll('.cdrop-overlay').forEach((o) => o.remove());
    });
}

module.exports = { openDuel, freezeNaturalGameLoop, waitForOpeningCascade, liberaLaPagina, makeAssert, AssertionError, GAME_URL, PROJECT_ROOT };
