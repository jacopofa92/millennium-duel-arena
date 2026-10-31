// @ts-check
/**
 * decisioni.js — ogni scelta del duello passa da qui.
 * =====================================================================
 * Nucleo senza testa (piano di attacco, Priorità 2). Le scelte (quale
 * carta, quale bersaglio, Attacco o Difesa, quale delle due azioni) erano
 * scritte carta per carta, e ognuna ripeteva da sé la stessa decisione:
 * "se sceglie il giocatore e c'è l'interfaccia, apri la lista; altrimenti
 * prendi il primo"; alcune anche "se sceglie l'avversario remoto, aspetta
 * la sua scelta". Dove una carta se ne dimenticava un pezzo, quella scelta
 * si comportava in modo diverso dalle altre.
 *
 * Ora una carta descrive la scelta (una RICHIESTA) e dice cosa fare col
 * risultato. Qui si decide CHI risponde, sempre allo stesso modo:
 *  1. l'avversario remoto, nel Multiplayer a passo comune: si aspetta la
 *     posizione scelta nello stesso elenco calcolato dai due motori;
 *  2. la persona davanti allo schermo, se a scegliere è 'player' e
 *     un'interfaccia ascolta l'evento 'decisione' (actions.js apre la
 *     lista, il popover, le opzioni);
 *  3. altrimenti la scelta automatica della richiesta (`automatica`, o il
 *     primo candidato): il bot, o qualunque duello senza interfaccia — il
 *     duello senza testa, le simulazioni.
 * Mentre si aspetta, la decisione è "in sospeso" (Decisioni.inSospeso) e
 * chiunque può risponderle (Decisioni.rispondi): un test, un'altra
 * interfaccia, un domani un secondo bot al posto del giocatore.
 *
 * LA RICHIESTA
 *   chi        'player' | 'bot' — chi sceglie (di solito ctx.owner)
 *   tipo       'carte'       una carta da un elenco (candidati qualsiasi,
 *                            `mostra(c)` dà la carta da disegnare)
 *              'opzioni'     un'etichetta: candidati [{ value, label, icon? }]
 *              'posizione'   Attacco o Difesa: candidati ['attack','defense']
 *              'coppia'      una di due azioni: candidati [{ label, icon }, { label, icon }]
 *              'presa-visione' un elenco da guardare, non da scegliere: si
 *                            risolve con null quando lo si chiude
 *              'risposta'    rispondere in Catena con una delle carte
 *                            candidate, o passare (null); porta anche
 *                            cartaInnesco, momento, innescoProprio per il
 *                            prompt (vedi offerChoice in duel-engine.js)
 *   candidati  l'elenco fra cui scegliere
 *   titolo, testo, vuota (testo per un elenco vuoto), ancora (elemento a
 *              cui agganciare un popover, da PortaUI; null = centro)
 *   automatica (candidati) => candidato | null: cosa sceglie il bot, o un
 *              duello senza interfaccia. Default: il primo candidato.
 *   annullabile la persona può chiudere senza scegliere: si risolve con null
 *   automaticaSeUnica  con un solo candidato non si chiede nulla
 * Il risultato arriva a `onDeciso(candidato | null)`. Asincrono quando
 * risponde una persona: tutto ciò che dipende dalla scelta va dentro
 * onDeciso, mai dopo la chiamata.
 */
