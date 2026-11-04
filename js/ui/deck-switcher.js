/**
 * deck-switcher.js — il proprio ritratto e il mazzo corrente, nella barra
 * in alto, con un modale per cambiarlo scorrendo di lato.
 * =====================================================================
 * Gemello di js/ui/deck-switcher.css, sullo stesso modello di deck-box e
 * duel-setup: qui il markup e il comportamento, lì il disegno.
 *
 * PERCHÉ NELLA TOPBAR (richiesta esplicita dell'utente). Il mazzo
 * corrente non è un'impostazione del singolo duello: è una cosa che il
 * giocatore si porta dietro, e prima si poteva vedere solo aprendo la
 * finestra della difficoltà, cioè quando ormai si stava già scegliendo
 * un avversario. Lassù invece è sempre sotto gli occhi, e si cambia in
 * due tocchi.
 *
 * NON DECIDE NULLA DI SUO tranne il mazzo corrente, che scrive davvero in
 * SaveManager.setActiveDeckId — è lo stesso identico campo che imposta
 * Creazione Deck, e il motore ci costruisce sopra il mazzo del giocatore
 * (vedi initGame in js/engine/game-flow.js). Non esiste un "mazzo scelto
 * solo per questa schermata".
 *
 * Uso:
 *   DeckSwitcher.mount(topbarElement, {
 *       onProfile() { ... },        // oppure profileHref
 *       deckEditorHref: 'creazione-deck.html',
 *       onChange(mazzo) { ... }
 *   });
 */
