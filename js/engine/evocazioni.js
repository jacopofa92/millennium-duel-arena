/**
 * evocazioni.js — Evocare, Posizionare, cambiare Posizione, sacrificare.
 * =====================================================================
 * Nucleo senza testa (piano di attacco, Priorità 2). Sono le mosse che
 * cambiano il Terreno secondo le regole (summonMonster, setSpellTrap,
 * setFieldSpell, changeMonsterPosition, i Sacrifici, lo scarto per il
 * limite di mano). Vivevano in actions.js insieme ai prompt che le
 * chiedono al giocatore, che lì restano: qui c'è il "cosa succede", là il
 * "come lo si chiede".
 *
 * Script classico: le funzioni restano globali come prima. Caricato prima
 * di game-flow.js e actions.js (gruppo "partita" in
 * scripts/gruppi-script.js); qui ci sono solo dichiarazioni.
 *
 * Spostate parola per parola da actions.js (tools/sposta-funzioni.js);
 * impronta di tools/impronta-funzioni.js uguale prima e dopo.
 */

/**
 * Quanto dura l'animazione di sacrificio, e quindi quanto si aspetta
 * prima di togliere davvero le carte dal Terreno. Viaggia anche
 * sull'azione di rete (`delayMs`, vedi il broadcast qui sotto): i due
 * client devono cambiare stato NELLO STESSO ISTANTE, perché il
 * conteggio di Cimitero e Terreno entra nel checksum anti-desync — se
 * l'avversario togliesse le carte prima o dopo di noi, una qualunque
 * mossa inviata nel frattempo sembrerebbe arrivare da uno stato diverso.
 */
const TRIBUTE_SACRIFICE_ANIM_MS = 700;

/**
 * Un effetto come Canto Antico concede una Evocazione TRIBUTO aggiuntiva,
 * non una seconda Evocazione Normale libera. Il permesso e' per posto e
 * viene consumato prima della quota ordinaria: cosi' e' legale sia
 * Evocare Tributo prima e poi un Livello basso, sia fare l'ordine inverso.
 */
function canUseNormalSummonQuota(posto, card) {
    if (!gameState.hasNormalSummoned) return true;
    return getTributesRequired(card) > 0
        && !!(gameState.additionalTributeSummonFor && gameState.additionalTributeSummonFor[posto]);
}

function consumeNormalSummonQuota(posto, card) {
    if (getTributesRequired(card) > 0
        && gameState.additionalTributeSummonFor && gameState.additionalTributeSummonFor[posto]) {
        gameState.additionalTributeSummonFor[posto] = false;
        return 'additional-tribute';
    }
    gameState.hasNormalSummoned = true;
    return 'normal';
}

/**
 * Esegue il sacrificio scelto dalla persona (i mostri selezionati con i
 * click, gameState.pendingTributeSummon) e poi apre la scelta di casella e
 * Posizione del mostro da Evocare. La mossa vera è il comando 'tributa'
 * (eseguiTributo qui sotto); qui resta la parte di interfaccia.
 */
function performTributeSacrifice() {
    const pending = gameState.pendingTributeSummon;
    if (!pending) return;

    pending.sacrificing = true;
    const indices = [...pending.selected];
    PortaUI.queryAll('#playerFieldBoard .field-slot.tribute-highlight').forEach(el => {
        el.classList.remove('tribute-highlight', 'tribute-selected');
    });
    EventiDuello.emetti('prompt-tributo-chiuso');

    Comandi.esegui('player', {
        tipo: 'tributa',
        indici: indices,
        perCarta: pending.card.uid,
        attesaMs: TRIBUTE_SACRIFICE_ANIM_MS
    }, {
        dopo: () => {
            const { card, handIndex, fromRect } = pending;
            gameState.pendingTributeSummon = null;
            EventiDuello.emetti('evocazione-tributo-pronta', card, handIndex, fromRect);
        }
    });
}

/**
 * Comando 'tributa': sacrifica le carte del posto `posto` agli indici
 * `c.indici` — dalla zona Mostri, o dalla zona Magia/Trappola con
 * `c.zona === 'st'` (Castello dell'Ingranaggio Antico id 843). Per
 * un'Evocazione Tributo `c.perCarta` è l'uid del mostro in mano per cui si
 * sacrifica; per un costo (d'attacco) manca. `c.attesaMs`: quanto dura
 * l'animazione prima che le carte spariscano davvero (0 = subito).
 * `extra.dopo`: cosa fa chi ha fatto la mossa a sacrificio concluso.
 */
