#!/usr/bin/env node
/**
 * audit-attivazioni-ia.js — "il bot attiva carte che gli fanno male?"
 * =====================================================================
 * Per OGNI Magia/Trappola attivabile, il bot la attiva su campi di prova (varianti di razza/attributo)
 * col percorso VERO (Comandi 'attiva', scelte automatiche del posto IA), e si misura cosa e' cambiato:
 *   - BUFF AL NEMICO   un mostro del giocatore ha guadagnato ATK/DEF (potenziamento finito sul lato sbagliato);
 *   - AUTOLESIONE      i mostri del bot perdono valore o spariscono e il giocatore NON perde nulla
 *                      (ne' mostri, ne' statistiche, ne' LP, ne' carte) — un costo senza beneficio;
 *   - BERSAGLIO PROPRIO  una carta che dice di colpire il nemico ha colpito un mostro del bot.
 * Non decide cosa sia "giusto": produce l'elenco dei sospetti, da leggere carta per carta.
 *
 * Uso: node tools/audit-attivazioni-ia.js [--id N] [--json file]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { creaContesto } = require('./duello-senza-testa.js');

const argv = process.argv.slice(2);
const val = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
const SOLO_ID = val('id') ? Number(val('id')) : null;

// Campi di prova: (razza, attributo) del lato bot e del lato giocatore, per toccare i filtri di razza/attributo del testo.
const VARIANTI = [
    { bot: ['Guerriero', 'TERRA'], gio: ['Bestia', 'TERRA'] },
    { bot: ['Macchina', 'LUCE'], gio: ['Drago', 'OSCURITÀ'], ricco: true, lp: [8000, 2000] },
    { bot: ['Incantatore', 'OSCURITÀ'], gio: ['Zombie', 'OSCURITÀ'], lp: [2500, 8000] },
    { bot: ['Drago', 'VENTO'], gio: ['Macchina', 'FUOCO'], ricco: true, lp: [1500, 1500] },
    { bot: ['Pesce', 'ACQUA'], gio: ['Guerriero', 'FUOCO'], ricco: true },
    { bot: ['Demone', 'OSCURITÀ'], gio: ['Incantatore', 'LUCE'], lp: [8000, 8000] },
    // campo "pieno" (Cimiteri, Magie/Trappole scoperte avversarie, Deck da cercare) con razze miste
    { bot: ['Guerriero', 'TERRA'], gio: ['Guerriero', 'TERRA'], ricco: true, pieno: true },
    { bot: ['Incantatore', 'LUCE'], gio: ['Drago', 'FUOCO'], ricco: true, pieno: true, lp: [6000, 3000] },
    // Standby Phase del bot (carte che si attivano solo li')
    { bot: ['Guerriero', 'TERRA'], gio: ['Bestia', 'TERRA'], ricco: true, pieno: true, fase: 'standby' }
];

function nuovaPartita(seme) {
    const { contesto, orologio, erroriCarte } = creaContesto({ avversario: 'kaiba', livello: 'hard', seme });
    const esegui = (c) => vm.runInContext(c, contesto);
    esegui('resetGameState(); Tavolo.imposta({ player: "ia", bot: "ia" }); gameState.livelloIA = { player: "hard", bot: "hard" };');
    return { esegui, orologio, erroriCarte };
}

/** Prepara il campo di prova e torna le uid dei mostri. */
function preparaCampo(esegui, variante, citate) {
    return esegui(`(function () {
        const v = ${JSON.stringify(variante)};
        const citate = ${JSON.stringify(citate || [])};
        let n = 0;
        const base = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && !DuelEngine.getDefinition(c.id) && c.level === 4);
        const mostro = (race, attr, atk, def, lvl, nome) => Object.assign({}, base, { uid: 'T' + (++n), race, attribute: attr, attack: atk, defense: def, level: lvl, name: nome });
        const slot = (c, pos) => ({ card: c, position: pos || 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedThisTurn: false });
        gameState.turn = 6; gameState.currentPlayer = 'bot'; gameState.phase = ${JSON.stringify(variante.fase || 'main1')};
        // Situazioni diverse: pari / bot avanti / bot indietro / entrambi bassi (varia con la variante).
        const LP = ${JSON.stringify(variante.lp || [8000, 8000])};
        gameState.botLP = LP[0]; gameState.playerLP = LP[1];
        gameState.botMonsterField = [slot(mostro(v.bot[0], v.bot[1], 1800, 1000, 4, 'B-forte')), slot(mostro(v.bot[0], v.bot[1], 1000, 2000, 4, 'B-difesa')), null, null, null];
        gameState.playerMonsterField = [slot(mostro(v.gio[0], v.gio[1], 2400, 1500, 6, 'G-forte')), slot(mostro(v.gio[0], v.gio[1], 1200, 900, 3, 'G-debole')), null, null, null];
        gameState.botSTField = [null, null, null, null, null];
        gameState.playerSTField = [null, null, null, null, null];
        const grave = (race, attr) => [mostro(race, attr, 1600, 1200, 4, 'cimitero-1'), mostro(race, attr, 2000, 1000, 5, 'cimitero-2')];
        gameState.botGraveyard = grave(v.bot[0], v.bot[1]);
        gameState.playerGraveyard = grave(v.gio[0], v.gio[1]);
        gameState.botHand = [mostro(v.bot[0], v.bot[1], 1500, 1200, 4, 'mano-1'), mostro(v.bot[0], v.bot[1], 800, 800, 3, 'mano-2')];
        gameState.playerHand = [mostro(v.gio[0], v.gio[1], 1400, 1100, 4, 'gmano-1'), mostro(v.gio[0], v.gio[1], 900, 900, 3, 'gmano-2'), mostro(v.gio[0], v.gio[1], 700, 700, 2, 'gmano-3')];
        // Campo piu' ricco (un terzo mostro per lato, trappole coperte avversarie, Cimiteri con Magie/Trappole):
        // molte carte si attivano solo se c'e' "qualcosa" da colpire o da recuperare.
        if (${JSON.stringify(!!variante.ricco)}) {
            gameState.botMonsterField[2] = slot(mostro(v.bot[0], v.bot[1], 2200, 800, 5, 'B-medio'));
            gameState.playerMonsterField[2] = slot(mostro(v.gio[0], v.gio[1], 1600, 1800, 5, 'G-medio'));
            const trappola = (nome) => Object.assign({}, cardDatabase.find((c) => c.type === 'trap'), { uid: 'TR' + (++n), name: nome });
            gameState.playerSTField[0] = { card: trappola('trappola-nemica-1'), isFaceDown: true, setOnTurn: 1 };
            gameState.playerSTField[1] = { card: trappola('trappola-nemica-2'), isFaceDown: true, setOnTurn: 1 };
            const magia = Object.assign({}, cardDatabase.find((c) => c.type === 'spell' && c.subtype === 'normal'), { uid: 'SP' + (++n) });
            const trap = Object.assign({}, cardDatabase.find((c) => c.type === 'trap'), { uid: 'TP' + (++n) });
            gameState.botGraveyard.push(magia, trap);
            gameState.playerGraveyard.push(Object.assign({}, magia, { uid: 'SP' + (++n) }), Object.assign({}, trap, { uid: 'TP' + (++n) }));
            gameState.botHand.push(mostro(v.bot[0], v.bot[1], 2400, 1000, 6, 'mano-3'), Object.assign({}, magia, { uid: 'SP' + (++n) }));
        }
        // Campo "pieno": le condizioni che molte carte chiedono e che il campo base non offre — Cimiteri con 5+ mostri
        // (uno Normale per lato), Magie/Trappole SCOPERTE dell'avversario (continue, Equipaggiamento, Trappola), un
        // mostro avversario in Difesa e uno coperto, una Magia Equipaggiamento nel Cimitero, un Deck da cui cercare.
        if (${JSON.stringify(!!variante.pieno)}) {
            const piena = (nome) => (cardDatabase.find((c) => c.type === 'spell' && c.subtype === nome) || cardDatabase.find((c) => c.type === 'spell'));
            const trappolaCont = cardDatabase.find((c) => c.type === 'trap' && c.subtype === 'continuous') || cardDatabase.find((c) => c.type === 'trap');
            for (let k = 0; k < 4; k++) {
                gameState.botGraveyard.push(mostro(v.bot[0], v.bot[1], 1200 + k * 100, 1000, 4, 'cim-bot-' + k));
                gameState.playerGraveyard.push(mostro(v.gio[0], v.gio[1], 1200 + k * 100, 1000, 4, 'cim-gio-' + k));
            }
            gameState.playerSTField[2] = { card: Object.assign({}, piena('continuous'), { uid: 'PS1' }), isFaceDown: false, setOnTurn: 1 };
            gameState.playerSTField[3] = { card: Object.assign({}, trappolaCont, { uid: 'PS2' }), isFaceDown: false, setOnTurn: 1 };
            gameState.playerSTField[4] = { card: Object.assign({}, piena('equip'), { uid: 'PS3' }), isFaceDown: false, setOnTurn: 1 };
            gameState.botSTField[4] = { card: Object.assign({}, piena('continuous'), { uid: 'PS4' }), isFaceDown: false, setOnTurn: 1 };
            gameState.playerMonsterField[1].position = 'defense';
            gameState.playerMonsterField[3] = { card: mostro(v.gio[0], v.gio[1], 1000, 1000, 3, 'G-coperto'), position: 'defense', isFaceDown: true, hasAttacked: false, canChangePosition: true, summonedThisTurn: false };
            gameState.botGraveyard.push(Object.assign({}, piena('equip'), { uid: 'PS5' }));
            gameState.botDeck = [
                mostro('Guerriero', 'TERRA', 1500, 1000, 4, 'deck-guerriero'), mostro(v.bot[0], v.bot[1], 1700, 1000, 4, 'deck-razza'),
                Object.assign({}, piena('field'), { uid: 'PS6' }), Object.assign({}, piena('normal'), { uid: 'PS7' }),
                Object.assign({}, trappolaCont, { uid: 'PS8' }), mostro('Dinosauro', 'TERRA', 1000, 1000, 3, 'deck-dino')
            ];
        }
        // Le carte che il testo della carta in prova CITA (un rituale vuole il suo mostro, "se controlli X" vuole X...):
        // una copia in mano, una nel Cimitero, una sul campo del bot (casella 3) — cosi' piu' carte diventano attivabili.
        citate.forEach((id) => {
            const c = cardDatabase.find((x) => x.id === id);
            if (!c) return;
            gameState.botHand.push(Object.assign({}, c, { uid: 'CI-m' + (++n) }));
            gameState.botGraveyard.push(Object.assign({}, c, { uid: 'CI-g' + (++n) }));
            gameState.botDeck = (gameState.botDeck || []).concat([Object.assign({}, c, { uid: 'CI-d' + (++n) })]);
            if (c.type === 'monster' && !c.extraDeck) {
                const libero = [3, 4].find((i) => !gameState.botMonsterField[i]);
                if (libero !== undefined) gameState.botMonsterField[libero] = slot(Object.assign({}, c, { uid: 'CI-c' + (++n) }));
            } else if (c.type === 'spell' && c.subtype === 'field') {
                gameState[Tavolo.chiave('bot', 'FieldSpell')] = { card: Object.assign({}, c, { uid: 'CI-f' + (++n) }), isFaceDown: false };
            } else if (c.type !== 'monster') {
                const libero = [1, 2, 3].find((i) => !gameState.botSTField[i]);
                if (libero !== undefined) gameState.botSTField[libero] = { card: Object.assign({}, c, { uid: 'CI-s' + (++n) }), isFaceDown: false, setOnTurn: 1 };
            }
        });
        // Setup su misura per le carte che chiedono una composizione precisa (id -> cosa mettere dove)
        (${JSON.stringify(variante.setup || [])}).forEach((id) => {
            const c = cardDatabase.find((x) => x.id === id);
            if (c) gameState.botGraveyard.push(Object.assign({}, c, { uid: 'SU-' + (++n) }));
        });
        // Un Extra Deck con Fusioni di vari Livelli (alcune carte ne chiedono uno dello stesso Livello di un mostro in campo).
        const fusioni = [];
        [3, 4, 5, 6, 7, 8].forEach((lvl) => cardDatabase.filter((c) => c.extraDeck && c.level === lvl).slice(0, 2).forEach((c) => fusioni.push(Object.assign({}, c, { uid: 'X' + (++n) }))));
        gameState.botExtraDeck = fusioni;
        // In una partita vera i registri per-uid (cannotBeTargeted...Uids ecc.) nascono al primo ricalcolo dei bonus continui.
        DuelEngine.recomputeStaticEffects();
        return true;
    })()`);
}

