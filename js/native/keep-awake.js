// @ts-check
/**
 * keep-awake.js — impedisce allo schermo di spegnersi/dimmerare durante
 * un duello (via @capacitor-community/keep-awake), SOLO dentro l'APK
 * nativo — su web è un no-op silenzioso, stesso pattern di
 * js/native/app-back-button.js e js/native/haptics.js.
 *
 * Perché serve: un duello è a turni, con lunghe pause mentre si aspetta
 * la mossa del bot (o dell'avversario in multiplayer) — senza questo, lo
 * spegnimento automatico dello schermo di Android interrompe il duello
 * nel mezzo, un fastidio reale per un gioco a turni. Va abilitato SOLO
 * dalla pagina di duello vera e propria (duelMonstersCore.html), mai
 * globalmente: nessun motivo di tenere sveglio lo schermo su Cartoteca o
 * nel menu.
 *
 * NativeKeepAwake.disable() va richiamata quando si LASCIA la pagina di
 * duello (es. su 'pagehide', stesso evento già usato da
 * js/audio/audio-manager.js per la persistenza dell'audio): il flag
 * nativo (FLAG_KEEP_SCREEN_ON) vive a livello di Activity, non del
 * singolo documento WebView — una nuova navigazione (verso index.html
 * ecc, che nel WebView di Capacitor È una vera nuova pagina) non lo
 * azzera da sola, quindi senza questa disattivazione esplicita lo
 * schermo resterebbe sveglio per sempre anche fuori da un duello.
 */
(function () {
    'use strict';

    function getPlugin() {
        if (!window.Capacitor || !Capacitor.isNativePlatform || !Capacitor.isNativePlatform()) return null;
        return (Capacitor.Plugins && Capacitor.Plugins.KeepAwake) || null;
    }

    function enable() {
        const plugin = getPlugin();
        if (plugin && typeof plugin.keepAwake === 'function') plugin.keepAwake().catch(() => {});
    }

    function disable() {
        const plugin = getPlugin();
        if (plugin && typeof plugin.allowSleep === 'function') plugin.allowSleep().catch(() => {});
    }

    window.NativeKeepAwake = { enable: enable, disable: disable };
})();