function eseguiTributo(posto, c, extra) {
    const suMagieTrappole = c.zona === 'st';
    const campo = suMagieTrappole ? Tavolo.magieTrappole(posto) : Tavolo.mostri(posto);
    const indices = (c.indici || []).slice();
    const perCarta = c.perCarta !== undefined && c.perCarta !== null
        ? (Tavolo.mano(posto).find((x) => x && x.uid === c.perCarta) || null) : null;
    const attesa = typeof c.attesaMs === 'number' ? c.attesaMs : 0;
    if (attesa > 0) {
        addToLog(perChi(posto, '🔻 Sacrificio in corso...', '🔻 L\'avversario sacrifica per un\'Evocazione Tributo...'));
        if (window.SFX) SFX.tribute();
        indices.forEach(idx => {
            const cardEl = PortaUI.query(`#${posto}FieldBoard .field-slot[data-owner="${posto}"][data-type="${suMagieTrappole ? 'st' : 'monster'}"][data-index="${idx}"] .card`);
            if (cardEl && window.FX) FX.playTributeSacrifice(cardEl);
        });
    }

    const togli = () => {
        // Chimera Gadjiltron Ingranaggio Antico (id 825): "guadagna gli
        // effetti appropriati se la Evochi Normalmente sacrificando
        // questi mostri: Gadget Verde/Rosso/Giallo" — gli id delle carte
        // sacrificate vengono salvati sulla carta da Evocare PRIMA di
        // svuotare gli slot (stessa carta, stesso riferimento, che poi
        // finisce sul Terreno con l'Evocazione): l'unico punto in cui
        // questo motore sa DAVVERO quali carte sono state sacrificate per
        // un'Evocazione Tributo, non solo quante.
        // Vale anche per il Castello dell'Ingranaggio Antico sacrificato al
        // posto dei mostri (zona Magia/Trappola): l'id ricordato è il suo.
        if (perCarta) {
            perCarta._tributedCardIds = indices
                .map((idx) => campo[idx] && campo[idx].card.id)
                .filter((id) => id !== undefined && id !== null);
            // Canto Antico e future carte chiedono la somma delle
            // statistiche ORIGINALI dei Tributi. Si legge l'anagrafica,
            // non la carta sul campo (che puo' avere bonus o malus).
            perCarta._tributedOriginalStats = indices.map((idx) => {
                const sacrificed = campo[idx] && campo[idx].card;
                const original = sacrificed && cardDatabase.find((entry) => entry.id === sacrificed.id);
                return sacrificed ? {
                    id: sacrificed.id,
                    attack: original ? (original.attack || 0) : (sacrificed.attack || 0),
                    defense: original ? (original.defense || 0) : (sacrificed.defense || 0)
                } : null;
            }).filter(Boolean);
            // Il numero reale di Tributi non si può ricostruire dal Livello:
            // alcune carte distinguono proprio "3 Tributi".
            perCarta._tributeCountForSummon = indices.length;
            // Segna che QUESTA Evocazione ha pagato dei Tributi: lo legge (e lo
            // toglie) eseguiEvocazioneNormale per la regola 'un'Evocazione
            // Tributo non si Setta'.
            perCarta._tributoPerEvocazione = true;
        }
        if (suMagieTrappole && perCarta) {
            addToLog(perChi(posto,
                `⚙️ Sacrifichi Castello dell'Ingranaggio Antico (invece dei mostri) per Evocare Tributo ${perCarta.name}!`,
                '⚙️ L\'avversario sacrifica Castello dell\'Ingranaggio Antico (invece dei mostri) per un\'Evocazione Tributo!'));
        }
        indices.forEach(idx => {
            const slot = campo[idx];
            if (!slot) return;
            Tavolo.cimitero(posto).push(slot.card);
            campo[idx] = null;
            if (!window.DuelEngine) return;
            // Solo per la zona Mostro: "un mio mostro è finito al
            // Cimitero" non riguarda una carta della zona Magia/Trappola.
            if (!suMagieTrappole) DuelEngine.notifyOwnMonsterSentToGraveyard(posto, slot.card);
            DuelEngine.notifySacrificedForTribute(posto, slot.card, perCarta);
        });
        updateUI();
        if (typeof extra.dopo === 'function') extra.dopo();
    };
    // Un timer delle regole: a passo comune aspetta le scelte aperte
    // (vedi il tempo delle regole in passo-comune.js).
    if (attesa > 0) PassoComune.dopo(togli, attesa); else togli();
}

