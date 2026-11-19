// Impatto delle Evocazioni di Livello 7+ (js/ui/effects.js, IMPATTO_EPICO): prima la carta si SOLLEVA dal Terreno,
// poi cade, e all'urto scatta il lampo della casella mentre il Terreno e le altre carte di ENTRAMBI i lati
// saltano e oscillano. Il lampo non deve arrivare prima della caduta (il lampo e' la conseguenza dell'urto).
//
// Si misura il movimento vero (proprieta' individuali translate/rotate/scale lette a ogni frame), non solo
// che una classe compaia: un effetto visivo che "c'e'" ma non si muove e' il difetto che questo spec vuole
// prendere. Il percorso dal motore (specialSummon) copre video/convergenza -> rivelazione -> sollevamento -> urto.
module.exports = {
    name: 'Impatto Livello 7+: la carta si solleva, cade, e l\'urto scuote le carte dei due lati',
    async run(t) {
        const prepara = () => t.evaluate(() => {
            const make = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
            const slot = (c, pos = 'attack') => ({ card: c, position: pos, isFaceDown: false });
            gameState.currentPlayer = 'player'; gameState.phase = 'main1'; gameState.turn = 5;
            window.__drago = make(1, 'drago-epico');
            gameState.playerMonsterField = [slot(make(4, 'p1')), slot(window.__drago), slot(make(5, 'p2')), slot(make(6, 'p3'), 'defense'), null];
            gameState.botMonsterField = [slot(make(7, 'b1')), slot(make(8, 'b2')), null, slot(make(9, 'b3')), slot(make(10, 'b4'))];
            gameState.playerSTField = [{ card: make(40, 's1'), isFaceDown: true }, null, null, null, null];
            gameState.botSTField = [null, { card: make(40, 't1'), isFaceDown: true }, null, null, null];
            updateUI();
        });

        // Campiona a ogni frame: quota della carta, momento del lampo, e quali carte si muovono (con che segno di rotazione).
        const campiona = (avvia) => t.page.evaluate((avviaSrc) => new Promise((resolve) => {
            const t0 = performance.now();
            const mossi = new Set(); const lati = new Set();
            let quotaMin = 0; let scalaMax = 1; let lampo = null; let urto = null; let ruotate = 0;
            const osserva = () => {
                const ora = Math.round(performance.now() - t0);
                const carta = findFieldCardElementByUid('drago-epico');
                if (carta) {
                    const cs = getComputedStyle(carta);
                    const y = parseFloat((cs.translate || '0 0').split(' ')[1] || '0') || 0;
                    quotaMin = Math.min(quotaMin, y);
                    scalaMax = Math.max(scalaMax, parseFloat(cs.scale) || 1);
                    // Il lampo e' la classe .impact della casella della carta.
                    if (lampo === null && carta.closest('.field-slot').classList.contains('impact')) lampo = ora;
                }
                document.querySelectorAll('#playerFieldBoard .field-slot, #botFieldBoard .field-slot').forEach((s) => {
                    if (carta && s === carta.closest('.field-slot')) return;
                    const cs = getComputedStyle(s);
                    if (cs.translate && cs.translate !== 'none') {
                        mossi.add(s.dataset.owner + s.dataset.type + s.dataset.index);
                        lati.add(s.dataset.owner);
                        if (cs.rotate && cs.rotate !== 'none') ruotate++;
                    }
                });
                if (urto === null && document.querySelector('.fx-summon-impact-ring')) urto = ora;
                if (ora < 14000 && (urto === null || ora < urto + 1100)) requestAnimationFrame(osserva);
                else resolve({ quotaMin, scalaMax, lampo, urto, mossi: mossi.size, lati: [...lati], ruotate });
            };
            // eslint-disable-next-line no-new-func
            new Function(avviaSrc)();
            requestAnimationFrame(osserva);
        }), avvia);

        // --- 1) La sequenza da sola (percorso della Fusione WebGL: la carta e' gia' sul Terreno) ---
        await prepara();
        const lampo = `() => EventiDuello.emetti('impatto-campo', 'player', 1, 'monster')`;
        const diretto = await campiona(`FX.impattoEvocazione(window.__drago, findFieldCardElementByUid('drago-epico'), ${lampo});`);
        t.assert(diretto.quotaMin <= -14, `La carta deve staccarsi dal Terreno di almeno 14 px (ottenuto ${diretto.quotaMin})`);
        t.assert(diretto.scalaMax > 1.05, `La carta si ingrandisce un poco mentre e' in alto (scala massima ${diretto.scalaMax})`);
        t.assert(diretto.lampo !== null && diretto.lampo >= 450, `Il lampo della casella scatta DOPO la caduta, non appena la carta compare (a ${diretto.lampo} ms)`);
        t.assert(diretto.mossi >= 5, `Le altre carte colpite devono muoversi (${diretto.mossi})`);
        t.assert(diretto.lati.includes('player') && diretto.lati.includes('bot'), `L'urto scuote il campo di ENTRAMBI i giocatori (${diretto.lati.join(',')})`);
        t.assert(diretto.ruotate > 0, 'Le carte oscillano (si inclinano), non traslano soltanto');

        // --- 2) Nessun movimento di troppo: un mostro di Livello 6 non si solleva ne' scuote il campo ---
        await prepara();
        const normale = await campiona(`(function(){ const c = Object.assign({}, window.__drago, { level: 6 }); FX.impattoEvocazione(c, findFieldCardElementByUid('drago-epico'), ${lampo}); })();`);
        t.assert(normale.quotaMin === 0 && normale.mossi === 0, `Sotto il Livello 7 niente sollevamento ne' scossa (${JSON.stringify(normale)})`);

        // --- 3) Dal motore: Special Summon di un Livello 8 (senza filmato) passa da convergenza -> rivelazione -> sollevamento -> urto ---
        await prepara();
        await t.evaluate(() => {
            SaveManager.setSetting('summonVideos', false);
            gameState.playerMonsterField[1] = null;
            updateUI();
        });
        const dalMotore = await campiona(`DuelEngine.actions.specialSummon('player', Object.assign({}, window.__drago), 1, 'attack', 'hand', { faceUp: true });`);
        t.assert(dalMotore.quotaMin <= -14, `Anche dalla Special Summon la carta si solleva prima dell'urto (${dalMotore.quotaMin})`);
        t.assert(dalMotore.lampo !== null && dalMotore.urto !== null, `Dal motore arrivano il lampo e le onde dell'urto (${JSON.stringify(dalMotore)})`);
        t.assert(dalMotore.lampo >= dalMotore.urto - 120 && Math.abs(dalMotore.lampo - dalMotore.urto) < 250,
            `Lampo e onde scattano insieme, all'urto (lampo ${dalMotore.lampo}, onde ${dalMotore.urto})`);
        t.assert(dalMotore.mossi >= 5 && dalMotore.lati.length === 2, `Il campo di entrambi i lati si scuote (${JSON.stringify(dalMotore)})`);
    }
};
