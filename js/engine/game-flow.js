const attackArrowSVG = document.getElementById('attack-arrow-svg');
const attackArrowLine = document.getElementById('attack-arrow-line');
const logToggleBtn = document.getElementById('logToggleBtn');
const gameLogContainer = document.getElementById('gameLogContainer');
let isDraggingAttack = false;
let attackDragStart = { x: 0, y: 0, attackerIndex: -1, forcedDirect: false };
let duelStartTime = null;
let duelTimerInterval = null;
let duelPauseStartedAt = null;
let lifecyclePauseActive = false;

/**
 * La metà "a schermo" di isBlockingModalOpen (js/engine/canale-partita.js,
 * che risponde anche per le selezioni sul campo tenute in gameState):
 * vero mentre un modale condiviso (#activateModal/#cardListPickerModal/
 * #surrenderModal, tutti `.modal-backdrop.open`) o il popover rapido
 * (#quickPopover, la cui sola presenza nel DOM è già "aperto") aspettano
 * un click umano. Risponde alla domanda 'interfaccia-occupata' del canale
 * delle regole; undefined = "non sono io a bloccare".
 */
function interfacciaOccupata() {
    if (window.DUEL_CINEMATIC_LOCK) return true;
    if (document.querySelector('.modal-backdrop.open')) return true;
    if (document.getElementById('quickPopover')) return true;
    // Non solo i modali: anche una cinematica di Evocazione lunga (il
    // filmato dedicato di una carta, o la convergenza elementale di un
    // Livello 7+) deve fermare il duello finche' non finisce. Senza, la
    // fase avanzava e il bot continuava a giocare SOTTO a un'animazione
    // che copriva tutto lo schermo. Il cerchio magico generico non conta:
    // dura un attimo, vedi FX.isCinematicPlaying in js/ui/effects.js.
    if (window.FX && typeof FX.isCinematicPlaying === 'function' && FX.isCinematicPlaying()) return true;
    return undefined;
}

// ============================================================
// Ascoltatori del canale delle regole (js/engine/eventi-duello.js).
// Le regole del duello non chiamano più per nome le funzioni di questo
// file: dicono cosa è successo, e qui si decide come disegnarlo. Le
// funzioni sono dichiarazioni (sollevate in cima al file), quindi possono
// essere registrate prima di essere scritte. Quelle che vivono in
// actions.js si registrano in cima a actions.js.
// ============================================================
EventiDuello.ascolta('registro', scriviNelRegistro);
EventiDuello.ascolta('ridisegna', ridisegnaDuello);
EventiDuello.ascolta('catena', renderChainStack);
EventiDuello.ascolta('life-points', () => renderLifePoints());
EventiDuello.ascolta('annuncio-fase', showPhaseAnnouncement);
EventiDuello.ascolta('annuncio-turno', showEpicSlamAnnouncement);
EventiDuello.ascolta('orologio', () => updateDuelTimer());
EventiDuello.ascolta('pescata-da-effetto', animateEffectDraw);
EventiDuello.ascolta('attesa-decisione-remota', mostraAttesaDecisioneRemota);
EventiDuello.ascolta('effetto-battaglia', showBattleEffect);
EventiDuello.ascolta('danno-fluttuante', showFloatingDamage);
EventiDuello.ascolta('avviso-attacco-diretto', () => showDirectAttackWarning());
EventiDuello.ascolta('cambio-posizione', showPositionEffect);
EventiDuello.ascolta('fine-duello', chiudiDuelloASchermo);
EventiDuello.ascolta('vittoria-istantanea', suonaCinematicaVittoria);
EventiDuello.ascolta('interfaccia-occupata', interfacciaOccupata);
EventiDuello.ascolta('carta-pescata-in-mano', () => {
    // La carta appena pescata scorre in mano da destra, stesso effetto
    // (e stessa durata, 0.3s) della mano iniziale — vedi .card.deal-in in
    // CSS. L'avviso arriva DOPO updateUI(), quando la carta è già nel DOM.
    const handEl = document.getElementById('playerHand');
    if (!handEl) return;
    const cards = handEl.querySelectorAll('.card');
    const lastCard = cards[cards.length - 1];
    if (lastCard) dealCardsWithStagger([lastCard]);
});
EventiDuello.ascolta('partita-azzerata', () => {
    // Il ricordo di quante carte aveva ogni pila vive fuori da gameState
    // (è puro stato di presentazione), quindi sopravviverebbe al duello
    // precedente: senza questo azzeramento, il primo render di una
    // partita nuova confronterebbe il Deck da 40 con quello rimasto a
    // fine partita scorsa, vedrebbe una crescita e farebbe partire
    // l'animazione "è arrivata una carta" su una pila che invece sta
    // solo nascendo. Stesso motivo per gli agganci Equip.
    Object.keys(pileCountsAtLastRender).forEach((k) => delete pileCountsAtLastRender[k]);
    equipLinksAtLastRender.clear();
    mostraAttesaDecisioneRemota(false);
});

/**
 * Mostra vicino all'avversario perché il duello a passo comune è fermo.
 * L'elemento è già nel markup per non cambiare geometria durante il gioco;
 * qui si riflette soltanto l'evento del motore, senza polling né timer.
 */
function mostraAttesaDecisioneRemota(inAttesa) {
    const avviso = document.getElementById('remoteChoiceWait');
    if (!avviso) return;
    avviso.hidden = !inAttesa;
    avviso.setAttribute('aria-hidden', inAttesa ? 'false' : 'true');
}

/**
 * Chiude e rende inerti le finestre del duello quando l'esito è ormai
 * definitivo. Togliere soltanto `.open` non basta: fra endDuel() e la
 * schermata finale passano 900 ms e un callback già in coda può riaprire
 * un modale (in particolare la conferma Abbandona), lasciandolo visibile
 * sotto Vittoria e capace di interferire con il pulsante Continua.
 */
function sealDuelModalsForOutcome() {
    if (document.body) document.body.classList.add('duel-outcome-active');
    document.querySelectorAll('.modal-backdrop').forEach((modal) => {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        modal.inert = true;
    });
    const quickPopover = document.getElementById('quickPopover');
    if (quickPopover) quickPopover.remove();
}

function toggleLog() {
    if (!gameLogContainer) return;
    const isCollapsed = gameLogContainer.classList.toggle('collapsed');
    if (logToggleBtn) {
        logToggleBtn.textContent = isCollapsed ? 'Espandi' : 'Comprimi';
    }
}

// Le carte personalizzate (crea-carta.html) hanno nome/effetto scelti
// liberamente dall'utente. Ogni punto che li inserisce in innerHTML deve
// passarli da qui prima, altrimenti un nome tipo "<img src=x onerror=...>"
// verrebbe eseguito come HTML vero (XSS memorizzato, visibile anche in
// multiplayer a chi legge quella carta).
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function updateCardInfoPanel(card, options = {}) {
    const panel = document.getElementById('cardInfoPanel');
    const content = document.getElementById('cardInfoContent');
    const preview = document.getElementById('cardInfoPreview');
    if (!panel || !content) return;

    const shouldHide = !card || options.sourceType === 'deck' || (options.sourceOwner === 'bot' && options.isFaceDown);
    if (shouldHide) {
        content.innerHTML = '';
        if (preview) preview.innerHTML = '';
        panel.classList.remove('visible');
        return;
    }

    if (preview) {
        preview.innerHTML = '';
        const previewCard = createCardElement(card, false, 'attack');
        previewCard.onclick = null;
        previewCard.onpointerdown = null;
        preview.appendChild(previewCard);
    }

    // Termini della PROVENIENZA della carta: una carta 'ww1' si annuncia
    // come Truppa/Manovra/Insidia, non come Mostro/Magia/Trappola — vedi
    // getCardTerms in js/data/cards-db.js.
    const cardTerms = (typeof getCardTerms === 'function') ? getCardTerms(card) : { monsterSingular: 'Mostro', spellSingular: 'Magia', trapSingular: 'Trappola' };
    const typeLabel = card.type === 'monster' ? cardTerms.monsterSingular : card.type === 'spell' ? cardTerms.spellSingular : cardTerms.trapSingular;
    const levelLabel = card.type === 'monster' && card.level ? ` • Livello ${card.level}${getTributesRequired(card) > 0 ? ` • Richiede ${getTributesRequired(card)} Tribut${getTributesRequired(card) > 1 ? 'i' : 'o'}` : ''}` : '';
    // formatCardText risolve gli eventuali segnaposto di terminologia nel
    // testo della carta ({mostro} -> truppa per il set WW1) — vedi
    // js/data/cards-db.js.
    const writtenEffect = (typeof formatCardText === 'function') ? formatCardText(card.effect, card) : card.effect;
    const effectText = writtenEffect || (card.type === 'monster' ? `${cardTerms.monsterSingular} normale senza effetto speciale.` : 'Questa carta non presenta un effetto scritto.');
    // ATK/DEF "effettivo" (bonus continui/temporanei inclusi), esattamente
    // come sull'anteprima appena sopra (createCardElement, che usa già
    // DuelEngine.getEffectiveAtk/Def) — bug reale segnalato dall'utente:
    // questa riga leggeva ancora card.attack/card.defense GREZZI, quindi
    // un mostro potenziato mostrava il valore corretto nell'anteprima
    // della carta ma quello BASE, non aggiornato, in questa riga subito
    // sotto, nello stesso identico pannello.
    const hasEffectiveStats = card.type === 'monster' && window.DuelEngine && typeof DuelEngine.getEffectiveAtk === 'function';
    const infoAtk = hasEffectiveStats ? DuelEngine.getEffectiveAtk(card) : card.attack;
    const infoDef = hasEffectiveStats ? DuelEngine.getEffectiveDef(card) : card.defense;
    content.innerHTML = `
        <div class="card-info-name">${escapeHtml(card.name)}</div>
        <div class="card-info-meta">${typeLabel}${levelLabel}</div>
        ${card.type === 'monster' ? `<div class="card-info-stats">ATK ${infoAtk} • DEF ${infoDef}</div>` : ''}
        <p>${escapeHtml(effectText)}</p>
    `;
    panel.classList.add('visible');
}

/**
 * L'hover è un gesto reale solo con mouse/trackpad. Su touch i browser
 * possono sintetizzare mouseenter durante uno swipe o dopo un tap: il box
 * informazioni deve aprirsi esclusivamente dal click/tap diretto sulla carta.
 */
function canInspectCardOnHover() {
    return !window.matchMedia || window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

// Un pointerup che conclude un attacco viene normalmente seguito da un
// `click` sintetico sulla carta sotto al puntatore. A quel punto
// isDraggingAttack e' gia' tornato false: senza questa breve memoria il click
// riaprirebbe il pannello informazioni proprio mentre parte la battaglia.
let cardInspectionSuppressedUntil = 0;

function suppressCardInspectionFor(durationMs = 500) {
    cardInspectionSuppressedUntil = Math.max(cardInspectionSuppressedUntil, performance.now() + durationMs);
    updateCardInfoPanel(null);
}

/**
 * Fonte unica per distinguere una consultazione volontaria da un click che
 * sta rispondendo a una scelta del duello. Durante queste scelte la carta e'
 * un comando (Tributo, scarto, bersaglio, posizione...), non un collegamento
 * al suo dettaglio: aprire anche il pannello copriva il campo e, su mobile,
 * faceva sembrare che il tap non fosse stato recepito.
 */
function isGameplaySelectionActive() {
    if (performance.now() < cardInspectionSuppressedUntil || isDraggingAttack) return true;
    if (gameState.pendingTributeSummon || gameState.pendingTributePlacement
        || gameState.pendingHandDiscard || gameState.pendingSummon) return true;
    return !!(window.Decisioni && typeof Decisioni.inSospeso === 'function' && Decisioni.inSospeso());
}

/**
 * Gesto esplicito del Terreno: pressione prolungata su touch oppure clic
 * destro su desktop. Il tap breve resta interamente dedicato al comando di
 * gioco corrente (attacco, Tributo, bersaglio e cosi' via).
 */
function enableFieldCardInspectionGesture(cardEl, card, options) {
    const HOLD_MS = 520;
    const MOVE_TOLERANCE = 12;
    let timer = null;
    let startX = 0;
    let startY = 0;
    let consumed = false;

    const cancelTimer = () => {
        clearTimeout(timer);
        timer = null;
    };

    cardEl.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        consumed = false;
        startX = event.clientX;
        startY = event.clientY;
        cancelTimer();
        timer = setTimeout(() => {
            consumed = true;
            updateCardInfoPanel(card, options);
            if (window.NativeHaptics) NativeHaptics.light();
        }, HOLD_MS);
    }, true);
    cardEl.addEventListener('pointermove', (event) => {
        if (Math.hypot(event.clientX - startX, event.clientY - startY) > MOVE_TOLERANCE) cancelTimer();
    }, true);
    cardEl.addEventListener('pointerup', cancelTimer, true);
    cardEl.addEventListener('pointercancel', cancelTimer, true);
    cardEl.addEventListener('click', (event) => {
        if (!consumed) return;
        consumed = false;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);
    cardEl.addEventListener('contextmenu', (event) => {
        cancelTimer();
        consumed = true;
        event.preventDefault();
        event.stopPropagation();
        updateCardInfoPanel(card, options);
        if (window.NativeHaptics) NativeHaptics.light();
    });
}

// Click fuori dal pannello descrizione carta -> lo chiude. Esclude i click
// su una QUALUNQUE carta (.card): quelli sono l'azione che apre/aggiorna il
// pannello (vedi handleCardClick/onmouseenter sulle carte), non un "click
// fuori" — senza questa eccezione, il click che apre il pannello lo
// chiuderebbe di nuovo un istante dopo (l'evento raggiunge document in
// bubbling subito dopo aver aperto/aggiornato il pannello sulla carta).
document.addEventListener('click', (event) => {
    // Android WebView puo' produrre un click sintetico dopo il pointerup
    // touch gia' gestito dalla mano. Se coincide con quel tap, l'azione e'
    // gia' avvenuta: lasciarlo proseguire la annullerebbe subito.
    if (typeof consumeHandCompatibilityClick === 'function'
        && consumeHandCompatibilityClick(event)) return;

    const panel = document.getElementById('cardInfoPanel');
    const clickedInfo = panel && panel.contains(event.target);
    const clickedPlayerHandCard = event.target.closest('#playerHand .card');
    const clickedQuickAction = event.target.closest('#quickPopover');

    // I pulsanti flottanti appartengono ancora all'interazione con la
    // carta: non abbassarla prima che il relativo handler abbia concluso.
    // Qualunque altro click esterno, comprese altre carte sul Terreno,
    // chiude invece davvero la selezione della mano.
    if (!clickedInfo && !clickedPlayerHandCard && !clickedQuickAction
        && !gameState.pendingTributeSummon && !gameState.pendingHandDiscard
        && typeof clearHandCardSelection === 'function') {
        clearHandCardSelection();
    }

    if (!panel || !panel.classList.contains('visible')) return;
    if (clickedInfo || event.target.closest('.card') || clickedQuickAction) return;
    updateCardInfoPanel(null);
});

/**
 * Annuncio a schermo per cambi Fase, in stile Master Duel.
 * variant: 'phase' (oro, default) | 'battle' (rosso/oro, stessa dimensione
 * e stesso ritmo delle altre fasi — la Battle Phase non ha più un
 * trattamento speciale: quello ora è riservato al cambio turno, vedi
 * showEpicSlamAnnouncement() più sotto).
 */
function showPhaseAnnouncement(title, subtitle, variant = 'phase') {
    const existing = document.getElementById('phaseAnnouncement');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.id = 'phaseAnnouncement';
    wrap.className = variant === 'battle' ? 'phase-announce--battle' : 'phase-announce--phase';
    wrap.innerHTML = `
        <div class="phase-announce-banner">
            <div class="phase-announce-title">${title}</div>
            ${subtitle ? `<div class="phase-announce-sub">${subtitle}</div>` : ''}
        </div>
    `;
    document.body.appendChild(wrap);
    if (window.SFX) SFX.phaseChange();

    const duration = 1300;
    wrap.style.setProperty('--phase-anim-duration', `${duration}ms`);
    void wrap.offsetWidth;
    wrap.classList.add('phase-announce-play');
    setTimeout(() => wrap.remove(), duration + 80);
}

/**
 * Annuncio epico "cinematografico", in stile Master Duel: dura 3 secondi e
 * combina flash a schermo, barre cinematografiche, raggi rotanti e due
 * parole che si scontrano al centro con impatto (senza scuotere lo schermo).
 * Riservato al momento più "importante" del duello — il cambio turno tra
 * giocatore e bot (vedi changeTurn()) — non più alla Battle Phase, che ora
 * usa lo stesso trattamento delle altre fasi (showPhaseAnnouncement sopra).
 */
function showEpicSlamAnnouncement(wordLeft, wordRight, subtitle) {
    const existing = document.getElementById('battleStartOverlay');
    if (existing) existing.remove();

    // Senza wordRight (es. la frase intera "È il mio turno!" del giocatore)
    // mostriamo una sola parola/frase centrata, più piccola per starci su
    // una riga — non lo scontro fra due parole separate. wordRight ora può
    // essere il nome vero di un personaggio (es. "Maximillion Pegasus"),
    // molto più lungo del vecchio "BOT" fisso: oltre una certa lunghezza
    // usiamo un carattere più piccolo per entrambe le parole, altrimenti lo
    // scontro a tutta larghezza (clamp fino a 9vw) uscirebbe dallo schermo.
    const isLongRight = wordRight && wordRight.length > 8;
    const longClass = isLongRight ? ' battle-start-word--long' : '';
    const wordsHtml = wordRight
        ? `<span class="battle-start-word battle-start-word--left${longClass}">${wordLeft}</span><span class="battle-start-word battle-start-word--right${longClass}">${wordRight}</span>`
        : `<span class="battle-start-word battle-start-word--left battle-start-word--solo">${wordLeft}</span>`;

    const overlay = document.createElement('div');
    overlay.id = 'battleStartOverlay';
    overlay.innerHTML = `
        <div class="battle-start-flash"></div>
        <div class="battle-start-bar bar-top"></div>
        <div class="battle-start-bar bar-bottom"></div>
        <div class="battle-start-title">${wordsHtml}</div>
        <div class="battle-start-sub">${subtitle}</div>
    `;
    document.body.appendChild(overlay);
    void overlay.offsetWidth;
    overlay.classList.add('play');

    // NIENTE scuotimento dello schermo qui (richiesta esplicita
    // dell'utente): il cambio turno capita a ogni turno, e uno scossone del
    // campo ogni volta stanca. L'impatto lo danno già flash, barre e le due
    // parole che si scontrano. Lo scuotimento (.fx-shake) resta per i colpi
    // veri: danni, distruzioni, attacchi (js/ui/effects.js).

    setTimeout(() => overlay.remove(), 3000);
}

