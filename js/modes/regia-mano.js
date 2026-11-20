/**
 * regia-mano.js — la REGIA DELLA MANO dei Duellanti Difficili (1.9.11).
 * =====================================================================
 * Perche' esiste: in js/data/character-decks.js (RITOCCHI_MENO_DISTRUZIONE) molti mazzi Difficile hanno perso Armatura
 * Sakuretsu e/o Cilindro Magico, le trappole che distruggono o rimandano il danno e che davano frustrazione e ripetitivita'.
 * Senza altro il Difficile sarebbe diventato piu' facile (circa +2,6 punti di vittorie del giocatore su 61 Duellanti); la
 * regia della mano rimette la differenza, e la RIDUCE a zero in media (misura: 17 deck giocatore x 61 duellanti x 50 duelli,
 * semi nuovi, vittorie del giocatore 30,8% -> 30,4%). Tolta la regia, quei mazzi tornano piu' facili: non e' un extra.
 *
 * Cosa fa — la stessa idea del livello Incubo (js/modes/incubo.js), con gli stessi numeri e gli stessi agganci:
 *  - prima delle mani iniziali riordina la cima del Mazzo del bot (che il giocatore non vede) perche' nella mano ci siano
 *    almeno due mostri Evocabili senza Tributi e non piu' di due mostri pesanti;
 *  - prima di ogni pescata, a campo (quasi) vuoto e senza un mostro giocabile in mano, porta in cima uno che lo e';
 *    con tre o piu' mostri pesanti in mano evita di darne un altro.
 * Una volta su `sbagliaPercento` non interviene: l'IA sbaglia ogni tanto, come chiunque.
 *
 * Quando e' attiva (tutte insieme):
 *  - il Duellante e' nella lista di js/data/regia-mano-db.js (solo quelli MISURATI: per alcuni mazzi la regia sposta la
 *    difficolta' di molto, aggiungerne uno senza rimisurare puo' renderlo piu' duro o piu' facile del dovuto);
 *  - il duello e' contro l'IA Difficile in modalita' Duello Libero, Storia o Torneo (mai Tag, Torre, Caccia, Puzzle, Rivincita,
 *    Settimana, Tutorial);
 *  - NON e' un duello Multiplayer: i due client devono costruire lo stesso mazzo, e per ora la regia li riordinerebbe a modo
 *    suo. Il Multiplayer con posto IA gioca quindi i mazzi nuovi SENZA regia (un po' piu' facili per quei Duellanti);
 *  - non e' attivo l'Incubo, che ha gia' la sua regia.
 *
 * Fuori dal motore (regola di progetto, sorvegliata da guardrail-modalita-fuori-dal-motore): solo ascolto di eventi
 * (`partita-azzerata`, `inizio-turno`) e sostituzione una tantum del punto di aggancio previsto (preparaManiIniziali).
 * La casualita' di gioco passa da Casuale (mai Math.random nelle regole).
 */
