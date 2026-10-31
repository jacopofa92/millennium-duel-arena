/**
 * mp-passo-comune.js — il Multiplayer a passo comune, dal lato della PAGINA.
 * =====================================================================
 * Il protocollo vive nel motore (js/engine/passo-comune.js) e non sa niente
 * della rete. Qui c'è quello che serve per portarlo su una connessione vera
 * (js/multiplayer/network.js e il relay server/server.js):
 *
 *  - lo SCAMBIO DEI MAZZI all'avvio. A passo comune ogni client esegue la
 *    partita intera, quindi deve conoscere anche il mazzo dell'altro. Ognuno
 *    manda il proprio (la specifica: id e quantità), l'host anche il SEME
 *    della casualità di gioco. Il passo comune è l'unico protocollo
 *    supportato: se l'altro client o il relay non lo conoscono, `prepara`
 *    fallisce con un errore leggibile invece di avviare due motori diversi.
 *    Costo dichiarato: ogni client ha in memoria mazzo e mano dell'altro.
 *
 *  - l'INVIO A LOTTI. Il relay accetta 20 messaggi al secondo per giocatore
 *    e scarta in silenzio quelli in più — e a passo comune un messaggio perso
 *    vuol dire due partite diverse. Un effetto che fa molte scelte di fila
 *    produce molte decisioni nello stesso istante: tutto ciò che il motore
 *    manda nello stesso giro parte quindi come UN messaggio ('passo', con
 *    l'elenco `messaggi`).
 *
 *  - la RIPRESA dopo una caduta di linea: chi rientra dice all'altro fin
 *    dove era arrivato ('passo-riprendi'), e l'altro gli rimanda il resto
 *    (PassoComune.daRispedire). Vale nei due sensi: si rimanda anche quando
 *    a cadere era l'altro, perché i messaggi spediti mentre lui non c'era il
 *    relay non li ha consegnati a nessuno.
 *
 * Script della sala d'attesa (multiplayer.html), caricato prima di
 * mp-lobby.js: ascolta i messaggi del duello fin da subito, perché quelli
 * dell'altro possono arrivare prima che l'arena di qua abbia finito di
 * caricare. Fuori dal Multiplayer non fa niente.
 */
