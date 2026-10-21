/**
 * modalita.d.ts — tipi delle modalità aggiuntive (Puzzle, Rivincite, Torre
 * dei Duellanti), SOLO per il controllo: il browser non carica mai questo
 * file. Separato da motore.d.ts apposta: le modalità stanno FUORI dal motore
 * di Duel Monsters e non devono finire dentro il suo contratto.
 * Controllati da `npm run typecheck` i file di js/modes/ e i loro dati, che
 * portano `// @ts-check` in cima.
 */

/**
 * Ciò che una modalità registra in window.ModalitaDuello[<mode>] (letto dal
 * blocco "EXTRA — MODALITÀ AGGIUNTIVE" di js/duel-session.js). Tutte le
 * voci sono facoltative: una voce assente vuol dire "come un duello
 * normale".
 */
interface ModalitaDuello {
    /** Pagina a cui torna il pulsante "Continua" a fine duello. */
    urlRitorno?: string;
    /** Prepara il duello (di solito sostituendo preparaManiIniziali) e chiama initGame. */
    avvia?: () => void;
    /** 'player' o 'bot' per saltare la morra cinese, null per giocarla. */
    chiComincia?: () => Owner | null;
    /** Chi sei in questo duello, se non sei te stesso. */
    giocatore?: () => IdentitaDuellante | null;
    /** Niente battute automatiche dei duellanti. */
    senzaDialoghi?: boolean;
    /** La fine del duello è tutta della modalità: niente record, Sfide generiche, premi normali. */
    esclusiva?: boolean;
    /** A fine duello: aggiorna lo stato della modalità e torna le voci da mostrare. */
    chiudi?: (vinto: boolean, abbandono: boolean) => VoceEsito[];
}

/** Nome, ritratto e titolo di chi sta duellando. */
interface IdentitaDuellante {
    id?: string;
    name: string;
    title?: string;
    image?: string | null;
    icon?: string;
}

/**
 * Una riga della schermata finale (vedi DuelCinematics.showOutcome): o un
 * guadagno in una valuta, o una nota senza importo. `rule` spiega SEMPRE
 * perché si riceve qualcosa: nessun premio senza spiegazione.
 */
type VoceEsito =
    | { currency: 'credits' | 'starChips' | 'locatorCards' | 'millenniumCards'; amount: number; icon: string; nome: string; rule: string }
    | { nota: true; icon: string; rule: string }
    /** Un premio che non e' una valuta: es. una illustrazione alternativa (js/data/artwork-alternativi.js). */
    | { amount: number; icon: string; nome: string; rule: string; cardId?: number };

/** Posizione di un mostro in un puzzle. */
type PosizionePuzzle = 'attacco' | 'difesa' | 'coperto';
/** Stato di una Magia/Trappola in un puzzle. */
type StatoMagiaPuzzle = 'coperta' | 'scoperta';

/** Un lato del Terreno di un puzzle: mostri, Magie/Trappole, Cimitero, Extra Deck, mano. */
interface LatoPuzzle {
    mano?: number[];
    mostri?: [number, PosizionePuzzle][];
    magieTrappole?: [number, StatoMagiaPuzzle][];
    cimitero?: number[];
    extra?: number[];
}

/** Un puzzle "Vinci in questo turno" (js/data/puzzles-db.js). */
interface PuzzleDef extends LatoPuzzle {
    id: string;
    titolo: string;
    emblema?: string;
    /** 1 facile, 2 media, 3 difficile: decide la sezione e i crediti della prima soluzione. */
    difficolta: 1 | 2 | 3;
    /** Id del personaggio che fa da avversario (characters-db.js). */
    personaggio: string;
    descrizione: string;
    suggerimento?: string;
    lp?: number;
    lpAvversario?: number;
    /** Carta pescata a inizio turno (Dian Keto se assente). */
    pescata?: number;
    avversario: LatoPuzzle;
}

/** Stato salvato di un puzzle (SaveManager.getModeState('puzzle')[id]). */
interface StatoPuzzle {
    tentativi: number;
    risolto: boolean;
    stelle: number;
}

