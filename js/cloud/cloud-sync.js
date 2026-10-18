/**
 * cloud-sync.js — Autenticazione (con approvazione admin, replica dello
 * stesso meccanismo del progetto "Fioxify" — stesso autore) e
 * sincronizzazione del salvataggio giocatore (js/save-manager.js) e
 * delle carte custom (js/data/custom-cards.js) via Supabase.
 * =====================================================================
 * Se js/cloud/supabase-config.js non è compilato (o il client
 * js/vendor/supabase.min.js non è caricato), window.CloudSync esiste
 * comunque ma con `available: false` e ogni funzione torna una Promise
 * rifiutata con un messaggio chiaro. CARICATO DA OGNI PAGINA del gioco
 * (js/cloud/auth-gate.js lo usa per decidere se mostrare la pagina o
 * rimandare al login — vedi lì), non più solo da profilo.html/index.html
 * come quando la sincronizzazione era puramente facoltativa: l'accesso
 * con un account approvato è ora OBBLIGATORIO per giocare (decisione
 * esplicita dell'utente, non più "continua in locale").
 *
 * Modello dati: vedi supabase/schema.sql.
 *   - public.profiles: una riga per utente (creata da sola alla
 *     registrazione), status ('pending'/'approved'/'rejected') + is_admin
 *     — signIn nega l'accesso finché lo status non è 'approved' (o
 *     is_admin), ensureApprovedSession() è il controllo usato da
 *     auth-gate.js ad ogni caricamento pagina (funziona anche offline
 *     dopo un primo accesso online riuscito, vedi il commento lì).
 *   - public.saves: una riga per utente, colonna `data` jsonb = ESATTAMENTE
 *     l'oggetto di SaveManager.load() (nome, deck, deck attivo, record,
 *     valute, pacchetti posseduti).
 *   - public.custom_cards: una riga per CARTA custom (non un blob unico),
 *     colonna `card` jsonb = un elemento di CustomCards.list().
 * Sincronizzazione a "sostituzione completa" (non merge/diff campo per
 * campo): push scrive lo stato locale sopra quello cloud, pull scrive
 * quello cloud sopra quello locale — semplice e prevedibile, il prezzo è
 * che va SEMPRE l'utente a scegliere quale dei due tenere quando
 * entrambi esistono già (vedi profilo.html, che orchestra la scelta).
 */
