/**
 * sala-uscita.js — "Vuoi davvero uscire dalla stanza?"
 * ------------------------------------------------------------------------------------------
 * Con la stanza aperta basta un tocco sbagliato per perderla: "Online" nella barra in basso, la freccia Indietro del telefono, il
 * gesto Indietro del browser. Uscire dalla stanza lascia gli altri senza di te (e se sei l'host, senza la stanza): quindi, finche' si e'
 * in una sala d'attesa (1 contro 1 o Tag) ogni uscita passa da una domanda. Resta = non cambia niente; Esci = lasci la stanza e vai al menu.
 *
 * Tre strade, una domanda sola:
 *   1) i tocchi su "Online" (barra in basso) e su Indietro della pagina: intercettati in CAPTURE sul documento, prima del loro gestore;
 *   2) il gesto/tasto Indietro del browser: una voce di cronologia "di guardia" (come fa il duello con Abbandona), che si rimette al suo
 *      posto se resti;
 *   3) il tasto Indietro dell'app Android (NativeBackButton), che altrimenti uscirebbe dall'app.
 * Non vale a duello avviato (li' c'e' Abbandona, con la sua conferma) ne' nell'ingresso (non c'e' nessuna stanza da perdere).
 */
(function () {
    'use strict';

    const net = window.DuelNetwork;
    const lobby = document.getElementById('mpLobby');
    if (!net || !lobby) return;

    let permesso = false;       // vero mentre si sta uscendo davvero: nessuna domanda
    let guardiaInserita = false;
    let finestra = null;

    function inSala() {
        const s = lobby.dataset.schermata;
        return (s === 'attesa' || s === 'tag') && !document.body.classList.contains('mp-in-duello');
    }

    function costruisci() {
        if (finestra) return finestra;
        finestra = document.createElement('div');
        finestra.className = 'st-uscita';
        finestra.hidden = true;
        finestra.setAttribute('role', 'alertdialog');
        finestra.setAttribute('aria-modal', 'true');
        finestra.setAttribute('aria-labelledby', 'stUscitaTitolo');
        finestra.innerHTML = '<div class="st-uscita-card">'
            + '<h3 id="stUscitaTitolo">Uscire dalla stanza?</h3>'
            + '<p>Lasciando la stanza gli altri giocatori restano senza di te. Se sei l\'host, la stanza passa a un altro giocatore.</p>'
            + '<div class="st-uscita-azioni">'
            + '<button type="button" class="st-uscita-resta">Resta</button>'
            + '<button type="button" class="st-uscita-esci">Esci</button>'
            + '</div></div>';
        document.body.appendChild(finestra);
        finestra.addEventListener('click', (ev) => { if (ev.target === finestra) chiudi(); });
        finestra.querySelector('.st-uscita-resta').onclick = chiudi;
        document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !finestra.hidden) chiudi(); });
        return finestra;
    }

    /** @type {(() => void) | null} */
    let alleConferma = null;

    function chiedi(seConferma) {
        costruisci();
        alleConferma = seConferma;
        finestra.hidden = false;
        const esci = /** @type {HTMLElement} */ (finestra.querySelector('.st-uscita-esci'));
        esci.onclick = () => {
            const fn = alleConferma;
            chiudi();
            permesso = true;
            try { net.leaveRoom(); } catch (e) { /* la pagina sta per cambiare comunque */ }
            if (fn) fn();
        };
        // Il fuoco va su "Resta": un invio distratto non deve far uscire.
        setTimeout(() => { const r = finestra.querySelector('.st-uscita-resta'); if (r && !finestra.hidden) /** @type {HTMLElement} */ (r).focus({ preventScroll: true }); }, 30);
    }

    function chiudi() {
        if (finestra) finestra.hidden = true;
        alleConferma = null;
    }

    // 1) "Online" nella barra in basso e Indietro della pagina. Si ferma il tocco PRIMA che arrivi al loro gestore; se confermi, lo si rifa.
    document.addEventListener('click', (ev) => {
        if (permesso || !inSala()) return;
        const t = ev.target instanceof Element ? ev.target.closest('.mm-ctx-padre, .topbar .back-btn') : null;
        if (!t) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        chiedi(() => { /** @type {HTMLElement} */ (t).click(); });
    }, true);

    // 2) Indietro del browser. Una voce di guardia nella cronologia: premendo Indietro si torna a quella di prima, e se resti la si rimette.
    function inserisciGuardia() {
        if (guardiaInserita) return;
        guardiaInserita = true;
        try { history.pushState({ salaMp: 1 }, '', location.href); } catch (e) { guardiaInserita = false; }
    }
    window.addEventListener('popstate', () => {
        if (permesso || !inSala()) return;
        // Si rimette subito la guardia: la pagina non si e' mossa, e la domanda decide.
        try { history.pushState({ salaMp: 1 }, '', location.href); } catch (e) { /* ignora */ }
        chiedi(() => { try { sessionStorage.setItem('ygoMenuTab', 'online'); } catch (e) { /* noop */ } location.href = 'index.html'; });
    });
    new MutationObserver(() => { if (inSala()) inserisciGuardia(); }).observe(lobby, { attributes: true, attributeFilter: ['data-schermata'] });
    if (inSala()) inserisciGuardia();

    // 3) Indietro dell'app Android.
    if (window.NativeBackButton && window.NativeBackButton.setHandler) {
        window.NativeBackButton.setHandler(() => {
            if (permesso || !inSala()) return false;
            if (finestra && !finestra.hidden) { chiudi(); return true; }
            chiedi(() => { try { sessionStorage.setItem('ygoMenuTab', 'online'); } catch (e) { /* noop */ } location.href = 'index.html'; });
            return true;
        });
    }

    window.MpSalaUscita = { inSala, chiedi };
})();
