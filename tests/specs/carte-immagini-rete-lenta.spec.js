const fs = require('fs');
const path = require('path');
const { startStaticServer, PROJECT_ROOT } = require('../helpers/local-servers');

// Immagini delle carte su rete lenta: segnaposto a tema (niente emoji), miniatura per le carte piccole, miniatura-poi-intera per le
// altre, e precaricamento a bassa priorita'. Le immagini sono ritardate da un vero server (miniature 250 ms, intere 1500 ms).
module.exports = {
    standalone: true,
    name: 'Carte con rete lenta: segnaposto a tema, miniatura per le piccole, progressiva per le grandi, precaricamento',
    async run(t) {
        // Gli id hanno dei buchi (carte doppie eliminate): si usano solo carte che hanno SIA la miniatura SIA l'illustrazione intera.
        const dir = path.join(PROJECT_ROOT, 'images', 'cards');
        const ids = fs.readdirSync(path.join(dir, 'thumbs')).filter((f) => /^\d+\.webp$/.test(f)).map((f) => parseInt(f, 10))
            .filter((id) => fs.existsSync(path.join(dir, id + '.jpg'))).sort((a, b) => a - b).slice(0, 14);
        t.assert(ids.length === 14, 'servono almeno 14 carte con miniatura e illustrazione');
        const [A, B, C, P, X, Y, Z, , , , R1, R2, R3] = ids;

        const server = await startStaticServer();
        const context = await t.browser.newContext({ viewport: { width: 900, height: 700 }, serviceWorkers: 'block' });
        await context.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await context.newPage();
        const richieste = [];
        page.on('request', (r) => { if (/\/images\/cards\//.test(r.url())) richieste.push({ url: r.url(), t: Date.now() }); });
        await page.route('**/images/cards/**', async (route) => {
            const ritardo = /\/thumbs\//.test(route.request().url()) ? 250 : 1500;
            await new Promise((r) => setTimeout(r, ritardo));
            await route.continue();
        });
        try {
            await page.goto(server.origin + '/multiplayer.html');
            await page.waitForFunction(() => !!(window.CardRenderer && window.createCardElement));
            const trova = (id, tipo) => richieste.filter((r) => new RegExp(tipo === 'mini' ? `/thumbs/${id}\\.webp` : `/cards/${id}\\.jpg`).test(r.url));

            // --- Segnaposto a tema: appena creata, prima che arrivi qualsiasi immagine ---
            const seg = await page.evaluate(([a, b, c]) => {
                // Un contenitore FISSO in alto: le immagini `lazy` partono solo se la carta e' nella finestra.
                const prova = document.createElement('div');
                prova.id = 'provaCarte';
                prova.style.cssText = 'position:fixed;left:0;top:0;display:flex;flex-wrap:wrap;gap:4px;z-index:99999;background:#000';
                document.body.appendChild(prova);
                const base = { uid: 's', name: 'Prova', artOnly: true, attack: 1000, defense: 1000, level: 4, race: 'Guerriero' };
                const crea = (extra) => { const el = createCardElement(Object.assign({}, base, extra), false, 'attack', { miniatura: true }); el.style.setProperty('--card-w', '160px'); prova.appendChild(el); return el; };
                const mostro = crea({ id: a, type: 'monster', attribute: 'FUOCO' });
                const magia = crea({ id: b, type: 'spell', name: 'Magia' });
                const trappola = crea({ id: c, type: 'trap', name: 'Trappola' });
                const info = (el) => {
                    const finestra = el.querySelector('.card-frame-art');
                    const icona = el.querySelector('.card-frame-art-icon');
                    return { glifo: icona ? icona.textContent : null, attr: finestra.dataset.attr, tipo: finestra.dataset.ctype, sfondo: getComputedStyle(finestra).backgroundImage };
                };
                return { mostro: info(mostro), magia: info(magia), trappola: info(trappola) };
            }, [A, B, C]);
            const emoji = /\p{Extended_Pictographic}/u;
            t.assert(seg.mostro.glifo === '炎' && seg.mostro.attr === 'FUOCO', `mostro: segnaposto non a tema ${JSON.stringify(seg.mostro)}`);
            t.assert(seg.magia.glifo === '魔' && seg.trappola.glifo === '罠', `Magia/Trappola: kanji mancanti ${JSON.stringify([seg.magia.glifo, seg.trappola.glifo])}`);
            [seg.mostro, seg.magia, seg.trappola].forEach((s) => {
                t.assert(!emoji.test(s.glifo || ''), `il segnaposto contiene un'emoji: ${s.glifo}`);
                t.assert(/gradient/.test(s.sfondo), `il segnaposto non ha il gradiente a tema: ${s.sfondo}`);
            });

            // --- Solo miniatura (mano, campo): l'intera non viene MAI richiesta ---
            await page.waitForFunction(() => document.querySelectorAll('.card.art-loaded').length >= 3, null, { timeout: 8000 });
            await page.waitForTimeout(2200);
            t.assert(trova(A, 'mini').length >= 1, 'carta piccola: la miniatura non e\' stata richiesta');
            t.assert(trova(A, 'piena').length === 0, `carta piccola: l'illustrazione intera non doveva essere richiesta (${trova(A, 'piena').length})`);

            // --- Progressiva (default): prima la miniatura, poi l'intera, e alla fine l'intera sta nella carta ---
            await page.evaluate((p) => {
                const el = createCardElement({ id: p, uid: 'p', name: 'Grande', type: 'monster', attribute: 'ACQUA', artOnly: true, attack: 1, defense: 1, level: 4, race: 'Pesce' });
                el.id = 'cartaProgressiva';
                el.style.setProperty('--card-w', '160px');
                document.getElementById('provaCarte').appendChild(el);
            }, P);
            await page.waitForFunction((p) => { const i = document.querySelector('#cartaProgressiva .card-art-image'); return i && i.src.includes('/thumbs/' + p + '.webp') && i.complete; }, P, { timeout: 8000 });
            const conMiniatura = await page.evaluate(() => document.querySelector('#cartaProgressiva').classList.contains('art-loaded'));
            t.assert(conMiniatura, 'progressiva: con la miniatura gia\' arrivata la carta deve mostrarla (art-loaded) senza aspettare l\'intera');
            await page.waitForFunction((p) => document.querySelector('#cartaProgressiva .card-art-image').src.endsWith('/cards/' + p + '.jpg'), P, { timeout: 10000 });
            const mini = trova(P, 'mini')[0], piena = trova(P, 'piena')[0];
            t.assert(mini && piena && mini.t <= piena.t, 'progressiva: la miniatura va richiesta prima dell\'intera');
            const resta = await page.evaluate(() => !!document.querySelector('#cartaProgressiva .card-art-image') && document.querySelector('#cartaProgressiva').classList.contains('art-loaded'));
            t.assert(resta, 'progressiva: dopo la sostituzione l\'immagine deve restare visibile');

            // --- Precaricamento: una sola richiesta per carta, a bassa priorita', mai con "risparmio dati" ---
            const programmate = await page.evaluate(([x, y, z]) => CardRenderer.precaricaMiniature([x, y, z, x, { id: y, qty: 2 }], { intervalloMs: 10 }), [X, Y, Z]);
            t.assert(programmate === 3, `precaricamento: attese 3 richieste (niente doppioni), programmate ${programmate}`);
            await page.waitForTimeout(700);
            [X, Y, Z].forEach((id) => t.assert(trova(id, 'mini').length === 1, `precaricamento: miniatura ${id} richiesta ${trova(id, 'mini').length} volte`));
            const conRisparmio = await page.evaluate(([a, b, c]) => {
                Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '4g' }, configurable: true });
                return CardRenderer.precaricaMiniature([a, b, c], { intervalloMs: 10 });
            }, [R1, R2, R3]);
            t.assert(conRisparmio === 0, 'con "risparmio dati" non si deve precaricare nulla');
            await page.waitForTimeout(400);
            t.assert(trova(R1, 'mini').length === 0, 'con "risparmio dati" la miniatura non doveva essere richiesta');
        } finally {
            await context.close();
            await server.close();
        }
    }
};
