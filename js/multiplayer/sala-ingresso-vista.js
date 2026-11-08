/**
 * sala-ingresso-vista.js — la schermata d'ingresso (apri una stanza / entra con un codice) di sala-ingresso.js, montata sulla pagina vera.
 * ---------------------------------------------------------------------------------------------------------------------------------------
 * Come gli adattatori della sala (sala-tavolo-1v1.js, sala-tavolo-tag.js): non tocca rete ne' regole. La schermata nuova sta sopra i
 * controlli di sempre (che restano nel documento, nascosti ma vivi) e li pilota: "Apri la stanza" preme `#mpCreateBtn`, "Entra" scrive il
 * codice in `#mpJoinCode` e preme `#mpJoinBtn`, l'indirizzo del server finisce in `#mpServerUrl`. Il collegamento (la console KaibaCorp
 * in finestra, gli errori in `#mpStatus`) e' quello di mp-lobby.js, invariato.
 *
 * Restano visibili, spostati sotto l'intestazione, i due pezzi che appartengono all'ingresso: la scelta del formato del Tag
 * (`#mpTagFormato`) e il riquadro dei premi della modalita' (`#mpPremiModo`).
 */
(function () {
    'use strict';

    if (!window.SalaIngresso || !window.SalaTavolo || !window.SalaTavolo.acceso()) return;
    const schermata = document.querySelector('[data-vista="ingresso"] .mp-screen');
    if (!schermata) return;

    const $ = (id) => document.getElementById(id);
    const modo = (window.MP_MODO && typeof window.mpModo === 'function') ? window.mpModo(window.MP_MODO) : null;

    const radice = document.createElement('div');
    radice.className = 'mp-tavolo-radice mp-ingresso-radice';
    schermata.appendChild(radice);
    schermata.classList.add('mp-tavolo-attivo');
    const vista = window.SalaIngresso.monta(radice);

    function aggiorna() {
        const url = $('mpServerUrl');
        vista.imposta({
            modo: {
                titolo: modo ? modo.titolo : 'Duello Multiplayer',
                descrizione: modo ? modo.descrizione : 'Sfida un amico online, in tempo reale.',
                icona: modo ? modo.icona : 'multiplayer'
            },
            server: { stato: null, url: url ? url.value : '' },
            fase: 'riposo'
        });
    }
    aggiorna();

    // Il formato del Tag e i premi della modalita' vivono nell'ingresso: sotto l'intestazione, prima delle due porte.
    const hero = radice.querySelector('.si-hero');
    const formato = $('mpTagFormato');
    const premi = $('mpPremiModo');
    if (hero) {
        if (premi) hero.insertAdjacentElement('afterend', premi);
        if (formato) hero.insertAdjacentElement('afterend', formato);
    }

    vista.su('crea', () => { const b = $('mpCreateBtn'); if (b) b.click(); });
    vista.su('entra', (codice) => {
        const campo = /** @type {HTMLInputElement | null} */ ($('mpJoinCode'));
        const b = $('mpJoinBtn');
        if (!campo || !b) return;
        campo.value = String(codice).toUpperCase();
        b.click();
    });
    vista.su('server', (indirizzo) => { const url = /** @type {HTMLInputElement | null} */ ($('mpServerUrl')); if (url) url.value = indirizzo; });
})();
