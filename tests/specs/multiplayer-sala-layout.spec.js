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
                            passi: document.querySelectorAll('.mp-passi').length,
                            tabSvg: document.querySelectorAll('.mp-azioni svg.themed-icon').length,
                            azioni: document.querySelectorAll('.mp-azioni .mp-btn').length,
                            testoSpiegazione: /Apri una stanza|scegli arena e musica mentre aspetti/i.test(document.getElementById('mpLobby').textContent),
                            vecchieSchede: !!document.getElementById('mpTabCreate') || !!document.getElementById('mpPanelCreate'),
                            codiceVisibile: getComputedStyle(document.getElementById('mpPanelJoin')).display !== 'none',
                            scheda: Math.round(document.querySelector('.mp-azioni').getBoundingClientRect().width)
                        }));
                        // Due azioni sole (Crea stanza / Entra con codice), niente frase di spiegazione, il campo del codice solo a richiesta.
                        t.assert(m.azioni === 2, `${modo}: le azioni dell'ingresso devono essere due (sono ${m.azioni})`);
                        t.assert(!m.testoSpiegazione && !m.vecchieSchede, `${modo}: la frase di spiegazione o le vecchie schede sono tornate`);
                        t.assert(!m.codiceVisibile, `${modo}: il campo del codice deve comparire solo toccando "Entra con codice"`);
                        await page.click('#mpTabJoin');
                        t.assert(await page.evaluate(() => getComputedStyle(document.getElementById('mpPanelJoin')).display !== 'none' && document.activeElement === document.getElementById('mpJoinCode')), `${modo}: "Entra con codice" deve mostrare il campo e dargli il fuoco`);
                        await page.click('#mpTabJoin');
                        t.assert(m.sw <= m.iw + 1, `${modo} ${w}px: la pagina sborda (${m.sw} > ${m.iw})`);
                        t.assert(m.emblema, `${modo}: manca l'emblema a tema nell'intestazione`);
                        // I tre passi numerati sono stati tolti su richiesta dell'utente: non devono tornare.
                        t.assert(m.passi === 0, `${modo}: i passi numerati sono tornati`);
                        t.assert(m.tabSvg === 2, `${modo}: icone delle due azioni mancanti ${JSON.stringify(m)}`);
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
                    // Arena e musica restano il selettore di sempre (non compatto): su richiesta dell'utente era meglio cosi'.
                    const compatto = await page.evaluate(() => !!document.querySelector('#mpSetupMount .ds-setup--compact'));
                    t.assert(!compatto, `${w}px: il selettore arena/musica della sala non deve essere compatto`);

                    // La sala e' CORTA: pedina, mazzo e arena+musica sono tre righe riassuntive, non tre selettori aperti.
                    const corta = await page.evaluate(() => ({ fondo: document.getElementById('mpSetup').getBoundingClientRect().bottom + window.scrollY, ih: innerHeight, tessere: document.querySelectorAll('.mp-tessera').length }));
                    t.assert(corta.tessere === 3, `${w}px: servono tre riquadri riassuntivi (pedina, mazzo, arena e musica), ce ne sono ${corta.tessere}`);
                    t.assert(corta.fondo <= corta.ih * 1.6, `${w}px: la sala e' ancora troppo lunga (finisce a ${Math.round(corta.fondo)}px su uno schermo di ${corta.ih})`);

                    // Un tocco sul riquadro apre la finestra con il selettore vero; Esc la chiude e lo rimette a posto.
                    await page.click('#mpPedinaGroup .mp-tessera');
                    const aperta = await page.evaluate(() => ({ visibile: !document.getElementById('mpModale').hidden, dentro: !!document.querySelector('#mpModaleCorpo .mp-pedina-attuale') }));
                    t.assert(aperta.visibile && aperta.dentro, `${w}px: il riquadro del duellante deve aprire la finestra col selettore ${JSON.stringify(aperta)}`);
                    await page.keyboard.press('Escape');
                    const chiusa = await page.evaluate(() => ({ nascosta: document.getElementById('mpModale').hidden, aPosto: document.getElementById('mpPedina').parentElement.classList.contains('mp-deposito') }));
                    t.assert(chiusa.nascosta && chiusa.aPosto, `${w}px: chiusa la finestra il selettore deve tornare nel suo deposito ${JSON.stringify(chiusa)}`);

                    // Cambiare arena dalla finestra aggiorna il riquadro con il suo nome.
                    await page.click('#mpSetup .mp-tessera');
                    await page.waitForSelector('#mpModaleCorpo .ds-field:not(.ds-field--random)', { timeout: 5000 });
                    const scelta = await page.evaluate(() => {
                        const el = document.querySelectorAll('#mpModaleCorpo .ds-field:not(.ds-field--random)')[2];
                        el.click();
                        return { file: el.dataset.file, nome: ArenaOptions.nomeCampo(el.dataset.file) };
                    });
                    await page.click('.mp-modale-fatto');
                    const tessera = await page.evaluate(() => document.querySelector('#mpSetup .mp-tessera b').textContent);
                    t.assert(tessera === scelta.nome, `${w}px: il riquadro dell'arena dice "${tessera}" invece di "${scelta.nome}"`);
                } finally { await ctx.close(); }
            }

            // --- Foro della fotocamera: su telefono la sala non comincia sotto di lui ---
            {
                const touch = async (w, h) => {
                    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
                    await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
                    const page = await ctx.newPage();
                    await page.goto(URL('duello'));
                    await page.waitForSelector('#mpCreateBtn');
                    return { ctx, page };
                };
                {
                    const { ctx, page } = await touch(390, 844);
                    try {
                        const ingresso = await page.evaluate(() => document.querySelector('.mp-hero').getBoundingClientRect().top);
                        t.assert(ingresso >= 30, `ingresso: l'intestazione comincia a ${ingresso}px, sotto il foro della fotocamera (minimo 30)`);
                        await page.click('#mpCreateBtn');
                        await page.waitForSelector('#mpCodeTiles .mp-code-tile', { timeout: 30000 });
                        await page.evaluate(() => window.scrollTo(0, 0));
                        const sala = await page.evaluate(() => document.getElementById('mpRoomCodeBox').getBoundingClientRect().top);
                        t.assert(sala >= 30, `sala: il codice comincia a ${sala}px, sotto il foro della fotocamera (minimo 30)`);
                    } finally { await ctx.close(); }
                }
                {
                    const { ctx, page } = await touch(844, 390);
                    try {
                        const sx = await page.evaluate(() => document.querySelector('.mp-hero').getBoundingClientRect().left);
                        t.assert(sx >= 30, `orizzontale: l'intestazione comincia a ${sx}px dal bordo, troppo vicino al foro della fotocamera (minimo 30)`);
                    } finally { await ctx.close(); }
                }
            }
        } finally { muto.close(); }
    }
};
