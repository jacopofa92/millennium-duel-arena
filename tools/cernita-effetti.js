#!/usr/bin/env node
/**
 * cernita-effetti.js — quali effetti delle carte reggono in QUALUNQUE tema e quali sono "solo Yu-Gi-Oh".
 * =====================================================================
 * Serve al clone del gioco con un altro tema (es. WW1): si tolgono le carte Yu-Gi-Oh only e dal BACINO degli effetti
 * generici si generano carte di qualunque tema. Una carta e' "Yu-Gi-Oh only" se il suo effetto punta a un id di un'altra
 * carta, a un nome di carta, a un archetipo o ai materiali di una Fusione (un riferimento a se stessa non conta).
 *
 * Due modi:
 *   node tools/cernita-effetti.js
 *       Classifica le carte LEGGENDO il codice delle loro definizioni (function.toString() dentro il contesto del duello
 *       senza testa). Scrive docs/planning/cernita-effetti.json (carta per carta) e docs/planning/CERNITA_EFFETTI_GENERICI.md.
 *   node tools/cernita-effetti.js --verifica [--partite 120] [--seme 880000]
 *       La classificazione e' una LETTURA del codice: non vede una dipendenza nascosta (una funzione condivisa, un flag
 *       impostato da un'altra carta, l'IA). Qui il bacino viene ESEGUITO: stessi mazzi, stessi semi, in due mondi —
 *       il gioco com'e' e il "mondo del clone" (solo carte del bacino, id nuovi, nomi inventati; vedi tools/bacino-effetti.js).
 *       Se i due mondi giocano partite diverse, qualcosa dipende da un id o da un nome. Se un effetto non parte mai, o lancia un
 *       errore, e' segnalato. Scrive docs/planning/CERNITA_EFFETTI_VERIFICA.md.
 *
 * Gruppi:  A generico puro | B generico con Tipo/Attributo come parametro | M meccanica propria (Spirit, Contatori Magia, Toon,
 *          Union) | C2 Yu-Gi-Oh only probabile (il TESTO cita carte per nome) | C1 Yu-Gi-Oh only certo (id/nomi nel codice).
 *          Il bacino riusabile e' A + B.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { giocaPartita, creaContesto, prng } = require('./duello-senza-testa.js');

const RADICE = path.join(__dirname, '..');
const DOC = path.join(RADICE, 'docs', 'planning');

// ---------------------------------------------------------------------------------------------------------------------
// 1) Lettura delle definizioni
// ---------------------------------------------------------------------------------------------------------------------
function leggiDefinizioni() {
    const { contesto } = creaContesto({ avversario: 'kaiba', livello: 'hard', seme: 1 });
    const json = vm.runInContext(`JSON.stringify(cardDatabase.filter((c) => c.origin === 'yu-gi-oh').map((c) => {
        const def = DuelEngine.getDefinition(c.id);
        if (!def) return null;
        const codice = {}; const dati = {};
        Object.keys(def).forEach((k) => { const v = def[k]; if (typeof v === 'function') codice[k] = v.toString(); else dati[k] = JSON.stringify(v); });
        return { id: c.id, name: c.name, type: c.type, subtype: c.subtype || '', level: c.level || 0, effect: c.effect || '',
            race: c.race || '', attribute: c.attribute || '', chiavi: Object.keys(def), codice, dati, clone: c.cloneEffectOf };
    }).filter(Boolean))`, contesto);
    const razzeAttributi = JSON.parse(vm.runInContext(`JSON.stringify({
        razze: [...new Set(cardDatabase.filter((c) => c.origin === 'yu-gi-oh').map((c) => c.race).filter(Boolean))],
        attributi: [...new Set(cardDatabase.filter((c) => c.origin === 'yu-gi-oh').map((c) => c.attribute).filter(Boolean))]
    })`, contesto));
    return { carte: JSON.parse(json), ...razzeAttributi };
}

// ---------------------------------------------------------------------------------------------------------------------
// 2) Classificazione
// ---------------------------------------------------------------------------------------------------------------------
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Chiavi dei dati che per definizione citano altre carte per nome o archetipo.
const CHIAVI_NOME = ['mentionsNames', 'treatedAsNames', 'treatedAsNamesByZone', 'fusionMaterialNames', 'archetypes', 'requiresFieldPresenceId', 'reviveCounterpart'];
// Sottosistemi propri di Yu-Gi-Oh (il motore li sa fare; quali carte li usano e' un'altra cosa).
const MECCANICHE = { 'Contatori Magia': ['acceptsSpellCounters', 'maxSpellCounters'], Union: ['isUnion', 'unionTargetFilter'], Toon: ['isToon'], Fusione: ['fusionMaterialMatchers', 'banishFusionMaterials'] };

function segnali(c, re) {
    const codice = Object.values(c.codice).join('\n');
    const trovati = new Set();
    const num = (rx) => { for (const m of codice.matchAll(rx)) trovati.add(Number(m[1])); };
    num(/\.id\s*[!=]==?\s*(\d+)/g); num(/\b(\d+)\s*[!=]==?\s*[\w.$\[\]]*\.id\b/g); num(/\bid\s*:\s*(\d{1,4})\b/g);
    num(/getDefinition\(\s*(\d+)/g); num(/exactId\s*[:=]\s*(\d+)/g);
    for (const m of codice.matchAll(/\[\s*(\d{1,4}(?:\s*,\s*\d{1,4})+)\s*\]\s*\.includes\([^)]*\bid\b/g)) m[1].split(',').forEach((n) => trovati.add(Number(n)));
    for (const m of codice.matchAll(/new Set\(\s*\[\s*(\d{1,4}(?:\s*,\s*\d{1,4})*)\s*\]\s*\)/g)) m[1].split(',').forEach((n) => trovati.add(Number(n)));
    // I materiali di una Fusione sono id di carte.
    if (c.chiavi.includes('fusionMaterials')) { try { JSON.parse(c.dati.fusionMaterials).forEach((n) => trovati.add(Number(n))); } catch (e) { trovati.add(-1); } }
    // Un riferimento a se stessa non rende la carta Yu-Gi-Oh only, ma NON e' neutro: se la stessa definizione viene riusata con un id
    // diverso (carta nuova di un altro tema), un `.id !== 426` smette di funzionare. Si segnala a parte (gruppo D).
    const idProprio = trovati.has(c.id);
    const id = [...trovati].filter((n) => n !== c.id);
    const nome = [];
    const t = (rx) => { const m = codice.match(rx); if (m) nome.push(m[0].slice(0, 50)); };
    t(/\.name\s*[!=]==?\s*['"`]/); t(/\.name\.(includes|startsWith|endsWith|indexOf|match)\(/);
    t(/\.name\.toLowerCase\(\)\.(includes|startsWith)\(/); t(/\bname\s*[!=]==?\s*['"`][^'"`]{3,}['"`]/);
    CHIAVI_NOME.forEach((k) => { if (c.chiavi.includes(k)) nome.push('chiave ' + k); });
    const razzaAttr = re.razzeCodice.test(codice) || re.attrCodice.test(codice) || re.razzeTesto.test(c.effect) || re.attrTesto.test(c.effect);
    const meccaniche = [];
    Object.keys(MECCANICHE).forEach((m) => { if (MECCANICHE[m].some((k) => c.chiavi.includes(k))) meccaniche.push(m); });
    if (/spirit/i.test(c.subtype)) meccaniche.push('Spirit');
    if (c.subtype === 'ritual') meccaniche.push('Rituale');
    const testoNome = /"[^"]{3,}"|“[^”]{3,}”|«[^»]{3,}»/.test(c.effect);
    return { id, idProprio, nome, razzaAttr, meccaniche: [...new Set(meccaniche)], testoNome, clone: c.clone !== undefined };
}

function gruppoDi(s) {
    if (s.id.length || s.nome.length || s.clone) return 'C1';
    if (s.testoNome) return 'C2';
    if (s.meccaniche.length) return 'M';
    if (s.razzaAttr) return 'B';
    return 'A';
}

function formaDi(c) {
    const ganci = c.chiavi.some((k) => /^on[A-Z]/.test(k));
    return (ganci ? 'reattivo' : c.chiavi.includes('static') ? 'passivo' : 'solo attivazione') + ' - ' + (c.type === 'monster' ? 'mostro' : c.type);
}

function classifica() {
    const { carte, razze, attributi } = leggiDefinizioni();
    const re = {
        razzeCodice: new RegExp(`['"\`](${razze.map(esc).join('|')})['"\`]`), attrCodice: new RegExp(`['"\`](${attributi.map(esc).join('|')})['"\`]`),
        razzeTesto: new RegExp(`\\b(${razze.map(esc).join('|')})\\b`), attrTesto: new RegExp(`\\b(${attributi.map(esc).join('|')})\\b`)
    };
    const base = carte.map((c) => ({ id: c.id, nome: c.name }));
    const dalMotore = riferimentiDalMotore(base);
    return carte.map((c) => {
        const s = segnali(c, re);
        s.motore = dalMotore[c.id] || [];
        let gruppo = gruppoDi(s);
        if ((gruppo === 'A' || gruppo === 'B') && s.motore.length) gruppo = 'C3'; // pulita, ma il motore/IA la nomina
        else if ((gruppo === 'A' || gruppo === 'B') && s.idProprio) gruppo = 'D'; // pulita, ma col proprio id scritto nel codice
        return { id: c.id, nome: c.name, tipo: c.type, sottotipo: c.subtype, livello: c.level, gruppo, forma: formaDi(c),
            ganci: c.chiavi.filter((k) => k === 'activate' || /^on[A-Z]/.test(k)), motivi: { id: s.id, idProprio: s.idProprio, nome: s.nome, motore: s.motore, razzaAttr: s.razzaAttr, meccaniche: s.meccaniche, testoNome: s.testoNome, clone: s.clone } };
    });
}

// Riferimenti a id/nomi nel MOTORE e nell'IA (non nelle carte): anche questi non seguono il clone.
function scansioneMotore() {
    const cartelle = ['js/engine', 'js/ai'];
    const righe = [];
    cartelle.forEach((d) => fs.readdirSync(path.join(RADICE, d)).filter((f) => f.endsWith('.js') && !/^card-effects-\d/.test(f)).forEach((f) => {
        const t = fs.readFileSync(path.join(RADICE, d, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        const ids = (t.match(/\.id\s*[!=]==?\s*\d{1,4}\b|\bid\s*[!=]==?\s*\d{1,4}\b|\[\s*\d{1,4}(?:\s*,\s*\d{1,4})+\s*\]\s*\.includes\(/g) || []).length;
        const nomi = (t.match(/\.name\s*[!=]==?\s*['"`]|\.name\.(?:includes|startsWith|endsWith)\(\s*['"`]|\bname\s*[!=]==?\s*['"`][^'"`]{3,}['"`]/g) || []).length;
        if (ids || nomi) righe.push({ file: `${d}/${f}`, ids, nomi });
    }));
    return righe.sort((a, b) => (b.ids + b.nomi) - (a.ids + a.nomi));
}

/**
 * Il controllo AL CONTRARIO: non "la carta nomina altre carte" ma "il MOTORE o l'IA nomina questa carta". Un effetto puo' essere
 * pulito e funzionare solo perche' il motore lo tratta per id (es. i tre Dei Egizi, id 30/31/472, immuni a certe cose nel codice del
 * motore, non nella loro definizione) o perche' l'IA li riconosce per nome. In un clone quel trattamento non segue la carta nuova.
 * Torna { idCarta: [ 'file: riga' ] }. Va riletto a mano: un numero in un array puo' essere anche un valore e non un id.
 */
