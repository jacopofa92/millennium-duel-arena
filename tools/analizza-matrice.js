#!/usr/bin/env node
// Analisi della matrice completa (reports/matrix/matrice-completa.jsonl, prodotta da tools/audit-matrice-completa.js): anomalie per duellante
// (scala piatta o invertita, Facile gia' duro, Difficile quasi imbattibile o troppo facile) sul gruppo di riferimento (i deck senza
// Custom e senza Starter Pegasus). Scrive reports/matrix/analisi-riferimento.json, che serve a docs/audits/FULL_MATRIX_AUDIT.md.
'use strict';
const fs = require('fs');
const R = require('path').join(__dirname, '..');
const righe = fs.readFileSync(R + '/reports/matrix/matrice-completa.jsonl', 'utf8').split('\n').filter(Boolean).map((r) => JSON.parse(r));
const L = ['easy', 'medium', 'hard'];
const pct = (v, t) => t ? +(v * 100 / t).toFixed(1) : 0;
const tot = (c) => c.vittorie + c.sconfitte + c.altro;
const decks = [...new Set(righe.map((r) => r.deck))];
const duel = [...new Set(righe.map((r) => r.duellante))];
// insiemi di deck: tutti, e "di riferimento" = senza Custom (outlier) e senza Pegasus Starter (debolezza Toon nota)
const insiemi = { tutti: decks, riferimento: decks.filter((d) => d !== 'custom' && d !== 'starter_sdp_pegasus') };
function win(duellante, livello, ins) {
    let v = 0, t = 0;
    righe.filter((r) => r.duellante === duellante && insiemi[ins].includes(r.deck)).forEach((r) => { v += r.celle[livello].vittorie; t += tot(r.celle[livello]); });
    return pct(v, t);
}
function winLivello(livello, ins) {
    let v = 0, t = 0;
    righe.filter((r) => insiemi[ins].includes(r.deck)).forEach((r) => { v += r.celle[livello].vittorie; t += tot(r.celle[livello]); });
    return pct(v, t);
}
console.log('GLOBALE (tutti):', L.map((l) => l + ' ' + winLivello(l, 'tutti')).join(' | '));
console.log('GLOBALE (riferimento, senza Custom e Pegasus Starter):', L.map((l) => l + ' ' + winLivello(l, 'riferimento')).join(' | '));
// turni medi
console.log('TURNI MEDI:', L.map((l) => { let t = 0, n = 0; righe.forEach((r) => { t += r.celle[l].turni; n += tot(r.celle[l]); }); return l + ' ' + (t / n).toFixed(1); }).join(' | '));
const tab = duel.map((d) => ({ d, f: win(d, 'easy', 'riferimento'), m: win(d, 'medium', 'riferimento'), h: win(d, 'hard', 'riferimento') }));
console.log('\nDUELLANTI (riferimento) F/M/D e salti');
const flagFM = [], flagMD = [], inv = [], hMolto = [], hFacile = [], fDuro = [], fFacile = [];
tab.forEach((x) => {
    const salto1 = +(x.f - x.m).toFixed(1), salto2 = +(x.m - x.h).toFixed(1);
    x.s1 = salto1; x.s2 = salto2;
    if (salto1 < 8) flagFM.push(x);
    if (salto2 < 8) flagMD.push(x);
    if (x.f + 2 < x.m || x.m + 2 < x.h) inv.push(x);
    if (x.h < 10) hMolto.push(x);
    if (x.h >= 45) hFacile.push(x);
    if (x.f < 55) fDuro.push(x);
    if (x.f >= 85) fFacile.push(x);
});
const stampa = (titolo, a, campi) => { console.log('\n## ' + titolo + ' (' + a.length + ')'); a.sort((p, q) => q.h - p.h).forEach((x) => console.log('  ' + x.d.padEnd(20) + ' F ' + String(x.f).padStart(5) + ' M ' + String(x.m).padStart(5) + ' D ' + String(x.h).padStart(5) + '  (F-M ' + x.s1 + ', M-D ' + x.s2 + ')')); };
stampa('Facile->Medio con salto < 8 punti', flagFM);
stampa('Medio->Difficile con salto < 8 punti', flagMD);
stampa('Progressione invertita (tolleranza 2)', inv);
stampa('Difficile quasi imbattibile (< 10%)', hMolto);
stampa('Difficile troppo facile (>= 45%)', hFacile);
stampa('Facile gia\' duro (< 55%)', fDuro);
stampa('Facile banale (>= 85%)', fFacile);
// dispersione fra deck: duellanti che dipendono da un deck
console.log('\n## DECK MIGLIORE/PEGGIORE per duellante a Difficile (riferimento) — solo i 6 piu\' estremi per intervallo');
const intervalli = duel.map((d) => {
    const v = insiemi.riferimento.map((k) => { const r = righe.find((x) => x.deck === k && x.duellante === d); return { k, p: pct(r.celle.hard.vittorie, tot(r.celle.hard)) }; }).sort((a, b) => a.p - b.p);
    return { d, min: v[0], max: v[v.length - 1], ampiezza: +(v[v.length - 1].p - v[0].p).toFixed(1) };
}).sort((a, b) => b.ampiezza - a.ampiezza);
intervalli.slice(0, 6).forEach((x) => console.log('  ' + x.d.padEnd(18) + ' ' + x.min.k + ' ' + x.min.p + '%  ->  ' + x.max.k + ' ' + x.max.p + '%'));
// celle dove un deck non vince MAI o vince SEMPRE a Difficile (su 50)
let zeri = 0, cento = 0; const esempiZeri = [];
righe.forEach((r) => { const c = r.celle.hard; if (c.vittorie === 0) { zeri++; if (esempiZeri.length < 8) esempiZeri.push(r.deck + ' vs ' + r.duellante); } if (c.sconfitte === 0 && c.altro === 0) cento++; });
console.log('\nCoppie con 0 vittorie su 50 a Difficile:', zeri, ' | con 50 su 50:', cento, '\n  esempi 0/50:', esempiZeri.join('; '));
// effetto del livello del deck: mazzo del giocatore contro Duellante: i 5 piu' duri e i 5 piu' facili per ogni deck (a Difficile)
console.log('\n## Per deck: i 3 duellanti piu\' duri a Difficile');
insiemi.tutti.forEach((k) => {
    const v = duel.map((d) => { const r = righe.find((x) => x.deck === k && x.duellante === d); return { d, p: pct(r.celle.hard.vittorie, tot(r.celle.hard)) }; }).sort((a, b) => a.p - b.p);
    console.log('  ' + k.padEnd(38) + v.slice(0, 3).map((x) => x.d + ' ' + x.p).join(', '));
});
// salva per il documento
fs.writeFileSync(R + '/reports/matrix/analisi-riferimento.json', JSON.stringify({ tab, flagFM: flagFM.map((x) => x.d), flagMD: flagMD.map((x) => x.d), inv: inv.map((x) => x.d) }, null, 2));
