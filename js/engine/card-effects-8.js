/**
 * card-effects-8.js — Effetti delle carte, parte 8 di 8.
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

    const { destroyTargetingSpellIfItStays, attendiScelta, chooseOption, searchDeckWithChoice, searchGraveyardWithChoice, chooseFieldMonsterTarget, chooseFieldCardTarget, chooseFieldTargetsInSequence, collectFieldTargets, chooseCardFromHand, chooseCardFromList, offerHandDiscardChoice, resolveSpecialSummonBanishCost, maxRitualTributeLevel, performRitualTribute, returnSpellTrapToHand, chooseUpToNFromList, equipToChosenTarget, equippedTarget, cardHasArchetype, cardHasEffectiveName, cardMentionsName } = window.CardEffectsShared;

    // ================================================================
    // 1001-1008 — Il ciclo di Mostri Spirito di Legacy of Darkness (LOD),
    // tema mitologia giapponese. Tutti e 8 condividono lo stesso schema
    // "non Special Summonabile, torna in mano a fine turno se Evocato
    // Normalmente o girato scoperto" già rodato da Yata-Garasu (id 884)/
    // Maharaghi (id 755): cannotSpecialSummon + onSummon(via==='normal')/
    // onFlip che marcano ctx.card._returnToHandTurn, onEndPhase che
    // consulta quel marcatore e chiama ctx.returnMonsterToHand. Solo
    // l'abilità aggiuntiva di ciascuno cambia.
    // ================================================================

    // 1001 — Sacerdote di Asura / Asura Priest: schema Spirito, più "può
    // attaccare tutti i mostri dell'avversario, una volta ciascuno".
    //  - def.attacksEachEnemyOnce: resolveAttack (actions.js) tiene sullo
    //    slot il registro dei bersagli già attaccati in questo turno, e
    //    rifiuta un secondo attacco allo stesso mostro o un attacco diretto
    //    dopo averne attaccato uno.
    //  - def.getExtraAttackCount: il meccanismo di attacchi extra già
    //    esistente (Ben Kei id 721) concede un altro attacco finché resta un
    //    mostro avversario non ancora attaccato. Calcolato come "attacchi già
    //    fatti - 1 + bersagli rimasti", perché il motore lo confronta con
    //    gli extra già usati.
    // Se attacca direttamente (campo avversario vuoto) l'attacco resta uno.
    CardEffects.register(1001, {
        attacksEachEnemyOnce: true,
        getExtraAttackCount(ctx) {
            const slot = ctx.field(ctx.owner)[ctx.slotIndex];
            if (!slot || slot.attackedEnemyUidsTurn !== gameState.turn || !slot.attackedEnemyUids) return 0;
            const fatti = slot.attackedEnemyUids;
            if (fatti.has('__diretto')) return 0;
            const rimasti = ctx.field(ctx.opponent).filter((s) => s && !fatti.has(s.card.uid)).length;
            return Math.max(0, fatti.size - 1 + rimasti);
        },
        cannotSpecialSummon: true,
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            ctx.card._returnToHandTurn = gameState.turn;
        },
        onFlip(ctx) {
            ctx.card._returnToHandTurn = gameState.turn;
        },
        onEndPhase(ctx) {
            if (ctx.card._returnToHandTurn !== gameState.turn) return;
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.returnMonsterToHand(ctx.owner, index);
            ctx.log('🙏 Prete Asura ritorna in mano!');
        }
    });

    // 1002 — Fushi No Tori: schema Spirito + guadagna LP pari al danno da
    // battaglia inflitto (onDealsBattleDamage, nuovo campo ctx.damage —
    // actions.js, aggiunto in questa stessa sessione insieme al
    // moltiplicatore di danno per Soldato di Susa id 1007 qui sotto).
    CardEffects.register(1002, {
        cannotSpecialSummon: true,
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            ctx.card._returnToHandTurn = gameState.turn;
        },
        onFlip(ctx) {
            ctx.card._returnToHandTurn = gameState.turn;
        },
        onEndPhase(ctx) {
            if (ctx.card._returnToHandTurn !== gameState.turn) return;
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.returnMonsterToHand(ctx.owner, index);
            ctx.log('🔥 Fushi No Tori ritorna in mano!');
        },
        onDealsBattleDamage(ctx) {
            ctx.dealDamage(ctx.owner, -(ctx.damage || 0));
            ctx.log(`🔥 Fushi No Tori guadagna ${ctx.damage || 0} Life Points!`);
        }
    });

    // 1003 — Grande Naso Lungo / Great Long Nose: schema Spirito + se
    // infligge danno da battaglia, l'avversario salta la sua PROSSIMA
    // Battle Phase — nuovo gameState.skipNextBattlePhaseFor (booleano
    // per-owner, sopravvive al cambio turno a differenza di
    // skipBattlePhaseFor già esistente, consumato in enterBattlePhase()
    // di game-flow.js, stesso schema di skipMainPhase1For).
    CardEffects.register(1003, {
        cannotSpecialSummon: true,
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            ctx.card._returnToHandTurn = gameState.turn;
        },
        onFlip(ctx) {
            ctx.card._returnToHandTurn = gameState.turn;
        },
        onEndPhase(ctx) {
            if (ctx.card._returnToHandTurn !== gameState.turn) return;
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.returnMonsterToHand(ctx.owner, index);
            ctx.log('👃 Grande Naso Lungo ritorna in mano!');
        },
        onDealsBattleDamage(ctx) {
            gameState.skipNextBattlePhaseFor = gameState.skipNextBattlePhaseFor || {};
            gameState.skipNextBattlePhaseFor[ctx.opponent] = true;
            ctx.log(`👃 Grande Naso Lungo: ${ctx.opponent === 'player' ? 'salterai' : 'il bot salterà'} la prossima Battle Phase!`);
        }
    });

    // 1004 — Hino-Kagu-Tsuchi: schema Spirito + se infligge danno da
    // battaglia, l'avversario scarta l'intera mano alla sua prossima Draw
    // Phase PRIMA di pescare — nuovo gameState.discardHandBeforeDrawFor
    // (booleano per-owner, consumato in enterDrawPhaseInner() di
    // game-flow.js, stesso schema di skipNextBattlePhaseFor qui sopra).
    CardEffects.register(1004, {
        cannotSpecialSummon: true,
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            ctx.card._returnToHandTurn = gameState.turn;
        },
        onFlip(ctx) {
            ctx.card._returnToHandTurn = gameState.turn;
        },
        onEndPhase(ctx) {
            if (ctx.card._returnToHandTurn !== gameState.turn) return;
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.returnMonsterToHand(ctx.owner, index);
            ctx.log('🔥 Hino-Kagu-Tsuchi ritorna in mano!');
        },
        onDealsBattleDamage(ctx) {
            gameState.discardHandBeforeDrawFor = gameState.discardHandBeforeDrawFor || {};
            gameState.discardHandBeforeDrawFor[ctx.opponent] = true;
            ctx.log(`🔥 Hino-Kagu-Tsuchi: ${ctx.opponent === 'player' ? 'scarterai' : 'il bot scarterà'} l'intera mano alla prossima Draw Phase!`);
        }
    });

    // 1005 — Coniglio Bianco di Inaba / Inaba White Rabbit: schema
    // Spirito + può attaccare direttamente (gameState.directAttackAllowedUids,
    // stesso schema incondizionato di Folletto della Fiamma Furente id
    // 681).
    CardEffects.register(1005, {
        cannotSpecialSummon: true,
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            ctx.card._returnToHandTurn = gameState.turn;
        },
        onFlip(ctx) {
            ctx.card._returnToHandTurn = gameState.turn;
        },
        onEndPhase(ctx) {
            if (ctx.card._returnToHandTurn !== gameState.turn) return;
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.returnMonsterToHand(ctx.owner, index);
            ctx.log('🐇 Coniglio Bianco Inaba ritorna in mano!');
        },
        static(ctx) {
            gameState.directAttackAllowedUids[ctx.card.uid] = true;
        }
    });

    // 1006 — Otohime: schema Spirito + quando Evocata Normalmente o
    // girata scoperta, cambia la Posizione di Battaglia di 1 mostro
    // scoperto avversario — bersaglio auto-selezionato (il primo
    // idoneo, stessa SEMPLIFICAZIONE di targeting già accettata ovunque
    // in questo file), passa comunque dal checkpoint condiviso
    // ctx.declareTarget.
    function otohimeChangeTarget(ctx) {
        const candidates = collectFieldTargets(ctx, { zone: 'monster', owner: 'opponent' });
        if (candidates.length === 0) return;
        chooseFieldCardTarget(ctx, candidates, {
            title: '🌊 Otohime',
            text: 'Scegli il mostro avversario a cui cambiare Posizione di Battaglia.'
        }, (scelto) => {
            const decl = ctx.declareTarget(scelto.owner, scelto.index);
            if (!decl.allowed) return;
            const slot = ctx.field(decl.targetOwner)[decl.targetIndex];
            if (!slot) return;
            ctx.changePosition(decl.targetOwner, decl.targetIndex, slot.position === 'attack' ? 'defense' : 'attack');
            ctx.log(`🌊 Otohime cambia la Posizione di Battaglia di ${slot.card.name}!`);
        });
    }
    CardEffects.register(1006, {
        cannotSpecialSummon: true,
        onSummon(ctx) {
            if (ctx.summonedVia === 'normal') {
                ctx.card._returnToHandTurn = gameState.turn;
                otohimeChangeTarget(ctx);
            }
        },
        onFlip(ctx) {
            ctx.card._returnToHandTurn = gameState.turn;
            otohimeChangeTarget(ctx);
        },
        onEndPhase(ctx) {
            if (ctx.card._returnToHandTurn !== gameState.turn) return;
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.returnMonsterToHand(ctx.owner, index);
            ctx.log('🌊 Otohime ritorna in mano!');
        }
    });

    // 1007 — Soldato di Susa / Susa Soldier: schema Spirito + il danno da
    // battaglia inflitto da questa carta è dimezzato — nuovo
    // def.battleDamageMultiplier (numero fisso, 1 se assente su ogni
    // altra carta), applicato in actions.js PRIMA di applyDamage in
    // ognuno dei 3 punti che calcolano un danno da battaglia (attacco
    // diretto, vittoria in Posizione di Attacco, perforazione).
    CardEffects.register(1007, {
        cannotSpecialSummon: true,
        battleDamageMultiplier: 0.5,
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            ctx.card._returnToHandTurn = gameState.turn;
        },
        onFlip(ctx) {
            ctx.card._returnToHandTurn = gameState.turn;
        },
        onEndPhase(ctx) {
            if (ctx.card._returnToHandTurn !== gameState.turn) return;
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.returnMonsterToHand(ctx.owner, index);
            ctx.log('⚡ Soldato Susa ritorna in mano!');
        }
    });

    // 1008 — Drago Yamata / Yamata Dragon: schema Spirito + se infligge
    // danno da battaglia, pesca carte finché non si hanno 5 carte in
    // mano.
    CardEffects.register(1008, {
        cannotSpecialSummon: true,
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            ctx.card._returnToHandTurn = gameState.turn;
        },
        onFlip(ctx) {
            ctx.card._returnToHandTurn = gameState.turn;
        },
        onEndPhase(ctx) {
            if (ctx.card._returnToHandTurn !== gameState.turn) return;
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.returnMonsterToHand(ctx.owner, index);
            ctx.log('🐉 Drago Yamata ritorna in mano!');
        },
        onDealsBattleDamage(ctx) {
            const need = Math.max(0, 5 - ctx.hand(ctx.owner).length);
            if (need > 0) {
                ctx.drawCards(ctx.owner, need);
                ctx.log(`🐉 Drago Yamata: peschi finché non hai 5 carte in mano (+${need})!`);
            }
        }
    });

    // ================================================================
    // 1009-1013 — cluster "può attaccare direttamente" di Metal Raiders
    // (MRD): 5 mostri Livello 1-2 con la stessa identica riga di testo,
    // stesso schema incondizionato di Folletto della Fiamma Furente (id
    // 681)/Coniglio Bianco di Inaba (id 1005) qui sopra.
    // ================================================================
    [1009, 1010, 1011, 1012, 1013].forEach((id) => {
        CardEffects.register(id, {
            static(ctx) {
                gameState.directAttackAllowedUids[ctx.card.uid] = true;
            }
        });
    });

    // ================================================================
    // 1014-1019 — 3 coppie Mostro Rituale + Magia Rituale di Spell Ruler
    // (SRL), stesso identico schema di Rito del Guerriero Nero (id 56):
    // la Magia sacrifica automaticamente dal Terreno E/O dalla mano
    // (performRitualTribute/maxRitualTributeLevel, qui sopra in questo
    // file) i mostri con Livello più alto finché il totale richiesto non
    // è raggiunto, poi Special Summon il Mostro Rituale dalla mano. Il
    // Mostro Rituale stesso vieta Evocazione Normale/Set e Special
    // Summon per ogni altra via.
    // ================================================================

    // 1015 — Ricetta dell'Hamburger / Hamburger Recipe: Ritual Summon di
    // Hamburger Famelico (id 1014), Livello totale >= 6.
    CardEffects.register(1015, {
        canActivate(ctx) {
            const handIndex = ctx.hand(ctx.owner).findIndex((c) => c.id === 1014);
            if (handIndex === -1) return false;
            return maxRitualTributeLevel(ctx, handIndex) >= 6;
        },
        activate(ctx) {
            const handIndex = ctx.hand(ctx.owner).findIndex((c) => c.id === 1014);
            if (handIndex === -1) return;
            performRitualTribute(ctx, 6, handIndex);
            const hand = ctx.hand(ctx.owner);
            const finalHandIndex = hand.findIndex((c) => c.id === 1014);
            if (finalHandIndex === -1) return;
            const [ritualCard] = hand.splice(finalHandIndex, 1);
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) {
                ctx.graveyard(ctx.owner).push(ritualCard);
                ctx.log('⚠️ Il Terreno è pieno: Hamburger Affamato finisce nel Cimitero.');
                return;
            }
            ctx.specialSummon(ctx.owner, ritualCard, slotIndex, 'attack', 'hand');
            ctx.log('🍔 Ricetta dell\'Hamburger evoca Hamburger Affamato!');
        }
    });
    CardEffects.register(1014, {
        cannotNormalSummon: true,
        cannotBeSpecialSummoned: true
    });

    // 1017 — Giuramento della Tartaruga / Turtle Oath: Ritual Summon di
    // Tartaruga Granchio (id 1016), Livello totale >= 8.
    CardEffects.register(1017, {
        canActivate(ctx) {
            const handIndex = ctx.hand(ctx.owner).findIndex((c) => c.id === 1016);
            if (handIndex === -1) return false;
            return maxRitualTributeLevel(ctx, handIndex) >= 8;
        },
        activate(ctx) {
            const handIndex = ctx.hand(ctx.owner).findIndex((c) => c.id === 1016);
            if (handIndex === -1) return;
            performRitualTribute(ctx, 8, handIndex);
            const hand = ctx.hand(ctx.owner);
            const finalHandIndex = hand.findIndex((c) => c.id === 1016);
            if (finalHandIndex === -1) return;
            const [ritualCard] = hand.splice(finalHandIndex, 1);
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) {
                ctx.graveyard(ctx.owner).push(ritualCard);
                ctx.log('⚠️ Il Terreno è pieno: Tartaruga-Granchio finisce nel Cimitero.');
                return;
            }
            ctx.specialSummon(ctx.owner, ritualCard, slotIndex, 'attack', 'hand');
            ctx.log('🐢 Giuramento della Tartaruga evoca Tartaruga-Granchio!');
        }
    });
    CardEffects.register(1016, {
        cannotNormalSummon: true,
        cannotBeSpecialSummoned: true
    });

    // 1019 — Danza d'Apertura / Commencement Dance: Ritual Summon di
    // Spettacolo della Spada (id 1018), Livello totale >= 6.
    CardEffects.register(1019, {
        canActivate(ctx) {
            const handIndex = ctx.hand(ctx.owner).findIndex((c) => c.id === 1018);
            if (handIndex === -1) return false;
            return maxRitualTributeLevel(ctx, handIndex) >= 6;
        },
        activate(ctx) {
            const handIndex = ctx.hand(ctx.owner).findIndex((c) => c.id === 1018);
            if (handIndex === -1) return;
            performRitualTribute(ctx, 6, handIndex);
            const hand = ctx.hand(ctx.owner);
            const finalHandIndex = hand.findIndex((c) => c.id === 1018);
            if (finalHandIndex === -1) return;
            const [ritualCard] = hand.splice(finalHandIndex, 1);
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) {
                ctx.graveyard(ctx.owner).push(ritualCard);
                ctx.log('⚠️ Il Terreno è pieno: Prestazione della Spada finisce nel Cimitero.');
                return;
            }
            ctx.specialSummon(ctx.owner, ritualCard, slotIndex, 'attack', 'hand');
            ctx.log('⚔️ Danza d\'Apertura evoca Prestazione della Spada!');
        }
    });
    CardEffects.register(1018, {
        cannotNormalSummon: true,
        cannotBeSpecialSummoned: true
    });

    // ================================================================
    // 1020-1030 — prima serie, terza ondata: Mostri Flip di Pharaonic
    // Guardian/Pharaoh's Servant/Spell Ruler/Metal Raiders/Legacy of
    // Darkness. Effetti indipendenti l'uno dall'altro, raggruppati qui
    // solo perché chiusi nella stessa sessione.
    // ================================================================

    // 1020 — Mummia Velenosa / Poison Mummy: FLIP, 500 danni diretti.
    CardEffects.register(1020, {
        onFlip(ctx) {
            ctx.dealDamage(ctx.opponent, 500);
            ctx.log('☠️ Mummia Infetta infligge 500 danni!');
        }
    });

    // 1022 — Scarpe Mordaci / Bite Shoes: FLIP, cambia la Posizione di
    // Battaglia di 1 mostro scoperto sul Terreno (bersaglio
    // auto-selezionato: prima l'avversario, poi se non c'è nulla lì il
    // proprio campo — stessa SEMPLIFICAZIONE di targeting già accettata
    // ovunque in questo file).
    CardEffects.register(1022, {
        onFlip(ctx) {
            for (const owner of [ctx.opponent, ctx.owner]) {
                const index = ctx.field(owner).findIndex((slot) => slot && !slot.isFaceDown);
                if (index === -1) continue;
                const decl = ctx.declareTarget(owner, index);
                if (!decl.allowed) return;
                const slot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!slot) return;
                ctx.changePosition(decl.targetOwner, decl.targetIndex, slot.position === 'attack' ? 'defense' : 'attack');
                ctx.log('👞 Scarpe Voraci cambia la Posizione di Battaglia di un mostro!');
                return;
            }
        }
    });

    // 1023 — Parassita Bubbonico / Bubonic Vermin: FLIP, Special Summon
    // di una copia di sé dal Deck in Difesa coperta, poi rimescola.
    CardEffects.register(1023, {
        onFlip(ctx) {
            const deck = Tavolo.mazzo(ctx.owner);
            if (!Array.isArray(deck)) { ctx.log('🐀 Nessun Deck reale in questa modalità.'); return; }
            const index = deck.findIndex((c) => c.id === 1023);
            if (index === -1) return;
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const [card] = deck.splice(index, 1);
            ctx.specialSummon(ctx.owner, card, slotIndex, 'defense', 'deck');
            for (let i = deck.length - 1; i > 0; i--) {
                const j = Math.floor(Casuale.random() * (i + 1));
                [deck[i], deck[j]] = [deck[j], deck[i]];
            }
            ctx.log('🐀 Criceto Bubbonico Special Summona una copia di sé dal Deck!');
        }
    });

    // 1024 — Bomba a Orologeria / Jigen Bakudan: dopo il FLIP, Ignition
    // attivabile SOLO durante la propria Standby Phase — si tributa da
    // sola (destroyAllMonsters include anche lei) e infligge danni pari
    // alla metà del totale ATK degli ALTRI mostri distrutti.
    CardEffects.register(1024, {
        canActivate(ctx) { return ctx.gameState.phase === 'standby'; },
        activate(ctx) {
            let totalAtk = 0;
            ctx.field(ctx.owner).forEach((slot) => {
                if (slot && slot.card.uid !== ctx.card.uid) totalAtk += DuelEngine.getEffectiveAtk(slot.card);
            });
            ctx.destroyAllMonsters(ctx.owner);
            const damage = Math.floor(totalAtk / 2);
            ctx.dealDamage(ctx.opponent, damage);
            ctx.log(`💣 Bomba a Orologeria si tributa e distrugge tutti i tuoi mostri: ${damage} danni all'avversario!`);
        }
    });

    // 1025 — L'Immortale del Tuono / The Immortal of Thunder: FLIP,
    // +3000 LP; quando lascia il Terreno per il Cimitero (onDestroy),
    // -5000 LP. SEMPLIFICAZIONE: onDestroy copre distruzione da
    // battaglia/effetto Carta, non ogni possibile "mandata al
    // Cimitero" (es. Tributo per un'Evocazione) — stesso limite già
    // accettato per altre carte con questo stesso hook in questo file.
    CardEffects.register(1025, {
        onFlip(ctx) {
            ctx.dealDamage(ctx.owner, -3000);
            ctx.log("⚡ Immortale del Tuono guadagna 3000 Life Points!");
        },
        onDestroy(ctx) {
            ctx.dealDamage(ctx.owner, 5000);
            ctx.log("⚡ Immortale del Tuono lascia il Terreno: perdi 5000 Life Points!");
        }
    });

    /**
     * Cerca 1 carta dal proprio Deck che soddisfa `matchFn` e la mette in
     * cima al Deck (deck.push — vedi drawCardsToHand in game-flow.js:
     * pop() pesca dalla FINE dell'array, quindi "in cima" = ultimo
     * elemento), oppure in mano se Necrovalley (id 890) è scoperta sul
     * Terreno — condiviso da Un Gufo Fortunato (1026)/Un Gatto di
     * Malaugurio (1027), stesso schema "tutorail al Deck o alla mano se
     * Necrovalley" del vero testo di entrambe le carte.
     */
    function searchAndPlaceOnTopOrHandIfNecrovalley(ctx, matchFn, emoji) {
        const deck = Tavolo.mazzo(ctx.owner);
        if (!Array.isArray(deck)) { ctx.log(`${emoji} Nessun Deck reale in questa modalità.`); return; }
        searchDeckWithChoice(ctx, matchFn, { title: `${emoji} Scegli una carta`, text: 'Scegli quale carta cercare nel Deck.' }, (card) => {
            const necrovalleyOnField = ['playerFieldSpell', 'botFieldSpell'].some((k) => { const fs = gameState[k]; return fs && !fs.isFaceDown && fs.card.id === 890; });
            if (necrovalleyOnField) {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`${emoji} ${card.name} trovata e aggiunta alla mano (Necrovalley scoperta)!`);
            } else {
                deck.push(card);
                ctx.log(`${emoji} ${card.name} trovata e rimessa in cima al Deck!`);
            }
        });
    }

    // 1026 — Un Gufo Fortunato / An Owl of Luck: FLIP, cerca 1 Magia
    // Campo dal Deck.
    CardEffects.register(1026, {
        onFlip(ctx) {
            searchAndPlaceOnTopOrHandIfNecrovalley(ctx, (c) => c.type === 'spell' && c.subtype === 'field', '🦉');
        }
    });

    // 1027 — Un Gatto di Malaugurio / A Cat of Ill Omen: FLIP, cerca 1
    // Trappola dal Deck.
    CardEffects.register(1027, {
        onFlip(ctx) {
            searchAndPlaceOnTopOrHandIfNecrovalley(ctx, (c) => c.type === 'trap', '🐈‍⬛');
        }
    });

    // 1028 — Manipolatore di Draghi / Dragon Manipulator: FLIP, prende
    // il controllo di 1 mostro Tipo Drago scoperto avversario fino alla
    // End Phase — ctx.takeControl senza permanent:true ha GIÀ questa
    // identica durata (processTemporaryControlReturns, chiamato in
    // enterEndPhase di game-flow.js), nessuna infrastruttura nuova.
    CardEffects.register(1028, {
        onFlip(ctx) {
            const candidati = [];
            ctx.field(ctx.opponent).forEach((slot, index) => {
                if (slot && !slot.isFaceDown && slot.card.race === 'Drago') candidati.push({ owner: ctx.opponent, index, card: slot.card });
            });
            chooseFieldMonsterTarget(ctx, candidati, {
                title: '🐉 Manipola-Draghi',
                text: 'Scegli quale mostro Drago avversario prendere sotto controllo fino alla End Phase.'
            }, (scelta) => {
                const decl = ctx.declareTarget(scelta.owner, scelta.index);
                if (!decl.allowed) return;
                ctx.takeControl(ctx.owner, decl.targetOwner, decl.targetIndex, false);
                ctx.log('🐉 Manipola-Draghi prende il controllo di un mostro Drago avversario fino alla End Phase!');
            });
        }
    });

    // 1029 — Fauci dell'Oscura Dipartita / Jowls of Dark Demise: FLIP,
    // prende il controllo di 1 mostro scoperto avversario (qualunque
    // Tipo) fino alla End Phase, stesso meccanismo di 1028 qui sopra —
    // qui in più il mostro rubato può attaccare direttamente finché
    // resta sotto controllo, via il nuovo store generico
    // gameState.grantDirectAttackWhileControlledUids (duel-engine.js:
    // riapplicato ad ogni render in recomputeStaticEffects, svuotato in
    // processTemporaryControlReturns insieme al ritorno del controllo).
    CardEffects.register(1029, {
        onFlip(ctx) {
            const candidati = [];
            ctx.field(ctx.opponent).forEach((slot, index) => {
                if (slot && !slot.isFaceDown) candidati.push({ owner: ctx.opponent, index, card: slot.card });
            });
            chooseFieldMonsterTarget(ctx, candidati, {
                title: "👹 Mascelle della Trattativa Oscura",
                text: 'Scegli quale mostro avversario prendere sotto controllo fino alla End Phase.'
            }, (scelta) => {
                const decl = ctx.declareTarget(scelta.owner, scelta.index);
                if (!decl.allowed) return;
                const stolenCard = ctx.field(decl.targetOwner)[decl.targetIndex].card;
                if (!ctx.takeControl(ctx.owner, decl.targetOwner, decl.targetIndex, false)) return;
                gameState.grantDirectAttackWhileControlledUids = gameState.grantDirectAttackWhileControlledUids || new Set();
                gameState.grantDirectAttackWhileControlledUids.add(stolenCard.uid);
                ctx.log("👹 Mascelle della Trattativa Oscura prende il controllo di un mostro avversario fino alla End Phase: può attaccare direttamente!");
            });
        }
    });

    // 1030 — Barattolo Cobra / Cobra Jar: FLIP, Special Summon di un
    // Token Serpente Velenoso (costruito a mano, non tramite
    // ctx.createTokens — quell'helper forza sempre la Posizione di
    // Difesa, qui invece il token reale entra in Posizione di Attacco).
    // "Quando il Token viene distrutto in battaglia: infliggi 500 danni
    // all'avversario": `battleDestroyedDamageToOpponent` sul Token stesso,
    // per-istanza (i Token non hanno una registrazione propria), letto da
    // fireOnDestroy in actions.js — l'unico punto da cui passa ogni
    // distruzione in battaglia, in attacco come in difesa.
    CardEffects.register(1030, {
        onFlip(ctx) {
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const token = {
                id: -1,
                uid: ctx.newTokenUid('token'),
                name: 'Token Serpente Velenoso',
                type: 'monster',
                isToken: true,
                level: 3,
                race: 'Rettile',
                attribute: 'TERRA',
                attack: 1200,
                defense: 1200,
                battleDestroyedDamageToOpponent: 500
            };
            ctx.specialSummon(ctx.owner, token, slotIndex, 'attack', 'token');
            ctx.log('🐍 Giara Cobra Special Summona un Token Serpente Velenoso!');
        }
    });

    // ================================================================
    // 1031-1038 — prima serie, quarta ondata: gli ultimi 8 Mostri Flip
    // (Legacy of Darkness/Spell Ruler/Pharaoh's Servant). Restano fuori
    // Mysterious Guard/Morphing Jar #2/Parasite Paracide/Supply,
    // genuinamente più complesse (targeting multiplo condizionale,
    // mescolamento+escavazione, carta piantata nel Deck avversario,
    // tracciamento "mandata al Cimitero come materiale di Fusione") —
    // rimandate a una battuta dedicata.
    // ================================================================

    // 1031 — Domatore d'Ombre / Shadow Tamer: FLIP, prende il controllo
    // di 1 mostro Tipo Demone avversario fino alla End Phase — stesso
    // schema di Manipolatore di Draghi (id 1028)/Fauci dell'Oscura
    // Dipartita (id 1029), solo filtrato per razza diversa.
    CardEffects.register(1031, {
        onFlip(ctx) {
            const candidati = [];
            ctx.field(ctx.opponent).forEach((slot, index) => {
                if (slot && !slot.isFaceDown && slot.card.race === 'Demone') candidati.push({ owner: ctx.opponent, index, card: slot.card });
            });
            chooseFieldMonsterTarget(ctx, candidati, {
                title: '👤 Domatore d\'Ombre',
                text: 'Scegli quale mostro Demone avversario prendere sotto controllo fino alla End Phase.'
            }, (scelta) => {
                const decl = ctx.declareTarget(scelta.owner, scelta.index);
                if (!decl.allowed) return;
                ctx.takeControl(ctx.owner, decl.targetOwner, decl.targetIndex, false);
                ctx.log('👤 Domatore d\'Ombre prende il controllo di un mostro Demone avversario fino alla End Phase!');
            });
        }
    });

    // returnSpellTrapToHand vive ora fra gli helper condivisi, in cima a
    // js/engine/card-effects.js: serve a gruppi di carte lontani fra loro,
    // quindi non può stare dentro un singolo file-parte.


    // 1032 — Uccello Tornado / Tornado Bird: FLIP, fa tornare in mano
    // fino a 2 Magie/Trappole sul Terreno (di uno o entrambi i lati) —
    // a differenza di Turbine Gigante (id 262, TUTTE le Magie/Trappole
    // di entrambi), qui il limite è 2: auto-selezionate prima dal campo
    // avversario poi dal proprio.
    CardEffects.register(1032, {
        onFlip(ctx) {
            let count = 0;
            for (const owner of [ctx.opponent, ctx.owner]) {
                const stField = ctx.stField(owner);
                for (let i = 0; i < stField.length && count < 2; i++) {
                    if (stField[i]) {
                        returnSpellTrapToHand(ctx, owner, i);
                        count++;
                    }
                }
                if (count >= 2) break;
            }
            ctx.log(`🌪️ Uccello Tornado fa tornare in mano ${count} cart${count === 1 ? 'a' : 'e'} Magia/Trappola!`);
        }
    });

    // 1033 — Scarabeo Bombardiere / Bombardment Beetle: FLIP, guarda 1
    // mostro in Difesa coperta dell'avversario; se è un Mostro Effetto
    // lo distrugge (senza farne scattare il FLIP), altrimenti lo lascia
    // dov'è. "Mostro Effetto" qui = ha una registrazione reale E non è
    // vanilla (card.vanilla), stessa convenzione già usata altrove nel
    // dataset per distinguere le due categorie.
    CardEffects.register(1033, {
        onFlip(ctx) {
            const index = ctx.field(ctx.opponent).findIndex((slot) => slot && slot.isFaceDown && slot.position === 'defense');
            if (index === -1) return;
            const card = ctx.field(ctx.opponent)[index].card;
            const isEffectMonster = !card.vanilla && !!DuelEngine.getDefinition(card.id);
            ctx.log(`🪲 Scarabeo Bombardiere rivela ${card.name}!`);
            if (isEffectMonster) {
                ctx.destroyMonster(ctx.opponent, index);
                ctx.log(`🪲 ${card.name} è un Mostro Effetto: distrutto senza attivarne il FLIP!`);
            } else {
                ctx.log(`🪲 ${card.name} non è un Mostro Effetto: resta coperto.`);
            }
        }
    });

    // 1034 — Invasore del Trono / Invader of the Throne: FLIP, scambia
    // PERMANENTEMENTE il controllo con 1 mostro avversario (mai se
    // girata scoperta durante la Battle Phase, es. attaccata mentre
    // coperta) — due chiamate a ctx.takeControl con permanent:true (a
    // differenza di Domatore d'Ombre/Manipolatore di Draghi qui sopra,
    // "switch control" non torna mai da solo a fine turno).
    CardEffects.register(1034, {
        onFlip(ctx) {
            if (ctx.gameState.phase === 'battle') return;
            const myIndex = ctx.field(ctx.owner).findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
            if (myIndex === -1) return;
            const candidati = [];
            ctx.field(ctx.opponent).forEach((slot, index) => {
                if (slot && !slot.isFaceDown) candidati.push({ owner: ctx.opponent, index, card: slot.card });
            });
            chooseFieldMonsterTarget(ctx, candidati, {
                title: '🏰 Invasore del Trono',
                text: 'Scegli con quale mostro avversario scambiare il controllo.'
            }, (scelta) => {
                const decl = ctx.declareTarget(scelta.owner, scelta.index);
                if (!decl.allowed) return;
                const theirCard = ctx.field(decl.targetOwner)[decl.targetIndex].card;
                ctx.takeControl(ctx.owner, decl.targetOwner, decl.targetIndex, true);
                ctx.takeControl(decl.targetOwner, ctx.owner, myIndex, true);
                ctx.log(`🏰 Invasore del Trono scambia il controllo con ${theirCard.name}!`);
            });
        }
    });

    // 1035 — Bollettino Meteo / Weather Report: FLIP, distrugge ogni
    // "Spada Rivelatrice" (id 8) scoperta dell'avversario, passando da
    // ctx.destroySpellTrap (prima era uno spostamento a mano nel Cimitero,
    // che saltava ogni reazione alla distruzione). Se ne distrugge almeno
    // una, "puoi eseguire la Battle Phase due volte in questo turno (o nel
    // tuo prossimo, se attivata durante il turno avversario)" —
    // gameState.extraBattlePhase, letto da canConductSecondBattlePhase/
    // startSecondBattlePhase in game-flow.js (stepper per il giocatore,
    // botTurn per il bot). Testo verificato su YGOPRODeck.
    CardEffects.register(1035, {
        onFlip(ctx) {
            let count = 0;
            ctx.stField(ctx.opponent).forEach((slot, i) => {
                if (slot && !slot.isFaceDown && slot.card.id === 8) {
                    ctx.destroySpellTrap(ctx.opponent, i);
                    count++;
                }
            });
            if (count === 0) return;
            const turnoDellaBattaglia = gameState.currentPlayer === ctx.owner ? gameState.turn : gameState.turn + 1;
            gameState.extraBattlePhase = { owner: ctx.owner, turn: turnoDellaBattaglia, used: false };
            ctx.log(`🌦️ Previsioni Meteo distrugge ${count} Spada Rivelatrice: ${gameState.currentPlayer === ctx.owner ? 'in questo turno' : 'nel prossimo turno'} la Battle Phase si può condurre due volte!`);
        }
    });

    // 1036 — Lanciere Sciocco / Spear Cretin: quando questa carta viene
    // distrutta DOPO essere stata girata scoperta (onDestroy scatta
    // solo per una carta già in campo, quindi copre esattamente questo
    // caso), entrambi i giocatori Special Summonano 1 mostro dal proprio
    // Cimitero — ora una vera scelta per ciascun lato
    // (searchGraveyardWithChoice), non più sempre il primo trovato.
    // SEMPLIFICAZIONE residua (vedi missingEffectNote): sempre scoperto
    // in Attacco, mai la Difesa coperta.
    CardEffects.register(1036, {
        // Ogni lato sceglie il PROPRIO mostro da rianimare (searchGraveyardWithChoice
        // apre un picker per il giocatore umano solo se ctx.owner === 'player'
        // — qui il chooser di ogni iterazione è `owner`, non
        // ctx.owner/controllore di questa carta, quindi serve un ctx
        // dedicato per il lato che non coincide con ctx.owner, stesso
        // pattern "opponentCtx" già usato per Gilasaurus id 266).
        onDestroy(ctx) {
            // Bug reale trovato scrivendo il test di questa correzione:
            // destroyMonster (duel-engine.js) manda GIÀ questa stessa carta
            // (Lanciere Sciocco) al Cimitero PRIMA di sparare onDestroy —
            // il filtro deve escludere ctx.card.uid, altrimenti sul lato
            // ctx.owner (dove risiede Lanciere Sciocco stesso) risulterebbero
            // 2 "candidati" invece di 1 (se stessa + il vero mostro da
            // rianimare), aprendo inutilmente un picker con una scelta
            // fasulla invece di auto-selezionare l'unico vero candidato.
            Tavolo.ordine().forEach((owner) => {
                if (ctx.findEmptyMonsterSlot(owner) === -1) return;
                const ownerCtx = owner === ctx.owner ? ctx : DuelEngine.makeContext(owner, {});
                searchGraveyardWithChoice(ownerCtx, owner, (c) => c.type === 'monster' && c.uid !== ctx.card.uid, {
                    title: '💀 Lancia Demente',
                    text: 'Scegli quale mostro Special Summonare dal Cimitero.'
                }, (card) => {
                    // "scoperto in Attacco O coperto in Difesa": e' la
                    // seconda meta' della scelta, e cambia parecchio —
                    // rianimare coperto in Difesa nasconde la carta e ne
                    // riarma l'eventuale effetto FLIP. openPositionPicker
                    // offre esattamente questa coppia. Il bot resta
                    // sull'Attacco di sempre.
                    const completa = (position) => {
                        const slotIndex = ctx.findEmptyMonsterSlot(owner);
                        if (slotIndex === -1) { ctx.graveyard(owner).push(card); return; }
                        ctx.specialSummon(owner, card, slotIndex, position, 'graveyard');
                        ctx.log(`💀 Lancia Demente fa Special Summonare ${card.name} (${owner === 'player' ? 'tuo' : 'del bot'}) dal Cimitero!`);
                    };
                    if (!Decisioni.rispondeUnaPersona(owner)) { completa('attack'); return; }
                    Decisioni.chiedi({
                        chi: owner,
                        tipo: 'posizione',
                        titolo: `${card.name}: in che Posizione?`
                    }, (scelta) => {
                        if (scelta === null) return;
                        completa(scelta);
                    });
                });
            });
        }
    });

    // 1037 — Assalitrice delle Fiamme / Lady Assailant of Flames: FLIP,
    // bandisce le prime 3 carte del proprio Deck (splice(-3,3): "in
    // cima" = fine dell'array, vedi drawCardsToHand in game-flow.js) e
    // infligge 800 danni.
    CardEffects.register(1037, {
        onFlip(ctx) {
            const deck = Tavolo.mazzo(ctx.owner);
            if (!Array.isArray(deck)) { ctx.log('🔥 Nessun Deck reale in questa modalità.'); return; }
            const banished = deck.splice(-3, 3);
            banished.forEach((c) => ctx.banish(ctx.owner, c));
            ctx.dealDamage(ctx.opponent, 800);
            ctx.log(`🔥 Signora Assaltatrice delle Fiamme bandisce ${banished.length} cart${banished.length === 1 ? 'a' : 'e'} e infligge 800 danni!`);
        }
    });

    // 1038 — Evocatore di Illusioni / Summoner of Illusions: FLIP,
    // tributa 1 altro mostro (scritto a mano, stesso schema di
    // Artigliere dei Guardiani della Tomba id 896) e Special Summon 1
    // Mostro Fusione dall'Extra Deck (ignora del tutto i materiali
    // richiesti, come da testo reale), distrutto in End Phase tramite
    // ctx.grantTemporaryAtkDefBonus(..., destroyAfter:true) — stesso
    // meccanismo già usato per bonus "fino a fine turno" con
    // distruzione programmata (es. Rimozione del Limitatore id 350),
    // qui riusato con bonus nullo solo per la scadenza programmata.
    // SEMPLIFICAZIONE (vedi missingEffectNote): Mostro Fusione
    // auto-selezionato (il primo nell'Extra Deck).
    CardEffects.register(1038, {
        onFlip(ctx) {
            const extraDeck = Tavolo.extraDeck(ctx.owner);
            if (!Array.isArray(extraDeck) || extraDeck.length === 0) return;
            // Il Sigillo di Orichalcos (id 469): niente Extra Deck, e quindi
            // nessun Tributo da pagare a vuoto.
            if (DuelEngine.isExtraDeckSummonBlocked(ctx.owner)) return;
            const sacrificabili = collectFieldTargets(ctx, {
                zone: 'monster', owner: 'self', includiCoperte: true,
                filter: (card) => card.uid !== ctx.card.uid
            });
            if (sacrificabili.length === 0) return;
            // Due scelte in fila, la seconda dentro la callback della
            // prima: quale mostro cedere e quale Fusione tirare fuori. La
            // seconda e' quella che conta di piu' — l'Extra Deck puo'
            // contenere mostri di potenza molto diversa, e prima usciva
            // sempre il primo.
            chooseFieldCardTarget(ctx, sacrificabili, {
                title: '🎭 Evocatore di Illusioni',
                text: 'Scegli quale tuo mostro tributare.'
            }, (scelto) => {
                const tributeSlot = ctx.field(ctx.owner)[scelto.index];
                if (!tributeSlot || tributeSlot.card.uid !== scelto.card.uid) return;
                chooseCardFromList(ctx, extraDeck.slice(), {
                    title: '🎭 Evocatore di Illusioni',
                    text: 'Scegli quale Mostro Fusione Special Summonare dall\'Extra Deck.'
                }, (fusionCard) => {
                    // Indici ricalcolati ORA: fra i due picker il Terreno e
                    // l'Extra Deck possono essere cambiati.
                    const fusionIndex = extraDeck.findIndex((c) => c.uid === fusionCard.uid);
                    if (fusionIndex === -1) return;
                    const tributeIndex = ctx.field(ctx.owner).findIndex((s) => s && s.card.uid === scelto.card.uid);
                    if (tributeIndex === -1) return;
                    const tributedCard = ctx.field(ctx.owner)[tributeIndex].card;
                    ctx.graveyard(ctx.owner).push(tributedCard);
                    ctx.field(ctx.owner)[tributeIndex] = null;
                    extraDeck.splice(fusionIndex, 1);
                    ctx.specialSummon(ctx.owner, fusionCard, tributeIndex, 'attack', 'extra');
                    ctx.grantTemporaryAtkDefBonus(fusionCard, 0, 0, true);
                    ctx.log(`🎭 Evocatore di Illusioni tributa ${tributedCard.name} e Special Summona ${fusionCard.name} dall'Extra Deck (distrutto in End Phase)!`);
                });
            });
        }
    });

    // ================================================================
    // 1039-1045 — prima serie, quinta ondata: 4 Mostri Effetto propedeutici
    // (materiali di Fusione) + 3 Mostri Fusione che li usano. A differenza
    // delle Fusioni vanilla di questo backlog (rimandate: richiederebbero
    // aggiungere anche i LORO materiali, mostri vanilla minori mai
    // prioritari per questo dataset), questi 3 hanno un vero effetto
    // proprio che giustifica implementarli subito insieme ai materiali
    // mancanti — vedi missingEffectNote su ciascuno per i limiti onesti.
    // ================================================================

    // 1039 — Saggio della Frontiera / Frontier Wiseman: "nega gli effetti
    // Magia che scelgono come bersaglio un tuo mostro Tipo Guerriero, e
    // se lo fai, distruggi quella Magia" — nuovo floodgate
    // def.protectsOwnRaceFromSpellTargeting (duel-engine.js,
    // declareCardEffectTarget), gemello più ristretto del già esistente
    // protectsRaceFromTargeting (Signore dei D. id 353: protegge
    // un'intera razza su ENTRAMBI i campi da OGNI effetto Carta) — qui
    // solo i PROPRI mostri Guerriero, solo da Magie. La "distruzione
    // della Magia" è già il comportamento naturale per una Magia
    // Normale (va comunque al Cimitero dopo la risoluzione, riuscita o
    // no); per una Magia Continua/Equip bloccata sul nascere resta una
    // SEMPLIFICAZIONE minore (nessuna carta di questo dataset la
    // Sacrifica esplicitamente).
    CardEffects.register(1039, {
        protectsOwnRaceFromSpellTargeting: 'Guerriero'
    });

    // 1040 — Drago della Caverna / Cave Dragon: due restrizioni.
    //  - "Non può essere Evocata Normalmente se controlli già un mostro":
    //    def.canNormalSummon (DuelEngine.normalSummonBlockReason, letto
    //    dall'Evocazione del giocatore e dall'IA). Conta qualunque mostro,
    //    anche coperto: "controlli" non distingue.
    //  - "Non può dichiarare un attacco a meno che tu non controlli un altro
    //    mostro Tipo Drago": def.canDeclareAttack (resolveAttack, bot.js).
    //    Il Drago dev'essere scoperto, perché il Tipo di una carta coperta
    //    non si conosce.
    CardEffects.register(1040, {
        canNormalSummon(ctx) {
            return !ctx.field(ctx.owner).some((s) => !!s);
        },
        canDeclareAttack(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.uid !== ctx.card.uid && s.card.race === 'Drago');
        }
    });

    // 1041 — Demone Minore / Lesser Fiend: "bandisci ogni mostro che
    // questa carta distrugge in battaglia" — riusa il già esistente
    // def.onDestroysMonsterByBattle (dodicesima ondata) invece del
    // "marca PRIMA dell'attacco" ipotizzato dalla nota originale: quel
    // hook fira DOPO che il mostro distrutto è già nel Cimitero del suo
    // proprietario, quindi basta redirigerlo da lì con
    // ctx.banishFromGraveyard (già generico, rispetta Necrovalley id 890)
    // invece di anticipare un flag prima ancora di sapere se l'attacco
    // andrà a segno. La clausola "trattata come Arcidemone" resta
    // inerte: nessuna carta di questo dataset la cerca per nome/razza
    // dichiarata.
    CardEffects.register(1041, {
        onDestroysMonsterByBattle(ctx) {
            ctx.banishFromGraveyard(ctx.destroyedCardOwner, ctx.destroyedCard);
        }
    });

    // 1042 — Maryokutai: Effetto Veloce dalla zona Mostro, attivabile
    // SOLO durante il turno dell'avversario, in risposta a una Magia
    // sulla Chain — stesso meccanismo di Effetto Veloce da campo già
    // usato da Ninja d'Assalto (id 459)/Spadaccino Mistico LV6 (id 865),
    // combinato con ctx.negateActivation() già esistente (nato per
    // Giudizio Solenne id 448) per negare l'attivazione in cima alla
    // Chain — nessuna infrastruttura nuova, solo una combinazione di due
    // meccanismi già pronti mai usati insieme prima.
    CardEffects.register(1042, {
        canRespondAsQuickEffect: true,
        canActivate(ctx) {
            if (ctx.owner === ctx.gameState.currentPlayer) return false; // solo durante il turno dell'AVVERSARIO
            const chain = ctx.gameState.chain;
            if (!chain || !chain.links || chain.links.length === 0) return false;
            const top = chain.links[chain.links.length - 1];
            return !!(top.card && top.card.type === 'spell' && !top.negated);
        },
        activate(ctx) {
            const index = ctx.field(ctx.owner).findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.field(ctx.owner)[index] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            if (ctx.negateActivation()) {
                ctx.log('🌊 Maryokutai si tributa e nega l\'attivazione della Magia avversaria!');
            }
        }
    });

    // 1043 — Balter Oscuro il Terribile / Dark Balter the Terrible
    // (Fusione di 1039+405): stesso Effetto Veloce di Maryokutai qui
    // sopra (canRespondAsQuickEffect + negateActivation), ma per
    // qualunque Magia Normale (non solo durante il turno avversario) e
    // pagando 1000 LP invece di tributarsi. Gli effetti dei mostri che
    // distrugge in battaglia vengono annullati con
    // def.negatesEffectsOfBattleVictims (fireOnDestroy, actions.js), in
    // attacco come in difesa.
    CardEffects.register(1043, {
        fusionMaterials: [405, 1039],
        negatesEffectsOfBattleVictims: true,
        canRespondAsQuickEffect: true,
        canActivate(ctx) {
            const chain = ctx.gameState.chain;
            if (!chain || !chain.links || chain.links.length === 0) return false;
            const top = chain.links[chain.links.length - 1];
            return !!(top.card && top.card.type === 'spell' && top.card.subtype === 'normal' && !top.negated);
        },
        activate(ctx) {
            ctx.dealDamage(ctx.owner, 1000);
            if (ctx.negateActivation()) {
                ctx.log('👹 Balter Oscuro il Terribile paga 1000 LP e nega la Magia Normale!');
            }
        }
    });

    // 1044 — Drago Teschio Demoniaco / Fiend Skull Dragon (Fusione di
    // 1040+1041): nega ogni effetto FLIP mentre è scoperta
    // (gameState.flipEffectsGloballyNegated, nuovo floodgate globale —
    // vedi il commento su recomputeStaticEffects in duel-engine.js);
    // nega e distrugge le Trappole che la scelgono come bersaglio, via
    // il checkpoint di targeting condiviso (stesso schema di Gran Scudo
    // Gardna id 115, qui senza bisogno di girarsi scoperta perché già
    // lo è).
    CardEffects.register(1044, {
        fusionMaterials: [1040, 1041],
        static(ctx) {
            gameState.flipEffectsGloballyNegated = true;
        },
        onCardEffectTargetDeclare(ctx) {
            if (!ctx.sourceCard || ctx.sourceType !== 'trap') return;
            ctx.cancel();
            const trapOwner = ctx.sourceOwner;
            const trapIndex = ctx.stField(trapOwner).findIndex((slot) => slot && slot.card.uid === ctx.sourceCard.uid);
            if (trapIndex !== -1) ctx.destroySpellTrap(trapOwner, trapIndex);
            ctx.log(`🐲 Drago Teschio-Demone nega e distrugge ${ctx.sourceCard.name}!`);
        }
    });

    // 1045 — L'Ultimo Guerriero di un Altro Pianeta / The Last Warrior
    // from Another Planet (Fusione di 625+1042): se Special Summonata,
    // distrugge tutti gli altri mostri che il proprietario controlla e
    // impedisce ogni Special Summon ad entrambi i giocatori
    // (gameState.specialSummonBlockedFor, per ENTRAMBI i lati). Il testo
    // parla solo di Special Summon: l'Evocazione Normale/Set resta libera.
    CardEffects.register(1045, {
        fusionMaterials: [625, 1042],
        onSummon(ctx) {
            if (ctx.summonedVia !== 'special') return;
            let count = 0;
            ctx.field(ctx.owner).forEach((slot, index) => {
                if (slot && slot.card.uid !== ctx.card.uid) {
                    ctx.destroyMonster(ctx.owner, index);
                    count++;
                }
            });
            ctx.log(`🌌 L'Ultimo Guerriero da un Altro Pianeta distrugge ${count} altr${count === 1 ? 'o mostro' : 'i mostri'}!`);
        },
        // gameState.otherMonsterSummonsBlockedFor viene azzerato e
        // ricalcolato ad OGNI render (recomputeStaticEffects,
        // duel-engine.js) — impostarlo in onSummon (una tantum) verrebbe
        // subito perso al render successivo. static() lo mantiene vero
        // finché questa carta resta scoperta sul Terreno, per ENTRAMBI i
        // lati (a differenza di Guardiano Falce del Terrore id 282, che
        // blocca solo il proprio controllore).
        static(ctx) {
            // SOLO le Special Summon (specialSummonBlockedFor), come da
            // testo: l'Evocazione Normale/Set resta libera per entrambi.
            // Prima usava otherMonsterSummonsBlockedFor (il flag di 282),
            // che blocca anche quella — più del testo.
            gameState.specialSummonBlockedFor.player = true;
            gameState.specialSummonBlockedFor.bot = true;
        }
    });

    // ================================================================
    // SESTA ONDATA PRIMA SERIE (id 1046-1059) — 14 Mostri Effetto minori.
    // ================================================================

    // 1046 — Ameba: quando il controllo di questa carta scoperta passa
    // all'avversario, infligge 2000 danni — una volta sola finché resta
    // scoperta (ctx.card.controlSwapEffectUsed, flag PER-ISTANZA diretto
    // sull'oggetto carta: si azzera da solo se una nuova copia viene
    // pescata, nessuno store condiviso necessario per un "una volta"
    // legato alla singola copia fisica). Usa il nuovo hook condiviso
    // def.onControlChangedToOpponent (ACTIONS.takeControl,
    // duel-engine.js) — ctx.owner è già chi ADESSO controlla la carta
    // (il "tuo" del testo), ctx.opponent il proprietario originale (il
    // "tuo avversario" del testo).
    CardEffects.register(1046, {
        onControlChangedToOpponent(ctx) {
            if (ctx.card.controlSwapEffectUsed) return;
            ctx.card.controlSwapEffectUsed = true;
            ctx.dealDamage(ctx.opponent, 2000);
            ctx.log('🟢 Ameba infligge 2000 danni quando il suo controllo passa!');
        }
    });

    // 1047 — Griggle: stesso hook di Ameba (1046), ma guadagna 3000 Life
    // Points invece di infliggere danno.
    CardEffects.register(1047, {
        onControlChangedToOpponent(ctx) {
            if (ctx.card.controlSwapEffectUsed) return;
            ctx.card.controlSwapEffectUsed = true;
            ctx.dealDamage(ctx.owner, -3000);
            ctx.log('🟡 Griggle guadagna 3000 Life Points quando il suo controllo passa!');
        }
    });

    // 1048 — Serpente Elettrico / Electric Snake: scartata dalla mano da
    // un effetto di una carta dell'avversario (ctx.discardedByOwner,
    // stesso discriminatore già usato da Re Neko Mane id 393) — pesca 2.
    CardEffects.register(1048, {
        onSentToGraveyardFromHand(ctx) {
            if (ctx.discardedByOwner !== ctx.opponent) return;
            ctx.drawCards(ctx.owner, 2);
            ctx.log('⚡ Serpente Elettrico pesca 2 carte!');
        }
    });

    // 1049 — La Fanciulla Infelice / The Unhappy Maiden: mandata al
    // Cimitero IN BATTAGLIA (onDestroy scatta comunque anche per un
    // effetto Carta, ma il testo reale copre solo la battaglia — nessun
    // discriminatore esplicito serve qui perché onDestroy da solo non
    // basta: usiamo ctx.destroyedByOwner === undefined && il fatto che
    // la carta sia stata rimossa da una battaglia si riconosce dalla
    // presenza di ctx.destroyedByOpponentCard OPPURE dal danno sul
    // proprio attacco. Per semplicità e coerenza con Nave di Yomi/1057
    // sotto, verifichiamo semplicemente che sia stata una battaglia
    // tramite lo stesso ctx.destroyedByOpponentCard — se assente
    // (distrutta da un effetto Carta, anche proprio), non scatta).
    // ctx.endBattlePhase() è lo stesso helper già usato da Nega Attacco
    // (id 820)/Tartaruga Elettromagnetica (id 223).
    CardEffects.register(1049, {
        onDestroy(ctx) {
            if (!ctx.destroyedByOpponentCard) return;
            ctx.endBattlePhase();
            ctx.log('😢 La Fanciulla Infelice termina immediatamente la Battle Phase!');
        }
    });

    // 1050 — Drago della Truppa / Troop Dragon: distrutto in battaglia,
    // Special Summon un'altra copia dal Deck — stesso schema di Bebè
    // Cerasauro (id 809): ctx.findEmptyMonsterSlot + splice dal Deck.
    CardEffects.register(1050, {
        onDestroy(ctx) {
            if (!ctx.destroyedByOpponentCard) return;
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            if (!Array.isArray(deck)) return;
            const index = deck.findIndex((c) => c.id === 1050);
            if (index === -1) return;
            const card = deck.splice(index, 1)[0];
            gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
            ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
            ctx.log('🐉 Truppa-Drago Special Summona un\'altra copia dal Deck!');
        }
    });

    // 1051 — Momonga Agile / Nimble Momonga: distrutto in battaglia,
    // guadagna 1000 LP (ctx.dealDamage negativo) poi Special Summon un
    // numero qualsiasi di altre copie dal Deck in Posizione di Difesa
    // COPERTA (ctx.specialSummon(..., 'defense', 'deck') imposta da solo
    // isFaceDown=true per la posizione 'defense', vedi ACTIONS.specialSummon
    // in duel-engine.js) — ripete finché ci sono sia slot liberi sia
    // copie nel Deck.
    CardEffects.register(1051, {
        onDestroy(ctx) {
            if (!ctx.destroyedByOpponentCard) return;
            ctx.dealDamage(ctx.owner, -1000);
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            if (!Array.isArray(deck)) return;
            let summoned = 0;
            let slotIndex;
            while ((slotIndex = ctx.findEmptyMonsterSlot(ctx.owner)) !== -1) {
                const index = deck.findIndex((c) => c.id === 1051);
                if (index === -1) break;
                const card = deck.splice(index, 1)[0];
                gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
                ctx.specialSummon(ctx.owner, card, slotIndex, 'defense', 'deck');
                summoned++;
            }
            ctx.log(`🐿️ L'Agile Momonga guadagna 1000 Life Points${summoned > 0 ? ` e Special Summona altre ${summoned} copie coperte dal Deck` : ''}!`);
        }
    });

    // 1052 — Des Lacooda: Ignition una volta per turno (ctx.hasUsedOncePerTurn/
    // markUsedOncePerTurn, stesso idioma già usato da decine di altre
    // carte in questo file) per coprirsi da solo in Posizione di Difesa;
    // quando Evocata Flip (onFlip), pesca 1 carta.
    CardEffects.register(1052, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot || slot.isFaceDown) return false;
            if (ctx.hasUsedOncePerTurn(`1052:${ctx.card.uid}`)) return false;
            return true;
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`1052:${ctx.card.uid}`);
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot) return;
            slot.isFaceDown = true;
            slot.position = 'defense';
            ctx.log('🐫 Des Lacooda si copre in Posizione di Difesa!');
        },
        onFlip(ctx) {
            ctx.drawCards(ctx.owner, 1);
            ctx.log('🐫 Des Lacooda, Evocato Flip: pesca 1 carta!');
        }
    });

    // 1053 — Cavallo dell'Incubo / Nightmare Horse: può attaccare
    // direttamente SEMPRE, nessuna condizione (gameState.directAttackAllowedUids,
    // stesso schema incondizionato di Folletto della Fiamma Furente id 681).
    CardEffects.register(1053, {
        static(ctx) {
            gameState.directAttackAllowedUids[ctx.card.uid] = true;
        }
    });

    // 1054 — Tirapiedi Alato / Winged Minion: si tributa da solo, sceglie
    // 1 mostro Demone scoperto e gli dà +700/+700 finché resta scoperto —
    // mutazione diretta e permanente delle statistiche, stessa
    // convenzione già usata altrove in questo motore (es. Drago Berserk
    // id 110) per un bonus "finché resta scoperto" senza uno store
    // dedicato a scadenza. Tirapiedi Alato è ESSO STESSO un mostro Tipo
    // Demone: `i !== ctx.index` lo esclude dai propri candidati (stesso
    // accorgimento di Spadaccino di Fiamma Blu id 122) — nel gioco reale
    // il Tributo è un COSTO pagato prima che l'effetto si risolva, quindi
    // la carta non è più sul Terreno quando si sceglie il bersaglio.
    CardEffects.register(1054, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            return ctx.field(ctx.owner).some((s, i) => s && i !== ctx.index && !s.isFaceDown && s.card.race === 'Demone');
        },
        activate(ctx) {
            const candidati = collectFieldTargets(ctx, {
                zone: 'monster', owner: 'self',
                filter: (card) => card.uid !== ctx.card.uid && card.race === 'Demone'
            });
            if (candidati.length === 0) return;
            // Il bersaglio passa dal checkpoint di targeting. Il Tributo di
            // questa carta (il costo) si paga dentro la callback: se il
            // bersaglio si sottrae, non si perde la carta per niente.
            chooseFieldCardTarget(ctx, candidati, {
                title: '👹 Servo Alato',
                text: 'Scegli 1 mostro Demone scoperto a cui dare +700 ATK/DEF (questa carta si tributa).',
                dichiara: true
            }, (scelto) => {
                const selfSlot = ctx.field(ctx.owner)[ctx.index];
                if (!selfSlot || selfSlot.card.uid !== ctx.card.uid) return;
                const target = scelto.card;
                ctx.field(ctx.owner)[ctx.index] = null;
                ctx.graveyard(ctx.owner).push(ctx.card);
                target.attack += 700;
                target.defense += 700;
                ctx.log(`👹 Servo Alato si tributa: ${target.name} guadagna 700 ATK/DEF!`);
            });
        }
    });

    // 1055 — Samurai Sasuke / Sasuke Samurai: testo identico a Paladino
    // del Drago Bianco (id 398)/Spadaccino Mistico LV2 (id 718) — riusa
    // lo stesso flag condiviso invece di reinventarlo.
    CardEffects.register(1055, {
        instantlyDestroysFaceDownDefender: true
    });

    // 1056 — Servitore del Catabolismo / Servant of Catabolism: attacco
    // diretto incondizionato, stesso schema di 1053 sopra.
    CardEffects.register(1056, {
        static(ctx) {
            gameState.directAttackAllowedUids[ctx.card.uid] = true;
        }
    });

    // 1057 — Nave di Yomi / Yomi Ship: distrutta in battaglia, distrugge
    // chi l'ha distrutta (ctx.destroyedByOpponentCard è già la carta
    // avversaria coinvolta nello scontro, popolato solo per una
    // distruzione da BATTAGLIA — vedi fireOnDestroy in actions.js).
    // SEMPLIFICAZIONE: se il mostro attaccante è già stato rimosso dal
    // campo (es. da un altro effetto simultaneo), non c'è nulla da
    // distruggere — nessuna carta di questo motore prevede oggi quel
    // caso per una ritorsione di questo tipo.
    CardEffects.register(1057, {
        onDestroy(ctx) {
            if (!ctx.destroyedByOpponentCard) return;
            const field = ctx.field(ctx.opponent);
            const index = field.findIndex((s) => s && s.card.uid === ctx.destroyedByOpponentCard.uid);
            if (index === -1) return;
            ctx.destroyMonster(ctx.opponent, index);
            ctx.log(`🚢 Nave Yomi distrugge ${ctx.destroyedByOpponentCard.name} per ritorsione!`);
        }
    });

    // 1058 — Tuorlo Mucoso / Mucus Yolk: attacco diretto incondizionato
    // (come 1053/1056) + ogni volta che infligge danno da battaglia,
    // +1000 ATK "durante la tua prossima Standby Phase" — nuovo store
    // condiviso e generico gameState.pendingStandbyAtkBuffs (array di
    // {uid, owner, amount}, duel-engine.js/processPendingStandbyAtkBuffs,
    // agganciato in enterStandbyPhase() come processKiseitaiLifeGain già
    // esistente) invece di un campo specifico per questa sola carta —
    // riusabile da qualunque futura carta con lo stesso identico
    // schema "guadagna ATK alla PROSSIMA Standby Phase del controllore".
    CardEffects.register(1058, {
        static(ctx) {
            gameState.directAttackAllowedUids[ctx.card.uid] = true;
        },
        onDealsBattleDamage(ctx) {
            if (ctx.targetIndex !== -1) return;
            gameState.pendingStandbyAtkBuffs = gameState.pendingStandbyAtkBuffs || [];
            gameState.pendingStandbyAtkBuffs.push({ uid: ctx.card.uid, owner: ctx.owner, amount: 1000 });
            ctx.log('🥚 Tuorlo Mucoso guadagnerà 1000 ATK alla sua prossima Standby Phase!');
        }
    });

    // 1059 — Amuleto di Shabti / Charm of Shabti: "durante il turno di uno
    // dei due giocatori: puoi scartare questa carta; fino alla End Phase, i
    // mostri Guardiani della Tomba che controlli non possono essere
    // distrutti in battaglia". Tre momenti in cui il motore la offre:
    //  - dalla MANO quando l'avversario dichiara un attacco contro un tuo
    //    Guardiano della Tomba (onAttackDeclare: findTriggerCandidates guarda
    //    anche la mano, come per Kuriboh; consumeCandidateCard la scarta) —
    //    è il momento in cui l'effetto serve davvero;
    //  - dalla mano nella tua Main Phase, cliccandola (activate: activateCard
    //    scarta da sé un mostro attivato dalla mano, come Thunder Dragon);
    //  - dalla mano durante la Battle Phase avversaria (il terzo, più sotto).
    // La protezione è gameState.battleProtectionByName, letta da
    // cardIsIndestructibleByBattle in actions.js.
    const eGuardianoDellaTomba = (card) => !!(card && card.name && card.name.includes('Guardiani della Tomba'));
    function amuletoDiShabti(ctx) {
        gameState.battleProtectionByName = (gameState.battleProtectionByName || []).filter((p) => p.turn === gameState.turn);
        gameState.battleProtectionByName.push({ owner: ctx.owner, turn: gameState.turn, nameIncludes: 'Guardiani della Tomba' });
        ctx.log('🏺 Malia di Shabti: fino alla End Phase i tuoi Guardiani della Tomba non possono essere distrutti in battaglia!');
    }
    // Terzo momento: Effetto Veloce dalla MANO durante la Battle Phase
    // dell'avversario (canRespondFromHand/activateFromHand), sia in risposta
    // a una Catena sia nella finestra di priorità all'inizio della sua
    // Battle Phase (DuelEngine.openPriorityWindow). Ristretto alla Battle
    // Phase avversaria, e a quando la protezione non è già attiva: fuori da
    // lì l'effetto non protegge da niente, e offrirlo a ogni Catena
    // vorrebbe dire sprecarlo.
    const giaProtetto = (owner) => (gameState.battleProtectionByName || [])
        .some((p) => p.owner === owner && p.turn === gameState.turn && p.nameIncludes === 'Guardiani della Tomba');
    CardEffects.register(1059, {
        canActivate(ctx) {
            const campo = ctx.field(ctx.owner);
            if (typeof ctx.attackerIndex === 'number') {
                const bersaglio = campo[ctx.targetIndex];
                return !!(bersaglio && eGuardianoDellaTomba(bersaglio.card));
            }
            return campo.some((s) => s && !s.isFaceDown && eGuardianoDellaTomba(s.card));
        },
        activate(ctx) { amuletoDiShabti(ctx); },
        onAttackDeclare(ctx) { amuletoDiShabti(ctx); },
        canRespondFromHand: true,
        canActivateFromHand(ctx) {
            if (gameState.phase !== 'battle' || gameState.currentPlayer === ctx.owner) return false;
            if (giaProtetto(ctx.owner)) return false;
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && eGuardianoDellaTomba(s.card));
        },
        activateFromHand(ctx) { amuletoDiShabti(ctx); },
        // Il bot la usa all'inizio della Battle Phase avversaria: è proprio
        // il momento per cui esiste (canActivateFromHand fa già il resto).
        botInFinestraDiPriorita: true
    });

    // ================================================================
    // SETTIMA ONDATA PRIMA SERIE (id 1060-1066) — 7 Mostri Effetto minori.
    // ================================================================

    // 1060 — Insetto dalle 8 Chele (Arsenal Bug): se non controlli altri
    // mostri Tipo Insetto, ATK/DEF diventano 1000 (base 2000/2000) —
    // gameState.atkDefBonus (bonus/malus DELTA sommato alla base, stesso
    // store condiviso già usato da decine di Magie Equipaggiamento in
    // questo file, es. Ciondolo Nero id 117), qui applicato come -1000
    // condizionale invece che come equip fisso.
    CardEffects.register(1060, {
        static(ctx) {
            const hasOtherInsect = ctx.field(ctx.owner).some((s) => s && s.card.uid !== ctx.card.uid && s.card.race === 'Insetto');
            if (!hasOtherInsect) {
                const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
                gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk - 1000, def: e.def - 1000 };
            }
        }
    });

    // 1061 — Shock di Byser (Byser Shock): quando Evocata (Normale o
    // Special, def.onSummon copre entrambe — vedi fireTrigger,
    // duel-engine.js), fa tornare in mano OGNI carta coperta sul
    // Terreno, di ENTRAMBI i giocatori — riusa returnSpellTrapToHand
    // (helper condiviso già esistente in questo file, nato per Turbine
    // Gigante id 262).
    CardEffects.register(1061, {
        onSummon(ctx) {
            Tavolo.ordine().forEach((owner) => {
                const st = ctx.stField(owner);
                for (let i = st.length - 1; i >= 0; i--) {
                    if (st[i] && st[i].isFaceDown) returnSpellTrapToHand(ctx, owner, i);
                }
            });
            ctx.log('👹 Shock di Byser fa tornare in mano tutte le carte coperte sul Terreno!');
        }
    });

    // 1062 — Sparajongler Esplosivo (Blast Juggler): attivabile SOLO
    // durante la propria Standby Phase, si tributa da sola per
    // distruggere 2 mostri scoperti con ATK 1000 o meno (di uno o
    // entrambi i lati) — sceglie una carta alla volta con
    // ctx.destroyTargetedMonster (checkpoint di targeting condiviso),
    // ricalcolando i candidati dopo ogni scelta (un bersaglio già
    // scelto/distrutto non può essere ripescato per il secondo).
    CardEffects.register(1062, {
        canActivate(ctx) {
            return gameState.phase === 'standby' && gameState.currentPlayer === ctx.owner;
        },
        activate(ctx) {
            const ownIndex = ctx.index;
            ctx.field(ctx.owner)[ownIndex] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            const gatherCandidates = () => {
                const list = [];
                Tavolo.ordine().forEach((owner) => {
                    ctx.field(owner).forEach((s, i) => {
                        if (s && !s.isFaceDown && (s.card.attack || 0) <= 1000) list.push({ owner: owner, index: i, card: s.card });
                    });
                });
                return list;
            };
            const destroyOne = (entry) => {
                const result = ctx.destroyTargetedMonster(entry.owner, entry.index);
                if (result.allowed && result.card) ctx.log(`💣 Giocoliere Devastante distrugge ${result.card.name}!`);
            };
            const pickAndDestroy = (remaining) => {
                if (remaining <= 0) return;
                const candidates = gatherCandidates();
                if (candidates.length === 0) return;
                if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                    destroyOne(candidates[0]);
                    pickAndDestroy(remaining - 1);
                    return;
                }
                Decisioni.chiedi({
                    chi: ctx.owner,
                    candidati: candidates.map((c) => c.card),
                    titolo: '💣 Giocoliere Devastante',
                    testo: `Scegli ${remaining} mostr${remaining === 1 ? 'o' : 'i'} scoperto con ATK 1000 o meno da distruggere.`
                }, (chosenCard) => {
                    if (chosenCard === null) return;
                    const entry = candidates.find((c) => c.card.uid === chosenCard.uid);
                    if (entry) destroyOne(entry);
                    pickAndDestroy(remaining - 1);
                });
            };
            pickAndDestroy(2);
        }
    });

    // 1063 — Sentinella Cremisi (Crimson Sentry): si tributa per
    // rimandare in fondo al proprio Deck 1 proprio mostro distrutto in
    // battaglia QUESTO turno — nuovo tracker generico
    // gameState.battleDestroyedThisTurnFor (actions.js/game-flow.js, vedi
    // i commenti lì). "Fondo del Deck" = inizio dell'array (opposto di
    // "cima" = fine dell'array, stesso verso di drawCardsToHand/pop).
    CardEffects.register(1063, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            const list = gameState.battleDestroyedThisTurnFor && gameState.battleDestroyedThisTurnFor[ctx.owner];
            if (!list || list.length === 0) return false;
            const grave = ctx.graveyard(ctx.owner);
            return list.some((c) => grave.some((g) => g.uid === c.uid));
        },
        activate(ctx) {
            const list = (gameState.battleDestroyedThisTurnFor && gameState.battleDestroyedThisTurnFor[ctx.owner]) || [];
            const grave = ctx.graveyard(ctx.owner);
            const stillInGrave = list.filter((c) => grave.some((g) => g.uid === c.uid));
            if (stillInGrave.length === 0) return;
            const ownIndex = ctx.index;
            ctx.field(ctx.owner)[ownIndex] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            const returnToDeck = (target) => {
                const idx = grave.findIndex((g) => g.uid === target.uid);
                if (idx === -1) return;
                if (ctx.graveyardMoveNegated(ctx.owner)) return;
                const [card] = grave.splice(idx, 1);
                const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
                gameState[deckKey].unshift(card);
                gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = gameState[deckKey].length;
                ctx.log(`🔥 Sentinella Porpora rimanda ${card.name} in fondo al Deck!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) { returnToDeck(stillInGrave[0]); return; }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: stillInGrave,
                titolo: '🔥 Sentinella Porpora',
                testo: 'Scegli 1 tuo mostro distrutto in battaglia questo turno da rimandare in fondo al Deck (questa carta si tributa).'
            }, (scelta) => {
                if (scelta === null) return;
                returnToDeck(scelta);
            });
        }
    });

    // 1064 — Sirena Curatrice (Cure Mermaid): finché resta scoperta,
    // guadagna 800 LP ad ogni propria Standby Phase — def.onStandbyPhase
    // (firePhaseTrigger, duel-engine.js) scatta già SOLO per chi
    // controlla la carta durante la SUA fase, nessuna condizione
    // aggiuntiva necessaria.
    CardEffects.register(1064, {
        onStandbyPhase(ctx) {
            ctx.dealDamage(ctx.owner, -800);
            ctx.log('🧜 Sirena Curatrice fa guadagnare 800 Life Points!');
        }
    });

    // 1065 — Fata Danzante (Dancing Fairy): stesso schema di Sirena
    // Curatrice (1064) sopra, ma SOLO se resta in Posizione di Difesa
    // scoperta (ctx.slot.position, già esposto da firePhaseTrigger).
    CardEffects.register(1065, {
        onStandbyPhase(ctx) {
            if (ctx.slot.position !== 'defense') return;
            ctx.dealDamage(ctx.owner, -1000);
            ctx.log('🧚 Fata Danzante fa guadagnare 1000 Life Points!');
        }
    });

    // 1066 — Elfa Oscura (Dark Elf): riusa requiresLifePointsToAttack
    // (già esistente, nato per Sirena Toon id 484/Teschio Evocato Toon
    // id 486) — nessun codice nuovo necessario.
    CardEffects.register(1066, {
        requiresLifePointsToAttack: 1000
    });

    // ================================================================
    // OTTAVA ONDATA PRIMA SERIE (id 1067-1074) — 8 Mostri Effetto minori.
    // ================================================================

    // 1067 — Scassinatori Scorpioni Oscuri (Dark Scorpion Burglars):
    // quando infligge danno da battaglia all'avversario (onDealsBattleDamage,
    // già dispatchato da fireOwnBattleDamageDealt per OGNI danno da
    // battaglia, non solo l'attacco diretto — vedi actions.js), scarta
    // (mill) 1 Magia dal Deck avversario al suo Cimitero.
    CardEffects.register(1067, {
        onDealsBattleDamage(ctx) {
            searchDeckWithChoice(ctx, (c) => c.type === 'spell', { deckOwner: ctx.opponent, title: '🗡️ Dark Scorpion-Scassinatori', text: "Scegli quale Magia mandare al Cimitero dal Deck dell'avversario." }, (card) => {
                ctx.graveyard(ctx.opponent).push(card);
                ctx.log(`🗡️ Dark Scorpion-Scassinatori manda ${card.name} dal Deck avversario al Cimitero!`);
            });
        }
    });

    // 1068 — Guerriero degli Abissi (Deepsea Warrior): finché "Umi" (id
    // 497) è sul Terreno, non è influenzato dagli effetti Magia — stesso
    // schema PER-ISTANZA già usato da Il Pescatore Leggendario (id 879,
    // vedi il commento lì): gameState.cannotBeTargetedBySpellsUids,
    // ricalcolato ad ogni render. SEMPLIFICAZIONE identica a id 879/285:
    // copre solo il "presa di mira", non ogni Magia che lo influenza
    // SENZA sceglierlo come bersaglio.
    CardEffects.register(1068, {
        static(ctx) {
            const umiPresent = ['playerFieldSpell', 'botFieldSpell'].some((key) => {
                const fs = ctx.gameState[key];
                return fs && !fs.isFaceDown && fs.card.id === 497;
            }) || gameState.virtualUmiPresent;
            if (!umiPresent) return;
            gameState.cannotBeTargetedBySpellsUids[ctx.card.uid] = true;
        }
    });

    // 1069 — Guardiana delle Fate (Fairy Guardian): si tributa per
    // rimandare in fondo al proprio Deck 1 propria Magia mandata al
    // Cimitero da un effetto dell'AVVERSARIO in QUESTO turno — nuovo
    // tracker generico gameState.spellsSentToGraveyardByOpponentThisTurnFor
    // (duel-engine.js/game-flow.js, vedi i commenti lì), stesso identico
    // schema di Sentinella Cremisi (id 1063) ma per Magie invece che
    // mostri distrutti in battaglia.
    CardEffects.register(1069, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            const list = gameState.spellsSentToGraveyardByOpponentThisTurnFor && gameState.spellsSentToGraveyardByOpponentThisTurnFor[ctx.owner];
            if (!list || list.length === 0) return false;
            const grave = ctx.graveyard(ctx.owner);
            return list.some((c) => grave.some((g) => g.uid === c.uid));
        },
        activate(ctx) {
            const list = (gameState.spellsSentToGraveyardByOpponentThisTurnFor && gameState.spellsSentToGraveyardByOpponentThisTurnFor[ctx.owner]) || [];
            const grave = ctx.graveyard(ctx.owner);
            const stillInGrave = list.filter((c) => grave.some((g) => g.uid === c.uid));
            if (stillInGrave.length === 0) return;
            const ownIndex = ctx.index;
            ctx.field(ctx.owner)[ownIndex] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            const returnToDeck = (target) => {
                const idx = grave.findIndex((g) => g.uid === target.uid);
                if (idx === -1) return;
                if (ctx.graveyardMoveNegated(ctx.owner)) return;
                const [card] = grave.splice(idx, 1);
                const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
                gameState[deckKey].unshift(card);
                gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = gameState[deckKey].length;
                ctx.log(`🧚 Fata Guardiana rimanda ${card.name} in fondo al Deck!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) { returnToDeck(stillInGrave[0]); return; }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: stillInGrave,
                titolo: '🧚 Fata Guardiana',
                testo: 'Scegli 1 tua Magia mandata al Cimitero da un effetto avversario questo turno da rimandare in fondo al Deck (questa carta si tributa).'
            }, (scelta) => {
                if (scelta === null) return;
                returnToDeck(scelta);
            });
        }
    });

    // 1070 — Assalitore Lampo (Flash Assailant): -400 ATK/DEF per ogni
    // carta nella propria mano — gameState.atkDefBonus ricalcolato ad
    // ogni render dentro static(), stesso store condiviso già usato per
    // decine di bonus/malus in questo file.
    CardEffects.register(1070, {
        static(ctx) {
            const penalty = 400 * ctx.hand(ctx.owner).length;
            if (penalty === 0) return;
            const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk - penalty, def: e.def - penalty };
        }
    });

    // 1071 — Mummia dall'Ascia Gigante (Giant Axe Mummy): Ignition una
    // volta per turno per coprirsi in Posizione di Difesa (stesso schema
    // di Des Lacooda id 1052). La seconda clausola del testo reale ("se
    // l'attaccante ha ATK inferiore alla DEF di questa carta, l'attaccante
    // viene distrutto") non richiede alcun codice: è già il comportamento
    // STANDARD di questo motore per qualunque mostro in Posizione di
    // Difesa (vedi "Risoluzione battaglia: le 6 combinazioni base" nella
    // suite di test) — il testo della carta descrive solo la meccanica
    // normale, non un'eccezione.
    CardEffects.register(1071, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot || slot.isFaceDown) return false;
            if (ctx.hasUsedOncePerTurn(`1071:${ctx.card.uid}`)) return false;
            return true;
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`1071:${ctx.card.uid}`);
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot) return;
            slot.isFaceDown = true;
            slot.position = 'defense';
            ctx.log('🪓 Mummia dall\'Ascia Gigante si copre in Posizione di Difesa!');
        }
    });

    // 1072 — Tartaruga Gora (Gora Turtle): finché resta scoperta, i
    // mostri con ATK 1900+ (di ENTRAMBI i lati) non possono dichiarare un
    // attacco — gameState.cannotAttackUids, stesso store condiviso già
    // usato da Messaggero della Pace (id 880, soglia 1500), qui senza
    // alcun costo di mantenimento (il testo reale di Gora Turtle non ne
    // ha uno).
    CardEffects.register(1072, {
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (slot && !slot.isFaceDown && slot.card.attack >= 1900) {
                        gameState.cannotAttackUids[slot.card.uid] = true;
                    }
                });
            });
        }
    });

    // 1073 — Ala Grigia (Gray Wing): scarta 1 carta dalla mano durante
    // la propria Main Phase 1 per poter attaccare due volte questo turno
    // — riusa slot.extraAttackGranted (già esistente, nato per
    // Riavvolgimento Toon id 485: +1 attacco concesso una tantum,
    // azzerato ad ogni changeTurn()), impostato qui direttamente sulla
    // propria casella invece che da un'altra carta.
    CardEffects.register(1073, {
        canActivate(ctx) {
            if (gameState.phase !== 'main1' || gameState.currentPlayer !== ctx.owner) return false;
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot || slot.extraAttackGranted) return false;
            return ctx.hand(ctx.owner).length > 0;
        },
        activate(ctx) {
            offerHandDiscardChoice(ctx, {
                title: '🐉 Ali Grigie',
                text: 'Scegli quale carta scartare dalla mano.'
            }, () => {
                const slot = ctx.field(ctx.owner)[ctx.index];
                if (slot) slot.extraAttackGranted = true;
                ctx.log('🐉 Ali Grigie scarta 1 carta: può attaccare due volte in questa Battle Phase!');
            });
        }
    });

    // 1074 — Hoshiningen: finché resta scoperta, tutti i mostri LUCE sul
    // Terreno (di ENTRAMBI i lati) guadagnano 500 ATK, tutti i mostri
    // OSCURITÀ ne perdono 400 — gameState.atkDefBonus, stesso schema di
    // Un Oceano Leggendario/decine di altre carte in questo file.
    CardEffects.register(1074, {
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown) return;
                    if (slot.card.attribute === 'LUCE') {
                        const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                        gameState.atkDefBonus[slot.card.uid] = { atk: e.atk + 500, def: e.def };
                    } else if (slot.card.attribute === 'OSCURITÀ') {
                        const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                        gameState.atkDefBonus[slot.card.uid] = { atk: e.atk - 400, def: e.def };
                    }
                });
            });
        }
    });

    // ================================================================
    // NONA ONDATA PRIMA SERIE (id 1075-1083) — 9 Mostri Effetto minori.
    // ================================================================

    // Cerca su ENTRAMBI i campi Mostro in quale casella si trova
    // `targetCard` (per uid) — nuovo helper condiviso, nato per Tigre Re
    // Wanghu (1077)/Kotodama (1078) qui sotto: entrambe reagiscono a
    // "un qualunque mostro Evocato/girato scoperto" (def.onAnyNormalOrFlipSummon/
    // onAnySpecialSummon, duel-engine.js) e devono localizzare la carta
    // appena arrivata per poterla poi distruggere — riusabile da
    // qualunque futura carta con lo stesso bisogno.
    function findCardFieldLocation(targetCard) {
        for (const owner of Tavolo.ordine()) {
            const field = Tavolo.mostri(owner);
            const index = field.findIndex((s) => s && s.card.uid === targetCard.uid);
            if (index !== -1) return { owner: owner, index: index };
        }
        return null;
    }

    // 1075 — Jowgen lo Spiritualista (Jowgen the Spiritualist): scarta 1
    // carta a caso per distruggere ogni mostro Special Summonato sul
    // Terreno (di ENTRAMBI i lati, nuovo marcatore per-slot
    // slot.wasSpecialSummoned, ACTIONS.specialSummon in duel-engine.js) e
    // vietare PERMANENTEMENTE la Special Summon ad ENTRAMBI i giocatori
    // — gameState.specialSummonsPermanentlyBannedForBothSides (nuovo,
    // duel-engine.js/ACTIONS.specialSummon: a differenza di
    // otherMonsterSummonsBlockedFor, MAI azzerato da
    // recomputeStaticEffects, resta vero anche dopo che questa carta
    // lascia il Terreno — corretto per il ruling ufficiale reale).
    CardEffects.register(1075, {
        canActivate(ctx) {
            if (gameState.specialSummonsPermanentlyBannedForBothSides) return false;
            return ctx.hand(ctx.owner).length > 0;
        },
        activate(ctx) {
            ctx.discardRandomFromHand(ctx.owner);
            let destroyedCount = 0;
            Tavolo.ordine().forEach((owner) => {
                for (let i = ctx.field(owner).length - 1; i >= 0; i--) {
                    const slot = ctx.field(owner)[i];
                    if (slot && !slot.isFaceDown && slot.wasSpecialSummoned) {
                        ctx.destroyMonster(owner, i);
                        destroyedCount++;
                    }
                }
            });
            gameState.specialSummonsPermanentlyBannedForBothSides = true;
            ctx.log(`👤 Jowgen lo Spiritualista distrugge ${destroyedCount} mostr${destroyedCount === 1 ? 'o' : 'i'} Special Summonat${destroyedCount === 1 ? 'o' : 'i'} e vieta la Special Summon per sempre!`);
        }
    });

    // 1076 — Invito al Sonno Oscuro (Invitation to a Dark Sleep): quando
    // Evocata Normalmente (onSummon esclude la Special Summon dichiarando
    // anche onSpecialSummon come no-op, vedi fireTrigger/duel-engine.js:
    // se def.onSpecialSummon esiste, la Special Summon chiama SOLO
    // quello, mai onSummon), sceglie 1 mostro avversario scoperto: finché
    // questa carta resta scoperta, quel mostro non può attaccare. Flag
    // PER-ISTANZA sulla carta stessa (ctx.card.lockedAttackBanTargetUid)
    // + gameState.cannotAttackUids (già esistente) ricalcolato ad ogni
    // render dentro static().
    CardEffects.register(1076, {
        onSummon(ctx) {
            const candidates = ctx.field(ctx.opponent).filter((s) => s && !s.isFaceDown).map((s) => s.card);
            if (candidates.length === 0) return;
            const lockTarget = (target) => {
                ctx.card.lockedAttackBanTargetUid = target.uid;
                ctx.log(`😴 Invito al Sonno Oscuro impedisce a ${target.name} di attaccare finché resta scoperta!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                lockTarget(candidates.reduce((a, b) => (b.attack > a.attack ? b : a)));
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates,
                titolo: '😴 Invito al Sonno Oscuro',
                testo: 'Scegli 1 mostro avversario scoperto che non potrà più attaccare finché questa carta resta scoperta.'
            }, (scelta) => {
                if (scelta === null) return;
                lockTarget(scelta);
            });
        },
        onSpecialSummon() {},
        static(ctx) {
            if (!ctx.card.lockedAttackBanTargetUid) return;
            gameState.cannotAttackUids[ctx.card.lockedAttackBanTargetUid] = true;
        }
    });

    // 1077 — Tigre Re Wanghu (King Tiger Wanghu): "quando un mostro con
    // ATK 1400 o meno viene Evocato Normalmente o Special Summonato,
    // distruggilo" — def.onAnyNormalOrFlipSummon/onAnySpecialSummon
    // (broadcast a ogni carta scoperta di entrambi i lati, duel-engine.js),
    // findCardFieldLocation qui sopra per localizzare il bersaglio.
    // "Questa carta deve restare scoperta per attivarsi e risolversi":
    // già garantito per costruzione, il dispatcher chiama questo hook
    // SOLO sulle carte scoperte al momento dello scatto.
    CardEffects.register(1077, {
        onAnyNormalOrFlipSummon(ctx) { wanghuDestroyIfWeak(ctx, ctx.summonedCard); },
        onAnySpecialSummon(ctx) { wanghuDestroyIfWeak(ctx, ctx.summonedCard); }
    });
    function wanghuDestroyIfWeak(ctx, summonedCard) {
        if (!summonedCard || (summonedCard.attack || 0) > 1400) return;
        const loc = findCardFieldLocation(summonedCard);
        if (!loc) return;
        ctx.destroyMonster(loc.owner, loc.index);
        ctx.log(`🐯 Tigre Reale Wanghu distrugge ${summonedCard.name} (ATK 1400 o meno)!`);
    }

    // 1078 — Kotodama: "se esistono mostri scoperti con lo stesso nome
    // sul Terreno, distruggili" — semplificato al caso reale più comune
    // (regola scritta sulla carta stessa): quando un mostro viene
    // Evocato/girato scoperto E un ALTRO mostro con lo stesso nome è già
    // scoperto, distruggi il NUOVO arrivato. Stesso schema di Tigre Re
    // Wanghu (1077) qui sopra, stesso helper condiviso.
    CardEffects.register(1078, {
        onAnyNormalOrFlipSummon(ctx) { kotodamaDestroyIfDuplicate(ctx, ctx.summonedCard); },
        onAnySpecialSummon(ctx) { kotodamaDestroyIfDuplicate(ctx, ctx.summonedCard); }
    });
    function kotodamaDestroyIfDuplicate(ctx, summonedCard) {
        if (!summonedCard) return;
        const loc = findCardFieldLocation(summonedCard);
        if (!loc) return;
        const hasDuplicate = Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown && s.card.uid !== summonedCard.uid && s.card.name === summonedCard.name));
        if (!hasDuplicate) return;
        ctx.destroyMonster(loc.owner, loc.index);
        ctx.log(`📿 Kotodama distrugge ${summonedCard.name}: un'altra copia era già scoperta sul Terreno!`);
    }

    // 1079 — Kryuel: distrutta in battaglia, lancia una moneta — se
    // "vinta" (50%, il "chiamala" del testo reale non cambia la
    // probabilità di un lancio equo, quindi risolto direttamente senza
    // un passaggio di scelta testa/croce), distruggi 1 mostro avversario
    // scoperto a scelta.
    CardEffects.register(1079, {
        onDestroy(ctx) {
            if (!ctx.destroyedByOpponentCard) return;
            const won = ctx.random() < 0.5;
            if (window.FX && typeof FX.playCoinFlip === 'function') FX.playCoinFlip(won);
            if (!won) { ctx.log('🪙 Kryuel lancia una moneta... sbagliata!'); return; }
            const candidates = ctx.field(ctx.opponent).filter((s) => s && !s.isFaceDown).map((s) => s.card);
            if (candidates.length === 0) { ctx.log('🪙 Kryuel indovina la moneta, ma l\'avversario non controlla mostri scoperti!'); return; }
            const destroyChosen = (target) => {
                const index = ctx.field(ctx.opponent).findIndex((s) => s && s.card.uid === target.uid);
                if (index === -1) return;
                const result = ctx.destroyTargetedMonster(ctx.opponent, index);
                if (result.allowed && result.card) ctx.log(`🪙 Kryuel indovina la moneta: distrugge ${result.card.name}!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) { destroyChosen(candidates[0]); return; }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates,
                titolo: '🪙 Kryuel',
                testo: 'Hai indovinato la moneta! Scegli 1 mostro avversario scoperto da distruggere.'
            }, (scelta) => {
                if (scelta === null) return;
                destroyChosen(scelta);
            });
        }
    });

    // 1080 — Kycoo Distruttore di Fantasmi (Kycoo the Ghost Destroyer):
    // quando infligge danno da battaglia, bandisce fino a 2 mostri dal
    // Cimitero avversario (ctx.banishFromGraveyard), scelti dal giocatore
    // con chooseUpToNFromList ("fino a 2": ci si può fermare prima).
    // "Il tuo avversario non può bandire carte dal Cimitero di nessuno dei
    // due giocatori": gameState.graveyardBanishBlockedFor[avversario],
    // scritto dallo static() finché questa carta è scoperta e letto da
    // ACTIONS.banishFromGraveyard, che conosce CHI bandisce (il
    // proprietario del contesto che chiama). Il bando di Kycoo stesso resta
    // permesso: l'attore è il suo controllore, non l'avversario.
    CardEffects.register(1080, {
        static(ctx) {
            gameState.graveyardBanishBlockedFor[ctx.opponent] = true;
        },
        onDealsBattleDamage(ctx) {
            const grave = ctx.graveyard(ctx.opponent).filter((c) => c.type === 'monster');
            if (grave.length === 0) return;
            chooseUpToNFromList(ctx, grave, 2, {
                title: '👻 Kycoo il Distruttore di Spettri',
                text: 'Scegli fino a 2 mostri del Cimitero avversario da bandire.'
            }, (scelti) => {
                const banditi = scelti.filter((card) => ctx.banishFromGraveyard(ctx.opponent, card)).length;
                if (banditi > 0) ctx.log(`👻 Kycoo il Distruttore di Spettri bandisce ${banditi} mostr${banditi === 1 ? 'o' : 'i'} dal Cimitero avversario!`);
            });
        }
    });

    // 1081 — Pantera Signora (Lady Panther): stesso identico schema di
    // Sentinella Cremisi (id 1063), ma torna in CIMA al Deck (fine
    // dell'array, stesso verso di drawCardsToHand/pop) invece che in
    // fondo — riusa lo stesso tracker gameState.battleDestroyedThisTurnFor.
    CardEffects.register(1081, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            const list = gameState.battleDestroyedThisTurnFor && gameState.battleDestroyedThisTurnFor[ctx.owner];
            if (!list || list.length === 0) return false;
            const grave = ctx.graveyard(ctx.owner);
            return list.some((c) => grave.some((g) => g.uid === c.uid));
        },
        activate(ctx) {
            const list = (gameState.battleDestroyedThisTurnFor && gameState.battleDestroyedThisTurnFor[ctx.owner]) || [];
            const grave = ctx.graveyard(ctx.owner);
            const stillInGrave = list.filter((c) => grave.some((g) => g.uid === c.uid));
            if (stillInGrave.length === 0) return;
            const ownIndex = ctx.index;
            ctx.field(ctx.owner)[ownIndex] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            const returnToDeckTop = (target) => {
                const idx = grave.findIndex((g) => g.uid === target.uid);
                if (idx === -1) return;
                if (ctx.graveyardMoveNegated(ctx.owner)) return;
                const [card] = grave.splice(idx, 1);
                const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
                gameState[deckKey].push(card);
                gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = gameState[deckKey].length;
                ctx.log(`🐆 Signora Pantera rimanda ${card.name} in cima al Deck!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) { returnToDeckTop(stillInGrave[0]); return; }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: stillInGrave,
                titolo: '🐆 Signora Pantera',
                testo: 'Scegli 1 tuo mostro distrutto in battaglia questo turno da rimandare in cima al Deck (questa carta si tributa).'
            }, (scelta) => {
                if (scelta === null) return;
                returnToDeckTop(scelta);
            });
        }
    });

    // 1082 — Ninfa dell'Acqua (Maiden of the Aqua): finché resta scoperta
    // e nessun Field Spell è attivo, il Terreno è trattato come "Umi" per
    // le carte che lo controllano (SENZA applicare il bonus/malus ATK/DEF
    // di Umi stessa) — nuovo gameState.virtualUmiPresent (globale, non
    // per-owner: "Umi" reale non lo è), consultato da Guerriero degli
    // Abissi (id 1068)/Il Pescatore Leggendario (id 879) accanto al
    // controllo diretto già esistente.
    CardEffects.register(1082, {
        static(ctx) {
            const anyFieldSpellActive = ['playerFieldSpell', 'botFieldSpell'].some((key) => {
                const fs = ctx.gameState[key];
                return fs && !fs.isFaceDown;
            });
            if (!anyFieldSpellActive) gameState.virtualUmiPresent = true;
        }
    });

    // 1083 — Fata Isterica (Hysteric Fairy): tributa 2 mostri sul proprio
    // Terreno (può includere se stessa) per guadagnare 1000 Life Points —
    // raccoglie le 2 scelte PRIMA di rimuoverle entrambe insieme (non una
    // alla volta), così scegliere se stessa come uno dei due bersagli non
    // altera gli indici delle scelte successive.
    CardEffects.register(1083, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            return ctx.field(ctx.owner).filter((s) => s).length >= 2;
        },
        activate(ctx) {
            const pickAndTribute = (remaining, gathered) => {
                if (remaining <= 0) {
                    gathered.forEach((entry) => {
                        ctx.field(ctx.owner)[entry.index] = null;
                        ctx.graveyard(ctx.owner).push(entry.card);
                    });
                    ctx.dealDamage(ctx.owner, -1000);
                    ctx.log('🧚 Fata Isterica tributa 2 mostri: guadagna 1000 Life Points!');
                    return;
                }
                const candidates = [];
                ctx.field(ctx.owner).forEach((s, i) => { if (s && !gathered.some((g) => g.index === i)) candidates.push({ index: i, card: s.card }); });
                if (candidates.length === 0) return;
                if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                    gathered.push(candidates[0]);
                    pickAndTribute(remaining - 1, gathered);
                    return;
                }
                Decisioni.chiedi({
                    chi: ctx.owner,
                    candidati: candidates.map((c) => c.card),
                    titolo: '🧚 Fata Isterica',
                    testo: `Scegli ${remaining} tu${remaining === 1 ? 'o mostro' : 'oi mostri'} da tributare.`
                }, (chosenCard) => {
                    if (chosenCard === null) return;
                    const entry = candidates.find((c) => c.card.uid === chosenCard.uid);
                    if (entry) gathered.push(entry);
                    pickAndTribute(remaining - 1, gathered);
                });
            };
            pickAndTribute(2, []);
        }
    });

    // ================================================================
    // DECIMA ONDATA PRIMA SERIE (id 1084-1092) — 9 Mostri Effetto minori.
    // ================================================================

    // 1084 — Minar: stesso identico schema di Serpente Elettrico (id
    // 1048, sesta ondata) — ctx.discardedByOwner, ma infligge 1000 danni
    // invece di pescare 2.
    CardEffects.register(1084, {
        onSentToGraveyardFromHand(ctx) {
            if (ctx.discardedByOwner !== ctx.opponent) return;
            ctx.dealDamage(ctx.opponent, 1000);
            ctx.log('🐛 Minar infligge 1000 danni!');
        }
    });

    // 1085 — Mushroom Man #2: chi la controlla perde 300 LP ad ogni sua
    // Standby Phase (def.onStandbyPhase, già esistente) finché scoperta;
    // Ignition nella propria End Phase per pagare 500 LP e passare il
    // controllo all'avversario PERMANENTEMENTE (ctx.takeControl con
    // permanent=true, già esistente — mai tornerà da solo a fine turno).
    CardEffects.register(1085, {
        onStandbyPhase(ctx) {
            ctx.dealDamage(ctx.owner, 300);
            ctx.log('🍄 Uomo-Fungo #2: il controllore perde 300 Life Points!');
        },
        canActivate(ctx) {
            if (gameState.phase !== 'end' || gameState.currentPlayer !== ctx.owner) return false;
            return Tavolo.lp(ctx.owner) > 500;
        },
        activate(ctx) {
            ctx.dealDamage(ctx.owner, 500);
            ctx.takeControl(ctx.opponent, ctx.owner, ctx.index, true);
            ctx.log('🍄 Uomo-Fungo #2 passa il controllo all\'avversario!');
        }
    });

    // 1086 — Newdoria: distrutta in battaglia, mandata al Cimitero:
    // sceglie come bersaglio 1 mostro sul Terreno (di uno o dell'altro
    // lato) e lo distrugge — ctx.destroyTargetedMonster, checkpoint di
    // targeting condiviso.
    CardEffects.register(1086, {
        onDestroy(ctx) {
            if (!ctx.destroyedByOpponentCard) return;
            const candidates = [];
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((s, i) => { if (s && !s.isFaceDown) candidates.push({ owner: owner, index: i, card: s.card }); });
            });
            if (candidates.length === 0) return;
            const destroyChosen = (target) => {
                const entry = candidates.find((c) => c.card.uid === target.uid);
                if (!entry) return;
                const result = ctx.destroyTargetedMonster(entry.owner, entry.index);
                if (result.allowed && result.card) ctx.log(`👹 Newdoria distrugge ${result.card.name}!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) { destroyChosen(candidates[0].card); return; }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates.map((c) => c.card),
                titolo: '👹 Newdoria',
                testo: 'Scegli 1 mostro sul Terreno da distruggere.'
            }, (scelta) => {
                if (scelta === null) return;
                destroyChosen(scelta);
            });
        }
    });

    // 1087 — Nuvia la Malvagia (Nuvia the Wicked): se Evocata Normalmente
    // (onSummon copre Normale+Flip, onSpecialSummon dichiarato come
    // no-op per escludere la Special Summon, stesso schema di Invito al
    // Sonno Oscuro id 1076), si autodistrugge subito. Finché scoperta,
    // -200 ATK per ogni mostro controllato dall'avversario (gameState.atkDefBonus).
    CardEffects.register(1087, {
        onSummon(ctx) {
            const index = ctx.field(ctx.owner).findIndex((s) => s && s.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.destroyMonster(ctx.owner, index);
            ctx.log('👿 Nuvia lo Stregato si autodistrugge: Evocata Normalmente!');
        },
        onSpecialSummon() {},
        static(ctx) {
            const oppCount = ctx.field(ctx.opponent).filter((s) => s).length;
            if (oppCount === 0) return;
            const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk - 200 * oppCount, def: e.def };
        }
    });

    // 1088 — Cavaliere Pinguino (Penguin Knight): mandata dal Deck al
    // Cimitero da un effetto dell'AVVERSARIO (mill, ctx.milledByOwner
    // già esistente): rimescola Cimitero+Deck insieme in un nuovo Deck.
    CardEffects.register(1088, {
        onSentToGraveyardFromDeck(ctx) {
            if (ctx.milledByOwner !== ctx.opponent) return;
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const graveKey = Tavolo.chiave(ctx.owner, 'Graveyard');
            const merged = [...gameState[deckKey], ...gameState[graveKey]];
            // Math.random() e non ctx.random(): un RIMESCOLO non ha nulla
            // da accordare fra i due client di un Multiplayer. Quello che
            // cambia per entrambi — che il Cimitero si svuoti e il Deck
            // cresca — avviene uguale comunque; l'ORDINE tocca solo il
            // proprio Deck, che è privato e che l'avversario non simula
            // nemmeno. Vale per ogni altro rimescolo di questo file.
            for (let i = merged.length - 1; i > 0; i--) {
                const j = Math.floor(Casuale.random() * (i + 1));
                [merged[i], merged[j]] = [merged[j], merged[i]];
            }
            gameState[deckKey] = merged;
            gameState[graveKey] = [];
            gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = merged.length;
            ctx.log('🐧 Cavaliere Pinguino rimescola il Cimitero nel Deck!');
        }
    });

    // 1089 — Melma Rediviva (Revival Jam): distrutta in battaglia, mandata
    // al Cimitero: paga 1000 LP per rinascere scoperta in Posizione di
    // Difesa alla propria prossima Standby Phase — riusa
    // ctx.reviveFromGraveyardWithCountdown, esteso in questa stessa
    // sessione con un nuovo parametro `position` (default 'attack',
    // retrocompatibile) proprio per questa carta.
    CardEffects.register(1089, {
        onDestroy(ctx) {
            if (!ctx.destroyedByOpponentCard) return;
            const grave = ctx.graveyard(ctx.owner);
            const index = grave.findIndex((c) => c.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.dealDamage(ctx.owner, 1000);
            const [card] = grave.splice(index, 1);
            ctx.reviveFromGraveyardWithCountdown(ctx.owner, card, 1, 'defense');
            ctx.log('🟢 Gelatina Rianimata paga 1000 Life Points: rinascerà scoperta in Posizione di Difesa alla tua prossima Standby Phase!');
        }
    });

    // 1090 — Guardiano Reale (Royal Keeper): Ignition una volta per turno
    // per coprirsi in Posizione di Difesa (stesso schema di Des Lacooda
    // id 1052); quando Evocata Flip, guadagna 300 ATK/DEF fino a fine
    // turno — ctx.grantTemporaryAtkDefBonus, già esistente.
    CardEffects.register(1090, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot || slot.isFaceDown) return false;
            if (ctx.hasUsedOncePerTurn(`1090:${ctx.card.uid}`)) return false;
            return true;
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`1090:${ctx.card.uid}`);
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot) return;
            slot.isFaceDown = true;
            slot.position = 'defense';
            ctx.log('🛡️ Custode Reale si copre in Posizione di Difesa!');
        },
        onFlip(ctx) {
            ctx.grantTemporaryAtkDefBonus(ctx.card, 300, 300);
            ctx.log('🛡️ Custode Reale guadagna 300 ATK/DEF fino a fine turno!');
        }
    });

    // 1091 — Ryu-Kishin Pagliaccio (Ryu-Kishin Clown): quando Evocata
    // (Normale, Flip o Special — onSummon copre le prime due, onSpecialSummon
    // separato per la terza, stessa funzione condivisa), sceglie 1 mostro
    // scoperto sul Terreno (di uno o dell'altro lato, se stessa inclusa) e
    // ne cambia la Posizione di Battaglia — ctx.changePosition, già
    // esistente.
    function ryuKishinClownReact(ctx) {
        const candidates = [];
        Tavolo.ordine().forEach((owner) => {
            ctx.field(owner).forEach((s, i) => { if (s && !s.isFaceDown) candidates.push({ owner: owner, index: i, card: s.card, position: s.position }); });
        });
        if (candidates.length === 0) return;
        const toggle = (entry) => {
            const newPosition = entry.position === 'attack' ? 'defense' : 'attack';
            ctx.changePosition(entry.owner, entry.index, newPosition);
            ctx.log(`🤡 Clown Ryu-Kishin cambia la Posizione di Battaglia di ${entry.card.name}!`);
        };
        if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
            // Preferenza euristica per il bot/auto-pick: un mostro
            // avversario è quasi sempre un bersaglio più sensato del
            // proprio (il testo reale non esclude se stessa, ma
            // sceglierla di default sarebbe una mossa quasi sempre
            // sbagliata per l'IA).
            const preferred = candidates.find((c) => c.owner === ctx.opponent) || candidates[0];
            toggle(preferred);
            return;
        }
        Decisioni.chiedi({
            chi: ctx.owner,
            candidati: candidates.map((c) => c.card),
            titolo: '🤡 Clown Ryu-Kishin',
            testo: 'Scegli 1 mostro scoperto di cui cambiare la Posizione di Battaglia.'
        }, (chosenCard) => {
            if (chosenCard === null) return;
            const entry = candidates.find((c) => c.card.uid === chosenCard.uid);
            if (entry) toggle(entry);
        });
    }
    CardEffects.register(1091, {
        onSummon(ctx) { ryuKishinClownReact(ctx); },
        onSpecialSummon(ctx) { ryuKishinClownReact(ctx); }
    });

    // 1092 — Senju delle Mille Mani (Senju of the Thousand Hands): quando
    // Evocata Normalmente o girata scoperta (onSummon; onSpecialSummon
    // dichiarato come no-op per escludere la Special Summon, stesso
    // schema di Invito al Sonno Oscuro id 1076/Nuvia la Malvagia id
    // 1087), aggiunge 1 Mostro Rituale dal Deck alla mano.
    CardEffects.register(1092, {
        onSummon(ctx) {
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.category === 'ritual', {
                title: '🙏 Senju dalle 1000 Mani',
                text: 'Scegli quale Mostro Rituale aggiungere alla mano dal Deck.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`🙏 Senju dalle 1000 Mani aggiunge ${card.name} alla mano!`);
            });
        },
        onSpecialSummon() {}
    });

    // ================================================================
    // UNDICESIMA ONDATA PRIMA SERIE (id 1093-1102) — 10 Mostri Effetto minori.
    // ================================================================

    // 1093 — Anima di Purezza e Luce (Soul of Purity and Light): non può
    // essere Evocata Normalmente/Set, solo Special Summonata dalla mano
    // bandendo 2 mostri LUCE dal proprio Cimitero — riusa
    // getSpecialSummonBanishFilters/resolveSpecialSummonBanishCost
    // (nato per Inferno id 677/Fenrir id 698 in questa stessa sessione,
    // vedi actions.js/card-effects.js): la scelta dei 2 mostri da
    // bandire è ora vera (un picker in sequenza se il Cimitero ne offre
    // più di 2), non più "le prime 2 trovate" come prima. Finché
    // scoperta, i mostri avversari perdono 300 ATK SOLO durante la LORO
    // Battle Phase (gameState.atkDefBonus, ricalcolato ad ogni render
    // dentro static() — fuori dalla Battle Phase avversaria il malus
    // scompare da solo al render successivo).
    CardEffects.register(1093, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.graveyard(ctx.owner).filter((c) => c.type === 'monster' && c.attribute === 'LUCE').length >= 2;
        },
        getSpecialSummonBanishFilters() {
            const isLight = (c) => c.type === 'monster' && c.attribute === 'LUCE';
            return [isLight, isLight];
        },
        paySpecialSummonCost(ctx) {
            const isLight = (c) => c.type === 'monster' && c.attribute === 'LUCE';
            return resolveSpecialSummonBanishCost(ctx, [isLight, isLight], '☀️ Anima della Luce e della Purezza bandisce 2 mostri LUCE dal Cimitero per essere Special Summonata!');
        },
        static(ctx) {
            if (gameState.phase !== 'battle' || gameState.currentPlayer !== ctx.opponent) return;
            ctx.field(ctx.opponent).forEach((s) => {
                if (!s || s.isFaceDown) return;
                const e = gameState.atkDefBonus[s.card.uid] || { atk: 0, def: 0 };
                gameState.atkDefBonus[s.card.uid] = { atk: e.atk - 300, def: e.def };
            });
        }
    });

    // 1094 — Spirito delle Fiamme (Spirit of Flames): stesso schema di
    // 1093 sopra, banditura di 1 mostro FUOCO dal Cimitero (getSpecialSummonBanishFilters/
    // resolveSpecialSummonBanishCost apre un picker SOLO se ce n'è più di
    // uno disponibile — altrimenti prende l'unico senza chiedere nulla).
    // Guadagna 300 ATK SOLO durante
    // la PROPRIA Battle Phase.
    CardEffects.register(1094, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster' && c.attribute === 'FUOCO');
        },
        getSpecialSummonBanishFilters() {
            return [(c) => c.type === 'monster' && c.attribute === 'FUOCO'];
        },
        paySpecialSummonCost(ctx) {
            return resolveSpecialSummonBanishCost(ctx, [(c) => c.type === 'monster' && c.attribute === 'FUOCO'], "🔥 Spirito delle Fiamme bandisce 1 mostro FUOCO dal Cimitero per essere Special Summonato!");
        },
        static(ctx) {
            if (gameState.phase !== 'battle' || gameState.currentPlayer !== ctx.owner) return;
            const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk + 300, def: e.def };
        }
    });

    // 1095 — Spirito della Brezza (Spirit of the Breeze): finché resta
    // scoperta in Posizione di ATTACCO (opposto di Fata Danzante id
    // 1065, che richiede Difesa), guadagna 1000 LP ad ogni propria
    // Standby Phase.
    CardEffects.register(1095, {
        onStandbyPhase(ctx) {
            if (ctx.slot.position !== 'attack') return;
            ctx.dealDamage(ctx.owner, -1000);
            ctx.log('🌬️ Spirito della Brezza fa guadagnare 1000 Life Points!');
        }
    });

    // 1096 — Sciame di Locuste (Swarm of Locusts): Ignition una volta
    // per turno per coprirsi (stesso schema di Des Lacooda id 1052);
    // quando Evocata Flip, distrugge 1 Magia/Trappola avversaria a
    // scelta — ctx.destroySpellTrap diretto, stesso stile già usato da
    // altre carte di questo file per un bersaglio Magia/Trappola (es.
    // Neve Battente id 215) senza passare dal checkpoint
    // ctx.declareTarget (riservato ai bersagli MOSTRO in questo dataset).
    CardEffects.register(1096, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot || slot.isFaceDown) return false;
            if (ctx.hasUsedOncePerTurn(`1096:${ctx.card.uid}`)) return false;
            return true;
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`1096:${ctx.card.uid}`);
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot) return;
            slot.isFaceDown = true;
            slot.position = 'defense';
            ctx.log('🦗 Sciame di Locuste si copre in Posizione di Difesa!');
        },
        onFlip(ctx) {
            const candidates = [];
            ctx.stField(ctx.opponent).forEach((s, i) => { if (s) candidates.push({ index: i, card: s.card }); });
            if (candidates.length === 0) return;
            const destroyChosen = (target) => {
                const entry = candidates.find((c) => c.card.uid === target.uid);
                if (!entry) return;
                ctx.destroySpellTrap(ctx.opponent, entry.index);
                ctx.log(`🦗 Sciame di Locuste distrugge ${target.name}!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) { destroyChosen(candidates[0].card); return; }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates.map((c) => c.card),
                titolo: '🦗 Sciame di Locuste',
                testo: 'Scegli 1 Magia/Trappola avversaria da distruggere.'
            }, (scelta) => {
                if (scelta === null) return;
                destroyChosen(scelta);
            });
        }
    });

    // 1097 — Sciame di Scarabei (Swarm of Scarabs): stesso schema di
    // Sciame di Locuste (1096) sopra, ma distrugge 1 mostro avversario
    // invece di una Magia/Trappola — ctx.destroyTargetedMonster,
    // checkpoint di targeting condiviso.
    CardEffects.register(1097, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot || slot.isFaceDown) return false;
            if (ctx.hasUsedOncePerTurn(`1097:${ctx.card.uid}`)) return false;
            return true;
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`1097:${ctx.card.uid}`);
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot) return;
            slot.isFaceDown = true;
            slot.position = 'defense';
            ctx.log('🪲 Sciame di Scarabei si copre in Posizione di Difesa!');
        },
        onFlip(ctx) {
            const candidates = [];
            ctx.field(ctx.opponent).forEach((s, i) => { if (s) candidates.push({ index: i, card: s.card }); });
            if (candidates.length === 0) return;
            const destroyChosen = (target) => {
                const entry = candidates.find((c) => c.card.uid === target.uid);
                if (!entry) return;
                const result = ctx.destroyTargetedMonster(ctx.opponent, entry.index);
                if (result.allowed && result.card) ctx.log(`🪲 Sciame di Scarabei distrugge ${result.card.name}!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) { destroyChosen(candidates[0].card); return; }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates.map((c) => c.card),
                titolo: '🪲 Sciame di Scarabei',
                testo: 'Scegli 1 mostro avversario da distruggere.'
            }, (scelta) => {
                if (scelta === null) return;
                destroyChosen(scelta);
            });
        }
    });

    // 1098 — Saggezza Corrotta (Tainted Wisdom): se questa carta, in
    // Posizione di Attacco, viene messa in Posizione di Difesa SCOPERTA:
    // rimescola il proprio Deck — def.onPositionChange (già esistente,
    // ctx.fromPosition/ctx.toPosition, stesso schema di Clown Stupido id
    // 530), scatta solo per un mostro GIÀ scoperto (mai per un Flip).
    CardEffects.register(1098, {
        onPositionChange(ctx) {
            if (ctx.fromPosition !== 'attack' || ctx.toPosition !== 'defense') return;
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            for (let i = deck.length - 1; i > 0; i--) {
                const j = Math.floor(Casuale.random() * (i + 1));
                [deck[i], deck[j]] = [deck[j], deck[i]];
            }
            ctx.log('🧠 Saggezza Infetta rimescola il Deck!');
        }
    });

    // 1099 — Il Macellaio del Bistrot (The Bistro Butcher): quando
    // infligge danno da battaglia, l'avversario pesca 2 carte —
    // onDealsBattleDamage, già dispatchato per ogni danno da battaglia.
    CardEffects.register(1099, {
        onDealsBattleDamage(ctx) {
            ctx.drawCards(ctx.opponent, 2);
            ctx.log('🔪 Il Macellaio da Bistrò fa pescare 2 carte all\'avversario!');
        }
    });

    // 1100 — Il Piccolo Spadaccino di Aile (The Little Swordsman of
    // Aile): Ignition, tributa 1 ALTRO proprio mostro per guadagnare 700
    // ATK fino a fine turno — ctx.grantTemporaryAtkDefBonus, già esistente.
    CardEffects.register(1100, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            return ctx.field(ctx.owner).some((s, i) => s && i !== ctx.index);
        },
        activate(ctx) {
            const candidates = [];
            ctx.field(ctx.owner).forEach((s, i) => { if (s && i !== ctx.index) candidates.push({ index: i, card: s.card }); });
            if (candidates.length === 0) return;
            const tributeChosen = (target) => {
                const entry = candidates.find((c) => c.card.uid === target.uid);
                if (!entry) return;
                ctx.field(ctx.owner)[entry.index] = null;
                ctx.graveyard(ctx.owner).push(entry.card);
                ctx.grantTemporaryAtkDefBonus(ctx.card, 700, 0);
                ctx.log(`⚔️ Piccolo Spadaccino di Aile tributa ${entry.card.name}: guadagna 700 ATK fino a fine turno!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) { tributeChosen(candidates[0].card); return; }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates.map((c) => c.card),
                titolo: '⚔️ Piccolo Spadaccino di Aile',
                testo: 'Scegli 1 altro tuo mostro da tributare per guadagnare 700 ATK fino a fine turno.'
            }, (scelta) => {
                if (scelta === null) return;
                tributeChosen(scelta);
            });
        }
    });

    // 1101 — Lo Spirito della Roccia (The Rock Spirit): stesso schema di
    // Spirito delle Fiamme (1094) sopra — banditura di 1 mostro TERRA
    // dal Cimitero per la Special Summon; +300 ATK SOLO durante la
    // Battle Phase dell'AVVERSARIO (opposto di 1094, che è durante la
    // PROPRIA).
    CardEffects.register(1101, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster' && c.attribute === 'TERRA');
        },
        getSpecialSummonBanishFilters() {
            return [(c) => c.type === 'monster' && c.attribute === 'TERRA'];
        },
        paySpecialSummonCost(ctx) {
            return resolveSpecialSummonBanishCost(ctx, [(c) => c.type === 'monster' && c.attribute === 'TERRA'], '🗿 Lo Spirito della Roccia bandisce 1 mostro TERRA dal Cimitero per essere Special Summonato!');
        },
        static(ctx) {
            if (gameState.phase !== 'battle' || gameState.currentPlayer !== ctx.opponent) return;
            const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk + 300, def: e.def };
        }
    });

    // 1102 — Unità Scagliapietre (Throwstone Unit): Ignition, tributa 1
    // mostro Tipo Guerriero sul proprio Terreno (se stessa inclusa, come
    // Tirapiedi Alato id 1054/Fata Isterica id 1083) per distruggere 1
    // mostro scoperto sul Terreno con DEF minore o uguale all'ATK di
    // questa carta — ATK letto PRIMA di rimuovere l'eventuale
    // auto-tributo, come da ruling reale (il costo si paga prima che
    // l'effetto si risolva).
    CardEffects.register(1102, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            const hasWarriorTribute = ctx.field(ctx.owner).some((s) => s && s.card.race === 'Guerriero');
            if (!hasWarriorTribute) return false;
            const ownAtk = ctx.card.attack || 0;
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown && (s.card.defense || 0) <= ownAtk));
        },
        activate(ctx) {
            const warriorCandidates = [];
            ctx.field(ctx.owner).forEach((s, i) => { if (s && s.card.race === 'Guerriero') warriorCandidates.push({ index: i, card: s.card }); });
            if (warriorCandidates.length === 0) return;
            const ownAtk = ctx.card.attack || 0;
            const destroyTarget = () => {
                const destroyCandidates = [];
                Tavolo.ordine().forEach((owner) => {
                    ctx.field(owner).forEach((s, i) => { if (s && !s.isFaceDown && (s.card.defense || 0) <= ownAtk) destroyCandidates.push({ owner: owner, index: i, card: s.card }); });
                });
                if (destroyCandidates.length === 0) return;
                const destroyChosen = (target) => {
                    const entry = destroyCandidates.find((c) => c.card.uid === target.uid);
                    if (!entry) return;
                    const result = ctx.destroyTargetedMonster(entry.owner, entry.index);
                    if (result.allowed && result.card) ctx.log(`🪨 Unità Scagliapietra distrugge ${result.card.name}!`);
                };
                if (!Decisioni.rispondeUnaPersona(ctx.owner)) { destroyChosen(destroyCandidates[0].card); return; }
                Decisioni.chiedi({
                    chi: ctx.owner,
                    candidati: destroyCandidates.map((c) => c.card),
                    titolo: '🪨 Unità Scagliapietra',
                    testo: 'Scegli 1 mostro scoperto con DEF pari o inferiore all\'ATK di questa carta da distruggere.'
                }, (scelta) => {
                    if (scelta === null) return;
                    destroyChosen(scelta);
                });
            };
            const tributeChosen = (target) => {
                const entry = warriorCandidates.find((c) => c.card.uid === target.uid);
                if (!entry) return;
                ctx.field(ctx.owner)[entry.index] = null;
                ctx.graveyard(ctx.owner).push(entry.card);
                ctx.log(`🪨 Unità Scagliapietra tributa ${entry.card.name}!`);
                destroyTarget();
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) { tributeChosen(warriorCandidates[0].card); return; }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: warriorCandidates.map((c) => c.card),
                titolo: '🪨 Unità Scagliapietra',
                testo: 'Scegli 1 mostro Tipo Guerriero da tributare.'
            }, (scelta) => {
                if (scelta === null) return;
                tributeChosen(scelta);
            });
        }
    });

    // 1103 — Spirito dell'Acqua (Aqua Spirit): stesso schema di Spirito
    // delle Fiamme (1094)/Lo Spirito della Roccia (1101) per la Special
    // Summon bandendo 1 mostro ACQUA dal Cimitero. Durante OGNI Standby
    // Phase dell'avversario, può cambiare la Posizione di Battaglia di 1
    // suo mostro scoperto — def.onOpponentStandbyPhase (già esistente,
    // gemello di onOpponentEndPhase usato da Destiny Board id 866) +
    // ctx.changePosition; il bersaglio deve restare in quella Posizione
    // per il resto del turno — gameState.cannotChangePositionUidsThisTurn
    // (già esistente, nato per Maledizione di Anubis id 655), aggiunto
    // qui per la prima volta da un effetto DIVERSO da quello per cui è
    // nato.
    CardEffects.register(1103, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster' && c.attribute === 'ACQUA');
        },
        getSpecialSummonBanishFilters() {
            return [(c) => c.type === 'monster' && c.attribute === 'ACQUA'];
        },
        paySpecialSummonCost(ctx) {
            return resolveSpecialSummonBanishCost(ctx, [(c) => c.type === 'monster' && c.attribute === 'ACQUA'], "🌊 Spirito dell'Acqua bandisce 1 mostro ACQUA dal Cimitero per essere Special Summonato!");
        },
        onOpponentStandbyPhase(ctx) {
            const candidates = [];
            ctx.field(ctx.opponent).forEach((s, i) => { if (s && !s.isFaceDown) candidates.push({ index: i, card: s.card, position: s.position }); });
            if (candidates.length === 0) return;
            const changeChosen = (entry) => {
                const newPosition = entry.position === 'attack' ? 'defense' : 'attack';
                ctx.changePosition(ctx.opponent, entry.index, newPosition);
                gameState.cannotChangePositionUidsThisTurn = gameState.cannotChangePositionUidsThisTurn || new Set();
                gameState.cannotChangePositionUidsThisTurn.add(entry.card.uid);
                ctx.log(`🌊 Spirito dell'Acqua cambia la Posizione di Battaglia di ${entry.card.name} per il resto del turno!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) { changeChosen(candidates[0]); return; }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates.map((c) => c.card),
                titolo: '🌊 Spirito dell\'Acqua',
                testo: 'Scegli 1 mostro avversario scoperto di cui cambiare la Posizione di Battaglia (resterà così per il resto del turno).'
            }, (chosenCard) => {
                if (chosenCard === null) return;
                const entry = candidates.find((c) => c.card.uid === chosenCard.uid);
                if (entry) changeChosen(entry);
            });
        }
    });

    // 1104 — Garuda lo Spirito del Vento (Garuda the Wind Spirit): stesso
    // schema di Spirito dell'Acqua (1103) sopra per la Special Summon
    // (banditura di 1 mostro VENTO dal Cimitero), ma reagisce alla End
    // Phase dell'avversario invece della Standby Phase, e senza il
    // vincolo "per il resto del turno" (il testo reale di questa carta
    // non lo richiede — la End Phase è comunque l'ultima fase del turno).
    CardEffects.register(1104, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster' && c.attribute === 'VENTO');
        },
        getSpecialSummonBanishFilters() {
            return [(c) => c.type === 'monster' && c.attribute === 'VENTO'];
        },
        paySpecialSummonCost(ctx) {
            return resolveSpecialSummonBanishCost(ctx, [(c) => c.type === 'monster' && c.attribute === 'VENTO'], '🦅 Garuda lo Spirito del Vento bandisce 1 mostro VENTO dal Cimitero per essere Special Summonato!');
        },
        onOpponentEndPhase(ctx) {
            const candidates = [];
            ctx.field(ctx.opponent).forEach((s, i) => { if (s && !s.isFaceDown) candidates.push({ index: i, card: s.card, position: s.position }); });
            if (candidates.length === 0) return;
            const changeChosen = (entry) => {
                const newPosition = entry.position === 'attack' ? 'defense' : 'attack';
                ctx.changePosition(ctx.opponent, entry.index, newPosition);
                ctx.log(`🦅 Garuda lo Spirito del Vento cambia la Posizione di Battaglia di ${entry.card.name}!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) { changeChosen(candidates[0]); return; }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates.map((c) => c.card),
                titolo: '🦅 Garuda lo Spirito del Vento',
                testo: 'Scegli 1 mostro avversario scoperto di cui cambiare la Posizione di Battaglia.'
            }, (chosenCard) => {
                if (chosenCard === null) return;
                const entry = candidates.find((c) => c.card.uid === chosenCard.uid);
                if (entry) changeChosen(entry);
            });
        }
    });

    // ================================================================
    // DODICESIMA ONDATA PRIMA SERIE (id 1105-1113) — 9 Mostri Effetto minori.
    // ================================================================

    // 1105 — Drago Tiranno (Tyrant Dragon): può attaccare 2 volte nella
    // propria Battle Phase se l'avversario controlla ancora un mostro
    // dopo il primo attacco — def.getExtraAttackCount(ctx) (già
    // esistente, dinamico, ricalcolato ad ogni attacco, nato per Samurai
    // Armato - Ben Kei id 721). Nega e distrugge le Trappole che lo
    // scelgono come bersaglio — stesso schema di Drago Teschio Demoniaco
    // (id 1044, checkpoint di targeting condiviso).
    CardEffects.register(1105, {
        // "Non puo' essere Special Summonata dal Cimitero, a meno che tu
        // non tributi 1 mostro Tipo Drago": il divieto lo applica il
        // punto unico (ACTIONS.specialSummon, duel-engine.js), qui c'e'
        // solo la clausola di riscatto. Il Tributo si paga DENTRO
        // l'eccezione, perche' e' il prezzo per aggirare il divieto: se
        // nessun Drago e' disponibile la funzione torna false e la carta
        // resta nel Cimitero.
        cannotBeSpecialSummonedFromGraveyard: true,
        specialSummonFromGraveyardException(owner, card) {
            const campo = Tavolo.mostri(owner);
            const i = campo.findIndex((s) => s && s.card.race === 'Drago' && s.card.uid !== card.uid);
            if (i === -1) return false;
            const tributato = campo[i].card;
            campo[i] = null;
            (Tavolo.cimitero(owner)).push(tributato);
            addToLog(`🐉 ${tributato.name} viene tributato per Special Summonare ${card.name} dal Cimitero.`);
            return true;
        },
        getExtraAttackCount(ctx) {
            return ctx.field(ctx.opponent).some((s) => s) ? 1 : 0;
        },
        onCardEffectTargetDeclare(ctx) {
            if (!ctx.sourceCard || ctx.sourceType !== 'trap') return;
            ctx.cancel();
            const trapOwner = ctx.sourceOwner;
            const trapIndex = ctx.stField(trapOwner).findIndex((slot) => slot && slot.card.uid === ctx.sourceCard.uid);
            if (trapIndex !== -1) ctx.destroySpellTrap(trapOwner, trapIndex);
            ctx.log(`🐉 Drago Tiranno nega e distrugge ${ctx.sourceCard.name}!`);
        }
    });

    // 1106 — Vampire Baby: se distrugge un mostro in battaglia, alla fine
    // della Battle Phase può Special Summonarlo sul proprio Terreno —
    // nuovo def.onDestroysMonsterByBattle(ctx) (actions.js/fireOnDestroy;
    // vedi il commento lì sulla differenza rispetto al più vecchio
    // def.onDestroysMonsterInBattle, id 833/480/526/625/727) per
    // registrare il bersaglio, poi def.onBattlePhaseEnd (già esistente)
    // per completare la Special Summon se il bersaglio è ancora nel suo
    // Cimitero.
    CardEffects.register(1106, {
        onDestroysMonsterByBattle(ctx) {
            ctx.card._battleDestroyTurn = gameState.turn;
            ctx.card._battleDestroyedCard = ctx.destroyedCard;
            ctx.card._battleDestroyedCardOwner = ctx.destroyedCardOwner;
        },
        onBattlePhaseEnd(ctx) {
            if (ctx.card._battleDestroyTurn !== gameState.turn) return;
            const destroyed = ctx.card._battleDestroyedCard;
            const destroyedOwner = ctx.card._battleDestroyedCardOwner;
            ctx.card._battleDestroyedCard = null;
            if (!destroyed) return;
            const grave = ctx.graveyard(destroyedOwner);
            const idx = grave.findIndex((c) => c.uid === destroyed.uid);
            if (idx === -1) return;
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            // Il Cimitero è quello dell'avversario: specialSummon controlla
            // solo quello di chi Evoca, quindi Necrovalley si guarda qui.
            if (ctx.graveyardMoveNegated(destroyedOwner)) return;
            grave.splice(idx, 1);
            ctx.specialSummon(ctx.owner, destroyed, slotIndex, 'attack', 'graveyard');
            ctx.log(`🧛 Bambino Vampiro Special Summona ${destroyed.name}!`);
        }
    });

    // 1107 — Bazoo il Divora-Anime (Bazoo the Soul-Eater): Ignition una
    // volta per turno, bandisce fino a 3 mostri dal proprio Cimitero per
    // guadagnare 300 ATK ciascuno fino alla fine del turno AVVERSARIO —
    // nuovo store generico e riusabile gameState.untilOpponentTurnAtkDefBonus/
    // untilOpponentTurnActiveUidsFor (game-flow.js/changeTurn,
    // duel-engine.js/getEffectiveAtk-Def), stesso schema di
    // orgothAtkDefBonus (id 395) ma senza duplicarlo una terza volta.
    // SEMPLIFICAZIONE: bandisce sempre il massimo disponibile (fino a 3)
    // invece di un'interfaccia per scegliere quanti.
    CardEffects.register(1107, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            if (ctx.hasUsedOncePerTurn(`1107:${ctx.card.uid}:${gameState.turn}`)) return false;
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster');
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`1107:${ctx.card.uid}:${gameState.turn}`);
            const grave = ctx.graveyard(ctx.owner);
            const toBanish = [];
            for (let i = grave.length - 1; i >= 0 && toBanish.length < 3; i--) {
                if (grave[i].type === 'monster') toBanish.push(grave[i]);
            }
            let banishedCount = 0;
            toBanish.forEach((card) => { if (ctx.banishFromGraveyard(ctx.owner, card)) banishedCount++; });
            if (banishedCount === 0) return;
            gameState.untilOpponentTurnActiveUidsFor[ctx.owner].add(ctx.card.uid);
            const e = gameState.untilOpponentTurnAtkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.untilOpponentTurnAtkDefBonus[ctx.card.uid] = { atk: e.atk + 300 * banishedCount, def: e.def };
            ctx.log(`🐺 Bazoo il Mangia-Anima bandisce ${banishedCount} mostr${banishedCount === 1 ? 'o' : 'i'}: guadagna ${300 * banishedCount} ATK fino alla fine del turno avversario!`);
        }
    });

    // 1108 — Falcos il Saggio Alato (Winged Sage Falcos): se distrugge in
    // battaglia un mostro avversario scoperto in Posizione di ATTACCO
    // (ctx.destroyedWasAttackPosition, nuovo campo del hook
    // onDestroysMonsterByBattle — vedi il commento su fireOnDestroy in
    // actions.js), lo rimanda in cima al Deck avversario invece di
    // lasciarlo nel Cimitero.
    CardEffects.register(1108, {
        onDestroysMonsterByBattle(ctx) {
            if (!ctx.destroyedWasAttackPosition) return;
            const grave = ctx.graveyard(ctx.destroyedCardOwner);
            const idx = grave.findIndex((c) => c.uid === ctx.destroyedCard.uid);
            if (idx === -1) return;
            if (ctx.graveyardMoveNegated(ctx.destroyedCardOwner)) return;
            const [card] = grave.splice(idx, 1);
            const deckKey = Tavolo.chiave(ctx.destroyedCardOwner, 'Deck');
            gameState[deckKey].push(card);
            gameState[Tavolo.chiave(ctx.destroyedCardOwner, 'DeckCount')] = gameState[deckKey].length;
            ctx.log(`🦅 Saggio Falco Alato rimanda ${card.name} in cima al Deck avversario!`);
        }
    });

    // 1109 — Cavaliere Mistico di Sciacallo (Mystical Knight of Jackal):
    // stesso schema di Falcos (1108) sopra, ma senza il vincolo sulla
    // Posizione (il testo reale di questa carta non lo richiede).
    CardEffects.register(1109, {
        onDestroysMonsterByBattle(ctx) {
            const grave = ctx.graveyard(ctx.destroyedCardOwner);
            const idx = grave.findIndex((c) => c.uid === ctx.destroyedCard.uid);
            if (idx === -1) return;
            if (ctx.graveyardMoveNegated(ctx.destroyedCardOwner)) return;
            const [card] = grave.splice(idx, 1);
            const deckKey = Tavolo.chiave(ctx.destroyedCardOwner, 'Deck');
            gameState[deckKey].push(card);
            gameState[Tavolo.chiave(ctx.destroyedCardOwner, 'DeckCount')] = gameState[deckKey].length;
            ctx.log(`⚔️ Cavaliere Mistico dello Sciacallo rimanda ${card.name} in cima al Deck avversario!`);
        }
    });

    // 1110 — Mummia Errante (Wandering Mummy): Ignition una volta per
    // turno per coprirsi in Posizione di Difesa (stesso schema di Des
    // Lacooda id 1052), poi "riordina i mostri coperti in Posizione di
    // Difesa nelle tue zone Mostro". Lo scopo vero è confondere
    // l'avversario su quale carta coperta sia quale, e qui succede davvero:
    // le carte coperte si rimescolano fra le LORO caselle (le altre non si
    // toccano). Il rimescolo usa ctx.random, così in Multiplayer esce uguale
    // sui due client. Un Equip agganciato a una carta spostata segue la
    // carta: equippedToIndex si riallinea alla nuova casella.
    function rimescolaCoperteInDifesa(ctx) {
        const campo = ctx.field(ctx.owner);
        const caselle = [];
        campo.forEach((s, i) => { if (s && s.isFaceDown && s.position === 'defense') caselle.push(i); });
        if (caselle.length < 2) return;
        const slots = caselle.map((i) => campo[i]);
        for (let i = slots.length - 1; i > 0; i--) {
            const j = Math.floor(ctx.random() * (i + 1));
            const t = slots[i]; slots[i] = slots[j]; slots[j] = t;
        }
        caselle.forEach((indice, k) => { campo[indice] = slots[k]; });
        Tavolo.ordine().forEach((lato) => {
            ctx.stField(lato).forEach((st) => {
                if (!st || !st.card.equippedToUid) return;
                const nuovo = campo.findIndex((s) => s && s.card.uid === st.card.equippedToUid);
                if (nuovo !== -1 && st.card.equippedToOwner === ctx.owner) st.card.equippedToIndex = nuovo;
            });
        });
        ctx.log(`🧟 Mummia Errante rimescola ${caselle.length} carte coperte in Difesa.`);
    }
    CardEffects.register(1110, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot || slot.isFaceDown) return false;
            if (ctx.hasUsedOncePerTurn(`1110:${ctx.card.uid}`)) return false;
            return true;
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`1110:${ctx.card.uid}`);
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot) return;
            slot.isFaceDown = true;
            slot.position = 'defense';
            ctx.log('🧟 Mummia Errante si copre in Posizione di Difesa!');
            rimescolaCoperteInDifesa(ctx);
        }
    });

    // 1111 — Apprendista Strega (Witch's Apprentice): finché resta
    // scoperta, tutti i mostri OSCURITÀ guadagnano 500 ATK, tutti i
    // mostri LUCE ne perdono 400 — stesso identico schema di Hoshiningen
    // (id 1074), Attributi invertiti.
    CardEffects.register(1111, {
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown) return;
                    if (slot.card.attribute === 'OSCURITÀ') {
                        const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                        gameState.atkDefBonus[slot.card.uid] = { atk: e.atk + 500, def: e.def };
                    } else if (slot.card.attribute === 'LUCE') {
                        const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                        gameState.atkDefBonus[slot.card.uid] = { atk: e.atk - 400, def: e.def };
                    }
                });
            });
        }
    });

    // 1112 — Spirito Silvano (Woodland Sprite): Ignition, manda al
    // Cimitero 1 Carta Equipaggiamento agganciata a questa carta
    // (ctx.stField + slot.card.equippedToUid, stesso schema già usato da
    // decine di Magie Equipaggiamento in questo file) per infliggere 500
    // danni.
    CardEffects.register(1112, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            return ctx.stField(ctx.owner).some((s) => s && !s.isFaceDown && s.card.equippedToUid === ctx.card.uid);
        },
        activate(ctx) {
            const candidates = [];
            ctx.stField(ctx.owner).forEach((s, i) => { if (s && !s.isFaceDown && s.card.equippedToUid === ctx.card.uid) candidates.push({ index: i, card: s.card }); });
            if (candidates.length === 0) return;
            const sendChosen = (target) => {
                const entry = candidates.find((c) => c.card.uid === target.uid);
                if (!entry) return;
                ctx.destroySpellTrap(ctx.owner, entry.index);
                ctx.dealDamage(ctx.opponent, 500);
                ctx.log(`🌿 Spiritello Silvestre manda ${entry.card.name} al Cimitero e infligge 500 danni!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) { sendChosen(candidates[0].card); return; }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates.map((c) => c.card),
                titolo: '🌿 Spiritello Silvestre',
                testo: 'Scegli 1 Carta Equipaggiamento agganciata a questa carta da mandare al Cimitero.'
            }, (scelta) => {
                if (scelta === null) return;
                sendChosen(scelta);
            });
        }
    });

    // 1113 — Yado Karu: se passa da Posizione di Attacco a Difesa,
    // puoi rimandare in fondo al proprio Deck un numero QUALSIASI di carte
    // dalla mano, nell'ordine che preferisci — def.onPositionChange (già
    // esistente) + chooseUpToNFromList: il giocatore sceglie una carta alla
    // volta e chiude quando ha finito (anche subito: è un "puoi"). L'ordine
    // di scelta è l'ordine in fondo al Deck: la PRIMA scelta finisce più in
    // basso di tutte (indice 0 = fondo, il Deck si pesca da `pop`).
    // Il bot non ne rimanda nessuna: prima si svuotava la mano da solo a
    // ogni cambio di Posizione, una mossa che quasi mai conviene.
    CardEffects.register(1113, {
        onPositionChange(ctx) {
            if (ctx.fromPosition !== 'attack' || ctx.toPosition !== 'defense') return;
            const hand = ctx.hand(ctx.owner);
            if (hand.length === 0) return;
            chooseUpToNFromList(ctx, hand.slice(), hand.length, {
                title: '🐢 Yado Karu',
                text: 'Scegli le carte da rimandare in fondo al Deck, nell\'ordine (la prima va più in basso).',
                pickForBot: () => []
            }, (scelte) => {
                const mano = ctx.hand(ctx.owner);
                const spostate = scelte.filter((c) => {
                    const i = mano.indexOf(c);
                    if (i === -1) return false;
                    mano.splice(i, 1);
                    return true;
                });
                if (spostate.length === 0) return;
                const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
                gameState[deckKey].unshift(...spostate);
                gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = gameState[deckKey].length;
                ctx.log(`🐢 Yado Karu rimanda ${spostate.length} cart${spostate.length === 1 ? 'a' : 'e'} dalla mano in fondo al Deck!`);
            });
        }
    });

    // 1114 — Lupo Bicefalo (Twin-Headed Wolf): finché controlli un ALTRO
    // mostro Tipo Demone, annulla per sempre gli effetti dei Mostri FLIP
    // che questa carta distrugge in battaglia — def.negatesEffectsOfBattleVictims
    // (fireOnDestroy, actions.js), che passa da tutti i modi in cui una
    // battaglia distrugge un mostro: vale anche quando è questa carta a
    // DIFENDERE e a distruggere l'attaccante (prima copriva solo l'attacco
    // vinto). "Mostro Flip" = la definizione della vittima ha un onFlip,
    // stesso controllo usato altrove per riconoscerlo.
    CardEffects.register(1114, {
        negatesEffectsOfBattleVictims(destroyerOwner, destroyer, victim) {
            const victimDef = DuelEngine.getDefinition(victim.id);
            if (!victimDef || typeof victimDef.onFlip !== 'function') return false;
            const campo = Tavolo.mostri(destroyerOwner);
            return campo.some((s) => s && s.card.uid !== destroyer.uid && s.card.race === 'Demone');
        }
    });

    // ================================================================
    // TREDICESIMA ONDATA PRIMA SERIE (id 1115-1117) — 3 Mostri Effetto minori.
    // ================================================================

    // 1115 — Scorpione dalle 8 Chele (8-Claws Scorpion): Ignition una
    // volta per turno per coprirsi (stesso schema di Des Lacooda id
    // 1052); quando attacca un mostro avversario coperto in Posizione
    // di Difesa, il suo ATK diventa 2400 SOLO per il calcolo dei danni
    // — def.onOwnAttackDeclare (già esistente, dispatchato SOLO
    // sull'attaccante stesso, nato per Jirai Gumo id 316/Spirit Ryu id
    // 630) + ctx.grantDamageStepOnlyBonus (già esistente, id 852).
    CardEffects.register(1115, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot || slot.isFaceDown) return false;
            if (ctx.hasUsedOncePerTurn(`1115:${ctx.card.uid}`)) return false;
            return true;
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`1115:${ctx.card.uid}`);
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot) return;
            slot.isFaceDown = true;
            slot.position = 'defense';
            ctx.log('🦂 Scorpione 8 Artigli si copre in Posizione di Difesa!');
        },
        onOwnAttackDeclare(ctx) {
            if (ctx.targetIndex === -1) return;
            const targetSlot = ctx.field(ctx.opponent)[ctx.targetIndex];
            if (!targetSlot || !targetSlot.isFaceDown || targetSlot.position !== 'defense') return;
            const attackerCard = ctx.field(ctx.attackerOwner)[ctx.attackerIndex].card;
            ctx.grantDamageStepOnlyBonus(attackerCard, 2400 - attackerCard.attack, 0);
            ctx.log('🦂 Scorpione 8 Artigli: ATK diventa 2400 solo per il calcolo dei danni!');
        }
    });

    // 1116 — Uomo con Wdjat (A Man with Wdjat): quando Evocato
    // Normalmente e ad ogni propria Standby Phase, guarda 1 carta
    // coperta a scelta dell'avversario (rivelata nel log — nessun
    // cambiamento di stato, esattamente come il testo reale "restituita
    // alla sua posizione originale"). onSpecialSummon no-op per
    // escludere la Special Summon, stesso schema di Invito al Sonno
    // Oscuro (id 1076).
    function peekOpponentSetCard(ctx) {
        const candidates = [];
        ctx.field(ctx.opponent).forEach((s) => { if (s && s.isFaceDown) candidates.push(s.card); });
        ctx.stField(ctx.opponent).forEach((s) => { if (s && s.isFaceDown) candidates.push(s.card); });
        if (candidates.length === 0) return;
        const target = ctx.randomPick(candidates);
        ctx.log(`👁️ Un Uomo con Wdjat guarda una carta coperta dell'avversario: è ${target.name}!`);
    }
    CardEffects.register(1116, {
        onSummon(ctx) { peekOpponentSetCard(ctx); },
        onSpecialSummon() {},
        onStandbyPhase(ctx) { peekOpponentSetCard(ctx); }
    });

    // 1117 — Cobraman Sakuzy: Ignition una volta per turno per coprirsi
    // (stesso schema di Des Lacooda id 1052); quando Evocata Flip,
    // rivela nel log tutte le Magie/Trappole coperte dell'avversario
    // (nessun cambiamento di stato, stesso spirito di Uomo con Wdjat id
    // 1116 sopra).
    CardEffects.register(1117, {
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot || slot.isFaceDown) return false;
            if (ctx.hasUsedOncePerTurn(`1117:${ctx.card.uid}`)) return false;
            return true;
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`1117:${ctx.card.uid}`);
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot) return;
            slot.isFaceDown = true;
            slot.position = 'defense';
            ctx.log('🐍 Uomo Cobra Sakuzy si copre in Posizione di Difesa!');
        },
        onFlip(ctx) {
            const names = [];
            ctx.stField(ctx.opponent).forEach((s) => { if (s && s.isFaceDown) names.push(s.card.name); });
            if (names.length === 0) { ctx.log('🐍 Uomo Cobra Sakuzy: l\'avversario non ha Magie/Trappole coperte da rivelare.'); return; }
            ctx.log(`🐍 Uomo Cobra Sakuzy rivela le Magie/Trappole coperte dell'avversario: ${names.join(', ')}!`);
        }
    });

    // ================================================================
    // QUATTORDICESIMA ONDATA PRIMA SERIE (id 1118-1121) — 4 Mostri Effetto minori.
    // ================================================================

    // 1118 — Sovrano Oscuro Ha Des (Dark Ruler Ha Des): "nega gli effetti
    // dei mostri distrutti in battaglia dai TUOI mostri Demone" —
    // gameState.negatesFiendBattleKillsFor (nuovo, per-owner,
    // ricalcolato ogni render qui sotto), consultato in fireOnDestroy
    // (actions.js) insieme a `opponentBattleCard.race === 'Demone'` —
    // stesso identico schema/store di Onda di Diffusione (id 747), solo
    // con una condizione diversa al posto di un uid specifico.
    CardEffects.register(1118, {
        cannotBeSpecialSummonedFromGraveyard: true,
        static(ctx) {
            gameState.negatesFiendBattleKillsFor[ctx.owner] = true;
        }
    });

    // 1119 — Gradius' Option: non può essere Evocata Normalmente/Set,
    // solo Special Summonata dalla mano scegliendo 1 "Gradius" scoperto
    // sul proprio Terreno — riusa la coppia GENERICA canSpecialSummonFromHand/
    // paySpecialSummonCost (già esistente). ATK/DEF diventano identici a
    // quelli di Gradius, ricalcolati ogni render (gameState.atkDefBonus).
    // Se Gradius lascia il Terreno, questa carta si autodistrugge —
    // def.destroysSelfIfLinkedMonsterMissing (nuovo, opt-in, controllato
    // in recomputeStaticEffects PRIMA di ogni static(), stesso schema/
    // stesso motivo della pulizia degli Equip con bersaglio non più
    // valido qui sopra: mutazione diretta, mai ctx.destroyMonster).
    CardEffects.register(1119, {
        cannotNormalSummon: true,
        destroysSelfIfLinkedMonsterMissing: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.name === 'Gradius');
        },
        paySpecialSummonCost(ctx) {
            const gradiusSlot = ctx.field(ctx.owner).find((s) => s && !s.isFaceDown && s.card.name === 'Gradius');
            if (!gradiusSlot) return false;
            ctx.card.linkedMonsterUid = gradiusSlot.card.uid;
            return true;
        },
        static(ctx) {
            const gradiusSlot = ctx.field(ctx.owner).find((s) => s && !s.isFaceDown && s.card.uid === ctx.card.linkedMonsterUid);
            if (!gradiusSlot) return;
            const gradiusAtk = DuelEngine.getEffectiveAtk(gradiusSlot.card);
            const gradiusDef = DuelEngine.getEffectiveDef(gradiusSlot.card);
            const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk + (gradiusAtk - ctx.card.attack), def: e.def + (gradiusDef - ctx.card.defense) };
        }
    });

    // 1120 — Il Cacciatore dalle 7 Armi (The Hunter with 7 Weapons):
    // quando Evocato Normalmente, dichiara 1 Tipo di mostro — scelto dal
    // giocatore (chooseOption) — e se combatte contro quel Tipo, +1000 ATK
    // SOLO durante il calcolo dei danni via def.damageStepBonus(ctx) (già
    // esistente, generico per attaccante O difensore — role/opponentCard/
    // owner — a differenza di onOwnAttackDeclare usato per 8-Claws
    // Scorpion id 1115, che copre solo il ruolo di attaccante).
    // La dichiarazione si legge solo in battaglia, quindi una scelta che
    // arriva un attimo dopo l'Evocazione non cambia niente: e intanto un
    // popover aperto ferma i cambi di fase (isBlockingModalOpen).
    // Il bot dichiara il Tipo più diffuso fra i mostri scoperti
    // dell'avversario.
    const TIPI_DICHIARABILI_1120 = [
        'Acquatico', 'Bestia', 'Bestia Alata', 'Bestia-Guerriero', 'Demone', 'Dinosauro',
        'Drago', 'Essere Divino', 'Fata', 'Guerriero', 'Incantatore', 'Insetto', 'Macchina',
        'Pesce', 'Pianta', 'Piroico', 'Rettile', 'Roccia', 'Serpente Marino', 'Tuono', 'Zombie'
    ];
    CardEffects.register(1120, {
        onSummon(ctx) {
            if (ctx.summonedVia && ctx.summonedVia !== 'normal') return;
            const raceCounts = {};
            ctx.field(ctx.opponent).forEach((s) => { if (s && !s.isFaceDown && s.card.race) raceCounts[s.card.race] = (raceCounts[s.card.race] || 0) + 1; });
            const inCampo = Object.keys(raceCounts).sort((a, b) => raceCounts[b] - raceCounts[a]);
            // Prima i Tipi che l'avversario ha già in campo (sono quasi
            // sempre la scelta sensata), poi tutti gli altri. Un Tipo in
            // campo che non è nell'elenco classico (carte di altri set)
            // resta comunque dichiarabile.
            const tipi = inCampo.concat(TIPI_DICHIARABILI_1120.filter((t) => !inCampo.includes(t)));
            chooseOption(ctx, {
                title: '🏹 Il Cacciatore dalle 7 Armi',
                text: 'Dichiara un Tipo di mostro: contro un mostro di quel Tipo questa carta guadagna 1000 ATK in battaglia.',
                options: tipi.map((t) => ({ value: t, label: t, icon: inCampo.includes(t) ? '🎯' : '' })),
                pickForBot: () => inCampo[0] || 'Guerriero'
            }, (declared) => {
                if (!declared) return;
                ctx.card.declaredRace = declared;
                ctx.log(`🏹 Il Cacciatore dalle 7 Armi dichiara il Tipo "${declared}"!`);
            });
        },
        onSpecialSummon() {},
        damageStepBonus(ctx) {
            if (!ctx.card.declaredRace || !ctx.opponentCard || ctx.opponentCard.race !== ctx.card.declaredRace) return { atk: 0, def: 0 };
            return { atk: 1000, def: 0 };
        }
    });

    // 1121 — Thunder Nyan Nyan: se controlli un mostro non-LUCE, questa
    // carta si autodistrugge — riusa i monitor globali già esistenti
    // def.onAnyNormalOrFlipSummon/onAnySpecialSummon (nati per Misterioso
    // Burattinaio id 579/Torre d'Ossa Divora-Anime id 664, poi già
    // riusati per una reazione distruttiva da Tigre Re Wanghu/Kotodama
    // id 1077/1078) invece di controllare la condizione dentro static()
    // (evitato deliberatamente: chiamare un'azione distruttiva da dentro
    // static() è rischioso, vedi il commento su
    // destroysSelfIfLinkedMonsterMissing qui sopra) — controlla ad ogni
    // nuovo mostro che entra sul PROPRIO Terreno, non ad ogni render.
    function thunderNyanNyanCheckSelfDestruct(ctx) {
        const ownIndex = ctx.field(ctx.owner).findIndex((s) => s && s.card.uid === ctx.card.uid);
        if (ownIndex === -1) return;
        const hasNonLight = ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.attribute !== 'LUCE');
        if (!hasNonLight) return;
        ctx.destroyMonster(ctx.owner, ownIndex);
        ctx.log('🐱 Tuono Nyan Nyan si autodistrugge: controlli un mostro non-LUCE!');
    }
    // Anche un cambio di controllo (Cambio di Cuore & co.) porta un mostro
    // sul tuo Terreno: def.onOwnFieldGainsMonster (fireControlChangedTrigger,
    // duel-engine.js) copre quel caso, compreso quello in cui è Thunder Nyan
    // Nyan stessa a passare a un Terreno con un mostro non-LUCE.
    CardEffects.register(1121, {
        onAnyNormalOrFlipSummon(ctx) { thunderNyanNyanCheckSelfDestruct(ctx); },
        onAnySpecialSummon(ctx) { thunderNyanNyanCheckSelfDestruct(ctx); },
        onOwnFieldGainsMonster(ctx) { thunderNyanNyanCheckSelfDestruct(ctx); }
    });

    // 1122 — Scorpione d'Acciaio (Steel Scorpion): "un mostro non-Macchina
    // che attacca questa carta verrà distrutto alla End Phase del suo 2°
    // turno dopo l'attacco" — un trigger FORZATO e automatico sul lato
    // DIFENSORE, mai una scelta del giocatore, quindi usa il nuovo hook
    // def.onBeingAttacked (duel-engine.js, dispatch "1.5)" dentro
    // TRIGGER.ON_ATTACK_DECLARE) invece del pre-esistente onAttackDeclare
    // basato su Chain (riservato ad abilità OPZIONALI attivabili dal
    // difensore, es. Suijin/Kazejin "puoi annullare l'attacco"). La coda
    // ritardata riusa ctx.queueDelayedDestroyAtOpponentEndPhase, nuovo
    // meccanismo generico gemello di reviveFromGraveyardWithCountdown/
    // processSelfDestructAtOpponentEndPhase ma per un MOSTRO altrui
    // (l'attaccante, non Scorpione d'Acciaio stesso) — riusabile da
    // qualunque futura carta con lo stesso identico bisogno "distruggi un
    // mostro specifico fra N turni avversari da adesso".
    CardEffects.register(1122, {
        onBeingAttacked(ctx) {
            const attackerSlot = ctx.field(ctx.attackerOwner)[ctx.attackerIndex];
            if (!attackerSlot) return;
            if (attackerSlot.card.race === 'Macchina') return;
            ctx.queueDelayedDestroyAtOpponentEndPhase(ctx.owner, ctx.attackerOwner, attackerSlot.card, 2);
            ctx.log(`⚙️ ${attackerSlot.card.name} verrà distrutto alla 2ª End Phase del suo turno!`);
        }
    });

    // 1123 — Helpoemer: "alla fine della Battle Phase del tuo avversario,
    // se questa carta è nel Cimitero perché distrutta in battaglia, il
    // tuo avversario scarta 1 carta a caso" — usa il nuovo
    // def.canTriggerFromGraveyard (duel-engine.js, dentro
    // firePhaseTrigger: scansiona anche il Cimitero, opt-in generico,
    // riusabile da qualunque futura carta con lo stesso bisogno "se sono
    // nel Cimitero quando scatta questa fase") + il tracker già esistente
    // gameState.battleDestroyedThisTurnFor (nato per Sentinella Cremisi/
    // Lady Panther nella dodicesima ondata) per sapere se QUESTA
    // istanza è finita lì per una distruzione in battaglia. Il controllo
    // "Battle Phase dell'AVVERSARIO" (non la propria) si fa leggendo
    // ctx.gameState.currentPlayer — chi vive la fase — contro ctx.owner
    // (il controllore di Helpoemer): se coincidono è la PROPRIA Battle
    // Phase (non deve scattare), altrimenti è quella dell'avversario.
    // ctx.discardRandomFromHand riusa l'helper condiviso già esistente
    // (stesso usato da Criosfinge id 761 ecc.).
    // SEMPLIFICAZIONE dichiarata (vedi missingEffectNote in cards.json):
    // "non può essere Special Summonata dal Cimitero" NON è applicata —
    // richiederebbe controllare ~105 chiamate a ctx.specialSummon sparse
    // in questo file (nessun choke point condiviso "Special Summon da
    // GY" esiste in questo motore, a differenza di ctx.declareTarget per
    // il targeting), sproporzionato per questa singola clausola di una
    // sola carta.
    CardEffects.register(1123, {
        cannotBeSpecialSummonedFromGraveyard: true,
        canTriggerFromGraveyard: true,
        onBattlePhaseEnd(ctx) {
            if (ctx.gameState.currentPlayer === ctx.owner) return;
            const destroyedList = gameState.battleDestroyedThisTurnFor && gameState.battleDestroyedThisTurnFor[ctx.owner];
            const wasDestroyedByBattle = destroyedList && destroyedList.some((c) => c.uid === ctx.card.uid);
            if (!wasDestroyedByBattle) return;
            ctx.discardRandomFromHand(ctx.opponent);
            ctx.log(`💀 ${ctx.card.name} scatta dal Cimitero: l'avversario scarta 1 carta a caso!`);
        }
    });

    // 1127 — Campanella Cerimoniale / Ceremonial Bell: "entrambi i
    // giocatori tengono la mano rivelata" — puro effetto di UI, nessuna
    // logica di gioco. Floodgate GLOBALE booleano
    // (gameState.bothHandsRevealed, duel-engine.js, ricalcolato ad ogni
    // recomputeStaticEffects), consultato da renderBotHand() (game-flow.js)
    // per mostrare le vere carte del bot al posto dei dorsi finché questa
    // carta resta scoperta in campo (di ENTRAMBI i lati, indipendentemente
    // da chi la controlla — coerente col testo "entrambi i giocatori").
    CardEffects.register(1127, {
        static() {
            gameState.bothHandsRevealed = true;
        }
    });

    // 1128 — Skull Knight #2: "se Tributi questa carta per un'Evocazione
    // Tributo di un mostro Tipo Demone, Special Summon un'altra copia di
    // questa carta dal Deck, poi rimescola il Deck". Usa il nuovo
    // parametro opzionale `summonedCard` di def.onSacrificedForTribute
    // (duel-engine.js/actions.js/bot.js) — passato SOLO dai chiamanti che
    // rappresentano una vera Evocazione Tributo (non un sacrificio come
    // costo di qualcos'altro), quindi qui basta controllare che esista e
    // sia di Tipo Demone. Stesso pattern inline di ricerca+rimescolamento
    // già usato da Ultima Volontà (id 555, Fisher-Yates diretto
    // sull'array del Deck) invece di un nuovo helper condiviso "rimescola
    // e basta" — nessun'altra carta di questo dataset ne ha ancora
    // bisogno.
    CardEffects.register(1128, {
        onSacrificedForTribute(ctx) {
            if (!ctx.summonedCard || ctx.summonedCard.type !== 'monster' || ctx.summonedCard.race !== 'Demone') return;
            const deck = Tavolo.mazzo(ctx.owner, ctx.gameState);
            if (!Array.isArray(deck)) return;
            const deckIdx = deck.findIndex((c) => c.id === 1128);
            if (deckIdx === -1) return;
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const [newCopy] = deck.splice(deckIdx, 1);
            ctx.specialSummon(ctx.owner, newCopy, slotIndex, 'attack', 'deck');
            for (let i = deck.length - 1; i > 0; i--) {
                const j = Math.floor(Casuale.random() * (i + 1));
                [deck[i], deck[j]] = [deck[j], deck[i]];
            }
            ctx.log(`💀 ${ctx.card.name} Special Summona un'altra copia di se stessa dal Deck, poi rimescola il Deck!`);
        }
    });

    // ================================================================
    // 1129/1130 — Great Dezard / Fushioh Richie: coppia con evoluzione a
    // stadi collegata (stesso spirito di Destiny Board, ma più piccola:
    // qui basta un contatore per-istanza, non un intero stato condiviso).
    // Testo reale di Great Dezard: "quando questo mostro distrugge in
    // battaglia il seguente numero di mostri, si attivano in ordine i
    // seguenti effetti: Uno: finché scoperta in campo, annulla
    // l'attivazione e gli effetti di ogni Magia/Trappola che bersaglia
    // questa carta, poi distruggila. Due: puoi Special Summonare 1
    // Fushioh Richie dalla mano o dal Deck tributando questa carta,
    // durante la tua Main Phase." Fushioh Richie ripete la STESSA
    // clausola "annulla+distruggi" (sempre attiva, non a stadi) più "puoi
    // girarla a faccia in giù in Difesa una volta per turno" e "quando
    // viene girata scoperta: Special Summon 1 mostro Zombie dal
    // Cimitero".
    //
    // SEMPLIFICAZIONE dichiarata su ENTRAMBE (vedi missingEffectNote in
    // cards.json): la clausola "annulla+distruggi ogni Magia/Trappola che
    // bersaglia QUESTA carta" non è implementata — richiederebbe sapere,
    // PRIMA che una Magia/Trappola a bersaglio si risolva, se il
    // bersaglio scelto è ESATTAMENTE questa istanza. Il meccanismo
    // esistente per questo (`def.declaredTargeting`, consultato da Campo
    // di Riryoku id 636/La Perla del Drago id 652/Scudo Magico Tipo-8 id
    // 689) espone solo la CATEGORIA del bersaglio dichiarata dalla carta
    // in cima alla Chain (count/cardType/race), MAI l'istanza precisa —
    // stesso limite già documentato per le 9 carte "Categoria B
    // checkpoint di targeting" di questo file (vedi CLAUDE.md). Il resto
    // di entrambe le carte è pienamente implementato.
    //
    // Great Dezard: contatore per-istanza `card._battleDestructionCount`,
    // incrementato dal già esistente def.onDestroysMonsterByBattle
    // (dodicesima ondata di questa sessione) — a 2, sblocca un Ignition
    // che tributa Great Dezard per Special Summonare Fushioh Richie da
    // mano/Deck. Lo slot liberato dal tributo di Great Dezard stesso è
    // SEMPRE quello usato per Fushioh Richie (nessuna ricerca di slot
    // separata necessaria: tributare libera sempre esattamente 1 casella).
    // ================================================================
    function findFushiohRichieCandidate(ctx) {
        const handIdx = ctx.hand(ctx.owner).findIndex((c) => c.id === 1130);
        if (handIdx !== -1) return { zone: ctx.hand(ctx.owner), index: handIdx };
        const deck = Tavolo.mazzo(ctx.owner, ctx.gameState);
        if (Array.isArray(deck)) {
            const deckIdx = deck.findIndex((c) => c.id === 1130);
            if (deckIdx !== -1) return { zone: deck, index: deckIdx };
        }
        return null;
    }
    // Clausola "Uno" di Great Dezard e la protezione di Fushioh Richie:
    // "annulla l'attivazione e gli effetti di ogni Magia/Trappola che
    // bersaglia questa carta, poi distruggila". Il mostro bersaglio viene
    // interpellato per primo dal checkpoint di targeting
    // (declareCardEffectTarget, duel-engine.js), come Gran Scudo Gardna
    // (id 115) e Freed (id 888). Prima mancava: non si poteva sapere se il
    // bersaglio scelto fosse proprio QUESTA carta, perché la maggior parte
    // degli effetti non dichiarava il bersaglio — l'audit 1.0.37 li ha
    // portati tutti al checkpoint. canReactToTargetDeclare e non
    // canActivate: quello serve già alle loro abilità attivabili.
    function reagisceAMagiaTrappolaCheLaBersaglia(ctx) {
        if (ctx.zone !== 'monster') return false;
        const slot = ctx.field(ctx.owner)[ctx.index];
        if (!slot || slot.isFaceDown || slot.card.uid !== ctx.card.uid) return false;
        return ctx.sourceType === 'spell' || ctx.sourceType === 'trap';
    }
    function annullaEDistruggiChiLaBersaglia(ctx) {
        ctx.cancel();
        // Una Normale va comunque al Cimitero a fine risoluzione: si
        // distrugge davvero solo una carta che resterebbe in campo.
        const distrutta = destroyTargetingSpellIfItStays(ctx);
        ctx.log(`🛡️ ${ctx.card.name} annulla ${ctx.sourceCard ? ctx.sourceCard.name : 'la carta'} che la bersaglia${distrutta ? ' e la distrugge' : ''}!`);
    }

    CardEffects.register(1129, {
        // "Uno": attiva dopo il primo mostro distrutto in battaglia.
        canReactToTargetDeclare(ctx) {
            return (ctx.card._battleDestructionCount || 0) >= 1 && reagisceAMagiaTrappolaCheLaBersaglia(ctx);
        },
        onCardEffectTargetDeclare(ctx) { annullaEDistruggiChiLaBersaglia(ctx); },
        onDestroysMonsterByBattle(ctx) {
            ctx.card._battleDestructionCount = (ctx.card._battleDestructionCount || 0) + 1;
            if (ctx.card._battleDestructionCount === 2) {
                ctx.log(`🔮 ${ctx.card.name} ha distrutto 2 mostri in battaglia: ora puoi tributarlo per Special Summonare Fushioh Richie!`);
            }
        },
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            if ((ctx.card._battleDestructionCount || 0) < 2) return false;
            return findFushiohRichieCandidate(ctx) !== null;
        },
        activate(ctx) {
            const candidate = findFushiohRichieCandidate(ctx);
            if (!candidate) return;
            const selfIndex = ctx.field(ctx.owner).findIndex((s) => s && s.card.uid === ctx.card.uid);
            if (selfIndex === -1) return;
            ctx.field(ctx.owner)[selfIndex] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            DuelEngine.notifySacrificedForTribute(ctx.owner, ctx.card);
            const [richie] = candidate.zone.splice(candidate.index, 1);
            ctx.specialSummon(ctx.owner, richie, selfIndex, 'attack', 'graveyard');
            ctx.log(`🔮 ${ctx.card.name} si tributa: Special Summon Fushioh Richie!`);
        }
    });

    // Fushioh Richie: nessun altro percorso di Evocazione registrato
    // (cannotNormalSummon, e nessun canSpecialSummonFromHand/Deck
    // proprio) — l'UNICO modo in cui questa carta entra in campo in
    // pratica è tramite l'activate() di Great Dezard qui sopra, stesso
    // schema di Larva Mostruosa/Grande Falena (id 50/52).
    CardEffects.register(1130, {
        cannotNormalSummon: true,
        // Sempre, finché resta scoperta: vedi reagisceAMagiaTrappolaCheLaBersaglia.
        canReactToTargetDeclare(ctx) { return reagisceAMagiaTrappolaCheLaBersaglia(ctx); },
        onCardEffectTargetDeclare(ctx) { annullaEDistruggiChiLaBersaglia(ctx); },
        canActivate(ctx) {
            if (!(gameState.phase === 'main1' || gameState.phase === 'main2') || gameState.currentPlayer !== ctx.owner) return false;
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot || slot.isFaceDown) return false;
            if (ctx.hasUsedOncePerTurn(`1130:${ctx.card.uid}`)) return false;
            return true;
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`1130:${ctx.card.uid}`);
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot) return;
            slot.isFaceDown = true;
            slot.position = 'defense';
            ctx.log('💀 Fushioh Richie si mette a faccia in giù in Posizione di Difesa!');
        },
        onFlip(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchGraveyardWithChoice(ctx, ctx.owner, (c) => c.type === 'monster' && c.race === 'Zombie', {
                title: '💀 Fushioh Richie',
                text: 'Scegli quale mostro Zombie Special Summonare dal Cimitero.'
            }, (chosen) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) { ctx.graveyard(ctx.owner).push(chosen); return; }
                ctx.specialSummon(ctx.owner, chosen, slotIndex, 'attack', 'graveyard');
                ctx.log(`💀 Fushioh Richie si gira scoperto: Special Summon ${chosen.name} dal Cimitero!`);
            });
        }
    });

    // 1131 — Esiliatore della Luce. Il redirect vive nel push decorato dei
    // Cimiteri (recomputeStaticEffects): copre anche regole preesistenti.
    CardEffects.register(1131, {
        static() { gameState.banishInsteadOfGraveyard = true; }
    });

    // 1132 — Insetto Perforatore: dopo il danno da battaglia mette una
    // copia di Parassita Paracida in cima al proprio Deck.
    CardEffects.register(1132, {
        onDealsBattleDamage(ctx) {
            const deck = Tavolo.mazzo(ctx.owner);
            if (!Array.isArray(deck)) return;
            const index = deck.findIndex((c) => c.id === 1139);
            if (index === -1) return;
            const fine = attendiScelta(ctx);
            chooseOption(ctx, {
                title: '🐛 Insetto-Trapano', text: 'Vuoi mettere Insetto Parassita in cima al Deck?',
                options: [{ value: true, label: 'Sì' }, { value: false, label: 'No' }],
                pickForBot: () => true
            }, (yes) => {
                try {
                    if (!yes) return;
                    const now = deck.findIndex((c) => c.id === 1139);
                    if (now === -1) return;
                    const [parasite] = deck.splice(now, 1);
                    for (let i = deck.length - 1; i > 0; i--) {
                        const j = Math.floor(ctx.random() * (i + 1));
                        [deck[i], deck[j]] = [deck[j], deck[i]];
                    }
                    deck.push(parasite);
                    ctx.log('🐛 Insetto-Trapano mette Insetto Parassita in cima al Deck!');
                } finally { fine(); }
            });
        }
    });

    // 1133 — Golem di Lava: tributa 2 mostri avversari, entra sul loro
    // Terreno e brucia il proprio controllore a ogni Standby Phase.
    CardEffects.register(1133, {
        cannotNormalSummon: true,
        cannotBeSet: true,
        specialSummonToOpponentField: true,
        specialSummonTributeFromOpponent: true,
        specialSummonFixedPosition: 'attack',
        getSpecialSummonTributeFilters() { return [() => true, () => true]; },
        canSpecialSummonFromHand(ctx) {
            return !gameState.hasNormalSummoned && ctx.field(ctx.opponent).filter(Boolean).length >= 2;
        },
        paySpecialSummonCost(ctx) {
            const field = ctx.field(ctx.opponent);
            const pending = gameState.pendingSpecialSummonTributeUids;
            gameState.pendingSpecialSummonTributeUids = null;
            let indices = Array.isArray(pending)
                ? pending.map((uid) => field.findIndex((s) => s && s.card.uid === uid)).filter((i) => i !== -1)
                : [];
            if (indices.length !== 2) indices = field.map((s, i) => s ? i : -1).filter((i) => i !== -1).slice(0, 2);
            if (indices.length !== 2) return false;
            indices.forEach((i) => {
                const slot = field[i];
                const owner = slot.originalOwner || ctx.opponent;
                ctx.graveyard(owner).push(slot.card);
                field[i] = null;
                DuelEngine.notifySacrificedForTribute(ctx.opponent, slot.card, ctx.card);
            });
            gameState.hasNormalSummoned = true;
            return true;
        },
        onStandbyPhase(ctx) {
            ctx.dealDamage(ctx.owner, 1000);
            ctx.log('🌋 Golem di Lava infligge 1000 danni al suo controllore!');
        }
    });

    CardEffects.register(1134, {
        onSummon(ctx) {
            if ((ctx.card._tributeCountForSummon || 0) !== 3) return;
            for (let i = ctx.stField(ctx.opponent).length - 1; i >= 0; i--) {
                if (ctx.stField(ctx.opponent)[i]) ctx.destroySpellTrap(ctx.opponent, i);
            }
            ctx.log('💧 Creatura dell’Umidità distrugge tutte le Magie/Trappole avversarie!');
        }
    });

    // Patrician viene consultato dal punto unico di dichiarazione attacco.
    CardEffects.register(1135, { controllerChoosesOpponentAttackTargets: true });

    CardEffects.register(1136, {
        onReturnedToDeckSelf(ctx) {
            if (!ctx.wasFaceUp || ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && (c.level || 0) <= 3, {
                title: '🐍 Principessa Serpentina', text: 'Scegli un mostro di Livello 3 o inferiore da Special Summonare.'
            }, (card) => {
                const slot = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slot !== -1) ctx.specialSummon(ctx.owner, card, slot, 'attack', 'deck');
                else Tavolo.mazzo(ctx.owner).push(card);
            });
        }
    });

    // Giara Trasformante #2: la risoluzione è simultanea per i due lati;
    // prima rimescola i mostri, poi scava e piazza coperti i Livello <=4.
    CardEffects.register(1137, {
        onFlip(ctx) {
            Tavolo.ordine().forEach((owner) => {
                const field = ctx.field(owner);
                const returned = [];
                field.forEach((slot, index) => {
                    if (!slot) return;
                    field[index] = null;
                    if (slot.card.isToken) return;
                    if (slot.card.extraDeck) Tavolo.extraDeck(slot.originalOwner || owner).push(slot.card);
                    else returned.push(slot.card);
                });
                ctx.shuffleIntoDeck(owner, returned);
                const deck = Tavolo.mazzo(owner);
                if (!Array.isArray(deck)) return;
                const wanted = returned.length;
                const excavated = [];
                const monsters = [];
                while (deck.length && monsters.length < wanted) {
                    const card = deck.pop();
                    excavated.push(card);
                    if (card.type === 'monster') monsters.push(card);
                }
                monsters.forEach((card) => {
                    const ex = excavated.indexOf(card);
                    if (ex !== -1) excavated.splice(ex, 1);
                    if ((card.level || 0) <= 4 && ctx.findEmptyMonsterSlot(owner) !== -1) {
                        ctx.specialSummon(owner, card, ctx.findEmptyMonsterSlot(owner), 'defense', 'deck');
                        const slot = ctx.field(owner).find((s) => s && s.card.uid === card.uid);
                        if (slot) slot.isFaceDown = true;
                    } else ctx.graveyard(owner).push(card);
                });
                excavated.forEach((card) => ctx.graveyard(owner).push(card));
            });
            ctx.log('🏺 Giara della Mutazione #2 rimescola i mostri e rinnova entrambi i Terreni!');
        }
    });

    CardEffects.register(1138, {
        onFlip(ctx) {
            const candidates = collectFieldTargets(ctx, { zone: 'monster', owner: 'both', includiCoperte: false });
            if (!candidates.length) return;
            chooseFieldMonsterTarget(ctx, candidates, { title: '🛡️ Guardia Misteriosa', text: 'Scegli il mostro da mettere in cima al Deck.', dichiara: true }, (chosen) => {
                ctx.returnMonsterToDeck(chosen.owner, chosen.index, { shuffle: false });
                const hasWarrior = ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.race === 'Guerriero');
                if (!hasWarrior) return;
                const extra = collectFieldTargets(ctx, { zone: 'monster', owner: 'both', includiCoperte: false });
                if (!extra.length) return;
                chooseOption(ctx, {
                    title: '🛡️ Guardia Misteriosa', text: 'Vuoi far tornare in mano anche un secondo mostro?',
                    options: [{ value: true, label: 'Sì' }, { value: false, label: 'No' }],
                    pickForBot: () => true
                }, (yes) => {
                    if (!yes) return;
                    chooseFieldMonsterTarget(ctx, extra, { title: '🛡️ Guardia Misteriosa', text: 'Scegli il secondo mostro da far tornare in mano.', dichiara: true }, (second) => {
                        ctx.returnMonsterToHand(second.owner, second.index);
                    });
                });
            });
        }
    });

    CardEffects.register(1139, {
        onFlip(ctx) {
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((s) => s && s.card.uid === ctx.card.uid);
            const deck = Tavolo.mazzo(ctx.opponent);
            if (index === -1 || !Array.isArray(deck)) return;
            field[index] = null;
            deck.push(ctx.card);
            for (let i = deck.length - 1; i > 0; i--) {
                const j = Math.floor(ctx.random() * (i + 1));
                [deck[i], deck[j]] = [deck[j], deck[i]];
            }
            ctx.card._parasiteOriginalOwner = ctx.owner;
            ctx.log('🐛 Insetto Parassita si nasconde scoperto nel Deck avversario!');
        },
        onDrawn(ctx) {
            if (!ctx.card._parasiteOriginalOwner) return false;
            const slot = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slot === -1) { ctx.graveyard(ctx.owner).push(ctx.card); return true; }
            ctx.specialSummon(ctx.owner, ctx.card, slot, 'defense', 'deck');
            const summoned = ctx.field(ctx.owner)[slot];
            if (summoned && summoned.card.uid === ctx.card.uid) summoned.isFaceDown = false;
            ctx.dealDamage(ctx.owner, 1000);
            ctx.log('🐛 Insetto Parassita viene pescato: Special Summon e 1000 danni!');
            return true;
        },
        static(ctx) {
            if (!ctx.card._parasiteOriginalOwner) return;
            // Dal punto di vista del controllore attuale di Paracida, il
            // suo "avversario" è il proprietario che l'aveva inserita.
            // Usiamo l'override già ripristinato a ogni End Phase invece
            // di mutare permanentemente il Tipo stampato sulla carta.
            ctx.field(ctx.opponent).forEach((slot) => {
                if (slot && !slot.isFaceDown) ctx.overrideRaceUntilEndOfTurn(slot.card, 'Insetto');
            });
            gameState.raceOverrideFloodgateFor = gameState.raceOverrideFloodgateFor || {};
            gameState.raceOverrideFloodgateFor[ctx.opponent] = 'Insetto';
        }
    });

    CardEffects.register(1140, {
        onFlip(ctx) {
            // Rifornimento sposta davvero carte fuori dal Cimitero: sotto
            // Necrovalley l'effetto deve fermarsi prima ancora di mostrare
            // una scelta che non potrebbe poi essere risolta.
            if (ctx.graveyardMoveNegated(ctx.owner)) return;
            const grave = ctx.graveyard(ctx.owner);
            const candidates = grave.filter((card) => card._usedAsFusionMaterial || card._fusionMaterialGroup);
            if (candidates.length < 2) return;
            const fine = attendiScelta(ctx);
            chooseUpToNFromList(ctx, candidates, 2, {
                min: 2, title: '📦 Rifornimento', text: 'Scegli i 2 Materiali da Fusione da riprendere in mano.'
            }, (chosen) => {
                try {
                    // La scelta e la sua callback non sono necessariamente
                    // sincrone: ricontrolliamo il blocco anche in risoluzione,
                    // nel caso Necrovalley sia entrata in Campo nel frattempo.
                    if (ctx.graveyardMoveNegated(ctx.owner)) return;
                    chosen.forEach((card) => {
                        const index = grave.indexOf(card);
                        if (index !== -1) ctx.hand(ctx.owner).push(grave.splice(index, 1)[0]);
                    });
                    if (chosen.length === 2) ctx.log('📦 Rifornimento recupera 2 Materiali da Fusione dal Cimitero!');
                } finally { fine(); }
            });
        }
    });

    // ================================================================
    // 1141-1160 — Fusioni storiche LOB/MRD/PSV/LOD/PGD e quattro
    // materiali normali mancanti. Le 14 Fusioni senza effetto dichiarano
    // soltanto i materiali: tutta la procedura resta quella condivisa di
    // DuelEngine.getFusableExtraDeckMonsters/ACTIONS.fusionSummon.
    // ================================================================
    [
        [1141, 922, 913], [1142, 1062, 495], [1143, 909, 1157],
        [1144, 940, 951], [1145, 1012, 944], [1146, 526, 905],
        [1147, 444, 1158], [1148, 402, 923], [1149, 949, 946],
        [1150, 918, 919], [1151, 929, 1159], [1152, 939, 948],
        [1154, 1010, 945], [1156, 1098, 1160]
    ].forEach(([id, primo, secondo]) => {
        CardEffects.register(id, { fusionMaterials: [primo, secondo] });
    });

    // Mietitore dell'Incubo: stessa struttura di Mietitore Spirituale,
    // ma come Fusione di Mietitore Spirituale + Cavallo dell'Incubo.
    CardEffects.register(1153, {
        fusionMaterials: [661, 1053],
        cannotBeDestroyedByBattle: true,
        static(ctx) { gameState.directAttackAllowedUids[ctx.card.uid] = true; },
        canActivate(ctx) { return ctx.zone === 'monster'; },
        onCardEffectTargetDeclare(ctx) {
            const index = ctx.field(ctx.owner).findIndex((s) => s && s.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.destroyMonster(ctx.owner, index);
            ctx.log(`💀 ${ctx.card.name} viene distrutto dopo essere stato scelto come bersaglio!`);
        },
        onDealsBattleDamage(ctx) {
            if (ctx.targetIndex !== -1) return;
            const discarded = ctx.discardRandomFromHand(ctx.opponent);
            if (discarded) ctx.log(`💀 ${ctx.card.name} forza l'avversario a scartare ${discarded.name}!`);
        }
    });

    // Ryu Senshi: nega una Trappola Normale pagando 1000 LP e respinge
    // qualsiasi Magia che lo bersaglia. Entrambi i percorsi riusano i
    // checkpoint generici già impiegati da Balter e Freed.
    CardEffects.register(1155, {
        fusionMaterials: [504, 630],
        canRespondAsQuickEffect: true,
        canActivate(ctx) {
            if (Tavolo.lp(ctx.owner) <= 1000) return false;
            const chain = ctx.gameState.chain;
            if (!chain || !chain.links || chain.links.length === 0) return false;
            const top = chain.links[chain.links.length - 1];
            return !!(top.card && top.card.type === 'trap' && top.card.subtype === 'normal' && !top.negated);
        },
        activate(ctx) {
            ctx.dealDamage(ctx.owner, 1000);
            if (ctx.negateActivation()) ctx.log('🐉 Ryu Senshi paga 1000 LP e nega la Trappola Normale!');
        },
        canReactToTargetDeclare(ctx) {
            if (ctx.zone !== 'monster' || ctx.sourceType !== 'spell') return false;
            const slot = ctx.field(ctx.owner)[ctx.index];
            return !!(slot && !slot.isFaceDown && slot.card.uid === ctx.card.uid);
        },
        onCardEffectTargetDeclare(ctx) {
            ctx.cancel();
            const distrutta = destroyTargetingSpellIfItStays(ctx);
            ctx.log(`🐉 Ryu Senshi annulla la Magia che lo bersaglia${distrutta ? ' e la distrugge' : ''}!`);
        }
    });

    // ================================================================
    // CARTE SENZA CODICE BESPOKE — libreria per il futuro Card Maker
    // (vedi js/engine/effect-templates.js, js/data/custom-cards.js): una carta in
    // cardDatabase può dichiarare "effectTemplate"/"cloneEffectOf" invece
    // di avere un blocco CardEffects.register scritto a mano come tutti
    // quelli sopra. Scandisce cardDatabase una sola volta, qui in fondo
    // (dopo ogni registrazione bespoke di questo file, così cloneEffectOf
    // può riferirsi anche a una di quelle) — non tocca né sovrascrive MAI
    // una carta già registrata sopra.
    // ================================================================
    // Supporti moderni Occhi Rossi. Restano fuori dai deck avversari finche'
    // l'audit del pacchetto non dimostra dove siano davvero necessari.
    const isRedEyesMonster = (card) => card && card.type === 'monster' && cardHasArchetype(card, 'red-eyes');
    const isRedEyesCard = (card) => card && cardHasArchetype(card, 'red-eyes');
    const blackStoneKey = (owner) => `black-stone-of-legend:${owner}`;

    CardEffects.register(1250, {
        archetypes: ['red-eyes'],
        canActivate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner);
            return ctx.zone === 'monster' && !ctx.hasUsedOncePerTurn(blackStoneKey(ctx.owner))
                && Array.isArray(deck) && deck.some((c) => isRedEyesMonster(c) && (c.level || 0) <= 7 && c.id !== 1250);
        },
        activate(ctx) {
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot || slot.card.uid !== ctx.card.uid) return;
            const deck = Tavolo.mazzo(ctx.owner);
            if (!Array.isArray(deck) || !deck.some((c) => isRedEyesMonster(c) && (c.level || 0) <= 7 && c.id !== 1250)) return;
            ctx.field(ctx.owner)[ctx.index] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            DuelEngine.notifySacrificedForTribute(ctx.owner, ctx.card);
            ctx.markUsedOncePerTurn(blackStoneKey(ctx.owner));
            searchDeckWithChoice(ctx, (c) => isRedEyesMonster(c) && (c.level || 0) <= 7 && c.id !== 1250, {
                title: 'La Pietra Nera della Leggenda',
                text: 'Scegli quale mostro Occhi Rossi Evocare Specialmente dal Deck.',
                pickForBot: (cards) => cards.reduce((best, c) => !best || c.attack > best.attack ? c : best, null)
            }, (chosen) => {
                const free = ctx.findEmptyMonsterSlot(ctx.owner);
                if (free === -1) { ctx.graveyard(ctx.owner).push(chosen); return; }
                ctx.specialSummon(ctx.owner, chosen, free, 'attack', 'deck');
                ctx.log(`${ctx.card.name} Evoca Specialmente ${chosen.name} dal Deck!`);
            });
        },
        canActivateFromGraveyardMainPhase(ctx) {
            return !ctx.hasUsedOncePerTurn(blackStoneKey(ctx.owner))
                && ctx.graveyard(ctx.owner).some((c) => c.uid !== ctx.card.uid && isRedEyesMonster(c) && (c.level || 0) <= 7 && c.id !== 1250);
        },
        activateFromGraveyardMainPhase(ctx) {
            const opened = searchGraveyardWithChoice(ctx, ctx.owner,
                (c) => c.uid !== ctx.card.uid && isRedEyesMonster(c) && (c.level || 0) <= 7 && c.id !== 1250,
                { title: 'La Pietra Nera della Leggenda', text: 'Scegli quale mostro Occhi Rossi mischiare nel Deck.' },
                (chosen) => {
                    const grave = ctx.graveyard(ctx.owner);
                    const selfIndex = grave.findIndex((c) => c.uid === ctx.card.uid);
                    if (selfIndex === -1 || ctx.graveyardMoveNegated(ctx.owner)
                        || !ctx.shuffleIntoDeck(ctx.owner, [chosen])) { grave.push(chosen); return; }
                    const [stone] = grave.splice(selfIndex, 1);
                    ctx.hand(ctx.owner).push(stone);
                    ctx.log(`${chosen.name} torna nel Deck e ${stone.name} torna in mano!`);
                });
            if (opened) ctx.markUsedOncePerTurn(blackStoneKey(ctx.owner));
        }
    });

    CardEffects.register(1251, {
        archetypes: ['red-eyes'],
        canActivate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner);
            if (ctx.hasUsedOncePerTurn(`red-eyes-insight:${ctx.owner}`) || !Array.isArray(deck)) return false;
            const hasCost = ctx.hand(ctx.owner).some((c) => c.uid !== ctx.card.uid && isRedEyesMonster(c)) || deck.some(isRedEyesMonster);
            return hasCost && deck.some((c) => c.id !== 1251 && (c.type === 'spell' || c.type === 'trap') && isRedEyesCard(c));
        },
        activate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner);
            const inHand = ctx.hand(ctx.owner).some((c) => c.uid !== ctx.card.uid && isRedEyesMonster(c));
            const inDeck = Array.isArray(deck) && deck.some(isRedEyesMonster);
            const afterCost = (sent) => {
                if (!sent) return;
                ctx.markUsedOncePerTurn(`red-eyes-insight:${ctx.owner}`);
                searchDeckWithChoice(ctx, (c) => c.id !== 1251 && (c.type === 'spell' || c.type === 'trap') && isRedEyesCard(c), {
                    title: 'Intuizione Occhi Rossi', text: 'Scegli quale Magia/Trappola Occhi Rossi aggiungere alla mano.'
                }, (chosen) => {
                    ctx.hand(ctx.owner).push(chosen);
                    ctx.log(`${sent.name} va al Cimitero: ${chosen.name} viene aggiunta alla mano!`);
                });
            };
            const send = (zone) => {
                if (zone === 'hand') {
                    chooseCardFromHand(ctx, {
                        filter: (c) => c.uid !== ctx.card.uid && isRedEyesMonster(c),
                        title: 'Intuizione Occhi Rossi', text: 'Scegli quale mostro Occhi Rossi mandare dalla mano al Cimitero.'
                    }, (card, index) => afterCost(ctx.sendChosenFromHandToGraveyard(ctx.owner, index)));
                    return;
                }
                searchDeckWithChoice(ctx, isRedEyesMonster, {
                    title: 'Intuizione Occhi Rossi', text: 'Scegli quale mostro Occhi Rossi mandare dal Deck al Cimitero.'
                }, (card) => {
                    ctx.graveyard(ctx.owner).push(card);
                    DuelEngine.notifyOwnMonsterSentToGraveyard(ctx.owner, card);
                    afterCost(card);
                });
            };
            if (inHand && inDeck) {
                chooseOption(ctx, {
                    title: 'Intuizione Occhi Rossi', text: 'Da dove vuoi mandare il mostro al Cimitero?',
                    options: [{ value: 'deck', label: 'Dal Deck' }, { value: 'hand', label: 'Dalla mano' }],
                    pickForBot: () => 'deck'
                }, send);
            } else send(inHand ? 'hand' : 'deck');
        }
    });

    CardEffects.register(1252, {
        archetypes: ['red-eyes'],
        canActivate(ctx) { return ctx.findEmptyMonsterSlot(ctx.owner) !== -1 && ctx.graveyard(ctx.owner).some(isRedEyesMonster); },
        activate(ctx) {
            searchGraveyardWithChoice(ctx, ctx.owner, isRedEyesMonster, {
                title: 'Spirito Occhi Rossi', text: 'Scegli quale mostro Occhi Rossi Evocare Specialmente.'
            }, (chosen) => {
                const free = ctx.findEmptyMonsterSlot(ctx.owner);
                if (free === -1) { ctx.graveyard(ctx.owner).push(chosen); return; }
                ctx.specialSummon(ctx.owner, chosen, free, 'attack', 'graveyard');
                ctx.log(`${chosen.name} ritorna dal Cimitero!`);
            });
        }
    });

    const searchBlackMetal = (ctx) => searchDeckWithChoice(ctx, (c) => c.id !== 1253 && isRedEyesCard(c), {
        title: 'Drago Metallico Nero', text: 'Scegli quale carta Occhi Rossi aggiungere alla mano.'
    }, (chosen) => {
        ctx.hand(ctx.owner).push(chosen);
        ctx.log(`${ctx.card.name} cerca ${chosen.name} dal Deck!`);
    });
    CardEffects.register(1253, {
        archetypes: ['red-eyes'],
        continuous: true,
        isEquip: true,
        canActivate(ctx) {
            if (ctx.zone !== 'hand' && ctx.zone !== 'monster') return false;
            if (ctx.zone === 'monster' && DuelEngine.findFreeSTSlot(ctx.owner) === -1) return false;
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.uid !== ctx.card.uid && isRedEyesMonster(s.card));
        },
        activate(ctx) {
            if (ctx.zone === 'monster') {
                const slot = ctx.field(ctx.owner)[ctx.index];
                const free = DuelEngine.findFreeSTSlot(ctx.owner);
                if (!slot || slot.card.uid !== ctx.card.uid || free === -1) return;
                ctx.field(ctx.owner)[ctx.index] = null;
                ctx.stField(ctx.owner)[free] = { card: ctx.card, isFaceDown: false, setOnTurn: gameState.turn };
                ctx.index = free;
            }
            equipToChosenTarget(ctx, isRedEyesMonster);
        },
        static(ctx) {
            if (!ctx.card.equippedToOwner) return;
            const target = equippedTarget(ctx);
            const bonus = gameState.atkDefBonus[target.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[target.uid] = { atk: bonus.atk + 600, def: bonus.def };
        },
        onDestroy: searchBlackMetal,
        onSacrificedForTribute: searchBlackMetal,
        onSentToGraveyardFromField: searchBlackMetal
    });

    // ================================================================
    // Supporti moderni Mago Nero — primo pacchetto. Nessuna di queste
    // carte entra ancora nei deck avversari: prima vengono validate in
    // isolamento e poi misurate a 1/2/3 copie, come per Occhi Rossi.
    // ================================================================
    const isDarkMagician = (card) => card && card.type === 'monster'
        && cardHasEffectiveName(card, 'Mago Nero');
    const mentionsDarkMagician = (card) => card && cardMentionsName(card, 'Mago Nero');

    CardEffects.register(1254, {
        archetypes: ['dark-magician'],
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal' || ctx.hasUsedOncePerTurn(`magicians-rod-search:${ctx.owner}`)) return;
            ctx.markUsedOncePerTurn(`magicians-rod-search:${ctx.owner}`);
            searchDeckWithChoice(ctx,
                (c) => (c.type === 'spell' || c.type === 'trap') && mentionsDarkMagician(c),
                { title: 'Verga del Mago', text: 'Scegli una Magia/Trappola che cita Mago Nero da aggiungere alla mano.' },
                (chosen) => {
                    ctx.hand(ctx.owner).push(chosen);
                    ctx.log(`${ctx.card.name} aggiunge ${chosen.name} alla mano!`);
                });
        },
        canActivateOnCardActivatedWhileInGraveyard(ctx) {
            const key = `magicians-rod-grave:${ctx.owner}`;
            return gameState.currentPlayer === ctx.opponent
                && ctx.activatedOwner === ctx.owner
                && ctx.activatedCard && (ctx.activatedCard.type === 'spell' || ctx.activatedCard.type === 'trap')
                && !ctx.hasUsedOncePerTurn(key)
                && ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.race === 'Incantatore');
        },
        onCardActivatedWhileInGraveyard(ctx) {
            const candidates = collectFieldTargets(ctx, {
                owner: 'self', zone: 'monster',
                filter: (card, owner, slot) => !slot.isFaceDown && card.race === 'Incantatore'
            });
            chooseFieldCardTarget(ctx, candidates, {
                title: 'Verga del Mago',
                text: 'Offri come Tributo 1 Incantatore per riprendere Verga del Mago.',
                dichiara: false
            }, (chosen) => {
                const slot = ctx.field(chosen.owner)[chosen.index];
                const grave = ctx.graveyard(ctx.owner);
                const rodIndex = grave.findIndex((c) => c.uid === ctx.card.uid);
                if (!slot || rodIndex === -1) return;
                if (ctx.graveyardMoveNegated(ctx.owner)) return;
                const tribute = slot.card;
                ctx.field(chosen.owner)[chosen.index] = null;
                ctx.graveyard(chosen.owner).push(tribute);
                DuelEngine.notifySacrificedForTribute(chosen.owner, tribute);
                const [rod] = grave.splice(rodIndex, 1);
                ctx.hand(ctx.owner).push(rod);
                ctx.markUsedOncePerTurn(`magicians-rod-grave:${ctx.owner}`);
                ctx.log(`${tribute.name} viene offerto: ${rod.name} torna in mano!`);
            });
        }
    });

    const darkCircleKey = (owner, effect) => `dark-magical-circle:${effect}:${owner}`;
    const banishCircleTarget = (ctx) => {
        if (ctx.hasUsedOncePerTurn(darkCircleKey(ctx.owner, 'banish'))) return;
        const candidates = collectFieldTargets(ctx, { owner: 'opponent', zone: 'both', includiCoperte: true });
        if (candidates.length === 0) return;
        chooseFieldCardTarget(ctx, candidates, {
            title: 'Circolo Magico Nero', text: 'Scegli 1 carta controllata dall’avversario da bandire.', dichiara: true
        }, (chosen) => {
            const zone = chosen.zone === 'monster' ? ctx.field(chosen.owner) : ctx.stField(chosen.owner);
            const slot = zone[chosen.index];
            if (!slot) return;
            zone[chosen.index] = null;
            ctx.banish(chosen.owner, slot.card);
            ctx.markUsedOncePerTurn(darkCircleKey(ctx.owner, 'banish'));
            ctx.log(`${ctx.card.name} bandisce ${slot.card.name}!`);
        });
    };
    CardEffects.register(1255, {
        archetypes: ['dark-magician'],
        continuous: true,
        canActivate(ctx) { return !ctx.hasUsedOncePerTurn(darkCircleKey(ctx.owner, 'look')); },
        activate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner);
            if (!Array.isArray(deck) || deck.length === 0) return;
            ctx.markUsedOncePerTurn(darkCircleKey(ctx.owner, 'look'));
            const seen = deck.splice(Math.max(0, deck.length - 3));
            const eligible = seen.filter((c) => isDarkMagician(c)
                || ((c.type === 'spell' || c.type === 'trap') && mentionsDarkMagician(c)));
            const finish = (chosen) => {
                if (chosen) {
                    const i = seen.indexOf(chosen);
                    if (i !== -1) seen.splice(i, 1);
                    ctx.hand(ctx.owner).push(chosen);
                    ctx.log(`${ctx.card.name} rivela e aggiunge ${chosen.name} alla mano!`);
                } else ctx.log(`${ctx.card.name} guarda le prime carte del Deck senza trovarne una idonea.`);
                // In assenza di un ordinatore dedicato, le carte non prese
                // tornano in cima nello stesso ordine relativo: nessuna
                // informazione viene persa e il comportamento è stabile in
                // Multiplayer.
                deck.push(...seen);
                gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
            };
            if (eligible.length === 0) finish(null);
            else chooseCardFromList(ctx, eligible, {
                title: 'Circolo Magico Nero', text: 'Scegli Mago Nero o una carta che lo cita.'
            }, finish);
        },
        onAnyNormalOrFlipSummon(ctx) {
            if (ctx.summonedVia !== 'normal' || !isDarkMagician(ctx.summonedCard)) return;
            if (!ctx.field(ctx.owner).some((s) => s && s.card.uid === ctx.summonedCard.uid)) return;
            banishCircleTarget(ctx);
        },
        onAnySpecialSummon(ctx) {
            if (!isDarkMagician(ctx.summonedCard)) return;
            if (!ctx.field(ctx.owner).some((s) => s && s.card.uid === ctx.summonedCard.uid)) return;
            banishCircleTarget(ctx);
        }
    });

    const eternalSoulLeave = (ctx) => {
        if (ctx.card._eternalSoulLeaveResolved) return;
        ctx.card._eternalSoulLeaveResolved = true;
        ctx.destroyAllMonsters(ctx.owner);
        ctx.log(`${ctx.card.name} lascia il Terreno: tutti i tuoi mostri vengono distrutti!`);
    };
    CardEffects.register(1256, {
        archetypes: ['dark-magician'],
        continuous: true,
        canActivate(ctx) {
            if (ctx.hasUsedOncePerTurn(`eternal-soul:${ctx.owner}`)) return false;
            const deck = Tavolo.mazzo(ctx.owner) || [];
            return (ctx.findEmptyMonsterSlot(ctx.owner) !== -1
                    && (ctx.hand(ctx.owner).some(isDarkMagician) || ctx.graveyard(ctx.owner).some(isDarkMagician)))
                || deck.some((c) => c.id === 474 || c.id === 748);
        },
        activate(ctx) {
            ctx.card._eternalSoulLeaveResolved = false;
            const deck = Tavolo.mazzo(ctx.owner) || [];
            const canSummon = ctx.findEmptyMonsterSlot(ctx.owner) !== -1
                && (ctx.hand(ctx.owner).some(isDarkMagician) || ctx.graveyard(ctx.owner).some(isDarkMagician));
            const canSearch = deck.some((c) => c.id === 474 || c.id === 748);
            const resolve = (choice) => {
                ctx.markUsedOncePerTurn(`eternal-soul:${ctx.owner}`);
                if (choice === 'search') {
                    searchDeckWithChoice(ctx, (c) => c.id === 474 || c.id === 748, {
                        title: 'Anima Immortale', text: 'Scegli Attacco Mago Nero o Mille Coltelli.'
                    }, (chosen) => { ctx.hand(ctx.owner).push(chosen); });
                    return;
                }
                const pool = ctx.hand(ctx.owner).filter(isDarkMagician)
                    .concat(ctx.graveyard(ctx.owner).filter(isDarkMagician));
                chooseCardFromList(ctx, pool, {
                    title: 'Anima Immortale', text: 'Scegli un Mago Nero da Evocare Specialmente.'
                }, (chosen) => {
                    let i = ctx.hand(ctx.owner).indexOf(chosen);
                    let from = 'hand';
                    if (i !== -1) ctx.hand(ctx.owner).splice(i, 1);
                    else {
                        from = 'graveyard';
                        i = ctx.graveyard(ctx.owner).indexOf(chosen);
                        if (i === -1) return;
                        ctx.graveyard(ctx.owner).splice(i, 1);
                    }
                    const free = ctx.findEmptyMonsterSlot(ctx.owner);
                    if (free === -1) { (from === 'hand' ? ctx.hand(ctx.owner) : ctx.graveyard(ctx.owner)).push(chosen); return; }
                    ctx.specialSummon(ctx.owner, chosen, free, 'attack', from);
                });
            };
            if (canSummon && canSearch) chooseOption(ctx, {
                title: 'Anima Immortale', text: 'Scegli quale effetto applicare.',
                options: [{ value: 'summon', label: 'Evoca Mago Nero' }, { value: 'search', label: 'Cerca una Magia' }],
                pickForBot: () => 'summon'
            }, resolve);
            else resolve(canSummon ? 'summon' : 'search');
        },
        static(ctx) {
            ctx.field(ctx.owner).forEach((slot) => {
                if (slot && !slot.isFaceDown && isDarkMagician(slot.card)) {
                    gameState.unaffectedByOpponentCardEffectsUids[slot.card.uid] = ctx.owner;
                }
            });
        },
        onSentToGraveyardFromField: eternalSoulLeave,
        onBanished: eternalSoulLeave,
        onReturnedToHandSelf: eternalSoulLeave
    });

    const isDarkMagicianGirl = (card) => card && card.type === 'monster'
        && (card.id === 188 || cardHasEffectiveName(card, 'Ragazza Maga Nera'));
    const isDarkMagicianPair = (card) => isDarkMagician(card) || isDarkMagicianGirl(card);

    CardEffects.register(1257, {
        archetypes: ['dark-magician'],
        mentionsNames: ['Mago Nero', 'Ragazza Maga Nera'],
        continuous: true,
        canActivate(ctx) { return !ctx.hasUsedOncePerTurn(`magicians-salvation-activate:${ctx.owner}`); },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`magicians-salvation-activate:${ctx.owner}`);
            const free = DuelEngine.findFreeSTSlot(ctx.owner);
            if (free === -1) return;
            searchDeckWithChoice(ctx, (c) => c.id === 1256, {
                title: 'Salvataggio del Mago', text: 'Posiziona Anima Immortale direttamente dal Deck.'
            }, (chosen) => {
                ctx.stField(ctx.owner)[free] = { card: chosen, isFaceDown: true, setOnTurn: gameState.turn };
                ctx.log(`${chosen.name} viene Posizionata direttamente dal Deck!`);
            });
        },
        onAnyNormalOrFlipSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            this.reviveCounterpart(ctx);
        },
        onAnySpecialSummon(ctx) { this.reviveCounterpart(ctx); },
        reviveCounterpart(ctx) {
            if (!isDarkMagicianPair(ctx.summonedCard)
                || !ctx.field(ctx.owner).some((s) => s && s.card.uid === ctx.summonedCard.uid)
                || ctx.hasUsedOncePerTurn(`magicians-salvation-revive:${ctx.owner}`)
                || ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            const needsGirl = isDarkMagician(ctx.summonedCard);
            const match = needsGirl ? isDarkMagicianGirl : isDarkMagician;
            if (!ctx.graveyard(ctx.owner).some(match)) return;
            searchGraveyardWithChoice(ctx, ctx.owner, match, {
                title: 'Salvataggio del Mago',
                text: `Evoca dal Cimitero ${needsGirl ? 'Ragazza Maga Nera' : 'Mago Nero'}.`
            }, (chosen) => {
                const free = ctx.findEmptyMonsterSlot(ctx.owner);
                if (free === -1) { ctx.graveyard(ctx.owner).push(chosen); return; }
                ctx.markUsedOncePerTurn(`magicians-salvation-revive:${ctx.owner}`);
                ctx.specialSummon(ctx.owner, chosen, free, 'attack', 'graveyard');
            });
        }
    });

    const soulServantEligible = (card) => card && card.id !== 1258
        && (isDarkMagician(card) || cardMentionsName(card, 'Mago Nero') || cardMentionsName(card, 'Ragazza Maga Nera'));
    CardEffects.register(1258, {
        archetypes: ['dark-magician'],
        mentionsNames: ['Mago Nero', 'Ragazza Maga Nera'],
        canActivate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner) || [];
            return ctx.hand(ctx.owner).some((c) => c.uid !== ctx.card.uid && soulServantEligible(c))
                || deck.some(soulServantEligible)
                || ctx.graveyard(ctx.owner).some((c) => c.uid !== ctx.card.uid && soulServantEligible(c));
        },
        activate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner) || [];
            const candidates = ctx.hand(ctx.owner).filter((c) => c.uid !== ctx.card.uid && soulServantEligible(c))
                .concat(deck.filter(soulServantEligible))
                .concat(ctx.graveyard(ctx.owner).filter((c) => c.uid !== ctx.card.uid && soulServantEligible(c)));
            chooseCardFromList(ctx, candidates, {
                title: "Servitore dell'Anima", text: 'Scegli quale carta collocare in cima al Deck.'
            }, (chosen) => {
                const zones = [ctx.hand(ctx.owner), deck, ctx.graveyard(ctx.owner)];
                const source = zones.find((zone) => zone.includes(chosen));
                if (!source) return;
                source.splice(source.indexOf(chosen), 1);
                deck.push(chosen);
                gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
                ctx.log(`${chosen.name} viene collocata in cima al Deck.`);
            });
        },
        canActivateFromGraveyardMainPhase(ctx) {
            if (ctx.hasUsedOncePerTurn(`soul-servant-grave:${ctx.owner}`)) return false;
            const zones = Tavolo.ordine().flatMap((owner) => ctx.field(owner).filter(Boolean).map((s) => s.card)
                .concat(ctx.graveyard(owner)));
            return zones.some((c) => isDarkMagicianPair(c) || /^Oracolo Palladio/i.test(c.name || ''));
        },
        activateFromGraveyardMainPhase(ctx) {
            const grave = ctx.graveyard(ctx.owner);
            const selfIndex = grave.findIndex((c) => c.uid === ctx.card.uid);
            if (selfIndex === -1) return;
            if (ctx.graveyardMoveNegated(ctx.owner)) return;
            const names = new Set();
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (slot && (isDarkMagicianPair(slot.card) || /^Oracolo Palladio/i.test(slot.card.name || ''))) names.add(slot.card.name);
                });
                ctx.graveyard(owner).forEach((card) => {
                    if (isDarkMagicianPair(card) || /^Oracolo Palladio/i.test(card.name || '')) names.add(card.name);
                });
            });
            if (names.size === 0) return;
            const [self] = grave.splice(selfIndex, 1);
            ctx.banish(ctx.owner, self);
            ctx.markUsedOncePerTurn(`soul-servant-grave:${ctx.owner}`);
            ctx.drawCards(ctx.owner, names.size);
            ctx.log(`${ctx.card.name} viene bandito: peschi ${names.size} cart${names.size === 1 ? 'a' : 'e'}!`);
        }
    });

    function ritualPlansForSecrets(ctx) {
        const hand = ctx.hand(ctx.owner);
        const field = ctx.field(ctx.owner);
        const rituals = hand.filter((c) => c.type === 'monster' && c.category === 'ritual');
        const plans = [];
        rituals.forEach((ritual) => {
            const pool = hand.map((card, index) => card === ritual ? null : { card, zone: 'hand', index })
                .filter(Boolean)
                .concat(field.map((slot, index) => slot && !slot.isFaceDown ? { card: slot.card, zone: 'monster', index } : null).filter(Boolean));
            let best = null;
            const maxMask = 1 << pool.length;
            for (let mask = 1; mask < maxMask; mask++) {
                const chosen = pool.filter((entry, i) => mask & (1 << i));
                const total = chosen.reduce((sum, entry) => sum + (entry.card.level || 0), 0);
                if (total < ritual.level || !chosen.some((entry) => isDarkMagicianPair(entry.card))) continue;
                if (ctx.findEmptyMonsterSlot(ctx.owner) === -1 && !chosen.some((entry) => entry.zone === 'monster')) continue;
                const score = chosen.length * 100 + (total - ritual.level);
                if (!best || score < best.score) best = { ritual, materials: chosen, score };
            }
            if (best) plans.push(best);
        });
        return plans;
    }

    CardEffects.register(1259, {
        archetypes: ['dark-magician'],
        mentionsNames: ['Mago Nero', 'Ragazza Maga Nera'],
        canActivate(ctx) {
            const fusions = DuelEngine.getFusableExtraDeckMonsters(ctx.owner).filter((entry) => entry.materialLocations.some((loc) => {
                const card = loc.zone === 'hand' ? ctx.hand(ctx.owner)[loc.index] : ctx.field(ctx.owner)[loc.index]?.card;
                return isDarkMagicianPair(card);
            }));
            return fusions.length > 0 || ritualPlansForSecrets(ctx).length > 0;
        },
        activate(ctx) {
            const fusions = DuelEngine.getFusableExtraDeckMonsters(ctx.owner).filter((entry) => entry.materialLocations.some((loc) => {
                const card = loc.zone === 'hand' ? ctx.hand(ctx.owner)[loc.index] : ctx.field(ctx.owner)[loc.index]?.card;
                return isDarkMagicianPair(card);
            }));
            const rituals = ritualPlansForSecrets(ctx);
            const doFusion = () => chooseCardFromList(ctx, fusions.map((entry) => entry.card), {
                title: 'Segreti della Magia Nera', text: 'Scegli il Mostro Fusione da Evocare.'
            }, (chosen) => {
                const plan = fusions.find((entry) => entry.card.uid === chosen.uid);
                if (plan) ctx.fusionSummon(ctx.owner, plan.extraDeckIndex, plan.materialLocations);
            });
            const doRitual = () => chooseCardFromList(ctx, rituals.map((entry) => entry.ritual), {
                title: 'Segreti della Magia Nera', text: 'Scegli il Mostro Rituale da Evocare.'
            }, (chosen) => {
                const plan = rituals.find((entry) => entry.ritual.uid === chosen.uid);
                if (!plan) return;
                const materialCards = plan.materials.map((entry) => entry.card);
                ctx._pendingRitualVisual = { materials: materialCards };
                plan.materials.filter((e) => e.zone === 'monster').forEach((entry) => {
                    ctx.field(ctx.owner)[entry.index] = null;
                    ctx.graveyard(ctx.owner).push(entry.card);
                });
                plan.materials.filter((e) => e.zone === 'hand').sort((a, b) => b.index - a.index).forEach((entry) => {
                    const i = ctx.hand(ctx.owner).indexOf(entry.card);
                    if (i !== -1) ctx.graveyard(ctx.owner).push(ctx.hand(ctx.owner).splice(i, 1)[0]);
                });
                const ritualIndex = ctx.hand(ctx.owner).indexOf(chosen);
                if (ritualIndex === -1) return;
                ctx.hand(ctx.owner).splice(ritualIndex, 1);
                const free = ctx.findEmptyMonsterSlot(ctx.owner);
                if (free === -1) { ctx.graveyard(ctx.owner).push(chosen); return; }
                ctx.specialSummon(ctx.owner, chosen, free, 'attack', 'hand');
            });
            if (fusions.length && rituals.length) chooseOption(ctx, {
                title: 'Segreti della Magia Nera', text: 'Quale Evocazione vuoi effettuare?',
                options: [{ value: 'fusion', label: 'Evocazione Fusione' }, { value: 'ritual', label: 'Evocazione Rituale' }],
                pickForBot: () => 'fusion'
            }, (choice) => choice === 'fusion' ? doFusion() : doRitual());
            else if (fusions.length) doFusion();
            else if (rituals.length) doRitual();
        }
    });

    CardEffects.register(1260, {
        archetypes: ['dark-magician'],
        mentionsNames: ['Mago Nero', 'Ragazza Maga Nera'],
        fusionMaterialMatchers: [isDarkMagicianPair, (card) => card && card.type === 'monster' && card.race === 'Incantatore'],
        canActivateOnCardActivated(ctx) {
            return !ctx.hasUsedOncePerTurn(`the-dark-magicians-draw:${ctx.card.uid}`);
        },
        onCardActivated(ctx) {
            ctx.markUsedOncePerTurn(`the-dark-magicians-draw:${ctx.card.uid}`);
            const before = ctx.hand(ctx.owner).length;
            ctx.drawCards(ctx.owner, 1);
            const drawn = ctx.hand(ctx.owner)[ctx.hand(ctx.owner).length - 1];
            if (!drawn || ctx.hand(ctx.owner).length === before || (drawn.type !== 'spell' && drawn.type !== 'trap')) return;
            const free = DuelEngine.findFreeSTSlot(ctx.owner);
            if (free === -1) return;
            const setCard = () => {
                const index = ctx.hand(ctx.owner).indexOf(drawn);
                if (index === -1) return;
                ctx.hand(ctx.owner).splice(index, 1);
                const immediatelyUsable = drawn.type === 'trap' || drawn.subtype === 'quick-play';
                ctx.stField(ctx.owner)[free] = {
                    card: drawn, isFaceDown: true,
                    setOnTurn: immediatelyUsable ? gameState.turn - 1 : gameState.turn
                };
                ctx.log(`${drawn.name} viene Posizionata dall'effetto di ${ctx.card.name}!`);
            };
            chooseOption(ctx, {
                title: 'I Maghi Neri', text: `Vuoi Posizionare ${drawn.name}?`,
                options: [{ value: 'set', label: 'Posiziona' }, { value: 'keep', label: 'Tieni in mano' }],
                pickForBot: () => 'set'
            }, (choice) => { if (choice === 'set') setCard(); });
        },
        onDestroy(ctx) {
            const find = (match) => {
                const zones = [ctx.graveyard(ctx.owner), ctx.hand(ctx.owner), Tavolo.mazzo(ctx.owner) || []];
                for (const zone of zones) {
                    const card = zone.find(match);
                    if (card) return { card, zone };
                }
                return null;
            };
            const dm = find(isDarkMagician);
            const girl = find(isDarkMagicianGirl);
            const freeSlots = ctx.field(ctx.owner).map((slot, index) => slot ? -1 : index).filter((index) => index !== -1);
            if (!dm || !girl || dm.card.uid === girl.card.uid || freeSlots.length < 2) return;
            [dm, girl].forEach((entry, i) => {
                entry.zone.splice(entry.zone.indexOf(entry.card), 1);
                ctx.specialSummon(ctx.owner, entry.card, freeSlots[i], 'attack', entry.zone === ctx.hand(ctx.owner) ? 'hand' : entry.zone === ctx.graveyard(ctx.owner) ? 'graveyard' : 'deck');
            });
            gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = (Tavolo.mazzo(ctx.owner) || []).length;
            ctx.log(`${ctx.card.name} richiama Mago Nero e Ragazza Maga Nera!`);
        }
    });

    // ================================================================
    // Supporti moderni Drago Bianco — primo pacchetto.
    // ================================================================
    const melodyDragon = (card) => card && card.type === 'monster' && card.race === 'Drago'
        && (card.attack || 0) >= 3000 && (card.defense || 0) <= 2500;
    CardEffects.register(1261, {
        archetypes: ['blue-eyes'],
        canActivate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner);
            return ctx.hand(ctx.owner).some((c) => c.uid !== ctx.card.uid)
                && Array.isArray(deck) && deck.some(melodyDragon);
        },
        activate(ctx) {
            chooseCardFromHand(ctx, {
                filter: (c) => c.uid !== ctx.card.uid,
                title: 'La Melodia del Drago che si Risveglia',
                text: 'Scegli la carta da scartare come costo.'
            }, (discarded, index) => {
                const paid = ctx.discardChosenFromHand(ctx.owner, index);
                if (!paid) return;
                const deck = Tavolo.mazzo(ctx.owner) || [];
                const candidates = deck.filter(melodyDragon);
                chooseUpToNFromList(ctx, candidates, 2, {
                    min: 1,
                    title: 'La Melodia del Drago che si Risveglia',
                    text: 'Scegli fino a 2 Draghi da aggiungere alla mano.',
                    pickForBot: (cards, max) => cards.slice().sort((a, b) => (b.attack || 0) - (a.attack || 0)).slice(0, max)
                }, (chosen) => {
                    chosen.forEach((card) => {
                        const i = deck.indexOf(card);
                        if (i !== -1) ctx.hand(ctx.owner).push(deck.splice(i, 1)[0]);
                    });
                    gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
                    ctx.log(`${paid.name} viene scartata: aggiunte ${chosen.length} carte Drago alla mano!`);
                });
            });
        }
    });

    CardEffects.register(1262, {
        archetypes: ['blue-eyes'],
        treatedAsNamesByZone: {
            monster: ['Drago Bianco Occhi Blu'],
            graveyard: ['Drago Bianco Occhi Blu']
        },
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return !ctx.hasUsedOncePerTurn(`alternative-special:${ctx.owner}`)
                && ctx.hand(ctx.owner).some((c) => c.uid !== ctx.card.uid && c.id === 1);
        },
        paySpecialSummonCost(ctx) {
            if (!ctx.hand(ctx.owner).some((c) => c.uid !== ctx.card.uid && c.id === 1)) return false;
            ctx.markUsedOncePerTurn(`alternative-special:${ctx.owner}`);
            ctx.log('🐉 Drago Bianco Occhi Blu viene rivelato dalla mano!');
            return true;
        },
        canActivate(ctx) {
            return ctx.zone === 'monster'
                && !ctx.hasUsedOncePerTurn(`alternative-destroy:${ctx.card.uid}`)
                && ctx.field(ctx.opponent).some(Boolean);
        },
        activate(ctx) {
            const targets = collectFieldTargets(ctx, { owner: 'opponent', zone: 'monster', includiCoperte: true });
            chooseFieldCardTarget(ctx, targets, {
                title: 'Drago Bianco Alternativo Occhi Blu',
                text: 'Scegli il mostro avversario da distruggere.', dichiara: true
            }, (chosen) => {
                ctx.markUsedOncePerTurn(`alternative-destroy:${ctx.card.uid}`);
                ctx.card._alternativeNoAttackTurn = gameState.turn;
                ctx.destroyMonster(chosen.owner, chosen.index);
            });
        },
        static(ctx) {
            if (ctx.card._alternativeNoAttackTurn === gameState.turn) {
                gameState.cannotAttackUids[ctx.card.uid] = true;
            }
        }
    });

    const isBlueEyesWhiteDragonHere = (card, zone) => cardHasEffectiveName(card, 'Drago Bianco Occhi Blu', zone);
    const trueLightLeave = (ctx) => {
        if (ctx.wasFaceDown || ctx.card._trueLightLeaveResolved) return;
        ctx.card._trueLightLeaveResolved = true;
        ctx.destroyAllMonsters(ctx.owner);
        ctx.log(`${ctx.card.name} viene mandata al Cimitero: tutti i tuoi mostri vengono distrutti!`);
    };
    CardEffects.register(1263, {
        archetypes: ['blue-eyes'],
        mentionsNames: ['Drago Bianco Occhi Blu'],
        continuous: true,
        repeatableWhileContinuous: true,
        canActivate(ctx) {
            if (ctx.hasUsedOncePerTurn(`true-light:${ctx.owner}`)) return false;
            const deck = Tavolo.mazzo(ctx.owner) || [];
            const canSummon = ctx.findEmptyMonsterSlot(ctx.owner) !== -1
                && (ctx.hand(ctx.owner).some((c) => isBlueEyesWhiteDragonHere(c, 'hand'))
                    || ctx.graveyard(ctx.owner).some((c) => isBlueEyesWhiteDragonHere(c, 'graveyard')));
            const occupiedNames = new Set(ctx.stField(ctx.owner).filter(Boolean).map((s) => s.card.name)
                .concat(ctx.graveyard(ctx.owner).map((c) => c.name)));
            const canSet = DuelEngine.findFreeSTSlot(ctx.owner) !== -1
                && deck.some((c) => (c.type === 'spell' || c.type === 'trap')
                    && cardMentionsName(c, 'Drago Bianco Occhi Blu') && !occupiedNames.has(c.name));
            return canSummon || canSet;
        },
        activate(ctx) {
            ctx.card._trueLightLeaveResolved = false;
            const deck = Tavolo.mazzo(ctx.owner) || [];
            const canSummon = ctx.findEmptyMonsterSlot(ctx.owner) !== -1
                && (ctx.hand(ctx.owner).some((c) => isBlueEyesWhiteDragonHere(c, 'hand'))
                    || ctx.graveyard(ctx.owner).some((c) => isBlueEyesWhiteDragonHere(c, 'graveyard')));
            const occupiedNames = new Set(ctx.stField(ctx.owner).filter(Boolean).map((s) => s.card.name)
                .concat(ctx.graveyard(ctx.owner).map((c) => c.name)));
            const setCandidates = deck.filter((c) => (c.type === 'spell' || c.type === 'trap')
                && cardMentionsName(c, 'Drago Bianco Occhi Blu') && !occupiedNames.has(c.name));
            const canSet = DuelEngine.findFreeSTSlot(ctx.owner) !== -1 && setCandidates.length > 0;
            const resolve = (choice) => {
                ctx.markUsedOncePerTurn(`true-light:${ctx.owner}`);
                if (choice === 'set') {
                    searchDeckWithChoice(ctx, (c) => setCandidates.includes(c), {
                        title: 'Vera Luce', text: 'Scegli la Magia/Trappola da Posizionare.'
                    }, (chosen) => {
                        const free = DuelEngine.findFreeSTSlot(ctx.owner);
                        if (free === -1) { deck.push(chosen); return; }
                        ctx.stField(ctx.owner)[free] = { card: chosen, isFaceDown: true, setOnTurn: gameState.turn };
                    });
                    return;
                }
                const pool = ctx.hand(ctx.owner).filter((c) => isBlueEyesWhiteDragonHere(c, 'hand'))
                    .concat(ctx.graveyard(ctx.owner).filter((c) => isBlueEyesWhiteDragonHere(c, 'graveyard')));
                chooseCardFromList(ctx, pool, {
                    title: 'Vera Luce', text: 'Scegli il Drago Bianco da Evocare Specialmente.'
                }, (chosen) => {
                    let from = 'hand';
                    let i = ctx.hand(ctx.owner).indexOf(chosen);
                    if (i !== -1) ctx.hand(ctx.owner).splice(i, 1);
                    else {
                        from = 'graveyard';
                        i = ctx.graveyard(ctx.owner).indexOf(chosen);
                        if (i === -1) return;
                        ctx.graveyard(ctx.owner).splice(i, 1);
                    }
                    const free = ctx.findEmptyMonsterSlot(ctx.owner);
                    if (free === -1) { (from === 'hand' ? ctx.hand(ctx.owner) : ctx.graveyard(ctx.owner)).push(chosen); return; }
                    ctx.specialSummon(ctx.owner, chosen, free, 'attack', from);
                });
            };
            if (canSummon && canSet) chooseOption(ctx, {
                title: 'Vera Luce', text: 'Scegli quale effetto applicare.',
                options: [{ value: 'summon', label: 'Evoca un Drago Bianco' }, { value: 'set', label: 'Posiziona dal Deck' }],
                pickForBot: () => 'summon'
            }, resolve);
            else resolve(canSummon ? 'summon' : 'set');
        },
        static(ctx) {
            ctx.field(ctx.owner).forEach((slot) => {
                if (slot && !slot.isFaceDown && isBlueEyesWhiteDragonHere(slot.card, 'monster')) {
                    gameState.cannotBeTargetedByOpponentEffectsUids[slot.card.uid] = ctx.owner;
                }
            });
        },
        onSentToGraveyardFromField: trueLightLeave
    });

    // ================================================================
    // Supporti moderni Drago Bianco — secondo pacchetto.
    // ================================================================
    const blueEyesFusionMaterial = (card, zone) => cardHasEffectiveName(card, 'Drago Bianco Occhi Blu', zone);

    function ultimateFusionPlans(ctx) {
        if (gameState.phase !== 'main1' && gameState.phase !== 'main2') return [];
        const hand = ctx.hand(ctx.owner);
        const field = ctx.field(ctx.owner);
        const grave = ctx.graveyard(ctx.owner);
        const extra = Tavolo.extraDeck(ctx.owner) || [];
        const pool = grave.map((card, index) => ({ card, zone: 'graveyard', index }))
            .concat(hand.map((card, index) => ({ card, zone: 'hand', index })))
            .concat(field.map((slot, index) => slot && !slot.isFaceDown
                ? { card: slot.card, zone: 'monster', index }
                : null).filter(Boolean));
        const fieldFull = ctx.findEmptyMonsterSlot(ctx.owner) === -1;
        const plans = [];
        extra.forEach((fusion, extraDeckIndex) => {
            const def = DuelEngine.getDefinition(fusion.id);
            if (!def) return;
            const fixed = Array.isArray(def.fusionMaterials) ? def.fusionMaterials : [];
            const flexible = Array.isArray(def.fusionMaterialMatchers) ? def.fusionMaterialMatchers : [];
            if (fixed.length === 0 && flexible.length === 0) return;
            // Fusione Definitiva accetta soltanto Fusioni che nominano uno
            // dei due boss classici come materiale. Nel dataset le Fusioni
            // ammesse espongono materialNames per non dipendere dal testo
            // tradotto mostrato a video.
            const materialNames = Array.isArray(def.fusionMaterialNames) ? def.fusionMaterialNames : [];
            if (!materialNames.some((name) => name === 'Drago Bianco Occhi Blu' || name === 'Drago Occhi Blu Finale')) return;
            const requirements = fixed.map((id) => (card, zone) => id === 1
                ? blueEyesFusionMaterial(card, zone)
                : card.id === id).concat(flexible);
            const used = new Set();
            const materials = [];
            const take = (matcher) => {
                const entry = pool.find((candidate) => !used.has(candidate.card.uid)
                    && matcher(candidate.card, candidate.zone));
                if (!entry) return false;
                used.add(entry.card.uid);
                materials.push(entry);
                return true;
            };
            if (!requirements.every(take)) return;
            if (!materials.some((entry) => blueEyesFusionMaterial(entry.card, entry.zone)
                || entry.card.id === 29)) return;
            if (fieldFull && !materials.some((entry) => entry.zone === 'monster')) return;
            plans.push({ fusion, extraDeckIndex, materials });
        });
        return plans;
    }

    function resolveUltimateFusion(ctx, plan) {
        const hand = ctx.hand(ctx.owner);
        const field = ctx.field(ctx.owner);
        const grave = ctx.graveyard(ctx.owner);
        const extra = Tavolo.extraDeck(ctx.owner) || [];
        const freeBefore = ctx.findEmptyMonsterSlot(ctx.owner);
        const fieldMaterialSlots = plan.materials.filter((entry) => entry.zone === 'monster').map((entry) => entry.index);
        const destination = freeBefore !== -1 ? freeBefore : fieldMaterialSlots[0];
        if (destination === undefined || destination === -1 || extra[plan.extraDeckIndex]?.uid !== plan.fusion.uid) return false;
        if (plan.materials.some((entry) => entry.zone === 'graveyard') && ctx.graveyardMoveNegated(ctx.owner)) return false;
        const materialCards = plan.materials.map((entry) => entry.card);
        const fieldBlueEyesCount = plan.materials.filter((entry) => entry.zone === 'monster'
            && (blueEyesFusionMaterial(entry.card, 'monster') || entry.card.id === 29)).length;
        const usedAlternative = materialCards.some((card) => card.id === 1262);
        plan.materials.filter((entry) => entry.zone === 'hand').sort((a, b) => b.index - a.index).forEach((entry) => {
            const index = hand.findIndex((card) => card.uid === entry.card.uid);
            if (index !== -1) hand.splice(index, 1);
        });
        plan.materials.filter((entry) => entry.zone === 'graveyard').sort((a, b) => b.index - a.index).forEach((entry) => {
            const index = grave.findIndex((card) => card.uid === entry.card.uid);
            if (index !== -1) grave.splice(index, 1);
        });
        plan.materials.filter((entry) => entry.zone === 'monster').forEach((entry) => {
            if (field[entry.index] && field[entry.index].card.uid === entry.card.uid) field[entry.index] = null;
        });
        extra.splice(plan.extraDeckIndex, 1);
        const deck = Tavolo.mazzo(ctx.owner) || [];
        deck.push(...materialCards);
        Casuale.mescola(deck);
        gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
        plan.fusion._fusionSummonedWithAlternative = usedAlternative;
        if (typeof updateUI === 'function') updateUI();
        const finish = () => {
            ctx.specialSummon(ctx.owner, plan.fusion, destination, 'attack', 'extra');
            if (fieldBlueEyesCount <= 0) return;
            const targets = ctx.field(ctx.opponent).map((slot, index) => slot && !slot.isFaceDown
                ? { card: slot.card, zone: 'monster', index }
                : null).filter(Boolean).concat(ctx.stField(ctx.opponent).map((slot, index) => slot && !slot.isFaceDown
                ? { card: slot.card, zone: 'st', index }
                : null).filter(Boolean));
            chooseUpToNFromList(ctx, targets.map((entry) => entry.card), fieldBlueEyesCount, {
                min: 0, title: 'Fusione Definitiva',
                text: 'Scegli le carte scoperte avversarie da distruggere.',
                pickForBot: (cards, max) => cards.slice(0, max)
            }, (chosen) => chosen.forEach((card) => {
                const entry = targets.find((target) => target.card.uid === card.uid);
                if (!entry) return;
                if (entry.zone === 'monster') ctx.destroyTargetedMonster(ctx.opponent, entry.index);
                else ctx.destroySpellTrap(ctx.opponent, entry.index);
            }));
        };
        if (window.FX && typeof FX.playFusionMaterialEffect === 'function') {
            FX.playFusionMaterialEffect(materialCards, plan.fusion, ctx.owner, finish);
        } else finish();
        return true;
    }

    CardEffects.register(1264, {
        archetypes: ['blue-eyes'],
        mentionsNames: ['Drago Bianco Occhi Blu', 'Drago Occhi Blu Finale'],
        canActivate(ctx) {
            return !ctx.hasUsedOncePerTurn(`ultimate-fusion:${ctx.owner}`)
                && ultimateFusionPlans(ctx).length > 0;
        },
        activate(ctx) {
            const plans = ultimateFusionPlans(ctx);
            if (plans.length === 0) return;
            chooseCardFromList(ctx, plans.map((plan) => plan.fusion), {
                title: 'Fusione Definitiva', text: 'Scegli il Mostro Fusione da Evocare.'
            }, (chosen) => {
                const plan = plans.find((entry) => entry.fusion.uid === chosen.uid);
                if (!plan) return;
                ctx.markUsedOncePerTurn(`ultimate-fusion:${ctx.owner}`);
                resolveUltimateFusion(ctx, plan);
            });
        }
    });

    CardEffects.register(1265, {
        archetypes: ['blue-eyes'],
        fusionMaterialNames: ['Drago Bianco Occhi Blu'],
        fusionMaterialMatchers: [blueEyesFusionMaterial, blueEyesFusionMaterial, blueEyesFusionMaterial],
        cannotBeDestroyedByOpponentCardEffect: true,
        canActivate(ctx) {
            return ctx.zone === 'monster'
                && !ctx.hasUsedOncePerTurn(`alternative-ultimate-destroy:${ctx.card.uid}`)
                && (ctx.field(ctx.opponent).some(Boolean) || ctx.stField(ctx.opponent).some(Boolean));
        },
        activate(ctx) {
            const maximum = ctx.card._fusionSummonedWithAlternative ? 3 : 1;
            const targets = ctx.field(ctx.opponent).map((slot, index) => slot
                ? { card: slot.card, zone: 'monster', index }
                : null).filter(Boolean).concat(ctx.stField(ctx.opponent).map((slot, index) => slot
                ? { card: slot.card, zone: 'st', index }
                : null).filter(Boolean));
            chooseUpToNFromList(ctx, targets.map((entry) => entry.card), maximum, {
                min: 1, title: 'Drago Finale Alternativo Occhi Blu',
                text: `Scegli fino a ${maximum} cart${maximum === 1 ? 'a' : 'e'} da distruggere.`,
                pickForBot: (cards, max) => cards.slice(0, max)
            }, (chosen) => {
                if (!chosen.length) return;
                ctx.markUsedOncePerTurn(`alternative-ultimate-destroy:${ctx.card.uid}`);
                ctx.card._alternativeUltimateNoAttackTurn = gameState.turn;
                chosen.forEach((card) => {
                    const entry = targets.find((target) => target.card.uid === card.uid);
                    if (!entry) return;
                    if (entry.zone === 'monster') ctx.destroyTargetedMonster(ctx.opponent, entry.index);
                    else ctx.destroySpellTrap(ctx.opponent, entry.index);
                });
            });
        },
        static(ctx) {
            gameState.cannotBeTargetedByOpponentEffectsUids[ctx.card.uid] = ctx.owner;
            if (ctx.card._alternativeUltimateNoAttackTurn === gameState.turn) {
                gameState.cannotAttackUids[ctx.card.uid] = true;
            }
        }
    });

    // ================================================================
    // Supporti moderni Toon — primo pacchetto. Conservano la mediazione
    // anime del progetto: con un Mondo attivo i Toon attaccano subito.
    // ================================================================
    CardEffects.register(1266, {
        archetypes: ['toon'],
        treatedAsNames: ['Mondo Toon'],
        canActivate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner);
            return Array.isArray(deck) && deck.length >= 3;
        },
        activate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner) || [];
            const banished = [];
            for (let i = 0; i < 3 && deck.length; i++) banished.push(deck.pop());
            banished.forEach((card) => ctx.banish(ctx.owner, card));
            gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
            ctx.log('🏰 Regno Toon bandisce le prime 3 carte del Deck e apre le porte del regno!');
        },
        static(ctx) {
            ctx.field(ctx.owner).forEach((slot) => {
                if (!slot || slot.isFaceDown || !cardHasArchetype(slot.card, 'toon')) return;
                gameState.directAttackAllowedUids[slot.card.uid] = true;
                gameState.cannotBeTargetedByOpponentEffectsUids[slot.card.uid] = ctx.owner;
            });
        }
    });

    const bookmarkCandidate = (card) => card && card.id !== 1267
        && (card.id === 487 || card.id === 1266 || cardMentionsName(card, 'Mondo Toon'));
    CardEffects.register(1267, {
        archetypes: ['toon'],
        mentionsNames: ['Mondo Toon'],
        canActivate(ctx) {
            return !ctx.hasUsedOncePerTurn(`toon-bookmark:${ctx.owner}`)
                && (Tavolo.mazzo(ctx.owner) || []).some(bookmarkCandidate);
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`toon-bookmark:${ctx.owner}`);
            searchDeckWithChoice(ctx, bookmarkCandidate, {
                title: 'Segnalibro Toon', text: 'Scegli Mondo Toon o una carta che lo cita.',
                pickForBot: (cards) => cards.find((card) => card.id === 1266)
                    || cards.find((card) => card.id === 487) || cards[0]
            }, (chosen) => ctx.hand(ctx.owner).push(chosen));
        }
    });

    CardEffects.register(1268, {
        archetypes: ['toon', 'harpie'],
        isToon: true,
        mentionsNames: ['Mondo Toon'],
        canSpecialSummonFromHand(ctx) {
            return DuelEngine.hasActiveToonWorld(ctx.owner)
                && !ctx.hasUsedOncePerTurn(`toon-harpie-summon:${ctx.owner}`);
        },
        paySpecialSummonCost(ctx) {
            ctx.markUsedOncePerTurn(`toon-harpie-summon:${ctx.owner}`);
            return true;
        },
        onSpecialSummon(ctx) {
            const hasOtherToon = ctx.field(ctx.owner).some((slot) => slot && slot.card.uid !== ctx.card.uid
                && cardHasArchetype(slot.card, 'toon'));
            const targets = ctx.stField(ctx.opponent).map((slot, index) => slot ? { card: slot.card, index } : null).filter(Boolean);
            if (!hasOtherToon || targets.length === 0) return;
            chooseCardFromList(ctx, targets.map((entry) => entry.card), {
                title: 'Lady Arpia Toon', text: 'Scegli la Magia/Trappola avversaria da distruggere.',
                pickForBot: (cards) => cards[0]
            }, (chosen) => {
                const entry = targets.find((target) => target.card.uid === chosen.uid);
                if (entry && ctx.stField(ctx.opponent)[entry.index]) ctx.destroySpellTrap(ctx.opponent, entry.index);
            });
        },
        mustTargetFilterIfPresent(card, owner) {
            return DuelEngine.hasActiveToonWorld(owner) && cardHasArchetype(card, 'toon');
        }
    });

    // ================================================================
    // Supporti moderni Toon — secondo pacchetto. Gira-Pagina estende la
    // consistenza senza scegliere il risultato; il Soldato usa il costo
    // reale misto mano/Terreno, ma conserva la mediazione anime del gioco
    // sull'attacco immediato e diretto con un Mondo attivo.
    // ================================================================
    CardEffects.register(1269, {
        archetypes: ['toon'],
        mentionsNames: ['Mondo Toon'],
        canActivate(ctx) {
            if (!DuelEngine.hasActiveToonWorld(ctx.owner)
                || ctx.hasUsedOncePerTurn(`toon-page-flip:${ctx.owner}`)
                || ctx.findEmptyMonsterSlot(ctx.owner) === -1) return false;
            const names = new Set((Tavolo.mazzo(ctx.owner) || [])
                .filter((card) => card.type === 'monster' && cardHasArchetype(card, 'toon'))
                .map((card) => card.name));
            return names.size >= 3;
        },
        activate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner) || [];
            const byName = new Map();
            deck.forEach((card) => {
                if (card.type === 'monster' && cardHasArchetype(card, 'toon') && !byName.has(card.name)) {
                    byName.set(card.name, card);
                }
            });
            const candidates = Array.from(byName.values());
            if (candidates.length < 3 || ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            ctx.markUsedOncePerTurn(`toon-page-flip:${ctx.owner}`);
            chooseUpToNFromList(ctx, candidates, 3, {
                min: 3,
                title: 'Gira-Pagina Toon',
                text: 'Rivela 3 mostri Toon con nomi diversi.',
                pickForBot: (cards) => cards.slice().sort((a, b) => (b.attack || 0) - (a.attack || 0)).slice(0, 3)
            }, (revealed) => {
                if (revealed.length !== 3) return;
                const picked = revealed[Math.floor(ctx.random() * revealed.length)];
                const index = deck.findIndex((card) => card.uid === picked.uid);
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (index === -1 || slotIndex === -1) return;
                const [summoned] = deck.splice(index, 1);
                Casuale.mescola(deck);
                gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
                ctx.specialSummon(ctx.owner, summoned, slotIndex, 'attack', 'deck');
                ctx.log(`Gira-Pagina Toon rivela ${revealed.map((card) => card.name).join(', ')}: ${summoned.name} viene scelto ed Evocato!`);
            });
        }
    });

    const toonBlsCandidates = (ctx) => {
        const out = [];
        ctx.hand(ctx.owner).forEach((card, index) => {
            if (card.uid !== ctx.card.uid && card.type === 'monster' && cardHasArchetype(card, 'toon')) {
                out.push({ card, zone: 'hand', index });
            }
        });
        ctx.field(ctx.owner).forEach((slot, index) => {
            if (slot && slot.card.type === 'monster' && cardHasArchetype(slot.card, 'toon')) {
                out.push({ card: slot.card, zone: 'monster', index });
            }
        });
        return out;
    };
    const toonBlsSelectionValid = (ctx, entries) => {
        const enoughLevels = entries.reduce((sum, entry) => sum + (entry.card.level || 0), 0) >= 8;
        const hasSpace = ctx.findEmptyMonsterSlot(ctx.owner) !== -1 || entries.some((entry) => entry.zone === 'monster');
        return enoughLevels && hasSpace;
    };
    const toonBlsAutomaticPlan = (ctx, candidates) => {
        let best = null;
        const combinations = 1 << candidates.length;
        for (let mask = 1; mask < combinations; mask++) {
            const entries = candidates.filter((entry, index) => (mask & (1 << index)) !== 0);
            if (!toonBlsSelectionValid(ctx, entries)) continue;
            const total = entries.reduce((sum, entry) => sum + (entry.card.level || 0), 0);
            // Prima conserva il maggior numero di risorse, poi evita di
            // offrire Livelli inutili; a parita' preferisce la mano.
            const fieldCount = entries.filter((entry) => entry.zone === 'monster').length;
            const score = entries.length * 10000 + (total - 8) * 100 + fieldCount;
            if (!best || score < best.score) best = { entries, score };
        }
        return best ? best.entries : [];
    };

    CardEffects.register(1270, {
        archetypes: ['toon'],
        isToon: true,
        mentionsNames: ['Mondo Toon'],
        cannotNormalSummon: true,
        cannotBeSet: true,
        specialSummonReleasesOwnMonsterZone: true,
        specialSummonMixedTributeMinLevel: 8,
        getSpecialSummonMixedTributeCandidates(ctx) { return toonBlsCandidates(ctx); },
        isSpecialSummonMixedTributeSelectionValid(ctx, entries) { return toonBlsSelectionValid(ctx, entries); },
        canSpecialSummonFromHand(ctx) {
            return toonBlsAutomaticPlan(ctx, toonBlsCandidates(ctx)).length > 0;
        },
        paySpecialSummonCost(ctx) {
            const candidates = toonBlsCandidates(ctx);
            const pending = gameState.pendingSpecialSummonMixedTributeUids;
            gameState.pendingSpecialSummonMixedTributeUids = null;
            let selected = Array.isArray(pending)
                ? pending.map((uid) => candidates.find((entry) => entry.card.uid === uid)).filter(Boolean)
                : [];
            if (!toonBlsSelectionValid(ctx, selected)) selected = toonBlsAutomaticPlan(ctx, candidates);
            if (!toonBlsSelectionValid(ctx, selected)) return false;
            selected.forEach((entry) => {
                if (entry.zone === 'hand') {
                    const index = ctx.hand(ctx.owner).findIndex((card) => card.uid === entry.card.uid);
                    if (index !== -1) ctx.hand(ctx.owner).splice(index, 1);
                } else {
                    const index = ctx.field(ctx.owner).findIndex((slot) => slot && slot.card.uid === entry.card.uid);
                    if (index !== -1) ctx.field(ctx.owner)[index] = null;
                }
                ctx.graveyard(ctx.owner).push(entry.card);
                DuelEngine.notifySacrificedForTribute(ctx.owner, entry.card, ctx.card);
            });
            ctx.log(`${ctx.card.name}: mostri Toon di Livello totale ${selected.reduce((sum, entry) => sum + (entry.card.level || 0), 0)} vengono offerti come Tributo!`);
            return true;
        },
        canActivate(ctx) {
            if (!DuelEngine.hasActiveToonWorld(ctx.owner)
                || ctx.hasUsedOncePerTurn(`toon-bls-banish:${ctx.card.uid}`)) return false;
            return collectFieldTargets(ctx, { owner: 'both', zone: 'both', includiCoperte: true }).length > 0
                || Tavolo.ordine().some((owner) => !!gameState[Tavolo.chiave(owner, 'FieldSpell')]);
        },
        activate(ctx) {
            const candidates = collectFieldTargets(ctx, { owner: 'both', zone: 'both', includiCoperte: true });
            Tavolo.ordine().forEach((owner) => {
                const slot = gameState[Tavolo.chiave(owner, 'FieldSpell')];
                if (slot && slot.card.uid !== ctx.card.uid) candidates.push({ owner, index: -1, zone: 'fieldSpell', card: slot.card, slot });
            });
            chooseFieldCardTarget(ctx, candidates, {
                title: ctx.card.name,
                text: 'Scegli 1 carta sul Terreno da bandire.',
                dichiara: true
            }, (chosen) => {
                let slot = null;
                if (chosen.zone === 'monster') {
                    slot = ctx.field(chosen.owner)[chosen.index];
                    if (slot) ctx.field(chosen.owner)[chosen.index] = null;
                } else if (chosen.zone === 'st') {
                    slot = ctx.stField(chosen.owner)[chosen.index];
                    if (slot) ctx.stField(chosen.owner)[chosen.index] = null;
                } else {
                    const key = Tavolo.chiave(chosen.owner, 'FieldSpell');
                    slot = gameState[key];
                    if (slot) gameState[key] = null;
                }
                if (!slot) return;
                ctx.banish(chosen.owner, slot.card);
                ctx.card._toonBlsNoAttackTurn = gameState.turn;
                ctx.markUsedOncePerTurn(`toon-bls-banish:${ctx.card.uid}`);
                ctx.log(`${ctx.card.name} bandisce ${slot.card.name} e rinuncia ad attaccare in questo turno!`);
            });
        },
        static(ctx) {
            if (ctx.card._toonBlsNoAttackTurn === gameState.turn) gameState.cannotAttackUids[ctx.card.uid] = true;
        },
        mustTargetFilterIfPresent(card, owner) {
            return DuelEngine.hasActiveToonWorld(owner) && cardHasArchetype(card, 'toon');
        }
    });

    const controlsOriginalNamedGod = (ctx, name) => ctx.field(ctx.owner).some((slot) => slot
        && !slot.isFaceDown && cardHasEffectiveName(slot.card, name, 'monster'));
    const isOwnMainPhase = (ctx) => gameState.currentPlayer === ctx.owner
        && (gameState.phase === 'main1' || gameState.phase === 'main2');

    // Attacco Forza del Tuono — supporto moderno di Slifer.
    CardEffects.register(1271, {
        activationAndEffectCannotBeNegated: true,
        mentionsNames: ['Slifer il Drago del Cielo'],
        canActivate(ctx) {
            return controlsOriginalNamedGod(ctx, 'Slifer il Drago del Cielo')
                && !ctx.hasUsedOncePerTurn(`thunderforce-attack:${ctx.owner}`)
                && ctx.field(ctx.opponent).some((slot) => slot && !slot.isFaceDown);
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`thunderforce-attack:${ctx.owner}`);
            const bersagli = ctx.field(ctx.opponent)
                .map((slot) => slot && !slot.isFaceDown ? slot.card.uid : null)
                .filter(Boolean);
            for (let i = ctx.field(ctx.opponent).length - 1; i >= 0; i--) {
                const slot = ctx.field(ctx.opponent)[i];
                if (slot && !slot.isFaceDown) ctx.destroyMonster(ctx.opponent, i);
            }
            const distruttiNelCimitero = bersagli.filter((uid) => ctx.graveyard(ctx.opponent).some((card) => card.uid === uid)).length;
            if (!isOwnMainPhase(ctx) || distruttiNelCimitero === 0) return;

            const fine = attendiScelta(ctx);
            chooseOption(ctx, {
                title: ctx.card.name,
                text: `Pescare ${distruttiNelCimitero} ${distruttiNelCimitero === 1 ? 'carta' : 'carte'}? In questo turno potrai attaccare con un solo mostro.`,
                options: [{ value: 'draw', label: `Pesca ${distruttiNelCimitero}` }],
                optional: true,
                optionalLabel: 'Non pescare',
                pickForBot: () => 'draw'
            }, (choice) => {
                try {
                    if (choice === 'draw') {
                        ctx.drawCards(ctx.owner, distruttiNelCimitero);
                        gameState.onlyOneAttackingMonsterFor = gameState.onlyOneAttackingMonsterFor || {};
                        gameState.onlyOneAttackingMonsterFor[ctx.owner] = true;
                        ctx.log(`${ctx.card.name}: ${distruttiNelCimitero} ${distruttiNelCimitero === 1 ? 'carta pescata' : 'carte pescate'}; un solo mostro potrà attaccare in questo turno.`);
                    }
                } finally { fine(); }
            });
        }
    });

    // Pugno del Fato — supporto moderno di Obelisk.
    CardEffects.register(1272, {
        activationAndEffectCannotBeNegated: true,
        mentionsNames: ['Obelisk il Tormentatore'],
        canActivate(ctx) {
            return controlsOriginalNamedGod(ctx, 'Obelisk il Tormentatore')
                && !ctx.hasUsedOncePerTurn(`fist-of-fate:${ctx.owner}`)
                && ctx.field(ctx.opponent).some((slot) => slot && !slot.isFaceDown && !slot.card.vanilla);
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`fist-of-fate:${ctx.owner}`);
            const candidati = collectFieldTargets(ctx, {
                owner: 'opponent',
                zone: 'monster',
                filter: (card, owner, slot) => !slot.isFaceDown && !card.vanilla
            });
            const fine = attendiScelta(ctx);
            const offriDistruzioneRetroguardia = () => {
                if (!isOwnMainPhase(ctx)) { fine(); return; }
                chooseOption(ctx, {
                    title: ctx.card.name,
                    text: 'Distruggere tutte le Magie e Trappole controllate dall’avversario?',
                    options: [{ value: 'destroy', label: 'Distruggi tutte' }],
                    optional: true,
                    optionalLabel: 'Non applicare',
                    pickForBot: () => 'destroy'
                }, (choice) => {
                    try {
                        if (choice !== 'destroy') return;
                        for (let i = ctx.stField(ctx.opponent).length - 1; i >= 0; i--) {
                            if (ctx.stField(ctx.opponent)[i]) ctx.destroySpellTrap(ctx.opponent, i);
                        }
                        if (gameState[Tavolo.chiave(ctx.opponent, 'FieldSpell')]) ctx.destroyFieldSpell(ctx.opponent);
                    } finally { fine(); }
                });
            };
            const apri = () => chooseFieldMonsterTarget(ctx, candidati, {
                title: ctx.card.name,
                text: 'Scegli 1 Mostro con Effetto scoperto dell’avversario.',
                dichiara: true,
                onCancel: apri,
                onNegato: offriDistruzioneRetroguardia
            }, (chosen) => {
                const slot = ctx.field(chosen.owner)[chosen.index];
                if (slot && slot.card.uid === chosen.card.uid) {
                    gameState.monsterEffectNamesNegatedThisTurn = gameState.monsterEffectNamesNegatedThisTurn || new Set();
                    gameState.monsterEffectNamesNegatedThisTurn.add(slot.card.name);
                    ctx.destroyMonster(chosen.owner, chosen.index);
                }
                offriDistruzioneRetroguardia();
            });
            apri();
        }
    });

    // Canto Antico — supporto moderno del Drago Alato di Ra.
    CardEffects.register(1273, {
        mentionsNames: ['Il Drago Alato di Ra'],
        canActivate(ctx) {
            if (ctx.hasUsedOncePerTurn(`ancient-chant-search:${ctx.owner}`)) return false;
            return Tavolo.mazzo(ctx.owner).some((card) => card.id === 472)
                || ctx.graveyard(ctx.owner).some((card) => card.id === 472);
        },
        activate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner);
            const grave = ctx.graveyard(ctx.owner);
            const candidates = deck.filter((card) => card.id === 472).concat(grave.filter((card) => card.id === 472));
            const fine = attendiScelta(ctx);
            chooseCardFromList(ctx, candidates, {
                title: ctx.card.name,
                text: 'Scegli Il Drago Alato di Ra da aggiungere alla mano.',
                pickForBot: (cards) => cards[0]
            }, (chosen) => {
                try {
                    const source = deck.includes(chosen) ? deck : grave;
                    const index = source.indexOf(chosen);
                    if (index === -1) return;
                    source.splice(index, 1);
                    ctx.hand(ctx.owner).push(chosen);
                    gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
                    gameState.additionalTributeSummonFor = gameState.additionalTributeSummonFor || { player: false, bot: false };
                    gameState.additionalTributeSummonFor[ctx.owner] = true;
                    ctx.markUsedOncePerTurn(`ancient-chant-search:${ctx.owner}`);
                    ctx.log(`${ctx.card.name} aggiunge ${chosen.name} alla mano e concede un’Evocazione Tributo aggiuntiva!`);
                } finally { fine(); }
            });
        },
        canActivateFromGraveyardMainPhase(ctx) {
            return !ctx.hasUsedOncePerTurn(`ancient-chant-grave:${ctx.owner}`)
                && ctx.hand(ctx.owner).some((card) => card.id === 472);
        },
        activateFromGraveyardMainPhase(ctx) {
            const grave = ctx.graveyard(ctx.owner);
            const index = grave.findIndex((card) => card.uid === ctx.card.uid);
            if (index === -1) return;
            if (ctx.graveyardMoveNegated(ctx.owner)) return;
            const [chant] = grave.splice(index, 1);
            ctx.banish(ctx.owner, chant);
            ctx.markUsedOncePerTurn(`ancient-chant-grave:${ctx.owner}`);
            gameState.ancientChantRaBoostTurnFor = gameState.ancientChantRaBoostTurnFor || { player: null, bot: null };
            gameState.ancientChantRaBoostTurnFor[ctx.owner] = gameState.turn;
            ctx.log(`${ctx.card.name} viene bandito: Ra riceverà la forza originale dei suoi Tributi in questo turno!`);
        }
    });

    const isDivineBeast = (card) => card && (card.id === 30 || card.id === 31 || card.id === 472
        || card.race === 'Essere Divino');

    const tributableFieldTargets = (ctx, side) => collectFieldTargets(ctx, {
        owner: side,
        zone: 'monster',
        includiCoperte: true,
        filter: (card, owner, slot) => {
            const def = DuelEngine.getDefinition(card.id);
            return !(!slot.isFaceDown && def && def.cannotBeTributed)
                && !(gameState.cannotBeTributedUids && gameState.cannotBeTributedUids.has(card.uid));
        }
    });

    /** Risolve una Evocazione Tributo prodotta da un effetto/procedura speciale. */
    const resolveCrossFieldTributeSummon = (ctx, card, chosen, destinationOwner, options) => {
        const hand = ctx.hand(ctx.owner);
        const handIndex = hand.findIndex((entry) => entry.uid === card.uid);
        if (handIndex === -1 || chosen.length !== 3) return false;
        const destinationField = ctx.field(destinationOwner);
        const willFreeDestinationSlot = chosen.some((entry) => entry.owner === destinationOwner);
        if (destinationField.every(Boolean) && !willFreeDestinationSlot) return false;

        card._tributedCardIds = chosen.map((entry) => entry.card.id);
        card._tributedOriginalStats = chosen.map((entry) => {
            const original = cardDatabase.find((candidate) => candidate.id === entry.card.id) || entry.card;
            return { id: entry.card.id, attack: original.attack || 0, defense: original.defense || 0 };
        });
        card._tributeCountForSummon = chosen.length;

        // Indici decrescenti per lato: nessuno splice, ma evita che futuri
        // campi compatti possano invalidare una seconda scelta.
        chosen.slice().sort((a, b) => b.index - a.index).forEach((entry) => {
            const field = ctx.field(entry.owner);
            const slot = field[entry.index];
            if (!slot || slot.card.uid !== entry.card.uid) return;
            const graveOwner = slot.originalOwner || entry.owner;
            field[entry.index] = null;
            ctx.graveyard(graveOwner).push(slot.card);
            DuelEngine.notifyOwnMonsterSentToGraveyard(graveOwner, slot.card);
            DuelEngine.notifySacrificedForTribute(graveOwner, slot.card, card);
        });

        const slotIndex = ctx.findEmptyMonsterSlot(destinationOwner);
        if (slotIndex === -1) return false;
        hand.splice(handIndex, 1);
        const slot = {
            card: card,
            position: 'attack',
            isFaceDown: false,
            hasAttacked: false,
            canChangePosition: false,
            summonedOnTurn: gameState.turn
        };
        if (destinationOwner !== ctx.owner) slot.originalOwner = ctx.owner;
        destinationField[slotIndex] = slot;
        if (options && options.returnAtNextEndPhase) card._sphereReturnAfterTurn = gameState.turn + 1;
        consumeNormalSummonQuota(ctx.owner, card);
        ctx.log(`🔺 Evocazione Tributo: ${card.name} entra sul Terreno ${destinationOwner === ctx.owner ? 'del suo proprietario' : 'avversario'}!`);
        const summonCtx = DuelEngine.makeContext(destinationOwner, {
            summonedCard: card,
            summonedSlotIndex: slotIndex,
            summonedPosition: 'attack',
            summonedByOwner: ctx.owner
        });
        DuelEngine.fireTrigger(DuelEngine.TRIGGER.ON_NORMAL_SUMMON, summonCtx, () => updateUI());
        return true;
    };

    // Incrocio di Anime — selezione esplicita del Dio e dei tre Tributi,
    // anche dal Terreno avversario. Il vincolo sulle attivazioni nasce
    // soltanto se almeno un mostro avversario viene davvero usato.
    CardEffects.register(1274, {
        canActivate(ctx) {
            if (gameState.phase !== 'main1' && gameState.phase !== 'main2') return false;
            if (gameState.currentPlayer !== ctx.owner || gameState.tributesBlocked) return false;
            if (ctx.hasUsedOncePerTurn(`soul-crossing:${ctx.owner}`)) return false;
            if (!canUseNormalSummonQuota(ctx.owner, { type: 'monster', level: 10 })) return false;
            const gods = ctx.hand(ctx.owner).filter(isDivineBeast);
            return gods.length > 0
                && tributableFieldTargets(ctx, 'both').length >= 3
                && (ctx.findEmptyMonsterSlot(ctx.owner) !== -1 || tributableFieldTargets(ctx, 'self').length > 0);
        },
        activate(ctx) {
            const gods = ctx.hand(ctx.owner).filter(isDivineBeast);
            const fine = attendiScelta(ctx);
            chooseCardFromList(ctx, gods, {
                title: ctx.card.name,
                text: 'Scegli la Divinità-Bestia da Evocare tramite Tributo.',
                pickForBot: (cards) => cards.slice().sort((a, b) => (b.attack || 0) - (a.attack || 0))[0]
            }, (god) => {
                const candidates = (selected) => {
                    const all = tributableFieldTargets(ctx, 'both');
                    // Con il proprio Terreno pieno almeno un Tributo deve
                    // provenire da lì, altrimenti non esisterebbe una zona
                    // in cui far entrare la Divinità dopo la risoluzione.
                    if (ctx.findEmptyMonsterSlot(ctx.owner) === -1 && selected.length === 2
                        && !selected.some((entry) => entry.owner === ctx.owner)) {
                        return all.filter((entry) => entry.owner === ctx.owner);
                    }
                    return all.sort((a, b) => {
                        if (a.owner !== b.owner) return a.owner === ctx.opponent ? -1 : 1;
                        return a.owner === ctx.opponent
                            ? DuelEngine.getEffectiveAtk(b.card) - DuelEngine.getEffectiveAtk(a.card)
                            : DuelEngine.getEffectiveAtk(a.card) - DuelEngine.getEffectiveAtk(b.card);
                    });
                };
                const steps = [1, 2, 3].map((number) => ({
                    candidati: candidates,
                    title: ctx.card.name,
                    text: `Scegli il Tributo ${number}/3.`,
                    dichiara: false
                }));
                chooseFieldTargetsInSequence(ctx, steps, (chosen) => {
                    try {
                        if (chosen.length !== 3) return;
                        const usedOpponent = chosen.some((entry) => entry.owner === ctx.opponent);
                        if (!resolveCrossFieldTributeSummon(ctx, god, chosen, ctx.owner)) return;
                        ctx.markUsedOncePerTurn(`soul-crossing:${ctx.owner}`);
                        if (usedOpponent) {
                            gameState.soulCrossingActivationLimitFor = gameState.soulCrossingActivationLimitFor || {};
                            gameState.soulCrossingActivationLimitFor[ctx.owner] = {
                                expiresAfterTurn: gameState.turn + 1,
                                // L'attivazione di Incrocio stessa è già
                                // l'unica attivazione concessa in questo turno.
                                usedOnTurn: gameState.turn
                            };
                        }
                    } finally { fine(); }
                });
            });
        }
    });

    CardEffects.register(1275, {
        cannotSpecialSummon: true,
        cannotBeSet: true,
        beginCustomNormalSummon(ctx) {
            if (gameState.tributesBlocked) {
                ctx.log(`❌ Maschera della Restrizione impedisce di Evocare ${ctx.card.name}.`);
                return;
            }
            if (!canUseNormalSummonQuota(ctx.owner, ctx.card)) return;
            const own = tributableFieldTargets(ctx, 'self');
            const enemy = tributableFieldTargets(ctx, 'opponent');
            const sides = [];
            if (own.length >= 3) sides.push({ value: ctx.owner, label: 'Il tuo Terreno' });
            if (enemy.length >= 3) sides.push({ value: ctx.opponent, label: 'Terreno avversario' });
            if (!sides.length) { ctx.log('❌ Modalità Sfera richiede tre Tributi sullo stesso Terreno.'); return; }
            const chooseSide = (side) => {
                const candidates = () => tributableFieldTargets(ctx, side === ctx.owner ? 'self' : 'opponent')
                    .sort((a, b) => side === ctx.opponent
                        ? DuelEngine.getEffectiveAtk(b.card) - DuelEngine.getEffectiveAtk(a.card)
                        : DuelEngine.getEffectiveAtk(a.card) - DuelEngine.getEffectiveAtk(b.card));
                const steps = [1, 2, 3].map((number) => ({
                    candidati: candidates,
                    title: ctx.card.name,
                    text: `Scegli il Tributo ${number}/3.`,
                    dichiara: false
                }));
                chooseFieldTargetsInSequence(ctx, steps, (chosen) => {
                    if (chosen.length === 3) resolveCrossFieldTributeSummon(ctx, ctx.card, chosen, side, { returnAtNextEndPhase: side !== ctx.owner });
                });
            };
            if (sides.length === 1) chooseSide(sides[0].value);
            else chooseOption(ctx, {
                title: ctx.card.name,
                text: 'Da quale Terreno vuoi offrire i tre Tributi?',
                options: sides,
                pickForBot: () => ctx.opponent
            }, chooseSide);
        },
        static(ctx) {
            gameState.cannotAttackUids[ctx.card.uid] = true;
            gameState.cannotBeAttackTargetUids[ctx.card.uid] = true;
            gameState.cannotBeTargetedByOpponentEffectsUids[ctx.card.uid] = ctx.owner;
        },
        canActivate(ctx) {
            return (ctx.hand(ctx.owner).some((card) => card.id === 472) || Tavolo.mazzo(ctx.owner).some((card) => card.id === 472))
                && ctx.findEmptyMonsterSlot(ctx.owner) !== -1;
        },
        activate(ctx) {
            const ownIndex = ctx.field(ctx.owner).findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
            if (ownIndex === -1) return;
            const hand = ctx.hand(ctx.owner);
            const deck = Tavolo.mazzo(ctx.owner);
            let source = hand;
            let index = hand.findIndex((card) => card.id === 472);
            if (index === -1) { source = deck; index = deck.findIndex((card) => card.id === 472); }
            if (index === -1) return;
            ctx.sendMonsterToGraveyard(ctx.owner, ownIndex);
            const [ra] = source.splice(index, 1);
            gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
            ra.attack = 4000;
            ra.defense = 4000;
            ctx.specialSummon(ctx.owner, ra, ctx.findEmptyMonsterSlot(ctx.owner), 'attack', source === deck ? 'deck' : 'hand', { ignoreSummoningConditions: true });
        },
        onEndPhase(ctx) {
            if (!ctx.card._sphereReturnAfterTurn || gameState.turn < ctx.card._sphereReturnAfterTurn) return;
            const originalOwner = ctx.slot && ctx.slot.originalOwner;
            if (!originalOwner || originalOwner === ctx.owner) { delete ctx.card._sphereReturnAfterTurn; return; }
            if (ctx.takeControl(originalOwner, ctx.owner, ctx.slotIndex, true)) {
                delete ctx.card._sphereReturnAfterTurn;
                ctx.log(`☀️ ${ctx.card.name} torna sotto il controllo del suo proprietario.`);
            }
        }
    });

    CardEffects.register(1276, {
        cannotNormalSummon: true,
        cannotSpecialSummon: true,
        unaffectedByOtherCardEffects: true,
        graveyardTriggerCannotBeRespondedTo: true,
        onOwnMonsterSentToGraveyardWhileInGraveyard(ctx) {
            if (!ctx.sentCard || ctx.sentCard.id !== 472) return;
            const grave = ctx.graveyard(ctx.owner);
            const index = grave.findIndex((card) => card.uid === ctx.card.uid);
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (index === -1 || slotIndex === -1) return;
            const [phoenix] = grave.splice(index, 1);
            ctx.specialSummon(ctx.owner, phoenix, slotIndex, 'attack', 'graveyard', { ignoreSummoningConditions: true });
            ctx.log(`🔥 ${phoenix.name} risorge dal Cimitero senza possibilità di risposta!`);
        },
        canActivate(ctx) {
            return Tavolo.lp(ctx.owner) > 1000
                && collectFieldTargets(ctx, { owner: 'both', zone: 'monster', includiCoperte: true })
                    .some((entry) => entry.card.uid !== ctx.card.uid);
        },
        activate(ctx) {
            const candidates = collectFieldTargets(ctx, { owner: 'both', zone: 'monster', includiCoperte: true })
                .filter((entry) => entry.card.uid !== ctx.card.uid)
                .sort((a, b) => DuelEngine.getEffectiveAtk(b.card) - DuelEngine.getEffectiveAtk(a.card));
            const fine = attendiScelta(ctx);
            chooseFieldCardTarget(ctx, candidates, {
                title: ctx.card.name,
                text: 'Paga 1000 LP e scegli 1 mostro da mandare al Cimitero.',
                dichiara: false,
                onCancel: () => fine()
            }, (chosen) => {
                try {
                    if (Tavolo.lp(ctx.owner) <= 1000) return;
                    ctx.dealDamage(ctx.owner, 1000);
                    ctx.sendMonsterToGraveyard(chosen.owner, chosen.index);
                } finally { fine(); }
            });
        },
        onEndPhase(ctx) {
            const ownIndex = ctx.field(ctx.owner).findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
            if (ownIndex === -1) return;
            const zones = [ctx.hand(ctx.owner), Tavolo.mazzo(ctx.owner), ctx.graveyard(ctx.owner)];
            let source = null;
            let sphereIndex = -1;
            for (const zone of zones) {
                sphereIndex = zone.findIndex((card) => card.id === 1275);
                if (sphereIndex !== -1) { source = zone; break; }
            }
            if (!source) return;
            ctx.sendMonsterToGraveyard(ctx.owner, ownIndex);
            const [sphere] = source.splice(sphereIndex, 1);
            gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = Tavolo.mazzo(ctx.owner).length;
            ctx.specialSummon(ctx.owner, sphere, ctx.findEmptyMonsterSlot(ctx.owner), 'attack',
                source === ctx.graveyard(ctx.owner) ? 'graveyard' : (source === Tavolo.mazzo(ctx.owner) ? 'deck' : 'hand'),
                { ignoreSummoningConditions: true });
            ctx.log(`☀️ ${ctx.card.name} ritorna alla ${sphere.name}.`);
        }
    });

    // ================================================================
    // 1277-1282 — due nuclei incompleti di Yugi/Yami Yugi.
    //
    // I tre Guerrieri Magnetici non sono una Fusione: Valkyrion resta nel
    // Main Deck e si Evoca dalla mano offrendo i tre nomi esatti dalla
    // mano e/o dal Terreno. I Cavalieri delle Figure usano invece la vera
    // Evocazione tramite Fusione condivisa, con Polimerizzazione.
    // ================================================================

    // 1277 — Guerriero Magnetico Gamma: Mostro Normale, nessun handler.

    // 1278 — Valkyrion Guerriero Magnetico.
    (function registerValkyrion() {
        const MATERIAL_IDS = [85, 112, 1277];

        function findMaterials(ctx) {
            const field = ctx.field(ctx.owner);
            const hand = ctx.hand(ctx.owner);
            const usedField = new Set();
            const usedHand = new Set();
            const chosen = [];
            // Preferire il Terreno libera una Zona Mostri e non rende
            // impossibile l'Evocazione quando tutte le caselle sono piene.
            for (const id of MATERIAL_IDS) {
                let index = field.findIndex((slot, i) => slot && slot.card.id === id && !usedField.has(i));
                if (index !== -1) {
                    usedField.add(index);
                    chosen.push({ zone: 'field', uid: field[index].card.uid });
                    continue;
                }
                index = hand.findIndex((card, i) => card.id === id && !usedHand.has(i));
                if (index === -1) return null;
                usedHand.add(index);
                chosen.push({ zone: 'hand', uid: hand[index].uid });
            }
            return chosen;
        }

        CardEffects.register(1278, {
            cannotNormalSummon: true,
            specialSummonReleasesOwnMonsterZone: true,
            canSpecialSummonFromHand(ctx) {
                const materials = findMaterials(ctx);
                if (!materials) return false;
                return ctx.findEmptyMonsterSlot(ctx.owner) !== -1
                    || materials.some((entry) => entry.zone === 'field');
            },
            paySpecialSummonCost(ctx) {
                const materials = findMaterials(ctx);
                if (!materials) return false;
                materials.forEach((entry) => {
                    if (entry.zone === 'field') {
                        const index = ctx.field(ctx.owner).findIndex((slot) => slot && slot.card.uid === entry.uid);
                        if (index !== -1) ctx.sendMonsterToGraveyard(ctx.owner, index);
                    } else {
                        const index = ctx.hand(ctx.owner).findIndex((card) => card.uid === entry.uid);
                        if (index !== -1) ctx.sendChosenFromHandToGraveyard(ctx.owner, index);
                    }
                });
                ctx.log('🧲 Alpha, Beta e Gamma si uniscono per chiamare Valkyrion!');
                return true;
            },
            canActivate(ctx) {
                const grave = ctx.graveyard(ctx.owner);
                const field = ctx.field(ctx.owner);
                return MATERIAL_IDS.every((id) => grave.some((card) => card.id === id))
                    && field.filter((slot) => slot === null).length + 1 >= 3;
            },
            activate(ctx) {
                const ownIndex = ctx.field(ctx.owner).findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
                if (ownIndex === -1) return;
                const materialCards = MATERIAL_IDS.map((id) => ctx.graveyard(ctx.owner).find((card) => card.id === id));
                if (materialCards.some((card) => !card)) return;
                ctx.sendMonsterToGraveyard(ctx.owner, ownIndex);
                materialCards.forEach((material) => {
                    const grave = ctx.graveyard(ctx.owner);
                    const graveIndex = grave.findIndex((card) => card.uid === material.uid);
                    const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                    if (graveIndex === -1 || slotIndex === -1) return;
                    const [card] = grave.splice(graveIndex, 1);
                    ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'graveyard');
                });
                ctx.log('🧲 Valkyrion si separa: Alpha, Beta e Gamma tornano sul Terreno!');
            }
        });
    })();

    // 1279 — Cavaliere della Regina: Mostro Normale, nessun handler.

    // 1280 — Cavaliere del Re: il trigger è valido solo per una vera
    // Evocazione Normale, non per Flip o Special Summon.
    CardEffects.register(1280, {
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            const controlsQueen = ctx.field(ctx.owner).some((slot) => slot
                && !slot.isFaceDown && slot.card.id === 1279);
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            const deck = Tavolo.mazzo(ctx.owner);
            const jackIndex = deck.findIndex((card) => card.id === 1281);
            if (!controlsQueen || slotIndex === -1 || jackIndex === -1) return;
            const [jack] = deck.splice(jackIndex, 1);
            gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
            ctx.specialSummon(ctx.owner, jack, slotIndex, 'attack', 'deck');
            ctx.log('🃏 Cavaliere del Re chiama Cavaliere del Jack dal Deck!');
        }
    });

    // 1281 — Cavaliere del Jack: Mostro Normale, nessun handler.

    // 1282 — Cavaliere Joker Arcano. Il checkpoint condiviso di targeting
    // lo interpella soltanto quando è proprio lui il bersaglio. Scarta una
    // carta dello stesso tipo della fonte e annulla quell'effetto, senza
    // distruggere la carta sorgente (testo TCG). Il primo scarto idoneo è
    // deterministico anche nel Multiplayer; non serve una nuova finestra
    // asincrona nel mezzo della risoluzione del bersaglio.
    CardEffects.register(1282, {
        fusionMaterials: [1279, 1281, 1280],
        canReactToTargetDeclare(ctx) {
            if (!ctx.sourceCard || ctx.sourceOwner === ctx.owner) return false;
            if (ctx.hasUsedOncePerTurn(`arcana-joker:${ctx.card.uid}`)) return false;
            return ctx.hand(ctx.owner).some((card) => card.type === ctx.sourceCard.type);
        },
        onCardEffectTargetDeclare(ctx) {
            const index = ctx.hand(ctx.owner).findIndex((card) => card.type === ctx.sourceCard.type);
            if (index === -1) return;
            const discarded = ctx.discardChosenFromHand(ctx.owner, index);
            ctx.markUsedOncePerTurn(`arcana-joker:${ctx.card.uid}`);
            ctx.cancel();
            ctx.log(`🃏 Cavaliere Joker Arcano scarta ${discarded.name} e annulla l'effetto che lo bersaglia!`);
        }
    });

    (function registerLibraryEffects() {
        if (typeof cardDatabase === 'undefined' || !Array.isArray(cardDatabase)) return;

        // Passata 1: "effectTemplate" — self-contenuti, nessuna dipendenza
        // da altre carte.
        cardDatabase.forEach((card) => {
            if (DuelEngine.getDefinition(card.id)) return; // già registrata: mai sovrascrivere
            if (card.effectTemplate && window.EffectTemplates) {
                const definition = EffectTemplates.build(card.effectTemplate.name, card.effectTemplate.params);
                if (definition) CardEffects.register(card.id, definition);
            }
        });

        // Passata 2: "cloneEffectOf" — ripetuta finché fa progressi, così
        // funziona anche clonare una carta che a sua volta clona
        // un'altra (limite di sicurezza: mai più passate delle carte
        // totali, per non restare bloccati su un riferimento circolare).
        let progressed = true;
        let safety = cardDatabase.length;
        while (progressed && safety-- > 0) {
            progressed = false;
            cardDatabase.forEach((card) => {
                if (card.cloneEffectOf === undefined || DuelEngine.getDefinition(card.id)) return;
                const source = DuelEngine.getDefinition(card.cloneEffectOf);
                if (source) {
                    CardEffects.register(card.id, source);
                    progressed = true;
                }
            });
        }
        cardDatabase.forEach((card) => {
            if (card.cloneEffectOf !== undefined && !DuelEngine.getDefinition(card.id)) {
                console.warn(`[card-effects] "${card.name}" (id ${card.id}): cloneEffectOf ${card.cloneEffectOf} non trovato (riferimento non valido o circolare).`);
            }
        });
    })();
})();
