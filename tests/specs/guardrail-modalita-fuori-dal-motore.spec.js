// Guardrail statico: le modalità aggiuntive (Puzzle, Rivincite, Torre)
// restano FUORI dal motore di Duel Monsters, che l'utente vuole poter
// riusare così com'è ("la cosa fondamentale è non inquinare il motore").
//  1. Nessun file del motore, degli effetti delle carte o dell'IA nomina le
//     modalità: il motore non deve sapere che esistono.
//  2. I file di js/modes/ sostituiscono su window solo i punti di aggancio
//     previsti (preparaManiIniziali, come il Tutorial) e i propri oggetti.
//     Una modalità che avvolgesse una funzione di regola andrebbe discussa
//     prima, non scoperta dopo.
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const leggi = (cartella) => fs.readdirSync(path.join(RADICE, cartella))
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ nome: cartella + '/' + f, testo: fs.readFileSync(path.join(RADICE, cartella, f), 'utf8') }));

const NOMI_DELLE_MODALITA = /ModalitaDuello|ModalitaExtra|puzzlesDatabase|rivinciteDatabase|torreDatabase|settimanaDatabase|cacciaDatabase|\bTorre\.|\bSettimana\.|\bCaccia\.|js\/modes\//;
// Ciò che un file di modalità può assegnare su window.
const ASSEGNAZIONI_AMMESSE = new Set([
    'ModalitaDuello', 'Torre', 'preparaManiIniziali', 'DuelDialogues', 'onbeforeunload',
    'puzzlesDatabase', 'rivinciteDatabase', 'torreDatabase', 'settimanaDatabase', 'cacciaDatabase'
]);

module.exports = {
    standalone: true,
    name: 'Guardrail: le modalità aggiuntive non toccano il motore, e il motore non le conosce',
    async run(t) {
        const motore = leggi('js/engine').concat(leggi('js/ai'));
        t.assert(motore.length >= 20, `Attesi i file del motore e dell'IA, trovati ${motore.length}: il controllo non legge più le cartelle?`);
        const nominano = motore.filter((f) => NOMI_DELLE_MODALITA.test(f.testo)).map((f) => f.nome);
        t.assert(nominano.length === 0, `File del motore/IA che nominano le modalità aggiuntive:\n  - ${nominano.join('\n  - ')}`);

        const modalita = leggi('js/modes').concat(['js/data/puzzles-db.js', 'js/data/rivincite-db.js', 'js/data/torre-db.js', 'js/data/settimana-db.js', 'js/data/caccia-db.js']
            .map((n) => ({ nome: n, testo: fs.readFileSync(path.join(RADICE, n), 'utf8') })));
        t.assert(modalita.length >= 7, `Attesi i file delle modalità, trovati ${modalita.length}`);
        const vietate = [];
        modalita.forEach((f) => {
            const re = /window\.([A-Za-z_$][\w$]*)\s*=(?!=)/g;
            let m;
            while ((m = re.exec(f.testo))) {
                if (!ASSEGNAZIONI_AMMESSE.has(m[1])) vietate.push(`${f.nome}: window.${m[1]} = …`);
            }
        });
        t.assert(vietate.length === 0, `Un file di modalità sostituisce qualcosa fuori dai punti di aggancio previsti:\n  - ${vietate.join('\n  - ')}`);
    }
};
