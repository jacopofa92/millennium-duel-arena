// Backend WebGL degli spettacoli di carta (js/ui/fx-webgl.js): Buco Nero, Spade Rivelatrici e
// Raigeki e la Gabbia d'Acciaio sono disegnati da shader, senza elementi DOM per effetto e senza GSAP, e restano
// agganciati alle stesse callback da cui dipende il duello. Qui si prova: (1) il backend e'
// disponibile; (2) Buco Nero: parte, crea le carte risucchiate (DOM) e finisce da solo;
// (3) Spade: restano finche' il chiamante non le toglie, e onLanded arriva UNA volta sola;
// (4) Raigeki: onImpact arriva una volta sola; (5) la Gabbia segue la carta reale; (6) con FX_BACKEND='gsap' tornano gli effetti di prima.
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'FX WebGL: Buco Nero, Spade Rivelatrici e Raigeki senza DOM per effetto, callback intatte',
    async run({ page, assert }) {
        await openDuel(page);
        await page.waitForFunction(() => !!window.FX && !!window.FxWebgl);
        const pronto = await page.evaluate(() => window.FxWebglPronto);
        assert(pronto === true, 'WebGL deve essere disponibile nel browser di prova');

        // 2) Buco Nero
        const bh = await page.evaluate(async () => {
            const carte = [0, 1, 2].map((i) => ({ card: { id: 1, name: 'x', type: 'monster', attack: 1, defense: 1, uid: 'bh' + i }, rect: { left: 300 + i * 80, top: 150, width: 60, height: 90 } }));
            const prima = document.querySelectorAll('.fx-darkhole-vortex, [class*="fx-gsap-darkhole"]').length;
            FX.playDarkHoleVortex(carte);
            await new Promise((r) => setTimeout(r, 400));
            const durante = { attivi: FxWebgl.attivi(), fantasmi: document.querySelectorAll('.fx-darkhole-sucked').length, domVortice: document.querySelectorAll('.fx-darkhole-vortex, [class*="fx-gsap-darkhole"]').length };
            await new Promise((r) => setTimeout(r, 3200));
            return { prima, durante, dopo: FxWebgl.attivi(), fantasmiDopo: document.querySelectorAll('.fx-darkhole-sucked').length };
        });
        assert(bh.durante.attivi >= 1 && bh.durante.domVortice === bh.prima, `Buco Nero: un effetto WebGL e nessun elemento DOM del vortice: ${JSON.stringify(bh)}`);
        assert(bh.durante.fantasmi === 3, `Le carte risucchiate restano elementi veri: ${JSON.stringify(bh)}`);
        assert(bh.dopo === 0 && bh.fantasmiDopo === 0, `Buco Nero deve finire da solo: ${JSON.stringify(bh)}`);

        // 3) Spade: restano finche' non vengono tolte, onLanded una volta sola
        const sp = await page.evaluate(async () => {
            let chiamate = 0; let togli = null;
            FX.playSwordsOfRevealingLight('player', (rm) => { chiamate++; togli = rm; });
            await new Promise((r) => setTimeout(r, 2200));
            const prima = { chiamate, attivi: FxWebgl.attivi(), domSpade: document.querySelectorAll('.fx-sword-beam').length };
            await new Promise((r) => setTimeout(r, 600));
            const ancora = FxWebgl.attivi();
            if (togli) togli();
            const dopo = FxWebgl.attivi();
            return { prima, ancora, dopo, chiamateFinali: chiamate };
        });
        assert(sp.prima.chiamate === 1 && sp.chiamateFinali === 1, `onLanded deve arrivare una volta sola: ${JSON.stringify(sp)}`);
        assert(sp.prima.attivi >= 1 && sp.ancora >= 1 && sp.prima.domSpade === 0, `Le spade restano (WebGL, senza DOM) finche' non vengono tolte: ${JSON.stringify(sp)}`);
        assert(await page.evaluate(() => FxWebgl.shaderDisponibile('spade')), 'Lo shader delle Spade deve compilare davvero (effetto visibile, non solo attivo)');
        assert(sp.dopo < sp.ancora, `Tolte le spade, l'effetto si ferma: ${JSON.stringify(sp)}`);

        // 4) Raigeki
        const rg = await page.evaluate(async () => {
            let impatti = 0;
            FX.playRaigeki('bot', () => { impatti++; });
            await new Promise((r) => setTimeout(r, 2000));
            return { impatti, attivi: FxWebgl.attivi() };
        });
        assert(rg.impatti === 1 && rg.attivi === 0, `Raigeki: un solo impatto e poi si ferma: ${JSON.stringify(rg)}`);

        // 5) Gabbia d'Acciaio: entrambe le file restano imprigionate finché
        // la Magia è scoperta; distruggerla e ridisegnare spegne il WebGL.
        const cage = await page.evaluate(async () => {
            const card = { ...cardDatabase.find((c) => c.id === 750), uid: 'gabbia-webgl' };
            gameState.playerSTField[0] = { card, isFaceDown: false, turnsLeft: 2 };
            updateUI();
            await new Promise((r) => setTimeout(r, 120));
            const durante = { viva: FxWebgl.gabbiaIncuboAttiva(), attivi: FxWebgl.attivi() };
            gameState.playerSTField[0] = null;
            updateUI();
            await new Promise((r) => setTimeout(r, 80));
            return { durante, dopo: FxWebgl.gabbiaIncuboAttiva(), attiviDopo: FxWebgl.attivi() };
        });
        assert(cage.durante.viva && cage.durante.attivi >= 1,
            `La Gabbia deve restare in WebGL sopra entrambe le file: ${JSON.stringify(cage)}`);
        assert(await page.evaluate(() => FxWebgl.shaderDisponibile('gabbia-incubo')), 'Lo shader della Gabbia deve compilare davvero (effetto visibile, non solo attivo)');
        assert(!cage.dopo && cage.attiviDopo === 0,
            `La Gabbia deve sparire insieme alla carta: ${JSON.stringify(cage)}`);

        // 6) ripiego: con FX_BACKEND='gsap' non parte nessun effetto WebGL
        const rip = await page.evaluate(async () => {
            window.FX_BACKEND = 'gsap';
            FX.playRaigeki('bot', () => {});
            await new Promise((r) => setTimeout(r, 300));
            const out = FxWebgl.attivi();
            window.FX_BACKEND = undefined;
            await new Promise((r) => setTimeout(r, 2400));
            return out;
        });
        assert(rip === 0, `Con FX_BACKEND=gsap l'effetto non passa dal WebGL: ${rip}`);
    }
};
