// @ts-check
/**
 * native-save-backup.js — backup RESILIENTE del salvataggio (vedi
 * js/save-manager.js) su storage nativo (@capacitor/preferences), SOLO
 * dentro l'APK — su web è un no-op completo, localStorage resta l'unica
 * fonte di verità esattamente come sempre (il gioco deve continuare a
 * funzionare identico aperto da un browser qualsiasi).
 *
 * Perché serve SOLO nell'APK: questo progetto gira oggi in modalità
 * "dev-shell" (vedi la memoria di sessione sul wrapper Android) — l'app
 * punta a un URL di sviluppo (http://<ip-lan>:8080), e localStorage in
 * un WebView è partizionato per ORIGINE. Se quell'IP cambia (rete
 * diversa, router che riassegna l'indirizzo) e capacitor.config.json
 * viene ricompilato di conseguenza, il WebView si ritrova su
 * un'origine NUOVA: localStorage riparte vuoto, anche se per l'utente è
 * "la stessa app". @capacitor/preferences (SharedPreferences nativo)
 * non è legato all'origine del WebView, quindi sopravvive a questo
 * scenario — resterà utile anche dopo, con una build di release
 * bundled, come rete di sicurezza in più contro un localStorage
 * svuotato dal sistema.
 *
 * Uso (vedi i punti d'aggancio in js/save-manager.js e index.html):
 *   NativeSaveBackup.mirror(saveObject) — scrittura "fire and forget",
 *     mai bloccante: chiamata da save-manager.js ad OGNI scrittura reale
 *     (writeRaw). Se fallisce, localStorage resta comunque la fonte di
 *     verità per questa sessione — nessun impatto per l'utente.
 *   NativeSaveBackup.tryRecover() — Promise<object|null>: va chiamata
 *     SOLO quando localStorage non ha alcun salvataggio, PRIMA di
 *     trattare l'utente come un "nuovo giocatore" — se esiste un
 *     backup nativo, chi chiama lo riapplica con
 *     SaveManager.applyExternalSave().
 */
(function () {
    'use strict';

    const KEY = 'yugiohDuelArenaSaveBackup';

    function getPlugin() {
        if (!window.Capacitor || !Capacitor.isNativePlatform || !Capacitor.isNativePlatform()) return null;
        return (Capacitor.Plugins && Capacitor.Plugins.Preferences) || null;
    }

    function mirror(data) {
        const plugin = getPlugin();
        if (!plugin || typeof plugin.set !== 'function') return;
        try {
            plugin.set({ key: KEY, value: JSON.stringify(data) }).catch(() => {});
        } catch (e) { /* noop: mai deve interrompere il chiamante sincrono */ }
    }

    function tryRecover() {
        const plugin = getPlugin();
        if (!plugin || typeof plugin.get !== 'function') return Promise.resolve(null);
        return plugin.get({ key: KEY })
            .then((result) => {
                if (!result || !result.value) return null;
                try { return JSON.parse(result.value); } catch (e) { return null; }
            })
            .catch(() => null);
    }

    /**
     * Toglie il backup. Serve all'azzeramento del profilo
     * (SaveManager.deleteSave): senza, al primo avvio senza salvataggio
     * index.html ripristinerebbe da qui proprio i dati appena azzerati.
     */
    function clear() {
        const plugin = getPlugin();
        if (!plugin || typeof plugin.remove !== 'function') return;
        try { plugin.remove({ key: KEY }).catch(() => {}); } catch (e) { /* noop */ }
    }

    window.NativeSaveBackup = { mirror: mirror, tryRecover: tryRecover, clear: clear };
})();
