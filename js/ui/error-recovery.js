// @ts-check
/**
 * error-recovery.js — ultima rete di sicurezza VISIBILE per un errore
 * JS non gestito da nient'altro: senza questo, l'unico segnale che
 * qualcosa è andato storto era una riga in console (invisibile
 * all'utente) — la pagina restava silenziosamente "morta" (bottoni che
 * non rispondono più, un caricamento che non finisce mai) senza alcuna
 * indicazione visibile.
 *
 * Caricato per PRIMO su ogni pagina (subito dopo js/pwa-register.js, in
 * cima al documento — vedi l'ordine dei tag <script>), così cattura
 * anche un errore che avviene DURANTE l'inizializzazione di uno degli
 * script pesanti caricati dopo. Vale sia sul web sia nell'APK: non è
 * una feature nativa, un errore JS non gestito è ugualmente invisibile
 * in entrambi i casi.
 *
 * Coesiste con la rete di sicurezza dedicata al duello in
 * js/engine/duel-engine.js (che scrive un messaggio più specifico nel
 * Game Log, quando esiste): più listener sullo stesso evento sono
 * normali e non si escludono a vicenda — questo file aggiunge un
 * banner visibile anche sulle pagine SENZA un Game Log (Cartoteca,
 * Negozio, Creazione Deck, ecc.), dove altrimenti l'errore del motore
 * duello non avrebbe alcun canale.
 *
 * Mostrato UNA SOLA volta per pagina (anche se altri errori seguono, il
 * loro testo si accoda comunque nel riquadro dettagli — vedi sotto):
 * un banner piccolo e non bloccante in fondo allo schermo, non un
 * modale a pieno schermo invasivo — la maggior parte degli errori
 * intercettati qui non impedisce di continuare a usare la pagina.
 * Offre solo due azioni concrete: ricaricare, o tornare al menu.
 *
 * Il banner include anche il TESTO TECNICO reale dell'errore (nome +
 * messaggio + prime righe di stack), non solo la frase generica — prima
 * finiva solo in console.error, invisibile su un telefono/APK reale
 * senza un collegamento devtools: uno screenshot del banner da solo non
 * bastava mai a capire la causa. Ora lo stesso screenshot porta già il
 * dettaglio utile.
 */
