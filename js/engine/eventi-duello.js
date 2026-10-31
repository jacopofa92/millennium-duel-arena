// @ts-check
/**
 * eventi-duello.js — il canale con cui le REGOLE avvisano l'interfaccia.
 * =====================================================================
 * Nucleo senza testa (piano di attacco, Priorità 2). Le regole del duello
 * (duel-engine.js, fasi.js, battaglia.js, evocazioni.js, bot.js, le carte)
 * chiamavano per nome le funzioni del disegno: renderLifePoints(),
 * showPhaseAnnouncement(), flyCardToSlot()... Quelle funzioni vivono in
 * game-flow.js e actions.js, che senza una pagina non si possono caricare,
 * e quindi le regole non potevano girare da sole.
 *
 * Ora le regole dicono COSA è successo ("annuncio di fase", "una carta è
 * stata distrutta in questa casella") e l'interfaccia, se c'è, ascolta e
 * disegna. Senza ascoltatori (in Node, nel duello senza testa) un avviso
 * non fa niente, una domanda riceve la risposta predefinita e un'attesa
 * finisce subito: esattamente quello che serve quando non c'è niente da
 * animare.
 *
 * Tre forme, scelte in base a cosa la regola si aspetta indietro:
 *  - emetti(nome, ...dati): un avviso. Nessuna risposta.
 *  - attendi(nome, ...dati, fatto): un avviso che richiede tempo (un volo di
 *    carta, una cinematica). `fatto` parte quando OGNI ascoltatore l'ha
 *    chiamato; senza ascoltatori parte subito, nello stesso istante.
 *  - chiedi(nome, predefinito, ...dati): una domanda ("c'è una scelta
 *    aperta a schermo?"). Risponde il primo ascoltatore che restituisce
 *    qualcosa di diverso da undefined; altrimenti vale `predefinito`.
 *
 * I nomi degli eventi sono un ELENCO CHIUSO (EVENTI qui sotto): un nome
 * sbagliato in un emetti o in un ascolta sarebbe un avviso che nessuno
 * sente, senza alcun errore — qui invece finisce in console. Un evento
 * nuovo si aggiunge all'elenco, con una riga che dice cosa porta.
 *
 * Un errore dentro un ascoltatore NON risale nelle regole: un difetto di
 * disegno non deve fermare a metà una Catena o una battaglia. Viene
 * segnalato (reportError, che nel browser arriva agli stessi ascoltatori
 * globali di un errore non gestito — js/ui/error-recovery.js) e il canale
 * prosegue; in un'attesa conta come "fatto", o la regola resterebbe ferma.
 *
 * Regola per il codice futuro: un file di regola non chiama per nome una
 * funzione di game-flow.js o actions.js; emette un evento di questo
 * elenco. Lo sorveglia tests/specs/guardrail-regole-senza-interfaccia.spec.js.
 */
