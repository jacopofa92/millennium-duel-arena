// La carta "compatta" (senza barra del nome, stelle e riga Razza/Tipo, con
// la cornice sottile) la decide la MISURA della carta, non il dispositivo:
// vedi "CARTA COMPATTA" in fondo a js/ui/card.css. Prima la decideva la
// larghezza della finestra (<= 900px) più un elenco a mano dei posti con
// carte piccole in duelMonstersCore.html, quindi una carta grande su
// telefono restava compatta e un posto nuovo andava aggiunto all'elenco.
//
// Qui si costruisce la STESSA carta a misure diverse, in un contenitore
// qualunque (nessuna classe del duello), e si guarda cosa mostra.
module.exports = {
    name: 'Carta compatta: la decide la misura della carta, non la finestra',
    async run(t) {
        const esito = await t.evaluate(() => {
            const prova = document.createElement('div');
            prova.style.cssText = 'position:fixed;left:0;top:0;display:flex;gap:8px;z-index:99999';
            document.body.appendChild(prova);
            const carta = cardDatabase.find((c) => c.type === 'monster' && c.level >= 4);
            const misura = (larghezza, coperta) => {
                const el = createCardElement({ ...carta, uid: 'prova-' + larghezza + (coperta ? 'c' : '') }, !!coperta);
                el.style.setProperty('--card-w', larghezza + 'px');
                el.style.setProperty('--card-h', `calc(${larghezza}px / var(--card-ratio))`);
                prova.appendChild(el);
                const vis = (sel) => { const x = el.querySelector(sel); return !!x && getComputedStyle(x).display !== 'none'; };
                const corpo = getComputedStyle(el, '::before');
                const arte = el.querySelector('.card-frame-art');
                const retro = el.querySelector('.card-back-frame');
                const emblemaRetro = el.querySelector('.card-back-emblem');
                return {
                    larghezza: Math.round(el.getBoundingClientRect().width),
                    altezza: Math.round(el.getBoundingClientRect().height),
                    nome: vis('.card-frame-top'), stelle: vis('.card-frame-stars'), riga: vis('.card-frame-typeline'),
                    statistiche: vis('.card-stats'), raggio: corpo.borderTopLeftRadius,
                    sfondo: corpo.backgroundImage !== 'none',
                    raggioArte: arte ? getComputedStyle(arte).borderTopLeftRadius : null,
                    raggioRetro: retro ? getComputedStyle(retro).borderTopLeftRadius : null,
                    coloreEmblemaRetro: emblemaRetro ? getComputedStyle(emblemaRetro).backgroundColor : null,
                    immagineEmblemaRetro: emblemaRetro ? getComputedStyle(emblemaRetro).backgroundImage : null,
                    immaginiNelRetro: coperta ? el.querySelectorAll('img').length : null
                };
            };
            const r = {
                piccola: misura(58), soglia: misura(72), sopra: misura(74), grande: misura(160),
                dorsoPiccolo: misura(58, true), dorsoGrande: misura(160, true)
            };
            prova.remove();
            return r;
        });

        t.assert(!esito.piccola.nome && !esito.piccola.stelle && !esito.piccola.riga,
            'una carta da 58px è compatta (niente nome/stelle/riga): ' + JSON.stringify(esito.piccola));
        t.assert(esito.piccola.statistiche, 'la carta compatta tiene ATK/DEF');
        // Dal 1.4.174 l'angolo e' PROPORZIONALE alla larghezza (3%, mai sotto 1px): uguale su ogni dispositivo e misura.
        const vicino = (valore, atteso) => Math.abs(parseFloat(valore) - atteso) < 0.06;
        t.assert(vicino(esito.piccola.raggio, 58 * 0.03), 'angolo proporzionale (3% di 58px) sulla carta compatta, trovato ' + esito.piccola.raggio);
        t.assert(esito.piccola.raggioArte === '0px',
            'l artwork della carta compatta deve avere angoli vivi, trovato ' + esito.piccola.raggioArte);
        t.assert(!esito.soglia.nome, 'a 72px (la soglia) la carta è ancora compatta');
        t.assert(esito.sopra.nome && esito.sopra.riga, 'a 74px torna la cornice completa (miniature del Negozio)');
        t.assert(esito.grande.nome && esito.grande.stelle && esito.grande.riga,
            'una carta grande ha la cornice completa: ' + JSON.stringify(esito.grande));
        t.assert(vicino(esito.grande.raggio, 160 * 0.03), 'la carta grande ha l\'angolo proporzionale (3% di 160px), trovato ' + esito.grande.raggio);
        t.assert(esito.piccola.sfondo && esito.grande.sfondo, 'il corpo colorato della carta (::before) si vede a ogni misura');
        t.assert(vicino(esito.dorsoPiccolo.raggio, 58 * 0.03), 'la cornice esterna del dorso piccolo segue lo stesso raggio proporzionale, trovato ' + esito.dorsoPiccolo.raggio);
        t.assert(esito.dorsoPiccolo.raggioRetro === '2px', 'il riquadro marrone del dorso piccolo deve avere raggio 2px');
        [esito.dorsoPiccolo, esito.dorsoGrande].forEach((dorso) => {
            t.assert(dorso.coloreEmblemaRetro === 'rgb(29, 29, 29)' && dorso.immagineEmblemaRetro === 'none',
                'l ovale del dorso deve restare nero a ogni misura, anche durante caricamento e flip: ' + JSON.stringify(dorso));
            t.assert(dorso.immaginiNelRetro === 0,
                'il dorso deve essere ricostruito solo in CSS, senza alcuna immagine: ' + JSON.stringify(dorso));
        });
        t.assert(Math.abs(esito.grande.altezza - Math.round(160 / 0.685)) <= 1, 'proporzioni della carta da --card-ratio: altezza ' + esito.grande.altezza);
    }
};