/** Le grandezze che interessano, dal punto di vista del bot. */
const FOTO = `(function () {
    const val = (s) => s ? DuelEngine.getEffectiveAtk(s.card) + DuelEngine.getEffectiveDef(s.card) : 0;
    const mostri = (campo) => campo.filter(Boolean).map((s) => ({ uid: s.card.uid, nome: s.card.name, atk: DuelEngine.getEffectiveAtk(s.card), def: DuelEngine.getEffectiveDef(s.card) }));
    return {
        bot: mostri(gameState.botMonsterField), gio: mostri(gameState.playerMonsterField),
        botLP: gameState.botLP, gioLP: gameState.playerLP,
        botMano: gameState.botHand.length, gioMano: gameState.playerHand.length,
        botCim: gameState.botGraveyard.length, gioCim: gameState.playerGraveyard.length,
        botST: gameState.botSTField.filter(Boolean).length, gioST: gameState.playerSTField.filter(Boolean).length,
        botExtra: (gameState.botExtraDeck || []).length
    };
})()`;

function confronta(prima, dopo, daMano) {
    const out = { buffNemico: [], autolesione: false, motivi: [] };
    const perUid = (arr) => Object.fromEntries(arr.map((m) => [m.uid, m]));
    const gPrima = perUid(prima.gio);
    dopo.gio.forEach((m) => {
        const p = gPrima[m.uid];
        if (p && (m.atk > p.atk || m.def > p.def)) out.buffNemico.push(`${m.nome} ${p.atk}/${p.def} -> ${m.atk}/${m.def}`);
    });
    const valBot = (f) => f.bot.reduce((s, m) => s + m.atk + m.def, 0);
    const valGio = (f) => f.gio.reduce((s, m) => s + m.atk + m.def, 0);
    const botPerde = valBot(dopo) < valBot(prima) || dopo.bot.length < prima.bot.length;
    const gioPerde = valGio(dopo) < valGio(prima) || dopo.gio.length < prima.gio.length || dopo.gioLP < prima.gioLP
        || dopo.gioMano < prima.gioMano || dopo.gioST < prima.gioST || dopo.gioCim < prima.gioCim;
    const botGuadagna = dopo.bot.length > prima.bot.length || dopo.botMano > prima.botMano - 1 && false
        || dopo.botLP > prima.botLP || dopo.botST > prima.botST || valBot(dopo) > valBot(prima);
    if (botPerde && !gioPerde) { out.autolesione = true; out.motivi.push(`bot ${valBot(prima)}->${valBot(dopo)} (${prima.bot.length}->${dopo.bot.length} mostri), nemico invariato`); }
    // Costi pagati senza niente in cambio: LP persi o carte della mano scartate (la Magia stessa lascia la mano: -1 normale).
    const manoPersa = (prima.botMano - (daMano ? 1 : 0)) - dopo.botMano;
    if (dopo.botLP < prima.botLP && !gioPerde && !botGuadagna && !botPerde) out.motivi.push(`paga ${prima.botLP - dopo.botLP} LP senza vantaggio visibile`);
    if (manoPersa > 0 && !gioPerde && !botGuadagna && !botPerde) out.motivi.push(`scarta ${manoPersa} carte dalla mano senza vantaggio visibile`);
    if (botPerde && gioPerde && !botGuadagna && valBot(prima) - valBot(dopo) > valGio(prima) - valGio(dopo) + 1500) out.motivi.push(`perde piu' del nemico: bot ${valBot(prima)}->${valBot(dopo)}, nemico ${valGio(prima)}->${valGio(dopo)}`);
    return out;
}

