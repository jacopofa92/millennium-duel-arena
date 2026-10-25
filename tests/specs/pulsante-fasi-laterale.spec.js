// Pulsante laterale delle fasi (telefono in ORIZZONTALE, stile Duel Masters; CSS .phase-side-btn in duelMonstersCore.html,
// logica aggiornaPulsanteFasi/toccaPulsanteFasi in game-flow.js):
//  - su un telefono basso in orizzontale la barra delle fasi non si vede e compare un tondo a destra, a meta' altezza,
//    con la fase attuale; fuori da quel caso (desktop, verticale) il tondo non c'e' e la barra e' quella di sempre;
//  - con UNA sola fase raggiungibile un tocco la raggiunge, con piu' d'una apre un menu con le scelte;
//  - passa dalle stesse regole della barra (handlePhaseStepperClick): nel primo turno la Battaglia non c'e' fra le scelte.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Pulsante laterale delle fasi: solo telefono in orizzontale, un tocco o un menu, stesse regole della barra',
    standalone: true,
    async run({ browser, assert }) {
        const errori = [];
        const apri = async (viewport, touch) => {
            const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, serviceWorkers: 'block' });
            await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true; });
            const page = await ctx.newPage();
            page.on('pageerror', (e) => errori.push(e.message));
            await page.goto(url('duelMonstersCore.html'));
            await page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.playerHand && gameState.playerHand.length > 0 && gameState.phase === 'main1' && gameState.currentPlayer === 'player', null, { timeout: 40000 });
            await page.waitForTimeout(800);
            return { ctx, page };
        };

        // --- telefono in orizzontale
        let { ctx, page } = await apri({ width: 891, height: 411 }, true);
        try {
            const a = await page.evaluate(() => {
                const b = document.getElementById('phaseSideBtn');
                const r = b.getBoundingClientRect();
                return {
                    visibile: getComputedStyle(b).display !== 'none' && !b.hidden,
                    label: document.getElementById('phaseSideLabel').textContent,
                    centroY: Math.round(r.top + r.height / 2), alto: innerHeight,
                    barra: getComputedStyle(document.getElementById('phaseStepper')).visibility,
                    destra: r.left > innerWidth * 0.8
                };
            });
            assert(a.visibile && a.destra, `Il tondo c'e' ed e' a destra: ${JSON.stringify(a)}`);
            assert(Math.abs(a.centroY - a.alto / 2) < 4, `Sta a meta' altezza: ${JSON.stringify(a)}`);
            assert(a.barra === 'hidden', `La barra delle fasi non si vede: ${a.barra}`);
            assert(/M1/i.test(a.label), `Mostra la fase attuale (Main 1): ${a.label}`);

            // Primo turno: la Battaglia non e' raggiungibile, resta solo "Fine turno" -> un tocco diretto, nessun menu.
            const primo = await page.evaluate(() => ({ turno: gameState.turn, raggiungibili: [...document.querySelectorAll('#phaseStepper .clickable')].map((e) => e.dataset.phase) }));
            assert(primo.turno === 1 && primo.raggiungibili.join() === 'end', `Primo turno: solo Fine turno: ${JSON.stringify(primo)}`);

            // Dal secondo turno: Battaglia e Fine turno -> il tocco apre il menu con le due scelte.
            await page.evaluate(() => { gameState.turn = 2; updatePhaseIndicator(); });
            await page.tap('#phaseSideBtn');
            await page.waitForFunction(() => !document.getElementById('phaseSideMenu').hidden, null, { timeout: 3000 });
            const voci = await page.evaluate(() => [...document.querySelectorAll('#phaseSideMenu button')].map((b) => b.textContent));
            assert(voci.join('|') === 'Battaglia|Fine turno', `Il menu offre Battaglia e Fine turno: ${JSON.stringify(voci)}`);

            // Scegliere Battaglia porta davvero alla Battle Phase e il tondo ne prende il nome.
            await page.tap('#phaseSideMenu button:first-child');
            await page.waitForFunction(() => gameState.phase === 'battle', null, { timeout: 8000 });
            await page.waitForTimeout(400);
            const dopo = await page.evaluate(() => ({ label: document.getElementById('phaseSideLabel').textContent, menuChiuso: document.getElementById('phaseSideMenu').hidden }));
            assert(/BAT/i.test(dopo.label) && dopo.menuChiuso, `Ora e' Battaglia e il menu e' chiuso: ${JSON.stringify(dopo)}`);
        } finally {
            await ctx.close();
        }

        // --- desktop: niente tondo, la barra e' quella di sempre
        ({ ctx, page } = await apri({ width: 1440, height: 900 }, false));
        try {
            const d = await page.evaluate(() => ({
                tondo: getComputedStyle(document.getElementById('phaseSideBtn')).display,
                barra: getComputedStyle(document.getElementById('phaseStepper')).visibility
            }));
            assert(d.tondo === 'none' && d.barra === 'visible', `Su desktop non c'e' il tondo e la barra si vede: ${JSON.stringify(d)}`);
        } finally {
            await ctx.close();
        }
        assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
    }
};
