// @ts-check
/**
 * story-ritocchi.js — le modifiche dell'Editor Mappa, applicate al catalogo.
 * =====================================================================
 * Richiesta dell'utente: modificare i nodi delle storie dall'editor nel
 * gioco senza passare dall'IDE ("non posso modificare i file fisicamente:
 * non c'è un workaround?").
 *
 * Il catalogo (js/data/story-campaigns.js) è scritto a mano, con commenti
 * e righe che contengono più proprietà: riscriverlo a pezzi da un browser
 * rischierebbe di romperlo. Le modifiche dell'editor vivono quindi in un
 * file SUO, js/data/story-ritocchi.js, che l'editor riscrive per intero a
 * ogni salvataggio (niente da rompere: è tutto generato). Questo modulo,
 * caricato subito dopo i due, li unisce:
 *
 *   modifiche  { [id tappa]: { proprietà: valore } } — `null` toglie la
 *              proprietà (torna a ereditare, es. field/music dalla campagna);
 *   aggiunte   [{ campagna, capitolo | percorso, dopo, tappa }] — una tappa
 *              nuova, messa dopo la tappa `dopo` (null = in testa) nel
 *              capitolo o dentro l'area/torneo `percorso`;
 *   rimosse    [id tappa] — tappe tolte.
 *
 * Solo le proprietà semplici che l'editor sa modificare (PROPRIETA): la
 * struttura (dialoghi a più voci, mappe, livelli) resta del catalogo.
 *
 * Prima di applicare si tiene una COPIA del catalogo com'è nel file: è da
 * lì che l'editor calcola le differenze da scrivere (`differenze`), così
 * il file dei ritocchi contiene sempre e solo ciò che è diverso.
 *
 * Attenzione, e lo ricorda anche l'editor: l'avanzamento delle storie si
 * salva per POSIZIONE. Aggiungere o togliere una tappa prima di dove è
 * arrivato un giocatore gli sposta l'avanzamento: per una storia già
 * giocata da altri va fatto nel catalogo, con una `separazione`.
 *
 * Va caricato DOPO js/data/story-campaigns.js e js/data/story-ritocchi.js
 * (lo sorveglia tests/specs/guardrail-ritocchi-storia.spec.js).
 */
