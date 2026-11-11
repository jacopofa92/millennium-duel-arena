// tests/helpers/local-servers.js
// =====================================================================
// Due server usa-e-getta per i test che non possono girare su file://.
//
// Il caso concreto è il Multiplayer: mp-lobby.js carica l'arena di duello
// con `fetch('duelMonstersCore.html')`, e una fetch su file:// è bloccata
// dal browser (origine "null") — quindi il test ha bisogno di un vero
// server HTTP sopra la cartella del progetto. E serve anche il server di
// stanze (server/server.js) davvero in esecuzione: è l'unico modo per
// esercitare il protocollo di rete com'è, invece di simulare a mano il
// relay e finire per testare il simulatore.
//
// Entrambi vivono solo per la durata dello spec che li avvia: nessuna
// porta fissa (il sistema ne assegna una libera), così due esecuzioni in
// parallelo — o un server di stanze già avviato a mano sulla 8787 per
// giocare — non si pestano mai i piedi.
// =====================================================================
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.ico': 'image/x-icon'
};

/** Una porta libera scelta dal sistema operativo, per un processo che non può sceglierla da sé (il server di stanze la riceve via PORT). */
function findFreePort() {
    return new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.on('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const { port } = probe.address();
            probe.close(() => resolve(port));
        });
    });
}

/**
 * Server statico di sola lettura sopra la cartella del progetto. Nessuna
 * ambizione oltre il necessario: niente cache, niente range, niente
 * directory listing — e un controllo che il percorso richiesto resti
 * DENTRO la cartella del progetto (un `..` in un URL non deve poter
 * leggere il resto del disco, nemmeno in un server di test).
 */
async function startStaticServer(root = PROJECT_ROOT) {
    const server = http.createServer((req, res) => {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const filePath = path.resolve(root, '.' + urlPath);
        if (!filePath.startsWith(root)) {
            res.writeHead(403).end('Fuori dalla cartella del progetto');
            return;
        }
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Non trovato: ' + urlPath);
                return;
            }
            res.writeHead(200, {
                'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
                'Cache-Control': 'no-store'
            });
            res.end(data);
        });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    return {
        origin: `http://127.0.0.1:${port}`,
        async close() {
            await new Promise((resolve) => server.close(resolve));
        }
    };
}

/**
 * Avvia server/server.js come vero sottoprocesso (è quello che gira in
 * produzione: `require.main === module` lì dentro fa da interruttore) e
 * aspetta che risponda davvero, invece di sperare in un ritardo fisso.
 */
async function startRoomServer(extraEnv = {}) {
    const port = await findFreePort();
    const child = spawn(process.execPath, [path.join(PROJECT_ROOT, 'server', 'server.js')], {
        env: Object.assign({}, process.env, { PORT: String(port) }, extraEnv),
        stdio: ['ignore', 'pipe', 'pipe']
    });
    const errors = [];
    child.stderr.on('data', (chunk) => errors.push(chunk.toString()));

    const deadline = Date.now() + 10000;
    for (;;) {
        if (child.exitCode !== null) {
            throw new Error(`Il server di stanze si è chiuso subito (codice ${child.exitCode}): ${errors.join('')}`);
        }
        const alive = await new Promise((resolve) => {
            const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 500 }, (res) => {
                res.resume();
                resolve(true);
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
        });
        if (alive) break;
        if (Date.now() > deadline) {
            child.kill();
            throw new Error(`Il server di stanze non ha risposto entro 10s sulla porta ${port}: ${errors.join('')}`);
        }
        await new Promise((r) => setTimeout(r, 100));
    }

    return {
        wsUrl: `ws://127.0.0.1:${port}`,
        async close() {
            if (child.exitCode === null) {
                child.kill();
                await new Promise((resolve) => child.once('exit', resolve));
            }
        }
    };
}

module.exports = { startStaticServer, startRoomServer, findFreePort, PROJECT_ROOT };
