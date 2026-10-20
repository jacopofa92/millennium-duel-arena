// @ts-check
/**
 * ambiente-menu.js — l'ambiente WebGL dello sfondo del menu principale.
 * ------------------------------------------------------------------
 * Al posto dei raggi che giravano (tolti), lo sfondo (images/background/backgroundMainMenu.jpg: notte
 * egizia, luna, piramidi, rilievo di dei, gli Oggetti del Millennio) prende vita con elementi legati a
 * COSA c'e' nell'illustrazione, come per i campi di duello (js/ui/ambiente-webgl.js): la luna che pulsa
 * piano, le nubi che scorrono nel cielo, la foschia nella valle, le stelle che brillano, la fiamma delle
 * torce, e i riflessi che passano sull'oro degli Oggetti.
 *
 * Le posizioni sono nell'IMMAGINE (x da sinistra, y dall'ALTO, 0..1), rilevate guardandola: se si cambia
 * lo sfondo vanno riviste. Il canvas sta in un riquadro identico a quello della foto (inset -3vmax) e
 * si muove con la stessa parallasse, cosi' le torce restano sulle torce.
 *
 * Si accende solo con i Dettagli video su "Alti" (come gli altri ambienti) e senza movimento ridotto.
 */
(function () {
    'use strict';
    if (!window.AmbienteWebGL || !window.AmbienteWebGL.registraMappe) return;

    const rgb = (r, g, b) => [r / 255, g / 255, b / 255];
    /** [x, yDallAlto, grandezza] -> [x, yDalBasso, grandezza] (come vogliono i moduli di immagine). */
    const su = (punti) => punti.map((p) => [p[0], +(1 - p[1]).toFixed(3), p[2]]);
    const CALDO = { c1: [1, .86, .5], c2: [1, .42, .08] };

    window.AmbienteWebGL.registraMappe({
        'menu-principale': {
            ia: 1.5,
            pal: [rgb(205, 222, 255), rgb(255, 200, 110), rgb(255, 245, 215)],
            fondo: [
                // Le nubi nel cielo, lente, e la foschia bassa nella valle fra le piramidi.
                ['nebbia', 'A', { sc: 1.5, vel: .5, a: .05, y0: -.5, y1: .5, area: [0, 0, .62, .34] }],
                // La luna: un alone morbido che respira.
                ['alone', 'A', { pts: su([[.32, .145, .4]]), a: .3 }],
                // Stelle che brillano a turno nel cielo.
                ['brillo', 'C', { pts: su([[.106, .314, .09], [.05, .06, .05], [.2, .1, .055], [.46, .07, .06], [.53, .21, .05], [.6, .1, .05], [.14, .24, .05], [.27, .3, .05], [.4, .3, .045], [.1, .12, .045]]), sz: .7, a: .7, ex: 9, vel: .8 }],
                // Un respiro caldo sul Puzzle del Millennio e sui riflessi dell'oro.
                ['alone', 'B', { pts: su([[.5, .64, .14], [.33, .7, .08], [.65, .7, .09], [.84, .67, .09]]), a: .1 }],
                ['brillo', 'C', { pts: su([[.495, .59, .075], [.34, .67, .06], [.41, .75, .06], [.64, .68, .07], [.84, .64, .07], [.16, .76, .06], [.25, .83, .055], [.56, .72, .05]]), sz: .8, a: .75, ex: 16, vel: .6 }],
                // Le torce lontane.
                ['fiamme', 'B', Object.assign({ pts: su([[.153, .505, 1.2], [.373, .478, .7], [.27, .476, .45]]), sz: .85, a: .85 }, CALDO)],
                // Pulviscolo dorato che sale piano dal suolo.
                ['particelle', 'B', { vx: .02, vy: .05, dens: 7, dim: .05, lamp: 1, osc: .3, a: .5, area: [0, .55, 1, 1] }]
            ]
        }
    });

    /** Il riquadro del canvas: identico a quello della foto, con la stessa parallasse (classi in index.html). */
    function avvia() {
        const bg = document.querySelector('.menu-bg');
        if (!bg || !(window.VideoQuality && window.VideoQuality.isAlti())) return false;
        let cont = bg.querySelector('.menu-bg-gl');
        if (!cont) {
            cont = document.createElement('div');
            cont.className = 'menu-bg-gl';
            const rays = bg.querySelector('.menu-bg-flash');
            bg.insertBefore(cont, rays ? rays.nextSibling : null);
        }
        const L = cont.clientWidth; const H = cont.clientHeight;
        if (!L || !H) return false;
        return window.AmbienteWebGL.avviaMappa('menu-principale', cont, { larghezza: L, altezza: H, ia: 1.5 });
    }

    function ferma() {
        if (window.AmbienteWebGL) window.AmbienteWebGL.ferma();
        const cont = document.querySelector('.menu-bg-gl');
        if (cont) cont.textContent = '';
    }

    window.AmbienteMenu = { avvia: avvia, ferma: ferma };
    window.addEventListener('ygo:video-quality-change', (e) => { if (e.detail && e.detail.livello === 'alti') avvia(); else ferma(); });
    window.addEventListener('load', () => setTimeout(avvia, 400));
    // Con la scheda nascosta il ciclo non deve consumare niente.
    document.addEventListener('visibilitychange', () => { if (window.AmbienteWebGL) window.AmbienteWebGL.sospendi(document.hidden); });
})();
