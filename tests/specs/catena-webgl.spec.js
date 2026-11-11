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
            const getUniformLocation = WebGLRenderingContext.prototype.getUniformLocation;
            window.__catenaUniformQueries = 0;
            WebGLRenderingContext.prototype.getUniformLocation = function (...args) {
                if (this.canvas && this.canvas.closest('#catenaGL')) window.__catenaUniformQueries++;
                return getUniformLocation.apply(this, args);
            };
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

            // --- secondo Link: nasce la scena (e con lei il suono audio/standard/activateChain.mp3, una volta sola)
            assert(require('fs').existsSync(path.join(RADICE, 'audio', 'standard', 'activateChain.mp3')), 'Il suono della Catena e\' audio/standard/activateChain.mp3');
            await page.evaluate(() => {
                window.__suoniCatena = 0;
                const orig = SFX.activateChain;
                SFX.activateChain = function (...a) { window.__suoniCatena++; return orig.apply(this, a); };
            });
            // Catena in costruzione (secondo e terzo Link): ancora niente scena ne' suono, vale il pannello di sempre
            await page.evaluate(() => { gameState.chain.links = window.__links.slice(0, 3); renderChainStack(); });
            await page.waitForTimeout(500);
            const costruzione = await page.evaluate(() => ({ scena: CatenaGL.stato(), canvas: document.querySelectorAll('#catenaGL').length, suoni: window.__suoniCatena, pannello: document.getElementById('chainStack').classList.contains('show') }));
            assert(costruzione.scena === null && costruzione.canvas === 0 && costruzione.suoni === 0 && !costruzione.pannello,
                `Mentre la Catena si costruisce niente scena, niente suono e niente pannello (c'e' solo la carta singola): ${JSON.stringify(costruzione)}`);
            // Catena DECISA: parte la prima risoluzione e nasce la scena a tutto schermo, col suono
            await page.evaluate(() => { const l = window.__links[2]; gameState.chain.links = window.__links.slice(0, 2); renderChainStack(l); });
            await page.waitForTimeout(900);
            assert((await page.evaluate(() => window.__suoniCatena)) === 1, 'Il suono della Catena parte una volta quando la scena compare a tutto schermo');
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
                    slotMostro: CatenaGL.stato().slotMostro,
                    ingressi: carte.map((c) => {
                        const dentro = c.querySelector('.cgl-in');
                        const animazione = dentro && dentro.getAnimations().find((a) => a.effect && a.effect.getKeyframes().some((f) => String(f.transform || '').includes('translateY')));
                        return { lato: dentro && dentro.dataset.ingresso, fotogrammi: animazione ? animazione.effect.getKeyframes().map((f) => f.transform || '') : [] };
                    }),
                    pannello: document.getElementById('chainStack').classList.contains('show'),
                    aTutto: root ? root.getBoundingClientRect().width : 0
                };
            });
            assert(due.root && due.canvas && due.carte === 3 && due.cartaVera, `A Catena decisa c'e' la scena con tre carte vere: ${JSON.stringify(due)}`);
            const uniformiPrima = await page.evaluate(() => window.__catenaUniformQueries);
            await page.waitForTimeout(250);
            const uniformiDopo = await page.evaluate(() => window.__catenaUniformQueries);
            assert(uniformiPrima === 13 && uniformiDopo === uniformiPrima,
                `Gli uniformi WebGL si cercano una volta all'avvio e non nel ciclo animato: ${uniformiPrima} -> ${uniformiDopo}`);
            assert(due.slotMostro === 0, `Niente catene lunghe sopra le file Mostro (staccate da ogni carta): ${JSON.stringify(due.slotMostro)}`);
            assert(due.ingressi.some((i) => i.lato === 'dal-basso' && i.fotogrammi.some((f) => f.includes('72vh'))),
                `La carta del giocatore piomba dal basso con prospettiva: ${JSON.stringify(due.ingressi)}`);
            assert(due.numeri.join(',') === '1,2,3', `Le carte portano il numero del loro Link: ${JSON.stringify(due.numeri)}`);
            // Chi ha attivato cosa, scritto sotto ogni carta (il Link 2 e' dell'avversario, il Link 1 e' tuo).
            const chi = await page.evaluate(() => ({
                scritte: Array.from(document.querySelectorAll('#catenaGL .cgl-chi')).map((e) => e.textContent),
                mostraLink2: CatenaGL.mostra(window.__links[1]),
                mostraEstraneo: CatenaGL.mostra({ card: { uid: 'x' }, owner: 'player' })
            }));
            assert(chi.scritte.join(',') === 'TU,AVVERSARIO,TU',`Sotto ogni carta c'e' scritto di chi e': ${JSON.stringify(chi.scritte)}`);
            assert(chi.mostraLink2 === true && chi.mostraEstraneo === false, `La scena sa quali Link sta mostrando: ${JSON.stringify(chi)}`);
            // Il motore NON rifa la carta grande a centro schermo alla risoluzione di un Link che la scena mostra gia'.
            const sorgente = require('fs').readFileSync(path.join(RADICE, 'js', 'engine', 'duel-engine.js'), 'utf8');
            assert(/!\(window\.CatenaGL && window\.CatenaGL\.mostra\(link\)\)\) FX\.playCardActivateCenterScreen\(link\.card\)/.test(sorgente),
                'duel-engine.js: alla risoluzione di un Link mostrato dalla scena non si rifa la carta a centro schermo');
            assert(due.tocco === 'none' && due.zModale > due.zRoot, `La scena non intercetta il tocco e sta sotto i modali (z ${due.zRoot} contro ${due.zModale})`);
            assert(due.errGl === 0 && due.persoGl === false && !due.pannello, `Contesto sano e vecchio pannello spento: ${JSON.stringify(due)}`);

            // --- tre Link, tre carte
            const tre = await page.evaluate(() => CatenaGL.stato());
            assert(tre && tre.voci === 3, `Tre Link, tre carte: ${JSON.stringify(tre)}`);
            const dentro = await page.evaluate(() => Array.from(document.querySelectorAll('#catenaGL .cgl-pos')).every((c) => {
                const r = c.getBoundingClientRect(); return r.left >= -40 && r.top >= -40 && r.right <= innerWidth + 40 && r.bottom <= innerHeight + 40;
            }));
            assert(dentro, 'Le carte stanno dentro lo schermo (900x600)');

            // --- risoluzione: l'ultimo Link passa davanti
            // (la risoluzione e' gia' partita sopra, alla decisione)
            // Catena appena decisa: resta a TUTTO SCHERMO per un momento, poi si fa miniatura
            const decisa = await page.evaluate(() => { const root = document.getElementById('catenaGL'); return { classe: root.classList.contains('cgl-compatta'), larg: Math.round(root.getBoundingClientRect().width), schermo: innerWidth }; });
            assert(!decisa.classe && decisa.larg > decisa.schermo * 0.9, `Appena decisa la Catena resta a tutto schermo: ${JSON.stringify(decisa)}`);
            await page.waitForTimeout(1600);
            const ris =await page.evaluate(() => {
                const carte = Array.from(document.querySelectorAll('#catenaGL .cgl-pos'));
                return carte.map((c) => c.style.zIndex);
            });
            assert(ris.length === 3 && ris[2] === '5', `La carta in risoluzione passa davanti alle altre: ${JSON.stringify(ris)}`);
            // In risoluzione la scena si fa da parte (striscia compatta, niente velo): gli effetti sotto restano visibili.
            await page.waitForTimeout(700);
            const compatta = await page.evaluate(() => {
                const root = document.getElementById('catenaGL');
                // Le carte sono una COLONNA di miniature sul bordo sinistro (il contenitore resta a tutto schermo: se lo si
                // rimpicciolisce le maglie, che lo shader disegna in coordinate di schermo, escono dalle carte).
                const r = Array.from(root.querySelectorAll('.cgl-pos')).filter((c) => getComputedStyle(c).opacity !== '0').map((c) => c.getBoundingClientRect());
                // Il disegno e' quello sfasato della scena piena (zig-zag): le carte NON stanno tutte alla stessa altezza.
                const alture = r.map((b) => Math.round(b.top + b.height / 2));
                return {
                    classe: root.classList.contains('cgl-compatta'), velo: getComputedStyle(root.querySelector('.cgl-buio')).opacity,
                    trasformato: getComputedStyle(root).transform !== 'none', carte: r.length,
                    destraMax: Math.round(Math.max(...r.map((b) => b.right))), schermo: innerWidth,
                    sfasate: new Set(alture).size > 1,
                    piccole: Math.max(...r.map((b) => b.width)) < innerWidth * 0.15,
                    dentro: r.every((b) => b.left >= 0 && b.top >= 0 && b.bottom <= innerHeight)
                };
            });
            assert(compatta.classe && Number(compatta.velo) === 0 && !compatta.trasformato && compatta.carte === 3 && compatta.destraMax < compatta.schermo * 0.5,
                `In risoluzione la scena e' in miniatura a sinistra, senza velo e senza rimpicciolire il contenitore: ${JSON.stringify(compatta)}`);
            assert(compatta.sfasate && compatta.piccole && compatta.dentro, `Le miniature restano sfasate, piccole e dentro lo schermo: ${JSON.stringify(compatta)}`);
            // Una nuova risposta (Link aggiunto, nessuno in risoluzione) la riporta a tutto schermo
            // (nel motore vero un Link aggiunto durante la risoluzione, da un trigger, trova `resolving` gia' acceso)
            await page.evaluate(() => { gameState.chain.resolving = true; gameState.chain.links = window.__links.slice(0, 3); renderChainStack(); });
            await page.waitForTimeout(700);
            const piena = await page.evaluate(() => { const root = document.getElementById('catenaGL'); return { classe: root.classList.contains('cgl-compatta'), larg: Math.round(root.getBoundingClientRect().width), schermo: innerWidth }; });
            assert(!piena.classe && piena.larg > piena.schermo * 0.9, `Con la Catena in costruzione la scena e' a tutto schermo: ${JSON.stringify(piena)}`);
            await page.evaluate(() => { const l = window.__links[2]; gameState.chain.links = window.__links.slice(0, 2); renderChainStack(l); });
            await page.waitForTimeout(300);

            // --- Catena finita: la scena si smonta e il contesto viene rilasciato
            await page.evaluate(() => { gameState.chain = { active: false, links: [] }; renderChainStack(); });
            await page.waitForFunction(() => CatenaGL.stato() === null, null, { timeout: 8000 });
            const fine = await page.evaluate(() => ({ root: document.querySelectorAll('#catenaGL').length, perso: window.__gl.isContextLost() }));
            assert(fine.root === 0 && fine.perso === true, `A Catena finita niente DOM e contesto rilasciato: ${JSON.stringify(fine)}`);

            // --- una Catena nuova subito dopo riparte pulita
            await prep();
            await page.evaluate(() => { const l = window.__links[1]; gameState.chain.links = window.__links.slice(0, 1); renderChainStack(l); });
            await page.waitForTimeout(400);
            const bis = await page.evaluate(() => CatenaGL.stato());
            assert(bis && bis.voci === 2, `Una seconda Catena riparte da capo: ${JSON.stringify(bis)}`);
            const ingressoBot = await page.evaluate(() => Array.from(document.querySelectorAll('#catenaGL .cgl-in')).map((el) => ({
                lato: el.dataset.ingresso,
                fotogrammi: el.getAnimations().flatMap((a) => a.effect ? a.effect.getKeyframes().map((f) => f.transform || '') : [])
            })));
            assert(ingressoBot.some((i) => i.lato === 'dall-alto' && i.fotogrammi.some((f) => f.includes('-72vh'))),
                `La carta dell'avversario piomba dall'alto: ${JSON.stringify(ingressoBot)}`);
            await page.evaluate(() => { gameState.chain = { active: false, links: [] }; renderChainStack(); CatenaGL._subito(); });

            // --- "Normali": vale il pannello di sempre, la scena non nasce
            await page.evaluate(() => VideoQuality.set('normali'));
            await prep();
            // (il pannello compare solo a Catena decisa, cioe' alla prima risoluzione)
            await page.evaluate(() => { gameState.chain.links = window.__links.slice(0, 1); renderChainStack(window.__links[1]); });
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
