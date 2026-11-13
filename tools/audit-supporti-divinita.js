#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { giocaPartita } = require('./duello-senza-testa.js');

const ROOT = path.join(__dirname, '..');
const AVVERSARI = ['yamiYugi', 'joey', 'kaiba', 'mako', 'bakura'];
const CONFIG = [
    { personaggio: 'strings', supporto: 1271, dio: 31, tagli: [6, 38, 35] },
    // Rituale e Paladino del Drago Bianco non sono più nella baseline Kaiba:
    // sostituiamo utility periferiche realmente presenti, preservando il nucleo.
    { personaggio: 'kaiba', supporto: 1272, dio: 30, tagli: [454, 198, 607] },
    { personaggio: 'marik', supporto: 1273, dio: 472, tagli: [646, 439, 434] }
];

function arg(name, fallback) {
    const index = process.argv.indexOf('--' + name);
    return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function characterDeck(character) {
    const source = fs.readFileSync(path.join(ROOT, 'js/data/character-decks.js'), 'utf8');
    const deck = JSON.parse(vm.runInNewContext(`${source}\nJSON.stringify(getCharacterDeck('${character}', 'hard'));`, {}));
    // Per Marik ricostruisce la baseline storica precedente alla promozione
    // di Canto Antico, mantenendo riproducibile l'audit originale 1/2/3.
    if (character === 'marik') {
        const canto = deck.main.find((c) => Number(c.id) === 1273);
        if (canto) deck.main.splice(deck.main.indexOf(canto), 1, { id: 646, qty: 1 });
    }
    return deck;
}

function replaceCards(base, config, copies) {
    const deck = JSON.parse(JSON.stringify(base));
    for (let index = 0; index < copies; index++) {
        const cut = config.tagli[index];
        const entry = deck.main.find((candidate) => candidate.id === cut && candidate.qty > 0);
        if (!entry) throw new Error(`Taglio ${cut} non disponibile nel deck ${config.personaggio} Hard.`);
        entry.qty--;
        if (entry.qty === 0) deck.main.splice(deck.main.indexOf(entry), 1);
        const support = deck.main.find((candidate) => candidate.id === config.supporto);
        if (support) support.qty++;
        else deck.main.push({ id: config.supporto, qty: 1 });
    }
    return deck;
}

function pct(value, total) { return total ? Number((value * 100 / total).toFixed(1)) : 0; }
function average(values) { return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)); }

async function main() {
    const games = Math.max(1, Number(arg('partite', '50')) || 50);
    const seed = Number(arg('seme', '153000')) || 153000;
    const output = arg('output', 'reports/archetypes/EGYPTIAN_GODS_SUPPORT_1_2_3.json');
    const results = [];

    for (const config of CONFIG) {
        const base = characterDeck(config.personaggio);
        for (let copies = 0; copies <= 3; copies++) {
            const deck = replaceCards(base, config, copies);
            const outcomes = [];
            for (let opponentIndex = 0; opponentIndex < AVVERSARI.length; opponentIndex++) {
                for (let i = 0; i < games; i++) {
                    const result = await giocaPartita({
                        avversario: AVVERSARI[opponentIndex], livello: 'hard', livelloGiocatore: 'hard',
                        mazzoGiocatore: deck, seme: seed + opponentIndex * 10000 + i, turni: 80,
                        osservaPlayerIds: [config.dio, config.supporto]
                    }, 0);
                    if (result.erroriCarte.length || result.invarianti.length) {
                        throw new Error(`${config.personaggio}/x${copies}/${AVVERSARI[opponentIndex]}/${seed + i}: ${[...result.erroriCarte, ...result.invarianti].join(' | ')}`);
                    }
                    outcomes.push(result);
                }
            }
            const wins = outcomes.filter((result) => result.esito === true).length;
            const row = {
                personaggio: config.personaggio,
                supporto: config.supporto,
                copie: copies,
                partite: outcomes.length,
                vittoriePct: pct(wins, outcomes.length),
                turniMedi: average(outcomes.map((result) => result.turno || 0)),
                nonFinite: outcomes.filter((result) => result.esito !== true && result.esito !== false).length,
                dioVistoPct: pct(outcomes.filter((result) => (result.osservatiPlayerIds || []).includes(config.dio)).length, outcomes.length),
                supportoVistoPct: pct(outcomes.filter((result) => (result.osservatiPlayerIds || []).includes(config.supporto)).length, outcomes.length)
            };
            results.push(row);
            console.log(`${config.personaggio} ${config.supporto} x${copies}: ${row.vittoriePct}% vittorie, ${row.turniMedi} turni medi`);
        }
    }

    const report = {
        generatoIl: new Date().toISOString(),
        metodo: 'Deck Hard lore invariato come baseline; ogni supporto firma testato a 1/2/3 copie sostituendo utility periferiche; cinque avversari Hard e stessi semi',
        gamesPerOpponent: games,
        seed,
        opponents: AVVERSARI,
        config: CONFIG,
        results
    };
    const destination = path.resolve(ROOT, output);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(`Report scritto in ${destination}`);
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error); process.exit(1); });
module.exports = { characterDeck, replaceCards };
