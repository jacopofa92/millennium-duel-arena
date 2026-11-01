// Segnalato giocando: Pegasus ha evocato Abbandono (Rito dell'Illusione Nera, id 116) con il campo avversario vuoto, quindi non
// ha assorbito nessun mostro ed e' rimasto un 0/0 dopo aver sacrificato dei mostri veri. Il bot lo evoca solo se c'e' un mostro
// avversario SCOPERTO da almeno 1800 ATK da assorbire (aiCanActivate di 116, come la Fusione per Restrizione dai Mille Occhi, id 38).
module.exports = {
    name: 'IA: Abbandono (Rito dell\'Illusione Nera) solo con un mostro avversario degno di essere assorbito',
    async run(t) {
        const r = await t.evaluate(() => {
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            const abb = cardDatabase.find((c) => c.id === 416);
            const rito = cardDatabase.find((c) => c.id === 116);
            const mostro = (atk, uid, faceDown) => ({ card: { ...cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && c.level >= 4), attack: atk, uid }, position: 'attack', isFaceDown: !!faceDown });
            // Il bot ha Abbandono in mano e due mostri da sacrificare (Livello totale >= 4).
            gameState.botHand = [{ ...abb, uid: 'abb' }, { ...rito, uid: 'rito' }];
            gameState.botMonsterField = [mostro(1000, 'b1'), mostro(1000, 'b2'), null, null, null];
            const prova = (campoAvv) => {
                gameState.playerMonsterField = campoAvv;
                return AI_SHARED.attivazioneSensata({ ...rito, uid: 'rito' }, 'bot', 'hand');
            };
            return {
                vuoto: prova([null, null, null, null, null]),
                debole: prova([mostro(900, 'p1'), null, null, null, null]),
                coperto: prova([mostro(3000, 'p2', true), null, null, null, null]),
                forte: prova([mostro(2400, 'p3'), null, null, null, null])
            };
        });
        t.assert(r.vuoto === false, `Campo avversario vuoto: il bot non evoca Abbandono: ${JSON.stringify(r)}`);
        t.assert(r.debole === false, `Solo un mostro da 900 ATK: non vale il costo: ${JSON.stringify(r)}`);
        t.assert(r.coperto === false, `Un mostro coperto non si puo' assorbire: ${JSON.stringify(r)}`);
        t.assert(r.forte === true, `Un mostro scoperto da 2400 ATK: il bot lo evoca: ${JSON.stringify(r)}`);
    }
};
