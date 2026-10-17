/**
 * ai-medium.js — Livello di difficoltà "Media": è l'euristica ORIGINALE
 * del bot (quella che questo gioco ha sempre avuto prima dell'IA
 * multilivello), spostata qui parola per parola — nessuna riscrittura —
 * così resta il comportamento di DEFAULT, identico a prima per chi non
 * sceglie esplicitamente Facile/Difficile. Vedi js/ai/ai-controller.js
 * per come si sceglie il livello, e js/ai/bot.js per chi esegue davvero la
 * decisione (animazioni, timer, stato).
 */
(function () {
    'use strict';

    /**
     * Sceglie il miglior mostro evocabile dalla mano del bot, rispettando la
     * regola dei Tributi: preferisce il mostro con l'ATK più alto tra quelli
     * che il bot può effettivamente Evocare in questo momento. Ritorna
     * { card, tributeIndices, emptySlotHint, position, faceDown } o null se
     * non può evocare nulla ora. Postura (Attacco/Difesa coperta/Difesa
     * scoperta): AI_SHARED.decideMonsterPosture (js/ai/ai-shared.js) — un
     * piccolo passo di intelligenza posizionale anche per questo livello,
     * non solo per Difficile.
     *
     * Per un'Evocazione Tributo, sacrifica i mostri più DEBOLI del campo
     * (non i primi che capitano), e SALTA del tutto il candidato se il
     * risultato sarebbe una mossa in perdita netta — es. sacrificare due
     * mostri da 2500 ATK per evocarne uno da 2500 ATK non è mai
     * accettabile, anche se è l'unico Tributo disponibile in mano: meglio
     * non evocare nulla questo turno che indebolirsi da soli.
     */
    function chooseSummon(gameState, io = 'bot', options) {
        options = options || {};
        const scoreMonster = typeof options.scoreMonster === 'function'
            ? options.scoreMonster
            : (card) => card.attack || 0;
        const candidates = [...Tavolo.mano(io, gameState)]
            .filter((card) => card.type === 'monster'
                && (typeof canUseNormalSummonQuota !== 'function' || canUseNormalSummonQuota(io, card))
                && (!window.AI_SHARED || AI_SHARED.canNormalSummonNow(card, gameState, io))
                && !(window.AI_SHARED && AI_SHARED.shouldHoldForExodia(card))
                && (typeof options.allowCandidate !== 'function' || options.allowCandidate(card)))
            .sort((a, b) => scoreMonster(b) - scoreMonster(a));

        for (const card of candidates) {
            const tributesNeeded = getTributesRequired(card);
            const posture = typeof options.decidePosture === 'function'
                ? options.decidePosture(card)
                : (window.AI_SHARED && AI_SHARED.decideMonsterPosture(card, gameState, io)) || { position: 'attack', faceDown: false };
            // Ra - Modalità Sfera usa una procedura propria: tre Tributi
            // tutti sullo stesso Terreno e comparsa su quel lato. Se il
            // campo avversario offre tre mostri, è la scelta tattica
            // preferita; in mancanza può usare il proprio campo.
            if (card.id === 1275) {
                const opponent = Tavolo.avversario(io);
                const enemyCount = Tavolo.mostri(opponent, gameState).filter(Boolean).length;
                const ownCount = Tavolo.mostri(io, gameState).filter(Boolean).length;
                if (enemyCount >= 3 || ownCount >= 3) {
                    return { card, tributeIndices: [], emptySlotHint: -1, position: 'attack', faceDown: false, customNormalSummon: true };
                }
                continue;
            }
            if (tributesNeeded === 0) {
                const emptySlot = Tavolo.mostri(io, gameState).findIndex((slot) => slot === null);
                if (emptySlot !== -1) return { card: card, tributeIndices: [], emptySlotHint: emptySlot, position: posture.position, faceDown: posture.faceDown };
            } else {
                // Simorgh (id 772): tutti i Sacrifici devono essere mostri
                // VENTO — stesso vincolo applicato lato giocatore in
                // actions.js (handleTributeSelectClick).
                let ownIndices = Tavolo.mostri(io, gameState)
                    .map((slot, idx) => (slot ? idx : null))
                    .filter((idx) => idx !== null);
                if (card.id === 772) {
                    ownIndices = ownIndices.filter((idx) => Tavolo.mostri(io, gameState)[idx].card.attribute === 'VENTO');
                }
                if (ownIndices.length < tributesNeeded) continue;
                // ATK EFFETTIVO (bonus/malus inclusi), non quello stampato: il
                // valore che si butta davvero è quello che il mostro ha ora.
                const atkEff = (idx) => AI_SHARED.effAtk(Tavolo.mostri(io, gameState)[idx].card);
                const tributeIndices = [...ownIndices]
                    .sort((a, b) => atkEff(a) - atkEff(b))
                    .slice(0, tributesNeeded);
                const sacrificedValue = tributeIndices.reduce((sum, idx) => sum + atkEff(idx), 0);
                // AI_SHARED.isTributeSummonWorthwhile: non solo "non in
                // perdita netta" (il vecchio veto, ancora il primo
                // controllo al suo interno), ma adattivo al campo
                // avversario — non passare a un mostro con ATK più basso
                // ma DEF più alta a meno che l'avversario non abbia
                // davvero un mostro che lo giustifichi (richiesta
                // esplicita dell'utente).
                const tributeOk = typeof options.isTributeSummonWorthwhile === 'function'
                    ? options.isTributeSummonWorthwhile(card, sacrificedValue, tributeIndices)
                    : window.AI_SHARED
                        ? AI_SHARED.isTributeSummonWorthwhile(card, sacrificedValue, gameState, io)
                        : Math.max(card.attack, card.defense) > sacrificedValue;
                if (!tributeOk) continue;
                return { card: card, tributeIndices: tributeIndices, emptySlotHint: -1, position: posture.position, faceDown: posture.faceDown };
            }
        }
        return null;
    }

    /**
     * Sceglie contro quale mostro del giocatore conviene attaccare, invece di
     * puntare sempre e comunque al primo che capita:
     *   - un mostro SCOPERTO ha le statistiche note, quindi si attacca
     *     solo se conviene DAVVERO (ATK maggiore dell'ATK avversario se è in
     *     Posizione di Attacco, o della DEF se è in Posizione di Difesa);
     *   - un mostro COPERTO resta un azzardo lecito (statistiche ignote);
     *   - campo avversario vuoto -> sempre attacco diretto (-1);
     *   - nessun bersaglio conveniente -> null (trattiene il mostro).
     */
    function chooseAttackTarget(attackerSlot, playerMonsters, io = 'bot') {
        if (playerMonsters.length === 0) {
            // "Non può attaccare direttamente" (es. Zombyra l'Oscuro, id
            // 625): niente bersaglio-mostro disponibile E l'attacco
            // diretto è comunque vietato per questa carta -> trattiene.
            const attackerDef = window.DuelEngine && DuelEngine.getDefinition(attackerSlot.card.id);
            if (attackerDef && attackerDef.cannotAttackDirectly) return null;
            return -1;
        }

        // ATK e DEF EFFETTIVI di entrambi i lati (Terreno, Equipaggiamenti,
        // effetti a tempo): è con questi che il motore risolve la battaglia.
        // Coi valori stampati il bot attaccava in perdita contro un mostro
        // potenziato, o lasciava passare un attacco vincente su uno indebolito.
        const attackerAtk = AI_SHARED.effAtk(attackerSlot.card);
        const faceDownTargets = playerMonsters.filter((m) => m.slot.isFaceDown);
        const favorableFaceUp = playerMonsters
            .filter((m) => !m.slot.isFaceDown)
            .filter((m) => attackerAtk > AI_SHARED.statRilevante(m.slot))
            // Un mostro che comunque non verrebbe distrutto (es.
            // cannotBeDestroyedByBattle) non è mai un bersaglio
            // "conveniente" solo perché la statistica nominale è
            // favorevole — richiesta esplicita dell'utente: non insistere
            // a puntare un mostro che non si può distruggere, valutare
            // altre strategie (altro bersaglio più sotto, attacco
            // diretto, o trattenere l'attaccante).
            .filter((m) => !window.AI_SHARED || AI_SHARED.canBeDestroyedByBattle(m.slot.card, Tavolo.avversario(io), attackerAtk));

        if (favorableFaceUp.length > 0) {
            favorableFaceUp.sort((a, b) => {
                return AI_SHARED.statRilevante(b.slot) - AI_SHARED.statRilevante(a.slot);
            });
            return favorableFaceUp[0].index;
        }

        if (faceDownTargets.length > 0) return faceDownTargets[0].index;
        // Permesso di attaccare direttamente anche con mostri avversari in
        // campo (es. Sparatore Sonico id 773, Folletto della Fiamma
        // Furente id 681) — usato solo come ultima risorsa, quando nessun
        // bersaglio-mostro sembrava già vantaggioso qui sopra, per non
        // alterare l'euristica esistente quando un buon bersaglio c'è.
        if (gameState.directAttackAllowedUids && gameState.directAttackAllowedUids[attackerSlot.card.uid]) return -1;
        return null;
    }

    /**
     * Decisione nella finestra di priorità della Chain (vedi
     * openTriggerWindow/openActivationWindow in js/engine/duel-engine.js): le
     * carte di risposta di questo gioco sono tutte "puro vantaggio se
     * attivate", quindi risponde sempre con la prima candidata disponibile
     * — stessa euristica che il motore usava prima dell'IA multilivello.
     * UNICA eccezione (richiesta esplicita dell'utente, risposta più
     * selettiva): se OGNI candidata è una rimozione a bersaglio singolo e
     * NESSUNA varrebbe la pena secondo REMOVAL_WORTH_THRESHOLD qui sotto
     * (stessa soglia già usata per non sprecarla in Main Phase), passa
     * senza rispondere — se anche una sola candidata non è pura
     * rimozione, risponde comunque con la prima come sempre.
     */
    function chooseChainResponse(candidates, io = 'bot') {
        if (candidates.length === 0) return null;
        if (window.AI_SHARED) {
            const allPureRemoval = candidates.every((c) => AI_SHARED.isSingleTargetRemoval(c.card));
            if (allPureRemoval && !candidates.some((c) => AI_SHARED.isRemovalWorthwhile(c.card, gameState, io, REMOVAL_WORTH_THRESHOLD))) {
                return null;
            }
        }
        return candidates[0];
    }

    // Soglia FISSA (a differenza di IA_DIFFICILE, che la scala in base
    // all'andamento della partita, vedi ai-hard.js): IA_MEDIA non calcola
    // un punteggio campo, resta un'euristica semplice — trattiene una
    // rimozione a bersaglio singolo (vedi AI_SHARED.isRemovalWorthwhile)
    // finché l'avversario non ha almeno un mostro scoperto "che conta
    // davvero" (o uno coperto, rischio accettato), invece di sprecarla sul
    // primo vanilla debole — il difetto segnalato dall'utente.
    const REMOVAL_WORTH_THRESHOLD = 1500;

    /**
     * Decide la PROSSIMA azione da fare con una Magia/Trappola in mano
     * durante la propria Main Phase (js/ai/bot.js la richiama ripetutamente,
     * una carta alla volta, finché ritorna null) — { handIndex, action }
     * con action 'activate' (Magia, subito) o 'set' (Trappola o Magia,
     * coperta sul Terreno). A differenza di IA_DIFFICILE, questo livello
     * resta "modesto": al massimo 1 Trappola Settata e 1 Magia attivata
     * per turno (usedSetThisCall/usedActivateThisCall in gameState,
     * azzerati ad ogni Main Phase — vedi bot.js), e non attiva mai da solo
     * le proprie carte già Set (resta puramente reattivo a quelle, come
     * sempre) — è proprio questa differenza di "quanto usa il proprio
     * retrocampo" a rendere Difficile percepibilmente più aggressivo.
     */
    function chooseNextSpellTrapAction(gameState, usedThisTurn, io = 'bot', options) {
        options = options || {};
        const hand = Tavolo.mano(io, gameState);
        const emptySlot = Tavolo.magieTrappole(io, gameState).some((s) => s === null);
        const personaggio = gameState.personaggioPerPosto && gameState.personaggioPerPosto[io];
        const livello = gameState.livelloIA && gameState.livelloIA[io]
            ? gameState.livelloIA[io] : gameState.botDifficulty;
        // Il retrocampo è il vero piano di Odion, non un supporto generico:
        // Facile conserva il limite didattico di un Set, Medio ne prepara
        // due e Difficile tre. Per ogni altro personaggio resta uno.
        const maxSet = personaggio === 'odion' ? (livello === 'hard' ? 3 : livello === 'easy' ? 1 : 2) : 1;
        const setCount = usedThisTurn.setCount || (usedThisTurn.setDone ? 1 : 0);
        const worthwhile = (card) => {
            if (!window.AI_SHARED) return true;
            const definition = window.DuelEngine && DuelEngine.getDefinition(card.id);
            if (definition && typeof definition.aiCanActivate === 'function') {
                const context = DuelEngine.makeContext(io, { card, zone: 'hand' });
                if (!definition.aiCanActivate(context)) return false;
            }
            // Una carta-combo che Evoca Specialmente dalla mano (es.
            // Dimensione Magica) non è prima di tutto una rimozione. Il
            // suo "poi puoi distruggere" è facoltativo: classificarla solo
            // dalle parole distruggi/mostro la faceva trattenere quando il
            // campo nemico era vuoto, perdendo l'intera linea di Evocazione.
            // Il riconoscimento semantico vale anche per future carte custom
            // con la stessa struttura, senza una lista di id mantenuta a mano.
            const isHandSpecialSummonPlan = /Special Summon.*dalla (?:tua )?mano/i.test(card.effect || '');
            return isHandSpecialSummonPlan || (
                AI_SHARED.isRemovalWorthwhile(card, gameState, io, REMOVAL_WORTH_THRESHOLD)
                && AI_SHARED.isMassDestructionWorthwhile(card, gameState, io)
            );
        };

        // Restraint (vedi AI_SHARED.getSpellTrapRestraint): quanto la
        // scelta tra più candidate resta "trattenuta"/imprevedibile
        // invece di prendere SEMPRE la più forte in assoluto — combina
        // l'aggressività del personaggio in duello con un bonus extra nei
        // primissimi turni, così l'IA non svuota subito le carte più
        // punitive/aggressive fin dal turno 1 (richiesta esplicita
        // dell'utente: "non tutte subito", "meno punitivo specialmente
        // per IA Normale" — qui applicata con un restraint di base più
        // alto, vedi pickWeighted qui sotto).
        const restraintBonus = options.restraintBonus === undefined ? 0.15 : options.restraintBonus;
        const restraint = Math.min(1, (window.AI_SHARED ? AI_SHARED.getSpellTrapRestraint(gameState, io) : 0) + restraintBonus);
        const pickWeighted = (list) => (window.AI_SHARED ? AI_SHARED.pickWeightedByImpact(list, restraint) : list[0]);

        if (!usedThisTurn.activateDone) {
            // Tra tutte le Magie attivabili, una scelta pesata sull'impatto
            // stimato (non più sempre la stessa carta più forte — vedi
            // pickWeightedByImpact), scartando quelle di rimozione che
            // sprecherebbero l'effetto su un bersaglio ancora debole.
            const spells = hand
                .map((card, handIndex) => ({ card, handIndex }))
                .filter((e) => e.card.type === 'spell' && window.DuelEngine && DuelEngine.canActivate(io, 'hand', e.handIndex) && worthwhile(e.card));
            const chosen = pickWeighted(spells);
            if (chosen) {
                usedThisTurn.activateDone = true;
                return { handIndex: chosen.handIndex, card: chosen.card, action: 'activate' };
            }
        }
        if (setCount < maxSet && emptySlot) {
            // Stesso principio per la Trappola da Settare (una Trappola Set
            // non ha ancora un bersaglio scelto, quindi qui non serve il
            // controllo "worthwhile").
            const traps = hand
                .map((card, handIndex) => ({ card, handIndex }))
                .filter((e) => e.card.type === 'trap');
            const chosen = pickWeighted(traps);
            if (chosen) {
                usedThisTurn.setDone = true;
                usedThisTurn.setCount = setCount + 1;
                return { handIndex: chosen.handIndex, card: chosen.card, action: 'set' };
            }
        }
        return null;
    }

    /**
     * Vero se conviene attivare ORA una propria carta già Set o un effetto
     * Ignition identitario durante la Main Phase. IA_MEDIA resta reattiva
     * sul retrocampo; fanno eccezione soltanto i boss il cui piano sarebbe
     * altrimenti morto (Abbandonato/Mille Occhi e Cannoni Drago).
     */
    function chooseSetCardActivation(gameState, io = 'bot') {
        // Abbandonato e Restrizione dai Mille Occhi sono il secondo piano
        // identitario di Pegasus, non un Ignition generico facoltativo: se
        // il boss è riuscito ad arrivare in campo deve almeno usare il suo
        // assorbimento. Facile condivide volutamente questa IA; la vera
        // differenza fra Facile/Media resta nella lista del personaggio.
        const campo = Tavolo.mostri(io, gameState);
        for (let index = 0; index < campo.length; index++) {
            const slot = campo[index];
            if (!slot || slot.isFaceDown || (slot.card.id !== 416 && slot.card.id !== 476)) continue;
            if (window.DuelEngine && DuelEngine.canActivate(io, 'monster', index)) {
                return { zone: 'monster', index, card: slot.card };
            }
        }
        // Mage Soldier deve saper convertire i Segnalini Magia in vero
        // controllo del campo. Non attiviamo genericamente ogni Ignition:
        // Distruttore ha gia' canActivate vincolato a un retrocampo nemico,
        // mentre per Mago dell'Esplosione imponiamo qui un bersaglio NEMICO
        // alla portata, evitando che la scelta di ripiego distrugga un
        // proprio mostro quando sul lato avversario non c'e' nulla.
        for (let index = 0; index < campo.length; index++) {
            const slot = campo[index];
            if (!slot || slot.isFaceDown || (slot.card.id !== 131 && slot.card.id !== 742)) continue;
            if (slot.card.id === 742) {
                const portata = (slot.card.counters || 0) * 700;
                const bersaglioNemico = Tavolo.mostri(Tavolo.avversario(io), gameState).some((nemico) => nemico
                    && !nemico.isFaceDown && DuelEngine.getEffectiveAtk(nemico.card) <= portata);
                if (!bersaglioNemico) continue;
            }
            if (window.DuelEngine && DuelEngine.canActivate(io, 'monster', index)) {
                return { zone: 'monster', index, card: slot.card };
            }
        }
        // I Cannoni Drago di Kaiba e future carte equivalenti convertono
        // uno scarto in una rimozione. Lasciarli scoperti senza usare
        // l'Ignition renderebbe inutile la combinazione appena compiuta.
        // Il filtro sul testo evita una lista rigida di id.
        for (let index = 0; index < campo.length; index++) {
            const slot = campo[index];
            if (!slot || slot.isFaceDown) continue;
            if (!/scart(?:a|are) 1 carta.*distrugg/i.test(slot.card.effect || '')) continue;
            if (window.DuelEngine && DuelEngine.canActivate(io, 'monster', index)) {
                return { zone: 'monster', index, card: slot.card };
            }
        }
        return null;
    }

    /**
     * Sceglie una combinazione dall'Extra Deck senza Polimerizzazione
     * soltanto quando il risultato non perde valore: oppure è almeno forte
     * quanto i materiali, oppure il suo effetto scarto+rimozione può già
     * compensare la concentrazione di due corpi in uno.
     */
    function chooseBanishFusion(gameState, io = 'bot') {
        if (!window.DuelEngine) return null;
        const candidates = DuelEngine.getBanishFusableExtraDeckMonsters(io);
        const ownField = Tavolo.mostri(io, gameState);
        const enemyCards = (Tavolo.mostri(Tavolo.avversario(io), gameState) || []).filter(Boolean)
            .concat((Tavolo.magieTrappole(Tavolo.avversario(io), gameState) || []).filter(Boolean));
        const handHasDiscard = (Tavolo.mano(io, gameState) || []).length > 0;
        return candidates
            .map((candidate) => {
                const materialPower = candidate.materialFieldIndices.reduce((sum, index) => {
                    const slot = ownField[index];
                    return sum + (slot ? AI_SHARED.effAtk(slot.card) : 0);
                }, 0);
                const resultPower = candidate.card.attack || 0;
                const removalReady = handHasDiscard && enemyCards.length > 0
                    && /scart(?:a|are) 1 carta.*distrugg/i.test(candidate.card.effect || '');
                return { ...candidate, score: resultPower + (removalReady ? 2000 : 0), materialPower };
            })
            .filter((candidate) => candidate.score >= candidate.materialPower)
            .sort((a, b) => b.score - a.score)[0] || null;
    }

    /** Media gestisce i cambi di Posizione usando solo informazioni visibili. */
    function choosePositionChanges(gameState, io = 'bot') {
        return window.AI_SHARED ? AI_SHARED.choosePositionChanges(gameState, io, false) : [];
    }

    window.AI_MEDIUM = {
        chooseSummon: chooseSummon,
        chooseAttackTarget: chooseAttackTarget,
        chooseChainResponse: chooseChainResponse,
        chooseNextSpellTrapAction: chooseNextSpellTrapAction,
        chooseSetCardActivation: chooseSetCardActivation,
        chooseBanishFusion: chooseBanishFusion,
        choosePositionChanges: choosePositionChanges
    };
})();