(function () {
    'use strict';

    /** @type {null | { id: number, richiesta: any, fine: (valore: any) => void }} */
    let aperta = null;
    let progressivo = 0;

    const g = /** @type {any} */ (globalThis);

    /** @param {any} r */
    function sceltaAutomatica(r) {
        if (r.tipo === 'presa-visione') return null;
        const c = r.candidati || [];
        // Con una `automatica` vale la sua risposta, anche "nessuna" (null o
        // undefined): per una risposta in Catena o un effetto facoltativo
        // "non scelgo niente" è una scelta, non un invito a prendere il primo.
        if (typeof r.automatica === 'function') {
            const scelta = r.automatica(c.slice());
            return scelta === undefined ? null : scelta;
        }
        return c[0] === undefined ? null : c[0];
    }

    /**
     * Vero se una scelta di `chi` la farà una persona davanti a QUESTO
     * schermo: è il giocatore locale e un'interfaccia ascolta. Serve a chi
     * prepara una scelta in più passi (una carta alla volta) e vuole far
     * decidere al bot l'insieme intero in un colpo solo.
     * @param {string} chi
     * @param {string} [tipo] il tipo di decisione; senza, basta che
     *        un'interfaccia per le scelte ci sia
     */
    function rispondeUnaPersona(chi, tipo) {
        // Multiplayer a passo comune (js/engine/passo-comune.js): la
        // risposta deve essere la STESSA sui due client, perché le carte la
        // usano per scegliere fra "chiedo" e "decido da me" — e se un lato
        // chiedesse e l'altro no, uno aspetterebbe una decisione che l'altro
        // non manderà mai. Conta quindi solo chi controlla il posto, non se
        // un'interfaccia di qua sappia mostrare la scelta: se non sa,
        // chiedi() ripiega sulla scelta automatica e la comunica comunque.
        if (passoComune()) return g.Tavolo.giocaUnaPersona(chi);
        return interfacciaPerLaPersona(chi, tipo);
    }

    /** Vero mentre il duello è a passo comune. */
    function passoComune() {
        return typeof g.PassoComune !== 'undefined' && g.PassoComune.attivo();
    }

    /**
     * La posizione della scelta nell'elenco dei candidati, -1 per "nessuna".
     * Per identità, e in ripiego per uid: un'interfaccia può restituire una
     * copia della carta (vedi __mostraCoperta in chooseFieldCardTarget).
     * @param {any[]} candidati
     * @param {any} valore
     */
    function posizioneDi(candidati, valore) {
        if (valore === null || valore === undefined) return -1;
        const i = candidati.indexOf(valore);
        if (i !== -1) return i;
        const uidDi = (/** @type {any} */ x) => x && (x.uid || (x.card && x.card.uid));
        const u = uidDi(valore);
        return u ? candidati.findIndex((/** @type {any} */ c) => uidDi(c) === u) : -1;
    }

    /**
     * @param {string} chi
     * @param {string} [tipo]
     */
    function interfacciaPerLaPersona(chi, tipo) {
        // Chi controlla il posto lo dice js/engine/tavolo.js: di default
        // 'player' è la persona, ma in un IA contro IA nessuno dei due lo è.
        if (!g.Tavolo || !g.Tavolo.ePersona(chi)) return false;
        if (!g.EventiDuello || !g.EventiDuello.ascoltato('decisione')) return false;
        // L'interfaccia può esserci ma non saper mostrare questa scelta
        // adesso (un modale assente): allora decide la scelta automatica.
        // Senza tipo si chiede solo se un'interfaccia per le scelte c'è.
        return g.EventiDuello.chiedi('decisioni-a-schermo', true, tipo) !== false;
    }

    /**
     * @param {any} richiesta
     * @param {(scelta: any) => void} onDeciso
     */
    function chiedi(richiesta, onDeciso) {
        const r = Object.assign({ tipo: 'carte', candidati: [] }, richiesta);
        if (r.tipo === 'posizione' && (!r.candidati || r.candidati.length === 0)) r.candidati = ['attack', 'defense'];
        const aPassoComune = passoComune();

        // 0. Passo comune: OGNI scelta dell'altro client si aspetta (non
        // solo quelle con `viaggia`), come posizione nell'elenco — i due
        // client calcolano gli stessi candidati.
        if (aPassoComune && g.Tavolo.eRemoto(r.chi)) {
            g.PassoComune.attendiDecisione((/** @type {number} */ indice) => {
                const scelta = indice >= 0 ? r.candidati[indice] : null;
                onDeciso(scelta === undefined ? null : scelta);
            }, r.chi);
            return;
        }

        const id = ++progressivo;
        let chiusa = false;
        // Vero finché chiedi() non è tornata: una risposta data adesso è
        // "all'istante" (vedi PassoComune.differisci).
        let sincrona = true;
        const fine = (/** @type {any} */ valore) => {
            if (chiusa) return;
            chiusa = true;
            if (aperta && aperta.id === id) aperta = null;
            if (aPassoComune) {
                // Sempre, anche una scelta obbligata o automatica: l'altro
                // client la sta aspettando (vedi il punto 0 qui sopra).
                g.PassoComune.decisioneLocale(posizioneDi(r.candidati, valore), r.chi);
                const scelta = valore === undefined ? null : valore;
                // Presa all'istante, si applica a codice in corso finito: è
                // lì che la applica anche l'altro client, che la riceve dalla
                // rete (vedi il commento sul tempo delle regole in
                // passo-comune.js).
                if (sincrona) g.PassoComune.differisci(() => onDeciso(scelta));
                else onDeciso(scelta);
                return;
            }
            onDeciso(valore === undefined ? null : valore);
        };

        // Un solo candidato e niente da chiedere: si prende quello, per
        // chiunque — NON la scelta automatica, che per un effetto
        // facoltativo può essere "rinuncio" (giusta per il bot, sbagliata
        // per chi aveva scelto di usare l'effetto).
        if (r.automaticaSeUnica && r.candidati.length === 1) {
            fine(r.candidati[0]);
            return;
        }
        // 2. La persona davanti allo schermo, se c'è chi gliela mostra.
        if (!interfacciaPerLaPersona(r.chi, r.tipo)) {
            // 3. La scelta automatica.
            fine(sceltaAutomatica(r));
            return;
        }
        aperta = { id, richiesta: r, fine };
        g.EventiDuello.emetti('decisione', r, fine);
        sincrona = false;
    }

    const Decisioni = {
        chiedi,
        rispondeUnaPersona,

        /**
         * La decisione che aspetta una persona, senza le funzioni: tipo, chi,
         * titolo, testo e candidati. null se non c'è nulla in sospeso.
         * @returns {null | { id: number, chi: string, tipo: string, titolo?: string, testo?: string, candidati: any[] }}
         */
        inSospeso() {
            if (!aperta) return null;
            const r = aperta.richiesta;
            return { id: aperta.id, chi: r.chi, tipo: r.tipo, titolo: r.titolo, testo: r.testo, candidati: r.candidati.slice() };
        },

        /**
         * Risponde alla decisione in sospeso al posto della persona: col
         * candidato stesso, col suo indice nell'elenco, o null per
         * "chiudi senza scegliere". Torna false se non c'era nulla da
         * rispondere. Chi la mostrava a schermo (un modale aperto) resta
         * da chiudere a parte.
         * @param {any} valore
         */
        rispondi(valore) {
            if (!aperta) return false;
            const { richiesta, fine } = aperta;
            const scelta = typeof valore === 'number' ? richiesta.candidati[valore] : valore;
            fine(scelta === undefined ? null : scelta);
            return true;
        },

        /**
         * Ridisegna la scelta umana ancora aperta senza crearne una nuova.
         * Android puo' congelare la WebView a schermo spento e perdere il
         * layer del modale pur lasciando viva la callback: al ritorno il
         * motore risulta correttamente in attesa, ma non c'e' piu' nulla da
         * toccare. Riemettere la stessa richiesta conserva id, candidati e
         * callback, quindi non duplica ne' risolve la decisione.
         */
        riproponi() {
            if (!aperta || !g.EventiDuello) return false;
            g.EventiDuello.emetti('decisione', aperta.richiesta, aperta.fine);
            return true;
        }
    };

    g.Decisioni = Decisioni;
})();