/**
 * PASSO 2 — Trappole REATTIVE. Una Trappola risponde a qualcosa che fa l'avversario (un attacco, un'Evocazione):
 * non si puo' attivare "a vuoto" come una Magia. Si gioca quindi la STESSA mossa del giocatore due volte, una con la
 * Trappola Settata dal bot e una senza, e si confronta come finisce per il bot. Se con la Trappola il bot sta PEGGIO
 * (valore dei mostri + Life Point, differenza con il giocatore), la risposta dell'IA e' controproducente.
 */
const SCENARI_REATTIVI = [
    // il giocatore attacca un mostro del bot piu' debole di lui
    { nome: 'attacco a un mostro', fase: 'battle', comando: "{ tipo: 'attacca', attaccante: 0, bersaglio: 0 }" },
    // il giocatore attacca direttamente (campo del bot vuoto)
    { nome: 'attacco diretto', fase: 'battle', svuotaBot: true, comando: "{ tipo: 'attacca', attaccante: 0, bersaglio: -1 }" },
    // il giocatore Evoca un mostro
    { nome: 'Evocazione', fase: 'main1', daMano: true, comando: "{ tipo: 'evoca', carta: 'NUOVO', mano: 0, casella: 3, posizione: 'attack' }" },
    // il giocatore gioca una Magia di massa (Raigeki) / a bersaglio (Cambio di Cuore) / che pesca (Vaso dell'Avidita')
    { nome: 'Magia di massa (Raigeki)', fase: 'main1', magia: 409, comando: "{ tipo: 'attiva', zona: 'hand', indice: 0, carta: 'MAGIA' }" },
    { nome: 'Magia a bersaglio (Cambio di Cuore)', fase: 'main1', magia: 147, comando: "{ tipo: 'attiva', zona: 'hand', indice: 0, carta: 'MAGIA' }" },
    { nome: 'Magia che pesca (Vaso dell\'Avidita\')', fase: 'main1', magia: 36, comando: "{ tipo: 'attiva', zona: 'hand', indice: 0, carta: 'MAGIA' }" },
    // la distruzione mirata di un mostro del bot (Ruba-Anime): l'IA puo' rispondere a un bersaglio specifico
    { nome: 'Magia che distrugge un mostro bersaglio (Ruba-Anime)', fase: 'main1', magia: 453, comando: "{ tipo: 'attiva', zona: 'hand', indice: 0, carta: 'MAGIA' }" },
    // il giocatore gira scoperto un proprio mostro coperto (Flip Summon)
    { nome: 'Flip Summon', fase: 'main1', preparazione: "gameState.playerMonsterField[3] = { card: Object.assign({}, gameState.playerMonsterField[1].card, { uid: 'COPERTO', attack: 1700, defense: 1000, level: 4, name: 'G-coperto' }), position: 'defense', isFaceDown: true, hasAttacked: false, canChangePosition: true, summonedOnTurn: 0 };", comando: "{ tipo: 'posizione', casella: 3 }" },
    // il giocatore Setta un mostro coperto (Ombra degli Occhi...)
    { nome: 'Mostro Settato', fase: 'main1', daMano: true, comando: "{ tipo: 'evoca', carta: 'NUOVO', mano: 0, casella: 3, posizione: 'defense' }" },
    // il giocatore attiva l'effetto di un suo mostro (scelto a runtime fra quelli attivabili)
    { nome: 'Effetto di un mostro', fase: 'main1', effettoMostro: true, comando: "{ tipo: 'attiva', zona: 'monster', indice: 4 }" },
    // il giocatore attiva una propria Trappola (scelta a runtime fra quelle attivabili) in Battle Phase
    { nome: 'Trappola attivata dal giocatore', fase: 'battle', trappolaGiocatore: true, comando: "{ tipo: 'attiva', zona: 'st', indice: 4 }" },
    // il giocatore Evoca Specialmente un mostro dalla mano (la carta e' scelta a runtime fra quelle che lo permettono)
    { nome: 'Evocazione Speciale dalla mano', fase: 'main1', speciale: true, comando: "{ tipo: 'specialeDaMano', carta: 'SPECIALE', mano: 0, posizione: 'attack' }" }
];

