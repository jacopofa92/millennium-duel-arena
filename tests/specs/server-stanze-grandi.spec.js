// Il relay per il Tag Team in rete: stanze da 3 o 4 posti scelte da chi crea,
// id pubblici, elenco della stanza a tutti, inoltro a TUTTI gli altri con chi
// manda, uscita annunciata col nome, host che passa al primo rimasto, stanza
// chiusa dall'host. E la stanza da 2 di sempre, che non deve cambiare.
// Client WebSocket veri (quello nativo di Node) contro il server vero.
const { startRoomServer } = require('../helpers/local-servers');

function client(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const ricevuti = [];
        const attese = [];
        ws.addEventListener('message', (e) => {
            const msg = JSON.parse(e.data);
            ricevuti.push(msg);
            attese.slice().forEach((a) => { if (a.filtro(msg)) { attese.splice(attese.indexOf(a), 1); a.risolvi(msg); } });
        });
        ws.addEventListener('error', reject);
        ws.addEventListener('open', () => resolve({
            ws, ricevuti,
            manda: (o) => ws.send(JSON.stringify(o)),
            /** Il primo messaggio (già arrivato e non ancora preso, o in arrivo) che passa il filtro. */
            aspetta(filtro, ms = 4000) {
                const i = ricevuti.findIndex((m) => !m.__preso && filtro(m));
                if (i >= 0) { ricevuti[i].__preso = true; return Promise.resolve(ricevuti[i]); }
                return new Promise((risolvi, rifiuta) => {
                    const t = setTimeout(() => rifiuta(new Error('messaggio atteso non arrivato')), ms);
                    attese.push({ filtro, risolvi: (m) => { clearTimeout(t); m.__preso = true; risolvi(m); } });
                });
            },
            chiudi: () => ws.close()
        }));
    });
}

