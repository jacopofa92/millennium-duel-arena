// Torre dei Duellanti (js/modes/torre.js, torre-mode.js, torre.html).
// Il percorso vero: si comincia una scalata dalla pagina, si gioca il piano
// (vinto chiudendo il duello con endDuel, la funzione pubblica di ogni fine
// partita), si torna alla pagina e si sceglie il premio. Poi gli oggetti
// devono cambiare davvero la preparazione del duello successivo: Life Point
// portati dal piano prima, una carta in più, la Carta fidata in mano,
// l'avversario con meno Life Point, nessuna morra con la "Prima mossa".
// Infine: una sconfitta chiude la scalata, un link vecchio non conta, il
// catalogo ha personaggi con i loro mazzi e campi che esistono.
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const PAGINA = 'file:///' + path.join(RADICE, 'torre.html').replace(/\\/g, '/');
const INDEX = 'file:///' + path.join(RADICE, 'index.html').replace(/\\/g, '/');

async function nuovaPagina(t) {
    const page = await t.browser.newPage({ viewport: { width: 1280, height: 860 } });
    const errori = [];
    page.on('pageerror', (e) => errori.push(e.message));
    page.on('dialog', (d) => d.accept());
    await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true; });
    // La Torre si sblocca dopo il Regno dei Duellanti. Prepariamo il requisito
    // da una pagina neutra, prima che il guard di torre.html possa intervenire.
    await page.goto(INDEX);
    await page.evaluate(() => {
        if (!SaveManager.hasSave()) SaveManager.createNew('Scalatore');
        const stato = SaveManager.getCardAcquisitionState();
        stato.completedChapters = stato.completedChapters || {};
        stato.completedChapters.regno = true;
        SaveManager.setCardAcquisitionState(stato);
    });
    return { page, errori };
}

async function aspettaDuello(page) {
    try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
    await page.waitForFunction(() => typeof gameState !== 'undefined' && (gameState.playerHand || []).length >= 5 && !!window.DuelSession && DuelSession.started, null, { timeout: 30000 });
    await page.waitForTimeout(400);
}

