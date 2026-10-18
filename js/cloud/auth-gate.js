// @ts-check
/**
 * auth-gate.js — Punto d'accesso OBBLIGATORIO condiviso da OGNI pagina
 * del gioco (menu escluso: index.html mostra lei stessa la schermata di
 * accesso e imposta `window.AUTH_GATE_SKIP = true` PRIMA di caricare
 * questo script — vedi lì). Sostituisce il vecchio "Continua in locale"
 * del gate di index.html: da questa sessione un account APPROVATO da un
 * amministratore (js/cloud/cloud-sync.js, stesso meccanismo del progetto
 * Fioxify) è richiesto per usare qualunque pagina del gioco, non solo
 * per la sincronizzazione facoltativa del salvataggio.
 *
 * Incluso in ogni pagina come js/ui/page-loader.js/js/ui/topbar.js: un
 * `<script>` in cima al `<body>` (o comunque PRIMA di qualunque markup
 * di gioco vero), così una pagina protetta non viene mai disegnata
 * anche solo per un istante prima del redirect — vedi il CSS
 * `#authGateOverlay` sotto per la copertura immediata dal primo frame.
 *
 * FUNZIONAMENTO OFFLINE (APK): CloudSync.ensureApprovedSession() prova
 * SEMPRE una verifica online fresca, ma ricade su un marcatore locale
 * dell'ultima approvazione CONFERMATA online per questo stesso utente
 * se la rete non risponde — così un dispositivo che si è già autenticato
 * online una volta (obbligatorio al primo avvio) resta utilizzabile
 * offline ai successivi, ma un account rifiutato/revocato dopo il primo
 * accesso viene comunque bloccato al primo controllo online successivo,
 * non per sempre. Vedi il commento su ensureApprovedSession in
 * cloud-sync.js per i dettagli — non è una cache HTTP/Service-Worker,
 * è un marcatore esplicito per-utente scritto SOLO da una verifica
 * online riuscita.
 */
(function () {
    'use strict';

    if (window.AUTH_GATE_SKIP) return;

    // Overlay di attesa MINIMO (nessuna animazione: il vero page-loader,
    // se la pagina lo carica, copre già l'aspetto — questo esiste solo
    // per non lasciare il contenuto vero della pagina visibile anche un
    // istante mentre il controllo di sessione è in corso, es. su una
    // pagina che non usa page-loader.js).
    var overlay = document.createElement('div');
    overlay.id = 'authGateOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:1000000;background:#05060a;';
    if (document.body) document.body.insertBefore(overlay, document.body.firstChild);
    else document.documentElement.appendChild(overlay);

    // Segnale letto da js/ui/page-loader.js (eseguito DOPO questo script,
    // essendo un <script> di head vs uno in cima al <body>): finché è
    // true, il page-loader NON deve nascondersi da solo al window.load,
    // anche se il suo minimo di visualizzazione è già scaduto — altrimenti
    // il suo dissolvenza (page-loader.css, 0.5s) può essere già a metà (o
    // già conclusa) quando QUESTO overlay sparisce, e l'utente vede per un
    // istante il disco di caricamento animato "riapparire" da sotto prima
    // che la pagina vera si veda — bug reale segnalato dall'utente su
    // Cartoteca. window.__authGatePending resta undefined su una pagina
    // che non carica affatto questo script (es. index.html, che imposta
    // AUTH_GATE_SKIP prima ancora di arrivare qui): page-loader.js tratta
    // "undefined" come "nessun gate da aspettare", comportamento invariato.
    window.__authGatePending = true;

    function removeOverlay() {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        window.__authGatePending = false;
        window.dispatchEvent(new Event('authgate:approved'));
    }

    function redirectToLogin(reason) {
        var here = window.location.pathname;
        var base = here.substring(0, here.lastIndexOf('/') + 1);
        window.location.replace(base + 'index.html' + (reason ? ('?blocked=' + reason) : ''));
    }

    if (!window.CloudSync) {
        // js/cloud/cloud-sync.js non caricato in questa pagina (pagina non
        // ancora aggiornata, o supabase.min.js mancante) — non possiamo
        // verificare nulla: per sicurezza rimanda comunque al login,
        // invece di lasciare la pagina aperta senza alcun controllo.
        redirectToLogin('unavailable');
        return;
    }

    CloudSync.waitForUser().then(function (user) {
        if (!CloudSync.available || !user) {
            redirectToLogin();
            return;
        }
        return CloudSync.ensureApprovedSession().then(function (approved) {
            if (!approved) {
                var profile = CloudSync.getProfile();
                var reason = profile && profile.status === 'rejected' ? 'rejected' : 'pending';
                CloudSync.signOut().catch(function () { /* noop */ }).then(function () {
                    redirectToLogin(reason);
                });
                return;
            }
            removeOverlay();
        });
    }).catch(function () {
        // Qualunque errore imprevisto nel controllo stesso: per sicurezza
        // rimanda al login invece di lasciare la pagina scoperta.
        redirectToLogin();
    });
})();
