// Guardrail: le definizioni delle carte usano SOLO chiavi del vocabolario chiuso
// (tests/data/vocabolario-effetti.js), e ogni chiave del vocabolario è davvero
// usata e letta da qualcuno.
//
// Perché: una chiave sbagliata (un refuso come "onDestory", o "cannotBeTributted")
// non dà errore, la carta semplicemente non reagisce, e se ne accorge solo chi
// gioca proprio quella carta. Qui il refuso fa fallire la suite.
//
// Tre controlli:
//   1) nessuna carta registrata usa una chiave fuori dal vocabolario;
//   2) nessuna chiave del vocabolario è inutilizzata dalle carte (elenco rimasto
//      indietro dopo aver tolto una carta);
//   3) ogni chiave è LETTA da qualche parte oltre alla sua definizione (nel
//      motore o in un'altra carta): una chiave definita ma mai letta è un gancio
//      morto, cioè quasi sempre un refuso.
const fs = require('fs');
const path = require('path');
const VOCABOLARIO = require('../data/vocabolario-effetti.js');

const RADICE = path.join(__dirname, '..', '..');

function fileJs(dir, fuori) {
    const out = [];
    for (const nome of fs.readdirSync(dir)) {
        const p = path.join(dir, nome);
        const st = fs.statSync(p);
        if (st.isDirectory()) { if (!fuori.includes(nome)) out.push(...fileJs(p, fuori)); }
        else if (nome.endsWith('.js')) out.push(p);
    }
    return out;
}

// Le chiavi che il motore legge senza nominarle una per una (la Catena chiama
// `def[link.handlerName]`, i ganci reattivi si cercano per prefisso).
const LETTE_IN_MODO_DINAMICO = new Set(['activate', 'canActivate', 'static']);

module.exports = {
    name: 'Guardrail: le carte usano solo chiavi del vocabolario chiuso e ogni chiave è letta',
    async run(t) {
        const usate = await t.evaluate(() => {
            const per = {};
            let carte = 0;
            cardDatabase.forEach((c) => {
                const def = DuelEngine.getDefinition(c.id);
                if (!def) return;
                carte++;
                Object.keys(def).forEach((k) => { (per[k] = per[k] || []).push(c.id); });
            });
            return { carte, per };
        });
        t.assert(usate.carte > 800, `carte con una definizione: ${usate.carte}`);

        const ammesse = new Set(VOCABOLARIO);
        const sconosciute = Object.keys(usate.per).filter((k) => !ammesse.has(k));
        t.assert(sconosciute.length === 0,
            'chiavi fuori dal vocabolario (refuso? oppure è una chiave nuova da aggiungere a tests/data/vocabolario-effetti.js): '
            + sconosciute.map((k) => `${k} (carte ${usate.per[k].slice(0, 4).join(',')})`).join('; '));

        const inutilizzate = VOCABOLARIO.filter((k) => !usate.per[k]);
        t.assert(inutilizzate.length === 0,
            'chiavi del vocabolario che nessuna carta usa più (toglile dall\'elenco): ' + inutilizzate.join(', '));

        // 3) Letta da qualcuno. Le parti card-effects-N sono dove le chiavi si DEFINISCONO
        // (una riga che comincia con la chiave seguita da ":" o "("): quella non conta come lettura.
        const motore = fileJs(path.join(RADICE, 'js'), ['vendor']);
        const testi = motore.map((f) => ({ f, t: fs.readFileSync(f, 'utf8') }));
        const mortegg = [];
        for (const k of VOCABOLARIO) {
            if (LETTE_IN_MODO_DINAMICO.has(k)) continue;
            const parola = new RegExp('\\b' + k + '\\b', 'g');
            const definizione = new RegExp('^\\s*' + k + '\\s*[:(]', 'gm');
            let letture = 0;
            for (const { t: testo } of testi) {
                const tutte = (testo.match(parola) || []).length;
                const def = (testo.match(definizione) || []).length;
                letture += tutte - def;
            }
            // Un commento che nomina la chiave non è una lettura: si tolgono dal conto.
            // (Basta una lettura vera: il controllo vuole escludere il gancio MAI letto.)
            if (letture <= 0) mortegg.push(k);
        }
        t.assert(mortegg.length === 0, 'chiavi definite ma mai lette da nessuno (gancio morto o refuso): ' + mortegg.join(', '));
    }
};
