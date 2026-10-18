// Guardrail: le azioni che il motore offre alle carte (DuelEngine.actions, cioè
// `ctx.destroyMonster`, `ctx.specialSummon`...) e la loro descrizione in
// types/motore.d.ts (interfaccia EngineActions) non devono scollarsi.
//
// Perché: i tipi servono a chi scrive una carta (nell'editor e con
// `npm run typecheck`). Se un'azione nuova non è descritta non si vede, e se
// una descritta non esiste più o ha un parametro in meno/in più la
// descrizione mente. Tre controlli:
//   1) stesso ELENCO di nomi (nessuna azione senza tipo, nessun tipo senza azione);
//   2) il numero di parametri dichiarati nel tipo è compatibile con la funzione
//      vera (un parametro non dichiarato, o uno dichiarato che non esiste);
//   3) ogni chiave del contesto base (`makeContext`) è descritta da EngineActions
//      o CardContext.
// Il tipo di ogni parametro NON si controlla (lo fa `npm run typecheck` sulle
// carte che usano // @ts-check): qui si evita solo la deriva più comune.
const fs = require('fs');
const path = require('path');

const TIPI = fs.readFileSync(path.join(__dirname, '..', '..', 'types', 'motore.d.ts'), 'utf8');

/** Il corpo di `interface <nome> ... {` fino alla graffa che la chiude. */
function corpoInterfaccia(nome) {
    const inizio = TIPI.indexOf('interface ' + nome);
    if (inizio < 0) throw new Error('interfaccia non trovata: ' + nome);
    const apri = TIPI.indexOf('{', inizio);
    let profondita = 0;
    for (let i = apri; i < TIPI.length; i++) {
        if (TIPI[i] === '{') profondita++;
        else if (TIPI[i] === '}') { profondita--; if (profondita === 0) return TIPI.slice(apri + 1, i); }
    }
    throw new Error('interfaccia non chiusa: ' + nome);
}

/** Divide una lista di parametri sulle virgole di primo livello (non dentro <>, (), {}, []). */
function contaParametri(testo) {
    let n = 0; let profondita = 0; let vuoto = true;
    for (let i = 0; i < testo.length; i++) {
        const c = testo[i];
        if ('<({['.includes(c)) profondita++;
        // La freccia di una funzione (=>) non chiude nessuna parentesi.
        else if (c === '>' && testo[i - 1] === '=') continue;
        else if ('>)}]'.includes(c)) profondita--;
        else if (c === ',' && profondita === 0) { n++; continue; }
        if (!/\s/.test(c)) vuoto = false;
    }
    return vuoto ? 0 : n + 1;
}

/** { nome: numero di parametri } dalle dichiarazioni di METODO dell'interfaccia (a livello 1). */
function metodi(corpo) {
    const out = {};
    // Per nome: `nome(` ... `)` con parentesi bilanciate, solo a livello 1 dell'interfaccia.
    const re = /(?:^|\n)\s{4}(\w+)\??\(/g;
    let m;
    while ((m = re.exec(corpo))) {
        let i = re.lastIndex; let p = 1; const da = i;
        while (i < corpo.length && p > 0) { if (corpo[i] === '(') p++; else if (corpo[i] === ')') p--; i++; }
        out[m[1]] = contaParametri(corpo.slice(da, i - 1));
    }
    return out;
}

/** Chiavi (metodi E proprietà) dell'interfaccia, a livello 1. */
function chiavi(corpo) {
    const out = new Set();
    const re = /(?:^|\n)\s{4}(\w+)\??\s*[:(<]/g;
    let m;
    while ((m = re.exec(corpo))) out.add(m[1]);
    return out;
}

module.exports = {
    name: 'Guardrail: le azioni del motore e types/motore.d.ts descrivono le stesse cose',
    async run(t) {
        const vere = await t.evaluate(() => {
            const azioni = DuelEngine.actions;
            const info = {};
            Object.keys(azioni).forEach((k) => {
                const sorgente = String(azioni[k]);
                const apri = sorgente.indexOf('(');
                let p = 1; let i = apri + 1;
                while (i < sorgente.length && p > 0) { if (sorgente[i] === '(') p++; else if (sorgente[i] === ')') p--; i++; }
                const lista = sorgente.slice(apri + 1, i - 1);
                info[k] = { lunghezza: azioni[k].length, predefiniti: (lista.match(/=(?!=|>)/g) || []).length };
            });
            return { info, ctx: Object.keys(DuelEngine.makeContext('player', {})) };
        });

        const corpoAzioni = corpoInterfaccia('EngineActions');
        const corpoCtx = corpoInterfaccia('CardContext');
        const tipiAzioni = metodi(corpoAzioni);
        const nomiVeri = Object.keys(vere.info);

        // 1) Stesso elenco
        const senzaTipo = nomiVeri.filter((k) => !(k in tipiAzioni));
        t.assert(senzaTipo.length === 0, 'azioni del motore NON descritte in EngineActions (types/motore.d.ts): ' + senzaTipo.join(', '));
        const senzaAzione = Object.keys(tipiAzioni).filter((k) => !(k in vere.info));
        t.assert(senzaAzione.length === 0, 'EngineActions descrive azioni che il motore non ha: ' + senzaAzione.join(', '));

        // 2) Numero di parametri compatibile
        const incoerenti = [];
        nomiVeri.forEach((k) => {
            const dichiarati = tipiAzioni[k];
            const { lunghezza, predefiniti } = vere.info[k];
            // `lunghezza` esclude i parametri con valore predefinito (e quelli dopo): il tipo li può dichiarare opzionali.
            if (dichiarati < lunghezza) incoerenti.push(`${k}: la funzione ha ${lunghezza} parametri, il tipo ne dichiara ${dichiarati}`);
            else if (dichiarati > lunghezza + predefiniti + 2) incoerenti.push(`${k}: il tipo dichiara ${dichiarati} parametri, la funzione ${lunghezza}`);
        });
        t.assert(incoerenti.length === 0, 'parametri non coerenti fra azioni e tipi: ' + incoerenti.join(' | '));

        // 3) Il contesto base è descritto
        const descritte = new Set([...chiavi(corpoAzioni), ...chiavi(corpoCtx)]);
        const ctxSenzaTipo = vere.ctx.filter((k) => !descritte.has(k));
        t.assert(ctxSenzaTipo.length === 0, 'chiavi del contesto (makeContext) non descritte in EngineActions/CardContext: ' + ctxSenzaTipo.join(', '));
    }
};
