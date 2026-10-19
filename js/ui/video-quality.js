// @ts-check
/**
 * video-quality.js — Livello di DETTAGLI VIDEO scelto dal giocatore.
 * ------------------------------------------------------------------
 * Due soli livelli, deliberatamente:
 *   'normali'           — il gioco più leggero, per i dispositivi lenti;
 *   'alti' (default su desktop; su touch/APK il default è 'normali',
 *                         vedi dispositivoLeggero) — effetti aggiuntivi
 *                         sul Terreno di gioco.
 *
 * DEFAULT "ALTI", su richiesta esplicita dell'utente (prima era
 * "Normali"). Il cambio di default doveva valere anche per chi c'era già,
 * ma "Normali" stava scritto ovunque — nel salvataggio e nella cache —
 * anche per chi non l'aveva mai scelto, perché era il default. Da qui il
 * segno CHIAVE_SCELTA: solo una scelta fatta davvero dal giocatore (set)
 * lo accende, e senza quel segno vale il default. Chi aveva scelto
 * "Normali" a mano prima che il segno esistesse non si distingue da chi
 * non aveva mai scelto: torna ad "Alti" una volta, e può rimettere
 * "Normali" dalle Impostazioni.
 *
 * Questo file NON disegna e NON anima nulla: si limita a ricordare la
 * scelta e a scriverla sul documento come `data-dettagli` sull'elemento
 * <html>. È l'unica cosa che serve perché un effetto futuro possa
 * accendersi da solo:
 *
 *     html[data-dettagli="alti"] .field-slot::after { ... }
 *
 * — nessuna modifica a questo file, nessun controllo JS sparso nel
 * motore. Un effetto che ha invece bisogno di vero JavaScript chiede
 * `VideoQuality.isAlti()` al momento giusto, e si spegne da sé quando è
 * falso. La scelta viene applicata SUBITO al caricamento (vedi in fondo),
 * quindi il primo frame dipinto è già quello giusto: se fosse applicata
 * dopo, una pagina di duello mostrerebbe per un istante gli effetti del
 * livello sbagliato.
 *
 * La preferenza vive in localStorage e NON nel salvataggio unificato: è
 * una scelta del DISPOSITIVO (un telefono lento e un PC possono volere
 * livelli diversi con lo stesso account), esattamente come la vibrazione
 * in js/native/haptics.js — stesso schema, stessa motivazione.
 */
(function () {
    'use strict';

    const CHIAVE = 'ygoVideoDetail';
    /** '1' quando il livello l'ha scelto il giocatore (vedi in cima al file). */
    const CHIAVE_SCELTA = 'ygoVideoDetailScelto';
    const NORMALI = 'normali';
    const ALTI = 'alti';
    /**
     * Il livello di partenza per chi non ha mai scelto: "Alti" sul
     * desktop, "Normali" su touch/APK. Misurato (CPU x4, 844x390@2x): gli
     * strati con mix-blend-mode di field-ambience.js portano il duello da
     * ~57 a ~17 fps, ed è su telefono e WebView Capacitor che pesano di più.
     * Una scelta esplicita del giocatore (CHIAVE_SCELTA) vince sempre.
     */
    function dispositivoLeggero() {
        try {
            if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function'
                && window.Capacitor.isNativePlatform()) return true;
            return !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
        } catch (e) {
            return false;
        }
    }
    const DEFAULT = dispositivoLeggero() ? NORMALI : ALTI;

    const LIVELLI = [
        { valore: NORMALI, nome: 'Normali', descrizione: 'Il gioco più leggero: massima fluidità sui dispositivi meno potenti.' },
        { valore: ALTI, nome: 'Alti', descrizione: 'Effetti aggiuntivi sul Terreno di gioco. Può pesare sui dispositivi meno potenti.' }
    ];

    function leggi() {
        try {
            if (localStorage.getItem(CHIAVE_SCELTA) !== '1') return DEFAULT;
            const salvato = localStorage.getItem(CHIAVE);
            // Un valore sconosciuto (salvataggio di una versione futura,
            // o manomesso) non deve lasciare il gioco in uno stato che
            // nessun CSS conosce: si ricade sul default.
            return (salvato === ALTI || salvato === NORMALI) ? salvato : DEFAULT;
        } catch (e) {
            // localStorage può lanciare (navigazione privata, permessi):
            // la preferenza si perde, il gioco no.
            return DEFAULT;
        }
    }

    function applica() {
        const livello = leggi();
        if (document.documentElement) document.documentElement.dataset.dettagli = livello;
        return livello;
    }

    function imposta(livello) {
        const valido = (livello === ALTI) ? ALTI : NORMALI;
        try {
            localStorage.setItem(CHIAVE, valido);
            localStorage.setItem(CHIAVE_SCELTA, '1');
        } catch (e) { /* come sopra: la scelta non si salva, ma vale per questa sessione */ }
        if (window.SaveManager && SaveManager.setSetting) {
            SaveManager.setSetting('videoDetailScelto', true);
            SaveManager.setSetting('videoDetail', valido);
        }
        if (document.documentElement) document.documentElement.dataset.dettagli = valido;
        // I moduli JS continui (oggi FieldAmbience) devono potersi
        // spegnere subito, non soltanto al prossimo caricamento pagina.
        window.dispatchEvent(new CustomEvent('ygo:video-quality-change', { detail: { livello: valido } }));
        return valido;
    }

    window.VideoQuality = {
        NORMALI: NORMALI,
        ALTI: ALTI,
        LIVELLI: LIVELLI,
        get: leggi,
        set: imposta,
        isAlti: () => leggi() === ALTI,
        applica: applica
    };

    // Applicata subito, non al DOMContentLoaded: questo script è caricato
    // nell'<head>/in cima al <body> delle pagine che ne hanno bisogno, e
    // <html> esiste già mentre lo si sta eseguendo.
    applica();
})();
