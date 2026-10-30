// @ts-check
/**
 * tab-bar.js — la barra di tab del menu "app" (Duelli, Carte, Online, Sfide, Altro) anche sulle pagine principali, SOLO su telefono.
 * ------------------------------------------------------------------------------------------------
 * Sul telefono il menu e' una UI a tab (js/ui/menu-mobile.js). Entrando in Cartoteca, Negozio, Sfide, Profilo o Impostazioni la barra
 * restava indietro, e per cambiare sezione bisognava tornare al menu: qui la stessa barra e' sempre a portata di pollice, con la
 * tab della sezione corrente accesa. Stile: le classi `.mm-barra`/`.mm-tab` di js/ui/menu-mobile.css (la pagina deve caricare anche
 * quel foglio).
 *
 * Una tab diversa dalla propria apre il menu su quella tab (la scelta viaggia in sessionStorage, `ygoMenuTab`, la stessa chiave
 * che usa il menu); "Sfide" apre direttamente la sua pagina. La lista delle tab e' scritta qui (e non letta dal menu, che
 * vive in index.html) perche' la barra deve funzionare su pagine che non lo caricano: se si aggiunge una tab al menu va aggiunta
 * anche qui. Una pagina non elencata in `PAGINE` non mostra la barra (editor di mazzi e carte, duelli, mappe: hanno una loro
 * interfaccia a tutto schermo).
 */
(function () {
    'use strict';

    const QUERY = '(pointer: coarse) and (max-width: 1000px)';
    if (!window.matchMedia || !window.matchMedia(QUERY).matches) return;

    /** Quale tab si accende su quale pagina. */
    const PAGINE = {
        'cartoteca.html': 'carte', 'negozio.html': 'carte',
        'sfide.html': 'sfide',
        'profilo.html': 'altro', 'impostazioni.html': 'altro'
    };
    const TAB = [
        { id: 'duelli', nome: 'Duelli', icona: 'duel' },
        { id: 'carte', nome: 'Carte', icona: 'cards' },
        { id: 'online', nome: 'Online', icona: 'multiplayer' },
        { id: 'sfide', nome: 'Sfide', icona: 'tournament', pagina: 'sfide.html' },
        { id: 'altro', nome: 'Altro', icona: 'settings' }
    ];

    const file = (location.pathname.split('/').pop() || '').replace(/\.html$/, '') + '.html';
    const attiva = PAGINE[file] || PAGINE[(location.pathname.split('/').pop() || '') + '.html'];
    if (!attiva) return;

    function monta() {
        if (document.querySelector('.mm-barra')) return;
        const barra = document.createElement('nav');
        barra.className = 'mm-barra';
        barra.setAttribute('aria-label', 'Sezioni del gioco');
        TAB.forEach((t) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mm-tab' + (t.id === attiva ? ' mm-tab--attiva' : '');
            b.innerHTML = `<span class="mm-tab-icona" data-icon="${t.icona}"></span><span class="mm-tab-nome">${t.nome}</span>`;
            b.addEventListener('click', () => {
                if (t.id === attiva) return;
                if (window.NativeHaptics) window.NativeHaptics.light();
                if (t.pagina) { location.href = t.pagina; return; }
                try { sessionStorage.setItem('ygoMenuTab', t.id); } catch (e) { /* noop */ }
                location.href = 'index.html';
            });
            barra.appendChild(b);
        });
        document.body.appendChild(barra);
        document.body.classList.add('ha-tab-bar');
        const spazio = document.createElement('div');
        spazio.className = 'mm-spazio';
        spazio.setAttribute('aria-hidden', 'true');
        document.body.appendChild(spazio);
        if (window.Icons) window.Icons.hydrate(barra);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monta);
    else monta();
})();
