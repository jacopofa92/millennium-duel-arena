/**
 * save-manager.js — Salvataggio locale unificato del giocatore.
 * =====================================================================
 * Un solo oggetto JSON, in localStorage sotto SAVE_KEY, raccoglie tutto
 * quello che prima viveva sparso in chiavi separate:
 *   - nome del giocatore + data dell'ultimo salvataggio
 *   - i deck creati (prima in 'duelArenaDecks', vedi creazione-deck.html)
 *   - il record vittorie/sconfitte per personaggio di Duello Libero
 *     (prima in 'duelArenaRecord_<id>', vedi js/data/characters-db.js)
 *
 * "In JSON locale" qui vuol dire: nel localStorage del browser — lo
 * stesso meccanismo già usato in questo progetto per deck/record, che
 * continua a funzionare aprendo semplicemente i file .html, senza
 * bisogno di un server (vedi README.md). Chi vuole un vero file su disco
 * può usare exportToFile()/importFromFile(), che scaricano/caricano un
 * file save_yugioh.json.
 *
 * Migrazione: se non esiste ancora un salvataggio unificato ma esistono
 * dati sotto le vecchie chiavi separate, load() li raccoglie in un nuovo
 * salvataggio automaticamente al primo utilizzo, così chi aveva già
 * deck/record prima di questo sistema non perde nulla.
 */
