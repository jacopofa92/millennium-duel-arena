#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { giocaPartita } = require('./duello-senza-testa.js');

const ROOT = path.join(__dirname, '..');
const SUPPORTI_MAIN = [1261, 1262, 1263, 1264];
const SUPPORTI_EXTRA = [1265];
const SUPPORTI = SUPPORTI_MAIN.concat(SUPPORTI_EXTRA);
const AVVERSARI = ['yamiYugi', 'joey', 'pegasus', 'mako', 'bakura'];
// Si sostituiscono prima carte periferiche o ridondanti. Restano intatti i
// tre Draghi Bianchi, il pacchetto X/Y/Z, Obelisk, Signore/Flauto, Fusione e
// le carte firma principali. Paladino/Rituale non fanno piu' parte della
// baseline: l'audit Custom li ha identificati come pacchetto incoerente con
// le altre linee costose di Kaiba Hard.
// Il Mostro Trappola 312 non è più nella baseline Kaiba. Al suo posto
// usiamo Tifone (607), una carta utility presente nel deck attuale.
const TAGLI = [431, 335, 454, 198, 320, 69, 631, 607, 40, 793, 8, 272];

function arg(name, fallback) {
    const index = process.argv.indexOf('--' + name);
    return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function kaibaHard() {
    const source = fs.readFileSync(path.join(ROOT, 'js/data/character-decks.js'), 'utf8');
    const deck = JSON.parse(vm.runInNewContext(`${source}\nJSON.stringify(getCharacterDeck('kaiba', 'hard'));`, {}));
    // Questo strumento riproduce l'audit storico che ha portato alla scelta:
    // ricostruisce la baseline precedente alla promozione di Luce Autentica.
    const luce = deck.main.find((c) => Number(c.id) === 1263);
    if (luce) deck.main.splice(deck.main.indexOf(luce), 1, { id: 431, qty: 1 });
    return deck;
}

function sostituisci(base, additions, extraAdditions) {
    const deck = JSON.parse(JSON.stringify(base));
    additions.forEach((id, index) => {
        const cut = TAGLI[index];
        const entry = deck.main.find((e) => e.id === cut && e.qty > 0);
        if (!entry) throw new Error(`Taglio ${cut} non disponibile nel deck Kaiba Hard.`);
        entry.qty--;
        if (entry.qty === 0) deck.main.splice(deck.main.indexOf(entry), 1);
        const found = deck.main.find((e) => e.id === id);
        if (found) found.qty++;
        else deck.main.push({ id, qty: 1 });
    });
    (extraAdditions || []).forEach((id) => {
        const found = deck.extra.find((entry) => entry.id === id);
        if (found) found.qty++;
        else deck.extra.push({ id, qty: 1 });
    });
    return deck;
}

function varianti(base) {
    const rows = [{ nome: 'baseline', copie: 0, carte: [], deck: base }];
    SUPPORTI_MAIN.forEach((id) => {
        for (let copie = 1; copie <= 3; copie++) {
            const cards = Array(copie).fill(id);
            rows.push({ nome: `${id}x${copie}`, copie, carte: cards, deck: sostituisci(base, cards) });
        }
    });
    SUPPORTI_EXTRA.forEach((id) => {
        for (let copie = 1; copie <= 3; copie++) {
            const extra = Array(copie).fill(id);
            rows.push({ nome: `${id}x${copie}`, copie, carte: [], extra, deck: sostituisci(base, [], extra) });
        }
    });
    [
        { nome: 'pacchetto-leggero', main: [1261, 1262, 1263], extra: [] },
        { nome: 'pacchetto-doppio', main: [1261, 1261, 1262, 1262, 1263, 1263], extra: [] },
        { nome: 'pacchetto-consistenza', main: [1261, 1261, 1262, 1263], extra: [] },
        { nome: 'pacchetto-alternativo', main: [1261, 1261, 1262, 1262, 1263], extra: [] },
        { nome: 'completo-leggero', main: [1261, 1262, 1263, 1264], extra: [1265] },
        { nome: 'completo-luce', main: [1261, 1262, 1263, 1263, 1264], extra: [1265] },
        { nome: 'completo-doppio', main: [1261, 1261, 1262, 1262, 1263, 1263, 1264, 1264], extra: [1265] }
    ].forEach((v) => rows.push({
        nome: v.nome, copie: null, carte: v.main, extra: v.extra,
        deck: sostituisci(base, v.main, v.extra)
    }));
    return rows;
}

function pct(value, total) { return total ? Number((value * 100 / total).toFixed(1)) : 0; }
function average(values) { return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)); }

async function main() {
    const games = Math.max(1, Number(arg('partite', '50')) || 50);
    const seed = Number(arg('seme', '146000')) || 146000;
    const output = arg('output', 'reports/archetypes/BLUE_EYES_SUPPORT_COMPLETE.json');
    const only = arg('solo', '').split(',').map((x) => x.trim()).filter(Boolean);
    const selected = varianti(kaibaHard()).filter((variant) => only.length === 0 || only.includes(variant.nome));
    const results = [];
    for (const variant of selected) {
        const outcomes = [];
        for (let opponentIndex = 0; opponentIndex < AVVERSARI.length; opponentIndex++) {
            for (let i = 0; i < games; i++) {
                const result = await giocaPartita({
                    avversario: AVVERSARI[opponentIndex], livello: 'hard', livelloGiocatore: 'hard',
                    mazzoGiocatore: variant.deck, seme: seed + opponentIndex * 10000 + i, turni: 80,
                    osservaPlayerIds: SUPPORTI
                }, 0);
                if (result.erroriCarte.length || result.invarianti.length) {
                    throw new Error(`${variant.nome}/${AVVERSARI[opponentIndex]}/${seed + i}: ${[...result.erroriCarte, ...result.invarianti].join(' | ')}`);
                }
                outcomes.push(result);
            }
        }
        const wins = outcomes.filter((r) => r.esito === true).length;
        const row = {
            variante: variant.nome, copie: variant.copie, carteAggiunte: variant.carte,
            extraAggiunte: variant.extra || [],
            partite: outcomes.length, vittoriePct: pct(wins, outcomes.length),
            turniMedi: average(outcomes.map((r) => r.turno || 0)),
            nonFinite: outcomes.filter((r) => r.esito !== true && r.esito !== false).length,
            vistePct: Object.fromEntries(SUPPORTI.map((id) => [id,
                pct(outcomes.filter((r) => (r.osservatiPlayerIds || []).includes(id)).length, outcomes.length)]))
        };
        results.push(row);
        console.log(`${variant.nome}: ${row.vittoriePct}% vittorie, ${row.turniMedi} turni medi`);
    }
    const report = {
        generatoIl: new Date().toISOString(),
        metodo: 'Kaiba Hard IA contro cinque deck Hard; stessi semi; supporti sostituiscono carte periferiche senza modificare il nucleo anime',
        gamesPerOpponent: games, seed, opponents: AVVERSARI, supportIds: SUPPORTI, results
    };
    const destination = path.resolve(ROOT, output);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(`Report scritto in ${destination}`);
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exit(1); });
module.exports = { kaibaHard, sostituisci, varianti };
