// Duello della Settimana (js/modes/settimana*.js) e Caccia al Boss (js/modes/caccia*.js).
// Cosa si controlla:
//  - la rotazione: la regola, l'avversario e il Boss cambiano ogni lunedì UTC (e non un istante prima), due
//    settimane di fila sono diverse, e lo stato salvato di una settimana passata non conta;
//  - la regola applicata a un mazzo: per OGNI regola del catalogo i mostri risultano tutti ammessi, il mazzo
//    ha le stesse carte di prima, le altre carte non si toccano e nessuna ne ha più di 3 copie;
//  - il duello vero della settimana: i mazzi in campo di ENTRAMBI rispettano la regola, e la prima vittoria
//    a un livello paga una volta sola;
//  - la caccia vera: il Boss parte con i Life Point della caccia, comincia il giocatore, finiti i turni la
//    caccia è persa, e la prima vittoria della settimana paga una volta sola (con bonus se veloce);
//  - le pagine: mostrano la regola/il Boss e lanciano il duello con l'URL giusto.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');
const DUELLO = url('duelMonstersCore.html');

const PRELUDIO = () => { window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true; };

module.exports = {
    standalone: true,
    name: 'Duello della Settimana e Caccia al Boss: rotazione, regola sui mazzi, premi una volta a settimana, pagine',
    async run(t) {
        const errori = [];
        const apri = async (viewport) => {
            const page = await t.browser.newPage({ viewport: viewport || { width: 1400, height: 900 } });
            page.on('pageerror', (e) => errori.push(e.message));
            await page.addInitScript(PRELUDIO);
            return page;
        };

        // ---------- 1) Rotazione e stato (nella pagina del duello, che carica tutto)
        {
            const page = await apri();
            try {
                await page.goto(DUELLO);
                await page.waitForFunction(() => typeof Settimana !== 'undefined' && typeof Caccia !== 'undefined' && typeof cardDatabase !== 'undefined', null, { timeout: 30000 });
                const r = await page.evaluate(() => {
                    const regolaA = (ms) => { ServerDate.now = () => new Date(ms); return Settimana.regola().id + '|' + Settimana.avversario() + '|' + Caccia.boss().id; };
                    const lunedi = Date.UTC(2026, 9, 26, 0, 0, 0); // lunedì 26 ottobre 2026
                    const out = {
                        prima: regolaA(lunedi - 1),
                        dopo: regolaA(lunedi),
                        stessaSettimana: regolaA(lunedi + 6 * 86400000 + 86399000),
                        prossima: regolaA(lunedi + 7 * 86400000)
                    };
                    // Due settimane di fila: regola e Boss sempre diversi, per tutto il giro del catalogo.
                    let ripetizioni = 0;
                    let precedente = null;
                    for (let i = 0; i < 60; i++) {
                        ServerDate.now = () => new Date(lunedi + i * 7 * 86400000);
                        const c = Settimana.regola().id + '|' + Caccia.boss().id;
                        const [a, b] = c.split('|');
                        if (precedente && (precedente[0] === a || precedente[1] === b)) ripetizioni++;
                        precedente = [a, b];
                    }
                    out.ripetizioni = ripetizioni;
                    // Stato: una settimana passata non conta, la prima vittoria paga e la seconda no.
                    ServerDate.now = () => new Date(lunedi);
                    SaveManager.setModeState('settimana', { chiave: String(Settimana.indiceSettimana() - 1), vinte: { Difficile: true } });
                    out.vecchiaIgnorata = Object.keys(Settimana.stato().vinte).length === 0;
                    out.primo = Settimana.registraVittoria('Facile');
                    out.secondo = Settimana.registraVittoria('Facile');
                    out.altroLivello = Settimana.registraVittoria('Difficile');
                    SaveManager.setModeState('caccia', null);
                    out.cacciaVeloce = Caccia.registraVittoria(4);
                    out.cacciaDopo = Caccia.registraVittoria(2);
                    out.migliore = Caccia.stato().migliorTurni;
                    SaveManager.setModeState('caccia', null);
                    out.cacciaLenta = Caccia.registraVittoria(8);
                    return out;
                });
                t.assert(r.prima !== r.dopo, `Cambia a mezzanotte di lunedì (UTC): ${r.prima} -> ${r.dopo}`);
                t.assert(r.stessaSettimana === r.dopo, `Resta uguale fino a domenica sera: ${r.stessaSettimana} contro ${r.dopo}`);
                t.assert(r.prossima !== r.dopo, `Lunedì dopo è un'altra regola: ${r.prossima}`);
                t.assert(r.ripetizioni === 0, `Due settimane di fila non ripetono né regola né Boss (${r.ripetizioni} ripetizioni)`);
                t.assert(r.vecchiaIgnorata, 'Le vittorie di una settimana passata non contano');
                t.assert(r.primo.primaVolta && r.primo.premio.crediti === 300, `La prima vittoria a Facile paga 300 Crediti: ${JSON.stringify(r.primo)}`);
                t.assert(!r.secondo.primaVolta && !r.secondo.premio, 'La seconda vittoria a Facile nella stessa settimana non paga');
                t.assert(r.altroLivello.primaVolta && r.altroLivello.premio.stelle === 1, `Un livello nuovo paga di nuovo (Difficile: crediti e 1 Stella): ${JSON.stringify(r.altroLivello)}`);
                t.assert(r.cacciaVeloce.primaVolta && r.cacciaVeloce.premio.stelle === 4 && r.cacciaVeloce.premio.veloce, `Caccia vinta in 4 turni: 3 Stelle + 1 di bonus: ${JSON.stringify(r.cacciaVeloce)}`);
                t.assert(!r.cacciaDopo.primaVolta && !r.cacciaDopo.premio && r.migliore === 2, 'La seconda caccia vinta non paga ma migliora il record di turni');
                t.assert(r.cacciaLenta.premio.stelle === 3 && !r.cacciaLenta.premio.veloce, `Vinta in 8 turni: niente bonus (${JSON.stringify(r.cacciaLenta)})`);
            } finally {
                await page.close();
            }
        }

        // ---------- 2) La regola su un mazzo, per OGNI regola del catalogo
        {
            const page = await apri();
            try {
                await page.goto(DUELLO);
                await page.waitForFunction(() => typeof Settimana !== 'undefined' && typeof getCharacterDeck === 'function', null, { timeout: 30000 });
                const r = await page.evaluate(() => {
                    const problemi = [];
                    const spec = getCharacterDeck('kaiba', 'hard');
                    settimanaDatabase.regole.forEach((regola) => {
                        const mazzo = buildDeckFromSpec(spec);
                        const magie = mazzo.filter((c) => c.type !== 'monster').length;
                        const { mazzo: nuovo, sostituite } = Settimana.conformaMazzo(mazzo, regola, { catalogo: cardDatabase });
                        const illegali = nuovo.filter((c) => c.type === 'monster' && !Settimana.ammette(regola, c)).length;
                        const copie = {};
                        nuovo.forEach((c) => { copie[c.id] = (copie[c.id] || 0) + 1; });
                        const troppe = Object.values(copie).filter((n) => n > 3).length;
                        if (nuovo.length !== mazzo.length) problemi.push(`${regola.id}: ${nuovo.length} carte invece di ${mazzo.length}`);
                        if (illegali) problemi.push(`${regola.id}: ${illegali} mostri non ammessi`);
                        if (troppe) problemi.push(`${regola.id}: carte con più di 3 copie`);
                        if (nuovo.filter((c) => c.type !== 'monster').length !== magie) problemi.push(`${regola.id}: Magie/Trappole cambiate`);
                        if (new Set(nuovo.map((c) => c.uid)).size !== nuovo.length) problemi.push(`${regola.id}: uid ripetuti`);
                        if (sostituite < 0) problemi.push(`${regola.id}: conteggio assurdo`);
                    });
                    const ids = settimanaDatabase.regole.map((x) => x.id);
                    if (new Set(ids).size !== ids.length) problemi.push('id di regola ripetuti');
                    const manca = settimanaDatabase.avversari.concat(cacciaDatabase.boss.map((b) => b.id))
                        .filter((id) => !characterDatabase.find((c) => c.id === id) || !getCharacterDeck(id, 'hard'));
                    if (manca.length) problemi.push('avversari/Boss senza personaggio o mazzo: ' + manca.join(','));
                    return problemi;
                });
                t.assert(r.length === 0, `Regole e catalogo: ${JSON.stringify(r)}`);
            } finally {
                await page.close();
            }
        }

        // ---------- 3) Il duello vero della settimana
        {
            const page = await apri();
            try {
                await page.goto(url('settimana.html'));
                await page.waitForFunction(() => typeof Settimana !== 'undefined', null, { timeout: 30000 });
                const avv = await page.evaluate(() => Settimana.avversario());

                // Il giocatore usa SOLO carte che possiede: con un mazzo che la regola non permette e nessun mostro valido in
                // collezione non si gioca (pagina con i livelli spenti, link diretto riportato alla pagina).
                const bloccato = await page.evaluate(() => {
                    if (!SaveManager.hasSave()) SaveManager.createNew('Prova');
                    const save = SaveManager.load();
                    save.collection = {};
                    save.decks = [{ id: 'x', name: 'x', main: [{ id: 1, qty: 3 }, { id: 2, qty: 3 }], extra: [] }];
                    save.activeDeckId = 'x';
                    SaveManager.touch(save);
                    const cartaFuoriRegola = (r) => !Settimana.ammette(r, cardDatabase.find((c) => c.id === 1)) && !Settimana.ammette(r, cardDatabase.find((c) => c.id === 2));
                    const regolaOrig = Settimana.regola;
                    // Una regola che il mazzo di prova (Drago Bianco e Mago Nero) non rispetta sicuramente.
                    Settimana.regola = () => settimanaDatabase.regole.find((r) => cartaFuoriRegola(r));
                    const v = Settimana.verificaMazzo(SaveManager.getActiveDeck());
                    Settimana.regola = regolaOrig;
                    return v;
                });
                t.assert(bloccato.ok === false && bloccato.mancano >= 1, `Senza mostri validi in collezione non si può giocare: ${JSON.stringify(bloccato)}`);
                await page.evaluate(() => { const s = SaveManager.load(); s.decks = []; s.activeDeckId = null; SaveManager.touch(s); });
                await page.goto(DUELLO + `?mode=settimana&character=${avv}&difficulty=Medio`);
                await page.waitForURL(/settimana\.html/, { timeout: 20000 });

                // Ora il giocatore possiede abbastanza mostri validi per ogni regola: si gioca.
                await page.evaluate(() => {
                    const save = SaveManager.load();
                    save.collection = {};
                    cardDatabase.filter((c) => c.type === 'monster' && !c.extraDeck && c.origin !== 'ww1').forEach((c) => { save.collection[c.id] = 3; });
                    save.decks = [{ id: 'y', name: 'y', main: cardDatabase.filter((c) => c.type === 'monster' && !c.extraDeck && c.origin !== 'ww1').slice(0, 20).map((c) => ({ id: c.id, qty: 2 })), extra: [] }];
                    save.activeDeckId = 'y';
                    SaveManager.touch(save);
                });
                await page.goto(DUELLO + `?mode=settimana&character=${avv}&difficulty=Medio`);
                try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
                await page.waitForFunction(() => typeof gameState !== 'undefined' && (gameState.playerHand || []).length >= 5, null, { timeout: 30000 });
                const d = await page.evaluate(() => {
                    const r = Settimana.regola();
                    const tutte = (posto) => [].concat(gameState[posto + 'Hand'] || [], gameState[posto + 'Deck'] || []);
                    const conta = (posto) => tutte(posto).filter((c) => c.type === 'monster' && !Settimana.ammette(r, c)).length;
                    return {
                        illegaliGiocatore: conta('player'),
                        illegaliBot: conta('bot'),
                        totaleGiocatore: tutte('player').length,
                        totaleBot: tutte('bot').length,
                        attesoBot: getCharacterDeck(Settimana.avversario(), 'medium').main.reduce((s, e) => s + (e.qty || 1), 0),
                        riquadro: (document.getElementById('settimanaRegola') || {}).textContent || ''
                    };
                });
                t.assert(d.illegaliGiocatore === 0 && d.illegaliBot === 0, `Nessun mostro fuori regola, né nel mazzo del giocatore né in quello dell'avversario: ${JSON.stringify(d)}`);
                t.assert(d.totaleBot === d.attesoBot, `Il mazzo dell'avversario ha tante carte quante ne aveva (${d.totaleBot} contro ${d.attesoBot})`);
                t.assert(d.totaleGiocatore >= 30, `Il mazzo del giocatore non si è accorciato (${d.totaleGiocatore})`);
                t.assert(/Solo mostri/.test(d.riquadro), `Il riquadro ricorda la regola: "${d.riquadro}"`);

                // Vittoria: paga la prima volta a Normale, non la seconda.
                const prima = await page.evaluate(() => SaveManager.getCurrency().credits);
                await page.evaluate(() => endDuel(true));
                await page.waitForFunction(() => (SaveManager.getModeState('settimana') || { vinte: {} }).vinte.Medio, null, { timeout: 15000 });
                const dopo = await page.evaluate(() => SaveManager.getCurrency().credits);
                t.assert(dopo - prima >= 600, `La prima vittoria della settimana a Normale paga almeno 600 Crediti (${prima} -> ${dopo})`);
                t.assert(errori.length === 0, `Nessun errore durante il duello: ${JSON.stringify(errori)}`);
            } finally {
                await page.close();
            }
        }

        // Un link vecchio (avversario di un'altra settimana) riporta alla pagina.
        {
            const p = await apri();
            try {
                await p.goto(DUELLO + '?mode=settimana&character=non_esiste&difficulty=Medio');
                try { await p.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
                await p.waitForURL(/settimana\.html/, { timeout: 20000 });
            } finally {
                await p.close();
            }
        }

        // ---------- 4) La caccia vera
        {
            const page = await apri();
            try {
                await page.goto(url('caccia-boss.html'));
                await page.waitForFunction(() => typeof Caccia !== 'undefined', null, { timeout: 30000 });
                const boss = await page.evaluate(() => Caccia.boss().id);
                await page.goto(DUELLO + `?mode=caccia&character=${boss}&difficulty=Difficile`);
                try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
                await page.waitForFunction(() => typeof gameState !== 'undefined' && (gameState.playerHand || []).length >= 5, null, { timeout: 30000 });
                const c = await page.evaluate(() => ({
                    lp: gameState.botLP,
                    atteso: cacciaDatabase.lpBoss,
                    comincia: gameState.currentPlayer,
                    riquadro: (document.getElementById('cacciaRiquadro') || {}).textContent || '',
                    tentativi: Caccia.stato().tentativi
                }));
                t.assert(c.lp === c.atteso, `Il Boss parte con ${c.atteso} Life Point (${c.lp})`);
                t.assert(c.comincia === 'player', 'Comincia il giocatore');
                t.assert(/Turno \d+ di 8/.test(c.riquadro), `Il riquadro mostra i turni: "${c.riquadro}"`);
                t.assert(c.tentativi === 1, 'Il tentativo è contato');

                // Finiti i turni la caccia è persa: si simula l'inizio del turno successivo all'ultimo.
                await page.evaluate(() => {
                    window.__esito = null;
                    const originale = window.endDuel;
                    window.endDuel = function (vinto, extra) { window.__esito = { vinto, extra }; return originale.apply(this, arguments); };
                });
                for (let i = 0; i < 12; i++) {
                    await page.evaluate(() => { gameState.turn += 2; gameState.currentPlayer = 'player'; });
                    await page.waitForTimeout(350);
                    const fatto = await page.evaluate(() => !!window.__esito);
                    if (fatto) break;
                }
                const persa = await page.evaluate(() => window.__esito);
                t.assert(persa && persa.vinto === false && persa.extra && persa.extra.cacciaTempoScaduto, `Finiti i turni la caccia è persa: ${JSON.stringify(persa)}`);
                t.assert(errori.length === 0, `Nessun errore durante la caccia: ${JSON.stringify(errori)}`);
            } finally {
                await page.close();
            }
        }

        // ---------- 5) Le pagine
        {
            const p = await apri({ width: 393, height: 852 });
            try {
                await p.goto(url('settimana.html'));
                await p.waitForFunction(() => typeof Settimana !== 'undefined', null, { timeout: 20000 });
                // Un mazzo di soli mostri e la collezione per rispettare qualunque regola.
                await p.evaluate(() => {
                    if (!SaveManager.hasSave()) SaveManager.createNew('Prova');
                    const save = SaveManager.load();
                    const mostri = cardDatabase.filter((c) => c.type === 'monster' && !c.extraDeck && c.origin !== 'ww1');
                    save.collection = {};
                    mostri.forEach((c) => { save.collection[c.id] = 3; });
                    save.decks = [{ id: 'y', name: 'y', main: mostri.slice(0, 20).map((c) => ({ id: c.id, qty: 2 })), extra: [] }];
                    save.activeDeckId = 'y';
                    SaveManager.touch(save);
                });
                await p.reload();
                await p.waitForFunction(() => document.querySelectorAll('#livelli .mp-scelta').length === 3, null, { timeout: 20000 });
                const titolo = await p.textContent('#regolaTitolo');
                t.assert(/Solo mostri/.test(titolo), `La pagina mostra la regola: "${titolo}"`);
                t.assert(!(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'settimana.html non scorre di lato su un telefono');
                await p.route('**/duelMonstersCore.html*', (r) => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
                const avv = await p.evaluate(() => Settimana.avversario());
                await Promise.all([p.waitForURL(/duelMonstersCore\.html/), p.click('#livelli .mp-scelta[data-livello="Difficile"]')]);
                const u = decodeURIComponent(p.url());
                t.assert(/mode=settimana/.test(u) && u.includes('character=' + avv) && /difficulty=Difficile/.test(u), `L'URL del duello della settimana: ${u}`);

                await p.unroute('**/duelMonstersCore.html*');
                await p.goto(url('caccia-boss.html'));
                await p.waitForFunction(() => document.querySelector('#boss .mp-titolo') && document.querySelector('#boss .mp-titolo').textContent, null, { timeout: 20000 });
                t.assert(!(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'caccia-boss.html non scorre di lato su un telefono');
                const boss = await p.evaluate(() => Caccia.boss().id);
                await p.route('**/duelMonstersCore.html*', (r) => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
                await Promise.all([p.waitForURL(/duelMonstersCore\.html/), p.click('#vai')]);
                const u2 = decodeURIComponent(p.url());
                t.assert(/mode=caccia/.test(u2) && u2.includes('character=' + boss) && /difficulty=Difficile/.test(u2), `L'URL della caccia: ${u2}`);
            } finally {
                await p.close();
            }
        }
    }
};
