const path = require('path');

module.exports = {
    standalone: true,
    name: 'Battle City: dirigibile canonico e migrazione del vecchio tabellone',
    async run(t) {
        const root = path.join(__dirname, '..', '..');
        const url = 'file:///' + path.join(root, 'torneo-battle-city.html').replace(/\\/g, '/');
        const page = await t.browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });

        try {
            await page.goto(url);
            await page.waitForFunction(() => window.SaveManager && typeof characterDatabase !== 'undefined');
            const state = {
                phase: 'airship', difficulty: 'Medio', locators: 6, sector: 1,
                grid: null, pendingEncounter: { characterId: 'rex', stage: 'r32', wager: 0 },
                bracket: {
                    slots: ['player', 'rex'].concat(new Array(30).fill('weevil')),
                    r32Winners: new Array(16).fill('weevil'),
                    r16Winners: new Array(8).fill('weevil'),
                    quarterWinners: new Array(4).fill('weevil'),
                    semiWinners: [null, null], champion: null
                },
                towerStage: null, history: [], eliminated: false
            };
            state.bracket.r32Winners[0] = null;
            state.bracket.r16Winners[0] = null;
            state.bracket.quarterWinners[0] = null;

            await page.evaluate((initialState) => {
                SaveManager.setTournamentState('battleCity', initialState);
                sessionStorage.setItem('ygoLastDuelOutcome', JSON.stringify({
                    mode: 'tournament', tournamentId: 'battleCity', playerWon: true,
                    opponentId: 'rex', timestamp: Date.now()
                }));
            }, state);
            await page.reload();
            await page.waitForFunction(() => {
                const current = SaveManager.getTournamentState('battleCity');
                return current && current.phase === 'tower' && !current.pendingEncounter;
            });

            const result = await page.evaluate(() => {
                const current = SaveManager.getTournamentState('battleCity');
                return {
                    slots: current.bracket.slots.length,
                    legacyR32: Object.prototype.hasOwnProperty.call(current.bracket, 'r32Winners'),
                    legacyR16: Object.prototype.hasOwnProperty.call(current.bracket, 'r16Winners'),
                    quarter: current.bracket.quarterWinners[0],
                    opponent: current.bracket.slots[1],
                    unique: new Set(current.bracket.slots).size,
                    hasMarik: current.bracket.slots.includes('marik'),
                    phase: current.phase, eliminated: current.eliminated,
                    outcomeLeft: sessionStorage.getItem('ygoLastDuelOutcome')
                };
            });
            t.assert(result.slots === 8 && !result.legacyR32 && !result.legacyR16,
                `Il vecchio tabellone non e' stato ridotto agli otto finalisti: ${JSON.stringify(result)}`);
            t.assert(result.unique === 8 && result.hasMarik && result.opponent === 'rex',
                `Finalisti duplicati, Marik assente o avversario migrato perso: ${JSON.stringify(result)}`);
            t.assert(result.quarter === 'player' && result.phase === 'tower' && !result.eliminated,
                `La vittoria nel duello migrato deve chiudere i quarti: ${JSON.stringify(result)}`);
            t.assert(result.outcomeLeft === null, 'L’esito automatico deve essere consumato una sola volta');
        } finally {
            await page.close();
        }
    }
};
