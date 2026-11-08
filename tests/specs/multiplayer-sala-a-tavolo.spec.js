// Multiplayer: la SALA A TAVOLO (js/multiplayer/sala-tavolo*.js) e' la sala di serie.
//
// Due client veri e un relay vero. Si controlla che, senza alcun parametro nell'indirizzo,
//  - Duello a specchio: l'ospite si ritrovi sul tavolo con posti fissi (host sopra la propria etichetta, sfidante dall'altra), l'host
//    possa cambiare il mazzo comune dal tavolo e l'ospite lo veda cambiare; i premi stiano nella sala; "Sono pronto" di entrambi
//    faccia partire il conto alla rovescia (schede con arena e musica);
//  - Tag Team: chi entra sia in piedi, prenda un posto libero, l'host lo alzi e lo rimetta in un altro posto;
//  - `?sala=classica` riporti la sala vecchia (e non il tavolo).
// `standalone: true`: due pagine e un relay vero (vedi multiplayer-specchio.spec.js).
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

module.exports = {
    name: 'Multiplayer: la sala a tavolo e\' quella di serie (specchio, Tag, ritorno alla classica)',
    standalone: true,
    async run({ browser, assert }) {
        const statics = await startStaticServer();
        const room = await startRoomServer();
        const errori = [];
        try {
            const apri = async (etichetta, query) => {
                const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
                const page = await context.newPage();
                page.on('pageerror', (e) => errori.push(`[${etichetta}] ${e.message}`));
                await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_RPS_SKIP = true; window.DUEL_FAST_OPENING = true; });
                await page.goto(statics.origin + '/multiplayer.html' + query, { waitUntil: 'load' });
                await page.waitForSelector('#mpCreateBtn');
                await page.waitForFunction(() => { const el = document.getElementById('pageLoader'); return !el || el.classList.contains('page-loader-hidden'); }, { timeout: 15000 });
                await page.evaluate(() => { const a = document.querySelector('.mp-advanced'); if (a) a.open = true; });
                await page.fill('#mpServerUrl', room.wsUrl);
                return page;
            };
            const codiceDi = async (page) => (await page.textContent('.st-codice b')).trim();

            // ---- Specchio ----
            const host = await apri('host', '?modo=specchio');
            const ospite = await apri('ospite', '?modo=specchio');
            await host.click('#mpCreateBtn');
            await host.waitForSelector('.st-sala .st-slot', { timeout: 15000 });
            const codice = await codiceDi(host);
            assert(/^[A-Z0-9]{5}$/.test(codice), `Il codice sta nel tavolo: ${codice}`);
            await ospite.click('#mpTabJoin');
            await ospite.fill('#mpJoinCode', codice);
            await ospite.click('#mpJoinBtn');
            await ospite.waitForSelector('.st-sala .st-slot', { timeout: 20000 });
            // I due client si vedono: lo slot dell'avversario passa da libero a persona.
            await host.waitForSelector('.st-slot--persona', { timeout: 20000 });
            const fissi = await ospite.evaluate(() => [...document.querySelectorAll('.st-slot')].every((b) => b.disabled));
            assert(fissi, 'Nel duello a due i posti sono fissi: nessuno slot si puo\' toccare');
            const vecchiaNascosta = await host.evaluate(() => { const r = document.getElementById('mpReadyBar'); return !r || r.offsetParent === null; });
            assert(vecchiaNascosta, 'La barra "pronto" della sala vecchia non si vede');
            const premi = await host.evaluate(() => { const p = document.getElementById('mpPremiSala'); return !!p && !!p.closest('.mp-tavolo-radice') && p.offsetParent !== null; });
            assert(premi, 'I premi sono dentro il tavolo e si vedono');

            // L'host cambia il mazzo comune dal tavolo (giro fra le opzioni): l'ospite lo vede.
            const prima = await host.textContent('.st-chip:has(small:text-is("Mazzo comune")) b');
            await host.click('.st-chip:has(small:text-is("Mazzo comune"))');
            await ospite.waitForFunction((v) => { const b = document.querySelector('.st-chip:has(small) b'); return [...document.querySelectorAll('.st-chip')].some((c) => /Mazzo comune/.test(c.textContent) && !c.textContent.includes(v)); }, prima, { timeout: 10000 });
            const ospiteNonModifica = await ospite.evaluate(() => [...document.querySelectorAll('.st-chip')].find((c) => /Mazzo comune/.test(c.textContent)).disabled);
            assert(ospiteNonModifica, 'Il mazzo comune lo decide l\'host: per l\'ospite il tasto e\' spento');

            // Pronti tutti e due: parte il conto alla rovescia con le schede.
            await host.click('.st-pronto-btn');
            await ospite.click('.st-pronto-btn');
            await host.waitForSelector('.mp-conto-scheda', { timeout: 20000 });
            const schede = await host.evaluate(() => [...document.querySelectorAll('.mp-conto-scheda')].map((s) => ({ ico: !!s.querySelector('svg') || !!s.querySelector('.mp-conto-ico').style.backgroundImage, testo: s.textContent })));
            assert(schede.length >= 4 && schede.every((s) => s.ico), `Il conto mostra schede con icona: ${JSON.stringify(schede)}`);
            assert(schede.some((s) => /Arena/i.test(s.testo)) && schede.some((s) => /Musica/i.test(s.testo)), 'Il conto parla di arena e musica');

            // ---- Tag ----
            const a = await apri('tag-host', '?modo=tag');
            const b = await apri('tag-ospite', '?modo=tag');
            await a.click('[data-formato="2v2"]');
            await a.click('#mpCreateBtn');
            await a.waitForSelector('.st-sala .st-slot', { timeout: 15000 });
            const codiceTag = await codiceDi(a);
            await b.click('#mpTabJoin');
            await b.fill('#mpJoinCode', codiceTag);
            await b.click('#mpJoinBtn');
            await b.waitForSelector('.st-sala .st-slot', { timeout: 20000 });
            const inPiedi = await b.evaluate(() => !document.querySelector('.st-slot--io'));
            assert(inPiedi, 'Chi entra nel Tag comincia in piedi (nessun posto suo)');
            await b.click('.st-slot[data-posto="B0"]');
            await a.waitForFunction(() => MpTagSala._stato().stato.posti.B0 !== null, null, { timeout: 10000 });
            // L'host lo alza, poi lo rimette in A1 scegliendolo fra chi e' in piedi.
            await a.click('.st-cella:has(.st-slot[data-posto="B0"]) .st-menu-btn');
            await a.click('.st-menu button:has-text("Metti al centro")');
            await a.waitForFunction(() => MpTagSala._stato().stato.posti.B0 === null, null, { timeout: 10000 });
            await a.click('.st-inpiedi-chip:not([disabled])');
            await a.click('.st-slot[data-posto="A1"]');
            await a.waitForFunction(() => MpTagSala._stato().stato.posti.A1 !== null, null, { timeout: 10000 });
            const postoOspite = await b.evaluate(() => MpTagSala._stato().stato.posti.A1 === MpTagSala._stato().io);
            assert(postoOspite, 'L\'ospite si ritrova nel posto scelto dall\'host');
            const bloccato = await b.evaluate(() => document.querySelector('.st-slot--io').disabled);
            assert(bloccato, 'Un ospite non puo\' alzarsi da solo dal suo posto');

            // ---- Ritorno alla sala classica ----
            const c = await apri('classica', '?modo=specchio&sala=classica');
            await c.click('#mpCreateBtn');
            await c.waitForFunction(() => { const el = document.getElementById('mpRoomCodeValue'); return el && /^[A-Z0-9]{5}$/.test(el.textContent.trim()); }, { timeout: 15000 });
            const classica = await c.evaluate(() => !document.querySelector('.mp-tavolo-radice') && document.getElementById('mpSeatYouName').offsetParent !== null);
            assert(classica, 'Con ?sala=classica si vede la sala vecchia, senza il tavolo');

            assert(errori.length === 0, `Nessun errore di pagina: ${errori.join(' | ')}`);
        } finally {
            await statics.close();
            await room.close();
        }
    }
};
