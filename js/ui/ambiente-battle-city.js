// @ts-check
/**
 * Effetti WebGL dei quattro quartieri del torneo Battle City (illustrazioni v2, 1672x941).
 * Ogni effetto sta DOVE c'e' la sua sorgente nell'immagine (acqua nelle vasche e nel mare, aloni sui lampioni, finestre che
 * brillano, neon degli edifici): mai un velo su tutto lo schermo. Le posizioni sono in PIXEL dell'illustrazione, lette aprendola;
 * se si cambia un fondale vanno riguardate. Il fondale e' disegnato con la stessa copertura (cover) della pagina; col fondale
 * rimpicciolito del telefono in verticale la pagina non avvia affatto questi effetti (le coordinate non coinciderebbero).
 */
(function () {
    'use strict';
    if (!window.AmbienteWebGL || !window.AmbienteWebGL.registraMappe) return;

    const W = 1672, H = 941;
    const rgb = (r, g, b) => [r / 255, g / 255, b / 255];
    /** Punti in pixel -> 0..1 con y verso l'alto (come vogliono i moduli puntuali). */
    const PX = (pts) => pts.map((p) => [+(p[0] / W).toFixed(4), +(1 - p[1] / H).toFixed(4)].concat(p.length > 2 ? p.slice(2) : [1]));
    /** Rettangoli in pixel (x0, y0, x1, y1, y dall'alto) -> frazioni dell'immagine, per `zone`. */
    const ZPX = (rects) => rects.map((r) => [+(r[0] / W).toFixed(4), +(r[1] / H).toFixed(4), +(r[2] / W).toFixed(4), +(r[3] / H).toFixed(4)]);
    const CALDO = 'vec3(1.,.82,.48)';
    const FRESCO = 'vec3(.45,.78,1.)';

    // ---- Centro: fontana con la guglia, aiuole con gli alberi, lampioni della piazza ----
    const CENTRO_ACQUA = ZPX([[728, 380, 946, 540]]);
    const CENTRO_ALBERI = ZPX([[355, 170, 560, 365], [1110, 170, 1320, 365], [320, 545, 530, 785], [1125, 540, 1335, 775]]);
    const CENTRO_LAMPIONI = PX([[600, 245], [1071, 245], [255, 405], [1415, 405], [573, 605], [1097, 605], [618, 815], [1053, 795]]);
    const CENTRO_SCINTILLE = PX([[836, 345], [790, 470], [880, 500], [770, 520], [900, 440]]);

    // ---- Parco: laghetto con le ninfee, cascatella sotto il ponte, lampioni sul bordo dei vialetti ----
    const PARCO_LAGO = ZPX([[540, 345, 1000, 625]]);
    const PARCO_LAMPIONI = PX([[630, 40], [1037, 38], [303, 255], [275, 632], [598, 778], [1030, 778], [1378, 322], [1368, 668]]);
    const PARCO_SCINTILLE = PX([[690, 440], [770, 530], [840, 440], [640, 560], [900, 520], [720, 395]]);

    // ---- Porto: mare a sinistra e a destra del grande viale, lampioni, gru, finestre dei magazzini ----
    const PORTO_MARE = ZPX([[0, 160, 300, 650], [300, 420, 525, 520], [1135, 420, 1672, 650], [1430, 130, 1672, 440]]);
    const PORTO_RIFLESSI = PX([[60, 300], [190, 470], [430, 450], [480, 530], [1210, 430], [1380, 430], [1330, 560], [1230, 620], [1500, 300], [1560, 260], [1420, 600]]);
    const PORTO_LAMPIONI = PX([[675, 40], [675, 205], [615, 340], [615, 575], [675, 675], [675, 850], [998, 40], [998, 205], [1058, 335], [1058, 580], [998, 690], [998, 850], [340, 495], [445, 497], [1205, 520], [1275, 520]]);
    const PORTO_FINESTRE = PX([[460, 215], [490, 270], [1230, 205], [1290, 205], [1370, 205], [300, 772], [360, 772], [440, 772], [480, 772], [1210, 805], [1250, 805], [1330, 805], [600, 105]]);
    const PORTO_GRU = PX([[237, 138, 1.2], [1520, 178, 1.2]]);
    const PORTO_NAVI = PX([[183, 300, 1], [1320, 485, 1]]);

    // ---- KaibaCorp: vasche della facciata e dei giardini, neon blu dell'edificio, finestre, lampioncini della piazza ----
    const KAIBA_VASCHE = ZPX([[462, 288, 700, 376], [975, 288, 1218, 376], [600, 690, 676, 790], [998, 690, 1075, 790]]);
    const KAIBA_CASCATE = PX([[637, 672, 1], [1037, 672, 1]]);
    const KAIBA_NEON = PX([[636, 60], [1040, 60], [620, 285], [1050, 285], [836, 150], [836, 260]]);
    const KAIBA_TORRI = PX([[650, 120], [1020, 120], [730, 330], [945, 330]]);
    const KAIBA_FINESTRE = PX([[55, 300], [55, 400], [55, 510], [60, 640], [110, 790], [250, 860], [210, 720], [1585, 60], [1585, 200], [1640, 330], [1640, 450], [1590, 790], [1620, 880], [440, 235], [600, 235], [1100, 235], [1240, 235]]);
    const KAIBA_LAMPIONI = PX([[547, 488], [1127, 488], [478, 430], [1193, 430], [455, 850], [540, 835], [735, 805], [1135, 845], [1055, 860], [360, 675], [1310, 640]]);

    window.AmbienteWebGL.registraMappe({
        'battle-city-centro': {
            pal: [rgb(255, 227, 164), rgb(111, 196, 255), rgb(255, 244, 212)],
            fondo: [
                ['raggi', 'A', { ox: .52, oy: .92, cnt: 5, a: .16, area: [.12, .28, .88, 1] }],
                ['caustiche', 'vec3(.7,.95,1.)', { sc: 7, a: .9, zone: CENTRO_ACQUA, bordo: .02 }],
                ['fontane', 'A', { pts: PX([[836, 470, 1]]), sz: .4, c1: [.92, 1, 1], c2: [.4, .8, 1], a: .75 }],
                ['brillo', 'vec3(1.,1.,1.)', { pts: CENTRO_SCINTILLE, sz: .03, ex: 6, vel: .8, a: 1 }],
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
                ['fontane', 'A', { pts: PX([[955, 565, 1]]), sz: .22, c1: [.95, 1, 1], c2: [.45, .8, 1], a: .7 }],
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
                ['spie', 'vec3(1.,.95,.8)', { pts: PORTO_NAVI, sz: .012, a: .9, vel: .5 }],
                ['particelle', 'B', { vx: .02, vy: .015, dens: 6, dim: .04, lamp: .7, osc: .3, a: .32 }]
            ],
            ev: { ogni: [6, 13], dur: 2 }
        },
        'battle-city-kaibacorp': {
            pal: [rgb(110, 185, 255), rgb(255, 204, 122), rgb(196, 223, 255)],
            fondo: [
                ['caustiche', 'vec3(.5,.85,1.)', { sc: 6, a: .9, zone: KAIBA_VASCHE, bordo: .02 }],
                ['fontane', 'A', { pts: KAIBA_CASCATE, sz: .28, c1: [.92, 1, 1], c2: [.35, .75, 1], a: .75 }],
                ['alone', 'vec3(.3,.65,1.)', { pts: KAIBA_NEON, sz: .07, a: .65 }],
                ['spie', FRESCO, { pts: KAIBA_TORRI, sz: .012, a: .95, vel: 1 }],
                ['alone', CALDO, { pts: KAIBA_FINESTRE, sz: .035, a: .6 }],
                ['alone', CALDO, { pts: KAIBA_LAMPIONI, sz: .035, a: .75 }],
                ['particelle', 'B', { vx: .002, vy: -.003, dens: 2, dim: .016, lamp: .85, osc: .65, a: .12, area: [.08, .02, .92, .36] }]
            ],
            ev: { ogni: [8, 16], dur: 1.6 }
        }
    });
})();
