// Il nucleo senza testa: duelli interi in Node, senza browser.
//
// Traguardo della Priorità 2 del piano di attacco. tools/duello-senza-testa.js
// carica solo dati, motore, regole e IA (niente game-flow.js né actions.js,
// nessun DOM) e fa giocare duelli fino alla fine. Questo spec ne gioca
// alcuni a seme fisso, con la diagnosi accesa, e boccia se:
//  - una partita si ferma senza un vincitore (stallo del motore);
//  - una carta lancia un errore (nel browser finirebbe solo in console);
//  - un invariante si rompe (Life Points non numerici, una carta non-mostro
//    nella zona Mostri).
// Al primo giro ha trovato quattro difetti veri, presenti anche nel
// browser: gli Spirito che non tornavano in mano, quattro Magie Rituali
// che potevano Evocare la carta sbagliata, Egoista Elegante che Evocava una
// Magia, il Bozzolo dell'Evoluzione in errore ad ogni ricalcolo.
//
// Dalla Priorità 3 (posti al tavolo, js/engine/tavolo.js) i due lati sono
// entrambi l'IA vera: alcune partite danno al posto 'player' il mazzo di un
// personaggio, e una prova a parte controlla che quel posto vinca almeno
// una volta — cioè che l'IA giochi davvero anche da lì, non solo che il
// duello arrivi in fondo.
//
// Standalone: non apre pagine. Gira in pochi secondi.
const path = require('path');

const PARTITE = [
    { avversario: 'kaiba', livello: 'hard', seme: 900 },
    { avversario: 'kaiba', livello: 'hard', giocatore: 'yamiYugi', livelloGiocatore: 'hard', seme: 100 },
    { avversario: 'pegasus', livello: 'medium', giocatore: 'joey', livelloGiocatore: 'easy', seme: 7 },
    { avversario: 'yamiYugi', livello: 'hard', seme: 501 },
    { avversario: 'pegasus', livello: 'medium', seme: 300 },
    { avversario: 'mai', livello: 'medium', seme: 305 },
    { avversario: 'joey', livello: 'easy', seme: 302 },
    { avversario: 'marik', livello: 'hard', seme: 304 },
    { avversario: 'espa_roba', livello: 'easy', seme: 505 },
    { avversario: 'bandit_keith', livello: 'hard', seme: 204 }
];

module.exports = {
    name: 'Nucleo senza testa: duelli interi in Node, senza errori di carta né invarianti rotti',
    standalone: true,
    async run({ assert }) {
        const { giocaPartita } = require(path.join(__dirname, '..', '..', 'tools', 'duello-senza-testa.js'));
        const problemi = [];
        for (const p of PARTITE) {
            const r = await giocaPartita(Object.assign({ diagnosi: true, turni: 60 }, p), 0);
            const dove = `${p.avversario} ${p.livello} seme ${p.seme}`;
            const finita = r.esito === true || r.esito === false || r.esito === 'draw' || r.alLimite;
            if (!finita) problemi.push(`${dove}: ferma al turno ${r.turno} in fase ${r.fasi} (di turno ${r.chi})`);
            if (r.erroriCarte.length) problemi.push(`${dove}: errori di carta — ${[...new Set(r.erroriCarte)].slice(0, 3).join(' | ')}`);
            if (r.invarianti.length) problemi.push(`${dove}: ${r.invarianti.join(' | ')}`);
        }
        assert(problemi.length === 0, `Duelli senza testa:\n  - ${problemi.join('\n  - ')}`);

        // L'IA gioca davvero dal posto 'player': fra Yami Yugi e Kaiba (stesso
        // livello, mazzi di pari peso) su quattro partite a seme fisso ne
        // vince almeno una. Con l'IA ferma su quel lato perderebbe sempre.
        let vittoriePlayer = 0;
        for (let n = 0; n < 4; n++) {
            const r = await giocaPartita({ avversario: 'kaiba', livello: 'hard', giocatore: 'yamiYugi', livelloGiocatore: 'hard', seme: 100, turni: 60 }, n);
            if (r.esito === true) vittoriePlayer++;
        }
        assert(vittoriePlayer >= 1, `L'IA dal posto 'player' (Yami Yugi) non vince nessuna delle 4 partite contro Kaiba: gioca davvero da quel lato?`);

        // Per l'audit fattoriale IA e deck avversario devono essere due
        // variabili indipendenti: stessa IA hard, ma liste easy/hard diverse.
        const deckEasy = await giocaPartita({ avversario: 'kaiba', livello: 'hard', livelloDeckAvversario: 'easy', seme: 812, turni: 10 }, 0);
        const deckHard = await giocaPartita({ avversario: 'kaiba', livello: 'hard', livelloDeckAvversario: 'hard', seme: 812, turni: 10 }, 0);
        assert(deckEasy.deckBotIniziale && deckHard.deckBotIniziale
            && deckEasy.deckBotIniziale !== deckHard.deckBotIniziale,
        'Il duello senza testa deve poter cambiare il deck avversario senza cambiare il livello della sua IA');

        // Il bersaglio di un attacco che lascia il campo prima del calcolo
        // dei danni (battaglia.js, resolveAttack): prima resolveBattleDamage
        // leggeva la sua casella vuota ed esplodeva ("Cannot read properties
        // of null (reading 'card')", l'errore raro del test del bot). Questa
        // partita passa da lì: deve arrivare in fondo e averlo attraversato.
        // Il bilanciamento dei mazzi/IA può cambiare quali semi attraversano
        // il caso. Il 235 è la riproduzione corrente verificata sul roster
        // attuale (2026-10-21: il 235 con Pegasus/Joey non lo attraversava più,
        // trovato Bandit Keith/Mai col seme 8); l'asserzione `trovate` impedisce
        // che il test passi se in futuro il percorso non viene più esercitato.
        const bersaglioSparito = await giocaPartita({ avversario: 'bandit_keith', giocatore: 'mai', livello: 'medium', seme: 8, turni: 60, cerca: 'non è più sul Terreno' }, 0);
        assert(bersaglioSparito.trovate >= 1 && bersaglioSparito.esito !== null && !bersaglioSparito.erroriCarte.length,
            `La partita col bersaglio sparito prima del calcolo dei danni deve attraversare il caso e finire: ${JSON.stringify({ trovate: bersaglioSparito.trovate, esito: bersaglioSparito.esito })}`);
    }
};