/**
 * Lo scarto di fine turno scelto dalla persona (le carte selezionate con i
 * click, gameState.pendingHandDiscard): diventa il comando
 * 'scartaFineTurno' (eseguiScartoFineTurno qui sotto), con le carte per uid.
 */
function performHandDiscard() {
    const pending = gameState.pendingHandDiscard;
    if (!pending) return;
    EventiDuello.emetti('prompt-scarto-chiuso');
    const carte = pending.selected.map((i) => gameState.playerHand[i]).filter(Boolean).map((c) => c.uid);
    gameState.pendingHandDiscard = null;
    Comandi.esegui('player', { tipo: 'scartaFineTurno', carte: carte }, { dopo: pending.onComplete });
}

/**
 * Comando 'scartaFineTurno': il posto `posto` scarta le carte `c.carte`
 * (uid) per tornare al limite di carte in mano a fine turno.
 * `extra.dopo`: cosa fa chi ha scelto, a scarto concluso (far ripartire il
 * cambio turno).
 */
function eseguiScartoFineTurno(posto, c, extra) {
    const mano = Tavolo.mano(posto);
    // Dagli indici più alti ai più bassi: rimuovere prima un indice basso
    // sposterebbe (di uno) gli indici più alti, facendo scartare la carta
    // sbagliata. Gli indici si ricavano dagli uid ADESSO, non prima.
    // Una carta senza uid (costruita a mano in uno spec) si ritrova per
    // posizione, da `c.indici` (vedi autoDiscardHandExcess in fasi.js).
    const indices = (c.carte || [])
        .map((uid, k) => (uid !== null && uid !== undefined
            ? mano.findIndex((x) => x && x.uid === uid)
            : (c.indici && typeof c.indici[k] === 'number' && mano[c.indici[k]] ? c.indici[k] : -1)))
        .filter((i) => i !== -1).sort((a, b) => b - a);
    const discardedNames = [];
    // ctx.discardChosenFromHand (duel-engine.js) invece di uno splice/push
    // manuale: fa scattare def.onSentToGraveyardFromHand (es. Roc dalla
    // Valle della Foschia id 781, che nel testo reale reagisce a QUALUNQUE
    // scarto diretto dalla mano, incluso questo — non solo quello causato
    // dall'avversario) e notifyOwnMonsterSentToGraveyard, come ogni altro
    // scarto del motore. Auto-inflitto da chi scarta, non dall'avversario.
    indices.forEach((idx) => {
        const card = DuelEngine.actions.discardChosenFromHand.call({ owner: posto }, posto, idx);
        if (card) discardedNames.push(card.name);
    });
    addToLog(`🗑️ ${perChi(posto, 'Hai scartato', 'L\'avversario ha scartato')}: ${discardedNames.join(', ')}.`);
    if (window.SFX) SFX.place();
    updateUI();

    // In Multiplayer questo scarto non viaggiava: l'avversario continuava
    if (extra && typeof extra.dopo === 'function') extra.dopo();
    // A passo comune, lo scarto del posto remoto fa ripartire il turno che
    // enterEndPhase (fasi.js) aveva lasciato in attesa.
    consumaScartoFineTurnoAtteso(posto);
}

/**
 * L'Evocazione Normale (o il Set) decisa dalla persona: diventa il comando
 * 'evoca' (eseguiEvocazioneNormale qui sotto). La firma resta quella di
 * sempre perché la chiamano l'interfaccia e diversi spec.
 */
function summonMonster(card, slotIndex, position, handIndex = gameState.selectedCard.index, fromRect = null) {
    const comando = { tipo: 'evoca', carta: card && card.uid, mano: handIndex, casella: slotIndex, posizione: position };
    // Il Drago Alato di Ra (id 472): la scelta "pago i LP?" (maybeAskRaLpChoice,
    // actions.js) viaggia nel comando, non solo come segno sulla carta.
    if (card && card._raPayLp !== undefined) comando.pagaLpRa = card._raPayLp;
    return Comandi.esegui('player', comando, { partenza: fromRect });
}

