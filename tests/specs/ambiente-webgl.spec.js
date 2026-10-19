// L'ambiente del Dirigibile è disegnato da UNO shader (js/ui/ambiente-webgl.js)
// invece che da strati <div> con mix-blend-mode, che sul telefono costavano
// ~3x in fps. Qui si prova: (1) con "Alti" parte il WebGL e NON si crea
// nessuno strato .fa-strato; (2) il fondo sta dietro le carte e il primo piano
// davanti, e nessuno dei due intercetta il tocco; (3) senza WebGL (o con
// AMBIENTE_WEBGL_OFF) si ripiega sugli strati di sempre; (4) con "Normali" non
// resta nulla nel DOM.
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'Ambiente WebGL: un solo shader per il Dirigibile, ripiego sugli strati DOM',
    async run({ page, assert }) {
        await openDuel(page);
        await page.waitForFunction(() => !!window.FieldAmbience && !!window.AmbienteWebGL);

        const stato = () => page.evaluate(() => ({
            webgl: AmbienteWebGL.attivo(),
            ambiente: FieldAmbience.attivo(),
            strati: document.querySelectorAll('.fa-strato').length,
            canvas: AmbienteWebGL.canvas().map((c) => ({
                z: getComputedStyle(c).zIndex,
                tocco: getComputedStyle(c).pointerEvents
            }))
        }));

        // 1) Alti -> WebGL, niente strati DOM
        await page.evaluate(() => { VideoQuality.set('alti'); });
        await page.waitForFunction(() => AmbienteWebGL.attivo(), null, { timeout: 5000 });
        let s = await stato();
        assert(s.webgl && s.strati === 0 && s.ambiente === 'dirigibile-alta-quota',
            `Con Alti sul Dirigibile deve girare solo il WebGL: ${JSON.stringify(s)}`);

        // 2) piani e tocco
        assert(s.canvas.length === 2 && s.canvas[0].z === '1' && s.canvas[1].z === '3',
            `Fondo dietro le carte (z 1) e primo piano davanti (z 3): ${JSON.stringify(s.canvas)}`);
        assert(s.canvas.every((c) => c.tocco === 'none'), 'I canvas non devono intercettare il tocco');

        // 3) ripiego: con il WebGL spento a monte tornano gli strati DOM
        await page.evaluate(() => { FieldAmbience.ferma(); window.AMBIENTE_WEBGL_OFF = true; FieldAmbience.avvia(); });
        s = await stato();
        assert(!s.webgl && s.strati > 0, `Senza WebGL si ripiega sugli strati DOM: ${JSON.stringify(s)}`);
        await page.evaluate(() => { window.AMBIENTE_WEBGL_OFF = false; });

        // 4) Normali -> niente di niente
        await page.evaluate(() => { VideoQuality.set('normali'); });
        s = await stato();
        assert(!s.webgl && s.strati === 0, `Con Normali non resta nulla: ${JSON.stringify(s)}`);
        const canvasResidui = await page.evaluate(() => document.querySelectorAll('.aw-canvas').length);
        assert(canvasResidui === 0, 'Con Normali nessun canvas WebGL resta nel DOM');
    }
};
