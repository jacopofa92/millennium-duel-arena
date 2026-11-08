// Bonus d'accesso giornaliero (js/economy/login-bonus.js): calendario di 7 giorni che non punisce, premi non sgravi.
// ===============================================================================================================
// Si prova con la data del server finta (ServerDate.dayKey/isTrusted sostituiti): riscossione, una sola volta al giorno, giorni saltati
// senza perdite, ciclo che riparte, premio mensile ogni 28 accessi, Busta Base in regalo, e NIENTE senza data attendibile.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Bonus d\'accesso: 7 giorni che non puniscono, una volta al giorno, premio mensile, Busta Base in regalo',
    standalone: true,
    async run({ browser, assert }) {
        const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, serviceWorkers: 'block' });
        await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await ctx.newPage();
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await page.goto(url('negozio.html'));
            await page.waitForFunction(() => !!(window.LoginBonus && window.SaveManager && window.ServerDate));
            const r = await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Accessi');
                const save = SaveManager.load();
                save.currency = Object.assign({}, save.currency, { credits: 0, starChips: 0, locatorCards: 0, millenniumCards: 0 });
                SaveManager.touch(save);
                const w = () => SaveManager.getCurrency();
                const out = { tabella: LoginBonus.PREMI.map((p) => [p.crediti || 0, p.stelle || 0, p.buonoBusta || 0]) };
                let giorno = 1;
                const imposta = (n, fidato) => { ServerDate.dayKey = () => '2099-02-' + String(n).padStart(2, '0'); ServerDate.isTrusted = () => fidato !== false; };
                // Senza data attendibile (offline) il bonus non si offre e non si riscuote.
                imposta(1, false);
                out.offline = [LoginBonus.stato().disponibile, LoginBonus.riscuoti().ok];
                // Giorno 1: 100 Crediti. Lo stesso giorno non si riscuote due volte.
                imposta(1);
                out.g1 = LoginBonus.riscuoti();
                out.dopoG1 = w().credits;
                out.stessoGiorno = [LoginBonus.stato().disponibile, LoginBonus.riscuoti().ok];
                // Si salta un giorno (il 2 febbraio non si entra): il 3 si prende il premio del GIORNO 2, senza perdere niente.
                imposta(3);
                out.g2 = LoginBonus.riscuoti();
                out.dopoG2 = w().credits;
                // Giorno 3 del ciclo: 1 Stella.
                imposta(4);
                LoginBonus.riscuoti();
                out.dopoG3 = [w().credits, w().starChips];
                // Giorno 4: 200 Crediti, giorno 5: Busta Base in regalo (un buono, non carte ne' Crediti).
                imposta(5); LoginBonus.riscuoti();
                imposta(6); const g5 = LoginBonus.riscuoti();
                out.g5 = g5.voci;
                out.buoni = LoginBonus.buoniBusta();
                out.creditiDopoG5 = w().credits;
                // Il buono si spende una volta sola.
                out.usa = [LoginBonus.usaBuonoBusta(), LoginBonus.usaBuonoBusta()];
                // Giorni 6 e 7, poi il ciclo riparte dal giorno 1.
                imposta(7); LoginBonus.riscuoti();
                imposta(8); LoginBonus.riscuoti();
                out.dopoCiclo = [w().credits, w().starChips];
                imposta(9);
                out.ripartito = LoginBonus.stato().indice;
                // Mai Carte del Millennio, e la Locazione solo al 28o accesso.
                out.milleniumMai = w().millenniumCards;
                out.locazioneProva = w().locatorCards;
                return out;
            });
            assert(JSON.stringify(r.tabella) === JSON.stringify([[100, 0, 0], [150, 0, 0], [0, 1, 0], [200, 0, 0], [0, 0, 1], [250, 0, 0], [300, 1, 0]]), `la tabella dei premi: ${JSON.stringify(r.tabella)}`);
            assert(r.offline[0] === false && r.offline[1] === false, `offline il bonus non si offre ne' si riscuote: ${JSON.stringify(r.offline)}`);
            assert(r.g1.ok && r.dopoG1 === 100, `giorno 1: 100 Crediti (${r.dopoG1})`);
            assert(r.stessoGiorno[0] === false && r.stessoGiorno[1] === false, 'lo stesso giorno non si riscuote due volte');
            assert(r.g2.ok && r.dopoG2 === 250, `un giorno saltato non fa perdere niente: il giorno dopo c'e' il premio 2 (${r.dopoG2})`);
            assert(r.dopoG3[0] === 250 && r.dopoG3[1] === 1, `giorno 3: 1 Stella: ${JSON.stringify(r.dopoG3)}`);
            assert(r.g5.length === 1 && r.g5[0].tipo === 'bustaBase' && r.buoni === 1 && r.creditiDopoG5 === 450, `giorno 5: un buono Busta Base e nient'altro: ${JSON.stringify([r.g5, r.buoni, r.creditiDopoG5])}`);
            assert(r.usa[0] === true && r.usa[1] === false, 'il buono si spende una volta sola');
            assert(r.dopoCiclo[0] === 450 + 250 + 300 && r.dopoCiclo[1] === 2, `giorni 6 e 7: ${JSON.stringify(r.dopoCiclo)}`);
            assert(r.ripartito === 0, `finito il ciclo si riparte dal giorno 1 (${r.ripartito})`);
            assert(r.milleniumMai === 0 && r.locazioneProva === 0, 'ne Carte del Millennio ne Locazione prima del 28o accesso');

            // Il 28o accesso: in piu' 1 Carta Locazione, ma NON con la tabella settimanale.
            const mensile = await page.evaluate(() => {
                const s = SaveManager.getModeState('loginBonus');
                SaveManager.setModeState('loginBonus', Object.assign({}, s, { accessi: 27, ultimo: '' }));
                ServerDate.dayKey = () => '2099-03-01';
                const prima = SaveManager.getCurrency().locatorCards;
                const st = LoginBonus.stato();
                const r2 = LoginBonus.riscuoti();
                return { scatta: st.scattaMensile, voci: r2.voci.map((v) => v.tipo), dopo: SaveManager.getCurrency().locatorCards - prima };
            });
            assert(mensile.scatta && mensile.dopo === 1 && mensile.voci.includes('locatorCards'), `ogni 28 accessi 1 Carta Locazione: ${JSON.stringify(mensile)}`);

            // Il riquadro: sette giorni, quello di oggi evidenziato, "Riscuoti" paga e diventa una ricevuta.
            const riquadro = await page.evaluate(() => {
                SaveManager.setModeState('loginBonus', { ultimo: '', giorno: 2, accessi: 4 });
                ServerDate.dayKey = () => '2099-04-01';
                const prima = SaveManager.getCurrency().starChips;
                LoginBonus.mostra();
                const giorni = document.querySelectorAll('.lb-giorno').length;
                const oggi = document.querySelector('.lb-giorno.is-oggi small').textContent;
                const presi = document.querySelectorAll('.lb-giorno.is-preso').length;
                document.querySelector('.lb-btn--oro').click();
                return { giorni, oggi, presi, ricevuta: document.querySelector('.lb-scheda').classList.contains('is-riscosso'), stelle: SaveManager.getCurrency().starChips - prima };
            });
            assert(riquadro.giorni === 7 && riquadro.oggi === 'Giorno 3' && riquadro.presi === 2, `il riquadro: ${JSON.stringify(riquadro)}`);
            assert(riquadro.ricevuta && riquadro.stelle === 1, `Riscuoti paga e mostra la ricevuta: ${JSON.stringify(riquadro)}`);

            // Il Negozio: con un buono compare "Apri gratis" sulla Busta Base, che non costa Crediti e non conta nel limite giornaliero.
            const negozio = await page.evaluate(async () => {
                SaveManager.setModeState('buoniBusta', { base: 1 });
                const save = SaveManager.load();
                save.currency.credits = 0; save.currency.starChips = 0;
                SaveManager.touch(save);
                return true;
            });
            await page.reload();
            await page.waitForSelector('.shop-item .buy-btn', { timeout: 15000 });
            const gratis = await page.evaluate(() => !!document.querySelector('.buy-btn.gratis'));
            assert(negozio && gratis, 'con un buono il Negozio offre "Apri gratis" sulla Busta Base');
            assert(errori.length === 0, `nessun errore: ${errori.join(' | ')}`);
        } finally {
            await ctx.close();
        }
    }
};
