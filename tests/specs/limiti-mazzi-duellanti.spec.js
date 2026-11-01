// I mazzi dei Duellanti rispettano il numero massimo di copie per carta (campo `limit` di data/cards.json, assente = 3), a tutti e
// tre i livelli. UNICA eccezione: i mazzi `congelato: true` (Grande Guerra), che l'autore ha chiesto di non toccare.
// Solo analisi dei dati: legge cards.json e valuta character-decks.js in un contesto isolato (nessun browser).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RADICE = path.join(__dirname, '..', '..');

module.exports = {
    name: 'Limiti di copie: nessun mazzo dei Duellanti (esclusa la Grande Guerra congelata) supera il limite di una carta',
    standalone: true,
    async run({ assert }) {
        const json = JSON.parse(fs.readFileSync(path.join(RADICE, 'data', 'cards.json'), 'utf8'));
        const carte = Array.isArray(json) ? json : (json.cards || Object.values(json));
        const per = new Map(carte.map((c) => [c.id, c]));
        const limite = (id) => { const l = Number((per.get(id) || {}).limit); return l === 1 || l === 2 ? l : 3; };

        const ctx = vm.createContext({ window: {}, console });
        vm.runInContext(fs.readFileSync(path.join(RADICE, 'js', 'data', 'character-decks.js'), 'utf8')
            + '\n;this.__d = { characterDeckDatabase, getCharacterDeck };', ctx);
        const { characterDeckDatabase, getCharacterDeck } = ctx.__d;

        const fuori = [];
        let controllati = 0;
        Object.keys(characterDeckDatabase).forEach((pid) => {
            if (characterDeckDatabase[pid].congelato) return;
            ['easy', 'medium', 'hard'].forEach((livello) => {
                const mazzo = getCharacterDeck(pid, livello);
                if (!mazzo) return;
                controllati++;
                const cnt = {};
                ['main', 'extra'].forEach((z) => (mazzo[z] || []).forEach((e) => { cnt[e.id] = (cnt[e.id] || 0) + e.qty; }));
                Object.keys(cnt).forEach((id) => {
                    if (cnt[id] > limite(Number(id))) fuori.push(`${pid}/${livello}: ${(per.get(Number(id)) || {}).name} ${cnt[id]}>${limite(Number(id))}`);
                });
            });
        });
        assert(controllati > 100, `Troppi pochi mazzi controllati: ${controllati}`);
        assert(fuori.length === 0, `Mazzi oltre il limite di copie (${fuori.length}): ${fuori.slice(0, 8).join('; ')}`);
    }
};
