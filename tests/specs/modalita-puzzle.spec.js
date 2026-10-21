// Modalità Puzzle (js/modes/puzzle-mode.js, js/data/puzzles-db.js).
// Ogni puzzle del catalogo si gioca DAVVERO con la sua soluzione, passando
// dalle funzioni normali del gioco (attivazioni, Evocazioni, attacchi) e
// rispondendo alle scelte come un giocatore: toccando la carta nella lista o
// il pulsante della Posizione. Un puzzle che smettesse di essere risolvibile
// (una carta cambiata, un'IA che risponde diversamente) fa fallire questo
// spec: è l'unico modo di saperlo senza rigiocarli tutti a mano.
// In più: una strada sbagliata NON vince, passare il turno chiude il puzzle
// come non risolto, il traguardo "tutti i puzzle" delle Sfide vale quanti
// puzzle ci sono davvero, e puzzle.html mostra le stelle guadagnate.
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const DUELLO = 'file:///' + path.join(RADICE, 'duelMonstersCore.html').replace(/\\/g, '/');
const ELENCO = 'file:///' + path.join(RADICE, 'puzzle.html').replace(/\\/g, '/');

/** Aspetta che il duello torni fermo, rispondendo alle scelte che si aprono. */
async function calma(page, scegli) {
    const fine = Date.now() + 40000;
    while (Date.now() < fine) {
        const stato = await page.evaluate((src) => {
            const posizione = document.querySelector('.quick-popover .quick-popover-btn.attack');
            if (posizione && posizione.offsetWidth > 0) { posizione.click(); return 'risposto'; }
            const s = Decisioni.inSospeso();
            if (s) {
                // eslint-disable-next-line no-eval
                const pred = src ? eval(src) : () => true;
                const i = Math.max(0, s.candidati.findIndex(pred));
                const c = s.candidati[i];
                const uid = c && (c.uid || (c.card && c.card.uid));
                const voce = uid && document.querySelector(`#cardListPickerModal.open [data-uid="${uid}"]`);
                if (voce) (voce.closest('.card-list-item') || voce).click();
                else Decisioni.rispondi(i);
                return 'risposto';
            }
            const ferma = !(gameState.chain && gameState.chain.links && gameState.chain.links.length)
                && !(DuelEngine.isChainActive && DuelEngine.isChainActive());
            return ferma ? 'ferma' : 'attesa';
        }, scegli ? scegli.toString() : null);
        if (stato === 'ferma') {
            await page.waitForTimeout(400);
            if (await page.evaluate(() => !Decisioni.inSospeso())) return;
        }
        await page.waitForTimeout(150);
    }
    throw new Error('Il duello non è tornato fermo');
}

const attiva = (page, id) => page.evaluate((id) => DuelEngine.activateCard('player', 'hand', gameState.playerHand.findIndex((c) => c.id === id)), id);
const battaglia = (page) => page.evaluate(() => enterBattlePhase());
const attacca = (page, a, b) => page.evaluate(([a, b]) => new Promise((ok) => resolveAttack('player', a, b, ok)), [a, b]);
const casellaDi = (page, id) => page.evaluate((id) => gameState.playerMonsterField.findIndex((s) => s && s.card.id === id), id);