/**
 * Comando 'evoca': Evocazione Normale (o Set, in Difesa coperta) della
 * carta `c.carta` dalla mano del posto `posto`, nella casella `c.casella`,
 * in Posizione `c.posizione`. Eventuali Tributi sono già stati pagati
 * (comando 'tributa'). `extra.partenza`: da dove parte il volo della carta
 * (il rettangolo di un trascinamento), solo per l'animazione.
 */
function eseguiEvocazioneNormale(posto, c, extra) {
    // `extra.alTermine`: a Evocazione conclusa — finestra di risposta
    // dell'avversario compresa — o rifiutata. Chi la aspetta (l'IA, che
    // non passa alla mossa dopo finché questa non è finita) resterebbe
    // fermo se una strada se ne dimenticasse: si chiama su TUTTE.
    const fine = () => { if (extra && typeof extra.alTermine === 'function') extra.alTermine(); };
    const handIndex = Comandi.indiceInMano(posto, c);
    if (handIndex === -1) { fine(); return; }
    const card = Tavolo.mano(posto)[handIndex];
    // Ra (id 472): CardEffects.register(472).onSummon legge la scelta dalla
    // carta; sul client che riceve il comando, è il comando a portarla.
    if (c.pagaLpRa !== undefined) card._raPayLp = c.pagaLpRa;
    const slotIndex = c.casella;
    let position = c.posizione;
    // REGOLA GENERALE: un'Evocazione Tributo si fa sempre scoperta in Attacco.
    // Non si può pagare il Tributo e Settare il mostro (coperto in Difesa),
    // a meno che il testo della carta non lo dica (def.canTributeSet: oggi
    // nessuna). Vale per la persona, per l'IA e per un comando arrivato
    // dall'altro client, perché questo è l'unico punto da cui passa
    // l'Evocazione Normale. Il marcatore lo mette 'tributa' (eseguiTributo).
    const eraTributo = card._tributoPerEvocazione === true;
    delete card._tributoPerEvocazione;
    if (eraTributo && position === 'defense') {
        const defTributo = window.DuelEngine && DuelEngine.getDefinition(card.id);
        if (!(defTributo && defTributo.canTributeSet)) {
            position = 'attack';
            addToLog(`🔺 Un'Evocazione Tributo non si può Settare: ${card.name} viene Evocata scoperta in Posizione di Attacco.`);
        }
    }
    const fromRect = extra && extra.partenza ? extra.partenza : null;
    const dellaPersona = posto === 'player';
    // Fuori dalle regole del turno, questa via non si percorre: la mano
    // della persona l'ha già fermata prima (attemptMonsterSummon), e un
    // comando remoto arriva solo da un client che l'ha già controllato.
    const chiudi = () => { if (dellaPersona) clearSelection(); else updateUI(); };
    if (!canUseNormalSummonQuota(posto, card)) {
        addToLog(perChi(posto, '❌ Hai già effettuato un\'Evocazione Normale in questo turno.', '❌ L\'avversario ha già effettuato un\'Evocazione Normale in questo turno.'));
        fine();
        return;
    }
    // Luce dell'Intervento (id 634, gameState.monsterSetBlocked): ogni Set
    // deve avvenire scoperto — la Posizione (Difesa) resta quella scelta,
    // solo la carta non risulta più coperta (isFaceDown), come da testo
    // reale della carta ("deve invece essere Evocata Normalmente scoperta
    // in Posizione di Difesa").
    let forceFaceUp = false;
    if (position === 'defense' && gameState.monsterSetBlocked) {
        forceFaceUp = true;
        addToLog('☀️ Luce dell\'Intervento impedisce il Set: evocato scoperto in Posizione di Difesa!');
    }
    // "Non può essere Posizionato Normalmente" (es. i 3 Dei Egizi id
    // 30/31/472): stesso trattamento di forceFaceUp qui sopra, ma
    // per-CARTA invece che globale — la Posizione (Difesa) scelta resta
    // valida, solo non può restare coperta.
    if (position === 'defense' && !forceFaceUp) {
        const cardDef = window.DuelEngine && DuelEngine.getDefinition(card.id);
        if (cardDef && cardDef.cannotBeSet) {
            forceFaceUp = true;
            addToLog(`🚫 ${card.name} non può essere Settata: Evocata scoperta in Posizione di Difesa!`);
        }
    }
    const isFaceDown = position === 'defense' && !forceFaceUp;
    // Capro Espiatorio (id 434): "non puoi Evocare altri mostri nel turno in
    // cui attivi questa carta (ma puoi Set)" — un'Evocazione scoperta è
    // vietata, un Set coperto no (gameState.noSummonTurn, vedi
    // DuelEngine.isSummonBannedThisTurn).
    if (!isFaceDown && window.DuelEngine && DuelEngine.isSummonBannedThisTurn(posto)) {
        addToLog(`🚫 Capro Espiatorio impedisce di Evocare altri mostri in questo turno: ${card.name} si può solo Settare.`);
        chiudi();
        fine();
        return;
    }
    // "Puoi controllarne solo 1 scoperto" (id 899): con una copia già
    // scoperta questa si può solo Settare, come per Capro Espiatorio.
    if (!isFaceDown && window.DuelEngine && DuelEngine.isFaceUpDuplicateBlocked(posto, card)) {
        addToLog(`🚫 ${card.name}: ${perChi(posto, 'puoi', 'si può')} controllarne solo 1 scoperto. Si può solo Settare.`);
        chiudi();
        fine();
        return;
    }
    // La mano dell'avversario non è a schermo: il volo parte dalla sua
    // pila del Deck... cioè da nessun elemento, e l'animazione si salta.
    const handEl = dellaPersona ? (PortaUI.queryAll('#playerHand .card')[handIndex] || null) : null;
    const slotEl = PortaUI.query(`.field-slot[data-owner="${posto}"][data-type="monster"][data-index="${slotIndex}"]`);
    // Prima del volo, il grido del duellante per la sua carta simbolo (Kaiba e
    // il Drago Bianco Occhi Blu...): senza grido o senza interfaccia parte
    // subito. Mai per un Set: una carta coperta non si annuncia.
    const prima = (avvia) => (isFaceDown ? avvia() : EventiDuello.attendi('grido-evocazione', { posto, carta: card }, avvia));
    prima(() => EventiDuello.attendi('volo-carta', { carta: card, partenza: fromRect || handEl, casella: slotEl, daNascondere: handEl, coperta: isFaceDown, posizione: position }, () => {
        const usedTribute = getTributesRequired(card) > 0;
        // La carta si ritrova per uid: durante il volo la mano può essere
        // cambiata (una pescata, uno scarto) e l'indice di prima non vale più.
        const manoOra = Tavolo.mano(posto);
        const indiceOra = manoOra.indexOf(card);
        if (indiceOra !== -1) manoOra.splice(indiceOra, 1);
        Tavolo.mostri(posto)[slotIndex] = { card: card, position: position, isFaceDown: isFaceDown, hasAttacked: false, canChangePosition: false, summonedOnTurn: gameState.turn };
        if (!isFaceDown && window.DuelDialogues) DuelDialogues.summon(posto, card);
        consumeNormalSummonQuota(posto, card);
        addToLog(position === 'attack'
            ? `${usedTribute ? '🔺 Evocazione Tributo: ' : ''}${perChi(posto, 'Hai Evocato', 'L\'avversario ha Evocato')} ${card.name}!`
            : `${usedTribute ? '🔺 Evocazione Tributo: ' : ''}${perChi(posto, 'Hai Posizionato un mostro.', 'L\'avversario ha Posizionato un mostro.')}`);
        chiudi();
        setTimeout(() => {
            EventiDuello.emetti('impatto-campo', posto, slotIndex, 'monster');
            EventiDuello.emetti('cambio-posizione', posto, slotIndex, position);
            if (window.FX) {
                const cardEl = PortaUI.query(`#${posto}FieldBoard .field-slot[data-type="monster"][data-index="${slotIndex}"] .card`);
                FX.playMonsterSummonEffect(card, cardEl);
            }
            // Effetto audio DEDICATO per questa carta (audio/evocazioni/<id>.mp3
            // — vedi js/audio/audio-library.js), se esiste; altrimenti il suono
            // di Evocazione standard di sempre.
            // I Livelli 7+ scelgono l'audio DOPO la ricerca del filmato
            // dentro playMonsterSummonEffect: video dedicato oppure
            // evocation.mp3, mai summon() sovrapposto a entrambi.
            if ((card.level || 0) < 7 && !(window.AudioLibrary && AudioLibrary.tryPlayCardSound(card, 'evocazioni'))) {
                if (window.SFX) SFX.summon(position);
            }
        }, 30);

        // Finestra per un'eventuale risposta dell'avversario (es. Buco
        // Trappola) — vedi js/engine/duel-engine.js. È "fire and forget": se la
        // risposta distrugge il mostro appena Evocato, updateUI() nella
        // callback lo riflette subito a schermo.
        const summonCtx = DuelEngine.makeContext(posto, { summonedCard: card, summonedSlotIndex: slotIndex, summonedPosition: position });
        DuelEngine.fireTrigger(DuelEngine.TRIGGER.ON_NORMAL_SUMMON, summonCtx, () => { updateUI(); fine(); });
    }));
}

