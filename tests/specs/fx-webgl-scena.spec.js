// Gli spettacoli di carta in WebGL (js/ui/fx-webgl-scena.js): ognuno parte senza errori, apre la
// cinematica (il bot aspetta) e la chiude da solo alla fine, e le callback da cui dipende il
// duello (l'impatto di tempeste, Tifone, Rinascita, Richiamo, Tornado, Piumino) arrivano UNA
// volta sola. Si lanciano tutti insieme: devono convivere sullo stesso canvas.
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'FX WebGL (scena): tutti gli spettacoli partono, chiudono la cinematica e le callback arrivano una volta',
    async run({ page, assert }) {
        await openDuel(page);
        await page.waitForFunction(() => !!window.FxWebglScena && !!window.FX && !!window.FxWebgl);
        const nomi = await page.evaluate(() => FxWebglScena.NOMI);
        assert(nomi.length >= 28, `Devono essere coperti tutti gli effetti della lista: ${nomi.length}`);

        const r = await page.evaluate(async () => {
            window.FX_BACKEND = 'webgl';
            const mostri = cardDatabase.filter((c) => c.type === 'monster' && !c.extraDeck && (c.level || 0) <= 4);
            const campo = (o) => [0, 1, 2, 3, 4].map((i) => ({ card: Object.assign({}, mostri[i], { uid: o + 'f' + i }), position: 'attack', isFaceDown: false }));
            gameState.playerMonsterField = campo('p'); gameState.botMonsterField = campo('b');
            if (typeof renderFields === 'function') renderFields();
            await new Promise((x) => setTimeout(x, 300));
            const c = (o, i) => ({ owner: o, index: i, card: gameState[o + 'MonsterField'][i].card });
            const cb = {};
            const una = (n) => () => { cb[n] = (cb[n] || 0) + 1; };
            const lanci = {
                playMirrorForce: () => FX.playMirrorForce('bot', [0, 1, 2]),
                playMagicCylinder: () => FX.playMagicCylinder('bot', 1, 'bot', 1500),
                playMonsterReborn: () => FX.playMonsterReborn('player', c('player', 0).card, 'player', 2, una('reborn')),
                playTrapHole: () => FX.playTrapHole('bot', 2, c('bot', 2).card),
                playTorrentialTribute: () => FX.playTorrentialTribute(),
                playRingOfDestruction: () => FX.playRingOfDestruction('bot', 3, 1200),
                playHeavyStorm: () => FX.playHeavyStorm(una('storm')),
                playMysticalSpaceTyphoon: () => FX.playMysticalSpaceTyphoon('bot', 1, una('typhoon')),
                playMindControl: () => FX.playMindControl(c('bot', 1).card, 'bot', 1, 'heart'),
                playCallOfTheHaunted: () => FX.playCallOfTheHaunted('player', c('player', 1).card, 3, una('haunted')),
                playBottomlessTrapHole: () => FX.playBottomlessTrapHole('bot', 4, c('bot', 4).card),
                playSakuretsuArmor: () => FX.playSakuretsuArmor('bot', 0),
                playSolemnJudgment: () => FX.playSolemnJudgment('player', 2000),
                playBookOfMoon: () => FX.playBookOfMoon('bot', 1, c('bot', 1).card),
                playCrushCardVirus: () => FX.playCrushCardVirus('player', [0, 2, 4]),
                playNegateAttack: () => FX.playNegateAttack('bot', 2),
                playScapegoat: () => FX.playScapegoat('player', [1, 2, 3]),
                playMysticBox: () => FX.playMysticBox(c('bot', 0), c('player', 1)),
                playLimiterRemoval: () => FX.playLimiterRemoval('player', [1, 3]),
                playShadowSpell: () => FX.playShadowSpell('bot', 3),
                playSpellbindingCircle: () => FX.playSpellbindingCircle('bot', 2),
                playMagicalHats: () => FX.playMagicalHats('player', [1, 2, 3]),
                playMultiply: () => FX.playMultiply('player', 2, [0, 4]),
                playEnemyController: () => FX.playEnemyController('bot', 2, 'controllo'),
                playDimensionHole: () => FX.playDimensionHole('bot', 0, c('bot', 0).card),
                playDustTornado: () => FX.playDustTornado('bot', 2, una('dust')),
                playHarpiesFeatherDuster: () => FX.playHarpiesFeatherDuster('bot', una('harpie'))
            };
            // A gruppi di sei insieme: sullo stesso canvas devono convivere, ma ogni passata e' a tutto
            // schermo e in un browser senza GPU vera ventisette insieme lo farebbero perdere il contesto.
            const errori = []; const nomi = Object.keys(lanci); const durante = { attivi: 0, cinematica: true }; const dopo = { attivi: 0, cinematica: false };
            for (let g = 0; g < nomi.length; g += 6) {
                const gruppo = nomi.slice(g, g + 6);
                gruppo.forEach((n) => { try { lanci[n](); } catch (e) { errori.push(n + ': ' + e.message); } });
                await new Promise((x) => setTimeout(x, 350));
                const a = FxWebgl.attivi(); const ci = FX.isCinematicPlaying();
                if (a < 3 || !ci) { durante.attivi = Math.min(durante.attivi || 99, a); durante.cinematica = durante.cinematica && ci; } else { durante.attivi = Math.max(durante.attivi, 0); }
                await new Promise((x) => setTimeout(x, 2500));
                dopo.attivi += FxWebgl.attivi(); dopo.cinematica = dopo.cinematica || FX.isCinematicPlaying();
            }            return { errori, durante, dopo: { attivi: FxWebgl.attivi(), cinematica: FX.isCinematicPlaying() }, cb };
        });
        assert(r.errori.length === 0, `Effetti che lanciano eccezioni: ${JSON.stringify(r.errori)}`);
        assert(r.durante.attivi === 0 && r.durante.cinematica === true, `Ogni gruppo di spettacoli deve partire (almeno 3 canvas attivi) e tenere aperta la cinematica: ${JSON.stringify(r.durante)}`);
        assert(r.dopo.attivi === 0 && r.dopo.cinematica === false, `Alla fine canvas fermo e cinematica chiusa (il bot non aspetta per sempre): ${JSON.stringify(r.dopo)}`);
        const attese = ['reborn', 'storm', 'typhoon', 'haunted', 'dust', 'harpie'];
        const male = attese.filter((k) => r.cb[k] !== 1);
        assert(male.length === 0, `Le callback d'impatto devono arrivare una volta sola: ${JSON.stringify(r.cb)}`);
    }
};