function riferimentiDalMotore(carte) {
    const cartelle = ['js/engine', 'js/ai'];
    const perId = new Map(carte.map((c) => [c.id, c]));
    const trovati = {};
    const segna = (id, file, riga) => { if (!perId.has(id)) return; (trovati[id] = trovati[id] || []).push(`${file}: ${riga.trim().slice(0, 110)}`); };
    const parole = new Set(['Drago', 'Guerriero', 'Mago', 'Bestia', 'Macchina']); // razze: sono parametri, non nomi
    // js/data/cards-db.js e' CODICE dentro la cartella dei dati: getTributesRequired decide per id i 3 Tributi di Gilford e degli Dei Egizi.
    const elenco = [];
    cartelle.forEach((d) => fs.readdirSync(path.join(RADICE, d)).filter((f) => f.endsWith('.js') && !/^card-effects-\d/.test(f)).forEach((f) => elenco.push([d, f])));
    elenco.push(['js/data', 'cards-db.js']);
    elenco.forEach(([d, f]) => {
        const file = `${d}/${f}`;
        const righe = fs.readFileSync(path.join(RADICE, d, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).split(/\r?\n/);
        righe.forEach((riga) => {
            const r = riga.replace(/\/\/.*$/, '');
            for (const m of r.matchAll(/\.id\s*[!=]==?\s*(\d{1,4})\b/g)) segna(Number(m[1]), file, riga);
            for (const m of r.matchAll(/\b(\d{1,4})\s*[!=]==?\s*[\w.$\[\]()]*\.id\b/g)) segna(Number(m[1]), file, riga);
            for (const m of r.matchAll(/\[\s*(\d{1,4}(?:\s*,\s*\d{1,4})+)\s*\]/g)) {
                if (!/includes|Set|id|ID|Id/.test(r)) continue;
                m[1].split(',').forEach((n) => segna(Number(n), file, riga));
            }
            for (const m of r.matchAll(/\.name\s*[!=]==?\s*(['"`])([^'"`]{3,})\1|\.name\.(?:includes|startsWith|endsWith)\(\s*(['"`])([^'"`]{3,})\3/g)) {
                const s = m[2] || m[4];
                if (parole.has(s)) continue;
                carte.forEach((c) => { if (c.nome === s || (m[4] && (c.nome.includes(s)))) segna(c.id, file, riga); });
            }
        });
    });
    return trovati;
}

function conta(arr, chiave) { const r = {}; arr.forEach((x) => { const k = chiave(x); r[k] = (r[k] || 0) + 1; }); return r; }

function scriviCernita() {
    const carte = classifica();
    const motore = scansioneMotore();
    const gruppi = conta(carte, (c) => c.gruppo);
    const perTipo = (g) => conta(carte.filter((c) => c.gruppo === g), (c) => (c.tipo === 'monster' ? 'mostri' : c.tipo === 'spell' ? 'Magie' : 'Trappole'));
    const bacino = carte.filter((c) => c.gruppo === 'A' || c.gruppo === 'B');
    const forme = conta(bacino, (c) => c.forma);
    const ganci = conta(bacino.flatMap((c) => c.ganci.filter((k) => k !== 'activate')), (k) => k);
    const mecc = conta(carte.filter((c) => c.gruppo === 'M').flatMap((c) => c.motivi.meccaniche), (k) => k);
    const mecTutte = {};
    carte.forEach((c) => { c.motivi.meccaniche.forEach((m) => { (mecTutte[m] = mecTutte[m] || []).push(`${c.id} ${c.nome} [${c.gruppo}]`); }); });

    fs.writeFileSync(path.join(DOC, 'cernita-effetti.json'), JSON.stringify({ criterio: 'vedi tools/cernita-effetti.js', totali: gruppi, carte }, null, 1) + '\n', 'utf8');

    const f = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(', ');
    const riga = (g, nome) => `| **${g}** ${nome} | ${gruppi[g] || 0} | ${f(perTipo(g))} |`;
    const md = `# Cernita degli effetti: generici o Yu-Gi-Oh only

Generato da \`node tools/cernita-effetti.js\` (non modificare a mano: si rigenera). Dati carta per carta: \`docs/planning/cernita-effetti.json\`.
Verifica per esecuzione: \`node tools/cernita-effetti.js --verifica\` (scrive \`CERNITA_EFFETTI_VERIFICA.md\`).

## A cosa serve
Per il clone del gioco con un altro tema: le carte **Yu-Gi-Oh only** non si portano, e dal **bacino** degli effetti generici si generano
carte di qualunque tema. Una carta e' "Yu-Gi-Oh only" se il suo effetto punta a un **id** di un'altra carta, a un **nome** di carta,
a un archetipo o ai materiali di una Fusione. Un riferimento a se stessa non la rende Yu-Gi-Oh only, ma va corretto (gruppo D).

## Risultato (${carte.length} carte con un effetto reale)
| Gruppo | Carte | Per tipo |
|---|---|---|
${riga('A', 'generico puro')}
${riga('B', 'generico, con Tipo/Attributo come parametro')}
${riga('M', 'meccanica propria senza nomi (Spirit, Contatori Magia, Toon, Union)')}
${riga('D', 'generico ma con il PROPRIO id scritto nel codice (si ripara sostituendo il numero con ctx.card.id)')}
${riga('C3', 'Yu-Gi-Oh only dal motore/IA (la carta e\' pulita, ma il motore o l\'IA la nomina per id o nome)')}
${riga('C2', 'Yu-Gi-Oh only probabile (il testo cita carte per nome)')}
${riga('C1', 'Yu-Gi-Oh only certo (id o nomi nel codice, materiali di Fusione)')}

**Bacino riusabile subito (A + B): ${bacino.length} carte, il ${Math.round(bacino.length * 100 / carte.length)}%.**

Forme del bacino: ${f(forme)}.

Ganci piu' usati nel bacino: ${Object.entries(ganci).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${v}`).join(', ')}.

