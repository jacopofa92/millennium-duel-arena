// Sul telefono (puntatore a tocco) la carta in dettaglio NON si inclina e non
// ondeggia — richiesta dell'utente — ma il giroscopio continua a muovere la
// LUCE (riflesso, bordo lucido, arcobaleno, grana): le variabili --luce-x,
// --luce-y e --forza cambiano ancora, solo il transform resta fermo.
// Sul computer (mouse) l'inclinazione resta com'era: lo sorveglia
// carte-vive-e-parallasse.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

module.exports = {
    name: 'Carta in dettaglio su telefono: dritta, ma la luce segue il giroscopio',
    standalone: true,
    async run({ browser, assert }) {
        const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
        await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        const page = await ctx.newPage();
        try {
            await page.goto(url('cartoteca.html'));
            await page.waitForFunction(() => window.CardDetail && window.CardRarity && typeof cardDatabase !== 'undefined'
                && document.querySelector('.card.carta-viva'), null, { timeout: 30000 });
            await page.evaluate(() => {
                const carta = cardDatabase.find((c) => (!c.origin || c.origin === 'yu-gi-oh') && CardRarity.of(c.id) === 'ultra');
                CardDetail.open(carta);
            });
            await page.waitForTimeout(400);

            const stato = () => page.evaluate(() => {
                const el = document.querySelector('.cd-preview .card');
                const cs = getComputedStyle(el);
                return {
                    transform: cs.transform, animazione: cs.animationName,
                    luceX: el.style.getPropertyValue('--luce-x'), forza: el.style.getPropertyValue('--forza'),
                    incY: el.style.getPropertyValue('--inc-y'), riflesso: !!el.querySelector('.cv-riflesso')
                };
            });

            const riposo = await stato();
            assert(riposo.riflesso, 'la carta in dettaglio ha comunque il suo riflesso');
            assert(riposo.transform === 'none', `a riposo la carta resta dritta (nessun ondeggiamento): ${riposo.transform}`);
            assert(riposo.animazione === 'none', `nessuna animazione di ondeggiamento: ${riposo.animazione}`);

            // Il telefono si inclina a destra: la luce si sposta, la carta no.
            await page.evaluate(async () => {
                const manda = (beta, gamma) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta, gamma }));
                manda(40, 0);
                await new Promise((r) => requestAnimationFrame(() => r()));
                manda(40, 18);
                await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
            });
            const inclinato = await stato();
            assert(parseFloat(inclinato.luceX) > 55, `il giroscopio sposta la luce a destra: --luce-x = ${inclinato.luceX}`);
            assert(parseFloat(inclinato.forza) > 0.2, `il giroscopio accende la luce: --forza = ${inclinato.forza}`);
            assert(inclinato.transform === 'none', `col telefono inclinato la carta resta dritta: ${inclinato.transform}`);
        } finally {
            await ctx.close();
        }

        // --- Opzione "Giroscopio sulle carte" SPENTA nelle Impostazioni ---
        // La carta resta dritta e il telefono non guida più la luce: questa
        // si muove piano da sola (solo luce, mai la carta).
        const spento = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
        await spento.addInitScript(() => {
            window.AUTH_GATE_SKIP = true;
            try { localStorage.setItem('ygoGiroscopioCarte', 'off'); } catch (e) { /* storage non disponibile */ }
        });
        const pagina = await spento.newPage();
        try {
            await pagina.goto(url('cartoteca.html'));
            await pagina.waitForFunction(() => window.CardDetail && window.CardRarity && typeof cardDatabase !== 'undefined'
                && document.querySelector('.card.carta-viva'), null, { timeout: 30000 });
            await pagina.evaluate(() => {
                CardDetail.open(cardDatabase.find((c) => (!c.origin || c.origin === 'yu-gi-oh') && CardRarity.of(c.id) === 'ultra'));
            });
            await pagina.waitForTimeout(300);
            const leggi = () => pagina.evaluate(() => {
                const el = document.querySelector('.cd-preview .card');
                const cs = getComputedStyle(el);
                return { transform: cs.transform, animazione: cs.animationName, luceX: parseFloat(cs.getPropertyValue('--luce-x')), viva: el.classList.contains('cv-luce-viva') };
            });
            const a = await leggi();
            assert(a.viva && a.animazione === 'cvLuceOzio', `a giroscopio spento parte l'animazione della sola luce: ${JSON.stringify(a)}`);
            assert(a.transform === 'none', `la carta resta dritta anche col giroscopio spento: ${a.transform}`);
            await pagina.waitForTimeout(1500);
            const b = await leggi();
            assert(Math.abs(b.luceX - a.luceX) > 3, `la luce si muove da sola: ${a.luceX} -> ${b.luceX}`);
            // Il telefono inclinato non cambia nulla: il sensore è ignorato.
            await pagina.evaluate(async () => {
                const manda = (beta, gamma) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta, gamma }));
                manda(40, 0);
                await new Promise((r) => requestAnimationFrame(() => r()));
                manda(40, 25);
                await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
            });
            const dopoSensore = await leggi();
            assert(dopoSensore.viva && dopoSensore.animazione === 'cvLuceOzio' && dopoSensore.transform === 'none',
                `col giroscopio spento il sensore non guida la luce: ${JSON.stringify(dopoSensore)}`);
        } finally {
            await spento.close();
        }

        // --- L'interruttore nelle Impostazioni (pagina e vista del menu) ---
        for (const [file, id, apri] of [['impostazioni.html', 'cardGyroToggleInput', null]]) {
            const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
            await c.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
            const p = await c.newPage();
            try {
                await p.goto(url(file));
                await p.waitForFunction(() => window.Inclinazione && window.SaveManager, null, { timeout: 30000 });
                if (apri) await p.evaluate(apri);
                await p.waitForSelector('#' + id, { state: 'attached', timeout: 15000 });
                const r = await p.evaluate(async (id) => {
                    const el = document.getElementById(id);
                    const inizio = el.checked;
                    el.checked = false;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    await new Promise((x) => setTimeout(x, 200));
                    return { inizio, impostazione: SaveManager.getSetting('cardGyro'), cache: localStorage.getItem('ygoGiroscopioCarte'), attivo: Inclinazione.giroscopioCarteAttivo() };
                }, id);
                assert(r.inizio === true, `${file}: l'opzione parte accesa (default): ${JSON.stringify(r)}`);
                assert(r.impostazione === false && r.cache === 'off' && r.attivo === false, `${file}: spenta, vale nel salvataggio e nella cache: ${JSON.stringify(r)}`);
            } finally {
                await c.close();
            }
        }
    }
};
