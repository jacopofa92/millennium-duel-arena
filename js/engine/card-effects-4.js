/**
 * card-effects-4.js — Effetti delle carte, parte 4 di 8.
 * =====================================================================
 * Solo blocchi CardEffects.register(...): nessuna logica condivisa vive
 * qui. Gli helper usati da più gruppi di carte stanno tutti in
 * js/engine/card-effects.js (window.CardEffectsShared), che va caricato
 * PRIMA di questo file — insieme a js/engine/duel-engine.js, che è chi
 * definisce CardEffects.register stesso.
 *
 * Il taglio fra le parti è puramente meccanico (righe, non temi): le
 * carte restano nell'ordine in cui sono sempre state. Per trovarne una
 * cerca `register(<id>` in tutta la cartella js/engine/, non a occhio.
 */
(function () {
    'use strict';

    const { chooseFieldTargetsInSequence, chooseOption, chooseFieldCardTargetWaiting, attendiScelta, findEquipTarget, equipToChosenTarget, riprendiDalCimitero, attachEquip, equippedTarget, searchDeckWithChoice, searchGraveyardWithChoice, chooseFieldCardTarget, chooseFieldMonsterTarget, collectFieldTargets, offerHandDiscardChoice, resolveSpecialSummonTributeCost, chooseCardFromList, maxRitualTributeLevel, performRitualTribute } = window.CardEffectsShared;

    // ================================================================
    // BATCH 7: rientro in campo dopo una distruzione (onOwnMonsterDestroyed,
    // batch 5) e rimescolamento nel Deck (ACTIONS.shuffleIntoDeck, nuovo
    // in duel-engine.js — stessa limitazione di ACTIONS.searchDeckToHand:
    // non fa nulla nel Duello Demo, che non ha un vero Deck).
    // ================================================================

    // 478 — Macchina del Tempo: quando un mostro viene distrutto e mandato
    // al tuo Cimitero, Special Summonalo di nuovo (onOwnMonsterDestroyed).
    // SEMPLIFICAZIONE: reagisce a QUALUNQUE distruzione del proprio
    // mostro, non solo "in battaglia" come da testo reale (il motore non
    // distingue la causa dentro ON_DESTROY) — e lo fa rientrare sempre in
    // Posizione di Attacco, non nella Posizione che aveva quando è stato
    // distrutto (persa insieme allo slot, non più recuperabile qui).
    CardEffects.register(478, {
        onOwnMonsterDestroyed(ctx) {
            const revived = ctx.destroyedCard;
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const graveyard = ctx.graveyard(ctx.owner);
            const idx = graveyard.indexOf(revived);
            if (idx !== -1) graveyard.splice(idx, 1);
            ctx.specialSummon(ctx.owner, revived, slotIndex, 'attack', 'graveyard');
            ctx.log(`⏰ Macchina del Tempo fa rientrare in campo ${revived.name}!`);
        }
    });

    // 479 — Sigillo del Tempo: salta la Draw Phase del prossimo turno
    // dell'avversario. Stesso meccanismo (contatore, non booleano) già
    // usato da Avidità Sconsiderata (id 653) — vedi
    // gameState.skipDrawFor in enterDrawPhase() (js/engine/game-flow.js) —
    // solo puntato sull'AVVERSARIO invece che su chi la attiva.
    CardEffects.register(479, {
        activate(ctx) {
            gameState.skipDrawFor = gameState.skipDrawFor || {};
            gameState.skipDrawFor[ctx.opponent] = (gameState.skipDrawFor[ctx.opponent] || 0) + 1;
            ctx.log(`⏳ Sigillo del Tempo: ${ctx.opponent === 'player' ? 'salterai' : 'il bot salterà'} la prossima Draw Phase!`);
        }
    });

    // 480 — Divoratempo / Time Eater: se questa carta distrugge in
    // battaglia un mostro dell'avversario, l'avversario salta la sua
    // prossima Main Phase 1. Usa il nuovo hook generico
    // def.onDestroysMonsterInBattle (applyBattleDestroyBonus, actions.js)
    // + gameState.skipMainPhase1For (enterMainPhase1, game-flow.js) —
    // stesso spirito granulare per-fase di skipDrawFor qui sopra, ma
    // booleano (il testo reale copre una sola volta) e sulla Main Phase 1
    // invece della Draw Phase.
    CardEffects.register(480, {
        onDestroysMonsterInBattle(ctx) {
            gameState.skipMainPhase1For = gameState.skipMainPhase1For || {};
            gameState.skipMainPhase1For[ctx.opponent] = true;
            ctx.log(`⏳ ${ctx.card.name}: ${ctx.opponent === 'player' ? 'salterai' : 'il bot salterà'} la prossima Main Phase 1!`);
        }
    });

    // 384 — Recupero dei Mostri: rimescola 1 proprio mostro sul Terreno
    // più l'intera mano nel Deck, poi pesca altrettante carte
    // (ACTIONS.shuffleIntoDeck).
    CardEffects.register(384, {
        // Rimescola un proprio mostro e tutta la mano nel Deck: il bot non sa valutare "ho una mano da
        // buttare", e l'attivava con una mano buona perdendo il mostro.
        aiCanActivate() { return false; },
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s);
        },
        activate(ctx) {
            // Quale proprio mostro rimescolare lo sceglie il giocatore:
            // finisce nel Deck insieme a tutta la mano, quindi con più
            // mostri in campo non è una scelta da fare al posto suo.
            const candidati = [];
            ctx.field(ctx.owner).forEach((slot, index) => {
                if (slot) candidati.push({ owner: ctx.owner, index, card: slot.card });
            });
            chooseFieldMonsterTarget(ctx, candidati, {
                title: '🔀 Recupera-Mostri',
                dichiara: true,
                text: 'Scegli quale tuo mostro rimescolare nel Deck insieme alla tua mano.'
            }, (scelta) => {
                // Il bersaglio può essere stato ridiretto: l'effetto vale
                // solo per un mostro che controlli.
                if (scelta.owner !== ctx.owner) return;
                attivaRecuperoDeiMostri(ctx, scelta.index);
            });
        }
    });

    /** Corpo di Recupero dei Mostri (id 384), a mostro già scelto. */
    function attivaRecuperoDeiMostri(ctx, index) {
        {
            const slot = ctx.field(ctx.owner)[index];
            if (!slot) return;
            const monster = slot.card;
            const hand = ctx.hand(ctx.owner);
            const toShuffle = [monster, ...hand.splice(0, hand.length)];
            if (!ctx.shuffleIntoDeck(ctx.owner, toShuffle)) {
                // Nessun Deck reale (Duello Demo): annulla, restituendo la
                // mano e il mostro esattamente come prima, invece di far
                // sparire le carte nel nulla.
                hand.push(...toShuffle.slice(1));
                return;
            }
            ctx.field(ctx.owner)[index] = null;
            ctx.drawCards(ctx.owner, toShuffle.length);
            ctx.log(`🔀 Recupera-Mostri rimescola ${toShuffle.length} carte nel Deck e ne pesca altrettante!`);
        }
    }

    // ================================================================
    // 324 — Kazejin (risposta quando attaccata, Effetto Veloce, una tantum)
    // Durante il calcolo dei danni, se questa carta viene attaccata: puoi
    // rendere 0 l'ATK del mostro attaccante SOLO per questo scontro —
    // stesso meccanismo di Suijin (id 71), ma utilizzabile una SOLA volta
    // finché Kazejin resta scoperta in campo (non una volta a turno): il
    // flag vive sullo SLOT (si azzera da solo se Kazejin lascia il campo e
    // torna, essendo un nuovo slot), controllato da canActivate come ogni
    // altra carta che risponde a un attacco — vedi findTriggerCandidates
    // in duel-engine.js, che chiama canActivate con lo stesso ctx.index.
    // ================================================================
    CardEffects.register(324, {
        canActivate(ctx) {
            const slot = ctx.field(ctx.owner)[ctx.index];
            return !!slot && !slot.kazejinUsed;
        },
        onAttackDeclare(ctx) {
            ctx.zeroAttackerAtk();
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (slot) slot.kazejinUsed = true;
            ctx.log("💨 Kazejin azzera l'ATK del mostro attaccante per questo scontro (effetto usabile una sola volta finché scoperta)!");
        }
    });

    // ================================================================
    // 269 — Forza d'Attacco Goblin / Goblin Attack Force
    // Se questa carta attacca: viene cambiata in Posizione di Difesa alla
    // fine della Battle Phase, e la sua Posizione non può essere cambiata
    // fino alla End Phase del turno successivo del proprietario.
    // Nessun handler dichiarativo qui: il cambio Posizione forzato va
    // applicato DOPO che la battaglia si è risolta (vinta, persa o
    // pareggiata) e solo se questa carta è sopravvissuta — troppo tardi
    // per onAttackDeclare. Vedi il controllo esplicito su
    // def.forcesDefenseAfterAttack in resolveAttack (actions.js), incluso
    // il commento lì sulla SEMPLIFICAZIONE del momento esatto di sblocco.
    // ================================================================
    CardEffects.register(269, {
        forcesDefenseAfterAttack: true
    });

    // ================================================================
    // 503 — Waboku (Trappola Normale)
    // Non subisci danno da battaglia dai mostri dell'avversario in questo
    // turno. I tuoi mostri non possono essere distrutti in battaglia in
    // questo turno. Vedi gameState.noBattleDamageFor/noBattleDestructionFor
    // (per-giocatore, resettati in changeTurn() — game-flow.js — e
    // controllati in applyDamage/resolveBattleDamage — actions.js).
    // ================================================================
    CardEffects.register(503, {
        activate(ctx) {
            gameState.noBattleDamageFor = gameState.noBattleDamageFor || {};
            gameState.noBattleDestructionFor = gameState.noBattleDestructionFor || {};
            gameState.wabokuProtectionUidFor = gameState.wabokuProtectionUidFor || {};
            gameState.noBattleDamageFor[ctx.owner] = true;
            gameState.noBattleDestructionFor[ctx.owner] = true;
            // Tiene legato il visuale alla copia che ha generato la
            // protezione. Waboku e' una Trappola Normale e dopo la normale
            // risoluzione va al Cimitero senza essere "distrutta": quello
            // NON spegne l'effetto. onSTDestroyed qui sotto interviene
            // soltanto nel vero percorso di distruzione del motore.
            gameState.wabokuProtectionUidFor[ctx.owner] = ctx.card && ctx.card.uid;
            ctx.log(`🙏 Waboku protegge ${ctx.owner === 'player' ? 'i tuoi mostri' : 'i mostri del bot'} da danno e distruzione da battaglia per il resto del turno!`);
        },
        onSTDestroyed(ctx) {
            if (!gameState.wabokuProtectionUidFor
                || gameState.wabokuProtectionUidFor[ctx.owner] !== (ctx.card && ctx.card.uid)) return;
            if (gameState.noBattleDamageFor) gameState.noBattleDamageFor[ctx.owner] = false;
            if (gameState.noBattleDestructionFor) gameState.noBattleDestructionFor[ctx.owner] = false;
            delete gameState.wabokuProtectionUidFor[ctx.owner];
            ctx.log('🛡️ Lo scudo di Waboku si dissolve insieme alla carta!');
        }
    });

    // ================================================================
    // 173 — Barattolo Cyber / Cyber Jar (effetto FLIP)
    // Distruggi tutti i mostri sul Terreno (compreso Barattolo Cyber
    // stesso). Poi entrambi i giocatori rivelano le prime 5 carte del
    // proprio Deck: i mostri di Livello 4 o inferiore possono essere
    // Special Summonati, le altre carte vanno in mano.
    // SEMPLIFICAZIONE: le Special Summon dal reveal sono sempre scoperte
    // in Attacco (nessuna UI per una scelta multipla Attacco/Difesa così
    // rapida su più carte insieme). Funziona solo con un vero Deck
    // salvato (non il pool casuale del Duello Demo, come searchDeckToHand/
    // shuffleIntoDeck in duel-engine.js). Nota: se questo FLIP parte da un
    // attacco (mostro coperto in Difesa attaccato e sopravvissuto — solo
    // allora scatta ON_FLIP, vedi resolveBattleDamage in actions.js), la
    // distruzione dell'attaccante/di Barattolo Cyber qui dentro può far
    // scattare una seconda volta l'animazione di esplosione già innescata
    // da ctx.destroyMonster per quegli stessi due slot (duplicato solo
    // visivo/sonoro, nessun impatto sullo stato di gioco).
    // ================================================================
    CardEffects.register(173, {
        onFlip(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => {
                    if (slot) ctx.destroyMonster(owner, index);
                });
            });
            ctx.log('🫙 Cyber Giara si rivela e distrugge tutti i mostri sul Terreno!');
            Tavolo.ordine().forEach((owner) => {
                const deck = Tavolo.mazzo(owner);
                if (!Array.isArray(deck) || deck.length === 0) {
                    ctx.log(`🫙 ${owner === 'player' ? 'Non hai' : 'Il bot non ha'} un Deck reale da cui rivelare carte in questa modalità.`);
                    return;
                }
                const revealed = deck.splice(0, Math.min(5, deck.length));
                const monsters = revealed.filter((c) => c.type === 'monster' && (c.level || 0) <= 4);
                const others = revealed.filter((c) => !monsters.includes(c));
                monsters.forEach((card) => {
                    const slotIndex = ctx.findEmptyMonsterSlot(owner);
                    if (slotIndex === -1) { ctx.hand(owner).push(card); return; }
                    ctx.specialSummon(owner, card, slotIndex, 'attack', 'hand');
                });
                others.forEach((card) => ctx.hand(owner).push(card));
                ctx.log(`🫙 ${owner === 'player' ? 'Riveli' : 'Il bot rivela'} ${revealed.length} cart${revealed.length === 1 ? 'a' : 'e'} dal Deck: ${monsters.length} Evocat${monsters.length === 1 ? 'a' : 'e'} Special, ${others.length} in mano.`);
            });
        }
    });

    // ================================================================
    // 238 — Barattolo di Fibra (effetto FLIP)
    // Entrambi i giocatori rimescolano nel proprio Deck tutte le carte da
    // mano, Terreno (mostri + Magie/Trappole + Magia Terreno) e Cimitero,
    // poi pescano 5 carte. Funziona solo con un vero Deck salvato, come
    // Barattolo Cyber (id 173) qui sopra.
    // ================================================================
    CardEffects.register(238, {
        onFlip(ctx) {
            Tavolo.ordine().forEach((owner) => {
                const deck = Tavolo.mazzo(owner);
                if (!Array.isArray(deck)) {
                    ctx.log(`🫙 ${owner === 'player' ? 'Non hai' : 'Il bot non ha'} un Deck reale in questa modalità: Giara di Fibra non ha effetto per questo lato.`);
                    return;
                }
                const hand = ctx.hand(owner);
                const grave = ctx.graveyard(owner);
                // Necrovalley (id 890): le carte nel Cimitero restano lì; mano
                // e Terreno tornano comunque nel Deck.
                const cimiteroBloccato = ctx.graveyardMoveNegated(owner);
                const toShuffle = [...hand.splice(0, hand.length), ...(cimiteroBloccato ? [] : grave.splice(0, grave.length))];
                ctx.field(owner).forEach((slot, index) => {
                    if (slot) { toShuffle.push(slot.card); ctx.field(owner)[index] = null; }
                });
                ctx.stField(owner).forEach((slot, index) => {
                    if (slot) { toShuffle.push(slot.card); ctx.stField(owner)[index] = null; }
                });
                const fieldSpellKey = Tavolo.chiave(owner, 'FieldSpell');
                if (gameState[fieldSpellKey]) {
                    toShuffle.push(gameState[fieldSpellKey].card);
                    gameState[fieldSpellKey] = null;
                }
                deck.push(...toShuffle);
                for (let i = deck.length - 1; i > 0; i--) {
                    const j = Math.floor(Casuale.random() * (i + 1));
                    [deck[i], deck[j]] = [deck[j], deck[i]];
                }
                ctx.drawCards(owner, Math.min(5, deck.length));
                ctx.log(`🫙 ${owner === 'player' ? 'Rimescoli' : 'Il bot rimescola'} mano, Terreno e Cimitero nel Deck e pesc${owner === 'player' ? 'hi' : 'a'} 5 carte!`);
                EventiDuello.emetti('mazzo-rimescolato', owner);
            });
        }
    });

    // ================================================================
    // 407 — Domanda
    // Il tuo avversario dichiara il nome del primo mostro in fondo al tuo
    // Cimitero (il più vecchio, il primo mai mandato lì — indice 0
    // dell'array, dato che ogni scarto arriva con .push()). Se indovina,
    // quel mostro viene bandito (ctx.banish, zona Bandite). Se sbaglia,
    // torna in campo Special Summonato (tolto di nuovo dalla zona
    // Bandite, mai stato davvero permanente in questo caso).
    // SEMPLIFICAZIONE: nessuna vera UI di "indovinello" (il Cimitero è già
    // visibile a schermo a entrambi in questo motore, quindi un vero
    // indovinello sarebbe banale da vincere sempre guardando la pila) —
    // l'esito è deciso con una probabilità realistica, 1 su tanti quanti
    // sono i mostri DISTINTI per nome nel Cimitero.
    // ================================================================
    CardEffects.register(407, {
        canActivate(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster');
        },
        activate(ctx) {
            const grave = ctx.graveyard(ctx.owner);
            const target = grave.find((c) => c.type === 'monster');
            if (!target) { ctx.log('⚠️ Nessun mostro nel Cimitero.'); return; }
            const distinctNames = new Set(grave.filter((c) => c.type === 'monster').map((c) => c.name));
            const guessedRight = ctx.random() < (1 / Math.max(1, distinctNames.size));
            if (!ctx.banishFromGraveyard(ctx.owner, target)) return;
            if (guessedRight) {
                ctx.log(`❓ Il tuo avversario indovina: ${target.name} viene bandito dal Cimitero!`);
            } else {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) {
                    ctx.log(`⚠️ Il tuo avversario sbaglia, ma il Terreno è pieno: ${target.name} resta bandito.`);
                    return;
                }
                const banishedList = ctx.banished(ctx.owner);
                const bIdx = banishedList.indexOf(target);
                if (bIdx !== -1) banishedList.splice(bIdx, 1);
                ctx.specialSummon(ctx.owner, target, slotIndex, 'attack', 'graveyard');
                ctx.log(`❓ Il tuo avversario sbaglia: ${target.name} torna in campo Special Summonato!`);
            }
        }
    });

    // ================================================================
    // 300 — Corno del Paradiso (Trappola Normale, Trappola Contatore)
    // Quando un mostro sta per essere Evocato: sacrifica 1 mostro; annulla
    // l'Evocazione, e se lo fai, distruggi quel mostro.
    // SEMPLIFICAZIONE: invece di una vera intercettazione PRIMA che il
    // mostro tocchi il Terreno (richiederebbe riscrivere ogni punto del
    // motore che Evoca — Normale in actions.js, Speciale in decine di
    // punti in duel-engine.js — per fermarsi a metà), il mostro viene
    // lasciato apparire e poi distrutto SUBITO tramite la finestra di
    // risposta onOpponentSummon già esistente (stesso identico meccanismo
    // di Buco Trappola, id 40): nessuna carta in questo database ha oggi
    // un effetto "quando questa carta viene Evocata" che scatterebbe nel
    // frattempo, quindi il risultato pratico è indistinguibile da una vera
    // negazione. Il costo (sacrifica 1 mostro proprio) si paga dentro
    // activate/onOpponentSummon stesso.
    // ================================================================
    CardEffects.register(300, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s);
        },
        // Il Sacrificio e' il mostro PIU' DEBOLE (non "il primo trovato"), e all'IA conviene solo se il mostro appena
        // Evocato vale nettamente piu' di quello che si perde.
        aiCanActivate(ctx) {
            const valore = (c) => DuelEngine.getEffectiveAtk(c) + 0.5 * DuelEngine.getEffectiveDef(c);
            const propri = ctx.field(ctx.owner).filter(Boolean).map((s) => valore(s.card));
            if (!propri.length || !ctx.summonedCard) return propri.length > 0;
            return valore(ctx.summonedCard) >= Math.min.apply(null, propri) + 800;
        },
        onOpponentSummon(ctx) {
            let tributeIndex = -1;
            ctx.field(ctx.owner).forEach((s, i) => {
                if (!s) return;
                const v = DuelEngine.getEffectiveAtk(s.card) + 0.5 * DuelEngine.getEffectiveDef(s.card);
                if (tributeIndex === -1 || v < DuelEngine.getEffectiveAtk(ctx.field(ctx.owner)[tributeIndex].card) + 0.5 * DuelEngine.getEffectiveDef(ctx.field(ctx.owner)[tributeIndex].card)) tributeIndex = i;
            });
            if (tributeIndex === -1) return;
            ctx.declareTargetWaiting(ctx.opponent, ctx.summonedSlotIndex, { totalTargetCount: 1 }, (decl) => {
                if (!decl.allowed) return;
                const target = ctx.field(decl.targetOwner)[decl.targetIndex];
                const tributeName = ctx.field(ctx.owner)[tributeIndex].card.name;
                ctx.destroyMonster(ctx.owner, tributeIndex);
                ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                ctx.log(`📯 Corno del Paradiso sacrifica ${tributeName} per annullare e distruggere ${target ? target.card.name : ctx.summonedCard.name}, appena Evocato!`);
            });
        }
    });

    // ================================================================
    // 448 — Giudizio Solenne (Trappola Normale, Trappola Contatore)
    // Quando un mostro sta per essere Evocato, oppure una Magia/Trappola
    // viene attivata: paga metà dei tuoi Life Points; annulla l'Evocazione
    // o l'attivazione, e se lo fai, distruggi quella carta.
    //
    // Metà "Evocazione": stessa SEMPLIFICAZIONE di Corno del Paradiso (id
    // 300) qui sopra — onOpponentSummon, distruzione immediata invece di
    // una vera intercettazione pre-Evocazione.
    //
    // Metà "Magia/Trappola": QUESTA sì è una vera negazione, resa possibile
    // dalla nuova ctx.negateActivation() (duel-engine.js): Giudizio Solenne
    // si mette in Chain come risposta (stesso meccanismo generico già
    // usato da qualunque Trappola Set, vedi findSetTrapCandidates), e
    // risolvendosi PRIMA della carta a cui risponde (la Chain si risolve
    // LIFO, l'ultima aggiunta è la prima a risolversi — regola vera) marca
    // quel link come negato: resolveChain() lo salta invece di chiamarne
    // l'handler, quindi il suo effetto non accade mai davvero.
    // ================================================================
    CardEffects.register(448, {
        // Paga META' dei LP: il bot annulla solo cio' che vale (una Magia/Trappola di impatto stimato alto, o una
        // Evocazione), non una Magia qualunque come il Vaso dell'Avidita' (pagava meta' LP per fermare una pescata).
        aiCanActivate(ctx) {
            const links = (ctx.gameState.chain && ctx.gameState.chain.links) || [];
            const ultima = links[links.length - 1];
            if (!ultima || !ultima.card) return true; // nessuna catena: e' un'Evocazione
            // Si ferma solo una carta che COLPISCE (distrugge, bandisce, ruba, infligge danni, annulla): non una
            // pescata o un recupero, per i quali pagare meta' dei LP e' un pessimo affare.
            return /distrugg|bandisc|prende\w* il controllo|infligg|dann[oi]|nega|annull/i.test(ultima.card.effect || '');
        },
        canActivate(ctx) {
            const hasSummonToNegate = typeof ctx.summonedCard !== 'undefined';
            const hasChainToNegate = !!(ctx.gameState.chain && ctx.gameState.chain.links && ctx.gameState.chain.links.length > 0);
            return hasSummonToNegate || hasChainToNegate;
        },
        onOpponentSummon(ctx) {
            ctx.declareTargetWaiting(ctx.opponent, ctx.summonedSlotIndex, { totalTargetCount: 1 }, (decl) => {
                if (!decl.allowed) return;
                const target = ctx.field(decl.targetOwner)[decl.targetIndex];
                const lpKey = Tavolo.chiave(ctx.owner, 'LP');
                const cost = Math.ceil(ctx.gameState[lpKey] / 2);
                if (window.FX && typeof FX.playSolemnJudgment === 'function') {
                    FX.playSolemnJudgment(ctx.owner, cost);
                }
                ctx.dealDamage(ctx.owner, cost);
                ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                ctx.log(`⚖️ Giudizio Solenne paga ${cost} Life Points per annullare e distruggere ${target ? target.card.name : ctx.summonedCard.name}, appena Evocato!`);
            });
        },
        activate(ctx) {
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            const cost = Math.ceil(ctx.gameState[lpKey] / 2);
            if (window.FX && typeof FX.playSolemnJudgment === 'function') {
                FX.playSolemnJudgment(ctx.owner, cost);
            }
            ctx.dealDamage(ctx.owner, cost);
            if (ctx.negateActivation()) {
                ctx.log(`⚖️ Giudizio Solenne paga ${cost} Life Points e annulla l'attivazione!`);
            } else {
                ctx.log(`⚖️ Giudizio Solenne paga ${cost} Life Points, ma non c'era più nulla da annullare.`);
            }
        }
    });

    // ================================================================
    // 215 — Neve Battente / Drifting Snow (Trappola Normale)
    // Attivabile solo quando 1 o più tue Trappole vengono distrutte e
    // mandate dal Terreno al Cimitero da un effetto dell'avversario:
    // distruggi 1 Magia o Trappola sul Terreno. Nuovo aggancio nel
    // motore: def.onOwnSpellTrapDestroyed(ctx) (ACTIONS.destroySpellTrap,
    // duel-engine.js), stesso schema/stessa SEMPLIFICAZIONE (un solo
    // rispondente automatico, niente vera finestra di priorità) già
    // usato per onOwnMonsterDestroyed.
    // SEMPLIFICAZIONE: sceglie da sola quale Magia/Trappola distruggere
    // (la prima trovata, priorità al campo avversario).
    // ================================================================
    CardEffects.register(215, {
        onOwnSpellTrapDestroyed(ctx) {
            let target = null;
            let targetOwner = null;
            [ctx.opponent, ctx.owner].forEach((owner) => {
                if (target) return;
                ctx.stField(owner).forEach((slot, index) => {
                    if (target || !slot) return;
                    target = { owner, index };
                });
            });
            if (!target) return;
            ctx.destroySpellTrap(target.owner, target.index);
            ctx.log('❄️ Neve Sferzante distrugge 1 Magia/Trappola sul Terreno!');
        }
    });

    // ================================================================
    // 216 — Fuori Gioco / Drop Off (Trappola Normale)
    // Quando il tuo avversario pesca per la sua pescata Normale nella Draw
    // Phase: il tuo avversario scarta la carta appena pescata. Nuovo
    // aggancio nel motore: DuelEngine.openDrawResponseWindow, chiamato da
    // enterDrawPhase (game-flow.js) subito dopo ogni pescata Normale,
    // stesso meccanismo generico di onOpponentSummon/onAttackDeclare.
    // ctx.opponent, nel contesto di RISPOSTA, è chi ha appena pescato (il
    // "proprietario" dell'evento originale) — stesso identico significato
    // di ctx.opponent in onOpponentSummon (es. Buco Trappola, id 40).
    // ================================================================
    CardEffects.register(216, {
        onOpponentNormalDraw(ctx) {
            if (!ctx.drawnCard) return;
            const idx = ctx.hand(ctx.opponent).indexOf(ctx.drawnCard);
            if (idx === -1) return;
            const drawnName = ctx.drawnCard.name;
            ctx.discardChosenFromHand(ctx.opponent, idx);
            ctx.log(`🃏 Caduta scarta ${drawnName} dalla mano ${ctx.opponent === 'player' ? 'tua' : 'del bot'}, appena pescata!`);
        }
    });

    // ================================================================
    // 396 — Spada Sigillante di Orichalcos / Orichalcos Sword of Sealing
    // (Carta Equipaggiamento)
    // Gli effetti del mostro equipaggiato vengono negati (static,
    // gameState.monsterEffectsNegatedUidsFor, consultato da
    // DuelEngine.isMonsterCardEffectsNegated in tutti i punti in cui un
    // effetto Mostro può scattare, stesso schema di piercingUidsFor).
    // Seconda clausola ("se hai una carta in Field Zone: estendi questo
    // effetto a un altro mostro Effetto che controlli, fino alla fine
    // del turno avversario, una volta per turno") ora implementata:
    // continuous:true + repeatableWhileContinuous:true (stesso
    // meccanismo generico già usato da Drago Nero Pece id 404/Offerta
    // Suprema id 559/Pietra del Potere Nero Pece id 751 per "riattiva una
    // carta Continua già in campo") permettono di ricliccarla mentre è
    // già agganciata — canActivate/activate distinguono i due stati
    // leggendo ctx.card.equippedToOwner, esattamente come id 404. La
    // durata "fino a fine turno avversario" vive in un secondo store
    // (gameState.orichalcosExtendedNegationUidsFor, scaduto in
    // changeTurn/game-flow.js) perché monsterEffectsNegatedUidsFor viene
    // azzerato e ricostruito da zero ad OGNI render dalla sola clausola
    // base — vedi il commento in recomputeStaticEffects (duel-engine.js)
    // che re-inietta questo store lì. Il mostro a cui estendere lo
    // sceglie il giocatore (orichalcosEstendi).
    // Terza clausola ("Effetto Veloce una volta per turno: scarta 1
    // carta per distruggere 1 carta scoperta sul Terreno", utilizzabile
    // anche durante il turno avversario) tramite
    // canActivateAsQuickEffect/activateAsQuickEffect — coppia di hook
    // DEDICATA (findSpellTrapQuickEffectCandidates, duel-engine.js)
    // invece di riusare canActivate/activate, che servono già ad
    // aggancio ed estensione. Raggiungibile in tre modi: in risposta a
    // una Catena aperta (openActivationWindow), nella finestra di
    // priorità a vuoto del turno avversario (DuelEngine.openPriorityWindow:
    // Standby, inizio Battle Phase, fine turno), e cliccando la carta
    // nel proprio turno — lì, se è disponibile anche l'estensione, si
    // sceglie quale delle due usare. Bersaglio e scarto li sceglie il
    // giocatore, e il bersaglio passa dal checkpoint di targeting.
    // ================================================================
    CardEffects.register(396, {
        continuous: true,
        repeatableWhileContinuous: true,
        canRespondAsQuickEffect: true,
        // Già agganciata, la carta ha DUE abilità attivabili cliccandola nel
        // proprio turno: l'estensione e l'Effetto Veloce. Prima il click
        // portava sempre e solo all'estensione, quindi l'Effetto Veloce nel
        // proprio turno era irraggiungibile; ora, se sono disponibili tutte
        // e due, si sceglie (chooseOption).
        canActivate(ctx) {
            if (ctx.card.equippedToOwner) return orichalcosPuoEstendere(ctx) || orichalcosPuoEffettoVeloce(ctx);
            return findEquipTarget(ctx) !== -1;
        },
        activate(ctx) {
            if (!ctx.card.equippedToOwner) { equipToChosenTarget(ctx); return; }
            const fine = attendiScelta(ctx);
            const puoEstendere = orichalcosPuoEstendere(ctx);
            const puoVeloce = orichalcosPuoEffettoVeloce(ctx);
            // Con una sola abilità disponibile non si chiede nulla. Le due
            // condizioni leggono solo stato pubblico (Magia Terreno, Terreno,
            // numero di carte in mano), quindi in Multiplayer i due client
            // saltano la scelta insieme e le code delle scelte restano
            // accoppiate.
            if (!puoEstendere || !puoVeloce) {
                if (puoVeloce) orichalcosEffettoVeloce(ctx, fine);
                else orichalcosEstendi(ctx, fine);
                return;
            }
            chooseOption(ctx, {
                title: '⚔️ Spada Sigillante di Orichalcos',
                text: 'Quale abilità usi?',
                options: [
                    { value: 'estendi', label: 'Estendi la negazione a un tuo mostro', icon: '🔗' },
                    { value: 'veloce', label: 'Scarta 1 carta e distruggi', icon: '💥' }
                ],
                pickForBot: () => (orichalcosAvversarioHaScoperte(ctx) ? 'veloce' : 'estendi')
            }, (scelta) => {
                if (scelta === 'veloce') { orichalcosEffettoVeloce(ctx, fine); return; }
                orichalcosEstendi(ctx, fine);
            });
        },
        canActivateAsQuickEffect(ctx) { return orichalcosPuoEffettoVeloce(ctx); },
        // Il bot usa questo Effetto Veloce anche in una finestra di priorità
        // a vuoto (DuelEngine.openPriorityWindow) solo se c'è una carta
        // scoperta dell'AVVERSARIO da distruggere: altrimenti scarterebbe
        // per distruggere una carta propria.
        botInFinestraDiPriorita(ctx) { return orichalcosAvversarioHaScoperte(ctx); },
        activateAsQuickEffect(ctx) { orichalcosEffettoVeloce(ctx, attendiScelta(ctx)); },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            gameState.monsterEffectsNegatedUidsFor[ctx.card.equippedToOwner].add(t.uid);
        }
    });

    function orichalcosPuoEstendere(ctx) {
        const fieldSpellKey = Tavolo.chiave(ctx.owner, 'FieldSpell');
        if (!gameState[fieldSpellKey] || gameState[fieldSpellKey].isFaceDown) return false;
        if (ctx.hasUsedOncePerTurn(`orichalcos-extend:${ctx.card.uid}`)) return false;
        const equippedUid = equippedTarget(ctx).uid;
        return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.subtype === 'effect' && slot.card.uid !== equippedUid);
    }

    function orichalcosPuoEffettoVeloce(ctx) {
        if (!ctx.card.equippedToOwner) return false;
        if (ctx.hasUsedOncePerTurn(`orichalcos-quick:${ctx.card.uid}`)) return false;
        if (ctx.hand(ctx.owner).length === 0) return false;
        return Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown) || ctx.stField(owner).some((s) => s && !s.isFaceDown));
    }

    function orichalcosAvversarioHaScoperte(ctx) {
        return ctx.field(ctx.opponent).some((s) => s && !s.isFaceDown)
            || ctx.stField(ctx.opponent).some((s) => s && !s.isFaceDown);
    }

    /**
     * Estensione della Spada: "scegli come bersaglio 1 mostro Effetto che
     * controlli; guadagna questo effetto fino alla fine del turno del tuo
     * avversario". Il mostro lo sceglie il giocatore (prima: il primo
     * idoneo) e passa dal checkpoint di targeting. `fine` chiude l'attesa
     * della Catena su ogni strada.
     */
    function orichalcosEstendi(ctx, fine) {
        const equippedUid = equippedTarget(ctx).uid;
        const candidati = collectFieldTargets(ctx, {
            zone: 'monster', owner: 'self',
            filter: (card) => card.subtype === 'effect' && card.uid !== equippedUid
        });
        if (candidati.length === 0) { fine(); return; }
        ctx.markUsedOncePerTurn(`orichalcos-extend:${ctx.card.uid}`);
        chooseFieldCardTarget(ctx, candidati, {
            title: '⚔️ Spada Sigillante di Orichalcos',
            text: 'Scegli il tuo mostro Effetto a cui estendere la negazione fino alla fine del turno avversario.',
            dichiara: true,
            onNegato: fine,
            onCancel: fine
        }, (scelto) => {
            try {
                gameState.orichalcosExtendedNegationUidsFor = gameState.orichalcosExtendedNegationUidsFor || { player: new Set(), bot: new Set() };
                gameState.orichalcosExtendedNegationUidsFor[ctx.owner].add(scelto.card.uid);
                ctx.log(`⚔️ Spada Sigillante di Orichalcos estende la negazione effetti a ${scelto.card.name} fino alla fine del turno avversario!`);
            } finally {
                fine();
            }
        });
    }

    /**
     * Effetto Veloce della Spada: scarta 1 carta (costo), poi distruggi 1
     * carta scoperta sul Terreno. Usato sia dalla risposta in Catena/finestra
     * di priorità (activateAsQuickEffect) sia dal click nel proprio turno
     * (activate). `fine` chiude l'attesa della Catena su ogni strada.
     */
    function orichalcosEffettoVeloce(ctx, fine) {
        {
            if (ctx.hand(ctx.owner).length === 0) { fine(); return; }
            // Prima lo scarto (il costo), poi il bersaglio: tutte e due scelte
            // del giocatore — prima si scartava sempre la prima carta della
            // mano e si colpiva la prima carta avversaria trovata. Il bot
            // scarta e colpisce come prima: offerHandDiscardChoice/
            // chooseFieldCardTarget prendono il primo candidato, e i
            // candidati avversari vengono per primi.
            const aperto = offerHandDiscardChoice(ctx, {
                title: '⚔️ Spada Sigillante di Orichalcos',
                text: 'Scegli quale carta scartare per distruggere 1 carta scoperta sul Terreno.',
                // Chiudere senza scartare = rinunciare: niente costo, niente
                // effetto, e la Catena riparte.
                onCancel: () => fine()
            }, (discarded) => {
                ctx.markUsedOncePerTurn(`orichalcos-quick:${ctx.card.uid}`);
                const candidati = collectFieldTargets(ctx, { owner: 'opponent' })
                    .concat(collectFieldTargets(ctx, { owner: 'self' }));
                if (candidati.length === 0) { fine(); return; }
                const scegliBersaglio = () => chooseFieldCardTarget(ctx, candidati, {
                    title: '⚔️ Spada Sigillante di Orichalcos',
                    text: 'Scegli la carta scoperta da distruggere.',
                    dichiara: true,
                    onNegato: () => {
                        ctx.log(`⚔️ Spada Sigillante di Orichalcos scarta ${discarded.name}, ma il bersaglio si è sottratto!`);
                        fine();
                    },
                    // Lo scarto è già pagato: chiudere la lista non annulla
                    // l'effetto, la riapre.
                    onCancel: scegliBersaglio
                }, (scelto) => {
                    try {
                        const destroyedName = scelto.card.name;
                        if (scelto.zone === 'monster') ctx.destroyMonster(scelto.owner, scelto.index);
                        else ctx.destroySpellTrap(scelto.owner, scelto.index);
                        ctx.log(`⚔️ Spada Sigillante di Orichalcos scarta ${discarded.name} e distrugge ${destroyedName}!`);
                    } finally {
                        fine();
                    }
                });
                scegliBersaglio();
            });
            if (!aperto) fine();
        }
    }

    // ================================================================
    // 397 — Scelta Dolorosa (Magia Normale)
    // Scegli 5 carte dal tuo Deck e mostrale al tuo avversario. Il tuo
    // avversario ne sceglie 1: aggiungila alla tua mano e manda le
    // rimanenti al Cimitero. Funziona solo con un vero Deck salvato, come
    // Barattolo Cyber/Barattolo di Fibra più sopra.
    // ================================================================
    CardEffects.register(397, {
        canActivate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner, ctx.gameState);
            return Array.isArray(deck) && deck.length > 0;
        },
        activate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner, ctx.gameState);
            if (!Array.isArray(deck) || deck.length === 0) {
                ctx.log('⚠️ Nessun Deck reale da cui scegliere in questa modalità.');
                return;
            }
            const revealed = deck.splice(0, Math.min(5, deck.length));
            const owner = ctx.owner;
            const opponent = ctx.opponent;
            const finish = (chosen) => {
                const chosenIdx = revealed.indexOf(chosen);
                const rest = revealed.filter((c, i) => i !== chosenIdx);
                ctx.hand(owner).push(chosen);
                ctx.graveyard(owner).push(...rest);
                ctx.log(`💭 ${opponent === 'player' ? 'Scegli' : 'Il bot sceglie'} ${chosen.name} per ${owner === 'player' ? 'la tua mano' : 'il bot'}: le altre ${rest.length} vanno al Cimitero.`);
            };
            if (!Decisioni.rispondeUnaPersona(opponent)) {
                // Il bot sceglie da solo: tra i mostri rivelati, quello con
                // l'ATK più basso (danneggia meno l'avversario che riceve);
                // se non ce ne sono, la prima carta rivelata. Il confronto
                // resta SOLO tra mostri: una Magia/Trappola non ha un ATK
                // vero (undefined), quindi finirebbe sempre scelta per
                // prima se paragonata a 0 insieme ai mostri.
                const monsters = revealed.filter((c) => c.type === 'monster');
                let pick = monsters[0] || revealed[0];
                monsters.forEach((c) => { if (c.attack < pick.attack) pick = c; });
                finish(pick);
                return;
            }
            Decisioni.chiedi({
                chi: opponent,
                candidati: revealed,
                titolo: '💭 Scelta Dolorosa',
                testo: `${owner === 'player' ? 'Il bot ha' : 'Hai'} rivelato 5 carte dal Deck: scegli quale finisce nella ${owner === 'player' ? 'sua' : 'tua'} mano (le altre vanno al Cimitero).`
            }, (card) => {
                if (card === null) return;
                finish(card);
            });
        }
    });

    // ================================================================
    // 399 — Guerriero Pantera / Panther Warrior
    // Questa carta non può dichiarare un attacco a meno che tu non
    // sacrifichi 1 mostro. requiresTributeToAttack è un flag puro senza
    // handler proprio: il costo si paga PRIMA della dichiarazione
    // dell'attacco, in executeAttack() (js/engine/actions.js, giocatore) e
    // in botPerformAttacks() (js/ai/bot.js, IA) — gli unici due punti da
    // cui un attacco del giocatore/bot può partire (vedi il commento su
    // resolveAttack in actions.js).
    // ================================================================
    CardEffects.register(399, {
        requiresTributeToAttack: true
    });

    // ================================================================
    // 456 — Ragnatela (Magia Terreno)
    // Se un mostro dichiara un attacco, viene cambiato in Posizione di
    // Difesa alla fine del Damage Step, e non può cambiare Posizione fino
    // alla End Phase del turno successivo del suo controllore, finché
    // questa carta resta sul Terreno — di ENTRAMBI i lati, non solo di chi
    // la controlla. Nessuna logica qui dentro: il controllo vero e proprio
    // (ragnatelaActive) vive in resolveAttack (actions.js), che legge
    // direttamente id 456 sulla zona Magia Terreno di entrambi i
    // giocatori — questa registrazione esiste solo perché ogni Magia,
    // anche Terreno, deve avere un handler activate per poter essere
    // giocata (vedi canActivate in duel-engine.js).
    // ================================================================
    CardEffects.register(456, {
        activate(ctx) {
            ctx.log('🕸️ Ragnatela avvolge il campo di battaglia: ogni mostro che attacca finirà in Difesa!');
        }
    });

    // ================================================================
    // 450 — Demolizione dell'Anima (Trappola Continua)
    // Puoi attivare l'effetto di questa carta solo se controlli un mostro
    // Tipo Demone. Paga 500 Life Points; entrambi i giocatori scelgono 1
    // mostro dal Cimitero DELL'AVVERSARIO, e li bandiscono.
    // SEMPLIFICAZIONE: le regole vere permettono di riusare questo effetto
    // ogni volta che le condizioni tornano vere, finché la carta resta sul
    // Terreno (è Continua) — qui, senza un meccanismo di "abilità Ignition
    // su una Trappola già scoperta", l'effetto scatta una sola volta,
    // subito all'attivazione, come una Trappola Normale.
    // ================================================================
    CardEffects.register(450, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.race === 'Demone');
        },
        activate(ctx) {
            const cost = 500;
            ctx.dealDamage(ctx.owner, cost);
            const pickFrom = (pickerOwner, graveyardOwner) => {
                const grave = ctx.graveyard(graveyardOwner);
                const monsters = grave.filter((c) => c.type === 'monster');
                if (monsters.length === 0) return;
                const remove = (card) => {
                    ctx.banishFromGraveyard(graveyardOwner, card);
                };
                if (!Decisioni.rispondeUnaPersona(pickerOwner)) {
                    remove(monsters[0]);
                    return;
                }
                Decisioni.chiedi({
                    chi: pickerOwner,
                    candidati: monsters,
                    titolo: "💀 Demolizione dell'Anima",
                    testo: `Scegli 1 mostro dal Cimitero ${graveyardOwner === 'player' ? 'tuo' : 'del bot'} da bandire.`
                }, (card) => {
                    if (card === null) return;
                    remove(card);
                });
            };
            pickFrom(ctx.owner, ctx.opponent);
            pickFrom(ctx.opponent, ctx.owner);
            ctx.log(`💀 Demolizione dell'Anima paga ${cost} Life Points: entrambi bandiscono un mostro dal Cimitero avversario!`);
        }
    });

    // ================================================================
    // 501 — Cannone Virus (Trappola Normale)
    // Sacrifica un numero qualsiasi di mostri, esclusi i Token; il tuo
    // avversario manda dal Deck al Cimitero un numero di Magie pari al
    // numero di mostri sacrificati (o tutte le sue Magie, se sono meno).
    // SEMPLIFICAZIONE: sacrifica SEMPRE tutti i mostri non-Token che
    // controlli (nessuna UI di selezione multipla per "un numero
    // qualsiasi" — vedi lo stesso limite già segnalato per altre carte
    // "scegli N carte" in questo file).
    // ================================================================
    CardEffects.register(501, {
        // Sacrifica "un numero qualsiasi" di mostri propri: il bot ne sacrificava tutti (e non e' un costo
        // che sa ripagare con un beneficio).
        aiCanActivate() { return false; },
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.card.isToken);
        },
        activate(ctx) {
            const field = ctx.field(ctx.owner);
            let sacrificedCount = 0;
            field.forEach((slot, index) => {
                if (slot && !slot.card.isToken) {
                    ctx.graveyard(ctx.owner).push(slot.card);
                    field[index] = null;
                    sacrificedCount++;
                }
            });
            if (sacrificedCount === 0) { ctx.log('⚠️ Nessun mostro da sacrificare.'); return; }
            const deck = Tavolo.mazzo(ctx.opponent, ctx.gameState);
            if (!Array.isArray(deck)) {
                ctx.log(`💣 Cannone Virus sacrifica ${sacrificedCount} mostr${sacrificedCount === 1 ? 'o' : 'i'}, ma l'avversario non ha un Deck reale in questa modalità.`);
                return;
            }
            let sent = 0;
            for (let i = deck.length - 1; i >= 0 && sent < sacrificedCount; i--) {
                if (deck[i].type === 'spell') {
                    ctx.millCardFromDeck(ctx.opponent, i);
                    sent++;
                }
            }
            ctx.log(`💣 Cannone Virus sacrifica ${sacrificedCount} mostr${sacrificedCount === 1 ? 'o' : 'i'}: l'avversario manda ${sent} Magi${sent === 1 ? 'a' : 'e'} dal Deck al Cimitero!`);
        }
    });

    // ================================================================
    // 316 — Jirai Gumo (auto-effetto quando attacca)
    // Quando questa carta dichiara un attacco: lancia una moneta e
    // chiamala. Se sbagli, perdi metà dei tuoi Life Points. Usa il nuovo
    // aggancio onOwnAttackDeclare (duel-engine.js) — stesso spirito
    // "risultato subito nel log" già usato per Mago del Tempo (id 28)/
    // Drago Barile (id 104) per il lancio di moneta.
    // ================================================================
    CardEffects.register(316, {
        onOwnAttackDeclare(ctx) {
            const heads = ctx.random() < 0.5;
            if (window.FX) FX.playCoinFlip(heads);
            if (heads) {
                ctx.log('🪙 Jirai Gumo lancia la moneta prima di attaccare: indovinato!');
            } else {
                const lpKey = Tavolo.chiave(ctx.owner, 'LP');
                const cost = Math.ceil(ctx.gameState[lpKey] / 2);
                ctx.dealDamage(ctx.owner, cost);
                ctx.log(`🪙 Jirai Gumo lancia la moneta prima di attaccare: sbagliato! ${ctx.owner === 'player' ? 'Perdi' : 'Il bot perde'} ${cost} Life Points!`);
            }
        }
    });

    // ================================================================
    // 255 — Azzardo (Trappola Normale)
    // Attivabile solo se il tuo avversario ha 6 o più carte in mano e tu
    // ne hai 2 o meno. Lancia una moneta e chiamala: se indovini, pesca
    // finché non hai 5 carte in mano; se sbagli, salta il tuo turno
    // successivo — vedi gameState.skipNextTurnFor, nuovo aggancio in
    // changeTurn() (game-flow.js).
    // ================================================================
    CardEffects.register(255, {
        canActivate(ctx) {
            return ctx.hand(ctx.opponent).length >= 6 && ctx.hand(ctx.owner).length <= 2;
        },
        activate(ctx) {
            const heads = ctx.random() < 0.5;
            if (window.FX) FX.playCoinFlip(heads);
            if (heads) {
                let drawn = 0;
                while (ctx.hand(ctx.owner).length < 5) {
                    const before = ctx.hand(ctx.owner).length;
                    ctx.drawCards(ctx.owner, 1);
                    if (ctx.hand(ctx.owner).length === before) break; // Deck esaurito: sicurezza anti-loop
                    drawn++;
                }
                ctx.log(`🪙 Azzardo: indovinato! ${ctx.owner === 'player' ? 'Peschi' : 'Il bot pesca'} ${drawn} cart${drawn === 1 ? 'a' : 'e'} fino a 5 in mano.`);
            } else {
                ctx.gameState.skipNextTurnFor = ctx.gameState.skipNextTurnFor || {};
                ctx.gameState.skipNextTurnFor[ctx.owner] = true;
                ctx.log(`🪙 Azzardo: sbagliato! ${ctx.owner === 'player' ? 'Salti' : 'Il bot salta'} il prossimo turno!`);
            }
        }
    });

    // ================================================================
    // 141 — Carta del Ritorno Sicuro (Magia Continua)
    // Quando un mostro viene Special Summonato dal tuo Cimitero, puoi
    // pescare 1 carta. Usa il nuovo aggancio onOwnSpecialSummonFromGraveyard
    // (duel-engine.js) — reagisce da sola, un solo respondente automatico,
    // stesso spirito di onOwnMonsterDestroyed (es. Macchina del Tempo, id
    // 478) ma per l'evento "Special Summon dal proprio Cimitero".
    // ================================================================
    CardEffects.register(141, {
        continuous: true,
        activate(ctx) {
            ctx.log('🔄 Carta del Ritorno Sicuro entra in campo: pescherai 1 carta ogni volta che farai una Special Summon dal Cimitero.');
        },
        onOwnSpecialSummonFromGraveyard(ctx) {
            const drawn = ctx.drawCards(ctx.owner, 1);
            if (drawn > 0) {
                ctx.log(`🔄 Carta del Ritorno Sicuro: ${ctx.owner === 'player' ? 'peschi' : 'il bot pesca'} 1 carta!`);
            }
        }
    });

    // ================================================================
    // 497 — Umi (Magia Terreno)
    // Tutti i mostri Tipo Pesce, Serpente di Mare, Tuono e Acquatico sul
    // Terreno guadagnano 200 ATK/DEF; tutti i mostri Tipo Macchina e
    // Piroico sul Terreno perdono 200 ATK/DEF. Stesso schema di Un Oceano
    // Leggendario (id 79), qui per Tipo invece che per Attributo.
    // SCOPERTA: questa carta non aveva ancora nessuna registrazione (né
    // una vera, né una missingEffectNote che lo segnalasse) — senza
    // def.activate non poteva mai essere davvero attivata (canActivate in
    // duel-engine.js richiede sempre un handler activate). Necessaria
    // anche per Muro del Tornado (id 489, qui sotto), che dipende da
    // questa carta scoperta sul Terreno.
    // ================================================================
    CardEffects.register(497, {
        continuous: true,
        activate(ctx) {
            ctx.log('🌊 Umi si scopre sul Terreno.');
        },
        static(ctx) {
            const boosted = ['Pesce', 'Serpente di Mare', 'Tuono', 'Acquatico'];
            const weakened = ['Macchina', 'Piroico'];
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown) return;
                    const existing = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    if (boosted.includes(slot.card.race)) {
                        gameState.atkDefBonus[slot.card.uid] = { atk: existing.atk + 200, def: existing.def + 200 };
                    } else if (weakened.includes(slot.card.race)) {
                        gameState.atkDefBonus[slot.card.uid] = { atk: existing.atk - 200, def: existing.def - 200 };
                    }
                });
            });
        }
    });

    // ================================================================
    // 498 — Cerchio degli Inferi / Inferno Reckless Summon... (Magia
    // Continua). Si attiva solo se ENTRAMBI i giocatori hanno 5+ mostri
    // nel Cimitero: distrugge ogni mostro sul Terreno (di entrambi i
    // lati), poi ogni giocatore bandisce coperti tutti i mostri dal
    // proprio Deck (ctx.banish, già esistente — Zona Bandite), poi puoi
    // Special Summonare 1 Mostro Normale dal proprio Cimitero. Solo 1
    // "Cerchio degli Inferi" attivabile per l'intero Duello
    // (gameState.usedInfernoCircle, flag globale una tantum — diverso da
    // ogni altro "una volta per turno" già presente in questo motore).
    // Clausola ricorrente ("una volta per turno, durante la Standby
    // Phase: OGNI giocatore può Special Summon 1 mostro dal proprio
    // Cimitero, ignorandone le condizioni di Evocazione, ma bandiscilo
    // quando lascia il campo") ora implementata: onStandbyPhase (per il
    // controllore, durante la SUA Standby Phase) + onOpponentStandbyPhase
    // (per l'AVVERSARIO del controllore, durante la SUA — "ogni
    // giocatore" include entrambi i lati, non solo chi controlla la
    // carta, stesso motivo per cui serve entrambi gli hook invece di
    // uno solo). "Ignorandone le condizioni di Evocazione" è già
    // automatico: ctx.specialSummon (duel-engine.js) non valida MAI
    // condizioni di Evocazione, solo canSpecialSummonFromHand/
    // requiresFieldPresenceId (controllati altrove, mai qui) lo fanno.
    // "Bandiscilo quando lascia il campo": nuovo flag PER-ISTANZA
    // `card.mustBanishOnLeavingField` (il mostro è scelto
    // ARBITRARIAMENTE dal Cimitero al momento, impossibile da
    // agganciare con un def.onDestroy/onSTDestroyed per un id fisso),
    // letto da redirectToBanishIfFlagged (duel-engine.js, vedi il
    // commento lì) — chiamata da destroyMonster/notifySacrificedForTribute/
    // returnMonsterToHand e da ciascuno dei ~6 punti "a mano" di
    // resolveBattleDamage (js/engine/actions.js) che mandano un mostro
    // al Cimitero per la distruzione in battaglia.
    // ================================================================
    function tryInfernoCircleSummon(ctx, beneficiaryOwner) {
        if (ctx.hasUsedOncePerTurn(`inferno-circle:${ctx.card.uid}:${beneficiaryOwner}`)) return;
        if (ctx.findEmptyMonsterSlot(beneficiaryOwner) === -1) return;
        // beneficiaryOwner (chi sceglie/riceve il mostro) può essere
        // diverso da ctx.owner (chi controlla Cerchio degli Inferi) — vedi
        // onOpponentStandbyPhase qui sotto — stesso pattern "opponentCtx"
        // già usato per Gilasaurus id 266/Lanciere Sciocco id 1036.
        const beneficiaryCtx = beneficiaryOwner === ctx.owner ? ctx : DuelEngine.makeContext(beneficiaryOwner, {});
        searchGraveyardWithChoice(beneficiaryCtx, beneficiaryOwner, (c) => c.type === 'monster', {
            title: '⭕ Cerchio degli Inferi',
            text: 'Scegli quale mostro Special Summonare dal Cimitero.'
        }, (card) => {
            const slotIndex = ctx.findEmptyMonsterSlot(beneficiaryOwner);
            if (slotIndex === -1) { ctx.graveyard(beneficiaryOwner).push(card); return; }
            ctx.markUsedOncePerTurn(`inferno-circle:${ctx.card.uid}:${beneficiaryOwner}`);
            card.mustBanishOnLeavingField = true;
            ctx.specialSummon(beneficiaryOwner, card, slotIndex, 'attack', 'graveyard');
            ctx.log(`⭕ Cerchio degli Inferi Special Summona ${card.name} dal Cimitero: sarà bandita quando lascerà il Terreno!`);
        });
    }
    CardEffects.register(498, {
        continuous: true,
        canActivate(ctx) {
            if (gameState.usedInfernoCircle) return false;
            const playerGraveCount = gameState.playerGraveyard.filter((c) => c.type === 'monster').length;
            const botGraveCount = gameState.botGraveyard.filter((c) => c.type === 'monster').length;
            return playerGraveCount >= 5 && botGraveCount >= 5;
        },
        activate(ctx) {
            gameState.usedInfernoCircle = true;
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, i) => {
                    if (slot) ctx.destroyMonster(owner, i);
                });
            });
            Tavolo.ordine().forEach((owner) => {
                const deckKey = Tavolo.chiave(owner, 'Deck');
                const countKey = Tavolo.chiave(owner, 'DeckCount');
                const deck = gameState[deckKey];
                if (!Array.isArray(deck)) return;
                for (let i = deck.length - 1; i >= 0; i--) {
                    if (deck[i].type === 'monster') {
                        const [card] = deck.splice(i, 1);
                        ctx.banish(owner, card);
                    }
                }
                gameState[countKey] = deck.length;
            });
            ctx.log("⭕ Cerchio degli Inferi distrugge tutti i mostri sul Terreno e bandisce coperti i mostri di entrambi i Deck!");
            if (ctx.findEmptyMonsterSlot(ctx.owner) !== -1) {
                searchGraveyardWithChoice(ctx, ctx.owner, (c) => c.type === 'monster' && c.vanilla, {
                    title: '⭕ Cerchio degli Inferi',
                    text: 'Scegli quale Mostro Normale Special Summonare dal Cimitero.'
                }, (card) => {
                    const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                    if (slotIndex === -1) { ctx.graveyard(ctx.owner).push(card); return; }
                    ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'graveyard');
                    ctx.log(`⭕ Cerchio degli Inferi Special Summona ${card.name}!`);
                });
            }
        },
        onStandbyPhase(ctx) {
            tryInfernoCircleSummon(ctx, ctx.owner);
        },
        onOpponentStandbyPhase(ctx) {
            tryInfernoCircleSummon(ctx, ctx.standbyOwner);
        }
    });

    // ================================================================
    // 489 — Muro del Tornado (Trappola Continua)
    // Attivabile solo mentre "Umi" (id 497) è sul Terreno. Finché "Umi" è
    // scoperta, non subisci danno da battaglia dai mostri che attaccano —
    // controllo vero e proprio in applyDamage (actions.js), non tramite
    // gameState.noBattleDamageFor (quello è per Waboku, un flag "una
    // tantum per turno", diverso da questa protezione continua). Si
    // autodistrugge quando "Umi" lascia il Terreno.
    // ================================================================
    CardEffects.register(489, {
        continuous: true,
        canActivate(ctx) {
            return ['playerFieldSpell', 'botFieldSpell'].some((key) => {
                const fs = ctx.gameState[key];
                return fs && !fs.isFaceDown && fs.card.id === 497;
            });
        },
        activate(ctx) {
            ctx.log('🌪️ Muro Tornado si scopre sul Terreno: nessun danno da battaglia finché "Umi" resta scoperta!');
        },
        static(ctx) {
            const umiPresent = ['playerFieldSpell', 'botFieldSpell'].some((key) => {
                const fs = ctx.gameState[key];
                return fs && !fs.isFaceDown && fs.card.id === 497;
            });
            if (!umiPresent) {
                ctx.stField(ctx.owner)[ctx.index] = null;
                ctx.graveyard(ctx.owner).push(ctx.card);
                ctx.log('🌪️ Muro Tornado va al Cimitero: "Umi" ha lasciato il Terreno.');
            }
        }
    });

    // ================================================================
    // 222 — Lucertola Elettrica (risposta quando attaccata)
    // Un mostro non-Zombie che attacca questa carta non può attaccare nel
    // suo turno successivo. Vedi gameState.attackLockedUntilTurn, nuovo
    // controllo in resolveAttack (actions.js): il numero di turno esatto
    // si calcola una volta sola al momento del trigger (gameState.turn+2,
    // dato che i turni si alternano), nessun reset esplicito necessario.
    // ================================================================
    CardEffects.register(222, {
        onAttackDeclare(ctx) {
            const attackerSlot = ctx.field(ctx.opponent)[ctx.attackerIndex];
            if (!attackerSlot || attackerSlot.card.race === 'Zombie') return;
            gameState.attackLockedUntilTurn = gameState.attackLockedUntilTurn || {};
            gameState.attackLockedUntilTurn[attackerSlot.card.uid] = gameState.turn + 2;
            ctx.log(`⚡ Lucertola Elettrica blocca ${attackerSlot.card.name}: non potrà attaccare nel suo prossimo turno!`);
        }
    });

    // ================================================================
    // 223 — Tartaruga Elettromagnetica / Electromagnetic Turtle
    // Durante la Battle Phase dell'avversario (Quick Effect): puoi
    // bandire questa carta dal Cimitero; termina la Battle Phase. Puoi
    // usare questo effetto solo una volta per Duello (non per turno —
    // vedi ctx.hasUsedOncePerDuel/markUsedOncePerDuel in duel-engine.js).
    // activatableFromGraveyard: true la rende eleggibile dal Cimitero
    // nella finestra di risposta onAttackDeclare (vedi
    // findTriggerCandidates in duel-engine.js); l'attacco in corso viene
    // anche annullato esplicitamente (ctx.cancelAttack()), dato che
    // terminare la Battle Phase lo rende comunque impossibile da risolvere.
    // ================================================================
    CardEffects.register(223, {
        activatableFromGraveyard: true,
        canActivate(ctx) {
            return !ctx.hasUsedOncePerDuel(`223:${ctx.owner}`);
        },
        onAttackDeclare(ctx) {
            ctx.markUsedOncePerDuel(`223:${ctx.owner}`);
            ctx.cancelAttack();
            ctx.endBattlePhase();
            ctx.log('🐢 Tartaruga Elettromagnetica si bandisce dal Cimitero e termina la Battle Phase!');
        }
    });

    // ================================================================
    // 370 — Maschera di Dissoluzione (Magia Continua)
    // Scegli 1 Magia scoperta sul Terreno (di uno qualunque dei due
    // giocatori). Il suo controllore subisce 500 danni durante ciascuna
    // TUA Standby Phase. Quando la carta scelta lascia il Terreno:
    // distruggi questa carta.
    // uid della carta scelta salvato direttamente su ctx.card (stesso
    // spirito di slot.card.equippedToUid già usato per le Carte
    // Equipaggiamento in duel-engine.js): persiste finché questa Magia
    // resta sullo stesso slot, senza bisogno di un array a parte in
    // gameState. Il controllo "la Magia bersaglio è ancora lì" vive in
    // static() (ricalcolato ad ogni render, come Muro del Tornado id 489)
    // così l'autodistruzione è immediata, non rimandata alla prossima
    // Standby Phase; il danno vero invece vive in onStandbyPhase (fires
    // solo durante la TUA Standby Phase, esattamente come da regola vera).
    // ================================================================
    CardEffects.register(370, {
        continuous: true,
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.stField(owner).some((s) => s && !s.isFaceDown && s.card.type === 'spell'));
        },
        activate(ctx) {
            const targets = [];
            Tavolo.ordine().forEach((owner) => {
                ctx.stField(owner).forEach((slot) => {
                    if (slot && !slot.isFaceDown && slot.card.type === 'spell') targets.push(slot.card);
                });
            });
            const finish = (chosenCard) => {
                ctx.card.watchedSpellUid = chosenCard.uid;
                ctx.log(`🎭 Maschera dell'Antimagia lega il suo effetto a ${chosenCard.name}!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                finish(targets[0]);
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: targets,
                titolo: '🎭 Maschera dell\'Antimagia',
                testo: 'Scegli 1 Magia scoperta sul Terreno da colpire.'
            }, (card) => {
                if (card === null) return;
                finish(card);
            });
        },
        static(ctx) {
            const uid = ctx.card.watchedSpellUid;
            if (!uid) return;
            const stillThere = Tavolo.ordine().some((owner) => ctx.stField(owner).some((slot) => slot && slot.card.uid === uid));
            if (!stillThere) {
                ctx.stField(ctx.owner)[ctx.index] = null;
                ctx.graveyard(ctx.owner).push(ctx.card);
                ctx.log('🎭 Maschera dell\'Antimagia va al Cimitero: la Magia bersaglio ha lasciato il Terreno.');
            }
        },
        onStandbyPhase(ctx) {
            const uid = ctx.card.watchedSpellUid;
            if (!uid) return;
            let controllerOwner = null;
            Tavolo.ordine().forEach((owner) => {
                ctx.stField(owner).forEach((slot) => {
                    if (slot && slot.card.uid === uid) controllerOwner = owner;
                });
            });
            if (!controllerOwner) return;
            ctx.dealDamage(controllerOwner, 500);
            ctx.log('🎭 Maschera dell\'Antimagia infligge 500 danni!');
        }
    });

    // ================================================================
    // 362 — Dimensione Magica (Magia Rapida)
    // Se controlli un mostro Incantatore: scegli come bersaglio 1 mostro
    // che controlli; sacrificalo, poi Special Summon 1 mostro Incantatore
    // dalla tua mano, poi puoi distruggere 1 mostro sul Terreno.
    // 3 scelte in sequenza, ognuna col box a scorrimento già usato altrove
    // in questo file (stesso spirito di Rinascita del Mostro, id 35, che
    // ne incatena già 2): activate(ctx) apre solo la prima e ritorna
    // subito, il resto succede dentro le callback annidate.
    // ================================================================
    CardEffects.register(362, {
        // Il bot la attiva solo se l'Incantatore in mano e' DAVVERO piu' forte (500 ATK o piu') del mostro
        // che sacrifica: prima tributava il primo mostro del campo, qualunque fosse.
        aiCanActivate(ctx) {
            const atk = (c) => DuelEngine.getEffectiveAtk(c);
            const incantatori = ctx.hand(ctx.owner).filter((c) => c.type === 'monster' && c.race === 'Incantatore');
            const propri = ctx.field(ctx.owner).filter((s) => s).map((s) => s.card);
            if (!incantatori.length || !propri.length) return false;
            const valore = (c) => atk(c) + 0.5 * DuelEngine.getEffectiveDef(c);
            const migliore = Math.max.apply(null, incantatori.map((c) => (c.attack || 0) + 0.5 * (c.defense || 0)));
            const piuDebole = Math.min.apply(null, propri.map(valore));
            return migliore - piuDebole >= 500;
        },
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.race === 'Incantatore')
                && ctx.field(ctx.owner).some((s) => s)
                && ctx.hand(ctx.owner).some((c) => c.type === 'monster' && c.race === 'Incantatore');
        },
        activate(ctx) {
            const owner = ctx.owner;
            const tributeCandidates = ctx.field(owner).filter((s) => s).map((s) => s.card);
            const chooseTribute = (tributeCard) => {
                const tributeIdx = ctx.field(owner).findIndex((s) => s && s.card.uid === tributeCard.uid);
                if (tributeIdx === -1) return;
                ctx.destroyMonster(owner, tributeIdx);
                const spellcasters = ctx.hand(owner).filter((c) => c.type === 'monster' && c.race === 'Incantatore');
                if (spellcasters.length === 0) return;
                const chooseSummon = (summonCard) => {
                    const hand = ctx.hand(owner);
                    const handIdx = hand.findIndex((c) => c.uid === summonCard.uid);
                    const slotIndex = ctx.findEmptyMonsterSlot(owner);
                    if (handIdx === -1 || slotIndex === -1) return;
                    hand.splice(handIdx, 1);
                    ctx.specialSummon(owner, summonCard, slotIndex, 'attack', 'hand');
                    ctx.log(`🔮 Dimensione Magica sacrifica ${tributeCard.name} e Special Summona ${summonCard.name}!`);
                    const destroyables = [];
                    Tavolo.ordine().forEach((fieldOwner) => {
                        ctx.field(fieldOwner).forEach((s, idx) => { if (s) destroyables.push({ owner: fieldOwner, index: idx, card: s.card }); });
                    });
                    const chooseDestroy = (target) => {
                        if (!target) return;
                        const slot = ctx.field(target.owner)[target.index];
                        if (slot && slot.card.uid === target.card.uid) {
                            ctx.declareTargetWaiting(target.owner, target.index, { totalTargetCount: 1 }, (decl) => {
                                if (!decl.allowed) return;
                                const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                                if (!finalSlot) return;
                                const finalName = finalSlot.card.name;
                                ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                                ctx.log(`🔮 Dimensione Magica distrugge anche ${finalName}!`);
                            });
                        }
                    };
                    if (destroyables.length === 0) return;
                    if (!Decisioni.rispondeUnaPersona(owner)) {
                        return; // il bot si ferma qui: il "puoi" opzionale resta non sfruttato, semplificazione sicura
                    }
                    Decisioni.chiedi({
                        chi: owner,
                        candidati: destroyables.map((d) => d.card),
                        titolo: '🔮 Dimensione Magica',
                        testo: 'Puoi distruggere 1 mostro sul Terreno (opzionale).',
                        annullabile: true
                    }, (card) => {
                        if (card === null) {
                            return;
                        }
                        chooseDestroy(destroyables.find((d) => d.card.uid === card.uid));
                    });
                };
                if (!Decisioni.rispondeUnaPersona(owner) || spellcasters.length === 1) {
                    // Il bot evoca l'Incantatore piu' forte, non il primo della mano.
                    chooseSummon(spellcasters.reduce((m, c) => ((c.attack || 0) > (m.attack || 0) ? c : m), spellcasters[0]));
                    return;
                }
                Decisioni.chiedi({
                    chi: owner,
                    candidati: spellcasters,
                    titolo: '🔮 Dimensione Magica',
                    testo: 'Scegli quale mostro Incantatore Special Summonare dalla mano.'
                }, (card) => {
                    if (card === null) return;
                    chooseSummon(card);
                });
            };
            if (!Decisioni.rispondeUnaPersona(owner) || tributeCandidates.length === 1) {
                // Il bot sacrifica il proprio mostro PIU' DEBOLE, non il primo del campo.
                chooseTribute(tributeCandidates.reduce((m, c) => (DuelEngine.getEffectiveAtk(c) < DuelEngine.getEffectiveAtk(m) ? c : m), tributeCandidates[0]));
                return;
            }
            Decisioni.chiedi({
                chi: owner,
                candidati: tributeCandidates,
                titolo: '🔮 Dimensione Magica',
                testo: 'Scegli quale mostro sacrificare.'
            }, (card) => {
                if (card === null) return;
                chooseTribute(card);
            });
        }
    });

    // ================================================================
    // 140 — Carta della Rovina / Card of Demise (Magia Normale)
    // Pesca finché non hai 3 carte in mano; per il resto di questo turno
    // il tuo avversario non subisce danni; durante la End Phase di questo
    // turno, manda tutta la tua mano al Cimitero.
    // SEMPLIFICAZIONE: "Non puoi Special Summonare nel turno in cui attivi
    // questa carta" non applicato — imporlo dentro ACTIONS.specialSummon
    // (duel-engine.js) rischierebbe di "perdere" una carta già tolta dalla
    // sua zona d'origine da un altro effetto prima di chiamarlo (quella
    // funzione presume sempre di riuscire), un rischio più grande del
    // beneficio per un vincolo che qui non impedirebbe comunque nulla di
    // concreto nel Duello Demo (il bot non ha Special Summon pianificate
    // in risposta a questa carta).
    // ================================================================
    CardEffects.register(140, {
        activate(ctx) {
            const hand = ctx.hand(ctx.owner);
            let drawn = 0;
            while (hand.length < 3) {
                const before = hand.length;
                ctx.drawCards(ctx.owner, 1);
                if (hand.length === before) break; // Deck esaurito: sicurezza anti-loop
                drawn++;
            }
            ctx.gameState.noDamageFor = ctx.gameState.noDamageFor || {};
            ctx.gameState.noDamageFor[ctx.opponent] = true;
            ctx.gameState.discardHandAtEndPhaseFor = ctx.gameState.discardHandAtEndPhaseFor || {};
            ctx.gameState.discardHandAtEndPhaseFor[ctx.owner] = true;
            ctx.log(`💀 Carta dell'Oblio: ${ctx.owner === 'player' ? 'peschi' : 'il bot pesca'} ${drawn} cart${drawn === 1 ? 'a' : 'e'} fino a 3 in mano. ${ctx.opponent === 'player' ? 'Non subisci' : 'Il bot non subisce'} danni per il resto del turno, ma a fine turno la mano finisce al Cimitero!`);
        }
    });

    // ================================================================
    // Carte aggiunte dallo Starter Deck: Yugi (SDY, 2002) — Ansatsu (541),
    // Fantasma Arguto (542), Artiglio Raggiungente (543), Pagliaccio
    // Mistico (544), Fantasma Magico (547), Neo lo Spadaccino Magico
    // (551), Barone della Spada Demoniaca (552), Forziere Divoratore
    // (553), Stregone dei Dannati (554): tutti Mostri Normali (vanilla,
    // solo testo di flavor), nessuna registrazione necessaria — vedi
    // Guerriero Celtico (id 4) per lo stesso caso già presente.
    // ================================================================

    // ================================================================
    // 546 — Dian Keto la Maestra delle Cure (Magia Normale)
    // Aumenta i tuoi Life Points di 1000 punti.
    // ================================================================
    CardEffects.register(546, {
        activate(ctx) {
            ctx.dealDamage(ctx.owner, -1000);
            ctx.log('💊 Dian Keto il Curatore aumenta i tuoi Life Points di 1000 punti!');
        }
    });

    // ================================================================
    // 548 — Attacco a Doppia Punta (Trappola Normale)
    // Scegli e distruggi 2 dei tuoi mostri e 1 mostro del tuo avversario.
    // I tre bersagli li sceglie il giocatore, uno alla volta
    // (chooseFieldTargetsInSequence), e si distruggono insieme solo alla
    // fine, come nel gioco vero. Il bot sceglie come prima: i suoi 2 più
    // deboli e il più forte dell'avversario (ordine dei candidati).
    // ================================================================
    CardEffects.register(548, {
        // Due mostri propri per uno avversario: il bot lo fa solo se gliene restano altri (non si svuota il
        // campo) e il mostro che distrugge vale piu' dei due che sacrifica.
        aiCanActivate(ctx) {
            const atk = (s) => DuelEngine.getEffectiveAtk(s.card);
            const propri = ctx.field(ctx.owner).filter(Boolean).map(atk).sort((a, b) => a - b);
            const loro = ctx.field(ctx.opponent).filter(Boolean).map(atk);
            if (propri.length < 3 || !loro.length) return false;
            return Math.max.apply(null, loro) > propri[0] + propri[1];
        },
        canActivate(ctx) {
            return ctx.field(ctx.owner).filter((s) => s).length >= 2 && ctx.field(ctx.opponent).some((s) => s);
        },
        activate(ctx) {
            const fine = attendiScelta(ctx);
            const atk = (c) => DuelEngine.getEffectiveAtk(c.card);
            const propri = () => collectFieldTargets(ctx, { zone: 'monster', owner: 'self', includiCoperte: true }).sort((a, b) => atk(a) - atk(b));
            const avversari = () => collectFieldTargets(ctx, { zone: 'monster', owner: 'opponent', includiCoperte: true }).sort((a, b) => atk(b) - atk(a));
            chooseFieldTargetsInSequence(ctx, [
                { candidati: propri, title: '⚔️ Duplice Attacco', text: 'Scegli il primo dei tuoi 2 mostri da distruggere.' },
                { candidati: propri, title: '⚔️ Duplice Attacco', text: 'Scegli il secondo dei tuoi mostri da distruggere.' },
                { candidati: avversari, title: '⚔️ Duplice Attacco', text: 'Scegli il mostro avversario da distruggere.' }
            ], (finali) => {
                try {
                    // Si distruggono per uid, non per indice: un mostro che
                    // lascia il Terreno può far scattare reazioni che
                    // spostano gli altri.
                    finali.forEach((f) => {
                        const idx = ctx.field(f.owner).findIndex((s) => s && s.card.uid === f.card.uid);
                        if (idx !== -1) ctx.destroyMonster(f.owner, idx);
                    });
                    ctx.log('⚔️ Duplice Attacco sacrifica 2 tuoi mostri per distruggere un mostro avversario!');
                } finally {
                    fine();
                }
            });
        }
    });

    // ================================================================
    // 549 — Rinforzi (Trappola Normale)
    // Scegli come bersaglio 1 mostro scoperto sul Terreno; guadagna 500
    // ATK fino alla fine di questo turno.
    // ================================================================
    CardEffects.register(549, {
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && s.card && !s.isFaceDown));
        },
        activate(ctx) {
            const candidates = [];
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((s) => { if (s && s.card && !s.isFaceDown) candidates.push(s.card); });
            });
            const boost = (card) => {
                const owner = ctx.field('player').some((s) => s && s.card.uid === card.uid) ? 'player' : 'bot';
                const index = ctx.field(owner).findIndex((s) => s && s.card.uid === card.uid);
                if (index === -1) return;
                ctx.declareTargetWaiting(owner, index, { totalTargetCount: 1 }, (decl) => {
                    if (!decl.allowed) return;
                    const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                    if (!finalSlot) return;
                    ctx.grantTemporaryAtkDefBonus(finalSlot.card, 500, 0, false);
                    ctx.log(`💪 Rinforzi aumenta l'ATK di ${finalSlot.card.name} di 500 punti!`);
                });
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                // L'elenco parte dal giocatore: il primo e' un suo mostro, e il bot si rinforzava il nemico.
                // Il bot potenzia il proprio mostro piu' forte; se non ne ha, non fa niente.
                const miei = candidates.filter((c) => ctx.field(ctx.owner).some((s) => s && s.card.uid === c.uid));
                if (miei.length === 0) return;
                boost(miei.reduce((m, c) => (DuelEngine.getEffectiveAtk(c) > DuelEngine.getEffectiveAtk(m) ? c : m), miei[0]));
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates,
                titolo: '💪 Rinforzi',
                testo: 'Scegli quale mostro rinforzare.'
            }, (scelta) => {
                if (scelta === null) return;
                boost(scelta);
            });
        }
    });

    // ================================================================
    // 550 — Il Mistico Severo (effetto FLIP)
    // FLIP: rivela tutte le carte coperte sul Terreno (nessun effetto
    // FLIP si attiva), poi rimettile come prima.
    // SEMPLIFICAZIONE: nessun effetto di stato reale — in questo motore
    // ogni carta coperta è già "visibile" a livello di dati per entrambi
    // i giocatori (il Cimitero e le zone coperte non nascondono mai i
    // dati veri, solo l'aspetto a schermo), quindi una rivelazione
    // temporanea non cambierebbe nulla di concreto: resta un log di
    // sapore, coerente con l'effetto reale che comunque non muove
    // nessuna carta.
    // ================================================================
    CardEffects.register(550, {
        onFlip(ctx) {
            ctx.log('🔮 Il Mistico rivela per un istante tutte le carte coperte sul Terreno.');
        }
    });

    // ================================================================
    // 555 — Ultima Volontà (Magia Normale)
    // Se un mostro sul tuo Terreno è stato mandato al tuo Cimitero: puoi
    // Special Summonare 1 mostro con 1500 ATK o meno dal tuo Deck, una
    // volta in questo turno. Poi rimescola il tuo Deck.
    // SEMPLIFICAZIONE: la condizione "mandato al Cimitero QUESTO turno"
    // diventa "hai almeno un mostro nel Cimitero" — il motore non
    // traccia ancora un evento generico "mostro mandato al Cimitero in
    // questo turno" (solo eventi specifici come ON_DESTROY), aggiungerlo
    // solo per questa carta non vale il rischio.
    // ================================================================
    CardEffects.register(555, {
        canActivate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner, ctx.gameState);
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster') && Array.isArray(deck) && ctx.findEmptyMonsterSlot(ctx.owner) !== -1;
        },
        activate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner, ctx.gameState);
            if (!Array.isArray(deck)) { ctx.log('⚠️ Nessun Deck reale in questa modalità.'); return; }
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) { ctx.log('⚠️ Il Terreno è pieno.'); return; }
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.attack <= 1500, {
                noneFoundLog: '⚠️ Nessun mostro con 1500 ATK o meno nel Deck.',
                title: '💐 Ultimo Desiderio',
                text: 'Scegli quale mostro (1500 ATK o meno) Special Summonare dal Deck.'
            }, (card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
                for (let i = deck.length - 1; i > 0; i--) {
                    const j = Math.floor(Casuale.random() * (i + 1));
                    [deck[i], deck[j]] = [deck[j], deck[i]];
                }
                ctx.log(`💐 Ultimo Desiderio Special Summona ${card.name} dal Deck e lo rimescola!`);
                EventiDuello.emetti('mazzo-rimescolato', ctx.owner);
            });
        }
    });

    // ================================================================
    // 556 — Maestro delle Trappole (effetto FLIP)
    // FLIP: scegli 1 Trappola sul Terreno e distruggila.
    // ================================================================
    CardEffects.register(556, {
        onFlip(ctx) {
            const candidates = [];
            Tavolo.ordine().forEach((owner) => {
                ctx.stField(owner).forEach((slot, index) => {
                    if (slot && slot.card.type === 'trap') candidates.push({ owner, index, card: slot.card });
                });
            });
            if (candidates.length === 0) { ctx.log('🪤 Maestro di Trappola si rivela, ma non ci sono Trappole da distruggere.'); return; }
            const destroy = (choice) => {
                const slot = ctx.stField(choice.owner)[choice.index];
                if (!slot || slot.card.uid !== choice.card.uid) return;
                ctx.stField(choice.owner)[choice.index] = null;
                ctx.graveyard(choice.owner).push(choice.card);
                ctx.log(`🪤 Maestro di Trappola distrugge ${choice.card.name}!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                destroy(candidates[0]);
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates.map((c) => c.card),
                titolo: '🪤 Maestro di Trappola',
                testo: 'Scegli quale Trappola distruggere.'
            }, (card) => {
                if (card === null) return;
                const choice = candidates.find((c) => c.card.uid === card.uid);
                if (choice) destroy(choice);
            });
        }
    });

    // ================================================================
    // 557 — Yami (Magia Terreno)
    // Tutti i mostri Tipo Demone e Incantatore sul Terreno guadagnano
    // 200 ATK/DEF; tutti i mostri Tipo Fata sul Terreno perdono 200
    // ATK/DEF. Stesso schema di Umi (id 497)/Un Oceano Leggendario (id 79).
    // ================================================================
    CardEffects.register(557, {
        continuous: true,
        activate(ctx) {
            ctx.log('🌑 Yami si scopre sul Terreno.');
        },
        static(ctx) {
            const boosted = ['Demone', 'Incantatore'];
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown) return;
                    const existing = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    if (boosted.includes(slot.card.race)) {
                        gameState.atkDefBonus[slot.card.uid] = { atk: existing.atk + 200, def: existing.def + 200 };
                    } else if (slot.card.race === 'Fata') {
                        gameState.atkDefBonus[slot.card.uid] = { atk: existing.atk - 200, def: existing.def - 200 };
                    }
                });
            });
        }
    });

    // ================================================================
    // 558 — Trappola Inversa / Reverse Trap
    // Fino alla End Phase, inverte tutte le modifiche ad ATK/DEF sul
    // Terreno (di entrambi i giocatori): gli aumenti diventano diminuzioni
    // e viceversa. Nuovo flag globale gameState.reverseAtkDefBonusUntilEndOfTurn,
    // letto da getEffectiveAtk/getEffectiveDef (duel-engine.js) per
    // invertire il segno della somma di gameState.atkDefBonus +
    // temporaryAtkDefBonus — le modifiche per moltiplicazione/divisione
    // (mai rappresentate come bonus additivo in questo motore) restano
    // correttamente non toccate, come da testo reale. Azzerato in
    // enterEndPhase() (game-flow.js), stesso punto di
    // clearTemporaryAtkDefBonus.
    // ================================================================
    CardEffects.register(558, {
        activate(ctx) {
            gameState.reverseAtkDefBonusUntilEndOfTurn = true;
            ctx.log('🔄 Inverti Trappola: tutte le modifiche ATK/DEF sul Terreno sono invertite fino alla End Phase!');
        }
    });

    // ================================================================
    // 559 — Offerta Suprema
    // Bypassa RIPETUTAMENTE il limite di 1 sola Evocazione Normale a
    // turno, pagando 500 LP ogni volta durante la propria Main Phase.
    // Nuovo
    // def.repeatableWhileContinuous (vedi canActivate, duel-engine.js):
    // eccezione puntuale che permette di ri-attivare questa Trappola
    // Continua più volte nello stesso turno invece del normale "già
    // attiva, non ri-attivabile". Riusa lo stesso bypass singolo già usato
    // da Dado di Evocazione (id 460): gameState.hasNormalSummoned = false.
    // La seconda finestra ("durante la Battle Phase del tuo avversario")
    // non aveva bisogno di una NUOVA interazione UI: onAttackDeclare
    // (qui sotto) è lo stesso identico aggancio già usato da ogni
    // Trappola che risponde a un attacco — findTriggerCandidates
    // (duel-engine.js) scansiona già lo stField SCOPERTO di chi subisce
    // l'attacco, indipendentemente da chi ha il turno (è proprio il
    // punto d'ingresso pensato per rispondere FUORI dal proprio turno) —
    // nota precedente corretta qui, con l'implementazione mancante.
    // Auto-applicata SENZA popup di scelta (a differenza di altre "puoi"
    // di questo file): resolveChain() (duel-engine.js) chiama ogni
    // handler di risposta dentro un while SINCRONO, prima di proseguire
    // con la risoluzione dell'attacco — un openChoicePopover qui
    // lascerebbe l'attacco risolversi PRIMA che il giocatore clicchi,
    // vanificando lo scopo pratico dell'effetto (rendersi bersaglio
    // legale in tempo). Auto-selezione: solo un mostro evocabile SENZA
    // Sacrificio (getTributesRequired === 0), sempre scoperto in
    // Posizione di Attacco.
    // ================================================================
    CardEffects.register(559, {
        continuous: true,
        repeatableWhileContinuous: true,
        canActivate(ctx) {
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            if (gameState[lpKey] < 500) return false;
            // findTriggerCandidates (duel-engine.js) applica questo STESSO
            // canActivate anche come filtro per la candidatura a
            // onAttackDeclare (bug reale scoperto/corretto qui: senza
            // questo bypass, il vincolo "propria Main Phase" qui sotto
            // escludeva SEMPRE questa carta dalla finestra di risposta
            // durante la Battle Phase avversaria, l'esatto momento in cui
            // dovrebbe invece poter rispondere). ctx.attackerIndex esiste
            // solo su un ctx derivato da un attacco (buildResponseCtx
            // preserva i campi del ctx originale) — il vincolo sul proprio
            // turno/Main Phase riguarda SOLO la riattivazione manuale
            // ripetuta, già bloccata a un livello più alto per il click
            // umano (vedi la nota storica su questa carta), quindi qui
            // serve solo per la decisione automatica del bot.
            if (typeof ctx.attackerIndex === 'number') return true;
            if (gameState.currentPlayer !== ctx.owner) return false;
            return gameState.phase === 'main1' || gameState.phase === 'main2';
        },
        activate(ctx) {
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            gameState[lpKey] -= 500;
            gameState.hasNormalSummoned = false;
            ctx.log("💰 Ultima Offerta: paghi 500 LP e puoi Evocare Normalmente/Set un altro mostro!");
        },
        onAttackDeclare(ctx) {
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            if (gameState[lpKey] < 500) return;
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const hand = ctx.hand(ctx.owner);
            const handIndex = hand.findIndex((c) => {
                if (c.type !== 'monster' || c.extraDeck) return false;
                const cardDef = window.DuelEngine && DuelEngine.getDefinition(c.id);
                if (cardDef && cardDef.cannotNormalSummon) return false;
                return getTributesRequired(c) === 0;
            });
            if (handIndex === -1) return;
            gameState[lpKey] -= 500;
            const [card] = hand.splice(handIndex, 1);
            ctx.field(ctx.owner)[slotIndex] = { card: card, position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: false, summonedOnTurn: gameState.turn };
            gameState.hasNormalSummoned = true;
            ctx.log(`💰 Ultima Offerta: paghi 500 LP ed Evochi ${card.name} durante la Battle Phase avversaria!`);
            DuelEngine.fireTrigger(DuelEngine.TRIGGER.ON_NORMAL_SUMMON, DuelEngine.makeContext(ctx.owner, { summonedCard: card, summonedSlotIndex: slotIndex, summonedPosition: 'attack' }));
        }
    });

    // ================================================================
    // Carte aggiunte dallo Starter Deck: Kaiba (SDK, 2002) — Uraby (561),
    // Gyakutenno Megami (562), Terra il Terribile (563), Titano Oscuro
    // del Terrore (564), Maestro e Allievo (565), Guerriero Sconosciuto
    // del Demone (566), Orco dell'Ombra Nera (567), Golem Distruttore
    // (571), Uccello Rosso Teschio (572), D. Human (573), Bestia Pallida
    // (574): tutti Mostri Normali (vanilla, solo testo di flavor),
    // nessuna registrazione necessaria.
    // ================================================================

    // ================================================================
    // 560 — La Malvagia Bestia Verme / The Wicked Worm Beast (Effetto)
    // Questa carta scoperta sul Terreno torna in mano al proprietario
    // durante la tua End Phase.
    // ================================================================
    CardEffects.register(560, {
        onEndPhase(ctx) {
            ctx.returnMonsterToHand(ctx.owner, ctx.slotIndex);
            ctx.log('🪱 Verme Bestiale torna in mano durante la End Phase!');
        }
    });

    // ================================================================
    // 568 — Energia Oscura / Dark Energy (Magia Equipaggiamento)
    // Equipaggiabile solo a un mostro Tipo Demone. +300 ATK/DEF.
    // ================================================================
    CardEffects.register(568, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.race === 'Demone') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.race === 'Demone'); },
        isEquip: true,
        equipTargetFilter: (c) => c.race === 'Demone',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 300, def: e.def + 300 };
        }
    });

    // ================================================================
    // 570 — Ookazi (Magia Normale)
    // Infliggi 800 danni al tuo avversario.
    // ================================================================
    CardEffects.register(570, {
        activate(ctx) {
            ctx.dealDamage(ctx.opponent, 800);
            ctx.log('🔥 Ookazi infligge 800 danni al tuo avversario!');
        }
    });

    // ================================================================
    // 575 — La Spia Inesperta / The Inexperienced Spy (Magia Normale)
    // Scegli e guarda 1 carta nella mano del tuo avversario.
    // SEMPLIFICAZIONE: la vera regola lascia scegliere QUALE carta (senza
    // saperne il contenuto prima); qui la carta rivelata è presa a caso
    // dalla mano dell'avversario. Visibile solo se sei tu (il giocatore)
    // ad attivarla: se è il bot a "sbirciare" la tua mano, non ti viene
    // mostrato quale carta ha visto (altrimenti sapresti sempre qual è).
    // ================================================================
    CardEffects.register(575, {
        canActivate(ctx) { return ctx.hand(ctx.opponent).length > 0; },
        activate(ctx) {
            const hand = ctx.hand(ctx.opponent);
            if (hand.length === 0) return;
            const card = ctx.randomPick(hand);
            if (Decisioni.rispondeUnaPersona(ctx.owner)) {
                Decisioni.chiedi({
                    chi: ctx.owner,
                    tipo: 'presa-visione',
                    candidati: [card],
                    titolo: '🕵️ Spia Inesperta',
                    testo: 'Hai sbirciato questa carta nella mano del tuo avversario:'
                }, () => {});
            }
            ctx.log(ctx.owner === 'player' ? '🕵️ Sbirci una carta nella mano del bot.' : '🕵️ Il bot sbircia una carta nella tua mano.');
        }
    });

    // ================================================================
    // 576 — Telescopio Antico / Ancient Telescope (Magia Normale)
    // Guarda le prime 5 carte del Deck del tuo avversario. Rimettile nel
    // Deck nello stesso ordine (non le tocca davvero: solo un'occhiata).
    // ================================================================
    CardEffects.register(576, {
        canActivate(ctx) {
            const deck = Tavolo.mazzo(ctx.opponent, ctx.gameState);
            return Array.isArray(deck) && deck.length > 0;
        },
        activate(ctx) {
            const deck = Tavolo.mazzo(ctx.opponent, ctx.gameState);
            if (!Array.isArray(deck) || deck.length === 0) { ctx.log('⚠️ Nessun Deck reale in questa modalità.'); return; }
            const top5 = deck.slice(Math.max(0, deck.length - 5)).slice().reverse();
            if (Decisioni.rispondeUnaPersona(ctx.owner)) {
                Decisioni.chiedi({
                    chi: ctx.owner,
                    tipo: 'presa-visione',
                    candidati: top5,
                    titolo: '🔭 Antico Telescopio',
                    testo: 'Le prime 5 carte del Deck del tuo avversario (rimesse a posto subito dopo averle viste):'
                }, () => {});
            }
            ctx.log(ctx.owner === 'player' ? '🔭 Guardi le prime 5 carte del Deck del bot.' : '🔭 Il bot guarda le prime 5 carte del tuo Deck.');
        }
    });

    // ================================================================
    // 577 — Giusto Dessert / Just Desserts (Trappola Normale)
    // Infliggi 500 danni al tuo avversario per ogni mostro che controlla.
    // ================================================================
    CardEffects.register(577, {
        canActivate(ctx) { return ctx.field(ctx.opponent).some((s) => s); },
        activate(ctx) {
            const count = ctx.field(ctx.opponent).filter((s) => s).length;
            const damage = count * 500;
            ctx.dealDamage(ctx.opponent, damage);
            ctx.log(`🍽️ L'hai Voluto tu! infligge ${damage} danni (${count} mostri controllati)!`);
        }
    });

    // ================================================================
    // 578 — Il Flauto per Evocare Draghi / The Flute of Summoning Dragon
    // (Magia Normale)
    // Special Summon fino a 2 mostri Tipo Drago dalla tua mano. "Signore
    // dei D." (id 353) deve essere sul Terreno per attivare e risolvere
    // questo effetto.
    // SEMPLIFICAZIONE: sceglie da sola i primi 2 Draghi trovati in mano
    // (nessuna UI di selezione multipla).
    // ================================================================
    CardEffects.register(578, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.id === 353)
                && ctx.hand(ctx.owner).some((c) => c.type === 'monster' && c.race === 'Drago');
        },
        activate(ctx) {
            const hand = ctx.hand(ctx.owner);
            const dragons = hand.filter((c) => c.type === 'monster' && c.race === 'Drago').slice(0, 2);
            let summonedCount = 0;
            dragons.forEach((card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                const idx = hand.indexOf(card);
                if (idx !== -1) hand.splice(idx, 1);
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'hand');
                summonedCount++;
            });
            ctx.log(`🎺 Flauto Evoca-Draghi Special Summona ${summonedCount} mostro${summonedCount === 1 ? '' : 'i'} Tipo Drago!`);
        }
    });

    // ================================================================
    // 579 — Misterioso Burattinaio / Mysterious Puppeteer (Effetto)
    // Ogni volta che tu o il tuo avversario Evocate Normalmente o girate
    // scoperto (Flip Summon) un mostro, aumenta i tuoi Life Points di 500
    // punti. Usa il nuovo aggancio onAnyNormalOrFlipSummon (duel-engine.js).
    // ================================================================
    CardEffects.register(579, {
        onAnyNormalOrFlipSummon(ctx) {
            ctx.dealDamage(ctx.owner, -500);
            ctx.log('🎭 Burattinaio Misterioso aumenta i tuoi Life Points di 500 punti!');
        }
    });

    // ================================================================
    // 580 — Sogen (Magia Terreno)
    // Tutti i mostri Tipo Guerriero e Guerriero Bestia sul Terreno
    // guadagnano 200 ATK/DEF. Stesso schema di Umi (id 497)/Yami (id 557).
    // ================================================================
    CardEffects.register(580, {
        continuous: true,
        activate(ctx) {
            ctx.log('🏯 Sogen si scopre sul Terreno.');
        },
        static(ctx) {
            const boosted = ['Guerriero', 'Guerriero Bestia'];
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown || !boosted.includes(slot.card.race)) return;
                    const existing = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    gameState.atkDefBonus[slot.card.uid] = { atk: existing.atk + 200, def: existing.def + 200 };
                });
            });
        }
    });

    // ================================================================
    // 581 — Hane-Hane (effetto FLIP)
    // FLIP: scegli 1 mostro sul Terreno e rimandalo in mano al suo
    // proprietario.
    // ================================================================
    CardEffects.register(581, {
        onFlip(ctx) {
            const candidates = [];
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => {
                    if (slot && !(owner === ctx.owner && index === ctx.slotIndex)) candidates.push({ owner, index, card: slot.card });
                });
            });
            if (candidates.length === 0) { ctx.log('🐙 Hane-Hane si rivela, ma non c\'è nessun altro mostro da rimandare in mano.'); return; }
            const bounce = (choice) => {
                const slot = ctx.field(choice.owner)[choice.index];
                if (!slot || slot.card.uid !== choice.card.uid) return;
                const decl = ctx.declareTarget(choice.owner, choice.index, { totalTargetCount: 1 });
                if (!decl.allowed) return;
                const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!finalSlot) return;
                const name = finalSlot.card.name;
                ctx.returnMonsterToHand(decl.targetOwner, decl.targetIndex);
                ctx.log(`🐙 Hane-Hane rimanda ${name} in mano!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                let best = candidates[0];
                candidates.forEach((c) => { if (DuelEngine.getEffectiveAtk(c.card) > DuelEngine.getEffectiveAtk(best.card)) best = c; });
                bounce(best);
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates.map((c) => c.card),
                titolo: '🐙 Hane-Hane',
                testo: 'Scegli quale mostro rimandare in mano al suo proprietario.'
            }, (card) => {
                if (card === null) return;
                const choice = candidates.find((c) => c.card.uid === card.uid);
                if (choice) bounce(choice);
            });
        }
    });

    // ================================================================
    // Carte aggiunte dallo Starter Deck: Joey (SDJ, 2002) — Tartaruga
    // Isola (582), Pesce dai 7 Colori (583), Soldato di Fuoco Oscuro #1
    // (584), Esploratore del Cielo (585): tutti Mostri Normali (vanilla,
    // solo testo di flavor), nessuna registrazione necessaria.
    // ================================================================

    // ================================================================
    // 586 — Uomo Karate (effetto Ignition)
    // Puoi raddoppiare l'ATK originale di questa carta una volta per
    // turno. Se usi questo effetto, distruggi questa carta durante la
    // End Phase. Nessun canActivate: il vincolo "una volta per turno" è
    // già garantito da gameState.usedIgnitionThisTurn (duel-engine.js),
    // applicato automaticamente ad ogni Effetto Ignition da un mostro.
    // ================================================================
    CardEffects.register(586, {
        activate(ctx) {
            ctx.grantTemporaryAtkDefBonus(ctx.card, ctx.card.attack, 0, true);
            ctx.log("🥋 Uomo Karate raddoppia il proprio ATK, ma verrà distrutto a fine turno!");
        }
    });

    // ================================================================
    // 587 — Milus Radiant (buff continuo)
    // Finché resta scoperta sul Terreno, aumenta di 500 punti l'ATK di
    // tutti i mostri Tipo TERRA e diminuisce di 400 punti l'ATK di tutti
    // i mostri Tipo VENTO — se stessa compresa (è Tipo TERRA).
    // ================================================================
    CardEffects.register(587, {
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown) return;
                    const existing = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    if (slot.card.attribute === 'TERRA') {
                        gameState.atkDefBonus[slot.card.uid] = { atk: existing.atk + 500, def: existing.def };
                    } else if (slot.card.attribute === 'VENTO') {
                        gameState.atkDefBonus[slot.card.uid] = { atk: existing.atk - 400, def: existing.def };
                    }
                });
            });
        }
    });

    // ================================================================
    // 588 — Maga della Fede / Magician of Faith (effetto FLIP)
    // FLIP: scegli come bersaglio 1 Magia nel tuo Cimitero; aggiungila
    // alla tua mano.
    // ================================================================
    CardEffects.register(588, {
        onFlip(ctx) {
            const grave = ctx.graveyard(ctx.owner);
            const candidates = grave.filter((c) => c.type === 'spell');
            if (candidates.length === 0) { ctx.log('🔮 Mago della Fede si rivela, ma non ci sono Magie nel Cimitero.'); return; }
            const addToHand = (card) => {
                const idx = grave.indexOf(card);
                if (idx === -1) return;
                if (ctx.graveyardMoveNegated(ctx.owner)) return;
                grave.splice(idx, 1);
                ctx.hand(ctx.owner).push(card);
                ctx.log(`🔮 Mago della Fede aggiunge ${card.name} alla mano!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                addToHand(candidates[0]);
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates,
                titolo: '🔮 Mago della Fede',
                testo: 'Scegli 1 Magia dal Cimitero da aggiungere alla mano.'
            }, (scelta) => {
                if (scelta === null) return;
                addToHand(scelta);
            });
        }
    });

    // ================================================================
    // 589 — Grande Occhio / Big Eye (effetto FLIP)
    // FLIP: guarda fino a 5 carte dalla cima del tuo Deck, poi rimettile
    // in cima al Deck in qualsiasi ordine.
    // SEMPLIFICAZIONE: solo un'occhiata informativa, nessun riordino
    // (le carte tornano nello stesso ordine) — stesso spirito di
    // Telescopio Antico (id 576).
    // ================================================================
    CardEffects.register(589, {
        onFlip(ctx) {
            const deck = Tavolo.mazzo(ctx.owner, ctx.gameState);
            if (!Array.isArray(deck) || deck.length === 0) { ctx.log('⚠️ Nessun Deck reale in questa modalità.'); return; }
            const top5 = deck.slice(Math.max(0, deck.length - 5)).slice().reverse();
            if (Decisioni.rispondeUnaPersona(ctx.owner)) {
                Decisioni.chiedi({
                    chi: ctx.owner,
                    tipo: 'presa-visione',
                    candidati: top5,
                    titolo: '👁️ Grande Occhio',
                    testo: 'Le prime 5 carte del tuo Deck (restano nello stesso ordine):'
                }, () => {});
            }
            ctx.log('👁️ Grande Occhio guarda le prime 5 carte del Deck.');
        }
    });

    // ================================================================
    // 590 — Principessa di Tsurugi / Princess of Tsurugi (effetto FLIP)
    // FLIP: infliggi 500 danni al tuo avversario per ogni Magia e
    // Trappola sul suo Terreno (Magia Terreno inclusa).
    // ================================================================
    CardEffects.register(590, {
        onFlip(ctx) {
            const fieldSpellKey = Tavolo.chiave(ctx.opponent, 'FieldSpell');
            const count = ctx.stField(ctx.opponent).filter((s) => s).length + (ctx.gameState[fieldSpellKey] ? 1 : 0);
            if (count === 0) return;
            const damage = count * 500;
            ctx.dealDamage(ctx.opponent, damage);
            ctx.log(`👸 Principessa di Tsurugi infligge ${damage} danni!`);
        }
    });

    // ================================================================
    // 591 — Cappello Magico Bianco / White Magical Hat (Effetto)
    // Quando questa carta infligge danno da Battaglia ai Life Points del
    // tuo avversario, il tuo avversario scarta 1 carta a caso dalla
    // propria mano. Usa il nuovo aggancio onDealsBattleDamage (actions.js
    // — resolveBattleDamage, chiamato solo nei due rami più comuni: vinci
    // in Posizione di Attacco, o perfori in Posizione di Difesa).
    // ================================================================
    CardEffects.register(591, {
        onDealsBattleDamage(ctx) {
            const discarded = ctx.discardRandomFromHand(ctx.opponent);
            if (!discarded) return;
            ctx.log(`🎩 Bianco Cappello Magico costringe ${ctx.opponent === 'player' ? 'te' : 'il bot'} a scartare 1 carta a caso!`);
        }
    });

    // ================================================================
    // 592 — Soldato Pinguino / Penguin Soldier (effetto FLIP)
    // FLIP: puoi scegliere come bersaglio fino a 2 mostri sul Terreno;
    // riportali in mano. SEMPLIFICAZIONE: 1 solo bersaglio invece di
    // "fino a 2" (nessuna UI di selezione multipla).
    // ================================================================
    CardEffects.register(592, {
        onFlip(ctx) {
            const candidates = [];
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => {
                    if (slot) candidates.push({ owner, index, card: slot.card });
                });
            });
            if (candidates.length === 0) { ctx.log('🐧 Soldato Pinguino si rivela, ma non c\'è nessun mostro da rimandare in mano.'); return; }
            const bounce = (choice) => {
                const slot = ctx.field(choice.owner)[choice.index];
                if (!slot || slot.card.uid !== choice.card.uid) return;
                const decl = ctx.declareTarget(choice.owner, choice.index, { totalTargetCount: 1 });
                if (!decl.allowed) return;
                const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!finalSlot) return;
                const name = finalSlot.card.name;
                ctx.returnMonsterToHand(decl.targetOwner, decl.targetIndex);
                ctx.log(`🐧 Soldato Pinguino rimanda ${name} in mano!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                let best = candidates.find((c) => c.owner === ctx.opponent) || candidates[0];
                candidates.forEach((c) => { if (c.owner === ctx.opponent && DuelEngine.getEffectiveAtk(c.card) > DuelEngine.getEffectiveAtk(best.card)) best = c; });
                bounce(best);
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates.map((c) => c.card),
                titolo: '🐧 Soldato Pinguino',
                testo: 'Scegli quale mostro rimandare in mano al suo proprietario.'
            }, (card) => {
                if (card === null) return;
                const choice = candidates.find((c) => c.card.uid === card.uid);
                if (choice) bounce(choice);
            });
        }
    });

    // ================================================================
    // 594 — Coccola Malevola / Malevolent Nuzzler (Magia Equipaggiamento)
    // Il mostro equipaggiato guadagna 700 ATK; quando questa carta viene
    // mandata dal Terreno al Cimitero, si possono pagare 500 Life Point
    // per rimetterla in cima al Deck.
    // ================================================================
    CardEffects.register(594, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx); },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 700, def: e.def };
        },
        // Il "puoi" del testo è risolto pagando quando i Life Point lo
        // permettono davvero: stessa scelta-automatica già accettata
        // altrove per un costo piccolo e quasi sempre conveniente (vedi
        // Messaggero della Pace id 880). La soglia è "più di 500", non
        // "più di 0": pagare fino a restare a zero vorrebbe dire perdere
        // il duello per riprendersi un equip, che nessuno sceglierebbe.
        onSentToGraveyardFromField(ctx) {
            const chiaveLP = Tavolo.chiave(ctx.owner, 'LP');
            if (gameState[chiaveLP] <= 500) return;
            if (riprendiDalCimitero(ctx, 'deck')) {
                ctx.dealDamage(ctx.owner, 500);
                ctx.log(`💜 ${ctx.card.name}: paghi 500 LP e la rimetti in cima al Deck.`);
            }
        }
    });

    // ================================================================
    // 595 — Il Guardiano Affidabile / The Reliable Guardian (Magia Rapida)
    // Aumenta di 700 punti la DEF di 1 mostro scoperto, fino alla fine
    // di questo turno.
    // ================================================================
    CardEffects.register(595, {
        canActivate(ctx) {
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                return ctx.field(ctx.owner).some((s) => s && s.card && !s.isFaceDown);
            }
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && s.card && !s.isFaceDown));
        },
        activate(ctx) {
            const candidates = [];
            [ctx.owner, ctx.opponent].forEach((owner) => {
                ctx.field(owner).forEach((s) => { if (s && s.card && !s.isFaceDown) candidates.push(s.card); });
            });
            const boost = (card) => {
                // Il bersaglio può lasciare il Terreno mentre l'attivazione
                // aspetta la propria risoluzione; in quel caso non resta
                // alcuna carta valida da rinforzare.
                if (!card) return;
                ctx.grantTemporaryAtkDefBonus(card, 0, 700, false);
                ctx.log(`🛡️ Guardiano Affidabile aumenta la DEF di ${card.name} di 700 punti!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                boost(candidates[0]);
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates,
                titolo: '🛡️ Guardiano Affidabile',
                testo: 'Scegli quale mostro rinforzare.'
            }, (scelta) => {
                if (scelta === null) return;
                boost(scelta);
            });
        }
    });

    // ================================================================
    // 596 — Montagna / Mountain (Magia Terreno)
    // Tutti i mostri Tipo Drago, Bestia Alata e Tuono sul Terreno
    // guadagnano 200 ATK/DEF. Stesso schema di Umi (id 497)/Yami (id 557)/
    // Sogen (id 580).
    // ================================================================
    CardEffects.register(596, {
        continuous: true,
        activate(ctx) {
            ctx.log('⛰️ Montagna si scopre sul Terreno.');
        },
        static(ctx) {
            const boosted = ['Drago', 'Bestia Alata', 'Tuono'];
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown || !boosted.includes(slot.card.race)) return;
                    const existing = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    gameState.atkDefBonus[slot.card.uid] = { atk: existing.atk + 200, def: existing.def + 200 };
                });
            });
        }
    });

    // ================================================================
    // 597 — Tesoro del Drago / Dragon Treasure (Magia Equipaggiamento)
    // Equipaggiabile solo a un mostro Tipo Drago. +300 ATK/DEF.
    // ================================================================
    CardEffects.register(597, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.race === 'Drago') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.race === 'Drago'); },
        isEquip: true,
        equipTargetFilter: (c) => c.race === 'Drago',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 300, def: e.def + 300 };
        }
    });

    // ================================================================
    // 598 — Riposo Eterno / Eternal Rest (Magia Normale)
    // Distruggi tutti i mostri equipaggiati con Magie Equipaggiamento.
    // ================================================================
    CardEffects.register(598, {
        // Distrugge i mostri equipaggiati di ENTRAMBI i lati: il bot la attiva solo se all'avversario ne toglie di piu'.
        aiCanActivate(ctx) {
            const equipaggiati = new Set();
            Tavolo.ordine().forEach((owner) => ctx.stField(owner).forEach((s) => {
                if (s && !s.isFaceDown && DuelEngine.getDefinition(s.card.id)?.isEquip) equipaggiati.add(s.card.equippedToUid);
            }));
            const somma = (owner) => ctx.field(owner).reduce((s, slot) => (slot && equipaggiati.has(slot.card.uid) ? s + DuelEngine.getEffectiveAtk(slot.card) : s), 0);
            return somma(ctx.opponent) - somma(ctx.owner) >= 500;
        },
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.stField(owner).some((s) => s && !s.isFaceDown && DuelEngine.getDefinition(s.card.id)?.isEquip));
        },
        activate(ctx) {
            const equippedUids = new Set();
            Tavolo.ordine().forEach((owner) => {
                ctx.stField(owner).forEach((slot) => {
                    if (slot && !slot.isFaceDown && DuelEngine.getDefinition(slot.card.id)?.isEquip) {
                        equippedUids.add(slot.card.equippedToUid);
                    }
                });
            });
            let destroyedCount = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => {
                    if (slot && equippedUids.has(slot.card.uid)) {
                        ctx.destroyMonster(owner, index);
                        destroyedCount++;
                    }
                });
            });
            ctx.log(`⚰️ Riposo Eterno distrugge ${destroyedCount} mostro${destroyedCount === 1 ? '' : 'i'} equipaggiato${destroyedCount === 1 ? '' : 'i'}!`);
        }
    });

    // ================================================================
    // 599 — Sette Attrezzi del Bandito / Seven Tools of the Bandit
    // (Trappola Contatore)
    // Quando una Trappola viene attivata: paga 1000 Life Points; annulla
    // l'attivazione, e se lo fai, distruggila. Stesso meccanismo di
    // negazione di Giudizio Solenne (id 448), ma ristretto alle sole
    // Trappole (ctx.negateActivation() in duel-engine.js).
    // ================================================================
    CardEffects.register(599, {
        canActivate(ctx) {
            const chain = ctx.gameState.chain;
            return !!(chain && chain.links && chain.links.length > 0 && chain.links[chain.links.length - 1].card.type === 'trap');
        },
        activate(ctx) {
            const cost = 1000;
            ctx.dealDamage(ctx.owner, cost);
            if (ctx.negateActivation()) {
                ctx.log(`✂️ I Sette Attrezzi del Bandito paga ${cost} Life Points e annulla l'attivazione della Trappola!`);
            } else {
                ctx.log(`✂️ I Sette Attrezzi del Bandito paga ${cost} Life Points, ma non c'era più nulla da annullare.`);
            }
        }
    });

    // ================================================================
    // 600 — Trappola Fasulla / Fake Trap
    // "Quando l'avversario attiverebbe un effetto che distruggerebbe 1+
    // Trappole che controlli: distruggi questa carta al loro posto" —
    // nuovo def.redirectsTrapDestroyToSelf (opt-in per-carta), controllato
    // direttamente dentro ACTIONS.destroySpellTrap (duel-engine.js) PRIMA
    // di distruggere davvero il bersaglio originale, non tramite Chain
    // manuale (mai passata da activate(), come ogni altra carta puramente
    // reattiva in questo file). Resta sempre COPERTA finché non scatta —
    // rispetta anche il divieto di rispondere nel turno in cui è stata
    // Set, stesso controllo di ogni Trappola normale. Protegge OGNI
    // Trappola colpita da un effetto che ne distrugge più di una insieme
    // (es. Piumino delle Arpie id 291, Attacco Magico Oscuro id 748), non
    // solo la prima — tramite il batchToken condiviso opzionale di
    // destroySpellTrap (duel-engine.js, vedi il commento lì).
    // ================================================================
    CardEffects.register(600, {
        redirectsTrapDestroyToSelf: true
    });

    // ================================================================
    // 143 — Mura del Castello / Castle Walls (Trappola Normale)
    // Aumenta di 500 punti la DEF di 1 mostro scoperto sul Terreno, fino
    // alla fine di questo turno. Stesso schema di Rinforzi (id 549), solo
    // DEF invece di ATK.
    // SCOPERTA: questa carta non aveva ancora nessuna registrazione (già
    // inclusa sia nello Starter Deck: Yugi che nello Starter Deck: Kaiba
    // senza che l'assenza dell'effetto fosse mai emersa — stesso genere
    // di svista già trovato per Umi, id 497).
    // ================================================================
    CardEffects.register(143, {
        canActivate(ctx) {
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown);
            }
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown));
        },
        activate(ctx) {
            // Prima i propri mostri: il bot prende il primo candidato, e
            // rinforzare un mostro avversario sarebbe una mossa senza senso.
            const candidati = collectFieldTargets(ctx, { zone: 'monster', owner: 'self' })
                .concat(collectFieldTargets(ctx, { zone: 'monster', owner: 'opponent' }));
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🏰 Mura del Castello',
                text: 'Scegli quale mostro rinforzare.',
                dichiara: true
            }, (scelto) => {
                ctx.grantTemporaryAtkDefBonus(scelto.card, 0, 500, false);
                ctx.log(`🏰 Mura del Castello aumenta la DEF di ${scelto.card.name} di 500 punti!`);
            });
        }
    });

    // ================================================================
    // 116 — Rito dell'Illusione Nera / Black Illusion Ritual (Magia
    // Rituale) — Ritual Summon di Abbandonato (id 416) dalla mano.
    // SEMPLIFICAZIONE: stesso spirito di Rito del Guerriero Nero (id 56)/
    // Rituale del Drago Bianco (id 506) — sacrifica in automatico dal
    // PROPRIO Terreno i mostri con Livello più alto finché il totale
    // richiesto (4) non è raggiunto, invece di lasciar scegliere; manca
    // anche la possibilità reale di sacrificare mostri dal Terreno
    // dell'AVVERSARIO (la vera Black Illusion Ritual lo permette) e il
    // divieto di usare mostri Fusione/Rituale/Special Summonati come
    // sacrificio.
    // NOTA: questa Magia esisteva già nel database ma non era mai stata
    // registrata — la nota su Abbandonato (id 416) affermava erroneamente
    // che "nessuna Magia Rituale associata è presente in questo database",
    // quando in realtà lo era, semplicemente dimenticata (stesso genere di
    // svista già trovato per Umi/Mura del Castello). Corretta qui,
    // aggiungendo lo Starter Deck: Pegasus che la include davvero.
    // ================================================================
    CardEffects.register(116, {
        canActivate(ctx) {
            const handIndex = ctx.hand(ctx.owner).findIndex((c) => c.id === 416);
            return handIndex !== -1 && maxRitualTributeLevel(ctx, handIndex) >= 4;
        },
        activate(ctx) {
            const hand = ctx.hand(ctx.owner);
            const handIndex = hand.findIndex((c) => c.id === 416);
            if (handIndex === -1) return;
            // Il sacrificio può togliere carte anche dalla mano: l'indice
            // calcolato prima non è più affidabile, la carta si ritrova per
            // riferimento (prima si poteva Evocare la carta sbagliata, o
            // nessuna — trovato dal duello senza testa).
            const cartaRituale = hand[handIndex];
            performRitualTribute(ctx, 4, handIndex);
            const indiceFinale = hand.indexOf(cartaRituale);
            if (indiceFinale === -1) return;
            const [ritualCard] = hand.splice(indiceFinale, 1);

            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) {
                ctx.graveyard(ctx.owner).push(ritualCard);
                ctx.log('⚠️ Il Terreno è pieno: Abbandono finisce nel Cimitero.');
                return;
            }
            ctx.specialSummon(ctx.owner, ritualCard, slotIndex, 'attack', 'hand');
            ctx.log('👹 Rito dell\'Illusione Nera evoca Abbandono!');
        }
    });

    // ================================================================
    // 123 — Drago Toon Occhi Blu: può essere Evocato normalmente oppure,
    // con Mondo attivo, sacrificando un solo Toon. Attacco diretto,
    // attacco immediato e protezione appartengono a Mondo: quando Mondo
    // sparisce il Drago resta un 3000 ATK regolare, non si autodistrugge.
    CardEffects.register(123, {
        isToon: true,
        mustTargetFilterIfPresent(card, owner) {
            const hasWorld = DuelEngine.hasActiveToonWorld(owner);
            return hasWorld && card.type === 'monster' && ((DuelEngine.getDefinition(card.id)?.isToon) || /Toon/i.test(card.name || ''));
        },
        canSpecialSummonFromHand(ctx) {
            const hasToonWorld = DuelEngine.hasActiveToonWorld(ctx.owner);
            const hasToon = ctx.field(ctx.owner).some((slot) => slot && ((DuelEngine.getDefinition(slot.card.id)?.isToon) || /Toon/i.test(slot.card.name || '')));
            return hasToonWorld && hasToon;
        },
        getSpecialSummonTributeFilters() {
            return [(card) => (DuelEngine.getDefinition(card.id)?.isToon) || /Toon/i.test(card.name || '')];
        },
        paySpecialSummonCost(ctx) {
            return resolveSpecialSummonTributeCost(ctx, [(card) => (DuelEngine.getDefinition(card.id)?.isToon) || /Toon/i.test(card.name || '')], '🐉 Drago Toon Occhi Blu sacrifica 1 mostro Toon per essere Special Summonato!');
        }
    });

    // ================================================================
    // 606 — Manga Ryu-Ran resta il Toon pesante più lento: due Sacrifici
    // per la scorciatoia con Mondo. Conserva la regola anime dello scontro
    // fra Toon: se il difensore ne controlla uno, deve attaccare quello.
    CardEffects.register(606, {
        isToon: true,
        canSpecialSummonFromHand(ctx) {
            const hasToonWorld = DuelEngine.hasActiveToonWorld(ctx.owner);
            const tributes = ctx.field(ctx.owner).filter((slot) => slot).length;
            return hasToonWorld && tributes >= 2;
        },
        getSpecialSummonTributeFilters() {
            return [() => true, () => true];
        },
        paySpecialSummonCost(ctx) {
            return resolveSpecialSummonTributeCost(ctx, [() => true, () => true], '🐲 Manga Ryu-Ran sacrifica 2 mostri per essere Special Summonato!');
        },
        // "Se l'avversario controlla un mostro Toon, deve invece
        // bersagliare un mostro Toon" (mustTargetFilterIfPresent,
        // resolveAttack/actions.js) — "Toon" qui è la stessa convenzione
        // sul nome già usata altrove in questo file (isToon, vedi id 482).
        mustTargetFilterIfPresent(card) { return card.type === 'monster' && ((DuelEngine.getDefinition(card.id)?.isToon) || /Toon/i.test(card.name || '')); }
    });

    // ================================================================
    // 601 — Uccello Sonico / Sonic Bird — Quando Evocata Normalmente o
    // Girata Scoperta: cerca 1 Magia Rituale nel Deck e aggiungila alla
    // mano — vera scelta tra tutte tramite searchDeckWithChoice (questo
    // dataset ha più coppie Rito/Mostro Rituale diverse, quindi "la
    // prima trovata" poteva davvero far perdere una scelta reale), non
    // più il primo trovato nel Deck mescolato. Stesso schema di ricerca
    // nel Deck di Strega della Foresta Nera (id 508), qui agganciato a
    // onSummon (solo Evocazione Normale, MAI Special Summon — vedi
    // ctx.summonedVia) e a onFlip.
    // ================================================================
    (function () {
        function searchRitualSpellToHand(ctx) {
            searchDeckWithChoice(ctx, (c) => c.type === 'spell' && c.subtype === 'ritual', {
                title: '🐦 Uccello Sonico',
                text: 'Scegli quale Magia Rituale aggiungere alla mano dal Deck.',
                noneFoundLog: '🐦 Uccello Sonico cerca, ma non trova Magie Rituali nel Deck.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`🐦 Uccello Sonico aggiunge ${card.name} alla mano dal Deck!`);
            });
        }
        CardEffects.register(601, {
            onSummon(ctx) {
                if (ctx.summonedVia !== 'normal') return;
                searchRitualSpellToHand(ctx);
            },
            onFlip(ctx) {
                searchRitualSpellToHand(ctx);
            }
        });
    })();

    // ================================================================
    // 602 — Maschera dell'Oscurità / Mask of Darkness (effetto FLIP)
    // FLIP: scegli come bersaglio 1 Trappola nel proprio Cimitero;
    // aggiungila alla mano.
    // SEMPLIFICAZIONE: sceglie da sola la prima Trappola trovata nel
    // Cimitero, invece di un'interfaccia di selezione dedicata.
    // ================================================================
    CardEffects.register(602, {
        onFlip(ctx) {
            searchGraveyardWithChoice(ctx, ctx.owner, (c) => c.type === 'trap', {
                noneFoundLog: '🎭 Maschera dell\'Oscurità si rivela, ma non c\'è nessuna Trappola nel Cimitero.',
                title: '🎭 Maschera dell\'Oscurità',
                text: 'Scegli quale Trappola recuperare dal Cimitero.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`🎭 Maschera dell'Oscurità recupera ${card.name} dal Cimitero!`);
            });
        }
    });

    // ================================================================
    // 603 — Muka Muka (effetto continuo statico)
    // Guadagna 300 ATK e 300 DEF per ogni carta nella propria mano.
    // ================================================================
    CardEffects.register(603, {
        static(ctx) {
            const handSize = ctx.hand(ctx.owner).length;
            gameState.atkDefBonus[ctx.card.uid] = { atk: handSize * 300, def: handSize * 300 };
        }
    });

    // ================================================================
    // 604 — Ninja Armato / Armed Ninja (effetto FLIP)
    // FLIP: scegli come bersaglio 1 Magia sul Terreno (anche Set: si
    // rivela, e si distrugge solo se è davvero una Magia). Stesso schema
    // di ricerca bersaglio di Rimuovi Magia (id 195).
    // ================================================================
    CardEffects.register(604, {
        onFlip(ctx) {
            const candidates = [];
            [ctx.owner, ctx.opponent].forEach((owner) => {
                ctx.stField(owner).forEach((slot, index) => {
                    if (slot && (slot.card.type === 'spell' || slot.isFaceDown)) candidates.push({ owner, index, card: slot.card });
                });
            });
            if (candidates.length === 0) {
                ctx.log('🥷 Ninja Armato si rivela, ma non c\'è nessuna Magia da colpire.');
                return;
            }
            const destroy = (choice) => {
                const slot = ctx.stField(choice.owner)[choice.index];
                if (!slot || slot.card.uid !== choice.card.uid) return;
                if (slot.isFaceDown) {
                    slot.isFaceDown = false;
                    ctx.log(`🔎 Ninja Armato rivela ${choice.card.name}!`);
                }
                if (choice.card.type !== 'spell') {
                    ctx.log(`🥷 Ninja Armato non ha effetto: ${choice.card.name} non è una Magia.`);
                    return;
                }
                ctx.stField(choice.owner)[choice.index] = null;
                ctx.graveyard(choice.owner).push(choice.card);
                ctx.log(`🥷 Ninja Armato distrugge ${choice.card.name}!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                const faceUpSpell = candidates.find((c) => c.card.type === 'spell' && !ctx.stField(c.owner)[c.index].isFaceDown);
                destroy(faceUpSpell || candidates[0]);
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates.map((c) => c.card),
                titolo: '🥷 Ninja Armato',
                testo: 'Scegli 1 Magia scoperta, o 1 carta Set, da colpire.'
            }, (card) => {
                if (card === null) return;
                const choice = candidates.find((c) => c.card.uid === card.uid);
                if (choice) destroy(choice);
            });
        }
    });

    // ================================================================
    // 605 — Esploratore Ombra di Hiro / Hiro's Shadow Scout (effetto
    // FLIP)
    // FLIP: il tuo avversario pesca 3 carte; entrambi le guardano; se tra
    // queste ci sono Magie, l'avversario le scarta tutte nel Cimitero.
    // ================================================================
    CardEffects.register(605, {
        onFlip(ctx) {
            const oppHand = ctx.hand(ctx.opponent);
            const before = oppHand.length;
            ctx.drawCards(ctx.opponent, 3);
            const drawn = oppHand.slice(before);
            const spells = drawn.filter((c) => c.type === 'spell');
            if (spells.length === 0) {
                ctx.log('👤 Esploratore-Ombra di Hiro: nessuna Magia tra le carte pescate dall\'avversario.');
                return;
            }
            spells.forEach((card) => {
                const index = oppHand.indexOf(card);
                if (index !== -1) ctx.discardChosenFromHand(ctx.opponent, index);
            });
            ctx.log(`👤 Esploratore-Ombra di Hiro scarta ${spells.length} Magi${spells.length === 1 ? 'a' : 'e'} pescat${spells.length === 1 ? 'a' : 'e'} dall'avversario!`);
        }
    });

    // ================================================================
    // 607 — Tifone dello Spazio Mistico / Mystical Space Typhoon (Magia
    // Rapida) — Scegli come bersaglio 1 Magia/Trappola sul Terreno (anche
    // Set); distruggila incondizionatamente (a differenza di Rimuovi
    // Magia/id 195, funziona anche sulle Trappole).
    // NOTA: questa carta è esattamente il tipo di "distrugge una Trappola
    // Set" che renderebbe attivabile Trappola Fasulla (id 600) — per ora
    // Trappola Fasulla resta comunque senza registrazione (deciso insieme
    // all'utente di rimandarla), ma il meccanismo generico che servirebbe
    // (un ctx.redirectTrapDestruction()-style hook) resta annotato lì.
    // ================================================================
    CardEffects.register(607, {
        canActivate(ctx) {
            return [ctx.owner, ctx.opponent].some((owner) => ctx.stField(owner).some((slot) => slot));
        },
        activate(ctx) {
            const candidates = [];
            [ctx.owner, ctx.opponent].forEach((owner) => {
                ctx.stField(owner).forEach((slot, index) => {
                    if (slot) candidates.push({ owner, index, card: slot.card });
                });
            });
            if (candidates.length === 0) return;
            const destroy = (choice) => {
                const slot = ctx.stField(choice.owner)[choice.index];
                if (!slot || slot.card.uid !== choice.card.uid) return;
                const resolveTyphoon = () => {
                    const current = ctx.stField(choice.owner)[choice.index];
                    if (!current || current.card.uid !== choice.card.uid) return;
                    if (current.isFaceDown) {
                        current.isFaceDown = false;
                        ctx.log(`🔎 Tifone Spaziale Mistico rivela ${choice.card.name}!`);
                    }
                    ctx.stField(choice.owner)[choice.index] = null;
                    ctx.graveyard(choice.owner).push(choice.card);
                    ctx.log(`🌪️ Tifone Spaziale Mistico distrugge ${choice.card.name}!`);
                };
                if (window.FX && typeof FX.playMysticalSpaceTyphoon === 'function') {
                    FX.playMysticalSpaceTyphoon(choice.owner, choice.index, resolveTyphoon);
                } else {
                    resolveTyphoon();
                }
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                const oppCandidate = candidates.find((c) => c.owner === ctx.opponent);
                destroy(oppCandidate || candidates[0]);
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates.map((c) => c.card),
                titolo: '🌪️ Tifone Spaziale Mistico',
                testo: 'Scegli 1 Magia/Trappola, scoperta o Set, da distruggere.'
            }, (card) => {
                if (card === null) return;
                const choice = candidates.find((c) => c.card.uid === card.uid);
                if (choice) destroy(choice);
            });
        }
    });

    // ================================================================
    // 608 — Assalto Sconsiderato / Rush Recklessly (Magia Rapida)
    // Scegli 1 mostro scoperto sul Terreno; guadagna 700 ATK fino alla
    // fine del turno. Riusa ctx.grantTemporaryAtkDefBonus, già usato per
    // Attacco a Doppia Punta e le carte Equipaggiamento.
    // SEMPLIFICAZIONE: sceglie da sola il proprio mostro scoperto con
    // l'ATK più basso (il bersaglio più sensato per un boost), invece di
    // un'interfaccia di selezione dedicata.
    // ================================================================
    CardEffects.register(608, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown);
        },
        activate(ctx) {
            // Il testo dice "1 mostro scoperto sul Terreno", senza
            // limitarsi ai propri: prima sceglieva da sola il PROPRIO
            // mostro con l'ATK più basso, un'euristica sensata ma che
            // toglieva al giocatore l'unica decisione della carta.
            const candidati = collectFieldTargets(ctx, { zone: 'monster' });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '💪 Corsa Avventata',
                text: 'Scegli il mostro che guadagna 700 ATK fino a fine turno.',
                dichiara: true
            }, (scelto) => {
                const slot = ctx.field(scelto.owner)[scelto.index];
                if (!slot) return;
                ctx.grantTemporaryAtkDefBonus(slot.card, 700, 0, false);
                ctx.log(`💪 Corsa Avventata aumenta l'ATK di ${slot.card.name} di 700 punti fino alla fine del turno!`);
            });
        }
    });

    // ================================================================
    // 610 — Goblin Ladro / Robbin' Goblin (Trappola Continua)
    // Ogni volta che un mostro controllato infligge danno da battaglia
    // all'avversario: l'avversario scarta 1 carta a caso. Riusa
    // fireOwnBattleDamageDealt/onDealsBattleDamage (actions.js), già
    // costruito per Cappello Magico Bianco (id 591).
    // ================================================================
    CardEffects.register(610, {
        continuous: true,
        activate(ctx) {
            ctx.log('😈 Goblin Ladro è ora sul Terreno!');
        },
        onOwnMonsterDealsBattleDamage(ctx) {
            const discarded = ctx.discardRandomFromHand(ctx.opponent);
            if (!discarded) return;
            ctx.log(`😈 Goblin Ladro forza l'avversario a scartare ${discarded.name}!`);
        }
    });

    // ================================================================
    // 611 — Giavellotto Incantato / Enchanted Javelin (Trappola Normale)
    // Risposta a un attacco dichiarato (onAttackDeclare, come Kuriboh/
    // Waboku): guadagna Life Points pari all'ATK del mostro attaccante.
    // ================================================================
    CardEffects.register(611, {
        onAttackDeclare(ctx) {
            const gain = ctx.attackerAtk || 0;
            ctx.dealDamage(ctx.owner, -gain);
            ctx.log(`🏹 Lancia Incantata ti fa guadagnare ${gain} Life Points!`);
        }
    });

    // ================================================================
    // 612 — Ala di Grifone / Gryphon Wing (Trappola Normale)
    // Quando il tuo avversario attiva "Spolverino dell'Arpia" (id 291 —
    // CORREZIONE: la nota precedente affermava erroneamente che "Turbina
    // delle Arpie"/Harpie's Feather Duster non fosse presente in questo
    // database — falso, esiste già come id 291): annulla il suo effetto
    // e, se lo fai, distruggi tutte le Magie/Trappole controllate
    // dall'avversario. Stesso schema di risposta via Chain di
    // Interferenza Magica (id 361, ctx.negateActivation()).
    // ================================================================
    CardEffects.register(612, {
        canActivate(ctx) {
            const chain = ctx.gameState.chain;
            return !!(chain && chain.links && chain.links.length > 0 && chain.links[chain.links.length - 1].card.id === 291);
        },
        activate(ctx) {
            if (ctx.negateActivation()) {
                const stField = ctx.stField(ctx.opponent);
                let destroyed = 0;
                stField.forEach((slot, i) => {
                    if (!slot) return;
                    ctx.graveyard(ctx.opponent).push(slot.card);
                    stField[i] = null;
                    destroyed++;
                });
                ctx.log(`🪽 Ali di Grifone annulla Spolverino dell'Arpia e distrugge ${destroyed} Magie/Trappole dell'avversario!`);
            } else {
                ctx.log('🪽 Ali di Grifone: nessuna attivazione da annullare.');
            }
        }
    });

    // ================================================================
    // 614 — Ratto Gigante / Giant Rat (onDestroy — distrutto in battaglia)
    // Quando distrutta in battaglia e mandata al Cimitero: Special Summon
    // 1 mostro TERRA con 1500 o meno ATK dal Deck — vera scelta tra
    // tutti i candidati tramite searchDeckWithChoice (vedi il suo
    // commento), non più il primo trovato nel Deck mescolato. Stesso
    // schema di ricerca nel Deck di Strega della Foresta Nera (id 508)/
    // Uccello Sonico (id 601), ma qui il mostro finisce SUL TERRENO
    // invece che in mano.
    // SEMPLIFICAZIONE residua: onDestroy scatta per QUALSIASI distruzione
    // (non solo in battaglia) — stesso limite già accettato altrove in
    // questo motore (nessuna distinzione battaglia/effetto per questo
    // aggancio).
    // ================================================================
    CardEffects.register(614, {
        onDestroy(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.attribute === 'TERRA' && c.attack <= 1500, {
                title: '🐀 Ratto Gigante',
                text: 'Scegli quale mostro TERRA (1500 ATK o meno) Special Summonare dal Deck.'
            }, (card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
                ctx.log(`🐀 Ratto Gigante Special Summona ${card.name} dal Deck!`);
            });
        }
    });

    // ================================================================
    // 615 — Biblioteca Magica Reale / Royal Magical Library
    // Ogni volta che una Magia viene attivata, guadagna 1 Segnalino
    // Magia (max 3, su ctx.card.counters). Rimuovendo 3 Segnalini:
    // pesca 1 carta. Usa onCardActivated/canActivateOnCardActivated —
    // stesso aggancio generico già usato da Signore del Rosso (id 354) —
    // per il conteggio, e canActivate/activate (Ignition, come Chiron il
    // Mago id 150) per l'abilità di pesca.
    // SEMPLIFICAZIONE: il Segnalino si aggiunge al momento
    // dell'ATTIVAZIONE, non "quando quella Magia si risolve" come da
    // testo reale — nessuna differenza pratica nei casi attuali (nessuna
    // Magia viene negata dopo l'attivazione in questo dataset in un modo
    // che lo renda visibile).
    // ================================================================
    CardEffects.register(615, {
        acceptsSpellCounters: 'counters',
        maxSpellCounters: 3,
        canActivateOnCardActivated(ctx) {
            return ctx.activatedCard.type === 'spell';
        },
        onCardActivated(ctx) {
            const current = ctx.card.counters || 0;
            if (current >= 3) return;
            ctx.card.counters = current + 1;
            ctx.log(`📚 Biblioteca Reale Magica guadagna un Segnalino Magia (${ctx.card.counters}/3)!`);
        },
        canActivate(ctx) {
            return (ctx.card.counters || 0) >= 3;
        },
        activate(ctx) {
            ctx.card.counters -= 3;
            ctx.drawCards(ctx.owner, 1);
            ctx.log('📚 Biblioteca Reale Magica rimuove 3 Segnalini Magia e pesca 1 carta!');
        }
    });

    // ================================================================
    // 618 — Ascia della Disperazione / Axe of Despair (Equipaggiamento)
    // +1000 ATK al mostro equipaggiato, senza restrizione di razza/
    // attributo. Aggiunta al blocco condiviso "CARTE EQUIPAGGIAMENTO"
    // (findEquipTarget/attachEquip/isEquip, vedi id 545/568/569/594/597
    // più sopra in questo file).
    // ================================================================
    CardEffects.register(618, {
        continuous: true,
        canActivate(ctx) {
            return findEquipTarget(ctx, () => true) !== -1;
        },
        activate(ctx) {
            equipToChosenTarget(ctx);
        },
        isEquip: true,
        static(ctx) {
            const target = equippedTarget(ctx);
            const e = gameState.atkDefBonus[target.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[target.uid] = { atk: e.atk + 1000, def: e.def };
        }
    });

    // ================================================================
    // 619 — Zona Plasma Mistica / Mystic Plasma Zone (Magia Terreno)
    // Tutti i mostri di Attributo OSCURITÀ: +500 ATK / -400 DEF. Stesso
    // schema di Umi (id 497)/Yami (id 557)/Sogen (id 580)/Montagna
    // (id 596).
    // ================================================================
    CardEffects.register(619, {
        continuous: true,
        activate(ctx) {
            ctx.log('🌋 Zona Mistica del Plasma attivata!');
        },
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown || slot.card.attribute !== 'OSCURITÀ') return;
                    const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    gameState.atkDefBonus[slot.card.uid] = { atk: e.atk + 500, def: e.def - 400 };
                });
            });
        }
    });

    // ================================================================
    // 620 — Cerchio Ammaliante / Spellbinding Circle (Trappola Continua)
    // Bersaglia 1 mostro dell'avversario: non può attaccare né cambiare
    // Posizione. Se il bersaglio viene distrutto, questa carta si
    // distrugge da sola. Stesso identico schema di Incantesimo Ombra
    // (id 439), qui SENZA il malus di -700 ATK (non previsto dal testo
    // reale di questa carta).
    // ================================================================
    CardEffects.register(620, {
        continuous: true,
        canActivate(ctx) {
            return ctx.field(ctx.opponent).some((s) => s && !s.isFaceDown);
        },
        activate(ctx) {
            // Stessa scelta di Incantesimo Ombra (id 439): il bersaglio
            // resta legato a questa carta finché resta in campo.
            const candidati = [];
            ctx.field(ctx.opponent).forEach((slot, index) => {
                if (slot && !slot.isFaceDown) candidati.push({ owner: ctx.opponent, index, card: slot.card });
            });
            chooseFieldMonsterTarget(ctx, candidati, {
                title: '⭕ Cerchio Incantatore',
                text: 'Scegli quale mostro avversario legare (non può attaccare né cambiare Posizione).',
                dichiara: true
            }, (scelta) => {
                const targetSlot = ctx.field(scelta.owner)[scelta.index];
                if (!targetSlot) return;
                ctx.card.targetOwner = scelta.owner;
                ctx.card.targetIndex = scelta.index;
                ctx.card.targetUid = targetSlot.card.uid;
                if (window.FX && typeof FX.playSpellbindingCircle === 'function') FX.playSpellbindingCircle(scelta.owner, scelta.index);
                ctx.log(`⭕ Cerchio Incantatore lega ${targetSlot.card.name}!`);
            });
        },
        static(ctx) {
            const targetSlot = ctx.card.targetOwner != null ? ctx.field(ctx.card.targetOwner)[ctx.card.targetIndex] : null;
            const validTarget = targetSlot && !targetSlot.isFaceDown && targetSlot.card.uid === ctx.card.targetUid;
            if (!validTarget) {
                ctx.stField(ctx.owner)[ctx.index] = null;
                ctx.graveyard(ctx.owner).push(ctx.card);
                return;
            }
            gameState.cannotAttackUids[targetSlot.card.uid] = true;
            gameState.cannotChangePositionUids[targetSlot.card.uid] = true;
        }
    });

    // ================================================================
    // 621 — Soldato di Riserva / Backup Soldier (Trappola Normale)
    // Mentre ci sono 5+ mostri nel proprio Cimitero: recupera fino a 3
    // Mostri Normali con 1500 o meno ATK dal Cimitero alla mano.
    // "Mostro Normale" qui = nessuna CardEffects.register (stessa
    // convenzione vanilla usata in tutto questo file).
    // SEMPLIFICAZIONE: recupera in automatico i primi 3 trovati, invece
    // di un'interfaccia di selezione multipla dedicata.
    // ================================================================
    CardEffects.register(621, {
        canActivate(ctx) {
            const grave = ctx.graveyard(ctx.owner);
            if (grave.length < 5) return false;
            return grave.some((c) => c.type === 'monster' && c.attack <= 1500 && !DuelEngine.getDefinition(c.id));
        },
        activate(ctx) {
            if (ctx.graveyardMoveNegated(ctx.owner)) return;
            const grave = ctx.graveyard(ctx.owner);
            const hand = ctx.hand(ctx.owner);
            let recovered = 0;
            for (let i = grave.length - 1; i >= 0 && recovered < 3; i--) {
                const c = grave[i];
                if (c.type === 'monster' && c.attack <= 1500 && !DuelEngine.getDefinition(c.id)) {
                    grave.splice(i, 1);
                    hand.push(c);
                    recovered++;
                }
            }
            ctx.log(`🪖 Soldato di Riserva recupera ${recovered} mostr${recovered === 1 ? 'o' : 'i'} dal Cimitero!`);
        }
    });

    // ================================================================
    // 622 — Spostamento / Shift (Trappola Normale). Le due metà, attacco
    // ed effetto che bersaglia, riusano lo stesso criterio di scelta.
    // ================================================================
    // CORREZIONE di fedeltà: aggiunta la metà "Magia/Trappola" mancante,
    // tramite lo stesso checkpoint di targeting di Specchietto della
    // Fata/id 235 (ctx.declareTargetWaiting, duel-engine.js) — a differenza di
    // quella carta (ridirige verso il campo di chi ha attivato l'effetto,
    // "fuoco amico"), qui ridirige verso un ALTRO proprio mostro (difesa,
    // come la metà "attacco" qui sopra).
    // Entrambe le metà fanno scegliere il nuovo bersaglio al giocatore:
    // battaglia ed effetto sospendono la regola finché Decisioni risponde.
    CardEffects.register(622, {
        targetDeclareRequiresChoice: true,
        onAttackDeclare(ctx) {
            const candidati = collectFieldTargets(ctx, {
                zone: 'monster', owner: 'self', includiCoperte: true,
                filter: (card, owner, slot) => ctx.field(owner)[ctx.targetIndex] !== slot
            });
            chooseFieldCardTargetWaiting(ctx, candidati, {
                title: '🔀 Spostamento',
                dichiara: true,
                text: 'Scegli quale altro tuo mostro subirà l\'attacco.'
            }, (scelto) => {
                // scelto.owner: vedi Spiritello dei Sogni (id 214).
                ctx.redirectAttack(scelto.index, scelto.owner);
                ctx.log(`🔀 Spostamento ridirige l'attacco verso ${scelto.card.name}!`);
            });
        },
        canActivate(ctx) {
            if (ctx.zone !== 'st') return false;
            if (ctx.sourceType !== 'spell' && ctx.sourceType !== 'trap') return false;
            if (ctx.sourceOwner === ctx.owner) return false;
            if (ctx.totalTargetCount !== 1) return false;
            return ctx.field(ctx.owner).some((s, i) => s && i !== ctx.targetIndex);
        },
        onCardEffectTargetDeclare(ctx) {
            const field = ctx.field(ctx.owner);
            const newIndex = field.findIndex((s, i) => s && i !== ctx.targetIndex);
            if (newIndex === -1) return;
            ctx.redirect(ctx.owner, newIndex);
            ctx.log(`🔀 Spostamento ridirige l'effetto verso ${field[newIndex].card.name}!`);
        },
        onCardEffectTargetDeclareWaiting(ctx, onDone) {
            const candidates = [];
            ctx.field(ctx.owner).forEach((slot, index) => {
                if (!slot || index === ctx.targetIndex) return;
                candidates.push({ owner: ctx.owner, index, card: slot.card, slot });
            });
            if (candidates.length === 0) { onDone(); return; }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates,
                mostra: (c) => c.card,
                titolo: '🔀 Spostamento',
                testo: 'Scegli quale altro tuo mostro diventerà il bersaglio.',
                automaticaSeUnica: true
            }, (scelto) => {
                if (scelto) {
                    ctx.redirect(ctx.owner, scelto.index);
                    ctx.log(`🔀 Spostamento ridirige l'effetto verso ${scelto.card.name}!`);
                }
                onDone();
            });
        }
    });

    // ================================================================
    // 623 — Sparizione / Disappear (Trappola Normale)
    // Bandisci 1 carta dal Cimitero dell'avversario (ctx.banish, zona
    // Bandite — vedi anche Demolizione dell'Anima id 450/Rilascio
    // delle Anime id 452, stesso schema). Sceglie da sola la più vecchia.
    // ================================================================
    CardEffects.register(623, {
        canActivate(ctx) {
            return ctx.graveyard(ctx.opponent).length > 0;
        },
        activate(ctx) {
            const grave = ctx.graveyard(ctx.opponent);
            const card = grave[0];
            if (!card) return;
            if (!ctx.banishFromGraveyard(ctx.opponent, card)) return;
            ctx.log(`👻 Sparizione bandisce ${card.name} dal Cimitero dell'avversario!`);
        }
    });

    // ================================================================
    // 624 — Rottura di Raigeki / Raigeki Break (Trappola Normale)
    // Scarta 1 carta, poi distruggi 1 carta sul Terreno (mostro O Magia/
    // Trappola, di entrambi i lati).
    // SEMPLIFICAZIONE residua: sceglie da sola quale carta del Terreno
    // distruggere (il bersaglio più pericoloso: preferisce un mostro
    // scoperto dell'avversario, altrimenti il primo trovato), invece di
    // un'interfaccia di selezione dedicata. La carta da scartare come costo
    // è invece ora una vera scelta (offerHandDiscardChoice) — bug reale
    // corretto in questa sessione.
    // ================================================================
    CardEffects.register(624, {
        canActivate(ctx) {
            if (ctx.hand(ctx.owner).length === 0) return false;
            const anyTarget = (owner) => ctx.field(owner).some((s) => s) || ctx.stField(owner).some((s) => s);
            return anyTarget(ctx.owner) || anyTarget(ctx.opponent);
        },
        activate(ctx) {
            offerHandDiscardChoice(ctx, {
                title: '⚡ Frattura Raigeki',
                text: 'Scegli quale carta scartare dalla mano.'
            }, (discarded) => {
                const oppMonsterIndex = ctx.field(ctx.opponent).findIndex((s) => s && !s.isFaceDown);
                if (oppMonsterIndex !== -1) {
                    ctx.declareTargetWaiting(ctx.opponent, oppMonsterIndex, { totalTargetCount: 1 }, (decl) => {
                        if (!decl.allowed) return;
                        const targetSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                        if (!targetSlot) return;
                        const name = targetSlot.card.name;
                        ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                        ctx.log(`⚡ Frattura Raigeki scarta ${discarded.name} e distrugge ${name}!`);
                    });
                    return;
                }
                for (const owner of [ctx.opponent, ctx.owner]) {
                    const monsterIndex = ctx.field(owner).findIndex((s) => s);
                    if (monsterIndex !== -1) {
                        const name = ctx.field(owner)[monsterIndex].card.name;
                        ctx.destroyMonster(owner, monsterIndex);
                        ctx.log(`⚡ Frattura Raigeki scarta ${discarded.name} e distrugge ${name}!`);
                        return;
                    }
                    const stIndex = ctx.stField(owner).findIndex((s) => s);
                    if (stIndex !== -1) {
                        const stCard = ctx.stField(owner)[stIndex].card;
                        ctx.stField(owner)[stIndex] = null;
                        ctx.graveyard(owner).push(stCard);
                        ctx.log(`⚡ Frattura Raigeki scarta ${discarded.name} e distrugge ${stCard.name}!`);
                        return;
                    }
                }
            });
        }
    });

    // ================================================================
    // 625 — Zombyra l'Oscuro / Zombyra the Dark (statico + destroy bonus)
    // Non può attaccare direttamente il tuo avversario
    // (cannotAttackDirectly, controllato in resolveAttack, actions.js, e
    // filtrato a monte in ai-medium.js/ai-hard.js). Se questa carta
    // distrugge un mostro in battaglia: perde 200 ATK (atkLossOnBattleDestroy,
    // già un meccanismo generico esistente in actions.js/
    // applyBattleDestroyBonus — la nota precedente affermava erroneamente
    // che questa clausola fosse già implementata: nessuna registrazione
    // esisteva davvero per questa carta).
    // ================================================================
    CardEffects.register(625, {
        cannotAttackDirectly: true,
        atkLossOnBattleDestroy: 200
    });

    // ================================================================
    // 361 — Interferenza Magica / Magic Jammer (Trappola Contatore)
    // Quando una Magia viene attivata: scarta 1 carta; annulla
    // l'attivazione e, se lo fai, distruggila. Stesso schema di risposta
    // via Chain di Sette Attrezzi del Bandito (id 599), ma per Magie
    // invece che Trappole.
    // SCOPERTA: questa carta esisteva già (inclusa nello Starter Deck:
    // Pegasus) ma non aveva ALCUNA registrazione — mai davvero attivabile
    // finora. Stesso genere di svista già trovata per Umi/Mura del
    // Castello/Drago Toon Occhi Blu/Rito dell'Illusione Nera.
    // ================================================================
    CardEffects.register(361, {
        canActivate(ctx) {
            if (ctx.hand(ctx.owner).length === 0) return false;
            const chain = ctx.gameState.chain;
            return !!(chain && chain.links && chain.links.length > 0 && chain.links[chain.links.length - 1].card.type === 'spell');
        },
        activate(ctx) {
            const hand = ctx.hand(ctx.owner);
            if (hand.length === 0) return;
            const discarded = ctx.discardChosenFromHand(ctx.owner, 0);
            if (ctx.negateActivation()) {
                ctx.log(`🔇 Disturbo Magico scarta ${discarded.name} e annulla l'attivazione della Magia!`);
            } else {
                ctx.log(`🔇 Disturbo Magico scarta ${discarded.name}, ma non c'era più nulla da annullare.`);
            }
        }
    });

    // ================================================================
    // 630 — Spirit Ryu (effetto Quick durante la Battle Phase)
    // Se questa carta combatte, scartando 1 mostro Tipo Drago: guadagna
    // 1000 ATK/DEF fino alla fine della Battle Phase.
    // CORREZIONE DI FEDELTÀ (chiusa in questa sessione — la nota
    // precedente affermava servisse "un trigger per 'questa carta ha
    // appena attaccato', mai esistito perché usato solo per la risposta
    // del difensore": FALSO, onOwnAttackDeclare(ctx) esisteva già da
    // prima di questa sessione, es. Jirai Gumo id 316 — scoperto
    // implementando Assalitore dei Guardiani della Tomba id 895, che usa
    // lo stesso identico hook). Ora il bonus scatta nel preciso istante
    // in cui QUESTA carta dichiara un attacco (non più un Ignition
    // attivabile a piacere durante la propria Battle Phase), e dura fino
    // a fine BATTLE PHASE (flag per-istanza `_spiritRyuBoosted` +
    // static(), azzerato in onBattlePhaseEnd — stesso schema già usato
    // da `usedInjectionThisBattle` di Iniezione della Fata Giglio id
    // 889) invece che fino a fine turno (ctx.grantTemporaryAtkDefBonus,
    // che NON aveva mai quella scadenza più corta).
    // ================================================================
    CardEffects.register(630, {
        onOwnAttackDeclare(ctx) {
            // ctx qui è il declareCtx costruito da resolveAttack
            // (actions.js) per l'INTERO trigger ON_ATTACK_DECLARE — non ha
            // un proprio ctx.card (quel campo è riservato al DIFENSORE che
            // risponde, es. Suijin/Kazejin), solo attackerOwner/attackerIndex:
            // la carta va quindi letta da lì, non da ctx.card (che qui
            // sarebbe undefined — un ctx.card.xxx diretto fallirebbe
            // silenziosamente, catturato da safeCallCardHandler).
            const attackerCard = ctx.field(ctx.attackerOwner)[ctx.attackerIndex].card;
            const hand = ctx.hand(ctx.owner);
            const index = hand.findIndex((c) => c.type === 'monster' && c.race === 'Drago');
            if (index === -1) return;
            const discarded = ctx.discardChosenFromHand(ctx.owner, index);
            attackerCard._spiritRyuBoosted = true;
            ctx.log(`🐉 Spirito Ryu scarta ${discarded.name}: guadagna 1000 ATK/DEF fino alla fine della Battle Phase!`);
        },
        static(ctx) {
            if (!ctx.card._spiritRyuBoosted) return;
            const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk + 1000, def: e.def + 1000 };
        },
        onBattlePhaseEnd(ctx) {
            ctx.card._spiritRyuBoosted = false;
        }
    });

})();
