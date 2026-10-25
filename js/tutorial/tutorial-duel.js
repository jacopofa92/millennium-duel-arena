/**
 * tutorial-duel.js — La lezione guidata col nonno.
 * =====================================================================
 * Un duello vero, ma preparato: mani e mazzi in ordine fisso, il nonno
 * (Solomon Muto) che spiega una cosa alla volta e mette in risalto il
 * punto dello schermo da toccare, e le altre mosse bloccate finché non si
 * fa quella giusta.
 *
 * COME UNA SANDBOX, NON COME UN PEZZO DEL MOTORE (richiesta esplicita
 * dell'utente: "non inquinare logiche di motore solide"):
 *  - questo file vive solo in duelMonstersCore.html?mode=tutorial e non fa
 *    nulla in nessun'altra modalità;
 *  - non tocca regole, fasi, carte o IA. Il duello lo gioca il motore di
 *    sempre: l'unica cosa sostituita è preparaManiIniziali() (chi comincia
 *    e le mani di partenza), lo stesso punto in cui la sandbox mette il
 *    suo stato preparato;
 *  - il turno del nonno lo gioca l'IA vera, livello Facile. Non serve
 *    scriverlo a mano: con in mano un solo mostro utile (Elfi Gemelli, 1900
 *    ATK) lo Evoca e attacca il Guerriero Celtico del giocatore, che è
 *    esattamente il momento in cui scatta la sua Trappola;
 *  - le mosse non previste dal passo in corso le ferma un ascoltatore sui
 *    click in fase di CAPTURE (gate più sotto): blocca il tocco prima che
 *    arrivi al gioco, invece di aggiungere controlli nelle funzioni di
 *    gioco. Spegnendo l'ascoltatore il duello torna quello di sempre.
 *
 * LA LEZIONE (il giocatore comincia, il nonno parte da 3000 LP):
 *   turno 1: Evocazione del Guerriero Celtico, Cilindro Magico coperto,
 *            fine turno (al primo turno non si attacca);
 *   turno 2: il nonno Evoca Elfi Gemelli e attacca; il giocatore attiva il
 *            Cilindro, che annulla l'attacco e gli infligge 1900 danni;
 *   turno 3: pescata di Raigeki (era in cima al mazzo), che distrugge i
 *            mostri del nonno; Evocazione Tributo del Teschio Evocato
 *            sacrificando il Celtico; Battle Phase e attacco diretto da
 *            2500, che chiude il duello (1100 LP rimasti al nonno).
 *
 * MAI BLOCCATI: ogni passo ha "↻ Ricomincia" (ricarica la lezione da
 * capo), e un passo che non si completa entro un tempo lungo lo offre in
 * evidenza.
 */
