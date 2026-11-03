// Ogni torneo chiede la difficoltà una volta sola e la conserva nello
// stato. Tutti gli incontri passano poi dal rispettivo launchDuel, quindi
// perdere Facile nella costruzione dello stato rendeva Medio OGNI avversario.
const path = require('path');

const CASI = [
    {
        pagina: 'torneo-regno-duellanti.html', id: 'duelistKingdom', costruttore: 'makeInitialState'
    },
    {
        pagina: 'torneo-battle-city.html', id: 'battleCity', costruttore: 'makeInitialState'
    },
    {
        pagina: 'torneo-kaiba.html', id: 'kaibaTournament', costruttore: 'buildBracket'
    }
];

module.exports = {
    name: 'Tornei: Facile, Normale e Difficile valgono per tutti gli incontri',
    standalone: true,
    async run({ browser, assert }) {
        const radice = path.join(__dirname, '..', '..').replace(/\\/g, '/');
        const context = await browser.newContext({ serviceWorkers: 'block' });
        await context.addInitScript(() => {
            window.AUTH_GATE_SKIP = true;
            window.DUEL_RPS_SKIP = true;
            window.DUEL_FAST_OPENING = true;
            localStorage.clear();
            sessionStorage.clear();
        });
        try {
            for (const caso of CASI) {
                const page = await context.newPage();
                await page.goto(`file:///${radice}/${caso.pagina}`);
                await page.waitForFunction((nome) => typeof window[nome] === 'function' && !!window.SaveManager, caso.costruttore);

                const livelli = await page.evaluate((nome) => {
                    const crea = window[nome];
                    return ['Facile', 'Medio', 'Difficile'].map((livello) => crea(livello).difficulty);
                }, caso.costruttore);
                assert(JSON.stringify(livelli) === JSON.stringify(['Facile', 'Medio', 'Difficile']),
                    `${caso.pagina} conserva tutti i livelli: ${JSON.stringify(livelli)}`);

                // Prova il percorso che prima era rotto: stato Facile,
                // lancio del primo avversario e lettura nel motore.
                await page.evaluate(({ id, nome }) => {
                    const stato = window[nome]('Facile');
                    SaveManager.setTournamentState(id, stato);
                    window.DeckLegality = { mazzoCorrenteNonAmmesso: () => [] };
                    if (id === 'duelistKingdom') launchDuel({ characterId: 'rex' });
                    else if (id === 'battleCity') launchDuel({ characterId: 'rex', stage: 'street' }, stato);
                    else launchDuel({ characterId: 'rex', round: 'preliminary1' }, stato);
                }, { id: caso.id, nome: caso.costruttore });
                await page.waitForURL(/duelMonstersCore\.html/, { timeout: 15000 });
                assert(new URL(page.url()).searchParams.get('difficulty') === 'Facile',
                    `${caso.pagina} passa Facile al duello: ${page.url()}`);
                await page.waitForFunction(() => window.DuelSession && typeof gameState !== 'undefined'
                    && typeof gameState.botDifficulty === 'string', null, { timeout: 30000 });
                const motore = await page.evaluate(() => ({ sessione: DuelSession.difficulty, ia: gameState.botDifficulty }));
                assert(motore.sessione === 'Facile' && motore.ia === 'easy',
                    `${caso.pagina} applica Facile a mazzo e IA: ${JSON.stringify(motore)}`);
                await page.close();
            }
        } finally {
            await context.close();
        }
    }
};
