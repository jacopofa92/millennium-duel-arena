// L'IA non attiva carte che le fanno male.
// =====================================================================
// Segnalato dall'utente giocando: Kaiba, in vantaggio di Life Point, attiva Metamorfosi sacrificando un mostro
// forte per una Fusione scarsa; i bot potenziano (Rinforzi, Corsa Avventata...) il mostro del GIOCATORE invece
// del proprio. Causa comune: il bot attivava qualunque carta che il motore giudicasse attivabile ("le carte di
// risposta sono tutte puro vantaggio") e, dove la carta non dice come scegliere, prendeva il primo candidato —
// che parte dal giocatore.
//
// Tre difese, tre prove:
//  1) il veto per-carta `def.aiCanActivate` + il filtro unico AI_SHARED.attivazioneSensata (Metamorfosi...);
//  2) la scelta automatica del bot fra i bersagli (potenziamento sul proprio mostro, rimozione sul nemico);
//  3) tools/audit-attivazioni-ia.js: prova OGNI Magia/Trappola attivabile su campi di prova, passando dallo
//     stesso filtro dell'IA, e deve tornare zero sospetti. Una carta nuova che peggiora il bot fa fallire qui.
// (Il passo --reattive dell'audit, piu' lungo, si lancia a mano: confronta le risposte in Catena.)
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { creaContesto } = require('../../tools/duello-senza-testa.js');

const RADICE = path.join(__dirname, '..', '..');

function campo(seme) {
    const { contesto, orologio, erroriCarte } = creaContesto({ avversario: 'kaiba', livello: 'hard', seme });
    const ex = (c) => vm.runInContext(c, contesto);
    ex('resetGameState(); Tavolo.imposta({ player: "ia", bot: "ia" }); gameState.livelloIA = { player: "hard", bot: "hard" };');
    ex(`window.__m = (function () {
        const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && !DuelEngine.getDefinition(c.id) && c.level === 4);
        let n = 0;
        return (atk, def, lvl, nome) => ({ card: Object.assign({}, base, { uid: 'T' + (++n), attack: atk, defense: def, level: lvl, name: nome }), position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true });
    })();`);
    return { ex, orologio, erroriCarte };
}

async function lascia(orologio, ex) {
    const respiro = () => new Promise((r) => setImmediate(r));
    for (let giri = 0, vuoti = 0; giri < 600 && vuoti < 3; giri++) {
        await respiro();
        if (orologio.inCoda > 0) { orologio.passo(); vuoti = 0; } else if (ex('DuelEngine.isChainActive()')) vuoti = 0; else vuoti++;
    }
}

