// Tag Team, fase 1 (docs/planning/PIANO_TAG_TEAM.md): tu e un compagno IA contro un Duellante.
// Cosa si controlla:
//  1) un duello VERO lasciato giocare: al turno della squadra dopo il tuo entra il compagno IA (posto all'IA,
//     nome e ritratto suoi, velo sui click, Life Point suoi mostrati subito senza conteggio), gioca e lascia il
//     posto; al turno dopo torni tu con la stessa mano con cui eri uscito;
//  2) a duello fermo, una regola alla volta: lo scambio delle proprietà di un membro, le mappe "per membro"
//     (D16), il legame sospeso di un Equip avversario (aggancio A2, verificato anche al contrario), la
//     riconsegna di una carta finita nella mano dell'altro (V2), le voci ritardate messe da parte (V3), il
//     primo membro a 0 Life Point che lascia il posto al compagno (A3, D7, D10, D15) e il secondo che chiude
//     il duello;
//  3) Life Point condivisi (D1 "lato") e Mazzo vuoto di un membro (D17);
//  4) staticamente: ogni mappa "per posto" del motore è classificata (per membro o no), così una mappa nuova
//     non sfugge a D16.
const fs = require('fs');
const path = require('path');
const { waitForOpeningCascade } = require('../helpers/harness');

const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');
const DUELLO = url('duelMonstersCore.html');
const TAG = (lp) => DUELLO + `?mode=tag&character=kaiba&difficulty=Facile&partner=joey&lp=${lp}`;

const PRELUDIO = () => {
    window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true;
    try {
        localStorage.setItem('ygoVideoDetail', 'normali');
        localStorage.setItem('ygoVideoDetailScelto', '1');
        localStorage.setItem('ygoBotSpeed', 'veloce');
    } catch (e) { /* senza storage restano i valori predefiniti */ }
};

/**
 * D16: ogni mappa { player, bot } del motore il cui nome finisce per "For", classificata. 'membro' = deve stare
 * in TagTeam.MAPPE_MEMBRO; gli altri motivi dicono perché NON segue il membro. Una mappa nuova fa fallire lo spec
 * finché qualcuno non decide da che parte sta.
 */
const CLASSIFICAZIONE = {
    // Per membro: durano più turni e colpiscono "un giocatore".
    coldWaveActiveFor: 'membro', skipDrawFor: 'membro', skipNextTurnFor: 'membro', skipMainPhase1For: 'membro',
    skipNextBattlePhaseFor: 'membro', discardHandBeforeDrawFor: 'membro', pendingMaharaghiPeekFor: 'membro',
    lockedMonsterZonesFor: 'membro', lockedSTZonesFor: 'membro', cannotChangePositionFor: 'membro',
    orgothActiveUidsFor: 'membro', orichalcosExtendedNegationUidsFor: 'membro', untilOpponentTurnActiveUidsFor: 'membro',
    soulCrossingActivationLimitFor: 'membro', orichalcosActivatedFor: 'membro',
    // Azzerate a ogni cambio turno o End Phase: valgono un turno solo.
    noTrapActivationFor: 'turno', noSpellActivationFor: 'turno', battleDestroyedThisTurnFor: 'turno',
    onlyOneAttackingMonsterFor: 'turno', ancientChantRaBoostTurnFor: 'turno', spellsSentToGraveyardByOpponentThisTurnFor: 'turno',
    skipBattlePhaseFor: 'turno', trapsNegatedUntilEndOfTurnFor: 'turno', monsterEffectsNegatedUntilEndOfTurnFor: 'turno',
    directAttackDamageFor: 'turno', additionalTributeSummonFor: 'turno', directAttackAllowedFor: 'turno',
    noBattleDamageFor: 'turno', noBattleDestructionFor: 'turno', noDamageFor: 'turno', mustAttackTargetUidsFor: 'turno',
    negatesEffectsOnForcedAttackFor: 'turno', discardHandAtEndPhaseFor: 'turno', raceOverrideFloodgateFor: 'turno',
    wabokuProtectionUidFor: 'turno',
    // Ricalcolate a ogni ridisegno dalle carte sul campo: seguono da sole il campo davanti.
    trapsNegatedFor: 'ricalcolata', spellsNegatedFor: 'ricalcolata', cannotAttackFor: 'ricalcolata', revealedFor: 'ricalcolata',
    otherMonsterSummonsBlockedFor: 'ricalcolata', specialSummonBlockedFor: 'ricalcolata', negatesFiendBattleKillsFor: 'ricalcolata',
    mustBeAttackedUidsFor: 'ricalcolata', graveyardBanishBlockedFor: 'ricalcolata', piercingRacesFor: 'ricalcolata',
    piercingUidsFor: 'ricalcolata', monsterEffectsNegatedUidsFor: 'ricalcolata',
    // Non sono per posto: chiave = uid, oppure un unico oggetto.
    damageStepOnlyBonusFor: 'uid', timeWizardCoinResultFor: 'oggetto'
};

