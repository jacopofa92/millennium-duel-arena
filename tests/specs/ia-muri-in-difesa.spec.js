// Segnalato dall'utente: i Fratelli Paradosso Evocavano Mura Labirintiche (0 ATK / 3000 DEF, Livello 5) in ATTACCO.
// Regola poi data dall'utente (2026-11-07): dopo un Tributo si puo' Settare (Tribute Set, come nel gioco vero), e l'IA puo'
// sacrificare un mostro piu' forte in attacco per un muro SOLO se il muro ha molta difesa (anche con ATK bassissimo) oppure se e'
// in svantaggio. Il muro va in Difesa (coperto); se finisce comunque in Attacco, passa in Difesa al turno dopo e non attacca mai.
module.exports = {
    name: 'IA: i muri da Tributo si Evocano in Difesa solo se utili, e un muro in Attacco passa in Difesa',
    async run(t) {
        const r = await t.evaluate(() => {
            const carta = (id) => JSON.parse(JSON.stringify(cardDatabase.find((c) => c.id === id)));
            const slot = (id, extra) => Object.assign({ card: Object.assign(carta(id), { uid: 'm-' + id + Math.random() }), position: 'attack', isFaceDown: false, canChangePosition: true, hasAttacked: false }, extra || {});
            const out = {};
            gameState.currentPlayer = 'bot';
            gameState.playerMonsterField = [null, null, null, null, null];
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.playerLP = 8000; gameState.botLP = 8000;

            // 1) Valutazione del Tributo, in vantaggio e a campo vuoto.
            const mura = carta(337);          // Mura Labirintiche 0/3000 L5: molta difesa
            const guardiano = carta(375);     // Guardiano Metallico 1150/2150 L5: DEF non eccezionale
            out.muraMoltaDifesa = AI_SHARED.isTributeSummonWorthwhile(mura, 1800, gameState, 'bot');
            out.guardianoUpgrade = AI_SHARED.isTributeSummonWorthwhile(guardiano, 500, gameState, 'bot');
            out.guardianoInVantaggio = AI_SHARED.isTributeSummonWorthwhile(guardiano, 1800, gameState, 'bot');
            // 2) Stessa carta ma in SVANTAGGIO (meno LP, l'avversario ha un mostro): ora vale.
            gameState.botLP = 3000;
            gameState.playerMonsterField[0] = slot(1);   // Drago Bianco Occhi Blu avversario
            out.guardianoInSvantaggio = AI_SHARED.isTributeSummonWorthwhile(guardiano, 1800, gameState, 'bot');
            // 3) Mai in perdita netta: una carta debole non vale un sacrificio piu' forte di tutte le sue statistiche.
            out.perditaNetta = AI_SHARED.isTributeSummonWorthwhile(carta(54), 3000, gameState, 'bot');   // Muro Illusorio 1000/1850

            // 4) chooseSummon: con un mostro da sacrificare e Mura in mano il bot la sceglie, e in DIFESA.
            gameState.botLP = 8000; gameState.playerMonsterField = [null, null, null, null, null];
            gameState.botMonsterField[0] = slot(4);   // Guardiano Celtico (1400 ATK): un Tributo che il muro "vale"
            gameState.botHand = [Object.assign(carta(337), { uid: 'h-337' })];
            gameState.hasNormalSummoned = false;
            if (gameState.normalSummonsThisTurn !== undefined) gameState.normalSummonsThisTurn = { player: 0, bot: 0 };
            const scelta = AI_MEDIUM.chooseSummon(gameState, 'bot');
            out.sceltaMura = scelta ? { nome: scelta.card.name, posizione: scelta.position, tributi: scelta.tributeIndices.length } : null;

            // 5) Cambi di Posizione: un muro in Attacco passa in Difesa, ma con il campo avversario vuoto un mostro 1200/2200 attacca.
            gameState.botMonsterField = [slot(337), null, null, null, null];
            out.zeroAtkConCampoVuoto = AI_SHARED.choosePositionChanges(gameState, 'bot', true).length === 1;
            gameState.botMonsterField = [slot(375), null, null, null, null];
            out.muroConAtkConCampoVuoto = AI_SHARED.choosePositionChanges(gameState, 'bot', true).length;
            gameState.playerMonsterField = [slot(1), null, null, null, null];
            out.muroConMinaccia = AI_SHARED.choosePositionChanges(gameState, 'bot', true).length === 1;
            return out;
        });
        t.assert(r.muraMoltaDifesa === true, 'Un muro con molta DEF (0/3000) vale un Tributo anche in vantaggio: ' + JSON.stringify(r));
        t.assert(r.guardianoUpgrade === true, 'Un 1150/2150 che sostituisce un 500 ATK e\' un upgrade: ' + JSON.stringify(r));
        t.assert(r.guardianoInVantaggio === false, 'In vantaggio un 1150/2150 non vale un sacrificio da 1800 ATK: ' + JSON.stringify(r));
        t.assert(r.guardianoInSvantaggio === true, 'In svantaggio lo stesso Tributo vale (DEF per stabilizzare): ' + JSON.stringify(r));
        t.assert(r.perditaNetta === false, 'Mai un Tributo in perdita netta: ' + JSON.stringify(r));
        t.assert(r.sceltaMura && r.sceltaMura.nome === 'Mura Labirintiche' && r.sceltaMura.posizione === 'defense' && r.sceltaMura.tributi === 1,
            'chooseSummon sceglie il muro con un Tributo e lo mette in Difesa: ' + JSON.stringify(r.sceltaMura));
        t.assert(r.zeroAtkConCampoVuoto, 'Un mostro 0 ATK in Attacco passa in Difesa anche senza minacce: ' + JSON.stringify(r));
        t.assert(r.muroConAtkConCampoVuoto === 0, 'Con il campo avversario vuoto un mostro con ATK attacca diretto, non cambia Posizione: ' + JSON.stringify(r));
        t.assert(r.muroConMinaccia, 'Davanti a un mostro che non batte un muro con ATK passa in Difesa: ' + JSON.stringify(r));
    }
};
