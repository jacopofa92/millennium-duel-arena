// Alone attorno alle carte giocabili (js/ui/evidenzia-giocabili.js): bianco = mostro Evocabile, verde = effetto attivabile,
// arancio = mostro che puo' attaccare; caselle libere che respirano; spento dall'impostazione; niente nel turno dell'avversario.
module.exports = {
    name: 'Alone delle carte giocabili: bianco, verde, attacco, caselle libere e impostazione',
    async run(t) {
        await t.evaluate(() => {
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            const mostro = (livello, atk) => cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && c.level === livello && c.attack >= atk && c.id > 0);
            window.__basso = { ...mostro(4, 1000), uid: 'g-basso' };
            window.__alto = { ...mostro(7, 2000), uid: 'g-alto' };
            window.__magia = { ...cardDatabase.find((c) => c.id === 36), uid: 'g-magia' };   // Vaso dell'Avidita': sempre attivabile con il Mazzo pieno
            window.__trappola = { ...cardDatabase.find((c) => c.type === 'trap'), uid: 'g-trappola' };
            gameState.botSTField = [null, null, null, null, null];
            gameState.playerSTField = [null, null, null, null, null];
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.hasNormalSummoned = false;
            gameState.currentPlayer = 'player';
            gameState.phase = 'main1';
            gameState.playerHand = [window.__basso, window.__alto, window.__magia, window.__trappola];
            if (typeof updateUI === 'function') updateUI();
        });
        const lettura = () => t.evaluate(() => ({
            tipi: Object.fromEntries([...document.querySelectorAll('#playerHand .card')].map((e) => [e.dataset.uid, (e.className.match(/glow-(bianco|verde|attacco)/) || [])[1] || null])),
            libere: document.querySelectorAll('.slot-libera').length,
            off: document.documentElement.classList.contains('evidenzia-off')
        }));

        let r = await lettura();
        t.assert(r.tipi['g-basso'] === 'bianco', `il mostro Evocabile ha l'alone bianco: ${JSON.stringify(r.tipi)}`);
        t.assert(r.tipi['g-alto'] === null, 'un Livello 7 senza Tributi non si evidenzia');
        t.assert(r.tipi['g-magia'] === 'verde', `la Magia attivabile ha l'alone verde: ${JSON.stringify(r.tipi)}`);
        t.assert(r.tipi['g-trappola'] === null, 'una Trappola in mano non si evidenzia (va prima Set)');
        t.assert(r.libere === 5, `le 5 caselle Mostro libere si accendono: ${r.libere}`);

        // Con due mostri sul Terreno il Livello 7 diventa Evocabile (Tributo): bianco anche lui.
        await t.evaluate(() => {
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && c.level <= 4);
            gameState.playerMonsterField = [
                { card: { ...base, uid: 'cm1' }, position: 'attack', isFaceDown: false, hasAttacked: false, summonedOnTurn: 0 },
                { card: { ...base, uid: 'cm2' }, position: 'attack', isFaceDown: false, hasAttacked: false, summonedOnTurn: 0 }, null, null, null];
            updateUI();
        });
        r = await lettura();
        t.assert(r.tipi['g-alto'] === 'bianco', `con due mostri da sacrificare il Livello 7 e' Evocabile: ${JSON.stringify(r.tipi)}`);

        // Battle Phase: i mostri in Attacco che non hanno attaccato prendono l'alone arancio; la mano non e' piu' evidenziata.
        await t.evaluate(() => { gameState.phase = 'battle'; updateUI(); });
        const b = await t.evaluate(() => ({
            campo: [...document.querySelectorAll('#playerFieldBoard .card')].map((e) => (e.className.match(/glow-(bianco|verde|attacco)/) || [])[1] || null),
            mano: [...document.querySelectorAll('#playerHand .glow-giocabile')].length
        }));
        t.assert(b.campo.filter((x) => x === 'attacco').length === 2, `in Battle Phase i due mostri che possono attaccare sono arancio: ${JSON.stringify(b.campo)}`);
        t.assert(b.mano === 0, 'in Battle Phase la mano (senza Magie Rapide) non ha alone');
        await t.evaluate(() => { gameState.playerMonsterField[0].hasAttacked = true; updateUI(); });
        const b2 = await t.evaluate(() => [...document.querySelectorAll('#playerFieldBoard .glow-attacco')].length);
        t.assert(b2 === 1, `un mostro che ha gia' attaccato perde l'alone: ${b2}`);

        // Turno dell'avversario: niente.
        await t.evaluate(() => { gameState.phase = 'main1'; gameState.currentPlayer = 'bot'; updateUI(); });
        const turnoBot = await t.evaluate(() => document.querySelectorAll('.glow-giocabile').length + document.querySelectorAll('.slot-libera').length);
        t.assert(turnoBot === 0, `nel turno dell'avversario non si evidenzia nulla: ${turnoBot}`);

        // Impostazione spenta: nessun alone e <html> prende .evidenzia-off.
        await t.evaluate(() => { gameState.currentPlayer = 'player'; SaveManager.setSetting('evidenziaGiocabili', false); updateUI(); });
        const spento = await lettura();
        t.assert(spento.off && Object.values(spento.tipi).every((x) => x === null) && spento.libere === 0, `con l'impostazione spenta niente alone: ${JSON.stringify(spento)}`);
        await t.evaluate(() => { SaveManager.setSetting('evidenziaGiocabili', true); updateUI(); });
        const acceso = await lettura();
        t.assert(!acceso.off && acceso.tipi['g-basso'] === 'bianco', 'riacceso, l\'alone torna');
        const predefinito = await t.evaluate(() => SaveManager.getSetting('evidenziaGiocabili'));
        t.assert(predefinito === true, 'l\'impostazione e\' accesa di default');
    }
};
