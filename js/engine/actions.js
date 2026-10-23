let dragState = null;

// ============================================================
// Ascoltatori del canale delle regole (js/engine/eventi-duello.js): la
// parte di quel canale che si disegna con funzioni di questo file. Le
// altre sono registrate in cima a game-flow.js.
// ============================================================
EventiDuello.ascolta('selezione-azzerata', chiudiSelezioneASchermo);
EventiDuello.ascolta('prompt-tributo-chiuso', () => hideTributePrompt());
EventiDuello.ascolta('prompt-scarto-chiuso', () => hideHandDiscardPrompt());
EventiDuello.ascolta('evocazione-tributo-pronta', resolveTributeSummonPlacement);
EventiDuello.ascolta('impatto-campo', triggerFieldImpact);
EventiDuello.ascolta('distruzione', triggerDestroyEffect);
EventiDuello.ascolta('attacco-bloccato', triggerBlockedEffect);
EventiDuello.ascolta('scarto-fine-turno', startHandDiscardSelection);
EventiDuello.ascolta('volo-carta', (volo, fatto) => {
    flyCardToSlot(volo.carta, volo.partenza, volo.casella, fatto, volo.daNascondere, volo.coperta, volo.posizione);
});
EventiDuello.ascolta('transizione-carta', (movimento) => {
    if (window.FX && typeof FX.playZoneTransition === 'function') FX.playZoneTransition(movimento);
});
// Una scelta per la persona davanti allo schermo (js/engine/decisioni.js):
// qui si sceglie COME mostrarla, secondo il tipo. `rispondi` va chiamata
// col candidato scelto, o con null quando la si chiude senza scegliere.
// Quale metodo di DuelEngineUI mostra ogni tipo di decisione.
const MOSTRA_DECISIONE = {
    'carte': 'openCardListPicker',
    'presa-visione': 'openCardListPicker',
    'opzioni': 'openOptionPicker',
    'posizione': 'openPositionPicker',
    'coppia': 'openChoicePopover',
    'risposta': 'promptDefenderResponse'
};
// "Questa scelta si può mostrare adesso?" No se DuelEngineUI non c'è, o non
// sa mostrare quel tipo: allora decide la scelta automatica, come per il
// bot. È anche il modo in cui gli spec simulano una pagina senza modali
// (window.DuelEngineUI = null).
EventiDuello.ascolta('decisioni-a-schermo', (tipo) => {
    const ui = window.DuelEngineUI;
    if (!ui) return false;
    if (tipo && typeof ui[MOSTRA_DECISIONE[tipo]] !== 'function') return false;
    return undefined;
});
EventiDuello.ascolta('decisione', (r, rispondi) => {
    const ui = window.DuelEngineUI;
    // La nuova decisione sostituisce qualunque consultazione passiva rimasta
    // aperta: il giocatore deve vedere senza ostacoli candidati e comandi.
    if (typeof updateCardInfoPanel === 'function') updateCardInfoPanel(null);
    const annulla = r.annullabile ? () => rispondi(null) : undefined;
    switch (r.tipo) {
        case 'carte': {
            const mostra = typeof r.mostra === 'function' ? r.mostra : (c) => c;
            const disegnate = r.candidati.map(mostra);
            // Si risponde per POSIZIONE nell'elenco quando il picker la
            // dà, altrimenti ritrovando la carta per uid: quella disegnata
            // può essere una copia (una carta coperta dell'avversario si
            // mostra col retro, vedi chooseFieldCardTarget in card-effects.js).
            const candidatoDi = (card, i) => {
                if (typeof i === 'number' && r.candidati[i] !== undefined) return r.candidati[i];
                const j = disegnate.findIndex((d) => d === card || (d && card && d.uid !== undefined && d.uid === card.uid));
                return j === -1 ? null : r.candidati[j];
            };
            // Una scelta NON annullabile e' parte di un effetto gia' attivato: chiudere il riquadro senza
            // scegliere lascerebbe la carta "buttata" e la decisione appesa (bug segnalato su Mostro
            // Resuscitato). Si riapre lo stesso elenco finche' non si sceglie; con l'elenco vuoto non c'e'
            // nulla da scegliere e si chiude con "nessuna".
            const apri = () => ui.openCardListPicker(disegnate, {
                title: r.titolo, text: r.testo, emptyText: r.vuota,
                onSelect: (card, i) => rispondi(candidatoDi(card, i)),
                onCancel: annulla || (disegnate.length === 0 ? () => rispondi(null) : () => setTimeout(apri, 0))
            });
            apri();
            break;
        }
        case 'presa-visione':
            ui.openCardListPicker(r.candidati, {
                title: r.titolo, text: r.testo, emptyText: r.vuota, selectable: false,
                onCancel: () => rispondi(null)
            });
            break;
        case 'opzioni':
            ui.openOptionPicker(r.ancora || null, {
                title: r.titolo, text: r.testo, options: r.candidati,
                onSelect: (value, voce) => rispondi(voce),
                onCancel: annulla, cancelLabel: r.etichettaAnnulla
            });
            break;
        case 'posizione':
            ui.openPositionPicker(r.ancora || null, { title: r.titolo, onSelect: (posizione) => rispondi(posizione) });
            break;
        case 'coppia': {
            const [a, b] = r.candidati;
            ui.openChoicePopover(r.ancora || null, {
                title: r.titolo,
                choiceA: { label: a.label, icon: a.icon, onSelect: () => rispondi(a) },
                choiceB: { label: b.label, icon: b.icon, onSelect: () => rispondi(b) }
            });
            break;
        }
        case 'risposta':
            // "Vuoi rispondere?" in una Catena: il prompt chiama `rispondi`
            // con la carta scelta, o con null per passare.
            ui.promptDefenderResponse(r.candidati, rispondi, r.cartaInnesco, r.momento, r.innescoProprio);
            break;
        default:
            console.error(`Decisione di tipo sconosciuto: ${r.tipo}`);
            rispondi(null);
    }
});

// Alcune WebView Android emettono ancora un `click` di compatibilita'
// subito DOPO la coppia pointerdown/pointerup touch, anche se il down e'
// stato preventDefault(). Nel frattempo handleCardClick puo' aver
// ricostruito la mano o montato il click-catcher del popover: quel click
// ritardato finisce allora sul body/catcher e annulla immediatamente la
// selezione appena aperta. Conserviamo posizione e scadenza di UN SOLO
// click atteso; un vero tap altrove ha coordinate diverse e non viene mai
// inghiottito.
let pendingHandCompatibilityClick = null;

