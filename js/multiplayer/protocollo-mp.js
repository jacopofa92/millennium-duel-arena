// @ts-check
/**
 * protocollo-mp.js — la FORMA dei messaggi del Multiplayer.
 * =====================================================================
 * Il relay (server/server.js) accetta solo un elenco chiuso di tipi di
 * messaggio (`kind`), ma finora non guardava cosa c'era DENTRO: un messaggio
 * con i campi sbagliati (un mazzo che non è un elenco, un `seq` testuale, una
 * morra senza scelta) arrivava intero all'altro client e lo poteva rompere a
 * metà partita. Qui sta la descrizione di ogni tipo e il controllo.
 *
 * UN SOLO FILE PER TUTTI E DUE I LATI: si carica con un <script> nelle pagine
 * (window.ProtocolloMP) e con require() dal relay (module.exports) — stesso
 * schema UMD, nessuna dipendenza. Così il controllo del server e quello dei
 * client non possono divergere.
 *
 * Il controllo guarda la FORMA e i limiti di grandezza, non il significato
 * (se un comando è giocabile lo decide il motore, che è lo stesso su entrambi i
 * lati). Un campo in più non è un errore: un client più nuovo può aggiungerne.
 *
 * COME SI AGGIUNGE UN TIPO: una voce in CONTROLLI, il nome in GAME_ACTION_KINDS
 * di server/server.js (lo sorveglia tests/specs/guardrail-protocollo-mp.spec.js),
 * e il server si ridistribuisce.
 */
