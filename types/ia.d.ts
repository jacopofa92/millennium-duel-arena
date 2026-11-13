/** Tipi condivisi delle euristiche IA (`js/ai/ai-shared.js`). */
interface AIEstimateStats {
    atk: number;
    def: number;
}

interface AIDecisioneRa {
    paga: number;
    motivo: string;
}

interface AISummonDecision {
    card: Card;
    tributeIndices: number[];
    emptySlotHint: number;
    position: Position;
    faceDown: boolean;
    customNormalSummon?: boolean;
}

interface AIResponseCandidate {
    card: Card;
    zone?: 'st' | 'hand' | 'fieldSpell' | 'stAltrui' | 'graveyard' | 'monster';
    index?: number;
    def?: CardDefinition;
    cardOwner?: Owner;
    evento?: Record<string, unknown>;
    round?: number;
}

interface AIHandAction {
    handIndex: number;
    card: Card;
    action: 'activate' | 'set';
}

interface AIFieldAction {
    zone: 'monster' | 'st';
    index: number;
    card: Card;
}

interface AIBanishFusionCandidate {
    extraDeckIndex: number;
    card: Card;
    materialFieldIndices: number[];
}

interface AIMedium {
    chooseSummon(gameState: GameState, owner?: Owner, options?: {
        scoreMonster?: (card: Card) => number;
        allowCandidate?: (card: Card) => boolean;
        decidePosture?: (card: Card) => { position: Position; faceDown: boolean };
        isTributeSummonWorthwhile?: (card: Card, sacrificedValue: number, tributeIndices: number[]) => boolean;
    }): AISummonDecision | null;
    chooseAttackTarget(attackerSlot: MonsterSlot, playerMonsters: Array<{ slot: MonsterSlot; index: number }>, owner?: Owner): number | null;
    chooseChainResponse(candidates: AIResponseCandidate[], owner?: Owner): AIResponseCandidate | null;
    chooseNextSpellTrapAction(gameState: GameState, usedThisTurn: { activateDone?: boolean; setDone?: boolean; setCount?: number }, owner?: Owner, options?: { restraintBonus?: number }): AIHandAction | null;
    chooseSetCardActivation(gameState: GameState, owner?: Owner): AIFieldAction | null;
    chooseBanishFusion(gameState: GameState, owner?: Owner): AIBanishFusionCandidate | null;
    choosePositionChanges(gameState: GameState, owner?: Owner): number[];
    /** Funzioni avanzate assenti in Media; il controller le verifica prima di chiamarle. */
    chooseHandSpecialSummon?: AIHard['chooseHandSpecialSummon'];
    choosePreSummonSpellAction?: AIHard['choosePreSummonSpellAction'];
    orderAttackers?: AIHard['orderAttackers'];
    estimateLethal?: AIHard['estimateLethal'];
}

interface AIAttacker {
    slot: MonsterSlot;
    index: number;
}

interface AILethalEstimate {
    possible: boolean;
    damage: number;
}

interface AIHard {
    evaluateBoard(gameState: GameState, owner?: Owner): number;
    chooseSummon(gameState: GameState, owner?: Owner): AISummonDecision | null;
    chooseHandSpecialSummon(gameState: GameState, owner?: Owner): { card: Card; handIndex: number } | null;
    choosePreSummonSpellAction(gameState: GameState, owner?: Owner): AIHandAction | null;
    orderAttackers(attackers: AIAttacker[]): AIAttacker[];
    estimateLethal(attackers: AIAttacker[], defenders: AIAttacker[], opponentLp: number, owner?: Owner): AILethalEstimate;
    choosePositionChanges(gameState: GameState, owner?: Owner): number[];
    chooseAttackTarget(attackerSlot: MonsterSlot, opponentMonsters: AIAttacker[], owner?: Owner): number | null;
    chooseChainResponse(candidates: AIResponseCandidate[], owner?: Owner): AIResponseCandidate | null;
    chooseNextSpellTrapAction(gameState: GameState, usedThisTurn?: { activateCount?: number; setCount?: number }, owner?: Owner): AIHandAction | null;
    chooseSetCardActivation(gameState: GameState, owner?: Owner): AIFieldAction | null;
    chooseBanishFusion(gameState: GameState, owner?: Owner): AIBanishFusionCandidate | null;
}

