// @ts-check
/** Effetti WebGL specifici dei quattro quartieri del torneo Battle City. */
(function () {
    'use strict';
    if (!window.AmbienteWebGL || !window.AmbienteWebGL.registraMappe) return;

    const rgb = (r, g, b) => [r / 255, g / 255, b / 255];
    window.AmbienteWebGL.registraMappe({
        'battle-city-centro': {
            pal: [rgb(255, 227, 164), rgb(111, 196, 255), rgb(255, 244, 212)],
            fondo: [
                ['raggi', 'A', { ox: .52, oy: .92, cnt: 5, a: .2, area: [.12, .28, .88, 1] }],
                ['particelle', 'C', { vx: .015, vy: .035, dens: 7, dim: .035, lamp: .5, osc: .2, a: .28 }]
            ],
            ev: { ogni: [8, 15], dur: 2 }
        },
        'battle-city-parco': {
            pal: [rgb(189, 239, 156), rgb(255, 221, 151), rgb(228, 255, 202)],
            fondo: [
                // Bagliori caldi localizzati sulle lampade dipinte lungo i
                // vialetti. Coordinate normalizzate del fondale, asse Y verso
                // l'alto come richiesto dal modulo WebGL `alone`.
                ['alone', 'vec3(1.,.72,.32)', { pts: [[.37,.97,.46],[.61,.97,.46],[.18,.71,.46],[.82,.68,.46],[.15,.31,.46],[.81,.29,.46],[.35,.09,.46],[.61,.09,.46],[.55,.52,.46]], sz: .055, ia: 1672 / 941, a: .62 }],
                // Particelle piccole e lente suggeriscono foglie e pulviscolo senza strisce uniformi.
                ['particelle', 'B', { vx: .045, vy: -.025, dens: 8, dim: .055, lamp: .25, osc: .5, forma: 2, a: .34 }]
            ],
            ev: { ogni: [7, 14], dur: 2.2 }
        },
        'battle-city-porto': {
            pal: [rgb(98, 204, 235), rgb(255, 178, 105), rgb(207, 237, 255)],
            fondo: [
                ['caustiche', 'A', { sc: 5.5, a: .19, area: [0, .05, .30, .98] }],
                ['nebbia', 'C', { sc: 1.4, vel: .22, a: .13, y0: -.25, y1: .5 }],
                ['particelle', 'B', { vx: .02, vy: .015, dens: 6, dim: .045, lamp: .7, osc: .3, a: .4 }]
            ],
            ev: { ogni: [6, 13], dur: 2 }
        },
        'battle-city-kaibacorp': {
            pal: [rgb(110, 185, 255), rgb(255, 204, 122), rgb(196, 223, 255)],
            fondo: [
                // Riflessi luminosi minuti sulla fascia degli edifici: le
                // finestre vere sono pulsate in overlay, ancorate al fondale.
                // Niente scanner o raggi estesi che lavano tutta la mappa.
                ['particelle', 'B', { vx: .002, vy: -.003, dens: 2, dim: .016, lamp: .85, osc: .65, a: .12, area: [.08, .02, .92, .36] }]
            ],
            ev: { ogni: [8, 16], dur: 1.6 }
        }
    });
})();