/** Una Rivincita (js/data/rivincite-db.js): un duello dell'anime giocato col mazzo del personaggio. */
interface RivincitaDef {
    id: string;
    titolo: string;
    /** Dove si colloca nella storia (Regno dei Duellanti, Battle City...). */
    epoca: string;
    /** Id del personaggio di cui prendi il posto e il mazzo (characters-db.js). */
    giocatore: string;
    /** Id del personaggio avversario. */
    avversario: string;
    /** File di images/fields/ su cui si gioca. */
    campo?: string;
    descrizione: string;
}

/** Livelli dell'avversario, come nell'URL (?difficulty=). */
type LivelloDuello = 'Facile' | 'Medio' | 'Difficile';

/** Stato salvato delle Rivincite: per ogni id, i livelli vinti. */
interface StatoRivincite {
    [id: string]: { vinte: { [livello: string]: boolean } };
}

/** Un piano della Torre: chi si affronta, a che livello, su quale campo. */
interface PianoTorre {
    avversario: string;
    livello: LivelloDuello;
    campo?: string;
}

/** Un tratto della Torre fra due boss: gli avversari si pescano da qui. */
interface FasciaTorre {
    daPiano: number;
    aPiano: number;
    livello: LivelloDuello;
    campo?: string;
    avversari: string[];
}

/** Un oggetto della Torre: cambia solo la preparazione del duello. */
interface OggettoTorre {
    id: 'mano' | 'primo' | 'lpAvversario' | 'carta';
    icona: string;
    nome: string;
    descrizione: string;
    /** Quante volte lo si può prendere nella stessa scalata. */
    max: number;
}

/** Una delle due scelte offerte dopo un piano vinto. */
type PremioTorre =
    | { tipo: 'ristoro'; lp: number }
    | { tipo: 'oggetto'; oggetto: OggettoTorre['id'] };

/** La scalata in corso (SaveManager.getModeState('torre').inCorso). */
interface ScalataTorre {
    /** Il piano da giocare adesso (1-20). */
    piano: number;
    /** Life Point con cui si comincia il prossimo duello. */
    lp: number;
    /** L'avversario di ogni piano, sorteggiato all'inizio della scalata (indice 0 = piano 1). */
    avversari: string[];
    /** Quante volte è stato preso ogni oggetto. */
    oggetti: { mano: number; primo: number; lpAvversario: number; carta: number };
    /** Id della "Carta fidata", se scelta. */
    cartaFidata: number | null;
    /** Le due scelte dopo un piano vinto: finché ci sono, non si sale. */
    sceltaInSospeso: PremioTorre[] | null;
}

/** Tutto lo stato salvato della Torre. */
interface StatoTorre {
    inCorso: ScalataTorre | null;
    /** Com'è finita l'ultima scalata, finché la pagina non l'ha mostrata. */
    ultimoEsito: { piano: number; conquistata: boolean } | null;
    record: { pianoMassimo: number; tentativi: number; conquiste: number };
}

// Le funzioni della partita usate dalle modalità (initGame, endDuel,
// preparaManiIniziali, getCharacterDeck, buildDeckFromSpec...) NON si
// dichiarano qui: sono scritte in file js/ inclusi nel controllo, e una
// seconda dichiarazione andrebbe in conflitto con l'originale. Qui solo gli
// oggetti che quei file pubblicano su window senza dichiararli.
declare var Tavolo: any;
declare var DuelSession: any;
declare var ChallengeTracker: any;
declare var DuelCinematics: any;

interface Window {
    ModalitaDuello?: { [mode: string]: ModalitaDuello };
    puzzlesDatabase: PuzzleDef[];
    rivinciteDatabase: RivincitaDef[];
    torreDatabase: typeof torreDatabase;
    Torre: typeof Torre;
    SaveManager: any;
    ChallengeTracker: any;
    DuelSession: any;
    DuelDialogues: any;
    NativeHaptics: any;
    preparaManiIniziali: () => void;
    DUEL_STARTING_ROLE?: Owner;
}
