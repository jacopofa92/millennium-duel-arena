/**
 * server.js — Server di Stanze per Yu-Gi-Oh! Millennium Duel Arena (Multiplayer)
 * =====================================================================
 * Server WebSocket "puro", scritto solo con moduli nativi di Node.js
 * (http, crypto, net) — NESSUNA dipendenza esterna, quindi non serve
 * "npm install" prima di avviarlo.
 *
 * Cosa fa:
 *   1) Espone un endpoint WebSocket (stessa porta dell'HTTP, upgrade).
 *   2) Gestisce un sistema di STANZE identificate da un codice a 5
 *      caratteri: un giocatore crea una stanza, l'altro la raggiunge
 *      con il codice, e da quel momento il server fa da "postino":
 *      inoltra ogni messaggio di gioco da un giocatore a tutti gli altri
 *      (una stanza ha 2 posti, o fino a 4 se chi la crea lo chiede: Tag
 *      Team in rete; da 3 in su ogni messaggio porta `da`, chi lo manda),
 *      senza mai calcolare la logica della partita (che resta
 *      interamente lato client, in js/multiplayer.js).
 *   3) Riconosce ogni giocatore con un token (non col socket, che cambia
 *      ad ogni riconnessione): se la connessione cade, la stanza resta
 *      viva per una finestra di grazia (RECONNECT_GRACE_MS) durante la
 *      quale un 'rejoin-room' con lo stesso token torna alla stessa
 *      partita — vedi js/network.js, che riprova la connessione da solo.
 *      Vedi server/README.md, sezione 5, per il limite dichiarato di
 *      questo meccanismo (non sopravvive alla chiusura vera della scheda).
 *
 * Avvio:
 *   node server.js
 *   (di default ascolta su 0.0.0.0:8787 — personalizzabile con la
 *   variabile d'ambiente PORT, es: PORT=3000 node server.js)
 *
 * Per giocare via Internet con un amico, questo processo deve essere
 * raggiungibile pubblicamente: o lo esegui su un servizio come
 * Render / Railway / Fly.io / Glitch (gratuiti), oppure lo esegui in
 * locale e usi un tunnel (es. ngrok/Cloudflare Tunnel) per esporlo.
 * Per giocare sulla stessa rete locale (stessa Wi-Fi), basta l'IP
 * locale della macchina che lo esegue.
 */

const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 8787;
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // niente caratteri ambigui (0/O, 1/I/L)
const ROOM_TTL_MS = 30 * 60 * 1000; // le stanze inutilizzate scadono dopo 30 minuti
// Quanto aspettare, dopo che la connessione di un giocatore cade, prima di
// considerarlo DAVVERO uscito dalla stanza — copre il caso comune di una
// disconnessione breve (Wi-Fi che sfarfalla, laptop in sospensione) con la
// scheda del browser rimasta aperta: js/network.js riprova la connessione
// da sola e, se ce la fa entro questa finestra, manda 'rejoin-room' per
// tornare nella STESSA stanza. Non copre la chiusura vera della scheda
// (SEMPLIFICAZIONE DELIBERATA, vedi il piano/commento in cima al file):
// farlo richiederebbe salvare l'intera partita lato server, che oggi resta
// solo un relay cieco tra due client autorevoli.
const RECONNECT_GRACE_MS = 45 * 1000;
// Validazione di FORMA (non delle regole del duello — vedi handleClientMessage
// più sotto) contro un client rotto o malevolo che inondasse il relay.
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_MESSAGES = 20;
const MAX_MESSAGE_BYTES = 65536;

// Stanze da più di due giocatori (Tag Team in rete): da 2 a 4 posti, scelti
// da chi crea la stanza. Una stanza creata senza dire nulla resta da 2, come
// prima: i client del duello 1 contro 1 non sanno che le altre esistono.
const CAPIENZA_MIN = 2;
const CAPIENZA_MAX = 4;

