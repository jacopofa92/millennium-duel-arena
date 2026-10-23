// In una campagna non si duella come sé stessi.
// =====================================================================
// Richiesta esplicita: nel Regno delle Ombre e in Memorie Proibite il
// ritratto è quello di Yami Yugi (col nome "Atem" nella seconda, che è
// il nome vero del Faraone), in Freedom è Giacobbo, nella Grande Guerra
// è la bandiera italiana. Il campo è `protagonista` sulla campagna, e lo
// legge js/duel-session.js.
//
// Due cose si rompono in silenzio, ed è per quelle che questo test
// esiste:
//   1) il ritratto punta a un file che non c'è — non si vede alcun
//      errore, compare l'emoji di ripiego e sembra una scelta;
//   2) duelMonstersCore.html smette di caricare js/data/story-campaigns.js
//      (una riga in una lista di trenta script): il protagonista svanisce
//      e il duello torna a chiamarti "Giocatore" senza che nulla segnali
//      niente.
//
// `standalone`: servono più caricamenti della pagina del duello con URL
// diversi, non la partita già aperta che l'harness prepara.
const path = require('path');

module.exports = {
    name: 'Storia: in una campagna il giocatore è il protagonista di quella storia',
    standalone: true,
    async run({ browser, assert }) {
        const RADICE = path.join(__dirname, '..', '..');
        const base = 'file:///' + RADICE.replace(/\\/g, '/') + '/';
        const context = await browser.newContext({
            viewport: { width: 1280, height: 900 },
            serviceWorkers: 'block'
        });
        await context.addInitScript(() => {
            window.AUTH_GATE_SKIP = true;
            window.DUEL_FAST_OPENING = true;
        });
        const page = await context.newPage();
        const erroriPagina = [];
        page.on('pageerror', (e) => erroriPagina.push(e.message));

        try {
            // --- Il catalogo: ogni campagna GIOCABILE ne dichiara uno ---
            await page.goto(base + 'storia.html');
            await page.waitForFunction(() => !!window.StoryProgress, null, { timeout: 15000 });
            const catalogo = await page.evaluate(() => StoryProgress.getCampaigns()
                .filter((c) => (c.capitoli || []).length > 0)
                .map((c) => ({
                    id: c.id,
                    nome: (c.protagonista || {}).name || null,
                    img: (c.protagonista || {}).image || null
                })));
            assert(catalogo.length >= 4, `Poche campagne giocabili (${catalogo.length})`);
            const senza = catalogo.filter((c) => !c.nome || !c.img);
            assert(senza.length === 0,
                'Ogni campagna giocabile deve dire chi sei: ' + senza.map((c) => c.id).join(', '));

            // Il ritratto deve esistere DAVVERO: un percorso sbagliato non
            // fa rumore, ricade sull'emoji e sembra voluto.
            const rotti = [];
            for (const c of catalogo) {
                const ok = await page.evaluate((src) => new Promise((res) => {
                    const i = new Image();
                    i.onload = () => res(true);
                    i.onerror = () => res(false);
                    i.src = src;
                }), c.img);
                if (!ok) rotti.push(`${c.id} -> ${c.img}`);
            }
            assert(rotti.length === 0, 'Ritratti del protagonista che non esistono: ' + rotti.join(', '));

            // --- Il duello lo usa davvero -------------------------------
            const atteso = new Map(catalogo.map((c) => [c.id, c]));
            for (const id of ['anime', 'forbiddenMemories', 'freedom', 'ww1']) {
                const c = atteso.get(id);
                if (!c) continue;
                await page.goto(base + 'duelMonstersCore.html?mode=story&campaign=' + id
                    + '&character=kaiba&difficulty=Medio');
                await page.waitForFunction(() => !!(window.DuelSession && DuelSession.player), null, { timeout: 25000 });
                const p = await page.evaluate(() => ({
                    nome: DuelSession.player.name,
                    img: DuelSession.player.image
                }));
                assert(p.nome === c.nome && p.img === c.img,
                    `In ${id} si deve duellare come "${c.nome}" (${c.img}), rilevato "${p.nome}" (${p.img})`);
            }

            // --- E anche nelle CUTSCENE ---------------------------------
            // Le battute del protagonista si marcano con `io: true` e
            // basta: nome e faccia li dà la campagna. Prima portavano il
            // nome scritto a mano dentro ogni riga e nessun ritratto — un
            // cerchio vuoto col sigillo, mentre l'avversario davanti aveva
            // la sua fotografia.
            await page.goto(base + 'storia.html');
            await page.waitForFunction(() => !!window.StoryProgress, null, { timeout: 15000 });
            const nomiVecchi = await page.evaluate(() => {
                const fuori = [];
                const guarda = (c, t) => {
                    (t.dialogo || []).forEach((b) => {
                        if (/Il Principe|Il Regio Esercito/.test(b.nome || '')) fuori.push(`${t.id}: ${b.nome}`);
                    });
                    if (t.kind === 'scene' && /Il Principe|Il Regio Esercito/.test(t.chi || '')) {
                        fuori.push(`${t.id}: ${t.chi}`);
                    }
                };
                StoryProgress.getCampaigns().forEach((c) => (c.capitoli || []).forEach((cap) => cap.tappe.forEach((t) => {
                    guarda(c, t);
                    if (t.kind === 'torneo') (t.tappe || []).forEach((p) => guarda(c, p));
                })));
                return fuori;
            });
            assert(nomiVecchi.length === 0,
                'Le battute del protagonista devono usare `io: true`, non il nome scritto a mano: ' + nomiVecchi.join(', '));

            const conIo = await page.evaluate(() => {
                let n = 0;
                const guarda = (t) => {
                    if (t.kind === 'scene' && t.io === true) n++;
                    (t.dialogo || []).forEach((b) => { if (b.io === true) n++; });
                };
                StoryProgress.getCampaigns().forEach((c) => (c.capitoli || []).forEach((cap) => cap.tappe.forEach((t) => {
                    guarda(t);
                    if (t.kind === 'torneo') (t.tappe || []).forEach(guarda);
                })));
                return n;
            });
            assert(conIo > 30, `Poche battute marcate come del protagonista (${conIo})`);

            // Il percorso VERO: si apre una scena in cui parla lui e si
            // guarda cosa mostra il riquadro.
            await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                const i = StoryProgress.getTappe('forbiddenMemories').findIndex((t) => t.id === 'fm-5-scena');
                const separazioni = (StoryProgress.getCampaign('forbiddenMemories').separazioni || []).map((s) => s.id);
                SaveManager.setStoryState('forbiddenMemories', { completate: i, finita: false, premiata: false, sotto: {}, separazioni });
            });
            await page.goto(base + 'storia.html?campaign=forbiddenMemories');
            await page.waitForSelector('.nm-node--corrente', { timeout: 20000 });
            await page.click('.nm-node--corrente');
            await page.waitForSelector('.sc-scena', { timeout: 10000 });
            await page.waitForFunction(() => {
                const el = document.querySelector('.sc-chi');
                return !!(el && el.textContent.trim());
            }, null, { timeout: 10000 });
            const inScena = await page.evaluate(() => {
                const img = document.querySelector('.sc-ritratto img');
                return {
                    nome: (document.querySelector('.sc-chi') || {}).textContent,
                    src: img ? (img.getAttribute('src') || '') : '',
                    caricata: !!(img && img.complete && img.naturalWidth > 0),
                    sigillo: document.querySelector('.sc-ritratto').classList.contains('is-sigillo')
                };
            });
            const fm = atteso.get('forbiddenMemories');
            assert(inScena.nome === fm.nome,
                `Nella cutscene deve parlare "${fm.nome}", non "${inScena.nome}"`);
            // Nelle conversazioni parla la PEDINA del personaggio (derivata dal suo ritratto), non l'avatar tondo.
            const pedinaAttesa = await page.evaluate((img) => (typeof getCharacterPawnImage === 'function' ? getCharacterPawnImage(img) : img), fm.img);
            assert((inScena.src === pedinaAttesa || inScena.src === fm.img) && inScena.caricata && !inScena.sigillo,
                `Nella cutscene il protagonista deve avere la sua faccia, non il sigillo: ${JSON.stringify(inScena)}`);

            // --- Un CAPITOLO può cambiare chi sei -----------------------
            // In Memorie Proibite sei Atem, ma nel capitolo del presente
            // sei Yugi Muto: il Faraone è chiuso nel Puzzle, e a duellare
            // nel torneo della Kaiba Corporation è il ragazzo che l'ha
            // rimesso insieme. Il campo sta sul capitolo e vince su quello
            // della campagna, torneo interno compreso.
            await page.goto(base + 'storia.html');
            await page.waitForFunction(() => !!window.StoryProgress, null, { timeout: 15000 });
            const perCapitolo = await page.evaluate(() => {
                const out = {};
                StoryProgress.getTappe('forbiddenMemories').forEach((t) => {
                    // L'ultima tappa del presente è il ritorno in Egitto: lì
                    // parla di nuovo il principe (protagonista della tappa).
                    if (t.id === 'fm-3-ritorno') { out.ritorno = new Set([(t.protagonista || {}).name]); return; }
                    out[t.capitoloId] = out[t.capitoloId] || new Set();
                    out[t.capitoloId].add((t.protagonista || {}).name || '(nessuno)');
                });
                const perNome = {};
                Object.keys(out).forEach((k) => { perNome[k] = Array.from(out[k]); });
                return {
                    capitoli: perNome,
                    torneo: Array.from(new Set(StoryProgress.getProveConStato('forbiddenMemories', 'fm-3-torneo')
                        .map((p) => (p.protagonista || {}).name || '(nessuno)')))
                };
            });
            assert(String(perCapitolo.capitoli['fm-presente']) === 'Yugi Muto',
                `Nel capitolo del presente si deve essere Yugi Muto: ${JSON.stringify(perCapitolo.capitoli['fm-presente'])}`);
            assert(String(perCapitolo.capitoli['fm-principe']) === 'Atem',
                `Nel passato si deve restare Atem: ${JSON.stringify(perCapitolo.capitoli['fm-principe'])}`);
            assert(String(perCapitolo.capitoli.ritorno) === 'Atem',
                `Nella scena del ritorno in Egitto si torna il principe: ${JSON.stringify(perCapitolo.capitoli.ritorno)}`);
            assert(String(perCapitolo.torneo) === 'Yugi Muto',
                `Dentro il torneo si è la stessa persona della tappa che lo contiene: ${JSON.stringify(perCapitolo.torneo)}`);

            // E deve arrivare fino al DUELLO, non restare sulla mappa:
            // l'URL porta la tappa (?tappa=), e il duello ne ricava il
            // capitolo. Senza quel parametro si tornerebbe al protagonista
            // della campagna senza che nulla lo segnali.
            for (const [tappa, atteso] of [['fm-3t-rex', 'Yugi Muto'],
                ['fm-3t-kaiba', 'Yugi Muto'],
                ['fm-1-jono', 'Atem'],
                ['fm-4-mage-soldier', 'Atem']]) {
                await page.goto(base + 'duelMonstersCore.html?mode=story&campaign=forbiddenMemories'
                    + '&character=kaiba&difficulty=Medio&tappa=' + tappa);
                await page.waitForFunction(() => !!(window.DuelSession && DuelSession.player), null, { timeout: 25000 });
                const nome = await page.evaluate(() => DuelSession.player.name);
                assert(nome === atteso, `Nel duello della tappa ${tappa} si deve essere "${atteso}", non "${nome}"`);
            }

            // --- Grande Guerra: Cadorna, poi Diaz ------------------------
            // Richiesta dell'utente, "come da storia ufficiale": Cadorna al
            // comando fino a Caporetto, Diaz dal 9 novembre 1917. Il cambio
            // avviene DENTRO il capitolo di Caporetto, sulla scena del Piave
            // (protagonista sulla singola tappa). E nessuno dei due è un
            // Duellante: non si affrontano, non stanno nel roster.
            await page.goto(base + 'storia.html');
            await page.waitForFunction(() => !!window.StoryProgress, null, { timeout: 15000 });
            const ww1 = await page.evaluate(() => {
                const chi = (id) => ((StoryProgress.getTappe('ww1').find((t) => t.id === id) || {}).protagonista || {}).name;
                const roster = typeof characterDatabase !== 'undefined' ? characterDatabase : [];
                return {
                    inizio: chi('ww1-1-boroevic'),
                    caporetto: chi('ww1-4-kaiserjager'),
                    passaggio: chi('ww1-4-ritirata'),
                    piave: chi('ww1-5-eugenio'),
                    fine: chi('ww1-6-bollettino'),
                    nelRoster: roster.filter((c) => /Cadorna|Diaz/.test(c.name || '')).map((c) => c.id)
                };
            });
            assert(ww1.inizio === 'Luigi Cadorna' && ww1.caporetto === 'Luigi Cadorna',
                `Fino a Caporetto al comando c'è Cadorna: ${JSON.stringify(ww1)}`);
            assert(ww1.passaggio === 'Armando Diaz' && ww1.piave === 'Armando Diaz' && ww1.fine === 'Armando Diaz',
                `Dal Piave in poi al comando c'è Diaz: ${JSON.stringify(ww1)}`);
            assert(ww1.nelRoster.length === 0,
                `Cadorna e Diaz non devono essere Duellanti sfidabili: ${ww1.nelRoster.join(', ')}`);
            for (const [tappa, atteso] of [['ww1-1-boroevic', 'Luigi Cadorna'], ['ww1-5-eugenio', 'Armando Diaz']]) {
                await page.goto(base + 'duelMonstersCore.html?mode=story&campaign=ww1'
                    + '&character=ww1_boroevic&difficulty=Medio&tappa=' + tappa);
                await page.waitForFunction(() => !!(window.DuelSession && DuelSession.player), null, { timeout: 25000 });
                const nome = await page.evaluate(() => DuelSession.player.name);
                assert(nome === atteso, `Nel duello della tappa ${tappa} si deve essere "${atteso}", non "${nome}"`);
            }

            // --- Fuori dalla Storia resta il giocatore ------------------
            await page.goto(base + 'duelMonstersCore.html?mode=free&character=kaiba&difficulty=Medio');
            await page.waitForFunction(() => !!(window.DuelSession && DuelSession.player), null, { timeout: 25000 });
            const libero = await page.evaluate(() => DuelSession.player.name);
            const nomiStoria = catalogo.map((c) => c.nome);
            assert(nomiStoria.indexOf(libero) === -1,
                `In Duello Libero il nome dev'essere il proprio, non quello di una campagna: "${libero}"`);

            assert(erroriPagina.length === 0, 'Errori JS in pagina: ' + erroriPagina.join(' | '));
        } finally {
            await context.close();
        }
    }
};
