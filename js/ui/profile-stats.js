// @ts-check
/**
 * profile-stats.js — Le statistiche del giocatore nel Profilo.
 * =====================================================================
 * Due blocchi: "In generale" (tutto il gioco) e "Per modalità" (una scheda per ogni modo di giocare, con i numeri che contano QUEL modo).
 * Richiesta dell'utente: "tutte le statistiche di ogni singola modalità e anche quelle generali".
 *
 * È un COMPONENTE montato da profilo.html (e, prima, anche dalla vista del menu): le copie della stessa schermata sono già andate alla
 * deriva più volte (vedi CLAUDE.md, "viste fuse"), quindi un pezzo nuovo si scrive una volta sola.
 *
 * Uso:   ProfileStats.render(elementoContenitore)
 *
 * Legge SOLO dal salvataggio (SaveManager) e dai cataloghi già caricati dalla pagina. Un catalogo mancante non è un errore: la voce mostra
 * il numero senza il "su quanti". I conti per modalità (duelli giocati/vinti/persi) vengono da js/stats/statistiche.js e PARTONO dal giorno
 * in cui quel modulo è arrivato (`dal`): lo dice la scheda, invece di far finta di avere la storia di prima. Le altre voci di ogni modalità
 * sono lo stato che quella modalità già teneva (Torre, Puzzle, Tornei...).
 */
