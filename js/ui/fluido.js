/**
 * fluido.js — l'ingresso "morbido" degli elementi che una pagina costruisce a pezzi (griglie di carte, Duellanti...).
 * ----------------------------------------------------------------------------------------------------------
 * Il difetto che toglie: gli elementi comparivano di colpo, uno dopo l'altro (o tutti insieme), e la pagina sembrava
 * "caricare a scatti". Qui ognuno entra con una dissolvenza e un piccolo scorrimento verso l'alto, a cascata veloce
 * (24ms fra uno e l'altro, al massimo 14 passi: una pagina intera non deve mai aspettare piu' di ~0,35s per finire).
 *
 * Solo `opacity` e la proprieta' individuale `translate` (compositor, mai layout): non tocca `transform`, quindi
 * convive con l'inclinazione delle carte vive e con ogni altra animazione dell'elemento. Con "riduci movimento" non
 * fa niente. Finita l'animazione l'elemento torna com'era (nessuna classe lasciata addosso).
 *
 * Uso:   Fluido.rivela(elemento, posizione)   // posizione: 0,1,2... dentro il gruppo che compare insieme
 */
(function () {
    'use strict';
    const MAX_PASSO = 14;
    const ridotto = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

    function rivela(el, posizione) {
        if (ridotto || !el || !el.classList) return el;
        el.style.setProperty('--fl-i', String(Math.max(0, Math.min(MAX_PASSO, posizione | 0))));
        el.classList.add('fl-entra');
        const fine = () => { el.classList.remove('fl-entra'); el.style.removeProperty('--fl-i'); };
        el.addEventListener('animationend', fine, { once: true });
        setTimeout(fine, 900);   // rete di sicurezza: se l'evento non arriva (elemento nascosto) non resta nulla addosso
        return el;
    }

    window.Fluido = { rivela: rivela };
})();
