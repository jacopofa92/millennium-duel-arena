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

    function stato(modeId) {
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
        capitoloAnimeCompletato
    };
})(window);