/** Il cambio di Posizione deciso dalla persona: diventa il comando 'posizione'. */
function changeMonsterPosition(slotIndex) {
    return Comandi.esegui('player', { tipo: 'posizione', casella: slotIndex });
}

/**
 * Comando 'posizione': il mostro del posto `posto` nella casella
 * `c.casella` passa da Attacco a Difesa o viceversa (da coperto in Difesa
 * ad Attacco è un Flip Summon).
 */
function eseguiCambioPosizione(posto, c) {
    const slotIndex = c.casella;
    const dellaPersona = posto === 'player';
    const monsterSlot = Tavolo.mostri(posto)[slotIndex];
    if (!monsterSlot || !monsterSlot.canChangePosition) return;
    // Divieto di cambio Posizione per QUESTO SOLO mostro — es. Incantesimo
    // Ombra (id 439): vedi gameState.cannotChangePositionUids, stesso
    // meccanismo (ricalcolato ad ogni render) del divieto d'attacco in
    // resolveAttack() più sopra in questo file.
    if (gameState.cannotChangePositionUids && gameState.cannotChangePositionUids[monsterSlot.card.uid]) {
        addToLog(`🚫 ${monsterSlot.card.name} non può cambiare Posizione in questo momento.`);
        return;
    }
    // Stesso divieto qui sopra, ma "fino a fine turno" invece che
    // ricalcolato ad ogni render — per un effetto ONE-SHOT come
    // Maledizione di Anubis (id 655), non continuo come Incantesimo
    // Ombra. Vedi gameState.cannotChangePositionUidsThisTurn in
    // game-flow.js (changeTurn()) per il perché serve un Set separato.
    if (gameState.cannotChangePositionUidsThisTurn && gameState.cannotChangePositionUidsThisTurn.has(monsterSlot.card.uid)) {
        addToLog(`🚫 ${monsterSlot.card.name} non può cambiare Posizione in questo momento.`);
        return;
    }
    // Divieto per TUTTI i propri mostri fino a un certo turno (es.
    // Controllo Mesmerico, id 814) — gameState.cannotChangePositionFor[owner]
    // è il numero del turno oltre il quale il divieto scade, non un booleano.
    if (gameState.cannotChangePositionFor && gameState.cannotChangePositionFor[posto] && gameState.turn <= gameState.cannotChangePositionFor[posto]) {
        addToLog(perChi(posto, '🚫 Non puoi cambiare la Posizione dei tuoi mostri in questo turno (Controllo Mesmerico).', '🚫 L\'avversario non può cambiare la Posizione dei suoi mostri in questo turno (Controllo Mesmerico).'));
        return;
    }
    // Un mostro coperto (isFaceDown) che passa in Attacco è un Flip
    // Summon manuale (catturato PRIMA del cambio qui sotto, che azzera
    // isFaceDown) — a differenza di un flip subito attaccando
    // (resolveBattleDamage in questo stesso file), questo caso non
    // scatenava MAI TRIGGER.ON_FLIP: bug corretto qui sotto, stesso
    // aggancio già usato per l'altro caso.
    const isManualFlipSummon = monsterSlot.isFaceDown;
    const newPosition = monsterSlot.position === 'attack' ? 'defense' : 'attack';
    DuelEngine.actions.changePosition(posto, slotIndex, newPosition);
    if (monsterSlot.position === 'attack') monsterSlot.isFaceDown = false;
    monsterSlot.canChangePosition = false;
    if (isManualFlipSummon && monsterSlot.position === 'attack') {
        monsterSlot.summonedViaFlip = true;
        if (window.DuelEngine) {
            const flipCtx = DuelEngine.makeContext(posto, { card: monsterSlot.card, slotIndex: slotIndex });
            DuelEngine.fireTrigger(DuelEngine.TRIGGER.ON_FLIP, flipCtx);
        }
    }
    addToLog(`${perChi(posto, 'Hai cambiato', 'L\'avversario ha cambiato')} ${monsterSlot.card.name} in Posizione di ${monsterSlot.position}.`);
    if (window.SFX) SFX.place();
    if (dellaPersona) clearSelection(); else updateUI();
    // Flip Summon: la carta si GIRA davvero in 3D invece di passare da
    // dorso a fronte fra un render e l'altro, che a schermo si legge come
    // una sostituzione istantanea — cioè il momento più teatrale del
    // gioco (scoprire un mostro coperto) buttato via.
    //
    // L'animazione esisteva già (CardRenderer.playFlipReveal, usata da
    // resolveBattleDamage quando un attacco rivela un mostro coperto) ma
    // NON era mai agganciata al Flip Summon fatto dal giocatore: stessa
    // situazione a schermo, due strade diverse nel codice, una sola delle
    // due animata.
    //
    // Va DOPO clearSelection(), che ridisegna il Terreno: chiamarla prima
    // vorrebbe dire costruire l'elemento che gira e vederselo buttare via
    // dal render successivo un istante dopo.
    if (isManualFlipSummon && monsterSlot.position === 'attack'
        && window.CardRenderer && typeof CardRenderer.playFlipReveal === 'function') {
        const slotEl = PortaUI.query(`#${posto}FieldBoard .field-slot[data-owner="${posto}"][data-type="monster"][data-index="${slotIndex}"]`);
        if (slotEl) CardRenderer.playFlipReveal(slotEl, monsterSlot.card, monsterSlot.position);
    }
    setTimeout(() => EventiDuello.emetti('cambio-posizione', posto, slotIndex, monsterSlot.position), 60);
}

