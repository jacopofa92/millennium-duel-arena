// @ts-check
/**
 * inclinazione.js — da che parte "pende" la scena: mouse o giroscopio.
 * =====================================================================
 * Un'unica fonte per gli effetti di profondità finta: la carta "viva"
 * che si inclina e riflette la luce (Carta viva, in js/ui/card-renderer.js)
 * e la parallasse del menu principale (index.html). Prima di questo file
 * nessuna delle due esisteva; tenerne la fonte in un posto solo vuol dire
 * che giroscopio, ricentratura e movimento ridotto si comportano allo
 * stesso modo ovunque.
 *
 * Chi ascolta riceve { x, y, fonte }: x e y vanno da -1 a 1 (x verso
 * destra, y verso il basso), `fonte` è 'sensore' (il telefono si inclina)
 * o 'puntatore' (il mouse si muove nella finestra). Il tocco non conta:
 * su un telefono il dito serve a scorrere e a toccare, non a inclinare.
 *
 * Il GIROSCOPIO dà angoli assoluti, ma nessuno tiene il telefono in piano:
 * la posizione "a riposo" è quella in cui la persona lo sta tenendo. Si
 * parte quindi dalla prima lettura e la si fa scivolare piano verso quella
 * attuale (RICENTRATURA): un'inclinazione breve si sente tutta, una tenuta
 * a lungo torna lentamente al centro. Senza, chi gioca sdraiato vedrebbe
 * tutto pendere da un lato per sempre.
 *
 * Gli ascoltatori di sistema si accendono solo finché qualcuno ascolta, e
 * per nessuno se il sistema chiede di ridurre il movimento: in quel caso
 * gli effetti restano fermi, senza che chi li usa debba controllarlo.
 */
(function () {
    'use strict';

    /** Gradi di inclinazione del telefono che valgono "tutta" l'inclinazione. */
    const GRADI_PIENI = 18;
    /** Quanto la posizione di riposo insegue quella attuale a ogni lettura (~3 s a 60 letture al secondo). */
    const RICENTRATURA = 0.006;

    const ascoltatori = new Set();
    let acceso = false;
    let riposo = null;
    let haSensore = false;
    let inAttesa = null;

    function movimentoRidotto() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    function limita(v) { return Math.max(-1, Math.min(1, v)); }

    /** Al massimo un avviso per fotogramma, con l'ultima lettura: il sensore può scrivere più spesso dello schermo. */
    function avvisa(lettura) {
        const giaProgrammato = inAttesa !== null;
        inAttesa = lettura;
        if (giaProgrammato) return;
        requestAnimationFrame(() => {
            const l = inAttesa;
            inAttesa = null;
            ascoltatori.forEach((fn) => { try { fn(l); } catch (e) { /* un ascoltatore rotto non ferma gli altri */ } });
        });
    }

    function suOrientamento(e) {
        if (e.beta == null || e.gamma == null) return;
        haSensore = true;
        // beta = avanti/indietro, gamma = sinistra/destra, riferiti al
        // telefono in verticale: in orizzontale i due assi si scambiano.
        const angolo = (window.screen && screen.orientation && typeof screen.orientation.angle === 'number')
            ? screen.orientation.angle : (window.orientation || 0);
        let x = e.gamma;
        let y = e.beta;
        if (angolo === 90) { x = e.beta; y = -e.gamma; }
        else if (angolo === 270 || angolo === -90) { x = -e.beta; y = e.gamma; }
        if (!riposo) riposo = { x: x, y: y };
        riposo.x += (x - riposo.x) * RICENTRATURA;
        riposo.y += (y - riposo.y) * RICENTRATURA;
        avvisa({ x: limita((x - riposo.x) / GRADI_PIENI), y: limita((y - riposo.y) / GRADI_PIENI), fonte: 'sensore' });
    }

    function suPuntatore(e) {
        if (e.pointerType === 'touch') return;
        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;
        avvisa({ x: limita(e.clientX / w * 2 - 1), y: limita(e.clientY / h * 2 - 1), fonte: 'puntatore' });
    }

    function aggiornaAscolto() {
        const serve = ascoltatori.size > 0 && !movimentoRidotto();
        if (serve === acceso) return;
        acceso = serve;
        if (serve) {
            window.addEventListener('deviceorientation', suOrientamento);
            window.addEventListener('pointermove', suPuntatore, { passive: true });
        } else {
            window.removeEventListener('deviceorientation', suOrientamento);
            window.removeEventListener('pointermove', suPuntatore);
            riposo = null;
        }
    }

    /** Ascolta l'inclinazione. Torna la funzione che smette di ascoltare. */
    function ascolta(fn) {
        ascoltatori.add(fn);
        aggiornaAscolto();
        return () => { ascoltatori.delete(fn); aggiornaAscolto(); };
    }

    // ------------------------------------------------------------------
    // Impostazione "Profondità del menu" (la parallasse di index.html).
    // ------------------------------------------------------------------
    // Accesa di default, su richiesta dell'utente. Scelta del dispositivo
    // in localStorage come gli ologrammi (js/ui/hologram-setting.js), e
    // ricopiata nel salvataggio (SaveManager.setSetting) come le altre.
    // Cambiandola si avvisa con un evento: la vista Impostazioni sta nella
    // stessa pagina del menu, e il menu deve fermarsi o ripartire subito.
    const CHIAVE_PARALLASSE = 'ygoParallasseMenu';

    function parallasseMenuAttiva() {
        try { return localStorage.getItem(CHIAVE_PARALLASSE) !== 'off'; } catch (e) { return true; }
    }
    function impostaParallasseMenu(attiva) {
        try { localStorage.setItem(CHIAVE_PARALLASSE, attiva ? 'on' : 'off'); } catch (e) { /* vale per questa sessione */ }
        if (window.SaveManager && SaveManager.setSetting) SaveManager.setSetting('menuParallax', !!attiva);
        window.dispatchEvent(new CustomEvent('ygo:parallasse-menu', { detail: { attiva: !!attiva } }));
    }

    // "Giroscopio sulle carte": se il giroscopio muove la luce della carta in
    // dettaglio (acceso, di default) o se la luce si muove piano da sola
    // (spento). Stessa chiave del salvataggio (cardGyro, js/save-manager.js).
    const CHIAVE_GIROSCOPIO_CARTE = 'ygoGiroscopioCarte';

    function giroscopioCarteAttivo() {
        try { return localStorage.getItem(CHIAVE_GIROSCOPIO_CARTE) !== 'off'; } catch (e) { return true; }
    }
    function impostaGiroscopioCarte(attivo) {
        try { localStorage.setItem(CHIAVE_GIROSCOPIO_CARTE, attivo ? 'on' : 'off'); } catch (e) { /* vale per questa sessione */ }
        if (window.SaveManager && SaveManager.setSetting) SaveManager.setSetting('cardGyro', !!attivo);
    }

    window.Inclinazione = {
        giroscopioCarteAttivo: giroscopioCarteAttivo,
        impostaGiroscopioCarte: impostaGiroscopioCarte,
        parallasseMenuAttiva: parallasseMenuAttiva,
        impostaParallasseMenu: impostaParallasseMenu,
        ascolta: ascolta,
        /** Vero dopo la prima lettura del giroscopio: su un computer resta falso. */
        haSensore: () => haSensore,
        movimentoRidotto: movimentoRidotto
    };
})();
