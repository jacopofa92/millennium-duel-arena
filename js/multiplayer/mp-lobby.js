/**
 * mp-lobby.js — Lobby e Sala d'Attesa del Duello Multiplayer
 * (multiplayer.html)
 * ---------------------------------------------------------------
 * Tutto quello che succede PRIMA che il duello inizi: connettersi al
 * server di stanze (js/multiplayer/network.js), creare o raggiungere una
 * stanza con un codice a 5 caratteri, attendere l'avversario — e, nel
 * frattempo, scegliere arena e colonna sonora.
 *
 * DUE POSTI PER STANZA. Il limite non è imposto qui: il server rifiuta
 * il terzo ingresso ("La stanza è già piena", vedi server/server.js).
 * Questa pagina lo RENDE VISIBILE, con due posti duellante e un
 * contatore — prima l'attesa era una riga di testo e non si capiva se
 * stesse succedendo qualcosa.
 *
 * CHI SCEGLIE ARENA E MUSICA. Le sceglie chi ha creato la stanza, e
 * valgono per entrambi. Non è una preferenza personale come il volume:
 * è il luogo del duello, e i due devono vedere lo stesso. Le scelte
 * viaggiano sul canale delle azioni di gioco come `room-config`, un
 * istante prima di cominciare. Nota importante: "casuale" viene
 * RISOLTO in un valore vero prima di trasmetterlo (ArenaOptions.risolvi*)
 * — se ognuno dei due risolvesse il proprio, si ritroverebbero a duellare
 * in due arene diverse con due musiche diverse.
 *
 * COME ARRIVANO AL DUELLO. Non si naviga: la connessione WebSocket vive
 * in QUESTA pagina e un cambio pagina la perderebbe. loadDuelArena()
 * scarica il markup/CSS/script dell'arena da duelMonstersCore.html
 * (unica fonte per com'è fatto un duello) e li inserisce qui.
 */
