#!/usr/bin/env node
/**
 * gemello-posti.js — il duello gemello con PIÙ di due motori, nel passo
 * comune "a posti" (js/engine/passo-comune.js, modalità a posti; piano:
 * docs/planning/PIANO_TAG_TEAM.md, fase 3).
 * =====================================================================
 * Come tools/duello-gemello.js, ma i "telefoni" sono N: ogni motore gira in
 * un suo contesto, ha un id di client e una squadra ('A' o 'B', la sua è
 * 'player'), e ciò che manda arriva a TUTTI gli altri, con una latenza a
 * caso ma sempre in ordine fra la stessa coppia mittente → destinatario
 * (come una connessione WebSocket attraverso il relay).
 *
 * Ogni client dichiara chi controlla, per posto del motore ('player'/'bot'):
 * 'ia' se un'IA gioca QUI quel posto, 'remoto' se lo gioca un altro client.
 * Le persone vere sono simulate dall'IA (naturaRemoto 'ia'). Un client che
 * non controlla nulla è uno SPETTATORE: segue la partita e basta.
 *
 * Un hook `prepara(lato)` (codice da eseguire in ogni contesto dopo
 * preparaDuello) serve alle varianti, per esempio le squadre del Tag Team.
 *
 * Uso da riga di comando (1 contro 1 con uno spettatore):
 *   node tools/gemello-posti.js [--a yamiYugi] [--b kaiba] [--livello hard]
 *        [--seme 42] [--partite 1] [--turni 60]
 */
'use strict';

const vm = require('vm');
const path = require('path');
const { creaContesto, creaOrologio, prng } = require(path.join(__dirname, 'duello-senza-testa.js'));

/**
 * @param {object} opz
 * @param {number} opz.seme
 * @param {number} [opz.turni]
 * @param {Record<string, { personaggio: string, livello: string }>} opz.squadre  A e B: chi gioca il primo membro
 * @param {Array<{ id: string, squadra: string, controlla: Record<string, string>, livelli?: Record<string, string> }>} opz.client
 * @param {string} [opz.iniziaSquadra]  'A' (predefinito) o 'B'
 * @param {(lato: any) => string} [opz.prepara]  codice per ogni contesto, dopo preparaDuello
 * @param {string[]} [opz.scriptAggiuntivi]
 * @param {boolean} [opz.log]
 * @param {number} n
 */
