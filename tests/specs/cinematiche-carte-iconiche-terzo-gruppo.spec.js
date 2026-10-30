// Terzo gruppo di carte iconiche: ogni fenomeno deve avere un'identità
// distinta e restare un puro consumatore dello stato deciso dal motore.
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'Cinematiche iconiche III: Bottomless, Sakuretsu, Giudizio, Libro e Virus',
    async run(t) {
        // Questi spec provano le cinematiche in DOM/CSS (le versioni di base e il ripiego): gli spettacoli
        // hanno anche una versione WebGL (js/ui/fx-webgl-scena.js), provata da fx-webgl-spettacoli.spec.js.
        await t.page.evaluate(() => { window.FX_BACKEND = 'css'; });
        const root = path.join(__dirname, '..', '..');
        const effects = fs.readFileSync(path.join(root, 'js', 'ui', 'effects.js'), 'utf8');
        const css = fs.readFileSync(path.join(root, 'js', 'ui', 'effects.css'), 'utf8');
        const integrations = [
            ['js/engine/card-effects-1.js', 'playBottomlessTrapHole'],
            ['js/engine/card-effects-2.js', 'playCrushCardVirus'],
            ['js/engine/card-effects-4.js', 'playSolemnJudgment'],
            ['js/engine/card-effects-6.js', 'playSakuretsuArmor'],
            ['js/engine/card-effects-7.js', 'playBookOfMoon']
        ];

        ['playBottomlessTrapHole', 'playSakuretsuArmor', 'playSolemnJudgment', 'playBookOfMoon', 'playCrushCardVirus']
            .forEach((name) => t.assert(effects.includes(`function ${name}`) && (effects.includes(`${name},`) || effects.includes(`${name}: viaBackend`)), `${name} deve essere implementato ed esposto`));
        ['.fx-bottomless-hole', '.fx-solemn-judgment', '.fx-book-moon', '.fx-crush-virus']
            .forEach((selector) => t.assert(css.includes(selector), `${selector} deve avere una resa dedicata`));
        integrations.forEach(([file, call]) => {
            const source = fs.readFileSync(path.join(root, file), 'utf8');
            t.assert(source.includes(`FX.${call}`), `${call} deve essere collegato alla regola reale`);
        });

        const visuals = await t.evaluate(async () => {
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && (c.level || 0) <= 4);
            const own = { ...base, uid: 'fx-third-own' };
            const enemy = { ...base, uid: 'fx-third-enemy' };
            gameState.playerMonsterField = [{ card: own, position: 'attack', isFaceDown: false }, null, null, null, null];
            gameState.botMonsterField = [{ card: enemy, position: 'attack', isFaceDown: false }, null, null, null, null];
            updateUI();

            FX.playBottomlessTrapHole('bot', 0, enemy);
            FX.playSakuretsuArmor('bot', 0);
            FX.playSolemnJudgment('player', 4000);
            FX.playBookOfMoon('player', 0, own);
            FX.playCrushCardVirus('player', [0]);
            await new Promise((resolve) => setTimeout(resolve, 80));

            const presenti = ['.fx-bottomless-hole', '.fx-solemn-judgment', '.fx-book-moon', '.fx-crush-virus']
                .every((selector) => !!document.querySelector(selector));
            const dati = {
                costo: document.querySelector('.fx-solemn-judgment small')?.textContent,
                bersagliVirus: document.querySelectorAll('.fx-virus-target').length
            };
            await new Promise((resolve) => setTimeout(resolve, 1850));
            return { presenti, dati, sbloccato: !FX.isCinematicPlaying() };
        });

        t.assert(visuals.presenti, 'Le cinque scene devono montarsi senza errori');
        t.assert(visuals.dati.costo === '-4000 LP', 'Giudizio deve mostrare il costo realmente pagato');
        t.assert(visuals.dati.bersagliVirus === 1, 'Il Virus deve marcare soltanto gli slot realmente colpiti');
        t.assert(visuals.sbloccato, 'Tutte le scene devono rilasciare il lock cinematografico');
    }
};
