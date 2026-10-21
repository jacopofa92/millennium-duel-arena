/**
 * card-effects-1.js — Effetti delle carte, parte 1 di 8.
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

    const { attendiScelta, chooseOption, blockBanishFromField, isHarpieLadySupport, findEquipTarget, equipToChosenTarget, riprendiDalCimitero, attachEquip, equippedTarget, searchDeckWithChoice, maxRitualTributeLevel, performRitualTribute, findPetitMothReadyForCocoonSummon, grantAttackAllEnemiesOncEach, chooseCardFromList, searchGraveyardWithChoice, collectFieldTargets, chooseFieldCardTarget, destroyTargetingSpellIfItStays } = window.CardEffectsShared;

    // ================================================================
    // 110 — Drago Berserk / Berserk Dragon
    // Deve essere Special Summonato tramite "Un Accordo con l'Arcidemone"
    // (id 78, già registrata: chiama ctx.specialSummon direttamente, non
    // bloccato da cannotBeSpecialSummoned qui sotto — stesso schema già
    // usato per Cavaliere del Miraggio id 381) e non può esserlo in
    // altro modo. Può attaccare tutti i mostri dell'avversario, una
    // volta ciascuno — stesso identico meccanismo/stessa SEMPLIFICAZIONE
    // di Tiranno Definitivo (id 807: nessun tracciamento di QUALE mostro
    // avversario sia già stato colpito, il conteggio "fotografa" il
    // massimo visto in questo turno dentro onOwnAttackDeclare). Ad ogni
    // propria End Phase: perde 500 ATK (permanente, non un bonus
    // temporaneo — stesso stile diretto di Drago Megaroccia id 763).
    // ================================================================
    CardEffects.register(110, {
        cannotNormalSummon: true,
        cannotBeSpecialSummoned: true,
        onOwnAttackDeclare(ctx) {
            const self = ctx.field(ctx.owner)[ctx.attackerIndex].card;
            const enemyCount = ctx.field(ctx.opponent).filter((s) => s).length;
            if (self.__berserkDragonSnapshotTurn !== gameState.turn) {
                self.__berserkDragonSnapshotTurn = gameState.turn;
                self.__berserkDragonMaxEnemyCount = enemyCount;
            } else if (enemyCount > self.__berserkDragonMaxEnemyCount) {
                self.__berserkDragonMaxEnemyCount = enemyCount;
            }
        },
        getExtraAttackCount(ctx) {
            return Math.max(0, (ctx.card.__berserkDragonMaxEnemyCount || 0) - 1);
        },
        onEndPhase(ctx) {
            ctx.card.attack = Math.max(0, (ctx.card.attack || 0) - 500);
            ctx.log(`🐉 Drago Berserk perde 500 ATK (ora ${ctx.card.attack})!`);
        }
    });

    // ================================================================
    // 111 — Anima del Berserker / Berserker Soul (Magia Rapida)
    // Quando un tuo mostro infligge 1500 o meno danni con un attacco
    // diretto: scarta tutta la mano (min. 1); scava la prima carta del
    // Deck e, se è un mostro, mandala al Cimitero e infliggi 500 danni,
    // poi ripeti fino a 7 volte o finché non scopri una carta non-
    // mostro (rimessa in cima al Deck). Una volta per turno. Stesso
    // schema di Benedizione di Sebek (id 813): legge
    // gameState.directAttackDamageFor[ctx.owner] (impostato in
    // resolveAttack/actions.js) invece di un vero aggancio reattivo "nel
    // momento", dato che il testo reale non richiede una risposta
    // immediata, solo che l'attacco diretto sia già accaduto in questo
    // turno. "Cima del Deck" = fine dell'array (stesso verso di
    // drawCardsToHand/pop, game-flow.js).
    // ================================================================
    CardEffects.register(111, {
        canActivate(ctx) {
            const dmg = gameState.directAttackDamageFor && gameState.directAttackDamageFor[ctx.owner];
            if (!dmg || dmg > 1500) return false;
            if (ctx.hasUsedOncePerTurn(`111:${ctx.owner}`)) return false;
            return Array.isArray(Tavolo.mazzo(ctx.owner));
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`111:${ctx.owner}`);
            const hand = ctx.hand(ctx.owner);
            // Scarta 1 carta alla volta (indice 0 ripetuto, non uno slice unico)
            // così ogni carta passa da discardChosenFromHand e innesca
            // onSentToGraveyardFromHand individualmente (es. id 781, che si
            // rimescola nel Deck invece di restare nel Cimitero).
            const discarded = [];
            while (hand.length > 0) discarded.push(ctx.discardChosenFromHand(ctx.owner, 0));
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const countKey = Tavolo.chiave(ctx.owner, 'DeckCount');
            const deck = gameState[deckKey];
            let monsters = 0;
            for (let i = 0; i < 7 && deck.length > 0; i++) {
                const card = deck.pop();
                if (card.type === 'monster') {
                    ctx.graveyard(ctx.owner).push(card);
                    ctx.dealDamage(ctx.opponent, 500);
                    monsters++;
                } else {
                    deck.push(card);
                    break;
                }
            }
            gameState[countKey] = deck.length;
            ctx.log(`💀 Anima Furente scarta ${discarded.length} cart${discarded.length === 1 ? 'a' : 'e'} e scava ${monsters} mostr${monsters === 1 ? 'o' : 'i'} dal Deck: ${monsters * 500} danni!`);
        }
    });

    // ================================================================
    // CARTE EQUIPAGGIAMENTO — raggruppate qui tutte insieme (invece che
    // sparse per id come il resto del file) perché condividono lo stesso
    // schema: continuous:true + canActivate/activate con
    // findEquipTarget/attachEquip + isEquip:true + static() che applica il
    // bonus tramite gameState.atkDefBonus. Per le carte con un secondo
    // effetto più complesso (es. Falce del Mietitore, non presente in
    // questo database la carta a cui è vincolata) si implementa solo il
    // bonus ATK/DEF di base, documentato caso per caso.
    // ================================================================

    // 117 — Ciondolo Nero / Black Pendant: +500 ATK, qualsiasi mostro.
    // SEMPLIFICAZIONE: manca "quando mandata al Cimitero: 500 danni".
    CardEffects.register(117, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx); },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 500, def: e.def };
        },
        // "Quando questa carta viene mandata dal Terreno al Cimitero:
        // infliggi 500 danni all'avversario." Il percorso più comune è il
        // mostro equipaggiato che muore in battaglia e si porta dietro
        // l'equip — vedi notifySpellTrapSentToGraveyardFromField in
        // duel-engine.js, l'aggancio che prima non esisteva.
        onSentToGraveyardFromField(ctx) {
            ctx.log(`💥 ${ctx.card.name} infligge 500 danni andando al Cimitero!`);
            ctx.dealDamage(ctx.opponent, 500);
        }
    });

    // 127 — Libro delle Arti Segrete / Book of Secret Arts: +300 ATK/+300 DEF, solo Incantatore.
    CardEffects.register(127, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.race === 'Incantatore') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.race === 'Incantatore'); },
        isEquip: true,
        // Bersaglio idoneo per Potere Raccolto (id 160): se questa Magia
        // Equipaggiamento finisce (ri)equipaggiata a un mostro che non
        // soddisfa questa condizione, va distrutta — vedi
        // equipTargetFilter/unionTargetFilter in card-effects.js.
        equipTargetFilter: (c) => c.race === 'Incantatore',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 300, def: e.def + 300 };
        }
    });

    // 135 — Pugnale Farfalla - Elma: +300 ATK, qualsiasi mostro.
    // SEMPLIFICAZIONE: manca "quando mandata al Cimitero: puoi farla tornare in mano".
    CardEffects.register(135, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx); },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 300, def: e.def };
        },
        // "Quando questa carta viene mandata dal Terreno al Cimitero:
        // rimettila in mano." È la clausola che rende Elma una carta
        // riutilizzabile all'infinito: senza, era un equip qualunque.
        onSentToGraveyardFromField(ctx) {
            if (riprendiDalCimitero(ctx, 'mano')) {
                ctx.log(`🗡️ ${ctx.card.name} torna in mano invece di restare nel Cimitero.`);
            }
        }
    });

    // 145 — Spada Celeste - Eatos / Sky Sword - Eatos: +500 ATK, qualsiasi mostro.
    // SEMPLIFICAZIONE: manca la clausola legata a "Guardiano Eatos", non presente in questo database.
    CardEffects.register(145, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx); },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 500, def: e.def };
        }
    });

    // ================================================================
    // 174 — Predone Cyber / Cyber Raider
    // Se questa carta viene Evocata: attiva 1 di questi effetti — distruggi
    // 1 Magia Equipaggiamento sul Terreno (di uno qualunque dei due
    // giocatori), oppure equipaggiala a questa carta. "Rubare" un Equip
    // NON sposta la carta di zona: resta nella casella Magia/Trappola di
    // chi l'aveva attivata (il suo Cimitero di destinazione futuro non
    // cambia), cambia solo il puntatore equippedToOwner/Index/Uid verso
    // Predone Cyber — esattamente i 3 campi che attachEquip() imposta per
    // un'attivazione normale, qui riassegnati direttamente.
    // ================================================================
    CardEffects.register(174, {
        onSummon(ctx) {
            const candidates = [];
            Tavolo.ordine().forEach((owner) => {
                ctx.stField(owner).forEach((slot, index) => {
                    if (slot && !slot.isFaceDown && slot.card.type === 'spell' && slot.card.subtype === 'equip') {
                        candidates.push({ owner, index, card: slot.card });
                    }
                });
            });
            if (candidates.length === 0) return;

            const destroy = (choice) => {
                ctx.graveyard(choice.owner).push(choice.card);
                ctx.stField(choice.owner)[choice.index] = null;
                ctx.log(`💥 Predone Cibernetico distrugge ${choice.card.name}!`);
            };
            const steal = (choice) => {
                choice.card.equippedToOwner = ctx.owner;
                choice.card.equippedToIndex = ctx.summonedSlotIndex;
                choice.card.equippedToUid = ctx.summonedCard.uid;
                ctx.log(`🔧 Predone Cibernetico ruba ${choice.card.name} e la equipaggia a sé stesso!`);
            };

            if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                // IA: preferisce rubare una Carta Equipaggiamento
                // dell'avversario (doppio vantaggio: la toglie a lui E la
                // usa lei), altrimenti distrugge la prima disponibile.
                const enemyOne = candidates.find((c) => c.owner === ctx.opponent);
                if (enemyOne) steal(enemyOne); else destroy(candidates[0]);
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates.map((c) => c.card),
                titolo: '🤖 Predone Cibernetico',
                testo: 'Scegli 1 Carta Equipaggiamento sul Terreno: poi decidi se distruggerla o rubarla.'
            }, (card) => {
                if (card === null) return;
                const choice = candidates.find((c) => c.card.uid === card.uid);
                Decisioni.chiedi({
                    chi: ctx.owner,
                    tipo: 'coppia',
                    titolo: choice.card.name,
                    candidati: [
                        { label: 'Distruggi', icon: '💥', onSelect: () => destroy(choice) },
                        { label: 'Rubala', icon: '🔧', onSelect: () => steal(choice) }
                    ]
                }, (scelta) => {
                    if (scelta) scelta.onSelect();
                });
            });
        }
    });

    // 175 — Scudo Cyber / Cyber Shield: +500 ATK, solo "Lady Arpia" (id 288, incluso Arpia Cyber id 172 — vedi isHarpieLadySupport) o "Sorelle Arpie" (id 290).
    CardEffects.register(175, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => isHarpieLadySupport(c) || c.id === 290) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => isHarpieLadySupport(c) || c.id === 290); },
        isEquip: true,
        equipTargetFilter: (c) => isHarpieLadySupport(c) || c.id === 290,
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 500, def: e.def };
        }
    });

    // ================================================================
    // 178 — Laser Ciclone / Cyclon Laser (Equipaggiamento, solo Gradius
    // id 274)
    // +300 ATK e danno da battaglia perforante (gameState.piercingUidsFor,
    // stesso meccanismo già usato da Impatto Meteora Fatato id 233 qui
    // sotto) — nel testo reale la perforazione si applica solo quando
    // l'ATK equipaggiato supera la DEF del bersaglio, ma è esattamente
    // la condizione generale con cui la perforazione già scatta in
    // questo motore (mai quando ATK <= DEF), quindi nessuna clausola in
    // più da scrivere qui.
    // ================================================================
    CardEffects.register(178, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.id === 274) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.id === 274); },
        isEquip: true,
        equipTargetFilter: (c) => c.id === 274,
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 300, def: e.def };
            gameState.piercingUidsFor[ctx.owner].add(t.uid);
        }
    });

    // ================================================================
    // 179 — Guerriero D.D. / D.D. Warrior (onBattled)
    // Dopo il calcolo dei danni, se questa carta ha combattuto ed è
    // sopravvissuta alla battaglia (niente "ultima informazione nota" se
    // perde lo scontro, stessa SEMPLIFICAZIONE di Ryu Kokki id 663):
    // bandisce (zona Bandite, ctx.banish — rimozione diretta dal Terreno,
    // NON tramite ctx.destroyMonster: bandire non è "distruggere", niente
    // trigger ON_DESTROY) sia se stessa sia il mostro avversario con cui
    // ha combattuto. Se l'avversario è già stato distrutto dal normale
    // esito della battaglia, non c'è nulla da bandire in più: già andato
    // al Cimitero, stesso risultato pratico visibile.
    // ================================================================
    CardEffects.register(179, {
        onBattled(ctx) {
            if (ctx.opponentSurvived) {
                const oppField = ctx.field(ctx.opponent);
                const oppIdx = oppField.findIndex((s) => s && s.card.uid === ctx.opponentCard.uid);
                if (oppIdx !== -1 && !blockBanishFromField(ctx, oppField[oppIdx].card)) {
                    const oppCard = oppField[oppIdx].card;
                    oppField[oppIdx] = null;
                    ctx.banish(ctx.opponent, oppCard);
                    ctx.log(`⚔️ Guerriero D.D. bandisce ${ctx.opponentCard.name}!`);
                }
            }
            const ownField = ctx.field(ctx.owner);
            const ownIdx = ownField.findIndex((s) => s && s.card.uid === ctx.card.uid);
            if (ownIdx !== -1 && !blockBanishFromField(ctx, ctx.card)) {
                ownField[ownIdx] = null;
                ctx.banish(ctx.owner, ctx.card);
                ctx.log('⚔️ Guerriero D.D. bandisce se stesso dopo aver combattuto!');
            }
        }
    });

    // 208 — Artigli di Drago: +600 ATK, solo OSCURITÀ.
    // CORREZIONE di fedeltà: aggiunta la clausola mancante "non può
    // essere distrutto dagli effetti delle carte dell'avversario" —
    // nuovo gameState.cannotBeDestroyedByCardEffectUids (duel-engine.js,
    // vedi il commento lì), variante per-ISTANZA (uid) del già esistente
    // def.cannotBeDestroyedByCardEffect (per-DEFINIZIONE, es. Exodia
    // Necross id 230) — si applica/toglie da sola seguendo la presenza
    // dell'Equip, ricalcolata ad ogni render come atkDefBonus qui sotto.
    CardEffects.register(208, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.attribute === 'OSCURITÀ') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.attribute === 'OSCURITÀ'); },
        isEquip: true,
        equipTargetFilter: (c) => c.attribute === 'OSCURITÀ',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 600, def: e.def };
            gameState.cannotBeDestroyedByCardEffectUids = gameState.cannotBeDestroyedByCardEffectUids || {};
            gameState.cannotBeDestroyedByCardEffectUids[t.uid] = true;
        }
    });

    // 225 — Luce dell'Elfo / Elf's Light: +400 ATK/-200 DEF, solo LUCE.
    CardEffects.register(225, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.attribute === 'LUCE') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.attribute === 'LUCE'); },
        isEquip: true,
        equipTargetFilter: (c) => c.attribute === 'LUCE',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 400, def: e.def - 200 };
        }
    });

    // ================================================================
    // 276 — Tombarolo / Graverobber (Trappola Normale)
    // Sceglie 1 Magia Normale/Rapida dal Cimitero dell'avversario (auto:
    // la prima trovata che può davvero attivarsi ORA, dal punto di vista
    // di ctx.owner) e la usa SUBITO come parte della risoluzione di
    // questa stessa carta, chiamando direttamente il proprio def.activate
    // della carta scelta con un ctx costruito per ctx.owner — poi infligge
    // 2000 danni. La carta presa in prestito non lascia mai fisicamente il
    // Cimitero dell'avversario (resta lì, comunque "usata" concettualmente).
    // SEMPLIFICAZIONE: il testo reale la rende utilizzabile "fino a fine
    // turno" (un'attivazione manuale successiva, a scelta del giocatore) —
    // qui invece si usa immediatamente come parte dell'attivazione di
    // Tombarolo stessa, per non dover toccare la pipeline condivisa di
    // activateCard (duel-engine.js, usata da OGNI Magia/Trappola del
    // gioco) con un meccanismo di "carta temporaneamente presa in
    // prestito in mano" — rischio di regressione troppo ampio per il
    // guadagno. Limitata a Magie Normali/Rapide (non Continue/Rituali/
    // Terreno, pensate per restare in campo, non per un uso singolo).
    // ================================================================
    CardEffects.register(276, {
        // Costa 2000 LP: il bot la usa solo con LP abbondanti (almeno 6000) e se nel Cimitero avversario c'e'
        // una Magia che vale davvero (impatto stimato alto), non per una qualunque.
        aiCanActivate(ctx) {
            if (Tavolo.lp(ctx.owner, gameState) < 6000) return false;
            return ctx.graveyard(ctx.opponent).some((c) => c.type === 'spell' && window.AI_SHARED && AI_SHARED.scoreCardImpact(c) >= 3);
        },
        canActivate(ctx) {
            const grave = ctx.graveyard(ctx.opponent);
            return grave.some((c) => {
                if (c.type !== 'spell' || !['normal', 'quick-play'].includes(c.subtype)) return false;
                const def = DuelEngine.getDefinition(c.id);
                if (!def || typeof def.activate !== 'function') return false;
                if (typeof def.canActivate !== 'function') return true;
                return def.canActivate(DuelEngine.makeContext(ctx.owner, { card: c }));
            });
        },
        activate(ctx) {
            // chooseCardFromList e non searchGraveyardWithChoice: quello
            // TOGLIE la carta dalla zona, mentre qui la Magia presa in
            // prestito deve restare nel Cimitero dell'avversario dov'era.
            const utilizzabili = ctx.graveyard(ctx.opponent).filter((c) => {
                if (c.type !== 'spell' || !['normal', 'quick-play'].includes(c.subtype)) return false;
                const def = DuelEngine.getDefinition(c.id);
                if (!def || typeof def.activate !== 'function') return false;
                if (typeof def.canActivate !== 'function') return true;
                return def.canActivate(DuelEngine.makeContext(ctx.owner, { card: c }));
            });
            if (utilizzabili.length === 0) return;
            chooseCardFromList(ctx, utilizzabili, {
                title: '🪦 Tombarolo',
                text: 'Scegli quale Magia del Cimitero avversario usare.'
            }, (chosenCard) => {
                const chosenDef = DuelEngine.getDefinition(chosenCard.id);
                ctx.log(`🪦 Tombarolo usa ${chosenCard.name} dal Cimitero dell'avversario come se fosse in mano!`);
                chosenDef.activate(DuelEngine.makeContext(ctx.owner, { card: chosenCard }));
                ctx.dealDamage(ctx.owner, 2000);
            });
        }
    });

    // 277 — Ascia di Gravità - Grarl / Gravity Axe - Grarl: +500 ATK,
    // qualsiasi mostro. CORREZIONE di fedeltà: aggiunta la clausola
    // mancante "i mostri dell'avversario non possono cambiare Posizione
    // di Battaglia" — riusa gameState.cannotChangePositionUids, già
    // esistente e consultato in actions.js (nato per Incantesimo Ombra
    // id 439), qui applicato a OGNI mostro scoperto dell'avversario
    // invece che a uno solo, ricalcolato ad ogni render come atkDefBonus.
    CardEffects.register(277, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx); },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 500, def: e.def };
            gameState.cannotChangePositionUids = gameState.cannotChangePositionUids || {};
            ctx.field(ctx.opponent).forEach((slot) => {
                if (slot && !slot.isFaceDown) gameState.cannotChangePositionUids[slot.card.uid] = true;
            });
        }
    });

    // ================================================================
    // 284 — Guardiano Grarl / Guardian Grarl
    // Non può essere Evocata a meno che tu non controlli scoperta "Ascia
    // di Gravità - Grarl" (id 277, qui sopra) — def.requiresFieldPresenceId,
    // controllato in attemptMonsterSummon (actions.js) e
    // AI_SHARED.canNormalSummonNow (js/ai/ai-shared.js). "Se questa carta
    // è l'unica nella tua mano, puoi Special Summonarla (dalla mano)":
    // canSpecialSummonFromHand, condizione indipendente dal vincolo
    // sull'Evocazione Normale qui sopra (il testo reale non richiede
    // l'Ascia per questa via alternativa).
    // ================================================================
    CardEffects.register(284, {
        requiresFieldPresenceId: 277,
        canSpecialSummonFromHand(ctx) {
            return ctx.hand(ctx.owner).length === 1;
        },
        paySpecialSummonCost() { return true; }
    });

    // ================================================================
    // 285 — Guardiano Kay'est / Guardian Kay'est
    // Non può essere Evocata a meno che tu non controlli scoperta
    // "Bacchetta del Silenzio - Kay'est" (id 423) — def.requiresFieldPresenceId,
    // stesso meccanismo di Guardiano Grarl qui sopra. Non può essere
    // scelta come bersaglio per gli attacchi (ma questo non impedisce
    // all'avversario di attaccare direttamente — cannotBeAttackTargetUids
    // non tocca mai gli attacchi diretti, vedi resolveAttack in
    // actions.js). "Non è influenzata dagli effetti delle Magie": coperta
    // sia per la "presa di mira" (def.cannotBeTargetedBySpells, floodgate
    // in declareCardEffectTarget, duel-engine.js — come
    // cannotBeTargetedByCardEffects dei 3 Dei Egizi, ma ristretto alle
    // sole Magie) SIA per gli effetti di massa che non la scelgono come
    // bersaglio (def.unaffectedBySpellEffects) — controllato a mano nei
    // pochi punti di questo file dove una Magia applica un effetto
    // ACQUA-wide senza passare da declareTarget: il bonus/malus ATK/DEF
    // di Un Oceano Leggendario (id 79, anche la riduzione di Livello —
    // vedi il controllo su card.id === 285 dentro getEffectiveLevel,
    // cards-db.js), Lama Accecante (id 349) e la
    // distruzione di massa di Grande Onda Piccola Onda (id 706). Nessuna
    // Magia MOSTRO (es. Piccola Chimera id 676, Ragazzo Stella id 696: un
    // effetto continuo del MOSTRO stesso, non "della Magia") ne è
    // interessata — il testo reale copre solo le Magie. SEMPLIFICAZIONE
    // residua: nessun punto di controllo condiviso esiste per questo caso
    // (a differenza del targeting, che ha declareTarget) — una FUTURA
    // Magia con un nuovo effetto di massa ACQUA-wide andrebbe aggiornata
    // a mano con lo stesso controllo.
    // ================================================================
    CardEffects.register(285, {
        requiresFieldPresenceId: 423,
        cannotBeTargetedBySpells: true,
        unaffectedBySpellEffects: true,
        static(ctx) {
            gameState.cannotBeAttackTargetUids[ctx.card.uid] = true;
        }
    });

    // ================================================================
    // 283 — Guardiana Elma / Guardian Elma
    // Non può essere Evocata a meno che tu non controlli scoperta "Pugnale
    // Farfalla - Elma" (id 135) — def.requiresFieldPresenceId, stesso
    // meccanismo di Guardiano Grarl/Kay'est (id 284/285) qui sopra: la
    // nota precedente ("nessun meccanismo generico di restrizione
    // all'Evocazione") era ormai superata da quell'infrastruttura, già
    // esistente prima ancora di questa carta.
    // Quando Evocata Normalmente o Special Summonata: recupera 1 Carta
    // Equipaggiamento dal proprio Cimitero e se la equipaggia da sola —
    // scelta automatica della PRIMA trovata (stessa SEMPLIFICAZIONE di
    // ogni altra selezione automatica in questo file), scritta a mano
    // (non attachEquip/findEquipTarget qui sopra: quei due presuppongono
    // che ctx.card sia la Carta Equipaggiamento stessa già in mano/campo,
    // qui invece è il BERSAGLIO — Guardiana Elma — a "pescare" l'Equip
    // dal proprio Cimitero).
    // ================================================================
    CardEffects.register(283, {
        requiresFieldPresenceId: 135,
        onSummon(ctx) {
            if (ctx.stField(ctx.owner).findIndex((s) => s === null) === -1) return;
            const evocata = ctx.summonedCard;
            const slotEvocata = ctx.summonedSlotIndex;
            // searchGraveyardWithChoice toglie già la carta dal Cimitero
            // prima di chiamarci: qui la rimozione serve davvero, perché
            // l'Equip passa in zona Magia/Trappola.
            searchGraveyardWithChoice(ctx, ctx.owner, (c) => {
                const d = DuelEngine.getDefinition(c.id);
                return !!(d && d.isEquip);
            }, {
                title: '🗡️ Guardiano Elma',
                text: 'Scegli quale Carta Equipaggiamento richiamare dal Cimitero.'
            }, (eqCard) => {
                // La casella si ricontrolla QUI: fra l'apertura del picker
                // e il click la zona Magia/Trappola può essersi riempita.
                const freeStSlot = ctx.stField(ctx.owner).findIndex((s) => s === null);
                if (freeStSlot === -1) { ctx.graveyard(ctx.owner).push(eqCard); return; }
                eqCard.equippedToOwner = ctx.owner;
                eqCard.equippedToIndex = slotEvocata;
                eqCard.equippedToUid = evocata.uid;
                ctx.stField(ctx.owner)[freeStSlot] = { card: eqCard, isFaceDown: false, setOnTurn: gameState.turn };
                ctx.log(`🗡️ Guardiano Elma richiama ${eqCard.name} dal Cimitero e se lo equipaggia!`);
            });
        }
    });

    // 286 — Ventaglio di Raffica: +400 ATK/-200 DEF, solo VENTO.
    CardEffects.register(286, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.attribute === 'VENTO') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.attribute === 'VENTO'); },
        isEquip: true,
        equipTargetFilter: (c) => c.attribute === 'VENTO',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 400, def: e.def - 200 };
        }
    });

    // 301 — Corno dell'Unicorno: +700 ATK/+700 DEF, qualsiasi mostro.
    // Vedi missingEffectNote su id 301 in cards.json (stesso motivo di
    // id 117): manca "quando mandata al Cimitero: torna in cima al Deck".
    CardEffects.register(301, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx); },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 700, def: e.def + 700 };
        },
        // "Quando questa carta viene mandata dal Terreno al Cimitero:
        // rimettila in cima al Deck." Il prezzo del bonus molto alto
        // (+700/+700): la carta non si perde, ma la si ripesca.
        onSentToGraveyardFromField(ctx) {
            if (riprendiDalCimitero(ctx, 'deck')) {
                ctx.log(`🦄 ${ctx.card.name} torna in cima al Deck.`);
            }
        }
    });

    // 309 — Armatura Insetto con Cannone Laser / Insect Armor with Laser Cannon: +700 ATK, solo Insetto.
    CardEffects.register(309, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.race === 'Insetto') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.race === 'Insetto'); },
        isEquip: true,
        equipTargetFilter: (c) => c.race === 'Insetto',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 700, def: e.def };
        }
    });

    // 313 — Rinvigorimento / Invigoration: +400 ATK/-200 DEF, solo TERRA.
    CardEffects.register(313, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.attribute === 'TERRA') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.attribute === 'TERRA'); },
        isEquip: true,
        equipTargetFilter: (c) => c.attribute === 'TERRA',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 400, def: e.def - 200 };
        }
    });

    // 340 — Armatura Cannone Laser / Laser Cannon Armor: +300 ATK/+300 DEF, solo Insetto.
    CardEffects.register(340, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.race === 'Insetto') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.race === 'Insetto'); },
        isEquip: true,
        equipTargetFilter: (c) => c.race === 'Insetto',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 300, def: e.def + 300 };
        }
    });

    // ================================================================
    // 341 — Ultimo Turno / Last Turn (Trappola Normale)
    // Attivabile solo nel turno dell'avversario, con i propri Life Points
    // a 1000 o meno. Sceglie 1 proprio mostro scoperto da mantenere (auto:
    // il più forte), poi manda ogni ALTRA carta sul Terreno e in mano di
    // ENTRAMBI i giocatori ai rispettivi Cimiteri. L'avversario Special
    // Summona 1 mostro dal proprio Deck (auto: il più forte) scoperto in
    // Posizione di Attacco — il danno da questa battaglia è sempre 0
    // (riusa gameState.noDamageFor, già esistente: dato che il Terreno
    // resta con un solo mostro per lato, nessun'altra battaglia è
    // comunque possibile in questo turno). Il verdetto (Vittoria/
    // Pareggio) si valuta alla End Phase di questo stesso turno — vedi
    // gameState.pendingUltimateTurnCheck, controllato in enterEndPhase()
    // (game-flow.js): questa Trappola è già finita nel Cimitero a quel
    // punto (Trappola Normale, non Continua), quindi il controllo non
    // può vivere in un normale onEndPhase della carta stessa. Nuovo
    // terzo esito 'draw' per endDuel/DuelSession.finish/showOutcome
    // (game-flow.js, duel-session.js, duel-cinematics.js) — non tocca il
    // record V/S del personaggio (nessuna modifica allo schema di
    // salvataggio).
    // "...e attacca il tuo mostro scelto": forzato per davvero tramite
    // gameState.mustAttackTargetUidsFor (vedi più sotto in activate()),
    // lo stesso meccanismo costruito per 199 — se l'avversario non
    // può comunque attaccare per qualche motivo, resta comunque coerente
    // con "in ogni altro caso è Pareggio" del testo reale.
    // ================================================================
    CardEffects.register(341, {
        canActivate(ctx) {
            if (gameState.currentPlayer === ctx.owner) return false;
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            if (gameState[lpKey] > 1000) return false;
            return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown);
        },
        activate(ctx) {
            const ownField = ctx.field(ctx.owner);
            let keepIndex = -1;
            let bestAtk = -1;
            ownField.forEach((slot, i) => {
                if (slot && !slot.isFaceDown && DuelEngine.getEffectiveAtk(slot.card) > bestAtk) { bestAtk = DuelEngine.getEffectiveAtk(slot.card); keepIndex = i; }
            });
            if (keepIndex === -1) return;

            Tavolo.ordine().forEach((owner) => {
                const field = ctx.field(owner);
                field.forEach((slot, i) => {
                    if (!slot) return;
                    if (owner === ctx.owner && i === keepIndex) return;
                    ctx.graveyard(owner).push(slot.card);
                    field[i] = null;
                });
                const stField = ctx.stField(owner);
                stField.forEach((slot, i) => {
                    if (!slot) return;
                    ctx.graveyard(owner).push(slot.card);
                    stField[i] = null;
                });
                const hand = ctx.hand(owner);
                while (hand.length > 0) ctx.graveyard(owner).push(hand.pop());
            });
            ctx.log('⏳ Ultimo Turno: il Terreno viene spazzato via, resta solo un mostro per lato!');

            const oppDeckKey = Tavolo.chiave(ctx.opponent, 'Deck');
            const oppCountKey = Tavolo.chiave(ctx.opponent, 'DeckCount');
            const oppDeck = gameState[oppDeckKey];
            if (Array.isArray(oppDeck)) {
                let bestIndex = -1;
                let bestOppAtk = -1;
                oppDeck.forEach((c, i) => { if (c.type === 'monster' && (c.attack || 0) > bestOppAtk) { bestOppAtk = c.attack || 0; bestIndex = i; } });
                if (bestIndex !== -1) {
                    const [oppMonster] = oppDeck.splice(bestIndex, 1);
                    gameState[oppCountKey] = oppDeck.length;
                    const oppSlotIndex = ctx.findEmptyMonsterSlot(ctx.opponent);
                    if (oppSlotIndex !== -1) {
                        ctx.specialSummon(ctx.opponent, oppMonster, oppSlotIndex, 'attack', 'deck');
                        ctx.log(`⏳ Ultimo Turno: l'avversario Special Summona ${oppMonster.name}!`);
                        // "...e attacca il tuo mostro scelto": obbligo vero
                        // e proprio (gameState.mustAttackTargetUidsFor,
                        // stesso meccanismo di 199) — se il lato
                        // forzato è il bot, botPerformAttacks (bot.js) lo
                        // consulta e ignora la normale valutazione di
                        // convenienza; se è il giocatore, handlePhaseStepperClick
                        // (game-flow.js) blocca l'uscita dalla Battle Phase.
                        const keptCard = ctx.field(ctx.owner)[keepIndex].card;
                        gameState.mustAttackTargetUidsFor = gameState.mustAttackTargetUidsFor || {};
                        gameState.mustAttackTargetUidsFor[oppMonster.uid] = new Set([keptCard.uid]);
                    } else {
                        ctx.graveyard(ctx.opponent).push(oppMonster);
                    }
                }
            }

            gameState.noDamageFor = gameState.noDamageFor || {};
            gameState.noDamageFor.player = true;
            gameState.noDamageFor.bot = true;
            gameState.pendingUltimateTurnCheck = { forTurn: gameState.turn };
        }
    });

    // 344 — Spada Leggendaria / Legendary Sword: +300 ATK/+300 DEF, solo Guerriero.
    CardEffects.register(344, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.race === 'Guerriero') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.race === 'Guerriero'); },
        isEquip: true,
        equipTargetFilter: (c) => c.race === 'Guerriero',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 300, def: e.def + 300 };
        }
    });

    // ================================================================
    // 348 — Spada della Forza di Luce / Sword of the Light Force
    // (Trappola Normale)
    // Bandisci 1 carta a caso dalla mano dell'avversario, coperta.
    // Durante la 4ª Standby Phase dell'avversario dopo l'attivazione:
    // restituiscigliela — ctx.banishFromHandWithCountdown, nuovo
    // meccanismo generico in duel-engine.js (gameState.delayedHandReturns,
    // elaborato da DuelEngine.processDelayedHandReturns in
    // enterStandbyPhase(), game-flow.js), diverso da
    // ctx.banishTemporarily (quello torna sul TERRENO alla PROSSIMA
    // fase; questo torna in MANO dopo un conteggio di fasi, anche a
    // Trappola già consumata e andata al Cimitero).
    // ================================================================
    CardEffects.register(348, {
        canActivate(ctx) { return ctx.hand(ctx.opponent).length > 0; },
        activate(ctx) {
            const hand = ctx.hand(ctx.opponent);
            const index = Math.floor(ctx.random() * hand.length);
            const [card] = hand.splice(index, 1);
            ctx.banishFromHandWithCountdown(ctx.opponent, card, 4);
            ctx.log(`🗡️ Spada Forza di Luce bandisce coperta 1 carta a caso dalla mano ${ctx.opponent === 'player' ? 'tua' : 'del Bot'}: tornerà tra 4 Standby Phase!`);
        }
    });

    // 349 — Lama Fulminante / Lightning Blade: +800 ATK al Guerriero equipaggiato, e in più
    // tutti i mostri ACQUA sul Terreno (di entrambi i giocatori) perdono 500 ATK.
    CardEffects.register(349, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.race === 'Guerriero') !== -1; },
        // +800 a un Guerriero, ma -500 a OGNI mostro ACQUA scoperto: conviene solo se il malus colpisce il nemico piu' di noi.
        aiCanActivate(ctx) {
            const acqua = (owner) => ctx.field(owner).filter((s) => s && !s.isFaceDown && s.card.attribute === 'ACQUA').length;
            return 800 + 500 * (acqua(ctx.opponent) - acqua(ctx.owner)) >= 300;
        },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.race === 'Guerriero'); },
        isEquip: true,
        equipTargetFilter: (c) => c.race === 'Guerriero',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 800, def: e.def };
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    // Guardiano Kay'est (id 285): immune anche a questo malus.
                    if (slot && !slot.isFaceDown && slot.card.attribute === 'ACQUA' && !DuelEngine.getDefinition(slot.card.id)?.unaffectedBySpellEffects) {
                        const existing = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                        gameState.atkDefBonus[slot.card.uid] = { atk: existing.atk - 500, def: existing.def };
                    }
                });
            });
        }
    });

    // 358 — Fabbrica di Conversione Meccanica / Machine Conversion Factory: +300 ATK/+300 DEF, solo Macchina.
    CardEffects.register(358, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.race === 'Macchina') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.race === 'Macchina'); },
        isEquip: true,
        equipTargetFilter: (c) => c.race === 'Macchina',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 300, def: e.def + 300 };
        }
    });

    // 411 — Falce del Mietitore - Falce del Terrore / Reaper's Scythe: +500 ATK per mostro nei
    // Cimiteri di entrambi i giocatori, ma solo equipaggiabile a "Falce del Terrore Guardiana"
    // (id 282) — che a sua volta non è Evocabile in questo motore (dipende da "Guardiano Eatos",
    // non presente): la restrizione resta corretta, semplicemente non troverà mai un bersaglio.
    CardEffects.register(411, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.id === 282) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.id === 282); },
        isEquip: true,
        equipTargetFilter: (c) => c.id === 282,
        static(ctx) {
            const t = equippedTarget(ctx);
            const count = ctx.graveyard('player').filter((c) => c.type === 'monster').length + ctx.graveyard('bot').filter((c) => c.type === 'monster').length;
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + count * 500, def: e.def };
        }
    });

    // 420 — Anello Magnetico: -500 ATK/-500 DEF al
    // proprio mostro equipaggiato, e "i mostri dell'avversario possono
    // attaccare solo il mostro equipaggiato" — gameState.mustBeAttackedUidsFor
    // (letto da resolveAttack e dalla scelta del bot tramite
    // DuelEngine.forcedAttackTargetIndexes). "Solo a un mostro sul tuo
    // Terreno" lo garantisce già la raccolta dei bersagli d'aggancio, che
    // guarda solo il proprio lato.
    CardEffects.register(420, {
        // Toglie 500 ATK/DEF al proprio mostro per obbligare gli attacchi avversari su di lui: una
        // trappola di tattica, che il bot usava solo per indebolirsi.
        aiCanActivate() { return false; },
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx); },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk - 500, def: e.def - 500 };
            const lato = ctx.card.equippedToOwner || ctx.owner;
            gameState.mustBeAttackedUidsFor[lato].add(t.uid);
        }
    });

    // 423 — Bastone del Silenzio - Kay'est / Staff of the Silencer - Kay'est: +500 DEF, qualsiasi mostro.
    // "Nega altri effetti Magia che scelgono come bersaglio il mostro
    // equipaggiato, e se lo fai, distruggi quella Magia": reagisce al
    // checkpoint di targeting condiviso (declareCardEffectTarget) dalla zona
    // Magia/Trappola. canReactToTargetDeclare dice QUANDO (solo una Magia,
    // non questa stessa carta, e solo se il bersaglio è proprio il mostro
    // equipaggiato), separato da canActivate che qui vuol dire "posso
    // agganciarmi". La distruzione vale per una Magia che resta in campo
    // (destroyTargetingSpellIfItStays). Come ogni reazione a quel
    // checkpoint, non copre una Magia che bersaglia senza passarci.
    CardEffects.register(423, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx); },
        canReactToTargetDeclare(ctx) {
            if (ctx.sourceType !== 'spell' || !ctx.sourceCard || ctx.sourceCard.uid === ctx.card.uid) return false;
            const bersaglio = ctx.field(ctx.targetOwner)[ctx.targetIndex];
            return !!(bersaglio && bersaglio.card.uid === ctx.card.equippedToUid);
        },
        onCardEffectTargetDeclare(ctx) {
            ctx.cancel();
            const distrutta = destroyTargetingSpellIfItStays(ctx);
            ctx.log(`🪄 Bastone del Silenzio nega l'effetto di ${ctx.sourceCard.name}${distrutta ? ' e la distrugge' : ''}!`);
        },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk, def: e.def + 500 };
        }
    });

    // 432 — Salamandra / Salamandra: +700 ATK, solo FUOCO.
    CardEffects.register(432, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.attribute === 'FUOCO') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.attribute === 'FUOCO'); },
        isEquip: true,
        equipTargetFilter: (c) => c.attribute === 'FUOCO',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 700, def: e.def };
        }
    });

    // 441 — Palazzo Splendente: +700 ATK, solo LUCE.
    CardEffects.register(441, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.attribute === 'LUCE') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.attribute === 'LUCE'); },
        isEquip: true,
        equipTargetFilter: (c) => c.attribute === 'LUCE',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 700, def: e.def };
        }
    });

    // 372 — Maschera del Maledetto / Mask of the Accursed: nessun bonus ATK/DEF; durante la tua
    // Standby Phase, infligge 500 danni al controllore del mostro equipaggiato.
    // CORREZIONE di fedeltà: aggiunta la clausola mancante "il mostro
    // equipaggiato non può attaccare" — riusa gameState.cannotAttackUids,
    // già esistente e per-uid (nato per Incantesimo Ombra id 439), non
    // serviva alcuna nuova infrastruttura.
    CardEffects.register(372, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx); },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            gameState.cannotAttackUids = gameState.cannotAttackUids || {};
            gameState.cannotAttackUids[t.uid] = true;
        },
        onStandbyPhase(ctx) {
            const t = equippedTarget(ctx);
            const targetOwnerLpKey = Tavolo.chiave(ctx.card.equippedToOwner, 'LP');
            gameState[targetOwnerLpKey] -= 500;
            ctx.log(`💀 Maschera del Maledetto infligge 500 danni al controllore di ${t.name}!`);
        }
    });

    // ================================================================
    // 376 — Metalmorfosi / Metalmorph (Trappola Normale che si equipaggia da sola)
    // +300 ATK/DEF al mostro equipaggiato; se attacca, guadagna ATK pari a
    // metà dell'ATK del bersaglio, solo durante il calcolo dei danni
    // (damageStepBonus, come Soldati Insetto del Cielo id 311).
    // SEMPLIFICAZIONE: equipaggiabile solo a un proprio mostro (la carta
    // reale permette anche un mostro dell'avversario), stessa restrizione
    // di ogni altra Carta Equipaggiamento in questo file.
    // ================================================================
    CardEffects.register(376, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx); },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 300, def: e.def + 300 };
        },
        damageStepBonus(ctx) {
            if (ctx.role === 'attacker' && ctx.opponentCard) {
                return { atk: Math.floor(DuelEngine.getEffectiveAtk(ctx.opponentCard) / 2) };
            }
            return null;
        }
    });

    // ================================================================
    // 520 — Zoa (effetto Ignition dalla zona Mostro)
    // Se equipaggiata con "Metalmorfosi" (id 376, qui sopra): puoi
    // mandare entrambe al Cimitero per Special Summonare "Metalzoa" (id
    // 377, qui sotto) dal Deck. CORREZIONE: la nota precedente di id 377
    // affermava erroneamente che questa carta ("Zoa") non fosse presente
    // in questo database — falso, esiste già come id 520.
    // ================================================================
    CardEffects.register(520, {
        canActivate(ctx) {
            const equippedWithMetalmorph = ctx.stField(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.id === 376 && slot.card.equippedToUid === ctx.card.uid);
            if (!equippedWithMetalmorph) return false;
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            return Array.isArray(deck) && deck.some((c) => c.id === 377);
        },
        activate(ctx) {
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            const deckIndex = deck.findIndex((c) => c.id === 377);
            if (deckIndex === -1) return;
            const equipIndex = ctx.stField(ctx.owner).findIndex((slot) => slot && !slot.isFaceDown && slot.card.id === 376 && slot.card.equippedToUid === ctx.card.uid);
            if (equipIndex === -1) return;
            const field = ctx.field(ctx.owner);
            const ownIndex = ctx.index;
            field[ownIndex] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            const equipCard = ctx.stField(ctx.owner)[equipIndex].card;
            ctx.stField(ctx.owner)[equipIndex] = null;
            ctx.graveyard(ctx.owner).push(equipCard);
            const [metalzoa] = deck.splice(deckIndex, 1);
            gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
            ctx.specialSummon(ctx.owner, metalzoa, ownIndex, 'attack', 'deck');
            ctx.log('⚙️ Zoa e Metalmorfosi vanno al Cimitero: Metalzoa Special Summonata dal Deck!');
        }
    });

    // ================================================================
    // 377 — Metalzoa
    // Non può essere Evocata Normalmente/Set (cannotNormalSummon) né
    // Special Summonata in nessun altro modo (cannotBeSpecialSummoned —
    // non blocca ctx.specialSummon usato direttamente da Zoa id 520 qui
    // sopra, l'unico modo legale).
    // ================================================================
    CardEffects.register(377, {
        cannotNormalSummon: true,
        cannotBeSpecialSummoned: true
    });

    // ================================================================
    // 12 — Drago Nero Occhi Rossi / Red-Eyes B. Dragon (effetto Ignition
    // dalla zona Mostro)
    // Se equipaggiato con "Metalmorfosi" (id 376, qui sopra): puoi
    // mandare entrambe le carte al Cimitero per Special Summonare
    // "Drago Metallico Occhi Rossi" (id 413, qui sotto) dal Deck —
    // stesso identico schema di Zoa/Metalzoa (id 520/377) qui sopra.
    // ================================================================
    CardEffects.register(12, {
        canActivate(ctx) {
            const equippedWithMetalmorph = ctx.stField(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.id === 376 && slot.card.equippedToUid === ctx.card.uid);
            if (!equippedWithMetalmorph) return false;
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            return Array.isArray(deck) && deck.some((c) => c.id === 413);
        },
        activate(ctx) {
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            const deckIndex = deck.findIndex((c) => c.id === 413);
            if (deckIndex === -1) return;
            const equipIndex = ctx.stField(ctx.owner).findIndex((slot) => slot && !slot.isFaceDown && slot.card.id === 376 && slot.card.equippedToUid === ctx.card.uid);
            if (equipIndex === -1) return;
            const field = ctx.field(ctx.owner);
            const ownIndex = ctx.index;
            field[ownIndex] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            const equipCard = ctx.stField(ctx.owner)[equipIndex].card;
            ctx.stField(ctx.owner)[equipIndex] = null;
            ctx.graveyard(ctx.owner).push(equipCard);
            const [redEyesMetal] = deck.splice(deckIndex, 1);
            gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
            ctx.specialSummon(ctx.owner, redEyesMetal, ownIndex, 'attack', 'deck');
            ctx.log('🐉 Drago Nero Occhi Rossi e Metalmorfosi vanno al Cimitero: Drago Metallico Occhi Rossi Special Summonato dal Deck!');
        }
    });

    // ================================================================
    // 413 — Drago Nero Metallico Occhi Rossi / Red-Eyes Black Metal
    // Dragon
    // Non può essere Evocato Normalmente/Set (cannotNormalSummon) né
    // Special Summonato in nessun altro modo (cannotBeSpecialSummoned —
    // non blocca ctx.specialSummon usato direttamente da Drago Nero
    // Occhi Rossi id 12 qui sopra, l'unico modo legale).
    // ================================================================
    CardEffects.register(413, {
        cannotNormalSummon: true,
        cannotBeSpecialSummoned: true
    });

    // ================================================================
    // 496 — Ala del Tiranno / Tyrant's Wing (Trappola Normale che si equipaggia da sola)
    // Equipaggiabile solo a un mostro Tipo Drago. +400 ATK/DEF.
    // CORREZIONE di fedeltà: il commento originale sosteneva "il motore
    // non supporta attacchi multipli dello stesso mostro" — falso, il
    // motore lo supporta da tempo (def.canAttackTwice, es. Cavaliere
    // Hayabusa id 294; slot.extraAttackGranted, es. Riavvolgimento Toon
    // id 485). Aggiunta la clausola "fino a 2 attacchi per Battle Phase"
    // riusando slot.extraAttackGranted, ri-concesso ad ogni render via
    // static() (si azzera da solo ogni turno in changeTurn(), come per
    // Riavvolgimento Toon). L'ultima clausola (autodistruzione in End
    // Phase se il mostro equipaggiato ha attaccato un mostro in questo
    // turno) ora è implementata per intero tramite il nuovo tracker
    // generico gameState.attackedMonsterUidsThisTurn (popolato in
    // resolveAttack, actions.js; azzerato in changeTurn(), game-flow.js),
    // consultato dentro un normale onEndPhase (già scansionato sulla
    // zona 'st' da firePhaseTrigger).
    // ================================================================
    CardEffects.register(496, {
        continuous: true,
        // Letto da La Perla del Drago (id 652): "annulla una Trappola che
        // bersaglia 1 mostro Tipo Drago" — Ala del Tiranno È una
        // Trappola che si equipaggia da sola, il suo bersaglio (il
        // proprio mostro Drago) conta comunque, indipendentemente da chi
        // controlla l'uno o l'altra.
        declaredTargeting: { count: 1, cardType: 'monster', race: 'Drago' },
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.race === 'Drago') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.race === 'Drago'); },
        isEquip: true,
        equipTargetFilter: (c) => c.race === 'Drago',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 400, def: e.def + 400 };
            const targetSlot = ctx.field(ctx.card.equippedToOwner)[ctx.card.equippedToIndex];
            if (targetSlot) targetSlot.extraAttackGranted = true;
        },
        onEndPhase(ctx) {
            const targetSlot = ctx.field(ctx.card.equippedToOwner)[ctx.card.equippedToIndex];
            if (!targetSlot) return;
            if (!(gameState.attackedMonsterUidsThisTurn && gameState.attackedMonsterUidsThisTurn.has(targetSlot.card.uid))) return;
            const selfIndex = ctx.stField(ctx.owner).findIndex((s) => s && s.card.uid === ctx.card.uid);
            if (selfIndex === -1) return;
            ctx.stField(ctx.owner)[selfIndex] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            ctx.log('Ala Tiranna si autodistrugge: il mostro equipaggiato ha attaccato un mostro in questo turno!');
        }
    });

    // ================================================================
    // 545 — Spada della Distruzione Oscura / Sword of Dark Destruction
    // Equipaggiabile solo a un mostro Tipo OSCURITÀ. +400 ATK, -200 DEF.
    // ================================================================
    CardEffects.register(545, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.attribute === 'OSCURITÀ') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.attribute === 'OSCURITÀ'); },
        isEquip: true,
        equipTargetFilter: (c) => c.attribute === 'OSCURITÀ',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 400, def: e.def - 200 };
        }
    });

    // ================================================================
    // 365 — Maha Vailo (buff continuo basato sulle proprie Carte Equipaggiamento)
    // Guadagna 500 ATK per ogni Carta Equipaggiamento equipaggiata a
    // questa carta.
    // ================================================================
    CardEffects.register(365, {
        static(ctx) {
            const count = ctx.stField(ctx.owner).filter((slot) => slot && !slot.isFaceDown && slot.card.equippedToUid === ctx.card.uid).length;
            gameState.atkDefBonus[ctx.card.uid] = { atk: count * 500, def: 0 };
        }
    });

    // ================================================================
    // 7 — Buco Nero (Magia Normale)
    // "Distruggi tutti i mostri sul Terreno" — entrambi i giocatori,
    // senza eccezioni.
    // ================================================================
    CardEffects.register(7, {
        activate(ctx) {
            // Le posizioni delle carte sul campo vanno prese ORA, PRIMA di
            // ctx.destroyAllMonsters(): activateCard() in duel-engine.js
            // richiama updateUI() SUBITO dopo che questa funzione ritorna,
            // che ricostruisce il campo da zero e stacca dal documento i
            // nodi delle carte appena distrutte — esattamente lo stesso
            // motivo per cui resolveAttack() in js/engine/actions.js cattura i
            // rettangoli PRIMA di mutare lo stato (vedi quel commento).
            const sucked = [];
            Tavolo.ordine().forEach((owner) => {
                const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
                ctx.field(owner).forEach((slot, index) => {
                    if (!slot) return;
                    const el = PortaUI.query(`#${boardId} .field-slot[data-type="monster"][data-index="${index}"] .card`);
                    if (el) sucked.push({ card: slot.card, rect: el.getBoundingClientRect() });
                });
            });

            ctx.destroyAllMonsters();
            ctx.log('💥 Buco Nero inghiotte e distrugge tutti i mostri sul Terreno!');
            // Il vortice parte SUBITO: resolveChain() (duel-engine.js) ha
            // già aspettato da sola che il pulse a centro schermo della
            // carta fosse DAVVERO finito prima di chiamare questo activate(ctx),
            // quindi qui non serve più alcun ritardo aggiuntivo.
            if (window.FX) FX.playDarkHoleVortex(sucked);
        }
    });

    // ================================================================
    // 8 — Spada Rivelatrice (Magia CONTINUA)
    // Per 3 turni dell'avversario di chi la controlla: i suoi mostri non
    // possono dichiarare attacchi E i suoi mostri coperti restano visibili
    // scoperti (solo a schermo: restano "coperti" per le regole vere e
    // proprie, es. un attacco li rivela comunque con il consueto messaggio
    // di log — vedi isRevealedFor()/renderFields() in game-flow.js).
    // Il conto alla rovescia (slot.turnsLeft) scende di 1 ad ogni turno
    // dell'avversario colpito — vedi tickContinuousEffectDurations() in
    // game-flow.js, chiamata da changeTurn() — e allo scadere la carta va
    // da sola al Cimitero, invece di restare per sempre come le Magie
    // Continue normali.
    // ================================================================
    CardEffects.register(8, {
        continuous: true,
        durationTurns: 3,
        activate(ctx) {
            const slot = ctx.stField(ctx.owner)[ctx.index];
            if (slot) slot.turnsLeft = 3;
            // CORREZIONE di fedeltà: aggiunto il flip vero e proprio di
            // tutti i mostri coperti dell'avversario all'attivazione (il
            // testo reale lo richiede, non solo "restano scoperti" nella
            // UI) — gameState.revealedFor qui sotto in static() resta un
            // riflesso cosmetico continuo separato, non basta da solo.
            // Il flip qui SCATENA i trigger ON_FLIP dei mostri coinvolti
            // (voce YGOPRODeck: girare un mostro scoperto con un effetto
            // Carta, non tramite Flip Summon, attiva comunque i suoi
            // eventuali effetti Flip) — un solo mostro alla volta, in
            // sequenza, aspettando l'onDone di ognuno prima del successivo,
            // così due finestre di risposta (es. due Buco Trappola) non si
            // sovrappongono mai.
            const flippedSlots = [];
            ctx.field(ctx.opponent).forEach((s, idx) => {
                if (s && s.isFaceDown) {
                    s.isFaceDown = false;
                    flippedSlots.push({ card: s.card, slotIndex: idx });
                }
            });
            ctx.log(`✨ ${ctx.owner === 'player' ? 'Hai' : 'Il bot ha'} attivato ${ctx.card.name}: gira scoperti tutti i mostri coperti dell'avversario, che per 3 turni non possono attaccare.`);
            // Le spade calano SUBITO: resolveChain() (duel-engine.js) ha
            // già aspettato da sola che il pulse a centro schermo della
            // carta fosse DAVVERO finito prima di chiamare questo activate(ctx),
            // quindi qui non serve più alcun ritardo aggiuntivo.
            const opponent = ctx.opponent;
            function fireFlipTriggers(index) {
                if (index >= flippedSlots.length || !window.DuelEngine) return;
                const s = flippedSlots[index];
                const flipCtx = DuelEngine.makeContext(opponent, { card: s.card, slotIndex: s.slotIndex });
                DuelEngine.fireTrigger(DuelEngine.TRIGGER.ON_FLIP, flipCtx, () => fireFlipTriggers(index + 1));
            }
            if (window.FX) {
                FX.playSwordsOfRevealingLight(opponent, (removeFlyingSwords) => {
                    // Solo ORA (spade mobili atterrate) il segno fisso
                    // permanente (.field-sword-mark) può iniziare a
                    // comparire nel render — vedi il controllo su
                    // gameState.revealedSwordsLanded in renderFields()
                    // (game-flow.js). Ridisegna PRIMA di rimuovere le
                    // spade mobili, altrimenti per un istante non si
                    // vedrebbe nessuna delle due.
                    gameState.revealedSwordsLanded = gameState.revealedSwordsLanded || {};
                    gameState.revealedSwordsLanded[opponent] = true;
                    if (typeof updateUI === 'function') updateUI();
                    removeFlyingSwords();
                    fireFlipTriggers(0);
                });
            } else {
                fireFlipTriggers(0);
            }
        },
        static(ctx) {
            gameState.cannotAttackFor[ctx.opponent] = true;
            gameState.revealedFor[ctx.opponent] = true;
        }
    });

    // ================================================================
    // 10 — Cilindro Magico (Trappola)
    // Quando l'avversario di chi la controlla dichiara un attacco:
    // annulla l'attacco e infligge all'attaccante danno pari all'ATK del
    // mostro che ha attaccato.
    // ================================================================
    CardEffects.register(10, {
        onAttackDeclare(ctx) {
            // La regola resta sincrona: resolveAttack deve vedere subito
            // l'attacco annullato. La scena usa soltanto le coordinate già
            // presenti e può terminare mentre il motore è correttamente
            // fermo sul risultato della Trappola.
            if (window.FX && typeof FX.playMagicCylinder === 'function') {
                FX.playMagicCylinder(ctx.opponent, ctx.attackerIndex, ctx.opponent, ctx.attackerAtk);
            }
            ctx.cancelAttack();
            ctx.dealDamage(ctx.opponent, ctx.attackerAtk);
            ctx.log(`🌀 Cilindro Magico rimanda l'attacco al mittente: ${ctx.attackerAtk} danni!`);
        }
    });

    // ================================================================
    // 425 — Ragno della Roulette / Roulette Spider (Magia Rapida, Set)
    // Quando un mostro dell'avversario dichiara un attacco: lancia un
    // dado a sei facce e applica il risultato:
    //   1: dimezza i propri LP.
    //   2: rendi quell'attacco un attacco diretto.
    //   3: scegli 1 mostro che controlli, cambia il bersaglio dell'attacco
    //      su di esso e calcola i danni.
    //   4: scegli un altro mostro che controlla l'avversario (l'attaccante
    //      stesso escluso), cambia il bersaglio dell'attacco su di esso e
    //      calcola i danni — sì, un mostro del campo dell'ATTACCANTE:
    //      "fuoco amico" reale della carta, non un errore. redirectAttack
    //      accetta un secondo argomento (ctx.opponent) apposta per questo
    //      caso, l'unico di questo dataset in cui il nuovo bersaglio non
    //      sta sul campo di chi risponde (vedi resolveAttack in actions.js).
    //   5: annulla l'attacco e infliggi all'avversario danno pari all'ATK
    //      di quel mostro.
    //   6: distruggi il mostro dell'avversario.
    // SEMPLIFICAZIONE: i risultati 3/4 richiedono "scegliere 1 mostro" —
    // dato che questo handler gira dentro la risoluzione sincrona di una
    // Chain (resolveChain in duel-engine.js, che NON aspetta un popup
    // asincrono prima di proseguire), la scelta è automatica invece di
    // un vero picker interattivo: stesso identico pattern già accettato
    // per Spiritello dei Sogni (id 214)/Spostamento (id 622) qui sopra
    // in questo file, che con lo stesso identico vincolo prendono
    // "il primo mostro idoneo trovato" invece di offrire una scelta.
    // ================================================================
    CardEffects.register(425, {
        // hasDiceRollEffect: usato da Dado Dimensionale (id 200) per
        // trovare "una carta con un effetto che richiede un lancio di
        // dado" — nuova tassonomia minima opt-in, non tocca il resto
        // dell'effetto di questa carta.
        hasDiceRollEffect: true,
        onAttackDeclare(ctx) {
            const roll = Math.floor(ctx.random() * 6) + 1;
            ctx.log(`🎲 Ragno Roulette lancia il dado: ${roll}!`);
            const ownLpKey = Tavolo.chiave(ctx.owner, 'LP');
            switch (roll) {
                case 1: {
                    const currentLp = ctx.gameState[ownLpKey];
                    const halved = Math.floor(currentLp / 2);
                    ctx.dealDamage(ctx.owner, currentLp - halved);
                    ctx.log(`💔 Ragno Roulette dimezza i tuoi LP a ${halved}!`);
                    break;
                }
                case 2:
                    ctx.forceDirectAttack();
                    ctx.log('🎯 Ragno Roulette rende l\'attacco diretto!');
                    break;
                case 3: {
                    const field = ctx.field(ctx.owner);
                    const newIndex = field.findIndex((s, i) => s && i !== ctx.targetIndex);
                    if (newIndex === -1) {
                        ctx.log('🎲 Nessun altro mostro disponibile: il risultato del dado non ha effetto.');
                        break;
                    }
                    ctx.redirectAttack(newIndex);
                    ctx.log(`🔀 Ragno Roulette ridirige l'attacco verso ${field[newIndex].card.name}!`);
                    break;
                }
                case 4: {
                    const enemyField = ctx.field(ctx.opponent);
                    const newIndex = enemyField.findIndex((s, i) => s && i !== ctx.attackerIndex);
                    if (newIndex === -1) {
                        ctx.log('🎲 Nessun altro mostro dell\'avversario disponibile: il risultato del dado non ha effetto.');
                        break;
                    }
                    ctx.redirectAttack(newIndex, ctx.opponent);
                    ctx.log(`🔀 Ragno Roulette ridirige l'attacco verso ${enemyField[newIndex].card.name} (fuoco amico)!`);
                    break;
                }
                case 5:
                    ctx.cancelAttack();
                    ctx.dealDamage(ctx.opponent, ctx.attackerAtk);
                    ctx.log(`🚫 Ragno Roulette annulla l'attacco e infligge ${ctx.attackerAtk} danni!`);
                    break;
                case 6: {
                    const attackerSlot = ctx.field(ctx.opponent)[ctx.attackerIndex];
                    ctx.cancelAttack();
                    ctx.destroyMonster(ctx.opponent, ctx.attackerIndex);
                    if (attackerSlot) ctx.log(`💥 Ragno Roulette distrugge ${attackerSlot.card.name}!`);
                    break;
                }
            }
        }
    });

    // ================================================================
    // 40 — Buco Trappola (Trappola)
    // Quando l'avversario di chi la controlla Evoca Normalmente o gira
    // scoperto (Flip Summon) un mostro con 1000 O PIÙ ATK: lo distrugge.
    // CORREZIONE: la versione precedente includeva erroneamente anche le
    // Special Summon (mai coperte dalla regola vera) e usava una soglia
    // ATK sbagliata (">1000" invece di ">=1000", quindi un mostro con
    // esattamente 1000 ATK non la faceva scattare). ctx.summonedVia
    // ('normal'|'special'|'flip', nuovo campo in duel-engine.js) permette
    // ora di escludere le Special Summon; ctx.summonedPosition === 'attack'
    // resta necessario perché un mostro Set (coperto) non rivela le sue
    // statistiche finché non viene girato scoperto.
    // ================================================================
    CardEffects.register(40, {
        canActivate(ctx) {
            return ctx.summonedVia !== 'special' && ctx.summonedPosition === 'attack' && ctx.summonedCard.attack >= 1000;
        },
        // Il bot spende la Trappola solo su un mostro che vale la carta (1500+ ATK), non sul primo che arriva.
        aiCanActivate(ctx) {
            return !ctx.summonedCard || DuelEngine.getEffectiveAtk(ctx.summonedCard) >= 1500;
        },
        onOpponentSummon(ctx) {
            ctx.declareTargetWaiting(ctx.opponent, ctx.summonedSlotIndex, { totalTargetCount: 1 }, (decl) => {
                if (!decl.allowed) return;
                const target = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (window.FX && typeof FX.playTrapHole === 'function') {
                    FX.playTrapHole(decl.targetOwner, decl.targetIndex, target && target.card);
                }
                ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                ctx.log(`🕳️ Buco Trappola distrugge ${target ? target.card.name : ctx.summonedCard.name}!`);
            });
        }
    });

    // ================================================================
    // 36 — Vaso dell'Avidità (Magia Normale)
    // Pesca 2 carte.
    // ================================================================
    CardEffects.register(36, {
        activate(ctx) {
            const drawn = ctx.drawCards(ctx.owner, 2);
            ctx.log(`🍯 ${ctx.owner === 'player' ? 'Hai pescato' : 'Il bot ha pescato'} ${drawn} cart${drawn === 1 ? 'a' : 'e'} con Anfora dell'Avidità.`);
        }
    });

    // ================================================================
    // 37 — Folgore Fulminante (Magia Normale)
    // Distruggi tutte le carte (mostri + Magie/Trappole) sul Terreno
    // dell'avversario di chi l'ha attivata.
    // ================================================================
    // Folgore Fulminante / Raigeki: distrugge tutti i MOSTRI dell'avversario
    // — non Magie/Trappole (errore di fedeltà corretto in sessione: la
    // vecchia versione usava ctx.destroyAllCards, che spazzava via anche
    // la zona Magia/Trappola, mai stato vero per la carta reale).
    CardEffects.register(37, {
        activate(ctx) {
            ctx.destroyAllMonsters(ctx.opponent);
            ctx.log(`⚡ Folgore Fulminante distrugge tutti i mostri ${ctx.opponent === 'bot' ? 'del bot' : 'del giocatore'}!`);
        }
    });

    // ================================================================
    // 35 — Rinascita del Mostro (Magia Normale)
    // Special Summon di un mostro da un Cimitero, tuo o dell'avversario:
    // il GIOCATORE sceglie sia QUALE mostro (box a scorrimento, come id
    // 23/id 38) sia in QUALE Posizione farlo tornare (nuovo
    // DuelEngineUI.openPositionPicker, stesso popover Attacco/Difesa già
    // usato per l'Evocazione Normale). Anche qui activate(ctx) apre solo
    // il primo box e ritorna subito — la vera Special Summon parte dopo,
    // dentro le callback, esattamente come id 38 (nessuna modifica al
    // motore/alla Chain, che nel frattempo si considera già "risolta").
    // Se a decidere è il BOT (o se questa pagina non ha i box in DOM),
    // resta l'euristica di sempre: il mostro con l'ATK più alto tra i due
    // Cimiteri, evocato in Attacco.
    // ================================================================
    CardEffects.register(35, {
        canActivate(ctx) {
            return ctx.graveyard('player').some((c) => c.type === 'monster' && !DuelEngine.getDefinition(c.id)?.cannotBeSpecialSummoned)
                || ctx.graveyard('bot').some((c) => c.type === 'monster' && !DuelEngine.getDefinition(c.id)?.cannotBeSpecialSummoned);
        },
        activate(ctx) {
            const candidates = [];
            [ctx.owner, ctx.opponent].forEach((graveyardOwner) => {
                ctx.graveyard(graveyardOwner).forEach((card) => {
                    // "Non può essere Special Summonato" (es. i 3 Dei
                    // Egizi, id 30/31/472): esclusi anche da qui, non solo
                    // dalla propria condizione di Evocazione — altrimenti
                    // Rinascita del Mostro potrebbe farli tornare in campo
                    // illegalmente da un Cimitero.
                    if (card.type === 'monster' && !DuelEngine.getDefinition(card.id)?.cannotBeSpecialSummoned) candidates.push({ graveyardOwner, card });
                });
            });
            if (candidates.length === 0) {
                ctx.log('⚠️ Nessun mostro nei Cimiteri da rianimare.');
                return;
            }
            const owner = ctx.owner;
            const reviveWith = (choice, position) => {
                const slotIndex = ctx.findEmptyMonsterSlot(owner);
                if (slotIndex === -1) {
                    ctx.log('⚠️ Il Terreno è pieno: impossibile eseguire la Special Summon.');
                    return;
                }
                const resolveRevival = () => {
                    // Ritrova la carta per uid DOPO la cinematica: durante
                    // una scelta asincrona il Cimitero può essere cambiato.
                    const gy = ctx.graveyard(choice.graveyardOwner);
                    const realIndex = gy.findIndex((c) => c.uid === choice.card.uid);
                    if (realIndex === -1) return;
                    // Controllo qui e non solo in specialSummon: quello guarda il
                    // Cimitero di chi EVOCA, e qui la carta può venire da quello
                    // dell'avversario (lì, bloccata, finirebbe nel Cimitero
                    // sbagliato).
                    if (ctx.graveyardMoveNegated(choice.graveyardOwner)) return;
                    gy.splice(realIndex, 1);
                    // Posizione scelta da chi controlla la Summon: in Difesa, scoperto.
                    ctx.specialSummon(owner, choice.card, slotIndex, position, 'graveyard', { faceUp: true });
                    ctx.log(`🌟 Mostro Resuscitato riporta in campo ${choice.card.name} in Posizione di ${position === 'attack' ? 'Attacco' : 'Difesa'}!`);
                };
                if (window.FX && typeof FX.playMonsterReborn === 'function') {
                    FX.playMonsterReborn(choice.graveyardOwner, choice.card, owner, slotIndex, resolveRevival);
                } else {
                    resolveRevival();
                }
            };
            if (!Decisioni.rispondeUnaPersona(owner)) {
                let best = candidates[0];
                candidates.forEach((c) => { if (c.card.attack > best.card.attack) best = c; });
                reviveWith(best, 'attack');
                return;
            }
            Decisioni.chiedi({
                chi: owner,
                candidati: candidates.map((c) => c.card),
                titolo: '🌟 Mostro Resuscitato',
                testo: 'Scegli quale mostro riportare in campo da uno dei due Cimiteri.'
            }, (card) => {
                if (card === null) return;
                const choice = candidates.find((c) => c.card.uid === card.uid);
                if (!choice) return;
                const slotIndex = ctx.findEmptyMonsterSlot(owner);
                if (slotIndex === -1) {
                    ctx.log('⚠️ Il Terreno è pieno: impossibile eseguire la Special Summon.');
                    return;
                }
                const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
                const anchorEl = PortaUI.query(`#${boardId} .field-slot[data-owner="${owner}"][data-type="monster"][data-index="${slotIndex}"]`);
                Decisioni.chiedi({
                    chi: owner,
                    tipo: 'posizione',
                    ancora: anchorEl,
                    titolo: `${choice.card.name}: Attacco o Difesa?`
                }, (position) => {
                    if (position === null) return;
                    reviveWith(choice, position);
                });
            });
        }
    });

    // ================================================================
    // 47 — Cavaliere Missile (effetto Ignition + onEndPhase)
    // Una volta per turno, puoi farlo tornare in mano a fine turno: se lo
    // fai, in quel turno può attaccare direttamente i Life Points
    // dell'avversario. Attivala cliccando sul mostro scoperto in campo
    // CORREZIONE di fedeltà: la versione precedente (torna in mano a fine
    // turno per poter attaccare direttamente) era interamente inventata,
    // nessuna carta reale corrispondente. Il vero Rocket Warrior: durante
    // la propria Battle Phase non può essere distrutta in battaglia e non
    // si subisce danno da battaglia dai suoi attacchi
    // (cannotBeDestroyedByBattle/preventOwnBattleDamage, entrambi flag
    // generici già esistenti); se attacca un mostro, quel mostro perde
    // 500 ATK fino a fine turno (ctx.grantTemporaryAtkDefBonus).
    CardEffects.register(47, {
        cannotBeDestroyedByBattle: true,
        preventOwnBattleDamage: true,
        onOwnAttackDeclare(ctx) {
            if (ctx.targetIndex === -1) return;
            const targetSlot = ctx.field(ctx.opponent)[ctx.targetIndex];
            if (!targetSlot) return;
            ctx.grantTemporaryAtkDefBonus(targetSlot.card, -500, 0, false);
            ctx.log(`🚀 Cavaliere Missile fa perdere 500 ATK a ${targetSlot.card.name}!`);
        }
    });

    // ================================================================
    // 54 — Muro d'Illusione / Wall of Illusion
    // Se questa carta viene attaccata da un mostro, DOPO il calcolo dei
    // danni: rimanda quel mostro in mano.
    // CORREZIONE: la versione precedente usava onAttackDeclare (PRIMA del
    // calcolo danni) e annullava l'attacco con ctx.cancelAttack() —
    // sbagliato su entrambi i fronti, verificato via YGOPRODeck: il testo
    // reale è "after damage calculation", nessuna cancellazione
    // dell'attacco (il combattimento si risolve normalmente, Muro
    // d'Illusione può anche subire danni/essere distrutto). Corretto
    // riusando lo stesso meccanismo di Testa di Martello Iper (id 800,
    // onBattled — fires a fine Damage Step SOLO se questa carta
    // sopravvive allo scontro): SEMPLIFICAZIONE identica a quella carta,
    // se Muro d'Illusione viene distrutto in questo stesso scontro
    // l'effetto non scatta (onBattled non viene chiamato per una carta
    // che non è sopravvissuta).
    // ================================================================
    CardEffects.register(54, {
        onBattled(ctx) {
            if (!ctx.opponentSurvived) return;
            const idx = ctx.field(ctx.opponent).findIndex((s) => s && s.card.uid === ctx.opponentCard.uid);
            if (idx === -1) return;
            const name = ctx.opponentCard.name;
            ctx.returnMonsterToHand(ctx.opponent, idx);
            ctx.log(`🧱 Muro Illusorio rimanda ${name} in mano dopo il calcolo dei danni!`);
        }
    });

    // ================================================================
    // 56 — Rito del Guerriero Nero (Magia Rituale)
    // Sacrifica mostri dal Terreno E/O dalla mano per un Livello totale
    // di almeno 8 (performRitualTribute/maxRitualTributeLevel qui sopra —
    // CORREZIONE di fedeltà: prima solo dal Terreno, la regola reale di
    // ogni Evocazione Rituale permette anche la mano), poi Special
    // Summon Guerriero Nero Supremo (id 55) dalla mano.
    // SEMPLIFICAZIONE: sceglie da sola quali mostri sacrificare (i meno
    // possibile per raggiungere il totale, partendo dai Livelli più alti),
    // invece di una selezione manuale come nell'Evocazione Tributo — nello
    // stesso spirito delle altre semplificazioni dichiarate in cima a
    // js/engine/duel-engine.js.
    // ================================================================
    CardEffects.register(56, {
        canActivate(ctx) {
            const handIndex = ctx.hand(ctx.owner).findIndex((c) => c.id === 55);
            if (handIndex === -1) return false;
            return maxRitualTributeLevel(ctx, handIndex) >= 8;
        },
        activate(ctx) {
            const handIndex = ctx.hand(ctx.owner).findIndex((c) => c.id === 55);
            if (handIndex === -1) return; // canActivate l'ha già garantito: non dovrebbe succedere
            performRitualTribute(ctx, 8, handIndex);

            const hand = ctx.hand(ctx.owner);
            const finalHandIndex = hand.findIndex((c) => c.id === 55);
            if (finalHandIndex === -1) return;
            const [ritualCard] = hand.splice(finalHandIndex, 1);

            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) {
                // Il Terreno è pieno: il mostro rituale finisce comunque
                // nel Cimitero, invece di sparire nel nulla.
                ctx.graveyard(ctx.owner).push(ritualCard);
                ctx.log('⚠️ Il Terreno è pieno: Glorioso Soldato Nero finisce nel Cimitero.');
                return;
            }
            ctx.specialSummon(ctx.owner, ritualCard, slotIndex, 'attack', 'hand');
            ctx.log('⚔️ Rito della Gloria Nera evoca Glorioso Soldato Nero!');
        }
    });

    // ================================================================
    // 55 — Guerriero Nero Supremo / Supreme Dark Warrior: Evocabile
    // Rituale solo tramite "Rito della Gloria Nera" (id 56, qui sopra —
    // GIÀ IMPLEMENTATA). Qui serve solo il divieto di Evocazione
    // Normale/Set e di Special Summon per ogni altra via
    // (cannotNormalSummon/cannotBeSpecialSummoned — stesso schema di 413).
    // ================================================================
    CardEffects.register(55, {
        cannotNormalSummon: true,
        cannotBeSpecialSummoned: true
    });

    // ================================================================
    // 20 — Buster Blader (buff continuo)
    // Guadagna 500 ATK per ogni mostro Tipo Drago controllato dal tuo
    // avversario (scoperto) o nel suo Cimitero.
    // ================================================================
    CardEffects.register(20, {
        static(ctx) {
            const onField = ctx.field(ctx.opponent).filter((slot) => slot && !slot.isFaceDown && slot.card.race === 'Drago').length;
            const inGraveyard = ctx.graveyard(ctx.opponent).filter((c) => c.race === 'Drago').length;
            gameState.atkDefBonus[ctx.card.uid] = { atk: (onField + inGraveyard) * 500, def: 0 };
        }
    });

    // ================================================================
    // 16 — Gearfried il Cavaliere di Ferro (rifiuta le Carte Equipaggiamento)
    // Se un giocatore qualsiasi equipaggia una Carta Equipaggiamento a
    // questa carta: distruggi quella Carta Equipaggiamento.
    // SEMPLIFICAZIONE: rejectsEquip esclude Gearfried a monte dalla scelta
    // automatica del bersaglio di ogni Carta Equipaggiamento (vedi
    // findEquipTarget in testa a questo file), invece di lasciarlo
    // equipaggiare per un istante e poi distruggere subito la carta.
    // ================================================================
    CardEffects.register(16, {
        rejectsEquip: true
    });

    // ================================================================
    // 17 — Jinzo (effetto CONTINUO del mostro, non un'attivazione)
    // Finché Jinzo è scoperto sul campo, le Trappole SUL TERRENO perdono
    // il loro effetto — di ENTRAMBI i giocatori, non solo dell'avversario
    // (testo reale: "Negate all Trap effects on the field"; bug corretto
    // qui: la versione precedente negava solo gameState.trapsNegatedFor[ctx.opponent],
    // lasciando immuni le proprie Trappole).
    // Amplificatore (id 92, Equip esclusivo per questa carta) restringe
    // la negazione al solo lato avversario quando equipaggiato — override
    // qui, non nell'Equip stesso, perché è più semplice controllare da
    // Jinzo "ho Amplificatore addosso?" che far combaciare due static()
    // diversi sullo stesso flag booleano condiviso.
    // ================================================================
    CardEffects.register(17, {
        static(ctx) {
            const hasAmplifier = Tavolo.ordine().some((o) =>
                ctx.stField(o).some((s) => s && !s.isFaceDown && s.card.id === 92 && s.card.equippedToUid === ctx.card.uid)
            );
            if (hasAmplifier) {
                gameState.trapsNegatedFor[ctx.opponent] = true;
            } else {
                gameState.trapsNegatedFor.player = true;
                gameState.trapsNegatedFor.bot = true;
            }
        }
    });

    // ================================================================
    // 22 — Kuriboh (effetto attivabile DALLA MANO)
    // Puoi scartare Kuriboh dalla mano per annullare tutto il danno di
    // UN attacco diretto subito.
    //
    // SEMPLIFICAZIONE: limitato all'attacco diretto (nessun mostro come
    // bersaglio), per evitare l'ambiguità delle regole vere su cosa
    // succede al confronto ATK/DEF quando il danno da battaglia coinvolge
    // entrambi i lati — qui il danno da negare è sempre e solo quello
    // che subirebbe chi controlla Kuriboh.
    // ================================================================
    CardEffects.register(22, {
        canActivate(ctx) {
            return ctx.targetIndex === -1;
        },
        onAttackDeclare(ctx) {
            ctx.negateDamage();
            ctx.log('🐰 Kuriboh si scarta e annulla tutto il danno di questo attacco!');
        }
    });

    // ================================================================
    // 859-862 — I "fratelli Kuriboh": Kuribah, Kuribee, Kuriboo, Kuribeh
    // (aggiunti come bersagli Special Summon di Crepuscolo a Cinque
    // Stelle id 244 — vedi lì). Effetti propri implementati qui dove
    // ragionevolmente indipendenti da altre carte mancanti dal database
    // (Kuribabylon per Kuribah, Kuribandit id 334 già presente per
    // Kuribeh — solo la sua clausola con Kuribandit è implementata, non
    // quella con Kuribabylon che non esiste qui).
    // ================================================================

    // 859 — Kuribah: quando questa carta, o un altro mostro "Kuriboh"
    // controllato, viene mandato al Cimitero: Special Summon 1 mostro
    // 300 ATK/200 DEF dal Deck, tranne Kuribah (una volta per turno).
    // Riusa il broadcast onOwnMonsterDestroyedPassive (duel-engine.js,
    // introdotto per Uovo Giurassico Miracoloso id 808), ora esteso con
    // ctx.destroyedInBattle così può rispettare "distrutta IN BATTAGLIA"
    // come da testo reale, invece di reagire a QUALUNQUE distruzione.
    // SEMPLIFICAZIONE residua: manca il sacrificio con altri 4 "fratelli
    // Kuriboh" per Special Summonare "Kuribabylon" (carta non presente in
    // questo database).
    CardEffects.register(859, {
        onOwnMonsterDestroyedPassive(ctx) {
            if (!ctx.destroyedInBattle) return;
            const kuribohIds = [22, 859, 860, 861, 862];
            if (!ctx.destroyedCard || !kuribohIds.includes(ctx.destroyedCard.id)) return;
            if (ctx.hasUsedOncePerTurn(`859:${ctx.card.uid}`)) return;
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            const opened = searchDeckWithChoice(ctx, (c) => c.id !== 859 && c.type === 'monster' && c.attack === 300 && c.defense === 200, {
                title: '🐿️ Kuribah',
                text: 'Scegli quale mostro (300 ATK/200 DEF) Special Summonare dal Deck.'
            }, (card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) { ctx.graveyard(ctx.owner).push(card); return; }
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
                ctx.log(`🐿️ Kuribah Special Summona ${card.name} dal Deck!`);
            });
            if (opened) ctx.markUsedOncePerTurn(`859:${ctx.card.uid}`);
        }
    });

    // 860 — Kuribee: quando questa carta, o un altro mostro "Kuriboh"
    // controllato, viene mandato al Cimitero: aggiungi alla mano 1
    // Magia/Trappola dal Deck che nomini "Kuriboh" nel testo (una volta
    // per turno). Una volta per turno, quando un mostro dell'avversario
    // dichiara un attacco mentre controlli un altro mostro "Kuriboh":
    // azzera l'ATK di tutti gli altri propri mostri fino a fine turno, e
    // se lo fai, annulla l'attacco.
    // ctx.destroyedInBattle (stessa estensione di Kuribah/id 859, vedi lì)
    // rispetta "distrutta in battaglia" come da testo reale.
    CardEffects.register(860, {
        onOwnMonsterDestroyedPassive(ctx) {
            if (!ctx.destroyedInBattle) return;
            const kuribohIds = [22, 859, 860, 861, 862];
            if (!ctx.destroyedCard || !kuribohIds.includes(ctx.destroyedCard.id)) return;
            if (ctx.hasUsedOncePerTurn(`860-add:${ctx.card.uid}`)) return;
            const opened = searchDeckWithChoice(ctx, (c) => (c.type === 'spell' || c.type === 'trap') && c.effect && c.effect.includes('Kuriboh'), {
                title: '🐿️ Kuribee',
                text: 'Scegli quale Magia/Trappola "Kuriboh" aggiungere alla mano dal Deck.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`🐿️ Kuribee aggiunge ${card.name} dal Deck alla mano!`);
            });
            if (opened) ctx.markUsedOncePerTurn(`860-add:${ctx.card.uid}`);
        },
        onAttackDeclare(ctx) {
            if (ctx.hasUsedOncePerTurn(`860-negate:${ctx.card.uid}`)) return;
            const kuribohIds = [22, 859, 861, 862];
            const hasOtherKuriboh = ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && kuribohIds.includes(slot.card.id));
            if (!hasOtherKuriboh) return;
            ctx.markUsedOncePerTurn(`860-negate:${ctx.card.uid}`);
            ctx.field(ctx.owner).forEach((slot) => {
                if (slot && slot.card.uid !== ctx.card.uid) ctx.grantTemporaryAtkDefBonus(slot.card, -DuelEngine.getEffectiveAtk(slot.card), 0, false);
            });
            ctx.cancelAttack();
            ctx.log('🐿️ Kuribee azzera l\'ATK dei propri mostri e annulla l\'attacco!');
        }
    });

    // 861 — Kuriboo: quando un mostro dell'avversario dichiara un
    // attacco: puoi scartare questa carta; aggiungi alla mano 1 mostro
    // "Kuriboh" dal Deck, tranne Kuriboo. Una volta per turno (Effetto
    // Rapido, attivabile dalla mano): scarta 1 Trappola, poi 1 mostro
    // scoperto dell'avversario perde 1500 ATK fino a fine turno.
    // Nessun canActivate condiviso: le due abilità sono indipendenti
    // (una reattiva automatica, una manuale), ciascuna verifica da sola
    // le proprie condizioni e non fa nulla se non soddisfatte.
    CardEffects.register(861, {
        activate(ctx) {
            if (ctx.hasUsedOncePerTurn(`861:${ctx.card.uid}`)) return;
            const hand = ctx.hand(ctx.owner);
            const trapIndex = hand.findIndex((c) => c.type === 'trap' && c.uid !== ctx.card.uid);
            if (trapIndex === -1) return;
            const oppField = ctx.field(ctx.opponent);
            let targetIndex = -1;
            let bestAtk = -1;
            oppField.forEach((slot, i) => {
                if (slot && !slot.isFaceDown && DuelEngine.getEffectiveAtk(slot.card) > bestAtk) { bestAtk = DuelEngine.getEffectiveAtk(slot.card); targetIndex = i; }
            });
            if (targetIndex === -1) return;
            const decl = ctx.declareTarget(ctx.opponent, targetIndex, { totalTargetCount: 1 });
            if (!decl.allowed) return;
            const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
            if (!finalSlot) return;
            ctx.markUsedOncePerTurn(`861:${ctx.card.uid}`);
            const [trapCard] = hand.splice(trapIndex, 1);
            ctx.graveyard(ctx.owner).push(trapCard);
            ctx.grantTemporaryAtkDefBonus(finalSlot.card, -1500, 0, false);
            ctx.log(`🐿️ Kuriboo scarta ${trapCard.name}: ${finalSlot.card.name} perde 1500 ATK fino a fine turno!`);
        },
        onAttackDeclare(ctx) {
            const hand = ctx.hand(ctx.owner);
            const ownIndex = hand.indexOf(ctx.card);
            if (ownIndex === -1) return;
            const kuribohIds = [22, 859, 860, 862];
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            if (!Array.isArray(deck) || !deck.some((c) => kuribohIds.includes(c.id))) return;
            // Il costo (scartare questa carta) va pagato SOLO se esiste
            // almeno un "Kuriboh" da cercare — controllato appena sopra,
            // PRIMA di scartare, per non pagare un costo a vuoto — poi la
            // vera scelta tra i candidati passa da searchDeckWithChoice.
            hand.splice(ownIndex, 1);
            ctx.graveyard(ctx.owner).push(ctx.card);
            searchDeckWithChoice(ctx, (c) => kuribohIds.includes(c.id), {
                title: '🐿️ Kuriboo',
                text: 'Scegli quale mostro "Kuriboh" aggiungere alla mano dal Deck.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`🐿️ Kuriboo si scarta: aggiunge ${card.name} dal Deck alla mano!`);
            });
        }
    });

    // 862 — Kuribeh: due effetti alternativi.
    // 1) (Effetto Rapido, attivabile dalla mano) scarta questa carta; 1
    //    mostro "Kuriboh" controllato guadagna 1500 ATK.
    // 2) Sacrifica questa carta e 1 ciascuno degli altri 4 "fratelli
    //    Kuriboh" (dalla mano e/o dal Terreno); cerca "Kuribandito" (id
    //    334) nel Deck o nel Cimitero, poi puoi Evocare Normalmente 1
    //    mostro Demone dalla mano — implementata come branca aggiuntiva
    //    dentro la stessa activate() (preferita quando disponibile,
    //    essendo nettamente più forte), invece di una seconda superficie
    //    di attivazione: nessun'altra carta di questo file offre due
    //    effetti alternativi dallo stesso pulsante "Attiva", quindi non
    //    esiste un pattern di scelta già pronto da riusare per una
    //    combinazione così di nicchia (richiede tutti e 5 i fratelli
    //    contemporaneamente). L'Evocazione Normale extra riusa lo stesso
    //    schema Ignition-auto-risolvente di Legion il Giullare Demoniaco
    //    (id 346, vedi lì): non tocca gameState.hasNormalSummoned,
    //    scatena comunque TRIGGER.ON_NORMAL_SUMMON.
    function kuribehFindSibling(ctx, id) {
        const handIndex = ctx.hand(ctx.owner).findIndex((c) => c.id === id);
        if (handIndex !== -1) return { zone: 'hand', index: handIndex };
        const fieldIndex = ctx.field(ctx.owner).findIndex((s) => s && !s.isFaceDown && s.card.id === id);
        if (fieldIndex !== -1) return { zone: 'field', index: fieldIndex };
        return null;
    }
    function kuribehHasFullSiblingCombo(ctx) {
        return [22, 859, 860, 861].every((id) => kuribehFindSibling(ctx, id) !== null);
    }
    CardEffects.register(862, {
        canActivate(ctx) {
            if (kuribehHasFullSiblingCombo(ctx)) return true;
            return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.uid !== ctx.card.uid && [22, 859, 860, 861].includes(slot.card.id));
        },
        activate(ctx) {
            if (kuribehHasFullSiblingCombo(ctx)) {
                const hand = ctx.hand(ctx.owner);
                const field = ctx.field(ctx.owner);
                [22, 859, 860, 861].forEach((id) => {
                    const loc = kuribehFindSibling(ctx, id);
                    if (!loc) return;
                    if (loc.zone === 'hand') {
                        const [card] = hand.splice(loc.index, 1);
                        ctx.graveyard(ctx.owner).push(card);
                    } else {
                        const card = field[loc.index].card;
                        field[loc.index] = null;
                        ctx.graveyard(ctx.owner).push(card);
                    }
                });
                // Rimuove QUESTA carta da dove si trova davvero (mano o
                // Terreno, ctx.zone — questa clausola, a differenza del
                // primo Effetto Rapido, funziona da entrambe le zone).
                if (ctx.zone === 'monster') {
                    field[ctx.index] = null;
                } else {
                    const ownIndex = hand.indexOf(ctx.card);
                    if (ownIndex !== -1) hand.splice(ownIndex, 1);
                }
                ctx.graveyard(ctx.owner).push(ctx.card);
                ctx.log('🐿️ Kuribeh sacrifica tutti e 5 i fratelli Kuriboh!');
                const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
                const deck = gameState[deckKey];
                let kuribandit = null;
                if (Array.isArray(deck)) {
                    const deckIndex = deck.findIndex((c) => c.id === 334);
                    if (deckIndex !== -1) {
                        [kuribandit] = deck.splice(deckIndex, 1);
                        gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
                    }
                }
                if (!kuribandit) {
                    const graveIndex = ctx.graveyard(ctx.owner).findIndex((c) => c.id === 334);
                    if (graveIndex !== -1 && !ctx.graveyardMoveNegated(ctx.owner)) [kuribandit] = ctx.graveyard(ctx.owner).splice(graveIndex, 1);
                }
                if (kuribandit) {
                    hand.push(kuribandit);
                    ctx.log(`🐿️ Kuribeh aggiunge ${kuribandit.name} alla mano!`);
                }
                const demonIndex = hand.findIndex((c) => c.type === 'monster' && !c.extraDeck && c.race === 'Demone' && getTributesRequired(c) === 0);
                if (demonIndex !== -1) {
                    const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                    if (slotIndex !== -1) {
                        const [demon] = hand.splice(demonIndex, 1);
                        field[slotIndex] = { card: demon, position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedOnTurn: gameState.turn };
                        ctx.log(`🐿️ Kuribeh: Evocazione Normale extra di ${demon.name}!`);
                        DuelEngine.fireTrigger(DuelEngine.TRIGGER.ON_NORMAL_SUMMON, DuelEngine.makeContext(ctx.owner, { summonedCard: demon, summonedSlotIndex: slotIndex, summonedPosition: 'attack' }));
                    }
                }
                return;
            }
            const fratelli = collectFieldTargets(ctx, {
                zone: 'monster', owner: 'self',
                filter: (card) => card.uid !== ctx.card.uid && [22, 859, 860, 861].includes(card.id)
            });
            if (fratelli.length === 0) return;
            // Lo scarto di questa carta vive DENTRO la callback: e' il costo
            // dell'effetto, e pagarlo prima della scelta significherebbe
            // perderla anche se la scelta non arrivasse mai a compiersi.
            chooseFieldCardTarget(ctx, fratelli, {
                title: '🐿️ Kuribeh',
                dichiara: true,
                text: 'Scegli quale "Kuriboh" riceve i 1500 ATK.'
            }, (scelto) => {
                const slot = ctx.field(scelto.owner)[scelto.index];
                if (!slot || slot.card.uid !== scelto.card.uid) return;
                const hand = ctx.hand(ctx.owner);
                const ownIndex = hand.indexOf(ctx.card);
                if (ownIndex !== -1) hand.splice(ownIndex, 1);
                ctx.graveyard(ctx.owner).push(ctx.card);
                ctx.grantTemporaryAtkDefBonus(slot.card, 1500, 0, false);
                ctx.log(`🐿️ Kuribeh si scarta: ${slot.card.name} guadagna 1500 ATK fino a fine turno!`);
            });
        }
    });

    // ================================================================
    // 59 — Carica dell'Anima / Soul Charge (Magia Normale)
    // Special Summon di un NUMERO QUALSIASI (scelto dal giocatore) di
    // mostri dal Cimitero, perdendo 1000 LP PER OGNI mostro, poi impedisce
    // la propria Battle Phase in questo turno (gameState.skipBattlePhaseFor,
    // stesso meccanismo già costruito per Makiu/id 366) — selezione
    // ripetuta con DuelEngineUI.openCardListPicker (stesso schema di
    // Maglio Magico/id 768), fermata anche automaticamente quando il
    // Terreno si riempie. Il bot (nessuna vera IA dedicata per questa
    // scelta) rianima quanti più mostri possibile dal più forte al più
    // debole, come prima.
    // ================================================================
    function finishSoulCharge(ctx, summonedUids) {
        if (summonedUids.length === 0) return;
        ctx.dealDamage(ctx.owner, 1000 * summonedUids.length);
        gameState.skipBattlePhaseFor = gameState.skipBattlePhaseFor || {};
        gameState.skipBattlePhaseFor[ctx.owner] = true;
        ctx.log(`👻 Carica Anime riporta in campo ${summonedUids.join(', ')} e ti costa ${1000 * summonedUids.length} Life Points! Non puoi condurre la Battle Phase in questo turno.`);
    }
    function pickSoulChargeTargets(ctx, summonedUids) {
        const grave = ctx.graveyard(ctx.owner);
        const eligible = grave.filter((c) => c.type === 'monster' && !DuelEngine.getDefinition(c.id)?.cannotBeSpecialSummoned);
        if (eligible.length === 0 || ctx.findEmptyMonsterSlot(ctx.owner) === -1) { finishSoulCharge(ctx, summonedUids); return; }
        Decisioni.chiedi({
            chi: ctx.owner,
            candidati: eligible,
            titolo: '👻 Carica dell\'Anima',
            testo: `Scegli 1 mostro dal Cimitero da Special Summonare, o chiudi per fermarti qui (${summonedUids.length} finora).`,
            annullabile: true
        }, (card) => {
            if (card === null) {
                finishSoulCharge(ctx, summonedUids);
                return;
            }
            const realIndex = grave.indexOf(card);
            if (realIndex === -1) { pickSoulChargeTargets(ctx, summonedUids); return; }
            const [summoned] = grave.splice(realIndex, 1);
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            ctx.specialSummon(ctx.owner, summoned, slotIndex, 'attack', 'graveyard');
            summonedUids.push(summoned.name);
            pickSoulChargeTargets(ctx, summonedUids);
        });
    }
    CardEffects.register(59, {
        canActivate(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster' && !DuelEngine.getDefinition(c.id)?.cannotBeSpecialSummoned) && ctx.findEmptyMonsterSlot(ctx.owner) !== -1;
        },
        activate(ctx) {
            if (Decisioni.rispondeUnaPersona(ctx.owner)) {
                pickSoulChargeTargets(ctx, []);
                return;
            }
            const grave = ctx.graveyard(ctx.owner);
            const eligible = grave
                .map((c, i) => ({ card: c, index: i }))
                .filter((e) => e.card.type === 'monster' && !DuelEngine.getDefinition(e.card.id)?.cannotBeSpecialSummoned)
                .sort((a, b) => b.card.attack - a.card.attack);
            const summonedUids = [];
            eligible.forEach((entry) => {
                if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
                const realIndex = grave.findIndex((c) => c.uid === entry.card.uid);
                if (realIndex === -1) return;
                const [card] = grave.splice(realIndex, 1);
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'graveyard');
                summonedUids.push(card.name);
            });
            finishSoulCharge(ctx, summonedUids);
        }
    });

    // ================================================================
    // 451 — Scambio di Anime / Soul Exchange (Magia Normale)
    // SEMPLIFICAZIONE: la carta vera designa un mostro avversario da
    // usare come Tributo nella TUA prossima Evocazione Tributo; questo
    // motore non ha un aggancio per "il prossimo Tributo di questo
    // turno", quindi qui distrugge direttamente il mostro scoperto più
    // forte dell'avversario, nello stesso spirito di Faglia (id 243).
    // (Spostato qui da id 61 durante la pulizia dei doppioni.)
    // ================================================================
    CardEffects.register(451, {
        declaredTargeting: { count: 1, cardType: 'monster' },
        canActivate(ctx) {
            return ctx.field(ctx.opponent).some((slot) => slot && !slot.isFaceDown);
        },
        activate(ctx) {
            const field = ctx.field(ctx.opponent);
            let bestIndex = -1;
            let bestCard = null;
            field.forEach((slot, i) => {
                if (slot && !slot.isFaceDown && (!bestCard || slot.card.attack > bestCard.attack)) { bestCard = slot.card; bestIndex = i; }
            });
            if (bestIndex === -1) return;
            ctx.declareTargetWaiting(ctx.opponent, bestIndex, { totalTargetCount: 1 }, (decl) => {
                if (!decl.allowed) return;
                const target = ctx.field(decl.targetOwner)[decl.targetIndex];
                ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                ctx.log(`🔄 Scambio di Anime costringe il tuo avversario a cedere ${target ? target.card.name : bestCard.name}!`);
            });
        }
    });

    // ================================================================
    // 69 — Stop Difesa / Stop Defense (Magia Normale)
    // Cambia in Posizione di Attacco un mostro in Posizione di Difesa
    // controllato dal tuo avversario (auto-selezionato: quello con la
    // DEF più bassa, stesso spirito di auto-selezione di Faglia id 243).
    // ================================================================
    CardEffects.register(69, {
        declaredTargeting: { count: 1, cardType: 'monster' },
        canActivate(ctx) {
            return ctx.field(ctx.opponent).some((slot) => slot && slot.position === 'defense');
        },
        activate(ctx) {
            const field = ctx.field(ctx.opponent);
            let targetIndex = -1;
            let lowestDef = Infinity;
            field.forEach((slot, i) => {
                if (slot && slot.position === 'defense' && slot.card.defense < lowestDef) { lowestDef = slot.card.defense; targetIndex = i; }
            });
            if (targetIndex === -1) return;
            ctx.declareTargetWaiting(ctx.opponent, targetIndex, { totalTargetCount: 1 }, (decl) => {
                if (!decl.allowed) return;
                const slot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!slot) return;
                ctx.changePosition(decl.targetOwner, decl.targetIndex, 'attack');
                slot.isFaceDown = false;
                ctx.log(`⚔️ Blocca Difesa costringe ${slot.card.name} in Posizione di Attacco!`);
            });
        }
    });

    // ================================================================
    // 460 — Dado di Evocazione / Summon Dice (Magia Normale)
    // Paga 1000 Life Points (costo fisso, come sulla carta vera) e tira
    // un dado a sei facce: 1-2 puoi Evocare Normalmente, 3-4 Special
    // Summon dal tuo Cimitero, 5-6 Special Summon dalla mano un mostro
    // di Livello 5+. Stesse auto-selezioni "il migliore disponibile" già
    // usate da Rinascita del Mostro (id 35) e Carica dell'Anima (id 59).
    // (Spostato qui da id 72 durante la pulizia dei doppioni.)
    // ================================================================
    // CORREZIONE di fedeltà: aggiunto "puoi attivare solo 1 'Dado di
    // Evocazione' per turno" (mancava) — per NOME, quindi vale anche fra
    // copie diverse della stessa carta, non solo per la singola carta.
    CardEffects.register(460, {
        hasDiceRollEffect: true,
        canActivate(ctx) {
            return !ctx.hasUsedOncePerTurn(`460:${ctx.owner}`);
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`460:${ctx.owner}`);
            ctx.dealDamage(ctx.owner, 1000);
            const roll = Math.floor(ctx.random() * 6) + 1;
            if (window.FX) FX.playDiceRoll(roll);
            ctx.log(`🎲 Dado di Evocazione: hai tirato un ${roll}!`);
            if (roll <= 2) {
                gameState.hasNormalSummoned = false;
                ctx.log('➡️ Puoi Evocare Normalmente un mostro questo turno.');
            } else if (roll <= 4) {
                const grave = ctx.graveyard(ctx.owner);
                let bestIndex = -1;
                let bestCard = null;
                grave.forEach((c, i) => {
                    if (c.type === 'monster' && (!bestCard || c.attack > bestCard.attack)) { bestCard = c; bestIndex = i; }
                });
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (bestCard && slotIndex !== -1) {
                    grave.splice(bestIndex, 1);
                    ctx.specialSummon(ctx.owner, bestCard, slotIndex, 'attack', 'graveyard');
                    ctx.log(`➡️ Special Summon di ${bestCard.name} dal Cimitero!`);
                } else {
                    ctx.log('➡️ Nessun mostro disponibile nel Cimitero.');
                }
            } else {
                const hand = ctx.hand(ctx.owner);
                const handIndex = hand.findIndex((c) => c.type === 'monster' && c.level >= 5);
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (handIndex !== -1 && slotIndex !== -1) {
                    const [card] = hand.splice(handIndex, 1);
                    ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'graveyard');
                    ctx.log(`➡️ Special Summon di ${card.name} dalla mano!`);
                } else {
                    ctx.log('➡️ Nessun mostro di Livello 5+ disponibile in mano.');
                }
            }
        }
    });

    // ================================================================
    // 462 — Cacciatore di Spade / Sword Hunter
    // Alla fine della Battle Phase, se questa carta ha distrutto in
    // battaglia dei mostri dell'avversario in quella Battle Phase: li
    // recupera dal Cimitero DELL'AVVERSARIO (un mostro distrutto in
    // battaglia va sempre al Cimitero del suo vero proprietario, mai a
    // quello di chi lo ha distrutto) e li equipaggia a se stessa
    // (guadagna 200 ATK per ognuno). Usa il nuovo hook
    // def.onDestroysMonsterInBattle (applyBattleDestroyBonus, actions.js
    // — già esteso con ctx.destroyedCard per Divoratempo id 480) per
    // accumulare i bersagli distrutti in ctx.card._swordHunterPending,
    // poi li processa tutti in blocco al trigger 'onBattlePhaseEnd' (già
    // esistente, usato anche da Bestia Mitica Cerbero id 734/Cavaliere
    // del Miraggio id 381) — a differenza di un vero Equip Spell, questi
    // "trofei" sono semplici carte Mostro senza un proprio isEquip/
    // static(): il bonus li conta direttamente nello static() di
    // Cacciatore di Spade stesso (equippedToUid === ctx.card.uid), ed
    // onDestroy li rimanda tutti al Cimitero del loro vero proprietario
    // se Cacciatore di Spade stesso viene distrutto.
    // ================================================================
    CardEffects.register(462, {
        onDestroysMonsterInBattle(ctx) {
            if (!ctx.destroyedCard) return;
            ctx.card._swordHunterPending = ctx.card._swordHunterPending || [];
            ctx.card._swordHunterPending.push(ctx.destroyedCard);
        },
        onBattlePhaseEnd(ctx) {
            const pending = ctx.card._swordHunterPending;
            ctx.card._swordHunterPending = [];
            if (!pending || pending.length === 0) return;
            // I mostri distrutti in battaglia da Cacciatore di Spade sono
            // sempre dell'avversario (non si può distruggere in battaglia
            // un proprio mostro): finiscono quindi nel Cimitero
            // dell'AVVERSARIO, mai nel proprio — da lì vanno recuperati.
            if (ctx.graveyardMoveNegated(ctx.opponent)) return;
            const grave = ctx.graveyard(ctx.opponent);
            pending.forEach((victim) => {
                const idx = grave.indexOf(victim);
                if (idx === -1) return;
                const freeStSlot = ctx.stField(ctx.owner).findIndex((s) => s === null);
                if (freeStSlot === -1) return;
                grave.splice(idx, 1);
                victim.equippedToOwner = ctx.owner;
                victim.equippedToIndex = ctx.field(ctx.owner).findIndex((s) => s && s.card.uid === ctx.card.uid);
                victim.equippedToUid = ctx.card.uid;
                ctx.stField(ctx.owner)[freeStSlot] = { card: victim, isFaceDown: false, setOnTurn: gameState.turn };
                ctx.log(`⚔️ Cacciatore di Spada equipaggia ${victim.name} dal Cimitero (+200 ATK)!`);
            });
        },
        onDestroy(ctx) {
            const st = ctx.stField(ctx.owner);
            st.forEach((slot, i) => {
                if (slot && slot.card.equippedToUid === ctx.card.uid) {
                    // Torna al Cimitero del suo VERO proprietario (l'avversario), non a quello di chi controllava Cacciatore di Spade.
                    ctx.graveyard(ctx.opponent).push(slot.card);
                    st[i] = null;
                }
            });
        },
        static(ctx) {
            const attachedCount = ctx.stField(ctx.owner).filter((slot) => slot && slot.card.equippedToUid === ctx.card.uid).length;
            if (attachedCount === 0) return;
            const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk + attachedCount * 200, def: e.def };
        }
    });

    // ================================================================
    // 23 — Insetto Divoratore / Man-Eater Bug (effetto FLIP)
    // Quando questa carta viene girata scoperta (Flip), distruggi 1
    // mostro scoperto sul Terreno: il GIOCATORE sceglie quale, con lo
    // stesso box di scelta a scorrimento (DuelEngineUI.openCardListPicker)
    // già usato per Fusione (id 38) — apre il box e ritorna subito, la
    // distruzione vera parte dopo, dentro onSelect, quando il giocatore
    // clicca una carta: resolveBattleDamage/il resto della battaglia in
    // corso in quel momento non aspettano questa scelta, esattamente come
    // per id 38 (nessuna modifica richiesta al motore). Se a decidere è il
    // BOT (o se questa pagina non ha il box in DOM), resta l'euristica di
    // sempre: il mostro scoperto con l'ATK più alto tra i due Terreni
    // (mai se stesso), stesso spirito di Faglia (id 243).
    // (Spostato qui da id 49 "Insetto Divoratore Mostruoso" — stesso
    // identico effetto reale, duplicato per errore durante la creazione
    // originale del database: entrambe le carte rappresentavano "Man-Eater
    // Bug".)
    // ================================================================
    CardEffects.register(23, {
        onFlip(ctx) {
            const candidates = [];
            [ctx.opponent, ctx.owner].forEach((fieldOwner) => {
                ctx.field(fieldOwner).forEach((slot, index) => {
                    if (fieldOwner === ctx.owner && index === ctx.slotIndex) return; // mai se stesso
                    if (slot && !slot.isFaceDown) candidates.push({ owner: fieldOwner, index, card: slot.card });
                });
            });
            if (candidates.length === 0) {
                ctx.log('🐛 Insetto Mangia-Uomini si rivela, ma non c\'è nessun mostro scoperto da distruggere.');
                return;
            }
            // Ritrova lo slot per uid al momento della distruzione vera (non
            // per indice, che nel frattempo potrebbe non essere più valido
            // se la scelta è asincrona) e controlla che sia ancora lì.
            const destroy = (choice) => {
                const slot = ctx.field(choice.owner)[choice.index];
                if (!slot || slot.card.uid !== choice.card.uid) return;
                const decl = ctx.declareTarget(choice.owner, choice.index, { totalTargetCount: 1 });
                if (!decl.allowed) return;
                const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!finalSlot) return;
                ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                ctx.log(`🐛 Insetto Mangia-Uomini, girato scoperto, distrugge ${finalSlot.card.name}!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) {
                let best = candidates[0];
                candidates.forEach((c) => { if (c.card.attack > best.card.attack) best = c; });
                destroy(best);
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates.map((c) => c.card),
                titolo: '🐛 Insetto Mangia-Uomini',
                testo: 'Scegli quale mostro scoperto sul Terreno distruggere.'
            }, (card) => {
                if (card === null) return;
                const choice = candidates.find((c) => c.card.uid === card.uid);
                if (choice) destroy(choice);
            });
        }
    });

    // ================================================================
    // 71 — Suijin (risposta quando attaccata)
    // Durante il calcolo dei danni, se questa carta viene attaccata: puoi
    // rendere pari a 0 l'ATK del mostro attaccante — stesso meccanismo di
    // risposta di Muro d'Illusione (id 54) qui sopra, ma senza annullare
    // l'attacco: l'ATK diventa 0 SOLO per il confronto di questa battaglia
    // (vedi zeroAttackerAtk in declareCtx, actions.js).
    // ================================================================
    // CORREZIONE di fedeltà: mancava "utilizzabile una sola volta finché
    // questa carta resta scoperta sul Terreno" — stesso schema già
    // corretto per Kazejin (id 324, kazejinUsed sullo SLOT, non sulla
    // carta: così una nuova copia evocata in seguito riparte da zero).
    CardEffects.register(71, {
        canActivate(ctx) {
            const slot = ctx.field(ctx.owner)[ctx.index];
            return !!slot && !slot.suijinUsed;
        },
        onAttackDeclare(ctx) {
            ctx.zeroAttackerAtk();
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (slot) slot.suijinUsed = true;
            ctx.log("💧 Suijin azzera l'ATK del mostro attaccante per questo scontro (effetto usabile una sola volta finché scoperta)!");
        }
    });

    // ================================================================
    // 74 — Guardiano della Palude / Swamp Battleguard (buff continuo)
    // Guadagna 500 ATK per ogni "Guardiano di Lava" (id 343) che controlli
    // — le due carte si richiamano a vicenda, vedi il suo speculare più
    // sotto. static() viene ricalcolato ad ogni render (vedi
    // recomputeStaticEffects in duel-engine.js): il bonus scritto in
    // gameState.atkDefBonus è letto sia dal calcolo battaglia
    // (resolveBattleDamage in actions.js) sia dal rendering della carta
    // (card-renderer.js), quindi è un vero +ATK, non solo cosmetico.
    // ================================================================
    CardEffects.register(74, {
        static(ctx) {
            const count = ctx.field(ctx.owner).filter((slot) => slot && !slot.isFaceDown && slot.card.id === 343).length;
            gameState.atkDefBonus[ctx.card.uid] = { atk: count * 500, def: 0 };
        }
    });

    // ================================================================
    // 77 — Coccinella della Rovina a 4 Stelle (effetto FLIP)
    // Quando viene girata scoperta, distrugge tutti i mostri scoperti di
    // Livello 4 sul campo dell'avversario — stesso aggancio TRIGGER.ON_FLIP
    // già usato da id 49 qui sopra.
    // ================================================================
    CardEffects.register(77, {
        onFlip(ctx) {
            const field = ctx.field(ctx.opponent);
            let destroyedAny = false;
            field.forEach((slot, index) => {
                if (slot && !slot.isFaceDown && slot.card.level === 4) {
                    ctx.destroyMonster(ctx.opponent, index);
                    destroyedAny = true;
                }
            });
            ctx.log(destroyedAny
                ? '🐞 Coccinella del Destino distrugge tutti i mostri scoperti di Livello 4 dell\'avversario!'
                : '🐞 Coccinella del Destino si rivela, ma l\'avversario non ha mostri scoperti di Livello 4.');
        }
    });

    // ================================================================
    // 80 — Un Battito d'Ali del Drago Gigante (Magia Normale)
    // Riporta in mano 1 mostro Tipo Drago di Livello 5+ che controlli; se
    // lo fai, distrugge tutte le Magie/Trappole sul Terreno (di entrambi i
    // giocatori — il testo reale non specifica "dell'avversario").
    // SEMPLIFICAZIONE: sceglie da sola quale Drago rimandare in mano (il
    // primo trovato), invece di un'interfaccia di selezione dedicata.
    // ================================================================
    CardEffects.register(80, {
        // Riporta in mano un proprio Drago e distrugge TUTTE le Magie/Trappole, anche le proprie: ha senso solo
        // se l'avversario ne ha nettamente di piu' (almeno 2 piu' del bot).
        aiCanActivate(ctx) {
            const conta = (owner) => ctx.stField(owner).filter(Boolean).length + (Tavolo.magiaTerreno(owner) ? 1 : 0);
            return conta(ctx.opponent) - conta(ctx.owner) >= 2;
        },
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.race === 'Drago' && slot.card.level >= 5);
        },
        activate(ctx) {
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && !slot.isFaceDown && slot.card.race === 'Drago' && slot.card.level >= 5);
            if (index === -1) return;
            const returned = field[index].card;
            ctx.returnMonsterToHand(ctx.owner, index);
            Tavolo.ordine().forEach((fieldOwner) => {
                ctx.stField(fieldOwner).forEach((slot, i) => {
                    if (slot) {
                        ctx.graveyard(fieldOwner).push(slot.card);
                        ctx.stField(fieldOwner)[i] = null;
                    }
                });
            });
            ctx.log(`🐉 Il Battito d'Ali del Drago Gigante riporta in mano ${returned.name} e distrugge tutte le Magie/Trappole sul Terreno!`);
        }
    });

    // ================================================================
    // 86 — Amazzone Maestra delle Catene (onDestroy)
    // Quando questa carta viene distrutta in battaglia e mandata al
    // Cimitero: puoi pagare 1000 Life Points; se lo fai, guarda la mano
    // del tuo avversario e aggiungi alla tua mano 1 mostro che vi si
    // trova. Il "puoi" reale è una vera scelta qui: apre il box "lista
    // carte a scorrimento" (DuelEngineUI.openCardListPicker) con la mano
    // dell'avversario; i Life Points si pagano solo se scegli davvero una
    // carta, non prima (chiudere il box senza scegliere equivale a
    // rifiutare il costo).
    // ================================================================
    // CORREZIONE di fedeltà: il costo reale è 1500 LP, non 1000.
    CardEffects.register(86, {
        onDestroy(ctx) {
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            if (gameState[lpKey] <= 1500) return;
            const opponentMonstersInHand = ctx.hand(ctx.opponent).filter((c) => c.type === 'monster');
            if (opponentMonstersInHand.length === 0) return;

            const pick = (card) => {
                const hand = ctx.hand(ctx.opponent);
                const index = hand.indexOf(card);
                if (index === -1) return;
                ctx.dealDamage(ctx.owner, 1500);
                hand.splice(index, 1);
                ctx.hand(ctx.owner).push(card);
                ctx.log(`⛓️ Maestra delle Catene Amazoness paga 1500 LP e prende ${card.name} dalla mano dell'avversario!`);
                if (typeof updateUI === 'function') updateUI();
            };

            if (Decisioni.rispondeUnaPersona(ctx.owner)) {
                Decisioni.chiedi({
                    chi: ctx.owner,
                    candidati: opponentMonstersInHand,
                    titolo: '⛓️ Maestra delle Catene Amazoness',
                    testo: "Paga 1500 Life Points e scegli 1 mostro dalla mano dell'avversario da aggiungere alla tua mano."
                }, (scelta) => {
                    if (scelta === null) return;
                    pick(scelta);
                });
            } else {
                pick(opponentMonstersInHand[0]);
            }
        }
    });

    // ================================================================
    // 87 — Amazzone Combattente (effetto passivo, nessuna attivazione)
    // Non subisci danno da battaglia dagli attacchi che coinvolgono
    // questa carta — vedi il flag preventOwnBattleDamage, letto da
    // applyDamage() dentro resolveBattleDamage() in js/engine/actions.js.
    // ================================================================
    CardEffects.register(87, {
        preventOwnBattleDamage: true
    });

    // ================================================================
    // 90 — Amazzone Spadaccina (effetto passivo, nessuna attivazione)
    // Il danno da battaglia che subiresti dagli attacchi che coinvolgono
    // questa carta viene invece subito dal tuo avversario — vedi il flag
    // redirectOwnBattleDamageToOpponent, stesso punto d'aggancio di
    // Amazzone Combattente qui sopra.
    // ================================================================
    CardEffects.register(90, {
        redirectOwnBattleDamageToOpponent: true
    });

    // ================================================================
    // 92 — Amplificatore / Amplifier (Equipaggiamento, solo Jinzo id 17)
    // Finché equipaggiata, Jinzo nega le Trappole solo dell'avversario
    // (non più anche le proprie) — vedi l'override nella static() di
    // Jinzo stessa qui sopra (cerca "hasAmplifier"), che controlla se
    // QUESTA carta è equipaggiata a lui. "Quando questa carta viene
    // rimossa dal Terreno: distruggi il mostro equipaggiato" — stesso
    // schema di Sepoltura Prematura (id 633) qui sopra, tramite
    // onSTDestroyed/ctx.destroySpellTrap.
    // "Se questa carta lascia il Terreno": copre distruzione (onSTDestroyed),
    // bando (onBanished, ACTIONS.banish) e ora anche il ritorno in mano
    // (onReturnedToHandSelf) — scatenato dall'unica carta di questo
    // dataset che rimanda Magie/Trappole in mano, Turbine Gigante (id 262,
    // vedi più sotto in questo file), che ora chiama questo hook per ogni
    // carta ST che rimanda in mano, esattamente come
    // ACTIONS.returnMonsterToHand fa già per i mostri.
    // ================================================================
    function amplifierDestroyEquippedTarget(ctx, reasonLabel) {
        if (!ctx.card.equippedToUid) return;
        const field = ctx.field(ctx.card.equippedToOwner);
        const index = ctx.card.equippedToIndex;
        const slot = field[index];
        if (!slot || slot.card.uid !== ctx.card.equippedToUid) return;
        const name = slot.card.name;
        ctx.destroyMonster(ctx.card.equippedToOwner, index);
        ctx.log(`⚡ Amplificatore ${reasonLabel}: ${name} viene distrutto con lui!`);
    }
    CardEffects.register(92, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.id === 17) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.id === 17); },
        isEquip: true,
        equipTargetFilter: (c) => c.id === 17,
        onSTDestroyed(ctx) { amplifierDestroyEquippedTarget(ctx, 'distrutto'); },
        onBanished(ctx) { amplifierDestroyEquippedTarget(ctx, 'bandito'); },
        onReturnedToHandSelf(ctx) { amplifierDestroyEquippedTarget(ctx, 'tornato in mano'); }
    });

    // ================================================================
    // 88 — Arciere delle Amazzoni / Amazoness Archers (Trappola Normale)
    // Testo ufficiale verificato (YGOPRODeck): "Quando l'avversario
    // dichiara un attacco, se controlli un mostro 'Amazzone': gira
    // scoperti in Posizione di Attacco tutti i mostri che l'avversario
    // controlla attualmente (gli effetti Flip non si attivano), perdono
    // 500 ATK, inoltre devono attaccare in questo turno, se possono."
    // Le 3 clausole sono ora tutte implementate: il flip (già presente),
    // il -500 ATK (scritto direttamente su card.attack, stesso pattern
    // permanente già accettato per Slifer id 31/atkLossOnBattleDestroy in
    // actions.js — nessuna carta di questo dataset alza di nuovo l'ATK di
    // un mostro dopo, quindi non c'è un revert reale da gestire), e
    // l'obbligo di attacco tramite gameState.mustAttackTargetUidsFor, lo
    // STESSO meccanismo generico già usato da 199 (vedi
    // grantAttackAllEnemiesOncEach più sotto in questo file): letto sia da
    // bot.js (forza il bersaglio quando è il bot ad attaccare) sia da
    // hasUnfulfilledForcedAttack in game-flow.js (blocca il giocatore
    // dall'uscire dalla Battle Phase senza aver attaccato). A differenza
    // di 199 (un solo attaccante deve colpire OGNI nemico una volta),
    // qui OGNI mostro appena girato deve attaccare UNA volta ciascuno:
    // basta dargli l'intero pool di bersagli nemici disponibili, la prima
    // scelta soddisfa già l'obbligo (hasUnfulfilledForcedAttack considera
    // soddisfatto un attaccante che ha già attaccato, indipendentemente da
    // quanto resta nel suo Set).
    // ================================================================
    CardEffects.register(88, {
        onAttackDeclare(ctx) {
            // Il controllo (nome contiene "Amazzone") vale anche se il proprio
            // mostro è coperto: è il TUO mostro, ne conosci il nome anche
            // senza girarlo — solo i mostri dell'AVVERSARIO restano "ignoti".
            if (!ctx.field(ctx.owner).some((slot) => slot && /Amazzone|(?<!Imboscata )Amazoness/.test(slot.card.name))) return;
            const field = ctx.field(ctx.opponent);
            const ownFieldUids = ctx.field(ctx.owner).filter((s) => s).map((s) => s.card.uid);
            let flippedAny = false;
            field.forEach((slot, i) => {
                if (!slot) return;
                if (slot.isFaceDown || slot.position !== 'attack') {
                    slot.isFaceDown = false;
                    ctx.changePosition(ctx.opponent, i, 'attack');
                    flippedAny = true;
                }
                slot.card.attack = Math.max(0, (slot.card.attack || 0) - 500);
                gameState.mustAttackTargetUidsFor = gameState.mustAttackTargetUidsFor || {};
                gameState.mustAttackTargetUidsFor[slot.card.uid] = new Set(ownFieldUids);
            });
            if (flippedAny) ctx.log('🏹 Imboscata Amazoness costringe tutti i mostri dell\'avversario in Posizione di Attacco scoperta, con -500 ATK, e li obbliga ad attaccare in questo turno!');
        }
    });

    // ================================================================
    // 119 — Cavaliere della Lama / Blade Knight (buff continuo)
    // Guadagna 400 ATK finché ha 1 carta o meno in mano. La seconda
    // clausola ("se non controlli altri mostri, gli effetti dei Mostri
    // Flip che distrugge in battaglia vengono annullati") è già garantita
    // per costruzione — un Mostro Flip distrutto in battaglia non attiva
    // MAI il proprio effetto in questo motore, per qualunque attaccante
    // (vedi il commento su TRIGGER.ON_FLIP in resolveBattleDamage,
    // actions.js, stessa nota già usata per Lady Arpia 2/id 783), quindi
    // nessuna registrazione dedicata serve per quella parte del testo.
    // ================================================================
    CardEffects.register(119, {
        static(ctx) {
            const bonus = ctx.hand(ctx.owner).length <= 1 ? 400 : 0;
            gameState.atkDefBonus[ctx.card.uid] = { atk: bonus, def: 0 };
        }
    });

    // ================================================================
    // 100 — Armatura Guida d'Attacco / Attack Guidance Armor (Trappola
    // Normale). Testo reale: "Quando un mostro dichiara un attacco:
    // attiva 1 di questi effetti; ● distruggi il mostro attaccante ●
    // scegli come bersaglio 1 mostro su uno dei due Terreni, eccetto
    // l'attaccante: cambia il bersaglio dell'attacco a quello e calcola i
    // danni. Puoi attivare solo 1 'Armatura Guida d'Attacco' per turno."
    // Il vincolo "una per turno" è ora implementato per davvero — chiave
    // per card.id (non uid), come richiede il testo reale ("1 Armatura
    // Guida d'Attacco", non "1 copia di QUESTA carta": due copie diverse
    // in campo condividono lo stesso limite).
    // Le due clausole sono una scelta vera del giocatore, e anche il nuovo
    // bersaglio. Si può fare perché la risposta chiede di essere aspettata
    // (attendiScelta): la battaglia riparte solo a scelta fatta, mentre
    // prima ripartiva subito e una scelta del giocatore sarebbe arrivata a
    // danno già calcolato. Il bot sceglie sempre di distruggere
    // l'attaccante, la mossa più forte quasi in ogni caso.
    // ================================================================
    CardEffects.register(100, {
        canActivate(ctx) {
            return !ctx.hasUsedOncePerTurn(`100:${ctx.card.id}`);
        },
        onAttackDeclare(ctx) {
            const fine = attendiScelta(ctx);
            ctx.markUsedOncePerTurn(`100:${ctx.card.id}`);
            const attackerSlot = ctx.field(ctx.attackerOwner)[ctx.attackerIndex];
            const attackerUid = attackerSlot && attackerSlot.card.uid;
            const defenderOwner = Tavolo.avversario(ctx.attackerOwner);
            const distruggi = () => {
                ctx.declareTargetWaiting(ctx.attackerOwner, ctx.attackerIndex, { totalTargetCount: 1 }, (decl) => {
                    if (!decl.allowed) return;
                    ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                    ctx.cancelAttack();
                    ctx.log('🛡️ Armatura Guida d\'Attacco distrugge il mostro attaccante!');
                });
            };
            // Qualunque mostro dei due Terreni tranne l'attaccante, e tranne
            // il bersaglio attuale: spostare l'attacco dov'era già non
            // cambierebbe nulla.
            const candidati = attackerUid ? collectFieldTargets(ctx, {
                zone: 'monster',
                owner: 'both',
                includiCoperte: true,
                filter: (card, owner, slot) => card.uid !== attackerUid
                    && !(owner === defenderOwner && ctx.field(owner)[ctx.targetIndex] === slot)
            }) : [];
            const chiedi = () => {
                chooseOption(ctx, {
                    title: '🛡️ Armatura Guida d\'Attacco',
                    text: 'Distruggi il mostro che attacca, oppure sposta l\'attacco su un altro mostro.',
                    options: [
                        { value: 'distruggi', label: 'Distruggi l\'attaccante', icon: '💥' },
                        candidati.length > 0 ? { value: 'sposta', label: 'Sposta l\'attacco', icon: '🎯' } : null
                    ],
                    pickForBot: () => 'distruggi'
                }, (scelta) => {
                    if (scelta !== 'sposta') {
                        try { distruggi(); } finally { fine(); }
                        return;
                    }
                    chooseFieldCardTarget(ctx, candidati, {
                        title: '🎯 Nuovo bersaglio dell\'attacco',
                        text: 'Scegli il mostro che subirà l\'attacco al posto del bersaglio attuale.',
                        // Chiudere la lista riporta alla scelta fra le due
                        // clausole, invece di lasciare la battaglia ferma.
                        onCancel: chiedi
                    }, (scelto) => {
                        ctx.declareTargetWaiting(scelto.owner, scelto.index, { totalTargetCount: 1 }, (decl) => {
                          try {
                            if (!decl.allowed) return;
                            ctx.redirectAttack(decl.targetIndex, decl.targetOwner);
                            const nuovo = ctx.field(decl.targetOwner)[decl.targetIndex];
                            ctx.log(`🛡️ Armatura Guida d'Attacco sposta l'attacco su ${nuovo && !nuovo.isFaceDown ? nuovo.card.name : 'un mostro coperto'}!`);
                          } finally {
                            fine();
                          }
                        });
                    });
                });
            };
            chiedi();
        }
    });

    // ================================================================
    // 78 — Patto col Sovrano Oscuro (Magia Veloce)
    // Special Summon di Drago Berserk (id 110) dalla mano.
    // SEMPLIFICAZIONE: l'effetto reale richiede che il mostro di 8+ Stelle
    // Livello sia andato al TUO Cimitero PROPRIO in questo turno — questo
    // motore non tiene traccia di "quando" una carta è arrivata al
    // Cimitero, solo se ci si trova, quindi qui basta che ce ne sia UNO
    // presente (in qualunque momento). "dalla mano o dal Deck" diventa
    // "solo dalla mano": cercare una carta specifica nel Deck e rimuoverla
    // richiederebbe un meccanismo di ricerca-mazzo non ancora presente.
    // ================================================================
    CardEffects.register(78, {
        canActivate(ctx) {
            const hasFodder = ctx.graveyard(ctx.owner).some((c) => c.level >= 8);
            const hasBerserkDragon = ctx.hand(ctx.owner).some((c) => c.id === 110);
            return hasFodder && hasBerserkDragon;
        },
        activate(ctx) {
            const hand = ctx.hand(ctx.owner);
            const index = hand.findIndex((c) => c.id === 110);
            if (index === -1) return;
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) {
                ctx.log('❌ Non c\'è spazio sul Terreno per Special Summonare Drago Berserk.');
                return;
            }
            const card = hand[index];
            hand.splice(index, 1);
            ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'hand');
            ctx.log('👹 Un Accordo con l\'Arcidemone Special Summona Drago Berserk!');
        }
    });

    // ================================================================
    // 79 — Un Oceano Leggendario / A Legendary Ocean (Magia Terreno)
    // Ogni mostro ACQUA sul campo (di entrambi i giocatori) guadagna 200
    // ATK/DEF, finché questa carta resta scoperta sul Terreno. Accumula con
    // un eventuale bonus già scritto da un altro effetto continuo, invece
    // di sovrascriverlo, così più fonti sullo stesso mostro si sommano.
    // SEMPLIFICAZIONE: la riduzione di Livello di 1 non è applicata —
    // nessun codice in questo motore legge più il Livello di un mostro
    // dopo l'Evocazione (serve solo a calcolare i Tributi PRIMA di
    // Evocarlo).
    // ================================================================
    CardEffects.register(79, {
        continuous: true,
        // Come ogni altra Magia/Trappola Continua di questo file, serve un
        // activate() — anche solo per il log — perché la carta possa
        // scoprirsi quando viene Set e poi attivata dalla sua zona
        // Terreno (altrimenti canActivate() in duel-engine.js la
        // considera "senza effetto attivabile" e resterebbe coperta per
        // sempre): l'effetto vero, indipendente da questo, resta in
        // static() qui sotto.
        activate(ctx) {
            ctx.log(`🌊 ${ctx.card.name} si scopre sul Terreno.`);
        },
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    // Guardiano Kay'est (id 285): "non è influenzata dagli
                    // effetti delle Magie", quindi niente bonus ATK/DEF da
                    // questa Magia Terreno anche se è ACQUA.
                    if (slot && !slot.isFaceDown && slot.card.attribute === 'ACQUA' && !DuelEngine.getDefinition(slot.card.id)?.unaffectedBySpellEffects) {
                        const existing = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                        gameState.atkDefBonus[slot.card.uid] = { atk: existing.atk + 200, def: existing.def + 200 };
                    }
                });
            });
            // Riduzione di Livello per OGNI mostro ACQUA (Terreno, anche
            // coperto, o mano — a differenza del bonus ATK/DEF qui sopra,
            // limitato agli scoperti sul Terreno): un semplice flag
            // globale basta, letto da getEffectiveLevel (cards-db.js) —
            // nessun bisogno di scandire mano/Terreno qui, il flag da solo
            // copre già "ovunque si trovi il mostro".
            gameState.legendaryOceanActive = true;
        }
    });

    // ================================================================
    // 122 — Spadaccino di Fiamma Blu / Blue Flame Swordsman
    // Una volta per turno, durante la Battle Phase di uno dei due
    // giocatori: scegli come bersaglio 1 altro mostro Guerriero che
    // controlli; questa carta perde 600 ATK e quel mostro guadagna 600
    // ATK — attivazione Ignition (click sul mostro scoperto), ma con una
    // condizione di fase INSOLITA per questo motore: normalmente un
    // effetto Ignition richiede la Main Phase, qui invece SOLO la Battle
    // Phase (di uno qualunque dei due giocatori — non solo la propria,
    // quindi niente controllo su gameState.currentPlayer).
    // Quando questa carta viene distrutta dall'avversario e mandata al
    // Cimitero: bandiscila dal Cimitero, poi Special Summon 1 mostro
    // Guerriero FUOCO dal Cimitero. SEMPLIFICAZIONE: "distrutta
    // dall'avversario" copre solo la distruzione in BATTAGLIA
    // (ctx.destroyedByOpponentCard, popolato solo lì — vedi il commento
    // su fireOnDestroy in actions.js), non un effetto Carta avversario:
    // stessa semplificazione già accettata altrove in questo file (es.
    // Ossigeddon id 804) per lo stesso limite strutturale.
    // ================================================================
    CardEffects.register(122, {
        canActivate(ctx) {
            if (gameState.phase !== 'battle') return false;
            if (ctx.hasUsedOncePerTurn(`122:${ctx.card.uid}:${gameState.turn}`)) return false;
            return ctx.field(ctx.owner).some((s, i) => s && i !== ctx.index && !s.isFaceDown && s.card.race === 'Guerriero');
        },
        activate(ctx) {
            const candidati = collectFieldTargets(ctx, {
                zone: 'monster', owner: 'self',
                filter: (card) => card.uid !== ctx.card.uid && card.race === 'Guerriero'
            });
            if (candidati.length === 0) return;
            // `dichiara`: il bersaglio passa dal checkpoint di targeting
            // condiviso (testo: "scegli come bersaglio").
            chooseFieldCardTarget(ctx, candidati, {
                title: '🔥 Spadaccino di Fuoco Blu',
                text: 'Scegli un altro mostro Guerriero a cui trasferire 600 ATK (questa carta ne perde 600).',
                dichiara: true
            }, (scelto) => {
                const target = scelto.card;
                ctx.markUsedOncePerTurn(`122:${ctx.card.uid}:${gameState.turn}`);
                ctx.card.attack = Math.max(0, ctx.card.attack - 600);
                target.attack += 600;
                ctx.log(`🔥 Spadaccino di Fuoco Blu trasferisce 600 ATK a ${target.name}!`);
            });
        },
        onDestroy(ctx) {
            if (!ctx.destroyedByOpponentCard) return;
            const grave = ctx.graveyard(ctx.owner);
            const selfIdx = grave.findIndex((c) => c.uid === ctx.card.uid);
            if (selfIdx === -1) return;
            const candidates = grave.filter((c) => c.attribute === 'FUOCO' && c.race === 'Guerriero');
            if (candidates.length === 0) return;
            const revive = (target) => {
                // Necrovalley (id 890): se blocca il bando, l'intero costo
                // fallisce — niente Special Summon senza il bando reale.
                if (!ctx.banishFromGraveyard(ctx.owner, ctx.card)) return;
                const idx = grave.indexOf(target);
                if (idx !== -1) grave.splice(idx, 1);
                ctx.specialSummon(ctx.owner, target, ctx.slotIndex, 'attack', 'graveyard');
                ctx.log(`🔥 Spadaccino di Fuoco Blu si bandisce dal Cimitero: Special Summon ${target.name}!`);
            };
            if (!Decisioni.rispondeUnaPersona(ctx.owner)) { revive(candidates[0]); return; }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates,
                titolo: '🔥 Spadaccino di Fuoco Blu',
                testo: 'Scegli 1 mostro Guerriero FUOCO dal Cimitero da Special Summonare (Spadaccino di Fuoco Blu si bandisce).'
            }, (scelta) => {
                if (scelta === null) return;
                revive(scelta);
            });
        }
    });

    // ================================================================
    // 121 — Blocca Attacco / Block Attack (Magia Normale)
    // Cambia in Posizione di Difesa scoperta un mostro scoperto in
    // Posizione di Attacco controllato dal tuo avversario.
    // SEMPLIFICAZIONE: sceglie da sola il bersaglio (quello con l'ATK più
    // alto, il più minaccioso da disinnescare), stesso spirito di Stop
    // Difesa (id 69) che fa l'equivalente al contrario.
    // ================================================================
    CardEffects.register(121, {
        declaredTargeting: { count: 1, cardType: 'monster' },
        canActivate(ctx) {
            return ctx.field(ctx.opponent).some((slot) => slot && !slot.isFaceDown && slot.position === 'attack');
        },
        activate(ctx) {
            const field = ctx.field(ctx.opponent);
            let targetIndex = -1;
            let highestAtk = -1;
            field.forEach((slot, i) => {
                if (slot && !slot.isFaceDown && slot.position === 'attack' && slot.card.attack > highestAtk) {
                    highestAtk = slot.card.attack;
                    targetIndex = i;
                }
            });
            if (targetIndex === -1) return;
            ctx.declareTargetWaiting(ctx.opponent, targetIndex, { totalTargetCount: 1 }, (decl) => {
                if (!decl.allowed) return;
                const targetSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!targetSlot) return;
                targetSlot.position = 'defense';
                ctx.log(`🛡️ Blocca-Attacco costringe ${targetSlot.card.name} in Posizione di Difesa!`);
            });
        }
    });

    // ================================================================
    // 128 — Buco Trappola senza Fondo / Bottomless Trap Hole (Trappola)
    // Quando l'avversario di chi la controlla Evoca un mostro con 1500+
    // ATK: distruggilo e bandiscilo. Stesso meccanismo di Buco Trappola
    // (id 40), ma SENZA il vincolo "solo se scoperto in Posizione di
    // Attacco" — la carta vera scatta su qualunque Evocazione, non solo
    // quella scoperta. "E bandiscilo": card.mustBanishOnLeavingField
    // (flag PER-ISTANZA, duel-engine.js — nato per Cerchio degli Inferi
    // id 498) impostato sul bersaglio PRIMA di ctx.destroyMonster: il
    // motore la manda al Cimitero e la ridirige subito alla Zona Bandite
    // da sola, senza bypassare gli hook "quando questa carta viene
    // distrutta" (a differenza di un banish diretto come Buco Dimensionale
    // id 201, qui il mostro passa comunque per una vera distruzione).
    // ================================================================
    CardEffects.register(128, {
        canActivate(ctx) {
            return ctx.summonedCard.attack >= 1500;
        },
        onOpponentSummon(ctx) {
            ctx.declareTargetWaiting(ctx.opponent, ctx.summonedSlotIndex, { totalTargetCount: 1 }, (decl) => {
                if (!decl.allowed) return;
                const target = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!target) return;
                if (window.FX && typeof FX.playBottomlessTrapHole === 'function') {
                    FX.playBottomlessTrapHole(decl.targetOwner, decl.targetIndex, target.card);
                }
                target.card.mustBanishOnLeavingField = true;
                ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                ctx.log(`🕳️ Buco Trappola Senza Fine distrugge e bandisce ${target.card.name}!`);
            });
        }
    });

    // ================================================================
    // 129 — Bowganian (onStandbyPhase)
    // Durante la tua Standby Phase: infliggi 600 danni al tuo avversario.
    // Il "una volta per turno" del testo reale è automatico: la Standby
    // Phase capita già una sola volta a turno.
    // ================================================================
    CardEffects.register(129, {
        onStandbyPhase(ctx) {
            ctx.dealDamage(ctx.opponent, 600);
            ctx.log('🏹 Bowganian infligge 600 danni durante la Standby Phase!');
        }
    });

    // ================================================================
    // 132 — Soffio di Luce / Breath of Light (Magia Normale)
    // Distrugge tutti i mostri Tipo Roccia scoperti sul Terreno, di
    // entrambi i giocatori.
    // ================================================================
    CardEffects.register(132, {
        // Distrugge le Rocce di ENTRAMBI i lati: il bot la attiva solo se all'avversario ne toglie nettamente di piu'.
        aiCanActivate(ctx) {
            const somma = (owner) => ctx.field(owner).reduce((s, slot) => (slot && !slot.isFaceDown && slot.card.race === 'Roccia' ? s + DuelEngine.getEffectiveAtk(slot.card) : s), 0);
            return somma(ctx.opponent) - somma(ctx.owner) >= 500;
        },
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((slot) => slot && !slot.isFaceDown && slot.card.race === 'Roccia'));
        },
        activate(ctx) {
            let count = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => {
                    if (slot && !slot.isFaceDown && slot.card.race === 'Roccia') {
                        ctx.destroyMonster(owner, index);
                        count++;
                    }
                });
            });
            ctx.log(`💥 Soffio di Luce distrugge ${count} most${count === 1 ? 'ro' : 'ri'} Tipo Roccia!`);
        }
    });

    // ================================================================
    // 134 — Soffio Esplosivo / Burst Breath (Trappola Normale)
    // Sacrifica 1 mostro Tipo Drago che controlli; distruggi tutti i
    // mostri scoperti sul Terreno (di entrambi i giocatori) con DEF minore
    // o uguale all'ATK che aveva il Drago sacrificato.
    // SEMPLIFICAZIONE: il Drago da sacrificare è auto-selezionato (quello
    // con l'ATK più alto, il più utile), stesso spirito di altre carte con
    // selezione automatica già presenti (es. Faglia, id 243).
    // ================================================================
    CardEffects.register(134, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.race === 'Drago');
        },
        activate(ctx) {
            const ownField = ctx.field(ctx.owner);
            let tributeIndex = -1;
            let tributeCard = null;
            ownField.forEach((slot, i) => {
                if (slot && !slot.isFaceDown && slot.card.race === 'Drago' && (!tributeCard || slot.card.attack > tributeCard.attack)) {
                    tributeIndex = i;
                    tributeCard = slot.card;
                }
            });
            if (tributeIndex === -1) return;
            ownField[tributeIndex] = null;
            ctx.graveyard(ctx.owner).push(tributeCard);

            let count = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => {
                    if (slot && !slot.isFaceDown && slot.card.defense <= tributeCard.attack) {
                        ctx.destroyMonster(owner, index);
                        count++;
                    }
                });
            });
            ctx.log(`🔥 Soffio Incendiario sacrifica ${tributeCard.name} e distrugge ${count} most${count === 1 ? 'ro' : 'ri'}!`);
        }
    });

    // ================================================================
    // 131 — Distruttore, il Guerriero Magico (Segnalino Magia + Ignition)
    // Se questa carta viene Evocata NORMALMENTE (non Special Summonata):
    // piazzaci sopra un Segnalino Magia. Guadagna 300 ATK per ogni
    // Segnalino Magia su di essa (buff continuo, stesso meccanismo del
    // punto 1 — gameState.atkDefBonus); puoi rimuoverne uno (effetto
    // Ignition, click sul mostro) per distruggere 1 Magia/Trappola
    // dell'avversario.
    // SEMPLIFICAZIONE: sceglie da sola il bersaglio da distruggere (il
    // primo trovato) invece di un'interfaccia di selezione dedicata.
    // ================================================================
    CardEffects.register(131, {
        // Anche i Segnalini aggiunti da altre carte (per esempio Mago
        // Apprendista) devono essere accettati: senza questo contratto il
        // Distruttore del mazzo Mage Soldier poteva ricevere soltanto il
        // proprio Segnalino dell'Evocazione Normale.
        acceptsSpellCounters: 'counters',
        onSummon(ctx) {
            ctx.summonedCard.counters = (ctx.summonedCard.counters || 0) + 1;
            ctx.log('🔮 Breaker il Guerriero Magico riceve un Segnalino Magia!');
        },
        onSpecialSummon() {}, // il vero effetto scatta solo su Evocazione Normale
        static(ctx) {
            const bonus = (ctx.card.counters || 0) * 300;
            gameState.atkDefBonus[ctx.card.uid] = { atk: bonus, def: 0 };
        },
        canActivate(ctx) {
            const hasCounter = (ctx.card.counters || 0) > 0;
            const hasTarget = ctx.stField(ctx.opponent).some((slot) => slot);
            return hasCounter && hasTarget;
        },
        activate(ctx) {
            const stField = ctx.stField(ctx.opponent);
            const targetIndex = stField.findIndex((slot) => slot);
            if (targetIndex === -1) return;
            ctx.card.counters -= 1;
            const target = stField[targetIndex];
            ctx.graveyard(ctx.opponent).push(target.card);
            stField[targetIndex] = null;
            ctx.log(`🔮 Distruttore rimuove un Segnalino Magia e distrugge ${target.card.name} dell'avversario!`);
        }
    });

    // ================================================================
    // 137 — Soldato Cannone / Cannon Soldier (effetto Ignition)
    // Puoi sacrificare 1 mostro; infliggi 500 danni al tuo avversario. Si
    // attiva cliccando sul mostro già scoperto in campo — vedi il ramo
    // zone === 'monster' di canActivate/activateCard in duel-engine.js.
    // SEMPLIFICAZIONE: sceglie da sola quale mostro sacrificare (un altro,
    // se disponibile, altrimenti se stessa) invece di un'interfaccia di
    // selezione dedicata. Manca il vincolo reale "una volta per turno" —
    // qui è comunque limitata dal fatto che serve un mostro da sacrificare.
    // ================================================================
    CardEffects.register(137, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot);
        },
        activate(ctx) {
            const field = ctx.field(ctx.owner);
            let index = field.findIndex((slot, i) => slot && i !== ctx.index);
            if (index === -1) index = ctx.index;
            const sacrificed = field[index];
            field[index] = null;
            ctx.graveyard(ctx.owner).push(sacrificed.card);
            ctx.dealDamage(ctx.opponent, 500);
            ctx.log(`💣 Soldato-Cannone sacrifica ${sacrificed.card.name} e infligge 500 danni!`);
        }
    });

    // ================================================================
    // 138 — Distruzione di Carte / Card Destruction (Magia Normale)
    // Entrambi i giocatori scartano quante più carte possono dalla mano,
    // poi ciascuno pesca lo stesso numero di carte che ha scartato.
    // ================================================================
    CardEffects.register(138, {
        activate(ctx) {
            Tavolo.ordine().forEach((owner) => {
                const hand = ctx.hand(owner);
                const discarded = hand.length;
                while (hand.length > 0) {
                    ctx.graveyard(owner).push(hand.pop());
                }
                if (discarded > 0) ctx.drawCards(owner, discarded);
            });
            ctx.log('🔥 Distruggi-Carte: entrambi i giocatori scartano la mano e ripescano lo stesso numero di carte!');
        }
    });

    // ================================================================
    // 139 — Guardia di Carte (Segnalino Guardia, buff continuo)
    // Se questa carta viene Evocata Normalmente o Special Summonata:
    // piazzaci sopra un Segnalino Guardia. Guadagna 300 ATK per ogni
    // Segnalino Guardia su di essa.
    // ================================================================
    // CORREZIONE di fedeltà: aggiunta la seconda abilità mancante — "una
    // volta per turno: scegli come bersaglio 1 altra carta scoperta che
    // controlli; rimuovi 1 Segnalino Guardia da questa carta e mettilo
    // su quel bersaglio" — Ignition dalla zona Mostro (una volta per
    // turno per uid, già garantito generically da usedIgnitionThisTurn).
    // Su quale carta spostare il Segnalino lo sceglie il giocatore: i
    // candidati restano ordinati coi mostri per primi, che era la
    // priorità della vecchia selezione automatica e resta quella che il
    // bot segue prendendo il primo della lista.
    CardEffects.register(139, {
        onSummon(ctx) {
            ctx.summonedCard.counters = (ctx.summonedCard.counters || 0) + 1;
            ctx.log('🛡️ Guardia della Carta riceve un Segnalino Guardia!');
        },
        canActivate(ctx) {
            if (ctx.zone !== 'monster') return false;
            if (!(ctx.card.counters > 0)) return false;
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.uid !== ctx.card.uid)
                || ctx.stField(ctx.owner).some((s) => s && !s.isFaceDown);
        },
        activate(ctx) {
            const candidati = collectFieldTargets(ctx, {
                zone: 'both',
                owner: 'self',
                filter: (card) => card.uid !== ctx.card.uid
            });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🛡️ Guardia della Carta',
                text: 'Scegli su quale tua carta scoperta spostare il Segnalino Guardia.'
            }, (scelto) => {
                const target = scelto.card;
                ctx.card.counters -= 1;
                target.counters = (target.counters || 0) + 1;
                ctx.log(`🛡️ Guardia della Carta sposta 1 Segnalino Guardia su ${target.name}!`);
            });
        },
        static(ctx) {
            const bonus = (ctx.card.counters || 0) * 300;
            gameState.atkDefBonus[ctx.card.uid] = { atk: bonus, def: 0 };
        }
    });

    // ================================================================
    // 156 — Cavaliere Scarafaggio / Cockroach Knight (onDestroy)
    // Quando questa carta viene distrutta e mandata al Cimitero: torna in
    // cima al tuo Deck invece di restarci.
    // SEMPLIFICAZIONE: funziona solo se esiste un vero Deck mescolato
    // (gameState.playerDeck/botDeck — vedi resetGameState in game-flow.js):
    // in modalità senza un mazzo reale (es. Bot generico del Duello Demo)
    // non c'è un Deck su cui rimettere la carta, quindi resta nel
    // Cimitero.
    // ================================================================
    CardEffects.register(156, {
        onDestroy(ctx) {
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = ctx.gameState[deckKey];
            if (!deck) return;
            const grave = ctx.graveyard(ctx.owner);
            const index = grave.indexOf(ctx.card);
            if (index === -1) return;
            if (ctx.graveyardMoveNegated(ctx.owner)) return;
            grave.splice(index, 1);
            deck.push(ctx.card); // drawCardsToHand pesca con .pop(): push = "in cima al Deck"
            ctx.gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
            ctx.log('🪳 Cavaliere-Scarafaggio torna in cima al Deck!');
        }
    });

    // ================================================================
    // 157 — Bozzolo dell'Evoluzione / Cocoon of Evolution
    // Si equipaggia dalla MANO (non dal campo) a "Piccola Falena" (id 522)
    // scoperta sul proprio Terreno, la cui ATK/DEF diventa quella di
    // questa carta (0/2000) — non un bonus additivo come i normali Equip,
    // ma una SOSTITUZIONE. Usa comunque isEquip/continuous + findEquipTarget/
    // attachEquip come ogni altro Equip qui sopra (l'activate() da MANO su
    // un mostro con continuous:true è già gestito genericamente da
    // activateCard in duel-engine.js, stesso percorso di Thunder Dragon id
    // 537 — vedi promptHandMonsterActivation in actions.js): l'unica
    // differenza è nel proprio static(), che scrive in gameState.atkDefBonus
    // il DELTA (attacco/difesa di questa carta meno l'attacco/difesa
    // STAMPATA di Falena Piccola, sempre la stessa perché card.attack/
    // defense non vengono mai mutati da altri effetti) invece di un valore
    // fisso, così l'ATK/DEF effettivo del bersaglio (getEffectiveAtk/Def)
    // risulta esattamente 0/2000.
    // Segna anche su Falena Piccola il turno (gameState.turn grezzo, non
    // "turni del proprietario") in cui l'aggancio è avvenuto — serve solo
    // a id 50/52 (Larva Mostruosa/Grande Falena) qui sotto, per il loro
    // "durante il tuo 2°/4° turno dopo che Falena Piccola è stata
    // equipaggiata con Bozzolo dell'Evoluzione".
    // ================================================================
    CardEffects.register(157, {
        continuous: true,
        isEquip: true,
        equipTargetFilter: (c) => c.id === 522,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.id === 522) !== -1; },
        activate(ctx) {
            // onAttached: il turno di aggancio va segnato SUL BERSAGLIO, e
            // si conosce solo dopo la scelta.
            equipToChosenTarget(ctx, (c) => c.id === 522, {
                onAttached: (target) => {
                    if (target.id === 522) target._cocoonEquippedOnTurn = gameState.turn;
                }
            });
        },
        static(ctx) {
            // Il Bozzolo è anche un mostro normale (Livello 3, 0/2000) che si
            // può Evocare: lì non è agganciato a nulla, e il motore ne esegue
            // comunque lo static dalla zona Mostri. Prima andava in errore ad
            // ogni ricalcolo (trovato dal duello senza testa): senza un
            // bersaglio agganciato non c'è niente da sostituire.
            const t = ctx.card.equippedToOwner ? equippedTarget(ctx) : null;
            if (!t) return;
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + (ctx.card.attack - t.attack), def: e.def + (ctx.card.defense - t.defense) };
        }
    });

    // findPetitMothReadyForCocoonSummon vive ora fra gli helper condivisi, in cima a
    // js/engine/card-effects.js: serve a gruppi di carte lontani fra loro,
    // quindi non può stare dentro un singolo file-parte.


    // ================================================================
    // 50 — Larva Mostruosa / Larvae Moth
    // Non può essere Evocata Normalmente né Set. Special Summonabile solo
    // sacrificando "Piccola Falena" durante il proprio 2° turno dopo che è
    // stata equipaggiata con "Bozzolo dell'Evoluzione" (id 157) — vedi
    // findPetitMothReadyForCocoonSummon qui sopra.
    // ================================================================
    CardEffects.register(50, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) { return findPetitMothReadyForCocoonSummon(ctx, 2) !== -1; },
        paySpecialSummonCost(ctx) {
            const i = findPetitMothReadyForCocoonSummon(ctx, 2);
            if (i === -1) return false;
            const sacrificed = ctx.field(ctx.owner)[i];
            ctx.field(ctx.owner)[i] = null;
            ctx.graveyard(ctx.owner).push(sacrificed.card);
            ctx.log(`🐛 Piccola Falena sacrificata per Special Summonare ${ctx.card.name}!`);
            return true;
        }
    });

})();
