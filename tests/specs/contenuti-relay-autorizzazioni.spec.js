const http = require('http');
const fs = require('fs');
const path = require('path');
const { startRoomServer } = require('../helpers/local-servers');

async function collega(url) {
    const socket = new WebSocket(url);
    const messaggi = [];
    socket.addEventListener('message', (e) => messaggi.push(JSON.parse(e.data)));
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    return {
        socket, messaggi,
        invia: (m) => socket.send(JSON.stringify(m)),
        async prossimo(type) {
            const fino = Date.now() + 6000;
            while (Date.now() < fino) {
                const i = messaggi.findIndex((m) => m.type === type);
                if (i >= 0) return messaggi.splice(i, 1)[0];
                await new Promise((r) => setTimeout(r, 15));
            }
            throw new Error('Messaggio relay atteso: ' + type + ', ricevuti: ' + JSON.stringify(messaggi));
        }
    };
}

module.exports = {
    standalone: true,
    name: 'Relay autenticato: token verificati, contenuti condivisi, mazzi canonici e riconnessione dello stesso account',
    async run({ assert }) {
        const HOST = '11111111-1111-1111-1111-111111111111';
        const GUEST = '22222222-2222-2222-2222-222222222222';
        const utenti = { 'token-host-valido': HOST, 'token-base-valido': GUEST, 'token-host-revocato': HOST };
        const mock = http.createServer((req, res) => {
            const token = (req.headers.authorization || '').replace('Bearer ', '');
            const uid = utenti[token];
            res.setHeader('Content-Type', 'application/json');
            if (!uid) { res.writeHead(401).end('{}'); return; }
            if (req.url === '/auth/v1/user') { res.end(JSON.stringify({ id: uid })); return; }
            res.end(JSON.stringify([{ status: token === 'token-host-revocato' ? 'suspended' : 'approved', is_admin: false,
                content_ww1: uid === HOST, content_ww2: false, content_extra: uid === HOST }]));
        });
        await new Promise((r) => mock.listen(0, '127.0.0.1', r));
        const relay = await startRoomServer({ MP_REQUIRE_AUTH: '1', SUPABASE_URL: 'http://127.0.0.1:' + mock.address().port, SUPABASE_ANON_KEY: 'pubblica-di-prova' });
        const clients = [];
        const nuovo = async () => { const c = await collega(relay.wsUrl); clients.push(c); return c; };
        try {
            const anon = await nuovo();
            anon.invia({ type: 'create-room', content_ww1: true, is_admin: true });
            assert((await anon.prossimo('error')).message.includes('Accedi'), 'Flag dichiarati senza token non creano una stanza');
            anon.invia({ type: 'create-room', accessToken: 'token-falso-con-flag-admin' });
            assert((await anon.prossimo('error')).message.includes('Sessione'), 'Un token inventato non autentica');
            const host = await nuovo();
            const guest = await nuovo();
            host.invia({ type: 'create-room', accessToken: 'token-host-valido' });
            const stanza = await host.prossimo('room-created');
            const config = (field) => ({ kind: 'room-config', field, music: '30. Preliminaries.mp3', origin: 'all' });
            // Il messaggio errato successivo è una barriera: garantisce che il relay
            // abbia già elaborato la configurazione precedente su quel socket.
            async function barriera() { host.invia({ type: 'game-action', action: { kind: 'non-esiste' } }); await host.prossimo('error'); }
            host.invia({ type: 'game-action', action: config('grandeGuerraCampoDiBattagliaGiorno.jpg') });
            await barriera();
            guest.invia({ type: 'join-room', code: stanza.code, accessToken: 'token-base-valido', content_ww1: true });
            assert((await guest.prossimo('error')).message.includes('WW1'), 'Non si entra in una stanza WW1 con un account base');
            host.invia({ type: 'game-action', action: config('citta.jpg') });
            await barriera();
            guest.invia({ type: 'join-room', code: stanza.code, accessToken: 'token-base-valido' });
            await guest.prossimo('room-ready');
            await host.prossimo('room-ready');
            guest.invia({ type: 'game-action', action: config('citta.jpg') });
            assert((await guest.prossimo('error')).message.includes('creatore'), 'Il guest non può sostituire la configurazione host');
            host.invia({ type: 'game-action', action: config('grandeGuerraCampoDiBattagliaGiorno.jpg') });
            assert((await host.prossimo('error')).message.includes('WW1'), 'Anche un host abilitato deve rispettare i permessi del guest');
            const cards = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/cards.json'), 'utf8'));
            const guerra = cards.find((c) => c.origin === 'ww1');
            guest.invia({ type: 'game-action', action: { kind: 'mazzo', protocollo: 1, spec: { main: [{ id: guerra.id, qty: 1, origin: 'yu-gi-oh' }], extra: [] } } });
            assert((await guest.prossimo('error')).message.includes('WW1'), 'ID canonico controllato anche con origin contraffatto');
            guest.invia({ type: 'game-action', action: { kind: 'ready', pronto: false, pedina: 'robertoGiacobbo' } });
            assert((await guest.prossimo('error')).message.includes('EXTRA'), 'Pedina Extra non autorizzata rifiutata');
            guest.invia({ type: 'rejoin-room', code: stanza.code, playerId: stanza.playerId, accessToken: 'token-base-valido' });
            assert((await guest.prossimo('error')).message.includes('altro account'), 'Il playerId non basta a rubare il posto di un altro account');
            const base = cards.find((c) => !c.origin || c.origin === 'yu-gi-oh');
            guest.invia({ type: 'game-action', action: { kind: 'mazzo', protocollo: 1, spec: { main: [{ id: base.id, qty: 1 }], extra: [] } } });
            assert((await host.prossimo('game-action')).action.kind === 'mazzo', 'Il mazzo base continua a essere inoltrato');
            host.invia({ type: 'game-action', accessToken: 'token-host-revocato', action: { kind: 'ready', pronto: true } });
            assert((await host.prossimo('error')).message.includes('non può accedere'), 'Il nuovo token non nasconde una sospensione');
        } finally {
            clients.forEach((c) => c.socket.close());
            await relay.close();
            mock.closeAllConnections();
            await new Promise((r) => mock.close(r));
        }
    }
};