const SOLUZIONI = {
    ascia: async (page) => {
        await attiva(page, 618);
        await calma(page, (c) => (c.card || c).id === 4);
        await page.evaluate(() => { const i = gameState.playerHand.findIndex((c) => c.id === 526); summonMonster(gameState.playerHand[i], 1, 'attack', i); });
        await calma(page);
        await battaglia(page);
        await attacca(page, 0, -1);
        await attacca(page, 1, -1);
    },
    fusione: async (page) => {
        await attiva(page, 38);
        await calma(page);
        await battaglia(page);
        await attacca(page, await casellaDi(page, 254), -1);
    },
    flip: async (page) => {
        await page.evaluate(() => changeMonsterPosition(0));
        await calma(page, (c) => (c.card || c).id === 1);
        await battaglia(page);
        await attacca(page, 1, -1);
        await attacca(page, 0, -1);
    },
    cilindro: async (page) => {
        await attiva(page, 607);
        await calma(page);
        await battaglia(page);
        await attacca(page, 0, -1);
    },
    cuore: async (page) => {
        await attiva(page, 147);
        await calma(page, (c) => (c.card || c).id === 1);
        await attiva(page, 409);
        await calma(page);
        await battaglia(page);
        await attacca(page, await casellaDi(page, 1), -1);
    },
    rinascita: async (page) => {
        await attiva(page, 35);
        await calma(page, (c) => (c.card || c).id === 1);
        await battaglia(page);
        const drago = await casellaDi(page, 1);
        await attacca(page, 0, 0);
        await attacca(page, drago, -1);
    },
    megamorfosi: async (page) => {
        await attiva(page, 631);
        await calma(page);
        await battaglia(page);
        await attacca(page, 0, -1);
    },
    tempesta: async (page) => {
        await attiva(page, 646);
        await calma(page);
        await battaglia(page);
        await attacca(page, 0, -1);
        await attacca(page, 1, -1);
    },
    'buco-nero': async (page) => {
        await attiva(page, 7);
        await calma(page);
        await page.evaluate(() => { const i = gameState.playerHand.findIndex((c) => c.id === 24); summonMonster(gameState.playerHand[i], 0, 'attack', i); });
        await calma(page);
        await battaglia(page);
        await attacca(page, 0, -1);
    },
    'tributo-dannati': async (page) => {
        await attiva(page, 492);
        await calma(page, (c) => (c.card || c).id === 526);
        await battaglia(page);
        await attacca(page, 0, -1);
    },
    'libro-luna': async (page) => {
        await attiva(page, 875);
        await calma(page, (c) => (c.card || c).id === 110);
        await battaglia(page);
        await attacca(page, 0, 0);
        await attacca(page, 1, -1);
    },
    'rito-fulgore': async (page) => {
        await attiva(page, 56);
        await calma(page);
        await battaglia(page);
        await attacca(page, await casellaDi(page, 55), -1);
    }
};

async function apriPuzzle(t, id) {
    const page = await t.browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errori = [];
    page.on('pageerror', (e) => errori.push(e.message));
    await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; });
    await page.goto(DUELLO + '?mode=puzzle&puzzle=' + id + '&character=kaiba');
    try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
    await page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.phase === 'main1' && gameState.currentPlayer === 'player', null, { timeout: 30000 });
    await page.waitForTimeout(300);
    return { page, errori };
}

