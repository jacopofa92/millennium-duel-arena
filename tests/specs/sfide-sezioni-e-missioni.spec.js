// Le Sfide a sezioni, e le missioni che ruotano.
// =====================================================================
// Quattro cose che, rompendosi, si notano solo giocando per giorni:
//
//   1) le missioni di un periodo devono essere SEMPRE LE STESSE finché
//      quel periodo dura. Sorteggiate con Math.random() cambierebbero ad
//      ogni apertura della pagina, e una missione che cambia mentre la
//      stai facendo non è una missione;
//   2) un periodo diverso deve darne altre, altrimenti non ruotano
//      affatto;
//   3) il progresso deve SCADERE col periodo: se restasse, le missioni
//      di domani nascerebbero già a metà;
//   4) il sorteggio deve dipendere dall'orario del SERVER, non da quello
//      del dispositivo — che si sposta in due tocchi.
//
// `standalone`: serve sfide.html, non la pagina del duello.
const path = require('path');

module.exports = {
    name: 'Sfide: quattro sezioni, e missioni che ruotano davvero',
    standalone: true,
    async run({ browser, assert }) {
        const RADICE = path.join(__dirname, '..', '..');
        const url = 'file:///' + RADICE.replace(/\\/g, '/') + '/sfide.html';
        const context = await browser.newContext({
            viewport: { width: 1280, height: 950 },
            serviceWorkers: 'block'
        });
        await context.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await context.newPage();
        const erroriPagina = [];
        page.on('pageerror', (e) => erroriPagina.push(e.message));

        try {
            await page.goto(url);
            await page.waitForFunction(() => !!(window.ChallengeTracker && window.SaveManager), null, { timeout: 20000 });
            await page.evaluate(() => { if (!SaveManager.hasSave()) SaveManager.createNew('Tester'); });

            // --- Le quattro sezioni esistono e sono piene --------------
            const sezioni = await page.evaluate(() => {
                const s = ChallengeTracker.getSezioni();
                return {
                    schede: Array.from(document.querySelectorAll('.sv-tab')).map((b) => b.dataset.sezione),
                    generiche: s.generiche.length,
                    storie: Object.keys(s.storie).length,
                    giornaliere: ChallengeTracker.getMissions('daily').length,
                    settimanali: ChallengeTracker.getMissions('weekly').length
                };
            });
            ['giornaliere', 'settimanali', 'generiche', 'storie'].forEach((nome) => {
                assert(sezioni.schede.indexOf(nome) !== -1, `Manca la sezione "${nome}"`);
            });
            assert(sezioni.generiche > 40, `Poche Sfide generiche (${sezioni.generiche})`);
            assert(sezioni.storie >= 4, `Le Sfide delle storie devono coprire le campagne giocabili (${sezioni.storie})`);
            assert(sezioni.giornaliere === 4, `Le missioni di oggi devono essere 4 (rilevate ${sezioni.giornaliere})`);
            assert(sezioni.settimanali === 8, `Le missioni della settimana devono essere 8 (rilevate ${sezioni.settimanali})`);

            // --- Stesso periodo, stesse missioni ------------------------
            const primoGiro = await page.evaluate(() => ChallengeTracker.getMissions('daily').map((m) => m.id));
            await page.reload();
            await page.waitForFunction(() => !!window.ChallengeTracker, null, { timeout: 20000 });
            const secondoGiro = await page.evaluate(() => ChallengeTracker.getMissions('daily').map((m) => m.id));
            assert(primoGiro.join(',') === secondoGiro.join(','),
                `Riaprendo la pagina le missioni di oggi devono essere le stesse:\n  ${primoGiro}\n  ${secondoGiro}`);

            // ...e devono esserlo anche RISORTEGGIANDOLE da zero. Il
            // controllo qui sopra da solo non basta: il roster viene
            // salvato, quindi passerebbe anche con un sorteggio casuale —
            // verificato rimettendo un Math.random() al posto del seme, e
            // il test restava verde. Buttando via il roster salvato si
            // costringe il meccanismo a ripescare davvero, ed è l'unico
            // modo di provare che due giocatori diversi, nello stesso
            // giorno, vedono le stesse tre missioni.
            const risorteggiate = await page.evaluate(() => {
                const ids = [];
                for (let giro = 0; giro < 3; giro++) {
                    SaveManager.setMissionRoster('daily', ServerDate.dayKey(), null);
                    ids.push(ChallengeTracker.getMissions('daily').map((m) => m.id).join(','));
                }
                return ids;
            });
            assert(risorteggiate[0] === risorteggiate[1] && risorteggiate[1] === risorteggiate[2],
                'Il sorteggio dev\'essere deterministico sulla chiave del giorno, non casuale: '
                + risorteggiate.join(' | '));
            assert(risorteggiate[0] === primoGiro.join(','),
                `Risorteggiando lo stesso giorno devono uscire le stesse missioni: ${risorteggiate[0]} invece di ${primoGiro}`);

            // --- Un altro periodo ---------------------------------------
            // Si sposta la CHIAVE, non l'orologio: è il modo in cui il
            // meccanismo vede davvero un giorno o una settimana diversi.
            // Le 4 giornaliere sono generiche e SEMPRE le stesse (si azzera
            // solo il progresso); a ruotare sono le settimanali.
            const altroGiorno = await page.evaluate(() => {
                const vero = ServerDate.dayKey;
                ServerDate.dayKey = () => '2031-03-07';
                const ids = ChallengeTracker.getMissions('daily').map((m) => m.id);
                ServerDate.dayKey = vero;
                return ids;
            });
            assert(altroGiorno.length === 4, 'Anche un altro giorno deve avere 4 missioni');
            assert(altroGiorno.join(',') === primoGiro.join(','),
                `Le giornaliere sono sempre le stesse 4, nello stesso ordine: ${altroGiorno} invece di ${primoGiro}`);
            const generiche = await page.evaluate(() => ChallengeTracker.getMissions('daily').map((m) => ({ id: m.id, match: m.match })));
            assert(generiche.every((m) => m.id.indexOf('m-daily-') === 0
                && !('cardId' in m.match) && !('characterId' in m.match)),
                `Le giornaliere non chiedono una carta o un Duellante preciso: ${JSON.stringify(generiche)}`);
            const settimane = await page.evaluate(() => {
                const ids = (chiave) => {
                    const vero = ServerDate.weekKey;
                    ServerDate.weekKey = () => chiave;
                    const out = ChallengeTracker.getMissions('weekly').map((m) => m.id).join(',');
                    ServerDate.weekKey = vero;
                    return out;
                };
                return [ids('2031-W10'), ids('2031-W11'), ids('2031-W12')];
            });
            assert(new Set(settimane).size >= 2, 'Settimane diverse devono proporre missioni diverse, altrimenti non ruotano');
            // --- Il progresso scade col periodo -------------------------
            const scadenza = await page.evaluate(() => {
                const m = ChallengeTracker.getMissions('daily')[0];
                for (let i = 0; i < m.target; i++) ChallengeTracker.recordProgress(m.type, m.match || {});
                const oggi = SaveManager.getMissionProgress('daily', ServerDate.dayKey());
                const domani = SaveManager.getMissionProgress('daily', '2031-03-07');
                const dopo = ChallengeTracker.getMissions('daily').find((x) => x.id === m.id);
                return {
                    completata: !!(dopo && dopo.completed),
                    vociOggi: Object.keys(oggi).length,
                    vociAltroGiorno: Object.keys(domani).length
                };
            });
            assert(scadenza.completata, 'Raggiunto il target, la missione deve risultare completata');
            assert(scadenza.vociOggi > 0, 'Il progresso di oggi deve essere salvato');
            assert(scadenza.vociAltroGiorno === 0,
                'Il progresso NON deve sopravvivere al cambio di periodo: le missioni di domani nascerebbero già a metà');

            // --- L'orario viene dal server ------------------------------
            const orario = await page.evaluate(() => ({
                c: !!window.ServerDate,
                dice: !!document.querySelector('[data-sv="rotazione-avviso"]')
            }));
            assert(orario.c, 'sfide.html deve caricare js/cloud/server-date.js: la rotazione dipende da lì');
            assert(orario.dice,
                'Quando l\'orario non viene dal server va DETTO, come fa il Negozio, invece di fingere che sia tutto a posto');

            // Il menu non ha piu' una copia della schermata: le Sfide sono UNA pagina (sfide.html, che monta SfideView).
            assert(!require('fs').readFileSync(require('path').join(RADICE, 'index.html'), 'utf8').includes('id="view-sfide"'), 'index.html non deve contenere una seconda copia delle Sfide');

            assert(erroriPagina.length === 0, 'Errori JS in pagina: ' + erroriPagina.join(' | '));
        } finally {
            await context.close();
        }
    }
};
