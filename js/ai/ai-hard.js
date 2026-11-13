// @ts-check
/**
 * ai-hard.js — Livello Difficile.
 *
 * La matrice fattoriale della Storia ha dimostrato un vincolo importante:
 * una seconda euristica completa non è automaticamente più intelligente.
 * La vecchia versione sceglieva Evocazioni, Chain e retrocampo con punteggi
 * propri, ma finiva per rompere combo tematiche e consumare risorse fuori
 * contesto: a parità di deck perdeva più spesso della Media in 14 incontri
 * su 16.
 *
 * Hard usa quindi la Media come base affidabile e aggiunge una sola forma
 * di pianificazione superiore: preparazione prima dell'Evocazione, scelta
 * più incisiva di Magie/Trappole e piccoli playbook opzionali. Il vantaggio
 * resta misurato; soprattutto, non cambia l'identità dei deck dei personaggi.
 */
(function () {
    'use strict';

    /** Punteggio diagnostico dello stato, conservato per strumenti e test. */
    /** @param {GameState} gameState @param {Owner} [io] @returns {number} */
    function evaluateBoard(gameState, io = 'bot') {
        const avversario = Tavolo.avversario(io);
        let score = (Tavolo.lp(io, gameState) - Tavolo.lp(avversario, gameState)) / 100;
        const potenza = (campo) => campo.reduce((somma, slot) => {
            if (!slot) return somma;
            return somma + (slot.isFaceDown ? 400 : AI_SHARED.effAtk(slot.card));
        }, 0);
        score += (potenza(Tavolo.mostri(io, gameState)) - potenza(Tavolo.mostri(avversario, gameState))) / 100;
        score += (Tavolo.mano(io, gameState).length - Tavolo.mano(avversario, gameState).length) * 3;
        return score;
    }

    /** @param {GameState} gameState @param {Owner} [io] @returns {AISummonDecision | null} */
    function chooseSummon(gameState, io = 'bot') {
        const personaggio = gameState.personaggioPerPosto && gameState.personaggioPerPosto[io];
        if (personaggio === 'kaiba') {
            const hand = Tavolo.mano(io, gameState);
            const field = Tavolo.mostri(io, gameState);
            const fieldCount = field.filter(Boolean).length;
            const hasObelisk = hand.some((card) => card.id === 30);
            const hasFlutePlan = hand.some((card) => card.id === 578)
                && hand.some((card) => card.type === 'monster' && card.race === 'Drago');
            const fieldIds = new Set(field.filter(Boolean).map((slot) => slot.card.id));
            return AI_MEDIUM.chooseSummon(gameState, io, {
                allowCandidate(card) {
                    // A due corpi dal completamento, non consumare tutto per
                    // un altro mostro da Tributo: Kaiba prepara Obelisk.
                    return !(hasObelisk && fieldCount >= 2 && fieldCount < 3
                        && card.id !== 30 && getTributesRequired(card) > 0);
                },
                scoreMonster(card) {
                    if (card.id === 30) return 10000;
                    if (card.id === 353 && hasFlutePlan) return 7000;
                    const completaXY = (card.id === 510 && fieldIds.has(513))
                        || (card.id === 513 && fieldIds.has(510));
                    const completaXYZ = card.id === 515 && fieldIds.has(511);
                    if (completaXY || completaXYZ) return 6000;
                    return card.attack || 0;
                }
            });
        }
        if (personaggio === 'seeker') {
            return AI_MEDIUM.chooseSummon(gameState, io, {
                // Il Cacciatore di Exodia non cerca pressione immediata:
                // mette prima in gioco i mostri che, andando al Cimitero,
                // aggiungono un pezzo dal Deck alla mano. Il riconoscimento
                // è semantico, non una lista di id: nuove carte custom con
                // la stessa funzione entrano naturalmente nel piano.
                scoreMonster(card) {
                    const cercaDalDeck = /aggiung(?:i|ere).*alla (?:tua )?mano.*dal Deck/i.test(card.effect || '');
                    return (cercaDalDeck ? 10000 : 0) + (card.attack || 0);
                }
            });
        }
        if (personaggio === 'yamiYugi') {
            return AI_MEDIUM.chooseSummon(gameState, io, {
                // Slifer ha ATK/DEF stampati 0 perché il valore è dinamico.
                // Senza una priorità coerente col valore futuro finirebbe
                // dietro qualunque mostro normale nell'ordinamento e non
                // arriverebbe mai alla valutazione dei tre Tributi.
                scoreMonster(card) {
                    if (card.id !== 31) return card.attack || 0;
                    const remainingCards = Math.max(0, Tavolo.mano(io, gameState).length - 1);
                    return remainingCards * 1000 + (remainingCards > 0 ? 2000 : 0);
                }
            });
        }
        if (personaggio === 'strings') {
            const hand = Tavolo.mano(io, gameState);
            const fieldCount = Tavolo.mostri(io, gameState).filter(Boolean).length;
            const hasSlifer = hand.some((card) => card.id === 31);
            return AI_MEDIUM.chooseSummon(gameState, io, {
                // Strings è il tramite con cui Marik schiera Slifer. Senza
                // questo playbook il valore stampato 0/0 lo faceva ignorare
                // e i corpi della Melma venivano consumati da altri Tributi.
                scoreMonster(card) {
                    if (card.id !== 31) return card.attack || 0;
                    const remainingCards = Math.max(0, hand.length - 1);
                    return remainingCards * 1000 + (remainingCards > 0 ? 2000 : 0);
                },
                allowCandidate(card) {
                    return !(hasSlifer && fieldCount >= 1 && fieldCount < 3
                        && card.id !== 31 && getTributesRequired(card) > 0);
                },
                isTributeSummonWorthwhile(card, sacrificedValue) {
                    // Il valore stampato 0/0 non rappresenta Slifer: con i
                    // tre Tributi disponibili il piano identitario prevale.
                    if (card.id === 31) return true;
                    return AI_SHARED.isTributeSummonWorthwhile(card, sacrificedValue, gameState, io);
                }
            });
        }
        if (personaggio === 'marik') {
            const hand = Tavolo.mano(io, gameState);
            const fieldCount = Tavolo.mostri(io, gameState).filter(Boolean).length;
            const hasRa = hand.some((card) => card.id === 472);
            return AI_MEDIUM.chooseSummon(gameState, io, {
                // Come Slifer, Ra ha 0/0 stampato. Quando il campo nemico è
                // libero Marik può pagare fino a 100 LP e trasformarlo nel
                // mostro più incisivo della mano: usa la stessa stima
                // condivisa che governa la decisione reale del pagamento.
                scoreMonster(card) {
                    if (card.id !== 472 || !window.AI_SHARED) return card.attack || 0;
                    return AI_SHARED.estimateSummonedStats(card, gameState, io).atk;
                },
                allowCandidate(card) {
                    return !(hasRa && fieldCount >= 1 && fieldCount < 3
                        && card.id !== 472 && getTributesRequired(card) > 0);
                }
            });
        }
        if (personaggio === 'labyrinthMage') {
            const mano = Tavolo.mano(io, gameState);
            const preparaWallShadow = mano.some((card) => card.id === 364);
            return AI_MEDIUM.chooseSummon(gameState, io, {
                scoreMonster(card) {
                    // Con Labirinto Magico pronto, Muro è il vero inizio
                    // della combo identitaria e non un semplice difensore.
                    if (preparaWallShadow && card.id === 337) return 10000;
                    return card.attack || 0;
                },
                decidePosture(card) {
                    if (preparaWallShadow && card.id === 337) {
                        return { position: 'defense', faceDown: false };
                    }
                    return AI_SHARED.decideMonsterPosture(card, gameState, io);
                },
                isTributeSummonWorthwhile(card, sacrificedValue) {
                    if (preparaWallShadow && card.id === 337) return true;
                    return AI_SHARED.isTributeSummonWorthwhile(card, sacrificedValue, gameState, io);
                }
            });
        }
        return AI_MEDIUM.chooseSummon(gameState, io);
    }

    /**
     * Sceglie un mostro che puo' Evocarsi Specialmente dalla mano tramite
     * la propria procedura. Questo percorso era disponibile soltanto alla
     * persona tramite il comando `specialeDaMano`: l'IA poteva quindi usare
     * Rinascita del Mostro e altre carte che Evocano, ma non boss come
     * Valkyrion anche quando aveva gia' tutti i materiali.
     *
     * La scelta resta propria della Difficile: ordina le procedure davvero
     * valide ORA e preferisce il corpo con la statistica migliore. Facile e
     * Media non ricevono gratuitamente questa linea avanzata.
     */
    /** @param {GameState} gameState @param {Owner} [io] @returns {{ card: Card; handIndex: number } | null} */
    function chooseHandSpecialSummon(gameState, io = 'bot') {
        if (!window.DuelEngine) return null;
        return Tavolo.mano(io, gameState)
            .map((card, handIndex) => ({ card, handIndex }))
            .filter(({ card, handIndex }) => card.type === 'monster'
                && !AI_SHARED.shouldHoldForExodia(card, gameState, io)
                && DuelEngine.canSpecialSummonFromHand(io, handIndex))
            .sort((a, b) => {
                const aStats = AI_SHARED.estimateSummonedStats(a.card, gameState, io);
                const bStats = AI_SHARED.estimateSummonedStats(b.card, gameState, io);
                return Math.max(bStats.atk, bStats.def) - Math.max(aStats.atk, aStats.def);
            })[0] || null;
    }

    /**
     * Prima dell'Evocazione Normale Hard può usare una Magia che aumenta
     * subito le opzioni in mano. Farlo dopo l'Evocazione, come nel turno
     * lineare della Media, rende inutilizzabile fino al turno seguente un
     * eventuale mostro migliore appena pescato/cercato.
     *
     * Il filtro è volutamente stretto: niente ricariche con scarto, costi,
     * blocchi ai danni o Draw Phase saltate. Quelle richiedono una vera
     * valutazione del costo e restano nel flusso normale.
     */
    /** @param {GameState} gameState @param {Owner} [io] @returns {AIHandAction | null} */
    function choosePreSummonSpellAction(gameState, io = 'bot') {
        const mano = Tavolo.mano(io, gameState);
        const candidate = mano
            .map((card, handIndex) => ({ card, handIndex }))
            .filter(({ card, handIndex }) => {
                if (!card || card.type !== 'spell') return false;
                const testo = card.effect || '';
                const generaOpzioni = /(?:^|[.;]\s*)pesca \d+ carte?\b|aggiungi .* dal tuo Deck alla (?:tua )?mano/i.test(testo);
                const preparaCampo = card.subtype === 'field';
                const finestraIniziale = /solo all'inizio della Main Phase 1/i.test(testo);
                const costoRischioso = /scarta|salta|non subisce danni|rimescola.*tua mano|paga \d+ Life Points/i.test(testo);
                return (generaOpzioni || preparaCampo || finestraIniziale) && !costoRischioso
                    && window.DuelEngine && DuelEngine.canActivate(io, 'hand', handIndex);
            })
            .sort((a, b) => AI_SHARED.scoreCardImpact(b.card) - AI_SHARED.scoreCardImpact(a.card));
        if (!candidate.length) return null;
        return { handIndex: candidate[0].handIndex, card: candidate[0].card, action: 'activate' };
    }

    /**
     * Ordina gli attaccanti dal meno potente al più potente. In presenza di
     * più difensori questo equivale a usare la forza minima necessaria per
     * ogni rimozione e conserva il mostro più forte per l'ultimo bersaglio
     * o per l'attacco diretto che può chiudere il duello.
     */
    /** @param {AIAttacker[]} attackers @returns {AIAttacker[]} */
    function orderAttackers(attackers) {
        return [...attackers].sort((a, b) => {
            const differenza = AI_SHARED.effAtk(a.slot.card) - AI_SHARED.effAtk(b.slot.card);
            return differenza || a.index - b.index;
        });
    }

    /**
     * Stima in sola lettura se gli attaccanti pronti possono eliminare tutti
     * i mostri visibili/coperti e infliggere con i rimanenti danni sufficienti
     * a chiudere il duello. Non esegue effetti e non promette il letale contro
     * Trappole: serve a riconoscere una linea disponibile, non a barare sulla
     * futura Chain.
     */
    /** @param {AIAttacker[]} attackers @param {AIAttacker[]} defenders @param {number} opponentLp @param {Owner} [io] @returns {AILethalEstimate} */
    function estimateLethal(attackers, defenders, opponentLp, io = 'bot') {
        const attacchi = orderAttackers(attackers).map((item) => AI_SHARED.effAtk(item.slot.card));
        const difese = defenders.map((item) => ({
            forza: AI_SHARED.statRilevante(item.slot),
            distruttibile: AI_SHARED.canBeDestroyedByBattle(item.slot.card, Tavolo.avversario(io), Infinity)
        })).sort((a, b) => a.forza - b.forza);

        for (const difesa of difese) {
            if (!difesa.distruttibile) return { possible: false, damage: 0 };
            const indice = attacchi.findIndex((atk) => atk > difesa.forza);
            if (indice === -1) return { possible: false, damage: 0 };
            attacchi.splice(indice, 1);
        }
        const damage = attacchi.reduce((somma, atk) => somma + atk, 0);
        return { possible: damage >= opponentLp, damage };
    }

    /**
     * Mostri rimasti in Difesa da turni precedenti tornano in Attacco solo
     * quando possono produrre pressione immediata: campo avversario vuoto
     * oppure almeno un bersaglio che il loro ATK effettivo supera. Il flag
     * canChangePosition mantiene tutte le regole su Evocazione e cambio già
     * effettuato; l'esecutore del comando resta l'ultima autorità.
     */
    /** @param {GameState} gameState @param {Owner} [io] @returns {number[]} */
    function choosePositionChanges(gameState, io = 'bot') {
        const personaggio = gameState.personaggioPerPosto && gameState.personaggioPerPosto[io];
        // Gansley e Noah rendono meglio seguendo il proprio piano di campo
        // senza reagire a statistiche nascoste. Gli altri mantengono la
        // prudenza Hard già misurata nell'audit precedente.
        const seguePianoVisibile = personaggio === 'gansley' || personaggio === 'noah';
        return AI_SHARED.choosePositionChanges(gameState, io, !seguePianoVisibile);
    }

    /** @param {MonsterSlot} attackerSlot @param {AIAttacker[]} opponentMonsters @param {Owner} [io] @returns {number | null} */
    function chooseAttackTarget(attackerSlot, opponentMonsters, io = 'bot') {
        const sceltaMedia = AI_MEDIUM.chooseAttackTarget(attackerSlot, opponentMonsters, io);
        if (sceltaMedia === null || sceltaMedia === -1) return sceltaMedia;
        const personaggio = gameState.personaggioPerPosto && gameState.personaggioPerPosto[io];
        if (personaggio === 'gansley' || personaggio === 'noah') return sceltaMedia;

        const bersaglio = opponentMonsters.find((item) => item.index === sceltaMedia);
        if (bersaglio && bersaglio.slot.isFaceDown) {
            const attacco = AI_SHARED.effAtk(attackerSlot.card);
            if (attacco <= AI_SHARED.statRilevante(bersaglio.slot)) return null;
        }
        return sceltaMedia;
    }

    /** @param {AIResponseCandidate[]} candidates @param {Owner} [io] @returns {AIResponseCandidate | null} */
    function chooseChainResponse(candidates, io = 'bot') {
        return AI_MEDIUM.chooseChainResponse(candidates, io);
    }

    /** @param {GameState} gameState @param {{ activateCount?: number; setCount?: number }} [usedThisTurn] @param {Owner} [io] @returns {AIHandAction | null} */
    function chooseNextSpellTrapAction(gameState, usedThisTurn, io = 'bot') {
        usedThisTurn = usedThisTurn || {};
        const personaggio = gameState.personaggioPerPosto && gameState.personaggioPerPosto[io];
        const sliferScoperto = personaggio === 'strings' && Tavolo.mostri(io, gameState)
            .some((slot) => slot && !slot.isFaceDown && slot.card.id === 31);
        const statoMedia = {
            activateDone: (usedThisTurn.activateCount || 0) > 0,
            setDone: (usedThisTurn.setCount || 0) > 0,
            setCount: usedThisTurn.setCount || 0
        };
        // Hard conserva la personalità del duellante ma non il +0,15 di
        // prudenza proprio della Media: a parità di candidate tende quindi
        // più nettamente verso la carta dall'impatto maggiore.
        const scelta = AI_MEDIUM.chooseNextSpellTrapAction(gameState, statoMedia, io, { restraintBonus: 0 });
        // L'ATK/DEF di Slifer vale 1000 per ogni carta in mano. Una volta
        // schierato, il comportamento Hard generico (attiva una Magia e
        // Setta una Trappola) poteva svuotare le ultime due carte e
        // trasformare il Dio appena Evocato in uno 0/0. Strings conserva
        // quindi la mano: fa eccezione soltanto una pescata a vantaggio
        // netto immediato, oggi Vaso dell'Avidità. Le risposte già Set
        // restano pienamente utilizzabili nelle normali finestre di Chain.
        if (sliferScoperto && scelta
            && (scelta.action === 'set' || scelta.card.id !== 36)) return null;
        if (scelta && scelta.action === 'activate') usedThisTurn.activateCount = (usedThisTurn.activateCount || 0) + 1;
        if (scelta && scelta.action === 'set') usedThisTurn.setCount = (usedThisTurn.setCount || 0) + 1;
        return scelta;
    }

    // Le carte coperte restano nella loro finestra di Chain. Gli Ignition
    // generici continuano a richiedere una strategia specifica; fa eccezione
    // il ciclo auto-coprente dei mostri Flip (Sfingi/Golem/Statue/Medusa):
    // rimettersi coperti è precisamente la preparazione del loro prossimo
    // effetto e non consuma altre risorse. Il riconoscimento dal testo rende
    // la regola disponibile anche a future carte custom equivalenti.
    /** @param {GameState} gameState @param {Owner} [io] @returns {AIFieldAction | null} */
    function chooseSetCardActivation(gameState, io = 'bot') {
        const campo = Tavolo.mostri(io, gameState);
        const personaggio = gameState.personaggioPerPosto && gameState.personaggioPerPosto[io];
        if (personaggio === 'marik' && gameState.hasNormalSummoned) {
            const hasFollowUp = Tavolo.mano(io, gameState).some((card) => card.type === 'monster'
                && getTributesRequired(card) === 0);
            if (hasFollowUp) {
                const st = Tavolo.magieTrappole(io, gameState);
                const offerIndex = st.findIndex((slot, index) => slot && slot.card.id === 559
                    && window.DuelEngine && DuelEngine.canActivate(io, 'st', index));
                if (offerIndex !== -1) return { zone: 'st', index: offerIndex, card: st[offerIndex].card };
            }
        }
        // Alcune Magie/Trappole scoperte espongono un secondo effetto
        // volontario durante la Main Phase (repeatableWhileContinuous):
        // per esempio Labirinto Magico prima si equipaggia, poi sacrifica
        // Muro del Labirinto per Wall Shadow. Il riconoscimento passa dal
        // contratto della definizione, non da una lista di ID, così vale
        // anche per carte custom e future che dichiarano lo stesso hook.
        const retrocampo = Tavolo.magieTrappole(io, gameState);
        for (let index = 0; index < retrocampo.length; index++) {
            const slot = retrocampo[index];
            if (!slot || slot.isFaceDown || !window.DuelEngine) continue;
            const definizione = DuelEngine.getDefinition(slot.card.id);
            if (!definizione || !definizione.repeatableWhileContinuous) continue;
            if (DuelEngine.canActivate(io, 'st', index)) {
                return { zone: 'st', index, card: slot.card };
            }
        }
        // Prima il piano di controllo di Pegasus: lasciare inutilizzato un
        // Abbandonato/Mille Occhi scoperto vanificherebbe Ritual/Fusione.
        for (let index = 0; index < campo.length; index++) {
            const slot = campo[index];
            if (!slot || slot.isFaceDown || (slot.card.id !== 416 && slot.card.id !== 476)) continue;
            if (window.DuelEngine && DuelEngine.canActivate(io, 'monster', index)) {
                return { zone: 'monster', index, card: slot.card };
            }
        }
        for (let index = 0; index < campo.length; index++) {
            const slot = campo[index];
            if (!slot || slot.isFaceDown) continue;
            const testo = slot.card.effect || '';
            if (!/puoi girare questa carta coperta in Posizione di Difesa/i.test(testo)) continue;
            if (window.DuelEngine && DuelEngine.canActivate(io, 'monster', index)) {
                return { zone: 'monster', index, card: slot.card };
            }
        }
        return AI_MEDIUM.chooseSetCardActivation(gameState, io);
    }

    window.AI_HARD = {
        evaluateBoard,
        chooseSummon,
        chooseHandSpecialSummon,
        choosePreSummonSpellAction,
        orderAttackers,
        estimateLethal,
        choosePositionChanges,
        chooseAttackTarget,
        chooseChainResponse,
        chooseNextSpellTrapAction,
        chooseSetCardActivation,
        chooseBanishFusion: AI_MEDIUM.chooseBanishFusion
    };
})();
