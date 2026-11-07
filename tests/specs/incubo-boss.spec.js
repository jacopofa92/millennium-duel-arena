// Livello INCUBO dei Boss (js/modes/incubo.js, numeri in js/data/incubo-db.js): mano bilanciata, carta evento, premi.
const { openDuel, freezeNaturalGameLoop } = require('../helpers/harness');

module.exports = {
    standalone: true,
    name: 'Incubo: mano bilanciata del Boss, carta evento con probabilita\' crescenti, premi +25% e carte del giorno',
    async run(t) {
        const errori = [];
        const apri = async (query) => {
            const page = await t.browser.newPage({ viewport: { width: 1400, height: 900 } });
            page.on('pageerror', (e) => errori.push(e.message));
            await openDuel(page, query);
            await freezeNaturalGameLoop(page);
            return page;
        };

        // ---------- 0) Senza ?incubo=1 il livello e' spento, anche contro un Boss
        {
            const page = await apri('?mode=free&character=kaiba&difficulty=Difficile');
            const spento = await page.evaluate(() => !window.Incubo || window.Incubo.attivo() === false);
            t.assert(spento, 'Senza incubo=1 il livello non e\' attivo');
            await page.close();
        }

        const page = await apri('?mode=free&character=kaiba&difficulty=Difficile&incubo=1');
        t.assert(await page.evaluate(() => window.Incubo.attivo() === true), 'Con incubo=1 contro Kaiba il livello e\' attivo');

        // ---------- 1) Mano iniziale: almeno 2 mostri giocabili, non piu' di 2 pesanti
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
                Incubo._sistemaManoIniziale();
                const cima = gameState.botDeck.slice(-6);
                return {
                    leggeri: cima.filter((c) => c.type === 'monster' && c.level <= 4).length,
                    pesanti: cima.filter((c) => c.type === 'monster' && c.level >= 6).length,
                    totale: gameState.botDeck.length
                };
            } finally { Math.random = casoOriginale; }
        });
        t.assert(mano.leggeri >= 2, `Almeno 2 mostri giocabili nella mano iniziale: ${JSON.stringify(mano)}`);
        t.assert(mano.pesanti <= 2, `Non piu' di 2 mostri pesanti nella mano iniziale: ${JSON.stringify(mano)}`);

        // ---------- 2) Pescata: a campo vuoto e senza mostri giocabili in mano, la carta che sta per arrivare e' un mostro giocabile
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
                Incubo._sistemaPescata();
                const cima = gameState.botDeck[gameState.botDeck.length - 1];
                return { tipo: cima.type, livello: cima.level };
            } finally { Math.random = casoOriginale; }
        });
        t.assert(pescata.tipo === 'monster' && pescata.livello <= 4, `A campo vuoto e mano senza mostri la pescata e' un mostro giocabile: ${JSON.stringify(pescata)}`);

        // ---------- 3) La carta evento: dal 3° turno del Boss, 40% e poi +10%; distrutta, riparte dal 10%; al massimo 2 comparse
        const sequenza = await page.evaluate(() => {
            const casoOriginale = Math.random;
            const st = Incubo.stato;
            const out = {};
            const campoBoss = () => gameState.botMonsterField;
            const mainDelBoss = (turno, casuale) => {
                Math.random = () => casuale;
                gameState.currentPlayer = 'bot';
                gameState.turn = turno;
                EventiDuello.emetti('annuncio-fase', 'Main Phase 1');
            };
            const idInCampo = () => campoBoss().filter(Boolean).map((s) => s.card.id);
            try {
                Object.assign(st, { turniBoss: 0, ultimoTurno: null, comparse: 0, viva: false, uid: null, prob: 0, ripresa: false });
                gameState.botMonsterField = [null, null, null, null, null];
                gameState.botHand = [];
                // Turni 1 e 2 del Boss: niente, anche con il dado piu' favorevole.
                mainDelBoss(2, 0); mainDelBoss(4, 0);
                out.primaDelTerzo = idInCampo();
                // 3° turno: dado 0.5 -> con il 40% non esce; probabilita' sale al 50%.
                mainDelBoss(6, 0.5);
                out.terzoSenza = idInCampo();
                out.probDopoIlTerzo = Math.round(st.prob * 100);
                // 4° turno: dado 0.45 < 50% -> esce (Kaiba: scelta a sorte, dado 0.45 -> la prima carta).
                mainDelBoss(8, 0.45);
                out.quartoCon = idInCampo();
                out.comparse1 = st.comparse;
                // Con la carta in campo non ne esce un'altra, qualunque dado.
                mainDelBoss(10, 0);
                out.nonDoppia = idInCampo().length;
                // La carta viene distrutta: la seconda comparsa riparte dal 10%.
                gameState.botMonsterField = [null, null, null, null, null];
                mainDelBoss(12, 0.2);   // 0.2 < 40% ma > 10%: se la ripresa non ripartisse dal 10% uscirebbe
                out.dopoDistrutta = { prob: Math.round(st.prob * 100), inCampo: idInCampo().length };
                // 0.15 non basta al 20% nel turno dopo? (0.2 sale a 20%): dado 0.05 < 20% -> seconda comparsa.
                mainDelBoss(14, 0.05);
                out.seconda = { inCampo: idInCampo().length, comparse: st.comparse };
                // Distrutta la seconda: non torna piu'.
                gameState.botMonsterField = [null, null, null, null, null];
                mainDelBoss(16, 0); mainDelBoss(18, 0); mainDelBoss(20, 0);
                out.dopoLaSeconda = { inCampo: idInCampo().length, comparse: st.comparse };
            } finally { Math.random = casoOriginale; }
            return out;
        });
        t.assert(sequenza.primaDelTerzo.length === 0, `Prima del 3° turno del Boss la carta non esce: ${JSON.stringify(sequenza)}`);
        t.assert(sequenza.terzoSenza.length === 0 && sequenza.probDopoIlTerzo === 50, `Al 3° turno parte dal 40% e sale al 50%: ${JSON.stringify(sequenza)}`);
        t.assert(sequenza.quartoCon.length === 1 && [29, 30].includes(sequenza.quartoCon[0]), `Kaiba evoca Drago Occhi Blu Finale oppure Obelisk: ${JSON.stringify(sequenza)}`);
        t.assert(sequenza.nonDoppia === 1, `Con la carta in campo non ne esce una seconda: ${JSON.stringify(sequenza)}`);
        t.assert(sequenza.dopoDistrutta.prob === 20 && sequenza.dopoDistrutta.inCampo === 0, `Distrutta, la ripresa riparte dal 10% (tirato a 10%, poi sale al 20%): ${JSON.stringify(sequenza)}`);
        t.assert(sequenza.seconda.inCampo === 1 && sequenza.seconda.comparse === 2, `La seconda comparsa arriva: ${JSON.stringify(sequenza)}`);
        t.assert(sequenza.dopoLaSeconda.inCampo === 0 && sequenza.dopoLaSeconda.comparse === 2, `Dopo la seconda distruzione non torna piu': ${JSON.stringify(sequenza)}`);

        // ---------- 4) Premi: +25% su crediti e Stelle, e le due carte UNA volta al giorno
        const premi = await page.evaluate(() => {
            const dopo = (n) => Rewards.applicaIncubo([
                { currency: 'credits', amount: 500, icon: '', nome: '', rule: '' },
                { currency: 'starChips', amount: 2, icon: '', nome: '', rule: '' }
            ], { vinto: true });
            const prima = SaveManager.getCurrency ? SaveManager.getCurrency() : {};
            const a = dopo();
            const b = dopo();
            const somma = (lista, valuta) => lista.filter((v) => !v.nota && v.currency === valuta).reduce((s, v) => s + v.amount, 0);
            const persa = Rewards.applicaIncubo([{ currency: 'credits', amount: 500 }], { vinto: false });
            return {
                creditiExtra: somma(a, 'credits') - 500,
                stelleExtra: somma(a, 'starChips') - 2,
                locazione1: somma(a, 'locatorCards'), millennio1: somma(a, 'millenniumCards'),
                locazione2: somma(b, 'locatorCards'), millennio2: somma(b, 'millenniumCards'),
                persaInvariata: persa.length === 1
            };
        });
        t.assert(premi.creditiExtra === 125, `+25% sui crediti (500 -> +125): ${JSON.stringify(premi)}`);
        t.assert(premi.stelleExtra === 1, `+25% sulle Stelle (2 -> +1): ${JSON.stringify(premi)}`);
        t.assert(premi.locazione1 === 1 && premi.millennio1 === 1, `La prima vittoria del giorno da' Locazione e Millennio: ${JSON.stringify(premi)}`);
        t.assert(premi.locazione2 === 0 && premi.millennio2 === 0, `Le due carte una volta sola al giorno: ${JSON.stringify(premi)}`);
        t.assert(premi.persaInvariata, `Una sconfitta non cambia i premi: ${JSON.stringify(premi)}`);

        await page.close();
        t.assert(errori.length === 0, `Nessun errore di pagina: ${errori.join(' | ')}`);
    }
};
