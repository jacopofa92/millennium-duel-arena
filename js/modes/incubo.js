/**
 * incubo.js — il livello INCUBO dei Boss.
 * =====================================================================
 * duelMonstersCore.html?...&incubo=1   (Assalto al Boss in Multiplayer, "Contro un Boss" del Tag Team locale)
 *
 * Il Boss gioca il suo mazzo Difficile, ma "a copione". Due cose, entrambe fuori dal motore (solo ascolto di eventi e
 * chiamate pubbliche, mai sostituzioni di funzioni del motore):
 *
 *  1) MANO BILANCIATA. Prima delle pescate si riordina la cima del Mazzo del Boss (che il giocatore non vede), cosi' che la
 *     mano non sia quasi mai "morta": nella mano iniziale almeno due mostri che si possono Evocare senza Tributi e non piu' di
 *     due mostri pesanti; a campo (quasi) vuoto, se in mano non c'e' un mostro giocabile, la carta che sta per pescare lo e'.
 *     Una volta su `sbagliaPercento` la mano resta com'e': l'IA sbaglia ogni tanto, come chiunque.
 *
 *  2) LA CARTA EVENTO. Dal 3° turno DEL BOSS la sua carta simbolo puo' entrare in campo con una Special Summon
 *     (grido di Evocazione e animazione sono quelli di sempre, li fa ACTIONS.specialSummon): 40% al 3° turno, +10% a ogni
 *     turno. Se viene distrutta, la seconda comparsa riparte dal 10% (+10% a turno); dopo la seconda non torna piu'.
 *     Contro piu' giocatori (Tag 2 contro 1) le comparse sono due per ciascuno. Con una carta evento gia' in campo non ne
 *     esce un'altra. I numeri e le carte stanno in js/data/incubo-db.js.
 *     Slifer vale quanto le carte in mano: l'evento aspetta di averne 4 e, finche' Slifer resta in campo, il Boss le rimette a
 *     4 (pesca) all'inizio della Main Phase 1, della Battaglia e della End Phase. Ra entra con 4000 ATK senza pagare Life Point.
 *
 * I premi (+25%, Carte Locazione/Millennio una volta al giorno) li aggiunge Rewards.applicaIncubo, chiamata da duel-session.js.
 */
