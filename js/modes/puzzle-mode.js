// @ts-check
/**
 * puzzle-mode.js — Modalità Puzzle: "Vinci in questo turno".
 * =====================================================================
 * duelMonstersCore.html?mode=puzzle&puzzle=<id>&character=<avversario>
 *
 * COME UNA SANDBOX, NON COME UN PEZZO DEL MOTORE (stessa regola del
 * Tutorial, js/tutorial/tutorial-duel.js): il motore di Duel Monsters non
 * sa che i puzzle esistono e deve restare riusabile così com'è. Questo
 * file cambia soltanto la PREPARAZIONE del duello — prende il posto di
 * preparaManiIniziali(), lo stesso punto usato dal Tutorial e dalla
 * sandbox — e guarda dall'esterno com'è andata:
 *  - vinto: i Life Point dell'avversario arrivano a zero, cioè il duello
 *    finisce come qualunque duello vinto;
 *  - fallito: il turno passa all'avversario. Lo si vede leggendo lo stato
 *    (gameState.currentPlayer), e a quel punto si chiude il duello con
 *    endDuel(false), la stessa funzione pubblica usata da ogni sconfitta.
 *
 * Il contatore dei turni parte da 3 e non da 1: al primo turno di un
 * duello non si pesca e non si attacca, e un puzzle "vinci in questo
 * turno" senza attacchi non avrebbe senso. È un valore di partenza, come
 * i Life Point: nessuna regola viene cambiata.
 *
 * Stelle: ⭐⭐⭐ al primo tentativo, ⭐⭐ entro il terzo, ⭐ dopo. Contano i
 * tentativi perché un puzzle ha quasi sempre una sola idea giusta: il
 * merito è trovarla presto, non usare meno carte.
 *
 * Premi: solo crediti, e solo la prima volta che un puzzle viene risolto
 * (richiesta dell'utente: per ora nessun premio speciale di modalità).
 */
