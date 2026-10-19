// Ogni field selezionabile deve avere un ambiente proprio. Il catalogo
// visuale puo' riusare profili/coreografie, ma non lasciare immagini senza
// configurazione e deve spegnersi immediatamente con Dettagli Normali.
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'Ambienti field: copertura completa, configurazioni univoche e spegnimento dal menu',
    async run(t) {
        const arenaSource = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'data', 'arena-options.js'), 'utf8');
        const fieldsBlock = arenaSource.match(/const FIELDS = \[([\s\S]*?)\n    \];/);
        t.assert(!!fieldsBlock, 'Il catalogo ArenaOptions.FIELDS deve essere leggibile dal guardrail');
        const catalogo = Array.from(fieldsBlock[1].matchAll(/file:\s*'([^']+)'/g), (m) => m[1]).sort();

        await t.page.waitForFunction(() => window.FieldAmbience && window.VideoQuality && window.gsap, null, { timeout: 12000 });
        const result = await t.evaluate((catalogoAtteso) => {
            const catalogo = catalogoAtteso;
            const ambienti = FieldAmbience.AMBIENTI;
            const coperti = ambienti.flatMap((a) => a.campi).sort();
            const nomi = ambienti.map((a) => a.nome);

            // Questo spec prova il percorso DOM/GSAP (il ripiego di js/ui/ambiente-webgl.js).
            window.AMBIENTE_WEBGL_OFF = true;
            VideoQuality.set('alti');
            const avviato = FieldAmbience.avvia('campoAcquatico.jpg');
            FieldAmbience.raffica();
            const attivoAlto = FieldAmbience.attivo();
            const stratiAlti = document.querySelectorAll('.fa-strato').length;
            VideoQuality.set('normali');
            const attivoNormale = FieldAmbience.attivo();
            const stratiNormali = document.querySelectorAll('.fa-strato').length;
            return {
                catalogo, coperti,
                quantiAmbienti: ambienti.length,
                nomiUnici: new Set(nomi).size,
                campiUnici: new Set(coperti).size,
                avviato, attivoAlto, stratiAlti, attivoNormale, stratiNormali
            };
        }, catalogo);

        t.assert(JSON.stringify(result.catalogo) === JSON.stringify(result.coperti),
            'I file coperti dagli ambienti devono coincidere esattamente con ArenaOptions.FIELDS');
        t.assert(result.quantiAmbienti === result.catalogo.length
            && result.nomiUnici === result.catalogo.length
            && result.campiUnici === result.catalogo.length,
        'Ogni field deve avere una singola configurazione ambientale con nome univoco');
        t.assert(result.avviato && result.attivoAlto === 'acqua-caustiche' && result.stratiAlti >= 2,
            'Con Dettagli Alti il field acquatico deve creare il proprio ambiente');
        t.assert(result.attivoNormale === null && result.stratiNormali === 0,
            'Passando a Dettagli Normali ambiente, strati e timer devono spegnersi subito');
    }
};
