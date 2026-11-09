// Schermata di Vittoria/Sconfitta: "Il duello in numeri" (js/stats/stats-duello.js + showOutcome in duel-cinematics.js).
const { openDuel, freezeNaturalGameLoop } = require('../helpers/harness');

module.exports = {
    standalone: true,
    name: 'Fine duello: il riquadro "Il duello in numeri" mostra turni, danni, Magie, Trappole, mostri e Tributi',
    async run(t) {
        const errori = [];
        const page = await t.browser.newPage({ viewport: { width: 1280, height: 800 } });
        page.on('pageerror', (e) => errori.push(e.message));
        await openDuel(page, '?mode=free&character=kaiba&difficulty=Facile');
        await freezeNaturalGameLoop(page);

        // I conteggi arrivano dagli stessi punti del motore: danno dall'evento, il resto da StatsDuello.registra.
        const letti = await page.evaluate(() => {
            StatsDuello.azzera();
            EventiDuello.emetti('danno-subito', 'bot', 1200);
            EventiDuello.emetti('danno-subito', 'bot', 3000);
            EventiDuello.emetti('danno-subito', 'player', 500);
            EventiDuello.emetti('danno-subito', 'bot', 0);
            StatsDuello.registra('mostro'); StatsDuello.registra('mostro'); StatsDuello.registra('mostro');
            StatsDuello.registra('tributo');
            StatsDuello.registra('magia'); StatsDuello.registra('magia');
            StatsDuello.registra('trappola');
            return StatsDuello.riepilogo();
        });
        t.assert(letti.dannoMax === 3000 && letti.dannoInflitto === 4200 && letti.dannoSubito === 500, `Danni: ${JSON.stringify(letti)}`);
        t.assert(letti.mostri === 3 && letti.tributi === 1 && letti.magie === 2 && letti.trappole === 1, `Conteggi: ${JSON.stringify(letti)}`);

        // La schermata di fine duello li mostra.
        await page.evaluate(() => {
            gameState.turn = 9;   // 5 turni tuoi
            gameState.playerLP = 2750;
            DuelCinematics.showOutcome({ playerWon: true, session: { opponent: { name: 'Kaiba', icon: '🤖' } }, record: null, rewards: [], onContinue: () => {} });
        });
        await page.waitForSelector('#duelOutcomeOverlay .do-stats');
        const tessere = await page.evaluate(() => Object.fromEntries(Array.from(document.querySelectorAll('.do-stat')).map((e) => [e.querySelector('.do-stat-lab').textContent, e.querySelector('.do-stat-val').textContent])));
        t.assert(tessere['Turni'] === '5', `Turni: ${JSON.stringify(tessere)}`);
        t.assert(tessere['Danno massimo'] === '3000' && tessere['Danno inflitto'] === '4200' && tessere['Danno subito'] === '500', `Danni a schermo: ${JSON.stringify(tessere)}`);
        t.assert(tessere['Life Point finali'] === '2750', `LP: ${JSON.stringify(tessere)}`);
        t.assert(tessere['Mostri evocati'] === '3' && tessere['Evocazioni Tributo'] === '1' && tessere['Magie attivate'] === '2' && tessere['Trappole attivate'] === '1', `Conteggi a schermo: ${JSON.stringify(tessere)}`);

        // Sta dentro lo schermo (si scorre, ma il riquadro non sborda di lato).
        const r = await page.evaluate(() => { const b = document.querySelector('.do-stats').getBoundingClientRect(); return { l: b.left, r: b.right, w: innerWidth }; });
        t.assert(r.l >= 0 && r.r <= r.w, `Il riquadro sbordava di lato: ${JSON.stringify(r)}`);
        t.assert(errori.length === 0, 'Errori JS: ' + errori.join(' | '));
        await page.close();
    }
};