async function passoReattive(PARTITE, ids, nomiCarte) {
    const risposte = [];
    const usate = []; // le Trappole che il bot ha davvero attivato in almeno uno scenario
    const respiro = () => new Promise((r) => setImmediate(r));
    async function gioca(vi, scenario, trapId) {
        const { esegui, orologio } = PARTITE[vi];
        while (orologio.inCoda > 0 && orologio.passo()) { /* svuota */ }
        esegui('resetGameState(); Tavolo.imposta({ player: "ia", bot: "ia" }); gameState.livelloIA = { player: "hard", bot: "hard" };');
        preparaCampo(esegui, VARIANTI[vi], []);
        esegui(`(function () {
            gameState.currentPlayer = 'player'; gameState.phase = ${JSON.stringify(scenario.fase)};
            ${scenario.svuotaBot ? 'gameState.botMonsterField = [null, null, null, null, null];' : ''}
            gameState.playerMonsterField.forEach((s) => { if (s) { s.hasAttacked = false; s.summonedOnTurn = 0; } });
            ${scenario.daMano ? `gameState.playerHand.unshift(Object.assign({}, gameState.playerHand[0], { uid: 'NUOVO', attack: 1800, defense: 1000, level: 4, name: 'G-nuovo' }));` : ''}
            ${scenario.preparazione || ''}
            ${scenario.effettoMostro ? `(function () {
                for (const c of cardDatabase) {
                    const d = DuelEngine.getDefinition(c.id);
                    if (c.type !== 'monster' || c.extraDeck || !d || typeof d.activate !== 'function') continue;
                    if (/moneta|dado|a caso/i.test(String(c.effect))) continue; // un esito casuale falserebbe il confronto con/senza Trappola
                    gameState.playerMonsterField[4] = { card: Object.assign({}, c, { uid: 'EFFETTO' }), position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedOnTurn: 0 };
                    if (DuelEngine.canActivate('player', 'monster', 4)) return;
                    gameState.playerMonsterField[4] = null;
                }
            })();` : ''}
            ${scenario.trappolaGiocatore ? `(function () {
                for (const c of cardDatabase) {
                    const d = DuelEngine.getDefinition(c.id);
                    if (c.type !== 'trap' || !d || typeof d.activate !== 'function') continue;
                    gameState.playerSTField[4] = { card: Object.assign({}, c, { uid: 'TRAPPOLAG' }), isFaceDown: true, setOnTurn: 1 };
                    if (DuelEngine.canActivate('player', 'st', 4)) return;
                    gameState.playerSTField[4] = null;
                }
            })();` : ''}
            ${scenario.speciale ? `(function () {
                // il primo mostro con una Evocazione Speciale dalla mano che il motore concede subito
                for (const c of cardDatabase) {
                    if (c.type !== 'monster' || c.extraDeck || !DuelEngine.getDefinition(c.id)) continue;
                    gameState.playerHand.unshift(Object.assign({}, c, { uid: 'SPECIALE' }));
                    if (DuelEngine.canSpecialSummonFromHand('player', 0)) return;
                    gameState.playerHand.shift();
                }
            })();` : ''}
            ${scenario.magia ? `gameState.playerHand.unshift(Object.assign({}, cardDatabase.find((c) => c.id === ${scenario.magia}), { uid: 'MAGIA' }));` : ''}
            ${trapId ? `gameState.botSTField[0] = { card: Object.assign({}, cardDatabase.find((c) => c.id === ${trapId}), { uid: 'TRAPPOLA' }), isFaceDown: true, setOnTurn: 1 };` : ''}
            DuelEngine.recomputeStaticEffects();
        })()`);
        const prima = esegui(FOTO);
        esegui('__logDuello.length = 0;'); // il registro e' della partita intera: si riparte da zero per ogni mossa
        esegui(`Comandi.esegui('player', ${scenario.comando})`);
        for (let giri = 0, vuoti = 0; giri < 1500 && vuoti < 4; giri++) {
            await respiro();
            if (orologio.inCoda > 0) { orologio.passo(); vuoti = 0; } else if (esegui('DuelEngine.isChainActive()')) vuoti = 0; else vuoti++;
        }
        const dopo = esegui(FOTO);
        const usata = esegui("__logDuello.some((r) => /Il bot ha attivato/.test(r))");
        const valore = (f) => f.bot.reduce((s, m) => s + m.atk + 0.5 * m.def, 0) - f.gio.reduce((s, m) => s + m.atk + 0.5 * m.def, 0) + 0.5 * (f.botLP - f.gioLP);
        const registro = argv.includes('--log') ? esegui('__logDuello.slice()') : null;
        return { punteggio: valore(dopo), usata, prima: valore(prima), registro, dopo };
    }
    for (const id of ids) {
        const peggiori = [];
        let usataUnaVolta = false;
        for (const vi of [0, 1, 6]) { // base, ricco, campo pieno
            for (const scenario of SCENARI_REATTIVI) {
                let base, con;
                try { base = await gioca(vi, scenario, null); con = await gioca(vi, scenario, id); } catch (e) { continue; }
                if (con.usata) usataUnaVolta = true;
                if (argv.includes('--log') && con.usata && con.punteggio < base.punteggio - 500) console.log(`--- #${id} ${scenario.nome} v${vi}\nBASE: ${(base.registro || []).join(' | ')}\nCON: ${(con.registro || []).join(' | ')}\n${JSON.stringify(base.dopo.bot.length)} vs ${JSON.stringify(con.dopo.bot.length)}`);
                if (con.usata && con.punteggio < base.punteggio - 500) {
                    peggiori.push(`${scenario.nome} (${VARIANTI[vi].bot[0]}/${VARIANTI[vi].gio[0]}): senza la Trappola ${Math.round(base.punteggio)}, con la Trappola ${Math.round(con.punteggio)}`);
                }
            }
        }
        if (peggiori.length) risposte.push({ id, peggiori });
        if (usataUnaVolta) usate.push(id);
    }
    risposte.usate = usate;
    return risposte;
}