/** Il Set di una Magia/Trappola deciso dalla persona: diventa il comando 'settaMT'. */
function setSpellTrap(card, slotIndex, handIndex = gameState.selectedCard.index, fromRect = null) {
    return Comandi.esegui('player', { tipo: 'settaMT', carta: card && card.uid, mano: handIndex, casella: slotIndex }, { partenza: fromRect });
}

/**
 * Comando 'settaMT': la carta `c.carta` della mano del posto `posto` va
 * coperta nella casella Magia/Trappola `c.casella`.
 */
function eseguiSetMagiaTrappola(posto, c, extra) {
    // `extra.alTermine`: a carta posata (o rifiutata), vedi eseguiEvocazioneNormale.
    const fine = () => { if (extra && typeof extra.alTermine === 'function') extra.alTermine(); };
    const handIndex = Comandi.indiceInMano(posto, c);
    if (handIndex === -1) { fine(); return; }
    const card = Tavolo.mano(posto)[handIndex];
    const slotIndex = c.casella;
    const fromRect = extra && extra.partenza ? extra.partenza : null;
    const dellaPersona = posto === 'player';
    const chiudi = () => { if (dellaPersona) clearSelection(); else updateUI(); };
    // Onda Sismica (id 818): la Zona bersagliata non può essere usata —
    // vedi DuelEngine.isSTZoneLocked/findFreeSTSlot (duel-engine.js).
    if (window.DuelEngine && DuelEngine.isSTZoneLocked(posto, slotIndex)) {
        addToLog('❌ Quella Zona Magia/Trappola non può essere usata (Onda Sismica).');
        chiudi();
        fine();
        return;
    }
    const handEl = dellaPersona ? (PortaUI.queryAll('#playerHand .card')[handIndex] || null) : null;
    const slotEl = PortaUI.query(`.field-slot[data-owner="${posto}"][data-type="st"][data-index="${slotIndex}"]`);
    EventiDuello.attendi('volo-carta', { carta: card, partenza: fromRect || handEl, casella: slotEl, daNascondere: handEl, coperta: true }, () => {
        // Il nome di una carta coperta non si annuncia a chi non l'ha messa.
        addToLog(dellaPersona ? `🪄 ${card.name} è stata piazzata sul Terreno.` : '🧑 L\'avversario ha piazzato una carta coperta sul Terreno.');
        if (window.SFX) SFX.place();
        const manoOra = Tavolo.mano(posto);
        const indiceOra = manoOra.indexOf(card);
        if (indiceOra !== -1) manoOra.splice(indiceOra, 1);
        // setOnTurn ricorda in che turno è stata piazzata: serve al motore
        // effetti (js/engine/duel-engine.js) per applicare la regola classica "una
        // Trappola Set non si può attivare nello stesso turno in cui è stata
        // piazzata".
        Tavolo.magieTrappole(posto)[slotIndex] = { card: card, isFaceDown: true, setOnTurn: gameState.turn };
        chiudi();
        // L'ATTERRAGGIO. Il volo dalla mano c'era gia' (flyCardToSlot qui
        // sopra), ma la carta arrivava e si fermava di colpo: nessun
        // tonfo, nessun peso. Stesso trattamento gia' riservato a un
        // mostro Evocato (triggerFieldImpact), piu' un velo di polvere.
        // Dopo clearSelection(), che ridisegna: triggerFieldImpact ha un
        // suo ritentativo per ritrovare la casella appena ricreata.
        EventiDuello.emetti('impatto-campo', posto, slotIndex, 'st');
        if (window.FX && typeof FX.playCardSet === 'function') {
            const postoEl = PortaUI.query(`#${posto}FieldBoard .field-slot[data-owner="${posto}"][data-type="st"][data-index="${slotIndex}"]`);
            FX.playCardSet(postoEl);
        }
        fine();
    });
}