/**
 * Anima le ultime `count` carte in mano al giocatore con lo stesso
 * trattamento (sfilata da destra + FX.playDrawEffect + SFX.draw) della
 * pescata di inizio turno — vedi finishDrawEffect più sotto — ma per
 * pescate causate da un effetto carta (es. Vaso dell'Avidità) invece che
 * dal normale ciclo di turno. Va chiamata SOLO dopo che il DOM della mano
 * riflette già le nuove carte (cioè dopo un updateUI()): chiamarla prima
 * e lasciare che un updateUI() successivo ricostruisca la mano
 * "staccherebbe" i nodi appena animati dal documento, esattamente come
 * succedeva con l'esplosione di distruzione prima del fix in actions.js
 * (resolveAttack) — vedi il commento lì. Il bot non ha la mano mostrata
 * a schermo, quindi per lui non c'è nulla da animare.
 */
function animateEffectDraw(owner, pending) {
    const count = typeof pending === 'number' ? pending : (pending && pending.count) || 0;
    if (owner !== 'player' || count <= 0) return;
    const handEl = document.getElementById('playerHand');
    if (!handEl) return;
    const uids = pending && Array.isArray(pending.uids) ? new Set(pending.uids) : null;
    const cards = Array.from(handEl.querySelectorAll('.card'));
    dealCardsWithStagger(uids ? cards.filter((el) => uids.has(el.dataset.uid)) : cards.slice(-count));
}

function initGame(opzioniAvvio) {
    // Il nome vero del giocatore (e il suo ritratto) sono già scritti nel
    // box LP da DuelSession.start() -> applyPlayerIdentity() PRIMA che
    // initGame() giri — vedi js/duel-session.js.
    if (logToggleBtn) {
        logToggleBtn.onclick = toggleLog;
    }
    setupSurrenderButton();
    if (gameLogContainer) {
        gameLogContainer.classList.add('collapsed');
        if (logToggleBtn) {
            logToggleBtn.textContent = 'Espandi';
        }
    }
    resetGameState();
    // La pagina conosce l'avversario tramite DuelSession; lo stato di regola
    // conserva solo l'id opzionale per consentire a IA Hard un playbook. Il
    // giocatore umano non riceve identità IA. Assenza = fallback generale.
    if (window.DuelSession && DuelSession.opponent) {
        gameState.personaggioPerPosto.bot = DuelSession.opponent.id || null;
    }
    if (!document.getElementById('playerHand') || !document.getElementById('playerFieldBoard') || !document.getElementById('botFieldBoard')) {
        console.error('Elementi del campo mancanti nella pagina.');
        return;
    }
    // Multiplayer a passo comune (js/engine/passo-comune.js,
    // js/multiplayer/mp-passo-comune.js): prima di tutto i due client si
    // scambiano i mazzi (e il seme), poi preparano lo STESSO duello. Non
    // esiste più un secondo motore di rete: una versione incompatibile si
    // ferma con un messaggio chiaro, senza iniziare una partita divergente.
    if (window.MULTIPLAYER_MODE) {
        if (!window.MpPassoComune || typeof PassoComune === 'undefined') {
            mostraErroreProtocolloMultiplayer('I componenti Multiplayer non sono aggiornati. Ricarica il gioco.');
            return;
        }
        const mioMazzo = (window.SaveManager && SaveManager.getActiveDeck())
            || (typeof buildBalancedDemoDeckSpec === 'function' ? buildBalancedDemoDeckSpec() : null);
        MpPassoComune.prepara(mioMazzo).then((partita) => {
            Tavolo.imposta({ player: 'persona', bot: 'remoto' });
            PassoComune.avvia({ invia: MpPassoComune.invia });
            PassoComune.preparaDuello(partita);
            MpPassoComune.motoreAvviato();
            avviaDuelloPreparato();
        }, (err) => {
            console.error('Duello Multiplayer non avviato:', err);
            mostraErroreProtocolloMultiplayer('Impossibile avviare il duello: l\'avversario o il server usa una versione non compatibile.');
        });
        return;
    }
    preparaManiIniziali();
    return avviaDuelloPreparato(opzioniAvvio);
}

/** Arresto leggibile prima dell'avvio, senza lasciare un campo muto. */
function mostraErroreProtocolloMultiplayer(messaggio) {
    let banner = document.getElementById('mpConnectionBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'mpConnectionBanner';
        banner.className = 'mp-opponent-left-banner';
        document.body.appendChild(banner);
    }
    banner.innerHTML = '';
    const testo = document.createElement('span');
    testo.textContent = messaggio;
    const torna = document.createElement('a');
    torna.href = 'index.html';
    torna.textContent = 'Torna al Menu';
    banner.append(testo, torna);
}

/** Chi comincia e le mani iniziali, fuori dal passo comune (vedi initGame). */
function preparaManiIniziali() {
    if (window.MULTIPLAYER_MODE && typeof window.MP_startingRole === 'string') {
        // In multiplayer "player" significa sempre "io" e "bot" significa
        // sempre "l'avversario": chi inizia per primo lo decide il server
        // al momento dell'accoppiamento nella stanza.
        gameState.currentPlayer = window.MP_startingRole;
    } else if (typeof window.DUEL_STARTING_ROLE === 'string') {
        // Esito della morra cinese pre-duello (js/ui/duel-rps.js, lanciata
        // da DuelSession.start()): stesso identico punto d'innesto del
        // Multiplayer qui sopra, così il resto di initGame() non ha
        // bisogno di sapere COME si è deciso chi comincia.
        gameState.currentPlayer = window.DUEL_STARTING_ROLE;
    }
    drawCardsToHand('player', 5);
    drawCardsToHand('bot', 5);
    if (!window.MULTIPLAYER_MODE) {
        // La carta in più del primo turno va a CHI COMINCIA, chiunque sia:
        // da quando la morra cinese può assegnare il primo turno al bot
        // (js/ui/duel-rps.js), darla sempre al giocatore lo avrebbe
        // avvantaggiato proprio nel caso in cui ha perso il sorteggio.
        drawCardsToHand(gameState.currentPlayer, 1);
    }
}

/** Mani già in mano e primo giocatore deciso: timer, telecamera, primo turno. */
function avviaDuelloPreparato(opzioniAvvio) {
    startDuelTimer();
    updateUI();
    // Ogni carta della mano appena renderizzata resta invisibile (vedi
    // .card.pending-deal in CSS) finché la telecamera non ha finito di
    // "atterrare" sul campo: solo a quel punto dealHandWithStagger() le
    // rivela una alla volta, non tutte insieme.
    markHandCardsPending();

    const avviaIngresso = () => playCameraIntro(() => {
        // L'avanzamento di fase parte SOLO dopo che l'ultima carta della
        // mano ha finito di comparire, mai in sovrapposizione col dealing.
        dealHandWithStagger(() => {
            addToLog(gameState.currentPlayer === 'player'
                ? '🎮 Duello iniziato! È il tuo turno. Inizia la Draw Phase.'
                : '🎮 Duello iniziato! Turno dell\'avversario.');
            // Chi guida il primo turno dipende da chi controlla il posto
            // (js/engine/tavolo.js), come in changeTurn().
            const primo = gameState.currentPlayer;
            const controllore = Tavolo.controllore(primo);
            // A passo comune anche il primo turno del posto remoto si gioca
            // di qua (come in changeTurn): le fasi avanzano da sole fino
            // alla Main Phase 1, poi arrivano i suoi comandi.
            const remotoAPassoComune = controllore === 'remoto' && typeof PassoComune !== 'undefined' && PassoComune.attivo();
            if (controllore === 'persona' || remotoAPassoComune) {
                dopoPausaDuello(enterDrawPhase, 500);
            } else if (controllore === 'ia') {
                // L'IA che comincia va avviata a mano: il suo turno
                // normalmente parte da changeTurn() (vedi l'annuncio di
                // cambio turno), che al PRIMO turno non è ancora mai stato
                // chiamato. Senza questo, dopo una morra cinese persa la
                // partita restava ferma per sempre — in Multiplayer no,
                // perché lì a muovere è l'avversario remoto.
                dopoPausaDuello(() => turnoIA(primo), 1200);
            }
        });
    });
    if (opzioniAvvio && opzioniAvvio.deferCameraIntro) return avviaIngresso;
    avviaIngresso();
    return null;
}

/**
 * Zoomata 3D d'apertura: il campo "atterra" dall'alto nell'inquadratura
 * definitiva (dall'alto, piatta). Durata legata alla keyframe CSS
 * cameraIntroZoomOut (1700ms) — se cambi una, aggiorna anche l'altra.
 */
function playCameraIntro(onDone) {
    const container = document.querySelector('.game-container');
    const completa = () => {
        if (window.FieldAmbience && typeof FieldAmbience.riprendi === 'function') {
            FieldAmbience.riprendi('apertura-duello');
        }
        if (typeof onDone === 'function') onDone();
    };
    if (!container) { completa(); return; }
    // `window.DUEL_FAST_OPENING` salta l'intro: lo imposta SOLO la suite
    // di test (tests/helpers/harness.js), mai un utente vero — stesso
    // meccanismo di opt-out già usato per il gate di accesso
    // (AUTH_GATE_SKIP) e per la morra cinese (DUEL_RPS_SKIP).
    //
    // Non è un vezzo: i test devono aspettare che la sequenza di apertura
    // finisca prima di manipolare lo stato (vedi waitForOpeningCascade in
    // harness.js), e fra intro e distribuzione della mano sono ~3,5
    // secondi MOLTIPLICATI per ogni spec della suite. Il gioco vero non
    // cambia di una virgola.
    if (window.DUEL_FAST_OPENING) { completa(); return; }
    const DURATION = 1700;
    container.classList.add('camera-intro');
    setTimeout(() => {
        container.classList.remove('camera-intro');
        completa();
    }, DURATION);
}

/**
 * Marca ogni carta attualmente in mano come "in attesa" (invisibile):
 * chiamata subito dopo il render iniziale, PRIMA che dealHandWithStagger()
 * le riveli una alla volta. La classe vive sulla singola carta apposta —
 * se vivesse sul contenitore .hand, rimuoverla farebbe comparire tutte le
 * carte insieme invece che in sequenza.
 */
function markHandCardsPending() {
    const handEl = document.getElementById('playerHand');
    if (!handEl) return;
    handEl.querySelectorAll('.card').forEach((cardEl) => cardEl.classList.add('pending-deal'));
}

/** Ritmo della distribuzione carte, condiviso da ogni pescata. */
const DEAL_STAGGER_MS = 300;
const DEAL_REVEAL_MS = 320;

/**
 * Ritmo compresso per la SOLA mano iniziale, quando
 * `window.DUEL_FAST_OPENING` è attivo (lo imposta solo la suite di test
 * — vedi il commento su quel flag in playCameraIntro).
 *
 * Vale SOLO per l'apertura, MAI per le pescate in partita, ed è una
 * distinzione imparata rompendo un test: comprimendo anche quelle,
 * `pescata-una-carta-alla-volta.spec.js` non poteva più distinguere due
 * carte che compaiono in sequenza da due che compaiono insieme — cioè
 * esattamente il bug che quel test esiste per sorvegliare. Un acceleratore
 * di test non deve mai rendere inosservabile ciò che un altro test misura.
 */
const FAST_DEAL = { stagger: 10, reveal: 20 };

/**
 * Distribuisce una alla volta le carte passate: le NASCONDE tutte
 * subito, poi ne rivela una ogni 0.3s con l'effetto di pescata.
 * `onComplete` scatta solo dopo che l'ultima ha finito.
 *
 * "Le nasconde tutte subito" è il punto, ed è un bug reale segnalato
 * dall'utente: pescando 2 carte con un effetto (es. Vaso dell'Avidità)
 * si vedevano comparire ENTRAMBE di colpo, e solo dopo partiva
 * l'animazione di pescata, una alla volta. Il motivo è che queste
 * funzioni girano per forza DOPO updateUI() — che è il momento in cui
 * le carte entrano davvero nel DOM — quindi a quel punto sono già
 * visibili. La mano iniziale non aveva il problema solo perché
 * marcava le sue carte `pending-deal` per conto suo; le altre due
 * pescate no. Ora quel passaggio è qui dentro, quindi vale per tutte
 * e tre senza che nessun chiamante debba ricordarsene.
 *
 * Il marcamento è SINCRONO, nello stesso giro in cui la funzione viene
 * chiamata: un setTimeout, anche a 0ms, lascerebbe passare un
 * fotogramma in cui le carte sono visibili — ed è esattamente il lampo
 * che si voleva togliere.
 */
function dealCardsWithStagger(cards, onComplete, ritmo) {
    const done = typeof onComplete === 'function' ? onComplete : function () {};
    const passo = (ritmo && ritmo.stagger) || DEAL_STAGGER_MS;
    const durataRivelazione = (ritmo && ritmo.reveal) || DEAL_REVEAL_MS;
    const elenco = Array.from(cards || []);
    elenco.forEach((cardEl) => cardEl.classList.add('pending-deal'));
    elenco.forEach((cardEl, index) => {
        setTimeout(() => {
            cardEl.classList.remove('pending-deal');
            cardEl.classList.add('deal-in');
            if (window.FX) FX.playDrawEffect(cardEl);
            if (window.SFX) SFX.draw();
            setTimeout(() => cardEl.classList.remove('deal-in'), durataRivelazione);
        }, index * passo);
    });
    const durataTotale = elenco.length > 0 ? (elenco.length - 1) * passo + durataRivelazione : 0;
    setTimeout(done, durataTotale);
}

/**
 * Rivela le carte della mano iniziale una alla volta — così l'apertura
 * di mano sembra un vero e proprio dealing invece di comparire tutta
 * insieme. `onComplete` scatta SOLO dopo che l'ultima carta ha finito di
 * comparire, mai prima: chi chiama questa funzione (initGame) aspetta
 * onComplete prima di far partire la Draw Phase, così l'avanzamento di
 * fase non si sovrappone mai al dealing.
 */
function dealHandWithStagger(onComplete) {
    const done = typeof onComplete === 'function' ? onComplete : function () {};
    const handEl = document.getElementById('playerHand');
    if (!handEl) { done(); return; }
    // Solo QUI si usa l'eventuale ritmo compresso: è l'apertura. Le
    // pescate in partita restano sempre a velocità piena — vedi FAST_DEAL.
    dealCardsWithStagger(handEl.querySelectorAll('.card'), done, window.DUEL_FAST_OPENING ? FAST_DEAL : null);
}

/**
 * Anima il numero dei LP con un "conteggio" fluido invece di scattare
 * istantaneamente al nuovo valore (effetto contatore, stile Master Duel),
 * più un impulso di colore rosso (danno) o verde (recupero) sul contenitore.
 */
function animateLifePoints(el, newValue) {
    if (!el) return;
    const container = el.closest('.life-points');
    const oldValue = parseInt(el.dataset.lpValue ?? el.textContent, 10) || 0;
    el.dataset.lpValue = newValue;
    if (oldValue === newValue) {
        el.textContent = newValue;
        return;
    }
    if (container) {
        container.classList.remove('lp-hit', 'lp-heal');
        void container.offsetWidth;
        container.classList.add(newValue < oldValue ? 'lp-hit' : 'lp-heal');
        setTimeout(() => container.classList.remove('lp-hit', 'lp-heal'), 1000);
    }
    // Conteggio quasi lineare (leggero ease-out solo in coda) invece che
    // una decelerazione immediata: si legge come i LP che "ticchettano"
    // verso il basso uno via l'altro, come nell'anime, non come un
    // semplice fade tra due numeri.
    const duration = 1000;
    const start = performance.now();
    const step = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 2);
        const current = Math.round(oldValue + (newValue - oldValue) * eased);
        el.textContent = Math.max(current, 0);
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

function renderLifePoints() {
    const playerLPEl = document.getElementById('playerLP');
    const botLPEl = document.getElementById('botLP');
    animateLifePoints(playerLPEl, gameState.playerLP);
    animateLifePoints(botLPEl, gameState.botLP);

    const playerInfo = document.getElementById('playerInfo');
    const botInfo = document.getElementById('botInfo');
    if (playerInfo) playerInfo.classList.toggle('active-turn', gameState.currentPlayer === 'player');
    if (botInfo) botInfo.classList.toggle('active-turn', gameState.currentPlayer === 'bot');

    renderBanishedBadge('player');
    renderBanishedBadge('bot');
}

/**
 * Aggiorna il badge "Zona Bandite" (duelMonstersCore.html, dentro
 * .player-info#playerInfo/#botInfo) di `owner`: conteggio + visibilità
 * (nascosto finché vuota) + click per aprire lo stesso visualizzatore già
 * usato per il Cimitero (informazione pubblica per entrambi i lati, vedi
 * createSlotElement in questo file). Chiamata da renderLifePoints() ad
 * ogni render, così resta sempre in sincrono con
 * gameState.playerBanished/botBanished.
 */
function renderBanishedBadge(owner) {
    const badge = document.getElementById(owner === 'player' ? 'playerBanishedBadge' : 'botBanishedBadge');
    const countEl = document.getElementById(owner === 'player' ? 'playerBanishedCount' : 'botBanishedCount');
    if (!badge || !countEl) return;
    const banished = Tavolo.banditi(owner);
    countEl.textContent = banished.length;
    badge.classList.toggle('has-cards', banished.length > 0);
    badge.onclick = () => {
        if (banished.length === 0 || !window.DuelEngineUI) return;
        window.DuelEngineUI.openCardListPicker(banished, {
            title: owner === 'player' ? '🌀 Zona Bandite' : '🌀 Zona Bandite dell\'avversario',
            text: `${banished.length} cart${banished.length === 1 ? 'a' : 'e'} bandit${banished.length === 1 ? 'a' : 'e'}.`,
            selectable: false
        });
    };
}

