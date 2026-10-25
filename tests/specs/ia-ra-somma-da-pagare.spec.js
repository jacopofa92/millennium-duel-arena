// Quanti Life Point paga il BOT per Il Drago Alato di Ra (AI_SHARED.raLpDecisione, js/ai/ai-shared.js).
// La politica, scelta dall'utente: A) un obiettivo di ATK (batte il mostro avversario piu' forte con un margine, e comunque almeno
// 3000: mai un Ra da 900 perche' l'avversario ha un mostro da 800) e B) una soglia di LP da non toccare, che cresce con gli altri
// attaccanti avversari, le sue Magie/Trappole e la sua mano. Eccezione "scacco": a campo avversario vuoto, se un colpo diretto
// vince, basta pagare il necessario (anche 1400) e si rischia.
module.exports = {
    name: 'IA: Ra paga una somma misurata (obiettivo di ATK, soglia di LP, eccezione scacco)',
    async run(t) {
        await t.page.waitForTimeout(2500);   // lascia assestare la cascata delle fasi (vedi tests/README.md)

        // Un campo di prova: il bot e' "owner"; l'avversario e' il giocatore.
        const caso = (s) => t.evaluate((s) => {
            const mk = (id, uid) => { const c = JSON.parse(JSON.stringify(cardDatabase.find((x) => x.id === id))); c.uid = uid; return c; };
            const slot = (id, uid, extra) => Object.assign({ card: mk(id, uid), position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedOnTurn: 0 }, extra || {});
            gameState.botLP = s.mioLp; gameState.playerLP = s.lpAvv;
            gameState.botMonsterField = [null, null, null, null, null];
            (s.miei || []).forEach((m, i) => { gameState.botMonsterField[i] = slot(m.id, 'mio' + i, { hasAttacked: !!m.hasAttacked }); });
            gameState.playerMonsterField = [null, null, null, null, null];
            (s.avv || []).forEach((m, i) => {
                const base = slot(m.id, 'avv' + i, { isFaceDown: !!m.coperto, position: m.coperto ? 'defense' : 'attack' });
                if (m.atk) base.card.attack = m.atk;
                gameState.playerMonsterField[i] = base;
            });
            gameState.playerSTField = [null, null, null, null, null];
            for (let i = 0; i < (s.retro || 0); i++) gameState.playerSTField[i] = { card: mk(10, 'retro' + i), isFaceDown: true, setOnTurn: 0 };
            gameState.playerHand = [];
            for (let i = 0; i < (s.manoAvv || 0); i++) gameState.playerHand.push(mk(4, 'mano' + i));
            const d = AI_SHARED.raLpDecisione(gameState, 'bot', { tributi: s.tributi || [] });
            return { paga: d.paga, motivo: d.motivo, stimaAtk: AI_SHARED.estimateSummonedStats(mk(472, 'ra-stima'), gameState, 'bot').atk };
        }, s);
        const celtico = { id: 4 };   // Guardiano Celtico

        // A) L'OBIETTIVO
        let r = await caso({ mioLp: 8000, lpAvv: 8000, avv: [{ id: 4, atk: 800 }] });
        t.assert(r.paga === 3000 && r.motivo === 'obiettivo', `davanti a un mostro da 800 Ra non scende a 900: arriva ad almeno 3000: ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 8000, lpAvv: 8000, avv: [{ id: 4, atk: 3000 }] });
        t.assert(r.paga === 3500, `davanti a un mostro da 3000 l'obiettivo e' 3000 + margine 500: ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 8000, lpAvv: 8000, avv: [{ id: 4, atk: 2850 }] });
        t.assert(r.paga === 3350, `l'obiettivo e' un multiplo di 50 (2850 + 500 = 3350): ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 8000, lpAvv: 8000, avv: [] });
        t.assert(r.paga === 3000, `a campo libero non butta tutti i LP: ${JSON.stringify(r)}`);
        t.assert(r.stimaAtk === r.paga, `la stima usata per scegliere Ra e' la stessa somma che poi paga: ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 8000, lpAvv: 8000, avv: [{ id: 4, coperto: true }] });
        t.assert(r.paga === 3000 && r.stimaAtk === 3000, `un mostro coperto conta come un'incognita media (1800): resta l'obiettivo minimo: ${JSON.stringify(r)}`);

        // B) LA SOGLIA di LP
        r = await caso({ mioLp: 8000, lpAvv: 8000, avv: [{ id: 4, atk: 1800 }, { id: 4, atk: 1800 }, { id: 4, atk: 1800 }] });
        t.assert(r.paga === 3000, `con tre attaccanti (3600 di esposizione) si resta sopra 4600 LP: ne pago 3000 e me ne restano 5000: ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 4000, lpAvv: 8000, avv: [{ id: 4, atk: 2500 }, { id: 4, atk: 2500 }] });
        t.assert(r.paga === 0 && r.motivo === 'troppo-rischioso', `con pochi LP e piu' attaccanti non paga: Ra sarebbe un ripiego perdente: ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 4400, lpAvv: 8000, avv: [{ id: 4, atk: 1400 }] });
        t.assert(r.paga === 3000, `senza carte coperte avversarie paga 3000 (soglia 1000): ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 4400, lpAvv: 8000, avv: [{ id: 4, atk: 1400 }], retro: 2 });
        t.assert(r.paga === 0, `con 2 Magie/Trappole avversarie la soglia sale (1500) e non basta piu' per 3000: ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 4400, lpAvv: 8000, avv: [{ id: 4, atk: 1400 }], manoAvv: 4 });
        t.assert(r.paga === 0, `con la mano avversaria piena la soglia sale e non basta piu': ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 3100, lpAvv: 8000, avv: [{ id: 4, atk: 1400 }] });
        t.assert(r.paga === 0, `con pochi LP (pagabile < 3000) non conviene: ${JSON.stringify(r)}`);

        // ECCEZIONE "scacco": campo avversario vuoto e un colpo diretto vince
        r = await caso({ mioLp: 1500, lpAvv: 1400, avv: [] });
        t.assert(r.paga === 1400 && r.motivo === 'scacco', `a campo vuoto, avversario a 1400: Ra da 1400 basta, anche con pochi LP: ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 5000, lpAvv: 1400, avv: [] });
        t.assert(r.paga === 1400 && r.motivo === 'scacco', `anche con tanti LP paga il NECESSARIO, non l'obiettivo: ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 1500, lpAvv: 2000, avv: [], miei: [{ id: 4 }, { id: 4 }, { id: 4 }, { id: 4 }], tributi: [0, 1, 2] });
        t.assert(r.paga === 600 && r.motivo === 'scacco', `gli altri attaccanti pronti (1400) abbassano quanto serve a Ra: 2000 - 1400 = 600: ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 1500, lpAvv: 2000, avv: [], miei: [{ id: 4 }, { id: 4 }, { id: 4 }, { id: 4 }], tributi: [0, 1, 3] });
        t.assert(r.paga === 600, `con i Tributi 0, 1 e 3 il mostro rimasto e' il 2 (1400): serve ancora 600: ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 3000, lpAvv: 2000, avv: [], miei: [{ id: 4 }, { id: 4 }, { id: 4 }], tributi: [0, 1, 2] });
        t.assert(r.paga === 2000, `se tutti i mostri verranno sacrificati nessuno attacca: serve tutto a Ra: ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 3000, lpAvv: 2000, avv: [], miei: [{ id: 4, hasAttacked: true }, { id: 4 }, { id: 4 }, { id: 4 }], tributi: [1, 2, 3] });
        t.assert(r.paga === 2000, `un mostro che ha gia' attaccato non conta: ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 1500, lpAvv: 2000, avv: [] });
        t.assert(r.paga === 0, `con 1500 LP non si possono pagare i 2000 che servirebbero: nessuno scacco, nessun pagamento: ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 1500, lpAvv: 1400, avv: [], miei: [{ id: 1 }, { id: 4 }, { id: 4 }, { id: 4 }], tributi: [1, 2, 3] });
        t.assert(r.paga === 0 && r.motivo === 'gia-vinto', `se gli altri attaccanti bastano da soli Ra non costa niente: ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 1000, lpAvv: 5000, avv: [] });
        t.assert(r.paga === 0, `lo scacco serve solo se Ra puo' davvero arrivare: con 1000 LP contro 5000 non si paga a vuoto: ${JSON.stringify(r)}`);
        r = await caso({ mioLp: 1500, lpAvv: 1400, avv: [celtico] });
        t.assert(r.paga === 0, `se l'avversario ha un mostro non c'e' colpo diretto: niente scacco: ${JSON.stringify(r)}`);

        // Una vera Evocazione del bot: la somma decisa e' quella pagata (viaggia nel comando 'evoca').
        await t.evaluate(() => {
            const mk = (id, uid) => { const c = JSON.parse(JSON.stringify(cardDatabase.find((x) => x.id === id))); c.uid = uid; return c; };
            const slot = (id, uid) => ({ card: mk(id, uid), position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedOnTurn: 0 });
            gameState.phase = 'main1'; gameState.currentPlayer = 'bot'; gameState.hasNormalSummoned = false;
            gameState.botLP = 8000; gameState.playerLP = 8000; gameState.atkDefBonus = {};
            gameState.botMonsterField = [slot(4, 'v0'), slot(4, 'v1'), slot(4, 'v2'), null, null];
            gameState.playerMonsterField = [slot(4, 'avv-v'), null, null, null, null];
            gameState.playerMonsterField[0].card.attack = 800;
            gameState.playerSTField = [null, null, null, null, null];
            gameState.playerHand = [];
            gameState.botHand = [mk(472, 'RA-BOT')];
            window.__raFatto = false;
            botSummonMonster(gameState.botHand[0], [0, 1, 2], 0, 'attack', false, 'bot').then(() => { window.__raFatto = true; });
        });
        await t.page.waitForFunction(() => window.__raFatto === true, null, { timeout: 30000 });
        const dopo = await t.evaluate(() => {
            const ra = gameState.botMonsterField.find((s) => s && s.card.id === 472);
            return { lp: gameState.botLP, atk: ra ? DuelEngine.getEffectiveAtk(ra.card) : null, pagati: ra ? ra.card.raPaidLp : null };
        });
        t.assert(dopo.lp === 5000 && dopo.pagati === 3000 && dopo.atk === 3000,
            `il bot Evoca Ra davanti a un mostro da 800 e paga 3000 (non 7900): ${JSON.stringify(dopo)}`);
    }
};
