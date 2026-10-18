// @ts-check
/**
 * custom-cards.js — Carte create dall'utente, dati per un futuro Card
 * Maker (nessuna UI qui: solo l'API che una futura schermata "Crea
 * Carta" userà). Stesso pattern di js/save-manager.js: un array JSON in
 * localStorage, niente server (coerente col resto del gioco, che apre i
 * file .html direttamente — vedi il commento in js/data/cards-db.js).
 *
 * Una carta custom usa ESATTAMENTE lo stesso schema di data/cards.json,
 * con in più gli agganci opzionali alle librerie riutilizzabili:
 *   "effectTemplate": { "name": ..., "params": {...} }  — vedi js/engine/effect-templates.js
 *   "cloneEffectOf": <id di un'altra carta già registrata>
 *   "visualEffect": "glow-oro"                           — vedi js/ui/visual-effects-library.js
 * Il loader in fondo a js/engine/card-effects.js registra automaticamente
 * effectTemplate/cloneEffectOf per QUALUNQUE carta in cardDatabase,
 * comprese queste — una carta custom gioca quindi esattamente come una
 * carta "vera", senza nessun trattamento speciale nel motore.
 *
 * Id riservati: 100000+, così una carta custom non può MAI collidere con
 * le 508 carte base di data/cards.json (assegnato automaticamente da
 * add(), mai scelto da chi chiama).
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'yugioh_custom_cards_v1';
    const ID_BASE = 100000;

    function loadAll() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.warn('[CustomCards] localStorage illeggibile, riparto da zero.', e);
            return [];
        }
    }

    // Alzato mentre si sta APPLICANDO lo stato arrivato dal cloud
    // (replaceAll): senza, il salvataggio locale che ne consegue
    // rilancerebbe subito un push verso il cloud di quello che si è appena
    // scaricato — inutile, e una corsa contro il pull ancora in corso.
    let applyingRemote = false;

    function saveAll(cards) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
        } catch (e) {
            console.warn('[CustomCards] impossibile salvare in localStorage.', e);
        }
        if (applyingRemote) return;
        // Unico punto da cui passa OGNI scrittura di questo modulo, quindi
        // l'unico posto dove serve avvisare il cloud: una funzione futura
        // che salvi carte è coperta da sola (vedi js/cloud/auto-sync.js).
        // Se la pagina non lo carica non succede nulla: il salvataggio
        // locale qui sopra è comunque già avvenuto.
        if (window.AutoSync) AutoSync.cartePersonalizzateCambiate();
    }

    function nextId(existing) {
        const maxId = existing.reduce((max, c) => Math.max(max, c.id || 0), ID_BASE - 1);
        return maxId + 1;
    }

    /**
     * true se `name` è già usato (confronto case-insensitive) da un'altra
     * carta custom nella STESSA provenienza `origin` — il vincolo di
     * unicità è PER PROVENIENZA, non globale: la stessa carta può
     * esistere in provenienze diverse (richiesta esplicita dell'utente),
     * ma non due volte nella stessa. `excludeId` esclude una carta da sé
     * stessa durante una modifica (update() qui sotto).
     */
    function nameTakenInOrigin(name, origin, excludeId) {
        const trimmed = (name || '').toString().trim().toLowerCase();
        return loadAll().some((c) => c.id !== excludeId && c.origin === origin && (c.name || '').toString().trim().toLowerCase() === trimmed);
    }

    /**
     * Aggiunge una carta custom. `cardData` è lo stesso schema di
     * data/cards.json (name, type, attributi, stats...), con gli agganci
     * opzionali descritti in testa al file — nessun campo è obbligatorio
     * oltre a name/type, così anche una carta "solo testo" (senza motore
     * dietro, come tante carte artOnly già in data/cards.json) è valida.
     * Rifiuta un nome già usato da un'altra carta nella stessa
     * provenienza (nameTakenInOrigin qui sopra). Torna
     * { success: false, reason: 'invalid'|'duplicate-name' } oppure
     * { success: true, card } (con l'id assegnato).
     */
    function add(cardData) {
        if (!cardData || !cardData.name || !['monster', 'spell', 'trap'].includes(cardData.type)) {
            console.warn('[CustomCards] carta non valida (serve almeno name + type):', cardData);
            return { success: false, reason: 'invalid' };
        }
        const origin = cardData.origin || 'fanmade';
        if (nameTakenInOrigin(cardData.name, origin, null)) {
            return { success: false, reason: 'duplicate-name' };
        }
        const existing = loadAll();
        const card = Object.assign({}, cardData, {
            id: nextId(existing),
            origin: origin,
            custom: true
        });
        existing.push(card);
        saveAll(existing);
        return { success: true, card: card };
    }

    /**
     * Aggiorna una carta custom esistente (per id) fondendo `patch` sui
     * campi già salvati — stesso vincolo di unicità nome-per-provenienza
     * di add() qui sopra, ma escludendo la carta stessa dal controllo
     * (così può restare col proprio nome invariato, o cambiare
     * provenienza mantenendo un nome già usato in quella VECCHIA). Torna
     * { success: false, reason } oppure { success: true, card }.
     */
    function update(id, patch) {
        const existing = loadAll();
        const index = existing.findIndex((c) => c.id === id);
        if (index === -1) return { success: false, reason: 'not-found' };
        const merged = Object.assign({}, existing[index], patch, { id: id, custom: true });
        if (!merged.name || !['monster', 'spell', 'trap'].includes(merged.type)) {
            return { success: false, reason: 'invalid' };
        }
        if (nameTakenInOrigin(merged.name, merged.origin, id)) {
            return { success: false, reason: 'duplicate-name' };
        }
        existing[index] = merged;
        saveAll(existing);
        return { success: true, card: merged };
    }

    /** Elenca tutte le carte custom salvate (array vuoto se nessuna). */
    function list() {
        return loadAll();
    }

    /** Rimuove una carta custom per id. */
    function remove(id) {
        saveAll(loadAll().filter((c) => c.id !== id));
    }

    /**
     * Sostituisce TUTTE le carte custom salvate con `cards` — usata da
     * js/cloud/cloud-sync.js dopo aver scaricato le carte sincronizzate da
     * Supabase, per allineare questo dispositivo a quanto salvato altrove
     * (stesso principio di SaveManager.applyExternalSave). Nessuna
     * validazione oltre "è un array": il chiamante è responsabile del
     * formato (qui arrivano sempre carte già passate da add() altrove).
     */
    function replaceAll(cards) {
        applyingRemote = true;
        try { saveAll(Array.isArray(cards) ? cards : []); }
        finally { applyingRemote = false; }
    }

    /**
     * Fonde le carte custom salvate in cardDatabase — va chiamata una
     * sola volta all'avvio, subito dopo che cardDatabase esiste (vedi
     * l'ordine degli <script> in duelMonstersCore.html/cartoteca.html/
     * creazione-deck.html: questo file va DOPO js/data/cards-data.generated.js
     * e js/data/cards-db.js). Idempotente: non duplica una carta già presente
     * (utile se questo script girasse più di una volta per errore).
     */
    function mergeIntoCardDatabase() {
        if (typeof cardDatabase === 'undefined' || !Array.isArray(cardDatabase)) return;
        loadAll().forEach((card) => {
            if (!cardDatabase.some((c) => c.id === card.id)) cardDatabase.push(card);
        });
    }

    window.CustomCards = { add: add, update: update, list: list, remove: remove, replaceAll: replaceAll, mergeIntoCardDatabase: mergeIntoCardDatabase };

    mergeIntoCardDatabase();
})();