(function () {
    'use strict';

    const CARTE = {
        celtico: 4,      // Guardiano Celtico, Lv4 1400
        cilindro: 10,    // Cilindro Magico, Trappola
        teschio: 13,     // Teschio Evocato, Lv6 2500
        raigeki: 409,    // Raigeki, Magia
        elfi: 24,        // Elfi Gemelli, Lv4 1900 (del nonno)
        servo: 526,      // Servitore del Teschio, 300 (riempitivo)
        robolady: 528    // Robolady, 450 (riempitivo)
    };
    const LP_NONNO = 3000;
    const PREMIO_CREDITI = 200;

    let uidContatore = 0;
    function istanzia(id) {
        const modello = typeof cardDatabase !== 'undefined' && cardDatabase.find((c) => c.id === id);
        if (!modello) return null;
        uidContatore++;
        return Object.assign({}, modello, { uid: 'tutorial-' + uidContatore + '-' + id });
    }
    function carte(ids) { return ids.map(istanzia).filter(Boolean); }

    /**
     * Prende il posto di preparaManiIniziali() (js/engine/game-flow.js)
     * solo per questa lezione. Il mazzo si pesca dalla FINE (pop), quindi
     * l'ultima carta dell'elenco è la prima pescata: Raigeki arriva al
     * turno 3 (al turno 1 non si pesca).
     */
    function preparaLezione() {
        gameState.currentPlayer = 'player';
        gameState.playerHand = carte([CARTE.celtico, CARTE.cilindro, CARTE.teschio]);
        gameState[Tavolo.chiave('player', 'Deck')] = carte([
            CARTE.servo, CARTE.robolady, CARTE.celtico, CARTE.servo, CARTE.robolady,
            CARTE.servo, CARTE.robolady, CARTE.servo, CARTE.raigeki
        ]);
        gameState.botHand = carte([CARTE.elfi, CARTE.servo, CARTE.robolady]);
        gameState[Tavolo.chiave('bot', 'Deck')] = carte([
            CARTE.servo, CARTE.robolady, CARTE.servo, CARTE.robolady,
            CARTE.servo, CARTE.robolady, CARTE.servo, CARTE.robolady
        ]);
        ['player', 'bot'].forEach((posto) => {
            gameState[Tavolo.chiave(posto, 'DeckCount')] = gameState[Tavolo.chiave(posto, 'Deck')].length;
            // L'Extra Deck del mazzo attivo non serve alla lezione, e una
            // Fusione possibile sarebbe solo una distrazione.
            gameState[Tavolo.chiave(posto, 'ExtraDeck')] = [];
        });
        gameState.botLP = LP_NONNO;
    }

    // ------------------------------------------------------------------
    // Lettura dello stato (solo lettura: il tutorial non scrive mai sulle
    // regole dopo la preparazione).
    // ------------------------------------------------------------------
    const inCampo = (posto, id) => (Tavolo.mostri(posto) || []).some((s) => s && s.card && s.card.id === id);
    const inMagieTrappole = (posto, id) => (Tavolo.magieTrappole(posto) || []).some((s) => s && s.card && s.card.id === id);
    const nelCimitero = (posto, id) => (gameState[Tavolo.chiave(posto, 'Graveyard')] || []).some((c) => c && c.id === id);
    const mostriAvversari = () => (Tavolo.mostri('bot') || []).filter(Boolean).length;
    const cartaInMano = (id) => (gameState.playerHand || []).find((c) => c && c.id === id);
    const selezionata = (id) => !!(gameState.selectedCard && gameState.selectedCard.card && gameState.selectedCard.card.id === id);
    const modaleAperto = () => !!document.querySelector('#activateModal.open');
    const popoverAperto = () => document.getElementById('quickPopover');

    function elCartaInMano(id) {
        const c = cartaInMano(id);
        return c ? document.querySelector(`#playerHand [data-uid="${c.uid}"]`) : null;
    }
    const selCartaInMano = (id) => {
        const c = cartaInMano(id);
        return c ? `#playerHand [data-uid="${c.uid}"]` : '#playerHand .__nessuna';
    };
    const SEL_MOSTRI = '#playerFieldBoard .field-slot[data-owner="player"][data-type="monster"]';
    const SEL_MT = '#playerFieldBoard .field-slot[data-owner="player"][data-type="st"]';
    const SEL_POPOVER = '#quickPopover';
    function primaCasellaLibera(tipo) {
        const campo = tipo === 'monster' ? Tavolo.mostri('player') : Tavolo.magieTrappole('player');
        const i = (campo || []).findIndex((s) => !s);
        return i < 0 ? null : document.querySelector(`#playerFieldBoard .field-slot[data-owner="player"][data-type="${tipo}"][data-index="${i}"]`);
    }
    function casellaConMostro(id) {
        const i = (Tavolo.mostri('player') || []).findIndex((s) => s && s.card && s.card.id === id);
        return i < 0 ? null : document.querySelector(`${SEL_MOSTRI}[data-index="${i}"]`);
    }

    /**
     * Bersaglio di un'Evocazione/piazzamento: prima la carta in mano, poi
     * (carta selezionata) la casella libera, e quando compare la scelta di
     * Posizione il riquadro con i pulsanti.
     */
    function bersaglioPiazzamento(id, tipo) {
        if (popoverAperto()) return popoverAperto();
        if (selezionata(id)) return primaCasellaLibera(tipo) || elCartaInMano(id);
        return elCartaInMano(id);
    }

    // ------------------------------------------------------------------
    // I passi. Ognuno: testo del nonno, cosa mettere in risalto, cosa si
    // può toccare, e quando è fatto (controllato ogni 200ms). `avanti`:
    // passo di sola spiegazione, si prosegue col pulsante; `pronto` dice
    // quando il pulsante può comparire.
    // ------------------------------------------------------------------
    const PASSI_NONNO = [
        {
            testo: 'Benvenuto nella mia bottega! Prima di lasciarti andare per il mondo, facciamo un piccolo duello insieme: ti mostro come si gioca, un passo alla volta.',
            avanti: true
        },
        {
            testo: 'Questi sono i tuoi Life Point: 8000. Se arrivano a zero, perdi il duello. Per questa lezione io parto con 3000: portali a zero e hai vinto.',
            bersaglio: () => document.getElementById('playerInfo'),
            avanti: true
        },
        {
            testo: 'Questa è la tua mano. Ogni turno peschi una carta, tranne il primissimo turno di chi comincia.',
            bersaglio: () => document.getElementById('playerHand'),
            avanti: true
        },
        {
            testo: 'Il turno è diviso in fasi. Adesso sei nella Main Phase 1: è qui che si evocano i mostri e si giocano Magie e Trappole.',
            bersaglio: () => document.getElementById('phaseStepper'),
            avanti: true,
            pronto: () => gameState.phase === 'main1' && gameState.currentPlayer === 'player',
            attesa: 'Un attimo, il turno si sta preparando…'
        },
        {
            testo: 'Evochiamo il primo mostro. Tocca il Guardiano Celtico, poi una casella mostro libera, e scegli la posizione di Attacco. Puoi anche trascinarlo direttamente sulla casella.',
            bersaglio: () => bersaglioPiazzamento(CARTE.celtico, 'monster'),
            consenti: () => [selCartaInMano(CARTE.celtico), SEL_MOSTRI, SEL_POPOVER],
            fatto: () => inCampo('player', CARTE.celtico)
        },
        {
            testo: 'Bene! Ora la Trappola. Le Trappole si mettono coperte e si attivano più avanti, di solito nel turno dell\'avversario. Tocca il Cilindro Magico e poi una casella Magia/Trappola libera.',
            bersaglio: () => bersaglioPiazzamento(CARTE.cilindro, 'st'),
            consenti: () => [selCartaInMano(CARTE.cilindro), SEL_MT, SEL_POPOVER],
            fatto: () => inMagieTrappole('player', CARTE.cilindro)
        },
        {
            testo: 'Nel primo turno del duello non si può attaccare. Passa il turno: tocca "Fine".',
            bersaglio: () => document.querySelector('.phase-step[data-phase="end"]'),
            consenti: () => ['.phase-step[data-phase="end"]'],
            fatto: () => gameState.currentPlayer === 'bot'
        },
        {
            testo: 'Adesso tocca a me. Guarda cosa faccio…',
            bersaglio: () => document.getElementById('botFieldBoard'),
            // Solo il pulsante "Attiva", MAI lo sfondo della finestra (#activateModal): un tocco sullo sfondo la chiude, cioe' RIFIUTA la
            // risposta, e il Cilindro non scatta piu'. Il passo avanza da solo (ogni 200 ms) quando la finestra si apre, e in quel
            // breve intervallo uno sfondo consentito faceva deragliare la lezione (a volte per i test, ma anche per chi tocca al momento sbagliato).
            consenti: () => ['#activateConfirmBtn'],
            fatto: () => modaleAperto() || nelCimitero('player', CARTE.cilindro)
        },
        {
            testo: 'Il mio Elfo ti attacca! È il momento della tua Trappola: il Cilindro Magico annulla l\'attacco e mi infligge danni pari all\'ATK del mio mostro. Premi "Attiva".',
            bersaglio: () => document.getElementById('activateConfirmBtn'),
            consenti: () => ['#activateConfirmBtn'],
            fatto: () => nelCimitero('player', CARTE.cilindro) || gameState.botLP < LP_NONNO
        },
        {
            testo: 'Ahi! 1900 danni: mi restano 1100 Life Point. Un attacco fermato al momento giusto può cambiare un duello. Ora torna il tuo turno, e hai appena pescato una carta.',
            bersaglio: () => document.getElementById('botInfo'),
            avanti: true,
            pronto: () => gameState.currentPlayer === 'player' && gameState.phase === 'main1' && !!cartaInMano(CARTE.raigeki),
            attesa: 'Il mio turno sta finendo…'
        },
        {
            testo: 'Hai pescato Raigeki: una Magia che distrugge tutti i mostri del tuo avversario. Le Magie si attivano dalla mano. Toccala e attivala.',
            bersaglio: () => (modaleAperto() ? document.getElementById('activateConfirmBtn')
                : popoverAperto() || elCartaInMano(CARTE.raigeki)),
            consenti: () => [selCartaInMano(CARTE.raigeki), SEL_POPOVER, '#activateConfirmBtn'],
            fatto: () => nelCimitero('player', CARTE.raigeki) && mostriAvversari() === 0
        },
        {
            testo: 'Il mio campo è vuoto! Ora un mostro più forte: il Teschio Evocato è di Livello 6, e per evocarlo devi sacrificare (Tributo) un tuo mostro. Tocca il Teschio, poi il tuo Guardiano Celtico, poi la casella dove metterlo.',
            bersaglio: () => {
                if (modaleAperto()) return document.querySelector('#activateModal .modal-btn.attack');
                if (popoverAperto()) return popoverAperto();
                // Sacrificio fatto: il gioco chiede dove piazzare il Teschio
                // (vedi resolveTributeSummonPlacement in actions.js).
                if (gameState.pendingTributePlacement) return primaCasellaLibera('monster');
                if (selezionata(CARTE.teschio) || gameState.pendingTributeSummon) return casellaConMostro(CARTE.celtico) || primaCasellaLibera('monster');
                return elCartaInMano(CARTE.teschio);
            },
            consenti: () => [selCartaInMano(CARTE.teschio), SEL_MOSTRI, SEL_POPOVER, '#activateModal', '#cardListPickerModal'],
            fatto: () => inCampo('player', CARTE.teschio)
        },
        {
            testo: 'Eccolo! Ora si combatte: tocca "Battaglia" per entrare nella Battle Phase.',
            bersaglio: () => document.querySelector('.phase-step[data-phase="battle"]'),
            consenti: () => ['.phase-step[data-phase="battle"]'],
            fatto: () => gameState.phase === 'battle'
        },
        {
            testo: 'Io non ho mostri: puoi attaccarmi direttamente! Trascina il Teschio Evocato verso il mio lato del campo.',
            bersaglio: () => casellaConMostro(CARTE.teschio),
            consenti: () => [SEL_MOSTRI, '#botFieldBoard', '#botInfo', SEL_POPOVER],
            fatto: () => !!gameState.gameOver
        }
    ];

    // ==================================================================
    // LE LEZIONI BREVI (menu Tutorial, tutorial.html). Una situazione già
    // pronta sul Terreno, una sola cosa da imparare, e alla fine un
    // pannello "Lezione completata" invece di un duello da vincere: dopo
    // l'ultimo passo il duello resta lì, fermo dietro al cancello.
    // Stessi pezzi della lezione col nonno: cambiano solo la preparazione
    // e i passi.
    // ==================================================================
    const ID = {
        drago: 1,          // Drago Bianco Occhi Blu, 3000
        celtico: 4,
        gaia: 14,          // Gaia il Cavaliere
        maledizione: 15,   // Anatema del Drago
        insetto: 23,       // Insetto Mangia-Uomini (FLIP)
        elfi: 24,
        fusione: 38,
        gaiaCampione: 254, // Gaia il Drago Campione (Fusione di 14 + 15)
        raigeki: 409,
        giudizio: 448,     // Giudizio Solenne
        servo: 526,
        robolady: 528,
        soldatoFulgore: 55,
        ritoFulgore: 56,
        ascia: 618,
        libroLuna: 875
    };

    function mostro(id, posizione) {
        const card = istanzia(id);
        if (!card) return null;
        return {
            card: card,
            // "coperto" è sempre Difesa coperta, come in duel-sandbox.js.
            position: posizione === 'coperto' ? 'defense' : (posizione || 'attack'),
            isFaceDown: posizione === 'coperto',
            hasAttacked: false,
            canChangePosition: true
        };
    }
    /** Trappola coperta già attivabile: piazzata "in un turno passato". */
    function copertaPronta(id) {
        const card = istanzia(id);
        return card ? { card: card, isFaceDown: true, setOnTurn: 0 } : null;
    }

    /**
     * Base comune delle lezioni brevi: mani, mazzi di riempitivi, campi
     * vuoti tranne ciò che la lezione mette. Comincia sempre il giocatore.
     */
    function preparaBreve(op) {
        gameState.currentPlayer = 'player';
        gameState.playerHand = carte(op.manoGiocatore || []);
        gameState.botHand = carte(op.manoNonno || []);
        const riempitivi = [ID.servo, ID.robolady, ID.servo, ID.robolady, ID.servo, ID.robolady, ID.servo, ID.robolady];
        ['player', 'bot'].forEach((posto) => {
            gameState[Tavolo.chiave(posto, 'Deck')] = carte(riempitivi);
            gameState[Tavolo.chiave(posto, 'DeckCount')] = riempitivi.length;
            gameState[Tavolo.chiave(posto, 'ExtraDeck')] = [];
        });
        if (op.extraGiocatore) gameState[Tavolo.chiave('player', 'ExtraDeck')] = carte(op.extraGiocatore);
        (op.mostriGiocatore || []).forEach((s, i) => { gameState[Tavolo.chiave('player', 'MonsterField')][i] = s; });
        (op.mostriNonno || []).forEach((s, i) => { gameState[Tavolo.chiave('bot', 'MonsterField')][i] = s; });
        (op.mtGiocatore || []).forEach((s, i) => { gameState[Tavolo.chiave('player', 'STField')][i] = s; });
    }

    const SEL_EXTRA = '#playerFieldBoard .field-slot[data-owner="player"][data-zone="fusion"]';
    const pickerAperto = () => !!document.querySelector('#cardListPickerModal.open');
    function elNelPicker(uid) {
        const el = uid && document.querySelector(`#cardListPickerRow [data-uid="${uid}"]`);
        return el ? (el.closest('.card-list-item') || el) : null;
    }
    const uidInCampo = (posto, id) => {
        const s = (Tavolo.mostri(posto) || []).find((x) => x && x.card && x.card.id === id);
        return s ? s.card.uid : null;
    };
    function casellaMT(id) {
        const i = (Tavolo.magieTrappole('player') || []).findIndex((s) => s && s.card && s.card.id === id);
        return i < 0 ? null : document.querySelector(`${SEL_MT}[data-index="${i}"]`);
    }
    const catenaVuota = () => !(gameState.chain && gameState.chain.links && gameState.chain.links.length);

    // --- La Catena ---------------------------------------------------
    // Il giocatore ha due mostri e Giudizio Solenne coperto; il nonno ha in
    // mano solo Raigeki. Passato il turno, l'IA vera lo attiva (è la sua
    // unica Magia, e i mostri del giocatore valgono la rimozione): si
    // risponde con Giudizio, che si risolve per primo e lo annulla.
    function preparaCatena() {
        preparaBreve({
            manoGiocatore: [ID.servo, ID.robolady],
            manoNonno: [ID.raigeki],
            mostriGiocatore: [mostro(ID.drago), mostro(ID.celtico)],
            mtGiocatore: [copertaPronta(ID.giudizio)]
        });
        // Il nonno pesca a inizio turno. Se pescasse un mostro evocabile e
        // lo evocasse PRIMA di Raigeki, il gioco chiederebbe di rispondere
        // all'Evocazione e Giudizio Solenne si consumerebbe lì: Raigeki
        // passerebbe e la lezione insegnerebbe il contrario. È successo
        // davvero sulla suite di GitHub, dove l'IA ha tempi diversi. Nel suo
        // mazzo restano solo Draghi Bianchi (Livello 8): senza Tributi non
        // si evocano, quindi l'unica mossa possibile è Raigeki.
        const draghi = carte([ID.drago, ID.drago, ID.drago, ID.drago, ID.drago, ID.drago]);
        gameState[Tavolo.chiave('bot', 'Deck')] = draghi;
        gameState[Tavolo.chiave('bot', 'DeckCount')] = draghi.length;
    }
    const PASSI_CATENA = [
        {
            testo: 'Oggi ti spiego la Catena. Quando un giocatore attiva una carta, l\'avversario può rispondere attivandone un\'altra, e poi ancora l\'altro: le attivazioni si agganciano una all\'altra come gli anelli di una catena.',
            avanti: true,
            pronto: () => gameState.phase === 'main1' && gameState.currentPlayer === 'player',
            attesa: 'Un attimo, il turno si sta preparando…'
        },
        {
            testo: 'Hai una Trappola coperta: Giudizio Solenne. Paghi metà dei tuoi Life Point e annulli l\'attivazione di una Magia o di una Trappola dell\'avversario. Una risposta perfetta.',
            bersaglio: () => casellaMT(ID.giudizio),
            avanti: true
        },
        {
            testo: 'Le Trappole servono nel turno dell\'avversario. Passa il turno: tocca "Fine".',
            bersaglio: () => document.querySelector('.phase-step[data-phase="end"]'),
            consenti: () => ['.phase-step[data-phase="end"]'],
            fatto: () => gameState.currentPlayer === 'bot'
        },
        {
            testo: 'Adesso tocca a me. Guarda cosa faccio…',
            bersaglio: () => document.getElementById('botFieldBoard'),
            consenti: () => ['#activateConfirmBtn'],   // mai lo sfondo della finestra: chiuderla rifiuterebbe la risposta (vedi il primo "Adesso tocca a me")
            fatto: () => modaleAperto() || nelCimitero('player', ID.giudizio)
        },
        {
            testo: 'Ho attivato Raigeki: è il primo anello della catena, e distruggerebbe tutti i tuoi mostri. Ma prima che si risolva puoi rispondere: attiva Giudizio Solenne, che diventa il secondo anello. Premi "Attiva".',
            bersaglio: () => document.getElementById('activateConfirmBtn'),
            consenti: () => ['#activateConfirmBtn'],
            fatto: () => nelCimitero('player', ID.giudizio)
        },
        {
            testo: 'Visto? La catena si risolve al contrario: l\'ultimo anello aggiunto si risolve per primo. Giudizio Solenne ha annullato Raigeki prima che facesse qualcosa, e i tuoi mostri sono salvi. Ti è costato metà dei Life Point: una buona risposta ha sempre un prezzo.',
            bersaglio: () => document.getElementById('playerFieldBoard'),
            avanti: true,
            pronto: () => catenaVuota() && nelCimitero('bot', ID.raigeki),
            attesa: 'La catena si sta risolvendo, dall\'ultimo anello al primo…'
        },
        {
            fine: true,
            testo: 'Lezione completata! Ricorda: quando l\'avversario attiva una carta, chiediti sempre se hai qualcosa per rispondere.'
        }
    ];

    // --- La Fusione --------------------------------------------------
    function preparaFusione() {
        preparaBreve({
            manoGiocatore: [ID.gaia, ID.maledizione, ID.fusione],
            extraGiocatore: [ID.gaiaCampione],
            mostriNonno: [mostro(ID.elfi)]
        });
    }
    const PASSI_FUSIONE = [
        {
            testo: 'Oggi ti mostro la Fusione: due o più mostri si uniscono in un mostro molto più forte, che aspetta nel tuo Extra Deck invece che nel mazzo.',
            avanti: true,
            pronto: () => gameState.phase === 'main1' && gameState.currentPlayer === 'player',
            attesa: 'Un attimo, il turno si sta preparando…'
        },
        {
            testo: 'Questo è il tuo Extra Deck. Dentro c\'è Gaia il Drago Campione: per evocarlo servono Gaia il Cavaliere e Anatema del Drago, i suoi materiali.',
            bersaglio: () => document.querySelector(SEL_EXTRA),
            avanti: true
        },
        {
            testo: 'I due materiali li hai in mano, insieme alla Magia che li unisce: Fusione.',
            bersaglio: () => document.getElementById('playerHand'),
            avanti: true
        },
        {
            testo: 'Tocca Fusione e attivala. I materiali vanno al Cimitero e dall\'Extra Deck arriva il Mostro Fusione.',
            bersaglio: () => (modaleAperto() ? document.getElementById('activateConfirmBtn')
                : popoverAperto() || elCartaInMano(ID.fusione)),
            consenti: () => [selCartaInMano(ID.fusione), SEL_POPOVER, '#activateConfirmBtn', '#activateModal', '#cardListPickerModal'],
            fatto: () => inCampo('player', ID.gaiaCampione)
        },
        {
            testo: 'Ecco Gaia il Drago Campione, 2600 ATK: più forte di ciascuno dei suoi materiali. E non hai usato la tua Evocazione Normale del turno: potresti ancora evocare un altro mostro.',
            bersaglio: () => casellaConMostro(ID.gaiaCampione),
            avanti: true,
            pronto: () => catenaVuota()
        },
        {
            fine: true,
            testo: 'Lezione completata! Prima di comprare un mostro Fusione, controlla di avere nel mazzo i suoi materiali e una carta Fusione.'
        }
    ];

    // --- I mostri Flip -----------------------------------------------
    function preparaFlip() {
        preparaBreve({
            manoGiocatore: [ID.servo, ID.robolady],
            mostriGiocatore: [mostro(ID.insetto, 'coperto')],
            mostriNonno: [mostro(ID.elfi), mostro(ID.drago)]
        });
    }
    const PASSI_FLIP = [
        {
            testo: 'Oggi parliamo dei mostri Flip. Hanno un effetto che si attiva quando vengono girati a faccia in su: per questo di solito si Posizionano coperti, e si aspetta il momento giusto.',
            avanti: true,
            pronto: () => gameState.phase === 'main1' && gameState.currentPlayer === 'player',
            attesa: 'Un attimo, il turno si sta preparando…'
        },
        {
            testo: 'Il tuo mostro coperto è un Insetto Mangia-Uomini. Il suo effetto FLIP: quando viene scoperto, distrugge 1 mostro sul Terreno. Io ho il mio Drago Bianco Occhi Blu, 3000 ATK…',
            bersaglio: () => casellaConMostro(ID.insetto),
            avanti: true
        },
        {
            testo: 'Scoprilo con un\'Evocazione Flip: tocca l\'Insetto e poi il pulsante della spada, la Posizione di Attacco.',
            bersaglio: () => (popoverAperto() ? popoverAperto() : casellaConMostro(ID.insetto)),
            consenti: () => [SEL_MOSTRI, SEL_POPOVER, '#cardListPickerModal'],
            fatto: () => pickerAperto() || nelCimitero('bot', ID.drago)
        },
        {
            testo: 'L\'effetto si attiva! Scegli il mio Drago Bianco Occhi Blu: è il mostro più pericoloso.',
            bersaglio: () => elNelPicker(uidInCampo('bot', ID.drago)),
            consenti: () => ['#cardListPickerModal'],
            fatto: () => nelCimitero('bot', ID.drago)
        },
        {
            testo: 'Distrutto! Un mostro Flip scatta anche quando viene attaccato mentre è coperto: chi ti attacca senza sapere cosa c\'è sotto rischia una brutta sorpresa.',
            bersaglio: () => document.getElementById('botFieldBoard'),
            avanti: true,
            pronto: () => catenaVuota()
        },
        {
            fine: true,
            testo: 'Lezione completata! Un mostro coperto non è mai solo un muro: può essere una trappola con le zampe.'
        }
    ];

    // --- Gli Equipaggiamenti ----------------------------------------
    function preparaEquip() {
        preparaBreve({ manoGiocatore: [ID.ascia], mostriGiocatore: [mostro(ID.celtico)], mostriNonno: [mostro(ID.elfi)] });
    }
    const PASSI_EQUIP = [
        { testo: 'Una Magia Equipaggiamento resta sul Terreno e potenzia il mostro a cui viene assegnata. Scegli bene il bersaglio: se quel mostro lascia il campo, anche il suo Equipaggiamento non servirà più.', avanti: true, pronto: () => gameState.phase === 'main1' && gameState.currentPlayer === 'player' },
        {
            testo: 'Il tuo Guardiano Celtico ha 1400 ATK, meno dei miei Elfi Gemelli. Attiva Ascia di Distruzione e scegli il Guerriero: guadagnerà 1000 ATK.',
            bersaglio: () => (pickerAperto() ? elNelPicker(uidInCampo('player', ID.celtico)) : modaleAperto() ? document.getElementById('activateConfirmBtn') : popoverAperto() || elCartaInMano(ID.ascia)),
            consenti: () => [selCartaInMano(ID.ascia), SEL_POPOVER, '#activateConfirmBtn', '#activateModal', '#cardListPickerModal'],
            fatto: () => inMagieTrappole('player', ID.ascia)
        },
        { testo: 'Ora il Guerriero raggiunge 2400 ATK e può superare i miei Elfi. Gli Equipaggiamenti sono potenti, ma legano due carte allo stesso mostro: una rimozione può costarti entrambe.', bersaglio: () => casellaConMostro(ID.celtico), avanti: true, pronto: () => catenaVuota() },
        { fine: true, testo: 'Lezione completata! Usa gli Equipaggiamenti quando il vantaggio ottenuto vale il rischio.' }
    ];

    // --- L'Evocazione Rituale ---------------------------------------
    function preparaRituale() {
        preparaBreve({ manoGiocatore: [ID.soldatoFulgore, ID.ritoFulgore], mostriGiocatore: [mostro(ID.gaia), mostro(ID.servo)] });
    }
    const PASSI_RITUALE = [
        { testo: 'Un Mostro Rituale resta nel Main Deck, ma non può essere Evocato normalmente. Servono la sua Magia Rituale e mostri da offrire con un totale di Livelli sufficiente.', avanti: true, pronto: () => gameState.phase === 'main1' && gameState.currentPlayer === 'player' },
        { testo: 'Soldato del Fulgore Nero è di Livello 8. Sul Terreno hai Gaia di Livello 7 e Servitore del Teschio di Livello 1: insieme raggiungono esattamente 8.', bersaglio: () => document.getElementById('playerFieldBoard'), avanti: true },
        {
            testo: 'Attiva Rito del Fulgore Nero. I due mostri saranno offerti e il Soldato verrà Evocato dalla tua mano.',
            bersaglio: () => (modaleAperto() ? document.getElementById('activateConfirmBtn') : popoverAperto() || elCartaInMano(ID.ritoFulgore)),
            consenti: () => [selCartaInMano(ID.ritoFulgore), SEL_POPOVER, '#activateConfirmBtn', '#activateModal'],
            fatto: () => inCampo('player', ID.soldatoFulgore)
        },
        { testo: 'Il Rituale è riuscito: hai trasformato due mostri con Livelli sufficienti in un guerriero da 3000 ATK. Pianifica le offerte, perché consumano molte risorse.', bersaglio: () => casellaConMostro(ID.soldatoFulgore), avanti: true, pronto: () => catenaVuota() },
        { fine: true, testo: 'Lezione completata! Mostro Rituale, Magia corretta e Livelli sufficienti: servono tutti e tre.' }
    ];

    // --- Le Magie Rapide --------------------------------------------
    function preparaRapida() {
        preparaBreve({ manoGiocatore: [ID.libroLuna], mostriNonno: [mostro(ID.drago)] });
    }
    const PASSI_RAPIDA = [
        { testo: 'Le Magie Rapide possono cambiare una situazione all\'improvviso. Dalla mano puoi usarle nel tuo turno; se le Posizioni coperte, dal turno successivo possono rispondere anche all\'avversario.', avanti: true, pronto: () => gameState.phase === 'main1' && gameState.currentPlayer === 'player' },
        {
            testo: 'Attiva Libro della Luna e scegli il Drago Bianco: verrà girato coperto in Difesa. Così perde per ora la sua minacciosa posizione di Attacco e i suoi effetti scoperti.',
            bersaglio: () => (pickerAperto() ? elNelPicker(uidInCampo('bot', ID.drago)) : modaleAperto() ? document.getElementById('activateConfirmBtn') : popoverAperto() || elCartaInMano(ID.libroLuna)),
            consenti: () => [selCartaInMano(ID.libroLuna), SEL_POPOVER, '#activateConfirmBtn', '#activateModal', '#cardListPickerModal'],
            fatto: () => { const s = (Tavolo.mostri('bot') || []).find((x) => x && x.card.id === ID.drago); return !!(s && s.isFaceDown && s.position === 'defense'); }
        },
        { testo: 'Il Drago è ancora sul Terreno, ma ora combatte con la DEF e la sua identità è nascosta. Libro della Luna non distrugge: crea il momento giusto per difenderti o attaccare.', bersaglio: () => document.getElementById('botFieldBoard'), avanti: true, pronto: () => catenaVuota() },
        { fine: true, testo: 'Lezione completata! Le Magie Rapide premiano il tempismo, non soltanto la forza.' }
    ];

    // ------------------------------------------------------------------
    // Altre quattro lezioni brevi: combattimento, carte che restano sul
    // Terreno, Evocazione Speciale, e una visita guidata al campo.
    // Una cosa sola per lezione, come le altre; ogni passo che chiede un
    // trascinamento dichiara anche `trascina` (la destinazione), che l'uso
    // normale ignora e che serve solo agli spec per ripetere il gesto.
    // ------------------------------------------------------------------
    const ID2 = {
        sogen: 580,          // Magia Terreno: Guerrieri +200 ATK/DEF
        scudo: 148,          // Scudo Giallo del Desiderio, Magia Continua: +300 DEF
        rinascita: 35,       // Mostro Resuscitato
        testaX: 510,         // X-Testa Cannone
        testaY: 513,         // Y-Testa Drago
        cannoneXY: 511       // XY-Cannone Drago (Fusione senza Polimerizzazione)
    };
    const selZona = (zona) => `#playerFieldBoard .field-slot[data-owner="player"][data-zone="${zona}"]`;
    const elZona = (zona) => document.querySelector(selZona(zona));
    const posizioneMostro = (posto, id) => {
        const s = (Tavolo.mostri(posto) || []).find((x) => x && x.card && x.card.id === id);
        return s ? s.position : null;
    };
    /** Selettore della casella del TUO mostro con quell'id (per consentire solo quella). */
    function selCasellaMostro(id) {
        const i = (Tavolo.mostri('player') || []).findIndex((s) => s && s.card && s.card.id === id);
        return i < 0 ? '#playerFieldBoard .__nessuna' : `${SEL_MOSTRI}[data-index="${i}"]`;
    }
    function casellaNonno(id) {
        const i = (Tavolo.mostri('bot') || []).findIndex((s) => s && s.card && s.card.id === id);
        return i < 0 ? null : document.querySelector(`#botFieldBoard .field-slot[data-owner="bot"][data-type="monster"][data-index="${i}"]`);
    }
    const nessunaCinematica = () => !(window.FX && typeof FX.isCinematicPlaying === 'function' && FX.isCinematicPlaying());
    const turnoDelGiocatore = () => gameState.phase === 'main1' && gameState.currentPlayer === 'player';
    const campoAttivo = (id) => { const f = gameState.playerFieldSpell; return !!(f && f.card && f.card.id === id); };
    /** Bersaglio standard di "attiva una carta dalla mano": carta, poi popover, poi conferma. */
    const bersaglioAttivazione = (id) => (pickerAperto() ? null : modaleAperto() ? document.getElementById('activateConfirmBtn')
        : popoverAperto() || elCartaInMano(id));

    // --- Attacco e Difesa --------------------------------------------
    // Il giocatore ha tre mostri e il nonno due: un Elfo in Attacco e uno
    // Skull Servant in Difesa. Si cambia Posizione a Robolady, poi due
    // attacchi: ATK contro ATK (si perde la differenza) e ATK contro DEF
    // (nessun danno ai Life Point). `turn = 3` perché nel primo turno del
    // duello non si può entrare in Battle Phase.
    function preparaBattaglia() {
        preparaBreve({
            manoGiocatore: [ID.servo],
            mostriGiocatore: [mostro(ID.gaia), mostro(ID.celtico), mostro(ID.robolady)],
            mostriNonno: [mostro(ID.elfi), mostro(ID.servo, 'defense')]
        });
        gameState.turn = 3;
    }
    const PASSI_BATTAGLIA = [
        {
            testo: 'Ogni mostro ha due valori: ATK, la forza quando attacca, e DEF, la forza quando si difende. In Posizione di Attacco (in piedi) conta l\'ATK; in Posizione di Difesa (di lato) conta la DEF.',
            avanti: true,
            pronto: () => turnoDelGiocatore(),
            attesa: 'Un attimo, il turno si sta preparando…'
        },
        {
            testo: 'Guarda il mio campo: gli Elfi Gemelli sono in Attacco con 1900 ATK, lo Servitore del Teschio è in Difesa con 200 DEF.',
            bersaglio: () => document.getElementById('botFieldBoard'),
            avanti: true
        },
        {
            testo: 'Il tuo Robolady ha solo 450 ATK ma 900 DEF: è più utile a difendere. Tocca il Robolady e scegli la Posizione di Difesa (lo scudo). Si può cambiare una volta per turno, nella Main Phase.',
            bersaglio: () => popoverAperto() || document.querySelector(selCasellaMostro(ID.robolady)),
            consenti: () => [selCasellaMostro(ID.robolady), SEL_POPOVER],
            fatto: () => posizioneMostro('player', ID.robolady) === 'defense'
        },
        {
            testo: 'Ora si combatte: tocca "Battaglia" per entrare nella Battle Phase.',
            bersaglio: () => document.querySelector('.phase-step[data-phase="battle"]'),
            consenti: () => ['.phase-step[data-phase="battle"]'],
            fatto: () => gameState.phase === 'battle'
        },
        {
            testo: 'Gaia ha 2300 ATK, più dei miei 1900. Trascina Gaia sugli Elfi Gemelli per attaccarli.',
            bersaglio: () => document.querySelector(selCasellaMostro(ID.gaia)),
            trascina: () => casellaNonno(ID.elfi),
            consenti: () => [selCasellaMostro(ID.gaia), '#botFieldBoard', '#botInfo', SEL_POPOVER],
            fatto: () => nelCimitero('bot', ID.elfi)
        },
        {
            testo: 'Gli Elfi sono distrutti! Quando due mostri in Attacco si scontrano vince l\'ATK più alto, e chi controlla il perdente subisce la DIFFERENZA come danno: 2300 − 1900 = 400. Ora ho 7600 Life Point.',
            bersaglio: () => document.getElementById('botInfo'),
            avanti: true,
            pronto: () => gameState.botLP < 8000 && catenaVuota() && nessunaCinematica()
        },
        {
            testo: 'Ora il Guardiano Celtico (1400 ATK) attacca il mio Servitore del Teschio, che è in Difesa con 200 DEF. Trascina il Celtico sullo Servitore del Teschio.',
            bersaglio: () => document.querySelector(selCasellaMostro(ID.celtico)),
            trascina: () => casellaNonno(ID.servo),
            consenti: () => [selCasellaMostro(ID.celtico), '#botFieldBoard', '#botInfo', SEL_POPOVER],
            fatto: () => nelCimitero('bot', ID.servo)
        },
        {
            testo: 'Contro un mostro in Difesa si confronta l\'ATK con la sua DEF: 1400 batte 200, il Servo è distrutto, ma io non perdo nemmeno un Life Point (ne ho ancora 7600). Se invece la DEF fosse stata più alta dell\'ATK, il mostro in Difesa sarebbe rimasto in campo e avresti perso tu la differenza.',
            bersaglio: () => document.getElementById('botInfo'),
            avanti: true,
            pronto: () => catenaVuota() && nessunaCinematica()
        },
        { fine: true, testo: 'Lezione completata! Prima di attaccare confronta sempre ATK e DEF: un attacco sbagliato costa mostri e Life Point.' }
    ];

    // --- Magie e Trappole che restano (Continue e Terreno) ------------
    function preparaContinue() {
        preparaBreve({
            manoGiocatore: [ID2.sogen, ID2.scudo],
            mostriGiocatore: [mostro(ID.gaia), mostro(ID.celtico)],
            mostriNonno: [mostro(ID.elfi)]
        });
    }
    const PASSI_CONTINUE = [
        {
            testo: 'Alcune carte non spariscono dopo l\'uso: restano sul Terreno e il loro effetto dura finché restano lì. Sono le Magie e Trappole Continue e le Magie Terreno.',
            avanti: true,
            pronto: () => turnoDelGiocatore(),
            attesa: 'Un attimo, il turno si sta preparando…'
        },
        {
            testo: 'Cominciamo dalla Magia Terreno Sogen: i mostri Guerriero guadagnano 200 ATK e DEF. Ha una zona tutta sua. Toccala e attivala.',
            bersaglio: () => bersaglioAttivazione(ID2.sogen),
            consenti: () => [selCartaInMano(ID2.sogen), SEL_POPOVER, '#activateConfirmBtn', '#activateModal'],
            fatto: () => campoAttivo(ID2.sogen)
        },
        {
            testo: 'Ecco la zona Terreno, e Gaia (Guerriero) è salita a 2500 ATK. Ce n\'è una sola alla volta: se ne attivi un\'altra, prende il posto della precedente.',
            bersaglio: () => elZona('fieldSpell'),
            avanti: true,
            pronto: () => catenaVuota() && nessunaCinematica()
        },
        {
            testo: 'Ora una Magia Continua: Scudo Giallo del Desiderio dà 300 DEF a tutti i tuoi mostri. Attivala: occuperà una zona Magia/Trappola.',
            bersaglio: () => bersaglioAttivazione(ID2.scudo),
            consenti: () => [selCartaInMano(ID2.scudo), SEL_POPOVER, '#activateConfirmBtn', '#activateModal'],
            fatto: () => inMagieTrappole('player', ID2.scudo)
        },
        {
            testo: 'Finché Scudo Giallo del Desiderio resta lì, i tuoi mostri hanno più DEF. Ma una carta che resta è anche un bersaglio: se l\'avversario la distrugge, il bonus finisce. Le Trappole Continue funzionano allo stesso modo, solo che prima si mettono coperte.',
            bersaglio: () => document.querySelector(`${SEL_MT}[data-index="${(Tavolo.magieTrappole('player') || []).findIndex((s) => s && s.card && s.card.id === ID2.scudo)}"]`),
            avanti: true,
            pronto: () => catenaVuota() && nessunaCinematica()
        },
        { fine: true, testo: 'Lezione completata! Le carte che restano danno vantaggio ogni turno, ma se vengono distrutte non servono più: scegli il momento giusto per giocarle.' }
    ];

    // --- Evocazione Speciale -----------------------------------------
    function preparaSpeciale() {
        preparaBreve({
            manoGiocatore: [ID2.rinascita],
            mostriGiocatore: [mostro(ID2.testaX), mostro(ID2.testaY)],
            extraGiocatore: [ID2.cannoneXY]
        });
        gameState[Tavolo.chiave('player', 'Graveyard')] = carte([ID.gaia]);
    }
    const PASSI_SPECIALE = [
        {
            testo: 'L\'Evocazione Normale è una sola per turno. Ma molte carte ti permettono un\'Evocazione Speciale: un mostro che entra in campo per un effetto, senza usare quella Normale.',
            avanti: true,
            pronto: () => turnoDelGiocatore(),
            attesa: 'Un attimo, il turno si sta preparando…'
        },
        {
            testo: 'Nel tuo Cimitero c\'è Gaia il Cavaliere, distrutto in un duello passato. Il Cimitero raccoglie le carte distrutte o scartate: alcune carte le riportano in gioco.',
            bersaglio: () => elZona('graveyard'),
            avanti: true
        },
        {
            testo: 'Mostro Resuscitato riporta un mostro dal Cimitero sul Terreno. Toccala e attivala, poi scegli Gaia dalla lista.',
            bersaglio: () => {
                if (pickerAperto()) {
                    const gaia = (gameState.playerGraveyard || []).find((c) => c && c.id === ID.gaia);
                    return elNelPicker(gaia && gaia.uid);
                }
                return bersaglioAttivazione(ID2.rinascita);
            },
            consenti: () => [selCartaInMano(ID2.rinascita), SEL_POPOVER, '#activateConfirmBtn', '#activateModal', '#cardListPickerModal'],
            fatto: () => inCampo('player', ID.gaia)
        },
        {
            testo: 'Gaia è tornata in campo con un\'Evocazione Speciale, e non hai usato l\'Evocazione Normale del turno.',
            bersaglio: () => document.querySelector(selCasellaMostro(ID.gaia)),
            avanti: true,
            pronto: () => catenaVuota() && nessunaCinematica()
        },
        {
            testo: 'Ora guarda il tuo Extra Deck: pulsa in viola. Hai sul Terreno X-Testa Cannone e Y-Testa Drago: sono i materiali per XY-Cannone Drago, che si evoca anche senza la carta Fusione.',
            bersaglio: () => elZona('fusion'),
            avanti: true
        },
        {
            testo: 'Tocca l\'Extra Deck: le carte evocabili sono evidenziate. Scegli XY-Cannone Drago. I due materiali verranno BANDITI dal gioco, non mandati al Cimitero.',
            bersaglio: () => (pickerAperto() ? elNelPicker((Tavolo.extraDeck('player')[0] || {}).uid) : elZona('fusion')),
            consenti: () => [SEL_EXTRA, '#cardListPickerModal', '#activateModal'],
            fatto: () => inCampo('player', ID2.cannoneXY)
        },
        {
            testo: 'Ecco XY-Cannone Drago, 2200 ATK. Controlla sempre cosa richiede un mostro dell\'Extra Deck: la Fusione con Polimerizzazione usa la mano e il Terreno, questa combinazione solo i mostri scoperti sul Terreno.',
            bersaglio: () => document.querySelector(selCasellaMostro(ID2.cannoneXY)),
            avanti: true,
            pronto: () => catenaVuota() && nessunaCinematica()
        },
        { fine: true, testo: 'Lezione completata! Le Evocazioni Speciali ti danno mostri in più senza toccare l\'Evocazione Normale: è così che si costruisce un campo forte.' }
    ];

    // --- Il campo di gioco -------------------------------------------
    function preparaCampo() {
        preparaBreve({
            manoGiocatore: [ID.servo, ID.robolady, ID.celtico],
            mostriGiocatore: [mostro(ID.celtico)],
            mtGiocatore: [copertaPronta(ID.giudizio)],
            extraGiocatore: [ID.gaiaCampione]
        });
        gameState[Tavolo.chiave('player', 'Graveyard')] = carte([ID.raigeki]);
    }
    const primaCasella = (tipo) => document.querySelector(`#playerFieldBoard .field-slot[data-owner="player"][data-type="${tipo}"]`);
    const PASSI_CAMPO = [
        {
            testo: 'Facciamo un giro del campo, zona per zona. Non devi toccare niente: leggi e premi Avanti.',
            avanti: true,
            pronto: () => turnoDelGiocatore(),
            attesa: 'Un attimo, il turno si sta preparando…'
        },
        {
            testo: 'La riga dei mostri: fino a 5 mostri. In piedi sono in Attacco, di lato in Difesa, coperti se in Difesa a faccia in giù.',
            bersaglio: () => { const c = primaCasella('monster'); return c && c.parentElement; },
            avanti: true
        },
        {
            testo: 'La riga delle Magie e Trappole: fino a 5 carte. Qui stanno le Trappole coperte, le Magie Continue e gli Equipaggiamenti.',
            bersaglio: () => { const c = primaCasella('st'); return c && c.parentElement; },
            avanti: true
        },
        {
            testo: 'Il Terreno: la zona della Magia Terreno, una sola alla volta. Ora è vuota.',
            bersaglio: () => elZona('fieldSpell'),
            avanti: true
        },
        {
            testo: 'Il Cimitero: le carte distrutte, usate o scartate finiscono qui, a faccia in su. Sono spesso risorse: alcune carte le riportano in gioco.',
            bersaglio: () => elZona('graveyard'),
            avanti: true
        },
        {
            testo: 'L\'Extra Deck, o zona Fusion: i mostri Fusione stanno qui, fuori dal mazzo, e si evocano con i loro materiali. Se pulsa, puoi evocare qualcosa adesso.',
            bersaglio: () => elZona('fusion'),
            avanti: true
        },
        {
            testo: 'Il Deck: da qui peschi una carta a ogni turno. Se devi pescare e non ce ne sono più, perdi il duello.',
            bersaglio: () => elZona('deck'),
            avanti: true
        },
        {
            testo: 'La mano: a fine turno puoi tenere al massimo 6 carte, e se ne hai di più scarti l\'eccesso. Conviene giocare le carte, non accumularle.',
            bersaglio: () => document.getElementById('playerHand'),
            avanti: true
        },
        {
            testo: 'Come si vince: porti a zero i Life Point dell\'avversario, oppure lui non può più pescare. Esistono anche vittorie speciali, come avere in mano tutti e 5 i pezzi di Exodia il Proibito.',
            bersaglio: () => document.getElementById('playerInfo'),
            avanti: true
        },
        {
            testo: 'E il turno ha le sue fasi: Draw, Standby, Main 1, Battle, Main 2, End. Puoi passare a quella che vuoi con la barra qui sopra, ma l\'ordine è sempre lo stesso.',
            bersaglio: () => document.getElementById('phaseStepper'),
            avanti: true
        },
        { fine: true, testo: 'Lezione completata! Ora conosci le zone del campo: la prossima volta che una carta dice "Cimitero" o "Extra Deck" saprai dove guardare.' }
    ];

    const LEZIONI = {
        nonno: { prepara: preparaLezione, passi: PASSI_NONNO },
        battaglia: { prepara: preparaBattaglia, passi: PASSI_BATTAGLIA },
        continue: { prepara: preparaContinue, passi: PASSI_CONTINUE },
        speciale: { prepara: preparaSpeciale, passi: PASSI_SPECIALE },
        campo: { prepara: preparaCampo, passi: PASSI_CAMPO },
        catena: { prepara: preparaCatena, passi: PASSI_CATENA },
        fusione: { prepara: preparaFusione, passi: PASSI_FUSIONE },
        flip: { prepara: preparaFlip, passi: PASSI_FLIP },
        equip: { prepara: preparaEquip, passi: PASSI_EQUIP },
        rituale: { prepara: preparaRituale, passi: PASSI_RITUALE },
        rapida: { prepara: preparaRapida, passi: PASSI_RAPIDA }
    };
    const LEZIONE = (function () {
        const p = new URLSearchParams(window.location.search).get('lezione');
        return LEZIONI[p] ? p : 'nonno';
    })();
    const PASSI = LEZIONI[LEZIONE].passi;
    const MENU_TUTORIAL = 'tutorial.html';

    // ------------------------------------------------------------------
    // Il riquadro del nonno e il riflettore.
    // ------------------------------------------------------------------
    let passo = -1;
    let attivo = false;
    let obbligatoria = false;
    let elCoach = null;
    let elSpot = null;
    let inizioPasso = 0;
    const TROPPO_TEMPO_MS = 90000;

    function costruisci() {
        elSpot = document.createElement('div');
        elSpot.className = 'tut-spot';
        elSpot.setAttribute('aria-hidden', 'true');
        document.body.appendChild(elSpot);

        elCoach = document.createElement('div');
        elCoach.className = 'tut-coach';
        elCoach.id = 'tutorialCoach';
        elCoach.setAttribute('role', 'dialog');
        elCoach.setAttribute('aria-live', 'polite');
        elCoach.innerHTML = `
            <div class="tut-ritratto"><img alt="" src="images/characters/solomonMuto.jpg"></div>
            <div class="tut-corpo">
                <div class="tut-nome">Solomon Muto <span class="tut-passo"></span></div>
                <p class="tut-testo"></p>
                <div class="tut-azioni">
                    <button type="button" class="tut-avanti">Avanti ›</button>
                    <button type="button" class="tut-ricomincia" title="Ricomincia la lezione da capo">↻ Ricomincia</button>
                </div>
            </div>`;
        document.body.appendChild(elCoach);
        const img = elCoach.querySelector('img');
        img.onerror = () => img.remove();
        elCoach.querySelector('.tut-avanti').onclick = () => {
            const p = PASSI[passo];
            if (p && p.fine) { lasciaPagina(MENU_TUTORIAL); return; }
            if (p && p.avanti && (!p.pronto || p.pronto())) vaiA(passo + 1);
        };
        elCoach.querySelector('.tut-ricomincia').onclick = () => lasciaPagina(null);
    }

    /** Esce dalla pagina (o la ricarica, con `url` nullo) senza la conferma di uscita del browser. */
    function lasciaPagina(url) {
        // La lezione non è una partita da difendere: lasciarla non deve
        // chiedere conferme del browser.
        window.onbeforeunload = null;
        if (window.DuelSession) DuelSession.finished = true;
        if (url) window.location.replace(url);
        else window.location.reload();
    }

    function vaiA(i) {
        passo = i;
        inizioPasso = Date.now();
        elCoach.classList.remove('tut-coach--fermo');
        if (passo >= PASSI.length) { spegni(); return; }
        const p = PASSI[passo];
        if (p.fine) {
            // Arrivati in fondo la lezione è fatta, anche se poi si chiude
            // la pagina invece di premere il pulsante.
            if (window.SaveManager) SaveManager.setTutorial({ lezioni: { [LEZIONE]: true } });
            elCoach.classList.add('tut-coach--fine');
        }
        aggiornaTesto();
    }

    function aggiornaTesto() {
        const p = PASSI[passo];
        if (!p) return;
        const pronto = !p.pronto || p.pronto();
        elCoach.querySelector('.tut-testo').textContent = (!pronto && p.attesa) ? p.attesa : p.testo;
        elCoach.querySelector('.tut-passo').textContent = p.fine ? '· ✓' : `· ${passo + 1}/${PASSI.length - (PASSI[PASSI.length - 1].fine ? 1 : 0)}`;
        const avanti = elCoach.querySelector('.tut-avanti');
        avanti.textContent = p.fine ? 'Torna alle lezioni ›' : 'Avanti ›';
        avanti.hidden = !((p.avanti || p.fine) && pronto);
        elCoach.querySelector('.tut-ricomincia').textContent = p.fine ? '↻ Rifalla' : '↻ Ricomincia';
    }

    function posiziona() {
        if (!attivo) return;
        const p = PASSI[passo];
        const el = p && p.bersaglio ? p.bersaglio() : null;
        const r = el && el.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) {
            const margine = 8;
            elSpot.style.left = (r.left - margine) + 'px';
            elSpot.style.top = (r.top - margine) + 'px';
            elSpot.style.width = (r.width + margine * 2) + 'px';
            elSpot.style.height = (r.height + margine * 2) + 'px';
            elSpot.classList.add('tut-spot--su');
            // Il nonno sta dalla parte opposta di ciò che indica, così non
            // lo copre mai.
            elCoach.classList.toggle('tut-coach--alto', r.top + r.height / 2 > window.innerHeight / 2);
        } else {
            elSpot.classList.remove('tut-spot--su');
            elCoach.classList.remove('tut-coach--alto');
        }
        requestAnimationFrame(posiziona);
    }

    function controlla() {
        if (!attivo) return;
        if (typeof gameState !== 'undefined' && gameState && gameState.gameOver) { spegni(); return; }
        const p = PASSI[passo];
        if (p && p.fine) return;
        if (p && p.fatto && p.fatto()) { vaiA(passo + 1); return; }
        aggiornaTesto();
        // Un passo fermo da molto: si offre il Ricomincia in evidenza.
        if (Date.now() - inizioPasso > TROPPO_TEMPO_MS) elCoach.classList.add('tut-coach--fermo');
    }

    // ------------------------------------------------------------------
    // Il cancello: un tocco fuori da ciò che il passo permette non arriva
    // al gioco. pointerdown ferma anche l'inizio di un trascinamento;
    // pointermove/pointerup restano liberi, così un trascinamento iniziato
    // su una carta permessa arriva fino in fondo.
    // ------------------------------------------------------------------
    function permesso(target) {
        if (!target || !target.closest) return true;
        if (target.closest('#tutorialCoach')) return true;
        // Leggere (e chiudere) la descrizione di una carta non è una mossa:
        // su telefono il pannello copre mezzo campo, e senza la sua ✕ si
        // resterebbe con il campo coperto.
        if (target.closest('.card-info-panel')) return true;
        // Nella lezione rifatta dal menu si può uscire: la finestra di resa
        // resta usabile.
        if (!obbligatoria && target.closest('#surrenderBtn, #surrenderModal')) return true;
        const p = PASSI[passo];
        const elenco = p && p.consenti ? p.consenti() : [];
        return elenco.some((sel) => target.closest(sel));
    }
    function cancello(e) {
        if (!attivo) return;
        if (permesso(e.target)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.type === 'pointerdown' && elCoach) {
            elCoach.classList.remove('tut-coach--scuoti');
            void elCoach.offsetWidth;
            elCoach.classList.add('tut-coach--scuoti');
        }
    }

    function accendi() {
        attivo = true;
        costruisci();
        window.addEventListener('pointerdown', cancello, true);
        window.addEventListener('click', cancello, true);
        vaiA(0);
        requestAnimationFrame(posiziona);
        setInterval(controlla, 200);
    }

    function spegni() {
        attivo = false;
        window.removeEventListener('pointerdown', cancello, true);
        window.removeEventListener('click', cancello, true);
        if (elCoach) elCoach.remove();
        if (elSpot) elSpot.remove();
    }

    // ------------------------------------------------------------------
    // Ingresso e uscita, chiamati da js/duel-session.js.
    // ------------------------------------------------------------------
    function avvia() {
        const t = window.SaveManager ? SaveManager.getTutorial() : { daFare: false, completata: false };
        // Obbligatoria è solo la prima lezione col nonno, e solo al primo avvio.
        obbligatoria = LEZIONE === 'nonno' && t.daFare && !t.completata;
        // Le battute automatiche dei duellanti parlerebbero sopra il nonno.
        // Ogni chiamata nel gioco è già protetta da `if (window.DuelDialogues)`.
        window.DuelDialogues = null;
        window.preparaManiIniziali = LEZIONI[LEZIONE].prepara;
        initGame();
        if (obbligatoria) {
            // Al primo avvio la lezione non si salta: niente Abbandona, e il
            // tasto Indietro di Android non apre la resa.
            const resa = document.getElementById('surrenderBtn');
            if (resa) resa.style.display = 'none';
            if (window.NativeBackButton) NativeBackButton.setHandler(() => true);
        }
        accendi();
    }

    /** Fine del duello: aggiorna la lezione nel salvataggio e torna le voci da mostrare. */
    function chiudi(vinto, abbandono) {
        spegni();
        if (!window.SaveManager) return [];
        // Una lezione breve si chiude dal suo pannello finale: arrivare qui
        // vuol dire che è stata abbandonata (o, per caso, vinta) a metà.
        // Non tocca mai lo stato della lezione col nonno.
        if (LEZIONE !== 'nonno') {
            return [{ nota: true, icon: '🔁', rule: 'Lezione interrotta: puoi rifarla quando vuoi dal menu Tutorial.' }];
        }
        if (!vinto) {
            return [{
                nota: true,
                icon: '🔁',
                rule: abbandono
                    ? 'Lezione interrotta: puoi rifarla quando vuoi da Duelli › Tutorial.'
                    : 'Lezione non completata: riprova, il nonno ti aspetta.'
            }];
        }
        const prima = SaveManager.getTutorial();
        SaveManager.setTutorial({ daFare: false, completata: true });
        if (prima.premiata) {
            return [{ nota: true, icon: '🎓', rule: 'Lezione completata di nuovo. Il premio della lezione si riceve solo la prima volta.' }];
        }
        SaveManager.addCurrency('credits', PREMIO_CREDITI);
        SaveManager.setTutorial({ premiata: true });
        return [{
            currency: 'credits',
            amount: PREMIO_CREDITI,
            icon: '💰',
            nome: 'Crediti',
            rule: 'Premio per la prima lezione col nonno completata: si riceve una volta sola.'
        }];
    }

    /**
     * Dove torna la schermata finale: al menu principale dopo la lezione
     * obbligatoria del primo avvio (è il punto in cui il gioco comincia
     * davvero), al menu Tutorial in ogni altro caso.
     */
    function urlRitorno() {
        return obbligatoria ? 'index.html' : MENU_TUTORIAL;
    }

    window.TutorialDuel = {
        avvia: avvia,
        chiudi: chiudi,
        urlRitorno: urlRitorno,
        lezione: LEZIONE,
        _passi: PASSI,
        _passo: () => passo
    };
})();