module.exports = {
    standalone: true,
    name: 'Tag Team fase 1: il compagno IA entra a turni alterni, scambio per membro, legami sospesi, eliminazione',
    async run(t) {
        const errori = [];
        const apri = async (viewport) => {
            const page = await t.browser.newPage({ viewport: viewport || { width: 1400, height: 900 } });
            page.on('pageerror', (e) => errori.push(e.message));
            await page.addInitScript(PRELUDIO);
            return page;
        };
        // Attesa del turno N con una diagnosi se scade: dove si è fermato il duello, invece di un timeout muto.
        const aspettaTurno = async (page, turno, ms) => {
            try {
                await page.waitForFunction((n) => gameState.turn >= n && gameState.currentPlayer === 'player', turno, { timeout: ms });
            } catch (e) {
                const stato = await page.evaluate(() => ({
                    turno: gameState.turn, fase: gameState.phase, chi: gameState.currentPlayer, fine: gameState.gameOver,
                    lp: [gameState.playerLP, gameState.botLP], controllore: Tavolo.controllore('player'),
                    scelta: window.Decisioni && Decisioni.inSospeso(), catena: DuelEngine.isChainActive(),
                    modali: [...document.querySelectorAll('.modal-backdrop.open')].map((m) => m.id), rifiutate: window.__rifiutate
                }));
                throw new Error(`Il turno ${turno} non è arrivato: ${JSON.stringify(stato)}`);
            }
        };
        const aspettaSquadra = (page) => page.waitForFunction(
            () => typeof gameState !== 'undefined' && window.TagTeam && TagTeam.eSquadra('player') && (gameState.playerHand || []).length >= 5,
            null, { timeout: 30000 });

        // ---------- 1) Duello vero
        {
            const page = await apri();
            try {
                await page.goto(TAG('membro'));
                try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
                await aspettaSquadra(page);
                // Registro degli scambi preso NELL'ISTANTE dello scambio (le attese del test arrivano dopo).
                await page.evaluate(() => {
                    window.__scambi = [];
                    TagTeam.ascolta((evento, posto) => {
                        if (evento !== 'scambio' || posto !== 'player') return;
                        const m0 = TagTeam.membro('player', 0);
                        const davanti = TagTeam.membroAttivo('player');
                        const manoTu = m0 === davanti ? gameState.playerHand : m0.stato.Hand;
                        const voce = {
                            turno: gameState.turn,
                            davanti: davanti.id,
                            controllore: Tavolo.controllore('player'),
                            manoTu: manoTu.map((c) => c.uid),
                            lpStato: gameState.playerLP
                        };
                        window.__scambi.push(voce);
                        // Subito dopo il disegno del cambio turno: il numero mostrato è già quello di chi entra?
                        setTimeout(() => { voce.lpMostrato = Number(document.getElementById('playerLP').textContent); }, 60);
                    });
                });
                const inizio = await page.evaluate(() => ({
                    sq: TagTeam.riassunto('player'),
                    segnate: gameState.playerHand.every((c) => c.membro === 'player#0') && gameState.playerDeck.every((c) => c.membro === 'player#0'),
                    mazzoCompagno: TagTeam.membro('player', 1).stato.Deck.every((c) => c.membro === 'player#1'),
                    pannello: !!document.getElementById('tagPanchina'),
                    lp: [gameState.playerLP, TagTeam.membro('player', 1).stato.LP, gameState.botLP]
                }));
                t.assert(JSON.stringify(inizio.lp) === '[4000,4000,8000]', 'D19: nel 2 contro 1 la coppia ha 4000 a testa, l\'avversario 8000: ' + JSON.stringify(inizio.lp));
                t.assert(inizio.sq.membri[0].davanti && inizio.sq.membri[0].controllore === 'persona', 'All\'inizio sei davanti tu: ' + JSON.stringify(inizio.sq));
                t.assert(inizio.sq.membri[1].mano === 5 && inizio.sq.membri[1].mazzo === 35, 'Il compagno ha la sua mano di 5 e il resto del suo Mazzo: ' + JSON.stringify(inizio.sq.membri[1]));
                t.assert(inizio.segnate && inizio.mazzoCompagno, 'Ogni carta è segnata con il suo membro (V2)');
                t.assert(inizio.pannello, 'C\'è il riquadro della squadra');

                // Durante il turno dell'avversario può aprirsi una domanda per te (rispondere con una Trappola o
                // un Kuriboh in mano): nel gioco la chiudi tu, qui la rifiuta il test, o il duello resterebbe
                // fermo ad aspettarti e l'attesa del turno 3 scadrebbe (preso una volta su sei giri).
                await page.evaluate(() => {
                    window.__rifiutate = 0;
                    setInterval(() => {
                        if (gameState.gameOver || gameState.currentPlayer !== 'bot') return;
                        const modale = document.getElementById('activateModal');
                        if (modale && modale.classList.contains('open')) { document.getElementById('activateCancelBtn').click(); window.__rifiutate++; return; }
                        const d = window.Decisioni && Decisioni.inSospeso();
                        if (d && d.chi === 'player') {
                            Decisioni.rispondi(d.candidati.length ? 0 : null);
                            document.querySelectorAll('.modal-backdrop.open').forEach((m) => m.classList.remove('open'));
                            window.__rifiutate++;
                        }
                    }, 300);
                });
                await page.waitForFunction(() => gameState.phase === 'main1' && gameState.currentPlayer === 'player', null, { timeout: 30000 });
                await page.evaluate(() => endTurn());
                await aspettaTurno(page, 3, 120000);
                const compagno = await page.evaluate(() => ({
                    controllore: Tavolo.controllore('player'),
                    nome: DuelSession.player.name,
                    nomeBox: document.querySelector('#playerInfo .name-text').textContent,
                    velo: document.body.classList.contains('tag-turno-compagno'),
                    personaggio: gameState.personaggioPerPosto.player,
                    livello: gameState.livelloIA && gameState.livelloIA.player
                }));
                t.assert(compagno.controllore === 'ia' && compagno.personaggio === 'joey' && compagno.livello === 'hard', 'Al turno 3 gioca il compagno, con la sua IA: ' + JSON.stringify(compagno));
                t.assert(compagno.nome === 'Joey Wheeler' && compagno.nomeBox === 'Joey Wheeler', 'Nome del compagno nel riquadro: ' + JSON.stringify(compagno));
                t.assert(compagno.velo, 'Durante il turno del compagno il velo blocca i click');

                await aspettaTurno(page, 5, 180000);
                await page.waitForTimeout(150);
                const dopo = await page.evaluate(() => ({
                    scambi: window.__scambi,
                    controllore: Tavolo.controllore('player'),
                    velo: document.body.classList.contains('tag-turno-compagno'),
                    nome: DuelSession.player.name
                }));
                t.assert(dopo.controllore === 'persona' && !dopo.velo, 'Al turno 5 torni tu, senza velo: ' + JSON.stringify(dopo));
                const [esci, rientri] = dopo.scambi;
                t.assert(esci && esci.turno === 3 && esci.davanti === 'player#1' && rientri && rientri.turno === 5 && rientri.davanti === 'player#0',
                    'Uno scambio al turno 3 e uno al turno 5: ' + JSON.stringify(dopo.scambi));
                t.assert(JSON.stringify(esci.manoTu) === JSON.stringify(rientri.manoTu), 'Rientri con la stessa mano con cui eri uscito');
                t.assert(esci.lpMostrato === esci.lpStato && rientri.lpMostrato === rientri.lpStato,
                    'I Life Point mostrati sono quelli di chi entra, subito e senza conteggio: ' + JSON.stringify(dopo.scambi.map((s) => [s.lpStato, s.lpMostrato])));
            } finally {
                await page.close();
            }
        }

        // ---------- 2) Duello fermo, una regola alla volta
        {
            const page = await apri();
            try {
                await page.goto(TAG('membro'));
                try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
                await aspettaSquadra(page);
                await waitForOpeningCascade(page);
                await page.evaluate(() => { window.changeTurn = function () {}; window.botPerformAttacks = async function () {}; });

                // Scambio delle proprietà e mappe per membro (D16).
                const scambio = await page.evaluate(() => {
                    const manoTu = gameState.playerHand.map((c) => c.uid);
                    gameState.skipDrawFor = gameState.skipDrawFor || {};
                    gameState.skipDrawFor.player = 2;
                    gameState.lockedMonsterZonesFor = { player: new Set([3]), bot: new Set() };
                    TagTeam.scambia('player', 1);
                    const conJoey = {
                        mano: gameState.playerHand.map((c) => c.membro),
                        salta: gameState.skipDrawFor.player,
                        zoneBloccate: gameState.lockedMonsterZonesFor.player instanceof Set ? gameState.lockedMonsterZonesFor.player.size : 'non un Set',
                        controllore: Tavolo.controllore('player')
                    };
                    TagTeam.scambia('player', 0);
                    return {
                        conJoey,
                        stessaMano: JSON.stringify(gameState.playerHand.map((c) => c.uid)) === JSON.stringify(manoTu),
                        salta: gameState.skipDrawFor.player,
                        zoneBloccate: [...gameState.lockedMonsterZonesFor.player]
                    };
                });
                t.assert(scambio.conJoey.mano.every((m) => m === 'player#1') && scambio.conJoey.controllore === 'ia', 'Con Joey davanti, mano sua e posto all\'IA: ' + JSON.stringify(scambio.conJoey));
                t.assert(scambio.conJoey.salta === undefined && scambio.conJoey.zoneBloccate === 0, 'D16: gli effetti che colpivano te non colpiscono Joey (e la mappa a Set resta un Set): ' + JSON.stringify(scambio.conJoey));
                t.assert(scambio.stessaMano && scambio.salta === 2 && JSON.stringify(scambio.zoneBloccate) === '[3]', 'Al rientro ritrovi mano ed effetti tuoi: ' + JSON.stringify(scambio));

                // A2: un Equip dell'avversario legato a un tuo mostro resta sospeso finché il mostro è in panchina.
                const legame = await page.evaluate(() => {
                    const mostro = Object.assign({}, cardDatabase.find((c) => c.type === 'monster' && c.attack >= 1000), { uid: 'tag-mostro', membro: 'player#0' });
                    const equipDef = cardDatabase.find((c) => c.type === 'spell' && (DuelEngine.getDefinition(c.id) || {}).isEquip && typeof DuelEngine.getDefinition(c.id).static === 'function');
                    const equip = Object.assign({}, equipDef, { uid: 'tag-equip', equippedToOwner: 'player', equippedToIndex: 0, equippedToUid: 'tag-mostro' });
                    gameState.playerMonsterField[0] = { card: mostro, position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true };
                    gameState.botSTField[0] = { card: equip, isFaceDown: false };
                    DuelEngine.recomputeStaticEffects();
                    const prima = !!gameState.botSTField[0];
                    TagTeam.scambia('player', 1);
                    DuelEngine.recomputeStaticEffects();
                    const sospeso = !!gameState.botSTField[0] && gameState.uidInPanchina.has('tag-mostro');
                    // Al contrario: senza l'insieme dei mostri in panchina lo stesso Equip finirebbe nel Cimitero.
                    const salvato = gameState.uidInPanchina;
                    gameState.uidInPanchina = new Set();
                    const copia = gameState.botSTField[0];
                    DuelEngine.recomputeStaticEffects();
                    const senzaAggancio = gameState.botSTField[0] === null;
                    gameState.botSTField[0] = copia;
                    gameState.uidInPanchina = salvato;
                    const nelCimitero = gameState.botGraveyard.indexOf(copia.card);
                    if (nelCimitero !== -1) gameState.botGraveyard.splice(nelCimitero, 1);
                    TagTeam.scambia('player', 0);
                    DuelEngine.recomputeStaticEffects();
                    const dopo = !!gameState.botSTField[0] && gameState.playerMonsterField[0] && gameState.playerMonsterField[0].card.uid === 'tag-mostro';
                    gameState.playerMonsterField[0] = null;
                    gameState.botSTField[0] = null;
                    DuelEngine.recomputeStaticEffects();
                    return { equip: equipDef && equipDef.id, prima, sospeso, senzaAggancio, dopo };
                });
                t.assert(legame.equip && legame.prima, 'Equip di prova in campo: ' + JSON.stringify(legame));
                t.assert(legame.sospeso, 'A2: con il mostro in panchina l\'Equip avversario resta in campo, sospeso: ' + JSON.stringify(legame));
                t.assert(legame.senzaAggancio, 'Al contrario: senza A2 lo stesso Equip finisce nel Cimitero');
                t.assert(legame.dopo, 'Al rientro del membro mostro ed Equip sono ancora lì: ' + JSON.stringify(legame));

                // V2 riconsegna e V3 voci ritardate.
                const v23 = await page.evaluate(() => {
                    const diJoey = Object.assign({}, cardDatabase.find((c) => c.type === 'monster'), { uid: 'tag-di-joey', membro: 'player#1' });
                    gameState.playerHand.push(diJoey);
                    const mio = Object.assign({}, cardDatabase.find((c) => c.type === 'monster'), { uid: 'tag-mio', membro: 'player#0' });
                    gameState.playerMonsterField[1] = { card: mio, position: 'attack', isFaceDown: false };
                    gameState.pendingDelayedDestroyAtOpponentEndPhase = [{ queuedByOwner: 'bot', targetOwner: 'player', targetUid: 'tag-mio', endsRemaining: 1 }];
                    TagTeam.scambia('player', 1);
                    const conJoey = {
                        cartaArrivata: gameState.playerHand.some((c) => c.uid === 'tag-di-joey'),
                        voci: gameState.pendingDelayedDestroyAtOpponentEndPhase.length
                    };
                    TagTeam.scambia('player', 0);
                    const conTe = {
                        cartaNonPiuQui: !gameState.playerHand.some((c) => c.uid === 'tag-di-joey'),
                        voci: gameState.pendingDelayedDestroyAtOpponentEndPhase.length
                    };
                    gameState.playerMonsterField[1] = null;
                    gameState.pendingDelayedDestroyAtOpponentEndPhase = [];
                    return { conJoey, conTe };
                });
                t.assert(v23.conJoey.cartaArrivata && v23.conTe.cartaNonPiuQui, 'V2: una carta di Joey finita nella tua mano torna a lui: ' + JSON.stringify(v23));
                t.assert(v23.conJoey.voci === 0 && v23.conTe.voci === 1, 'V3: la distruzione ritardata del tuo mostro aspetta con te in panchina: ' + JSON.stringify(v23));

                // A3, D7, D10, D15: tu a 0 nel turno avversario -> entra Joey e il tuo campo va nel Cimitero; poi Joey a 0 -> fine.
                const caduta = await page.evaluate(async () => {
                    const mio = Object.assign({}, cardDatabase.find((c) => c.type === 'monster'), { uid: 'tag-caduto', membro: 'player#0' });
                    gameState.playerMonsterField[2] = { card: mio, position: 'attack', isFaceDown: false };
                    gameState.currentPlayer = 'bot';
                    gameState.playerLP = 0;
                    checkGameOver();
                    const subito = gameState.gameOver;
                    for (let i = 0; i < 40 && TagTeam.riassunto('player').attivo !== 1; i++) await new Promise((r) => setTimeout(r, 50));
                    const sq = TagTeam.riassunto('player');
                    return {
                        subito,
                        gameOver: gameState.gameOver,
                        attivo: sq.attivo,
                        tuVivo: sq.membri[0].vivo,
                        lpJoey: gameState.playerLP,
                        mostroNelCimitero: gameState.playerGraveyard.some((c) => c.uid === 'tag-caduto'),
                        nomeBox: document.querySelector('#playerInfo .name-text').textContent
                    };
                });
                t.assert(!caduta.subito && !caduta.gameOver, 'A3: il primo membro a 0 non chiude il duello: ' + JSON.stringify(caduta));
                t.assert(caduta.attivo === 1 && !caduta.tuVivo && caduta.lpJoey === 4000, 'D15: entra subito Joey con i suoi Life Point (4000, D19): ' + JSON.stringify(caduta));
                t.assert(caduta.mostroNelCimitero && caduta.nomeBox === 'Joey Wheeler', 'D10: il campo di chi esce va nel Cimitero condiviso: ' + JSON.stringify(caduta));
                const fine = await page.evaluate(() => {
                    gameState.playerLP = 0;
                    checkGameOver();
                    return gameState.gameOver;
                });
                t.assert(fine, 'D7: con entrambi a 0 il lato perde e il duello finisce');
            } finally {
                await page.close();
            }
        }

        // ---------- 2bis) D18: a 0 Life Point nel PROPRIO turno scatta la End Phase, il compagno entra al cambio turno
        {
            const page = await apri();
            try {
                await page.goto(TAG('membro'));
                try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
                await aspettaSquadra(page);
                await waitForOpeningCascade(page);
                await page.waitForFunction(() => gameState.phase === 'main1' && gameState.currentPlayer === 'player', null, { timeout: 30000 });
                // Il cambio turno lo fa il test (emettendo 'inizio-turno'): quello vero farebbe partire il turno del bot.
                await page.evaluate(() => { window.changeTurn = function () { window.__cambioTurnoChiesto = true; }; window.botPerformAttacks = async function () {}; });
                await page.evaluate(() => {
                    const mio = Object.assign({}, cardDatabase.find((c) => c.type === 'monster'), { uid: 'tag-d18', membro: 'player#0' });
                    gameState.playerMonsterField[2] = { card: mio, position: 'attack', isFaceDown: false };
                    gameState.playerLP = 0;
                    checkGameOver();
                });
                try {
                    await page.waitForFunction(() => gameState.phase === 'end', null, { timeout: 10000 });
                } catch (e) {
                    const stato = await page.evaluate(() => ({
                        fase: gameState.phase, chi: gameState.currentPlayer, turno: gameState.turn, fine: gameState.gameOver,
                        lp: gameState.playerLP, attivo: TagTeam.riassunto('player').attivo, catena: DuelEngine.isChainActive(),
                        priorita: DuelEngine.isPriorityWindowOpen && DuelEngine.isPriorityWindowOpen(),
                        scelta: window.Decisioni && Decisioni.inSospeso(), log: [...document.querySelectorAll('#gameLog *')].slice(-6).map((n) => n.textContent),
                        tributoInSospeso: EventiDuello.chiedi('evocazione-in-sospeso', false)
                    }));
                    throw new Error('D18: la End Phase non è scattata: ' + JSON.stringify(stato));
                }
                const durante = await page.evaluate(() => ({
                    gameOver: gameState.gameOver,
                    attivo: TagTeam.riassunto('player').attivo,
                    // Dopo la End Phase forzata le mosse di quel posto sono rifiutate fino al cambio turno.
                    battaglia: Comandi.esegui('player', { tipo: 'fase', verso: 'battle' }),
                    fase: gameState.phase,
                    // Comandi è un const di script, non sta su globalThis: la variante deve averlo trovato lo stesso.
                    sorvegliato: Comandi.__tagSorvegliato === true
                }));
                t.assert(durante.sorvegliato, 'La variante sorveglia Comandi.esegui (attacchi in corso, D15, e mosse dopo D18)');
                t.assert(!durante.gameOver && durante.attivo === 0, 'D18: il membro a 0 nel suo turno resta davanti fino alla fine del turno: ' + JSON.stringify(durante));
                t.assert(durante.battaglia === false && durante.fase === 'end', 'D18: dopo la End Phase forzata il turno non si riapre: ' + JSON.stringify(durante));
                const dopo = await page.evaluate(() => {
                    gameState.currentPlayer = 'bot';
                    gameState.turn++;
                    EventiDuello.emetti('inizio-turno', 'bot');
                    const sq = TagTeam.riassunto('player');
                    return {
                        gameOver: gameState.gameOver,
                        attivo: sq.attivo,
                        tuVivo: sq.membri[0].vivo,
                        lpJoey: gameState.playerLP,
                        mostroNelCimitero: gameState.playerGraveyard.some((c) => c.uid === 'tag-d18')
                    };
                });
                t.assert(!dopo.gameOver && dopo.attivo === 1 && !dopo.tuVivo && dopo.lpJoey === 4000,
                    'D18: al cambio turno esci e Joey entra in tempo per il turno avversario: ' + JSON.stringify(dopo));
                t.assert(dopo.mostroNelCimitero, 'D10: il tuo campo va nel Cimitero condiviso: ' + JSON.stringify(dopo));
            } finally {
                await page.close();
            }
        }

        // ---------- 3) Life Point condivisi e Mazzo vuoto
        {
            const page = await apri();
            try {
                await page.goto(TAG('lato'));
                try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro */ }
                await aspettaSquadra(page);
                await waitForOpeningCascade(page);
                await page.evaluate(() => { window.changeTurn = function () {}; window.botPerformAttacks = async function () {}; });
                const r = await page.evaluate(() => {
                    const lpInizio = gameState.playerLP;
                    gameState.playerLP = 5000;
                    TagTeam.scambia('player', 1);
                    const lpConJoey = gameState.playerLP;
                    TagTeam.scambia('player', 0);
                    // D17: Joey entra con il Mazzo vuoto -> eliminato, gioca ancora il primo membro.
                    TagTeam.membro('player', 1).stato.Deck = [];
                    EventiDuello.emetti('inizio-turno', 'player');
                    const sq = TagTeam.riassunto('player');
                    const deck = { joeyVivo: sq.membri[1].vivo, motivo: sq.membri[1].motivo, attivo: sq.attivo };
                    gameState.playerLP = 0;
                    checkGameOver();
                    return { lpInizio, lpConJoey, deck, gameOver: gameState.gameOver };
                });
                t.assert(r.lpInizio === 8000 && r.lpConJoey === 5000, 'D1 "lato": i Life Point restano gli stessi allo scambio: ' + JSON.stringify(r));
                t.assert(!r.deck.joeyVivo && r.deck.motivo === 'mazzo' && r.deck.attivo === 0, 'D17: chi entra col Mazzo vuoto è eliminato e gioca il compagno: ' + JSON.stringify(r.deck));
                t.assert(r.gameOver, 'D1 "lato": a 0 il lato perde subito');
            } finally {
                await page.close();
            }
        }

        // ---------- 4) Ogni mappa "per posto" del motore è classificata (D16)
        {
            const nomi = new Set();
            const scorri = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((n) => {
                const p = path.join(d, n.name);
                if (n.isDirectory()) { if (!['vendor', 'data'].includes(n.name)) scorri(p); return; }
                if (!n.name.endsWith('.js')) return;
                for (const m of fs.readFileSync(p, 'utf8').matchAll(/gameState\.(\w+For)\b/g)) nomi.add(m[1]);
            });
            scorri(path.join(RADICE, 'js'));
            const senza = [...nomi].filter((n) => !CLASSIFICAZIONE[n]).sort();
            t.assert(senza.length === 0, 'Mappe "per posto" nuove da classificare in questo spec (e, se "membro", in MAPPE_MEMBRO di js/modes/tag.js): ' + senza.join(', '));
            const page = await apri();
            try {
                await page.goto(DUELLO);
                await page.waitForFunction(() => !!window.TagTeam, null, { timeout: 30000 });
                const elenco = await page.evaluate(() => TagTeam.MAPPE_MEMBRO);
                const attese = Object.keys(CLASSIFICAZIONE).filter((n) => CLASSIFICAZIONE[n] === 'membro').sort();
                t.assert(JSON.stringify([...elenco].sort()) === JSON.stringify(attese), 'MAPPE_MEMBRO coincide con le mappe classificate "membro": ' + JSON.stringify({ elenco, attese }));
            } finally {
                await page.close();
            }
        }

        t.assert(errori.length === 0, 'Nessun errore JavaScript nelle pagine: ' + errori.join(' | '));
    }
};
