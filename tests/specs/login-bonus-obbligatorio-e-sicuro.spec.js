// Bonus d'accesso: riquadro OBBLIGATORIO (si chiude solo riscuotendo) e riscossione che non puo' dare il premio a meta'
// (js/economy/login-bonus.js + SaveManager.transazione). Richiesta dell'utente: il premio non deve potersi mancare.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Bonus d\'accesso: riquadro obbligatorio, riscossione tutto-o-niente, ricevuta, e ricomparsa quando torna la data del server',
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

            // 1) Il riquadro non si chiude: niente "Dopo", Esc e tocco fuori non fanno nulla; si chiude solo riscuotendo ("Fatto").
            const a = await page.evaluate(async () => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Bonus');
                SaveManager.setModeState('loginBonus', { ultimo: '', giorno: 0, accessi: 0 });
                const s0 = SaveManager.load(); s0.currency = Object.assign({}, s0.currency, { credits: 0, starChips: 0, locatorCards: 0 }); SaveManager.touch(s0);
                ServerDate.dayKey = () => '2099-05-01'; ServerDate.isTrusted = () => true;
                LoginBonus.mostra();
                const velo = document.querySelector('.lb-velo');
                const bottoni = Array.from(velo.querySelectorAll('button')).map((b) => b.textContent.trim());
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                velo.click();
                await new Promise((r) => setTimeout(r, 150));
                return { bottoni, ancoraAperto: !!document.querySelector('.lb-velo') };
            });
            assert(JSON.stringify(a.bottoni) === JSON.stringify(['Riscuoti']), `Solo "Riscuoti": ${JSON.stringify(a.bottoni)}`);
            assert(a.ancoraAperto, 'Esc e un tocco fuori non chiudono il riquadro');
            await page.evaluate(() => document.querySelector('.lb-btn--oro').click());
            const dopo = await page.evaluate(() => ({ crediti: SaveManager.load().currency.credits, ricevuta: document.querySelector('.lb-scheda').classList.contains('is-riscosso'), ultima: SaveManager.getModeState('loginBonus').ultima }));
            assert(dopo.crediti === 100 && dopo.ricevuta, `Riscuotere paga e mostra la ricevuta: ${JSON.stringify(dopo)}`);
            assert(dopo.ultima && dopo.ultima.data === '2099-05-01' && dopo.ultima.voci[0].tipo === 'credits' && dopo.ultima.voci[0].quantita === 100, `La ricevuta e' salvata: ${JSON.stringify(dopo.ultima)}`);
            await page.evaluate(() => document.querySelector('.lb-btn--oro').click());   // "Fatto"
            assert(await page.evaluate(() => !document.querySelector('.lb-velo')), 'Dopo aver riscosso, "Fatto" chiude il riquadro');

            // 2) Doppio tocco e doppia chiamata: si paga UNA volta.
            const b = await page.evaluate(() => {
                SaveManager.setModeState('loginBonus', { ultimo: '', giorno: 2, accessi: 4 });   // giorno 3: 1 Stella
                ServerDate.dayKey = () => '2099-05-02';
                const prima = SaveManager.load().currency.starChips;
                const r1 = LoginBonus.riscuoti(); const r2 = LoginBonus.riscuoti();
                return { r1: r1.ok, r2: r2.ok, stelle: SaveManager.load().currency.starChips - prima, stato: SaveManager.getModeState('loginBonus') };
            });
            assert(b.r1 && !b.r2 && b.stelle === 1 && b.stato.giorno === 3 && b.stato.accessi === 5, `Una sola volta: ${JSON.stringify(b)}`);

            // 3) Scrittura che fallisce: NIENTE a meta' (ne' premio senza giorno segnato, ne' giorno segnato senza premio), e si puo' riprovare.
            const c = await page.evaluate(() => {
                SaveManager.setModeState('loginBonus', { ultimo: '', giorno: 0, accessi: 10 });
                ServerDate.dayKey = () => '2099-05-03';
                const prima = JSON.stringify([SaveManager.load().currency, SaveManager.getModeState('loginBonus')]);
                const originale = Storage.prototype.setItem;
                Storage.prototype.setItem = function () { throw new Error('spazio esaurito (finto)'); };
                let fallita;
                try { fallita = LoginBonus.riscuoti(); } finally { Storage.prototype.setItem = originale; }
                const dopoFallita = JSON.stringify([SaveManager.load().currency, SaveManager.getModeState('loginBonus')]);
                const riprovo = LoginBonus.riscuoti();
                return { fallita: fallita.ok, motivo: fallita.motivo, invariato: prima === dopoFallita, riprovo: riprovo.ok, crediti: SaveManager.load().currency.credits - JSON.parse(prima)[0].credits, giorno: SaveManager.getModeState('loginBonus').giorno };
            });
            assert(!c.fallita && c.motivo === 'non-salvato' && c.invariato, `Scrittura fallita: tutto com'era (${JSON.stringify(c)})`);
            assert(c.riprovo && c.crediti === 100 && c.giorno === 1, `Riprovando si paga una volta sola: ${JSON.stringify(c)}`);

            // 4) La verifica dopo la scrittura: se i conti non tornano, si annulla (qui si simula un salvataggio che "perde" i crediti).
            const d = await page.evaluate(() => {
                SaveManager.setModeState('loginBonus', { ultimo: '', giorno: 0, accessi: 20 });
                ServerDate.dayKey = () => '2099-05-04';
                const prima = SaveManager.load().currency.credits;
                const originale = SaveManager.transazione;
                SaveManager.transazione = (modifica, verifica) => originale((copia) => { const r = modifica(copia); copia.currency.credits -= 40; return r; }, verifica);
                let r;
                try { r = LoginBonus.riscuoti(); } finally { SaveManager.transazione = originale; }
                return { ok: r.ok, invariato: SaveManager.load().currency.credits === prima, ultimo: SaveManager.getModeState('loginBonus').ultimo };
            });
            assert(!d.ok && d.invariato && d.ultimo === '', `Conti che non tornano: annullato tutto (${JSON.stringify(d)})`);

            // 5) Il menu (index.html): senza data attendibile non si offre, e compare da solo appena torna.
            const menu = await ctx.newPage();
            menu.on('pageerror', (e) => errori.push(e.message));
            await menu.goto(url('index.html'));
            await menu.waitForTimeout(2500);
            const m = await menu.evaluate(async () => {
                const splash = document.getElementById('splashScreen'); if (splash) splash.style.display = 'none';
                if (!SaveManager.hasSave()) SaveManager.createNew('Menu');
                SaveManager.setTutorial({ daFare: false, completata: true });
                SaveManager.setModeState('loginBonus', { ultimo: '', giorno: 0, accessi: 0 });
                let fidato = false;
                ServerDate.dayKey = () => '2099-06-01'; ServerDate.isTrusted = () => fidato; ServerDate.sync = () => Promise.resolve();
                window.showMenu();
                await new Promise((r) => setTimeout(r, 400));
                const offline = !!document.querySelector('.lb-velo');
                fidato = true;
                window.dispatchEvent(new Event('online'));
                await new Promise((r) => setTimeout(r, 400));
                return { offline, tornato: !!document.querySelector('.lb-velo'), bottoni: Array.from(document.querySelectorAll('.lb-velo button')).map((x) => x.textContent.trim()) };
            });
            assert(!m.offline, 'Senza data del server il bonus non si offre');
            assert(m.tornato && JSON.stringify(m.bottoni) === JSON.stringify(['Riscuoti']), `Tornata la data, il riquadro compare da solo: ${JSON.stringify(m)}`);

            assert(errori.length === 0, `nessun errore: ${errori.join(' | ')}`);
        } finally {
            await ctx.close();
        }
    }
};