const MpPassoComune = (function () {
    'use strict';

    /** Versione del protocollo deterministico scambiata insieme al mazzo. */
    const VERSIONE_PROTOCOLLO = 2;
    /** Quanto aspettare prima di dichiarare incompatibile/non raggiungibile l'altro client. */
    // 45 s e non 15: il mazzo dell'altro arriva solo quando il SUO telefono ha finito di caricare il duello, e su un
    // telefono lento (cache da aggiornare dopo un rilascio, WebGL che parte) 15 s non bastavano — il giocatore leggeva
    // "versione non compatibile" quando l'altro telefono era semplicemente ancora in caricamento.
    const ATTESA_MAZZO_MS = 45000;
    /** Un lotto più grande di così si spezza: il relay accetta messaggi fino a 64 KB. */
    const LOTTO_MAX_CARATTERI = 40000;

    let net = null;
    let sonoHost = false;
    let iniziaIo = true;
    let acceso = false;

    // MODALITÀ A POSTI (Tag Team in rete, più di due client). La disposizione
    // la decide la sala (js/multiplayer/mp-tag-sala.js) e arriva qui con
    // configuraPosti: { mioClient, miaSquadra, host, iniziaSquadra, posti:
    // { A0: { tipo: 'persona', client } | { tipo: 'ia', personaggio, mazzo, ia }, A1?, B0, B1? } }.
    // Ogni persona manda il mazzo del SUO posto (campo `posto`), l'host anche
    // il seme; i mazzi dei posti IA li costruisce ognuno da sé (personaggio e
    // livello sono nella disposizione, uguale per tutti). Senza configuraPosti
    // tutto resta come nel duello 1 contro 1.
    let configPosti = null;
    const mazziDeiPosti = {};     // posto assoluto -> spec, arrivati dagli altri
    let semeDeiPosti = null;      // il seme, arrivato dall'host
    let attesaPosti = null;       // { risolvi, rifiuta, timer }
    /** Chi, dopo la preparazione a posti, completa il duello (la variante a squadre). */
    const preparazioni = [];

    let mazzoAvversario = null;   // { spec, seme }
    let attesaMazzo = null;       // chi lo sta aspettando
    let rifiutaAttesaMazzo = null;
    let timerAttesaMazzo = null;
    let inAttesaDelMotore = [];   // messaggi arrivati prima di PassoComune.avvia
    let coda = [];
    let lottoProgrammato = false;

    function motoreAcceso() {
        return typeof PassoComune !== 'undefined' && PassoComune.attivo();
    }

    /**
     * Da mp-lobby.js, all'avvio del duello: da qui in poi il duello è a
     * passo comune (window.MP_PASSO_COMUNE, letto da initGame).
     */
    function configura(opzioni) {
        net = opzioni.net || net;
        sonoHost = !!opzioni.sonoHost;
        iniziaIo = !!opzioni.iniziaIo;
        acceso = true;
        window.MP_PASSO_COMUNE = true;
        collegaRete();
    }

    let reteCollegata = false;
    function collegaRete() {
        if (reteCollegata || !net) return;
        reteCollegata = true;
        net.on('game-action', (msg) => {
            const azione = msg && msg.action;
            // Niente controllo su `acceso`: il mazzo dell'altro (e i suoi
            // primi messaggi) possono arrivare PRIMA che di qua la morra
            // cinese sia finita e configura() sia stata chiamata. Si tengono.
            if (!azione) return;
            // Un messaggio con la forma sbagliata si scarta: non deve rompere il duello.
            if (window.ProtocolloMP && ProtocolloMP.KINDS.has(azione.kind)) {
                const motivo = ProtocolloMP.motivoRifiuto(azione);
                if (motivo) { console.warn('Multiplayer: messaggio "' + azione.kind + '" scartato (' + motivo + ')'); return; }
            }
            if (azione.kind === 'mazzo') { if (azione.posto) riceviMazzoDelPosto(azione); else riceviMazzo(azione); return; }
            if (azione.kind === 'passo') { consegna(azione.messaggi); return; }
            if (azione.kind === 'passo-riprendi') {
                // A posti la richiesta nomina a chi è rivolta: rimanda solo lui (i suoi messaggi).
                if (azione.per && (!configPosti || azione.per !== configPosti.mioClient)) return;
                rimanda(azione.ultimo);
                return;
            }
            // Un client precedente racconta le mosse invece di scambiare
            // il mazzo. Riconoscerlo evita quindici secondi di campo fermo.
            if (rifiutaAttesaMazzo && ['phase', 'summon', 'tribute', 'position', 'spelltrap', 'fieldspell', 'attack', 'activate', 'state-push', 'state-sync'].includes(azione.kind)) {
                rifiutaAttesaMazzo('L\'avversario usa una versione Multiplayer non più compatibile');
            }
        });
        // Rientrato io: chiedo quello che ho perso. Rientrato lui: lo chiede
        // lui, ma gli rimando comunque subito quello che il relay non gli ha
        // potuto consegnare mentre non c'era (le due richieste si coprono a
        // vicenda, e i doppioni il motore li scarta).
        net.on('error', relayIncompatibile);
        net.on('reconnected', chiediRipresa);
        // A posti chi rientra chiede da sé a ciascuno (vedi chiediRipresa): chi è rimasto non sa cosa gli manca.
        net.on('opponent-reconnected', () => { if (!configPosti) chiediRipresa(); });
        // Chi esce dalla stanza prima del duello si porta via il suo mazzo:
        // non deve restare lì per chi entrerà dopo.
        net.on('opponent-left', () => { if (!motoreAcceso()) mazzoAvversario = null; });
    }

    function chiediRipresa() {
        if (!acceso || !motoreAcceso() || !net) return;
        if (configPosti) {
            // Una richiesta per ogni altro client, con il punto a cui ero arrivato nel SUO flusso.
            altriClient().forEach((id) => net.sendAction({ kind: 'passo-riprendi', ultimo: PassoComune.ultimoRicevuto(id), per: id }));
            return;
        }
        net.sendAction({ kind: 'passo-riprendi', ultimo: PassoComune.ultimoRicevuto() });
    }

    /** Gli altri client della partita a posti (persone; i posti IA girano sull'host, che è una persona). */
    function altriClient() {
        if (!configPosti) return [];
        const ids = new Set();
        Object.values(configPosti.posti).forEach((s) => { if (s && s.tipo === 'persona' && s.client !== configPosti.mioClient) ids.add(s.client); });
        if (configPosti.host !== configPosti.mioClient) ids.add(configPosti.host);
        return Array.from(ids);
    }

    // --- Modalità a posti --------------------------------------------

    /** Il posto assoluto della persona di questo client. */
    function mioPosto() {
        return Object.keys(configPosti.posti).find((k) => {
            const s = configPosti.posti[k];
            return s && s.tipo === 'persona' && s.client === configPosti.mioClient;
        }) || null;
    }

    /** Da mp-tag-sala.js, alla partenza: da qui in poi il duello è a passo comune, a posti. */
    function configuraPosti(cfg) {
        configPosti = cfg;
        acceso = true;
        sonoHost = cfg.mioClient === cfg.host;
        window.MP_PASSO_COMUNE = true;
        window.MP_POSTI = cfg;
        collegaRete();
    }

    function riceviMazzoDelPosto(azione) {
        if (azione.protocollo !== VERSIONE_PROTOCOLLO) {
            if (attesaPosti) attesaPosti.rifiuta('Un giocatore usa una versione Multiplayer non compatibile');
            return;
        }
        mazziDeiPosti[azione.posto] = azione.spec;
        if (typeof azione.seme === 'number') semeDeiPosti = azione.seme;
        verificaPostiCompleti();
    }

    /** I posti di persona di cui manca ancora il mazzo (il mio escluso: ce l'ho). */
    function postiSenzaMazzo() {
        if (!configPosti) return [];
        const mio = mioPosto();
        return Object.keys(configPosti.posti).filter((k) => {
            const s = configPosti.posti[k];
            return s && s.tipo === 'persona' && k !== mio && !mazziDeiPosti[k];
        });
    }

    function verificaPostiCompleti() {
        if (!attesaPosti || postiSenzaMazzo().length > 0 || (!sonoHost && typeof semeDeiPosti !== 'number')) return;
        const a = attesaPosti;
        attesaPosti = null;
        clearTimeout(a.timer);
        a.risolvi();
    }

    /** La specifica del mazzo di un posto IA: la stessa su tutti i client (personaggio e livello sono nella disposizione). */
    function mazzoDelPostoIA(s) {
        return typeof getCharacterDeck === 'function' ? getCharacterDeck(s.personaggio, s.mazzo || 'medium') : null;
    }

    function preparaAPosti(mioMazzo) {
        const mio = mioPosto();
        const mioSeme = sonoHost ? Math.floor(Math.random() * 2147483647) : undefined;
        if (sonoHost) semeDeiPosti = mioSeme;
        // L'host senza un posto di persona (non dovrebbe capitare: la sala lo fa sedere) manda comunque il seme.
        net.sendAction({ kind: 'mazzo', protocollo: VERSIONE_PROTOCOLLO, spec: mioMazzo, seme: mioSeme, posto: mio || 'nessuno' });
        return new Promise((risolvi, rifiuta) => {
            attesaPosti = {
                risolvi,
                rifiuta: (motivo) => { if (!attesaPosti) return; clearTimeout(attesaPosti.timer); attesaPosti = null; rifiuta(new Error(motivo)); },
                timer: setTimeout(() => {
                    if (attesaPosti) attesaPosti.rifiuta('Qualcuno non ha ancora caricato il duello (telefono lento o connessione persa). Torna al menu e riprova.');
                }, ATTESA_MAZZO_MS)
            };
            verificaPostiCompleti();
        }).then(() => {
            const specPerPosto = {};
            Object.keys(configPosti.posti).forEach((k) => {
                const s = configPosti.posti[k];
                if (!s) return;
                specPerPosto[k] = s.tipo === 'ia' ? mazzoDelPostoIA(s) : (k === mio ? mioMazzo : mazziDeiPosti[k]);
                if (!specPerPosto[k]) throw new Error('Manca il mazzo del posto ' + k);
            });
            return {
                aPosti: true,
                seme: semeDeiPosti,
                squadre: { A: { spec: specPerPosto.A0 }, B: { spec: specPerPosto.B0 } },
                specPerPosto,
                iniziaSquadra: configPosti.iniziaSquadra === 'B' ? 'B' : 'A',
                config: configPosti
            };
        });
    }

    /**
     * Chi controlla un posto assoluto, visto da QUESTO client: la mia persona
     * 'persona', un posto IA 'ia' sull'host e 'remoto' altrove, ogni altra
     * persona 'remoto'. Per tutti i client la natura (chi c'è davvero dietro)
     * è la stessa: è il bivio "chiedo / decido da me" delle carte.
     * @param {string} posto
     */
    function controlloDelPosto(posto) {
        const s = configPosti && configPosti.posti[posto];
        if (!s) return 'remoto';
        if (s.tipo === 'persona') return s.client === configPosti.mioClient ? 'persona' : 'remoto';
        return configPosti.mioClient === configPosti.host ? 'ia' : 'remoto';
    }

    /**
     * Da initGame, con quello che ha restituito prepara: imposta il tavolo,
     * avvia il motore e prepara lo stesso duello degli altri client.
     */
    function avviaMotore(partita) {
        if (!partita.aPosti) {
            Tavolo.imposta({ player: 'persona', bot: 'remoto' });
            PassoComune.avvia({ invia });
            PassoComune.preparaDuello(partita);
            motoreAvviato();
            return;
        }
        const cfg = partita.config;
        const mia = cfg.miaSquadra;
        const altra = mia === 'A' ? 'B' : 'A';
        Tavolo.imposta({ player: controlloDelPosto(mia + '0'), bot: controlloDelPosto(altra + '0') });
        PassoComune.avvia({ invia, posti: { mioClient: cfg.mioClient, miaSquadra: mia } });
        // Natura, livello e personaggio dei primi membri: uguali su TUTTI i client (li leggono regole e IA).
        gameState.livelloIA = gameState.livelloIA || {};
        gameState.personaggioPerPosto = gameState.personaggioPerPosto || {};
        [['player', mia + '0'], ['bot', altra + '0']].forEach(([postoMotore, seat]) => {
            const s = cfg.posti[seat];
            if (!s) return;
            if (controlloDelPosto(seat) === 'remoto') Tavolo.impostaNaturaRemoto(s.tipo === 'ia' ? 'ia' : 'persona', postoMotore);
            if (s.tipo === 'ia') {
                gameState.livelloIA[postoMotore] = s.ia || 'hard';
                gameState.personaggioPerPosto[postoMotore] = s.personaggio;
            } else {
                delete gameState.livelloIA[postoMotore];
                gameState.personaggioPerPosto[postoMotore] = null;
            }
        });
        PassoComune.preparaDuello({ seme: partita.seme, squadre: partita.squadre, iniziaSquadra: partita.iniziaSquadra });
        preparazioni.forEach((fn) => fn(partita, controlloDelPosto));
        motoreAvviato();
    }

    /** La variante a squadre si registra qui (js/modes/tag-mode.js): gira dopo preparaDuello, su tutti i client. */
    function allaPreparazione(fn) { preparazioni.push(fn); }

    function rimanda(ultimo) {
        if (!motoreAcceso()) return;
        spedisciLotti(PassoComune.daRispedire(ultimo));
    }

    // --- Scambio dei mazzi -------------------------------------------

    /** La specifica del mazzo a specchio ({ main, extra }) se la stanza gioca con quella regola, altrimenti null. */
    function mazzoSpecchio() {
        const id = window.MP_SPECCHIO_ID;
        if (!id || typeof getStarterStructureDeck !== 'function') return null;
        const d = getStarterStructureDeck(id);
        if (!d || !Array.isArray(d.main) || d.main.length === 0) return null;
        return { main: d.main.map((c) => ({ id: c.id, qty: c.qty })), extra: (d.extra || []).map((c) => ({ id: c.id, qty: c.qty })) };
    }

    function riceviMazzo(azione) {
        if (azione.protocollo !== VERSIONE_PROTOCOLLO) {
            if (rifiutaAttesaMazzo) rifiutaAttesaMazzo('La versione Multiplayer dell\'avversario non è compatibile');
            return;
        }
        mazzoAvversario = { spec: azione.spec, seme: azione.seme };
        if (attesaMazzo) {
            const risolvi = attesaMazzo;
            attesaMazzo = null;
            rifiutaAttesaMazzo = null;
            clearTimeout(timerAttesaMazzo);
            timerAttesaMazzo = null;
            risolvi(mazzoAvversario);
        }
    }

    function aspettaMazzoAvversario() {
        if (mazzoAvversario) return Promise.resolve(mazzoAvversario);
        return new Promise((risolvi, rifiuta) => {
            attesaMazzo = risolvi;
            rifiutaAttesaMazzo = (motivo) => {
                if (attesaMazzo !== risolvi) return;
                attesaMazzo = null;
                rifiutaAttesaMazzo = null;
                clearTimeout(timerAttesaMazzo);
                timerAttesaMazzo = null;
                rifiuta(new Error(motivo));
            };
            timerAttesaMazzo = setTimeout(() => {
                // Non e' un'incompatibilita' provata: l'altro client non ha risposto. Il messaggio lo dice, cosi' non si
                // cerca un problema di versione dove c'e' solo un telefono lento o una connessione caduta.
                if (rifiutaAttesaMazzo) rifiutaAttesaMazzo('L\'avversario non ha ancora caricato il duello (telefono lento o connessione persa). Torna al menu e riprova.');
            }, ATTESA_MAZZO_MS);
        });
    }

    /**
     * Un relay precedente non conosce 'mazzo' e lo rifiuta subito. Non ha
     * senso aspettare il tetto: si mostra immediatamente l'incompatibilità.
     */
    function relayIncompatibile(msg) {
        const testo = (msg && msg.message) || '';
        if (rifiutaAttesaMazzo && /azione sconosciuta/i.test(testo)) {
            rifiutaAttesaMazzo('Il server non conosce ancora il passo comune');
        }
    }

    /**
     * Manda il mio mazzo (e, se sono l'host, il seme) e aspetta quello
     * dell'altro. Torna ciò che serve a PassoComune.preparaDuello.
     * @param {object} mioMazzo  la specifica { main: [{id, qty}], extra?: [...] }
     */
    function prepara(mioMazzo) {
        if (!acceso || !net) return Promise.reject(new Error('Passo comune non configurato'));
        if (configPosti) return preparaAPosti(mioMazzo);
        // Duello a specchio (regola della stanza, vedi mp-lobby.js): al posto del mazzo personale si manda quello
        // scelto per tutti e due. Se il catalogo non lo conosce si resta sul proprio: meglio un duello normale che nessuno.
        const specchio = mazzoSpecchio();
        if (specchio) mioMazzo = specchio;
        const mioSeme = sonoHost ? Math.floor(Math.random() * 2147483647) : undefined;
        net.sendAction({ kind: 'mazzo', protocollo: VERSIONE_PROTOCOLLO, spec: mioMazzo, seme: mioSeme });
        return aspettaMazzoAvversario().then((suo) => {
            const seme = sonoHost ? mioSeme : suo.seme;
            if (typeof seme !== 'number') throw new Error('Seme della partita mancante');
            return {
                seme,
                sonoHost,
                mazzoHost: sonoHost ? mioMazzo : suo.spec,
                mazzoOspite: sonoHost ? suo.spec : mioMazzo,
                iniziaHost: sonoHost ? iniziaIo : !iniziaIo
            };
        });
    }

    // --- Invio e consegna -----------------------------------------------

    /** Il trasporto di PassoComune.avvia: accoda, e il lotto parte a fine giro. */
    function invia(messaggio) {
        coda.push(messaggio);
        if (lottoProgrammato) return;
        lottoProgrammato = true;
        setTimeout(() => {
            lottoProgrammato = false;
            const lotto = coda;
            coda = [];
            spedisciLotti(lotto);
        }, 0);
    }

    function spedisciLotti(messaggi) {
        if (!net || messaggi.length === 0) return;
        let pezzo = [];
        let caratteri = 0;
        messaggi.forEach((m) => {
            const lunghezza = JSON.stringify(m).length;
            if (pezzo.length > 0 && caratteri + lunghezza > LOTTO_MAX_CARATTERI) {
                net.sendAction({ kind: 'passo', messaggi: pezzo });
                pezzo = [];
                caratteri = 0;
            }
            pezzo.push(m);
            caratteri += lunghezza;
        });
        if (pezzo.length > 0) net.sendAction({ kind: 'passo', messaggi: pezzo });
    }

    function consegna(messaggi) {
        if (!Array.isArray(messaggi)) return;
        if (!motoreAcceso()) { inAttesaDelMotore = inAttesaDelMotore.concat(messaggi); return; }
        messaggi.forEach((m) => PassoComune.ricevi(m));
    }

    /** Da initGame, subito dopo PassoComune.avvia: consegna quello arrivato prima. */
    function motoreAvviato() {
        const arrivati = inAttesaDelMotore;
        inAttesaDelMotore = [];
        arrivati.forEach((m) => PassoComune.ricevi(m));
    }

    // In ascolto fin dal caricamento (vedi sopra); configura() aggiunge solo
    // ruolo e chi comincia.
    if (window.DuelNetwork) {
        net = window.DuelNetwork;
        collegaRete();
    }

    return {
        configura,
        configuraPosti,
        prepara,
        avviaMotore,
        allaPreparazione,
        invia,
        motoreAvviato,
        acceso: () => acceso,
        /** La disposizione dei posti (null nel duello 1 contro 1). */
        posti: () => configPosti
    };
})();

// Vedi passo-comune.js: un `const` di script non è una proprietà di window.
window.MpPassoComune = MpPassoComune;
