/**
 * evidenzia-giocabili.js — l'ALONE attorno alle carte che puoi giocare adesso, e le caselle che si "accendono" (stile Master Duel).
 * =====================================================================================================================
 * Solo lettura dello stato: NESSUNA regola vive qui. Ogni controllo riusa la funzione che il motore gia' usa per decidere se la
 * mossa e' legale (DuelEngine.canActivate, canSpecialSummonFromHand, normalSummonBlockReason, canUseNormalSummonQuota...), quindi
 * l'alone e' sempre d'accordo col gioco: se un domani cambia una regola, cambia anche l'alone.
 *
 * COLORI
 *   bianco  : mostro in mano che puoi Evocare/Settare ora (Evocazione Normale, Tributo o Special Summon dalla mano)
 *   verde   : carta con un EFFETTO attivabile ora (Magia in mano, Magia/Trappola Set, effetto di un mostro sul Terreno)
 *   arancio : mostro sul Terreno che puo' attaccare (solo in Battle Phase)
 *   viola   : l'Extra Deck con una Fusione evocabile senza Polimerizzazione (gia' disegnato da game-flow.js, .fusion-ready)
 * In piu': le caselle Mostro libere "respirano" quando hai un mostro da Evocare, e un anello di luce parte dalla casella in cui
 * atterra una carta (di entrambi i lati, anche per un Set: in quel caso neutro, per non rivelare cosa sia).
 *
 * IMPOSTAZIONE: Impostazioni > Regole di gioco > "Evidenzia le carte giocabili" (SaveManager 'evidenziaGiocabili', default acceso).
 * Spenta, non si disegna niente e <html> prende la classe `evidenzia-off`, che spegne anche il viola dell'Extra Deck.
 *
 * COME SI APPLICA: alla carta VIVA a schermo, dopo ogni ridisegno (ridisegnaDuello in game-flow.js). Le firme con cui il Terreno e
 * la mano decidono se sostituire un nodo sono salvate alla sua creazione (__renderSignature), quindi un'aggiunta fatta qui non fa
 * sembrare "cambiata" una carta e non costringe a ricostruirla. Il battito e' una Web Animation su box-shadow: non sostituisce le
 * animazioni CSS della carta (pesca, attacco...), che restano com'erano.
 */