(function () {
    'use strict';

    const SAVE_KEY = 'yugiohDuelArenaSave';
    const LEGACY_DECKS_KEY = 'duelArenaDecks';
    const LEGACY_RECORD_PREFIX = 'duelArenaRecord_';
    const EXPORT_FILENAME = 'save_yugioh.json';

    // videoDetail parte da 'alti' (richiesta dell'utente; prima 'normali'),
    // e vale solo se `videoDetailScelto`: vedi in cima a js/ui/video-quality.js
    // perché serve il segno.
    const DEFAULT_SETTINGS = {
        videoDetail: 'alti', videoDetailScelto: false, summonVideos: true, hologram: true, haptics: true,
        // cardGyro: sul telefono il giroscopio muove la LUCE della carta in
        // dettaglio (js/ui/card-renderer.js, CartaViva). Spento, la luce segue
        // il tocco (e a dito alzato si muove piano da sola).
        cardGyro: true,
        // Regole di gioco: spento (default) le Magie Rapide Set rispondono in
        // Catena solo nel TUO turno; acceso anche nel turno dell'avversario
        // (più fedele alle regole, più domande). Vedi findQuickPlaySpellCandidates.
        magieRapideTurnoAvversario: false,
        musicVolume: 0.55, musicMuted: false,
        sfxVolume: 0.6, sfxMuted: false
    };
    const SETTINGS_CACHE_KEYS = {
        videoDetail: 'ygoVideoDetail', videoDetailScelto: 'ygoVideoDetailScelto',
        summonVideos: 'ygoSummonVideos', hologram: 'ygoHologram', haptics: 'ygoHapticsEnabled',
        cardGyro: 'ygoGiroscopioCarte', magieRapideTurnoAvversario: 'ygoMagieRapideAvversario',
        musicVolume: 'duelArenaMusicVolume', musicMuted: 'duelArenaMusicMuted',
        sfxVolume: 'duelArenaSfxVolume', sfxMuted: 'duelArenaSfxMuted'
    };

    function normalizeSetting(key, value) {
        const fallback = DEFAULT_SETTINGS[key];
        if (key === 'videoDetail') return value === 'normali' ? 'normali' : 'alti';
        if (key === 'musicVolume' || key === 'sfxVolume') {
            const numero = Number(value);
            return Number.isFinite(numero) ? Math.min(1, Math.max(0, numero)) : fallback;
        }
        return typeof fallback === 'boolean' ? !!value : fallback;
    }

    function readCachedSettings() {
        const settings = { ...DEFAULT_SETTINGS };
        try {
            settings.videoDetailScelto = localStorage.getItem(SETTINGS_CACHE_KEYS.videoDetailScelto) === '1';
            const video = localStorage.getItem(SETTINGS_CACHE_KEYS.videoDetail);
            if (settings.videoDetailScelto && (video === 'normali' || video === 'alti')) settings.videoDetail = video;
            const hologram = localStorage.getItem(SETTINGS_CACHE_KEYS.hologram);
            if (hologram === 'on' || hologram === 'off') settings.hologram = hologram === 'on';
            const summonVideos = localStorage.getItem(SETTINGS_CACHE_KEYS.summonVideos);
            if (summonVideos === 'on' || summonVideos === 'off') settings.summonVideos = summonVideos === 'on';
            const giroscopioCarte = localStorage.getItem(SETTINGS_CACHE_KEYS.cardGyro);
            if (giroscopioCarte === 'on' || giroscopioCarte === 'off') settings.cardGyro = giroscopioCarte === 'on';
            const rapide = localStorage.getItem(SETTINGS_CACHE_KEYS.magieRapideTurnoAvversario);
            if (rapide === 'on' || rapide === 'off') settings.magieRapideTurnoAvversario = rapide === 'on';
            const haptics = localStorage.getItem(SETTINGS_CACHE_KEYS.haptics);
            if (haptics === '0' || haptics === '1') settings.haptics = haptics === '1';
            ['musicVolume', 'sfxVolume'].forEach((key) => {
                const raw = localStorage.getItem(SETTINGS_CACHE_KEYS[key]);
                if (raw !== null) settings[key] = normalizeSetting(key, raw);
            });
            ['musicMuted', 'sfxMuted'].forEach((key) => {
                let raw = localStorage.getItem(SETTINGS_CACHE_KEYS[key]);
                if (raw === null && key === 'musicMuted') raw = sessionStorage.getItem(SETTINGS_CACHE_KEYS[key]);
                if (raw === 'true' || raw === 'false') settings[key] = raw === 'true';
            });
        } catch (e) { /* storage non disponibile: restano i default */ }
        return settings;
    }

    function normalizeSettings(settings) {
        const input = settings && typeof settings === 'object' ? settings : {};
        const normalized = {};
        Object.keys(DEFAULT_SETTINGS).forEach((key) => {
            normalized[key] = normalizeSetting(key, input[key] === undefined ? DEFAULT_SETTINGS[key] : input[key]);
        });
        // Un livello mai scelto dal giocatore è solo il default di un tempo:
        // vale quello di oggi.
        if (!normalized.videoDetailScelto) normalized.videoDetail = DEFAULT_SETTINGS.videoDetail;
        return normalized;
    }

    function syncSettingsCache(settings) {
        try {
            localStorage.setItem(SETTINGS_CACHE_KEYS.videoDetail, settings.videoDetail);
            if (settings.videoDetailScelto) localStorage.setItem(SETTINGS_CACHE_KEYS.videoDetailScelto, '1');
            else localStorage.removeItem(SETTINGS_CACHE_KEYS.videoDetailScelto);
            localStorage.setItem(SETTINGS_CACHE_KEYS.cardGyro, settings.cardGyro ? 'on' : 'off');
            localStorage.setItem(SETTINGS_CACHE_KEYS.hologram, settings.hologram ? 'on' : 'off');
            localStorage.setItem(SETTINGS_CACHE_KEYS.summonVideos, settings.summonVideos ? 'on' : 'off');
            localStorage.setItem(SETTINGS_CACHE_KEYS.haptics, settings.haptics ? '1' : '0');
            localStorage.setItem(SETTINGS_CACHE_KEYS.magieRapideTurnoAvversario, settings.magieRapideTurnoAvversario ? 'on' : 'off');
            localStorage.setItem(SETTINGS_CACHE_KEYS.musicVolume, String(settings.musicVolume));
            localStorage.setItem(SETTINGS_CACHE_KEYS.musicMuted, String(settings.musicMuted));
            localStorage.setItem(SETTINGS_CACHE_KEYS.sfxVolume, String(settings.sfxVolume));
            localStorage.setItem(SETTINGS_CACHE_KEYS.sfxMuted, String(settings.sfxMuted));
            sessionStorage.removeItem(SETTINGS_CACHE_KEYS.musicMuted);
        } catch (e) { /* cache opzionale: il salvataggio resta valido */ }
    }

    // Deck di ripiego se starter-structure-decks.js non fosse caricato per
    // qualche motivo (vedi makeStarterDeck sotto, che normalmente usa
    // invece il vero Starter Deck di Yugi, packId 'starter_sdy_yugi'):
    // volutamente MODESTO, non un mazzo da torneo — quasi tutti mostri a 4
    // stelle o meno (Evocazione libera, senza Tributi), con solo un pugno
    // di mostri da Tributo Livello 5/6 (Maledizione del Drago, Teschio
    // Evocato, Uomo Giudice — questi ultimi due sono i soli sopra i 2000
    // ATK, fino a 2500, per dare comunque una minaccia credibile senza
    // esagerare) più Magie/Trappole di supporto BASILARI: niente Buco Nero
    // né Raigeki (spazzano via interi Terreni, troppo forti per un mazzo
    // da principianti), sostituiti da Dian Keto la Maestra delle Cure, un
    // semplice recupero di Life Points.
    const STARTER_DECK_MAIN = [
        { id: 15, qty: 2 },  // Anatema del Drago — Lv5, 2000 ATK
        { id: 13, qty: 2 }, // Teschio Evocato — Lv6, 2500 ATK
        { id: 317, qty: 1 }, // Il Giudicatore — Lv6, 2200 ATK
        { id: 16, qty: 3 }, { id: 502, qty: 2 }, { id: 24, qty: 2 }, { id: 4, qty: 2 },
        { id: 237, qty: 2 }, { id: 261, qty: 2 }, { id: 391, qty: 2 }, { id: 27, qty: 2 },
        { id: 25, qty: 2 }, { id: 23, qty: 1 }, { id: 22, qty: 2 }, { id: 11, qty: 1 }, { id: 28, qty: 1 },
        { id: 546, qty: 1 }, { id: 35, qty: 1 }, { id: 36, qty: 2 }, { id: 37, qty: 1 }, { id: 243, qty: 2 }, { id: 8, qty: 1 },
        { id: 382, qty: 2 }, { id: 10, qty: 2 }, { id: 40, qty: 2 }
    ];

    function makeDeckId() {
        return 'deck_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    /**
     * Il mazzo con cui ogni nuovo giocatore parte è il vero Starter Deck
     * di Yugi (SDY, 2002 — vedi js/data/starter-structure-decks.js): 50
     * carte reali, non un mazzo di ripiego inventato — su richiesta
     * esplicita, per iniziare con lo stesso mazzo "storico" di Yugi Muto.
     * Copiato qui come deck PERSONALE del giocatore (indipendente dal
     * possesso del pacchetto lato Negozio, gestito a parte da
     * ownsPack/addOwnedPack): se per qualche motivo quel file non fosse
     * caricato, ripiega sul vecchio STARTER_DECK_MAIN qui sopra invece di
     * lasciare il giocatore senza alcun mazzo.
     */
    /** Il pacchetto che fa da mazzo iniziale quando il giocatore non ne sceglie uno. */
    const DEFAULT_STARTER_PACK = 'starter_sdy_yugi';

    /**
     * Il mazzo con cui comincia un giocatore nuovo.
     *
     * `packId` arriva dalla scelta fatta all'inizio (vedi
     * js/ui/onboarding.js: il nonno di Yugi fa scegliere fra il mazzo di
     * Yugi e quello di Kaiba). Senza, vale quello di Yugi come è sempre
     * stato — così ogni altro chiamante di createNew() resta invariato.
     */
    function makeStarterDeck(packId) {
        const voluto = packId || DEFAULT_STARTER_PACK;
        let pack = null;
        if (typeof starterStructureDeckDatabase !== 'undefined') {
            pack = starterStructureDeckDatabase.find((d) => d.packId === voluto)
                // Un packId sconosciuto non deve lasciare il giocatore
                // senza carte: si ricade sul mazzo di sempre.
                || starterStructureDeckDatabase.find((d) => d.packId === DEFAULT_STARTER_PACK);
        }
        return {
            id: makeDeckId(),
            name: pack ? pack.name : 'Mazzo Iniziale',
            main: (pack ? pack.main : STARTER_DECK_MAIN).map((e) => ({ ...e })),
            extra: (pack && pack.extra ? pack.extra : []).map((e) => ({ ...e })),
            updatedAt: Date.now(),
            /** Da quale pacchetto viene: serve a segnarlo come posseduto (vedi createNew). */
            fromPackId: pack ? pack.packId : null
        };
    }

    function readRaw() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function writeRaw(data) {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        } catch (e) { /* storage pieno o non disponibile: niente da fare */ }
        // Backup resiliente su storage nativo, SOLO dentro l'APK — vedi
        // js/native/native-save-backup.js (no-op su web/pagine che non
        // lo caricano). Fire-and-forget: non condiziona in alcun modo
        // questa funzione, che resta sincrona come il resto del motore
        // si aspetta.
        if (window.NativeSaveBackup) NativeSaveBackup.mirror(data);
    }

    /**
     * Se non esiste ancora un salvataggio unificato ma esistono dati sotto
     * le VECCHIE chiavi separate (deck e/o record), li raccoglie in un
     * nuovo salvataggio invece di farli sparire. Ritorna null se non c'era
     * proprio nulla da migrare (giocatore davvero nuovo).
     */
    function migrateLegacyIfNeeded() {
        let legacyDecks = [];
        try {
            const raw = localStorage.getItem(LEGACY_DECKS_KEY);
            if (raw) legacyDecks = JSON.parse(raw) || [];
        } catch (e) { /* noop */ }

        const legacyRecords = {};
        let hasLegacyRecords = false;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.indexOf(LEGACY_RECORD_PREFIX) === 0) {
                try {
                    const record = JSON.parse(localStorage.getItem(key));
                    if (record && (record.wins || record.losses)) {
                        legacyRecords[key.slice(LEGACY_RECORD_PREFIX.length)] = record;
                        hasLegacyRecords = true;
                    }
                } catch (e) { /* noop */ }
            }
        }

        if (legacyDecks.length === 0 && !hasLegacyRecords) return null;

        const migrated = {
            player: { name: 'Giocatore', lastSaved: new Date().toISOString() },
            decks: legacyDecks.length > 0 ? legacyDecks : [makeStarterDeck()],
            records: legacyRecords,
            currency: makeDefaultCurrency(),
            ownedPacks: [],
            challenges: {}
        };
        writeRaw(migrated);
        return migrated;
    }

    // Valute del giocatore. Ognuna apre una porta DIVERSA del Negozio, e
    // nessuna sostituisce le altre — è questo a tenere in piedi
    // l'economia, altrimenti basterebbe accumulare una valuta sola e
    // tutto il resto diventerebbe superfluo:
    //   credits         — si guadagnano ovunque; comprano le carte del
    //                     giorno e le buste della settimana;
    //   starChips       — dai tornei (soprattutto il Regno dei Duellanti),
    //                     dai traguardi di vittorie e dalle missioni;
    //                     comprano SOLO gli Starter/Structure
    //                     Deck, che non si possono avere coi crediti;
    //   locatorCards    — soprattutto da Battle City; comprano SOLO la
    //                     busta Leggendaria;
    //   millenniumCards — soprattutto dal Torneo Kaiba, rarissime dai
    //                     duelli liberi; comprano la carta RARA del giorno
    //                     a colpo sicuro, saltando la casualità delle
    //                     buste (è il "pity system" del gioco).
    // Tutti i salvataggi, anche quelli creati prima dell'introduzione di
    // una di queste voci, vengono retrocompatibilizzati da load() così da
    // non perdere mai il resto dei dati.
    function makeDefaultCurrency() {
        return { credits: 0, starChips: 0, locatorCards: 0, millenniumCards: 0 };
    }

    // I contenitori del salvataggio, per forma. Un campo nuovo di quel tipo va
    // elencato qui (lo sorveglia tests/specs/salvataggio-forma.spec.js): load() li
    // ripara, motivoRifiuto li controlla nei salvataggi che arrivano da fuori.
    const CONTENITORI_OGGETTO = ['challenges', 'missions', 'economyProgress', 'tournaments', 'tournamentStats', 'millenniumItems', 'story', 'settings', 'dailyEconomy', 'tutorial', 'modalita', 'cardAcquisition', 'artworks'];
    const CONTENITORI_ELENCO = ['ownedPacks', 'unlockedCharacters'];

    /**
     * AZZERAMENTO DELLE STORIE PER TUTTI (richiesta dell'utente, 2026-10-09:
     * "resettare tutte le storie a tutti e salvare su cloud, così si
     * riparte per bene", premi finali compresi).
     *
     * Un salvataggio che non porta questo segno ha le storie scritte prima
     * dell'azzeramento: `save.story` si svuota per intero — avanzamento di
     * ogni campagna a ogni livello, livelli Normale/Difficile sbloccati e
     * premio finale già ritirato (si può riscuotere di nuovo). Tutto il
     * resto resta: carte, crediti, mazzi, Sfide, e il registro delle carte
     * ottenute dai capitoli (js/economy/card-acquisition.js), che fa anche
     * da lucchetto a carte del Negozio.
     *
     * Perché nel codice e non sul database: ogni copia del salvataggio —
     * quella del telefono, del computer, del cloud, perfino un backup
     * importato da file — si azzera da sé quando viene letta, quindi le
     * copie non possono rimettersi a vicenda le storie vecchie. Un
     * azzeramento fatto solo sul cloud verrebbe invece ricoperto dal primo
     * dispositivo che carica la sua copia.
     *
     * La data del salvataggio NON si sposta (writeRaw, non touch): la
     * regola "vince il più recente" del cloud resta quella di prima, e un
     * dispositivo rimasto indietro non diventa "il più recente" solo perché
     * si è azzerato. Per un ALTRO azzeramento in futuro basta cambiare il
     * valore qui sotto.
     */
    const AZZERAMENTO_STORIE = '2026-10-09';
    /** Il salvataggio è appena stato azzerato e va detto a chi sincronizza (vedi onSaved). */
    let azzeramentoDaComunicare = false;

    function azzeraStorieSeVecchie(save) {
        if (save.storieAzzerate === AZZERAMENTO_STORIE) return false;
        save.story = {};
        save.storieAzzerate = AZZERAMENTO_STORIE;
        return true;
    }

    /**
     * CARTE ELIMINATE DAL GIOCO (2026-10-21): otto carte erano la STESSA carta reale di un'altra (due voci per Black Luster
     * Soldier, Giant Trunade...) e sono state tolte. Chi le possedeva, o le aveva in un mazzo, le ritrova sulla carta che resta:
     * `{ idEliminato: idChe Resta }`. L'id tolto non va mai riusato per un'altra carta, o questa mappa le scambierebbe.
     * Vale per ogni salvataggio che entra (locale, cloud, file importato): e' idempotente.
     */
    const CARTE_ELIMINATE = { 616: 55, 617: 56, 163: 530, 747: 199, 668: 262, 1024: 315, 723: 349, 609: 452 };

    function migraCarteEliminate(save) {
        let cambiato = false;
        const tetto = (id) => {
            if (window.CardAcquisition && typeof CardAcquisition.copyCapFor === 'function') return CardAcquisition.copyCapFor(id);
            return CARD_COPY_CAP;
        };
        if (save.collection && typeof save.collection === 'object') {
            Object.keys(CARTE_ELIMINATE).forEach((vecchio) => {
                const copie = Number(save.collection[vecchio]);
                if (save.collection[vecchio] === undefined) return;
                const nuovo = CARTE_ELIMINATE[vecchio];
                if (Number.isFinite(copie) && copie > 0) {
                    save.collection[nuovo] = Math.min(tetto(nuovo), (Number(save.collection[nuovo]) || 0) + copie);
                }
                delete save.collection[vecchio];
                cambiato = true;
            });
        }
        (save.decks || []).forEach((deck) => {
            ['main', 'extra'].forEach((zona) => {
                if (!Array.isArray(deck[zona]) || !deck[zona].some((e) => e && CARTE_ELIMINATE[e.id] !== undefined)) return;
                const unite = new Map();
                deck[zona].forEach((e) => {
                    if (!e) return;
                    const id = CARTE_ELIMINATE[e.id] !== undefined ? CARTE_ELIMINATE[e.id] : e.id;
                    const q = (unite.has(id) ? unite.get(id).qty : 0) + (Number(e.qty) || 0);
                    unite.set(id, Object.assign({}, e, { id: id, qty: Math.min(tetto(id), q) }));
                });
                deck[zona] = [...unite.values()];
                cambiato = true;
            });
        });
        return cambiato;
    }

    function load() {
        let save = readRaw();
        if (!save) save = migrateLegacyIfNeeded();
        if (!save) return save;
        let dirty = false;
        // Contenitori della forma sbagliata (oggetto al posto di un elenco, una
        // stringa...): si riportano vuoti invece di lasciarli rompere ogni lettura.
        CONTENITORI_OGGETTO.forEach((nome) => {
            const v = save[nome];
            if (v != null && (typeof v !== 'object' || Array.isArray(v))) { delete save[nome]; dirty = true; }
        });
        CONTENITORI_ELENCO.forEach((nome) => {
            if (save[nome] != null && !Array.isArray(save[nome])) { delete save[nome]; dirty = true; }
        });
        if (save.currency != null && (typeof save.currency !== 'object' || Array.isArray(save.currency))) { delete save.currency; dirty = true; }
        if (!save.currency) { save.currency = makeDefaultCurrency(); dirty = true; }
        // Backfill delle SINGOLE voci, non solo dell'oggetto intero: un
        // salvataggio creato prima che esistesse una valuta ha già
        // `currency`, quindi il controllo qui sopra non scatterebbe mai e
        // la voce nuova resterebbe undefined per sempre (rompendo ogni
        // somma che la tocca). Vale per millenniumCards, e varrà da sé per
        // qualunque valuta futura.
        Object.keys(makeDefaultCurrency()).forEach((voce) => {
            if (!Number.isFinite(save.currency[voce])) { save.currency[voce] = 0; dirty = true; }
        });
        // Starter/Structure Deck posseduti (js/data/starter-structure-decks.js):
        // array di packId, vuoto finché il Negozio non vende davvero
        // qualcosa — vedi ownsPack/addOwnedPack qui sotto.
        if (!save.ownedPacks) { save.ownedPacks = []; dirty = true; }
        // Mazzo "corrente" scelto dal giocatore per i Duelli (prima non
        // esisteva: si usava sempre e solo decks[0], senza alcun modo di
        // sceglierne un altro) — se manca o punta a un deck non più
        // esistente (es. cancellato), ripiega sul primo disponibile.
        if (save.activeDeckId == null || !save.decks.some((d) => d.id === save.activeDeckId)) {
            save.activeDeckId = save.decks[0] ? save.decks[0].id : null;
            dirty = true;
        }
        // Progresso Sfide (js/data/challenges-db.js + js/challenges/challenge-tracker.js):
        // { [challengeId]: { count, completed, completedAt } } — assente in
        // ogni salvataggio creato prima di questa funzionalità.
        if (!save.challenges) { save.challenges = {}; dirty = true; }
        // Missioni a rotazione (giornaliere/settimanali): stesso backfill
        // retrocompatibile di ogni campo aggiunto dopo — un salvataggio
        // creato prima non le ha, e senza questa riga ogni lettura
        // troverebbe undefined.
        if (!save.missions) { save.missions = {}; dirty = true; }
        // Traguardi ripetibili dell'economia, separati dai contatori
        // giornalieri: devono sopravvivere al cambio di data. I tre
        // livelli hanno progressi distinti, cosi' nove vittorie Facili
        // seguite da una Difficile non possono incassare il premio Hard.
        if (!save.economyProgress) { save.economyProgress = { freeWinsByDifficulty: {} }; dirty = true; }
        if (!save.economyProgress.freeWinsByDifficulty) {
            save.economyProgress.freeWinsByDifficulty = {};
            dirty = true;
        }
        // Duellanti sbloccati per il Duello Libero (vedi
        // js/data/character-unlocks.js). Contiene SOLO quelli guadagnati
        // vincendo: i due di partenza stanno nel codice, non qui, così un
        // salvataggio creato prima di questa regola non si ritrova il
        // Duello Libero vuoto.
        if (!Array.isArray(save.unlockedCharacters)) { save.unlockedCharacters = []; dirty = true; }
        // Progresso Tornei (es. torneo-regno-duellanti.html): un oggetto
        // per torneo, chiave = id del torneo ('duelistKingdom', in
        // futuro 'battleCity' ecc.) — vedi getTournamentState/
        // setTournamentState più sotto. Ogni torneo definisce da sé la
        // forma del proprio stato, questo file non la conosce.
        if (!save.tournaments) { save.tournaments = {}; dirty = true; }
        // Statistiche PERSISTENTI per torneo ({ [tournamentId]: { attempts,
        // completions } }) — a differenza di save.tournaments qui sopra
        // (la partita IN CORSO, azzerata da Abbandona/Ricomincia), questo
        // contatore non viene mai toccato da un reset: un torneo è
        // liberamente ripetibile quante volte si vuole (nessun limite), ma
        // il numero di tentativi/completamenti resta comunque visibile.
        if (!save.tournamentStats) { save.tournamentStats = {}; dirty = true; }
        // Oggetti del Millennio vinti nei tornei ({ [itemId]: { wonAt,
        // fromCharacter, tournamentId } }) - vedi getMillenniumItems piu'
        // sotto. Assente in ogni salvataggio precedente a questa
        // funzionalita': si parte semplicemente senza nessuno.
        if (!save.millenniumItems) { save.millenniumItems = {}; dirty = true; }
        // Avanzamento della Modalita' Storia ({ [campaignId]: stato }),
        // contenitore generico come save.tournaments - vedi
        // getStoryState piu' sotto. Assente in ogni salvataggio
        // precedente alla Modalita' Storia.
        if (!save.story) { save.story = {}; dirty = true; }
        if (azzeraStorieSeVecchie(save)) {
            dirty = true;
            azzeramentoDaComunicare = true;
            // Chi sincronizza è già in ascolto (di solito sì, a pagina
            // avviata): gli si dice subito, dopo la scrittura qui sotto.
            // Se non c'è ancora, glielo dirà onSaved quando si registra.
            setTimeout(comunicaAzzeramento, 0);
        }
        if (!save.settings) {
            save.settings = readCachedSettings();
            dirty = true;
        } else {
            const normalizedSettings = normalizeSettings(save.settings);
            if (JSON.stringify(normalizedSettings) !== JSON.stringify(save.settings)) dirty = true;
            save.settings = normalizedSettings;
        }
        syncSettingsCache(save.settings);
        // Collezione: quante copie di ciascuna carta il giocatore POSSIEDE
        // davvero ({ [cardId]: copie }). Una carta assente vale 0 copie,
        // quindi un giocatore nuovo parte senza nulla e l'oggetto resta
        // piccolo. Vedi getOwnedCount/addOwnedCards più sotto.
        // Assente = salvataggio precedente a questa funzionalità: gli si
        // accreditano le carte dei mazzi che ha GIÀ, altrimenti dopo
        // l'aggiornamento si ritroverebbe ogni suo mazzo inutilizzabile
        // (0 copie di tutto) senza aver fatto nulla di sbagliato.
        if (!save.collection) {
            save.collection = {};
            (save.decks || []).forEach((deck) => {
                const fromDeck = collectionFromDeck(deck);
                Object.keys(fromDeck).forEach((id) => {
                    save.collection[id] = Math.max(save.collection[id] || 0, fromDeck[id]);
                });
            });
            dirty = true;
        }
        if (migraCarteEliminate(save)) dirty = true;
        if (dirty) writeRaw(save);
        return save;
    }

    function hasSave() {
        return !!load();
    }

    /**
     * `starterPackId` (facoltativo): quale Starter Deck il giocatore ha
     * scelto all'inizio, fra quelli proposti dal nonno di Yugi (vedi
     * js/ui/onboarding.js). Omesso, vale il mazzo di Yugi come sempre.
     */
    function createNew(playerName, starterPackId) {
        const starterDeck = makeStarterDeck(starterPackId);
        const save = {
            player: { name: (playerName || '').trim() || 'Giocatore', lastSaved: new Date().toISOString() },
            // Di chi e': il giocatore che l'ha appena creato (e' collegato, l'accesso e' obbligatorio). Il NOME non
            // identifica nessuno: due account possono chiamarsi uguale, l'account e' questo.
            ...(accountCollegato() ? { accountId: accountCollegato() } : {}),
            decks: [starterDeck],
            activeDeckId: starterDeck.id,
            records: {},
            currency: makeDefaultCurrency(),
            // Il mazzo iniziale è a tutti gli effetti un pacchetto
            // POSSEDUTO: senza segnarlo qui, Creazione Deck lo mostrerebbe
            // ancora col lucchetto e il Negozio proverebbe a rivendere al
            // giocatore le carte che ha già in mano (vedi ownsPack).
            ownedPacks: starterDeck.fromPackId ? [starterDeck.fromPackId] : [],
            challenges: {},
            economyProgress: { freeWinsByDifficulty: {} },
            tournaments: {},
            tournamentStats: {},
            artworks: {},
        millenniumItems: {},
        story: {},
            // Nato dopo l'azzeramento delle storie: non c'è niente da azzerare.
            storieAzzerate: AZZERAMENTO_STORIE,
            settings: readCachedSettings(),
            // Un giocatore nuovo non possiede NESSUNA carta, tranne quelle
            // del mazzo iniziale che il gioco stesso gli mette in mano
            // qui sopra: senza queste non potrebbe costruire nemmeno un
            // mazzo legale, quindi non potrebbe giocare né guadagnare
            // crediti per comprarne — sarebbe bloccato in partenza.
            collection: collectionFromDeck(starterDeck)
        };
        writeRaw(save);
        return save;
    }

    /** { [cardId]: copie } a partire dalle liste main/extra di un mazzo. */
    function collectionFromDeck(deck) {
        const collection = {};
        [...((deck && deck.main) || []), ...((deck && deck.extra) || [])].forEach((entry) => {
            collection[entry.id] = Math.min(CARD_COPY_CAP, (collection[entry.id] || 0) + (entry.qty || 0));
        });
        return collection;
    }

    /**
     * Chi vuole sapere che il salvataggio è cambiato. Un GANCIO generico e
     * non una chiamata diretta al cloud: questo file non deve sapere che
     * esiste una sincronizzazione, e chi sincronizza non deve rincorrere
     * ogni punto che scrive (sono oltre cento). Oggi lo usa solo
     * js/cloud/auto-sync.js; domani potrebbe servire a un indicatore
     * "salvato" nell'interfaccia senza toccare niente qui.
     */
    const savedListeners = [];
    function onSaved(fn) {
        if (typeof fn !== 'function') return;
        savedListeners.push(fn);
        // Un azzeramento delle storie avvenuto prima che chi sincronizza
        // si registrasse (load() gira presto, auto-sync si aggancia dopo).
        if (azzeramentoDaComunicare) setTimeout(comunicaAzzeramento, 0);
    }

    /**
     * Dice a chi ascolta che il salvataggio è cambiato per l'azzeramento
     * delle storie, SENZA toccarne la data: così auto-sync lo porta sul
     * cloud (la richiesta dell'utente era anche "salvare su cloud"), ma il
     * caricamento si ferma da solo se sul cloud c'è un salvataggio più
     * recente — che a sua volta si azzera leggendolo.
     */
    function comunicaAzzeramento() {
        if (!azzeramentoDaComunicare || !savedListeners.length) return;
        azzeramentoDaComunicare = false;
        const save = readRaw();
        if (!save) return;
        savedListeners.forEach((fn) => {
            try { fn(save); } catch (e) { /* un ascoltatore rotto non rompe niente */ }
        });
    }

    /**
     * A QUALE ACCOUNT appartiene il salvataggio: `accountId`, scritto DENTRO il salvataggio e quindi presente
     * ovunque lui vada (localStorage, backup nativo dell'APK, copie di sicurezza, scritture tardive di un'altra
     * scheda). Il solo marcatore a parte (`ygoProprietarioSalvataggio`, cloud-sync.js) non bastava: restava
     * assente per un salvataggio mai sincronizzato e non viaggiava col backup nativo, e un salvataggio senza
     * proprietario veniva trattato come di chi entrava per primo — cioe' poteva finire sul cloud sbagliato.
     * Lo decide cloud-sync.js (`CloudSync.proprietarioPresunto`): qui si legge soltanto.
     */
    function accountCollegato() {
        try {
            const u = window.CloudSync && typeof CloudSync.getUser === 'function' ? CloudSync.getUser() : null;
            return u && u.id ? u.id : null;
        } catch (e) { return null; }
    }
    function proprietarioPresunto() {
        try {
            return window.CloudSync && typeof CloudSync.proprietarioPresunto === 'function' ? CloudSync.proprietarioPresunto() : null;
        } catch (e) { return null; }
    }
    /** L'account a cui il salvataggio dice di appartenere, o null (salvataggio nato prima di questa regola). */
    function getAccountId() {
        const s = readRaw();
        return s && typeof s.accountId === 'string' && s.accountId ? s.accountId : null;
    }
    /**
     * Scrive il proprietario nel salvataggio SENZA toccarne la data di modifica (non e' una modifica di gioco, e la
     * data decide quale copia e' la piu' recente). Con `forza` lo cambia anche se c'e' gia'.
     */
    function impostaProprietario(uid, forza) {
        if (!uid) return false;
        const s = readRaw();
        if (!s) return false;
        if (s.accountId && !forza) return false;
        if (s.accountId === uid) return false;
        s.accountId = uid;
        writeRaw(s);
        return true;
    }

    function touch(save) {
        save.player = save.player || {};
        save.player.lastSaved = new Date().toISOString();
        // Un salvataggio senza proprietario che si modifica adesso prende quello che gli si presume (l'ultimo account che
        // l'ha sincronizzato qui, altrimenti chi e' collegato): da qui in poi viaggia con la sua etichetta.
        if (!save.accountId) {
            const chi = proprietarioPresunto();
            if (chi) save.accountId = chi;
        }
        writeRaw(save);
        // Dopo la scrittura, mai prima: chi ascolta deve poter rileggere
        // il salvataggio e trovarci già dentro la modifica. E ognuno
        // protetto per conto suo — un ascoltatore che esplode non deve
        // impedire un salvataggio, che è già avvenuto comunque.
        savedListeners.forEach((fn) => {
            try { fn(save); } catch (e) { /* un ascoltatore rotto non rompe il salvataggio */ }
        });
        return save;
    }

    function getSettings() {
        const save = load();
        return save ? { ...save.settings } : readCachedSettings();
    }

    function getSetting(key) {
        const settings = getSettings();
        return Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key) ? settings[key] : undefined;
    }

    function setSetting(key, value) {
        if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) return false;
        const normalized = normalizeSetting(key, value);
        const save = load();
        if (!save) {
            const cached = readCachedSettings();
            cached[key] = normalized;
            syncSettingsCache(cached);
            return true;
        }
        save.settings[key] = normalized;
        syncSettingsCache(save.settings);
        touch(save);
        return true;
    }

    function getDecks() {
        const save = load();
        return save ? save.decks : [];
    }

    function setDecks(decks) {
        const save = load() || createNew();
        save.decks = decks;
        touch(save);
    }

    /** Id del mazzo scelto dal giocatore come "corrente" per i Duelli. */
    function getActiveDeckId() {
        const save = load();
        return save ? save.activeDeckId : null;
    }

    /** Il mazzo "corrente" per intero (oggetto {id, name, main, extra, ...}), o null se il giocatore non ha ancora nessun deck. */
    function getActiveDeck() {
        const save = load();
        if (!save) return null;
        return save.decks.find((d) => d.id === save.activeDeckId) || save.decks[0] || null;
    }

    /** Imposta quale mazzo salvato usare nei Duelli — deckId deve esistere tra SaveManager.getDecks(). */
    function setActiveDeckId(deckId) {
        const save = load() || createNew();
        if (!save.decks.some((d) => d.id === deckId)) return false;
        save.activeDeckId = deckId;
        touch(save);
        return true;
    }

    function getRecord(characterId) {
        const save = load();
        return (save && save.records && save.records[characterId]) || { wins: 0, losses: 0 };
    }

    function setRecord(characterId, record) {
        const save = load() || createNew();
        save.records = save.records || {};
        save.records[characterId] = record;
        touch(save);
    }

    function getAllRecords() {
        const save = load();
        return (save && save.records) || {};
    }

    /** Progresso di UNA sfida (js/data/challenges-db.js) — { count, completed, completedAt }, mai null. */
    function getChallengeProgress(challengeId) {
        const save = load();
        return (save && save.challenges && save.challenges[challengeId]) || { count: 0, completed: false, completedAt: null };
    }

    function setChallengeProgress(challengeId, progress) {
        const save = load() || createNew();
        save.challenges = save.challenges || {};
        save.challenges[challengeId] = progress;
        touch(save);
    }

    // ================================================================
    // DUELLANTI SBLOCCATI
    // ================================================================
    // Un elenco di id e non una mappa id->qualcosa: l'unica informazione
    // è "c'è o non c'è". Quando (e come) sia stato sbloccato lo racconta
    // già il record V/S del personaggio, che esiste da sempre.

    /** Gli id guadagnati vincendo. NON comprende i due di partenza — quelli li sa js/data/character-unlocks.js. */
    function getUnlockedCharacters() {
        const save = load();
        return (save && Array.isArray(save.unlockedCharacters)) ? save.unlockedCharacters.slice() : [];
    }

    function unlockCharacter(characterId) {
        if (!characterId) return;
        const save = load() || createNew();
        if (!Array.isArray(save.unlockedCharacters)) save.unlockedCharacters = [];
        if (save.unlockedCharacters.indexOf(characterId) !== -1) return;
        save.unlockedCharacters.push(characterId);
        touch(save);
    }

    function getAllChallengeProgress() {
        const save = load();
        return (save && save.challenges) || {};
    }

    // ================================================================
    // MISSIONI A ROTAZIONE (giornaliere e settimanali)
    // ================================================================
    // Sono un'altra cosa dalle Sfide, e vivono in un contenitore a parte
    // apposta. Una Sfida è un traguardo UNA TANTUM: si completa e resta
    // completata per sempre, quindi il suo progresso si accumula in
    // `save.challenges` senza scadere mai. Una missione invece appartiene
    // a un PERIODO: quando il giorno (o la settimana) cambia, quella
    // vecchia non esiste più e il conto riparte.
    //
    // Per questo il contenitore tiene la CHIAVE del periodo insieme al
    // progresso: `{ chiave: '2026-09-22', progresso: { [id]: {...} } }`.
    // Cambiata la chiave, il progresso si butta — così il salvataggio non
    // cresce all'infinito accumulando un blocco per ogni giorno passato,
    // che è quello che sarebbe successo usando `save.challenges` con un id
    // composito tipo `mission:x:2026-09-22`.
    function contenitoreMissioni(save, ambito) {
        save.missions = save.missions || {};
        save.missions[ambito] = save.missions[ambito] || { chiave: null, progresso: {} };
        return save.missions[ambito];
    }

    /**
     * Il progresso delle missioni del periodo corrente, azzerato da sé se
     * il periodo è cambiato. `ambito` è 'daily' o 'weekly', `chiave` la
     * chiave del periodo secondo il SERVER (js/cloud/server-date.js) — mai
     * l'orologio del dispositivo, che si può spostare a piacere.
     */
    function getMissionProgress(ambito, chiave) {
        const save = load();
        const c = (save && save.missions && save.missions[ambito]) || null;
        if (!c || c.chiave !== chiave) return {};
        return c.progresso || {};
    }

    function setMissionProgress(ambito, chiave, missionId, progress) {
        const save = load() || createNew();
        const c = contenitoreMissioni(save, ambito);
        // Periodo cambiato: si riparte da zero, senza portarsi dietro
        // niente di quello vecchio.
        if (c.chiave !== chiave) { c.chiave = chiave; c.progresso = {}; }
        c.progresso[missionId] = progress;
        touch(save);
    }

    /** Segna quali missioni sono state SORTEGGIATE per questo periodo, così la pagina non deve ripescarle a ogni apertura. */
    function setMissionRoster(ambito, chiave, ids) {
        const save = load() || createNew();
        const c = contenitoreMissioni(save, ambito);
        if (c.chiave !== chiave) { c.chiave = chiave; c.progresso = {}; }
        // Un roster non valido non deve far cadere la pagina: si cancella
        // e basta, e al prossimo giro verrà risorteggiato.
        c.roster = Array.isArray(ids) ? ids.slice() : null;
        touch(save);
    }

    function getMissionRoster(ambito, chiave) {
        const save = load();
        const c = (save && save.missions && save.missions[ambito]) || null;
        return (c && c.chiave === chiave && Array.isArray(c.roster)) ? c.roster.slice() : null;
    }

    function getPlayerName() {
        const save = load();
        return (save && save.player && save.player.name) || 'Giocatore';
    }

    function setPlayerName(name) {
        const save = load() || createNew();
        save.player = save.player || {};
        save.player.name = (name || '').trim() || 'Giocatore';
        touch(save);
        return save.player.name;
    }

    /**
     * Il titolo SPECIALE che il giocatore ha scelto di mostrare sotto il nome (js/data/titles-db.js), o null = quello della
     * scala a punti. Sta in `save.player` insieme al nome (un campo di quel blocco viaggia col salvataggio sul cloud); le
     * impostazioni no, perche' sono una lista chiusa di chiavi. Si salva solo l'id: se un giorno quel titolo sparisse dal
     * catalogo il Profilo ricade da solo sulla scala, senza rompere nulla.
     */
    function getTitoloScelto() {
        const save = load();
        const id = save && save.player && save.player.titoloScelto;
        return typeof id === 'string' && id ? id : null;
    }

    function setTitoloScelto(id) {
        const save = load() || createNew();
        save.player = save.player || {};
        if (id) save.player.titoloScelto = String(id); else delete save.player.titoloScelto;
        touch(save);
        return getTitoloScelto();
    }

    // ================================================================
    // Collezione: quante copie di ciascuna carta il giocatore possiede.
    // ================================================================
    /**
     * Tetto normale della collezione. Yu-Gi-Oh permette tre copie: tenere
     * lo stesso limite anche nel possesso impedisce che premi e buste
     * continuino a regalare doppioni ormai inutilizzabili. L'admin resta
     * virtualmente al massimo tramite isAdminUser(), senza sporcare il save.
     */
    const CARD_COPY_CAP = 3;

    /**
     * Un amministratore possiede SEMPRE tutto al massimo, senza che il
     * suo salvataggio debba contenere una riga per ognuna delle oltre
     * mille carte: è una regola calcolata al volo, non un dato scritto.
     * Così non c'è nulla da rigenerare quando si aggiungono carte nuove,
     * e un account che smette di essere admin torna alla sua collezione
     * reale invece di restare con un salvataggio "gonfiato".
     */
    function isAdminUser() {
        return !!(window.CloudSync && typeof CloudSync.isAdmin === 'function' && CloudSync.isAdmin());
    }

    /** Copie possedute di una carta (0 se non la si possiede affatto). */
    function getOwnedCount(cardId) {
        if (isAdminUser()) return CARD_COPY_CAP;
        const save = load();
        if (!save || !save.collection) return 0;
        const n = Number(save.collection[cardId]);
        return Number.isFinite(n) && n > 0 ? Math.min(CARD_COPY_CAP, n) : 0;
    }

    /**
     * Aggiunge (o toglie, con qty negativa) copie di una carta, sempre
     * entro 0..CARD_COPY_CAP. È il punto da cui passano il Negozio
     * futuro e l'acquisizione di uno Starter/Structure Deck.
     */
    function addOwnedCards(cardId, qty) {
        const save = load() || createNew();
        save.collection = save.collection || {};
        const current = Number(save.collection[cardId]) || 0;
        // Per le carte con limite economico esplicito (oggi i supporti
        // moderni), nessuna fonte può aggirare il tetto passando da questo
        // punto centrale. Le vecchie carte mantengono il cap storico di 3.
        const cap = window.CardAcquisition && typeof CardAcquisition.copyCapFor === 'function'
            ? CardAcquisition.copyCapFor(cardId) : CARD_COPY_CAP;
        const next = Math.max(0, Math.min(cap, current + (Number(qty) || 0)));
        if (next === 0) delete save.collection[cardId];
        else save.collection[cardId] = next;
        touch(save);
        return next;
    }

    /**
     * Acquisisce un mazzo senza sommare i doppioni fra scatole diverse.
     * Un deck è una base di costruzione, non una scorciatoia per fare tre
     * copie: possedere 1 Anfora e comprare un deck con 1 Anfora lascia 1;
     * soltanto un deck che ne contiene 2 porta il possesso almeno a 2.
     */
    function addOwnedCardsFromDeck(deck) {
        const save = load() || createNew();
        save.collection = save.collection || {};
        [...((deck && deck.main) || []), ...((deck && deck.extra) || [])].forEach((entry) => {
            const current = Number(save.collection[entry.id]) || 0;
            const cap = window.CardAcquisition && typeof CardAcquisition.copyCapFor === 'function'
                ? CardAcquisition.copyCapFor(entry.id) : CARD_COPY_CAP;
            save.collection[entry.id] = Math.max(current, Math.min(cap, entry.qty || 0));
        });
        touch(save);
        return save.collection;
    }

    /** Stato persistente del sistema di acquisizione (pity, traguardi e sblocchi). */
    function getCardAcquisitionState() {
        const save = load() || createNew();
        save.cardAcquisition = save.cardAcquisition || {};
        return JSON.parse(JSON.stringify(save.cardAcquisition));
    }

    function setCardAcquisitionState(state) {
        const save = load() || createNew();
        save.cardAcquisition = state && typeof state === 'object' ? state : {};
        touch(save);
        return getCardAcquisitionState();
    }

    function getCollection() {
        const save = load();
        return (save && save.collection) || {};
    }

    /**
     * Quanto vede in cassa un amministratore: abbastanza da non dover mai
     * macinare crediti per provare il Negozio, un mazzo o una carta.
     * Un numero e non `Infinity` perché finisce dentro conti e caselle di
     * testo, dove "Infinity" si vedrebbe.
     */
    const VALUTA_ADMIN = 999999;

    function sonoAdmin() {
        return !!(window.CloudSync && typeof CloudSync.isAdmin === 'function' && CloudSync.isAdmin());
    }

    /**
     * Il portafoglio. Per un amministratore torna 999999 di ogni valuta,
     * ma è un valore CALCOLATO AL MOMENTO DELLA LETTURA e non scritto nel
     * salvataggio — stesso principio degli sblocchi dei Duellanti
     * (js/data/character-unlocks.js).
     *
     * La differenza conta: se quell'account smette di essere
     * amministratore si ritrova le valute che ha davvero guadagnato,
     * invece di un milione di crediti rimasti lì da quando lo era. E le
     * spese continuano a scriversi normalmente sul salvataggio reale
     * (addCurrency non è toccata), quindi non c'è niente da ripulire
     * dopo: semplicemente, finché è amministratore, quello che legge è
     * sempre 999999.
     */
    function getCurrency() {
        const save = load();
        const vera = (save && save.currency) || makeDefaultCurrency();
        if (!sonoAdmin()) return vera;
        // Si parte dalle voci VERE e non dalle sole predefinite: una
        // valuta aggiunta in futuro e presente solo nel salvataggio
        // resterebbe altrimenti al suo valore normale, e sarebbe l'unica
        // a fare eccezione senza che nessuno se ne accorga.
        const piena = Object.assign({}, vera);
        Object.keys(piena).forEach((voce) => { piena[voce] = VALUTA_ADMIN; });
        Object.keys(makeDefaultCurrency()).forEach((voce) => { piena[voce] = VALUTA_ADMIN; });
        return piena;
    }

    /** Somma (o sottrae, con amount negativo) una quantità a una valuta: 'credits' | 'starChips' | 'locatorCards'. */
    function addCurrency(type, amount) {
        const save = load() || createNew();
        save.currency = save.currency || makeDefaultCurrency();
        save.currency[type] = Math.max(0, (save.currency[type] || 0) + amount);
        touch(save);
        return save.currency;
    }

    /**
     * Stato persistente di UN torneo (es. 'duelistKingdom') — ogni pagina
     * torneo definisce da sola la FORMA del proprio oggetto stato (mappa
     * percorsa, passo attuale, ecc.), questo file si limita a
     * leggerlo/scriverlo sotto save.tournaments[tournamentId] esattamente
     * come fa per un salvataggio intero, senza validarne il contenuto.
     * Torna null se quel torneo non è mai stato iniziato (nessuna
     * partita in corso da riprendere).
     */
    function getTournamentState(tournamentId) {
        const save = load();
        return (save && save.tournaments && save.tournaments[tournamentId]) || null;
    }

    /** Sovrascrive lo stato di UN torneo — vedi getTournamentState qui sopra. `state` null/undefined lo azzera (torneo abbandonato/ricominciato). */
    function setTournamentState(tournamentId, state) {
        const save = load() || createNew();
        save.tournaments = save.tournaments || {};
        if (state == null) {
            delete save.tournaments[tournamentId];
        } else {
            save.tournaments[tournamentId] = state;
        }
        touch(save);
        return state;
    }

    /**
     * Stato persistente di UNA modalità di gioco (Puzzle, Rivincite, Torre
     * dei Duellanti — vedi js/modes/): { [modeId]: <forma libera> }, null
     * se non è mai stata giocata. Contenitore generico come save.tournaments,
     * ma in un campo SUO: una modalità non è un torneo, e un id in comune
     * non deve poter mescolare le due cose. Non serve un recupero in load():
     * chi legge regge l'assenza del campo, chi scrive lo crea.
     */
    function getModeState(modeId) {
        const save = load();
        return (save && save.modalita && save.modalita[modeId]) || null;
    }

    /** Sovrascrive lo stato di UNA modalità; `state` null lo azzera. */
    function setModeState(modeId, state) {
        const save = load() || createNew();
        save.modalita = save.modalita || {};
        if (state == null) {
            delete save.modalita[modeId];
        } else {
            save.modalita[modeId] = state;
        }
        touch(save);
        return state;
    }

    // ------------------------------------------------------------------
    // Artwork alternativi (js/data/artwork-alternativi.js). Il salvataggio
    // tiene solo DUE cose, e nient'altro: quali illustrazioni sono state
    // sbloccate ('<idCarta>:<n>', n = 1.. nell'ordine del catalogo) e quale
    // sta usando ogni carta (0/assente = quella originale). Da dove arrivano
    // gli sblocchi, e quante illustrazioni ha una carta, e' del catalogo.
    // ------------------------------------------------------------------
    function isArtworkUnlocked(cardId, n) {
        const save = load();
        return !!(save && save.artworks && save.artworks.sbloccati && save.artworks.sbloccati[cardId + ':' + n]);
    }

    /** Una fotografia di sola lettura di { sbloccati, scelti }: serve a chi disegna carte e non puo' rileggere il salvataggio a ogni carta. */
    function getArtworkState() {
        const save = load();
        const a = (save && save.artworks) || {};
        return { sbloccati: Object.assign({}, a.sbloccati), scelti: Object.assign({}, a.scelti) };
    }

    /** Sblocca un'illustrazione. Torna true solo se era DAVVERO nuova (chi premia lo mostra una volta sola). */
    function unlockArtwork(cardId, n) {
        const save = load() || createNew();
        save.artworks = save.artworks || {};
        save.artworks.sbloccati = save.artworks.sbloccati || {};
        const chiave = cardId + ':' + n;
        if (save.artworks.sbloccati[chiave]) return false;
        save.artworks.sbloccati[chiave] = true;
        touch(save);
        return true;
    }

    /** L'illustrazione scelta per una carta: 0 = l'originale. */
    function getSelectedArtwork(cardId) {
        const save = load();
        return Number(save && save.artworks && save.artworks.scelti && save.artworks.scelti[cardId]) || 0;
    }

    /** Sceglie l'illustrazione di una carta (0 per tornare all'originale). Il controllo che sia sbloccata e' di chi chiama (ArtworkAlternativi.scegli). */
    function setSelectedArtwork(cardId, n) {
        const save = load() || createNew();
        save.artworks = save.artworks || {};
        save.artworks.scelti = save.artworks.scelti || {};
        if (n > 0) save.artworks.scelti[cardId] = n; else delete save.artworks.scelti[cardId];
        touch(save);
    }

    /** Statistiche persistenti di UN torneo: { attempts, completions }, mai null — sopravvivono ad Abbandona/Ricomincia (vedi il commento su save.tournamentStats in load()). */
    function getTournamentStats(tournamentId) {
        const save = load();
        return (save && save.tournamentStats && save.tournamentStats[tournamentId]) || { attempts: 0, completions: 0 };
    }

    /** Incrementa di 1 il contatore 'attempts' o 'completions' di UN torneo e torna la nuova coppia {attempts, completions}. */
    function incrementTournamentStat(tournamentId, statName) {
        const save = load() || createNew();
        save.tournamentStats = save.tournamentStats || {};
        const current = save.tournamentStats[tournamentId] || { attempts: 0, completions: 0 };
        current[statName] = (current[statName] || 0) + 1;
        save.tournamentStats[tournamentId] = current;
        touch(save);
        return current;
    }

    /**
     * La lezione guidata col nonno (js/tutorial/tutorial-duel.js):
     * { daFare, completata, premiata }, mai null.
     * `daFare` la scrive SOLO il primo avvio (index.html, dopo la bottega
     * del nonno), non createNew(): un salvataggio creato in qualunque altro
     * modo (un backup importato, un test) non deve finire chiuso dentro
     * una lezione obbligatoria. Un salvataggio senza il campo — tutti
     * quelli nati prima del tutorial — vale "niente da fare".
     * `lezioni` ({ catena: true, ... }): le lezioni brevi del menu Tutorial
     * già completate almeno una volta. Non hanno premi: servono solo alla
     * spunta nell'elenco.
     */
    function getTutorial() {
        const save = load();
        const t = (save && save.tutorial) || {};
        return {
            daFare: !!t.daFare,
            completata: !!t.completata,
            premiata: !!t.premiata,
            lezioni: Object.assign({}, t.lezioni || {})
        };
    }

    function setTutorial(campi) {
        const save = load() || createNew();
        const lezioniPrima = (save.tutorial && save.tutorial.lezioni) || {};
        save.tutorial = Object.assign({}, save.tutorial || {}, campi);
        // `lezioni` si unisce invece di sostituirsi: segnare una lezione
        // non deve cancellare le altre.
        if (campi && campi.lezioni) save.tutorial.lezioni = Object.assign({}, lezioniPrima, campi.lezioni);
        touch(save);
        return getTutorial();
    }

    /**
     * Avanzamento di UNA campagna della Modalità Storia (storia.html):
     * { [campaignId]: <forma libera decisa dalla campagna> }, null se
     * non è mai stata iniziata.
     *
     * Contenitore generico come save.tournaments, e per lo stesso motivo:
     * questo file non sa (e non deve sapere) com'è fatto dentro. Vive in
     * un campo SUO e non dentro save.tournaments perché una campagna e un
     * torneo non sono la stessa cosa e non devono potersi pestare i piedi
     * per una collisione di id.
     */
    function getStoryState(campaignId) {
        const save = load();
        return (save && save.story && save.story[campaignId]) || null;
    }

    /** Sovrascrive l'avanzamento di UNA campagna. `state` null la cancella (ricominciare da capo). */
    function setStoryState(campaignId, state) {
        const save = load() || createNew();
        save.story = save.story || {};
        if (state == null) {
            delete save.story[campaignId];
        } else {
            save.story[campaignId] = state;
        }
        touch(save);
    }

    /**
     * Oggetti del Millennio posseduti: { [itemId]: { wonAt, fromCharacter,
     * tournamentId } }.
     *
     * NON sono una valuta e non passano da addCurrency: ognuno esiste in
     * copia unica, quindi la domanda che si fa il gioco non e' "quanti ne
     * ho" ma "ce l'ho". Per questo la chiave e' l'id dell'oggetto e il
     * valore racconta DOVE l'hai preso — un oggetto vinto mesi prima deve
     * poter ancora dire da chi, come ogni altro premio di questo gioco.
     */
    function getMillenniumItems() {
        const save = load();
        return (save && save.millenniumItems) || {};
    }

    /** Vero se quell'Oggetto del Millennio e' gia' stato vinto. */
    function ownsMillenniumItem(itemId) {
        return !!getMillenniumItems()[itemId];
    }

    /**
     * Registra un Oggetto del Millennio appena vinto. Torna false se era
     * gia' posseduto, senza sovrascrivere: il primo ritrovamento e' quello
     * vero, e una seconda registrazione ne perderebbe la storia.
     */
    function addMillenniumItem(itemId, info) {
        const save = load() || createNew();
        save.millenniumItems = save.millenniumItems || {};
        if (save.millenniumItems[itemId]) return false;
        save.millenniumItems[itemId] = Object.assign({ wonAt: new Date().toISOString() }, info || {});
        touch(save);
        return true;
    }

    /**
     * Contatori dell'economia che si azzerano ogni giorno — il numero di
     * duelli vinti nella giornata (bonus "prima vittoria del giorno" e
     * rendimenti decrescenti, vedi js/economy/rewards.js) e QUALI carte
     * della rotazione giornaliera del Negozio sono già state comprate
     * oggi (`boughtShopCardIds`, vedi hasBoughtDailyShopCard/
     * recordDailyShopCardPurchase sotto — una sola copia al giorno per
     * ognuna delle 4 carte in vetrina, richiesto esplicitamente
     * dall'utente: "ne posso comprare solo 1 in quella rotazione
     * giornaliera"). `dayKey` è la giornata a cui si riferiscono, in UTC
     * e presa dal SERVER (js/cloud/server-date.js): appena cambia, sia i
     * contatori sia gli acquisti ripartono da zero da soli, senza
     * bisogno di alcuna pulizia programmata. Chi legge passa il proprio
     * dayKey, così questo file non ha bisogno di sapere da dove arrivi
     * la data.
     */
    function getDailyEconomy(dayKey) {
        const save = load();
        const d = (save && save.dailyEconomy) || null;
        if (!d || d.dayKey !== dayKey) return { dayKey: dayKey, wins: 0, raidWins: 0, boughtShopCardIds: [] };
        return d;
    }

    /**
     * Registra una vittoria di RAID cooperativo nella giornata `dayKey` (il premio del Raid ha un limite giornaliero) e torna
     * quante ne sono state registrate oggi. Vive in dailyEconomy come `wins`: ripartono da zero insieme, col cambio di giorno.
     */
    function recordDailyRaidWin(dayKey) {
        const save = load() || createNew();
        const current = (save.dailyEconomy && save.dailyEconomy.dayKey === dayKey)
            ? save.dailyEconomy
            : { dayKey: dayKey, wins: 0 };
        current.raidWins = (Number(current.raidWins) || 0) + 1;
        save.dailyEconomy = current;
        touch(save);
        return current.raidWins;
    }

    /** Registra una vittoria nella giornata `dayKey` e torna i contatori aggiornati. */
    function recordDailyWin(dayKey) {
        const save = load() || createNew();
        const current = (save.dailyEconomy && save.dailyEconomy.dayKey === dayKey)
            ? save.dailyEconomy
            : { dayKey: dayKey, wins: 0 };
        current.wins += 1;
        save.dailyEconomy = current;
        touch(save);
        return current;
    }

    /**
     * Registra una vittoria FUORI dai tornei per il premio ogni 10.
     * Torna il progresso residuo e quante soglie sono state attraversate;
     * usare il resto invece del totale evita crescita inutile del save e
     * rende idempotente il pagamento: la stessa soglia non resta salvata
     * come ancora da riscuotere al caricamento successivo.
     */
    function recordFreeWinMilestone(difficulty, every) {
        const livello = difficulty === 'Facile' || difficulty === 'Difficile' ? difficulty : 'Medio';
        const soglia = Math.max(1, Number(every) || 10);
        const save = load() || createNew();
        save.economyProgress = save.economyProgress || { freeWinsByDifficulty: {} };
        const contatori = save.economyProgress.freeWinsByDifficulty || (save.economyProgress.freeWinsByDifficulty = {});
        const totale = Math.max(0, Number(contatori[livello]) || 0) + 1;
        const completati = Math.floor(totale / soglia);
        contatori[livello] = totale % soglia;
        touch(save);
        return { difficulty: livello, progress: contatori[livello], completed: completati, every: soglia };
    }

    function getFreeWinMilestones() {
        const save = load();
        const valori = save && save.economyProgress && save.economyProgress.freeWinsByDifficulty;
        return Object.assign({ Facile: 0, Medio: 0, Difficile: 0 }, valori || {});
    }

    /** Vero se quella carta della rotazione giornaliera del Negozio è già stata comprata OGGI (`dayKey`). */
    function hasBoughtDailyShopCard(dayKey, cardId) {
        return (getDailyEconomy(dayKey).boughtShopCardIds || []).indexOf(cardId) !== -1;
    }

    /** Registra l'acquisto di oggi per quella carta della rotazione del Negozio — idempotente, un secondo click non aggiunge un duplicato. */
    function recordDailyShopCardPurchase(dayKey, cardId) {
        const save = load() || createNew();
        const current = (save.dailyEconomy && save.dailyEconomy.dayKey === dayKey)
            ? save.dailyEconomy
            : { dayKey: dayKey, wins: 0 };
        current.boughtShopCardIds = current.boughtShopCardIds || [];
        if (current.boughtShopCardIds.indexOf(cardId) === -1) current.boughtShopCardIds.push(cardId);
        save.dailyEconomy = current;
        touch(save);
    }

    function getOwnedPacks() {
        const save = load();
        return (save && save.ownedPacks) || [];
    }

    /**
     * L'UNICA risposta a "il giocatore ha questo pacchetto?". La danno
     * sia Creazione Deck (per decidere se si può clonare) sia il Negozio
     * (per decidere se si può comprare): devono per forza essere
     * d'accordo.
     *
     * Qui c'era un blocco che considerava OGNI Starter/Structure già
     * posseduto, messo quando il Negozio non li vendeva ancora e
     * accompagnato dalla nota "rimuovere quando torneranno ad essere
     * acquistabili sul serio". Quel momento è arrivato — il Negozio ora
     * chiama davvero addOwnedPack — e finché il blocco è rimasto le due
     * schermate si contraddicevano: Creazione Deck mostrava ogni mazzo
     * come già tuo e clonabile gratis, mentre il Negozio te lo vendeva
     * lo stesso per Stelle e Crediti, perché leggeva l'elenco grezzo
     * invece di passare da qui.
     */
    function ownsPack(packId) {
        return getOwnedPacks().indexOf(packId) !== -1;
    }

    /**
     * Segna uno Starter/Structure Deck (js/data/starter-structure-decks.js)
     * come posseduto — verrà chiamata dal Negozio quando l'acquisto sarà
     * implementato davvero. Acquisire un pacchetto significa anche
     * RICEVERNE LE CARTE: il contatore di copie possedute viene alimentato
     * qui, così non c'è modo di "possedere" un pacchetto senza avere le
     * carte che contiene (e il Negozio futuro non dovrà ricordarsene).
     */
    function addOwnedPack(packId) {
        const save = load() || createNew();
        save.ownedPacks = save.ownedPacks || [];
        const isNew = save.ownedPacks.indexOf(packId) === -1;
        if (isNew) save.ownedPacks.push(packId);
        touch(save);
        if (isNew && typeof starterStructureDeckDatabase !== 'undefined') {
            const pack = starterStructureDeckDatabase.find((p) => p.packId === packId);
            if (pack) addOwnedCardsFromDeck(pack);
        }
        return save.ownedPacks;
    }

    function exportToFile() {
        const save = load();
        if (!save) return false;
        const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = EXPORT_FILENAME;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
    }

    /**
     * Valida e applica un salvataggio ESTERNO (da un file importato, o da
     * js/cloud/cloud-sync.js dopo aver scaricato quello sincronizzato) come
     * salvataggio attivo — stessa logica di backfill/retrocompatibilità
     * di load() qui sopra, così un salvataggio esterno più vecchio (es.
     * senza ancora activeDeckId) viene "riparato" allo stesso modo.
     * Lancia un Error con messaggio parlante se `parsed` non è un
     * salvataggio valido, così chi chiama può mostrarlo com'è.
     */
    function applyExternalSave(parsed, opzioni) {
        // Il controllo è quello dei file importati: un salvataggio rovinato (dal
        // cloud, dal backup nativo, da un file) non deve sostituirne uno buono.
        const motivo = motivoRifiuto(parsed);
        if (motivo) throw new Error(motivo);
        parsed.player = parsed.player || { name: 'Giocatore' };
        // `mantieniData`: chi scarica dal CLOUD tiene la data vera di quel
        // salvataggio (l'ultima modifica, fatta su un altro dispositivo).
        // Marcarlo "adesso" lo faceva sembrare più nuovo di quanto fosse, e
        // il confronto fra dispositivi (CloudSync.confrontaSalvataggi) si
        // basa proprio su questa data. Un file importato a mano invece resta
        // "adesso": è una scelta fatta ora, e deve vincere.
        const dataOriginale = parsed.player.lastSaved && !isNaN(Date.parse(parsed.player.lastSaved));
        if (!(opzioni && opzioni.mantieniData && dataOriginale)) {
            parsed.player.lastSaved = new Date().toISOString();
        }
        parsed.records = parsed.records || {};
        parsed.currency = parsed.currency || makeDefaultCurrency();
        parsed.ownedPacks = parsed.ownedPacks || [];
        parsed.challenges = parsed.challenges || {};
        parsed.missions = parsed.missions || {};
        parsed.economyProgress = parsed.economyProgress || { freeWinsByDifficulty: {} };
        parsed.economyProgress.freeWinsByDifficulty = parsed.economyProgress.freeWinsByDifficulty || {};
        parsed.unlockedCharacters = Array.isArray(parsed.unlockedCharacters) ? parsed.unlockedCharacters : [];
        parsed.tournaments = parsed.tournaments || {};
        parsed.tournamentStats = parsed.tournamentStats || {};
        parsed.artworks = parsed.artworks || {};
        parsed.millenniumItems = parsed.millenniumItems || {};
        parsed.story = parsed.story || {};
        parsed.settings = parsed.settings ? normalizeSettings(parsed.settings) : readCachedSettings();
        // Collezione assente = salvataggio creato prima che le copie
        // possedute esistessero: gli si accreditano le carte dei mazzi che
        // ha già, altrimenti si ritroverebbe i propri mazzi tutti
        // inutilizzabili (0 copie di tutto) dopo l'aggiornamento.
        if (!parsed.collection) {
            parsed.collection = {};
            (parsed.decks || []).forEach((deck) => {
                const fromDeck = collectionFromDeck(deck);
                Object.keys(fromDeck).forEach((id) => {
                    parsed.collection[id] = Math.max(parsed.collection[id] || 0, fromDeck[id]);
                });
            });
        }
        if (parsed.activeDeckId == null || !parsed.decks.some((d) => d.id === parsed.activeDeckId)) {
            parsed.activeDeckId = parsed.decks[0] ? parsed.decks[0].id : null;
        }
        // Una copia scritta prima dell'azzeramento delle storie (il cloud,
        // un backup su file) si azzera come quella del dispositivo: è il
        // pezzo che impedisce al cloud di riportare indietro le storie
        // vecchie. E si rimanda su, così anche il cloud resta azzerato.
        if (azzeraStorieSeVecchie(parsed)) {
            azzeramentoDaComunicare = true;
            setTimeout(comunicaAzzeramento, 0);
        }
        migraCarteEliminate(parsed);
        // DI CHI E' il salvataggio (vedi accountCollegato). Un salvataggio che entra da fuori — scaricato dal cloud,
        // importato da un file, ripristinato da una copia — diventa di chi e' collegato ADESSO: il file di un altro
        // account, importato apposta, non deve restare "di un altro" e farsi mettere da parte al controllo successivo.
        // Solo chi sa gia' di chi e' (`mantieniProprietario`: il ripristino del backup nativo prima dell'accesso, la
        // copia di un account che rientra) tiene il segno che porta.
        if (!(opzioni && opzioni.mantieniProprietario)) {
            const chi = accountCollegato();
            if (chi) parsed.accountId = chi; else delete parsed.accountId;
        }
        writeRaw(parsed);
        syncSettingsCache(parsed.settings);
        window.dispatchEvent(new CustomEvent('ygo:settings-applied', { detail: { settings: { ...parsed.settings } } }));
        return parsed;
    }

    /**
     * Il file è davvero un salvataggio? Torna il motivo del rifiuto (una frase
     * per l'utente) oppure null se va bene. Solo per i file scelti a mano:
     * un file corrotto non deve sostituire un salvataggio buono. Controlla la
     * FORMA (mazzi, collezione, valute, record), non il contenuto: una carta
     * con un id che non esiste più non è un motivo per rifiutare un backup.
     * @param {any} s
     * @returns {string | null}
     */
    function motivoRifiuto(s) {
        const oggetto = (v) => v && typeof v === 'object' && !Array.isArray(v);
        if (!oggetto(s)) return 'Il file non contiene un salvataggio.';
        if (!Array.isArray(s.decks) || s.decks.length === 0) return 'Nel file non c\'è nessun mazzo: non sembra un salvataggio di questo gioco.';
        if (!s.decks.every((d) => oggetto(d) && Array.isArray(d.main))) return 'I mazzi nel file sono incompleti o rovinati.';
        if (s.player != null && !oggetto(s.player)) return 'I dati del giocatore nel file sono rovinati.';
        if (s.collection != null) {
            if (!oggetto(s.collection)) return 'La collezione di carte nel file è rovinata.';
            if (!Object.keys(s.collection).every((id) => Number.isFinite(Number(s.collection[id])))) return 'La collezione di carte nel file contiene valori non validi.';
        }
        if (s.currency != null) {
            if (!oggetto(s.currency)) return 'Le valute nel file sono rovinate.';
            if (!Object.keys(s.currency).every((k) => Number.isFinite(Number(s.currency[k])))) return 'Le valute nel file contengono valori non validi.';
        }
        if (s.records != null && !oggetto(s.records)) return 'I record dei duelli nel file sono rovinati.';
        // Ogni altro contenitore, se c'è, deve avere la forma giusta: un salvataggio
        // con challenges a stringa romperebbe ogni lettura che lo tocca.
        for (const nome of CONTENITORI_OGGETTO) {
            if (s[nome] != null && !oggetto(s[nome])) return 'Nel file la voce «' + nome + '» è rovinata.';
        }
        for (const nome of CONTENITORI_ELENCO) {
            if (s[nome] != null && !Array.isArray(s[nome])) return 'Nel file la voce «' + nome + '» è rovinata.';
        }
        return null;
    }

    /**
     * Legge e controlla un file di salvataggio SENZA applicarlo. Chi importa
     * deve prima far vedere all'utente cosa sta per sostituire (vedi
     * js/ui/recupero-copia.js, RecuperoCopia.importa) e solo poi chiamare
     * applyExternalSave.
     * @param {File} file
     * @returns {Promise<any>} il salvataggio letto, non ancora applicato
     */
    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                let parsed;
                try { parsed = JSON.parse(reader.result); } catch (e) { return reject(new Error('Il file non è un JSON valido.')); }
                const motivo = motivoRifiuto(parsed);
                if (motivo) return reject(new Error(motivo));
                resolve(parsed);
            };
            reader.onerror = () => reject(new Error('Impossibile leggere il file.'));
            reader.readAsText(file);
        });
    }

    /** Legge un file scelto dall'utente e lo rende il salvataggio attivo, SUBITO (vedi readFile per la via con conferma). */
    function importFromFile(file) {
        return readFile(file).then((parsed) => applyExternalSave(parsed));
    }

    function deleteSave() {
        try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ }
        // Anche il backup nativo dell'APK: index.html lo ripristina quando
        // non trova un salvataggio, e riporterebbe in vita quello appena tolto.
        if (window.NativeSaveBackup && typeof NativeSaveBackup.clear === 'function') NativeSaveBackup.clear();
    }

    window.SaveManager = {
        hasSave: hasSave,
        load: load,
        createNew: createNew,
        getAccountId: getAccountId,
        impostaProprietario: impostaProprietario,
        touch: touch,
        onSaved: onSaved,
        getSettings: getSettings,
        getSetting: getSetting,
        setSetting: setSetting,
        getDecks: getDecks,
        setDecks: setDecks,
        getActiveDeckId: getActiveDeckId,
        getActiveDeck: getActiveDeck,
        setActiveDeckId: setActiveDeckId,
        getRecord: getRecord,
        setRecord: setRecord,
        getAllRecords: getAllRecords,
        getChallengeProgress: getChallengeProgress,
        setChallengeProgress: setChallengeProgress,
        getAllChallengeProgress: getAllChallengeProgress,
        // Duellanti sbloccati per il Duello Libero.
        getUnlockedCharacters: getUnlockedCharacters,
        unlockCharacter: unlockCharacter,
        // Missioni a rotazione: progresso e roster del periodo corrente.
        getMissionProgress: getMissionProgress,
        setMissionProgress: setMissionProgress,
        getMissionRoster: getMissionRoster,
        setMissionRoster: setMissionRoster,
        getPlayerName: getPlayerName,
        setPlayerName: setPlayerName,
        getTitoloScelto: getTitoloScelto,
        setTitoloScelto: setTitoloScelto,
        getCurrency: getCurrency,
        addCurrency: addCurrency,
        CARD_COPY_CAP: CARD_COPY_CAP,
        getOwnedCount: getOwnedCount,
        addOwnedCards: addOwnedCards,
        addOwnedCardsFromDeck: addOwnedCardsFromDeck,
        getCardAcquisitionState: getCardAcquisitionState,
        setCardAcquisitionState: setCardAcquisitionState,
        getCollection: getCollection,
        getTournamentState: getTournamentState,
        setTournamentState: setTournamentState,
        getTournamentStats: getTournamentStats,
        isArtworkUnlocked: isArtworkUnlocked,
        getArtworkState: getArtworkState,
        unlockArtwork: unlockArtwork,
        getSelectedArtwork: getSelectedArtwork,
        setSelectedArtwork: setSelectedArtwork,
        getModeState: getModeState,
        setModeState: setModeState,
        getTutorial: getTutorial,
        setTutorial: setTutorial,
        getStoryState: getStoryState,
        setStoryState: setStoryState,
        getMillenniumItems: getMillenniumItems,
        ownsMillenniumItem: ownsMillenniumItem,
        addMillenniumItem: addMillenniumItem,
        incrementTournamentStat: incrementTournamentStat,
        getDailyEconomy: getDailyEconomy,
        recordDailyWin: recordDailyWin,
        recordDailyRaidWin: recordDailyRaidWin,
        recordFreeWinMilestone: recordFreeWinMilestone,
        getFreeWinMilestones: getFreeWinMilestones,
        hasBoughtDailyShopCard: hasBoughtDailyShopCard,
        recordDailyShopCardPurchase: recordDailyShopCardPurchase,
        getOwnedPacks: getOwnedPacks,
        ownsPack: ownsPack,
        addOwnedPack: addOwnedPack,
        exportToFile: exportToFile,
        importFromFile: importFromFile,
        readFile: readFile,
        motivoRifiuto: motivoRifiuto,
        applyExternalSave: applyExternalSave,
        deleteSave: deleteSave,
        makeStarterDeck: makeStarterDeck
    };
})();