/**
 * PASSO 3 — Mostri. (a) le abilita' attivabili di un mostro GIA' in campo (Ignition); (b) le Evocazioni Speciali dalla
 * mano, che spesso costano qualcosa (bandire, tributare). Stessa misura del passo 1: chi paga senza che il nemico perda.
 */
async function passoMostri(PARTITE, ids, nomiCarte) {
    const respiro = () => new Promise((r) => setImmediate(r));
    const nomi = new Map(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'cards.json'), 'utf8')).map((c) => [c.id, c]));
    const sospetti = []; let provati = 0;
    const speciali = { provate: 0, sospette: [] };
    async function fluisci(orologio, esegui) {
        for (let giri = 0, vuoti = 0; giri < 800 && vuoti < 3; giri++) {
            await respiro();
            if (orologio.inCoda > 0) { orologio.passo(); vuoti = 0; } else if (esegui('DuelEngine.isChainActive()')) vuoti = 0; else vuoti++;
        }
        esegui('DuelEngine.recomputeStaticEffects()');
    }
    async function prova(id, vi, modo) {
        const { esegui, orologio } = PARTITE[vi];
        while (orologio.inCoda > 0 && orologio.passo()) { /* svuota */ }
        esegui('resetGameState(); Tavolo.imposta({ player: "ia", bot: "ia" }); gameState.livelloIA = { player: "hard", bot: "hard" };');
        preparaCampo(esegui, VARIANTI[vi], []);
        const ok = esegui(modo === 'campo' ? `(function () {
            const c = Object.assign({}, cardDatabase.find((x) => x.id === ${id}), { uid: 'MOSTRO' });
            gameState.botMonsterField[2] = { card: c, position: 'attack', isFaceDown: false, hasAttacked: false, canChangePosition: true, summonedOnTurn: 1 };
            DuelEngine.recomputeStaticEffects();
            return DuelEngine.canActivate('bot', 'monster', 2);
        })()` : `(function () {
            const c = Object.assign({}, cardDatabase.find((x) => x.id === ${id}), { uid: 'MOSTRO' });
            gameState.botHand.push(c);
            DuelEngine.recomputeStaticEffects();
            return DuelEngine.canSpecialSummonFromHand('bot', gameState.botHand.length - 1);
        })()`);
        if (!ok) return null;
        const prima = esegui(FOTO);
        esegui(modo === 'campo'
            ? "Comandi.esegui('bot', { tipo: 'attiva', zona: 'monster', indice: 2 })"
            : "Comandi.esegui('bot', { tipo: 'specialeDaMano', carta: 'MOSTRO', mano: gameState.botHand.length - 1, posizione: 'attack' })");
        await fluisci(orologio, esegui);
        const dopo = esegui(FOTO);
        return confronta(prima, dopo, modo === 'mano');
    }
    for (const id of ids) {
        const c = nomi.get(id);
        const male = [];
        let attivabile = false;
        for (let vi = 0; vi < PARTITE.length; vi++) {
            let esito = null;
            try { esito = await prova(id, vi, 'campo'); } catch (e) { continue; }
            if (!esito) continue;
            attivabile = true;
            if (esito.buffNemico.length || esito.autolesione || esito.motivi.length) male.push(`${VARIANTI[vi].bot[0]}/${VARIANTI[vi].gio[0]}: ${[].concat(esito.buffNemico.map((x) => 'BUFF AL NEMICO ' + x), esito.motivi).join(' | ')}`);
        }
        if (attivabile) provati++;
        if (male.length) sospetti.push({ id, nome: c.name, testo: String(c.effect).slice(0, 120), motivi: male.slice(0, 2).join(' // ') });
    }
    // (b) Evocazioni Speciali dalla mano
    const inMano = PARTITE[0].esegui(`cardDatabase.filter((c) => c.type === 'monster' && !c.extraDeck).map((c) => c.id)`);
    for (const id of inMano) {
        const c = nomi.get(id);
        const male = [];
        let valida = false;
        for (let vi = 0; vi < PARTITE.length; vi++) {
            let esito = null;
            try { esito = await prova(id, vi, 'mano'); } catch (e) { continue; }
            if (!esito) continue;
            valida = true;
            // Una Evocazione Speciale aggiunge un mostro: qui interessa solo se il bot ci rimette (costo > mostro).
            if (esito.autolesione || esito.motivi.some((x) => /perde piu|paga|scarta/.test(x))) male.push(`${VARIANTI[vi].bot[0]}/${VARIANTI[vi].gio[0]}: ${esito.motivi.join(' | ')}`);
        }
        if (valida) speciali.provate++;
        if (male.length) speciali.sospette.push({ id, nome: c.name, testo: String(c.effect).slice(0, 120), motivi: male.slice(0, 2).join(' // ') });
    }
    return { provati, sospetti, speciali };
}

