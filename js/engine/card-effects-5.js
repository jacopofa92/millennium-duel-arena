/**
 * card-effects-5.js — Effetti delle carte, parte 5 di 8.
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

    const { collectEquipTargets, chooseFieldCardTargetWaiting, attendiScelta, otherHandCards, blockBanishFromField, findEquipTarget, equipToChosenTarget, attachEquip, equippedTarget, searchDeckWithChoice, searchGraveyardWithChoice, chooseFieldCardTarget, chooseFieldMonsterTarget, collectFieldTargets, offerHandDiscardChoice, chooseCardFromHand, banishFromGraveyardWithChoice, resolveSpecialSummonBanishCost } = window.CardEffectsShared;

    // ================================================================
    // 631 — Megamorfosi / Megamorph (Equipaggiamento)
    // Finché i propri LP sono inferiori a quelli dell'avversario: l'ATK
    // del mostro equipaggiato raddoppia. Finché sono superiori: si
    // dimezza. Stesso schema base delle altre Carte Equipaggiamento
    // (findEquipTarget/attachEquip/isEquip), ma con un bonus DINAMICO
    // (dipendente dal confronto LP ad ogni render) invece che fisso.
    // ================================================================
    CardEffects.register(631, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, () => true) !== -1; },
        activate(ctx) { equipToChosenTarget(ctx); },
        isEquip: true,
        static(ctx) {
            const target = equippedTarget(ctx);
            const ownLP = Tavolo.lp(ctx.owner);
            const oppLP = Tavolo.lp(ctx.opponent);
            const e = gameState.atkDefBonus[target.uid] || { atk: 0, def: 0 };
            let atkDelta = 0;
            if (ownLP < oppLP) atkDelta = target.attack; // raddoppia: +100%
            else if (ownLP > oppLP) atkDelta = -Math.floor(target.attack / 2); // dimezza: -50%
            gameState.atkDefBonus[target.uid] = { atk: e.atk + atkDelta, def: e.def };
        }
    });

    // ================================================================
    // 632 — Nobile del Depistaggio / Nobleman of Crossout (Magia Normale)
    // Scegli come bersaglio 1 mostro coperto sul Terreno; distruggilo e,
    // se lo fai, bandiscilo. Distrugge davvero (ctx.destroyMonster: passa
    // dal Cimitero, fa scattare ON_DESTROY come una distruzione vera),
    // poi lo toglie subito dal Cimitero per bandirlo (ctx.banish) —
    // stesso ordine del testo reale "distruggilo e, se lo fai, bandiscilo".
    // "Se era un mostro Flip (card.subtype === 'flip'), entrambi i
    // giocatori rivelano il proprio Deck e bandiscono tutte le copie con
    // lo stesso nome": DuelEngineUI.openCardListPicker(selectable:false)
    // per la rivelazione (stesso componente già usato da id 589 Grande
    // Occhio/id 86 Amazzone Maestra delle Catene per lo stesso scopo di
    // "guardare" un mazzo/una mano) — SCOPERTA: la nota precedente diceva
    // che questo effetto non fosse supportato, ma il componente esisteva
    // già per altre carte.
    // ================================================================
    CardEffects.register(632, {
        declaredTargeting: { count: 1, cardType: 'monster' },
        canActivate(ctx) {
            return [ctx.owner, ctx.opponent].some((owner) => ctx.field(owner).some((s) => s && s.isFaceDown));
        },
        activate(ctx) {
            const candidates = [];
            [ctx.opponent, ctx.owner].forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => { if (slot && slot.isFaceDown) candidates.push({ owner, index }); });
            });
            if (candidates.length === 0) return;
            const choice = candidates[0];
            ctx.declareTargetWaiting(choice.owner, choice.index, { totalTargetCount: 1 }, (decl) => {
            if (!decl.allowed) return;
            const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
            if (!finalSlot) return;
            const card = finalSlot.card;
            const wasFlipMonster = card.subtype === 'flip';
            ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
            const alsoBanished = ctx.banishFromGraveyard(decl.targetOwner, card);
            ctx.log(alsoBanished
                ? `⚔️ Nobiluomo dello Scambio distrugge e bandisce ${card.name}!`
                : `⚔️ Nobiluomo dello Scambio distrugge ${card.name}!`);
            if (!wasFlipMonster) return;
            // Istantanea PRIMA del bando (per la rivelazione): il vero
            // testo mostra il Deck completo, poi bandisce quello che
            // trova — mostrare lo stato "prima" è più fedele che
            // mostrare il Deck già ripulito delle copie appena bandite.
            const revealSnapshots = { player: (gameState.playerDeck || []).slice(), bot: (gameState.botDeck || []).slice() };
            Tavolo.ordine().forEach((owner) => {
                const deck = Tavolo.mazzo(owner);
                if (!Array.isArray(deck)) return;
                const matches = deck.filter((c) => c.name === card.name);
                if (matches.length === 0) return;
                matches.forEach((c) => {
                    const idx = deck.indexOf(c);
                    if (idx !== -1) { deck.splice(idx, 1); ctx.banish(owner, c); }
                });
                gameState[Tavolo.chiave(owner, 'DeckCount')] = deck.length;
                ctx.log(`⚔️ Nobiluomo dello Scambio bandisce ${matches.length} copi${matches.length === 1 ? 'a' : 'e'} di ${card.name} dal Deck ${owner === 'player' ? 'tuo' : 'del bot'}!`);
            });
            // I due box si mostrano IN SEQUENZA (il secondo si apre solo
            // alla chiusura del primo): openCardListPicker chiude sempre
            // il popover precedente all'apertura, mostrarli insieme
            // farebbe sparire il primo prima che il giocatore lo veda.
            if (Decisioni.rispondeUnaPersona(ctx.owner) && Array.isArray(gameState.playerDeck)) {
                const showBotDeck = () => {
                    if (!Array.isArray(gameState.botDeck)) return;
                    Decisioni.chiedi({
                        chi: ctx.owner,
                        tipo: 'presa-visione',
                        candidati: revealSnapshots.bot,
                        titolo: '⚔️ Nobiluomo dello Scambio',
                        testo: "Il Deck dell'avversario (rivelato per cercare altre copie).",
                        vuota: "Il Deck dell'avversario è vuoto."
                    }, () => {});
                };
                Decisioni.chiedi({
                    chi: ctx.owner,
                    tipo: 'presa-visione',
                    candidati: revealSnapshots.player,
                    titolo: '⚔️ Nobiluomo dello Scambio',
                    testo: 'Il tuo Deck (rivelato per cercare altre copie).',
                    vuota: 'Il tuo Deck è vuoto.'
                }, showBotDeck);
            }
            });
        }
    });

    // ================================================================
    // 633 — Sepoltura Prematura / Premature Burial (Equipaggiamento)
    // Paga 800 Life Points, poi Special Summon 1 mostro dal proprio
    // Cimitero in Posizione di Attacco, equipaggiato con questa carta.
    // Nessun bonus ATK/DEF (a differenza delle altre Carte
    // Equipaggiamento di questo file). "Quando questa carta viene
    // distrutta, distruggi il mostro equipaggiato" — la direzione
    // OPPOSTA di Spada Fusione Lama Murasame (id 726, che protegge SE
    // STESSA): qui invece è questa carta a portarsi dietro il bersaglio
    // quando lei stessa viene distrutta, tramite onSTDestroyed/
    // ctx.destroySpellTrap. La direzione STANDARD (se il bersaglio
    // sparisce, questa carta si stacca) resta comunque garantita da
    // equippedTarget()/static() come per le altre Equip.
    // ================================================================
    CardEffects.register(633, {
        continuous: true,
        canActivate(ctx) {
            if (Tavolo.lp(ctx.owner) <= 800) return false;
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster') && ctx.findEmptyMonsterSlot(ctx.owner) !== -1;
        },
        activate(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            // Con due o più mostri nel Cimitero la scelta è asincrona e la
            // carta aspetta nella sua casella senza aggancio: stesso bug
            // corretto in equipToChosenTarget (card-effects.js), la pulizia
            // degli Equip orfani la mandava al Cimitero prima del tocco.
            // `equipInScelta` la protegge, l'attesa si chiede qui (parte
            // sincrona) e si chiude a scelta fatta.
            const equip = ctx.card;
            const fine = attendiScelta(ctx);
            equip.equipInScelta = true;
            const sceltaChiusa = () => { delete equip.equipInScelta; fine(); };
            const aperta = searchGraveyardWithChoice(ctx, ctx.owner, (c) => c.type === 'monster', {
                title: '⚰️ Sepoltura Prematura',
                text: 'Scegli quale mostro Special Summonare dal Cimitero.'
            }, (card) => {
                try {
                    const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                    if (slotIndex === -1) { ctx.graveyard(ctx.owner).push(card); return; }
                    ctx.dealDamage(ctx.owner, 800);
                    ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'graveyard');
                    equip.equippedToOwner = ctx.owner;
                    equip.equippedToIndex = slotIndex;
                    equip.equippedToUid = card.uid;
                    ctx.log(`⚰️ Sepoltura Prematura paga 800 Life Points e Special Summona ${card.name} dal Cimitero!`);
                } finally {
                    sceltaChiusa();
                }
            });
            if (aperta === false) sceltaChiusa();
        },
        isEquip: true,
        static(ctx) {
            equippedTarget(ctx); // valida/pulisce la dipendenza come le altre Equip (nessun bonus statistico qui)
        },
        onSTDestroyed(ctx) {
            if (!ctx.card.equippedToUid) return;
            const field = ctx.field(ctx.card.equippedToOwner);
            const index = ctx.card.equippedToIndex;
            const slot = field[index];
            if (!slot || slot.card.uid !== ctx.card.equippedToUid) return;
            const name = slot.card.name;
            ctx.destroyMonster(ctx.card.equippedToOwner, index);
            ctx.log(`⚰️ Sepoltura Prematura distrutta: ${name} viene distrutto con lei!`);
        }
    });

    // ================================================================
    // 635 — Vaso dell'Ingordigia / Jar of Greed (Trappola Normale)
    // Pesca 1 carta. Corretta in questa sessione (audit generale sui
    // duplicati, stesso metodo che ha trovato id 392/820): una sessione
    // precedente l'aveva "corretta" da Trappola/pesca-1 a Magia/pesca-2,
    // ragionando che il nome italiano "Giara della Cupidigia" traduce
    // letteralmente "Pot of Greed" — ma "Vaso"/"Ingordigia" non
    // distinguono Pot da Jar in italiano, e i commenti nei vari mazzi
    // Structure Deck di questo stesso dataset (js/data/
    // starter-structure-decks.js, es. "SKE-047 Vaso dell'Ingordigia /
    // Jar of Greed") confermano che questa carta è davvero Jar of Greed,
    // una Trappola reale distinta da Pot of Greed (id 36, Vaso
    // dell'Avidità, Magia/pesca-2, corretto e invariato) — non la stessa
    // carta duplicata due volte. La "correzione" precedente era quindi
    // essa stessa l'errore: ripristinato type/subtype/effetto reali.
    // ================================================================
    CardEffects.register(635, {
        activate(ctx) {
            ctx.drawCards(ctx.owner, 1);
            ctx.log("🏺 Giara della Cupidigia pesca 1 carta!");
        }
    });

    // ================================================================
    // 636 — Campo di Riryoku / Riryoku Field (Trappola Contatore)
    // Quando una Magia dell'avversario che bersaglia ESATTAMENTE 1 mostro
    // sul Terreno (e nessun'altra carta) viene attivata: annulla la sua
    // attivazione e, se lo fai, distruggila. Stesso schema di risposta
    // via Chain di Interferenza Magica (id 361) qui sopra, ma senza costo
    // di scarto e con la condizione di bersaglio verificata davvero
    // tramite declaredTargeting (vedi il commento su questo campo in
    // cima al file) invece di rispondere a QUALSIASI Magia.
    // ================================================================
    CardEffects.register(636, {
        canActivate(ctx) {
            const chain = ctx.gameState.chain;
            if (!chain || !chain.links || chain.links.length === 0) return false;
            const top = chain.links[chain.links.length - 1];
            if (top.card.type !== 'spell' || top.owner !== ctx.opponent) return false;
            const dt = top.def && top.def.declaredTargeting;
            return !!dt && dt.count === 1 && dt.cardType === 'monster';
        },
        activate(ctx) {
            if (ctx.negateActivation()) {
                ctx.log("⚡ Terreno Riryoku annulla e distrugge l'attivazione della Magia avversaria!");
            } else {
                ctx.log('⚡ Terreno Riryoku non trova più nulla da annullare.');
            }
        }
    });

    // ================================================================
    // 637 — Tribù dei D. / D. Tribe (Trappola Normale)
    // Tutti i mostri sul proprio Terreno diventano Tipo Drago fino alla
    // End Phase — ctx.overrideRaceUntilEndOfTurn (duel-engine.js)
    // ripristina il Tipo originale lì (enterEndPhase, game-flow.js). Copre
    // sia i mostri già scoperti al momento dell'attivazione (snapshot qui
    // sotto) sia quelli Evocati DOPO, tramite gameState.raceOverrideFloodgateFor
    // (impostato qui, consultato in fireTrigger — duel-engine.js — ad ogni
    // Evocazione successiva di questo stesso proprietario, dato che questa
    // Trappola Normale è già in Cimitero e non riceve più trigger propri).
    // ================================================================
    CardEffects.register(637, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown);
        },
        activate(ctx) {
            let count = 0;
            ctx.field(ctx.owner).forEach((slot) => {
                if (slot && !slot.isFaceDown) { ctx.overrideRaceUntilEndOfTurn(slot.card, 'Drago'); count++; }
            });
            gameState.raceOverrideFloodgateFor = gameState.raceOverrideFloodgateFor || {};
            gameState.raceOverrideFloodgateFor[ctx.owner] = 'Drago';
            ctx.log(`🐲 Tribù D. rende ${count} mostr${count === 1 ? 'o' : 'i'} Tipo Drago!`);
        }
    });

    // ================================================================
    // 638 — Drago Oscurità Occhi Rossi / Red-Eyes Darkness Dragon
    // Special Summon dalla mano sacrificando 1 "Drago Nero Occhi Rossi"
    // (id 12). Guadagna 300 ATK per ogni mostro Tipo Drago nel proprio
    // Cimitero. Stesso schema Special-Summon-con-tributo-specifico di
    // Drago Toon Occhi Blu (id 123)/Manga Ryu-Ran (id 606), qui con UN
    // solo tributo invece di 2, e un bonus statico invece che nessuno.
    // ================================================================
    CardEffects.register(638, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.id === 12);
        },
        paySpecialSummonCost(ctx) {
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && !slot.isFaceDown && slot.card.id === 12);
            if (index === -1) return false;
            ctx.graveyard(ctx.owner).push(field[index].card);
            field[index] = null;
            ctx.log('🐉 Drago Oscuro Occhi Rossi sacrifica Drago Nero Occhi Rossi per essere Special Summonato!');
            return true;
        },
        static(ctx) {
            const dragonCount = ctx.graveyard(ctx.owner).filter((c) => c.type === 'monster' && c.race === 'Drago').length;
            const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk + dragonCount * 300, def: e.def };
        }
    });

    // ================================================================
    // 640 — Drago Armato LV3 / Armed Dragon LV3
    // Durante la propria Standby Phase: manda questa carta al Cimitero e
    // Special Summon Drago Armato LV5 (id 641) da mano o Deck.
    // SEMPLIFICAZIONE: firePhaseTrigger() chiama onStandbyPhase in modo
    // incondizionato (nessuna vera scelta "puoi" — stesso spirito di
    // molti altri effetti automatici di questo motore), quindi si
    // attiva sempre se Drago Armato LV5 è disponibile.
    // ================================================================
    CardEffects.register(640, {
        onStandbyPhase(ctx) {
            const hand = ctx.hand(ctx.owner);
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            let evolved = null;
            // La zona si segna dove si pesca davvero: il Cimitero qui
            // sotto riceve QUESTA carta, non quella evocata, e confondere
            // le due e' esattamente l'errore da evitare.
            let zonaEvolved = null;
            const handIdx = hand.findIndex((c) => c.id === 641);
            if (handIdx !== -1) {
                [evolved] = hand.splice(handIdx, 1);
                zonaEvolved = 'hand';
            } else if (Array.isArray(deck)) {
                const deckIdx = deck.findIndex((c) => c.id === 641);
                if (deckIdx !== -1) {
                    [evolved] = deck.splice(deckIdx, 1);
                    zonaEvolved = 'deck';
                    gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
                }
            }
            if (!evolved) return;
            const field = ctx.field(ctx.owner);
            field[ctx.slotIndex] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) {
                ctx.graveyard(ctx.owner).push(evolved);
                ctx.log('⚠️ Il Terreno è pieno: Drago Armato LV5 finisce nel Cimitero.');
                return;
            }
            ctx.specialSummon(ctx.owner, evolved, slotIndex, 'attack', zonaEvolved);
            ctx.log('🐉 Drago Armato LV3 si manda al Cimitero ed evolve in Drago Armato LV5!');
        }
    });

    // ================================================================
    // 641 — Drago Armato LV5 / Armed Dragon LV5 (Ignition)
    // Manda 1 mostro dalla mano al Cimitero; distruggi 1 mostro
    // dell'avversario con ATK minore o uguale a quello del mostro
    // mandato al Cimitero.
    // SEMPLIFICAZIONE: sceglie da sola quale mostro scartare (il primo
    // in mano) e quale mostro avversario distruggere (quello con ATK più
    // alto tra i legali), invece di un'interfaccia di selezione dedicata.
    // Evoluzione in Drago Armato LV7 (id 864, aggiunta al database
    // apposta per questo): stesso schema esatto già usato da Spadaccino
    // Mistico LV2->LV4 (id 718) qui sotto — onDestroysMonsterInBattle
    // (applyBattleDestroyBonus, actions.js — SOLO una vittoria in
    // battaglia vera, mai un'attivazione dell'Ignition qui sopra) stampa
    // il turno su ctx.card._armedDragonEvolveTurn, onEndPhase lo
    // controlla e Special Summona LV7 da mano o Deck mandando questa
    // carta al Cimitero.
    // ================================================================
    CardEffects.register(641, {
        onDestroysMonsterInBattle(ctx) {
            ctx.card._armedDragonEvolveTurn = gameState.turn;
        },
        onEndPhase(ctx) {
            if (ctx.card._armedDragonEvolveTurn !== gameState.turn) return;
            let evolved = null;
            const hand = ctx.hand(ctx.owner);
            let zonaEvolved = null;
            const handIdx = hand.findIndex((c) => c.id === 864);
            if (handIdx !== -1) { [evolved] = hand.splice(handIdx, 1); zonaEvolved = 'hand'; }
            else {
                const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
                const deck = gameState[deckKey];
                if (Array.isArray(deck)) {
                    const deckIdx = deck.findIndex((c) => c.id === 864);
                    if (deckIdx !== -1) {
                        [evolved] = deck.splice(deckIdx, 1);
                        zonaEvolved = 'deck';
                        gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
                    }
                }
            }
            if (!evolved) return;
            const field = ctx.field(ctx.owner);
            const selfIndex = field.findIndex((s) => s && s.card.uid === ctx.card.uid);
            if (selfIndex === -1) return;
            field[selfIndex] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) { ctx.graveyard(ctx.owner).push(evolved); return; }
            ctx.specialSummon(ctx.owner, evolved, slotIndex, 'attack', zonaEvolved);
            ctx.log('🐉 Drago Armato LV5 si manda al Cimitero ed evolve in Drago Armato LV7!');
        },
        canActivate(ctx) {
            const hand = ctx.hand(ctx.owner);
            if (hand.length === 0) return false;
            const maxAtk = Math.max(...hand.filter((c) => c.type === 'monster').map((c) => c.attack || 0), -1);
            if (maxAtk === -1) return false;
            return ctx.field(ctx.opponent).some((s) => s && !s.isFaceDown && DuelEngine.getEffectiveAtk(s.card) <= maxAtk);
        },
        activate(ctx) {
            // La carta reale manda 1 MOSTRO (non una qualunque carta) dalla
            // mano al Cimitero — bug reale corretto insieme alla vera scelta:
            // il vecchio codice sceglieva "la carta con ATK più alto in
            // mano" su OGNI carta, mostro o no, quindi con mano di sole
            // Magie/Trappole (attack sempre undefined -> 0) ne avrebbe
            // scartata una a caso violando il testo reale.
            offerHandDiscardChoice(ctx, {
                filter: (c) => c.type === 'monster',
                title: '🐉 Drago Armato LV5',
                text: 'Scegli quale mostro mandare al Cimitero dalla mano.'
            }, (discarded) => {
                const bestAtk = discarded.attack || 0;
                const field = ctx.field(ctx.opponent);
                let targetIndex = -1, targetAtk = -1;
                field.forEach((s, i) => {
                    if (!s || s.isFaceDown) return;
                    const atk = DuelEngine.getEffectiveAtk(s.card);
                    if (atk <= bestAtk && atk > targetAtk) { targetAtk = atk; targetIndex = i; }
                });
                if (targetIndex === -1) return;
                const decl = ctx.declareTarget(ctx.opponent, targetIndex, { totalTargetCount: 1 });
                if (!decl.allowed) return;
                const targetSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!targetSlot) return;
                const name = targetSlot.card.name;
                ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                ctx.log(`🐉 Drago Armato LV5 scarta ${discarded.name} e distrugge ${name}!`);
            });
        }
    });

    // ================================================================
    // 864 — Drago Armato LV7 / Armed Dragon LV7 (Ignition)
    // Carta AGGIUNTA al database apposta per completare l'evoluzione di
    // Drago Armato LV5 (id 641, vedi lì). Non può essere Evocata
    // Normalmente/Set (cannotNormalSummon) — arriva SOLO tramite
    // ctx.specialSummon dall'onEndPhase di id 641, mai da
    // canSpecialSummonFromHand/paySpecialSummonCost. Manda 1 mostro dalla
    // mano al Cimitero; distruggi TUTTI i mostri controllati
    // dall'avversario con ATK minore o uguale a quello del mostro
    // mandato al Cimitero — a differenza di LV5 (un solo bersaglio
    // scelto), qui è un vero effetto di massa senza scelta di bersaglio,
    // quindi non passa dal checkpoint ctx.declareTarget (per lo stesso
    // motivo già escluso da questo checkpoint in tutta la sessione: "non
    // da un effetto che agisce su un mostro senza sceglierlo").
    // SEMPLIFICAZIONE: sceglie da sola quale mostro scartare (quello con
    // ATK più alto in mano), stesso schema di LV5.
    // ================================================================
    CardEffects.register(864, {
        cannotNormalSummon: true,
        canActivate(ctx) {
            const hand = ctx.hand(ctx.owner);
            if (hand.length === 0) return false;
            const maxAtk = Math.max(...hand.filter((c) => c.type === 'monster').map((c) => c.attack || 0), -1);
            if (maxAtk === -1) return false;
            return ctx.field(ctx.opponent).some((s) => s && !s.isFaceDown && DuelEngine.getEffectiveAtk(s.card) <= maxAtk);
        },
        activate(ctx) {
            // Stesso identico bug/fix del costo di LV5 (id 641) qui sopra:
            // "1 mostro dalla mano", vera scelta invece del più alto ATK
            // trovato su QUALSIASI carta in mano.
            offerHandDiscardChoice(ctx, {
                filter: (c) => c.type === 'monster',
                title: '🐉 Drago Armato LV7',
                text: 'Scegli quale mostro mandare al Cimitero dalla mano.'
            }, (discarded) => {
                const bestAtk = discarded.attack || 0;
                let count = 0;
                ctx.field(ctx.opponent).forEach((s, i) => {
                    if (!s || s.isFaceDown) return;
                    if (DuelEngine.getEffectiveAtk(s.card) <= bestAtk) {
                        ctx.destroyMonster(ctx.opponent, i);
                        count++;
                    }
                });
                ctx.log(`🐉 Drago Armato LV7 scarta ${discarded.name} e distrugge ${count} mostr${count === 1 ? 'o' : 'i'} dell'avversario!`);
            });
        }
    });

    // ================================================================
    // 642 — Cucciolo del Drago Nero / Black Dragon's Chick (Ignition)
    // Manda questa carta scoperta al Cimitero; Special Summon 1 "Drago
    // Nero Occhi Rossi" (id 12) dalla mano.
    // ================================================================
    CardEffects.register(642, {
        canActivate(ctx) {
            return ctx.hand(ctx.owner).some((c) => c.id === 12);
        },
        activate(ctx) {
            const hand = ctx.hand(ctx.owner);
            const handIdx = hand.findIndex((c) => c.id === 12);
            if (handIdx === -1) return;
            const [redEyes] = hand.splice(handIdx, 1);
            const field = ctx.field(ctx.owner);
            field[ctx.slotIndex] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) {
                ctx.graveyard(ctx.owner).push(redEyes);
                ctx.log('⚠️ Il Terreno è pieno: Drago Nero Occhi Rossi finisce nel Cimitero.');
                return;
            }
            // Dalla MANO: il Cimitero qui sopra riceve Cucciolo del Drago
            // Nero, cioe' il costo, non il Drago evocato.
            ctx.specialSummon(ctx.owner, redEyes, slotIndex, 'attack', 'hand');
            ctx.log('🥚 Cucciolo di Occhi-Rossi si sacrifica e Special Summona Drago Nero Occhi Rossi!');
        }
    });

    // ================================================================
    // 643 — Drago Elementale / Element Dragon
    // Se sul Terreno (di entrambi i giocatori) è presente un mostro di
    // Attributo FUOCO: guadagna 500 ATK. Se è presente un mostro VENTO e
    // questa carta distrugge un mostro dell'avversario in battaglia: può
    // attaccare di nuovo — slot.extraAttackGranted (stesso meccanismo
    // già usato da Riavvolgimento Toon id 485), concesso da onBattled
    // (scatta solo se questa carta è sopravvissuta alla battaglia;
    // !ctx.opponentSurvived conferma che ha anche distrutto l'avversario).
    // ================================================================
    CardEffects.register(643, {
        static(ctx) {
            const hasFire = Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown && s.card.attribute === 'FUOCO'));
            if (!hasFire) return;
            const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk + 500, def: e.def };
        },
        onBattled(ctx) {
            if (ctx.opponentSurvived) return;
            const hasWind = Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown && s.card.attribute === 'VENTO'));
            if (!hasWind) return;
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((s) => s && s.card.uid === ctx.card.uid);
            if (index === -1) return;
            field[index].extraAttackGranted = true;
            ctx.log('🐉 Drago Elementale può attaccare di nuovo grazie a un mostro VENTO sul Terreno!');
        }
    });

    // ================================================================
    // 644 — Drago Mascherato / Masked Dragon (onDestroy — distrutto in
    // battaglia)
    // Quando distrutta in battaglia: Special Summon 1 mostro Tipo Drago
    // con 1500 o meno ATK dal Deck — vera scelta tramite
    // searchDeckWithChoice, stesso schema di Ratto Gigante (id 614).
    // ================================================================
    CardEffects.register(644, {
        onDestroy(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.race === 'Drago' && c.attack <= 1500, {
                title: '🐲 Drago Mascherato',
                text: 'Scegli quale mostro Drago (1500 ATK o meno) Special Summonare dal Deck.'
            }, (card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                const evoca = (posizione) => {
                    // Può essersi riempita una casella nel frattempo: si ricalcola.
                    const casella = ctx.findEmptyMonsterSlot(ctx.owner);
                    if (casella === -1) return;
                    ctx.specialSummon(ctx.owner, card, casella, posizione, 'deck', { faceUp: true });
                    ctx.log(`🐲 Drago Mascherato Special Summona ${card.name} dal Deck in Posizione di ${posizione === 'attack' ? 'Attacco' : 'Difesa'}!`);
                };
                // Il testo non fissa la Posizione: la sceglie chi controlla la
                // Special Summon (stesso schema di Rinascita del Mostro, id 35).
                // L'IA resta in Attacco.
                if (!Decisioni.rispondeUnaPersona(ctx.owner)) { evoca('attack'); return; }
                const boardId = ctx.owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
                const ancora = PortaUI.query(`#${boardId} .field-slot[data-owner="${ctx.owner}"][data-type="monster"][data-index="${slotIndex}"]`);
                Decisioni.chiedi({
                    chi: ctx.owner,
                    tipo: 'posizione',
                    ancora: ancora,
                    titolo: `${card.name}: Attacco o Difesa?`
                }, (posizione) => evoca(posizione === 'defense' ? 'defense' : 'attack'));
            });
        }
    });

    // ================================================================
    // 645 — Furto Improvviso / Snatch Steal.
    // CORREZIONE di fedeltà: il controllo è PERMANENTE (nuovo 4°
    // parametro di ctx.takeControl, duel-engine.js — costruito per
    // Controllo Mentale/id 130), non più "fino alla End Phase". Carta
    // ora Continua (resta sul Terreno finché tiene il controllo) e si
    // autodistrugge se il mostro rubato lascia il Terreno (stesso
    // schema di Muro del Tornado/id 489: controllo in static(), nessuna
    // chiamata al destroySpellTrap protetto). "Il tuo avversario
    // guadagna 1000 LP durante ciascuna delle SUE Standby Phase":
    // def.onOpponentStandbyPhase (duel-engine.js, già costruito per
    // L'Occhio della Verità/id 466) reagisce dal lato del CONTROLLORE
    // della carta (il ladro) quando vive la Standby Phase dell'AVVERSARIO
    // (ctx.standbyOwner) — esattamente il proprietario originale del
    // mostro rubato in una partita 1v1.
    CardEffects.register(645, {
        continuous: true,
        canActivate(ctx) {
            return ctx.field(ctx.opponent).some((s) => s && !s.isFaceDown);
        },
        activate(ctx) {
            // Controllo PERMANENTE: a maggior ragione quale mostro rubare
            // non può deciderlo la carta al posto del giocatore.
            const candidati = [];
            ctx.field(ctx.opponent).forEach((slot, index) => {
                if (slot && !slot.isFaceDown) candidati.push({ owner: ctx.opponent, index, card: slot.card });
            });
            chooseFieldMonsterTarget(ctx, candidati, {
                title: '🦹 Strappa Possesso',
                text: 'Scegli quale mostro avversario rubare (controllo permanente).',
                dichiara: true
            }, (scelta) => {
                const targetSlot = ctx.field(scelta.owner)[scelta.index];
                if (!targetSlot) return;
                const stolen = targetSlot.card;
                if (ctx.takeControl(ctx.owner, scelta.owner, scelta.index, true)) {
                    ctx.card.snatchStealTargetUid = stolen.uid;
                    ctx.log(`🦹 Strappa Possesso prende il controllo permanente di ${stolen.name}!`);
                }
            });
        },
        onOpponentStandbyPhase(ctx) {
            if (!ctx.card.snatchStealTargetUid) return;
            ctx.dealDamage(ctx.standbyOwner, -1000);
            ctx.log('🦹 Strappa Possesso: il proprietario originale guadagna 1000 Life Points!');
        },
        static(ctx) {
            if (!ctx.card.snatchStealTargetUid) return;
            const stillControlled = ctx.field(ctx.owner).some((s) => s && s.card.uid === ctx.card.snatchStealTargetUid);
            if (!stillControlled) {
                ctx.stField(ctx.owner)[ctx.index] = null;
                ctx.graveyard(ctx.owner).push(ctx.card);
                ctx.log('🦹 Strappa Possesso va al Cimitero: il mostro rubato ha lasciato il Terreno.');
            }
        }
    });

    // ================================================================
    // 646 — Tempesta Pesante / Heavy Storm (Magia Normale)
    // Distruggi tutte le Magie/Trappole sul Terreno, di entrambi i
    // giocatori.
    // ================================================================
    CardEffects.register(646, {
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.stField(owner).some((s) => s));
        },
        activate(ctx) {
            const resolveStorm = () => {
                let count = 0;
                Tavolo.ordine().forEach((owner) => {
                    ctx.stField(owner).forEach((slot, index) => {
                        if (!slot) return;
                        ctx.graveyard(owner).push(slot.card);
                        ctx.stField(owner)[index] = null;
                        count++;
                    });
                });
                ctx.log(`🌪️ Tempesta Potente distrugge ${count} cart${count === 1 ? 'a' : 'e'} Magia/Trappola!`);
            };
            if (window.FX && typeof FX.playHeavyStorm === 'function') {
                FX.playHeavyStorm(resolveStorm);
            } else {
                resolveStorm();
            }
        }
    });

    // ================================================================
    // 647 — Distruzione con Zampata / Stamping Destruction (Magia
    // Normale)
    // Se controlli un mostro Tipo Drago: scegli come bersaglio 1 Magia/
    // Trappola sul Terreno; distruggila e infliggi 500 danni al suo
    // controllore. Stesso schema di ricerca bersaglio di Tifone dello
    // Spazio Mistico (id 607), con il requisito Drago e il danno extra.
    // ================================================================
    CardEffects.register(647, {
        canActivate(ctx) {
            const hasDragon = ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.race === 'Drago');
            if (!hasDragon) return false;
            return Tavolo.ordine().some((owner) => ctx.stField(owner).some((s) => s));
        },
        activate(ctx) {
            // "Scegli come bersaglio 1 Magia/Trappola sul Terreno":
            // entrambi i lati, coperte comprese (il testo non dice
            // "scoperta"). Prima preferiva sempre la prima dell'avversario
            // — una scelta ragionevole ma pur sempre automatica, e il
            // danno di 500 va a chi CONTROLLA la carta distrutta, quindi
            // colpire una propria carta è una decisione con conseguenze
            // che spetta al giocatore.
            const candidati = collectFieldTargets(ctx, { zone: 'st', includiCoperte: true });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '🐾 Distruzione Schiacciante',
                text: 'Scegli quale Magia/Trappola distruggere: il suo controllore subisce 500 danni.'
            }, (scelto) => {
                const slot = ctx.stField(scelto.owner)[scelto.index];
                if (slot && slot.isFaceDown) slot.isFaceDown = false;
                ctx.stField(scelto.owner)[scelto.index] = null;
                ctx.graveyard(scelto.owner).push(scelto.card);
                ctx.dealDamage(scelto.owner, 500);
                ctx.log(`🐾 Distruzione Schiacciante distrugge ${scelto.card.name} e infligge 500 danni!`);
            });
        }
    });

    // ================================================================
    // 648 — Scambio di Creature / Creature Swap (Magia Normale)
    // Ciascun giocatore sceglie 1 mostro e ne scambia il controllo con
    // l'altro. SEMPLIFICAZIONE "non possono cambiare Posizione questo
    // turno" non applicata (nessun impatto pratico immediato dato che i
    // mostri restano comunque nella Posizione con cui sono scambiati).
    // ================================================================
    CardEffects.register(648, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s) && ctx.field(ctx.opponent).some((s) => s);
        },
        activate(ctx) {
            // "CIASCUN giocatore sceglie 1 mostro CHE CONTROLLA": due
            // scelte distinte, ognuna fatta dal proprietario di quel lato
            // del Terreno — non è chi attiva la Magia a decidere anche il
            // mostro che l'avversario cede. Ogni lato riceve quindi un ctx
            // col PROPRIO owner (stesso schema di Signore del Rosso/id
            // 354), così chooseFieldMonsterTarget apre davvero il picker
            // al giocatore umano anche quando è il bot ad attivare la
            // carta, e auto-sceglie solo per il bot.
            const candidatesFor = (owner) => {
                const list = [];
                ctx.field(owner).forEach((slot, index) => {
                    if (slot) list.push({ owner: owner, index: index, card: slot.card });
                });
                // Il bot non ha un picker: cede il mostro con il valore di
                // combattimento più basso, che è anche la scelta sensata
                // (chooseFieldMonsterTarget prende candidates[0] quando
                // non c'è un umano a decidere).
                if (owner !== 'player') {
                    list.sort((a, b) => Math.max(a.card.attack || 0, a.card.defense || 0) - Math.max(b.card.attack || 0, b.card.defense || 0));
                }
                return list;
            };
            const ownCandidates = candidatesFor(ctx.owner);
            const oppCandidates = candidatesFor(ctx.opponent);
            if (ownCandidates.length === 0 || oppCandidates.length === 0) return;

            const ownCtx = DuelEngine.makeContext(ctx.owner, { card: ctx.card });
            const oppCtx = DuelEngine.makeContext(ctx.opponent, { card: ctx.card });

            chooseFieldMonsterTarget(ownCtx, ownCandidates, {
                title: '🔃 Scambio-Creature',
                text: 'Scegli quale dei TUOI mostri cedere all\'avversario.',
                dichiara: true
            }, (ownChoice) => {
                chooseFieldMonsterTarget(oppCtx, oppCandidates, {
                    title: '🔃 Scambio-Creature',
                    text: 'Scegli quale dei TUOI mostri cedere all\'avversario.',
                    dichiara: true
                }, (oppChoice) => {
                    // Gli indici possono essere cambiati fra le due scelte
                    // (il picker è asincrono): si rileggono per uid invece
                    // di fidarsi di quelli catturati prima.
                    const ownIndex = ctx.field(ownChoice.owner).findIndex((s) => s && s.card.uid === ownChoice.card.uid);
                    const oppIndex = ctx.field(oppChoice.owner).findIndex((s) => s && s.card.uid === oppChoice.card.uid);
                    if (ownIndex === -1 || oppIndex === -1) return;
                    // Lo scambio passa dal choke point condiviso del cambio
                    // di controllo (ACTIONS.swapControl): prima questa carta
                    // riassegnava gli slot a mano, saltando l'azzeramento di
                    // hasAttacked/canChangePosition, il flag controlImmune
                    // (Mataza il Fulminatore, id 717), l'hook
                    // onControlChangedToOpponent e l'animazione di
                    // spostamento — un bug reale segnalato dall'utente.
                    // `permanent`: il testo NON dice "fino alla End Phase",
                    // lo scambio è definitivo (a differenza di Cambio di
                    // Cuore), quindi nessun ritorno automatico a fine turno.
                    if (!ctx.swapControl(ownChoice.owner, ownIndex, oppChoice.owner, oppIndex, true)) {
                        ctx.log('🚫 Lo scambio di controllo non può avvenire.');
                        return;
                    }
                    // "Quei mostri non possono cambiare la loro Posizione di
                    // Battaglia per il resto di questo turno" — swapControl
                    // rimette canChangePosition a true (è il comportamento
                    // giusto per ogni ALTRO cambio di controllo), qui lo si
                    // richiude subito dopo, come da testo. Si azzera da solo
                    // al prossimo turno del controllore, in changeTurn().
                    const movedToOpp = ctx.field(oppChoice.owner)[oppIndex];
                    const movedToOwn = ctx.field(ownChoice.owner)[ownIndex];
                    if (movedToOpp) movedToOpp.canChangePosition = false;
                    if (movedToOwn) movedToOwn.canChangePosition = false;
                    ctx.log(`🔃 Scambio-Creature scambia ${ownChoice.card.name} con ${oppChoice.card.name}!`);
                    if (typeof updateUI === 'function') updateUI();
                });
            });
        }
    });

    // ================================================================
    // 649 — Ricarica / Reload (Magia Rapida)
    // Rimetti tutte le carte della mano nel Deck e mescola, poi pesca lo
    // stesso numero di carte. Riusa ctx.shuffleIntoDeck (già presente in
    // duel-engine.js) — funziona solo con un vero Deck salvato, come
    // tutte le altre carte che cercano/rimescolano nel Deck in questo
    // file.
    // ================================================================
    CardEffects.register(649, {
        canActivate(ctx) {
            return ctx.hand(ctx.owner).length > 0;
        },
        activate(ctx) {
            const hand = ctx.hand(ctx.owner);
            const count = hand.length;
            const returned = hand.splice(0, hand.length);
            if (!ctx.shuffleIntoDeck(ctx.owner, returned)) {
                // Nessun vero Deck (Duello Demo): le carte tornano in mano invece di sparire nel nulla.
                hand.push(...returned);
                return;
            }
            ctx.drawCards(ctx.owner, count);
            ctx.log(`🔄 Ricarica rimescola ${count} cart${count === 1 ? 'a' : 'e'} nel Deck e ne pesca altrettante!`);
        }
    });

    // ================================================================
    // 650 — Il Cimitero nella Quarta Dimensione (Magia Normale)
    // Aggiungi fino a 2 mostri "LV" dal Cimitero al Deck e mescola.
    // ================================================================
    CardEffects.register(650, {
        canActivate(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.name && c.name.includes('LV'));
        },
        activate(ctx) {
            if (ctx.graveyardMoveNegated(ctx.owner)) return;
            const grave = ctx.graveyard(ctx.owner);
            const found = [];
            for (let i = grave.length - 1; i >= 0 && found.length < 2; i--) {
                if (grave[i].name && grave[i].name.includes('LV')) {
                    found.push(grave.splice(i, 1)[0]);
                }
            }
            if (found.length === 0) return;
            if (!ctx.shuffleIntoDeck(ctx.owner, found)) {
                grave.push(...found);
                return;
            }
            ctx.log(`♻️ Il Cimitero nella Quarta Dimensione rimescola ${found.length} mostr${found.length === 1 ? 'o' : 'i'} "LV" nel Deck!`);
        }
    });

    // ================================================================
    // 651 — Cessate il Fuoco / Ceasefire (Trappola Normale)
    // Gira scoperti tutti i mostri coperti in Posizione di Difesa sul
    // Terreno (nessun effetto Flip si attiva), poi infliggi 500 danni
    // all'avversario per ogni Mostro con Effetto sul Terreno.
    // SEMPLIFICAZIONE "Mostro con Effetto" = qualunque mostro scoperto la
    // cui carta NON è marcata `vanilla` nel database (stessa convenzione
    // usata in tutto questo file per distinguere Mostri Normali).
    // ================================================================
    CardEffects.register(651, {
        canActivate(ctx) {
            const hasFaceDownDef = Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && s.isFaceDown && s.position === 'defense'));
            const hasEffectMonster = Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown && !s.card.vanilla));
            return hasFaceDownDef || hasEffectMonster;
        },
        activate(ctx) {
            let flipped = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (slot && slot.isFaceDown && slot.position === 'defense') { slot.isFaceDown = false; flipped++; }
                });
            });
            const effectMonsterCount = Tavolo.ordine().reduce((sum, owner) => sum + ctx.field(owner).filter((s) => s && !s.isFaceDown && !s.card.vanilla).length, 0);
            const damage = effectMonsterCount * 500;
            if (damage > 0) ctx.dealDamage(ctx.opponent, damage);
            ctx.log(`🏳️ Cessate il Fuoco rivela ${flipped} most${flipped === 1 ? 'ro' : 'ri'} e infligge ${damage} danni!`);
        }
    });

    // ================================================================
    // 652 — La Perla del Drago / The Dragon's Bead (Trappola Continua)
    // Scarta 1 carta; annulla l'effetto di una Trappola attivata che
    // bersaglia 1 mostro Tipo Drago scoperto, e distruggila. Stesso
    // schema di risposta via Chain di Interferenza Magica (id 361), ma
    // per Trappole, con il requisito di bersaglio verificato davvero
    // tramite declaredTargeting (vedi il commento su questo campo in
    // cima al file) invece di rispondere a QUALSIASI Trappola. Nessuna
    // restrizione a "Trappola dell'avversario": il testo reale non la
    // prevede (a differenza di Campo di Riryoku/id 636 qui sopra, che ce
    // l'ha sempre avuta, semplificazione preesistente non toccata qui).
    // ================================================================
    CardEffects.register(652, {
        canActivate(ctx) {
            if (ctx.hand(ctx.owner).length === 0) return false;
            const chain = ctx.gameState.chain;
            if (!chain || !chain.links || chain.links.length === 0) return false;
            const top = chain.links[chain.links.length - 1];
            if (top.card.type !== 'trap') return false;
            const dt = top.def && top.def.declaredTargeting;
            return !!dt && dt.count === 1 && dt.cardType === 'monster' && dt.race === 'Drago';
        },
        activate(ctx) {
            const hand = ctx.hand(ctx.owner);
            if (hand.length === 0) return;
            const discarded = ctx.discardChosenFromHand(ctx.owner, 0);
            if (ctx.negateActivation()) {
                ctx.log(`🐲 La Perla di Drago scarta ${discarded.name} e annulla la Trappola!`);
            } else {
                ctx.log(`🐲 La Perla di Drago scarta ${discarded.name}, ma non c'era più nulla da annullare.`);
            }
        }
    });

    // ================================================================
    // 95 — Frecce Anti-Magia / Anti-Spell Fragrance (Magia Rapida)
    // Attivabile durante la Battle Phase: per il resto del turno, nessuno
    // dei due giocatori può più attivare Magie/Trappole. Riusa i flag già
    // esistenti gameState.noSpellActivationFor/noTrapActivationFor (già
    // consultati da DuelEngine.canActivate, vedi duel-engine.js — stesso
    // meccanismo di Manta Perforante Strisciante id 693/famiglia
    // Ingranaggio Antico), impostati qui per ENTRAMBI i lati invece che
    // per un solo giocatore. SEMPLIFICAZIONE: non impedisce a un
    // avversario di rispondere a QUESTA stessa attivazione con una
    // Trappola già Set (il motore non ha un modo per bloccare
    // selettivamente solo le risposte a sé stessa) — una volta risolta,
    // però, blocca correttamente tutto il resto del turno.
    // ================================================================
    CardEffects.register(95, {
        canActivate(ctx) {
            return ctx.gameState.phase === 'battle';
        },
        activate(ctx) {
            gameState.noSpellActivationFor = gameState.noSpellActivationFor || {};
            gameState.noTrapActivationFor = gameState.noTrapActivationFor || {};
            gameState.noSpellActivationFor.player = true;
            gameState.noSpellActivationFor.bot = true;
            gameState.noTrapActivationFor.player = true;
            gameState.noTrapActivationFor.bot = true;
            ctx.log('🚫 Frecce Anti-Magia: nessuno può più attivare Magie/Trappole per il resto del turno!');
        }
    });

    // ================================================================
    // 653 — Avidità Sconsiderata / Reckless Greed (Trappola Normale)
    // Pesca 2 carte e salta le tue prossime 2 Draw Phase (vedi
    // gameState.skipDrawFor, controllato in enterDrawPhase — game-flow.js).
    // ================================================================
    CardEffects.register(653, {
        activate(ctx) {
            ctx.drawCards(ctx.owner, 2);
            gameState.skipDrawFor = gameState.skipDrawFor || {};
            gameState.skipDrawFor[ctx.owner] = (gameState.skipDrawFor[ctx.owner] || 0) + 2;
            ctx.log('🎲 Cupidigia Insaziabile pesca 2 carte, ma salterai le prossime 2 Draw Phase!');
        }
    });

    // ================================================================
    // 654 — Disturbatore di Trappole / Trap Jammer (Trappola Contatore)
    // Quando l'avversario attiva una Trappola durante la Battle Phase:
    // annulla la sua attivazione e distruggila. Stesso schema di
    // Campo di Riryoku (id 636), ma per Trappole e solo in Battle Phase.
    // ================================================================
    CardEffects.register(654, {
        canActivate(ctx) {
            if (ctx.gameState.phase !== 'battle') return false;
            const chain = ctx.gameState.chain;
            return !!(chain && chain.links && chain.links.length > 0 && chain.links[chain.links.length - 1].card.type === 'trap' && chain.links[chain.links.length - 1].owner === ctx.opponent);
        },
        activate(ctx) {
            if (ctx.negateActivation()) {
                ctx.log("⚡ Disturba Trappola annulla e distrugge la Trappola avversaria!");
            } else {
                ctx.log('⚡ Disturba Trappola non trova più nulla da annullare.');
            }
        }
    });

    // ================================================================
    // 655 — Maledizione di Anubis / Curse of Anubis (Trappola Normale)
    // Cambia in Posizione di Difesa tutti i Mostri con Effetto sul
    // Terreno (di entrambi i giocatori); la loro DEF diventa 0 fino alla
    // fine del turno. CORREZIONE di fedeltà: aggiunto il divieto
    // mancante di cambiare Posizione per il resto del turno — nuovo
    // gameState.cannotChangePositionUidsThisTurn (game-flow.js/actions.js,
    // vedi il commento lì), variante "per il resto del turno" (non
    // ricalcolata ad ogni render) di gameState.cannotChangePositionUids.
    // ================================================================
    CardEffects.register(655, {
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown && !s.card.vanilla));
        },
        activate(ctx) {
            let count = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown || slot.card.vanilla) return;
                    slot.position = 'defense';
                    ctx.grantTemporaryAtkDefBonus(slot.card, 0, -(slot.card.defense || 0), false);
                    gameState.cannotChangePositionUidsThisTurn = gameState.cannotChangePositionUidsThisTurn || new Set();
                    gameState.cannotChangePositionUidsThisTurn.add(slot.card.uid);
                    count++;
                });
            });
            ctx.log(`☥ Maledizione di Anubis mette in Difesa ${count} Most${count === 1 ? 'ro con Effetto' : 'ri con Effetto'}, DEF a 0!`);
        }
    });

    // ================================================================
    // 656 — Genesi del Vampiro / Vampire Genesis
    // Special Summon dalla mano bandendo 1 Signore dei Vampiri (id 658)
    // che si controlla. Poi (Ignition, una volta per turno): scarta 1
    // mostro Zombie, Special Summon dal Cimitero 1 mostro Zombie di
    // Livello inferiore a quello scartato.
    // SEMPLIFICAZIONE "banish": la carta sparisce e basta (stesso spirito
    // già accettato altrove in questo motore).
    // ================================================================
    CardEffects.register(656, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.id === 658);
        },
        paySpecialSummonCost(ctx) {
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && !slot.isFaceDown && slot.card.id === 658);
            if (index === -1) return false;
            const banishedCard = field[index].card;
            if (blockBanishFromField(ctx, banishedCard)) return false;
            field[index] = null;
            ctx.banish(ctx.owner, banishedCard);
            ctx.log('🧛 Genesi Vampira bandisce Signore dei Vampiri per essere Special Summonata!');
            return true;
        },
        canActivate(ctx) {
            const hasZombieInHand = ctx.hand(ctx.owner).some((c) => c.type === 'monster' && c.race === 'Zombie');
            if (!hasZombieInHand) return false;
            return ctx.findEmptyMonsterSlot(ctx.owner) !== -1;
        },
        activate(ctx) {
            const hand = ctx.hand(ctx.owner);
            const grave = ctx.graveyard(ctx.owner);
            const isZombie = (c) => c.type === 'monster' && c.race === 'Zombie';
            // Solo i candidati da scartare che hanno DAVVERO un bersaglio
            // di rianimazione valido nel Cimitero (Livello inferiore) —
            // altrimenti il giocatore potrebbe scegliere di scartare una
            // carta che poi non fa trovare nessun bersaglio, sprecando il
            // costo per nulla.
            const validHandCandidates = hand.filter((c) => isZombie(c) && grave.some((g) => isZombie(g) && (g.level || 0) < (c.level || 0)));
            if (validHandCandidates.length === 0) return;
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;

            const discardChosen = (discardCard) => {
                const handIndex = ctx.hand(ctx.owner).indexOf(discardCard);
                if (handIndex === -1) return;
                const discardLevel = discardCard.level || 0;
                // Il candidato da rianimare va cercato DOPO lo scarto: lo
                // scarto passa da discardChosenFromHand, che innesca
                // onSentToGraveyardFromHand/notifyOwnMonsterSentToGraveyard
                // e può alterare il Cimitero (altre carte reattive) prima
                // ancora di aprire questo secondo picker.
                const discarded = ctx.discardChosenFromHand(ctx.owner, handIndex);
                if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
                searchGraveyardWithChoice(ctx, ctx.owner, (c) => isZombie(c) && (c.level || 0) < discardLevel, {
                    title: '🧛 Genesi Vampira',
                    text: 'Scegli quale mostro Zombie Special Summonare dal Cimitero.'
                }, (revived) => {
                    const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                    if (slotIndex === -1) { ctx.graveyard(ctx.owner).push(revived); return; }
                    ctx.specialSummon(ctx.owner, revived, slotIndex, 'attack', 'graveyard');
                    ctx.log(`🧛 Genesi Vampira scarta ${discarded.name} e Special Summona ${revived.name} dal Cimitero!`);
                });
            };

            if (validHandCandidates.length === 1 || !Decisioni.rispondeUnaPersona(ctx.owner)) {
                let best = validHandCandidates[0];
                validHandCandidates.forEach((c) => { if ((c.level || 0) > (best.level || 0)) best = c; });
                discardChosen(best);
                return;
            }
            Decisioni.chiedi({
                chi: ctx.owner,
                candidati: validHandCandidates,
                titolo: '🧛 Genesi Vampira',
                testo: 'Scegli quale mostro Zombie scartare dalla mano.'
            }, (scelta) => {
                if (scelta === null) return;
                discardChosen(scelta);
            });
        }
    });

    // ================================================================
    // 658 — Signore dei Vampiri / Vampire Lord
    // Se infligge danno da battaglia: dichiara 1 tipo di carta, il tuo
    // avversario ne manda 1 dal Deck al Cimitero. Riusa
    // onDealsBattleDamage (actions.js), già costruito per Cappello
    // Magico Bianco (id 591)/Goblin Ladro (id 610).
    // Una volta per turno, durante la propria prossima Standby Phase dopo
    // essere stata distrutta e mandata al Cimitero da un effetto
    // dell'AVVERSARIO (ctx.destroyedByOwner === ctx.opponent, MAI in
    // battaglia — ctx.destroyedByOpponentCard escluderebbe comunque
    // quel caso): Special Summonala — ctx.reviveFromGraveyardWithCountdown
    // (nuovo meccanismo generico in duel-engine.js, standbys:1).
    // SEMPLIFICAZIONE: dichiara sempre "Mostro" invece di lasciar
    // scegliere il tipo, e manda al Cimitero il primo trovato.
    // ================================================================
    CardEffects.register(658, {
        onDealsBattleDamage(ctx) {
            searchDeckWithChoice(ctx, (c) => c.type === 'monster', { deckOwner: ctx.opponent, title: '🧛 Signore dei Vampiri', text: "Scegli quale mostro mandare al Cimitero dal Deck dell'avversario." }, (card) => {
                ctx.graveyard(ctx.opponent).push(card);
                ctx.log(`🧛 Signore dei Vampiri manda ${card.name} dal Deck dell'avversario al Cimitero!`);
            });
        },
        onDestroy(ctx) {
            if (ctx.destroyedByOpponentCard) return;
            if (ctx.destroyedByOwner !== ctx.opponent) return;
            const grave = ctx.graveyard(ctx.owner);
            const index = grave.findIndex((c) => c.uid === ctx.card.uid);
            if (index === -1) return;
            const [card] = grave.splice(index, 1);
            ctx.reviveFromGraveyardWithCountdown(ctx.owner, card, 1);
            ctx.log('🧛 Signore dei Vampiri rinascerà alla tua prossima Standby Phase!');
        }
    });

    // ================================================================
    // 659 — Spirito della Polvere Oscura / Dark Dust Spirit (Mostro
    // Spirito)
    // Quando Evocata Normalmente o girata scoperta: distruggi tutti gli
    // altri mostri scoperti sul Terreno. Alla End Phase dello stesso
    // turno: ritorna in mano.
    // ================================================================
    CardEffects.register(659, {
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            destroyAllOtherMonsters(ctx);
        },
        onFlip(ctx) {
            destroyAllOtherMonsters(ctx);
        },
        onEndPhase(ctx) {
            if (ctx.card._returnToHandTurn !== gameState.turn) return;
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && slot.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.returnMonsterToHand(ctx.owner, index);
            ctx.log('👻 Spirito Polvere Oscura ritorna in mano!');
        }
    });
    function destroyAllOtherMonsters(ctx) {
        ctx.card._returnToHandTurn = gameState.turn;
        let count = 0;
        Tavolo.ordine().forEach((owner) => {
            ctx.field(owner).forEach((slot, index) => {
                if (!slot || slot.isFaceDown || slot.card.uid === ctx.card.uid) return;
                ctx.destroyMonster(owner, index);
                count++;
            });
        });
        ctx.log(`👻 Spirito Polvere Oscura distrugge ${count} altr${count === 1 ? 'o mostro' : 'i mostri'}!`);
    }

    // ================================================================
    // 660 — Tartaruga della Piramide / Pyramid Turtle (onDestroy —
    // distrutto in battaglia)
    // Quando distrutta in battaglia: Special Summon 1 mostro Zombie con
    // 2000 o meno DEF dal Deck. Stesso schema di Ratto Gigante (id 614)/
    // Drago Mascherato (id 644).
    // ================================================================
    CardEffects.register(660, {
        onDestroy(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.race === 'Zombie' && c.defense <= 2000, {
                title: '🐢 Tartaruga Piramide',
                text: 'Scegli quale mostro Zombie (2000 DEF o meno) Special Summonare dal Deck.'
            }, (card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
                ctx.log(`🐢 Tartaruga Piramide Special Summona ${card.name} dal Deck!`);
            });
        }
    });

    // ================================================================
    // 661 — Mietitore Spirituale / Spirit Reaper
    // Non può essere distrutta in battaglia (def.cannotBeDestroyedByBattle,
    // controllato in resolveBattleDamage/actions.js). Con un attacco
    // diretto: l'avversario scarta 1 carta a caso.
    // Vedi missingEffectNote su id 661 in cards.json per la clausola
    // "distrutta dopo un effetto che la bersaglia" mancante.
    // ================================================================
    // CORREZIONE di fedeltà: aggiunta la clausola mancante "dopo che si è
    // risolto un effetto che ha come bersaglio questa carta scoperta,
    // distruggila" — riusa il checkpoint di targeting introdotto per
    // Gran Scudo Gardna/id 115 (ctx.declareTarget, duel-engine.js). Non
    // chiama ctx.cancel(): l'effetto sorgente prosegue normalmente
    // (l'auto-distruzione È l'effetto, non una negazione) — coperta solo
    // dagli effetti Carta che chiamano esplicitamente il checkpoint
    // (stessa SEMPLIFICAZIONE già documentata per id 115/235/353/738/826).
    CardEffects.register(661, {
        cannotBeDestroyedByBattle: true,
        canActivate(ctx) {
            return ctx.zone === 'monster';
        },
        onCardEffectTargetDeclare(ctx) {
            const index = ctx.field(ctx.owner).findIndex((s) => s && s.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.destroyMonster(ctx.owner, index);
            ctx.log(`💀 ${ctx.card.name} viene distrutto: è stato preso di mira da un effetto Carta!`);
        },
        onDealsBattleDamage(ctx) {
            if (ctx.targetIndex !== -1) return;
            const discarded = ctx.discardRandomFromHand(ctx.opponent);
            if (!discarded) return;
            ctx.log(`💀 Spirito Mietitore forza l'avversario a scartare ${discarded.name}!`);
        }
    });

    // ================================================================
    // 662 — Disperazione dall'Oscurità / Despair from the Dark
    // "Se questa carta viene mandata dalla tua mano O DAL DECK al tuo
    // Cimitero da un effetto dell'AVVERSARIO: Special Summonala" —
    // onSentToGraveyardFromHand (ctx.discardRandomFromHand/
    // ctx.discardChosenFromHand) e ora anche onSentToGraveyardFromDeck
    // (ctx.millCardFromDeck, duel-engine.js — nuovo hook, aggiunto
    // apposta per questa clausola). Entrambi condividono la stessa
    // logica di risalita dal Cimitero, estratta in
    // despairFromTheDarkSpecialSummonSelf qui sotto.
    // ================================================================
    function despairFromTheDarkSpecialSummonSelf(ctx) {
        const grave = ctx.graveyard(ctx.owner);
        const index = grave.findIndex((c) => c.uid === ctx.card.uid);
        if (index === -1) return;
        const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
        if (slotIndex === -1) return;
        const [card] = grave.splice(index, 1);
        ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'graveyard');
        ctx.log('💀 Disperazione dall\'Oscurità Special Summonata dopo essere stata scartata!');
    }
    CardEffects.register(662, {
        onSentToGraveyardFromHand(ctx) {
            if (ctx.discardedByOwner !== ctx.opponent) return;
            despairFromTheDarkSpecialSummonSelf(ctx);
        },
        onSentToGraveyardFromDeck(ctx) {
            if (ctx.milledByOwner !== ctx.opponent) return;
            despairFromTheDarkSpecialSummonSelf(ctx);
        }
    });

    // ================================================================
    // 663 — Ryu Kokki (statico + onBattled)
    // Alla fine del Damage Step, se questa carta ha combattuto contro un
    // mostro Tipo Guerriero o Incantatore: distruggilo (onBattled,
    // actions.js — SEMPLIFICAZIONE: solo se Ryu Kokki è sopravvissuto
    // alla stessa battaglia, niente "ultima informazione nota").
    // ================================================================
    CardEffects.register(663, {
        onBattled(ctx) {
            if (!ctx.opponentSurvived) return;
            if (ctx.opponentCard.race !== 'Guerriero' && ctx.opponentCard.race !== 'Incantatore') return;
            const idx = ctx.field(ctx.opponent).findIndex((s) => s && s.card.uid === ctx.opponentCard.uid);
            if (idx === -1) return;
            ctx.destroyMonster(ctx.opponent, idx);
            ctx.log(`💀 Ryu Kokki distrugge ${ctx.opponentCard.name} dopo aver combattuto!`);
        }
    });

    // ================================================================
    // 664 — Torre d'Ossa Divora-Anime / Card of the Soul-Devouring Tower
    // (statico)
    // Se si controlla un altro mostro Tipo Zombie: questa carta non può
    // essere scelta come bersaglio per gli attacchi (gameState.
    // cannotBeAttackTargetUids). "Ogni volta che uno o più mostri Zombie
    // vengono Special Summonati: manda le prime 2 carte del Deck
    // avversario al Cimitero": def.onAnySpecialSummon (nuovo aggancio
    // generico, reactToAnySpecialSummon in duel-engine.js) — "prime 2
    // carte" = le ULTIME 2 dell'array (il Deck pesca con Array.pop(),
    // vedi drawCardsToHand/game-flow.js: la cima è la fine dell'array).
    // ================================================================
    CardEffects.register(664, {
        static(ctx) {
            const controlsAnotherZombie = ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.uid !== ctx.card.uid && slot.card.race === 'Zombie');
            if (controlsAnotherZombie) {
                gameState.cannotBeAttackTargetUids[ctx.card.uid] = true;
            }
        },
        onAnySpecialSummon(ctx) {
            if (!ctx.summonedCard || ctx.summonedCard.race !== 'Zombie') return;
            const deckKey = Tavolo.chiave(ctx.opponent, 'Deck');
            const deck = gameState[deckKey];
            if (!Array.isArray(deck) || deck.length === 0) return;
            const milled = deck.splice(Math.max(0, deck.length - 2), 2);
            gameState[Tavolo.chiave(ctx.opponent, 'DeckCount')] = deck.length;
            ctx.graveyard(ctx.opponent).push(...milled);
            ctx.log(`💀 Torre d'Ossa Assorbi-Anima manda ${milled.length} cart${milled.length === 1 ? 'a' : 'e'} dal Deck dell'avversario al Cimitero!`);
        }
    });

    // ================================================================
    // 665 — Dama dei Vampiri / Vampire Lady — stesso identico effetto di
    // Signore dei Vampiri (id 658) qui sopra.
    // ================================================================
    CardEffects.register(665, {
        onDealsBattleDamage(ctx) {
            searchDeckWithChoice(ctx, (c) => c.type === 'monster', { deckOwner: ctx.opponent, title: '🧛 Lady Vampira', text: "Scegli quale mostro mandare al Cimitero dal Deck dell'avversario." }, (card) => {
                ctx.graveyard(ctx.opponent).push(card);
                ctx.log(`🧛 Lady Vampira manda ${card.name} dal Deck dell'avversario al Cimitero!`);
            });
        }
    });

    // ================================================================
    // 667 — Mummia Rigenerante / Regenerating Mummy
    // Se questa carta viene mandata dalla tua mano al tuo Cimitero da un
    // effetto dell'AVVERSARIO: ritorna in mano — onSentToGraveyardFromHand
    // (nuovo hook in duel-engine.js/ctx.discardRandomFromHand), come
    // Disperazione dall'Oscurità (id 662) qui sopra ma verso la mano.
    // ================================================================
    CardEffects.register(667, {
        onSentToGraveyardFromHand(ctx) {
            if (ctx.discardedByOwner !== ctx.opponent) return;
            const grave = ctx.graveyard(ctx.owner);
            const index = grave.findIndex((c) => c.uid === ctx.card.uid);
            if (index === -1) return;
            if (ctx.graveyardMoveNegated(ctx.owner)) return;
            const [card] = grave.splice(index, 1);
            ctx.hand(ctx.owner).push(card);
            ctx.log('🧟 Mummia Rigenerante torna in mano dopo essere stata scartata!');
        }
    });

    // ================================================================
    // 668 — Grande Tornado / Giant Trunade (Magia Normale)
    // Rimetti in mano tutte le Magie/Trappole sul Terreno, di entrambi i
    // giocatori. Stesso schema di Tempesta Pesante (id 646), ma verso la
    // mano invece del Cimitero.
    // ================================================================
    CardEffects.register(668, {
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.stField(owner).some((s) => s));
        },
        activate(ctx) {
            let count = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.stField(owner).forEach((slot, index) => {
                    if (!slot) return;
                    ctx.hand(owner).push(slot.card);
                    ctx.stField(owner)[index] = null;
                    count++;
                });
            });
            ctx.log(`🌀 Grande Tornado rimette in mano ${count} cart${count === 1 ? 'a' : 'e'} Magia/Trappola!`);
        }
    });

    // ================================================================
    // 669 — Libro della Vita / Book of Life (Magia Normale)
    // Special Summon 1 mostro Zombie dal proprio Cimitero, poi bandisci
    // 1 mostro dal Cimitero dell'avversario.
    // SEMPLIFICAZIONE "banish": la carta sparisce e basta.
    // ================================================================
    CardEffects.register(669, {
        canActivate(ctx) {
            const hasZombie = ctx.graveyard(ctx.owner).some((c) => c.type === 'monster' && c.race === 'Zombie');
            return hasZombie && ctx.findEmptyMonsterSlot(ctx.owner) !== -1;
        },
        activate(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchGraveyardWithChoice(ctx, ctx.owner, (c) => c.type === 'monster' && c.race === 'Zombie', {
                title: '📖 Libro della Vita',
                text: 'Scegli quale mostro Zombie Special Summonare dal tuo Cimitero.'
            }, (revived) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) { ctx.graveyard(ctx.owner).push(revived); return; }
                ctx.specialSummon(ctx.owner, revived, slotIndex, 'attack', 'graveyard');
                // BUG REALE preesistente corretto insieme allo stesso giro:
                // il bando dal Cimitero avversario prendeva SEMPRE
                // oppGrave[0] senza nemmeno filtrare c.type === 'monster'
                // come richiede il testo reale della carta.
                const opened = banishFromGraveyardWithChoice(ctx, ctx.opponent, (c) => c.type === 'monster', {
                    title: '📖 Libro della Vita',
                    text: "Scegli quale mostro bandire dal Cimitero dell'avversario."
                }, (banishedCard) => {
                    ctx.log(`📖 Libro della Vita Special Summona ${revived.name} e bandisce ${banishedCard.name}!`);
                });
                // SEMPLIFICAZIONE di nicchia: se opened=true ma Necrovalley
                // (id 890) blocca l'unico bando tentato, non viene scritto
                // alcun log per questa Special Summon (il ramo "successo"
                // sopra è l'unico che logga in quel caso) — coerente con lo
                // stesso standard già accettato per Fabbrica dell'Ingranaggio
                // Antico (id 841) poco più sotto in questo file.
                if (!opened) ctx.log(`📖 Libro della Vita Special Summona ${revived.name}!`);
            });
        }
    });

    // ================================================================
    // 670 — Richiamo della Mummia / Call of the Mummy (Magia Continua)
    // "Una volta per turno: puoi Special Summonare 1 mostro Tipo Zombie
    // dalla tua mano. Devi controllare zero mostri per attivare e
    // risolvere questo effetto." — stesso schema di def.repeatableWhileContinuous
    // già usato per Offerta Suprema (id 559)/Pietra del Potere Nero Pece
    // (id 751): ctx.card._mummyCallOnField distingue la prima
    // attivazione (Set/scoperta la prima volta) da ogni uso ripetibile
    // successivo, ctx.hasUsedOncePerTurn applica il limite di una volta a
    // turno per istanza.
    // ================================================================
    CardEffects.register(670, {
        continuous: true,
        repeatableWhileContinuous: true,
        canActivate(ctx) {
            if (!ctx.card._mummyCallOnField) return true;
            if (ctx.field(ctx.owner).some((s) => s)) return false;
            if (ctx.hasUsedOncePerTurn(`mummy-call:${ctx.card.uid}`)) return false;
            return ctx.hand(ctx.owner).some((c) => c.type === 'monster' && c.race === 'Zombie');
        },
        activate(ctx) {
            if (!ctx.card._mummyCallOnField) {
                ctx.card._mummyCallOnField = true;
                ctx.log('⚱️ Richiamo della Mummia è ora sul Terreno!');
                return;
            }
            // Quale Zombie Evocare lo sceglie il giocatore: prima si
            // prendeva il primo trovato in mano (hand.findIndex), che con
            // due Zombie in mano decideva al posto suo.
            chooseCardFromHand(ctx, {
                filter: (c) => c.type === 'monster' && c.race === 'Zombie',
                title: '⚱️ Richiamo della Mummia',
                text: 'Scegli quale mostro Zombie Special Summonare dalla tua mano.'
            }, (card, index) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                ctx.hand(ctx.owner).splice(index, 1);
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'hand');
                ctx.markUsedOncePerTurn(`mummy-call:${ctx.card.uid}`);
                ctx.log(`⚱️ Richiamo della Mummia Special Summona ${card.name} dalla mano!`);
            });
        }
    });

    // ================================================================
    // 671 — Dispositivo di Evacuazione Forzata / Compulsory Evacuation
    // Device (Trappola Normale)
    // Scegli come bersaglio 1 mostro sul Terreno; ritorna quel bersaglio
    // in mano. CORREZIONE: mandava il mostro in mano con uno splice/push
    // manuale, senza passare né dal checkpoint di targeting
    // (ctx.declareTarget, stesso schema già usato da Colpo di Coda/id 811
    // per lo stesso identico effetto) né da ctx.returnMonsterToHand — di
    // conseguenza né le carte protettrici (Gran Scudo Gardna id 115 e
    // simili) né def.onReturnedToHandSelf/onAnyMonsterReturnedToHand (es.
    // Criosfinge id 761) scattavano mai per questa carta.
    // ================================================================
    CardEffects.register(671, {
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown));
        },
        activate(ctx) {
            const candidates = [];
            [ctx.opponent, ctx.owner].forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => { if (slot && !slot.isFaceDown) candidates.push({ owner, index, card: slot.card }); });
            });
            if (candidates.length === 0) return;
            // Bug reale segnalato dall'utente: sceglieva sempre il primo
            // candidato trovato (l'avversario prima, poi il proprio Terreno),
            // mai una vera scelta — vedi chooseFieldMonsterTarget qui sopra.
            chooseFieldMonsterTarget(ctx, candidates, {
                title: '🚪 Dispositivo di Salvataggio Obbligatorio',
                text: 'Scegli 1 mostro scoperto sul Terreno da rimandare in mano.',
                dichiara: true
            }, (choice) => {
                const finalSlot = ctx.field(choice.owner)[choice.index];
                if (!finalSlot) return;
                const name = finalSlot.card.name;
                ctx.returnMonsterToHand(choice.owner, choice.index);
                ctx.log(`🚪 Dispositivo di Salvataggio Obbligatorio rimanda ${name} in mano!`);
            });
        }
    });

    // ================================================================
    // 672 — Imperatore della Fiamma Infernale / Infernal Flame Emperor
    // Quando Evocata Tributo: bandisci fino a 5 mostri FUOCO dal proprio
    // Cimitero; distruggi altrettante Magie/Trappole sul Terreno.
    // ================================================================
    CardEffects.register(672, {
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            const grave = ctx.graveyard(ctx.owner);
            let banished = 0;
            for (let i = grave.length - 1; i >= 0 && banished < 5; i--) {
                if (grave[i].type === 'monster' && grave[i].attribute === 'FUOCO' && ctx.banishFromGraveyard(ctx.owner, grave[i])) {
                    banished++;
                }
            }
            if (banished === 0) return;
            let destroyed = 0;
            outer:
            for (const owner of Tavolo.ordine()) {
                const st = ctx.stField(owner);
                for (let i = 0; i < st.length && destroyed < banished; i++) {
                    if (!st[i]) continue;
                    ctx.graveyard(owner).push(st[i].card);
                    st[i] = null;
                    destroyed++;
                    if (destroyed >= banished) break outer;
                }
            }
            ctx.log(`🔥 Imperatore della Fiamma Infernale bandisce ${banished} mostr${banished === 1 ? 'o' : 'i'} e distrugge ${destroyed} cart${destroyed === 1 ? 'a' : 'e'} Magia/Trappola!`);
        }
    });

    // ================================================================
    // 675 — Tartaruga UFO / UFO Turtle (onDestroy — distrutto in
    // battaglia)
    // Quando distrutta in battaglia: Special Summon 1 mostro FUOCO con
    // 1500 o meno ATK dal Deck — vera scelta tramite
    // searchDeckWithChoice, stesso schema di Ratto Gigante (id 614).
    // ================================================================
    CardEffects.register(675, {
        onDestroy(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.attribute === 'FUOCO' && c.attack <= 1500, {
                title: '🐢 Tartaruga UFO',
                text: 'Scegli quale mostro FUOCO (1500 ATK o meno) Special Summonare dal Deck.'
            }, (card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
                ctx.log(`🐢 Tartaruga UFO Special Summona ${card.name} dal Deck!`);
            });
        }
    });

    // ================================================================
    // 676 — Piccola Chimera / Little Chimera (statico, entrambi i lati)
    // Tutti i mostri FUOCO sul Terreno: +500 ATK. Tutti i mostri ACQUA
    // sul Terreno: -400 ATK.
    // ================================================================
    CardEffects.register(676, {
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown) return;
                    const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    if (slot.card.attribute === 'FUOCO') gameState.atkDefBonus[slot.card.uid] = { atk: e.atk + 500, def: e.def };
                    else if (slot.card.attribute === 'ACQUA') gameState.atkDefBonus[slot.card.uid] = { atk: e.atk - 400, def: e.def };
                });
            });
        }
    });

    // ================================================================
    // 677 — Inferno (Ignition — Special Summon dalla mano)
    // Bandisci 1 mostro FUOCO dal proprio Cimitero per Special Summonarla
    // dalla mano. Se distrugge un mostro dell'avversario in battaglia:
    // 1500 danni (damageOnBattleDestroy, actions.js).
    // ================================================================
    CardEffects.register(677, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster' && c.attribute === 'FUOCO');
        },
        getSpecialSummonBanishFilters() {
            return [(c) => c.type === 'monster' && c.attribute === 'FUOCO'];
        },
        paySpecialSummonCost(ctx) {
            return resolveSpecialSummonBanishCost(ctx, [(c) => c.type === 'monster' && c.attribute === 'FUOCO'], '🔥 Inferno bandisce 1 mostro FUOCO dal Cimitero per essere Special Summonata!');
        },
        damageOnBattleDestroy: 1500
    });

    // ================================================================
    // 678 — Zombie Fuso / Molten Zombie
    // Quando Special Summonata dal Cimitero: pesca 1 carta.
    // ================================================================
    CardEffects.register(678, {
        onSpecialSummon(ctx) {
            if (ctx.summonedFromZone !== 'graveyard') return;
            ctx.drawCards(ctx.owner, 1);
            ctx.log('🔥 Zombie Fuso pesca 1 carta!');
        }
    });

    // ================================================================
    // 679 — Drago Vampata Solare / Solar Flare Dragon. Entrambe le
    // clausole sono implementate: mentre si controlla un altro mostro
    // Piroico non può essere bersaglio di un attacco, e durante
    // ciascuna propria End Phase infligge 500 danni all'avversario.
    // ================================================================
    CardEffects.register(679, {
        static(ctx) {
            const hasOtherPyro = ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.uid !== ctx.card.uid && slot.card.race === 'Piroico');
            if (hasOtherPyro) {
                gameState.cannotBeAttackTargetUids[ctx.card.uid] = true;
            }
        },
        onEndPhase(ctx) {
            ctx.dealDamage(ctx.opponent, 500);
            ctx.log('🔥 Drago Ondata Solare infligge 500 danni!');
        }
    });

    // ================================================================
    // 680 — Ragazzo del Baseball Estremo / Ultimate Baseball Kid
    // +1000 ATK per ogni altro mostro FUOCO scoperto sul Terreno.
    // Ignition: manda 1 altro mostro FUOCO scoperto al Cimitero per
    // infliggere 500 danni.
    // ================================================================
    CardEffects.register(680, {
        static(ctx) {
            const count = Tavolo.ordine().reduce((sum, owner) => sum + ctx.field(owner).filter((s) => s && !s.isFaceDown && s.card.attribute === 'FUOCO' && s.card.uid !== ctx.card.uid).length, 0);
            const e = gameState.atkDefBonus[ctx.card.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[ctx.card.uid] = { atk: e.atk + count * 1000, def: e.def };
        },
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.attribute === 'FUOCO' && s.card.uid !== ctx.card.uid);
        },
        activate(ctx) {
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((s) => s && !s.isFaceDown && s.card.attribute === 'FUOCO' && s.card.uid !== ctx.card.uid);
            if (index === -1) return;
            const sent = field[index].card;
            ctx.graveyard(ctx.owner).push(sent);
            field[index] = null;
            ctx.dealDamage(ctx.opponent, 500);
            ctx.log(`⚾ Giovane Promessa del Baseball manda ${sent.name} al Cimitero e infligge 500 danni!`);
        }
    });

    // ================================================================
    // 681 — Folletto della Fiamma Furente / Raging Flame Sprite (statico +
    // onDealsBattleDamage). "Può attaccare direttamente" implementato via
    // gameState.directAttackAllowedUids (sempre attivo, nessuna
    // condizione) — vedi resolveAttack/actions.js e ai-medium.js/
    // ai-hard.js per la scelta del bot.
    CardEffects.register(681, {
        static(ctx) {
            gameState.directAttackAllowedUids[ctx.card.uid] = true;
        },
        onDealsBattleDamage(ctx) {
            if (ctx.targetIndex !== -1) return;
            ctx.card.attack = (ctx.card.attack || 0) + 1000;
            ctx.log('🔥 Folletto della Fiamma Infuriato guadagna 1000 ATK!');
        }
    });

    // ================================================================
    // 682 — Thestalos il Monarca della Tempesta di Fuoco
    // Se Evocata Tributo: l'avversario scarta 1 carta a caso; se era un
    // Mostro, infliggi danni pari al suo Livello originale x 100.
    // ================================================================
    CardEffects.register(682, {
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            const discarded = ctx.discardRandomFromHand(ctx.opponent);
            if (!discarded) return;
            if (discarded.type === 'monster') {
                const damage = (discarded.level || 0) * 100;
                ctx.dealDamage(ctx.opponent, damage);
                ctx.log(`🔥 Thestalos scarta ${discarded.name} e infligge ${damage} danni!`);
            } else {
                ctx.log(`🔥 Thestalos scarta ${discarded.name} (non un Mostro: nessun danno).`);
            }
        }
    });

    // ================================================================
    // 683 — Anima di Gaia il Collettivo Combustibile / Gaia Soul the
    // Combustible Collective
    // Una volta per turno (Ignition): sacrifica fino a 2 mostri Tipo
    // Piroico; guadagna 1000 ATK per ciascuno (permanente). Danno
    // perforante (def.piercing, actions.js). Alla End Phase: si
    // distrugge da sola.
    // ================================================================
    CardEffects.register(683, {
        piercing: true,
        canActivate(ctx) {
            if (gameState.usedIgnitionThisTurn && gameState.usedIgnitionThisTurn[ctx.card.uid]) return false;
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.race === 'Piroico' && s.card.uid !== ctx.card.uid);
        },
        activate(ctx) {
            const field = ctx.field(ctx.owner);
            let sacrificed = 0;
            for (let i = 0; i < field.length && sacrificed < 2; i++) {
                const s = field[i];
                if (!s || s.isFaceDown || s.card.race !== 'Piroico' || s.card.uid === ctx.card.uid) continue;
                ctx.graveyard(ctx.owner).push(s.card);
                field[i] = null;
                sacrificed++;
            }
            if (sacrificed === 0) return;
            ctx.card.attack = (ctx.card.attack || 0) + sacrificed * 1000;
            ctx.log(`🔥 Anima di Gaia sacrifica ${sacrificed} mostr${sacrificed === 1 ? 'o' : 'i'} Piroic${sacrificed === 1 ? 'o' : 'i'} e guadagna ${sacrificed * 1000} ATK!`);
        },
        onEndPhase(ctx) {
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((s) => s && s.card.uid === ctx.card.uid);
            if (index === -1) return;
            ctx.destroyMonster(ctx.owner, index);
            ctx.log('🔥 Anima di Gaia si distrugge alla End Phase!');
        }
    });

    // ================================================================
    // 684 — Fuoco Fatuo / Fox Fire (onDestroy — distrutto in battaglia)
    // Alla End Phase, se distrutta in battaglia in questo turno:
    // Special Summon dal Cimitero. cannotBeTributed: non può essere
    // sacrificata per un'Evocazione Tributo mentre scoperta sul Terreno
    // — controllato in handleTributeSelectClick/attemptMonsterSummon
    // (actions.js), lato giocatore (SEMPLIFICAZIONE: non applicato alla
    // selezione Tributi del bot, che non pesa questo tipo di divieto).
    // ================================================================
    CardEffects.register(684, {
        cannotBeTributed: true,
        onDestroy(ctx) {
            ctx.card._foxFireReviveTurn = gameState.turn;
        },
        onEndPhase(ctx) {
            const grave = ctx.graveyard(ctx.owner);
            const index = grave.findIndex((c) => c.uid === ctx.card.uid && c._foxFireReviveTurn === gameState.turn);
            if (index === -1) return;
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) return;
            const [revived] = grave.splice(index, 1);
            ctx.specialSummon(ctx.owner, revived, slotIndex, 'attack', 'graveyard');
            ctx.log('🦊 Volpe di Fuoco risorge dal Cimitero!');
        }
    });

    // ================================================================
    // 685 — Distruzione Fusa / Molten Destruction (Magia Terreno)
    // Tutti i mostri FUOCO: +500 ATK / -400 DEF. Stesso schema di Zona
    // Plasma Mistica (id 619).
    // ================================================================
    CardEffects.register(685, {
        continuous: true,
        activate(ctx) {
            ctx.log('🌋 Distruzione Infuocata attivata!');
        },
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown || slot.card.attribute !== 'FUOCO') return;
                    const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    gameState.atkDefBonus[slot.card.uid] = { atk: e.atk + 500, def: e.def - 400 };
                });
            });
        }
    });

    // ================================================================
    // 686 — Camera Oscura degli Incubi / Dark Room of Nightmare
    // (Trappola Continua). Ogni volta che l'avversario subisce danno da
    // un effetto Carta (eccetto questa carta): infliggigli 300 danni in
    // più. Effetto interamente in
    // ACTIONS.dealDamage (duel-engine.js, live check sul campo, stesso
    // stile di Sosia id 204) — activate() qui sotto non fa altro che
    // confermarla scoperta sul Terreno (continuous:true).
    // ================================================================
    CardEffects.register(686, {
        continuous: true,
        activate(ctx) {
            ctx.log('🌑 Camera Oscura dell\'Incubo si attiva!');
        }
    });

    // ================================================================
    // 687 — Limite di Livello - Area B / Level Limit - Area B (Magia
    // Continua)
    // Cambia in Posizione di Difesa tutti i mostri scoperti di Livello 4
    // o superiore, di entrambi i giocatori — ricalcolato ad ogni render.
    // ================================================================
    CardEffects.register(687, {
        continuous: true,
        activate(ctx) {
            ctx.log('📉 Livello Limite - Area B attivato!');
        },
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (slot && !slot.isFaceDown && (slot.card.level || 0) >= 4) slot.position = 'defense';
                });
            });
        }
    });

    // ================================================================
    // 688 — Collana del Comando / Necklace of Command (Equipaggiamento)
    // Nessun bonus ATK/DEF. NON usa isEquip/equippedTarget: quel
    // meccanismo generico (recomputeStaticEffects, duel-engine.js)
    // manda già da solo al Cimitero una Carta Equipaggiamento con
    // bersaglio non più valido PRIMA di chiamare static() — quindi non
    // lascerebbe mai il tempo di eseguire l'effetto "pesca 1 carta" da
    // dentro static(). Qui si traccia il bersaglio a mano (stesso
    // pattern targetOwner/targetIndex/targetUid di Incantesimo Ombra id
    // 439/Cerchio Ammaliante id 620) apposta per poter agganciare il
    // proprio effetto al momento della pulizia. Il bonus pesca/scarta
    // scatta SOLO quando il bersaglio è stato distrutto IN BATTAGLIA
    // (onOwnMonsterDestroyedPassive, ctx.destroyedInBattle — ora
    // raggiungibile anche da una carta in zona Magia/Trappola come questa,
    // vedi notifyOwnMonsterSentToGraveyard in duel-engine.js), non per
    // ogni altro motivo di invalidità del bersaglio (che continua comunque
    // a mandare questa carta al Cimitero, senza bonus).
    // ================================================================
    CardEffects.register(688, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, () => true) !== -1; },
        activate(ctx) {
            // A quale mostro agganciarla lo sceglie il giocatore (prima era
            // sempre il primo idoneo da sinistra), con il checkpoint di
            // targeting come ogni Equip. Mentre la lista è aperta la carta è
            // già in campo senza bersaglio: `equipInScelta` impedisce al suo
            // static() qui sotto di scambiarla per orfana e mandarla al
            // Cimitero (stesso guasto corretto in equipToChosenTarget).
            const candidati = collectEquipTargets(ctx, () => true);
            if (candidati.length === 0) return;
            const card = ctx.card;
            card.equipInScelta = true;
            const sceltaChiusa = () => { delete card.equipInScelta; };
            chooseFieldCardTargetWaiting(ctx, candidati, {
                title: '📿 Amuleto del Comando',
                text: 'Scegli a quale tuo mostro equipaggiare questa carta.',
                dichiara: true,
                onNegato: sceltaChiusa
            }, (scelto) => {
                sceltaChiusa();
                const slot = ctx.field(scelto.owner)[scelto.index];
                if (!slot || slot.card.uid !== scelto.card.uid) return;
                card.targetOwner = scelto.owner;
                card.targetIndex = scelto.index;
                card.targetUid = slot.card.uid;
                card._targetDestroyedInBattle = false;
                ctx.log(`📿 Amuleto del Comando equipaggiata a ${slot.card.name}!`);
            });
        },
        // "Quando un mostro che controlli equipaggiato con questa carta
        // viene distrutto IN BATTAGLIA": ctx.card._targetDestroyedInBattle,
        // impostato SOLO quando notifyOwnMonsterSentToGraveyard
        // (duel-engine.js, ora estesa anche alla zona Magia/Trappola)
        // segnala che il bersaglio agganciato (targetUid) è stato mandato
        // al Cimitero con ctx.destroyedInBattle true — consumato subito
        // sotto in static(), che ripulisce la carta per QUALUNQUE motivo
        // di invalidità del bersaglio (ritorno in mano, Sacrificio,
        // distruzione da effetto Carta...) ma applica il bonus
        // pesca/scarta SOLO quando questo flag risulta impostato.
        onOwnMonsterDestroyedPassive(ctx) {
            if (!ctx.destroyedInBattle) return;
            if (!ctx.destroyedCard || ctx.destroyedCard.uid !== ctx.card.targetUid) return;
            ctx.card._targetDestroyedInBattle = true;
        },
        static(ctx) {
            // Bersaglio ancora da scegliere: non è orfana (vedi activate).
            if (ctx.card.equipInScelta) return;
            const targetSlot = ctx.card.targetOwner != null ? ctx.field(ctx.card.targetOwner)[ctx.card.targetIndex] : null;
            const validTarget = targetSlot && !targetSlot.isFaceDown && targetSlot.card.uid === ctx.card.targetUid;
            if (validTarget) return;
            ctx.stField(ctx.owner)[ctx.index] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            if (!ctx.card._targetDestroyedInBattle) {
                ctx.log('📿 Amuleto del Comando va al Cimitero: il bersaglio equipaggiato non è più valido (nessuna distruzione in battaglia, nessun bonus).');
                return;
            }
            const drawOption = () => {
                ctx.drawCards(ctx.owner, 1);
                ctx.log('📿 Amuleto del Comando va al Cimitero e pesca 1 carta!');
            };
            const discardOption = () => {
                const discarded = ctx.discardRandomFromHand(ctx.opponent);
                ctx.log(`📿 Amuleto del Comando va al Cimitero: ${ctx.opponent === 'player' ? 'scarti' : 'il bot scarta'}${discarded ? ` ${discarded.name}` : ''} a caso dalla mano!`);
            };
            // Scelta reale tra le due opzioni (DuelEngineUI.openChoicePopover,
            // gia' usato altrove per scelte binarie) — SCOPERTA: la nota
            // precedente diceva che questa carta pescasse sempre 1 carta
            // senza scelta, ma il componente per farla scegliere esisteva
            // gia'. Il bot (nessuna vera IA dedicata) sceglie sempre di
            // pescare, l'opzione piu' sicura.
            if (Decisioni.rispondeUnaPersona(ctx.owner)) {
                Decisioni.chiedi({
                    chi: ctx.owner,
                    tipo: 'coppia',
                    titolo: '📿 Amuleto del Comando',
                    candidati: [
                        { icon: '🃏', label: 'Pesca 1 carta', onSelect: drawOption },
                        { icon: '🗑️', label: "L'avversario scarta 1 carta a caso", onSelect: discardOption }
                    ]
                }, (scelta) => {
                    if (scelta) scelta.onSelect();
                });
            } else {
                drawOption();
            }
        }
    });

    // ================================================================
    // 689 — Scudo Magico Tipo-8 / Spell Shield Type-8 (Trappola
    // Contatore)
    // Attiva 1 di questi 2 effetti:
    //  ① GRATIS: quando una Magia che bersaglia esattamente 1 mostro sul
    //     Terreno viene attivata, annullala e distruggila — nessun costo,
    //     ma serve declaredTargeting (vedi il commento su questo campo
    //     in cima al file) per riconoscere il bersaglio.
    //  ② A COSTO: quando una Magia QUALUNQUE viene attivata, manda 1
    //     Magia dalla mano al Cimitero per annullarla e distruggerla —
    //     stesso schema di Interferenza Magica (id 361), il vecchio unico
    //     comportamento di questa carta prima di questo fix.
    // Sceglie da sola la modalità ① (gratis) quando disponibile, altrimenti
    // la ② — stesso spirito "preferisci l'opzione più forte/gratuita"
    // già usato per Controllore del Nemico (id 226) in questo file,
    // invece di un'interfaccia di scelta dedicata.
    // ================================================================
    CardEffects.register(689, {
        canActivate(ctx) {
            const chain = ctx.gameState.chain;
            if (!chain || !chain.links || chain.links.length === 0) return false;
            const top = chain.links[chain.links.length - 1];
            if (top.card.type !== 'spell') return false;
            const dt = top.def && top.def.declaredTargeting;
            const freeModeAvailable = !!dt && dt.count === 1 && dt.cardType === 'monster';
            const costModeAvailable = ctx.hand(ctx.owner).some((c) => c.type === 'spell');
            return freeModeAvailable || costModeAvailable;
        },
        activate(ctx) {
            const chain = ctx.gameState.chain;
            const top = chain.links[chain.links.length - 1];
            const dt = top.def && top.def.declaredTargeting;
            const freeModeAvailable = !!dt && dt.count === 1 && dt.cardType === 'monster';
            if (freeModeAvailable) {
                if (ctx.negateActivation()) {
                    ctx.log('🛡️ Scudo Magico Tipo-8 annulla e distrugge la Magia (bersaglio 1 mostro, nessun costo)!');
                } else {
                    ctx.log('🛡️ Scudo Magico Tipo-8 non trova più nulla da annullare.');
                }
                return;
            }
            const hand = ctx.hand(ctx.owner);
            const index = hand.findIndex((c) => c.type === 'spell');
            if (index === -1) return;
            const discarded = ctx.discardChosenFromHand(ctx.owner, index);
            if (ctx.negateActivation()) {
                ctx.log(`🛡️ Scudo Magico Tipo-8 manda ${discarded.name} al Cimitero e annulla la Magia!`);
            } else {
                ctx.log(`🛡️ Scudo Magico Tipo-8 manda ${discarded.name} al Cimitero, ma non c'era più nulla da annullare.`);
            }
        }
    });

    // ================================================================
    // 690 — Ritorno di Fiamma / Backfire (Trappola Continua)
    // Se un mostro FUOCO scoperto che si controlla viene distrutto e
    // mandato al Cimitero: infliggi 500 danni all'avversario. Riusa
    // onOwnMonsterDestroyed (duel-engine.js), già pronto ma non ancora
    // usato da nessuna carta di questo dataset.
    // BUG REALE corretto in questa sessione: `canActivate` leggeva
    // `ctx.destroyedCard` — un campo che esiste SOLO nel ctx reattivo
    // passato a `onOwnMonsterDestroyed`, mai nel ctx di un'attivazione
    // manuale (mettere scoperta la Trappola dal Terreno) — quindi
    // `canActivate` lanciava SEMPRE un'eccezione (`ctx.destroyedCard` è
    // undefined lì), rendendo questa Trappola impossibile da attivare in
    // qualunque momento reale: esattamente il sintomo "il mazzo Fiamma è
    // buggato con alcune carte" segnalato dall'utente. La condizione
    // "il mostro distrutto è FUOCO" è già garantita da `onOwnMonsterDestroyed`
    // stesso (vedi duel-engine.js, ON_DESTROY: quel trigger passa solo i
    // PROPRI mostri distrutti, il filtro Attributo va fatto lì dentro, non
    // in canActivate) — nessun `canActivate` extra serve, la Trappola è
    // sempre attivabile con la normale tempistica di ogni altra Trappola.
    // ================================================================
    CardEffects.register(690, {
        continuous: true,
        activate(ctx) {
            ctx.log('🔥 Ritorno di Fiamma è ora sul Terreno!');
        },
        onOwnMonsterDestroyed(ctx) {
            if (!ctx.destroyedCard || ctx.destroyedCard.attribute !== 'FUOCO') return;
            ctx.dealDamage(ctx.opponent, 500);
            ctx.log(`🔥 Ritorno di Fiamma infligge 500 danni per la distruzione di ${ctx.destroyedCard.name}!`);
        }
    });

    // ================================================================
    // 691 — Signore Drago Oceanico - Neo-Daedalus / Ocean Dragon Lord -
    // Neo-Daedalus
    // Special Summon dalla mano sacrificando 1 Levia-Dragon - Daedalus
    // (id 700). Ignition: manda 1 "Umi" (id 497) scoperta che si
    // controlla al Cimitero per mandare al Cimitero TUTTE le carte nella
    // mano di entrambi i giocatori e sul Terreno (mostri, Magie/Trappole,
    // Magia Terreno), eccetto questa carta — stesso schema di 700
    // Levia-Dragon - Daedalus qui sopra (accesso a "Umi" tramite
    // gameState.playerFieldSpell/botFieldSpell, MAI ctx.stField — vedi il
    // bug reale corretto lì), esteso anche allo svuotamento delle mani.
    // ================================================================
    CardEffects.register(691, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.field(ctx.owner).some((slot) => slot && !slot.isFaceDown && slot.card.id === 700);
        },
        paySpecialSummonCost(ctx) {
            const field = ctx.field(ctx.owner);
            const index = field.findIndex((slot) => slot && !slot.isFaceDown && slot.card.id === 700);
            if (index === -1) return false;
            ctx.graveyard(ctx.owner).push(field[index].card);
            field[index] = null;
            ctx.log('🐉 Signore Drago Oceanico sacrifica Levia-Dragon - Daedalus per essere Special Summonato!');
            return true;
        },
        canActivate(ctx) {
            const fs = Tavolo.magiaTerreno(ctx.owner);
            return !!(fs && !fs.isFaceDown && fs.card.id === 497);
        },
        activate(ctx) {
            const fs = Tavolo.magiaTerreno(ctx.owner);
            if (!fs || fs.isFaceDown || fs.card.id !== 497) return;
            const umi = fs.card;
            ctx.graveyard(ctx.owner).push(umi);
            gameState[Tavolo.chiave(ctx.owner, 'FieldSpell')] = null;

            let sent = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => {
                    if (!slot || slot.card.uid === ctx.card.uid) return;
                    ctx.graveyard(owner).push(slot.card);
                    ctx.field(owner)[index] = null;
                    sent++;
                });
                ctx.stField(owner).forEach((slot, index) => {
                    if (!slot) return;
                    ctx.graveyard(owner).push(slot.card);
                    ctx.stField(owner)[index] = null;
                    sent++;
                });
                const fieldSpellKey = Tavolo.chiave(owner, 'FieldSpell');
                if (gameState[fieldSpellKey] && owner !== ctx.owner) {
                    ctx.graveyard(owner).push(gameState[fieldSpellKey].card);
                    gameState[fieldSpellKey] = null;
                    sent++;
                }
                const hand = ctx.hand(owner);
                while (hand.length > 0) {
                    ctx.graveyard(owner).push(hand.pop());
                    sent++;
                }
            });
            ctx.log(`🌊 Signore Drago Oceanico manda Umi al Cimitero e manda al Cimitero ${sent} carte tra mano e Terreno di entrambi i giocatori!`);
        }
    });

    // ================================================================
    // 693 — Manta Perforante Strisciante / Creeping Doom Manta
    // Quando Evocata Normalmente con successo: nessuna Trappola può
    // essere attivata per il resto del turno (gameState.noTrapActivationFor,
    // controllato in canActivate() — duel-engine.js — e resettato in
    // changeTurn() — game-flow.js).
    // ================================================================
    CardEffects.register(693, {
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            gameState.noTrapActivationFor = gameState.noTrapActivationFor || {};
            gameState.noTrapActivationFor.player = true;
            gameState.noTrapActivationFor.bot = true;
            ctx.log('🦇 Manta del Fato Incedente blocca tutte le Trappole per il resto del turno!');
        }
    });

    // ================================================================
    // 695 — Madre Grizzly / Mother Grizzly (onDestroy — distrutto in
    // battaglia)
    // Quando distrutta in battaglia: Special Summon 1 mostro ACQUA con
    // 1500 o meno ATK dal Deck — vera scelta tramite
    // searchDeckWithChoice, stesso schema di Ratto Gigante (id 614).
    // ================================================================
    CardEffects.register(695, {
        onDestroy(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.attribute === 'ACQUA' && c.attack <= 1500, {
                title: '🐻 Madre Grizzly',
                text: 'Scegli quale mostro ACQUA (1500 ATK o meno) Special Summonare dal Deck.'
            }, (card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
                ctx.log(`🐻 Madre Grizzly Special Summona ${card.name} dal Deck!`);
            });
        }
    });

    // ================================================================
    // 696 — Ragazzo Stella / Star Boy (statico, entrambi i lati)
    // Tutti i mostri ACQUA sul Terreno: +500 ATK. Tutti i mostri FUOCO
    // sul Terreno: -400 ATK. Stesso schema di Piccola Chimera (id 676).
    // ================================================================
    CardEffects.register(696, {
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (!slot || slot.isFaceDown) return;
                    const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    if (slot.card.attribute === 'ACQUA') gameState.atkDefBonus[slot.card.uid] = { atk: e.atk + 500, def: e.def };
                    else if (slot.card.attribute === 'FUOCO') gameState.atkDefBonus[slot.card.uid] = { atk: e.atk - 400, def: e.def };
                });
            });
        }
    });

    // ================================================================
    // 697 — Virus Infetta-Tribù / Tribe-Infecting Virus (Ignition)
    // Scarta 1 carta e dichiara 1 Tipo; distruggi tutti i mostri
    // scoperti di quel Tipo sul Terreno.
    // SEMPLIFICAZIONE residua: dichiara automaticamente il Tipo più diffuso
    // tra i mostri scoperti dell'avversario, invece di lasciar scegliere.
    // La carta da scartare come costo è invece ora una vera scelta
    // (offerHandDiscardChoice) — bug reale corretto in questa sessione.
    // ================================================================
    CardEffects.register(697, {
        canActivate(ctx) {
            return ctx.hand(ctx.owner).length > 0 && ctx.field(ctx.opponent).some((s) => s && !s.isFaceDown);
        },
        activate(ctx) {
            offerHandDiscardChoice(ctx, {
                title: '🦠 Virus Infetta-Tribù',
                text: 'Scegli quale carta scartare dalla mano.'
            }, (discarded) => {
                const raceCounts = {};
                ctx.field(ctx.opponent).forEach((s) => {
                    if (s && !s.isFaceDown) raceCounts[s.card.race] = (raceCounts[s.card.race] || 0) + 1;
                });
                const declaredRace = Object.keys(raceCounts).sort((a, b) => raceCounts[b] - raceCounts[a])[0];
                if (!declaredRace) return;

                let destroyed = 0;
                Tavolo.ordine().forEach((owner) => {
                    ctx.field(owner).forEach((slot, index) => {
                        if (slot && !slot.isFaceDown && slot.card.race === declaredRace) {
                            ctx.destroyMonster(owner, index);
                            destroyed++;
                        }
                    });
                });
                ctx.log(`🦠 Virus Infetta-Tribù scarta ${discarded.name}, dichiara "${declaredRace}" e distrugge ${destroyed} mostr${destroyed === 1 ? 'o' : 'i'}!`);
            });
        }
    });

    // ================================================================
    // 698 — Fenrir (Special Summon dalla mano bandendo 2 ACQUA dal
    // Cimitero)
    // Se distrugge un mostro dell'avversario in battaglia: l'avversario
    // salta la sua prossima Draw Phase (riusa gameState.skipDrawFor,
    // costruito per Avidità Sconsiderata id 653).
    // ================================================================
    CardEffects.register(698, {
        cannotNormalSummon: true,
        canSpecialSummonFromHand(ctx) {
            return ctx.graveyard(ctx.owner).filter((c) => c.type === 'monster' && c.attribute === 'ACQUA').length >= 2;
        },
        getSpecialSummonBanishFilters() {
            const isWater = (c) => c.type === 'monster' && c.attribute === 'ACQUA';
            return [isWater, isWater];
        },
        paySpecialSummonCost(ctx) {
            const isWater = (c) => c.type === 'monster' && c.attribute === 'ACQUA';
            return resolveSpecialSummonBanishCost(ctx, [isWater, isWater], '🐺 Fenrir bandisce 2 mostri ACQUA dal Cimitero per essere Special Summonato!');
        },
        onDealsBattleDamage(ctx) {
            // Solo se ha distrutto un mostro (non su un attacco diretto).
            if (ctx.targetIndex === -1) return;
            gameState.skipDrawFor = gameState.skipDrawFor || {};
            gameState.skipDrawFor[ctx.opponent] = (gameState.skipDrawFor[ctx.opponent] || 0) + 1;
            ctx.log("🐺 Fenrir fa saltare all'avversario la sua prossima Draw Phase!");
        }
    });

    // ================================================================
    // 699 — Bugroth Anfibio MK-3 / Amphibious Bugroth MK-3 (statico)
    // Finché "Umi" (id 497) è scoperta sul Terreno (di uno qualsiasi dei
    // due giocatori): può attaccare direttamente
    // (gameState.directAttackAllowedUids, stesso meccanismo di Sparatore
    // Sonico id 773/Drago Spada di Alligatore id 84 qui sopra).
    // ================================================================
    CardEffects.register(699, {
        static(ctx) {
            const umiOnField = ['playerFieldSpell', 'botFieldSpell'].some((key) => {
                const fs = gameState[key];
                return fs && !fs.isFaceDown && fs.card.id === 497;
            });
            if (umiOnField) {
                gameState.directAttackAllowedUids[ctx.card.uid] = true;
            }
        }
    });

    // ================================================================
    // 700 — Levia-Dragon - Daedalus
    // Ignition: manda 1 "Umi" (id 497) scoperta che si controlla al
    // Cimitero per distruggere tutte le altre carte sul Terreno.
    // BUG REALE corretto qui: cercava Umi in ctx.stField (la zona
    // Magia/Trappola a 5 caselle) invece che in gameState.playerFieldSpell/
    // botFieldSpell (la zona dedicata alle Magie Terreno, dove "Umi" vive
    // SEMPRE — card.subtype === 'field', vedi summonMonster/placeDraggedCard
    // in actions.js) — canActivate tornava sempre false nella pratica,
    // rendendo questo Ignition effect codice morto. Stesso schema di
    // accesso già usato correttamente da 699/701/691 per lo stesso "Umi".
    // ================================================================
    CardEffects.register(700, {
        canActivate(ctx) {
            const fs = Tavolo.magiaTerreno(ctx.owner);
            return !!(fs && !fs.isFaceDown && fs.card.id === 497);
        },
        activate(ctx) {
            const fs = Tavolo.magiaTerreno(ctx.owner);
            if (!fs || fs.isFaceDown || fs.card.id !== 497) return;
            const umi = fs.card;
            ctx.graveyard(ctx.owner).push(umi);
            gameState[Tavolo.chiave(ctx.owner, 'FieldSpell')] = null;

            let destroyed = 0;
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => {
                    if (!slot || slot.card.uid === ctx.card.uid) return;
                    ctx.graveyard(owner).push(slot.card);
                    ctx.field(owner)[index] = null;
                    destroyed++;
                });
                ctx.stField(owner).forEach((slot, index) => {
                    if (!slot) return;
                    ctx.graveyard(owner).push(slot.card);
                    ctx.stField(owner)[index] = null;
                    destroyed++;
                });
                // La propria Umi è già stata mandata al Cimitero come costo
                // qui sopra: questa seconda Magia Terreno riguarda solo
                // l'EVENTUALE Magia Terreno dell'AVVERSARIO ancora sul
                // Terreno — "tutte le altre carte sul Terreno" del testo
                // reale include anche quella zona, non solo Mostri/ST.
                const oppFieldSpellKey = Tavolo.chiave(owner, 'FieldSpell');
                if (gameState[oppFieldSpellKey] && !(owner === ctx.owner)) {
                    ctx.graveyard(owner).push(gameState[oppFieldSpellKey].card);
                    gameState[oppFieldSpellKey] = null;
                    destroyed++;
                }
            });
            ctx.log(`🌊 Levia-Dragon manda Umi al Cimitero e distrugge ${destroyed} altre carte sul Terreno!`);
        }
    });

    // ================================================================
    // 701 — Cavaliere Sirena / Mermaid Knight
    // Finché "Umi" (id 497) è scoperta sul Terreno (di ENTRAMBI i
    // giocatori, testo reale "on the field" senza restrizione di
    // proprietario): può attaccare due volte — def.getExtraAttackCount(ctx),
    // lo stesso meccanismo dinamico già usato da Samurai Armato - Ben
    // Kei (id 721), al posto del semplice canAttackTwice fisso di prima
    // (che ignorava la condizione).
    // ================================================================
    CardEffects.register(701, {
        getExtraAttackCount(ctx) {
            const hasUmi = Tavolo.ordine().some((owner) => ctx.stField(owner).some((s) => s && !s.isFaceDown && s.card.id === 497));
            return hasUmi ? 1 : 0;
        }
    });

    // ================================================================
    // 702 — Mobius il Monarca del Gelo / Mobius the Frost Monarch
    // Se Evocata Tributo: distruggi fino a 2 Magie/Trappole sul Terreno.
    // ================================================================
    CardEffects.register(702, {
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            const candidates = [];
            Tavolo.ordine().forEach((owner) => {
                ctx.stField(owner).forEach((slot, index) => { if (slot) candidates.push({ owner, index, card: slot.card }); });
            });
            let destroyed = 0;
            for (const c of candidates) {
                if (destroyed >= 2) break;
                const slot = ctx.stField(c.owner)[c.index];
                if (!slot) continue;
                if (slot.isFaceDown) slot.isFaceDown = false;
                ctx.graveyard(c.owner).push(slot.card);
                ctx.stField(c.owner)[c.index] = null;
                destroyed++;
            }
            if (destroyed > 0) ctx.log(`❄️ Mobius il Monarca Glaciale distrugge ${destroyed} Magia/Trappola!`);
        }
    });

    // ================================================================
    // 704 — Salvataggio / Salvage (Magia Normale)
    // Scegli come bersaglio 2 mostri ACQUA con 1500 o meno ATK nel
    // Cimitero; aggiungili alla mano.
    // ================================================================
    CardEffects.register(704, {
        canActivate(ctx) {
            return ctx.graveyard(ctx.owner).filter((c) => c.type === 'monster' && c.attribute === 'ACQUA' && c.attack <= 1500).length > 0;
        },
        activate(ctx) {
            // Due scelte IN SEQUENZA: la seconda vive dentro la callback
            // della prima, perché il picker è asincrono — aprirle insieme
            // mostrerebbe due liste sovrapposte, e la seconda calcolata
            // prima lavorerebbe su un Cimitero già cambiato.
            const filtro = (c) => c.type === 'monster' && c.attribute === 'ACQUA' && c.attack <= 1500;
            let recuperati = 0;
            const fine = () => {
                ctx.log(`🌊 Salvataggio recupera ${recuperati} mostr${recuperati === 1 ? 'o' : 'i'} dal Cimitero!`);
            };
            const prendi = (restanti) => {
                if (restanti === 0) { fine(); return; }
                // searchGraveyardWithChoice toglie già la carta dal
                // Cimitero prima di chiamarci: qui resta solo da metterla
                // in mano.
                const trovato = searchGraveyardWithChoice(ctx, ctx.owner, filtro, {
                    title: '🌊 Salvataggio',
                    text: `Scegli il mostro ACQUA da recuperare (${recuperati + 1} di 2).`
                }, (card) => {
                    ctx.hand(ctx.owner).push(card);
                    recuperati++;
                    prendi(restanti - 1);
                });
                if (!trovato) fine();   // finiti i candidati prima di arrivare a 2
            };
            prendi(2);
        }
    });

    // ================================================================
    // 705 — Colpo di Martello / Hammer Shot (Magia Normale)
    // Distruggi 1 mostro scoperto in Posizione di Attacco con l'ATK più
    // alto sul Terreno (entrambi i lati).
    // ================================================================
    CardEffects.register(705, {
        declaredTargeting: { count: 1, cardType: 'monster' },
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown && s.position === 'attack'));
        },
        activate(ctx) {
            let best = null;
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => {
                    if (!slot || slot.isFaceDown || slot.position !== 'attack') return;
                    const atk = DuelEngine.getEffectiveAtk(slot.card);
                    if (!best || atk > best.atk) best = { owner, index, atk, card: slot.card };
                });
            });
            if (!best) return;
            ctx.declareTargetWaiting(best.owner, best.index, { totalTargetCount: 1 }, (decl) => {
                if (!decl.allowed) return;
                const target = ctx.field(decl.targetOwner)[decl.targetIndex];
                ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                ctx.log(`🔨 Lancio del Martello distrugge ${target ? target.card.name : best.card.name}!`);
            });
        }
    });

    // ================================================================
    // 706 — Grande Onda Piccola Onda / Big Wave Small Wave (Magia
    // Normale)
    // Distruggi tutti i propri mostri ACQUA scoperti, poi Special
    // Summon mostri ACQUA dalla mano fino a quel numero.
    // ================================================================
    CardEffects.register(706, {
        canActivate(ctx) {
            return ctx.field(ctx.owner).some((s) => s && !s.isFaceDown && s.card.attribute === 'ACQUA');
        },
        activate(ctx) {
            const field = ctx.field(ctx.owner);
            let destroyed = 0;
            field.forEach((slot, index) => {
                // Guardiano Kay'est (id 285): "non è influenzata dagli
                // effetti delle Magie" copre anche questa distruzione di
                // massa non a bersaglio (non passa da declareTarget).
                if (slot && !slot.isFaceDown && slot.card.attribute === 'ACQUA' && !DuelEngine.getDefinition(slot.card.id)?.unaffectedBySpellEffects) {
                    ctx.graveyard(ctx.owner).push(slot.card);
                    field[index] = null;
                    destroyed++;
                }
            });
            const hand = ctx.hand(ctx.owner);
            let summoned = 0;
            while (summoned < destroyed) {
                const handIndex = hand.findIndex((c) => c.type === 'monster' && c.attribute === 'ACQUA');
                if (handIndex === -1) break;
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) break;
                const [card] = hand.splice(handIndex, 1);
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'hand');
                summoned++;
            }
            ctx.log(`🌊 Piccola Onda Grande Onda distrugge ${destroyed} mostr${destroyed === 1 ? 'o' : 'i'} e ne Special Summona ${summoned}!`);
        }
    });

    // ================================================================
    // 707 — Legame di Gravità / Gravity Bind (Trappola Continua)
    // I mostri di Livello 4 o superiore non possono attaccare, di
    // entrambi i giocatori.
    // ================================================================
    CardEffects.register(707, {
        continuous: true,
        activate(ctx) {
            ctx.log('⛓️ Legame Gravitazionale attivato!');
        },
        static(ctx) {
            Tavolo.ordine().forEach((owner) => {
                ctx.field(owner).forEach((slot) => {
                    if (slot && !slot.isFaceDown && (slot.card.level || 0) >= 4) gameState.cannotAttackUids[slot.card.uid] = true;
                });
            });
        }
    });

    // ================================================================
    // 709 — Gilford la Leggenda / Gilford the Legend
    // Quando Evocata Normalmente: equipaggia QUANTE PIÙ Carte
    // Equipaggiamento possibile dal Cimitero a un mostro Tipo Guerriero
    // che si controlla (limitato solo dalla disponibilità nel Cimitero e
    // dalle caselle libere in zona Magia/Trappola — nessuna scelta reale
    // da fare, il testo dice "tutte quelle che puoi").
    // ================================================================
    CardEffects.register(709, {
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            const targetIndex = ctx.field(ctx.owner).findIndex((s) => s && !s.isFaceDown && s.card.race === 'Guerriero');
            if (targetIndex === -1) return;
            const target = ctx.field(ctx.owner)[targetIndex].card;
            // Se le Equip nel Cimitero superano le caselle Magia/Trappola
            // libere (raro ma reale — l'ordine determinerebbe quali
            // restano nel Cimitero), lascia scegliere QUALI equipaggiare
            // invece di prenderle sempre nell'ordine trovato — un picker
            // in sequenza, mai una scelta parallela/sincrona (vedi
            // offerSpecialSummonBanishChoice per lo stesso principio).
            const equipNext = () => {
                if (ctx.stField(ctx.owner).findIndex((s) => s === null) === -1) return;
                searchGraveyardWithChoice(ctx, ctx.owner, (c) => c.type === 'spell' && c.subtype === 'equip', {
                    title: '⚔️ Gilford la Leggenda',
                    text: 'Scegli quale Carta Equipaggiamento recuperare dal Cimitero.'
                }, (equip) => {
                    const freeSlot = ctx.stField(ctx.owner).findIndex((s) => s === null);
                    if (freeSlot === -1) { ctx.graveyard(ctx.owner).push(equip); return; }
                    equip.equippedToOwner = ctx.owner;
                    equip.equippedToIndex = targetIndex;
                    equip.equippedToUid = target.uid;
                    ctx.stField(ctx.owner)[freeSlot] = { card: equip, isFaceDown: false, setOnTurn: gameState.turn };
                    ctx.log(`⚔️ Gilford la Leggenda equipaggia ${equip.name} a ${target.name}!`);
                    equipNext();
                });
            };
            equipNext();
        }
    });

    // ================================================================
    // 710 — Guerriera delle Terre Desolate / Warrior Lady of the
    // Wasteland (onDestroy — distrutto in battaglia)
    // Quando distrutta in battaglia: Special Summon 1 mostro Guerriero
    // TERRA con 1500 o meno ATK dal Deck.
    // ================================================================
    CardEffects.register(710, {
        onDestroy(ctx) {
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.race === 'Guerriero' && c.attribute === 'TERRA' && c.attack <= 1500, {
                title: '⚔️ Signora Guerriera delle Terre Desolate',
                text: 'Scegli quale mostro Guerriero TERRA (1500 ATK o meno) Special Summonare dal Deck.'
            }, (card) => {
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'deck');
                ctx.log(`⚔️ Signora Guerriera delle Terre Desolate Special Summona ${card.name} dal Deck!`);
            });
        }
    });

    // ================================================================
    // 712 — Guardiano Celtico Sgradito / Obnoxious Celtic Guard
    // Non può essere distrutto in battaglia da un mostro con 1900+ ATK —
    // immunità CONDIZIONATA (def.cannotBeDestroyedByBattle come funzione,
    // vedi actions.js).
    // ================================================================
    CardEffects.register(712, {
        cannotBeDestroyedByBattle: (opponentAtk) => (opponentAtk || 0) >= 1900
    });

    // ================================================================
    // 713 — Cavaliere Comandante / Command Knight (statico)
    // Tutti i mostri Tipo Guerriero che si controllano: +400 ATK. Se si
    // controlla un altro mostro (qualsiasi), questa carta stessa non può
    // essere scelta come bersaglio per gli attacchi (gameState.
    // cannotBeAttackTargetUids, duel-engine.js/actions.js).
    // ================================================================
    CardEffects.register(713, {
        static(ctx) {
            ctx.field(ctx.owner).forEach((slot) => {
                if (!slot || slot.isFaceDown || slot.card.race !== 'Guerriero') return;
                const e = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                gameState.atkDefBonus[slot.card.uid] = { atk: e.atk + 400, def: e.def };
            });
            const controlsAnotherMonster = ctx.field(ctx.owner).some((slot) => slot && slot.card.uid !== ctx.card.uid);
            if (controlsAnotherMonster) {
                gameState.cannotBeAttackTargetUids[ctx.card.uid] = true;
            }
        }
    });

    // ================================================================
    // 714 — Capitano Predone / Marauding Captain
    // Quando Evocata Normalmente: puoi Special Summonare 1 mostro di
    // Livello 4 o inferiore dalla mano, a scelta del giocatore.
    // L'avversario non può scegliere come bersaglio per gli attacchi i
    // mostri Tipo Guerriero controllati, eccetto questa carta stessa
    // (gameState.cannotBeAttackTargetUids).
    // ================================================================
    CardEffects.register(714, {
        onSummon(ctx) {
            if (ctx.summonedVia !== 'normal') return;
            if (ctx.findEmptyMonsterSlot(ctx.owner) === -1) return;
            chooseCardFromHand(ctx, {
                filter: (c) => c.type === 'monster' && (c.level || 0) <= 4,
                title: '⚔️ Capitano Saccheggiatore',
                text: 'Scegli quale mostro di Livello 4 o inferiore Special Summonare dalla mano.'
            }, (card, index) => {
                // La casella si ricontrolla QUI: fra l'apertura del picker
                // e il click il Terreno può essersi riempito.
                const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
                if (slotIndex === -1) return;
                ctx.hand(ctx.owner).splice(index, 1);
                ctx.specialSummon(ctx.owner, card, slotIndex, 'attack', 'hand');
                ctx.log(`⚔️ Capitano Saccheggiatore Special Summona ${card.name} dalla mano!`);
            });
        },
        static(ctx) {
            ctx.field(ctx.owner).forEach((slot) => {
                if (!slot || slot.isFaceDown || slot.card.uid === ctx.card.uid || slot.card.race !== 'Guerriero') return;
                gameState.cannotBeAttackTargetUids[slot.card.uid] = true;
            });
        }
    });

    // ================================================================
    // 715 — Forza Esiliata / Exiled Force (Ignition — auto-sacrificio)
    // Sacrifica questa carta per distruggere 1 mostro sul Terreno.
    // ================================================================
    CardEffects.register(715, {
        canActivate(ctx) {
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && s.card.uid !== ctx.card.uid));
        },
        activate(ctx) {
            // "Scegli come bersaglio 1 mostro sul Terreno": qualunque,
            // tranne se stessa (si sacrifica per farlo).
            const candidati = collectFieldTargets(ctx, {
                zone: 'monster', includiCoperte: true,
                filter: (card) => card.uid !== ctx.card.uid
            });
            if (candidati.length === 0) return;
            chooseFieldCardTarget(ctx, candidati, {
                title: '⚔️ Forza Esiliata',
                text: 'Sacrifica questa carta per distruggere il mostro che scegli.'
            }, (scelto) => {
                const decl = ctx.declareTarget(scelto.owner, scelto.index, { totalTargetCount: 1 });
                if (!decl.allowed) return;
                const finalSlot = ctx.field(decl.targetOwner)[decl.targetIndex];
                if (!finalSlot) return;
                const finalName = finalSlot.card.name;
                const field = ctx.field(ctx.owner);
                const selfIndex = field.findIndex((s) => s && s.card.uid === ctx.card.uid);
                if (selfIndex !== -1) {
                    ctx.graveyard(ctx.owner).push(ctx.card);
                    field[selfIndex] = null;
                }
                ctx.destroyMonster(decl.targetOwner, decl.targetIndex);
                ctx.log(`⚔️ Forza Esiliata si sacrifica e distrugge ${finalName}!`);
            });
        }
    });

    // ================================================================
    // 716 — D.D. Guerriera / D.D. Warrior Lady (onBattled) — stesso
    // identico meccanismo di Guerriero D.D. (id 179) qui sopra.
    // ================================================================
    CardEffects.register(716, {
        onBattled(ctx) {
            if (ctx.opponentSurvived) {
                const oppField = ctx.field(ctx.opponent);
                const oppIdx = oppField.findIndex((s) => s && s.card.uid === ctx.opponentCard.uid);
                if (oppIdx !== -1 && !blockBanishFromField(ctx, oppField[oppIdx].card)) {
                    const oppCard = oppField[oppIdx].card;
                    oppField[oppIdx] = null;
                    ctx.banish(ctx.opponent, oppCard);
                    ctx.log(`⚔️ Signora Guerriera D.D. bandisce ${ctx.opponentCard.name}!`);
                }
            }
            const ownField = ctx.field(ctx.owner);
            const ownIdx = ownField.findIndex((s) => s && s.card.uid === ctx.card.uid);
            if (ownIdx !== -1 && !blockBanishFromField(ctx, ctx.card)) {
                ownField[ownIdx] = null;
                ctx.banish(ctx.owner, ctx.card);
                ctx.log('⚔️ Signora Guerriera D.D. bandisce se stessa dopo aver combattuto!');
            }
        }
    });

    // ================================================================
    // 717 — Mataza il Fulminatore / Mataza the Zapper
    // Secondo attacco (canAttackTwice — vedi Cavaliere Sirena id 701) +
    // immunità al cambio di controllo (controlImmune, controllato
    // centralmente da ACTIONS.takeControl in duel-engine.js).
    // ================================================================
    CardEffects.register(717, {
        canAttackTwice: true,
        controlImmune: true
    });

    // ================================================================
    // 718 — Spadaccino Mistico LV2 / Mystic Swordsman LV2
    // Clausola 1: se attacca un mostro coperto in Posizione di Difesa, lo
    // distrugge all'inizio del Damage Step senza calcolo dei danni
    // (instantlyDestroysFaceDownDefender, caso speciale isolato in
    // resolveBattleDamage, actions.js — stesso flag di Paladino del Drago
    // Bianco/id 398).
    // Clausola 2: se distrugge un mostro dell'avversario in battaglia in
    // questo turno (onDestroysMonsterInBattle, actions.js — preciso: NON
    // scatta per un attacco diretto né per una battaglia che non distrugge
    // il bersaglio): alla End Phase si manda al Cimitero e Special
    // Summona Spadaccino Mistico LV4 (id 719) da mano o Deck. La
    // distruzione istantanea sopra conta come "ha distrutto un mostro" a
    // tutti gli effetti (fireOnDestroy scatta comunque).
    // ================================================================
    CardEffects.register(718, {
        instantlyDestroysFaceDownDefender: true,
        onDestroysMonsterInBattle(ctx) {
            ctx.card._swordsmanEvolveTurn = gameState.turn;
        },
        onEndPhase(ctx) {
            if (ctx.card._swordsmanEvolveTurn !== gameState.turn) return;
            let evolved = null;
            const hand = ctx.hand(ctx.owner);
            let zonaEvolved = null;
            const handIdx = hand.findIndex((c) => c.id === 719);
            if (handIdx !== -1) { [evolved] = hand.splice(handIdx, 1); zonaEvolved = 'hand'; }
            else {
                const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
                const deck = gameState[deckKey];
                if (Array.isArray(deck)) {
                    const deckIdx = deck.findIndex((c) => c.id === 719);
                    if (deckIdx !== -1) {
                        [evolved] = deck.splice(deckIdx, 1);
                        zonaEvolved = 'deck';
                        gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
                    }
                }
            }
            if (!evolved) return;
            const field = ctx.field(ctx.owner);
            const selfIndex = field.findIndex((s) => s && s.card.uid === ctx.card.uid);
            if (selfIndex === -1) return;
            field[selfIndex] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) { ctx.graveyard(ctx.owner).push(evolved); return; }
            ctx.specialSummon(ctx.owner, evolved, slotIndex, 'attack', zonaEvolved);
            ctx.log('⚔️ Spadaccino Mistico LV2 evolve in Spadaccino Mistico LV4!');
        }
    });

    // ================================================================
    // 719 — Spadaccino Mistico LV4 / Mystic Swordsman LV4
    // Non può essere Evocata Normalmente. All'inizio del Damage Step, se
    // attacca un mostro coperto in Difesa: distruggilo (onAttackDeclare
    // lato attaccante — vedi onOwnAttackDeclare in duel-engine.js, che
    // annulla l'attacco PRIMA che raggiunga resolveBattleDamage: per
    // questo timbra da sola _swordsmanEvolveTurn qui sotto, invece di
    // affidarsi solo a onDestroysMonsterInBattle, che scatta SOLO da una
    // battaglia normale — vedi applyBattleDestroyBonus, actions.js).
    // Evoluzione in Spadaccino Mistico LV6 (id 865, aggiunta al database
    // apposta per questo): stesso schema esatto già usato da Spadaccino
    // Mistico LV2->LV4 (id 718) qui sopra.
    // ================================================================
    CardEffects.register(719, {
        cannotNormalSummon: true,
        onDestroysMonsterInBattle(ctx) {
            ctx.card._swordsmanEvolveTurn = gameState.turn;
        },
        onOwnAttackDeclare(ctx) {
            if (typeof ctx.targetIndex !== 'number' || ctx.targetIndex === -1) return;
            const targetSlot = ctx.field(ctx.opponent)[ctx.targetIndex];
            if (targetSlot && targetSlot.isFaceDown && targetSlot.position === 'defense') {
                const name = targetSlot.card.name;
                ctx.destroyMonster(ctx.opponent, ctx.targetIndex);
                ctx.cancelAttack();
                // ctx.card non esiste in questo trigger (ON_ATTACK_DECLARE
                // passa il ctx dell'EVENTO attacco, non della carta — vedi
                // fireTrigger in duel-engine.js): la carta va recuperata da
                // ctx.attackerIndex, non da ctx.card come nel resto del file.
                const selfSlot = ctx.field(ctx.owner)[ctx.attackerIndex];
                if (selfSlot) selfSlot.card._swordsmanEvolveTurn = gameState.turn;
                ctx.log(`⚔️ Spadaccino Mistico LV4 distrugge ${name} prima del combattimento!`);
            }
        },
        onEndPhase(ctx) {
            if (ctx.card._swordsmanEvolveTurn !== gameState.turn) return;
            let evolved = null;
            const hand = ctx.hand(ctx.owner);
            let zonaEvolved = null;
            const handIdx = hand.findIndex((c) => c.id === 865);
            if (handIdx !== -1) { [evolved] = hand.splice(handIdx, 1); zonaEvolved = 'hand'; }
            else {
                const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
                const deck = gameState[deckKey];
                if (Array.isArray(deck)) {
                    const deckIdx = deck.findIndex((c) => c.id === 865);
                    if (deckIdx !== -1) {
                        [evolved] = deck.splice(deckIdx, 1);
                        zonaEvolved = 'deck';
                        gameState[Tavolo.chiave(ctx.owner, 'DeckCount')] = deck.length;
                    }
                }
            }
            if (!evolved) return;
            const field = ctx.field(ctx.owner);
            const selfIndex = field.findIndex((s) => s && s.card.uid === ctx.card.uid);
            if (selfIndex === -1) return;
            field[selfIndex] = null;
            ctx.graveyard(ctx.owner).push(ctx.card);
            const slotIndex = ctx.findEmptyMonsterSlot(ctx.owner);
            if (slotIndex === -1) { ctx.graveyard(ctx.owner).push(evolved); return; }
            ctx.specialSummon(ctx.owner, evolved, slotIndex, 'attack', zonaEvolved);
            ctx.log('⚔️ Spadaccino Mistico LV4 si manda al Cimitero ed evolve in Spadaccino Mistico LV6!');
        }
    });

    // ================================================================
    // 865 — Spadaccino Mistico LV6 / Mystic Swordsman LV6
    // Carta AGGIUNTA al database apposta per completare l'evoluzione di
    // Spadaccino Mistico LV4 (id 719, vedi lì). Non può essere Evocata
    // Normalmente/Set (cannotNormalSummon) — arriva SOLO tramite
    // ctx.specialSummon dall'onEndPhase di id 719.
    // "Una volta sola finché resta scoperta sul Terreno: quando
    // l'avversario attiva una Magia bersaglio di 1 solo proprio mostro,
    // puoi annullarne l'attivazione": vero Effetto Veloce da mostro,
    // offerto come risposta durante la finestra di priorità di
    // un'attivazione manuale — canRespondAsQuickEffect: true, nuovo
    // opt-in in findMonsterQuickEffectCandidates (duel-engine.js,
    // openActivationWindow) esteso APPOSTA per questa carta: prima
    // rispondevano solo le Trappole Set (findSetTrapCandidates). Stesso
    // canActivate/ctx.negateActivation() già usato da Interferenza
    // Magica (id 361) e famiglia — SEMPLIFICAZIONE condivisa: risponde a
    // QUALUNQUE Magia attivata, non solo quelle che hanno come bersaglio
    // esattamente 1 mostro (nessun tracciamento del numero/tipo di
    // bersagli di un'attivazione generica in questo motore). Il limite
    // "una volta sola finché scoperta" (non per turno) è un flag
    // permanente sulla carta stessa, _usedSpellNegationOnce — mai
    // resettato da changeTurn(), a differenza del gameState.usedIgnitionThisTurn
    // generico che canActivate(owner,'monster',index) applica comunque
    // (innocuo: questa carta non ha altri Ignition da tracciare per
    // turno, il vero gate resta sempre e solo il flag permanente).
    // ================================================================
    CardEffects.register(865, {
        cannotNormalSummon: true,
        canRespondAsQuickEffect: true,
        canActivate(ctx) {
            if (ctx.card._usedSpellNegationOnce) return false;
            const chain = ctx.gameState.chain;
            return !!(chain && chain.links && chain.links.length > 0 && chain.links[chain.links.length - 1].card.type === 'spell');
        },
        activate(ctx) {
            ctx.card._usedSpellNegationOnce = true;
            if (ctx.negateActivation()) {
                ctx.log("⚔️ Spadaccino Mistico LV6 annulla l'attivazione della Magia!");
            } else {
                ctx.log("⚔️ Spadaccino Mistico LV6 non trova più nulla da annullare.");
            }
        }
    });

    // ================================================================
    // 720 — Gran Maestro Ninja Sasuke / Ninja Grandmaster Sasuke
    // All'inizio del Damage Step, se attacca un mostro scoperto in
    // Difesa: distruggilo. Stesso schema di id 719 qui sopra, ma per
    // Difesa SCOPERTA.
    // ================================================================
    CardEffects.register(720, {
        onOwnAttackDeclare(ctx) {
            if (typeof ctx.targetIndex !== 'number' || ctx.targetIndex === -1) return;
            const targetSlot = ctx.field(ctx.opponent)[ctx.targetIndex];
            if (targetSlot && !targetSlot.isFaceDown && targetSlot.position === 'defense') {
                const name = targetSlot.card.name;
                ctx.destroyMonster(ctx.opponent, ctx.targetIndex);
                ctx.cancelAttack();
                ctx.log(`🥷 Sasuke Maestro Ninja distrugge ${name} prima del combattimento!`);
            }
        }
    });

    // ================================================================
    // 721 — Samurai Armato - Ben Kei / Armed Samurai - Ben Kei
    // Per ogni Carta Equipaggiamento equipaggiata a questa carta, guadagna
    // 1 attacco aggiuntivo durante ciascuna Battle Phase. getExtraAttackCount
    // è DINAMICO (ricalcolato ad ogni attacco da resolveAttack, actions.js,
    // non un valore fissato all'inizio del turno): conta le Carte
    // Equipaggiamento scoperte con equippedToUid === questa carta, esattamente
    // come fa già static() per i bonus ATK/DEF di un mostro equipaggiato.
    // ================================================================
    CardEffects.register(721, {
        getExtraAttackCount(ctx) {
            return ctx.stField(ctx.owner).filter((s) => s && !s.isFaceDown && s.card.equippedToUid === ctx.card.uid).length;
        }
    });

    // ================================================================
    // 722 — Spada Divina - Lama della Fenice / Divine Sword - Phoenix
    // Blade (Equipaggiamento, solo Guerriero)
    // +300 ATK. "Durante la tua Main Phase, se questa carta è nel tuo
    // Cimitero: puoi bandire 2 Guerrieri dal Cimitero per riprenderla in
    // mano" — def.canActivateFromGraveyardMainPhase/
    // activateFromGraveyardMainPhase (nuovo aggancio generico PROATTIVO,
    // fireOwnMainPhase1GraveyardActivations in duel-engine.js, diverso da
    // activatableFromGraveyard che è solo REATTIVO a un evento).
    // ================================================================
    CardEffects.register(722, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.race === 'Guerriero') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.race === 'Guerriero'); },
        isEquip: true,
        equipTargetFilter: (c) => c.race === 'Guerriero',
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 300, def: e.def };
        },
        canActivateFromGraveyardMainPhase(ctx) {
            return ctx.graveyard(ctx.owner).filter((c) => c.type === 'monster' && c.race === 'Guerriero').length >= 2;
        },
        activateFromGraveyardMainPhase(ctx) {
            const isWarrior = (c) => c.type === 'monster' && c.race === 'Guerriero';
            banishFromGraveyardWithChoice(ctx, ctx.owner, isWarrior, {
                title: '⚔️ Spada Divina - Lama della Fenice',
                text: 'Scegli il primo Guerriero da bandire dal Cimitero.'
            }, () => {
                // Necrovalley (id 890): se il secondo bando fallisse, il
                // costo (bandire 2 Guerrieri) non sarebbe pagato per
                // intero — niente ritorno in mano (onBanished scatta SOLO
                // se banishFromGraveyard riesce davvero).
                banishFromGraveyardWithChoice(ctx, ctx.owner, isWarrior, {
                    title: '⚔️ Spada Divina - Lama della Fenice',
                    text: 'Scegli il secondo Guerriero da bandire dal Cimitero.'
                }, () => {
                    const cardIndex = ctx.graveyard(ctx.owner).findIndex((c) => c.uid === ctx.card.uid);
                    if (cardIndex === -1) return;
                    if (ctx.graveyardMoveNegated(ctx.owner)) return;
                    const [card] = ctx.graveyard(ctx.owner).splice(cardIndex, 1);
                    ctx.hand(ctx.owner).push(card);
                    ctx.log('⚔️ Spada Divina - Lama della Fenice bandisce 2 Guerrieri e torna in mano dal Cimitero!');
                });
            });
        }
    });

    // ================================================================
    // 723 — Lama Fulminea / Lightning Blade (Equipaggiamento, solo
    // Guerriero)
    // +800 ATK al bersaglio equipaggiato. Tutti i mostri ACQUA sul
    // Terreno: -500 ATK.
    // ================================================================
    CardEffects.register(723, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.race === 'Guerriero') !== -1; },
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
                    if (!slot || slot.isFaceDown || slot.card.attribute !== 'ACQUA' || DuelEngine.getDefinition(slot.card.id)?.unaffectedBySpellEffects) return;
                    const e2 = gameState.atkDefBonus[slot.card.uid] || { atk: 0, def: 0 };
                    gameState.atkDefBonus[slot.card.uid] = { atk: e2.atk - 500, def: e2.def };
                });
            });
        }
    });

    // ================================================================
    // 724 — Rinforzo dell'Esercito / Reinforcement of the Army (Magia
    // Normale)
    // Aggiungi 1 mostro Guerriero di Livello 4 o inferiore dal Deck
    // alla mano.
    // ================================================================
    CardEffects.register(724, {
        canActivate(ctx) {
            const deckKey = Tavolo.chiave(ctx.owner, 'Deck');
            const deck = gameState[deckKey];
            return Array.isArray(deck) && deck.some((c) => c.type === 'monster' && c.race === 'Guerriero' && (c.level || 0) <= 4);
        },
        activate(ctx) {
            searchDeckWithChoice(ctx, (c) => c.type === 'monster' && c.race === 'Guerriero' && (c.level || 0) <= 4, {
                title: "⚔️ Rinforzi dell'Esercito",
                text: 'Scegli quale mostro Guerriero di Livello 4 o inferiore aggiungere alla mano dal Deck.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`⚔️ Rinforzi dell'Esercito aggiunge ${card.name} alla mano dal Deck!`);
            });
        }
    });

    // ================================================================
    // 725 — Il Guerriero Ritorna in Vita / The Warrior Returning Alive
    // (Magia Normale)
    // Scegli come bersaglio 1 mostro Guerriero nel Cimitero; aggiungilo
    // alla mano.
    // ================================================================
    CardEffects.register(725, {
        canActivate(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'monster' && c.race === 'Guerriero');
        },
        activate(ctx) {
            searchGraveyardWithChoice(ctx, ctx.owner, (c) => c.type === 'monster' && c.race === 'Guerriero', {
                title: '⚔️ Il Guerriero Sopravvissuto',
                text: 'Scegli quale mostro Guerriero recuperare dal Cimitero.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                ctx.log(`⚔️ Il Guerriero Sopravvissuto recupera ${card.name} dal Cimitero!`);
            });
        }
    });

    // ================================================================
    // 726 — Spada Fusione Lama Murasame / Fusion Sword Murasame Blade
    // (Equipaggiamento, solo Guerriero)
    // +800 ATK. Finché equipaggiata a un mostro, non può essere
    // distrutta da effetti Carta — cannotBeDestroyedByCardEffectWhileEquipped,
    // controllato dentro ACTIONS.destroySpellTrap (duel-engine.js).
    // ================================================================
    CardEffects.register(726, {
        continuous: true,
        canActivate(ctx) { return findEquipTarget(ctx, (c) => c.race === 'Guerriero') !== -1; },
        activate(ctx) { equipToChosenTarget(ctx, (c) => c.race === 'Guerriero'); },
        isEquip: true,
        equipTargetFilter: (c) => c.race === 'Guerriero',
        cannotBeDestroyedByCardEffectWhileEquipped: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 800, def: e.def };
        }
    });

    // ================================================================
    // 727 — Flamberge del Male Infranto - Baou / Wicked-Breaking
    // Flamberge - Baou (Equipaggiamento, qualsiasi mostro)
    // Manda 1 carta dalla mano al Cimitero, poi equipaggia a 1 mostro
    // sul Terreno (anche dell'avversario); +500 ATK. "Annulla gli
    // effetti dei mostri dell'avversario distrutti in battaglia dal
    // mostro equipaggiato": onDestroysMonsterInBattle (nuovo aggancio
    // per Carte Equipaggiamento in applyBattleDestroyBonus, actions.js)
    // — ctx.owner è il vero controllore di QUESTA carta (non
    // necessariamente il controllore del mostro equipaggiato, es. Baou
    // equipaggiata a un mostro avversario), quindi "l'avversario" è
    // sempre relativo a ctx.owner, non all'attaccante.
    // ================================================================
    CardEffects.register(727, {
        continuous: true,
        canActivate(ctx) {
            // Serve un'ALTRA carta da scartare: vedi otherHandCards.
            if (otherHandCards(ctx).length === 0) return false;
            return Tavolo.ordine().some((owner) => ctx.field(owner).some((s) => s && !s.isFaceDown));
        },
        activate(ctx) {
            const candidates = [];
            [ctx.owner, ctx.opponent].forEach((owner) => {
                ctx.field(owner).forEach((slot, index) => { if (slot && !slot.isFaceDown) candidates.push({ owner, index, card: slot.card }); });
            });
            if (candidates.length === 0) return;
            // Due scelte asincrone di fila (lo scarto, poi il bersaglio)
            // mentre la carta è già nella sua casella senza aggancio: stesso
            // bug corretto in equipToChosenTarget (card-effects.js) — la
            // pulizia degli Equip orfani la mandava al Cimitero a metà
            // scelta. `equipInScelta` la protegge finché si sceglie, e
            // l'attesa va chiesta QUI, nella parte sincrona: dentro le
            // callback ctx.waitForChoice non c'è più.
            const card = ctx.card;
            const fine = attendiScelta(ctx);
            card.equipInScelta = true;
            const sceltaChiusa = () => { delete card.equipInScelta; fine(); };
            const avviata = offerHandDiscardChoice(ctx, {
                title: '⚔️ Flamberge del Male Infranto',
                text: 'Scegli quale carta scartare dalla mano.'
            }, (discarded) => {
                // Vera scelta anche di A QUALE mostro equipaggiarsi (proprio
                // o dell'avversario), non più sempre il primo trovato —
                // stesso schema già usato da Dispositivo di Evacuazione
                // Forzata (id 671, chooseFieldMonsterTarget).
                const aperta = chooseFieldMonsterTarget(ctx, candidates, {
                    title: '⚔️ Flamberge del Male Infranto',
                    text: 'Scegli a quale mostro equipaggiarti (tuo o dell\'avversario).',
                    // Checkpoint di targeting: come ogni Equip, vedi
                    // equipToChosenTarget in card-effects.js.
                    dichiara: true,
                    onNegato: sceltaChiusa
                }, (choice) => {
                    try {
                        card.equippedToOwner = choice.owner;
                        card.equippedToIndex = choice.index;
                        card.equippedToUid = choice.card.uid;
                        ctx.log(`⚔️ Flamberge del Male Infranto scarta ${discarded.name} e si equipaggia a ${choice.card.name}!`);
                    } finally {
                        sceltaChiusa();
                    }
                });
                if (aperta === false) sceltaChiusa();
            });
            if (avviata === false) sceltaChiusa();
        },
        isEquip: true,
        static(ctx) {
            const t = equippedTarget(ctx);
            const e = gameState.atkDefBonus[t.uid] || { atk: 0, def: 0 };
            gameState.atkDefBonus[t.uid] = { atk: e.atk + 500, def: e.def };
        },
        onDestroysMonsterInBattle(ctx) {
            if (!ctx.destroyedCard || ctx.destroyedCardOwner === ctx.owner) return;
            gameState.monsterEffectsNegatedUidsFor = gameState.monsterEffectsNegatedUidsFor || { player: new Set(), bot: new Set() };
            gameState.monsterEffectsNegatedUidsFor[ctx.destroyedCardOwner].add(ctx.destroyedCard.uid);
            ctx.log(`⚔️ ${ctx.card.name} annulla gli effetti di ${ctx.destroyedCard.name}!`);
        }
    });

    // ================================================================
    // 728 — Fata della Primavera / Fairy of the Spring (Magia Normale).
    // Entrambe le clausole sono implementate: scegli come bersaglio 1
    // Magia Equipaggiamento nel Cimitero e aggiungila alla mano, senza
    // poterla attivare in questo turno.
    // ================================================================
    CardEffects.register(728, {
        canActivate(ctx) {
            return ctx.graveyard(ctx.owner).some((c) => c.type === 'spell' && c.subtype === 'equip');
        },
        activate(ctx) {
            searchGraveyardWithChoice(ctx, ctx.owner, (c) => c.type === 'spell' && c.subtype === 'equip', {
                title: '🌸 Fata della Sorgente',
                text: 'Scegli quale Magia Equipaggiamento recuperare dal Cimitero.'
            }, (card) => {
                ctx.hand(ctx.owner).push(card);
                gameState.blockedCardUidsThisTurn = gameState.blockedCardUidsThisTurn || new Set();
                gameState.blockedCardUidsThisTurn.add(card.uid);
                ctx.log(`🌸 Fata della Sorgente recupera ${card.name} dal Cimitero! Non può essere attivata in questo turno.`);
            });
        }
    });

    // ================================================================
    // 729 — Vortice Fulmineo / Lightning Vortex (Magia Normale)
    // Scarta 1 carta; distruggi tutti i mostri scoperti dell'avversario.
    // ================================================================
    CardEffects.register(729, {
        canActivate(ctx) {
            // Serve un'ALTRA carta da scartare: vedi otherHandCards.
            return otherHandCards(ctx).length > 0 && ctx.field(ctx.opponent).some((s) => s && !s.isFaceDown);
        },
        activate(ctx) {
            offerHandDiscardChoice(ctx, {
                title: '⚡ Fulmine Boltex',
                text: 'Scegli quale carta scartare dalla mano.'
            }, (discarded) => {
                let destroyed = 0;
                ctx.field(ctx.opponent).forEach((slot, index) => {
                    if (slot && !slot.isFaceDown) { ctx.destroyMonster(ctx.opponent, index); destroyed++; }
                });
                ctx.log(`⚡ Fulmine Boltex scarta ${discarded.name} e distrugge ${destroyed} mostr${destroyed === 1 ? 'o' : 'i'}!`);
            });
        }
    });

    // ================================================================
    // 730 — Spade della Luce Occultante / Swords of Concealing Light
    // (Magia Continua) — stesso schema a conto alla rovescia di Spada
    // Rivelatrice (id 8), ma gira i mostri dell'avversario coperti in
    // Difesa (invece di lasciarli scoperti senza poter attaccare) e ne
    // blocca il cambio Posizione.
    // SEMPLIFICAZIONE durata: 2 turni (approssima "fino alla propria 2ª
    // Standby Phase dopo l'attivazione").
    // ================================================================
    CardEffects.register(730, {
        continuous: true,
        durationTurns: 2,
        activate(ctx) {
            const slot = ctx.stField(ctx.owner)[ctx.index];
            if (slot) slot.turnsLeft = 2;
            let flipped = 0;
            ctx.field(ctx.opponent).forEach((s) => {
                if (s && !s.isFaceDown) { s.isFaceDown = true; s.position = 'defense'; flipped++; }
            });
            ctx.log(`🌑 Spade Mistificatrici copre ${flipped} mostr${flipped === 1 ? 'o' : 'i'} dell'avversario in Difesa!`);
        },
        static(ctx) {
            ctx.field(ctx.opponent).forEach((s) => {
                if (s) gameState.cannotChangePositionUids[s.card.uid] = true;
            });
        }
    });

})();
