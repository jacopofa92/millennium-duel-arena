// Le conversazioni DOPO la vittoria di un duello della Storia (js/data/story-dopo-duello.js, StoryProgress.getDopoDuello):
//  - ogni duello dell'anime ha la sua, tranne i due che hanno una scena subito dopo che racconta lo stesso momento;
//  - ogni voce parla con personaggi che esistono nel roster, in battute non vuote;
//  - dopo una vittoria nuova la pagina mostra la conversazione PRIMA della mappa, e solo allora la storia prosegue;
//  - una tappa rigiocata o una sconfitta non la mostrano.
const path = require('path');
const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

const SENZA_DOPO = ['anime-1-pegasus-video', 'anime-2-kaiba'];

module.exports = {
    name: 'Storia: dopo una vittoria nuova c\'e\' la conversazione, prima della mappa',
    standalone: true,
    async run({ browser, assert }) {
        const errori = [];
        const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 }, serviceWorkers: 'block' });
        await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await page.goto(url('storia.html'));
            await page.waitForFunction(() => window.StoryProgress && typeof storyDopoDuello !== 'undefined', null, { timeout: 20000 });

            // --- copertura e forma
            const copertura = await page.evaluate((senza) => {
                const duelli = [];
                const walk = (lista) => (lista || []).forEach((t) => { if (t.kind === 'duel') duelli.push(t.id); if (t.tappe) walk(t.tappe); });
                walk(StoryProgress.getCampaign('anime').capitoli.flatMap((c) => c.tappe));
                const mancanti = duelli.filter((id) => !storyDopoDuello[id] && !senza.includes(id));
                const orfane = Object.keys(storyDopoDuello).filter((id) => !duelli.includes(id));
                const ids = new Set();
                const brutte = [];
                Object.entries(storyDopoDuello).forEach(([id, battute]) => battute.forEach((b, i) => {
                    if (!b.testo || !String(b.testo).trim()) brutte.push(`${id}#${i}: testo vuoto`);
                    if (b.chi) { ids.add(b.chi); if (!StoryProgress.getPersonaggio(b.chi) && !(window.characterDatabase || []).some((c) => c.id === b.chi)) brutte.push(`${id}#${i}: chi sconosciuto "${b.chi}"`); }
                }));
                return { duelli: duelli.length, mancanti, orfane, brutte, voci: Object.keys(storyDopoDuello).length };
            }, SENZA_DOPO);
            assert(copertura.mancanti.length === 0, `Ogni duello dell'anime ha la sua conversazione dopo la vittoria. Mancano: ${copertura.mancanti.join(', ')}`);
            assert(copertura.orfane.length === 0, `Nessuna voce punta a un duello che non esiste: ${copertura.orfane.join(', ')}`);
            assert(copertura.brutte.length === 0, `Battute sensate e personaggi del roster: ${copertura.brutte.join(' | ')}`);

            // --- getDopoDuello: protagonista e arena risolti
            const dato = await page.evaluate(() => {
                const d = StoryProgress.getDopoDuello('anime', 'anime-2-pegasus');
                const k = StoryProgress.getDopoDuello('anime', 'anime-2-kaiba-joey');   // dentro l'area, protagonista Kaiba
                return { battute: d && d.battute.length, campo: d && d.tappa.field, prot: k && k.tappa.protagonista && k.tappa.protagonista.name, nessuna: StoryProgress.getDopoDuello('anime', 'anime-2-kaiba') };
            });
            assert(dato.battute >= 4, `Pegasus ha una conversazione vera, non una riga: ${JSON.stringify(dato)}`);
            assert(dato.prot === 'Seto Kaiba', `Dentro l'area vale il protagonista della prova: ${JSON.stringify(dato)}`);
            assert(dato.nessuna === null, 'Dove una scena racconta gia\' lo stesso momento non c\'e\' una seconda conversazione');

            // --- il flusso: vittoria nuova -> conversazione PRIMA della mappa; persa o rigiocata -> subito la mappa
            const apri = async (esito) => {
                await page.goto(url('storia.html'));
                await page.waitForFunction(() => window.StoryProgress, null, { timeout: 20000 });
                await page.evaluate((e) => {
                    sessionStorage.setItem('ygoLastDuelOutcome', JSON.stringify(Object.assign({ mode: 'story', campaignId: 'anime', timestamp: Date.now() }, e)));
                }, esito);
                await page.goto(url('storia.html') + '?campaign=anime');
                await page.waitForTimeout(1800);
                return page.evaluate(() => ({ scena: !!document.querySelector('.sc-scena'), mappa: !document.getElementById('vistaMappa').hidden }));
            };
            const vinta = await apri({ playerWon: true, rigiocata: false, opponentId: 'weevil', tappaId: 'anime-2-weevil' });
            assert(vinta.scena, 'Dopo una vittoria nuova si apre la conversazione');
            // A fine conversazione la pagina prosegue: un tocco la fa avanzare fino in fondo.
            for (let k = 0; k < 25 && await page.$('.sc-scena'); k++) { await page.mouse.click(500, 350); await page.waitForTimeout(700); }
            const dopoLettura = await page.evaluate(() => ({ scena: !!document.querySelector('.sc-scena'), mappa: !document.getElementById('vistaMappa').hidden }));
            assert(!dopoLettura.scena && dopoLettura.mappa, 'Finita la conversazione si vede la mappa: ' + JSON.stringify(dopoLettura));
            const persa = await apri({ playerWon: false, rigiocata: false, opponentId: 'weevil', tappaId: 'anime-2-weevil' });
            assert(!persa.scena && persa.mappa, 'Dopo una sconfitta niente conversazione, subito la mappa: ' + JSON.stringify(persa));
            const rigiocata = await apri({ playerWon: true, rigiocata: true, opponentId: 'weevil', tappaId: 'anime-2-weevil' });
            assert(!rigiocata.scena && rigiocata.mappa, 'Una tappa rigiocata non ripete la conversazione: ' + JSON.stringify(rigiocata));        } finally {
            await ctx.close();
        }
        assert(errori.length === 0, `Nessun errore JS: ${errori.join(' | ')}`);
    }
};