(function () {
    'use strict';

    const net = window.DuelNetwork;

    // L'indirizzo usato l'ultima volta CON SUCCESSO vince sul valore
    // predefinito scritto in multiplayer.html: chi sviluppa in locale non
    // deve riscrivere il proprio `ws://localhost:8787` ad ogni visita, e
    // chi non lo tocca mai continua a trovarsi il server pubblico già
    // pronto nel campo.
    const SERVER_URL_STORAGE_KEY = 'ygoMpServerUrl';
    // Cinque, non tre: da quando il duello parte su dichiarazione di
    // entrambi (vedi il "Pronto" più sotto) il conto alla rovescia non è
    // più una sorpresa da smaltire in fretta, è l'ultimo istante per
    // guardare arena e avversario prima di cominciare.
    const CONTO_ALLA_ROVESCIA_DA = 5;
    const PASSO_CONTO_MS = 750;
    // Quanto l'ospite aspetta le impostazioni dell'host prima di partire
    // comunque con le proprie: meglio un duello che comincia in un'arena
    // diversa da quella scelta che un duello che non comincia mai.
    // 20 s e non 4: con 300 ms di latenza e un relay che si sveglia (Render) 4 s non bastano, e allo
    // scadere l'ospite partiva con un'arena e una musica sue, diverse da quelle dell'host. L'host le
    // riinvia ogni volta che l'ospite dice "pronto" (vedi riceviPronto), quindi l'attesa vera e' breve.
    const ATTESA_CONFIG_MS = 20000;

    let sonoHost = false;
    let codiceStanza = null;
    let configRicevuta = null;
    let iniziIoInAttesa = null;
    let timerAttesaConfig = null;
    let duelloGiaAvviato = false;

    // --- Pronto -------------------------------------------------------
    // Il duello non comincia perché la stanza si è riempita, ma perché
    // lo hanno detto tutti e due. `iniziIo` è la decisione del server su
    // chi muove per primo (arriva con 'room-ready'): si conserva qui e si
    // usa solo al momento di partire, che ora può arrivare molto dopo.
    let sonoPronto = false;
    let avversarioPronto = false;
    let avversarioInStanza = false;
    // Distinto da avversarioInStanza: il server tiene il posto occupato per
    // una finestra di grazia quando un socket cade (vedi RECONNECT_GRACE_MS
    // in server/server.js), così chi ha perso la linea può rientrare senza
    // perdere la stanza. In quella finestra il posto c'è ancora ma con
    // nessuno dentro: il duello non deve partire, o comincerebbe contro un
    // avversario che non è in ascolto.
    let avversarioCollegato = false;

    // Scelte correnti: RANDOM finché non si tocca nulla.
    const scelta = { field: window.ArenaOptions.RANDOM, music: window.ArenaOptions.RANDOM, origin: 'yu-gi-oh', specchio: null, raid: null };

    function $(id) { return document.getElementById(id); }

    function showStatus(text, isError) {
        const el = $('mpStatus');
        if (!el) return;
        el.textContent = text || '';
        el.classList.toggle('mp-status-error', !!isError);
    }

    function mostraSchermata(nome) {
        const lobby = $('mpLobby');
        if (lobby) lobby.dataset.schermata = nome;
    }

    // ============================================================
    // Fondale animato
    // ============================================================
    function creaGranelli() {
        const box = $('mpMotes');
        if (!box) return;
        // Posizioni e tempi decisi qui e non in CSS: venti granelli con la
        // stessa animazione partirebbero tutti insieme, e si vedrebbe.
        for (let i = 0; i < 18; i++) {
            const mote = document.createElement('div');
            mote.className = 'mp-mote';
            mote.style.left = (Math.random() * 100).toFixed(2) + '%';
            mote.style.animationDuration = (9 + Math.random() * 11).toFixed(1) + 's';
            mote.style.animationDelay = (-Math.random() * 14).toFixed(1) + 's';
            const scala = (0.6 + Math.random() * 1.2).toFixed(2);
            mote.style.transform = `scale(${scala})`;
            box.appendChild(mote);
        }
    }

    // ============================================================
    // Ingresso: scelta crea/entra, connessione
    // ============================================================
    function initLobbyUI() {
        const tabCreate = $('mpTabCreate');
        const tabJoin = $('mpTabJoin');
        const panelCreate = $('mpPanelCreate');
        const panelJoin = $('mpPanelJoin');

        tabCreate.onclick = () => {
            tabCreate.classList.add('active');
            tabJoin.classList.remove('active');
            panelCreate.style.display = '';
            panelJoin.style.display = 'none';
            showStatus('');
        };
        tabJoin.onclick = () => {
            tabJoin.classList.add('active');
            tabCreate.classList.remove('active');
            panelJoin.style.display = '';
            panelCreate.style.display = 'none';
            showStatus('');
        };

        $('mpCreateBtn').onclick = handleCreateRoom;
        $('mpJoinBtn').onclick = handleJoinRoom;
        $('mpCopyBtn').onclick = copiaCodice;
    }

    function copiaCodice() {
        const code = codiceStanza || '';
        if (!code) return;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => showStatus('✅ Codice copiato negli appunti!'));
        }
        if (window.NativeHaptics) NativeHaptics.light();
    }

    function restoreSavedServerUrl() {
        try {
            const saved = localStorage.getItem(SERVER_URL_STORAGE_KEY);
            if (saved) $('mpServerUrl').value = saved;
        } catch (e) { /* localStorage negato (finestra privata): resta il predefinito */ }
    }

    function rememberServerUrl(url) {
        try { localStorage.setItem(SERVER_URL_STORAGE_KEY, url); } catch (e) { /* vedi sopra */ }
    }

    /**
     * Quanto deve durare AL MINIMO la console di collegamento (ms), dall'avvio dell'attesa. 3 secondi: se il server
     * risponde in un attimo l'animazione non deve sparire prima di essere stata vista (richiesta dell'utente).
     * Con "riduci movimento" nessuna attesa artificiale. Nei test automatici (navigator.webdriver) si salta, per non
     * allungare ogni connessione di 3 secondi: `window.MP_ATTESA_MINIMA_MS` lo imposta a mano (anche per provarla).
     */
    function durataMinimaAttesa() {
        if (typeof window.MP_ATTESA_MINIMA_MS === 'number') return window.MP_ATTESA_MINIMA_MS;
        if (riduciMovimento || navigator.webdriver) return 0;
        return 3000;
    }

    async function ensureConnected() {
        const typed = ($('mpServerUrl').value || '').trim();
        if (!typed) {
            showStatus('⚠️ Inserisci l\'indirizzo del server.', true);
            return false;
        }
        // Un indirizzo in chiaro da una pagina HTTPS verrebbe bloccato dal
        // browser: normalizeServerUrl lo promuove a wss://, e il campo
        // mostra la correzione invece di applicarla di nascosto.
        const url = net.normalizeServerUrl(typed);
        if (url !== typed) $('mpServerUrl').value = url;

        showStatus('🔌 Connessione al server...');
        avviaAttesaServer();
        try {
            await net.connect(url);
            rememberServerUrl(url);
            // L'animazione dura ALMENO 3 secondi anche se il server risponde subito: la console resta viva (le righe
            // continuano a scorrere) fino a (minimo - durata della scenetta finale), poi "accesso concesso".
            const minimo = durataMinimaAttesa();
            const SCENETTA_MS = riduciMovimento ? 0 : 850;
            const resto = Math.max(0, minimo - SCENETTA_MS - (Date.now() - attesa.inizio));
            if (resto > 0) await new Promise((resolve) => setTimeout(resolve, resto));
            fermaAttesaServer();
            try { accessoConcesso(); } catch (e) { /* la scenetta non deve mai far fallire il collegamento */ }
            if (SCENETTA_MS) await new Promise((resolve) => setTimeout(resolve, SCENETTA_MS));
            if (document.querySelector('#mpStatus .mp-term.is-ok')) showStatus('✅ Connesso al server.');
            return true;
        } catch (err) {
            fermaAttesaServer();
            try { connessioneRifiutata(); } catch (e) { /* idem */ }
            // Il messaggio d'errore arriva subito dopo il lampo rosso; i pulsanti si riattivano senza aspettare.
            setTimeout(() => showStatus('❌ Impossibile connettersi: ' + err.message, true), 600);
            return false;
        }
    }

    async function handleCreateRoom() {
        $('mpCreateBtn').disabled = true;
        const ok = await ensureConnected();
        if (!ok) { $('mpCreateBtn').disabled = false; return; }
        sonoHost = true;
        net.createRoom();
    }

    async function handleJoinRoom() {
        const code = ($('mpJoinCode').value || '').trim().toUpperCase();
        if (code.length !== 5) {
            showStatus('⚠️ Il codice deve avere 5 caratteri.', true);
            return;
        }
        $('mpJoinBtn').disabled = true;
        const ok = await ensureConnected();
        if (!ok) { $('mpJoinBtn').disabled = false; return; }
        sonoHost = false;
        net.joinRoom(code);
    }

    // Il server pubblico è ospitato su un piano gratuito: dorme quando
    // nessuno gioca e ci mette circa un minuto a tornare su. Senza questo
    // messaggio l'attesa sembrerebbe un blocco.
    net.on('connect-waking', (info) => {
        attesa.risveglio = true;
        attesa.tentativo = (info && info.attempt) || (attesa.tentativo + 1);
        mostraAttesaServer();
    });

    // --- Attesa del server, scritta in pagina -------------------------
    // Mentre il server gratuito si sveglia (fino a circa un minuto) la riga
    // di stato sotto i pulsanti racconta cosa succede e cambia frase ogni
    // pochi secondi, con il tempo trascorso: nessuna finestra sopra la
    // pagina, il resto della lobby resta com'è (richiesta esplicita
    // dell'utente: "niente modali"). Il tempo è reale; le frasi sono solo
    // compagnia, non descrivono passaggi veri del server.
    //
    // Aspetto: un piccolo terminale della KaibaCorp DENTRO la riga di stato
    // (`#mpStatus`), con titolo che glitcha (separazione RGB), scanline,
    // righe che si scrivono lettera per lettera e una barra senza fine.
    // Vive solo finché dura l'attesa: il prossimo `showStatus` sostituisce
    // tutto col suo testo, quindi non serve mai "chiuderlo".
    // Le prime quattro scorrono veloci (sono il collegamento vero, di solito una frazione di secondo); le altre
    // compaiono solo se il server dorme e ci mette a svegliarsi.
    const FRASI_ATTESA = [
        'INIZIALIZZO IL MODULO KC-NET',
        'RISOLVO IL NODO DUELARENA',
        'HANDSHAKE TLS · CANALE CIFRATO',
        'APRO IL CANALE WEBSOCKET',
        'SERVER IN STAND-BY: AVVIO IN CORSO',
        'ALLOCO LA SALA DUELLO',
        'SINCRONIZZO I DUEL DISK',
        'CONTROLLO DI INTEGRITÀ DEL CANALE',
        'ANCORA UN ISTANTE'
    ];
    const attesa = { timer: null, inizio: 0, risveglio: false, visibile: false, tentativo: 0, righe: 0, digitazione: null, fx: null };
    const riduciMovimento = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    /** Scrive `testo` dentro `el` una lettera alla volta (subito intero se il movimento è ridotto). */
    function scriviLentamente(el, testo) {
        if (riduciMovimento) { el.textContent = testo; return; }
        let i = 0;
        const passo = () => {
            el.textContent = testo.slice(0, ++i);
            if (i < testo.length && el.isConnected) setTimeout(passo, 22);
        };
        passo();
    }

    function costruisciTerminaleAttesa(el) {
        el.classList.remove('mp-status-error');
        el.innerHTML = `
            <div class="mp-term" role="status" aria-live="polite">
                <div class="mp-term-circuit mp-term-circuit-a"></div>
                <div class="mp-term-circuit mp-term-circuit-b"></div>
                <div class="mp-term-console">
                    <div class="mp-term-emblem" aria-hidden="true"><i>KC</i><b></b></div>
                    <div class="mp-term-main">
                        <div class="mp-term-head">
                            <span class="mp-term-title" data-glitch="KAIBACORP NETWORK">KAIBACORP NETWORK</span>
                            <span class="mp-term-clock" id="mpTermClock">T+00:00</span>
                        </div>
                        <div class="mp-term-state"><i></i><span id="mpTermStato">UPLINK // HANDSHAKE REMOTO</span></div>
                        <div class="mp-term-hex" aria-hidden="true"><span>${flussoEsadecimale()}</span><span>${flussoEsadecimale()}</span></div>
                        <div class="mp-term-body" id="mpTermBody"></div>
                    </div>
                </div>
                <div class="mp-term-stages" id="mpTermStages" aria-hidden="true">
                    <i class="is-on"></i><span></span><i></i><span></span><i></i><span></span><i></i><span></span><i></i>
                </div>
                <div class="mp-term-bar"><span></span></div>
                <div class="mp-term-meta"><span id="mpTermFoot"></span><b>KC-NET // TLS</b></div>
            </div>`;
        attesa.righe = 0;
        // Sfondo WebGL "KaibaCorp System" dietro la console (js/multiplayer/mp-term-fx.js): niente se manca WebGL.
        if (attesa.fx) attesa.fx.ferma();
        attesa.fx = window.MpTermFx ? MpTermFx.monta(el.querySelector('.mp-term')) : null;
    }

    /** Una riga di byte in esadecimale, per il flusso di dati che scorre sotto il titolo (solo decorazione). */
    function flussoEsadecimale() {
        let s = '';
        for (let i = 0; i < 48; i++) s += Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0') + ' ';
        return s;
    }

    /** Collegamento riuscito: la console lo dice ("accesso concesso") prima di lasciare il posto al messaggio normale. */
    function accessoConcesso() {
        const term = document.querySelector('#mpStatus .mp-term');
        if (!term) return Promise.resolve();
        term.classList.add('is-ok');
        const stato = $('mpTermStato'); if (stato) stato.textContent = 'ACCESSO CONCESSO // UPLINK STABILE';
        const stages = $('mpTermStages'); if (stages) stages.querySelectorAll('i').forEach((n) => n.classList.add('is-on'));
        const corpo = $('mpTermBody');
        if (corpo) {
            const prec = corpo.lastElementChild; if (prec) prec.classList.remove('is-attiva');
            const riga = document.createElement('div'); riga.className = 'mp-term-line is-attiva'; corpo.appendChild(riga);
            scriviLentamente(riga, '> CANALE STABILITO · BENVENUTO, DUELLANTE');
        }
        const titolo = term.querySelector('.mp-term-title');
        if (titolo) { titolo.classList.remove('is-glitch'); void titolo.offsetWidth; titolo.classList.add('is-glitch'); }
        if (attesa.fx) attesa.fx.ok();
        if (window.NativeHaptics) NativeHaptics.medium();
        return new Promise((resolve) => setTimeout(resolve, riduciMovimento ? 0 : 850));
    }

    /** Collegamento fallito: un attimo di "rifiutato" in rosso prima del messaggio d'errore. */
    function connessioneRifiutata() {
        const term = document.querySelector('#mpStatus .mp-term');
        if (!term) return Promise.resolve();
        term.classList.add('is-err');
        const stato = $('mpTermStato'); if (stato) stato.textContent = 'CONNESSIONE RIFIUTATA // UPLINK PERSO';
        if (attesa.fx) attesa.fx.errore();
        return new Promise((resolve) => setTimeout(resolve, riduciMovimento ? 0 : 600));
    }

    function mostraAttesaServer() {
        if (!attesa.risveglio && !attesa.visibile) return;
        const el = $('mpStatus');
        if (!el) return;
        if (!el.querySelector('.mp-term')) costruisciTerminaleAttesa(el);
        const ms = Math.max(0, Date.now() - attesa.inizio);
        const secondi = Math.round(ms / 1000);
        const mm = String(Math.floor(secondi / 60)).padStart(2, '0');
        const ss = String(secondi % 60).padStart(2, '0');
        $('mpTermClock').textContent = `T+${mm}:${ss}`;
        // Le prime quattro righe (il collegamento vero) una ogni 0,7 secondi; poi, se il server dorme, una ogni 4.
        const attese = Math.min(FRASI_ATTESA.length, ms < 3000 ? 1 + Math.floor(ms / 700) : 4 + Math.floor((ms - 3000) / 4000) + 1);
        const avanzamento = Math.min(5, Math.max(1, Math.ceil(attese * 5 / FRASI_ATTESA.length)));
        const stages = $('mpTermStages');
        if (stages) stages.querySelectorAll('i').forEach((nodo, indice) => nodo.classList.toggle('is-on', indice < avanzamento));
        const corpo = $('mpTermBody');
        while (attesa.righe < attese) {
            const prec = corpo.lastElementChild;
            if (prec) prec.classList.remove('is-attiva');
            const riga = document.createElement('div');
            riga.className = 'mp-term-line is-attiva';
            corpo.appendChild(riga);
            scriviLentamente(riga, '> ' + FRASI_ATTESA[attesa.righe]);
            attesa.righe++;
            // Un colpo di glitch sul titolo ad ogni riga nuova.
            const titolo = el.querySelector('.mp-term-title');
            titolo.classList.remove('is-glitch'); void titolo.offsetWidth; titolo.classList.add('is-glitch');
        }
        $('mpTermFoot').textContent = `TENTATIVO ${Math.max(1, attesa.tentativo)}`
            + (secondi >= 25 ? ' · PUÒ SERVIRE FINO A UN MINUTO: RESTA SU QUESTA PAGINA' : '');
    }
    function avviaAttesaServer() {
        fermaAttesaServer();
        attesa.inizio = Date.now();
        attesa.risveglio = false;
        attesa.visibile = true;     // la console compare subito, non solo quando il server dorme
        attesa.tentativo = 0;
        mostraAttesaServer();
        attesa.timer = setInterval(mostraAttesaServer, 250);
    }
    function fermaAttesaServer() {
        if (attesa.timer) { clearInterval(attesa.timer); attesa.timer = null; }
        attesa.risveglio = false;
        attesa.visibile = false;
    }

    // ============================================================
    // Sala d'attesa
    // ============================================================
    function entraInSala(code) {
        codiceStanza = code;
        mostraCodice(code);
        const nome = (window.SaveManager && SaveManager.getPlayerName && SaveManager.getPlayerName()) || 'Tu';
        $('mpSeatYouName').textContent = nome;
        $('mpSeatYouRole').textContent = sonoHost ? 'Padrone di casa' : 'Sfidante';
        aggiornaSetupPerRuolo();
        costruisciSelettori();
        mostraSchermata('attesa');
        // Solo ORA le scatole hanno una larghezza vera: finché la sala era
        // nascosta ogni misura valeva zero, e nessun nome sarebbe mai
        // risultato troppo lungo da far scorrere.
        if (setupMazzi) setupMazzi.refresh();
    }

    function mostraCodice(code) {
        const tiles = $('mpCodeTiles');
        const testo = $('mpRoomCodeValue');
        if (testo) testo.textContent = code;
        if (!tiles) return;
        tiles.innerHTML = '';
        code.split('').forEach((ch, i) => {
            const tile = document.createElement('span');
            tile.className = 'mp-code-tile';
            tile.textContent = ch;
            tile.style.animationDelay = (i * 70) + 'ms';
            tiles.appendChild(tile);
        });
    }

    function aggiornaSetupPerRuolo() {
        const nota = $('mpSetupNote');
        if (nota) {
            nota.textContent = sonoHost
                ? 'Le scegli tu: valgono per entrambi i duellanti'
                : 'Le sceglie chi ha creato la stanza';
        }
        // Al primo giro i selettori non esistono ancora: il montaggio
        // riceve comunque readOnly (vedi costruisciSelettori).
        if (setupArena) setupArena.setReadOnly(!sonoHost);
        aggiornaSpecchioPerRuolo();
        aggiornaRaidPerRuolo();
    }

    // La pedina dell'avversario arriva col suo messaggio "pronto" (id del personaggio, mai un percorso: vedi mp-pedina.js).
    let pedinaAvversario = null;
    // Il nome che l'avversario ha nel suo profilo (arriva col suo "pronto"): testo libero scritto da un'altra persona, quindi ripulito
    // e accorciato, e usato solo in textContent. Vuoto = ancora sconosciuto (o un client vecchio che non lo manda).
    let nomeAvversario = '';
    const pulisciNome = (testo) => String(testo == null ? '' : testo).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
    const nomeMio = () => (window.SaveManager && SaveManager.getPlayerName && SaveManager.getPlayerName()) || '';

    /** Mette una pedina nel tondo del posto; senza pedina rimette il segnaposto (emoji). */
    function mostraPedinaNelPosto(idElemento, pedina, segnaposto) {
        const el = $(idElemento);
        if (!el) return;
        if (pedina) {
            el.textContent = '';
            el.style.backgroundImage = `url("${pedina.image}")`;
            el.classList.add('mp-seat-avatar--img');
            el.title = pedina.name;
        } else {
            el.textContent = segnaposto || '🧑';
            el.style.backgroundImage = '';
            el.classList.remove('mp-seat-avatar--img');
            el.removeAttribute('title');
        }
    }

    /** Dice all'altro lato come siamo messi: pronti o no, e con quale pedina. Un solo messaggio, sempre completo. */
    function annunciaStato() {
        net.sendAction({ kind: 'ready', pronto: sonoPronto, pedina: MpPedina.scelta().id, nome: pulisciNome(nomeMio()) });
    }

    function riempiPostoAvversario() {
        const posto = $('mpSeatOpponent');
        if (!posto) return;
        posto.classList.remove('mp-seat--empty');
        posto.classList.add('mp-seat--filled');
        mostraPedinaNelPosto('mpSeatOppAvatar', pedinaAvversario || MpPedina.PREDEFINITA);
        $('mpSeatOppName').textContent = nomeAvversario || 'Avversario';
        // "In stanza", non "Pronto": da quando esiste la dichiarazione di
        // prontezza vera, scrivere "Pronto" qui appena l'altro entra è una
        // bugia — e proprio accanto alla barra che sta aspettando quella
        // dichiarazione. Il vero stato lo scrive aggiornaPronto().
        $('mpSeatOppRole').textContent = 'In stanza';
        $('mpOccupancy').textContent = '2';
        if (window.NativeHaptics) NativeHaptics.light();
    }

    /**
     * L'avversario ha lasciato la stanza PRIMA che il duello cominciasse.
     * Riporta il posto com'era all'inizio — ed è il gemello esatto di
     * riempiPostoAvversario() qui sopra: i due devono restare speculari,
     * altrimenti un rientro trova pezzi di stato vecchio a schermo.
     *
     * Serviva davvero: qui dentro non esisteva alcun ascoltatore di
     * 'opponent-left' — ce l'aveva solo js/multiplayer/multiplayer.js, che
     * però viene caricato SOLO a duello già avviato. Finché si era in sala
     * l'uscita dell'altro non si vedeva in alcun modo: il posto restava
     * "Pronto", il contatore diceva ancora 2/2, e premendo "Sono pronto"
     * partiva un duello intero contro nessuno, impossibile da giocare e da
     * cui si usciva solo ricaricando la pagina.
     */
    function svuotaPostoAvversario() {
        const posto = $('mpSeatOpponent');
        if (!posto) return;
        posto.classList.remove('mp-seat--filled');
        posto.classList.add('mp-seat--empty');
        pedinaAvversario = null;
        nomeAvversario = '';
        mostraPedinaNelPosto('mpSeatOppAvatar', null, '❔');
        $('mpSeatOppName').innerHTML = '<span class="mp-dots">In attesa</span>';
        $('mpSeatOppRole').textContent = 'Posto libero';
        $('mpOccupancy').textContent = '1';
    }

    // ============================================================
    // Selettori di mazzo, arena e musica
    // ------------------------------------------------------------
    // Il markup e il comportamento vengono da js/ui/duel-setup.js, lo
    // stesso componente usato prima di un Duello Libero. Qui restano
    // solo le due cose VERE di questa schermata: il mazzo sta in un
    // riquadro a parte da arena e musica, perché hanno un padrone
    // diverso (il mazzo è personale, arena e musica le decide chi ha
    // creato la stanza), e per l'ospite le seconde sono in sola lettura.
    //
    // Il mazzo non si trasmette e non ha bisogno di alcun canale: il
    // motore costruisce il mazzo del giocatore da
    // SaveManager.getActiveDeck() (vedi initGame in
    // js/engine/game-flow.js) e in Multiplayer ogni client gestisce solo
    // il proprio lato.
    // ============================================================
    let setupArena = null;
    let setupMazzi = null;

    // ============================================================
    // DUELLO A SPECCHIO
    // ------------------------------------------------------------
    // Regola della stanza, come arena e musica: la decide chi l'ha creata e
    // viaggia dentro `room-config` (campo `specchio`, l'id del mazzo). Con la
    // regola accesa il mazzo personale non conta: MpPassoComune.prepara
    // manda a tutti e due lo STESSO mazzo, preso dal catalogo degli Starter e
    // Structure Deck (che entrambi i client hanno, è un file del gioco).
    // Un "casuale" si estrae UNA volta sola, come per arena e musica, e
    // all'ospite arriva già risolto.
    // ============================================================
    const SPECCHIO_CASUALE = '__casuale';
    let estrattoSpecchio = null;

    /** I mazzi giocabili a specchio: quelli del catalogo con una lista vera (non lo scheletro vuoto). */
    function mazziPerSpecchio() {
        if (typeof starterStructureDeckDatabase === 'undefined') return [];
        return starterStructureDeckDatabase.filter((d) => Array.isArray(d.main) && d.main.reduce((s, c) => s + (c.qty || 0), 0) >= 30);
    }

    /** Il mazzo a specchio scelto da questo lato, già risolto (mai SPECCHIO_CASUALE), o null se la regola è spenta. */
    function specchioRisolto() {
        if (!scelta.specchio) return null;
        if (scelta.specchio !== SPECCHIO_CASUALE) return scelta.specchio;
        if (!estrattoSpecchio) {
            const elenco = mazziPerSpecchio();
            estrattoSpecchio = elenco.length ? elenco[Math.floor(Math.random() * elenco.length)].packId : null;
        }
        return estrattoSpecchio;
    }

    function nomeMazzoSpecchio(packId) {
        const d = mazziPerSpecchio().find((x) => x.packId === packId);
        return d ? d.name : packId;
    }

    /** Il mazzo personale non serve con la regola accesa: si nasconde, così non si perde tempo a sceglierlo. */
    function mostraRegolaSpecchio(attiva, packId) {
        const gruppoMazzo = $('mpDeckGroup');
        if (gruppoMazzo) gruppoMazzo.hidden = !!attiva;
        const nota = $('mpSpecchioNote');
        if (nota) {
            nota.textContent = attiva
                ? (packId ? `Giocate entrambi: ${nomeMazzoSpecchio(packId)}` : 'Giocate entrambi lo stesso mazzo')
                : 'Spento: ognuno usa il proprio mazzo';
        }
    }

    function costruisciSpecchio() {
        const spunta = $('mpSpecchioOn');
        const menu = $('mpSpecchioMazzo');
        if (!spunta || !menu) return;
        const elenco = mazziPerSpecchio();
        if (elenco.length === 0) { const g = $('mpSpecchioGroup'); if (g) g.hidden = true; return; }
        menu.innerHTML = '';
        const casuale = document.createElement('option');
        casuale.value = SPECCHIO_CASUALE;
        casuale.textContent = '🎲 Un mazzo a caso';
        menu.appendChild(casuale);
        elenco.forEach((d) => {
            const o = document.createElement('option');
            o.value = d.packId;
            o.textContent = d.name;
            menu.appendChild(o);
        });
        const applica = () => {
            scelta.specchio = spunta.checked ? menu.value : null;
            // Cambiare mazzo (o spegnere) rimette in gioco un nuovo sorteggio.
            estrattoSpecchio = null;
            menu.hidden = !spunta.checked;
            if (spunta.checked) {
                // Specchio e Raid si escludono.
                const rd = $('mpRaidOn');
                if (rd && rd.checked) { rd.checked = false; if (rd.onchange) rd.onchange(); }
            }
            mostraRegolaSpecchio(spunta.checked, specchioRisolto());
            if (spunta.checked) showStatus('🪞 Duello a specchio: giocate entrambi lo stesso mazzo.');
            else showStatus('🃏 Ognuno gioca il proprio mazzo.');
            if (sonoHost && avversarioInStanza && !duelloGiaAvviato) inviaConfigHost();
        };
        spunta.onchange = applica;
        menu.onchange = applica;
        aggiornaSpecchioPerRuolo();
    }

    /** L'ospite vede la regola ma non la cambia (come arena e musica). */
    function aggiornaSpecchioPerRuolo() {
        const spunta = $('mpSpecchioOn');
        const menu = $('mpSpecchioMazzo');
        if (!spunta || !menu) return;
        spunta.disabled = !sonoHost;
        menu.disabled = !sonoHost;
        const riga = spunta.closest('.mp-specchio-riga');
        if (riga) riga.classList.toggle('is-sola-lettura', !sonoHost);
    }

    /** La regola arrivata dall'host: si mostra, in sola lettura. */
    function mostraSpecchioRicevuto(config) {
        const spunta = $('mpSpecchioOn');
        const menu = $('mpSpecchioMazzo');
        if (!spunta || !menu) return;
        const id = config && typeof config.specchio === 'string' ? config.specchio : null;
        spunta.checked = !!id;
        menu.hidden = !id;
        if (id) {
            if (![...menu.options].some((o) => o.value === id)) {
                // Un mazzo che questo client non conosce (versione diversa): si mostra comunque il nome grezzo.
                const o = document.createElement('option');
                o.value = id;
                o.textContent = id;
                menu.appendChild(o);
            }
            menu.value = id;
        }
        mostraRegolaSpecchio(!!id, id);
    }

    // ============================================================
    // RAID COOPERATIVO
    // ------------------------------------------------------------
    // Regola della stanza (campo `raid` = id del Boss in `room-config`), alternativa allo specchio. Niente morra e
    // niente duello a due: ognuno gioca il proprio duello contro il Boss, nella stessa pagina (per non perdere il
    // collegamento), e js/multiplayer/mp-raid.js condivide la barra dei Life Point.
    // ============================================================
    function bossDelRaid() {
        return (window.RAID_BOSSES || []).map((b) => {
            const c = typeof characterDatabase !== 'undefined' ? characterDatabase.find((x) => x.id === b.id) : null;
            return c ? { id: b.id, lp: b.lp, nome: c.name } : null;
        }).filter(Boolean);
    }

    function bossPerId(id) { return bossDelRaid().find((b) => b.id === id) || null; }

    function mostraRegolaRaid(id) {
        const nota = $('mpRaidNote');
        if (!nota) return;
        const b = id ? bossPerId(id) : null;
        nota.textContent = id ? `Contro ${b ? b.nome : id}: barra comune` : 'Spento: duello uno contro uno';
    }

    function costruisciRaid() {
        const spunta = $('mpRaidOn');
        const menu = $('mpRaidBoss');
        if (!spunta || !menu) return;
        const elenco = bossDelRaid();
        if (elenco.length === 0) { const g = $('mpRaidGroup'); if (g) g.hidden = true; return; }
        menu.innerHTML = '';
        elenco.forEach((b) => {
            const o = document.createElement('option');
            o.value = b.id;
            o.textContent = `${b.nome} (${b.lp.toLocaleString('it-IT')} LP)`;
            menu.appendChild(o);
        });
        const applica = () => {
            scelta.raid = spunta.checked ? menu.value : null;
            menu.hidden = !spunta.checked;
            if (spunta.checked) {
                // Raid e specchio si escludono: nel Raid ognuno gioca il proprio mazzo.
                const sp = $('mpSpecchioOn');
                if (sp && sp.checked) { sp.checked = false; if (sp.onchange) sp.onchange(); }
                showStatus('🐉 Raid: affrontate insieme il Boss, i suoi Life Point sono in comune.');
            }
            mostraRegolaRaid(scelta.raid);
            if (sonoHost && avversarioInStanza && !duelloGiaAvviato) inviaConfigHost();
        };
        spunta.onchange = applica;
        menu.onchange = applica;
        aggiornaRaidPerRuolo();
    }

    function aggiornaRaidPerRuolo() {
        const spunta = $('mpRaidOn');
        const menu = $('mpRaidBoss');
        if (!spunta || !menu) return;
        spunta.disabled = !sonoHost;
        menu.disabled = !sonoHost;
        const riga = spunta.closest('.mp-specchio-riga');
        if (riga) riga.classList.toggle('is-sola-lettura', !sonoHost);
    }

    function mostraRaidRicevuto(config) {
        const spunta = $('mpRaidOn');
        const menu = $('mpRaidBoss');
        if (!spunta || !menu) return;
        const id = config && typeof config.raid === 'string' ? config.raid : null;
        spunta.checked = !!id;
        menu.hidden = !id;
        if (id) {
            if (![...menu.options].some((o) => o.value === id)) {
                const o = document.createElement('option');
                o.value = id;
                o.textContent = id;
                menu.appendChild(o);
            }
            menu.value = id;
        }
        mostraRegolaRaid(id);
    }

    function costruisciSelettori() {
        if (setupArena) return;
        // La pedina: personale come il mazzo. Cambiandola si aggiorna il proprio posto e, se l'avversario e' gia'
        // in sala, glielo si dice subito (stesso messaggio del "pronto").
        MpPedina.monta($('mpPedina'), {
            onChange: (p) => {
                mostraPedinaNelPosto('mpSeatYouAvatar', p);
                if (avversarioInStanza) annunciaStato();
            }
        });
        mostraPedinaNelPosto('mpSeatYouAvatar', MpPedina.scelta());
        setupMazzi = window.DuelSetup.mount($('mpDecks'), {
            decks: true,
            arena: false,
            deckLabel: false, // l'intestazione ce l'ha già il riquadro qui sopra

            onDeckChange: (mazzo) => showStatus(`🃏 Duellerai con "${mazzo.name}".`)
        });
        costruisciSpecchio();
        costruisciRaid();
        setupArena = window.DuelSetup.mount($('mpSetupMount'), {
            readOnly: !sonoHost,
            initial: scelta,
            onChange: (sel) => {
                scelta.field = sel.field;
                scelta.music = sel.music;
                scelta.origin = sel.origin;
                avvisaSeMazzoNonAmmesso(sel.origin);
                // L'ospite e' gia' in sala: la nuova scelta gli deve arrivare (e vale per la partenza).
                if (sonoHost && avversarioInStanza && !duelloGiaAvviato) inviaConfigHost();
            },
            onPreviewBlocked: () => showStatus('🔇 Il browser ha bloccato l\'anteprima: tocca lo schermo e riprova.', true)
        });
    }

    /**
     * Il mazzo in uso rispetta la regola sulle carte ammesse? Qui NON si
     * blocca nulla: la stanza è già formata, e impedire la partenza da un
     * solo lato lascerebbe l'altro ad aspettare un duello che non comincia
     * mai. Si avvisa, e finché si è in sala il mazzo si può ancora
     * cambiare — il selettore è lì sopra. All'host l'avviso arriva quando
     * SCEGLIE la regola, cioè quando ha tutto il tempo di rimediare;
     * all'ospite quando la regola gli arriva.
     */
    function avvisaSeMazzoNonAmmesso(provenienza) {
        if (!window.DeckLegality) return;
        // A specchio il mazzo personale non si usa: l'avviso sarebbe una bugia.
        if (scelta.specchio || (configRicevuta && configRicevuta.specchio)) return;
        // Nel Raid non c'e' una regola sulle carte: ognuno gioca il proprio mazzo contro il Boss.
        if (scelta.raid || (configRicevuta && configRicevuta.raid)) return;
        const fuori = DeckLegality.mazzoCorrenteNonAmmesso(provenienza);
        if (fuori.length === 0) return;
        const elenco = fuori.slice(0, 3).join(', ');
        const altre = fuori.length - Math.min(3, fuori.length);
        showStatus(`⚠️ Il tuo mazzo contiene ${fuori.length} cart${fuori.length === 1 ? 'a' : 'e'} non ammess${fuori.length === 1 ? 'a' : 'e'} da questa regola (${elenco}${altre > 0 ? ` e altre ${altre}` : ''}): cambia mazzo qui sopra.`, true);
    }

    function fermaAnteprima() {
        if (window.DuelSetup) window.DuelSetup.stopPreview();
    }

    // ============================================================
    // Eventi di rete
    // ============================================================
    net.on('room-created', (msg) => {
        entraInSala(msg.code);
        showStatus('🕐 Condividi il codice e attendi il tuo avversario...');
    });

    /**
     * Le scelte dell'host, RISOLTE (un "casuale" diventa un file preciso) e trasmesse: da qui i due lati devono vedere
     * la stessa arena e sentire la stessa musica. Va richiamata anche quando l'host CAMBIA scelta dopo che l'ospite e'
     * gia' entrato: prima si inviava una volta sola, a `room-ready`, e quello che l'host sceglieva dopo (il caso
     * normale: la stanza si riempie subito, i selettori si toccano mentre si aspetta) restava ignorato, cosi' il duello
     * partiva con la scelta di default, cioe' un'arena e una musica CASUALI.
     * Un "casuale" si estrae UNA volta e resta quello finche' resta casuale: altrimenti ogni ritocco ad altro cambierebbe
     * anche la parte lasciata al caso.
     */
    const estrattoCasuale = { field: null, music: null };
    function inviaConfigHost() {
        const R = window.ArenaOptions.RANDOM;
        if (scelta.field === R && !estrattoCasuale.field) estrattoCasuale.field = window.ArenaOptions.risolviCampo(R);
        if (scelta.music === R && !estrattoCasuale.music) estrattoCasuale.music = window.ArenaOptions.risolviTraccia(R);
        const config = {
            kind: 'room-config',
            field: scelta.field === R ? estrattoCasuale.field : window.ArenaOptions.risolviCampo(scelta.field),
            music: scelta.music === R ? estrattoCasuale.music : window.ArenaOptions.risolviTraccia(scelta.music),
            // Quali carte sono ammesse è una REGOLA, non un gusto:
            // deve valere identica per i due mazzi, quindi viaggia con
            // il resto invece di essere decisa da ciascuno per sé.
            origin: scelta.origin
        };
        const specchio = specchioRisolto();
        if (specchio) config.specchio = specchio;
        if (scelta.raid) config.raid = scelta.raid;
        net.sendAction(config);
        configRicevuta = config;
    }

    net.on('room-ready', (msg) => {
        if (!codiceStanza) entraInSala(msg.code); // l'ospite arriva qui senza essere passato da 'room-created'
        riempiPostoAvversario();
        avversarioInStanza = true;
        avversarioCollegato = true;
        // La decisione del server su chi muove per primo si conserva: ora
        // serve molto più tardi, quando entrambi si dichiarano pronti.
        iniziIoInAttesa = msg.youStart;

        if (sonoHost) inviaConfigHost();
        // Da qui al "pronto" passano secondi in cui la rete e' ferma: li si usa per scaricare l'arena.
        precaricaArena();

        // Chi era già pronto PRIMA che l'avversario entrasse (la barra
        // compare solo adesso, ma si può arrivare qui dopo un
        // rientro) lo ridichiara, così l'altro lo sa.
        mostraBarraPronto();
        // Sempre, anche se non si e' ancora pronti: serve a far arrivare la propria pedina.
        annunciaStato();
        aggiornaPronto();
    });

    /**
     * Il "Pronto" dell'avversario. Viaggia sullo stesso canale delle
     * mosse, come `room-config`: un canale nuovo non servirebbe a nulla e
     * andrebbe gestito anche dal server, che invece è e resta un relay
     * cieco.
     */
    function riceviPronto(azione) {
        avversarioPronto = !!azione.pronto;
        // Chi si dichiara pronto senza aver ricevuto le impostazioni le sta aspettando: su una rete lenta
        // il primo invio dell'host puo' essersi perso o essere in ritardo. Riinviarle e' innocuo (chi le
        // ha gia' le rimette uguali) e costa un messaggio solo quando qualcuno dice "pronto".
        if (sonoHost && azione.pronto && avversarioInStanza) inviaConfigHost();
        // La pedina, se c'e' (un client piu' vecchio non la manda): si cerca nel PROPRIO elenco.
        if (typeof azione.pedina === 'string') {
            pedinaAvversario = MpPedina.risolvi(azione.pedina);
            if (avversarioInStanza) mostraPedinaNelPosto('mpSeatOppAvatar', pedinaAvversario);
        }
        if (typeof azione.nome === 'string') {
            nomeAvversario = pulisciNome(azione.nome);
            if (avversarioInStanza && $('mpSeatOppName')) $('mpSeatOppName').textContent = nomeAvversario || 'Avversario';
        }
        aggiornaPronto();
    }

    /** La barra compare solo quando c'è davvero qualcuno con cui essere pronti. */
    function mostraBarraPronto() {
        const barra = $('mpReadyBar');
        if (barra) barra.hidden = !avversarioInStanza;
    }

    /**
     * Rende lo stato a schermo e, se sono pronti tutti e due, fa partire
     * il duello. Chiamata da OGNI punto che cambia uno dei due stati, così
     * la decisione di partire vive in un posto solo invece di essere
     * ripetuta in tre punti diversi.
     */
    function aggiornaPronto() {
        const spiaTu = $('mpReadyYou');
        const spiaAvv = $('mpReadyOpp');
        const btn = $('mpReadyBtn');
        const nota = $('mpReadyNota');
        if (spiaTu) spiaTu.classList.toggle('is-pronto', sonoPronto);
        if (spiaAvv) spiaAvv.classList.toggle('is-pronto', avversarioPronto);
        // Anche i due POSTI dicono lo stato: è lì che si guarda per sapere
        // "a che punto siamo", più che alla barra in fondo.
        const ruoloAvv = $('mpSeatOppRole');
        if (ruoloAvv && avversarioInStanza) {
            ruoloAvv.textContent = !avversarioCollegato
                ? 'Connessione persa'
                : (avversarioPronto ? 'Pronto' : 'In stanza');
        }
        const ruoloTu = $('mpSeatYouRole');
        if (ruoloTu && sonoPronto) ruoloTu.textContent = 'Pronto';
        else if (ruoloTu) ruoloTu.textContent = sonoHost ? 'Padrone di casa' : 'Sfidante';
        if (btn) {
            btn.classList.toggle('is-pronto', sonoPronto);
            btn.textContent = sonoPronto ? '✓ Sei pronto' : 'Sono pronto';
        }
        if (nota) {
            // La riga della connessione persa vale solo finché il posto è
            // ancora suo: se se n'è andato del tutto la barra sparisce, e
            // lasciarci scritto "si aspetta che torni" sarebbe una bugia
            // pronta a farsi rivedere al prossimo che entra.
            nota.textContent = (avversarioInStanza && !avversarioCollegato)
                ? 'L\'avversario ha perso la connessione: si aspetta che torni…'
                : (sonoPronto && !avversarioPronto)
                    ? 'In attesa che anche l\'avversario sia pronto…'
                    : (!sonoPronto && avversarioPronto)
                        ? 'L\'avversario è pronto: tocca a te.'
                        : 'Il duello comincia quando siete pronti tutti e due.';
        }

        if (sonoPronto && avversarioPronto && avversarioInStanza && avversarioCollegato) {
            if (btn) btn.disabled = true;
            avviaQuandoPronti();
        }
    }

    /**
     * Entrambi pronti: si parte. L'ospite può ancora non avere le
     * impostazioni dell'host (arrivano su un altro messaggio); le aspetta
     * quel poco, poi parte comunque con le proprie — meglio un duello in
     * un'arena diversa da quella scelta che un duello che non comincia.
     */
    function avviaQuandoPronti() {
        if (duelloGiaAvviato) return;
        if (!sonoHost && !configRicevuta) {
            showStatus('⚔️ Pronti! Ricevo le impostazioni del duello...');
            if (!timerAttesaConfig) {
                timerAttesaConfig = setTimeout(() => avviaPartenza(iniziIoInAttesa), ATTESA_CONFIG_MS);
            }
            return;
        }
        avviaPartenza(iniziIoInAttesa);
    }

    // Le impostazioni viaggiano sullo stesso canale delle mosse. Ogni altra
    // azione riguarda il duello vero e la gestisce js/multiplayer/multiplayer.js,
    // caricato solo più avanti: qui si ignora tutto il resto.
    net.on('game-action', (msg) => {
        const azione = msg && msg.action;
        if (!azione) return;
        // Un messaggio con la forma sbagliata si scarta (vedi protocollo-mp.js).
        if (window.ProtocolloMP && ProtocolloMP.KINDS.has(azione.kind)) {
            const motivo = ProtocolloMP.motivoRifiuto(azione);
            if (motivo) { console.warn('Multiplayer: messaggio "' + azione.kind + '" scartato (' + motivo + ')'); return; }
        }

        if (azione.kind === 'ready') {
            riceviPronto(azione);
            return;
        }

        // Raid cooperativo: il danno al Boss del compagno (js/multiplayer/mp-raid.js).
        if (azione.kind === 'raid') {
            if (window.MpRaid) MpRaid.ricevi(azione);
            return;
        }

        // La mossa della morra può arrivare PRIMA che questo lato abbia
        // aperto il proprio pannello (l'altro ha scelto in fretta): si
        // conserva, e attendiSceltaRps la trova già lì.
        if (azione.kind === 'rps') {
            // Lo stesso tipo porta due cose: la mossa (`scelta`) e, a morra
            // vinta, chi comincia (`iniziaChiManda`). Un tipo nuovo andrebbe
            // aggiunto anche al relay e ridistribuito; un campo in più no.
            if (typeof azione.iniziaChiManda === 'boolean') riceviInizioRps(azione.iniziaChiManda);
            else riceviSceltaRps(azione.scelta);
            return;
        }

        if (azione.kind !== 'room-config') return;
        configRicevuta = azione;
        mostraSceltaRicevuta(azione);
        mostraSpecchioRicevuto(azione);
        mostraRaidRicevuto(azione);
        avvisaSeMazzoNonAmmesso(azione.origin);
        // Le impostazioni possono arrivare DOPO che entrambi si sono
        // dichiarati pronti: in quel caso l'ospite stava aspettando
        // proprio queste, e adesso può partire senza attendere il tetto.
        if (sonoPronto && avversarioPronto && avversarioInStanza && avversarioCollegato) {
            if (timerAttesaConfig) { clearTimeout(timerAttesaConfig); timerAttesaConfig = null; }
            avviaPartenza(iniziIoInAttesa);
        }
    });

    // Il pulsante "Pronto". Si può anche togliere la dichiarazione finché
    // l'altro non ha fatto la sua: è l'unico momento in cui cambiare idea
    // non costa nulla a nessuno.
    (function collegaPulsantePronto() {
        const btn = $('mpReadyBtn');
        if (!btn) return;
        btn.onclick = () => {
            if (duelloGiaAvviato) return;
            sonoPronto = !sonoPronto;
            annunciaStato();
            if (window.NativeHaptics) NativeHaptics.light();
            aggiornaPronto();
        };
    })();

    /** L'ospite vede evidenziate, in sola lettura, le scelte dell'host. */
    function mostraSceltaRicevuta(config) {
        if (setupArena) setupArena.showSelection(config);
    }

    // ============================================================
    // L'avversario se ne va MENTRE si è ancora in sala
    // ------------------------------------------------------------
    // A duello avviato questi stessi eventi li gestisce
    // js/multiplayer/multiplayer.js (banner in cima allo schermo), che però
    // viene caricato solo a quel punto: qui prima non li ascoltava nessuno,
    // e la sala restava a mostrare un avversario che non c'era più.
    // ============================================================

    /** Caduta della linea: il posto resta suo per la finestra di grazia del server. */
    net.on('opponent-disconnected', () => {
        if (window.MULTIPLAYER_MODE || window.MP_RAID || !avversarioInStanza) return;
        avversarioCollegato = false;
        // Se stava per partire perché eravamo pronti tutti e due, la
        // partenza si ferma qui: il conto alla rovescia e la morra cinese
        // vogliono qualcuno dall'altra parte che risponda.
        if (timerAttesaConfig) { clearTimeout(timerAttesaConfig); timerAttesaConfig = null; }
        showStatus('🔌 Il tuo avversario ha perso la connessione, in attesa che torni...');
        aggiornaPronto();
    });

    net.on('opponent-reconnected', () => {
        if (window.MP_RAID && window.MpRaid) MpRaid.ridici();
        if (window.MULTIPLAYER_MODE || window.MP_RAID || !avversarioInStanza) return;
        avversarioCollegato = true;
        showStatus('✅ Il tuo avversario è tornato in sala!');
        // Può essere rientrato dopo che ci eravamo dichiarati pronti tutti
        // e due: aggiornaPronto() se ne accorge e fa partire il duello.
        aggiornaPronto();
    });

    /** Uscita definitiva: la stanza torna ad avere un posto libero. */
    net.on('opponent-left', () => {
        if (window.MULTIPLAYER_MODE || window.MP_RAID || !avversarioInStanza) return;
        avversarioInStanza = false;
        avversarioCollegato = false;
        avversarioPronto = false;
        // La sua prontezza se n'è andata con lui; la NOSTRA si conserva,
        // perché chi entrerà dopo la riceve comunque (vedi il
        // net.sendAction({kind:'ready'}) dentro 'room-ready' più sopra).
        if (timerAttesaConfig) { clearTimeout(timerAttesaConfig); timerAttesaConfig = null; }
        // Se ad andarsene è stato chi aveva creato la stanza, la stanza
        // diventa nostra. Non è un vezzo: arena e musica le sceglie l'host
        // e le TRASMETTE, quindi una stanza rimasta senza host farebbe
        // partire il prossimo duello con due ospiti che aspettano invano le
        // impostazioni dell'altro e finiscono, dopo il tetto d'attesa, in
        // due arene diverse con due musiche diverse.
        if (!sonoHost) {
            sonoHost = true;
            configRicevuta = null; // le impostazioni di chi se n'è andato non valgono più
            aggiornaSetupPerRuolo();
        }
        svuotaPostoAvversario();
        mostraBarraPronto(); // torna nascosta: non c'è più nessuno con cui essere pronti
        aggiornaPronto();
        showStatus('👋 Il tuo avversario ha lasciato la stanza. Il codice resta valido: attendi qualcun altro.');
    });

    net.on('error', (msg) => {
        // A duello avviato la sala non c'è più (mpLobbyScreen rimossa in
        // startMultiplayerDuel): un rifiuto del relay arrivato lì — per
        // esempio il 'mazzo' del passo comune davanti a un server della
        // versione precedente — non ha pulsanti da riabilitare.
        if (window.MULTIPLAYER_MODE || window.MP_RAID) { console.warn('Relay:', msg && msg.message); return; }
        showStatus('❌ ' + (msg.message || 'Si è verificato un errore.'), true);
        const crea = $('mpCreateBtn');
        const entra = $('mpJoinBtn');
        if (crea) crea.disabled = false;
        if (entra) entra.disabled = false;
    });

    // Persa la connessione MENTRE si è ancora in lobby (non in partita: a
    // partita avviata questo stesso evento è gestito da js/multiplayer/multiplayer.js,
    // caricato solo a quel punto — vedi net.on('disconnected', ...) lì).
    // js/multiplayer/network.js prova da sé a riconnettersi (vedi 'reconnecting' qui
    // sotto) se avevamo già una stanza — mostriamo l'errore definitivo e
    // riabilitiamo i pulsanti SOLO se quel tentativo fallisce del tutto o
    // non è nemmeno partito (nessuna stanza ancora creata/raggiunta).
    net.on('disconnected', () => {
        if (window.MULTIPLAYER_MODE || window.MP_RAID) return;
        showStatus('❌ Connessione al server persa.', true);
        $('mpCreateBtn').disabled = false;
        $('mpJoinBtn').disabled = false;
    });

    net.on('reconnecting', (attempt) => {
        if (window.MULTIPLAYER_MODE || window.MP_RAID) return;
        showStatus(`🔌 Connessione persa, tentativo di riconnessione (${attempt})...`, true);
    });

    net.on('reconnected', () => {
        if (window.MULTIPLAYER_MODE || window.MP_RAID) return;
        showStatus('✅ Riconnesso, in attesa del tuo avversario...');
    });

    net.on('reconnect-failed', () => {
        if (window.MULTIPLAYER_MODE || window.MP_RAID) return;
        showStatus('❌ Impossibile riconnettersi al server.', true);
        $('mpCreateBtn').disabled = false;
        $('mpJoinBtn').disabled = false;
    });

    /**
     * Uscire dalla pagina = uscire dalla stanza, subito.
     *
     * Senza questo, chiudere la scheda o tornare al menu lasciava
     * semplicemente cadere il socket, e il server lo tratta come una
     * disconnessione momentanea: tiene il posto occupato per 45 secondi
     * (RECONNECT_GRACE_MS, server/server.js) aspettando un rientro che in
     * questo caso non arriverà MAI — il playerId per il 'rejoin-room' vive
     * solo in memoria (js/multiplayer/network.js) e muore con la pagina.
     * Chi restava vedeva quindi per tre quarti di minuto "in attesa che
     * torni" invece della verità.
     *
     * `pagehide` e non `beforeunload`: è l'unico dei due su cui si può
     * contare sui browser mobili, ed è lo stesso evento anche quando la
     * pagina viene messa da parte per la cache di navigazione — dove il
     * socket sarebbe comunque morto.
     */
    window.addEventListener('pagehide', () => {
        try { net.leaveRoom(); } catch (err) { /* la pagina sta morendo comunque */ }
    });

    // ============================================================
    // Partenza del duello
    // ============================================================
    function avviaPartenza(youStart) {
        if (duelloGiaAvviato) return;
        duelloGiaAvviato = true;
        fermaAnteprima();

        const config = configRicevuta || {
            field: window.ArenaOptions.risolviCampo(scelta.field),
            music: window.ArenaOptions.risolviTraccia(scelta.music),
            origin: scelta.origin,
            specchio: specchioRisolto() || undefined,
            raid: scelta.raid || undefined
        };
        contoAllaRovescia(config, () => {
            // Raid: nessuna morra, ognuno gioca il suo duello contro il Boss.
            if (config.raid) { startMultiplayerDuel(true, config); return; }
            morraCinese(youStart).then((chiInizia) => {
                startMultiplayerDuel(chiInizia === 'player', config);
            });
        });
    }

    // ============================================================
    // Morra cinese fra i due giocatori
    // ============================================================
    // Le mosse VIAGGIANO, non si sorteggiano: è l'unico modo perché i due
    // schermi raccontino la stessa morra. Chi vince comincia, e il
    // `youStart` deciso dal server resta come ripiego per i due casi in
    // cui la morra non può dare una risposta — l'avversario che non
    // sceglie mai, o il modulo della morra non caricato.
    let sceltaAvversarioRps = null;     // la mossa arrivata, se già arrivata
    let attesaSceltaRps = null;         // chi la sta aspettando

    function riceviSceltaRps(id) {
        sceltaAvversarioRps = id;
        if (attesaSceltaRps) {
            const risolvi = attesaSceltaRps;
            attesaSceltaRps = null;
            risolvi(id);
        }
    }

    /** La mossa dell'avversario: già arrivata, oppure appena arriva. */
    function attendiSceltaRps() {
        if (sceltaAvversarioRps) {
            const id = sceltaAvversarioRps;
            sceltaAvversarioRps = null;
            return Promise.resolve(id);
        }
        return new Promise((risolvi) => { attesaSceltaRps = risolvi; });
    }

    // Chi comincia, deciso dal vincitore: stesso schema della mossa qui
    // sopra (può arrivare prima che di qua l'esito sia a schermo).
    let inizioAvversarioRps = null;    // il valore arrivato, già dal nostro punto di vista
    let attesaInizioRps = null;

    /** `iniziaChiManda`: vero se a cominciare è chi ha mandato il messaggio, cioè l'avversario. */
    function riceviInizioRps(iniziaChiManda) {
        const starter = iniziaChiManda ? 'bot' : 'player';
        if (attesaInizioRps) {
            const risolvi = attesaInizioRps;
            attesaInizioRps = null;
            risolvi(starter);
            return;
        }
        inizioAvversarioRps = starter;
    }

    function attendiInizioRps() {
        if (inizioAvversarioRps) {
            const starter = inizioAvversarioRps;
            inizioAvversarioRps = null;
            return Promise.resolve(starter);
        }
        return new Promise((risolvi) => { attesaInizioRps = risolvi; });
    }

    function morraCinese(youStart) {
        const ripiego = youStart ? 'player' : 'bot';
        if (!window.DuelRPS || window.DUEL_RPS_SKIP) return Promise.resolve(ripiego);

        const nomeAvversario = ($('mpSeatOppName') && $('mpSeatOppName').textContent.trim()) || 'Avversario';
        return DuelRPS.play({ name: nomeAvversario }, {
            inviaScelta: (id) => net.sendAction({ kind: 'rps', scelta: id }),
            attendiScelta: attendiSceltaRps,
            // `starter` è dal MIO punto di vista: 'player' = comincio io.
            inviaInizio: (starter) => net.sendAction({ kind: 'rps', iniziaChiManda: starter === 'player' }),
            attendiInizio: attendiInizioRps
        }).catch(() => ripiego);
    }

    function contoAllaRovescia(config, onDone) {
        const overlay = document.createElement('div');
        overlay.className = 'mp-countdown';
        overlay.innerHTML = '<div class="mp-countdown-inner">'
            + '<div class="mp-countdown-num"></div>'
            + '<div class="mp-countdown-label">Il duello sta per iniziare</div>'
            + '<div class="mp-countdown-arena"></div>'
            + '</div>';
        document.body.appendChild(overlay);
        const num = overlay.querySelector('.mp-countdown-num');
        // Anche la regola sulle carte ammesse, non solo l'ambientazione:
        // è l'ultimo istante in cui l'ospite può accorgersi con che cosa
        // si duella. Due righe di TESTO, mai innerHTML: il nome di una
        // provenienza inventata dal giocatore (crea-carta.html) è testo
        // libero suo, e arriva per giunta dalla rete.
        const riepilogo = overlay.querySelector('.mp-countdown-arena');
        const rigaArena = document.createElement('div');
        rigaArena.textContent = `🏟️ ${window.ArenaOptions.nomeCampo(config.field)} · 🎵 ${window.ArenaOptions.nomeTraccia(config.music)}`;
        const rigaCarte = document.createElement('div');
        rigaCarte.textContent = `🗂️ ${window.DuelSetup.originLabel(config.origin)}`;
        riepilogo.append(rigaArena, rigaCarte);
        if (config.raid) {
            const b = bossPerId(config.raid);
            const rigaRaid = document.createElement('div');
            rigaRaid.textContent = `🐉 Raid contro ${b ? b.nome : config.raid}`;
            riepilogo.append(rigaRaid);
        }
        if (config.specchio) {
            const rigaSpecchio = document.createElement('div');
            rigaSpecchio.textContent = `🪞 Duello a specchio: ${nomeMazzoSpecchio(config.specchio)}`;
            riepilogo.append(rigaSpecchio);
        }

        let n = CONTO_ALLA_ROVESCIA_DA;
        const passo = () => {
            if (n === 0) {
                overlay.remove();
                onDone();
                return;
            }
            num.textContent = String(n);
            // Riavvia l'animazione del numero: senza questo, dal secondo in
            // poi il testo cambierebbe senza alcun movimento.
            num.style.animation = 'none';
            void num.offsetWidth;
            num.style.animation = '';
            n--;
            setTimeout(passo, PASSO_CONTO_MS);
        };
        passo();
    }

    /**
     * Arena e musica scelte raggiungono il duello attraverso la query
     * string di QUESTA pagina: lo script in cima al <body> di
     * duelMonstersCore.html — che loadDuelArena() esegue qui sotto —
     * legge `?field=`/`?music=` da window.location. Impostarli qui invece
     * di inventare un canale nuovo significa usare lo stesso identico
     * meccanismo del Duello Libero, senza toccare l'arena.
     * Va fatto PRIMA di caricare l'arena, o quello script leggerebbe una
     * query string ancora vuota.
     */
    function applicaImpostazioniArena(config) {
        const params = new URLSearchParams(window.location.search);
        params.set('field', config.field);
        params.set('music', config.music);
        // Raid: il Boss e' un Duellante in Duello Libero, a Difficile. Fuori dal Raid questi parametri non ci sono.
        if (config.raid) { params.set('mode', 'free'); params.set('character', config.raid); params.set('difficulty', 'Difficile'); }
        else { params.delete('mode'); params.delete('character'); params.delete('difficulty'); }
        // Stesso parametro del Duello Libero: js/duel-session.js lo legge
        // come `allowedOrigin` e BLOCCA davvero un mazzo che non lo
        // rispetta. Ogni client controlla il proprio mazzo contro la
        // regola condivisa — limite dichiarato: se il mazzo dell'ospite
        // non è ammesso se ne accorge solo qui, a stanza già formata.
        // A specchio il mazzo è quello del catalogo, uguale per tutti: la regola sulle carte ammesse non si applica.
        if (config.origin && !config.specchio && !config.raid) params.set('origin', config.origin); else params.delete('origin');
        // Le due pedine: la mia e quella dell'avversario. js/duel-session.js le legge solo in Multiplayer
        // (resolvePlayer/resolveOpponent) e le cerca nell'elenco dei personaggi.
        params.set('pedina', MpPedina.scelta().id);
        if (pedinaAvversario) params.set('pedinaAvv', pedinaAvversario.id); else params.delete('pedinaAvv');
        if (nomeAvversario) params.set('nomeAvv', nomeAvversario); else params.delete('nomeAvv');
        history.replaceState({}, '', window.location.pathname + '?' + params.toString());
        // Il fondale della lobby è su body::before ed è FISSO: resterebbe
        // davanti allo sfondo dell'arena, rendendo invisibile l'arena
        // appena scelta. Da qui in poi non serve più.
        document.body.classList.add('mp-in-duello');
    }

    async function startMultiplayerDuel(youStart, config) {
        // Il caricamento dell'arena puo' durare molti secondi su una connessione lenta: se la lobby sparisce
        // subito, in quel tempo si vede la pagina mezza costruita (campo di default, caselle senza stile...).
        // La schermata di caricamento copre il passaggio; la nasconde DuelSession.start() quando l'intro
        // del duello prende il suo posto.
        if (window.PageLoader) PageLoader.show();
        if (config && config.raid && bossPerId(config.raid)) {
            // Raid: duello in solitaria contro il Boss, nella STESSA pagina (altrimenti si perde il collegamento col compagno).
            window.MP_RAID = true;
            window.MULTIPLAYER_MODE = false;
            const boss = bossPerId(config.raid);
            if (window.MpRaid) MpRaid.avvia(net, boss);
            applicaImpostazioniArena(config);
            const sala = $('mpLobbyScreen');
            if (sala) sala.remove();
            await loadDuelArena();
            return;
        }
        window.MULTIPLAYER_MODE = true;
        window.MP_startingRole = youStart ? 'player' : 'bot';
        // Duello a specchio: MpPassoComune.prepara manda questo mazzo al posto di quello personale.
        window.MP_SPECCHIO_ID = (config && config.specchio) || null;
        // Il passo comune è l'unico protocollo di duello supportato. Il
        // relay accetta ancora temporaneamente i messaggi precedenti per
        // non spegnere da remoto l'APK beta.21, ma questo client non li usa.
        if (window.MpPassoComune) MpPassoComune.configura({ net, sonoHost, iniziaIo: youStart });
        window.MP_broadcast = (action) => {
            // Rete di sicurezza sull'esito, fuori dai comandi deterministici.
            // Le vecchie chiamate rimaste nel motore vengono eliminate nei
            // passi successivi e intanto non escono sulla rete.
            if (action && action.kind === 'game-over') net.sendAction(action);
        };

        applicaImpostazioniArena(config);

        const lobbyScreen = $('mpLobbyScreen');
        if (lobbyScreen) lobbyScreen.remove();

        await loadDuelArena();
    }

    /**
     * Scarica duelMonstersCore.html — l'UNICA fonte per com'è fatta l'arena di
     * duello (CSS, campo, mano, modali...) — ed esegue in QUESTA pagina,
     * in ordine, esattamente quello che duelMonstersCore.html eseguirebbe da
     * sé: prima il CSS dell'arena, poi il suo markup, poi i suoi script
     * (nello stesso ordine relativo in cui compaiono nel file, inline ed
     * esterni inclusi — l'ordine conta: es. duel-engine.js deve caricare
     * prima di card-effects.js). In fondo aggiunge anche js/multiplayer/multiplayer.js,
     * che duelMonstersCore.html non include più da sé (serve solo qui, per
     * applicare le mosse remote dell'avversario — vedi quel file).
     */
    /**
     * Il documento dell'arena, scaricato UNA volta sola (anche se lo chiedono due punti insieme).
     * Lo scarica gia' la sala non appena l'avversario entra (`precaricaArena`), cosi' quando il
     * duello parte il file e' in cache; il fallimento qui non e' un errore: lo ritenta il
     * caricamento vero e proprio.
     */
    let arenaInCaricamento = null;
    function scaricaDocumentoArena() {
        if (!arenaInCaricamento) {
            arenaInCaricamento = fetch('duelMonstersCore.html')
                .then((res) => res.text())
                .then((html) => new DOMParser().parseFromString(html, 'text/html'))
                .catch((err) => { arenaInCaricamento = null; throw err; });
        }
        return arenaInCaricamento;
    }

    /**
     * Chiede al browser di scaricare in PARALLELO tutti gli script e i fogli esterni dell'arena.
     * Gli script restano eseguiti uno alla volta e in ordine (`loadScriptSequential`): prima, pero',
     * ognuno partiva a scaricarsi solo dopo l'esecuzione del precedente, e con ~100 file e 300 ms
     * di latenza per richiesta il solo caricamento durava decine di secondi. Un file ancora in
     * volo quando serve viene semplicemente atteso, mai scaricato due volte.
     */
    function precaricaRisorseArena(doc) {
        const visti = new Set();
        const aggiungi = (href, tipo) => {
            if (!href || visti.has(href)) return;
            visti.add(href);
            // Gia' presente nella pagina (la lobby ne carica alcuni per conto suo): niente da fare.
            if (document.querySelector(`script[src="${href}"], link[rel="stylesheet"][href="${href}"], link[rel="preload"][href="${href}"]`)) return;
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = tipo;
            link.href = href;
            document.head.appendChild(link);
        };
        doc.querySelectorAll('body script[src]').forEach((s) => aggiungi(s.getAttribute('src'), 'script'));
        doc.querySelectorAll('head link[rel="stylesheet"]').forEach((l) => aggiungi(l.getAttribute('href'), 'style'));
        aggiungi('js/multiplayer/multiplayer.js', 'script');
    }

    let arenaPrecaricata = false;
    /** Chiamata quando l'avversario entra in stanza: usa il tempo della scelta e del "pronto" per scaricare l'arena. */
    function precaricaArena() {
        if (arenaPrecaricata || duelloGiaAvviato) return;
        arenaPrecaricata = true;
        scaricaDocumentoArena().then(precaricaRisorseArena).catch(() => { arenaPrecaricata = false; });
    }

    async function loadDuelArena() {
        const doc = await scaricaDocumentoArena();
        precaricaRisorseArena(doc);

        // TUTTI i <style> dell'arena, non il primo.
        //
        // Qui c'era `doc.querySelector('head style')` — "il primo", scritto
        // quando in quell'head ce n'era davvero uno solo. Poi
        // duelMonstersCore.html ne ha guadagnati altri due PRIMA di quello
        // vero (l'opt-in alle View Transitions e lo sfondo scuro anti-flash,
        // entrambi minuscoli e messi in cima apposta), e da quel momento il
        // Multiplayer ha iniettato 38 caratteri di `@view-transition` al
        // posto dei 144.000 del foglio di stile del duello: il campo si
        // ritrovava senza una sola regola di layout, alto quasi tremila
        // pixel, con le carte a dimensione naturale. Segnalato dall'utente
        // come "la pagina di duello del multiplayer è tutta distrutta".
        //
        // Prenderli tutti, in ordine, è anche a prova di futuro: un altro
        // <style> aggiunto all'arena domani arriverà qui da solo, invece di
        // spostare di nuovo la casella giusta.
        doc.querySelectorAll('head style').forEach((arenaStyle) => {
            const styleEl = document.createElement('style');
            styleEl.textContent = arenaStyle.textContent;
            document.head.appendChild(styleEl);
        });

        // Stessa logica per i fogli ESTERNI dell'arena: multiplayer.html ne
        // carica già alcuni per conto proprio (card.css, effects.css...),
        // ma non tutti — mancavano per esempio duel-rps.css,
        // challenge-banner.css e field-ambience.css. Si aggiungono solo
        // quelli non già presenti, confrontando l'href così com'è scritto.
        doc.querySelectorAll('head link[rel="stylesheet"]').forEach((link) => {
            const href = link.getAttribute('href');
            if (!href || document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) return;
            const copia = document.createElement('link');
            copia.rel = 'stylesheet';
            copia.href = href;
            document.head.appendChild(copia);
        });

        // Markup dell'arena: TUTTO il body, in ordine, tranne gli script
        // (che hanno un trattamento a parte più sotto).
        //
        // Qui c'era un elenco scritto a mano di sei id, con la nota "così
        // se in futuro l'arena aggiunge elementi basta aggiungerli qui".
        // Quella previsione si è avverata al contrario: l'arena è
        // cresciuta e NESSUNO si è ricordato di aggiornare l'elenco, così
        // il Multiplayer ha perso per strada cinque elementi su undici —
        // il box LP dell'avversario (#botInfo), la pila della Catena, il
        // prompt di scarto dalla mano, le linee degli Equip e, il più
        // grave, #cardListPickerModal: senza quello, ogni effetto che fa
        // SCEGLIERE una carta (dal Cimitero, dal Deck, dall'Extra) non
        // aveva dove aprirsi.
        //
        // Prendere tutto è sicuro proprio perché duelMonstersCore.html è
        // un file a sé: nel suo body non c'è nulla della lobby da cui
        // difendersi, quindi non esiste il "cosa NON prendere" che quella
        // scelta voleva evitare. E da oggi un elemento nuovo nell'arena
        // arriva qui da solo.
        const mount = $('arenaMount');
        Array.from(doc.body.children).forEach((el) => {
            if (el.tagName === 'SCRIPT') return;
            mount.appendChild(document.importNode(el, true));
        });

        // Script dell'arena (inline ed esterni), nello stesso ordine del
        // file originale — un inline eseguito troppo presto (es. quello che
        // avvia la musica, che si aspetta initAudioManager già definita da
        // js/audio/audio-manager.js) romperebbe la pagina.
        const bodyScripts = Array.from(doc.querySelectorAll('body script'));
        for (const original of bodyScripts) {
            if (original.src) {
                const src = original.getAttribute('src');
                // Uno script che questa pagina ha GIÀ caricato non va
                // eseguito una seconda volta: i file di questo progetto
                // dichiarano `const` al primo livello, e una seconda
                // esecuzione è un SyntaxError che azzera l'intero file
                // ("Identifier ... has already been declared"). La lobby
                // carica per conto suo alcuni di questi script (cards-db.js
                // per l'elenco delle provenienze, deck-box.js per le
                // scatole), quindi il caso non è teorico.
                if (document.querySelector(`script[src="${src}"]`)) continue;
                await loadScriptSequential(src);
            } else {
                const inline = document.createElement('script');
                inline.textContent = original.textContent;
                document.body.appendChild(inline);
            }
        }
        await loadScriptSequential('js/multiplayer/multiplayer.js');
    }

    function loadScriptSequential(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Impossibile caricare ${src}`));
            document.body.appendChild(script);
        });
    }

    // ============================================================
    // Bootstrap
    // ============================================================
    initLobbyUI();
    restoreSavedServerUrl();
    creaGranelli();
})();
