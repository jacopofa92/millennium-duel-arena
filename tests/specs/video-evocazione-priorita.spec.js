module.exports = {
    name: 'Video evocazione: priorità assoluta e duello sospeso fino alla fine',
    async run(t) {
        const result = await t.evaluate(async () => {
            const originalGetVideoFor = VisualEffects.getVideoFor;
            VisualEffects.getVideoFor = () => Promise.resolve('about:blank');
            const anchor = document.createElement('div');
            anchor.style.cssText = 'position:fixed;left:100px;top:100px;width:80px;height:110px';
            document.body.appendChild(anchor);
            FX.playMonsterSummonEffect({ id: 1, uid: 'video-lock-test', name: 'Test', level: 4 }, anchor);
            await Promise.resolve();
            await Promise.resolve();
            const backdrop = document.querySelector('.fx-video-backdrop');
            const during = {
                exists: !!backdrop,
                modal: backdrop && backdrop.getAttribute('aria-modal') === 'true',
                lock: window.DUEL_CINEMATIC_LOCK === true,
                cinematic: FX.isCinematicPlaying(),
                blocked: isBlockingModalOpen(),
                z: backdrop ? Number(getComputedStyle(backdrop).zIndex) : 0,
                ambienteSospeso: !!(window.FieldAmbience && FieldAmbience.sospeso()),
                ologrammiSospesi: !!(window.MonsterHolograms && MonsterHolograms.isSospeso())
            };
            if (backdrop) {
                const player = backdrop.querySelector('video');
                during.backdropFilter = getComputedStyle(backdrop).filter;
                during.playerFilter = getComputedStyle(player).filter;
                during.playerMask = getComputedStyle(player).maskImage;
                during.preload = player.preload;
            }
            if (backdrop) backdrop.querySelector('video').dispatchEvent(new Event('ended'));
            // Dopo il filmato la scena prosegue con l'impatto (onda e scintille, 900 ms di blocco): il duello
            // riparte solo a impatto finito, non nell'istante in cui il video si chiude.
            await new Promise((resolve) => setTimeout(resolve, 1300));
            const after = {
                exists: !!document.querySelector('.fx-video-backdrop'),
                lock: window.DUEL_CINEMATIC_LOCK === true,
                cinematic: FX.isCinematicPlaying(),
                ambienteSospeso: !!(window.FieldAmbience && FieldAmbience.sospeso()),
                ologrammiSospesi: !!(window.MonsterHolograms && MonsterHolograms.isSospeso())
            };
            VisualEffects.getVideoFor = originalGetVideoFor;
            anchor.remove();
            return { during, after };
        });

        t.assert(result.during.exists && result.during.modal && result.during.lock
            && result.during.cinematic && result.during.blocked && result.during.z > 1000000
            && result.during.ambienteSospeso && result.during.ologrammiSospesi
            && result.during.backdropFilter === 'none' && result.during.playerFilter === 'none'
            && (result.during.playerMask === 'none' || !result.during.playerMask)
            && result.during.preload === 'auto',
            `Il video non domina e sospende tutta la UI: ${JSON.stringify(result)}`);
        t.assert(!result.after.exists && !result.after.lock && !result.after.cinematic
            && !result.after.ambienteSospeso && !result.after.ologrammiSospesi,
            `Il gioco non riprende correttamente dopo il video: ${JSON.stringify(result)}`);
    }
};