(function () {
    'use strict';

    const COLORI = { bianco: '255,255,255', verde: '84,255,142', attacco: '255,140,72' };
    const CLASSI = ['glow-giocabile', 'glow-bianco', 'glow-verde', 'glow-attacco'];
    /** Quali caselle avevano una carta all'ultimo ridisegno, per accorgersi di un atterraggio: 'player:monster:2' -> uid. */
    let caselleViste = null;

    function attivo() {
        try { return !(window.SaveManager && SaveManager.getSetting('evidenziaGiocabili') === false); } catch (e) { return true; }
    }
    function movimentoRidotto() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    /** Il battito animato solo con Dettagli video "Alti"; altrimenti l'alone resta fermo (costo zero). */
    function animazioniAttive() {
        if (movimentoRidotto()) return false;
        try { return !window.VideoQuality || typeof VideoQuality.isAlti !== 'function' || VideoQuality.isAlti(); } catch (e) { return true; }
    }

    function giocatoreAgisce() {
        if (typeof gameState === 'undefined' || !gameState || gameState.gameOver || !gameState.playerHand) return false;
        if (new URLSearchParams(window.location.search).get('mode') === 'tutorial') return false;   // la lezione guida da sola con il suo riflettore
        if (gameState.currentPlayer !== 'player') return false;
        if (window.Tavolo && typeof Tavolo.ePersona === 'function' && !Tavolo.ePersona('player')) return false;
        const E = window.DuelEngine;
        if (!E) return false;
        if (E.isChainActive() || (E.isPriorityWindowOpen && E.isPriorityWindowOpen())) return false;
        if (typeof isBlockingModalOpen === 'function' && isBlockingModalOpen()) return false;
        if (gameState.pendingTributeSummon || gameState.pendingHandDiscard) return false;
        return true;
    }

    /** Il mostro in mano si puo' giocare ora? Evocazione Normale/Tributo (stesse condizioni di attemptMonsterSummon) o Special Summon dalla mano. */
    function mostroGiocabile(card, indice) {
        const E = window.DuelEngine;
        if (card.type !== 'monster') return false;
        try { if (E.canSpecialSummonFromHand && E.canSpecialSummonFromHand('player', indice)) return true; } catch (e) { /* carta con condizione che lancia: non si evidenzia */ }
        if (card.extraDeck) return false;
        if (typeof canUseNormalSummonQuota === 'function' && !canUseNormalSummonQuota('player', card)) return false;
        if (gameState.otherMonsterSummonsBlockedFor && gameState.otherMonsterSummonsBlockedFor.player && card.id !== 282) return false;
        if (E.normalSummonBlockReason && E.normalSummonBlockReason('player', card)) return false;
        const def = E.getDefinition(card.id);
        if (def && typeof def.beginCustomNormalSummon === 'function') return true;   // procedura propria (es. Ra - Modalita' Sfera): la decide la carta
        if (def && def.requiresFieldPresenceId && window.AI_SHARED && AI_SHARED.canNormalSummonNow && !AI_SHARED.canNormalSummonNow(card, gameState, 'player')) return false;
        const campo = gameState.playerMonsterField || [];
        const occupati = campo.filter(Boolean).length;
        const eccezione = (card.id === 711 && gameState.playerHand.length === 1) || (card._noTributeThisTurn === gameState.turn);
        const tributi = eccezione || typeof getTributesRequired !== 'function' ? 0 : getTributesRequired(card);
        if (tributi > 0) return !gameState.tributesBlocked && occupati >= tributi;
        return occupati < campo.length;
    }

    function puoAttaccare(slot, indice) {
        const E = window.DuelEngine;
        if (!slot || slot.isFaceDown || slot.position !== 'attack' || slot.hasAttacked) return false;
        const uid = slot.card.uid;
        if (E.cannotAttack('player')) return false;
        if (gameState.cannotAttackUidsThisTurn && gameState.cannotAttackUidsThisTurn.has(uid)) return false;
        if (gameState.cannotAttackUids && gameState.cannotAttackUids[uid]) return false;
        if (gameState.cannotAttackUidsPermanent && gameState.cannotAttackUidsPermanent.has(uid)) return false;
        if (gameState.attackLockedUntilTurn && gameState.attackLockedUntilTurn[uid] === gameState.turn) return false;
        const def = E.getDefinition(slot.card.id);
        if (def && typeof def.canDeclareAttack === 'function' && !def.canDeclareAttack(E.makeContext('player', { card: slot.card, slotIndex: indice }))) return false;
        return true;
    }

    /** uid -> 'bianco' | 'verde' | 'attacco' per le carte del giocatore, e se c'e' un mostro da Evocare su una casella libera. */
    function calcola() {
        const E = window.DuelEngine;
        const mappa = new Map();
        let evocabileLibero = false;
        const fase = gameState.phase;
        const main = fase === 'main1' || fase === 'main2';
        const battaglia = fase === 'battle';
        if (!main && !battaglia) return { mappa: mappa, evocabileLibero: false };

        gameState.playerHand.forEach((card, i) => {
            if (!card || card.type === 'trap') return;
            const rapida = card.type === 'spell' && card.subtype === 'quick-play';
            if (!main && !rapida) return;
            let verde = false;
            try { verde = E.canActivate('player', 'hand', i); } catch (e) { verde = false; }
            if (verde) { mappa.set(card.uid, 'verde'); return; }
            if (main && mostroGiocabile(card, i)) {
                mappa.set(card.uid, 'bianco');
                const def = E.getDefinition(card.id);
                const senzaTributi = typeof getTributesRequired !== 'function' || getTributesRequired(card) === 0;
                if (senzaTributi || (def && typeof def.canSpecialSummonFromHand === 'function')) evocabileLibero = true;
            }
        });

        if (main) {
            (gameState.playerMonsterField || []).forEach((slot, i) => {
                if (!slot || slot.isFaceDown) return;
                const def = E.getDefinition(slot.card.id);
                if (def && typeof def.activate === 'function' && E.canActivate('player', 'monster', i)) mappa.set(slot.card.uid, 'verde');
            });
        }
        (gameState.playerSTField || []).forEach((slot, i) => {
            if (!slot) return;
            const card = slot.card;
            const quando = card.type === 'trap' || card.subtype === 'quick-play';
            if (!(main || (battaglia && quando))) return;
            let ok = false;
            try { ok = E.canActivate('player', 'st', i); } catch (e) { ok = false; }
            if (ok) mappa.set(card.uid, 'verde');
        });
        const terreno = gameState.playerFieldSpell;
        if (main && terreno && terreno.isFaceDown) {
            let ok = false;
            try { ok = E.canActivate('player', 'fieldSpell', -1); } catch (e) { ok = false; }
            if (ok) mappa.set(terreno.card.uid, 'verde');
        }
        if (battaglia) {
            (gameState.playerMonsterField || []).forEach((slot, i) => {
                if (puoAttaccare(slot, i)) mappa.set(slot.card.uid, 'attacco');
            });
        }
        return { mappa: mappa, evocabileLibero: evocabileLibero };
    }

    function trova(uid) {
        const el = document.querySelector(`#playerHand [data-uid="${uid}"], #playerFieldBoard [data-uid="${uid}"]`);
        return el ? (el.classList.contains('card') ? el : el.closest('.card')) : null;
    }

    function tolgi(el) {
        CLASSI.forEach((c) => el.classList.remove(c));
        if (el.__glowAnim) { try { el.__glowAnim.cancel(); } catch (e) { /* gia' finita */ } el.__glowAnim = null; }
        el.__glowTipo = null;
    }

    function metti(el, tipo) {
        if (el.__glowTipo === tipo && el.classList.contains('glow-giocabile')) return;   // gia' a posto: non si riparte da capo
        tolgi(el);
        el.classList.add('glow-giocabile', 'glow-' + tipo);
        el.__glowTipo = tipo;
        if (animazioniAttive() && el.animate) {
            const c = COLORI[tipo];
            el.__glowAnim = el.animate([
                { boxShadow: `0 0 0 1.5px rgba(${c},.85), 0 0 8px 1px rgba(${c},.55), 0 0 16px 3px rgba(${c},.28)` },
                { boxShadow: `0 0 0 2px rgba(${c},1), 0 0 14px 3px rgba(${c},.8), 0 0 28px 8px rgba(${c},.45)` }
            ], { duration: 1500, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
        }
    }

    function sweep(daTenere, selettore, rimuovi) {
        document.querySelectorAll(selettore).forEach((el) => { if (!daTenere.has(el)) rimuovi(el); });
    }

    function aggiornaCaselleLibere(attiva) {
        const tenere = new Set();
        if (attiva) {
            document.querySelectorAll('#playerFieldBoard .field-slot[data-type="monster"]').forEach((slot) => {
                if (slot.querySelector('.card')) return;
                tenere.add(slot);
                slot.classList.add('slot-libera');
            });
        }
        sweep(tenere, '.slot-libera', (el) => el.classList.remove('slot-libera'));
    }

    /** Un anello di luce parte dalla casella in cui una carta e' appena atterrata. Neutro per una carta coperta (non dice cosa sia). */
    function anelliDiAtterraggio() {
        const ora = new Map();
        [['player', 'Mostro'], ['bot', 'Mostro']].forEach(([owner]) => {
            const tavolo = window.Tavolo;
            if (!tavolo) return;
            [['monster', tavolo.mostri(owner)], ['st', tavolo.magieTrappole(owner)]].forEach(([tipo, campo]) => {
                (campo || []).forEach((slot, i) => { ora.set(`${owner}:${tipo}:${i}`, slot && slot.card ? { uid: slot.card.uid, slot: slot } : null); });
            });
        });
        if (caselleViste && animazioniAttive()) {
            ora.forEach((dati, chiave) => {
                if (!dati) return;
                const prima = caselleViste.get(chiave);
                if (prima && prima.uid === dati.uid) return;
                const [owner, tipo, indice] = chiave.split(':');
                const tavolo = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
                const casella = document.querySelector(`#${tavolo} .field-slot[data-owner="${owner}"][data-type="${tipo}"][data-index="${indice}"]`);
                if (!casella || !casella.animate) return;
                const coperta = dati.slot.isFaceDown;
                const c = coperta ? '170,170,190' : (dati.slot.card.type === 'spell' ? '84,255,142' : dati.slot.card.type === 'trap' ? '230,90,200' : '255,226,140');
                casella.animate([
                    { boxShadow: `0 0 0 0 rgba(${c},.85), 0 0 18px 4px rgba(${c},.55)` },
                    { boxShadow: `0 0 0 22px rgba(${c},0), 0 0 30px 14px rgba(${c},0)` }
                ], { duration: 720, easing: 'ease-out' });
            });
        }
        caselleViste = ora;
    }

    function aggiorna() {
        const attiva = attivo();
        document.documentElement.classList.toggle('evidenzia-off', !attiva);
        if (!attiva || typeof gameState === 'undefined' || !gameState) {
            document.querySelectorAll('.glow-giocabile').forEach(tolgi);
            aggiornaCaselleLibere(false);
            return;
        }
        anelliDiAtterraggio();
        if (!giocatoreAgisce()) {
            document.querySelectorAll('.glow-giocabile').forEach(tolgi);
            aggiornaCaselleLibere(false);
            return;
        }
        let r;
        try { r = calcola(); } catch (e) { r = { mappa: new Map(), evocabileLibero: false }; }
        const tenere = new Set();
        r.mappa.forEach((tipo, uid) => {
            const el = trova(uid);
            if (!el) return;
            tenere.add(el);
            metti(el, tipo);
        });
        sweep(tenere, '.glow-giocabile', tolgi);
        aggiornaCaselleLibere(r.evocabileLibero);
    }

    window.EvidenziaGiocabili = { aggiorna: aggiorna, calcola: () => (typeof gameState !== 'undefined' && gameState && giocatoreAgisce() ? calcola() : { mappa: new Map(), evocabileLibero: false }) };
})();
