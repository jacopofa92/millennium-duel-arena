/**
 * card-effects-7.js — Effetti delle carte, parte 7 di 8.
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

    const { collectEquipTargets, chooseFieldTargetsInSequence, chooseFieldCardTargetWaiting, attendiScelta, chooseOption, isHarpieLadySupport, findEquipTarget, equipToChosenTarget, attachEquip, equippedTarget, searchDeckWithChoice, searchGraveyardWithChoice, chooseFieldCardTarget, chooseFieldMonsterTarget, collectFieldTargets, offerHandDiscardChoice, chooseCardFromHand, chooseCardFromList, banishFromGraveyardWithChoice, resolveSpecialSummonBanishCost, maxRitualTributeLevel, performRitualTribute, releaseRelinquishedTarget, selfFlipToFaceDownDefense, findLevel7SpellcasterTarget, grantAttackAllEnemiesOncEach, destroyTargetingSpellIfItStays, victimChoosesDiscard } = window.CardEffectsShared;

    // ================================================================
    // 835 — Ingranaggio Antico / Ancient Gear
    // Se controlli un mostro "Ingranaggio Antico" (l'archetipo, es. Golem
    // Ingranaggio Antico id 832): puoi Special Summonarla dalla mano
    // scoperta in Posizione di Attacco. In inglese "Ancient Gear" è un
    // PREFISSO in ogni nome della famiglia; in italiano la traduzione lo
    // rende un SUFFISSO ("Golem-Ingranaggio Antico", non "Ingranaggio
    // Antico Golem") — .includes(), non .startsWith(), verifica
    // l'appartenenza all'archetipo indipendentemente dalla posizione.
    // ================================================================
    CardEffects.register(835, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.name && s.card.name.includes('Ingranaggio Antico') && s.card.uid !== ctx.card.uid);
        },
        paySpecialSummonCost() { return true; }
    });

    // ================================================================
    // 836 — Cannone Ingranaggio Antico / Ancient Gear Cannon (Ignition —
    // auto-sacrificio)
    // Sacrifica questa carta: 500 danni e blocca le Trappole di
    // entrambi durante la Battle Phase di questo turno.
    // ================================================================
    CardEffects.register(836, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s && s.card.uid === ctx.card.uid);
        },
        activate(ctx) {
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((s) => s && s.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.graveyard(ctx.owner).push(ctx.card);
            field[index] = null;
            ctx.dealDamage(ctx.opponent, 500);
            gameState.noTrapActivationFor = gameState.noTrapActivationFor || {};
            gameState.noTrapActivationFor.player = true;
            gameState.noTrapActivationFor.bot = true;
            ctx.log('⚙️ Cannone-Ingranaggio Antico si sacrifica, infligge 500 danni e blocca le Trappole!');
        }
    });

    // ================================================================
    // 837 — Officina dell'Ingranaggio Antico / Ancient Gear Workshop
    // (Magia Normale)
    // Aggiungi 1 mostro "Ingranaggio Antico" dal Cimitero alla mano.
    // ================================================================
    CardEffects.register(837, {
        canActivate(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.name && c.name.includes('Ingranaggio Antico'));
        },
        activate(ctx) {
            searchGraveyardWithChoice(ctx, ctx.owner, (c) => c.name && c.name.includes('Ingranaggio Antico'), {
                title: '⚙️ Officina dell\'Ingranaggio Antico',
                text: 'Scegli quale mostro "Ingranaggio Antico" recuperare dal Cimitero.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`⚙️ Laboratorio-Ingranaggio Antico recupera ${card.name} dal Cimitero!`);
            });
        }
    });

    // ================================================================
    // 838 — Carro Armato Ingranaggio Antico / Ancient Gear Tank
    // (Equipaggiamento, solo "Ingranaggio Antico")
    // +600 ATK. Quando questa carta viene distrutta e mandata al
    // Cimitero: 600 danni. Stesso schema di dipendenza targetOwner/
    // targetIndex/targetUid di Collana del Comando (id 688).
    // ================================================================
    CardEffects.register(838, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.name && c.name.includes('Ingranaggio Antico')) !== -1; },
        activate(ctx) {
            // A quale "Ingranaggio Antico" agganciarlo lo sceglie il
            // giocatore (prima era il primo da sinistra). `equipInScelta`
            // impedisce al static() qui sotto di scambiarlo per orfano mentre
            // la lista è aperta: senza, andrebbe al Cimitero infliggendo
            // pure i suoi 600 danni (stesso guasto di equipToChosenTarget).
            const candidati = collectEquipTargets(ctx, (c) => c.name && c.name.includes('Ingranaggio Antico'));
            if (candidati.length === 0) return;
            const card = ctx.card;
            card.equipInScelta = true;
            const sceltaChiusa = () => { delete card.equipInScelta; };
            chooseFieldCardTargetWaiting(ctx, candidati, {
                title: '⚙️ Carro Armato-Ingranaggio Antico',
                text: 'Scegli a quale tuo "Ingranaggio Antico" equipaggiare questa carta.',
                dichiara: true,
                onNegato: sceltaChiusa
            }, (scelto) => {
                sceltaChiusa();
                const slot = ctx.field(scelto.owner)[scelto.index];
                if (!slot || slot.card.uid !== scelto.card.uid) return;
                card.targetOwner = scelto.owner;
                card.targetIndex = scelto.index;
                card.targetUid = slot.card.uid;
                ctx.log(`⚙️ Carro Armato-Ingranaggio Antico equipaggiato a ${slot.card.name}!`);
            });
        },
        static(ctx) {
            // Bersaglio ancora da scegliere: non è orfano (vedi activate).
            if (ctx.card.equipInScelta) return;
            const targetSlot = ctx.card.targetOwner != null ? ctx.field(ctx.card.targetOwner)[ctx.card.targetIndex] : null;
            const validTarget = targetSlot && !targetSlot.isFaceDown && targetSlot.card.uid === ctx.card.targetUid;
            if (validTarget) {
                const e = gameState.atkDefBonus[targetSlot.card.uid] || { atk: 0, def: 0 };
                gameState.atkDefBonus[targetSlot.card.uid] = { atk: e.atk + 600, def: e.def };
                return;
            }
            ctx.stField(ctx.owner)[ctx.index] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            ctx.dealDamage(ctx.opponent, 600);
            ctx.log('⚙️ Carro Armato-Ingranaggio Antico va al Cimitero e infligge 600 danni!');
        }
    });

    // ================================================================
    // 839 — Esplosivo Ingranaggio Antico / Ancient Gear Explosive
    // (Magia Normale)
    // Distruggi 1 proprio mostro "Ingranaggio Antico"; infliggi danni
    // pari alla metà del suo ATK originale.
    // ================================================================
    CardEffects.register(839, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.name && s.card.name.includes('Ingranaggio Antico'));
        },
        activate(ctx) {
            // Quale "Ingranaggio Antico" sacrificare cambia il danno (metà
            // del suo ATK), quindi la scelta è tutt'altro che indifferente.
            // I candidati sono ordinati dal più forte al più debole: il
            // bot, che prende sempre il primo, continua così a fare la
            // mossa sensata di prima invece della prima casella libera.
            const candidati = collectFieldTargets(ctx, {
                zone: 'monster',
                owner: 'self',
                filter: (card) => card.name && card.name.includes('Ingranaggio Antico')
            }).sort((a, b) => (b.card.attack || 0) - (a.card.attack || 0));
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '⚙️ Esplosivo-Ingranaggio Antico',
                dichiara: true,
                text: 'Scegli quale tuo "Ingranaggio Antico" far esplodere: il danno è metà del suo ATK.'
            }, (scelto) => {
                const card = scelto.card;
                const damage = Math.floor((card.attack || 0) / 2);
                ctx.destroyMonster(scelto.owner, scelto.index);
                ctx.dealDamage(ctx.opponent, damage);
                ctx.log(`⚙️ Esplosivo-Ingranaggio Antico distrugge ${card.name} e infligge ${damage} danni!`);
            });
        }
    });

    // ================================================================
    // 840 — Pugno Ingranaggio Antico / Ancient Gear Fist (Equipaggiamento,
    // solo "Ingranaggio Antico")
    // Alla fine del Damage Step, se il mostro equipaggiato ha combattuto
    // e resta sul Terreno: distruggi il mostro contro cui ha combattuto
    // (onEquippedMonsterBattled, actions.js).
    // ================================================================
    CardEffects.register(840, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.name && c.name.includes('Ingranaggio Antico')) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.name && c.name.includes('Ingranaggio Antico')); },
        isEquip: true,
        equipTargetFilter: (c) => c.name && c.name.includes('Ingranaggio Antico'),
        static() {}, // nessun bonus ATK/DEF: serve solo per il controllo "bersaglio ancora valido"
        onEquippedMonsterBattled(ctx) {
            if (!ctx.opponentSurvived) return;
            const idx = ctx.field(ctx.opponent).findIndex((s) => s && s.card.uid === ctx.opponentCard.uid);
            if (idx === -1) return;
            ctx.destroyMonster(ctx.opponent, idx);
            ctx.log(`⚙️ Pugno-Ingranaggio Antico distrugge ${ctx.opponentCard.name}!`);
        }
    });

    // ================================================================
    // 841 — Fabbrica dell'Ingranaggio Antico / Ancient Gear Factory
    // (Magia Normale)
    // Rivela 1 mostro "Ingranaggio Antico" di Livello 5+ dalla mano, poi
    // bandisci mostri "Ingranaggio Antico" dal proprio Cimitero il cui
    // Livello totale sia il doppio di quello rivelato (ctx.banish, zona
    // Bandite): se lo Evochi Normalmente in QUESTO turno, lo fai senza
    // Sacrificio — marcatore per-carta card._noTributeThisTurn ===
    // gameState.turn, controllato in attemptMonsterSummon (actions.js)
    // insieme alle altre eccezioni puntuali già lì (Gaia id 711, Grande
    // Pillola Evolutiva id 810). Sia il mostro da rivelare sia le carte
    // da bandire (una scelta alla volta finché il totale dei Livelli
    // banditi raggiunge il doppio del rivelato) sono ora una vera scelta
    // del giocatore, non più sempre il Livello più alto disponibile.
    // ================================================================
    CardEffects.register(841, {
        canActivate(ctx) {
            const isAncientGearMonster = (c) => c.type === 'monster' && c.name.includes('Ingranaggio Antico');
            const candidates = ctx.hand(ctx.owner).filter((c) => isAncientGearMonster(c) && c.level >= 5);
            if (candidates.length === 0) return false;
            const graveLevels = ctx.graveyard(ctx.owner).filter(isAncientGearMonster).reduce((sum, c) => sum + c.level, 0);
            return candidates.some((c) => graveLevels >= c.level * 2);
        },
        activate(ctx) {
            const isAncientGearMonster = (c) => c.type === 'monster' && c.name.includes('Ingranaggio Antico');
            const graveLevels = ctx.graveyard(ctx.owner).filter(isAncientGearMonster).reduce((sum, c) => sum + c.level, 0);
            const candidates = ctx.hand(ctx.owner).filter((c) => isAncientGearMonster(c) && c.level >= 5 && graveLevels >= c.level * 2);
            if (candidates.length === 0) return;

            // Dopo aver scelto QUALE mostro rivelare, banisce dal Cimitero
            // finché la somma dei Livelli banditi raggiunge il doppio del
            // Livello del rivelato — una scelta per volta (in sequenza,
            // mai un ciclo sincrono: vedi offerSpecialSummonBanishChoice
            // per lo stesso principio), così il giocatore decide DAVVERO
            // quali carte sacrificare tra quelle disponibili, non solo
            // sempre le più alte di Livello.
            const revealChosen = (revealed) => {
                let remaining = revealed.level * 2;
                const banishedNames = [];
                const banishNext = () => {
                    if (remaining <= 0) {
                        revealed._noTributeThisTurn = gameState.turn;
                        ctx.log(`⚙️ Fabbrica-Ingranaggio Antico rivela ${revealed.name} e bandisce ${banishedNames.length} cart${banishedNames.length === 1 ? 'a' : 'e'} dal Cimitero: potrai Evocarlo Normalmente senza Sacrificio questo turno!`);
                        return;
                    }
                    // Necrovalley (id 890): se banishFromGraveyard fallisse,
                    // onBanished non scatta e la catena si ferma da sola —
                    // il costo non pagato per intero non concede il beneficio.
                    banishFromGraveyardWithChoice(ctx, ctx.owner, isAncientGearMonster, {
                        title: '⚙️ Fabbrica dell\'Ingranaggio Antico',
                        text: `Scegli quale mostro "Ingranaggio Antico" bandire dal Cimitero (mancano ${remaining} Livelli).`
                    }, (card) => {
                        banishedNames.push(card.name);
                        remaining -= card.level;
                        banishNext();
                    });
                };
                banishNext();
            };

            if (candidates.length === 1 || !Decisioni.rispondeUnaPersona(ctx.owner)) {
                let best = candidates[0];
                candidates.forEach((c) => { if (c.level > best.level) best = c; });
                revealChosen(best);
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates,
                titolo: '⚙️ Fabbrica dell\'Ingranaggio Antico',
                testo: 'Scegli quale mostro "Ingranaggio Antico" rivelare dalla mano.'
            }, (scelta) => {
                if (scelta === null) return;
                revealChosen(scelta);
            });
        }
    });

    // ================================================================
    // 842 — Trapano Ingranaggio Antico / Ancient Gear Drill (Magia
    // Normale). Entrambe le clausole sono implementate: se controlli un
    // mostro "Ingranaggio Antico", scarta 1 carta e Set 1 Magia
    // direttamente dal Deck, senza poterla attivare in questo turno.
    // ================================================================
    CardEffects.register(842, {
        canActivate(ctx) {
            const hasAncientGear = ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.name && s.card.name.includes('Ingranaggio Antico'));
            if (!hasAncientGear) return false;
            if (ctx.hand(ctx.owner).length === 0) return false;
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            return Array.isArray(deck) && deck.some((c) => c.type === 'spell') && ctx.stField(ctx.owner).some((s) => s === null);
        },
        activate(ctx) {
            offerHandDiscardChoice(ctx, {
                title: '⚙️ Trivella-Ingranaggio Antico',
                text: 'Scegli quale carta scartare dalla mano.'
            }, (discarded) => {
                searchDeckWithChoice(ctx, (c) => c.type === 'spell', {
                    title: '⚙️ Trivella-Ingranaggio Antico',
                    text: 'Scegli quale Magia mettere Set dal Deck.'
                }, (card) => {
                    const freeSlot = ctx.stField(ctx.owner).findIndex((s) => s === null);
                    if (freeSlot === -1) { ctx.graveyard(ctx.owner).push(card); return; }
                    ctx.stField(ctx.owner)[freeSlot] = { card: card, isFaceDown: true, setOnTurn: gameState.turn };
                    gameState.blockedCardUidsThisTurn = gameState.blockedCardUidsThisTurn || new Set();
                    gameState.blockedCardUidsThisTurn.add(card.uid);
                    ctx.log(`⚙️ Trivella-Ingranaggio Antico scarta ${discarded.name} e mette Set ${card.name} dal Deck! Non può essere attivata in questo turno.`);
                });
            });
        }
    });

    // ================================================================
    // 843 — Castello dell'Ingranaggio Antico / Ancient Gear Castle
    // (Magia Continua)
    // Tutti i mostri "Ingranaggio Antico": +300 ATK. Ogni Evocazione
    // Normale/Set (di QUALSIASI mostro, di entrambi i lati — il testo non
    // specifica "tuo") mentre questa carta resta scoperta: +1 Segnalino
    // (card.counters, la convenzione generica già usata da id 131/139).
    // onAnyNormalOrFlipSummon (reactToAnyNormalOrFlipSummon,
    // duel-engine.js) è il gancio giusto per "chiunque", non
    // onOwnMonsterSummoned (solo il proprio lato) — esteso apposta anche
    // alla zona 'st', dove vive questa carta (prima copriva solo la zona
    // Mostri, es. Misterioso Burattinaio id 579).
    // Il sacrificio alternativo ("puoi sacrificare questa carta al posto
    // dei mostri, se i Segnalini bastano") è implementato in
    // js/engine/actions.js (attemptMonsterSummon/performGearCastleTributeSacrifice),
    // non qui: scatta PRIMA della selezione Tributi normale, offerta come
    // modale Sì/Annulla quando si tenta di Evocare Tributo un mostro
    // "Ingranaggio Antico" scoperto con Segnalini sufficienti su questa
    // carta.
    // ================================================================
    CardEffects.register(843, {
        continuous: true,
        activate(ctx) {
            ctx.log("⚙️ Castello-Ingranaggio Antico attivato!");
        },
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown || !(slot.card.name && slot.card.name.includes('Ingranaggio Antico'))) return;
                    const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    gameState.atkDefBonus[slot.card.uid] = { atk: e.atk + 300, def: e.def };
                });
            });
        },
        // "Ogni Evocazione Normale/Set" — ctx.summonedVia distingue 'normal'
        // (Evocazione Normale in Attacco O Set coperto: entrambe passano
        // per TRIGGER.ON_NORMAL_SUMMON, vedi summonMonster in actions.js)
        // da 'flip' (TRIGGER.ON_FLIP, un mostro già Set che si rivela in
        // battaglia) — esclude correttamente il Flip Summon dal conteggio,
        // come da testo reale.
        onAnyNormalOrFlipSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            ctx.card.counters = (ctx.card.counters || 0) + 1;
            ctx.log(`⚙️ Castello-Ingranaggio Antico guadagna 1 Segnalino (${ctx.card.counters} totali)!`);
        }
    });

    // ================================================================
    // 846 — Cambio d'Arma / Weapon Change (Magia Continua)
    // "Una volta per ciascuna delle tue Standby Phase: puoi pagare 700 LP,
    // poi scegliere come bersaglio 1 mostro Tipo Guerriero o Macchina che
    // controlli; scambia l'ATK e la DEF attuali di quel bersaglio fino
    // alla fine del prossimo turno del tuo avversario." — reazione
    // onStandbyPhase(ctx), firePhaseTrigger (duel-engine.js) chiama ogni
    // reazione in un forEach SINCRONO ma senza alcuna dipendenza
    // d'ordinamento successiva (a differenza di onAttackDeclare/559: qui
    // nessun calcolo successivo dipende da QUANDO esattamente si risolve
    // la scelta), quindi una vera scelta interattiva
    // (DuelEngineUI.openChoicePopover per "paga 700 LP?",
    // openCardListPicker se più di un bersaglio idoneo) è sicura. Il bot
    // (nessuna vera IA dedicata) applica sempre se possibile, come le
    // altre scelte "puoi" senza vera IA in questo file. Riusa
    // gameState.orgothAtkDefBonus/orgothActiveUidsFor (395 Orgoth
    // l'Implacabile) per la durata "fino a fine turno dell'avversario":
    // la semantica di scadenza è identica (azzerato in changeTurn,
    // game-flow.js, quando torna il turno di chi l'ha concesso), quindi
    // nessun nuovo store/nessuna nuova logica di pulizia serve.
    // ================================================================
    function applyWeaponChange(ctx, target) {
        ctx.markUsedOncePerTurn(`weapon-change:${ctx.card.uid}`);
        ctx.dealDamage(ctx.owner, 700);
        const atk = DuelEngine.getEffectiveAtk(target);
        const def = DuelEngine.getEffectiveDef(target);
        gameState.orgothAtkDefBonus = gameState.orgothAtkDefBonus || {};
        gameState.orgothActiveUidsFor = gameState.orgothActiveUidsFor || { player: new Set(), bot: new Set() };
        gameState.orgothAtkDefBonus[target.uid] = { atk: def - atk, def: atk - def };
        gameState.orgothActiveUidsFor[ctx.owner].add(target.uid);
        ctx.log(`⚙️ Cambio-Arma paga 700 LP e scambia ATK/DEF di ${target.name} fino a fine turno avversario!`);
    }
    CardEffects.register(846, {
        continuous: true,
        activate(ctx) {
            ctx.log("⚙️ Cambio-Arma attivato!");
        },
        onStandbyPhase(ctx) {
            if (ctx.hasUsedOncePerTurn(`weapon-change:${ctx.card.uid}`)) return;
            const ownLP = Tavolo.lp(ctx.owner);
            if (ownLP <= 700) return;
            const targets = collectFieldTargets(ctx, {
                zone: 'monster', owner: 'self',
                filter: (card) => card.race === 'Guerriero' || card.race === 'Macchina'
            });
            if (targets.length === 0) return;
            // Il mostro passa dal checkpoint di targeting (testo: "scegli
            // come bersaglio"); con un solo candidato chooseFieldCardTarget
            // non apre nulla e sceglie da sé.
            const scegliEScambia = () => chooseFieldCardTarget(ctx, targets, {
                title: "⚙️ Cambio-Arma",
                text: 'Scegli il mostro Guerriero/Macchina a cui scambiare ATK/DEF.',
                dichiara: true
            }, (scelto) => applyWeaponChange(ctx, scelto.card));
            // chooseOption e non un popover a due icone: in Multiplayer la
            // decisione viaggia sulla stessa coda della scelta del mostro,
            // e un "Non fare nulla" non lascia l'altro client ad aspettare.
            // Il bot paga sempre, come prima.
            chooseOption(ctx, {
                title: "⚙️ Cambio-Arma",
                text: 'Paghi 700 Life Points per scambiare ATK e DEF di un tuo mostro Guerriero o Macchina?',
                options: [
                    { value: 'paga', label: 'Paga 700 LP', icon: '✅' },
                    { value: 'no', label: 'Non fare nulla', icon: '❌' }
                ],
                pickForBot: () => 'paga'
            }, (scelta) => { if (scelta === 'paga') scegliEScambia(); });
        }
    });

    // ================================================================
    // 847 — Duplicazione Meccanica / Machine Duplication (Magia Normale)
    // Scegli 1 mostro Macchina con 500 o meno ATK; Special Summon fino
    // a 2 copie con lo stesso nome dal Deck.
    // ================================================================
    CardEffects.register(847, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.race === 'Macchina' && s.card.attack <= 500);
        },
        activate(ctx) {
            // QUALE Macchina si sceglie cambia completamente l'esito: le
            // copie evocate dal Deck sono quelle con il suo stesso nome.
            const candidati = collectFieldTargets(ctx, {
                zone: 'monster',
                owner: 'self',
                filter: (card) => card.race === 'Macchina' && card.attack <= 500
            });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '⚙️ Duplicazione di Macchine',
                dichiara: true,
                text: 'Scegli quale Macchina duplicare: dal Deck arrivano fino a 2 copie con lo stesso nome.'
            }, (scelto) => duplicaMacchina(ctx, scelto.slot));
        }
    });

    /**
     * Corpo di Duplicazione Meccanica (id 847) una volta scelto il
     * bersaglio: vive fuori dalla registrazione solo per non annidare
     * tutto dentro la callback del picker.
     */
    function duplicaMacchina(ctx, targetSlot) {
            if (!targetSlot) return;
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            if (!Array.isArray(deck)) return;
            let summoned = 0;
            while (summoned < 2) {
                const index = deck.findIndex((c) => c.id === targetSlot.card.id);
                if (index === -1) break;
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) break;
                const [card] = deck.splice(index, 1);
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
                summoned++;
            }
            gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
            ctx.log(`⚙️ Duplicazione di Macchine Special Summona ${summoned} copie di ${targetSlot.card.name}!`);
    }

    // ================================================================
    // 848 — Vaso dell'Avarizia / Pot of Avarice (Magia Normale)
    // Rimescola fino a 5 mostri dal Cimitero nel Deck; pesca 2 carte.
    // ================================================================
    CardEffects.register(848, {
        canActivate(ctx) {
            return ctx.graveyard(ctx.owner).filter((c) => c.type === 'monster').length >= 1;
        },
        activate(ctx) {
            // Fino a 5 mostri, scelti UNO ALLA VOLTA (i picker sono
            // asincroni: il secondo deve vivere dentro la callback del
            // primo, o si aprirebbero due liste insieme). Quali mostri
            // tornano nel Deck conta davvero — sono quelli che potrai
            // ripescare.
            const raccolti = [];
            const concludi = () => {
                if (raccolti.length === 0) return;
                if (!ctx.shuffleIntoDeck(ctx.owner, raccolti)) {
                    // Rimescolo impossibile (nessun vero Deck salvato, es.
                    // Duello Demo): le carte tornano da dove sono venute.
                    ctx.graveyard(ctx.owner).push(...raccolti);
                    return;
                }
                ctx.drawCards(ctx.owner, 2);
                ctx.log(`🏺 Giara dell'Avarizia rimescola ${raccolti.length} mostri nel Deck e pesca 2 carte!`);
            };
            const prendi = (restanti) => {
                if (restanti === 0) { concludi(); return; }
                // searchGraveyardWithChoice toglie già la carta dal
                // Cimitero prima di chiamarci — qui serve davvero, la
                // carta se ne va nel Deck.
                const trovato = searchGraveyardWithChoice(ctx, ctx.owner, (c) => c.type === 'monster', {
                    title: '🏺 Vaso dell\'Avarizia',
                    text: `Scegli quale mostro rimescolare nel Deck (${raccolti.length + 1} di 5).`
                }, (card) => {
                    raccolti.push(card);
                    prendi(restanti - 1);
                });
                if (!trovato) concludi();   // finiti i mostri prima di arrivare a 5
            };
            prendi(5);
        }
    });

    // ================================================================
    // 849 — Roccaforte la Fortezza Mobile / Fortress Whale's Oath
    // Trappola Normale: quando si attiva, activateCard() (duel-engine.js)
    // la manda già al Cimitero da sola (comportamento standard di ogni
    // Trappola Normale, dato che questa carta NON dichiara
    // continuous:true) — activate() qui sotto la ripesca subito e la
    // Special Summona in Posizione di Difesa come Mostro con Effetto
    // (Macchina/TERRA/Livello 4/ATK 0/DEF 2000), mutando i campi
    // dell'istanza in campo direttamente (ogni copia giocata è un
    // oggetto proprio, mai condiviso col resto di cardDatabase — stesso
    // principio già usato altrove per modifiche dirette permanenti).
    // Finché controlli Gadget Verde/Rosso/Giallo (id 828/829/830):
    // guadagna 3000 ATK.
    // SEMPLIFICAZIONE: la nota precedente ("questo motore non supporta
    // una carta che esiste contemporaneamente come Trappola E come
    // Mostro") descriveva un limite reale ma risolvibile senza una vera
    // architettura a doppia natura: una volta Special Summonata, questa
    // carta diventa un Mostro puro (perde la propria natura di Trappola
    // ai fini di interazioni ipotetiche con altre carte che verificassero
    // "è ancora una Trappola" — nessuna carta di questo dataset lo fa).
    // ================================================================
    CardEffects.register(849, {
        activate(ctx) {
            const grave = ctx.graveyard(ctx.owner);
            const graveIndex = grave.findIndex((c) => c.uid === ctx.card.uid);
            if (graveIndex !== -1) grave.splice(graveIndex, 1);
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) {
                grave.push(ctx.card);
                ctx.log('⚠️ Il Terreno è pieno: Roccaforte della Fortezza Movente resta nel Cimitero.');
                return;
            }
            ctx.card.type = 'monster';
            ctx.card.race = 'Macchina';
            ctx.card.attribute = 'TERRA';
            ctx.card.level = 4;
            ctx.card.attack = 0;
            ctx.card.defense = 2000;
            // fromZone 'field' e non 'graveyard': è una Trappola ATTIVATA
            // che diventa mostro, non una carta che lascia il Cimitero (che
            // questo motore la parcheggi lì mentre si risolve è un dettaglio
            // interno). Con 'graveyard' Necrovalley l'avrebbe fermata — e
            // DOPO averla già trasformata in mostro qui sopra.
            ctx.specialSummon(ctx.owner, ctx.card, slotIndex, 'defense', 'field');
            // specialSummon(): "difesa" implica coperta di default (stesso
            // comportamento usato da Mago Apprendista id 737) — questa
            // carta invece va Special Summonata SCOPERTA, va corretto qui.
            const newSlot = ctx.field(ctx.owner)[slotIndex];
            if (newSlot) newSlot.isFaceDown = false;
            ctx.log('🐋 Roccaforte della Fortezza Movente si Special Summona come Mostro in Posizione di Difesa!');
        },
        static(ctx) {
            const gadgetIds = [828, 829, 830];
            const hasAllThree = gadgetIds.every((id) => ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.id === id));
            if (!hasAllThree) return;
            const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk + 3000, def: e.def };
        }
    });

    // ================================================================
    // 850 — Raggio Micro / Micro Ray (Trappola Normale)
    // Scegli 1 mostro scoperto sul Terreno; la sua DEF diventa 0 fino a
    // fine turno.
    // ================================================================
    CardEffects.register(850, {
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown));
        },
        activate(ctx) {
            const candidati = collectFieldTargets(ctx, { zone: 'monster' });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🔫 Micro Raggio',
                text: 'Scegli il mostro scoperto a cui azzerare la DEF.',
                dichiara: true
            }, (scelto) => {
                const finalSlot = ctx.field(scelto.owner)[scelto.index];
                if (!finalSlot) return;
                ctx.grantTemporaryAtkDefBonus(finalSlot.card, 0, -DuelEngine.getEffectiveDef(finalSlot.card), false);
                ctx.log(`🔫 Micro Raggio azzera la DEF di ${finalSlot.card.name}!`);
            });
        }
    });

    // ================================================================
    // 851 — Metalmorfosi Rara / Rare Metalmorph (Equipaggiamento, solo
    // Tipo Macchina). "Una volta, annulla un effetto Magia che ha come
    // bersaglio quel mostro": via il checkpoint ctx.declareTarget
    // (duel-engine.js) — la carta reagisce dalla zona ST come Specchietto
    // della Fata/id 235, ma essendo CONTINUA (già scoperta in campo,
    // equipaggiata) NON va al Cimitero quando reagisce (vedi il controllo
    // !def.continuous in tryReact dentro declareCardEffectTarget) — resta
    // equipaggiata, solo "usata" tramite gameState.rareMetalmorphUsedUids.
    // canActivate qui sotto serve DUE scopi diversi a seconda del
    // contesto: la normale attivazione (equip su un mostro Macchina, ctx
    // senza ctx.cancel) e l'eleggibilità come risposta reattiva (ctx con
    // ctx.cancel, costruito da tryReact) — si distinguono controllando se
    // ctx.cancel è una funzione, esattamente come fa tryReact stesso per
    // riconoscere un reactCtx.
    // ================================================================
    CardEffects.register(851, {
        continuous: true,
        canActivate(ctx) {
            if (typeof ctx.cancel === 'function') {
                if (gameState.rareMetalmorphUsedUids && gameState.rareMetalmorphUsedUids.has(ctx.card.uid)) return false;
                if (ctx.sourceType !== 'spell') return false;
                const equipped = ctx.card.equippedToUid;
                const targetSlot = ctx.field(ctx.owner)[ctx.targetIndex];
                return !!(equipped && ctx.targetOwner === ctx.owner && targetSlot && targetSlot.card.uid === equipped);
            }
            return findEquipTarget(ctx, (c) => c.race === 'Macchina') !== -1;
        },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.race === 'Macchina'); },
        isEquip: true,
        onCardEffectTargetDeclare(ctx) {
            gameState.rareMetalmorphUsedUids = gameState.rareMetalmorphUsedUids || new Set();
            gameState.rareMetalmorphUsedUids.add(ctx.card.uid);
            ctx.cancel();
            ctx.log(`🛡️ ${ctx.card.name} annulla l'effetto della Magia (una tantum)!`);
        },
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 500, def: e.def };
        }
    });

    // ================================================================
    // 852 — Fuoco di Copertura / Covering Fire (Trappola Normale)
    // Durante un attacco subito, scegli 1 altro proprio mostro scoperto:
    // il mostro attaccato guadagna il suo ATK, solo per questo Damage Step
    // (ctx.grantDamageStepOnlyBonus, duel-engine.js).
    // ================================================================
    CardEffects.register(852, {
        onAttackDeclare(ctx) {
            if (typeof ctx.targetIndex !== 'number' || ctx.targetIndex === -1) return;
            const own = ctx.field(ctx.owner);
            const targetSlot = own[ctx.targetIndex];
            if (!targetSlot) return;
            // Il mostro che presta l'ATK lo sceglie il giocatore. Era la
            // carta con cui era stato misurato il difetto (scegliendo dopo
            // 4 secondi la battaglia si era già risolta e il bonus arrivava
            // a vuoto): ora la battaglia aspetta la scelta
            // (chooseFieldCardTargetWaiting, vedi callCardHandlerWaiting in
            // duel-engine.js). Il bot sceglie il mostro con l'ATK più alto.
            const candidati = collectFieldTargets(ctx, {
                zone: 'monster', owner: 'self',
                filter: (card, owner, slot) => slot !== targetSlot
            }).sort((a, b) => DuelEngine.getEffectiveAtk(b.card) - DuelEngine.getEffectiveAtk(a.card));
            chooseFieldCardTargetWaiting(ctx, candidati, {
                title: '🔥 Fuoco di Copertura',
                dichiara: true,
                text: `Scegli il mostro che presta il suo ATK a ${targetSlot.card.name} per questo calcolo dei danni.`
            }, (scelto) => {
                const bonus = DuelEngine.getEffectiveAtk(scelto.card);
                ctx.grantDamageStepOnlyBonus(targetSlot.card, bonus, 0);
                ctx.log(`🔥 Fuoco di Copertura aumenta l'ATK di ${targetSlot.card.name} di ${bonus} punti per questo Damage Step!`);
            });
        }
    });

    // ================================================================
    // 853 — Avanti Tutta! / Full Throttle (Magia Normale)
    // Recupera 1 mostro Union (def.isUnion) dal proprio Cimitero e lo
    // aggancia direttamente a un mostro idoneo che si controlla (secondo
    // il unionTargetFilter di quel mostro Union — vedi id 513/515/831
    // qui sopra) — SEMPLIFICAZIONE: sceglie da sola il primo mostro
    // Union/bersaglio idoneo trovato invece di un'interfaccia di
    // selezione dedicata.
    // ================================================================
    CardEffects.register(853, {
        canActivate(ctx) {
            if (!ctx.stField(ctx.owner).some((s) => s === null)) return false;
            return ctx.graveyard(ctx.owner).some((c) => {
                const d = DuelEngine.getDefinition(c.id);
                return d && d.isUnion && typeof d.unionTargetFilter === 'function'
                    && ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && d.unionTargetFilter(s.card));
            });
        },
        activate(ctx) {
            const grave = ctx.graveyard(ctx.owner);
            // Ogni Union ha il proprio unionTargetFilter, quindi un Union
            // entra in lista solo se ha gia' almeno un aggancio valido in
            // campo — altrimenti si sceglierebbe una carta che poi non si
            // puo' equipaggiare a nulla.
            const unioni = grave.filter((card) => {
                const d = DuelEngine.getDefinition(card.id);
                return d && d.isUnion && typeof d.unionTargetFilter === 'function'
                    && ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && d.unionTargetFilter(s.card));
            });
            if (unioni.length === 0) return;
            // chooseCardFromList non passa da searchGraveyardWithChoice, che
            // controlla Necrovalley da sé: qui va controllato a mano.
            if (ctx.graveyardMoveNegated(ctx.owner)) return;
            // chooseCardFromList e non searchGraveyardWithChoice: la carta
            // deve restare nel Cimitero finche' non si sa anche a CHI
            // agganciarla, altrimenti una seconda scelta annullata la
            // lascerebbe fuori da ogni zona.
            chooseCardFromList(ctx, unioni, {
                title: '⚙️ Attaccati!',
                text: 'Scegli quale mostro Union recuperare dal Cimitero.'
            }, (unionCard) => {
                const d = DuelEngine.getDefinition(unionCard.id);
                if (!d || typeof d.unionTargetFilter !== 'function') return;
                const bersagli = collectFieldTargets(ctx, {
                    zone: 'monster', owner: 'self', filter: (c) => d.unionTargetFilter(c)
                });
                if (bersagli.length === 0) return;
                chooseFieldCardTarget(ctx, bersagli, {
                    title: `⚙️ ${unionCard.name}`,
                    text: 'Scegli a quale mostro agganciarlo.'
                }, (scelto) => {
                    const freeStSlot = ctx.stField(ctx.owner).findIndex((s) => s === null);
                    if (freeStSlot === -1) return;
                    const realIndex = grave.findIndex((c) => c.uid === unionCard.uid);
                    if (realIndex === -1) return;
                    const targetSlot = ctx.field(scelto.owner)[scelto.index];
                    if (!targetSlot || targetSlot.card.uid !== scelto.card.uid) return;
                    grave.splice(realIndex, 1);
                    unionCard.equippedToOwner = ctx.owner;
                    unionCard.equippedToIndex = scelto.index;
                    unionCard.equippedToUid = targetSlot.card.uid;
                    ctx.stField(ctx.owner)[freeStSlot] = { card: unionCard, isFaceDown: false, setOnTurn: gameState.turn };
                    ctx.log(`⚙️ Attaccati! recupera ${unionCard.name} dal Cimitero e lo aggancia a ${targetSlot.card.name}!`);
                });
            });
        }
    });

    // ================================================================
    // SCOPERTE durante un controllo generale del database (richiesto
    // dall'utente dopo aver trovato Elfi Gemelli/Elfa Gemella doppie):
    // le seguenti carte avevano già i dati ma NESSUNA registrazione,
    // nonostante fossero incluse in mazzi già "completati" — stesso
    // genere di svista già trovata più volte in questa sessione per
    // Umi/Mura del Castello/Drago Toon Occhi Blu/ecc.
    // ================================================================

    // ------------------------------------------------------------------
    // 130 — Controllo Mentale / Mind Control (Magia Normale)
    // CORREZIONE di fedeltà: era stata implementata come "Brain Control"
    // (Magia diversa, reale: 800 LP, solo mostri scoperti, controllo
    // fino alla End Phase) — il nome italiano è letteralmente "Mind
    // Control", carta reale diversa: nessun costo in LP, bersaglia
    // QUALUNQUE mostro dell'avversario (anche coperto), controllo
    // PERMANENTE (ctx.takeControl(..., true), nuovo 4° parametro
    // "permanent" in duel-engine.js — non torna mai da solo a fine
    // turno), e il mostro preso non può attaccare né essere sacrificato
    // (gameState.cannotAttackUids già esistente + nuovo
    // gameState.cannotBeTributedUids per uid, consultato in actions.js
    // insieme al già esistente def.cannotBeTributed per definizione).
    // ------------------------------------------------------------------
    CardEffects.register(130, {
        declaredTargeting: { count: 1, cardType: 'monster' },
        canActivate(ctx) {
            return ctx.field(ctx.opponent).some((s) => s);
        },
        activate(ctx) {
            // Bersaglia QUALUNQUE mostro avversario, anche coperto: nel
            // picker una carta coperta si vede comunque (è una scelta
            // alla cieca, come al tavolo vero), ma quale prendere lo
            // decide il giocatore invece del primo slot occupato.
            const candidati = [];
            ctx.field(ctx.opponent).forEach((slot, index) => {
                if (slot) candidati.push({ owner: ctx.opponent, index, card: slot.card });
            });
            chooseFieldMonsterTarget(ctx, candidati, {
                title: '🧠 Controllo della Mente',
                text: 'Scegli quale mostro avversario prendere sotto controllo.'
            }, (scelta) => attivaControlloMentale(ctx, scelta));
        }
    });

    /** Corpo di Controllo Mentale (id 130), a bersaglio già scelto. */
    function attivaControlloMentale(ctx, scelta) {
        ctx.declareTargetWaiting(scelta.owner, scelta.index, { totalTargetCount: 1 }, (decl) => {
        if (!decl.allowed) return;
        const targetSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
        if (!targetSlot) return;
        const stolen = targetSlot.card;
        const stolenName = targetSlot.isFaceDown ? 'una carta coperta' : stolen.name;
        if (window.FX && typeof FX.playMindControl === 'function') {
            FX.playMindControl(stolen, decl.targetOwner, decl.targetIndex, 'mind');
        }
        if (ctx.takeControl(ctx.owner, decl.targetOwner, decl.targetIndex, true)) {
            gameState.cannotAttackUidsPermanent = gameState.cannotAttackUidsPermanent || new Set();
            gameState.cannotAttackUidsPermanent.add(stolen.uid);
            gameState.cannotBeTributedUids = gameState.cannotBeTributedUids || new Set();
            gameState.cannotBeTributedUids.add(stolen.uid);
            ctx.log(`🧠 Controllo della Mente prende il controllo permanente di ${stolenName}!`);
        }
        });
    }

    // ------------------------------------------------------------------
    // 136 — Richiamo degli Infestati / Call of the Haunted (Trappola
    // Continua)
    // Scegli come bersaglio 1 mostro nel Cimitero; Special Summonalo.
    // Dipendenza reciproca (targetOwner/targetIndex/targetUid, stesso
    // schema di Incantesimo Ombra id 439/Scavo Fossile id 823): se questa
    // carta lascia il Terreno, distruggi il mostro; se il mostro viene
    // distrutto, distruggi questa carta.
    // ------------------------------------------------------------------
    CardEffects.register(136, {
        continuous: true,
        canActivate(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster') && ctx.findEmptyMonsterSlot(ctx.owner) !== -1;
        },
        activate(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchGraveyardWithChoice(ctx, ctx.owner, (c) => c.type === 'monster', {
                title: '⚰️ Richiamo del Posseduto',
                text: 'Scegli quale mostro Special Summonare dal Cimitero.'
            }, (revived) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) { ctx.graveyard(ctx.owner).push(revived); return; }
                const resolveHaunting = () => {
                    // searchGraveyardWithChoice ha già estratto la carta:
                    // fino a questa callback non è né nel Cimitero né sul
                    // Terreno, quindi non può comparire prima della scena.
                    const freeIndex = ctx.field(ctx.owner)[slotIndex] ? ctx.findEmptyMonsterSlot(ctx.owner) : slotIndex;
                    if (freeIndex === -1) { ctx.graveyard(ctx.owner).push(revived); return; }
                    // La scena di questa carta (FX.playCallOfTheHaunted) fa gia' emergere il mostro: niente secondo volo dal Cimitero.
                    ctx.specialSummon(ctx.owner, revived, freeIndex, 'attack', 'graveyard', { skipGraveyardTravel: !!(window.FX && typeof FX.playCallOfTheHaunted === 'function') });
                    ctx.card.targetOwner = ctx.owner;
                    ctx.card.targetIndex = freeIndex;
                    ctx.card.targetUid = revived.uid;
                    ctx.log(`⚰️ Richiamo del Posseduto Special Summona ${revived.name} dal Cimitero!`);
                };
                if (window.FX && typeof FX.playCallOfTheHaunted === 'function') {
                    FX.playCallOfTheHaunted(ctx.owner, revived, slotIndex, resolveHaunting);
                } else {
                    resolveHaunting();
                }
            });
        },
        static(ctx) {
            if (ctx.card.targetOwner == null) return;
            const targetSlot = ctx.field(ctx.card.targetOwner)[ctx.card.targetIndex];
            const validTarget = targetSlot && !targetSlot.isFaceDown && targetSlot.card.uid === ctx.card.targetUid;
            if (validTarget) return;
            ctx.stField(ctx.owner)[ctx.index] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
        }
    });

    // ------------------------------------------------------------------
    // 232 — Scatola delle Fate / Fairy Box (Trappola Continua)
    // Quando un mostro dell'avversario dichiara un attacco: lancia una
    // moneta; se esce Testa, l'ATK del mostro attaccante diventa 0 fino a
    // fine turno (SEMPLIFICAZIONE: "fino a fine turno" invece di "fino a
    // fine Battle Phase" — ctx.grantTemporaryAtkDefBonus, come ogni altro
    // bonus/malus temporaneo in questo file, scade solo alla End Phase).
    // Durante ciascuna propria Standby Phase: paga 500 Life Points (SEMPLIFICAZIONE:
    // paga sempre, invece di offrire la scelta "paga o distruggi questa
    // carta" — nessuna interfaccia di scelta costo esiste ancora per le
    // Trappole Continue, stesso schema automatico di Maschera del
    // Maledetto id 372). Il "risultato scelto" della moneta non ha una
    // vera scelta dell'utente dietro (nessuna UI per farla): il lancio
    // stesso rappresenta l'esito 50/50, stesso schema di Azzardo (id 255).
    // ------------------------------------------------------------------
    CardEffects.register(232, {
        continuous: true,
        activate(ctx) {
            ctx.log('🧚 Scatola Fatata attivata: pronta a reagire al prossimo attacco avversario!');
        },
        onAttackDeclare(ctx) {
            const attackerSlot = ctx.field(ctx.attackerOwner)[ctx.attackerIndex];
            if (!attackerSlot) return;
            const guessed = ctx.random() < 0.5;
            if (window.FX) FX.playCoinFlip(guessed);
            if (guessed) {
                ctx.grantTemporaryAtkDefBonus(attackerSlot.card, -DuelEngine.getEffectiveAtk(attackerSlot.card), 0, false);
                ctx.log(`🧚 Scatola Fatata indovina il lancio! ATK di ${attackerSlot.card.name} azzerato fino a fine turno!`);
            } else {
                ctx.log('🧚 Scatola Fatata: lancio sbagliato, nessun effetto.');
            }
        },
        onStandbyPhase(ctx) {
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            gameState[lpKey] -= 500;
            ctx.log(`🧚 Scatola Fatata: ${ctx.owner === 'player' ? 'paghi' : 'il bot paga'} 500 Life Points per mantenerla in campo.`);
        }
    });

    // ------------------------------------------------------------------
    // 233 — Impatto Meteora Fatato / Fairy Meteor Crush (Equipaggiamento,
    // qualsiasi mostro)
    // Il mostro equipaggiato infligge danno da battaglia perforante
    // (gameState.piercingUidsFor, esteso apposta in duel-engine.js/
    // actions.js per questa carta).
    // ------------------------------------------------------------------
    CardEffects.register(233, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, () => true) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx); },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            gameState.piercingUidsFor[ctx.owner].add(t.uid);
        }
    });

    // ------------------------------------------------------------------
    // 290 — Sorelle Lady Arpia / Harpie Lady Sisters
    // Non può essere Evocata Normalmente/Set — Special Summonabile solo
    // tramite Egoista Elegante (id 787, già implementato).
    // ------------------------------------------------------------------
    CardEffects.register(290, {
        cannotNormalSummon: true
    });

    // ------------------------------------------------------------------
    // 783 — Lady Arpia 2 / Harpie Lady 2: "il nome è sempre trattato come
    // 'Lady Arpia'" è già gestito ovunque serva tramite isHarpieLadySupport
    // (qui sopra — riconosce sia l'id 172 sia ogni nome che inizia per
    // "Lady Arpia", e "Lady Arpia 2" lo soddisfa per nome). La seconda
    // clausola, "Annulla gli effetti dei Mostri Flip che questa carta
    // distrugge in battaglia", è GIÀ soddisfatta per costruzione da una
    // regola generale del motore (vedi il commento su ON_FLIP/
    // revealsAsIfSurviving in resolveBattleDamage, actions.js, vicino a
    // "Lady Arpia 2"): un Mostro Flip distrutto nella stessa battaglia in
    // cui viene rivelato non attiva MAI il proprio effetto FLIP, per
    // qualunque attaccante — quindi nessuna registrazione dedicata serve
    // per 783 stessa (non ha bisogno di alcuna CardEffects.register).
    // ------------------------------------------------------------------

    // ------------------------------------------------------------------
    // 466 — L'Occhio della Verità / The Eye of Truth (Trappola Continua)
    // Una volta per turno, durante la Standby Phase del tuo avversario,
    // se ha una Magia in mano: guadagni 1000 Life Points
    // (onOpponentStandbyPhase, duel-engine.js/firePhaseTrigger — nuovo
    // aggancio generico, reazione dal lato OPPOSTO a chi vive la fase).
    // SEMPLIFICAZIONE: manca "l'avversario deve tenere la mano rivelata"
    // — nessun impatto pratico, il motore conosce già entrambe le mani.
    // ------------------------------------------------------------------
    CardEffects.register(466, {
        continuous: true,
        activate(ctx) {
            ctx.log("👁️ L'Occhio della Verità attivato! Il tuo avversario deve tenere la mano rivelata.");
        },
        onOpponentStandbyPhase(ctx) {
            const hasSpell = ctx.hand(ctx.standbyOwner).some((c) => c.type === 'spell');
            if (!hasSpell) return;
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            gameState[lpKey] += 1000;
            ctx.log("👁️ L'Occhio della Verità: l'avversario ha una Magia in mano, guadagni 1000 Life Points!");
        }
    });

    // ------------------------------------------------------------------
    // 493 — Behemoth a Due Teste / Twin-Headed Behemoth
    // Se distrutta e mandata al Cimitero: puoi Special Summonarla, con
    // ATK/DEF dimezzati. Una sola volta per Duello (ctx.card._twinHeadedUsed
    // persiste sulla carta stessa).
    // SEMPLIFICAZIONE: risorge SUBITO alla propria distruzione (onDestroy),
    // invece che specificamente alla End Phase dello stesso turno — questo
    // motore chiama onEndPhase solo per carte ANCORA sul Terreno/ST, mai
    // per carte già nel Cimitero, quindi il vero tempismo "End Phase" non
    // è raggiungibile per una carta che si è appena distrutta.
    // ------------------------------------------------------------------
    CardEffects.register(493, {
        onDestroy(ctx) {
            if (ctx.card._twinHeadedUsed) return;
            const grave = ctx.graveyard(ctx.owner);
            const index = grave.findIndex((c) => c.uid === ctx.card.uid);
            if (index === -1) return;
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const [revived] = grave.splice(index, 1);
            revived.attack = Math.floor((revived.attack || 0) / 2);
            revived.defense = Math.floor((revived.defense || 0) / 2);
            revived._twinHeadedUsed = true;
            ctx.specialSummon(ctx.owner, revived, slotIndex, 'attack', 'graveyard');
            ctx.log('🐉 Behemoth Bifronte risorge con ATK/DEF dimezzati!');
        }
    });

    // ================================================================
    // ALTRE SCOPERTE dallo stesso controllo generale (continua): carte
    // con dati reali ma senza registrazione né nota, non incluse in
    // alcun mazzo Starter/Structure ma comunque presenti nel pool
    // libero del Duello Demo.
    // ================================================================

    // ------------------------------------------------------------------
    // 89 — Amazzone Incantatrice / Amazon Archer... (Magia Normale)
    // Scambia l'ATK originale tra 1 propria Amazzone e 1 mostro scoperto
    // dell'avversario, fino a fine turno.
    // SEMPLIFICAZIONE: sceglie da sola i due bersagli (la prima Amazzone
    // e il primo mostro avversario trovati).
    // ------------------------------------------------------------------
    CardEffects.register(89, {
        canActivate(ctx) {
            const hasAmazon = ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.name && /Amazzone|(?<!Imboscata )Amazoness/.test(s.card.name));
            if (!hasAmazon) return false;
            return ctx.field(ctx.opponent).some((s) => s && !s.isFaceDown);
        },
        activate(ctx) {
            // Due bersagli, in sequenza: prima QUALE Amazzone, poi con
            // quale mostro avversario scambiarne l'ATK. Con più Amazzoni
            // in campo la prima scelta cambia completamente il risultato.
            const mieAmazzoni = [];
            ctx.field(ctx.owner).forEach((slot, index) => {
                if (slot && !slot.isFaceDown && slot.card.name && /Amazzone|(?<!Imboscata )Amazoness/.test(slot.card.name)) {
                    mieAmazzoni.push({ owner: ctx.owner, index, card: slot.card });
                }
            });
            const suoi = [];
            ctx.field(ctx.opponent).forEach((slot, index) => {
                if (slot && !slot.isFaceDown) suoi.push({ owner: ctx.opponent, index, card: slot.card });
            });
            if (mieAmazzoni.length === 0 || suoi.length === 0) return;
            chooseFieldMonsterTarget(ctx, mieAmazzoni, {
                title: '⚔️ Incantatrice Amazoness',
                text: 'Scegli quale tua Amazzone deve scambiare l\'ATK.'
            }, (miaScelta) => {
                chooseFieldMonsterTarget(ctx, suoi, {
                    title: '⚔️ Incantatrice Amazoness',
                    text: 'Scegli con quale mostro avversario scambiare l\'ATK.'
                }, (suaScelta) => {
                    const own = ctx.field(ctx.owner)[miaScelta.index];
                    if (!own) return;
                    ctx.declareTargetWaiting(suaScelta.owner, suaScelta.index, { totalTargetCount: 1 }, (decl) => {
                        if (!decl.allowed) return;
                        const opp = ctx.field(decl.targetOwner)[decl.targetIndex];
                        if (!opp) return;
                        const ownAtk = own.card.attack, oppAtk = opp.card.attack;
                        ctx.grantTemporaryAtkDefBonus(own.card, oppAtk - ownAtk, 0, false);
                        ctx.grantTemporaryAtkDefBonus(opp.card, ownAtk - oppAtk, 0, false);
                        ctx.log(`⚔️ Incantatrice Amazoness scambia l'ATK di ${own.card.name} e ${opp.card.name}!`);
                    });
                });
            });
        }
    });

    // ------------------------------------------------------------------
    // 94 — Lampada Antica / Ancient Lamp (Ignition)
    // Durante la propria Main Phase: Special Summon "La Jinn il Genio
    // Mistico della Lampada" (id 335) dalla mano.
    // ------------------------------------------------------------------
    // CORREZIONE di fedeltà: aggiunta la clausola mancante "se attaccata
    // mentre coperta, puoi ridirigere l'attacco verso un altro mostro
    // che l'avversario controlla" — onAttackDeclare come risposta del
    // bersaglio stesso (stesso schema di Suijin/Kazejin), ctx.redirectAttack
    // con newOwner esplicito (il campo di chi sta ATTACCANDO, "fuoco
    // amico" come Ragno della Roulette/id 425 risultato 4).
    CardEffects.register(94, {
        canActivate(ctx) {
            // ctx.attackerIndex esiste SOLO nel contesto reattivo di
            // onAttackDeclare (questa carta bersagliata da un attacco) —
            // a differenza del contesto del proprio effetto Ignition
            // (Special Summon La Jinn), che pure vede ctx.zone === 'monster'
            // ma senza questo campo: serve un discriminante diverso da
            // zone qui, dato che entrambi i casi condividono la stessa zona.
            if (typeof ctx.attackerIndex === 'number') {
                const slot = ctx.field(ctx.owner)[ctx.index];
                if (!slot || !slot.isFaceDown) return false;
                return ctx.field(ctx.opponent).some((s, i) => s && i !== ctx.attackerIndex);
            }
            if (gameState.phase !== 'main1' && gameState.phase !== 'main2') return false;
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot || slot.isFaceDown) return false;
            return ctx.hand(ctx.owner).some((c) => c.id === 335) && ctx.findEmptyMonsterSlot(ctx.owner) !== -1;
        },
        onAttackDeclare(ctx) {
            const candidates = [];
            ctx.field(ctx.opponent).forEach((s, i) => { if (s && i !== ctx.attackerIndex) candidates.push(i); });
            if (candidates.length === 0) return;
            ctx.redirectAttack(candidates[0], ctx.opponent);
            ctx.log('🪔 Lampada Antica ridirige l\'attacco verso un altro mostro dell\'avversario!');
        },
        activate(ctx) {
            const hand = ctx.hand(ctx.owner);
            const index = hand.findIndex((c) => c.id === 335);
            if (index === -1) return;
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const [card] = hand.splice(index, 1);
            ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'hand');
            ctx.log('🪔 Lampada Antica Special Summona La Jinn dalla mano!');
        }
    });

    // ------------------------------------------------------------------
    // 146 — Catena di Distruzione / Chain Destruction (Trappola Normale)
    // Quando viene Evocato un mostro con 2000 o meno ATK: distruggi tutte
    // le carte con lo stesso nome nella mano e nel Deck del suo
    // proprietario. Risponde all'Evocazione dell'avversario
    // (onOpponentSummon, stesso schema di Buco Trappola id 40) e anche a una
    // PROPRIA (onOwnSummonResponse, openSummonResponseWindows in
    // duel-engine.js) — da sé serve a sfoltire il proprio Deck. Le copie da
    // distruggere sono sempre quelle di chi controlla il mostro Evocato.
    // ------------------------------------------------------------------
    function catenaDiDistruzione(ctx, controllore) {
        // "Scegli come bersaglio quel mostro": passa dal checkpoint di
        // targeting, anche se l'effetto colpisce poi mano e Deck.
        if (typeof ctx.summonedSlotIndex === 'number') {
            const decl = ctx.declareTarget(controllore, ctx.summonedSlotIndex, { totalTargetCount: 1 });
            if (!decl.allowed) return;
        }
        const name = ctx.summonedCard.name;
        let count = 0;
        const hand = ctx.hand(controllore);
        for (let i = hand.length - 1; i >= 0; i--) {
            if (hand[i].name === name) { ctx.discardChosenFromHand(controllore, i); count++; }
        }
        const deckKey = Tavolo.chiave(controllore, 'Deck');
        const deck = gameState[deckKey];
        if (Array.isArray(deck)) {
            for (let i = deck.length - 1; i >= 0; i--) {
                if (deck[i].name === name) { ctx.millCardFromDeck(controllore, i); count++; }
            }
        }
        ctx.log(`⛓️ Distruzione a Catena manda ${count} copie di ${name} al Cimitero!`);
    }
    CardEffects.register(146, {
        canActivate(ctx) {
            return (ctx.summonedCard?.attack || 0) <= 2000;
        },
        onOpponentSummon(ctx) { catenaDiDistruzione(ctx, ctx.opponent); },
        onOwnSummonResponse(ctx) { catenaDiDistruzione(ctx, ctx.owner); }
    });

    // ------------------------------------------------------------------
    // 152 — Prescelto / The Selected (Magia Normale)
    // Scegli 1 Mostro e 2 carte non-Mostro dalla mano; l'avversario ne
    // sceglie 1 a caso. Se Mostro: Special Summonalo e manda le altre 2
    // al Cimitero. Altrimenti: manda tutte e 3 al Cimitero.
    // SEMPLIFICAZIONE: la "scelta a caso dell'avversario" è simulata
    // scegliendo davvero a caso tra le 3 carte.
    // ------------------------------------------------------------------
    CardEffects.register(152, {
        canActivate(ctx) {
            const hand = ctx.hand(ctx.owner);
            return hand.some((c) => c.type === 'monster') && hand.filter((c) => c.type !== 'monster').length >= 2;
        },
        activate(ctx) {
            // Tre scelte in sequenza dalla propria mano: 1 Mostro e 2
            // non-Mostro. Sono quelle che contano davvero — il Mostro
            // scelto e' l'unico che si puo' finire per Special Summonare, e
            // le altre due le si perde comunque, quindi prima si sceglieva
            // per il giocatore proprio la parte piu' delicata della carta.
            const scelte = [];
            const raccogli = () => {
                if (scelte.length === 3) return risolvi();
                const cercaMostro = scelte.length === 0;
                chooseCardFromHand(ctx, {
                    filter: (c) => (cercaMostro ? c.type === 'monster' : c.type !== 'monster')
                        && !scelte.some((s) => s.uid === c.uid),
                    title: cercaMostro ? '🎲 Prescelto — il Mostro' : `🎲 Prescelto — carta non-Mostro ${scelte.length}/2`,
                    text: cercaMostro
                        ? 'Scegli il Mostro da mettere in gioco: se l\'avversario pesca lui, viene Special Summonato.'
                        : 'Scegli una carta non-Mostro da mettere in gioco.'
                }, (card) => {
                    scelte.push(card);
                    raccogli();
                });
            };
            const risolvi = () => {
                const hand = ctx.hand(ctx.owner);
                // Gli indici si ricalcolano ORA, dopo l'ultima scelta: fra
                // un picker e l'altro la mano puo' essersi mossa, e un
                // indice preso all'inizio punterebbe a un'altra carta.
                scelte.map((c) => hand.indexOf(c)).filter((i) => i !== -1)
                    .sort((a, b) => b - a).forEach((i) => hand.splice(i, 1));
                completaPrescelto(ctx, scelte);
            };
            raccogli();
        }
    });

    // Corpo di Prescelto (id 152) una volta che le 3 carte sono state
    // scelte e tolte dalla mano: e' l'AVVERSARIO a pescarne una a caso fra
    // quelle (ctx.randomPick, sorteggio condiviso in Multiplayer).
    function completaPrescelto(ctx, chosen) {
        if (chosen.length < 3) return;
        const pick = ctx.randomPick(chosen);
        if (pick.type === 'monster') {
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            chosen.forEach((c) => { if (c !== pick) ctx.graveyard(ctx.owner).push(c); });
            // Dalla MANO: le tre carte sono state tolte dalla mano poco
            // prima (vedi risolvi), e il Cimitero qui sopra riceve le due
            // NON pescate.
            if (slotIndex !== -1) ctx.specialSummon(ctx.owner, pick, slotIndex, 'attack', 'hand');
            else ctx.graveyard(ctx.owner).push(pick);
            ctx.log(`🎲 Prescelto: l'avversario sceglie il Mostro! ${pick.name} viene Special Summonato.`);
        } else {
            chosen.forEach((c) => ctx.graveyard(ctx.owner).push(c));
            ctx.log("🎲 Prescelto: l'avversario sceglie male, tutte e 3 le carte finiscono al Cimitero.");
        }
    }

    // ------------------------------------------------------------------
    // 196 — Des Volstgalph
    // Se distrugge un mostro dell'avversario in battaglia (damageOnBattleDestroy):
    // 500 danni. Ogni volta che una Magia Normale o Rapida si risolve:
    // +200 ATK fino a fine turno (riusa onCardActivated).
    // ------------------------------------------------------------------
    CardEffects.register(196, {
        damageOnBattleDestroy: 500,
        canActivateOnCardActivated(ctx) {
            return ctx.activatedCard.type === 'spell' && ['normal', 'quick-play'].includes(ctx.activatedCard.subtype);
        },
        onCardActivated(ctx) {
            if (ctx.card._volstgalphTurn !== gameState.turn) {
                ctx.card._volstgalphTurn = gameState.turn;
                ctx.card._volstgalphBonus = 0;
            }
            ctx.card._volstgalphBonus += 200;
            ctx.grantTemporaryAtkDefBonus(ctx.card, ctx.card._volstgalphBonus, 0, false);
            ctx.log('🐴 Volstgalph Des guadagna 200 ATK fino a fine turno!');
        }
    });

    // ------------------------------------------------------------------
    // 198 — Drago della Dimensione Diversa / Different Dimension Dragon
    // Non può essere distrutta in battaglia da un mostro con 1900 o meno
    // ATK (riusa cardIsIndestructibleByBattle, come Guardiano Celtico
    // Sgradito id 712, ma con la condizione invertita). Immune anche alla
    // distruzione da effetti Magia/Trappola che NON la scelgono come
    // bersaglio: def.immuneToUntargetedSpellTrapDestruction, controllato in
    // ACTIONS.destroyMonster contro i bersagli dichiarati col checkpoint di
    // targeting nella stessa risoluzione.
    // ------------------------------------------------------------------
    CardEffects.register(198, {
        cannotBeDestroyedByBattle: (opponentAtk) => (opponentAtk || 0) <= 1900,
        immuneToUntargetedSpellTrapDestruction: true
    });

    // ------------------------------------------------------------------
    // 197 — Prigione dei Dadi / Dice Jar (Magia Terreno)
    // Quando si attiva: puoi aggiungere 1 Dado Dimensionale (id 200) dal
    // Deck alla mano. All'inizio di OGNI Battle Phase (di chiunque —
    // nuovo hook 'onBattlePhaseStart', firePhaseTrigger, chiamato da
    // enterBattlePhase per entrambi i lati, game-flow.js — ed esteso
    // anche alla zona Magia Terreno, mai scansionata lì prima): ciascun
    // giocatore lancia un dado e applica il risultato a tutti i propri
    // mostri scoperti, fino a fine turno — 1: -1000 ATK, 2: +1000 ATK,
    // 3: -500 ATK, 4: +500 ATK, 5: ATK dimezzata, 6: ATK raddoppiata.
    // "Dimezzata/raddoppiata" NON richiede un nuovo moltiplicatore: il
    // delta necessario per farlo si calcola UNA VOLTA sull'ATK effettivo
    // attuale e si applica come normale bonus temporaneo
    // (grantTemporaryAtkDefBonus, già esistente) — identico risultato,
    // nessuna nuova infrastruttura di moltiplicazione.
    // ================================================================
    CardEffects.register(197, {
        activate(ctx) {
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const countKey = Tavolo.chiave(ctx.owner, 'DeckCount');
            const deck = gameState[deckKey];
            if (!Array.isArray(deck)) return;
            const index = deck.findIndex((c) => c.id === 200);
            if (index === -1) return;
            const [card] = deck.splice(index, 1);
            gameState[countKey] = deck.length;
            ctx.hand(ctx.owner).push(card);
            ctx.log('🎲 Prigione dei Dadi aggiunge Dado Dimensionale dal Deck alla mano!');
        },
        onBattlePhaseStart(ctx) {
            Tavolo.ordine().forEach((owner) => {
                const roll = 1 + Math.floor(ctx.random() * 6);
                if (window.FX) FX.playDiceRoll(roll);
                ctx.log(`🎲 Prigione dei Dadi: ${owner === 'player' ? 'tu tiri' : 'il bot tira'} un ${roll}!`);
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown) return;
                    const currentAtk = DuelEngine.getEffectiveAtk(slot.card);
                    let delta = 0;
                    if (roll === 1) delta = -1000;
                    else if (roll === 2) delta = 1000;
                    else if (roll === 3) delta = -500;
                    else if (roll === 4) delta = 500;
                    else if (roll === 5) delta = -Math.floor(currentAtk / 2);
                    else if (roll === 6) delta = currentAtk;
                    if (delta !== 0) ctx.grantTemporaryAtkDefBonus(slot.card, delta, 0, false);
                });
            });
        }
    });

    // findLevel7SpellcasterTarget vive ora fra gli helper condivisi, in cima a
    // js/engine/card-effects.js: serve a gruppi di carte lontani fra loro,
    // quindi non può stare dentro un singolo file-parte.


    // grantAttackAllEnemiesOncEach vive ora fra gli helper condivisi, in cima a
    // js/engine/card-effects.js: serve a gruppi di carte lontani fra loro,
    // quindi non può stare dentro un singolo file-parte.


    // ------------------------------------------------------------------
    // 199 — Movimento d'Onda Diffuso / Wave-Motion Cannon... in realtà
    // testo di "Diffusion Wave-Motion": se l'avversario controlla un
    // mostro, paga 1000 LP e scegli 1 tuo Incantatore di Livello 7+: DEVE
    // attaccare tutti i mostri avversari una volta ciascuno in questo
    // turno; gli altri tuoi mostri non possono attaccare. Vedi
    // grantAttackAllEnemiesOncEach qui sopra: concede sia gli attacchi
    // extra necessari sia l'obbligo vero e proprio
    // (gameState.mustAttackTargetUidsFor, verificato da
    // handlePhaseStepperClick in game-flow.js prima di lasciar uscire
    // dalla Battle Phase).
    // ------------------------------------------------------------------
    CardEffects.register(199, {
        canActivate(ctx) {
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            if (gameState[lpKey] < 1000) return false;
            if (!ctx.field(ctx.opponent).some((s) => s)) return false;
            return findLevel7SpellcasterTarget(ctx) !== -1;
        },
        activate(ctx) {
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            const scelto = findLevel7SpellcasterTarget(ctx);
            if (scelto === -1) return;
            gameState[lpKey] -= 1000; // costo: si paga prima di scegliere il bersaglio
            // Checkpoint di targeting ("scegli come bersaglio"); l'effetto
            // vale solo per un mostro che controlli.
            ctx.declareTargetWaiting(ctx.owner, scelto, { totalTargetCount: 1 }, (decl) => {
                if (!decl.allowed || decl.targetOwner !== ctx.owner) return;
                const targetIndex = decl.targetIndex;
                const targetSlot = ctx.field(ctx.owner)[targetIndex];
                grantAttackAllEnemiesOncEach(ctx, targetIndex);
                // Seconda clausola del testo ufficiale: "gli effetti dei mostri
                // distrutti da questi attacchi non possono attivarsi e vengono
                // annullati" — vedi fireOnDestroy (actions.js), che consulta
                // questo Set. (Clausola del testo ufficiale, prima presente solo
                // nell'alias eliminato "Onda di Diffusione".)
                gameState.negatesEffectsOnForcedAttackFor = gameState.negatesEffectsOnForcedAttackFor || new Set();
                gameState.negatesEffectsOnForcedAttackFor.add(targetSlot.card.uid);
                ctx.log(`🌊 Esplosione a Onde Soniche: ${targetSlot.card.name} deve attaccare tutti i mostri avversari, e i loro effetti non si attiveranno se distrutti!`);
            });
        }
    });

    // ------------------------------------------------------------------
    // 220 — Scuotiterra / Earthquake... (Trappola Normale)
    // Scegli 2 Attributi; l'avversario ne sceglie 1: distruggi tutti i
    // mostri scoperti con quell'Attributo.
    // Tre scelte vere (chooseOption): chi attiva dichiara i due Attributi,
    // poi è l'AVVERSARIO a scegliere quale dei due si applica — se
    // l'avversario è il giocatore, la domanda arriva a lui. Prima la scelta
    // dell'avversario era un lancio a caso fra i due Attributi più
    // presenti, e chi attivava non dichiarava nulla.
    // Il bot dichiara gli Attributi che colpiscono più mostri avversari
    // che propri, e da avversario sceglie quello che gli costa meno.
    // ------------------------------------------------------------------
    const SCUOTITERRA_ATTRIBUTI = ['LUCE', 'OSCURITÀ', 'TERRA', 'ACQUA', 'FUOCO', 'VENTO', 'DIVINO'];
    function scuotiterraConta(ctx, attributo, owner) {
        return ctx.field(owner).filter((s) => s && !s.isFaceDown && s.card.attribute === attributo).length;
    }
    function scuotiterraOpzioni(ctx, escludi) {
        // Prima gli Attributi presenti sul Terreno, poi gli altri: dichiarare
        // un Attributo che nessuno ha è legale, ma raramente utile.
        return SCUOTITERRA_ATTRIBUTI
            .filter((a) => a !== escludi)
            .map((a) => ({ a, n: scuotiterraConta(ctx, a, 'player') + scuotiterraConta(ctx, a, 'bot') }))
            .sort((x, y) => y.n - x.n)
            .map((x) => ({ value: x.a, label: `${x.a} (${x.n} scoperti sul Terreno)` }));
    }
    CardEffects.register(220, {
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown));
        },
        activate(ctx) {
            const fine = attendiScelta(ctx);
            // Per chi attiva: quanto conviene un Attributo (mostri avversari
            // colpiti meno i propri).
            const vantaggio = (a) => scuotiterraConta(ctx, a, ctx.opponent) - scuotiterraConta(ctx, a, ctx.owner);
            const migliorePerChiAttiva = (escludi) => SCUOTITERRA_ATTRIBUTI
                .filter((a) => a !== escludi)
                .reduce((best, a) => (vantaggio(a) > vantaggio(best) ? a : best), SCUOTITERRA_ATTRIBUTI.find((a) => a !== escludi));
            chooseOption(ctx, {
                title: '🌍 Scuotiterra',
                text: 'Dichiara il primo Attributo.',
                options: scuotiterraOpzioni(ctx, null),
                pickForBot: () => migliorePerChiAttiva(null)
            }, (primo) => {
                chooseOption(ctx, {
                    title: '🌍 Scuotiterra',
                    text: `Dichiara il secondo Attributo (il primo è ${primo}).`,
                    options: scuotiterraOpzioni(ctx, primo),
                    pickForBot: () => migliorePerChiAttiva(primo)
                }, (secondo) => {
                    chooseOption(ctx, {
                        chooser: ctx.opponent,
                        title: '🌍 Scuotiterra',
                        text: `L'avversario ha dichiarato ${primo} e ${secondo}: scegli quale Attributo viene distrutto.`,
                        options: [primo, secondo].map((a) => ({
                            value: a,
                            label: `${a} (tuoi ${scuotiterraConta(ctx, a, ctx.opponent)}, suoi ${scuotiterraConta(ctx, a, ctx.owner)})`
                        })),
                        // Da avversario, il bot sceglie l'Attributo che gli
                        // costa meno rispetto a quanto costa a chi attiva.
                        pickForBot: () => (vantaggio(primo) <= vantaggio(secondo) ? primo : secondo)
                    }, (scelto) => {
                        try {
                            const chosen = scelto || primo;
                            let count = 0;
                            Tavolo.ordine().forEach((owner) => {
                                ctx.field(owner).forEach((slot, index) => {
                                    if (slot && !slot.isFaceDown && slot.card.attribute === chosen) { ctx.destroyMonster(owner, index); count++; }
                                });
                            });
                            ctx.log(`🌍 Scuotiterra: dichiarati ${primo} e ${secondo}, ${ctx.opponent === 'player' ? 'scegli' : 'il bot sceglie'} ${chosen}: distrutti ${count} mostri!`);
                        } finally {
                            fine();
                        }
                    });
                });
            });
        }
    });

    // ------------------------------------------------------------------
    // 253 — Giuramento della Balena Fortezza / Fortress Whale's Oath
    // (Magia Rituale)
    // Sacrifica dal Terreno E/O dalla mano (CORREZIONE di fedeltà —
    // prima solo dal Terreno) mostri per un Livello totale di almeno 7
    // per Special Summon Balena Fortezza (id 252) dalla mano. Stesso
    // schema di Rito del Guerriero Nero (id 56).
    // ------------------------------------------------------------------
    CardEffects.register(253, {
        canActivate(ctx) {
            const handIndex = ctx.hand(ctx.owner).findIndex((c) => c.id === 252);
            if (handIndex === -1) return false;
            return maxRitualTributeLevel(ctx, handIndex) >= 7;
        },
        activate(ctx) {
            const handIndex = ctx.hand(ctx.owner).findIndex((c) => c.id === 252);
            if (handIndex === -1) return;
            performRitualTribute(ctx, 7, handIndex);
            const hand = ctx.hand(ctx.owner);
            const finalHandIndex = hand.findIndex((c) => c.id === 252);
            if (finalHandIndex === -1) return;
            const [ritualCard] = hand.splice(finalHandIndex, 1);
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) { ctx.graveyard(ctx.owner).push(ritualCard); return; }
            ctx.specialSummon(ctx.owner, ritualCard, slotIndex, 'attack', 'hand');
            ctx.log('🐋 Giuramento della Balena Fortezza evoca Balena Fortezza!');
        }
    });

    // ------------------------------------------------------------------
    // 252 — Balena Fortezza / Fortress Whale: Evocabile Rituale solo
    // tramite "Giuramento della Balena Fortezza" (id 253, qui sopra —
    // GIÀ IMPLEMENTATA). Qui serve solo il divieto di Evocazione
    // Normale/Set e di Special Summon per ogni altra via
    // (cannotNormalSummon/cannotBeSpecialSummoned — stesso schema di 413).
    // ------------------------------------------------------------------
    CardEffects.register(252, {
        cannotNormalSummon: true,
        cannotBeSpecialSummoned: true
    });

    // ------------------------------------------------------------------
    // 289 — Lady Arpia Formazione della Fenice / Harpie's Phoenix
    // Formation (Magia Normale)
    // Se controlli 3+ "Lady Arpia"/"Sorelle Arpie": distruggi
    // altrettanti mostri dell'avversario, poi infliggi danno pari
    // all'ATK originale più alto tra quelli distrutti.
    // ------------------------------------------------------------------
    CardEffects.register(289, {
        canActivate(ctx) {
            const harpieCount = ctx.field(ctx.owner).filter((s) => s && !s.isFaceDown && (isHarpieLadySupport(s.card) || s.card.name === 'Sorelle Arpie')).length;
            if (harpieCount < 3) return false;
            return ctx.field(ctx.opponent).some((s) => s);
        },
        activate(ctx) {
            const harpieCount = ctx.field(ctx.owner).filter((s) => s && !s.isFaceDown && (isHarpieLadySupport(s.card) || s.card.name === 'Sorelle Arpie')).length;
            // Quanti bersagli: tanti quante le Lady Arpia (o tutti i mostri
            // avversari, se sono di meno). Li sceglie il giocatore, uno alla
            // volta; il bot prende i più forti, che è anche la scelta che
            // conviene (il danno è l'ATK originale più alto fra i distrutti).
            const fine = attendiScelta(ctx);
            const avversari = () => collectFieldTargets(ctx, { zone: 'monster', owner: 'opponent', includiCoperte: true })
                .sort((a, b) => (b.card.attack || 0) - (a.card.attack || 0));
            const quanti = Math.min(harpieCount, avversari().length);
            const passi = [];
            for (let n = 0; n < quanti; n++) {
                passi.push({ candidati: avversari, title: '🦅 Lady Arpia Formazione Fenice', text: `Scegli il mostro avversario da distruggere (${n + 1} di ${quanti}).` });
            }
            chooseFieldTargetsInSequence(ctx, passi, (finali) => {
                try {
                    let destroyed = 0, maxAtk = 0;
                    finali.forEach((f) => {
                        const idx = ctx.field(f.owner).findIndex((s) => s && s.card.uid === f.card.uid);
                        if (idx === -1) return;
                        maxAtk = Math.max(maxAtk, f.card.attack || 0);
                        ctx.destroyMonster(f.owner, idx);
                        destroyed++;
                    });
                    if (maxAtk > 0) ctx.dealDamage(ctx.opponent, maxAtk);
                    ctx.log(`🦅 Lady Arpia Formazione Fenice distrugge ${destroyed} mostri e infligge ${maxAtk} danni!`);
                } finally {
                    fine();
                }
            });
        }
    });

    // ------------------------------------------------------------------
    // 307 — Carte Infinite / Infinite Cards (Magia Continua)
    // Nessun limite al numero di carte in mano — controllato direttamente
    // in enterEndPhase() (game-flow.js), non tramite un handler qui.
    // ------------------------------------------------------------------
    CardEffects.register(307, {
        continuous: true,
        activate(ctx) {
            ctx.log('🎴 Carte Infinite attivata: nessun limite alla mano!');
        }
    });

    // ------------------------------------------------------------------
    // 308 — Congedo Infinito / Eternal Draught... (Trappola Continua)
    // I mostri di Livello 3 o inferiore vengono distrutti alla End Phase
    // del turno in cui sono stati Evocati Normalmente o tramite Flip
    // Summon (riusa slot.summonedOnTurn, già tracciato dal motore).
    // ------------------------------------------------------------------
    CardEffects.register(308, {
        continuous: true,
        activate(ctx) {
            ctx.log('🚪 Radiazione Infinita attivato!');
        },
        onEndPhase(ctx) {
            let count = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => {
                    if (!slot || slot.isFaceDown) return;
                    if ((slot.card.level || 0) > 3) return;
                    if (slot.summonedOnTurn !== gameState.turn) return;
                    ctx.destroyMonster(owner, index);
                    count++;
                });
            });
            if (count > 0) ctx.log(`🚪 Radiazione Infinita distrugge ${count} mostr${count === 1 ? 'o' : 'i'} appena Evocat${count === 1 ? 'o' : 'i'}!`);
        }
    });

    // ------------------------------------------------------------------
    // 351 — Piccola Guardia Alata / Little Winguard (Ignition)
    // Una volta per turno, durante la propria End Phase: cambia la
    // propria Posizione di Battaglia. Riusa selfFlipToFaceDownDefense in
    // parte — qui però cambia liberamente Attacco<->Difesa, non solo
    // verso coperto.
    // ------------------------------------------------------------------
    CardEffects.register(351, {
        canActivate(ctx) {
            return gameState.phase === 'end';
        },
        activate(ctx) {
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot) return;
            slot.position = slot.position === 'attack' ? 'defense' : 'attack';
            if (slot.position === 'attack') slot.isFaceDown = false;
            ctx.log(`🛡️ Piccola-Guardialata cambia in Posizione di ${slot.position === 'attack' ? 'Attacco' : 'Difesa'}!`);
        }
    });

    // ------------------------------------------------------------------
    // 356 — Ninna Nanna dell'Obbedienza / Lullaby of Obedience (Magia
    // Normale)
    // Paga 2000 LP e dichiara 1 Mostro; l'avversario guarda il proprio
    // Deck, rivela 1 copia se presente, e sceglie: aggiungila alla mano
    // di chi ha attivato, oppure Special Summonala sul suo Terreno.
    // SEMPLIFICAZIONE: la "dichiarazione del nome" è simulata scegliendo
    // a caso un mostro davvero presente nel Deck dell'avversario (invece
    // di dichiarare a priori un nome che potrebbe non esserci); la
    // "scelta dell'avversario" tra i 2 effetti è simulata a caso.
    // ------------------------------------------------------------------
    CardEffects.register(356, {
        canActivate(ctx) {
            const ownLP = Tavolo.lp(ctx.owner);
            if (ownLP <= 2000) return false;
            const deckKey = Tavolo.chiave(ctx.opponent, 'Deck');
            const deck = gameState[deckKey];
            return Array.isArray(deck) && deck.some((c) => c.type === 'monster');
        },
        activate(ctx) {
            ctx.dealDamage(ctx.owner, 2000);
            searchDeckWithChoice(ctx, (c) => c.type === 'monster', { deckOwner: ctx.opponent, title: '🎵 Ninna Nanna dell\'Obbedienza', text: 'Scegli quale mostro rivelare dal Deck avversario.' }, (revealed) => {
                if (ctx.random() < 0.5) {
                    ctx.hand(ctx.owner).push(revealed);
                    ctx.log(`🎵 Ninna Nanna dell'Obbedienza: ${revealed.name} viene aggiunto alla mano!`);
                } else {
                    const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                    if (slotIndex === -1) { ctx.hand(ctx.owner).push(revealed); return; }
                    ctx.specialSummon(ctx.owner, revealed, slotIndex, 'attack', 'deck');
                    ctx.log(`🎵 Ninna Nanna dell'Obbedienza Special Summona ${revealed.name}!`);
                }
            });
        }
    });

    // ------------------------------------------------------------------
    // 379 — Meteorain (Trappola Normale)
    // In questo turno, i propri mostri infliggono danno da battaglia
    // perforante (riusa gameState.piercingUidsFor, esteso per id 233).
    // ------------------------------------------------------------------
    CardEffects.register(379, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown);
        },
        activate(ctx) {
            let count = 0;
            ctx.field(ctx.owner).forEach((slot) => {
                if (slot && !slot.isFaceDown) { ctx.card._meteorainUids = ctx.card._meteorainUids || []; ctx.card._meteorainUids.push(slot.card.uid); count++; }
            });
            ctx.card._meteorainTurn = gameState.turn;
            ctx.log(`🌠 Meteorain concede danno perforante a ${count} propri mostri per questo turno!`);
        },
        static(ctx) {
            if (ctx.card._meteorainTurn !== gameState.turn) return;
            (ctx.card._meteorainUids || []).forEach((uid) => gameState.piercingUidsFor[ctx.owner].add(uid));
        }
    });

    // ------------------------------------------------------------------
    // 403 — Cavalletta d'Emergenza / Emergency Grasshopper... (onDestroy)
    // Quando mandata al Cimitero: Special Summon 1 mostro Tipo Insetto
    // dalla mano.
    // ------------------------------------------------------------------
    CardEffects.register(403, {
        onDestroy(ctx) {
            const hand = ctx.hand(ctx.owner);
            const index = hand.findIndex((c) => c.type === 'monster' && c.race === 'Insetto');
            if (index === -1) return;
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const [card] = hand.splice(index, 1);
            ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'hand');
            ctx.log(`🦗 Cavalletta Pungente Special Summona ${card.name} dalla mano!`);
        }
    });

    // ------------------------------------------------------------------
    // 418 — Ritorno dei Dannati / Return of the Doomed... (Magia Normale)
    // Scarta 1 Mostro. Alla fine di questo turno, riporta in mano 1
    // proprio mostro distrutto in battaglia in questo turno.
    // ------------------------------------------------------------------
    CardEffects.register(418, {
        // Il ritorno in mano e' una SEMPLIFICAZIONE (prende l'ultima carta del Cimitero, non "un mostro
        // distrutto in questo turno"): il bot scarterebbe un mostro per riprendersi spesso la carta stessa.
        aiCanActivate() { return false; },
        canActivate(ctx) {
            return ctx.hand(ctx.owner).some((c) => c.type === 'monster');
        },
        activate(ctx) {
            offerHandDiscardChoice(ctx, {
                filter: (c) => c.type === 'monster',
                title: '⚰️ Ritorno del Condannato',
                text: 'Scegli quale mostro scartare dalla mano.'
            }, (discarded) => {
                gameState._returnOfTheDoomedTurn = gameState._returnOfTheDoomedTurn || {};
                gameState._returnOfTheDoomedTurn[ctx.owner] = gameState.turn;
                ctx.log(`⚰️ Ritorno del Condannato scarta ${discarded.name}!`);
            });
        },
        onEndPhase(ctx) {
            if (!gameState._returnOfTheDoomedTurn || gameState._returnOfTheDoomedTurn[ctx.owner] !== gameState.turn) return;
            const grave = ctx.graveyard(ctx.owner);
            if (grave.length === 0) return;
            gameState._returnOfTheDoomedTurn[ctx.owner] = null;
            if (ctx.graveyardMoveNegated(ctx.owner)) return;
            const card = grave.pop();
            ctx.hand(ctx.owner).push(card);
            ctx.log(`⚰️ Ritorno del Condannato riporta ${card.name} in mano!`);
        }
    });

    // ------------------------------------------------------------------
    // 419 — Anello della Distruzione / Ring of Destruction (Trappola
    // Normale)
    // Durante il turno dell'avversario: distruggi 1 mostro scoperto
    // dell'avversario con ATK<=LP dell'avversario; subisci danno pari al
    // suo ATK, poi infliggi altrettanto danno all'avversario.
    // ------------------------------------------------------------------
    CardEffects.register(419, {
        canActivate(ctx) {
            const oppLP = Tavolo.lp(ctx.opponent);
            return ctx.field(ctx.opponent).some((s) => s && !s.isFaceDown && (s.card.attack || 0) <= oppLP);
        },
        activate(ctx) {
            // Il bersaglio non e' solo "quale mostro distruggo": il suo ATK
            // e' anche il danno che SUBISCO io per primo, quindi scegliere
            // da soli il piu' grosso poteva far perdere il duello a chi ha
            // attivato la carta.
            const oppLP = Tavolo.lp(ctx.opponent);
            const candidates = collectFieldTargets(ctx, {
                zone: 'monster', owner: 'opponent',
                filter: (c) => (c.attack || 0) <= oppLP
            });
            if (candidates.length === 0) return;
            chooseFieldCardTarget(ctx, candidates, {
                title: '💍 Anello della Distruzione',
                text: 'Scegli il mostro da distruggere: il suo ATK e\' anche il danno che subisci tu, prima di rigirarlo all\'avversario.',
                dichiara: true
            }, (scelto) => {
                const targetSlot = ctx.field(scelto.owner)[scelto.index];
                if (!targetSlot) return;
                const card = targetSlot.card;
                const damage = card.attack || 0;
                if (window.FX && typeof FX.playRingOfDestruction === 'function') {
                    FX.playRingOfDestruction(scelto.owner, scelto.index, damage);
                }
                ctx.destroyMonster(scelto.owner, scelto.index);
                ctx.dealDamage(ctx.owner, damage);
                ctx.dealDamage(ctx.opponent, damage);
                ctx.log(`💍 Anello della Distruzione distrugge ${card.name} e infligge ${damage} danni ad entrambi!`);
            });
        }
    });

    // ------------------------------------------------------------------
    // 483 — Stregone Mascherato Toon: Mondo gli concede i vantaggi comuni;
    // il suo effetto personale resta la pescata dopo il danno, limitata a
    // una volta per turno anche se Riavvolgimento gli concede due attacchi.
    // ------------------------------------------------------------------
    CardEffects.register(483, {
        isToon: true,
        mustTargetFilterIfPresent(card, owner) {
            const hasWorld = DuelEngine.hasActiveToonWorld(owner);
            return hasWorld && card.type === 'monster' && ((DuelEngine.getDefinition(card.id)?.isToon) || /Toon/i.test(card.name || ''));
        },
        onDealsBattleDamage(ctx) {
            const key = `toon-masked-sorcerer-draw:${ctx.card.uid}`;
            if (ctx.hasUsedOncePerTurn(key)) return;
            ctx.markUsedOncePerTurn(key);
            ctx.drawCards(ctx.owner, 1);
            ctx.log('🎭 Stregone Mascherato Toon pesca 1 carta!');
        }
    });

    // ------------------------------------------------------------------
    // 395 — Orgoth l'Implacabile
    // Effetto Ignition (una volta per turno, solo durante il proprio Main
    // Phase — l'una-volta-per-turno-per-uid è già garantita generically dal
    // motore per zone 'monster', vedi gameState.usedIgnitionThisTurn in
    // duel-engine.js/activateCard): lancia un dado a sei facce 3 volte,
    // questa carta guadagna ATK/DEF pari al totale x100 fino alla fine del
    // turno dell'avversario (gameState.atkDefBonus, revocato in changeTurn()
    // — vedi gameState.orgothActiveUidsFor in game-flow.js), poi in base a
    // quanti risultati coincidono applica l'effetto/gli effetti giusti:
    // ●1-2: indistruttibile (in battaglia e da effetto Carta) fino alla
    //   fine del turno dell'avversario — gameState.orgothIndestructibleUids,
    //   consultato da cardIsIndestructibleByBattle (actions.js) e da
    //   ACTIONS.destroyMonster (duel-engine.js).
    // ●3-4: pesca 2 carte (ctx.drawCards, immediato).
    // ●5-6: può attaccare direttamente questo turno (gameState.directAttackAllowedFor,
    //   già esistente, si azzera da solo ad ogni cambio turno — nessuna
    //   nuova durata da gestire per questa clausola).
    // Se tutti e 3 i lanci coincidono, si applicano tutte e tre le clausole
    // insieme, indipendentemente dal valore uscito (come da testo reale).
    // ------------------------------------------------------------------
    CardEffects.register(395, {
        hasDiceRollEffect: true,
        canActivate(ctx) {
            return (gameState.phase === 'main1' || gameState.phase === 'main2') && gameState.currentPlayer === ctx.owner;
        },
        activate(ctx) {
            const rollDie = () => 1 + Math.floor(ctx.random() * 6);
            const rolls = [rollDie(), rollDie(), rollDie()];
            rolls.forEach((r) => { if (window.FX) FX.playDiceRoll(r); });
            ctx.log(`🎲 Orgoth l'Implacabile lancia 3 dadi: ${rolls.join(', ')}!`);

            const total = rolls[0] + rolls[1] + rolls[2];
            const amount = total * 100;
            gameState.orgothAtkDefBonus = gameState.orgothAtkDefBonus || {};
            const existing = gameState.orgothAtkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.orgothAtkDefBonus[ctx.card.uid] = { atk: existing.atk + amount, def: existing.def + amount };
            gameState.orgothActiveUidsFor = gameState.orgothActiveUidsFor || { player: new Set(), bot: new Set() };
            gameState.orgothActiveUidsFor[ctx.owner].add(ctx.card.uid);
            ctx.log(`🎲 Orgoth l'Implacabile guadagna +${amount} ATK/DEF (totale ${total}) fino alla fine del turno dell'avversario!`);

            const counts = {};
            rolls.forEach((r) => { counts[r] = (counts[r] || 0) + 1; });
            const allSame = rolls[0] === rolls[1] && rolls[1] === rolls[2];
            const pairedValue = allSame ? null : Number(Object.keys(counts).find((k) => counts[k] >= 2));

            const grantIndestructible = () => {
                gameState.orgothIndestructibleUids = gameState.orgothIndestructibleUids || new Set();
                gameState.orgothIndestructibleUids.add(ctx.card.uid);
                ctx.log("🛡️ Orgoth l'Implacabile non può essere distrutta fino alla fine del turno dell'avversario!");
            };
            const grantDraw = () => {
                ctx.drawCards(ctx.owner, 2);
                ctx.log("🃏 Orgoth l'Implacabile fa pescare 2 carte!");
            };
            const grantDirectAttack = () => {
                gameState.directAttackAllowedFor = gameState.directAttackAllowedFor || {};
                gameState.directAttackAllowedFor[ctx.card.uid] = true;
                ctx.log("⚔️ Orgoth l'Implacabile può attaccare direttamente questo turno!");
            };

            if (allSame) {
                grantIndestructible();
                grantDraw();
                grantDirectAttack();
            } else if (pairedValue === 1 || pairedValue === 2) {
                grantIndestructible();
            } else if (pairedValue === 3 || pairedValue === 4) {
                grantDraw();
            } else if (pairedValue === 5 || pairedValue === 6) {
                grantDirectAttack();
            }
        }
    });

    // ------------------------------------------------------------------
    // 246 — Elefante Volante
    // Indistruttibilità condizionata (una volta per turno dell'avversario,
    // solo contro un suo effetto Carta) via def.preventsDestructionByOpponentEffectOncePerTurn,
    // controllata in ACTIONS.destroyMonster (duel-engine.js). Se la
    // prevenzione scatta nella End Phase dell'avversario, si arma la
    // vittoria automatica per un successivo attacco diretto andato a
    // segno (gameState.flyingElephantWinPendingUids -> onDealsBattleDamage
    // qui sotto -> gameState.flyingElephantWinnerOwner -> checkGameOver in
    // game-flow.js).
    // SEMPLIFICAZIONE: la condizione di vittoria armata non ha una
    // scadenza esplicita se il controllore non riesce ad attaccare
    // direttamente nel turno successivo (il testo reale la vorrebbe valida
    // solo per QUEL turno) — resta pendente indefinitamente finché non
    // viene consumata; nessuna carta di questo dataset sfrutta questo
    // margine.
    // ------------------------------------------------------------------
    CardEffects.register(246, {
        preventsDestructionByOpponentEffectOncePerTurn: true,
        onDealsBattleDamage(ctx) {
            if (ctx.targetIndex !== -1) return;
            if (gameState.flyingElephantWinPendingUids && gameState.flyingElephantWinPendingUids.has(ctx.card.uid)) {
                gameState.flyingElephantWinPendingUids.delete(ctx.card.uid);
                gameState.flyingElephantWinnerOwner = ctx.owner;
            }
        }
    });

    // ------------------------------------------------------------------
    // 353 — Signore dei D. (Lord of D.)
    // "Nessun giocatore può scegliere come bersaglio mostri Tipo Drago sul
    // Terreno con effetti di carta." Floodgate assoluto via
    // def.protectsRaceFromTargeting (consultato direttamente da
    // declareCardEffectTarget in duel-engine.js, PRIMA di offrire
    // qualunque risposta) — nessun activate()/canActivate necessario, è
    // una proprietà passiva della carta scoperta, come def.continuous per
    // le Magie/Trappole.
    // ------------------------------------------------------------------
    CardEffects.register(353, {
        protectsRaceFromTargeting: 'Drago'
    });

    // ------------------------------------------------------------------
    // 115 — Gran Scudo Gardna (Big Shield Gardna)
    // Clausola 1: "Quando viene attivata una Magia che prende di mira
    // questa carta coperta (e nessun'altra carta): gira scoperta in
    // Posizione di Difesa e nega l'attivazione" — via
    // def.onCardEffectTargetDeclare (checkpoint sincrono in
    // declareCardEffectTarget, duel-engine.js).
    // "Nessun'altra carta" riguarda i BERSAGLI della Magia, non le altre
    // carte coperte sul Terreno: una versione precedente chiedeva che
    // Gardna fosse l'unica carta coperta del suo controllore, così con una
    // Trappola coperta accanto non si proteggeva più, mentre una Magia con
    // due bersagli veniva negata lo stesso. Testo verificato su YGOPRODeck.
    // Clausola 2: "Se attaccata, a fine Damage Step passa in Posizione di
    // Attacco" — via onBattled(ctx), già esistente (si attiva quando
    // QUESTA carta sopravvive a una battaglia); nessun controllo esplicito
    // "ero il difensore" necessario, perché un mostro in Posizione di
    // Difesa non può MAI dichiarare un attacco (regola già applicata
    // altrove in questo motore), quindi se onBattled scatta mentre questa
    // carta è ancora in Difesa, per esclusione stava DIFENDENDO.
    // ------------------------------------------------------------------
    CardEffects.register(115, {
        canActivate(ctx) {
            if (ctx.zone !== 'monster') return false;
            if (ctx.sourceType !== 'spell') return false;
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (!slot || !slot.isFaceDown) return false;
            // Quante carte prende di mira la Magia: lo dichiara chi la
            // attiva (opzione totalTargetCount di ctx.declareTarget, la
            // passano tutte le carte del dataset); se manca, è una.
            return (ctx.totalTargetCount || 1) === 1;
        },
        onCardEffectTargetDeclare(ctx) {
            const slot = ctx.field(ctx.owner)[ctx.index];
            if (slot) {
                slot.isFaceDown = false;
                slot.position = 'defense';
            }
            ctx.cancel();
            ctx.log(`🛡️ ${ctx.card.name} si gira scoperta in Posizione di Difesa e nega la Magia!`);
        },
        onBattled(ctx) {
            const slot = ctx.field(ctx.owner).find((s) => s && s.card.uid === ctx.card.uid);
            if (slot && slot.position === 'defense') {
                slot.position = 'attack';
                ctx.log(`⚔️ ${ctx.card.name} passa in Posizione di Attacco dopo la battaglia!`);
            }
        }
    });

    // ------------------------------------------------------------------
    // 235 — Specchietto della Fata (Fairy Box / mirror-redirect)
    // "Quando il tuo avversario attiva una Magia che ha come bersaglio
    // esattamente 1 mostro sul Terreno (e nessun'altra carta): scegli un
    // altro bersaglio valido; quella Magia ora ha come bersaglio la nuova
    // carta." Trappola Set reattiva, via def.onCardEffectTargetDeclare
    // (candidati zona ST, declareCardEffectTarget in duel-engine.js).
    // Il percorso asincrono del checkpoint lascia al controllore della
    // Trappola la scelta del nuovo bersaglio. Il vecchio handler sincrono
    // resta come ripiego per integrazioni esterne non ancora attendibili.
    // ------------------------------------------------------------------
    CardEffects.register(235, {
        targetDeclareRequiresChoice: true,
        canActivate(ctx) {
            if (ctx.zone !== 'st') return false;
            if (ctx.sourceType !== 'spell') return false;
            if (ctx.sourceOwner === ctx.owner) return false;
            return ctx.totalTargetCount === 1;
        },
        onCardEffectTargetDeclare(ctx) {
            const candidates = [];
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => {
                    if (!slot || slot.isFaceDown) return;
                    if (owner === ctx.targetOwner && index === ctx.targetIndex) return;
                    candidates.push({ owner, index });
                });
            });
            if (candidates.length === 0) return;
            const preferred = candidates.find((c) => c.owner === ctx.sourceOwner) || candidates[0];
            ctx.redirect(preferred.owner, preferred.index);
            ctx.log(`🪞 ${ctx.card.name} ridirige il bersaglio della Magia!`);
        },
        onCardEffectTargetDeclareWaiting(ctx, onDone) {
            const candidates = [];
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => {
                    if (!slot || slot.isFaceDown) return;
                    if (owner === ctx.targetOwner && index === ctx.targetIndex) return;
                    candidates.push({ owner, index, card: slot.card, slot });
                });
            });
            if (candidates.length === 0) { onDone(); return; }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: candidates,
                mostra: (c) => c.card,
                titolo: '🪞 Specchio Mano di Fata',
                testo: 'Scegli il nuovo bersaglio valido della Magia.',
                automatica: (elenco) => elenco.find((c) => c.owner === ctx.sourceOwner) || elenco[0],
                automaticaSeUnica: true
            }, (scelto) => {
                if (scelto) {
                    ctx.redirect(scelto.owner, scelto.index);
                    ctx.log(`🪞 ${ctx.card.name} ridirige la Magia verso ${scelto.card.name}!`);
                }
                onDone();
            });
        }
    });

    // ------------------------------------------------------------------
    // 738 — Mago Comando del Caos
    // "Annulla l'effetto di una Carta Mostro che ha come bersaglio questa
    // carta." Reazione automatica (carta scoperta sul Terreno), via
    // def.onCardEffectTargetDeclare — a differenza di 115/235 qui sopra,
    // reagisce a un effetto MOSTRO (ctx.sourceType === 'monster'), non a
    // una Magia.
    // ------------------------------------------------------------------
    CardEffects.register(738, {
        canActivate(ctx) {
            if (ctx.zone !== 'monster') return false;
            return ctx.sourceType === 'monster';
        },
        onCardEffectTargetDeclare(ctx) {
            ctx.cancel();
            ctx.log(`🚫 ${ctx.card.name} annulla l'effetto del mostro che la bersaglia!`);
        }
    });

    // ================================================================
    // 866-870 — Destiny Board + Spirit Message "I"/"N"/"A"/"L"
    // Testo ufficiale verificato su db.yugioh-card.com. Destiny Board:
    // "quando questa carta e tutte e 4 le Spirit Message con nomi
    // diversi sono piazzate sul tuo campo, vinci il Duello. Una volta
    // per turno, durante l'End Phase del tuo avversario: piazza 1
    // Spirit Message dalla mano o dal Deck sulla tua zona Magia/
    // Trappola, nell'ordine I-N-A-L. Quando una Spirit Message o
    // Destiny Board che controlli lascia il Terreno: manda tutte le
    // altre al Cimitero." — la vittoria vera e propria si controlla in
    // checkGameOver() (game-flow.js, hasDestinyBoardComplete), non qui:
    // stesso schema di Exodia il Proibito (EXODIA_PIECE_IDS), un
    // controllo "clean" fuori dalla catena di risoluzione di un singolo
    // effetto.
    //
    // Il piazzamento NON passa da activateCard/Chain (le Spirit Message
    // "possono essere piazzate solo dall'effetto di Destiny Board", mai
    // attivate/Set dal giocatore: infatti la loro registrazione qui
    // sotto non ha né canActivate né activate) — nuovo aggancio
    // onOpponentEndPhase(ctx) in firePhaseTrigger (duel-engine.js),
    // stesso identico schema di onOpponentStandbyPhase (già esistente,
    // usato da id 466/645) solo per la End Phase.
    //
    // Santuario Oscuro (id 192, prima clausola, ora implementata): "se
    // una Spirit Message verrebbe piazzata con Destiny Board, puoi
    // Special Summonarla come Mostro Normale (Demone/OSCURITÀ/Livello
    // 1/ATK 0/DEF 0) invece" — stessa carta fisica, MUTATA da Magia a
    // Mostro (card.type riassegnato) al momento della scelta: nessun
    // secondo oggetto/token, la registrazione qui sotto resta valida in
    // entrambe le forme (i suoi hook "lascia il campo" coprono sia
    // onSTDestroyed/onBanished/onReturnedToHandSelf — forma Magia — sia
    // onDestroy/onSacrificedForTribute — forma Mostro). SEMPLIFICAZIONE
    // dichiarata: implementato "non può essere scelta come bersaglio
    // per un attacco" (gameState.cannotBeAttackTargetUids, come
    // Guardiano Kay'est id 285) ma NON "non è influenzata dagli effetti
    // Carta eccetto Destiny Board" — quella è un'immunità condizionata
    // alla FORMA della carta (solo da Mostro, mai da Magia), mentre i
    // floodgate di immunità di questo motore (cannotBeTargetedByCardEffects
    // ecc.) sono flag FISSI per definizione, non condizionabili
    // dinamicamente su card.type senza toccare il checkpoint di
    // targeting condiviso (duel-engine.js) usato da altre 3 carte:
    // rischio di regressione non giustificato per un'interazione così
    // di nicchia (serve avere ENTRAMBE Destiny Board e Santuario Oscuro
    // scoperti insieme).
    // ================================================================
    const DESTINY_BOARD_PIECE_IDS = [866, 867, 868, 869, 870];
    const SPIRIT_MESSAGE_ORDER = [867, 868, 869, 870]; // I, N, A, L — ordine fisso del testo reale

    /**
     * "Quando una Spirit Message o Destiny Board che controlli lascia il
     * Terreno: manda al Cimitero tutte le Spirit Message e Destiny
     * Board che controlli." La carta che ha scatenato questo hook è già
     * stata rimossa dal proprio slot dal chiamante (onSTDestroyed/
     * onDestroy/onBanished/onReturnedToHandSelf/onSacrificedForTribute
     * girano sempre DOPO la rimozione, stesso ordine di ogni altro hook
     * "auto-effetto sulla carta stessa" in questo file) — qui basta
     * spazzare via quelle ancora rimaste, sia in zona Magia/Trappola
     * (Destiny Board, Spirit Message non ancora trasformate) sia in
     * zona Mostro (eventuali Spirit Message già Special Summonate da
     * Santuario Oscuro id 192).
     */
    function collapseDestinyBoardPieces(ctx) {
        const owner = ctx.owner;
        let swept = 0;
        ctx.stField(owner).forEach((slot, index) => {
            if (slot && DESTINY_BOARD_PIECE_IDS.includes(slot.card.id)) {
                ctx.graveyard(owner).push(slot.card);
                ctx.stField(owner)[index] = null;
                swept++;
            }
        });
        ctx.field(owner).forEach((slot, index) => {
            if (slot && DESTINY_BOARD_PIECE_IDS.includes(slot.card.id)) {
                ctx.graveyard(owner).push(slot.card);
                ctx.field(owner)[index] = null;
                swept++;
            }
        });
        if (swept > 0) ctx.log('💀 Tavola del Destino si disperde: le carte Spirit Message rimanenti vanno al Cimitero!');
    }

    CardEffects.register(866, {
        continuous: true,
        activate(ctx) {
            ctx.log('💀 Tavola del Destino si scopre sul Terreno...');
        },
        onOpponentEndPhase(ctx) {
            const owner = ctx.owner;
            if (ctx.hasUsedOncePerTurn(`destiny-board:${ctx.card.uid}`)) return;
            const stField = ctx.stField(owner);
            const nextId = SPIRIT_MESSAGE_ORDER.find((id) => !stField.some((slot) => slot && slot.card.id === id) && !ctx.field(owner).some((slot) => slot && slot.card.id === id));
            if (!nextId) return; // già complete (la vittoria scatta da sola in checkGameOver prima di arrivare qui)
            const hand = ctx.hand(owner);
            const handIdx = hand.findIndex((c) => c.id === nextId);
            const deckKey = Tavolo.chiave(owner, 'Deck');
            const deck = gameState[deckKey];
            const deckIdx = Array.isArray(deck) ? deck.findIndex((c) => c.id === nextId) : -1;
            if (handIdx === -1 && deckIdx === -1) return; // non hai la prossima Spirit Message: nessun effetto questo turno
            ctx.markUsedOncePerTurn(`destiny-board:${ctx.card.uid}`);

            const takeCard = () => {
                if (handIdx !== -1) return hand.splice(handIdx, 1)[0];
                const [card] = deck.splice(deckIdx, 1);
                gameState[Tavolo.chiave(owner, 'DeckCount')] = deck.length;
                return card;
            };

            const placeNormally = () => {
                const freeSt = ctx.stField(owner).findIndex((s) => s === null);
                if (freeSt === -1) {
                    ctx.log('💀 Tavola del Destino: nessuna casella Magia/Trappola libera, la Spirit Message non viene piazzata questo turno.');
                    return;
                }
                const card = takeCard();
                ctx.stField(owner)[freeSt] = { card: card, isFaceDown: false, setOnTurn: gameState.turn };
                ctx.log(`💀 Tavola del Destino piazza scoperta ${card.name} sulla zona Magia/Trappola!`);
            };

            // Santuario Oscuro (id 192): Magia Terreno scoperta dello
            // stesso controllore — offre la scelta "puoi Special
            // Summonarla come Mostro Normale invece".
            const fieldSpellKey = Tavolo.chiave(owner, 'FieldSpell');
            const fs = gameState[fieldSpellKey];
            const hasSanctuary = !!(fs && !fs.isFaceDown && fs.card.id === 192);

            const summonAsMonster = () => {
                const freeMonster = ctx.findEmptyMonsterSlot(owner);
                if (freeMonster === -1) {
                    ctx.log('⚱️ Santuario Oscuro: nessuna casella Mostro libera, la Spirit Message viene piazzata normalmente.');
                    placeNormally();
                    return;
                }
                // takeCard() pesca dalla mano se la Spirit Message e' li',
                // altrimenti dal Deck: la zona va letta PRIMA, perche'
                // takeCard la svuota.
                const zona = handIdx !== -1 ? 'hand' : 'deck';
                const card = takeCard();
                card.type = 'monster';
                card.subtype = 'normal';
                card.vanilla = true;
                card.level = 1;
                card.race = 'Demone';
                card.attribute = 'OSCURITÀ';
                card.attack = 0;
                card.defense = 0;
                ctx.specialSummon(owner, card, freeMonster, 'attack', zona);
                ctx.log(`⚱️ Santuario Oscuro Special Summona ${card.name} come Mostro Normale (Demone/OSCURITÀ/Livello 1/ATK 0/DEF 0)!`);
            };

            if (!hasSanctuary) {
                placeNormally();
            } else if (Decisioni.rispondeUnaPersona(owner)) {
                const previewName = handIdx !== -1 ? hand[handIdx].name : deck[deckIdx].name;
                Decisioni.chiedi({
                    chi: owner,
                    tipo: 'coppia',
                    titolo: '💀 Tavola del Destino',
                    candidati: [
                        { icon: '💀', label: `Piazza ${previewName} normalmente`, onSelect: placeNormally },
                        { icon: '⚱️', label: 'Special Summonala con Santuario Oscuro', onSelect: summonAsMonster }
                    ]
                }, (scelta) => {
                    if (scelta) scelta.onSelect();
                });
            } else {
                // Bot: nessuna vera IA per questa scelta, come altre "puoi"
                // di questo file — avanza sempre verso la vittoria.
                placeNormally();
            }
        },
        onSTDestroyed(ctx) { collapseDestinyBoardPieces(ctx); },
        onBanished(ctx) { collapseDestinyBoardPieces(ctx); },
        onReturnedToHandSelf(ctx) { collapseDestinyBoardPieces(ctx); }
    });

    // Spirit Message "I" — le altre 3 (868/869/870) clonano questa
    // stessa registrazione tramite "cloneEffectOf" in data/cards.json
    // (vedi la libreria CARTE SENZA CODICE BESPOKE più sotto in questo
    // file): comportamento identico per tutte e 4, solo id/nome
    // cambiano nel database.
    CardEffects.register(867, {
        continuous: true,
        static(ctx) {
            // Solo nella forma Mostro (Special Summonata da Santuario
            // Oscuro id 192): "non può essere scelta come bersaglio per
            // un attacco" — gameState.cannotBeAttackTargetUids, per uid,
            // ricalcolato ogni render come ogni altro floodgate di
            // questo tipo, quindi si applica/toglie da solo a seconda
            // della forma attuale della carta. Stesso schema per "non
            // influenzata dagli effetti di altre carte, eccetto Destiny
            // Board" — vedi il commento sul campo in
            // recomputeStaticEffects (duel-engine.js) per il limite noto.
            if (ctx.card.type !== 'monster') return;
            gameState.cannotBeAttackTargetUids[ctx.card.uid] = true;
            gameState.immuneToCardEffectsExceptDestinyBoardUids[ctx.card.uid] = true;
        },
        onSTDestroyed(ctx) { collapseDestinyBoardPieces(ctx); },
        onDestroy(ctx) { collapseDestinyBoardPieces(ctx); },
        onBanished(ctx) { collapseDestinyBoardPieces(ctx); },
        onReturnedToHandSelf(ctx) { collapseDestinyBoardPieces(ctx); },
        onSacrificedForTribute(ctx) { collapseDestinyBoardPieces(ctx); }
    });

    // ================================================================
    // Backlog "carte prima serie TCG mancanti" — vedi docs/audits/AUDIT_CARTE_PRIMA_SERIE.md
    // per l'elenco completo e lo stato di avanzamento. Batch 1 (Livello 1,
    // le più facili).
    // ================================================================

    // 871 — Terraformazione / Terraforming (Magia Normale): cerca 1 Magia
    // Campo dal Deck alla mano — vera scelta tra tutte le Magie Campo
    // tramite searchDeckWithChoice (non più solo la prima trovata via
    // ctx.searchDeckToHand, che non offriva alcuna scelta).
    CardEffects.register(871, {
        canActivate(ctx) {
            const deck = Tavolo.mazzo(ctx.owner);
            return Array.isArray(deck) && deck.some((c) => c.type === 'spell' && c.subtype === 'field');
        },
        activate(ctx) {
            searchDeckWithChoice(ctx, (c) => c.type === 'spell' && c.subtype === 'field', {
                title: '🗺️ Terraformazione',
                text: 'Scegli quale Magia Campo aggiungere alla mano dal Deck.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`🗺️ Terraformazione aggiunge ${card.name} alla mano!`);
            });
        }
    });

    // 872 — Wingweaver: mostro Normale (vanilla), nessun effetto da programmare.

    // 873 — Duo Delinquente / Delinquent Duo (Magia Normale): paga 1000 LP;
    // l'avversario scarta 1 carta A CASO (ctx.discardRandomFromHand), poi,
    // se gliene restano, 1 A SUA SCELTA — victimChoosesDiscard: sceglie chi
    // subisce, non chi ha attivato la carta. In Multiplayer la mano vera di
    // chi subisce sta solo sul suo client: è la fotografia di stato che quel
    // client spedisce dopo la scelta a riallineare entrambi gli scarti.
    CardEffects.register(873, {
        canActivate(ctx) {
            return ctx.hand(ctx.opponent).length > 0;
        },
        activate(ctx) {
            ctx.dealDamage(ctx.owner, 1000);
            const first = ctx.discardRandomFromHand(ctx.opponent);
            if (first) ctx.log(`🃏 Due di Meno: ${ctx.opponent === 'player' ? 'scarti' : 'il bot scarta'} una carta a caso!`);
            if (ctx.hand(ctx.opponent).length === 0) return;
            victimChoosesDiscard(ctx, ctx.opponent, {
                title: '🃏 Due di Meno',
                text: 'Scegli 1 carta della tua mano da scartare.'
            }, (scelta) => {
                ctx.log(`🃏 Due di Meno: ${ctx.opponent === 'player' ? `scarti ${scelta.name}` : 'il bot scarta una carta a sua scelta'}.`);
            });
        }
    });

    // 874 — Confisca / Confiscation (Magia Normale): "guarda la mano
    // dell'avversario, scegli 1 carta al suo interno e falla scartare" — ora
    // una vera scelta (offerHandDiscardChoice con handOwner: ctx.opponent,
    // stesso principio di Amazzone Maestra delle Catene id 86) invece di
    // sceglierla in automatico con AI_SHARED.scoreCardImpact — bug reale
    // corretto in questa sessione, missingEffectNote rimosso da cards.json.
    // Il bot continua a scegliere da solo (score più alto), invariato.
    CardEffects.register(874, {
        canActivate(ctx) {
            return ctx.hand(ctx.opponent).length > 0;
        },
        activate(ctx) {
            ctx.dealDamage(ctx.owner, 1000);
            offerHandDiscardChoice(ctx, {
                handOwner: ctx.opponent,
                title: '🔎 Confisca',
                text: "Guarda la mano dell'avversario e scegli quale carta far scartare.",
                pickForBot: (candidates) => {
                    let best = candidates[0], bestScore = -Infinity;
                    candidates.forEach((card) => {
                        const score = window.AI_SHARED ? AI_SHARED.scoreCardImpact(card) : 0;
                        if (score > bestScore) { bestScore = score; best = card; }
                    });
                    return best;
                }
            }, (discarded) => {
                ctx.log(`🔎 Confisca: ${ctx.owner === 'player' ? 'hai' : 'il bot ha'} guardato la mano avversaria e scartato ${discarded.name}!`);
            });
        }
    });

    // 875 — Libro della Luna / Book of Moon (Magia Rapida): bersaglio
    // auto-selezionato (il mostro scoperto in Attacco con l'ATK più alto,
    // altrimenti il primo mostro scoperto trovato) — stesso spirito di
    // selezione automatica già usato da Cambio di Cuore (id 147), mai
    // segnalato come SEMPLIFICAZIONE in questo dataset per lo stesso
    // identico motivo.
    CardEffects.register(875, {
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown));
        },
        activate(ctx) {
            // Prima sceglieva da sola il mostro scoperto con l'ATK più
            // alto in Attacco. Ha senso come euristica difensiva, ma
            // Libro della Luna si usa anche sui PROPRI mostri (per
            // salvarne uno da un attacco, o per riarmare un effetto FLIP):
            // decidere su chi usarlo è tutta la carta.
            const candidati = collectFieldTargets(ctx, { zone: 'monster' });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🌙 Libro della Luna',
                text: 'Scegli il mostro da girare in Difesa coperta.',
                dichiara: true
            }, (scelto) => {
                const slot = ctx.field(scelto.owner)[scelto.index];
                if (!slot) return;
                const name = slot.card.name;
                if (window.FX && typeof FX.playBookOfMoon === 'function') {
                    FX.playBookOfMoon(scelto.owner, scelto.index, slot.card);
                }
                ctx.changePosition(scelto.owner, scelto.index, 'defense');
                slot.isFaceDown = true;
                ctx.log(`🌙 Libro della Luna gira ${name} in Difesa coperta!`);
            });
        }
    });

    // 876 — Desideri Solenni / Solemn Wishes (Trappola Continua): +500 LP
    // ogni volta che il controllore pesca — nuovo trigger condiviso
    // DuelEngine.TRIGGER.ON_DRAW_CARDS (duel-engine.js), agganciato in
    // drawCardsToHand (game-flow.js), riusabile da qualunque futura carta
    // reattiva alla propria pesca. `continuous: true` + un `activate()`
    // minimo sono OBBLIGATORI (non solo `static()`, a differenza di
    // Decreto Reale id 426, che senza un vero `activate()` risulta di
    // fatto MAI attivabile per davvero — canActivate richiede sempre
    // `typeof def.activate === 'function'`, bug preesistente scoperto
    // per caso mentre verificavo questa carta, non toccato qui: fuori
    // scope per questo backlog) — stesso pattern REALMENTE funzionante
    // di Legame di Gravità (id 707).
    CardEffects.register(876, {
        continuous: true,
        activate(ctx) { ctx.log('🙏 Desideri Solenni è attiva!'); },
        onDrawCards(ctx) {
            ctx.dealDamage(ctx.owner, -500);
            ctx.log('🙏 Desideri Solenni aumenta i Life Points di 500 punti!');
        }
    });

    // 877 — Uniti Vinceremo / United We Stand (Magia Equipaggiamento):
    // +800 ATK/DEF per ogni mostro scoperto controllato dal controllore
    // del mostro equipaggiato — stesso identico schema di Ciondolo Nero
    // (id 117)/Libro delle Arti Segrete (id 127), solo con un bonus
    // scalabile invece che fisso (come Falce del Mietitore id 411, ma
    // sul conteggio dei propri mostri invece che sul Cimitero).
    CardEffects.register(877, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx); },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            const count = ctx.field(ctx.owner).filter((s) => s && !s.isFaceDown).length;
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + count * 800, def: e.def + count * 800 };
        }
    });

    // 878 — Angelo Splendente / Shining Angel (Mostro Effetto): distrutto
    // e mandato al Cimitero → Special Summon 1 mostro LUCE con 1500 ATK o
    // meno dal Deck — vera scelta tramite searchDeckWithChoice, non più
    // il primo trovato nel Deck mescolato. Stesso identico schema
    // (nessuna distinzione "in battaglia" vs "da effetto Carta") già
    // usato da Ratto Gigante (id 614, la sua controparte TERRA di questa
    // stessa famiglia di carte).
    CardEffects.register(878, {
        onDestroy(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.attribute === 'LUCE' && c.attack <= 1500, {
                title: '👼 Angelo Splendente',
                text: 'Scegli quale mostro LUCE (1500 ATK o meno) Special Summonare dal Deck.'
            }, (card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
                ctx.log(`👼 Angelo Splendente Special Summona ${card.name} dal Deck!`);
            });
        }
    });

    // 879 — Il Pescatore Leggendario / The Legendary Fisherman (Mostro
    // Effetto): finché "Umi" (id 497) è sul Terreno, non è influenzato
    // dagli effetti Magia e non può essere scelto come bersaglio
    // d'attacco (l'attacco DIRETTO resta permesso, quindi NON tocca
    // gameState.cannotAttackFor/Uids — quelli impedirebbero anche
    // l'attacco diretto). Nuovo gameState.cannotBeTargetedBySpellsUids
    // (duel-engine.js) — gemello per-ISTANZA di def.cannotBeTargetedBySpells
    // (fisso per definizione, es. Guardiano Kay'est id 285) — perché qui
    // l'immunità va e viene con la presenza di Umi, non è mai fissa.
    CardEffects.register(879, {
        static(ctx) {
            const umiPresent = ['playerFieldSpell', 'botFieldSpell'].some((key) => {
                const fs = ctx.gameState[key];
                return fs && !fs.isFaceDown && fs.card.id === 497;
            }) || gameState.virtualUmiPresent;
            if (!umiPresent) return;
            gameState.cannotBeAttackTargetUids[ctx.card.uid] = true;
            gameState.cannotBeTargetedBySpellsUids[ctx.card.uid] = true;
        }
    });

    // 880 — Messaggero della Pace / Messenger of Peace (Magia Continua):
    // i mostri scoperti con 1500+ ATK (di ENTRAMBI i lati) non possono
    // attaccare — stesso schema di Legame di Gravità (id 707, lì sul
    // Livello invece che sull'ATK).
    // Mantenimento "paga 100 LP o questa carta viene distrutta": è una
    // scelta di chi la controlla. Il giocatore la fa con un popover; il
    // bot paga finché ha più di 1000 LP, poi la lascia andare (100 LP a
    // turno diventano pesanti quando si è vicini a perdere). Con 100 LP o
    // meno non si può pagare: la carta viene distrutta.
    // Nel Multiplayer a passo comune la scelta viaggia da `Decisioni` come
    // ogni altra: il proprietario reale decide e il motore specchio aspetta.
    const messaggeroPaga = (ctx) => {
        ctx.dealDamage(ctx.owner, 100);
        ctx.log('🕊️ Messaggero di Pace: pagati 100 Life Points per mantenerla attiva.');
    };
    const messaggeroLasciaAndare = (ctx) => {
        const i = ctx.stField(ctx.owner).findIndex((s) => s && s.card.uid === ctx.card.uid);
        if (i === -1) return;
        ctx.destroySpellTrap(ctx.owner, i);
        ctx.log('🕊️ Messaggero di Pace non viene mantenuta e viene distrutta.');
    };
    CardEffects.register(880, {
        continuous: true,
        activate(ctx) { ctx.log('🕊️ Messaggero di Pace impedisce l\'attacco ai mostri più forti!'); },
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (slot && !slot.isFaceDown && slot.card.attack >= 1500) {
                        gameState.cannotAttackUids[slot.card.uid] = true;
                    }
                });
            });
        },
        onStandbyPhase(ctx) {
            const lp = Tavolo.lp(ctx.owner);
            if (lp <= 100) { messaggeroLasciaAndare(ctx); return; }
            if (Decisioni.rispondeUnaPersona(ctx.owner)) {
                Decisioni.chiedi({
                    chi: ctx.owner,
                    tipo: 'coppia',
                    titolo: '🕊️ Messaggero di Pace',
                    candidati: [
                        { icon: '💰', label: 'Paga 100 Life Points e mantienila', onSelect: () => messaggeroPaga(ctx) },
                        { icon: '🗑️', label: 'Non pagare: viene distrutta', onSelect: () => messaggeroLasciaAndare(ctx) }
                    ]
                }, (scelta) => {
                    if (scelta) scelta.onSelect();
                });
                return;
            }
            if (lp > 1000) messaggeroPaga(ctx); else messaggeroLasciaAndare(ctx);
        }
    });

    // 881 — Nobile dello Sterminio / Nobleman of Extermination (Magia
    // Normale): distruggi+bandisci 1 Magia/Trappola coperta, scelta dal
    // giocatore fra quelle di entrambi i lati (le avversarie compaiono col
    // retro nella lista: sceglierne una non deve rivelarla). Il bot prende
    // la prima coperta avversaria, come prima.
    // Riusa card.mustBanishOnLeavingField + il redirect condiviso
    // in ACTIONS.destroySpellTrap (duel-engine.js, esteso qui per la
    // prima volta dai soli mostri anche alle Magie/Trappole). Se era una
    // Trappola, bandisce anche ogni copia rimasta in ENTRAMBI i Deck.
    CardEffects.register(881, {
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.stField(owner).some((s) => s && s.isFaceDown));
        },
        activate(ctx) {
            // Avversarie prima: il bot prende il primo candidato.
            const coperta = (card, owner, slot) => !!slot.isFaceDown;
            const candidati = collectFieldTargets(ctx, { zone: 'st', owner: 'opponent', includiCoperte: true, filter: coperta })
                .concat(collectFieldTargets(ctx, { zone: 'st', owner: 'self', includiCoperte: true, filter: coperta }));
            if (candidati.length === 0) return;
            const fine = attendiScelta(ctx);
            chooseFieldCardTarget(ctx, candidati, {
                title: '⚔️ Nobiluomo dello Sterminio',
                text: 'Scegli la Magia o Trappola coperta da distruggere e bandire.',
                onCancel: () => fine()
            }, (scelto) => {
                try {
                    const idx = ctx.stField(scelto.owner).findIndex((s) => s && s.card.uid === scelto.card.uid);
                    if (idx !== -1) nobileSterminioColpisce(ctx, scelto.owner, idx);
                } finally {
                    fine();
                }
            });
        }
    });

    function nobileSterminioColpisce(ctx, targetOwner, targetIndex) {
        {
            const slot = ctx.stField(targetOwner)[targetIndex];
            if (!slot) return;
            const card = slot.card;
            card.mustBanishOnLeavingField = true;
            ctx.destroySpellTrap(targetOwner, targetIndex);
            ctx.log(`⚔️ Nobiluomo dello Sterminio bandisce ${card.name}!`);
            if (card.type === 'trap') {
                ['playerDeck', 'botDeck'].forEach((deckKey) => {
                    const deck = gameState[deckKey];
                    if (!Array.isArray(deck)) return;
                    const deckOwner = deckKey === 'playerDeck' ? 'player' : 'bot';
                    for (let i = deck.length - 1; i >= 0; i--) {
                        if (deck[i].id === card.id) ctx.banished(deckOwner).push(deck.splice(i, 1)[0]);
                    }
                    gameState[deckKey === 'playerDeck' ? 'playerDeckCount' : 'botDeckCount'] = deck.length;
                });
            }
        }
    }

    // 882 — Oppressione Reale / Royal Oppression (Trappola CONTINUA): nega
    // e distrugge un'Evocazione Speciale altrui pagando 800 LP, stesso
    // schema reattivo di Giudizio Solenne (id 448) filtrato a
    // ctx.summonedVia === 'special'. `continuous: true`: alla prima
    // risposta resta scoperta sul Terreno (consumeCandidateCard) invece di
    // finire al Cimitero, e da scoperta findTriggerCandidates la offre di
    // nuovo a ogni Special Summon successiva, pagando ogni volta.
    // "Uno dei due giocatori può pagare": una volta scoperta, la può usare
    // anche l'avversario di chi la controlla, contro una Special Summon di
    // quest'ultimo (`usableByEitherPlayer`, findTriggerCandidates in
    // duel-engine.js). In quel caso ctx.owner è chi risponde: paga lui e il
    // mostro distrutto è di ctx.opponent, cioè di chi ha Evocato — lo
    // stesso codice vale per entrambi i lati.
    CardEffects.register(882, {
        continuous: true,
        usableByEitherPlayer: true,
        canActivate(ctx) {
            const lp = Tavolo.lp(ctx.owner);
            return ctx.summonedVia === 'special' && typeof ctx.summonedCard !== 'undefined' && lp > 800;
        },
        onOpponentSummon(ctx) {
            if (ctx.summonedVia !== 'special') return;
            ctx.declareTargetWaiting(ctx.opponent, ctx.summonedSlotIndex, { totalTargetCount: 1 }, (decl) => {
                if (!decl.allowed) return;
                const target = ctx.field(decl.targetOwner)[decl.targetIndex];
                ctx.dealDamage(ctx.owner, 800);
                ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                ctx.log(`👑 Oppressione Reale paga 800 Life Points per annullare e distruggere ${target ? target.card.name : ctx.summonedCard.name}, appena Special Summonato!`);
            });
        }
    });

    // 883 — Don Zaloog (Mostro Effetto): su danno da battaglia inflitto,
    // il giocatore sceglie fra scarto casuale e mill di 2 carte, oppure di
    // non usare l'effetto ("puoi attivare"). Si risolve DOPO il danno,
    // quando nessuno sta più aspettando il risultato, ma chiede comunque di
    // essere aspettato (attendiScelta): dove il punto di chiamata lo
    // permette, il resto della battaglia riparte a scelta fatta. Il bot
    // preferisce lo scarto quando possibile (di solito il colpo più
    // fastidioso), altrimenti manda al Cimitero dal Deck.
    CardEffects.register(883, {
        onDealsBattleDamage(ctx) {
            const vittima = ctx.opponent;
            const deckKey = Tavolo.chiave(vittima, 'Deck');
            const deck = gameState[deckKey];
            // In Multiplayer il Deck dell'avversario non esiste da questa
            // parte (si tiene solo il conteggio): il mill si può offrire
            // solo se c'è un mazzo vero, o se il conteggio dice che ce n'è.
            const deckCount = Array.isArray(deck) ? deck.length : (Tavolo.conteggioMazzo(vittima) || 0);
            const puoScartare = ctx.hand(vittima).length > 0;
            const puoMandare = deckCount > 0;
            if (!puoScartare && !puoMandare) return;
            const fine = attendiScelta(ctx);
            const scarta = () => {
                const discarded = ctx.discardRandomFromHand(vittima);
                if (discarded) ctx.log(`🗡️ Don Zaloog costringe ${vittima === 'player' ? 'te' : 'il bot'} a scartare ${discarded.name}!`);
            };
            const manda = () => {
                if (!Array.isArray(deck) || deck.length === 0) return;
                const milled = deck.splice(-2, 2);
                milled.forEach((c) => ctx.graveyard(vittima).push(c));
                gameState[deckKey === 'playerDeck' ? 'playerDeckCount' : 'botDeckCount'] = deck.length;
                ctx.log(`🗡️ Don Zaloog manda ${milled.length} cart${milled.length > 1 ? 'e' : 'a'} dal Deck avversario al Cimitero!`);
            };
            // Ridisegnare serve solo se la scelta arriva DOPO (giocatore,
            // o avversario remoto): una scelta immediata cade in mezzo a
            // resolveBattleDamage, che ridisegna da sé al momento giusto.
            let sincrono = true;
            chooseOption(ctx, {
                title: '🗡️ Don Zaloog',
                text: 'Ha inflitto danno da battaglia: puoi usare uno di questi effetti.',
                options: [
                    puoScartare ? { value: 'scarta', label: 'Scarto a caso dalla sua mano', icon: '🃏' } : null,
                    puoMandare ? { value: 'manda', label: '2 carte dal suo Deck al Cimitero', icon: '🪦' } : null
                ],
                optional: true,
                optionalLabel: 'Non usare l\'effetto',
                pickForBot: () => (puoScartare ? 'scarta' : 'manda')
            }, (scelta) => {
                try {
                    if (scelta === 'scarta') scarta();
                    else if (scelta === 'manda') manda();
                    if (!sincrono && typeof updateUI === 'function') updateUI();
                } finally {
                    fine();
                }
            });
            sincrono = false;
        }
    });

    // 884 — Yata-Garasu (Mostro Spirito): non Special Summonabile
    // (nuovo def.cannotSpecialSummon, ACTIONS.specialSummon in
    // duel-engine.js — simmetrico a def.cannotNormalSummon già
    // esistente), torna in mano a fine turno se Evocata Normalmente o
    // girata scoperta (stesso schema di Maharaghi id 755), e se infligge
    // danno da battaglia l'avversario salta la prossima Draw Phase —
    // riusa gameState.skipDrawFor[owner] già esistente (nato per Avidità
    // Sconsiderata id 653, un contatore, non solo un booleano). Una
    // delle carte più famose/discusse della storia del TCG.
    CardEffects.register(884, {
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
            ctx.log('🐦 Yata-Garasu ritorna in mano!');
        },
        onDealsBattleDamage(ctx) {
            gameState.skipDrawFor = gameState.skipDrawFor || {};
            gameState.skipDrawFor[ctx.opponent] = (gameState.skipDrawFor[ctx.opponent] || 0) + 1;
            ctx.log(`🐦 Yata-Garasu: ${ctx.opponent === 'player' ? 'salterai' : 'il bot salterà'} la prossima Draw Phase!`);
        }
    });

    // 885 — Quiz Inverso / Reversal Quiz (Magia Normale): manda mano e
    // campo al Cimitero, dichiara il tipo di carta in cima al proprio
    // Deck, scambia i Life Points se indovina.
    CardEffects.register(885, {
        // Manda al Cimitero TUTTA la propria mano e il proprio campo su una scommessa: il bot non deve
        // mai farlo di sua iniziativa.
        aiCanActivate() { return false; },
        canActivate(ctx) {
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            return Array.isArray(gameState[deckKey]) && gameState[deckKey].length > 0;
        },
        activate(ctx) {
            const hand = ctx.hand(ctx.owner).splice(0);
            hand.forEach((c) => ctx.graveyard(ctx.owner).push(c));
            ctx.field(ctx.owner).forEach((slot, index) => {
                if (!slot) return;
                ctx.graveyard(ctx.owner).push(slot.card);
                ctx.field(ctx.owner)[index] = null;
            });
            ctx.stField(ctx.owner).forEach((slot, index) => {
                if (!slot) return;
                ctx.graveyard(ctx.owner).push(slot.card);
                ctx.stField(ctx.owner)[index] = null;
            });
            const fsKey = Tavolo.chiave(ctx.owner, 'FieldSpell');
            if (gameState[fsKey]) {
                ctx.graveyard(ctx.owner).push(gameState[fsKey].card);
                gameState[fsKey] = null;
            }
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            if (!Array.isArray(deck) || deck.length === 0) {
                ctx.log('🎲 Quiz Invertito: il Deck è vuoto, nessuna carta in cima da dichiarare.');
                return;
            }
            // La categoria la dichiara il giocatore (chooseOption): la Chain
            // aspetta la dichiarazione prima di proseguire (attendiScelta).
            // Il bot dichiara la categoria più frequente fra le carte
            // rimaste nel suo Deck, la scommessa con più probabilità.
            const counts = {};
            deck.forEach((c) => { counts[c.type] = (counts[c.type] || 0) + 1; });
            const piuFrequente = Object.keys(counts).reduce((best, t) => (counts[t] > (counts[best] || 0) ? t : best), 'monster');
            const labels = { monster: 'Mostro', spell: 'Magia', trap: 'Trappola' };
            const fine = attendiScelta(ctx);
            chooseOption(ctx, {
                title: '🎲 Quiz Invertito',
                text: 'Che tipo di carta c\'è in cima al tuo Deck? Se indovini, scambi i tuoi Life Points con quelli dell\'avversario.',
                options: [
                    { value: 'monster', label: 'Mostro', icon: '🐉' },
                    { value: 'spell', label: 'Magia', icon: '✨' },
                    { value: 'trap', label: 'Trappola', icon: '🪤' }
                ],
                pickForBot: () => piuFrequente
            }, (guess) => {
                try {
                    // Rilette ADESSO: fra l'attivazione e la risposta il Deck
                    // può essere cambiato.
                    const deckOra = gameState[deckKey];
                    if (!Array.isArray(deckOra) || deckOra.length === 0) {
                        ctx.log('🎲 Quiz Invertito: il Deck è vuoto, nessuna carta in cima da dichiarare.');
                        return;
                    }
                    const topCard = deckOra[deckOra.length - 1];
                    const correct = topCard.type === guess;
                    ctx.log(`🎲 Quiz Invertito: ${ctx.owner === 'player' ? 'dichiari' : 'il bot dichiara'} "${labels[guess]}" — la carta in cima è ${topCard.name} (${labels[topCard.type]})!`);
                    if (correct) {
                        const lpKeyOwn = Tavolo.chiave(ctx.owner, 'LP');
                        const lpKeyOpp = ctx.owner === 'player' ? 'botLP' : 'playerLP';
                        const tmp = gameState[lpKeyOwn];
                        gameState[lpKeyOwn] = gameState[lpKeyOpp];
                        gameState[lpKeyOpp] = tmp;
                        ctx.log('🎲 Quiz Invertito: indovinato! I Life Points si scambiano!');
                    } else {
                        ctx.log('🎲 Quiz Invertito: sbagliato, nessun effetto.');
                    }
                } finally {
                    fine();
                }
            });
        }
    });

    // 886 — Metamorfosi / Metamorphosis (Magia Normale): tributa 1
    // mostro proprio e Special Summon dall'Extra Deck 1 Mostro Fusione
    // dello stesso Livello — usa lo slot appena liberato dal tributo,
    // nessuna ricerca separata di uno slot vuoto necessaria. Sia il
    // mostro da tributare sia (quando più di uno condivide il Livello)
    // il Mostro Fusione da Special Summonare sono ora una vera scelta,
    // non più sempre il più debole/il primo trovato nell'Extra Deck.
    /**
     * La migliore coppia (mostro da tributare, Fusione da evocare) per chi gioca Metamorfosi: quella col
     * maggior guadagno di ATK effettivo (Fusione - mostro tributato). Serve al bot, che altrimenti
     * tributava il mostro piu' debole e prendeva la PRIMA Fusione dell'Extra Deck col Livello giusto:
     * un Kaiba in vantaggio si toglieva un mostro forte per averne uno scarso. Torna null senza coppie.
     */
    function migliorCoppiaMetamorfosi(ctx) {
        const extraDeck = Tavolo.extraDeck(ctx.owner) || [];
        let migliore = null;
        ctx.field(ctx.owner).forEach((slot) => {
            if (!slot || !slot.card) return;
            // Valore di un mostro: ATK + metà DEF (la Fusione piu' forte in ATK ma con DEF misera non e' un affare).
            const perso = DuelEngine.getEffectiveAtk(slot.card) + 0.5 * DuelEngine.getEffectiveDef(slot.card);
            extraDeck.filter((c) => c.level === slot.card.level).forEach((fusione) => {
                const guadagno = (fusione.attack || 0) + 0.5 * (fusione.defense || 0) - perso;
                if (!migliore || guadagno > migliore.guadagno) migliore = { tributo: slot.card, fusione: fusione, guadagno: guadagno };
            });
        });
        return migliore;
    }

    CardEffects.register(886, {
        // Il bot la attiva solo se la Fusione e' DAVVERO piu' forte del mostro che sacrifica (di almeno 500 ATK).
        aiCanActivate(ctx) {
            const coppia = migliorCoppiaMetamorfosi(ctx);
            return !!coppia && coppia.guadagno >= 500;
        },
        canActivate(ctx) {
            const extraDeck = Tavolo.extraDeck(ctx.owner);
            if (!Array.isArray(extraDeck) || extraDeck.length === 0) return false;
            // Il Sigillo di Orichalcos (id 469) vieta l'Extra Deck: meglio non
            // attivarla che pagare il Tributo per un'Evocazione che non avverrà.
            if (DuelEngine.isExtraDeckSummonBlocked(ctx.owner)) return false;
            return ctx.field(ctx.owner).some((s) => s && extraDeck.some((c) => c.level === s.card.level));
        },
        activate(ctx) {
            const field = ctx.field(ctx.owner);
            const extraDeck = Tavolo.extraDeck(ctx.owner);
            const tributeCandidates = field
                .map((slot) => (slot && extraDeck.some((c) => c.level === slot.card.level) ? slot.card : null))
                .filter(Boolean);
            if (tributeCandidates.length === 0) return;

            // Doppia scelta vera: quale mostro tributare, poi (se più di
            // un Mostro Fusione dell'Extra Deck condivide quel Livello)
            // quale Special Summonare — prima entrambe erano
            // auto-selezionate (il più debole da tributare, il primo
            // trovato nell'Extra Deck).
            const summonFusion = (tributedCard, fusionCard) => {
                const idx = field.findIndex((s) => s && s.card === tributedCard);
                if (idx === -1) return;
                field[idx] = null;
                ctx.graveyard(ctx.owner).push(tributedCard);
                DuelEngine.notifySacrificedForTribute(ctx.owner, tributedCard);
                const extraIndex = extraDeck.indexOf(fusionCard);
                if (extraIndex === -1) return;
                const summonedFusion = extraDeck.splice(extraIndex, 1)[0];
                ctx.specialSummon(ctx.owner, summonedFusion, idx, 'attack', 'extra');
                ctx.log(`🌀 Metamorfosi tributa ${tributedCard.name} per Special Summonare ${summonedFusion.name}!`);
            };
            const tributeChosen = (tributedCard) => {
                const fusionCandidates = extraDeck.filter((c) => c.level === tributedCard.level);
                if (fusionCandidates.length === 1 || !Decisioni.rispondeUnaPersona(ctx.owner)) {
                    // Il bot prende la Fusione piu' forte, non la prima che l'Extra Deck ha per quel Livello.
                    const piuForte = fusionCandidates.reduce((m, c) => ((c.attack || 0) > (m.attack || 0) ? c : m), fusionCandidates[0]);
                    summonFusion(tributedCard, piuForte);
                    return;
                }
                Decisioni.chiedi({
                    chi: ctx.owner,
                    candidati: fusionCandidates,
                    titolo: '🌀 Metamorfosi',
                    testo: "Scegli quale Mostro Fusione Special Summonare dall'Extra Deck."
                }, (fusionCard) => {
                    if (fusionCard === null) return;
                    summonFusion(tributedCard, fusionCard);
                });
            };

            if (tributeCandidates.length === 1 || !Decisioni.rispondeUnaPersona(ctx.owner)) {
                // Il bot sceglie la coppia che guadagna di piu' (vedi migliorCoppiaMetamorfosi), non "il
                // mostro piu' debole": il piu' debole puo' avere solo Fusioni peggiori di un altro mostro.
                const coppia = migliorCoppiaMetamorfosi(ctx);
                if (coppia) { summonFusion(coppia.tributo, coppia.fusione); return; }
                let weakest = tributeCandidates[0];
                tributeCandidates.forEach((c) => { if (c.attack < weakest.attack) weakest = c; });
                tributeChosen(weakest);
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: tributeCandidates,
                titolo: '🌀 Metamorfosi',
                testo: 'Scegli quale mostro tributare.'
            }, (scelta) => {
                if (scelta === null) return;
                tributeChosen(scelta);
            });
        }
    });

    // 887 — Cancello di Fusione / Fusion Gate (Magia Campo). Riusa
    // DuelEngine.getFusableExtraDeckMonsters/ctx.fusionSummon già esistenti
    // per "Polimerizzazione" (id 38) — qui come Ignition ripetibile di un Continuo
    // già scoperto (repeatableWhileContinuous, stesso schema di Offerta
    // Suprema id 559). I materiali vengono BANDITI (fusionSummon con
    // banishMaterials). "Il giocatore di turno" vuol dire chiunque sia di
    // turno, anche l'avversario di chi controlla la carta: def.activateAsTurnPlayer,
    // chiamata cliccando la Magia Terreno dell'avversario nella propria Main
    // Phase (handleCardClickInner, actions.js) o dal bot nel suo turno
    // (attemptBotUseTurnPlayerFieldSpell, bot.js). Quel percorso non passa
    // da una Chain: è l'uso di un effetto continuo già scoperto, non
    // l'attivazione di una carta.
    function fondiConCancello(ctx) {
        const options = DuelEngine.getFusableExtraDeckMonsters(ctx.owner);
        if (options.length === 0) return;
        const owner = ctx.owner;
        const summon = (option) => { ctx.fusionSummon(owner, option.extraDeckIndex, option.materialLocations, { banishMaterials: true }); };
        if (options.length === 1 || !Decisioni.rispondeUnaPersona(owner)) {
            summon(options[0]);
            return;
        }
        Decisioni.chiedi({
            chi: owner,
            candidati: options.map((o) => o.card),
            titolo: '🔗 Cancello della Fusione: scegli il Mostro Fusione',
            testo: 'Hai i materiali per più di un Mostro Fusione: scegline uno da Evocare (i materiali vengono banditi).'
        }, (card) => {
            if (card === null) return;
            const match = options.find((o) => o.card.uid === card.uid);
            if (match) summon(match);
        });
    }
    CardEffects.register(887, {
        canActivateAsTurnPlayer(ctx) {
            return ctx.gameState.currentPlayer === ctx.owner
                && (ctx.gameState.phase === 'main1' || ctx.gameState.phase === 'main2')
                && DuelEngine.getFusableExtraDeckMonsters(ctx.owner).length > 0;
        },
        activateAsTurnPlayer(ctx) { fondiConCancello(ctx); },
        continuous: true,
        repeatableWhileContinuous: true,
        canActivate(ctx) {
            // La PRIMA attivazione (dalla mano: zone 'hand') stabilisce
            // semplicemente la Magia Campo sul Terreno, come ogni altra —
            // deve restare sempre legale a prescindere dai materiali
            // disponibili in quel momento (nessuna Fusione avviene subito,
            // solo dal prossimo click mentre è già scoperta). Il controllo
            // sui materiali vale solo per la RIATTIVAZIONE ripetuta (zone
            // 'fieldSpell', repeatableWhileContinuous) — stesso principio
            // di Offerta Suprema (id 559): un canActivate troppo severo
            // bloccherebbe anche il primo piazzamento.
            if (ctx.zone !== 'fieldSpell') return true;
            return DuelEngine.getFusableExtraDeckMonsters(ctx.owner).length > 0;
        },
        activate(ctx) { fondiConCancello(ctx); }
    });

    // 888 — Freed il Generale Senza Rivali (Mostro Effetto): nega gli
    // effetti Magia che la bersagliano — stesso schema reattivo di Gran
    // Scudo Gardna (id 115)/Mago Comando del Caos (id 738) via
    // onCardEffectTargetDeclare + ctx.cancel(). "...e se lo fai, distruggi
    // quella Magia": una Magia che resta sul Terreno (Continua o
    // Equipaggiamento) viene distrutta qui; una Normale/Rapida finisce al
    // Cimitero da sola a fine risoluzione, e distruggerla adesso, mentre si
    // sta ancora risolvendo, la manderebbe al Cimitero due volte.
    // La seconda abilità (sostituire la pescata con una ricerca in Draw
    // Phase) vive in game-flow.js (enterDrawPhaseInner), non qui — una
    // sostituzione della pescata è per forza a quel livello, stesso schema
    // già usato da skipDrawFor/pendingMaharaghiPeekFor. Lì è una scelta del
    // giocatore: pescare o cercare.
    CardEffects.register(888, {
        onCardEffectTargetDeclare(ctx) {
            if (!ctx.sourceCard || ctx.sourceType !== 'spell') return;
            ctx.cancel();
            const distrutta = destroyTargetingSpellIfItStays(ctx);
            ctx.log(`⚔️ Freed il Generale Senza Avversari nega l'effetto di ${ctx.sourceCard.name}${distrutta ? ' e la distrugge' : ''}!`);
        }
    });

    // 889 — Iniezione della Fata Giglio / Injection Fairy Lily (Mostro
    // Effetto): durante il calcolo dei danni, se combatte contro un mostro
    // avversario (Attacco o Difesa), può pagare 2000 LP per +3000 ATK
    // solo per quel calcolo, una volta per battaglia. Usa damageStepBonus
    // (duel-engine.js/getDamageStepBonus) — lo stesso hook già esistente
    // per Soldati Insetto del Cielo (id 311)/Soldato Cinetico (id 326) —
    // esteso in QUESTA sessione con un nuovo campo ctx.owner (chi
    // controlla la carta ADESSO), il pezzo che mancava per poter pagare i
    // Life Points giusti da dentro un hook che prima era solo un calcolo
    // puro. Vedi missingEffectNote in data/cards.json: la decisione di
    // pagare è automatica, non una vera scelta libera del giocatore.
    // `usedInjectionThisBattle` è un flag PER-ISTANZA (non per-definizione:
    // ogni copia della carta ha il proprio "già usato"), resettato a fine
    // Battle Phase (onBattlePhaseEnd, stesso hook già usato da Cavaliere
    // del Miraggio id 381) — la granularità più fine disponibile in questo
    // motore è "per Battle Phase", non "per singola battaglia": se questa
    // carta combattesse più di una volta nella STESSA Battle Phase (raro,
    // richiederebbe un effetto esterno che conceda un attacco extra),
    // l'effetto resterebbe disponibile solo alla prima di quelle battaglie
    // invece che ad ognuna — una sotto-stima accettabile, mai una carta
    // che si attiva più spesso del reale.
    // La decisione di pagare è del giocatore. Vive in
    // beforeDamageCalculation (runBeforeDamageCalculation, duel-engine.js)
    // e non più in damageStepBonus: quello è un calcolo che gira in mezzo a
    // resolveBattleDamage, dove una scelta non può esistere, mentre qui la
    // battaglia aspetta la risposta. Il bonus passa per
    // damageStepOnlyBonusFor, che il calcolo consuma subito dopo.
    // Il bot paga solo se altrimenti non vincerebbe lo scontro E i 3000 ATK
    // bastano a ribaltarlo — mai per pura "sicurezza".
    CardEffects.register(889, {
        beforeDamageCalculation(ctx) {
            if (!ctx.opponentCard) return; // "se combatte contro un mostro avversario" — mai per un attacco diretto
            if (ctx.card.usedInjectionThisBattle) return;
            const ownerLP = Tavolo.lp(ctx.owner);
            if (ownerLP <= 2000) return; // mai scendere a 0 o sotto pagando questo costo
            const mioSlot = ctx.field(ctx.owner)[ctx.slotIndex];
            // In Difesa i 3000 ATK non entrano nel calcolo: non c'è niente
            // per cui pagare.
            if (!mioSlot || mioSlot.position !== 'attack') return;
            const altroOwner = ctx.opponent;
            const altroSlot = ctx.field(altroOwner).find((s) => s && s.card === ctx.opponentCard);
            const altroInDifesa = !!(altroSlot && altroSlot.position === 'defense');
            const myAtk = DuelEngine.getEffectiveAtk(ctx.card);
            const oppValue = altroInDifesa ? DuelEngine.getEffectiveDef(ctx.opponentCard) : DuelEngine.getEffectiveAtk(ctx.opponentCard);
            const fine = attendiScelta(ctx);
            chooseOption(ctx, {
                title: `💉 ${ctx.card.name}`,
                text: `Paghi 2000 Life Points per +3000 ATK solo in questo calcolo dei danni? (${myAtk} contro ${oppValue} ${altroInDifesa ? 'DEF' : 'ATK'})`,
                options: [
                    { value: 'paga', label: 'Paga 2000 LP', icon: '💉' },
                    { value: 'no', label: 'Non pagare', icon: '✋' }
                ],
                pickForBot: () => (myAtk <= oppValue && myAtk + 3000 > oppValue ? 'paga' : 'no')
            }, (scelta) => {
                try {
                    if (scelta !== 'paga') return;
                    ctx.card.usedInjectionThisBattle = true;
                    // Non ctx.dealDamage: è un COSTO, non danno da un
                    // effetto, e chiamato dal ctx farebbe scattare chi
                    // reagisce al danno da effetto (Camera Oscura degli
                    // Incubi id 686).
                    DuelEngine.actions.dealDamage(ctx.owner, 2000);
                    gameState.damageStepOnlyBonusFor = gameState.damageStepOnlyBonusFor || {};
                    const prima = gameState.damageStepOnlyBonusFor[ctx.card.uid] || { atk: 0, def: 0 };
                    gameState.damageStepOnlyBonusFor[ctx.card.uid] = { atk: (prima.atk || 0) + 3000, def: prima.def || 0 };
                    ctx.log(`💉 ${ctx.card.name} paga 2000 LP: +3000 ATK solo per questo calcolo dei danni!`);
                    EventiDuello.emetti('life-points');
                } finally {
                    fine();
                }
            });
        },
        onBattlePhaseEnd(ctx) {
            ctx.card.usedInjectionThisBattle = false;
        }
    });

    // 890 — Necrovalley (Magia Terreno). Clausole:
    //  - +500 ATK/DEF ai Guardiani della Tomba (static, qui sotto);
    //  - niente bando dal Cimitero (ACTIONS.banishFromGraveyard);
    //  - "nega ogni effetto che sposterebbe una carta nel Cimitero altrove":
    //    in ACTIONS.specialSummon (fromZone 'graveyard') e in
    //    searchGraveyardWithChoice (card-effects.js), i due passaggi da cui
    //    passa la gran parte delle rianimazioni e dei recuperi;
    //  - "nega ogni effetto che cambia Tipo o Attributo nel Cimitero": nessuna
    //    carta del dataset fa una cosa simile, quindi non c'è niente da negare.
    // Il bonus ai Guardiani della Tomba è PROPEDEUTICO
    // (l'archetipo non esiste ancora in questo dataset — vedi Livello 5
    // in docs/audits/AUDIT_CARTE_PRIMA_SERIE.md): filtro per NOME (`includes('Guardiani
    // della Tomba')`, stesso stile già usato per "Occhi Rossi" in questo
    // file, dato che i Guardiani della Tomba reali non hanno una race
    // dedicata in questo motore), innocuo finché nessuna carta corrisponde.
    // Il blocco al bando dal Cimitero è la parte REALMENTE nuova: vedi
    // isNecrovalleyOnField()/ACTIONS.banishFromGraveyard (duel-engine.js) —
    // un nuovo choke-point condiviso a cui sono stati migrati TUTTI i
    // ~24 punti di card-effects.js che banivano dal Cimitero con uno
    // splice scritto a mano, invece di un controllo duplicato in ognuno.
    CardEffects.register(890, {
        continuous: true,
        activate(ctx) {
            ctx.log('🏺 Necrovalley si scopre sul Terreno: le carte nel Cimitero non possono più essere bandite!');
        },
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown) return;
                    if (!slot.card.name || !slot.card.name.includes('Guardiani della Tomba')) return;
                    const existing = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    gameState.atkDefBonus[slot.card.uid] = { atk: existing.atk + 500, def: existing.def + 500 };
                });
            });
        }
    });

    // 891 — Necropaura Oscura / Dark Necrofear (Mostro Effetto): due
    // abilità reali, entrambe implementate.
    // 1) Special Summon dalla mano bandendo 3 mostri Demone dal proprio
    //    Cimitero — stesso schema canSpecialSummonFromHand/
    //    paySpecialSummonCost già usato da Stregone del Caos (id
    //    740)/Drago Megaroccia (id 763)/ecc., ora tutti protetti da
    //    Necrovalley (id 890) tramite ctx.banishFromGraveyard.
    // 2) "Se distrutta nella propria Zona Mostro da una carta
    //    dell'avversario e mandata al Cimitero in QUESTO turno: alla End
    //    Phase, equipaggiala a 1 mostro scoperto avversario e prendine il
    //    controllo finché resta equipaggiata" — un mostro che agisce da
    //    Equip è un caso più unico che raro in tutto il gioco, nessun
    //    hook esistente lo copriva. Il vincolo tecnico chiave: una carta
    //    nel Cimitero non riceve MAI i normali trigger di fase (vedi
    //    enterEndPhase, game-flow.js — lì lo stesso principio vale già
    //    per Ultimo Turno id 341), quindi la condizione va armata SUBITO
    //    in onDestroy() (mentre la carta è ancora "sul campo" agli occhi
    //    del motore) in un flag di gameState (gameState.pendingNecrofearRevival,
    //    per uid) e controllata esplicitamente dentro enterEndPhase()
    //    stesso — stesso identico principio già usato lì per
    //    gameState.pendingUltimateTurnCheck, non un meccanismo nuovo
    //    inventato da zero. Il controllo del mostro (ctx.takeControl,
    //    `permanent:true` per non farlo tornare da solo a fine turno come
    //    Cambio di Cuore) si rilascia quando QUESTA carta lascia la zona
    //    Magia/Trappola (onSTDestroyed/onBanished/onReturnedToHandSelf,
    //    stesso pattern multi-hook già usato da Abbandonato id 416/
    //    releaseRelinquishedTarget). Se è il mostro EQUIPAGGIATO a lasciare
    //    il campo per conto proprio, questa carta finisce nel Cimitero alla
    //    prima ripulitura degli Equip senza bersaglio (recomputeStaticEffects,
    //    a ogni render, quindi di fatto subito): è la regola vera di ogni
    //    Carta Equipaggiamento, non una semplificazione — la nota che la
    //    dava per un limite è stata tolta.
    // ================================================================
    function releaseNecrofearControl(ctx) {
        const uid = ctx.card._necrofearControlledUid;
        if (!uid) return;
        ctx.card._necrofearControlledUid = null;
        const idx = ctx.field(ctx.owner).findIndex((s) => s && s.card.uid === uid);
        if (idx === -1) return; // il mostro controllato è già sparito per conto suo
        ctx.takeControl(ctx.opponent, ctx.owner, idx);
        ctx.log('🃏 Paura Oscura lascia il campo: il controllo del mostro torna al suo proprietario.');
    }
    CardEffects.register(891, {
        cannotNormalSummon: true,
        cannotBeSpecialSummoned: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.graveyard(ctx.owner).filter((c) => c.type === 'monster' && c.race === 'Demone').length >= 3;
        },
        getSpecialSummonBanishFilters() {
            const isDemon = (c) => c.type === 'monster' && c.race === 'Demone';
            return [isDemon, isDemon, isDemon];
        },
        paySpecialSummonCost(ctx) {
            const isDemon = (c) => c.type === 'monster' && c.race === 'Demone';
            return resolveSpecialSummonBanishCost(ctx, [isDemon, isDemon, isDemon], '👻 Paura Oscura bandisce 3 mostri Demone dal Cimitero per essere Evocata Specialmente!');
        },
        onDestroy(ctx) {
            const byOpponent = !!ctx.destroyedByOpponentCard || (ctx.destroyedByOwner && ctx.destroyedByOwner !== ctx.owner);
            if (!byOpponent) return;
            gameState.pendingNecrofearRevival = gameState.pendingNecrofearRevival || {};
            gameState.pendingNecrofearRevival[ctx.card.uid] = { forTurn: gameState.turn, owner: ctx.owner };
        },
        onSTDestroyed: releaseNecrofearControl,
        onBanished: releaseNecrofearControl,
        onReturnedToHandSelf: releaseNecrofearControl
    });

    // ================================================================
    // Archetipo Guardiani della Tomba / Gravekeeper's (id 892-900) —
    // propedeutico su Necrovalley (id 890), che già li boosta di
    // +500 ATK/DEF per nome (vedi il commento su Necrovalley qui sopra).
    // Tutte e 9 riusano meccanismi già esistenti nel motore, tranne
    // Sentinella (id 900, vedi il suo commento dedicato più sotto).
    // ================================================================

    // 892 — Maledizione dei Guardiani della Tomba (Gravekeeper's Curse):
    // "Se Evocata: infliggi 500 danni all'avversario" — nessuna
    // restrizione sul metodo (Normale/Speciale/Flip), quindi nessun
    // controllo su ctx.summonedVia.
    CardEffects.register(892, {
        onSummon(ctx) {
            ctx.dealDamage(ctx.opponent, 500);
            ctx.log('💀 Maledizione dei Guardiani della Tomba infligge 500 danni!');
        }
    });

    // 893 — Vassallo dei Guardiani della Tomba (Gravekeeper's Vassal):
    // "il danno da battaglia inflitto da questa carta è trattato come
    // danno da EFFETTO" — nuovo flag def.treatBattleDamageAsEffect,
    // consultato in fireOwnBattleDamageDealt (actions.js) per SALTARE le
    // reazioni specifiche al danno da BATTAGLIA (es. Goblin Ladro id 610)
    // quando è questa carta a infliggerlo. I Life Points scendono
    // comunque regolarmente — il flag tocca solo quelle reazioni.
    // Nessun activate() necessario: è un effetto passivo puro, come
    // Guardiano Kay'est (id 285).
    CardEffects.register(893, {
        treatBattleDamageAsEffect: true
    });

    // 894 — Lanciere dei Guardiani della Tomba (Gravekeeper's Spear
    // Soldier): "se attacca un mostro in Difesa, infliggi danno
    // perforante" — def.piercing, stesso flag fisso già usato da
    // Parshath il Cavaliere Alato (id 82), consultato direttamente in
    // resolveBattleDamage (actions.js). Nessun codice nuovo necessario.
    CardEffects.register(894, {
        piercing: true
    });

    // 895 — Assalitore dei Guardiani della Tomba (Gravekeeper's
    // Assailant): "quando dichiara un attacco, mentre Necrovalley è sul
    // Terreno: cambia la Posizione di Battaglia di 1 mostro scoperto
    // avversario" — onOwnAttackDeclare(ctx), l'auto-effetto
    // dell'ATTACCANTE su ON_ATTACK_DECLARE (duel-engine.js, esistente da
    // prima di questa sessione, es. Jirai Gumo id 316 — non serviva
    // alcun hook nuovo, a differenza di quanto ipotizzato per Spirit Ryu
    // id 630 nella tabella del backlog: da riverificare in futuro).
    // Il bersaglio lo sceglie il giocatore: la dichiarazione d'attacco
    // aspetta la scelta (attendiScelta, vedi callCardHandlerWaiting in
    // duel-engine.js) prima di aprire la finestra di risposta e calcolare i
    // danni. Il bot sceglie il mostro scoperto con l'ATK più alto.
    CardEffects.register(895, {
        onOwnAttackDeclare(ctx) {
            if (!DuelEngine.isNecrovalleyOnField()) return;
            const candidati = collectFieldTargets(ctx, { zone: 'monster', owner: 'opponent' });
            if (ctx.owner !== 'player') {
                candidati.sort((a, b) => DuelEngine.getEffectiveAtk(b.card) - DuelEngine.getEffectiveAtk(a.card));
            }
            chooseFieldCardTargetWaiting(ctx, candidati, {
                title: '⚔️ Assalitore dei Guardiani della Tomba',
                text: 'Scegli il mostro scoperto dell\'avversario di cui cambiare la Posizione di Battaglia.'
            }, (scelto) => {
                const decl = ctx.declareTarget(scelto.owner, scelto.index, { totalTargetCount: 1 });
                if (!decl.allowed) return;
                const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!finalSlot) return;
                finalSlot.position = finalSlot.position === 'attack' ? 'defense' : 'attack';
                ctx.log(`⚔️ Assalitore dei Guardiani della Tomba cambia la Posizione di Battaglia di ${finalSlot.card.name}!`);
            });
        }
    });

    // 896 — Artigliere dei Guardiani della Tomba (Gravekeeper's
    // Cannonholder): "Puoi Tributare 1 mostro Guardiani della Tomba,
    // eccetto questa carta; infliggi 700 danni" — Ignition dalla zona
    // Mostro (canActivate/activate zone='monster', "una volta a turno"
    // già garantito automaticamente da gameState.usedIgnitionThisTurn
    // per OGNI effetto Ignition di questo motore, nessun tracking
    // manuale necessario). Tributo scritto a mano (field[i]=null +
    // graveyard.push + notifySacrificedForTribute) stesso schema di
    // Metamorfosi (id 886).
    CardEffects.register(896, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.uid !== ctx.card.uid && s.card.name && s.card.name.includes('Guardiani della Tomba'));
        },
        activate(ctx) {
            const field = ctx.field(ctx.owner);
            const idx = field.findIndex((s) => s && !s.isFaceDown && s.card.uid !== ctx.card.uid && s.card.name && s.card.name.includes('Guardiani della Tomba'));
            if (idx === -1) return;
            const tributedCard = field[idx].card;
            field[idx] = null;
            ctx.graveyard(ctx.owner).push(tributedCard);
            DuelEngine.notifySacrificedForTribute(ctx.owner, tributedCard);
            ctx.dealDamage(ctx.opponent, 700);
            ctx.log(`💣 Artigliere dei Guardiani della Tomba tributa ${tributedCard.name}: infligge 700 danni!`);
        }
    });

    // 897 — Spia dei Guardiani della Tomba (Gravekeeper's Spy): "FLIP:
    // Evoca Specialmente 1 Guardiani della Tomba con 1500 ATK o meno dal
    // Deck" — stesso schema di ricerca dal Deck già usato da Angelo
    // Splendente (id 878), qui su onFlip invece che onDestroy.
    CardEffects.register(897, {
        onFlip(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.name && c.name.includes('Guardiani della Tomba') && c.attack <= 1500, {
                title: '🔎 Spia dei Guardiani della Tomba',
                text: 'Scegli quale Guardiani della Tomba (1500 ATK o meno) Special Summonare dal Deck.'
            }, (card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
                ctx.log(`🔎 Spia dei Guardiani della Tomba Special Summona ${card.name} dal Deck!`);
            });
        }
    });

    // 898 — Guardia dei Guardiani della Tomba (Gravekeeper's Guard):
    // "FLIP: 1 mostro avversario torna in mano" — bersaglio
    // auto-selezionato (ATK più alto, coperto conta 0 — stesso stile di
    // Libro della Luna id 875), ctx.returnMonsterToHand già esistente.
    CardEffects.register(898, {
        onFlip(ctx) {
            // Le coperte sono incluse (il testo dice "1 mostro che
            // l'avversario controlla", non "scoperto") e il picker le
            // disegna col retro: si sceglie la casella alla cieca, come al
            // tavolo vero.
            const candidati = collectFieldTargets(ctx, {
                zone: 'monster', owner: 'opponent', includiCoperte: true
            });
            if (candidati.length === 0) return;
            // Il bot prende sempre il primo della lista, quindi l'ordine
            // deve riprodurre l'euristica di prima: ATK effettivo piu'
            // alto, le coperte valgono 0, e a parita' vinceva l'ultima
            // casella (il vecchio confronto era `>=`, non `>`).
            const peso = (c) => (c.slot.isFaceDown ? 0 : DuelEngine.getEffectiveAtk(c.card));
            candidati.sort((a, b) => (peso(b) - peso(a)) || (b.index - a.index));
            chooseFieldCardTarget(ctx, candidati, {
                title: '🛡️ Guardia dei Guardiani della Tomba',
                text: 'Scegli il mostro avversario da rimandare in mano.'
            }, (scelto) => {
                const decl = ctx.declareTarget(scelto.owner, scelto.index, { totalTargetCount: 1 });
                if (!decl.allowed) return;
                const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!finalSlot) return;
                const name = finalSlot.isFaceDown ? 'una carta coperta' : finalSlot.card.name;
                ctx.returnMonsterToHand(decl.targetOwner, decl.targetIndex);
                ctx.log(`🛡️ Guardia dei Guardiani della Tomba rimanda ${name} in mano!`);
            });
        }
    });

    // 899 — Capo dei Guardiani della Tomba (Gravekeeper's Chief): due
    // clausole reali implementate — "Il tuo Cimitero non è influenzato
    // da Necrovalley" (isNecrovalleyProtectingGraveyard, duel-engine.js,
    // generalizzazione per-owner di ACTIONS.banishFromGraveyard, nuova
    // di questa carta) e "quando Evocata Tributo: Special Summon 1
    // Guardiani della Tomba dal Cimitero" (onSummon, ctx.summonedVia
    // === 'normal' — per una carta di Livello 5 un'Evocazione Normale è
    // SEMPRE un'Evocazione Tributo in questo motore, un solo Tributo
    // richiesto, quindi nessuna ambiguità da risolvere). SEMPLIFICAZIONE
    // (vedi missingEffectNote): "puoi controllare solo 1 copia scoperta"
    // non applicata (nessun controllo generico di unicità esiste in
    // questo motore); bersaglio da rianimare auto-selezionato.
    // AGGIORNAMENTO: l'unicità ora esiste, def.uniqueFaceUp, letto da
    // DuelEngine.isFaceUpDuplicateBlocked (Evocazione Normale del giocatore
    // e del bot, Special Summon). Resta fuori solo una seconda copia che si
    // GIRA scoperta da coperta con la prima già scoperta.
    CardEffects.register(899, {
        uniqueFaceUp: true,
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchGraveyardWithChoice(ctx, ctx.owner, (c) => c.type === 'monster' && c.name && c.name.includes('Guardiani della Tomba'), {
                title: '👑 Capo dei Guardiani della Tomba',
                text: 'Scegli quale Guardiani della Tomba Special Summonare dal Cimitero.'
            }, (target) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) { ctx.graveyard(ctx.owner).push(target); return; }
                ctx.specialSummon(ctx.owner, target, slotIndex, 'attack', 'graveyard');
                ctx.log(`👑 Capo dei Guardiani della Tomba Special Summona ${target.name} dal Cimitero!`);
            });
        }
    });

    // 900 — Sentinella dei Guardiani della Tomba (Gravekeeper's Watcher):
    // "quando il tuo avversario attiva una carta o un effetto che può far
    // scartare: manda questa carta dalla mano al Cimitero; nega
    // l'attivazione, e se lo fai, distruggila". Il momento giusto è proprio
    // un'attivazione avversaria, cioè la finestra di priorità che si apre
    // già (openActivationWindow): la carta vi entra dalla MANO grazie a
    // findHandQuickEffectCandidates (def.canRespondFromHand +
    // canActivateFromHand/activateFromHand). Mandarla al Cimitero è il
    // costo, pagato da consumeCandidateCard.
    // "Può far scartare" si riconosce dal testo della carta attivata: c'è
    // "scart..." in un EFFETTO, non solo come costo d'apertura ("Scarta 1
    // carta: ..." / "Paga ...;" in testa al testo non conta). È una lettura
    // del testo, non un dato strutturato: una carta scritta in modo insolito
    // può sfuggire o entrare per sbaglio.
    const faScartare = (card) => {
        if (!card || !card.effect) return false;
        const senzaCosto = card.effect.replace(/^\s*(scarta|paga)[^;:.]*[;:]/i, '');
        return /scart/i.test(senzaCosto);
    };
    CardEffects.register(900, {
        canRespondFromHand: true,
        canActivateFromHand(ctx) {
            const chain = ctx.gameState.chain;
            const top = chain && chain.links && chain.links[chain.links.length - 1];
            return !!(top && !top.negated && top.owner !== ctx.owner && faScartare(top.card));
        },
        activateFromHand(ctx) {
            const chain = ctx.gameState.chain;
            const top = chain && chain.links && chain.links[chain.links.length - 1];
            if (!top || !ctx.negateActivation()) return;
            // "...e se lo fai, distruggila": una Magia/Trappola negata finisce
            // al Cimitero già da resolveChain; un MOSTRO che ha attivato un
            // effetto va distrutto qui.
            if (top.card.type === 'monster') {
                const i = ctx.field(top.owner).findIndex((s) => s && s.card.uid === top.card.uid);
                if (i !== -1) ctx.destroyMonster(top.owner, i);
            }
            ctx.log(`🏺 Sentinella dei Guardiani della Tomba nega l'attivazione di ${top.card.name}!`);
        }
    });

    // 901 — La Fanciulla Indulgente / The Forgiving Maiden (Mostro
    // Effetto): "Tributa questa carta scoperta per far tornare in mano 1
    // tuo mostro distrutto in battaglia in questo turno" — Ignition dalla
    // zona Mostro, auto-tributo di se stessa (stesso schema tributo
    // scritto a mano di Metamorfosi id 886/Artigliere dei Guardiani della
    // Tomba id 896). Il bersaglio da far tornare in mano è una vera
    // scelta (searchGraveyardWithChoice), ristretta ai soli mostri
    // distrutti in battaglia IN QUESTO TURNO: lo dice
    // gameState.battleDestroyedThisTurnFor (popolato da fireOnDestroy in
    // actions.js, azzerato a ogni cambio turno, nato per Sentinella
    // Cremisi id 1063). Si confronta per uid: una copia con lo stesso nome
    // distrutta in un altro modo non conta. Materiale di Fusione per Santa
    // Giovanna (id 903).
    const distruttoInBattagliaQuestoTurno = (owner, card) => {
        const elenco = gameState.battleDestroyedThisTurnFor && gameState.battleDestroyedThisTurnFor[owner];
        return !!(elenco && elenco.some((c) => c && c.uid === card.uid));
    };
    CardEffects.register(901, {
        canActivate(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster' && c.uid !== ctx.card.uid && distruttoInBattagliaQuestoTurno(ctx.owner, c));
        },
        activate(ctx) {
            searchGraveyardWithChoice(ctx, ctx.owner, (c) => c.type === 'monster' && c.uid !== ctx.card.uid && distruttoInBattagliaQuestoTurno(ctx.owner, c), {
                title: '👼 La Vergine Clemente',
                text: 'Scegli quale mostro far tornare in mano dal Cimitero.'
            }, (target) => {
                const field = ctx.field(ctx.owner);
                const selfIndex = field.findIndex((s) => s && s.card.uid === ctx.card.uid);
                if (selfIndex === -1) { ctx.graveyard(ctx.owner).push(target); return; }
                field[selfIndex] = null;
                ctx.graveyard(ctx.owner).push(ctx.card);
                DuelEngine.notifySacrificedForTribute(ctx.owner, ctx.card);
                ctx.hand(ctx.owner).push(target);
                ctx.log(`👼 La Vergine Clemente si tributa: ${target.name} torna in mano dal Cimitero!`);
            });
        }
    });

    // 902 — Darklord Marie (Mostro Effetto, materiale di Fusione per
    // Santa Giovanna id 903): "Una volta per turno, durante la tua
    // Standby Phase, se questa carta è nel Cimitero: guadagni 200 LP".
    // Materiale di Fusione per Santa Giovanna (id 903) — questa carta
    // esisteva già nel 2003 (Labyrinth of Nightmare) col nome "Marie the
    // Fallen One", poi rinominata da Konami anni dopo integrandola
    // nell'archetipo Darklord: qui usato il nome/testo ATTUALI (stessa
    // fonte di verità, YGOPRODeck, di ogni altra carta di questo
    // dataset), non quelli storici del 2003.
    // Ora usa def.canTriggerFromGraveyard (duel-engine.js/firePhaseTrigger,
    // nato per Helpoemer id 1123) invece del più vecchio
    // canActivateFromGraveyardMainPhase/activateFromGraveyardMainPhase
    // (solo per la propria Main Phase 1): con l'handlerName 'onStandbyPhase'
    // scatta ora al momento GIUSTO del testo reale. Nessun
    // hasUsedOncePerTurn necessario: firePhaseTrigger('onStandbyPhase', ...)
    // viene chiamata esattamente una volta per turno da enterStandbyPhase()
    // (game-flow.js), già "una volta per turno" per costruzione.
    CardEffects.register(902, {
        canTriggerFromGraveyard: true,
        onStandbyPhase(ctx) {
            ctx.dealDamage(ctx.owner, -200);
            ctx.log('🖤 Signora Oscura Maria guadagna 200 LP dal Cimitero!');
        }
    });

    // 903 — Santa Giovanna / St. Joan (Mostro Fusione): vanilla,
    // nessun effetto proprio oltre le statistiche — vedi fusionMaterials.
    CardEffects.register(903, {
        fusionMaterials: [901, 902]
    });

})();
