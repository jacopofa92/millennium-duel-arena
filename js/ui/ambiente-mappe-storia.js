// @ts-check
/**
 * ambiente-mappe-storia.js — gli effetti ambientali delle MAPPE della Storia.
 * ------------------------------------------------------------------------
 * Dati e basta: i moduli GLSL (vento, nebbia, particelle, raggi, caustiche,
 * fiamme, scintille, fulmine, glitch, impatti...) stanno in
 * js/ui/ambiente-webgl.js; qui si dice, per ogni mappa, quali usare e DOVE.
 * Le mappe le accende NodeMap (js/ui/node-map.js) dopo aver caricato lo
 * sfondo: il canvas vive dentro il mondo della mappa, quindi scorre e si
 * ingrandisce con lei e un effetto resta ancorato al suo punto del disegno.
 *
 * COME LEGGERE UNA VOCE. La chiave e' il nome del file dell'immagine senza
 * estensione. `pal` sono tre colori (A, B, C) che i moduli usano per nome;
 * `fondo` e' l'elenco di [modulo, colore, parametri]. Coordinate: x da
 * sinistra, y DALL'ALTO, entrambe 0..1 come nei programmi di grafica
 * (diverso da js/ui/ambiente-webgl.js, dove i campi usano y verso l'alto:
 * qui `su()` converte). Il parametro `area: [x0, y0, x1, y1]` limita un
 * effetto a un rettangolo — e' cosi' che la neve sta solo sulle montagne e
 * le caustiche solo sull'acqua.
 *
 * Si accendono solo con i Dettagli video su "Alti" e senza movimento
 * ridotto (lo controlla avviaMappa), come gli ambienti dei duelli.
 * Le posizioni delle luci del castello sono state rilevate sulle immagini
 * stesse (macchie calde luminose); se si cambia un'immagine vanno rifatte.
 */
