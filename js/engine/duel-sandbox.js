/**
 * duel-sandbox.js — Avvio di un duello con uno stato di partenza
 * personalizzato invece del solito mazzo vero + pescata.
 * =====================================================================
 * File A PARTE, additivo: NON tocca resetGameState()/initGame()
 * (js/engine/game-flow.js) né alcuna regola del motore
 * (duel-engine.js/actions.js/card-effects.js) — si limita a riusare
 * resetGameState() così com'è (per ottenere uno stato vuoto con la
 * forma giusta, tutte le strutture dati che il resto del motore si
 * aspetta) e poi SOVRASCRIVE mano/campo/Cimitero/LP/fase/turno con la
 * configurazione preparata in duello-sandbox.html.
 *
 * Caricato SOLO da duelMonstersCore.html, e invocato SOLO quando
 * DuelSession.mode === 'sandbox' (vedi start() in js/duel-session.js) —
 * per ogni altro modo di duellare (Demo/Libero/Storia/Multiplayer)
 * questo file esiste ma non viene mai chiamato: zero impatto sul
 * duello "vero".
 */
(function () {
    'use strict';

    const SANDBOX_CONFIG_KEY = 'ygoSandboxConfig';

    /** Genera un uid unico per una carta piazzata dalla sandbox — stesso principio di createRandomCard() in cards-db.js. */
    function makeUid() {
        return 'sandbox-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }

    /**
     * Clona il template di una carta dal database (per id) con un uid
     * tutto suo, o null se l'id non esiste. `cardDatabase` è dichiarata
     * con `const` in cima a js/data/cards-data.generated.js (script
     * classico, non un modulo): un `const`/`let` di primo livello NON
     * diventa mai una proprietà di `window` (a differenza di `var`), pur
     * restando visibile come identificatore nudo a ogni altro script
     * della pagina — quindi il controllo va fatto con `typeof`, MAI con
     * `window.cardDatabase` (sarebbe sempre undefined, bug reale preso
     * qui la prima volta: ogni carta piazzata dalla sandbox risultava
     * "non trovata" e la config veniva applicata come se fosse vuota).
     */
    function instantiateCard(id) {
        const template = typeof cardDatabase !== 'undefined' && cardDatabase.find((c) => c.id === id);
        if (!template) return null;
        return Object.assign({}, template, { uid: makeUid() });
    }

    function buildMonsterSlot(entry) {
        const card = instantiateCard(entry.id);
        if (!card) return null;
        const position = entry.position === 'defense' || entry.position === 'facedown' ? entry.position : 'attack';
        return {
            card: card,
            // "facedown" qui è sempre Difesa coperta (un mostro non si Set
            // mai scoperto in Attacco per regola vera) — la Posizione
            // interna resta 'defense', isFaceDown la distingue da Difesa
            // scoperta, esattamente come altrove nel motore.
            position: position === 'facedown' ? 'defense' : position,
            isFaceDown: position === 'facedown',
            hasAttacked: false,
            canChangePosition: true
        };
    }

    /** Slot Magia/Trappola: Set coperta di base — setOnTurn nel PASSATO (turno corrente - 1) così è già attivabile subito, non "appena piazzata questo turno". Scoperta se entry.faceUp. */
    function buildSTSlot(entry, currentTurn) {
        const card = instantiateCard(entry.id);
        if (!card) return null;
        const faceUp = !!entry.faceUp;
        return {
            card: card,
            isFaceDown: !faceUp,
            setOnTurn: faceUp ? undefined : Math.max(0, currentTurn - 1)
        };
    }

    function buildLooseCard(entry) {
        return instantiateCard(entry.id);
    }

    function readConfig() {
        let raw = null;
        try { raw = sessionStorage.getItem(SANDBOX_CONFIG_KEY); } catch (e) { /* noop */ }
        if (!raw) return null;
        try { return JSON.parse(raw); } catch (e) { return null; }
    }

    function saveConfig(config) {
        try { sessionStorage.setItem(SANDBOX_CONFIG_KEY, JSON.stringify(config)); } catch (e) { /* noop */ }
    }

    function validField(file) {
        return typeof ArenaOptions !== 'undefined'
            && ArenaOptions.FIELDS.some((field) => field.file === file);
    }

    /**
     * Fa partire subito l'evento caratteristico dell'ambiente acceso (un
     * fulmine, una scansione, una folata...), senza aspettare la pausa
     * casuale: in sandbox serve a vedere l'arena appena la si sceglie.
     * Non fa nulla se gli effetti ambientali sono spenti.
     */
    function scattaEvento() {
        if (window.AmbienteWebGL && AmbienteWebGL.attivo()) AmbienteWebGL.scatta();
        else if (window.FieldAmbience && FieldAmbience.attivo()) FieldAmbience.raffica();
    }

    /** Cambia insieme immagine e ambiente animato, senza ricaricare il duello. */
    function changeField(file, config) {
        if (!validField(file)) return false;
        const folder = window.matchMedia('(pointer: coarse)').matches
            ? 'images/fields/mobile/'
            : 'images/fields/';
        window.DUEL_ARENA_CUSTOM_FIELD = file;
        document.body.style.backgroundImage = `url('${folder}${file}')`;
        if (window.FieldAmbience) {
            FieldAmbience.avvia(file);
            scattaEvento();
        }
        if (config) {
            config.field = file;
            saveConfig(config);
        }
        return true;
    }

    function exitSandbox() {
        if (window.FieldAmbience) FieldAmbience.ferma();
        window.location.replace('duello-sandbox.html');
    }

    function setupSandboxControls(config) {
        const surrenderBtn = document.getElementById('surrenderBtn');
        const modal = document.getElementById('surrenderModal');
        const confirmBtn = document.getElementById('surrenderConfirmBtn');
        const cancelBtn = document.getElementById('surrenderCancelBtn');

        // La sandbox non è una partita registrata: uscire non deve passare
        // da endDuel(), premi, statistiche o schermata di sconfitta.
        if (surrenderBtn) {
            surrenderBtn.textContent = '← Esci Sandbox';
            surrenderBtn.onclick = () => modal ? modal.classList.add('open') : exitSandbox();
        }
        if (modal) {
            const title = modal.querySelector('h3');
            const text = modal.querySelector('p');
            if (title) title.textContent = 'Uscire dalla sandbox?';
            if (text) text.textContent = 'Tornerai alla configurazione; lo scenario corrente resta salvato.';
            if (confirmBtn) {
                confirmBtn.textContent = 'Sì, torna al menu sandbox';
                confirmBtn.onclick = exitSandbox;
            }
            const close = () => modal.classList.remove('open');
            if (cancelBtn) cancelBtn.onclick = close;
            modal.onclick = (event) => { if (event.target === modal) close(); };
        }
        if (window.NativeBackButton) {
            NativeBackButton.setHandler(() => {
                if (modal && modal.classList.contains('open')) modal.classList.remove('open');
                else if (modal) modal.classList.add('open');
                else exitSandbox();
                return true;
            });
        }

        if (typeof ArenaOptions === 'undefined') return;
        const tools = document.createElement('div');
        tools.className = 'sandbox-field-tools';
        tools.id = 'sandboxFieldTools';
        const label = document.createElement('label');
        label.htmlFor = 'sandboxFieldSelect';
        label.textContent = 'Field di prova';
        const select = document.createElement('select');
        select.id = 'sandboxFieldSelect';
        ArenaOptions.FIELDS.forEach((field) => {
            const option = document.createElement('option');
            option.value = field.file;
            option.textContent = field.nome;
            select.appendChild(option);
        });
        const initialField = validField(config.field) ? config.field : 'dirigibileKaibaCorp.jpg';
        select.value = initialField;
        select.onchange = () => {
            if (changeField(select.value, config) && typeof addToLog === 'function') {
                addToLog('🌌 Field cambiato: ' + ArenaOptions.nomeCampo(select.value) + '.');
            }
        };
        tools.appendChild(label);
        tools.appendChild(select);

        // Interruttore degli effetti ambientali (i Dettagli video del gioco):
        // su telefono partono da "Normali", quindi senza questo qui non si
        // vedrebbe nulla di ciò che si sta provando. È la stessa impostazione
        // delle Impostazioni, non una copia: scegliere qui vale anche fuori.
        if (window.VideoQuality) {
            const labelFx = document.createElement('label');
            labelFx.htmlFor = 'sandboxFxSelect';
            labelFx.textContent = 'Effetti ambientali';
            labelFx.style.marginTop = '8px';
            const fx = document.createElement('select');
            fx.id = 'sandboxFxSelect';
            VideoQuality.LIVELLI.forEach((livello) => {
                const option = document.createElement('option');
                option.value = livello.valore;
                option.textContent = livello.valore === VideoQuality.ALTI ? 'Accesi (Alti)' : 'Spenti (Normali)';
                fx.appendChild(option);
            });
            fx.value = VideoQuality.get();
            fx.onchange = () => {
                VideoQuality.set(fx.value);
                // set() riavvia l'ambiente del campo corrente da solo.
                scattaEvento();
                if (typeof addToLog === 'function') addToLog('✨ Effetti ambientali: ' + (fx.value === VideoQuality.ALTI ? 'accesi' : 'spenti') + '.');
            };
            const evento = document.createElement('button');
            evento.type = 'button';
            evento.textContent = 'Scatena evento';
            evento.style.cssText = 'width:100%;margin-top:8px;padding:7px 8px;color:#eefaff;background:#16324a;'
                + 'border:1px solid rgba(157,223,255,0.35);border-radius:8px;font:700 0.7rem Arial,sans-serif;cursor:pointer;';
            evento.onclick = scattaEvento;
            tools.appendChild(labelFx);
            tools.appendChild(fx);
            tools.appendChild(evento);
        }
        document.body.appendChild(tools);
        changeField(initialField, config);
    }

    /**
     * Applica la configurazione sandbox su un gameState già "vuoto ma
     * della forma giusta" (uscito da resetGameState()). Ogni owner
     * ('player'/'bot') ha, nella config, { hand:[{id}], graveyard:[{id}],
     * extraDeck:[{id}], banished:[{id}], monsters:[{id,position}] (max 5),
     * spellsTraps:[{id,faceUp}] (max 5) }.
     */
    function applyConfig(config) {
        gameState.turn = Math.max(1, parseInt(config.turn, 10) || 1);
        gameState.phase = config.phase || 'main1';
        gameState.currentPlayer = config.currentPlayer === 'bot' ? 'bot' : 'player';
        gameState.playerLP = Math.max(0, parseInt(config.playerLP, 10) || 8000);
        gameState.botLP = Math.max(0, parseInt(config.botLP, 10) || 8000);
        gameState.hasNormalSummoned = !!config.hasNormalSummoned;

        ['player', 'bot'].forEach((owner) => {
            const cfg = config[owner] || {};
            const handKey = owner + 'Hand';
            const graveKey = owner + 'Graveyard';
            const extraDeckKey = owner + 'ExtraDeck';
            const banishedKey = owner + 'Banished';
            const monsterKey = owner + 'MonsterField';
            const stKey = owner + 'STField';

            gameState[handKey] = (cfg.hand || []).map(buildLooseCard).filter(Boolean);
            gameState[graveKey] = (cfg.graveyard || []).map(buildLooseCard).filter(Boolean);
            gameState[banishedKey] = (cfg.banished || []).map(buildLooseCard).filter(Boolean);
            // Mostri Fusione/Rituale (card.extraDeck === true, es. Drago
            // Bianco Definitivo id 29): vivono nell'Extra Deck, MAI in
            // mano — solo così "Fusione"/id 38 (DuelEngine.getFusableExtraDeckMonsters)
            // li trova per una vera Evocazione Fusione, invece di finire
            // nel flusso di Evocazione Normale/Tributo (bloccato a parte
            // in attemptMonsterSummon, js/engine/actions.js, per card.extraDeck).
            gameState[extraDeckKey] = (cfg.extraDeck || []).map(buildLooseCard).filter(Boolean);

            (cfg.monsters || []).slice(0, 5).forEach((entry, index) => {
                const slot = buildMonsterSlot(entry);
                if (slot) gameState[monsterKey][index] = slot;
            });
            (cfg.spellsTraps || []).slice(0, 5).forEach((entry, index) => {
                const slot = buildSTSlot(entry, gameState.turn);
                if (slot) gameState[stKey][index] = slot;
            });
        });
    }

    /**
     * Punto d'ingresso, chiamato da DuelSession.start() (js/duel-session.js)
     * al posto di initGame() SOLO in modalità sandbox. Niente cinematica
     * d'apertura, niente pescata a scena, niente stagger di rivelazione
     * mano: si atterra SUBITO nello stato configurato, pronti a giocare.
     */
    function initSandboxGame() {
        if (typeof resetGameState !== 'function') {
            console.error('duel-sandbox.js: resetGameState() non trovata — js/engine/game-flow.js non è caricato?');
            return;
        }
        resetGameState();

        if (!document.getElementById('playerHand') || !document.getElementById('playerFieldBoard') || !document.getElementById('botFieldBoard')) {
            console.error('Elementi del campo mancanti nella pagina.');
            return;
        }

        const storedConfig = readConfig();
        const config = storedConfig || {
            playerLP: 8000,
            botLP: 8000,
            turn: 1,
            phase: 'main1',
            currentPlayer: 'player',
            hasNormalSummoned: false,
            field: 'dirigibileKaibaCorp.jpg',
            player: {},
            bot: {}
        };
        if (!storedConfig) {
            addToLog('⚠️ Nessuna configurazione sandbox trovata: torna a "Demo Duello Sandbox" e prepara lo scenario prima di avviare.');
        }

        applyConfig(config);
        setupSandboxControls(config);
        startDuelTimer();
        updateUI();
        addToLog('🧪 Sandbox avviata con lo stato personalizzato che hai preparato.');
    }

    window.initSandboxGame = initSandboxGame;
    window.SandboxDuel = { changeField: changeField, exit: exitSandbox };
})();
