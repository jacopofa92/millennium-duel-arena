// @ts-check
/**
 * torre-mode.js — Il duello di un piano della Torre dei Duellanti.
 * =====================================================================
 * duelMonstersCore.html?mode=torre&piano=<n>&character=<avversario>&difficulty=<livello>
 *
 * Fuori dal motore, come le altre modalità: cambia soltanto la
 * PREPARAZIONE del duello, avvolgendo preparaManiIniziali() (lo stesso
 * punto usato dal Tutorial) e richiamando poi l'originale.
 *  - Life Point: si parte con quelli rimasti dal piano prima.
 *  - Oggetti raccolti salendo (vedi js/data/torre-db.js):
 *      Carta fidata         la carta scelta va in cima al mazzo PRIMA
 *                           delle pescate iniziali, quindi è nella mano;
 *      Mano più ricca       1 carta in più (per volta) dopo le pescate;
 *      Avversario indebolito  1000 Life Point in meno all'avversario;
 *      Prima mossa          niente morra: comincia il giocatore
 *                           (chiComincia, letto da duel-session.js).
 * La fine del duello la registra Torre.registraFine (js/modes/torre.js):
 * si sale di un piano o la scalata finisce.
 */
(function () {
    'use strict';

    const params = new URLSearchParams(window.location.search);
    if ((params.get('mode') || '').toLowerCase() !== 'torre') return;

    const piano = Number(params.get('piano')) || 0;
    const MALUS_LP_AVVERSARIO = 1000;
    /** Sotto questa soglia l'oggetto non toglie altro: un duello deve restare un duello. */
    const LP_MINIMI_AVVERSARIO = 4000;

    /** @returns {ScalataTorre | null} la scalata in corso, se questo è davvero il suo piano. */
    function scalata() {
        const sc = Torre.stato().inCorso;
        return sc && sc.piano === piano && !sc.sceltaInSospeso ? sc : null;
    }

    /** La Carta fidata in cima al mazzo (l'ultima dell'elenco, che si pesca per prima). @param {number} id */
    function cartaInCima(id) {
        /** @type {Card[]} */
        const mazzo = gameState[Tavolo.chiave('player', 'Deck')] || [];
        const i = mazzo.findIndex((c) => c && c.id === id);
        if (i < 0) return;
        mazzo.push(mazzo.splice(i, 1)[0]);
    }

    function avvia() {
        const sc = scalata();
        if (!sc) {
            // Link vecchio, piano già giocato o premio ancora da scegliere:
            // si torna alla Torre, che sa cosa va fatto.
            window.location.replace('torre.html');
            return;
        }
        const originale = window.preparaManiIniziali;
        window.preparaManiIniziali = function () {
            if (sc.oggetti.carta && sc.cartaFidata != null) cartaInCima(sc.cartaFidata);
            originale();
            if (sc.oggetti.mano > 0) drawCardsToHand('player', sc.oggetti.mano);
            gameState.playerLP = sc.lp;
            gameState.botLP = Math.max(LP_MINIMI_AVVERSARIO, torreDatabase.lpIniziali - MALUS_LP_AVVERSARIO * (sc.oggetti.lpAvversario || 0));
        };
        initGame();
    }

    /** @returns {Owner | null} */
    function chiComincia() {
        const sc = scalata();
        return sc && sc.oggetti.primo ? 'player' : null;
    }

    /**
     * Fine del duello: si sale o la scalata finisce, e lo si dice.
     * @param {boolean} vinto @param {boolean} abbandono @returns {VoceEsito[]}
     */
    function chiudi(vinto, abbandono) {
        const lp = (typeof gameState !== 'undefined' && gameState) ? gameState.playerLP : 0;
        const r = Torre.registraFine(piano, vinto && !abbandono, lp);
        if (r.esito === 'ignorato') return [];
        if (window.ChallengeTracker && r.esito !== 'sconfitta') {
            ChallengeTracker.recordProgress('torreFloor', { piano: r.piano });
            if (r.boss) ChallengeTracker.recordProgress('torreBoss', { piano: r.piano });
            if (r.esito === 'conquistata') ChallengeTracker.recordProgress('torreCompleted', {});
        }
        // Illustrazioni alternative (js/data/artwork-alternativi.js): ad OGNI scalata che supera il piano 15,
        // e ad ogni conquista, se ne vince UNA dal bacino di quella fonte, finche' il bacino non e' finito.
        /** @type {(fonte: string, perche: string) => VoceEsito[]} */
        const arte = (fonte, perche) => (window.ArtworkAlternativi ? ArtworkAlternativi.premiaDaFonte(fonte, perche) : []);
        if (r.esito === 'conquistata') {
            /** @type {VoceEsito[]} */
            const voci = [{ nota: true, icon: '🗼', rule: `Torre conquistata! Hai superato tutti i ${Torre.piani()} piani in una sola scalata.` }];
            return voci.concat(arte('torre-conquistata', 'Torre conquistata'));
        }
        if (r.esito === 'salito') {
            /** @type {VoceEsito[]} */
            const voci = [{
                nota: true,
                icon: '🗼',
                rule: `Piano ${r.piano} superato: al piano ${r.piano + 1} riparti con ${Math.max(1, lp)} Life Point. Prima di salire scegli fra Ristoro e un oggetto.`
            }];
            return voci.concat(r.piano === 15 ? arte('torre-piano-15', 'Piano 15 della Torre superato') : []);
        }
        return [{
            nota: true,
            icon: '🗼',
            rule: abbandono
                ? `Scalata abbandonata al piano ${r.piano}. Dalla Torre puoi ricominciare da capo quando vuoi.`
                : `Scalata finita al piano ${r.piano}: i Life Point non si ricaricano, ogni piano conta. Dalla Torre puoi ricominciare.`
        }];
    }

    window.ModalitaDuello = window.ModalitaDuello || {};
    /** @type {ModalitaDuello} */
    const modalita = {
        urlRitorno: 'torre.html',
        chiComincia: chiComincia,
        avvia: avvia,
        chiudi: chiudi
    };
    window.ModalitaDuello.torre = modalita;
})();