// La metà "disegno" di updateUI (js/engine/canale-partita.js): updateUI
// ricalcola gli effetti continui, emette 'ridisegna' (che arriva qui) e
// solo dopo controlla se il duello è finito — lo stesso ordine di quando
// le tre cose stavano in una funzione sola.
function ridisegnaDuello() {
    renderLifePoints();
    renderPlayerHand();
    renderBotHand();
    renderFields();
    renderEquipLinks();
    // Gli ologrammi sopra i mostri scoperti (js/ui/monster-hologram.js,
    // solo con "Dettagli video: Alti"). Va DOPO renderFields, che ha
    // appena ricostruito le carte da cui legge le posizioni — ma non
    // ridisegna nulla: aggiorna solo ciò che è cambiato, vedi lì il
    // perché vive fuori dal Terreno.
    if (window.MonsterHolograms) MonsterHolograms.sync();
    // I riscontri dei cambiamenti sul Terreno (js/ui/duel-feedback.js):
    // ATK/DEF che cambiano, carte bandite, Token, cambi di Posizione, Life
    // Point critici. Confronta col ridisegno precedente, quindi va anche lui
    // DOPO renderFields.
    if (window.DuelFeedback) DuelFeedback.sync();
    updatePhaseIndicator();
}

/**
 * Disegna un collegamento visivo permanente (linea tratteggiata dorata,
 * animata) tra ogni Carta Equipaggiamento scoperta in campo e il mostro a
 * cui è agganciata — richiesta esplicita dell'utente, prima assente del
 * tutto (le due carte non avevano alcun indizio visivo di essere
 * collegate). Va richiamata DOPO renderFields(): quella funzione
 * ricostruisce l'INTERO Terreno da zero ad ogni chiamata (vedi il
 * commento su renderFields), quindi ogni `getBoundingClientRect()` preso
 * PRIMA di quella ricostruzione punterebbe a nodi DOM ormai rimossi.
 * Rilegge `slot.card.equippedToUid` (già scritto da ogni Carta
 * Equipaggiamento di questo motore in `activate()`, vedi card-effects.js)
 * per ENTRAMBI i lati — un equip può restare agganciato a un mostro
 * dell'avversario (es. Flamberge del Male Infranto, id 727). Selettore
 * `[data-uid="..."]` sullo stesso attributo già scritto da ogni carta
 * renderizzata (card-renderer.js) — nessun nuovo hook di rendering
 * necessario, riusa un dato già presente nel DOM.
 * BUG REALE segnalato dall'utente e corretto qui: la carta funzionava
 * (la linea SVG veniva creata con le coordinate giuste, verificato) ma
 * era di fatto invisibile nel caso più comune — equip e mostro nella
 * STESSA colonna, slot verticalmente adiacenti: 1) la linea centro-a-
 * centro passava ESATTAMENTE sopra il badge ATK/DEF (.field-stats-badge,
 * anch'esso centrato) che la copriva quasi del tutto, e 2) un tratto
 * sottile (2.5px) e un dash-array fitto (3 7) restavano impercettibili
 * su un segmento lungo poche decine di px contro uno sfondo già
 * affollato. Corretto spostando i due punti di aggancio verso il bordo
 * SINISTRO di ciascuna carta (28% della larghezza, non il centro) per
 * scansare il badge, ispessendo il tratto e aggiungendo due piccoli
 * cerchi pieni alle estremità — restano un indizio chiaro anche quando
 * il segmento è cortissimo.
 */
function renderEquipLinks() {
    const svg = document.getElementById('equip-links-svg');
    if (!svg) return;
    // Guardia difensiva trovata con un audit UX mobile: il listener
    // 'resize' qui sotto chiama questa funzione anche PRIMA che
    // gameState sia stato popolato dal boot del duello (es. un resize
    // scatenato dalla rotazione schermo o dall'apertura della tastiera
    // virtuale, mobile, arrivato prima ancora che duel-sandbox.js finisca
    // di girare) — senza questo controllo, gameState.playerSTField
    // sarebbe undefined e .forEach lancerebbe un errore non gestito.
    if (!gameState || !gameState.playerSTField || !gameState.botSTField) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const SVG_NS = 'http://www.w3.org/2000/svg';
    // Le coppie equip->bersaglio viste in QUESTO render, per confrontarle
    // a fine funzione con quelle del precedente e capire quali agganci
    // sono nuovi — vedi il commento più sotto, dentro il ciclo.
    const nuoveCoppieEquip = new Set();
    ['player', 'bot'].forEach((owner) => {
        const stField = Tavolo.magieTrappole(owner);
        stField.forEach((slot) => {
            if (!slot || slot.isFaceDown || !slot.card || !slot.card.equippedToUid) return;
            const equipEl = findFieldCardElementByUid(slot.card.uid);
            const targetEl = findFieldCardElementByUid(slot.card.equippedToUid);
            if (!equipEl || !targetEl) return;
            const r1 = equipEl.getBoundingClientRect();
            const r2 = targetEl.getBoundingClientRect();
            // Un rect a 0x0 (elemento non ancora disposto dal layout, es.
            // display:none transitorio) produrrebbe una linea invisibile
            // nel punto sbagliato invece di una vera assenza — meglio
            // saltarla che disegnarla male.
            if ((r1.width === 0 && r1.height === 0) || (r2.width === 0 && r2.height === 0)) return;
            const x1 = r1.left + r1.width * 0.28;
            const y1 = r1.top + r1.height / 2;
            const x2 = r2.left + r2.width * 0.28;
            const y2 = r2.top + r2.height / 2;
            const line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('class', 'equip-link-line');
            svg.appendChild(line);
            [[x1, y1], [x2, y2]].forEach(([cx, cy]) => {
                const dot = document.createElementNS(SVG_NS, 'circle');
                dot.setAttribute('cx', cx);
                dot.setAttribute('cy', cy);
                dot.setAttribute('r', 3.5);
                dot.setAttribute('class', 'equip-link-dot');
                svg.appendChild(dot);
            });

            // Aggancio APPENA avvenuto: un'ondata di luce corre dalla
            // Carta Equipaggiamento al mostro, così si vede CHE COSA sta
            // potenziando cosa. Prima l'equip si limitava a comparire in
            // campo e la linea tratteggiata appariva dal nulla: bisognava
            // accorgersene da soli.
            //
            // Il momento dell'aggancio si ricava confrontando le coppie
            // equip->bersaglio con quelle del render precedente, NON
            // agganciandosi alle singole carte: ogni Carta
            // Equipaggiamento scrive `equippedToUid` per conto suo dentro
            // il proprio activate() (sono decine in card-effects.js), e
            // metterci l'animazione una per una vorrebbe dire
            // dimenticarsene in metà — oltre a non valere per quelle che
            // verranno aggiunte domani. Stesso principio già usato per le
            // pile che ricevono una carta.
            const coppia = `${slot.card.uid}->${slot.card.equippedToUid}`;
            nuoveCoppieEquip.add(coppia);
            if (!equipLinksAtLastRender.has(coppia) && window.FX && typeof FX.playEquipAttach === 'function') {
                FX.playEquipAttach(x1, y1, x2, y2, targetEl);
            }
        });
    });

    // Le coppie di QUESTO render diventano il riferimento per il
    // prossimo: così l'ondata parte una volta sola, non ad ogni
    // updateUI finché l'equip resta agganciato.
    equipLinksAtLastRender.clear();
    nuoveCoppieEquip.forEach((c) => equipLinksAtLastRender.add(c));
}

/**
 * Pila della Catena — richiesta esplicita dell'utente ("gestisci meglio
 * lato UI le catene di botta e risposta"): prima l'unico segnale visivo
 * di una Chain in corso era il pulse "carta a centro schermo" (una carta
 * alla volta, sparisce subito) più una riga nel log (pannello chiuso per
 * default) — niente che facesse capire A COLPO D'OCCHIO quanti Link
 * fossero già impilati, di chi, o in che ordine si sarebbero risolti.
 * Richiamata da duel-engine.js (mai da qui verso di lui — game-flow.js
 * resta senza dipendenze dal motore) ad ogni link aggiunto
 * (openActivationWindow/askNextRound) e ad ogni link rimosso da
 * gameState.chain.links per risolversi (resolveChain).
 * `resolvingLink` (opzionale): il link APPENA rimosso da chain.links
 * (già un pop() vero, non un residuo) il cui pulse sta girando ORA — va
 * mostrato comunque, evidenziato, per tutta la durata del pulse, quindi
 * viene aggiunto qui SOLO per la visualizzazione (mai reinserito
 * nell'array vero: un primo tentativo che ritardava il pop() reale fino
 * a fine pulse ha rotto un test esistente — un resolveChain() rientrante,
 * scatenato dal ciclo naturale della pagina che tocca la stessa Chain
 * condivisa, vedeva lo stesso link ancora in cima e interferiva con la
 * sua risoluzione). `gameState.chain.links[i].linkNumber` (assegnato una
 * volta sola quando il link viene aggiunto, mai ricalcolato dall'indice
 * nell'array — che cambia ad ogni pop durante la risoluzione) resta
 * stabile per tutta la vita del link, `resolvingLink` incluso.
 */
function renderChainStack(resolvingLink) {
    const container = document.getElementById('chainStack');
    if (!container) return;
    const chain = gameState.chain;
    const links = (chain && chain.links) || [];
    const displayLinks = resolvingLink ? [...links, resolvingLink] : links;
    if (!chain || (!chain.active && !resolvingLink) || displayLinks.length === 0) {
        container.classList.remove('show');
        container.innerHTML = '';
        return;
    }
    container.innerHTML = '';

    // Intestazione: il simbolo della catena (🔗) più il conteggio dei Link.
    // Senza, la pila di miniature non direbbe da sé COSA sia — richiesta
    // esplicita dell'utente ("rendile più fighe con simbolo di una catena
    // con effetto").
    const head = document.createElement('div');
    head.className = 'chain-stack-head';
    head.innerHTML = '<span class="chain-stack-sigil">🔗</span>'
        + `<span class="chain-stack-title">${resolvingLink ? 'RISOLUZIONE CATENA' : 'CATENA IN CORSO'}</span>`
        + `<span class="chain-stack-count">${displayLinks.length}</span>`;
    container.appendChild(head);

    // Colonna in stile Master Duel: i Link si IMPILANO uno sopra l'altro
    // invece di allinearsi in riga. `displayLinks` è in ordine di
    // attivazione (Link 1 per primo), ma la colonna è `column-reverse` in
    // CSS — quindi l'ULTIMO attivato finisce in cima, che è esattamente
    // dove lo sguardo lo cerca: è il prossimo a risolversi (Chain LIFO).
    const row = document.createElement('div');
    row.className = 'chain-stack-row';
    container.appendChild(row);

    displayLinks.forEach((link, i) => {
        // Fra un Link e il successivo c'è un tratto di CATENA vero (due
        // maglie incastrate): è il pezzo che rende leggibile "questi non
        // sono N effetti separati, sono agganciati l'uno all'altro". Il
        // tratto che regge il Link in risoluzione si illumina e vibra: è
        // la maglia che sta per spezzarsi.
        if (i > 0) {
            const anello = document.createElement('div');
            anello.className = 'chain-link-ring'
                + (displayLinks[i] === resolvingLink ? ' breaking' : '');
            anello.innerHTML = '<i></i><i></i>';
            row.appendChild(anello);
        }
        const item = document.createElement('div');
        const isResolving = link === resolvingLink;
        item.className = 'chain-stack-item'
            + (isResolving ? ' resolving' : '')
            + (link.owner === 'bot' ? ' chain-owner-bot' : ' chain-owner-player');
        item.title = link.card.name;
        // Profondita' leggermente alternata: i Link sembrano carte
        // appoggiate su un espositore olografico, non miniature piatte.
        // Il Link in risoluzione azzera questa inclinazione via CSS.
        item.style.setProperty('--chain-yaw', `${i % 2 === 0 ? -11 : 11}deg`);
        item.style.setProperty('--chain-delay', `${Math.min(i * 45, 180)}ms`);

        // Numero del Link in un gettone rotondo a lato della miniatura,
        // come in Master Duel — al posto dell'etichetta "Link N" sotto la
        // carta, che rubava spazio e si leggeva peggio.
        const badge = document.createElement('span');
        badge.className = 'chain-stack-badge';
        badge.textContent = link.linkNumber || (i + 1);

        const thumb = document.createElement('div');
        thumb.className = 'chain-stack-thumb';
        if (typeof createCardElement === 'function') {
            const mini = createCardElement(link.card);
            mini.style.setProperty('--card-w', 'var(--chain-card-w)');
            mini.style.setProperty('--card-h', 'calc(var(--chain-card-w) / var(--card-ratio))');
            thumb.appendChild(mini);
        }

        // Nome della carta accanto alla miniatura: in Master Duel ogni
        // anello della catena si legge, non si tira a indovinare da
        // un'immagine grande mezzo centimetro.
        const nome = document.createElement('span');
        nome.className = 'chain-stack-name';
        nome.textContent = link.card.name;
        const proprietario = document.createElement('span');
        proprietario.className = 'chain-stack-owner';
        proprietario.textContent = link.owner === 'bot' ? 'AVVERSARIO' : 'TU';

        item.appendChild(document.createElement('span')).className = 'chain-stack-energy';
        item.appendChild(badge);
        item.appendChild(thumb);
        const meta = document.createElement('span');
        meta.className = 'chain-stack-meta';
        meta.appendChild(nome);
        meta.appendChild(proprietario);
        item.appendChild(meta);
        row.appendChild(item);
    });
    container.classList.add('show');
}