/**
 * Ogni giocatore ha DUE identità: il playerId (segreto, serve solo a lui per
 * rientrare dopo una caduta di linea: chi lo conosce può prendere il suo
 * posto) e un id PUBBLICO breve ('g1', 'g2'...), che il relay mette sui
 * messaggi inoltrati (`da`) e nell'elenco della stanza. In una stanza da 2
 * il mittente è implicito; da 3 in su i client devono sapere chi parla.
 * @typedef {{ socket: import('net').Socket|null, disconnectTimer: NodeJS.Timeout|null, pubblico: string }} PlayerSlot
 * @type {Map<string, { players: Map<string, PlayerSlot>, createdAt: number, capienza: number, prossimoPubblico: number, chiusa: boolean }>}
 */
const rooms = new Map();

function generateRoomCode() {
    let code;
    do {
        code = Array.from({ length: 5 }, () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]).join('');
    } while (rooms.has(code));
    return code;
}

/** Token casuale che identifica un giocatore attraverso una riconnessione — mai il socket stesso, che cambia ad ogni nuova connessione. */
function generatePlayerId() {
    return crypto.randomBytes(12).toString('hex');
}

// ============================================================
// Framing WebSocket minimale (solo testo, RFC 6455)
// ============================================================

function encodeFrame(payloadStr) {
    const payload = Buffer.from(payloadStr, 'utf8');
    const len = payload.length;
    let header;

    if (len < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x81; // FIN + opcode testo
        header[1] = len;
    } else if (len < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(len, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(len), 2);
    }

    return Buffer.concat([header, payload]);
}

/**
 * Decodifica in modo incrementale i frame WebSocket presenti in un
 * buffer. Ritorna { messages: string[], rest: Buffer } — i messaggi
 * completi trovati e i byte residui (frame incompleto) da tenere
 * in coda per la prossima ricezione.
 */
function decodeFrames(buffer) {
    const messages = [];
    let offset = 0;

    while (true) {
        if (buffer.length - offset < 2) break;

        const byte1 = buffer[offset];
        const byte2 = buffer[offset + 1];
        const opcode = byte1 & 0x0f;
        const masked = (byte2 & 0x80) !== 0;
        let payloadLen = byte2 & 0x7f;
        let cursor = offset + 2;

        if (payloadLen === 126) {
            if (buffer.length - cursor < 2) break;
            payloadLen = buffer.readUInt16BE(cursor);
            cursor += 2;
        } else if (payloadLen === 127) {
            if (buffer.length - cursor < 8) break;
            payloadLen = Number(buffer.readBigUInt64BE(cursor));
            cursor += 8;
        }

        let maskKey = null;
        if (masked) {
            if (buffer.length - cursor < 4) break;
            maskKey = buffer.slice(cursor, cursor + 4);
            cursor += 4;
        }

        if (buffer.length - cursor < payloadLen) break; // frame incompleto, aspetta altri dati

        let payload = buffer.slice(cursor, cursor + payloadLen);
        if (masked) {
            const unmasked = Buffer.alloc(payloadLen);
            for (let i = 0; i < payloadLen; i++) {
                unmasked[i] = payload[i] ^ maskKey[i % 4];
            }
            payload = unmasked;
        }

        if (opcode === 0x8) {
            messages.push(null); // segnale di chiusura
        } else if (opcode === 0x1) {
            messages.push(payload.toString('utf8'));
        }
        // opcode 0x9 (ping) / 0xA (pong) ignorati: i browser gestiscono da soli il keepalive

        offset = cursor + payloadLen;
    }

    return { messages, rest: buffer.slice(offset) };
}

// ============================================================
// Gestione stanze — ogni giocatore è identificato da un playerId
// (token casuale, non dal socket: il socket cambia ad ogni riconnessione,
// vedi generatePlayerId più sopra). room.players: Map<playerId, PlayerSlot>.
// ============================================================

