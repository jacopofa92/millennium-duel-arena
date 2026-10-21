// La barra delle fasi (richiesta dell'utente, 2026-10-16):
// - il primo pulsante comincia dove comincia la casella Terreno del
//   giocatore e l'ultimo finisce dove finisce il suo Cimitero, su desktop,
//   telefono in verticale e in orizzontale (prima, su telefono, i pulsanti
//   restavano raccolti al centro);
// - le sue luci prendono il colore del campo: due arene di tinta diversa
//   devono dare due colori d'accento diversi.
// Vedi il blocco "BARRA DELLE FASI COL COLORE DEL CAMPO" e le regole mobile
// di .phase-stepper in duelMonstersCore.html.
const { openDuel, freezeNaturalGameLoop } = require('../helpers/harness');

const SCHERMI = [
    { nome: 'desktop', width: 1400, height: 900 },
    { nome: 'verticale', width: 393, height: 852 },
    { nome: 'orizzontale', width: 844, height: 390 }
];

module.exports = {
    name: 'Barra delle fasi: dal Terreno al Cimitero, col colore del campo',
    standalone: true,
    async run({ browser, assert }) {
        for (const schermo of SCHERMI) {
            const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: schermo.width, height: schermo.height } });
            const page = await context.newPage();
            try {
                await openDuel(page);
                await freezeNaturalGameLoop(page);
                // La barra si allinea alla fila dopo il primo render
                // (syncPhaseStepperToFieldWidth): si aspetta che l'abbia
                // fatto, invece di un tempo fisso che sotto carico non basta.
                await page.waitForFunction(() => {
                    const caselle = document.querySelectorAll('#playerFieldBoard .field-row:first-child > .field-slot');
                    const passi = document.querySelectorAll('#phaseStepper .phase-step');
                    if (!caselle.length || !passi.length) return false;
                    const a = caselle[0].getBoundingClientRect().left - passi[0].getBoundingClientRect().left;
                    const b = caselle[caselle.length - 1].getBoundingClientRect().right - passi[passi.length - 1].getBoundingClientRect().right;
                    return Math.abs(a) <= 1.5 && Math.abs(b) <= 1.5;
                }, null, { timeout: 6000 }).catch(() => {});
                const m = await page.evaluate(() => {
                    const r = (e) => e.getBoundingClientRect();
                    const caselle = [...document.querySelector('#playerFieldBoard .field-row').querySelectorAll(':scope > .field-slot')];
                    const passi = [...document.querySelectorAll('#phaseStepper .phase-step')];
                    return {
                        terreno: r(caselle[0]).left, cimitero: r(caselle[caselle.length - 1]).right,
                        primo: r(passi[0]).left, ultimo: r(passi[passi.length - 1]).right
                    };
                });
                assert(Math.abs(m.primo - m.terreno) <= 1.5, `${schermo.nome}: il primo pulsante deve cominciare sulla casella Terreno (${Math.round(m.primo)} contro ${Math.round(m.terreno)})`);
                assert(Math.abs(m.ultimo - m.cimitero) <= 1.5, `${schermo.nome}: l'ultimo pulsante deve finire sul Cimitero (${Math.round(m.ultimo)} contro ${Math.round(m.cimitero)})`);

                if (schermo.nome === 'desktop') {
                    const colori = await page.evaluate(async () => {
                        // Il colore d'accento RISOLTO (non la proprieta' di un pulsante, che con lo stile
                        // attuale puo' non avere sfondo): una sonda colorata con var(--fase-accento).
                        const accento = () => {
                            const barra = document.querySelector('#phaseStepper');
                            const sonda = document.createElement('i');
                            sonda.style.color = 'var(--fase-accento)';
                            barra.appendChild(sonda);
                            const colore = getComputedStyle(sonda).color;
                            sonda.remove();
                            return colore;
                        };
                        const metti = async (file) => {
                            document.body.style.backgroundImage = `url('images/fields/${file}')`;
                            if (window.TintaCampo) window.TintaCampo.applica();
                            await new Promise((ok) => setTimeout(ok, 100));
                            return accento();
                        };
                        return { blu: await metti('dirigibileKaibaCorp.jpg'), rosso: await metti('arenaAnticoEgittoZorc.jpg') };
                    });
                    assert(colori.blu !== colori.rosso, 'Su due campi di tinta diversa la barra deve avere due colori diversi');
                }
            } finally {
                await context.close();
            }
        }
    }
};