function renderFields() {
    if (window.CardRenderer) CardRenderer.iniziaImmaginiDifferite();
    try {
    const createRow = (owner, slots, slotType, specialConfig, isMonsterRow, isMirrored = false) => {
        const row = document.createElement('div');
        row.className = 'field-row';

        // La zona Magia Terreno (specialConfig.firstZone.zone === 'fieldSpell')
        // è l'unica zona "speciale" che accetta davvero una carta giocabile
        // dal giocatore (le altre — Fusion/Deck/Cimitero — restano pura
        // informazione, mai un bersaglio di piazzamento): resta "special"
        // per la STILE CSS (.special-slot, stesso aspetto di Fusion/Deck),
        // ma il suo onclick viene sovrascritto qui sotto per passare
        // comunque da handleSlotClick — e, se occupata, mostra la carta
        // vera al posto della sola etichetta testuale "Terreno".
        const isFieldSpellZone = specialConfig.firstZone.zone === 'fieldSpell';
        const fieldSpellSlotState = isFieldSpellZone ? (Tavolo.magiaTerreno(owner)) : null;
        const firstSpecial = createSlotElement(owner, specialConfig.firstZone.type, -1, {
            special: true,
            zone: specialConfig.firstZone.zone,
            label: fieldSpellSlotState ? null : specialConfig.firstZone.label,
            count: specialConfig.firstZone.count
        });
        if (isFieldSpellZone) {
            firstSpecial.onclick = () => handleSlotClick(owner, 'field-spell', -1);
        }
        if (fieldSpellSlotState) {
            const visuallyFaceDown = fieldSpellSlotState.isFaceDown;
            const fieldSpellCardEl = createCardElement(fieldSpellSlotState.card, visuallyFaceDown, 'attack');
            fieldSpellCardEl.onclick = (event) => {
                event.stopPropagation();
                if (!dragState) {
                    handleCardClick(fieldSpellSlotState.card, 'field-spell', -1, owner, visuallyFaceDown);
                }
            };
            fieldSpellCardEl.onmouseenter = () => {
                if (dragState || !canInspectCardOnHover() || isGameplaySelectionActive()) return;
                updateCardInfoPanel(fieldSpellSlotState.card, { sourceType: 'field-spell', sourceOwner: owner, isFaceDown: visuallyFaceDown });
            };
            firstSpecial.appendChild(fieldSpellCardEl);
            enableFieldCardInspectionGesture(fieldSpellCardEl, fieldSpellSlotState.card, {
                sourceType: 'field-spell', sourceOwner: owner, isFaceDown: visuallyFaceDown
            });
        }
        const secondSpecial = createSlotElement(owner, specialConfig.secondZone.type, -1, {
            special: true,
            zone: specialConfig.secondZone.zone,
            label: specialConfig.secondZone.label,
            count: specialConfig.secondZone.count
        });

        if (!isMirrored) {
            row.appendChild(firstSpecial);
        } else {
            row.appendChild(secondSpecial);
        }

        slots.forEach((slot, index) => {
            const slotEl = createSlotElement(owner, slotType, index);
            // Spada di luce verde INFILZATA nel terreno, su OGNI zona
            // Mostro della fila colpita da Spada Rivelatrice, occupata o
            // no — la STESSA sagoma CSS dell'animazione di attivazione
            // (.field-sword-mark riusa il clip-path/gradiente di
            // .fx-sword-beam in effects.css), ma ferma e senza scadenza
            // propria: va ricreata ad ogni render finché
            // DuelEngine.isRevealedFor(owner) resta vero (dura quanto dura
            // l'effetto, 3 turni), esattamente come .monster-row-revealed
            // sulla fila (vedi sotto). Il secondo controllo
            // (revealedSwordsLanded) evita che compaia PRIMA che le spade
            // mobili dell'animazione di attivazione siano davvero atterrate
            // — altrimenti si vedrebbe questo segno fisso apparire
            // all'istante, PRIMA ancora del "colpo di scena" della caduta
            // (impostato da card-effects.js/id 8 via FX.playSwordsOfRevealingLight).
            if (isMonsterRow && window.DuelEngine && DuelEngine.isRevealedFor(owner) && gameState.revealedSwordsLanded && gameState.revealedSwordsLanded[owner]) {
                const swordMark = document.createElement('div');
                swordMark.className = 'field-sword-mark';
                swordMark.innerHTML = '<span class="fx-sword-blade"></span><span class="fx-sword-guard"></span><span class="fx-sword-hilt"></span><span class="fx-sword-gem"></span>';
                // Spada di luce in WebGL al posto delle forme CSS; senza WebGL restano quelle.
                if (window.IconePosizione) IconePosizione.montaSpada(swordMark);
                slotEl.appendChild(swordMark);
            }
            if (slot) {
                // Un mostro coperto resta "coperto" per le regole (flip,
                // reveal-on-attack, ecc. — vedi js/engine/actions.js), ma se
                // l'avversario ha un effetto tipo Spada Rivelatrice attivo
                // contro il suo proprietario lo mostriamo scoperto A
                // SCHERMO: solo la resa visiva cambia, slot.isFaceDown
                // resta true ovunque nella logica di gioco.
                const visuallyFaceDown = slot.isFaceDown && !(isMonsterRow && window.DuelEngine && DuelEngine.isRevealedFor(owner));
                const cardEl = createCardElement(slot.card, visuallyFaceDown, slot.position);
                cardEl.onclick = (event) => {
                    event.stopPropagation();
                    if (!dragState) {
                        handleCardClick(slot.card, slotType, index, owner, visuallyFaceDown);
                    }
                };
                cardEl.onmouseenter = () => {
                    if (dragState || !canInspectCardOnHover() || isGameplaySelectionActive()) return;
                    updateCardInfoPanel(slot.card, { sourceType: slotType, sourceOwner: owner, isFaceDown: visuallyFaceDown });
                };
                if (isMonsterRow && owner === 'player' && gameState.phase === 'battle' && !slot.hasAttacked && slot.position === 'attack' && !(window.DuelEngine && DuelEngine.cannotAttack('player'))) {
                    cardEl.classList.add('can-attack');
                    cardEl.onpointerdown = (event) => startAttackDrag(event, index);
                }
                slotEl.appendChild(cardEl);
                enableFieldCardInspectionGesture(cardEl, slot.card, {
                    sourceType: slotType, sourceOwner: owner, isFaceDown: visuallyFaceDown
                });
                // Richiamo degli Infestati (id 136): il legame è uno stato
                // vero della Trappola Continua (targetUid), non una durata
                // grafica. Ricrearlo da quello stato a ogni render lo fa
                // sparire automaticamente se mostro o Trappola lasciano il
                // campo. L'inclinazione punta approssimativamente allo slot
                // M/T sorgente, evitando una catena verticale generica.
                if (isMonsterRow) {
                    const hauntedIndex = Tavolo.magieTrappole(owner).findIndex((stSlot) => stSlot
                        && !stSlot.isFaceDown
                        && stSlot.card.id === 136
                        && stSlot.card.targetUid === slot.card.uid);
                    if (hauntedIndex !== -1) {
                        const chain = document.createElement('div');
                        chain.className = `call-haunted-link call-haunted-link--${owner}`;
                        chain.style.setProperty('--haunted-link-angle', `${(hauntedIndex - index) * 7}deg`);
                        chain.setAttribute('aria-hidden', 'true');
                        slotEl.appendChild(chain);
                    }
                    // Incantesimo Ombra (id 439): le catene devono vivere
                    // esattamente quanto il legame reale della Trappola.
                    // La sorgente è normalmente sul lato opposto al mostro,
                    // quindi cerchiamo entrambi i posti invece di assumere
                    // che appartenga allo stesso proprietario del bersaglio.
                    let shadowSource = null;
                    Tavolo.ordine().some((sourceOwner) => {
                        const sourceIndex = Tavolo.magieTrappole(sourceOwner).findIndex((stSlot) => stSlot
                            && !stSlot.isFaceDown
                            && stSlot.card.id === 439
                            && stSlot.card.targetUid === slot.card.uid);
                        if (sourceIndex === -1) return false;
                        shadowSource = { owner: sourceOwner, index: sourceIndex };
                        return true;
                    });
                    if (shadowSource) {
                        const bind = document.createElement('div');
                        bind.className = `shadow-spell-link shadow-spell-link--${owner}`;
                        bind.style.setProperty('--shadow-link-angle', `${(shadowSource.index - index) * 6}deg`);
                        bind.setAttribute('aria-hidden', 'true');
                        bind.innerHTML = '<i></i><i></i><i></i><b></b>';
                        slotEl.appendChild(bind);
                    }
                    const spellbinding = Tavolo.ordine().some((sourceOwner) => Tavolo.magieTrappole(sourceOwner).some((stSlot) => stSlot
                        && !stSlot.isFaceDown && stSlot.card.id === 620 && stSlot.card.targetUid === slot.card.uid));
                    if (spellbinding) {
                        const circle = document.createElement('div');
                        circle.className = 'spellbinding-circle-link';
                        circle.setAttribute('aria-hidden', 'true');
                        circle.innerHTML = '<i></i><i></i><i></i><b></b>';
                        slotEl.appendChild(circle);
                    }
                }
                // ATK/DEF sotto la carta, stile Duel Masters: solo per i
                // mostri SCOPERTI (un mostro coperto non rivela le sue
                // statistiche, a meno che non sia stato reso visibile da
                // un effetto come Spada Rivelatrice). Appesa allo SLOT,
                // non alla carta: .card ha overflow:hidden (vedi
                // js/ui/card.css), quindi un'etichetta che sporge sotto il
                // bordo verrebbe tagliata se fosse figlia della carta stessa.
                if (isMonsterRow && slot.card.type === 'monster' && !visuallyFaceDown) {
                    // ATK/DEF "effettivo" come sulla carta stessa (vedi
                    // js/ui/card-renderer.js): senza DuelEngine.getEffectiveAtk/
                    // getEffectiveDef questo badge mostrava sempre i valori
                    // BASE della carta, ignorando bonus/malus temporanei o
                    // continui — disallineato dalla carta appena sotto, che
                    // invece li rifletteva già correttamente.
                    const hasEffectiveStats = window.DuelEngine && typeof DuelEngine.getEffectiveAtk === 'function';
                    const fsbAtk = hasEffectiveStats ? DuelEngine.getEffectiveAtk(slot.card) : slot.card.attack;
                    const fsbDef = hasEffectiveStats ? DuelEngine.getEffectiveDef(slot.card) : slot.card.defense;
                    const statsBadge = document.createElement('div');
                    statsBadge.className = 'field-stats-badge';
                    statsBadge.innerHTML = `<span class="fsb-atk">${fsbAtk}</span><span class="fsb-sep">/</span><span class="fsb-def">${fsbDef}</span>`;
                    slotEl.appendChild(statsBadge);
                }
                // Segnalini sulla carta (es. id 131 Distruttore/Segnalino
                // Magia, id 139 Guardia di Carte/Segnalino Guardia — vedi
                // la convenzione `card.counters` spiegata in cima a
                // js/engine/card-effects.js): un badge tondo col numero, appeso
                // in alto a destra della carta, generico per QUALUNQUE
                // carta futura che ne usi — non serve insegnare alla UI il
                // nome di ogni singolo tipo di segnalino, solo il conteggio.
                if (!visuallyFaceDown && slot.card.counters > 0) {
                    const counterBadge = document.createElement('div');
                    counterBadge.className = 'field-counter-badge';
                    counterBadge.textContent = slot.card.counters;
                    slotEl.appendChild(counterBadge);
                }
                // Effetto Continua a conto alla rovescia (Spada Rivelatrice
                // id 8, Spade della Luce Occultante id 730, ecc.): bagliore
                // verde "a spade dall'alto" sulla carta + contatore dei
                // turni rimasti, così si vede subito quanto manca prima che
                // l'effetto svanisca da solo. Generico su qualunque carta
                // con def.durationTurns, non più legato al solo id 8.
                if (!isMonsterRow && !slot.isFaceDown && typeof slot.turnsLeft === 'number' && window.DuelEngine && DuelEngine.getDefinition(slot.card.id)?.durationTurns) {
                    cardEl.classList.add('revealing-light-active');
                    const turnsBadge = document.createElement('div');
                    turnsBadge.className = 'field-turns-badge';
                    turnsBadge.textContent = `⏳ ${slot.turnsLeft}`;
                    slotEl.appendChild(turnsBadge);
                }
            }
            row.appendChild(slotEl);
        });

        if (!isMirrored) {
            row.appendChild(secondSpecial);
        } else {
            row.appendChild(firstSpecial);
        }
        // Spada Rivelatrice attiva: le SPADE brillano sopra l'intera fila
        // Mostri del lato colpito (non solo sulla carta che l'ha attivata),
        // così si vede subito CHI non può attaccare ed è scoperto.
        if (isMonsterRow && window.DuelEngine && DuelEngine.isRevealedFor(owner)) {
            row.classList.add('monster-row-revealed');
        }
        // Waboku: una barriera unica dietro l'intera fila Mostri, non un
        // effetto per singola carta. Nasce dallo stato meccanico effettivo
        // e viene quindi rimossa automaticamente dal prossimo render a
        // fine turno o quando onSTDestroyed annulla la protezione.
        if (isMonsterRow && gameState.noBattleDamageFor && gameState.noBattleDamageFor[owner]) {
            row.classList.add('monster-row-waboku');
            const shield = document.createElement('div');
            shield.className = 'waboku-field-shield';
            shield.setAttribute('aria-hidden', 'true');
            shield.innerHTML = '<span class="waboku-shield-core"></span><span class="waboku-shield-ring ring-a"></span><span class="waboku-shield-ring ring-b"></span><span class="waboku-shield-sigil"></span><span class="waboku-shield-spark spark-a"></span><span class="waboku-shield-spark spark-b"></span><span class="waboku-shield-spark spark-c"></span>';
            row.appendChild(shield);
        }
        return row;
    };

    const playerBoard = document.getElementById('playerFieldBoard');
    const botBoard = document.getElementById('botFieldBoard');

    // Le righe si costruiscono SEMPRE da zero, come da sempre — quello
    // che cambia è che non finiscono per forza a schermo: vedi
    // riconciliaBoard qui sotto.
    const righeGiocatore = [];
    const righeBot = [];

    righeGiocatore.push(createRow('player', gameState.playerMonsterField, 'monster', {
        firstZone: { type: 'field-spell', zone: 'fieldSpell', label: 'Terreno' },
        secondZone: { type: 'graveyard', zone: 'graveyard', label: 'Cimitero', count: gameState.playerGraveyard.length }
    }, true));

    righeGiocatore.push(createRow('player', gameState.playerSTField, 'st', {
        firstZone: { type: 'fusion', zone: 'fusion', label: 'Fusion', count: gameState.playerExtraDeck.length },
        secondZone: { type: 'deck', zone: 'deck', label: 'Deck', count: gameState.playerDeckCount }
    }, false));

    righeBot.push(createRow('bot', gameState.botSTField, 'st', {
        firstZone: { type: 'fusion', zone: 'fusion', label: 'Fusion', count: gameState.botExtraDeck.length },
        secondZone: { type: 'deck', zone: 'deck', label: 'Deck', count: gameState.botDeckCount }
    }, false, true));

    righeBot.push(createRow('bot', gameState.botMonsterField, 'monster', {
        firstZone: { type: 'field-spell', zone: 'fieldSpell', label: 'Terreno' },
        secondZone: { type: 'graveyard', zone: 'graveyard', label: 'Cimitero', count: gameState.botGraveyard.length }
    }, true, true));

    // L'evidenziazione dei Tributi si applica alle righe APPENA COSTRUITE,
    // non al DOM già a schermo: se la si aggiungesse dopo, il confronto
    // del render successivo troverebbe sempre una differenza (il nodo
    // vivo ha la classe, quello nuovo no) e ricostruirebbe tutto ad ogni
    // giro proprio mentre stai scegliendo i Tributi.
    if (gameState.pendingTributeSummon) {
        gameState.playerMonsterField.forEach((slot, index) => {
            if (!slot) return;
            const el = righeGiocatore[0].querySelector(`.field-slot[data-owner="player"][data-type="monster"][data-index="${index}"]`);
            if (!el) return;
            el.classList.add('tribute-highlight');
            if (gameState.pendingTributeSummon.selected.includes(index)) {
                el.classList.add('tribute-selected');
            }
        });
    }

    // Firma dello stato di render, prima che caricamenti immagini,
    // compressione dei nomi o FX modifichino classi e stili del DOM vivo.
    [...righeGiocatore, ...righeBot].forEach((riga) => {
        Array.from(riga.children).forEach((casella) => { casella.__renderSignature = firmaRenderStabile(casella); });
    });

    riconciliaBoard(playerBoard, righeGiocatore);
    riconciliaBoard(botBoard, righeBot);
    syncPhaseStepperToFieldWidth();
    } finally {
        if (window.CardRenderer) CardRenderer.terminaImmaginiDifferite();
    }
    if (window.CardRenderer) {
        CardRenderer.caricaImmaginiDifferite(document.getElementById('playerFieldBoard'));
        CardRenderer.caricaImmaginiDifferite(document.getElementById('botFieldBoard'));
    }
}

/**
 * Allinea i bordi del rail delle fasi ai bordi REALI della riga del
 * Terreno. La formula CSS con le stesse variabili e' il fallback prima
 * del primo render; qui si misura il risultato finale perche', su mobile,
 * padding e bordi minimi delle zone speciali possono allargare le tracce
 * Grid di qualche pixel oltre --field-slot-w. La riga stessa e' la fonte
 * di verita': in alcuni layout desktop sporge di pochi pixel dalla scatola
 * interna pur restando dentro la viewport, e il rail deve seguirne gli
 * slot esterni invece di fermarsi prima.
 */
function syncPhaseStepperToFieldWidth() {
    const rail = document.getElementById('phaseStepper');
    const row = document.querySelector('#playerFieldBoard .field-row');
    if (!rail || !row) return;
    const rowRect = row.getBoundingClientRect();
    const rowWidth = rowRect.width;
    if (rowWidth <= 0) return;
    rail.style.width = `${rowWidth}px`;
    const railRect = rail.getBoundingClientRect();
    // `left` su position:relative sposta il rettangolo ma non il suo posto
    // nel layout. Ricavare la posizione base sottraendo l'offset corrente
    // rende questa sincronizzazione idempotente: render e resize possono
    // richiamarla in qualunque ordine senza sommare lo spostamento.
    const currentOffset = Number.parseFloat(rail.style.left) || 0;
    const naturalLeft = railRect.left - currentOffset;
    rail.style.left = `${rowRect.left - naturalLeft}px`;
}

/**
 * Mette a schermo le righe appena costruite RIUSANDO i nodi già presenti
 * ovunque il contenuto sia rimasto identico, invece di svuotare il
 * contenitore e riattaccare tutto (`innerHTML = ''`, come faceva prima).
 *
 * PERCHÉ, misurato su un duello vero lasciato giocare: su 560 caselle
 * ridisegnate solo 39 erano davvero cambiate (il 7%), e 5 render su 20
 * non cambiavano assolutamente nulla. Prima di questa funzione NESSUN
 * nodo del Terreno sopravviveva a un render: 0 su 2115, immagini
 * comprese. Ora ne sopravvive il 76%, e il 96,6% delle immagini.
 *
 * NON È UNA MODIFICA PER LA VELOCITÀ, e non va raccontata così: il JS
 * per render passa anzi da ~0,74 a ~1,19 ms, perché le righe nuove si
 * costruiscono comunque e in più si confrontano. In assoluto è nulla
 * (un render al secondo). Quello che si guadagna è che una carta ferma
 * smette di essere distrutta e ricreata a ogni battito: la sua immagine
 * resta decodificata invece di essere ributtata via, ed è la stessa
 * ricostruzione continua che stava dietro al testo che lampeggiava
 * sulle carte ai cambi fase (mitigato allora con alt="").
 *
 * ATTENZIONE A NON CONCLUDERE TROPPO: questo NON rende ancora sicuro
 * appendere un'animazione lunga a una casella. Un tween che scrive stili
 * inline (GSAP) o aggiunge una classe cambia l'HTML del nodo, quindi al
 * render successivo quel nodo viene sostituito e l'animazione muore,
 * esattamente come prima. Il bagliore del mazzo in js/ui/fx-gsap.js e il
 * livello separato degli ologrammi restano quindi necessari: il vincolo
 * è ridotto, non rimosso.
 *
 * COME SI DECIDE se un nodo si può riusare: confrontando il suo HTML con
 * quello appena costruito, non una lista di campi scritta a mano. È la
 * scelta che rende il meccanismo incapace di mostrare uno stato vecchio:
 * qualunque cosa cambi nel modo di disegnare una casella — oggi o fra
 * dieci carte nuove — cambia anche il suo HTML, quindi il nodo viene
 * sostituito senza che nessuno debba ricordarsi di aggiornare niente.
 *
 * L'unica cosa che l'HTML NON racconta sono i gestori di eventi, che
 * catturano lo `slot` e l'indice del momento: quelli vanno quindi
 * ricopiati sempre dal nodo nuovo a quello vecchio, o un click
 * continuerebbe a parlare di una carta che non è più lì.
 */
function riconciliaBoard(contenitore, nuoveRighe) {
    // Numero di righe diverso (primo render, o layout cambiato): si fa
    // come prima, senza cercare di essere furbi.
    if (contenitore.children.length !== nuoveRighe.length) {
        contenitore.innerHTML = '';
        nuoveRighe.forEach((riga) => contenitore.appendChild(riga));
        return;
    }
    // Fotografia STATICA dei figli di entrambi i lati prima di toccare
    // qualcosa. `children` è una collezione VIVA: spostando una casella
    // nuova dentro la riga vecchia la si toglie da quella nuova, e tutti
    // gli indici successivi slittano di uno. Con il ciclo scritto sulla
    // collezione viva si salta una casella su due — trovato davvero, il
    // Terreno usciva con le zone 0, 2, 4 e le altre sparite.
    const vecchieRighe = Array.from(contenitore.children);
    nuoveRighe.forEach((nuova, i) => {
        const vecchia = vecchieRighe[i];
        const caselleNuove = Array.from(nuova.children);
        const caselleVecchie = Array.from(vecchia.children);
        if (caselleVecchie.length !== caselleNuove.length) {
            contenitore.replaceChild(nuova, vecchia);
            return;
        }
        // La classe della riga cambia da sola (es. monster-row-revealed
        // con Spada Rivelatrice attiva) senza toccare le caselle.
        if (vecchia.className !== nuova.className) vecchia.className = nuova.className;
        caselleNuove.forEach((casellaNuova, k) => {
            const casellaVecchia = caselleVecchie[k];
            const firmaVecchia = casellaVecchia.__renderSignature || casellaVecchia.outerHTML;
            const firmaNuova = casellaNuova.__renderSignature || casellaNuova.outerHTML;
            if (firmaVecchia === firmaNuova) {
                trasferisciGestori(casellaVecchia, casellaNuova);
            } else {
                vecchia.replaceChild(casellaNuova, casellaVecchia);
            }
        });
    });
}

/**
 * Ricopia i gestori di evento dal nodo appena costruito a quello che
 * resta a schermo, scendendo in parallelo nei due alberi — possibile
 * solo perché chi chiama ha già verificato che il loro HTML è identico,
 * quindi hanno la stessa identica forma.
 *
 * Sono solo tre proprietà perché sono le uniche che il percorso di
 * render del Terreno assegna (createSlotElement e createRow): onclick
 * sulla casella e sulla carta, onmouseenter per il pannello descrizione,
 * onpointerdown per il trascinamento d'attacco. Se un giorno se ne
 * aggiunge una quarta va aggiunta anche qui, altrimenti smetterebbe di
 * funzionare sulle caselle rimaste ferme — il caso più comune.
 */
