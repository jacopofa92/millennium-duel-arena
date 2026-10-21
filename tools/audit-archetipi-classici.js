#!/usr/bin/env node
/**
 * Baseline dei personaggi coinvolti nei futuri supporti moderni.
 * Il campione ufficiale resta la metrica primaria. Un eventuale deck
 * personale "Custom" e' riportato separatamente e non guida da solo il
 * bilanciamento.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { giocaPartita } = require('./duello-senza-testa.js');

const RADICE = path.join(__dirname, '..');
const LIVELLI = ['easy', 'medium', 'hard'];
const CAMPIONI = ['yamiYugi', 'joey', 'pegasus', 'mako', 'bakura'];
const DUELLANTI_DEFAULT = ['joey', 'yamiYugi', 'kaiba', 'pegasus', 'strings', 'marik'];
const FIRME = {
    joey: [{ id: 12, nome: 'Drago Nero Occhi Rossi' }],
    yamiYugi: [{ id: 2, nome: 'Mago Nero' }, { id: 31, nome: 'Slifer' }],
    kaiba: [{ id: 1, nome: 'Drago Bianco Occhi Blu' }],
    pegasus: [{ id: 487, nome: 'Mondo Toon' }, { id: 416, nome: 'Abbandono' }, { id: 476, nome: 'Limite dei 1000 Occhi' }],
    strings: [{ id: 31, nome: 'Slifer' }],
    marik: [{ id: 472, nome: 'Drago Alato di Ra' }]
};

function valore(argv, nome, fallback) {
    const i = argv.indexOf('--' + nome);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

function opzioniDa(argv) {
    const espliciti = valore(argv, 'duellanti', '');
    const livelli = valore(argv, 'livelli', LIVELLI.join(','))
        .split(',').map((x) => x.trim().toLowerCase()).filter((x) => LIVELLI.includes(x));
    return {
        duellanti: espliciti ? espliciti.split(',').map((x) => x.trim()).filter(Boolean) : DUELLANTI_DEFAULT.slice(),
        livelli: livelli.length ? livelli : LIVELLI.slice(),
        partite: Math.max(1, Number(valore(argv, 'partite', '50')) || 50),
        turni: Math.max(20, Number(valore(argv, 'turni', '80')) || 80),
        seme: Number(valore(argv, 'seme', '141000')) || 141000,
        salvataggio: valore(argv, 'salvataggio', null),
        deckCustom: valore(argv, 'deck-custom', null),
        output: valore(argv, 'output', null)
    };
}

function normalizzaDeck(deck) {
    if (!deck || !Array.isArray(deck.main)) throw new Error('Il deck Custom non contiene un Main Deck valido.');
    return {
        id: deck.id || null,
        name: deck.name || deck.nome || 'Custom',
        main: deck.main.map((c) => ({ id: Number(c.id), qty: Math.max(1, Number(c.qty) || 1) })),
        extra: (deck.extra || []).map((c) => ({ id: Number(c.id), qty: Math.max(1, Number(c.qty) || 1) }))
    };
}

function caricaCustom(opzioni) {
    const file = opzioni.deckCustom || opzioni.salvataggio;
    if (!file) return null;
    const sorgente = path.resolve(file);
    const json = JSON.parse(fs.readFileSync(sorgente, 'utf8'));
    let deck = json;
    if (opzioni.salvataggio) {
        if (!Array.isArray(json.decks)) throw new Error('Il salvataggio esportato non contiene la lista dei deck.');
        deck = json.decks.find((d) => String(d.name || d.nome || '').trim().toLowerCase() === 'custom');
        if (!deck) throw new Error('Nel salvataggio non esiste un deck chiamato "Custom".');
    }
    const normalizzato = normalizzaDeck(deck);
    const copieMain = normalizzato.main.reduce((n, c) => n + c.qty, 0);
    if (copieMain < 40) throw new Error(`Il deck Custom contiene soltanto ${copieMain} carte nel Main Deck.`);
    return {
        sorgente,
        deck: normalizzato,
        impronta: crypto.createHash('sha256').update(JSON.stringify(normalizzato)).digest('hex').slice(0, 16)
    };
}

function media(numeri) {
    return numeri.length ? Number((numeri.reduce((a, b) => a + b, 0) / numeri.length).toFixed(2)) : 0;
}

function percentuale(parte, totale) {
    return totale ? Number((parte * 100 / totale).toFixed(1)) : 0;
}

function riassumi(esiti, vinceAvversario) {
    const vittorie = esiti.filter((e) => vinceAvversario ? e.esito === false : e.esito === true).length;
    return {
        partite: esiti.length, vittorie, vittoriePct: percentuale(vittorie, esiti.length),
        turniMedi: media(esiti.map((e) => e.turno || 0)),
        nonFinite: esiti.filter((e) => e.esito !== true && e.esito !== false).length
    };
}

async function giocaSerie(base, opzioni) {
    const esiti = [];
    for (let i = 0; i < opzioni.partite; i++) {
        const risultato = await giocaPartita(Object.assign({}, base, {
            seme: opzioni.seme + i, turni: opzioni.turni,
            osservaBotIds: (FIRME[base.avversario] || []).map((f) => f.id)
        }), 0);
        if (risultato.erroriCarte.length || risultato.invarianti.length) {
            throw new Error(`${base.avversario}/${base.livello}/seme ${opzioni.seme + i}: ${[...risultato.erroriCarte, ...risultato.invarianti].join(' | ')}`);
        }
        esiti.push(risultato);
    }
    return esiti;
}

async function eseguiAudit(opzioni) {
    const custom = caricaCustom(opzioni);
    const risultati = [];
    for (let d = 0; d < opzioni.duellanti.length; d++) {
        const duellante = opzioni.duellanti[d];
        // Compatibilita' con chiamanti precedenti all'opzione --livelli:
        // chi usa direttamente eseguiAudit continua a misurare tutti e tre.
        for (const livello of (opzioni.livelli || LIVELLI)) {
            process.stdout.write(`[${d + 1}/${opzioni.duellanti.length}] ${duellante}/${livello}... `);
            const ufficiali = [];
            for (let c = 0; c < CAMPIONI.length; c++) {
                ufficiali.push(...await giocaSerie({ avversario: duellante, livello, giocatore: CAMPIONI[c], livelloGiocatore: 'hard' },
                    Object.assign({}, opzioni, { seme: opzioni.seme + c * 10000 })));
            }
            const firma = Object.fromEntries((FIRME[duellante] || []).map((f) => [f.nome,
                percentuale(ufficiali.filter((e) => (e.osservatiBotIds || []).includes(f.id)).length, ufficiali.length)]));
            const riga = { duellante, livello, ufficiale: riassumi(ufficiali, true), firmaPartitePct: firma, custom: null };
            if (custom) {
                const serie = await giocaSerie({
                    avversario: duellante, livello, livelloGiocatore: 'hard',
                    mazzoGiocatore: { main: custom.deck.main, extra: custom.deck.extra }
                }, Object.assign({}, opzioni, { seme: opzioni.seme + 90000 }));
                riga.custom = { deckVittorie: riassumi(serie, false), avversarioVittorie: riassumi(serie, true) };
            }
            risultati.push(riga);
            console.log(`ufficiale ${riga.ufficiale.vittoriePct}%${riga.custom ? ` | Custom ${riga.custom.deckVittorie.vittoriePct}%` : ''}`);
        }
    }
    return {
        generatoIl: new Date().toISOString(),
        metodo: 'campione ufficiale primario; Custom separato e soltanto informativo; stessi semi ai tre livelli',
        opzioni: Object.assign({}, opzioni, {
            salvataggio: opzioni.salvataggio ? path.basename(opzioni.salvataggio) : null,
            deckCustom: opzioni.deckCustom ? path.basename(opzioni.deckCustom) : null
        }),
        campioni: CAMPIONI,
        custom: custom ? { name: custom.deck.name, main: custom.deck.main, extra: custom.deck.extra, impronta: custom.impronta } : null,
        risultati
    };
}

async function main() {
    const opzioni = opzioniDa(process.argv.slice(2));
    const report = await eseguiAudit(opzioni);
    console.table(report.risultati.map((r) => ({
        duellante: r.duellante, livello: r.livello,
        vittorieUfficiali: r.ufficiale.vittoriePct,
        vittorieCustom: r.custom ? r.custom.deckVittorie.vittoriePct : '-'
    })));
    if (opzioni.output) {
        const destinazione = path.resolve(RADICE, opzioni.output);
        fs.mkdirSync(path.dirname(destinazione), { recursive: true });
        fs.writeFileSync(destinazione, JSON.stringify(report, null, 2) + '\n', 'utf8');
        console.log(`Report scritto in ${destinazione}`);
    }
}

if (require.main === module) main().catch((e) => { console.error(e.stack || e); process.exit(1); });
module.exports = { opzioniDa, normalizzaDeck, caricaCustom, riassumi, eseguiAudit };
