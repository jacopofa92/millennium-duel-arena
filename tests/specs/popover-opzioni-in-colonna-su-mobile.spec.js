// La scelta fra opzioni con etichetta (openOptionPicker: per esempio "Chi affronti in questo turno?" del Tag Team): su un
// telefono in verticale due opzioni affiancate diventavano due ovali stretti con il testo su sei righe (visto sul telefono vero).
// Ora, in verticale e sotto i 620 px, vanno una sotto l'altra a tutta larghezza; su schermo largo restano affiancate.
const path = require('path');
const { waitForOpeningCascade } = require('../helpers/harness');

const RADICE = path.join(__dirname, '..', '..');
const DUELLO = 'file:///' + path.join(RADICE, 'duelMonstersCore.html').replace(/\\/g, '/');

module.exports = {
    standalone: true,
    name: 'Scelta fra opzioni: in colonna sul telefono in verticale, affiancate su schermo largo',
    async run(t) {
        const prova = async (larghezza, altezza, touch) => {
            const ctx = await t.browser.newContext({ viewport: { width: larghezza, height: altezza }, hasTouch: touch, isMobile: touch });
            const page = await ctx.newPage();
            const errori = [];
            page.on('pageerror', (e) => errori.push(e.message));
            await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true; });
            try {
                await page.goto(DUELLO);
                try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
                await page.waitForFunction(() => typeof gameState !== 'undefined' && window.Decisioni && gameState.playerHand && gameState.playerHand.length > 0, null, { timeout: 30000 });
                await waitForOpeningCascade(page);
                await page.evaluate(() => {
                    Decisioni.chiedi({
                        chi: 'player', tipo: 'opzioni', titolo: 'Chi affronti in questo turno?',
                        candidati: [
                            { value: 0, label: 'Seto Kaiba · ❤ 8000 · 1 mostri · ✋ 3', icon: '⚔️' },
                            { value: 1, label: 'Maximillion Pegasus · ❤ 8000 · 0 mostri · ✋ 5 · non ha ancora giocato: niente attacchi', icon: '⏳' }
                        ]
                    }, () => {});
                });
                await page.waitForSelector('#quickPopover .quick-popover-option', { timeout: 5000 });
                await page.waitForTimeout(300);
                const m = await page.evaluate(() => {
                    const pop = document.getElementById('quickPopover').getBoundingClientRect();
                    const b = Array.from(document.querySelectorAll('#quickPopover .quick-popover-option')).map((x) => { const r = x.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, raggio: getComputedStyle(x).borderTopLeftRadius }; });
                    return { pop: { l: pop.left, r: pop.right, w: pop.width }, b, dentro: pop.left >= 0 && pop.right <= innerWidth && pop.bottom <= innerHeight };
                });
                t.assert(errori.length === 0, 'Errori nella pagina: ' + errori.join(' | '));
                return m;
            } finally {
                await ctx.close();
            }
        };

        const telefono = await prova(390, 844, true);
        t.assert(telefono.b.length === 2 && telefono.b[1].t >= telefono.b[0].b - 1, 'Telefono in verticale: la seconda opzione sta SOTTO la prima: ' + JSON.stringify(telefono.b));
        t.assert(telefono.b.every((x) => x.w > telefono.pop.w * 0.8), 'Telefono in verticale: ogni opzione e\' a tutta larghezza: ' + JSON.stringify(telefono));
        t.assert(telefono.b.every((x) => parseFloat(x.raggio) < 30) && telefono.dentro, 'Telefono in verticale: niente ovali e il riquadro sta nello schermo: ' + JSON.stringify(telefono));

        const largo = await prova(1400, 900, false);
        // Dal rifacimento del 2026-11-07 le voci sono pulsanti larghi UNO SOTTO L'ALTRO a ogni larghezza (con numero e freccia): le
        // opzioni affiancate sono rimaste solo per le liste lunghe (7 o piu' voci, a due colonne).
        t.assert(largo.b.length === 2 && largo.b[1].t >= largo.b[0].b - 1 && Math.abs(largo.b[1].l - largo.b[0].l) < 4, 'Schermo largo: le due opzioni stanno una sotto l\'altra: ' + JSON.stringify(largo.b));
    }
};
