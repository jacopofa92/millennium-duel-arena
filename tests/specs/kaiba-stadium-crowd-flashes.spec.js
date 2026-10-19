module.exports = {
    name: 'Stadio Kaiba: flash casuali provenienti dagli spalti',
    async run(t) {
        await t.page.waitForFunction(() => window.FieldAmbience && window.VideoQuality && window.gsap);
        const result = await t.evaluate(async () => {
            // Questo spec prova il percorso DOM/GSAP (il ripiego di js/ui/ambiente-webgl.js).
            window.AMBIENTE_WEBGL_OFF = true;
            VideoQuality.set('alti');
            FieldAmbience.avvia('stadioKaiba.jpg');
            FieldAmbience.raffica();
            await new Promise((resolve) => setTimeout(resolve, 180));
            const flashes = Array.from(document.querySelectorAll('.fa-spalti-flash'));
            return {
                attivo: FieldAmbience.attivo(),
                quanti: flashes.length,
                posizioni: flashes.map((el) => ({
                    left: parseFloat(el.style.left), top: parseFloat(el.style.top), zona: el.dataset.zona
                })),
                riflesso: !!document.querySelector('.fa-spalti-riflesso'),
                vecchiaScansione: !!document.querySelector('.fa-tech-griglia')
            };
        });

        t.assert(result.attivo === 'stadio-flash-spalti' && result.quanti >= 6 && result.riflesso,
            'Lo Stadio Kaiba deve generare un gruppo variabile di flash e il riflesso sul campo');
        t.assert(result.posizioni.every((p) => p.zona === 'spalti-alti'
            ? p.top >= 3 && p.top <= 25 && p.left >= 12 && p.left <= 88
            : p.top >= 12 && p.top <= 88
                && ((p.left >= 3 && p.left <= 16) || (p.left >= 84 && p.left <= 97))),
        'I flash devono nascere esclusivamente nella gradinata alta o lungo gli spalti laterali');
        t.assert(result.posizioni.some((p) => p.zona && p.zona.startsWith('laterale-')),
            'Ogni sequenza deve includere anche flash ai lati del field');
        t.assert(!result.vecchiaScansione,
            'Lo Stadio Kaiba non deve più usare la griglia lineare tecnologica');
    }
};
