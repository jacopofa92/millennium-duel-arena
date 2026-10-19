module.exports = {
    name: 'Tempio Egizio Oscuro: bracieri, Horus e scintille senza preset ombra',
    async run(t) {
        await t.page.waitForFunction(() => window.FieldAmbience && window.VideoQuality && window.gsap);
        const result = await t.evaluate(async () => {
            // Questo spec prova il percorso DOM/GSAP (il ripiego di js/ui/ambiente-webgl.js).
            window.AMBIENTE_WEBGL_OFF = true;
            VideoQuality.set('alti');
            FieldAmbience.avvia('anticoEgittoTempioOscuro.jpg');
            FieldAmbience.raffica();
            await new Promise((resolve) => setTimeout(resolve, 220));
            const torce = Array.from(document.querySelectorAll('.fa-tempio-torcia'));
            return {
                attivo: FieldAmbience.attivo(),
                torce: torce.length,
                torcePerimetrali: torce.every((el) => {
                    const x = parseFloat(el.style.left);
                    return x <= 36 || x >= 64;
                }),
                occhio: document.querySelectorAll('.fa-tempio-occhio').length,
                scintille: document.querySelectorAll('.fa-tempio-scintilla').length,
                vecchioPreset: document.querySelectorAll('.fa-atmo-tenebra, .fa-atmo-rune, .fa-firma-spiriti').length
            };
        });
        t.assert(result.attivo === 'tempio-bracieri-horus',
            'Il Tempio Oscuro deve usare il profilo dedicato');
        t.assert(result.torce >= 5 && result.torcePerimetrali,
            'I bagliori devono essere numerosi e restare sui bracieri perimetrali');
        t.assert(result.occhio === 1 && result.scintille >= 5,
            'Devono esistere il respiro dell’Occhio di Horus e le scintille laterali');
        t.assert(result.vecchioPreset === 0,
            'Il vecchio preset viola con tenebra, rune e spiriti non deve essere montato');
    }
};
