#!/usr/bin/env node
/**
 * Controllo identitario dei sette Duellanti Forbidden Memories con Extra Deck.
 * Non basta possedere Mostro Fusione, materiali e Fusione: il registro deve
 * dimostrare che l'IA riesce davvero a completare almeno qualche linea.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { giocaPartita } = require('./duello-senza-testa.js');

const CAMPIONI = ['yamiYugi', 'joey', 'pegasus', 'mako', 'bakura'];
const PIANI = {
    priestSeto: ['Drago Occhi Blu Finale'],
    highMageAtenza: ['Drago Nero Meteora'],
    meadowMage: ['Gaia il Dragone'],
    highMageKepura: ['Gaia il Dragone', 'Drago Nero Meteora'],
    heishin: ['Drago Teschio Nero'],
    darkNite: ['Drago Nero Meteora', 'Drago Teschio Nero']
};

function argomento(nome, fallback) {
    const indice = process.argv.indexOf('--' + nome);
    return indice >= 0 && process.argv[indice + 1] ? process.argv[indice + 1] : fallback;
}

function percentuale(parte, totale) {
    return totale ? Number((parte * 100 / totale).toFixed(1)) : 0;
}

async function main() {
    const partite = Math.max(1, Number(argomento('partite', '20')) || 20);
    const turni = Math.max(20, Number(argomento('turni', '80')) || 80);
    const semeBase = Number(argomento('seme', '94000')) || 94000;
    const output = argomento('output', 'reports/forbidden-memories/FORBIDDEN_MEMORIES_STRATEGY_AUDIT.json');
    const risultati = [];

    for (const [duellante, fusioni] of Object.entries(PIANI)) {
        for (const livello of ['medium', 'hard']) {
            const segnali = fusioni.map((nome) => `Il bot ha Evocato per Fusione ${nome}`);
            const totale = CAMPIONI.length * partite;
            let duelliConFusione = 0;
            const perFusione = Object.fromEntries(fusioni.map((nome) => [nome, 0]));
            process.stdout.write(`${duellante}/${livello}... `);
            for (let indiceCampione = 0; indiceCampione < CAMPIONI.length; indiceCampione++) {
                for (let partita = 0; partita < partite; partita++) {
                    const risultato = await giocaPartita({
                        avversario: duellante,
                        livello,
                        giocatore: CAMPIONI[indiceCampione],
                        livelloGiocatore: 'hard',
                        seme: semeBase + indiceCampione * 10000 + partita,
                        turni,
                        cercaTutte: segnali
                    }, 0);
                    if (risultato.erroriCarte.length || risultato.invarianti.length) {
                        throw new Error(`${duellante}/${livello}/${risultato.seme}: ` +
                            [...risultato.erroriCarte, ...risultato.invarianti].join(' | '));
                    }
                    let presente = false;
                    fusioni.forEach((nome, indice) => {
                        const conteggio = risultato.trovatePerTesto[segnali[indice]] || 0;
                        perFusione[nome] += conteggio;
                        if (conteggio) presente = true;
                    });
                    if (presente) duelliConFusione++;
                }
            }
            risultati.push({
                duellante,
                livello,
                duelli: totale,
                duelliConFusione,
                percentualeDuelli: percentuale(duelliConFusione, totale),
                evocazioniPerFusione: perFusione
            });
            console.log(`${duelliConFusione}/${totale} (${percentuale(duelliConFusione, totale)}%)`);
        }
    }

    const destinazione = path.resolve(__dirname, '..', output);
    fs.mkdirSync(path.dirname(destinazione), { recursive: true });
    fs.writeFileSync(destinazione, JSON.stringify({
        generatoIl: new Date().toISOString(),
        metodo: 'cinque deck campione Hard; conteggio delle Evocazioni Fusione del bot nel registro completo',
        opzioni: { partite, turni, seme: semeBase },
        campioni: CAMPIONI,
        piani: PIANI,
        risultati
    }, null, 2) + '\n', 'utf8');
    console.log(`Report scritto in ${output}`);
}

if (require.main === module) main().catch((errore) => {
    console.error(errore.stack || errore);
    process.exit(1);
});
