// Conto alla Rovescia Finale (id 1283): la carta paga 2000 LP e avvia un conto di 20 turni, SENZA vittoria (per ora).
// Il campo si oscura e compaiono 20 fiammelle (js/ui/conto-alla-rovescia.js), di cui una si spegne ad ogni turno.
// Si provano entrambe le versioni: WebGL (Dettagli "Alti") e CSS di ripiego, e che un duello nuovo ripulisca tutto.
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'Conto alla Rovescia Finale: paga 2000 LP, 20 fiamme, una si spegne ad ogni turno, nessuna vittoria',
    async run({ page, assert }) {
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error' && /shader|webgl|glsl/i.test(m.text())) errori.push('console: ' + m.text()); });
        await openDuel(page);
        await page.waitForFunction(() => !!window.ContoAllaRovescia && !!DuelEngine.getDefinition(1283));
        await page.waitForTimeout(500);

        // 1) Attivazione: costo, stato, e una seconda copia non si attiva mentre il conto corre.
        const a = await page.evaluate(() => {
            gameState.playerLP = 8000;
            const ctx = DuelEngine.makeContext('player', { card: cardDatabase.find((c) => c.id === 1283) });
            const def = DuelEngine.getDefinition(1283);
            const prima = def.canActivate(ctx);
            def.activate(ctx);
            return { prima, lp: gameState.playerLP, stato: gameState.contoAllaRovescia, dopo: def.canActivate(ctx), vinto: !!gameState.gameOver };
        });
        assert(a.prima === true, `Attivabile con LP e Deck sufficienti: ${JSON.stringify(a)}`);
        assert(a.lp === 6000, `Paga 2000 LP: ${JSON.stringify(a)}`);
        assert(a.stato && a.stato.durata === 20 && a.stato.owner === 'player', `Parte il conto di 20 turni: ${JSON.stringify(a)}`);
        assert(a.dopo === false, `Un solo conto alla volta: ${JSON.stringify(a)}`);
        assert(a.vinto === false, `Nessuna vittoria: ${JSON.stringify(a)}`);

        // 2) Il campo si scurisce e le fiamme (CSS: "Normali") sono 20, tutte accese; ogni turno ne spegne una.
        const b = await page.evaluate(async () => {
            window.CONTO_ROVESCIA_WEBGL_OFF = true;
            ContoAllaRovescia.rimuovi();
            ContoAllaRovescia.sync();
            const conta = () => ({ tot: document.querySelectorAll('#contoRovesciaLayer .cr-fiamma').length, spente: document.querySelectorAll('#contoRovesciaLayer .cr-fiamma.cr-spenta').length });
            const inizio = conta();
            gameState.turn += 1; ContoAllaRovescia.sync();
            const unTurno = conta();
            gameState.turn += 4; ContoAllaRovescia.sync();
            const cinque = conta();
            gameState.turn += 30; ContoAllaRovescia.sync();
            const tutte = conta();
            const z = getComputedStyle(document.getElementById('contoRovesciaLayer')).zIndex;
            const gz = getComputedStyle(document.querySelector('.game-container')).zIndex;
            return { inizio, unTurno, cinque, tutte, z, gz };
        });
        assert(b.inizio.tot === 20 && b.inizio.spente === 0, `20 fiamme tutte accese: ${JSON.stringify(b)}`);
        assert(b.unTurno.spente === 1 && b.cinque.spente === 5, `Una fiamma si spegne ad ogni turno: ${JSON.stringify(b)}`);
        assert(b.tutte.spente === 20, `Dopo 20+ turni sono tutte spente: ${JSON.stringify(b)}`);
        assert(Number(b.z) < Number(b.gz), `Il velo sta sotto le carte: ${JSON.stringify(b)}`);

        // 2b) L'anello chiude tutto il campo e NESSUNA fiamma cade su una casella (schermo largo: lo spazio c'e').
        const anello = await page.evaluate(() => {
            const pos = ContoAllaRovescia.posizioni() || [];
            const W = innerWidth; const H = innerHeight;
            const slots = [...document.querySelectorAll('.field-slot')].map((e) => e.getBoundingClientRect()).filter((q) => q.width > 2);
            const sopra = pos.filter((p) => slots.some((q) => p.x * W > q.left && p.x * W < q.right && p.y * H > q.top && p.y * H < q.bottom)).length;
            const xs = pos.map((p) => p.x * W); const ys = pos.map((p) => p.y * H);
            const l = Math.min(...slots.map((q) => q.left)); const r = Math.max(...slots.map((q) => q.right));
            const t = Math.min(...slots.map((q) => q.top)); const b = Math.max(...slots.map((q) => q.bottom));
            return { n: pos.length, sopra, giro: Math.min(...xs) < l && Math.max(...xs) > r && Math.min(...ys) < t && Math.max(...ys) > b };
        });
        assert(anello.n === 20 && anello.sopra === 0, `Nessuna fiamma sulle caselle: ${JSON.stringify(anello)}`);
        assert(anello.giro, `Le fiamme girano tutto attorno al campo: ${JSON.stringify(anello)}`);

        // 3) WebGL (Dettagli "Alti"): un canvas sopra il campo, rilasciato quando il conto sparisce, nessun errore.
        const c = await page.evaluate(async () => {
            window.CONTO_ROVESCIA_WEBGL_OFF = false;
            window.VideoQuality = Object.assign({}, window.VideoQuality, { isAlti: () => true });
            gameState.turn = gameState.contoAllaRovescia.startTurn + 3;
            ContoAllaRovescia.rimuovi();
            ContoAllaRovescia.sync();
            await new Promise((s) => setTimeout(s, 400));
            const canvas = document.querySelectorAll('#contoRovesciaLayer canvas').length;
            gameState.contoAllaRovescia = null;
            ContoAllaRovescia.sync();
            return { canvas, resto: document.querySelectorAll('#contoRovesciaLayer').length };
        });
        assert(c.resto === 0, `Senza conto non resta nulla a schermo: ${JSON.stringify(c)}`);
        assert(errori.length === 0, `Errori: ${errori.join(' | ')}`);
    }
};