(function () {
    'use strict';

    /**
     * Un catalogo se la pagina l'ha caricato, altrimenti null. I cataloghi sono `const` di primo livello nei loro file, e una `const` globale
     * NON diventa una proprietà di window: per questo si nominano uno per uno con `typeof`, che non lancia errori su un nome mai dichiarato.
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

    const NOMI_TORNEI = { duelistKingdom: 'Regno dei Duellanti', battleCity: 'Battle City', kaibaTournament: 'Torneo Kaiba' };
    const MS_SETTIMANA = 7 * 24 * 60 * 60 * 1000;
    const PRIMO_LUNEDI = Date.UTC(1970, 0, 5);
    /** La chiave della settimana come la scrivono Settimana e Caccia (numero di lunedì dall'epoca, ora del server se c'è). */
    function chiaveSettimana() {
        const adesso = (window.ServerDate && ServerDate.now) ? ServerDate.now().getTime() : Date.now();
        return String(Math.floor((adesso - PRIMO_LUNEDI) / MS_SETTIMANA));
    }

    // ---------------------------------------------------------------
    // I numeri
    // ---------------------------------------------------------------
    function calcola() {
        const save = (window.SaveManager && SaveManager.load()) || {};
        const modi = save.modalita || {};

        // --- Duelli: i totali di sempre vengono dal record per Duellante (lo scrive DuelSession.finish per ogni duello contro un personaggio).
        const records = save.records || {};
        let vinti = 0, persi = 0, piuBattuto = null, bestiaNera = null, duellantiBattuti = 0;
        Object.keys(records).forEach((id) => {
            const r = records[id] || {};
            const w = r.wins || 0, l = r.losses || 0;
            vinti += w; persi += l;
            if (w > 0) duellantiBattuti++;
            if (w > 0 && (!piuBattuto || w > piuBattuto.n)) piuBattuto = { id: id, n: w };
            if (l > 0 && (!bestiaNera || l > bestiaNera.n)) bestiaNera = { id: id, n: l };
        });
        const st = window.Statistiche ? Statistiche.leggi() : { dal: '', turni: 0, serieAttuale: 0, serieMigliore: 0, modalita: {} };
        let pareggi = 0;
        Object.keys(st.modalita).forEach((id) => { pareggi += (st.modalita[id] && st.modalita[id].pareggi) || 0; });
        const giocati = vinti + persi + pareggi;

        // --- Collezione
        const collezione = save.collection || {};
        const idPosseduti = Object.keys(collezione).filter((id) => collezione[id] > 0);
        const copie = idPosseduti.reduce((s, id) => s + collezione[id], 0);
        const carte = catalogo('cardDatabase');

        // --- Storie: si contano le chiavi di AVANZAMENTO, non quelle di servizio (`<id>@livello` tiene solo la scelta del livello).
        const storie = save.story || {};
        let tappe = 0, storieFinite = 0;
        Object.keys(storie).forEach((chiave) => {
            if (/@livello$/.test(chiave)) return;
            const s = storie[chiave] || {};
            tappe += s.completate || 0;
            if (s.finita) storieFinite++;
        });

        // --- Tornei (le statistiche sopravvivono ad Abbandona/Ricomincia)
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

        // --- Duellanti sbloccati (i due di partenza stanno nel codice, non nel salvataggio: vedi js/data/character-unlocks.js)
        const iniziali = (window.CharacterUnlocks && CharacterUnlocks.INIZIALI) || [];
        const sbloccati = new Set(iniziali.concat(Array.isArray(save.unlockedCharacters) ? save.unlockedCharacters : []));
        const roster = catalogo('characterDatabase');

        // --- Oggetti del Millennio
        const oggetti = Object.keys(save.millenniumItems || {}).length;
        const oggettiTotali = window.Rewards && Rewards.MILLENNIUM_ITEMS ? Object.keys(Rewards.MILLENNIUM_ITEMS).length : null;

        // --- Cose per modalità che hanno uno stato loro
        const sett = chiaveSettimana();
        const settimana = modi.settimana && modi.settimana.chiave === sett ? Object.keys(modi.settimana.vinte || {}).filter((k) => modi.settimana.vinte[k]).length : 0;
        const caccia = modi.caccia && modi.caccia.chiave === sett ? modi.caccia : null;
        const torre = Object.assign({ pianoMassimo: 0, tentativi: 0, conquiste: 0 }, (modi.torre && modi.torre.record) || {});
        const puzzle = modi.puzzle || {};
        const puzzleIds = Object.keys(puzzle);
        const puzzleRisolti = puzzleIds.filter((id) => puzzle[id] && puzzle[id].risolto).length;
        const puzzleStelle = puzzleIds.reduce((s, id) => s + ((puzzle[id] && puzzle[id].stelle) || 0), 0);
        const riv = modi.rivincite || {};
        let medaglieRivincite = 0;
        Object.keys(riv).forEach((id) => { medaglieRivincite += Object.keys((riv[id] && riv[id].vinte) || {}).filter((l) => riv[id].vinte[l]).length; });
        const online = modi.online || {};
        const tutorial = (save.tutorial && save.tutorial.lezioni) || {};
        const accessi = (modi.loginBonus && modi.loginBonus.accessi) || 0;

        return {
            giocati, vinti, persi, pareggi, st, piuBattuto, bestiaNera, duellantiBattuti,
            percentuale: giocati ? Math.round((vinti / giocati) * 100) : null,
            carteDiverse: idPosseduti.length, carteTotali: carte ? carte.length : null, copie,
            mazziComprati: Array.isArray(save.ownedPacks) ? save.ownedPacks.length : 0,
            tappe, storieFinite, torneiVinti, torneiTentati, tornei,
            sfideFatte, sfideTotali: catalogoSfide ? catalogoSfide.length : null,
            sbloccati: sbloccati.size, rosterTotale: roster ? roster.length : null,
            oggetti, oggettiTotali, accessi,
            settimana, caccia, torre, puzzleRisolti, puzzleTotali: puzzleIds.length, puzzleStelle, medaglieRivincite,
            bossOnline: Object.keys(online.bossBattuti || {}).length, serieOnline: online.serie || 0,
            lezioni: Object.keys(tutorial).filter((k) => tutorial[k]).length
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

    // `icona` è il nome di un'icona di js/ui/icon-library.js, non più un'emoji: le emoji di sistema stonavano accanto all'oro del resto.
    function voce(icona, valore, etichetta, extra) {
        return `<div class="pst-voce${extra && extra.classe ? ' ' + extra.classe : ''}">
            <span class="pst-icona" data-icon="${icona}" aria-hidden="true"></span>
            <span class="pst-valore">${valore}</span>
            <span class="pst-etichetta">${esc(etichetta)}</span>
            ${extra && extra.nota ? `<span class="pst-nota">${esc(extra.nota)}</span>` : ''}
        </div>`;
    }

    function gruppo(titolo, voci, nota) {
        return `<div class="pst-gruppo">
            <div class="pst-gruppo-titolo">${esc(titolo)}</div>
            ${nota ? `<div class="pst-gruppo-nota">${esc(nota)}</div>` : ''}
            <div class="pst-griglia">${voci.join('')}</div>
        </div>`;
    }

    /**
     * La scheda di una modalità: titolo con icona, la riga dei duelli (giocati / vinti / persi / %) e le voci sue (`righe`: [etichetta, valore HTML]).
     * `conta` è il conto uniforme di Statistiche; senza duelli contati la riga dice "nessun duello ancora" invece di una fila di zeri.
     */
    function scheda(m, conta, righe) {
        const duelli = conta && conta.giocati > 0
            ? `<div class="pst-mod-duelli">
                <span><strong>${conta.giocati}</strong><small>Duelli</small></span>
                <span class="pst-v"><strong>${conta.vinti}</strong><small>Vinti</small></span>
                <span class="pst-p"><strong>${conta.persi}</strong><small>Persi</small></span>
                <span><strong>${Math.round((conta.vinti / conta.giocati) * 100)}%</strong><small>Vittorie</small></span>
            </div>`
            : '<div class="pst-mod-vuoto">Nessun duello contato ancora</div>';
        return `<div class="pst-mod" data-modalita="${esc(m.id)}">
            <div class="pst-mod-testa"><span class="pst-mod-ico" data-icon="${m.icona}" aria-hidden="true"></span><span class="pst-mod-nome">${esc(m.nome)}</span></div>
            ${duelli}
            ${righe.length ? `<dl class="pst-mod-righe">${righe.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
        </div>`;
    }

    /** Una modalità qualunque tra quelle contate da Statistiche, con le sue voci specifiche (se la pagina non ha il modulo, nessuna scheda). */
    function schedeModalita(s) {
        const M = window.Statistiche ? Statistiche.MODALITA : [];
        const conta = (id) => (window.Statistiche ? Statistiche.di(id) : null);
        const m = (id) => M.find((x) => x.id === id) || { id: id, nome: id, icona: 'cards' };
        const righe = {
            libero: [['Duellanti battuti', suQuanti(s.duellantiBattuti, s.rosterTotale)], ['Duellanti sbloccati', suQuanti(s.sbloccati, s.rosterTotale)]],
            storia: [['Tappe completate', String(s.tappe)], ['Storie completate', String(s.storieFinite)]],
            tornei: Object.keys(s.tornei).filter((id) => s.tornei[id] && (s.tornei[id].attempts || s.tornei[id].completions)).map((id) => [
                NOMI_TORNEI[id] || id, `${(s.tornei[id].completions || 0)} <small>vinti su ${(s.tornei[id].attempts || 0)} ${(s.tornei[id].attempts || 0) === 1 ? 'tentativo' : 'tentativi'}</small>`
            ]),
            torre: [['Piano massimo', String(s.torre.pianoMassimo || 0)], ['Scalate iniziate', String(s.torre.tentativi || 0)], ['Torre conquistata', `${s.torre.conquiste || 0} <small>${(s.torre.conquiste || 0) === 1 ? 'volta' : 'volte'}</small>`]],
            rivincita: [['Medaglie delle Rivincite', String(s.medaglieRivincite)]],
            settimana: [['Livelli vinti questa settimana', `${s.settimana} <small>/ 3</small>`]],
            caccia: s.caccia
                ? [['Questa settimana', s.caccia.vinta ? 'Boss battuto' : `${s.caccia.tentativi || 0} ${(s.caccia.tentativi || 0) === 1 ? 'tentativo' : 'tentativi'}`], ['Record di turni', s.caccia.migliorTurni != null ? String(s.caccia.migliorTurni) : '—']]
                : [['Questa settimana', 'Non ancora cacciato']],
            tag: [],
            online: [['Serie di vittorie in corso', String(s.serieOnline)], ['Boss battuti in Assalto', String(s.bossOnline)]]
        };
        const schede = M.map((mod) => scheda(m(mod.id), conta(mod.id), righe[mod.id] || []));
        // Puzzle e Tutorial non sono duelli contati: solo le loro voci.
        schede.push(scheda({ id: 'puzzle', nome: 'Puzzle', icona: 'puzzle' }, null, [['Risolti', suQuanti(s.puzzleRisolti, s.puzzleTotali || null)], ['Stelle ottenute', String(s.puzzleStelle)]]).replace('<div class="pst-mod-vuoto">Nessun duello contato ancora</div>', ''));
        schede.push(scheda({ id: 'tutorial', nome: 'Tutorial', icona: 'rules' }, null, [['Lezioni completate', String(s.lezioni)]]).replace('<div class="pst-mod-vuoto">Nessun duello contato ancora</div>', ''));
        return schede;
    }

    function render(contenitore) {
        const el = typeof contenitore === 'string' ? document.querySelector(contenitore) : contenitore;
        if (!el) return;
        const s = calcola();
        el.classList.add('profile-stats');

        const generali = [
            voce('freeDuel', String(s.giocati), 'Duelli giocati'),
            voce('crown', String(s.vinti), 'Vittorie', { classe: 'pst-voce--vinti' }),
            voce('skull', String(s.persi), 'Sconfitte', { classe: 'pst-voce--persi' }),
            voce('medal', s.percentuale == null ? '—' : s.percentuale + '%', 'Percentuale di vittorie', { nota: s.pareggi ? `${s.pareggi} ${s.pareggi === 1 ? 'pareggio' : 'pareggi'}` : '' }),
            voce('target', String(s.st.serieMigliore), 'Serie di vittorie migliore', { nota: s.st.serieAttuale ? `in corso: ${s.st.serieAttuale}` : '' }),
            voce('calendar', String(s.st.turni), 'Turni giocati'),
            voce('target', s.piuBattuto ? esc(nomeDuellante(s.piuBattuto.id)) : '—', 'Avversario più battuto',
                { classe: 'pst-voce--nome', nota: s.piuBattuto ? `${s.piuBattuto.n} ${s.piuBattuto.n === 1 ? 'vittoria' : 'vittorie'}` : 'nessuno ancora' }),
            voce('skull', s.bestiaNera ? esc(nomeDuellante(s.bestiaNera.id)) : '—', 'Bestia nera',
                { classe: 'pst-voce--nome', nota: s.bestiaNera ? `${s.bestiaNera.n} ${s.bestiaNera.n === 1 ? 'sconfitta' : 'sconfitte'}` : 'nessuno ancora' })
        ];
        const collezione = [
            voce('cards', suQuanti(s.carteDiverse, s.carteTotali), 'Carte diverse'),
            voce('collection', String(s.copie), 'Copie in collezione'),
            voce('shop', String(s.mazziComprati), 'Mazzi acquistati'),
            voce('eye', suQuanti(s.oggetti, s.oggettiTotali), 'Oggetti del Millennio')
        ];
        const progressi = [
            voce('medal', suQuanti(s.sfideFatte, s.sfideTotali), 'Sfide completate'),
            voce('freeDuel', suQuanti(s.sbloccati, s.rosterTotale), 'Duellanti sbloccati'),
            voce('tournament', String(s.torneiVinti), 'Tornei vinti', { nota: s.torneiTentati ? `su ${s.torneiTentati} ${s.torneiTentati === 1 ? 'tentativo' : 'tentativi'}` : '' }),
            voce('story', String(s.tappe), 'Tappe della Storia', { nota: s.storieFinite ? `${s.storieFinite} ${s.storieFinite === 1 ? 'storia completata' : 'storie completate'}` : '' }),
            voce('calendar', String(s.accessi), 'Accessi giornalieri')
        ];
        const dal = s.st.dal ? `I conti per modalità partono dal ${s.st.dal.split('-').reverse().join('/')}: i duelli di prima sono solo nei totali.` : 'I conti per modalità partono dal prossimo duello.';

        el.innerHTML = `
            ${gruppo('In generale', generali)}
            ${gruppo('Collezione', collezione)}
            ${gruppo('Progressi', progressi)}
            <div class="pst-gruppo">
                <div class="pst-gruppo-titolo">Per modalità</div>
                <div class="pst-gruppo-nota">${esc(dal)}</div>
                <div class="pst-mod-griglia">${schedeModalita(s).join('')}</div>
            </div>`;
        if (window.Icons) Icons.hydrate(el);
    }

    window.ProfileStats = { render: render, calcola: calcola };
})();