(function () {
    'use strict';

    const DB = () => window.regiaManoDatabase;
    /** Le modalita' in cui la regia puo' girare. Senza `location` (i duelli senza testa degli strumenti) vale come Duello Libero. */
    const MODALITA = ['free', 'story', 'tournament'];

    function modalita() {
        try {
            const params = new URLSearchParams(window.location.search);
            // Un duello in coppia della Storia e' ?mode=story con tag=1 (js/story/story-progress.js: urlDuello): e' un Tag Team, non ci va.
            if (params.get('tag') === '1') return 'tag';
            return (params.get('mode') || '').toLowerCase();
        } catch (e) { return 'free'; }
    }

    /** Vero se, in QUESTO duello, il bot ha la regia della mano. */
    function attiva() {
        const db = DB();
        if (!db || window.MULTIPLAYER_MODE) return false;
        if (window.Incubo && typeof window.Incubo.attivo === 'function' && window.Incubo.attivo()) return false;
        if (typeof gameState === 'undefined' || !gameState || gameState.botDifficulty !== 'hard') return false;
        const id = window.DuelSession && window.DuelSession.opponent ? window.DuelSession.opponent.id : null;
        if (!id || db.duellanti.indexOf(id) === -1) return false;
        return MODALITA.indexOf(modalita()) !== -1;
    }

    const caso = () => (window.Casuale ? window.Casuale.random() : Math.random());
    const mostro = (c) => c && c.type === 'monster' && !c.extraDeck;
    /** Si Evoca senza Tributi. */
    const leggero = (c) => mostro(c) && (c.level || 1) <= 4;
    /** Serve almeno un Tributo, e di solito due. */
    const pesante = (c) => mostro(c) && (c.level || 1) >= 6;

    function scambia(mazzo, i, j) { const t = mazzo[i]; mazzo[i] = mazzo[j]; mazzo[j] = t; }

    /** Porta in cima al Mazzo (la fine dell'array: si pesca con pop) la prima carta che soddisfa `vuole`. */
    function portaInCima(mazzo, vuole) {
        for (let i = mazzo.length - 2; i >= 0; i--) {
            if (vuole(mazzo[i])) { scambia(mazzo, i, mazzo.length - 1); return true; }
        }
        return false;
    }

    /** Prima delle mani iniziali: almeno due mostri giocabili e non piu' di due pesanti fra le prime carte. */
    function sistemaManoIniziale() {
        const mazzo = gameState && gameState.botDeck;
        if (!Array.isArray(mazzo) || mazzo.length < 12) return;
        if (caso() * 100 < DB().sbagliaPercento) return;
        const N = 6;   // 5 della mano + la carta in piu' di chi comincia
        for (let giro = 0; giro < 12; giro++) {
            const cima = mazzo.slice(-N);
            const leggeri = cima.filter(leggero).length;
            const pesanti = cima.filter(pesante).length;
            if (leggeri >= 2 && pesanti <= 2) return;
            const corpo = mazzo.length - N;   // le carte sotto la mano
            if (leggeri < 2) {
                const giu = mazzo.findIndex((c, i) => i < corpo && leggero(c));
                let su = -1;
                for (let i = mazzo.length - 1; i >= corpo; i--) if (pesante(mazzo[i])) { su = i; break; }
                if (su < 0) for (let i = mazzo.length - 1; i >= corpo; i--) if (!leggero(mazzo[i])) { su = i; break; }
                if (giu < 0 || su < 0) return;
                scambia(mazzo, giu, su);
            } else {
                let su = -1;
                for (let i = mazzo.length - 1; i >= corpo; i--) if (pesante(mazzo[i])) { su = i; break; }
                let giu = mazzo.findIndex((c, i) => i < corpo && leggero(c));
                if (giu < 0) giu = mazzo.findIndex((c, i) => i < corpo && !pesante(c));
                if (giu < 0 || su < 0) return;
                scambia(mazzo, giu, su);
            }
        }
    }

    /** Prima della pescata del bot: niente turni senza una mossa giocabile. */
    function sistemaPescata() {
        const mazzo = gameState.botDeck;
        if (!Array.isArray(mazzo) || mazzo.length < 2) return;
        if (caso() * 100 < DB().sbagliaPercento) return;
        const mano = gameState.botHand || [];
        const inCampo = (gameState.botMonsterField || []).filter(Boolean).length;
        const cima = mazzo[mazzo.length - 1];
        if (inCampo <= 1 && !mano.some(leggero) && !leggero(cima)) portaInCima(mazzo, leggero);
        else if (mano.filter(pesante).length >= 3 && pesante(cima)) portaInCima(mazzo, (c) => !pesante(c));
    }

    function installa() {
        if (typeof EventiDuello === 'undefined') return;
        // Un duello nuovo: la mano iniziale si sistema subito prima delle pescate (preparaManiIniziali), una volta sola.
        EventiDuello.ascolta('partita-azzerata', () => {
            const originale = window.preparaManiIniziali;
            if (typeof originale !== 'function') return;
            window.preparaManiIniziali = function () {
                window.preparaManiIniziali = originale;
                if (attiva()) sistemaManoIniziale();
                return originale.apply(this, arguments);
            };
        });
        // 'inizio-turno' arriva PRIMA della pescata del turno (vedi eventi-duello.js).
        EventiDuello.ascolta('inizio-turno', (posto) => {
            if (posto === 'bot' && attiva()) sistemaPescata();
        });
    }
    installa();

    // Per i test, per gli strumenti senza testa e per chi vuole vedere lo stato.
    window.RegiaMano = { attiva, _sistemaManoIniziale: sistemaManoIniziale, _sistemaPescata: sistemaPescata };
})();
