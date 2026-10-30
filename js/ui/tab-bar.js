// @ts-check
/**
 * tab-bar.js — la barra in basso delle PAGINE FIGLIE del menu "app", SOLO su telefono.
 * ------------------------------------------------------------------------------------------------
 * Il menu principale (js/ui/menu-mobile.js) ha quattro tab (Duelli, Carte, Online, Altro). Dentro una pagina figlia (Duello Libero, Storia,
 * Negozio, Cartoteca...) la barra cambia faccia e diventa CONTESTUALE (richiesta dell'utente): spariscono le altre voci e restano
 *     [ voce madre ]  >  [ voce figlia, selezionata ]  ........  [ opzioni della pagina ]
 * - la voce madre (es. Duelli) riporta al menu su quella tab;
 * - la voce figlia e' la pagina in cui si e' (il suo titolo, che non sta piu' in una barra in alto: quella su telefono non c'e' piu');
 * - a destra stanno le opzioni/informazioni della pagina: sono gli elementi che la pagina appendeva alla barra in alto (il selettore del mazzo e
 *   il ritratto di deck-switcher.js, il badge "N carte" della Cartoteca, il contatore del deck editor). Li SPOSTA qui, non li copia: gli script
 *   che li gestiscono li trovano per id/riferimento e continuano a funzionare. Compaiono anche dopo il caricamento, quindi un osservatore li
 *   porta qui appena nascono.
 *
 * Stile: `.mm-barra`, `.mm-ctx-*` di js/ui/menu-mobile.css (la pagina deve caricare anche quel foglio). Una pagina non elencata in `PAGINE`
 * non mostra la barra (duelli, mappe dei tornei, multiplayer: hanno una loro interfaccia a tutto schermo).
 */
(function () {
    'use strict';

    const QUERY = '(pointer: coarse) and (max-width: 1000px)';
    if (!window.matchMedia || !window.matchMedia(QUERY).matches) return;

    /** Le voci madre: id della tab del menu, nome e icona. */
    const MADRI = {
        duelli: { nome: 'Duelli', icona: 'duel' },
        carte: { nome: 'Carte', icona: 'cards' },
        altro: { nome: 'Altro', icona: 'settings' }
    };
    /** Pagina -> [tab madre, nome della voce figlia, icona]. Le icone sono quelle delle voci del menu (index.html). */
    const PAGINE = {
        'storia.html': ['duelli', 'Storia', 'story'],
        'tornei.html': ['duelli', 'Tornei', 'tournament'],
        'settimana.html': ['duelli', 'Settimana', 'star'],
        'caccia-boss.html': ['duelli', 'Caccia al Boss', 'skull'],
        'duello-libero.html': ['duelli', 'Duello Libero', 'freeDuel'],
        'puzzle.html': ['duelli', 'Puzzle', 'puzzle'],
        'tutorial.html': ['duelli', 'Tutorial', 'rules'],
        'sfide.html': ['duelli', 'Sfide', 'tournament'],
        'negozio.html': ['carte', 'Negozio', 'shop'],
        'cartoteca.html': ['carte', 'Cartoteca', 'collection'],
        'creazione-deck.html': ['carte', 'Creazione Deck', 'deckBuilder'],
        'crea-carta.html': ['carte', 'Creazione', 'cardMaker'],
        'profilo.html': ['altro', 'Profilo', 'profile'],
        'impostazioni.html': ['altro', 'Impostazioni', 'settings'],
        'regole.html': ['altro', 'Regole', 'rules']
    };

    // Sul sito pubblicato le pagine non hanno l'estensione (/cartoteca): si confronta sempre il nome con ".html".
    const file = (location.pathname.split('/').pop() || '').replace(/\.html$/, '') + '.html';
    const cfg = PAGINE[file];
    if (!cfg) return;

    /** @param {string} nome @param {string} icona */
    const interno = (nome, icona) => `<span class="mm-tab-icona" data-icon="${icona}"></span><span class="mm-tab-nome">${nome}</span>`;

    function monta() {
        if (document.querySelector('.mm-barra')) return;
        const madre = MADRI[cfg[0]];
        const barra = document.createElement('nav');
        barra.className = 'mm-barra mm-barra--ctx';
        barra.setAttribute('aria-label', 'Dove sei');

        const btnMadre = document.createElement('button');
        btnMadre.type = 'button';
        btnMadre.className = 'mm-ctx-padre';
        btnMadre.setAttribute('aria-label', 'Torna al menu: ' + madre.nome);
        btnMadre.innerHTML = interno(madre.nome, madre.icona);
        btnMadre.addEventListener('click', () => {
            if (window.NativeHaptics) window.NativeHaptics.light();
            try { sessionStorage.setItem('ygoMenuTab', cfg[0]); } catch (e) { /* noop */ }
            location.href = 'index.html';
        });

        const sep = document.createElement('span');
        sep.className = 'mm-ctx-sep';
        sep.textContent = '›';
        sep.setAttribute('aria-hidden', 'true');

        const figlio = document.createElement('div');
        figlio.className = 'mm-ctx-figlio mm-tab--attiva';
        figlio.setAttribute('aria-current', 'page');
        figlio.innerHTML = interno(cfg[1], cfg[2]);

        const slot = document.createElement('div');
        slot.className = 'mm-ctx-slot';

        barra.append(btnMadre, sep, figlio, slot);
        document.body.appendChild(barra);
        document.body.classList.add('ha-tab-bar');
        const spazio = document.createElement('div');
        spazio.className = 'mm-spazio';
        spazio.setAttribute('aria-hidden', 'true');
        document.body.appendChild(spazio);
        if (window.Icons) window.Icons.hydrate(barra);

        // Le opzioni della pagina: tutto cio' che la pagina appende alla barra in alto, tranne Indietro, icona e titolo. Si sposta adesso e
        // ogni volta che ne nasce uno nuovo (il selettore del mazzo si monta a pagina avviata) per i primi 20 secondi.
        const sposta = () => {
            const t = document.querySelector('.topbar');
            if (!t) return;
            Array.from(t.children).forEach((e) => {
                if (e.matches('.back-btn, .topbar-icon, .topbar-heading')) return;
                slot.appendChild(e);
            });
        };
        sposta();
        const oss = new MutationObserver(sposta);
        oss.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => oss.disconnect(), 20000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monta);
    else monta();
})();
