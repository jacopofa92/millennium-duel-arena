module.exports = {
    name: 'Ambienti field: firme visive distinte e pulizia al cambio arena',
    async run(t) {
        await t.page.waitForFunction(() => window.FieldAmbience && window.VideoQuality && window.gsap);
        const result = await t.evaluate(() => {
            // Questo spec prova il percorso DOM/GSAP (il ripiego di js/ui/ambiente-webgl.js).
            window.AMBIENTE_WEBGL_OFF = true;
            VideoQuality.set('alti');
            const prova = (field, classe) => {
                FieldAmbience.avvia(field);
                return !!document.querySelector('.' + classe);
            };
            const firme = [
                prova('campoForesta.jpg', 'fa-firma-lucciole'),
                prova('campoPrato.jpg', 'fa-firma-pollini'),
                prova('torreCastelloPegasus.jpg', 'fa-firma-petali'),
                prova('campoGhiaccio.jpg', 'fa-firma-cristalli'),
                prova('campoAcquatico.jpg', 'fa-firma-onde'),
                prova('arenaCastelloPegasus.jpg', 'fa-firma-fiamme'),
                prova('torreDeiDuelliShadow.jpg', 'fa-firma-vortice'),
                prova('mondoVirtualeArenaGozaburo.jpg', 'fa-firma-scariche')
            ];
            FieldAmbience.avvia('campoForesta.jpg');
            const prima = document.querySelectorAll('.fa-firma-lucciole').length;
            FieldAmbience.avvia('campoPrato.jpg');
            const vecchiaDopoCambio = document.querySelectorAll('.fa-firma-lucciole').length;
            const nuovaDopoCambio = document.querySelectorAll('.fa-firma-pollini').length;
            FieldAmbience.avvia('dirigibileKaibaCorp.jpg');
            const dirigibile = FieldAmbience.AMBIENTI.find((a) => a.campi.includes('dirigibileKaibaCorp.jpg'));
            const ventoProcedurale = Array.from(document.querySelectorAll('.fa-vento-correnti, .fa-vento-nube'))
                .every((el) => /^url\(/.test(el.style.getPropertyValue('--fa-vento-textura')));
            const tramaForesta = (() => {
                FieldAmbience.avvia('campoForesta.jpg');
                const el = document.querySelector('.fa-atmo-moti, .fa-firma-lucciole');
                return !!el && /^url\(/.test(el.style.getPropertyValue('--fa-trama-organica'));
            })();
            VideoQuality.set('normali');
            return {
                firme,
                prima,
                vecchiaDopoCambio,
                nuovaDopoCambio,
                dirigibile: dirigibile && { coreografia: dirigibile.coreografia, ritmo: dirigibile.ritmoCasuale },
                ventoProcedurale,
                tramaForesta,
                residui: document.querySelectorAll('[class*="fa-firma-"]').length
            };
        });

        t.assert(result.firme.every(Boolean),
            'Ogni famiglia campione deve montare la firma specifica del proprio luogo');
        t.assert(result.prima === 1 && result.vecchiaDopoCambio === 0 && result.nuovaDopoCambio === 1,
            'Cambiare field deve rimuovere la firma precedente e montare solo quella nuova');
        t.assert(result.dirigibile && result.dirigibile.coreografia === 'ventoContinuo'
            && result.dirigibile.ritmo === 'vento-continuo' && result.ventoProcedurale,
        'Il Dirigibile deve usare vento procedurale continuo, non una passata lineare intermittente');
        t.assert(result.tramaForesta,
            'Gli ambienti organici devono generare particelle canvas non allineate a ogni ingresso nel field');
        t.assert(result.residui === 0,
            'Dettagli Normali deve eliminare anche tutti gli accenti specifici aggiunti');
    }
};
