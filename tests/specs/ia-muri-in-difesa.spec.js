// Segnalato dall'utente: i Fratelli Paradosso Evocavano Mura Labirintiche (0 ATK / 3000 DEF, Livello 5) in ATTACCO.
// Un'Evocazione Tributo esce SEMPRE scoperta in Attacco (eseguiEvocazioneNormale: non si puo' Settare dopo un Tributo), quindi un
// muro da Tributo non puo' stare in Difesa il turno in cui arriva: l'IA non deve pagare Tributi per averlo, e se un muro e' gia'
// in campo in Attacco deve passare in Difesa al turno dopo (e non attaccare con 0 ATK).
module.exports = {
    name: 'IA: i muri non si Evocano con un Tributo (finirebbero in Attacco) e, se in Attacco, passano in Difesa',
    async run(t) {
        const r = await t.evaluate(() => {
            const carta = (id) => JSON.parse(JSON.stringify(cardDatabase.find((c) => c.id === id)));
            const slot = (id, extra) => Object.assign({ card: Object.assign(carta(id), { uid: 'm-' + id + Math.random() }), position: 'attack', isFaceDown: false, canChangePosition: true, hasAttacked: false }, extra || {});
            const out = {};
            gameState.currentPlayer = 'bot';

            // 1) La stima del Tributo: un muro senza ATK non vale nessun sacrificio; un muro con un po' di ATK vale solo come attaccante.
            const mura = carta(337);          // Mura Labirintiche 0/3000 L5
            const guardiano = carta(375);     // Guardiano Metallico 1150/2150 L5
            out.muraTributo0 = AI_SHARED.isTributeSummonWorthwhile(mura, 0, gameState, 'bot');
            out.muraTributo500 = AI_SHARED.isTributeSummonWorthwhile(mura, 500, gameState, 'bot');
            out.guardianoUpgrade = AI_SHARED.isTributeSummonWorthwhile(guardiano, 500, gameState, 'bot');
            out.guardianoDowngrade = AI_SHARED.isTributeSummonWorthwhile(guardiano, 1800, gameState, 'bot');

            // 2) chooseSummon: con un mostro da sacrificare e Mura in mano, il bot non la sceglie.
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.botMonsterField[0] = slot(1);   // un mostro qualunque da Tributare
            gameState.botHand = [Object.assign(carta(337), { uid: 'h-337' })];
            gameState.hasNormalSummoned = false;
            if (gameState.normalSummonsThisTurn !== undefined) gameState.normalSummonsThisTurn = { player: 0, bot: 0 };
            const scelta = AI_MEDIUM.chooseSummon(gameState, 'bot');
            out.sceltaMura = scelta ? scelta.card.name : null;

            // 3) Cambi di Posizione: un muro in Attacco passa in Difesa, ma con il campo avversario vuoto un mostro 1200/2200 attacca.
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.botMonsterField = [slot(337), null, null, null, null];
            out.zeroAtkConCampoVuoto = AI_SHARED.choosePositionChanges(gameState, 'bot', true).length === 1;
            gameState.botMonsterField = [slot(375), null, null, null, null];
            out.muroConAtkConCampoVuoto = AI_SHARED.choosePositionChanges(gameState, 'bot', true).length;   // attacca diretto: nessun cambio
            gameState.playerMonsterField = [slot(1, { position: 'attack' }), null, null, null, null];       // Drago Bianco: non lo batte
            out.muroConMinaccia = AI_SHARED.choosePositionChanges(gameState, 'bot', true).length === 1;
            return out;
        });
        t.assert(r.muraTributo0 === false && r.muraTributo500 === false, 'Un muro da 0 ATK non vale nessun Tributo: ' + JSON.stringify(r));
        t.assert(r.guardianoUpgrade === true, 'Un 1150/2150 che sostituisce un 500 ATK e\' un upgrade offensivo: ' + JSON.stringify(r));
        t.assert(r.guardianoDowngrade === false, 'Un 1150/2150 non vale un sacrificio da 1800 ATK: la DEF non conta, e\' sempre in Attacco: ' + JSON.stringify(r));
        t.assert(r.sceltaMura !== 'Mura Labirintiche', 'chooseSummon non sceglie un muro da Tributo: ' + JSON.stringify(r));
        t.assert(r.zeroAtkConCampoVuoto, 'Un mostro 0 ATK in Attacco passa in Difesa anche senza minacce: ' + JSON.stringify(r));
        t.assert(r.muroConAtkConCampoVuoto === 0, 'Con il campo avversario vuoto un mostro con ATK attacca diretto, non cambia Posizione: ' + JSON.stringify(r));
        t.assert(r.muroConMinaccia, 'Davanti a un mostro che non batte un muro con ATK passa in Difesa: ' + JSON.stringify(r));
    }
};
