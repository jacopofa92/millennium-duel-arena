module.exports = {
    name: 'Field Grande Guerra: esplosioni, fumogeno e proiettili restano nella zona centrale',
    async run(t) {
        await t.page.waitForFunction(() => window.FieldAmbience && window.VideoQuality && window.gsap);
        const result = await t.evaluate(async () => {
            // Questo spec prova il percorso DOM/GSAP (il ripiego di js/ui/ambiente-webgl.js).
            window.AMBIENTE_WEBGL_OFF = true;
            VideoQuality.set('alti');
            FieldAmbience.avvia('grandeGuerraCampoDiBattagliaGiorno.jpg');
            FieldAmbience.raffica();
            await new Promise((resolve) => setTimeout(resolve, 1050));
            const valori = (selettore) => Array.from(document.querySelectorAll(selettore), (el) => ({
                left: parseFloat(el.style.left),
                top: parseFloat(el.style.top),
                direzione: el.dataset.direzione
            }));
            return {
                attivo: FieldAmbience.attivo(),
                esplosioni: valori('.fa-guerra-esplosione'),
                fumogeni: valori('.fa-guerra-fumogeno'),
                proiettili: valori('.fa-guerra-proiettile'),
                flash: document.querySelectorAll('.fa-guerra-flash-fronte').length,
                layer: document.querySelectorAll('.fa-guerra-layer').length
                ,proiettiliSenzaDeriva: Array.from(document.querySelectorAll('.fa-guerra-proiettile'))
                    .every((el) => {
                        const transform = getComputedStyle(el).transform;
                        const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
                        return Math.abs(matrix.m41) < .5;
                    })
            };
        });

        t.assert(result.attivo === 'guerra-fronte-diurno' && result.layer === 3,
            'Il field WW1 diurno deve usare la coreografia guerra dedicata');
        t.assert(result.esplosioni.length >= 1 && result.esplosioni.length <= 5
            && result.fumogeni.length >= 1 && result.fumogeni.length <= 4
            && result.proiettili.length >= 4 && result.proiettili.length <= 12
            && result.flash >= 1 && result.flash <= 5,
        'La quantità di esplosioni, fumogeni e proiettili deve restare nei nuovi intervalli casuali');
        t.assert(result.esplosioni.every((p) => p.left >= 20 && p.left <= 80)
            && result.fumogeni.every((p) => p.left >= 25 && p.left <= 75)
            && result.proiettili.every((p) => p.left >= 20 && p.left <= 80),
        'Gli eventi di guerra non devono nascere alle estremità del field');
        t.assert(result.esplosioni.length < 2 || ['basso-alto', 'alto-basso'].every((direzione) =>
            result.esplosioni.some((p) => p.direzione === direzione)),
        'Con almeno due esplosioni devono comparire entrambi i versi verticali');
        t.assert(result.proiettili.length < 2 || ['basso-alto', 'alto-basso'].every((direzione) =>
            result.proiettili.some((p) => p.direzione === direzione)),
        'Con almeno due proiettili devono comparire entrambi i versi verticali');
        t.assert(result.fumogeni.every((p) => ['basso-alto', 'alto-basso'].includes(p.direzione)),
            'Il fumogeno deve derivare lungo uno dei due versi verticali');
        t.assert(result.proiettiliSenzaDeriva,
            'Le scie dei proiettili devono restare sull’asse verticale senza spostamento laterale');

        const notte = await t.evaluate(() => {
            FieldAmbience.avvia('grandeGuerraCampoDiBattagliaNotte.jpg');
            return { attivo: FieldAmbience.attivo(), variante: !!document.querySelector('.fa-variante--guerra-notte') };
        });
        t.assert(notte.attivo === 'guerra-fronte-notturno' && notte.variante,
            'Il field WW1 notturno deve avere la propria variante della stessa coreografia');
    }
};
