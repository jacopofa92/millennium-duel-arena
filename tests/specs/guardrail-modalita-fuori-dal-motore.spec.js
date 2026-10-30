// Guardrail statico: le modalità aggiuntive (Puzzle, Rivincite, Torre,
// Settimana, Caccia, Tag Team) restano FUORI dal motore di Duel Monsters, che
// l'utente vuole poter riusare così com'è ("la cosa fondamentale è non
// inquinare il motore").
//  1. Nessun file del motore, degli effetti delle carte o dell'IA nomina le
//     modalità: il motore non deve sapere che esistono.
//  2. I file di js/modes/ sostituiscono su window (o globalThis) solo i punti
//     di aggancio previsti (preparaManiIniziali, come il Tutorial) e i propri
//     oggetti. Una modalità che avvolgesse una funzione di regola andrebbe
//     discussa prima, non scoperta dopo.
//  3. Nessun file di modalità sostituisce una funzione di un oggetto del
//     motore (Comandi.esegui = ..., DuelEngine.x = ...), tranne le eccezioni
//     dichiarate qui sotto, ciascuna col suo motivo.
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const leggi = (cartella) => fs.readdirSync(path.join(RADICE, cartella))
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ nome: cartella + '/' + f, testo: fs.readFileSync(path.join(RADICE, cartella, f), 'utf8') }));

const NOMI_DELLE_MODALITA = /ModalitaDuello|ModalitaExtra|puzzlesDatabase|rivinciteDatabase|torreDatabase|settimanaDatabase|cacciaDatabase|tagDatabase|\bTorre\.|\bSettimana\.|\bCaccia\.|\bTagTeam\b|js\/modes\//;
// Ciò che un file di modalità può assegnare su window/globalThis.
const ASSEGNAZIONI_AMMESSE = new Set([
    'ModalitaDuello', 'Torre', 'preparaManiIniziali', 'DuelDialogues', 'onbeforeunload',
    'puzzlesDatabase', 'rivinciteDatabase', 'torreDatabase', 'settimanaDatabase', 'cacciaDatabase',
    'TagTeam', 'ModeUnlocks'
]);
// Oggetti del motore le cui funzioni una modalità non deve sostituire.
const OGGETTI_DEL_MOTORE = ['Comandi', 'DuelEngine', 'EventiDuello', 'Decisioni', 'Tavolo', 'PassoComune', 'CardEffects'];
// Eccezioni dichiarate (file -> sostituzione -> motivo), discusse con l'autore.
const SOSTITUZIONI_DICHIARATE = {
    'js/modes/tag.js': {
        'esegui': 'conta gli attacchi in corso (non cambia il comando): il compagno entra tra una battaglia e l\'altra, mai a metà (D15 del piano Tag Team)'
    }
};

module.exports = {
    standalone: true,
    name: 'Guardrail: le modalità aggiuntive non toccano il motore, e il motore non le conosce',
    async run(t) {
        const motore = leggi('js/engine').concat(leggi('js/ai'));
        t.assert(motore.length >= 20, `Attesi i file del motore e dell'IA, trovati ${motore.length}: il controllo non legge più le cartelle?`);
        const nominano = motore.filter((f) => NOMI_DELLE_MODALITA.test(f.testo)).map((f) => f.nome);
        t.assert(nominano.length === 0, `File del motore/IA che nominano le modalità aggiuntive:\n  - ${nominano.join('\n  - ')}`);

        const modalita = leggi('js/modes').concat(['js/data/puzzles-db.js', 'js/data/rivincite-db.js', 'js/data/torre-db.js', 'js/data/settimana-db.js', 'js/data/caccia-db.js', 'js/data/tag-db.js']
            .map((n) => ({ nome: n, testo: fs.readFileSync(path.join(RADICE, n), 'utf8') })));
        t.assert(modalita.length >= 7, `Attesi i file delle modalità, trovati ${modalita.length}`);
        const vietate = [];
        modalita.forEach((f) => {
            // window.X = …, globalThis.X = …, e g.X = … (g è il nome di globalThis nei file che girano anche in Node).
            const re = /(?:\bwindow|\bglobalThis|\bg)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g;
            let m;
            while ((m = re.exec(f.testo))) {
                if (!ASSEGNAZIONI_AMMESSE.has(m[1])) vietate.push(`${f.nome}: ${m[0].replace(/\s*=$/, '')} = …`);
            }
        });
        t.assert(vietate.length === 0, `Un file di modalità sostituisce qualcosa fuori dai punti di aggancio previsti:\n  - ${vietate.join('\n  - ')}`);

        // 3) Funzioni degli oggetti del motore sostituite: sia per nome (Comandi.esegui = …) sia tramite un alias
        //    preso da quell'oggetto (const C = g.Comandi; C.esegui = …).
        const sostituite = [];
        modalita.forEach((f) => {
            const alias = new Set(OGGETTI_DEL_MOTORE);
            for (const a of f.testo.matchAll(/const\s+(\w+)\s*=\s*(?:\w+\.)?(\w+)\s*;/g)) {
                if (OGGETTI_DEL_MOTORE.includes(a[2])) alias.add(a[1]);
            }
            for (const s of f.testo.matchAll(/\b(\w+)\.(\w+)\s*=(?!=)\s*function/g)) {
                if (!alias.has(s[1])) continue;
                const dichiarata = SOSTITUZIONI_DICHIARATE[f.nome] && SOSTITUZIONI_DICHIARATE[f.nome][s[2]];
                if (!dichiarata) sostituite.push(`${f.nome}: ${s[1]}.${s[2]} = function …`);
            }
        });
        t.assert(sostituite.length === 0, `Un file di modalità sostituisce una funzione del motore senza un'eccezione dichiarata in questo spec:\n  - ${sostituite.join('\n  - ')}`);
    }
};
