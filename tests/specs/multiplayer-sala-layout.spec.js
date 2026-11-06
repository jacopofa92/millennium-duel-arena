const net = require('net');
const path = require('path');

// Le schermate "Apri stanza" (ingresso e sala d'attesa) di tutte le modalita': nessuno sbordo laterale, la console KaibaCorp di
// connessione resta dentro la colonna e sopra la barra in basso, due colonne su desktop, posti affiancati su telefono.
const RADICE = path.join(__dirname, '..', '..');
const URL = (modo) => 'file:///' + path.join(RADICE, 'multiplayer.html').replace(/\\/g, '/') + '?modo=' + modo;

module.exports = {
    standalone: true,
    name: 'Multiplayer: schermate Apri stanza senza sbordi, console KaibaCorp contenuta, sala a due colonne',
    async run(t) {
        // Un server che accetta la connessione e non risponde mai: la console resta in "connessione in corso".
        const muto = net.createServer((s) => s.on('error', () => {}));
        await new Promise((r) => muto.listen(0, '127.0.0.1', r));
        const porta = muto.address().port;
        const browser = t.browser;
        const nuova = async (w, h, modo) => {
            const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
            await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
            const page = await ctx.newPage();
            await page.goto(URL(modo));
            await page.waitForSelector('#mpCreateBtn');
            return { ctx, page };
        };
        try {
            // --- Ingresso: ogni modalita', telefono piccolo e desktop ---
            for (const modo of ['duello', 'specchio', 'raid', 'tag']) {
                for (const [w, h] of [[320, 568], [390, 844], [1366, 800]]) {
                    const { ctx, page } = await nuova(w, h, modo);
                    try {
                        const m = await page.evaluate(() => ({
                            sw: document.documentElement.scrollWidth, iw: innerWidth,
                            emblema: !!document.querySelector('.mp-hero-emblema svg.themed-icon'),
                            passi: document.querySelectorAll('.mp-passi li').length,
                            tabSvg: document.querySelectorAll('.mp-tab svg.themed-icon').length,
                            scheda: Math.round(document.getElementById('mpPanelCreate').getBoundingClientRect().width)
                        }));
                        t.assert(m.sw <= m.iw + 1, `${modo} ${w}px: la pagina sborda (${m.sw} > ${m.iw})`);
                        t.assert(m.emblema, `${modo}: manca l'emblema a tema nell'intestazione`);
                        t.assert(m.passi === 3 && m.tabSvg === 2, `${modo}: passi o icone dei segmenti mancanti ${JSON.stringify(m)}`);
                        if (w >= 700) t.assert(m.scheda <= 600, `${modo} ${w}px: la scheda di ingresso non e' una colonna (larga ${m.scheda})`);
                    } finally { await ctx.close(); }
                }
            }

            // --- Console KaibaCorp mentre si connette: dentro la colonna, sopra la barra, riga attiva leggibile ---
            for (const [w, h] of [[320, 568], [390, 844], [844, 390], [1366, 800]]) {
                const { ctx, page } = await nuova(w, h, 'duello');
                try {
                    await page.evaluate((p) => { document.getElementById('mpServerUrl').value = 'ws://127.0.0.1:' + p; }, porta);
                    await page.click('#mpCreateBtn');
                    await page.waitForSelector('#mpStatus .mp-term .mp-term-line.is-attiva', { timeout: 10000 });
                    await page.waitForTimeout(2500);
                    const m = await page.evaluate(() => {
                        const r = (e) => e.getBoundingClientRect();
                        const st = r(document.getElementById('mpStatus'));
                        const corpo = document.getElementById('mpTermBody');
                        const attiva = corpo.querySelector('.is-attiva');
                        const barra = document.querySelector('.mm-ctx, [class*="mm-barra"], #mmTabBar');
                        return {
                            sw: document.documentElement.scrollWidth, iw: innerWidth,
                            stSx: st.left, stDx: st.right,
                            attivaVisibile: !!attiva && r(attiva).bottom <= r(corpo).bottom + 1 && r(attiva).top >= r(corpo).top - 1,
                            sopraBarra: barra ? st.bottom <= r(barra).top + 1 : true
                        };
                    });
                    t.assert(m.sw <= m.iw + 1, `console ${w}px: la pagina sborda (${m.sw} > ${m.iw})`);
                    t.assert(m.stSx >= -1 && m.stDx <= m.iw + 1, `console ${w}px: fuori dallo schermo (${m.stSx}..${m.stDx})`);
                    t.assert(m.attivaVisibile, `console ${w}x${h}: la riga attiva e' tagliata fuori dal corpo della console`);
                    t.assert(m.sopraBarra, `console ${w}x${h}: finisce sotto la barra di navigazione`);
                } finally { await ctx.close(); }
            }

            // --- Sala d'attesa (server vero del test): due colonne su desktop, posti affiancati su telefono ---
            const sala = async (w, h) => {
                const { ctx, page } = await nuova(w, h, 'duello');
                await page.click('#mpCreateBtn');
                await page.waitForSelector('#mpCodeTiles .mp-code-tile', { timeout: 30000 });
                return { ctx, page };
            };
            {
                const { ctx, page } = await sala(1366, 800);
                try {
                    const m = await page.evaluate(() => {
                        const r = (s) => document.querySelector(s).getBoundingClientRect();
                        return { codice: r('#mpRoomCodeBox'), setup: r('#mpSetup'), sw: document.documentElement.scrollWidth, iw: innerWidth };
                    });
                    t.assert(m.codice.right <= m.setup.left + 1, `desktop: la stanza non sta a sinistra delle scelte (${m.codice.right} > ${m.setup.left})`);
                    t.assert(m.sw <= m.iw + 1, 'desktop: la sala sborda');
                } finally { await ctx.close(); }
            }
            for (const [w, h] of [[320, 568], [390, 844]]) {
                const { ctx, page } = await sala(w, h);
                try {
                    const m = await page.evaluate(() => {
                        const r = (s) => document.querySelector(s).getBoundingClientRect();
                        const tu = r('.mp-seat--you'), lui = r('#mpSeatOpponent');
                        return { tuTop: tu.top, luiTop: lui.top, tuDx: tu.right, luiSx: lui.left, sw: document.documentElement.scrollWidth, iw: innerWidth };
                    });
                    t.assert(Math.abs(m.tuTop - m.luiTop) < 2 && m.tuDx <= m.luiSx, `${w}px: i due posti non sono affiancati ${JSON.stringify(m)}`);
                    t.assert(m.sw <= m.iw + 1, `${w}px: la sala sborda`);
                    // La lista delle musiche e' compatta: scorre dentro una finestra invece di occupare mezza sala.
                    const tracce = await page.evaluate(() => { const e = document.querySelector('#mpSetupMount .ds-tracks'); return e ? { h: Math.round(e.getBoundingClientRect().height), scroll: e.scrollHeight > e.clientHeight } : null; });
                    t.assert(tracce && tracce.h <= 200 && tracce.scroll, `${w}px: la lista delle musiche non e' compatta ${JSON.stringify(tracce)}`);
                } finally { await ctx.close(); }
            }
        } finally { muto.close(); }
    }
};
