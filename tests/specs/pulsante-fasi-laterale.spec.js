// Pulsante delle fasi (telefono, stile Duel Masters: a destra del campo in ORIZZONTALE, al centro fra campo e mano in VERTICALE; CSS .phase-side-btn in duelMonstersCore.html,
// logica aggiornaPulsanteFasi/toccaPulsanteFasi in game-flow.js):
//  - su un telefono basso in orizzontale la barra delle fasi non si vede e compare un tondo a destra, a meta' altezza,
//    con la fase attuale; fuori dal telefono (desktop) il tondo non c'e' e la barra e' quella di sempre;
//  - con UNA sola fase raggiungibile un tocco la raggiunge, con piu' d'una apre un menu con le scelte;
//  - passa dalle stesse regole della barra (handlePhaseStepperClick): nel primo turno la Battaglia non c'e' fra le scelte.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Pulsante delle fasi: solo telefono (orizzontale e verticale), un tocco o un menu, stesse regole della barra',
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
                    destra: r.left > innerWidth * 0.5
                };
            });
            assert(a.visibile && a.destra, `Il tondo c'e' ed e' a destra: ${JSON.stringify(a)}`);
            assert(Math.abs(a.centroY - a.alto / 2) < 4, `Sta a meta' altezza: ${JSON.stringify(a)}`);
            assert(a.barra === 'hidden', `La barra delle fasi non si vede: ${a.barra}`);
            assert(/M1/i.test(a.label), `Mostra la fase attuale (Main 1): ${a.label}`);

            // Il menu mostra SEMPRE tutte le fasi: attuale evidenziata, raggiungibili accese, le altre grigie e
            // disabilitate. Primo turno: la Battaglia non e' raggiungibile, resta accesa solo "Fine turno".
            await page.tap('#phaseSideBtn');
            await page.waitForFunction(() => !document.getElementById('phaseSideMenu').hidden, null, { timeout: 3000 });
            const stato = () => page.evaluate(() => [...document.querySelectorAll('#phaseSideMenu button')].map((b) => `${b.textContent}:${b.className}${b.disabled ? ':off' : ''}`));
            const primo = await stato();
            assert(primo.length === 6 && primo.includes('Main 1:psm-attuale:off') && primo.includes('Battaglia:psm-spenta:off') && primo.includes('Fine turno:psm-attiva'),
                `Primo turno: sei fasi, Main 1 evidenziata, Battaglia grigia, Fine turno accesa: ${JSON.stringify(primo)}`);
            // Il tondo NON deve coprire nessuna casella (richiesta esplicita dell'utente): sta subito fuori dalla
            // colonna destra del campo, a meta' altezza, e non al bordo dello schermo.
            const pos = await page.evaluate(() => {
                const r = document.getElementById('phaseSideBtn').getBoundingClientRect();
                const caselle = [...document.querySelectorAll('.field-slot')].map((e) => e.getBoundingClientRect()).filter((x) => x.width);
                const tocca = caselle.filter((x) => Math.min(r.right, x.right) - Math.max(r.left, x.left) > 0.5 && Math.min(r.bottom, x.bottom) - Math.max(r.top, x.top) > 0.5).length;
                return { sinistra: r.left, destra: Math.max(...caselle.map((x) => x.right)), tocca, larg: innerWidth };
            });
            assert(pos.tocca === 0, `Il tondo non copre nessuna casella: ${JSON.stringify(pos)}`);
            assert(pos.sinistra >= pos.destra && pos.sinistra - pos.destra < 30 && pos.sinistra < pos.larg - 90, `Il tondo sta subito fuori dal campo, non al bordo dello schermo: ${JSON.stringify(pos)}`);            await page.evaluate(() => { const c = gameState.playerHand[0]; if (c && window.showCardInfo) showCardInfo(c); document.getElementById('cardInfoPanel')?.classList.add('visible'); });
            await page.waitForTimeout(500);
            const box = await page.evaluate(() => { const e = document.querySelector('.card-info-panel'); const r = e.getBoundingClientRect(); const sl = Math.min(...[...document.querySelectorAll('#playerFieldBoard .field-slot')].map((x) => x.getBoundingClientRect().left)); return { destra: r.right, sinistra: r.left, campo: sl, visibile: e.classList.contains('visible') }; });
            assert(box.visibile && box.sinistra < 20 && box.destra <= box.campo, `Il box info sta a sinistra e si ferma prima del campo: ${JSON.stringify(box)}`);
            await page.evaluate(() => document.querySelector('.card-info-panel').classList.remove('visible'));            await page.tap('#phaseSideBtn');
            await page.waitForFunction(() => document.getElementById('phaseSideMenu').hidden, null, { timeout: 3000 });

            // Dal secondo turno: la Battaglia diventa raggiungibile.
            await page.evaluate(() => { gameState.turn = 2; updatePhaseIndicator(); });
            await page.tap('#phaseSideBtn');
            await page.waitForFunction(() => !document.getElementById('phaseSideMenu').hidden, null, { timeout: 3000 });
            const secondo = await stato();
            assert(secondo.includes('Battaglia:psm-attiva') && secondo.includes('Fine turno:psm-attiva') && secondo.includes('Pesca:psm-spenta:off'),
                `Secondo turno: Battaglia e Fine turno accese, Pesca grigia: ${JSON.stringify(secondo)}`);
            // Scegliere Battaglia porta davvero alla Battle Phase e il tondo ne prende il nome.
            await page.tap('#phaseSideMenu button.psm-attiva:has-text("Battaglia")');
            await page.waitForFunction(() => gameState.phase === 'battle', null, { timeout: 8000 });
            await page.waitForTimeout(400);
            const dopo = await page.evaluate(() => ({ label: document.getElementById('phaseSideLabel').textContent, menuChiuso: document.getElementById('phaseSideMenu').hidden }));
            assert(/BAT/i.test(dopo.label) && dopo.menuChiuso, `Ora e' Battaglia e il menu e' chiuso: ${JSON.stringify(dopo)}`);
        } finally {
            await ctx.close();
        }

        // --- telefono in VERTICALE: lo stesso tondo, al centro della fascia fra il campo del giocatore e la sua mano
        for (const [larghezza, altezza] of [[390, 844], [360, 640]]) {
            ({ ctx, page } = await apri({ width: larghezza, height: altezza }, true));
            try {
                const v = await page.evaluate(() => {
                    const b = document.getElementById('phaseSideBtn');
                    const r = b.getBoundingClientRect();
                    const cima = document.getElementById('playerHand').getBoundingClientRect().top;
                    // La fascia comincia sotto la casella piu' bassa che parte sopra la mano.
                    let fondo = 0;
                    document.querySelectorAll('#playerFieldBoard .field-slot').forEach((s) => { const q = s.getBoundingClientRect(); if (q.width && q.top < cima && q.bottom > fondo) fondo = q.bottom; });
                    return {
                        visibile: getComputedStyle(b).display !== 'none' && !b.hidden,
                        barra: getComputedStyle(document.getElementById('phaseStepper')).visibility,
                        cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2), larg: innerWidth,
                        centroFascia: Math.round((fondo + cima) / 2), fascia: Math.round(cima - fondo)
                    };
                });
                assert(v.visibile && v.barra === 'hidden', `${larghezza}: il tondo c'e' e la barra non si vede: ${JSON.stringify(v)}`);
                assert(Math.abs(v.cx - v.larg / 2) < 12, `${larghezza}: il tondo sta al centro in orizzontale: ${JSON.stringify(v)}`);
                assert(Math.abs(v.cy - v.centroFascia) <= 3, `${larghezza}: sta a meta' della fascia fra campo e mano: ${JSON.stringify(v)}`);
                // Il menu si apre in colonna SOPRA il tondo, con tutte le fasi.
                await page.tap('#phaseSideBtn');
                await page.waitForFunction(() => !document.getElementById('phaseSideMenu').hidden, null, { timeout: 3000 });
                const m = await page.evaluate(() => {
                    const menu = document.getElementById('phaseSideMenu').getBoundingClientRect();
                    const b = document.getElementById('phaseSideBtn').getBoundingClientRect();
                    return { voci: document.querySelectorAll('#phaseSideMenu button').length, sopra: menu.bottom <= b.top + 1, dentro: menu.top >= 0 && menu.left >= 0 && menu.right <= innerWidth };
                });
                assert(m.voci === 6 && m.sopra && m.dentro, `${larghezza}: il menu ha sei voci, sta sopra il tondo e dentro lo schermo: ${JSON.stringify(m)}`);
            } finally {
                await ctx.close();
            }
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