(function () {
    'use strict';

    /** Le proprietà di una tappa che l'editor modifica e i ritocchi possono cambiare. */
    const PROPRIETA = ['label', 'icona', 'x', 'y', 'field', 'music', 'characterId', 'difficulty', 'chi', 'chiId', 'io', 'testo', 'dialogo', 'nome'];

    function catalogo() {
        if (typeof storyCampaignsDatabase !== 'undefined') return storyCampaignsDatabase;
        return Array.isArray(window.storyCampaignsDatabase) ? window.storyCampaignsDatabase : [];
    }
    function clona(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

    /** Ogni elenco di tappe: quelli dei capitoli e quelli dentro un'area o un torneo. */
    function contenitori(campagne) {
        const out = [];
        (campagne || []).forEach((c) => (c.capitoli || []).forEach((cap) => {
            if (!Array.isArray(cap.tappe)) return;
            out.push({ campagna: c.id, capitolo: cap.id, tappe: cap.tappe });
            cap.tappe.forEach((t) => {
                if ((t.kind === 'area' || t.kind === 'torneo') && Array.isArray(t.tappe)) {
                    out.push({ campagna: c.id, percorso: t.id, tappe: t.tappe });
                }
            });
        }));
        return out;
    }
    function stessoContenitore(a, b) {
        return a.campagna === b.campagna && (a.capitolo ? a.capitolo === b.capitolo : (!b.capitolo && a.percorso === b.percorso));
    }

    /**
     * Applica i ritocchi alle campagne (le MODIFICA). Torna gli id che non
     * hanno trovato dove andare: una tappa tolta o rinominata nel catalogo
     * dopo che il ritocco era stato scritto. Non è un errore che ferma il
     * gioco: il ritocco si salta e lo si dice in console.
     */
    function applica(campagne, ritocchi) {
        const persi = [];
        if (!ritocchi) return persi;
        (ritocchi.rimosse || []).forEach((id) => {
            contenitori(campagne).forEach((k) => {
                const i = k.tappe.findIndex((t) => t.id === id);
                if (i !== -1) k.tappe.splice(i, 1);
            });
        });
        (ritocchi.aggiunte || []).forEach((a) => {
            if (!a || !a.tappa || !a.tappa.id) return;
            const k = contenitori(campagne).find((x) => stessoContenitore(a, x));
            if (!k) { persi.push(a.tappa.id); return; }
            if (k.tappe.some((t) => t.id === a.tappa.id)) return;
            let pos = 0;
            if (a.dopo) {
                const i = k.tappe.findIndex((t) => t.id === a.dopo);
                pos = i === -1 ? k.tappe.length : i + 1;
            }
            k.tappe.splice(pos, 0, clona(a.tappa));
        });
        const perId = new Map();
        contenitori(campagne).forEach((k) => k.tappe.forEach((t) => perId.set(t.id, t)));
        Object.keys(ritocchi.modifiche || {}).forEach((id) => {
            const t = perId.get(id);
            if (!t) { persi.push(id); return; }
            const m = ritocchi.modifiche[id] || {};
            Object.keys(m).forEach((p) => {
                if (PROPRIETA.indexOf(p) === -1) return;
                if (m[p] === null) delete t[p];
                else t[p] = clona(m[p]);
            });
        });
        return persi;
    }

    /**
     * I ritocchi che portano `originale` ad `attuale` (le campagne come le ha
     * lasciate l'editor). L'ordine delle tappe esistenti non cambia mai
     * dall'editor, quindi basta guardare cosa c'è in più, in meno, e quali
     * proprietà sono cambiate. Le tappe DENTRO un'area nuova viaggiano con
     * l'area stessa.
     */
    function differenze(originale, attuale) {
        const modifiche = {};
        const aggiunte = [];
        const rimosse = [];
        const contOrig = contenitori(originale);
        const tappeOrig = new Map();
        contOrig.forEach((k) => k.tappe.forEach((t) => tappeOrig.set(t.id, t)));
        const presenti = new Set();
        contenitori(attuale).forEach((k) => {
            const esisteva = contOrig.some((x) => stessoContenitore(k, x));
            k.tappe.forEach((t, i) => {
                presenti.add(t.id);
                if (!esisteva) return;
                const o = tappeOrig.get(t.id);
                if (!o) {
                    const voce = { campagna: k.campagna };
                    if (k.capitolo) voce.capitolo = k.capitolo; else voce.percorso = k.percorso;
                    voce.dopo = i > 0 ? k.tappe[i - 1].id : null;
                    voce.tappa = clona(t);
                    aggiunte.push(voce);
                    return;
                }
                const diverse = {};
                PROPRIETA.forEach((p) => {
                    if (JSON.stringify(t[p]) === JSON.stringify(o[p])) return;
                    diverse[p] = t[p] === undefined ? null : clona(t[p]);
                });
                if (Object.keys(diverse).length) modifiche[t.id] = diverse;
            });
        });
        tappeOrig.forEach((t, id) => { if (!presenti.has(id)) rimosse.push(id); });
        return { modifiche: modifiche, aggiunte: aggiunte, rimosse: rimosse };
    }

    /** Il testo intero di js/data/story-ritocchi.js per questi ritocchi. */
    function testoDelFile(ritocchi) {
        return '// GENERATO dall\'Editor Mappa (js/dev/story-map-editor.js, "📂 Collega file").\n'
            + '// Le modifiche fatte dall\'editor ai nodi delle storie, rispetto al catalogo\n'
            + '// js/data/story-campaigns.js: le applica js/story/story-ritocchi.js.\n'
            + '// L\'editor riscrive questo file PER INTERO a ogni salvataggio: modificarlo a\n'
            + '// mano si può, ma la prossima modifica dall\'editor lo sovrascrive.\n'
            + 'window.storyRitocchi = ' + JSON.stringify({
                modifiche: ritocchi.modifiche || {},
                aggiunte: ritocchi.aggiunte || [],
                rimosse: ritocchi.rimosse || []
            }, null, 4) + ';\n';
    }

    // Copia del catalogo com'è nel file, PRIMA dei ritocchi: la base da cui
    // l'editor calcola cosa scrivere.
    const originale = clona(catalogo());
    const persi = applica(catalogo(), window.storyRitocchi);
    if (persi.length && window.console) {
        console.warn('[StoryRitocchi] ritocchi senza una tappa a cui applicarsi (tolta o rinominata nel catalogo):', persi.join(', '));
    }

    window.StoryRitocchi = {
        PROPRIETA: PROPRIETA,
        /** Una copia nuova del catalogo senza ritocchi. */
        originale: () => clona(originale),
        applica: applica,
        differenze: differenze,
        testoDelFile: testoDelFile,
        /** I ritocchi che portano il catalogo del file a quello attuale in memoria. */
        attuali: () => differenze(originale, catalogo()),
        persi: persi
    };
})();