interface BotAI {
    chooseSummon(gameState: GameState, owner?: Owner): AISummonDecision | null;
    chooseHandSpecialSummon(gameState: GameState, owner?: Owner): { card: Card; handIndex: number } | null;
    choosePreSummonSpellAction(gameState: GameState, owner?: Owner): AIHandAction | null;
    orderAttackers(attackers: AIAttacker[], owner?: Owner): AIAttacker[];
    estimateLethal(attackers: AIAttacker[], defenders: AIAttacker[], opponentLp: number, owner?: Owner): AILethalEstimate;
    choosePositionChanges(gameState: GameState, owner?: Owner): number[];
    chooseBanishFusion(gameState: GameState, owner?: Owner): AIBanishFusionCandidate | null;
    chooseAttackTarget(attackerSlot: MonsterSlot, opponentMonsters: AIAttacker[], owner?: Owner): number | null;
    chooseChainResponse(candidates: AIResponseCandidate[], owner?: Owner): AIResponseCandidate | null;
    chooseNextSpellTrapAction(gameState: GameState, usedThisTurn?: { activateCount?: number; setCount?: number }, owner?: Owner): AIHandAction | null;
    chooseSetCardActivation(gameState: GameState, owner?: Owner): AIFieldAction | null;
    explainDecision(label: string, data: unknown): void;
}

interface AIShared {
    effAtk(card: Card | null | undefined): number;
    effDef(card: Card | null | undefined): number;
    statRilevante(slot: MonsterSlot): number;
    scoreCardImpact(card: Card | null | undefined): number;
    estimateSummonedStats(card: Card | null | undefined, gameState: GameState, owner: Owner): AIEstimateStats;
    raLpDecisione(gameState: GameState, owner: Owner, opzioni?: { tributi?: number[] }): AIDecisioneRa;
    raLpDaPagare(gameState: GameState, owner: Owner, opzioni?: { tributi?: number[] }): number;
    shouldPayRaLp(gameState: GameState, owner: Owner, opzioni?: { tributi?: number[] }): boolean;
    decideMonsterPosture(card: Card | null | undefined, gameState: GameState, owner: Owner, riskAversion?: number): { position: Position; faceDown: boolean };
    choosePositionChanges(gameState: GameState, owner: Owner, conosceCoperti?: boolean): number[];
    isSingleTargetRemoval(card: Card | null | undefined): boolean;
    isRemovalWorthwhile(card: Card | null | undefined, gameState: GameState, owner: Owner, threshold: number): boolean;
    hasOwnSideCost(card: Card | null | undefined): boolean;
    isMassDestructionWorthwhile(card: Card | null | undefined, gameState: GameState, owner: Owner): boolean;
    shouldNegateSoffioIncendiario(ctx: { owner: Owner; gameState: GameState }, costoLp: number): boolean | null;
    canNormalSummonNow(card: Card | null | undefined, gameState: GameState, owner: Owner): boolean;
    shouldHoldForExodia(card: Card | null | undefined, gameState: GameState, owner: Owner): boolean;
    canBeDestroyedByBattle(defenderCard: Card, defenderOwner: Owner, attackerAtk: number): boolean;
    isTributeSummonWorthwhile(card: Card, sacrificedValue: number, gameState: GameState, owner: Owner): boolean;
    getSpellTrapRestraint(gameState: GameState, owner: Owner): number;
    pickWeightedByImpact<T extends { card: Card }>(candidates: T[], restraint: number): T | null;
    guadagnoRelativoCampo(card: Card, owner: Owner): { mio: number; loro: number };
    distruggeSoloMagieTrappoleSue(card: Card | null | undefined, owner: Owner): boolean;
    attivazioneSensata(card: Card | null | undefined, owner: Owner, zona?: string, indice?: number, evento?: Record<string, unknown>): boolean;
}
