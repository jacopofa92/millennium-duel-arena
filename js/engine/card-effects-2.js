/**
 * card-effects-2.js — Effetti delle carte, parte 2 di 8.
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

    const { chooseCardFromList, otherHandCards, blockBanishFromField, isHarpieLadySupport, findEquipTarget, equipToChosenTarget, attachEquip, equippedTarget, searchDeckWithChoice, searchGraveyardWithChoice, chooseFieldCardTarget, collectFieldTargets, offerHandDiscardChoice, chooseCardFromHand, attachUnionMonster, maxRitualTributeLevel, performRitualTribute, findPetitMothReadyForCocoonSummon, releaseRelinquishedTarget } = window.CardEffectsShared;

    // ================================================================
    // 52 — Grande Falena / Great Moth
    // Identica a 50 (Larva Mostruosa) ma al proprio 4° turno dopo
    // l'equipaggiamento invece del 2°.
    // ================================================================
    CardEffects.register(52, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) { return findPetitMothReadyForCocoonSummon(ctx, 4) !== -1; },
        paySpecialSummonCost(ctx) {
            const i = findPetitMothReadyForCocoonSummon(ctx, 4);
            if (i === -1) return false;
            const sacrificed = ctx.field(ctx.owner)[i];
            ctx.field(ctx.owner)[i] = null;
            ctx.graveyard(ctx.owner).push(sacrificed.card);
            ctx.log(`🐛 Piccola Falena sacrificata per Special Summonare ${ctx.card.name}!`);
            return true;
        }
    });

    // ================================================================
    // 1124 — Falena Perfetta / Perfectly Ultimate Great Moth
    // Identica a 50/52 (Larva Mostruosa/Grande Falena) ma al proprio 6°
    // turno (o successivo — "or later", da qui il controllo >= invece di
    // === usato da findPetitMothReadyForCocoonSummon) dopo
    // l'equipaggiamento invece del 2°/4°. Zero infrastruttura nuova:
    // stesso identico schema, solo un confronto diverso perché questa è
    // l'unica delle 3 evoluzioni con "o successivo" nel testo reale (le
    // altre due hanno una finestra fissa, mai verificata "o oltre" perché
    // nessun mazzo di test le aveva mai lasciate scadere).
    // ================================================================
    function findPetitMothReadyForCocoonSummonAtLeast(ctx, ownTurns) {
        if (gameState.currentPlayer !== ctx.owner) return -1;
        return ctx.field(ctx.owner).findIndex((slot) =>
            slot && !slot.isFaceDown && slot.card.id === 522 &&
            slot.card._cocoonEquippedOnTurn != null &&
            (gameState.turn - slot.card._cocoonEquippedOnTurn) >= ownTurns * 2
        );
    }
    CardEffects.register(1124, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) { return findPetitMothReadyForCocoonSummonAtLeast(ctx, 6) !== -1; },
        paySpecialSummonCost(ctx) {
            const i = findPetitMothReadyForCocoonSummonAtLeast(ctx, 6);
            if (i === -1) return false;
            const sacrificed = ctx.field(ctx.owner)[i];
            ctx.field(ctx.owner)[i] = null;
            ctx.graveyard(ctx.owner).push(sacrificed.card);
            ctx.log(`🐛 Piccola Falena sacrificata per Special Summonare ${ctx.card.name}!`);
            return true;
        }
    });

    // ================================================================
    // 144 — Tartaruga Catapulta / Catapult Turtle (effetto Ignition)
    // Una volta per turno: puoi sacrificare 1 mostro; infliggi danno pari
    // a metà dell'ATK effettivo che aveva il mostro sacrificato. Stesso
    // meccanismo di Soldato Cannone (id 137) più sopra.
    // ================================================================
    CardEffects.register(144, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot);
        },
        activate(ctx) {
            const field = ctx.field(ctx.owner);
            let index = field.findIndex((slot, i) => slot && i !== ctx.index);
            if (index === -1) index = ctx.index;
            const sacrificed = field[index];
            const atk = DuelEngine.getEffectiveAtk(sacrificed.card);
            field[index] = null;
            ctx.graveyard(ctx.owner).push(sacrificed.card);
            const damage = Math.floor(atk / 2);
            ctx.dealDamage(ctx.opponent, damage);
            ctx.log(`🐢 Tartaruga Catapulta sacrifica ${sacrificed.card.name} e infligge ${damage} danni!`);
        }
    });

    // ================================================================
    // 165 — Virus Distruggi-Carte / Crush Card Virus (Trappola Normale)
    // Sacrifica 1 mostro OSCURITÀ con 1000 o meno ATK (auto-selezionato,
    // stesso stile di Soffio Esplosivo id 134): il tuo avversario non
    // subisce danni fino alla fine del turno successivo
    // (gameState.pendingNoDamageExpiry, DuelEngine.processNoDamageExpiry
    // — nuovo, un conteggio "N End Phase" invece del semplice flag
    // noDamageFor esistente, dato che deve sopravvivere al cambio
    // turno), poi distruggi i mostri dell'avversario con ATK effettivo
    // 1500+. "Guarda la sua mano": DuelEngineUI.openCardListPicker con
    // selectable:false (stesso componente già usato da id 86 Amazzone
    // Maestra delle Catene per la stessa identica cosa) — SCOPERTA: la
    // nota precedente diceva che questo effetto non esisteva in questo
    // motore, ma esisteva già per un'altra carta. Il testo salvato per
    // questa carta (semplificato rispetto alla vera Crush Card Virus)
    // non menziona alcuna clausola sul Deck: nota rimossa, l'effetto
    // così come descritto qui è ora completo.
    // ================================================================
    CardEffects.register(165, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.attribute === 'OSCURITÀ' && slot.card.attack <= 1000);
        },
        activate(ctx) {
            const ownField = ctx.field(ctx.owner);
            let tributeIndex = -1;
            let tributeCard = null;
            ownField.forEach((slot, i) => {
                if (slot && !slot.isFaceDown && slot.card.attribute === 'OSCURITÀ' && slot.card.attack <= 1000) {
                    tributeIndex = i;
                    tributeCard = slot.card;
                }
            });
            if (tributeIndex === -1) return;
            ownField[tributeIndex] = null;
            ctx.graveyard(ctx.owner).push(tributeCard);

            gameState.pendingNoDamageExpiry = gameState.pendingNoDamageExpiry || [];
            gameState.pendingNoDamageExpiry.push({ owner: ctx.opponent, endsRemaining: 2 });

            const targetIndices = [];
            ctx.field(ctx.opponent).forEach((slot, index) => {
                if (slot && !slot.isFaceDown && DuelEngine.getEffectiveAtk(slot.card) >= 1500) {
                    targetIndices.push(index);
                }
            });
            if (window.FX && typeof FX.playCrushCardVirus === 'function') {
                FX.playCrushCardVirus(ctx.owner, targetIndices);
            }
            let destroyed = 0;
            targetIndices.forEach((index) => {
                if (!ctx.field(ctx.opponent)[index]) return;
                ctx.destroyMonster(ctx.opponent, index);
                destroyed++;
            });
            ctx.log(`☠️ Virus Distruggi-Carte sacrifica ${tributeCard.name}: l'avversario non subisce danni fino alla fine del turno successivo, ${destroyed} mostr${destroyed === 1 ? 'o' : 'i'} con 1500+ ATK distrutt${destroyed === 1 ? 'o' : 'i'}!`);
            if (Decisioni.rispondeUnaPersona(ctx.owner)) {
                Decisioni.chiedi({
                    chi: ctx.owner,
                    tipo: 'presa-visione',
                    candidati: ctx.hand(ctx.opponent).slice(),
                    titolo: '☠️ Virus Distruggi-Carte',
                    testo: "Guardi la mano dell'avversario.",
                    vuota: "L'avversario non ha carte in mano."
                }, () => {});
            }
        }
    });

    // ================================================================
    // 166 — Maledizione del Demone / Curse of Fiend (Magia Normale)
    // Scambia la Posizione (Attacco <-> Difesa) di tutti i mostri scoperti
    // sul Terreno, di entrambi i giocatori.
    // CORREZIONE di fedeltà: aggiunti i due vincoli mancanti — attivabile
    // solo durante la propria Standby Phase, e le posizioni scambiate non
    // possono essere ricambiate manualmente per il resto del turno
    // (gameState.cannotChangePositionFor[owner] = gameState.turn, stesso
    // meccanismo già esistente per Controllo Mesmerico id 814, si
    // esaurisce da solo al prossimo cambio turno). Il blocco è consultato
    // SOLO da changeMonsterPosition (actions.js, il click manuale del
    // giocatore) — un ricambio via Magia/Trappola/effetto Mostro (es.
    // Controllore del Nemico id 226) muta slot.position direttamente e non
    // passa mai da lì, quindi resta sempre esente per costruzione, esattamente
    // come richiede il testo reale.
    // ================================================================
    CardEffects.register(166, {
        canActivate(ctx) {
            if (gameState.phase !== 'standby' || gameState.currentPlayer !== ctx.owner) return false;
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((slot) => slot && !slot.isFaceDown));
        },
        activate(ctx) {
            let count = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (slot && !slot.isFaceDown) {
                        slot.position = slot.position === 'attack' ? 'defense' : 'attack';
                        count++;
                    }
                });
                gameState.cannotChangePositionFor = gameState.cannotChangePositionFor || {};
                gameState.cannotChangePositionFor[owner] = gameState.turn;
            });
            ctx.log(`🔄 Maledizione del Demone scambia la Posizione di ${count} most${count === 1 ? 'ro' : 'ri'} scopert${count === 1 ? 'o' : 'i'}!`);
        }
    });

    // ================================================================
    // 168 — Maledizione della Bestia Mascherata / Curse of the Masked
    // Beast (Rito) — Special Summon La Bestia Mascherata (id 167) dalla
    // mano, sacrificando dal Terreno mostri per un Livello totale di
    // almeno 8. Stesso meccanismo già usato da Rito del Guerriero Nero
    // (id 56): sacrifica automaticamente i mostri con Livello più alto
    // finché il totale richiesto non è raggiunto.
    // ================================================================
    CardEffects.register(168, {
        canActivate(ctx) {
            const hasRitualMonster = ctx.hand(ctx.owner).some((c) => c.id === 167);
            if (!hasRitualMonster) return false;
            const totalLevel = ctx.field(ctx.owner).reduce((sum, slot) => sum + (slot ? (slot.card.level || 0) : 0), 0);
            return totalLevel >= 8;
        },
        activate(ctx) {
            const field = ctx.field(ctx.owner);
            const occupied = field
                .map((slot, index) => (slot ? { index, level: slot.card.level || 0 } : null))
                .filter(Boolean)
                .sort((a, b) => b.level - a.level);

            let remaining = 8;
            const toSacrifice = [];
            occupied.forEach((entry) => {
                if (remaining <= 0) return;
                toSacrifice.push(entry.index);
                remaining -= entry.level;
            });
            toSacrifice.forEach((index) => {
                ctx.graveyard(ctx.owner).push(field[index].card);
                field[index] = null;
            });

            const hand = ctx.hand(ctx.owner);
            const handIndex = hand.findIndex((c) => c.id === 167);
            if (handIndex === -1) return; // canActivate l'ha già garantito: non dovrebbe succedere
            const [ritualCard] = hand.splice(handIndex, 1);

            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) {
                // Il Terreno è pieno: il mostro rituale finisce comunque
                // nel Cimitero, invece di sparire nel nulla.
                ctx.graveyard(ctx.owner).push(ritualCard);
                ctx.log('⚠️ Il Terreno è pieno: La Bestia Mascherata finisce nel Cimitero.');
                return;
            }
            ctx.specialSummon(ctx.owner, ritualCard, slotIndex, 'attack', 'hand');
            ctx.log('👹 Maledizione della Bestia Mascherata evoca La Bestia Mascherata!');
        }
    });

    // ================================================================
    // 167 — La Bestia Mascherata / The Masked Beast: Evocabile Rituale
    // solo tramite "Maledizione della Bestia Mascherata" (id 168, qui
    // sopra — GIÀ IMPLEMENTATA). Qui serve solo il divieto di Evocazione
    // Normale/Set e di Special Summon per ogni altra via
    // (cannotNormalSummon/cannotBeSpecialSummoned — stesso schema di 413).
    // ================================================================
    CardEffects.register(167, {
        cannotNormalSummon: true,
        cannotBeSpecialSummoned: true
    });

    // ================================================================
    // 150 — Chiron il Mago / Chiron the Mage (effetto Ignition)
    // Una volta per turno: puoi scartare 1 Magia dalla mano, poi scegliere
    // come bersaglio 1 Magia/Trappola controllata dal tuo avversario;
    // distruggila.
    // SEMPLIFICAZIONE residua: sceglie da sola il bersaglio da distruggere
    // (il primo trovato), invece di un'interfaccia di selezione dedicata.
    // La Magia da scartare è invece ora una vera scelta (offerHandDiscardChoice,
    // filtrata alle sole Magie in mano) — bug reale corretto in questa
    // sessione.
    // ================================================================
    CardEffects.register(150, {
        canActivate(ctx) {
            const hasSpellInHand = ctx.hand(ctx.owner).some((c) => c.type === 'spell');
            const hasTarget = ctx.stField(ctx.opponent).some((slot) => slot);
            return hasSpellInHand && hasTarget;
        },
        activate(ctx) {
            const stField = ctx.stField(ctx.opponent);
            const targetIndex = stField.findIndex((slot) => slot);
            if (targetIndex === -1) return;
            offerHandDiscardChoice(ctx, {
                filter: (c) => c.type === 'spell',
                title: '🔮 Chiron il Saggio',
                text: 'Scegli quale Magia scartare dalla mano.'
            }, (discarded) => {
                const target = stField[targetIndex];
                if (!target) return;
                ctx.graveyard(ctx.opponent).push(target.card);
                stField[targetIndex] = null;
                ctx.log(`🔮 Chiron il Saggio scarta ${discarded.name} e distrugge ${target.card.name} dell'avversario!`);
            });
        }
    });

    // ================================================================
    // 188 — Maga Oscura / Dark Magician Girl (buff continuo)
    // Guadagna 300 ATK per ogni "Mago Nero" nel Cimitero.
    // SEMPLIFICAZIONE: l'effetto reale conta anche "Mago del Chaos Oscuro",
    // carta non presente in questo database — qui conta solo "Mago Nero"
    // (id 2).
    // ================================================================
    CardEffects.register(188, {
        static(ctx) {
            const count = ctx.graveyard(ctx.owner).filter((c) => c.id === 2).length;
            gameState.atkDefBonus[ctx.card.uid] = { atk: count * 300, def: 0 };
        }
    });

    // ================================================================
    // 191 — Saggio Oscuro / Dark Sage
    // Non può essere Evocato Normalmente/Set. Se hai indovinato il
    // lancio di moneta dell'effetto di "Stregone del Tempo" (id 28, già
    // registrata — vedi gameState.timeWizardCoinResultFor lì, nuovo):
    // puoi sacrificare 1 "Mago Nero" (id 2) sul Terreno; Special Summon
    // questa carta dalla mano O DAL DECK — la parte "dal Deck" è
    // agganciata direttamente dentro l'attivazione di Mago del Tempo
    // (id 28, cerca "Saggio Oscuro" lì), con una scelta reale
    // (DuelEngineUI.openChoicePopover) dato che non c'è un elemento
    // cliccabile naturale per una carta che sta nel Deck. Se Special
    // Summonata così: aggiungi 1 Magia dal Deck alla mano
    // (ctx.searchDeckToHand).
    // ================================================================
    CardEffects.register(191, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            const r = gameState.timeWizardCoinResultFor;
            const guessedRight = !!(r && r.owner === ctx.owner && r.heads === true && r.turn === gameState.turn);
            return guessedRight && ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.id === 2);
        },
        paySpecialSummonCost(ctx) {
            // Sacrificio, non distruzione — stesso stile diretto già
            // usato per Grande Pillola Evolutiva (id 810)/Soffio
            // Esplosivo (id 134): niente ctx.destroyMonster, un
            // Sacrificio non fa scattare "quando questa carta viene
            // distrutta".
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && !slot.isFaceDown && slot.card.id === 2);
            if (index === -1) return false;
            const card = field[index].card;
            field[index] = null;
            ctx.graveyard(ctx.owner).push(card);
            return true;
        },
        onSpecialSummon(ctx) {
            searchDeckWithChoice(ctx, (c) => c.type === 'spell', {
                title: '📖 Saggio Oscuro',
                text: 'Scegli quale Magia aggiungere alla mano dal Deck.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`📖 Saggio Oscuro aggiunge ${card.name} alla mano dal Deck!`);
            });
        }
    });

    // ================================================================
    // 192 — Santuario Oscuro / Dark Sanctuary (Magia Terreno)
    // Quando un mostro dell'avversario dichiara un attacco: lancia una
    // moneta; se esce Testa, annulla l'attacco e infliggi danno pari a
    // metà dell'ATK di quel mostro — stesso schema di Cilindro Magico
    // (id 10, onAttackDeclare + ctx.cancelAttack), ma da una Magia
    // Terreno invece che una Trappola: nuovo scan sulla zona
    // 'fieldSpell' in findTriggerCandidates (duel-engine.js), che prima
    // ne era del tutto priva — nessuna carta di questo dataset aveva mai
    // avuto bisogno di rispondere agli attacchi da lì.
    // Prima clausola (interazione con "Tavola del Destino"/"Spirit Message")
    // ora implementata — vedi la registrazione di Destiny Board (id
    // 866) qui sotto in questo file, dove vive tutta la logica vera
    // (Santuario Oscuro stessa non ha bisogno di alcun hook proprio: è
    // Destiny Board a controllare se il giocatore la controlla scoperta
    // sul Terreno, non il contrario).
    // ================================================================
    CardEffects.register(192, {
        onAttackDeclare(ctx) {
            const heads = ctx.random() < 0.5;
            if (!heads) {
                ctx.log('🪙 Santuario Oscuro lancia una moneta: Croce, l\'attacco prosegue.');
                return;
            }
            const damage = Math.floor(ctx.attackerAtk / 2);
            ctx.cancelAttack();
            ctx.dealDamage(ctx.opponent, damage);
            ctx.log(`🪙 Santuario Oscuro lancia una moneta: Testa! Annulla l'attacco e infligge ${damage} danni!`);
        }
    });

    // ================================================================
    // 193 — Zebra Oscura / Dark Zebra (onStandbyPhase)
    // Se questa carta è l'unico mostro che controlli durante la tua
    // Standby Phase: passa in Posizione di Difesa (non può cambiare
    // Posizione in questo stesso turno).
    // ================================================================
    CardEffects.register(193, {
        onStandbyPhase(ctx) {
            const onlyMonster = ctx.field(ctx.owner).filter((slot) => slot).length === 1;
            if (!onlyMonster || ctx.slot.position === 'defense') return;
            ctx.changePosition(ctx.owner, ctx.slotIndex, 'defense');
            ctx.slot.isFaceDown = false;
            ctx.slot.canChangePosition = false;
            ctx.log('🦓 Zebra Oscura, unico mostro in campo, passa in Posizione di Difesa!');
        }
    });

    // ================================================================
    // 195 — Rimuovi Magia / De-Spell (Magia Normale)
    // Distrugge 1 Magia scoperta sul Terreno (di preferenza dell'avversario).
    // SEMPLIFICAZIONE: nella realtà può bersagliare anche una Magia/Trappola
    // Set (rivelandola, e distruggendola solo se è davvero una Magia) — qui
    // sceglie solo fra le Magie GIÀ scoperte (le Continue/Campo, uniche a
    // restare sul Terreno — le Magie Normali si scartano subito dopo la
    // risoluzione, quindi non ci sono mai da colpire con questo effetto).
    // ================================================================
    // CORREZIONE: la versione precedente permetteva di scegliere come
    // bersaglio SOLO una Magia già scoperta. Il testo ufficiale vero
    // ("Target 1 face-up Spell, or 1 Set Spell/Trap, on the field;
    // destroy that target if it is a Spell. If the target is Set, reveal
    // it.") permette invece di scegliere come bersaglio ANCHE una carta
    // Set (Magia o Trappola) non ancora rivelata: se si rivela una
    // Trappola, l'effetto fallisce senza fare nulla; se è una Magia
    // (scoperta o appena rivelata), viene distrutta.
    CardEffects.register(195, {
        canActivate(ctx) {
            return [ctx.opponent, ctx.owner].some((owner) => ctx.stField(owner).some((slot) => slot && (slot.card.type === 'spell' || slot.isFaceDown)));
        },
        activate(ctx) {
            const candidates = [];
            [ctx.owner, ctx.opponent].forEach((owner) => {
                ctx.stField(owner).forEach((slot, index) => {
                    if (slot && (slot.card.type === 'spell' || slot.isFaceDown)) candidates.push({ owner, index, card: slot.card });
                });
            });
            if (candidates.length === 0) return;
            const destroy = (choice) => {
                const slot = ctx.stField(choice.owner)[choice.index];
                if (!slot || slot.card.uid !== choice.card.uid) return;
                if (slot.isFaceDown) {
                    slot.isFaceDown = false;
                    ctx.log(`🔎 Annulla Carta Magia rivela ${choice.card.name}!`);
                }
                if (choice.card.type !== 'spell') {
                    ctx.log(`✨ Annulla Carta Magia non ha effetto: ${choice.card.name} non è una Magia.`);
                    return;
                }
                ctx.stField(choice.owner)[choice.index] = null;
                ctx.graveyard(choice.owner).push(choice.card);
                ctx.log(`✨ Annulla Carta Magia distrugge ${choice.card.name}!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                // Euristica bot: preferisce un bersaglio SICURAMENTE una
                // Magia (già scoperta) se ce n'è una, invece di rischiare
                // alla cieca su una carta Set.
                const faceUpSpell = candidates.find((c) => c.card.type === 'spell' && !ctx.stField(c.owner)[c.index].isFaceDown);
                destroy(faceUpSpell || candidates[0]);
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates.map((c) => c.card),
                titolo: '✨ Annulla Carta Magia',
                testo: 'Scegli 1 Magia scoperta, o 1 carta Set, da colpire.'
            }, (card) => {
                if (card === null) return;
                const choice = candidates.find((c) => c.card.uid === card.uid);
                if (choice) destroy(choice);
            });
        }
    });

    // ================================================================
    // 200 — Dado Dimensionale / Dimension Dice (Magia Normale)
    // Se controlli una carta con un effetto che richiede un lancio di
    // dado: sacrifica 1 mostro; Special Summon dalla mano o dal Deck 1
    // MOSTRO con un effetto che richiede un lancio di dado. Nuova
    // tassonomia minima def.hasDiceRollEffect (opt-in per-carta), taggata
    // qui sopra sulle 4 Magie/Trappole già registrate che tirano un dado
    // (Ragno della Roulette id 425, Dado di Evocazione id 460, Dado
    // Teschio id 445, Dado Aggraziato id 273) e su Dicelops (id 863,
    // aggiunta ora — nessun MOSTRO con un vero effetto a dado esisteva
    // ancora in questo database, verificato via YGOPRODeck/Yugipedia:
    // senza un bersaglio Mostro valido, il pagamento di questa carta
    // sarebbe stato altrimenti sempre inutilizzabile).
    // ================================================================
    CardEffects.register(200, {
        hasDiceRollEffect: true,
        canActivate(ctx) {
            const hasQualifyingCard = ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && DuelEngine.getDefinition(s.card.id)?.hasDiceRollEffect)
                || ctx.stField(ctx.owner).some((s) => s && !s.isFaceDown && DuelEngine.getDefinition(s.card.id)?.hasDiceRollEffect);
            if (!hasQualifyingCard) return false;
            if (!ctx.field(ctx.owner).some((s) => s && !s.isFaceDown)) return false;
            const hand = ctx.hand(ctx.owner);
            const deck = Tavolo.mazzo(ctx.owner);
            const inHand = hand.some((c) => c.type === 'monster' && DuelEngine.getDefinition(c.id)?.hasDiceRollEffect);
            const inDeck = Array.isArray(deck) && deck.some((c) => c.type === 'monster' && DuelEngine.getDefinition(c.id)?.hasDiceRollEffect);
            return inHand || inDeck;
        },
        activate(ctx) {
            const field = ctx.field(ctx.owner);
            const sacIndex = field.findIndex((s) => s && !s.isFaceDown);
            if (sacIndex === -1) return;
            ctx.graveyard(ctx.owner).push(field[sacIndex].card);
            field[sacIndex] = null;

            const hand = ctx.hand(ctx.owner);
            const handIndex = hand.findIndex((c) => c.type === 'monster' && DuelEngine.getDefinition(c.id)?.hasDiceRollEffect);
            const finishSummon = (card, fromZone) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) {
                    ctx.graveyard(ctx.owner).push(card);
                    return;
                }
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', fromZone);
                ctx.log(`🎲 Dado Dimensionale Special Summona ${card.name}!`);
            };
            if (handIndex !== -1) {
                const [card] = hand.splice(handIndex, 1);
                finishSummon(card, 'hand');
                return;
            }
            // Vera scelta tra tutti i mostri "a dado" nel Deck (non solo
            // il primo trovato) tramite searchDeckWithChoice.
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && DuelEngine.getDefinition(c.id)?.hasDiceRollEffect, {
                title: '🎲 Dado Dimensionale',
                text: 'Scegli quale mostro "a dado" Special Summonare dal Deck.'
            }, (card) => finishSummon(card, 'deck'));
        }
    });

    // ================================================================
    // 863 — Dicelops
    // Una volta per turno (Ignition, gestito già in automatico dal
    // motore via gameState.usedIgnitionThisTurn): lancia un dado a sei
    // facce. 1: guarda la mano dell'avversario e scarta 1 carta A CASO
    // dalla sua mano. 2-5: scarta 1 carta A CASO dalla propria mano. 6:
    // scarta l'intera propria mano. Testo reale (Yugipedia): lo scarto
    // nei risultati 1/2-5 è casuale, non una scelta — CORREZIONE DI
    // FEDELTÀ: usava discardChosenFromHand(..., 0), che scartava sempre e
    // solo la PRIMA carta in mano (non casuale), un bug distinto scoperto
    // mentre si correggeva il bug reale segnalato dall'utente su altre
    // carte ("effetto scarta una carta non fa scegliere" — qui invece va
    // nella direzione opposta: deve essere IMPREVEDIBILE, non scelto).
    // ================================================================
    CardEffects.register(863, {
        hasDiceRollEffect: true,
        activate(ctx) {
            const roll = 1 + Math.floor(ctx.random() * 6);
            if (window.FX) FX.playDiceRoll(roll);
            ctx.log(`🎲 Dadociclope lancia il dado: ${roll}!`);
            if (roll === 1) {
                if (ctx.hand(ctx.opponent).length > 0) {
                    const discarded = ctx.discardRandomFromHand(ctx.opponent);
                    if (discarded) ctx.log(`🎲 Scarta ${discarded.name} dalla mano dell'avversario!`);
                }
            } else if (roll === 6) {
                const count = ctx.hand(ctx.owner).length;
                while (ctx.hand(ctx.owner).length > 0) ctx.discardChosenFromHand(ctx.owner, 0);
                ctx.log(`🎲 Scarta l'intera mano (${count} cart${count === 1 ? 'a' : 'e'})!`);
            } else {
                if (ctx.hand(ctx.owner).length > 0) {
                    const discarded = ctx.discardRandomFromHand(ctx.owner);
                    if (discarded) ctx.log(`🎲 Scarta ${discarded.name}!`);
                }
            }
        }
    });

    // ================================================================
    // 201 — Buco Dimensionale / Dimension Hole (Magia Normale)
    // Scegli 1 mostro sul tuo Terreno; bandiscilo fino alla tua prossima
    // Standby Phase.
    // Anche le proprie carte coperte entrano nella scelta: sono TUE, non
    // c'è nessuna informazione nascosta da rivelare mostrandole.
    // ================================================================
    // CORREZIONE di fedeltà: aggiunta la clausola mancante "finché il
    // mostro resta bandito, quella Zona Mostro non può essere usata" —
    // nuovo 4° parametro lockZoneIndex di ctx.banishTemporarily
    // (duel-engine.js), consultato da ACTIONS.findEmptyMonsterSlot (per
    // la selezione automatica) E da attemptMonsterSummon (actions.js, per
    // il posizionamento manuale via click/drag&drop — bug reale corretto:
    // bypassava il blocco cliccando direttamente sullo slot vuoto).
    CardEffects.register(201, {
        // Bandire un proprio mostro fino alla prossima Standby serve solo a salvarlo da una minaccia
        // precisa: attivata di propria iniziativa il bot si privava del mostro per niente.
        aiCanActivate() { return false; },
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot);
        },
        activate(ctx) {
            const candidati = collectFieldTargets(ctx, { zone: 'monster', owner: 'self', includiCoperte: true });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🕳️ Buco Dimensionale',
                text: 'Scegli quale tuo mostro bandire fino alla tua prossima Standby Phase.',
                // Testo reale: "scegli come bersaglio 1 mostro che controlli".
                dichiara: true
            }, (scelto) => {
                const field = ctx.field(scelto.owner);
                const banished = scelto.card;
                if (blockBanishFromField(ctx, banished)) return;
                if (window.FX && typeof FX.playDimensionHole === 'function') FX.playDimensionHole(scelto.owner, scelto.index, banished);
                field[scelto.index] = null;
                ctx.banishTemporarily(scelto.owner, banished, 'standby', scelto.index);
                ctx.log(`🕳️ Buco Dimensionale bandisce ${banished.name} fino alla tua prossima Standby Phase! Quella Zona Mostro non può essere usata finché non torna.`);
            });
        }
    });

    // ================================================================
    // 202 — Bambola della Rovina / Doll of Demise
    // Durante la tua prossima Standby Phase dopo che questa carta è stata
    // mandata dal campo al Cimitero dall'effetto di una Magia Continua:
    // Special Summonala dal Cimitero. ctx.destroyedByCard (nuovo,
    // duel-engine.js/ACTIONS.destroyMonster, stesso trucco del `this`-
    // binding di destroyedByOwner) è la carta sorgente che ha causato
    // QUESTA distruzione — controlliamo che sia una Magia Continua
    // scoperta (subtype 'continuous'), stesso spirito/stesso schema di
    // Signore dei Vampiri (id 658) ma con una condizione più specifica
    // sulla FONTE invece che sul proprietario.
    // ================================================================
    CardEffects.register(202, {
        onDestroy(ctx) {
            if (!ctx.destroyedByCard || ctx.destroyedByCard.type !== 'spell' || ctx.destroyedByCard.subtype !== 'continuous') return;
            const grave = ctx.graveyard(ctx.owner);
            const index = grave.findIndex((c) => c.uid === ctx.card.uid);
            if (index === -1) return;
            const [card] = grave.splice(index, 1);
            ctx.reviveFromGraveyardWithCountdown(ctx.owner, card, 1);
            ctx.log(`💀 ${card.name} tornerà in campo alla tua prossima Standby Phase!`);
        }
    });

    // ================================================================
    // 206 — Vaso Cattura-Drago / Dragon Capture Jar (effetto CONTINUO
    // della Trappola, non un'attivazione manuale — come Jinzo, id 17)
    // Finché scoperta sul Terreno: tutti i mostri Tipo Drago scoperti, di
    // entrambi i giocatori, vengono tenuti in Posizione di Difesa.
    // ================================================================
    CardEffects.register(206, {
        continuous: true,
        // Senza `activate` una Trappola Continua che agisce solo con `static` non si poteva mai girare: restava Set
        // per sempre (ne' la persona ne' l'IA ne avevano un modo). Ora si attiva e resta in campo.
        activate(ctx) { ctx.log('🐉 Cattura-Draghi si attiva: i Draghi scoperti vanno in Difesa!'); },
        // Colpisce i Draghi di ENTRAMBI: all'IA conviene solo se il nemico ne ha e lei no.
        aiCanActivate(ctx) {
            const draghi = (owner) => ctx.field(owner).filter((s) => s && !s.isFaceDown && s.card.race === 'Drago').length;
            return draghi(ctx.opponent) > 0 && draghi(ctx.owner) === 0;
        },
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, i) => {
                    if (slot && !slot.isFaceDown && slot.card.race === 'Drago' && slot.position !== 'defense') {
                        ctx.changePosition(owner, i, 'defense');
                        slot.canChangePosition = false;
                    }
                });
            });
        }
    });

    // ================================================================
    // 210 — Cacciatore di Draghi / Dragon Seeker (effetto all'Evocazione)
    // Quando questa carta viene Evocata: distrugge 1 mostro Tipo Drago
    // scoperto sul Terreno (di preferenza dell'avversario).
    // SEMPLIFICAZIONE: l'effetto reale scatta solo su Evocazione Normale o
    // Flip Summon — qui, per come è collegato onSummon() in
    // js/engine/duel-engine.js, scatta anche su Special Summon (nessuna carta di
    // questo set Special Summona Cacciatore di Draghi, quindi la
    // differenza non si nota in pratica).
    // ================================================================
    CardEffects.register(210, {
        onSummon(ctx) {
            let targetOwner = null;
            let targetIndex = -1;
            [ctx.opponent, ctx.owner].forEach((owner) => {
                if (targetIndex !== -1) return;
                ctx.field(owner).forEach((slot, index) => {
                    if (targetIndex !== -1) return;
                    if (owner === ctx.owner && index === ctx.summonedSlotIndex) return; // mai se stesso
                    if (slot && !slot.isFaceDown && slot.card.race === 'Drago') {
                        targetOwner = owner;
                        targetIndex = index;
                    }
                });
            });
            if (targetIndex === -1) return;
            const decl = ctx.declareTarget(targetOwner, targetIndex, { totalTargetCount: 1 });
            if (!decl.allowed) return;
            const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
            if (!finalSlot) return;
            const destroyedName = finalSlot.card.name;
            ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
            ctx.log(`🐉 Cercatore di Draghi, evocato, distrugge ${destroyedName}!`);
        }
    });

    // ================================================================
    // 219 — Tornado di Polvere / Dust Tornado (Trappola Normale)
    // Distrugge 1 Magia/Trappola controllata dall'avversario (scoperta o
    // Set). CORREZIONE di fedeltà: aggiunta la seconda clausola mancante
    // ("poi puoi Set 1 Magia/Trappola dalla mano") — sceglie da sola la
    // PRIMA Magia/Trappola idonea in mano (stesso stile "auto-scelta"
    // già usato ovunque in questo file al posto di un'interfaccia di
    // selezione dedicata, es. Trapano Ingranaggio Antico id 842), Set
    // nella prima casella Magia/Trappola libera se ce n'è una.
    // ================================================================
    CardEffects.register(219, {
        canActivate(ctx) {
            return ctx.stField(ctx.opponent).some((slot) => slot !== null);
        },
        activate(ctx) {
            // "Scegli come bersaglio 1 Magia/Trappola controllata dal tuo
            // avversario": prima prendeva sempre la prima casella
            // occupata. Le coperte sono INCLUSE (il testo non dice
            // "scoperta") ed è corretto: il picker mostra comunque la
            // carta, ma è il proprio avversario a subirla — l'unica
            // informazione che il giocatore ricava è quale casella
            // colpire, che è esattamente la scelta che il testo gli dà.
            const candidati = collectFieldTargets(ctx, { zone: 'st', owner: 'opponent', includiCoperte: true });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🌪️ Tornado di Polvere',
                text: 'Scegli quale Magia/Trappola dell\'avversario distruggere.'
            }, (scelto) => {
                const card = scelto.card;
                const resolve = () => {
                    // Passa dal distruttore condiviso (trigger, protezioni,
                    // Cimitero), ma senza sommare la frattura generica al
                    // vortice dedicato appena concluso.
                    ctx.destroySpellTrap(scelto.owner, scelto.index, null, { skipVisual: true });
                    ctx.log(`🌪️ Tornado di Polvere distrugge ${card.name}!`);
                    // La seconda metà ("poi puoi Set 1 Magia/Trappola dalla tua
                    // mano") vive DENTRO la callback: è asincrona come la
                    // scelta, e farla fuori la eseguirebbe prima che il
                    // giocatore abbia scelto.
                    const hand = ctx.hand(ctx.owner);
                    const freeSlot = ctx.stField(ctx.owner).findIndex((s) => s === null);
                    if (freeSlot === -1) return;
                    chooseCardFromHand(ctx, {
                        filter: (c) => c.type === 'spell' || c.type === 'trap',
                        title: '🌪️ Set una carta',
                        text: 'Scegli quale Magia/Trappola mettere Set dalla tua mano.'
                    }, (setCard, handIndex) => {
                        hand.splice(handIndex, 1);
                        ctx.stField(ctx.owner)[freeSlot] = { card: setCard, isFaceDown: true, setOnTurn: gameState.turn };
                        ctx.log(`🌪️ Tornado di Polvere mette Set ${setCard.name} dalla mano!`);
                    });
                };
                if (window.FX && typeof FX.playDustTornado === 'function') {
                    FX.playDustTornado(scelto.owner, scelto.index, resolve);
                } else resolve();
            });
        }
    });

    // ================================================================
    // 228 — Aerosol Sterminatore / Eradicating Aerosol (Magia Normale)
    // Distrugge tutti i mostri Tipo Insetto scoperti sul Terreno, di
    // entrambi i giocatori. Stesso schema di Soffio di Luce (id 132), solo
    // con Tipo Insetto al posto di Tipo Roccia.
    // ================================================================
    CardEffects.register(228, {
        // Distrugge gli Insetti di ENTRAMBI i lati: il bot la attiva solo se all'avversario ne toglie nettamente di piu'.
        aiCanActivate(ctx) {
            const somma = (owner) => ctx.field(owner).reduce((s, slot) => (slot && !slot.isFaceDown && slot.card.race === 'Insetto' ? s + DuelEngine.getEffectiveAtk(slot.card) : s), 0);
            return somma(ctx.opponent) - somma(ctx.owner) >= 500;
        },
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((slot) => slot && !slot.isFaceDown && slot.card.race === 'Insetto'));
        },
        activate(ctx) {
            let count = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => {
                    if (slot && !slot.isFaceDown && slot.card.race === 'Insetto') {
                        ctx.destroyMonster(owner, index);
                        count++;
                    }
                });
            });
            ctx.log(`💥 Spray distrugge ${count} most${count === 1 ? 'ro' : 'ri'} Tipo Insetto!`);
        }
    });

    // ================================================================
    // 229 — Bandisci il Malvagio / Exile of the Wicked (Magia Normale)
    // Distrugge tutti i mostri Tipo Demone scoperti sul Terreno, di
    // entrambi i giocatori. Stesso schema di Soffio di Luce (id 132), solo
    // con Tipo Demone al posto di Tipo Roccia.
    // ================================================================
    CardEffects.register(229, {
        // Distrugge i Demoni di ENTRAMBI i lati: il bot la attiva solo se ne toglie di piu' (almeno 500 ATK in
        // piu') all'avversario che a se stesso.
        aiCanActivate(ctx) {
            const somma = (owner) => ctx.field(owner).reduce((s, slot) => (slot && !slot.isFaceDown && slot.card.race === 'Demone' ? s + DuelEngine.getEffectiveAtk(slot.card) : s), 0);
            return somma(ctx.opponent) - somma(ctx.owner) >= 500;
        },
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((slot) => slot && !slot.isFaceDown && slot.card.race === 'Demone'));
        },
        activate(ctx) {
            let count = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => {
                    if (slot && !slot.isFaceDown && slot.card.race === 'Demone') {
                        ctx.destroyMonster(owner, index);
                        count++;
                    }
                });
            });
            ctx.log(`💥 Esilio degli Spiriti distrugge ${count} most${count === 1 ? 'ro' : 'ri'} Tipo Demone!`);
        }
    });

    // ================================================================
    // 240 — Ordini d'Attacco Finali / Final Attack Orders (effetto
    // CONTINUO della Trappola, non un'attivazione manuale — stesso schema
    // di Vaso Cattura-Drago, id 206, ma su TUTTI i mostri scoperti di
    // entrambi i giocatori invece che solo sui Tipo Drago).
    // ================================================================
    CardEffects.register(240, {
        continuous: true,
        activate(ctx) { ctx.log('⚔️ Ordini di Attacco Finale si attiva: tutti i mostri scoperti vanno in Attacco!'); },
        // Costringe in Attacco i mostri di ENTRAMBI: conviene all'IA se ha piu' attacco totale e il nemico si difende.
        aiCanActivate(ctx) {
            const atk = (owner) => ctx.field(owner).reduce((s, slot) => (slot && !slot.isFaceDown ? s + DuelEngine.getEffectiveAtk(slot.card) : s), 0);
            const nemicoInDifesa = ctx.field(ctx.opponent).some((slot) => slot && !slot.isFaceDown && slot.position === 'defense');
            return nemicoInDifesa && atk(ctx.owner) >= atk(ctx.opponent) + 1000;
        },
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, i) => {
                    if (slot && !slot.isFaceDown && slot.position !== 'attack') {
                        ctx.changePosition(owner, i, 'attack');
                        slot.canChangePosition = false;
                    }
                });
            });
        }
    });

    // ================================================================
    // 243 — Faglia / Fissure (Magia Normale)
    // Distrugge il mostro scoperto con l'ATK più basso controllato
    // dall'avversario (a parità di ATK, sceglie il primo trovato).
    // ================================================================
    CardEffects.register(243, {
        declaredTargeting: { count: 1, cardType: 'monster' },
        canActivate(ctx) {
            return ctx.field(ctx.opponent).some((slot) => slot && !slot.isFaceDown);
        },
        activate(ctx) {
            const field = ctx.field(ctx.opponent);
            let targetIndex = -1;
            let lowestAtk = Infinity;
            field.forEach((slot, index) => {
                if (slot && !slot.isFaceDown && slot.card.attack < lowestAtk) {
                    lowestAtk = slot.card.attack;
                    targetIndex = index;
                }
            });
            if (targetIndex === -1) return;
            ctx.declareTargetWaiting(ctx.opponent, targetIndex, { totalTargetCount: 1 }, (decl) => {
                if (!decl.allowed) return;
                const target = ctx.field(decl.targetOwner)[decl.targetIndex];
                const name = target ? target.card.name : field[targetIndex].card.name;
                ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                ctx.log(`⚡ Faglia distrugge ${name} (ATK più basso)!`);
            });
        }
    });

    // ================================================================
    // 251 — Sepoltura Sciocca / Foolish Burial (Magia Normale)
    // Manda 1 mostro dal proprio Deck al Cimitero.
    // SEMPLIFICAZIONE: funziona solo quando il giocatore ha un Deck reale
    // in gameState.playerDeck/botDeck (costruito da SaveManager o da un
    // mazzo a tema avversario — vedi drawCardsToHand in game-flow.js). Nel
    // Duello Demo generico, se il bot non ha un mazzo a tema, il suo Deck
    // resta un pool casuale senza array reale: in quel caso l'effetto non
    // è attivabile per lui (canActivate ritorna false).
    // ================================================================
    CardEffects.register(251, {
        canActivate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner, ctx.gameState);
            return Array.isArray(deck) && deck.some((c) => c.type === 'monster');
        },
        activate(ctx) {
            searchDeckWithChoice(ctx, (c) => c.type === 'monster', {
                title: '⚰️ Sepoltura Sciocca',
                text: 'Scegli quale mostro mandare al Cimitero dal Deck.',
                pickForBot(candidates) {
                    const identita = ctx.gameState.personaggioPerPosto
                        && ctx.gameState.personaggioPerPosto[ctx.owner];
                    if (identita !== 'gozaburo' || typeof EXODIA_PIECE_IDS === 'undefined') {
                        return candidates[0];
                    }
                    const giaNelCimitero = new Set(ctx.graveyard(ctx.owner).map((card) => card.id));
                    // Gozaburo non cerca la vittoria in mano di Exodia: nel
                    // suo duello anime deve seppellirne i cinque pezzi per
                    // attivare Patto con Exodia ed evocare Exodia Necross.
                    return candidates.find((card) => EXODIA_PIECE_IDS.includes(card.id)
                        && !giaNelCimitero.has(card.id)) || candidates[0];
                }
            }, (card) => {
                ctx.graveyard(ctx.owner).push(card);
                ctx.log(`⚰️ Sepoltura Sciocca manda ${card.name} al Cimitero!`);
            });
        }
    });

    // ================================================================
    // 248 — Kamakiri Volante #1 / Flying Kamakiri #1 (onDestroy)
    // Quando questa carta viene distrutta in battaglia e mandata al
    // Cimitero: puoi Special Summon dal Deck, scoperto in Posizione di
    // Attacco, 1 mostro VENTO con 1500 o meno ATK. Vera scelta tra tutti
    // i candidati tramite searchDeckWithChoice (vedi il suo commento) —
    // prima prendeva il primo trovato nel Deck mescolato, non una scelta
    // libera. SEMPLIFICAZIONE residua: funziona solo con un Deck reale
    // in gameState.playerDeck/botDeck (non nel Duello Demo).
    // ================================================================
    CardEffects.register(248, {
        onDestroy(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.attribute === 'VENTO' && c.attack <= 1500, {
                title: '🦗 Kamakiri Volante #1',
                text: 'Scegli quale mostro VENTO (1500 ATK o meno) Special Summonare dal Deck.'
            }, (card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
                ctx.log(`🦗 Kamakiri Volante #1 Special Summona ${card.name} dal Deck!`);
            });
        }
    });

    // ================================================================
    // 257 — Golem Meccanico la Fortezza Mobile / Gear Golem the Moving
    // Fortress (effetto Ignition)
    // Puoi pagare 800 Life Points; questa carta può attaccare direttamente
    // il tuo avversario in questo turno, anche se controlla dei mostri —
    // vedi endAttackDrag() in game-flow.js, che consulta
    // gameState.directAttackAllowedFor.
    // SEMPLIFICAZIONE: attivabile in tutto il proprio Main Phase (1 o 2),
    // non solo nel Main Phase 1 come da testo reale.
    // ================================================================
    CardEffects.register(257, {
        canActivate(ctx) {
            return Tavolo.lp(ctx.owner) > 800;
        },
        activate(ctx) {
            ctx.dealDamage(ctx.owner, 800);
            gameState.directAttackAllowedFor = gameState.directAttackAllowedFor || {};
            gameState.directAttackAllowedFor[ctx.card.uid] = true;
            ctx.log('⚙️ Golem-Ingranaggio, la Fortezza Movente paga 800 Life Points: può attaccare direttamente questo turno!');
        }
    });

    // ================================================================
    // 259 — Germe Gigante / Giant Germ (onDestroy)
    // Quando questa carta viene distrutta in battaglia e mandata al
    // Cimitero: infliggi 500 danni al tuo avversario. CORREZIONE di
    // fedeltà: aggiunta la seconda clausola mancante ("poi puoi Special
    // Summon dal Deck un numero qualsiasi di altri 'Germe Gigante'
    // scoperti in Posizione di Attacco") — un semplice ciclo su tutte le
    // copie trovate nel Deck, una per casella Mostro libera, nessuna
    // nuova infrastruttura di "ricerca multipla" necessaria.
    // ================================================================
    CardEffects.register(259, {
        onDestroy(ctx) {
            ctx.dealDamage(ctx.opponent, 500);
            ctx.log('🦠 Germe Gigante, distrutto in battaglia, infligge 500 danni!');
            const deck = Tavolo.mazzo(ctx.owner);
            if (!Array.isArray(deck)) return;
            let summoned = 0;
            let deckIndex;
            while (ctx.findEmptyMonsterSlot(ctx.owner) !== -1 && (deckIndex = deck.findIndex((c) => c.id === 259)) !== -1) {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                const [card] = deck.splice(deckIndex, 1);
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
                summoned++;
            }
            if (summoned > 0) {
                gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
                ctx.log(`🦠 Germe Gigante Special Summona ${summoned} altr${summoned === 1 ? 'o' : 'i'} "Germe Gigante" dal Deck!`);
            }
        }
    });

    // ================================================================
    // 262 — Turbine Gigante / Giant Trunade (Magia Normale)
    // Fa tornare in mano tutte le Magie/Trappole sul Terreno, di entrambi
    // i giocatori. L'UNICA carta di questo dataset che rimanda Magie/
    // Trappole in mano: chiama def.onReturnedToHandSelf(ctx) per ciascuna
    // carta bersagliata, stesso hook/schema già usato da
    // ACTIONS.returnMonsterToHand (duel-engine.js) per i mostri — così
    // Amplificatore (id 92) e Festa Isterica (id 790), entrambe "se questa
    // carta lascia il Terreno...", reagiscono anche a questo percorso,
    // non solo a distruzione/bando.
    // ================================================================
    CardEffects.register(262, {
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.stField(owner).some((slot) => slot !== null));
        },
        activate(ctx) {
            let count = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.stField(owner).forEach((slot, index) => {
                    if (slot) {
                        const bouncedCard = slot.card;
                        EventiDuello.emetti('transizione-carta', {
                            carta: bouncedCard,
                            da: { kind: 'field', owner: owner, index: index, type: 'st' },
                            a: { kind: 'hand', owner: owner },
                            variante: 'hand'
                        });
                        ctx.hand(owner).push(bouncedCard);
                        ctx.stField(owner)[index] = null;
                        count++;
                        const selfDef = DuelEngine.getDefinition(bouncedCard.id);
                        if (selfDef && typeof selfDef.onReturnedToHandSelf === 'function') {
                            selfDef.onReturnedToHandSelf(DuelEngine.makeContext(owner, { card: bouncedCard, index: index }));
                        }
                    }
                });
            });
            ctx.log(`🌪️ Ritorno Totale fa tornare in mano ${count} cart${count === 1 ? 'a' : 'e'} Magia/Trappola!`);
        }
    });

    // ================================================================
    // 267 — Gilford il Fulmine / Gilford the Lightning (onSummon)
    // Se Evocata Normalmente con 3 Tributi (getTributesRequired,
    // cards-db.js, eccezione per id 267 — testo letterale della carta,
    // non i 2 Tributi standard per un Livello 8): distruggi tutti i
    // mostri controllati dal tuo avversario.
    // ================================================================
    CardEffects.register(267, {
        onSummon(ctx) {
            ctx.destroyAllMonsters(ctx.opponent);
            ctx.log('⚡ Gilford il Fulmine distrugge tutti i mostri del tuo avversario!');
        },
        onSpecialSummon() {} // il vero effetto scatta solo su Evocazione Normale
    });

    // ================================================================
    // 263 — Dono dell'Elfa Mistica / Gift of The Mystical Elf (Trappola
    // Normale)
    // Guadagna 300 Life Points per ogni mostro sul Terreno, di entrambi i
    // giocatori.
    // ================================================================
    CardEffects.register(263, {
        activate(ctx) {
            const count = ctx.field('player').filter((s) => s).length + ctx.field('bot').filter((s) => s).length;
            const gain = count * 300;
            ctx.dealDamage(ctx.owner, -gain);
            ctx.log(`👼 Dono dell'Elfo Mistico cura ${gain} Life Points (${count} mostri sul Terreno)!`);
        }
    });

    // ================================================================
    // 266 — Gilasaurus (Special Summon dalla mano)
    // Puoi Special Summon questa carta dalla tua mano IN POSIZIONE DI
    // ATTACCO (testo reale, a differenza della maggior parte delle altre
    // carte di questo motore con lo stesso meccanismo, che non fissano
    // affatto la Posizione — vedi specialSummonFixedPosition qui sotto).
    // Se viene Evocata così: il tuo avversario può Special Summon 1
    // mostro dal proprio Cimitero (quella seconda Summon, invece, resta
    // una scelta libera per l'avversario — nessun vincolo di Posizione
    // sulla SUA).
    // SEMPLIFICAZIONE: il "può" dell'avversario diventa automatico se ha
    // un mostro nel Cimitero (stesso spirito di altre carte "puoi" già
    // presenti in questo file).
    // ================================================================
    CardEffects.register(266, {
        canSpecialSummonFromHand() { return true; },
        specialSummonFixedPosition: 'attack',
        onSpecialSummon(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.opponent) === -1) return;
            // La scelta spetta all'AVVERSARIO di chi controlla Gilasaurus
            // (sceglie tra i mostri nel proprio Cimitero) — non a
            // ctx.owner: costruisce un ctx "dal punto di vista" di
            // ctx.opponent solo per decidere se aprire un vero picker
            // (giocatore umano) o l'auto-pick (bot), esattamente come
            // searchGraveyardWithChoice farebbe per il proprietario
            // normale di un effetto.
            const opponentCtx = DuelEngine.makeContext(ctx.opponent, {});
            searchGraveyardWithChoice(opponentCtx, ctx.opponent, (c) => c.type === 'monster', {
                title: '🦖 Gilasaurus',
                text: 'Scegli quale mostro Special Summonare dal tuo Cimitero.'
            }, (card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.opponent);
                if (slotIndex === -1) return;
                ctx.specialSummon(ctx.opponent, card, slotIndex, 'attack', 'graveyard');
                ctx.log(`🦖 Gilasaurus permette all'avversario di Special Summonare ${card.name} dal Cimitero!`);
            });
        }
    });

    // ================================================================
    // 272 — Carità Aggraziata / Graceful Charity (Magia Normale)
    // Pesca 3 carte, poi scarta 2 carte.
    // SEMPLIFICAZIONE: l'effetto reale lascia scegliere al giocatore quali
    // 2 carte scartare — qui, non essendo presente un'interfaccia di
    // selezione dalla mano, si scartano automaticamente le ultime 2 carte
    // in mano dopo la pescata (le 2 appena pescate per ultime).
    // ================================================================
    CardEffects.register(272, {
        activate(ctx) {
            ctx.drawCards(ctx.owner, 3);
            const hand = ctx.hand(ctx.owner);
            let discarded = 0;
            for (let i = 0; i < 2 && hand.length > 0; i++) {
                const card = hand.pop();
                ctx.graveyard(ctx.owner).push(card);
                discarded++;
            }
            ctx.log(`💖 Carità Graziosa pesca 3 carte e scarta ${discarded}!`);
        }
    });

    // ================================================================
    // 282 — Guardiano Falce del Terrore (Special Summon dalla mano)
    // Non può essere Evocata Normalmente/Set. Deve essere Special
    // Summonata tramite il proprio effetto: se "Guardiano Eatos" (id 523)
    // viene distrutta e mandata al tuo Cimitero, puoi Special Summonare
    // questa carta dalla mano.
    // SEMPLIFICAZIONE: la condizione diventa "hai Guardian Eatos nel tuo
    // Cimitero" (senza richiedere che ci sia arrivata PROPRIO nell'ultimo
    // istante per distruzione), stesso spirito delle altre approssimazioni
    // di questo file. Manca "non puoi Evocare Normalmente/Special
    // Summonare altri mostri finché questa carta è in campo".
    // ================================================================
    // CORREZIONE di fedeltà: entrambe le dipendenze della nota precedente
    // sono in realtà già presenti nel database ("Guardiano Eatos" id 523,
    // "Falce del Mietitore" id 411) — nota obsoleta.
    // Aggiunto l'effetto mancante "se Special Summonata: puoi equipaggiare
    // 1 Falce del Mietitore - Falce del Terrore dal Deck a questa carta"
    // (stesso schema di attachEquip/equippedTarget, id 411).
    // Vedi missingEffectNote su id 282 in cards.json: manca "non puoi
    // Evocare Normalmente/Special Summonare altri mostri finché questa
    // carta è in campo" — nessun aggancio generico "blocca ogni altra
    // Evocazione" esiste in questo motore. La seconda ("se mandata dal
    // Terreno al Cimitero:
    // scarta 1 carta, e se lo fai, Special Summonala dal Cimitero") è
    // implementabile: "dal Terreno al Cimitero" copre esattamente
    // distruzione (onDestroy) e Sacrificio per Evocazione Tributo
    // (onSacrificedForTribute, entrambi già esistenti come agganci
    // generici) — non serve il generico "lascia il campo in QUALUNQUE
    // modo" (bando/ritorno in mano non vanno al Cimitero).
    function guardianFalceReviveFromGraveyard(ctx) {
        const grave = ctx.graveyard(ctx.owner);
        const index = grave.findIndex((c) => c.uid === ctx.card.uid);
        if (index === -1) return;
        const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
        if (slotIndex === -1) return;
        const discarded = ctx.discardRandomFromHand(ctx.owner);
        if (!discarded) return;
        const [card] = grave.splice(index, 1);
        ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'graveyard');
        ctx.log(`🔪 Falce del Terrore Guardiana scarta ${discarded.name}: torna in campo dal Cimitero!`);
    }
    CardEffects.register(282, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.id === 523);
        },
        onSpecialSummon(ctx) {
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            if (!Array.isArray(deck)) return;
            const dIndex = deck.findIndex((c) => c.id === 411);
            if (dIndex === -1) return;
            const freeStSlot = ctx.stField(ctx.owner).findIndex((s) => s === null);
            if (freeStSlot === -1) return;
            const ownIndex = ctx.field(ctx.owner).findIndex((s) => s && s.card.uid === ctx.card.uid);
            if (ownIndex === -1) return;
            const [scytheCard] = deck.splice(dIndex, 1);
            gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
            scytheCard.equippedToOwner = ctx.owner;
            scytheCard.equippedToIndex = ownIndex;
            scytheCard.equippedToUid = ctx.card.uid;
            ctx.stField(ctx.owner)[freeStSlot] = { card: scytheCard, isFaceDown: false, setOnTurn: gameState.turn };
            ctx.log(`🔪 Falce del Terrore Guardiana equipaggia ${scytheCard.name} dal Deck!`);
        },
        onDestroy: guardianFalceReviveFromGraveyard,
        onSacrificedForTribute: guardianFalceReviveFromGraveyard
    });

    // ================================================================
    // 291 — Piumino delle Arpie / Harpie's Feather Duster (Magia Normale)
    // Distrugge tutte le Magie/Trappole controllate dall'avversario.
    // ================================================================
    CardEffects.register(291, {
        canActivate(ctx) {
            return ctx.stField(ctx.opponent).some((slot) => slot !== null);
        },
        activate(ctx) {
            const resolve = () => {
                let count = 0;
                // batchToken condiviso da tutte le distruzioni di questa STESSA
                // attivazione: Trappola Fasulla protegge ogni Trappola del lotto.
                const batchToken = {};
                ctx.stField(ctx.opponent).forEach((slot, index) => {
                    if (slot) {
                        // Senza skipVisual: il vento di piume apre la scena, ma le
                        // carte colpite devono anche sbriciolarsi una per una
                        // (frattura olografica generica), altrimenti sparivano
                        // di colpo.
                        ctx.destroySpellTrap(ctx.opponent, index, batchToken);
                        count++;
                    }
                });
                ctx.log(`🪶 Spolverino dell'Arpia distrugge ${count} cart${count === 1 ? 'a' : 'e'} Magia/Trappola dell'avversario!`);
            };
            if (window.FX && typeof FX.playHarpiesFeatherDuster === 'function') {
                FX.playHarpiesFeatherDuster(ctx.opponent, resolve);
            } else resolve();
        }
    });

    // ================================================================
    // 292 — Tempesta di Piume delle Arpie / Harpie's Feather Storm
    // (Trappola Normale)
    // Se controlli un mostro Bestia Alata VENTO: fino alla fine di questo
    // turno, annulla tutti gli effetti dei mostri che l'avversario
    // attiva. gameState.monsterEffectsNegatedUntilEndOfTurnFor (nuovo,
    // consultato da DuelEngine.areMonsterEffectsNegatedFor in tutti i
    // punti in cui un effetto Mostro può scattare — Ignition, Flip,
    // auto-effetti di Evocazione/attacco/distruzione/cambio Posizione,
    // Standby/End Phase — azzerato ad ogni cambio turno), stesso schema
    // di gameState.trapsNegatedUntilEndOfTurnFor (Scintilla dell'Estasi
    // Triangolare, id 789) ma per i Mostri.
    // ECCEZIONE dichiarata dall'utente: "attivabile dalla mano se
    // controlli un mostro 'Harpie'" NON viene implementata — le Trappole
    // in questo motore devono sempre essere Set prima di potersi
    // attivare, per regola del progetto (mai attivate direttamente dalla
    // mano), e questa carta è stata esplicitamente accettata come
    // eccezione a quella regola piuttosto che romperla. La terza clausola
    // ("se questa carta viene distrutta da un effetto avversario mentre
    // è Set: recupera 1 Piumino delle Arpie") è implementata: onSTDestroyed
    // (duel-engine.js/destroySpellTrap) scatta per QUALSIASI Magia/
    // Trappola distrutta, scoperta O coperta (ctx.wasFaceDown distingue),
    // non solo per quelle già attivate — nota precedente sbagliata su
    // questo punto, corretta qui.
    // ================================================================
    CardEffects.register(292, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.race === 'Bestia Alata' && slot.card.attribute === 'VENTO');
        },
        activate(ctx) {
            gameState.monsterEffectsNegatedUntilEndOfTurnFor = gameState.monsterEffectsNegatedUntilEndOfTurnFor || {};
            gameState.monsterEffectsNegatedUntilEndOfTurnFor[ctx.opponent] = true;
            ctx.log('🌪️ Tempesta di Piume dell\'Arpia annulla tutti gli effetti Mostro dell\'avversario fino alla fine del turno!');
        },
        onSTDestroyed(ctx) {
            if (!ctx.wasFaceDown || !ctx.destroyedByOwner || ctx.destroyedByOwner === ctx.owner) return;
            const grave = ctx.graveyard(ctx.owner);
            const graveIndex = grave.findIndex((c) => c.id === 291);
            if (graveIndex !== -1 && !ctx.graveyardMoveNegated(ctx.owner)) {
                const [found] = grave.splice(graveIndex, 1);
                ctx.hand(ctx.owner).push(found);
                ctx.log(`🌪️ ${ctx.card.name} distrutta: recuperi ${found.name} dal Cimitero!`);
                return;
            }
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            if (!Array.isArray(deck)) return;
            const deckIndex = deck.findIndex((c) => c.id === 291);
            if (deckIndex === -1) return;
            const [found] = deck.splice(deckIndex, 1);
            gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
            ctx.hand(ctx.owner).push(found);
            ctx.log(`🌪️ ${ctx.card.name} distrutta: recuperi ${found.name} dal Deck!`);
        }
    });

    // ================================================================
    // 293 — Drago da Compagnia delle Arpie / Harpie's Pet Dragon (buff continuo)
    // Guadagna 300 ATK/DEF per ogni "Lady Arpia" (incluso Arpia Cyber id 172 — vedi isHarpieLadySupport) sul Terreno.
    // ================================================================
    CardEffects.register(293, {
        static(ctx) {
            const count = ctx.field(ctx.owner).filter((slot) => slot && !slot.isFaceDown && isHarpieLadySupport(slot.card)).length;
            gameState.atkDefBonus[ctx.card.uid] = { atk: count * 300, def: count * 300 };
        }
    });

    // ================================================================
    // 297 — Hinotama (Magia Normale)
    // Infliggi 500 danni al tuo avversario.
    // ================================================================
    CardEffects.register(297, {
        activate(ctx) {
            ctx.dealDamage(ctx.opponent, 500);
            ctx.log(`🔥 Hinotama infligge 500 danni!`);
        }
    });

    // ================================================================
    // 311 — Soldati Insetto del Cielo (bonus Damage Step)
    // Se questa carta attacca un mostro VENTO: guadagna 1000 ATK, ma solo
    // durante il Damage Step di quella battaglia (non un buff persistente).
    // ================================================================
    CardEffects.register(311, {
        damageStepBonus(ctx) {
            if (ctx.role === 'attacker' && ctx.opponentCard && ctx.opponentCard.attribute === 'VENTO') {
                return { atk: 1000 };
            }
            return null;
        }
    });

    // ================================================================
    // 312 — Trasportatore di Materia Interdimensionale / Interdimensional
    // Matter Transporter (Trappola Normale)
    // Scegli come bersaglio 1 mostro scoperto che controlli; bandiscilo
    // fino alla End Phase.
    // ================================================================
    CardEffects.register(312, {
        // Come Buco Dimensionale: bandire un proprio mostro e' una parata, non una mossa. Il bot non sa
        // riconoscere la minaccia da cui parare, e senza quella si limitava a togliersi un mostro.
        aiCanActivate() { return false; },
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown);
        },
        activate(ctx) {
            // Solo scoperte: qui il testo reale dice "1 mostro SCOPERTO
            // che controlli".
            const candidati = collectFieldTargets(ctx, { zone: 'monster', owner: 'self' });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🌀 Teletrasportatore',
                dichiara: true,
                text: 'Scegli quale tuo mostro bandire fino alla End Phase.'
            }, (scelto) => {
                const banished = scelto.card;
                if (blockBanishFromField(ctx, banished)) return;
                ctx.field(scelto.owner)[scelto.index] = null;
                ctx.banishTemporarily(scelto.owner, banished, 'endphase');
                ctx.log(`🌀 Teletrasportatore bandisce ${banished.name} fino alla End Phase!`);
            });
        }
    });

    // ================================================================
    // 320 — Kaiser Glider (immunità battaglia + onDestroy)
    // Non può essere distrutta in battaglia da un mostro con lo stesso ATK
    // (survivesEqualAtkBattle, controllato nel pareggio dentro
    // resolveBattleDamage in actions.js). Se questa carta viene distrutta
    // e mandata al Cimitero: scegli come bersaglio 1 mostro sul Terreno;
    // fallo tornare in mano.
    // Il testo dice "sul Terreno" senza distinguere lato né Posizione,
    // quindi i candidati sono entrambi i campi, coperte comprese.
    // ================================================================
    CardEffects.register(320, {
        survivesEqualAtkBattle: true,
        onDestroy(ctx) {
            const candidati = collectFieldTargets(ctx, { zone: 'monster', owner: 'both', includiCoperte: true });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🐉 Kaiser Glider',
                text: 'Scegli quale mostro far tornare in mano.'
            }, (scelto) => {
                const decl = ctx.declareTarget(scelto.owner, scelto.index, { totalTargetCount: 1 });
                if (!decl.allowed) return;
                ctx.returnMonsterToHand(decl.targetOwner, decl.targetIndex);
                ctx.log(`🐉 Kaiser Glider, distrutto, fa tornare in mano ${scelto.card.name}!`);
            });
        }
    });

    // ================================================================
    // 322 — Kaitoptera
    // Effetto Ignition: durante il proprio Main Phase, cerca "Polimerizzazione"
    // (id 38) dal Deck alla mano — stesso ctx.searchDeckToHand già usato
    // da id 533. "Se il tuo avversario controlla 2+ mostri scoperti
    // (eccetto VENTO), quei mostri non possono bersagliarla in attacco":
    // gameState.cannotBeAttackTargetUids ora accetta anche una funzione
    // (attackerCard) => bool (estesa in resolveAttack, actions.js), non
    // solo `true` — qui blocca ogni attaccante NON VENTO.
    // "Se bandita: Special Summonala, poi cerca Fusione dal Cimitero" —
    // def.onBanished (duel-engine.js, ACTIONS.banish), aggiunto DOPO che
    // la nota precedente era stata scritta: nota corretta, il trigger ora
    // esiste (usato anche da Amplificatore id 92, Festa Isterica id 790).
    // ================================================================
    CardEffects.register(322, {
        canActivate(ctx) {
            return Array.isArray(Tavolo.mazzo(ctx.owner));
        },
        activate(ctx) {
            ctx.searchDeckToHand(ctx.owner, (c) => c.id === 38, 1);
        },
        static(ctx) {
            const nonWindCount = ctx.field(ctx.opponent).filter((s) => s && !s.isFaceDown && s.card.attribute !== 'VENTO').length;
            if (nonWindCount < 2) return;
            gameState.cannotBeAttackTargetUids = gameState.cannotBeAttackTargetUids || {};
            gameState.cannotBeAttackTargetUids[ctx.card.uid] = (attackerCard) => attackerCard.attribute !== 'VENTO';
        },
        onBanished(ctx) {
            const banishedZone = ctx.banished(ctx.owner);
            const index = banishedZone.findIndex((c) => c.uid === ctx.card.uid);
            if (index === -1) return;
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return; // resta bandita se il Terreno è pieno
            const [card] = banishedZone.splice(index, 1);
            ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'banished');
            ctx.log('🦅 Kaitoptera torna in campo dalla Zona Bandite!');
            const grave = ctx.graveyard(ctx.owner);
            const fusionIndex = grave.findIndex((c) => c.id === 38);
            if (fusionIndex !== -1 && !ctx.graveyardMoveNegated(ctx.owner)) {
                const [fusionCard] = grave.splice(fusionIndex, 1);
                ctx.hand(ctx.owner).push(fusionCard);
                ctx.log('🔍 Kaitoptera recupera Fusione dal Cimitero!');
            }
        }
    });

    // ================================================================
    // 333 — Kunai con Catena / Kunai with Chain (Trappola a doppio effetto)
    // Attiva 1 o entrambi questi effetti (simultaneamente):
    // ●Quando un mostro dell'avversario dichiara un attacco: cambia
    //  l'attaccante in Posizione di Difesa, annullando l'attacco.
    // ●Scegli 1 tuo mostro scoperto; equipaggia questa carta a quel
    //  bersaglio (+500 ATK).
    // La nota precedente la dava per "troppo esotica" perché
    // "contemporaneamente Trappola-risposta e Trappola-che-diventa-Equip"
    // — falso: le due clausole mappano PARI PARI su due meccanismi già
    // esistenti e indipendenti in questo motore. La clausola equip usa
    // isEquip/continuous/findEquipTarget/attachEquip come ogni altro Equip
    // (es. id117 qui sopra). La clausola di negazione usa onAttackDeclare,
    // lo stesso trigger automatico già usato da Armatura Guida d'Attacco
    // (id100) e Santuario Oscuro (id192) — la sua candidatura come
    // risposta (findTriggerCandidates, duel-engine.js) NON controlla mai
    // se la carta è coperta o scoperta, quindi resta valida sia da Set sia
    // da già equipaggiata, coerente con "entrambi simultaneamente".
    // SEMPLIFICAZIONE: nessuna vera scelta "attiva solo 1 dei due" —
    // entrambe le clausole restano sempre disponibili finché la carta
    // esiste da qualche parte sul proprio Terreno, invece di un'unica
    // decisione al momento dell'attivazione.
    // ================================================================
    CardEffects.register(333, {
        continuous: true,
        isEquip: true,
        canActivate(ctx) { return findEquipTarget(ctx) !== -1; },
        activate(ctx) {
            equipToChosenTarget(ctx);
        },
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 500, def: e.def };
        },
        onAttackDeclare(ctx) {
            // "Scegli come bersaglio il mostro attaccante": checkpoint di
            // targeting (un attaccante Drago sotto Signore dei D., per
            // esempio, non si può scegliere).
            ctx.declareTargetWaiting(ctx.attackerOwner, ctx.attackerIndex, { totalTargetCount: 1 }, (decl) => {
                if (!decl.allowed) return;
                ctx.changePosition(decl.targetOwner, decl.targetIndex, 'defense');
                ctx.cancelAttack();
                ctx.log("🗡️ Kunai con Catena costringe il mostro attaccante in Posizione di Difesa, annullando l'attacco!");
            });
        }
    });

    // ================================================================
    // 334 — Kuribandit (onEndPhase)
    // Durante la End Phase, se questa carta è stata Evocata Normalmente in
    // questo turno: puoi sacrificarla; scava le prime 5 carte del tuo
    // Deck, aggiungi 1 Magia/Trappola scavata alla mano (se ce n'è più di
    // una, la prima trovata), poi manda le carte rimanenti al Cimitero.
    // SEMPLIFICAZIONE: funziona solo con un Deck reale in
    // gameState.playerDeck/botDeck (vedi Sepoltura Sciocca, id 251); si
    // sacrifica sempre quando può (il "puoi" reale diventa automatico, non
    // c'è un'interfaccia per rifiutare).
    // ================================================================
    CardEffects.register(334, {
        onEndPhase(ctx) {
            if (ctx.slot.summonedOnTurn !== gameState.turn) return;
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            if (!Array.isArray(deck) || deck.length === 0) return;
            ctx.field(ctx.owner)[ctx.slotIndex] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            // "prime 5 carte del Deck" = la cima, cioè la FINE dell'array
            // (drawCardsToHand pesca con .pop(), che toglie dalla fine).
            const dug = deck.splice(Math.max(0, deck.length - 5), 5);
            gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
            // Vera scelta tra TUTTE le Magie/Trappole scavate (non solo la
            // prima) quando sono più di una — le carte scavate sono già
            // note/scoperte al giocatore, quindi un vero picker (non una
            // ricerca "alla cieca" nel Deck) è la scelta giusta qui,
            // stesso schema già usato altrove per un risultato di scavo.
            const stCandidates = dug.filter((c) => c.type === 'spell' || c.type === 'trap');
            const finish = (picked) => {
                dug.forEach((c) => { if (c !== picked) ctx.graveyard(ctx.owner).push(c); });
                if (picked) ctx.hand(ctx.owner).push(picked);
                ctx.log(picked
                    ? `🃏 Kuribandit si sacrifica, scava 5 carte e aggiunge ${picked.name} alla mano!`
                    : '🃏 Kuribandit si sacrifica e scava 5 carte, ma nessuna Magia/Trappola tra loro.');
            };
            if (stCandidates.length === 0) { finish(null); return; }
            if (!Decisioni.rispondeUnaPersona(ctx.owner) || stCandidates.length === 1) {
                finish(stCandidates[0]);
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: stCandidates,
                titolo: '🃏 Kuribandit',
                testo: 'Scegli quale Magia/Trappola aggiungere alla mano tra quelle scavate.'
            }, (card) => {
                if (card === null) return;
                finish(card);
            });
        }
    });

    // ================================================================
    // 326 — Soldato Cinetico (bonus Damage Step)
    // Durante il calcolo dei danni, se questa carta combatte contro un
    // mostro Tipo Guerriero (attaccando o difendendo): guadagna 2000
    // ATK/DEF solo durante quel calcolo dei danni.
    // ================================================================
    CardEffects.register(326, {
        damageStepBonus(ctx) {
            if (ctx.opponentCard && ctx.opponentCard.race === 'Guerriero') {
                return { atk: 2000, def: 2000 };
            }
            return null;
        }
    });

    // ================================================================
    // 343 — Guardiano di Lava / Lava Battleguard (buff continuo)
    // Guadagna 500 ATK per ogni "Guardiano delle Paludi" (id 74) che
    // controlli — speculare dell'id 74 qui sopra.
    // ================================================================
    CardEffects.register(343, {
        static(ctx) {
            const count = ctx.field(ctx.owner).filter((slot) => slot && !slot.isFaceDown && slot.card.id === 74).length;
            gameState.atkDefBonus[ctx.card.uid] = { atk: count * 500, def: 0 };
        }
    });

    // ================================================================
    // 345 — Leghul (permesso permanente di attacco diretto)
    // Questo mostro può sempre attaccare direttamente i Life Points
    // dell'avversario — stessa infrastruttura di Golem Meccanico (id 257,
    // punto 3), ma impostata di continuo da static() invece che a costo
    // di 800 LP tramite un effetto Ignition.
    // ================================================================
    CardEffects.register(345, {
        static(ctx) {
            gameState.directAttackAllowedFor = gameState.directAttackAllowedFor || {};
            gameState.directAttackAllowedFor[ctx.card.uid] = true;
        }
    });

    // ================================================================
    // 346 — Legion il Giullare Demoniaco / Legion the Fiend Jester
    // Se questa carta viene mandata dal campo al Cimitero: puoi
    // aggiungere 1 mostro Normale Incantatore dal Deck o dal Cimitero
    // alla mano (cerca prima nel Deck, ctx.searchDeckToHand — già usato
    // da Sangan/id 533 — poi nel proprio Cimitero se il Deck non ne ha).
    // "Durante il tuo Main Phase, puoi Evocare Tributo 1 mostro
    // Incantatore in Posizione di Attacco, in aggiunta alla tua
    // Evocazione Normale/Set (una volta per turno)": implementata come
    // effetto Ignition di QUESTA carta (stesso schema di ogni altro
    // Ignition-con-Sacrificio già presente in questo file, es. Soldato
    // Cannone id 137) invece che passare dal flusso condiviso di
    // Evocazione Tributo del giocatore (attemptMonsterSummon/
    // openSummonModal, actions.js) — quel flusso ricontrolla
    // gameState.hasNormalSummoned in DUE punti separati e forzarli a
    // ignorarlo solo per un Incantatore in Attacco avrebbe richiesto
    // instradare un flag speciale attraverso l'intera catena UI
    // (selezione Tributi -> popover Attacco/Difesa), un rischio di
    // regressione molto più alto per l'unica carta che ne ha bisogno.
    // Qui l'Ignition risolve subito, senza toccare hasNormalSummoned
    // (è "IN AGGIUNTA", non un sostituto), auto-selezionando Sacrificio
    // e bersaglio come ogni altra selezione automatica di questo file,
    // e scatena comunque TRIGGER.ON_NORMAL_SUMMON (stesso schema già
    // usato da Offerta Suprema id 559) così le carte reattive (es. Buco
    // Trappola) possono ancora rispondere.
    // ================================================================
    function legionAutoPickTributes(ctx, summonedCard) {
        const needed = getTributesRequired(summonedCard);
        if (needed === 0) return [];
        const field = ctx.field(ctx.owner);
        const candidates = field
            .map((slot, index) => (slot ? { index, value: getTributeValue(slot.card, summonedCard), atk: slot.card.attack || 0 } : null))
            .filter(Boolean)
            .sort((a, b) => a.atk - b.atk);
        let remaining = needed;
        const toSacrifice = [];
        for (const c of candidates) {
            if (remaining <= 0) break;
            toSacrifice.push(c.index);
            remaining -= c.value;
        }
        return remaining <= 0 ? toSacrifice : null;
    }
    function legionFindSummonableSpellcaster(ctx) {
        const hand = ctx.hand(ctx.owner);
        return hand.findIndex((c) => c.type === 'monster' && !c.extraDeck && c.race === 'Incantatore' && legionAutoPickTributes(ctx, c) !== null);
    }
    CardEffects.register(346, {
        onDestroy(ctx) {
            const isNormalSpellcaster = (c) => c.type === 'monster' && c.vanilla && c.race === 'Incantatore';
            const openedFromDeck = searchDeckWithChoice(ctx, isNormalSpellcaster, {
                title: '🃏 Legione Demone Giullare',
                text: 'Scegli quale Incantatore Normale aggiungere alla mano dal Deck.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`🃏 Legione Demone Giullare aggiunge ${card.name} alla mano dal Deck!`);
            });
            if (openedFromDeck) return;
            searchGraveyardWithChoice(ctx, ctx.owner, isNormalSpellcaster, {
                title: '🃏 Legione Demone Giullare',
                text: 'Scegli quale Incantatore Normale aggiungere alla mano dal Cimitero.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`🃏 Legione Demone Giullare aggiunge ${card.name} alla mano dal Cimitero!`);
            });
        },
        canActivate(ctx) {
            // "Una volta per turno" già garantito dal meccanismo generico
            // di ogni effetto Ignition (gameState.usedIgnitionThisTurn,
            // duel-engine.js activateCard/canActivate) — nessun
            // tracciamento extra necessario, stesso schema di ogni altro
            // Ignition di questo file (es. Soldato Cannone id 137).
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return false;
            return legionFindSummonableSpellcaster(ctx) !== -1;
        },
        activate(ctx) {
            const handIndex = legionFindSummonableSpellcaster(ctx);
            if (handIndex === -1) return;
            const hand = ctx.hand(ctx.owner);
            const summonedCard = hand[handIndex];
            const tributeIndices = legionAutoPickTributes(ctx, summonedCard);
            if (!tributeIndices) return;
            const field = ctx.field(ctx.owner);
            tributeIndices.forEach((index) => {
                ctx.graveyard(ctx.owner).push(field[index].card);
                field[index] = null;
            });
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            hand.splice(handIndex, 1);
            field[slotIndex] = { card: summonedCard, position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedOnTurn: gameState.turn };
            ctx.log(`🎭 Legione Demone Giullare: Evocazione Tributo extra di ${summonedCard.name}!`);
            DuelEngine.fireTrigger(DuelEngine.TRIGGER.ON_NORMAL_SUMMON, DuelEngine.makeContext(ctx.owner, { summonedCard: summonedCard, summonedSlotIndex: slotIndex, summonedPosition: 'attack' }));
        }
    });

    // ================================================================
    // 352 — Freccia Spezza-Magie / Spell Shattering Arrow (Magia Veloce)
    // Distrugge tutte le Magie scoperte controllate dall'avversario e
    // infligge 500 danni per ciascuna distrutta.
    // ================================================================
    CardEffects.register(352, {
        canActivate(ctx) {
            return ctx.stField(ctx.opponent).some((slot) => slot && !slot.isFaceDown && slot.card.type === 'spell');
        },
        activate(ctx) {
            let count = 0;
            ctx.stField(ctx.opponent).forEach((slot, index) => {
                if (slot && !slot.isFaceDown && slot.card.type === 'spell') {
                    ctx.destroySpellTrap(ctx.opponent, index);
                    count++;
                }
            });
            if (count > 0) ctx.dealDamage(ctx.opponent, count * 500);
            ctx.log(`🏹 Freccia Spezza-Magia distrugge ${count} Magi${count === 1 ? 'a' : 'e'} e infligge ${count * 500} danni!`);
        }
    });

    // ================================================================
    // 359 — Re Macchina / Machine King (buff continuo)
    // Guadagna 100 ATK per ogni mostro Tipo Macchina sul Terreno, di
    // entrambi i giocatori (regola reale: include anche se stesso).
    // ================================================================
    CardEffects.register(359, {
        static(ctx) {
            let count = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (slot && !slot.isFaceDown && slot.card.race === 'Macchina') count++;
                });
            });
            gameState.atkDefBonus[ctx.card.uid] = { atk: count * 100, def: 0 };
        }
    });

    // ================================================================
    // 366 — Makiu, la Nebbia Magica / Makiu, the Magical Mist (Magia
    // Normale)
    // Scegli 1 "Teschio Evocato" (id 13) o 1 mostro Tipo Tuono che
    // controlli; distruggi tutti i mostri dell'avversario con DEF pari o
    // inferiore all'ATK di quel mostro.
    // CORREZIONE di fedeltà: aggiunta la clausola mancante "non puoi
    // condurre la tua Battle Phase in questo turno" — nuovo
    // gameState.skipBattlePhaseFor (game-flow.js/enterBattlePhase,
    // azzerato in changeTurn()), riusabile anche da altre carte con lo
    // stesso vincolo (es. Carica dell'Anima/Soul Charge, id 59).
    // ================================================================
    CardEffects.register(366, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && (slot.card.id === 13 || slot.card.race === 'Tuono'));
        },
        activate(ctx) {
            // "Scegli come bersaglio 1 Teschio Evocato o 1 mostro Tuono che
            // controlli": il giocatore sceglie quale (il suo ATK decide
            // cosa viene distrutto), e il bersaglio passa dal checkpoint di
            // targeting. In cima il più forte, che è ciò che prende il bot.
            const candidati = collectFieldTargets(ctx, {
                zone: 'monster', owner: 'self',
                filter: (card) => card.id === 13 || card.race === 'Tuono'
            }).sort((a, b) => (b.card.attack || 0) - (a.card.attack || 0));
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🌫️ Makiu, la Nebbia Magica',
                text: 'Scegli il mostro il cui ATK decide quali mostri avversari distruggere (DEF pari o inferiore).',
                dichiara: true
            }, (scelto) => makiuDistruggi(ctx, scelto.card.attack || 0));
        }
    });

    /** Corpo di Makiu (id 366), a bersaglio già scelto e dichiarato. */
    function makiuDistruggi(ctx, bestAtk) {
        let count = 0;
        ctx.field(ctx.opponent).forEach((slot, index) => {
            if (slot && !slot.isFaceDown && slot.card.defense <= bestAtk) {
                ctx.destroyMonster(ctx.opponent, index);
                count++;
            }
        });
        gameState.skipBattlePhaseFor = gameState.skipBattlePhaseFor || {};
        gameState.skipBattlePhaseFor[ctx.owner] = true;
        ctx.log(`🌫️ Makiu distrugge ${count} mostr${count === 1 ? 'o' : 'i'} con DEF <= ${bestAtk}! Non puoi condurre la Battle Phase in questo turno.`);
    }

    // ================================================================
    // 378 — Meteora della Distruzione / Meteor of Destruction (Magia
    // Normale)
    // Se i Life Points dell'avversario sono superiori a 3000: infliggi
    // 1000 danni.
    // ================================================================
    CardEffects.register(378, {
        canActivate(ctx) {
            return Tavolo.lp(ctx.opponent) > 3000;
        },
        activate(ctx) {
            ctx.dealDamage(ctx.opponent, 1000);
            ctx.log(`☄️ Meteora Della Morte infligge 1000 danni!`);
        }
    });

    // ================================================================
    // 382 — Forza dello Specchio / Mirror Force (Trappola Normale)
    // Quando un mostro dell'avversario dichiara un attacco: distruggi
    // tutti i mostri in Posizione di Attacco controllati dall'avversario.
    // ================================================================
    CardEffects.register(382, {
        onAttackDeclare(ctx) {
            if (window.FX && typeof FX.playMirrorForce === 'function') {
                const attackIndices = [];
                ctx.field(ctx.opponent).forEach((slot, index) => {
                    if (slot && !slot.isFaceDown && slot.position === 'attack') attackIndices.push(index);
                });
                FX.playMirrorForce(ctx.opponent, attackIndices);
            }
            let count = 0;
            ctx.field(ctx.opponent).forEach((slot, index) => {
                if (slot && !slot.isFaceDown && slot.position === 'attack') {
                    ctx.destroyMonster(ctx.opponent, index);
                    count++;
                }
            });
            ctx.log(`🔮 Forza Riflessa distrugge ${count} mostr${count === 1 ? 'o' : 'i'} in Posizione di Attacco!`);
        }
    });

    // ================================================================
    // 383 — Muro dello Specchio / Mirror Wall (Trappola Continua)
    // Ogni mostro dell'avversario che ha attaccato mentre questa carta
    // era scoperta ha l'ATK dimezzato finché la carta resta scoperta.
    // Durante ciascuna propria Standby Phase: paga 2000 Life Points o
    // distruggi questa carta.
    // I mostri "marchiati" (onAttackDeclare) vivono in un Set persistente
    // su ctx.card (mai azzerato da recomputeStaticEffects, a differenza
    // di gameState.atkDefBonus) — static() lo rilegge ogni render e
    // riscrive il malus da capo a partire dall'ATK DI BASE (card.attack,
    // non l'ATK effettivo corrente): usare l'ATK corrente creerebbe un
    // dimezzamento che si ripete su se stesso ad ogni ricalcolo,
    // riducendo l'ATK progressivamente verso zero invece di restare
    // stabile a metà del valore stampato.
    // SEMPLIFICAZIONE: il costo di mantenimento paga sempre finché i LP
    // bastano e si autodistrugge solo quando non bastano più, invece
    // di offrire la scelta "paga o distruggi" — nessuna interfaccia di
    // scelta costo esiste per le Trappole Continue in questo motore,
    // stesso schema di Scatola delle Fate (id 232) qui sopra.
    // ================================================================
    CardEffects.register(383, {
        continuous: true,
        activate(ctx) {
            ctx.log('🪞 Muro a Specchio attivato: ogni mostro avversario che attacca da qui in poi avrà l\'ATK dimezzato finché resta in campo!');
        },
        onAttackDeclare(ctx) {
            const attackerSlot = ctx.field(ctx.attackerOwner)[ctx.attackerIndex];
            if (!attackerSlot) return;
            ctx.card.mirrorWallMarkedUids = ctx.card.mirrorWallMarkedUids || new Set();
            ctx.card.mirrorWallMarkedUids.add(attackerSlot.card.uid);
        },
        static(ctx) {
            const marked = ctx.card.mirrorWallMarkedUids;
            if (!marked || marked.size === 0) return;
            ctx.field(ctx.opponent).forEach((slot) => {
                if (!slot || slot.isFaceDown || !marked.has(slot.card.uid)) return;
                const half = Math.floor(slot.card.attack / 2);
                const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                gameState.atkDefBonus[slot.card.uid] = { atk: e.atk - half, def: e.def };
            });
        },
        onStandbyPhase(ctx) {
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            if (gameState[lpKey] > 2000) {
                gameState[lpKey] -= 2000;
                ctx.log(`🪞 Muro a Specchio: ${ctx.owner === 'player' ? 'paghi' : 'il bot paga'} 2000 Life Points per mantenerlo in campo.`);
            } else {
                ctx.stField(ctx.owner)[ctx.index] = null;
                ctx.graveyard(ctx.owner).push(ctx.card);
                ctx.log('🪞 Muro a Specchio: Life Points insufficienti per il mantenimento, si autodistrugge.');
            }
        }
    });

    // ================================================================
    // 390 — Pomodoro Mistico / Mystic Tomato (onDestroy)
    // Quando questa carta viene distrutta in battaglia e mandata al
    // Cimitero: puoi Special Summon dal Deck, scoperto in Posizione di
    // Attacco, 1 mostro OSCURITÀ con 1500 o meno ATK. Vera scelta tra
    // tutti i candidati tramite searchDeckWithChoice (vedi il suo
    // commento) invece del primo trovato nel Deck mescolato.
    // SEMPLIFICAZIONE residua: funziona solo con un Deck reale in
    // gameState.playerDeck/botDeck (non nel Duello Demo).
    // ================================================================
    CardEffects.register(390, {
        onDestroy(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.attribute === 'OSCURITÀ' && c.attack <= 1500, {
                title: '🍅 Pomodoro Mistico',
                text: 'Scegli quale mostro OSCURITÀ (1500 ATK o meno) Special Summonare dal Deck.'
            }, (card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
                ctx.log(`🍅 Pomodoro Mistico Special Summona ${card.name} dal Deck!`);
            });
        }
    });

    // ================================================================
    // 393 — Re Neko Mane / Neko Mane King
    // Durante il turno dell'avversario, quando questa carta viene mandata
    // al Cimitero da un suo effetto Carta: diventa subito la End Phase di
    // questo turno (enterEndPhase(), game-flow.js — stessa funzione già
    // usata dal normale avanzamento di fase, riusata qui per un salto
    // diretto). Copre distrutta (onDestroy, ctx.destroyedByOwner), scartata
    // dalla mano — casuale o scelta (onSentToGraveyardFromHand,
    // ctx.discardedByOwner) — e mandata al Cimitero dal Deck/mill
    // (onSentToGraveyardFromDeck, ctx.milledByOwner, duel-engine.js).
    // SEMPLIFICAZIONE residua: non ogni altro modo in cui un effetto
    // avversario può mandarla al Cimitero passa ancora da un aggancio
    // generico riconoscibile.
    // ================================================================
    function nekoManeTriggerEndPhase(ctx) {
        if (gameState.currentPlayer !== ctx.opponent) return;
        if (typeof enterEndPhase === 'function') enterEndPhase();
        ctx.log('🐱 Re Neko Mane fa scattare subito la End Phase!');
    }
    CardEffects.register(393, {
        onDestroy(ctx) {
            if (ctx.destroyedByOwner !== ctx.opponent) return;
            nekoManeTriggerEndPhase(ctx);
        },
        onSentToGraveyardFromHand(ctx) {
            if (ctx.discardedByOwner !== ctx.opponent) return;
            nekoManeTriggerEndPhase(ctx);
        },
        onSentToGraveyardFromDeck(ctx) {
            if (ctx.milledByOwner !== ctx.opponent) return;
            nekoManeTriggerEndPhase(ctx);
        }
    });

    // ================================================================
    // 409 — Raigeki (Magia Normale)
    // Distruggi tutti i mostri controllati dall'avversario.
    // ================================================================
    CardEffects.register(409, {
        canActivate(ctx) {
            return ctx.field(ctx.opponent).some((slot) => slot !== null);
        },
        activate(ctx) {
            const resolveRaigeki = () => {
                ctx.destroyAllMonsters(ctx.opponent);
                ctx.log(`⚡ Raigeki distrugge tutti i mostri dell'avversario!`);
            };
            if (window.FX && typeof FX.playRaigeki === 'function') {
                FX.playRaigeki(ctx.opponent, resolveRaigeki);
            } else {
                resolveRaigeki();
            }
        }
    });

    // ================================================================
    // 414 — Trasmigrazione Occhi Rossi / Red-Eyes Transmigration (Magia
    // Rituale)
    // Sacrifica mostri dal tuo Terreno per un Livello totale di almeno 8,
    // poi Special Summon Signore del Rosso (id 354) dalla mano.
    // SEMPLIFICAZIONE: sceglie da sola quali mostri sacrificare (i meno
    // possibile per raggiungere il totale, partendo dai Livelli più
    // alti), stesso spirito di Rito del Guerriero Nero (id 56). Manca
    // anche la clausola reale "e/o bandisci mostri Red-Eyes dal
    // Cimitero", qui si sacrificano solo mostri dal Terreno.
    // ================================================================
    // CORREZIONE di fedeltà: i Sacrifici ora possono venire anche dalla
    // mano, non solo dal Terreno (performRitualTribute/maxRitualTributeLevel,
    // vicino a attachUnionMonster in questo file). Manca ancora la
    // clausola alternativa "e/o bandisci mostri Occhi Rossi dal
    // Cimitero" come costo aggiuntivo/alternativo.
    // Costo alternativo: bandisci mostri "Occhi Rossi" dal Cimitero per un
    // Livello totale di almeno 8 ("Occhi Rossi B. Chick", l'unica
    // eccezione del testo reale, non è presente in questo database —
    // nessun filtro extra serve). Preferito al Sacrificio quando basta da
    // solo, per non svuotare inutilmente il proprio Terreno/mano.
    function totalRedEyesGraveyardLevel(ctx) {
        return ctx.graveyard(ctx.owner)
            .filter((c) => c.type === 'monster' && c.name && c.name.includes('Occhi Rossi'))
            .reduce((sum, c) => sum + (c.level || 0), 0);
    }
    function banishRedEyesFromGraveyard(ctx, requiredLevel) {
        const candidates = ctx.graveyard(ctx.owner)
            .filter((c) => c.type === 'monster' && c.name && c.name.includes('Occhi Rossi'))
            .sort((a, b) => (b.level || 0) - (a.level || 0));
        let remaining = requiredLevel;
        const toBanishUids = new Set();
        candidates.forEach((c) => {
            if (remaining <= 0) return;
            toBanishUids.add(c.uid);
            remaining -= c.level || 0;
        });
        const grave = ctx.graveyard(ctx.owner);
        for (let i = grave.length - 1; i >= 0; i--) {
            if (toBanishUids.has(grave[i].uid)) {
                ctx.banishFromGraveyard(ctx.owner, grave[i]);
            }
        }
    }
    CardEffects.register(414, {
        canActivate(ctx) {
            const handIndex = ctx.hand(ctx.owner).findIndex((c) => c.id === 354);
            if (handIndex === -1) return false;
            return maxRitualTributeLevel(ctx, handIndex) >= 8 || totalRedEyesGraveyardLevel(ctx) >= 8;
        },
        activate(ctx) {
            const handIndex = ctx.hand(ctx.owner).findIndex((c) => c.id === 354);
            if (handIndex === -1) return;
            if (totalRedEyesGraveyardLevel(ctx) >= 8) {
                banishRedEyesFromGraveyard(ctx, 8);
            } else {
                performRitualTribute(ctx, 8, handIndex);
            }

            const hand = ctx.hand(ctx.owner);
            const finalHandIndex = hand.findIndex((c) => c.id === 354);
            if (finalHandIndex === -1) return;
            const [ritualCard] = hand.splice(finalHandIndex, 1);

            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) {
                ctx.graveyard(ctx.owner).push(ritualCard);
                ctx.log('⚠️ Il Terreno è pieno: Signore del Rosso finisce nel Cimitero.');
                return;
            }
            ctx.specialSummon(ctx.owner, ritualCard, slotIndex, 'attack', 'hand');
            ctx.log('🔥 Trasmigrazione Occhi Rossi evoca Signore del Rosso!');
        }
    });

    // ================================================================
    // 415 — Vincoli Recisi / Release Restraint (Magia Normale)
    // Sacrifica 1 "Gearfried il Cavaliere di Ferro" (id 16) scoperto;
    // Special Summon 1 "Spadaccino Sacro - Gearfried il Cavaliere di Ferro" (id 258) dalla
    // mano o dal Deck.
    // SEMPLIFICAZIONE: la ricerca dal Deck funziona solo se esiste un
    // Deck reale — stesso limite di Sepoltura Sciocca (id 251).
    // ================================================================
    CardEffects.register(415, {
        canActivate(ctx) {
            const hasIronKnight = ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.id === 16);
            if (!hasIronKnight) return false;
            const deck = Tavolo.mazzo(ctx.owner, ctx.gameState);
            const inHand = ctx.hand(ctx.owner).some((c) => c.id === 258);
            const inDeck = Array.isArray(deck) && deck.some((c) => c.id === 258);
            return inHand || inDeck;
        },
        activate(ctx) {
            const field = ctx.field(ctx.owner);
            const ironIndex = field.findIndex((slot) => slot && !slot.isFaceDown && slot.card.id === 16);
            if (ironIndex === -1) return;
            ctx.graveyard(ctx.owner).push(field[ironIndex].card);
            field[ironIndex] = null;

            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const hand = ctx.hand(ctx.owner);
            const handIdx = hand.findIndex((c) => c.id === 258);
            let card;
            if (handIdx !== -1) {
                card = hand.splice(handIdx, 1)[0];
            } else {
                const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
                const countKey = Tavolo.chiave(ctx.owner, 'DeckCount');
                const deck = ctx.gameState[deckKey];
                if (!Array.isArray(deck)) return;
                const deckIdx = deck.findIndex((c) => c.id === 258);
                if (deckIdx === -1) return;
                card = deck.splice(deckIdx, 1)[0];
                ctx.gameState[countKey] = deck.length;
            }
            ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'hand');
            ctx.log('⚔️ Rimozione della Restrizione evoca Spadaccino Sacro - Gearfried il Cavaliere di Ferro!');
        }
    });

    // ================================================================
    // 258 — Gearfried il Maestro di Spada / Swordmaster Gearfried
    // Non può essere Evocato Normalmente/Set né Special Summonato in
    // nessun altro modo (cannotBeSpecialSummoned — non blocca
    // ctx.specialSummon usato direttamente da Vincoli Recisi id 415 qui
    // sopra, l'unico modo legale). Ogni volta che viene equipaggiata con
    // una Carta Equipaggiamento: distruggi 1 mostro dell'avversario
    // (onEquipped, riusabile — vedi attachEquip più in alto in questo
    // file). CORREZIONE: la nota precedente affermava erroneamente che
    // "Rimozione della Restrizione" non fosse presente in questo database — falso,
    // esiste già come id 415 (e la aveva già implementata per intero).
    // SEMPLIFICAZIONE: sceglie da sola il bersaglio da distruggere (il
    // più forte disponibile, priorità a quelli scoperti).
    // ================================================================
    CardEffects.register(258, {
        cannotNormalSummon: true,
        cannotBeSpecialSummoned: true,
        onEquipped(ctx) {
            const oppField = ctx.field(ctx.opponent);
            let targetIndex = -1;
            let bestAtk = -1;
            oppField.forEach((slot, i) => {
                if (!slot) return;
                const a = slot.isFaceDown ? 0 : DuelEngine.getEffectiveAtk(slot.card);
                if (a >= bestAtk) { bestAtk = a; targetIndex = i; }
            });
            if (targetIndex === -1) return;
            const decl = ctx.declareTarget(ctx.opponent, targetIndex, { totalTargetCount: 1 });
            if (!decl.allowed) return;
            const targetSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
            if (!targetSlot) return;
            const name = targetSlot.isFaceDown ? 'una carta coperta' : targetSlot.card.name;
            ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
            ctx.log(`⚔️ Spadaccino Sacro - Gearfried il Cavaliere di Ferro, appena equipaggiata, distrugge ${name}!`);
        }
    });

    // ================================================================
    // 416 — Abbandonato / Relinquished
    // Ritual Summonabile tramite "Rito Illusione Nera" (id 116, già
    // registrata) — vedi anche fusionMaterials/ritualMaterials più in
    // basso in questo file per come 116 la evoca.
    // Effetto Ignition dalla zona Mostro (una volta per turno, come
    // Tartaruga Catapulta id 144: usedIgnitionThisTurn, generico, non
    // richiede tracciamento manuale qui): "assorbe" 1 mostro scoperto
    // dell'avversario, RIMUOVENDOLO dal suo Terreno (non lo distrugge, non
    // va al Cimitero — resta "attaccato" a questa carta, come un Equip),
    // e l'ATK/DEF di questa carta diventano pari a quelli del mostro
    // assorbito (delta scritto in gameState.atkDefBonus, stesso schema di
    // Bozzolo dell'Evoluzione id 157). Se questa carta viene distrutta: il
    // mostro assorbito torna sul Terreno del suo vero proprietario
    // (scoperto in Posizione di Attacco, o al Cimitero se non c'è una
    // casella libera) — SEMPLIFICAZIONE: la restituzione avviene SOLO su
    // distruzione (onDestroy), non su altri modi di lasciare il campo
    // (tornare in mano, essere bandita, essere sacrificata) — nessun
    // aggancio generico "questa carta sta per lasciare il campo, in
    // QUALUNQUE modo" esiste in questo motore. Mancano anche le due
    // clausole più esotiche del testo reale: "se distrutta in battaglia,
    // distruggi il mostro assorbito al posto suo" (redirect della
    // distruzione) e "il danno da questa battaglia viene inflitto anche
    // all'avversario" — nessuna delle due ha un aggancio generico pronto
    // in resolveBattleDamage (actions.js) per una carta così di nicchia.
    // ================================================================
    // releaseRelinquishedTarget vive ora fra gli helper condivisi, in cima a
    // js/engine/card-effects.js: serve a gruppi di carte lontani fra loro,
    // quindi non può stare dentro un singolo file-parte.

    CardEffects.register(416, {
        cannotNormalSummon: true,
        cannotBeSpecialSummoned: true,
        canActivate(ctx) {
            if (ctx.card._relinquishedTarget) return false;
            return ctx.field(ctx.opponent).some((slot) => slot && !slot.isFaceDown);
        },
        activate(ctx) {
            let candidati = collectFieldTargets(ctx, { zone: 'monster', owner: 'opponent' });
            if ((gameState.livelloIA && gameState.livelloIA[ctx.owner]) === 'hard') {
                candidati = candidati.sort((a, b) => DuelEngine.getEffectiveAtk(b.card) - DuelEngine.getEffectiveAtk(a.card));
            }
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🌀 Abbandono',
                text: 'Scegli quale mostro avversario assorbire: ne copierai ATK e DEF.'
            }, (scelto) => {
                const decl = ctx.declareTarget(scelto.owner, scelto.index, { totalTargetCount: 1 });
                if (!decl.allowed) return;
                const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!finalSlot) return;
                const absorbed = finalSlot.card;
                ctx.field(decl.targetOwner)[decl.targetIndex] = null;
                ctx.card._relinquishedTarget = absorbed;
                ctx.card._relinquishedFromOwner = decl.targetOwner;
                ctx.log(`🌀 Abbandono assorbe ${absorbed.name} dal campo avversario!`);
            });
        },
        static(ctx) {
            const absorbed = ctx.card._relinquishedTarget;
            if (!absorbed) return;
            const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk + (absorbed.attack - ctx.card.attack), def: e.def + (absorbed.defense - ctx.card.defense) };
        },
        onDestroy: releaseRelinquishedTarget,
        // "Se questa carta lascia il Terreno" copre distruzione, ritorno in
        // mano (onReturnedToHandSelf, ACTIONS.returnMonsterToHand), Sacrificio
        // (onSacrificedForTribute, notifySacrificedForTribute) e ora anche
        // il bando (onBanished, ACTIONS.banish — chiamato con un ctx pieno,
        // ctx.field/ctx.graveyard funzionano esattamente come ovunque
        // altro: la nota precedente che escludeva questo caso partiva da
        // una premessa sbagliata, corretta qui). releaseRelinquishedTarget
        // usa solo ctx.card/ctx.field/ctx.graveyard, quindi funziona
        // identica per tutti e quattro questi hook.
        onReturnedToHandSelf: releaseRelinquishedTarget,
        onSacrificedForTribute: releaseRelinquishedTarget,
        onBanished: releaseRelinquishedTarget,
        // "Se questa carta dovrebbe essere distrutta IN BATTAGLIA,
        // distruggi il mostro assorbito al posto suo. Se lo fai, il danno
        // da quella battaglia viene inflitto al tuo avversario invece che
        // a te.": def.onWouldBeDestroyedInBattle (aggancio in
        // resolveBattleDamage, actions.js) — a differenza del ritorno
        // "vivo" di releaseRelinquishedTarget qui sopra (quando Abbandonato
        // lascia il campo), qui il mostro assorbito viene DISTRUTTO per
        // davvero, e Abbandonato sopravvive (perde l'assorbito, il bonus
        // ATK/DEF sparisce da solo al prossimo static()). Il redirect del
        // danno (_redirectBattleDamageToOpponent, consumato subito in
        // resolveBattleDamage PRIMA di applicare il danno) copre entrambe
        // le direzioni: Abbandonato come difensore O come attaccante.
        onWouldBeDestroyedInBattle(ctx) {
            const absorbed = ctx.card._relinquishedTarget;
            if (!absorbed) return false;
            const owner = ctx.card._relinquishedFromOwner;
            ctx.graveyard(owner).push(absorbed);
            ctx.card._relinquishedTarget = null;
            ctx.card._redirectBattleDamageToOpponent = true;
            ctx.log(`🌀 Abbandono sopravvive: ${absorbed.name} viene distrutto al suo posto!`);
            return true;
        }
    });

    // ================================================================
    // 417 — Rimuovi Trappola / Remove Trap (Magia Normale)
    // Distrugge 1 Trappola scoperta sul Terreno.
    // ================================================================
    CardEffects.register(417, {
        canActivate(ctx) {
            return [ctx.opponent, ctx.owner].some((owner) => ctx.stField(owner).some((slot) => slot && !slot.isFaceDown && slot.card.type === 'trap'));
        },
        activate(ctx) {
            // "Scegli 1 Trappola SCOPERTA sul Terreno": entrambi i lati,
            // quindi si può anche distruggere una propria Trappola ormai
            // inutile. Prima prendeva sempre la prima dell'avversario.
            const candidati = collectFieldTargets(ctx, {
                zone: 'st',
                filter: (card) => card.type === 'trap'
            });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '✨ Rimuovi Trappola',
                text: 'Scegli quale Trappola scoperta distruggere.'
            }, (scelto) => {
                ctx.graveyard(scelto.owner).push(scelto.card);
                ctx.stField(scelto.owner)[scelto.index] = null;
                ctx.log(`✨ Rimuovi Trappola distrugge ${scelto.card.name}!`);
            });
        }
    });

    // ================================================================
    // 426 — Decreto Reale / Royal Decree (effetto CONTINUO della
    // Trappola, non un'attivazione manuale — come Jinzo, id 17)
    // Nega gli effetti di tutte le altre Trappole sul Terreno, di
    // entrambi i giocatori.
    // ================================================================
    CardEffects.register(426, {
        continuous: true,
        activate(ctx) { ctx.log('📜 Decreto Reale si attiva: gli altri effetti Trappola sono negati!'); },
        // Nega le Trappole di ENTRAMBI: all'IA conviene solo se non ne ha altre e il nemico ne ha di Set.
        aiCanActivate(ctx) {
            const trappole = (owner) => ctx.stField(owner).filter((slot) => slot && slot.card.type === 'trap' && slot.card.id !== 426).length;
            return trappole(ctx.owner) === 0 && trappole(ctx.opponent) >= 2;
        },
        static(ctx) {
            gameState.trapsNegatedFor[ctx.owner] = true;
            gameState.trapsNegatedFor[ctx.opponent] = true;
        }
    });

    // ================================================================
    // 271 — Occhio di Gorgone / Gorgon's Eye (Trappola Normale)
    // Fino alla fine di questo turno, tutti gli effetti dei mostri in
    // Posizione di Difesa (di entrambi i giocatori) sono annullati.
    // SEMPLIFICAZIONE: copre gli effetti CONTINUI (recomputeStaticEffects)
    // e gli Ignition (canActivate, zone 'monster') — vedi
    // gameState.defenseMonsterEffectsNegated in entrambi (duel-engine.js).
    // Non copre trigger reattivi (onFlip/onAttackDeclare/ecc.) di un
    // mostro già in Difesa, casi di nicchia per questo dataset.
    // ================================================================
    CardEffects.register(271, {
        activate(ctx) {
            gameState.defenseMonsterEffectsNegated = true;
            ctx.log('👁️ L\'Occhio della Gorgone annulla gli effetti di tutti i mostri in Posizione di Difesa fino a fine turno!');
        }
    });

    // ================================================================
    // 708 — Xing Zhen Hu (Trappola Continua)
    // Scegli 2 Magie/Trappole Set sul Terreno: non possono più essere
    // attivate. SEMPLIFICAZIONE: sceglie da sola le prime 2 Magie/Trappole
    // Set dell'avversario invece di un'interfaccia di selezione dedicata a
    // 2 carte specifiche (nessuna esiste ancora in questo motore) — stesso
    // spirito delle altre auto-selezioni già presenti (es. Dado di
    // Evocazione id 460). Usa il nuovo controllo per uid
    // gameState.blockedCardUids in DuelEngine.canActivate (duel-engine.js).
    // ================================================================
    CardEffects.register(708, {
        canActivate(ctx) {
            return ctx.stField(ctx.opponent).some((slot) => slot && slot.isFaceDown);
        },
        activate(ctx) {
            const targets = [];
            ctx.stField(ctx.opponent).forEach((slot) => {
                if (slot && slot.isFaceDown && targets.length < 2) targets.push(slot);
            });
            gameState.blockedCardUids = gameState.blockedCardUids || new Set();
            targets.forEach((slot) => gameState.blockedCardUids.add(slot.card.uid));
            ctx.log(`🀄 Xing Zhen Hu blocca l'attivazione di ${targets.length} cart${targets.length === 1 ? 'a' : 'e'} Set dell'avversario!`);
        }
    });

    // ================================================================
    // 481 — Alligatore Toon: mostro normale, ma partecipa alle regole
    // condivise dell'archetipo (protezione/attacco diretto da Mondo e
    // precedenza ai Toon avversari negli scontri fra due Mondi).
    CardEffects.register(481, {
        isToon: true,
        mustTargetFilterIfPresent(card, owner) {
            const hasWorld = DuelEngine.hasActiveToonWorld(owner);
            return hasWorld && card.type === 'monster' && ((DuelEngine.getDefinition(card.id)?.isToon) || /Toon/i.test(card.name || ''));
        }
    });

    // ================================================================
    // 482 — Maschera Toon / Toon Mask (Trappola Normale)
    // Se controlli "Mondo Toon" scoperto: scegli 1 mostro scoperto
    // dell'avversario; Special Summon 1 mostro Toon (identificato dal nome
    // — nessun campo dedicato nel database, ma ogni vero mostro Toon di
    // questo dataset lo ha nel nome, es. "Alligatore Toon") dalla mano o
    // dal Deck con Livello pari o inferiore a quello del bersaglio,
    // ignorandone le condizioni di Evocazione. SEMPLIFICAZIONE: sceglie da
    // sola il primo mostro scoperto avversario come bersaglio.
    // ================================================================
    CardEffects.register(482, {
        canActivate(ctx) {
            // Mondo dei Toon è una Magia Continua nella normale zona M/T,
            // non una Magia Terreno. Cercarlo in `magiaTerreno` rendeva
            // Maschera Toon impossibile da attivare anche con Mondo scoperto.
            if (!DuelEngine.hasActiveToonWorld(ctx.owner)) return false;
            return ctx.field(ctx.opponent).some((slot) => slot && !slot.isFaceDown);
        },
        activate(ctx) {
            // Il mostro avversario bersaglio (il suo Livello fissa il tetto
            // del Toon evocabile) lo sceglie il giocatore e passa dal
            // checkpoint di targeting. In cima il Livello più alto: è ciò
            // che conviene, e ciò che prende il bot.
            const candidati = collectFieldTargets(ctx, { zone: 'monster', owner: 'opponent' })
                .sort((a, b) => (b.card.level || 0) - (a.card.level || 0));
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🎭 Maschera Toon',
                text: 'Scegli il mostro avversario: puoi Special Summonare un Toon con Livello pari o inferiore al suo.',
                dichiara: true
            }, (scelto) => mascheraToonEvoca(ctx, scelto.card.level || 0));
        }
    });

    /** Corpo di Maschera Toon (id 482), a bersaglio già scelto e dichiarato. */
    function mascheraToonEvoca(ctx, maxLevel) {
        {
            const isToon = (c) => c.type === 'monster' && c.name.includes('Toon');
            const hand = ctx.hand(ctx.owner);
            const finishSummon = (card, source) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) { ctx.log('🎭 Maschera Toon: nessuno slot mostro libero.'); return; }
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', source);
                ctx.log(`🎭 Maschera Toon Special Summona ${card.name}!`);
            };
            const handIndex = hand.findIndex((c) => isToon(c) && (c.level || 0) <= maxLevel);
            if (handIndex !== -1) {
                const [card] = hand.splice(handIndex, 1);
                finishSummon(card, 'hand');
                return;
            }
            // Vera scelta tra tutti i mostri Toon idonei nel Deck (non
            // solo il primo trovato) tramite searchDeckWithChoice.
            const opened = searchDeckWithChoice(ctx, (c) => isToon(c) && (c.level || 0) <= maxLevel, {
                title: '🎭 Maschera Toon',
                text: 'Scegli quale mostro Toon Special Summonare dal Deck.'
            }, (card) => finishSummon(card, 'deck'));
            if (!opened) ctx.log('🎭 Maschera Toon: nessun mostro Toon disponibile con Livello adeguato.');
        }
    }

    // ================================================================
    // 371 — Maschera della Restrizione / Mask of Restrict (effetto
    // CONTINUO della Trappola, come Decreto Reale id 426/Luce
    // dell'Intervento id 634): nessun giocatore può sacrificare carte.
    // gameState.tributesBlocked, consultato sia in attemptMonsterSummon
    // (Evocazione Tributo) sia in executeAttack/botPerformAttacks (costo
    // d'attacco tipo Guerriero Pantera id 399) — i due unici meccanismi
    // di Sacrificio condivisi da questo motore. SEMPLIFICAZIONE residua:
    // un Sacrificio scritto a mano come costo di un singolo effetto
    // Carta (bypassando i due checkpoint qui sopra) non verrebbe
    // bloccato — nessuna carta di quel tipo risulta presente in alcun
    // mazzo costruito finora, stesso principio già accettato per
    // findPetitMothReadyForCocoonSummon più in alto in questo file.
    // ================================================================
    CardEffects.register(371, {
        continuous: true,
        activate(ctx) { ctx.log('🚫 Maschera della Restrizione si attiva: nessuno puo\' piu\' sacrificare carte!'); },
        // Vieta i Tributi a ENTRAMBI e non ha un uso che l'IA sappia valutare: la gioca solo una persona.
        aiCanActivate() { return false; },
        static(ctx) {
            gameState.tributesBlocked = true;
        }
    });

    // ================================================================
    // 158 — Venditore di Bare / Coffin Seller (Trappola Continua)
    // Ogni volta che un mostro viene mandato al Cimitero DELL'AVVERSARIO
    // (di chi controlla questa carta): infliggi 300 danni all'avversario.
    // Usa il nuovo handler onEnemyMonsterDestroyed (vedi TRIGGER.ON_DESTROY
    // in duel-engine.js) — la variante "guarda il campo dell'avversario"
    // di onOwnMonsterDestroyed, già usato da Macchina del Tempo (id 478).
    // ================================================================
    CardEffects.register(158, {
        onEnemyMonsterDestroyed(ctx) {
            ctx.dealDamage(ctx.opponent, 300);
            ctx.log(`⚰️ Venditore di Bare infligge 300 danni a ${ctx.opponent === 'player' ? 'te' : 'il bot'}!`);
        }
    });

    // ================================================================
    // 634 — Luce dell'Intervento / Light of Intervention (effetto
    // CONTINUO della Trappola, come Decreto Reale id 426 qui sopra)
    // Finché scoperta sul Terreno, ogni Set di un mostro deve invece
    // avvenire scoperto in Posizione di Difesa (la Posizione resta
    // quella scelta, solo non più coperta) — vedi summonMonster()
    // (js/engine/actions.js), che consulta gameState.monsterSetBlocked.
    // SEMPLIFICAZIONE: i pulsanti Attacco/Difesa del popover restano
    // entrambi visibili (niente logica extra per nasconderli quando
    // l'effetto è attivo); scegliere Difesa risulta comunque in
    // un'Evocazione scoperta, con un log che lo spiega.
    // ================================================================
    CardEffects.register(634, {
        continuous: true,
        activate(ctx) { ctx.log('💡 Luce dell\'Intervento si attiva: i mostri non si possono piu\' Settare!'); },
        // Vieta il Set a ENTRAMBI e non ha un uso che l'IA sappia valutare: la gioca solo una persona.
        aiCanActivate() { return false; },
        static(ctx) {
            gameState.monsterSetBlocked = true;
        }
    });

    // ================================================================
    // 430 — Pietra del Saggio / Sage's Stone (Magia Normale)
    // Se controlli scoperta "Ragazza Maga Nera" (id 188): Special Summon 1
    // "Mago Nero" (id 2) dalla mano o dal Deck.
    // SEMPLIFICAZIONE: la ricerca dal Deck funziona solo se esiste un
    // Deck reale — stesso limite di Sepoltura Sciocca (id 251).
    // ================================================================
    CardEffects.register(430, {
        canActivate(ctx) {
            // La Maga Oscura corrente è id 188. L'id 19 apparteneva a una
            // vecchia versione del database ed è stato eliminato: lasciarlo
            // qui rendeva Pietra del Saggio permanentemente inattivabile.
            const hasMagicianGirl = ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.id === 188);
            if (!hasMagicianGirl) return false;
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return false;
            const deck = Tavolo.mazzo(ctx.owner, ctx.gameState);
            const inHand = ctx.hand(ctx.owner).some((c) => c.id === 2);
            const inDeck = Array.isArray(deck) && deck.some((c) => c.id === 2);
            return inHand || inDeck;
        },
        activate(ctx) {
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const hand = ctx.hand(ctx.owner);
            const handIdx = hand.findIndex((c) => c.id === 2);
            let card;
            if (handIdx !== -1) {
                card = hand.splice(handIdx, 1)[0];
            } else {
                const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
                const countKey = Tavolo.chiave(ctx.owner, 'DeckCount');
                const deck = ctx.gameState[deckKey];
                if (!Array.isArray(deck)) return;
                const deckIdx = deck.findIndex((c) => c.id === 2);
                if (deckIdx === -1) return;
                card = deck.splice(deckIdx, 1)[0];
                ctx.gameState[countKey] = deck.length;
            }
            ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'hand');
            ctx.log('🔮 Pietra del Saggio evoca Mago Nero!');
        }
    });

    // ================================================================
    // 433 — Sangan (onDestroy)
    // Quando questa carta viene mandata dal Terreno al Cimitero: puoi
    // aggiungere alla mano 1 mostro con 1500 o meno ATK dal Deck — vera
    // scelta tra tutti i candidati tramite searchDeckWithChoice (vedi il
    // suo commento), non più il primo trovato nel Deck mescolato: bug
    // reale segnalato dall'utente, MAI documentato con un
    // missingEffectNote nonostante fosse un vero scostamento dal testo
    // (uno dei nomi di ricerca più iconici del gioco reale proprio per la
    // libertà di scelta). Funziona solo con un Deck reale in
    // gameState.playerDeck/botDeck (vedi Sepoltura Sciocca, id 251).
    // ================================================================
    // CORREZIONE di fedeltà: aggiunta la restrizione da errata "non puoi
    // attivare carte, o effetti di carte, con questo nome per il resto
    // del turno" — approssimata come "una volta per turno per nome"
    // (ctx.hasUsedOncePerTurn su una chiave testuale, non sul singolo
    // uid): copre il caso pratico (2 Sangan distrutti nello stesso
    // turno, solo il primo cerca), senza costruire un aggancio generico
    // "blocco per nome" nell'intero canActivate per una singola carta.
    CardEffects.register(433, {
        onDestroy(ctx) {
            if (ctx.hasUsedOncePerTurn(`sangan-name:${ctx.owner}`)) return;
            // Segna il "già usato per nome" SOLO se ci sono davvero
            // candidati (altrimenti un secondo Sangan distrutto nello
            // stesso turno con un Deck ormai senza candidati verrebbe
            // bloccato a torto). searchDeckWithChoice ritorna false se
            // non trova nulla, PRIMA di aprire qualunque picker.
            const opened = searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.attack <= 1500, {
                title: '👹 Sangan',
                text: 'Scegli quale mostro (1500 ATK o meno) aggiungere alla mano dal Deck.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`👹 Sangan aggiunge ${card.name} alla mano dal Deck!`);
            });
            if (opened) ctx.markUsedOncePerTurn(`sangan-name:${ctx.owner}`);
        }
    });

    // ================================================================
    // 437 — Spettro Ombra / Shadow Ghoul (buff continuo)
    // Guadagna 100 ATK per ogni mostro nel proprio Cimitero.
    // ================================================================
    CardEffects.register(437, {
        static(ctx) {
            const count = ctx.graveyard(ctx.owner).filter((c) => c.type === 'monster').length;
            gameState.atkDefBonus[ctx.card.uid] = { atk: count * 100, def: 0 };
        }
    });

    // ================================================================
    // 438 — Ombra degli Occhi / Shadow of Eyes (Trappola Normale)
    // Quando 1 o più mostri vengono Set sul Terreno dell'avversario:
    // giralo scoperto in Posizione di Attacco (gli Effetti Flip non si
    // attivano). Riusa onOpponentSummon (già usato da Buco Trappola, id
    // 40: fireTrigger(ON_NORMAL_SUMMON) scatta per OGNI Evocazione
    // Normale, Set incluso) invece di un nuovo trigger dedicato — basta
    // controllare ctx.field(ctx.opponent)[ctx.summonedSlotIndex].isFaceDown
    // per sapere se è stato davvero Settato coperto. Gira la carta
    // mutando lo slot direttamente (isFaceDown/position), MAI tramite
    // fireTrigger(ON_FLIP, ...): è proprio questo a garantire che nessun
    // Effetto Flip scatti, come da testo reale.
    // ================================================================
    CardEffects.register(438, {
        canActivate(ctx) {
            const slot = ctx.field(ctx.opponent)[ctx.summonedSlotIndex];
            return !!slot && slot.isFaceDown;
        },
        onOpponentSummon(ctx) {
            const prima = ctx.field(ctx.opponent)[ctx.summonedSlotIndex];
            if (!prima || !prima.isFaceDown) return;
            // "Scegli come bersaglio 1 di quei mostri Set": checkpoint di
            // targeting. Il checkpoint non guarda i mostri coperti (i suoi
            // floodgate leggono la carta scoperta), ma lo stesso passaggio
            // serve alle reazioni come Gran Scudo Gardna.
            ctx.declareTargetWaiting(ctx.opponent, ctx.summonedSlotIndex, { totalTargetCount: 1 }, (decl) => {
                if (!decl.allowed) return;
                const slot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!slot || !slot.isFaceDown) return;
                slot.isFaceDown = false;
                slot.position = 'attack';
                ctx.log(`👁️ Ombra degli Occhi gira scoperto ${slot.card.name} in Posizione di Attacco!`);
            });
        }
    });

    // ================================================================
    // 446 — Coccinella Marchio Teschio / Skull Mark Ladybug (onDestroy)
    // Quando questa carta viene mandata al Cimitero: aumenta i tuoi Life
    // Points di 1000 punti.
    // ================================================================
    CardEffects.register(446, {
        onDestroy(ctx) {
            ctx.dealDamage(ctx.owner, -1000); // dealDamage negativo = cura
            ctx.log('🐞 Coccinella dal Dorso a Teschio, mandata al Cimitero, cura 1000 Life Points!');
        }
    });

    // ================================================================
    // 452 — Rilascio dell'Anima / Soul Release (Magia Normale)
    // Bandisce fino a 5 carte da un Cimitero qualsiasi.
    // SEMPLIFICAZIONE: l'effetto reale lascia scegliere quali carte
    // bandire — qui vengono bandite automaticamente le prime carte
    // trovate (prima il proprio Cimitero, poi quello dell'avversario).
    // ================================================================
    CardEffects.register(452, {
        canActivate(ctx) {
            return ctx.graveyard(ctx.owner).length > 0 || ctx.graveyard(ctx.opponent).length > 0;
        },
        activate(ctx) {
            let count = 0;
            const fine = () => {
                ctx.log(`👻 Rilascio delle Anime bandisce ${count} cart${count === 1 ? 'a' : 'e'} dai Cimiteri!`);
            };
            const prendi = (restanti) => {
                if (restanti === 0) { fine(); return; }
                // I candidati si ricalcolano AD OGNI giro: sono le carte
                // che stanno nei due Cimiteri in questo momento.
                const candidati = [...ctx.graveyard(ctx.owner), ...ctx.graveyard(ctx.opponent)];
                if (candidati.length === 0) { fine(); return; }
                // chooseCardFromList non rimuove nulla da sola: qui la
                // rimozione la fa ctx.banishFromGraveyard, che sa anche
                // rifiutarsi se Necrovalley (id 890) blocca il bando.
                chooseCardFromList(ctx, candidati, {
                    title: '👻 Rilascio delle Anime',
                    text: `Scegli la carta da bandire dai Cimiteri (${count + 1} di 5).`
                }, (scelta) => {
                    const owner = ctx.graveyard(ctx.owner).includes(scelta) ? ctx.owner : ctx.opponent;
                    // Necrovalley: se il bando è bloccato lo è per ogni
                    // carta di entrambi i Cimiteri, quindi si chiude qui
                    // invece di riprovare invano.
                    if (!ctx.banishFromGraveyard(owner, scelta)) { fine(); return; }
                    count++;
                    prendi(restanti - 1);
                });
            };
            prendi(5);
        }
    });

    // ================================================================
    // 453 — Cacciatore di Anime / Soul Taker (Magia Normale)
    // Distruggi 1 mostro scoperto dell'avversario, poi l'avversario
    // guadagna 1000 Life Points.
    // ================================================================
    CardEffects.register(453, {
        declaredTargeting: { count: 1, cardType: 'monster' },
        canActivate(ctx) {
            return ctx.field(ctx.opponent).some((slot) => slot && !slot.isFaceDown);
        },
        activate(ctx) {
            const candidati = collectFieldTargets(ctx, { zone: 'monster', owner: 'opponent' });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '💀 Ruba-Anime',
                text: 'Scegli quale mostro avversario distruggere.'
            }, (scelto) => {
                // declareTarget resta: e' il checkpoint condiviso che
                // permette a un floodgate o a Specchietto della Fata di
                // dire la sua sul bersaglio. La scelta del giocatore
                // decide COSA bersagliare, non se sia lecito.
                ctx.declareTargetWaiting(scelto.owner, scelto.index, { totalTargetCount: 1 }, (decl) => {
                    if (!decl.allowed) return;
                    const target = ctx.field(decl.targetOwner)[decl.targetIndex];
                    const name = target ? target.card.name : scelto.card.name;
                    ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                    ctx.dealDamage(ctx.opponent, -1000);
                    ctx.log(`💀 Ruba-Anime distrugge ${name}, l'avversario guadagna 1000 Life Points!`);
                });
            });
        }
    });

    // ================================================================
    // 459 — Ninja d'Assalto (Effetto Veloce)
    // Puoi bandire 2 mostri OSCURITÀ dal tuo Cimitero; bandisci questa
    // carta scoperta fino alla End Phase. Vero Effetto Veloce, attivabile
    // anche durante il turno avversario: canRespondAsQuickEffect: true
    // (findMonsterQuickEffectCandidates, duel-engine.js — infrastruttura
    // già esistente da prima di questa sessione, usata anche da
    // Spadaccino Mistico LV6 id 865) basta da sola, senza bisogno di una
    // coppia di hook dedicata come Spada Sigillante di Orichalcos (id
    // 396): questa carta ha UNA sola abilità dietro canActivate/activate,
    // quindi nessuna ambiguità su quale invocare risponde da una Chain
    // già aperta o da un click manuale in Main Phase — stesso identico
    // canActivate/activate in entrambi i casi. Il "una volta per turno"
    // è gameState.usedIgnitionThisTurn (lo stesso gate di ogni effetto
    // Ignition), segnato anche quando risponde a una Catena o usa la
    // finestra di priorità (segnaUsoEffettoMostro, duel-engine.js). Oltre
    // che in risposta a una Catena, la si può usare nella finestra di
    // priorità a vuoto del turno avversario (DuelEngine.openPriorityWindow).
    // Il bot non la usa lì (niente botInFinestraDiPriorita): bandirsi senza
    // una minaccia da schivare brucerebbe il costo per niente.
    // ================================================================
    CardEffects.register(459, {
        canRespondAsQuickEffect: true,
        canActivate(ctx) {
            return ctx.graveyard(ctx.owner).filter((c) => c.attribute === 'OSCURITÀ').length >= 2;
        },
        activate(ctx) {
            // Un Effetto Veloce può essere già in Catena quando la sua carta
            // lascia il Terreno. In quel caso non si paga inutilmente il
            // costo: la fonte non esiste più e l'effetto si risolve a vuoto.
            const field = ctx.field(ctx.owner);
            const sourceSlot = field[ctx.index];
            if (!sourceSlot || !sourceSlot.card || sourceSlot.card.uid !== ctx.card.uid) return;
            const grave = ctx.graveyard(ctx.owner);
            let removed = 0;
            for (let i = grave.length - 1; i >= 0 && removed < 2; i--) {
                if (grave[i].attribute === 'OSCURITÀ' && ctx.banishFromGraveyard(ctx.owner, grave[i])) {
                    removed++;
                }
            }
            // Necrovalley (id 890): il costo (bandire 2 OSCURITÀ dal
            // Cimitero) non è stato pagato per intero — l'effetto non si
            // risolve, niente auto-bando fino alla End Phase.
            if (removed < 2) return;
            const banished = sourceSlot.card;
            if (blockBanishFromField(ctx, banished)) return;
            field[ctx.index] = null;
            ctx.banishTemporarily(ctx.owner, banished, 'endphase');
            ctx.log("🥷 Ninja Fulmineo bandisce 2 mostri OSCURITÀ dal Cimitero e si bandisce fino alla End Phase!");
        }
    });

    // ================================================================
    // 467 — Il Demone Megacyber (Special Summon dalla mano)
    // Se il tuo avversario controlla almeno 2 mostri in più di te, puoi
    // Special Summonare questa carta dalla tua mano.
    // ================================================================
    CardEffects.register(467, {
        canSpecialSummonFromHand(ctx) {
            const own = ctx.field(ctx.owner).filter((slot) => slot).length;
            const opp = ctx.field(ctx.opponent).filter((slot) => slot).length;
            return opp - own >= 2;
        }
    });

