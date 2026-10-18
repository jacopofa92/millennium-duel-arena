/**
 * motore.d.ts — tipi del motore del duello, SOLO per il controllo.
 * =====================================================================
 * Il browser non carica mai questo file: il gioco resta JavaScript puro,
 * senza build, apribile da file://. Serve a due cose:
 *  - in VS Code, autocompletamento e documentazione al passaggio del mouse
 *    dentro ogni CardEffects.register(...) (il parametro `ctx` di ogni hook
 *    è tipizzato) e su gameState;
 *  - `npm run typecheck` (tsc -p jsconfig.json) controlla i file che
 *    portano `// @ts-check` in cima. checkJs è spento per tutti gli altri:
 *    si accende un file alla volta, a partire da quelli nuovi del nucleo.
 *
 * I tipi descrivono il contratto ATTUALE (player/bot). Restano larghi
 * (indice `[chiave: string]: any`) dove il motore aggiunge campi al volo:
 * l'obiettivo è aiutare, non bocciare codice che funziona.
 * Quando si aggiunge un'azione a ACTIONS (duel-engine.js) o un hook nuovo
 * letto dal motore, va aggiunto anche qui.
 */

/** Chi controlla qualcosa: il giocatore umano o l'avversario (bot, o la persona dall'altra parte in Multiplayer). */
type Owner = 'player' | 'bot';
type Position = 'attack' | 'defense';
type CardType = 'monster' | 'spell' | 'trap';
/** Da dove arriva una carta Special Summonata (5° argomento di specialSummon, obbligatorio: vedi guardrail-fromzone). */
type FromZone = 'hand' | 'graveyard' | 'deck' | 'extraDeck' | 'banished' | 'field' | 'token' | 'spellTrapZone' | string;

/** Una carta, così come sta in cardDatabase (data/cards.json) più i campi che il motore le aggiunge durante il duello. */
interface Card {
    id: number;
    uid?: string;
    name: string;
    type: CardType;
    subtype?: string;
    level?: number;
    race?: string;
    attribute?: string;
    attack?: number;
    defense?: number;
    effect?: string;
    extraDeck?: boolean;
    origin?: string;
    missingEffectNote?: string;
    /** Carta Equipaggiamento: a chi è agganciata (relativo a chi guarda: vedi traduciStato in multiplayer.js). */
    equippedToOwner?: Owner;
    equippedToIndex?: number;
    equippedToUid?: string;
    [chiave: string]: any;
}

/** Una casella della zona Mostri. */
interface MonsterSlot {
    card: Card;
    position: Position;
    isFaceDown: boolean;
    hasAttacked?: boolean;
    canChangePosition?: boolean;
    summonedOnTurn?: number;
    /** Il vero proprietario di un mostro preso sotto controllo (Cambio di Cuore...). */
    originalOwner?: Owner;
    [chiave: string]: any;
}

/** Una casella della zona Magie/Trappole (o la Magia Terreno). */
interface SpellTrapSlot {
    card: Card;
    isFaceDown: boolean;
    setOnTurn?: number;
    turnsLeft?: number;
    [chiave: string]: any;
}

type Phase = 'draw' | 'standby' | 'main1' | 'battle' | 'main2' | 'end';

/**
 * Lo stato del duello. È un oggetto globale con più di cento campi: qui
 * sono descritti quelli strutturali, il resto passa dall'indice.
 */
interface GameState {
    turn: number;
    phase: Phase;
    currentPlayer: Owner;
    gameOver: boolean;
    playerLP: number;
    botLP: number;
    playerHand: Card[];
    botHand: Card[];
    playerDeck: Card[];
    botDeck?: Card[];
    playerDeckCount: number;
    botDeckCount: number;
    playerMonsterField: (MonsterSlot | null)[];
    botMonsterField: (MonsterSlot | null)[];
    playerSTField: (SpellTrapSlot | null)[];
    botSTField: (SpellTrapSlot | null)[];
    playerFieldSpell: SpellTrapSlot | null;
    botFieldSpell: SpellTrapSlot | null;
    playerGraveyard: Card[];
    botGraveyard: Card[];
    playerBanished?: Card[];
    botBanished?: Card[];
    chain: { links: any[]; active: boolean };
    [chiave: string]: any;
}

/** Esito del checkpoint di targeting (ctx.declareTarget). Il bersaglio può essere stato reindirizzato: usare SEMPRE targetOwner/targetIndex restituiti. */
interface TargetDeclaration {
    allowed: boolean;
    targetOwner: Owner;
    targetIndex: number;
    card?: Card;
}

