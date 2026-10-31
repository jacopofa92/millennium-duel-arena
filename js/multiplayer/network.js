/**
 * network.js — Client di rete per il Multiplayer di Duel Arena.
 * ---------------------------------------------------------------
 * Wrapper leggero sopra il WebSocket nativo del browser: gestisce la
 * connessione al server di stanze (server/server.js), la creazione o
 * l'ingresso in una stanza tramite codice, e l'invio/ricezione delle
 * azioni di gioco. Puramente additivo: non tocca gameState né la
 * logica di gioco, espone solo eventi tramite window.DuelNetwork.
 *
 * RICONNESSIONE AUTOMATICA (Fase "Multiplayer Avanzato"): se la
 * connessione cade in modo INASPETTATO (non per una leaveRoom()/close()
 * volontaria) mentre siamo dentro una stanza, questo modulo riprova da
 * solo a ristabilirla — vedi tryAutoReconnect più sotto — e, se ci
 * riesce, manda 'rejoin-room' con lo stesso playerId assegnato dal
 * server (vedi server/server.js) per tornare nella STESSA stanza invece
 * di finire in una nuova. Copre il caso comune di una disconnessione
 * breve con la scheda del browser rimasta aperta (Wi-Fi che sfarfalla,
 * laptop in sospensione) — NON la chiusura vera della scheda, dopo la
 * quale questo stato in memoria è comunque perso (limite dichiarato,
 * vedi il commento in cima a server/server.js).
 *
 * Eventi aggiuntivi esposti oltre a quelli "grezzi" del server
 * (room-created, room-ready, game-action, error, opponent-left, ecc.):
 *   reconnecting(attempt)  — tentativo di riconnessione in corso
 *   reconnected()          — riconnessione riuscita, si è tornati nella stanza
 *   reconnect-failed()     — tutti i tentativi esauriti, riconnessione abbandonata
 */
