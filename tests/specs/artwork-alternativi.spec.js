// Illustrazioni alternative delle carte (js/data/artwork-alternativi.js).
// =====================================================================
// Quattro cose da sorvegliare, nessuna delle quali dà un errore se si rompe:
//   - il catalogo: ogni file esiste (originale escluso: sarebbe un doppione), ogni `sblocco` è
//     una Sfida vera, e nessuna illustrazione è citata due volte;
//   - lo sblocco: una Sfida completata sblocca le sue illustrazioni UNA volta sola, e lo dice
//     (voce di premio con spiegazione); una Sfida già completata prima vale lo stesso;
//   - la scelta: una bloccata non si può scegliere, una sbloccata cambia il percorso che
//     getCardImagePath/getCardThumbPath danno OVUNQUE, e si può tornare all'originale;
//   - la Cartoteca: il bollino compare, la scheda mostra la fila, una bloccata si vede in
//     anteprima ma il pulsante è spento e dice come si sblocca.
// `standalone`: serve la Cartoteca, non il duello.
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const URL_PAGINA = 'file:///' + RADICE.replace(/\\/g, '/') + '/cartoteca.html';

module.exports = {
    standalone: true,
    name: 'Illustrazioni alternative: catalogo, sblocco dalle Sfide, scelta e scheda della carta',
    async run(t) {
        const page = await t.browser.newPage({ viewport: { width: 1280, height: 900 } });
        const erroriPagina = [];
        page.on('pageerror', (e) => erroriPagina.push(e.message));
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        try {
            await page.goto(URL_PAGINA);
            await page.waitForFunction(() => window.ArtworkAlternativi && window.SaveManager, null, { timeout: 20000 });
            // La Cartoteca non carica il catalogo delle Sfide ne' i premi (non le servono): qui si'.
            await page.addScriptTag({ path: path.join(RADICE, 'js', 'data', 'challenges-db.js') });
            await page.addScriptTag({ path: path.join(RADICE, 'js', 'economy', 'rewards.js') });
            await page.waitForFunction(() => window.Rewards && window.challengesDatabase, null, { timeout: 10000 });
            await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                // Il giocatore vero, non l'amministratore (che le ha tutte).
                if (!window.CloudSync) window.CloudSync = {};
                CloudSync.isAdmin = function () { return false; };
            });

            // --- 1) Il catalogo ----------------------------------------------
            const cat = await page.evaluate(() => {
                const AA = ArtworkAlternativi;
                const idsSfide = new Set(challengesDatabase.map((c) => c.id));
                const problemi = [];
                const viste = new Set();
                const file = [];
                AA.carte().forEach((cardId) => {
                    if (!cardDatabase.some((c) => c.id === cardId)) problemi.push(`carta ${cardId} non esiste`);
                    AA.elenco(cardId).forEach((v, i) => {
                        if (v.n !== i + 1) problemi.push(`${cardId}: i numeri non sono 1..N`);
                        if (!idsSfide.has(v.sblocco)) problemi.push(`${cardId}:${v.n} sblocco "${v.sblocco}" non e' una Sfida`);
                        if (/non disponibile/.test(v.comeSiSblocca)) problemi.push(`${cardId}:${v.n} senza la frase che dice come si sblocca`);
                        const k = cardId + ':' + v.n;
                        if (viste.has(k)) problemi.push('doppione ' + k);
                        viste.add(k);
                        file.push(v.percorso, v.miniatura);
                    });
                });
                return { carte: AA.carte().length, problemi, file };
            });
            t.assert(cat.carte >= 40, `Il catalogo deve avere le 43 carte con alternative (trovate ${cat.carte})`);
            t.assert(cat.problemi.length === 0, 'Catalogo incoerente: ' + cat.problemi.slice(0, 5).join(' | '));
            const mancanti = cat.file.filter((f) => !fs.existsSync(path.join(RADICE, f)));
            t.assert(mancanti.length === 0, `File di illustrazione mancanti: ${mancanti.slice(0, 5).join(', ')}`);

            // --- 2) Lo sblocco dalle Sfide ------------------------------------
            const prima = await page.evaluate(() => {
                const AA = ArtworkAlternativi;
                return {
                    n: AA.numero(1), sbloccate: AA.sbloccate(1), percorso: AA.percorso(1),
                    sceltaBloccata: AA.scegli(1, 1)
                };
            });
            t.assert(prima.n >= 5, `Il Drago Bianco Occhi Blu deve avere varie alternative (${prima.n})`);
            t.assert(prima.sbloccate === 0 && prima.percorso === null, 'Un salvataggio nuovo non ha illustrazioni sbloccate');
            t.assert(prima.sceltaBloccata === false, 'Una illustrazione bloccata non si puo\' scegliere');

            const voceDrago = await page.evaluate(() => ArtworkAlternativi.elenco(1)[0]);
            const sfidaId = voceDrago.sblocco;
            const premio = await page.evaluate((id) => {
                const def = challengesDatabase.find((c) => c.id === id);
                const r1 = Rewards.forChallenge(def).filter((v) => v.icon === '🖼️');
                const r2 = Rewards.forChallenge(def).filter((v) => v.icon === '🖼️');
                return {
                    attese: ArtworkAlternativi.dellaSfida(id).length,
                    prima: r1.map((v) => v.nome + ' | ' + v.rule), seconda: r2.length,
                    anteprima: Rewards.previewChallenge(def).filter((v) => v.icon === '🖼️').length
                };
            }, sfidaId);
            t.assert(premio.attese > 0 && premio.prima.length === premio.attese,
                `La Sfida deve elencare tra i premi OGNI illustrazione che sblocca (attese ${premio.attese}, voci ${premio.prima.length})`);
            t.assert(/illustrazione alternativa/.test(premio.prima[0]) && /Sfida completata/.test(premio.prima[0]),
                'Ogni voce di premio deve dire cosa e perche\': ' + premio.prima[0]);
            t.assert(premio.seconda === 0, 'Riscuotere di nuovo non deve rielencare illustrazioni gia\' sbloccate');
            t.assert(premio.anteprima === premio.attese, 'La pagina Sfide deve mostrare il premio PRIMA di vincerlo');
            t.assert(await page.evaluate(() => ArtworkAlternativi.sbloccata(1, 1)), 'Dopo la Sfida la prima alternativa del Drago Bianco e\' sbloccata');

            // Una Sfida completata PRIMA (senza passare dal premio) vale lo stesso.
            const retroattivo = await page.evaluate(() => {
                const altra = ArtworkAlternativi.elenco(1).find((v) => !v.sbloccata);
                const prima = ArtworkAlternativi.sbloccata(1, altra.n);
                SaveManager.setChallengeProgress(altra.sblocco, { count: 1, completed: true, completedAt: new Date().toISOString() });
                // lo stato e' in cache: lo invalida il salvataggio (SaveManager.onSaved)
                return { prima, dopo: ArtworkAlternativi.sbloccata(1, altra.n) };
            });
            t.assert(retroattivo.prima === false && retroattivo.dopo === true,
                'Una Sfida gia\' completata deve sbloccare le sue illustrazioni anche senza averle riscosse');

            // --- 3) La scelta ---------------------------------------------------
            const scelta = await page.evaluate(() => {
                const AA = ArtworkAlternativi;
                const carta = cardDatabase.find((c) => c.id === 1);
                const ok = AA.scegli(1, 1);
                const dopo = { ok, img: getCardImagePath(carta), thumb: CardRenderer.getCardThumbPath(carta), inUso: AA.elenco(1)[0].inUso };
                AA.scegli(1, 0);
                dopo.ritorno = getCardImagePath(carta);
                return dopo;
            });
            t.assert(scelta.ok && scelta.img === 'images/cards/alt/1-1.jpg' && scelta.thumb === 'images/cards/alt/thumbs/1-1.webp' && scelta.inUso,
                'Scelta un\'illustrazione, la carta la usa dappertutto: ' + JSON.stringify(scelta));
            t.assert(scelta.ritorno === 'images/cards/1.jpg', 'Si deve poter tornare all\'originale');

            // --- 4) La Cartoteca -------------------------------------------------
            await page.waitForFunction(() => document.querySelectorAll('.cartoteca-grid .card:not(.card-skeleton)').length > 0, null, { timeout: 20000 });
            await page.fill('.filter-search input', 'Drago Bianco Occhi Blu');
            // La ricerca ha un ritardo di digitazione: si aspetta la griglia ristretta, non quella di prima.
            await page.waitForFunction(() => { const n = document.querySelectorAll('.cartoteca-grid .card:not(.card-skeleton)').length; return n > 0 && n < 30; }, null, { timeout: 8000 });
            await page.waitForFunction(() => document.querySelectorAll('.cartoteca-grid .card-artwork-badge').length > 0, null, { timeout: 8000 });
            const bollino = await page.evaluate(() => {
                const b = document.querySelector('.cartoteca-grid .card-artwork-badge');
                return { testo: b.textContent, oro: b.dataset.sbloccate, visibile: getComputedStyle(b).display !== 'none' };
            });
            t.assert(bollino.visibile && bollino.oro === 'yes' && /8|7/.test(bollino.testo),
                'Il bollino deve comparire in Cartoteca col numero di alternative e oro se ne hai sbloccate: ' + JSON.stringify(bollino));

            // La scheda: si apre dal bollino/tessera della carta che ha le alternative.
            await page.evaluate(() => {
                const tile = document.querySelector('.cartoteca-grid .card-artwork-badge').closest('.card');
                tile.click();
            });
            await page.waitForSelector('.cd-backdrop.open .cd-artwork');
            const fila = await page.evaluate(() => ({
                thumbs: document.querySelectorAll('.cd-art-thumb').length,
                bloccate: document.querySelectorAll('.cd-art-thumb--bloccata').length,
                inUso: document.querySelectorAll('.cd-art-thumb--in-uso').length
            }));
            t.assert(fila.thumbs === prima.n + 1,
                `La fila deve mostrare l'originale piu' le alternative (miniature: ${fila.thumbs})`);
            t.assert(fila.bloccate >= 1 && fila.inUso === 1, `Le bloccate sono in grigio, una sola e' in uso: ${JSON.stringify(fila)}`);

            // Anteprima di una bloccata: si VEDE, ma non si puo' scegliere e dice come si sblocca.
            await page.evaluate(() => document.querySelector('.cd-art-thumb--bloccata').click());
            const bloccata = await page.evaluate(() => ({
                disabilitato: document.querySelector('.cd-art-usa').disabled,
                testo: document.querySelector('.cd-art-dettaglio').textContent,
                artAnteprima: (document.querySelector('.cd-preview img') || {}).getAttribute && document.querySelector('.cd-preview img').getAttribute('src')
            }));
            t.assert(bloccata.disabilitato && /Come si sblocca/.test(bloccata.testo), 'Una bloccata: pulsante spento e spiegazione: ' + JSON.stringify(bloccata));
            t.assert(/images\/cards\/alt\/1-\d+\.jpg/.test(bloccata.artAnteprima || ''), 'Una bloccata si puo\' vedere in anteprima sulla carta grande: ' + bloccata.artAnteprima);

            // Scegliere una sbloccata dalla scheda.
            await page.evaluate(() => {
                const sbloccata = Array.from(document.querySelectorAll('.cd-art-thumb')).find((b) => b.dataset.n !== '0' && !b.classList.contains('cd-art-thumb--bloccata'));
                sbloccata.click();
            });
            t.assert(await page.evaluate(() => !document.querySelector('.cd-art-usa').disabled), 'Una sbloccata puo\' essere scelta');
            await page.evaluate(() => document.querySelector('.cd-art-usa').click());
            const scelto = await page.evaluate(() => ({ n: ArtworkAlternativi.scelta(1), btn: document.querySelector('.cd-art-usa').textContent, salvato: SaveManager.getSelectedArtwork(1) }));
            t.assert(scelto.n > 0 && scelto.salvato === scelto.n && /In uso/.test(scelto.btn), 'La scelta resta nel salvataggio e il pulsante diventa "In uso": ' + JSON.stringify(scelto));
            // ...e la tessera in griglia cambia illustrazione.
            await page.waitForFunction(() => Array.from(document.querySelectorAll('.cartoteca-grid .card img')).some((i) => /images\/cards\/alt\/thumbs\/1-/.test(i.getAttribute('src') || '')), null, { timeout: 6000 });

            t.assert(erroriPagina.length === 0, 'Nessun errore di pagina: ' + erroriPagina.join(' | '));
        } finally {
            await page.close();
        }
    }
};