module.exports = {
    standalone: true,
    name: 'Puzzle: ogni puzzle è risolvibile, le strade sbagliate no, passare il turno lo fa fallire',
    async run(t) {
        // Il catalogo e le soluzioni devono coincidere: un puzzle nuovo
        // senza soluzione qui non sarebbe controllato da nessuno.
        const prima = await t.browser.newPage();
        await prima.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        await prima.goto(ELENCO);
        await prima.evaluate(() => {
            if (!SaveManager.hasSave()) SaveManager.createNew('Enigmista');
            SaveManager.setModeState('puzzle', null);
        });
        const catalogo = await prima.evaluate(() => puzzlesDatabase.map((p) => p.id));
        await prima.close();
        t.assert(JSON.stringify(catalogo.slice().sort()) === JSON.stringify(Object.keys(SOLUZIONI).sort()),
            `Ogni puzzle del catalogo deve avere la sua soluzione in questo spec: ${JSON.stringify(catalogo)}`);

        for (const id of catalogo) {
            const { page, errori } = await apriPuzzle(t, id);
            try {
                t.assert(await page.evaluate(() => gameState.turn === 3 && !!document.getElementById('puzzleObiettivo')),
                    `Puzzle ${id}: si parte dal turno 3 con il riquadro dell'obiettivo`);
                await SOLUZIONI[id](page);
                await page.waitForFunction(() => gameState.gameOver, null, { timeout: 15000 });
                // Lo stato del puzzle lo scrive la fine del duello
                // (DuelSession.finish), che arriva un attimo dopo gameOver.
                try {
                    await page.waitForFunction((id) => ((SaveManager.getModeState('puzzle') || {})[id] || {}).risolto, id, { timeout: 10000 });
                } catch (e) { /* lo dice l'asserzione qui sotto, con i dettagli */ }
                const esito = await page.evaluate((id) => ({ botLP: gameState.botLP, stato: (SaveManager.getModeState('puzzle') || {})[id] }), id);
                t.assert(esito.botLP === 0, `Puzzle ${id}: la soluzione porta l'avversario a 0 LP (${esito.botLP})`);
                t.assert(esito.stato && esito.stato.risolto && esito.stato.stelle === 3,
                    `Puzzle ${id}: risolto al primo tentativo, tre stelle (${JSON.stringify(esito.stato)})`);
                t.assert(errori.length === 0, `Puzzle ${id}: nessun errore in pagina: ${JSON.stringify(errori)}`);
            } finally {
                await page.close();
            }
        }

        // Strada sbagliata: attaccare senza togliere la carta coperta. L'IA
        // attiva il Cilindro Magico; passato il turno, il puzzle è fallito.
        {
            const { page, errori } = await apriPuzzle(t, 'cilindro');
            try {
                await page.evaluate(() => {
                    const s = SaveManager.getModeState('puzzle') || {};
                    s.cilindro = { tentativi: 0, risolto: false, stelle: 0 };
                    SaveManager.setModeState('puzzle', s);
                });
                await battaglia(page);
                await attacca(page, 0, -1);
                await calma(page);
                const dopo = await page.evaluate(() => ({ botLP: gameState.botLP, playerLP: gameState.playerLP }));
                t.assert(dopo.botLP === 2500 && dopo.playerLP === 5500,
                    `Cilindro attaccando alla cieca: l'attacco viene rimandato indietro (${JSON.stringify(dopo)})`);
                await page.evaluate(() => enterEndPhase());
                await page.waitForFunction(() => gameState.gameOver, null, { timeout: 15000 });
                await page.waitForSelector('.do-continue, [class*="do-"]', { timeout: 10000 }).catch(() => {});
                await page.waitForTimeout(500);
                const s = await page.evaluate(() => (SaveManager.getModeState('puzzle') || {}).cilindro);
                t.assert(s && !s.risolto, `Passato il turno il puzzle resta non risolto (${JSON.stringify(s)})`);
                t.assert(errori.length === 0, `Strada sbagliata: nessun errore in pagina: ${JSON.stringify(errori)}`);
            } finally {
                await page.close();
            }
        }

        // Sfide e pagina dell'elenco.
        const page = await t.browser.newPage();
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
        try {
            await page.goto(ELENCO);
            const tutti = await page.evaluate(() => puzzlesDatabase.length);
            const sfide = await page.evaluate(() => {
                const s = document.createElement('script');
                s.src = 'js/data/challenges-db.js';
                document.head.appendChild(s);
                return new Promise((ok) => { s.onload = () => ok(challengesDatabase.filter((c) => c.modalita === 'puzzle').map((c) => ({ id: c.id, target: c.target, reward: c.reward }))); });
            });
            ['puzzle-tutti', 'puzzle-tre-stelle-tutti'].forEach((idSfida) => {
                const sfida = sfide.find((c) => c.id === idSfida);
                t.assert(sfida && sfida.target === tutti, `La Sfida ${idSfida} deve valere tutti i ${tutti} puzzle (${JSON.stringify(sfida)})`);
            });
            t.assert(sfide.every((c) => Object.keys(c.reward || {}).every((k) => k === 'credits')),
                `Le Sfide dei Puzzle pagano solo crediti: ${JSON.stringify(sfide)}`);
            // Ogni pagina di prova ha un salvataggio suo (browser.newPage apre
            // un contesto nuovo): lo stato da mostrare si scrive qui.
            await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Enigmista');
                SaveManager.setModeState('puzzle', {
                    ascia: { tentativi: 1, risolto: true, stelle: 3 },
                    cilindro: { tentativi: 2, risolto: false, stelle: 0 }
                });
            });
            await page.reload();
            const stelle = await page.textContent('.mp-voce[data-puzzle="ascia"] .mp-stato');
            t.assert(stelle.trim() === '★★★', `puzzle.html mostra le tre stelle del puzzle risolto ("${stelle}")`);
            const fallito = await page.textContent('.mp-voce[data-puzzle="cilindro"] .mp-stato');
            t.assert(/Da risolvere/.test(fallito), `puzzle.html mostra il puzzle fallito come da risolvere ("${fallito}")`);
        } finally {
            await page.close();
        }
    }
};
