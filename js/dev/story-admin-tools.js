// @ts-check
/**
 * Strumenti amministrativi per collaudare le campagne senza attraversare
 * manualmente centinaia di nodi. Non assegna premi: modifica soltanto la
 * fotografia del percorso nel salvataggio corrente.
 */
(function () {
    'use strict';

    const LIVELLI = ['facile', 'normale', 'difficile'];

    function isAdmin() {
        return !!(window.CloudSync && typeof CloudSync.isAdmin === 'function' && CloudSync.isAdmin());
    }

    function chiave(campagnaId, livello) {
        return livello === 'facile' ? campagnaId : campagnaId + '@' + livello;
    }

    function statoCompleto(campagna) {
        const tappe = (campagna.capitoli || []).flatMap((capitolo) => capitolo.tappe || []);
        const sotto = {};
        const laterali = {};
        tappe.forEach((tappa) => {
            if (tappa.kind !== 'area' && tappa.kind !== 'torneo') return;
            const prove = tappa.tappe || [];
            sotto[tappa.id] = prove.filter((prova) => prova.parallelo !== true).length;
            prove.filter((prova) => prova.parallelo === true).forEach((prova) => {
                laterali[tappa.id + ':' + prova.id] = true;
            });
        });
        return {
            completate: tappe.length,
            finita: true,
            // Lo sblocco amministrativo non è un completamento giocato:
            // niente premio finale ora, né al primo accesso alla mappa.
            premiata: true,
            sotto: sotto,
            laterali: laterali,
            separazioni: (campagna.separazioni || []).map((s) => s.id)
        };
    }

    function completaTutteLeStorie() {
        if (!isAdmin()) return { ok: false, motivo: 'Solo un amministratore può usare questo strumento.' };
        if (!window.SaveManager || !Array.isArray(window.storyCampaignsDatabase)) {
            return { ok: false, motivo: 'Dati delle storie o salvataggio non disponibili.' };
        }

        let statiScritti = 0;
        const giocabili = storyCampaignsDatabase.filter((campagna) =>
            (campagna.capitoli || []).some((capitolo) => (capitolo.tappe || []).length));
        giocabili.forEach((campagna) => {
            const completo = statoCompleto(campagna);
            if (campagna.senzaLivelli) {
                SaveManager.setStoryState(campagna.id, completo);
                statiScritti++;
                return;
            }
            LIVELLI.forEach((livello) => {
                SaveManager.setStoryState(chiave(campagna.id, livello), Object.assign({}, completo));
                statiScritti++;
            });
            SaveManager.setStoryState(campagna.id + '@livello', { livello: 'facile', sbloccati: true });
        });
        return { ok: true, campagne: giocabili.length, stati: statiScritti };
    }

    window.StoryAdminTools = { completaTutteLeStorie: completaTutteLeStorie };
})();
