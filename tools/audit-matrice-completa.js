#!/usr/bin/env node
/**
 * Matrice completa di bilanciamento: OGNI deck del giocatore contro OGNI duellante a OGNI difficolta'.
 * =====================================================================
 * Per ogni Starter Deck e Structure Deck di Yu-Gi-Oh (la Grande Guerra e' fuori: ha un'origine sua) piu' il deck "Custom" del
 * giocatore (la lista salvata dagli audit precedenti, vedi --deck-custom), si giocano `--partite` duelli (default 50) contro ogni
 * duellante a Facile, Medio e Difficile. Il deck del giocatore e' sempre pilotato dall'IA Difficile, come in tutti gli audit
 * precedenti (audit-duellanti-main.js, simula-storia-deck.js): cambia solo il livello dell'AVVERSARIO.
 *
 * I SEMI sono gli stessi ai tre livelli per la stessa coppia deck/duellante, condizione necessaria per confrontarli: la differenza
 * fra Facile, Medio e Difficile non puo' venire dal caso della mano iniziale.
 *
 * COSTO: ~55 ms a duello. 17 deck x 61 duellanti x 3 livelli x 50 = 155.550 duelli: ~2,4 ore su un processo, ~15 minuti con 12
 * processi in parallelo (--lavoratori). I risultati si scrivono man mano in un file .jsonl: con --riprendi un'esecuzione
 * interrotta ricomincia da dove era arrivata, senza rigiocare le coppie gia' fatte.
 *
 * Uso:
 *   node tools/audit-matrice-completa.js                          (tutto)
 *   node tools/audit-matrice-completa.js --partite 5 --duellanti kaiba,rex --lavoratori 4     (prova rapida)
 *   node tools/audit-matrice-completa.js --riprendi
 *   node tools/audit-matrice-completa.js --riassumi               (rifa' solo le tabelle dal file gia' scritto)
 * Opzioni: --deck <packId|custom>  --duellanti a,b,c  --partite N  --turni N  --seme N  --ia-giocatore hard
 *          --deck-custom <file.json con { custom: { main, extra } }>  --uscita <cartella>  --lavoratori N
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { fork } = require('child_process');

const RADICE = path.join(__dirname, '..');
const LIVELLI = ['easy', 'medium', 'hard'];

function arg(nome, fallback) {
    const i = process.argv.indexOf('--' + nome);
    return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}
const ha = (nome) => process.argv.includes('--' + nome);

function caricaGlobale(file, espressione) {
    const contesto = { window: {} };
    contesto.window = contesto;
    vm.createContext(contesto);
    vm.runInContext(fs.readFileSync(path.join(RADICE, file), 'utf8'), contesto, { filename: file });
    return vm.runInContext(espressione, contesto);
}

// ---------------------------------------------------------------------------
// Il LAVORATORE: gioca tutte le partite di UNA coppia deck/duellante ai tre livelli.
// ---------------------------------------------------------------------------
async function eseguiCoppia(t) {
    const { giocaPartita } = require('./duello-senza-testa.js');
    const celle = {};
    // Modalita' normale: le tre celle sono Facile/Medio/Difficile (mazzo e IA insieme, come nel gioco). Con --incrocia le celle sono
    // le NOVE combinazioni mazzo x IA (chiave "mazzo-IA"), per separare quanto della difficolta' viene dal mazzo e quanto dall'IA.
    const combinazioni = t.incrocia ? LIVELLI.flatMap((m) => LIVELLI.map((i) => ({ chiave: m + '-' + i, mazzo: m, ia: i })))
        : LIVELLI.map((l) => ({ chiave: l, mazzo: l, ia: l }));
    for (const comb of combinazioni) {
        const livello = comb.ia;
        const c = { vittorie: 0, sconfitte: 0, altro: 0, alLimite: 0, turni: 0, errori: 0, messaggi: [], ms: 0 };
        const inizio = Date.now();
        for (let p = 0; p < t.partite; p++) {
            let r;
            try {
                r = await giocaPartita({
                    avversario: t.duellante, livello, livelloDeckAvversario: comb.mazzo, livelloGiocatore: t.iaGiocatore,
                    mazzoGiocatore: t.deck, seme: t.seme + p, turni: t.turni
                }, 0);
            } catch (e) {
                c.errori++;
                if (c.messaggi.length < 3) c.messaggi.push('ECCEZIONE ' + String(e && e.message).slice(0, 160));
                continue;
            }
            if (r.esito === true) c.vittorie++;
            else if (r.esito === false) c.sconfitte++;
            else c.altro++;
            if (r.alLimite) c.alLimite++;
            c.turni += r.turno || 0;
            const problemi = [].concat(r.erroriCarte || [], r.invarianti || []);
            if (problemi.length) {
                c.errori++;
                const m = String(problemi[0]).slice(0, 160);
                if (c.messaggi.length < 3 && !c.messaggi.includes(m)) c.messaggi.push(m);
            }
        }
        c.ms = Date.now() - inizio;
        celle[comb.chiave] = c;
    }
    return celle;
}

// ---------------------------------------------------------------------------
// Il MASTER
// ---------------------------------------------------------------------------
function opzioni() {
    return {
        partite: Math.max(1, Number(arg('partite', '50')) || 50),
        turni: Math.max(20, Number(arg('turni', '80')) || 80),
        seme: Number(arg('seme', '310000')) || 310000,
        iaGiocatore: arg('ia-giocatore', 'hard'),
        lavoratori: Math.max(1, Number(arg('lavoratori', String(Math.max(1, Math.min(12, os.cpus().length - 4))))) || 8),
        deckCustom: arg('deck-custom', 'reports/archetypes/CLASSIC_ARCHETYPES_WITH_CUSTOM.json'),
        uscita: arg('uscita', 'reports/matrix'),
        soloDeck: arg('deck', null),
        incrocia: ha('incrocia'),
        soloDuellanti: arg('duellanti', null)
    };
}

function elencoDeck(o) {
    const decks = caricaGlobale('js/data/starter-structure-decks.js', 'starterStructureDeckDatabase')
        .filter((d) => (d.main || []).reduce((n, e) => n + (Number(e.qty) || 0), 0) >= 40)
        .filter((d) => !String(d.packId).includes('ww1'))
        .map((d) => ({ id: d.packId, tipo: d.kind, nome: d.name || d.packId, deck: { main: d.main || [], extra: d.extra || [] } }));
    const fileCustom = path.resolve(RADICE, o.deckCustom);
    if (fs.existsSync(fileCustom)) {
        const custom = JSON.parse(fs.readFileSync(fileCustom, 'utf8')).custom;
        if (custom && Array.isArray(custom.main)) {
            decks.push({ id: 'custom', tipo: 'custom', nome: 'Custom', deck: { main: custom.main, extra: custom.extra || [] }, impronta: custom.impronta });
        }
    } else {
        console.log(`(!) Deck Custom non trovato in ${o.deckCustom}: la matrice parte senza.`);
    }
    return o.soloDeck ? decks.filter((d) => o.soloDeck.split(',').map((x) => x.trim()).includes(d.id)) : decks;
}

function elencoDuellanti(o) {
    const tutti = caricaGlobale('js/data/character-decks.js', 'characterDeckDatabase');
    const ids = Object.keys(tutti).filter((id) => !tutti[id].congelato && tutti[id].easy && tutti[id].medium && tutti[id].hard);
    if (o.soloDuellanti) return o.soloDuellanti.split(',').map((x) => x.trim()).filter((x) => ids.includes(x));
    return ids;
}

function percentuale(parte, totale) { return totale ? Number((parte * 100 / totale).toFixed(1)) : 0; }
function media(v) { return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; }

async function principale() {
    const o = opzioni();
    const decks = elencoDeck(o);
    const duellanti = elencoDuellanti(o);
    if (!decks.length || !duellanti.length) throw new Error('Nessun deck o nessun duellante corrisponde ai filtri.');
    fs.mkdirSync(path.join(RADICE, o.uscita), { recursive: true });
    const file = path.join(RADICE, o.uscita, o.incrocia ? 'matrice-incrociata.jsonl' : 'matrice-completa.jsonl');

    const fatte = new Map();
    if (fs.existsSync(file) && ha('riprendi')) {
        fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).forEach((riga) => {
            try { const r = JSON.parse(riga); fatte.set(r.deck + '|' + r.duellante, r); } catch (e) { /* riga a meta': si ignora */ }
        });
    } else if (fs.existsSync(file)) {
        fs.unlinkSync(file);
    }

    const compiti = [];
    decks.forEach((d, indiceDeck) => duellanti.forEach((duellante, indiceDuellante) => {
        if (fatte.has(d.id + '|' + duellante)) return;
        compiti.push({ chiave: d.id + '|' + duellante, deckId: d.id, deck: d.deck, duellante, partite: o.partite, turni: o.turni,
            iaGiocatore: o.iaGiocatore, incrocia: o.incrocia,
            // Un blocco di semi per coppia, uguale ai tre livelli: indipendente dall'ordine in cui i compiti vengono eseguiti.
            seme: o.seme + indiceDeck * 1000000 + indiceDuellante * 1000 });
    }));

    const totaleCoppie = decks.length * duellanti.length;
    console.log(`Matrice: ${decks.length} deck x ${duellanti.length} duellanti x 3 livelli x ${o.partite} partite = ${totaleCoppie * 3 * o.partite} duelli.`);
    console.log(`Da giocare: ${compiti.length} coppie (${fatte.size} gia' fatte). Lavoratori: ${o.lavoratori}.`);

    const inizio = Date.now();
    let completati = 0;
    const falliti = [];
    await new Promise((risolvi) => {
        if (!compiti.length) { risolvi(); return; }
        let prossimo = 0, vivi = 0;
        const avvia = () => {
            const w = fork(__filename, ['--lavoratore'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
            vivi++;
            let corrente = null;
            const dai = () => {
                if (prossimo >= compiti.length) { w.kill(); return; }
                corrente = compiti[prossimo++];
                w.send(corrente);
            };
            w.on('message', (celle) => {
                const riga = { deck: corrente.deckId, duellante: corrente.duellante, celle };
                fs.appendFileSync(file, JSON.stringify(riga) + '\n');
                fatte.set(corrente.chiave, riga);
                completati++;
                if (completati % 25 === 0 || completati === compiti.length) {
                    const secondi = (Date.now() - inizio) / 1000;
                    const resto = secondi / completati * (compiti.length - completati);
                    console.log(`  ${completati}/${compiti.length} coppie, ${secondi.toFixed(0)} s trascorsi, ~${(resto / 60).toFixed(1)} min mancanti`);
                }
                corrente = null;
                dai();
            });
            w.on('exit', () => {
                vivi--;
                if (corrente) { falliti.push(corrente.chiave); corrente = null; }
                if (vivi === 0) risolvi();
            });
            dai();
        };
        for (let i = 0; i < Math.min(o.lavoratori, compiti.length); i++) avvia();
    });
    if (falliti.length) console.log(`(!) Coppie non completate (lavoratore caduto): ${falliti.join(', ')}`);
    console.log(`Fine: ${((Date.now() - inizio) / 60000).toFixed(1)} minuti.`);
    if (o.incrocia) riassumiIncrociata(o, decks, duellanti); else riassumi(o, decks, duellanti);
}

/** Tabella 3x3 per duellante: righe = livello del MAZZO avversario, colonne = livello dell'IA; valori = vittorie % del giocatore. */
function riassumiIncrociata(o, decks, duellanti) {
    const file = path.join(RADICE, o.uscita, 'matrice-incrociata.jsonl');
    const righe = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((r) => JSON.parse(r));
    const out = [];
    (duellanti || [...new Set(righe.map((r) => r.duellante))]).forEach((duellante) => {
        const mie = righe.filter((r) => r.duellante === duellante);
        const cella = {};
        LIVELLI.forEach((m) => LIVELLI.forEach((i) => {
            const v = mie.reduce((n, r) => n + r.celle[m + '-' + i].vittorie, 0);
            const tot = mie.reduce((n, r) => n + r.celle[m + '-' + i].vittorie + r.celle[m + '-' + i].sconfitte + r.celle[m + '-' + i].altro, 0);
            cella[m + '-' + i] = percentuale(v, tot);
        }));
        out.push({ duellante, cella });
        console.log('\n' + duellante + '   (righe: mazzo F/M/D, colonne: IA F/M/D)');
        LIVELLI.forEach((m) => console.log('   mazzo ' + m.padEnd(6) + LIVELLI.map((i) => String(cella[m + '-' + i]).padStart(7)).join('')));
    });
    fs.writeFileSync(path.join(RADICE, o.uscita, 'MATRICE_INCROCIATA.json'), JSON.stringify(out, null, 2));
}

// ---------------------------------------------------------------------------
// Le TABELLE
// ---------------------------------------------------------------------------
function riassumi(o, decksIn, duellantiIn) {
    const file = path.join(RADICE, o.uscita, 'matrice-completa.jsonl');
    const righe = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((r) => JSON.parse(r));
    const decks = decksIn || [...new Set(righe.map((r) => r.deck))].map((id) => ({ id, nome: id, tipo: '' }));
    const duellanti = duellantiIn || [...new Set(righe.map((r) => r.duellante))];
    const cella = (deck, duellante, livello) => {
        const r = righe.find((x) => x.deck === deck && x.duellante === duellante);
        return r ? r.celle[livello] : null;
    };
    const totali = (celle) => celle.reduce((t, c) => ({
        v: t.v + c.vittorie, s: t.s + c.sconfitte, a: t.a + c.altro, l: t.l + c.alLimite, e: t.e + c.errori, turni: t.turni + c.turni
    }), { v: 0, s: 0, a: 0, l: 0, e: 0, turni: 0 });
    const giocate = (t) => t.v + t.s + t.a;

    const perDuellante = duellanti.map((duellante) => {
        const riga = { duellante };
        LIVELLI.forEach((livello) => {
            const celle = decks.map((d) => cella(d.id, duellante, livello)).filter(Boolean);
            const t = totali(celle);
            const perDeck = celle.map((c) => percentuale(c.vittorie, c.vittorie + c.sconfitte + c.altro));
            riga[livello] = { giocatore: percentuale(t.v, giocate(t)), minimo: perDeck.length ? Math.min(...perDeck) : 0,
                massimo: perDeck.length ? Math.max(...perDeck) : 0, turni: giocate(t) ? Number((t.turni / giocate(t)).toFixed(1)) : 0, errori: t.e, limite: t.l };
        });
        // Il giocatore dovrebbe vincere piu' spesso a Facile che a Medio, e a Medio che a Difficile (tolleranza 2 punti).
        const f = riga.easy.giocatore, m = riga.medium.giocatore, d = riga.hard.giocatore;
        riga.progressione = f + 2 >= m && m + 2 >= d ? 'ok' : (f + 2 < m ? 'Facile piu\' duro di Medio' : 'Difficile piu\' facile di Medio');
        return riga;
    });
    const perDeck = decks.map((deck) => {
        const riga = { deck: deck.id, tipo: deck.tipo };
        LIVELLI.forEach((livello) => {
            const t = totali(duellanti.map((d) => cella(deck.id, d, livello)).filter(Boolean));
            riga[livello] = percentuale(t.v, giocate(t));
        });
        riga.media = Number(media(LIVELLI.map((l) => riga[l])).toFixed(1));
        return riga;
    });
    const errori = righe.flatMap((r) => LIVELLI.flatMap((l) => (r.celle[l].messaggi || []).map((m) => ({ deck: r.deck, duellante: r.duellante, livello: l, m }))));
    const stalli = righe.reduce((n, r) => n + LIVELLI.reduce((t, l) => t + r.celle[l].alLimite, 0), 0);
    const duelli = righe.reduce((n, r) => n + LIVELLI.reduce((t, l) => t + r.celle[l].vittorie + r.celle[l].sconfitte + r.celle[l].altro, 0), 0);

    const globale = LIVELLI.map((l) => {
        const t = totali(righe.map((r) => r.celle[l]));
        return { livello: l, giocatore: percentuale(t.v, giocate(t)), duelli: giocate(t) };
    });

    const risultato = { generato: new Date().toISOString(), opzioni: { partite: o.partite, turni: o.turni, seme: o.seme, iaGiocatore: o.iaGiocatore },
        duelli, stalliAlLimite: stalli, globale, perDuellante, perDeck, errori: errori.slice(0, 50) };
    fs.writeFileSync(path.join(RADICE, o.uscita, 'MATRICE_COMPLETA.json'), JSON.stringify(risultato, null, 2));

    console.log('\n=== GLOBALE (vittorie del GIOCATORE, tutti i deck x tutti i duellanti)');
    globale.forEach((g) => console.log(`  ${g.livello.padEnd(6)} ${String(g.giocatore).padStart(5)}%  (${g.duelli} duelli)`));
    console.log(`  Duelli totali: ${duelli}, al limite di turni: ${stalli}, partite con errori: ${errori.length}`);
    console.log('\n=== PER DECK DEL GIOCATORE (vittorie % contro tutti i duellanti)');
    perDeck.sort((a, b) => b.media - a.media).forEach((d) => console.log(`  ${d.deck.padEnd(40)} F ${String(d.easy).padStart(5)}  M ${String(d.medium).padStart(5)}  D ${String(d.hard).padStart(5)}  media ${String(d.media).padStart(5)}`));
    console.log('\n=== PER DUELLANTE (vittorie % del giocatore, media dei deck) — ordinati per difficolta\' a Difficile');
    perDuellante.slice().sort((a, b) => a.hard.giocatore - b.hard.giocatore).forEach((r) => console.log(
        `  ${r.duellante.padEnd(20)} F ${String(r.easy.giocatore).padStart(5)}  M ${String(r.medium.giocatore).padStart(5)}  D ${String(r.hard.giocatore).padStart(5)}  ${r.progressione === 'ok' ? '' : '<< ' + r.progressione}`));
}

if (ha('lavoratore')) {
    process.on('message', async (compito) => {
        const celle = await eseguiCoppia(compito);
        process.send(celle);
    });
} else if (ha('riassumi') && ha('incrocia')) {
    riassumiIncrociata(opzioni(), null, null);
} else if (ha('riassumi')) {
    riassumi(opzioni(), null, null);
} else {
    principale().catch((e) => { console.error(e); process.exit(1); });
}
