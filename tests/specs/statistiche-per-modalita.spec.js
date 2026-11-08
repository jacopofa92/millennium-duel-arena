// Statistiche del Profilo: il contatore per modalita' (js/stats/statistiche.js) e le schede.
const path = require('path');
const RADICE = path.join(__dirname, '..', '..');
module.exports = {
    standalone: true,
    name: 'Statistiche: contatore per modalita\', serie, pareggi e abbandoni',
    async run(t) {
        const page = await t.browser.newPage({ viewport: { width: 800, height: 900 } });
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.PAGE_LOADER_SKIP = true; });
        try {
            await page.goto('file:///' + path.join(RADICE, 'profilo.html').replace(/\\/g, '/'));
            await page.waitForFunction(() => !!window.SaveManager && !!window.Statistiche);
            const r = await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Conta');
                SaveManager.setModeState('statistiche', null);
                const S = Statistiche;
                const out = {};
                // Modalita' non contate: Demo, Sandbox, Tutorial, Puzzle.
                out.ignorate = ['demo', 'sandbox', 'tutorial', 'puzzle'].map((m) => S.registraDuello(m, 'vinto', 3));
                S.registraDuello('free', 'vinto', 6); S.registraDuello('free', 'vinto', 8);
                S.registraDuello('free', 'pareggio', 4);         // il pareggio non spezza la serie
                S.registraDuello('free', 'vinto', 5);
                out.serie = [S.leggi().serieAttuale, S.leggi().serieMigliore];
                S.registraDuello('story', 'perso', 7);           // una sconfitta azzera la serie attuale, non la migliore
                out.dopoSconfitta = [S.leggi().serieAttuale, S.leggi().serieMigliore];
                S.registraDuello('multiplayer', 'vinto', 9); S.registraDuello('tag', 'perso', 2); S.registraDuello('tournament', 'vinto', 6);
                out.libero = S.di('libero'); out.storia = S.di('storia'); out.online = S.di('online'); out.tag = S.di('tag'); out.tornei = S.di('tornei');
                out.turni = S.leggi().turni;
                out.dal = /^\d{4}-\d{2}-\d{2}$/.test(S.leggi().dal);
                return out;
            });
            t.assert(r.ignorate.every((x) => x === false), `demo, sandbox, tutorial e puzzle non si contano: ${JSON.stringify(r.ignorate)}`);
            t.assert(r.libero.giocati === 4 && r.libero.vinti === 3 && r.libero.pareggi === 1 && r.libero.persi === 0, `Duello Libero: ${JSON.stringify(r.libero)}`);
            t.assert(r.serie[0] === 3 && r.serie[1] === 3, `un pareggio non spezza la serie: ${JSON.stringify(r.serie)}`);
            t.assert(r.dopoSconfitta[0] === 0 && r.dopoSconfitta[1] === 3, `una sconfitta azzera la serie attuale e non la migliore: ${JSON.stringify(r.dopoSconfitta)}`);
            t.assert(r.storia.persi === 1 && r.online.vinti === 1 && r.tag.persi === 1 && r.tornei.vinti === 1, 'ogni modalita\' ha il suo conto');
            t.assert(r.turni === 6 + 8 + 4 + 5 + 7 + 9 + 2 + 6 && r.dal, `i turni si sommano: ${r.turni}`);

            // Le schede del Profilo mostrano i conti, e il totale della testata conta anche i pareggi.
            await page.reload();
            await page.waitForSelector('#statsMount .pst-mod');
            const ui = await page.evaluate(() => ({
                libero: document.querySelector('.pst-mod[data-modalita="libero"] .pst-mod-duelli').textContent.replace(/\s+/g, ' ').trim(),
                caccia: document.querySelector('.pst-mod[data-modalita="caccia"] .pst-mod-vuoto') ? 'vuota' : 'con conti',
                pareggi: /1 pareggio/.test(document.getElementById('statsMount').textContent)
            }));
            t.assert(/4\s*Duelli\s*3\s*Vinti\s*0\s*Persi\s*75%/.test(ui.libero), `la scheda del Duello Libero: ${ui.libero}`);
            t.assert(ui.caccia === 'vuota' && ui.pareggi, `una modalita' senza duelli lo dice, e i pareggi si vedono: ${JSON.stringify(ui)}`);
            t.assert(errori.length === 0, `nessun errore: ${errori.join(' | ')}`);
        } finally {
            await page.close();
        }
    }
};