## Come e' stata fatta (e i suoi limiti)
La classificazione **legge il codice** di ogni definizione (\`function.toString()\`): id numerici confrontati con \`.id\`, confronti e ricerche
sul nome, chiavi come \`mentionsNames\`/\`archetypes\`/\`fusionMaterials\`. Non puo' vedere una dipendenza **nascosta** (una funzione
condivisa, un flag impostato da un'altra carta). Per questo esiste \`--verifica\`, che il bacino lo **esegue** in un mondo senza
le carte Yu-Gi-Oh only e con id e nomi travestiti.

Il gruppo **B** e' generico solo se il Tipo/Attributo diventa un parametro: oggi il codice confronta con stringhe fisse come \`'Drago'\`.
Il gruppo **D** si ripara con una sostituzione banale e poi entra nel bacino.
Il gruppo **C3** nasce dal controllo al contrario (motore, IA e js/data/cards-db.js): un numero in un array puo' essere un valore e non un id, quindi va riletto a mano.
Il gruppo **C2** e' una stima dal testo (alcune carte potrebbero essere generiche con un nome decorativo, per esempio un gettone): va rivisto a mano.

## Carte "pulite" ma con il proprio id nel codice (gruppo D)
Vanno bene per qualunque tema **dopo** aver sostituito il numero con ctx.card.id; senza, un controllo come slot.card.id !== 426 smette di funzionare appena la carta ha un id diverso.
${carte.filter((c) => c.gruppo === 'D').map((c) => `${c.id} ${c.nome}`).join('; ') || '(nessuna)'}

## Carte "pulite" che il motore o l'IA nominano (gruppo C3)
${carte.filter((c) => c.gruppo === 'C3').map((c) => `- ${c.id} ${c.nome}: ${c.motivi.motore.slice(0, 2).join(' | ')}`).join('\n') || '(nessuna)'}

## Meccaniche proprie di Yu-Gi-Oh (se si vuole tenerle in un tema)
Quali carte le usano, per gruppo: ${f(mecc)} nel solo gruppo M; l'elenco completo e' sotto.
${Object.keys(mecTutte).map((m) => `\n**${m}** (${mecTutte[m].length}): ${mecTutte[m].join('; ')}`).join('\n')}

## Riferimenti a id e nomi nel motore e nell'IA (non nelle carte)
Anche questi restano indietro in un clone: file con piu' riferimenti (id = confronti con un id numerico, nomi = confronti/ricerche su un nome).

| File | id | nomi |
|---|---|---|
${motore.slice(0, 15).map((r) => `| ${r.file} | ${r.ids} | ${r.nomi} |`).join('\n')}
`;
    fs.writeFileSync(path.join(DOC, 'CERNITA_EFFETTI_GENERICI.md'), md, 'utf8');
    console.log(`Cernita scritta: ${carte.length} carte; gruppi ${f(gruppi)}; bacino ${bacino.length}.`);
    return carte;
}

