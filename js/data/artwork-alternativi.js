/**
 * artwork-alternativi.js — le illustrazioni ufficiali ALTERNATIVE delle carte.
 * =====================================================================
 * Una carta Yu-Gi-Oh ha spesso piu' di un'illustrazione ufficiale (il Drago
 * Bianco Occhi Blu ne ha 8). L'originale e' sempre images/cards/<id>.jpg; le
 * altre stanno in images/cards/alt/<id>-<n>.jpg (n = 1.. nell'ordine del
 * catalogo qui sotto) con la miniatura in images/cards/alt/thumbs/<id>-<n>.webp
 * (scripts/build-ui-thumbnails.js, lavoro 'carte-alt').
 *
 * COME SI SBLOCCANO. Ogni illustrazione dichiara `sblocco`: l'id di una SFIDA
 * (js/data/challenges-db.js). Completandola, Rewards.forChallenge sblocca tutte
 * le illustrazioni che la nominano e le elenca fra i premi, con la loro
 * spiegazione. Vale anche all'indietro: una Sfida gia' completata prima che
 * questo catalogo esistesse sblocca comunque le sue illustrazioni (si legge
 * dal salvataggio, vedi `sbloccata`). Le fonti sono imprese a difficolta' Difficile: la Storia
 * (Anime, Memorie Proibite), i tre Tornei e la Torre dei Duellanti. Per
 * cambiare dove si vince un'illustrazione basta cambiare il suo `sblocco`:
 * nient'altro dipende da quel valore.
 *
 * L'amministratore le ha tutte (come per le valute, calcolato alla lettura:
 * non si scrive nulla nel salvataggio).
 *
 * LA SCELTA e' per carta (`scegli`) e vale OVUNQUE si disegni quella carta —
 * Cartoteca, mazzi, duello — perche' getCardImagePath/getCardThumbPath
 * (js/ui/card-renderer.js) chiedono qui prima del percorso di sempre. In
 * Multiplayer ognuno vede le proprie scelte sul proprio schermo: l'aspetto non
 * viaggia, e non puo' cambiare nessuna regola.
 *
 * Da dove arriva il catalogo: YGOPRODeck (card_images). Il collegamento fra una
 * carta del gioco e la sua scheda ufficiale e' in docs/planning/
 * ARTWORK_ALTERNATIVI_CERNITA.md, con le carte il cui abbinamento non e' certo;
 * per ognuna delle 43 qui sotto l'illustrazione ORIGINALE e' stata confrontata
 * pixel per pixel con quelle ufficiali, e l'originale NON compare fra le
 * alternative (sarebbe un doppione).
 */
