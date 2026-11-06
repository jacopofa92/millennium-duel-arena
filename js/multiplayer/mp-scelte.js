/**
 * mp-scelte.js — le scelte PERSONALI della sala (pedina, mazzo, arena e musica) come riquadri riassuntivi + finestra.
 * ---------------------------------------------------------------------------------------------------------------
 * Prima la sala d'attesa mostrava per intero tre selettori (griglia di ritratti, scaffale dei mazzi, arene e una ventina di musiche):
 * un muro lungo schermate prima di arrivare a "Sono pronto". Ora ogni scelta e' UNA riga col valore corrente (ritratto o miniatura,
 * nome, dettaglio) e un tocco apre una finestra dove si cambia.
 *
 * Il selettore vero (MpPedina.monta, DuelSetup.mount) NON viene riscritto: resta quello di sempre, montato nel suo contenitore. Qui il
 * contenitore sta in un deposito nascosto e, all'apertura, viene SPOSTATO nella finestra (a chiusura torna indietro): i suoi
 * gestori e il suo stato restano vivi, nessuna copia da tenere allineata. Dopo lo spostamento i selettori vanno rimisurati
 * (`alApertura`: refresh() di DuelSetup, che ha bisogno di una larghezza vera per capire quali nomi non ci stanno).
 *
 * Uso:
 *   const t = MpScelte.tessera(gruppo, { corpo, titolo, img, valore, dettaglio, alApertura, alChiusura });
 *   t.aggiorna();   // dopo un cambio fatto altrove (messaggio dell'host, ecc.)
 *   MpScelte.chiudi();
 */
(function () {
    'use strict';

    let radice = null;
    let titoloEl = null;
    let corpoEl = null;
    /** @type {{ nodo: HTMLElement, genitore: HTMLElement, segno: Node | null, alChiusura?: () => void } | null} */
    let aperta = null;

    function costruisci() {
        if (radice) return;
        radice = document.createElement('div');
        radice.className = 'mp-modale';
        radice.id = 'mpModale';
        radice.hidden = true;
        radice.setAttribute('role', 'dialog');
        radice.setAttribute('aria-modal', 'true');
        radice.setAttribute('aria-labelledby', 'mpModaleTitolo');
        radice.innerHTML = `
            <div class="mp-modale-finestra">
                <header class="mp-modale-testa">
                    <h3 class="mp-modale-titolo" id="mpModaleTitolo"></h3>
                    <button type="button" class="mp-modale-chiudi" aria-label="Chiudi">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
                    </button>
                </header>
                <div class="mp-modale-corpo" id="mpModaleCorpo"></div>
                <footer class="mp-modale-piede"><button type="button" class="mp-btn mp-modale-fatto">Fatto</button></footer>
            </div>`;
        document.body.appendChild(radice);
        titoloEl = radice.querySelector('.mp-modale-titolo');
        corpoEl = radice.querySelector('.mp-modale-corpo');
        radice.querySelector('.mp-modale-chiudi').onclick = chiudi;
        radice.querySelector('.mp-modale-fatto').onclick = chiudi;
        // Un tocco sullo sfondo (non sulla finestra) chiude, come in Duello Libero.
        radice.addEventListener('click', (ev) => { if (ev.target === radice) chiudi(); });
        document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && aperta) chiudi(); });
    }

    /** Apre la finestra con `nodo` dentro (spostato, non copiato). */
    function apri(titolo, nodo, opzioni) {
        costruisci();
        chiudi();
        const o = opzioni || {};
        aperta = { nodo, genitore: nodo.parentNode, segno: nodo.nextSibling, alChiusura: o.alChiusura };
        titoloEl.textContent = titolo;
        corpoEl.appendChild(nodo);
        radice.hidden = false;
        document.documentElement.classList.add('mp-modale-aperta');
        if (o.alApertura) o.alApertura();
        const fatto = radice.querySelector('.mp-modale-fatto');
        setTimeout(() => { if (fatto && !radice.hidden) fatto.focus({ preventScroll: true }); }, 30);
    }

    /** Chiude la finestra e rimette il selettore nel suo deposito. */
    function chiudi() {
        if (!aperta || !radice) return;
        const a = aperta;
        aperta = null;
        // Un assaggio musicale non deve sopravvivere alla chiusura (stessa regola della finestra del Duello Libero).
        if (window.DuelSetup && typeof window.DuelSetup.stopPreview === 'function') window.DuelSetup.stopPreview();
        if (a.genitore) a.genitore.insertBefore(a.nodo, a.segno && a.segno.parentNode === a.genitore ? a.segno : null);
        radice.hidden = true;
        document.documentElement.classList.remove('mp-modale-aperta');
        if (a.alChiusura) a.alChiusura();
    }

    /**
     * Trasforma `gruppo` (il riquadro di una scelta: intestazione + selettore) in una riga riassuntiva.
     * @param {HTMLElement} gruppo
     * @param {{ corpo: HTMLElement, titolo: string, titoloModale?: string,
     *           img?: () => (string | null), glifo?: () => string, valore: () => string, dettaglio?: () => string,
     *           alApertura?: () => void, alChiusura?: () => void }} o
     */
    function tessera(gruppo, o) {
        if (!gruppo || !o || !o.corpo) return { aggiorna() {}, bottone: null };
        const testa = gruppo.querySelector('.mp-setup-head');
        if (testa) testa.hidden = true;
        // Il selettore vive nascosto fino a quando serve.
        const deposito = document.createElement('div');
        deposito.className = 'mp-deposito';
        deposito.hidden = true;
        o.corpo.parentNode.insertBefore(deposito, o.corpo);
        deposito.appendChild(o.corpo);

        const bottone = document.createElement('button');
        bottone.type = 'button';
        bottone.className = 'mp-tessera';
        bottone.innerHTML = '<span class="mp-tessera-img" aria-hidden="true"></span>'
            + '<span class="mp-tessera-testi"><small></small><b></b><em></em></span>'
            + '<span class="mp-tessera-cambia">Cambia</span>';
        gruppo.insertBefore(bottone, deposito);
        bottone.querySelector('small').textContent = o.titolo;

        function aggiorna() {
            const imgEl = bottone.querySelector('.mp-tessera-img');
            const url = o.img ? o.img() : null;
            imgEl.style.backgroundImage = url ? `url("${url}")` : '';
            // Una figura scontornata (la pedina) si mostra INTERA; un'arena o un ritratto riempiono il riquadro.
            imgEl.style.backgroundSize = o.contieni ? 'contain' : '';
            imgEl.style.backgroundPosition = o.contieni ? 'center bottom' : '';
            imgEl.textContent = '';
            if (!url) {
                // Senza immagine (mazzo, arena casuale): l'icona a tema del gioco, o il glifo se la libreria non c'e'.
                const svg = (o.icona && window.Icons && Icons.buildIcon) ? Icons.buildIcon(o.icona) : null;
                if (svg) imgEl.appendChild(svg); else imgEl.textContent = o.glifo ? o.glifo() : '';
            }
            imgEl.classList.toggle('is-vuota', !url);
            bottone.querySelector('b').textContent = o.valore();
            const d = o.dettaglio ? o.dettaglio() : '';
            const em = bottone.querySelector('em');
            em.textContent = d;
            em.hidden = !d;
        }
        bottone.onclick = () => apri(o.titoloModale || o.titolo, o.corpo, {
            alApertura: o.alApertura,
            alChiusura: () => { aggiorna(); if (o.alChiusura) o.alChiusura(); }
        });
        aggiorna();
        return { aggiorna, bottone };
    }

    window.MpScelte = { tessera, apri, chiudi };
})();
