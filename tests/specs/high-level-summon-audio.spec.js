module.exports = {
    name: 'Evocazioni Livello 7+: evocation.mp3 solo senza video dedicato',
    async run(t) {
        const result = await t.evaluate(async () => {
            const card = { ...cardDatabase.find((c) => c.id === 1), uid: 'evocation-audio-test' };
            gameState.playerMonsterField = [{ card, position: 'attack', isFaceDown: false }, null, null, null, null];
            updateUI();
            const cardEl = findFieldCardElementByUid(card.uid);
            const originalLookup = VisualEffects.getVideoFor;
            const originalEvocation = SFX.evocation;
            let calls = 0;
            SFX.evocation = () => { calls++; };

            VisualEffects.getVideoFor = () => Promise.resolve(null);
            FX.playMonsterSummonEffect(card, cardEl);
            await new Promise((resolve) => setTimeout(resolve, 30));
            const withoutVideo = calls;
            FX.azzeraCodaEvocazioni();

            calls = 0;
            VisualEffects.getVideoFor = () => Promise.resolve('video/evocazioni/test-dedicato.mp4');
            FX.playMonsterSummonEffect(card, cardEl);
            await new Promise((resolve) => setTimeout(resolve, 30));
            const withVideo = calls;
            // Le cinematiche di Evocazione vanno in coda una alla volta: ogni passo del test parte da coda vuota,
            // o la richiesta successiva aspetterebbe dietro la scena precedente (convergenza o filmato finto).
            FX.azzeraCodaEvocazioni();
            document.querySelectorAll('.fx-video-backdrop').forEach((el) => el.remove());

            calls = 0;
            let lookupDisattivato = 0;
            SaveManager.setSetting('summonVideos', false);
            VisualEffects.getVideoFor = () => { lookupDisattivato++; return Promise.resolve('video/evocazioni/test-dedicato.mp4'); };
            FX.playMonsterSummonEffect(card, cardEl);
            await new Promise((resolve) => setTimeout(resolve, 30));
            const disabledVideo = calls;
            SaveManager.setSetting('summonVideos', true);

            VisualEffects.getVideoFor = originalLookup;
            SFX.evocation = originalEvocation;
            document.querySelectorAll('.video-overlay, .fx-video-overlay').forEach((el) => el.remove());
            return { withoutVideo, withVideo, disabledVideo, lookupDisattivato };
        });

        t.assert(result.withoutVideo === 1,
            'Un Livello 7+ senza video deve riprodurre una volta il suono evocation');
        t.assert(result.withVideo === 0,
            'Un Livello 7+ con video dedicato non deve sovrapporre evocation.mp3 al filmato');
        t.assert(result.disabledVideo === 1 && result.lookupDisattivato === 0,
            'Con Filmati di evocazione spenti deve saltare il lookup video e usare subito l\'effetto normale');
    }
};