(function () {
    'use strict';

    const config = window.SUPABASE_CONFIG || {};
    const hasConfig = !!(config.url && config.anonKey);
    const hasLib = typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function';
    const available = hasConfig && hasLib;

    const client = available ? window.supabase.createClient(config.url, config.anonKey) : null;

    const NOT_AVAILABLE_ERROR = new Error('Sincronizzazione cloud non configurata: vedi js/cloud/supabase-config.js.');
    function rejectUnavailable() {
        return Promise.reject(NOT_AVAILABLE_ERROR);
    }

    // ------------------------------------------------------------------
    // Autenticazione
    // ------------------------------------------------------------------
    let cachedUser = null;
    // Stato di approvazione del profilo (public.profiles — vedi
    // supabase/schema.sql, sezione "APPROVAZIONE ADMIN", replica dello
    // stesso meccanismo del progetto Fioxify) — { status, is_admin } o
    // null finché non ancora noto. Aggiornato da refreshProfile() più
    // sotto, MAI letto direttamente dal chiamante: usa isApproved()/
    // isAdmin()/getProfile().
    let cachedProfile = null;
    const authListeners = [];
    // Ascoltatori dell'evento 'PASSWORD_RECOVERY': separati da authListeners
    // sopra perché non è un cambio "loggato/sloggato" come gli altri, ma un
    // momento preciso e transitorio (l'utente ha appena cliccato il link
    // ricevuto via email) in cui chi ascolta deve mostrare "imposta una
    // nuova password", non il solito stato loggato/sloggato — vedi
    // resetPassword/updatePassword più sotto.
    const recoveryListeners = [];

    function notifyAuthListeners() {
        authListeners.forEach((fn) => { try { fn(cachedUser); } catch (e) { /* noop */ } });
    }

    // Chiave localStorage per l'ultimo stato di approvazione CONFERMATO
    // online per un dato utente — NON una cache HTTP/Service-Worker, ma
    // un marcatore esplicito legato all'uid, usato SOLO da
    // ensureApprovedSession() più sotto per restare utilizzabile offline
    // (es. l'APK dopo il primo accesso online, vedi il commento lì) senza
    // dover fingere che "loggato" implichi "approvato" — un utente il cui
    // account viene rifiutato/revocato DOPO il primo accesso resta
    // bloccato al prossimo controllo online, non per sempre offline.
    const APPROVED_UID_KEY = 'ygoApprovedUserId';
    function rememberApproved(userId) {
        try { localStorage.setItem(APPROVED_UID_KEY, userId); } catch (e) { /* noop */ }
    }
    function forgetApproved() {
        try { localStorage.removeItem(APPROVED_UID_KEY); } catch (e) { /* noop */ }
    }
    function wasApprovedOffline(userId) {
        try { return localStorage.getItem(APPROVED_UID_KEY) === userId; } catch (e) { return false; }
    }

    // Gemello del marcatore qui sopra, per il flag di amministratore.
    // Serve perché cachedProfile si popola in modo ASINCRONO (fetchProfile
    // interroga il database), mentre isAdmin() viene interrogata subito al
    // caricamento della pagina — per esempio da SaveManager.getOwnedCount,
    // che decide se mostrare una carta come posseduta o in bianco e nero.
    // Senza questo, un amministratore vedeva l'intera Cartoteca a 0 copie
    // finché il profilo non arrivava, e nessuno ridisegnava la griglia
    // dopo. Il marcatore rende la risposta immediata e corretta dal primo
    // istante, e viene riscritto (o cancellato) ad ogni verifica online
    // riuscita: se un account smette di essere admin, al primo controllo
    // torna un utente normale.
    const ADMIN_UID_KEY = 'ygoAdminUserId';
    function rememberAdmin(userId) {
        try { localStorage.setItem(ADMIN_UID_KEY, userId); } catch (e) { /* noop */ }
    }
    function forgetAdmin() {
        try { localStorage.removeItem(ADMIN_UID_KEY); } catch (e) { /* noop */ }
    }
    /**
     * `userId` noto -> deve combaciare (altro account su questo
     * dispositivo = non sei tu). Utente non ancora noto (la sessione si
     * risolve anch'essa in modo asincrono) -> basta la presenza del
     * marcatore: al massimo si mostra qualche carta come posseduta per
     * un istante, e il primo controllo del profilo corregge. L'alternativa
     * — rispondere "non sei admin" durante quell'istante — è peggio:
     * è esattamente il caso in cui la Cartoteca veniva disegnata tutta
     * in bianco e nero e non la ridisegnava più nessuno.
     */
    function wasAdminOffline(userId) {
        try {
            const marker = localStorage.getItem(ADMIN_UID_KEY);
            if (!marker) return false;
            return userId ? marker === userId : true;
        } catch (e) { return false; }
    }

    /** Interroga public.profiles per l'utente `userId` — status 'pending' di default se la riga non esiste ancora o la query fallisce (es. offline: vedi ensureApprovedSession, che non passa mai da qui per il percorso offline). */
    function fetchProfile(userId) {
        return client.from('profiles').select('status, is_admin').eq('id', userId).single()
            .then(({ data, error }) => {
                if (error) return { status: 'pending', is_admin: false };
                return data;
            });
    }

    // Promise risolta la PRIMA volta che la sessione persistita (se
    // esiste — sopravvive alla chiusura della pagina/app, vedi il
    // supabase-js sotto, che la tiene in localStorage per default) viene
    // davvero letta — a differenza di onAuthChange (che chiama subito il
    // suo ascoltatore con cachedUser, ma quello vale ANCORA null al primo
    // giro perché getSession() è asincrona), questa Promise è il modo
    // corretto per un chiamante come js/cloud/auth-gate.js di aspettare
    // lo stato VERO prima di decidere se rimandare al login — usata da
    // waitForUser() più sotto.
    // ------------------------------------------------------------------
    // Durata della sessione: 48 ore, poi si rifà l'accesso
    // ------------------------------------------------------------------
    /**
     * Supabase mantiene la sessione per sempre (il refresh token si rinnova
     * da sé): senza un limite nostro, un dispositivo resta collegato finché
     * qualcuno non preme Esci. Il limite è LATO CLIENT, perché il blocco
     * della durata massima di una sessione è un'impostazione a pagamento del
     * progetto Supabase: serve a decidere quando ripetere il login, non è
     * una barriera di sicurezza contro chi manipola il dispositivo (quella
     * restano le regole RLS sul database).
     *
     * `ygoSessioneInizio` = { uid, at }: l'istante dell'accesso con email e
     * password (signIn) su QUESTO dispositivo. Una sessione già attiva prima
     * di questa regola non ha il segno: parte da adesso (e non si caccia
     * fuori tutti al primo avvio dopo l'aggiornamento).
     *
     * Scaduta: si salva il salvataggio sul cloud (mai perdere ore di gioco
     * per un limite di tempo), si esce, e il menu mostra l'avviso. Il
     * controllo gira all'avvio, ogni 5 minuti e quando si torna in primo
     * piano (l'APK resta aperta in sottofondo per giorni). Mai a metà di un
     * duello: lì si aspetta la fine.
     */
    const SESSIONE_MAX_MS = 48 * 60 * 60 * 1000;
    const CHIAVE_SESSIONE = 'ygoSessioneInizio';
    const CHIAVE_AVVISO_SCADENZA = 'ygoSessioneScaduta';

    function inizioSessione() {
        try {
            const s = JSON.parse(localStorage.getItem(CHIAVE_SESSIONE));
            return s && cachedUser && s.uid === cachedUser.id && Number.isFinite(s.at) ? s.at : null;
        } catch (e) { return null; }
    }
    function segnaInizioSessione(userId) {
        try { localStorage.setItem(CHIAVE_SESSIONE, JSON.stringify({ uid: userId, at: Date.now() })); } catch (e) { /* senza segno la sessione non scade */ }
    }
    function sessioneScaduta() {
        if (!cachedUser) return false;
        const at = inizioSessione();
        if (at === null) { segnaInizioSessione(cachedUser.id); return false; }
        return Date.now() - at > SESSIONE_MAX_MS;
    }
    /** Dice (una volta sola) se l'ultima uscita è dovuta alla scadenza: il menu lo mostra nel gate. */
    function consumaAvvisoScadenza() {
        try {
            const c = localStorage.getItem(CHIAVE_AVVISO_SCADENZA) === '1';
            localStorage.removeItem(CHIAVE_AVVISO_SCADENZA);
            return c;
        } catch (e) { return false; }
    }

    /**
     * Chiude la sessione scaduta. Prima salva sul cloud (con un tetto di
     * tempo: senza rete si esce lo stesso, il salvataggio resta sul
     * dispositivo e al prossimo accesso la riconciliazione lo riallinea).
     */
    function terminaPerScadenza() {
        if (!cachedUser) return Promise.resolve();
        try { localStorage.setItem(CHIAVE_AVVISO_SCADENZA, '1'); } catch (e) { /* noop */ }
        // All'avvio SaveManager può non essere ancora caricato (stanno più
        // in basso nella pagina): si aspetta il caricamento completo.
        const pronta = document.readyState === 'complete'
            ? Promise.resolve()
            : new Promise((ok) => window.addEventListener('load', ok, { once: true }));
        return pronta.then(() => {
            const haSalvataggio = window.SaveManager && typeof SaveManager.hasSave === 'function' && SaveManager.hasSave();
            if (!haSalvataggio) return null;
            return Promise.race([pushSave().catch(() => null), new Promise((ok) => setTimeout(ok, 6000))]);
        }).then(() => {
            forgetAdmin();
            forgetApproved();
            try { localStorage.removeItem(CHIAVE_SESSIONE); } catch (e) { /* noop */ }
            return client.auth.signOut().catch(() => null);
        }).then(() => {
            cachedUser = null;
            cachedProfile = null;
            cachedAccessToken = null;
            notifyAuthListeners();
        });
    }

    let initialSessionPromise = Promise.resolve(null);
    // Il token di accesso in chiaro. Serve a js/cloud/server-date.js, che
    // ne legge l'`iat` (l'istante di emissione, scritto dal SERVER) come
    // ripiego quando la rete non risponde: è un'ora che il giocatore non
    // può falsificare spostando l'orologio del telefono. Si tiene qui
    // perché è l'unico punto che vede già passare ogni sessione.
    let cachedAccessToken = null;

    if (available) {
        initialSessionPromise = client.auth.getSession().then(({ data }) => {
            cachedUser = (data && data.session && data.session.user) || null;
            cachedAccessToken = (data && data.session && data.session.access_token) || null;
            // Sessione più vecchia di 48 ore: si salva e si esce PRIMA di
            // dire a qualcuno che l'utente è collegato.
            if (cachedUser && sessioneScaduta()) return terminaPerScadenza().then(() => null);
            notifyAuthListeners();
            return cachedUser;
        });
        client.auth.onAuthStateChange((event, session) => {
            cachedUser = (session && session.user) || null;
            cachedAccessToken = (session && session.access_token) || null;
            if (!cachedUser) cachedProfile = null;
            if (event === 'PASSWORD_RECOVERY') {
                recoveryListeners.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } });
            }
            notifyAuthListeners();
        });
    }

    function getUser() {
        return cachedUser;
    }

    /** Il token di accesso corrente, o null. Vedi cachedAccessToken sopra: lo usa server-date.js per l'ora firmata dal server. */
    function getAccessToken() {
        return cachedAccessToken;
    }

    /** Risolta con l'utente (o null) DOPO che la sessione persistita è stata davvero controllata almeno una volta — vedi il commento su initialSessionPromise qui sopra. */
    function waitForUser() {
        return initialSessionPromise;
    }

    /** Ultimo profilo noto ({status, is_admin}) dell'utente corrente, o null se non ancora caricato/nessun utente. */
    function getProfile() {
        return cachedProfile;
    }

    function isAdmin() {
        if (cachedProfile) return !!cachedProfile.is_admin;
        // Profilo non ancora arrivato dal database: si risponde con
        // l'ultimo esito confermato online per QUESTO utente (vedi
        // rememberAdmin), invece di dire "no" per poi cambiare idea a
        // pagina già disegnata.
        return wasAdminOffline(cachedUser && cachedUser.id);
    }

    function isApproved() {
        return !!(cachedProfile && (cachedProfile.is_admin || cachedProfile.status === 'approved'));
    }

    /** Registra `fn(user|null)`, richiamata subito con lo stato attuale e poi ad ogni cambio di sessione (login/logout). */
    function onAuthChange(fn) {
        authListeners.push(fn);
        fn(cachedUser);
    }

    /** Registra `fn()`, richiamata quando l'utente arriva da un link di recupero password (vedi resetPassword più sotto) — non chiamata subito, solo se/quando succede davvero. */
    function onPasswordRecovery(fn) {
        recoveryListeners.push(fn);
    }

    /**
     * Punto d'ingresso UNICO per ogni pagina del gioco (vedi
     * js/cloud/auth-gate.js, incluso in ogni pagina come js/ui/page-loader.js)
     * per sapere se l'utente corrente può usare il gioco ORA, gestendo da
     * sola sia il caso online sia quello offline:
     *   - Nessuna sessione Supabase (mai loggato, o sloggato) -> false,
     *     nessuna chiamata di rete.
     *   - Sessione presente: prova SEMPRE a riconfermare lo stato online
     *     (fetchProfile), così un account appena approvato/rifiutato da
     *     un admin si riflette al prossimo avvio con rete disponibile —
     *     mai un semplice "loggato quindi approvato" permanente.
     *   - Se la rete non risponde (rifiutata/andata in timeout): ricade
     *     sull'ultimo stato CONFERMATO online per QUESTO uid
     *     (wasApprovedOffline) — questo è il meccanismo che rende
     *     possibile "autenticati online al primo avvio, poi anche
     *     offline" per l'APK: non è una cache HTTP che scade da sola, è
     *     un marcatore esplicito per-utente aggiornato solo da una vera
     *     verifica online riuscita, mai da un semplice tentativo.
     * Torna sempre una Promise<boolean>, mai rifiutata.
     */
    function ensureApprovedSession() {
        if (!available) return Promise.resolve(false);
        if (!cachedUser) return Promise.resolve(false);
        const userId = cachedUser.id;
        return Promise.race([
            fetchProfile(userId),
            new Promise((resolve) => setTimeout(() => resolve(null), 6000))
        ]).then((profile) => {
            if (!profile) {
                // Rete assente/troppo lenta: nessuna risposta entro il
                // tetto d'attesa — ricade sull'ultimo stato confermato
                // offline invece di bloccare l'utente a tempo indeterminato.
                const approvedOffline = wasApprovedOffline(userId);
                if (approvedOffline) cachedProfile = cachedProfile || { status: 'approved', is_admin: false };
                return approvedOffline;
            }
            cachedProfile = profile;
            const approved = !!(profile.is_admin || profile.status === 'approved');
            if (approved) rememberApproved(userId);
            else forgetApproved();
            if (profile.is_admin) rememberAdmin(userId);
            else forgetAdmin();
            return approved;
        }).catch(() => wasApprovedOffline(userId));
    }

    // ------------------------------------------------------------------
    // "Ricorda email" — puramente locale (localStorage), NON legato
    // all'account/sessione: serve solo a precompilare il campo email dei
    // form di accesso la prossima volta che si apre il gioco su QUESTO
    // dispositivo, così non va ridigitata ad ogni accesso. Aggiornata da
    // signIn/signUp qui sotto ad ogni accesso/registrazione riuscita.
    // ------------------------------------------------------------------
    const LAST_EMAIL_KEY = 'ygoLastCloudEmail';
    function rememberEmail(email) {
        try { if (email) localStorage.setItem(LAST_EMAIL_KEY, email); } catch (e) { /* noop */ }
    }
    function getRememberedEmail() {
        try { return localStorage.getItem(LAST_EMAIL_KEY) || ''; } catch (e) { return ''; }
    }

    /**
     * Registra un nuovo account — replica lo stesso meccanismo del
     * progetto Fioxify: controlla PRIMA (RPC check_registration_email,
     * eseguibile anche da anon — vedi schema.sql) se l'email esiste già,
     * per un messaggio preciso invece del generico errore di Supabase
     * Auth. La riga in public.profiles nasce da sola in stato 'pending'
     * (trigger handle_new_user, schema.sql) — questa funzione fa SEMPRE
     * signOut subito dopo: niente sessione attiva finché un admin non
     * approva dal pannello Admin (admin.html), l'utente resta sulla
     * schermata di login con un messaggio "in attesa di approvazione".
     */
    function signUp(email, password) {
        if (!available) return rejectUnavailable();
        return client.rpc('check_registration_email', { check_email: email }).then(({ data: existingStatus }) => {
            if (existingStatus) {
                const messages = {
                    pending: 'Esiste già una registrazione in attesa di approvazione con questa email.',
                    approved: 'Esiste già un account con questa email. Prova ad accedere o usa "Password dimenticata?".',
                    rejected: 'La registrazione con questa email non è stata approvata. Contatta l\'amministratore.'
                };
                throw new Error(messages[existingStatus] || 'Email già registrata.');
            }
            return client.auth.signUp({ email, password }).then(({ error }) => {
                if (error) throw error;
                rememberEmail(email);
                return client.auth.signOut().then(() => undefined);
            });
        });
    }

    /**
     * Accede con email+password — a differenza di un semplice
     * signInWithPassword, verifica SUBITO lo stato di approvazione del
     * profilo (public.profiles) e nega l'accesso (con signOut immediato,
     * nessuna sessione "a metà" in giro) se l'account non è ancora stato
     * approvato da un admin o è stato rifiutato — stesso comportamento
     * del progetto Fioxify.
     */
    function signIn(email, password) {
        if (!available) return rejectUnavailable();
        return client.auth.signInWithPassword({ email, password }).then(({ data, error }) => {
            if (error) throw error;
            return fetchProfile(data.user.id).then((profile) => {
                cachedProfile = profile;
                const approved = !!(profile.is_admin || profile.status === 'approved');
                if (!approved) {
                    forgetApproved();
                    return client.auth.signOut().then(() => {
                        throw new Error(
                            profile.status === 'rejected'
                                ? 'La tua registrazione non è stata approvata.'
                                : 'Il tuo account è in attesa di approvazione da parte di un amministratore.'
                        );
                    });
                }
                rememberApproved(data.user.id);
                if (profile.is_admin) rememberAdmin(data.user.id);
                else forgetAdmin();
                rememberEmail(email);
                // Da qui partono le 48 ore (vedi "Durata della sessione").
                segnaInizioSessione(data.user.id);
                try { localStorage.removeItem(CHIAVE_AVVISO_SCADENZA); } catch (e) { /* noop */ }
                return data.user;
            });
        });
    }

    function signOut() {
        if (!available) return rejectUnavailable();
        // Il marcatore di amministratore è per-utente e non deve
        // sopravvivere al cambio account su questo dispositivo.
        forgetAdmin();
        try { localStorage.removeItem(CHIAVE_SESSIONE); } catch (e) { /* noop */ }
        return client.auth.signOut().then(({ error }) => { if (error) throw error; });
    }

    /**
     * Controlla se la sessione è scaduta e, se sì, la chiude e riporta al
     * menu (che mostra il gate con l'avviso). Mai durante un duello.
     */
    let scadenzaInCorso = false;
    function controllaScadenzaSessione() {
        if (!available || !cachedUser || scadenzaInCorso || !sessioneScaduta()) return;
        if (typeof window.gameState !== 'undefined' && window.gameState && !window.gameState.gameOver) return;
        scadenzaInCorso = true;
        terminaPerScadenza().then(() => {
            const qui = window.location.pathname;
            window.location.replace(qui.substring(0, qui.lastIndexOf('/') + 1) + 'index.html');
        }).catch(() => { scadenzaInCorso = false; });
    }
    if (available) {
        setInterval(controllaScadenzaSessione, 5 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') controllaScadenzaSessione();
        });
    }

    // ------------------------------------------------------------------
    // ADMIN — pannello di approvazione (admin.html), accessibile solo a
    // chi ha is_admin=true (le policy RLS in schema.sql rifiutano queste
    // query per chiunque altro, questa è solo la comodità lato client).
    // ------------------------------------------------------------------

    /** Elenco completo di tutti i profili (in attesa + già decisi), più recenti prima — per il pannello Admin. */
    function adminListProfiles() {
        if (!available) return rejectUnavailable();
        return client.from('profiles').select('id, email, status, is_admin, created_at')
            .order('created_at', { ascending: false })
            .then(({ data, error }) => { if (error) throw error; return data; });
    }

    /** Approva/rifiuta un account (status: 'approved' | 'rejected' | 'pending'). */
    function adminSetProfileStatus(userId, status) {
        if (!available) return rejectUnavailable();
        return client.from('profiles').update({ status }).eq('id', userId)
            .then(({ error }) => { if (error) throw error; });
    }

    /** Conteggio delle registrazioni in attesa — per il badge del pannello Admin. */
    function adminPendingCount() {
        if (!available) return rejectUnavailable();
        return client.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending')
            .then(({ count, error }) => { if (error) throw error; return count || 0; });
    }

    /**
     * Invia l'email "reimposta la tua password" (gestita interamente da
     * Supabase Auth). Il link dentro porta l'utente su `redirectTo` con
     * una sessione temporanea di tipo 'recovery': onAuthStateChange qui
     * sopra la riconosce e avvisa chi ha chiamato onPasswordRecovery,
     * così index.html può mostrare "imposta una nuova password" invece
     * del solito gate Accedi/Registrati.
     */
    function resetPassword(email) {
        if (!available) return rejectUnavailable();
        if (!email) return Promise.reject(new Error('Inserisci la tua email per recuperare la password.'));
        const here = window.location.href.split('#')[0].replace(/[^/]*$/, '') + 'index.html';
        return client.auth.resetPasswordForEmail(email, { redirectTo: here }).then(({ error }) => { if (error) throw error; });
    }

    /** Imposta una NUOVA password per l'utente della sessione corrente — usata sia dal link "password dimenticata" (sessione 'recovery') sia, in teoria, da un cambio password volontario a sessione normale. */
    function updatePassword(newPassword) {
        if (!available) return rejectUnavailable();
        return client.auth.updateUser({ password: newPassword }).then(({ error }) => { if (error) throw error; });
    }

    /**
     * Cancella DEFINITIVAMENTE l'account cloud dell'utente loggato (righe in
     * saves/custom_cards comprese, via "on delete cascade" — vedi
     * supabase/schema.sql#delete_own_account). Non tocca il salvataggio
     * LOCALE: dopo la cancellazione il gioco resta giocabile offline con i
     * dati che c'erano già su questo dispositivo. Irreversibile: la
     * conferma "scrivi ELIMINA" vive in profilo.html, non qui.
     */
    function deleteAccount() {
        if (!available) return rejectUnavailable();
        if (!cachedUser) return Promise.reject(new Error('Devi accedere prima di eliminare l\'account.'));
        forgetApproved();
        return client.rpc('delete_own_account').then(({ error }) => {
            if (error) throw error;
            return client.auth.signOut();
        });
    }

    /**
     * RIPORTA L'ACCOUNT ALLO STATO INIZIALE, senza cancellarlo.
     *
     * Differenza da deleteAccount() qui sopra, ed è tutta la ragione per
     * cui sono due funzioni: là sparisce l'ACCOUNT (e con esso
     * l'approvazione dell'amministratore, che andrebbe richiesta da capo);
     * qui sparisce solo il PROGRESSO. Si rientra con le stesse credenziali,
     * si resta approvati, e si ricomincia dalla scelta del nome.
     *
     * Cancella in questo ordine: prima il cloud (se fallisce, il locale è
     * ancora lì e il giocatore non ha perso niente per metà), poi il
     * locale, poi la sessione. L'ordine opposto lascerebbe un dispositivo
     * vuoto davanti a un cloud pieno, che al primo rientro si
     * riscaricherebbe da sé — un reset che non resetta.
     *
     * Non tocca il marcatore di approvazione: l'account resta quello di
     * prima, approvato come prima. Ed è irreversibile — la conferma
     * "scrivi AZZERA" vive nella pagina, non qui.
     *
     * Il salvataggio sul cloud NON si cancella: lo si sostituisce con un
     * SEGNO DI AZZERAMENTO ({ azzeratoIl }, vedi "Generazione del profilo"
     * più sotto). Cancellando la riga, un altro dispositivo con i dati di
     * prima trovava il cloud vuoto e alla riconciliazione successiva ci
     * rimetteva sopra il profilo appena azzerato. Il segno invece dice a
     * ogni dispositivo che i dati nati prima di quel momento appartengono a
     * un profilo che non esiste più.
     */
    function resetAccount() {
        if (!available) return rejectUnavailable();
        if (!cachedUser) return Promise.reject(new Error('Devi accedere prima di azzerare il profilo.'));
        const uid = cachedUser.id;
        const adesso = new Date().toISOString();
        return client.from('saves').upsert({ user_id: uid, data: { azzeratoIl: adesso }, updated_at: adesso })
            .then(({ error }) => { if (error) throw error; })
            .then(() => client.from('custom_cards').delete().eq('user_id', uid))
            .then(({ error }) => { if (error) throw error; })
            .then(() => {
                svuotaQuestoDispositivo();
                // Questo dispositivo sa già dell'azzeramento: il profilo
                // nuovo che si creerà qui dopo il rientro gli appartiene.
                ricordaGenerazione(adesso);
                return client.auth.signOut();
            });
    }

    // ------------------------------------------------------------------
    // Generazione del profilo: cosa resta di un azzeramento
    // ------------------------------------------------------------------
    /**
     * Ogni azzeramento apre una nuova GENERAZIONE del profilo, identificata
     * dal suo istante (`azzeratoIl`, scritto dentro il salvataggio). Un
     * salvataggio appartiene alla generazione in cui è nato; quello di una
     * generazione precedente non vince MAI, qualunque sia la sua data di
     * modifica — un telefono rimasto offline che gioca col profilo vecchio
     * dopo l'azzeramento ha una data più recente, ma i suoi dati sono
     * proprio quelli che l'azzeramento doveva togliere.
     *
     * Perché un registro sul DISPOSITIVO oltre al campo nel salvataggio:
     * il salvataggio nuovo lo crea index.html (SaveManager.createNew), che
     * non sa nulla del cloud. Il dispositivo invece sa a quale generazione
     * è arrivato: la registra quando l'ha appena vista sul cloud senza avere
     * dati più vecchi (o dopo averli tolti), quindi tutto ciò che crea DOPO
     * appartiene a quella. Un salvataggio di prima non può ereditarla per
     * sbaglio: quando il dispositivo la impara, quel salvataggio è già stato
     * tolto (svuotaQuestoDispositivo). Per utente, perché sullo stesso
     * dispositivo si può cambiare account.
     */
    const CHIAVE_GENERAZIONE = 'ygoGenerazioneProfilo';

    function generazioneDi(save) {
        const t = save && save.azzeratoIl ? Date.parse(save.azzeratoIl) : NaN;
        return isNaN(t) ? 0 : t;
    }
    function registroGenerazioni() {
        try { return JSON.parse(localStorage.getItem(CHIAVE_GENERAZIONE)) || {}; } catch (e) { return {}; }
    }
    /** La generazione a cui è arrivato QUESTO dispositivo per l'utente collegato (stringa ISO), o null. */
    function generazioneNota() {
        return cachedUser ? (registroGenerazioni()[cachedUser.id] || null) : null;
    }
    function ricordaGenerazione(iso) {
        if (!cachedUser || !iso || generazioneDi({ azzeratoIl: iso }) <= generazioneDi({ azzeratoIl: generazioneNota() })) return;
        const registro = registroGenerazioni();
        registro[cachedUser.id] = iso;
        try { localStorage.setItem(CHIAVE_GENERAZIONE, JSON.stringify(registro)); } catch (e) { /* noop */ }
    }
    /** La generazione di un salvataggio di QUESTO dispositivo: la sua, o quella a cui il dispositivo è arrivato. */
    function generazioneLocale(save) {
        return Math.max(generazioneDi(save), generazioneDi({ azzeratoIl: generazioneNota() }));
    }

    /**
     * Toglie da questo dispositivo il profilo: salvataggio (compreso il
     * backup nativo dell'APK, che altrimenti lo ripristinerebbe al primo
     * avvio senza dati), carte custom e terminologia personalizzata. Le
     * ultime due NON stanno dentro il salvataggio (vedi pushSave), quindi
     * cancellare solo quello lascerebbe in giro le carte inventate e i nomi
     * dei Tipi Mostro di prima.
     */
    function svuotaQuestoDispositivo() {
        if (window.SaveManager && typeof SaveManager.deleteSave === 'function') SaveManager.deleteSave();
        if (window.CustomCards && typeof CustomCards.replaceAll === 'function') CustomCards.replaceAll([]);
        if (window.CustomTaxonomy && typeof CustomTaxonomy.importAll === 'function') CustomTaxonomy.importAll({});
        // Un caricamento rimasto in sospeso (auto-sync.js) riguardava i dati appena tolti.
        try { localStorage.removeItem('ygoSyncInSospeso'); } catch (e) { /* noop */ }
        // E la versione del cloud da cui si era partiti non vale più.
        dimenticaBase();
    }

    /**
     * QUALE DEI DUE SALVATAGGI È IL BUONO — la regola, in un punto solo.
     *
     * Prima la domanda veniva girata al giocatore con un modale che
     * mostrava UNA data sola, quella del cloud: chi la leggeva non aveva
     * modo di sapere se il salvataggio di quel dispositivo fosse più
     * vecchio o più nuovo, e un click dato per togliersi di mezzo la
     * finestra poteva cancellare la giornata appena giocata. Era la metà
     * più cattiva del problema segnalato, perché non c'è modo di tornare
     * indietro.
     *
     * Una versione successiva decideva la data ma chiedeva ancora quando
     * i due salvataggi erano a meno di 5 minuti l'uno dall'altro (o una
     * data non si leggeva) — l'utente ha chiesto esplicitamente di non
     * chiedere MAI più: "voglio sempre tenere quello più recente". Ora
     * decide SEMPRE la data: una data illeggibile vale come "la più
     * vecchia possibile", così l'altro lato (quando la sua data si legge)
     * vince comunque, invece di finire in un bivio senza uscita.
     *
     * Torna { scelta: 'cloud' | 'locale', quandoCloud, quandoLocale } —
     * le due date servono comunque a chi mostra il messaggio di cosa è
     * stato caricato.
     */
    /**
     * QUANDO è stato MODIFICATO un salvataggio: la data scritta dentro il
     * salvataggio stesso (player.lastSaved, aggiornata da SaveManager a ogni
     * modifica), NON quella della riga sul cloud.
     *
     * È il cuore di un difetto vero, segnalato dall'utente ("progressi su
     * desktop, poi sul telefono vedo dati vecchi"): `updated_at` della riga
     * vale il momento del CARICAMENTO. Un telefono che caricava la sua copia
     * vecchia la marcava così come "la più recente", e al confronto
     * successivo vinceva lei, cancellando i progressi fatti sull'altro
     * dispositivo. La data di modifica viaggia col salvataggio e non cambia
     * caricandolo. `updated_at` resta come ripiego per una riga così vecchia
     * da non avere la data dentro.
     */
    function dataModifica(save, ripiego) {
        const dentro = save && save.player && save.player.lastSaved ? Date.parse(save.player.lastSaved) : NaN;
        if (!isNaN(dentro)) return dentro;
        return ripiego ? Date.parse(ripiego) : NaN;
    }

    function confrontaSalvataggi(cloud) {
        const locale = window.SaveManager ? SaveManager.load() : null;
        const quandoLocale = dataModifica(locale);
        const quandoCloud = cloud ? dataModifica(cloud.data, cloud.updatedAt) : NaN;

        if (!cloud) return { scelta: 'locale', quandoCloud: null, quandoLocale: quandoLocale };
        if (!locale) return { scelta: 'cloud', quandoCloud: quandoCloud, quandoLocale: null };
        const vLocale = isNaN(quandoLocale) ? -Infinity : quandoLocale;
        const vCloud = isNaN(quandoCloud) ? -Infinity : quandoCloud;
        return {
            // 'uguali': stessa data di modifica, quindi lo stesso salvataggio
            // (tipicamente uno appena scaricato): niente da spostare.
            scelta: vCloud === vLocale ? 'uguali' : (vCloud > vLocale ? 'cloud' : 'locale'),
            quandoCloud: quandoCloud,
            quandoLocale: quandoLocale
        };
    }

    // ------------------------------------------------------------------
    // Base di sincronizzazione: da quale versione del cloud siamo partiti
    // ------------------------------------------------------------------
    /**
     * IL BUCO CHE CHIUDE. La regola "non sovrascrivo un cloud più recente"
     * confrontava le date di MODIFICA (player.lastSaved). Ma ogni modifica
     * locale aggiorna quella data PRIMA del caricamento: un dispositivo
     * rimasto indietro (A), alla prima azione — un duello, un acquisto — si
     * ritrovava con una data più nuova del cloud, e sovrascriveva le ore
     * giocate su un altro dispositivo (B). Il confronto per data non può
     * accorgersi di una divergenza, perché la data nuova è di A.
     *
     * Ora ogni dispositivo ricorda da QUALE VERSIONE DEL CLOUD è partito: la
     * `updated_at` della riga che ha scaricato o scritto l'ultima volta. Se
     * al momento di caricare la riga ha un'altra `updated_at`, qualcun altro
     * l'ha scritta nel frattempo: questo dispositivo NON scrive (CLOUD_CAMBIATO),
     * e si riallinea dal cloud conservando in una copia ciò che aveva di
     * diverso (risolviConflittoCloud). Il caricamento stesso è atomico
     * ("aggiorna la riga SOLO SE updated_at è ancora quella che ho visto"):
     * senza, resterebbe una finestra fra la lettura e la scrittura in cui un
     * altro dispositivo può passare.
     *
     * Un dispositivo senza base (mai allineato dopo questo aggiornamento)
     * usa la vecchia regola per data, una volta, e la base la impara al
     * primo allineamento riuscito.
     *
     * `inVolo`: la `updated_at` che si sta per scrivere, annotata PRIMA della
     * richiesta. Se la risposta si perde (rete che cade) la riga sul cloud è
     * comunque nostra: al controllo successivo coincide con `inVolo` e non
     * viene scambiata per una scrittura altrui.
     */
    const CHIAVE_BASE = 'ygoCloudBase';
    const CHIAVE_COPIA_DIVERGENTE = 'ygoSalvataggioDivergente';

    function leggiBase() {
        try {
            const b = JSON.parse(localStorage.getItem(CHIAVE_BASE));
            return b && cachedUser && b.uid === cachedUser.id && b.updatedAt ? b : null;
        } catch (e) { return null; }
    }
    function scriviBase(campi) {
        if (!cachedUser) return;
        const prima = leggiBase() || {};
        try { localStorage.setItem(CHIAVE_BASE, JSON.stringify(Object.assign({}, prima, { uid: cachedUser.id }, campi))); } catch (e) { /* senza base vale la regola per data */ }
    }
    function dimenticaBase() {
        try { localStorage.removeItem(CHIAVE_BASE); } catch (e) { /* noop */ }
    }
    const stessoMomento = (a, b) => !!a && !!b && Date.parse(a) === Date.parse(b);
    /** Adotta come base la versione del cloud appena vista (dopo un download, o quando sono già uguali). */
    function adottaBase(cloud) {
        if (!cloud) return;
        scriviBase({ updatedAt: cloud.updatedAt, inVolo: null, lastSaved: cloud.data && cloud.data.player ? cloud.data.player.lastSaved : null });
    }

    /**
     * Qualcun altro ha scritto la riga del cloud dopo l'ultimo allineamento
     * di questo dispositivo? Falso se non c'è una base: non si può sapere.
     */
    function cloudCambiatoAltrove(cloud) {
        const b = leggiBase();
        if (!b || !cloud) return false;
        if (stessoMomento(cloud.updatedAt, b.updatedAt)) return false;
        if (stessoMomento(cloud.updatedAt, b.inVolo)) {
            // Era una scrittura nostra di cui non abbiamo saputo l'esito.
            scriviBase({ updatedAt: cloud.updatedAt, inVolo: null });
            return false;
        }
        return true;
    }

    /** Tiene da parte una copia del salvataggio di QUESTO dispositivo, prima che il cloud lo sostituisca. */
    function conservaCopiaDivergente(locale) {
        try {
            localStorage.setItem(CHIAVE_COPIA_DIVERGENTE, JSON.stringify({ conservataIl: new Date().toISOString(), data: locale }));
        } catch (e) { /* spazio esaurito: la sostituzione avviene comunque, il cloud vince */ }
    }
    function copiaDivergente() {
        try { return JSON.parse(localStorage.getItem(CHIAVE_COPIA_DIVERGENTE)); } catch (e) { return null; }
    }
    /** L'utente rinuncia alle modifiche conservate: la copia si butta. */
    function scartaCopiaDivergente() {
        try { localStorage.removeItem(CHIAVE_COPIA_DIVERGENTE); } catch (e) { /* noop */ }
    }
    /**
     * L'utente vuole le modifiche conservate: diventano il salvataggio di
     * questo dispositivo. Il salvataggio di adesso NON va perso a sua volta:
     * prende il posto della copia, così il ripristino si può annullare
     * ripristinando di nuovo. Chi chiama fa poi partire il caricamento
     * (AutoSync.caricaOra): la base di sincronizzazione è ancora quella
     * dell'ultimo allineamento, quindi se nel frattempo nessun altro ha
     * scritto sul cloud il caricamento riesce, altrimenti vince il cloud e
     * la copia resta conservata come prima.
     */
    function ripristinaCopiaDivergente() {
        const copia = copiaDivergente();
        if (!copia || !copia.data) return Promise.reject(new Error('Non c\'è nessuna copia da ripristinare.'));
        if (!window.SaveManager) return Promise.reject(new Error('js/save-manager.js non caricato in questa pagina.'));
        const attuale = SaveManager.hasSave() ? SaveManager.load() : null;
        // Prima si applica la copia (può rifiutarla se non è valida), poi si
        // conserva l'attuale: mai restare senza nessuna delle due.
        SaveManager.applyExternalSave(JSON.parse(JSON.stringify(copia.data)));
        if (attuale) conservaCopiaDivergente(attuale); else scartaCopiaDivergente();
        return Promise.resolve(true);
    }

    /**
     * Il cloud è cambiato da un altro dispositivo mentre questo aveva
     * modifiche sue: vince il cloud (è l'unica copia che tutti i dispositivi
     * possono ritrovare), e le modifiche di qui restano in una copia di
     * sicurezza (copiaDivergente) invece di sparire. Se qui non c'era
     * niente di nuovo (solo una copia rimasta indietro) la copia non serve
     * e non si crea.
     *
     * Torna { esito: 'scaricato', divergente } (o 'azzerato'/'nessuno').
     */
    function risolviConflittoCloud() {
        return leggiCloud().then(({ cloud, azzerato }) => {
            if (azzerato) return { esito: 'azzerato' };
            if (!cloud) return { esito: 'nessuno' };
            const locale = window.SaveManager && SaveManager.hasSave() ? SaveManager.load() : null;
            const b = leggiBase();
            const divergente = !!locale && !!locale.player
                && (!b || !b.lastSaved || locale.player.lastSaved !== b.lastSaved);
            if (divergente) conservaCopiaDivergente(locale);
            return Promise.all([pullSave(), pullCustomCards().catch(() => null)])
                .then(() => ({ esito: 'scaricato', divergente: divergente }));
        });
    }

    // ------------------------------------------------------------------
    // Salvataggio (public.saves — una riga per utente)
    // ------------------------------------------------------------------
    // ------------------------------------------------------------------
    // Chi ha scritto per ultimo il salvataggio cloud
    // ------------------------------------------------------------------
    /**
     * Ogni dispositivo ha un identificativo casuale (localStorage) e un
     * nome leggibile ('Android', 'Windows · Chrome'...). Ad ogni scrittura
     * finiscono DENTRO il salvataggio (data.ultimoDispositivo), come già la
     * tassonomia e la generazione: nessuna colonna nuova da creare sul
     * database. Il Profilo li legge per dire all'utente se l'ultima
     * modifica salvata è di questo dispositivo o di un altro.
     * Ricorda: dice chi ha SALVATO per ultimo, non chi ha aperto il gioco
     * per ultimo (un'apertura senza modifiche non scrive niente).
     */
    const CHIAVE_ID_DISPOSITIVO = 'ygoDispositivoId';
    function idDispositivo() {
        try {
            let id = localStorage.getItem(CHIAVE_ID_DISPOSITIVO);
            if (!id) {
                id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
                localStorage.setItem(CHIAVE_ID_DISPOSITIVO, id);
            }
            return id;
        } catch (e) { return 'sconosciuto'; }
    }
    function nomeDispositivo() {
        const ua = (navigator.userAgent || '');
        const app = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
        let os = 'Dispositivo';
        if (/Android/i.test(ua)) os = 'Android';
        else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iPhone/iPad';
        else if (/Windows/i.test(ua)) os = 'Windows';
        else if (/Mac OS X|Macintosh/i.test(ua)) os = 'Mac';
        else if (/Linux/i.test(ua)) os = 'Linux';
        if (app) return os + ' (app)';
        const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
        return browser ? os + ' · ' + browser : os;
    }
    /**
     * L'ultimo salvataggio sul cloud è di questo dispositivo o di un altro?
     * Torna { questo, nome, quando } oppure null (nessun salvataggio, o scritto
     * da una versione che non lasciava il segno).
     */
    function ultimoDispositivo() {
        return leggiCloud().then(({ cloud }) => {
            const u = cloud && cloud.data && cloud.data.ultimoDispositivo;
            if (!u || !u.id) return null;
            return { questo: u.id === idDispositivo(), nome: u.nome || 'un altro dispositivo', quando: u.quando || cloud.updatedAt };
        });
    }

    /**
     * Carica il salvataggio locale sul cloud — MA MAI sopra uno più recente.
     *
     * Prima caricava sempre, e i caricamenti automatici (auto-sync.js)
     * partono da soli: all'avvio se era rimasto qualcosa
     * in sospeso, e a ogni salvataggio. Un telefono con la copia vecchia
     * finiva così per scrivere sopra i progressi fatti nel frattempo su un
     * altro dispositivo, senza che nessuno avesse scelto niente. Ora si
     * guarda prima cosa c'è sul cloud: se è stato modificato DOPO la copia
     * di qui, il caricamento si ferma con un errore riconoscibile
     * (code 'CLOUD_PIU_RECENTE') e la copia buona resta dov'è. Costa una
     * lettura in più per caricamento, che è il prezzo giusto per un
     * salvataggio che non si può recuperare.
     *
     * `opzioni.forza`: carica comunque (nessun chiamante lo usa oggi; esiste
     * per un'azione esplicita dell'utente, mai per un automatismo).
     */
    function pushSave(opzioni) {
        if (!available) return rejectUnavailable();
        if (!cachedUser) return Promise.reject(new Error('Devi accedere prima di sincronizzare.'));
        if (!window.SaveManager || !SaveManager.hasSave()) return Promise.reject(new Error('Nessun salvataggio locale da caricare.'));
        if (opzioni && opzioni.forza) return scriviSalvataggio(SaveManager.load(), undefined);
        return leggiCloud().then(({ cloud, azzerato, segnoUpdatedAt }) => {
            // Il salvataggio si rilegge DOPO aver guardato il cloud: se il
            // profilo è stato azzerato altrove, leggiCloud l'ha appena tolto.
            if (azzerato || !SaveManager.hasSave()) {
                const e = new Error('Il profilo è stato azzerato da un altro dispositivo: non ricarico i dati di prima.');
                e.code = 'PROFILO_AZZERATO';
                throw e;
            }
            const base = SaveManager.load();
            // Prima la domanda giusta: l'ha scritta qualcun altro dopo che
            // questo dispositivo si è allineato? (vedi "Base di sincronizzazione")
            if (cloudCambiatoAltrove(cloud)) {
                const e = new Error('Il cloud è stato aggiornato da un altro dispositivo: non lo sovrascrivo.');
                e.code = 'CLOUD_CAMBIATO';
                throw e;
            }
            // Poi la vecchia regola per data: resta per i dispositivi senza
            // base, e come seconda rete.
            if (cloud && dataModifica(cloud.data, cloud.updatedAt) > dataModifica(base)) {
                const e = new Error('Sul cloud c\'è un salvataggio più recente di quello di questo dispositivo: non lo sovrascrivo.');
                e.code = 'CLOUD_PIU_RECENTE';
                throw e;
            }
            // `null`: nessuna riga sul cloud (si inserisce); una stringa: la
            // versione che si è appena vista, che deve essere ancora quella.
            return scriviSalvataggio(base, cloud ? cloud.updatedAt : (segnoUpdatedAt || null));
        });
    }

    /**
     * Scrive il salvataggio. `atteso`: `undefined` = sovrascrive comunque
     * (solo `forza`, un'azione esplicita); `null` = la riga non esisteva,
     * si inserisce; una stringa = la `updated_at` che si è letta, e la
     * scrittura riesce SOLO SE la riga ha ancora quella (compare-and-swap
     * lato database: nessuna finestra fra lettura e scrittura).
     */
    function scriviSalvataggio(base, atteso) {
        // Provenienze/Tipi Mostro/terminologia personalizzati viaggiano
        // DENTRO il salvataggio invece che in una tabella propria: non
        // richiede alcuna modifica allo schema Supabase (che l'utente
        // dovrebbe applicare a mano, vedi supabase/README.md) e sono dati
        // piccoli. Restano fuori dal salvataggio LOCALE, dove la fonte di
        // verità è e resta il localStorage di CustomTaxonomy: qui si
        // aggiungono solo al momento di partire — vedi pullSave per il
        // percorso inverso.
        const data = Object.assign({}, base);
        if (window.CustomTaxonomy && typeof CustomTaxonomy.exportAll === 'function') {
            data.customTaxonomy = CustomTaxonomy.exportAll();
        }
        // La generazione viaggia col salvataggio: è il modo in cui gli altri
        // dispositivi sanno che questo profilo è nato dopo un azzeramento.
        const generazione = generazioneLocale(base);
        if (generazione) data.azzeratoIl = new Date(generazione).toISOString();
        const nuovo = new Date().toISOString();
        data.ultimoDispositivo = { id: idDispositivo(), nome: nomeDispositivo(), quando: nuovo };
        const lastSaved = base && base.player ? base.player.lastSaved : null;
        const riuscita = () => { scriviBase({ updatedAt: nuovo, inVolo: null, lastSaved: lastSaved }); return data; };
        const conflitto = () => {
            const e = new Error('Il cloud è stato aggiornato da un altro dispositivo nel frattempo: non lo sovrascrivo.');
            e.code = 'CLOUD_CAMBIATO';
            return e;
        };
        // Annotata PRIMA della richiesta: se la risposta si perde, la riga
        // sul cloud resta riconoscibile come nostra (vedi cloudCambiatoAltrove).
        scriviBase({ inVolo: nuovo });
        if (atteso === undefined) {
            return client.from('saves')
                .upsert({ user_id: cachedUser.id, data, updated_at: nuovo })
                .then(({ error }) => { if (error) throw error; return riuscita(); });
        }
        if (atteso === null) {
            return client.from('saves')
                .insert({ user_id: cachedUser.id, data, updated_at: nuovo })
                .then(({ error }) => {
                    // La riga è comparsa mentre si scriveva (violazione di chiave
                    // unica): un altro dispositivo è arrivato prima.
                    if (error && (error.code === '23505' || /duplicate/i.test(error.message || ''))) throw conflitto();
                    if (error) throw error;
                    return riuscita();
                });
        }
        return client.from('saves')
            .update({ data, updated_at: nuovo })
            .eq('user_id', cachedUser.id)
            .eq('updated_at', atteso)
            .select('updated_at')
            .then(({ data: righe, error }) => {
                if (error) throw error;
                // Nessuna riga aggiornata: la `updated_at` non è più quella vista.
                if (!righe || righe.length === 0) throw conflitto();
                return riuscita();
            });
    }

    /** Scarica il salvataggio cloud SENZA applicarlo — usata da profilo.html per decidere se c'è un conflitto prima di sovrascrivere il locale. Torna null se l'utente non ha ancora nessun salvataggio sul cloud. */
    function fetchCloudSave() {
        return leggiCloud().then((r) => r.cloud);
    }

    /**
     * L'unico punto da cui si legge il salvataggio cloud, e quindi l'unico
     * punto in cui un dispositivo scopre un azzeramento fatto altrove: ogni
     * percorso (gate, riconciliazione, caricamenti automatici, Profilo)
     * passa di qui prima di decidere cosa fare. Se il cloud porta una
     * generazione più nuova di quella dei dati di questo dispositivo, quei
     * dati appartengono al profilo azzerato e si tolgono SUBITO — prima che
     * qualcuno li confronti per data o li carichi.
     *
     * Torna { cloud, azzerato }: `cloud` è null anche quando sul cloud c'è
     * solo il segno di azzeramento (nessun profilo ancora: per chi chiama è
     * esattamente un account senza salvataggio, e si chiede il nome come la
     * prima volta); `azzerato` dice se i dati di qui sono appena stati tolti.
     */
    function leggiCloud() {
        if (!available) return rejectUnavailable();
        if (!cachedUser) return Promise.reject(new Error('Devi accedere prima di sincronizzare.'));
        return client.from('saves').select('data, updated_at').eq('user_id', cachedUser.id).maybeSingle()
            .then(({ data, error }) => {
                if (error) throw error;
                if (!data) return { cloud: null, azzerato: false };
                let azzerato = false;
                const generazioneCloud = generazioneDi(data.data);
                if (generazioneCloud) {
                    const locale = window.SaveManager && SaveManager.hasSave() ? SaveManager.load() : null;
                    if (locale && generazioneLocale(locale) < generazioneCloud) {
                        svuotaQuestoDispositivo();
                        azzerato = true;
                        try { sessionStorage.setItem('ygoAvvisoSync', 'azzerato'); } catch (e) { /* noop */ }
                    }
                    // Solo DOPO il confronto: imparata prima, la generazione
                    // nuova sarebbe stata attribuita anche ai dati di prima.
                    ricordaGenerazione(data.data.azzeratoIl);
                }
                const soloSegno = !data.data || !data.data.player;
                // `segnoUpdatedAt`: la riga ESISTE ma porta solo il segno di
                // azzeramento. Chi vuole scriverci sopra deve aggiornarla (con
                // la sua `updated_at` come condizione), non inserirne un'altra.
                return {
                    cloud: soloSegno ? null : { data: data.data, updatedAt: data.updated_at },
                    azzerato: azzerato,
                    segnoUpdatedAt: soloSegno ? data.updated_at : null
                };
            });
    }

    /** Scarica il salvataggio cloud e lo applica come salvataggio locale attivo (sovrascrive il locale). */
    function pullSave() {
        return fetchCloudSave().then((cloud) => {
            if (!cloud) return null;
            if (!window.SaveManager) throw new Error('js/save-manager.js non caricato in questa pagina.');
            // La tassonomia viaggia dentro il salvataggio ma NON ne fa
            // parte (vedi pushSave): si estrae e si rimette al suo posto,
            // così il salvataggio locale non se la porta dietro e non
            // esistono due copie che possono divergere. Una pagina che non
            // carica CustomTaxonomy la lascia semplicemente com'è sul
            // cloud, senza perderla.
            const data = Object.assign({}, cloud.data);
            const taxonomy = data.customTaxonomy;
            delete data.customTaxonomy;
            delete data.ultimoDispositivo; // appartiene al cloud, non al salvataggio di gioco
            if (taxonomy && window.CustomTaxonomy && typeof CustomTaxonomy.importAll === 'function') {
                CustomTaxonomy.importAll(taxonomy);
            }
            // La data di modifica resta quella del cloud (vedi dataModifica):
            // la copia di qui diventa IDENTICA a quella, non "più nuova".
            const applicato = SaveManager.applyExternalSave(data, { mantieniData: true });
            // Da qui questo dispositivo è allineato a QUESTA versione del cloud.
            adottaBase(cloud);
            return applicato;
        });
    }

    // ------------------------------------------------------------------
    // Riconciliazione: allinea questo dispositivo al cloud
    // ------------------------------------------------------------------
    const CHIAVE_ULTIMA_RICONCILIAZIONE = 'ygoUltimaRiconciliazione';
    let riconciliazioneInCorso = null;

    /**
     * Confronta il salvataggio di qui con quello sul cloud e tiene il PIÙ
     * RECENTE (per data di modifica, vedi dataModifica): scarica se il cloud
     * è più nuovo, carica se lo è questo dispositivo, non fa nulla se sono
     * lo stesso. Le carte personalizzate seguono il salvataggio.
     *
     * Prima questo confronto avveniva SOLO quando si faceva l'accesso a
     * mano. Con la sessione già attiva (il caso normale dell'APK, che resta
     * collegato) il gioco si apriva sul salvataggio del dispositivo senza
     * guardare il cloud: progressi fatti su desktop, telefono fermo ai dati
     * vecchi. Ora la chiamano l'avvio del menu e il ritorno in primo piano.
     *
     * `opzioni.attesaMassimaMs`: oltre questo tempo si rinuncia e si gioca
     * col salvataggio di qui (esito 'offline'); un risultato che arrivasse
     * dopo NON viene applicato, per non cambiare i dati sotto i piedi a chi
     * ha già cominciato a giocare.
     *
     * Torna { esito: 'scaricato'|'caricato'|'uguale'|'nessuno'|'offline'|'azzerato',
     * quandoCloud, quandoLocale }. Due chiamate ravvicinate condividono la
     * stessa richiesta.
     */
    function riconcilia(opzioni) {
        if (!available || !cachedUser || !window.SaveManager) return Promise.resolve({ esito: 'offline' });
        if (riconciliazioneInCorso) return riconciliazioneInCorso;
        let scaduto = false;
        const lavoro = leggiCloud().then(({ cloud, azzerato }) => {
            // Il profilo è stato azzerato da un altro dispositivo e i dati di
            // qui sono appena stati tolti: anche oltre il tetto di tempo, perché
            // tenerli in vita sarebbe peggio che cambiarli sotto i piedi.
            if (azzerato) return { esito: 'azzerato' };
            if (scaduto) return { esito: 'offline' };
            const haLocale = SaveManager.hasSave();
            if (!cloud && !haLocale) return { esito: 'nessuno' };
            const verdetto = confrontaSalvataggi(cloud);
            const base = { quandoCloud: verdetto.quandoCloud, quandoLocale: verdetto.quandoLocale };
            // Un altro dispositivo ha scritto dopo che questo si è allineato:
            // vince il cloud ANCHE se la data di modifica di qui è più nuova
            // (lo è per forza, se qui si è giocato nel frattempo: è proprio il
            // caso da non sbagliare). Le modifiche di qui restano in una copia.
            if (haLocale && cloud && cloudCambiatoAltrove(cloud)) {
                return risolviConflittoCloud().then((r) => Object.assign({}, r, base));
            }
            if (verdetto.scelta === 'uguali') { adottaBase(cloud); return Object.assign({ esito: 'uguale' }, base); }
            if (verdetto.scelta === 'cloud') {
                return Promise.all([pullSave(), pullCustomCards().catch(() => null)])
                    .then(() => Object.assign({ esito: 'scaricato' }, base));
            }
            return Promise.all([pushSave(), pushCustomCards().catch(() => null)])
                .then(() => Object.assign({ esito: 'caricato' }, base));
        }).then((r) => {
            if (r.esito !== 'offline') {
                try { sessionStorage.setItem(CHIAVE_ULTIMA_RICONCILIAZIONE, String(Date.now())); } catch (e) { /* noop */ }
            }
            return r;
        }).catch(() => ({ esito: 'offline' }));
        const attesa = opzioni && opzioni.attesaMassimaMs;
        const conTetto = attesa
            ? Promise.race([lavoro, new Promise((ok) => setTimeout(() => { scaduto = true; ok({ esito: 'offline' }); }, attesa))])
            : lavoro;
        riconciliazioneInCorso = conTetto.then((r) => { riconciliazioneInCorso = null; return r; });
        return riconciliazioneInCorso;
    }

    /** Millisecondi dall'ultima riconciliazione riuscita in questa sessione (Infinity se mai). */
    function msDallUltimaRiconciliazione() {
        let t = NaN;
        try { t = Number(sessionStorage.getItem(CHIAVE_ULTIMA_RICONCILIAZIONE)); } catch (e) { /* noop */ }
        return t ? Date.now() - t : Infinity;
    }

    // ------------------------------------------------------------------
    // Carte custom (public.custom_cards — una riga per carta)
    // ------------------------------------------------------------------
    function pushCustomCards() {
        if (!available) return rejectUnavailable();
        if (!cachedUser) return Promise.reject(new Error('Devi accedere prima di sincronizzare.'));
        if (!window.CustomCards) return Promise.reject(new Error('js/data/custom-cards.js non caricato in questa pagina.'));
        // Prima si guarda il cloud: se il profilo è stato azzerato altrove,
        // le carte di qui sono del profilo di prima e non vanno ricaricate
        // (leggiCloud le ha appena tolte).
        return leggiCloud().then(({ azzerato }) => {
            if (azzerato) return [];
            return sostituisciCarteSulCloud(CustomCards.list());
        });
    }

    function sostituisciCarteSulCloud(cards) {
        // Sostituzione completa: cancella tutte le righe di questo utente
        // e reinserisce lo stato locale attuale — evita la complessità di
        // far combaciare id locali (100000+) con gli id auto-generati di
        // Postgres ad ogni singola modifica.
        return client.from('custom_cards').delete().eq('user_id', cachedUser.id).then(({ error: delError }) => {
            if (delError) throw delError;
            if (cards.length === 0) return cards;
            const rows = cards.map((card) => ({ user_id: cachedUser.id, card }));
            return client.from('custom_cards').insert(rows).then(({ error }) => {
                if (error) throw error;
                return cards;
            });
        });
    }

    function fetchCloudCustomCards() {
        if (!available) return rejectUnavailable();
        if (!cachedUser) return Promise.reject(new Error('Devi accedere prima di sincronizzare.'));
        return client.from('custom_cards').select('card').eq('user_id', cachedUser.id)
            .then(({ data, error }) => {
                if (error) throw error;
                return (data || []).map((row) => row.card);
            });
    }

    function pullCustomCards() {
        return fetchCloudCustomCards().then((cards) => {
            if (!window.CustomCards) throw new Error('js/data/custom-cards.js non caricato in questa pagina.');
            CustomCards.replaceAll(cards);
            return cards;
        });
    }

    window.CloudSync = {
        available: available,
        getUser: getUser,
        getAccessToken: getAccessToken,
        waitForUser: waitForUser,
        getProfile: getProfile,
        isAdmin: isAdmin,
        isApproved: isApproved,
        ensureApprovedSession: ensureApprovedSession,
        onAuthChange: onAuthChange,
        onPasswordRecovery: onPasswordRecovery,
        getRememberedEmail: getRememberedEmail,
        signUp: signUp,
        signIn: signIn,
        signOut: signOut,
        resetPassword: resetPassword,
        updatePassword: updatePassword,
        deleteAccount: deleteAccount,
        resetAccount: resetAccount,
        confrontaSalvataggi: confrontaSalvataggi,
        riconcilia: riconcilia,
        /** Vero se l'accesso su questo dispositivo ha più di 48 ore (vedi "Durata della sessione"). */
        sessioneScaduta: sessioneScaduta,
        controllaScadenzaSessione: controllaScadenzaSessione,
        /** Vero (una volta sola) se l'ultima uscita è dovuta alla scadenza: il gate lo spiega. */
        consumaAvvisoScadenza: consumaAvvisoScadenza,
        SESSIONE_MAX_MS: SESSIONE_MAX_MS,
        /** Il cloud è cambiato altrove e qui c'erano modifiche: scarica il cloud e conserva la copia di qui. */
        risolviConflittoCloud: risolviConflittoCloud,
        /** La copia del salvataggio di questo dispositivo messa da parte dall'ultimo conflitto, o null. */
        copiaDivergente: copiaDivergente,
        ultimoDispositivo: ultimoDispositivo,
        scartaCopiaDivergente: scartaCopiaDivergente,
        ripristinaCopiaDivergente: ripristinaCopiaDivergente,
        msDallUltimaRiconciliazione: msDallUltimaRiconciliazione,
        adminListProfiles: adminListProfiles,
        adminSetProfileStatus: adminSetProfileStatus,
        adminPendingCount: adminPendingCount,
        pushSave: pushSave,
        pullSave: pullSave,
        fetchCloudSave: fetchCloudSave,
        pushCustomCards: pushCustomCards,
        pullCustomCards: pullCustomCards,
        fetchCloudCustomCards: fetchCloudCustomCards
    };
})();