(function () {
    'use strict';

    const params = new URLSearchParams(window.location.search);
    if ((params.get('mode') || '').toLowerCase() !== 'puzzle') return;

    const DIAN_KETO = 546;              // pescata innocua di default (cura, nessun danno)
    const RIEMPITIVI = [526, 528, 526, 528, 526, 528, 526, 528];
    const TURNO_DI_PARTENZA = 3;

    /** @returns {PuzzleDef | null} il puzzle chiesto dall'URL (?puzzle=), null se non esiste. */
    function trovaPuzzle() {
        const elenco = (typeof puzzlesDatabase !== 'undefined') ? puzzlesDatabase : [];
        return elenco.find((p) => p.id === params.get('puzzle')) || null;
    }

    let uid = 0;
    /** Una copia della carta del catalogo, con un uid suo. @param {number} id @returns {Card | null} */
    function istanzia(id) {
        const modello = typeof cardDatabase !== 'undefined' && cardDatabase.find((c) => c.id === id);
        if (!modello) return null;
        uid++;
        return Object.assign({}, modello, { uid: 'puzzle-' + uid + '-' + id });
    }
    /** @param {number[] | undefined} ids @returns {Card[]} */
    const carte = (ids) => (ids || []).map(istanzia).filter(Boolean);

    /** @param {[number, PosizionePuzzle]} voce @returns {MonsterSlot | null} */
    function slotMostro(voce) {
        const card = istanzia(voce[0]);
        if (!card) return null;
        const coperto = voce[1] === 'coperto';
        return {
            card: card,
            position: (coperto || voce[1] === 'difesa') ? 'defense' : 'attack',
            isFaceDown: coperto,
            hasAttacked: false,
            canChangePosition: true
        };
    }
    /** @param {[number, StatoMagiaPuzzle]} voce @returns {SpellTrapSlot | null} */
    function slotMagiaTrappola(voce) {
        const card = istanzia(voce[0]);
        // setOnTurn 0: piazzata "in un turno passato", quindi già attivabile.
        return card ? { card: card, isFaceDown: voce[1] !== 'scoperta', setOnTurn: 0 } : null;
    }

    /** @param {Owner} posto @param {LatoPuzzle} lato */
    function mettiInCampo(posto, lato) {
        (lato.mostri || []).forEach((v, i) => { gameState[Tavolo.chiave(posto, 'MonsterField')][i] = slotMostro(v); });
        (lato.magieTrappole || []).forEach((v, i) => { gameState[Tavolo.chiave(posto, 'STField')][i] = slotMagiaTrappola(v); });
        gameState[Tavolo.chiave(posto, 'Graveyard')] = carte(lato.cimitero);
        gameState[Tavolo.chiave(posto, 'ExtraDeck')] = carte(lato.extra);
    }

    /** Prende il posto di preparaManiIniziali() (js/engine/game-flow.js) per questo duello. */
    function preparaPuzzle() {
        const p = trovaPuzzle();
        gameState.currentPlayer = 'player';
        gameState.turn = TURNO_DI_PARTENZA;
        gameState.playerHand = carte(p.mano);
        gameState.botHand = carte((p.avversario || {}).mano);
        mettiInCampo('player', p);
        mettiInCampo('bot', p.avversario || {});
        // Il mazzo si pesca dalla FINE: la pescata del turno va in fondo
        // all'elenco, sopra a una pila di riempitivi che nessuno pescherà
        // (il turno dell'avversario non arriva mai).
        const mazzo = carte(RIEMPITIVI.concat([p.pescata || DIAN_KETO]));
        gameState[Tavolo.chiave('player', 'Deck')] = mazzo;
        gameState[Tavolo.chiave('player', 'DeckCount')] = mazzo.length;
        const mazzoAvversario = carte(RIEMPITIVI);
        gameState[Tavolo.chiave('bot', 'Deck')] = mazzoAvversario;
        gameState[Tavolo.chiave('bot', 'DeckCount')] = mazzoAvversario.length;
        gameState.playerLP = p.lp || 8000;
        gameState.botLP = p.lpAvversario || 8000;
    }

    // ------------------------------------------------------------------
    // Salvataggio: { [puzzleId]: { tentativi, risolto, stelle } }.
    // ------------------------------------------------------------------
    /** @returns {{ [id: string]: StatoPuzzle }} */
    function statoPuzzle() {
        return (window.SaveManager && SaveManager.getModeState('puzzle')) || {};
    }
    /** @param {string} id @param {Partial<StatoPuzzle>} campi */
    function salvaPuzzle(id, campi) {
        if (!window.SaveManager) return;
        const tutto = statoPuzzle();
        tutto[id] = Object.assign({ tentativi: 0, risolto: false, stelle: 0 }, tutto[id] || {}, campi);
        SaveManager.setModeState('puzzle', tutto);
    }
    /** @param {number} tentativi @returns {number} */
    const stelleDa = (tentativi) => (tentativi <= 1 ? 3 : (tentativi <= 3 ? 2 : 1));

    // ------------------------------------------------------------------
    // Il riquadro dell'obiettivo, sempre a portata durante il puzzle.
    // ------------------------------------------------------------------
    /** @param {PuzzleDef} p @returns {HTMLElement} */
    function costruisciRiquadro(p) {
        const el = document.createElement('div');
        el.className = 'pz-obiettivo';
        el.id = 'puzzleObiettivo';
        el.innerHTML = `
            <button type="button" class="pz-chip" aria-expanded="false">🧩 <span class="pz-chip-testo"></span></button>
            <div class="pz-pannello" hidden>
                <div class="pz-titolo"></div>
                <p class="pz-desc"></p>
                <p class="pz-indizio" hidden></p>
                <div class="pz-azioni">
                    <button type="button" class="pz-btn pz-btn-indizio">💡 Indizio</button>
                    <button type="button" class="pz-btn pz-btn-riprova">↻ Riprova</button>
                </div>
            </div>`;
        /** @param {string} sel @returns {HTMLElement} */
        const trova = (sel) => /** @type {HTMLElement} */ (el.querySelector(sel));
        trova('.pz-chip-testo').textContent = 'Vinci in questo turno';
        trova('.pz-titolo').textContent = p.titolo;
        trova('.pz-desc').textContent = p.descrizione;
        trova('.pz-indizio').textContent = p.suggerimento || '';
        const chip = trova('.pz-chip');
        const pannello = trova('.pz-pannello');
        chip.onclick = () => {
            pannello.hidden = !pannello.hidden;
            chip.setAttribute('aria-expanded', String(!pannello.hidden));
        };
        trova('.pz-btn-indizio').onclick = () => {
            trova('.pz-indizio').hidden = false;
            trova('.pz-btn-indizio').remove();
        };
        trova('.pz-btn-riprova').onclick = () => {
            // Ricominciare non è una fuga da un duello vero: niente conferma.
            window.onbeforeunload = null;
            if (window.DuelSession) DuelSession.finished = true;
            window.location.reload();
        };
        document.body.appendChild(el);
        // Aperto all'inizio, così l'obiettivo si legge subito; al primo
        // tocco fuori dal riquadro si richiude da solo, perché aperto copre
        // una parte del campo. Resta il pulsante per riaprirlo.
        pannello.hidden = false;
        chip.setAttribute('aria-expanded', 'true');
        /** @param {PointerEvent} e */
        const chiudiSeFuori = (e) => {
            if (el.contains(/** @type {Node} */ (e.target))) return;
            pannello.hidden = true;
            chip.setAttribute('aria-expanded', 'false');
        };
        document.addEventListener('pointerdown', chiudiSeFuori, true);
        return el;
    }

    /** @type {HTMLElement | null} */
    let riquadro = null;
    /** @type {ReturnType<typeof setInterval> | undefined} */
    let sorveglianza;

    /** Il turno è passato all'avversario: il puzzle è fallito. */
    function sorveglia() {
        if (typeof gameState === 'undefined' || !gameState) return;
        if (gameState.gameOver) { clearInterval(sorveglianza); return; }
        if (gameState.currentPlayer === 'bot') {
            clearInterval(sorveglianza);
            if (typeof endDuel === 'function') endDuel(false, { puzzleFallito: true });
        }
    }

    function avvia() {
        const p = trovaPuzzle();
        if (!p) {
            // Puzzle inesistente (link vecchio o sbagliato): si torna all'elenco.
            window.location.replace('puzzle.html');
            return;
        }
        salvaPuzzle(p.id, { tentativi: ((statoPuzzle()[p.id] || {}).tentativi || 0) + 1 });
        // Le battute automatiche dei duellanti non servono a un puzzle.
        window.DuelDialogues = null;
        window.preparaManiIniziali = preparaPuzzle;
        initGame();
        riquadro = costruisciRiquadro(p);
        sorveglianza = setInterval(sorveglia, 150);
    }

    /**
     * Fine del duello (chiamata da duel-session.js): stelle, tentativi, Sfide
     * e i crediti della prima soluzione.
     * @param {boolean} vinto @param {boolean} abbandono @returns {VoceEsito[]}
     */
    function chiudi(vinto, abbandono) {
        clearInterval(sorveglianza);
        if (riquadro) riquadro.remove();
        const p = trovaPuzzle();
        if (!p) return [];
        if (!vinto) {
            return [{
                nota: true,
                icon: '🔁',
                rule: abbandono
                    ? 'Puzzle abbandonato: puoi riprovarlo quando vuoi dalla schermata Puzzle.'
                    : 'Puzzle non risolto: il turno è passato all\'avversario. Riprova, la situazione resta la stessa.'
            }];
        }
        const prima = statoPuzzle()[p.id] || { tentativi: 1, risolto: false, stelle: 0 };
        const stelle = Math.max(prima.stelle || 0, stelleDa(prima.tentativi || 1));
        salvaPuzzle(p.id, { risolto: true, stelle: stelle });
        /** @type {VoceEsito[]} */
        const voci = [{
            nota: true,
            icon: '⭐',
            rule: `${'⭐'.repeat(stelle)} — risolto al tentativo n. ${prima.tentativi || 1}. Tre stelle al primo tentativo, due entro il terzo.`
        }];
        if (window.ChallengeTracker) {
            if (!prima.risolto) ChallengeTracker.recordProgress('puzzleSolved', { puzzleId: p.id });
            if (stelle === 3 && (prima.stelle || 0) < 3) ChallengeTracker.recordProgress('puzzleThreeStars', { puzzleId: p.id });
        }
        if (!prima.risolto && window.SaveManager) {
            // La formula vive in Rewards.puzzleCrediti (la stessa che la pagina Puzzle mostra al giocatore).
            const crediti = Rewards.puzzleCrediti(p.difficolta);
            SaveManager.addCurrency('credits', crediti);
            voci.push({
                currency: 'credits',
                amount: crediti,
                icon: '💰',
                nome: 'Crediti',
                rule: 'Premio per aver risolto questo puzzle la prima volta (più è difficile, più vale). Rifarlo non paga di nuovo.'
            });
        }
        return voci;
    }

    window.ModalitaDuello = window.ModalitaDuello || {};
    /** @type {ModalitaDuello} */
    const modalita = {
        urlRitorno: 'puzzle.html',
        esclusiva: true,
        senzaDialoghi: true,
        // Comincia sempre il giocatore: è il suo turno da risolvere.
        chiComincia: () => 'player',
        avvia: avvia,
        chiudi: chiudi
    };
    window.ModalitaDuello.puzzle = modalita;
})();