module.exports = {
    standalone: true,
    name: 'IA: non attiva carte che le fanno male (Metamorfosi, potenziamenti sul nemico, audit a tappeto)',
    async run({ assert }) {
        // --- 1) Metamorfosi (il caso di Kaiba) ---------------------------------------------
        {
            const { ex } = campo(11);
            ex(`(function () {
                gameState.currentPlayer = 'bot'; gameState.phase = 'main1';
                gameState.botMonsterField = [window.__m(2400, 1500, 6, 'forte'), null, null, null, null];
                gameState.playerMonsterField = [null, null, null, null, null];
                const fusione = (atk, def) => Object.assign({}, cardDatabase.find((c) => c.extraDeck && c.level === 6), { uid: 'F' + atk, attack: atk, defense: def });
                gameState.botExtraDeck = [fusione(1200, 1000)];
                gameState.botHand = [Object.assign({}, cardDatabase.find((c) => c.id === 886), { uid: 'META' })];
            })()`);
            const vetataSeScarsa = !ex("AI_SHARED.attivazioneSensata(gameState.botHand[0], 'bot', 'hand', 0)");
            assert(vetataSeScarsa, 'Metamorfosi non deve essere attivata se la Fusione e\' piu\' debole del mostro che si sacrifica');
            ex(`gameState.botExtraDeck = [Object.assign({}, cardDatabase.find((c) => c.extraDeck && c.level === 6), { uid: 'F1', attack: 1200, defense: 1000 }), Object.assign({}, cardDatabase.find((c) => c.extraDeck && c.level === 6), { uid: 'F2', attack: 3200, defense: 2500 })];`);
            const ok = ex("AI_SHARED.attivazioneSensata(gameState.botHand[0], 'bot', 'hand', 0)");
            assert(ok, 'Metamorfosi si attiva se c\'e\' una Fusione molto piu\' forte (3200 contro 2400)');
        }

        // --- 2) Un potenziamento finisce sul proprio mostro, non su quello del giocatore ------
        for (const id of [549, 608]) {
            const { ex, orologio, erroriCarte } = campo(20 + id);
            ex(`(function () {
                gameState.turn = 6; gameState.currentPlayer = 'bot'; gameState.phase = ${id === 549 ? "'battle'" : "'main1'"};
                gameState.botMonsterField = [window.__m(1800, 1000, 4, 'mio-forte'), window.__m(1000, 2000, 4, 'mio-difesa'), null, null, null];
                gameState.playerMonsterField = [window.__m(2400, 1500, 6, 'loro-forte'), window.__m(1200, 900, 3, 'loro-debole'), null, null, null];
                const c = Object.assign({}, cardDatabase.find((x) => x.id === ${id}), { uid: 'CARTA' });
                ${id === 549 ? "gameState.botSTField[0] = { card: c, isFaceDown: true, setOnTurn: 1 };" : 'gameState.botHand = [c];'}
                DuelEngine.recomputeStaticEffects();
            })()`);
            const comando = id === 549 ? "{ tipo: 'attiva', zona: 'st', indice: 0 }" : "{ tipo: 'attiva', zona: 'hand', indice: 0, carta: 'CARTA' }";
            assert(ex(`Comandi.esegui('bot', ${comando})`), `la carta ${id} deve poter partire`);
            await lascia(orologio, ex);
            const r = ex(`({ mio: gameState.botMonsterField.filter(Boolean).map((s) => DuelEngine.getEffectiveAtk(s.card)),
                loro: gameState.playerMonsterField.filter(Boolean).map((s) => DuelEngine.getEffectiveAtk(s.card)) })`);
            assert(r.loro[0] === 2400 && r.loro[1] === 1200, `La carta ${id} non deve potenziare i mostri del GIOCATORE (${JSON.stringify(r.loro)})`);
            assert(Math.max.apply(null, r.mio) > 1800, `La carta ${id} deve potenziare un mostro del bot (${JSON.stringify(r.mio)})`);
            assert(erroriCarte.length === 0, 'nessun errore di carta: ' + erroriCarte.join(' | '));
        }

        // --- 3) Un Rituale sacrifica la combinazione piu' economica, non i mostri di Livello piu' alto ---
        {
            const { ex, orologio } = campo(33);
            ex(`(function () {
                gameState.turn = 6; gameState.currentPlayer = 'bot'; gameState.phase = 'main1';
                gameState.botMonsterField = [window.__m(2600, 1000, 7, 'forte-L7'), window.__m(800, 1000, 4, 'debole-A'), window.__m(900, 1000, 4, 'debole-B'), null, null];
                gameState.playerMonsterField = [null, null, null, null, null];
                gameState.botHand = [Object.assign({}, cardDatabase.find((c) => c.id === 56), { uid: 'RITO' }), Object.assign({}, cardDatabase.find((c) => c.id === 55), { uid: 'SOLDATO' })];
                DuelEngine.recomputeStaticEffects();
            })()`);
            assert(ex("Comandi.esegui('bot', { tipo: 'attiva', zona: 'hand', indice: 0, carta: 'RITO' })"), 'il Rituale deve partire');
            await lascia(orologio, ex);
            const campoDopo = ex('gameState.botMonsterField.filter(Boolean).map((s) => s.card.name)');
            assert(campoDopo.includes('forte-L7'), 'Il Rituale non deve sacrificare il mostro piu\' forte quando bastano due piu\' deboli: ' + JSON.stringify(campoDopo));
        }

        // --- 4) L'audit a tappeto ----------------------------------------------------------
        let uscita = '';
        try {
            uscita = execFileSync(process.execPath, [path.join(RADICE, 'tools', 'audit-attivazioni-ia.js')], { cwd: RADICE, encoding: 'utf8', timeout: 240000 });
        } catch (e) { uscita = String(e.stdout || '') + String(e.stderr || e.message); }
        assert(/Sospette: 0\b/.test(uscita), 'L\'audit delle attivazioni dell\'IA deve tornare zero carte sospette:\n' + uscita.split('\n').slice(0, 24).join('\n'));
        assert(!/ERRORE/.test(uscita), 'L\'audit non deve avere errori: ' + uscita.slice(0, 400));
    }
};