function sendJSON(socket, obj) {
    if (!socket || socket.destroyed) return;
    try {
        socket.write(encodeFrame(JSON.stringify(obj)));
    } catch (err) {
        // socket già chiuso: ignora
    }
}

/** playerId dell'AVVERSARIO di `playerId` in una stanza da 2 — null se la stanza non ha (ancora) un secondo giocatore. */
function otherPlayerId(room, playerId) {
    for (const id of room.players.keys()) {
        if (id !== playerId) return id;
    }
    return null;
}

/** Tutti gli altri giocatori della stanza (da 2 è uno solo, come otherPlayerId). */
function otherPlayerIds(room, playerId) {
    return [...room.players.keys()].filter((id) => id !== playerId);
}

function sendToPlayer(room, playerId, obj) {
    const slot = room.players.get(playerId);
    if (slot && slot.socket) sendJSON(slot.socket, obj);
}

/** Lo stesso messaggio a tutti tranne `playerId`. */
function sendToOthers(room, playerId, obj) {
    otherPlayerIds(room, playerId).forEach((id) => sendToPlayer(room, id, obj));
}

/** L'id pubblico di un giocatore (null se non è più nella stanza). */
function pubblicoDi(room, playerId) {
    const slot = room.players.get(playerId);
    return slot ? slot.pubblico : null;
}

function nuovoSlot(room, socket) {
    room.prossimoPubblico += 1;
    return { socket, disconnectTimer: null, pubblico: 'g' + room.prossimoPubblico };
}

/** Una capienza chiesta dal client: un intero fra 2 e 4, altrimenti 2 (la stanza di sempre). */
function capienzaValida(v) {
    return Number.isInteger(v) && v >= CAPIENZA_MIN && v <= CAPIENZA_MAX ? v : CAPIENZA_MIN;
}

/**
 * Stanze da più di 2: a ogni ingresso, uscita, caduta o rientro tutti
 * ricevono l'elenco aggiornato. L'host è il primo della stanza (chi l'ha
 * creata, o il primo rimasto se è uscito). `tu` è l'id pubblico di chi
 * riceve, e `playerId` il SUO segreto (serve per rientrare): ognuno riceve
 * solo il proprio. Le stanze da 2 non lo ricevono: hanno 'room-ready'.
 */
function annunciaStanza(room, code) {
    if (room.capienza <= 2) return;
    const giocatori = [...room.players.values()].map((s) => ({ id: s.pubblico, collegato: !!s.socket }));
    const host = giocatori.length ? giocatori[0].id : null;
    room.players.forEach((slot, playerId) => {
        if (!slot.socket) return;
        sendJSON(slot.socket, { type: 'room-update', code, capienza: room.capienza, host, tu: slot.pubblico, playerId, giocatori, chiusa: room.chiusa });
    });
}

/**
 * Rimozione DEFINITIVA di un giocatore dalla sua stanza (scaduta la
 * finestra di grazia, o abbandono volontario tramite 'leave-room') —
 * avvisa l'avversario con 'opponent-left' (diverso dal soft
 * 'opponent-disconnected' scatenato subito alla caduta della connessione,
 * vedi handleSocketClose più sotto) e cancella la stanza se resta vuota.
 */
function removePlayerFully(roomCode, playerId) {
    const room = rooms.get(roomCode);
    if (!room) return;
    const slot = room.players.get(playerId);
    if (slot && slot.disconnectTimer) clearTimeout(slot.disconnectTimer);
    room.players.delete(playerId);
    // `da`: in una stanza da più di 2 bisogna sapere CHI è uscito.
    if (slot) sendToOthers(room, playerId, { type: 'opponent-left', da: slot.pubblico });
    if (room.players.size === 0) { rooms.delete(roomCode); return; }
    annunciaStanza(room, roomCode);
}

