// Tag Team in rete (fase 3, passo 2, docs/planning/PIANO_TAG_TEAM.md): squadre su più client a passo comune.
//
// tools/gemello-posti.js fa girare un motore per client (persone simulate dall'IA) e prepara le squadre come la
// pagina, con i posti assoluti. Quattro formati: 2 contro 2 fra quattro persone, una coppia contro un Duellante
// IA (che gira sull'host), tu + compagno IA contro un amico + compagno IA (due client), e 2 contro 1 fra tre
// persone. Una partita è "allineata" se nessun client diverge mai e tutti finiscono uguali.
//
// Dentro anche le due partite che hanno trovato difetti veri:
//  - 2v2-quattro, seme 7029: il livello dell'IA di un membro era scritto solo sul client dove quell'IA gira;
//    Abbandono (id 416) lo legge per ordinare i candidati, e la scelta (che viaggia come POSIZIONE) indicava
//    due mostri diversi. Ora il livello è un dato del membro, uguale su tutti i client (scambia in tag.js);
//  - squadre miste Weevil/Rex contro Mako/Mai, seme 9103: un Equipaggiamento rimasto senza il suo mostro
//    finiva nel Cimitero al ridisegno, in momenti diversi sui client. Ora il passo comune ricalcola gli effetti
//    continui all'avviso A4, prima dell'impronta, nello stesso punto ovunque.
// Verificato al contrario su entrambi (rimettendo la versione di prima, quelle partite divergono).
//
// Lo scambio di turno "su richiesta" in rete (decisioni con un posto assoluto esplicito) qui non si vede: lo
// chiedono solo le persone vere, e nel gemello le persone sono IA. Lo prova lo spec end-to-end con le pagine.
//
// Standalone: non apre pagine.
const path = require('path');

const ALLA_FINE = `({
    entrate: __logDuello.filter((r) => r.indexOf('ha finito i Life Point ed esce') !== -1).length,
    affronta: __logDuello.filter((r) => r.indexOf(' affronta ') !== -1).length
})`;

module.exports = {
    name: 'Tag Team in rete: squadre su due, tre e quattro client restano allineate',
    standalone: true,
    async run({ assert }) {
        const { giocaGemelloPosti, descrivi, SCENARI_TAG, tagInRete } = require(path.join(__dirname, '..', '..', 'tools', 'gemello-posti.js'));
        const p = (personaggio, client, livello) => ({ personaggio, livello: livello || 'hard', client });
        const casi = [];
        Object.keys(SCENARI_TAG).forEach((nome) => [0, 1, 2].forEach((n) => casi.push({ nome, opz: SCENARI_TAG[nome](p), seme: 7000, n })));
        casi.push({ nome: '2v2-quattro (Abbandono)', opz: SCENARI_TAG['2v2-quattro'](p), seme: 7000, n: 29 });
        casi.push({
            nome: 'squadre miste (Equipaggiamento orfano)',
            opz: tagInRete({ posti: { A0: p('weevil', 'h', 'medium'), A1: p('rex', 'h', 'medium'), B0: p('mako', 'o', 'medium'), B1: p('mai', 'o', 'medium') }, client: { h: 'A', o: 'B' } }),
            seme: 9100, n: 3
        });
        const problemi = [];
        let entrate = 0;
        let affronta = 0;
        for (const c of casi) {
            const r = await giocaGemelloPosti(Object.assign({}, c.opz, { seme: c.seme, turni: 80, allaFine: ALLA_FINE }), c.n);
            if (!r.buona) problemi.push(`${c.nome}: ${descrivi(r).split('\n').slice(0, 3).join(' | ').slice(0, 700)}`);
            entrate += (r.extra && r.extra.entrate) || 0;
            affronta += (r.extra && r.extra.affronta) || 0;
        }
        assert(problemi.length === 0, `Tag Team in rete:\n  - ${problemi.join('\n  - ')}`);
        // Il campione deve passare davvero dai punti delicati: compagni che entrano a metà turno avversario (D15,
        // all'avviso A4) e scelte di chi affrontare (D12).
        assert(entrate > 0 && affronta > 50, `Campione troppo povero: ${entrate} entrate di compagni, ${affronta} scelte di chi affrontare`);
    }
};
