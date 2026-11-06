// Un attacco alla volta: finche' una battaglia non e' finita nessun altro attacco parte.
// =====================================================================================
// Segnalato dall'utente: "se ho piu' mostri e sono molto veloce posso farli attaccare quasi su un colpo". Prima
// `hasAttacked` si segnava solo a fine battaglia, quindi un secondo attacco (anche dello STESSO mostro) poteva partire mentre
// il primo era ancora in volo e le due battaglie si sovrapponevano. Ora resolveAttack prende gameState.attaccoInCorso e lo
// rilascia in `done`; un attacco rifiutato non conta come fatto e chi lo ha chiesto viene comunque avvisato.
module.exports = {
    name: 'Un attacco alla volta: un secondo attacco durante una battaglia in corso viene rifiutato',
    async run(t) {
        await t.evaluate(() => {
            window.__fine = [];
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            gameState.botSTField = [null, null, null, null, null];
            gameState.playerSTField = [null, null, null, null, null];
            gameState.botHand = [];
            gameState.botMonsterField = [null, null, null, null, null];
            gameState.phase = 'battle';
            const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck);
            const mostro = (uid, atk) => ({ card: { ...base, attack: atk, defense: 0, uid: uid }, position: 'attack', isFaceDown: false, hasAttacked: false });
            gameState.playerMonsterField = [mostro('veloce-a', 1000), mostro('veloce-b', 1500), null, null, null];
            window.__lp0 = gameState.botLP;
            // Tre attacchi quasi nello stesso istante: il primo parte, il secondo (altro mostro) e il terzo (STESSO mostro) no.
            resolveAttack('player', 0, -1, () => window.__fine.push('a'));
            window.__durante = { bloccoPreso: !!gameState.attaccoInCorso, inCorso: attaccoInCorso() };
            resolveAttack('player', 1, -1, () => window.__fine.push('b'));
            resolveAttack('player', 0, -1, () => window.__fine.push('a2'));
            window.__subito = { fine: window.__fine.slice(), hasAttackedB: gameState.playerMonsterField[1].hasAttacked };
            // Dall'interfaccia: executeAttack lo dice nel registro e non tocca nulla.
            window.__logPrima = (gameState.log || []).length;
            executeAttack(1, -1);
        });
        const subito = await t.evaluate(() => ({ durante: window.__durante, subito: window.__subito }));
        t.assert(subito.durante.bloccoPreso && subito.durante.inCorso, 'durante la battaglia il blocco e\' preso');
        t.assert(JSON.stringify(subito.subito.fine) === JSON.stringify(['b', 'a2']), `gli attacchi rifiutati avvisano comunque chi li aspettava: ${JSON.stringify(subito.subito.fine)}`);
        t.assert(subito.subito.hasAttackedB === false, 'un attacco rifiutato non segna il mostro come "ha gia\' attaccato"');

        await t.page.waitForFunction(() => window.__fine.indexOf('a') >= 0, null, { timeout: 10000 });
        const dopo = await t.evaluate(() => ({
            lp: window.__lp0 - gameState.botLP,
            blocco: gameState.attaccoInCorso || null,
            hasAttackedA: gameState.playerMonsterField[0] && gameState.playerMonsterField[0].hasAttacked,
            hasAttackedB: gameState.playerMonsterField[1] && gameState.playerMonsterField[1].hasAttacked
        }));
        t.assert(dopo.lp === 1000, `ha colpito UN solo mostro (1000 di danno, non 2500 ne' 3500): ${dopo.lp}`);
        t.assert(dopo.blocco === null, 'finita la battaglia il blocco e\' rilasciato');
        t.assert(dopo.hasAttackedA === true && dopo.hasAttackedB === false, 'solo il primo ha attaccato, il secondo puo\' farlo ora');

        // Rilasciato il blocco, il secondo mostro attacca normalmente.
        await t.evaluate(() => { window.__fine2 = false; resolveAttack('player', 1, -1, () => { window.__fine2 = true; }); });
        await t.page.waitForFunction(() => window.__fine2 === true, null, { timeout: 10000 });
        const finale = await t.evaluate(() => window.__lp0 - gameState.botLP);
        t.assert(finale === 2500, `poi il secondo attacca: 1000 + 1500 = 2500, trovato ${finale}`);

        // Rete di sicurezza: un blocco di un altro turno non conta.
        const vecchio = await t.evaluate(() => {
            gameState.attaccoInCorso = { turno: gameState.turn - 1, dal: Date.now() };
            const r = attaccoInCorso();
            return { r: r, azzerato: gameState.attaccoInCorso === null };
        });
        t.assert(vecchio.r === false && vecchio.azzerato, 'un blocco di un turno passato non resta per sempre');
    }
};