/**
 * Le azioni di base a disposizione di ogni effetto (oggetto ACTIONS di
 * duel-engine.js). Ognuna aggiorna gameState e fa log/refresh necessari.
 */
interface EngineActions {
    destroyMonster(owner: Owner, index: number): void;
    destroySpellTrap(owner: Owner, index: number, batchToken?: any, visualOptions?: object): void;
    destroyFieldSpell(owner: Owner): void;
    changePosition(owner: Owner, index: number, newPosition: Position): void;
    hasUsedOncePerTurn(key: string): boolean;
    markUsedOncePerTurn(key: string): void;
    hasUsedOncePerDuel(key: string): boolean;
    markUsedOncePerDuel(key: string): void;
    endBattlePhase(): void;
    /** Checkpoint di targeting condiviso: floodgate, reazioni al bersaglio, reindirizzamenti. */
    declareTarget(targetOwner: Owner, targetIndex: number, options?: { totalTargetCount?: number; [k: string]: any }): TargetDeclaration;
    /** Variante con continuazione: attende anche una scelta UI/remota di ridirezione. */
    declareTargetWaiting(targetOwner: Owner, targetIndex: number, options: { totalTargetCount?: number; [k: string]: any } | undefined, onDeclared: (result: TargetDeclaration) => void): void;
    /** declareTarget + destroyMonster in una chiamata: usarlo per ogni "distruggi 1 mostro bersaglio". */
    destroyTargetedMonster(targetOwner: Owner, targetIndex: number, options?: object): TargetDeclaration;
    grantTemporaryAtkDefBonus(card: Card, atk: number, def: number, destroyAfter?: boolean): void;
    grantDamageStepOnlyBonus(card: Card, atk: number, def: number): void;
    clearTemporaryAtkDefBonus(): void;
    destroyAllMonsters(owner: Owner): void;
    destroyAllCards(owner: Owner): void;
    overrideRaceUntilEndOfTurn(card: Card, newRace: string): void;
    /** Danno a `owner` (un valore negativo cura). */
    dealDamage(owner: Owner, amount: number): void;
    negateActivation(): void;
    drawCards(owner: Owner, amount: number): void;
    specialSummon(owner: Owner, card: Card, slotIndex: number, position: Position, fromZone: FromZone, visualOptions?: object): boolean | void;
    findEmptyMonsterSlot(owner: Owner): number;
    createTokens(owner: Owner, count: number, template: Partial<Card>, options?: { cannotBeTributed?: boolean; [k: string]: any }): any;
    shuffleIntoDeck(owner: Owner, cards: Card[]): void;
    searchDeckToHand(owner: Owner, matchFn: (c: Card) => boolean, maxCount?: number): Card[] | void;
    fusionSummon(owner: Owner, extraDeckIndex: number, materialLocations: any[], options?: object): any;
    banish(owner: Owner, card: Card, visualAlreadyStarted?: boolean): void;
    /** Necrovalley: vero se lo spostamento dal Cimitero di `graveyardOwner` è negato. Da chiamare prima di ogni splice a mano dal Cimitero. */
    graveyardMoveNegated(graveyardOwner: Owner): boolean;
    banishFromGraveyard(owner: Owner, card: Card, actor?: Owner): boolean;
    banishTemporarily(owner: Owner, card: Card, returnTrigger: string, lockZoneIndex?: number): void;
    banishFromHandWithCountdown(owner: Owner, card: Card, standbys: number): void;
    reviveFromGraveyardWithCountdown(owner: Owner, card: Card, standbys: number, position: Position): void;
    queueDelayedDestroyAtOpponentEndPhase(queuedByOwner: Owner, targetOwner: Owner, targetCard: Card, ends: number): void;
    discardRandomFromHand(owner: Owner): Card | null | undefined;
    discardChosenFromHand(owner: Owner, handIndex: number): Card | null | undefined;
    millCardFromDeck(owner: Owner, deckIndex: number): Card | null | undefined;
    returnMonsterToHand(owner: Owner, index: number): void;
    /** Rimette un mostro dal Terreno nel Deck del vero proprietario. */
    returnMonsterToDeck(owner: Owner, index: number, options?: object): void;
    /** Manda un mostro dal Terreno al Cimitero SENZA distruggerlo (per i testi che dicono "manda"). */
    sendMonsterToGraveyard(owner: Owner, index: number): void;
    /** Manda dalla mano al Cimitero senza considerare la carta scartata. */
    sendChosenFromHandToGraveyard(owner: Owner, handIndex: number): any;
    takeControl(newOwner: Owner, fromOwner: Owner, fromIndex: number, permanent?: boolean): void;
    swapControl(ownerA: Owner, indexA: number, ownerB: Owner, indexB: number, permanent?: boolean): void;
}