function armHandCompatibilityClick(event) {
    if (!event || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
    pendingHandCompatibilityClick = {
        x: event.clientX,
        y: event.clientY,
        expiresAt: performance.now() + 750
    };
}

function consumeHandCompatibilityClick(event) {
    const pending = pendingHandCompatibilityClick;
    if (!pending) return false;
    pendingHandCompatibilityClick = null;
    if (performance.now() > pending.expiresAt || !event) return false;
    return Math.hypot(event.clientX - pending.x, event.clientY - pending.y) <= 24;
}

/**
 * Punto d'ingresso di OGNI click su una carta (mano, Terreno, Magia
 * Terreno) — il gestore più chiamato di tutta la UI. Racchiude
 * handleCardClickInner in un try/catch: prima di questa protezione, un
 * bug in QUALUNQUE ramo sottostante lasciava la pagina bloccata in
 * silenzio (nessun feedback, nessun modo di continuare senza ricaricare),
 * esattamente il tipo di rischio segnalato dall'audit architettonico.
 */
function handleCardClick(card, sourceType, sourceIndex, sourceOwner, isFaceDown = false) {
    try {
        handleCardClickInner(card, sourceType, sourceIndex, sourceOwner, isFaceDown);
    } catch (err) {
        console.error('[handleCardClick] errore non gestito:', err);
        if (typeof addToLog === 'function') {
            addToLog('⚠️ Si è verificato un errore imprevisto gestendo il click. Riprova, o ricarica la pagina se il problema persiste.');
        }
    }
}

function handleCardClickInner(card, sourceType, sourceIndex, sourceOwner, isFaceDown = false) {
    // L'ispezione della carta non e' un'azione di gioco: deve funzionare
    // anche fuori dalla Main Phase e mentre gioca l'avversario. Questo e'
    // particolarmente importante su touch, dove non esiste l'hover che su
    // desktop mostrava comunque il pannello informativo.
    // Se il tap sta rispondendo a una selezione attiva, deve fare SOLO
    // quell'azione. Il pannello resta invece disponibile nei tap normali,
    // anche fuori Main Phase e durante il turno avversario.
    const selected = gameState.selectedCard;
    const startsSelectedTribute = sourceType === 'monster' && sourceOwner === 'player'
        && selected && selected.type === 'hand' && selected.card && selected.card.type === 'monster'
        && getTributesRequired(selected.card) > 0;
    const gameplayOnly = (typeof isGameplaySelectionActive === 'function' && isGameplaySelectionActive())
        || startsSelectedTribute;
    if (gameplayOnly) updateCardInfoPanel(null);
    else updateCardInfoPanel(card, { sourceType, sourceOwner, isFaceDown });
    if (gameState.currentPlayer !== 'player' || isDraggingAttack) return;
    const isMainPhase = gameState.phase === 'main1' || gameState.phase === 'main2';
    // Le Magie Veloci (subtype 'quick-play') sono per testo reale attivabili
    // in QUALUNQUE momento in cui il giocatore avrebbe priorità, non solo in
    // Main Phase — a differenza di una Magia Normale. La finestra di
    // priorità a vuoto del turno avversario (DuelEngine.openPriorityWindow)
    // offre solo Effetti Veloci di carte già scoperte o dalla mano con
    // canRespondFromHand, non Magie Veloci da giocare (vedi CLAUDE.md), ma almeno la Battle
    // Phase del proprio turno è un momento reale e comune in cui il
    // giocatore le vorrebbe giocare (es. Tifone dello Spazio Mistico prima
    // del Damage Step, Controllore del Nemico per cambiare Posizione a un
    // mostro prima che attacchi) — senza questa eccezione restavano
    // attivabili SOLO in Main Phase esattamente come una Magia Normale,
    // il bug segnalato ("Magie veloci non si attivano"). Le due eccezioni
    // sono applicate puntualmente più sotto (mano + già Set sul Terreno),
    // non con una variabile unica: i due rami leggono la carta da posti
    // diversi (parametro `card` vs `gameState.playerSTField[sourceIndex]`).

    // Se è in corso una selezione di Tributi, i click sui mostri del
    // giocatore servono a selezionare i sacrifici, non ad altro.
    if (gameState.pendingTributeSummon) {
        if (sourceType === 'monster' && sourceOwner === 'player') {
            handleTributeSelectClick(sourceIndex);
        }
        return;
    }

    // Se è in corso lo scarto obbligatorio per il limite di mano a fine
    // turno (vedi startHandDiscardSelection più sotto), i click sulle
    // carte in mano servono a selezionare cosa scartare, non ad altro —
    // stesso identico principio della selezione Tributi qui sopra.
    if (gameState.pendingHandDiscard) {
        if (sourceType === 'hand' && sourceOwner === 'player') {
            handleHandDiscardSelectClick(sourceIndex);
        }
        return;
    }

    // Un tap/click su una carta della propria mano la rende il riferimento
    // visivo corrente anche nei rami che aprono subito pulsanti flottanti
    // (Attiva, Special Summon, ecc.). Prima quei rami non impostavano
    // selectedCard: su mobile, senza :hover, la carta non si alzava.
    if (sourceType === 'hand' && sourceOwner === 'player') {
        selectHandCardForInspection(card, sourceIndex, sourceOwner);
    }

    if (sourceType === 'hand' && card.type === 'spell'
        && (isMainPhase || (gameState.phase === 'battle' && card.subtype === 'quick-play'))
        && window.DuelEngine && DuelEngine.canActivate('player', 'hand', sourceIndex)) {
        // Magia in mano che si può attivare SUBITO (senza passare dal
        // Terreno): mostra un pulsante "Attiva" appena sopra la carta
        // invece del solo evidenzia-slot. Per piazzarla Coperta si trascina
        // comunque la carta su una casella Magia/Trappola libera (drag &
        // drop, vedi placeDraggedCard) — quella via resta sempre disponibile
        // e non passa da questo popover.
        promptHandSpellActivation(card, sourceIndex);
    } else if (sourceType === 'hand' && isMainPhase && card.type === 'monster' && window.DuelEngine && DuelEngine.canSpecialSummonFromHand('player', sourceIndex)) {
        // Mostro in mano Special Summonabile tramite il proprio effetto
        // (es. Gilasaurus, i mostri Toon che dipendono da "Mondo dei
        // Toon"): offri la scelta tra Evocazione Normale (il vecchio
        // comportamento) e Special Summon, invece di forzare solo l'una o
        // solo l'altra.
        promptHandMonsterSpecialSummon(card, sourceIndex);
    } else if (sourceType === 'hand' && isMainPhase && card.type === 'monster' && window.DuelEngine && DuelEngine.canActivate('player', 'hand', sourceIndex)) {
        // Mostro in mano con un effetto attivabile DALLA MANO che non è
        // uno Special Summon (es. Thunder Dragon, id 537: scartalo per
        // cercarne altre copie nel Deck) — stesso identico spirito di
        // promptHandSpellActivation qui sopra, ma con la scelta
        // "Attiva/Evoca" invece di "Attiva/Set" (un mostro non si mette
        // mai Coperto senza combattere prima una selezione Attacco/Difesa).
        promptHandMonsterActivation(card, sourceIndex);
    } else if (sourceType === 'hand' && isMainPhase) {
        gameState.selectedCard = { type: sourceType, card: card, index: sourceIndex, owner: sourceOwner };
        updateCardInfoPanel(card, { sourceType, sourceOwner, isFaceDown: false });
        // updateUI() PRIMA di highlightEmptySlots(): renderFields() dentro
        // updateUI() ricostruisce da zero gli slot del Terreno, quindi
        // qualunque classe aggiunta PRIMA di quella chiamata sparisce subito
        // — l'evidenziazione va applicata DOPO, sul DOM appena ricostruito.
        updateUI();
        highlightEmptySlots(card);
    } else if (sourceType === 'monster' && sourceOwner === 'player' && isMainPhase) {
        // Se in mano è selezionata una carta che richiede Sacrificio,
        // cliccare un proprio mostro già in campo (anche occupato — l'UNICO
        // modo di avviare un'Evocazione Tributo via click quando tutte e 5
        // le caselle Mostro sono piene) avvia il flusso di Sacrificio
        // invece di interagire con quel mostro (cambio Posizione/Ignition).
        // Stesso principio già valido per il drag & drop, che raggiunge
        // attemptMonsterSummon() anche su una casella occupata — vedi lì
        // per come viene gestita. Se poi risulta che quella carta NON
        // richiede davvero Sacrificio (es. un'eccezione come Gaia il
        // Cavaliere Feroce Rapido), attemptMonsterSummon() lo scopre da
        // sola e rifiuta con l'errore corretto "casella già occupata".
        const selected = gameState.selectedCard;
        if (selected && selected.type === 'hand' && selected.card && selected.card.type === 'monster'
            && getTributesRequired(selected.card) > 0) {
            attemptMonsterSummon(selected.card, selected.index, sourceIndex);
        } else {
            promptMonsterFieldAction(sourceIndex);
        }
    } else if (sourceType === 'st' && sourceOwner === 'player' && (isMainPhase
        // Stessa eccezione di Battle Phase concessa qui sopra alle Magie
        // Veloci in mano: una Magia Veloce già Set sul Terreno è per testo
        // reale attivabile con lo stesso identico timing di una Trappola,
        // quindi anche durante la propria Battle Phase, non solo Main Phase.
        || (gameState.phase === 'battle' && gameState.playerSTField[sourceIndex] && gameState.playerSTField[sourceIndex].card
            && gameState.playerSTField[sourceIndex].card.subtype === 'quick-play'))) {
        // Click su una propria Magia/Trappola già piazzata: prova ad
        // attivarla di propria iniziativa (vedi js/engine/duel-engine.js per le
        // regole di quando è permesso — es. una Trappola non si può
        // attivare nel turno in cui è stata Set).
        attemptActivateCard('player', 'st', sourceIndex);
    } else if (sourceType === 'field-spell' && sourceOwner === 'bot' && isMainPhase && !isFaceDown && window.DuelEngine
        && typeof (DuelEngine.getDefinition(card.id) || {}).activateAsTurnPlayer === 'function') {
        // Magia Terreno dell'AVVERSARIO che "il giocatore di turno" può usare
        // (Cancello di Fusione id 887): def.canActivateAsTurnPlayer/
        // activateAsTurnPlayer, con il contesto del giocatore di turno (noi).
        // Non è l'attivazione di una carta, quindi niente Chain. È il
        // comando 'usaTerrenoAltrui', lo stesso dell'IA (js/engine/comandi.js).
        if (!Comandi.esegui('player', { tipo: 'usaTerrenoAltrui' })) {
            addToLog(`❌ Non puoi usare ${card.name} in questo momento.`);
        }
    } else if (sourceType === 'field-spell' && sourceOwner === 'player' && isMainPhase) {
        // Click sulla propria Magia Terreno già piazzata: stesso principio
        // di sourceType === 'st' qui sopra, ma sulla sua zona dedicata.
        attemptActivateCard('player', 'fieldSpell', -1);
    }
}

/**
 * Prova ad attivare manualmente una carta (Magia dalla mano/dal Terreno o
 * Trappola già Set): se le regole lo permettono, mostra il modale di
 * conferma "Attiva la carta" (vedi DuelEngineUI più sotto); altrimenti
 * spiega nel log perché non è possibile, invece di far succedere nulla
 * in silenzio.
 */
function attemptActivateCard(owner, zone, index) {
    const card = zone === 'hand' ? gameState.playerHand[index]
        : zone === 'fieldSpell' ? (gameState.playerFieldSpell && gameState.playerFieldSpell.card)
        : gameState.playerSTField[index] && gameState.playerSTField[index].card;
    if (!card) return;

    const def = DuelEngine.getDefinition(card.id);
    if (!def) {
        addToLog(`ℹ️ ${card.name} non ha un effetto attivabile.`);
        return;
    }
    if (typeof def.activate !== 'function') {
        // Carte come Forza Riflessa/Cilindro Magico/Buco Trappola non si
        // attivano mai di propria iniziativa: scattano da sole quando
        // l'avversario attacca o evoca (vedi js/engine/duel-engine.js).
        addToLog(`ℹ️ ${card.name} si attiva automaticamente in risposta a un'azione dell'avversario, non manualmente.`);
        return;
    }
    if (!DuelEngine.canActivate(owner, zone, index)) {
        if (def.continuous && zone === 'st' && !gameState.playerSTField[index].isFaceDown) {
            addToLog(`ℹ️ ${card.name} è già attiva: resta in campo da sola finché non viene rimossa.`);
        } else if (zone === 'fieldSpell' && gameState.playerFieldSpell && !gameState.playerFieldSpell.isFaceDown) {
            addToLog(`ℹ️ ${card.name} è già attiva: resta sul Terreno finché non viene rimossa o sostituita.`);
        } else if (card.type === 'trap' && zone === 'st' && gameState.playerSTField[index].setOnTurn === gameState.turn) {
            addToLog(`❌ ${card.name} non può essere attivata nel turno in cui è stata Set.`);
        } else if (card.type === 'trap' && DuelEngine.areTrapsNegatedFor(owner)) {
            addToLog(`❌ Le Trappole sono negate in questo momento (es. Jinzo in campo).`);
        } else if (card.type === 'spell' && DuelEngine.areSpellsNegatedFor(owner)) {
            addToLog(`❌ Le Magie sono negate in questo momento (es. Cancella Magie in campo).`);
        } else {
            addToLog(`❌ Non ci sono le condizioni per attivare ${card.name} adesso.`);
        }
        return;
    }

    window.DuelEngineUI.openActivateModal(card, {
        title: '✨ Attiva la carta',
        text: `Vuoi attivare ${card.name} adesso?`,
        onConfirm: () => Comandi.esegui(owner, { tipo: 'attiva', zona: zone, indice: index, carta: zone === 'hand' && Tavolo.mano(owner)[index] ? Tavolo.mano(owner)[index].uid : undefined })
    });
}

function startHandCardDrag(event, card, sourceIndex, sourceOwner) {
    if (isDraggingAttack) return;
    if (gameState.pendingTributeSummon) return;
    const isMainPhase = gameState.phase === 'main1' || gameState.phase === 'main2';

    event.preventDefault();
    event.stopPropagation();

    // Feedback tattile (vibrazione breve, solo nell'APK nativo — vedi
    // js/native/haptics.js, no-op sul web) quando si prende in mano una
    // carta per davvero: dà alla carta una sensazione "fisica" invece di
    // un semplice tocco su un'immagine.
    if (window.NativeHaptics && gameState.currentPlayer === 'player') NativeHaptics.light();

    // Il fantasma ruotato (.drag-preview, transform: rotate(3deg) scale(1.05))
    // e l'occultamento della carta vera in mano NON si creano già qui: un
    // semplice click (nessun movimento) passava comunque da qui, quindi si
    // vedeva la carta "scattare" ruotata per un istante anche solo
    // cliccandola — creati invece in handleDragMove, solo quando il
    // movimento supera la soglia che lo qualifica come vero trascinamento
    // (vedi lì sotto).
    dragState = {
        type: 'hand',
        card,
        sourceIndex,
        sourceOwner,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        // Fuori dalla Main Phase (o durante il turno avversario) il gesto
        // resta un semplice tap di ispezione: niente fantasma e soprattutto
        // nessun drop capace di piazzare illegalmente una carta. Al rilascio
        // passa comunque da handleCardClick, che mostra dettagli e, quando
        // consentito (es. Magia Rapida in Battle Phase), i relativi comandi.
        dragEnabled: gameState.currentPlayer === 'player' && isMainPhase,
        sourceEl: event.currentTarget
    };

    document.addEventListener('pointermove', handleDragMove);
    document.addEventListener('pointerup', handleDragEnd);
    document.addEventListener('pointercancel', handleDragEnd);
}

/**
 * Crea il "fantasma" della carta trascinata. L'offset che la centra sotto
 * il dito/cursore NON è più un numero fisso (45px/66px): su schermi
 * piccoli, dove la carta in mano è molto più stretta della dimensione per
 * cui quei numeri erano tarati, uno scarto fisso la faceva comparire
 * visibilmente spostata dal punto di contatto reale — tanto più evidente
 * quanto più il dito si spostava (il fantasma "andava fuori asse"). Ora
 * si misura la carta VERA appena creata (stessa larghezza --hand-card-w
 * della mano, vedi .drag-preview in CSS) e la si centra per la sua metà
 * esatta, qualunque sia la dimensione dello schermo.
 */
function createDragPreview(card, x, y) {
    // Copia del nodo che si sta trascinando invece di una carta ricostruita da zero: le immagini sono
    // già decodificate e il primo fotogramma del trascinamento non ha il "singhiozzo" della creazione.
    const sorgente = dragState && dragState.sourceEl;
    const preview = (sorgente && sorgente.cloneNode) ? sorgente.cloneNode(true) : createCardElement(card);
    preview.classList.remove('dragging-source', 'selected', 'pending-deal');
    preview.classList.add('drag-preview');
    preview.removeAttribute('id');
    preview.style.visibility = '';
    preview.onpointerdown = null; preview.onmouseenter = null;
    document.body.appendChild(preview);
    // Misure della carta SENZA rotazione/scala: il centro visivo coincide con il punto di contatto.
    dragState.previewHalfW = preview.offsetWidth / 2;
    dragState.previewHalfH = preview.offsetHeight / 2;
    // Dove si era afferrata la carta rispetto al suo centro: il fantasma nasce ESATTAMENTE sulla carta
    // (stessa posizione, nessuna rotazione) e scivola verso il centro del dito mentre ruota e si ingrandisce.
    // Prima nasceva già ruotato e centrato sul dito, ed era uno scatto.
    if (dragState.sourceEl && dragState.sourceEl.getBoundingClientRect) {
        const r = dragState.sourceEl.getBoundingClientRect();
        dragState.presaX = (r.left + r.width / 2) - dragState.startX;
        dragState.presaY = (r.top + r.height / 2) - dragState.startY;
    } else { dragState.presaX = 0; dragState.presaY = 0; }
    dragState.inizioAnteprima = performance.now();
    posizionaAnteprimaTrascinamento(preview, x, y);
    return preview;
}

const DURATA_ATTACCO_TRASCINAMENTO_MS = 180;

/**
 * Sposta il fantasma con `transform` (compositor, nessun layout) invece di left/top: ad ogni movimento
 * del dito il browser doveva ricalcolare la pagina intera, ed è ciò che rendeva il trascinamento "di legno".
 * La rotazione/scala vivono nello stesso transform perché uno stile inline vincerebbe sul CSS della classe.
 */
function posizionaAnteprimaTrascinamento(preview, x, y) {
    // p: 0 = carta ferma com'era, 1 = carta "in mano" (inclinata, un po' più grande, centrata sul dito).
    const t = Math.min(1, (performance.now() - (dragState.inizioAnteprima || 0)) / DURATA_ATTACCO_TRASCINAMENTO_MS);
    const p = 1 - Math.pow(1 - t, 3);
    const px = x + (dragState.presaX || 0) * (1 - p) - dragState.previewHalfW;
    const py = y + (dragState.presaY || 0) * (1 - p) - dragState.previewHalfH;
    preview.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${(3 * p).toFixed(3)}deg) scale(${(1 + 0.05 * p).toFixed(4)})`;
    // Se il dito sta fermo non arrivano pointermove: serve comunque un fotogramma per finire l'attacco.
    if (t < 1 && dragState && !dragState.rafPendente) {
        dragState.ultimoX = x; dragState.ultimoY = y;
        dragState.rafPendente = requestAnimationFrame(applicaPosizioneTrascinamento);
    }
}

/**
 * Anima una carta che "vola" dalla sua posizione di partenza (di solito
 * la mano) fino al centro dello slot di destinazione sul Terreno, invece
 * del "pop" istantaneo di prima — usata sia per l'Evocazione/Set via
 * click (dopo aver deciso con il popover Attacco/Difesa o Attiva/Copri)
 * sia via drag & drop. Il chiamante esegue la vera logica di piazzamento
 * (che ricostruisce il DOM tramite updateUI()/clearSelection()) solo
 * DENTRO `onArrive`, così la carta vera compare esattamente quando il suo
 * "fantasma" animato arriva a destinazione — mai due carte visibili
 * insieme, né un vuoto scomodo tra le due.
 * Se `fromEl` non esiste più (es. layout cambiato nel frattempo), esegue
 * `onArrive` subito invece di bloccare il piazzamento per un dettaglio
 * puramente estetico.
 */
function flyCardToSlot(card, fromSource, toEl, onArrive, hideEl, isFaceDown = false, position = 'attack') {
    if (!fromSource || !toEl || typeof createCardElement !== 'function') { onArrive(); return; }
    // fromSource può essere l'elemento DOM della carta in mano (caso
    // normale: click/popover, nessun drag in corso) OPPURE un rettangolo
    // già pronto {left, top, width, height} — quello dove si trovava
    // davvero il fantasma del trascinamento al momento del rilascio (vedi
    // handleDragEnd). Nel secondo caso il volo riparte da lì invece che
    // "tornare indietro" fino alla mano e ripartire da capo, che sembrava
    // un doppio movimento innaturale dopo aver già trascinato la carta a
    // vista fin lì.
    const isElement = typeof fromSource.getBoundingClientRect === 'function';
    const fromRect = isElement ? fromSource.getBoundingClientRect() : fromSource;
    const toRect = toEl.getBoundingClientRect();
    if (fromRect.width === 0 || toRect.width === 0) { onArrive(); return; }

    // Nasconde l'originale finché il fantasma vola al posto suo, altrimenti
    // per ~0.3s si vedrebbero DUE copie della stessa carta insieme (una
    // ferma in mano, una che vola) invece della sensazione "si è mossa
    // lei stessa". L'elemento da nascondere è SEMPRE `hideEl` (la vera
    // carta in mano), se passato dal chiamante — NON per forza fromSource:
    // quando il piazzamento parte da un trascinamento, fromSource è un
    // rettangolo (non un elemento), e handleDragEnd ha già reso di nuovo
    // visibile la carta vera in mano PRIMA di arrivare qui (per non
    // lasciarla invisibile per sempre se il piazzamento viene annullato) —
    // un bug reale corretto qui: senza hideEl esplicito, un piazzamento
    // avviato via drag mostrava la carta ferma in mano E il fantasma che
    // vola insieme, per tutta la durata dell'animazione.
    const elToHide = hideEl || (isElement ? fromSource : null);
    if (elToHide) elToHide.style.visibility = 'hidden';

    // Il fantasma deve già avere l'aspetto FINALE (coperto e/o ruotato in
    // Difesa) fin dal primo fotogramma, non quello scoperto/verticale di
    // default: altrimenti si vedrebbe volare una carta scoperta in
    // Attacco che poi "scatta" coperta in Difesa solo all'arrivo — proprio
    // il difetto segnalato. createCardElement (card-renderer.js) applica
    // già la classe .defense-pos (rotate(90deg) via CSS, vedi
    // duelMonstersCore.html) quando position è 'defense'.
    const ghost = createCardElement(card, isFaceDown, position);
    ghost.classList.add('card-fly-ghost');
    // Il fantasma sta GIÀ nella casella d'arrivo (misure finali) e viene riportato visivamente sul punto di
    // partenza con un transform: l'animazione cambia solo il transform (compositor), non left/top/width/height
    // che a ogni fotogramma obbligavano il browser a ricalcolare il layout dell'intera pagina.
    // Le due liste di funzioni (translate, scale, rotate) hanno la stessa forma, così si interpolano una a una.
    const rotFinale = position === 'defense' ? 92 : 2;
    const rotIniziale = position === 'defense' ? 90 : 0;
    const dx = (fromRect.left + fromRect.width / 2) - (toRect.left + toRect.width / 2);
    const dy = (fromRect.top + fromRect.height / 2) - (toRect.top + toRect.height / 2);
    const sx = fromRect.width / toRect.width;
    const sy = fromRect.height / toRect.height;
    Object.assign(ghost.style, {
        position: 'fixed',
        left: `${toRect.left}px`,
        top: `${toRect.top}px`,
        width: `${toRect.width}px`,
        height: `${toRect.height}px`,
        margin: '0',
        zIndex: '9500',
        pointerEvents: 'none',
        willChange: 'transform',
        transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(${rotIniziale}deg)`,
        transition: 'transform 0.28s cubic-bezier(0.22, 0.61, 0.36, 1)'
    });
    document.body.appendChild(ghost);
    // Forza il reflow prima di cambiare il transform, altrimenti il browser lo applicherebbe insieme al
    // posizionamento iniziale, senza transizione (nessun "salto" da animare).
    void ghost.offsetWidth;
    // Il leggero "tilt" di volo è via style INLINE: sovrascrive la rotate(90deg) di .defense-pos, per questo
    // la rotazione è già dentro la lista del transform.
    ghost.style.transform = `translate(0px, 0px) scale(1, 1) rotate(${rotFinale}deg)`;

    let done = false;
    const finish = () => {
        if (done) return;
        done = true;
        ghost.remove();
        onArrive();
    };
    ghost.addEventListener('transitionend', finish, { once: true });
    // Rete di sicurezza se transitionend non scattasse mai (es. tab in
    // background che mette in pausa le animazioni): non deve bloccare il
    // piazzamento della carta per sempre.
    setTimeout(finish, 340);
}

function handleDragMove(event) {
    if (!dragState) return;
    if (dragState.type !== 'hand') return;
    if (!dragState.dragEnabled) return;

    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(dx, dy) > 8) {
        dragState.moved = true;
        // Il vero trascinamento inizia SOLO ora: crea il fantasma ruotato e
        // nasconde la carta vera in mano, così un semplice click (che non
        // supera mai questa soglia) non li mostra mai neanche per un
        // istante — vedi la nota in startHandCardDrag.
        if (dragState.sourceEl) {
            dragState.sourceEl.classList.add('dragging-source');
        }
        const preview = createDragPreview(dragState.card, event.clientX, event.clientY);
        dragState.previewEl = preview;
        // Il box info resta aperto dal tocco che ha preceduto il trascinamento e coprirebbe il campo.
        if (typeof updateCardInfoPanel === 'function') updateCardInfoPanel(null);
        // Stesse caselle verdi che si vedono toccando la carta: mostrano DOVE si può lasciarla.
        if (typeof highlightEmptySlots === 'function') highlightEmptySlots(dragState.card);
    }

    if (dragState.previewEl) {
        // Un solo aggiornamento per fotogramma: su telefono arrivano più pointermove per frame
        // (120-240 Hz) e applicarli tutti non aggiunge nulla, costa solo.
        dragState.ultimoX = event.clientX;
        dragState.ultimoY = event.clientY;
        if (!dragState.rafPendente) {
            dragState.rafPendente = requestAnimationFrame(applicaPosizioneTrascinamento);
        }
    }
}