async function giocaGemelloPosti(opz, n) {
    const seme = opz.seme + n;
    const orologio = creaOrologio();
    const lati = opz.client.map((c, i) => Object.assign({}, c, creaContesto({
        // L'avversario "di pagina" non conta qui: i mazzi li costruisce preparaDuello.
        avversario: opz.squadre.B.personaggio, livello: opz.squadre.B.livello,
        seme: seme * 7 + i + 1, orologio, log: opz.log, scriptAggiuntivi: opz.scriptAggiuntivi
    })));
    const esegui = (lato, codice) => vm.runInContext(codice, lato.contesto);

    // La rete: da ogni client a ogni altro, ordinata per coppia.
    const latenza = prng(seme * 13 + 5);
    let inVolo = 0;
    const ultimoArrivo = new Map();
    lati.forEach((lato) => {
        lato.contesto.__spedisciATutti = (testo) => {
            lati.forEach((altro) => {
                if (altro === lato) return;
                inVolo++;
                const chiave = lato.id + '>' + altro.id;
                const arrivo = Math.max(ultimoArrivo.get(chiave) || 0, orologio.ora + 20 + Math.floor(latenza() * 280));
                ultimoArrivo.set(chiave, arrivo);
                orologio.setTimeout(() => {
                    inVolo--;
                    esegui(altro, `PassoComune.ricevi(${testo})`);
                }, arrivo - orologio.ora);
            });
        };
    });

    const mazzo = (s) => `getCharacterDeck(${JSON.stringify(s.personaggio)}, ${JSON.stringify(s.livello)})`;
    lati.forEach((lato) => {
        const altra = lato.squadra === 'A' ? 'B' : 'A';
        esegui(lato, `
            resetGameState();
            Tavolo.imposta(${JSON.stringify(lato.controlla)});
            Tavolo.impostaNaturaRemoto('ia');
            gameState.livelloIA = ${JSON.stringify(lato.livelli || { player: opz.squadre[lato.squadra].livello, bot: opz.squadre[altra].livello })};
            gameState.personaggioPerPosto = { player: ${JSON.stringify(opz.squadre[lato.squadra].personaggio)}, bot: ${JSON.stringify(opz.squadre[altra].personaggio)} };
            PassoComune.avvia({ invia: (m) => __spedisciATutti(JSON.stringify(m)), improntaCompleta: true, posti: { mioClient: ${JSON.stringify(lato.id)}, miaSquadra: ${JSON.stringify(lato.squadra)} } });
            var __improntaFinale = null;
            EventiDuello.ascolta('fine-duello', () => { if (__improntaFinale === null) __improntaFinale = PassoComune.impronta(); });
            PassoComune.preparaDuello({
                seme: ${seme},
                squadre: { A: { spec: ${mazzo(opz.squadre.A)} }, B: { spec: ${mazzo(opz.squadre.B)} } },
                iniziaSquadra: ${JSON.stringify(opz.iniziaSquadra || 'A')}
            });
        `);
        if (opz.prepara) esegui(lato, opz.prepara(lato));
    });

    // Il primo turno: lo guida il client che controlla (con un'IA) il posto di turno;
    // per tutti gli altri le fasi del posto remoto avanzano da sole.
    lati.forEach((lato) => {
        const diTurno = esegui(lato, 'gameState.currentPlayer');
        if (esegui(lato, `Tavolo.eIA(${JSON.stringify(diTurno)})`)) esegui(lato, `turnoIA(${JSON.stringify(diTurno)});`);
        else esegui(lato, 'enterDrawPhase(true);');
    });

    const finito = (lato) => esegui(lato, '!!gameState.gameOver || __esitoDuello !== null');
    let passi = 0;
    let motivoStop = null;
    const LIMITE_TURNI = opz.turni || 60;
    while (passi < 600000) {
        passi++;
        if (lati.every(finito) && inVolo === 0) { motivoStop = 'fine'; break; }
        if (esegui(lati[0], 'gameState.turn') > LIMITE_TURNI) { motivoStop = 'limite'; break; }
        if (lati.some((l) => l.erroriCarte.some((e) => e.includes('PassoComune: lo stato di qua')))) { motivoStop = 'divergenza'; break; }
        await new Promise((r) => setImmediate(r));
        if (!orologio.passo()) {
            await new Promise((r) => setImmediate(r));
            if (orologio.inCoda === 0) { motivoStop = 'coda vuota'; break; }
        }
        if (orologio.ora > 4 * 3600 * 1000) { motivoStop = 'tempo virtuale esaurito'; break; }
    }

    const foto = (lato) => esegui(lato, `({
        impronta: __improntaFinale !== null ? __improntaFinale : PassoComune.impronta(),
        passo: PassoComune.stato(),
        nonFermo: PassoComune.motivoNonFermo(),
        esito: __esitoDuello, turno: gameState.turn, fase: gameState.phase, diTurno: gameState.currentPlayer,
        lp: [gameState.playerLP, gameState.botLP],
        log: __logDuello.slice(-10)
    })`);
    const fotografie = lati.map(foto);
    // L'esito visto da ogni client: vince la squadra A se vince il 'player' di un client della squadra A.
    const vinceA = fotografie.map((f, i) => (f.esito === null || f.esito === undefined ? null
        : (f.esito === 'draw' ? 'draw' : (lati[i].squadra === 'A' ? f.esito : !f.esito))));
    const esitiCoerenti = vinceA.every((v) => v === vinceA[0]);
    const finaliUguali = fotografie.every((f) => f.impronta === fotografie[0].impronta);
    const divergenze = lati.flatMap((l) => l.erroriCarte.filter((e) => e.includes('PassoComune')).map((e) => `${l.id}: ${e}`));
    const altriErrori = lati.flatMap((l) => l.erroriCarte.filter((e) => !e.includes('PassoComune')).map((e) => `${l.id}: ${e}`));
    const buona = motivoStop !== 'divergenza' && divergenze.length === 0 && altriErrori.length === 0
        && esitiCoerenti && (motivoStop === 'limite' || finaliUguali) && (motivoStop === 'fine' || motivoStop === 'limite');
    return { seme, passi, ora: orologio.ora, motivoStop, buona, vinceA: vinceA[0], esitiCoerenti, finaliUguali, divergenze, altriErrori, fotografie, lati: lati.map((l) => l.id) };
}