(function () {
    'use strict';

    let shown = false;
    // Testo tecnico di ogni errore distinto intercettato, mostrato DIRETTAMENTE
    // nel banner (non solo in console): su un telefono/APK reale non c'è modo
    // comodo di aprire la console per leggere il vero messaggio, quindi senza
    // questo l'unica descrizione disponibile restava quella generica qui sotto
    // — non abbastanza per capire la causa da uno screenshot. Un Set (non un
    // array) per non ripetere lo stesso identico errore se si ripete più volte
    // prima che l'utente ricarichi/ignori.
    const messages = [];

    /** Rappresentazione testuale leggibile di un Error/valore qualunque (unhandledrejection può rifiutare con QUALSIASI valore, non solo un vero Error). */
    function formatErrorDetail(err) {
        if (!err) return 'Errore sconosciuto (nessun dettaglio disponibile)';
        if (err instanceof Error) {
            // err.stack include GIÀ "NomeErrore: messaggio" come prima riga
            // (formato standard V8) — saltarla per non ripetere due volte
            // la stessa informazione, prendendo solo le righe di chiamata
            // (quelle "at ...") che seguono.
            const callFrames = (err.stack || '').split('\n').slice(1, 5).join('\n');
            return `${err.name}: ${err.message}` + (callFrames ? `\n${callFrames}` : '');
        }
        try { return String(err); } catch (e) { return 'Errore non convertibile in testo'; }
    }

    function addMessage(text) {
        if (!text || messages.includes(text)) return;
        messages.push(text);
        const pre = document.getElementById('globalErrorBannerDetails');
        if (pre) pre.textContent = messages.join('\n\n———\n\n');
    }

    function renderBanner() {
        if (shown) return;
        shown = true;

        const style = document.createElement('style');
        style.textContent = `
            #globalErrorBanner {
                position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%);
                z-index: 999999; max-width: min(92vw, 480px); width: max-content;
                background: linear-gradient(135deg, rgba(40,10,10,0.97), rgba(60,15,15,0.97));
                border: 1px solid rgba(255,110,110,0.5);
                box-shadow: 0 6px 24px rgba(0,0,0,0.5);
                border-radius: 10px; padding: 12px 14px; color: #ffe0e0;
                font: 500 0.82rem/1.4 system-ui, -apple-system, sans-serif;
                display: flex; flex-direction: column; gap: 8px;
            }
            #globalErrorBannerDetails {
                margin: 0; max-height: 30vh; overflow: auto; white-space: pre-wrap;
                word-break: break-word; font: 400 0.68rem/1.35 ui-monospace, "SF Mono", Consolas, monospace;
                background: rgba(0,0,0,0.35); border-radius: 6px; padding: 6px 8px; color: #ffc9c9;
            }
            #globalErrorBanner .global-error-banner-actions { display: flex; gap: 8px; justify-content: flex-end; }
            #globalErrorBanner button {
                font: inherit; cursor: pointer; border-radius: 6px; padding: 5px 10px;
                border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.08); color: inherit;
            }
            #globalErrorBanner button:hover { background: rgba(255,255,255,0.18); }
        `;

        const banner = document.createElement('div');
        banner.id = 'globalErrorBanner';
        banner.innerHTML = `
            <span>⚠️ Si è verificato un errore imprevisto. La pagina potrebbe non rispondere più correttamente.</span>
            <pre id="globalErrorBannerDetails">${messages.join('\n\n———\n\n')}</pre>
            <div class="global-error-banner-actions">
                <button type="button" id="globalErrorReloadBtn">Ricarica</button>
                <button type="button" id="globalErrorMenuBtn">Torna al menu</button>
                <button type="button" id="globalErrorDismissBtn">Ignora</button>
            </div>
        `;

        document.head.appendChild(style);
        document.body.appendChild(banner);

        document.getElementById('globalErrorReloadBtn').onclick = () => window.location.reload();
        document.getElementById('globalErrorMenuBtn').onclick = () => { window.location.href = 'index.html'; };
        document.getElementById('globalErrorDismissBtn').onclick = () => banner.remove();
    }

    function showBanner(detailText) {
        addMessage(detailText);
        // Se questo script (deliberatamente il PRIMO caricato, vedi sopra)
        // intercetta un errore prima ancora che <body> esista, si aspetta
        // che il DOM sia pronto invece di fallire nel costruire il banner.
        if (document.body) {
            renderBanner();
        } else {
            document.addEventListener('DOMContentLoaded', renderBanner, { once: true });
        }
    }

    /**
     * Interruzioni NORMALI della View Transitions API
     * (@view-transition { navigation: auto; } in ogni pagina, per una
     * navigazione più fluida): il browser avvolge da sé OGNI navigazione
     * in una transizione, e quando la interrompe rifiuta una Promise
     * interna che nessuno può intercettare — arriva qui come "errore non
     * gestito" pur non essendo un bug della pagina. In tutti questi casi
     * la navigazione avviene comunque: si perde solo l'animazione.
     *
     * Due casi distinti, entrambi riprodotti dal vivo:
     * 1) "AbortError: Transition was skipped" — una SECONDA navigazione
     *    parte prima che la precedente finisca (es. toccare in rapida
     *    successione più voci di menu).
     * 2) "InvalidStateError: ... Viewport size changed" — il viewport
     *    cambia DURANTE la transizione. Su mobile è quasi la norma: la
     *    barra degli indirizzi che si ritrae mentre si cambia pagina
     *    basta a farlo scattare, ed è il motivo per cui l'utente vedeva
     *    il banner rosso "ad ogni cambio pagina" sul telefono.
     *
     * Volutamente NON si filtra ogni InvalidStateError di transizione: in
     * particolare "ViewTransition opt-in disabled" deve restare visibile,
     * perché quello NON è ambientale ma un errore di configurazione vero
     * (l'opt-in caricato troppo tardi) — già capitato una volta in questo
     * progetto, e se si ripresentasse va visto subito invece di sparire
     * insieme al rumore.
     */
    function isBenignViewTransitionAbort(reason) {
        if (!reason || typeof DOMException === 'undefined' || !(reason instanceof DOMException)) return false;
        const message = reason.message || '';
        if (reason.name === 'AbortError' && /transition was skipped/i.test(message)) return true;
        if (reason.name === 'InvalidStateError' && /viewport size changed/i.test(message)) return true;
        // 3) "Page already revealed": la pagina e' stata mostrata (o ricaricata) prima che la transizione fosse
        //    pronta — succede quando il caricamento e' lento o la pagina viene riaperta dalla cache. Ambientale.
        if (reason.name === 'InvalidStateError' && /page already revealed/i.test(message)) return true;
        return false;
    }

    window.addEventListener('error', (event) => {
        // Stesso filtro dei rifiuti di Promise qui sotto: la stessa
        // interruzione di transizione può arrivare anche da questa parte
        // a seconda di come il browser la propaga.
        if (isBenignViewTransitionAbort(event.error)) {
            console.warn('[error-recovery] Transizione di pagina interrotta dal browser (normale, ignorato):', event.error);
            return;
        }
        const detail = formatErrorDetail(event.error || event.message);
        console.error('[error-recovery] Errore non gestito:', event.error || event.message);
        showBanner(detail);
    });
    window.addEventListener('unhandledrejection', (event) => {
        if (isBenignViewTransitionAbort(event.reason)) {
            console.warn('[error-recovery] Transizione di pagina interrotta dal browser (normale, ignorato):', event.reason);
            return;
        }
        const detail = formatErrorDetail(event.reason);
        console.error('[error-recovery] Promise non gestita:', event.reason);
        showBanner(detail);
    });
})();
