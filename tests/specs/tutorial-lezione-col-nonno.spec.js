// La lezione guidata col nonno (js/tutorial/tutorial-duel.js).
// Si gioca DAVVERO, seguendo il riflettore come farebbe una persona: avanti
// sulle spiegazioni, tocco sul punto indicato, trascinamento per l'attacco
// finale. Poi si controlla:
//  - che un tocco fuori da ciò che il passo permette non arrivi al gioco;
//  - che al primo avvio "Abbandona" non ci sia, e che rifacendola ci sia;
//  - che vincere segni la lezione come fatta e paghi il premio UNA volta;
//  - che il tutorial resti un file a parte: nessun file del motore lo cita
//    (richiesta dell'utente: "non inquinare logiche di motore solide").
const path = require('path');
const fs = require('fs');

const RADICE = path.join(__dirname, '..', '..');
const URL = 'file:///' + path.join(RADICE, 'duelMonstersCore.html').replace(/\\/g, '/')
    + '?mode=tutorial&character=solomonMuto&difficulty=Facile';

async function apri(t, statoLezione) {
    const page = await t.browser.newPage({ viewport: { width: 1366, height: 820 } });
    const errori = [];
    page.on('pageerror', (e) => errori.push(e.message));
    await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; });
    await page.goto(URL);
    await page.waitForFunction(() => !!window.SaveManager);
    await page.evaluate((stato) => {
        if (!SaveManager.hasSave()) SaveManager.createNew('Allievo');
        SaveManager.setTutorial(stato);
    }, statoLezione);
    await page.reload();
    await page.waitForSelector('#tutorialCoach', { timeout: 40000 });
    return { page, errori };
}

/** Segue il riflettore fino alla fine del duello. Torna l'elenco dei passi visti. */
async function giocaLezione(page) {
    const visti = new Set();
    const scadenza = Date.now() + 150000;
    while (Date.now() < scadenza) {
        const st = await page.evaluate(() => {
            const p = TutorialDuel._passo();
            const passo = TutorialDuel._passi[p];
            const avanti = document.querySelector('.tut-avanti');
            const el = passo && passo.bersaglio ? passo.bersaglio() : null;
            const r = el ? el.getBoundingClientRect() : null;
            return {
                p, over: !!gameState.gameOver,
                avanti: !!(avanti && !avanti.hidden),
                r: r && r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null,
                popover: !!document.getElementById('quickPopover')
            };
        });
        visti.add(st.p);
        if (st.over) return visti;
        if (st.avanti) { await page.click('.tut-avanti'); await page.waitForTimeout(300); continue; }
        if (st.p === TutorialDuel_ULTIMO && st.r) {
            const bot = await page.evaluate(() => {
                const r = document.getElementById('botFieldBoard').getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 3 };
            });
            await page.mouse.move(st.r.x, st.r.y);
            await page.mouse.down();
            for (let i = 1; i <= 12; i++) await page.mouse.move(st.r.x + (bot.x - st.r.x) * i / 12, st.r.y + (bot.y - st.r.y) * i / 12);
            await page.mouse.up();
            await page.waitForTimeout(2000);
            continue;
        }
        if (st.popover) {
            const b = await page.$('#quickPopover button');
            if (b) { await b.click(); await page.waitForTimeout(600); continue; }
        }
        if (st.r) await page.mouse.click(st.r.x, st.r.y);
        await page.waitForTimeout(600);
    }
    throw new Error('La lezione non è arrivata alla fine entro il tempo massimo');
}
// Indice dell'ultimo passo (l'attacco diretto), letto dal file della lezione.
let TutorialDuel_ULTIMO = 13;

