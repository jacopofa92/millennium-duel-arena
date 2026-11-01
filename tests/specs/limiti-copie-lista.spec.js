// Limiti di copie scelti dall'autore (1.5.30): 7 carte Limitate (1 copia) e 14 Semi-Limitate (2 copie) in piu' rispetto alla
// Lista Limitazioni gia' nei dati. Il campo e' `limit` in data/cards.json, tradotto da getCardCopyLimit (cards-db.js: assente = 3).
// Qui si controlla che i limiti ci siano e che le Structure Deck vendute nel Negozio non li violino per le carte di questa lista
// (SD4 tiene 2 Tributo Torrenziale: per questo quella carta e' a 2 e non a 1, scelta dell'autore).
// Solo analisi dei dati (nessun browser): legge cards.json e valuta starter-structure-decks.js in un contesto isolato.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.join(__dirname, '..', '..');
const LIMITATE = { 7: 'Buco Nero', 10: 'Cilindro Magico', 40: 'Buco Trappola', 37: 'Folgore Fulminante', 409: 'Raigeki', 382: 'Forza Riflessa', 793: 'Armatura Sakuretsu' };
const SEMI = {
    490: 'Tributo Torrenziale', 820: 'Annulla Attacco', 503: 'Waboku', 383: 'Muro a Specchio', 219: 'Tornado di Polvere', 130: 'Controllo della Mente',
    147: 'Cambiare Idea', 243: 'Schiacciare', 262: 'Ritorno Totale', 434: 'Capro Espiatorio', 474: 'Mille Coltelli', 607: 'Tifone Spaziale Mistico',
    645: 'Strappa Possesso', 750: "Gabbia d'Acciaio dell'Incubo"
};

module.exports = {
    name: 'Limiti di copie: le carte scelte dall\'autore sono Limitate o Semi-Limitate, e le Structure Deck le rispettano',
    standalone: true,
    async run({ assert }) {
        const json = JSON.parse(fs.readFileSync(path.join(RADICE, 'data', 'cards.json'), 'utf8'));
        const carte = Array.isArray(json) ? json : (json.cards || Object.values(json));
        const limite = (id) => {
            const l = Number((carte.find((c) => c.id === Number(id)) || {}).limit);
            return l === 1 || l === 2 ? l : 3;
        };
        const sbagliate = [];
        Object.keys(LIMITATE).forEach((id) => { if (limite(id) !== 1) sbagliate.push(`${LIMITATE[id]}=${limite(id)} (atteso 1)`); });
        Object.keys(SEMI).forEach((id) => { if (limite(id) !== 2) sbagliate.push(`${SEMI[id]}=${limite(id)} (atteso 2)`); });
        assert(sbagliate.length === 0, `Limiti sbagliati: ${sbagliate.join(', ')}`);

        const ctx = vm.createContext({ window: {}, console });
        vm.runInContext(fs.readFileSync(path.join(RADICE, 'js', 'data', 'starter-structure-decks.js'), 'utf8') + '\n;this.__p = starterStructureDeckDatabase;', ctx);
        const lista = Object.assign({}, LIMITATE, SEMI);
        const fuori = [];
        (ctx.__p || []).forEach((p) => {
            const cnt = {};
            ['main', 'extra'].forEach((z) => (p[z] || []).forEach((e) => { cnt[e.id] = (cnt[e.id] || 0) + (e.qty || 1); }));
            Object.keys(cnt).forEach((id) => { if (lista[id] && cnt[id] > limite(id)) fuori.push(`${p.name}: ${lista[id]} ${cnt[id]}>${limite(id)}`); });
        });
        assert((ctx.__p || []).length > 5, 'Le Structure Deck non si sono caricate');
        assert(fuori.length === 0, `Structure Deck oltre il limite: ${fuori.join(', ')}`);
        // Buco Trappola Senza Fine (128) e Frattura Raigeki (624) sono carte DIVERSE da Buco Trappola e Raigeki: restano a 3.
        assert(limite(128) === 3 && limite(624) === 3, 'Buco Trappola Senza Fine e Frattura Raigeki non vanno limitate');
    }
};