/**
 * Chiamata quando il SOCKET di un giocatore si chiude/errora (non
 * necessariamente un abbandono volontario): non rimuove subito il
 * giocatore, apre una finestra di grazia (RECONNECT_GRACE_MS) durante la
 * quale 'rejoin-room' con lo stesso playerId lo riattacca alla stessa
 * stanza — vedi js/network.js, che riprova la connessione da solo su una
 * caduta inaspettata.
 */
function handleSocketClose(socket) {
    if (!socket.roomCode || !socket.playerId) return;
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    const slot = room.players.get(socket.playerId);
    if (!slot || slot.socket !== socket) return; // già sostituito da un rejoin più recente
    slot.socket = null;
    sendToOthers(room, socket.playerId, { type: 'opponent-disconnected', da: slot.pubblico });
    annunciaStanza(room, socket.roomCode);
    slot.disconnectTimer = setTimeout(() => removePlayerFully(socket.roomCode, socket.playerId), RECONNECT_GRACE_MS);
}

/** Abbandono VOLONTARIO ('leave-room', click su "Abbandona"): rimozione immediata, nessuna finestra di grazia. */
function leaveRoomVoluntarily(socket) {
    if (!socket.roomCode || !socket.playerId) return;
    removePlayerFully(socket.roomCode, socket.playerId);
    socket.roomCode = null;
    socket.playerId = null;
}

// ============================================================
// Validazione di FORMA e rate-limit — NON delle regole del duello: quelle
// vivono solo lato client (vedi js/duel-engine.js), portarle qui
// richiederebbe duplicare l'intero motore lato server, che contraddice
// l'architettura "client autorevole" di questo progetto. Qui si scarta
// solo un messaggio ovviamente malformato o un client che ne manda troppi
// troppo in fretta.
// ============================================================

const KNOWN_MESSAGE_TYPES = new Set(['create-room', 'join-room', 'rejoin-room', 'game-action', 'leave-room', 'lock-room']);

function isValidMessageShape(msg) {
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return false;
    if (typeof msg.type !== 'string' || !KNOWN_MESSAGE_TYPES.has(msg.type)) return false;
    if (msg.type === 'join-room' && typeof msg.code !== 'string') return false;
    if (msg.type === 'rejoin-room' && (typeof msg.code !== 'string' || typeof msg.playerId !== 'string')) return false;
    if (msg.type === 'game-action' && (typeof msg.action !== 'object' || msg.action === null || Array.isArray(msg.action))) return false;
    return true;
}

/** Torna false (e il chiamante deve scartare il messaggio) se `socket` ha superato RATE_LIMIT_MAX_MESSAGES nell'ultima finestra da RATE_LIMIT_WINDOW_MS. */
function isRateLimited(socket) {
    const now = Date.now();
    if (!socket.rateWindowStart || now - socket.rateWindowStart >= RATE_LIMIT_WINDOW_MS) {
        socket.rateWindowStart = now;
        socket.rateCount = 0;
    }
    socket.rateCount = (socket.rateCount || 0) + 1;
    return socket.rateCount > RATE_LIMIT_MAX_MESSAGES;
}

// ------------------------------------------------------------
// Controlli anti-imbroglio del RELAY (NON le regole del duello).
//
// Il relay non interpreta più le mosse del duello. Col passo comune i due
// client eseguono lo stesso motore e si scambiano soltanto l'avvio della
// stanza, i mazzi, i comandi/decisioni ordinati e l'esito finale. L'elenco
// chiuso qui sotto è quindi anche la barriera che impedisce a un client
// vecchio di riattivare il protocollo a mosse raccontate.
// ------------------------------------------------------------

// La FORMA dei messaggi (campi e limiti) sta in js/multiplayer/protocollo-mp.js,
// lo stesso file che usano i client. Se per qualche motivo non fosse accanto al
// server (copia parziale), il relay controlla solo il tipo, come prima.
let ProtocolloMP = null;
try { ProtocolloMP = require('../js/multiplayer/protocollo-mp.js'); } catch (e) { /* controllo del solo tipo */ }

