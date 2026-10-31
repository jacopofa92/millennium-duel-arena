// @ts-check
/**
 * tag.js — le regole della variante Tag Team (2 contro 1, poi 2 contro 2).
 * =====================================================================
 * Piano e decisioni: docs/planning/PIANO_TAG_TEAM.md. Qui NON c'è
 * interfaccia (quella sta in tag-mode.js): solo lo stato delle squadre e lo
 * scambio dei membri, così le stesse regole girano anche nel duello senza
 * testa.
 *
 * L'idea in una riga: un LATO resta un posto solo del motore ('player' o
 * 'bot'), ma dietro ci sono due MEMBRI. Il motore vede sempre il membro
 * "davanti": la sua mano, il suo Mazzo, il suo campo e (con D1 "per membro")
 * i suoi Life Point stanno nelle solite proprietà di gameState. Allo scambio
 * la variante mette da parte quelle del membro che esce e ci rimette quelle
 * del membro che entra. Il motore non sa che esistono i membri.
 *
 * Cosa resta del LATO e non si scambia mai:
 *  - il Cimitero (D3): il suo push è decorato per array dal motore
 *    (_banishRedirectInstalled in duel-engine.js), sostituirlo romperebbe
 *    Esiliatore della Luce & co.;
 *  - la zona Bandite (D14).
 *
 * Gli agganci nel motore che questa variante usa (tutti senza effetto fuori
 * dal Tag Team, vedi la sezione 6 del piano):
 *  - A1 l'evento 'inizio-turno' (fasi.js, changeTurn): qui si sceglie e si fa
 *    entrare il membro che gioca;
 *  - A2 gameState.uidInPanchina (duel-engine.js, recomputeStaticEffects): un
 *    Equip o una Trappola legata a un mostro in panchina resta sospesa invece
 *    di finire nel Cimitero;
 *  - A3 la domanda 'lato-sconfitto' (fasi.js, checkGameOver): un membro a 0
 *    Life Point non chiude il duello se il compagno è vivo.
 */