// ---------------------------------------------------------------------------------------------------------------------
// 3) Verifica per esecuzione
// ---------------------------------------------------------------------------------------------------------------------
function mescola(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** 40 carte del bacino con la solita curva (14 mostri di Livello 1-4, 4 di 5-6, 2 di 7+, 11 Magie, 9 Trappole), una copia ciascuna. */
function mazzoDelBacino(bacino, rng) {
    const m = bacino.filter((c) => c.tipo === 'monster');
    const scegli = (arr, n) => mescola(arr, rng).slice(0, n).map((c) => c.id);
    return [...scegli(m.filter((c) => c.livello <= 4), 14), ...scegli(m.filter((c) => c.livello >= 5 && c.livello <= 6), 4), ...scegli(m.filter((c) => c.livello >= 7), 2),
        ...scegli(bacino.filter((c) => c.tipo === 'spell'), 11), ...scegli(bacino.filter((c) => c.tipo === 'trap'), 9)];
}

async function verifica(partite, seme0) {
    const carte = fs.existsSync(path.join(DOC, 'cernita-effetti.json')) ? JSON.parse(fs.readFileSync(path.join(DOC, 'cernita-effetti.json'), 'utf8')).carte : scriviCernita();
    const bacino = carte.filter((c) => c.gruppo === 'A' || c.gruppo === 'B');
    const pool = bacino.map((c) => c.id);
    const nomeOriginale = {}; const { carte: defs } = leggiDefinizioni(); defs.forEach((c) => { nomeOriginale[c.id] = c.name; });
    // Travestimento: id nuovi e nomi inventati, uguali per tutte le partite. L'ORDINE si conserva (stesso ordine fra gli id, stesso
    // ordine alfabetico fra i nomi): l'IA e il motore spareggiano a volte "il primo per id" o "per nome", e un ordine rimescolato farebbe
    // giocare partite diverse senza che nessuna carta dipenda da nulla. Cosi' una differenza vuol dire che conta il VALORE di un id o di un nome.
    const mappa = {}; const nomi = {}; const inverso = {};
    [...pool].sort((a, b) => a - b).forEach((id, i) => { mappa[id] = 900000 + i; });
    [...pool].sort((a, b) => nomeOriginale[a].localeCompare(nomeOriginale[b])).forEach((id, i) => { nomi[id] = `Zq${String(i).padStart(4, '0')}x`; inverso[nomi[id]] = nomeOriginale[id]; });
    const reNomi = new RegExp(Object.values(nomi).map(esc).join('|'), 'g');
    const normalizza = (righe) => righe.map((r) => r.replace(reNomi, (m) => inverso[m]));
    const spec = (ids, tr) => ({ main: ids.map((id) => ({ id: tr ? mappa[id] : id, qty: 1 })), extra: [] });
    const eseguonoQualcosa = new Set(bacino.filter((c) => c.ganci.length).map((c) => c.id));

    const sosp = {}; const totTrav = {}; let uguali = 0; const diverse = []; const errori = []; let invarianti = 0; let nonFinite = 0;
    for (let n = 0; n < partite; n++) {
        const rng = prng(seme0 * 31 + n);
        const idsG = mazzoDelBacino(bacino, rng); const idsB = mazzoDelBacino(bacino, rng);
        const base = { avversario: 'kaiba', livello: 'hard', livelloGiocatore: 'hard', seme: seme0 + n, turni: 60, registroCompleto: true,
            allaFine: 'JSON.stringify(window.__conta)', scriptAggiuntivi: ['tools/bacino-effetti.js'] };
        const gioca = (tr) => giocaPartita(Object.assign({}, base, {
            preludio: 'window.__BACINO = ' + JSON.stringify(tr ? { modo: 'travestito', pool, mappa, nomi } : { modo: 'originale', pool }) + ';',
            mazzoGiocatore: spec(idsG, tr), mazzoAvversario: spec(idsB, tr)
        }), 0);
        let o; let t;
        try { o = await gioca(false); t = await gioca(true); } catch (e) { errori.push(`partita ${n} (seme ${seme0 + n}): ${String(e && e.message || e).split('\n')[0]}`); continue; }
        [o, t].forEach((r, i) => { r.erroriCarte.forEach((m) => errori.push(`${i ? 'travestito' : 'originale'} seme ${r.seme}: ${m.slice(0, 220)}`)); invarianti += r.invarianti.length; });
        if (t.alLimite || o.alLimite) nonFinite++;
        const co = JSON.parse(o.extra || '{}'); const ct = JSON.parse(t.extra || '{}');
        Object.keys(ct).forEach((k) => { const id = Number(k.split(':')[0]); totTrav[id] = (totTrav[id] || 0) + ct[k]; });
        const lo = normalizza(o.registroCompleto); const lt = normalizza(t.registroCompleto);
        let diff = -1; const L = Math.max(lo.length, lt.length);
        for (let i = 0; i < L; i++) { if (lo[i] !== lt[i]) { diff = i; break; } }
        const stessa = diff === -1 && o.esito === t.esito && o.turno === t.turno && o.lpG === t.lpG && o.lpB === t.lpB;
        if (stessa) { uguali++; continue; }
        const sospetti = [...new Set([...Object.keys(co), ...Object.keys(ct)].filter((k) => (co[k] || 0) !== (ct[k] || 0)).map((k) => Number(k.split(':')[0])))];
        sospetti.forEach((id) => { sosp[id] = (sosp[id] || 0) + 1; });
        if (diverse.length < 12) diverse.push({ seme: seme0 + n, riga: diff, originale: lo[diff], travestito: lt[diff], sospetti: sospetti.slice(0, 8) });
        if ((n + 1) % 20 === 0) console.log(`  ... ${n + 1}/${partite} (uguali finora: ${uguali})`);
    }
    const mai = bacino.filter((c) => eseguonoQualcosa.has(c.id) && !totTrav[c.id]);
    const nome = (id) => `${id} ${nomeOriginale[id]}`;
    const sospOrdinati = Object.entries(sosp).sort((a, b) => b[1] - a[1]);
    const md = `# Verifica per esecuzione del bacino degli effetti

Generato da \`node tools/cernita-effetti.js --verifica --partite ${partite} --seme ${seme0}\`.

Il bacino (gruppi A + B della cernita, ${pool.length} carte) e' stato giocato in **due mondi** con gli stessi mazzi e gli stessi semi:
1. il gioco com'e';
2. il **mondo del clone**: nel database restano solo le carte del bacino, con **id nuovi e nomi inventati**; le carte Yu-Gi-Oh only non esistono.
Entrambi i posti sono l'IA al livello Difficile; i mazzi sono 40 carte del bacino pescate a caso (14 mostri Liv. 1-4, 4 Liv. 5-6, 2 Liv. 7+, 11 Magie, 9 Trappole).

## Risultato
- Coppie di partite: **${partite}**; **identiche** nei due mondi (stesso registro riga per riga, stesso esito, turno e Life Points): **${uguali}**.
- Partite **diverse**: **${partite - uguali - errori.filter((e) => e.startsWith('partita')).length}**; partite interrotte da un errore: ${errori.filter((e) => e.startsWith('partita')).length}; arrivate al limite di turni: ${nonFinite}.
- Errori lanciati dalle carte: **${errori.filter((e) => !e.startsWith('partita')).length}**; invarianti rotte: **${invarianti}**.
- Carte con un effetto che **non sono mai partite** nel mondo del clone: **${mai.length}** su ${eseguonoQualcosa.size}.

## Carte che si comportano diversamente nei due mondi (piu' partite diverse in cui il loro effetto ha contato diversamente)
${sospOrdinati.length ? sospOrdinati.slice(0, 40).map(([id, k]) => `- ${nome(id)} (${k})`).join('\n') : '(nessuna)'}

Nota: una differenza puo' venire anche dall'**IA**, che in alcuni punti guarda id e nomi (vedi \`CERNITA_EFFETTI_GENERICI.md\`), non solo dalla carta.

## Prime partite diverse
${diverse.length ? diverse.map((d) => `- seme ${d.seme}, riga ${d.riga}\n  - originale: ${d.originale}\n  - travestito: ${d.travestito}\n  - carte con conteggi diversi: ${d.sospetti.map((i) => nome(i)).join(', ')}`).join('\n') : '(nessuna)'}

## Effetti mai partiti nel mondo del clone
${mai.length ? mai.map((c) => `- ${nome(c.id)} (${c.tipo}${c.sottotipo ? '/' + c.sottotipo : ''}; ganci: ${c.ganci.join(', ')})`).join('\n') : '(nessuno)'}

Un effetto "mai partito" non e' per forza rotto: puo' richiedere uno scenario che le partite a caso non creano. Va guardato a mano.

## Errori
${errori.length ? errori.slice(0, 20).map((e) => '- ' + e).join('\n') : '(nessuno)'}
`;
    fs.writeFileSync(path.join(DOC, 'CERNITA_EFFETTI_VERIFICA.md'), md, 'utf8');
    console.log(`Verifica: ${partite} coppie, identiche ${uguali}, diverse ${partite - uguali}, errori ${errori.length}, effetti mai partiti ${mai.length}/${eseguonoQualcosa.size}, invarianti ${invarianti}.`);
}

async function main() {
    const a = process.argv.slice(2);
    const val = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 && a[i + 1] ? a[i + 1] : d; };
    if (a.includes('--verifica')) await verifica(Number(val('partite', '120')), Number(val('seme', '880000')));
    else scriviCernita();
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { classifica, scansioneMotore };
