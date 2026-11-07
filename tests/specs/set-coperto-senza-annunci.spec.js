// Richiesta dell'utente (2026-11-07): un mostro piazzato in Difesa COPERTA (anche con Tributo: Tribute Set) NON deve far partire grido,
// cinematica di Evocazione, video o suono dedicati alla carta, ne' il dialogo: l'avversario non deve sapere cosa e' stato messo
// coperto. Un'Evocazione Tributo in Attacco, invece, li fa partire come sempre.
module.exports = {
    name: 'Set coperto (anche con Tributo): nessun grido, cinematica, suono dedicato o dialogo; in Attacco si',
    async run(t) {
        const r = await t.evaluate(async () => {
            const registro = { grido: 0, fx: 0, suonoCarta: 0, dialogo: 0, place: 0, summon: 0 };
            const orig = {
                attendi: EventiDuello.attendi, fx: FX.playMonsterSummonEffect,
                suono: window.AudioLibrary && AudioLibrary.tryPlayCardSound, dialogo: window.DuelDialogues && DuelDialogues.summon,
                place: SFX.place, summon: SFX.summon
            };
            EventiDuello.attendi = function (nome) { if (nome === 'grido-evocazione') registro.grido++; return orig.attendi.apply(this, arguments); };
            FX.playMonsterSummonEffect = function () { registro.fx++; };
            if (window.AudioLibrary) AudioLibrary.tryPlayCardSound = function () { registro.suonoCarta++; return false; };
            if (window.DuelDialogues) DuelDialogues.summon = function () { registro.dialogo++; };
            SFX.place = function () { registro.place++; };
            SFX.summon = function () { registro.summon++; };
            const azzera = () => Object.keys(registro).forEach((k) => { registro[k] = 0; });
            const out = {};
            const giocaTributo = async (posizione, uid) => {
                ['playerMonsterField', 'botMonsterField'].forEach((k) => { gameState[k] = [null, null, null, null, null]; });
                gameState.hasNormalSummoned = false;
                gameState.currentPlayer = 'player'; gameState.phase = 'main1';
                gameState.playerMonsterField[0] = { card: { ...cardDatabase.find((c) => c.id === 4), uid: 'a-' + uid }, position: 'attack', isFaceDown: false };
                gameState.playerMonsterField[1] = { card: { ...cardDatabase.find((c) => c.id === 4), uid: 'b-' + uid }, position: 'attack', isFaceDown: false };
                const drago = { ...cardDatabase.find((c) => c.id === 1), uid: uid };   // Drago Bianco Occhi Blu: Livello 8, 2 Tributi
                gameState.playerHand.push(drago);
                azzera();
                await new Promise((resolve) => {
                    Comandi.esegui('player', { tipo: 'tributa', indici: [0, 1], perCarta: drago.uid, attesaMs: 0 }, {
                        dopo: () => Comandi.esegui('player', { tipo: 'evoca', carta: drago.uid, mano: gameState.playerHand.indexOf(drago), casella: 0, posizione: posizione }, { alTermine: resolve })
                    });
                });
                await new Promise((res) => setTimeout(res, 700));
                const s = gameState.playerMonsterField.find((x) => x && x.card.uid === uid);
                return Object.assign({}, registro, { coperto: !!(s && s.isFaceDown), posizione: s ? s.position : null });
            };
            out.set = await giocaTributo('defense', 'drago-set');
            out.attacco = await giocaTributo('attack', 'drago-att');
            EventiDuello.attendi = orig.attendi; FX.playMonsterSummonEffect = orig.fx;
            if (window.AudioLibrary) AudioLibrary.tryPlayCardSound = orig.suono;
            if (window.DuelDialogues) DuelDialogues.summon = orig.dialogo;
            SFX.place = orig.place; SFX.summon = orig.summon;
            return out;
        });
        const s = r.set;
        t.assert(s.coperto && s.posizione === 'defense', 'Tribute Set: Difesa coperta: ' + JSON.stringify(s));
        t.assert(s.grido === 0, 'Un mostro coperto non fa partire il grido: ' + JSON.stringify(s));
        t.assert(s.fx === 0, 'Un mostro coperto non fa partire la cinematica di Evocazione: ' + JSON.stringify(s));
        t.assert(s.suonoCarta === 0 && s.summon === 0 && s.dialogo === 0, 'Nessun suono dedicato, di Evocazione o dialogo per un mostro coperto: ' + JSON.stringify(s));
        t.assert(s.place >= 1, 'Solo il suono generico del Set: ' + JSON.stringify(s));
        const a = r.attacco;
        t.assert(!a.coperto && a.posizione === 'attack', 'Evocazione Tributo scoperta in Attacco: ' + JSON.stringify(a));
        t.assert(a.grido >= 1 && a.fx >= 1, 'In Attacco grido e cinematica partono come sempre: ' + JSON.stringify(a));
    }
};
