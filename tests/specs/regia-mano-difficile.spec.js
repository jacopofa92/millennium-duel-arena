// REGIA DELLA MANO dei Duellanti Difficili (js/modes/regia-mano.js, lista in js/data/regia-mano-db.js) e mazzi ritoccati
// (RITOCCHI_MENO_DISTRUZIONE in js/data/character-decks.js, 1.9.11).
//
// La regia compensa le trappole che distruggono tolte dai mazzi Difficile: senza di lei il Difficile diventerebbe piu' facile
// (misura: +2,6 punti di vittorie del giocatore). Questo spec non rimisura la difficolta' (lo fa la matrice, tools/ + scratchpad
// della sessione 1.9.11): controlla che la regia giri SOLO dove deve e faccia quello che promette, e che i mazzi non protetti
// restino quelli decisi con l'utente.
const { openDuel, freezeNaturalGameLoop } = require('../helpers/harness');

module.exports = {
    standalone: true,
    name: 'Regia della mano: attiva solo in Difficile e per i Duellanti in lista, mano senza mostri morti; mazzi protetti intatti',
    async run(t) {
        const errori = [];
        const apri = async (query) => {
            const page = await t.browser.newPage({ viewport: { width: 1400, height: 900 } });
            page.on('pageerror', (e) => errori.push(e.message));
            await openDuel(page, query);
            await freezeNaturalGameLoop(page);
            return page;
        };
        const attiva = async (query) => {
            const page = await apri(query);
            const v = await page.evaluate(() => !!(window.RegiaMano && window.RegiaMano.attiva()));
            await page.close();
            return v;
        };

        // ---------- 1) Dove e' attiva
        t.assert(await attiva('?mode=free&character=odion&difficulty=Difficile') === true, 'Odion (in lista) in Difficile: la regia e\' attiva');
        t.assert(await attiva('?mode=free&character=odion&difficulty=Facile') === false, 'Odion in Facile: la regia e\' spenta');
        t.assert(await attiva('?mode=free&character=odion&difficulty=Normale') === false, 'Odion in Normale: la regia e\' spenta');
        t.assert(await attiva('?mode=free&character=gansley&difficulty=Difficile') === false, 'Gansley (non in lista, mazzo protetto): la regia e\' spenta');
        // Kaiba e' in lista E un Boss: con ?incubo=1 deve girare solo la regia dell'Incubo (un Duellante che non e' un Boss non attiva l'Incubo).
        t.assert(await attiva('?mode=free&character=kaiba&difficulty=Difficile') === true, 'Kaiba (in lista) in Difficile: la regia e\' attiva');
        t.assert(await attiva('?mode=free&character=kaiba&difficulty=Difficile&incubo=1') === false, 'Con l\'Incubo la regia e\' spenta (ha la sua)');

        // La modalita' si legge dall'indirizzo a ogni chiamata: lo si cambia sulla stessa pagina (aprire davvero la Torre o il Tag
        // chiederebbe i loro parametri). Storia e Torneo sono incluse; Tag, Torre, Caccia, Puzzle, Rivincita, Settimana e Tutorial no.
        const page = await apri('?mode=free&character=odion&difficulty=Difficile');
        const perModalita = await page.evaluate(() => {
            const esito = {};
            ['free', 'story', 'tournament', 'torre', 'tag', 'caccia', 'puzzle', 'rivincita', 'settimana', 'tutorial'].forEach((m) => {
                history.replaceState(null, '', '?mode=' + m + '&character=odion&difficulty=Difficile');
                esito[m] = window.RegiaMano.attiva();
            });
            history.replaceState(null, '', '?mode=free&character=odion&difficulty=Difficile');
            return esito;
        });
        ['free', 'story', 'tournament'].forEach((m) => t.assert(perModalita[m] === true, `In modalita' ${m} la regia e' attiva`));
        // Un duello in coppia della Storia ha mode=story ma tag=1: e' un Tag Team e la regia resta spenta.
        t.assert(await page.evaluate(() => {
            history.replaceState(null, '', '?mode=story&tag=1&partner=joey&character=odion&difficulty=Difficile');
            const v = window.RegiaMano.attiva();
            history.replaceState(null, '', '?mode=free&character=odion&difficulty=Difficile');
            return v;
        }) === false, 'In un duello Tag della Storia (mode=story&tag=1) la regia e\' spenta');
        ['torre', 'tag', 'caccia', 'puzzle', 'rivincita', 'settimana', 'tutorial'].forEach((m) => t.assert(perModalita[m] === false, `In modalita' ${m} la regia e' spenta`));

        // ---------- 2) Cosa fa: mano iniziale con almeno 2 mostri giocabili e non piu' di 2 pesanti
        const mano = await page.evaluate(() => {
            const casoOriginale = Math.random;
            Math.random = () => 0.5;   // mai la "mano sbagliata" (8%)
            try {
                const pesante = cardDatabase.filter((c) => c.type === 'monster' && !c.extraDeck && c.level >= 6).slice(0, 8);
                const leggero = cardDatabase.filter((c) => c.type === 'monster' && !c.extraDeck && c.level <= 4).slice(0, 8);
                const spell = cardDatabase.filter((c) => c.type === 'spell').slice(0, 6);
                const uid = (c, i) => ({ ...c, uid: 'p' + c.id + '-' + i });
                // In cima (fine dell'array) sei pesanti; sotto, mostri leggeri e Magie.
                gameState.botDeck = [].concat(leggero.map(uid), spell.map(uid), pesante.slice(0, 6).map(uid));
                RegiaMano._sistemaManoIniziale();
                const cima = gameState.botDeck.slice(-6);
                return {
                    leggeri: cima.filter((c) => c.type === 'monster' && c.level <= 4).length,
                    pesanti: cima.filter((c) => c.type === 'monster' && c.level >= 6).length
                };
            } finally { Math.random = casoOriginale; }
        });
        t.assert(mano.leggeri >= 2, `Almeno 2 mostri giocabili nella mano iniziale: ${JSON.stringify(mano)}`);
        t.assert(mano.pesanti <= 2, `Non piu' di 2 mostri pesanti nella mano iniziale: ${JSON.stringify(mano)}`);

        // ---------- 3) Pescata: a campo vuoto e senza mostri giocabili in mano, la carta che sta per arrivare e' un mostro giocabile
        const pescata = await page.evaluate(() => {
            const casoOriginale = Math.random;
            Math.random = () => 0.5;
            try {
                const pesante = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && c.level >= 6);
                const leggero = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && c.level <= 4);
                const spell = cardDatabase.find((c) => c.type === 'spell');
                gameState.botMonsterField = [null, null, null, null, null];
                gameState.botHand = [{ ...spell, uid: 'h1' }, { ...spell, uid: 'h2' }];
                gameState.botDeck = [{ ...leggero, uid: 'd1' }, { ...spell, uid: 'd2' }, { ...pesante, uid: 'd3' }];
                RegiaMano._sistemaPescata();
                const cima = gameState.botDeck[gameState.botDeck.length - 1];
                return { tipo: cima.type, livello: cima.level };
            } finally { Math.random = casoOriginale; }
        });
        t.assert(pescata.tipo === 'monster' && pescata.livello <= 4, `A campo vuoto e mano senza mostri la pescata e' un mostro giocabile: ${JSON.stringify(pescata)}`);

        // ---------- 4) I mazzi: lista coerente e mazzi protetti intatti
        const dati = await page.evaluate(() => {
            const qty = (mazzo, id) => mazzo.main.filter((e) => e.id === id).reduce((s, e) => s + e.qty, 0);
            const lista = window.regiaManoDatabase.duellanti;
            return {
                lista,
                inesistenti: lista.filter((id) => !characterDeckDatabase[id] || !characterDeckDatabase[id].hard),
                non40: Object.keys(characterDeckDatabase).filter((id) => characterDeckDatabase[id].hard
                    && characterDeckDatabase[id].hard.main.reduce((s, e) => s + e.qty, 0) !== 40),
                // Gansley: Cilindro Magico e' il suo Deck Master. Yami Yugi: lo usa a Battle City (ep. 66).
                gansleyCilindro: qty(characterDeckDatabase.gansley.hard, 10),
                yamiCilindro: qty(characterDeckDatabase.yamiYugi.hard, 10),
                // Gli altri riportati al mazzo attuale: devono avere ancora almeno una delle due trappole.
                riportati: ['bandit_keith', 'darkNite', 'gozaburo', 'highMageAnubisius'].map((id) =>
                    [id, qty(characterDeckDatabase[id].hard, 793) + qty(characterDeckDatabase[id].hard, 10)])
            };
        });
        t.assert(dati.lista.length === 34, `Dovrebbero esserci 34 Duellanti con la regia, ce ne sono ${dati.lista.length}`);
        t.assert(dati.inesistenti.length === 0, `Duellanti in lista senza mazzo Difficile: ${dati.inesistenti.join(', ')}`);
        t.assert(dati.non40.length === 0, `Mazzi Difficile che non hanno 40 carte: ${dati.non40.join(', ')}`);
        t.assert(dati.gansleyCilindro >= 1, 'Gansley deve tenere Cilindro Magico (e\' il suo Deck Master)');
        t.assert(dati.yamiCilindro >= 1, 'Yami Yugi deve tenere Cilindro Magico (lo usa a Battle City)');
        dati.riportati.forEach(([id, n]) => t.assert(n >= 1, `${id} doveva restare al mazzo attuale (con Sakuretsu o Cilindro): ne ha ${n}`));
        ['gansley', 'yamiYugi', 'bandit_keith', 'darkNite', 'gozaburo', 'highMageAnubisius'].forEach((id) =>
            t.assert(!dati.lista.includes(id), `${id} ha il mazzo attuale: non deve avere la regia`));
        await page.close();

        t.assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
    }
};
