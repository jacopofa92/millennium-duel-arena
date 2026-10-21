// @ts-check
/**
 * topbar.js — Genera il markup della topbar condivisa (vedi
 * js/ui/topbar.css per lo stile) invece di farlo scrivere a mano, quasi
 * identico, su ogni pagina "menu" del gioco. Nato da un audit che ha
 * trovato lo stesso blocco duplicato in ~9 pagine con piccole derive già
 * in corso (z-index diverso tra cartoteca/creazione-deck, breakpoint
 * mobile mancanti del tutto in duello-sandbox.html) — lo stesso rischio
 * di drift già documentato in CLAUDE.md per i tag <script>, qui per il
 * markup invece che per il codice.
 *
 * Uso, in ogni pagina che vuole la topbar standard (al posto del <div
 * class="topbar">...</div> scritto a mano):
 *
 *   <div id="topbarMount"></div>
 *   <script src="js/ui/topbar.js"></script>
 *   <script>
 *       PageTopbar.render('#topbarMount', { icon: 'shop', title: 'Negozio' });
 *   </script>
 *
 * L'icona è inserita come normale <span data-icon="…"> (stessa
 * convenzione di icon-library.js) e idratata subito, limitatamente al
 * suo medaglione, se icon-library.js è già caricato: così non conta più
 * se la pagina chiama Icons.hydrate() prima o dopo questa funzione.
 */