(function () {
    'use strict';

    /** @type {any} */
    const g = globalThis;

    /**
     * Comandi (js/engine/comandi.js) è un `const` a livello di script: lo vede
     * chi gira nello stesso ambiente globale, ma NON è una proprietà di
     * globalThis, quindi g.Comandi è vuoto (preso col test di D18: la End Phase
     * forzata non partiva e il conteggio degli attacchi non si agganciava).
     * @returns {any}
     */
    function motoreComandi() {
        return typeof Comandi !== 'undefined' ? Comandi : g.Comandi;
    }

    /** Le proprietà di un posto che appartengono al membro (CAMPO = dopo il nome del posto). */
    const CAMPI_MEMBRO = ['Hand', 'Deck', 'DeckCount', 'ExtraDeck', 'MonsterField', 'STField', 'FieldSpell'];

    /**
     * D16: gli effetti che colpiscono "un giocatore" per più turni valgono per
     * il MEMBRO colpito. Sono mappe { player, bot } di gameState che NON si
     * azzerano a ogni turno né a ogni ridisegno: per ognuna si mette da parte
     * la voce del posto insieme al membro. Elenco fatto nella fase 0
     * (classificazione dei 155 campi di gameState) e sorvegliato dallo spec
     * tag-team-fase1: una mappa nuova di questo tipo va aggiunta qui.
     */
    const MAPPE_MEMBRO = [
        'coldWaveActiveFor', 'skipDrawFor', 'skipNextTurnFor', 'skipMainPhase1For', 'skipNextBattlePhaseFor',
        'discardHandBeforeDrawFor', 'pendingMaharaghiPeekFor', 'lockedMonsterZonesFor', 'lockedSTZonesFor',
        'cannotChangePositionFor', 'orgothActiveUidsFor', 'orichalcosExtendedNegationUidsFor',
        'untilOpponentTurnActiveUidsFor', 'soulCrossingActivationLimitFor',
        // Il Sigillo di Orichalcos si attiva "una volta per Duello": per il membro che l'ha attivato.
        'orichalcosActivatedFor'
    ];

    /**
     * V3: le voci ritardate che puntano a una carta del membro. Se il membro va
     * in panchina vengono messe da parte con il conto fermo e tornano con lui;
     * altrimenti scatterebbero mentre la carta non è sul campo e si
     * perderebbero in silenzio (un mostro sfuggirebbe a una distruzione
     * ritardata). `appartiene(voce, uidCampo, idMembro)` dice se la voce è sua.
     * @type {Array<[string, (voce: any, uidCampo: Set<any>, idMembro: string) => boolean]>}
     */
    const RITARDATE = [
        ['pendingDelayedDestroyAtOpponentEndPhase', (v, uid) => uid.has(v.targetUid)],
        ['pendingSelfDestructAtOpponentEndPhase', (v, uid) => uid.has(v.cardUid)],
        ['pendingBlastSphereDetonations', (v, uid) => uid.has(v.attackerUid)],
        // Buco Dimensionale & co.: la carta torna sul campo del suo membro, alla casella bloccata nel suo campo.
        ['temporaryBanishments', (v, uid, id) => !!(v.card && v.card.membro === id)]
    ];

    /** @type {Record<string, any>} posto -> squadra (null = lato normale, un solo duellante) */
    let squadre = { player: null, bot: null };
    /** Attacchi in corso (vedi sorvegliaAttacchi): mai scambiare a metà di una battaglia. */
    let attacchiInCorso = 0;
    /** @type {Record<string, number|null>} posto -> indice del membro a 0 Life Point che aspetta di lasciare il posto (D15, D18). */
    let eliminazioneInAttesa = {};
    /** @type {Record<string, number>} posto -> turno in cui il suo turno è stato chiuso per un membro a 0 (D18): mosse rifiutate. */
    let fineForzata = {};
    /** @type {Array<(evento: string, posto: string) => void>} */
    const ascoltatori = [];
    let agganciato = false;

    function avvisa(evento, posto) {
        ascoltatori.slice().forEach((fn) => { try { fn(evento, posto); } catch (e) { console.error(e); } });
    }

    /** @param {number} i */
    function altro(i) { return i === 0 ? 1 : 0; }

    /** Uid dei mostri sul campo salvato di un membro (in panchina). */
    function uidCampoDi(membro) {
        const uid = new Set();
        const campo = membro.stato && membro.stato.MonsterField;
        (campo || []).forEach((s) => { if (s && s.card && s.card.uid != null) uid.add(s.card.uid); });
        return uid;
    }

    /** Ricalcola gameState.uidInPanchina (aggancio A2) dai membri in panchina di entrambi i lati. */
    function aggiornaUidInPanchina() {
        const tutti = new Set();
        Object.keys(squadre).forEach((posto) => {
            const sq = squadre[posto];
            if (!sq) return;
            sq.membri.forEach((m, i) => {
                if (i === sq.attivo || !m.vivo) return;
                uidCampoDi(m).forEach((u) => tutti.add(u));
            });
        });
        gameState.uidInPanchina = tutti;
    }

    /**
     * Segna ogni carta con il membro a cui appartiene (V2): serve a
     * riconsegnargliela se il motore la rimanda "al proprietario" mentre lui
     * è in panchina, e a riconoscere le sue voci ritardate.
     * @param {any[]} carte @param {string} id
     */
    function segna(carte, id) {
        (carte || []).forEach((c) => { if (c && typeof c === 'object') c.membro = id; });
    }

    /**
     * Le carte di un membro finite nella mano/Mazzo/Extra Deck dell'altro (un
     * ritorno "al proprietario" mentre lui era in panchina) tornano a lui.
     * Lavora sugli stati salvati di entrambi, quindi va chiamata a scambio fatto
     * a metà: quando entrambi gli stati sono fuori da gameState o vi sono
     * stati appena copiati.
     */
    function riconsegna(da, a) {
        ['Hand', 'Deck', 'ExtraDeck'].forEach((campo) => {
            const sorgente = da.stato[campo];
            const destinazione = a.stato[campo];
            if (!Array.isArray(sorgente) || !Array.isArray(destinazione)) return;
            for (let i = sorgente.length - 1; i >= 0; i--) {
                const c = sorgente[i];
                if (c && c.membro === a.id) {
                    sorgente.splice(i, 1);
                    destinazione.push(c);
                }
            }
        });
        [da, a].forEach((m) => { if (Array.isArray(m.stato.Deck)) m.stato.DeckCount = m.stato.Deck.length; });
    }

    /**
     * Un valore "vuoto" dello stesso tipo, per un membro che non ha mai avuto
     * quella voce: alcune mappe si aspettano un Set per ogni posto
     * (lockedMonsterZonesFor[owner].add(...)) e un undefined le romperebbe.
     */
    function vuotoCome(campione) {
        return campione instanceof Set ? new Set() : undefined;
    }

    /**
     * Fa entrare il membro `indice` del lato `posto` al posto di quello attivo.
     * Va chiamata solo a duello fermo (inizio turno, o tra una battaglia e
     * l'altra): il motore non tiene riferimenti agli array di un posto da un
     * momento fermo all'altro.
     * @param {string} posto @param {number} indice
     */
    function scambia(posto, indice) {
        const sq = squadre[posto];
        if (!sq || sq.attivo === indice) return;
        const esce = sq.membri[sq.attivo];
        const entra = sq.membri[indice];

        // 1) Lo stato di chi esce, dalle proprietà del posto.
        esce.stato = {};
        CAMPI_MEMBRO.forEach((c) => { esce.stato[c] = gameState[posto + c]; });
        if (sq.regolaLp === 'membro') esce.stato.LP = gameState[posto + 'LP'];
        esce.mappe = {};
        MAPPE_MEMBRO.forEach((nome) => {
            const mappa = gameState[nome];
            if (mappa && typeof mappa === 'object' && Object.prototype.hasOwnProperty.call(mappa, posto)) {
                esce.mappe[nome] = mappa[posto];
            }
        });

        // 2) Le voci ritardate di chi esce (V3), prima di perdere il suo campo.
        const uidEsce = uidCampoDi(esce);
        esce.ritardate = {};
        RITARDATE.forEach(([nome, appartiene]) => {
            const elenco = gameState[nome];
            if (!Array.isArray(elenco)) return;
            const sue = elenco.filter((v) => appartiene(v, uidEsce, esce.id));
            if (sue.length === 0) return;
            esce.ritardate[nome] = sue;
            gameState[nome] = elenco.filter((v) => sue.indexOf(v) === -1);
        });

        // 3) Riconsegna (V2): le carte di uno finite nelle pile dell'altro.
        if (entra.stato) {
            riconsegna(esce, entra);
            riconsegna(entra, esce);
        }

        // 4) Lo stato di chi entra, nelle proprietà del posto.
        CAMPI_MEMBRO.forEach((c) => { gameState[posto + c] = entra.stato[c]; });
        if (sq.regolaLp === 'membro') gameState[posto + 'LP'] = entra.stato.LP;
        MAPPE_MEMBRO.forEach((nome) => {
            const mappa = gameState[nome];
            if (!mappa || typeof mappa !== 'object') return;
            if (entra.mappe && Object.prototype.hasOwnProperty.call(entra.mappe, nome)) {
                mappa[posto] = entra.mappe[nome];
                return;
            }
            const vuoto = vuotoCome(mappa[posto]);
            if (vuoto === undefined) delete mappa[posto];
            else mappa[posto] = vuoto;
        });
        Object.keys(entra.ritardate || {}).forEach((nome) => {
            gameState[nome] = (Array.isArray(gameState[nome]) ? gameState[nome] : []).concat(entra.ritardate[nome]);
        });
        entra.stato = null;
        entra.mappe = null;
        entra.ritardate = null;

        // 5) Chi muove il posto e con quale IA.
        if (!gameState.personaggioPerPosto) gameState.personaggioPerPosto = { player: null, bot: null };
        gameState.personaggioPerPosto[posto] = entra.personaggio || null;
        // Il livello dell'IA è un DATO del membro, uguale su tutti i client,
        // anche dove quell'IA non gira (lì il posto è 'remoto'): alcune regole
        // lo leggono per ordinare i candidati di una scelta (Abbandono, id
        // 416), e una scelta in rete viaggia come POSIZIONE nell'elenco. Con il
        // livello scritto solo sul client dell'IA i due elenchi uscivano in
        // ordine diverso e la stessa posizione indicava due mostri diversi
        // (preso dal gemello a quattro motori). Una persona non ne ha.
        if (entra.livelloIA) {
            gameState.livelloIA = gameState.livelloIA || {};
            gameState.livelloIA[posto] = entra.livelloIA;
        } else if (gameState.livelloIA) {
            delete gameState.livelloIA[posto];
        }
        g.Tavolo.imposta({ [posto]: entra.controllore });
        // In rete: chi c'è dietro un posto remoto segue il membro davanti, o i
        // client risponderebbero diversamente a Decisioni.rispondeUnaPersona.
        if (entra.controllore === 'remoto') g.Tavolo.impostaNaturaRemoto(entra.natura || 'persona', posto);

        sq.attivo = indice;
        aggiornaUidInPanchina();
        avvisa('scambio', posto);
    }

    /** Il membro non ha più carte da pescare. */
    function mazzoVuoto(sq, i) {
        if (i === sq.attivo) {
            const mazzo = gameState[sq.posto + 'Deck'];
            return Array.isArray(mazzo) ? mazzo.length === 0 : (gameState[sq.posto + 'DeckCount'] || 0) <= 0;
        }
        const s = sq.membri[i].stato;
        return !s || (Array.isArray(s.Deck) ? s.Deck.length === 0 : (s.DeckCount || 0) <= 0);
    }

    /**
     * Elimina il membro attivo (D7, D10, D17): le carte del suo campo vanno nel
     * Cimitero condiviso, poi entra il compagno (D15). Il membro eliminato non
     * gioca più: l'alternanza salta su chi resta.
     * @param {string} posto @param {string} motivo 'lp' | 'mazzo'
     */
    function eliminaAttivo(posto, motivo) {
        const sq = squadre[posto];
        if (!sq) return;
        const caduto = sq.membri[sq.attivo];
        caduto.vivo = false;
        caduto.motivo = motivo;
        const cimitero = gameState[posto + 'Graveyard'];
        ['MonsterField', 'STField'].forEach((campo) => {
            const zona = gameState[posto + campo];
            (zona || []).forEach((slot, i) => {
                if (!slot) return;
                if (slot.card) cimitero.push(slot.card);
                zona[i] = null;
            });
        });
        const terreno = gameState[posto + 'FieldSpell'];
        if (terreno && terreno.card) {
            cimitero.push(terreno.card);
            gameState[posto + 'FieldSpell'] = null;
        }
        if (typeof g.addToLog === 'function') {
            g.addToLog(motivo === 'mazzo'
                ? `💀 ${caduto.nome} ha il Mazzo vuoto ed esce dal duello: entra ${sq.membri[altro(sq.attivo)].nome}.`
                : `💀 ${caduto.nome} ha finito i Life Point ed esce dal duello: entra ${sq.membri[altro(sq.attivo)].nome}.`);
        }
        avvisa('eliminato', posto);
        scambia(posto, altro(sq.attivo));
    }

    /** Il duello è fermo: nessuna battaglia, Catena, finestra o scelta aperta. */
    function duelloFermo() {
        if (typeof gameState === 'undefined' || gameState.gameOver) return false;
        if (attacchiInCorso > 0) return false;
        const de = g.DuelEngine;
        if (de && de.isChainActive && de.isChainActive()) return false;
        if (de && de.isPriorityWindowOpen && de.isPriorityWindowOpen()) return false;
        if (g.Decisioni && g.Decisioni.inSospeso && g.Decisioni.inSospeso()) return false;
        return true;
    }

    /**
     * Un membro è a 0 Life Point e il compagno è vivo (D7). Quando lascia il posto:
     * - nel turno AVVERSARIO entra subito il compagno (D15), ma non a metà di una
     *   battaglia o di una Catena: si riprova finché il duello è fermo, così il
     *   prossimo attacco trova il compagno;
     * - nel PROPRIO turno (D18, decisa dall'autore): scatta la sua End Phase,
     *   appena il duello è fermo in Main Phase 1, Battle Phase o Main Phase 2,
     *   ed esce al cambio turno, in tempo per il turno avversario. Il suo turno
     *   non passa di mano a metà: l'IA che lo stava giocando muoverebbe su uno
     *   stato cambiato sotto di lei. Da quel momento le mosse di quel posto sono
     *   rifiutate (vedi sorvegliaComandi), tranne lo scarto di fine turno.
     * eliminazioneInAttesa[posto] = indice del membro caduto.
     * @param {string} posto
     */
    function programmaEliminazione(posto) {
        const sq = squadre[posto];
        if (!sq || eliminazioneInAttesa[posto] != null) return;
        const caduto = sq.attivo;
        eliminazioneInAttesa[posto] = caduto;
        if (gameState.currentPlayer === posto) {
            if (typeof g.addToLog === 'function') g.addToLog(`💀 ${sq.membri[caduto].nome} è a 0 Life Point: il suo turno finisce ed esce dal duello.`);
            // In rete la End Phase la chiede solo il client che gioca quel posto:
            // il comando viaggia, e gli altri la ricevono come ogni altra mossa
            // (se la chiedessero anche loro sarebbe doppia).
            if (aPassoComune() && g.Tavolo.eRemoto(posto)) return;
            const turno = gameState.turn;
            const chiudiTurno = () => {
                if (eliminazioneInAttesa[posto] !== caduto) return;
                if (typeof gameState === 'undefined' || gameState.gameOver || gameState.turn !== turno || gameState.currentPlayer !== posto) return;
                if (gameState.phase === 'end') { fineForzata[posto] = turno; return; }
                // In pescata e Standby l'IA avanza con un timer suo (turnoIA): si aspetta la Main Phase 1.
                const faseAdatta = gameState.phase === 'main1' || gameState.phase === 'battle' || gameState.phase === 'main2';
                if (!faseAdatta || !duelloFermo() || !motoreComandi().esegui(posto, { tipo: 'fase', verso: 'end' })) {
                    setTimeout(chiudiTurno, 150);
                    return;
                }
                fineForzata[posto] = turno;
            };
            setTimeout(chiudiTurno, 0);
            return; // il compagno entra al cambio turno: eliminazioniInAttesa() su 'inizio-turno'
        }
        // In rete un timer locale non va bene: scatterebbe in punti diversi
        // della partita sui vari client (prima del prossimo attacco da una
        // parte, dopo dall'altra). Il compagno entra all'avviso A4, subito
        // prima del prossimo comando, che arriva nello stesso punto ovunque
        // (vedi eliminazioniFuoriTurno), o al cambio turno.
        if (aPassoComune()) return;
        const tenta = () => {
            if (eliminazioneInAttesa[posto] !== caduto) return;
            if (typeof gameState === 'undefined' || gameState.gameOver || !squadre[posto]) { eliminazioneInAttesa[posto] = null; return; }
            // Il turno è cambiato nel frattempo: se ne occupa 'inizio-turno'.
            if (gameState.currentPlayer === posto) return;
            if (!duelloFermo()) { setTimeout(tenta, 150); return; }
            eliminazioneInAttesa[posto] = null;
            if (sq.attivo !== caduto || !sq.membri[caduto].vivo) return;
            eliminaAttivo(posto, 'lp');
            if (typeof g.updateUI === 'function') g.updateUI();
        };
        setTimeout(tenta, 0);
    }

    /** Vero nel Multiplayer a passo comune (js/engine/passo-comune.js). */
    function aPassoComune() {
        return !!(g.PassoComune && g.PassoComune.attivo());
    }

    /**
     * In rete (passo comune a posti): il posto assoluto davanti in un posto
     * del motore. Per una squadra è il posto del membro davanti; per un lato
     * con un solo duellante, il primo posto della sua squadra ('A0'/'B0').
     * Uguale su tutti i client, perché gli scambi lo sono.
     * @param {string} postoMotore
     */
    function postoAssolutoDavanti(postoMotore) {
        const sq = squadre[postoMotore];
        if (sq && sq.membri[sq.attivo].seat) return sq.membri[sq.attivo].seat;
        const p = g.PassoComune.posti();
        const mia = p ? p.miaSquadra : 'A';
        return (postoMotore === 'player' ? mia : (mia === 'A' ? 'B' : 'A')) + '0';
    }

    /**
     * D12 in rete: una scelta di chi affrontare arrivata quando il duello non
     * era fermo si applica all'avviso A4 (subito prima del prossimo comando,
     * nello stesso punto su tutti i client) invece che con un timer locale.
     * @type {Record<string, { indice: number, turno: number } | null>}
     */
    let frontiInAttesa = {};

    function frontiFuoriTempo() {
        if (typeof gameState === 'undefined' || gameState.gameOver) return;
        Object.keys(frontiInAttesa).forEach((dif) => {
            const f = frontiInAttesa[dif];
            frontiInAttesa[dif] = null;
            const sq = squadre[dif];
            if (!f || !sq || f.turno !== gameState.turn || sq.attivo === f.indice || !sq.membri[f.indice].vivo) return;
            scambia(dif, f.indice);
            avvisa('fronte', dif);
        });
    }

    /** Una persona (qui o su un altro client) gioca quel membro. */
    function ePersonaMembro(m) {
        return m.controllore === 'persona' || (m.controllore === 'remoto' && m.natura === 'persona');
    }

    /**
     * D2 su richiesta, IN RETE. La richiesta nasce da un pulsante su UN client
     * e gli altri non la sanno: diventa una decisione che viaggia. A inizio
     * turno della squadra si chiede a ogni membro che è una persona (prima chi
     * giocherebbe a turno, poi l'altro) se ha chiesto di invertire il turno:
     * risponde il suo client, in silenzio, guardando la richiesta che ha in
     * memoria. Al primo "sì" l'altro membro decide se accettare: una persona lo
     * vede a schermo, un'IA usa compagnoAccetta (uguale ovunque, non serve
     * farla viaggiare). Poi `fatto(gioca)`, con chi gioca questo turno.
     * Tutto si risolve prima della pescata: a passo comune l'inizio del turno
     * aspetta le scelte aperte (changeTurn in fasi.js).
     * @param {any} sq @param {number} prossimo chi giocherebbe a turno @param {(gioca: number) => void} fatto
     */
    function richiesteInRete(sq, prossimo, fatto) {
        const altroIdx = altro(prossimo);
        const ordine = [prossimo, altroIdx].filter((k) => ePersonaMembro(sq.membri[k]));
        // La richiesta in memoria di QUESTO client (fatta dal suo pulsante), poi dimenticata.
        const richiestaQui = sq.richiesta;
        const richiedenteQui = sq.richiedente;
        sq.richiesta = null;
        sq.richiedente = null;
        const chiediA = (passo) => {
            if (passo >= ordine.length) { fatto(prossimo); return; }
            const k = ordine[passo];
            const m = sq.membri[k];
            const haChiesto = richiestaQui === altroIdx && richiedenteQui === k;
            g.Decisioni.chiedi({
                chi: sq.posto,
                tipo: 'opzioni',
                titolo: 'Scambio del turno',
                candidati: [{ value: false, label: 'No' }, { value: true, label: 'Sì' }],
                postoAssoluto: m.seat,
                locale: m.controllore !== 'remoto',
                perUnaPersona: false,
                automatica: (c) => c[haChiesto ? 1 : 0]
            }, (scelta) => {
                if (!(scelta && scelta.value === true)) { chiediA(passo + 1); return; }
                rispostaAllaRichiesta(sq, k, prossimo, fatto);
            });
        };
        chiediA(0);
    }

    /**
     * Il membro `richiedente` ha chiesto di invertire il turno: risponde
     * l'altro. Esito: chi gioca questo turno.
     * @param {any} sq @param {number} richiedente @param {number} prossimo @param {(gioca: number) => void} fatto
     */
    function rispostaAllaRichiesta(sq, richiedente, prossimo, fatto) {
        const altroIdx = altro(prossimo);
        const risponde = sq.membri[altro(richiedente)];
        const chiude = (accetta) => {
            const gioca = accetta ? altroIdx : prossimo;
            sq.ultimaRisposta = { accetta, gioca, da: risponde.nome, turno: gameState.turn };
            if (typeof g.addToLog === 'function') {
                g.addToLog(accetta
                    ? `🔄 ${risponde.nome} accetta lo scambio: questo turno lo gioca ${sq.membri[altroIdx].nome}.`
                    : `🔄 ${risponde.nome} non accetta lo scambio: si va a turno, gioca ${sq.membri[prossimo].nome}.`);
            }
            avvisa('risposta', sq.posto);
            fatto(gioca);
        };
        if (!ePersonaMembro(risponde)) { chiude(compagnoAccetta(sq, altroIdx, prossimo)); return; }
        const chiede = sq.membri[richiedente];
        g.Decisioni.chiedi({
            chi: sq.posto,
            tipo: 'opzioni',
            titolo: richiedente === prossimo
                ? `${chiede.nome} ti chiede di giocare tu questo turno`
                : `${chiede.nome} chiede di giocare questo turno al posto tuo`,
            candidati: [{ value: true, label: 'Accetta', icon: '🔄' }, { value: false, label: 'Andiamo a turno', icon: '↩' }],
            postoAssoluto: risponde.seat,
            locale: risponde.controllore !== 'remoto',
            perUnaPersona: risponde.controllore === 'persona',
            // Senza schermo (simulazioni): la stessa regola del compagno IA.
            automatica: (c) => c[compagnoAccetta(sq, altroIdx, prossimo) ? 0 : 1]
        }, (scelta) => chiude(!!(scelta && scelta.value === true)));
    }

    /**
     * A4 (avviso 'prima-del-comando', solo a passo comune): un comando sta per
     * partire a duello fermo, nello stesso punto logico su tutti i client.
     * Entra qui il compagno di un membro caduto nel turno avversario (D15).
     * Niente controllo di duelloFermo: lo garantisce il passo comune, e il
     * conteggio degli attacchi della variante, da chi manda, è già salito
     * per l'attacco che sta per partire (sarebbe "non fermo" da una parte
     * sola).
     */
    function eliminazioniFuoriTurno() {
        if (typeof gameState === 'undefined' || gameState.gameOver) return;
        let fatto = false;
        Object.keys(eliminazioneInAttesa).forEach((posto) => {
            const caduto = eliminazioneInAttesa[posto];
            if (caduto == null || gameState.currentPlayer === posto) return;
            eliminazioneInAttesa[posto] = null;
            const sq = squadre[posto];
            if (sq && sq.attivo === caduto && sq.membri[caduto].vivo) { eliminaAttivo(posto, 'lp'); fatto = true; }
        });
        if (fatto && typeof g.updateUI === 'function') g.updateUI();
    }

    /** Esegue le eliminazioni rimaste in attesa (chiamata a ogni 'inizio-turno', quando il duello è fermo). */
    function eliminazioniInAttesa() {
        Object.keys(eliminazioneInAttesa).forEach((posto) => {
            const caduto = eliminazioneInAttesa[posto];
            if (caduto == null) return;
            eliminazioneInAttesa[posto] = null;
            const sq = squadre[posto];
            if (sq && sq.attivo === caduto && sq.membri[caduto].vivo) eliminaAttivo(posto, 'lp');
        });
    }

    /**
     * Chi giocherà il prossimo turno del lato con l'alternanza di D2 (un
     * eliminato non gioca più). -1 se nessuno è vivo.
     * @param {any} sq
     */
    function prossimoPerTurno(sq) {
        let prossimo = sq.ultimo === null ? 0 : altro(sq.ultimo);
        if (!sq.membri[prossimo].vivo) prossimo = altro(prossimo);
        return sq.membri[prossimo].vivo ? prossimo : -1;
    }

    /**
     * Lo scambio "su richiesta" (D2 libero, decisa dall'autore): la persona
     * chiede di invertire il prossimo turno della squadra ("gioco io" quando
     * toccherebbe al compagno, "gioca tu" quando toccherebbe a lei); il
     * compagno IA risponde all'inizio di quel turno. Accetta se gli conviene:
     * chi finirebbe per giocare ha almeno i Life Point dell'altro (con i Life
     * Point condivisi non conta), almeno tante carte in mano e un Mazzo da cui
     * pescare. Il criterio scelto dall'autore diceva "più Life Point"; con
     * "più" stretto all'inizio del duello (4000 contro 4000) rifiuterebbe
     * sempre, per questo vale anche la parità. Se rifiuta, si va a turno.
     * @param {any} sq @param {number} gioca chi giocherebbe accettando @param {number} invece chi giocherebbe a turno
     */
    function compagnoAccetta(sq, gioca, invece) {
        if (mazzoVuoto(sq, gioca)) return false;
        const r = riassunto(sq.posto);
        const a = r.membri[gioca];
        const b = r.membri[invece];
        if (sq.regolaLp === 'membro' && a.lp < b.lp) return false;
        return a.mano >= b.mano;
    }

    /**
     * A1: comincia il turno di `posto`. Si sceglie chi gioca (D2 obbligato:
     * si alternano; un eliminato non gioca più; D2 su richiesta: vedi
     * compagnoAccetta) e lo si fa entrare, prima di scadenze, turno saltato e
     * pescata. D17: chi entra con il Mazzo vuoto è eliminato e gioca il
     * compagno.
     * @param {string} posto
     */
    function inizioTurno(posto) {
        eliminazioniInAttesa();
        const sq = squadre[posto];
        // D2 su richiesta in rete: prima entra chi giocherebbe a turno, poi le
        // richieste viaggiano come decisioni (richiesteInRete); la scelta di
        // chi affrontare (D12) si fa solo dopo, quando si sa chi gioca.
        if (sq && aPassoComune() && sq.scambio === 'libero') {
            const prossimo = prossimoPerTurno(sq);
            if (prossimo !== -1 && sq.membri[altro(prossimo)].vivo) {
                const entrato = entraPerTurno(sq, posto, prossimo);
                if (entrato !== prossimo) { sceltaFronte(posto); return; } // Mazzo vuoto (D17): niente scambio possibile
                richiesteInRete(sq, prossimo, (gioca) => {
                    if (gioca !== sq.attivo) entraPerTurno(sq, posto, gioca);
                    sceltaFronte(posto);
                });
                return;
            }
        }
        if (sq) {
            let prossimo = prossimoPerTurno(sq);
            const richiesta = sq.richiesta;
            sq.richiesta = null;
            if (richiesta != null && prossimo !== -1 && richiesta !== prossimo && sq.membri[richiesta].vivo) {
                const accetta = compagnoAccetta(sq, richiesta, prossimo);
                // Chi risponde è il membro IA della coppia (la persona ha fatto la richiesta).
                const ia = sq.membri.find((m) => m.controllore === 'ia') || sq.membri[altro(richiesta)];
                sq.ultimaRisposta = { accetta, gioca: accetta ? richiesta : prossimo, da: ia.nome, turno: gameState.turn };
                if (typeof g.addToLog === 'function') {
                    g.addToLog(accetta
                        ? `🔄 ${ia.nome} accetta lo scambio: questo turno lo gioca ${sq.membri[richiesta].nome}.`
                        : `🔄 ${ia.nome} non accetta lo scambio: si va a turno, gioca ${sq.membri[prossimo].nome}.`);
                }
                if (accetta) prossimo = richiesta;
                avvisa('risposta', posto);
            }
            if (prossimo !== -1) entraPerTurno(sq, posto, prossimo);
        }
        // Chi è di turno sceglie chi affrontare nel lato avversario, se è una squadra (D12, D13).
        sceltaFronte(posto);
    }

    /**
     * Fa entrare per il turno il membro `indice` (D17: con il Mazzo vuoto è
     * eliminato e gioca il compagno). Torna chi gioca davvero.
     * @param {any} sq @param {string} posto @param {number} indice
     */
    function entraPerTurno(sq, posto, indice) {
        let gioca = indice;
        const compagno = altro(indice);
        if (mazzoVuoto(sq, indice) && sq.membri[compagno].vivo && !mazzoVuoto(sq, compagno)) {
            scambia(posto, indice);
            eliminaAttivo(posto, 'mazzo');
            gioca = compagno;
        } else {
            scambia(posto, indice);
        }
        sq.ultimo = gioca;
        avvisa('turno', posto);
        return gioca;
    }

    /**
     * D2 su richiesta: chiede (o ritira) l'inversione del prossimo turno della
     * squadra. Torna l'indice del membro che chiederebbe di giocare, o null
     * se non c'è (più) una richiesta: regola "a turno", compagno eliminato,
     * oppure richiesta appena ritirata.
     * @param {string} posto @param {number} [richiedente]
     */
    function chiediScambio(posto, richiedente) {
        const sq = squadre[posto];
        if (!sq || sq.scambio !== 'libero') return null;
        if (sq.richiesta != null) {
            sq.richiesta = null;
            sq.richiedente = null;
            avvisa('richiesta', posto);
            return null;
        }
        const prossimo = prossimoPerTurno(sq);
        if (prossimo === -1 || !sq.membri[altro(prossimo)].vivo) return null;
        sq.richiesta = altro(prossimo);
        // Chi chiede: la persona di QUESTO client (in rete la richiesta viaggia
        // a suo nome, vedi richiesteInRete). `richiedente` esplicito per le
        // simulazioni, dove le persone sono fatte dall'IA.
        const qui = sq.membri.findIndex((m) => m.controllore === 'persona');
        sq.richiedente = typeof richiedente === 'number' ? richiedente : (qui === -1 ? null : qui);
        avvisa('richiesta', posto);
        return sq.richiesta;
    }

    /** @param {string} posto */
    function avversarioDi(posto) { return posto === 'player' ? 'bot' : 'player'; }

    /**
     * D13: si conta per quanti turni avversari di fila lo stesso membro è
     * stato affrontato. Chiamata una volta per turno, quando la scelta è presa.
     * @param {any} sq @param {number} i
     */
    function registraFronte(sq, i) {
        if (sq.fronte && sq.fronte.indice === i) sq.fronte.fila++;
        else sq.fronte = { indice: i, fila: 1 };
    }

    /**
     * Il membro `i` del lato `dif` è quello affrontato in questo turno: entra
     * davanti se non lo è già. Se a sceglierlo è stata una persona la scelta
     * arriva in ritardo (è un modale), quindi lo scambio aspetta il duello
     * fermo nello stesso turno, come l'entrata di D15.
     * @param {string} dif @param {number} i @param {string} attaccante @param {string|null} motivo
     * @param {boolean} sincrona vero se si è ancora dentro changeTurn
     */
    function fronteDecisa(dif, i, attaccante, motivo, sincrona) {
        const sq = squadre[dif];
        if (!sq || !sq.membri[i] || !sq.membri[i].vivo) return;
        registraFronte(sq, i);
        const turno = gameState.turn;
        const nomeAtt = nomeDelPosto(attaccante);
        if (typeof g.addToLog === 'function') {
            g.addToLog(motivo === 'limite'
                ? `⚔️ ${nomeAtt} affronta ${sq.membri[i].nome}: lo stesso avversario non si affronta più di ${sq.limiteBersaglio} turni di fila.`
                : `⚔️ ${nomeAtt} affronta ${sq.membri[i].nome}.`);
        }
        // Dentro changeTurn (scelta immediata) il ridisegno lo fa changeTurn
        // stesso; dopo un'attesa lo si chiede qui.
        const applica = (/** @type {boolean} */ inRitardo) => {
            if (typeof gameState === 'undefined' || gameState.gameOver || gameState.turn !== turno || !squadre[dif]) return;
            if (sq.attivo === i || !sq.membri[i].vivo) { avvisa('fronte', dif); return; }
            if (!duelloFermo()) {
                // In rete niente timer locali: lo scambio si fa all'avviso A4.
                if (aPassoComune()) { frontiInAttesa[dif] = { indice: i, turno }; return; }
                setTimeout(() => applica(true), 150);
                return;
            }
            scambia(dif, i);
            avvisa('fronte', dif);
            if (inRitardo && typeof g.updateUI === 'function') g.updateUI();
        };
        applica(!sincrona);
    }

    /** Il nome di chi gioca adesso su un posto (membro davanti, o il duellante unico). */
    function nomeDelPosto(posto) {
        const sq = squadre[posto];
        if (sq) return sq.membri[sq.attivo].nome;
        const s = g.DuelSession;
        const id = posto === 'bot' ? (s && s.opponent) : (s && s.player);
        return (id && id.name) || (posto === 'bot' ? 'L\'avversario' : 'Il giocatore');
    }

    /**
     * D12: chi attacca sceglie, a inizio turno, quale membro del lato
     * avversario affrontare (lettura A di D11: davanti c'è sempre un membro
     * solo, quindi la scelta è "chi metto davanti"). D13: lo stesso membro non
     * si affronta per più di `limiteBersaglio` turni di fila finché l'altro è
     * vivo; al limite la scelta è obbligata. Senza scelta (IA) vale il valore
     * predefinito: chi ha giocato per ultimo, cioè chi è già davanti.
     * @param {string} attaccante
     */
    function sceltaFronte(attaccante) {
        const dif = avversarioDi(attaccante);
        const sq = squadre[dif];
        if (!sq) return;
        const vivi = sq.membri.map((m, i) => (m.vivo ? i : -1)).filter((i) => i >= 0);
        if (vivi.length === 0) return;
        if (vivi.length === 1) { registraFronte(sq, vivi[0]); return; }
        if (sq.fronte && sq.limiteBersaglio > 0 && sq.fronte.fila >= sq.limiteBersaglio) {
            fronteDecisa(dif, altro(sq.fronte.indice), attaccante, 'limite', true);
            return;
        }
        const predefinito = sq.attivo;
        const D = g.Decisioni;
        if (!D || !D.rispondeUnaPersona(attaccante)) {
            fronteDecisa(dif, predefinito, attaccante, null, true);
            return;
        }
        const r = riassunto(dif);
        const candidati = vivi.map((i) => {
            const m = r.membri[i];
            const lp = sq.regolaLp === 'membro' ? ` · ❤ ${m.lp}` : '';
            return { value: i, icon: '⚔️', label: `${m.nome}${lp} · ${m.mostri} mostri · ✋ ${m.mano}` };
        });
        let dentro = true;
        D.chiedi({
            chi: attaccante,
            tipo: 'opzioni',
            titolo: 'Chi affronti in questo turno?',
            candidati,
            automatica: (/** @type {any[]} */ c) => c.find((x) => x.value === predefinito) || c[0]
        }, (/** @type {any} */ scelta) => {
            fronteDecisa(dif, scelta && typeof scelta.value === 'number' ? scelta.value : predefinito, attaccante, null, dentro);
        });
        dentro = false;
    }

    /**
     * A3: un posto a 0 Life Point ha perso? Con D1 "per membro" no, finché il
     * compagno è vivo: entra lui (D15). Undefined = non è una squadra, risponde
     * il motore (true).
     * @param {string} posto
     */
    function latoSconfitto(posto) {
        const sq = squadre[posto];
        if (!sq || sq.regolaLp !== 'membro') return undefined;
        // Se un'eliminazione è già in attesa, chi è a 0 adesso è ancora il membro caduto.
        const caduto = eliminazioneInAttesa[posto] != null ? eliminazioneInAttesa[posto] : sq.attivo;
        const compagno = sq.membri[altro(caduto)];
        if (!compagno.vivo) return true;
        programmaEliminazione(posto);
        return false;
    }

    /**
     * Avvolge Comandi.esegui (solo nel Tag Team, a runtime: il file del motore
     * non cambia; eccezione approvata dall'autore e dichiarata nel guardrail
     * delle modalità). Due compiti, nessuno cambia un comando:
     *  - conta gli attacchi in corso (eseguiAttacco chiama alTermine alla fine
     *    di ogni attacco, anche rifiutato), così il compagno non entra a metà
     *    di una battaglia (D15);
     *  - dopo la End Phase forzata di D18 rifiuta le mosse di quel posto fino al
     *    cambio turno, tranne lo scarto di fine turno: l'IA che stava giocando
     *    quel turno non deve poterlo riaprire (per esempio chiedendo la Battle
     *    Phase). Un attacco rifiutato chiama comunque alTermine, o l'IA
     *    resterebbe ad aspettarlo.
     */
    function sorvegliaComandi() {
        const C = motoreComandi();
        if (!C || C.__tagSorvegliato) return;
        const originale = C.esegui;
        C.esegui = function (posto, cmd, extra) {
            // D18 vista da tutti: la End Phase di un membro a 0 nel suo turno
            // arriva come comando (in rete lo manda solo chi gioca quel posto),
            // e da lì le mosse di quel posto si rifiutano su ogni client.
            let questaChiude = false;
            if (cmd && cmd.tipo === 'fase' && cmd.verso === 'end' && eliminazioneInAttesa[posto] != null
                && gameState.currentPlayer === posto && fineForzata[posto] !== gameState.turn) {
                fineForzata[posto] = gameState.turn;
                questaChiude = true;
            }
            if (!questaChiude && cmd && cmd.tipo !== 'scartaFineTurno' && fineForzata[posto] === gameState.turn && gameState.currentPlayer === posto) {
                if (cmd.tipo === 'attacca' && extra && typeof extra.alTermine === 'function') extra.alTermine();
                return false;
            }
            if (!cmd || cmd.tipo !== 'attacca') return originale.apply(this, arguments);
            attacchiInCorso++;
            let chiuso = false;
            const fine = () => { if (!chiuso) { chiuso = true; attacchiInCorso = Math.max(0, attacchiInCorso - 1); } };
            const e = Object.assign({}, extra || {});
            const seguito = e.alTermine;
            e.alTermine = function () {
                fine();
                if (typeof seguito === 'function') return seguito.apply(this, arguments);
            };
            // Rete di sicurezza: un attacco che non chiamasse mai alTermine non
            // deve bloccare per sempre l'entrata del compagno.
            setTimeout(fine, 15000);
            try {
                const r = originale.call(this, posto, cmd, e);
                if (r === false) fine();
                return r;
            } catch (err) { fine(); throw err; }
        };
        C.__tagSorvegliato = true;
    }

    function aggancia() {
        if (agganciato) return;
        agganciato = true;
        g.EventiDuello.ascolta('inizio-turno', inizioTurno);
        g.EventiDuello.ascolta('lato-sconfitto', (posto) => latoSconfitto(posto));
        g.EventiDuello.ascolta('prima-del-comando', () => {
            if (!aPassoComune()) return;
            eliminazioniFuoriTurno();
            frontiFuoriTempo();
        });
        sorvegliaComandi();
    }

    /**
     * Prepara un lato a due membri. Il primo membro è quello già preparato dal
     * motore (mano, Mazzo, campo nel posto); il secondo arriva con il suo
     * mazzo e pesca la sua mano iniziale qui.
     * @param {string} posto
     * @param {{ primo: any, secondo: any, mazzoSecondo: any, regolaLp: 'membro'|'lato', lp: { membro: number, lato: number }, manoIniziale?: number, limiteBersaglio?: number, scambio?: 'obbligato'|'libero', posti?: string[], prefissoUid?: string }} o
     *   primo/secondo: { nome, personaggio, controllore, livelloIA, identita }
     *   limiteBersaglio: D13, turni avversari di fila in cui lo stesso membro può essere affrontato (0 = nessun limite)
     *   scambio: D2, 'obbligato' (a turno, predefinito) o 'libero' (a turno, ma la persona può chiedere di invertire)
     *   In rete (passo comune a posti) anche: posti ['A0', 'A1'] (i posti assoluti dei due membri),
     *   prefissoUid (uid prevedibili del mazzo del secondo membro, uguali su tutti i client) e, per un
     *   membro 'remoto', natura 'persona' | 'ia' (chi c'è davvero dietro, sull'altro client)
     */
    function preparaSquadra(posto, o) {
        aggancia();
        const id0 = posto + '#0';
        const id1 = posto + '#1';
        segna(gameState[posto + 'Hand'], id0);
        segna(gameState[posto + 'Deck'], id0);
        segna(gameState[posto + 'ExtraDeck'], id0);

        // In rete gli uid devono uscire uguali su tutti i client: si usa un prefisso (il posto assoluto).
        const opzMazzo = o.prefissoUid ? { prefissoUid: o.prefissoUid } : undefined;
        const opzExtra = o.prefissoUid ? { prefissoUid: o.prefissoUid + 'x' } : undefined;
        const mazzo = (typeof g.buildDeckFromSpec === 'function' && o.mazzoSecondo) ? (g.buildDeckFromSpec(o.mazzoSecondo, opzMazzo) || []) : [];
        const extra = (typeof g.buildExtraDeckFromSpec === 'function' && o.mazzoSecondo) ? g.buildExtraDeckFromSpec(o.mazzoSecondo, opzExtra) : [];
        segna(mazzo, id1);
        segna(extra, id1);
        const mano = [];
        const quante = o.manoIniziale === undefined ? 5 : o.manoIniziale;
        for (let i = 0; i < quante && mazzo.length > 0; i++) mano.push(mazzo.pop());

        const membro = (dati, id, stato, k) => ({
            id,
            // In rete: il posto assoluto ('A0'...) e chi c'è davvero dietro un membro remoto.
            seat: (o.posti && o.posti[k]) || null,
            natura: dati.natura || (dati.controllore === 'remoto' ? 'persona' : (dati.controllore === 'persona' ? 'persona' : 'ia')),
            nome: dati.nome,
            personaggio: dati.personaggio || null,
            controllore: dati.controllore,
            livelloIA: dati.livelloIA || null,
            identita: dati.identita || null,
            vivo: true,
            motivo: null,
            stato,
            mappe: null,
            ritardate: null
        });
        const lpMembro = o.lp.membro;
        const sq = {
            posto,
            regolaLp: o.regolaLp,
            attivo: 0,
            // Chi ha giocato per ultimo il turno di questo lato (per l'alternanza
            // di D2). Se il lato comincia, il primo turno è del primo membro e
            // non passa da 'inizio-turno' (al primo turno changeTurn non gira).
            ultimo: gameState.currentPlayer === posto ? 0 : null,
            // D13: chi è stato affrontato nell'ultimo turno avversario e per quanti turni di fila.
            fronte: null,
            limiteBersaglio: o.limiteBersaglio === undefined ? 2 : o.limiteBersaglio,
            // D2: regola dello scambio, richiesta in sospeso (indice di chi chiede di giocare) e l'ultima risposta del compagno.
            scambio: o.scambio === 'libero' ? 'libero' : 'obbligato',
            richiesta: null,
            richiedente: null,
            ultimaRisposta: null,
            membri: [
                membro(o.primo, id0, null, 0),
                membro(o.secondo, id1, {
                    Hand: mano, Deck: mazzo, DeckCount: mazzo.length, ExtraDeck: extra,
                    MonsterField: Array(5).fill(null), STField: Array(5).fill(null), FieldSpell: null,
                    LP: lpMembro
                }, 1)
            ]
        };
        squadre[posto] = sq;
        gameState[posto + 'LP'] = o.regolaLp === 'membro' ? lpMembro : o.lp.lato;
        if (!gameState.personaggioPerPosto) gameState.personaggioPerPosto = { player: null, bot: null };
        gameState.personaggioPerPosto[posto] = sq.membri[0].personaggio;
        g.Tavolo.imposta({ [posto]: sq.membri[0].controllore });
        if (sq.membri[0].controllore === 'remoto') g.Tavolo.impostaNaturaRemoto(sq.membri[0].natura, posto);
        // Come in scambia: il livello dell'IA del primo membro vale su tutti i client.
        if (sq.membri[0].livelloIA) {
            gameState.livelloIA = gameState.livelloIA || {};
            gameState.livelloIA[posto] = sq.membri[0].livelloIA;
        }
        // In rete il passo comune deve sapere quale posto assoluto è davanti in ogni posto del motore.
        if (aPassoComune() && g.PassoComune.posti && g.PassoComune.posti()) g.PassoComune.impostaPostoAttivo(postoAssolutoDavanti);
        aggiornaUidInPanchina();
        avvisa('pronta', posto);
        return sq;
    }

    /** Una fotografia leggibile di un lato, per l'interfaccia e i test. */
    function riassunto(posto) {
        const sq = squadre[posto];
        if (!sq) return null;
        return {
            regolaLp: sq.regolaLp,
            attivo: sq.attivo,
            ultimo: sq.ultimo,
            fronte: sq.fronte ? { indice: sq.fronte.indice, fila: sq.fronte.fila } : null,
            scambio: sq.scambio,
            prossimo: prossimoPerTurno(sq),
            richiesta: sq.richiesta,
            ultimaRisposta: sq.ultimaRisposta ? Object.assign({}, sq.ultimaRisposta) : null,
            membri: sq.membri.map((m, i) => {
                const davanti = i === sq.attivo;
                const s = m.stato || {};
                const campo = davanti ? gameState[posto + 'MonsterField'] : s.MonsterField;
                const mt = davanti ? gameState[posto + 'STField'] : s.STField;
                const mazzo = davanti ? gameState[posto + 'Deck'] : s.Deck;
                return {
                    id: m.id,
                    nome: m.nome,
                    personaggio: m.personaggio,
                    controllore: m.controllore,
                    natura: m.natura,
                    identita: m.identita,
                    vivo: m.vivo,
                    motivo: m.motivo,
                    davanti,
                    lp: sq.regolaLp === 'membro' ? (davanti ? gameState[posto + 'LP'] : s.LP) : gameState[posto + 'LP'],
                    mano: (davanti ? gameState[posto + 'Hand'] : s.Hand || []).length,
                    mazzo: Array.isArray(mazzo) ? mazzo.length : (davanti ? gameState[posto + 'DeckCount'] : s.DeckCount) || 0,
                    mostri: (campo || []).filter(Boolean).length,
                    magieTrappole: (mt || []).filter(Boolean).length
                };
            })
        };
    }

    const TagTeam = {
        CAMPI_MEMBRO,
        MAPPE_MEMBRO,
        preparaSquadra,
        scambia,
        riassunto,
        chiediScambio,
        /** Vero se il posto è una squadra. @param {string} posto */
        eSquadra: (posto) => !!squadre[posto],
        /** Il membro davanti del posto (oggetto interno, sola lettura). @param {string} posto */
        membroAttivo: (posto) => (squadre[posto] ? squadre[posto].membri[squadre[posto].attivo] : null),
        /** Un membro qualsiasi del posto (oggetto interno, per i test). @param {string} posto @param {number} i */
        membro: (posto, i) => (squadre[posto] ? squadre[posto].membri[i] : null),
        /** @param {(evento: string, posto: string) => void} fn */
        ascolta: (fn) => { ascoltatori.push(fn); },
        /** Solo per i test: ricomincia da zero. */
        azzera: () => { squadre = { player: null, bot: null }; attacchiInCorso = 0; eliminazioneInAttesa = {}; fineForzata = {}; frontiInAttesa = {}; },
        /** Diagnosi. */
        attacchiInCorso: () => attacchiInCorso
    };
    g.TagTeam = TagTeam;
})();
