/**
 * challenge-tracker.js — Motore di tracking delle Sfide (js/data/challenges-db.js).
 * =====================================================================
 * Un solo punto di aggancio generico, `recordProgress(type, params)`,
 * chiamato dagli hook nel motore di duello (oggi: js/duel-session.js
 * dopo una vittoria, js/engine/duel-engine.js dopo un'Evocazione) — fa
 * il matching contro il catalogo invece di avere una funzione dedicata
 * per ogni singola sfida, così una FUTURA sfida con un `type` già
 * esistente (es. un'altra carta da evocare N volte) non richiede
 * nessuna modifica qui, solo una nuova voce in challenges-db.js.
 *
 * Il progresso vive nel salvataggio persistente (js/save-manager.js,
 * SaveManager.getChallengeProgress/setChallengeProgress) — non in
 * memoria: sopravvive alla navigazione tra pagine, dato che il motore
 * di duello e la pagina sfide.html sono documenti separati.
 */
(function () {
    'use strict';

    // sessionStorage (non localStorage: solo per QUESTA sessione di
    // navigazione, si autopulisce riaprendo il browser) — vedi
    // announceCompletion()/drainPendingBanners() più sotto.
    const PENDING_KEY = 'duelArenaPendingChallengeBanners';

    function getDefinitions() {
        return (typeof challengesDatabase !== 'undefined') ? challengesDatabase : [];
    }

    // ================================================================
    // MISSIONI A ROTAZIONE (js/data/missions-db.js)
    // ================================================================
    // Stesso motore di matching delle Sfide — stessi `type`, stesso
    // `match` — ma con due differenze che è tutto il punto:
    //   1) quali sono cambia ogni giorno e ogni settimana, sorteggiate da
    //      un pool con il seme della CHIAVE DEL PERIODO;
    //   2) il progresso scade con il periodo (SaveManager.getMissionProgress).
    //
    // Il sorteggio è deterministico e copiato nella forma da quello delle
    // carte del giorno del Negozio (js/economy/shop-catalog.js): stesso
    // hash, stesso PRNG. Deve esserlo: due giocatori nello stesso giorno
    // devono vedere le stesse missioni, e riaprendo la pagina dieci volte
    // non devono cambiare. Un Math.random() qui darebbe missioni nuove ad
    // ogni caricamento, cioè nessuna missione affatto.
    const QUANTE = { daily: 4, weekly: 10 };

    function getMissionDefs() {
        return (typeof missionsDatabase !== 'undefined') ? missionsDatabase : [];
    }

    /** La chiave del periodo secondo il SERVER — mai l'orologio del dispositivo, che si può spostare. */
    function chiavePeriodo(ambito) {
        if (!window.ServerDate) return ambito === 'weekly' ? 'W' : 'D';
        return ambito === 'weekly' ? ServerDate.weekKey() : ServerDate.dayKey();
    }

    function hash(testo) {
        let h = 2166136261;
        for (let i = 0; i < testo.length; i++) {
            h ^= testo.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }
    function rng(seed) {
        let s = seed || 1;
        return function () {
            s ^= s << 13; s >>>= 0;
            s ^= s >> 17;
            s ^= s << 5; s >>>= 0;
            return s / 4294967296;
        };
    }
    function pesca(pool, quanti, random) {
        const copia = pool.slice();
        const out = [];
        for (let i = 0; i < quanti && copia.length > 0; i++) {
            out.push(copia.splice(Math.floor(random() * copia.length), 1)[0]);
        }
        return out;
    }

    /**
     * La descrizione col numero al posto di {n}, e al singolare quando il
     * numero è uno: "Evoca 1 volte il Mago Nero" si legge come un difetto,
     * perché lo è.
     *
     * L'elenco è CHIUSO e cortissimo apposta: sono le uniche parole che le
     * missioni mettono dopo il numero, e si vedono tutte scorrendo
     * js/data/missions-db.js. Una libreria di pluralizzazione italiana per
     * quattro parole sarebbe sproporzionata, e una regola automatica
     * ("togli la i finale") sbaglierebbe alla prima parola che non
     * rientra. Aggiungendone una nuova, va aggiunta anche qui — ed è il
     * motivo per cui questo commento esiste.
     */
    const SINGOLARE = { volte: 'volta', Duelli: 'Duello', tornei: 'torneo', Oggetti: 'Oggetto', mostri: 'mostro', carte: 'carta' };

    function descrizione(testo, target) {
        let out = String(testo || '').replace('{n}', target);
        if (target !== 1) return out;
        Object.keys(SINGOLARE).forEach((plurale) => {
            out = out.replace('1 ' + plurale, '1 ' + SINGOLARE[plurale]);
        });
        return out;
    }

    /**
     * Le missioni di questo periodo, già adattate all'ambito: `target` e
     * `reward` sono quelli giusti (una missione 'both' ne ha due giochi,
     * uno per le giornaliere e uno per le settimanali) e la descrizione ha
     * il numero al posto di {n}.
     *
     * Il roster sorteggiato viene anche SALVATO: non perché serva a
     * ricalcolarlo — il sorteggio è deterministico e verrebbe identico —
     * ma perché il giorno in cui il pool cambiasse (una missione aggiunta
     * o tolta) chi ha una missione a metà non se la vedrebbe sparire da
     * sotto le mani a metà giornata.
     */
    function getMissions(ambito) {
        const settimanale = ambito === 'weekly';
        const pool = getMissionDefs().filter((m) => m.scope === ambito || m.scope === 'both');
        if (pool.length === 0) return [];
        const chiave = chiavePeriodo(ambito);

        let ids = window.SaveManager ? SaveManager.getMissionRoster(ambito, chiave) : null;
        // Un elenco salvato che nomina una missione ormai fuori da questo pool (il catalogo e' cambiato nel frattempo, es. le
        // giornaliere generiche al posto di quelle a tema) non si puo' mostrare: si rifa. Senza questo, il giorno dell'aggiornamento
        // chi aveva gia' l'elenco di oggi si ritrovava con la scheda vuota.
        if (ids && ids.some((id) => !pool.some((m) => m.id === id))) ids = null;
        if (!ids) {
            const quante = Math.min(QUANTE[ambito] || 3, pool.length);
            // Se il pool non ha piu' voci di quante ne servono (le 4 giornaliere) non c'e' nulla da sorteggiare: tutte, nell'ordine
            // del catalogo, cosi' non cambiano nemmeno di posto da un giorno all'altro.
            ids = (pool.length <= quante ? pool
                : pesca(pool, quante, rng(hash('missioni-' + ambito + '-' + chiave)))).map((m) => m.id);
            if (window.SaveManager) SaveManager.setMissionRoster(ambito, chiave, ids);
        }

        const progresso = window.SaveManager ? SaveManager.getMissionProgress(ambito, chiave) : {};
        return ids.map((id) => {
            const def = pool.find((m) => m.id === id);
            if (!def) return null;
            const target = (settimanale && def.targetWeekly) || def.target;
            const reward = (settimanale && def.rewardWeekly) || def.reward;
            const p = progresso[id] || { count: 0, completed: false };
            return Object.assign({}, def, {
                ambito: ambito,
                target: target,
                reward: reward,
                description: descrizione(def.description, target),
                count: Math.min(p.count || 0, target),
                completed: !!p.completed
            });
        }).filter(Boolean);
    }

    /**
     * Fa avanzare le missioni del periodo corrente, se l'evento le
     * riguarda. Chiamata da recordProgress insieme alle Sfide: un evento
     * di gioco non deve sapere che esistono due elenchi diversi.
     */
    function recordMissionProgress(type, params) {
        if (!window.SaveManager) return;
        ['daily', 'weekly'].forEach((ambito) => {
            const chiave = chiavePeriodo(ambito);
            getMissions(ambito).forEach((m) => {
                if (m.completed || !matchesDef(m, type, params)) return;
                const count = m.count + 1;
                const completed = count >= m.target;
                SaveManager.setMissionProgress(ambito, chiave, m.id, {
                    count: count, completed: completed
                });
                if (!completed) return;
                const premi = (window.Rewards && typeof Rewards.forChallenge === 'function')
                    ? Rewards.forChallenge(m) : [];
                announceCompletion(m, premi);
            });
        });
    }

    /**
     * Un `match` vuoto accetta qualunque evento di quel tipo ("vinci 10
     * duelli, contro chiunque"); ogni chiave elencata deve invece
     * combaciare.
     *
     * Il valore puo' essere un ELENCO, e allora basta che l'evento sia
     * uno di quelli: serve alle sfide che parlano di un gruppo di carte
     * invece che di una sola ("evoca 3 volte un Dio Egizio"). Senza,
     * l'unico modo di scriverne una sarebbe sceglierne una delle tre e
     * mentire nella descrizione.
     */
    function matchesDef(def, type, params) {
        if (def.type !== type) return false;
        const match = def.match || {};
        return Object.keys(match).every((key) => {
            const atteso = match[key];
            return Array.isArray(atteso)
                ? atteso.indexOf(params[key]) !== -1
                : atteso === params[key];
        });
    }

    /**
     * Punto unico di aggancio per OGNI evento di gioco trackabile da una
     * sfida. `type` è la categoria (es. 'defeatCharacter', 'summonMonster',
     * 'winDuels' — vedi il commento in cima a challenges-db.js), `params`
     * sono i dati dell'evento appena successo (es. { characterId: 'kaiba' }
     * o { cardId: 1 }) confrontati contro il campo `match` di ogni sfida
     * del catalogo. Una sfida già completata non viene più incrementata
     * (il contatore resta fermo al target).
     */
    function recordProgress(type, params) {
        if (!window.SaveManager) return;
        params = params || {};
        // Lo STESSO evento fa avanzare sia le Sfide sia le missioni del
        // giorno e della settimana: chi lo segnala (il motore di duello,
        // la Storia) non deve sapere che esistono due elenchi diversi, né
        // ricordarsi di chiamare due funzioni.
        recordMissionProgress(type, params);
        const defs = getDefinitions().filter((def) => matchesDef(def, type, params));
        if (defs.length === 0) return;

        defs.forEach((def) => {
            const progress = SaveManager.getChallengeProgress(def.id);
            if (progress.completed) return;
            const count = (progress.count || 0) + 1;
            const completed = count >= def.target;
            SaveManager.setChallengeProgress(def.id, {
                count: count,
                completed: completed,
                completedAt: completed ? new Date().toISOString() : null
            });
            if (!completed) return;
            // Prima si PAGA, poi si annuncia — e in questo ordine: il
            // banner mostra le voci ricevute, quindi devono esistere già.
            //
            // L'accredito passa da Rewards ed è l'unico punto che tocca
            // le valute per una Sfida: la regola in testa a
            // js/economy/rewards.js dice che nessuna pagina assegna
            // valute per conto proprio, e vale anche qui.
            //
            // Sta DENTRO il ramo "appena completata", che gira una volta
            // sola perché poco sopra si esce subito se la sfida risulta
            // già completata: senza quella guardia, ogni evento
            // successivo dello stesso tipo ripagherebbe lo stesso premio.
            const premi = (window.Rewards && typeof Rewards.forChallenge === 'function')
                ? Rewards.forChallenge(def)
                : [];
            announceCompletion(def, premi);
        });
    }

    /**
     * Mostra il banner "Sfida completata" SUBITO se la pagina corrente ha
     * caricato js/ui/challenge-banner.js — altrimenti la accoda in
     * sessionStorage perché la PROSSIMA pagina che carica il banner
     * (qualunque essa sia) la mostri al proprio avvio, invece di perderla
     * silenziosamente. Generico apposta: un futuro hook aggiunto su
     * un'altra pagina funziona allo stesso identico modo, senza bisogno
     * di toccare questa funzione.
     */
    function announceCompletion(def, premi) {
        // `premi` sono le voci GIÀ accreditate (vedi recordProgress): qui
        // si trasportano soltanto, perché il banner le mostri. Vanno in
        // coda insieme alla sfida se il banner non c'è su questa pagina —
        // altrimenti il giocatore vedrebbe più tardi "Sfida completata!"
        // senza sapere che cosa ha preso, e i crediti sarebbero comparsi
        // dal nulla.
        const voci = premi || [];
        if (window.ChallengeBanner && typeof ChallengeBanner.show === 'function') {
            ChallengeBanner.show(def, voci);
            return;
        }
        try {
            const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || '[]');
            pending.push({ id: def.id, label: def.label, description: def.description, icon: def.icon, rewards: voci });
            sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        } catch (e) { /* noop */ }
    }

    /** Chiamata da js/ui/challenge-banner.js al proprio avvio: ritorna e svuota le sfide completate altrove ma non ancora mostrate all'utente. */
    function drainPendingBanners() {
        let pending = [];
        try {
            pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || '[]');
            sessionStorage.removeItem(PENDING_KEY);
        } catch (e) { /* noop */ }
        return pending;
    }

    /** Per sfide.html: ogni sfida del catalogo con il proprio progresso attuale unito dentro (count/completed/completedAt), pronta da renderizzare. */
    function getAllWithProgress() {
        return getDefinitions().map((def) => {
            const progress = window.SaveManager ? SaveManager.getChallengeProgress(def.id) : { count: 0, completed: false, completedAt: null };
            return Object.assign({}, def, {
                count: Math.min(progress.count || 0, def.target),
                completed: !!progress.completed,
                completedAt: progress.completedAt || null
            });
        });
    }

    /**
     * Le Sfide raggruppate come sfide.html le mostra: le generiche (tutte
     * quelle senza `sezione`, cioè il grosso del catalogo) e una sezione
     * per ogni campagna della Storia.
     *
     * Il raggruppamento sta QUI e non nella pagina perché la stessa
     * domanda ("di che sezione è questa sfida?") la fanno anche il banner
     * e, un domani, qualunque altra schermata: due copie della regola
     * divergerebbero al primo tipo nuovo.
     */
    function getSezioni() {
        const tutte = getAllWithProgress();
        const generiche = tutte.filter((c) => c.sezione !== 'storia' && c.sezione !== 'modalita');
        const perStoria = {};
        tutte.filter((c) => c.sezione === 'storia').forEach((c) => {
            const id = c.campaignId || 'altro';
            (perStoria[id] = perStoria[id] || []).push(c);
        });
        // Le sfide delle modalità (Puzzle, Rivincite, Torre): una sezione
        // per modalità, come le storie lo sono per campagna.
        const perModalita = {};
        tutte.filter((c) => c.sezione === 'modalita').forEach((c) => {
            const id = c.modalita || 'altro';
            (perModalita[id] = perModalita[id] || []).push(c);
        });
        return { generiche: generiche, storie: perStoria, modalita: perModalita };
    }

    window.ChallengeTracker = {
        recordProgress: recordProgress,
        /** Annuncia un premio che non viene da una Sfida (es. una illustrazione di una Storia): { icon, label, description } + le voci. */
        announce: announceCompletion,
        drainPendingBanners: drainPendingBanners,
        getAllWithProgress: getAllWithProgress,
        getSezioni: getSezioni,
        /** Le missioni di questo periodo: ambito 'daily' (4, sempre le stesse) o 'weekly' (10 sorteggiate). */
        getMissions: getMissions
    };
})();
