// Il passo comune "a posti" (fase 3 del Tag Team, docs/planning/PIANO_TAG_TEAM.md): più di due motori.
//
// tools/gemello-posti.js fa girare TRE copie complete del motore sullo stesso orologio virtuale: il client 'h'
// gioca il posto A0 (con l'IA), 'o' gioca B0, e 's' è uno SPETTATORE che non controlla nulla e segue la partita
// soltanto dai messaggi degli altri due. Ogni messaggio porta il posto assoluto e il mittente; ogni client tiene
// un flusso ordinato per mittente. La partita è "allineata" se nessun client diverge mai, tutti finiscono con lo
// stesso stato e vedono vincere la stessa squadra.
//
// Più due partite del gemello a DUE motori (il Multiplayer di oggi) che divergevano prima di questo lavoro:
// l'IA tirava i suoi numeri dal generatore CONDIVISO del duello (pickWeightedByImpact in js/ai/ai-shared.js), ma
// un'IA gira su un solo client, quindi da lì in poi uno scarto "a caso" usciva diverso (Pegasus/Marik, semi 1029
// e 1036). Nel Multiplayer fra due persone non c'è IA, ma nel Tag Team in rete sì (compagni, Duellanti, Boss).
// Verificato al contrario: rimettendo Casuale.random nell'IA quei due semi divergono.
//
// Standalone: non apre pagine.
const path = require('path');

const A_POSTI = [
    ['yamiYugi', 'kaiba', 2000], ['yamiYugi', 'kaiba', 2001], ['pegasus', 'marik', 2003],
    ['joey', 'mai', 2004], ['bakura', 'nitemare', 2005], ['odion', 'heishin', 2006]
];
const DUE_MOTORI = [['pegasus', 'marik', 1029], ['pegasus', 'marik', 1036]];

module.exports = {
    name: 'Passo comune a posti: tre motori (due duellanti e uno spettatore) restano allineati',
    standalone: true,
    async run({ assert }) {
        const radice = path.join(__dirname, '..', '..', 'tools');
        const { giocaGemelloPosti, descrivi, unoControUnoConSpettatore } = require(path.join(radice, 'gemello-posti.js'));
        const { giocaGemello } = require(path.join(radice, 'duello-gemello.js'));
        const problemi = [];
        let ricevutiSpettatore = 0;
        for (const [a, b, seme] of A_POSTI) {
            const r = await giocaGemelloPosti(Object.assign(unoControUnoConSpettatore(a, b, 'hard'), { seme, turni: 60 }), 0);
            if (!r.buona) problemi.push(`${a}/${b} ${descrivi(r).split('\n').slice(0, 4).join(' | ').slice(0, 600)}`);
            // Lo spettatore non manda nulla e riceve tutto da entrambi.
            const s = r.fotografie[r.lati.indexOf('s')].passo;
            if (s.inviati !== 0) problemi.push(`${a}/${b} seme ${seme}: lo spettatore ha mandato ${s.inviati} messaggi`);
            ricevutiSpettatore += s.ricevuti;
        }
        for (const [host, ospite, seme] of DUE_MOTORI) {
            const r = await giocaGemello({ host, ospite, livelloHost: 'hard', livelloOspite: 'hard', seme, turni: 60 }, 0);
            if (r.divergenze.length || !r.esitiCoerenti || (r.motivoStop === 'fine' && !r.finaliUguali)) {
                problemi.push(`gemello a due motori ${host}/${ospite} seme ${seme}: ${r.motivoStop}, ${r.divergenze.slice(0, 1).join('').slice(0, 300)}`);
            }
        }
        assert(problemi.length === 0, `Passo comune a posti:\n  - ${problemi.join('\n  - ')}`);
        assert(ricevutiSpettatore > 200, `Lo spettatore ha ricevuto troppo poco (${ricevutiSpettatore} messaggi): i flussi per mittente funzionano?`);
    }
};
