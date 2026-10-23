// WebGL aggiunto in 1.4.70:
//  - la luce del SENTIERO e il faro sulla tappa corrente delle mappe a nodi (js/ui/mappa-percorso-webgl.js): un canvas
//    dentro il mondo, sopra le linee e sotto i nodi, che non intercetta il tocco; assente con Dettagli "Normali";
//    rilasciato quando la mappa viene ridisegnata;
//  - la tempesta attorno alla Torre dei Duellanti (js/ui/torre-ambiente-webgl.js): un canvas sopra la torre, senza
//    toccare il layout, assente con "Normali";
//  - l'aura dell'attivazione a centro schermo e l'energia fra i Link della Catena (fx-webgl-scena.js).
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'WebGL: sentiero e faro sulle mappe, tempesta sulla Torre, aura di attivazione e Catena',
    standalone: true,
    async run({ browser, assert }) {
        const errori = [];
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
        await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true; localStorage.setItem('ygoVideoDetail', 'alti'); localStorage.setItem('ygoVideoDetailScelto', '1'); });
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            // --- Mappe a nodi
            await page.goto(url('storia.html'));
            await page.waitForFunction(() => !!(window.NodeMap && window.MappaPercorsoGL && window.VideoQuality));
            const m = await page.evaluate(async () => {
                const host = document.createElement('div');
                host.style.cssText = 'position:fixed;inset:0;z-index:99999';
                document.body.appendChild(host);
                const nodi = [
                    { id: 'a', x: 200, y: 700, stato: 'fatta', label: 'A' },
                    { id: 'b', x: 500, y: 500, stato: 'fatta', label: 'B' },
                    { id: 'c', x: 900, y: 400, stato: 'corrente', label: 'C' },
                    { id: 'd', x: 1200, y: 300, stato: 'bloccata', label: 'D' }
                ];
                const mondo = NodeMap.render(host, { sfondo: [], larghezza: 1600, altezza: 900, nodi });
                const gl = mondo.querySelector('canvas.nm-percorso-gl');
                const figli = Array.from(mondo.children);
                const out = {
                    acceso: !!gl,
                    tocco: gl ? getComputedStyle(gl).pointerEvents : '',
                    dopoLeLinee: !!gl && figli.indexOf(gl) > figli.findIndex((e) => e.classList && e.classList.contains('nm-lines')),
                    sottoINodi: !!gl && figli.indexOf(gl) < figli.findIndex((e) => e.classList && e.classList.contains('nm-node'))
                };
                await new Promise((r) => setTimeout(r, 400));
                // Ridisegnata: il vecchio canvas si stacca
                NodeMap.render(host, { sfondo: [], larghezza: 1600, altezza: 900, nodi });
                out.vecchioStaccato = !gl.isConnected;
                // Normali: niente
                VideoQuality.set('normali');
                const mondo2 = NodeMap.render(host, { sfondo: [], larghezza: 1600, altezza: 900, nodi });
                out.conNormali = mondo2.querySelectorAll('canvas.nm-percorso-gl').length;
                VideoQuality.set('alti');
                return out;
            });
            assert(m.acceso && m.tocco === 'none' && m.dopoLeLinee && m.sottoINodi, `Sentiero WebGL dentro il mondo, sopra le linee e sotto i nodi: ${JSON.stringify(m)}`);
            assert(m.vecchioStaccato && m.conNormali === 0, `Rilasciato al ridisegno e assente con Normali: ${JSON.stringify(m)}`);

            // --- Torre
            await page.goto(url('index.html'));
            await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Scalatore');
                const stato = SaveManager.getCardAcquisitionState();
                stato.completedChapters = stato.completedChapters || {};
                stato.completedChapters.regno = true;
                SaveManager.setCardAcquisitionState(stato);
            });
            await page.goto(url('torre.html'));
            await page.waitForSelector('.tw');
            await page.waitForTimeout(500);
            const t = await page.evaluate(() => {
                const c = document.querySelector('.tw canvas.tw-ambiente-gl');
                return { acceso: !!c, tocco: c ? getComputedStyle(c).pointerEvents : '', largo: c ? c.getBoundingClientRect().width : 0, tw: document.querySelector('.tw').getBoundingClientRect().width };
            });
            assert(t.acceso && t.tocco === 'none' && Math.abs(t.largo - t.tw) < 2, `Tempesta sopra la torre, senza toccare il layout: ${JSON.stringify(t)}`);
            await page.evaluate(() => { VideoQuality.set('normali'); disegna(); });
            const senza = await page.evaluate(() => document.querySelectorAll('.tw canvas.tw-ambiente-gl').length);
            assert(senza === 0, 'Con Normali la torre non ha il canvas');

            // --- Aura di attivazione e Catena (duello)
            const paginaDuello = await ctx.newPage();
            paginaDuello.on('pageerror', (e) => errori.push(e.message));
            await paginaDuello.goto(url('duelMonstersCore.html'));
            await paginaDuello.waitForFunction(() => typeof gameState !== 'undefined' && gameState.playerHand && gameState.playerHand.length > 0, null, { timeout: 30000 });
            await paginaDuello.waitForFunction(() => !!window.FxWebglScena && !!window.FX && !!window.FxWebgl);
            const d = await paginaDuello.evaluate(async () => {
                window.FX_BACKEND = 'webgl';
                const out = {};
                const carta = cardDatabase.find((c) => c.type === 'trap');
                FX.playActivationAura(carta);
                await new Promise((s) => setTimeout(s, 300));
                out.aura = FxWebgl.attivi();
                await new Promise((s) => setTimeout(s, 2200));
                out.auraFine = FxWebgl.attivi();
                const a = document.createElement('div'); a.style.cssText = 'position:fixed;left:100px;top:300px;width:60px;height:80px';
                const b = document.createElement('div'); b.style.cssText = 'position:fixed;left:100px;top:180px;width:60px;height:80px';
                document.body.append(a, b);
                FX.playChainLink(a, b, 'aggiunta', 'player');
                await new Promise((s) => setTimeout(s, 250));
                out.catena = FxWebgl.attivi();
                await new Promise((s) => setTimeout(s, 1200));
                FX.playChainLink(null, b, 'risolve', 'bot');
                await new Promise((s) => setTimeout(s, 200));
                out.risolve = FxWebgl.attivi();
                a.remove(); b.remove();
                return out;
            });
            assert(d.aura > 0 && d.auraFine === 0, `Aura di attivazione: parte e finisce: ${JSON.stringify(d)}`);
            assert(d.catena > 0 && d.risolve > 0, `Energia fra i Link e lampo alla risoluzione: ${JSON.stringify(d)}`);
            assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
        } finally {
            await ctx.close();
        }
    }
};
