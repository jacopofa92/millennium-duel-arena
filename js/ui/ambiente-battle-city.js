// @ts-check
/**
 * Effetti WebGL dei quattro quartieri del torneo Battle City (tavole quadrate 1254x1254, nome `battle_city_<id>_quadrato.jpg`).
 * Ogni effetto sta DOVE c'e' la sua sorgente nell'immagine (acqua nel mare, nel laghetto e nelle vasche, aloni sui lampioni,
 * finestre che brillano, neon degli edifici): mai un velo su tutto lo schermo. Le posizioni sono in PIXEL della tavola, lette
 * aprendola; se si cambia un fondale vanno riguardate. La tavola e' "fittata" (tagliata) sullo schermo con la stessa copertura
 * della pagina; col fondale in verticale (telefono) la pagina NON avvia questi effetti (le coordinate non coinciderebbero).
 */
(function () {
    'use strict';
    if (!window.AmbienteWebGL || !window.AmbienteWebGL.registraMappe) return;

    const W = 1254, H = 1254;
    const rgb = (r, g, b) => [r / 255, g / 255, b / 255];
    /** Punti in pixel -> 0..1 con y verso l'alto (come vogliono i moduli puntuali). */
    const PX = (pts) => pts.map((p) => [+(p[0] / W).toFixed(4), +(1 - p[1] / H).toFixed(4)].concat(p.length > 2 ? p.slice(2) : [1]));
    /** Rettangoli in pixel (x0, y0, x1, y1, y dall'alto) -> frazioni della tavola, per `zone`. */
    const ZPX = (rects) => rects.map((r) => [+(r[0] / W).toFixed(4), +(r[1] / H).toFixed(4), +(r[2] / W).toFixed(4), +(r[3] / H).toFixed(4)]);
    const CALDO = 'vec3(1.,.82,.48)';
    const FRESCO = 'vec3(.45,.78,1.)';

    // ---- Centro: grande piazza selciata, edifici con vetrate, aiuole con gli alberi agli angoli, lampioni ----
    const CENTRO_LAMPIONI = PX([[350, 240], [900, 235], [222, 435], [1032, 430], [222, 770], [1032, 770], [355, 975], [895, 975]]);
    const CENTRO_VETRATE = PX([[620, 100], [520, 150], [730, 150], [625, 1050], [580, 1075], [680, 1075], [1100, 200], [1040, 170], [180, 190], [170, 235], [80, 790], [1190, 640], [1200, 860]]);
    const CENTRO_ALBERI = ZPX([[190, 270, 300, 400], [950, 270, 1070, 400], [185, 820, 290, 950], [960, 820, 1070, 950]]);

    // ---- Parco: laghetto, rotonda, vialetti, lampioni sul bordo dei prati ----
    const PARCO_LAGO = ZPX([[705, 230, 1130, 520]]);
    const PARCO_SCINTILLE = PX([[800, 330], [900, 380], [1000, 300], [1040, 420], [850, 430], [950, 470], [770, 410]]);
    const PARCO_LAMPIONI = PX([[530, 35], [720, 35], [855, 185], [130, 480], [480, 510], [765, 520], [500, 690], [750, 690], [1120, 470], [125, 720], [1125, 715], [530, 1170], [720, 1170]]);

    // ---- Porto: mare a nord e a est dei moli, barche, lampioni del molo, finestre dei magazzini, gru ----
    const PORTO_MARE = ZPX([[345, 0, 1254, 95], [1000, 95, 1254, 250], [955, 270, 1254, 480], [955, 590, 1254, 770]]);
    const PORTO_RIFLESSI = PX([[500, 40], [700, 30], [900, 50], [1100, 50], [1150, 220], [1050, 330], [1180, 380], [1040, 640], [1160, 690], [1050, 740], [1200, 520]]);
    const PORTO_LAMPIONI = PX([[255, 70], [225, 260], [240, 530], [255, 720], [985, 180], [950, 195], [1020, 410], [955, 545], [990, 710], [715, 945], [210, 915], [190, 1150], [1180, 925]]);
    const PORTO_FINESTRE = PX([[350, 1110], [470, 1105], [590, 1110], [840, 1030], [940, 1030], [1050, 1030], [1140, 1030], [865, 1100], [985, 1100], [1100, 1100]]);
    const PORTO_GRU = PX([[45, 230, 1.2], [40, 300, 1.2]]);
    const PORTO_BARCHE = PX([[480, 55, 1], [1100, 125, 1], [1120, 440, 1], [1100, 745, 1]]);

    // ---- KaibaCorp: torre con vetrate azzurre, fontane a ottagono ai lati e a sud, lampioncini della piazza ----
    const KAIBA_VASCHE = ZPX([[105, 545, 200, 620], [1050, 545, 1150, 620], [520, 985, 730, 1050]]);
    const KAIBA_FONTANE = PX([[150, 585, 1], [1105, 585, 1], [625, 1020, 1]]);
    const KAIBA_NEON = PX([[600, 60], [480, 120], [750, 100], [330, 200], [920, 200], [100, 430], [100, 800], [1150, 430], [1150, 800], [600, 1140]]);
    const KAIBA_TORRI = PX([[560, 200], [690, 200], [430, 230], [820, 230]]);
    const KAIBA_FINESTRE = PX([[60, 330], [60, 430], [150, 760], [60, 880], [1190, 330], [1190, 430], [1160, 760], [1190, 880], [340, 1180], [900, 1180]]);
    const KAIBA_LAMPIONI = PX([[265, 185], [990, 185], [485, 290], [870, 290], [260, 380], [990, 380], [190, 500], [1065, 500], [245, 770], [1005, 775], [515, 970], [885, 975], [240, 1110], [1010, 1110]]);

    window.AmbienteWebGL.registraMappe({
        'battle-city-centro': {
            pal: [rgb(255, 227, 164), rgb(111, 196, 255), rgb(255, 244, 212)],
            fondo: [
                ['raggi', 'A', { ox: .52, oy: .92, cnt: 5, a: .14, area: [.12, .28, .88, 1] }],
                ['brillo', 'vec3(.8,.95,1.)', { pts: CENTRO_VETRATE, sz: .03, ex: 6, vel: .8, a: 1 }],
                ['alone', CALDO, { pts: CENTRO_LAMPIONI, sz: .05, a: .7 }],
                ['particelle', 'C', { vx: .03, vy: -.05, dens: 9, dim: .04, osc: .5, forma: 2, a: .4, zone: CENTRO_ALBERI, bordo: .03 }]
            ],
            ev: { ogni: [8, 15], dur: 2 }
        },
        'battle-city-parco': {
            pal: [rgb(189, 239, 156), rgb(255, 221, 151), rgb(228, 255, 202)],
            fondo: [
                ['raggi', 'B', { ox: .3, oy: 1.2, cnt: 5, a: .13 }],
                ['caustiche', 'vec3(.7,.95,1.)', { sc: 6, a: .9, zone: PARCO_LAGO, bordo: .04 }],
                ['brillo', 'vec3(1.,1.,1.)', { pts: PARCO_SCINTILLE, sz: .03, ex: 6, vel: .9, a: 1 }],
                ['alone', CALDO, { pts: PARCO_LAMPIONI, sz: .06, a: .8 }],
                // Foglie e pulviscolo che cadono piano fra gli alberi.
                ['particelle', 'B', { vx: .045, vy: -.025, dens: 8, dim: .055, lamp: .25, osc: .5, forma: 2, a: .34 }]
            ],
            ev: { ogni: [7, 14], dur: 2.2 }
        },
        'battle-city-porto': {
            pal: [rgb(98, 204, 235), rgb(255, 178, 105), rgb(207, 237, 255)],
            fondo: [
                ['caustiche', 'vec3(.6,.9,1.)', { sc: 6, a: .75, zone: PORTO_MARE, bordo: .03 }],
                ['nebbia', 'vec3(.75,.88,1.)', { sc: 1.6, vel: .25, a: .12, y0: -.2, y1: 1.2, zone: PORTO_MARE, bordo: .05 }],
                ['brillo', 'vec3(1.,.92,.72)', { pts: PORTO_RIFLESSI, sz: .035, ex: 6, vel: .9, a: 1 }],
                ['alone', CALDO, { pts: PORTO_LAMPIONI, sz: .05, a: .75 }],
                ['alone', CALDO, { pts: PORTO_FINESTRE, sz: .03, a: .6 }],
                ['spie', 'vec3(1.,.15,.12)', { pts: PORTO_GRU, sz: .014, a: 1, vel: .7 }],
                ['spie', 'vec3(1.,.95,.8)', { pts: PORTO_BARCHE, sz: .012, a: .9, vel: .5 }],
                ['particelle', 'B', { vx: .02, vy: .015, dens: 6, dim: .04, lamp: .7, osc: .3, a: .32 }]
            ],
            ev: { ogni: [6, 13], dur: 2 }
        },
        'battle-city-kaibacorp': {
            pal: [rgb(110, 185, 255), rgb(255, 204, 122), rgb(196, 223, 255)],
            fondo: [
                ['caustiche', 'vec3(.5,.85,1.)', { sc: 6, a: .9, zone: KAIBA_VASCHE, bordo: .02 }],
                ['fontane', 'A', { pts: KAIBA_FONTANE, sz: .3, c1: [.92, 1, 1], c2: [.35, .75, 1], a: .75 }],
                ['alone', 'vec3(.3,.65,1.)', { pts: KAIBA_NEON, sz: .07, a: .65 }],
                ['spie', FRESCO, { pts: KAIBA_TORRI, sz: .012, a: .95, vel: 1 }],
                ['alone', CALDO, { pts: KAIBA_FINESTRE, sz: .035, a: .6 }],
                ['alone', CALDO, { pts: KAIBA_LAMPIONI, sz: .035, a: .75 }],
                ['particelle', 'B', { vx: .002, vy: -.003, dens: 2, dim: .016, lamp: .85, osc: .65, a: .12 }]
            ],
            ev: { ogni: [8, 16], dur: 1.6 }
        }
    });
})();
