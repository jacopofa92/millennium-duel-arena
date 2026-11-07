module.exports = {
    name: 'Distruzione M/T e Terreno: scossa olografica non esplosiva',
    async run(t) {
        const result = await t.evaluate(async () => {
            const spell = { ...cardDatabase.find((c) => c.type === 'spell' && c.subtype !== 'field'), uid: 'fx-st-test' };
            const fieldSpell = { ...cardDatabase.find((c) => c.type === 'spell' && c.subtype === 'field'), uid: 'fx-field-test' };
            gameState.playerSTField[0] = { card: spell, isFaceDown: false, setOnTurn: 0 };
            gameState.playerFieldSpell = { card: fieldSpell, isFaceDown: false, setOnTurn: 0 };
            updateUI();
            await new Promise((resolve) => requestAnimationFrame(resolve));

            DuelEngine.actions.destroySpellTrap('player', 0);
            const stScene = document.querySelector('.fx-st-shatter');
            const stStyle = stScene && getComputedStyle(stScene.querySelector('.fx-st-shatter-card'));
            const noExplosion = !document.querySelector('.fx-explosion-burst, .fx-destroy-rays');

            DuelEngine.actions.destroyFieldSpell('player');
            const fieldScene = document.querySelector('.fx-st-shatter--field');
            return {
                stScene: !!stScene,
                // Dal 2026-11-07 la carta SCUOTE per un secondo (poi vola al Cimitero): vedi distruzione-magie-trappole-scossa-e-volo.
                stAnimation: !!stStyle && stStyle.animationName === 'fxStShake',
                noExplosion,
                stRemoved: gameState.playerSTField[0] === null,
                fieldScene: !!fieldScene,
                fieldRemoved: gameState.playerFieldSpell === null
            };
        });
        t.assert(Object.values(result).every(Boolean),
            `Distruzione M/T incompleta: ${JSON.stringify(result)}`);
    }
};
