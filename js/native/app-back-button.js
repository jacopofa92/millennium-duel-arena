// @ts-check
/**
 * app-back-button.js — Intercetta il tasto Indietro hardware/gesture di
 * Android (via @capacitor/app, plugin App.addListener('backButton', ...))
 * SOLO dentro l'APK nativo (Capacitor.isNativePlatform()) — su web questo
 * file non fa nulla, il tasto Indietro del browser resta quello di sempre.
 *
 * Senza questo listener, Capacitor applica il proprio comportamento di
 * default: un webView.goBack() nella cronologia interna se possibile,
 * altrimenti chiude/minimizza l'app. Per la maggior parte delle pagine di
 * questo gioco (cartoteca.html, negozio.html, ecc., raggiunte con una vera
 * navigazione location.href, quindi con una vera cronologia) questo
 * default è già quello giusto: tornano da sole alla pagina precedente —
 * per loro basta caricare questo file, nessun'altra riga di codice serve.
 * Il problema è index.html, che gestisce Profilo/Duello Libero/i
 * sottomenu/i modali TUTTI dentro lo stesso documento (SPA interna, vedi
 * il router in quel file) senza mai spingere una nuova voce nella
 * cronologia — il default vedrebbe "nessuna cronologia" e uscirebbe
 * dall'app di scatto anche stando dentro Profilo, saltando il ritorno al
 * menu che l'utente si aspetta. Per quel caso, NativeBackButton.setHandler()
 * qui sotto permette a UNA pagina di inserirsi PRIMA del default.
 *
 * Uso, in ogni pagina (nessuna riga di JS necessaria oltre al tag):
 *   <script src="js/native/app-back-button.js"></script>
 *
 * Uso, SOLO nella pagina che ha bisogno di gestire il tasto Indietro a
 * modo suo prima del default (oggi solo index.html):
 *   NativeBackButton.setHandler(() => {
 *       // torna true se il tasto è già stato "consumato" qui (es. chiuso
 *       // un modale/sottomenu/vista interna) - il default NON scatta.
 *       // torna false/undefined per lasciare che scatti il default.
 *   });
 */
(function () {
    'use strict';

    let customHandler = null;

    /** Registra `fn` come da chiamare PRIMA del default ad ogni pressione del tasto Indietro — vedi il commento in cima al file. */
    function setHandler(fn) {
        customHandler = typeof fn === 'function' ? fn : null;
    }

    if (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
        const AppPlugin = Capacitor.Plugins && Capacitor.Plugins.App;
        if (AppPlugin && typeof AppPlugin.addListener === 'function') {
            AppPlugin.addListener('backButton', ({ canGoBack }) => {
                if (customHandler) {
                    let handled = false;
                    try { handled = !!customHandler(); } catch (e) { console.warn('[NativeBackButton] handler personalizzato in errore:', e); }
                    if (handled) return;
                }
                if (canGoBack) {
                    window.history.back();
                } else {
                    AppPlugin.exitApp();
                }
            });
        }
    }

    window.NativeBackButton = { setHandler: setHandler };
})();
