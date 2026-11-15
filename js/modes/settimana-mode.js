/**
 * settimana-mode.js — Il duello del Duello della Settimana.
 * =====================================================================
 * duelMonstersCore.html?mode=settimana&character=<avversario>&difficulty=<livello>
 *
 * Fuori dal motore, come le altre modalità: cambia soltanto la PREPARAZIONE
 * del duello, avvolgendo preparaManiIniziali() (lo stesso punto usato dal
 * Tutorial e dalla Torre) e richiamando poi l'originale, che pesca come sempre.
 *  - Il mazzo del GIOCATORE non si tocca: se anche un solo mostro non rispetta la regola
 *    della settimana il duello non parte (Settimana.verificaMazzo) e la pagina dice quali.
 *    Solo i mostri fuori regola del mazzo dell'AVVERSARIO (costruito dal gioco) sono
 *    sostituiti (Settimana.conformaMazzo).
 *  - Un riquadro in alto ricorda la regola per tutta la durata del duello.
 * Premi di fine duello: i soliti di un duello vinto, più il premio della
 * settimana la prima volta che si vince a quel livello (Settimana.registraVittoria).
 */
(function () {
    'use strict';

    const params = new URLSearchParams(window.location.search);
    if ((params.get('mode') || '').toLowerCase() !== 'settimana') return;

    const ETICHETTE = { Facile: 'Facile', Medio: 'Normale', Difficile: 'Difficile' };

    /** @param {'player' | 'bot'} posto @param {any} r @param {any} opzioni */
    function adattaMazzo(posto, r, opzioni) {
        const chiaveMazzo = Tavolo.chiave(posto, 'Deck');
        const mazzo = gameState[chiaveMazzo];
        if (Array.isArray(mazzo) && mazzo.length) {
            const esito = Settimana.conformaMazzo(mazzo, r, opzioni);
            gameState[chiaveMazzo] = esito.mazzo;
            gameState[Tavolo.chiave(posto, 'DeckCount')] = esito.mazzo.length;
        }
        const chiaveExtra = Tavolo.chiave(posto, 'ExtraDeck');
        if (Array.isArray(gameState[chiaveExtra])) gameState[chiaveExtra] = Settimana.conformaExtra(gameState[chiaveExtra], r);
    }

    function avvia() {
        const r = Settimana.regola();
        // Un link vecchio (altra settimana, altro avversario): si torna alla pagina, che sa cosa è in gioco adesso.
        if (params.get('character') !== Settimana.avversario()) {
            window.location.replace('settimana.html');
            return;
        }
        // Il mazzo del giocatore deve rispettare la regola cosi' com'e': se non la rispetta il duello non parte (nessuna carta
        // viene cambiata al suo posto). La pagina lo dice prima, con l'elenco; qui si copre il link diretto.
        if (!Settimana.verificaMazzo(window.SaveManager ? SaveManager.getActiveDeck() : null).ok) {
            window.location.replace('settimana.html');
            return;
        }
        const originale = window.preparaManiIniziali;
        window.preparaManiIniziali = function () {
            adattaMazzo('bot', r, { catalogo: cardDatabase });
            originale();
        };
        initGame();
    }

    /**
     * Fine del duello: la prima vittoria della settimana a questo livello paga il premio.
     * @param {boolean} vinto @param {boolean} abbandono
     */
    function chiudi(vinto, abbandono) {
        const r = Settimana.regola();
        if (!vinto || abbandono) {
            return [{ nota: true, icon: r.icona, rule: 'Duello della Settimana non vinto: puoi riprovare quando vuoi fino a lunedì.' }];
        }
        const livello = params.get('difficulty') || 'Medio';
        const esito = Settimana.registraVittoria(livello);
        // Sfide (js/data/challenges-db.js, sezione 'settimana'): ogni vittoria conta; la tripletta solo quando i tre
        // premi della settimana sono tutti presi.
        if (window.ChallengeTracker) {
            ChallengeTracker.recordProgress('settimanaWin', { livello: livello });
            const vinte = Settimana.stato().vinte;
            if (esito.primaVolta && vinte.Facile && vinte.Medio && vinte.Difficile) ChallengeTracker.recordProgress('settimanaTutti', {});
        }
        const nomeLivello = ETICHETTE[livello] || livello;
        if (!esito.primaVolta || !esito.premio) {
            return [{ nota: true, icon: r.icona, rule: `Duello della Settimana vinto di nuovo a livello ${nomeLivello}: il premio di questa settimana a quel livello l'hai già preso.` }];
        }
        const voci = [];
        const spiegazione = `Duello della Settimana vinto a livello ${nomeLivello} (${r.titolo}): il premio si prende una volta a settimana per livello.`;
        if (esito.premio.crediti > 0 && window.SaveManager) {
            SaveManager.addCurrency('credits', esito.premio.crediti);
            voci.push({ currency: 'credits', amount: esito.premio.crediti, icon: '💰', nome: 'Crediti', rule: spiegazione });
        }
        if (esito.premio.stelle > 0 && window.SaveManager) {
            SaveManager.addCurrency('starChips', esito.premio.stelle);
            voci.push({ currency: 'starChips', amount: esito.premio.stelle, icon: '⭐', nome: 'Stelle dell\'Esagono', rule: spiegazione });
        }
        // La ricompensa rara è una sola valuta a scelta casuale: entrambe
        // restano possibili, ma la vittoria non concede mai tutte e due.
        const valuteRare = esito.premio.valutaRara || [];
        if (valuteRare.length && window.SaveManager) {
            const valuta = valuteRare[Math.floor(Math.random() * valuteRare.length)];
            const premiRari = {
                locatorCards: { icon: '🃏', nome: 'Carta Locazione' },
                millenniumCards: { icon: '🔱', nome: 'Carta del Millennio' }
            };
            const dettaglio = premiRari[valuta];
            if (dettaglio) {
                SaveManager.addCurrency(valuta, 1);
                voci.push({ currency: valuta, amount: 1, icon: dettaglio.icon, nome: dettaglio.nome, rule: spiegazione });
            }
        }
        return voci;
    }

    window.ModalitaDuello = window.ModalitaDuello || {};
    window.ModalitaDuello.settimana = {
        urlRitorno: 'settimana.html',
        avvia: avvia,
        chiudi: chiudi
    };
})();