function applicaPosizioneTrascinamento() {
    if (!dragState) return;
    dragState.rafPendente = 0;
    if (dragState.previewEl) posizionaAnteprimaTrascinamento(dragState.previewEl, dragState.ultimoX, dragState.ultimoY);
    // Un ridisegno del Terreno a metà trascinamento (ne avviene circa uno al secondo) ricrea le caselle
    // senza la classe: si rimette, solo se è sparita.
    if (!document.querySelector('.field-slot.action-highlight') && typeof highlightEmptySlots === 'function') {
        highlightEmptySlots(dragState.card);
    }
}

function handleDragEnd(event) {
    if (!dragState) return;
    const isHandDrag = dragState.type === 'hand';

    if (isHandDrag) {
        document.removeEventListener('pointermove', handleDragMove);
        document.removeEventListener('pointerup', handleDragEnd);
        document.removeEventListener('pointercancel', handleDragEnd);

        const moved = dragState.moved;
        if (!moved && event.type !== 'pointercancel') armHandCompatibilityClick(event);
        const dropTarget = document.elementFromPoint(event.clientX, event.clientY)?.closest('.field-slot');
        // Rettangolo del fantasma esattamente dov'era al momento del
        // rilascio, PRIMA di rimuoverlo: è il punto di partenza che
        // l'eventuale animazione di volo verso lo slot userà al posto
        // della mano (vedi flyCardToSlot) — così, se si è trascinata la
        // carta fin qui, il movimento prosegue da lì invece di "tornare
        // indietro" e ripartire dalla mano.
        // Il rilascio parte dall'ultimo punto REALE del dito, non da quello dell'ultimo fotogramma disegnato.
        if (dragState.rafPendente) { cancelAnimationFrame(dragState.rafPendente); dragState.rafPendente = 0; }
        if (dragState.previewEl && dragState.ultimoX !== undefined) {
            posizionaAnteprimaTrascinamento(dragState.previewEl, dragState.ultimoX, dragState.ultimoY);
        }
        const releaseRect = (moved && dragState.previewEl)
            ? dragState.previewEl.getBoundingClientRect()
            : null;
        if (dragState.previewEl) {
            dragState.previewEl.remove();
            // Fine del trascinamento: le caselle tornano normali (un piazzamento riuscito le ridisegna comunque).
            document.querySelectorAll('.field-slot.action-highlight, .field-slot.tribute-highlight')
                .forEach((el) => el.classList.remove('action-highlight', 'tribute-highlight'));
        }
        // La carta originale in mano è stata resa invisibile (.dragging-source,
        // vedi startHandCardDrag) per non vederne due copie mentre il
        // fantasma segue il puntatore. Il trascinamento/click è comunque
        // finito ORA: va resa visibile di nuovo qui, incondizionatamente —
        // altrimenti un ramo che non richiama subito updateUI() (es. il
        // popover "Attiva/Copri" di una Magia, se lo si annulla invece di
        // scegliere) la lascerebbe invisibile a tempo indeterminato, come se
        // la carta fosse sparita, finché un'azione qualunque successiva non
        // ricostruisce la mano da zero. Se il piazzamento vero riparte da
        // qui (flyCardToSlot), quella funzione la nasconde di nuovo da sola
        // con uno stile inline indipendente da questa classe.
        if (dragState.sourceEl) {
            dragState.sourceEl.classList.remove('dragging-source');
        }

        const touchLike = event.pointerType === 'touch' || event.pointerType === 'pen';
        if (moved && dragState.dragEnabled && dropTarget) {
            const owner = dropTarget.dataset.owner;
            const type = dropTarget.dataset.type;
            const index = parseInt(dropTarget.dataset.index, 10);
            const isFieldSpellCard = dragState.card.type === 'spell' && dragState.card.subtype === 'field';
            if (owner === 'player' && (
                (dragState.card.type === 'monster' && type === 'monster') ||
                (isFieldSpellCard && type === 'field-spell') ||
                (!isFieldSpellCard && (dragState.card.type === 'spell' || dragState.card.type === 'trap') && type === 'st')
            )) {
                placeDraggedCard(dragState.card, dragState.sourceIndex, owner, type, index, releaseRect);
            } else if (!touchLike) {
                handleCardClick(dragState.card, 'hand', dragState.sourceIndex, dragState.sourceOwner);
            }
        } else if (!moved || !touchLike) {
            // Su touch uno swipe/trascinamento non è un tap: non deve aprire
            // il box informazioni solo perché il gesto era iniziato sopra
            // una carta. Il tap vero (moved=false) continua ad aprirlo.
            handleCardClick(dragState.card, 'hand', dragState.sourceIndex, dragState.sourceOwner);
        }
    }

    dragState = null;
}

function placeDraggedCard(card, sourceIndex, owner, type, index, fromRect) {
    if (card.type === 'monster' && type === 'monster') {
        attemptMonsterSummon(card, sourceIndex, index, fromRect);
    } else if (card.type === 'spell' && card.subtype === 'field' && type === 'field-spell') {
        setFieldSpell(card, sourceIndex, fromRect);
    } else if ((card.type === 'spell' || card.type === 'trap') && type === 'st') {
        setSpellTrap(card, index, sourceIndex, fromRect);
    }
}

function handleSlotClick(owner, type, index) {
    if (gameState.pendingTributeSummon) return;
    if (gameState.pendingHandDiscard) return;
    // Scelta della VERA casella Mostro dopo un Sacrificio già completato
    // (vedi resolveTributeSummonPlacement più sotto) — solo quando più di
    // una casella libera è rimasta, altrimenti si procede da sola senza
    // chiedere nulla. Un click su una casella non ammissibile (occupata,
    // o non di tipo monster/player) viene semplicemente ignorato, il
    // popover resta aperto in attesa di un click valido.
    if (gameState.pendingTributePlacement) {
        if (owner === 'player' && type === 'monster' && !gameState.playerMonsterField[index]) {
            const { card, handIndex, fromRect } = gameState.pendingTributePlacement;
            gameState.pendingTributePlacement = null;
            setPlacementPrompt(false);
            document.querySelectorAll('.field-slot.action-highlight').forEach((el) => el.classList.remove('action-highlight'));
            openSummonModal(card, index, handIndex, fromRect, { dopoTributo: true });
        }
        return;
    }
    // Zona Magia Terreno: se non c'è una selezione di mano in corso, il
    // click serve solo ad attivare l'eventuale Magia Terreno già piazzata
    // (gestito da handleCardClick sopra tramite sourceType 'field-spell',
    // non da qui) — qui serve solo per il piazzamento di una NUOVA carta.
    updateCardInfoPanel(null, { sourceType: 'deck' });
    const { card: selectedCard, type: selectedType, index: selectedIndex } = gameState.selectedCard;
    if (!selectedCard || selectedType !== 'hand') return;
    const isMainPhase = gameState.phase === 'main1' || gameState.phase === 'main2';
    if (!isMainPhase || owner !== 'player') return;

    if (selectedCard.type === 'monster' && type === 'monster') {
        attemptMonsterSummon(selectedCard, selectedIndex, index);
    } else if (selectedCard.type === 'spell' && selectedCard.subtype === 'field' && type === 'field-spell') {
        setFieldSpell(selectedCard, selectedIndex);
    } else if ((selectedCard.type === 'spell' || selectedCard.type === 'trap') && selectedCard.subtype !== 'field' && type === 'st') {
        // Una Magia Terreno NON può finire in una delle 5 caselle comuni:
        // esclusa qui esplicitamente, va sempre e solo nella sua zona
        // dedicata (ramo qui sopra) — altrimenti questo controllo, basato
        // solo su card.type, l'avrebbe accettata anche su una casella 'st'.
        setSpellTrap(selectedCard, index, selectedIndex);
    }
}

/**
 * Punto d'ingresso unico per l'Evocazione di un mostro dalla mano, sia via
 * click sia via drag & drop. Decide se serve un'Evocazione Tributo in base
 * al Livello della carta e avvia il flusso corretto.
 */
function attemptMonsterSummon(card, handIndex, slotIndex, fromRect) {
    // Guardiano Falce del Terrore (id 282): "non puoi Evocare Normalmente/
    // Set altri mostri finché questa carta è in campo" —
    // gameState.otherMonsterSummonsBlockedFor, ricalcolato ad ogni render
    // (recomputeStaticEffects, duel-engine.js). Stesso identico flag già
    // consultato da ACTIONS.specialSummon per le Evocazioni Speciali.
    if (gameState.otherMonsterSummonsBlockedFor && gameState.otherMonsterSummonsBlockedFor.player && card.id !== 282) {
        addToLog(`🚫 Falce del Terrore Guardiana impedisce ogni altra Evocazione: non puoi Evocare ${card.name}.`);
        clearSelection();
        return;
    }
    if (!canUseNormalSummonQuota('player', card)) {
        addToLog('❌ Hai già effettuato un\'Evocazione Normale in questo turno.');
        clearSelection();
        return;
    }
    // Divieti di Evocazione Normale della carta stessa, fissi o condizionati
    // (DuelEngine.normalSummonBlockReason, punto unico condiviso con l'IA).
    const bloccoNormale = window.DuelEngine && DuelEngine.normalSummonBlockReason
        ? DuelEngine.normalSummonBlockReason('player', card) : null;
    if (bloccoNormale) {
        addToLog(`🚫 ${bloccoNormale}`);
        clearSelection();
        return;
    }
    // Le carte dell'Extra Deck (Fusione/Rituale, card.extraDeck === true —
    // es. Drago Bianco Definitivo id 29) non possono MAI essere Evocate
    // Normalmente/Tributo, solo Special Summonate con la procedura
    // giusta (Fusione/Rituale). In una partita vera non capiterebbe mai
    // (getRandomDrawPool le esclude già dal mazzo pescabile, vedi
    // js/data/cards-db.js), ma la Demo Duello Sandbox permette di
    // piazzare QUALSIASI carta in mano per testare scenari — senza
    // questo controllo il flusso di Evocazione Tributo generico le
    // accetterebbe comunque in base al solo Livello, un errore di
    // regole vero e proprio scoperto proprio grazie al sandbox.
    if (card.extraDeck) {
        addToLog(`❌ ${card.name} è una carta dell'Extra Deck: non può essere Evocata Normalmente, solo Special Summonata (es. Fusione).`);
        clearSelection();
        return;
    }
    // "Non può essere Evocata a meno che tu non controlli scoperta
    // [un'altra carta specifica]" (def.requiresFieldPresenceId — es.
    // Guardiano Grarl id 284, richiede Ascia di Gravità - Grarl id 277;
    // Guardiano Kay'est id 285, richiede Bastone del Silenzio - Kay'est
    // id 423). Stesso controllo lato IA in AI_SHARED.canNormalSummonNow
    // (js/ai/ai-shared.js), PRIMA di provare a Evocarla.
    const summonDef = window.DuelEngine && DuelEngine.getDefinition(card.id);
    // Procedure di Evocazione Normale non rappresentabili dal flusso
    // standard "scegli N mostri sul TUO Terreno" (es. Ra - Modalità
    // Sfera, che sacrifica tre mostri da uno dei due lati e compare su
    // quel lato). La definizione possiede l'intera procedura, mentre qui
    // restano i guardrail comuni già eseguiti sopra.
    if (summonDef && typeof summonDef.beginCustomNormalSummon === 'function') {
        summonDef.beginCustomNormalSummon(DuelEngine.makeContext('player', {
            card: card,
            handIndex: handIndex,
            fromRect: fromRect
        }));
        return;
    }
    if (summonDef && summonDef.requiresFieldPresenceId) {
        const requiredCard = cardDatabase.find((c) => c.id === summonDef.requiresFieldPresenceId);
        // La carta richiesta può essere sia un mostro (zona Mostro) sia
        // una Magia/Trappola (es. una Carta Equipaggiamento come Ascia di
        // Gravità - Grarl, id 277 — vive nella zona Magia/Trappola, non
        // in quella Mostro): controlla entrambe le zone.
        const hasRequired = gameState.playerMonsterField.some((s) => s && !s.isFaceDown && s.card.id === summonDef.requiresFieldPresenceId)
            || gameState.playerSTField.some((s) => s && !s.isFaceDown && s.card.id === summonDef.requiresFieldPresenceId);
        if (!hasRequired) {
            addToLog(`❌ ${card.name} non può essere Evocata: serve "${requiredCard ? requiredCard.name : '???'}" scoperta sul Terreno.`);
            clearSelection();
            return;
        }
    }

    // Gaia il Cavaliere Feroce Rapido (id 711): Evocabile senza Sacrificio
    // se è l'unica carta nella mano del giocatore — un'eccezione puntuale
    // al calcolo standard dei Tributi (getTributesRequired non ha
    // accesso al contesto della mano, quindi il controllo va qui).
    // Grande Pillola Evolutiva (id 810): "finché è scoperta sul Terreno,
    // puoi Evocare Normalmente mostri Tipo Dinosauro di Livello 5+ senza
    // Sacrificio" — stessa eccezione puntuale di Gaia qui sopra, verifica
    // dal vivo (non un flag salvato: getTributesRequired non ha accesso
    // al Terreno, quindi il controllo va qui, sempre accurato perché
    // controllato nel momento esatto del tentativo di Evocazione).
    const hasEvolutionPill = gameState.playerSTField.some((s) => s && !s.isFaceDown && s.card.id === 810);
    // Fabbrica dell'Ingranaggio Antico (id 841): marcatore per-carta
    // impostato all'attivazione (card-effects.js) — "se lo Evochi
    // Normalmente in QUESTO turno" (non finché una carta resta sul
    // Terreno, a differenza di Grande Pillola Evolutiva qui sopra).
    const noTributeException = (card.id === 711 && gameState.playerHand.length === 1)
        || (hasEvolutionPill && card.race === 'Dinosauro' && card.level >= 5)
        || (card._noTributeThisTurn === gameState.turn);
    const tributesNeeded = noTributeException ? 0 : getTributesRequired(card);

    if (tributesNeeded === 0) {
        // Questi due controlli valgono SOLO qui: senza Sacrificio, `slotIndex`
        // (la casella cliccata o su cui si è trascinato) è per forza anche la
        // casella FINALE, quindi deve essere libera e sbloccata già ORA. Con
        // un'Evocazione Tributo invece `slotIndex` è solo il punto d'ingresso
        // del flusso (vedi più sotto: startTributeSelection/
        // performTributeSacrifice scelgono la vera casella DOPO il
        // Sacrificio, quando si liberano posti) — bug reale corretto qui:
        // prima questi due controlli scattavano SEMPRE, PRIMA di sapere se
        // serviva un Sacrificio, impedendo di avviare un'Evocazione Tributo
        // trascinando/cliccando su una casella occupata (l'unico modo
        // possibile quando il Terreno Mostri è già pieno con tutte e 5 le
        // caselle occupate).
        if (gameState.playerMonsterField[slotIndex]) {
            addToLog('❌ Quella casella Mostro è già occupata: scegline una libera.');
            clearSelection();
            return;
        }
        // Zona Mostro bloccata (es. Buco Dimensionale, id 201: "finché il
        // mostro resta bandito, quella Zona Mostro non può essere usata") —
        // ACTIONS.findEmptyMonsterSlot già la evita nella selezione
        // AUTOMATICA di uno slot libero, ma un posizionamento MANUALE (click
        // o drag&drop diretto su quella casella) la raggiungeva comunque
        // bypassando quel controllo: bug reale, corretto qui.
        const lockedZones = gameState.lockedMonsterZonesFor && gameState.lockedMonsterZonesFor.player;
        if (lockedZones && lockedZones.has(slotIndex)) {
            addToLog('❌ Quella Zona Mostro è temporaneamente bloccata: scegline un\'altra.');
            clearSelection();
            return;
        }
        openSummonModal(card, slotIndex, handIndex, fromRect);
        return;
    }

    // Maschera della Restrizione (id 371, gameState.tributesBlocked):
    // nessun giocatore può sacrificare carte — un'Evocazione Tributo non
    // può nemmeno iniziare finché resta attiva.
    if (gameState.tributesBlocked) {
        addToLog(`❌ Maschera della Restrizione impedisce di sacrificare mostri: non puoi Evocare Tributo ${card.name}.`);
        clearSelection();
        return;
    }

    // Castello dell'Ingranaggio Antico (id 843, Magia Continua): "Se
    // Evochi Tributo un mostro 'Ingranaggio Antico' scoperto, puoi
    // sacrificare questa carta al posto dei mostri, se il numero dei suoi
    // Segnalini è pari o superiore ai Sacrifici richiesti." È
    // un'alternativa vera e propria (non un contributo cumulabile con i
    // mostri), quindi va offerta PRIMA del calcolo standard dei Tributi
    // qui sotto, con un modale Sì/Annulla (stesso
    // window.DuelEngineUI.openActivateModal già usato per le attivazioni
    // volontarie) invece di un terzo tipo di click aggiunto al flusso di
    // selezione esistente in handleTributeSelectClick.
    const gearCastleIndex = gameState.playerSTField.findIndex((s) => s && !s.isFaceDown && s.card.id === 843);
    if (gearCastleIndex !== -1 && card.name.includes('Ingranaggio Antico')) {
        const castleCard = gameState.playerSTField[gearCastleIndex].card;
        if ((castleCard.counters || 0) >= tributesNeeded) {
            window.DuelEngineUI.openActivateModal(castleCard, {
                title: "⚙️ Sacrificio alternativo",
                text: `Puoi sacrificare Castello-Ingranaggio Antico (${castleCard.counters} Segnalini) al posto dei mostri per Evocare Tributo ${card.name}. Vuoi farlo?`,
                onConfirm: () => performGearCastleTributeSacrifice(gearCastleIndex, card, handIndex, fromRect),
                onCancel: () => continueNormalTributeFlow(card, handIndex, tributesNeeded, fromRect)
            });
            return;
        }
    }
    continueNormalTributeFlow(card, handIndex, tributesNeeded, fromRect);
}