const GESTORI_DA_TRASFERIRE = ['onclick', 'onmouseenter', 'onpointerdown'];
function trasferisciGestori(vecchio, nuovo) {
    GESTORI_DA_TRASFERIRE.forEach((nome) => { vecchio[nome] = nuovo[nome]; });
    for (let i = 0; i < nuovo.children.length && i < vecchio.children.length; i++) {
        trasferisciGestori(vecchio.children[i], nuovo.children[i]);
    }
}

function startAttackDrag(event, attackerIndex) {
    event.preventDefault();
    event.stopPropagation();
    const attackerSlot = gameState.playerMonsterField[attackerIndex];
    if (!attackerSlot || attackerSlot.hasAttacked || gameState.phase !== 'battle') return;

    suppressCardInspectionFor(700);
    isDraggingAttack = true;
    attackDragStart.attackerIndex = attackerIndex;

    const rect = event.currentTarget.getBoundingClientRect();
    attackDragStart.x = rect.left + rect.width / 2;
    attackDragStart.y = rect.top + rect.height / 2;

    attackArrowLine.setAttribute('x1', attackDragStart.x);
    attackArrowLine.setAttribute('y1', attackDragStart.y);
    attackArrowLine.setAttribute('x2', attackDragStart.x);
    attackArrowLine.setAttribute('y2', attackDragStart.y);
    // Anello pulsante nel punto di partenza (vedi #attack-arrow-origin in
    // duelMonstersCore.html) — posizionato una sola volta qui: a
    // differenza della punta, l'origine non segue mai il puntatore.
    const originCircle = document.getElementById('attack-arrow-origin');
    if (originCircle) {
        originCircle.setAttribute('cx', attackDragStart.x);
        originCircle.setAttribute('cy', attackDragStart.y);
    }
    attackArrowSVG.style.display = 'block';

    // Può attaccare direttamente? La regola è una sola (puoAttaccareDirettamente,
    // battaglia.js), la stessa per le bande e per l'aggancio della freccia.
    attackDragStart.directPossible = puoAttaccareDirettamente('player', attackerIndex);
    // Il bot non ha mostri: qualunque punto tu rilasci, l'attacco sarà per
    // forza diretto. Invece di farti mirare con precisione, la freccia si
    // blocca subito verso la MANO del bot (il bersaglio concettuale di un
    // attacco diretto, non il box LP — dove i Life Points scendono è solo
    // la conseguenza, non il "cosa" stai colpendo) e mostra il warning
    // laterale in anteprima, così è chiaro fin da subito cosa sta per
    // succedere.
    attackDragStart.forcedDirect = attackDragStart.directPossible
        && !gameState.botMonsterField.some((monster) => monster !== null);
    if (attackDragStart.forcedDirect) {
        agganciaFrecciaAllaMano(true);
        showDirectAttackHint();
    } else if (attackDragStart.directPossible) {
        // DUE opzioni (richiesta esplicita): l'avversario ha mostri, ma
        // questo mostro può comunque colpire i Life Point. Le bande compaiono
        // subito, tenui, per dire che la mossa c'è; la freccia resta libera
        // e si aggancia alla mano solo se la porti oltre i mostri avversari
        // (vedi aggiornaAggancioDiretto).
        showDirectAttackHint(true);
    }

    document.addEventListener('pointermove', dragAttackArrow);
    document.addEventListener('pointerup', endAttackDrag);
    document.addEventListener('pointercancel', endAttackDrag);
}

function dragAttackArrow(event) {
    if (!isDraggingAttack) return;
    // Con l'attacco forzatamente diretto (vedi startAttackDrag) la freccia
    // resta ancorata al bot: non segue il puntatore.
    if (attackDragStart.forcedDirect) return;
    if (aggiornaAggancioDiretto(event.clientX, event.clientY)) return;
    attackArrowLine.setAttribute('x2', event.clientX);
    attackArrowLine.setAttribute('y2', event.clientY);
    updateAttackTargetHighlight(event.clientX, event.clientY);
}

/**
 * Il punto (x, y) chiede un attacco DIRETTO? Sì sopra la mano o il box
 * dell'avversario, e sì OLTRE la sua fila di mostri (più in alto del loro
 * bordo superiore: la sua fila Magie/Trappole e tutto ciò che sta dietro).
 * È il gesto naturale "passo sopra i suoi mostri e vado dritto a lui", e
 * non si sovrappone mai al bersaglio di un mostro, che sta sotto quel bordo.
 * Usata sia durante il trascinamento sia al rilascio, così l'aggancio
 * mostrato è sempre l'attacco che parte davvero.
 */
function puntaAllaManoAvversaria(x, y) {
    const el = document.elementFromPoint(x, y);
    if (el && (el.closest('#botHand') || el.closest('#botInfo'))) return true;
    let bordoMostri = Infinity;
    document.querySelectorAll('#botFieldBoard .field-slot[data-owner="bot"][data-type="monster"]').forEach((slot) => {
        bordoMostri = Math.min(bordoMostri, slot.getBoundingClientRect().top);
    });
    return bordoMostri !== Infinity && y < bordoMostri;
}

/** Punta la freccia al centro della mano dell'avversario (o la libera) e accende/spegne la mano come bersaglio. */
function agganciaFrecciaAllaMano(attivo) {
    const botHandEl = document.getElementById('botHand');
    if (botHandEl) botHandEl.classList.toggle('attack-target-hover', !!attivo);
    if (!attivo || !botHandEl) return;
    const botRect = botHandEl.getBoundingClientRect();
    attackArrowLine.setAttribute('x2', botRect.left + botRect.width / 2);
    attackArrowLine.setAttribute('y2', botRect.top + botRect.height / 2);
}

/**
 * Con un attacco diretto possibile ma non obbligato (richiesta esplicita:
 * l'avversario ha mostri, ma questo mostro può colpire i Life Point), la
 * freccia si AGGANCIA alla mano avversaria appena il puntatore va oltre i
 * suoi mostri, e le bande passano da tenui a piene. Torna true se la
 * freccia è agganciata (chi chiama non deve più farle seguire il puntatore).
 */
function aggiornaAggancioDiretto(x, y) {
    const agganciato = !!attackDragStart.directPossible && puntaAllaManoAvversaria(x, y);
    agganciaFrecciaAllaMano(agganciato);
    const bande = document.getElementById('directAttackHint');
    if (bande) bande.classList.toggle('daw-in-attesa', !agganciato);
    if (agganciato) clearAttackTargetHighlight();
    return agganciato;
}

// Mostro del bot (o riga vuota) evidenziato mentre si trascina la freccia
// — SEMPRE la stessa identica euristica di endAttackDrag/
// findNearestBotMonsterSlot qui sotto, mai una versione "solo per
// l'anteprima" che rischierebbe di promettere un bersaglio diverso da
// quello che scatterebbe davvero al rilascio (richiesta esplicita
// dell'utente: rendere la freccia più chiara/più "figa" durante il
// trascinamento).
let attackHoverTargetEl = null;
function updateAttackTargetHighlight(x, y) {
    let nextEl = null;
    const elAtPoint = document.elementFromPoint(x, y);
    const directSlot = elAtPoint ? elAtPoint.closest('.field-slot[data-owner="bot"][data-type="monster"]') : null;
    if (directSlot && gameState.botMonsterField[parseInt(directSlot.dataset.index, 10)]) {
        nextEl = directSlot;
    } else if (gameState.botMonsterField.some((m) => m !== null)) {
        const nearestIndex = findNearestBotMonsterSlot(x, y);
        if (nearestIndex !== -1) {
            nextEl = document.querySelector(`#botFieldBoard .field-slot[data-owner="bot"][data-type="monster"][data-index="${nearestIndex}"]`);
        }
    }
    if (nextEl === attackHoverTargetEl) return;
    if (attackHoverTargetEl) attackHoverTargetEl.classList.remove('attack-target-hover');
    attackHoverTargetEl = nextEl;
    if (attackHoverTargetEl) attackHoverTargetEl.classList.add('attack-target-hover');
}
function clearAttackTargetHighlight() {
    if (attackHoverTargetEl) attackHoverTargetEl.classList.remove('attack-target-hover');
    attackHoverTargetEl = null;
}

function endAttackDrag(event) {
    if (!isDraggingAttack) return;
    // Copre il click di compatibilita' emesso DOPO il pointerup, quando il
    // flag di trascinamento verra' gia' azzerato poche righe piu sotto.
    suppressCardInspectionFor(700);
    isDraggingAttack = false;
    attackArrowSVG.style.display = 'none';
    hideDirectAttackHint();
    clearAttackTargetHighlight();
    agganciaFrecciaAllaMano(false);
    document.removeEventListener('pointermove', dragAttackArrow);
    document.removeEventListener('pointerup', endAttackDrag);
    document.removeEventListener('pointercancel', endAttackDrag);

    // Attacco forzatamente diretto: qualunque punto dello schermo si
    // rilasci il dito/mouse, è comunque l'unico attacco possibile.
    if (attackDragStart.forcedDirect) {
        executeAttack(attackDragStart.attackerIndex, -1);
        return;
    }

    const targetElement = document.elementFromPoint(event.clientX, event.clientY);
    const targetSlot = targetElement ? targetElement.closest('.field-slot') : null;
    const hasBotMonsters = gameState.botMonsterField.some(monster => monster !== null);

    if (targetSlot && targetSlot.dataset.owner === 'bot' && targetSlot.dataset.type === 'monster' && gameState.botMonsterField[parseInt(targetSlot.dataset.index, 10)]) {
        executeAttack(attackDragStart.attackerIndex, parseInt(targetSlot.dataset.index, 10));
        return;
    }
    // Attacco diretto: rilascio sulla mano o sul box dell'avversario, o
    // oltre la sua fila di mostri — la stessa zona in cui la freccia si
    // aggancia durante il trascinamento (puntaAllaManoAvversaria), quindi
    // parte esattamente l'attacco che l'aggancio mostrava. Se il mostro
    // può attaccare direttamente lo dice puoAttaccareDirettamente
    // (battaglia.js): anche con mostri avversari in campo, se ha un
    // permesso (Golem Meccanico, i Toon...).
    if (attackDragStart.directPossible && puntaAllaManoAvversaria(event.clientX, event.clientY)) {
        executeAttack(attackDragStart.attackerIndex, -1);
        return;
    }

    // Rilascio impreciso ma comunque vicino al campo del bot (es. su uno
    // slot vuoto adiacente, o tra due elementi): prima questo caso non
    // faceva NULLA, in silenzio — un dito che manca lo slot esatto per
    // pochi pixel buttava via l'intero attacco senza alcuna spiegazione.
    // Ora si punta al mostro del bot più vicino al punto di rilascio,
    // finché resta ragionevolmente dentro l'area del suo campo.
    if (hasBotMonsters) {
        const nearestIndex = findNearestBotMonsterSlot(event.clientX, event.clientY);
        if (nearestIndex !== -1) {
            executeAttack(attackDragStart.attackerIndex, nearestIndex);
            return;
        }
    }

    // Nessun bersaglio valido nemmeno per approssimazione: invece di non
    // fare nulla in silenzio, si spiega perché l'attacco non è partito.
    const attaccante = gameState.playerMonsterField[attackDragStart.attackerIndex];
    addToLog(hasBotMonsters
        ? '❌ Rilascia l\'attacco su un mostro del bot per colpirlo.'
        : (attackDragStart.directPossible
            ? '❌ Rilascia l\'attacco sulla mano del Bot per un attacco diretto.'
            : `🚫 ${attaccante ? attaccante.card.name : 'Questo mostro'} non può attaccare direttamente.`));
}

/** Annulla soltanto il gesto grafico, senza dichiarare alcun attacco. */
function annullaTrascinamentoAttaccoSospeso() {
    if (!isDraggingAttack) return;
    isDraggingAttack = false;
    attackDragStart.attackerIndex = -1;
    attackDragStart.forcedDirect = false;
    if (attackArrowSVG) attackArrowSVG.style.display = 'none';
    hideDirectAttackHint();
    clearAttackTargetHighlight();
    agganciaFrecciaAllaMano(false);
    document.removeEventListener('pointermove', dragAttackArrow);
    document.removeEventListener('pointerup', endAttackDrag);
    document.removeEventListener('pointercancel', endAttackDrag);
}

/** Il Multiplayer deve continuare a passo comune: mai fermare un solo lato. */
function duelloMultiplayerAttivo() {
    return typeof PassoComune !== 'undefined' && PassoComune.attivo();
}

function assicuratiOverlayPausaDuello() {
    let overlay = document.getElementById('duelPauseOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'duelPauseOverlay';
    overlay.className = 'duel-pause-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'duelPauseTitle');

    const sigillo = document.createElement('span');
    sigillo.className = 'duel-pause-seal';
    sigillo.setAttribute('aria-hidden', 'true');
    sigillo.textContent = 'Ⅱ';
    const titolo = document.createElement('strong');
    titolo.id = 'duelPauseTitle';
    titolo.textContent = 'Duello in pausa';
    const testo = document.createElement('p');
    testo.textContent = 'Il duello è stato fermato mentre l’app non era attiva.';
    const pulsante = document.createElement('button');
    pulsante.type = 'button';
    pulsante.className = 'duel-pause-resume';
    pulsante.textContent = 'Riprendi il duello';
    pulsante.addEventListener('click', riprendiDuelloDaPausa);
    overlay.append(sigillo, titolo, testo, pulsante);
    document.body.appendChild(overlay);
    return overlay;
}

function sospendiMediaDuello() {
    if (window.DuelMusic && typeof DuelMusic.sospendi === 'function') DuelMusic.sospendi();
    if (window.FieldAmbience && typeof FieldAmbience.sospendi === 'function') FieldAmbience.sospendi('app-background');
    document.querySelectorAll('video').forEach((video) => {
        if (!video.paused) {
            video.dataset.pausedByDuelLifecycle = '1';
            video.pause();
        }
    });
}

function riprendiMediaDuello() {
    if (window.DuelMusic && typeof DuelMusic.riprendi === 'function') DuelMusic.riprendi();
    if (window.FieldAmbience && typeof FieldAmbience.riprendi === 'function') FieldAmbience.riprendi('app-background');
    document.querySelectorAll('video[data-paused-by-duel-lifecycle="1"]').forEach((video) => {
        delete video.dataset.pausedByDuelLifecycle;
        const tentativo = video.play();
        if (tentativo && typeof tentativo.catch === 'function') tentativo.catch(() => {});
    });
}

function sospendiDuelloPerLifecycle() {
    if (lifecyclePauseActive || duelloMultiplayerAttivo()
        || typeof gameState === 'undefined' || gameState.gameOver
        || typeof PausaDuello === 'undefined') return;
    lifecyclePauseActive = true;
    duelPauseStartedAt = Date.now();
    PausaDuello.sospendi('app-background');
    annullaTrascinamentoAttaccoSospeso();
    assicuratiOverlayPausaDuello();
    document.documentElement.classList.add('duel-paused');
    sospendiMediaDuello();
}

function riprendiDuelloDaPausa() {
    if (!lifecyclePauseActive || document.hidden) return;
    lifecyclePauseActive = false;
    if (duelPauseStartedAt !== null && duelStartTime !== null) {
        duelStartTime += Math.max(0, Date.now() - duelPauseStartedAt);
    }
    duelPauseStartedAt = null;
    document.documentElement.classList.remove('duel-paused');
    riprendiMediaDuello();
    ripristinaDuelloDopoSospensione();
    PausaDuello.riprendi('app-background');
    updateDuelTimer();
}

/**
 * Ripara lo stato puramente interattivo dopo che Android ha congelato la
 * WebView. Lo stato del duello non viene alterato: si annulla solo un drag
 * senza piu' dito e si ridisegna l'eventuale scelta che il motore stava gia'
 * aspettando. E' proprio il caso del blocco osservato in Battle Phase.
 */
function ripristinaDuelloDopoSospensione() {
    if (typeof gameState === 'undefined' || gameState.gameOver) return;
    annullaTrascinamentoAttaccoSospeso();
    // Sincrono: requestAnimationFrame puo' restare sospeso proprio nella
    // WebView che stiamo cercando di recuperare.
    if (window.Decisioni && typeof Decisioni.riproponi === 'function') Decisioni.riproponi();
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) sospendiDuelloPerLifecycle();
    else if (lifecyclePauseActive) {
        assicuratiOverlayPausaDuello().querySelector('.duel-pause-resume')?.focus({ preventScroll: true });
        ripristinaDuelloDopoSospensione();
    } else ripristinaDuelloDopoSospensione();
});
window.addEventListener('pagehide', sospendiDuelloPerLifecycle);
window.addEventListener('pageshow', () => {
    if (lifecyclePauseActive) assicuratiOverlayPausaDuello();
    ripristinaDuelloDopoSospensione();
});

// Nella WebView Capacitor l'evento nativo è più affidabile di visibilitychange
// su alcuni produttori Android. I due percorsi sono idempotenti e possono
// quindi arrivare entrambi senza creare due pause.
if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App
    && typeof Capacitor.Plugins.App.addListener === 'function') {
    Capacitor.Plugins.App.addListener('appStateChange', (state) => {
        if (state && state.isActive) {
            if (lifecyclePauseActive) assicuratiOverlayPausaDuello();
            ripristinaDuelloDopoSospensione();
        } else sospendiDuelloPerLifecycle();
    });
}

/**
 * Trova lo slot mostro del bot più vicino al punto (x, y) di rilascio del
 * trascinamento d'attacco, per il fallback "rilascio impreciso" qui sopra.
 * Torna -1 se il punto è troppo lontano dal campo del bot per essere
 * ragionevolmente un tentativo di colpirne un mostro (es. un rilascio
 * accidentale altrove sullo schermo non deve "agganciarsi" a un bersaglio).
 */
function findNearestBotMonsterSlot(x, y) {
    const board = document.getElementById('botFieldBoard');
    if (!board) return -1;
    const boardRect = board.getBoundingClientRect();
    const margin = 70;
    if (x < boardRect.left - margin || x > boardRect.right + margin || y < boardRect.top - margin || y > boardRect.bottom + margin) {
        return -1;
    }
    let bestIndex = -1;
    let bestDist = Infinity;
    gameState.botMonsterField.forEach((slot, index) => {
        if (!slot) return;
        const el = document.querySelector(`#botFieldBoard .field-slot[data-owner="bot"][data-type="monster"][data-index="${index}"]`);
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dist = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
        if (dist < bestDist) {
            bestDist = dist;
            bestIndex = index;
        }
    });
    return bestIndex;
}

