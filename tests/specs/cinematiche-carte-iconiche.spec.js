// Le cinque cinematiche devono restare decorative: la regola delle
// Trappole continua a risolversi subito, mentre Rinascita del Mostro è
// deliberatamente sincronizzata alla callback del proprio Ankh.
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'Cinematiche iconiche: integrazione e sincronizzazione delle cinque carte',
    async run(t) {
        // Questi spec provano le cinematiche in DOM/CSS (le versioni di base e il ripiego): gli spettacoli
        // hanno anche una versione WebGL (js/ui/fx-webgl-scena.js), provata da fx-webgl-spettacoli.spec.js.
        await t.page.evaluate(() => { window.FX_BACKEND = 'css'; });
        const root = path.join(__dirname, '..', '..');
        const effects = fs.readFileSync(path.join(root, 'js', 'ui', 'effects.js'), 'utf8');
        const css = fs.readFileSync(path.join(root, 'js', 'ui', 'effects.css'), 'utf8');
        [
            'playMirrorForce', 'playMagicCylinder', 'playMonsterReborn',
            'playTrapHole', 'playTorrentialTribute'
        ].forEach((name) => t.assert(effects.includes(`function ${name}`) && (effects.includes(`${name},`) || effects.includes(`${name}: viaBackend`)), `${name} deve essere implementato ed esposto da FX`));
        [
            '.fx-mirror-disc', '.fx-cylinder', '.fx-reborn-ankh',
            '.fx-trap-hole', '.fx-torrential-wave'
        ].forEach((selector) => t.assert(css.includes(selector), `${selector} deve avere uno stile dedicato`));

        const result = await t.evaluate(() => {
            const copia = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
            const mostro = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && (c.level || 0) <= 4 && !DuelEngine.getDefinition(c.id)?.cannotBeSpecialSummoned);
            const eventi = [];
            let rinascita = null;
            const realFX = window.FX;
            window.FX = { ...window.FX,
                playMirrorForce(owner) { eventi.push(['specchio', owner]); },
                playMagicCylinder(attackerOwner, attackerIndex, damagedOwner, damage) { eventi.push(['cilindro', attackerOwner, attackerIndex, damagedOwner, damage]); },
                playMonsterReborn(graveyardOwner, card, targetOwner, targetIndex, done) {
                    rinascita = { graveyardOwner, card, targetOwner, targetIndex, done };
                },
                playTorrentialTribute() { eventi.push(['torrenziale']); },
                playTrapHole() { eventi.push(['buco']); }
            };

            gameState.playerMonsterField = [
                { card: { ...mostro, uid: 'attacco-1' }, position: 'attack', isFaceDown: false },
                { card: { ...mostro, uid: 'difesa-1' }, position: 'defense', isFaceDown: false },
                null, null, null
            ];
            gameState.botMonsterField = [null, null, null, null, null];
            const mirror = DuelEngine.getDefinition(382);
            mirror.onAttackDeclare(DuelEngine.makeContext('bot', { attackerIndex: 0 }));
            const dopoSpecchio = gameState.playerMonsterField.map(Boolean);

            let annullato = false;
            const cylinder = DuelEngine.getDefinition(10);
            const lpPrima = gameState.playerLP;
            cylinder.onAttackDeclare(DuelEngine.makeContext('bot', {
                attackerIndex: 1,
                attackerAtk: 1700,
                cancelAttack() { annullato = true; }
            }));

            gameState.playerGraveyard = [];
            gameState.botGraveyard = [{ ...mostro, uid: 'rinato-1', attack: Math.max(1900, mostro.attack || 0) }];
            gameState.botMonsterField = [null, null, null, null, null];
            DuelEngine.getDefinition(35).activate(DuelEngine.makeContext('bot', { card: copia(35, 'reborn-spell') }));
            const primaDellaLuce = {
                cimitero: gameState.botGraveyard.length,
                campo: gameState.botMonsterField.filter(Boolean).length,
                registrata: !!rinascita
            };
            if (rinascita) rinascita.done();
            const dopoLaLuce = {
                cimitero: gameState.botGraveyard.length,
                campo: gameState.botMonsterField.filter(Boolean).length
            };

            gameState.playerMonsterField = [{ card: { ...mostro, uid: 'p-torrente' }, position: 'attack', isFaceDown: false }, null, null, null, null];
            gameState.botMonsterField = [{ card: { ...mostro, uid: 'b-torrente' }, position: 'attack', isFaceDown: false }, null, null, null, null];
            DuelEngine.getDefinition(490).onOpponentSummon(DuelEngine.makeContext('player', {}));

            const risultato = {
                eventi,
                dopoSpecchio,
                annullato,
                dannoCilindro: lpPrima - gameState.playerLP,
                primaDellaLuce,
                dopoLaLuce,
                dopoTorrenziale: gameState.playerMonsterField.filter(Boolean).length + gameState.botMonsterField.filter(Boolean).length
            };
            window.FX = realFX;
            return risultato;
        });

        t.assert(result.eventi.some((e) => e[0] === 'specchio' && e[1] === 'player'), 'Forza dello Specchio deve puntare il lato attaccante');
        t.assert(result.dopoSpecchio[0] === false && result.dopoSpecchio[1] === true, 'Forza dello Specchio distrugge solo i mostri in Attacco');
        t.assert(result.annullato && result.eventi.some((e) => e[0] === 'cilindro' && e[4] === 1700), 'Cilindro Magico deve annullare e mostrare il danno riflesso');
        t.assert(result.primaDellaLuce.registrata && result.primaDellaLuce.cimitero === 1 && result.primaDellaLuce.campo === 0,
            'Rinascita non deve inserire il mostro prima dell impatto visivo');
        t.assert(result.dopoLaLuce.cimitero === 0 && result.dopoLaLuce.campo === 1,
            'La callback dell Ankh deve completare davvero la Special Summon');
        t.assert(result.eventi.some((e) => e[0] === 'torrenziale') && result.dopoTorrenziale === 0,
            'Tributo Torrenziale deve mostrare l onda e distruggere entrambi i campi');

        const smoke = await t.evaluate(async () => {
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            const card = { ...base, uid: 'fx-smoke-card' };
            gameState.playerMonsterField = [{ card, position: 'attack', isFaceDown: false }, null, null, null, null];
            gameState.botMonsterField = [{ card: { ...base, uid: 'fx-smoke-bot' }, position: 'attack', isFaceDown: false }, null, null, null, null];
            updateUI();
            FX.playMirrorForce('player', [0]);
            FX.playMagicCylinder('player', 0, 'player', 1500);
            FX.playMonsterReborn('player', card, 'player', 1, () => {});
            FX.playTrapHole('bot', 0, card);
            FX.playTorrentialTribute();
            await new Promise((resolve) => setTimeout(resolve, 80));
            const cilindro = document.querySelector('.fx-magic-cylinder');
            const specchio = document.querySelector('.fx-mirror-force');
            const presenti = [
                '.fx-mirror-force', '.fx-magic-cylinder', '.fx-monster-reborn',
                '.fx-trap-hole', '.fx-torrential'
            ].every((selector) => !!document.querySelector(selector));
            const bersaglioCilindro = cilindro && cilindro.dataset.target;
            const grande = cilindro && parseFloat(getComputedStyle(cilindro.querySelector('.fx-cylinder')).width) >= 108;
            const specchioGrande = specchio && parseFloat(getComputedStyle(specchio.querySelector('.fx-mirror-disc')).width) >= 300;
            const bersagliSpecchio = specchio && Number(specchio.dataset.targetCount);
            await new Promise((resolve) => setTimeout(resolve, 2350));
            return { presenti, bersaglioCilindro, grande, specchioGrande, bersagliSpecchio, sbloccato: !FX.isCinematicPlaying() };
        });
        t.assert(smoke.presenti, 'Le cinque scene devono poter convivere senza errori DOM');
        t.assert(smoke.bersaglioCilindro === 'playerHand' && smoke.grande,
            `Cilindro Magico deve puntare la mano con portali grandi: ${JSON.stringify(smoke)}`);
        t.assert(smoke.specchioGrande && smoke.bersagliSpecchio === 1,
            `Forza dello Specchio deve usare una scena ampia e un impatto per bersaglio: ${JSON.stringify(smoke)}`);
        t.assert(smoke.sbloccato, 'Ogni cinematica deve liberare il blocco al termine');
    }
};
