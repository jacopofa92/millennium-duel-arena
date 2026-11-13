#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { giocaPartita } = require('./duello-senza-testa.js');
const { caricaCustom } = require('./audit-archetipi-classici.js');
const gods = require('./audit-supporti-divinita.js');

const RADICE = path.join(__dirname, '..');
const CAMPIONI = ['yamiYugi', 'joey', 'kaiba', 'pegasus', 'bakura'];
const OSSERVATI = [472, 1273, 1274, 1275, 1276];

function cambia(base, aggiunte) {
    const deck = JSON.parse(JSON.stringify(base));
    const tagli = [646, 439, 434, 25];
    let indiceTaglio = 0;
    aggiunte.forEach((id) => {
        // Il deck Hard pubblicato contiene già Incrocio di Anime (1274).
        // La variante completa lo conta una volta sola e taglia solo le
        // carte necessarie a inserire i supporti che mancavano davvero.
        if (deck.main.some((c) => Number(c.id) === id && c.qty > 0)) return;
        const taglio = tagli[indiceTaglio++];
        const voce = deck.main.find((c) => Number(c.id) === taglio && c.qty > 0);
        if (!voce) throw new Error(`Taglio Marik non disponibile: ${taglio}`);
        voce.qty--;
        if (!voce.qty) deck.main.splice(deck.main.indexOf(voce), 1);
        deck.main.push({ id, qty: 1 });
    });
    return deck;
}

function varianti() {
    const precedente = gods.characterDeck('marik');
    const pubblicato = cambia(precedente, [1273]);
    return {
        precedente,
        pubblicato,
        cicloRa: cambia(precedente, [1273, 1275, 1276]),
        cicloCompleto: cambia(precedente, [1273, 1274, 1275, 1276])
    };
}

function valore(argv, nome, fallback) {
    const i = argv.indexOf('--' + nome);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

function opzioniDa(argv) {
    return {
        partite: Math.max(1, Number(valore(argv, 'partite', '50')) || 50),
        turni: Math.max(20, Number(valore(argv, 'turni', '80')) || 80),
        seme: Number(valore(argv, 'seme', '221000')) || 221000,
        salvataggio: valore(argv, 'salvataggio', null),
        deckCustom: valore(argv, 'deck-custom', null),
        output: valore(argv, 'output', 'reports/archetypes/MARIK_RA_FINAL_AUDIT.json')
    };
}

const pct = (n, totale) => totale ? Number((n * 100 / totale).toFixed(1)) : 0;
const media = (v) => v.length ? Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)) : 0;

async function serie(base, opzioni, offset) {
    const risultati = [];
    for (let i = 0; i < opzioni.partite; i++) {
        const r = await giocaPartita(Object.assign({}, base, {
            seme: opzioni.seme + offset + i, turni: opzioni.turni,
            osservaPlayerIds: OSSERVATI
        }), 0);
        if (r.erroriCarte.length || r.invarianti.length) {
            throw new Error(`seme ${r.seme}: ${[...r.erroriCarte, ...r.invarianti].join(' | ')}`);
        }
        risultati.push(r);
    }
    return risultati;
}

function riepiloga(partite) {
    const vinte = partite.filter((p) => p.esito === true).length;
    return {
        partite: partite.length,
        vittorie: vinte,
        vittoriePct: pct(vinte, partite.length),
        turniMedi: media(partite.map((p) => p.turno)),
        nonFinite: partite.filter((p) => p.esito !== true && p.esito !== false).length,
        vistePct: Object.fromEntries(OSSERVATI.map((id) => [id,
            pct(partite.filter((p) => p.osservatiPlayerIds.includes(id)).length, partite.length)]))
    };
}

async function eseguiAudit(opzioni) {
    const custom = caricaCustom(opzioni);
    if (!custom) throw new Error('Serve --salvataggio oppure --deck-custom con il deck Custom.');
    const risultati = [];
    for (const [variante, deck] of Object.entries(varianti())) {
        process.stdout.write(`${variante}... `);
        const ufficiali = [];
        for (let c = 0; c < CAMPIONI.length; c++) {
            ufficiali.push(...await serie({
                avversario: CAMPIONI[c], livello: 'hard', livelloGiocatore: 'hard', mazzoGiocatore: deck
            }, opzioni, c * 10000));
        }
        const controCustom = await serie({
            avversario: 'marik', livello: 'hard', livelloGiocatore: 'hard', mazzoGiocatore: deck,
            mazzoAvversario: { main: custom.deck.main, extra: custom.deck.extra }
        }, opzioni, 90000);
        const riga = { variante, ufficiale: riepiloga(ufficiali), controCustom: riepiloga(controCustom) };
        risultati.push(riga);
        console.log(`ufficiali ${riga.ufficiale.vittoriePct}% | contro Custom ${riga.controCustom.vittoriePct}%`);
    }
    return {
        generatoIl: new Date().toISOString(),
        metodo: 'Marik Hard; stessi semi; 5 avversari ufficiali e Custom separato; Ra sempre a una copia',
        opzioni: { partite: opzioni.partite, turni: opzioni.turni, seme: opzioni.seme },
        custom: { name: custom.deck.name, impronta: custom.impronta },
        varianti: {
            pubblicato: [1273], cicloRa: [1273, 1275, 1276], cicloCompleto: [1273, 1274, 1275, 1276]
        },
        risultati
    };
}

async function main() {
    const opzioni = opzioniDa(process.argv.slice(2));
    const report = await eseguiAudit(opzioni);
    console.table(report.risultati.map((r) => ({
        variante: r.variante, ufficiali: r.ufficiale.vittoriePct,
        controCustom: r.controCustom.vittoriePct, ra: r.ufficiale.vistePct[472],
        canto: r.ufficiale.vistePct[1273], sfera: r.ufficiale.vistePct[1275], fenice: r.ufficiale.vistePct[1276]
    })));
    const destinazione = path.resolve(RADICE, opzioni.output);
    fs.mkdirSync(path.dirname(destinazione), { recursive: true });
    fs.writeFileSync(destinazione, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(`Report scritto in ${destinazione}`);
}

if (require.main === module) main().catch((e) => { console.error(e.stack || e); process.exit(1); });
module.exports = { cambia, varianti, opzioniDa, eseguiAudit };