/**
 * `directDirection` ('up' | 'down' | null): solo per un attacco DIRETTO
 * (nessun mostro bersaglio). L'attaccante non ha una carta-bersaglio verso
 * cui lanciarsi, quindi va FRONTALMENTE dritto (nessuno scarto laterale)
 * fin quasi alla MANO di chi subisce — in alto se subisce il Bot, in
 * basso se subisce il giocatore. Stessa direzione dell'impatto epico a
 * mezzo schermo (vedi showHalfScreenImpact) e stesso bersaglio della
 * freccia di trascinamento (vedi startAttackDrag).
 * Per un attacco a un mostro, invece, si lancia dritto sul suo bersaglio.
 */
function showBattleEffect(attackerEl, targetEl, directDirection) {
    if (attackerEl) {
        attackerEl.classList.remove('is-attacking');
        void attackerEl.offsetWidth;

        const aRect = attackerEl.getBoundingClientRect();
        let dx = 0;
        let dy = 0;
        if (directDirection) {
            // Attacco DIRETTO: non c'è un mostro da colpire, si colpisce
            // il duellante — e il bersaglio è la sua MANO, non il suo
            // ritratto. È lo stesso bersaglio verso cui punta già la
            // freccia di trascinamento (vedi startAttackDrag): la mano è
            // ciò che stai colpendo, mentre i Life Point che scendono
            // sono la conseguenza, non la cosa colpita.
            //
            // Un tentativo precedente puntava al riquadro nome+LP+ritratto
            // ed è stato respinto: "l'attacco diretto deve essere come
            // prima, la carta va frontalmente dritta verso praticamente la
            // mano avversaria e non verso il suo avatar". Quei riquadri
            // stanno per giunta agli angoli, quindi lo slancio partiva
            // storto di lato invece che in avanti.
            //
            // Quindi dx resta ZERO — lo slancio è frontale, dritto — e
            // solo dy porta la carta fin quasi alla mano avversaria (0.82,
            // lo stesso "si ferma un filo prima" usato qui sotto per un
            // bersaglio vero: dev'essere un impatto, non un attraversamento).
            const manoBersaglio = document.getElementById(directDirection === 'up' ? 'botHand' : 'playerHand');
            const mRect = manoBersaglio ? manoBersaglio.getBoundingClientRect() : null;
            if (mRect && mRect.height > 0) {
                dy = ((mRect.top + mRect.height / 2) - (aRect.top + aRect.height / 2)) * 0.82;
            } else {
                // Mano non trovata (layout inatteso): si torna allo
                // slancio verticale di sempre invece di non muoversi.
                const margin = aRect.height * 0.5;
                dy = directDirection === 'up' ? -(aRect.top - margin) : (window.innerHeight - aRect.bottom - margin);
            }
        } else if (targetEl) {
            const tRect = targetEl.getBoundingClientRect();
            // Si ferma un po' prima del centro esatto del bersaglio (82%):
            // sembra un impatto, non un attraversamento.
            dx = ((tRect.left + tRect.width / 2) - (aRect.left + aRect.width / 2)) * 0.82;
            dy = ((tRect.top + tRect.height / 2) - (aRect.top + aRect.height / 2)) * 0.82;
        }
        attackerEl.style.setProperty('--charge-dx', `${dx}px`);
        attackerEl.style.setProperty('--charge-dy', `${dy}px`);

        attackerEl.classList.add('is-attacking');
        setTimeout(() => attackerEl.classList.remove('is-attacking'), 650);

        // La proiezione olografica segue lo SLOT, e si riposiziona solo
        // quando il Terreno viene ridisegnato — non fotogramma per
        // fotogramma. Mentre la carta si lancia resterebbe quindi
        // indietro, leggendosi come un fantasma dimenticato a mezz'aria:
        // per la durata della rincorsa si spegne. Vale anche per un
        // attacco a un mostro, non solo per quello diretto.
        if (window.MonsterHolograms && typeof MonsterHolograms.nascondiPer === 'function' && attackerEl.dataset.uid) {
            MonsterHolograms.nascondiPer(attackerEl.dataset.uid, 650);
        }
    }

    const glScontro = !!(window.FX && typeof FX.backendFor === 'function' && FX.backendFor('playBattleClashEpic') === 'webgl');
    if (targetEl && !glScontro) {
        const rect = targetEl.getBoundingClientRect();
        const hitEl = document.createElement('div');
        hitEl.className = 'battle-hit';
        hitEl.style.left = `${rect.left}px`;
        hitEl.style.top = `${rect.top}px`;
        hitEl.style.width = `${rect.width}px`;
        hitEl.style.height = `${rect.height}px`;
        document.body.appendChild(hitEl);
        setTimeout(() => hitEl.remove(), 550);

    }
    if (targetEl) {
        targetEl.classList.remove('being-hit');
        void targetEl.offsetWidth;
        targetEl.classList.add('being-hit');
        setTimeout(() => targetEl.classList.remove('being-hit'), 500);
    }
}

/**
 * Convenzione del segno (stessa di ACTIONS.dealDamage in duel-engine.js,
 * "può essere negativo per curare"): `value` positivo = danno subito da
 * `owner` (Life Points che scendono), negativo = cura. L'unico chiamante
 * reale oggi è resolveBattleDamage in actions.js, che passa sempre un
 * importo positivo (il danno appena calcolato).
 */
function showFloatingDamage(value, anchorEl, owner) {
    // Con la versione WebGL dell'impatto (lampo a mezzo schermo, crepe, alone del numero) gli strati DOM equivalenti
    // non servono: erano gradienti, blend e filtri animati tutti insieme.
    const glImpatto = !!(window.FX && typeof FX.backendFor === 'function' && FX.backendFor('playDamageEffect') === 'webgl');
    showEpicDamageNumber(value, glImpatto);
    if (value > 0 && owner && !glImpatto) showHalfScreenImpact(owner);

    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = `floating-damage ${value > 0 ? 'damage' : 'heal'}`;
    el.textContent = value > 0 ? `-${value}` : `+${Math.abs(value)}`;
    el.style.left = `${rect.left + rect.width / 2 - 18}px`;
    el.style.top = `${rect.top - 6}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 950);

    if (value > 0 && window.FX) {
        FX.playDamageEffect(value, { anchorEl, owner });
    }
    // Il suono dei Life Points NON parte da qui: lo scatena già
    // ACTIONS.dealDamage in duel-engine.js (unico punto per cui passa
    // OGNI variazione di LP, anche quella da carte che non chiamano mai
    // showFloatingDamage) — richiamarlo anche qui suonerebbe due volte
    // per lo stesso danno da battaglia.
}

/**
 * Impatto epico su mezza schermata quando si SUBISCE danno: la metà alta
 * (dove sta il Bot) o bassa (dove sta il giocatore) si accende di rosso —
 * molto più "epico" di un piccolo effetto sul solo box LP. `owner` è chi
 * ha PERSO i Life Points.
 */
function showHalfScreenImpact(owner) {
    const existing = document.getElementById('halfScreenImpact');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'halfScreenImpact';
    el.className = owner === 'bot' ? 'top' : 'bottom';
    el.innerHTML = `
        <div class="hsi-vignette"></div>
        <div class="hsi-flash"></div>
        <div class="hsi-cracks"></div>
        <div class="hsi-edge-glow"></div>
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
}

/**
 * Numero enorme a centro schermo quando si perdono (o recuperano) Life
 * Points, in stile anime: il colpo si vede al centro della scena mentre il
 * contatore nel box LP scende con l'animazione di animateLifePoints().
 */
function showEpicDamageNumber(value, senzaFiltri) {
    const existing = document.getElementById('epicDamageBurst');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'epicDamageBurst';
    el.className = (value > 0 ? 'epic-damage-burst dmg' : 'epic-damage-burst heal') + (senzaFiltri ? ' epic-gl' : '');
    el.innerHTML = `
        <div class="epic-damage-value">${value > 0 ? '−' : '+'}${Math.abs(value)}</div>
        <div class="epic-damage-label">${value > 0 ? 'Life Points' : 'Recupero'}</div>
    `;
    document.body.appendChild(el);
    void el.offsetWidth;
    el.classList.add('play');
    setTimeout(() => el.remove(), 1150);
}

/**
 * Avviso "ATTACCO DIRETTO", stile Yu-Gi-Oh! Master Duel: due barre a
 * strisce diagonali che entrano dai lati dello schermo, con la scritta al
 * centro. Richiamato solo quando un attacco colpisce i Life Points senza
 * passare da un mostro avversario (vedi resolveBattleDamage in actions.js).
 */
function showDirectAttackWarning() {
    const existing = document.getElementById('directAttackWarning');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'directAttackWarning';
    el.innerHTML = `
        <div class="daw-bar daw-bar--left"><span class="daw-bar-text">ATTACCO DIRETTO</span></div>
        <div class="daw-bar daw-bar--right"><span class="daw-bar-text">ATTACCO DIRETTO</span></div>
        <div class="daw-center-label">Attacco Diretto!</div>
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1450);
}

/**
 * Anteprima "live" delle barre ATTACCO DIRETTO durante il trascinamento
 * (vedi startAttackDrag): a differenza di showDirectAttackWarning(), che
 * scompare da sola dopo l'impatto, questa resta finché non viene chiusa a
 * mano con hideDirectAttackHint() (il rilascio del trascinamento).
 *
 * `inAttesa`: l'attacco diretto è possibile ma non ancora scelto (la
 * freccia non è agganciata alla mano): le bande restano più tenui finché
 * aggiornaAggancioDiretto() non toglie la classe.
 */
function showDirectAttackHint(inAttesa) {
    hideDirectAttackHint();
    const el = document.createElement('div');
    el.id = 'directAttackHint';
    if (inAttesa) el.classList.add('daw-in-attesa');
    el.innerHTML = `
        <div class="daw-bar daw-bar--left daw-bar--hint"><span class="daw-bar-text">ATTACCO DIRETTO</span></div>
        <div class="daw-bar daw-bar--right daw-bar--hint"><span class="daw-bar-text">ATTACCO DIRETTO</span></div>
    `;
    document.body.appendChild(el);
}

function hideDirectAttackHint() {
    const el = document.getElementById('directAttackHint');
    if (el) el.remove();
}

function showPositionEffect(owner, index, position) {
    setTimeout(() => {
        const boardId = owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard';
        const cardEl = document.querySelector(`#${boardId} .field-slot[data-type="monster"][data-index="${index}"] .card`);
        if (!cardEl) return;
        // La carta in Posizione di Difesa è già ruotata (classe .defense-pos,
        // applicata al render). Usiamo un keyframe dedicato che include quella
        // rotazione, così l'animazione non la fa "scattare" temporaneamente
        // in orizzontale come se fosse in attacco.
        const animClass = position === 'defense' ? 'positioning-defense' : 'positioning';
        cardEl.classList.remove('positioning', 'positioning-defense');
        void cardEl.offsetWidth;
        cardEl.classList.add(animClass);
        // Sempre (Attacco o Difesa): la versione WebGL e' un solo anello contenuto; senza WebGL resta quella di prima.
        if (window.FX) {
            FX.playSummonShockwave(cardEl);
        }
        // Spade che si incrociano / scudo che si forma, in WebGL, sopra la carta. Se non si puo', il vecchio distintivo.
        if (window.IconePosizione && IconePosizione.sullaCarta(cardEl, position)) {
            setTimeout(() => cardEl.classList.remove(animClass), 700);
            return;
        }
        const badge = document.createElement('div');
        badge.className = position === 'defense' ? 'position-badge badge-defense' : 'position-badge';
        badge.dataset.icon = position === 'attack' ? 'attackPos' : 'defensePos';
        cardEl.appendChild(badge);
        if (window.Icons) Icons.hydrate(cardEl);
        setTimeout(() => badge.remove(), 700);
        setTimeout(() => cardEl.classList.remove(animClass), 700);
    }, 60);
}

/**
 * Impedisce che la mano (giocatore o bot) vada MAI su più righe —
 * richiesta esplicita dell'utente ("non devono formarsi altre righe...
 * deve stare tutto sulla stessa riga"), soprattutto rilevante su mobile
 * in verticale dove lo spazio orizzontale è ridotto (vedi il padding
 * laterale asimmetrico su .hand/.hand--bot per lasciare spazio
 * all'avatar). Se le carte a larghezza piena supererebbero lo spazio
 * disponibile, le sovrappone quel tanto che basta (margin-left negativo
 * su ognuna tranne la prima) invece di rimpicciolirle — restano
 * leggibili, si comportano come un vero ventaglio di carte in mano
 * invece che andare a capo. Chiamata alla fine di ogni render della
 * mano, così si auto-corregge ad ogni cambio di numero di carte; anche
 * dal listener 'resize' più sotto per un cambio di orientamento/
 * ridimensionamento senza un vero aggiornamento di stato.
 */
function fitHandCardsInOneRow(handEl) {
    if (!handEl) return;
    const cards = Array.from(handEl.children);
    // Riparte sempre dal margin naturale (il distanziamento normale lo fa
    // già `gap` su .hand/.hand--bot) prima di rimisurare — altrimenti un
    // margin negativo applicato a una misurazione precedente falserebbe
    // quella nuova.
    cards.forEach((c) => { c.style.marginLeft = ''; });
    if (cards.length < 2) return;
    const available = handEl.clientWidth;
    if (available <= 0) return;
    const style = getComputedStyle(handEl);
    const gapPx = parseFloat(style.columnGap || style.gap) || 0;
    const cardWidth = cards[0].getBoundingClientRect().width;
    if (cardWidth <= 0) return;
    const naturalWidth = cardWidth * cards.length + gapPx * (cards.length - 1);
    if (naturalWidth <= available) return; // ci sta già su una riga sola, nessuna sovrapposizione necessaria
    const overlapPerCard = (naturalWidth - available) / (cards.length - 1);
    // Mai sovrapporre più dell'85% di una carta: oltre quella soglia
    // resterebbe visibile solo un bordo, illeggibile — meglio restare
    // leggermente più larghi dello spazio "ideale" (un piccolo overflow
    // orizzontale contenuto da .hand { overflow: visible } esistente)
    // che rendere le carte inutilizzabili.
    const cappedOverlap = Math.min(overlapPerCard, cardWidth * 0.85);
    cards.forEach((c, i) => {
        if (i === 0) return;
        c.style.marginLeft = `-${cappedOverlap}px`;
    });
}

/**
 * Conserva i nodi delle carte che non sono cambiate. Svuotare la mano a
 * ogni updateUI obbligava il WebView a ricollegare e ridipingere tutte le
 * immagini, producendo il breve flicker visibile anche senza un video.
 */
function firmaRenderStabile(elemento) {
    const copia = elemento.cloneNode(true);
    [copia, ...copia.querySelectorAll('.has-image, .art-loaded, .has-pile-image')].forEach((el) => {
        el.classList.remove('has-image', 'art-loaded', 'has-pile-image');
    });
    copia.querySelectorAll('.card-name-text').forEach((el) => el.style.removeProperty('transform'));
    // Un'immagine fallita viene rimossa da onerror; una appena costruita
    // esiste ancora fino a quel callback. In entrambi i casi la cornice
    // fallback descrive già interamente la carta e resta la firma stabile.
    copia.querySelectorAll('.card-image, .card-art-image, .deck-pile-image').forEach((el) => el.remove());
    // Nel fallback artOnly l'icona viene rimossa quando l'immagine finisce
    // di caricarsi. È soltanto uno stato di caricamento, non della carta.
    copia.querySelectorAll('.card-frame-art-icon').forEach((el) => el.remove());
    return copia.outerHTML;
}

function reconcileHandCards(handEl, nuoveCarte) {
    const vecchie = Array.from(handEl.children);
    vecchie.forEach((el) => { el.style.marginLeft = ''; });
    const usate = new Set();
    const desiderate = nuoveCarte.map((nuova, index) => {
        const uid = nuova.dataset.uid;
        let vecchia = uid ? vecchie.find((el) => !usate.has(el) && el.dataset.uid === uid) : vecchie[index];
        const firmaVecchia = vecchia && (vecchia.__renderSignature || vecchia.outerHTML);
        const firmaNuova = nuova.__renderSignature || nuova.outerHTML;
        if (vecchia && !usate.has(vecchia) && firmaVecchia === firmaNuova) {
            usate.add(vecchia);
            trasferisciGestori(vecchia, nuova);
            return vecchia;
        }
        return nuova;
    });

    // Non passare da DocumentFragment/replaceChildren: anche quando tutte
    // le carte erano identiche quel percorso le staccava per un istante
    // dal documento e le riagganciava subito dopo. Chromium desktop spesso
    // conserva il layer, ma la WebView può ridipingerlo come un lampo. Qui
    // un nodo già nella posizione corretta non viene toccato affatto; si
    // inseriscono/spostano solo le carte realmente nuove o riordinate.
    desiderate.forEach((carta, index) => {
        const attuale = handEl.children[index] || null;
        if (attuale !== carta) handEl.insertBefore(carta, attuale);
    });
    const daConservare = new Set(desiderate);
    Array.from(handEl.children).forEach((carta) => {
        if (!daConservare.has(carta)) carta.remove();
    });
}
window.addEventListener('resize', () => {
    clearTimeout(window.__handFitResizeTimeout);
    window.__handFitResizeTimeout = setTimeout(() => {
        fitHandCardsInOneRow(document.getElementById('playerHand'));
        fitHandCardsInOneRow(document.getElementById('botHand'));
        renderEquipLinks();
        syncPhaseStepperToFieldWidth();
    }, 120);
});

