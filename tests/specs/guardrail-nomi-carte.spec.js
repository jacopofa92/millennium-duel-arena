// Guardrail: le ricerche di carte PER NOME nel codice trovano ancora le carte che devono trovare.
// =====================================================================
// Molti effetti riconoscono altre carte dal nome ("un mostro Ingranaggio Antico", "Sorelle Arpie", "Occhi Rossi"...) e lo
// stesso fanno le funzioni di archetipo, i nomi effettivi/citati e i pacchetti a tema del Negozio. Un nome cambiato (come
// quando sono stati allineati ai nomi ufficiali Konami) puo' far smettere una ricerca di trovare una carta, o fargliene
// trovare una in piu', senza un solo errore.
//
// Il registro tests/data/ricerche-per-nome.json congela, per ogni ricerca, le carte (id) che trova. Se questo test fallisce:
//   - hai cambiato il nome di una carta, o ne hai aggiunta una che una ricerca per nome ora trova/non trova piu';
//   - oppure hai scritto una nuova ricerca per nome nel motore.
// Guarda l'elenco qui sotto: se il cambiamento e' voluto, aggiorna il registro con
//     node tests/helpers/ricerche-per-nome.js --aggiorna
// se non lo e', correggi la ricerca (o il nome) finche' trova le stesse carte di prima.
const { estraiRicerche, registroAttuale, registroSalvato, caricaCarte } = require('../helpers/ricerche-per-nome');

module.exports = {
    name: 'Guardrail: le ricerche per nome nel codice trovano le carte attese',
    standalone: true,
    async run({ assert }) {
        const nomi = new Map(caricaCarte().map((c) => [c.id, c.name]));
        const etichetta = (ids) => ids.map((i) => i + ' ' + nomi.get(i)).join('; ');
        const diff = (att, atteso) => {
            const A = new Set(att), B = new Set(atteso);
            return { inPiu: att.filter((i) => !B.has(i)), mancanti: atteso.filter((i) => !A.has(i)) };
        };
        const salvato = registroSalvato();
        const attuale = registroAttuale();
        const problemi = [];

        // 1) ricerche per nome scritte nel codice del motore
        for (const r of estraiRicerche()) {
            const dove = r.file + ':' + r.righe[0];
            if (!(r.chiave in salvato.ricerche)) { problemi.push(`NUOVA ricerca per nome non registrata: ${r.chiave} (${dove}); trova ${attuale.ricerche[r.chiave].length} carte`); continue; }
            const d = diff(attuale.ricerche[r.chiave], salvato.ricerche[r.chiave]);
            if (d.inPiu.length || d.mancanti.length) problemi.push(`${r.chiave} (${dove}): ora trova in piu' [${etichetta(d.inPiu)}], non trova piu' [${etichetta(d.mancanti)}]`);
        }
        for (const k of Object.keys(salvato.ricerche)) if (!(k in attuale.ricerche)) problemi.push(`ricerca registrata ma sparita dal codice: ${k}`);

        // 2) funzioni del motore che identificano le carte per nome
        const confrontaGruppo = (nome, att, sal) => {
            if (att === undefined || sal === undefined) { problemi.push(`gruppo ${nome} mancante`); return; }
            if (Array.isArray(att)) {
                const d = diff(att, sal);
                if (d.inPiu.length || d.mancanti.length) problemi.push(`${nome}: ora in piu' [${etichetta(d.inPiu)}], non piu' [${etichetta(d.mancanti)}]`);
                return;
            }
            for (const k of new Set([...Object.keys(att), ...Object.keys(sal)])) confrontaGruppo(nome + '(' + k + ')', att[k], sal[k]);
        };
        confrontaGruppo('funzione', attuale.funzioni, salvato.funzioni);

        assert(problemi.length === 0, 'Le ricerche per nome non coincidono col registro (' + problemi.length + '):\n  - ' + problemi.join('\n  - ')
            + '\nSe il cambiamento e\' voluto: node tests/helpers/ricerche-per-nome.js --aggiorna');
    }
};
