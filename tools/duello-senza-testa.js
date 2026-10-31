#!/usr/bin/env node
/**
 * duello-senza-testa.js — un duello intero in Node, senza browser.
 * =====================================================================
 * Traguardo della Priorità 2 del piano di attacco ("nucleo senza testa"):
 * carica SOLO dati, motore, regole e IA — niente game-flow.js (il disegno
 * del campo), niente actions.js (click e modali), nessun DOM finto — e fa
 * giocare un duello fino alla fine.
 *
 * Due pezzi rendono possibile farlo senza toccare il motore:
 *  - l'OROLOGIO VIRTUALE: setTimeout/setInterval/Date.now del contesto
 *    sono sostituiti da una coda ordinata per tempo virtuale. L'ordine fra
 *    gli eventi è quello vero (un'animazione da 2 secondi finisce DOPO una
 *    da 500 ms), ma niente aspetta davvero: un duello dura pochi secondi.
 *  - il CANALE DEGLI EVENTI (js/engine/eventi-duello.js): le regole non
 *    chiamano più per nome il disegno del campo, avvisano l'interfaccia. Qui
 *    nessuno disegna, quindi nessuno ascolta, e ogni avviso cade nel vuoto —
 *    tranne il registro e la fine del duello, che ascolta questo file. Le
 *    regole toccano la pagina solo da js/engine/porta-ui.js, che senza
 *    `document` risponde "nessun elemento".
 *
 * I due giocatori sono entrambi l'IA vera del gioco (js/ai/*): i "posti al
 * tavolo" (js/engine/tavolo.js, Priorità 3) dicono che anche il posto
 * 'player' è controllato dall'IA, e il turno di ciascuno lo guida turnoIA
 * (js/ai/bot.js) come in una partita vera.
 *  - 'bot': il personaggio --avversario, col suo mazzo del --livello;
 *  - 'player': l'IA al --livello-giocatore (default: lo stesso), col mazzo
 *    del personaggio --giocatore se indicato, altrimenti col mazzo
 *    dimostrativo bilanciato del Duello Demo.
 *
 * Uso:
 *   node tools/duello-senza-testa.js [--avversario kaiba] [--livello hard]
 *        [--giocatore yugiMuto] [--livello-giocatore hard]
 *        [--seme 42] [--partite 1] [--log] [--diagnosi] [--superficie]
 * Esce con 1 se una partita non arriva alla fine o lancia un errore.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.join(__dirname, '..');
const GRUPPI = require(path.join(RADICE, 'scripts', 'gruppi-script.js'));

// Dati, motore, regole, IA. NON game-flow.js né actions.js (il disegno
// del campo e i click), e nemmeno duel-sandbox.js (lo stato iniziale finto
// del Duello Demo).
const NON_REGOLE = ['js/engine/game-flow.js', 'js/engine/actions.js', 'js/engine/duel-sandbox.js'];
const SCRIPT = [
    'js/data/cards-data.generated.js',
    'js/data/cards-db.js',
    'js/data/characters-db.js',
    'js/data/character-decks.js',
    ...GRUPPI.motore,
    ...GRUPPI.partita.filter((f) => !NON_REGOLE.includes(f)),
    'js/ai/ai-shared.js',
    'js/ai/ai-medium.js',
    'js/ai/ai-hard.js',
    'js/ai/ai-controller.js',
    'js/ai/bot.js'
];

/**
 * Ciò che una pagina farebbe ascoltando il canale, ridotto a quanto serve
 * qui: le righe del registro (per la diagnosi e i messaggi d'errore) e
 * l'esito del duello. Con --superficie conta anche quali eventi le regole
 * hanno emesso, avvolgendo i tre metodi del canale (non con ascoltatori,
 * che cambierebbero le risposte: un evento con un ascoltatore aspetta il
 * suo "fatto", e lo scarto di fine turno sceglie un'altra strada).
 */
const ASCOLTO = `
var __logDuello = [];
var __esitoDuello = null;
var __eventi = {};
EventiDuello.ascolta('registro', (m) => { __logDuello.push(String(m)); });
EventiDuello.ascolta('fine-duello', (esito) => { if (__esitoDuello === null) __esitoDuello = esito; });
['emetti', 'attendi', 'chiedi'].forEach((metodo) => {
    const originale = EventiDuello[metodo];
    EventiDuello[metodo] = function (nome, ...dati) {
        __eventi[nome] = (__eventi[nome] || 0) + 1;
        return originale.call(this, nome, ...dati);
    };
});
`;