function renderPlayerHand() {
    const handEl = document.getElementById('playerHand');
    if (!handEl) return;
    if (window.CardRenderer) CardRenderer.iniziaImmaginiDifferite();
    try {
    const nuoveCarte = [];
    gameState.playerHand.forEach((card, index) => {
        const cardEl = createCardElement(card);
        const pendingDraw = gameState._pendingDrawAnimation;
        if (pendingDraw && pendingDraw.owner === 'player' && Array.isArray(pendingDraw.uids)
            && pendingDraw.uids.includes(card.uid)) {
            cardEl.classList.add('pending-deal');
        }
        // NIENTE cardEl.onclick qui: il sistema a Pointer Event qui sotto
        // (onpointerdown -> startHandCardDrag -> handleDragMove/handleDragEnd
        // in js/engine/actions.js) gestisce GIÀ da solo sia il click sia il
        // trascinamento, per mouse E touch. Un handler 'click' nativo IN PIÙ
        // sulla stessa carta duplicava ogni tap: il rilascio del dito faceva
        // scattare handleCardClick() dal sistema Pointer, e POCO DOPO il
        // browser sparava anche il proprio evento 'click' sintetico
        // (compatibilità touch->mouse) che richiamava handleCardClick() UNA
        // SECONDA volta — su desktop innocuo (apre/richiude lo stesso
        // popover), ma su telefono reale la doppia invocazione ravvicinata
        // poteva far sembrare che il primo tap "non facesse nulla" (il
        // popover apriva e richiudeva quasi subito) finché un vero
        // trascinamento non bypassava del tutto questo doppio percorso.
        cardEl.onpointerdown = (event) => {
            if (gameState.currentPlayer !== 'player' || isDraggingAttack) return;
            startHandCardDrag(event, card, index, 'player');
        };
        cardEl.onmouseenter = () => {
            if (dragState || !canInspectCardOnHover() || isGameplaySelectionActive()) return;
            updateCardInfoPanel(card, { sourceType: 'hand', sourceOwner: 'player', isFaceDown: false });
        };
        if (gameState.selectedCard.type === 'hand' && gameState.selectedCard.index === index) {
            cardEl.classList.add('selected');
        }
        // Fotografia PRIMA che onload/rAF aggiungano has-image, art-loaded
        // o la compressione del nome. Quelli sono dettagli di pittura, non
        // cambi di stato: non devono far ricreare la carta al render dopo.
        cardEl.__renderSignature = firmaRenderStabile(cardEl);
        nuoveCarte.push(cardEl);
    });
    reconcileHandCards(handEl, nuoveCarte);
    fitHandCardsInOneRow(handEl);
    } finally {
        if (window.CardRenderer) CardRenderer.terminaImmaginiDifferite();
    }
    if (window.CardRenderer) CardRenderer.caricaImmaginiDifferite(handEl);
}

/**
 * Mano dell'avversario: SOLO dorsi, mai le carte vere — tante quante sono
 * davvero in gameState.botHand, così si vede a colpo d'occhio quante
 * carte ha in mano senza che il gioco "bari" mostrandone il contenuto.
 * Nessuna interazione (niente click/drag): sono pura informazione, come
 * il mazzo o il Cimitero.
 *
 * ECCEZIONE dichiarata: con Campanella Cerimoniale (id 1127, Ceremonial
 * Bell) scoperta in campo — `gameState.bothHandsRevealed`, ricalcolato
 * da recomputeStaticEffects() — le vere carte del bot vengono mostrate
 * al posto dei dorsi, esattamente come il testo reale della carta
 * richiede ("entrambi i giocatori tengono la mano rivelata"). Ancora
 * pura informazione: nessun handler di click/drag viene aggiunto, la
 * mano dell'avversario resta comunque impossibile da toccare.
 */
function renderBotHand() {
    const handEl = document.getElementById('botHand');
    if (!handEl) return;
    if (window.CardRenderer) CardRenderer.iniziaImmaginiDifferite();
    try {
    const revealed = !!gameState.bothHandsRevealed;
    const nuoveCarte = [];
    gameState.botHand.forEach((card) => {
        const cardEl = revealed ? createCardElement(card) : CardRenderer.renderCardBack();
        cardEl.__renderSignature = firmaRenderStabile(cardEl);
        nuoveCarte.push(cardEl);
    });
    reconcileHandCards(handEl, nuoveCarte);
    fitHandCardsInOneRow(handEl);
    } finally {
        if (window.CardRenderer) CardRenderer.terminaImmaginiDifferite();
    }
    if (window.CardRenderer) CardRenderer.caricaImmaginiDifferite(handEl);
}

// createCardElement(card, isFaceDown, position) e getCardImagePath(card)
// vivono ora in js/ui/card-renderer.js (condiviso da tutte le pagine) — vedi
// quel file per come si costruisce il DOM di una carta.

// Icone al posto del nome testuale per le zone speciali vuote (vedi
// createSlotElement sotto) — icone SVG a tema (js/ui/icon-library.js,
// stesso window.Icons già usato per i menu/topbar del sito), non emoji
// generiche di sistema. "Deck" non è nella mappa apposta: resta testo,
// dato che in pratica è quasi sempre coperto dalla pila di dorsi (vuoto
// solo se il mazzo finisce le carte).
const FIELD_ZONE_ICONS = { Terreno: 'fieldSpell', Cimitero: 'graveyard', Fusion: 'fusionDeck' };

/**
 * Quanti dorsi sfalsati disegnare per una pila (Deck, Cimitero, Extra
 * Deck) di `count` carte — cioè quanto la pila deve sembrare SPESSA.
 *
 * Prima erano sempre 3 appena c'era più di una carta: un Deck da 34 e uno
 * da 3 si vedevano identici, quindi la pila non diceva nulla. Ora lo
 * spessore segue la quantità vera, e diventa informazione leggibile con
 * un'occhiata — il Deck che si assottiglia mentre la partita avanza, il
 * Cimitero che cresce — senza dover leggere il numerino.
 *
 * Gli scalini NON sono lineari ed è deliberato: sopra le ~30 carte un
 * dorso in più non si distinguerebbe comunque, mentre nella fascia bassa
 * (dove "quante me ne restano?" conta davvero) ogni scalino cade dove il
 * giocatore nota la differenza. Cinque livelli sono il massimo che ci
 * sta dentro una casella senza sbordare — vedi gli offset
 * .deck-preview:nth-child in duelMonstersCore.html.
 */
/**
 * Quante carte aveva ogni pila all'ULTIMO render, per accorgersi che ne
 * è arrivata una nuova e farla "cadere dentro" — vedi createSlotElement.
 * Chiave: `<owner>-<zona>`. Si azzera da sola a inizio duello, perché al
 * primo render nessuna chiave esiste ancora.
 */
const pileCountsAtLastRender = {};

/**
 * Le coppie `equipUid->bersaglioUid` disegnate all'ULTIMO render, per
 * riconoscere un aggancio APPENA avvenuto e animarlo una volta sola —
 * vedi renderEquipLinks. Come pileCountsAtLastRender qui sopra, è puro
 * stato di presentazione e vive fuori da gameState.
 */
const equipLinksAtLastRender = new Set();

function pileDepthForCount(count) {
    if (count <= 0) return 0;
    if (count === 1) return 1;
    if (count <= 5) return 2;
    if (count <= 14) return 3;
    if (count <= 29) return 4;
    return 5;
}

/**
 * Le Fusioni che `owner` può Evocare dall'Extra Deck ADESSO senza
 * Polimerizzazione (bandendo i materiali, es. Cannone Drago XYZ): solo
 * nella propria Main Phase e solo per il giocatore davanti allo schermo.
 * Un solo punto per due usi: la pulsazione viola della zona Extra Deck
 * (createSlotElement) e l'elenco che si apre cliccandola. Se le due cose
 * leggessero condizioni diverse, la zona potrebbe pulsare e poi non
 * offrire niente, o il contrario.
 */
function fusioniEvocabiliOra(owner) {
    const isMainPhase = gameState.phase === 'main1' || gameState.phase === 'main2';
    const canAct = owner === 'player' && gameState.currentPlayer === 'player' && isMainPhase && window.DuelEngine;
    return canAct ? DuelEngine.getBanishFusableExtraDeckMonsters('player') : [];
}

function createSlotElement(owner, type, index, options = {}) {
    const slotEl = document.createElement('div');
    slotEl.className = 'field-slot';
    if (options.special) slotEl.classList.add('special-slot');
    // Deck e Cimitero condividono lo stesso linguaggio visivo di "pila di
    // carte coperte" (vedi sotto): stesse classi/offset CSS (.deck-slot,
    // .deck-preview:nth-child), anche se sono due zone di gioco diverse.
    const isPileZone = options.zone === 'deck' || options.zone === 'graveyard' || options.zone === 'fusion';
    if (isPileZone) slotEl.classList.add('deck-slot');
    if (owner === 'bot' && isPileZone) slotEl.classList.add('bot-deck-slot');
    slotEl.dataset.owner = owner;
    slotEl.dataset.type = type;
    if (index !== -1) slotEl.dataset.index = index;
    if (options.zone) slotEl.dataset.zone = options.zone;
    // Extra Deck che pulsa in viola: c'è almeno una Fusione evocabile ora
    // senza Polimerizzazione. Senza questo segnale nessuno scopriva che
    // cliccare la pila serviva a Evocarle. La classe si ricalcola a ogni
    // render, quindi si spegne da sola appena un materiale lascia il Terreno.
    if (options.zone === 'fusion' && fusioniEvocabiliOra(owner).length > 0) {
        slotEl.classList.add('fusion-ready');
    }
    slotEl.onclick = () => {
        // Zona Extra Deck: normalmente solo consultabile (mai un bersaglio
        // di piazzamento — vi si arriva soprattutto tramite la Magia
        // "Fusione", vedi ctx.fusionSummon in js/engine/duel-engine.js). MA
        // alcuni Mostri Extra Deck (es. Cannone Drago XY/XYZ) si Special
        // Summonano bandendo materiali dal proprio Terreno SENZA passare
        // da nessuna Magia — per quelli, cliccare qui sulla propria zona
        // durante la propria Main Phase offre direttamente la scelta di
        // Evocarli (DuelEngine.getBanishFusableExtraDeckMonsters), invece
        // del solo elenco informativo.
        if (options.zone === 'fusion') {
            const banishOptions = fusioniEvocabiliOra(owner);
            if (banishOptions.length > 0 && window.DuelEngineUI) {
                // Tutto l'Extra Deck, con le evocabili che pulsano in viola
                // (opzione `evocabili`): si vede COSA si può Evocare in
                // mezzo a ciò che si possiede, non un elenco a parte. Le
                // evocabili si riconoscono per uid: se una ne fosse priva
                // (non succede con buildExtraDeckFromSpec) si mostrano solo
                // loro, come prima, invece di un elenco tutto spento.
                const conUid = banishOptions.every((o) => o.card.uid != null);
                window.DuelEngineUI.openCardListPicker(conUid ? gameState.playerExtraDeck : banishOptions.map((o) => o.card), {
                    title: '🌀 Evoca dall\'Extra Deck',
                    text: banishOptions.length === 1
                        ? 'La carta in viola si può Special Summonare ora, bandendo i materiali che controlli scoperti sul Terreno. Toccala per Evocarla.'
                        : 'Le carte in viola si possono Special Summonare ora, bandendo i materiali che controlli scoperti sul Terreno. Tocca quella da Evocare.',
                    evocabili: conUid ? banishOptions.map((o) => o.card.uid) : undefined,
                    onSelect: (card) => {
                        const match = banishOptions.find((o) => o.card.uid === card.uid);
                        if (match) {
                            Comandi.esegui('player', { tipo: 'fusioneBandendo', extraDeck: match.extraDeckIndex, materiali: match.materialFieldIndices });
                        }
                    }
                });
                return;
            }
            // L'Extra Deck non è informazione pubblica (a differenza del
            // Cimitero, vedi sotto): consultabile a piacere SOLO il
            // proprio, mai quello dell'avversario — quello resta visibile
            // solo se e quando un vero effetto carta lo rivela (già
            // gestito altrove, non da questo click generico sullo slot).
            if (owner === 'player' && gameState.playerExtraDeck.length > 0 && window.DuelEngineUI) {
                window.DuelEngineUI.openCardListPicker(gameState.playerExtraDeck, {
                    title: '🔗 Extra Deck',
                    text: `${gameState.playerExtraDeck.length} cart${gameState.playerExtraDeck.length === 1 ? 'a' : 'e'} nell'Extra Deck.`,
                    selectable: false
                });
            }
            return;
        }
        // Zona Cimitero: informazione PUBBLICA come nel gioco vero (sempre
        // consultabile, anche quello dell'avversario) — a differenza
        // dell'Extra Deck qui sopra. Mai un bersaglio di piazzamento;
        // stesso modale usato per rianimare/scegliere un mostro.
        if (options.zone === 'graveyard') {
            const graveyard = Tavolo.cimitero(owner);
            if (graveyard.length > 0 && window.DuelEngineUI) {
                window.DuelEngineUI.openCardListPicker(graveyard, {
                    title: owner === 'player' ? '⚰️ Cimitero' : '⚰️ Cimitero dell\'avversario',
                    text: `${graveyard.length} cart${graveyard.length === 1 ? 'a' : 'e'} nel Cimitero.`,
                    selectable: false
                });
            }
            return;
        }
        if (!options.special) {
            handleSlotClick(owner, type, index);
        }
    };

    const pileCount = isPileZone ? (options.count || 0) : 0;
    if (isPileZone && pileCount > 0) {
        CardRenderer.appendDeckPile(slotEl, pileDepthForCount(pileCount));
        // La pila REAGISCE quando riceve una carta: prima Cimitero ed
        // Extra Deck restavano immobili qualunque cosa succedesse, e una
        // carta distrutta spariva dal campo senza che si vedesse dove era
        // finita.
        //
        // Il segnale si ricava confrontando il conteggio con quello del
        // render precedente, NON agganciandosi ai punti che spostano le
        // carte: quelli sono decine sparsi per tutto il motore (ogni
        // effetto che scarta, distrugge, manda al Cimitero...) e
        // aggiungere l'animazione a ciascuno vorrebbe dire dimenticarsene
        // in metà. Così invece vale per ogni strada, comprese quelle che
        // verranno aggiunte in futuro.
        //
        // La classe finisce su un elemento appena creato (renderFields
        // ricostruisce tutto ad ogni updateUI), quindi la keyframe parte
        // da sola dall'inizio; al render successivo il conteggio combacia
        // e la classe non viene più messa, quindi non si ripete in loop.
        const chiavePila = `${owner}-${options.zone}`;
        const precedente = pileCountsAtLastRender[chiavePila];
        // `undefined` = primo render della partita: nessun lampo, o ogni
        // duello si aprirebbe con tutte le pile che sobbalzano.
        if (precedente !== undefined && pileCount > precedente) {
            slotEl.classList.add('pile-receive');
        }
        pileCountsAtLastRender[chiavePila] = pileCount;
    } else if (isPileZone) {
        pileCountsAtLastRender[`${owner}-${options.zone}`] = 0;
    }

    // Con la pila presente, l'etichetta/conteggio testuale centrati
    // (sotto) finirebbero coperti dai dorsi delle carte (z-index più alto)
    // — al loro posto, lo stesso badge a pillola già usato per ATK/DEF
    // sotto le carte in campo (.field-stats-badge), solo col numero di
    // carte: stessa lingua visiva, sempre leggibile sopra la pila.
    if (isPileZone && pileCount > 0) {
        const pileBadge = document.createElement('div');
        pileBadge.className = 'field-stats-badge field-pile-badge';
        pileBadge.textContent = pileCount;
        slotEl.appendChild(pileBadge);
    } else {
        if (options.label) {
            const iconName = FIELD_ZONE_ICONS[options.label];
            const labelEl = document.createElement('div');
            labelEl.title = options.label;
            if (iconName && window.Icons) {
                labelEl.className = 'field-slot-label field-slot-icon';
                labelEl.dataset.icon = iconName;
                slotEl.appendChild(labelEl);
                Icons.hydrate(slotEl);
            } else {
                labelEl.className = 'field-slot-label';
                labelEl.textContent = options.label;
                slotEl.appendChild(labelEl);
            }
        }
        if (options.count !== undefined) {
            const countEl = document.createElement('div');
            countEl.className = 'field-slot-count';
            countEl.textContent = options.count;
            slotEl.appendChild(countEl);
        }
    }

    return slotEl;
}

// Ascoltatore di 'registro': addToLog (js/engine/canale-partita.js) emette,
// qui si scrive la riga nel pannello del duello.
function scriviNelRegistro(message) {
    const log = document.getElementById('gameLog');
    if (!log) {
        console.log(`[Game Log] ${message}`);
        return;
    }

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    // textContent, non innerHTML: `message` spesso incorpora card.name/
    // card.effect (es. "Hai attivato ${card.name}!"), che con le carte
    // personalizzate (crea-carta.html) è testo scelto liberamente
    // dall'utente — un nome tipo "<img src=x onerror=...>" verrebbe
    // altrimenti eseguito. Nessun messaggio di log di questo motore
    // incorpora mai vero markup HTML intenzionale, quindi il cambio non
    // toglie nulla.
    entry.textContent = message;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

/**
 * Cerca i DOM element di `cardIds` (uid REALI, non id-carta) dentro il
 * contenitore DOM `containerId` — helper condiviso da ogni trigger*Win
 * qui sotto per "trova le carte coinvolte da far brillare nella
 * cinematica" (vedi triggerInstantWin). Torna sempre un array (mai
 * null/undefined), filtrando via ogni carta non trovata (contenitore
 * assente, o carta di un giocatore la cui zona non è mostrata a
 * schermo — es. la mano del bot).
 */
function findCardElementsByUid(containerId, cardUids) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return cardUids
        .map((uid) => container.querySelector(`[data-uid="${CSS.escape(uid)}"]`))
        .filter(Boolean);
}

/**
 * Il DOM element di UNA carta che sta sul Terreno, cercato per uid nei
 * soli due tabelloni. Da usare SEMPRE al posto di un
 * `document.querySelector('.card[data-uid=...]')` quando si deve
 * disegnare o posizionare qualcosa sopra una carta in campo.
 *
 * Perché non cercare in tutto il documento, che sarebbe più corto: lo
 * stesso uid compare anche ALTROVE. Il picker delle scelte
 * (`openCardListPicker`, actions.js) costruisce carte vere per
 * mostrarle nella lista, e alla chiusura del modale quegli elementi
 * RESTANO nel documento — nascosti, quindi con un rettangolo 0x0. Un
 * querySelector globale trova per primo quello (viene prima nel
 * documento), e chi lo usa per calcolare una posizione finisce a
 * lavorare su una misura nulla.
 *
 * Non è teorico: è il bug segnalato dall'utente su Richiamo della
 * Mummia (id 670) — la carta scelta dal picker arrivava in campo ma il
 * suo ologramma non compariva mai, perché `MonsterHolograms.sync()`
 * misurava la copia del picker invece della carta vera. Lo stesso
 * valeva per la linea di collegamento delle Carte Equipaggiamento.
 * Dentro i due tabelloni un uid è invece unico, quindi cercare lì
 * chiude il problema alla radice per chiunque, ora e in futuro.
 */
function findFieldCardElementByUid(uid) {
    if (!uid && uid !== 0) return null;
    const selettore = `.card[data-uid="${CSS.escape(String(uid))}"]`;
    return document.querySelector(`#playerFieldBoard ${selettore}`)
        || document.querySelector(`#botFieldBoard ${selettore}`);
}