/** Il Set di una Magia Terreno deciso dalla persona: diventa il comando 'terreno'. */
function setFieldSpell(card, handIndex = gameState.selectedCard.index, fromRect = null) {
    return Comandi.esegui('player', { tipo: 'terreno', carta: card && card.uid, mano: handIndex }, { partenza: fromRect });
}

/**
 * Comando 'terreno': come 'settaMT', ma per una Magia Terreno: va SEMPRE
 * nella sua zona dedicata (un solo oggetto, non un array di 5 caselle) —
 * mai in una delle 5 caselle Magia/Trappola comuni. Se c'era già una Magia
 * Terreno lì, va al Cimitero: attivarne una nuova sostituisce sempre
 * quella vecchia, come da regola vera.
 */
function eseguiSetMagiaTerreno(posto, c, extra) {
    const handIndex = Comandi.indiceInMano(posto, c);
    if (handIndex === -1) return;
    const card = Tavolo.mano(posto)[handIndex];
    const fromRect = extra && extra.partenza ? extra.partenza : null;
    const dellaPersona = posto === 'player';
    const handEl = dellaPersona ? (PortaUI.queryAll('#playerHand .card')[handIndex] || null) : null;
    const slotEl = PortaUI.query(`.field-slot[data-owner="${posto}"][data-type="field-spell"]`);
    EventiDuello.attendi('volo-carta', { carta: card, partenza: fromRect || handEl, casella: slotEl, daNascondere: handEl, coperta: true }, () => {
        const existing = Tavolo.magiaTerreno(posto);
        if (existing) {
            Tavolo.cimitero(posto).push(existing.card);
            addToLog(`🌍 ${existing.card.name} lascia il Terreno, sostituita da ${dellaPersona ? card.name : 'una Magia Terreno coperta'}.`);
        }
        addToLog(dellaPersona ? `🌍 ${card.name} è stata piazzata sulla zona Terreno.` : '🧑 L\'avversario ha piazzato una Magia Terreno coperta.');
        if (window.SFX) SFX.place();
        const manoOra = Tavolo.mano(posto);
        const indiceOra = manoOra.indexOf(card);
        if (indiceOra !== -1) manoOra.splice(indiceOra, 1);
        gameState[posto + 'FieldSpell'] = { card: card, isFaceDown: true, setOnTurn: gameState.turn };
        if (dellaPersona) clearSelection(); else updateUI();
    });
}