module.exports = {
    standalone: true,
    name: 'Torre: scalata dalla pagina, LP portati, premio scelto, oggetti che cambiano davvero la preparazione',
    async run(t) {
        const { page, errori } = await nuovaPagina(t);
        try {
            await page.goto(PAGINA);
            await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Scalatore');
                SaveManager.setModeState('torre', null);
            });
            await page.reload();
            await page.click('#iniziaScalata');
            const sc = await page.evaluate(() => Torre.stato().inCorso);
            t.assert(sc && sc.piano === 1 && sc.lp === 8000 && sc.avversari.length === 20, `Scalata nuova al piano 1 con 8000 LP: ${JSON.stringify(sc)}`);
            t.assert(sc.avversari[4] === 'bandit_keith' && sc.avversari[19] === 'yamiYugi', 'I boss dei piani 5 e 20 sono quelli del catalogo');
            t.assert(await page.$$eval('.mp-piano', (els) => els.length) === 20, 'La torre mostra 20 piani');
            // Nessuno si incontra due volte nella stessa scalata (Bandit Keith,
            // boss del 5, era ricomparso al 7). Si sorteggia più volte per
            // non affidarsi al caso di un'unica estrazione.
            const doppioni = await page.evaluate(() => {
                const trovati = [];
                for (let i = 0; i < 40; i++) {
                    const a = Torre.nuovaScalata().inCorso.avversari;
                    if (new Set(a).size !== a.length) trovati.push(a.join(','));
                }
                return trovati;
            });
            t.assert(doppioni.length === 0, `Scalate con un avversario ripetuto: ${doppioni.slice(0, 2).join(' | ')}`);
            await page.reload();
            // Sul piano attuale c'è il pulsante per sfidarlo, e porta allo stesso duello del pannello.
            const sfide = await page.evaluate(() => [
                (document.querySelector('.tw-piano.is-attuale #sfidaPianoTorre') || {}).getAttribute
                    ? document.querySelector('.tw-piano.is-attuale #sfidaPianoTorre').getAttribute('href') : null,
                document.getElementById('sfidaPiano').getAttribute('href'),
                document.querySelector('.tw-piano.is-attuale') && document.querySelector('.tw-piano.is-attuale').dataset.piano
            ]);
            t.assert(sfide[0] && sfide[0] === sfide[1] && sfide[2] === '1', `"Sfida" sul piano attuale (1) porta al duello giusto: ${JSON.stringify(sfide)}`);
            t.assert(/[?&]field=torreCastelloPegasus\.jpg(?:&|$)/.test(sfide[0]),
                `Ogni piano della Torre deve svolgersi nel field torreCastelloPegasus: ${sfide[0]}`);

            // Piano 1: si gioca e si vince, finendo con 6500 LP.
            await Promise.all([page.waitForURL(/duelMonstersCore\.html\?mode=torre&piano=1/), page.click('#sfidaPiano')]);
            await aspettaDuello(page);
            t.assert(await page.evaluate(() => gameState.playerLP === 8000 && gameState.botLP === 8000), 'Piano 1: 8000 LP per entrambi');
            await page.evaluate(() => { gameState.playerLP = 6500; endDuel(true); });
            await page.waitForFunction(() => { const s = Torre.stato().inCorso; return s && s.piano === 2; }, null, { timeout: 15000 });
            const dopo = await page.evaluate(() => Torre.stato().inCorso);
            t.assert(dopo.lp === 6500 && dopo.sceltaInSospeso && dopo.sceltaInSospeso.length === 2 && dopo.sceltaInSospeso[0].tipo === 'ristoro',
                `Vinto il piano 1: si sale al 2 con 6500 LP e due scelte, la prima il Ristoro: ${JSON.stringify(dopo)}`);
            const progresso = await page.evaluate(() => SaveManager.getChallengeProgress('torre-piano-5'));
            t.assert(!progresso.completed, 'Il piano 1 non completa la Sfida del piano 5');

            // Un link al piano 1, ormai superato, non conta e riporta alla Torre.
            await page.goto(page.url().replace(/torre\.html.*/, '') + 'duelMonstersCore.html?mode=torre&piano=1&character=rex&difficulty=Facile');
            try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
            await page.waitForURL(/torre\.html/, { timeout: 20000 });

            // Il premio: la pagina apre la scelta e non lascia salire prima.
            await page.waitForSelector('#premio:not([hidden])');
            t.assert(await page.$$eval('#premioScelte .mp-scelta', (els) => els.length) === 2, 'Due scelte dopo il piano vinto');
            await page.click('#premioScelte .mp-scelta[data-premio="ristoro"]');
            const ristorato = await page.evaluate(() => Torre.stato().inCorso);
            t.assert(ristorato.lp === 8000 && !ristorato.sceltaInSospeso, `Il Ristoro riporta a 8000 (6500 + 2500, col tetto): ${ristorato.lp}`);

            // Gli oggetti: si preparano a mano per provarli tutti insieme.
            const carta = await page.evaluate(() => {
                const mazzo = SaveManager.getActiveDeck();
                const id = mazzo && mazzo.main && mazzo.main.length ? mazzo.main[mazzo.main.length - 1].id : null;
                const s = Torre.stato();
                s.inCorso.lp = 3300;
                s.inCorso.oggetti = { mano: 2, primo: 1, lpAvversario: 2, carta: id == null ? 0 : 1 };
                s.inCorso.cartaFidata = id;
                SaveManager.setModeState('torre', s);
                return id;
            });
            await page.reload();
            await Promise.all([page.waitForURL(/mode=torre&piano=2/), page.click('#sfidaPiano')]);
            await aspettaDuello(page);
            const prep = await page.evaluate((carta) => ({
                lp: gameState.playerLP,
                lpAvv: gameState.botLP,
                mano: gameState.playerHand.length,
                comincia: gameState.currentPlayer,
                ruolo: window.DUEL_STARTING_ROLE,
                cartaInMano: carta == null || gameState.playerHand.some((c) => c.id === carta)
            }), carta);
            t.assert(prep.lp === 3300, `Piano 2: si parte coi Life Point della scalata (${prep.lp})`);
            t.assert(prep.lpAvv === 6000, `Avversario indebolito due volte: 8000 - 2000 = ${prep.lpAvv}`);
            t.assert(prep.ruolo === 'player', `Prima mossa: comincia il giocatore senza morra (${prep.ruolo})`);
            t.assert(prep.mano >= 8, `Mano iniziale con 2 carte in più: 6 di chi comincia + 2 = ${prep.mano}`);
            t.assert(prep.cartaInMano, 'La Carta fidata è nella mano iniziale');

            // Sconfitta: la scalata finisce e il record lo ricorda.
            await page.evaluate(() => endDuel(false));
            await page.waitForFunction(() => !Torre.stato().inCorso, null, { timeout: 15000 });
            const fine = await page.evaluate(() => Torre.stato());
            t.assert(fine.ultimoEsito && fine.ultimoEsito.piano === 2 && !fine.ultimoEsito.conquistata && fine.record.pianoMassimo === 1,
                `Persa al piano 2: scalata chiusa, record piano 1: ${JSON.stringify(fine)}`);
            await page.goto(PAGINA);
            t.assert(await page.isVisible('#iniziaScalata'), 'Dopo la sconfitta la pagina propone una scalata nuova');
            t.assert(/piano 2/.test(await page.textContent('#esito')), 'La pagina dice dove è finita la scalata');
            t.assert(errori.length === 0, `Nessun errore in pagina: ${JSON.stringify(errori)}`);
        } finally {
            await page.close();
        }

        // Abbandono: conferma con la finestra del gioco, mai quella del browser.
        {
            const { page: p, errori: err } = await nuovaPagina(t);
            const dialoghi = [];
            p.removeAllListeners('dialog');
            p.on('dialog', (d) => { dialoghi.push(d.message()); d.dismiss(); });
            try {
                await p.goto(PAGINA);
                await p.evaluate(() => {
                    if (!SaveManager.hasSave()) SaveManager.createNew('Scalatore');
                    Torre.nuovaScalata();
                });
                await p.reload();
                await p.click('#abbandonaScalata');
                t.assert(await p.isVisible('#confermaAbbandono'), 'Abbandona apre la conferma del gioco');
                await p.click('#abbandonoNo');
                t.assert(!(await p.isVisible('#confermaAbbandono')) && await p.evaluate(() => !!Torre.stato().inCorso),
                    '"Continua a salire" chiude la conferma e la scalata resta');
                await p.click('#abbandonaScalata');
                await p.click('#abbandonoSi');
                const s = await p.evaluate(() => Torre.stato());
                t.assert(!s.inCorso && s.ultimoEsito && s.ultimoEsito.piano === 1, `"Abbandona" chiude la scalata: ${JSON.stringify(s)}`);
                t.assert(await p.isVisible('#iniziaScalata'), 'Dopo l\'abbandono si può ricominciare');
                t.assert(dialoghi.length === 0, `Nessuna finestra di sistema del browser: ${JSON.stringify(dialoghi)}`);
                t.assert(err.length === 0, `Nessun errore in pagina: ${JSON.stringify(err)}`);
            } finally {
                await p.close();
            }
        }

        // Ultimo piano vinto: Torre conquistata e Sfida completata.
        {
            const { page: p } = await nuovaPagina(t);
            try {
                await p.goto(PAGINA);
                await p.evaluate(() => {
                    if (!SaveManager.hasSave()) SaveManager.createNew('Scalatore');
                    const s = Torre.nuovaScalata();
                    s.inCorso.piano = 20;
                    SaveManager.setModeState('torre', s);
                });
                await p.reload();
                await Promise.all([p.waitForURL(/mode=torre&piano=20/), p.click('#sfidaPiano')]);
                await aspettaDuello(p);
                t.assert(await p.evaluate(() => DuelSession.opponent.id) === 'yamiYugi', 'Al piano 20 il boss è Yami Yugi');
                const prima = await p.evaluate(() => SaveManager.getCurrency().millenniumCards || 0);
                await p.evaluate(() => endDuel(true));
                await p.waitForFunction(() => Torre.stato().record.conquiste === 1, null, { timeout: 15000 });
                const s = await p.evaluate(() => ({ stato: Torre.stato(), sfida: SaveManager.getChallengeProgress('torre-conquistata'), millennio: SaveManager.getCurrency().millenniumCards || 0 }));
                t.assert(!s.stato.inCorso && s.stato.ultimoEsito.conquistata && s.sfida.completed, `Torre conquistata e Sfida completata: ${JSON.stringify(s)}`);
                // Premio di piano (2026-11-07): superare il piano 20 vale 1 Carta del Millennio, in piu' del normale premio del duello.
                t.assert(s.millennio >= prima + 1, `Il piano 20 paga 1 Carta del Millennio (prima ${prima}, ora ${s.millennio})`);
            } finally {
                await p.close();
            }
        }

        // Piano 15 superato: 1 Carta Locazione (premio di piano); il piano 14, invece, non ne paga.
        for (const [piano, paga] of [[14, false], [15, true]]) {
            const { page: p } = await nuovaPagina(t);
            try {
                await p.goto(PAGINA);
                await p.evaluate((pn) => {
                    if (!SaveManager.hasSave()) SaveManager.createNew('Scalatore');
                    const s = Torre.nuovaScalata();
                    s.inCorso.piano = pn;
                    SaveManager.setModeState('torre', s);
                }, piano);
                await p.reload();
                await Promise.all([p.waitForURL(new RegExp(`mode=torre&piano=${piano}`)), p.click('#sfidaPiano')]);
                await aspettaDuello(p);
                const prima = await p.evaluate(() => SaveManager.getCurrency().locatorCards || 0);
                await p.evaluate(() => endDuel(true));
                await p.waitForFunction((pn) => { const e = Torre.stato().inCorso; return e && e.piano === pn + 1; }, piano, { timeout: 15000 });
                const dopo = await p.evaluate(() => SaveManager.getCurrency().locatorCards || 0);
                if (paga) t.assert(dopo >= prima + 1, `Il piano 15 paga 1 Carta Locazione (prima ${prima}, ora ${dopo})`);
                else t.assert(dopo - prima <= 1, `Il piano ${piano} non ha un premio di piano (solo l'eventuale drop del duello): ${prima} -> ${dopo}`);
            } finally {
                await p.close();
            }
        }

        // Catalogo: personaggi con i loro mazzi, campi esistenti, Sfide in crediti.
        {
            const { page: p } = await nuovaPagina(t);
            try {
                await p.goto(PAGINA.replace('torre.html', 'duelMonstersCore.html'));
                await p.waitForFunction(() => typeof getCharacterDeck === 'function' && typeof torreDatabase !== 'undefined', null, { timeout: 30000 });
                const cat = await p.evaluate(() => {
                    const ids = new Set();
                    torreDatabase.fasce.forEach((f) => f.avversari.forEach((a) => ids.add(a)));
                    Object.values(torreDatabase.boss).forEach((b) => ids.add(b.avversario));
                    const campi = torreDatabase.fasce.map((f) => f.campo).concat(Object.values(torreDatabase.boss).map((b) => b.campo)).filter(Boolean);
                    const senzaMazzo = [];
                    ids.forEach((id) => {
                        if (!characterDatabase.some((c) => c.id === id)) senzaMazzo.push(id + ': personaggio mancante');
                        ['easy', 'medium', 'hard'].forEach((l) => { const s = getCharacterDeck(id, l); if (!s || !(s.main || []).length) senzaMazzo.push(id + ':' + l); });
                    });
                    return { senzaMazzo, campi };
                });
                t.assert(cat.senzaMazzo.length === 0, `Avversari della Torre senza mazzo: ${JSON.stringify(cat.senzaMazzo)}`);
                cat.campi.forEach((c) => t.assert(fs.existsSync(path.join(RADICE, 'images', 'fields', c)), `Il campo ${c} esiste`));
                t.assert(cat.campi.length > 0 && cat.campi.every((c) => c === 'torreCastelloPegasus.jpg'),
                    `Fasce e boss devono condividere il field della Torre di Pegasus: ${JSON.stringify(cat.campi)}`);
            } finally {
                await p.close();
            }
            const db = fs.readFileSync(path.join(RADICE, 'js', 'data', 'challenges-db.js'), 'utf8');
            // Solo le Sfide della Torre: dalla prima all'inizio del gruppo successivo (Settimana e Caccia, che
            // pagano anche Stelle). Prima si leggeva fino a fine file e il test si rompeva a ogni Sfida nuova.
            const inizio = db.indexOf("modalita: 'torre'") - 200;
            const finePrevista = db.indexOf('// Duello della Settimana', inizio);
            const sezione = db.slice(inizio, finePrevista > inizio ? finePrevista : db.lastIndexOf('];'));
            t.assert(finePrevista > inizio, 'Il confine dopo le Sfide della Torre non si trova piu\': aggiornare il test');
            t.assert(!/starChips|locatorCards|millenniumCards|cards:/.test(sezione),
                'Le Sfide della Torre pagano solo crediti');
        }
    }
};
