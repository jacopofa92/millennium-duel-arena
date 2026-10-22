// @ts-check
/**
 * mp-pedina.js — la PEDINA che ogni giocatore sceglie per sé nella sala del Multiplayer.
 * ------------------------------------------------------------------------------------
 * Oltre a mazzo, arena e musica, ognuno sceglie con quale ritratto si presenta: è quello che compare sul suo posto
 * in sala, nell'angolo del duello, nella presentazione VS e nella schermata finale, sia per lui sia per l'avversario
 * (che lo riceve nel messaggio 'ready', vedi js/multiplayer/mp-lobby.js). Il predefinito è la pedina personale di
 * sempre ("Te stesso", lo specchio): chi non tocca niente non cambia niente.
 *
 * Si sceglie fra "Te stesso" e i Duellanti che si possiedono (gli stessi che si possono sfidare in Duello Libero: un
 * Duellante bloccato non si puo' indossare). Viaggia solo l'ID del personaggio, mai un percorso: chi riceve lo cerca
 * nel proprio elenco (`risolvi`), quindi un messaggio malevolo non puo' far caricare un'immagine qualunque.
 * La scelta si ricorda su questo dispositivo (localStorage).
 */
(function () {
    'use strict';

    const CHIAVE = 'ygoMpPedina';
    /** @type {{ id: string, name: string, image: string }} */
    const PREDEFINITA = { id: 'player', name: 'Te stesso', image: 'images/characters/mirror.jpg' };

    /** @returns {any[]} */
    function personaggi() {
        return typeof characterDatabase !== 'undefined' ? characterDatabase : [];
    }

    /** Le pedine fra cui si puo' scegliere: "Te stesso" e i Duellanti sbloccati. */
    function elenco() {
        const sbloccato = window.CharacterUnlocks && typeof CharacterUnlocks.sbloccato === 'function'
            ? (/** @type {string} */ id) => CharacterUnlocks.sbloccato(id)
            : () => true;
        return [PREDEFINITA].concat(personaggi()
            .filter((c) => c.image && c.image !== PREDEFINITA.image && sbloccato(c.id))
            .map((c) => ({ id: c.id, name: c.name, image: c.image })));
    }

    /** Da un id (anche ricevuto dalla rete) alla pedina vera; un id sconosciuto da' quella predefinita. */
    function risolvi(id) {
        if (id && id !== PREDEFINITA.id) {
            const c = personaggi().find((x) => x.id === id);
            if (c && c.image) return { id: c.id, name: c.name, image: c.image };
        }
        return PREDEFINITA;
    }

    // La scelta si legge dal dispositivo UNA volta, all'apertura della pagina, e poi vive in memoria: due schede dello
    // stesso browser (chi prova da solo) non devono cambiarsi la pedina a vicenda.
    /** @type {string | null} */
    let corrente = null;
    try { corrente = localStorage.getItem(CHIAVE); } catch (e) { /* localStorage negato: resta il predefinito */ }

    function scelta() {
        return risolvi(corrente);
    }

    function imposta(id) {
        corrente = id;
        try { localStorage.setItem(CHIAVE, id); } catch (e) { /* localStorage negato: vale per questa sessione */ }
    }

    /**
     * Disegna il selettore dentro `contenitore`: la pedina attuale (un tocco apre l'elenco) e, aperto, una griglia di
     * ritratti. `onChange(pedina)` scatta alla scelta.
     * @param {HTMLElement} contenitore
     * @param {{ onChange?: (pedina: { id: string, name: string, image: string }) => void }} [opzioni]
     */
    function monta(contenitore, opzioni) {
        if (!contenitore) return;
        const onChange = (opzioni && opzioni.onChange) || (() => {});
        let attuale = scelta();
        contenitore.innerHTML = `
            <button type="button" class="mp-pedina-attuale" aria-expanded="false">
                <span class="mp-pedina-ritratto"></span>
                <span class="mp-pedina-testi"><strong class="mp-pedina-nome"></strong><small>Tocca per cambiare</small></span>
            </button>
            <div class="mp-pedina-griglia" hidden></div>`;
        const bottone = /** @type {HTMLElement} */ (contenitore.querySelector('.mp-pedina-attuale'));
        const ritratto = /** @type {HTMLElement} */ (contenitore.querySelector('.mp-pedina-ritratto'));
        const nome = /** @type {HTMLElement} */ (contenitore.querySelector('.mp-pedina-nome'));
        const griglia = /** @type {HTMLElement} */ (contenitore.querySelector('.mp-pedina-griglia'));

        function aggiorna() {
            ritratto.style.backgroundImage = `url("${attuale.image}")`;
            nome.textContent = attuale.name;
            griglia.querySelectorAll('.mp-pedina-voce').forEach((v) => v.classList.toggle('is-scelta', v.getAttribute('data-id') === attuale.id));
        }
        function riempi() {
            griglia.innerHTML = '';
            elenco().forEach((p) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'mp-pedina-voce';
                b.setAttribute('data-id', p.id);
                b.title = p.name;
                const img = document.createElement('span');
                img.className = 'mp-pedina-voce-img';
                img.style.backgroundImage = `url("${p.image}")`;
                const t = document.createElement('span');
                t.className = 'mp-pedina-voce-nome';
                t.textContent = p.name;
                b.appendChild(img); b.appendChild(t);
                b.onclick = () => {
                    attuale = p;
                    imposta(p.id);
                    griglia.hidden = true;
                    bottone.setAttribute('aria-expanded', 'false');
                    aggiorna();
                    onChange(p);
                };
                griglia.appendChild(b);
            });
        }
        bottone.onclick = () => {
            const apri = griglia.hidden;
            if (apri) riempi();
            griglia.hidden = !apri;
            bottone.setAttribute('aria-expanded', String(apri));
            aggiorna();
        };
        aggiorna();
    }

    window.MpPedina = { PREDEFINITA, elenco, risolvi, scelta, imposta, monta };
})();
