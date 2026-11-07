// Il relay manda un ping ai client (una connessione ferma in sala d'attesa non porta traffico e il proxy la chiude), e chiude il socket
// di chi non da' piu' alcun segnale.
const net = require('net');
const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');
const { findFreePort, PROJECT_ROOT } = require('../helpers/local-servers');

module.exports = {
    name: 'Server di stanze: ping periodico ai client e chiusura dei socket muti',
    standalone: true,
    async run(t) {
        const port = await findFreePort();
        const child = spawn(process.execPath, [path.join(PROJECT_ROOT, 'server', 'server.js')], {
            env: Object.assign({}, process.env, { PORT: String(port), PING_INTERVAL_MS: '200' }),
            stdio: ['ignore', 'ignore', 'ignore']
        });
        try {
            await new Promise((r) => setTimeout(r, 800));
            const apri = (rispondi) => new Promise((resolve, reject) => {
                const socket = net.connect(port, '127.0.0.1');
                const stato = { ping: 0, chiuso: false, buffer: Buffer.alloc(0), intestazioniFinite: false };
                socket.on('connect', () => {
                    socket.write('GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: '
                        + crypto.randomBytes(16).toString('base64') + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
                });
                socket.on('data', (d) => {
                    stato.buffer = Buffer.concat([stato.buffer, d]);
                    let dopo = stato.buffer;
                    if (!stato.intestazioniFinite) {
                        const fineIntestazioni = stato.buffer.toString('latin1').indexOf('\r\n\r\n');
                        if (fineIntestazioni === -1) return;
                        stato.intestazioniFinite = true;
                        dopo = stato.buffer.slice(fineIntestazioni + 4);
                    }
                    // Ogni ping del server e' un frame di 2 byte: 0x89 0x00.
                    for (let i = 0; i + 1 < dopo.length; i += 2) {
                        if (dopo[i] === 0x89) {
                            stato.ping++;
                            // Il pong (frame mascherato, come fa un browser) tiene vivo il socket.
                            if (rispondi) socket.write(Buffer.from([0x8a, 0x80, 0, 0, 0, 0]));
                        }
                    }
                    stato.buffer = Buffer.alloc(0);
                    resolve(stato);
                });
                socket.on('close', () => { stato.chiuso = true; });
                socket.on('error', reject);
                stato.socket = socket;
            });

            const vivo = await apri(true);
            await new Promise((r) => setTimeout(r, 1200));
            t.assert(vivo.ping >= 3, `Il server manda un ping a intervalli regolari (visti ${vivo.ping})`);
            t.assert(!vivo.chiuso, 'Chi risponde ai ping resta collegato');
            vivo.socket.destroy();

            // Un socket che non risponde mai (e non manda niente) e' morto: dopo 3 intervalli il server lo chiude.
            const muto = await apri(false);
            await new Promise((r) => setTimeout(r, 1500));
            t.assert(muto.chiuso, 'Un socket muto viene chiuso dal server');
        } finally {
            child.kill();
        }
    }
};