// ================================================================
    // 471 — L'Amazzone Ostile / The Wicked Amazon (onStandbyPhase)
    // Sacrifica 1 tuo mostro sul Terreno (esclusa questa carta) durante
    // ciascuna tua Standby Phase. Se non lo fai, questa carta viene
    // distrutta. SEMPLIFICAZIONE: sacrifica automaticamente il primo
    // altro mostro trovato (il "puoi" reale diventa automatico, come
    // altre carte con la stessa struttura); se non c'è nessun altro
    // mostro, si autodistrugge.
    // ================================================================
    CardEffects.register(471, {
        onStandbyPhase(ctx) {
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot, i) => slot && i !== ctx.slotIndex);
            if (index === -1) {
                ctx.destroyMonster(ctx.owner, ctx.slotIndex);
                ctx.log("👸 L'Amazzone Scorbutica non ha nessun altro mostro da sacrificare: si distrugge da sola!");
                return;
            }
            const sacrificed = field[index];
            field[index] = null;
            ctx.graveyard(ctx.owner).push(sacrificed.card);
            ctx.log(`👸 L'Amazzone Scorbutica sacrifica ${sacrificed.card.name} durante la Standby Phase!`);
        }
    });

    // ================================================================
    // 474 — Mille Coltelli / Thousand Knives (Magia Normale)
    // Se controlli "Mago Nero" (id 2): distruggi 1 mostro dell'avversario.
    // ================================================================
    CardEffects.register(474, {
        declaredTargeting: { count: 1, cardType: 'monster' },
        canActivate(ctx) {
            const hasDarkMagician = ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.id === 2);
            if (!hasDarkMagician) return false;
            return ctx.field(ctx.opponent).some((slot) => slot && !slot.isFaceDown);
        },
        activate(ctx) {
            const candidati = collectFieldTargets(ctx, { zone: 'monster', owner: 'opponent' });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🗡️ Mille Coltelli',
                text: 'Scegli quale mostro avversario distruggere.'
            }, (scelto) => {
                ctx.declareTargetWaiting(scelto.owner, scelto.index, { totalTargetCount: 1 }, (decl) => {
                    if (!decl.allowed) return;
                    const target = ctx.field(decl.targetOwner)[decl.targetIndex];
                    const name = target ? target.card.name : scelto.card.name;
                    ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                    ctx.log(`🗡️ Mille Coltelli distrugge ${name}!`);
                });
            });
        }
    });

    // ================================================================
    // 472 — Il Drago Alato di Ra / The Winged Dragon of Ra (uno dei 3 Dei
    // Egizi)
    // Testo ufficiale verificato di nuovo su Yugipedia (testo inglese
    // corrente + traduzioni ufficiali IT/FR/DE/PT/ES, tutte concordi):
    // "Non può essere Evocato Specialmente. Richiede 3 Tributi per essere
    // Evocato Normalmente (non può essere Posizionato Normalmente).
    // L'Evocazione Normale di questa carta non può essere annullata.
    // Quando viene Evocato Normalmente, non possono essere attivate altre
    // carte o effetti. Quando questa carta viene Evocata Normalmente:
    // puoi pagare LP fino a che te ne rimangono solo 100; questa carta
    // guadagna ATK/DEF pari all'ammontare di LP pagati. Puoi pagare 1000
    // LP, poi scegliere come bersaglio 1 mostro sul Terreno; distruggi
    // quel bersaglio." A differenza di Obelisk (id 30), Ra NON ha la
    // clausola "nessun giocatore può scegliere come bersaglio questa
    // carta con gli effetti delle carte" — CORREZIONE: un precedente
    // aggiornamento di questo file gliel'aveva attribuita per analogia
    // con Obelisk senza riverificare il testo specifico di Ra (rimosso
    // sia cannotBeTargetedByCardEffects qui sotto sia la frase
    // corrispondente nell'effect text di cards.json).
    // ATK/DEF stampati sono "?": card.attack/defense nel database sono 0,
    // il vero valore è dato SOLO dall'effetto (niente "somma dei mostri
    // sacrificati": quella era la versione anime/non ufficiale, corretta
    // dopo verifica).
    // SEMPLIFICAZIONE: il pagamento LP-fino-a-100 è sempre applicato per
    // intero (nessuna interfaccia per pagare meno, e nessun modo di
    // rifiutarlo — il testo reale lo rende opzionale con "puoi", ma è
    // sempre vantaggioso per il proprietario, che parte comunque da 0/0,
    // quindi l'esecuzione automatica non cambia mai l'esito). Il
    // bersaglio dell'Ignition è scelto da sola (il più forte disponibile
    // dell'avversario, priorità a quelli scoperti) invece di un'interfaccia
    // di selezione dedicata, e limitato al campo avversario (il testo
    // reale non lo vieta, ma nessun caso di questo dataset trarrebbe
    // beneficio dal colpire il proprio campo). "L'Evocazione Normale non
    // può essere annullata" non ha bisogno di codice: nessuna carta di
    // questo dataset nega mai un'Evocazione (il motore non ha ancora quel
    // meccanismo per NESSUNA carta), quindi la clausola è già rispettata
    // per costruzione. blocksActivationsOnOwnNormalSummon (niente
    // finestra di risposta alla propria Evocazione Normale, vedi
    // duel-engine.js/fireTrigger) SÌ è implementata, condivisa con gli
    // altri 2 Dei Egizi.
    // ================================================================
    CardEffects.register(472, {
        cannotBeSpecialSummoned: true,
        cannotBeSet: true,
        blocksActivationsOnOwnNormalSummon: true,
        onSummon(ctx) {
            // CORREZIONE: usava ctx.card, che qui è sempre undefined — il
            // ctx passato al self-handler da fireTrigger (duel-engine.js)
            // espone la carta appena Evocata come ctx.summonedCard, non
            // ctx.card (quel nome è riservato a chi RISPONDE a un trigger).
            // Nella vera partita questo faceva fallire silenziosamente
            // l'intero effetto ogni volta che Ra veniva Evocato Normalmente
            // — mascherato nei test perché costruivano un ctx "a mano" con
            // {card: ra}, bypassando fireTrigger.
            if (ctx.summonedVia !== 'normal') return;
            if (gameState.ancientChantRaBoostTurnFor
                && gameState.ancientChantRaBoostTurnFor[ctx.owner] === gameState.turn
                && Array.isArray(ctx.summonedCard._tributedOriginalStats)) {
                const totals = ctx.summonedCard._tributedOriginalStats.reduce((sum, stats) => ({
                    attack: sum.attack + (stats.attack || 0),
                    defense: sum.defense + (stats.defense || 0)
                }), { attack: 0, defense: 0 });
                ctx.summonedCard.ancientChantOriginalStats = totals;
                gameState.ancientChantRaBoostTurnFor[ctx.owner] = null;
                ctx.log(`☀️ Canto Antico conferisce a Ra ${totals.attack} ATK e ${totals.defense} DEF originali!`);
            }
            // "Puoi pagare..." — non automatico: card._raPayLp arriva dalla
            // scelta del giocatore (maybeAskRaLpChoice, actions.js) o
            // dall'euristica del bot (botSummonMonster, bot.js). Se manca
            // (es. un test/sandbox che chiama questo handler direttamente
            // senza passare da quei punti) il default resta "paga", lo
            // stesso comportamento di sempre.
            if (ctx.summonedCard._raPayLp === false) return;
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            const currentLp = gameState[lpKey];
            if (currentLp <= 100) return;
            const paid = currentLp - 100;
            gameState[lpKey] = 100;
            ctx.summonedCard.raPaidLp = paid;
            ctx.log(`☀️ Il Drago Alato di Ra: Life Points pagati fino a restare a 100! Guadagna ${paid} ATK/DEF.`);
        },
        static(ctx) {
            const bonus = ctx.card.raPaidLp || 0;
            const chant = ctx.card.ancientChantOriginalStats || { attack: 0, defense: 0 };
            gameState.atkDefBonus[ctx.card.uid] = { atk: bonus + chant.attack, def: bonus + chant.defense };
        },
        canActivate(ctx) {
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            if (gameState[lpKey] < 1000) return false;
            return ctx.field(ctx.opponent).some((slot) => slot);
        },
        activate(ctx) {
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            const field = ctx.field(ctx.opponent);
            let targetIndex = -1;
            let bestAtk = -1;
            field.forEach((slot, i) => {
                if (!slot) return;
                const a = slot.isFaceDown ? 0 : DuelEngine.getEffectiveAtk(slot.card);
                if (a >= bestAtk) { bestAtk = a; targetIndex = i; }
            });
            if (targetIndex === -1) return;
            const decl = ctx.declareTarget(ctx.opponent, targetIndex, { totalTargetCount: 1 });
            if (!decl.allowed) return;
            const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
            if (!finalSlot) return;
            gameState[lpKey] -= 1000;
            const name = finalSlot.isFaceDown ? 'una carta coperta' : finalSlot.card.name;
            ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
            ctx.log(`☀️ Il Drago Alato di Ra paga 1000 Life Points e distrugge ${name}!`);
        }
    });

    // ================================================================
    // 487 — Mondo dei Toon / Toon World (deroga anime controllata).
    // Niente costo iniziale e niente autodistruzione a cascata: finché è
    // scoperta, ogni Toon può attaccare direttamente. La protezione da
    // 500 LP una volta per turno è centralizzata nel motore perché deve
    // intercettare sia battaglia sia effetti. L'effetto ufficiale storico
    // resta in data/cards.json (`legacyOfficialEffect`), non mostrato UI.
    CardEffects.register(487, {
        continuous: true,
        // Una seconda copia scoperta e' lecita, ma per l'IA e' soltanto
        // uno spreco. Il contratto e' condiviso da tutti i livelli IA.
        aiCanActivate(ctx) {
            return !Tavolo.magieTrappole(ctx.owner).some((slot) => slot
                && !slot.isFaceDown && slot.card && slot.card.id === 487);
        },
        // Anche un effetto puramente continuo deve esporre `activate`: è il
        // contratto usato da DuelEngine.canActivate per distinguere una
        // carta giocabile da una carta priva di implementazione. Il corpo è
        // volutamente vuoto perché l'attivazione si limita a lasciare Mondo
        // dei Toon scoperto sul Terreno; i vantaggi vengono ricalcolati da
        // static() finché la carta rimane presente.
        activate() {},
        static(ctx) {
            ctx.field(ctx.owner).forEach((slot) => {
                if (!slot || slot.isFaceDown) return;
                const def = DuelEngine.getDefinition(slot.card.id);
                if ((def && def.isToon) || /Toon/i.test(slot.card.name || '')) {
                    gameState.directAttackAllowedUids[slot.card.uid] = true;
                }
            });
        }
    });

    // ================================================================
    // 484 — Sirena Toon: con Mondo apre gratuitamente soltanto un campo
    // vuoto; senza Mondo resta una normale Evocazione di Livello 4. I
    // vantaggi offensivi arrivano dallo static di Mondo, non dalla carta.
    // ================================================================
    CardEffects.register(484, {
        isToon: true,
        mustTargetFilterIfPresent(card, owner) {
            const hasWorld = DuelEngine.hasActiveToonWorld(owner);
            return hasWorld && card.type === 'monster' && ((DuelEngine.getDefinition(card.id)?.isToon) || /Toon/i.test(card.name || ''));
        },
        canSpecialSummonFromHand(ctx) {
            const hasWorld = DuelEngine.hasActiveToonWorld(ctx.owner);
            return hasWorld && ctx.field(ctx.owner).every((slot) => !slot);
        }
    });

    // ================================================================
    // 486 — Teschio Evocato Toon: normalmente segue il proprio Livello;
    // con Mondo può invece entrare dalla mano sacrificando un Toon.
    // Sceglie il Sacrificio tramite un'interfaccia dedicata: nuovo hook
    // generico getSpecialSummonSacrificeCandidates(ctx) (letto SOLO in
    // actions.js, PRIMA di chiamare DuelEngine.trySpecialSummonFromHand,
    // che resta sincrona come per ogni altra carta con
    // paySpecialSummonCost — nessuna modifica alla sua firma/agli altri
    // 17 usi nel dataset). Il click apre il picker e salva la scelta in
    // gameState.pendingSpecialSummonSacrificeUid; paySpecialSummonCost la
    // legge e la consuma, con fallback al primo Toon trovato se
    // assente — copre sia il bot (mai apre un picker) sia una chiamata
    // diretta da test/console senza passare dal click UI.
    // ================================================================
    CardEffects.register(486, {
        isToon: true,
        mustTargetFilterIfPresent(card, owner) {
            const hasWorld = DuelEngine.hasActiveToonWorld(owner);
            return hasWorld && card.type === 'monster' && ((DuelEngine.getDefinition(card.id)?.isToon) || /Toon/i.test(card.name || ''));
        },
        canSpecialSummonFromHand(ctx) {
            const hasToonWorld = DuelEngine.hasActiveToonWorld(ctx.owner);
            const hasSacrifice = ctx.field(ctx.owner).some((slot) => slot && ((DuelEngine.getDefinition(slot.card.id)?.isToon) || /Toon/i.test(slot.card.name || '')));
            return hasToonWorld && hasSacrifice;
        },
        getSpecialSummonSacrificeCandidates(ctx) {
            return ctx.field(ctx.owner)
                .map((slot, index) => (slot && ((DuelEngine.getDefinition(slot.card.id)?.isToon) || /Toon/i.test(slot.card.name || '')) ? { index: index, card: slot.card } : null))
                .filter(Boolean);
        },
        paySpecialSummonCost(ctx) {
            const field = ctx.field(ctx.owner);
            const pendingUid = gameState.pendingSpecialSummonSacrificeUid;
            gameState.pendingSpecialSummonSacrificeUid = null;
            const isToon = (slot) => slot && ((DuelEngine.getDefinition(slot.card.id)?.isToon) || /Toon/i.test(slot.card.name || ''));
            let index = pendingUid ? field.findIndex((slot) => isToon(slot) && slot.card.uid === pendingUid) : -1;
            if (index === -1) index = field.findIndex(isToon);
            if (index === -1) return false;
            ctx.graveyard(ctx.owner).push(field[index].card);
            const sacrificedName = field[index].card.name;
            field[index] = null;
            ctx.log(`👻 Teschio Evocato Toon sacrifica ${sacrificedName} per essere Special Summonato!`);
            return true;
        }
    });

    // ================================================================
    // 490 — Tributo Torrenziale / Torrential Tribute (Trappola Normale,
    // risposta a un'Evocazione — come Buco Trappola, id 40)
    // Quando l'avversario Evoca un mostro: distruggi tutti i mostri sul
    // Terreno, di entrambi i giocatori.
    // SEMPLIFICAZIONE: l'effetto reale risponde a QUALSIASI Evocazione,
    // inclusa la propria — qui, come per Buco Trappola, risponde solo a
    // un'Evocazione dell'avversario (stesso schema delle finestre di
    // risposta di questo motore).
    // ================================================================
    CardEffects.register(490, {
        onOpponentSummon(ctx) {
            if (window.FX && typeof FX.playTorrentialTribute === 'function') {
                FX.playTorrentialTribute();
            }
            ctx.destroyAllMonsters();
            ctx.log(`🌊 Tributo Torrenziale distrugge tutti i mostri sul Terreno!`);
        }
    });

    // ================================================================
    // 492 — Tributo ai Dannati / Tribute to the Doomed (Magia Normale)
    // Scarta 1 carta dalla mano, poi distruggi 1 mostro dell'avversario.
    // SEMPLIFICAZIONE residua: la carta reale può bersagliare qualsiasi
    // mostro sul Terreno (anche un proprio mostro coperto) — qui sceglie
    // sempre un mostro scoperto dell'avversario. La carta da scartare è
    // invece ora una vera scelta (offerHandDiscardChoice), non più sempre
    // la prima in mano — bug reale corretto in questa sessione.
    // ================================================================
    CardEffects.register(492, {
        declaredTargeting: { count: 1, cardType: 'monster' },
        canActivate(ctx) {
            // Serve un'ALTRA carta da scartare: vedi otherHandCards.
            if (otherHandCards(ctx).length === 0) return false;
            return ctx.field(ctx.opponent).some((slot) => slot && !slot.isFaceDown);
        },
        activate(ctx) {
            offerHandDiscardChoice(ctx, {
                title: '⚰️ Tributo al Dannato',
                text: 'Scegli quale carta scartare dalla mano.'
            }, (discarded) => {
                const field = ctx.field(ctx.opponent);
                const index = field.findIndex((slot) => slot && !slot.isFaceDown);
                if (index === -1) return;
                ctx.declareTargetWaiting(ctx.opponent, index, { totalTargetCount: 1 }, (decl) => {
                    if (!decl.allowed) return;
                    const target = ctx.field(decl.targetOwner)[decl.targetIndex];
                    const name = target ? target.card.name : field[index].card.name;
                    ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                    ctx.log(`⚰️ Tributo al Dannato scarta ${discarded.name} e distrugge ${name}!`);
                });
            });
        }
    });

    // ================================================================
    // 506 — Rituale del Drago Bianco / White Dragon Ritual (Magia
    // Rituale)
    // Sacrifica mostri dal Terreno per un Livello totale di almeno 4,
    // poi Special Summon Paladino del Drago Bianco (id 398) dalla mano.
    // SEMPLIFICAZIONE: sceglie da sola quali mostri sacrificare, stesso
    // spirito di Rito del Guerriero Nero (id 56). Manca anche la
    // possibilità di sacrificare dalla mano oltre che dal Terreno.
    // ================================================================
    CardEffects.register(506, {
        canActivate(ctx) {
            const handIndex = ctx.hand(ctx.owner).findIndex((c) => c.id === 398);
            return handIndex !== -1 && maxRitualTributeLevel(ctx, handIndex) >= 4;
        },
        activate(ctx) {
            const hand = ctx.hand(ctx.owner);
            const handIndex = hand.findIndex((c) => c.id === 398);
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
                ctx.log('⚠️ Il Terreno è pieno: Paladino del Drago Bianco finisce nel Cimitero.');
                return;
            }
            ctx.specialSummon(ctx.owner, ritualCard, slotIndex, 'attack', 'hand');
            ctx.log('🐲 Rituale del Drago Bianco evoca Paladino del Drago Bianco!');
        }
    });

    // ================================================================
    // 398 — Paladino del Drago Bianco / White Paladin, Ballista Dragon
    // Evocabile Rituale solo tramite "Rituale del Drago Bianco" (id 506,
    // qui sopra — GIÀ IMPLEMENTATA per intero: la nota precedente
    // affermava erroneamente che non esistesse in questo database).
    // All'inizio del Damage Step, se attacca un mostro coperto in
    // Posizione di Difesa: lo distrugge senza calcolo dei danni (caso
    // speciale isolato in resolveBattleDamage, actions.js — vedi id 398
    // lì). Effetto Ignition: sacrifica questa carta per Special Summon
    // "Drago Bianco Occhi Blu" (id 1) dalla mano o dal Deck, che non può
    // attaccare per il resto del turno (gameState.cannotAttackUidsThisTurn,
    // stesso meccanismo di Obelisk il Tormentatore id 30).
    // ================================================================
    CardEffects.register(398, {
        cannotNormalSummon: true,
        cannotBeSpecialSummoned: true,
        instantlyDestroysFaceDownDefender: true,
        canActivate(ctx) {
            const hand = ctx.hand(ctx.owner);
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            return hand.some((c) => c.id === 1) || (Array.isArray(deck) && deck.some((c) => c.id === 1));
        },
        activate(ctx) {
            const hand = ctx.hand(ctx.owner);
            let index = hand.findIndex((c) => c.id === 1);
            let source = 'hand';
            let card = index !== -1 ? hand[index] : null;
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            if (!card && Array.isArray(deck)) {
                index = deck.findIndex((c) => c.id === 1);
                if (index !== -1) { card = deck[index]; source = 'deck'; }
            }
            if (!card) return;
            const field = ctx.field(ctx.owner);
            field[ctx.index] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            if (source === 'hand') {
                hand.splice(index, 1);
            } else {
                deck.splice(index, 1);
                gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
            }
            ctx.specialSummon(ctx.owner, card, ctx.index, 'attack', source);
            // CORREZIONE di fedeltà: il divieto d'attacco vale per TUTTI i
            // "Drago Bianco Occhi Blu" che si controllano (id 1), non solo
            // per la copia appena Special Summonata.
            gameState.cannotAttackUidsThisTurn = gameState.cannotAttackUidsThisTurn || new Set();
            ctx.field(ctx.owner).forEach((slot) => {
                if (slot && !slot.isFaceDown && slot.card.id === 1) gameState.cannotAttackUidsThisTurn.add(slot.card.uid);
            });
            ctx.log('🐉 Paladino del Drago Bianco si sacrifica: Special Summon Drago Bianco Occhi Blu — nessun "Drago Bianco Occhi Blu" può attaccare questo turno!');
        }
    });

    // ================================================================
    // 508 — Strega della Foresta Nera / Witch of the Black Forest (onDestroy)
    // Quando questa carta viene mandata dal Terreno al Cimitero: puoi
    // aggiungere alla mano 1 mostro con 1500 o meno DEF dal Deck — stesso
    // meccanismo di Sangan (id 433, ora con vera scelta tramite
    // searchDeckWithChoice), ma per DEF invece che ATK.
    // ================================================================
    // CORREZIONE di fedeltà: stessa restrizione da errata di Sangan (id
    // 433) qui sopra, stessa approssimazione "una volta per turno per nome".
    CardEffects.register(508, {
        onDestroy(ctx) {
            if (ctx.hasUsedOncePerTurn(`witch-black-forest-name:${ctx.owner}`)) return;
            const opened = searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.defense <= 1500, {
                title: '🧙 Strega della Foresta Nera',
                text: 'Scegli quale mostro (1500 DEF o meno) aggiungere alla mano dal Deck.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`🧙 Strega della Foresta Nera aggiunge ${card.name} alla mano dal Deck!`);
            });
            if (opened) ctx.markUsedOncePerTurn(`witch-black-forest-name:${ctx.owner}`);
        }
    });

})();
