module.exports = {
    name: 'Fusione: i tre materiali convergono in 3D prima della cinematica del mostro',
    freeze: false,
    async run(t) {
        const start = await t.evaluate(() => {
            const blueEyesTemplate = cardDatabase.find((c) => c.id === 1);
            const ultimateTemplate = cardDatabase.find((c) => c.id === 29);
            const materials = [0, 1, 2].map((i) => ({ ...blueEyesTemplate, uid: 'fusion-blue-eyes-' + i }));
            const ultimate = { ...ultimateTemplate, uid: 'fusion-ultimate' };
            gameState.playerHand = materials;
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.playerExtraDeck = [ultimate];
            gameState.playerGraveyard = [];
            const option = DuelEngine.getFusableExtraDeckMonsters('player').find((v) => v.card.id === 29);
            window.__fusionSummonFxAt = null;
            window.__fusionSoundCalls = 0;
            const originalFusionSound = SFX.fusion;
            SFX.fusion = function () { window.__fusionSoundCalls++; };
            const original = FX.playMonsterSummonEffect;
            FX.playMonsterSummonEffect = function () {
                window.__fusionSummonFxAt = performance.now();
                return original.apply(this, arguments);
            };
            window.__fusionStartedAt = performance.now();
            const ok = DuelEngine.actions.fusionSummon('player', option.extraDeckIndex, option.materialLocations);
            return {
                ok,
                materialsVisual: document.querySelectorAll('.fx-fusion-material').length,
                scene: !!document.querySelector('.fx-fusion-scene'),
                cinematic: FX.isCinematicPlaying(),
                fusionSoundCalls: window.__fusionSoundCalls,
                summonAlreadyPlayed: window.__fusionSummonFxAt !== null,
                graveyard: gameState.playerGraveyard.length,
                fusionOnField: gameState.playerMonsterField.some((s) => s && s.card.id === 29)
            };
        });

        t.assert(start.ok && start.materialsVisual === 3 && start.scene && start.cinematic,
            'I tre Draghi Bianchi devono apparire nella cinematica 3D e bloccare l’avanzamento');
        t.assert(start.graveyard === 3 && !start.fusionOnField,
            'I materiali devono essere consumati, ma il Mostro Fusione non deve essere già sul campo durante il vortice');
        t.assert(!start.summonAlreadyPlayed,
            'La cinematica del Drago Bianco Definitivo non deve partire insieme ai materiali');
        t.assert(start.fusionSoundCalls === 1,
            'La convergenza dei materiali deve avviare una sola volta il suono Fusion');

        await new Promise((resolve) => setTimeout(resolve, 3300));
        const end = await t.evaluate(() => ({
            scene: !!document.querySelector('.fx-fusion-scene'),
            summonDelay: window.__fusionSummonFxAt === null ? -1 : window.__fusionSummonFxAt - window.__fusionStartedAt,
            fusionOnField: gameState.playerMonsterField.some((s) => s && s.card.id === 29)
        }));
        t.assert(!end.scene && end.fusionOnField && end.summonDelay >= 2850,
            'Il mostro evocato deve iniziare la propria animazione solo dopo il collasso dei materiali');

        const rivelazioneFusioneGiaMostrata = await t.evaluate(async () => {
            const originale = FX.rivelazioneFusioneFatta;
            const fxMateriali = FX.playFusionMaterialEffect;
            const MagoNero = cardDatabase.find((c) => c.id === 2);
            const RagazzaMagaNera = cardDatabase.find((c) => c.id === 188);
            const MaghiNeri = { ...cardDatabase.find((c) => c.id === 1260), uid: 'fusion-maghi-neri' };
            gameState.playerHand = [
                { ...MagoNero, uid: 'fusion-material-mago-nero' },
                { ...RagazzaMagaNera, uid: 'fusion-material-ragazza-maga-nera' }
            ];
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.playerExtraDeck = [MaghiNeri];
            gameState.playerGraveyard = [];
            gameState.botSTField = [null, null, null, null, null];
            // Simula la scena WebGL: la Fusion ha già mostrato il mostro e
            // quindi il motore salta il reveal standard, ma deve comunque
            // togliere la classe che lo teneva nascosto nello slot.
            FX.rivelazioneFusioneFatta = () => true;
            FX.playFusionMaterialEffect = (_materiali, _fusione, _owner, onDone) => { onDone(); return 0; };
            try {
                const option = DuelEngine.getFusableExtraDeckMonsters('player').find((v) => v.card.id === 1260);
                const ok = option && DuelEngine.actions.fusionSummon('player', option.extraDeckIndex, option.materialLocations);
                await new Promise((resolve) => setTimeout(resolve, 120));
                const slot = gameState.playerMonsterField.find((s) => s && s.card.uid === MaghiNeri.uid);
                const element = window.findFieldCardElementByUid(MaghiNeri.uid);
                return {
                    ok: !!ok,
                    sulCampo: !!slot,
                    nascosta: !!(element && element.classList.contains('summon-cinematic-hidden')),
                    revealInAttesa: FX.evocazioneInAttesa(MaghiNeri.uid)
                };
            } finally {
                FX.rivelazioneFusioneFatta = originale;
                FX.playFusionMaterialEffect = fxMateriali;
            }
        });
        t.assert(rivelazioneFusioneGiaMostrata.ok && rivelazioneFusioneGiaMostrata.sulCampo
            && !rivelazioneFusioneGiaMostrata.nascosta && !rivelazioneFusioneGiaMostrata.revealInAttesa,
            `La scena WebGL di I Maghi Neri deve lasciare la carta visibile nello slot: ${JSON.stringify(rivelazioneFusioneGiaMostrata)}`);
    }
};