module.exports = {
    standalone: true,
    name: 'Lezione col nonno: si gioca seguendo il riflettore, obbligatoria al primo avvio, premio una volta',
    async run(t) {
        // --- Il tutorial resta fuori dal motore -------------------------
        const cartellaMotore = path.join(RADICE, 'js', 'engine');
        const citazioni = fs.readdirSync(cartellaMotore).filter((f) => f.endsWith('.js'))
            .filter((f) => /TutorialDuel|tutorial-duel/.test(fs.readFileSync(path.join(cartellaMotore, f), 'utf8')));
        t.assert(citazioni.length === 0, `Nessun file del motore deve citare il tutorial: ${citazioni.join(', ')}`);
        // Nei passi "Adesso tocca a me" l'avversario attacca e si apre la finestra per rispondere con la Trappola: lo SFONDO di quella
        // finestra (#activateModal) non deve essere consentito, perche' un tocco li' la chiude = rifiuta la risposta, e la lezione
        // deraglia. Il passo avanza da solo ogni 200 ms, quindi per un attimo dopo l'apertura un tocco sullo sfondo passava: e'
        // il motivo per cui questo spec (che clicca il punto indicato dal riflettore) falliva a intermittenza.
        const sorgenteLezione = fs.readFileSync(path.join(RADICE, 'js', 'tutorial', 'tutorial-duel.js'), 'utf8');
        const passiRisposta = [...sorgenteLezione.matchAll(/testo: 'Adesso tocca a me[\s\S]*?consenti: \(\) => \[([^\]]*)\]/g)];
        t.assert(passiRisposta.length >= 2, `i passi "Adesso tocca a me" ci sono (${passiRisposta.length})`);
        passiRisposta.forEach((m, i) => t.assert(!m[1].includes('#activateModal') && m[1].includes('#activateConfirmBtn'),
            `il passo "Adesso tocca a me" n.${i + 1} consente solo il pulsante Attiva, mai lo sfondo della finestra: ${m[1]}`));
        const indice = fs.readFileSync(path.join(RADICE, 'index.html'), 'utf8');
        t.assert(/label: 'Tutorial', action: 'link', href: 'tutorial\.html'/.test(indice),
            'Il menu Duelli deve avere la voce "Tutorial"');

        // --- Primo avvio: obbligatoria ----------------------------------
        let { page, errori } = await apri(t, { daFare: true, completata: false, premiata: false });
        try {
            TutorialDuel_ULTIMO = await page.evaluate(() => TutorialDuel._passi.length - 1);
            t.assert(await page.evaluate(() => getComputedStyle(document.getElementById('surrenderBtn')).display === 'none'),
                'Al primo avvio la lezione non si abbandona: "Abbandona" deve essere nascosto');

            // Arrivati al passo dell'Evocazione, un tocco sul Teschio (non
            // previsto) non deve selezionarlo.
            await page.waitForFunction(() => !document.querySelector('.tut-avanti').hidden, null, { timeout: 20000 });
            for (let i = 0; i < 4; i++) {
                await page.waitForFunction(() => !document.querySelector('.tut-avanti').hidden, null, { timeout: 20000 });
                await page.click('.tut-avanti');
                await page.waitForTimeout(250);
            }
            const teschio = await page.evaluate(() => {
                const c = gameState.playerHand.find((x) => x.id === 13);
                const r = document.querySelector(`#playerHand [data-uid="${c.uid}"]`).getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            });
            await page.mouse.click(teschio.x, teschio.y);
            await page.waitForTimeout(500);
            const sel = await page.evaluate(() => gameState.selectedCard && gameState.selectedCard.card && gameState.selectedCard.card.id);
            t.assert(sel !== 13, 'Un tocco fuori dal passo (il Teschio, mentre si deve evocare il Celtico) non deve arrivare al gioco');

            const visti = await giocaLezione(page);
            t.assert(visti.has(8) && visti.has(TutorialDuel_ULTIMO),
                `La lezione deve passare dalla Trappola e dall'attacco finale: ${JSON.stringify([...visti])}`);
            await page.waitForTimeout(1500);
            const dopo = await page.evaluate(() => ({ t: SaveManager.getTutorial(), crediti: SaveManager.getCurrency().credits, lp: gameState.botLP }));
            t.assert(dopo.lp <= 0, `Il duello deve finire con i Life Point del nonno a zero (${dopo.lp})`);
            t.assert(dopo.t.completata && !dopo.t.daFare && dopo.t.premiata,
                `Vinta la lezione, risulta fatta e premiata: ${JSON.stringify(dopo.t)}`);
            t.assert(await page.evaluate(() => /Prima lezione|lezione col nonno/i.test(document.body.innerText)),
                'La schermata finale deve spiegare il premio della lezione');
            t.assert(errori.length === 0, `Nessun errore in pagina: ${JSON.stringify(errori)}`);
        } finally {
            await page.close();
        }

        // --- Rifatta dal menu: si può uscire, niente secondo premio -----
        ({ page, errori } = await apri(t, { daFare: false, completata: true, premiata: true }));
        try {
            t.assert(await page.evaluate(() => getComputedStyle(document.getElementById('surrenderBtn')).display !== 'none'),
                'Rifacendo la lezione dal menu, "Abbandona" deve esserci');
            const prima = await page.evaluate(() => SaveManager.getCurrency().credits);
            await giocaLezione(page);
            await page.waitForTimeout(1500);
            const dopo = await page.evaluate(() => SaveManager.getCurrency().credits);
            t.assert(dopo === prima, `Il premio della lezione si riceve una volta sola (${prima} -> ${dopo})`);
            t.assert(errori.length === 0, `Nessun errore in pagina: ${JSON.stringify(errori)}`);
        } finally {
            await page.close();
        }
    }
};
