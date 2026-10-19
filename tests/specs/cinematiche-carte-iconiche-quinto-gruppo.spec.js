const fs = require('fs');
const path = require('path');
module.exports = {
    name: 'Cinematiche iconiche V: Cerchio, Cappelli, Moltiplicazione, Controller e Dimensione',
    async run(t) {
        // Questi spec provano le cinematiche in DOM/CSS (le versioni di base e il ripiego): gli spettacoli
        // hanno anche una versione WebGL (js/ui/fx-webgl-scena.js), provata da fx-webgl-spettacoli.spec.js.
        await t.page.evaluate(() => { window.FX_BACKEND = 'css'; });
        const root = path.join(__dirname, '..', '..');
        const js = fs.readFileSync(path.join(root, 'js/ui/effects.js'), 'utf8');
        const css = fs.readFileSync(path.join(root, 'js/ui/effects.css'), 'utf8');
        ['playSpellbindingCircle','playMagicalHats','playMultiply','playEnemyController','playDimensionHole'].forEach((n)=>t.assert(js.includes(`function ${n}`)&&(js.includes(`${n},`) || js.includes(`${n}: viaBackend`)),`${n} deve essere esposto`));
        ['.fx-spellbinding-burst','.spellbinding-circle-link','.fx-magical-hats','.fx-multiply','.fx-enemy-controller','.fx-dimension-hole'].forEach((s)=>t.assert(css.includes(s),`${s} deve esistere`));
        const result = await t.evaluate(async()=>{
            const monster=cardDatabase.find(c=>c.type==='monster'&&!c.extraDeck&&(c.level||0)<=4); const a={...monster,uid:'five-a'},b={...monster,uid:'five-b'};
            const circle={...cardDatabase.find(c=>c.id===620),uid:'five-circle',targetUid:b.uid,targetOwner:'bot',targetIndex:0};
            gameState.playerMonsterField=[{card:a,position:'attack',isFaceDown:false},null,null,null,null]; gameState.botMonsterField=[{card:b,position:'attack',isFaceDown:false},null,null,null,null];
            gameState.playerSTField=[{card:circle,isFaceDown:false},null,null,null,null]; gameState.botSTField=[null,null,null,null,null]; updateUI();
            const persistent=!!document.querySelector('.spellbinding-circle-link');
            FX.playSpellbindingCircle('bot',0); FX.playMagicalHats('player',[0]); FX.playMultiply('player',0,[0]); FX.playEnemyController('bot',0,'posizione'); FX.playDimensionHole('player',0,a);
            await new Promise(r=>setTimeout(r,80)); const mounted=['.fx-spellbinding-burst','.fx-magical-hats','.fx-multiply','.fx-enemy-controller','.fx-dimension-hole'].every(s=>document.querySelector(s));
            gameState.playerSTField[0]=null; updateUI(); const removed=!document.querySelector('.spellbinding-circle-link'); await new Promise(r=>setTimeout(r,1700));
            return {persistent,mounted,removed,unlocked:!FX.isCinematicPlaying()};
        });
        t.assert(result.persistent&&result.removed,'Il Cerchio persistente deve seguire la Trappola'); t.assert(result.mounted&&result.unlocked,'Le cinque scene devono montarsi e chiudersi');
    }
};
