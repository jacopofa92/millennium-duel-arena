// Riscontri visivi del duello (js/ui/duel-feedback.js) e due difetti degli
// ologrammi (js/ui/monster-hologram.js), su un duello vero.
//
// Riscontri: si cambia lo stato come lo cambierebbe una carta qualunque e
// si controlla che il riscontro compaia — è il punto del modulo: nasce dal
// CONFRONTO fra due ridisegni, non da un aggancio carta per carta.
//
// Ologrammi (segnalazione dell'utente, "bug con gli olografici quando si
// scopre una carta"), misurati prima di correggere:
//   - scoprendo un mostro l'ologramma nasceva subito (30 ms), sopra una
//     carta ancora di dorso a metà giro;
//   - un mostro scoperto in Difesa aveva la proiezione bassa e larga
//     (185×107 su una carta 116×79), calcolata sul riquadro ruotato.
const { freezeNaturalGameLoop } = require('../helpers/harness');

module.exports = {
    name: 'Riscontri del duello (ATK/DEF, bando, annullamento, Posizione, Token, LP critici) e ologrammi delle carte scoperte',
    async run(t) {
        await freezeNaturalGameLoop(t.page);
        const page = t.page;

        await t.evaluate(() => {
            const mostro = (id, uid) => Object.assign({}, cardDatabase.find((c) => c.id === id && c.type === 'monster')
                || cardDatabase.find((c) => c.type === 'monster'), { uid });
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.playerMonsterField[0] = { card: mostro(4, 'rd-a'), position: 'attack', isFaceDown: false, canChangePosition: true, hasAttacked: false, summonedOnTurn: 0 };
            gameState.playerMonsterField[2] = { card: mostro(1, 'rd-b'), position: 'attack', isFaceDown: false, canChangePosition: true, hasAttacked: false, summonedOnTurn: 0 };
            gameState.botMonsterField[1] = { card: mostro(2, 'rd-c'), position: 'attack', isFaceDown: false, canChangePosition: true, hasAttacked: false, summonedOnTurn: 0 };
            gameState.phase = 'main1'; gameState.currentPlayer = 'player';
            gameState.playerLP = 8000; gameState.botLP = 8000;
            updateUI();
        });
        await page.waitForTimeout(300);

        // --- 1. ATK/DEF ----------------------------------------------------
        const stat = await t.evaluate(() => {
            gameState.playerMonsterField[0].card.attack += 500;
            gameState.botMonsterField[1].card.defense -= 700;
            updateUI();
            return [...document.querySelectorAll('#duelFeedbackLayer .df-variazione-riga')].map((e) => e.textContent);
        });
        t.assert(stat.includes('+500 ATK') && stat.includes('−700 DEF'), 'ATK/DEF che cambiano mostrano il numero fluttuante: ' + JSON.stringify(stat));
        const nessunaVariazione = await t.evaluate(() => {
            document.querySelectorAll('#duelFeedbackLayer .df-variazione').forEach((e) => e.remove());
            updateUI();
            return document.querySelectorAll('#duelFeedbackLayer .df-variazione').length;
        });
        t.assert(nessunaVariazione === 0, 'Un ridisegno senza cambiamenti non deve mostrare nulla');

        // --- 4. Cambio di Posizione ----------------------------------------
        const posizione = await t.evaluate(() => {
            changeMonsterPosition(2);
            const el = findFieldCardElementByUid('rd-b');
            return {
                difesa: gameState.playerMonsterField[2].position,
                ruota: !!el && el.getAnimations().some((a) => a.effect && a.effect.getKeyframes().some((k) => k.rotate)),
                soffio: document.querySelectorAll('#duelFeedbackLayer .df-soffio').length
            };
        });
        t.assert(posizione.difesa === 'defense' && posizione.ruota && posizione.soffio > 0,
            'Il cambio di Posizione fa ruotare la carta: ' + JSON.stringify(posizione));

        // --- 2. Bando ------------------------------------------------------
        const bando = await t.evaluate(() => {
            const slot = gameState.botMonsterField[1];
            gameState.botMonsterField[1] = null;
            Tavolo.banditi('bot').push(slot.card);
            updateUI();
            return document.querySelectorAll('#duelFeedbackLayer .df-varco').length;
        });
        t.assert(bando > 0, 'Una carta bandita dal Terreno apre il varco');
        // Una carta che va al CIMITERO non è un bando.
        const cimitero = await t.evaluate(() => {
            document.querySelectorAll('#duelFeedbackLayer .df-varco').forEach((e) => e.remove());
            const slot = gameState.playerMonsterField[0];
            gameState.playerMonsterField[0] = null;
            Tavolo.cimitero ? Tavolo.cimitero('player').push(slot.card) : gameState.playerGraveyard.push(slot.card);
            updateUI();
            return document.querySelectorAll('#duelFeedbackLayer .df-varco').length;
        });
        t.assert(cimitero === 0, 'Una carta mandata al Cimitero non deve aprire il varco del bando');

        // --- 5. Token ------------------------------------------------------
        const token = await t.evaluate(() => {
            DuelEngine.actions.createTokens('player', 1, { name: 'Token di prova', attack: 0, defense: 0, level: 1 });
            updateUI();
            return document.querySelectorAll('#duelFeedbackLayer .df-fumo').length;
        });
        t.assert(token > 0, 'Un Token che nasce fa il suo sbuffo di fumo');

        // --- 3. Annullamento -----------------------------------------------
        const negata = await t.evaluate(() => {
            EventiDuello.emetti('attivazione-negata', cardDatabase.find((c) => c.type === 'spell'), 'bot', null, null);
            const centro = document.querySelectorAll('#duelFeedbackLayer .df-negata--centro').length;
            EventiDuello.emetti('attivazione-negata', gameState.playerMonsterField[2].card, 'player', 'monster', 2);
            const sullaCarta = [...document.querySelectorAll('#duelFeedbackLayer .df-negata')].filter((e) => !e.classList.contains('df-negata--centro')).length;
            return { centro, sullaCarta };
        });
        t.assert(negata.centro === 1 && negata.sullaCarta === 1,
            'Un\'attivazione annullata mette il sigillo: al centro se la carta non è in campo, su di lei se c\'è: ' + JSON.stringify(negata));

        // --- 6. Life Point critici ------------------------------------------
        const lp = await t.evaluate(() => {
            gameState.playerLP = 700; gameState.botLP = 3000;
            updateUI();
            const critici = {
                io: document.getElementById('playerInfo').classList.contains('df-lp-critici'),
                lui: document.getElementById('botInfo').classList.contains('df-lp-critici'),
                vignetta: !!document.getElementById('dfVignetta')
            };
            gameState.playerLP = 8000; gameState.botLP = 8000;
            updateUI();
            critici.dopo = !!document.getElementById('dfVignetta') || document.getElementById('playerInfo').classList.contains('df-lp-critici');
            return critici;
        });
        t.assert(lp.io && !lp.lui && lp.vignetta && !lp.dopo, 'Life Point critici: riquadro rosso e vignetta solo sotto i 1000, e spariscono dopo: ' + JSON.stringify(lp));

        // --- Ologrammi: mostro che si scopre ---------------------------------
        await t.evaluate(() => {
            if (window.HologramSetting) HologramSetting.set(true);
            const base = cardDatabase.find((c) => c.id === 1 && c.type === 'monster');
            gameState.playerMonsterField[4] = { card: Object.assign({}, base, { uid: 'rd-flip' }), position: 'defense', isFaceDown: true, canChangePosition: true, hasAttacked: false, summonedOnTurn: 0 };
            updateUI();
        });
        // Il cambio di Posizione e' una mossa della persona: con un'animazione in corso (Comandi.esegui) verrebbe scartato e
        // l'ologramma non nascerebbe mai. Si aspetta lo sblocco, non un tempo fisso.
        await page.waitForFunction(() => !EventiDuello.chiedi('azioni-bloccate-da-animazione', false), null, { timeout: 30000 });
        await page.waitForTimeout(200);
        const subito = await t.evaluate(() => {
            changeMonsterPosition(4);
            return !!document.querySelector('#monsterHologramLayer .mh-item[data-uid="rd-flip"]');
        });
        await page.waitForTimeout(120);
        const aMetaGiro = await t.evaluate(() => !!document.querySelector('#monsterHologramLayer .mh-item[data-uid="rd-flip"]'));
        await page.waitForFunction(() => !!document.querySelector('#monsterHologramLayer .mh-item[data-uid="rd-flip"]'), null, { timeout: 3000 }).catch(() => {});
        const aGiroFinito = await t.evaluate(() => !!document.querySelector('#monsterHologramLayer .mh-item[data-uid="rd-flip"]'));
        t.assert(!subito && !aMetaGiro && aGiroFinito,
            'L\'ologramma di un mostro che si scopre nasce a giro finito, non prima: ' + JSON.stringify({ subito, aMetaGiro, aGiroFinito }));

        // --- Ologrammi: mostro scoperto in Difesa ----------------------------
        const forma = await t.evaluate(() => {
            const base = cardDatabase.find((c) => c.id === 1 && c.type === 'monster');
            gameState.playerMonsterField[3] = { card: Object.assign({}, base, { uid: 'rd-dif' }), position: 'defense', isFaceDown: false, canChangePosition: true, hasAttacked: false, summonedOnTurn: 0 };
            updateUI();
            const olo = document.querySelector('#monsterHologramLayer .mh-item[data-uid="rd-dif"]');
            const altro = document.querySelector('#monsterHologramLayer .mh-item[data-uid="rd-flip"]');
            const r = (el) => el ? { w: el.offsetWidth, h: el.offsetHeight } : null;
            return { difesa: r(olo), attacco: r(altro) };
        });
        t.assert(forma.difesa && forma.difesa.h > forma.difesa.w
            && forma.attacco && Math.abs(forma.difesa.w - forma.attacco.w) <= 2 && Math.abs(forma.difesa.h - forma.attacco.h) <= 2,
            'L\'ologramma di un mostro in Difesa ha la stessa forma di uno in Attacco: ' + JSON.stringify(forma));
    }
};