/**
 * Il contesto passato a ogni hook di una carta (makeContext in
 * duel-engine.js): chi la controlla, gli helper di lettura, le azioni, e i
 * dati del momento (attackerIndex, summonedCard, ...) che arrivano da chi
 * ha fatto scattare l'hook.
 */
interface CardContext extends EngineActions {
    owner: Owner;
    opponent: Owner;
    /** La carta di cui si sta eseguendo l'effetto. */
    card: Card;
    zone?: 'hand' | 'monster' | 'st' | 'fieldSpell' | 'graveyard' | 'stAltrui' | string;
    index?: number;
    slot?: MonsterSlot | SpellTrapSlot;
    gameState: GameState;
    log(messaggio: string): void;
    field(owner: Owner): (MonsterSlot | null)[];
    stField(owner: Owner): (SpellTrapSlot | null)[];
    hand(owner: Owner): Card[];
    graveyard(owner: Owner): Card[];
    banished(owner: Owner): Card[];
    /** Numero casuale [0,1) uguale sui due client in Multiplayer: MAI Math.random() in una carta. */
    random(): number;
    randomPick<T>(elenco: T[]): T | undefined;
    newTokenUid(prefisso?: string): string;
    /** Presente solo dove chi esegue l'hook sa aspettare una scelta: usare attendiScelta(ctx). */
    waitForChoice?: () => () => void;

    // --- Dati del momento ------------------------------------------------
    // Arrivano da chi fa scattare l'hook (secondo argomento di makeContext)
    // e valgono solo per certi hook. Elencati uno per uno, senza un indice
    // "qualunque campo": così un nome sbagliato (ctx.atackerIndex) in un
    // file con // @ts-check viene segnalato invece di valere undefined.
    // Un hook nuovo che passa un dato nuovo lo aggiunge qui.
    /** Chi controlla la carta quando a usarla è l'avversario (zona 'stAltrui', usableByEitherPlayer). */
    cardOwner?: Owner;
    // battaglia
    attackerIndex?: number;
    attackerOwner?: Owner;
    attackerAtk?: number;
    targetIndex?: number;
    targetOwner?: Owner;
    totalTargetCount?: number;
    role?: string;
    damage?: number;
    opponentCard?: Card;
    opponentSurvived?: boolean;
    destroyedInBattle?: boolean;
    cancel?: () => void;
    cancelAttack?: () => void;
    redirectAttack?: (...args: any[]) => void;
    redirect?: (...args: any[]) => void;
    zeroAttackerAtk?: () => void;
    negateDamage?: () => void;
    forceDirectAttack?: () => void;
    // Evocazioni
    summonedCard?: Card;
    summonedVia?: 'normal' | 'special' | 'flip' | 'tribute' | string;
    summonedSlotIndex?: number;
    summonedPosition?: Position;
    summonedOwner?: Owner;
    summonedFromZone?: FromZone;
    slotIndex?: number;
    // distruzioni e spostamenti
    destroyedCard?: Card;
    destroyedCardOwner?: Owner;
    destroyedByOwner?: Owner;
    destroyedByCard?: Card;
    destroyedByOpponentCard?: boolean;
    destroyerCard?: Card;
    destroyedWasAttackPosition?: boolean;
    wasFaceDown?: boolean;
    wasPosition?: Position;
    fromPosition?: Position;
    toPosition?: Position;
    discardedByOwner?: Owner;
    milledByOwner?: Owner;
    returnedOwner?: Owner;
    redirectTrapDestruction?: (...args: any[]) => void;
    // attivazioni, targeting, pescate, fasi
    activatedCard?: Card;
    activatedOwner?: Owner;
    sourceCard?: Card;
    sourceOwner?: Owner;
    sourceType?: string;
    drawnCard?: Card;
    standbyOwner?: Owner;
    equippedCard?: Card;
    equipCard?: Card;
    __declaredTargetUids?: string[];
    _pendingRitualVisual?: any;
}

type Hook = (ctx: CardContext) => any;
type Condizione = (ctx: CardContext) => boolean;

