// Tre duelli della Storia anime che nell'anime erano in coppia (js/data/story-campaigns.js, campo `tag` del nodo):
//  - anime-2-paradox: Yugi e Joey contro i Fratelli Paradosso (2 contro 1, i due fratelli sono un solo Duellante del roster);
//  - anime-3-lumis: Yugi e Kaiba contro Lumis E Umbra (2 contro 2); il nodo di Umbra e' ora una scena (stessa posizione);
//  - anime-6-cinque-uniti: Yugi e Joey contro Gansley con 12000 Life Point (Boss).
// Si controlla il catalogo e l'URL (StoryProgress.urlDuello), poi la squadra che nasce nel duello vero (mode=story&tag=1) e che
// a fine duello anche il SECONDO avversario conta come battuto (record e Sfida).
const path = require('path');
const { waitForOpeningCascade } = require('../helpers/harness');

const RADICE = path.join(__dirname, '..', '..');
const DUELLO = 'file:///' + path.join(RADICE, 'duelMonstersCore.html').replace(/\\/g, '/');
const PRELUDIO = () => {
    window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true;
    try { localStorage.setItem('ygoVideoDetail', 'normali'); localStorage.setItem('ygoVideoDetailScelto', '1'); } catch (e) { /* storage non disponibile */ }
};

async function apri(browser, url, errori) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    page.on('pageerror', (e) => errori.push(e.message));
    await page.addInitScript(PRELUDIO);
    await page.goto(url);
    try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
    await page.waitForFunction(() => typeof gameState !== 'undefined' && window.TagTeam && TagTeam.eSquadra('player'), null, { timeout: 40000 });
    await waitForOpeningCascade(page);
    return page;
}

