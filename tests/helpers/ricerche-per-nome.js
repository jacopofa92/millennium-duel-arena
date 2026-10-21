// Estrae dal codice del motore TUTTE le ricerche di carte "per nome" (name.includes('X'), name === 'X', /X/.test(name)...)
// e le valuta su data/cards.json, piu' le funzioni del motore che identificano le carte per nome (archetipi, Lady Arpia,
// nomi effettivi/citati, pacchetti a tema del Negozio). Serve al guardrail tests/specs/guardrail-nomi-carte.spec.js.
//
// Perche' esiste: il codice di molte carte identifica altre carte dal NOME ("tutti i mostri 'Ingranaggio Antico'", "Sorelle
// Arpie"...). Se un nome cambia (e' successo allineandoli ai nomi ufficiali Konami) una ricerca puo' smettere di trovare una
// carta, o trovarne una in piu', SENZA alcun errore: l'effetto semplicemente smette di funzionare. Qui l'elenco delle ricerche
// e' congelato insieme alle carte che devono trovare (tests/data/ricerche-per-nome.json): cambiare un nome, aggiungere una
// carta che una ricerca troverebbe, o scrivere una nuova ricerca costringe a guardare cosa succede.
//
// Aggiornare il registro DOPO aver verificato a mano l'effetto del cambiamento:
//     node tests/helpers/ricerche-per-nome.js --aggiorna
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.join(__dirname, '..', '..');
const FILE_REGISTRO = path.join(RADICE, 'tests', 'data', 'ricerche-per-nome.json');
const sbarra = (s) => s.replace(/\\(.)/g, '$1');

/** Le ricerche per nome presenti nei file del motore: [{ chiave, tipo, valore, flags, file, righe }]. */
function estraiRicerche() {
    const dir = path.join(RADICE, 'js', 'engine');
    const trovate = new Map();
    const aggiungi = (tipo, valore, file, riga, flags) => {
        // le ricerche su nomi gia' in minuscolo (cardHasArchetype) e sui nomi di errore non sono nomi di carta: le copre
        // la verifica con le funzioni vere (funzioniAttuali)
        if (/^[^A-Z]*$/.test(valore) && file === 'card-effects.js') return;
        if (/Error$/.test(valore)) return;
        const chiave = tipo + ':' + valore + (flags ? '/' + flags : '');
        if (!trovate.has(chiave)) trovate.set(chiave, { chiave, tipo, valore, flags: flags || '', file, righe: [] });
        trovate.get(chiave).righe.push(riga);
    };
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
        const righe = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
        const costanti = new Map();
        righe.forEach((r) => {
            const m = r.match(/^\s*const\s+(\w+)\s*=\s*\/((?:[^\/\\\n]|\\.)+)\/([gimsuy]*)\s*;/);
            if (m) costanti.set(m[1], { sorgente: m[2], flags: m[3] });
        });
        righe.forEach((r, i) => {
            if (/^\s*(\/\/|\*|\/\*)/.test(r)) return;
            let m;
            const reInc = /\bname\s*(\.toLowerCase\(\))?\s*\.(includes|startsWith)\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g;
            while ((m = reInc.exec(r)) !== null) aggiungi((m[1] ? 'minuscolo-' : '') + m[2], sbarra(m[3]), f, i + 1);
            const reEq = /\bname\s*(?:===|!==)\s*'((?:[^'\\]|\\.)*)'/g;
            while ((m = reEq.exec(r)) !== null) aggiungi('uguale', sbarra(m[1]), f, i + 1);
            const reRe = /\/((?:[^\/\\\n]|\\.)+)\/([gimsuy]*)\.test\(([^)]*\bname\b[^)]*)\)/g;
            while ((m = reRe.exec(r)) !== null) aggiungi('regex', m[1], f, i + 1, m[2]);
            const reCost = /\b([A-Z_]{3,})\.test\(([^)]*\bname\b[^)]*)\)/g;
            while ((m = reCost.exec(r)) !== null) { const c = costanti.get(m[1]); if (c) aggiungi('regex', c.sorgente, f, i + 1, c.flags); }
            const reNI = /nameIncludes:\s*'((?:[^'\\]|\\.)*)'/g;
            while ((m = reNI.exec(r)) !== null) aggiungi('includes', sbarra(m[1]), f, i + 1);
        });
    }
    return [...trovate.values()].sort((a, b) => a.chiave.localeCompare(b.chiave));
}

/** true se la carta e' trovata dalla ricerca. */
function trova(ricerca, card) {
    const nome = card.name || '';
    switch (ricerca.tipo) {
        case 'includes': return nome.includes(ricerca.valore);
        case 'startsWith': return nome.startsWith(ricerca.valore);
        case 'minuscolo-includes': return nome.toLowerCase().includes(ricerca.valore);
        case 'minuscolo-startsWith': return nome.toLowerCase().startsWith(ricerca.valore);
        case 'uguale': return nome === ricerca.valore;
        case 'regex': return new RegExp(ricerca.valore, ricerca.flags).test(nome);
        default: return false;
    }
}