(function () {
    'use strict';

    /**
     * @param {string} mountSelector - selettore CSS di un elemento vuoto
     *   già presente in pagina, che questa funzione sostituisce con la
     *   topbar vera.
     * @param {object} opts
     * @param {string} opts.icon - nome icona per icon-library.js (es. 'shop').
     * @param {string} opts.title - testo del titolo.
     * @param {string} [opts.subtitle] - sottotitolo opzionale sotto il titolo
     *   (es. "Scegli un duellante da sfidare" in duello-libero.html).
     * @param {string} [opts.backHref='index.html'] - destinazione FISSA
     *   del pulsante Indietro: il genitore logico di questa pagina
     *   nell'ALBERO dell'applicazione (quasi sempre il menu principale),
     *   non "qualunque pagina da cui si è arrivati". Deliberatamente MAI
     *   basato su document.referrer (rimosso da questo file dopo un bug
     *   reale segnalato dall'utente: "l'attuale pulsante indietro porta
     *   alla pagina precedente [del browser]... voglio che ragioni a
     *   livello di applicazione") — un back-button che segue la cronologia
     *   di navigazione reale porta a destinazioni diverse a seconda di
     *   COME si è arrivati alla pagina (es. Negozio raggiunto da
     *   Creazione Deck riporterebbe a Creazione Deck invece che al menu),
     *   invece di riflettere sempre lo stesso posto logico in cui quella
     *   pagina "vive" nella gerarchia del gioco.
     * @param {boolean} [opts.deck=false] - mostra anche il MAZZO corrente
     *   accanto al ritratto, con il selettore a scorrimento. Solo dove si
     *   sta per duellare (Duello Libero, Tornei): altrove il ritratto da
     *   solo basta, e il mazzo sarebbe un'informazione fuori contesto.
     *   Richiede js/ui/deck-switcher.js caricato dalla pagina.
     * @param {string} [opts.profileHref] - destinazione del ritratto se non c'è onProfile
 *   (vedi js/ui/deck-switcher.js).
 * @param {function} [opts.onProfile] - cosa fare al tocco sul ritratto
     *   (di norma si apre profilo.html).
     * @param {function} [opts.onBack] - handler onclick personalizzato per
     *   una destinazione calcolata a runtime invece di un href fisso —
     *   deve tornare `false` per impedire la normale navigazione via
     *   href, come un onclick HTML qualunque.
     * @returns {HTMLElement|undefined} l'elemento .topbar appena creato
     *   (undefined se mountSelector non trova nulla) — utile per
     *   aggiungerci altro contenuto extra, vedi il commento più sotto.
     */
    function render(mountSelector, opts) {
        const mount = typeof mountSelector === 'string' ? document.querySelector(mountSelector) : mountSelector;
        if (!mount) return undefined;
        const backHref = (opts && opts.backHref) || 'index.html';

        const topbar = document.createElement('div');
        topbar.className = 'topbar';

        const backBtn = document.createElement('a');
        backBtn.className = 'back-btn';
        backBtn.title = 'Indietro';
        backBtn.setAttribute('aria-label', 'Indietro');
        backBtn.href = backHref;
        // Freccia disegnata e non il carattere "‹": il glifo cambiava
        // spessore e posizione da un font all'altro (e da Windows ad
        // Android), e non si centrava mai davvero nel medaglione.
        backBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"'
            + ' stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
        // Piccolo tocco "app vera" (richiesto esplicitamente: "fai tutto
        // molto più app telefono") — no-op silenzioso su web/senza
        // Capacitor, vedi js/native/haptics.js. Aggiunto PRIMA di
        // opts.onBack (se presente): entrambi girano allo stesso click,
        // l'ordine non cambia il comportamento di navigazione/onBack.
        backBtn.addEventListener('click', () => { if (window.NativeHaptics) NativeHaptics.light(); });
        if (opts && typeof opts.onBack === 'function') {
            backBtn.onclick = /** @type {any} */ (opts.onBack);
        }
        // Nessun else: senza onBack, il click naviga semplicemente verso
        // backHref via il normale href dell'ancora — nessun handler JS
        // necessario per il caso comune.
        topbar.appendChild(backBtn);

        // L'icona sta in un medaglione SUO, fuori da .topbar-title. Prima
        // era dentro il titolo, e il titolo è testo in gradiente
        // (background-clip: text + color: transparent): le icone SVG di
        // icon-library.js si colorano con currentColor, quindi ereditavano
        // il "transparent" e sparivano — restava solo uno spazio vuoto
        // davanti al nome della pagina, su ogni pagina.
        if (opts && opts.icon) {
            const iconWrap = document.createElement('span');
            iconWrap.className = 'topbar-icon';
            iconWrap.setAttribute('aria-hidden', 'true');
            const iconSpan = document.createElement('span');
            iconSpan.dataset.icon = opts.icon;
            iconWrap.appendChild(iconSpan);
            topbar.appendChild(iconWrap);
            // Idratato qui, SOLO questo elemento: le viste fuse di
            // index.html disegnano la topbar dopo l'Icons.hydrate() della
            // pagina, e senza questa riga resterebbero con lo span vuoto.
            // Rifarlo è innocuo (hydrate svuota e riempie).
            if (window.Icons && typeof Icons.hydrate === 'function') Icons.hydrate(iconWrap);
        }

        // Titolo e sottotitolo impilati in un blocco solo: il sottotitolo
        // sta SOTTO il nome della pagina invece che in fila accanto, dove
        // si perdeva a metà barra. Le classi .topbar-title/.topbar-subtitle
        // restano quelle di sempre (cartoteca.html ricolora il titolo con
        // "#cartotecaTopbar .topbar-title").
        const heading = document.createElement('div');
        heading.className = 'topbar-heading';
        const titleWrap = document.createElement('div');
        titleWrap.className = 'topbar-title';
        titleWrap.textContent = (opts && opts.title) || '';
        heading.appendChild(titleWrap);
        if (opts && opts.subtitle) {
            const subtitleEl = document.createElement('span');
            subtitleEl.className = 'topbar-subtitle';
            subtitleEl.textContent = opts.subtitle;
            heading.appendChild(subtitleEl);
        }
        topbar.appendChild(heading);

        // Ritratto del giocatore in fondo alla barra (e, dove serve, il
        // mazzo corrente accanto): montato QUI e non da ogni pagina,
        // altrimenti sarebbe la stessa chiamata copiata a mano in una
        // dozzina di file — esattamente il drift che questo componente
        // esiste per evitare. Una pagina che non carica
        // js/ui/deck-switcher.js semplicemente non lo ottiene, senza
        // errori: la topbar resta quella di prima.
        if (window.DeckSwitcher) {
            DeckSwitcher.mount(topbar, {
                deck: !!(opts && opts.deck),
                onProfile: opts && opts.onProfile,
                profileHref: opts && opts.profileHref
            });
        }

        mount.replaceWith(topbar);
        // Su mobile Indietro e' fisso in basso a sinistra (vedi topbar.css): il
        // contenuto della pagina si lascia un margine in fondo.
        document.body.classList.add('tb-indietro-basso');
        seguiScorrimento();
        // Tornata utile a chi ha bisogno di aggiungere QUALCOSA in più
        // nella topbar oltre a icona/titolo/sottotitolo (es. il badge
        // "0/30 Deck" di creazione-deck.html): topbar.appendChild(...)
        // sull'elemento restituito, invece di reinventare l'intera
        // topbar a mano per un singolo elemento extra.
        return topbar;
    }

    /**
     * Quando la pagina scorre sotto la barra, la barra si "stacca": ombra
     * più profonda (classe .is-scrolled). Cambia SOLO l'ombra, mai
     * l'altezza — regole.html e creazione-deck.html hanno una seconda
     * barra sticky tarata in pixel sull'altezza di questa.
     * Un ascoltatore solo per pagina, anche con più topbar (le viste
     * fuse di index.html ne hanno una ciascuna).
     */
    let scorrimentoAgganciato = false;
    function seguiScorrimento() {
        const aggiorna = () => {
            const staccata = (window.scrollY || document.documentElement.scrollTop || 0) > 4;
            document.querySelectorAll('.topbar').forEach((t) => t.classList.toggle('is-scrolled', staccata));
        };
        aggiorna();
        if (scorrimentoAgganciato) return;
        scorrimentoAgganciato = true;
        window.addEventListener('scroll', aggiorna, { passive: true });
    }

    window.PageTopbar = { render: render };
})();
