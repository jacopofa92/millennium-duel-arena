// Quarto gruppo: attacco negato, Token, doppio bersaglio, sovraccarico
// Macchina e legame persistente di Incantesimo Ombra.
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'Cinematiche iconiche IV: Nega Attacco, Capro, Scatola, Limitatore e Ombra',
    async run(t) {
        // Questi spec provano le cinematiche in DOM/CSS (le versioni di base e il ripiego): gli spettacoli
        // hanno anche una versione WebGL (js/ui/fx-webgl-scena.js), provata da fx-webgl-spettacoli.spec.js.
        await t.page.evaluate(() => { window.FX_BACKEND = 'css'; });
        const root = path.join(__dirname, '..', '..');
        const effects = fs.readFileSync(path.join(root, 'js', 'ui', 'effects.js'), 'utf8');
        const css = fs.readFileSync(path.join(root, 'js', 'ui', 'effects.css'), 'utf8');
        ['playNegateAttack', 'playScapegoat', 'playMysticBox', 'playLimiterRemoval', 'playShadowSpell']
            .forEach((name) => t.assert(effects.includes(`function ${name}`) && (effects.includes(`${name},`) || effects.includes(`${name}: viaBackend`)), `${name} deve essere implementato ed esposto`));
        ['.fx-negate-attack', '.fx-scapegoat', '.fx-mystic-box', '.fx-limiter-removal', '.fx-shadow-bind', '.shadow-spell-link']
            .forEach((selector) => t.assert(css.includes(selector), `${selector} deve avere una resa dedicata`));

        const integrations = [
            ['js/engine/card-effects-6.js', 'playNegateAttack'],
            ['js/engine/card-effects-3.js', 'playScapegoat'],
            ['js/engine/card-effects-3.js', 'playMysticBox'],
            ['js/engine/card-effects-3.js', 'playLimiterRemoval'],
            ['js/engine/card-effects-3.js', 'playShadowSpell'],
            ['js/engine/game-flow.js', 'shadow-spell-link']
        ];
        integrations.forEach(([file, marker]) => {
            const source = fs.readFileSync(path.join(root, file), 'utf8');
            t.assert(source.includes(marker), `${marker} deve essere collegato al flusso reale`);
        });

        const visuals = await t.evaluate(async () => {
            const monster = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && (c.level || 0) <= 4);
            const machine = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && c.race === 'Macchina');
            const own = { ...machine, uid: 'fx-four-own' };
            const enemy = { ...monster, uid: 'fx-four-enemy' };
            const shadow = { ...cardDatabase.find((c) => c.id === 439), uid: 'fx-four-shadow', targetUid: enemy.uid, targetOwner: 'bot', targetIndex: 0 };
            gameState.playerMonsterField = [{ card: own, position: 'attack', isFaceDown: false }, null, null, null, null];
            gameState.botMonsterField = [{ card: enemy, position: 'attack', isFaceDown: false }, null, null, null, null];
            gameState.playerSTField = [{ card: shadow, isFaceDown: false }, null, null, null, null];
            gameState.botSTField = [null, null, null, null, null];
            updateUI();
            const persistente = !!document.querySelector('.shadow-spell-link--bot');
            FX.playNegateAttack('bot', 0);
            FX.playScapegoat('player', [0]);
            FX.playMysticBox({ owner: 'bot', index: 0, card: enemy }, { owner: 'player', index: 0, card: own });
            FX.playLimiterRemoval('player', [0]);
            FX.playShadowSpell('bot', 0);
            await new Promise((resolve) => setTimeout(resolve, 80));
            const presenti = ['.fx-negate-attack', '.fx-scapegoat', '.fx-mystic-box', '.fx-limiter-removal', '.fx-shadow-bind']
                .every((selector) => !!document.querySelector(selector));
            const pecore = document.querySelectorAll('.fx-sheep-spirit').length;
            const sovraccarichi = document.querySelectorAll('.fx-machine-surge').length;
            gameState.playerSTField[0] = null;
            updateUI();
            const rimosso = !document.querySelector('.shadow-spell-link');
            await new Promise((resolve) => setTimeout(resolve, 1800));
            return { persistente, presenti, pecore, sovraccarichi, rimosso, sbloccato: !FX.isCinematicPlaying() };
        });

        t.assert(visuals.persistente && visuals.rimosso, 'Il legame Ombra deve seguire lo stato reale della Trappola');
        t.assert(visuals.presenti && visuals.pecore === 1 && visuals.sovraccarichi === 1, 'Le cinque scene devono montare i bersagli richiesti');
        t.assert(visuals.sbloccato, 'Le scene devono rilasciare il lock cinematografico');
    }
};