(function () {
    'use strict';

    // Ritratto predefinito del giocatore: lo stesso specchio usato da
    // js/duel-session.js per rappresentare SÉ STESSI, finché non esisterà
    // un vero sistema di avatar.
    const RITRATTO = 'images/characters/mirror.jpg';

    function mazzi() {
        return (window.SaveManager && SaveManager.getDecks && SaveManager.getDecks()) || [];
    }

    function mazzoCorrente() {
        const lista = mazzi();
        if (lista.length === 0) return null;
        const id = SaveManager.getActiveDeckId ? SaveManager.getActiveDeckId() : null;
        return lista.find((m) => m.id === id) || lista[0];
    }

    function contaCarte(mazzo) {
        return ((mazzo && mazzo.main) || []).reduce((tot, v) => tot + (v.qty || 1), 0);
    }

    function coloreDi(mazzo) {
        if (!mazzo) return '#39414f';
        return mazzo.color || (window.DeckBox ? DeckBox.colorForId(mazzo.id) : '#b3241c');
    }

    function mount(contenitore, options) {
        const opts = options || {};
        const barra = typeof contenitore === 'string' ? document.querySelector(contenitore) : contenitore;
        if (!barra) return null;

        const gruppo = document.createElement('div');
        gruppo.className = 'dsw-topbar';
        // `deck: false` (il default) = solo il ritratto. Il mazzo si mostra
        // dove serve davvero — dove si sta per duellare: Duello Libero e
        // Tornei. Altrove sarebbe un'informazione fuori contesto, che
        // occupa spazio nella barra senza rispondere a nessuna domanda.
        const conMazzo = opts.deck === true;
        // Nei Tornei il profilo non serve: `avatar:false` evita anche di
        // caricare mirror.jpg e libera il margine vicino a notch/fotocamera.
        // Le altre pagine mantengono il comportamento storico di default.
        const conAvatar = opts.avatar !== false;
        let ritratto = null;
        if (conAvatar) {
            ritratto = document.createElement('button');
            ritratto.type = 'button';
            ritratto.className = 'dsw-avatar';
            ritratto.title = 'Il tuo profilo';
            ritratto.setAttribute('aria-label', 'Apri il tuo profilo');
            ritratto.textContent = '👤'; // ripiego, sostituito dalla foto se carica
            const foto = new Image();
            foto.alt = '';
            foto.onload = () => { ritratto.textContent = ''; ritratto.appendChild(foto); };
            foto.src = RITRATTO;
            ritratto.onclick = () => {
                if (window.NativeHaptics) NativeHaptics.light();
                if (typeof opts.onProfile === 'function') opts.onProfile();
                else window.location.href = opts.profileHref || 'profilo.html';
            };
        }

        if (!conMazzo) {
            if (ritratto) {
                gruppo.appendChild(ritratto);
                barra.appendChild(gruppo);
            }
            return { refresh: () => {}, element: gruppo };
        }

        // --- Mazzo corrente: apre il modale ------------------------------
        // La scatola stessa È il comando: nessuna pastiglia attorno,
        // nessuna etichetta accanto (richiesta esplicita dell'utente —
        // "il box non deve essere dentro un pulsante, voglio proprio il
        // box disegnato a icona"). È lo stesso disegno 3D di Creazione
        // Deck, in miniatura: il nome stampato sul coperchio a questa
        // taglia sarebbe illeggibile e viene nascosto dal CSS, quindi a
        // identificare il mazzo restano il colore e il suggerimento al
        // passaggio del mouse.
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'dsw-current';
        chip.setAttribute('aria-haspopup', 'dialog');
        chip.onclick = () => apri(opts, aggiorna);
        // Mazzo PRIMA, ritratto in fondo: l'avatar sta all'estremità destra
        // della barra (richiesta esplicita), il mazzo alla sua sinistra.
        gruppo.appendChild(chip);
        if (ritratto) gruppo.appendChild(ritratto);

        barra.appendChild(gruppo);

        function aggiorna() {
            const mazzo = mazzoCorrente();
            chip.title = mazzo ? `Mazzo in uso: ${mazzo.name} — tocca per cambiarlo` : 'Non hai ancora un mazzo';
            chip.setAttribute('aria-label', chip.title);
            chip.innerHTML = window.DeckBox
                ? DeckBox.markup({ name: mazzo ? mazzo.name : '', color: coloreDi(mazzo) })
                : '';
            if (mazzo && typeof opts.onChange === 'function') opts.onChange(mazzo);
        }
        aggiorna();

        return { refresh: aggiorna, element: gruppo };
    }

    /**
     * Il modale. Una scatola alla volta al centro, le vicine appena
     * visibili ai lati: si scorre di lato e si tocca quella che si vuole.
     */
    function apri(opts, onScelto) {
        const lista = mazzi();
        const overlay = document.createElement('div');
        overlay.className = 'dsw-modal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const chiudi = () => {
            overlay.remove();
            document.removeEventListener('keydown', suTasto);
        };
        const suTasto = (ev) => {
            if (ev.key === 'Escape') chiudi();
            if (ev.key === 'ArrowRight') scorri(1);
            if (ev.key === 'ArrowLeft') scorri(-1);
        };
        document.addEventListener('keydown', suTasto);
        overlay.onclick = (ev) => { if (ev.target === overlay) chiudi(); };

        const testa = document.createElement('div');
        testa.className = 'dsw-head';
        const titolo = document.createElement('div');
        titolo.className = 'dsw-title';
        titolo.textContent = 'Il tuo mazzo';
        const suggerimento = document.createElement('div');
        suggerimento.className = 'dsw-hint';
        suggerimento.textContent = lista.length > 1
            ? 'Scorri di lato e tocca il mazzo con cui vuoi duellare'
            : 'Questo è il mazzo con cui duelli';
        testa.append(titolo, suggerimento);
        overlay.appendChild(testa);

        const attivo = SaveManager.getActiveDeckId ? SaveManager.getActiveDeckId() : null;
        const pista = document.createElement('div');
        pista.className = 'dsw-track';
        const puntini = document.createElement('div');
        puntini.className = 'dsw-dots';

        if (lista.length === 0) {
            const vuoto = document.createElement('div');
            vuoto.className = 'dsw-empty';
            vuoto.textContent = 'Non hai ancora creato un mazzo: per ora si duella con un mazzo generato al momento.';
            overlay.appendChild(vuoto);
        } else {
            lista.forEach((mazzo, indice) => {
                const slide = document.createElement('button');
                slide.type = 'button';
                slide.className = 'dsw-slide';
                slide.dataset.deckId = mazzo.id;
                const conteggio = contaCarte(mazzo);
                // Sotto le 40 carte il mazzo non è legale: si può comunque
                // scegliere, ma va detto prima del duello, non scoperto durante.
                const avviso = conteggio < 40 ? ' <span class="dsw-warn">⚠ non legale</span>' : '';
                slide.innerHTML = (window.DeckBox ? DeckBox.markup({
                    name: mazzo.name,
                    color: coloreDi(mazzo)
                }) : '')
                    + `<div class="dsw-slide-name"></div>`
                    + `<div class="dsw-slide-meta">${conteggio} carte${avviso}</div>`
                    + (mazzo.id === attivo ? '<div class="dsw-inuso">In uso</div>' : '');
                // Il nome è testo dell'utente: mai dentro innerHTML.
                slide.querySelector('.dsw-slide-name').textContent = mazzo.name;
                slide.onclick = () => {
                    if (SaveManager.setActiveDeckId && SaveManager.setActiveDeckId(mazzo.id)) {
                        if (window.NativeHaptics) NativeHaptics.light();
                        if (typeof onScelto === 'function') onScelto();
                    }
                    chiudi();
                };
                pista.appendChild(slide);

                const punto = document.createElement('span');
                punto.className = 'dsw-dot';
                puntini.appendChild(punto);
            });
            overlay.appendChild(pista);

            const frecce = document.createElement('div');
            frecce.className = 'dsw-arrows';
            const giu = document.createElement('button');
            giu.type = 'button';
            giu.className = 'dsw-arrow';
            giu.textContent = '‹';
            giu.setAttribute('aria-label', 'Mazzo precedente');
            giu.onclick = () => scorri(-1);
            const su = document.createElement('button');
            su.type = 'button';
            su.className = 'dsw-arrow';
            su.textContent = '›';
            su.setAttribute('aria-label', 'Mazzo successivo');
            su.onclick = () => scorri(1);
            frecce.append(giu, puntini, su);
            overlay.appendChild(frecce);
        }

        const azioni = document.createElement('div');
        azioni.className = 'dsw-actions';
        const editor = document.createElement('a');
        editor.className = 'dsw-btn dsw-btn--primary';
        editor.href = opts.deckEditorHref || 'creazione-deck.html';
        editor.textContent = '✏️ Creazione Deck';
        const fine = document.createElement('button');
        fine.type = 'button';
        fine.className = 'dsw-btn';
        fine.textContent = 'Chiudi';
        fine.onclick = chiudi;
        azioni.append(editor, fine);
        overlay.appendChild(azioni);

        document.body.appendChild(overlay);

        // --- Quale scatola è al centro ----------------------------------
        // Si ricava dalla posizione di scorrimento invece che da un indice
        // tenuto a mano: così resta giusta anche quando a scorrere è il
        // dito, con l'inerzia del sistema, e non un nostro pulsante.
        const slides = Array.from(pista.querySelectorAll('.dsw-slide'));
        function segnaCentrale() {
            if (slides.length === 0) return;
            const centro = pista.scrollLeft + pista.clientWidth / 2;
            let vicino = 0;
            let minimo = Infinity;
            slides.forEach((s, i) => {
                const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - centro);
                if (d < minimo) { minimo = d; vicino = i; }
            });
            slides.forEach((s, i) => s.classList.toggle('is-centrato', i === vicino));
            Array.from(puntini.children).forEach((p, i) => p.classList.toggle('is-centrato', i === vicino));
            return vicino;
        }
        function scorri(direzione) {
            const attuale = segnaCentrale() || 0;
            const prossimo = Math.min(slides.length - 1, Math.max(0, attuale + direzione));
            const s = slides[prossimo];
            if (s) pista.scrollTo({ left: s.offsetLeft - (pista.clientWidth - s.offsetWidth) / 2, behavior: 'smooth' });
        }
        pista.addEventListener('scroll', segnaCentrale, { passive: true });

        // Si parte dal mazzo in uso, non dal primo.
        const partenza = slides.findIndex((s) => s.dataset.deckId === String(attivo));
        if (partenza > 0) {
            const s = slides[partenza];
            pista.scrollLeft = s.offsetLeft - (pista.clientWidth - s.offsetWidth) / 2;
        }
        segnaCentrale();
    }

    window.DeckSwitcher = { mount: mount, open: apri };
})();
