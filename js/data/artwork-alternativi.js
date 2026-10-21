/**
 * artwork-alternativi.js — le illustrazioni ufficiali ALTERNATIVE delle carte.
 * =====================================================================
 * Una carta Yu-Gi-Oh ha spesso piu' di un'illustrazione ufficiale (il Drago
 * Bianco Occhi Blu ne ha 8). L'originale e' sempre images/cards/<id>.jpg; le
 * altre stanno in images/cards/alt/<id>-<n>.jpg (n = 1.. nell'ordine del
 * catalogo qui sotto) con la miniatura in images/cards/alt/thumbs/<id>-<n>.webp
 * (scripts/build-ui-thumbnails.js, lavoro 'carte-alt').
 *
 * COME SI VINCONO. Ogni illustrazione dichiara `sblocco`: la FONTE che la regala.
 * Due tipi di fonte, scelti dall'utente (2026-10-21):
 *  - BACINO A SORTEGGIO (`torre-piano-15`, `torre-conquistata`,
 *    `torneo:<id>`): le illustrazioni che nominano quella fonte sono il suo
 *    "bacino". Ogni volta che l'impresa riesce (Torre: superare il piano 15 o
 *    conquistarla, a ogni scalata; Tornei: completarne uno a Difficile, a ogni
 *    giro) se ne vince UNA SOLA, a caso fra quelle ancora da sbloccare. Finito
 *    il bacino non si vince piu' niente da quella fonte. Le chiamano
 *    Rewards.forTournament e chiudi() di js/modes/torre-mode.js, via
 *    `premiaDaFonte`.
 *  - TAPPA FISSA (`storia:<campagna>:<capitolo>`): l'illustrazione si vince, sempre
 *    quella, alla prima volta che si completa quel capitolo al livello Difficile.
 *    Oggi solo Memorie Proibite; il Regno delle Ombre (anime) non ne da' di proposito.
 *    Le assegna js/story/story-progress.js (avanza), via `premiaStoria`.
 * Per spostare un'illustrazione basta cambiarne il `sblocco`: nient'altro dipende da quel valore.
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
    1: [{ n: 1, sblocco: 'storia:forbiddenMemories:fm-nitemare' }, { n: 2, sblocco: 'torre-piano-15' }, { n: 3, sblocco: 'torneo:duelistKingdom' }, { n: 4, sblocco: 'torneo:battleCity' }, { n: 5, sblocco: 'torneo:kaibaTournament' }, { n: 6, sblocco: 'torre-conquistata' }, { n: 7, sblocco: 'torre-piano-15' }], // Drago Bianco Occhi Blu
    2: [{ n: 1, sblocco: 'storia:forbiddenMemories:fm-caduta' }, { n: 2, sblocco: 'torneo:duelistKingdom' }, { n: 3, sblocco: 'torneo:battleCity' }, { n: 4, sblocco: 'torneo:kaibaTournament' }, { n: 5, sblocco: 'torre-conquistata' }, { n: 6, sblocco: 'torre-piano-15' }, { n: 7, sblocco: 'torneo:duelistKingdom' }, { n: 8, sblocco: 'torneo:battleCity' }], // Mago Nero
    4: [{ n: 1, sblocco: 'torneo:kaibaTournament' }, { n: 2, sblocco: 'torre-conquistata' }], // Guardiano Celtico
    12: [{ n: 1, sblocco: 'torre-piano-15' }, { n: 2, sblocco: 'torneo:duelistKingdom' }, { n: 3, sblocco: 'torneo:battleCity' }, { n: 4, sblocco: 'torneo:kaibaTournament' }, { n: 5, sblocco: 'torre-conquistata' }], // Drago Nero Occhi Rossi
    13: [{ n: 1, sblocco: 'storia:forbiddenMemories:fm-labirinto' }, { n: 2, sblocco: 'torre-piano-15' }, { n: 3, sblocco: 'torneo:duelistKingdom' }], // Teschio Evocato
    14: [{ n: 1, sblocco: 'storia:forbiddenMemories:fm-palazzo' }], // Gaia il Cavaliere
    17: [{ n: 1, sblocco: 'torneo:battleCity' }], // Jinzo
    20: [{ n: 1, sblocco: 'torneo:kaibaTournament' }], // Combattente delle Lame
    22: [{ n: 1, sblocco: 'torre-conquistata' }, { n: 2, sblocco: 'torre-piano-15' }], // Kuriboh
    24: [{ n: 1, sblocco: 'torneo:duelistKingdom' }], // Elfi Gemelli
    30: [{ n: 1, sblocco: 'torneo:battleCity' }, { n: 2, sblocco: 'torneo:kaibaTournament' }], // Obelisk il Tormentatore
    31: [{ n: 1, sblocco: 'torre-conquistata' }, { n: 2, sblocco: 'torre-piano-15' }], // Slifer il Drago del Cielo
    58: [{ n: 1, sblocco: 'torneo:duelistKingdom' }], // Spadaccino di Fuoco
    104: [{ n: 1, sblocco: 'torneo:battleCity' }], // Drago Revolver
    165: [{ n: 1, sblocco: 'torneo:kaibaTournament' }], // Virus Distruggi-Carte
    188: [{ n: 1, sblocco: 'storia:forbiddenMemories:fm-maghi' }, { n: 2, sblocco: 'torre-conquistata' }, { n: 3, sblocco: 'torre-piano-15' }, { n: 4, sblocco: 'torneo:duelistKingdom' }, { n: 5, sblocco: 'torneo:battleCity' }], // Ragazza Maga Nera
    189: [{ n: 1, sblocco: 'torneo:kaibaTournament' }, { n: 2, sblocco: 'torre-conquistata' }], // Paladino Oscuro
    251: [{ n: 1, sblocco: 'torre-piano-15' }, { n: 2, sblocco: 'torneo:duelistKingdom' }], // Sepoltura Sciocca
    267: [{ n: 1, sblocco: 'torneo:battleCity' }], // Gilford il Fulmine
    291: [{ n: 1, sblocco: 'torneo:kaibaTournament' }], // Spolverino dell'Arpia
    333: [{ n: 1, sblocco: 'torre-conquistata' }], // Kunai con Catena
    335: [{ n: 1, sblocco: 'torre-piano-15' }], // Genio della Lampada
    342: [{ n: 1, sblocco: 'torneo:duelistKingdom' }], // Ragno Lancia-Missili
    376: [{ n: 1, sblocco: 'torneo:battleCity' }], // Metalmorfosi
    390: [{ n: 1, sblocco: 'torneo:kaibaTournament' }], // Pomodoro Mistico
    399: [{ n: 1, sblocco: 'torre-conquistata' }], // Pantera Guerriera
    401: [{ n: 1, sblocco: 'torre-piano-15' }], // Macchina Pendolo
    413: [{ n: 1, sblocco: 'torneo:duelistKingdom' }], // Drago Metallico Occhi Rossi
    419: [{ n: 1, sblocco: 'torneo:battleCity' }], // Anello della Distruzione
    473: [{ n: 1, sblocco: 'torneo:kaibaTournament' }], // Drago Millenario
    477: [{ n: 1, sblocco: 'torre-conquistata' }], // Ascia Tigre
    487: [{ n: 1, sblocco: 'torre-piano-15' }], // Mondo Toon
    502: [{ n: 1, sblocco: 'torneo:duelistKingdom' }], // Predatore Vorse
    512: [{ n: 1, sblocco: 'torneo:battleCity' }, { n: 2, sblocco: 'torneo:kaibaTournament' }], // XYZ-Cannone Drago
    546: [{ n: 1, sblocco: 'torre-conquistata' }], // Dian Keto il Curatore
    559: [{ n: 1, sblocco: 'torre-piano-15' }], // Ultima Offerta
    562: [{ n: 1, sblocco: 'torneo:duelistKingdom' }], // Gyakutenno Megami
    620: [{ n: 1, sblocco: 'torneo:battleCity' }], // Cerchio Incantatore
    712: [{ n: 1, sblocco: 'torneo:kaibaTournament' }, { n: 2, sblocco: 'torre-conquistata' }], // Guardia Celtica Riaddestrata
    901: [{ n: 1, sblocco: 'torre-piano-15' }], // La Vergine Clemente
    1006: [{ n: 1, sblocco: 'torneo:duelistKingdom' }], // Otohime
    1092: [{ n: 1, sblocco: 'torneo:battleCity' }], // Senju dalle 1000 Mani
    1282: [{ n: 1, sblocco: 'torneo:kaibaTournament' }], // Cavaliere Joker Arcano
    };

    const DIR = 'images/cards/alt';

    /** Come si dice, al giocatore, l'impresa che regala le illustrazioni di una fonte a BACINO. */
    const COME_BACINO = {
        'torre-piano-15': 'Supera il piano 15 della Torre dei Duellanti',
        'torre-conquistata': 'Conquista la Torre dei Duellanti, tutti i piani in una sola scalata',
        'torneo:duelistKingdom': 'Completa il Regno dei Duellanti a difficoltà Difficile',
        'torneo:battleCity': 'Completa Battle City a difficoltà Difficile',
        'torneo:kaibaTournament': 'Completa il Torneo Kaiba a difficoltà Difficile'
    };
    /** Le tappe fisse: capitolo -> come si dice. Le chiavi sono quelle dopo `storia:<campagna>:` del `sblocco`. */
    const COME_TAPPA = {
        'storia:forbiddenMemories:fm-caduta': 'Completa il capitolo "La Caduta" di Memorie Proibite a livello Difficile',
        'storia:forbiddenMemories:fm-maghi': 'Completa il capitolo "I Cinque Maghi Guerrieri" di Memorie Proibite a livello Difficile',
        'storia:forbiddenMemories:fm-labirinto': 'Completa il capitolo "Il Dungeon del Labirinto" di Memorie Proibite a livello Difficile',
        'storia:forbiddenMemories:fm-palazzo': 'Completa il capitolo "Il Palazzo di Heishin" di Memorie Proibite a livello Difficile',
        'storia:forbiddenMemories:fm-nitemare': 'Completa il capitolo "L\'Ultimo Duello" di Memorie Proibite a livello Difficile'
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
        return !!leggiStato().sbloccati[cardId + ':' + n];
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

    /** Quante illustrazioni di un bacino sono ancora da vincere (l'amministratore non le consuma: conta il salvataggio). */
    function restanti(fonte) {
        const s = leggiStato();
        return vociDi(fonte).filter((v) => !s.sbloccati[v.cardId + ':' + v.n]).length;
    }

    /** Il testo che dice COME si vince un'illustrazione. Per un bacino dice anche che si vince a sorte e quante ne restano. */
    function comeSiSblocca(fonte) {
        if (COME_TAPPA[fonte]) return COME_TAPPA[fonte];
        const base = COME_BACINO[fonte];
        if (!base) return 'Impresa non disponibile';
        const k = restanti(fonte);
        return `${base}: ad ogni volta ricevi una sola illustrazione a caso fra quelle ancora da sbloccare di questo gruppo (${k === 0 ? 'le hai già tutte' : (k === 1 ? 'ne resta 1' : 'ne restano ' + k)})`;
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

    /** Le illustrazioni che una fonte regala: [{ cardId, n }]. */
    function vociDi(fonte) {
        const out = [];
        Object.keys(CATALOGO).forEach((id) => {
            CATALOGO[id].forEach((voce) => { if (voce.sblocco === fonte) out.push({ cardId: Number(id), n: voce.n }); });
        });
        return out;
    }

    /** Le fonti citate dal catalogo (serve ai guardrail). */
    function fonti() {
        const insieme = new Set();
        Object.keys(CATALOGO).forEach((id) => CATALOGO[id].forEach((voce) => insieme.add(voce.sblocco)));
        return Array.from(insieme);
    }

    function nomeCarta(cardId) {
        const carta = (window.cardDatabase || (typeof cardDatabase !== 'undefined' ? cardDatabase : [])).find((c) => c.id === cardId);
        return carta ? carta.name : `Carta #${cardId}`;
    }

    /** La voce di premio per una illustrazione appena sbloccata: cosa e' e perche' (stessa forma delle altre voci di Rewards). */
    function voceDiPremio(v, perche) {
        return { amount: 1, icon: '🖼️', nome: `illustrazione alternativa — ${nomeCarta(v.cardId)}`, rule: perche, cardId: v.cardId };
    }

    /**
     * BACINO A SORTEGGIO: una impresa e' riuscita, se ne vince UNA a caso fra quelle ancora da sbloccare
     * della fonte. Torna l'elenco delle voci di premio da mostrare: la nuova illustrazione, oppure (bacino
     * gia' vuoto) una nota che lo dice, altrimenti il giocatore non saprebbe perche' stavolta non e' arrivato nulla.
     * Non fa nulla per una fonte che non e' un bacino.
     */
    function premiaDaFonte(fonte, perche) {
        if (!window.SaveManager || !COME_BACINO[fonte]) return [];
        const stato = SaveManager.getArtworkState();
        const libere = vociDi(fonte).filter((v) => !stato.sbloccati[v.cardId + ':' + v.n]);
        if (!libere.length) return [{ nota: true, icon: '🖼️', rule: `${COME_BACINO[fonte]}: hai già tutte le illustrazioni di questo gruppo.` }];
        const scelta = libere[Math.floor(Math.random() * libere.length)];
        if (!SaveManager.unlockArtwork(scelta.cardId, scelta.n)) return [];
        dimenticaStato();
        return [voceDiPremio(scelta, perche || COME_BACINO[fonte])];
    }

    /**
     * TAPPA FISSA: chiamata ad ogni avanzamento di una Storia con i capitoli ormai completati. Sblocca, una
     * volta sola, le illustrazioni legate a `storia:<campagna>:<capitolo>` — solo al livello Difficile.
     * Torna le voci di premio nuove (vuoto quasi sempre).
     */
    function premiaStoria(campagnaId, livello, capitoliCompletati) {
        if (!window.SaveManager || livello !== 'difficile') return [];
        const out = [];
        (capitoliCompletati || []).forEach((cap) => {
            vociDi(`storia:${campagnaId}:${cap}`).forEach((v) => {
                if (SaveManager.unlockArtwork(v.cardId, v.n)) out.push(voceDiPremio(v, COME_TAPPA[`storia:${campagnaId}:${cap}`]));
            });
        });
        if (out.length) dimenticaStato();
        return out;
    }

    window.ArtworkAlternativi = {
        numero, sbloccata, sbloccate, scelta, percorso, miniatura, scegli, elenco, vociDi, fonti, restanti, premiaDaFonte, premiaStoria,
        percorsoDi, miniaturaDi, carte: () => Object.keys(CATALOGO).map(Number), comeSiSblocca
    };
})();
