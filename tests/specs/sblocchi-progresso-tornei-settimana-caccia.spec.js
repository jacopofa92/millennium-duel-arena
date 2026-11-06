// Blocchi del progresso (js/modes/mode-unlocks.js): Duello della Settimana (300 carte diverse), Caccia al Boss (arco Mondo Virtuale),
// i tre Tornei (Regno, Battle City parte 2, Kaiba battuto nel torneo di Forbidden Memories) e la voce Tornei del menu, bloccata solo
// se lo sono TUTTI. Contesto finto come nello spec degli sblocchi delle modalita': nessun browser.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.resolve(__dirname, '..', '..');
const leggi = (file) => fs.readFileSync(path.join(RADICE, file), 'utf8');

module.exports = {
    name: 'Sblocchi: Settimana a 300 carte, Caccia dopo il Mondo Virtuale, Tornei dopo i rispettivi archi',
    async run(t) {
        const indice = leggi('index.html');
        t.assert(/richiedeModalita:\s*'tornei'/.test(indice) && /richiedeModalita:\s*'settimana'/.test(indice) && /richiedeModalita:\s*'caccia'/.test(indice),
            'Tornei, Settimana e Caccia dichiarano il blocco nel menu');
        const pagine = { 'settimana.html': 'settimana', 'caccia-boss.html': 'caccia', 'tornei.html': 'tornei',
            'torneo-regno-duellanti.html': 'torneo-regno', 'torneo-battle-city.html': 'torneo-battlecity', 'torneo-kaiba.html': 'torneo-kaiba' };
        Object.keys(pagine).forEach((f) => t.assert(leggi(f).indexOf(`ModeUnlocks.proteggiPagina('${pagine[f]}')`) !== -1, `${f} applica il blocco anche all'URL diretto`));

        const save = { story: {}, acquisition: {}, collection: {}, tornei: {} };
        const context = {
            window: {}, sessionStorage: { setItem() {} },
            SaveManager: {
                getStoryState(id) { return save.story[id] || null; },
                getCardAcquisitionState() { return JSON.parse(JSON.stringify(save.acquisition)); },
                setCardAcquisitionState(s) { save.acquisition = s; },
                getCollection() { return save.collection; },
                getTournamentState(id) { return save.tornei[id] || null; }
            }
        };
        context.window = context;
        vm.runInNewContext(leggi('js/modes/mode-unlocks.js'), context);
        const U = context.ModeUnlocks;
        const ok = (id) => U.stato(id).sbloccato;

        // Salvataggio nuovo: tutto chiuso, e la voce Tornei con lui.
        t.assert(!ok('settimana') && !ok('caccia') && !ok('torneo-regno') && !ok('torneo-battlecity') && !ok('torneo-kaiba') && !ok('tornei'),
            'Un salvataggio nuovo ha tutto chiuso');
        t.assert(/300/.test(U.stato('settimana').motivo) && /Mondo Virtuale/.test(U.stato('caccia').motivo), 'I motivi dicono cosa serve');

        // Settimana: 299 carte diverse no, 300 si' (le copie non contano, una carta a zero neppure).
        for (let i = 1; i <= 299; i++) save.collection[i] = 3;
        save.collection[999] = 0;
        t.assert(!ok('settimana'), '299 carte diverse (anche con tre copie ciascuna) non bastano');
        save.collection[300] = 1;
        t.assert(ok('settimana'), '300 carte diverse sbloccano il Duello della Settimana');

        // Caccia: arco "Il Mondo Virtuale".
        save.acquisition = { completedChapters: { virtuale: true } };
        t.assert(ok('caccia') && !ok('torneo-regno'), 'Finito il Mondo Virtuale si apre la Caccia al Boss e nient\'altro');

        // Tornei, uno alla volta, e la voce del menu si apre appena ce n'e' uno.
        save.acquisition = { completedChapters: { regno: true } };
        t.assert(ok('torneo-regno') && !ok('torneo-battlecity') && !ok('torneo-kaiba') && ok('tornei'), 'Finito il Regno: solo il torneo del Regno, e la voce Tornei si apre');
        save.acquisition = { completedChapters: { battlecity2: true } };
        t.assert(!ok('torneo-regno') && ok('torneo-battlecity') && ok('tornei'), 'Battle City parte 2 apre solo Battle City');

        // Kaiba: la prova 'fm-3t-kaiba' (decima del tabellone, indice 9) superata a un livello qualunque; poi si ricorda per sempre.
        save.acquisition = {};
        save.story['forbiddenMemories@normale'] = { sotto: { 'fm-3-torneo': 9 } };
        t.assert(!ok('torneo-kaiba'), 'Arrivati a Kaiba ma non battuto: chiuso');
        save.story['forbiddenMemories@normale'] = { sotto: { 'fm-3-torneo': 10 } };
        t.assert(ok('torneo-kaiba') && ok('tornei'), 'Battuto Kaiba nel torneo: si apre il Torneo Kaiba');
        save.story = {};
        t.assert(ok('torneo-kaiba'), 'Un "Ricomincia" della Storia non lo richiude (marcatore permanente)');

        // Chi aveva gia' cominciato un torneo non viene chiuso fuori.
        save.acquisition = {};
        save.tornei.duelistKingdom = { stars: 2 };
        t.assert(ok('torneo-regno') && !ok('torneo-battlecity'), 'Un torneo gia\' iniziato resta aperto');

        // Nei test (AUTH_GATE_SKIP) i blocchi si saltano, tranne dove si provano davvero.
        context.AUTH_GATE_SKIP = true;
        t.assert(ok('settimana') && ok('caccia') && ok('torneo-battlecity') && ok('torneo-kaiba'), 'Con AUTH_GATE_SKIP i blocchi si saltano');
        context.MODE_UNLOCKS_REALI = true;
        save.collection = {};
        t.assert(!ok('settimana'), 'MODE_UNLOCKS_REALI li rende veri anche nei test');
    }
};
