// La scena della Catena in WebGL (js/ui/catena-webgl.js, stile Master Duel), agganciata a renderChainStack (game-flow.js):
//  - con Dettagli "Alti" un Link solo NON fa scena (c'e' gia' la sua carta a centro schermo), dal secondo nasce un canvas
//    proprio con le carte del gioco, numerate, e il vecchio pannello resta spento;
//  - la scena non intercetta il tocco e sta SOTTO i modali (la finestra "Rispondere?" deve restare cliccabile);
//  - alla risoluzione la carta in corso passa davanti e la maglia che la regge si spezza; a Catena finita la scena si smonta
//    e il contesto WebGL viene RILASCIATO (su telefono i contesti sono pochi);
//  - con "Normali", col movimento ridotto o spenta a mano vale il pannello di sempre, identico a prima.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Catena WebGL: scena dal secondo Link, sotto i modali, rilasciata a fine Catena; senza WebGL vale il pannello',
    standalone: true,
    async run({ browser, assert }) {
        const errori = [];
        const ctx = await browser.newContext({ viewport: { width: 900, height: 600 }, serviceWorkers: 'block' });
        await ctx.addInitScript(() => {
            window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true;
            localStorage.setItem('ygoVideoDetail', 'alti'); localStorage.setItem('ygoVideoDetailScelto', '1');
        });
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await page.goto(url('duelMonstersCore.html'));
            await page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.playerHand && gameState.playerHand.length > 0 && window.CatenaGL, null, { timeout: 40000 });
            await page.waitForTimeout(2500);

            const prep = () => page.evaluate(() => {
                window.__links = [10, 7, 382].map((id, i) => ({
                    card: { ...cardDatabase.find((c) => c.id === id), uid: 'cgl-' + id }, owner: i % 2 ? 'bot' : 'player', linkNumber: i + 1,
                    // Campi che il motore legge se per caso risolve davvero questa Catena finta (il ciclo del duello gira):
                    // senza, un TypeError in runHandler sporca il test.
                    def: {}, handlerName: 'activate', ctx: {}
                }));
                gameState.chain = { active: true, links: [window.__links[0]] };
                renderChainStack();
                return { pronta: CatenaGL.pronta(), errore: window.CATENA_GL_ERRORE || null };
            });
            const p = await prep();
            assert(p.pronta && !p.errore, `La scena e' pronta con Dettagli Alti e lo shader compila: ${JSON.stringify(p)}`);

            // --- un Link solo: niente scena, e il vecchio pannello resta spento
            const uno = await page.evaluate(() => ({
                scena: CatenaGL.stato(), canvas: document.querySelectorAll('#catenaGL').length,
                pannello: document.getElementById('chainStack').classList.contains('show')
            }));
            assert(uno.scena === null && uno.canvas === 0 && !uno.pannello, `Un Link solo non fa scena e non apre il pannello: ${JSON.stringify(uno)}`);

            // --- secondo Link: nasce la scena
            await page.evaluate(() => { gameState.chain.links = window.__links.slice(0, 2); renderChainStack(); });
            await page.waitForTimeout(900);
            const due = await page.evaluate(() => {
                const root = document.getElementById('catenaGL');
                const canvas = root && root.querySelector('canvas');
                const gl = canvas && canvas.getContext('webgl');
                window.__gl = gl;
                const carte = root ? Array.from(root.querySelectorAll('.cgl-pos')) : [];
                const modale = document.querySelector('.modal-backdrop');
                return {
                    root: !!root, canvas: !!canvas,
                    errGl: gl ? gl.getError() : -1, persoGl: gl ? gl.isContextLost() : null,
                    tocco: root ? getComputedStyle(root).pointerEvents : '',
                    zRoot: root ? Number(getComputedStyle(root).zIndex) : 0,
                    zModale: modale ? Number(getComputedStyle(modale).zIndex) : 0,
                    carte: carte.length,
                    numeri: carte.map((c) => c.querySelector('.cgl-num').textContent),
                    cartaVera: carte.every((c) => !!c.querySelector('.card')),
                    pannello: document.getElementById('chainStack').classList.contains('show'),
                    aTutto: root ? root.getBoundingClientRect().width : 0
                };
            });
            assert(due.root && due.canvas && due.carte === 2 && due.cartaVera, `Dal secondo Link c'e' la scena con due carte vere: ${JSON.stringify(due)}`);
            assert(due.numeri.join(',') === '1,2', `Le carte portano il numero del loro Link: ${JSON.stringify(due.numeri)}`);
            assert(due.tocco === 'none' && due.zModale > due.zRoot, `La scena non intercetta il tocco e sta sotto i modali (z ${due.zRoot} contro ${due.zModale})`);
            assert(due.errGl === 0 && due.persoGl === false && !due.pannello, `Contesto sano e vecchio pannello spento: ${JSON.stringify(due)}`);

            // --- terzo Link: le carte si riposizionano, tre in tutto
            await page.evaluate(() => { gameState.chain.links = window.__links.slice(0, 3); renderChainStack(); });
            await page.waitForTimeout(500);
            const tre = await page.evaluate(() => CatenaGL.stato());
            assert(tre && tre.voci === 3, `Tre Link, tre carte: ${JSON.stringify(tre)}`);
            const dentro = await page.evaluate(() => Array.from(document.querySelectorAll('#catenaGL .cgl-pos')).every((c) => {
                const r = c.getBoundingClientRect(); return r.left >= -40 && r.top >= -40 && r.right <= innerWidth + 40 && r.bottom <= innerHeight + 40;
            }));
            assert(dentro, 'Le carte stanno dentro lo schermo (900x600)');

            // --- risoluzione: l'ultimo Link passa davanti
            await page.evaluate(() => { const l = window.__links[2]; gameState.chain.links = window.__links.slice(0, 2); renderChainStack(l); });
            await page.waitForTimeout(400);
            const ris = await page.evaluate(() => {
                const carte = Array.from(document.querySelectorAll('#catenaGL .cgl-pos'));
                return carte.map((c) => c.style.zIndex);
            });
            assert(ris.length === 3 && ris[2] === '5', `La carta in risoluzione passa davanti alle altre: ${JSON.stringify(ris)}`);

            // --- Catena finita: la scena si smonta e il contesto viene rilasciato
            await page.evaluate(() => { gameState.chain = { active: false, links: [] }; renderChainStack(); });
            await page.waitForFunction(() => CatenaGL.stato() === null, null, { timeout: 8000 });
            const fine = await page.evaluate(() => ({ root: document.querySelectorAll('#catenaGL').length, perso: window.__gl.isContextLost() }));
            assert(fine.root === 0 && fine.perso === true, `A Catena finita niente DOM e contesto rilasciato: ${JSON.stringify(fine)}`);

            // --- una Catena nuova subito dopo riparte pulita
            await prep();
            await page.evaluate(() => { gameState.chain.links = window.__links.slice(0, 2); renderChainStack(); });
            await page.waitForTimeout(400);
            const bis = await page.evaluate(() => CatenaGL.stato());
            assert(bis && bis.voci === 2, `Una seconda Catena riparte da capo: ${JSON.stringify(bis)}`);
            await page.evaluate(() => { gameState.chain = { active: false, links: [] }; renderChainStack(); CatenaGL._subito(); });

            // --- "Normali": vale il pannello di sempre, la scena non nasce
            await page.evaluate(() => VideoQuality.set('normali'));
            await prep();
            await page.evaluate(() => { gameState.chain.links = window.__links.slice(0, 2); renderChainStack(); });
            const normali = await page.evaluate(() => ({
                pronta: CatenaGL.pronta(), scena: CatenaGL.stato(), canvas: document.querySelectorAll('#catenaGL').length,
                pannello: document.getElementById('chainStack').classList.contains('show'),
                voci: document.querySelectorAll('#chainStack .chain-stack-item').length
            }));
            assert(!normali.pronta && normali.scena === null && normali.canvas === 0 && normali.pannello && normali.voci === 2,
                `Con Normali resta il pannello di sempre: ${JSON.stringify(normali)}`);
            await page.evaluate(() => { gameState.chain = { active: false, links: [] }; renderChainStack(); VideoQuality.set('alti'); });

            // --- movimento ridotto: stessa cosa
            await page.emulateMedia({ reducedMotion: 'reduce' });
            const ridotto = await page.evaluate(() => CatenaGL.pronta());
            assert(ridotto === false, 'Con il movimento ridotto la scena non parte');
            await page.emulateMedia({ reducedMotion: 'no-preference' });
            assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
        } finally {
            await ctx.close();
        }
    }
};
