// 1) Le cinematiche di Evocazione partono UNA ALLA VOLTA (FX.playMonsterSummonEffect le mette in coda): prima due
//    mostri evocati insieme facevano partire i filmati nello stesso istante, sovrapposti.
// 2) Una scelta NON annullabile fra carte (es. "scegli la carta da scartare come costo" de La Melodia del Drago che
//    si Risveglia) non mostra il pulsante Chiudi e un tocco fuori non chiude ne' riapre il riquadro.
// 3) Vera Luce (1263) si puo' attivare da coperta anche senza Drago in mano/Cimitero: la protezione e' il suo effetto continuo.
module.exports = {
    name: 'Evocazioni in coda, scelte obbligatorie senza Chiudi, Vera Luce attivabile',
    async run(t) {
        // --- 1) coda delle cinematiche
        const coda = await t.evaluate(async () => {
            let massimo = 0;
            const mostro = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            gameState.playerMonsterField = [0, 1].map((i) => ({ card: { ...mostro, uid: 'cm' + i }, position: 'attack', isFaceDown: false }));
            gameState.playerMonsterField.push(null, null, null);
            renderFields();
            window.VisualEffects.getVideoFor = () => Promise.resolve('video/finto.mp4');
            window.SaveManager.setSetting('summonVideos', true);
            // Se le richieste fossero parallele, i due filmati finti sarebbero a schermo insieme.
            const osserva = new MutationObserver(() => {
                const n = document.querySelectorAll('.fx-video-backdrop').length;
                massimo = Math.max(massimo, n);
            });
            osserva.observe(document.body, { childList: true });
            FX.playMonsterSummonEffect(gameState.playerMonsterField[0].card);
            FX.playMonsterSummonEffect(gameState.playerMonsterField[1].card);
            const subito = FX.isCinematicPlaying();
            await new Promise((s) => setTimeout(s, 600));
            const apertiDopo600 = document.querySelectorAll('.fx-video-backdrop').length;
            document.querySelectorAll('.fx-video-backdrop video').forEach((v) => v.dispatchEvent(new Event('ended')));
            await new Promise((s) => setTimeout(s, 600));
            document.querySelectorAll('.fx-video-backdrop video').forEach((v) => v.dispatchEvent(new Event('ended')));
            await new Promise((s) => setTimeout(s, 600));
            osserva.disconnect();
            return { massimo, subito, finale: FX.isCinematicPlaying() };
        });
        t.assert(coda.subito === true, 'La cinematica risulta in corso fin dalla richiesta: ' + JSON.stringify(coda));
        t.assert(coda.massimo <= 1, 'Mai due filmati di Evocazione insieme: ' + JSON.stringify(coda));

        // --- 2) scelta obbligatoria senza Chiudi
        const picker = await t.evaluate(async () => {
            const carte = cardDatabase.filter((c) => c.type === 'monster').slice(0, 3).map((c, i) => ({ ...c, uid: 'pk' + i }));
            let risposta = null;
            Decisioni.chiedi({ chi: 'player', candidati: carte, titolo: 'Prova', testo: 'Scegli', automaticaSeUnica: false }, (c) => { risposta = c; });
            await new Promise((s) => setTimeout(s, 150));
            const modal = document.getElementById('cardListPickerModal');
            const chiudi = document.getElementById('cardListPickerCloseBtn');
            const aperto = modal.classList.contains('open');
            const chiudiVisibile = getComputedStyle(chiudi).display !== 'none';
            let rimossa = false;
            const oss = new MutationObserver(() => { if (!modal.classList.contains('open')) rimossa = true; });
            oss.observe(modal, { attributes: true, attributeFilter: ['class'] });
            modal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await new Promise((s) => setTimeout(s, 150));
            oss.disconnect();
            const ancoraAperto = modal.classList.contains('open');
            modal.querySelector('.card-list-item').click();
            await new Promise((s) => setTimeout(s, 100));
            return { aperto, chiudiVisibile, rimossa, ancoraAperto, risposta: risposta && risposta.uid };
        });
        t.assert(picker.aperto && !picker.chiudiVisibile, 'Scelta obbligatoria: riquadro aperto e senza Chiudi: ' + JSON.stringify(picker));
        t.assert(!picker.rimossa && picker.ancoraAperto, 'Un tocco fuori non chiude ne\' fa lampeggiare il riquadro: ' + JSON.stringify(picker));
        t.assert(picker.risposta === 'pk0', 'La scelta funziona ancora: ' + JSON.stringify(picker));

        // --- 3) Vera Luce attivabile da coperta anche senza Draghi
        const luce = await t.evaluate(() => {
            const c = cardDatabase.find((x) => x.id === 1263);
            gameState.playerHand = [];
            gameState.playerGraveyard = [];
            gameState.playerSTField = [{ card: { ...c, uid: 'vl' }, isFaceDown: true, setOnTurn: gameState.turn - 1 }, null, null, null, null];
            return DuelEngine.canActivate('player', 'st', 0);
        });
        t.assert(luce === true, 'Vera Luce coperta si puo\' attivare anche senza Drago da evocare');
    }
};
