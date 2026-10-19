// Secondo gruppo di carte iconiche: callback e collegamenti persistenti non
// devono anticipare o sostituire la regola reale.
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'Cinematiche iconiche II: tempeste, controllo, Anello e Richiamo persistente',
    async run(t) {
        // Questi spec provano le cinematiche in DOM/CSS (le versioni di base e il ripiego): gli spettacoli
        // hanno anche una versione WebGL (js/ui/fx-webgl-scena.js), provata da fx-webgl-spettacoli.spec.js.
        await t.page.evaluate(() => { window.FX_BACKEND = 'css'; });
        const root = path.join(__dirname, '..', '..');
        const effects = fs.readFileSync(path.join(root, 'js', 'ui', 'effects.js'), 'utf8');
        const css = fs.readFileSync(path.join(root, 'js', 'ui', 'effects.css'), 'utf8');
        ['playRingOfDestruction', 'playHeavyStorm', 'playMysticalSpaceTyphoon', 'playMindControl', 'playCallOfTheHaunted']
            .forEach((name) => t.assert(effects.includes(`function ${name}`) && (effects.includes(`${name},`) || effects.includes(`${name}: viaBackend`)), `${name} deve essere implementato ed esposto`));
        ['.fx-ring-collar', '.fx-heavy-storm', '.fx-mst-scene', '.fx-mst-funnel', '.fx-mst-card', '.fx-control-mark', '.fx-call-haunted', '.call-haunted-link']
            .forEach((selector) => t.assert(css.includes(selector), `${selector} deve avere resa dedicata`));

        const rules = await t.evaluate(() => {
            const copia = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && (c.level || 0) <= 4 && !DuelEngine.getDefinition(c.id)?.cannotBeSpecialSummoned);
            const realFX = window.FX;
            const eventi = [];
            const callbacks = {};
            window.FX = { ...realFX,
                playHeavyStorm(done) { eventi.push('tempesta'); callbacks.tempesta = done; },
                playMysticalSpaceTyphoon(owner, index, done) { eventi.push(['tifone', owner, index]); callbacks.tifone = done; },
                playRingOfDestruction(owner, index, damage) { eventi.push(['anello', owner, index, damage]); },
                playMindControl(card, owner, index, mode) { eventi.push(['controllo', owner, index, mode]); },
                playCallOfTheHaunted(owner, card, index, done) { eventi.push(['richiamo', owner, index]); callbacks.richiamo = done; }
            };

            // Tempesta: nessuna carta sparisce prima della callback.
            gameState.playerSTField = [{ card: copia(40, 'st-player'), isFaceDown: true }, null, null, null, null];
            gameState.botSTField = [{ card: copia(503, 'st-bot'), isFaceDown: true }, null, null, null, null];
            DuelEngine.getDefinition(646).activate(DuelEngine.makeContext('player', { card: copia(646, 'heavy') }));
            const tempestaPrima = gameState.playerSTField.filter(Boolean).length + gameState.botSTField.filter(Boolean).length;
            callbacks.tempesta();
            const tempestaDopo = gameState.playerSTField.filter(Boolean).length + gameState.botSTField.filter(Boolean).length;

            // Tifone del bot preferisce una carta avversaria e aspetta lo strappo del vortice.
            gameState.playerSTField = [{ card: copia(40, 'mst-target'), isFaceDown: true }, null, null, null, null];
            gameState.botSTField = [null, null, null, null, null];
            DuelEngine.getDefinition(607).activate(DuelEngine.makeContext('bot', { card: copia(607, 'mst') }));
            const tifonePrima = gameState.playerSTField.filter(Boolean).length;
            callbacks.tifone();
            const tifoneDopo = gameState.playerSTField.filter(Boolean).length;

            // Le due carte controllo condividono il VFX ma mantengono regole proprie.
            gameState.playerMonsterField = [{ card: { ...base, uid: 'heart-target' }, position: 'attack', isFaceDown: false }, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            DuelEngine.getDefinition(147).activate(DuelEngine.makeContext('bot', { card: copia(147, 'heart') }));
            gameState.playerMonsterField = [{ card: { ...base, uid: 'mind-target' }, position: 'defense', isFaceDown: true }, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            DuelEngine.getDefinition(130).activate(DuelEngine.makeContext('bot', { card: copia(130, 'mind') }));

            // Anello risolve subito danno/distruzione, ma riceve bersaglio e ATK.
            const ringTarget = { ...base, uid: 'ring-target', attack: 1200 };
            gameState.playerMonsterField = [{ card: ringTarget, position: 'attack', isFaceDown: false }, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            DuelEngine.getDefinition(419).activate(DuelEngine.makeContext('bot', { card: copia(419, 'ring') }));
            const anelloDistrutto = !gameState.playerMonsterField[0];

            // Richiamo: searchGraveyard estrae la carta, ma lo slot resta
            // vuoto finché la scena non invoca la callback.
            const trap = copia(136, 'haunted-trap');
            gameState.botSTField = [{ card: trap, isFaceDown: false }, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.botGraveyard = [{ ...base, uid: 'haunted-target' }];
            DuelEngine.getDefinition(136).activate(DuelEngine.makeContext('bot', { card: trap, index: 0 }));
            const richiamoPrima = gameState.botMonsterField.filter(Boolean).length;
            callbacks.richiamo();
            const richiamoDopo = gameState.botMonsterField.filter(Boolean).length;
            const linkRegistrato = trap.targetUid === 'haunted-target';

            window.FX = realFX;
            return { eventi, tempestaPrima, tempestaDopo, tifonePrima, tifoneDopo, anelloDistrutto, richiamoPrima, richiamoDopo, linkRegistrato };
        });

        t.assert(rules.tempestaPrima === 2 && rules.tempestaDopo === 0, 'Tempesta Pesante deve risolvere soltanto all impatto');
        t.assert(rules.tifonePrima === 1 && rules.tifoneDopo === 0, 'Tifone deve attendere la propria implosione');
        t.assert(rules.eventi.some((e) => Array.isArray(e) && e[0] === 'controllo' && e[3] === 'heart')
            && rules.eventi.some((e) => Array.isArray(e) && e[0] === 'controllo' && e[3] === 'mind'),
        'Cambio di Cuore e Controllo Mentale devono usare le due identità dello stesso VFX');
        t.assert(rules.anelloDistrutto && rules.eventi.some((e) => Array.isArray(e) && e[0] === 'anello' && e[3] === 1200),
            'Anello deve animare il bersaglio con il danno effettivo');
        t.assert(rules.richiamoPrima === 0 && rules.richiamoDopo === 1 && rules.linkRegistrato,
            'Richiamo deve evocare alla callback e registrare il collegamento persistente');

        const visuals = await t.evaluate(async () => {
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && (c.level || 0) <= 4);
            const card = { ...base, uid: 'visual-haunted' };
            const trap = { ...cardDatabase.find((c) => c.id === 136), uid: 'visual-trap', targetUid: card.uid, targetOwner: 'player', targetIndex: 0 };
            gameState.playerMonsterField = [{ card, position: 'attack', isFaceDown: false }, null, null, null, null];
            gameState.botMonsterField = [{ card: { ...base, uid: 'visual-ring' }, position: 'attack', isFaceDown: false }, null, null, null, null];
            gameState.playerSTField = [{ card: trap, isFaceDown: false }, null, null, null, null];
            gameState.botSTField = [{ card: { ...cardDatabase.find((c) => c.id === 40), uid: 'visual-mst' }, isFaceDown: true }, null, null, null, null];
            updateUI();
            const persistente = !!document.querySelector('.call-haunted-link--player');
            FX.playRingOfDestruction('bot', 0, 1000);
            FX.playHeavyStorm(() => {});
            FX.playMysticalSpaceTyphoon('bot', 0, () => {});
            FX.playMindControl(card, 'player', 0, 'heart');
            FX.playCallOfTheHaunted('player', card, 1, () => {});
            await new Promise((resolve) => setTimeout(resolve, 80));
            const presenti = ['.fx-destruction-ring', '.fx-heavy-storm', '.fx-mst-scene', '.fx-mst-funnel', '.fx-mst-card', '.fx-control-mark', '.fx-call-haunted']
                .every((selector) => !!document.querySelector(selector));
            gameState.playerSTField[0] = null;
            updateUI();
            const rimosso = !document.querySelector('.call-haunted-link');
            await new Promise((resolve) => setTimeout(resolve, 1850));
            return { persistente, presenti, rimosso, sbloccato: !FX.isCinematicPlaying() };
        });
        t.assert(visuals.persistente && visuals.rimosso, 'La catena persistente deve seguire lo stato reale della Trappola');
        t.assert(visuals.presenti && visuals.sbloccato, 'Le cinque scene devono montarsi e liberare il lock senza errori');
    }
};
