// @ts-check
/**
 * hologram-setting.js — "Visualizzazione ologramma" acceso o spento.
 * ------------------------------------------------------------------
 * Gemello minuto di js/ui/video-quality.js, e per le stesse ragioni: è
 * una scelta del DISPOSITIVO (lo stesso account su un telefono lento e
 * su un PC può volerla diversa), quindi vive in localStorage e NON nel
 * salvataggio unificato — come la vibrazione in js/native/haptics.js.
 *
 * Questo file non disegna nulla: ricorda la scelta e la scrive su <html>
 * come `data-ologramma`, così un effetto futuro può accendersi da solo in
 * CSS senza toccare né questo file né il motore. Chi ha bisogno di vero
 * JavaScript chiede `HologramSetting.isAttivo()` al momento giusto — è
 * quello che fa js/ui/monster-hologram.js.
 *
 * DEFAULT ACCESO, su richiesta esplicita dell'utente. Quando è nato era
 * una differenza voluta rispetto ai "Dettagli video", che allora partivano
 * da "Normali" (oggi partono da "Alti", ma la separazione resta): quelli
 * accendono effetti ambientali continui su tutto lo schermo, questo
 * aggiunge un elemento per mostro scoperto, con un costo misurato di 0
 * fps a campo pieno (10 ologrammi, 60 fps con e senza). Per la stessa
 * ragione NON dipende più dai Dettagli video: se dipendesse, un default
 * "acceso" non si vedrebbe comunque finché non si alza anche quell'altra
 * impostazione, e sarebbe un default acceso solo di nome.
 *
 * La scelta si applica SUBITO al caricamento (in fondo), non al
 * DOMContentLoaded: così il primo frame dipinto è già quello giusto.
 */
(function () {
    'use strict';

    const CHIAVE = 'ygoHologram';
    const ACCESO = 'on';
    const SPENTO = 'off';
    const DEFAULT = ACCESO;

    function leggi() {
        try {
            const salvato = localStorage.getItem(CHIAVE);
            // Un valore sconosciuto (salvataggio di una versione futura, o
            // manomesso) non deve lasciare la pagina in uno stato che
            // nessun CSS conosce: si ricade sul default.
            return (salvato === ACCESO || salvato === SPENTO) ? salvato : DEFAULT;
        } catch (e) {
            // localStorage può lanciare (navigazione privata, permessi):
            // la preferenza si perde, il gioco no.
            return DEFAULT;
        }
    }

    function applica() {
        const valore = leggi();
        if (document.documentElement) document.documentElement.dataset.ologramma = valore;
        return valore;
    }

    function imposta(attivo) {
        const valore = attivo ? ACCESO : SPENTO;
        try {
            localStorage.setItem(CHIAVE, valore);
        } catch (e) { /* come sopra: non si salva, ma vale per questa sessione */ }
        if (window.SaveManager && SaveManager.setSetting) SaveManager.setSetting('hologram', !!attivo);
        if (document.documentElement) document.documentElement.dataset.ologramma = valore;
        return valore;
    }

    window.HologramSetting = {
        get: leggi,
        set: imposta,
        isAttivo: () => leggi() === ACCESO,
        applica: applica
    };

    applica();
})();