/**
 * Castello dell'Ingranaggio Antico (id 843) sacrificato al posto dei
 * mostri per l'Evocazione Tributo in corso — vedi il controllo in
 * attemptMonsterSummon qui sopra. Manda la carta al Cimitero come un
 * vero Sacrificio (non una distruzione: nessun hook onDestroy va
 * chiamato, coerente con notifySacrificedForTribute in duel-engine.js),
 * poi prosegue con l'apertura del modale di Evocazione come un normale
 * Tributo già completato.
 */
function performGearCastleTributeSacrifice(gearCastleIndex, card, handIndex, fromRect) {
    if (!gameState.playerSTField[gearCastleIndex]) return;
    // La mossa vera è il comando 'tributa' dalla zona Magia/Trappola (vedi
    // eseguiTributo in evocazioni.js): per tutto il resto un Sacrificio
    // dalla zona Magia/Trappola si comporta come uno dalla zona Mostro.
    Comandi.esegui('player', { tipo: 'tributa', zona: 'st', indici: [gearCastleIndex], perCarta: card.uid, attesaMs: 0 }, {
        // Questo Sacrificio alternativo non libera MAI una casella Mostro
        // (va a scapito di Castello dell'Ingranaggio Antico, sulla zona
        // Magia/Trappola): `slotIndex` (il punto d'ingresso originale del
        // flusso, vedi attemptMonsterSummon) potrebbe quindi essere ancora
        // occupato — usa lo stesso resolveTributeSummonPlacement del
        // Sacrificio normale invece di aprire il modale direttamente su di lui.
        dopo: () => resolveTributeSummonPlacement(card, handIndex, fromRect)
    });
}

/** Prosegue col calcolo standard dei Tributi (mostri sul Terreno) — estratto da attemptMonsterSummon per essere richiamabile anche dopo un "Annulla" sul modale del Castello dell'Ingranaggio Antico qui sopra. */
function continueNormalTributeFlow(card, handIndex, tributesNeeded, fromRect) {
    // Il valore MASSIMO possibile va calcolato pesato (getTributeValue), non
    // come semplice conteggio di mostri: con un solo Cavaliere Marino
    // Kaiser in campo (che vale 2 per un'Evocazione Tributo LUCE) questo
    // controllo bloccherebbe l'Evocazione anche se in realtà è già
    // legale — un vero mostro fisico basta comunque da solo.
    // Fuoco Fatuo (id 684): "non può essere sacrificata per un'Evocazione
    // Tributo" mentre scoperta — esclusa dal conteggio del valore
    // massimo disponibile, non solo dalla selezione manuale qui sotto,
    // altrimenti il pre-check potrebbe dare il via libera a
    // un'Evocazione Tributo che poi non si può mai completare.
    const maxAvailableValue = gameState.playerMonsterField.reduce((sum, slot) => {
        if (!slot) return sum;
        const slotDef = DuelEngine.getDefinition(slot.card.id);
        if (!slot.isFaceDown && slotDef && slotDef.cannotBeTributed) return sum;
        // Controllo Mentale/Mind Control (id 130): "non può essere
        // sacrificato" per la carta SPECIFICA presa sotto controllo (per
        // uid, non per definizione — a differenza di Fuoco Fatuo qui
        // sopra, che vale per OGNI copia di quella carta).
        if (gameState.cannotBeTributedUids && gameState.cannotBeTributedUids.has(slot.card.uid)) return sum;
        // Simorgh, Uccello della Divinità (id 772): "se Evocata Tributo,
        // tutti i Sacrifici devono essere mostri VENTO" — il proprietario
        // conosce sempre l'Attributo dei propri mostri, anche coperti.
        if (card.id === 772 && slot.card.attribute !== 'VENTO') return sum;
        return sum + getTributeValue(slot.card, card);
    }, 0);
    if (maxAvailableValue < tributesNeeded) {
        addToLog(`❌ ${card.name} (Lv. ${card.level}) richiede ${tributesNeeded} Tribut${tributesNeeded > 1 ? 'i' : 'o'}: non hai abbastanza mostri sul Terreno.`);
        clearSelection();
        return;
    }

    startTributeSelection(card, handIndex, tributesNeeded, fromRect);
}

/**
 * Promemoria "Seleziona N mostri da Sacrificare" — una banda fissa in
 * alto allo schermo, non solo una riga nel log (che di default è
 * chiuso ed è facile non notare). Resta visibile finché la selezione
 * non è completa o annullata.
 */
function showTributePrompt(cardName, tributesNeeded, selectedCount) {
    const el = document.getElementById('tributePrompt');
    if (!el) return;
    document.getElementById('tributePromptText').textContent =
        `Seleziona ${tributesNeeded} mostr${tributesNeeded > 1 ? 'i' : 'o'} da Sacrificare per evocare ${cardName}`;
    document.getElementById('tributePromptCount').textContent = `${selectedCount}/${tributesNeeded}`;
    el.classList.add('show');
    document.body.classList.add('tribute-mode');
    const cancel = document.getElementById('tributePromptCancel');
    if (cancel) cancel.onclick = cancelTributeSelection;
}

/**
 * Rinuncia a un'Evocazione Tributo ancora in selezione: la carta resta in
 * mano, nessun mostro viene sacrificato. Non si può più annullare quando il
 * sacrificio è partito (performTributeSacrifice azzera il promemoria).
 */
function cancelTributeSelection() {
    const pending = gameState.pendingTributeSummon;
    if (!pending || pending.sacrificing) return;
    addToLog(`↩️ Evocazione Tributo di ${pending.card.name} annullata.`);
    clearSelection();
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && gameState && gameState.pendingTributeSummon) cancelTributeSelection();
});

function updateTributePromptCount(selectedCount, tributesNeeded) {
    const el = document.getElementById('tributePromptCount');
    if (el) el.textContent = `${selectedCount}/${tributesNeeded}`;
}

function hideTributePrompt() {
    const el = document.getElementById('tributePrompt');
    if (el) el.classList.remove('show');
    document.body.classList.remove('tribute-mode');
}

/**
 * Avvia la modalità di selezione dei Tributi: evidenzia i mostri del
 * giocatore che possono essere sacrificati e attende i click.
 */
function startTributeSelection(card, handIndex, tributesNeeded, fromRect) {
    document.querySelectorAll('.action-highlight, .tribute-highlight, .selected').forEach(el => el.classList.remove('action-highlight', 'tribute-highlight', 'selected'));
    gameState.selectedCard = { type: null, card: null, index: -1 };
    gameState.pendingTributeSummon = { card, handIndex, tributesNeeded, selected: [], fromRect };
    addToLog(`🔺 ${card.name} richiede ${tributesNeeded} Tribut${tributesNeeded > 1 ? 'i' : 'o'}. Seleziona i mostri da Sacrificare sul tuo Terreno.`);
    showTributePrompt(card.name, tributesNeeded, 0);
    // Da qui in avanti i tocchi sul Terreno sono scelte di Sacrificio: il
    // dettaglio della carta lascerebbe meno spazio proprio ai candidati.
    updateCardInfoPanel(null);
    updateUI();
}

/**
 * Somma pesata dei mostri già selezionati per il Sacrificio: normalmente
 * ogni mostro vale 1, ma alcune carte (vedi getTributeValue/
 * DOUBLE_TRIBUTE_CARDS in js/data/cards-db.js, es. Cavaliere Marino
 * Kaiser) ne valgono 2 quando il mostro evocato ha l'Attributo giusto —
 * ricalcolata da zero ad ogni click invece di un contatore incrementale,
 * più semplice da tenere corretta togliendo/riaggiungendo selezioni.
 */
function tributeSelectionValue(pending) {
    return pending.selected.reduce((sum, idx) => {
        const slot = gameState.playerMonsterField[idx];
        return sum + (slot ? getTributeValue(slot.card, pending.card) : 1);
    }, 0);
}

function handleTributeSelectClick(index) {
    const pending = gameState.pendingTributeSummon;
    if (!pending) return;
    const slot = gameState.playerMonsterField[index];
    if (!slot) return;

    // Fuoco Fatuo (id 684): "non può essere sacrificata per
    // un'Evocazione Tributo" mentre scoperta sul Terreno.
    if (!slot.isFaceDown) {
        const slotDef = DuelEngine.getDefinition(slot.card.id);
        if (slotDef && slotDef.cannotBeTributed && !pending.selected.includes(index)) {
            addToLog(`🚫 ${slot.card.name} non può essere sacrificata per un'Evocazione Tributo.`);
            return;
        }
        // Controllo Mentale/Mind Control (id 130): stesso divieto, ma
        // per uid — vedi gameState.cannotBeTributedUids.
        if (gameState.cannotBeTributedUids && gameState.cannotBeTributedUids.has(slot.card.uid) && !pending.selected.includes(index)) {
            addToLog(`🚫 ${slot.card.name} non può essere sacrificata per un'Evocazione Tributo.`);
            return;
        }
    }
    // Simorgh, Uccello della Divinità (id 772): stesso vincolo Attributo
    // VENTO del controllo sul valore massimo disponibile qui sopra, ma
    // applicato mostro per mostro mentre il giocatore seleziona.
    if (pending.card.id === 772 && slot.card.attribute !== 'VENTO' && !pending.selected.includes(index)) {
        addToLog(`🚫 ${slot.card.name} non è un mostro VENTO: non può essere Sacrificato per Evocare Simorgh.`);
        return;
    }

    const el = document.querySelector(`#playerFieldBoard .field-slot[data-owner="player"][data-type="monster"][data-index="${index}"]`);

    if (pending.selected.includes(index)) {
        pending.selected = pending.selected.filter(i => i !== index);
        if (el) el.classList.remove('tribute-selected');
        updateTributePromptCount(tributeSelectionValue(pending), pending.tributesNeeded);
        return;
    }

    if (tributeSelectionValue(pending) >= pending.tributesNeeded) return;
    pending.selected.push(index);
    if (el) el.classList.add('tribute-selected');
    const newValue = tributeSelectionValue(pending);
    updateTributePromptCount(newValue, pending.tributesNeeded);

    if (newValue >= pending.tributesNeeded) {
        performTributeSacrifice();
    }
}

/**
 * Sceglie la VERA casella Mostro di destinazione dopo un Sacrificio già
 * completato (performTributeSacrifice/performGearCastleTributeSacrifice):
 * la casella cliccata/trascinata all'inizio del flusso (vedi
 * attemptMonsterSummon) era solo il punto d'ingresso, non necessariamente
 * quella finale — poteva essere una casella già occupata (l'unico modo di
 * avviare un'Evocazione Tributo quando il Terreno Mostri è pieno), libera
 * solo SE scelta come Sacrificio, non sempre. Se dopo il Sacrificio resta
 * UNA sola casella libera (il caso comune, un solo Tributo), la usa
 * direttamente senza chiedere nulla — nessuna vera scelta possibile. Se
 * ne restano di più (es. un'Evocazione a 2-3 Tributi che ne libera più di
 * una, o il Terreno non era del tutto pieno all'inizio), chiede al
 * giocatore di cliccarne una (gameState.pendingTributePlacement, gestito
 * in handleSlotClick).
 */
function resolveTributeSummonPlacement(card, handIndex, fromRect) {
    const locked = gameState.lockedMonsterZonesFor && gameState.lockedMonsterZonesFor.player;
    const eligible = [];
    gameState.playerMonsterField.forEach((slot, index) => {
        if (!slot && !(locked && locked.has(index))) eligible.push(index);
    });
    if (eligible.length === 0) {
        // Non dovrebbe mai succedere: un Sacrificio di monstri libera
        // sempre almeno una casella (quella del Gear Castle, id 843, non ne
        // libera nessuna in più, ma richiede comunque che ce ne fosse già
        // una libera per essere stato offerto — vedi attemptMonsterSummon).
        // Difensivo, non un vero caso di gioco.
        addToLog('❌ Nessuna casella Mostro disponibile per completare l\'Evocazione.');
        clearSelection();
        return;
    }
    if (eligible.length === 1) {
        openSummonModal(card, eligible[0], handIndex, fromRect, { dopoTributo: true });
        return;
    }
    gameState.pendingTributePlacement = { card, handIndex, fromRect };
    addToLog('🎯 Scegli in quale casella Mostro libera piazzare la carta Evocata.');
    setPlacementPrompt(true);
    updateUI();
    eligible.forEach((index) => {
        const el = document.querySelector(`.field-slot[data-owner="player"][data-type="monster"][data-index="${index}"]`);
        if (el) el.classList.add('action-highlight');
    });
}

function showHandDiscardPrompt(needed, selectedCount) {
    const el = document.getElementById('handDiscardPrompt');
    if (!el) return;
    document.getElementById('handDiscardPromptText').textContent =
        `Hai più di ${MAX_HAND_SIZE} carte in mano: scarta ${needed} cart${needed > 1 ? 'e' : 'a'}`;
    document.getElementById('handDiscardPromptCount').textContent = `${selectedCount}/${needed}`;
    el.classList.add('show');
    document.body.classList.add('discard-mode');
}

function updateHandDiscardPromptCount(selectedCount, needed) {
    const el = document.getElementById('handDiscardPromptCount');
    if (el) el.textContent = `${selectedCount}/${needed}`;
}

function hideHandDiscardPrompt() {
    const el = document.getElementById('handDiscardPrompt');
    if (el) el.classList.remove('show');
    document.body.classList.remove('discard-mode');
}

/**
 * Dopo il Sacrificio mantiene soltanto il velo e le caselle evidenziate:
 * nessuna banda testuale sopra il campo. La scelta resta obbligatoria.
 */
function setPlacementPrompt(visibile) {
    document.body.classList.toggle('placement-mode', visibile);
}

/**
 * Avvia la selezione obbligatoria: `onComplete` viene richiamata a scarto
 * finito, così enterEndPhase() (che l'ha messa in pausa proprio per questo)
 * sa quando può far ripartire il timer che cambia turno.
 */
function startHandDiscardSelection(excess, onComplete) {
    document.querySelectorAll('.action-highlight, .selected').forEach(el => el.classList.remove('action-highlight', 'selected'));
    gameState.pendingHandDiscard = { needed: excess, selected: [], onComplete };
    addToLog(`🗑️ Hai più di ${MAX_HAND_SIZE} carte in mano: scegli ${excess} cart${excess > 1 ? 'e' : 'a'} da scartare.`);
    showHandDiscardPrompt(excess, 0);
    updateCardInfoPanel(null);
    updateUI();
}

function handleHandDiscardSelectClick(handIndex) {
    const pending = gameState.pendingHandDiscard;
    if (!pending) return;
    const card = gameState.playerHand[handIndex];
    if (!card) return;

    const cardEl = document.querySelectorAll('#playerHand .card')[handIndex];

    if (pending.selected.includes(handIndex)) {
        pending.selected = pending.selected.filter((i) => i !== handIndex);
        if (cardEl) cardEl.classList.remove('selected');
        updateHandDiscardPromptCount(pending.selected.length, pending.needed);
        return;
    }

    if (pending.selected.length >= pending.needed) return;
    pending.selected.push(handIndex);
    if (cardEl) cardEl.classList.add('selected');
    updateHandDiscardPromptCount(pending.selected.length, pending.needed);

    if (pending.selected.length === pending.needed) {
        performHandDiscard();
    }
}

/**
 * Popover leggero e ancorato: alternativa non invasiva ai modali a
 * schermo intero. Nessuno scurimento della pagina — solo una piccola card
 * vicino alla carta/slot interessato — e si chiude cliccando ovunque fuori
 * da sé grazie a un click-catcher trasparente sotto di lei. Il chiamante
 * riempie `innerHTML` con i propri pulsanti e li collega DOPO la chiamata
 * (vedi openSummonModal/promptPositionChange sotto per un esempio),
 * richiamando closeQuickPopover() dentro ogni handler.
 */
