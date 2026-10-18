// @ts-check
/**
 * js/ui/deck-box.js — il markup della "deck box" 3D
 * =====================================================================
 * Gemello di js/ui/deck-box.css: quello disegna, questo costruisce il
 * markup che quelle regole si aspettano. Condiviso fra creazione-deck.html
 * (i mazzi del giocatore, gli Starter/Structure Deck, l'anteprima
 * dell'editor) e il Negozio, che deve mostrare gli stessi mazzi nello
 * stesso identico modo — richiesta esplicita dell'utente.
 *
 * L'API prende un oggetto PIATTO e non un mazzo intero: nome, colore,
 * immagine di copertina già risolta. Così chi la chiama resta libero di
 * decidere a modo suo quale sia la carta simbolo (creazione-deck.html ha
 * resolveCoverCard con le sue regole; il Negozio legge il coverCardId del
 * pacchetto) senza che questo file debba conoscere la forma di un mazzo.
 */
(function () {
    'use strict';

    /** Il nome di un mazzo è testo libero dell'utente: mai iniettato grezzo. */
    function escapeHtml(text) {
        return String(text == null ? '' : text).replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }

    /**
     * `opts`:
     *   name       nome stampato sul coperchio
     *   color      --box-base, l'unico colore da dare alla scatola
     *   coverSrc   percorso dell'illustrazione stampata sul fronte (facoltativo)
     *   emblem     emoji sovrapposta al fronte, es. il lucchetto (facoltativo)
     *   ribbon     etichetta in posizione assoluta sopra la scatola (facoltativa)
     */
    function markup(opts) {
        const o = opts || {};
        const cover = o.coverSrc
            ? `<img class="dbx-cover" src="${o.coverSrc}" alt="" onerror="this.remove()">`
            : '';
        const emblem = o.emblem ? `<div class="dbx-emblem">${o.emblem}</div>` : '';
        // L'etichetta sta SOPRA la scatola, in posizione assoluta, quindi
        // non occupa spazio nel flusso: dentro il blocco informazioni
        // spingerebbe in basso testo e pulsanti della sola scatola che ce
        // l'ha, disallineandola da quelle affiancate nella griglia.
        const ribbon = o.ribbon ? `<div class="deck-card-active-badge">${o.ribbon}</div>` : '';
        return `
            <div class="deck-box-stage">
                <div class="deck-box-art" style="--box-base:${o.color || '#b3241c'}">
                    <div class="dbx-top"></div>
                    <div class="dbx-side"></div>
                    <div class="dbx-front">
                        ${cover}
                        <div class="dbx-lid"><div class="dbx-name"><span class="dbx-name-text">${escapeHtml(o.name)}</span></div></div>
                        ${emblem}
                    </div>
                </div>
                ${ribbon}
            </div>
        `;
    }

    /**
     * Colore stabile per un pacchetto che non ne ha uno scelto a mano:
     * deriva dal suo id, così lo stesso Structure Deck ha sempre la stessa
     * scatola ovunque compaia, ma due mazzi diversi non finiscono quasi
     * mai dello stesso colore. Le tinte sono le stesse di BOX_PALETTES in
     * creazione-deck.html.
     */
    const PALETTE = [
        '#b3241c', '#6b1230', '#c2560f', '#b8860b', '#8f7234', '#5d8c15',
        '#1d7a4c', '#0f7d68', '#12727f', '#1d4f9e', '#33308f', '#6a2da8',
        '#5b2a55', '#a8256b', '#4a6079', '#39414f'
    ];
    function colorForId(id) {
        const testo = String(id || '');
        let h = 0;
        for (let i = 0; i < testo.length; i++) h = (h * 31 + testo.charCodeAt(i)) >>> 0;
        return PALETTE[h % PALETTE.length];
    }

    window.DeckBox = { markup: markup, colorForId: colorForId, PALETTE: PALETTE };
})();