(function () {
    'use strict';

    /**
     * Ogni evento, con ciò che porta. Chi ascolta riceve gli stessi
     * argomenti, nello stesso ordine (per un'attesa, più `fatto` in coda).
     * @type {Readonly<Record<string, string>>}
     */
    const EVENTI = Object.freeze({
        // --- avvisi (emetti) ---
        'registro': '(messaggio) una riga del registro del duello',
        'ridisegna': '() lo stato è cambiato: ridisegnare il duello',
        'catena': '(linkInRisoluzione?) la pila della Catena è cambiata',
        'life-points': '() i Life Points sono cambiati',
        'annuncio-fase': '(titolo, sottotitolo?, variante?) inizia una fase',
        'annuncio-turno': '(parolaSinistra, parolaDestra, sottotitolo) inizia un turno',
        'orologio': '() è cambiato il turno: aggiornare il contatore',
        'inizio-turno': '(posto) REGOLA: comincia il turno di quel posto, subito dopo il cambio di currentPlayer e prima di scadenze, turno saltato, azzeramenti e pescata (aggancio A1, docs/planning/PIANO_TAG_TEAM.md)',
        'prima-del-comando': '(posto, comando) REGOLA, solo a passo comune: un comando sta per partire, a duello fermo, nello STESSO punto logico su tutti i client (da chi lo manda prima dell\'impronta, da chi lo riceve prima del confronto). Offline non viene mai emesso (aggancio A4, docs/planning/PIANO_TAG_TEAM.md)',
        'carta-pescata-in-mano': '() il giocatore ha pescato la carta del turno',
        'pescata-da-effetto': '(owner, pescata) un effetto ha fatto pescare',
        'mazzo-rimescolato': '(owner) un effetto ha rimescolato il Deck di quel giocatore',
        'partita-azzerata': '() un duello nuovo: dimenticare i ricordi del disegno',
        'attesa-decisione-remota': '(inAttesa, quante) il motore aspetta una scelta dell\'altro client',
        'selezione-azzerata': '() selezioni e prompt a schermo vanno chiusi',
        'prompt-tributo-chiuso': '() la scelta dei Tributi è finita',
        'prompt-scarto-chiuso': '() la scelta degli scarti è finita',
        'evocazione-tributo-pronta': '(carta, indiceMano, rettangoloPartenza) Tributi pagati: scegliere casella e Posizione',
        'cambio-posizione': '(owner, indice) un mostro ha cambiato Posizione',
        'impatto-campo': '(owner, indice, zona) una carta è atterrata in una casella',
        'distruzione': '(owner, indice, zona) una carta in campo viene distrutta',
        'attacco-bloccato': '(owner, indice, zona, elementoAttaccante) un attacco non ha distrutto il bersaglio',
        'attivazione-negata': '(carta, owner, zona, indice) un\'attivazione è stata annullata in Catena',
        'transizione-carta': '({ carta, da, a, variante? }) una carta si sposta visivamente fra due zone',
        'effetto-battaglia': '(...) gli stessi argomenti di showBattleEffect',
        'danno-fluttuante': '(...) gli stessi argomenti di showFloatingDamage',
        'avviso-attacco-diretto': '(...) gli stessi argomenti di showDirectAttackWarning',
        'fine-duello': '(playerWon, opzioni?) il duello è finito: true, false o \'draw\'',
        'decisione': '(richiesta, rispondi) una scelta per la persona davanti allo schermo (js/engine/decisioni.js); rispondi(candidato | null)',
        // --- attese (attendi) ---
        'vittoria-istantanea': '(tipo, playerWon, fatto) cinematica di una vittoria istantanea (exodiawin, destinyboard, flyingelephant)',
        'grido-evocazione': '({ posto, carta, speciale? }, fatto) il duellante annuncia la sua carta simbolo PRIMA dell\'Evocazione (js/ui/grido-evocazione.js); senza grido per quella carta parte subito',
        'volo-carta':'({ carta, partenza, casella, daNascondere?, coperta?, posizione? }, fatto) una carta vola dalla mano alla casella',
        'scarto-fine-turno': '(eccesso, fatto) il giocatore sceglie cosa scartare a fine turno',
        // --- domande (chiedi) ---
        'interfaccia-occupata': '() → true se a schermo c\'è una scelta o una cinematica che il duello deve aspettare',
        'evocazione-in-sospeso': '() → true se la persona ha GIA\' pagato i Tributi di un\'Evocazione e non l\'ha ancora completata: nessun cambio di fase finche\' non finisce',
        'decisioni-a-schermo': '(tipo) → false se l\'interfaccia non può mostrare adesso una decisione di quel tipo',
        'lato-sconfitto': '(posto, motivo) → false se quel posto NON ha perso anche se i suoi Life Point sono a 0 (aggancio A3, docs/planning/PIANO_TAG_TEAM.md). Predefinito: true, il duello finisce come sempre'
    });

    /** @type {Map<string, Function[]>} */
    const ascoltatori = new Map();

    /** @param {string} nome */
    function controllaNome(nome) {
        if (Object.prototype.hasOwnProperty.call(EVENTI, nome)) return true;
        console.error(`EventiDuello: evento sconosciuto "${nome}" (vedi l'elenco EVENTI in js/engine/eventi-duello.js)`);
        return false;
    }

    /** @param {unknown} errore */
    function segnala(errore) {
        const g = /** @type {any} */ (globalThis);
        if (typeof g.reportError === 'function') g.reportError(errore);
        else console.error(errore);
    }

    const EventiDuello = {
        EVENTI,

        /**
         * Registra un ascoltatore. Restituisce la funzione che lo toglie.
         * @param {string} nome
         * @param {Function} fn
         * @returns {() => void}
         */
        ascolta(nome, fn) {
            controllaNome(nome);
            const elenco = ascoltatori.get(nome) || [];
            elenco.push(fn);
            ascoltatori.set(nome, elenco);
            return () => {
                const attuale = ascoltatori.get(nome) || [];
                ascoltatori.set(nome, attuale.filter((x) => x !== fn));
            };
        },

        /**
         * Vero se qualcuno ascolta: serve dove la regola sceglie una strada
         * diversa quando nessuno può rispondere (es. lo scarto di fine turno,
         * che senza interfaccia non ha chi lo scelga).
         * @param {string} nome
         */
        ascoltato(nome) {
            controllaNome(nome);
            return (ascoltatori.get(nome) || []).length > 0;
        },

        /**
         * @param {string} nome
         * @param {...any} dati
         */
        emetti(nome, ...dati) {
            controllaNome(nome);
            // Copia: un ascoltatore che si toglie mentre gira non deve far
            // saltare quello dopo.
            (ascoltatori.get(nome) || []).slice().forEach((fn) => {
                try { fn(...dati); } catch (e) { segnala(e); }
            });
        },

        /**
         * L'ultimo argomento è `fatto`. Parte una volta sola, quando ogni
         * ascoltatore l'ha chiamato (o ha lanciato un errore); subito, se
         * non ascolta nessuno.
         * @param {string} nome
         * @param {...any} datiEFatto
         */
        attendi(nome, ...datiEFatto) {
            controllaNome(nome);
            const fatto = datiEFatto.pop();
            const dati = datiEFatto;
            const elenco = (ascoltatori.get(nome) || []).slice();
            let mancano = elenco.length;
            let chiuso = false;
            const uno = () => {
                if (chiuso) return;
                mancano--;
                if (mancano <= 0) { chiuso = true; if (typeof fatto === 'function') fatto(); }
            };
            if (mancano === 0) { chiuso = true; if (typeof fatto === 'function') fatto(); return; }
            elenco.forEach((fn) => {
                // Ogni ascoltatore ha il SUO fatto: chiamarlo due volte non
                // deve contare per due.
                let suo = false;
                const fattoSuo = () => { if (!suo) { suo = true; uno(); } };
                try { fn(...dati, fattoSuo); } catch (e) { segnala(e); fattoSuo(); }
            });
        },

        /**
         * @param {string} nome
         * @param {any} predefinito
         * @param {...any} dati
         */
        chiedi(nome, predefinito, ...dati) {
            controllaNome(nome);
            for (const fn of (ascoltatori.get(nome) || []).slice()) {
                let risposta;
                try { risposta = fn(...dati); } catch (e) { segnala(e); continue; }
                if (risposta !== undefined) return risposta;
            }
            return predefinito;
        }
    };

    /** @type {any} */ (globalThis).EventiDuello = EventiDuello;
})();
