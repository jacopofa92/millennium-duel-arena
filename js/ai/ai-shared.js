/**
 * ai-shared.js — Euristiche condivise tra i livelli di difficoltà
 * dell'IA (js/ai/ai-medium.js, js/ai/ai-hard.js). Vanno caricate PRIMA
 * di entrambi (vedi <script> in duelMonstersCore.html).
 *
 * Il motore non introspeziona il vero "peso" di un effetto a runtime
 * (richiederebbe eseguirlo a vuoto per vedere cosa fa), quindi qui si
 * stima l'impatto di una carta leggendo PAROLE CHIAVE nel suo testo
 * effetto italiano (card.effect) — una stima grezza ma sufficiente per
 * far scegliere all'IA "Difficile" la carta più forte tra più candidate
 * invece della prima che capita, e per decidere se vale la pena
 * Settare/attivare una Magia o Trappola invece di trattenerla.
 */
(function () {
    'use strict';

    // Parola chiave -> punti d'impatto stimato. Più alto = più forte.
    // L'ordine di controllo conta poco: si sommano tutti i match trovati.
    const KEYWORD_WEIGHTS = [
        [/distrugg/i, 4],           // rimozione permanente
        [/bandisc/i, 4],            // rimozione ancora più definitiva
        [/nega/i, 3],               // negazione di un'attivazione/effetto
        [/prende il controllo|controllo del/i, 4], // furto di un mostro
        [/special summon/i, 2],
        [/danni|infligg/i, 2],
        [/pesca \d|pesca fino/i, 2],
        [/dimezza|guadagna \d+ atk|perde \d+ atk/i, 1],
        [/torna in mano|ritorna in mano/i, 1],
        [/mescola/i, 1]
    ];

    /**
     * ATK/DEF EFFETTIVI di un mostro: statistica stampata più ogni bonus o
     * malus in corso (Magie Terreno, Equipaggiamenti, effetti a tempo...),
     * esattamente ciò che il motore userà quando la battaglia si risolve
     * (DuelEngine.getEffectiveAtk/Def). L'IA li confrontava coi valori
     * STAMPATI: con un mostro a 1200 ATK potenziato a 1700 da un Terreno,
     * il bot lo trovava "battibile" da uno da 1400 e attaccava in perdita
     * (e viceversa non attaccava un mostro che in realtà era più forte).
     * Vale per i mostri SULLA scacchiera: un mostro ancora in mano non ha
     * (ancora) alcun bonus, e per quelli si resta sul valore stampato.
     * Se il motore non è caricato ripiega sul valore stampato.
     */
    function effAtk(card) {
        if (!card) return 0;
        if (window.DuelEngine && typeof DuelEngine.getEffectiveAtk === 'function') return DuelEngine.getEffectiveAtk(card) || 0;
        return card.attack || 0;
    }
    function effDef(card) {
        if (!card) return 0;
        if (window.DuelEngine && typeof DuelEngine.getEffectiveDef === 'function') return DuelEngine.getEffectiveDef(card) || 0;
        return card.defense || 0;
    }
    /** La statistica con cui un mostro SCOPERTO si difende in battaglia: ATK se in Attacco, DEF se in Difesa (entrambi effettivi). */
    function statRilevante(slot) {
        return slot.position === 'attack' ? effAtk(slot.card) : effDef(slot.card);
    }

    /**
     * Stima grezza dell'impatto di una carta guardando il suo testo
     * effetto — usata per ordinare più candidate tra loro (es. quale
     * Trappola Set attivare per rispondere, quale Magia in mano
     * attivare prima). Un mostro senza testo Magia/Trappola riceve un
     * punteggio base pari al suo ATK diviso 500, così un vanilla forte
     * non risulta mai "zero" rispetto a una Magia/Trappola debole.
     */
    function scoreCardImpact(card) {
        if (!card) return 0;
        if (card.type === 'monster') return (card.attack || 0) / 500;
        const text = card.effect || '';
        let score = 1; // punteggio base: attivarla è comunque quasi sempre un piccolo vantaggio
        KEYWORD_WEIGHTS.forEach(([re, weight]) => {
            if (re.test(text)) score += weight;
        });
        return score;
    }

    /**
     * Decide la "postura" di un mostro da Evocare per il bot: Attacco
     * scoperto, Difesa coperta (Set), o Difesa scoperta. Torna
     * { position: 'attack'|'defense', faceDown: bool }.
     *
     * Priorità (per richiesta esplicita dell'utente):
     *   1) Se il campo avversario ha già un mostro SCOPERTO la cui
     *      statistica rilevante (ATK se in Attacco, DEF se in Difesa) è
     *      INFERIORE all'ATK di questo mostro: mettilo comunque in
     *      Attacco scoperto — c'è un bersaglio favorevole da colpire in
     *      Battle Phase (vedi chooseAttackTarget in ai-medium.js/
     *      ai-hard.js, che lo raccoglierà da solo), non ha senso
     *      sprecare quell'ATK dietro uno scudo di Difesa.
     *   2) Altrimenti, se il mostro più forte scoperto dell'avversario
     *      lo distruggerebbe COMUNQUE (il suo ATK supera sia l'ATK sia
     *      la DEF di questo mostro): meglio la Difesa, anche se l'ATK di
     *      questo mostro è più alto della sua stessa DEF — morire in
     *      Attacco costa anche i Life Points della differenza, morire in
     *      Difesa no. Non evita la perdita del mostro (che comunque non
     *      si può prevedere del tutto), solo la perdita aggiuntiva di LP
     *      di una battaglia già persa in partenza.
     *   3) Altrimenti, se la DEF supera l'ATK (statisticamente un
     *      mostro "da Difesa"): Difesa COPERTA (Set) se ha 4 Stelle o
     *      meno (nessun costo aggiuntivo per nasconderlo), Difesa
     *      SCOPERTA se ne ha 5 o più (tipicamente arrivato tramite
     *      un'Evocazione Tributo: già "costoso" e visibile, coprirlo non
     *      aggiunge molto).
     *   4) Altrimenti (mostro da Attacco): Attacco scoperto — A MENO CHE
     *      `riskAversion` non sia impostato (solo IA_DIFFICILE lo passa,
     *      vedi ai-hard.js#chooseSummon — lo stesso `faceDownRisk` di
     *      currentAttitude, già usato per decidere se rischiare un
     *      attacco contro un bersaglio coperto, riusato qui identico) E
     *      l'avversario abbia una mano abbondante (>= 4 carte, rischio
     *      concreto di una Trappola/rimozione a sorpresa): a questo punto
     *      non c'è comunque nessun bersaglio favorevole da colpire ORA
     *      (già escluso al punto 1), quindi esporre subito le vere
     *      statistiche di questo mostro non offre alcun vantaggio
     *      immediato — meglio restare un'incognita in Difesa coperta per
     *      un turno che regalare informazione gratuita a un avversario
     *      pronto a rispondere. Richiesta esplicita dell'utente: estendere
     *      la stessa nozione di rischio già usata per gli attacchi anche
     *      alla scelta Evocazione scoperta/coperta.
     */
    function estimateSummonedStats(card, gameState, owner) {
        if (card && card.id === 31) {
            const hand = Tavolo.mano(owner, gameState) || [];
            // Durante chooseSummon Slifer è ancora in mano: dopo la mossa
            // non contribuirà più al proprio bonus. Il confronto deve usare
            // il valore che avrà davvero sul Terreno, non quello attuale.
            const remainingCards = Math.max(0, hand.length - (hand.includes(card) ? 1 : 0));
            return { atk: remainingCards * 1000, def: remainingCards * 1000 };
        }
        if (card && card.id === 472) {
            // Qui i Tributi non sono ancora scelti: l'eccezione "scacco" conta solo Ra (vedi raLpDaPagare), per non fidarsi di
            // mostri che poi potrebbero essere sacrificati.
            const paid = raLpDaPagare(gameState, owner);
            return { atk: paid, def: paid };
        }
        return { atk: (card && card.attack) || 0, def: (card && card.defense) || 0 };
    }

    // ---------------------------------------------------------------
    // Il Drago Alato di Ra: QUANTI Life Point paga il bot all'Evocazione.
    // ---------------------------------------------------------------
    // Prima pagava TUTTO (fino a restare a 100) ma solo a campo avversario vuoto. Ora decide una somma con un ragionamento in due
    // parti, scelto dall'utente:
    //  A) L'OBIETTIVO: Ra deve battere il mostro avversario piu' forte con un margine (RA_MARGINE), e comunque arrivare ad almeno
    //     RA_ATK_MINIMO — pagare poco per un Ra da 900 sarebbe buttare tre Tributi. Un mostro coperto, di cui non si sa l'ATK, conta
    //     RA_ATK_IGNOTO (3000: l'ipotesi prudente, scelta dall'utente, e non una media).
    //  B) LA SOGLIA di LP da non toccare: parte da RA_LP_MINIMI e cresce con quanto puo' colpire il bot al turno dopo (gli altri
    //     attaccanti avversari: Ra ne ferma uno solo), con le Magie/Trappole che l'avversario ha in campo (2 o piu') e con la sua
    //     mano abbondante (4 o piu'). Si paga solo se, restando sopra la soglia, si arriva almeno a RA_ATK_MINIMO; altrimenti niente
    //     (e chooseSummon, che stima Ra con questa stessa funzione, non lo Evoca nemmeno).
    //  ECCEZIONE "scacco": se il campo avversario e' vuoto e un colpo diretto vince — i LP dell'avversario sono pari o meno
    //     dell'ATK di Ra piu' quello degli altri attaccanti pronti — basta pagare il necessario, anche sotto RA_ATK_MINIMO e
    //     anche oltre la soglia (si rischia: Trappole e Magie dell'avversario restano un'incognita, come da richiesta).
    // `opzioni.tributi`: gli indici dei mostri che verranno sacrificati (non attaccano piu'); se mancano, per l'eccezione si conta
    // soltanto Ra.
    const RA_ATK_MINIMO = 3000;
    const RA_MARGINE = 500;
    const RA_ATK_IGNOTO = 3000;
    const RA_LP_MINIMI = 1000;
    const RA_PASSO = 50;

    function raLpDecisione(gameState, owner, opzioni) {
        const arrotondaSu = (n) => Math.ceil(n / RA_PASSO) * RA_PASSO;
        const arrotondaGiu = (n) => Math.floor(n / RA_PASSO) * RA_PASSO;
        const mieiLp = Tavolo.lp(owner, gameState) || 0;
        if (mieiLp <= 100) return { paga: 0, motivo: 'niente-lp' };
        const massimoPagabile = mieiLp - 100;
        const avv = Tavolo.avversario(owner);
        const lpAvv = Tavolo.lp(avv, gameState) || 0;
        const mostriAvv = (Tavolo.mostri(avv, gameState) || []).filter(Boolean);

        // ECCEZIONE "scacco": un colpo diretto chiude il duello.
        if (mostriAvv.length === 0 && lpAvv > 0) {
            const tributi = (opzioni && opzioni.tributi) || [];
            const altriAttaccanti = (Tavolo.mostri(owner, gameState) || []).reduce((somma, slot, i) => {
                if (!slot || slot.isFaceDown || slot.position !== 'attack' || slot.hasAttacked || tributi.indexOf(i) !== -1) return somma;
                return somma + effAtk(slot.card);
            }, 0);
            const serveAdRa = lpAvv - altriAttaccanti;
            if (serveAdRa <= 0) return { paga: 0, motivo: 'gia-vinto' };   // gli altri bastano: Ra non deve costare niente
            const paga = arrotondaSu(serveAdRa);
            if (paga <= massimoPagabile) return { paga, motivo: 'scacco' };
        }

        // A) l'obiettivo.
        const atkMinacce = mostriAvv
            .map((slot) => (slot.isFaceDown ? RA_ATK_IGNOTO : effAtk(slot.card)))
            .sort((a, b) => b - a);
        const piuForte = atkMinacce[0] || 0;
        const obiettivo = Math.max(RA_ATK_MINIMO, arrotondaSu(piuForte + RA_MARGINE));

        // B) la soglia di LP da non toccare.
        const esposizione = atkMinacce.slice(1).reduce((somma, atk) => somma + atk, 0);   // Ra ne ferma uno solo
        const retroguardia = (Tavolo.magieTrappole(avv, gameState) || []).filter(Boolean).length;
        const manoAvv = (Tavolo.mano(avv, gameState) || []).length;
        let soglia = RA_LP_MINIMI + esposizione;
        if (retroguardia >= 2) soglia += 500;
        if (manoAvv >= 4) soglia += 500;
        const pagabile = arrotondaGiu(Math.min(massimoPagabile, mieiLp - soglia));
        if (pagabile < RA_ATK_MINIMO) return { paga: 0, motivo: 'troppo-rischioso' };
        return { paga: Math.min(obiettivo, pagabile), motivo: 'obiettivo' };
    }

    /** La somma di LP che il bot paga per Ra (0 = non paga). La usano sia la stima (estimateSummonedStats) sia l'esecuzione (bot.js). */
    function raLpDaPagare(gameState, owner, opzioni) {
        return raLpDecisione(gameState, owner, opzioni).paga;
    }

    /** Compatibilita': "paga qualcosa?". */
    function shouldPayRaLp(gameState, owner, opzioni) {
        return raLpDaPagare(gameState, owner, opzioni) > 0;
    }

    function decideMonsterPosture(card, gameState, owner, riskAversion) {
        if (!card) return { position: 'attack', faceDown: false };
        const previste = estimateSummonedStats(card, gameState, owner);
        const atk = previste.atk;
        const def = previste.def;
        // Un mostro con 0 ATK (Idolo dai 1000 Occhi...) in Attacco non colpisce nulla e si fa solo distruggere:
        // sempre in Difesa (coperto se e' di Livello basso). Prima, senza mostri avversari in campo, finiva in Attacco.
        if (atk <= 0) return { position: 'defense', faceDown: (card.level || 0) <= 4 };
        const opponentField = Tavolo.mostri(Tavolo.avversario(owner), gameState);
        const hasFavorableTarget = (opponentField || []).some((slot) => {
            if (!slot || slot.isFaceDown) return false;
            return statRilevante(slot) < atk;
        });
        if (hasFavorableTarget) return { position: 'attack', faceDown: false };
        const strongestOpposingAtk = (opponentField || []).reduce((max, slot) => {
            if (!slot || slot.isFaceDown || slot.position !== 'attack') return max;
            return Math.max(max, effAtk(slot.card));
        }, 0);
        const doomedEitherWay = strongestOpposingAtk > atk && strongestOpposingAtk > def;
        if (def > atk || doomedEitherWay) {
            const level = card.level || 0;
            return { position: 'defense', faceDown: level <= 4 };
        }
        // Soglia 1500: la stessa fascia "neutrale/in vantaggio" di
        // currentAttitude (ai-hard.js) — in svantaggio netto (900) resta
        // aggressiva ed espone comunque il mostro, coerente con "in
        // svantaggio netto rischia di più pur di rientrare in partita"
        // già documentato per gli attacchi.
        if (riskAversion >= 1500) {
            const opponentHand = Tavolo.mano(Tavolo.avversario(owner), gameState);
            if ((opponentHand || []).length >= 4) {
                return { position: 'defense', faceDown: true };
            }
        }
        return { position: 'attack', faceDown: false };
    }

    /**
     * Cambi di Posizione per un mostro presente da un turno precedente.
     * Media legge soltanto i mostri avversari scoperti; Hard può passare
     * `conosceCoperti=true` e valutare anche la statistica reale dei coperti.
     *
     * - Difesa→Attacco: campo libero o bersaglio immediatamente battibile.
     * - Attacco→Difesa: nessun bersaglio favorevole e una minaccia scoperta
     *   più forte pronta a distruggerlo; anche se la DEF non basta a salvarlo,
     *   la posizione evita almeno il danno da combattimento agli LP.
     */
    function choosePositionChanges(gameState, owner, conosceCoperti) {
        const avversario = Tavolo.avversario(owner);
        const campoAvversario = Tavolo.mostri(avversario, gameState).filter(Boolean);
        const bersagliValutabili = campoAvversario.filter((slot) => conosceCoperti || !slot.isFaceDown);
        const minacceScoperte = campoAvversario.filter((slot) => !slot.isFaceDown && slot.position === 'attack');

        return Tavolo.mostri(owner, gameState)
            .map((slot, index) => ({ slot, index }))
            .filter(({ slot }) => {
                if (!slot || !slot.canChangePosition) return false;
                const atk = effAtk(slot.card);
                if (slot.position === 'defense') {
                    if (atk <= 0) return false;
                    if (campoAvversario.length === 0) return true;
                    return bersagliValutabili.some((bersaglio) => atk > statRilevante(bersaglio));
                }

                const haBersaglioFavorevole = bersagliValutabili.some((bersaglio) => atk > statRilevante(bersaglio));
                if (haBersaglioFavorevole || minacceScoperte.length === 0) return false;
                const minacciaMassima = minacceScoperte.reduce((massimo, slot) => Math.max(massimo, effAtk(slot.card)), 0);
                return minacciaMassima > atk;
            })
            .map(({ index }) => index);
    }

    // Parole chiave che segnalano un effetto di RIMOZIONE mirata (distrugge/
    // bandisce/ruba UN mostro) — vedi isSingleTargetRemoval più sotto. "tutti
    // i mostri"/"ogni mostro" fa eccezione: un effetto di massa non va mai
    // trattenuto in attesa di un bersaglio "che valga abbastanza", colpisce
    // comunque tutto ciò che c'è.
    const REMOVAL_KEYWORD = /distrugg|bandisc|prende il controllo|controllo del/i;
    const MASS_EFFECT_KEYWORD = /tutti i mostri|ogni mostro|tutte le carte/i;

    /** Vero se `card` è una Magia/Trappola che rimuove UN mostro bersaglio (non un effetto di massa) — usata per decidere se vale la pena trattenerla per un bersaglio migliore invece di sprecarla subito. */
    function isSingleTargetRemoval(card) {
        if (!card || card.type === 'monster') return false;
        const text = card.effect || '';
        return REMOVAL_KEYWORD.test(text) && !MASS_EFFECT_KEYWORD.test(text);
    }

    /**
     * Vero se attivare/Settare ORA `card` (una rimozione a bersaglio
     * singolo) vale la pena, guardando la statistica migliore tra i
     * mostri SCOPERTI dell'avversario — se non è single-target-removal
     * (altra Magia/Trappola qualunque, o un mostro) torna sempre vero,
     * nessuna restrizione. Nata per correggere un difetto segnalato
     * dall'utente: il bot spendeva le proprie carte di rimozione sul
     * primo bersaglio disponibile fin dai primissimi turni, anche contro
     * un vanilla scarso — non "troppo" nel senso di troppe copie (il
     * dataset ne ha quante ne ha), ma nel senso di usarle senza alcun
     * discernimento sul VALORE del bersaglio. Un mostro coperto riceve
     * una stima prudente (1200, né "sempre sì" né "mai") perché il bot
     * non può sapere cosa nasconde ma non deve nemmeno ignorarlo del
     * tutto. `threshold` è deciso da chi chiama: IA_MEDIA usa un valore
     * fisso, IA_DIFFICILE lo scala in base a quanto sta andando bene la
     * partita (vedi AI_HARD.evaluateBoard) — più prudente da in vantaggio,
     * più disposta a "bruciare" pur di stabilizzarsi se in svantaggio.
     */
    function isRemovalWorthwhile(card, gameState, owner, threshold) {
        if (!isSingleTargetRemoval(card)) return true;
        const opponentField = Tavolo.mostri(Tavolo.avversario(owner), gameState);
        let bestStat = 0;
        let hasFaceDown = false;
        (opponentField || []).forEach((slot) => {
            if (!slot) return;
            if (slot.isFaceDown) { hasFaceDown = true; return; }
            bestStat = Math.max(bestStat, statRilevante(slot));
        });
        if (hasFaceDown) bestStat = Math.max(bestStat, 1200);
        return bestStat >= threshold;
    }

    /**
     * Un effetto di massa che dichiara esplicitamente "che il tuo
     * avversario controlla"/"controllati dal tuo avversario"/ecc. colpisce
     * SOLO l'altro lato (es. Raigeki): pura risorsa, nessun costo, ed è
     * per questo che MASS_EFFECT_KEYWORD qui sopra è sempre stato escluso
     * da isSingleTargetRemoval senza ulteriori controlli. Un effetto che
     * NON lo dichiara ("Distruggi tutti i mostri sul Terreno", Buco Nero
     * id 7) colpisce anche il proprio — e questo controllo era
     * completamente assente: il bot lo trattava come vantaggio puro allo
     * stesso modo, e finiva per Evocare un mostro e poi distruggerselo da
     * solo con Buco Nero nello stesso turno. Segnalato dall'utente.
     *
     * L'assunzione è deliberatamente PRUDENTE nel verso giusto: un testo
     * ambiguo o scritto in un modo che questa regex non riconosce viene
     * trattato come "colpisce anche il mio lato" (mai il contrario) — nel
     * peggiore dei casi il bot valuta con più attenzione una carta
     * innocua, mai il contrario (autodistruggersi senza accorgersene).
     */
    const OPPONENT_ONLY_OWNERSHIP = /(che |dal )?(il )?tuo avversario (ne )?controlla|controllat[ei] dal tuo avversario/i;

    /** Vero se `card` è un effetto di distruzione di massa che colpisce ANCHE il proprio Terreno (non solo quello dell'avversario). */
    function hasOwnSideCost(card) {
        if (!card || card.type === 'monster') return false;
        const text = card.effect || '';
        if (!/distrugg/i.test(text) || !MASS_EFFECT_KEYWORD.test(text)) return false;
        return !OPPONENT_ONLY_OWNERSHIP.test(text);
    }

    /**
     * Vale la pena attivare ORA un effetto di distruzione di massa che
     * colpisce anche il proprio Terreno? Confronta il valore stimato del
     * proprio campo con quello dell'avversario (statistica rilevante di
     * ogni mostro scoperto, stima prudente di 1200 per ognuno coperto —
     * stessa stima già usata da isRemovalWorthwhile) e richiede che
     * l'avversario perda DAVVERO più di quanto perda il proprietario:
     * un pareggio non basta, altrimenti un Terreno vuoto contro un
     * Terreno vuoto attiverebbe comunque la carta a vuoto.
     *
     * Se non ha alcun costo per il proprio lato (hasOwnSideCost falso),
     * torna sempre vero — nessuna restrizione, esattamente come prima.
     */
    function isMassDestructionWorthwhile(card, gameState, owner) {
        if (!hasOwnSideCost(card)) return true;
        const ownField = Tavolo.mostri(owner, gameState);
        const opponentField = Tavolo.mostri(Tavolo.avversario(owner), gameState);
        const valoreCampo = (campo) => (campo || []).reduce((somma, slot) => {
            if (!slot) return somma;
            if (slot.isFaceDown) return somma + 1200;
            return somma + statRilevante(slot);
        }, 0);
        return valoreCampo(opponentField) > valoreCampo(ownField);
    }

    /**
     * Vero se `card` è normalmente Evocabile ORA da parte di `owner` —
     * SOLO per il vincolo "non può essere Evocata a meno che tu non
     * controlli scoperta [altra carta specifica]" (def.requiresFieldPresenceId,
     * vedi js/engine/card-effects.js — es. Guardiano Grarl id 284,
     * Guardiano Kay'est id 285), NON un controllo generico di legalità
     * (Tributi/slot liberi restano gestiti a parte da chi chiama). Usata
     * per filtrare i candidati del bot PRIMA di provare a Evocarli, così
     * l'IA non spreca un turno tentando un'Evocazione che verrebbe
     * comunque rifiutata da attemptMonsterSummon (actions.js).
     */
    function canNormalSummonNow(card, gameState, owner) {
        // Guardiano Falce del Terrore (id 282): "non puoi Evocare
        // Normalmente/Set altri mostri finché questa carta è in campo" —
        // stesso gameState.otherMonsterSummonsBlockedFor già consultato
        // lato giocatore in attemptMonsterSummon (actions.js) e da
        // ACTIONS.specialSummon (duel-engine.js).
        if (gameState.otherMonsterSummonsBlockedFor && gameState.otherMonsterSummonsBlockedFor[owner] && card.id !== 282) return false;
        // Divieti della carta stessa ("non Evocabile Normalmente", fisso o
        // condizionato): stesso punto unico del lato giocatore.
        if (window.DuelEngine && DuelEngine.normalSummonBlockReason && DuelEngine.normalSummonBlockReason(owner, card)) return false;
        const def = window.DuelEngine && DuelEngine.getDefinition(card.id);
        if (!def || !def.requiresFieldPresenceId) return true;
        // La carta richiesta può essere un mostro O una Magia/Trappola
        // (es. una Carta Equipaggiamento) — vedi lo stesso controllo su
        // entrambe le zone in attemptMonsterSummon, actions.js.
        const field = Tavolo.mostri(owner, gameState);
        const stField = Tavolo.magieTrappole(owner, gameState);
        return field.some((s) => s && !s.isFaceDown && s.card.id === def.requiresFieldPresenceId)
            || stField.some((s) => s && !s.isFaceDown && s.card.id === def.requiresFieldPresenceId);
    }

    /**
     * Vero se `card` è uno dei 5 pezzi di Exodia il Proibito
     * (EXODIA_PIECE_IDS, dichiarata in js/engine/game-flow.js, caricato
     * PRIMA di questo file — riferimento diretto per nome, come già
     * `gameState` altrove in questi moduli IA: un `const` a livello di
     * script resta visibile per nome ai `<script>` successivi nello
     * stesso documento, anche se non diventa una proprietà di `window`).
     * Il bot non deve MAI Evocarli Normalmente: hanno statistiche di
     * battaglia trascurabili (braccia/gambe da 200-300 ATK/DEF, la Testa
     * non è da meno) e il loro vero valore è restare TUTTI E CINQUE in
     * mano per la vittoria istantanea (hasExodiaAssembled, game-flow.js)
     * — Evocarne anche solo uno lo toglierebbe dalla mano, vanificando
     * quell'obiettivo. Richiesta esplicita dell'utente: "se Yugi Muto (e/o
     * il nonno) ha le carte di Exodia, deve tenerle in mano e non
     * giocarle... deve puntare ad avere i 5 pezzi". Generico per
     * QUALUNQUE mazzo del bot li contenga (oggi soprattutto Seeker e Yugi Muto
     * per tema, vedi js/data/character-decks.js) — la condizione vera è
     * "il bot ha in mano un pezzo di Exodia", non "il bot è un
     * personaggio specifico", quindi nessun controllo per nome qui.
     */
    function shouldHoldForExodia(card) {
        return !!(card && typeof EXODIA_PIECE_IDS !== 'undefined' && EXODIA_PIECE_IDS.includes(card.id));
    }

    /**
     * Vero se `defenderCard` (controllato da `defenderOwner`) verrebbe
     * DAVVERO distrutto scontrandosi in battaglia con un attaccante da
     * `attackerAtk` ATK — replica in sola lettura (nessuna mutazione di
     * stato) la stessa logica di cardIsIndestructibleByBattle/
     * survivesBattleDestruction usata dal vero resolveBattleDamage
     * (js/engine/actions.js), qui esposta all'IA perché smetta di trattare
     * come "bersaglio conveniente" un mostro che sopravviverebbe comunque
     * — richiesta esplicita dell'utente: il bot non deve continuare a
     * puntare un mostro che non può distruggere, ma valutare altre
     * strategie (altro bersaglio, attacco diretto, trattenere l'attaccante).
     * Non replica i redirect Union (DuelEngine.tryRedirectUnionDestroy)
     * né def.onWouldBeDestroyedInBattle (casi di nicchia che MUTANO stato
     * reale se innescati — qui serve solo una stima, non un'esecuzione):
     * un mostro Union che "assorbirebbe" la distruzione su un'altra carta
     * resta quindi trattato come normalmente distruttibile, comportamento
     * INVARIATO rispetto a prima di questa modifica.
     */
    function canBeDestroyedByBattle(defenderCard, defenderOwner, attackerAtk) {
        if (gameState.noBattleDestructionFor && gameState.noBattleDestructionFor[defenderOwner]) return false;
        const def = window.DuelEngine && DuelEngine.getDefinition(defenderCard.id);
        const flag = def && def.cannotBeDestroyedByBattle;
        if (typeof flag === 'function') { if (flag(attackerAtk)) return false; }
        else if (flag) return false;
        if (gameState.orgothIndestructibleUids && gameState.orgothIndestructibleUids.has(defenderCard.uid)) return false;
        return true;
    }

    /**
     * Vero se sacrificare mostri per un valore totale `sacrificedValue`
     * (somma degli ATK tributati, stesso calcolo già fatto da
     * chooseSummon in ai-medium.js/ai-hard.js) per evocare `card` è
     * DAVVERO una mossa sensata — non solo "non in perdita netta" (il
     * veto esistente, mantenuto come primo controllo), ma adattiva al
     * campo dell'avversario: richiesta esplicita dell'utente, es. non
     * sacrificare un mostro da 2500 ATK per evocarne uno da 2400 ATK/2600
     * DEF A MENO CHE l'avversario non abbia davvero un mostro che
     * giustifica quella DEF più alta (altrimenti si è solo indeboliti in
     * attacco per una difesa che non serve a nulla). Stessa euristica
     * "il mostro più forte scoperto in Attacco dell'avversario" già usata
     * da decideMonsterPosture qui sopra, per non duplicarne la logica in
     * modo incoerente.
     */
    function isTributeSummonWorthwhile(card, sacrificedValue, gameState, owner) {
        const previste = estimateSummonedStats(card, gameState, owner);
        // Slifer non è uno 0/0: il valore stampato è "?" e il motore lo
        // rappresenta con zero, mentre sul Terreno vale 1000 per ogni carta
        // rimasta in mano. In più il suo Second Mouth riduce di 2000 ATK i
        // mostri nemici appena Evocati. Senza questa stima l'IA rifiutava
        // SEMPRE i tre Tributi, rendendo la Divinità una carta morta.
        const valoreControllo = card.id === 31 && previste.atk > 0 ? 2000 : 0;
        const piccoStimato = Math.max(previste.atk, previste.def) + valoreControllo;
        // Mai in perdita netta pura, indipendentemente dal campo
        // avversario: se NESSUNA statistica del nuovo mostro supera il
        // valore sacrificato, è sempre uno spreco.
        if (piccoStimato <= sacrificedValue) return false;
        // Il nuovo ATK da solo già supera il valore sacrificato: è
        // un'evocazione offensivamente valida di per sé, nessun bisogno
        // di guardare la DEF né il campo avversario.
        if (previste.atk + valoreControllo >= sacrificedValue) return true;
        // Da qui in poi il nuovo ATK è PIÙ BASSO del valore sacrificato:
        // l'unica ragione per accettare comunque il tributo è che la DEF
        // più alta serva DAVVERO a sopravvivere a una minaccia reale —
        // un mostro avversario scoperto in Attacco il cui ATK batte il
        // nuovo ATK (lo distruggerebbe comunque restando in Attacco) ma
        // NON la sua DEF (ci si difende restando vivi). Campo avversario
        // vuoto o senza una simile minaccia -> nessun bisogno di questa
        // DEF, il tributo va rifiutato a favore di un candidato più
        // offensivo.
        const opponentField = Tavolo.mostri(Tavolo.avversario(owner), gameState);
        const strongestOpposingAtk = (opponentField || []).reduce((max, slot) => {
            if (!slot || slot.isFaceDown || slot.position !== 'attack') return max;
            return Math.max(max, effAtk(slot.card));
        }, 0);
        return strongestOpposingAtk > previste.atk && strongestOpposingAtk <= previste.def;
    }

    // Aggressività stimata (0 = molto trattenuta/imprevedibile, 1 = gioca
    // quasi sempre la mossa oggettivamente più forte) per un elenco
    // CORTO e curato a mano di personaggi iconici — deliberatamente NON
    // un tentativo di coprire tutti i 34+ personaggi di
    // js/data/character-decks.js: un personaggio assente da qui riceve
    // il valore neutro DEFAULT_AGGRESSION (vedi getBotAggression), quindi
    // aggiungerne di nuovi in futuro non richiede toccare questa lista —
    // un affinamento opzionale, non un requisito, coerente con la
    // richiesta esplicita dell'utente di variare lo stile "in base al bot
    // duellante" senza per questo dover creare mazzi/dati nuovi per
    // ognuno. Le chiavi sono gli stessi id di js/data/characters-db.js.
    const CHARACTER_AGGRESSION = {
        kaiba: 0.9,        // gioca quasi sempre la carta oggettivamente più forte disponibile
        bandit_keith: 0.85,
        marik: 0.8,
        pegasus: 0.75,     // calcolato e spietato, ma con qualche mossa "a effetto" invece della più ovvia
        rex: 0.7,
        weevil: 0.7,
        mai: 0.6,
        yugiMuto: 0.5,     // equilibrato per definizione
        yamiYugi: 0.5,
        joey: 0.45
    };
    const DEFAULT_AGGRESSION = 0.55;

    /**
     * "Restraint" (0 = nessuno, 1 = massimo) da applicare alla scelta tra
     * più Magie/Trappole candidate (vedi pickWeightedByImpact più sotto):
     * combina l'aggressività del personaggio attualmente in duello
     * (window.DuelSession.opponent.id, impostato da js/duel-session.js —
     * assente nel Duello Demo sandbox, dove ricade sul valore neutro) con
     * un bonus EXTRA nei primissimi turni (1-2), sommato e non
     * sostituito: anche un bot molto aggressivo (Kaiba) non svuota così
     * la mano più forte fin dal turno 1, ma converge verso il proprio
     * stile "vero" via via che la partita avanza — risposta diretta alla
     * richiesta esplicita dell'utente ("non tutte [le carte punitive]
     * subito").
     */
    function getSpellTrapRestraint(gameState, owner) {
        // L'identità appartiene al POSTO, non alla sessione globale. È
        // indispensabile nei duelli IA contro IA: prima entrambi i lati
        // ereditavano per errore la personalità dell'avversario scelto
        // dalla pagina. Un id assente (WW1, personaggio custom, sandbox)
        // continua a usare il comportamento neutro: nessun dato manuale
        // diventa obbligatorio per poter giocare.
        const perPosto = gameState && gameState.personaggioPerPosto;
        const id = (perPosto && owner && perPosto[owner]) || null;
        const aggression = (id && CHARACTER_AGGRESSION[id] !== undefined) ? CHARACTER_AGGRESSION[id] : DEFAULT_AGGRESSION;
        const turn = (gameState && gameState.turn) || 1;
        const earlyTurnBonus = turn <= 1 ? 0.4 : (turn === 2 ? 0.2 : 0);
        return Math.max(0, Math.min(1, (1 - aggression) + earlyTurnBonus));
    }

    /**
     * Sceglie UNA carta tra `candidates` (array con un campo `.card`) con
     * una lotteria pesata sul punteggio stimato di ciascuna
     * (scoreCardImpact), invece di prendere SEMPRE la più forte in
     * assoluto come faceva prima questo motore ovunque — richiesta
     * esplicita dell'utente: lo stesso mazzo/la stessa mano di partenza
     * produceva SEMPRE la stessa sequenza di attivazioni, un pattern
     * riconoscibile e ripetitivo. Il peso resta proporzionale al
     * punteggio (al quadrato, per pesare DAVVERO verso le carte forti),
     * quindi la carta più forte resta comunque la scelta più probabile,
     * solo non l'unica possibile. `restraint` (vedi getSpellTrapRestraint)
     * appiattisce i pesi verso l'uniforme: a restraint 0 il comportamento
     * converge quasi esattamente su "sempre la più forte" (il vecchio
     * comportamento), a restraint 1 ogni candidato ha pari probabilità.
     * Torna sempre uno dei candidati (mai null se la lista non è vuota):
     * non cambia QUANTE carte l'IA gioca per turno (i limiti MAX_ATTIVA/
     * MAX_SET e usedThisTurn restano invariati), solo QUALE tra quelle idonee.
     */
    function pickWeightedByImpact(candidates, restraint) {
        if (!candidates || candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];
        restraint = Math.max(0, Math.min(1, restraint || 0));
        const weights = candidates.map((c) => {
            const impact = Math.max(0.1, scoreCardImpact(c.card));
            return impact * impact * (1 - restraint) + restraint;
        });
        const total = weights.reduce((sum, w) => sum + w, 0);
        // Le decisioni IA fanno parte delle regole condivise: devono usare
        // lo stesso generatore seminabile del duello. Math.random rendeva
        // due audit con identici semi discordanti (Invincible Fortress
        // poteva vincere 5/50 oppure 0/50 contro Mako).
        let roll = Casuale.random() * total;
        for (let i = 0; i < candidates.length; i++) {
            roll -= weights[i];
            if (roll <= 0) return candidates[i];
        }
        return candidates[candidates.length - 1];
    }

    /**
     * Cosa cambia, per chi gioca, se `card` (una Magia Terreno) fosse scoperta ADESSO: { mio, loro } =
     * quanto guadagnano (o perdono) i propri mostri e quanto i mostri avversari (ATK + metà DEF effettivi).
     * Si prova davvero — la carta si mette un attimo nella zona, si ricalcolano i bonus continui, si
     * misura, si rimette tutto com'era e si ricalcola di nuovo — cosi' vale per qualunque Magia Terreno
     * (anche una nuova) senza leggerne il testo. Torna 0 se la carta non tocca le statistiche.
     */
    function guadagnoRelativoCampo(card, io) {
        if (!window.DuelEngine || typeof DuelEngine.recomputeStaticEffects !== 'function') return { mio: 0, loro: 0 };
        const chiave = Tavolo.chiave(io, 'FieldSpell');
        const precedente = gameState[chiave];
        const misura = () => {
            const somma = (owner) => Tavolo.mostri(owner, gameState).reduce((s, slot) => (slot && !slot.isFaceDown ? s + effAtk(slot.card) + 0.5 * effDef(slot.card) : s), 0);
            return { mio: somma(io), loro: somma(Tavolo.avversario(io)) };
        };
        try {
            const prima = misura();
            gameState[chiave] = { card: card, isFaceDown: false };
            DuelEngine.recomputeStaticEffects();
            const dopo = misura();
            return { mio: dopo.mio - prima.mio, loro: dopo.loro - prima.loro };
        } finally {
            gameState[chiave] = precedente;
            DuelEngine.recomputeStaticEffects();
        }
    }

    /**
     * L'UNICO controllo "ha senso attivarla?" che il bot fa per una Magia/Trappola, sia che la giochi
     * dalla mano o da Settata sia che risponda in Catena:
     *  1) il veto della carta stessa (`def.aiCanActivate(ctx)`, per le carte con un costo o una scelta che
     *     il bot non sa valutare: Metamorfosi, Cannone Virus, Duplice Attacco...);
     *  2) per una Magia Terreno, la prova qui sopra: se fa guadagnare piu' al nemico che a lui, no.
     * Prima ognuna di queste carte si attivava ad ogni occasione, perche' "le carte di risposta sono tutte
     * puro vantaggio": non e' vero (Kaiba che si sacrificava un mostro forte per una Fusione scarsa).
     */
    function attivazioneSensata(card, io, zona, indice, evento) {
        if (!card) return false;
        const def = window.DuelEngine && DuelEngine.getDefinition(card.id);
        if (def && typeof def.aiCanActivate === 'function') {
            const ctx = DuelEngine.makeContext(io, { card: card, zone: zona || 'hand', index: indice });
            // Una risposta a un evento (Evocazione, attacco...) puo' leggere i dati dell'evento: summonedCard,
            // attackerIndex, attackerAtk... (owner/opponent/card restano quelli di chi risponde).
            if (evento) Object.keys(evento).forEach((k) => { if (!(k in ctx)) ctx[k] = evento[k]; });
            try { if (!def.aiCanActivate(ctx)) return false; } catch (e) { return false; }
        }
        // Una Trappola che SOLO potenzia un proprio mostro (Rinforzi, Mura del Castello, Risucchio di Energia,
        // le Carte Equipaggiamento-Trappola...) ha senso in battaglia, non in risposta a una Magia qualunque:
        // fuori dalla Battle Phase il bot la sprecava (e spesso il mostro potenziato era proprio quello che
        // l'avversario stava per rubargli). Misurato con tools/audit-attivazioni-ia.js --reattive.
        if (card.type === 'trap' && gameState.phase !== 'battle') {
            const testo = card.effect || '';
            const dir = window.CardEffectsShared && CardEffectsShared.direzioneDellEffetto ? CardEffectsShared.direzioneDellEffetto(testo) : null;
            if (/equipaggia questa carta/i.test(testo) || (dir === 'alleato' && /bersaglio/i.test(testo))) return false;
        }
        // Costi in Life Point scritti nel testo ("Paga 2000 Life Points", "paga la metà dei tuoi Life Points"):
        // il bot non li paga se gli lasciano meno di 2000 LP (o, per la metà, se ne ha meno di 4000).
        const lp = Tavolo.lp(io, gameState);
        const costoLp = /Paga (\d+) Life Points?/i.exec(card.effect || '');
        if (costoLp && lp - Number(costoLp[1]) < 2000) return false;
        if (/paga la met[àa] dei tuoi Life Points/i.test(card.effect || '') && lp < 4000) return false;
        if (card.type === 'spell' && card.subtype === 'field') {
            const d = guadagnoRelativoCampo(card, io);
            // Non tocca le statistiche (Cancello di Fusione, Necrovalley...): non si puo' misurare, si lascia passare.
            // Le tocca: serve che ne guadagni piu' lui del nemico (a pari merito regalerebbe lo stesso al nemico).
            if ((d.mio !== 0 || d.loro !== 0) && d.mio - d.loro <= 0) return false;
        }
        return true;
    }

    window.AI_SHARED = {
        attivazioneSensata: attivazioneSensata,
        guadagnoRelativoCampo: guadagnoRelativoCampo,
        effAtk: effAtk,
        effDef: effDef,
        statRilevante: statRilevante,
        scoreCardImpact: scoreCardImpact,
        decideMonsterPosture: decideMonsterPosture,
        choosePositionChanges: choosePositionChanges,
        canNormalSummonNow: canNormalSummonNow,
        isSingleTargetRemoval: isSingleTargetRemoval,
        isRemovalWorthwhile: isRemovalWorthwhile,
        hasOwnSideCost: hasOwnSideCost,
        isMassDestructionWorthwhile: isMassDestructionWorthwhile,
        shouldHoldForExodia: shouldHoldForExodia,
        canBeDestroyedByBattle: canBeDestroyedByBattle,
        estimateSummonedStats: estimateSummonedStats,
        shouldPayRaLp: shouldPayRaLp,
        raLpDaPagare: raLpDaPagare,
        raLpDecisione: raLpDecisione,
        isTributeSummonWorthwhile: isTributeSummonWorthwhile,
        getSpellTrapRestraint: getSpellTrapRestraint,
        pickWeightedByImpact: pickWeightedByImpact
    };
})();