module.exports = {
    standalone: true,
    name: 'Storia anime: i duelli che nell\'anime erano in coppia sono duelli Tag (Paradosso, Lumis e Umbra, Cinque uniti)',
    async run(t) {
        const errori = [];
        // ---------- 1) Catalogo e URL, a pagina del menu Storia (carica catalogo e StoryProgress)
        const catalogo = await (async () => {
            const page = await t.browser.newPage({ viewport: { width: 1280, height: 800 } });
            await page.addInitScript(PRELUDIO);
            await page.goto('file:///' + path.join(RADICE, 'storia.html').replace(/\\/g, '/'));
            await page.waitForFunction(() => window.StoryProgress && typeof storyCampaignsDatabase !== 'undefined', null, { timeout: 30000 });
            const r = await page.evaluate(() => {
                const anime = storyCampaignsDatabase.find((c) => c.id === 'anime');
                const tutte = anime.capitoli.flatMap((c) => c.tappe).flatMap((a) => [a].concat(a.tappe || []));
                const nodo = (id) => tutte.find((n) => n.id === id);
                const out = {};
                ['anime-2-paradox', 'anime-3-lumis', 'anime-6-cinque-uniti'].forEach((id) => {
                    const n = nodo(id);
                    const url = new URL(StoryProgress.urlDuello('anime', n), 'http://x/');
                    out[id] = { tag: n.tag, p: Object.fromEntries(url.searchParams.entries()), kind: n.kind };
                });
                out.umbra = { kind: nodo('anime-3-umbra').kind };
                return out;
            });
            await page.close();
            return r;
        })();
        const L = catalogo['anime-3-lumis'], P = catalogo['anime-2-paradox'], C = catalogo['anime-6-cinque-uniti'];
        t.assert(L.p.mode === 'story' && L.p.tag === '1' && L.p.partner === 'kaiba' && L.p.character === 'lumis' && L.p.character2 === 'umbra' && !L.p.boss,
            `Lumis e Umbra: URL di un 2 contro 2 della Storia: ${JSON.stringify(L.p)}`);
        t.assert(P.p.tag === '1' && P.p.partner === 'joey' && P.p.character === 'paradoxBrothers' && !P.p.character2 && !P.p.boss,
            `Paradosso: URL di un 2 contro 1: ${JSON.stringify(P.p)}`);
        t.assert(C.p.tag === '1' && C.p.partner === 'joey' && C.p.character === 'gansley' && C.p.boss === '1' && !C.p.character2,
            `Cinque uniti: URL di un 2 contro 1 contro il Boss: ${JSON.stringify(C.p)}`);
        t.assert(catalogo.umbra.kind === 'scene', 'Il nodo di Umbra resta (come scena) per non spostare l\'avanzamento di chi ha gia\' giocato');

        // ---------- 2) Il duello vero: Lumis e Umbra (2 contro 2)
        {
            const page = await apri(t.browser, DUELLO + '?' + new URLSearchParams(L.p).toString(), errori);
            try {
                const d = await page.evaluate(() => ({
                    tu: TagTeam.riassunto('player').membri.map((m) => m.nome),
                    bot: TagTeam.eSquadra('bot') ? TagTeam.riassunto('bot').membri.map((m) => m.nome) : null,
                    lp: [TagTeam.riassunto('player').membri.map((m) => m.lp), TagTeam.riassunto('bot').membri.map((m) => m.lp)],
                    story: !!(window.ModalitaDuello && window.ModalitaDuello.story),
                    campagna: DuelSession.campaignId
                }));
                t.assert(d.story && d.campagna === 'anime', `E' un duello della Storia con la modalita' Tag: ${JSON.stringify(d)}`);
                t.assert(d.tu.length === 2 && /Kaiba/.test(d.tu[1]), `La tua squadra: tu e Kaiba: ${JSON.stringify(d.tu)}`);
                t.assert(d.bot && d.bot.length === 2 && /Lumis/.test(d.bot[0]) && /Umbra/.test(d.bot[1]), `La squadra avversaria: Lumis e Umbra: ${JSON.stringify(d.bot)}`);
                // A fine duello, vinto, anche Umbra conta come battuto (record e Sfida), Lumis lo conta gia' duel-session.js.
                const fine = await page.evaluate(() => {
                    const prima = getCharacterRecord('umbra');
                    const voci = window.ModalitaDuello.story.chiudi(true, false);
                    const dopo = getCharacterRecord('umbra');
                    return { prima: prima && prima.wins || 0, dopo: dopo && dopo.wins || 0, voci: voci.length };
                });
                t.assert(fine.dopo === fine.prima + 1, `Umbra conta come battuto: ${JSON.stringify(fine)}`);
                // E una sconfitta o un abbandono non contano niente.
                const sconfitta = await page.evaluate(() => {
                    const prima = (getCharacterRecord('umbra') || {}).wins || 0;
                    window.ModalitaDuello.story.chiudi(false, false);
                    window.ModalitaDuello.story.chiudi(true, true);
                    return ((getCharacterRecord('umbra') || {}).wins || 0) === prima;
                });
                t.assert(sconfitta, 'Una sconfitta o un abbandono non danno la vittoria su Umbra');
            } finally { await page.close(); }
        }

        // ---------- 3) Cinque uniti: Boss con 12000 Life Point, 2 contro 1
        {
            const page = await apri(t.browser, DUELLO + '?' + new URLSearchParams(C.p).toString(), errori);
            try {
                const d = await page.evaluate(() => ({
                    tu: TagTeam.riassunto('player').membri.map((m) => m.nome),
                    botEsquadra: TagTeam.eSquadra('bot'),
                    botLP: gameState.botLP,
                    tuoLP: TagTeam.riassunto('player').membri.map((m) => m.lp)
                }));
                t.assert(d.tu.length === 2 && /Joey/.test(d.tu[1]), `Tu e Joey: ${JSON.stringify(d.tu)}`);
                t.assert(d.botEsquadra === false && d.botLP === 12000, `Gansley da solo con 12000 Life Point: ${JSON.stringify(d)}`);
            } finally { await page.close(); }
        }

        // ---------- 4) Paradosso: 2 contro 1 senza Boss (i due fratelli, 8000 contro i 4000 a testa della coppia)
        {
            const page = await apri(t.browser, DUELLO + '?' + new URLSearchParams(P.p).toString(), errori);
            try {
                const d = await page.evaluate(() => ({
                    tu: TagTeam.riassunto('player').membri.map((m) => m.nome),
                    botEsquadra: TagTeam.eSquadra('bot'),
                    botLP: gameState.botLP
                }));
                t.assert(d.tu.length === 2 && /Joey/.test(d.tu[1]) && !d.botEsquadra && d.botLP === 8000, `Yugi e Joey contro i Paradosso (8000): ${JSON.stringify(d)}`);
            } finally { await page.close(); }
        }
        t.assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
    }
};