(function () {
    'use strict';

    /** id carta -> elenco delle illustrazioni alternative, nell'ordine di n. */
    const CATALOGO = {
    1: [{ n: 1, sblocco: 'torre-piano-15' }, { n: 2, sblocco: 'tournament-duelistKingdom-difficile' }, { n: 3, sblocco: 'storia-anime-difficile' }, { n: 4, sblocco: 'tournament-battleCity-difficile' }, { n: 5, sblocco: 'storia-forbiddenMemories-difficile' }, { n: 6, sblocco: 'tournament-kaiba-difficile' }, { n: 7, sblocco: 'torre-conquistata' }], // Drago Bianco Occhi Blu
    2: [{ n: 1, sblocco: 'tournament-duelistKingdom-difficile' }, { n: 2, sblocco: 'storia-anime-difficile' }, { n: 3, sblocco: 'tournament-battleCity-difficile' }, { n: 4, sblocco: 'storia-forbiddenMemories-difficile' }, { n: 5, sblocco: 'tournament-kaiba-difficile' }, { n: 6, sblocco: 'torre-conquistata' }, { n: 7, sblocco: 'torre-piano-15' }, { n: 8, sblocco: 'tournament-duelistKingdom-difficile' }], // Mago Nero
    4: [{ n: 1, sblocco: 'storia-anime-difficile' }, { n: 2, sblocco: 'tournament-battleCity-difficile' }], // Guardiano Celtico
    12: [{ n: 1, sblocco: 'tournament-battleCity-difficile' }, { n: 2, sblocco: 'storia-forbiddenMemories-difficile' }, { n: 3, sblocco: 'tournament-kaiba-difficile' }, { n: 4, sblocco: 'torre-conquistata' }, { n: 5, sblocco: 'torre-piano-15' }], // Drago Nero Occhi Rossi
    13: [{ n: 1, sblocco: 'storia-forbiddenMemories-difficile' }, { n: 2, sblocco: 'tournament-kaiba-difficile' }, { n: 3, sblocco: 'torre-conquistata' }], // Teschio Evocato
    14: [{ n: 1, sblocco: 'tournament-kaiba-difficile' }], // Gaia il Cavaliere
    17: [{ n: 1, sblocco: 'torre-conquistata' }], // Jinzo
    20: [{ n: 1, sblocco: 'torre-piano-15' }], // Combattente delle Lame
    22: [{ n: 1, sblocco: 'tournament-duelistKingdom-difficile' }, { n: 2, sblocco: 'storia-anime-difficile' }], // Kuriboh
    24: [{ n: 1, sblocco: 'storia-anime-difficile' }], // Elfi Gemelli
    30: [{ n: 1, sblocco: 'tournament-battleCity-difficile' }, { n: 2, sblocco: 'storia-forbiddenMemories-difficile' }], // Obelisk il Tormentatore
    31: [{ n: 1, sblocco: 'storia-forbiddenMemories-difficile' }, { n: 2, sblocco: 'tournament-kaiba-difficile' }], // Slifer il Drago del Cielo
    58: [{ n: 1, sblocco: 'tournament-kaiba-difficile' }], // Spadaccino di Fuoco
    104: [{ n: 1, sblocco: 'torre-conquistata' }], // Drago Revolver
    165: [{ n: 1, sblocco: 'torre-piano-15' }], // Virus Distruggi-Carte
    188: [{ n: 1, sblocco: 'tournament-duelistKingdom-difficile' }, { n: 2, sblocco: 'storia-anime-difficile' }, { n: 3, sblocco: 'tournament-battleCity-difficile' }, { n: 4, sblocco: 'storia-forbiddenMemories-difficile' }, { n: 5, sblocco: 'tournament-kaiba-difficile' }], // Ragazza Maga Nera
    189: [{ n: 1, sblocco: 'storia-anime-difficile' }, { n: 2, sblocco: 'tournament-battleCity-difficile' }], // Paladino Oscuro
    251: [{ n: 1, sblocco: 'tournament-battleCity-difficile' }, { n: 2, sblocco: 'storia-forbiddenMemories-difficile' }], // Sepoltura Sciocca
    267: [{ n: 1, sblocco: 'storia-forbiddenMemories-difficile' }], // Gilford il Fulmine
    291: [{ n: 1, sblocco: 'tournament-kaiba-difficile' }], // Spolverino dell'Arpia
    333: [{ n: 1, sblocco: 'torre-conquistata' }], // Kunai con Catena
    335: [{ n: 1, sblocco: 'torre-piano-15' }], // Genio della Lampada
    342: [{ n: 1, sblocco: 'tournament-duelistKingdom-difficile' }], // Ragno Lancia-Missili
    376: [{ n: 1, sblocco: 'storia-anime-difficile' }], // Metalmorfosi
    390: [{ n: 1, sblocco: 'tournament-battleCity-difficile' }], // Pomodoro Mistico
    399: [{ n: 1, sblocco: 'storia-forbiddenMemories-difficile' }], // Pantera Guerriera
    401: [{ n: 1, sblocco: 'tournament-kaiba-difficile' }], // Macchina Pendolo
    413: [{ n: 1, sblocco: 'torre-conquistata' }], // Drago Metallico Occhi Rossi
    419: [{ n: 1, sblocco: 'torre-piano-15' }], // Anello della Distruzione
    473: [{ n: 1, sblocco: 'tournament-duelistKingdom-difficile' }], // Drago Millenario
    477: [{ n: 1, sblocco: 'storia-anime-difficile' }], // Ascia Tigre
    487: [{ n: 1, sblocco: 'tournament-battleCity-difficile' }], // Mondo Toon
    502: [{ n: 1, sblocco: 'storia-forbiddenMemories-difficile' }], // Predatore Vorse
    512: [{ n: 1, sblocco: 'tournament-kaiba-difficile' }, { n: 2, sblocco: 'torre-conquistata' }], // XYZ-Cannone Drago
    546: [{ n: 1, sblocco: 'torre-conquistata' }], // Dian Keto il Curatore
    559: [{ n: 1, sblocco: 'torre-piano-15' }], // Ultima Offerta
    562: [{ n: 1, sblocco: 'tournament-duelistKingdom-difficile' }], // Gyakutenno Megami
    620: [{ n: 1, sblocco: 'storia-anime-difficile' }], // Cerchio Incantatore
    712: [{ n: 1, sblocco: 'tournament-battleCity-difficile' }, { n: 2, sblocco: 'storia-forbiddenMemories-difficile' }], // Guardia Celtica Riaddestrata
    901: [{ n: 1, sblocco: 'storia-forbiddenMemories-difficile' }], // La Vergine Clemente
    1006: [{ n: 1, sblocco: 'tournament-kaiba-difficile' }], // Otohime
    1092: [{ n: 1, sblocco: 'torre-conquistata' }], // Senju dalle 1000 Mani
    1282: [{ n: 1, sblocco: 'torre-piano-15' }], // Cavaliere Joker Arcano
    };

    const DIR = 'images/cards/alt';

    /**
     * Come si dice, al giocatore, l'impresa che sblocca. Sta qui e non si legge dal catalogo
     * delle Sfide perche' la Cartoteca e la scheda della carta non lo caricano (e non serve
     * che lo facciano): la coerenza con le Sfide vere la controlla
     * tests/specs/artwork-alternativi.spec.js.
     */
    const COME = {
        'torre-piano-15': 'Supera il piano 15 della Torre dei Duellanti',
        'torre-conquistata': 'Conquista la Torre dei Duellanti, tutti i piani in una sola scalata',
        'tournament-duelistKingdom-difficile': 'Completa il Regno dei Duellanti a difficoltà Difficile',
        'tournament-battleCity-difficile': 'Completa Battle City a difficoltà Difficile',
        'tournament-kaiba-difficile': 'Completa il Torneo Kaiba a difficoltà Difficile',
        'storia-anime-difficile': 'Completa la Storia "Il Regno delle Ombre" a livello Difficile',
        'storia-forbiddenMemories-difficile': 'Completa la Storia "Memorie Proibite" a livello Difficile'
    };

    // Lo stato (sbloccate + scelte) si legge a OGNI disegno di una carta —
    // centinaia di volte in una Cartoteca — e rileggere il salvataggio costa:
    // si tiene in memoria e si riparte da zero solo quando il salvataggio
    // cambia davvero (SaveManager.onSaved) o quando si sceglie qui.
    let stato = null;
    let agganciato = false;
    function dimenticaStato() { stato = null; }
    function leggiStato() {
        if (stato) return stato;
        if (!window.SaveManager || typeof SaveManager.getArtworkState !== 'function') return { sbloccati: {}, scelti: {} }; // save-manager.js non ancora caricato: niente cache
        // L'aggancio si fa qui e non al caricamento del file: l'ordine degli <script> varia da pagina a pagina.
        if (!agganciato && typeof SaveManager.onSaved === 'function') { agganciato = true; SaveManager.onSaved(dimenticaStato); }
        stato = SaveManager.getArtworkState();
        return stato;
    }

    function amministratore() {
        try { return !!(window.CloudSync && typeof CloudSync.isAdmin === 'function' && CloudSync.isAdmin()); } catch (e) { return false; }
    }

    /** Quante illustrazioni alternative ha la carta (0 per quasi tutte). */
    function numero(cardId) { return (CATALOGO[cardId] || []).length; }

    function sbloccata(cardId, n) {
        if (!CATALOGO[cardId] || !CATALOGO[cardId][n - 1]) return false;
        if (amministratore()) return true;
        const s = leggiStato();
        return !!(s.sbloccati[cardId + ':' + n] || (s.completate && s.completate[CATALOGO[cardId][n - 1].sblocco]));
    }

    /** Quante delle alternative della carta sono sbloccate. */
    function sbloccate(cardId) {
        let k = 0;
        for (let n = 1; n <= numero(cardId); n++) if (sbloccata(cardId, n)) k++;
        return k;
    }

    function percorsoDi(cardId, n) { return `${DIR}/${cardId}-${n}.jpg`; }
    function miniaturaDi(cardId, n) { return `${DIR}/thumbs/${cardId}-${n}.webp`; }

    /** L'illustrazione in uso per la carta (0 = l'originale). Una scelta non piu' sbloccata vale come originale. */
    function scelta(cardId) {
        if (!CATALOGO[cardId]) return 0; // il caso di quasi tutte le carte: nessun costo
        const n = Number(leggiStato().scelti[cardId]) || 0;
        return n > 0 && sbloccata(cardId, n) ? n : 0;
    }

    /** Percorso dell'illustrazione scelta, o null se la carta usa l'originale. */
    function percorso(cardId) {
        const n = scelta(cardId);
        return n ? percorsoDi(cardId, n) : null;
    }

    /** Come `percorso`, per la miniatura delle griglie. */
    function miniatura(cardId) {
        const n = scelta(cardId);
        return n ? miniaturaDi(cardId, n) : null;
    }

    /** Sceglie l'illustrazione n della carta (0 = l'originale). Torna false se e' ancora bloccata. */
    function scegli(cardId, n) {
        if (n > 0 && !sbloccata(cardId, n)) return false;
        if (!window.SaveManager) return false;
        SaveManager.setSelectedArtwork(cardId, n);
        dimenticaStato();
        return true;
    }

    /** Il testo che dice COME si sblocca un'illustrazione (dalla Sfida che la regala). */
    function comeSiSblocca(sbloccoId) {
        return COME[sbloccoId] || 'Impresa non disponibile';
    }

    /** Le illustrazioni di una carta, nell'ordine, ognuna con tutto cio' che serve a mostrarla. */
    function elenco(cardId) {
        const attiva = scelta(cardId);
        return (CATALOGO[cardId] || []).map((voce) => ({
            n: voce.n,
            sblocco: voce.sblocco,
            percorso: percorsoDi(cardId, voce.n),
            miniatura: miniaturaDi(cardId, voce.n),
            sbloccata: sbloccata(cardId, voce.n),
            inUso: attiva === voce.n,
            comeSiSblocca: comeSiSblocca(voce.sblocco)
        }));
    }

    /** Le illustrazioni che una Sfida regala: [{ cardId, n }]. */
    function dellaSfida(sfidaId) {
        const out = [];
        Object.keys(CATALOGO).forEach((id) => {
            CATALOGO[id].forEach((voce) => { if (voce.sblocco === sfidaId) out.push({ cardId: Number(id), n: voce.n }); });
        });
        return out;
    }

    /** Gli id di Sfida citati dal catalogo (serve ai guardrail). */
    function sfideCitate() {
        const insieme = new Set();
        Object.keys(CATALOGO).forEach((id) => CATALOGO[id].forEach((voce) => insieme.add(voce.sblocco)));
        return Array.from(insieme);
    }

    window.ArtworkAlternativi = {
        numero, sbloccata, sbloccate, scelta, percorso, miniatura, scegli, elenco, dellaSfida, sfideCitate,
        percorsoDi, miniaturaDi, carte: () => Object.keys(CATALOGO).map(Number), comeSiSblocca
    };
})();
