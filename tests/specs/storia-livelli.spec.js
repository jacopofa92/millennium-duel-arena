// I livelli della Storia: Facile, poi Normale e Difficile.
// =====================================================================
// Ogni campagna (tranne la Grande Guerra, i cui mazzi sono congelati) si
// gioca a tre livelli, ognuno col suo avanzamento. All'inizio c'è solo
// Facile; finita la storia a Facile si aprono Normale e Difficile — e
// restano aperti anche ricominciando Facile. La difficoltà di ogni duello
// è quella del livello, non quella scritta sulla tappa.
//
// Si controlla anche l'arco finale della Storia anime, dove mancava lo
// scontro col Re dei Ladri: il Faraone deve affrontare Bakura prima del
// Duello Cerimoniale, e il Cerimoniale lo gioca Yugi Muto.
//
// `standalone`: la Storia vive su una pagina sua.
const path = require('path');
const { liberaLaPagina } = require('../helpers/harness.js');

module.exports = {
    standalone: true,
    name: 'Storia: Facile all\'inizio, Normale e Difficile a storia finita (non per la Grande Guerra)',
    async run(t) {
        const RADICE = path.join(__dirname, '..', '..');
        const url = (q) => 'file:///' + path.join(RADICE, 'storia.html').replace(/\\/g, '/') + (q || '');
        const page = await t.browser.newPage({ viewport: { width: 1280, height: 900 } });
        const erroriPagina = [];
        page.on('pageerror', (e) => erroriPagina.push(e.message));
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });

        const livelliSulloSchermo = () => page.evaluate(() => ({
            visibile: !document.getElementById('livelliMount').hidden,
            pulsanti: [...document.querySelectorAll('#livelliMount .livello')].map((b) => ({
                testo: b.textContent, attivo: b.classList.contains('livello--attivo'), spento: b.disabled
            }))
        }));
        const difficoltaDuello = () => page.evaluate(() => {
            const area = StoryProgress.getTappaCorrente('anime');
            const duello = StoryProgress.getProveConStato('anime', area.id).find((p) => p.kind === 'duel');
            return new URLSearchParams(StoryProgress.urlDuello('anime', duello).split('?')[1]).get('difficulty');
        });

        try {
            await page.goto(url('?campaign=anime'));
            await page.waitForFunction(() => !!(window.StoryProgress && window.SaveManager), null, { timeout: 25000 });
            await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                ['anime', 'anime@normale', 'anime@difficile', 'anime@livello'].forEach((k) => SaveManager.setStoryState(k, null));
            });
            await page.reload();
            await page.waitForSelector('.nm-node', { timeout: 20000 });

            // --- All'inizio solo Facile ------------------------------------
            const inizio = await livelliSulloSchermo();
            t.assert(inizio.visibile && inizio.pulsanti.length === 3, `Tre livelli sulla mappa della campagna: ${JSON.stringify(inizio)}`);
            t.assert(inizio.pulsanti[0].attivo && inizio.pulsanti[1].spento && inizio.pulsanti[2].spento
                && /🔒/.test(inizio.pulsanti[1].testo) && /🔒/.test(inizio.pulsanti[2].testo),
                `All'inizio si gioca a Facile, e Normale/Difficile sono chiusi: ${JSON.stringify(inizio.pulsanti)}`);
            t.assert(await difficoltaDuello() === 'Facile', 'A Facile ogni duello è Facile');
            t.assert(await page.evaluate(() => !StoryProgress.setLivelloAttivo('anime', 'normale')),
                'Un livello chiuso non si può scegliere nemmeno chiamando la funzione');

            // --- Finita la storia a Facile si apre il resto ----------------
            await page.evaluate(() => StoryProgress.forzaAvanzamento('anime', StoryProgress.getTappe('anime').length));
            await page.reload();
            await page.waitForSelector('.nm-node', { timeout: 20000 });
            const aperti = await livelliSulloSchermo();
            t.assert(!aperti.pulsanti[1].spento && !aperti.pulsanti[2].spento && /✓/.test(aperti.pulsanti[0].testo),
                `Finita Facile, Normale e Difficile si aprono: ${JSON.stringify(aperti.pulsanti)}`);

            // Finire la storia paga carte: al ricaricamento compare il
            // riquadro "Carta ottenuta", e c'è ancora la schermata di
            // caricamento. Entrambi stanno sopra la pagina e si prendono il
            // click (vedi liberaLaPagina in tests/helpers/harness.js).
            await liberaLaPagina(page);
            await page.evaluate(() => { const t = document.getElementById('mappaToggle'); if (t && t.getAttribute('aria-expanded') !== 'true') t.click(); });   // il pannello delle informazioni parte chiuso (1.4.172)
    await page.locator('#livelliMount .livello', { hasText: 'Normale' }).click();
            await page.waitForTimeout(300);
            const normale = await page.evaluate(() => ({
                attivo: StoryProgress.getLivelloAttivo('anime'),
                completate: StoryProgress.getProgress('anime').completate,
                facileFinita: !!(SaveManager.getStoryState('anime') || {}).finita
            }));
            t.assert(normale.attivo === 'normale' && normale.completate === 0 && normale.facileFinita,
                `Normale è una partita nuova, e Facile resta finita: ${JSON.stringify(normale)}`);
            t.assert(await difficoltaDuello() === 'Medio', 'A Normale ogni duello è alla difficoltà Normale');

            // Ricominciare Facile non richiude gli altri livelli. Il segno di
            // sblocco si scrive finendo la storia GIOCANDO (avanza), non
            // forzandola: si porta quindi la campagna all'ultima area e la
            // si chiude davvero, prova per prova.
            const sbloccoPermanente = await page.evaluate(() => {
                ['anime', 'anime@livello'].forEach((k) => SaveManager.setStoryState(k, null));
                StoryProgress.forzaAvanzamento('anime', StoryProgress.getTappe('anime').length - 1);
                const ultima = StoryProgress.getTappaCorrente('anime');
                const prove = StoryProgress.getProveConStato('anime', ultima.id);
                for (let i = 0; i < prove.length; i++) StoryProgress.avanzaTorneo('anime', ultima.id);
                StoryProgress.ricomincia('anime');
                return StoryProgress.livelloSbloccato('anime', 'difficile');
            });
            t.assert(sbloccoPermanente, 'Finita la storia a Facile, ricominciarla non deve richiudere Normale e Difficile');

            // --- Le Sfide dei livelli avanzano su QUESTA pagina ------------
            // È storia.html a far salire la campagna, quindi è qui che il
            // tracker delle Sfide deve esserci: per un periodo non era
            // caricato, e nessuna Sfida delle storie poteva avanzare.
            // Si finisce una partita a Normale giocando l'ultima area.
            const sfideLivelli = await page.evaluate(() => {
                const presente = !!window.ChallengeTracker;
                StoryProgress.setLivelloAttivo('anime', 'normale');
                StoryProgress.forzaAvanzamento('anime', StoryProgress.getTappe('anime').length - 1);
                const ultima = StoryProgress.getTappaCorrente('anime');
                const prove = StoryProgress.getProveConStato('anime', ultima.id);
                for (let i = 0; i < prove.length; i++) StoryProgress.avanzaTorneo('anime', ultima.id);
                return {
                    presente,
                    normale: SaveManager.getChallengeProgress('storia-anime-normale').completed,
                    difficile: SaveManager.getChallengeProgress('storia-anime-difficile').completed
                };
            });
            t.assert(sfideLivelli.presente, 'storia.html deve caricare il tracker delle Sfide: è qui che la Storia avanza');
            t.assert(sfideLivelli.normale && !sfideLivelli.difficile,
                `Finire a Normale completa la Sfida "Normale" e non quella "Difficile": ${JSON.stringify(sfideLivelli)}`);

            // --- La Grande Guerra non ha livelli ----------------------------
            await page.goto(url('?campaign=ww1'));
            await page.waitForSelector('.nm-node', { timeout: 20000 });
            const ww1 = await livelliSulloSchermo();
            t.assert(!ww1.visibile && ww1.pulsanti.length === 0, `La Grande Guerra non mostra livelli: ${JSON.stringify(ww1)}`);

            // --- L'arco finale: il Re dei Ladri prima del Cerimoniale -------
            const arco = await page.evaluate(() => {
                const area = StoryProgress.getTappe('anime').find((x) => x.id === 'anime-area-cerimoniale');
                const prove = area.tappe;
                const iBakura = prove.findIndex((p) => p.kind === 'duel' && p.characterId === 'bakura');
                const iCerimoniale = prove.findIndex((p) => p.id === 'anime-5-yamiyugi');
                return {
                    iBakura, iCerimoniale,
                    protagonistaCerimoniale: (prove[iCerimoniale].protagonista || {}).name
                };
            });
            t.assert(arco.iBakura !== -1 && arco.iBakura < arco.iCerimoniale,
                `Nel Mondo dei Ricordi il Faraone affronta Bakura prima del Duello Cerimoniale: ${JSON.stringify(arco)}`);
            t.assert(arco.protagonistaCerimoniale === 'Yugi Muto',
                `Il Duello Cerimoniale lo gioca Yugi Muto, non il Faraone: ${JSON.stringify(arco)}`);

            t.assert(erroriPagina.length === 0, 'Errori JS in pagina: ' + erroriPagina.join(' | '));
        } finally {
            await page.close();
        }
    }
};