(function () {
    'use strict';

    const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000];

    // Un singolo tentativo di apertura resta breve: se il server non c'è,
    // o l'indirizzo è sbagliato, l'errore deve arrivare subito.
    const CONNECT_ATTEMPT_TIMEOUT_MS = 6000;
    // Ma la PRIMA connessione può insistere molto più a lungo, riprovando:
    // su un hosting gratuito il server viene sospeso dopo un po' di
    // inattività e si risveglia solo quando qualcuno bussa — e il
    // risveglio richiede circa un minuto, durante il quale ogni singolo
    // tentativo scade. Con il solo timeout breve, la prima partita della
    // giornata falliva SEMPRE con "impossibile connettersi", che è la
    // risposta sbagliata a un server che sta semplicemente arrivando.
    const CONNECT_TOTAL_BUDGET_MS = 90000;
    const CONNECT_RETRY_DELAY_MS = 2000;
    const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

    /**
     * Rende utilizzabile l'indirizzo scritto dall'utente:
     * - accetta un host "nudo" (senza schema), scegliendo ws/wss da solo;
     * - promuove ws:// a wss:// quando la pagina è servita via HTTPS.
     *   Serve per davvero: il gioco pubblicato su Cloudflare è HTTPS, e
     *   un browser blocca senza appello una connessione in chiaro aperta
     *   da una pagina sicura ("contenuto misto") — senza questa promozione
     *   il socket morirebbe prima ancora di partire, con un errore che
     *   non nomina mai la vera causa.
     * Gli indirizzi locali restano in chiaro: un server di sviluppo sulla
     * propria macchina non ha (né deve avere) un certificato.
     *
     * `secure` esiste per poterla verificare: di suo legge la pagina
     * corrente, ma un test non può servirsi in HTTPS solo per controllare
     * la promozione, e una funzione che dipende in silenzio dallo stato
     * globale non si riesce a mettere alla prova.
     */
    function normalizeServerUrl(raw, secure) {
        let url = String(raw || '').trim();
        if (!url) return '';
        const pageIsSecure = typeof secure === 'boolean'
            ? secure
            : (typeof location !== 'undefined' && location.protocol === 'https:');
        if (!/^wss?:\/\//i.test(url)) {
            url = (pageIsSecure ? 'wss://' : 'ws://') + url.replace(/^https?:\/\//i, '');
        }
        if (pageIsSecure && /^ws:\/\//i.test(url)) {
            // Host senza porta né percorso, parentesi di un IPv6 incluse.
            const match = /^ws:\/\/(\[[^\]]*\]|[^:/?#]*)/i.exec(url);
            const host = (match ? match[1] : '').replace(/^\[|\]$/g, '').toLowerCase();
            if (LOCAL_HOSTS.indexOf(host) === -1) url = 'wss://' + url.slice(5);
        }
        return url;
    }

    function createNetworkClient() {
        let ws = null;
        let lastUrl = null;
        let roomCode = null;
        let playerId = null;
        // L'id pubblico che il relay mi ha dato nella stanza ('g1'...): lo vedono anche gli altri.
        let idPubblico = null;
        let intentionalClose = false;
        let reconnectTimer = null;
        const listeners = {};

        function on(event, callback) {
            (listeners[event] = listeners[event] || []).push(callback);
        }

        function emit(event, payload) {
            (listeners[event] || []).forEach((cb) => {
                try { cb(payload); } catch (err) { console.error('Errore handler rete:', err); }
            });
        }

        /** Apre un WebSocket "nudo" verso `url` — usata sia per la prima connessione (connect) sia per ogni tentativo di riconnessione, senza duplicare la gestione degli eventi. */
        function openSocket(url) {
            return new Promise((resolve, reject) => {
                let settled = false;
                let socket;
                try {
                    socket = new WebSocket(url);
                } catch (err) {
                    reject(err);
                    return;
                }

                const timeoutId = setTimeout(() => {
                    if (!settled) {
                        settled = true;
                        try { socket.close(); } catch (e) { /* noop */ }
                        reject(new Error('Timeout di connessione al server.'));
                    }
                }, CONNECT_ATTEMPT_TIMEOUT_MS);

                socket.addEventListener('open', () => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    // I due listener "di esercizio" si agganciano SOLO ora,
                    // a connessione davvero aperta: un tentativo fallito
                    // emette comunque un evento 'close', e annunciarlo come
                    // 'disconnected' significherebbe dire "connessione
                    // persa" per una connessione che non c'è mai stata —
                    // rumore che si sovrapporrebbe ai tentativi di
                    // risveglio del server qui sotto.
                    socket.addEventListener('message', (event) => {
                        let msg;
                        try {
                            msg = JSON.parse(event.data);
                        } catch (err) {
                            return;
                        }
                        // 'room-update' arriva nelle stanze da più di 2 (Tag Team in rete) al posto di 'room-ready'.
                        if (msg.type === 'room-created' || msg.type === 'room-ready' || msg.type === 'room-update') {
                            if (msg.playerId) playerId = msg.playerId;
                            if (msg.code) roomCode = msg.code;
                        }
                        if (typeof msg.tu === 'string') idPubblico = msg.tu;
                        emit(msg.type, msg);
                    });
                    socket.addEventListener('close', () => {
                        emit('disconnected');
                        if (!intentionalClose && roomCode && playerId) {
                            tryAutoReconnect();
                        }
                    });
                    resolve(socket);
                });

                socket.addEventListener('error', () => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    reject(new Error('Impossibile connettersi al server.'));
                });
            });
        }

        /**
         * Prima connessione al server di stanze. Non un solo tentativo ma
         * una serie, entro un budget complessivo: un server ospitato su un
         * piano gratuito dorme quando nessuno gioca e impiega circa un
         * minuto a tornare su. Ogni tentativo fallito emette
         * 'connect-waking' con il numero di tentativo, così la lobby può
         * DIRE cosa sta succedendo invece di lasciare una rotella muta —
         * un'attesa spiegata è un'attesa tollerabile, una inspiegata è un
         * gioco rotto.
         * `options.totalTimeoutMs` per chi vuole un budget diverso (es. un
         * test che non ha alcun server da svegliare e non deve restare
         * appeso un minuto e mezzo prima di fallire).
         */
        function connect(url, options) {
            intentionalClose = false;
            lastUrl = url;
            const deadline = Date.now() + ((options && options.totalTimeoutMs) || CONNECT_TOTAL_BUDGET_MS);
            let attempt = 0;

            const attemptOnce = () => openSocket(url).then((socket) => {
                ws = socket;
            }).catch((err) => {
                attempt++;
                // Niente altri giri se non c'è tempo nemmeno per uno:
                // meglio l'errore vero che un'attesa fino allo scadere.
                if (Date.now() + CONNECT_RETRY_DELAY_MS + CONNECT_ATTEMPT_TIMEOUT_MS > deadline) throw err;
                emit('connect-waking', { attempt: attempt, remainingMs: Math.max(0, deadline - Date.now()) });
                return new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_DELAY_MS)).then(attemptOnce);
            });

            return attemptOnce();
        }

        /**
         * Riprova a ristabilire la connessione con un backoff crescente
         * (RECONNECT_DELAYS_MS) e, appena riconnesso, manda 'rejoin-room'
         * per tornare nella stessa stanza — vedi il commento in testa al
         * file. Si ferma da sola se `intentionalClose` diventa true nel
         * frattempo (leaveRoom()/close() chiamati mentre un tentativo è
         * già in corso).
         */
        function tryAutoReconnect(attempt) {
            attempt = attempt || 0;
            if (reconnectTimer) return; // un ciclo di riconnessione è già in corso
            if (attempt >= RECONNECT_DELAYS_MS.length) {
                emit('reconnect-failed');
                return;
            }
            emit('reconnecting', attempt + 1);
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                if (intentionalClose) return;
                openSocket(lastUrl).then((socket) => {
                    ws = socket;
                    const savedCode = roomCode;
                    const savedPlayerId = playerId;
                    const onRejoined = () => { off('rejoined', onRejoined); off('error', onRejoinError); emit('reconnected'); };
                    const onRejoinError = () => { off('rejoined', onRejoined); off('error', onRejoinError); emit('reconnect-failed'); };
                    on('rejoined', onRejoined);
                    on('error', onRejoinError);
                    send({ type: 'rejoin-room', code: savedCode, playerId: savedPlayerId });
                }).catch(() => {
                    tryAutoReconnect(attempt + 1);
                });
            }, RECONNECT_DELAYS_MS[attempt]);
        }

        /** Rimuove un singolo handler registrato con `on` — serve solo internamente, per non accumulare i listener temporanei di tryAutoReconnect ad ogni tentativo. */
        function off(event, callback) {
            if (!listeners[event]) return;
            listeners[event] = listeners[event].filter((cb) => cb !== callback);
        }

        function send(obj) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(obj));
            }
        }

        /** `capienza` (2-4) facoltativa: senza, la stanza da 2 di sempre. Un relay vecchio la ignora e risponde senza `capienza`. */
        function createRoom(capienza) {
            send(capienza ? { type: 'create-room', capienza } : { type: 'create-room' });
        }

        /** Solo l'host: la partita è partita, nessuno può più entrare nella stanza. */
        function lockRoom() {
            send({ type: 'lock-room' });
        }

        function joinRoom(code) {
            send({ type: 'join-room', code });
        }

        function sendAction(action) {
            send({ type: 'game-action', action });
        }

        function leaveRoom() {
            intentionalClose = true;
            if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
            send({ type: 'leave-room' });
            roomCode = null;
            playerId = null;
            idPubblico = null;
        }

        function close() {
            intentionalClose = true;
            if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
            if (ws) ws.close();
        }

        /**
         * SOLO PER TEST/DEBUG — non richiamata da nessun'altra parte del
         * gioco: chiude il socket vero SENZA marcarlo come intenzionale,
         * per simulare una caduta di connessione reale (a differenza di
         * close()/leaveRoom() qui sopra) e verificare che tryAutoReconnect
         * scatti davvero. Utile perché i simulatori di rete offline dei
         * browser/Playwright spesso non chiudono per davvero il socket,
         * si limitano a bloccare il traffico finché non torna online.
         */
        function _simulateUnexpectedDisconnect() {
            if (ws) ws.close();
        }

        return { connect, on, createRoom, joinRoom, sendAction, leaveRoom, lockRoom, close, normalizeServerUrl, idPubblico: () => idPubblico, _simulateUnexpectedDisconnect };
    }

    window.DuelNetwork = createNetworkClient();
})();