function argomenti() {
    const a = process.argv.slice(2);
    const val = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 && a[i + 1] ? a[i + 1] : d; };
    return {
        avversario: val('avversario', 'kaiba'),
        livello: val('livello', 'hard'),
        giocatore: val('giocatore', null),
        livelloGiocatore: val('livello-giocatore', null),
        seme: Number(val('seme', '42')),
        partite: Number(val('partite', '1')),
        log: a.includes('--log'),
        superficie: a.includes('--superficie'),
        diagnosi: a.includes('--diagnosi'),
        turni: Number(val('turni', '60'))
    };
}

/** Generatore pseudo-casuale con seme (mulberry32): partite riproducibili. */
function prng(seme) {
    let s = seme >>> 0;
    return function () {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Orologio virtuale: una coda di timer ordinata per (tempo, ordine di arrivo). */
function creaOrologio() {
    const coda = [];
    let ora = 0;
    let progressivo = 0;
    const BASE = Date.UTC(2026, 0, 1);
    const orologio = {
        get ora() { return ora; },
        setTimeout(fn, ms, ...args) {
            const id = ++progressivo;
            coda.push({ t: ora + Math.max(0, Number(ms) || 0), id, fn, args, ogni: null });
            return id;
        },
        setInterval(fn, ms, ...args) {
            const id = ++progressivo;
            const passo = Math.max(1, Number(ms) || 1);
            coda.push({ t: ora + passo, id, fn, args, ogni: passo });
            return id;
        },
        clear(id) {
            const i = coda.findIndex((x) => x.id === id);
            if (i >= 0) coda.splice(i, 1);
        },
        /** Esegue il prossimo timer; torna false se la coda è vuota. */
        passo() {
            if (coda.length === 0) return false;
            coda.sort((a, b) => (a.t - b.t) || (a.id - b.id));
            const x = coda.shift();
            ora = x.t;
            if (x.ogni) coda.push(Object.assign({}, x, { t: ora + x.ogni }));
            // Ricordato per la diagnosi: quando un invariante salta, si sa
            // QUALE funzione a tempo ha girato in quel passo.
            orologio.ultimo = String(x.fn).replace(/\s+/g, ' ').slice(0, 300);
            x.fn(...x.args);
            return true;
        },
        get inCoda() { return coda.length; },
        Date: class extends Date {
            constructor(...a) { if (a.length) super(...a); else super(BASE + ora); }
            static now() { return BASE + ora; }
        }
    };
    return orologio;
}

function creaContesto(opz) {
    // Un orologio passato da fuori lo condividono più contesti: il duello
    // gemello (tools/duello-gemello.js) fa girare due motori sullo stesso
    // tempo virtuale, come due telefoni.
    const orologio = opz.orologio || creaOrologio();
    const casuale = prng(opz.seme);
    const MathConSeme = Object.create(Math);
    MathConSeme.random = casuale;
    // Gli errori che le carte lanciano (safeCallCardHandler li intercetta e
    // li scrive con console.error) si raccolgono: nel browser restano in
    // console, qui diventano parte del risultato della partita.
    const erroriCarte = [];
    const consoleDuello = {
        log: opz.log ? console.log : () => {},
        info: opz.log ? console.info : () => {},
        warn: opz.log ? console.warn : () => {},
        error: (...a) => {
            erroriCarte.push(a.map((x) => (x && x.stack) ? String(x.stack).split('\n').slice(0, 3).join(' <- ') : String(x)).join(' '));
            if (opz.log) console.error(...a);
        }
    };
    const contesto = {
        console: consoleDuello,
        setTimeout: orologio.setTimeout,
        clearTimeout: orologio.clear,
        setInterval: orologio.setInterval,
        clearInterval: orologio.clear,
        queueMicrotask,
        Promise,
        Math: MathConSeme,
        Date: orologio.Date
    };
    vm.createContext(contesto);
    // `window` è il contesto stesso (come nel browser window === globalThis):
    // non è un DOM, è solo il nome con cui gli script pubblicano i propri
    // oggetti. `document` NON esiste.
    vm.runInContext('var window = globalThis;', contesto);
    // L'avversario e il livello, come li passerebbe la pagina del duello.
    // Negli audit fattoriali il deck puo' avere un livello diverso dall'IA.
    // Lo comunichiamo PRIMA di resetGameState: sostituire e rimescolare il
    // mazzo dopo il reset consumerebbe altri numeri casuali e renderebbe i
    // semi non confrontabili con una partita naturale dello stesso livello.
    vm.runInContext(`window.DuelSession = { opponent: { id: ${JSON.stringify(opz.avversario)}, name: ${JSON.stringify(opz.avversario)} }, aiDifficultyKey: ${JSON.stringify(opz.livelloDeckAvversario || opz.livello)} };`, contesto);
    // opz.scriptAggiuntivi: file caricati dopo le regole e l'IA (per esempio una
    // variante di js/modes/ che gira senza interfaccia, come il Tag Team).
    SCRIPT.concat(opz.scriptAggiuntivi || []).forEach((f) => {
        const codice = fs.readFileSync(path.join(RADICE, f), 'utf8');
        vm.runInContext(codice, contesto, { filename: f });
        // Subito dopo il canale, prima di chiunque emetta.
        if (f === 'js/engine/eventi-duello.js') vm.runInContext(ASCOLTO, contesto, { filename: 'ascolto.js' });
    });
    return { contesto, orologio, erroriCarte };
}

/**
 * --diagnosi: avvolge ogni hook di ogni carta con un controllo degli
 * invarianti (Life Points numerici, solo mostri nella zona Mostri). Il
 * primo hook che ne rompe uno lascia nel log una riga "### INVARIANTE" con
 * carta e hook: è il modo più rapido per passare da "a un certo punto lo
 * stato si rompe" a "lo rompe questa carta".
 */
const DIAGNOSI = `
(function () {
    const rotto = () => {
        if (![gameState.playerLP, gameState.botLP].every((v) => Number.isFinite(v))) return 'Life Points non numerici';
        const intruso = ['player','bot'].some((o) => (o === 'player' ? gameState.playerMonsterField : gameState.botMonsterField)
            .some((s) => s && s.card && s.card.type !== 'monster'));
        return intruso ? 'carta non-mostro nella zona Mostri' : null;
    };
    // Le due zone Mostri diventano Proxy: un'assegnazione di una carta
    // non-mostro lascia lo stack del punto ESATTO in cui è avvenuta (il
    // controllo sugli hook qui sotto non vede ciò che il motore fa dopo che
    // l'hook ha restituito il controllo). Si reinstallano se il motore
    // sostituisce l'array (resetGameState, una fotografia di stato).
    window.__sorvegliaZone = function () {
        ['playerMonsterField', 'botMonsterField'].forEach((k) => {
            const arr = gameState[k];
            if (!arr || arr.__sorvegliato) return;
            gameState[k] = new Proxy(arr, {
                get(t, p) { return p === '__sorvegliato' ? true : t[p]; },
                set(t, p, v) {
                    if (v && v.card && v.card.type !== 'monster') {
                        __logDuello.push('### INVARIANTE (carta non-mostro nella zona Mostri: ' + v.card.name + ') scritta da: '
                            + String(new Error().stack).split('\\n').slice(2, 7).map((r) => r.trim()).join(' <- '));
                    }
                    t[p] = v;
                    return true;
                }
            });
        });
    };
    cardDatabase.forEach((c) => {
        const def = DuelEngine.getDefinition(c.id);
        if (!def || def.__diagnosi) return;
        def.__diagnosi = true;
        Object.keys(def).forEach((k) => {
            if (typeof def[k] !== 'function') return;
            const originale = def[k];
            def[k] = function (...a) {
                const prima = rotto();
                const r = originale.apply(this, a);
                const dopo = rotto();
                if (!prima && dopo) {
                    const ctx = a[0] || {};
                    __logDuello.push('### INVARIANTE (' + dopo + ') rotto da ' + c.id + ' ' + c.name + '.' + k + ' [owner ' + ctx.owner + ', zona ' + ctx.zone + ']');
                }
                return r;
            };
        });
    });
})();
`;

async function giocaPartita(opz, n) {
    const seme = opz.seme + n;
    const { contesto, orologio, erroriCarte } = creaContesto(Object.assign({}, opz, { seme }));
    const esegui = (codice) => vm.runInContext(codice, contesto);
    if (opz.diagnosi) esegui(DIAGNOSI);
    const LIMITE_TURNI = opz.turni || 60;
    if (opz.mazzoAvversario) {
        // Variante di audit iniettata prima del reset: viene costruita e
        // mescolata una volta sola nello stesso punto del deck reale. Una
        // sostituzione dopo resetGameState consumerebbe RNG aggiuntivo e
        // invaliderebbe il confronto a parita' di seme.
        esegui(`
            (function () {
                const getCharacterDeckOriginale = getCharacterDeck;
                window.__getCharacterDeckOriginaleAudit = getCharacterDeckOriginale;
                const personaggioAudit = ${JSON.stringify(opz.avversario)};
                const specificaAudit = ${JSON.stringify(opz.mazzoAvversario)};
                getCharacterDeck = function (characterId, difficulty) {
                    if (characterId === personaggioAudit) return specificaAudit;
                    return getCharacterDeckOriginale(characterId, difficulty);
                };
            })();
        `);
    }
    esegui('resetGameState();');
    const livelloGiocatore = opz.livelloGiocatore || opz.livello;
    // L'IA su entrambi i posti, ciascuna col suo livello. Il mazzo del
    // posto 'player' può essere una specifica esplicita (`mazzoGiocatore`,
    // usata dall'audit dei deck della Storia), quello di un personaggio o
    // infine il dimostrativo costruito da resetGameState.
    esegui(`
        Tavolo.imposta({ player: 'ia', bot: 'ia' });
        gameState.livelloIA = { player: ${JSON.stringify(livelloGiocatore)}, bot: ${JSON.stringify(opz.livello)} };
        gameState.personaggioPerPosto = {
            player: ${JSON.stringify(opz.giocatore || null)},
            bot: ${JSON.stringify(opz.avversario || null)}
        };
        ${(opz.mazzoGiocatore || opz.giocatore) ? `(function () {
            const spec = ${opz.mazzoGiocatore
                ? JSON.stringify(opz.mazzoGiocatore)
                : `(window.__getCharacterDeckOriginaleAudit || getCharacterDeck)(${JSON.stringify(opz.giocatore)}, ${JSON.stringify(livelloGiocatore)})`};
            if (!spec) throw new Error('Nessun mazzo per il personaggio ' + ${JSON.stringify(opz.giocatore)});
            gameState.playerDeck = buildDeckFromSpec(spec);
            gameState.playerDeckCount = gameState.playerDeck.length;
            gameState.playerExtraDeck = buildExtraDeckFromSpec(spec);
        })();` : ''}
        window.__deckBotIniziale = (gameState.botDeck || []).map((c) => c.id).sort((a, b) => a - b).join(',');
    `);
    // Mano iniziale di 5 carte per lato, poi il primo turno: lo guida l'IA
    // del posto 'player', come farebbe initGame in una pagina.
    esegui(`
        for (let i = 0; i < 5; i++) { drawCardsToHand('player', 1, { silent: true }); drawCardsToHand('bot', 1, { silent: true }); }
        window.__manoBotIniziale = gameState.botHand.map((c) => Number(c.id));
        gameState.turn = 1; gameState.currentPlayer = 'player';
    `);
    // opz.primaDelTurno: codice eseguito a mani pronte e primo giocatore deciso,
    // prima che il primo turno parta (dove una pagina avvolge preparaManiIniziali).
    // Può anche cambiare chi comincia: il primo turno lo guida chi è di turno.
    if (opz.primaDelTurno) esegui(opz.primaDelTurno);
    esegui(`turnoIA(gameState.currentPlayer);`);
    let passi = 0;
    // Gli audit di identita' possono chiedere se specifiche carte siano
    // davvero comparse nelle zone del solo avversario. Leggere le zone evita
    // il falso positivo dei log quando anche il deck campione usa la stessa
    // carta (per esempio Slifer o Mago Nero).
    const osservaBotIds = new Set((opz.osservaBotIds || []).map(Number));
    const osservatiBot = new Set();
    const evocatiBot = new Set();
    const primaEvocazioneBot = {};
    const osservaPlayerIds = new Set((opz.osservaPlayerIds || []).map(Number));
    const osservatiPlayer = new Set();
    const LIMITE_PASSI = 200000;
    while (passi < LIMITE_PASSI) {
        passi++;
        const stato = esegui('({ fine: !!gameState.gameOver || __esitoDuello !== null, turno: gameState.turn, lp: [gameState.playerLP, gameState.botLP] })');
        if (osservaBotIds.size) {
            const mostriPresenti = esegui(`gameState.botMonsterField.filter(Boolean).map((x) => Number(x.card.id))`);
            mostriPresenti.forEach((id) => {
                if (!osservaBotIds.has(id)) return;
                evocatiBot.add(id);
                if (!primaEvocazioneBot[id]) {
                    primaEvocazioneBot[id] = esegui(`({
                        turno: gameState.turn,
                        mano: gameState.botHand.length,
                        lp: gameState.botLP,
                        posizione: (gameState.botMonsterField.find((s) => s && Number(s.card.id) === ${id}) || {}).position || null
                    })`);
                }
            });
            const presenti = esegui(`gameState.botMonsterField.concat(gameState.botSTField, [gameState.botFieldSpell], gameState.botGraveyard, gameState.botBanished)
                .filter(Boolean).map((x) => Number((x.card || x).id))`);
            presenti.forEach((id) => { if (osservaBotIds.has(id)) osservatiBot.add(id); });
        }
        if (osservaPlayerIds.size) {
            const presenti = esegui(`gameState.playerMonsterField.concat(gameState.playerSTField, [gameState.playerFieldSpell], gameState.playerGraveyard, gameState.playerBanished)
                .filter(Boolean).map((x) => Number((x.card || x).id))`);
            presenti.forEach((id) => { if (osservaPlayerIds.has(id)) osservatiPlayer.add(id); });
        }
        // Invariante: i Life Points restano numeri. Un NaN non fa fallire
        // nulla da solo (il duello continua, "LP NaN" a schermo), quindi
        // qui diventa un errore con il contesto di dove è nato.
        if (!stato.lp.every((v) => Number.isFinite(v))) {
            const coda = esegui("__logDuello.filter((r) => r.startsWith('###')).concat(__logDuello.slice(-15))");
            const campi = esegui(`JSON.stringify({
                giocatore: gameState.playerMonsterField.concat(gameState.playerSTField).map((s) => s && s.card.id + ' ' + s.card.name),
                avversario: gameState.botMonsterField.concat(gameState.botSTField).map((s) => s && s.card.id + ' ' + s.card.name)
            })`);
            throw new Error(`Life Points non numerici (${stato.lp}) al turno ${stato.turno}. Terreni: ${campi}\n  Ultime righe del log:\n    ${coda.join('\n    ')}`);
        }
        if (opz.diagnosi) esegui('__sorvegliaZone()');
        // Invariante: nella zona Mostri stanno solo mostri (anche una carta
        // mutata in mostro, come le Spirit Message o i Cappelli Magici, ha
        // type 'monster').
        const intrusi = esegui(`['player','bot'].flatMap((o) => (o === 'player' ? gameState.playerMonsterField : gameState.botMonsterField)
            .filter((s) => s && s.card && s.card.type !== 'monster').map((s) => o + ': ' + s.card.id + ' ' + s.card.name + ' (' + s.card.type + ')'))`);
        if (intrusi.length) {
            const coda = esegui("__logDuello.filter((r) => r.startsWith('###')).concat(__logDuello.slice(-15))");
            throw new Error(`Carta non-mostro nella zona Mostri al turno ${stato.turno}: ${intrusi.join(', ')}\n  Ultimo passo dell'orologio: ${orologio.ultimo}\n  Ultime righe del log:\n    ${coda.join('\n    ')}`);
        }
        if (stato.fine || stato.turno > LIMITE_TURNI) break;
        // Le Promise dell'IA (await) sono microtask: si lasciano girare
        // prima del prossimo timer.
        await new Promise((r) => setImmediate(r));
        if (!orologio.passo()) {
            // Coda vuota: un ultimo giro di microtask (una Promise appena
            // risolta può mettere in coda il passo successivo), poi, se
            // ancora nulla si muove e il duello non è finito, è uno stallo.
            await new Promise((r) => setImmediate(r));
            if (orologio.inCoda === 0) break;
        }
    }
    const fine = esegui(`({
        esito: __esitoDuello, turno: gameState.turn, lpG: gameState.playerLP, lpB: gameState.botLP,
        fasi: gameState.phase, chi: gameState.currentPlayer, log: __logDuello.slice(-12),
        eventi: Object.assign({}, __eventi),
        catena: DuelEngine.isChainActive(), finestra: DuelEngine.isPriorityWindowOpen && DuelEngine.isPriorityWindowOpen(),
        campoG: gameState.playerMonsterField.map((s) => s && (s.card.name + (s.hasAttacked ? '*' : ''))),
        campoB: gameState.botMonsterField.map((s) => s && s.card.name),
        deckBotIniziale: __deckBotIniziale,
        manoBotInizialeIds: (__manoBotIniziale || []).slice(),
        manoBotFinaleIds: gameState.botHand.map((c) => Number(c.id))
    })`);
    // Una partita che arriva al limite di turni non è ferma: è lunga. Si
    // distingue dallo stallo vero (coda vuota senza vincitore).
    const alLimite = (fine.esito === null || fine.esito === undefined) && fine.turno > LIMITE_TURNI;
    const invarianti = esegui("__logDuello.filter((r) => r.startsWith('###'))");
    // opz.cerca: quante righe del registro INTERO contengono quel testo
    // (il risultato porta solo le ultime righe). Serve a trovare la partita
    // che passa da un caso preciso, per farne uno spec.
    const trovate = opz.cerca ? esegui(`__logDuello.filter((r) => r.includes(${JSON.stringify(opz.cerca)})).length`) : 0;
    // Gli audit di identità non devono limitarsi a dire chi ha vinto: devono
    // poter confermare che un personaggio abbia davvero eseguito più piani
    // caratteristici nella stessa partita. Accettiamo quindi più frammenti
    // da contare in un solo duello, evitando di rigiocare la medesima matrice
    // una volta per ogni carta osservata.
    const cercaTutte = Array.isArray(opz.cercaTutte) ? opz.cercaTutte : [];
    const trovatePerTesto = Object.fromEntries(cercaTutte.map((testo) => [
        testo,
        esegui(`__logDuello.filter((r) => r.includes(${JSON.stringify(testo)})).length`)
    ]));
    // Solo per diagnosi puntuali: i report di massa conservano la coda breve
    // per non gonfiare migliaia di risultati. Il registro completo va chiesto
    // esplicitamente dal chiamante quando confronta pochi semi anomali.
    const registroCompleto = opz.registroCompleto ? esegui('__logDuello.slice()') : undefined;
    // opz.allaFine: un'espressione letta a partita finita (per esempio lo stato delle squadre del Tag Team).
    const extra = opz.allaFine ? esegui(opz.allaFine) : undefined;
    return { seme, passi, oraVirtualeMs: orologio.ora, alLimite, invarianti, trovate, trovatePerTesto, extra,
        osservatiBotIds: Array.from(osservatiBot), osservatiPlayerIds: Array.from(osservatiPlayer),
        evocatiBotIds: Array.from(evocatiBot), primaEvocazioneBot,
        erroriCarte: erroriCarte.slice(), registroCompleto, ...fine };
}

async function main() {
    const opz = argomenti();
    let ok = true;
    for (let n = 0; n < opz.partite; n++) {
        const t0 = Date.now();
        let r;
        try {
            r = await giocaPartita(opz, n);
        } catch (e) {
            console.error(`Partita ${n + 1} (seme ${opz.seme + n}): ERRORE\n${e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : e}`);
            ok = false;
            continue;
        }
        const esito = r.esito === true ? 'vince il giocatore' : r.esito === false ? `vince ${opz.avversario}` : r.esito === 'draw' ? 'pareggio'
            : r.alLimite ? `interrotta al limite di ${opz.turni || 60} turni` : 'NON FINITA';
        console.log(`Partita ${n + 1} (seme ${r.seme}): ${esito} al turno ${r.turno} — LP ${r.lpG} / ${r.lpB} — ${r.passi} passi, ${Math.round(r.oraVirtualeMs / 1000)} s di gioco in ${Date.now() - t0} ms reali`);
        if (r.erroriCarte.length) {
            ok = false;
            console.log(`  Errori lanciati dalle carte (${r.erroriCarte.length}):\n    ${[...new Set(r.erroriCarte)].slice(0, 5).join('\n    ')}`);
        }
        if (r.invarianti.length) {
            ok = false;
            console.log(`  Invarianti rotti:\n    ${r.invarianti.join('\n    ')}`);
        }
        if ((r.esito === null || r.esito === undefined) && !r.alLimite) {
            ok = false;
            console.log(`  fermo in fase ${r.fasi}, di turno ${r.chi}; catena ${r.catena}, finestra ${r.finestra}`);
            console.log(`  campo giocatore ${JSON.stringify(r.campoG)} / avversario ${JSON.stringify(r.campoB)}`);
            console.log(`  Ultime righe del log:\n    ${r.log.join('\n    ')}`);
        }
        if (opz.superficie) {
            const voci = Object.entries(r.eventi).sort((a, b) => b[1] - a[1]);
            console.log(`  Eventi emessi dalle regole verso l'interfaccia (${voci.length}): ${voci.map(([k, v]) => `${k}×${v}`).join(', ')}`);
        }
    }
    process.exit(ok ? 0 : 1);
}

if (require.main === module) main();
module.exports = { giocaPartita, creaContesto, creaOrologio, prng, SCRIPT };