(function () {
    'use strict';

    const params = new URLSearchParams(window.location.search);
    const richiesto = params.get('incubo') === '1';
    const DB = () => window.incuboDatabase;

    /** I dati del Boss di questo duello (null se non ne ha: l'Incubo e' spento). */
    function datiBoss() {
        if (!richiesto || !DB()) return null;
        const id = (window.DuelSession && window.DuelSession.opponent && window.DuelSession.opponent.id) || params.get('character') || null;
        return (id && DB().boss[id]) || null;
    }

    /** Vero se questo duello e' un Incubo (letto da duel-session.js per i premi). */
    window.Incubo = { attivo: () => !!datiBoss() };
    if (!richiesto) return;

    // ------------------------------------------------------------------
    // Stato dell'evento (uno per duello)
    // ------------------------------------------------------------------
    const st = { turniBoss: 0, ultimoTurno: null, comparse: 0, viva: false, uid: null, prob: 0, ripresa: false, cartaId: null };

    const giocatoriDavanti = () => (params.get('mode') === 'tag' && params.get('boss') === '1' ? 2 : 1);
    const quota = () => DB().comparsePerGiocatore * giocatoriDavanti();
    const caso = () => Math.random();
    const mostro = (c) => c && c.type === 'monster' && !c.extraDeck;
    /** Si Evoca senza Tributi. */
    const leggero = (c) => mostro(c) && (c.level || 1) <= 4;
    /** Serve almeno un Tributo, e di solito due. */
    const pesante = (c) => mostro(c) && (c.level || 1) >= 6;
    const log = (m) => { if (typeof addToLog === 'function') addToLog(m); };

    // ------------------------------------------------------------------
    // 1) Mano bilanciata
    // ------------------------------------------------------------------
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

    /** Prima di OGNI pescata del Boss: niente turni senza una mossa giocabile. */
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

    // ------------------------------------------------------------------
    // 2) La carta evento
    // ------------------------------------------------------------------
    function slotLibero() {
        return (gameState.botMonsterField || []).findIndex((s) => !s);
    }

    function cartaInCampo() {
        return st.uid != null && (gameState.botMonsterField || []).some((s) => s && s.card && s.card.uid === st.uid);
    }

    /** Quale carta evoca adesso (id). Pegasus: Abbandono solo se c'e' un mostro forte da assorbire. */
    function scegliCarta(dati) {
        if (dati.scelta === 'conviene') {
            const [drago, assorbi] = dati.carte;
            const bersaglio = (gameState.playerMonsterField || []).filter((s) => s && s.card && !s.isFaceDown)
                .reduce((max, s) => Math.max(max, (window.DuelEngine && DuelEngine.getEffectiveAtk) ? DuelEngine.getEffectiveAtk(s.card) : (s.card.attack || 0)), 0);
            return bersaglio >= 2000 ? assorbi : drago;
        }
        return dati.carte[Math.floor(caso() * dati.carte.length)];
    }

    /** Pesca fino a `n` carte in mano, senza svuotare il Mazzo (Slifer vale quanto la mano). */
    function rimettiMano(n) {
        let guardia = 0;
        while ((gameState.botHand || []).length < n && (gameState.botDeck || []).length > 4 && guardia++ < n) {
            if (typeof drawCardsToHand === 'function') drawCardsToHand('bot', 1);
        }
        if (guardia > 0 && typeof updateUI === 'function') updateUI();
    }

    function tentaEvocazione(dati) {
        const idx = slotLibero();
        if (idx < 0) return false;
        // Slifer: vale quanto le carte in mano. Si evoca solo con la mano piena.
        if (dati.mano && (gameState.botHand || []).length < dati.mano) return false;
        const id = scegliCarta(dati);
        const modello = (typeof cardDatabase !== 'undefined' ? cardDatabase : []).find((c) => c.id === id);
        if (!modello || !window.DuelEngine) return false;
        const carta = Object.assign({}, modello, { uid: Date.now() + Math.random() });
        if (dati.atk4000 && dati.atk4000.indexOf(id) !== -1) carta.raPaidLp = 4000;   // Ra: 4000 ATK senza pagare Life Point
        const ctx = DuelEngine.makeContext('bot', {});
        const ok = ctx.specialSummon('bot', carta, idx, 'attack', 'token', { ignoreSummoningConditions: true, delayMs: 300 });
        if (!ok) return false;
        st.uid = carta.uid;
        st.viva = true;
        st.cartaId = id;
        st.comparse++;
        st.ripresa = false;
        log(`😈 INCUBO: ${carta.name} entra in campo!`);
        if (id === 416) usaAbbandono(carta);
        return true;
    }

    /** Abbandono assorbe il mostro piu' forte dell'avversario (il bersaglio lo sceglie il bot da solo). */
    function usaAbbandono(carta) {
        setTimeout(() => {
            try {
                const campo = gameState.botMonsterField || [];
                const i = campo.findIndex((s) => s && s.card && s.card.uid === carta.uid);
                if (i < 0 || gameState.gameOver) return;
                if (DuelEngine.canActivate('bot', 'monster', i)) DuelEngine.activateCard('bot', 'monster', i);
            } catch (e) { console.error('Incubo: Abbandono non attivato', e); }
        }, 3200);
    }

    /** Main Phase 1 del Boss: aggiorna i turni, vede se la carta e' caduta, tira i dadi. */
    function allaMainDelBoss() {
        const dati = datiBoss();
        if (!dati || gameState.gameOver) return;
        if (gameState.turn !== st.ultimoTurno) { st.ultimoTurno = gameState.turn; st.turniBoss++; }
        // Distrutta (o comunque sparita): la seconda comparsa riparte dal 10%.
        if (st.viva && !cartaInCampo()) { st.viva = false; st.uid = null; st.ripresa = true; st.prob = DB().probRipresa; }
        if (st.viva) { if (dati.mano) rimettiMano(dati.mano); return; }
        if (st.comparse >= quota() || st.turniBoss < DB().primoTurno) return;
        if (!st.ripresa && st.comparse === 0 && st.prob === 0) st.prob = DB().probPrima;
        if (caso() < st.prob && tentaEvocazione(dati)) { st.prob = 0; return; }
        st.prob = Math.min(1, st.prob + DB().passo);
    }

    // ------------------------------------------------------------------
    // Agganci (solo ascolto di eventi)
    // ------------------------------------------------------------------
    function installa() {
        if (typeof EventiDuello === 'undefined') return;
        // Un duello nuovo: la mano iniziale si sistema subito prima delle pescate (preparaManiIniziali).
        EventiDuello.ascolta('partita-azzerata', () => {
            Object.assign(st, { turniBoss: 0, ultimoTurno: null, comparse: 0, viva: false, uid: null, prob: 0, ripresa: false, cartaId: null });
            const originale = window.preparaManiIniziali;
            if (typeof originale !== 'function') return;
            window.preparaManiIniziali = function () {
                window.preparaManiIniziali = originale;   // una volta sola
                if (datiBoss()) sistemaManoIniziale();
                return originale.apply(this, arguments);
            };
        });
        EventiDuello.ascolta('inizio-turno', (posto) => {
            if (posto === 'bot' && datiBoss() && typeof gameState !== 'undefined' && gameState) sistemaPescata();
        });
        EventiDuello.ascolta('annuncio-fase', (titolo) => {
            if (typeof gameState === 'undefined' || !gameState || gameState.currentPlayer !== 'bot' || !datiBoss()) return;
            if (titolo === 'Main Phase 1') { allaMainDelBoss(); return; }
            // Slifer: la mano resta a 4 anche in Battaglia e a fine turno.
            const dati = datiBoss();
            if (st.viva && dati && dati.mano && (titolo === 'Battaglia' || titolo === 'Fine')) rimettiMano(dati.mano);
        });
    }
    installa();

    // Per i test e per chi vuole vedere lo stato.
    window.Incubo.stato = st;
    window.Incubo._sistemaManoIniziale = sistemaManoIniziale;
    window.Incubo._sistemaPescata = sistemaPescata;
})();