/** Il primo pezzo in cui due impronte differiscono. */
function differenza(a, b) {
    const x = a.split(' ## ');
    const y = b.split(' ## ');
    const i = x.findIndex((v, k) => v !== y[k]);
    return i === -1 ? '' : `«${x[i]}» / «${y[i]}»`;
}

/** Riassunto leggibile di una partita (per la riga di comando e gli spec). */
function descrivi(r) {
    const righe = [`seme ${r.seme}: ${r.buona ? 'ALLINEATA' : 'PROBLEMA'} — ${r.motivoStop}, vince ${r.vinceA === true ? 'A' : r.vinceA === false ? 'B' : r.vinceA}, turno ${r.fotografie[0].turno} — ${r.passi} passi`];
    if (r.buona) return righe.join('\n');
    r.divergenze.slice(0, 3).forEach((d) => righe.push('  ' + d));
    r.altriErrori.slice(0, 5).forEach((d) => righe.push('  errore ' + d));
    if (!r.esitiCoerenti) righe.push('  esiti incoerenti fra i client');
    if (!r.finaliUguali) righe.push('  stato finale diverso: ' + differenza(r.fotografie[0].impronta, r.fotografie.find((f) => f.impronta !== r.fotografie[0].impronta).impronta));
    r.fotografie.forEach((f, i) => {
        righe.push(`  ${r.lati[i]}: turno ${f.turno} fase ${f.fase} di turno ${f.diTurno}, non fermo: ${f.nonFermo}, ${JSON.stringify(f.passo)}`);
        righe.push(`    ${f.log.join('\n    ')}`);
    });
    return righe.join('\n');
}

/** 1 contro 1 con uno spettatore: A0 e B0 su due client, il terzo segue. */
function unoControUnoConSpettatore(a, b, livello) {
    return {
        squadre: { A: { personaggio: a, livello }, B: { personaggio: b, livello } },
        client: [
            { id: 'h', squadra: 'A', controlla: { player: 'ia', bot: 'remoto' } },
            { id: 'o', squadra: 'B', controlla: { player: 'ia', bot: 'remoto' } },
            { id: 's', squadra: 'A', controlla: { player: 'remoto', bot: 'remoto' } }
        ]
    };
}

async function main() {
    const a = process.argv.slice(2);
    const val = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 && a[i + 1] ? a[i + 1] : d; };
    const base = unoControUnoConSpettatore(val('a', 'yamiYugi'), val('b', 'kaiba'), val('livello', 'hard'));
    const opz = Object.assign(base, { seme: Number(val('seme', '42')), turni: Number(val('turni', '60')) });
    let ok = true;
    for (let n = 0; n < Number(val('partite', '1')); n++) {
        const r = await giocaGemelloPosti(opz, n);
        if (!r.buona) ok = false;
        console.log(descrivi(r));
    }
    process.exit(ok ? 0 : 1);
}

if (require.main === module) main();
module.exports = { giocaGemelloPosti, descrivi, unoControUnoConSpettatore };