(function (/** @type {any} */ radice, fabbrica) {
    if (typeof module === 'object' && module.exports) module.exports = fabbrica();
    else radice.ProtocolloMP = fabbrica();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Limiti larghi: servono a fermare un messaggio assurdo, non uno strano ma legittimo.
    const MAX_TESTO = 200;
    const MAX_MAZZO = 300;
    const MAX_LOTTO = 600;

    const oggetto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    const intero = (v) => Number.isInteger(v);
    const testo = (v) => typeof v === 'string' && v.length <= MAX_TESTO;

    /** Un elenco di { id, qty } (un mazzo principale o un Extra Deck). */
    function elencoCarte(v, nome) {
        if (!Array.isArray(v)) return nome + ' non è un elenco';
        if (v.length > MAX_MAZZO) return nome + ' è troppo lungo';
        for (const c of v) {
            if (!oggetto(c) || !intero(c.id) || !intero(c.qty) || c.qty < 0 || c.qty > 99) return nome + ' contiene una voce non valida';
        }
        return null;
    }

    /** I singoli messaggi dentro un lotto 'passo'. */
    function messaggioDelPasso(m) {
        if (!oggetto(m)) return 'un messaggio del lotto non è un oggetto';
        if (m.seq !== undefined && (!intero(m.seq) || m.seq < 1)) return 'seq non valido';
        if (m.tipo === 'comando') {
            if (!oggetto(m.comando) || typeof m.comando.tipo !== 'string' || m.comando.tipo.length > MAX_TESTO) return 'comando senza tipo';
            if (m.turno !== undefined && !intero(m.turno)) return 'turno non valido';
            if (m.fase !== undefined && !testo(m.fase)) return 'fase non valida';
            return null;
        }
        if (m.tipo === 'decisione') {
            if (m.indice !== null && !intero(m.indice)) return 'indice della decisione non valido';
            return null;
        }
        return 'tipo di messaggio sconosciuto nel lotto';
    }

    /** kind -> funzione(azione) che torna il motivo del rifiuto, o null. */
    const CONTROLLI = {
        'room-config': (a) => {
            if (!testo(a.field)) return 'campo mancante';
            if (!testo(a.music)) return 'musica mancante';
            if (a.origin !== undefined && !testo(a.origin)) return 'origine non valida';
            // Duello a specchio: id del mazzo che giocano ENTRAMBI (facoltativo, un client vecchio non lo manda).
            if (a.specchio !== undefined && !testo(a.specchio)) return 'mazzo a specchio non valido';
            // Raid cooperativo: id del Boss (facoltativo, esclusivo con lo specchio).
            if (a.raid !== undefined && !testo(a.raid)) return 'boss del raid non valido';
            return null;
        },
        'ready': (a) => {
            if (typeof a.pronto !== 'boolean') return 'pronto non è vero/falso';
            // La pedina (id di un personaggio) e' facoltativa: un client piu' vecchio non la manda.
            if (a.pedina !== undefined && !(typeof a.pedina === 'string' && a.pedina.length > 0 && a.pedina.length <= 40)) return 'pedina non valida';
            return null;
        },
        'rps': (a) => {
            if (typeof a.iniziaChiManda === 'boolean') return null;
            return testo(a.scelta) ? null : 'morra senza scelta';
        },
        'mazzo': (a) => {
            if (!intero(a.protocollo)) return 'versione del protocollo mancante';
            if (a.seme !== undefined && (!intero(a.seme) || a.seme < 0 || a.seme > 2147483647)) return 'seme non valido';
            if (!oggetto(a.spec)) return 'mazzo mancante';
            const principale = elencoCarte(a.spec.main, 'il mazzo');
            if (principale) return principale;
            if (a.spec.extra !== undefined) return elencoCarte(a.spec.extra, 'l\'Extra Deck');
            return null;
        },
        'passo': (a) => {
            if (!Array.isArray(a.messaggi)) return 'lotto senza messaggi';
            if (a.messaggi.length > MAX_LOTTO) return 'lotto troppo grande';
            for (const m of a.messaggi) {
                const motivo = messaggioDelPasso(m);
                if (motivo) return motivo;
            }
            return null;
        },
        'passo-riprendi': (a) => (intero(a.ultimo) && a.ultimo >= 0 ? null : 'ultimo messaggio non valido'),
        // Raid cooperativo: colpo porta il TOTALE di danno inflitto al Boss da chi manda; uori = a terra.
        'raid': (a) => {
            if (a.tipo === 'fuori' || a.tipo === 'ripeti') return null;
            // `campo`: fotografia PUBBLICA del campo (solo per essere guardata dal compagno): quattro righe da 5 caselle
            // e qualche numero. Si controlla la forma e i limiti, non il significato.
            if (a.tipo === 'campo') {
                const c = a.campo;
                if (!oggetto(c)) return 'campo mancante';
                for (const riga of ['mostri', 'mt', 'bossMostri', 'bossMt']) {
                    if (!Array.isArray(c[riga]) || c[riga].length > 5) return 'riga del campo non valida';
                    for (const s of c[riga]) {
                        if (s === null) continue;
                        if (!oggetto(s) || (s.id !== undefined && !intero(s.id)) || (s.atk !== undefined && !intero(s.atk)) || (s.def !== undefined && !intero(s.def))) return 'casella del campo non valida';
                    }
                }
                for (const n of ['lp', 'mano', 'mazzo', 'cimitero', 'bossLp', 'bossMano', 'bossCimitero']) {
                    if (c[n] !== undefined && !intero(c[n])) return 'numero del campo non valido';
                }
                return null;
            }
            if (a.tipo !== 'colpo') return 'tipo di messaggio del raid sconosciuto';
            return intero(a.inflitti) && a.inflitti > -1000000 && a.inflitti < 1000000 ? null : 'danno non valido';
        },
        'game-over': (a) => (typeof a.opponentWon === 'boolean' || a.opponentWon === 'draw' ? null : 'esito non valido')
    };

    const KINDS = new Set(Object.keys(CONTROLLI));

    /**
     * Torna null se l'azione ha la forma giusta, altrimenti una frase che dice
     * cosa non va (per il log: non si mostra al giocatore).
     * @param {any} azione
     * @returns {string | null}
     */
    function motivoRifiuto(azione) {
        if (!oggetto(azione)) return 'azione non valida';
        const controllo = CONTROLLI[azione.kind];
        if (!controllo) return 'azione sconosciuta';
        try { return controllo(azione); } catch (e) { return 'azione illeggibile'; }
    }

    return { KINDS, motivoRifiuto };
});