const GAME_ACTION_KINDS = new Set([
    'room-config', 'ready', 'rps',
    'mazzo', 'passo', 'passo-riprendi',
    'game-over',
    // La sala del Tag Team in rete (js/multiplayer/mp-tag-sala.js).
    'tag-sala'
]);

/**
 * Torna null se il messaggio appartiene al protocollo corrente, altrimenti
 * il motivo del rifiuto. `room` e `senderId` restano nella firma pubblica:
 * consentono di aggiungere controlli server-side senza cambiare il punto di
 * chiamata, ma il relay attuale non conosce lo stato del motore.
 */
function validateGameAction(room, senderId, action) { // eslint-disable-line no-unused-vars
    if (!action || typeof action !== 'object' || Array.isArray(action)) return 'azione non valida';
    const kind = action.kind;
    if (typeof kind !== 'string' || !GAME_ACTION_KINDS.has(kind)) return 'azione sconosciuta';
    // Il tipo è noto: ora si guarda cosa c'è dentro. Un messaggio con i campi
    // sbagliati non va inoltrato: potrebbe rompere l'altro client a metà partita.
    if (ProtocolloMP && ProtocolloMP.KINDS.has(kind)) return ProtocolloMP.motivoRifiuto(action);
    return null;
}

function handleClientMessage(socket, raw) {
    if (Buffer.byteLength(raw, 'utf8') > MAX_MESSAGE_BYTES) return; // scartato in silenzio: troppo grande per essere un'azione legittima
    if (isRateLimited(socket)) return;

    let msg;
    try {
        msg = JSON.parse(raw);
    } catch (err) {
        sendJSON(socket, { type: 'error', message: 'Messaggio non valido.' });
        return;
    }
    if (!isValidMessageShape(msg)) {
        sendJSON(socket, { type: 'error', message: 'Messaggio non valido.' });
        return;
    }

    switch (msg.type) {
        case 'create-room': {
            const code = generateRoomCode();
            const playerId = generatePlayerId();
            const room = { players: new Map(), createdAt: Date.now(), capienza: capienzaValida(msg.capienza), prossimoPubblico: 0, chiusa: false };
            const slot = nuovoSlot(room, socket);
            room.players.set(playerId, slot);
            rooms.set(code, room);
            socket.roomCode = code;
            socket.playerId = playerId;
            // `capienza` e `tu` in più: un client che non li conosce li ignora,
            // e uno nuovo capisce da `capienza` se il relay sa fare stanze grandi.
            sendJSON(socket, { type: 'room-created', code, playerId, capienza: room.capienza, tu: slot.pubblico });
            annunciaStanza(room, code);
            break;
        }

        case 'join-room': {
            const code = msg.code.toUpperCase().trim();
            const room = rooms.get(code);
            if (!room) {
                sendJSON(socket, { type: 'error', message: 'Stanza non trovata. Controlla il codice.' });
                return;
            }
            if (room.chiusa) {
                sendJSON(socket, { type: 'error', message: 'La partita in questa stanza è già cominciata.' });
                return;
            }
            if (room.players.size >= room.capienza) {
                sendJSON(socket, { type: 'error', message: 'La stanza è già piena.' });
                return;
            }
            const playerId = generatePlayerId();
            room.players.set(playerId, nuovoSlot(room, socket));
            socket.roomCode = code;
            socket.playerId = playerId;

            if (room.capienza > 2) {
                // Stanza grande: non si parte quando è piena, lo decide la sala dei client.
                annunciaStanza(room, code);
                break;
            }
            // Il creatore della stanza (primo entrato, ordine di
            // inserimento nella Map) inizia per primo.
            const ids = [...room.players.keys()];
            ids.forEach((id, index) => {
                sendToPlayer(room, id, { type: 'room-ready', code, youStart: index === 0, playerId: id });
            });
            break;
        }

        case 'rejoin-room': {
            const code = msg.code.toUpperCase().trim();
            const room = rooms.get(code);
            const slot = room && room.players.get(msg.playerId);
            if (!room || !slot) {
                sendJSON(socket, { type: 'error', message: 'Impossibile riprendere la stanza: sessione scaduta.' });
                return;
            }
            if (slot.disconnectTimer) { clearTimeout(slot.disconnectTimer); slot.disconnectTimer = null; }
            slot.socket = socket;
            socket.roomCode = code;
            socket.playerId = msg.playerId;
            sendJSON(socket, { type: 'rejoined', code, tu: slot.pubblico });
            sendToOthers(room, msg.playerId, { type: 'opponent-reconnected', da: slot.pubblico });
            annunciaStanza(room, code);
            break;
        }

        case 'game-action': {
            if (!socket.roomCode || !socket.playerId) return;
            const room = rooms.get(socket.roomCode);
            if (!room) return;
            // Senza nessun altro in stanza non c'è nessuno a cui inoltrare,
            // e nessun duello da controllare.
            if (!otherPlayerId(room, socket.playerId)) return;
            const rifiuto = validateGameAction(room, socket.playerId, msg.action);
            if (rifiuto) {
                sendJSON(socket, { type: 'error', message: 'Azione rifiutata dal server: ' + rifiuto + '.' });
                return;
            }
            // A TUTTI gli altri (da 2 è uno solo), con l'id pubblico di chi manda.
            sendToOthers(room, socket.playerId, { type: 'game-action', action: msg.action, da: pubblicoDi(room, socket.playerId) });
            break;
        }

        case 'leave-room': {
            leaveRoomVoluntarily(socket);
            break;
        }

        case 'lock-room': {
            // Solo l'host (il primo della stanza) chiude la stanza a nuovi ingressi: la partita è partita.
            if (!socket.roomCode || !socket.playerId) return;
            const room = rooms.get(socket.roomCode);
            if (!room || [...room.players.keys()][0] !== socket.playerId) return;
            room.chiusa = true;
            break;
        }

        default:
            break;
    }
}

