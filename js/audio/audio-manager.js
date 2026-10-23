/**
 * audio-manager.js — Musica di sottofondo condivisa tra le pagine.
 * ---------------------------------------------------------------
 * Il progetto è multi-pagina (non una SPA): ogni file .html è un
 * documento a sé, quindi normalmente l'audio si interromperebbe a
 * ogni navigazione. Per dare la sensazione di continuità, questo
 * modulo salva in sessionStorage la posizione di riproduzione e usa una
 * cache locale per il mute, ripristinandoli a ogni nuovo caricamento
 * che include questo script — così la traccia prosegue (con al più
 * un impercettibile scarto) invece di ripartire da capo.
 *
 * Per ora la traccia è "cablata" su un solo brano (56. Battle for the Millennium.mp3),
 * usato ovunque. In futuro basterà passare un trackSrc diverso a
 * initAudioManager() (es. per una colonna sonora dedicata alle
 * battaglie) perché il resto — continuità, mute, salvataggio — resti
 * invariato. Nell'APK la musica usa invece NativeMusic: il MediaPlayer vive
 * nell'Activity Android e non viene distrutto a ogni navigazione WebView.
 * Effetti sonori, voci e jingle restano HTML Audio/Howler nella pagina.
 *
 * Volutamente SEMPLICE: nessuna dissolvenza di volume, nessun banner
 * o pulsante di recupero, nessun gating del caricamento della pagina
 * sull'audio — richiesta esplicita dell'utente dopo alcuni giri di
 * "miglioramenti" che avevano introdotto più bug di quanti ne
 * risolvessero. L'unica parte non ovvia è il gesto di recupero in
 * CAPTURE PHASE più sotto (vedi tryPlay()): quella è un fix reale e
 * verificato, non un ornamento — senza, le due interazioni più comuni
 * di un duello (trascinare una carta) non sbloccano mai l'autoplay
 * bloccato.
 */
