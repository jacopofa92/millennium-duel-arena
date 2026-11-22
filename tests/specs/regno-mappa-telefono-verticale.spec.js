// Regno dei Duellanti, mappa dell'isola su telefono in VERTICALE: era "troppo zoomata" (lo sfondo del bosco 1536x1024 a grandezza
// nativa su 390px di larghezza = un quarto dell'immagine) e si scorreva in ogni direzione (il mondo era alto 900px, piu' dello schermo).
// Ora il mondo si rimpicciolisce (scalaMondo): in verticale non si scorre piu', si scorre solo verso destra. Schermi larghi,
// telefono in orizzontale e Castello restano a grandezza vera.
const path = require('path');

module.exports = {
    standalone: true,
    name: 'Regno dei Duellanti: su telefono in verticale la mappa dell\'isola e\' rimpicciolita e non scorre in verticale',
    async run(t) {
        const url = 'file:///' + path.join(__dirname, '..', '..', 'torneo-regno-duellanti.html').replace(/\\/g, '/');
        const misura = async (viewport) => {
            const page = await t.browser.newPage({ viewport, isMobile: true, hasTouch: true });
            const errori = [];
            page.on('pageerror', (e) => errori.push(e.message));
            await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.PAGE_LOADER_SKIP = true; });
            try {
                await page.goto(url);
                await page.waitForFunction(() => !!window.SaveManager);
                await page.evaluate(() => {
                    if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                    SaveManager.setTournamentState('duelistKingdom', {
                        step: 3, stars: 3, difficulty: 'Medio', castleReached: false, eliminated: false, atKaibaGate: false,
                        pendingEncounter: null, scenesShown: { prologue: true }, approdoV2: true,
                        history: [{ kind: 'prize', label: '+1', x: 360, y: 560 }],
                        pendingRoutes: [
                            { kind: 'opponent', characterId: 'mai', x: 590, y: 380 },
                            { kind: 'deadEnd', depth: 2, x: 600, y: 540 },
                            { kind: 'prize', amount: 1, x: 590, y: 700 }
                        ]
                    });
                });
                await page.reload();
                await page.waitForSelector('.map-node.choice');
                const m = await page.evaluate(() => {
                    const v = document.getElementById('mapViewport'), c = document.getElementById('mapCanvas');
                    const scelta = document.querySelector('.map-node.choice').getBoundingClientRect();
                    return { scala: parseFloat(c.dataset.scala), vh: v.clientHeight, sh: v.scrollHeight, vw: v.clientWidth, sw: v.scrollWidth,
                        sceltaDentro: scelta.left >= 0 && scelta.right <= innerWidth && scelta.top >= 0 && scelta.bottom <= innerHeight };
                });
                t.assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
                return m;
            } finally { await page.close(); }
        };

        for (const [w, h] of [[390, 844], [360, 640], [412, 915]]) {
            const m = await misura({ width: w, height: h });
            t.assert(m.scala < 1 && m.scala >= 0.6, `${w}x${h}: il mondo e' rimpicciolito (scala ${m.scala})`);
            t.assert(m.sh <= m.vh + 1, `${w}x${h}: nessuno scorrimento verticale (alto ${m.sh} su ${m.vh})`);
            t.assert(m.sw > m.vw, `${w}x${h}: si scorre ancora verso destra (largo ${m.sw} su ${m.vw})`);
            t.assert(m.sceltaDentro, `${w}x${h}: i bivi sono visibili al primo sguardo`);
        }
        const largo = await misura({ width: 1280, height: 800 });
        t.assert(largo.scala === 1, `schermo largo: grandezza vera (scala ${largo.scala})`);
        const orizzontale = await misura({ width: 844, height: 390 });
        t.assert(orizzontale.scala === 1, `telefono in orizzontale: grandezza vera (scala ${orizzontale.scala})`);
    }
};