function openQuickPopover(anchorEl, innerHTML, { onDismiss, dismissible = true, bare = false, extraClass = '' } = {}) {
    closeQuickPopover();

    const catcher = document.createElement('div');
    catcher.className = 'quick-popover-catcher';
    catcher.id = 'quickPopoverCatcher';

    const pop = document.createElement('div');
    // `bare` = solo i pulsanti che galleggiano sul campo, senza il
    // riquadro attorno: per una scelta fatta di sole AZIONI (posiziona in
    // Attacco/Difesa, attiva effetto, annulla) il pannello è puro
    // ingombro, e copre proprio il campo che serve guardare per
    // decidere. Il riquadro resta invece dove il popover porta
    // INFORMAZIONE che va letta su una superficie leggibile (es. la
    // domanda sui Life Point di Ra, che contiene dei numeri).
    //
    // È un'opzione esplicita e non dedotta dalla presenza di un titolo:
    // così ogni punto d'uso dichiara che tipo di scelta è, invece di
    // ritrovarsi il riquadro acceso o spento per effetto collaterale di
    // un cambio di testo.
    pop.className = bare ? 'quick-popover quick-popover--bare' : 'quick-popover';
    // Prima della misura qui sotto: una classe che cambia la larghezza
    // (es. quick-popover--options) deve contare nel calcolo della posizione.
    if (extraClass) pop.classList.add(extraClass);
    pop.id = 'quickPopover';
    pop.innerHTML = innerHTML;
    // Sostituisce ogni <span data-icon="..."> col vero SVG a tema (vedi
    // js/ui/icon-library.js) PRIMA della misura qui sotto, altrimenti
    // popRect userebbe ancora la dimensione del segnaposto vuoto.
    // Le icone Attacco/Difesa diventano scene WebGL animate (spade che si incrociano, scudo che si forma):
    // va PRIMA di hydrate, che altrimenti le sostituirebbe con l'SVG statico. Senza WebGL non fa nulla.
    if (window.IconePosizione) IconePosizione.monta(pop);
    if (window.Icons) Icons.hydrate(pop);

    document.body.appendChild(catcher);
    document.body.appendChild(pop);

    const anchorRect = anchorEl ? anchorEl.getBoundingClientRect() : {
        left: window.innerWidth / 2, right: window.innerWidth / 2,
        top: window.innerHeight / 2, bottom: window.innerHeight / 2, width: 0, height: 0
    };
    const popRect = pop.getBoundingClientRect();
    let left = anchorRect.left + anchorRect.width / 2 - popRect.width / 2;
    // Preferisce comparire SOPRA la carta; se non c'è spazio, sotto.
    let top = anchorRect.top - popRect.height - 10;
    if (top < 8) top = anchorRect.bottom + 10;
    left = Math.min(Math.max(left, 8), window.innerWidth - popRect.width - 8);
    top = Math.min(Math.max(top, 8), window.innerHeight - popRect.height - 8);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    // SOLO ORA il popover diventa visibile e la sua animazione d'ingresso
    // parte. Prima di questa riga era già nel documento — deve esserci,
    // altrimenti non si potrebbe misurarlo qui sopra — ma senza left/top
    // finiva nell'angolo in alto a sinistra: misurato, veniva inserito a
    // (29, 8) e spostato subito dopo a (334, 372), un salto di 669px. Il
    // browser poteva dipingere quel primo fotogramma, ed è lo sfarfallio
    // segnalato dall'utente all'apertura del popup.
    //
    // La classe fa due cose insieme (vedi il CSS): toglie
    // `visibility: hidden` e fa partire la keyframe d'ingresso, che così
    // parte dal posto GIUSTO invece di aver già consumato qualche
    // millisecondo altrove.
    pop.classList.add('is-placed');

    catcher.onclick = (event) => {
        // Click sintetico della WebView generato dal tap che ha appena
        // APERTO questo stesso popover: non e' un vero tap esterno.
        if (consumeHandCompatibilityClick(event)) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        // dismissible:false = scelta obbligatoria (es. Attacco/Difesa dopo
        // un Tributo già pagato — i mostri sacrificati sono già nel
        // Cimitero, non c'è modo di "annullare" a quel punto senza perderli
        // per niente): un click fuori dal popover viene ignorato invece di
        // chiuderlo, così l'unica via d'uscita resta un pulsante vero.
        if (!dismissible) return;
        closeQuickPopover();
        if (typeof onDismiss === 'function') onDismiss();
        // Il catcher copre anche la mano: il tap "su un'altra carta" arriva qui e non alla carta, che
        // restava senza risposta (serviva un secondo tap) mentre la prima rimaneva sollevata. Ora si
        // abbassa la prima e, se sotto il dito c'è una carta della mano, si tratta come un tap su di lei.
        // stopPropagation: il gestore globale dei click esterni azzererebbe subito la nuova selezione.
        event.stopPropagation();
        if (typeof clearHandCardSelection === 'function') clearHandCardSelection();
        const sotto = document.elementFromPoint(event.clientX, event.clientY);
        const cartaSotto = sotto && sotto.closest ? sotto.closest('#playerHand .card') : null;
        if (cartaSotto && !gameState.pendingTributeSummon && !gameState.pendingHandDiscard) {
            const indice = Array.prototype.indexOf.call(document.querySelectorAll('#playerHand .card'), cartaSotto);
            const carta = gameState.playerHand[indice];
            if (carta) handleCardClick(carta, 'hand', indice, 'player');
        } else if (typeof updateCardInfoPanel === 'function') {
            updateCardInfoPanel(null);
        }
    };

    return pop;
}

function closeQuickPopover() {
    const pop = document.getElementById('quickPopover');
    const catcher = document.getElementById('quickPopoverCatcher');
    if (pop) pop.remove();
    if (catcher) catcher.remove();
}

function openSummonModal(card, slotIndex, handIndex, fromRect, opzioni) {
    if (card.type === 'monster' && !canUseNormalSummonQuota('player', card)) {
        addToLog('❌ Hai già effettuato un\'Evocazione Normale in questo turno.');
        return;
    }

    // Dopo un Tributo non c'è nulla da scegliere sulla Posizione: un'Evocazione
    // Tributo si fa sempre scoperta in Attacco (regola in eseguiEvocazioneNormale,
    // evocazioni.js), a meno che la carta non dica il contrario (def.canTributeSet).
    // Chiedere "Attacco o Difesa" per poi ignorare la Difesa sarebbe una scelta finta.
    const defTributo = window.DuelEngine && DuelEngine.getDefinition(card.id);
    if (opzioni && opzioni.dopoTributo && !(defTributo && defTributo.canTributeSet)) {
        gameState.pendingSummon = { card, slotIndex, handIndex, fromRect };
        const slotElTributo = document.querySelector(`.field-slot[data-owner="player"][data-type="monster"][data-index="${slotIndex}"]`);
        maybeAskRaLpChoice(card, slotElTributo, () => {
            summonMonster(card, slotIndex, 'attack', handIndex, gameState.pendingSummon && gameState.pendingSummon.fromRect);
        });
        return;
    }

    gameState.pendingSummon = { card, slotIndex, handIndex, fromRect };
    const slotEl = document.querySelector(`.field-slot[data-owner="player"][data-type="monster"][data-index="${slotIndex}"]`);
    const tributesNeeded = getTributesRequired(card);
    // Se sono già stati pagati dei Tributi, i mostri sacrificati sono GIÀ
    // nel Cimitero (performTributeSacrifice() li rimuove dal Terreno prima
    // ancora di aprire questo popover) — a quel punto non esiste un
    // "annulla" che abbia senso: nelle regole vere, una volta pagato il
    // Tributo l'Evocazione va completata per forza. Per questo qui sotto
    // NON mostriamo il pulsante Annulla e il popover non si chiude
    // cliccando fuori (dismissible:false) — l'unica uscita resta scegliere
    // Attacco o Difesa. Un'Evocazione SENZA Tributo invece non ha ancora
    // pagato nulla: lì annullare resta sicuro, comportamento invariato.
    const canCancel = tributesNeeded === 0;

    // Lo slot scelto resta "in attesa" (bordo che pulsa) finché non si
    // sceglie Attacco/Difesa (o si annulla, se possibile) — si vede subito
    // QUALE slot sta aspettando una decisione, utile soprattutto se il
    // popover finisce vicino ad altri slot vuoti.
    if (slotEl) slotEl.classList.add('slot-pending-position');
    const clearPendingVisual = () => { if (slotEl) slotEl.classList.remove('slot-pending-position'); };

    const cancelSummon = () => {
        clearPendingVisual();
        gameState.pendingSummon = null;
        clearSelection();
    };

    // Solo i pulsanti, senza riquadro né domanda scritta: spada e scudo
    // dicono già cosa si sta scegliendo, e il pannello coprirebbe il campo
    // proprio mentre si decide dove piazzare il mostro.
    const pop = openQuickPopover(slotEl, `
        <div class="quick-popover-actions">
            <button type="button" class="quick-popover-btn attack icon-round" id="qpSummonAttack" title="Scoperta in Attacco"><span data-icon="attackPos"></span></button>
            <button type="button" class="quick-popover-btn defense icon-round" id="qpSummonDefense" title="Coperta in Difesa"><span data-icon="defensePos"></span></button>
            ${canCancel ? '<button type="button" class="quick-popover-btn cancel icon-round" id="qpSummonCancel" title="Annulla"><span data-ico="cancel">✖</span></button>' : ''}
        </div>
    `, { onDismiss: canCancel ? cancelSummon : undefined, dismissible: canCancel, bare: true });

    pop.querySelector('#qpSummonAttack').onclick = () => {
        closeQuickPopover();
        clearPendingVisual();
        maybeAskRaLpChoice(card, slotEl, () => {
            summonMonster(card, slotIndex, 'attack', handIndex, gameState.pendingSummon && gameState.pendingSummon.fromRect);
        });
    };
    pop.querySelector('#qpSummonDefense').onclick = () => {
        closeQuickPopover();
        clearPendingVisual();
        maybeAskRaLpChoice(card, slotEl, () => {
            summonMonster(card, slotIndex, 'defense', handIndex, gameState.pendingSummon && gameState.pendingSummon.fromRect);
        });
    };
    const cancelBtn = pop.querySelector('#qpSummonCancel');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            closeQuickPopover();
            cancelSummon();
        };
    }
}

/**
 * Il Drago Alato di Ra (id 472): "Quando questa carta viene Evocata
 * Normalmente: PUOI pagare Life Points fino a restarne con 100; questa
 * carta guadagna ATK/DEF pari all'ammontare pagato" — un "puoi", non un
 * pagamento automatico: scendere a 100 LP è un rischio reale (qualunque
 * danno successivo può chiudere il duello), quindi qui il giocatore
 * sceglie davvero con un secondo popover leggero, subito dopo aver
 * scelto Attacco/Difesa. La scelta (card._raPayLp, true/false) arriva
 * fino a CardEffects.register(472).onSummon (card-effects.js), che la
 * legge invece di pagare sempre in automatico. Nessun effetto per
 * qualunque ALTRA carta: solo Ra fa questa domanda, e solo se i Life
 * Points sono sopra 100 (altrimenti l'effetto non è comunque disponibile,
 * stesso controllo già presente in onSummon).
 */
function maybeAskRaLpChoice(card, slotEl, proceed) {
    if (card.id !== 472 || gameState.playerLP <= 100) { proceed(); return; }
    const wouldGain = gameState.playerLP - 100;
    const pop = openQuickPopover(slotEl, `
        <div class="quick-popover-title">Ra: pagare LP fino a 100 per +${wouldGain} ATK/DEF?</div>
        <div class="quick-popover-actions">
            <button type="button" class="quick-popover-btn confirm icon-round" id="qpRaPayYes" title="Sì, paga i Life Points"><span data-ico="ok">✔</span></button>
            <button type="button" class="quick-popover-btn cancel icon-round" id="qpRaPayNo" title="No, resta 0/0"><span data-ico="cancel">✖</span></button>
        </div>
    `, { dismissible: false });
    pop.querySelector('#qpRaPayYes').onclick = () => {
        closeQuickPopover();
        card._raPayLp = true;
        proceed();
    };
    pop.querySelector('#qpRaPayNo').onclick = () => {
        closeQuickPopover();
        card._raPayLp = false;
        proceed();
    };
}

// Ascoltatore di 'selezione-azzerata': la metà "a schermo" di
// clearSelection (js/engine/canale-partita.js, che azzera la selezione in
// gameState e poi ridisegna).
function chiudiSelezioneASchermo() {
    setPlacementPrompt(false);
    hideTributePrompt();
    document.querySelectorAll('.action-highlight, .selected, .tribute-highlight, .tribute-selected').forEach(el => el.classList.remove('action-highlight', 'selected', 'tribute-highlight', 'tribute-selected'));
    updateCardInfoPanel(null);
}

/**
 * Selezione leggera della carta in mano, condivisa da mouse e touch.
 * Non ridisegna la UI: il popover deve poter restare ancorato allo stesso
 * nodo DOM appena toccato, senza essere rimosso sotto al dito.
 */
function selectHandCardForInspection(card, index, owner = 'player') {
    gameState.selectedCard = { type: 'hand', card, index, owner };
    document.querySelectorAll('#playerHand .card.selected').forEach((el) => el.classList.remove('selected'));
    const cardEl = document.querySelectorAll('#playerHand .card')[index];
    if (cardEl) cardEl.classList.add('selected');
}

/**
 * Rimette in linea una carta della mano senza azzerare selezioni bloccanti
 * (Tributi/scarto) e senza un updateUI completo. Usata dal click esterno.
 */
function clearHandCardSelection() {
    // La classe si toglie SEMPRE: un handler può aver già azzerato selectedCard lasciando la carta sollevata.
    document.querySelectorAll('#playerHand .card.selected').forEach((el) => el.classList.remove('selected'));
    if (!gameState.selectedCard || gameState.selectedCard.type !== 'hand') return;
    gameState.selectedCard = { type: null, card: null, index: -1 };
    document.querySelectorAll('.field-slot.action-highlight, .field-slot.tribute-highlight')
        .forEach((el) => el.classList.remove('action-highlight', 'tribute-highlight'));
}

/**
 * Evidenzia le caselle libere che possono ricevere la carta selezionata.
 * Una Magia Terreno (card.subtype === 'field') ha una zona tutta sua,
 * separata dalle 5 caselle Magia/Trappola comuni — vedi setFieldSpell più
 * sotto — quindi evidenzia SOLO quella (anche se già occupata: attivarne
 * una nuova sostituisce quella vecchia, come da regola vera), non le 5
 * caselle st.
 */
function highlightEmptySlots(card) {
    if (card.type === 'spell' && card.subtype === 'field') {
        const el = document.querySelector('.field-slot[data-owner="player"][data-type="field-spell"]');
        if (el) el.classList.add('action-highlight');
        return;
    }
    const targetField = card.type === 'monster' ? gameState.playerMonsterField : gameState.playerSTField;
    const targetType = card.type === 'monster' ? 'monster' : 'st';
    // Se questa carta richiede Sacrificio, anche le caselle Mostro OCCUPATE
    // sono un bersaglio di click/drag valido (avviano il flusso di
    // Sacrificio, vedi attemptMonsterSummon/handleCardClick) — evidenziate
    // con lo stesso stile .tribute-highlight già usato durante la
    // selezione vera e propria dei Sacrifici, per segnalare a colpo
    // d'occhio che sono cliccabili anche se piene, non solo le vuote.
    const tributesNeeded = card.type === 'monster' ? getTributesRequired(card) : 0;
    targetField.forEach((slot, index) => {
        // Onda Sismica (id 818): una Zona bloccata non va evidenziata come disponibile.
        if (targetType === 'st' && window.DuelEngine && DuelEngine.isSTZoneLocked('player', index)) return;
        const el = document.querySelector(`.field-slot[data-owner="player"][data-type="${targetType}"][data-index="${index}"]`);
        if (!el) return;
        if (!slot) {
            el.classList.add('action-highlight');
        } else if (tributesNeeded > 0) {
            el.classList.add('tribute-highlight');
        }
    });
}

/**
 * Chiede conferma, con lo stesso popover leggero non invasivo usato per
 * l'Evocazione, prima di agire su un proprio mostro già in campo: cambiare
 * Posizione e/o attivare il suo effetto Ignition (es. Soldato Cannone),
 * se ne ha uno e non è già stato usato in questo turno — vedi il ramo
 * zone === 'monster' di DuelEngine.canActivate/activateCard in
 * duel-engine.js. Mostra solo i pulsanti davvero disponibili in questo
 * momento; se non ce n'è nessuno, non apre nulla (click a vuoto).
 */
