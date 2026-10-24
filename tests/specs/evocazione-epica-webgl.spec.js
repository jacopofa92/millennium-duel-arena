// L'Evocazione epica di Livello 7+ in WebGL (js/ui/evocazione-epica-webgl.js): il backend si registra, lo shader compila per
// ognuno dei sette Attributi, la scena dichiara la sua durata vera (che effects.js usa al posto dei 4 s della versione GSAP),
// toglie tutto quello che crea, e si spegne con "Dettagli video: Normali" (allora vale la versione GSAP di sempre).
const { openDuel, freezeNaturalGameLoop } = require('../helpers/harness');

module.exports = {
    name: 'Evocazione epica WebGL: backend, durata dichiarata, pulizia e ripiego',
    standalone: true,
    async run({ browser, assert }) {
        const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
        const page = await context.newPage();
        try {
            await openDuel(page);
            await freezeNaturalGameLoop(page);

            const r = await page.evaluate(async () => {
                const out = { attributi: {} };
                if (window.VideoQuality) VideoQuality.set('alti');
                out.pronta = !!window.EvocazioneEpicaPronta;
                out.backend = FX.backendFor('playElementalConvergence');
                const slot = document.querySelector('.field-slot[data-owner="player"][data-type="monster"][data-index="0"]');
                for (const attr of ['LUCE', 'OSCURITÀ', 'FUOCO', 'ACQUA', 'VENTO', 'TERRA', 'DIVINO']) {
                    const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && c.level >= 7 && c.attribute === attr);
                    if (!base) { out.attributi[attr] = 'nessuna carta'; continue; }
                    const el = createCardElement({ ...base, uid: 'ee-' + attr });
                    slot.appendChild(el);
                    window.EVOCAZIONE_EPICA_ERRORE = undefined;
                    let durata = null;
                    try { durata = EvocazioneEpica.esegui(el, base, ATTRIBUTE_SUMMON_THEMES_PROVA(attr)); } catch (e) { durata = 'errore: ' + e.message; }
                    const durante = { canvas: document.querySelectorAll('canvas[style*="10052"]').length, barre: document.querySelectorAll('.ee-barra').length };
                    out.attributi[attr] = { durata, durante, errore: window.EVOCAZIONE_EPICA_ERRORE || null };
                    // chiusura anticipata: porta il tempo oltre la fine non e' possibile senza aspettare, quindi si controlla sotto.
                    el.remove();
                    await new Promise((res) => setTimeout(res, 50));
                }
                function ATTRIBUTE_SUMMON_THEMES_PROVA(attr) {
                    return { bright: '#ffffff', mid: 'rgba(247, 215, 116, 0.95)', midSoft: 'rgba(247,215,116,.5)', deep: 'rgba(243, 156, 18, 0.9)', particleColors: ['#fff'] };
                }
                return out;
            });
            assert(r.pronta && r.backend === 'webgl', `con Dettagli Alti e WebGL il backend deve essere attivo: ${JSON.stringify({ p: r.pronta, b: r.backend })}`);
            for (const [attr, v] of Object.entries(r.attributi)) {
                assert(typeof v === 'object' && v.durata === 5200 && !v.errore, `${attr}: durata/errore inattesi ${JSON.stringify(v)}`);
                assert(v.durante.canvas >= 1 && v.durante.barre === 0, `${attr}: la scena deve avere il suo canvas e nessuna banda nera ${JSON.stringify(v.durante)}`);
            }

            // Pulizia: a fine scena (durata + rete di sicurezza) non resta niente.
            await page.waitForFunction(() => !document.querySelector('.ee-barra, .ee-titolo, .ee-apparizione, canvas[style*="10052"]'), null, { timeout: 12000 });

            // Fusione: vortice di materiali + seconda parte dell'Evocazione; il mostro entra (onDone) solo a fine scena, e il motore
            // viene avvisato che la rivelazione c'e' gia' stata (niente secondo effetto di Evocazione).
            const fus = await page.evaluate(async () => {
                if (window.VideoQuality) VideoQuality.set('alti');
                const base = cardDatabase.find((c) => c.type === 'monster' && c.level >= 7 && c.attribute === 'FUOCO');
                const carta = { ...base, uid: 'fus-x' };
                const mat = cardDatabase.filter((c) => c.type === 'monster' && !c.extraDeck).slice(0, 2).map((c, i) => ({ ...c, uid: 'm' + i }));
                let fatto = false; const t0 = performance.now(); let tFatto = 0;
                const durata = FX.playFusionMaterialEffect(mat, carta, 'player', () => { fatto = true; tFatto = performance.now() - t0; });
                await new Promise((r) => setTimeout(r, 2500));
                const meta = { fatto, titolo: !!document.querySelector('.ee-titolo'), cinematica: FX.isCinematicPlaying() };
                await new Promise((r) => setTimeout(r, 4300));
                return { durata, meta, fatto, tFatto, cinematicaDopo: FX.isCinematicPlaying(), rivelata: FX.rivelazioneFusioneFatta(carta), seconda: FX.rivelazioneFusioneFatta(carta) };
            });
            assert(fus.durata === 5200 && !fus.meta.fatto && fus.meta.cinematica, `Fusione WebGL: a meta' scena il mostro non deve essere entrato ${JSON.stringify(fus)}`);
            assert(fus.fatto && fus.tFatto > 4500 && !fus.cinematicaDopo, `Fusione WebGL: a fine scena onDone una volta e cinematica liberata ${JSON.stringify(fus)}`);
            assert(fus.rivelata === true && fus.seconda === false, 'rivelazioneFusioneFatta deve valere una volta sola');

            // Con "Normali" il backend non si attiva: vale la versione di sempre.
            const normali = await page.evaluate(() => { VideoQuality.set('normali'); return { pronta: !!window.EvocazioneEpicaPronta, backend: FX.backendFor('playElementalConvergence') }; });
            assert(!normali.pronta && normali.backend !== 'webgl' || normali.backend === null || normali.backend === 'gsap', `con Dettagli Normali non deve partire il Risveglio: ${JSON.stringify(normali)}`);
            assert(!normali.pronta, 'EvocazioneEpicaPronta deve essere falso con Dettagli Normali');
        } finally {
            await context.close();
        }
    }
};
