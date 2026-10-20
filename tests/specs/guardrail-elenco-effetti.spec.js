// Cartoteca, Creazione Deck e la vista Cartoteca del menu NON caricano piu' il motore del duello (circa 586KB di
// script): il filtro "Categoria Mostro" legge js/data/card-effect-ids.generated.js, generato da
// scripts/build-card-effect-ids.js. Questo spec tiene vere tre cose:
//   1) l'elenco generato coincide con quello che il motore dice davvero (se si aggiunge una carta registrata e ci si
//      dimentica di rigenerarlo, il filtro mentirebbe in silenzio);
//   2) senza motore, getMonsterFilterCategory risponde identico a prima per OGNI mostro;
//   3) quelle pagine non ricaricano a mano il motore.
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'Guardrail: l\'elenco delle carte con effetto coincide col motore e il filtro funziona senza motore',
    async run(t) {
        const radice = path.join(__dirname, '..', '..');
        const file = fs.readFileSync(path.join(radice, 'js/data/card-effect-ids.generated.js'), 'utf8');
        const m = file.match(/new Set\(\[([\d,]*)\]\)/);
        t.assert(m, 'js/data/card-effect-ids.generated.js ha un formato inatteso');
        const idsFile = m[1] ? m[1].split(',').map(Number) : [];

        const r = await t.evaluate((idsFile) => {
            const dalMotore = cardDatabase.filter((c) => DuelEngine.getDefinition(c.id)).map((c) => c.id).sort((a, b) => a - b);
            // la risposta di getMonsterFilterCategory COL motore, per ogni mostro
            const con = {};
            cardDatabase.filter((c) => c.type === 'monster').forEach((c) => { con[c.id] = getMonsterFilterCategory(c); });
            // e SENZA motore, con l'elenco letto dal file
            const motore = window.DuelEngine; const elenco = window.CARD_EFFECT_IDS;
            window.DuelEngine = undefined; window.CARD_EFFECT_IDS = new Set(idsFile);
            const diversi = [];
            cardDatabase.filter((c) => c.type === 'monster').forEach((c) => { const senza = getMonsterFilterCategory(c); if (senza !== con[c.id]) diversi.push(c.id + ':' + con[c.id] + '->' + senza); });
            window.DuelEngine = motore; window.CARD_EFFECT_IDS = elenco;
            return { dalMotore, diversi };
        }, idsFile);

        const manca = r.dalMotore.filter((id) => idsFile.indexOf(id) === -1);
        const inPiu = idsFile.filter((id) => r.dalMotore.indexOf(id) === -1);
        t.assert(manca.length === 0 && inPiu.length === 0,
            `L'elenco generato non e' allineato col motore (mancano ${manca.slice(0, 8)}; in piu' ${inPiu.slice(0, 8)}): lancia node scripts/build-card-effect-ids.js`);
        t.assert(r.diversi.length === 0, `Senza motore il filtro risponde diverso per ${r.diversi.length} mostri: ${r.diversi.slice(0, 6).join(', ')}`);

        ['cartoteca.html', 'creazione-deck.html', 'index.html'].forEach((nome) => {
            const html = fs.readFileSync(path.join(radice, nome), 'utf8');
            if (nome === 'index.html') {
                const blocco = html.slice(html.indexOf('const SCRIPT_CARTOTECA'), html.indexOf('function initcartoteca'));
                t.assert(!/js\/engine\/duel-engine\.js/.test(blocco) && blocco.includes('card-effect-ids.generated.js'),
                    'La vista Cartoteca del menu non deve caricare il motore e deve leggere l\'elenco');
            } else {
                t.assert(!/js\/engine\/duel-engine\.js/.test(html) && html.includes('card-effect-ids.generated.js'),
                    `${nome} non deve caricare il motore e deve leggere l'elenco`);
            }
        });
    }
};