function promptMonsterFieldAction(slotIndex) {
    const monsterSlot = gameState.playerMonsterField[slotIndex];
    if (!monsterSlot) return;
    const canChangePos = monsterSlot.canChangePosition;
    const canActivateEffect = window.DuelEngine && DuelEngine.canActivate('player', 'monster', slotIndex);
    if (!canChangePos && !canActivateEffect) return;

    const goingToDefense = monsterSlot.position === 'attack';
    const slotEl = document.querySelector(`.field-slot[data-owner="player"][data-type="monster"][data-index="${slotIndex}"]`);

    // Nessun box con la domanda: solo pulsanti tondi — l'icona della nuova
    // posizione (spada/scudo a tema, vedi js/ui/icon-library.js) e/o ✨ per
    // l'effetto, più l'annulla — si capisce già dall'icona cosa si sta per
    // fare, senza bisogno di ripeterlo a parole.
    const buttons = [];
    if (canChangePos) {
        buttons.push(`<button type="button" class="quick-popover-btn ${goingToDefense ? 'defense' : 'attack'} icon-round" id="qpPosConfirm" title="Cambia Posizione"><span data-icon="${goingToDefense ? 'defensePos' : 'attackPos'}"></span></button>`);
    }
    if (canActivateEffect) {
        buttons.push(`<button type="button" class="quick-popover-btn confirm icon-round" id="qpMonsterActivate" title="Attiva Effetto"><span data-ico="spark">✨</span></button>`);
    }
    buttons.push(`<button type="button" class="quick-popover-btn cancel icon-round" id="qpPosCancel" title="Annulla"><span data-ico="cancel">✖</span></button>`);

    const pop = openQuickPopover(slotEl, `
        <div class="quick-popover-actions">${buttons.join('')}</div>
    `, { bare: true });

    if (canChangePos) {
        pop.querySelector('#qpPosConfirm').onclick = () => {
            closeQuickPopover();
            changeMonsterPosition(slotIndex);
        };
    }
    if (canActivateEffect) {
        pop.querySelector('#qpMonsterActivate').onclick = () => {
            closeQuickPopover();
            Comandi.esegui('player', { tipo: 'attiva', zona: 'monster', indice: slotIndex });
        };
    }
    pop.querySelector('#qpPosCancel').onclick = () => closeQuickPopover();
}

/**
 * Popover mostrato al click su una Magia in mano il cui effetto si può
 * attivare SUBITO (vedi handleCardClick sopra, che ha già verificato
 * DuelEngine.canActivate('player','hand',...)): un solo pulsante "Attiva",
 * che risolve l'effetto subito (la carta va al Cimitero — o resta scoperta
 * sul Terreno se è una Continua, vedi js/engine/duel-engine.js). Per
 * piazzarla Coperta invece di attivarla si trascina la carta su una
 * casella Magia/Trappola libera (drag & drop, vedi placeDraggedCard): un
 * percorso indipendente da questo popover, niente pulsante "Copri" qui.
 */
function promptHandSpellActivation(card, handIndex) {
    const anchorEl = document.querySelectorAll('#playerHand .card')[handIndex] || null;

    // Niente riquadro né nome della carta: la carta è quella che si è
    // appena cliccata, ed è lì sotto — ripeterne il nome non aggiunge
    // nulla e obbliga a disegnare un pannello sopra il campo.
    const pop = openQuickPopover(anchorEl, `
        <div class="quick-popover-actions">
            <button type="button" class="quick-popover-btn attack icon-round" id="qpSpellActivate" title="Attiva subito"><span data-ico="spark">✨</span></button>
            <button type="button" class="quick-popover-btn cancel icon-round" id="qpSpellCancel" title="Annulla"><span data-ico="cancel">✖</span></button>
        </div>
    `, { bare: true });

    pop.querySelector('#qpSpellActivate').onclick = () => {
        closeQuickPopover();
        Comandi.esegui('player', { tipo: 'attiva', zona: 'hand', indice: handIndex, carta: gameState.playerHand[handIndex] && gameState.playerHand[handIndex].uid });
    };
    pop.querySelector('#qpSpellCancel').onclick = () => closeQuickPopover();
}

/**
 * Come promptHandSpellActivation qui sopra, ma per un MOSTRO in mano il
 * cui effetto si attiva DALLA MANO senza essere uno Special Summon (es.
 * Thunder Dragon, id 537: scartalo per cercare fino a 2 copie nel Deck) —
 * offre la scelta tra attivare quell'effetto (la carta si scarta da sola,
 * gestito da activateCard() in duel-engine.js) e selezionarla per
 * un'Evocazione normale come qualunque altro mostro.
 */
function promptHandMonsterActivation(card, handIndex) {
    const anchorEl = document.querySelectorAll('#playerHand .card')[handIndex] || null;

    const pop = openQuickPopover(anchorEl, `
        <div class="quick-popover-actions">
            <button type="button" class="quick-popover-btn attack icon-round" id="qpMonsterActivateEffect" title="Attiva l'effetto (scarta questa carta)"><span data-ico="spark">✨</span></button>
            <button type="button" class="quick-popover-btn defense icon-round" id="qpMonsterSelectNormal" title="Seleziona per Evocarla"><span data-ico="card">🂠</span></button>
            <button type="button" class="quick-popover-btn cancel icon-round" id="qpMonsterActivateCancel" title="Annulla"><span data-ico="cancel">✖</span></button>
        </div>
    `, { bare: true });

    pop.querySelector('#qpMonsterActivateEffect').onclick = () => {
        closeQuickPopover();
        Comandi.esegui('player', { tipo: 'attiva', zona: 'hand', indice: handIndex, carta: gameState.playerHand[handIndex] && gameState.playerHand[handIndex].uid });
    };
    pop.querySelector('#qpMonsterSelectNormal').onclick = () => {
        closeQuickPopover();
        gameState.selectedCard = { type: 'hand', card: card, index: handIndex, owner: 'player' };
        updateCardInfoPanel(card, { sourceType: 'hand', sourceOwner: 'player', isFaceDown: false });
        updateUI();
        highlightEmptySlots(card);
    };
    pop.querySelector('#qpMonsterActivateCancel').onclick = () => closeQuickPopover();
}

/**
 * Generalizza lo schema nato per Teschio Evocato Toon (id 486,
 * getSpecialSummonSacrificeCandidates/pendingSpecialSummonSacrificeUid,
 * lasciato INVARIATO più sotto per non rischiare di romperlo) a un
 * costo "bandisci N mostri che soddisfano certi requisiti dal Cimitero"
 * per Special Summonarsi dalla mano — es. Inferno (id 677, 1 FUOCO),
 * Fenrir (id 698, 2 ACQUA), Stregone del Caos (id 740, 1 LUCE + 1
 * OSCURITÀ, due requisiti DIVERSI). PERCHÉ questo vive nel click
 * handler e non dentro paySpecialSummonCost stessa (dove sarebbe più
 * naturale aprire il picker): DuelEngine.trySpecialSummonFromHand
 * (duel-engine.js) chiama paySpecialSummonCost SINCRONAMENTE e usa il
 * suo valore di ritorno per decidere SUBITO se procedere con la vera
 * Special Summon — un picker (sempre asincrono, l'utente clicca quando
 * vuole) dentro paySpecialSummonCost tornerebbe "vero" PRIMA che la
 * scelta sia stata fatta, sommonando la carta subito e pagando il costo
 * in un secondo momento (o mai). Soluzione: la scelta si fa QUI, PRIMA
 * di chiamare trySpecialSummonFromHand, esattamente come già faceva id
 * 486 — la carta scelta finisce in gameState.pendingSpecialSummonBanishUids,
 * letta e consumata da paySpecialSummonCost (tramite il nuovo helper
 * condiviso resolveSpecialSummonBanishCost in card-effects.js), che
 * resta quindi sincrona come ogni altra. `filters` è un array di
 * predicati, uno per ogni carta richiesta (ripetuto per un conteggio
 * omogeneo, es. [isAcqua, isAcqua] per Fenrir; predicati diversi per un
 * costo eterogeneo, es. [isLuce, isOscurità] per lo Stregone del Caos).
 * Se il Cimitero non offre più candidati del minimo richiesto non c'è
 * nessuna vera scelta da fare: si torna false e si lascia fare al
 * fallback deterministico dentro resolveSpecialSummonBanishCost stessa,
 * nessun picker inutile per un'unica combinazione possibile.
 */
function offerSpecialSummonBanishChoice(card, handIndex, filters) {
    const ctx = DuelEngine.makeContext('player', { card: card, handIndex: handIndex });
    const grave = ctx.graveyard(ctx.owner);
    const totalMatching = filters.reduce((sum, f) => sum + grave.filter(f).length, 0);
    if (totalMatching <= filters.length) return false;
    const chosenUids = [];
    const pickStep = (stepIndex) => {
        if (stepIndex >= filters.length) {
            gameState.pendingSpecialSummonBanishUids = chosenUids;
            // Niente finishSpecialSummonFromHand qui: queste carte hanno
            // GIÀ un costo a scelta multi-passo (banisci N carte dal
            // Cimitero) — impilarci sopra ANCHE una scelta di Posizione
            // asincrona romperebbe l'assunzione "il costo appena scelto fa
            // procedere SUBITO la Special Summon" su cui contano diverse
            // carte/test già verificati (es. Inferno id 677, Fenrir id
            // 698). Il loro testo reale specifica comunque quasi sempre la
            // Posizione fissa (di solito Attacco) per questo tipo di
            // Summon "di rivincita" — resta il comportamento invariato.
            Comandi.specialeDaManoDellaPersona(handIndex);
            updateUI();
            return;
        }
        const pool = grave.filter((c) => filters[stepIndex](c) && !chosenUids.includes(c.uid));
        if (pool.length <= 1) {
            // Nessuna scelta reale per questo requisito (0 o 1 solo
            // candidato rimasto): salta direttamente al requisito
            // successivo senza aprire un picker con un'unica opzione.
            if (pool.length === 1) chosenUids.push(pool[0].uid);
            pickStep(stepIndex + 1);
            return;
        }
        window.DuelEngineUI.openCardListPicker(pool, {
            title: `✨ ${card.name}`,
            text: filters.length > 1
                ? `Scegli quale mostro bandire dal Cimitero (${stepIndex + 1}/${filters.length}).`
                : 'Scegli quale mostro bandire dal Cimitero.',
            onSelect: (chosenCard) => {
                chosenUids.push(chosenCard.uid);
                pickStep(stepIndex + 1);
            }
        });
    };
    pickStep(0);
    return true;
}

/**
 * Come offerSpecialSummonBanishChoice qui sopra, ma per un costo "tributa
 * N mostri sul proprio Terreno" invece del Cimitero — es. Drago Toon
 * Occhi Blu (id 123) e Manga Ryu-Ran (id 606), entrambi "tributa 2 mostri
 * QUALSIASI" (filtro sempre vero ripetuto 2 volte). Stesso identico
 * principio/stessi motivi di offerSpecialSummonBanishChoice: la scelta
 * va fatta PRIMA di trySpecialSummonFromHand, mai dentro
 * paySpecialSummonCost. Per un costo "tributa 1 mostro con un nome
 * specifico" (es. Exxod id 753, "Sfinge") si riusa invece il MECCANISMO
 * PREESISTENTE getSpecialSummonSacrificeCandidates/
 * pendingSpecialSummonSacrificeUid qui sotto (già supporta una scelta
 * singola sul Terreno) — questo helper serve solo per un conteggio > 1.
 */
function offerSpecialSummonTributeChoice(card, handIndex, filters) {
    const ctx = DuelEngine.makeContext('player', { card: card, handIndex: handIndex });
    const def = DuelEngine.getDefinition(card.id);
    const tributeOwner = def && def.specialSummonTributeFromOpponent ? ctx.opponent : ctx.owner;
    const field = ctx.field(tributeOwner);
    const totalMatching = filters.reduce((sum, f) => sum + field.filter((s) => s && f(s.card)).length, 0);
    if (totalMatching <= filters.length) return false;
    const chosenUids = [];
    const pickStep = (stepIndex) => {
        if (stepIndex >= filters.length) {
            gameState.pendingSpecialSummonTributeUids = chosenUids;
            // Stesso motivo di offerSpecialSummonBanishChoice qui sopra:
            // niente scelta di Posizione impilata su un costo già a scelta
            // multipla già verificato/testato con 'attack' fisso.
            Comandi.specialeDaManoDellaPersona(handIndex);
            updateUI();
            return;
        }
        const pool = field.filter((s) => s && filters[stepIndex](s.card) && !chosenUids.includes(s.card.uid)).map((s) => s.card);
        if (pool.length <= 1) {
            if (pool.length === 1) chosenUids.push(pool[0].uid);
            pickStep(stepIndex + 1);
            return;
        }
        window.DuelEngineUI.openCardListPicker(pool, {
            title: `✨ ${card.name}`,
            text: filters.length > 1
                ? `Scegli quale mostro sacrificare (${stepIndex + 1}/${filters.length}).`
                : 'Scegli quale mostro sacrificare.',
            onSelect: (chosenCard) => {
                chosenUids.push(chosenCard.uid);
                pickStep(stepIndex + 1);
            }
        });
    };
    pickStep(0);
    return true;
}

/**
 * Costo di Special Summon composto da mostri presi sia dalla mano sia dal
 * Terreno, con una soglia complessiva invece di un numero fisso (il primo
 * caso e' Soldato dell'Oscuro Desiderio Toon: Livelli totali almeno 8).
 * La scelta viene conclusa prima del comando, cosi' viaggia nel Multiplayer
 * come gli altri costi e paySpecialSummonCost resta sincrono.
 */
function offerSpecialSummonMixedTributeChoice(card, handIndex, candidates, minimumLevel) {
    if (!Array.isArray(candidates) || candidates.length === 0) return false;
    const ctx = DuelEngine.makeContext('player', { card: card, handIndex: handIndex });
    const def = DuelEngine.getDefinition(card.id);
    const total = candidates.reduce((sum, entry) => sum + (entry.card.level || 0), 0);
    if (total < minimumLevel) return false;

    const chosen = [];
    const selectionIsValid = () => {
        const levels = chosen.reduce((sum, entry) => sum + (entry.card.level || 0), 0);
        if (levels < minimumLevel) return false;
        return !def || typeof def.isSpecialSummonMixedTributeSelectionValid !== 'function'
            || def.isSpecialSummonMixedTributeSelectionValid(ctx, chosen.slice());
    };
    const pickNext = () => {
        if (selectionIsValid()) {
            gameState.pendingSpecialSummonMixedTributeUids = chosen.map((entry) => entry.card.uid);
            finishSpecialSummonFromHand(card, handIndex);
            return;
        }
        const used = new Set(chosen.map((entry) => entry.card.uid));
        const remaining = candidates.filter((entry) => !used.has(entry.card.uid));
        if (remaining.length === 0) return;
        window.DuelEngineUI.openCardListPicker(remaining.map((entry) => entry.card), {
            title: `✨ ${card.name}`,
            text: `Scegli i mostri da offrire come Tributo (Livelli: ${chosen.reduce((sum, entry) => sum + (entry.card.level || 0), 0)}/${minimumLevel}).`,
            onSelect: (chosenCard) => {
                const entry = remaining.find((candidate) => candidate.card.uid === chosenCard.uid);
                if (entry) chosen.push(entry);
                pickNext();
            }
        });
    };
    pickNext();
    return true;
}

/**
 * Punto unico da cui OGNI ramo di promptHandMonsterSpecialSummon qui sotto
 * conclude una Special Summon dalla mano — chiede la Posizione (Attacco/
 * Difesa) PRIMA di chiamare DuelEngine.trySpecialSummonFromHand, per lo
 * stesso motivo architetturale di offerSpecialSummonBanishChoice/
 * offerSpecialSummonTributeChoice qui sopra: quella funzione consuma
 * SINCRONAMENTE gameState.pendingSpecialSummonPosition per decidere subito
 * la Posizione — un picker al suo interno tornerebbe "vero" prima ancora
 * che la scelta sia stata fatta. Per regolamento reale, quando un effetto
 * Special Summona un mostro senza specificarne la Posizione, è chi
 * controlla quella Summon a scegliere — bug reale segnalato dall'utente
 * ("alcune carte che permettono di poter portare in campo i mostri non
 * permettono di scegliere se posizionarli in attacco o difesa"): prima
 * questo motore forzava sempre 'attack' per OGNI carta che si auto-Special-
 * Summona dalla mano. `def.specialSummonFixedPosition` ('attack'/'defense')
 * è l'eccezione dichiarativa per le poche carte il cui testo reale fissa
 * la Posizione (es. Gilasaurus id 266: sempre scoperto in Attacco) — senza
 * quel flag si chiede sempre, il default corretto per regolamento.
 */
