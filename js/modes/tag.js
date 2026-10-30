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
        if (entra.controllore === 'ia') {
            gameState.livelloIA = gameState.livelloIA || {};
            gameState.livelloIA[posto] = entra.livelloIA;
        } else if (gameState.livelloIA) {
            delete gameState.livelloIA[posto];
        }
        g.Tavolo.imposta({ [posto]: entra.controllore });

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
     * - nel PROPRIO turno esce al prossimo cambio turno (D18, provvisoria, vedi
     *   il piano): un turno già cominciato non passa di mano a metà, perché
     *   l'IA che lo sta giocando continuerebbe a muovere su uno stato cambiato
     *   sotto di lei. Fino ad allora il membro a 0 resta davanti.
     * eliminazioneInAttesa[posto] = indice del membro caduto.
     * @param {string} posto
     */
    function programmaEliminazione(posto) {
        const sq = squadre[posto];
        if (!sq || eliminazioneInAttesa[posto] != null) return;
        const caduto = sq.attivo;
        eliminazioneInAttesa[posto] = caduto;
        if (gameState.currentPlayer === posto) {
            if (typeof g.addToLog === 'function') g.addToLog(`💀 ${sq.membri[caduto].nome} è a 0 Life Point: esce dal duello alla fine del turno.`);
            return; // ci pensa eliminazioniInAttesa() al prossimo 'inizio-turno'
        }
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
     * A1: comincia il turno di `posto`. Si sceglie chi gioca (D2 obbligato:
     * si alternano; un eliminato non gioca più) e lo si fa entrare, prima di
     * scadenze, turno saltato e pescata. D17: chi entra con il Mazzo vuoto è
     * eliminato e gioca il compagno.
     * @param {string} posto
     */
    function inizioTurno(posto) {
        eliminazioniInAttesa();
        const sq = squadre[posto];
        if (!sq) return;
        let prossimo = sq.ultimo === null ? 0 : altro(sq.ultimo);
        if (!sq.membri[prossimo].vivo) prossimo = altro(prossimo);
        if (!sq.membri[prossimo].vivo) return;
        const compagno = altro(prossimo);
        if (mazzoVuoto(sq, prossimo) && sq.membri[compagno].vivo && !mazzoVuoto(sq, compagno)) {
            scambia(posto, prossimo);
            eliminaAttivo(posto, 'mazzo');
            prossimo = compagno;
        } else {
            scambia(posto, prossimo);
        }
        sq.ultimo = prossimo;
        avvisa('turno', posto);
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
     * Conta gli attacchi in corso avvolgendo Comandi.esegui (solo nel Tag
     * Team, a runtime: il file del motore non cambia). eseguiAttacco chiama
     * alTermine alla fine di ogni attacco, anche rifiutato.
     */
    function sorvegliaAttacchi() {
        const C = g.Comandi;
        if (!C || C.__tagSorvegliato) return;
        const originale = C.esegui;
        C.esegui = function (posto, cmd, extra) {
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
        sorvegliaAttacchi();
    }

    /**
     * Prepara un lato a due membri. Il primo membro è quello già preparato dal
     * motore (mano, Mazzo, campo nel posto); il secondo arriva con il suo
     * mazzo e pesca la sua mano iniziale qui.
     * @param {string} posto
     * @param {{ primo: any, secondo: any, mazzoSecondo: any, regolaLp: 'membro'|'lato', lp: { membro: number, lato: number }, manoIniziale?: number }} o
     *   primo/secondo: { nome, personaggio, controllore, livelloIA, identita }
     */
    function preparaSquadra(posto, o) {
        aggancia();
        const id0 = posto + '#0';
        const id1 = posto + '#1';
        segna(gameState[posto + 'Hand'], id0);
        segna(gameState[posto + 'Deck'], id0);
        segna(gameState[posto + 'ExtraDeck'], id0);

        const mazzo = (typeof g.buildDeckFromSpec === 'function' && o.mazzoSecondo) ? (g.buildDeckFromSpec(o.mazzoSecondo) || []) : [];
        const extra = (typeof g.buildExtraDeckFromSpec === 'function' && o.mazzoSecondo) ? g.buildExtraDeckFromSpec(o.mazzoSecondo) : [];
        segna(mazzo, id1);
        segna(extra, id1);
        const mano = [];
        const quante = o.manoIniziale === undefined ? 5 : o.manoIniziale;
        for (let i = 0; i < quante && mazzo.length > 0; i++) mano.push(mazzo.pop());

        const membro = (dati, id, stato) => ({
            id,
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
            membri: [
                membro(o.primo, id0, null),
                membro(o.secondo, id1, {
                    Hand: mano, Deck: mazzo, DeckCount: mazzo.length, ExtraDeck: extra,
                    MonsterField: Array(5).fill(null), STField: Array(5).fill(null), FieldSpell: null,
                    LP: lpMembro
                })
            ]
        };
        squadre[posto] = sq;
        gameState[posto + 'LP'] = o.regolaLp === 'membro' ? lpMembro : o.lp.lato;
        if (!gameState.personaggioPerPosto) gameState.personaggioPerPosto = { player: null, bot: null };
        gameState.personaggioPerPosto[posto] = sq.membri[0].personaggio;
        g.Tavolo.imposta({ [posto]: sq.membri[0].controllore });
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
        /** Vero se il posto è una squadra. @param {string} posto */
        eSquadra: (posto) => !!squadre[posto],
        /** Il membro davanti del posto (oggetto interno, sola lettura). @param {string} posto */
        membroAttivo: (posto) => (squadre[posto] ? squadre[posto].membri[squadre[posto].attivo] : null),
        /** Un membro qualsiasi del posto (oggetto interno, per i test). @param {string} posto @param {number} i */
        membro: (posto, i) => (squadre[posto] ? squadre[posto].membri[i] : null),
        /** @param {(evento: string, posto: string) => void} fn */
        ascolta: (fn) => { ascoltatori.push(fn); },
        /** Solo per i test: ricomincia da zero. */
        azzera: () => { squadre = { player: null, bot: null }; attacchiInCorso = 0; eliminazioneInAttesa = {}; },
        /** Diagnosi. */
        attacchiInCorso: () => attacchiInCorso
    };
    g.TagTeam = TagTeam;
})();