/**
 * La definizione di una carta, cioè il secondo argomento di
 * CardEffects.register. Gli hook più usati sono elencati con la loro
 * documentazione; quelli rari passano dall'indice. Fonte dei conteggi:
 * un censimento delle registrazioni (canActivate ~317 carte, continuous
 * ~109, activate, static, onSummon, onFlip, onDestroy...).
 */
interface CardDefinition {
    /** Se la carta si può attivare ORA (click, risposta in Catena). */
    canActivate?: Condizione;
    /** L'effetto all'attivazione/risoluzione. */
    activate?: Hook;
    /** Attivazione ed effetto non possono essere annullati. */
    activationAndEffectCannotBeNegated?: boolean;
    /** Effetto continuo, ricalcolato ad ogni render (recomputeStaticEffects). */
    static?: Hook;
    /** Resta sul Terreno dopo l'attivazione (Magia/Trappola Continua). */
    continuous?: boolean;
    /** Si può ricliccare mentre è già scoperta, per rilanciare activate(). */
    repeatableWhileContinuous?: boolean;
    isEquip?: boolean;
    isUnion?: boolean;
    onSummon?: Hook;
    onSpecialSummon?: Hook;
    onFlip?: Hook;
    onDestroy?: Hook;
    onAttackDeclare?: Hook;
    onOwnAttackDeclare?: Hook;
    onStandbyPhase?: Hook;
    onEndPhase?: Hook;
    onDealsBattleDamage?: Hook;
    onDestroysMonsterInBattle?: Hook;
    onSTDestroyed?: Hook;
    /** "Durante il calcolo dei danni, puoi..." (la battaglia aspetta: vedi attendiScelta). */
    beforeDamageCalculation?: Hook;
    /** Effetto Veloce: risponde a una Catena / finestra di priorità. */
    canRespondAsQuickEffect?: boolean;
    canActivateAsQuickEffect?: Condizione;
    activateAsQuickEffect?: Hook;
    /** Effetto Veloce dalla mano. */
    canRespondFromHand?: boolean;
    canActivateFromHand?: Condizione;
    activateFromHand?: Hook;
    /** Il bot usa l'Effetto Veloce anche in una finestra di priorità a vuoto (DuelEngine.openPriorityWindow). */
    botInFinestraDiPriorita?: boolean | Condizione;
    /** Una carta scoperta sul Terreno che anche l'avversario di chi la controlla può usare (zona 'stAltrui'). */
    usableByEitherPlayer?: boolean;
    cannotNormalSummon?: boolean;
    canNormalSummon?: Condizione;
    cannotBeSpecialSummoned?: boolean;
    cannotSpecialSummon?: boolean;
    cannotBeSpecialSummonedFromGraveyard?: boolean;
    canSpecialSummonFromHand?: Condizione;
    fusionMaterials?: any;
    piercing?: boolean;
    declaredTargeting?: any;
    [chiave: string]: any;
}

declare var gameState: GameState;
declare var cardDatabase: Card[];

/**
 * Gli oggetti globali del motore, come li vedono gli altri script (tutti
 * caricati con <script> classici: ognuno pubblica il proprio su window).
 * Tipizzati `any` per ora: vanno raffinati quando il file che li definisce
 * passa a // @ts-check. Senza queste righe ogni file controllato
 * produrrebbe errori "non esiste su Window" per ogni riferimento.
 */
declare var DuelEngine: any;
declare var DuelEngineUI: any;
declare var CardEffectsShared: any;
declare var AI_SHARED: any;
declare var BotAI: any;
declare var FX: any;
declare var SaveManager: any;
declare var CloudSync: any;
interface Window {
    DuelEngine: any;
    DuelEngineUI: any;
    CardEffectsShared: any;
    CardEffects: typeof CardEffects;
    AI_SHARED: any;
    BotAI: any;
    FX: any;
    /** Vero nella pagina del Multiplayer: i due client simulano lo stesso duello. */
    MULTIPLAYER_MODE?: boolean;
    /** Spedisce un'azione all'avversario (solo in Multiplayer). */
    MP_broadcast?: (azione: any) => void;
    /** Alzato mentre si applica una mossa arrivata dall'avversario: chi trasmette non deve rimandarla indietro. */
    MP_applyingRemote?: boolean;
}

declare var CardEffects: {
    /** Registra l'effetto di una carta. `def` è tipizzato: dentro ogni hook `ctx` ha autocompletamento. */
    register(id: number, def: CardDefinition): void;
};