function finishSpecialSummonFromHand(card, handIndex) {
    const def = DuelEngine.getDefinition(card.id);
    const finish = (position) => {
        gameState.pendingSpecialSummonPosition = position;
        Comandi.specialeDaManoDellaPersona(handIndex);
        updateUI();
    };
    if (def && def.specialSummonFixedPosition) {
        finish(def.specialSummonFixedPosition);
        return;
    }
    if (!window.DuelEngineUI) { finish('attack'); return; }
    const anchorEl = document.querySelectorAll('#playerHand .card')[handIndex] || null;
    window.DuelEngineUI.openPositionPicker(anchorEl, {
        onSelect: finish
    });
}

/**
 * Come promptHandSpellActivation qui sopra, ma per un MOSTRO in mano che
 * può essere Special Summonato tramite il proprio effetto (es. Gilasaurus):
 * offre la scelta tra Evocazione Normale (passa alla selezione classica,
 * che poi chiede Attacco/Difesa) e Special Summon immediato.
 */
function promptHandMonsterSpecialSummon(card, handIndex) {
    const anchorEl = document.querySelectorAll('#playerHand .card')[handIndex] || null;
    // Alcune carte (es. i mostri Toon) non sono MAI Evocabili Normalmente
    // nella realtà: per loro il popover offre solo Special Summon.
    const def = DuelEngine.getDefinition(card.id);
    const canNormalSummon = !DuelEngine.normalSummonBlockReason('player', card);

    const pop = openQuickPopover(anchorEl, `
        <div class="quick-popover-actions">
            <button type="button" class="quick-popover-btn confirm icon-round" id="qpMonsterSpecialSummon" title="Special Summon"><span data-ico="spark">✨</span></button>
            ${canNormalSummon ? '<button type="button" class="quick-popover-btn attack icon-round" id="qpMonsterNormalSummon" title="Evoca Normalmente"><span data-ico="summon">🔺</span></button>' : ''}
            <button type="button" class="quick-popover-btn cancel icon-round" id="qpMonsterSummonCancel" title="Annulla"><span data-ico="cancel">✖</span></button>
        </div>
    `, { bare: true });

    pop.querySelector('#qpMonsterSpecialSummon').onclick = () => {
        closeQuickPopover();
        // Alcune carte (es. Teschio Evocato Toon id 486) chiedono di
        // scegliere QUALE mostro sacrificare come costo del proprio
        // Special Summon: def.getSpecialSummonSacrificeCandidates(ctx),
        // hook generico opzionale, letto SOLO qui — trySpecialSummonFromHand
        // (duel-engine.js) resta sincrona, invariata per tutte le altre
        // carte con paySpecialSummonCost. La scelta fatta nel picker viene
        // depositata in gameState.pendingSpecialSummonSacrificeUid, letta e
        // consumata dal paySpecialSummonCost della carta stessa.
        if (typeof def.getSpecialSummonSacrificeCandidates === 'function' && window.DuelEngineUI) {
            const ctx = DuelEngine.makeContext('player', { card: card, handIndex: handIndex });
            const candidates = def.getSpecialSummonSacrificeCandidates(ctx);
            if (candidates.length > 1) {
                window.DuelEngineUI.openCardListPicker(candidates.map((c) => c.card), {
                    title: `✨ ${card.name}`,
                    text: 'Scegli quale mostro sacrificare per lo Special Summon.',
                    onSelect: (chosenCard) => {
                        gameState.pendingSpecialSummonSacrificeUid = chosenCard.uid;
                        // Stesso motivo di offerSpecialSummonBanishChoice
                        // qui sopra: niente scelta di Posizione impilata su
                        // un costo già a scelta (quale mostro sacrificare).
                        Comandi.specialeDaManoDellaPersona(handIndex);
                        updateUI();
                    }
                });
                return;
            }
        }
        // Vedi offerSpecialSummonBanishChoice/offerSpecialSummonTributeChoice
        // qui sopra: def.getSpecialSummonBanishFilters/getSpecialSummonTributeFilters
        // sono i nuovi hook generici opzionali per un costo con SCELTA VERA
        // sul Cimitero/Terreno (es. Inferno id 677, Fenrir id 698, Drago
        // Toon Occhi Blu id 123) — entrambi ritornano true SOLO se hanno
        // aperto un picker (nel qual caso trySpecialSummonFromHand viene
        // richiamata DA LORO a scelta fatta, non qui).
        if (typeof def.getSpecialSummonBanishFilters === 'function' && window.DuelEngineUI) {
            const ctx = DuelEngine.makeContext('player', { card: card, handIndex: handIndex });
            if (offerSpecialSummonBanishChoice(card, handIndex, def.getSpecialSummonBanishFilters(ctx))) return;
        }
        if (typeof def.getSpecialSummonMixedTributeCandidates === 'function' && window.DuelEngineUI) {
            const ctx = DuelEngine.makeContext('player', { card: card, handIndex: handIndex });
            const candidates = def.getSpecialSummonMixedTributeCandidates(ctx);
            if (offerSpecialSummonMixedTributeChoice(card, handIndex, candidates, def.specialSummonMixedTributeMinLevel || 0)) return;
        }
        if (typeof def.getSpecialSummonTributeFilters === 'function' && window.DuelEngineUI) {
            const ctx = DuelEngine.makeContext('player', { card: card, handIndex: handIndex });
            if (offerSpecialSummonTributeChoice(card, handIndex, def.getSpecialSummonTributeFilters(ctx))) return;
        }
        finishSpecialSummonFromHand(card, handIndex);
    };
    if (canNormalSummon) {
        pop.querySelector('#qpMonsterNormalSummon').onclick = () => {
            closeQuickPopover();
            gameState.selectedCard = { type: 'hand', card: card, index: handIndex, owner: 'player' };
            updateCardInfoPanel(card, { sourceType: 'hand', sourceOwner: 'player', isFaceDown: false });
            updateUI();
            highlightEmptySlots(card);
        };
    }
    pop.querySelector('#qpMonsterSummonCancel').onclick = () => closeQuickPopover();
}

/**
 * Wrapper storico: l'attacco dichiarato dal giocatore umano passa sempre
 * per resolveAttack() qui sotto — l'unico posto dove la battaglia viene
 * davvero calcolata. Prima di questo motore, executeAttack() (qui) e
 * botExecuteAttack() (in bot.js) contenevano DUE COPIE quasi identiche
 * dello stesso calcolo di danni: un classico rischio di "il bug si
 * corregge in un posto e resta nell'altro". botExecuteAttack in bot.js
 * ora è un wrapper altrettanto sottile.
 *
 * Prima di richiamare resolveAttack, gestisce anche l'unico costo
 * PRE-dichiarazione d'attacco di questo dataset: "questa carta non può
 * dichiarare un attacco a meno che tu non sacrifichi 1 mostro" (es.
 * Guerriero Pantera, id 399 — def.requiresTributeToAttack). Un costo, non
 * una condizione: va pagato PRIMA che l'attacco venga anche solo
 * dichiarato, quindi qui, non dentro resolveAttack (che risponde solo a
 * "l'attacco è già stato dichiarato, può procedere?").
 */
function executeAttack(attackerIndex, targetIndex) {
    // Niente attacchi con una Catena o una finestra di priorità ancora
    // aperta (es. il bot ha attivato un Effetto Veloce all'inizio della tua
    // Battle Phase, vedi DuelEngine.openPriorityWindow): l'attacco
    // partirebbe nel mezzo della sua risoluzione. Stessa guardia di
    // nextPhase()/endTurn() in game-flow.js.
    if (window.DuelEngine && (DuelEngine.isChainActive() || (DuelEngine.isPriorityWindowOpen && DuelEngine.isPriorityWindowOpen()))) {
        addToLog('⏳ Aspetta che la Catena si risolva prima di attaccare.');
        return;
    }
    // Il pannello informazioni carta (hover/tap su una carta qualsiasi)
    // può restare aperto da prima del trascinamento — richiesta esplicita
    // dell'utente: dichiarare un attacco (bersaglio mostro o diretto) lo
    // chiude sempre, invece di lasciarlo a coprire il campo durante
    // l'animazione di attacco che sta per partire.
    if (typeof updateCardInfoPanel === 'function') updateCardInfoPanel(null);
    const attackerSlot = gameState.playerMonsterField[attackerIndex];
    const attackerDef = attackerSlot && window.DuelEngine && DuelEngine.getDefinition(attackerSlot.card.id);
    // "Paga N Life Points per dichiarare un attacco" (es. Drago Toon
    // Occhi Blu id 123, Manga Ryu-Ran id 606 — def.requiresLifePointsToAttack):
    // costo pagato PRIMA che l'attacco venga anche solo dichiarato,
    // stesso principio di requiresTributeToAttack qui sotto ma senza
    // bisogno di scegliere un bersaglio (basta avere abbastanza LP).
    // Il costo lo paga il comando 'attacca' (eseguiAttacco, battaglia.js):
    // qui solo il controllo, per non far partire un attacco impossibile.
    if (attackerDef && attackerDef.requiresLifePointsToAttack) {
        const cost = attackerDef.requiresLifePointsToAttack;
        if (gameState.playerLP <= cost) {
            addToLog(`🚫 ${attackerSlot.card.name} non può attaccare: non hai abbastanza Life Points (servono ${cost}).`);
            return;
        }
        Comandi.esegui('player', { tipo: 'attacca', attaccante: attackerIndex, bersaglio: targetIndex });
        return;
    }
    if (attackerDef && attackerDef.requiresTributeToAttack) {
        // Maschera della Restrizione (id 371, gameState.tributesBlocked):
        // nessun giocatore può sacrificare carte — un costo d'attacco che
        // richiede un Sacrificio non può essere pagato, quindi l'attacco
        // non può nemmeno essere dichiarato. Stesso principio già
        // applicato all'Evocazione Tributo in attemptMonsterSummon.
        if (gameState.tributesBlocked) {
            addToLog(`🚫 ${attackerSlot.card.name} non può attaccare: Maschera della Restrizione impedisce di sacrificare mostri.`);
            return;
        }
        const tributeCandidates = [];
        gameState.playerMonsterField.forEach((slot, index) => {
            if (slot && index !== attackerIndex) tributeCandidates.push({ slot: slot, index: index });
        });
        if (tributeCandidates.length === 0) {
            addToLog(`🚫 ${attackerSlot.card.name} non può attaccare: non hai un altro mostro da sacrificare.`);
            return;
        }
        if (tributeCandidates.length === 1 || !window.DuelEngineUI) {
            performAttackTribute(tributeCandidates[0].index, attackerIndex, targetIndex);
            return;
        }
        window.DuelEngineUI.openCardListPicker(tributeCandidates.map((c) => c.slot.card), {
            title: `🔻 ${attackerSlot.card.name}: sacrifica un mostro per attaccare`,
            text: 'Scegli quale mostro sacrificare per permettere questo attacco.',
            onSelect: (card) => {
                const match = tributeCandidates.find((c) => c.slot.card.uid === card.uid);
                if (match) performAttackTribute(match.index, attackerIndex, targetIndex);
            }
        });
        return;
    }
    Comandi.esegui('player', { tipo: 'attacca', attaccante: attackerIndex, bersaglio: targetIndex });
}

/** Sacrifica il mostro in `tributeIndex` (costo pre-attacco, vedi executeAttack sopra) e poi dichiara l'attacco: il comando 'attacca' col suo Sacrificio. */
function performAttackTribute(tributeIndex, attackerIndex, targetIndex) {
    Comandi.esegui('player', { tipo: 'attacca', attaccante: attackerIndex, bersaglio: targetIndex, tributo: tributeIndex });
}

function triggerDestroyEffect(owner, index, type) {
    const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
    const slotEl = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="${type}"][data-index="${index}"]`);
    if (!slotEl) return;
    const cardEl = slotEl.querySelector('.card');
    if (cardEl) {
        if (window.FX) FX.playBattleDestroyEffect(cardEl);
        if (window.SFX) SFX.destroy();
        cardEl.classList.add('destroying');
        setTimeout(() => cardEl.remove(), 600);
    }
}

/**
 * Gemella di triggerDestroyEffect per il caso opposto: il mostro ha retto
 * l'attacco. Stessa identica ricerca dello slot nel documento, cosi' le
 * due restano allineate se un giorno cambia il markup del campo.
 * `attackerCardEl` puo' mancare (attacco senza un elemento attaccante
 * visibile): l'effetto sa farne a meno.
 */
function triggerBlockedEffect(owner, index, type, attackerCardEl) {
    const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
    const slotEl = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="${type}"][data-index="${index}"]`);
    if (!slotEl) return;
    const cardEl = slotEl.querySelector('.card');
    if (!cardEl) return;
    if (window.FX && typeof FX.playAttackBlocked === 'function') FX.playAttackBlocked(attackerCardEl, cardEl);
}

function triggerFieldImpact(owner, index, type) {
    const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
    const applyImpact = () => {
        const slotEl = document.querySelector(`#${boardId} .field-slot[data-owner="${owner}"][data-type="${type}"][data-index="${index}"]`);
        if (!slotEl) return false;
        slotEl.classList.remove('impact');
        void slotEl.offsetWidth;
        slotEl.classList.add('impact');
        setTimeout(() => slotEl.classList.remove('impact'), 700);
        return true;
    };

    if (!applyImpact()) {
        setTimeout(() => applyImpact(), 20);
    }
}