const tipo = (t, extra) => (m) => m.type === t && (!extra || extra(m));
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
    standalone: true,
    name: 'Server Multiplayer: stanze da 3-4 posti per il Tag Team (e quella da 2 invariata)',
    async run(t) {
        const relay = await startRoomServer();
        const aperti = [];
        const nuovo = async () => { const c = await client(relay.wsUrl); aperti.push(c); return c; };
        try {
            // --- Stanza da 4 ---
            const a = await nuovo();
            a.manda({ type: 'create-room', capienza: 4 });
            const creata = await a.aspetta(tipo('room-created'));
            t.assert(creata.capienza === 4 && creata.tu === 'g1', 'room-created dice capienza e id pubblico: ' + JSON.stringify(creata));
            const code = creata.code;
            const primo = await a.aspetta(tipo('room-update'));
            t.assert(primo.host === 'g1' && primo.giocatori.length === 1, 'Chi crea riceve subito l\'elenco della stanza');

            const b = await nuovo(); b.manda({ type: 'join-room', code });
            const c = await nuovo(); c.manda({ type: 'join-room', code });
            const d = await nuovo(); d.manda({ type: 'join-room', code });
            const ultimoD = await d.aspetta(tipo('room-update', (m) => m.giocatori.length === 4));
            t.assert(ultimoD.tu === 'g4' && ultimoD.host === 'g1' && typeof ultimoD.playerId === 'string', 'Il quarto è g4 e riceve il suo segreto: ' + JSON.stringify(ultimoD));
            t.assert(!b.ricevuti.some((m) => m.type === 'room-ready'), 'Una stanza grande non manda room-ready (non si parte quando è piena)');
            const segretiDiversi = new Set([a, b, c, d].map((x) => x.ricevuti.filter((m) => m.playerId).map((m) => m.playerId).pop()));
            t.assert(segretiDiversi.size === 4, 'Ognuno riceve solo il PROPRIO playerId');

            const e = await nuovo(); e.manda({ type: 'join-room', code });
            const piena = await e.aspetta(tipo('error'));
            t.assert(/piena/.test(piena.message), 'Il quinto è respinto: ' + piena.message);

            // Un messaggio arriva a TUTTI gli altri, con chi lo manda, e non torna a chi lo manda.
            b.manda({ type: 'game-action', action: { kind: 'ready', pronto: true } });
            for (const x of [a, c, d]) {
                const m = await x.aspetta(tipo('game-action'));
                t.assert(m.da === 'g2' && m.action.kind === 'ready', 'Inoltro con mittente: ' + JSON.stringify(m));
            }
            await pausa(150);
            t.assert(!b.ricevuti.some((m) => m.type === 'game-action'), 'Chi manda non riceve il proprio messaggio');

            // L'host esce: gli altri lo sanno per nome e l'host diventa il primo rimasto.
            a.manda({ type: 'leave-room' });
            for (const x of [b, c, d]) {
                const m = await x.aspetta(tipo('opponent-left'));
                t.assert(m.da === 'g1', 'opponent-left dice chi: ' + JSON.stringify(m));
            }
            const dopo = await c.aspetta(tipo('room-update', (m) => !m.giocatori.some((x) => x.id === 'g1')));
            t.assert(dopo.host === 'g2', 'L\'host passa al primo rimasto: ' + dopo.host);

            // Caduta e rientro di un giocatore: annunciati col nome, e il rientro ridà lo stesso id.
            const segretoD = ultimoD.playerId;
            d.chiudi();
            const giu = await b.aspetta(tipo('opponent-disconnected'));
            t.assert(giu.da === 'g4', 'La caduta dice chi');
            const d2 = await nuovo(); d2.manda({ type: 'rejoin-room', code, playerId: segretoD });
            const rientro = await d2.aspetta(tipo('rejoined'));
            t.assert(rientro.tu === 'g4', 'Chi rientra torna g4');
            const su = await c.aspetta(tipo('opponent-reconnected'));
            t.assert(su.da === 'g4', 'Il rientro dice chi');

            // Solo l'host chiude la stanza; chiusa, nessuno entra più (anche con un posto libero).
            c.manda({ type: 'lock-room' });
            const f = await nuovo(); f.manda({ type: 'join-room', code });
            const entrato = await f.aspetta(tipo('room-update'));
            t.assert(entrato.tu === 'g5', 'Un non-host non può chiudere: si entra ancora');
            f.manda({ type: 'leave-room' });
            await pausa(100);
            b.manda({ type: 'lock-room' });
            await pausa(100);
            const g = await nuovo(); g.manda({ type: 'join-room', code });
            const chiusa = await g.aspetta(tipo('error'));
            t.assert(/cominciata/.test(chiusa.message), 'Stanza chiusa dall\'host: ' + chiusa.message);

            // --- Stanza da 2 di sempre: niente capienza, room-ready, niente room-update ---
            const h = await nuovo(); h.manda({ type: 'create-room' });
            const c2 = await h.aspetta(tipo('room-created'));
            t.assert(c2.capienza === 2, 'Senza capienza la stanza è da 2');
            const k = await nuovo(); k.manda({ type: 'join-room', code: c2.code });
            const prontiH = await h.aspetta(tipo('room-ready'));
            const prontiK = await k.aspetta(tipo('room-ready'));
            t.assert(prontiH.youStart === true && prontiK.youStart === false, 'room-ready come prima');
            const l = await nuovo(); l.manda({ type: 'join-room', code: c2.code });
            t.assert(/piena/.test((await l.aspetta(tipo('error'))).message), 'Il terzo è respinto in una stanza da 2');
            t.assert(!h.ricevuti.some((m) => m.type === 'room-update'), 'Nessun room-update in una stanza da 2');
            // Capienze assurde: stanza da 2.
            const z = await nuovo(); z.manda({ type: 'create-room', capienza: 99 });
            t.assert((await z.aspetta(tipo('room-created'))).capienza === 2, 'Capienza fuori misura = 2');
        } finally {
            aperti.forEach((x) => { try { x.chiudi(); } catch (err) { /* già chiuso */ } });
            await relay.close();
        }
    }
};
