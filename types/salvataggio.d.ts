/**
 * La forma del SALVATAGGIO del giocatore (localStorage, cloud, file di backup).
 * Solo per l'editor e per `npm run typecheck` (i file con // @ts-check): il
 * gioco non si compila. Il controllo a runtime è `SaveManager.motivoRifiuto`
 * (js/save-manager.js), che vale per i file importati, il cloud e il backup
 * nativo; `load()` ripara i campi mancanti dei salvataggi più vecchi.
 *
 * Un campo NUOVO del salvataggio va aggiunto qui, in `load()` (backfill per i
 * salvataggi precedenti), in `applyExternalSave` (stesso backfill per i file
 * esterni) e, se è un contenitore, in `CONTENITORI_OGGETTO`/`CONTENITORI_ELENCO`
 * di save-manager.js: lo sorveglia tests/specs/salvataggio-forma.spec.js.
 */

/** Mazzo del giocatore. */
interface SaveDeck {
    id: string;
    name: string;
    main: { id: number; qty: number }[];
    extra?: { id: number; qty: number }[];
    updatedAt?: number;
}

/** Le quattro valute: tutte numeri finiti (load() riporta a 0 ciò che non lo è). */
interface SaveCurrency {
    credits: number;
    starChips: number;
    locatorCards: number;
    millenniumCards: number;
}

interface SaveProgressoSfida {
    count: number;
    completed?: boolean;
    completedAt?: string;
}

interface SaveGame {
    player: { name: string; lastSaved: string };
    decks: SaveDeck[];
    activeDeckId: string | null;
    /** { [idDuellante]: { wins, losses } } */
    records: Record<string, { wins: number; losses: number }>;
    currency: SaveCurrency;
    /** Starter/Structure Deck posseduti (packId). */
    ownedPacks: string[];
    /** { [idSfida]: progresso } */
    challenges: Record<string, SaveProgressoSfida>;
    /** Missioni a rotazione: la chiave del periodo sta insieme al progresso. */
    missions: Record<string, any>;
    economyProgress: { freeWinsByDifficulty: Record<string, number> };
    /** Duellanti sbloccati per il Duello Libero (i due iniziali stanno nel codice). */
    unlockedCharacters: string[];
    /** Stato della partita IN CORSO di ogni torneo (forma libera, decisa dal torneo). */
    tournaments: Record<string, any>;
    /** Contatori che sopravvivono ai reset: { attempts, completions }. */
    tournamentStats: Record<string, { attempts: number; completions: number }>;
    millenniumItems: Record<string, any>;
    /** Avanzamento di ogni Storia, per livello (vedi js/story/story-progress.js). */
    story: Record<string, any>;
    settings: Record<string, any>;
    /** { [idCarta]: copie possedute } — mai oltre il tetto di copie. */
    collection: Record<string, number>;
    dailyEconomy?: Record<string, any>;
    tutorial?: Record<string, any>;
    modalita?: Record<string, any>;
    cardAcquisition?: Record<string, any>;
    /** Illustrazioni alternative delle carte: sbloccate ('<idCarta>:<n>') e scelta per carta (vedi js/data/artwork-alternativi.js). */
    artworks?: { sbloccati?: Record<string, boolean>; scelti?: Record<string, number> };
    /** Segno dell'azzeramento delle storie per tutti (vedi AZZERAMENTO_STORIE). */
    storieAzzerate?: string;
}
