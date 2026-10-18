// Guardrail sulla FORMA dei messaggi del Multiplayer (js/multiplayer/protocollo-mp.js):
//   1) i tipi descritti nello schema sono ESATTAMENTE quelli che il relay accetta
//      (GAME_ACTION_KINDS in server/server.js): un tipo in uno solo dei due è un
//      messaggio che si spedisce e non arriva, o che arriva senza controllo;
//   2) ogni `kind` spedito dal codice dei client (net.sendAction / MP_broadcast)
//      è nello schema;
//   3) messaggi VERI di ogni tipo passano, e quelli con la forma sbagliata no;
//   4) il relay applica lo stesso controllo (validateGameAction).
// Non serve un browser: sono file e funzioni pure.
const fs = require('fs');
const path = require('path');
const Protocollo = require('../../js/multiplayer/protocollo-mp.js');

const RADICE = path.join(__dirname, '..', '..');

function fileJs(dir) {
    return fs.readdirSync(dir).filter((n) => n.endsWith('.js')).map((n) => path.join(dir, n));
}

module.exports = {
    name: 'Guardrail: i messaggi del Multiplayer hanno una forma controllata, uguale per relay e client',
    standalone: true,
    async run({ assert }) {
        // --- 1) Stessi tipi nel relay e nello schema ---
        const server = fs.readFileSync(path.join(RADICE, 'server', 'server.js'), 'utf8');
        const blocco = (server.match(/const GAME_ACTION_KINDS = new Set\(\[([\s\S]*?)\]\)/) || [])[1] || '';
        const delServer = [...blocco.matchAll(/'([\w-]+)'/g)].map((m) => m[1]).sort();
        const nelloSchema = [...Protocollo.KINDS].sort();
        assert(delServer.length > 0, 'non riesco a leggere GAME_ACTION_KINDS da server/server.js');
        assert(JSON.stringify(delServer) === JSON.stringify(nelloSchema),
            'tipi diversi fra il relay (' + delServer.join(',') + ') e lo schema (' + nelloSchema.join(',') + ')');

        // --- 2) Ogni tipo spedito dai client è nello schema ---
        const spediti = new Set();
        const cartelle = [path.join(RADICE, 'js', 'multiplayer'), path.join(RADICE, 'js', 'engine')];
        cartelle.forEach((dir) => fileJs(dir).forEach((f) => {
            const t = fs.readFileSync(f, 'utf8');
            for (const m of t.matchAll(/(?:sendAction|MP_broadcast)\(\s*\{\s*kind:\s*'([\w-]+)'/g)) spediti.add(m[1]);
        }));
        const nonDescritti = [...spediti].filter((k) => !Protocollo.KINDS.has(k));
        assert(nonDescritti.length === 0, 'tipi spediti dai client ma assenti dallo schema: ' + nonDescritti.join(', '));

        // --- 3) Messaggi veri passano ---
        const buoni = [
            { kind: 'room-config', field: 'images/fields/x.jpg', music: 'audio/x.mp3', origin: 'yu-gi-oh' },
            { kind: 'ready', pronto: true },
            { kind: 'rps', scelta: 'roccia' },
            { kind: 'rps', iniziaChiManda: false },
            { kind: 'mazzo', protocollo: 1, seme: 12345, spec: { main: [{ id: 1, qty: 3 }, { id: 22, qty: 1 }], extra: [{ id: 511, qty: 1 }] } },
            { kind: 'mazzo', protocollo: 1, spec: { main: [{ id: 1, qty: 3 }] } },
            { kind: 'passo', messaggi: [
                { tipo: 'comando', comando: { tipo: 'fase', fase: 'battle' }, turno: 3, fase: 'main1', impronta: 'abc', seq: 1 },
                { tipo: 'decisione', indice: -1, seq: 2 },
                { tipo: 'decisione', indice: 0 }
            ] },
            { kind: 'passo-riprendi', ultimo: 0 },
            { kind: 'game-over', opponentWon: true },
            { kind: 'game-over', opponentWon: 'draw' }
        ];
        buoni.forEach((m) => {
            const motivo = Protocollo.motivoRifiuto(m);
            assert(motivo === null, `messaggio valido rifiutato (${m.kind}): ${motivo}`);
        });
        assert(Protocollo.motivoRifiuto({ kind: 'ready', pronto: true, extra: 1 }) === null, 'un campo in più non è un errore');

        // --- ... e quelli rotti no ---
        const rotti = [
            ['non un oggetto', 'ciao'],
            ['elenco', []],
            ['tipo sconosciuto', { kind: 'telefono-di-casa' }],
            ['ready senza pronto', { kind: 'ready' }],
            ['ready con testo', { kind: 'ready', pronto: 'si' }],
            ['rps vuota', { kind: 'rps' }],
            ['room-config senza campo', { kind: 'room-config', music: 'x' }],
            ['mazzo non elenco', { kind: 'mazzo', protocollo: 1, spec: { main: 'tanti' } }],
            ['mazzo con voce rotta', { kind: 'mazzo', protocollo: 1, spec: { main: [{ id: 'a', qty: 1 }] } }],
            ['mazzo enorme', { kind: 'mazzo', protocollo: 1, spec: { main: Array.from({ length: 5000 }, () => ({ id: 1, qty: 1 })) } }],
            ['seme negativo', { kind: 'mazzo', protocollo: 1, seme: -5, spec: { main: [] } }],
            ['passo senza messaggi', { kind: 'passo' }],
            ['passo con seq testuale', { kind: 'passo', messaggi: [{ tipo: 'decisione', indice: 0, seq: 'uno' }] }],
            ['passo con tipo ignoto', { kind: 'passo', messaggi: [{ tipo: 'boh' }] }],
            ['comando senza tipo', { kind: 'passo', messaggi: [{ tipo: 'comando', comando: {} }] }],
            ['passo-riprendi negativo', { kind: 'passo-riprendi', ultimo: -3 }],
            ['game-over con testo', { kind: 'game-over', opponentWon: 'forse' }]
        ];
        const accettati = rotti.filter(([, m]) => Protocollo.motivoRifiuto(m) === null).map(([n]) => n);
        assert(accettati.length === 0, 'messaggi rotti ACCETTATI: ' + accettati.join(', '));

        // --- 4) Il relay applica lo stesso controllo ---
        const vm = require('vm');
        const pezzoServer = server.slice(server.indexOf('let ProtocolloMP = null;'), server.indexOf('function handleClientMessage'));
        const contesto = { require: (p) => require(path.join(RADICE, 'server', p)), module: {}, console };
        vm.createContext(contesto);
        vm.runInContext(pezzoServer + '\nthis.validateGameAction = validateGameAction;', contesto);
        assert(contesto.validateGameAction(null, null, { kind: 'ready', pronto: true }) === null, 'il relay deve accettare un messaggio valido');
        assert(contesto.validateGameAction(null, null, { kind: 'ready' }) !== null, 'il relay deve rifiutare un messaggio con la forma sbagliata');
        assert(contesto.validateGameAction(null, null, { kind: 'telefono-di-casa' }) === 'azione sconosciuta', 'il relay deve rifiutare un tipo sconosciuto');
    }
};