function caricaCarte() {
    const c = JSON.parse(fs.readFileSync(path.join(RADICE, 'data', 'cards.json'), 'utf8'));
    return Array.isArray(c) ? c : c.cards;
}

/** Per ogni ricerca del codice, gli id che trova OGGI. */
function ricercheAttuali() {
    const carte = caricaCarte();
    const out = {};
    for (const r of estraiRicerche()) out[r.chiave] = carte.filter((c) => trova(r, c)).map((c) => c.id).sort((a, b) => a - b);
    return out;
}

/**
 * Le funzioni VERE del motore che identificano le carte per nome, valutate su tutte le carte (in Node, senza browser:
 * lo stesso contesto del duello senza testa). Indicizzate per nome/archetipo.
 */
function funzioniAttuali() {
    const { creaContesto } = require(path.join(RADICE, 'tools', 'duello-senza-testa.js'));
    const lett = { eff: new Set(), men: new Set() };
    const dir = path.join(RADICE, 'js', 'engine');
    for (const f of fs.readdirSync(dir).filter((x) => /^card-effects.*\.js$/.test(x))) {
        const t = fs.readFileSync(path.join(dir, f), 'utf8');
        for (const m of t.matchAll(/cardHasEffectiveName\(\s*[\w.]+\s*,\s*'((?:[^'\\]|\\.)*)'/g)) lett.eff.add(sbarra(m[1]));
        for (const m of t.matchAll(/cardMentionsName\(\s*[\w.]+\s*,\s*'((?:[^'\\]|\\.)*)'/g)) lett.men.add(sbarra(m[1]));
    }
    const { contesto } = creaContesto({ seme: 1, livello: 'medium', avversario: 'kaiba', giocatore: 'yugiMuto', log: false });
    const esegui = (c) => vm.runInContext(c, contesto);
    const out = { archetipi: {}, ladyArpia: [], nomiEffettivi: {}, nomiCitati: {}, temiNegozio: {} };
    ['toon', 'red-eyes', 'blue-eyes', 'dark-magician'].forEach((a) => {
        out.archetipi[a] = esegui(`cardDatabase.filter((c) => window.CardEffectsShared.cardHasArchetype(c, ${JSON.stringify(a)})).map((c) => c.id)`);
    });
    out.ladyArpia = esegui('cardDatabase.filter((c) => window.CardEffectsShared.isHarpieLadySupport(c)).map((c) => c.id)');
    [...lett.eff].sort().forEach((n) => { out.nomiEffettivi[n] = esegui(`cardDatabase.filter((c) => window.CardEffectsShared.cardHasEffectiveName(c, ${JSON.stringify(n)})).map((c) => c.id)`); });
    [...lett.men].sort().forEach((n) => { out.nomiCitati[n] = esegui(`cardDatabase.filter((c) => window.CardEffectsShared.cardMentionsName(c, ${JSON.stringify(n)})).map((c) => c.id)`); });
    esegui(fs.readFileSync(path.join(RADICE, 'js', 'economy', 'shop-catalog.js'), 'utf8'));
    esegui('ShopCatalog.TEMI.map((t) => [t.id, cardDatabase.filter((c) => t.test(c)).map((c) => c.id)])').forEach(([id, ids]) => { out.temiNegozio[id] = ids; });
    const ordina = (o) => Array.isArray(o) ? o.slice().sort((a, b) => a - b) : (o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, ordina(o[k])])) : o);
    return ordina(out);
}

function registroAttuale() { return { ricerche: ricercheAttuali(), funzioni: funzioniAttuali() }; }
function registroSalvato() { return JSON.parse(fs.readFileSync(FILE_REGISTRO, 'utf8')); }

module.exports = { estraiRicerche, trova, ricercheAttuali, funzioniAttuali, registroAttuale, registroSalvato, caricaCarte, FILE_REGISTRO };

if (require.main === module && process.argv.includes('--aggiorna')) {
    const registro = registroAttuale();
    fs.mkdirSync(path.dirname(FILE_REGISTRO), { recursive: true });
    fs.writeFileSync(FILE_REGISTRO, JSON.stringify(registro, null, 1) + '\n', 'utf8');
    console.log('Registro riscritto:', Object.keys(registro.ricerche).length, 'ricerche nel codice +', Object.keys(registro.funzioni).length, 'gruppi di funzioni del motore in', path.relative(RADICE, FILE_REGISTRO));
} else if (require.main === module) {
    const att = registroAttuale();
    console.log(Object.keys(att.ricerche).length + ' ricerche per nome nel codice del motore:');
    Object.entries(att.ricerche).forEach(([k, v]) => console.log('  ' + k + ' -> ' + v.length + ' carte'));
}
