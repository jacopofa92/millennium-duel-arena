// @ts-check
/**
 * pwa-register.js — Registra sw.js (vedi il commento lì per la strategia
 * di cache) su ogni pagina che lo include. Percorso RELATIVO ('sw.js',
 * mai '/sw.js'): GitHub Pages serve questo progetto sotto un
 * sottopercorso (https://<utente>.github.io/<repo>/), non alla radice
 * del dominio.
 *
 * Il registro fallisce in silenzio ovunque i Service Worker non siano
 * supportati (es. browser molto vecchi) o la pagina sia aperta come file
 * locale (file://, dove i Service Worker non funzionano affatto) — niente
 * di grave, il gioco resta comunque giocabile online, solo senza cache
 * offline.
 *
 * BUG REALE segnalato dall'utente e corretto qui: un aggiornamento del
 * gioco già pubblicato online (nuovo sw.js con CACHE_NAME incrementato)
 * poteva restare INVISIBILE per diverso tempo sull'APK Android, mostrando
 * ancora codice vecchio nonostante la strategia "network-first" per l'app
 * shell (vedi sw.js) — perché quella strategia vive DENTRO il Service
 * Worker già attivo: se il browser/WebView non ha ancora controllato che
 * esiste un sw.js più recente, resta attivo quello vecchio e nessuna
 * "rete prima" lo aggiorna da sola. `register()` da solo NON forza questo
 * controllo: il browser lo farebbe comunque, ma con una propria cadenza
 * interna, non garantita ad ogni singola apertura dell'app — chiamare
 * `registration.update()` subito dopo la registrazione lo richiede
 * esplicitamente ad ogni avvio, così un aggiornamento già online viene
 * rilevato e installato il prima possibile invece di aspettare il timing
 * proprio del browser.
 */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then((registration) => {
                registration.update().catch(() => { /* offline o rete instabile: nessun problema, si ricontrolla al prossimo avvio */ });
            })
            .catch(() => { /* noop: vedi commento sopra */ });
    });
}
