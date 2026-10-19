// Gli ambienti dei campi sono disegnati da shader (js/ui/ambiente-webgl.js)
// invece che da strati <div> con mix-blend-mode, che sul telefono costavano
// ~3x in fps. Qui si prova: (1) OGNI arena che ha una voce WebGL compila
// (nessun errore GLSL) e parte senza creare strati .fa-strato; (2) le
// sorgenti sono distinte fra le arene (nessun "stesso preset con un colore
// diverso"); (3) il fondo sta dietro le carte e il primo piano davanti, e
// nessuno dei due intercetta il tocco; (4) senza WebGL (o con
// AMBIENTE_WEBGL_OFF) si ripiega sugli strati di sempre; (5) con "Normali"
// non resta nulla nel DOM; (6) le due arene della Grande Guerra restano sul
// percorso DOM (non toccate, per richiesta esplicita).
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'Ambiente WebGL: ogni arena compila e parte, firme distinte, ripiego sugli strati DOM',
    async run({ page, assert }) {
        await openDuel(page);
        await page.waitForFunction(() => !!window.FieldAmbience && !!window.AmbienteWebGL);
        await page.evaluate(() => { VideoQuality.set('alti'); });

        // 1) ogni arena con voce WebGL
        const giro = await page.evaluate(() => {
            const out = [];
            FieldAmbience.AMBIENTI.forEach((a) => {
                if (!a.webgl) { out.push({ nome: a.nome, webgl: false }); return; }
                const ok = FieldAmbience.avvia(a.campi[0]);
                out.push({
                    nome: a.nome, webgl: true, ok: ok && AmbienteWebGL.attivo(),
                    strati: document.querySelectorAll('.fa-strato').length,
                    canvas: AmbienteWebGL.canvas().length,
                    err: AmbienteWebGL.errore(),
                    src: AmbienteWebGL.sorgente(a.nome, 'fondo') + '|' + AmbienteWebGL.sorgente(a.nome, 'primo')
                });
            });
            return out;
        });
        const conWebgl = giro.filter((g) => g.webgl);
        assert(conWebgl.length >= 34, `Devono avere lo shader tutte le arene tranne la Grande Guerra: ${conWebgl.length}`);
        const rotte = conWebgl.filter((g) => !g.ok || g.strati !== 0 || g.canvas < 1);
        assert(rotte.length === 0, `Arene con shader che non parte o con strati DOM residui: ${JSON.stringify(rotte.map((g) => [g.nome, g.err]))}`);
        const firme = new Set(conWebgl.map((g) => g.src));
        assert(firme.size === conWebgl.length, 'Ogni arena deve avere uno shader proprio (nessuna coppia identica)');
        const guerra = giro.filter((g) => /^guerra-/.test(g.nome));
        assert(guerra.length === 2 && guerra.every((g) => !g.webgl), 'Le arene della Grande Guerra restano sul percorso DOM');

        // 2) piani e tocco (sul Dirigibile, che ha entrambi i piani)
        await page.evaluate(() => { FieldAmbience.avvia('dirigibileKaibaCorp.jpg'); });
        const canvas = await page.evaluate(() => AmbienteWebGL.canvas().map((c) => ({
            z: getComputedStyle(c).zIndex, tocco: getComputedStyle(c).pointerEvents
        })));
        assert(canvas.length === 2 && canvas[0].z === '1' && canvas[1].z === '3',
            `Fondo dietro le carte (z 1) e primo piano davanti (z 3): ${JSON.stringify(canvas)}`);
        assert(canvas.every((c) => c.tocco === 'none'), 'I canvas non devono intercettare il tocco');

        // 3) ripiego: con il WebGL spento a monte tornano gli strati DOM
        const ripiego = await page.evaluate(() => {
            FieldAmbience.ferma(); window.AMBIENTE_WEBGL_OFF = true; FieldAmbience.avvia('dirigibileKaibaCorp.jpg');
            const r = { webgl: AmbienteWebGL.attivo(), strati: document.querySelectorAll('.fa-strato').length };
            window.AMBIENTE_WEBGL_OFF = false;
            return r;
        });
        assert(!ripiego.webgl && ripiego.strati > 0, `Senza WebGL si ripiega sugli strati DOM: ${JSON.stringify(ripiego)}`);

        // 4) Normali -> niente di niente
        const normali = await page.evaluate(() => {
            VideoQuality.set('normali');
            return { webgl: AmbienteWebGL.attivo(), strati: document.querySelectorAll('.fa-strato').length, canvas: document.querySelectorAll('.aw-canvas').length };
        });
        assert(!normali.webgl && normali.strati === 0 && normali.canvas === 0, `Con Normali non resta nulla: ${JSON.stringify(normali)}`);
    }
};
