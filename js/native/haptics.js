// @ts-check
/**
 * haptics.js — feedback tattile (vibrazione) tramite @capacitor/haptics,
 * SOLO dentro l'APK nativo — su web ogni funzione qui sotto è un no-op
 * silenzioso, stesso pattern di ensureCapacitorAppIntegration() in
 * js/audio/audio-manager.js e di js/native/app-back-button.js: mai un
 * requisito, un piccolo tocco "app vera" quando disponibile.
 *
 * Le stringhe passate a impact()/notification() ('LIGHT'/'MEDIUM'/
 * 'HEAVY', 'SUCCESS'/'ERROR') sono i valori REALI usati a runtime dal
 * plugin (ImpactStyle/NotificationType in @capacitor/haptics) — scritte
 * qui a mano invece di importarle perché questo progetto non ha
 * bundler/moduli ES, stesso motivo per cui altrove si scrive
 * orientation:'landscape' invece di un import da
 * @capacitor/screen-orientation.
 */
(function () {
    'use strict';

    // Preferenza del giocatore (Impostazioni). Sta in localStorage e non
    // nel salvataggio: è una scelta del DISPOSITIVO, non del profilo —
    // chi gioca sul telefono può volere la vibrazione e sullo stesso
    // account, da PC, non avere nulla da spegnere. Stessa logica di
    // musica ed effetti sonori, che si regolano allo stesso modo.
    const CHIAVE = 'ygoHapticsEnabled';
    let attiva = leggiPreferenza();

    function leggiPreferenza() {
        try {
            // Assente = attiva: è il comportamento che il gioco ha sempre
            // avuto, e una preferenza mai espressa non deve cambiarlo.
            return localStorage.getItem(CHIAVE) !== '0';
        } catch (e) {
            return true; // localStorage negato (finestra privata)
        }
    }

    function getPlugin() {
        if (!window.Capacitor || !Capacitor.isNativePlatform || !Capacitor.isNativePlatform()) return null;
        return (Capacitor.Plugins && Capacitor.Plugins.Haptics) || null;
    }

    function impact(style) {
        if (!attiva) return;
        const plugin = getPlugin();
        if (plugin && typeof plugin.impact === 'function') plugin.impact({ style: style }).catch(() => {});
    }

    function notification(type) {
        if (!attiva) return;
        const plugin = getPlugin();
        if (plugin && typeof plugin.notification === 'function') plugin.notification({ type: type }).catch(() => {});
    }

    window.NativeHaptics = {
        light: () => impact('LIGHT'),
        medium: () => impact('MEDIUM'),
        heavy: () => impact('HEAVY'),
        success: () => notification('SUCCESS'),
        error: () => notification('ERROR'),
        isEnabled: () => attiva,
        setEnabled: (valore) => {
            attiva = !!valore;
            try { localStorage.setItem(CHIAVE, attiva ? '1' : '0'); } catch (e) { /* vedi sopra */ }
            if (window.SaveManager && SaveManager.setSetting) SaveManager.setSetting('haptics', attiva);
            // Un colpetto di conferma quando si riattiva: è l'unico modo
            // di far capire, su un telefono, che cosa si è appena acceso.
            if (attiva) impact('LIGHT');
        },
        /**
         * Vero solo dentro l'APK: sul web il plugin non esiste e nessuna
         * vibrazione è possibile. Serve alle Impostazioni per dirlo
         * apertamente, invece di offrire un interruttore che non fa nulla
         * senza spiegare perché.
         */
        isSupported: () => !!getPlugin()
    };
})();
