/**
 * card-effects-6.js — Effetti delle carte, parte 6 di 8.
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

    const { chooseOption, chooseFieldCardTargetWaiting, attendiScelta, blockBanishFromField, isHarpieLadySupport, findEquipTarget, equipToChosenTarget, attachEquip, equippedTarget, searchZoneWithChoice, searchDeckWithChoice, searchGraveyardWithChoice, chooseFieldCardTarget, collectFieldTargets, offerHandDiscardChoice, resolveSpecialSummonBanishCost, attachUnionMonster, selfFlipToFaceDownDefense, findLevel7SpellcasterTarget, grantAttackAllEnemiesOncEach, victimChoosesDiscard } = window.CardEffectsShared;

    // Nomi dei mostri "Arpia" per il conteggio di Cucciolo di Drago delle Arpie (id 786). I nomi ufficiali non contengono
    // sempre la parola "Arpia" ("Sorelle Arpie", "Cucciolo di Drago delle Arpie") e due Magie/Trappole hanno "dell'Arpia" nel
    // nome: questa espressione ripete ESATTAMENTE le carte che il vecchio `includes('Arpia')` trovava prima di allineare i nomi
    // a Konami (la guarda tests/specs/guardrail-nomi-carte.spec.js).
    const NOME_ARPIA = /(?<!dell')Arpia|Sorelle Arpie|Cucciolo di Drago delle Arpie/;

    // ================================================================
    // 732 — Esplosione a Catena / Blast with Chain (Trappola Normale,
    // Equipaggiamento)
    // Equipaggia a 1 mostro scoperto che si controlla; +500 ATK. Se
    // questa carta viene distrutta da un effetto Carta mentre è
    // equipaggiata: scegli come bersaglio 1 carta sul Terreno;
    // distruggila — onSTDestroyed (nuovo hook, ctx.destroySpellTrap è
    // l'UNICO modo in cui una Magia/Trappola viene distrutta "da un
    // effetto" in questo motore: la pulizia automatica di un Equip il
    // cui bersaglio è appena diventato non valido non passa da lì, quindi
    // non fa scattare questo hook — esattamente la distinzione richiesta
    // dal testo reale). ctx.card.equippedToUid, ancora presente
    // sull'oggetto carta anche da distrutta, conferma che era davvero
    // equipaggiata al momento.
    // Il bersaglio lo sceglie il giocatore, mostri e retrocampo in
    // un'unica lista. L'ordine (tutti i mostri, poi tutte le Magie/
    // Trappole) è quello che la vecchia selezione automatica usava già,
    // ed è quello che il bot continua a seguire prendendo il primo.
    // ================================================================
    CardEffects.register(732, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, () => true) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx); },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 500, def: e.def };
        },
        onSTDestroyed(ctx) {
            if (!ctx.card.equippedToUid) return;
            const mostri = collectFieldTargets(ctx, { zone: 'monster', owner: 'both', includiCoperte: true });
            const retrocampo = collectFieldTargets(ctx, { zone: 'st', owner: 'both', includiCoperte: true });
            const candidati = [...mostri, ...retrocampo];
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '💥 Esplosione a Catena',
                text: 'Scegli quale carta sul Terreno distruggere.',
                dichiara: true
            }, (scelto) => {
                if (scelto.zone === 'st') {
                    const nome = scelto.card.name;
                    ctx.destroySpellTrap(scelto.owner, scelto.index);
                    ctx.log(`💥 Esplosione a Catena distrugge ${nome}!`);
                    return;
                }
                const finalSlot = ctx.field(scelto.owner)[scelto.index];
                if (!finalSlot) return;
                const name = finalSlot.card.name;
                ctx.destroyMonster(scelto.owner, scelto.index);
                ctx.log(`💥 Esplosione a Catena distrugge ${name}!`);
            });
        }
    });

    // ================================================================
    // 733 — Stregone Eradicatore Oscuro / Dark Eradicator Warlock
    // Special Summon dalla mano sacrificando 1 "Mago Nero" (id 2). Ogni
    // volta che una Magia Normale viene attivata: 1000 danni
    // all'avversario. Riusa onCardActivated/canActivateOnCardActivated,
    // già costruito per Biblioteca Magica Reale (id 615).
    // ================================================================
    CardEffects.register(733, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.id === 2);
        },
        paySpecialSummonCost(ctx) {
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && !slot.isFaceDown && slot.card.id === 2);
            if (index === -1) return false;
            ctx.graveyard(ctx.owner).push(field[index].card);
            field[index] = null;
            ctx.log('🧙 Stregone Oscuro Eradicatore sacrifica Mago Nero per essere Special Summonato!');
            return true;
        },
        canActivateOnCardActivated(ctx) {
            return ctx.activatedCard.type === 'spell' && ctx.activatedCard.subtype === 'normal';
        },
        onCardActivated(ctx) {
            ctx.dealDamage(ctx.opponent, 1000);
            ctx.log('🧙 Stregone Oscuro Eradicatore infligge 1000 danni!');
        }
    });

    // ================================================================
    // 734 — Bestia Mitica Cerbero / Mythical Beast Cerberus
    // Segnalino Magia ad ogni Magia attivata (nessun massimo); +500 ATK
    // per Segnalino. Alla fine della Battle Phase, se questa carta ha
    // combattuto: rimuove tutti i Segnalini Magia (onBattlePhaseEnd,
    // duel-engine.js/game-flow.js — nuovo aggancio generico).
    // ================================================================
    CardEffects.register(734, {
        // Letto da Mago Apprendista (id 737): "posiziona 1 Segnalino Magia
        // su 1 carta scoperta che può riceverne" — il valore è il nome del
        // campo su `card` dove va incrementato il contatore (diverso da
        // carta a carta per storia di sviluppo separata, vedi id 751).
        // `counters` e non più `spellCounters`: il badge col numero sulla
        // carta (renderFields in game-flow.js) legge SOLO `card.counters`,
        // come da convenzione in cima a card-effects.js. Con un campo dal
        // nome proprio i Segnalini c'erano ma non si vedevano.
        acceptsSpellCounters: 'counters',
        canActivateOnCardActivated(ctx) {
            return ctx.activatedCard.type === 'spell';
        },
        onCardActivated(ctx) {
            ctx.card.counters = (ctx.card.counters || 0) + 1;
            ctx.log(`🐺 Cerbero Mitica Bestia guadagna un Segnalino Magia (${ctx.card.counters})!`);
        },
        static(ctx) {
            const count = ctx.card.counters || 0;
            if (count === 0) return;
            const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk + count * 500, def: e.def };
        },
        onBattlePhaseEnd(ctx) {
            if (!ctx.card.battledThisBattlePhase) return;
            ctx.card.battledThisBattlePhase = false;
            if (!ctx.card.counters) return;
            ctx.card.counters = 0;
            ctx.log('🐺 Cerbero Mitica Bestia ha combattuto: rimuove tutti i Segnalini Magia!');
        }
    });

    // ================================================================
    // 736 — Abile Mago Oscuro / Skilled Dark Magician
    // Segnalino Magia ad ogni Magia attivata (max 3). Sacrificalo con 3
    // Segnalini per Special Summon 1 "Mago Nero" da mano/Deck/Cimitero.
    // ================================================================
    // Dove si trova un "Mago Nero" (id 2) da Special Summonare con Abile
    // Mago Oscuro: mano, Deck e Cimitero, ognuno solo se ne contiene uno.
    // Il Cimitero sparisce dall'elenco se Necrovalley ne vieta gli
    // spostamenti (vedi ctx.graveyardMoveNegated).
    function fontiMagoNero(ctx) {
        const fonti = [];
        const hand = ctx.hand(ctx.owner);
        if (hand.some((c) => c.id === 2)) fonti.push({ value: 'hand', label: 'Dalla mano', zona: hand });
        const deck = gameState[Tavolo.chiave(ctx.owner, 'Deck')];
        if (Array.isArray(deck) && deck.some((c) => c.id === 2)) fonti.push({ value: 'deck', label: 'Dal Deck', zona: deck });
        const grave = ctx.graveyard(ctx.owner);
        // Controllo SILENZIOSO (DuelEngine.isNecrovalleyProtectingGraveyard):
        // questa funzione la chiama anche canActivate, molte volte al
        // secondo, e ctx.graveyardMoveNegated scriverebbe ogni volta nel
        // registro. Il controllo che scrive si fa al momento di spostare.
        const necrovalley = DuelEngine.isNecrovalleyProtectingGraveyard && DuelEngine.isNecrovalleyProtectingGraveyard(ctx.owner);
        if (grave.some((c) => c.id === 2) && !necrovalley) {
            fonti.push({ value: 'graveyard', label: 'Dal Cimitero', zona: grave });
        }
        return fonti;
    }

    CardEffects.register(736, {
        // `counters` e non `spellCounters`: è il campo che il badge col
        // numero sulla carta legge (vedi la convenzione in cima a
        // card-effects.js). Prima i Segnalini si accumulavano ma restavano
        // invisibili. maxSpellCounters lo rispetta anche chi ne aggiunge da
        // fuori (Mago Apprendista, id 737).
        acceptsSpellCounters: 'counters',
        maxSpellCounters: 3,
        canActivateOnCardActivated(ctx) {
            return ctx.activatedCard.type === 'spell';
        },
        onCardActivated(ctx) {
            const current = ctx.card.counters || 0;
            if (current >= 3) return;
            ctx.card.counters = current + 1;
            ctx.log(`🧙 Abile Mago Nero guadagna un Segnalino Magia (${ctx.card.counters}/3)!`);
        },
        // Attivabile solo se c'è davvero un Mago Nero da qualche parte:
        // prima con 3 Segnalini risultava attivabile anche senza, e non
        // faceva nulla.
        canActivate(ctx) {
            return (ctx.card.counters || 0) >= 3 && fontiMagoNero(ctx).length > 0;
        },
        activate(ctx) {
            const fonti = fontiMagoNero(ctx);
            if (fonti.length === 0) return;
            // Da dove prenderlo lo decide il giocatore (i Maghi Neri sono
            // identici, conta solo la zona: alleggerire il Deck, tenere
            // quello in mano, recuperare quello nel Cimitero). Con una sola
            // zona possibile non si chiede niente. Il bot preferisce il Deck,
            // poi il Cimitero, e tiene per ultimo quello in mano.
            const procedi = (zonaScelta) => {
                const fonte = fonti.find((f) => f.value === zonaScelta);
                if (!fonte) return;
                if (fonte.value === 'graveyard' && ctx.graveyardMoveNegated(ctx.owner)) return;
                const from = fonte.zona.findIndex((c) => c.id === 2);
                if (from === -1) return;
                const [darkMagician] = fonte.zona.splice(from, 1);
                if (fonte.value === 'deck') gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = fonte.zona.length;
                // Il costo: questa carta va nel Cimitero, senza i suoi
                // Segnalini (non devono seguirla se un giorno torna in campo).
                const field = ctx.field(ctx.owner);
                const selfIndex = field.findIndex((s) => s && s.card.uid === ctx.card.uid);
                if (selfIndex !== -1) {
                    ctx.card.counters = 0;
                    ctx.graveyard(ctx.owner).push(ctx.card);
                    field[selfIndex] = null;
                }
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) { ctx.graveyard(ctx.owner).push(darkMagician); return; }
                ctx.specialSummon(ctx.owner, darkMagician, slotIndex, 'attack', fonte.value);
                ctx.log('🧙 Abile Mago Nero si sacrifica e Special Summona Mago Nero!');
                if (typeof updateUI === 'function') updateUI();
            };
            if (fonti.length === 1) { procedi(fonti[0].value); return; }
            chooseOption(ctx, {
                title: '🧙 Abile Mago Nero',
                text: 'Da dove vuoi Special Summonare "Mago Nero"?',
                options: fonti.map((f) => ({ value: f.value, label: f.label })),
                pickForBot: () => (fonti.find((f) => f.value === 'deck') || fonti.find((f) => f.value === 'graveyard') || fonti[0]).value
            }, (scelta) => procedi(scelta || fonti[0].value));
        }
    });

    // ================================================================
    // 737 — Mago Apprendista / Apprentice Magician (onDestroy —
    // distrutto in battaglia: Special Summon 1 mostro Incantatore di
    // Livello 2 o inferiore dal Deck, coperto in Posizione di Difesa).
    // CORREZIONE di fedeltà: aggiunto l'effetto primario mancante ("se
    // Evocata: posiziona 1 Segnalino Magia su 1 carta scoperta che può
    // riceverne"). "Può riceverne" ora è generico: def.acceptsSpellCounters
    // (stringa = nome del campo su `card` da incrementare), dichiarato da
    // ogni carta con un vero meccanismo a Segnalini Magia — Bestia Mitica
    // Cerbero (id 734), Abile Mago Oscuro (id 736, mancava anche dal
    // controllo precedente: hardcoded solo su 734/751) e Pietra del
    // Potere Nero Pece (id 751) — invece di un elenco di id scritto a
    // mano qui, che andrebbe aggiornato ogni volta che si aggiunge una
    // nuova carta a Segnalini Magia. SEMPLIFICAZIONE residua: sceglie da
    // sola il primo bersaglio idoneo trovato (priorità al proprio campo)
    // invece di un'interfaccia di selezione dedicata — stesso spirito di
    // altre scelte automatiche in questo file, non era il gap segnalato.
    CardEffects.register(737, {
        onSummon(ctx) {
            const candidates = [];
            [ctx.owner, ctx.opponent].forEach((o) => {
                ctx.field(o).forEach((slot) => {
                    if (!slot || slot.isFaceDown || slot.card.uid === ctx.card.uid) return;
                    const def = DuelEngine.getDefinition(slot.card.id);
                    if (!def || !def.acceptsSpellCounters) return;
                    // Una carta già al suo massimo (Abile Mago Oscuro: 3)
                    // non può riceverne altri: prima ne prendeva un quarto.
                    const giaPresenti = slot.card[def.acceptsSpellCounters] || 0;
                    if (def.maxSpellCounters && giaPresenti >= def.maxSpellCounters) return;
                    candidates.push({ card: slot.card, field: def.acceptsSpellCounters });
                });
            });
            if (candidates.length === 0) return;
            const target = candidates[0];
            target.card[target.field] = (target.card[target.field] || 0) + 1;
            ctx.log(`🧙 Mago Apprendista posiziona 1 Segnalino Magia su ${target.card.name}!`);
        },
        onDestroy(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.race === 'Incantatore' && (c.level || 0) <= 2, {
                title: '🧙 Mago Apprendista',
                text: 'Scegli quale mostro Incantatore di Livello 2 o inferiore Special Summonare coperto dal Deck.'
            }, (card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                ctx.specialSummon(ctx.owner, card, slotIndex, 'defense', 'deck');
                ctx.log(`🧙 Mago Apprendista Special Summona ${card.name} coperto dal Deck!`);
            });
        }
    });

    // ================================================================
    // 739 — Tsukuyomi (Mostro Spirito)
    // Quando Evocata Normalmente o girata scoperta: scegli come
    // bersaglio 1 mostro scoperto sul Terreno; cambialo in Posizione di
    // Difesa coperta. Alla End Phase dello stesso turno: ritorna in
    // mano. Stesso schema di Spirito della Polvere Oscura (id 659).
    // SEMPLIFICAZIONE: sceglie da sola il primo mostro scoperto trovato
    // (preferendo quello dell'avversario), invece di un'interfaccia di
    // selezione dedicata.
    // ================================================================
    CardEffects.register(739, {
        onSummon(ctx) {
            // ATTENZIONE: qui "ctx" è il contesto del trigger ON_NORMAL_SUMMON/
            // ON_SPECIAL_SUMMON, dove per convenzione (vedi il commento su
            // ctx.summonedCard in duel-engine.js) "ctx.card" NON è la carta
            // evocata — è riservato alle carte di RISPOSTA (es. Buco
            // Trappola). La carta evocata è ctx.summonedCard.
            if (ctx.summonedVia !== 'normal') return;
            tsukuyomiEffect(ctx, ctx.summonedCard);
        },
        onFlip(ctx) {
            tsukuyomiEffect(ctx, ctx.card);
        },
        onEndPhase(ctx) {
            if (ctx.card._returnToHandTurn !== gameState.turn) return;
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.returnMonsterToHand(ctx.owner, index);
            ctx.log('🌙 Tsukuyomi ritorna in mano!');
        }
    });
    function tsukuyomiEffect(ctx, selfCard) {
        selfCard._returnToHandTurn = gameState.turn;
        // Campo avversario in cima (il bot prende sempre il primo
        // candidato), ma il proprio resta in lista: girare coperto un
        // PROPRIO Mostro Flip per rigiocarne l'effetto e' la mossa piu'
        // nota di questa carta, e prima era irraggiungibile.
        const escludiSe = (card) => card.uid !== selfCard.uid;
        const candidates = collectFieldTargets(ctx, { zone: 'monster', owner: 'opponent', filter: escludiSe })
            .concat(collectFieldTargets(ctx, { zone: 'monster', owner: 'self', filter: escludiSe }));
        if (candidates.length === 0) return;
        chooseFieldCardTarget(ctx, candidates, {
            title: '🌙 Tsukuyomi',
            dichiara: true,
            text: 'Scegli il mostro da girare coperto in Posizione di Difesa.'
        }, (choice) => {
            const slot = ctx.field(choice.owner)[choice.index];
            if (!slot || slot.card.uid !== choice.card.uid) return;
            slot.isFaceDown = true;
            slot.position = 'defense';
            ctx.log(`🌙 Tsukuyomi cambia ${choice.card.name} in Posizione di Difesa coperta!`);
        });
    }

    // ================================================================
    // 740 — Stregone del Caos / Chaos Sorcerer
    // Special Summon dalla mano bandendo 1 mostro LUCE e 1 OSCURITÀ dal
    // Cimitero. Ignition, una volta per turno: bandisci 1 mostro
    // scoperto sul Terreno; questa carta non può attaccare in questo
    // turno.
    // ================================================================
    CardEffects.register(740, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            const grave = ctx.graveyard(ctx.owner);
            return grave.some((c) => c.type === 'monster' && c.attribute === 'LUCE') && grave.some((c) => c.type === 'monster' && c.attribute === 'OSCURITÀ');
        },
        getSpecialSummonBanishFilters() {
            return [(c) => c.type === 'monster' && c.attribute === 'LUCE', (c) => c.type === 'monster' && c.attribute === 'OSCURITÀ'];
        },
        paySpecialSummonCost(ctx) {
            return resolveSpecialSummonBanishCost(ctx, [
                (c) => c.type === 'monster' && c.attribute === 'LUCE',
                (c) => c.type === 'monster' && c.attribute === 'OSCURITÀ'
            ], '🔮 Stregone del Chaos bandisce 1 mostro LUCE e 1 OSCURITÀ per essere Special Summonato!');
        },
        canActivate(ctx) {
            if (gameState.usedIgnitionThisTurn && gameState.usedIgnitionThisTurn[ctx.card.uid]) return false;
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown && s.card.uid !== ctx.card.uid));
        },
        activate(ctx) {
            // Il campo avversario resta in cima alla lista: il bot prende
            // sempre il primo candidato, e bandire un proprio mostro
            // sarebbe una mossa senza senso.
            const ammesso = (card) => card.uid !== ctx.card.uid
                && !(DuelEngine.getDefinition(card.id) || {}).cannotBeBanishedWhileOnField;
            const candidates = collectFieldTargets(ctx, { zone: 'monster', owner: 'opponent', filter: ammesso })
                .concat(collectFieldTargets(ctx, { zone: 'monster', owner: 'self', filter: ammesso }));
            if (candidates.length === 0) return;
            chooseFieldCardTarget(ctx, candidates, {
                title: '🔮 Stregone del Chaos',
                dichiara: true,
                text: 'Scegli quale mostro scoperto bandire.'
            }, (choice) => {
                // Lo slot si ricontrolla ORA e non alla raccolta dei
                // candidati: fra l'apertura del picker e il click il mostro
                // scelto puo' essere sparito dal Terreno.
                const slot = ctx.field(choice.owner)[choice.index];
                if (!slot || slot.card.uid !== choice.card.uid) return;
                ctx.field(choice.owner)[choice.index] = null;
                ctx.banish(choice.owner, choice.card);
                ctx.card._cannotAttackTurn = gameState.turn;
                ctx.log(`🔮 Stregone del Chaos bandisce ${choice.card.name}!`);
            });
        },
        static(ctx) {
            if (ctx.card._cannotAttackTurn === gameState.turn) gameState.cannotAttackUids[ctx.card.uid] = true;
        }
    });

    // ================================================================
    // 741 — Maga Bianca Pikeru / White Magician Pikeru
    // Durante la propria Standby Phase: +400 LP per ogni proprio mostro
    // sul Terreno.
    // ================================================================
    CardEffects.register(741, {
        onStandbyPhase(ctx) {
            const count = ctx.field(ctx.owner).filter((s) => s).length;
            if (count === 0) return;
            ctx.dealDamage(ctx.owner, -400 * count);
            ctx.log(`🧚 Maga Bianca Pikeru aumenta i Life Points di ${400 * count} punti!`);
        }
    });

    // ================================================================
    // 742 — Mago dell'Esplosione / Blast Magician
    // Segnalino Magia ad ogni Magia attivata (nessun massimo). Ignition:
    // rimuovi N Segnalini; distruggi 1 mostro scoperto con ATK<=N*700.
    // ================================================================
    CardEffects.register(742, {
        // Segnalini su `counters`, il campo che il badge sulla carta legge
        // (prima `spellCounters`, invisibili). Può riceverne da Mago
        // Apprendista (id 737), senza massimo.
        acceptsSpellCounters: 'counters',
        canActivateOnCardActivated(ctx) {
            return ctx.activatedCard.type === 'spell';
        },
        onCardActivated(ctx) {
            ctx.card.counters = (ctx.card.counters || 0) + 1;
            ctx.log(`🎆 Mago del Sangue guadagna un Segnalino Magia (${ctx.card.counters})!`);
        },
        canActivate(ctx) {
            const count = ctx.card.counters || 0;
            if (count === 0) return false;
            const maxAtk = count * 700;
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown && DuelEngine.getEffectiveAtk(s.card) <= maxAtk));
        },
        // Il bersaglio lo sceglie il giocatore fra i mostri scoperti con ATK
        // alla portata dei Segnalini, e si rimuovono solo quelli che servono
        // ("un numero qualsiasi": togliere più del necessario non ha senso e
        // brucerebbe i Segnalini per il prossimo uso). Prima sceglieva da
        // solo il mostro con l'ATK più alto, anche uno PROPRIO, e azzerava
        // tutti i Segnalini. Il bot prende l'avversario più forte.
        activate(ctx) {
            const count = ctx.card.counters || 0;
            if (count === 0) return;
            const atk = (c) => DuelEngine.getEffectiveAtk(c.card);
            const allaPortata = (card) => DuelEngine.getEffectiveAtk(card) <= count * 700;
            const candidati = collectFieldTargets(ctx, { zone: 'monster', owner: 'opponent', filter: allaPortata }).sort((a, b) => atk(b) - atk(a))
                .concat(collectFieldTargets(ctx, { zone: 'monster', owner: 'self', filter: allaPortata }).sort((a, b) => atk(b) - atk(a)));
            if (candidati.length === 0) return;
            const fine = attendiScelta(ctx);
            chooseFieldCardTarget(ctx, candidati, {
                title: '🎆 Mago dell\'Esplosione',
                text: `Hai ${count} Segnalini Magia (fino a ${count * 700} ATK). Scegli il mostro da distruggere: si rimuovono solo i Segnalini necessari.`,
                dichiara: true,
                onNegato: fine,
                onCancel: fine
            }, (scelto) => {
                try {
                    const servono = Math.max(1, Math.ceil(atk(scelto) / 700));
                    ctx.card.counters = Math.max(0, count - servono);
                    const finalName = scelto.card.name;
                    ctx.destroyMonster(scelto.owner, scelto.index);
                    ctx.log(`🎆 Mago del Sangue rimuove ${servono} Segnalini e distrugge ${finalName}!`);
                } finally {
                    fine();
                }
            });
        }
    });

    // ================================================================
    // 743 — Maga Oscura Curran / Ebon Magician Curran
    // Durante la propria Standby Phase: 300 danni all'avversario per
    // ogni suo mostro sul Terreno.
    // ================================================================
    CardEffects.register(743, {
        onStandbyPhase(ctx) {
            const count = ctx.field(ctx.opponent).filter((s) => s).length;
            if (count === 0) return;
            ctx.dealDamage(ctx.opponent, 300 * count);
            ctx.log(`🧙 Curran Maga d'Ebano infligge ${300 * count} danni!`);
        }
    });

    // ================================================================
    // 744 — Mago a Fuoco Rapido / Rapid-Fire Magician
    // Infliggi 400 danni ogni volta che attivi una Magia Normale.
    // ================================================================
    CardEffects.register(744, {
        canActivateOnCardActivated(ctx) {
            return ctx.activatedCard.type === 'spell' && ctx.activatedCard.subtype === 'normal' && ctx.activatedOwner === ctx.owner;
        },
        onCardActivated(ctx) {
            ctx.dealDamage(ctx.opponent, 400);
            ctx.log('🔥 Mago Fuoco-Rapido infligge 400 danni!');
        }
    });

    // ================================================================
    // 745 — Esplosione Magica / Magical Explosion (Trappola Normale)
    // Correzione di fedeltà: era stata implementata come "Magical Blast"
    // (Magia, 200 danni per mostro Incantatore controllato) — una carta
    // reale DIVERSA, confusa con questa per il nome simile. La vera
    // "Magical Explosion": Trappola Normale, attivabile solo con la mano
    // vuota, 200 danni per ogni Magia nel proprio Cimitero — l'effetto è
    // già completo così, nessuna clausola aggiuntiva nel testo reale. Vedi
    // anche data/cards.json (type/subtype corretti da spell/normal a
    // trap/normal).
    // ================================================================
    CardEffects.register(745, {
        canActivate(ctx) {
            return ctx.hand(ctx.owner).length === 0;
        },
        activate(ctx) {
            const count = ctx.graveyard(ctx.owner).filter((c) => c.type === 'spell').length;
            ctx.dealDamage(ctx.opponent, 200 * count);
            ctx.log(`💥 Esplosione Magica infligge ${200 * count} danni!`);
        }
    });

    // ================================================================
    // 746 — Potere del Mago / Mage Power (Equipaggiamento, dinamico)
    // Il mostro equipaggiato guadagna 500 ATK/DEF per ogni Magia/
    // Trappola controllata dal suo proprietario (ricalcolato ad ogni
    // render, come Megamorfosi id 631).
    // ================================================================
    CardEffects.register(746, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, () => true) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx); },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            const count = ctx.stField(ctx.owner).filter((s) => s).length;
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + count * 500, def: e.def + count * 500 };
        }
    });

    // ================================================================
    // 748 — Attacco Magico Oscuro / Dark Magic Attack (Magia Normale)
    // Se controlli "Mago Nero" (id 2): distruggi tutte le Magie/Trappole
    // controllate dall'avversario.
    // ================================================================
    CardEffects.register(748, {
        canActivate(ctx) {
            const hasDarkMagician = ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.id === 2);
            if (!hasDarkMagician) return false;
            return ctx.stField(ctx.opponent).some((s) => s);
        },
        activate(ctx) {
            let count = 0;
            // batchToken condiviso, stesso motivo di Piumino delle Arpie
            // (id 291) qui sopra — vedi il commento su destroySpellTrap in
            // duel-engine.js.
            const batchToken = {};
            ctx.stField(ctx.opponent).forEach((slot, index) => {
                if (!slot) return;
                ctx.destroySpellTrap(ctx.opponent, index, batchToken);
                count++;
            });
            ctx.log(`🧙 Attacco Mago Nero distrugge ${count} Magia/Trappola dell'avversario!`);
        }
    });

    // ================================================================
    // 749 — Assorbimento Magico / Spell Absorption (Magia Continua)
    // Ogni volta che una Magia viene attivata (da chiunque): guadagna
    // 500 LP.
    // ================================================================
    CardEffects.register(749, {
        continuous: true,
        activate(ctx) {
            ctx.log('📖 Assorbimento Magico è ora sul Terreno!');
        },
        canActivateOnCardActivated(ctx) {
            return ctx.activatedCard.type === 'spell';
        },
        onCardActivated(ctx) {
            ctx.dealDamage(ctx.owner, -500);
            ctx.log('📖 Assorbimento Magico guadagna 500 Life Points!');
        }
    });

    // ================================================================
    // 750 — Gabbia d'Acciaio dell'Incubo / Nightmare's Steelcage (Magia
    // Normale) — resta 2 turni, nessun mostro può attaccare mentre è
    // scoperta. Stesso schema a conto alla rovescia di Spada Rivelatrice
    // (id 8)/Spade della Luce Occultante (id 730), ma blocca ENTRAMBI i
    // lati invece di uno solo.
    // ================================================================
    CardEffects.register(750, {
        continuous: true,
        durationTurns: 2,
        activate(ctx) {
            const slot = ctx.stField(ctx.owner)[ctx.index];
            if (slot) slot.turnsLeft = 2;
            ctx.log("🔒 Gabbia d'Acciaio dell'Incubo attivata: nessun mostro può attaccare per 2 turni!");
        },
        static(ctx) {
            gameState.cannotAttackFor.player = true;
            gameState.cannotAttackFor.bot = true;
        }
    });

    // ================================================================
    // 751 — Pietra del Potere Nero Pece / Pitch-Black Power Stone
    // Si attiva posizionando 3 Segnalini Magia su di sé (ctx.card.counters,
    // stesso campo generico già usato da Guardia di Carte id139/Distruttore
    // il Guerriero Magico id131). Una volta per turno, durante il proprio
    // turno: sposta 1 Segnalino Magia da sé a un'altra carta scoperta sul
    // Terreno; quando l'ultimo viene rimosso, si autodistrugge.
    // def.repeatableWhileContinuous (vedi Offerta Suprema id 559): la
    // stessa activate() gestisce sia la prima attivazione (posiziona i 3
    // Segnalini) sia ogni uso successivo ripetibile (ctx.card.counters
    // === null distingue le due), con un proprio contatore once-per-turn
    // via ctx.hasUsedOncePerTurn (il blocco generico usedIgnitionThisTurn
    // in duel-engine.js copre solo la zona 'monster', non 'st').
    // Su quale carta spostare il Segnalino lo sceglie il giocatore
    // (mostro o Magia/Trappola scoperti, di ENTRAMBI i giocatori, esclusa
    // se stessa). Resta fuori solo la Magia Terreno, zona non esposta
    // pubblicamente da questo motore alle registrazioni carta.
    // ================================================================
    CardEffects.register(751, {
        continuous: true,
        repeatableWhileContinuous: true,
        acceptsSpellCounters: 'counters',
        canActivate(ctx) {
            if (ctx.card.counters == null) return true;
            if (ctx.card.counters <= 0) return false;
            if (ctx.hasUsedOncePerTurn(`751:${ctx.card.uid}`)) return false;
            const others = [
                ...ctx.field(ctx.owner), ...ctx.field(ctx.opponent),
                ...ctx.stField(ctx.owner), ...ctx.stField(ctx.opponent)
            ];
            return others.some((slot) => slot && !slot.isFaceDown && slot.card.uid !== ctx.card.uid);
        },
        activate(ctx) {
            if (ctx.card.counters == null) {
                ctx.card.counters = 3;
                ctx.log('🔮 Pietra del Potere Nero-Pece si attiva con 3 Segnalini Magia!');
                return;
            }
            ctx.markUsedOncePerTurn(`751:${ctx.card.uid}`);
            const candidati = collectFieldTargets(ctx, {
                zone: 'both',
                owner: 'both',
                filter: (card) => card.uid !== ctx.card.uid
            });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🔮 Pietra del Potere Nero-Pece',
                text: 'Scegli su quale carta scoperta spostare un Segnalino Magia.',
                // Un mostro scelto passa dal checkpoint di targeting; una
                // Magia/Trappola no (il checkpoint copre solo i mostri).
                dichiara: true
            }, (scelto) => {
                ctx.card.counters -= 1;
                scelto.card.counters = (scelto.card.counters || 0) + 1;
                ctx.log(`🔮 Pietra del Potere Nero-Pece sposta un Segnalino Magia su ${scelto.card.name}!`);
                // L'autodistruzione va controllata QUI, dentro la
                // callback: il Segnalino se n'è andato solo adesso, e
                // prima della scelta il conteggio era ancora quello di
                // partenza.
                if (ctx.card.counters <= 0) {
                    ctx.destroySpellTrap(ctx.owner, ctx.index);
                    ctx.log('💥 Pietra del Potere Nero-Pece si distrugge: nessun Segnalino Magia rimasto!');
                }
            });
        }
    });

    // ================================================================
    // 752 — Ira Divina / Divine Wrath (Trappola Contatore)
    // Quando un effetto di un Mostro viene attivato: scarta 1 carta;
    // annulla l'attivazione e distruggi quel mostro. Stesso schema di
    // risposta via Chain di Interferenza Magica (id 361)/Scudo Magico
    // Tipo-8 (id 689), ma per effetti Ignition di mostri.
    // ================================================================
    CardEffects.register(752, {
        canActivate(ctx) {
            if (ctx.hand(ctx.owner).length === 0) return false;
            const chain = ctx.gameState.chain;
            return !!(chain && chain.links && chain.links.length > 0 && chain.links[chain.links.length - 1].card.type === 'monster');
        },
        activate(ctx) {
            const hand = ctx.hand(ctx.owner);
            if (hand.length === 0) return;
            const chain = ctx.gameState.chain;
            const link = chain.links[chain.links.length - 1];
            const monsterCard = link.card;
            const monsterOwner = link.owner;
            const discarded = ctx.discardChosenFromHand(ctx.owner, 0);
            if (ctx.negateActivation()) {
                const field = ctx.field(monsterOwner);
                const index = field.findIndex((s) => s && s.card.uid === monsterCard.uid);
                if (index !== -1) ctx.destroyMonster(monsterOwner, index);
                ctx.log(`⚡ Ira Divina scarta ${discarded.name}, annulla e distrugge ${monsterCard.name}!`);
            } else {
                ctx.log(`⚡ Ira Divina scarta ${discarded.name}, ma non c'era più nulla da annullare.`);
            }
        }
    });

    // ================================================================
    // Effetto Ignition condiviso "gira te stessa coperta in Posizione di
    // Difesa" (Grande Spirito id 754, Sfinge Guardiana id 756, Sentinella
    // Golem id 759, Cannoni Intercettori Moai id 762, Statua Guardiana
    // id 764, Verme Medusa id 765) — una volta per turno (gestito già in
    // automatico da gameState.usedIgnitionThisTurn, controllato dal
    // canActivate generico in duel-engine.js prima ancora di chiamare
    // questo). Il proprio effetto Flip (onFlip) NON riparte qui (girarsi
    // da soli coperti non è una Flip Summon) — riparte da sé più avanti
    // se l'avversario attacca questa carta e la rivela in battaglia
    // (meccanismo già esistente in resolveBattleDamage, actions.js).
    // Nessun ctx.slot per una Ignition da campo mostri (solo ctx.index):
    // vedi il commento su canActivate/ctx in duel-engine.js.
    // ================================================================
    // selfFlipToFaceDownDefense vive ora fra gli helper condivisi, in cima a
    // js/engine/card-effects.js: serve a gruppi di carte lontani fra loro,
    // quindi non può stare dentro un singolo file-parte.

    function canSelfFlip(ctx) {
        const slot = ctx.field(ctx.owner)[ctx.index];
        return !!slot && !slot.isFaceDown;
    }

    // ================================================================
    // 753 — Exxod, Maestro della Guardia
    // Special Summon dalla mano sacrificando 1 mostro il cui nome
    // contiene "Sfinge" (Sfinge Guardiana id 756, Hieracosfinge id 760,
    // Criosfinge id 761). Ogni volta che un mostro TERRA viene Flip
    // Summonato mentre questa carta resta scoperta: 1000 danni
    // (ctx.summonedVia === 'flip' qui sotto esclude correttamente
    // Evocazione Normale/Special — nota precedente obsoleta rimossa).
    // BUG REALE trovato scrivendo il test di questa sessione (non
    // segnalato dall'utente, scoperto per caso testando id 753 dopo
    // averlo toccato per il fix "vera scelta"): il confronto
    // `.includes('Sfinge')` era case-SENSITIVE, quindi riconosceva SOLO
    // "Sfinge Guardiana" (S maiuscola) — "Hieracosfinge"/"Criosfinge"
    // hanno la "s" minuscola nel nome composto e non venivano MAI
    // riconosciute come Sacrificio valido, nonostante il commento
    // originale le elencasse esplicitamente tra i bersagli. Corretto con
    // isSphinxNamed(card), confronto case-insensitive.
    // ================================================================
    function isSphinxNamed(card) {
        return card.name.toLowerCase().includes('sfinge');
    }
    CardEffects.register(753, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && isSphinxNamed(slot.card));
        },
        // Riusa il meccanismo PREESISTENTE nato per Teschio Evocato Toon
        // (id 486, vedi actions.js) invece del nuovo
        // getSpecialSummonTributeFilters/offerSpecialSummonTributeChoice
        // (pensato per un conteggio > 1, es. id 123/606): qui il tributo è
        // singolo ma con un requisito specifico (nome contiene "Sfinge"),
        // esattamente il caso già coperto da questo hook da prima di
        // questa sessione — se in campo ci sono PIÙ Sfingi diverse, ora è
        // il giocatore a scegliere quale, non più sempre la prima trovata.
        getSpecialSummonSacrificeCandidates(ctx) {
            return ctx.field(ctx.owner)
                .map((slot, index) => (slot && !slot.isFaceDown && isSphinxNamed(slot.card) ? { index: index, card: slot.card } : null))
                .filter(Boolean);
        },
        paySpecialSummonCost(ctx) {
            const field = ctx.field(ctx.owner);
            const pendingUid = gameState.pendingSpecialSummonSacrificeUid;
            gameState.pendingSpecialSummonSacrificeUid = null;
            let index = pendingUid ? field.findIndex((slot) => slot && slot.card.uid === pendingUid) : -1;
            if (index === -1) index = field.findIndex((slot) => slot && !slot.isFaceDown && isSphinxNamed(slot.card));
            if (index === -1) return false;
            ctx.graveyard(ctx.owner).push(field[index].card);
            field[index] = null;
            ctx.log('🗿 Exxod sacrifica una Sfinge per essere Special Summonato!');
            return true;
        },
        // CORREZIONE di fedeltà + bug reale: ctx.summonedCard non esisteva
        // affatto prima (il vecchio codice avrebbe lanciato un'eccezione
        // al primo Normal/Flip Summon con Exxod in campo) — ora passato
        // da reactToAnyNormalOrFlipSummon (duel-engine.js). Inoltre il
        // vero Exxod scatta SOLO su Flip Summon, non su Evocazione
        // Normale (ctx.summonedVia === 'flip').
        onAnyNormalOrFlipSummon(ctx) {
            if (ctx.summonedVia !== 'flip' || !ctx.summonedCard || ctx.summonedCard.attribute !== 'TERRA') return;
            ctx.dealDamage(ctx.opponent, 1000);
            ctx.log('🗿 Exxod infligge 1000 danni per un Flip Summon TERRA!');
        }
    });

    // ================================================================
    // 754 — Grande Spirito / Great Spirit
    // Ignition condivisa: gira se stessa coperta (id 754/756/759/762/
    // 764/765). Quando Girata Scoperta (Flip Summon): scambia ATK/DEF
    // originali di 1 mostro TERRA scoperto sul Terreno fino a fine turno.
    // ================================================================
    CardEffects.register(754, {
        canActivate: canSelfFlip,
        activate: selfFlipToFaceDownDefense,
        onFlip(ctx) {
            const candidates = [];
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => { if (slot && !slot.isFaceDown && slot.card.attribute === 'TERRA') candidates.push({ owner, index, card: slot.card }); });
            });
            if (candidates.length === 0) return;
            const choice = candidates[0];
            const oldAtk = choice.card.attack, oldDef = choice.card.defense;
            choice.card.attack = oldDef;
            choice.card.defense = oldAtk;
            ctx.log(`🌀 Grande Spirito scambia ATK/DEF di ${choice.card.name}!`);
        }
    });

    // ================================================================
    // 755 — Maharaghi (Mostro Spirito)
    // Ritorna in mano alla End Phase del turno in cui viene Evocata
    // Normalmente o girata scoperta. Stesso schema di Tsukuyomi (id 739).
    // "Guarda la prima carta del tuo Deck alla tua prossima Draw Phase e
    // rimettila in cima o in fondo": effetto RITARDATO che sopravvive al
    // ritorno in mano di questa carta stessa — gameState.pendingMaharaghiPeekFor
    // (per owner), consultato da enterDrawPhase (game-flow.js) prima
    // della pesca vera e propria.
    // ================================================================
    CardEffects.register(755, {
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            ctx.card._returnToHandTurn = gameState.turn;
            gameState.pendingMaharaghiPeekFor = gameState.pendingMaharaghiPeekFor || {};
            gameState.pendingMaharaghiPeekFor[ctx.owner] = true;
        },
        onFlip(ctx) {
            ctx.card._returnToHandTurn = gameState.turn;
            gameState.pendingMaharaghiPeekFor = gameState.pendingMaharaghiPeekFor || {};
            gameState.pendingMaharaghiPeekFor[ctx.owner] = true;
        },
        onEndPhase(ctx) {
            if (ctx.card._returnToHandTurn !== gameState.turn) return;
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.returnMonsterToHand(ctx.owner, index);
            ctx.log('👤 Maharaghi ritorna in mano!');
        }
    });

    // ================================================================
    // 756 — Sfinge Guardiana / Guardian Sphinx — Ignition condivisa
    // (vedi id 754). Quando Girata Scoperta: rimetti in mano TUTTI i
    // mostri controllati dall'avversario.
    // ================================================================
    CardEffects.register(756, {
        canActivate: canSelfFlip,
        activate: selfFlipToFaceDownDefense,
        onFlip(ctx) {
            let count = 0;
            ctx.field(ctx.opponent).forEach((slot, index) => {
                if (!slot) return;
                ctx.returnMonsterToHand(ctx.opponent, index);
                count++;
            });
            ctx.log(`🗿 Sfinge Guardiana rimette in mano ${count} mostr${count === 1 ? 'o' : 'i'} dell'avversario!`);
        }
    });

    // ================================================================
    // 757 — Gigantes
    // Special Summon dalla mano bandendo 1 mostro TERRA dal Cimitero.
    // Se distrutta in battaglia: distruggi tutte le Magie/Trappole sul
    // Terreno.
    // ================================================================
    CardEffects.register(757, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster' && c.attribute === 'TERRA');
        },
        getSpecialSummonBanishFilters() {
            return [(c) => c.type === 'monster' && c.attribute === 'TERRA'];
        },
        paySpecialSummonCost(ctx) {
            return resolveSpecialSummonBanishCost(ctx, [(c) => c.type === 'monster' && c.attribute === 'TERRA'], '🗿 Gigantes bandisce 1 mostro TERRA per essere Special Summonato!');
        },
        onDestroy(ctx) {
            let count = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.stField(owner).forEach((slot, index) => {
                    if (!slot) return;
                    ctx.graveyard(owner).push(slot.card);
                    ctx.stField(owner)[index] = null;
                    count++;
                });
            });
            if (count > 0) ctx.log(`🗿 Gigantes distrugge ${count} Magia/Trappola alla propria distruzione!`);
        }
    });

    // ================================================================
    // 759 — Sentinella Golem / Golem Sentry — Ignition condivisa (vedi
    // id 754). Quando Girata Scoperta: rimanda 1 mostro dell'avversario
    // in mano.
    // ================================================================
    CardEffects.register(759, {
        canActivate: canSelfFlip,
        activate: selfFlipToFaceDownDefense,
        onFlip(ctx) {
            const candidati = collectFieldTargets(ctx, { zone: 'monster', owner: 'opponent', includiCoperte: true });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🗿 Golem Guardiano',
                text: 'Scegli quale mostro avversario rimandare in mano.'
            }, (scelto) => {
                const decl = ctx.declareTarget(scelto.owner, scelto.index, { totalTargetCount: 1 });
                if (!decl.allowed) return;
                const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!finalSlot) return;
                const cardName = finalSlot.card.name;
                ctx.returnMonsterToHand(decl.targetOwner, decl.targetIndex);
                ctx.log(`🗿 Golem Guardiano rimanda ${cardName} in mano!`);
            });
        }
    });

    // ================================================================
    // 760 — Hieracosfinge / Hieracosphinx (statico)
    // Finché resta scoperta sul Terreno: l'avversario non può scegliere
    // un mostro coperto in Posizione di Difesa che si controlla come
    // bersaglio per un attacco (gameState.cannotBeAttackTargetUids).
    // ================================================================
    CardEffects.register(760, {
        static(ctx) {
            ctx.field(ctx.owner).forEach((slot) => {
                if (!slot || !slot.isFaceDown) return;
                gameState.cannotBeAttackTargetUids[slot.card.uid] = true;
            });
        }
    });

    // ================================================================
    // 761 — Criosfinge / Cryosphinx
    // Quando un mostro ritorna dal Terreno alla mano del proprietario:
    // quel proprietario sceglie e manda 1 carta dalla sua mano al
    // Cimitero. Nuovo aggancio onAnyMonsterReturnedToHand
    // (ACTIONS.returnMonsterToHand, duel-engine.js) — reagisce da
    // ENTRAMBI i lati del Terreno (non solo il proprio controllore),
    // dato che il testo reale non è legato a CHI controlla Criosfinge.
    // "Quel proprietario SCEGLIE": victimChoosesDiscard (card-effects.js),
    // la scelta è di chi riprende il mostro in mano, non di chi controlla
    // Criosfinge — picker obbligatorio per il giocatore, la carta che vale
    // meno per il bot, e in Multiplayer sceglie il client della vittima.
    // Copre solo i "torna in mano dal Terreno" già migrati a usare
    // ACTIONS.returnMonsterToHand (Tsukuyomi, Maharaghi, Spirito della
    // Polvere Oscura, Cavaliere Missile, Malvagia Bestia Verme, Prova
    // del Viandante, Sfinge Guardiana id 756, Sentinella Golem id 759,
    // Statua Guardiana id 764, Colpo di Coda id 811, Dispositivo di
    // Evacuazione Forzata id 671), non ogni altro "torna in mano" (dal
    // Terreno di un MOSTRO) di questo file.
    // ================================================================
    CardEffects.register(761, {
        onAnyMonsterReturnedToHand(ctx) {
            victimChoosesDiscard(ctx, ctx.returnedOwner, {
                title: '❄️ Criosfinge',
                text: 'Un tuo mostro è tornato in mano: scegli 1 carta della tua mano da mandare al Cimitero.'
            }, (discarded) => {
                ctx.log(`❄️ Criosfinge: ${ctx.returnedOwner === 'player' ? 'scarti' : 'il bot scarta'} ${discarded.name}!`);
            });
        }
    });

    // ================================================================
    // 762 — Cannoni Intercettori Moai / Moai Interceptor Cannons —
    // Ignition condivisa soltanto (vedi id 754), nessun effetto Flip
    // proprio.
    // ================================================================
    CardEffects.register(762, {
        canActivate: canSelfFlip,
        activate: selfFlipToFaceDownDefense
    });

    // ================================================================
    // 763 — Drago Megaroccia / Megarock Dragon
    // Special Summon dalla mano bandendo mostri Tipo Roccia dal
    // Cimitero (quanti se ne vuole); ATK/DEF originali diventano pari al
    // numero bandito x 700.
    // SEMPLIFICAZIONE: bandisce sempre TUTTI i mostri Roccia disponibili
    // nel Cimitero, invece di lasciar scegliere quanti.
    // ================================================================
    CardEffects.register(763, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster' && c.race === 'Roccia');
        },
        paySpecialSummonCost(ctx) {
            const grave = ctx.graveyard(ctx.owner);
            let banished = 0;
            for (let i = grave.length - 1; i >= 0; i--) {
                if (grave[i].type === 'monster' && grave[i].race === 'Roccia' && ctx.banishFromGraveyard(ctx.owner, grave[i])) {
                    banished++;
                }
            }
            if (banished === 0) return false;
            ctx.card.attack = banished * 700;
            ctx.card.defense = banished * 700;
            ctx.log(`🐉 Drago Megaroccia bandisce ${banished} mostr${banished === 1 ? 'o' : 'i'} Roccia: ATK/DEF diventano ${banished * 700}!`);
            return true;
        }
    });

    // ================================================================
    // 764 — Statua Guardiana / Guardian Statue — Ignition condivisa
    // (vedi id 754). Quando Girata Scoperta: rimanda 1 mostro
    // dell'avversario in mano. Stesso identico effetto di Sentinella
    // Golem (id 759).
    // ================================================================
    CardEffects.register(764, {
        canActivate: canSelfFlip,
        activate: selfFlipToFaceDownDefense,
        onFlip(ctx) {
            const field = ctx.field(ctx.opponent);
            const index = field.findIndex((s) => s);
            if (index === -1) return;
            const decl = ctx.declareTarget(ctx.opponent, index, { totalTargetCount: 1 });
            if (!decl.allowed) return;
            const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
            if (!finalSlot) return;
            const cardName = finalSlot.card.name;
            ctx.returnMonsterToHand(decl.targetOwner, decl.targetIndex);
            ctx.log(`🗿 Statua Guardiana rimanda ${cardName} in mano!`);
        }
    });

    // ================================================================
    // 765 — Verme Medusa / Medusa Worm — Ignition condivisa (vedi
    // id 754). Quando Girata Scoperta: distruggi 1 mostro dell'avversario.
    // ================================================================
    CardEffects.register(765, {
        canActivate: canSelfFlip,
        activate: selfFlipToFaceDownDefense,
        onFlip(ctx) {
            const field = ctx.field(ctx.opponent);
            const index = field.findIndex((s) => s && !s.isFaceDown);
            const fallbackIndex = index !== -1 ? index : field.findIndex((s) => s);
            if (fallbackIndex === -1) return;
            const decl = ctx.declareTarget(ctx.opponent, fallbackIndex, { totalTargetCount: 1 });
            if (!decl.allowed) return;
            const targetSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
            if (!targetSlot) return;
            const card = targetSlot.card;
            ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
            ctx.log(`🐍 Verme Medusa distrugge ${card.name}!`);
        }
    });

    // ================================================================
    // 766 — Falena della Sabbia / Sand Moth (onDestroy)
    // Quando questa carta coperta in Posizione di Difesa viene distrutta
    // e mandata al Cimitero, TRANNE che in battaglia: scambia l'ATK e la
    // DEF originali di questa carta e Special Summonala — ctx.destroyedByOpponentCard
    // esclude la battaglia (valorizzato solo lì), ctx.wasFaceDown/
    // wasPosition (nuovi campi in ACTIONS.destroyMonster, duel-engine.js)
    // confermano che era coperta in Difesa al momento della distruzione.
    // ================================================================
    CardEffects.register(766, {
        onDestroy(ctx) {
            if (ctx.destroyedByOpponentCard) return;
            if (!ctx.wasFaceDown || ctx.wasPosition !== 'defense') return;
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const grave = ctx.graveyard(ctx.owner);
            const index = grave.findIndex((c) => c.uid === ctx.card.uid);
            if (index === -1) return;
            const card = grave.splice(index, 1)[0];
            const originalAtk = card.attack;
            card.attack = card.defense;
            card.defense = originalAtk;
            ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'graveyard');
            ctx.log('🦋 Falena di Sabbia torna in campo con ATK e DEF scambiati!');
        }
    });

    // ================================================================
    // 767 — Canyon (Magia Terreno)
    // Se un mostro Tipo Roccia in Posizione di Difesa viene attaccato da
    // un mostro con ATK inferiore alla sua DEF: raddoppia il danno da
    // battaglia subito dall'attaccante. Nessun handler qui: il danno da
    // raddoppiare esiste solo nel ramo "l'attacco rimbalza" di
    // resolveBattleDamage (actions.js), quindi il controllo su Canyon è
    // fatto direttamente lì — vedi il commento lì per i dettagli.
    // ================================================================
    CardEffects.register(767, {
        continuous: true,
        activate(ctx) {
            ctx.log('🏜️ Canyon attivato!');
        }
    });

    // ================================================================
    // 768 — Maglio Magico / Magical Mallet (Magia Normale)
    // Rimescola un NUMERO QUALSIASI (scelto dal giocatore) di carte dalla
    // mano nel Deck e pesca altrettante — selezione ripetuta con
    // DuelEngineUI.openCardListPicker (una carta alla volta, chiudere il
    // box = fine selezione), stesso componente già usato altrove per
    // scegliere tra più candidati, qui riusato in un ciclo per un
    // "quanti vuoi" invece di un singolo bersaglio. Il bot (nessuna vera
    // IA dedicata per questa scelta di nicchia) rimescola sempre l'intera
    // mano, come prima.
    // ================================================================
    function pickMagicalMalletCards(ctx, hand, selected) {
        const remaining = hand.filter((c) => !selected.includes(c));
        const finish = () => {
            const count = selected.length;
            if (count === 0) { ctx.log('🔨 Maglio Magico: nessuna carta scelta, nulla da rimescolare.'); return; }
            selected.forEach((c) => { const idx = hand.indexOf(c); if (idx !== -1) hand.splice(idx, 1); });
            if (!ctx.shuffleIntoDeck(ctx.owner, selected)) { hand.push(...selected); return; }
            ctx.drawCards(ctx.owner, count);
            ctx.log(`🔨 Maglio Magico rimescola ${count} cart${count === 1 ? 'a' : 'e'} nel Deck e ne pesca altrettante!`);
        };
        if (remaining.length === 0) { finish(); return; }
        Decisioni.chiedi({
            chi: ctx.owner,
            candidati: remaining,
            titolo: '🔨 Maglio Magico',
            testo: `Scegli 1 carta da rimescolare nel Deck, o chiudi per fermarti qui (${selected.length} scelt${selected.length === 1 ? 'a' : 'e'} finora).`,
            annullabile: true
        }, (card) => {
            if (card === null) {
                finish();
                return;
            }
            selected.push(card); pickMagicalMalletCards(ctx, hand, selected);
        });
    }
    CardEffects.register(768, {
        canActivate(ctx) {
            return ctx.hand(ctx.owner).length > 0;
        },
        activate(ctx) {
            const hand = ctx.hand(ctx.owner);
            if (Decisioni.rispondeUnaPersona(ctx.owner)) {
                pickMagicalMalletCards(ctx, hand, []);
                return;
            }
            const count = hand.length;
            const returned = hand.splice(0, hand.length);
            if (!ctx.shuffleIntoDeck(ctx.owner, returned)) {
                hand.push(...returned);
                return;
            }
            ctx.drawCards(ctx.owner, count);
            ctx.log(`🔨 Maglio Magico rimescola ${count} cart${count === 1 ? 'a' : 'e'} nel Deck e ne pesca altrettante!`);
        }
    });

    // ================================================================
    // 769 — Ombre Mutevoli / Shifting Shadows
    // Una volta per turno, pagando 300 LP: riordina i mostri coperti in
    // Posizione di Difesa nelle proprie Zone Mostro principali (solo tra
    // le zone che già li contengono, non spostati in zone vuote — regola
    // vera confermata via YGOPRODeck/Yugipedia), poi rimessi coperti in
    // Posizione di Difesa. Riusa def.repeatableWhileContinuous (introdotto
    // per Offerta Suprema id 559): nessuna distinzione tra prima
    // attivazione e usi successivi, l'effetto è identico ogni volta.
    // SEMPLIFICAZIONE dichiarata: lo scopo reale della carta è confondere
    // un AVVERSARIO UMANO su quale carta coperta sia quale (bluff) — in
    // questo videogioco il contenuto delle carte coperte non è comunque
    // mai mostrato all'avversario (bot o giocatore), quindi il
    // rimescolamento non produce alcun vantaggio strategico osservabile,
    // esattamente come nella carta reale contro un avversario che non le
    // sta osservando: l'azione meccanica (costo + permutazione) resta
    // comunque applicata fedelmente, solo scarica di conseguenze pratiche.
    // ================================================================
    CardEffects.register(769, {
        continuous: true,
        repeatableWhileContinuous: true,
        canActivate(ctx) {
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            if (gameState[lpKey] < 300) return false;
            if (ctx.hasUsedOncePerTurn(`769:${ctx.card.uid}`)) return false;
            const eligible = ctx.field(ctx.owner).filter((slot) => slot && slot.isFaceDown && slot.position === 'defense');
            return eligible.length >= 2;
        },
        activate(ctx) {
            ctx.markUsedOncePerTurn(`769:${ctx.card.uid}`);
            const lpKey = Tavolo.chiave(ctx.owner, 'LP');
            gameState[lpKey] -= 300;
            const field = ctx.field(ctx.owner);
            const indices = field.map((slot, i) => (slot && slot.isFaceDown && slot.position === 'defense') ? i : -1).filter((i) => i !== -1);
            const shuffledCards = indices.map((i) => field[i].card);
            for (let i = shuffledCards.length - 1; i > 0; i--) {
                const j = Math.floor(ctx.random() * (i + 1));
                [shuffledCards[i], shuffledCards[j]] = [shuffledCards[j], shuffledCards[i]];
            }
            indices.forEach((idx, k) => { field[idx].card = shuffledCards[k]; });
            ctx.log('🌑 Ombre Danzanti riordina le carte coperte in Posizione di Difesa!');
        }
    });

    // ================================================================
    // 770 — Drenaggio Magico / Magic Drain (Trappola Contatore)
    // Quando l'avversario attiva una Magia: annulla e distruggila, A
    // MENO che l'avversario non scarti 1 Carta Magia dalla propria mano
    // per salvare la propria attivazione. Stesso schema di risposta via
    // Chain di Interferenza Magica (id 361), che invece non ha MAI questa
    // via di fuga (Drenaggio Magico sì, Interferenza Magica no: due
    // Trappole Contatore diverse, non la stessa semplificazione). Scelta
    // dell'avversario risolta in automatico (scarta la prima Magia
    // trovata in mano, se ne ha una) invece di un'interfaccia interattiva
    // dedicata — nessun precedente in questo file di un popup che chiede
    // una decisione a ctx.opponent nel bel mezzo della risoluzione di una
    // Chain, e introdurne uno qui rischierebbe una regressione sul
    // resolveChain condiviso da OGNI altra carta, per un guadagno
    // marginale (l'esito osservabile — annullata o no — è comunque
    // corretto e dipende dal vero stato della mano avversaria).
    // ================================================================
    CardEffects.register(770, {
        canActivate(ctx) {
            const chain = ctx.gameState.chain;
            return !!(chain && chain.links && chain.links.length > 0 && chain.links[chain.links.length - 1].card.type === 'spell' && chain.links[chain.links.length - 1].owner === ctx.opponent);
        },
        activate(ctx) {
            const oppHand = ctx.hand(ctx.opponent);
            const spellIndex = oppHand.findIndex((c) => c.type === 'spell');
            if (spellIndex !== -1) {
                const [discarded] = oppHand.splice(spellIndex, 1);
                ctx.graveyard(ctx.opponent).push(discarded);
                ctx.log(`💧 ${ctx.opponent === 'player' ? 'Scarti' : 'Il bot scarta'} ${discarded.name} per annullare l'effetto di Risucchio Magico!`);
                return;
            }
            if (ctx.negateActivation()) {
                ctx.log('💧 Risucchio Magico annulla e distrugge la Magia avversaria!');
            } else {
                ctx.log('💧 Risucchio Magico non trova più nulla da annullare.');
            }
        }
    });

    // ================================================================
    // 771 — Prova del Viandante / Ordeal of a Traveler (Trappola
    // Continua)
    // Quando un mostro dell'avversario dichiara un attacco: scegli 1
    // carta a caso dalla propria mano, l'avversario "dichiara" un tipo a
    // caso; se sbaglia, rimanda l'attaccante in mano.
    // SEMPLIFICAZIONE: la "dichiarazione" dell'avversario è simulata
    // scegliendo un tipo a caso tra Mostro/Magia/Trappola (nessuna vera
    // interfaccia di scelta per l'avversario in questo motore).
    // ================================================================
    CardEffects.register(771, {
        onAttackDeclare(ctx) {
            const hand = ctx.hand(ctx.owner);
            if (hand.length === 0) return;
            const revealed = ctx.randomPick(hand);
            const types = ['monster', 'spell', 'trap'];
            const guess = ctx.randomPick(types);
            if (guess !== revealed.type) {
                const field = ctx.field(ctx.opponent);
                const attackerSlot = field[ctx.attackerIndex];
                ctx.cancelAttack();
                if (attackerSlot) {
                    const attackerCard = attackerSlot.card;
                    ctx.returnMonsterToHand(ctx.opponent, ctx.attackerIndex);
                    ctx.log(`🎲 Prova del Viaggiatore: l'avversario sbaglia e ${attackerCard.name} torna in mano!`);
                }
            } else {
                ctx.log("🎲 Prova del Viaggiatore: l'avversario indovina, l'attacco prosegue.");
            }
        }
    });

    // ================================================================
    // 773 — Sparatore Sonico / Sonic Shooter (statico)
    // Se la zona Magia/Trappola dell'avversario è vuota: questa carta può
    // attaccare direttamente (gameState.directAttackAllowedUids).
    // SEMPLIFICAZIONE: manca "il danno da attacco diretto è pari all'ATK
    // ORIGINALE" (invece che effettivo) — nessun impatto pratico senza
    // buff ATK attivi su questa carta.
    // ================================================================
    CardEffects.register(773, {
        static(ctx) {
            const oppSTEmpty = ctx.stField(ctx.opponent).every((s) => s === null);
            if (oppSTEmpty) {
                gameState.directAttackAllowedUids[ctx.card.uid] = true;
            }
        }
    });

    // ================================================================
    // 772 — Simorgh, Uccello della Divinità
    // Durante la End Phase di ciascun giocatore, mentre resta scoperta
    // sul Terreno: ciascun giocatore subisce 1000 danni, ridotti di 500
    // per ogni propria Magia/Trappola. "Ciascun giocatore" vuol dire in
    // OGNI End Phase, anche quella dell'avversario: onEndPhase scatta solo
    // nella propria, onOpponentEndPhase (firePhaseTrigger) copre l'altra.
    // "Tutti i Sacrifici devono essere mostri VENTO" è applicato dove si
    // scelgono i Tributi (continueNormalTributeFlow/handleTributeSelectClick
    // in actions.js per il giocatore, chooseSummon nei due livelli IA).
    // "Non può essere Special Summonata": def.cannotSpecialSummon, letto da
    // ACTIONS.specialSummon.
    // ================================================================
    const danniDiSimorgh = (ctx) => {
        Tavolo.ordine().forEach((owner) => {
            const stCount = ctx.stField(owner).filter((s) => s).length;
            const damage = Math.max(0, 1000 - stCount * 500);
            if (damage > 0) ctx.dealDamage(owner, damage);
        });
        ctx.log('🦅 Simorgh infligge danno ad entrambi i giocatori!');
    };
    CardEffects.register(772, {
        cannotSpecialSummon: true,
        onEndPhase(ctx) { danniDiSimorgh(ctx); },
        onOpponentEndPhase(ctx) { danniDiSimorgh(ctx); }
    });

    // ================================================================
    // 776 — Guerriero di Ardesia / Slate Warrior (effetto FLIP +
    // onDestroyedInBattle)
    // FLIP: guadagna 500 ATK/DEF in modo permanente. Se questa carta
    // viene distrutta in battaglia: il mostro che l'ha distrutta perde
    // 500 ATK/DEF (onDestroyedInBattle, actions.js).
    // ================================================================
    CardEffects.register(776, {
        onFlip(ctx) {
            ctx.card.attack = (ctx.card.attack || 0) + 500;
            ctx.card.defense = (ctx.card.defense || 0) + 500;
            ctx.log('🗿 Guerriero di Ardesia guadagna 500 ATK/DEF!');
        },
        onDestroyedInBattle(ctx) {
            ctx.destroyerCard.attack = Math.max(0, (ctx.destroyerCard.attack || 0) - 500);
            ctx.destroyerCard.defense = Math.max(0, (ctx.destroyerCard.defense || 0) - 500);
            ctx.log(`🗿 Guerriero di Ardesia: ${ctx.destroyerCard.name} perde 500 ATK/DEF per averla distrutta in battaglia!`);
        }
    });

    // ================================================================
    // 777 — Mosca Lama / Bladefly (statico, entrambi i lati)
    // Tutti i mostri VENTO sul Terreno: +500 ATK. Tutti i mostri TERRA
    // sul Terreno: -400 ATK. Stesso schema di Piccola Chimera (id 676).
    // ================================================================
    CardEffects.register(777, {
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown) return;
                    const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    if (slot.card.attribute === 'VENTO') gameState.atkDefBonus[slot.card.uid] = { atk: e.atk + 500, def: e.def };
                    else if (slot.card.attribute === 'TERRA') gameState.atkDefBonus[slot.card.uid] = { atk: e.atk - 400, def: e.def };
                });
            });
        }
    });

    // ================================================================
    // 778 — Faccia di Uccello / Birdface (onDestroy — distrutto in
    // battaglia)
    // Quando distrutta in battaglia: aggiungi 1 carta il cui nome
    // contiene "Lady Arpia" dal Deck alla mano.
    // ================================================================
    CardEffects.register(778, {
        onDestroy(ctx) {
            searchDeckWithChoice(ctx, (c) => isHarpieLadySupport(c), {
                title: '🐦 Faccia da Uccello',
                text: 'Scegli quale carta "Lady Arpia" aggiungere alla mano dal Deck.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`🐦 Faccia da Uccello aggiunge ${card.name} alla mano dal Deck!`);
            });
        }
    });

    // ================================================================
    // 779 — Silpheed (Special Summon dalla mano bandendo 1 VENTO dal
    // Cimitero)
    // Se distrutta in battaglia: l'avversario scarta 1 carta a caso.
    // ================================================================
    CardEffects.register(779, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster' && c.attribute === 'VENTO');
        },
        getSpecialSummonBanishFilters() {
            return [(c) => c.type === 'monster' && c.attribute === 'VENTO'];
        },
        paySpecialSummonCost(ctx) {
            return resolveSpecialSummonBanishCost(ctx, [(c) => c.type === 'monster' && c.attribute === 'VENTO'], '🌪️ Silpheed bandisce 1 mostro VENTO per essere Special Summonata!');
        },
        onDestroy(ctx) {
            const discarded = ctx.discardRandomFromHand(ctx.opponent);
            if (!discarded) return;
            ctx.log(`🌪️ Silpheed forza l'avversario a scartare ${discarded.name}!`);
        }
    });

    // ================================================================
    // 780 — Ninja Signora Yae / Lady Ninja Yae (Ignition)
    // Scarta 1 mostro VENTO dalla mano: rimetti in mano tutte le Magie/
    // Trappole controllate dall'avversario.
    // ================================================================
    CardEffects.register(780, {
        canActivate(ctx) {
            return ctx.hand(ctx.owner).some((c) => c.type === 'monster' && c.attribute === 'VENTO');
        },
        activate(ctx) {
            offerHandDiscardChoice(ctx, {
                filter: (c) => c.type === 'monster' && c.attribute === 'VENTO',
                title: '🥷 Ninja Signora Yae',
                text: 'Scegli quale mostro VENTO scartare dalla mano.'
            }, (discarded) => {
                let count = 0;
                ctx.stField(ctx.opponent).forEach((slot, i) => {
                    if (!slot) return;
                    ctx.hand(ctx.opponent).push(slot.card);
                    ctx.stField(ctx.opponent)[i] = null;
                    count++;
                });
                ctx.log(`🥷 Ninja Signora Yae scarta ${discarded.name} e rimette in mano ${count} Magia/Trappola dell'avversario!`);
            });
        }
    });

    // ================================================================
    // 781 — Roc dalla Valle della Foschia / Roc from the Valley of Haze
    // Quando questa carta viene mandata DIRETTAMENTE dalla tua mano al
    // Cimitero: aggiungila al Deck e mescolalo — onSentToGraveyardFromHand,
    // scatenato da ctx.discardRandomFromHand (scarto casuale),
    // ctx.discardChosenFromHand (scarto SCELTO, duel-engine.js), dallo scarto
    // obbligatorio per il limite di 6 carte in mano a fine turno
    // (performHandDiscard in actions.js, autoDiscardHandExcess in
    // game-flow.js) e da OGNI carta che scarta come costo del proprio
    // effetto (22 siti migrati da uno splice/push manuale a
    // ctx.discardChosenFromHand — inclusi i 3 casi in cui un indice nel
    // Cimitero era calcolato PRIMA dello scarto: Genesi del Vampiro id 656,
    // Scavo Fossile id 823, ora ricalcolato DOPO per identità/uid, così un
    // eventuale rimescolamento di questa carta nel Deck non lascia un
    // indice invalido) — nessuna restrizione "solo se causato
    // dall'avversario" nel testo reale, a differenza di Disperazione
    // dall'Oscurità (id 662).
    // ================================================================
    CardEffects.register(781, {
        onSentToGraveyardFromHand(ctx) {
            const grave = ctx.graveyard(ctx.owner);
            const index = grave.findIndex((c) => c.uid === ctx.card.uid);
            if (index === -1) return;
            if (ctx.graveyardMoveNegated(ctx.owner)) return;
            const [card] = grave.splice(index, 1);
            if (!ctx.shuffleIntoDeck(ctx.owner, [card])) {
                grave.push(card);
                return;
            }
            ctx.log(`🦅 ${card.name} torna nel Deck, che viene rimescolato!`);
        }
    });

    // ================================================================
    // 782 — Lady Arpia 1 / Harpie Lady 1 (statico, entrambi i lati)
    // Tutti i mostri VENTO sul Terreno: +300 ATK.
    // ================================================================
    CardEffects.register(782, {
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown || slot.card.attribute !== 'VENTO') return;
                    const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    gameState.atkDefBonus[slot.card.uid] = { atk: e.atk + 300, def: e.def };
                });
            });
        }
    });

    // ================================================================
    // 784 — Lady Arpia 3 / Harpie Lady 3
    // Un mostro dell'avversario che combatte contro questa carta non
    // può dichiarare un attacco per le prossime 2 fasi di turno
    // dell'avversario.
    // SEMPLIFICAZIONE: "2 fasi di turno" approssimato come "il prossimo
    // turno dell'avversario" (un blocco per turno, non per singola fase).
    // ================================================================
    CardEffects.register(784, {
        onAttackDeclare(ctx) {
            const attackerSlot = ctx.field(ctx.opponent)[ctx.attackerIndex];
            if (attackerSlot) attackerSlot.card._lockedUntilTurn = gameState.turn + 2;
        },
        static(ctx) {
            if (ctx.card._lockedUntilTurn && gameState.turn < ctx.card._lockedUntilTurn) {
                gameState.cannotAttackUids[ctx.card.uid] = true;
            }
        }
    });

    // ================================================================
    // 785 — Joe l'Uomo Uccello Veloce / Swift Birdman Joe
    // Se Evocata Tributo: rimetti in mano ai proprietari tutte le Magie/
    // Trappole sul Terreno, di entrambi i giocatori.
    // SEMPLIFICAZIONE: non verifica che il sacrificio fosse un mostro
    // VENTO (nessun controllo sul TIPO di sacrificio in questo motore).
    // ================================================================
    CardEffects.register(785, {
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            let count = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.stField(owner).forEach((slot, index) => {
                    if (!slot) return;
                    ctx.hand(owner).push(slot.card);
                    ctx.stField(owner)[index] = null;
                    count++;
                });
            });
            ctx.log(`🦅 Joe Veloce Uomo Alato rimette in mano ${count} Magia/Trappola!`);
        }
    });

    // ================================================================
    // 786 — Cucciolo di Drago dell'Arpia / Harpie's Pet Baby Dragon.
    // Tutte e tre le clausole sono implementate: "1+ Arpie" (le altre
    // "Arpia" controllate, eccetto questa carta, non possono essere
    // scelte come bersaglio per un attacco), "2+ Arpie" (raddoppia
    // ATK/DEF) e "3+ Arpie" (Ignition, distruggi 1 carta dell'avversario).
    // ================================================================
    CardEffects.register(786, {
        static(ctx) {
            const harpieCount = ctx.field(ctx.owner).filter((s) => s && !s.isFaceDown && s.card.uid !== ctx.card.uid && s.card.name && NOME_ARPIA.test(s.card.name)).length;
            if (harpieCount >= 1) {
                // Protegge le ALTRE "Arpia" controllate, ECCETTO questa
                // carta stessa (il testo reale la esclude esplicitamente
                // dalla propria protezione) — stesso schema di Capitano
                // Predone (id 714).
                ctx.field(ctx.owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown || slot.card.uid === ctx.card.uid || !slot.card.name || !NOME_ARPIA.test(slot.card.name)) return;
                    gameState.cannotBeAttackTargetUids[slot.card.uid] = true;
                });
            }
            if (harpieCount >= 2) {
                const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
                gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk + (ctx.card.attack || 0), def: e.def + (ctx.card.defense || 0) };
            }
        },
        canActivate(ctx) {
            const harpieCount = ctx.field(ctx.owner).filter((s) => s && !s.isFaceDown && s.card.uid !== ctx.card.uid && s.card.name && NOME_ARPIA.test(s.card.name)).length;
            if (harpieCount < 3) return false;
            return Tavolo.ordine().some((owner) => owner !== ctx.owner && (ctx.field(owner).some((s) => s) || ctx.stField(owner).some((s) => s)));
        },
        activate(ctx) {
            // "1 carta dell'avversario": mostri e retrocampo in un'unica
            // lista, mostri per primi — l'ordine che il bot (che prende
            // sempre il primo candidato) usava già prima.
            const candidati = collectFieldTargets(ctx, { zone: 'both', owner: 'opponent', includiCoperte: true });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🐲 Cucciolo di Drago dell\'Arpia',
                text: 'Scegli quale carta dell\'avversario distruggere.'
            }, (scelto) => {
                if (scelto.zone === 'st') {
                    const nome = scelto.card.name;
                    ctx.destroySpellTrap(scelto.owner, scelto.index);
                    ctx.log(`🐲 Cucciolo di Drago delle Arpie distrugge ${nome}!`);
                    return;
                }
                const decl = ctx.declareTarget(scelto.owner, scelto.index, { totalTargetCount: 1 });
                if (!decl.allowed) return;
                const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!finalSlot) return;
                ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                ctx.log('🐲 Cucciolo di Drago dell\'Arpia distrugge un mostro dell\'avversario!');
            });
        }
    });

    // ================================================================
    // 787 — Egoista Elegante / Elegant Egotist (Magia Normale)
    // Se "Lady Arpia" è sul Terreno: Special Summon 1 mostro il cui
    // nome contiene "Lady Arpia" dalla mano o dal Deck.
    // Era registrata due volte: anche come id 224 "Egotista Elegante", stesso
    // testo, nei mazzi di Mai. Il doppione è stato cancellato e i mazzi
    // portati qui; da lui viene il canActivate che controlla che esista
    // davvero un mostro da Evocare (prima bastava una casella libera).
    // ================================================================
    CardEffects.register(787, {
        canActivate(ctx) {
            const hasHarpieLady = ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && isHarpieLadySupport(s.card));
            if (!hasHarpieLady) return false;
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return false;
            const evocabile = (c) => isHarpieLadySupport(c) || c.name === 'Sorelle Arpie';
            const deck = Tavolo.mazzo(ctx.owner, ctx.gameState);
            return ctx.hand(ctx.owner).some(evocabile) || (Array.isArray(deck) && deck.some(evocabile));
        },
        activate(ctx) {
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const hand = ctx.hand(ctx.owner);
            const handIdx = hand.findIndex((c) => isHarpieLadySupport(c) || c.name === 'Sorelle Arpie');
            if (handIdx !== -1) {
                const [card] = hand.splice(handIdx, 1);
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'hand');
                ctx.log(`🦅 Egotista Elegante Special Summona ${card.name} dalla mano!`);
                return;
            }
            searchDeckWithChoice(ctx, (c) => isHarpieLadySupport(c) || c.name === 'Sorelle Arpie', {
                title: '🦅 Egotista Elegante',
                text: 'Scegli quale mostro Special Summonare dal Deck.'
            }, (card) => {
                const freshSlot = ctx.findEmptyMonsterSlot(ctx.owner);
                if (freshSlot === -1) return;
                ctx.specialSummon(ctx.owner, card, freshSlot, 'attack', 'deck');
                ctx.log(`🦅 Egotista Elegante Special Summona ${card.name} dal Deck!`);
            });
        }
    });

    // ================================================================
    // 788 — Terreno di Caccia delle Arpie / Harpies' Hunting Ground
    // (Magia Terreno)
    // Tutti i mostri Tipo Bestia Alata: +200 ATK/DEF. Se una carta "Lady
    // Arpia"/"Sorelle Arpie" viene Evocata (onOwnMonsterSummoned,
    // duel-engine.js): distruggi 1 Magia/Trappola sul Terreno
    // (SEMPLIFICAZIONE: la prima disponibile, priorità a quella
    // dell'avversario, stessa convenzione di targeting automatico usata
    // in tutto questo file — non copre mai la propria zona Magia
    // Terreno, solo la zona 'st' a 5 caselle).
    // ================================================================
    CardEffects.register(788, {
        continuous: true,
        activate(ctx) {
            ctx.log('🦅 Terreno di Caccia delle Arpie attivato!');
        },
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown || slot.card.race !== 'Bestia Alata') return;
                    const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    gameState.atkDefBonus[slot.card.uid] = { atk: e.atk + 200, def: e.def + 200 };
                });
            });
        },
        onOwnMonsterSummoned(ctx) {
            if (!(isHarpieLadySupport(ctx.summonedCard) || ctx.summonedCard.name === 'Sorelle Arpie')) return;
            // Candidati ordinati con il retrocampo AVVERSARIO per primo,
            // che era la priorità della vecchia selezione automatica e
            // resta quella che il bot segue prendendo il primo.
            const candidati = [
                ...collectFieldTargets(ctx, { zone: 'st', owner: 'opponent', includiCoperte: true }),
                ...collectFieldTargets(ctx, { zone: 'st', owner: 'self', includiCoperte: true })
            ];
            if (candidati.length === 0) return;
            // `evocata` va letto ORA: dentro la callback asincrona il
            // contesto del trigger potrebbe non essere più quello.
            // (Qui c'era un bug vero: il log scriveva `${name}`, cioè il
            // `name` GLOBALE della finestra, non il nome della carta.)
            const evocata = ctx.summonedCard.name;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🦅 Terreno di Caccia delle Arpie',
                text: 'Scegli quale Magia/Trappola distruggere.'
            }, (scelto) => {
                const destroyed = scelto.card;
                ctx.graveyard(scelto.owner).push(destroyed);
                ctx.stField(scelto.owner)[scelto.index] = null;
                ctx.log(`🦅 Terreno di Caccia delle Arpie distrugge ${destroyed.name} dopo l'Evocazione di ${evocata}!`);
            });
        }
    });

    // ================================================================
    // 789 — Scintilla dell'Estasi Triangolare / Triangle Ecstasy Spark
    // (Magia Normale). Fino a fine turno, l'ATK di tutte le "Sorelle
    // Lady Arpia" sul Terreno diventa 2700 e l'avversario non può
    // attivare Trappole (gameState.noTrapActivationFor) — vedi il
    // commento più sotto per l'annullamento anche delle Trappole
    // dell'avversario già Set/scoperte.
    // ================================================================
    CardEffects.register(789, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.id === 290);
        },
        activate(ctx) {
            let count = 0;
            ctx.field(ctx.owner).forEach((slot) => {
                if (slot && !slot.isFaceDown && slot.card.id === 290) {
                    ctx.grantTemporaryAtkDefBonus(slot.card, 2700 - DuelEngine.getEffectiveAtk(slot.card), 0, false);
                    count++;
                }
            });
            gameState.noTrapActivationFor = gameState.noTrapActivationFor || {};
            gameState.noTrapActivationFor[ctx.opponent] = true;
            // "Annulla tutti gli effetti Trappola dell'avversario sul
            // Terreno" — non solo il blocco di NUOVE attivazioni (già
            // gestito da noTrapActivationFor qui sopra), anche le
            // Trappole avversarie già Set diventano inerti per il resto
            // del turno: stesso schema di areTrapsNegatedFor (Jinzo), ma
            // "fino a fine turno" invece che continuo.
            gameState.trapsNegatedUntilEndOfTurnFor = gameState.trapsNegatedUntilEndOfTurnFor || {};
            gameState.trapsNegatedUntilEndOfTurnFor[ctx.opponent] = true;
            ctx.log(`🎇 Scintilla d'Estasi Triangolare porta l'ATK di ${count} Sorelle Arpie a 2700, blocca le Trappole avversarie e annulla quelle già sul Terreno!`);
        }
    });

    // ================================================================
    // 790 — Festa Isterica / Hysteric Party (Trappola Continua)
    // Scarta 1 carta; Special Summon quante più copie possibili di
    // "Lady Arpia" dal Cimitero, memorizzando i loro uid su questa
    // carta (ctx.card.summonedUids). Quando questa carta scoperta viene
    // distrutta: distruggi quei mostri, se ancora sul Terreno con lo
    // stesso uid — onSTDestroyed/ctx.destroySpellTrap, stesso schema di
    // Sepoltura Prematura (id 633)/Amplificatore (id 92), ma su PIÙ
    // mostri invece di uno solo.
    // "Se questa carta lascia il Terreno" copre ora distruzione, bando
    // (onBanished, ACTIONS.banish) e anche il ritorno in mano
    // (onReturnedToHandSelf) — scatenato dall'unica carta di questo
    // dataset che rimanda Magie/Trappole in mano, Turbine Gigante (id 262).
    // ================================================================
    function destroyHystericPartySummons(ctx) {
        const uids = ctx.card.summonedUids;
        if (!uids || uids.length === 0) return;
        let count = 0;
        Tavolo.ordine().forEach((owner) => {
            ctx.field(owner).forEach((slot, index) => {
                if (slot && uids.includes(slot.card.uid)) {
                    ctx.destroyMonster(owner, index);
                    count++;
                }
            });
        });
        if (count > 0) ctx.log(`🦅 Festa Isterica lascia il Terreno: ${count} Lady Arpia Special Summonate vengono distrutte!`);
    }
    CardEffects.register(790, {
        canActivate(ctx) {
            if (ctx.hand(ctx.owner).length === 0) return false;
            return ctx.graveyard(ctx.owner).some((c) => isHarpieLadySupport(c));
        },
        activate(ctx) {
            offerHandDiscardChoice(ctx, {
                title: '🦅 Festa Isterica',
                text: 'Scegli quale carta scartare dalla mano.'
            }, (discarded) => {
                const grave = ctx.graveyard(ctx.owner);
                const summonedUids = [];
                for (let i = grave.length - 1; i >= 0; i--) {
                    if (!isHarpieLadySupport(grave[i])) continue;
                    const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                    if (slotIndex === -1) break;
                    const [card] = grave.splice(i, 1);
                    // Dal CIMITERO: lo scarto dalla mano qui sopra e' il
                    // costo, le Lady Arpia arrivano da grave.splice.
                    ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'graveyard');
                    summonedUids.push(card.uid);
                }
                ctx.card.summonedUids = summonedUids;
                ctx.log(`🦅 Festa Isterica scarta ${discarded.name} e Special Summona ${summonedUids.length} Lady Arpia dal Cimitero!`);
            });
        },
        onSTDestroyed: destroyHystericPartySummons,
        onBanished: destroyHystericPartySummons,
        onReturnedToHandSelf: destroyHystericPartySummons
    });

    // ================================================================
    // 791 — Coro Acquatico / Aqua Chorus (Trappola Continua, statico)
    // Mostri con lo stesso nome sul Terreno: +500 ATK/DEF ciascuno.
    // ================================================================
    CardEffects.register(791, {
        continuous: true,
        activate(ctx) {
            ctx.log('🎵 Coro Acquatico attivato!');
        },
        static(ctx) {
            const nameCounts = {};
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (slot && !slot.isFaceDown) nameCounts[slot.card.name] = (nameCounts[slot.card.name] || 0) + 1;
                });
            });
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown) return;
                    if ((nameCounts[slot.card.name] || 0) < 2) return;
                    const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    gameState.atkDefBonus[slot.card.uid] = { atk: e.atk + 500, def: e.def + 500 };
                });
            });
        }
    });

    // ================================================================
    // 792 — Bara Oscura / Dark Coffin (Trappola Normale)
    // Quando questa carta SET viene distrutta e mandata al Cimitero (da
    // un'altra fonte, non attivandola): il tuo avversario sceglie ed
    // esegue 1 di: scarta 1 carta a caso dalla propria mano, o distrugge
    // 1 mostro sul proprio Terreno — onSTDestroyed (nuovo hook in
    // duel-engine.js/ctx.destroySpellTrap).
    // Le due scelte sono della VITTIMA (chooseOption con chooser, poi
    // chooseFieldCardTarget su un contesto di chi subisce): quale effetto
    // eseguire e, se distrugge, quale dei suoi mostri. Prima era un lancio
    // 50/50 e poi il primo mostro trovato. Nessun "bersaglio" nel testo,
    // quindi nessun checkpoint di targeting. Il bot da vittima scarta se
    // ha più di 2 carte in mano, altrimenti sacrifica il suo mostro più
    // debole.
    // ================================================================
    CardEffects.register(792, {
        onSTDestroyed(ctx) {
            if (!ctx.wasFaceDown) return;
            const vittima = ctx.opponent;
            const tu = vittima === 'player';
            const haMano = ctx.hand(vittima).length > 0;
            const haMostri = ctx.field(vittima).some((s) => s);
            if (!haMano && !haMostri) return;
            const scarta = () => {
                const discarded = ctx.discardRandomFromHand(vittima);
                if (discarded) ctx.log(`⚰️ Bara Oscura: ${tu ? 'scarti' : 'il bot scarta'} ${discarded.name}!`);
            };
            const distruggi = () => {
                // Contesto di chi subisce: chooseFieldCardTarget fa scegliere
                // ctx.owner, e qui a scegliere è la vittima.
                const vctx = DuelEngine.makeContext(vittima, { card: ctx.card });
                const candidati = collectFieldTargets(vctx, { zone: 'monster', owner: 'self', includiCoperte: true })
                    .sort((a, b) => DuelEngine.getEffectiveAtk(a.card) - DuelEngine.getEffectiveAtk(b.card));
                chooseFieldCardTarget(vctx, candidati, {
                    title: '⚰️ Bara Oscura',
                    text: 'Scegli quale dei tuoi mostri distruggere.',
                    // Obbligatorio: chiudere la lista la riapre.
                    onCancel: () => setTimeout(distruggi, 0)
                }, (scelto) => {
                    const idx = ctx.field(vittima).findIndex((s) => s && s.card.uid === scelto.card.uid);
                    if (idx === -1) return;
                    ctx.destroyMonster(vittima, idx);
                    ctx.log(`⚰️ Bara Oscura: ${tu ? 'perdi' : 'il bot perde'} ${scelto.card.name}!`);
                });
            };
            chooseOption(ctx, {
                chooser: vittima,
                title: '⚰️ Bara Oscura',
                text: 'La Bara Oscura dell\'avversario è stata distrutta: scegli cosa subire.',
                options: [
                    haMano ? { value: 'scarta', label: 'Scarta 1 carta a caso dalla mano', icon: '🗑️' } : null,
                    haMostri ? { value: 'distruggi', label: 'Distruggi 1 tuo mostro a scelta', icon: '💀' } : null
                ],
                pickForBot: () => ((haMano && (ctx.hand(vittima).length > 2 || !haMostri)) ? 'scarta' : 'distruggi')
            }, (scelta) => {
                if (scelta === 'distruggi') distruggi();
                else scarta();
            });
        }
    });

    // ================================================================
    // 793 — Armatura Sakuretsu / Sakuretsu Armor (Trappola Normale)
    // Quando l'avversario dichiara un attacco: distruggi il mostro
    // attaccante. Stesso schema di risposta di Kuriboh (id 22).
    // ================================================================
    CardEffects.register(793, {
        onAttackDeclare(ctx) {
            const field = ctx.field(ctx.opponent);
            const attackerSlot = field[ctx.attackerIndex];
            if (!attackerSlot) return;
            ctx.declareTargetWaiting(ctx.opponent, ctx.attackerIndex, { totalTargetCount: 1 }, (decl) => {
                if (!decl.allowed) return;
                const targetSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!targetSlot) return;
                const name = targetSlot.card.name;
                if (window.FX && typeof FX.playSakuretsuArmor === 'function') {
                    FX.playSakuretsuArmor(decl.targetOwner, decl.targetIndex);
                }
                ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                ctx.cancelAttack();
                ctx.log(`🛡️ Armatura Sakuretsu distrugge ${name}!`);
            });
        }
    });

    // ================================================================
    // 794 — Arte Ninjitsu della Trasformazione / Ninjitsu Art of
    // Transformation (Trappola Continua)
    // Sacrifica 1 mostro il cui nome contiene "Ninja" scoperto; Special
    // Summon 1 mostro Bestia/Bestia Alata/Insetto dalla mano o dal Deck
    // con Livello minore o uguale al Livello del sacrificato +3. Quando
    // questa carta lascia il Terreno: distruggi quel mostro (stesso
    // schema di dipendenza targetOwner/targetIndex/targetUid di
    // Incantesimo Ombra id 439/Cerchio Ammaliante id 620).
    // ================================================================
    CardEffects.register(794, {
        continuous: true,
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.name && s.card.name.includes('Ninja'));
        },
        // Scambia un Ninja con un Bestia/Bestia Alata/Insetto di Livello massimo +3: per l'IA ha senso solo se il
        // sostituto (in mano, o nel Deck se la mano non ne ha) e' nettamente piu' forte del Ninja che si sacrifica.
        aiCanActivate(ctx) {
            const ninja = ctx.field(ctx.owner).find((s) => s && !s.isFaceDown && s.card.name && s.card.name.includes('Ninja'));
            if (!ninja) return false;
            const maxLevel = (ninja.card.level || 0) + 3;
            const candidato = (c) => c.type === 'monster' && ['Bestia', 'Bestia Alata', 'Insetto'].includes(c.race) && (c.level || 0) <= maxLevel;
            const inMano = ctx.hand(ctx.owner).filter(candidato);
            const fonte = inMano.length ? inMano : (ctx.gameState[Tavolo.chiave(ctx.owner, 'Deck')] || []).filter(candidato);
            const migliore = fonte.reduce((m, c) => Math.max(m, c.attack || 0), 0);
            return migliore >= (ninja.card.attack || 0) + 500;
        },
        activate(ctx) {
            const field = ctx.field(ctx.owner);
            const tributeIndex = field.findIndex((s) => s && !s.isFaceDown && s.card.name && s.card.name.includes('Ninja'));
            if (tributeIndex === -1) return;
            const maxLevel = (field[tributeIndex].card.level || 0) + 3;
            const filterFn = (c) => c.type === 'monster' && ['Bestia', 'Bestia Alata', 'Insetto'].includes(c.race) && (c.level || 0) <= maxLevel;

            // La zona la passa chi chiama, perche' finishSummon serve sia
            // il ramo "dalla mano" sia quello "dal Deck". Il Cimitero qui
            // dentro riceve il NINJA sacrificato, non il mostro evocato:
            // dedurre la zona da quel push sarebbe sbagliato.
            const finishSummon = (zona) => (summonedCard) => {
                ctx.graveyard(ctx.owner).push(field[tributeIndex].card);
                field[tributeIndex] = null;
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) { ctx.graveyard(ctx.owner).push(summonedCard); return; }
                ctx.specialSummon(ctx.owner, summonedCard, slotIndex, 'attack', zona);
                ctx.card.targetOwner = ctx.owner;
                ctx.card.targetIndex = slotIndex;
                ctx.card.targetUid = summonedCard.uid;
                ctx.log(`🥷 Arte della Trasformazione Ninjitsu sacrifica un Ninja e Special Summona ${summonedCard.name}!`);
            };

            // La mano ha priorità sul Deck (stesso ordine dell'originale) —
            // vera scelta in entrambi i casi tramite searchZoneWithChoice/
            // searchDeckWithChoice invece del primo candidato trovato.
            const hand = ctx.hand(ctx.owner);
            if (hand.some(filterFn)) {
                searchZoneWithChoice(ctx, hand, filterFn, {
                    title: '🥷 Arte della Trasformazione Ninjitsu',
                    text: 'Scegli quale mostro Special Summonare dalla mano.'
                }, finishSummon('hand'));
                return;
            }
            searchDeckWithChoice(ctx, filterFn, {
                title: '🥷 Arte della Trasformazione Ninjitsu',
                text: 'Scegli quale mostro Special Summonare dal Deck.'
            }, finishSummon('deck'));
        },
        static(ctx) {
            const targetSlot = ctx.card.targetOwner != null ? ctx.field(ctx.card.targetOwner)[ctx.card.targetIndex] : null;
            const validTarget = targetSlot && !targetSlot.isFaceDown && targetSlot.card.uid === ctx.card.targetUid;
            if (validTarget) return;
            if (ctx.card.targetOwner == null) return; // non ancora attivata: nessun bersaglio da controllare
            ctx.stField(ctx.owner)[ctx.index] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
        }
    });

    // ================================================================
    // 795 — Attacco d'Icaro / Icarus Attack (Trappola Normale)
    // Sacrifica 1 mostro Tipo Bestia Alata; distruggi 2 carte sul
    // Terreno.
    // SEMPLIFICAZIONE: sceglie da sola quale mostro sacrificare e quali
    // 2 carte distruggere (le prime trovate, preferendo il Terreno
    // dell'avversario), invece di un'interfaccia di selezione dedicata.
    // ================================================================
    CardEffects.register(795, {
        canActivate(ctx) {
            const hasTribute = ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.race === 'Bestia Alata');
            if (!hasTribute) return false;
            const totalTargets = Tavolo.ordine().reduce((sum, owner) => sum + ctx.field(owner).filter((s) => s).length + ctx.stField(owner).filter((s) => s).length, 0);
            return totalTargets >= 1;
        },
        activate(ctx) {
            // "Sacrifica 1 mostro Tipo Bestia Alata, poi scegli come
            // bersaglio 2 carte sul Terreno; distruggile."
            //
            // Tre scelte vere, tutte automatiche prima di questa
            // riscrittura: quale Bestia Alata sacrificare, e quali DUE
            // carte colpire fra mostri e Magie/Trappole di entrambi i
            // lati. Su una carta che ne distrugge due in un colpo, la
            // scelta è praticamente tutta la carta.
            //
            // Le scelte sono ASINCRONE e in SEQUENZA, quindi ognuna vive
            // dentro la callback della precedente: scritte in fila si
            // aprirebbero insieme, o la seconda non si aprirebbe affatto.
            const sacrificabili = collectFieldTargets(ctx, {
                zone: 'monster', owner: 'self',
                filter: (card) => card.race === 'Bestia Alata'
            });
            if (sacrificabili.length === 0) return;

            const distruggi = (bersaglio) => {
                if (bersaglio.zone === 'monster') {
                    if (ctx.field(bersaglio.owner)[bersaglio.index]) {
                        ctx.destroyMonster(bersaglio.owner, bersaglio.index);
                        return true;
                    }
                    return false;
                }
                const slot = ctx.stField(bersaglio.owner)[bersaglio.index];
                if (!slot) return false;
                ctx.graveyard(bersaglio.owner).push(slot.card);
                ctx.stField(bersaglio.owner)[bersaglio.index] = null;
                return true;
            };

            chooseFieldCardTarget(ctx, sacrificabili, {
                title: '🦅 Attacco d\'Icaro',
                text: 'Scegli quale mostro Bestia Alata sacrificare.'
            }, (tributo) => {
                ctx.graveyard(ctx.owner).push(tributo.card);
                ctx.field(ctx.owner)[tributo.index] = null;

                // I candidati si raccolgono ADESSO, non prima: il mostro
                // appena sacrificato non deve comparire fra i bersagli.
                const primi = collectFieldTargets(ctx, { includiCoperte: true });
                if (primi.length === 0) {
                    ctx.log('🦅 Attacco d\'Icaro sacrifica un mostro Bestia Alata, ma non c\'è più nulla da distruggere.');
                    return;
                }
                chooseFieldCardTarget(ctx, primi, {
                    title: '🦅 Primo bersaglio',
                    dichiara: true,
                    totalTargetCount: 2,
                    text: 'Scegli la prima delle due carte da distruggere.'
                }, (primo) => {
                    const distrutti = distruggi(primo) ? 1 : 0;
                    // Stessa ragione di prima: dopo la prima distruzione
                    // il Terreno è cambiato, e la carta appena distrutta
                    // non può essere scelta di nuovo.
                    const secondi = collectFieldTargets(ctx, { includiCoperte: true });
                    if (secondi.length === 0) {
                        ctx.log(`🦅 Attacco Icaro distrugge ${distrutti} cart${distrutti === 1 ? 'a' : 'e'}!`);
                        return;
                    }
                    chooseFieldCardTarget(ctx, secondi, {
                        title: '🦅 Secondo bersaglio',
                        dichiara: true,
                        totalTargetCount: 2,
                        text: 'Scegli la seconda carta da distruggere.'
                    }, (secondo) => {
                        const totale = distrutti + (distruggi(secondo) ? 1 : 0);
                        ctx.log(`🦅 Attacco Icaro sacrifica un mostro Bestia Alata e distrugge ${totale} cart${totale === 1 ? 'a' : 'e'}!`);
                    });
                });
            });
        }
    });

    // ================================================================
    // 796 — Tiranno Superconduttore / Super Conductor Tyranno (Ignition,
    // una volta per turno)
    // Sacrifica 1 mostro: infliggi 1000 danni. Non può attaccare nel
    // turno in cui attivi questo effetto (stesso schema di Stregone del
    // Caos id 740).
    // ================================================================
    CardEffects.register(796, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s && s.card.uid !== ctx.card.uid);
        },
        activate(ctx) {
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((s) => s && s.card.uid !== ctx.card.uid);
            if (index === -1) return;
            const sacrificed = field[index].card;
            ctx.graveyard(ctx.owner).push(sacrificed);
            field[index] = null;
            ctx.dealDamage(ctx.opponent, 1000);
            ctx.card._cannotAttackTurn = gameState.turn;
            ctx.log(`🦖 Tiranno Super Conduttore sacrifica ${sacrificed.name} e infligge 1000 danni!`);
        },
        static(ctx) {
            if (ctx.card._cannotAttackTurn === gameState.turn) gameState.cannotAttackUids[ctx.card.uid] = true;
        }
    });

    // ================================================================
    // 799 — Driceratopo Oscuro / Dark Driceratops
    // Danno da battaglia perforante (def.piercing, actions.js).
    // ================================================================
    CardEffects.register(799, { piercing: true });

    // ================================================================
    // 800 — Testa di Martello Iper / Hyper Hammerhead (onBattled)
    // Alla fine del Damage Step, se il mostro avversario contro cui ha
    // combattuto NON è stato distrutto: rimandalo in mano.
    // ================================================================
    CardEffects.register(800, {
        onBattled(ctx) {
            if (!ctx.opponentSurvived) return;
            const idx = ctx.field(ctx.opponent).findIndex((s) => s && s.card.uid === ctx.opponentCard.uid);
            if (idx === -1) return;
            const name = ctx.opponentCard.name;
            ctx.returnMonsterToHand(ctx.opponent, idx);
            ctx.log(`🔨 Iper Testa-Martello rimanda ${name} in mano!`);
        }
    });

    // ================================================================
    // 801 — Tiranno Nero / Black Tyranno (statico)
    // Se le uniche carte controllate dall'avversario sono mostri in
    // Posizione di Difesa (nessun'altra carta): questa carta può
    // attaccare direttamente (gameState.directAttackAllowedUids).
    // ================================================================
    CardEffects.register(801, {
        static(ctx) {
            const oppField = ctx.field(ctx.opponent);
            const oppST = ctx.stField(ctx.opponent);
            const oppFieldSpell = Tavolo.magiaTerreno(ctx.opponent);
            const hasMonsters = oppField.some((s) => s);
            const allDefense = oppField.every((s) => !s || s.position === 'defense');
            const noOtherCards = oppST.every((s) => s === null) && !oppFieldSpell;
            if (hasMonsters && allDefense && noOtherCards) {
                gameState.directAttackAllowedUids[ctx.card.uid] = true;
            }
        }
    });

    // ================================================================
    // 802 — Tiranno Infinito / Tyranno Infinity
    // "The original ATK of this card becomes the number of your banished
    // Dinosaur monsters x 1000" — ricalcolato ad ogni render (static),
    // stesso schema di qualunque altro conteggio dinamico in questo file,
    // ora possibile grazie a una vera zona Bandite (ctx.banished).
    // ================================================================
    CardEffects.register(802, {
        static(ctx) {
            const dinosBanished = ctx.banished(ctx.owner).filter((c) => c.type === 'monster' && c.race === 'Dinosauro').length;
            ctx.card.attack = dinosBanished * 1000;
        }
    });

    // ================================================================
    // 803 — Idrogeddon / Hydrogeddon
    // Se questa carta distrugge un mostro dell'avversario in battaglia:
    // puoi Special Summonare un'altra copia dal Deck
    // (onDestroysMonsterInBattle, actions.js — preciso: non scatta su un
    // attacco diretto né su una battaglia che non distrugge il bersaglio).
    // ================================================================
    CardEffects.register(803, {
        onDestroysMonsterInBattle(ctx) {
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            if (!Array.isArray(deck)) return;
            const index = deck.findIndex((c) => c.id === 803);
            if (index === -1) return;
            const card = deck.splice(index, 1)[0];
            gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
            ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
            ctx.log('🦖 Idrogeddon Special Summona un\'altra copia dal Deck!');
        }
    });

    // ================================================================
    // 804 — Ossigeddon / Oxygeddon (onDestroy)
    // Se distrutta in battaglia da un mostro Tipo Piroico: ciascun
    // giocatore subisce 800 danni (ctx.destroyedByOpponentCard,
    // actions.js/resolveBattleDamage — nuovo campo generico).
    // ================================================================
    CardEffects.register(804, {
        onDestroy(ctx) {
            if (!ctx.destroyedByOpponentCard || ctx.destroyedByOpponentCard.race !== 'Piroico') return;
            ctx.dealDamage('player', 800);
            ctx.dealDamage('bot', 800);
            ctx.log('☠️ Ossigeddon distrutta da un mostro Piroico: entrambi i giocatori subiscono 800 danni!');
        }
    });

    // ================================================================
    // 805 — Ptera Nero / Black Ptera (onDestroy)
    // Quando mandata dal Terreno al Cimitero, TRANNE che venendo
    // distrutta in battaglia: ritorna in mano — ctx.destroyedByOpponentCard
    // (nuovo campo generico, valorizzato SOLO per una distruzione in
    // battaglia) distingue esattamente questo caso.
    // ================================================================
    CardEffects.register(805, {
        onDestroy(ctx) {
            if (ctx.destroyedByOpponentCard) return;
            const hand = ctx.hand(ctx.owner);
            const grave = ctx.graveyard(ctx.owner);
            const index = grave.findIndex((c) => c.uid === ctx.card.uid);
            if (index === -1) return;
            if (ctx.graveyardMoveNegated(ctx.owner)) return;
            grave.splice(index, 1);
            hand.push(ctx.card);
            ctx.log('🦅 Pterodattilo Nero ritorna in mano!');
        }
    });

    // ================================================================
    // 806 — Stego Nero / Black Stego
    // Se questa carta in Posizione di Attacco viene scelta come
    // bersaglio per un attacco: cambiala in Posizione di Difesa. Il
    // mostro bersagliato può rispondere direttamente (vedi
    // findTriggerCandidates in duel-engine.js).
    // ================================================================
    CardEffects.register(806, {
        onAttackDeclare(ctx) {
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((s) => s && s.card.uid === ctx.card.uid);
            if (index === -1 || field[index].position !== 'attack') return;
            field[index].position = 'defense';
            ctx.log('🦕 Stegosauro Oscuro cambia in Posizione di Difesa!');
        }
    });

    // ================================================================
    // 807 — Tiranno Definitivo / Ultimate Tyranno
    // Può attaccare tutti i mostri dell'avversario, una volta ciascuno.
    // Durante la propria Battle Phase, se controlla un "Tiranno
    // Definitivo" che può ancora attaccare, gli altri propri mostri non
    // possono attaccare.
    // getExtraAttackCount si appoggia alla generalizzazione degli
    // attacchi extra introdotta per Samurai Armato - Ben Kei (id 721,
    // vedi resolveAttack in actions.js): concede tanti attacchi extra
    // quanti sono i mostri avversari meno 1 (il primo attacco è quello
    // "base"). SEMPLIFICAZIONE: nessun tracciamento di QUALE mostro
    // avversario sia già stato colpito in questo giro (stesso limite già
    // accettato per Esplosione a Onde Soniche, id 199) — chi controlla la carta
    // può scegliere liberamente il bersaglio ad ogni attacco extra,
    // potendo in teoria colpire due volte lo stesso mostro invece di uno
    // ciascuno. Il conteggio nemici viene "fotografato" al MASSIMO visto
    // in questo turno DENTRO onOwnAttackDeclare (che scatta PRIMA del
    // calcolo danni di OGNI attacco, base o extra — vedi
    // TRIGGER.ON_ATTACK_DECLARE in duel-engine.js), non dentro
    // getExtraAttackCount stesso: quella funzione viene interrogata DOPO
    // che resolveBattleDamage ha già eventualmente distrutto il
    // bersaglio di QUESTO attacco, quindi fotografare lì il conteggio
    // vedrebbe già un nemico in meno fin dal primissimo attacco —
    // concedendo sistematicamente un attacco extra di meno del dovuto
    // (bug reale, catturato con un test dedicato: il terzo mostro
    // avversario restava vivo senza questo fix).
    // ================================================================
    CardEffects.register(807, {
        onOwnAttackDeclare(ctx) {
            // ctx qui è il contesto di DICHIARAZIONE attacco (declareCtx in
            // actions.js): NON ha ctx.card (quel nome è riservato, dentro
            // openTriggerWindow, alla carta di chi RISPONDE) — la carta
            // stessa va letta da ctx.field(ctx.owner)[ctx.attackerIndex].
            const self = ctx.field(ctx.owner)[ctx.attackerIndex].card;
            const enemyCount = ctx.field(ctx.opponent).filter((s) => s).length;
            if (self.__ultimateTyrannoSnapshotTurn !== gameState.turn) {
                self.__ultimateTyrannoSnapshotTurn = gameState.turn;
                self.__ultimateTyrannoMaxEnemyCount = enemyCount;
            } else if (enemyCount > self.__ultimateTyrannoMaxEnemyCount) {
                self.__ultimateTyrannoMaxEnemyCount = enemyCount;
            }
        },
        getExtraAttackCount(ctx) {
            return Math.max(0, (ctx.card.__ultimateTyrannoMaxEnemyCount || 0) - 1);
        },
        static(ctx) {
            if (ctx.slot.isFaceDown) return;
            const canStillAttack = ctx.slot.position === 'attack' && !ctx.slot.hasAttacked;
            if (!canStillAttack) return;
            ctx.field(ctx.owner).forEach((s) => {
                if (s && s.card.uid !== ctx.card.uid) {
                    gameState.cannotAttackUids[s.card.uid] = true;
                }
            });
        }
    });

    // ================================================================
    // 808 — Uovo Giurassico Miracoloso / Miracle Jurassic Egg
    // Ogni volta che uno o più mostri Tipo Dinosauro (anche di un'altra
    // carta) vengono mandati al proprio Cimitero: 2 Segnalini su questa
    // carta. Nuovo handler def.onOwnMonsterDestroyedPassive
    // (duel-engine.js, TRIGGER.ON_DESTROY): broadcast incondizionato verso
    // ogni mostro scoperto sul proprio Terreno, diverso dal già esistente
    // onOwnMonsterDestroyed (quello è per Trappole Set, con scelta/
    // consumo via Chain — semantica sbagliata per un mostro passivo come
    // questo). La nota precedente ("richiederebbe un nuovo aggancio
    // generico") era corretta sulla sostanza ma non sapeva che il pezzo
    // mancante era piccolo: solo questo nuovo ramo di broadcast, non
    // un'infrastruttura enorme.
    // Puoi sacrificarla (effetto Ignition dalla zona Mostro) per Special
    // Summonare 1 mostro Dinosauro dal Deck di Livello <= Segnalini
    // presenti — sceglie da sola il Livello più alto possibile.
    // notifyOwnMonsterSentToGraveyard (duel-engine.js) ora è condivisa
    // anche da performTributeSacrifice/bot.js (Sacrificio per Evocazione
    // Tributo, sia per Evocare sia come costo d'attacco) e da
    // discardRandomFromHand (scarto a caso dalla mano): onOwnMonsterDestroyedPassive
    // scatta correttamente per tutti questi casi, non solo la distruzione.
    // "Non può essere bandita finché scoperta sul Terreno" ora
    // implementata: def.cannotBeBanishedWhileOnField, letto da
    // blockBanishFromField(ctx, card) (nuovo helper condiviso, in cima
    // a questo file) — il testo protegge SOLO dal bando "dal Terreno",
    // quindi il controllo va SOLO nei punti che bandiscono una carta
    // presa dalla zona Mostro (11 punti in questo file + 1 in
    // duel-engine.js/getBanishFusableExtraDeckMonsters, non i ~28 bandi
    // totali del motore: la stragrande maggioranza banisce dal
    // Cimitero/dalla mano/dal Deck, fuori scopo per questa carta).
    // ================================================================
    CardEffects.register(808, {
        cannotBeBanishedWhileOnField: true,
        onOwnMonsterDestroyedPassive(ctx) {
            if (!ctx.destroyedCard || ctx.destroyedCard.race !== 'Dinosauro') return;
            ctx.card.counters = (ctx.card.counters || 0) + 2;
            ctx.log(`🥚 Uovo Giurassico Miracoloso riceve 2 Segnalini (ora ${ctx.card.counters})!`);
        },
        canActivate(ctx) {
            if (!ctx.card.counters) return false;
            const deck = Tavolo.mazzo(ctx.owner);
            return Array.isArray(deck) && deck.some((c) => c.type === 'monster' && c.race === 'Dinosauro' && c.level <= ctx.card.counters);
        },
        activate(ctx) {
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            let bestIndex = -1;
            let bestLevel = -1;
            deck.forEach((c, i) => {
                if (c.type === 'monster' && c.race === 'Dinosauro' && c.level <= ctx.card.counters && c.level > bestLevel) {
                    bestLevel = c.level;
                    bestIndex = i;
                }
            });
            if (bestIndex === -1) return;
            const [dino] = deck.splice(bestIndex, 1);
            gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
            const ownIndex = ctx.index;
            ctx.field(ctx.owner)[ownIndex] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            ctx.specialSummon(ctx.owner, dino, ownIndex, 'attack', 'deck');
            ctx.log(`🥚 Uovo Giurassico Miracoloso si sacrifica per Special Summonare ${dino.name}!`);
        }
    });

    // ================================================================
    // 809 — Bebè Cerasauro / Babycerasaurus (onDestroy)
    // Distrutta da un effetto Carta (MAI in battaglia) e mandata al
    // Cimitero: Special Summon 1 mostro Dinosauro di Livello 4 o
    // inferiore dal Deck — ctx.destroyedByOpponentCard distingue
    // esattamente "battaglia" (valorizzato) da "effetto Carta" (null).
    // ================================================================
    CardEffects.register(809, {
        onDestroy(ctx) {
            if (ctx.destroyedByOpponentCard) return;
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.race === 'Dinosauro' && (c.level || 0) <= 4, {
                title: '🦖 Bebè Cerasauro',
                text: 'Scegli quale mostro Dinosauro di Livello 4 o inferiore Special Summonare dal Deck.'
            }, (card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
                ctx.log(`🦖 Bebè Cerasauro Special Summona ${card.name} dal Deck!`);
            });
        }
    });

    // ================================================================
    // 810 — Grande Pillola Evolutiva / Big Evolution Pill (Magia Continua)
    // Sacrifica 1 mostro Tipo Dinosauro per attivare questa carta (stesso
    // schema di Soffio Esplosivo, id 134: auto-seleziona il sacrificio,
    // qui il più DEBOLE dato che non conta quale). Finché scoperta sul
    // Terreno: puoi Evocare Normalmente mostri Tipo Dinosauro di Livello
    // 5+ senza Sacrificio — verificato dal vivo in attemptMonsterSummon
    // (actions.js), stessa eccezione puntuale già usata per Gaia il
    // Cavaliere Feroce Rapido (id 711).
    // "Distruggila durante la 3ª End Phase del tuo avversario" —
    // gameState.pendingSelfDestructAtOpponentEndPhase (nuovo conteggio
    // "N End Phase dell'AVVERSARIO", duel-engine.js/
    // processSelfDestructAtOpponentEndPhase), accodato all'attivazione.
    // ================================================================
    CardEffects.register(810, {
        continuous: true,
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.race === 'Dinosauro');
        },
        // Sacrifica un Dinosauro: ha senso solo se in mano c'e' un Dinosauro di Livello 5+ da Evocare senza Tributi.
        aiCanActivate(ctx) {
            return ctx.hand(ctx.owner).some((c) => c.type === 'monster' && c.race === 'Dinosauro' && (c.level || 0) >= 5);
        },
        activate(ctx) {
            const ownField = ctx.field(ctx.owner);
            let tributeIndex = -1;
            let tributeCard = null;
            ownField.forEach((slot, i) => {
                if (slot && !slot.isFaceDown && slot.card.race === 'Dinosauro' && (!tributeCard || slot.card.attack < tributeCard.attack)) {
                    tributeIndex = i;
                    tributeCard = slot.card;
                }
            });
            if (tributeIndex === -1) return;
            ownField[tributeIndex] = null;
            ctx.graveyard(ctx.owner).push(tributeCard);
            gameState.pendingSelfDestructAtOpponentEndPhase = gameState.pendingSelfDestructAtOpponentEndPhase || [];
            gameState.pendingSelfDestructAtOpponentEndPhase.push({ cardUid: ctx.card.uid, owner: ctx.owner, endsRemaining: 3 });
            ctx.log(`🦖 Pillola dell'Evoluzione Gigante sacrifica ${tributeCard.name}: ora puoi Evocare Normalmente mostri Dinosauro di Livello 5+ senza Sacrificio!`);
        }
    });

    // ================================================================
    // 811 — Colpo di Coda / Tail Swipe (Magia Normale)
    // Se controlli un Dinosauro di Livello 5+: rimanda fino a 2 mostri
    // dell'avversario con Livello inferiore o coperti in mano.
    // ================================================================
    CardEffects.register(811, {
        canActivate(ctx) {
            const hasBigDino = ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.race === 'Dinosauro' && (s.card.level || 0) >= 5);
            if (!hasBigDino) return false;
            return ctx.field(ctx.opponent).some((s) => s);
        },
        activate(ctx) {
            // Due scelte in sequenza, e la prima decide la seconda: il
            // Livello del Dinosauro scelto e' la soglia che dice quali
            // mostri avversari sono bersagliabili. Prendere "il primo
            // Dinosauro che trovo", come faceva prima, poteva quindi
            // escludere bersagli che un altro Dinosauro dello stesso campo
            // avrebbe raggiunto.
            const dinosauri = collectFieldTargets(ctx, {
                zone: 'monster', owner: 'self',
                filter: (c) => c.race === 'Dinosauro' && (c.level || 0) >= 5
            });
            if (dinosauri.length === 0) return;
            chooseFieldCardTarget(ctx, dinosauri, {
                title: '🦖 Spazzata di Coda',
                text: 'Scegli il Dinosauro di Livello 5 o superiore: il suo Livello decide quali mostri puoi rimandare in mano.'
            }, (dino) => {
                const dinoLevel = dino.card.level || 0;
                let bounced = 0;
                // "fino a 2", uno alla volta: i candidati si ricalcolano ad
                // ogni giro perche' quello appena rimandato in mano non c'e'
                // piu', e perche' il picker e' asincrono.
                const prossimo = () => {
                    if (bounced >= 2) return fine();
                    const bersagli = collectFieldTargets(ctx, {
                        zone: 'monster', owner: 'opponent', includiCoperte: true,
                        filter: (card, owner, slot) => slot.isFaceDown || (card.level || 0) < dinoLevel
                    });
                    if (bersagli.length === 0) return fine();
                    chooseFieldCardTarget(ctx, bersagli, {
                        title: `🦖 Spazzata di Coda (${bounced + 1}/2)`,
                        text: 'Scegli un mostro avversario da rimandare in mano.'
                    }, (b) => {
                        const decl = ctx.declareTarget(b.owner, b.index, { totalTargetCount: 2 });
                        if (!decl.allowed) return fine();
                        const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                        if (!finalSlot) return fine();
                        ctx.returnMonsterToHand(decl.targetOwner, decl.targetIndex);
                        bounced++;
                        prossimo();
                    });
                };
                const fine = () => {
                    ctx.log(`🦖 Spazzata di Coda rimanda ${bounced} mostr${bounced === 1 ? 'o' : 'i'} in mano!`);
                };
                prossimo();
            });
        }
    });

    // ================================================================
    // 812 — Mondo Giurassico / Jurassic World (Magia Terreno)
    // Tutti i mostri Tipo Dinosauro: +300 ATK/DEF.
    // ================================================================
    CardEffects.register(812, {
        continuous: true,
        activate(ctx) {
            ctx.log('🦕 Mondo Giurassico attivato!');
        },
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown || slot.card.race !== 'Dinosauro') return;
                    const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    gameState.atkDefBonus[slot.card.uid] = { atk: e.atk + 300, def: e.def + 300 };
                });
            });
        }
    });

    // ================================================================
    // 813 — Benedizione di Sebek / Sebek's Blessing (Magia Rapida)
    // Attivabile solo quando un tuo mostro ha attaccato direttamente
    // l'avversario; guadagni Life Points pari al danno da battaglia
    // inflitto. A differenza di una Trappola (che risponde NEL MOMENTO
    // di un evento tramite una finestra di Chain), questa è una Magia
    // Rapida attivata dalla mano DOPO che il danno è già stato
    // inflitto — gameState.directAttackDamageFor[owner] (nuovo,
    // impostato in resolveAttack/actions.js quando un attacco diretto
    // infligge DAVVERO danno, azzerato ad ogni cambio turno) tiene
    // traccia dell'ultimo importo utilizzabile, invece di un vero
    // aggancio reattivo "nel momento" (che qui non serve: il testo reale
    // non richiede una risposta immediata, solo che l'evento sia già
    // accaduto in questo turno).
    // ================================================================
    CardEffects.register(813, {
        canActivate(ctx) {
            return !!(gameState.directAttackDamageFor && gameState.directAttackDamageFor[ctx.owner]);
        },
        activate(ctx) {
            const amount = gameState.directAttackDamageFor && gameState.directAttackDamageFor[ctx.owner];
            if (!amount) return;
            gameState.directAttackDamageFor[ctx.owner] = 0;
            ctx.dealDamage(ctx.owner, -amount);
            ctx.log(`🐊 Benedizione di Sebek: ${ctx.owner === 'player' ? 'guadagni' : 'il bot guadagna'} ${amount} Life Points!`);
        }
    });

    // ================================================================
    // 204 — Sosia (Trappola Continua)
    // Quando subisci danno dall'effetto di un mostro controllato dal tuo
    // avversario: infliggi al tuo avversario lo stesso ammontare di
    // danno. Un'unica volta Set + attivata (activate() qui sotto non fa
    // altro che confermarla scoperta sul Terreno grazie a
    // continuous:true), il vero effetto è un controllo dal vivo dentro
    // ACTIONS.dealDamage (duel-engine.js) — stesso stile "live check sul
    // campo" già usato per Canyon/Statua di Pietra degli Aztechi in
    // resolveBattleDamage (actions.js) — così riflette OGNI volta che la
    // condizione si verifica, non solo una tantum.
    // ================================================================
    CardEffects.register(204, {
        continuous: true,
        activate(ctx) {
            ctx.log('🪞 Sosia si attiva: ora riflette ogni danno da effetto Mostro avversario!');
        }
    });

    // ================================================================
    // 814 — Controllo Mesmerico / Mesmeric Control (Magia Normale)
    // Durante il prossimo turno dell'avversario: non può cambiare la
    // Posizione di Battaglia dei mostri. Nuovo flag
    // gameState.cannotChangePositionFor (per-turno, resettato in
    // changeTurn() — game-flow.js), controllato ovunque un cambio di
    // Posizione viene richiesto dal giocatore/bot.
    // ================================================================
    CardEffects.register(814, {
        activate(ctx) {
            gameState.cannotChangePositionFor = gameState.cannotChangePositionFor || {};
            gameState.cannotChangePositionFor[ctx.opponent] = gameState.turn + 1;
            ctx.log("🌀 Controllo Mesmerico impedisce all'avversario di cambiare Posizione nel suo prossimo turno!");
        }
    });

    // ================================================================
    // 815 — Istinto di Caccia / Hunting Instinct (Trappola Normale)
    // Quando uno o più mostri vengono Special Summonati sul Terreno
    // dell'avversario: Special Summon 1 mostro Dinosauro dalla mano.
    // Riusa la finestra di risposta onOpponentSummon già usata da Buco
    // Trappola (id 40), qui però NON è una risposta immediata alla
    // Chain (nessun canActivate/activate): registrata come reazione
    // diretta tramite lo stesso schema generico.
    // ================================================================
    CardEffects.register(815, {
        canActivate(ctx) {
            return ctx.hand(ctx.owner).some((c) => c.type === 'monster' && c.race === 'Dinosauro') && ctx.findEmptyMonsterSlot(ctx.owner) !== -1;
        },
        onOpponentSummon(ctx) {
            const hand = ctx.hand(ctx.owner);
            const index = hand.findIndex((c) => c.type === 'monster' && c.race === 'Dinosauro');
            if (index === -1) return;
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const [card] = hand.splice(index, 1);
            ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'hand');
            ctx.log(`🦖 Istinto di Caccia Special Summona ${card.name} dalla mano!`);
        }
    });

    // ================================================================
    // 816 — Istinto di Sopravvivenza / Survival Instinct (Trappola
    // Normale)
    // Bandisci un numero qualsiasi di mostri Dinosauro dal Cimitero;
    // guadagna 400 LP per ciascuno.
    // SEMPLIFICAZIONE: bandisce sempre TUTTI i Dinosauro disponibili
    // (nessuna UI di selezione "un numero qualsiasi").
    // ================================================================
    CardEffects.register(816, {
        canActivate(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster' && c.race === 'Dinosauro');
        },
        activate(ctx) {
            const grave = ctx.graveyard(ctx.owner);
            let banished = 0;
            for (let i = grave.length - 1; i >= 0; i--) {
                if (grave[i].type === 'monster' && grave[i].race === 'Dinosauro' && ctx.banishFromGraveyard(ctx.owner, grave[i])) {
                    banished++;
                }
            }
            if (banished === 0) return;
            ctx.dealDamage(ctx.owner, -400 * banished);
            ctx.log(`🦖 Istinto di Sopravvivenza bandisce ${banished} mostr${banished === 1 ? 'o' : 'i'} e guadagna ${400 * banished} Life Points!`);
        }
    });

    // ================================================================
    // 817 — Eruzione Vulcanica / Volcanic Eruption (Trappola Normale)
    // Durante la propria End Phase, se si controlla Mondo Giurassico
    // (id 812): distruggi tutte le carte sul Terreno.
    // ================================================================
    CardEffects.register(817, {
        onEndPhase(ctx) {
            const fieldSpell = Tavolo.magiaTerreno(ctx.owner);
            if (!fieldSpell || fieldSpell.isFaceDown || fieldSpell.card.id !== 812) return;
            let count = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => {
                    if (!slot) return;
                    ctx.graveyard(owner).push(slot.card);
                    ctx.field(owner)[index] = null;
                    count++;
                });
                ctx.stField(owner).forEach((slot, index) => {
                    if (!slot) return;
                    ctx.graveyard(owner).push(slot.card);
                    ctx.stField(owner)[index] = null;
                    count++;
                });
            });
            ctx.log(`🌋 Eruzione Vulcanica distrugge ${count} cart${count === 1 ? 'a' : 'e'} sul Terreno!`);
        }
    });

    // ================================================================
    // 819 — Scudo con Braccio Magico / Magical Arm Shield (Trappola
    // Normale)
    // Attivabile solo quando l'avversario dichiara un attacco mentre
    // controlli un mostro. Prendi il controllo di 1 mostro scoperto
    // dell'avversario, eccetto quello attaccante; viene attaccato al
    // suo posto. Combina 2 meccanismi generici già esistenti — ctx.takeControl
    // (il controllo torna al vero proprietario alla End Phase,
    // processTemporaryControlReturns in duel-engine.js — SEMPLIFICAZIONE
    // già nota di quel meccanismo: "fine Battle Phase" reale diventa
    // "fine turno") e ctx.redirectAttack (già usato da Ragno della
    // Roulette id 425) — calcolando PRIMA lo slot libero su cui il
    // mostro rubato atterrerà, dato che takeControl non restituisce
    // l'indice scelto.
    // SEMPLIFICAZIONE: se l'avversario ha più di un mostro scoperto
    // bersagliabile, sceglie automaticamente il primo trovato invece di
    // offrire una scelta — nessuna UI di selezione bersaglio esiste per
    // questo tipo di hook automatico.
    // ================================================================
    // ================================================================
    // 818 — Onda Sismica / Seismic Wave (Trappola Continua)
    // Attiva quando un mostro Tipo Dinosauro scoperto controllato viene
    // distrutto: blocca 3 Zone Magia/Trappola inutilizzate dell'avversario
    // (nuovo DuelEngine.isSTZoneLocked/findFreeSTSlot, usato ovunque una
    // Zona Magia/Trappola libera viene cercata — setSpellTrap/
    // highlightEmptySlots in actions.js, botSetTrapCard in bot.js,
    // canActivate/activateCard in duel-engine.js). Si autodistrugge alla
    // propria 3ª Standby Phase dopo l'attivazione (contatore
    // ctx.card._sismicStandbyCount, incrementato da onStandbyPhase — già
    // generico per zona 'st', vedi firePhaseTrigger), recuperando 1
    // mostro Dinosauro dal Cimitero alla mano. onSTDestroyed (non
    // onDestroy: quello è riservato ai Mostri) libera le Zone bloccate
    // quando questa carta lascia il campo, in QUALUNQUE modo.
    // SEMPLIFICAZIONE: riusa onOwnMonsterDestroyed (Chain-scelta, come
    // Macchina del Tempo id 478) senza distinguere "tranne durante il
    // Damage Step" — questo motore non modella un sotto-stato distinto
    // per il Damage Step.
    // ================================================================
    CardEffects.register(818, {
        continuous: true,
        onOwnMonsterDestroyed(ctx) {
            if (!ctx.destroyedCard || ctx.destroyedCard.race !== 'Dinosauro') return;
            gameState.lockedSTZonesFor = gameState.lockedSTZonesFor || {};
            gameState.lockedSTZonesFor[ctx.opponent] = gameState.lockedSTZonesFor[ctx.opponent] || new Set();
            const emptyIndices = ctx.stField(ctx.opponent).map((slot, i) => (slot === null ? i : -1)).filter((i) => i !== -1).slice(0, 3);
            emptyIndices.forEach((i) => gameState.lockedSTZonesFor[ctx.opponent].add(i));
            ctx.card._sismicStandbyCount = 0;
            ctx.log(`🌍 Onda d'Urto Sismica blocca ${emptyIndices.length} Zone Magia/Trappola dell'avversario!`);
        },
        onStandbyPhase(ctx) {
            if (ctx.card._sismicStandbyCount == null) return;
            ctx.card._sismicStandbyCount += 1;
            if (ctx.card._sismicStandbyCount < 3) return;
            const opened = searchGraveyardWithChoice(ctx, ctx.owner, (c) => c.race === 'Dinosauro', {
                title: '🌍 Onda d\'Urto Sismica',
                text: 'Scegli quale mostro Dinosauro recuperare dal Cimitero.'
            }, (dino) => {
                ctx.destroySpellTrap(ctx.owner, ctx.index);
                ctx.hand(ctx.owner).push(dino);
                ctx.log(`🌍 Onda d'Urto Sismica si autodistrugge: recupera ${dino.name} dal Cimitero!`);
            });
            if (!opened) {
                ctx.destroySpellTrap(ctx.owner, ctx.index);
                ctx.log('🌍 Onda d\'Urto Sismica si autodistrugge!');
            }
        },
        onSTDestroyed(ctx) {
            if (gameState.lockedSTZonesFor && gameState.lockedSTZonesFor[ctx.opponent]) {
                gameState.lockedSTZonesFor[ctx.opponent].clear();
            }
        }
    });

    CardEffects.register(819, {
        canActivate(ctx) {
            if (!ctx.field(ctx.owner).some(Boolean)) return false;
            const hasTarget = ctx.field(ctx.attackerOwner).some((slot, i) => slot && !slot.isFaceDown && i !== ctx.attackerIndex);
            const hasFreeSlot = ctx.field(ctx.owner).some((s) => s === null);
            return hasTarget && hasFreeSlot;
        },
        // Il mostro da rubare lo sceglie il giocatore: la battaglia aspetta
        // la scelta (chooseFieldCardTargetWaiting, vedi
        // callCardHandlerWaiting in duel-engine.js). Il bot prende il primo
        // mostro scoperto dell'attaccante.
        onAttackDeclare(ctx) {
            if (ctx.field(ctx.owner).findIndex((s) => s === null) === -1) return;
            const attackerSlot = ctx.field(ctx.attackerOwner)[ctx.attackerIndex];
            const candidati = collectFieldTargets(ctx, {
                zone: 'monster', owner: ctx.attackerOwner,
                filter: (card, owner, slot) => slot !== attackerSlot
            });
            chooseFieldCardTargetWaiting(ctx, candidati, {
                title: '🛡️ Scudo da Braccio Magico',
                text: 'Scegli il mostro dell\'avversario da prendere e mettere davanti all\'attacco.',
                dichiara: true
            }, (scelto) => {
                // Riletta adesso: durante la scelta la casella libera
                // potrebbe non esserlo più.
                const freeIndex = ctx.field(ctx.owner).findIndex((s) => s === null);
                if (freeIndex === -1) return;
                const targetSlot = ctx.field(scelto.owner)[scelto.index];
                if (!targetSlot) return;
                const stolenName = targetSlot.card.name;
                if (!ctx.takeControl(ctx.owner, scelto.owner, scelto.index)) return;
                // takeControl mette il mostro nella prima casella libera:
                // è quella letta qui sopra.
                ctx.redirectAttack(freeIndex, ctx.owner);
                ctx.log(`🛡️ Scudo da Braccio Magico prende il controllo di ${stolenName} e lo mette davanti all'attacco!`);
            });
        }
    });

    // ================================================================
    // 820 — Nega Attacco / Negate Attack (Trappola Normale — era
    // registrata due volte in questo dataset, vedi id 392 rimossa: una
    // copia incompleta con subtype 'normal', questa qui completa ma con
    // subtype 'counter' sbagliato, corretto a 'normal' in cards.json.
    // Testo reale: nessuna versione Trappola Contatore di questa carta
    // esiste nel gioco vero).
    // Quando l'avversario dichiara un attacco: annulla l'attacco, poi
    // termina la Battle Phase (ctx.endBattlePhase, lo stesso helper già
    // usato da Tartaruga Elettromagnetica id 223).
    // ================================================================
    CardEffects.register(820, {
        onAttackDeclare(ctx) {
            // "Scegli come bersaglio il mostro attaccante": checkpoint di
            // targeting.
            ctx.declareTargetWaiting(ctx.attackerOwner, ctx.attackerIndex, { totalTargetCount: 1 }, (decl) => {
                if (!decl.allowed) return;
                if (window.FX && typeof FX.playNegateAttack === 'function') {
                    FX.playNegateAttack(ctx.attackerOwner, ctx.attackerIndex);
                }
                ctx.cancelAttack();
                ctx.endBattlePhase();
                ctx.log("🛡️ Annulla Attacco annulla l'attacco e termina la Battle Phase!");
            });
        }
    });

    // ================================================================
    // 821 — Goblin fuori dalla Padella / Goblin Out of the Frying Pan
    // (Trappola Contatore)
    // Paga 500 LP; annulla l'attivazione di una Magia dell'avversario e
    // rimandala in mano. Stesso schema di risposta via Chain di
    // Interferenza Magica (id 361), ma restituisce la carta invece di
    // distruggerla.
    // ================================================================
    /**
     * Toglie la carta appena negata (link.card) da qualunque zona si trovi
     * ATTUALMENTE — il Cimitero, se è già stata scartata come costo
     * dell'attivazione (il caso comune per una Magia/Trappola Normale,
     * spostata lì DENTRO activateCard prima ancora di aprire la Chain), o
     * ancora sul Terreno Magia/Trappola/Magia Terreno, se è Continua e non
     * si è ancora mossa — così chi la nega può rimandarla altrove (mano,
     * Set) invece di lasciarla semplicemente al Cimitero come fa la
     * negazione di default (il ramo "negated" in resolveChain,
     * duel-engine.js, che per una Continua ancora sul Terreno la
     * manderebbe lui stesso al Cimitero: rimuoverla PRIMA da qui, come
     * fatto sotto, rende quel ramo un no-op innocuo — lo slot che
     * controlla è già vuoto). Ritorna true se trovata e rimossa.
     * CORREZIONE: un bug reale di duplicazione — Goblin fuori dalla
     * Padella (id 821) rimandava in mano la Magia negata senza mai
     * toglierla da dove si trovava già, lasciandola sia al Cimitero (o sul
     * Terreno, per una Continua) sia in mano contemporaneamente.
     */
    function removeNegatedCardFromCurrentZone(ctx, link) {
        const grave = ctx.graveyard(link.owner);
        const graveIndex = grave.indexOf(link.card);
        if (graveIndex !== -1) {
            grave.splice(graveIndex, 1);
            return true;
        }
        if (link.ctx && link.ctx.zone === 'st') {
            const stField = ctx.stField(link.owner);
            const slot = stField[link.ctx.index];
            if (slot && slot.card === link.card) {
                stField[link.ctx.index] = null;
                return true;
            }
        }
        if (link.ctx && link.ctx.zone === 'fieldSpell') {
            const fieldKey = Tavolo.chiave(link.owner, 'FieldSpell');
            if (gameState[fieldKey] && gameState[fieldKey].card === link.card) {
                gameState[fieldKey] = null;
                return true;
            }
        }
        return false;
    }

    CardEffects.register(821, {
        canActivate(ctx) {
            const chain = ctx.gameState.chain;
            return !!(chain && chain.links && chain.links.length > 0 && chain.links[chain.links.length - 1].card.type === 'spell' && chain.links[chain.links.length - 1].owner === ctx.opponent);
        },
        activate(ctx) {
            ctx.dealDamage(ctx.owner, 500);
            const chain = ctx.gameState.chain;
            const link = chain.links[chain.links.length - 1];
            if (ctx.negateActivation()) {
                removeNegatedCardFromCurrentZone(ctx, link);
                ctx.hand(link.owner).push(link.card);
                ctx.log('🔥 Goblin Fuori dalla Padella paga 500 LP, annulla e rimanda in mano la Magia avversaria!');
            } else {
                ctx.log('🔥 Goblin Fuori dalla Padella paga 500 LP, ma non c\'era più nulla da annullare.');
            }
        }
    });

    // ================================================================
    // 822 — Malfunzionamento / Malfunction (Trappola Contatore)
    // Paga 500 LP; annulla l'attivazione di una Trappola dell'avversario e
    // rimettila Set nella sua posizione originale (non un semplice
    // "annulla e distruggi" come Interferenza Magica id 361: il testo
    // reale la fa TORNARE Set, non finire al Cimitero). Rimossa dalla sua
    // zona ATTUALE (removeNegatedCardFromCurrentZone qui sopra — per una
    // Trappola Normale, già scartata come costo PRIMA che la Chain si
    // aprisse) e Set di nuovo nella stessa casella se ancora libera,
    // altrimenti nella prima casella Magia/Trappola libera; se non ce n'è
    // nessuna, resta al Cimitero come unico ripiego possibile.
    // setOnTurn è impostato al turno PRECEDENTE (non quello vero e
    // proprio, perso quando la carta ha lasciato il Terreno la prima
    // volta): coerente con l'unico vincolo reale che quel campo fa
    // rispettare in questo motore ("non attivabile lo stesso turno in cui
    // è stata Set"), che una Trappola appena tornata Set da un'attivazione
    // già avvenuta non deve MAI subire di nuovo.
    // ================================================================
    CardEffects.register(822, {
        canActivate(ctx) {
            const chain = ctx.gameState.chain;
            return !!(chain && chain.links && chain.links.length > 0 && chain.links[chain.links.length - 1].card.type === 'trap' && chain.links[chain.links.length - 1].owner === ctx.opponent);
        },
        activate(ctx) {
            ctx.dealDamage(ctx.owner, 500);
            const chain = ctx.gameState.chain;
            const link = chain.links[chain.links.length - 1];
            if (ctx.negateActivation()) {
                removeNegatedCardFromCurrentZone(ctx, link);
                const stField = ctx.stField(link.owner);
                const originalIndex = link.ctx && link.ctx.zone === 'st' ? link.ctx.index : -1;
                const targetIndex = (originalIndex !== -1 && !stField[originalIndex]) ? originalIndex : stField.findIndex((s) => !s);
                if (targetIndex !== -1) {
                    stField[targetIndex] = { card: link.card, isFaceDown: true, setOnTurn: gameState.turn - 1 };
                    ctx.log('⚙️ Malfunzionamento paga 500 LP, annulla la Trappola avversaria e la rimette Set!');
                } else {
                    ctx.graveyard(link.owner).push(link.card);
                    ctx.log('⚙️ Malfunzionamento paga 500 LP e annulla la Trappola avversaria (nessuna casella libera per rimetterla Set: va al Cimitero)!');
                }
            } else {
                ctx.log('⚙️ Malfunzionamento paga 500 LP, ma non c\'era più nulla da annullare.');
            }
        }
    });

    // ================================================================
    // 823 — Scavo Fossile / Fossil Excavation (Trappola Continua)
    // Scarta 1 carta; Special Summon 1 mostro Dinosauro dal Cimitero.
    // Dipendenza reciproca: se questa carta lascia il Terreno, distruggi
    // il mostro; se il mostro viene distrutto, distruggi questa carta
    // (stesso schema targetOwner/targetIndex/targetUid di Incantesimo
    // Ombra id 439/Arte Ninjitsu della Trasformazione id 794). "Annulla
    // gli effetti di quel mostro sul Terreno": marcato ad ogni render in
    // static() tramite gameState.monsterEffectsNegatedUidsFor (Set
    // ricalcolato da zero ad ogni render, quindi la negazione dura
    // esattamente finché entrambe le carte restano in campo — controllato
    // da isMonsterCardEffectsNegated in fireTrigger/duel-engine.js).
    // ================================================================
    CardEffects.register(823, {
        continuous: true,
        canActivate(ctx) {
            if (ctx.hand(ctx.owner).length === 0) return false;
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster' && c.race === 'Dinosauro');
        },
        activate(ctx) {
            const reviveCandidate = ctx.graveyard(ctx.owner).find((c) => c.type === 'monster' && c.race === 'Dinosauro');
            if (!reviveCandidate) return;
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            offerHandDiscardChoice(ctx, {
                title: '🦴 Scavo Fossile',
                text: 'Scegli quale carta scartare dalla mano.'
            }, (discarded) => {
                // Come in Genesi del Vampiro (id 656): il candidato va scelto
                // PRIMA dello scarto, ma indice/slot vanno ricalcolati DOPO,
                // perché discardChosenFromHand/il picker possono innescare
                // reazioni (es. id 781) che alterano il Cimitero prima che
                // questa carta lo rilegga.
                const grave = ctx.graveyard(ctx.owner);
                const index = grave.findIndex((c) => c.uid === reviveCandidate.uid);
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (index === -1 || slotIndex === -1) return;
                const [revived] = grave.splice(index, 1);
                ctx.specialSummon(ctx.owner, revived, slotIndex, 'attack', 'graveyard');
                ctx.card.targetOwner = ctx.owner;
                ctx.card.targetIndex = slotIndex;
                ctx.card.targetUid = revived.uid;
                ctx.log(`🦴 Scavo Fossile scarta ${discarded.name} e Special Summona ${revived.name} dal Cimitero!`);
            });
        },
        static(ctx) {
            if (ctx.card.targetOwner == null) return;
            const targetSlot = ctx.field(ctx.card.targetOwner)[ctx.card.targetIndex];
            const validTarget = targetSlot && !targetSlot.isFaceDown && targetSlot.card.uid === ctx.card.targetUid;
            if (!validTarget) {
                ctx.stField(ctx.owner)[ctx.index] = null;
                ctx.graveyard(ctx.owner).push(ctx.card);
                return;
            }
            gameState.monsterEffectsNegatedUidsFor = gameState.monsterEffectsNegatedUidsFor || { player: new Set(), bot: new Set() };
            gameState.monsterEffectsNegatedUidsFor[ctx.card.targetOwner].add(ctx.card.targetUid);
        }
    });

    // ================================================================
    // Effetto condiviso "se questa carta attacca, l'avversario non può
    // attivare Magie/Trappole fino alla fine del Damage Step"
    // (Drago Gadjiltron Ingranaggio Antico id 824, Ingegnere Ingranaggio
    // Antico id 826, Golem Ingranaggio Antico id 832, Bestia Ingranaggio
    // Antico id 833, Soldato Ingranaggio Antico id 834).
    // SEMPLIFICAZIONE: blocca per il resto del turno (gameState.
    // noTrapActivationFor/noSpellActivationFor), non solo fino alla fine
    // del Damage Step.
    // ================================================================
    function onOwnAttackDeclareBlockSpellsTraps(ctx) {
        gameState.noTrapActivationFor = gameState.noTrapActivationFor || {};
        gameState.noSpellActivationFor = gameState.noSpellActivationFor || {};
        gameState.noTrapActivationFor[ctx.opponent] = true;
        gameState.noSpellActivationFor[ctx.opponent] = true;
        // ctx.card NON esiste in questo contesto (ON_ATTACK_DECLARE, fase
        // "auto-effetto dell'attaccante"): quel nome è riservato, dentro
        // openTriggerWindow, alla carta di chi RISPONDE — vedi il
        // commento a inizio file. La carta attaccante si trova invece
        // tramite ctx.attackerOwner/attackerIndex, sempre presenti qui.
        const attackerSlot = ctx.field(ctx.attackerOwner)[ctx.attackerIndex];
        ctx.log(`⚙️ ${attackerSlot ? attackerSlot.card.name : 'Questa carta'} blocca le Magie/Trappole avversarie per il resto del turno!`);
    }

    // ================================================================
    // 824 — Drago Gadjiltron Ingranaggio Antico / Ancient Gear
    // Gadjiltron Dragon
    // Oltre al blocco condiviso (onOwnAttackDeclareBlockSpellsTraps):
    // "guadagna gli effetti appropriati se la Evochi Normalmente
    // sacrificando questi mostri: Gadget Verde (danno perforante) /
    // Gadget Rosso (+400 danni per QUALUNQUE danno da battaglia
    // inflitto, non solo attacco diretto — diverso da Chimera
    // Gadjiltron id 825) / Gadget Giallo (+600 danni se distrugge un
    // mostro dell'avversario in battaglia)". Stesso
    // pending.card._tributedCardIds di Chimera Gadjiltron qui sopra; il
    // Gadget Verde riusa la stessa infrastruttura di danno perforante
    // per-carta già esistente (gameState.piercingUidsFor, come Impatto
    // Meteora Fatato) invece di reinventarne una.
    // ================================================================
    CardEffects.register(824, {
        onOwnAttackDeclare: onOwnAttackDeclareBlockSpellsTraps,
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            const tributed = ctx.summonedCard._tributedCardIds || [];
            if (tributed.includes(828)) ctx.summonedCard._gadjiltronGreenGadget = true;
            if (tributed.includes(829)) ctx.summonedCard._gadjiltronRedGadget = true;
            if (tributed.includes(830)) ctx.summonedCard._gadjiltronYellowGadget = true;
        },
        static(ctx) {
            if (ctx.card._gadjiltronGreenGadget) {
                gameState.piercingUidsFor[ctx.owner].add(ctx.card.uid);
            }
        },
        onDealsBattleDamage(ctx) {
            if (ctx.card._gadjiltronRedGadget) {
                ctx.dealDamage(ctx.opponent, 400);
                ctx.log('⚙️ Drago Gadjiltron-Ingranaggio Antico (Congegno Rosso): 400 danni extra!');
            }
        },
        onBattled(ctx) {
            if (ctx.card._gadjiltronYellowGadget && ctx.opponentSurvived === false) {
                ctx.dealDamage(ctx.opponent, 600);
                ctx.log('⚙️ Drago Gadjiltron-Ingranaggio Antico (Congegno Giallo): 600 danni extra!');
            }
        }
    });

    // ================================================================
    // 825 — Chimera Gadjiltron Ingranaggio Antico / Ancient Gear
    // Gadjiltron Chimera
    // "Guadagna gli effetti appropriati se la Evochi Normalmente
    // sacrificando questi mostri: Gadget Verde (+300 ATK) / Gadget Rosso
    // (se infligge danno da battaglia con un attacco diretto: +500
    // danni) / Gadget Giallo (se distrugge un mostro dell'avversario in
    // battaglia: +700 danni)" — usa il nuovo
    // pending.card._tributedCardIds (impostato in performTributeSacrifice,
    // actions.js, l'unico punto in cui questo motore sa DAVVERO quali
    // carte sono state sacrificate, non solo quante), letto qui in
    // onSummon per marcare permanentemente quali bonus questa specifica
    // copia ha guadagnato. onBattled con opponentSurvived === false: dato
    // che quel valore letterale compare SOLO nella chiamata per
    // l'attaccante che distrugge (le chiamate per il difensore
    // sopravvissuto passano sempre true), basta da solo a significare
    // "questa carta ha appena distrutto in battaglia il mostro
    // avversario" senza bisogno di controllare altro sul ruolo.
    // ================================================================
    CardEffects.register(825, {
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            const tributed = ctx.summonedCard._tributedCardIds || [];
            if (tributed.includes(828)) ctx.summonedCard._gadjiltronGreenGadget = true;
            if (tributed.includes(829)) ctx.summonedCard._gadjiltronRedGadget = true;
            if (tributed.includes(830)) ctx.summonedCard._gadjiltronYellowGadget = true;
        },
        static(ctx) {
            if (ctx.card._gadjiltronGreenGadget) {
                const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
                gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk + 300, def: e.def };
            }
        },
        onDealsBattleDamage(ctx) {
            if (ctx.card._gadjiltronRedGadget && ctx.targetIndex === -1) {
                ctx.dealDamage(ctx.opponent, 500);
                ctx.log('⚙️ Chimera Gadjiltron-Ingranaggio Antico (Congegno Rosso): 500 danni extra!');
            }
        },
        onBattled(ctx) {
            if (ctx.card._gadjiltronYellowGadget && ctx.opponentSurvived === false) {
                ctx.dealDamage(ctx.opponent, 700);
                ctx.log('⚙️ Chimera Gadjiltron-Ingranaggio Antico (Congegno Giallo): 700 danni extra!');
            }
        }
    });

    // ================================================================
    // 826 — Ingegnere Ingranaggio Antico / Ancient Gear Engineer
    // Oltre al blocco condiviso (onOwnAttackDeclareBlockSpellsTraps):
    // "alla fine del Damage Step, se questa carta ha attaccato: distruggi
    // 1 Magia/Trappola dell'avversario". onBattled(ctx) da solo non basta
    // a saperlo (scatta identico sia per l'attaccante sia per il
    // difensore che sopravvive) — quindi onOwnAttackDeclare marca la
    // carta con un flag auto-consumato, letto e cancellato subito da
    // onBattled. SEMPLIFICAZIONE: sceglie il primo bersaglio trovato
    // invece di offrire una scelta (nessuna UI di selezione bersaglio
    // esiste per questo tipo di hook automatico) e, come ogni altro
    // onBattled in questo file, non scatta su un attacco diretto (nessun
    // "avversario di battaglia" in quel caso).
    // Terza clausola ("annulla gli effetti Trappola che hanno come
    // bersaglio questa carta, e se lo fai, distruggi quella Trappola"):
    // implementata tramite il checkpoint di targeting introdotto per
    // Gran Scudo Gardna/id 115 (ctx.declareTarget, duel-engine.js) —
    // stessa SEMPLIFICAZIONE già documentata lì: coperta solo dagli
    // effetti Carta che chiamano esplicitamente il checkpoint.
    // ================================================================
    CardEffects.register(826, {
        onOwnAttackDeclare(ctx) {
            onOwnAttackDeclareBlockSpellsTraps(ctx);
            const attackerSlot = ctx.field(ctx.attackerOwner)[ctx.attackerIndex];
            if (attackerSlot) attackerSlot.card.ancientGearEngineerAttacked = true;
        },
        onBattled(ctx) {
            if (!ctx.card.ancientGearEngineerAttacked) return;
            delete ctx.card.ancientGearEngineerAttacked;
            const index = ctx.stField(ctx.opponent).findIndex((slot) => slot);
            if (index === -1) return;
            const targetName = ctx.stField(ctx.opponent)[index].card.name;
            ctx.destroySpellTrap(ctx.opponent, index);
            ctx.log(`⚙️ Ingegnere-Ingranaggio Antico distrugge ${targetName} alla fine del Damage Step!`);
        },
        canActivate(ctx) {
            if (ctx.zone !== 'monster') return false;
            return ctx.sourceType === 'trap';
        },
        onCardEffectTargetDeclare(ctx) {
            ctx.cancel();
            if (ctx.sourceCard) {
                // Se la Trappola sorgente è ancora scoperta sul Terreno (una
                // Continua, o una Normale non ancora mandata al Cimitero),
                // distruggila davvero — se è già andata al Cimitero come
                // parte della sua stessa attivazione (caso comune per una
                // Trappola Normale in questo motore), non c'è altro da fare.
                const idx = ctx.stField(ctx.sourceOwner).findIndex((s) => s && s.card.uid === ctx.sourceCard.uid);
                if (idx !== -1) ctx.destroySpellTrap(ctx.sourceOwner, idx);
            }
            ctx.log(`⚙️ ${ctx.card.name} annulla e distrugge la Trappola che la bersaglia!`);
        }
    });

    // ================================================================
    // 827 — Soldato di Avvio - Dinamo del Terrore / Boot-Up Soldier -
    // Dread Dynamo (statico)
    // Finché si controlla un mostro "Gadget": +2000 ATK.
    // ================================================================
    CardEffects.register(827, {
        static(ctx) {
            const hasGadget = ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && [828, 829, 830].includes(s.card.id));
            if (!hasGadget) return;
            const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk + 2000, def: e.def };
        }
    });

    // ================================================================
    // Effetto condiviso di ricerca nel Deck per la catena dei Gadget
    // (Verde id 828 → Rosso id 829 → Giallo id 830 → Verde...).
    // ================================================================
    function searchGadgetToHand(ctx, targetId, targetName) {
        const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
        const deck = gameState[deckKey];
        if (!Array.isArray(deck)) return;
        const index = deck.findIndex((c) => c.id === targetId);
        if (index === -1) return;
        const card = deck.splice(index, 1)[0];
        gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
        ctx.hand(ctx.owner).push(card);
        ctx.log(`⚙️ ${ctx.card.name} aggiunge ${card.name} alla mano dal Deck!`);
    }
    CardEffects.register(828, {
        onSummon(ctx) { searchGadgetToHand(ctx, 829, 'Congegno Rosso'); },
        onSpecialSummon(ctx) { searchGadgetToHand(ctx, 829, 'Congegno Rosso'); }
    });
    CardEffects.register(829, {
        onSummon(ctx) { searchGadgetToHand(ctx, 830, 'Congegno Giallo'); },
        onSpecialSummon(ctx) { searchGadgetToHand(ctx, 830, 'Congegno Giallo'); }
    });
    CardEffects.register(830, {
        onSummon(ctx) { searchGadgetToHand(ctx, 828, 'Congegno Verde'); },
        onSpecialSummon(ctx) { searchGadgetToHand(ctx, 828, 'Congegno Verde'); }
    });

    // ================================================================
    // 831 — Piattaforma di Supporto Mech Pesante / Heavy Mech Support
    // Platform (Mostro Union)
    // Effetto Ignition dalla zona Mostro: si aggancia a un mostro Tipo
    // Macchina che si controlla, dandogli +500 ATK/DEF. SEMPLIFICAZIONE:
    // manca "se il mostro equipaggiato verrebbe distrutto in battaglia o
    // da un effetto Carta, questa carta viene distrutta al suo posto" —
    // richiederebbe un aggancio generico di redirezione della distruzione
    // verso una Carta Equipaggiamento specifica, non ancora presente.
    // ================================================================
    CardEffects.register(831, {
        isUnion: true,
        isEquip: true,
        unionTargetFilter: (c) => c.race === 'Macchina',
        canActivate(ctx) {
            return findEquipTarget(ctx, (c) => c.uid !== ctx.card.uid && c.race === 'Macchina') !== -1;
        },
        activate(ctx) {
            attachUnionMonster(ctx, (c) => c.race === 'Macchina');
        },
        static(ctx) {
            if (!ctx.card.equippedToOwner) return;
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 500, def: e.def + 500 };
        }
    });

    // ================================================================
    // 832 — Golem Ingranaggio Antico / Ancient Gear Golem
    // Danno perforante + blocco Magie/Trappole quando attacca.
    // ================================================================
    CardEffects.register(832, { piercing: true, onOwnAttackDeclare: onOwnAttackDeclareBlockSpellsTraps });

    // ================================================================
    // 833 — Bestia Ingranaggio Antico / Ancient Gear Beast
    // "Annulla gli effetti di un mostro dell'avversario distrutto in
    // battaglia da questa carta (anche nel Cimitero)": onDestroysMonsterInBattle
    // (actions.js) marca il bersaglio sia in gameState.monsterEffectsNegatedUidsFor
    // (nega subito il suo eventuale onDestroy/auto-effetto, controllato da
    // isMonsterCardEffectsNegated in fireTrigger) sia in
    // gameState.negatedEffectsForeverUids (persiste ANCHE nel Cimitero,
    // controllato da findTriggerCandidates per l'unica carta di questo
    // dataset attivabile dal Cimitero, id 223).
    // ================================================================
    CardEffects.register(833, {
        onOwnAttackDeclare: onOwnAttackDeclareBlockSpellsTraps,
        onDestroysMonsterInBattle(ctx) {
            if (!ctx.destroyedCard) return;
            gameState.monsterEffectsNegatedUidsFor = gameState.monsterEffectsNegatedUidsFor || { player: new Set(), bot: new Set() };
            gameState.monsterEffectsNegatedUidsFor[ctx.opponent].add(ctx.destroyedCard.uid);
            gameState.negatedEffectsForeverUids = gameState.negatedEffectsForeverUids || new Set();
            gameState.negatedEffectsForeverUids.add(ctx.destroyedCard.uid);
            ctx.log(`⚙️ ${ctx.card.name} annulla gli effetti di ${ctx.destroyedCard.name}, anche nel Cimitero!`);
        }
    });

    // ================================================================
    // 834 — Soldato Ingranaggio Antico / Ancient Gear Soldier
    // ================================================================
    CardEffects.register(834, { onOwnAttackDeclare: onOwnAttackDeclareBlockSpellsTraps });

})();
