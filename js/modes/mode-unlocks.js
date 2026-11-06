// @ts-check
/**
 * mode-unlocks.js — requisiti di accesso alle modalità extra.
 *
 * Il menu e le pagine autonome devono leggere la STESSA regola: altrimenti
 * nascondere o disabilitare una voce non impedirebbe di aprirne direttamente
 * l'URL. Le ricompense e lo sblocco dei livelli della Storia restano nei loro
 * moduli; qui si traduce soltanto quel progresso in accesso alle modalità.
 */
(function (g) {
    'use strict';

    function statoStoria(id) {
        return (g.SaveManager && SaveManager.getStoryState(id)) || {};
    }

    /** La campagna risulta conclusa in almeno una difficoltà. */
    function storiaFinitaUnaVolta(campaignId) {
        return [campaignId, campaignId + '@normale', campaignId + '@difficile']
            .some((id) => statoStoria(id).finita === true);
    }

    /**
     * I capitoli completati vengono memorizzati da CardAcquisition a ogni
     * avanzamento della Storia. Il fallback sulla storia intera copre anche
     * salvataggi molto vecchi: chi ha già concluso l'anime ha necessariamente
     * superato il Regno dei Duellanti.
     */
    function capitoloAnimeCompletato(chapterId) {
        const acquisizioni = (g.SaveManager && SaveManager.getCardAcquisitionState)
            ? SaveManager.getCardAcquisitionState() : {};
        return !!(acquisizioni && acquisizioni.completedChapters
            && acquisizioni.completedChapters[chapterId])
            || storiaFinitaUnaVolta('anime');
    }

    // ---- Duello della Settimana e Tornei: sbloccati dal progresso (richiesta dell'utente) ----
    /** Quante carte DIVERSE ci sono nella collezione (un'amministratore le ha tutte). */
    const CARTE_PER_SETTIMANA = 300;
    function carteDiverse() {
        if (g.CloudSync && typeof CloudSync.isAdmin === 'function' && CloudSync.isAdmin()) return Infinity;
        const raccolta = (g.SaveManager && SaveManager.getCollection) ? SaveManager.getCollection() : {};
        return Object.keys(raccolta).filter((id) => Number(raccolta[id]) > 0).length;
    }

    /** Il torneo e' gia' cominciato su questo dispositivo: chi lo aveva aperto prima di questa regola non viene chiuso fuori. */
    function torneoIniziato(idTorneo) {
        return !!(g.SaveManager && SaveManager.getTournamentState && SaveManager.getTournamentState(idTorneo));
    }

    /**
     * Kaiba battuto nel torneo di Forbidden Memories (Storia, "Cinquemila anni dopo"): la prova 'fm-3t-kaiba' dentro 'fm-3-torneo'
     * superata a qualunque livello, o la storia finita. Una volta vero si RICORDA (cardAcquisition.torneiSbloccati): un "Ricomincia"
     * della Storia non deve richiudere un torneo.
     */
    function kaibaFmBattuto() {
        const acq = (g.SaveManager && SaveManager.getCardAcquisitionState) ? SaveManager.getCardAcquisitionState() : {};
        if (acq && acq.torneiSbloccati && acq.torneiSbloccati.kaiba) return true;
        // La posizione della prova di Kaiba fra quelle del torneo si legge dal catalogo se la pagina lo ha caricato; il menu non lo
        // carica (e' enorme): vale la posizione attuale (decima prova, indice 9), sorvegliata da tests/specs/torneo-sblocchi-progresso.
        let idx = 9;
        const db = g.storyCampaignsDatabase;
        const camp = db && db.find((c) => c.id === 'forbiddenMemories');
        if (camp) {
            /** @type {any} */ let torneo = null;
            (function cerca(elenco) { (elenco || []).forEach((t) => { if (t.id === 'fm-3-torneo') torneo = t; else if (t.tappe) cerca(t.tappe); }); })(
                (camp.capitoli || []).reduce((tutte, c) => tutte.concat(c.tappe || []), []));
            const trovato = torneo ? (torneo.tappe || []).filter((t) => t.parallelo !== true).findIndex((t) => t.id === 'fm-3t-kaiba') : -1;
            if (trovato >= 0) idx = trovato;
        }
        const fatto = ['forbiddenMemories', 'forbiddenMemories@normale', 'forbiddenMemories@difficile'].some((k) => {
            const s = statoStoria(k);
            return s.finita === true || (s.sotto && Number(s.sotto['fm-3-torneo']) > idx);
        });
        if (fatto && g.SaveManager && SaveManager.setCardAcquisitionState) {
            acq.torneiSbloccati = Object.assign({}, acq.torneiSbloccati, { kaiba: true });
            SaveManager.setCardAcquisitionState(acq);
        }
        return fatto;
    }

    // I test (come per il gate di accesso, AUTH_GATE_SKIP) saltano questi blocchi, tranne lo spec che li prova (MODE_UNLOCKS_REALI).
    const BLOCCHI_DEL_PROGRESSO = ['settimana', 'caccia', 'tornei', 'torneo-regno', 'torneo-battlecity', 'torneo-kaiba'];

    function statoProgresso(modeId) {
        if (g.AUTH_GATE_SKIP && !/** @type {any} */ (g).MODE_UNLOCKS_REALI) return { sbloccato: true, motivo: '' };
        // La voce Tornei del menu e' bloccata solo se lo sono TUTTI i tornei che contiene.
        if (modeId === 'tornei') {
            const ok = ['torneo-regno', 'torneo-battlecity', 'torneo-kaiba'].some((id) => statoProgresso(id).sbloccato);
            return { sbloccato: ok, motivo: ok ? '' : 'Tutti i tornei sono ancora chiusi: completa l\'arco "Il Regno dei Duellanti" nella Storia anime per sbloccare il primo.' };
        }
        if (modeId === 'settimana') {
            const n = carteDiverse();
            const ok = n >= CARTE_PER_SETTIMANA;
            return { sbloccato: ok, motivo: ok ? '' : `Servono ${CARTE_PER_SETTIMANA} carte diverse nella collezione per sbloccare il Duello della Settimana (ne hai ${n}).` };
        }
        if (modeId === 'caccia') {
            const ok = capitoloAnimeCompletato('virtuale');
            return { sbloccato: ok, motivo: ok ? '' : 'Completa l\'arco "Il Mondo Virtuale" nella Storia anime per sbloccare la Caccia al Boss.' };
        }
        if (modeId === 'torneo-regno') {
            const ok = torneoIniziato('duelistKingdom') || capitoloAnimeCompletato('regno');
            return { sbloccato: ok, motivo: ok ? '' : 'Completa l\'arco "Il Regno dei Duellanti" nella Storia anime per sbloccare questo torneo.' };
        }
        if (modeId === 'torneo-battlecity') {
            const ok = torneoIniziato('battleCity') || capitoloAnimeCompletato('battlecity2');
            return { sbloccato: ok, motivo: ok ? '' : 'Completa l\'arco "Battle City - Parte 2" nella Storia anime per sbloccare questo torneo.' };
        }
        const ok = torneoIniziato('kaibaTournament') || kaibaFmBattuto();
        return { sbloccato: ok, motivo: ok ? '' : 'Sconfiggi Kaiba nel torneo del presente di Memorie Proibite (Storia) per sbloccare questo torneo.' };
    }

    /** Le due catene in croce e il sigillo con la serratura: lo stesso overlay delle tessere bloccate del menu (menu-mobile.css). */
    const CATENE_HTML = '<span class="mm-catene" aria-hidden="true"><i class="mm-catena mm-catena--a"></i><i class="mm-catena mm-catena--b"></i>'
        + '<span class="mm-sigillo"><svg viewBox="0 0 24 24"><path d="M12 5.2a3.6 3.6 0 0 0-1.9 6.7L9 18.6h6l-1.1-6.7A3.6 3.6 0 0 0 12 5.2z" fill="currentColor"/></svg></span></span>';

    function stato(modeId) {
        if (BLOCCHI_DEL_PROGRESSO.indexOf(modeId) !== -1) return statoProgresso(modeId);
        if (modeId === 'rivincite') {
            const sbloccato = storiaFinitaUnaVolta('anime');
            return {
                sbloccato,
                motivo: sbloccato ? '' : 'Completa la Storia anime a qualsiasi difficoltà per sbloccare le Rivincite.'
            };
        }
        if (modeId === 'torre') {
            const sbloccato = capitoloAnimeCompletato('regno');
            return {
                sbloccato,
                motivo: sbloccato ? '' : 'Completa il Regno dei Duellanti nella Storia per sbloccare la Torre.'
            };
        }
        return { sbloccato: true, motivo: '' };
    }

    /** Impedisce che l'URL diretto aggiri il blocco mostrato nel menu. */
    function proteggiPagina(modeId) {
        const accesso = stato(modeId);
        if (accesso.sbloccato) return true;
        try { sessionStorage.setItem('ygoModalitaBloccata', accesso.motivo); } catch (e) { /* noop */ }
        window.location.replace('index.html');
        return false;
    }

    g.ModeUnlocks = {
        stato,
        proteggiPagina,
        storiaFinitaUnaVolta,
        capitoloAnimeCompletato,
        carteDiverse,
        CATENE_HTML
    };
})(window);