async function main() {
    const { contesto: _unused } = { contesto: null };
    const base = nuovaPartita(7);
    const ids = base.esegui(`cardDatabase.filter((c) => (c.type === 'spell' || c.type === 'trap') && DuelEngine.getDefinition(c.id)).map((c) => c.id)`)
        .filter((id) => !SOLO_ID || id === SOLO_ID);
    // Le carte citate dal testo di una carta: fra virgolette, oppure (rituali: "per Special Summon Glorioso Soldato Nero")
    // il nome di mostro piu' lungo che compare nel testo.
    const tutte = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'cards.json'), 'utf8'));
    const perNome = new Map(tutte.map((c) => [c.name, c]));
    const perId = new Map(tutte.map((c) => [c.id, c]));
    const nomiMostri = tutte.filter((c) => c.type === 'monster' && c.name.length >= 8).sort((a, b) => b.name.length - a.name.length);
    const citateDa = (id) => {
        const testo = String((tutte.find((c) => c.id === id) || {}).effect || '');
        const ids = new Set();
        for (const m of testo.matchAll(/"([^"]+)"/g)) {
            const c = perNome.get(m[1]);
            if (c) { ids.add(c.id); continue; }
            // un nome parziale ("Toon", "Amazzone", "LV", "Ingranaggio Antico"): qualche mostro che lo contiene
            tutte.filter((x) => x.type === 'monster' && !x.extraDeck && x.name.includes(m[1])).slice(0, 2).forEach((x) => ids.add(x.id));
        }
        const lungo = nomiMostri.find((c) => testo.includes(c.name));
        if (lungo) ids.add(lungo.id);
        return [...ids].slice(0, 4);
    };
    // Carte che chiedono una composizione precisa: id -> id da mettere nel Cimitero del bot.
    const exodia = base.esegui('EXODIA_PIECE_IDS');
    const SETUP_PER_ID = { 161: [...exodia] };
    const nomiAll = perId; // per id: serve alla lista dei falsi sospetti piu' sotto
    const PARTITE = VARIANTI.map((v, i) => nuovaPartita(100 + i));
    const sospetti = [];
    const vetate = new Set();
    const mai = []; // carte mai attivabili sui campi di prova: il tool non le ha viste in azione
    let provate = 0, nonAttivabili = 0, errori = 0;
    // Le varianti di UNA carta: quelle fisse, piu' (se il testo cita razze/attributi) campi costruiti apposta con quelle
    // razze/attributi, cosi' i filtri "mostro Roccia", "mostro di ATTRIBUTO LUCE" trovano davvero qualcosa.
    const RAZZE = ['Bestia Alata', 'Bestia-Guerriero', 'Guerriero Bestia', 'Serpente Marino', 'Serpente di Mare', 'Essere Divino', 'Guerriero', 'Bestia', 'Drago', 'Incantatore', 'Zombie', 'Macchina', 'Pesce', 'Demone', 'Roccia', 'Insetto', 'Tuono', 'Pianta', 'Fata', 'Dinosauro', 'Rettile', 'Acquatico', 'Piroico', 'Stregone'];
    const ATTRIBUTI = ['LUCE', 'OSCURITÀ', 'TERRA', 'VENTO', 'FUOCO', 'ACQUA'];
    const variantiDinamiche = (id) => {
        const testo = String((perId.get(id) || {}).effect || '');
        const razze = []; let resto = testo;
        RAZZE.forEach((r) => { if (new RegExp('\\b' + r + '\\b', 'i').test(resto)) { razze.push(r); resto = resto.replace(new RegExp('\\b' + r + '\\b', 'ig'), ' '); } });
        const attr = ATTRIBUTI.filter((a) => testo.includes(a));
        if (!razze.length && !attr.length) return [];
        const r = razze[0] || 'Guerriero', a = attr[0] || 'TERRA';
        return [
            { bot: [r, a], gio: ['Bestia', 'TERRA'], ricco: true, pieno: true, dinamica: true },
            { bot: ['Guerriero', 'TERRA'], gio: [r, a], ricco: true, pieno: true, dinamica: true },
            { bot: [r, a], gio: [r, a], ricco: true, pieno: true, lp: [8000, 3000], dinamica: true },
            { bot: [razze[1] || r, attr[1] || a], gio: [r, a], ricco: true, pieno: true, lp: [3000, 8000], dinamica: true }
        ];
    };
    for (const id of ids) {
        const risultati = [];
        const elencoVarianti = VARIANTI.map((v, i) => ({ v, i })).concat(argv.includes('--senza-dinamiche') ? [] : variantiDinamiche(id).map((v) => ({ v, i: 0 })));
        for (const { v: variante, i: vi } of elencoVarianti) {
            const { esegui, orologio } = PARTITE[vi];
            // Una partita per variante, riusata: si riparte da zero con resetGameState e svuotando i timer rimasti.
            while (orologio.inCoda > 0 && orologio.passo()) { /* svuota */ }
            esegui('resetGameState(); Tavolo.imposta({ player: "ia", bot: "ia" }); gameState.livelloIA = { player: "hard", bot: "hard" };');
            preparaCampo(esegui, SETUP_PER_ID[id] ? Object.assign({}, variante, { setup: SETUP_PER_ID[id] }) : variante, citateDa(id));
            const tipo = esegui(`cardDatabase.find((c) => c.id === ${id}).type`);
            const ok = esegui(`(function () {
                const c = Object.assign({}, cardDatabase.find((x) => x.id === ${id}), { uid: 'CARTA' });
                if (c.type === 'trap') { gameState.botSTField[0] = { card: c, isFaceDown: true, setOnTurn: 1 }; return DuelEngine.canActivate('bot', 'st', 0); }
                gameState.botHand.push(c); return DuelEngine.canActivate('bot', 'hand', gameState.botHand.length - 1);
            })()`);
            if (!ok) continue;
            // Lo stesso filtro che l'IA applica prima di attivare (veto della carta, prova delle Magie Terreno):
            // una carta vetata non verra' mai giocata dal bot, quindi non e' un sospetto.
            const vetata = !esegui(`(function () {
                const c = ${tipo === 'trap' ? 'gameState.botSTField[0].card' : 'gameState.botHand[gameState.botHand.length - 1]'};
                return AI_SHARED.attivazioneSensata(c, 'bot', '${tipo === 'trap' ? 'st' : 'hand'}', ${tipo === 'trap' ? 0 : 'gameState.botHand.length - 1'});
            })()`);
            if (vetata) { vetate.add(id); continue; }
            const prima = esegui(FOTO);
            let partita = false;
            try {
                partita = esegui(`Comandi.esegui('bot', ${tipo === 'trap' ? "{ tipo: 'attiva', zona: 'st', indice: 0 }" : "{ tipo: 'attiva', zona: 'hand', indice: gameState.botHand.length - 1, carta: 'CARTA' }"})`);
                // fa scorrere il tempo virtuale finche' la Catena e le scelte automatiche hanno finito
                // (le scelte automatiche usano microtask: si cede il controllo fra un timer e l'altro)
                const respiro = () => new Promise((r) => setImmediate(r));
                for (let giri = 0, vuoti = 0; giri < 800 && vuoti < 3; giri++) {
                    await respiro();
                    if (orologio.inCoda > 0) { orologio.passo(); vuoti = 0; }
                    else if (esegui('DuelEngine.isChainActive()')) vuoti = 0;
                    else vuoti++;
                }
                esegui('DuelEngine.recomputeStaticEffects && DuelEngine.recomputeStaticEffects()'); // ricalcola i bonus continui
            } catch (e) { errori++; risultati.push({ variante: variante.bot[0], errore: String(e.message || e).slice(0, 120) }); continue; }
            const dopo = esegui(FOTO);
            const esito = confronta(prima, dopo, tipo !== 'trap');
            if (!partita) continue;
            risultati.push({ variante: variante.bot[0] + '/' + variante.gio[0], esito, prima, dopo });
        }
        if (!risultati.length) { nonAttivabili++; if (!vetate.has(id)) mai.push(id); continue; }
        provate++;
        // Falsi sospetti gia' valutati a mano: 440 (Scudo e Spada) scambia ATK/DEF di TUTTI e il filtro dell'IA la
        // lascia passare solo se i mostri propri ci guadagnano molto piu' in ATK del nemico (che la DEF salga e'
        // il contrario del problema: conta chi attacca meglio dopo lo scambio).
        if (id === 440) continue;
        // Altri falsi sospetti valutati: il vantaggio c'e' ma non si misura sul campo di prova.
        //  80  Battito d'Ali: distrugge le Magie/Trappole avversarie (il filtro dell'IA vuole 2 in piu' di quelle del bot);
        //  356 Ninna Nanna / 460 Dado di Evocazione / 559 Ultima Offerta: pagano LP per un vantaggio di carte (il filtro
        //      dell'IA non le fa pagare se restano meno di 2000 LP).
        //  788 Terreno di Caccia delle Arpie: Magia Terreno simmetrica, il filtro dell'IA la lascia passare solo se il bot
        //      ne guadagna piu' del nemico (guadagnoRelativoCampo); il "buff al nemico" segnalato e' la parte simmetrica.
        //  810 Pillola dell'Evoluzione Gigante: sacrifica un Dinosauro per Evocare senza Tributi un Dinosauro di Livello 5+
        //      (il filtro dell'IA pretende che ce ne sia uno in mano); l'Evocazione non avviene dentro questa misura.
        //  794 Arte della Trasformazione Ninjitsu: scambia un Ninja con un mostro di ATK >= +500 (veto dell'IA); la misura
        //      conta anche la DEF, che nello scambio puo' calare di poco.
        if ([80, 356, 460, 559, 788, 794, 810].includes(id)) continue;
        //  i Rituali: la nuova Evocazione viene dalla mano e il tool la conta come "carta scartata"; i Livelli sacrificati
        //      sono quelli della combinazione piu' economica (performRitualTribute), provato nel test della combinazione;
        //  1258 Servitore dell'Anima: rimette una carta in cima al Deck, non un costo.
        if ((nomiAll.get(id) || {}).subtype === 'ritual' || id === 1258) continue;
        const male = risultati.filter((r) => r.errore || r.esito.buffNemico.length || r.esito.autolesione || r.esito.motivi.length);
        if (male.length) sospetti.push({ id, risultati: male });
    }
    const nomi = new Map(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'cards.json'), 'utf8')).map((c) => [c.id, c]));
    console.log(`Carte provate: ${provate} (non attivabili sui campi di prova: ${nonAttivabili}, errori: ${errori}). Vetate dall'IA: ${[...vetate].join(', ') || 'nessuna'}. Sospette: ${sospetti.length}\n`);
    sospetti.forEach((s) => {
        const c = nomi.get(s.id);
        console.log(`#${s.id} ${c.name} [${c.type}/${c.subtype || ''}] — ${String(c.effect).slice(0, 130)}`);
        s.risultati.slice(0, 2).forEach((r) => {
            if (r.errore) console.log('   ERRORE', r.errore);
            else console.log(`   ${r.variante}: ${[].concat(r.esito.buffNemico.map((x) => 'BUFF AL NEMICO ' + x), r.esito.motivi).join(' | ')}`);
        });
    });
    if (argv.includes('--mostri')) {
        const m = await passoMostri(PARTITE, base.esegui(`cardDatabase.filter((c) => c.type === 'monster' && DuelEngine.getDefinition(c.id) && typeof DuelEngine.getDefinition(c.id).activate === 'function').map((c) => c.id)`), nomi);
        console.log(`\nMostri con abilita' attivabile: ${m.provati}. Sospetti: ${m.sospetti.length}`);
        m.sospetti.forEach((s) => console.log(`#${s.id} ${s.nome} — ${s.testo}\n   ${s.motivi}`));
        console.log(`Evocazioni Speciali dalla mano provate: ${m.speciali.provate}. Sospette: ${m.speciali.sospette.length}`);
        m.speciali.sospette.forEach((s) => console.log(`#${s.id} ${s.nome} — ${s.testo}\n   ${s.motivi}`));
    }
    if (argv.includes('--reattive')) {
        const trappole = ids.filter((id) => (nomi.get(id) || {}).type === 'trap');
        const peggiori = await passoReattive(PARTITE, trappole, nomi);
        console.log(`\nTrappole reattive provate: ${trappole.length}, attivate dal bot in almeno uno scenario: ${peggiori.usate.length} (${peggiori.usate.join(', ')}). Risposte che peggiorano la posizione del bot: ${peggiori.length}`);
        if (argv.includes('--non-scattate')) {
            console.log('Trappole che nessuno scenario ha fatto scattare:');
            const scoperte = trappole.filter((id) => !peggiori.usate.includes(id) && mai.includes(id));
            console.log(`(di cui NEMMENO il passo proattivo le ha mai viste attivarsi: ${scoperte.length})`);
            trappole.filter((id) => !peggiori.usate.includes(id)).forEach((id) => { const c = nomi.get(id); console.log(`${mai.includes(id) ? '!!' : '  '} #${id} ${c.name} [${c.subtype || ''}] ${String(c.effect).slice(0, 150)}`); });
        }
        // 276 Predatore delle Tombe: costa 2000 danni ma il bot (con piu' di 6000 LP e una Magia forte nel Cimitero del
        // giocatore) ci guadagna una Magia: il campo di prova non la rende utile, quindi sembra solo un costo.
        // 448 Giudizio Solenne / 599 Sette Attrezzi / 822 Malfunzionamento: annullano una carta che spazzerebbe via il
        // campo del bot (Soffio Incendiario, Obelisk). Il confronto conta anche i mostri del giocatore che si salvano
        // (l'annullamento li lascia vivi) e gli LP pagati: il campo del bot resta intero, e' il baratto voluto (rivisto a mano).
        peggiori.splice(0, peggiori.length, ...peggiori.filter((p) => ![276, 448, 599, 822].includes(p.id)));
        peggiori.forEach((p) => {
            const c = nomi.get(p.id);
            console.log(`#${p.id} ${c.name} — ${String(c.effect).slice(0, 120)}`);
            p.peggiori.slice(0, 3).forEach((r) => console.log('   ' + r));
        });
    }
    if (argv.includes('--mai')) {
        console.log(`\nMai attivabili sui campi di prova (${mai.length}):`);
        mai.forEach((id) => { const c = nomi.get(id); console.log(`#${id} ${c.name} [${c.type}/${c.subtype || ''}] ${String(c.effect).slice(0, 110)}`); });
    }
    if (val('json')) fs.writeFileSync(val('json'), JSON.stringify(sospetti, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