/**
 * La cinematica di una vittoria istantanea (evento 'vittoria-istantanea',
 * emesso da triggerInstantWin in js/engine/fasi.js, che a cinematica
 * finita registra il messaggio e chiude il duello). Qui solo il disegno:
 * il testo del banner e le carte da far brillare, che dipendono dal tipo
 * — FX.playInstantWinCinematic (effects.js) suona un filmato se esiste
 * video/vittorie/<tipo>.mp4, altrimenti una sequenza CSS.
 *
 * Le carte coinvolte: per Exodia i 5 pezzi in mano, cercati SOLO per il
 * giocatore umano (la mano del bot non è mostrata a schermo, quindi per
 * lui l'elenco resta vuoto e la cinematica salta dritta al flash finale);
 * per Destiny Board le 5 carte scoperte in zona Magia/Trappola del
 * VINCITORE (quella zona è a schermo per entrambi i lati); per Elefante
 * Volante nessuna (una carta sola, la cui abilità ha già finito di
 * risolversi).
 */
function suonaCinematicaVittoria(kind, playerWon, fatto) {
    let bannerText = 'VITTORIA AUTOMATICA';
    let pieceElements = [];
    if (kind === 'exodiawin') {
        bannerText = 'EXODIA IL PROIBITO';
        if (playerWon) {
            pieceElements = findCardElementsByUid('playerHand', gameState.playerHand.filter((card) => EXODIA_PIECE_IDS.includes(card.id)).map((card) => card.uid));
        }
    } else if (kind === 'destinyboard') {
        bannerText = 'FINAL';
        const owner = playerWon ? 'player' : 'bot';
        const stField = Tavolo.magieTrappole(owner);
        const uids = DESTINY_BOARD_CARD_IDS
            .map((id) => stField.find((slot) => slot && !slot.isFaceDown && slot.card.id === id))
            .filter(Boolean)
            .map((slot) => slot.card.uid);
        pieceElements = findCardElementsByUid(owner === 'player' ? 'playerFieldBoard' : 'botFieldBoard', uids);
    }
    if (!window.FX || typeof FX.playInstantWinCinematic !== 'function') { fatto(); return; }
    FX.playInstantWinCinematic(kind, bannerText, pieceElements, fatto);
}

/**
 * Chiude il duello: blocca ogni azione ancora in coda (turni del bot,
 * transizioni di fase) e passa la palla a js/duel-session.js, che sa chi
 * era l'avversario, aggiorna il suo record e mostra la schermata di
 * Vittoria/Sconfitta con il pulsante "Continua".
 * `playerWon`: true/false come sempre, oppure la stringa 'draw' — Pareggio
 * (es. Ultimo Turno, id 341: nessun giocatore resta con un mostro da
 * solo sul Terreno). Un Pareggio non tocca il record V/S del personaggio
 * (recordCharacterResult non viene proprio chiamata, vedi
 * DuelSession.finish) — nessuna modifica allo schema di salvataggio.
 *
 * `opzioni.abbandono`: il duello non è finito giocando, il giocatore si è
 * ritirato (pulsante Abbandona, o "Indietro" confermato). Cambia SOLO i
 * premi — chi si ritira non incassa il premio di partecipazione, vedi
 * js/economy/rewards.js — mentre record V/S, schermata finale e
 * comunicazione all'avversario in Multiplayer restano quelle di una
 * sconfitta normale, perché una sconfitta normale è. Parametro opzionale:
 * ogni altro chiamante di endDuel (sono molti, sparsi fra motore e carte)
 * resta invariato senza doverlo passare.
 *
 * Ascoltatore di 'fine-duello': endDuel (js/engine/canale-partita.js)
 * emette l'avviso PRIMA di segnare il duello come finito, quindi qui
 * gameState.gameOver vale ancora quello di prima — l'invio dell'esito
 * all'avversario qui sotto conta proprio su questo.
 */
function chiudiDuelloASchermo(playerWon, opzioni) {
    const abbandono = !!(opzioni && opzioni.abbandono);
    // In Multiplayer l'esito va COMUNICATO all'avversario, non solo
    // calcolato in casa propria: prima ogni lato lo deduceva da sé dallo
    // stato che credeva di avere, e su una divergenza i due giocatori
    // potevano vedere risultati diversi senza che nulla lo rilevasse.
    // Chi arriva per primo alla conclusione la dichiara, e per l'altro
    // l'esito è rovesciato (la mia vittoria è la sua sconfitta; un
    // pareggio resta un pareggio per entrambi).
    // `MP_ricezioneEsito` evita il rimbalzo infinito quando è proprio il
    // messaggio dell'avversario ad averci portato qui; `gameState.gameOver`
    // già impostato significa che il duello era finito e non c'è nulla da
    // annunciare.
    if (window.MP_broadcast && !window.MP_ricezioneEsito && !gameState.gameOver) {
        window.MP_broadcast({
            kind: 'game-over',
            // Dal punto di vista di CHI RICEVE.
            opponentWon: playerWon === 'draw' ? 'draw' : !playerWon
        });
    }
    gameState.gameOver = true;
    clearPhaseTransitionTimeout();
    stopDuelTimer();
    // Una modale rimasta aperta (o riaperta da un callback già in coda)
    // non deve restare sotto né intercettare la schermata finale.
    sealDuelModalsForOutcome();
    addToLog(playerWon === 'draw' ? '🤝 Il duello finisce in pareggio!' : playerWon ? '🎉 Hai vinto il duello!' : '💀 Hai perso il duello.');

    // Feedback tattile di fine duello (vedi js/native/haptics.js, no-op
    // sul web): nessuna vibrazione per un pareggio, non è né una vittoria
    // né una sconfitta netta.
    if (window.NativeHaptics && playerWon !== 'draw') {
        if (playerWon) NativeHaptics.success(); else NativeHaptics.error();
    }

    if (window.DuelSession) {
        // Un attimo di respiro dopo l'ultimo colpo, prima della schermata finale.
        setTimeout(() => DuelSession.finish(playerWon, { abbandono: abbandono }), 900);
    } else if (playerWon === 'draw') {
        showVictoryScreen('🤝 Pareggio!', 'gray');
    } else {
        showVictoryScreen(playerWon ? '🎉 Hai Vinto!' : '🤖 Il Bot Vince!', playerWon ? 'gold' : 'red');
    }
}

/**
 * Pulsante "Abbandona" (in alto a destra, accanto al contatore turni/tempo):
 * unico modo per uscire da un duello in corso, dato che l'icona 🏠 di
 * ritorno al menu è stata rimossa dalla pagina apposta per questo.
 * Chiede conferma con il modale #surrenderModal e, se confermato, chiude
 * il duello come una sconfitta (endDuel(false) -> stessa animazione/
 * schermata finale di una sconfitta normale, poi si torna al menu duelli
 * tramite DuelSession.finish). Visibile anche in Multiplayer: da quando
 * endDuel() trasmette l'esito al peer, chi abbandona perde e l'avversario
 * riceve subito la vittoria (vedi il commento dentro la funzione).
 */
function setupSurrenderButton() {
    const btn = document.getElementById('surrenderBtn');
    const modal = document.getElementById('surrenderModal');
    if (!btn) return;
    // In Multiplayer il pulsante era NASCOSTO, perché abbandonare avrebbe
    // lasciato l'avversario appeso senza sapere nulla fino allo scadere
    // della finestra di riconnessione. Ora endDuel() trasmette l'esito al
    // peer (vedi lì), quindi chi abbandona perde e l'altro riceve subito
    // la vittoria: il pulsante può tornare visibile ovunque.
    const openConfirm = () => {
        if (gameState.gameOver) return;
        if (!modal) { endDuel(false, { abbandono: true }); return; }
        modal.classList.add('open');
    };
    btn.onclick = openConfirm;
    if (!modal) return;
    const close = () => modal.classList.remove('open');
    document.getElementById('surrenderConfirmBtn').onclick = () => {
        close();
        // Ritiro volontario: nessun premio di partecipazione (vedi endDuel).
        endDuel(false, { abbandono: true });
    };
    document.getElementById('surrenderCancelBtn').onclick = close;
    modal.onclick = (event) => {
        if (event.target === modal) close();
    };

    // "Indietro" del browser durante il duello chiede prima conferma,
    // esattamente come il pulsante Abbandona, invece di uscire di colpo
    // dal duello (e quindi contarlo comunque come sconfitta senza che
    // l'utente l'abbia scelto consapevolmente). Tecnica standard: si
    // aggiunge una voce "sentinella" alla cronologia appena parte il
    // duello, così il PRIMO "indietro" va lì invece che alla pagina
    // precedente vera; ad ogni popstate la si "ripristina" subito (per
    // restare sulla stessa pagina) e si apre il modale di conferma al suo
    // posto — se l'utente conferma, endDuel(false) più sotto naviga via
    // lui stesso (tramite DuelSession.finish -> goBack), stavolta per
    // davvero. Se il duello è già finito lascia fare al browser: a quel
    // punto uscire non ha più nulla da confermare.
    // La voce base viene marcata e la sentinella aggiunta sopra di lei.
    // Quando il duello e' finito, il popstate torna sulla base e il ramo
    // qui sotto la SOSTITUISCE caricando la destinazione: dopo l'uscita,
    // un altro "Indietro" non potra' quindi riaprire la partita conclusa.
    // Tenere qui lo stesso URL e' essenziale anche per l'uso diretto via
    // file://, dove replaceState non puo' cambiare nome del file.
    const duelUrl = location.href;
    const duelReturnUrl = window.DuelSession && DuelSession.returnUrl
        ? new URL(DuelSession.returnUrl, duelUrl).href
        : new URL('index.html', duelUrl).href;
    history.replaceState({ duelReturn: true }, '', duelUrl);
    history.pushState({ duelGuard: true }, '', duelUrl);
    window.addEventListener('popstate', () => {
        if (gameState.gameOver) {
            // popstate cambia l'URL ma non carica il documento associato:
            // replace forza il caricamento vero senza reintrodurre il
            // duello nella cronologia.
            window.location.replace(duelReturnUrl);
            return;
        }
        history.pushState({ duelGuard: true }, '', duelUrl);
        openConfirm();
    });

    // Tasto Indietro HARDWARE Android (Capacitor, solo dentro l'APK — vedi
    // js/native/app-back-button.js): il pushState/popstate qui sopra copre
    // già il caso comune (Capacitor chiama window.history.back(), che
    // scatena comunque un vero evento popstate), ma il default di
    // app-back-button.js ricade su AppPlugin.exitApp() se
    // Capacitor.canGoBack risultasse false per qualunque motivo (es. su
    // Android quel valore riflette lo stato interno della WebView, non
    // sempre garantito allineato subito dopo un pushState) — un'uscita
    // diretta dall'app a metà duello, senza alcuna conferma. Registrare
    // QUI un handler dedicato chiude anche questo caso limite: se il
    // modale di conferma è già aperto lo chiude (equivalente ad
    // "Annulla"), altrimenti lo apre sempre lui, MAI lasciando che il
    // default (history.back()/exitApp()) scatti da solo durante un duello
    // in corso.
    if (window.NativeBackButton) {
        NativeBackButton.setHandler(() => {
            if (gameState.gameOver) return false;
            if (modal.classList.contains('open')) { close(); return true; }
            openConfirm();
            return true;
        });
    }
}

/**
 * Schermata finale di ripiego, usata solo se la pagina viene aperta senza
 * js/duel-session.js (per esempio in un test isolato del motore).
 */
function showVictoryScreen(message, color) {
    const victoryEl = document.createElement('div');
    victoryEl.className = 'victory-screen';
    victoryEl.innerHTML = `<div class="victory-text" style="color: ${color};">${message}</div>
                           <button class="btn" onclick="location.reload()">🔄 Nuova Partita</button>`;
    document.body.appendChild(victoryEl);
}

function setupPhaseStepper() {
    document.querySelectorAll('.phase-step').forEach((step) => {
        const activateStep = () => {
            const targetPhase = step.dataset.phase;
            if (!targetPhase) return;
            handlePhaseStepperClick(targetPhase);
        };
        step.onclick = activateStep;
        step.onkeydown = (event) => {
            if ((event.key === 'Enter' || event.key === ' ') && step.classList.contains('clickable')) {
                event.preventDefault();
                activateStep();
            }
        };
    });
}

function handlePhaseStepperClick(targetPhase) {
    if (gameState.currentPlayer !== 'player') return;
    // Stesse guardie di nextPhase(): niente salti di fase a Catena o
    // finestra di priorità ancora aperta.
    if (window.DuelEngine && (DuelEngine.isChainActive() || (DuelEngine.isPriorityWindowOpen && DuelEngine.isPriorityWindowOpen()))) return;
    // Seconda Battle Phase (Bollettino Meteo id 1035): l'unico passo
    // "all'indietro" ammesso, da Main Phase 2 a Battaglia.
    if (gameState.phase === 'main2' && targetPhase === 'battle' && canConductSecondBattlePhase('player')) {
        Comandi.esegui('player', { tipo: 'fase', verso: 'battle2' });
        return;
    }
    const currentPhaseIndex = phaseOrder.indexOf(gameState.phase);
    const targetPhaseIndex = phaseOrder.indexOf(targetPhase);
    if (targetPhaseIndex <= currentPhaseIndex) return;

    if (targetPhase === 'battle' && gameState.turn === 1) {
        addToLog('❌ Non puoi entrare in Battle Phase nel primo turno.');
        return;
    }

    if (gameState.phase === 'battle' && (targetPhase === 'main2' || targetPhase === 'end') && hasUnfulfilledForcedAttack()) {
        addToLog('❌ Un tuo mostro deve ancora attaccare tutti i mostri avversari prima di lasciare la Battle Phase!');
        return;
    }

    if (targetPhase === 'end') {
        if (['main1', 'battle', 'main2'].includes(gameState.phase)) {
            endTurn();
        }
        return;
    }

    if (gameState.phase === 'draw' && targetPhase === 'standby') {
        enterStandbyPhase();
        return;
    }
    if (gameState.phase === 'standby' && targetPhase === 'main1') {
        enterMainPhase1();
        return;
    }
    if (gameState.phase === 'main1' && targetPhase === 'battle') {
        Comandi.esegui('player', { tipo: 'fase', verso: 'battle' });
        return;
    }
    if (gameState.phase === 'battle' && targetPhase === 'main2') {
        Comandi.esegui('player', { tipo: 'fase', verso: 'main2' });
        return;
    }
    if (['main1', 'battle', 'main2'].includes(gameState.phase) && targetPhase === 'end') {
        endTurn();
        return;
    }
}

/**
 * Cronometro del duello + numero turno, mostrati sotto lo stepper delle
 * fasi (vedi #duelTimerBadge). Parte da initGame() e si ferma quando il
 * duello finisce (checkGameOver), così non continua a girare a vuoto
 * sulla schermata di Vittoria/Sconfitta.
 */
function startDuelTimer() {
    stopDuelTimer();
    duelStartTime = Date.now();
    updateDuelTimer();
    duelTimerInterval = setInterval(updateDuelTimer, 1000);
}

function stopDuelTimer() {
    if (duelTimerInterval) {
        clearInterval(duelTimerInterval);
        duelTimerInterval = null;
    }
}

function updateDuelTimer() {
    const el = document.getElementById('duelTimerBadge');
    if (!el || !duelStartTime) return;
    const elapsed = Math.max(0, Math.floor((Date.now() - duelStartTime) / 1000));
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    // Due pezzi separati, stilati diversamente nel pannello d'angolo in
    // alto a destra (.hud-sistema): solo numeri, niente da sanificare.
    el.innerHTML = `<span class="hud-stat hud-tempo"><span class="hud-lab">Tempo</span><span class="hud-val">${mm}:${ss}</span></span>`
        + `<span class="hud-stat hud-turno"><span class="hud-lab">Turno</span><span class="hud-val">${Number(gameState.turn) || 1}</span></span>`;
}

function updatePhaseIndicator() {
    const currentPhaseIndex = phaseOrder.indexOf(gameState.phase);
    const isPlayerTurn = gameState.currentPlayer === 'player';

    document.querySelectorAll('.phase-step').forEach((step, index) => {
        const targetPhase = step.dataset.phase;
        const phaseName = step.querySelector('.step-label')?.textContent?.trim() || targetPhase;
        const isFirstTurn = gameState.turn === 1;
        const isClickable = isPlayerTurn && (
            (gameState.phase === 'draw' && targetPhase === 'standby') ||
            (gameState.phase === 'standby' && targetPhase === 'main1') ||
            (gameState.phase === 'main1' && ((targetPhase === 'battle' && !isFirstTurn) || targetPhase === 'end')) ||
            (gameState.phase === 'battle' && (targetPhase === 'main2' || targetPhase === 'end')) ||
            (gameState.phase === 'main2' && targetPhase === 'end') ||
            (gameState.phase === 'main2' && targetPhase === 'battle' && canConductSecondBattlePhase('player'))
        );

        step.classList.toggle('completed', index < currentPhaseIndex);
        step.classList.toggle('active', index === currentPhaseIndex);
        step.classList.toggle('clickable', isClickable);
        step.classList.toggle('disabled', !isClickable && index > currentPhaseIndex);
        step.setAttribute('aria-current', index === currentPhaseIndex ? 'step' : 'false');
        step.setAttribute('aria-disabled', isClickable ? 'false' : 'true');
        step.setAttribute('aria-label', index === currentPhaseIndex
            ? `Fase attuale: ${phaseName}`
            : (isClickable ? `Vai alla fase ${phaseName}` : `Fase ${phaseName}`));
        step.title = isClickable ? `Vai alla fase ${phaseName}` : '';
        step.setAttribute('role', isClickable ? 'button' : 'listitem');
        step.tabIndex = isClickable ? 0 : -1;
        step.style.cursor = isClickable ? 'pointer' : 'default';
    });
    // Anche l'indicatore puo' essere aggiornato immediatamente dopo un
    // resize, prima che scada il debounce globale da 120 ms: riallinearlo
    // qui evita un singolo frame con l'offset del viewport precedente.
    syncPhaseStepperToFieldWidth();
}

// Boot del duello: appena questo file viene caricato, la partita parte con
// l'intro cinematografica, che al termine avvia initGame() +
// setupPhaseStepper(). Vale anche in Multiplayer: multiplayer.html carica
// questo script (fra gli altri) solo DOPO che la stanza si è riempita
// (vedi js/multiplayer/mp-lobby.js), quindi "appena caricato" coincide già con "il
// momento giusto per partire", senza bisogno di un flag di rinvio.
if (window.DuelSession) {
    DuelSession.start();
} else {
    initGame();
    setupPhaseStepper();
}