(function () {
    'use strict';

    const DEFAULT_TRACK = 'audio/soundtracks/56. Battle for the Millennium.mp3';
    const KEY_MUTED = 'duelArenaMusicMuted';
    const KEY_TIME = 'duelArenaMusicTime';
    const KEY_TRACK = 'duelArenaMusicTrack';
    // Posizione/traccia sono di sessione; volume e mute sono preferenze del
    // profilo. localStorage ne resta la cache immediata fra una pagina e
    // l'altra, mentre SaveManager le include in export e cloud.
    const KEY_VOLUME = 'duelArenaMusicVolume';

    // ============================================================
    // window.DuelSFX — volume/mute degli EFFETTI SONORI (js/audio/sfx.js,
    // js/audio/audio-library.js), separato dalla musica di sottofondo qui sopra
    // su richiesta esplicita dell'utente: prima js/audio/sfx.js e
    // js/audio/audio-library.js leggevano il volume/mute di DuelMusic (un solo
    // cursore per tutto), ora ne hanno uno proprio. Vive qui (non in un
    // file a parte) perché questo è già l'hub condiviso per le
    // impostazioni audio tra le pagine, stesso spirito di DuelMusic sopra.
    // Sempre disponibile (non richiede initAudioManager()), in localStorage
    // come il volume musica: una preferenza del giocatore, non legata a
    // una singola sessione di navigazione.
    // ============================================================
    const KEY_SFX_MUTED = 'duelArenaSfxMuted';
    const KEY_SFX_VOLUME = 'duelArenaSfxVolume';

    let sfxVolume = 0.6;
    try {
        const saved = parseFloat(localStorage.getItem(KEY_SFX_VOLUME));
        if (!isNaN(saved) && saved >= 0 && saved <= 1) sfxVolume = saved;
    } catch (e) { /* noop */ }
    let sfxMuted = false;
    try { sfxMuted = localStorage.getItem(KEY_SFX_MUTED) === 'true'; } catch (e) { /* noop */ }

    window.DuelSFX = {
        getVolume: function () { return sfxVolume; },
        /** 0..1. Persiste in localStorage: resta la stessa in ogni pagina e sessione futura. */
        setVolume: function (value) {
            sfxVolume = Math.min(1, Math.max(0, value));
            try { localStorage.setItem(KEY_SFX_VOLUME, String(sfxVolume)); } catch (e) { /* noop */ }
            if (window.SaveManager && SaveManager.setSetting) SaveManager.setSetting('sfxVolume', sfxVolume);
        },
        isMuted: function () { return sfxMuted; },
        setMuted: function (value) {
            sfxMuted = !!value;
            try { localStorage.setItem(KEY_SFX_MUTED, String(sfxMuted)); } catch (e) { /* noop */ }
            if (window.SaveManager && SaveManager.setSetting) SaveManager.setSetting('sfxMuted', sfxMuted);
        },
        toggleMute: function () {
            window.DuelSFX.setMuted(!sfxMuted);
            return sfxMuted;
        }
    };

    /**
     * Transizione nativa del browser tra due pagine dello stesso sito
     * (Chrome/Edge 126+, "Cross-Document View Transitions"): l'opt-in
     * `@view-transition { navigation: auto; }` NON vive più qui — vive
     * come `<style>` STATICO nel `<head>` di ogni pagina (subito dopo
     * `<meta charset>`), non più iniettato da questa funzione a runtime.
     * BUG REALE trovato e corretto verificando dal vivo su un telefono
     * collegato via adb (il banner di `js/ui/error-recovery.js`
     * mostrava, per la prima volta col dettaglio tecnico appena
     * aggiunto, "InvalidStateError: ViewTransition opt-in disabled" su
     * OGNI cambio pagina): l'opt-in della pagina di ARRIVO deve essere
     * già presente nell'HTML fin dal primissimo parsing di `<head>` per
     * essere riconosciuto dal browser — iniettarlo qui dentro
     * `initAudioManager()` arrivava sempre troppo tardi, perché questa
     * pagina la chiama solo DOPO che `js/cloud/auth-gate.js` ha già
     * aspettato la verifica dell'account approvato (fino a 6s) — un
     * tempo ben oltre la finestra in cui il browser decide se una
     * transizione cross-document può avvenire. Spostare l'opt-in a uno
     * `<style>` statico elimina il problema alla radice: il browser lo
     * vede subito, prima di qualunque script asincrono.
     */

    /**
     * Integrazione con l'app Android impacchettata (Capacitor — vedi
     * C:\AndroidDev\YuGiOhGameAndroid, un WebView nativo che carica queste
     * stesse pagine da un server di sviluppo, non un browser). `window.Capacitor`
     * esiste SOLO dentro quell'app, mai in un browser normale: ogni cosa qui
     * dentro è quindi un no-op silenzioso per chiunque giochi da browser,
     * zero rischio per l'esperienza web esistente.
     *
     * Due cose, entrambe richieste esplicitamente dall'utente dopo aver
     * provato l'app impacchettata:
     * 1) Orientamento LIBERO (nessun lock) su OGNI pagina eccetto
     *    duelMonstersCore.html — segue il sensore del telefono, quindi
     *    l'app può ruotare a piacere E parte già nell'orientamento
     *    fisico corrente del telefono all'apertura, invece di forzare
     *    sempre verticale (prima versione di questa funzione, cambiata
     *    su richiesta esplicita: "dai la possibilità... di poter
     *    ruotare lo schermo e/o di partire con l'app già in orizzontale
     *    in base allo stato attuale del telefono"). duelMonstersCore.html
     *    resta l'unica eccezione: il proprio blocco dedicato (vedi lì)
     *    gira DOPO questo e forza l'orizzontale, sovrascrivendo lo sblocco
     *    appena fatto qui.
     * 2) La musica si ferma quando l'app va in background (Home, cambio
     *    app, schermo spento) e riprende quando torna in primo piano —
     *    altrimenti continuerebbe a suonare invisibile, cosa che in un
     *    browser normale non può succedere (la scheda in background dei
     *    browser mette comunque in pausa i tab non attivi), ma un WebView
     *    nativo non lo fa da solo.
     */
    function getNativeMusicPlugin() {
        if (!window.Capacitor || !Capacitor.isNativePlatform || !Capacitor.isNativePlatform()) return null;
        const plugin = Capacitor.Plugins && Capacitor.Plugins.NativeMusic;
        return plugin && typeof plugin.play === 'function' ? plugin : null;
    }

    function ensureCapacitorAppIntegration(audio, nativeMusic) {
        if (!window.Capacitor || !Capacitor.isNativePlatform || !Capacitor.isNativePlatform()) return;
        const plugins = Capacitor.Plugins || {};

        if (plugins.ScreenOrientation && typeof plugins.ScreenOrientation.unlock === 'function') {
            plugins.ScreenOrientation.unlock().catch(() => {});
        }

        // NativeMusic gestisce il ciclo vita direttamente dall'Activity.
        // Questo listener resta soltanto per il backend web/fallback.
        if (!nativeMusic && plugins.App && typeof plugins.App.addListener === 'function') {
            plugins.App.addListener('appStateChange', (state) => {
                if (!state || !state.isActive) {
                    audio.pause();
                } else if (!audio.muted) {
                    audio.play().catch(() => {});
                }
            });
        }
    }

    function initAudioManager(options) {
        options = options || {};
        // `let`, non `const`: da quando index.html contiene più schermate
        // come viste SPA, la traccia può cambiare SENZA cambiare pagina
        // (vedi DuelMusic.setTrack in fondo a questa funzione).
        let trackSrc = options.trackSrc || DEFAULT_TRACK;

        let audio = document.getElementById('bgMusicAudio');
        if (!audio) {
            audio = document.createElement('audio');
            audio.id = 'bgMusicAudio';
            audio.loop = true;
            audio.preload = 'auto';
            document.body.appendChild(audio);
        }

        const nativeMusic = getNativeMusicPlugin();
        ensureCapacitorAppIntegration(audio, nativeMusic);

        let muted = false;
        try { muted = localStorage.getItem(KEY_MUTED) === 'true'; } catch (e) { /* noop */ }

        let savedTrack = null;
        let savedTime = 0;
        try {
            savedTrack = sessionStorage.getItem(KEY_TRACK);
            savedTime = parseFloat(sessionStorage.getItem(KEY_TIME) || '0') || 0;
        } catch (e) { /* noop */ }

        let volume = 0.55;
        try {
            const savedVolume = parseFloat(localStorage.getItem(KEY_VOLUME));
            if (!isNaN(savedVolume) && savedVolume >= 0 && savedVolume <= 1) volume = savedVolume;
        } catch (e) { /* noop */ }
        audio.volume = volume;
        audio.muted = muted;
        if (!nativeMusic) audio.src = trackSrc;

        // Riprende dalla posizione salvata SOLO se la pagina precedente
        // stava suonando la stessa traccia (continuità reale, non un salto
        // a caso se in futuro cambia il brano).
        const needsResume = savedTrack === trackSrc && savedTime > 0;

        // tryPlay() va chiamata SOLO dopo 'canplay', MAI subito dopo aver
        // assegnato audio.src qui sopra — verificato empiricamente: un
        // play() tentato a readyState 0 (nessun dato ancora bufferizzato)
        // viene rifiutato dal browser come se mancasse un gesto
        // dell'utente, ANCHE se muted, mentre lo stesso identico play() a
        // readyState 4 (dopo 'canplay') va sempre a buon fine senza
        // bisogno di alcuna interazione. Stesso motivo per cui il seek
        // alla posizione salvata deve aspettare 'canplay' (non
        // 'loadedmetadata': a quel punto il buffer non è ancora
        // sufficiente per un seek affidabile) — un solo listener per
        // entrambi invece di farli gareggiare fra loro.
        if (!nativeMusic) audio.addEventListener('canplay', function onReady() {
            audio.removeEventListener('canplay', onReady);
            if (needsResume && savedTime < audio.duration) {
                audio.currentTime = savedTime;
            }
            if (!muted && options.autoplay !== false) {
                tryPlay();
            }
        }, { once: true });

        function nativeOptions(position, restart) {
            return {
                src: new URL(trackSrc, document.baseURI).href,
                position: position || 0,
                volume: volume,
                muted: muted,
                restart: !!restart
            };
        }

        // Nel backend nativo una nuova pagina richiama play sulla stessa URL:
        // il plugin riconosce la traccia e continua senza alcun salto.
        if (nativeMusic && options.autoplay !== false) {
            nativeMusic.play(nativeOptions(needsResume ? savedTime : 0, false)).catch(() => {});
        }

        function persistState() {
            try {
                sessionStorage.setItem(KEY_TRACK, trackSrc);
                sessionStorage.setItem(KEY_TIME, String(audio.currentTime || savedTime || 0));
            } catch (e) { /* noop */ }
        }
        audio.addEventListener('timeupdate', persistState);
        window.addEventListener('pagehide', persistState);
        window.addEventListener('beforeunload', persistState);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') persistState();
        });

        // Pulsante "Indietro" (history.back()) o navigazione avanti/indietro
        // del browser: la pagina può tornare dalla bfcache invece di
        // ricaricarsi da zero — in quel caso questo script NON riparte
        // (è la stessa istanza già in memoria), ma il browser ha comunque
        // messo in pausa l'audio quando la pagina è stata nascosta. Senza
        // questo listener la musica restava mutamente ferma finché non si
        // cambiava di nuovo pagina (un vero reload). 'persisted' è true
        // solo per un ripristino da bfcache, mai per un caricamento normale
        // (dove initAudioManager() gira comunque da capo, quindi qui non
        // farebbe nulla di nuovo).
        window.addEventListener('pageshow', (event) => {
            if (event.persisted && !audio.muted && audio.paused && options.autoplay !== false) {
                tryPlay();
            }
        });

        /**
         * L'autoplay bloccato dal browser senza un gesto dell'utente è una
         * vera policy di sicurezza, non un bug — nessun trucco client-side
         * la aggira. Se play() viene rifiutato, resta un solo modo
         * legittimo per ripartire: il PRIMO gesto reale dell'utente su
         * QUESTA pagina, qualunque esso sia. Ascoltato in fase di CAPTURE
         * (4° argomento `true`), non bubble: due interazioni molto comuni
         * del duello (trascinare una carta dalla mano — startHandCardDrag
         * in js/engine/actions.js — e trascinare un mostro per attaccare —
         * startAttackDrag in js/engine/game-flow.js) chiamano ENTRAMBE
         * event.stopPropagation() proprio sull'evento 'pointerdown' (per
         * evitare un click sintetico duplicato su mobile). Un listener in
         * fase di bubble su `document` non riceverebbe mai quell'evento;
         * la fase di capture scorre invece da `document` VERSO il
         * bersaglio, PRIMA che l'evento arrivi lì, quindi nessuno
         * stopPropagation() a valle può fermarla. Nessuna UI: nessun
         * banner, nessun pulsante — solo un ascolto silenzioso del primo
         * gesto reale.
         *
         * 'mousemove' era stato aggiunto qui su richiesta dell'utente, poi
         * RIMOSSO subito dopo (stessa sessione): l'utente ha segnalato che
         * la musica aveva smesso di partire, richiesta esplicita di
         * tornare come prima — stesso principio già imparato in una
         * sessione precedente ("quando un utente segnala una rottura,
         * semplificare/tornare indietro, non aggiungere altra logica").
         * Anche indipendentemente da questo: nessuna policy di autoplay di
         * alcun browser conosciuto considera un mero movimento del mouse
         * un gesto che sblocca l'autoplay bloccato (solo interazioni
         * discrete come click/tap/tasto/rotellina lo sono), quindi non
         * avrebbe comunque avuto l'effetto sperato.
         */
        /*
         * SFUMATURE (solo browser, richiesta dell'utente): la musica entra in
         * dissolvenza invece di partire di colpo, ed esce in dissolvenza
         * quando si cambia pagina o quando un'anteprima prende il suo posto.
         * Riguardano soltanto l'elemento <audio> della pagina: nell'APK la
         * musica è il MediaPlayer di NativeMusic, che continua da solo da una
         * pagina all'altra senza alcun salto, e lì non si tocca niente
         * (tryPlay e sfuma non vengono mai chiamate col backend nativo).
         *
         * NB: una sfumatura d'ingresso esisteva già una volta ed era stata
         * tolta, insieme ad altre aggiunte, quando la musica aveva smesso di
         * partire. Qui è volutamente separata dall'avvio: play() parte come
         * sempre, e solo DOPO che è riuscito il volume sale. Se play() viene
         * rifiutato, il volume viene comunque riportato al suo valore, così
         * nessun percorso può lasciare la musica "muta a volume zero".
         */
        const SFUMA_ENTRATA_MS = 900;
        const SFUMA_USCITA_MS = 320;
        let timerSfumatura = null;
        function fermaSfumatura() {
            if (timerSfumatura) { clearInterval(timerSfumatura); timerSfumatura = null; }
        }
        function sfuma(verso, durataMs, allaFine) {
            fermaSfumatura();
            const da = audio.volume;
            if (durataMs <= 0 || Math.abs(da - verso) < 0.01) {
                audio.volume = verso;
                if (allaFine) allaFine();
                return;
            }
            const passi = Math.max(1, Math.round(durataMs / 30));
            let passo = 0;
            timerSfumatura = setInterval(() => {
                passo++;
                audio.volume = Math.min(1, Math.max(0, da + (verso - da) * (passo / passi)));
                if (passo >= passi) {
                    fermaSfumatura();
                    if (allaFine) allaFine();
                }
            }, durataMs / passi);
        }

        function tryPlay() {
            fermaSfumatura();
            audio.volume = 0;
            const playPromise = audio.play();
            if (!playPromise || typeof playPromise.catch !== 'function') { audio.volume = volume; return; }

            playPromise.then(() => sfuma(volume, SFUMA_ENTRATA_MS)).catch(() => {
                audio.volume = volume;
                // I listener restano finché play() NON riesce davvero. Prima
                // erano 'once' e si consumavano al primo evento, ma su un
                // dispositivo touch 'pointerdown' e 'touchstart' non contano
                // come gesto che sblocca l'audio (lo fanno solo 'pointerup',
                // 'touchend' e 'click'): il primo tocco veniva rifiutato, i
                // listener sparivano e la musica restava muta per sempre.
                const eventiGesto = ['pointerdown', 'pointerup', 'mousedown', 'touchstart', 'touchend', 'click', 'keydown', 'wheel'];
                let tentativoInCorso = false;
                const startOnInteraction = () => {
                    if (tentativoInCorso || !audio.paused) return;
                    tentativoInCorso = true;
                    audio.volume = 0;
                    audio.play().then(() => {
                        eventiGesto.forEach((nome) => document.removeEventListener(nome, startOnInteraction, true));
                        sfuma(volume, SFUMA_ENTRATA_MS);
                    }).catch(() => { audio.volume = volume; }).then(() => { tentativoInCorso = false; });
                };
                eventiGesto.forEach((nome) => document.addEventListener(nome, startOnInteraction, { passive: true, capture: true }));
            });
        }

        function updateToggleButton() {
            const btn = document.getElementById('musicToggleBtn');
            if (!btn) return;
            btn.textContent = audio.muted ? '🔇' : '🔊';
            btn.classList.toggle('muted', audio.muted);
        }
        updateToggleButton();

        // Dove eravamo arrivati in ciascuna traccia già suonata in QUESTA
        // pagina. Serve a setTrack: entrare nel Negozio e poi tornare al
        // menu non deve far ripartire il tema del menu da capo ogni volta,
        // come non riparte da capo cambiando pagina. Vive solo in memoria
        // di proposito: è un dettaglio della sessione corrente, non una
        // preferenza da persistere.
        const trackPositions = {};

        /*
         * Uscita sfumata quando si lascia la pagina (solo browser). Un
         * cambio di pagina non si può "ritardare" da beforeunload/pagehide:
         * a quel punto è già deciso. Si usa allora la Navigation API
         * (Chrome/Edge, gli stessi browser della transizione fra pagine): si
         * ferma la navigazione, si abbassa il volume in ~0,3 s e la si rifà
         * identica. Vale solo per i veri cambi di pagina avviati dal gioco
         * (link, location.href): mai per un cambio di vista interno
         * (history.pushState, sameDocument), mai per Indietro/ricarica (non
         * annullabili), mai se la musica è ferma o muta. Una rete di
         * sicurezza a tempo fa partire la navigazione anche se la sfumatura
         * non arrivasse in fondo. Dove la Navigation API non c'è, la pagina
         * cambia come sempre, senza sfumatura in uscita.
         */
        if (!nativeMusic && window.navigation && typeof window.navigation.addEventListener === 'function') {
            let inUscita = false;
            window.navigation.addEventListener('navigate', (ev) => {
                if (inUscita) return;
                if (!ev.cancelable || ev.hashChange || ev.downloadRequest || ev.formData) return;
                if (ev.navigationType !== 'push' && ev.navigationType !== 'replace') return;
                if (!ev.destination || ev.destination.sameDocument) return;
                if (audio.paused || audio.muted || audio.volume < 0.02) return;
                let destinazione;
                try { destinazione = new URL(ev.destination.url); } catch (e) { return; }
                if (destinazione.origin !== window.location.origin) return;

                ev.preventDefault();
                inUscita = true;
                const sostituisci = ev.navigationType === 'replace';
                let partita = false;
                const vai = () => {
                    if (partita) return;
                    partita = true;
                    persistState();
                    if (sostituisci) window.location.replace(destinazione.href);
                    else window.location.href = destinazione.href;
                };
                sfuma(0, SFUMA_USCITA_MS, vai);
                setTimeout(vai, SFUMA_USCITA_MS + 250);
            });
        }

        // Pausa TEMPORANEA della musica di sottofondo (sospendi/riprendi
        // qui sotto), per chi deve far sentire altro per un momento — es.
        // l'anteprima di una traccia nel selettore di js/ui/duel-setup.js.
        let sospesa = false;
        let eraInRiproduzione = false;

        window.DuelMusic = {
            audio: audio,
            /**
             * Mette in pausa la musica di sottofondo finché qualcuno non
             * chiama riprendi(). Esiste perché nell'APK la musica NON è
             * l'elemento <audio> della pagina ma il MediaPlayer di
             * NativeMusic: mettere in pausa #bgMusicAudio lì non fermava
             * nulla, e l'anteprima di una traccia suonava sopra il
             * sottofondo (segnalato dall'utente). Qui si ferma il backend
             * vero, qualunque sia. Chiamarla due volte di fila non fa danni.
             */
            sospendi: function () {
                if (sospesa) return;
                sospesa = true;
                if (nativeMusic) {
                    eraInRiproduzione = true;
                    nativeMusic.pause().catch(() => {});
                    return;
                }
                eraInRiproduzione = !audio.paused;
                // Nel browser esce in dissolvenza (l'anteprima intanto entra).
                if (eraInRiproduzione) sfuma(0, SFUMA_USCITA_MS, () => { audio.pause(); audio.volume = volume; });
            },
            /** Fa ripartire la musica fermata da sospendi(), se stava suonando (nel browser in dissolvenza). */
            riprendi: function () {
                if (!sospesa) return;
                sospesa = false;
                if (!eraInRiproduzione) return;
                if (nativeMusic) { nativeMusic.resume().catch(() => {}); return; }
                if (audio.muted) return;
                // Se la sfumatura d'uscita non era ancora finita, si riparte
                // da dove era arrivata invece di passare dalla pausa.
                if (!audio.paused) { sfuma(volume, SFUMA_ENTRATA_MS); return; }
                tryPlay();
            },
            /**
             * Cambia la colonna sonora SENZA ricaricare la pagina. Nata con
             * le viste SPA di index.html: prima bastava passare `trackSrc`
             * a initAudioManager() perché ogni schermata era una pagina a
             * sé, ora invece Menu e Negozio convivono nello stesso
             * documento e vogliono musica diversa.
             *
             * Riprende ogni traccia dal punto in cui era stata lasciata
             * (vedi trackPositions): andare e tornare fra due schermate non
             * deve suonare come due partenze da zero.
             */
            setTrack: function (src, trackOptions) {
                trackOptions = trackOptions || {};
                const wanted = src || DEFAULT_TRACK;
                if (trackSrc === wanted && !trackOptions.restart) return;
                trackPositions[trackSrc] = audio.currentTime || 0;
                trackSrc = wanted;
                const resumeAt = trackOptions.restart ? 0 : (trackPositions[wanted] || 0);
                if (nativeMusic) {
                    nativeMusic.play(nativeOptions(resumeAt, trackOptions.restart)).catch(() => {});
                    persistState();
                    return;
                }
                audio.src = wanted;
                if (resumeAt > 0) {
                    // Stesso motivo per cui il seek iniziale aspetta
                    // 'canplay' e non 'loadedmetadata': prima di allora il
                    // buffer non basta per un seek affidabile.
                    audio.addEventListener('canplay', function onReady() {
                        audio.removeEventListener('canplay', onReady);
                        if (resumeAt < audio.duration) audio.currentTime = resumeAt;
                    }, { once: true });
                }
                persistState();
                if (!audio.muted) tryPlay();
            },
            getTrack: function () { return trackSrc; },
            isMuted: function () { return audio.muted; },
            toggleMute: function () {
                audio.muted = !audio.muted;
                muted = audio.muted;
                try { localStorage.setItem(KEY_MUTED, String(audio.muted)); } catch (e) { /* noop */ }
                if (window.SaveManager && SaveManager.setSetting) SaveManager.setSetting('musicMuted', audio.muted);
                if (!nativeMusic && !audio.muted && audio.paused) tryPlay();
                if (nativeMusic) nativeMusic.setMuted({ muted: audio.muted }).catch(() => {});
                updateToggleButton();
                return audio.muted;
            },
            setMuted: function (value) {
                audio.muted = !!value;
                muted = audio.muted;
                try { localStorage.setItem(KEY_MUTED, String(audio.muted)); } catch (e) { /* noop */ }
                if (window.SaveManager && SaveManager.setSetting) SaveManager.setSetting('musicMuted', audio.muted);
                if (!nativeMusic && !audio.muted && audio.paused) tryPlay();
                if (nativeMusic) nativeMusic.setMuted({ muted: audio.muted }).catch(() => {});
                updateToggleButton();
            },
            getVolume: function () { return audio.volume; },
            /** 0..1. Persiste in localStorage: resta la stessa in ogni pagina e sessione futura. */
            setVolume: function (value) {
                fermaSfumatura(); // la scelta dell'utente vince su una sfumatura in corso
                audio.volume = Math.min(1, Math.max(0, value));
                volume = audio.volume;
                if (nativeMusic) nativeMusic.setVolume({ volume: audio.volume }).catch(() => {});
                try { localStorage.setItem(KEY_VOLUME, String(audio.volume)); } catch (e) { /* noop */ }
                if (window.SaveManager && SaveManager.setSetting) SaveManager.setSetting('musicVolume', audio.volume);
            },
            /**
             * Riproduce UNA VOLTA sola (niente loop) un effetto/stacchetto —
             * es. il jingle di Vittoria/Game Over a fine duello — su un
             * <audio> separato, così non tocca posizione/continuità della
             * musica di sottofondo condivisa. Per default SFUMA (fade out,
             * non uno stop secco) quella di sottofondo mentre il jingle
             * parte subito sopra — passare { pauseMusic: false } per
             * lasciare la musica di sottofondo intatta, o { fadeMs: 0 } per
             * uno stop immediato senza dissolvenza. Rispetta mute/volume
             * correnti, come la musica di sottofondo.
             */
            playOneShot: function (src, options) {
                options = options || {};
                const fadeMs = options.fadeMs !== undefined ? options.fadeMs : 500;
                // Il volume SCELTO, non quello del momento: se una sfumatura
                // d'ingresso è ancora a metà, audio.volume è più basso.
                fermaSfumatura();
                const baseVolume = volume;

                if (options.pauseMusic !== false) {
                    if (nativeMusic) nativeMusic.pause().catch(() => {});
                    if (fadeMs > 0 && !audio.paused) {
                        const steps = 12;
                        let step = 0;
                        const fadeTimer = setInterval(() => {
                            step++;
                            audio.volume = Math.max(0, baseVolume * (1 - step / steps));
                            if (step >= steps) {
                                clearInterval(fadeTimer);
                                audio.pause();
                                audio.volume = baseVolume; // pronta per la prossima pagina/riproduzione
                            }
                        }, fadeMs / steps);
                    } else {
                        audio.pause();
                    }
                }

                const sfx = new Audio(src);
                sfx.loop = false;
                sfx.volume = baseVolume;
                if (!audio.muted) sfx.play().catch(() => {});
                return sfx;
            }
        };

        const btn = document.getElementById('musicToggleBtn');
        if (btn) {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                window.DuelMusic.toggleMute();
            });
        }
    }

    window.initAudioManager = initAudioManager;
})();
