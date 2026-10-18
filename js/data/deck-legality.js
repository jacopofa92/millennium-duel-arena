// @ts-check
/**
 * deck-legality.js — "questo mazzo può scendere in campo in questo
 * duello?", rispondibile PRIMA di entrare nell'arena.
 * =====================================================================
 * Il motore un controllo ce l'aveva già (vedi `allowedOrigin` in
 * js/duel-session.js): all'avvio del duello confronta il mazzo con la
 * restrizione e, se non torna, mostra una schermata di blocco. Il
 * problema è QUANDO: a quel punto l'arena è già stata caricata, la
 * musica è partita e la cinematica è in corso — si scopre di non poter
 * giocare dopo essere entrati. Richiesta esplicita dell'utente: il
 * controllo deve avvenire prima.
 *
 * Quel controllo resta dov'è (ultima linea di difesa, e copre anche chi
 * arriva all'arena con un link diretto). Questo file serve alle
 * schermate che il duello lo LANCIANO — Duello Libero, Sala d'Attesa,
 * Tornei — perché possano dire di no prima di partire.
 *
 * COME FA SENZA L'ANAGRAFICA CARTE. Caricare cards-data.generated.js
 * (440 KB) in una schermata di menu solo per leggere un campo sarebbe
 * sproporzionato. Le carte con una provenienza diversa da quella
 * standard sono 50 su 1131, e stanno in un file generato apposta
 * (js/data/card-origins.generated.js, ~5 KB). Le carte inventate dal
 * giocatore le conosce già CustomCards, che legge dal browser.
 * Conseguenza dichiarata: se nessuno dei due è caricato, questo file
 * NON blocca nulla e lascia l'ultima parola al controllo dell'arena —
 * meglio un blocco tardivo che un blocco sbagliato.
 */
(function () {
    'use strict';

    const PREDEFINITA = 'yu-gi-oh';

    /** Mappa id -> { name, origin } costruita una volta sola. */
    let mappa = null;

    function indice() {
        if (mappa) return mappa;
        mappa = new Map();
        (window.CARD_ORIGIN_EXCEPTIONS || []).forEach((c) => {
            mappa.set(c.id, { name: c.name, origin: c.origin });
        });
        // Le carte inventate dal giocatore hanno la LORO provenienza e
        // possono cambiare mentre il gioco è aperto (crea-carta.html), ma
        // non mentre si sta scegliendo un avversario: rileggerle qui, alla
        // prima domanda, è sufficiente.
        if (window.CustomCards && typeof CustomCards.list === 'function') {
            try {
                CustomCards.list().forEach((c) => {
                    if (c && typeof c.id === 'number') {
                        mappa.set(c.id, { name: c.name, origin: c.origin || PREDEFINITA });
                    }
                });
            } catch (e) {
                console.warn('[DeckLegality] carte personalizzate illeggibili:', e);
            }
        }
        return mappa;
    }

    /** Da richiamare se le carte personalizzate cambiano nella stessa sessione. */
    function invalida() { mappa = null; }

    /**
     * I NOMI delle carte del mazzo che NON rispettano `allowedOrigin`.
     * Array vuoto = mazzo ammesso. Ogni nome compare una volta sola:
     * dire tre volte la stessa carta perché ne hai tre copie non aiuta
     * chi legge.
     */
    function carteNonAmmesse(mazzo, allowedOrigin) {
        if (!mazzo || !allowedOrigin || allowedOrigin === 'all') return [];
        const idx = indice();
        // Nessun dato = nessun giudizio: vedi il commento in testa al file.
        if (idx.size === 0) return [];

        const viste = new Set();
        const fuori = [];
        [...(mazzo.main || []), ...(mazzo.extra || [])].forEach((voce) => {
            if (!voce || viste.has(voce.id)) return;
            viste.add(voce.id);
            const info = idx.get(voce.id);
            // Una carta che non è tra le eccezioni è di provenienza
            // standard: è lo stesso assunto del motore (vedi il commento
            // su `origin` in js/data/cards-db.js).
            const provenienza = info ? info.origin : PREDEFINITA;
            if (provenienza !== allowedOrigin) fuori.push((info && info.name) || `Carta #${voce.id}`);
        });
        return fuori;
    }

    /** Scorciatoia per il mazzo attualmente in uso. */
    function mazzoCorrenteNonAmmesso(allowedOrigin) {
        const mazzo = window.SaveManager && SaveManager.getActiveDeck && SaveManager.getActiveDeck();
        return carteNonAmmesse(mazzo, allowedOrigin);
    }

    window.DeckLegality = {
        carteNonAmmesse: carteNonAmmesse,
        mazzoCorrenteNonAmmesso: mazzoCorrenteNonAmmesso,
        invalida: invalida
    };
})();