// ============================================================
// DuelEngineUI — il "ponte" tra js/engine/duel-engine.js (che non sa nulla di
// HTML/DOM) e il modale di attivazione già definito in duelMonstersCore.html
// (#activateModal). Il motore effetti la richiama in due casi, spiegati
// sopra a ciascuna funzione.
// ============================================================
window.DuelEngineUI = {
    /**
     * Mostra il modale "Attiva la carta?" con Sì/Annulla. Usato sia per
     * l'attivazione volontaria (attemptActivateCard qui sopra) sia da
     * promptDefenderResponse qui sotto per le risposte automatiche del
     * motore (es. "il bot ha attaccato: vuoi attivare Cilindro Magico?").
     */
    openActivateModal(card, { title, text, onConfirm, onCancel }) {
        const modal = document.getElementById('activateModal');
        const preview = document.getElementById('activatePreview');
        if (!modal || !preview) {
            // Nessun modale in pagina (es. una futura pagina senza duello
            // vero): risolviamo attivando direttamente, invece di bloccare.
            onConfirm();
            return;
        }
        document.getElementById('activateModalTitle').textContent = title;
        document.getElementById('activateModalText').textContent = text;
        preview.innerHTML = '';
        const previewCard = createCardElement(card);
        previewCard.classList.add('modal-preview-card');
        preview.appendChild(previewCard);

        modal.classList.add('open');
        const close = () => modal.classList.remove('open');

        document.getElementById('activateConfirmBtn').onclick = () => {
            close();
            onConfirm();
        };
        document.getElementById('activateCancelBtn').onclick = () => {
            close();
            if (onCancel) onCancel();
        };
        modal.onclick = (event) => {
            if (event.target === modal) {
                close();
                if (onCancel) onCancel();
            }
        };
    },

    /**
     * Richiamata da js/engine/duel-engine.js quando è il turno del GIOCATORE
     * UMANO di decidere se rispondere a un evento (attacco dichiarato
     * dal bot, evocazione del bot, o un'attivazione manuale a cui
     * rispondere con una Trappola/Effetto Rapido) con una delle sue carte
     * candidate. `respond(choice|null)` va chiamata esattamente una volta,
     * con la carta scelta o null se il giocatore rinuncia. `triggerCard`
     * (opzionale — presente solo per le risposte a un'attivazione
     * manuale, vedi openActivationWindow in duel-engine.js) è la carta
     * dell'avversario a cui si starebbe rispondendo: se presente, il
     * modale ne mostra nome ed effetto, non solo quelli della carta con
     * cui rispondere.
     *
     * Semplificazione: se ci fosse più di una carta candidata (nel
     * database attuale non succede mai in pratica), questo prompt ne
     * propone solo la prima — una vera scelta multipla è un'estensione
     * futura di questo stesso file.
     */
    promptDefenderResponse(candidates, respond, triggerCard, testoMomento, triggerIsOwn) {
        const choice = candidates[0];
        // Finestra di priorità "a vuoto" (openPriorityWindow, duel-engine.js):
        // nessuno ha attivato nulla, quindi non c'è una carta a cui
        // rispondere — si dice in che momento del turno ci si trova.
        if (testoMomento) {
            this.openActivateModal(choice.card, {
                title: '⚡ Effetto Veloce',
                text: `${testoMomento}. Vuoi attivare ${choice.card.name}?`,
                onConfirm: () => respond(choice),
                onCancel: () => respond(null)
            });
            return;
        }
        // #activateModalText è un <p> semplice (nessun white-space: pre-line
        // in CSS): un "\n" collasserebbe comunque in uno spazio, quindi il
        // testo è pensato per restare leggibile anche come un'unica frase
        // continua, non per andare a capo davvero.
        // triggerIsOwn: in cima alla Catena c'è una carta TUA (l'avversario ha
        // passato e la priorità è tornata a te).
        const text = (triggerCard && triggerIsOwn)
            ? `In cima alla Catena c'è la tua ${triggerCard.name} e l'avversario non ha risposto. Vuoi aggiungere anche ${choice.card.name}?`
            : triggerCard
            ? `L'avversario ha attivato ${triggerCard.name}: «${((typeof formatCardText === 'function') ? formatCardText(triggerCard.effect, triggerCard) : triggerCard.effect) || 'nessuna descrizione disponibile'}». Vuoi rispondere con ${choice.card.name}?`
            : `L'avversario ha agito. Vuoi attivare ${choice.card.name} in risposta?`;
        // `triggerCard` è presente SOLO per le risposte dentro una vera
        // Chain (openActivationWindow) — mai per le finestre di reazione
        // "nominate" più semplici (onAttackDeclare/onOpponentSummon), che
        // non passano dalla pila gameState.chain. In quel caso il titolo
        // indica anche IN QUALE Link si starebbe rispondendo (coerente con
        // la Pila della Catena a schermo, vedi renderChainStack in
        // game-flow.js) — pura informazione, nessuna logica dipende da
        // questo numero.
        const chainLinkNumber = (triggerCard && window.gameState && gameState.chain) ? gameState.chain.links.length + 1 : null;
        const title = chainLinkNumber ? `🛡️ Rispondere? (Catena — Link ${chainLinkNumber})` : '🛡️ Rispondere?';
        this.openActivateModal(choice.card, {
            title: title,
            text: text,
            onConfirm: () => respond(choice),
            onCancel: () => respond(null)
        });
    },

    /**
     * Box con una fila di carte scorrevole in orizzontale — per ogni
     * effetto-carta che deve mostrare più carte insieme invece di una
     * sola (es. "guarda la mano dell'avversario e scegline 1 mostro", "hai
     * scavato queste 5 carte del Deck"). `selectable: true` (default) rende
     * ogni carta cliccabile: cliccarla chiama onSelect(card, index) e
     * chiude il box; `selectable: false` lo rende solo informativo, con un
     * unico pulsante Chiudi. Se il box non esiste in pagina (fallback),
     * sceglie da sola la prima carta invece di bloccare l'effetto, stesso
     * spirito di openActivateModal qui sopra.
     */
    /*
     * `evocabili` (facoltativo, elenco di uid): mostra TUTTE le carte ma
     * rende selezionabili solo quelle elencate, che pulsano in viola; le
     * altre restano visibili e spente. Nato per l'Extra Deck (vedi
     * createSlotElement in game-flow.js): così si vede quali Fusioni si
     * possono Evocare ADESSO in mezzo a tutte quelle che si possiedono,
     * come in Master Duel, invece di un elenco che contiene solo loro.
     */
    openCardListPicker(cards, { title, text, selectable = true, emptyText, onSelect, onCancel, evocabili } = {}) {
        const uidEvocabili = Array.isArray(evocabili) ? new Set(evocabili) : null;
        const modal = document.getElementById('cardListPickerModal');
        const row = document.getElementById('cardListPickerRow');
        if (!modal || !row) {
            if (selectable && cards.length > 0 && onSelect) onSelect(cards[0], 0);
            else if (onCancel) onCancel();
            return;
        }

        document.getElementById('cardListPickerTitle').textContent = title || '🃏 Scegli una carta';
        document.getElementById('cardListPickerText').textContent = text || '';

        const close = () => modal.classList.remove('open');

        // Descrizione al passaggio del mouse (#cardListPickerInfo): questo
        // modale copre SEMPRE il pannello normale #cardInfoPanel (z-index
        // 100000, vedi .modal-backdrop in duelMonstersCore.html), quindi
        // serve una copia inline dello stesso contenuto — stessa struttura
        // di updateCardInfoPanel (game-flow.js), riusa le sue classi CSS.
        const infoEl = document.getElementById('cardListPickerInfo');
        // Nessun suggerimento scritto: il pannello resta vuoto finche' non si passa su una carta.
        const HINT = '';
        const showCardInfo = (card) => {
            if (!infoEl) return;
            // Una carta disegnata col retro (vedi __mostraCoperta più
            // sotto) non deve rivelare nulla nemmeno passandoci sopra il
            // mouse: sarebbe la stessa fuga di informazione, solo da
            // un'altra porta.
            if (card.__mostraCoperta) {
                infoEl.innerHTML = '<span class="card-list-info-hint">Carta coperta dell\'avversario: non sai cosa sia, scegli la casella.</span>';
                return;
            }
            // Termini della provenienza della carta, come in
            // updateCardInfoPanel (game-flow.js) — vedi getCardTerms in
            // js/data/cards-db.js.
            const pickerTerms = (typeof getCardTerms === 'function') ? getCardTerms(card) : { monsterSingular: 'Mostro', spellSingular: 'Magia', trapSingular: 'Trappola' };
            const typeLabel = card.type === 'monster' ? pickerTerms.monsterSingular : card.type === 'spell' ? pickerTerms.spellSingular : pickerTerms.trapSingular;
            const levelLabel = card.type === 'monster' && card.level ? ` • Livello ${card.level}` : '';
            // ATK/DEF effettivo, non grezzo — stesso bug/fix già applicato a
            // updateCardInfoPanel (game-flow.js): un mostro potenziato già in
            // campo, se scelto come candidato in questo stesso picker (es.
            // Dispositivo di Evacuazione Forzata), mostrava qui il valore
            // BASE invece di quello corretto.
            const hasEffectiveStats = card.type === 'monster' && window.DuelEngine && typeof DuelEngine.getEffectiveAtk === 'function';
            const infoAtk = hasEffectiveStats ? DuelEngine.getEffectiveAtk(card) : card.attack;
            const infoDef = hasEffectiveStats ? DuelEngine.getEffectiveDef(card) : card.defense;
            const statsLabel = card.type === 'monster' ? `<div class="card-info-stats">ATK ${infoAtk} • DEF ${infoDef}</div>` : '';
            const writtenEffect = (typeof formatCardText === 'function') ? formatCardText(card.effect, card) : card.effect;
            const effectText = writtenEffect || (card.type === 'monster' ? `${pickerTerms.monsterSingular} normale senza effetto speciale.` : 'Questa carta non presenta un effetto scritto.');
            infoEl.innerHTML = `<div class="card-info-name">${escapeHtml(card.name)}</div><div class="card-info-meta">${typeLabel}${levelLabel}</div>${statsLabel}<p>${escapeHtml(effectText)}</p>`;
        };
        if (infoEl) infoEl.innerHTML = HINT;

        row.innerHTML = '';
        if (cards.length === 0) {
            row.innerHTML = `<div class="card-list-empty">${emptyText || 'Nessuna carta disponibile.'}</div>`;
        } else {
            cards.forEach((card, index) => {
                const item = document.createElement('div');
                // Il confronto vuole un uid vero: due carte SENZA uid
                // (undefined === undefined) si accenderebbero insieme.
                const evocabile = uidEvocabili ? (card.uid != null && uidEvocabili.has(card.uid)) : null;
                const selezionabile = selectable && evocabile !== false;
                item.className = 'card-list-item' + (selezionabile ? '' : ' not-selectable')
                    + (evocabile === true ? ' card-list-item--evocabile' : '')
                    + (evocabile === false ? ' card-list-item--spenta' : '');
                // `__mostraCoperta`: la carta va disegnata COL RETRO, non
                // scoperta. Lo imposta chi costruisce l'elenco (vedi
                // chooseFieldCardTarget in card-effects.js) per le carte
                // coperte dell'AVVERSARIO — altrimenti un picker che
                // chiede "scegli 1 carta del suo Terreno" gli rivelerebbe
                // nome, ATK/DEF ed effetto di ogni sua carta Set, cioè
                // esattamente l'informazione che il gioco tiene nascosta.
                // La carta resta selezionabile e conserva il suo uid: si
                // sceglie la CASELLA alla cieca, come al tavolo vero.
                // La Posizione si passa SOLO per la carta mascherata (un
                // retro si disegna in Difesa): per tutte le altre resta
                // il comportamento di sempre, o ogni carta del picker
                // verrebbe disegnata coricata.
                item.appendChild(card.__mostraCoperta
                    ? createCardElement(card, true, 'defense')
                    : createCardElement(card));
                item.onmouseenter = () => showCardInfo(card);
                if (selezionabile) {
                    item.onclick = () => {
                        close();
                        if (onSelect) onSelect(card, index);
                        // onSelect gira DOPO che il chiamante ha già fatto il
                        // proprio updateUI() (il picker si apre in modo
                        // asincrono, in attesa del click) — senza un refresh
                        // esplicito qui, una carta che sposta/aggiunge
                        // qualcosa SOLO dentro onSelect (es. Maga della Fede,
                        // id 588: aggiunge una Magia alla mano scelta qui)
                        // restava invisibile in campo/mano finché non
                        // arrivava un updateUI() successivo per un altro
                        // motivo (bug reale segnalato: "aggiunge la carta in
                        // mano ma è come se non si refreshasse"). Deliberatamente
                        // NON il vero updateUI() (che richiama anche
                        // recomputeStaticEffects()/checkGameOver()): un
                        // ricalcolo completo degli effetti Continui A METÀ di
                        // una catena di scelte in sequenza (es. Gilford la
                        // Leggenda, id 709: equipaggia più Carte
                        // Equipaggiamento una alla volta, ogni scelta riapre
                        // subito il picker successivo) può ripulire/reagire a
                        // stato che il chiamante non ha ancora finito di
                        // costruire — bug reale trovato scrivendo il test di
                        // questa sessione. Un semplice ridisegno (mano +
                        // Terreno, senza toccare gli effetti Continui) basta
                        // per il sintomo segnalato ed è innocuo in ogni altro
                        // caso.
                        if (typeof renderPlayerHand === 'function') renderPlayerHand();
                        if (typeof renderBotHand === 'function') renderBotHand();
                        if (typeof renderFields === 'function') renderFields();
                        if (typeof renderEquipLinks === 'function') renderEquipLinks();
                    };
                }
                row.appendChild(item);
            });
        }

        modal.classList.add('open');
        document.getElementById('cardListPickerCloseBtn').onclick = () => {
            close();
            if (onCancel) onCancel();
        };
        modal.onclick = (event) => {
            if (event.target === modal) {
                close();
                if (onCancel) onCancel();
            }
        };
    },

    /**
     * Stesso popover Attacco/Difesa già usato da openSummonModal per
     * l'Evocazione Normale, ma riutilizzabile da QUALUNQUE effetto-carta
     * che debba far scegliere una Posizione dopo un Special Summon (es.
     * Rinascita del Mostro, id 35) — nessun pulsante Annulla: una volta
     * scelto CHE mostro far tornare in campo, la regola vera impone
     * comunque di piazzarlo in una Posizione, non si può più fare
     * marcia indietro solo su questo secondo passaggio.
     */
    openPositionPicker(anchorEl, { title, onSelect } = {}) {
        const pop = openQuickPopover(anchorEl, `
            <div class="quick-popover-actions">
                <button type="button" class="quick-popover-btn attack icon-round" id="qpPositionAttack" title="Scoperta in Attacco"><span data-icon="attackPos"></span></button>
                <button type="button" class="quick-popover-btn defense icon-round" id="qpPositionDefense" title="Coperta in Difesa"><span data-icon="defensePos"></span></button>
            </div>
        `, { bare: true, dismissible: false });
        // La carta e' gia' stata scelta: la Posizione resta obbligatoria e
        // il click esterno non deve lasciare un'Evocazione a meta'.
        // Stesso refresh leggero (mai il vero updateUI(), vedi il commento
        // su questo in openCardListPicker qui sopra) dopo ogni scelta
        // asincrona — bug reale della stessa famiglia: un mostro appena
        // Special Summonato via un popover come questo restava invisibile
        // finché non arrivava un render successivo per un altro motivo.
        const refresh = () => {
            if (typeof renderPlayerHand === 'function') renderPlayerHand();
            if (typeof renderBotHand === 'function') renderBotHand();
            if (typeof renderFields === 'function') renderFields();
            if (typeof renderEquipLinks === 'function') renderEquipLinks();
        };
        pop.querySelector('#qpPositionAttack').onclick = () => { closeQuickPopover(); onSelect('attack'); refresh(); };
        pop.querySelector('#qpPositionDefense').onclick = () => { closeQuickPopover(); onSelect('defense'); refresh(); };
    },

    /**
     * Popover generico a 2 pulsanti per una scelta secondaria dopo aver
     * già selezionato una carta bersaglio (es. Predone Cyber, id 174:
     * prima scegli QUALE Carta Equipaggiamento con openCardListPicker,
     * poi se distruggerla o rubarla con questo) — più generico di
     * openPositionPicker qui sopra (Attacco/Difesa fissi), riusabile per
     * qualunque coppia di azioni testuali con icona.
     */
    openChoicePopover(anchorEl, { title, choiceA, choiceB } = {}) {
        const pop = openQuickPopover(anchorEl, `
            <div class="quick-popover-title">${title || ''}</div>
            <div class="quick-popover-actions">
                <button type="button" class="quick-popover-btn attack icon-round" id="qpChoiceA" title="${choiceA.label}">${choiceA.icon}</button>
                <button type="button" class="quick-popover-btn defense icon-round" id="qpChoiceB" title="${choiceB.label}">${choiceB.icon}</button>
            </div>
        `);
        // Stesso refresh leggero di openPositionPicker qui sopra.
        const refresh = () => {
            if (typeof renderPlayerHand === 'function') renderPlayerHand();
            if (typeof renderBotHand === 'function') renderBotHand();
            if (typeof renderFields === 'function') renderFields();
            if (typeof renderEquipLinks === 'function') renderEquipLinks();
        };
        pop.querySelector('#qpChoiceA').onclick = () => { closeQuickPopover(); choiceA.onSelect(); refresh(); };
        pop.querySelector('#qpChoiceB').onclick = () => { closeQuickPopover(); choiceB.onSelect(); refresh(); };
    },

    /**
     * Scelta fra N OPZIONI con un'etichetta — non fra carte. Serve agli
     * effetti che chiedono di dichiarare una CATEGORIA (Quiz Inverso id 885:
     * Mostro, Magia o Trappola; Il Cacciatore dalle 7 Armi id 1120: un Tipo
     * di mostro) o di scegliere fra due effetti (Don Zaloog id 883), che
     * finché esistevano solo openCardListPicker e i popover a due icone
     * sceglievano da sé.
     *
     * Con il riquadro, non a pulsanti nudi: porta una domanda da leggere
     * (vedi l'opzione `bare` di openQuickPopover). `options`: array di
     * { value, label, icon? }. Con `onCancel` compare "Annulla" e un click
     * fuori chiude; senza, la scelta è obbligatoria e un click fuori viene
     * ignorato.
     *
     * Le carte non lo chiamano direttamente: passano da chooseOption
     * (card-effects.js), che sa anche far scegliere il bot e far viaggiare
     * la scelta in Multiplayer.
     */
    openOptionPicker(anchorEl, { title, text, options, onSelect, onCancel, cancelLabel } = {}) {
        const voci = (options || []).map((o, i) => `
            <button type="button" class="quick-popover-btn confirm quick-popover-option" data-option="${i}">
                ${o.icon ? `<span class="quick-popover-option-icon">${o.icon}</span>` : ''}<span>${escapeHtml(o.label)}</span>
            </button>`).join('');
        const annulla = onCancel
            ? `<button type="button" class="quick-popover-btn cancel quick-popover-option" data-option="annulla">${escapeHtml(cancelLabel || 'Annulla')}</button>`
            : '';
        const pop = openQuickPopover(anchorEl, `
            <div class="quick-popover-title">${escapeHtml(title || 'Scegli')}</div>
            ${text ? `<div class="quick-popover-text">${escapeHtml(text)}</div>` : ''}
            <div class="quick-popover-actions quick-popover-actions--options">${voci}${annulla}</div>
        `, { dismissible: !!onCancel, onDismiss: onCancel, extraClass: 'quick-popover--options' });
        const refresh = () => {
            if (typeof renderPlayerHand === 'function') renderPlayerHand();
            if (typeof renderBotHand === 'function') renderBotHand();
            if (typeof renderFields === 'function') renderFields();
            if (typeof renderEquipLinks === 'function') renderEquipLinks();
        };
        pop.querySelectorAll('[data-option]').forEach((btn) => {
            btn.onclick = () => {
                closeQuickPopover();
                const chiave = btn.getAttribute('data-option');
                if (chiave === 'annulla') {
                    if (onCancel) onCancel();
                    return;
                }
                const scelta = options[Number(chiave)];
                if (scelta && onSelect) onSelect(scelta.value, scelta);
                refresh();
            };
        });
    }
};