// ============================================================
// Server HTTP + upgrade a WebSocket
// ============================================================

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Yu-Gi-Oh! Millennium Duel Arena — Server di Stanze attivo.\nConnettiti via WebSocket per giocare.');
});

server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
        socket.destroy();
        return;
    }

    const acceptKey = crypto.createHash('sha1').update(key + WS_MAGIC).digest('base64');
    const responseHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '\r\n'
    ].join('\r\n');
    socket.write(responseHeaders);

    socket.roomCode = null;
    socket.playerId = null;
    let buffer = Buffer.alloc(0);

    socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        const { messages, rest } = decodeFrames(buffer);
        buffer = rest;
        for (const message of messages) {
            if (message === null) {
                socket.destroy();
                return;
            }
            handleClientMessage(socket, message);
        }
    });

    // Chiusura/errore: NON un abbandono volontario (quello è 'leave-room'
    // sopra) — apre solo la finestra di grazia, vedi handleSocketClose.
    socket.on('close', () => handleSocketClose(socket));
    socket.on('error', () => handleSocketClose(socket));
});

// Pulizia periodica delle stanze abbandonate/scadute
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
        if (now - room.createdAt > ROOM_TTL_MS) {
            room.players.forEach((slot) => {
                if (slot.disconnectTimer) clearTimeout(slot.disconnectTimer);
                sendJSON(slot.socket, { type: 'error', message: 'La stanza è scaduta per inattività.' });
            });
            rooms.delete(code);
        }
    }
}, 60 * 1000);
cleanupInterval.unref(); // non deve impedire la chiusura del processo (es. durante i test)

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`🎴 Server Millennium Duel Arena in ascolto sulla porta ${PORT}`);
        console.log(`   WebSocket endpoint: ws://<indirizzo-server>:${PORT}`);
    });
}

module.exports = { encodeFrame, decodeFrames, generateRoomCode, validateGameAction, WS_MAGIC };
