// @ts-check
/**
 * profile-stats.js — Le statistiche del giocatore nel Profilo.
 * =====================================================================
 * Sostituisce la sezione "Record Duello Libero" (una griglia di ritratti
 * con V/S per ogni Duellante), richiesta dell'utente: "nella pagina
 * profilo togli record duello libero: metti altre statistiche".
 *
 * È un COMPONENTE, montato sia dalla vista Profilo del menu (index.html)
 * sia da profilo.html: le due copie della stessa schermata sono già
 * andate alla deriva più volte (vedi CLAUDE.md, "viste fuse"), quindi
 * un pezzo nuovo si scrive una volta sola.
 *
 * Uso:   ProfileStats.render(elementoContenitore)
 *
 * Legge SOLO dal salvataggio (SaveManager) e dai cataloghi già caricati
 * dalla pagina. Un catalogo mancante non è un errore: la voce mostra il
 * numero senza il "su quanti" (profilo.html, per esempio, non carica il
 * database delle carte — caricarlo solo per scrivere "su 1131" sarebbe
 * un megabyte in più per un denominatore).
 */
(function () {
    'use strict';

    /**
     * Un catalogo se la pagina l'ha caricato, altrimenti null. I cataloghi
     * sono `const` di primo livello nei loro file, e una `const` globale
     * NON diventa una proprietà di window: per questo si nominano uno per
     * uno con `typeof`, che non lancia errori su un nome mai dichiarato.
     */
    function catalogo(nome) {
        switch (nome) {
            case 'characterDatabase': return typeof characterDatabase !== 'undefined' ? characterDatabase : null;
            case 'cardDatabase': return typeof cardDatabase !== 'undefined' ? cardDatabase : null;
            case 'challengesDatabase': return typeof challengesDatabase !== 'undefined' ? challengesDatabase : null;
            default: return null;
        }
    }

    function nomeDuellante(id) {
        const roster = catalogo('characterDatabase') || [];
        const c = roster.find((x) => x.id === id);
        return c ? c.name : id;
    }

    // ---------------------------------------------------------------
    // I numeri
    // ---------------------------------------------------------------
    function calcola() {
        const save = (window.SaveManager && SaveManager.load()) || {};

        // --- Duelli: tutti, qualunque modalità (il record per Duellante
        // lo scrive DuelSession.finish per ogni duello contro un
        // personaggio del roster).
        const records = save.records || {};
        let vinti = 0, persi = 0, piuBattuto = null, bestiaNera = null;
        Object.keys(records).forEach((id) => {
            const r = records[id] || {};
            const w = r.wins || 0, l = r.losses || 0;
            vinti += w; persi += l;
            if (w > 0 && (!piuBattuto || w > piuBattuto.n)) piuBattuto = { id: id, n: w };
            if (l > 0 && (!bestiaNera || l > bestiaNera.n)) bestiaNera = { id: id, n: l };
        });
        const giocati = vinti + persi;

        // --- Collezione
        const collezione = save.collection || {};
        const idPosseduti = Object.keys(collezione).filter((id) => collezione[id] > 0);
        const copie = idPosseduti.reduce((s, id) => s + collezione[id], 0);
        const carte = catalogo('cardDatabase');

        // --- Storie: si contano le chiavi di AVANZAMENTO, non quelle di
        // servizio (`<id>@livello` tiene solo la scelta del livello).
        const storie = save.story || {};
        let tappe = 0, storieFinite = 0;
        Object.keys(storie).forEach((chiave) => {
            if (/@livello$/.test(chiave)) return;
            const s = storie[chiave] || {};
            tappe += s.completate || 0;
            if (s.finita) storieFinite++;
        });

        // --- Tornei (statistiche che sopravvivono ad Abbandona/Ricomincia)
        const tornei = save.tournamentStats || {};
        let torneiVinti = 0, torneiTentati = 0;
        Object.keys(tornei).forEach((id) => {
            torneiVinti += (tornei[id] && tornei[id].completions) || 0;
            torneiTentati += (tornei[id] && tornei[id].attempts) || 0;
        });

        // --- Sfide
        const sfide = save.challenges || {};
        const sfideFatte = Object.keys(sfide).filter((id) => sfide[id] && sfide[id].completed).length;
        const catalogoSfide = catalogo('challengesDatabase');

        // --- Duellanti sbloccati (i due di partenza stanno nel codice,
        // non nel salvataggio: vedi js/data/character-unlocks.js)
        const iniziali = (window.CharacterUnlocks && CharacterUnlocks.INIZIALI) || [];
        const sbloccati = new Set(iniziali.concat(Array.isArray(save.unlockedCharacters) ? save.unlockedCharacters : []));
        const roster = catalogo('characterDatabase');

        // --- Oggetti del Millennio
        const oggetti = Object.keys(save.millenniumItems || {}).length;
        const oggettiTotali = window.Rewards && Rewards.MILLENNIUM_ITEMS ? Object.keys(Rewards.MILLENNIUM_ITEMS).length : null;

        return {
            giocati, vinti, persi, piuBattuto, bestiaNera,
            percentuale: giocati ? Math.round((vinti / giocati) * 100) : null,
            carteDiverse: idPosseduti.length, carteTotali: carte ? carte.length : null, copie,
            mazziComprati: Array.isArray(save.ownedPacks) ? save.ownedPacks.length : 0,
            tappe, storieFinite, torneiVinti, torneiTentati,
            sfideFatte, sfideTotali: catalogoSfide ? catalogoSfide.length : null,
            sbloccati: sbloccati.size, rosterTotale: roster ? roster.length : null,
            oggetti, oggettiTotali
        };
    }

    // ---------------------------------------------------------------
    // Il disegno
    // ---------------------------------------------------------------
    function esc(t) {
        return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    /** "12" oppure "12 / 40" se si sa su quanti. */
    function suQuanti(n, totale) {
        return totale != null ? `${n}<small> / ${totale}</small>` : String(n);
    }

    // `icona` è il nome di un'icona di js/ui/icon-library.js, non più
    // un'emoji: le emoji di sistema stonavano accanto all'oro del resto.
    function voce(icona, valore, etichetta, extra) {
        return `<div class="pst-voce${extra && extra.classe ? ' ' + extra.classe : ''}">
            <span class="pst-icona" data-icon="${icona}" aria-hidden="true"></span>
            <span class="pst-valore">${valore}</span>
            <span class="pst-etichetta">${esc(etichetta)}</span>
            ${extra && extra.nota ? `<span class="pst-nota">${esc(extra.nota)}</span>` : ''}
        </div>`;
    }

    function gruppo(titolo, voci) {
        return `<div class="pst-gruppo">
            <div class="pst-gruppo-titolo">${esc(titolo)}</div>
            <div class="pst-griglia">${voci.join('')}</div>
        </div>`;
    }

    function render(contenitore) {
        const el = typeof contenitore === 'string' ? document.querySelector(contenitore) : contenitore;
        if (!el) return;
        const s = calcola();
        el.classList.add('profile-stats');

        // Vittorie, sconfitte, duelli giocati e la percentuale li mostra la
        // testata del Profilo (js/ui/profile-hero.js), subito sopra: qui
        // non si ripetono.
        const duelli = [
            voce('target', s.piuBattuto ? esc(nomeDuellante(s.piuBattuto.id)) : '—', 'Avversario più battuto',
                { classe: 'pst-voce--nome', nota: s.piuBattuto ? `${s.piuBattuto.n} ${s.piuBattuto.n === 1 ? 'vittoria' : 'vittorie'}` : 'nessuno ancora' }),
            voce('skull', s.bestiaNera ? esc(nomeDuellante(s.bestiaNera.id)) : '—', 'Bestia nera',
                { classe: 'pst-voce--nome', nota: s.bestiaNera ? `${s.bestiaNera.n} ${s.bestiaNera.n === 1 ? 'sconfitta' : 'sconfitte'}` : 'nessuno ancora' })
        ];
        const collezione = [
            voce('cards', suQuanti(s.carteDiverse, s.carteTotali), 'Carte diverse'),
            voce('collection', String(s.copie), 'Copie in collezione'),
            voce('shop', String(s.mazziComprati), 'Mazzi acquistati')
        ];
        const progressi = [
            voce('story', String(s.tappe), 'Tappe della Storia'),
            voce('crown', String(s.storieFinite), 'Storie completate'),
            voce('tournament', String(s.torneiVinti), 'Tornei vinti', { nota: s.torneiTentati ? `su ${s.torneiTentati} ${s.torneiTentati === 1 ? 'tentativo' : 'tentativi'}` : '' }),
            voce('medal', suQuanti(s.sfideFatte, s.sfideTotali), 'Sfide completate'),
            voce('freeDuel', suQuanti(s.sbloccati, s.rosterTotale), 'Duellanti sbloccati'),
            voce('eye', suQuanti(s.oggetti, s.oggettiTotali), 'Oggetti del Millennio')
        ];

        el.innerHTML = `
            ${gruppo('Duelli', duelli)}
            ${gruppo('Collezione', collezione)}
            ${gruppo('Progressi', progressi)}`;
        if (window.Icons) Icons.hydrate(el);
    }

    window.ProfileStats = { render: render, calcola: calcola };
})();
