// Guardrail statico: i gruppi di <script> scritti nelle pagine (e in sw.js)
// coincidono con la lista unica scripts/gruppi-script.js, e ogni pagina che
// carica il motore lo fa attraverso il gruppo, non con tag scritti a mano.
//
// Perché: la stessa lista di file del motore era copiata a mano in cinque
// pagine e in sw.js. Il nucleo sta per essere diviso in file più piccoli
// (piano di attacco, Priorità 2): senza una lista unica, ogni file nuovo
// andrebbe aggiunto in sei punti, e dimenticarne uno lascia una pagina
// senza un pezzo del motore. Vedi l'intestazione di scripts/gruppi-script.js.
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'Guardrail: i gruppi di <script> delle pagine coincidono con scripts/gruppi-script.js',
    async run(t) {
        const radice = path.join(__dirname, '..', '..');
        const { riscrivi, fileCandidati } = require(path.join(radice, 'scripts', 'sync-script-groups.js'));
        const gruppi = require(path.join(radice, 'scripts', 'gruppi-script.js'));

        const problemi = [];
        let zone = 0;
        fileCandidati().forEach((file) => {
            const testo = fs.readFileSync(file, 'utf8');
            const nome = path.basename(file);
            const r = riscrivi(testo, nome);
            problemi.push(...r.errori);
            zone += r.zone.length;
            if (r.testo !== testo) problemi.push(`${nome}: gruppi non allineati (${r.zone.join(', ')}) — lancia node scripts/sync-script-groups.js`);
            // Un file del motore caricato FUORI dal gruppo vuol dire una
            // copia a mano che il generatore non aggiornerà mai.
            const fuori = testo.split(/\r?\n/).filter((riga, i, righe) => {
                if (!gruppi.motore.some((f) => riga.includes(`"${f}"`) || riga.includes(`'${f}'`))) return false;
                // dentro una zona? cerca all'indietro il marcatore di apertura
                for (let k = i - 1; k >= 0; k--) {
                    if (/gruppo-script:motore/.test(righe[k])) return /\/gruppo-script:motore/.test(righe[k]);
                }
                return true;
            });
            if (fuori.length) problemi.push(`${nome}: file del motore caricati fuori dal gruppo "motore": ${fuori.map((r) => r.trim()).join(' | ')}`);
        });
        // Il motore lo caricano ormai solo duelMonstersCore.html, crea-carta.html e sw.js (Cartoteca, Creazione Deck e la
        // vista Cartoteca del menu usano l'elenco generato, vedi guardrail-elenco-effetti.spec.js): zone conta tutti i gruppi.
        t.assert(zone >= 4, `Attese almeno 4 zone di gruppi di script nelle pagine e in sw.js, trovate ${zone}`);
        t.assert(problemi.length === 0, `Gruppi di script:\n  - ${problemi.join('\n  - ')}`);
    }
};