(function () {
    'use strict';
    if (!window.AmbienteWebGL || !window.AmbienteWebGL.registraMappe) return;

    const rgb = (r, g, b) => [r / 255, g / 255, b / 255];
    /** [x, yDallAlto, grandezza] -> [x, yDalBasso, grandezza], come vuole il modulo `fiamme`. */
    const su = (punti) => punti.map((p) => [p[0], +(1 - p[1]).toFixed(3), p[2]]);

    const CALDO = { c1: [1, .86, .5], c2: [1, .42, .08] };
    const AZZURRO = { c1: [.55, .88, 1], c2: [.2, .5, 1] };
    const VIOLA = { c1: [.85, .6, 1], c2: [.5, .2, 1] };
    const ORO = { c1: [1, .9, .55], c2: [1, .62, .12] };
    const ROSSO = { c1: [1, .55, .4], c2: [.9, .15, .1] };

    // Luci del Castello di Pegasus (taglio in sezione) e della Sala del Trono del torneo,
    // rilevate sulle immagini.
    const CASTELLO = [[0.422,0.439,0.6],[0.552,0.106,0.6],[0.964,0.247,0.6],[0.891,0.761,0.6],[0.848,0.731,0.6],[0.803,0.725,0.6],[0.503,0.886,0.6],[0.575,0.886,0.6],[0.327,0.892,0.6],[0.248,0.761,0.6],[0.581,0.797,0.6],[0.156,0.681,0.6],[0.116,0.758,0.6]];
    const SALA_TRONO = [[0.203,0.81,0.84],[0.545,0.213,0.8],[0.075,0.817,0.75],[0.416,0.215,0.73],[0.725,0.562,0.71],[0.909,0.81,0.71],[0.72,0.81,0.67],[0.641,0.159,0.66],[0.905,0.145,0.65],[0.069,0.15,0.65],[0.227,0.557,0.6],[0.139,0.749,0.6],[0.294,0.778,0.6],[0.544,0.321,0.6],[0.042,0.532,0.6],[0.623,0.778,0.6],[0.345,0.166,0.6],[0.089,0.295,0.6],[0.944,0.541,0.6],[0.869,0.29,0.6],[0.611,0.93,0.6],[0.686,0.96,0.6],[0.878,0.674,0.6],[0.725,0.684,0.6],[0.411,0.33,0.6],[0.841,0.478,0.6],[0.547,0.712,0.6],[0.789,0.665,0.6],[0.316,0.295,0.6],[0.22,0.681,0.6]];

    window.AmbienteWebGL.registraMappe({
        // ---- La mappa principale: i cinque mondi sospesi ------------------------------
        storia_mappa_principale: {
            pal: [rgb(190, 210, 255), rgb(255, 170, 90), rgb(200, 150, 255)],
            fondo: [
                ['nebbia', 'A', { sc: 1.3, vel: .8, a: .16, y0: -.6, y1: .45 }],
                ['raggi', 'A', { ox: .5, oy: .62, cnt: 10, a: .12, area: [.3, 0, .7, 1] }],
                ['fiamme', 'A', Object.assign({ pts: su([[.09, .27, 3], [.5, .38, 4]]) }, AZZURRO, { sz: .8, a: .42 })],
                ['fiamme', 'A', Object.assign({ pts: su([[.27, .33, 3], [.67, .33, 3]]) }, CALDO, { sz: .8, a: .42 })],
                ['fiamme', 'A', Object.assign({ pts: su([[.89, .33, 3.5]]) }, ORO, { sz: .8, a: .5 })],
                ['raggi', 'B', { ox: .89, oy: .64, cnt: 8, a: .14, area: [.72, 0, 1, 1] }],
                ['particelle', 'B', { vx: .02, vy: .16, dens: 9, dim: .06, lamp: 1, osc: .2, a: .8, area: [.18, .12, .78, .55] }],
                ['fulmine', 'C', { a: 1, area: [.74, 0, 1, .4] }]
            ],
            ev: { ogni: [6, 12], dur: 1.3 }
        },
        // ---- La mappa dei sei archi --------------------------------------------------
        storia_mappa_principale_sei_isole: {
            pal: [rgb(190, 210, 255), rgb(255, 170, 90), rgb(200, 150, 255)],
            fondo: [
                ['nebbia', 'A', { sc: 1.4, vel: .8, a: .16, y0: -.6, y1: .4 }],
                ['raggi', 'A', { ox: .57, oy: .6, cnt: 10, a: .12, area: [.45, 0, .7, 1] }],
                ['fiamme', 'A', Object.assign({ pts: su([[.095, .4, 2.5], [.297, .3, 3], [.57, .35, 3.5]]) }, AZZURRO, { sz: .8, a: .42 })],
                ['fiamme', 'A', Object.assign({ pts: su([[.43, .33, 3], [.7, .33, 3]]) }, CALDO, { sz: .8, a: .42 })],
                ['fiamme', 'A', Object.assign({ pts: su([[.875, .35, 3.5]]) }, ORO, { sz: .8, a: .5 })],
                ['raggi', 'B', { ox: .875, oy: .65, cnt: 8, a: .14, area: [.76, 0, 1, 1] }],
                ['particelle', 'B', { vx: .02, vy: .16, dens: 9, dim: .06, lamp: 1, osc: .2, a: .8, area: [.34, .15, .78, .55] }],
                ['fulmine', 'C', { a: 1, area: [.78, 0, 1, .4] }]
            ],
            ev: { ogni: [6, 12], dur: 1.3 }
        },
        // ---- Anime ---------------------------------------------------------------------
        storia_anime_prologo: {
            pal: [rgb(255, 250, 235), rgb(200, 230, 255), rgb(255, 255, 255)],
            fondo: [
                ['raggi', 'A', { ox: .15, oy: 1.2, cnt: 6, a: .16 }],
                ['nebbia', 'C', { sc: 1.3, vel: 1.4, a: .2, y0: -.4, y1: 1.3 }],
                ['caustiche', 'C', { sc: 7, a: .3, area: [.4, 0, 1, .62] }],
                ['particelle', 'C', { vx: .12, vy: 0, dens: 14, dim: .05, lamp: 1, a: .6, area: [.5, .05, 1, .6] }],
                ['fiamme', 'A', Object.assign({ pts: su([[.86, .62, 1.6]]) }, AZZURRO, { sz: 1, a: .8 })]
            ]
        },
        storia_anime_regno: {
            pal: [rgb(255, 250, 235), rgb(190, 230, 255), rgb(255, 255, 255)],
            fondo: [
                ['raggi', 'A', { ox: .2, oy: 1.2, cnt: 6, a: .15 }],
                ['nebbia', 'C', { sc: 1.1, vel: 1.2, a: .26, y0: -.4, y1: 1.3 }],
                ['caustiche', 'B', { sc: 6, a: .2 }],
                ['particelle', 'C', { vx: .1, vy: 0, dens: 12, dim: .05, lamp: 1, a: .5 }]
            ]
        },
        storia_anime_castello_pegasus: {
            pal: [rgb(255, 214, 140), rgb(120, 150, 190), rgb(190, 150, 255)],
            fondo: [
                ['nebbia', 'B', { sc: 1.6, vel: .6, a: .14, y0: -.4, y1: .5, area: [0, .55, .75, 1] }],
                ['caustiche', 'B', { sc: 6, a: .7, area: [.72, .78, .99, .98] }],
                ['fiamme', 'A', Object.assign({ pts: su(CASTELLO), sz: .8, a: .9 }, CALDO)],
                ['fiamme', 'A', Object.assign({ pts: su([[.23, .43, 2.2]]) }, VIOLA, { sz: 1, a: .7 })],
                ['fiamme', 'A', Object.assign({ pts: su([[.83, .43, 2.2]]) }, { c1: [.4, 1, .9], c2: [.1, .7, .7] }, { sz: 1, a: .7 })],
                ['fiamme', 'A', Object.assign({ pts: su([[.52, .47, 3]]) }, AZZURRO, { sz: 1, a: .6 })],
                ['particelle', 'A', { vx: .02, vy: .03, dens: 8, dim: .05, lamp: 1, osc: .3, a: .6 }]
            ]
        },
        regno_dei_duellanti_castello_pegasus_torneo: {
            pal: [rgb(255, 190, 110), rgb(90, 80, 100), rgb(255, 120, 60)],
            fondo: [
                ['nebbia', 'B', { sc: 1.4, vel: .6, a: .2, y0: -.4, y1: 1.3 }],
                ['fiamme', 'A', Object.assign({ pts: su(SALA_TRONO), sz: .85, a: .95 }, CALDO)],
                ['particelle', 'A', { vx: .02, vy: .02, dens: 8, dim: .05, lamp: 1, osc: .3, a: .5 }]
            ]
        },
        storia_anime_battlecity1: {
            pal: [rgb(200, 230, 255), rgb(255, 190, 110), rgb(255, 235, 180)],
            fondo: [
                ['raggi', 'A', { ox: .77, oy: .93, cnt: 5, a: .5, area: [.45, 0, 1, .75] }],
                ['fiamme', 'A', Object.assign({ pts: su([[.75, .5, 4]]) }, ORO, { sz: 1, a: .7 })],
                ['fiamme', 'A', Object.assign({ pts: su([[.77, .07, 1.6]]) }, AZZURRO, { sz: 1, a: .8 })],
                ['particelle', 'B', { vx: 0, vy: 0, dens: 20, dim: .04, lamp: 1, a: .7, area: [0, .2, .55, 1] }],
                ['particelle', 'A', { vx: .1, vy: 0, dens: 12, dim: .05, lamp: 1, a: .6, area: [.5, .45, 1, .95] }],
                ['scintille', 'C', { a: .9, area: [.55, .3, .95, .7] }]
            ],
            ev: { ogni: [3, 6], dur: 1.8 }
        },
        storia_anime_battlecity2: {
            pal: [rgb(150, 200, 255), rgb(120, 170, 255), rgb(235, 245, 255)],
            fondo: [
                ['raggi', 'A', { ox: .47, oy: .93, cnt: 4, a: .4, area: [.25, 0, .7, .6] }],
                ['raggi', 'C', { ox: .73, oy: .9, cnt: 5, a: .4, area: [.55, 0, 1, .6] }],
                ['caustiche', 'B', { sc: 6, a: .3 }],
                ['particelle', 'C', { vx: .08, vy: 0, dens: 12, dim: .05, lamp: 1, a: .5 }],
                ['fiamme', 'A', Object.assign({ pts: su([[.47, .2, 2], [.73, .1, 1.6]]) }, AZZURRO, { sz: 1, a: .8 })]
            ]
        },
        storia_anime_virtuale: {
            pal: [rgb(110, 225, 255), rgb(190, 110, 255), rgb(255, 90, 110)],
            fondo: [
                ['scan', 'A', { a: .45 }],
                ['particelle', 'A', { vx: 0, vy: -.28, dens: 11, dim: .05, forma: 3, a: .5 }],
                ['glitch', 'C', { a: .5, area: [.65, 0, .95, .27] }],
                ['fiamme', 'A', Object.assign({ pts: su([[.5, .58, 4.5]]) }, AZZURRO, { sz: 1, a: .7 })],
                ['fiamme', 'A', Object.assign({ pts: su([[.45, .3, 3]]) }, VIOLA, { sz: 1, a: .7 })],
                ['particelle', 'A', { vx: 0, vy: -.06, dens: 12, dim: .05, lamp: 1, forma: 3, a: .8, area: [.65, .3, .95, .52] }]
            ],
            ev: { ogni: [5, 10], dur: 2.6 }
        },
        storia_anime_cerimoniale: {
            pal: [rgb(255, 214, 140), rgb(190, 110, 255), rgb(255, 90, 70)],
            fondo: [
                ['strisce', 'A', { vel: 1, a: .2, dens: 8, area: [.57, 0, 1, .4] }],
                ['nebbia', 'B', { sc: 1.6, a: .3, y0: -.4, y1: 1.4, area: [.17, 0, .57, .25] }],
                ['fulmine', 'B', { a: 1, area: [.17, 0, .57, .25] }],
                ['nebbia', 'C', { sc: 1.8, a: .3, y0: -.4, y1: 1.4, area: [.11, .25, .57, .55] }],
                ['particelle', 'C', { vx: 0, vy: .2, dens: 10, dim: .06, lamp: 1, a: .8, area: [.11, .25, .57, .55] }],
                ['fiamme', 'A', Object.assign({ pts: su([[.8, .62, 3]]) }, ORO, { sz: 1, a: .8 })],
                ['particelle', 'A', { vx: .02, vy: .12, dens: 10, dim: .05, lamp: 1, a: .8, area: [.46, .55, .96, .8] }],
                ['caustiche', 'A', { sc: 8, a: .35, area: [0, .55, .4, .72] }]
            ],
            ev: { ogni: [6, 12], dur: 1.2 }
        },
        // ---- Memorie Proibite ------------------------------------------------------------
        storia_forbidden_memories_1: {
            pal: [rgb(255, 255, 255), rgb(255, 214, 140), rgb(190, 235, 255)],
            fondo: [
                ['nebbia', 'A', { sc: 1.2, vel: 1, a: .2, y0: -.4, y1: 1.4 }],
                ['nebbia', 'A', { sc: 1.4, vel: .8, a: .3, y0: -.4, y1: 1.4, area: [0, .4, .4, 1] }],
                ['strisce', 'B', { vel: 1.3, a: .26, dens: 9, area: [.55, 0, 1, .55] }],
                ['particelle', 'A', { vx: .15, vy: -.3, dens: 12, dim: .06, osc: .3, a: .8, area: [0, .4, .4, 1] }],
                ['caustiche', 'C', { sc: 6, a: .5, area: [.55, .55, 1, 1] }],
                ['fiamme', 'A', Object.assign({ pts: su([[.89, .12, 2.5]]) }, ROSSO, { sz: 1, a: .8 })],
                ['fiamme', 'A', Object.assign({ pts: su([[.89, .9, 2.2]]) }, { c1: [.4, 1, .95], c2: [.1, .7, .8] }, { sz: 1, a: .6 })]
            ]
        },
        // ---- Freedom -----------------------------------------------------------------------
        storia_freedom_1: {
            pal: [rgb(255, 235, 190), rgb(255, 208, 130), rgb(255, 250, 235)],
            fondo: [
                ['raggi', 'B', { ox: .85, oy: 1.2, cnt: 6, a: .16 }],
                ['strisce', 'A', { vel: 1, a: .2, dens: 8, y0: -.2, y1: 1.2 }],
                ['caustiche', 'C', { sc: 7, a: .35, area: [0, 0, 1, .13] }],
                ['particelle', 'B', { vx: .5, vy: 0, dens: 10, dim: .05, a: .5 }]
            ]
        },
        storia_freedom_2: {
            pal: [rgb(255, 214, 120), rgb(255, 150, 60), rgb(255, 240, 200)],
            fondo: [
                ['raggi', 'A', { ox: .925, oy: .88, cnt: 8, a: .45 }],
                ['fiamme', 'A', Object.assign({ pts: su([[.925, .12, 3.5]]) }, ORO, { sz: 1, a: .9 })],
                ['caustiche', 'C', { sc: 7, a: .45, area: [.35, .45, .95, .75] }],
                ['nebbia', 'C', { sc: 2, vel: .5, a: .3, y0: -.4, y1: 1.4, area: [.8, .3, .97, .5] }],
                ['particelle', 'A', { vx: .15, vy: .04, dens: 10, dim: .05, lamp: 1, a: .7 }]
            ]
        },
        // ---- Grande Guerra -----------------------------------------------------------------
        storia_la_grande_guerra_1: {
            pal: [rgb(255, 196, 96), rgb(110, 100, 90), rgb(255, 232, 150)],
            fondo: [
                ['nebbia', 'B', { sc: 1.6, vel: .6, a: .22, y0: -.4, y1: 1.4, area: [.3, .12, .98, .78] }],
                ['impatti', 'A', { a: .9, area: [.3, .12, .98, .78] }]
            ]
        },
        // ---- Torneo del Regno dei Duellanti ------------------------------------------------
        regno_dei_duellanti_bosco_torneo: {
            pal: [rgb(214, 255, 150), rgb(255, 238, 170), rgb(150, 220, 150)],
            fondo: [
                ['raggi', 'B', { ox: .3, oy: 1.2, cnt: 7, a: .26 }],
                ['strisce', 'C', { vel: .9, a: .12, dens: 7, y0: -.2, y1: 1.2 }],
                ['caustiche', 'B', { sc: 8, a: .45, area: [0, .42, 1, .62] }],
                ['particelle', 'B', { vx: .1, vy: .05, dens: 9, dim: .06, lamp: 1, osc: .4, a: .8 }]
            ]
        }
    });
})();
