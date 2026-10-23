// Storia anime: ogni ARCO narrativo (capitolo/area) completato la prima volta, a qualunque livello, paga 3 Stelle una volta
// sola (StoryProgress.pagaStelleArco, Rewards.forStoryArc). Chi aveva gia' finito un arco prima della regola lo riscuote
// rifacendone l'ULTIMO nodo (rifattoNodo): scena riletta o duello rivinto dall'area gia' superata.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Storia anime: 3 Stelle per ogni arco completato la prima volta, e per chi aveva gia\' finito rifacendo l\'ultimo nodo',
    standalone: true,
    async run({ browser, assert }) {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
        await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await ctx.newPage();
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await page.goto(url('storia.html'));
            await page.waitForFunction(() => !!(window.StoryProgress && window.Rewards && window.SaveManager));
            const r = await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Prova');
                const stelle = () => SaveManager.getCurrency().starChips;
                const crediti = () => SaveManager.getCurrency().credits;
                const azzera = () => { const s = SaveManager.getCardAcquisitionState(); s.starArcs = {}; SaveManager.setCardAcquisitionState(s); };
                const out = {};
                azzera();

                // 1) Gli ultimi nodi dei sei archi
                const anime = StoryProgress.getCampaign('anime');
                out.ultimi = anime.capitoli.map((c) => { const u = StoryProgress.ultimoNodoDelCapitolo('anime', c); return u ? u.id : null; });

                // 2) Completamento VERO: l'ultima prova dell'area del prologo, passando da avanzaTorneo
                StoryProgress.forzaAvanzamento('anime', 0);
                const area = StoryProgress.getTorneo('anime', 'anime-area-prologo');
                const totali = area.tappe.filter((p) => p.parallelo !== true).length;
                const st = SaveManager.getStoryState('anime');
                st.sotto = Object.assign({}, st.sotto, { 'anime-area-prologo': totali - 1 });
                SaveManager.setStoryState('anime', st);
                const prima = stelle();
                const prC = crediti();
                StoryProgress.avanzaTorneo('anime', 'anime-area-prologo');
                out.completamento = stelle() - prima;
                out.creditiArco = crediti() - prC;
                out.registro = !!SaveManager.getCardAcquisitionState().starArcs.prologo;

                // 3) Una volta sola
                const dopo = stelle();
                out.secondaVolta = StoryProgress.pagaStelleArco('anime', 'prologo').length + (stelle() - dopo);

                // 4) Pregresso: arco gia' pagato? no -> rifare l'ULTIMO nodo paga; un nodo qualunque no
                azzera();
                const p0 = stelle();
                out.nodoQualunque = StoryProgress.rifattoNodo('anime', 'anime-1-nonno').length + (stelle() - p0);
                const p1 = stelle();
                out.ultimoNodo = (stelle() - p1) + StoryProgress.rifattoNodo('anime', out.ultimi[0]).length;
                out.ultimoNodoStelle = stelle() - p1;
                const p2 = stelle();
                out.ultimoNodoDuello = StoryProgress.rifattoNodo('anime', out.ultimi[1]).length;
                out.ultimoNodoDuelloStelle = stelle() - p2;
                const p3 = stelle();
                StoryProgress.rifattoNodo('anime', out.ultimi[0]);
                out.ripetuto = stelle() - p3;

                // 5) Altre campagne: niente
                const p4 = stelle();
                out.altraCampagna = StoryProgress.pagaStelleArco('forbidden_memories_1', 'x').length + (stelle() - p4);
                azzera();
                return out;
            });
            assert(r.ultimi.length === 6 && r.ultimi.every(Boolean), `Ogni arco ha un ultimo nodo: ${JSON.stringify(r.ultimi)}`);
            assert(r.completamento === 3 && r.registro, `Completare un arco la prima volta paga 3 Stelle e lo segna: ${JSON.stringify(r)}`);
            assert(r.creditiArco === 350, `...e 350 Crediti: ${JSON.stringify(r)}`);
            assert(r.secondaVolta === 0, `Lo stesso arco non paga due volte: ${JSON.stringify(r)}`);
            assert(r.nodoQualunque === 0, `Rifare un nodo qualunque non paga: ${JSON.stringify(r)}`);
            assert(r.ultimoNodoStelle === 3 && r.ultimoNodoDuelloStelle === 3, `Rifare l'ultimo nodo (scena o duello) paga 3 Stelle: ${JSON.stringify(r)}`);
            assert(r.ripetuto === 0, `Rifarlo ancora non ripaga: ${JSON.stringify(r)}`);
            assert(r.altraCampagna === 0, `Solo la Storia anime paga: ${JSON.stringify(r)}`);
            assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
        } finally {
            await ctx.close();
        }
    }
};
