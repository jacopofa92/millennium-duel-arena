module.exports = {
    name: 'Industria KaibaCorp: grappoli casuali di scintille sui macchinari',
    async run(t) {
        await t.page.waitForFunction(() => window.FieldAmbience && window.VideoQuality && window.gsap);
        const result = await t.evaluate(async () => {
            // Questo spec prova il percorso DOM/GSAP (il ripiego di js/ui/ambiente-webgl.js).
            window.AMBIENTE_WEBGL_OFF = true;
            VideoQuality.set('alti');
            FieldAmbience.avvia('industriaKaibaCorp.jpg');
            FieldAmbience.raffica();
            await new Promise((resolve) => setTimeout(resolve, 220));
            const scintille = Array.from(document.querySelectorAll('.fa-industria-scintilla'));
            return {
                attivo: FieldAmbience.attivo(),
                quante: scintille.length,
                posizioni: new Set(scintille.map((el) => el.style.left + '/' + el.style.top)).size,
                angoli: scintille.every((el) => el.style.getPropertyValue('--fa-spark-angle').endsWith('deg')),
                scansione: !!document.querySelector('.fa-tech-griglia')
            };
        });
        t.assert(result.attivo === 'industria-scariche' && result.scansione,
            'L’Industria deve conservare la scansione tecnologica e usare il profilo dedicato');
        t.assert(result.quante >= 4 && result.quante <= 24 && result.posizioni >= 2 && result.angoli,
            'Le scintille devono formare più grappoli casuali con inclinazioni proprie');
    }
};
