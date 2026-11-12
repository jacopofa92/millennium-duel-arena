// Impronta degli STILI CALCOLATI della pagina del duello, per dimostrare che spostare o dividere il CSS di
// duelMonstersCore.html non ha cambiato nulla di visibile.
//
//   node tools/impronta-stili-duello.js scrivi <file.json>      fotografa lo stato attuale
//   node tools/impronta-stili-duello.js confronta <file.json>   rifotografa e dice cosa e' cambiato
//
// Come funziona: apre il duello (stesso allestimento dei test), costruisce un campo pieno e poi, per tre schermi
// (desktop, telefono in verticale, telefono in orizzontale) e alcune situazioni (Main Phase, Battle Phase,
// pannello info aperto, modali aperti, effetto ologramma acceso), calcola per OGNI elemento della pagina
// un'impronta di tutte le sue proprieta' calcolate. Animazioni e transizioni sono spente per non fotografare
// un fotogramma a meta': quello che si confronta e' il foglio di stile, non il tempo.
//
// Limiti dichiarati: non guarda gli pseudo-elementi (::before/::after) ne' lo stato dopo un tocco; la
// prova principale resta il confronto testuale delle regole (la concatenazione dei nuovi fogli deve dare il
// vecchio blocco). Questa e' la seconda rete: prende gli errori di percorso (url()) e di ordine dei fogli.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openDuel, freezeNaturalGameLoop } = require('../tests/helpers/harness');

const SCHERMI = [
    { nome: 'desktop', width: 1400, height: 900 },
    { nome: 'telefono-verticale', width: 411, height: 750, isMobile: true, hasTouch: true },
    { nome: 'telefono-orizzontale', width: 891, height: 411, isMobile: true, hasTouch: true }
];

const SITUAZIONI = [
    { nome: 'main', prepara: () => { gameState.phase = 'main1'; } },
    { nome: 'battle', prepara: () => { gameState.phase = 'battle'; } },
    { nome: 'info-aperta', prepara: () => { gameState.phase = 'main1'; const p = document.getElementById('cardInfoPanel'); if (p) p.classList.add('visible'); } },
    { nome: 'modali-aperti', prepara: () => { ['activateModal', 'cardListPickerModal', 'surrenderModal'].forEach((id) => { const e = document.getElementById(id); if (e) e.classList.add('open'); }); } },
    { nome: 'ologrammi', prepara: () => { document.documentElement.classList.add('holo-on'); } }
];

async function fotografa() {
    const browser = await chromium.launch();
    const risultato = {};
    try {
        for (const schermo of SCHERMI) {
            const ctx = await browser.newContext({
                serviceWorkers: 'block', viewport: { width: schermo.width, height: schermo.height },
                isMobile: !!schermo.isMobile, hasTouch: !!schermo.hasTouch
            });
            const page = await ctx.newPage();
            // Math.random con seme fisso (la mano, le arene casuali e gli effetti a caso non devono cambiare da una corsa all'altra).
            await page.addInitScript(() => { let s = 123456789; Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
            await openDuel(page);
            await freezeNaturalGameLoop(page);
            await page.waitForFunction(() => gameState.currentPlayer === 'player' && gameState.phase === 'main1', null, { timeout: 15000 });
            await page.waitForTimeout(600);
            await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
            await page.evaluate(() => {
                const make = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
                const mostri = cardDatabase.filter((c) => c.type === 'monster' && !c.extraDeck).slice(0, 6).map((c) => c.id);
                const m = (i, uid, pos, coperto) => ({ card: make(mostri[i], uid), position: pos, isFaceDown: !!coperto });
                const coperta = (uid) => ({ card: make(40, uid), isFaceDown: true });
                gameState.playerMonsterField = [m(0, 'a', 'attack'), m(1, 'b', 'defense', true), m(2, 'c', 'attack'), m(3, 'd', 'defense'), m(4, 'e', 'attack')];
                gameState.botMonsterField = [m(0, 'ba', 'attack'), m(2, 'bb', 'attack'), m(5, 'bc', 'attack'), m(3, 'bd', 'defense'), m(4, 'be', 'attack')];
                gameState.playerSTField = ['s1', 's2', 's3', 's4', 's5'].map(coperta);
                gameState.botSTField = [coperta('t1'), null, coperta('t3'), null, null];
                gameState.playerGraveyard = [make(40, 'g1'), make(40, 'g2')];
                gameState.botGraveyard = [make(40, 'g3')];
                gameState.botHand = [make(40, 'bh1'), make(40, 'bh2'), make(40, 'bh3')];
                gameState.playerHand = [make(mostri[0], 'h1'), make(mostri[1], 'h2'), make(36, 'h3'), make(40, 'h4'), make(mostri[2], 'h5')];
                updateUI();
            });
            for (const sit of SITUAZIONI) {
                const impronte = await page.evaluate(({ corpo, raw }) => {
                    // eslint-disable-next-line no-new-func
                    new Function('return (' + corpo + ')()')();
                    if (typeof updateUI === 'function' && !document.documentElement.classList.contains('holo-on')) { /* niente ridisegno: si fotografa lo stato impostato */ }
                    const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
                    const out = {};
                    const tutti = document.body.querySelectorAll('*');
                    const conteggi = {};
                    tutti.forEach((el) => {
                        if (/^(SCRIPT|STYLE|LINK|META)$/.test(el.tagName)) return;
                        // Livelli che si riempiono e si svuotano da soli (ologrammi, riscontri, caricamento, FX): dipendono dal tempo, non dal foglio di stile.
                        if (el.closest('#monsterHologramLayer, #pageLoader, #duelFeedbackLayer, #segnaliniLayer, [class*="fx-"], [id*="Layer"], .duel-speech, #hudSistema, .card-frame-art-icon, #phaseAnnouncement')) return;
                        const base = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).sort().join('.') : '');
                        conteggi[base] = (conteggi[base] || 0) + 1;
                        const cs = getComputedStyle(el);
                        let s = '';
                        // L'ORDINE con cui Chrome elenca le proprieta' personalizzate cambia da una corsa all'altra: si ordinano i nomi.
                        const nomi = []; for (let i = 0; i < cs.length; i++) nomi.push(cs[i]);
                        // Gli spazi dentro una proprieta' personalizzata si conservano alla lettera (CRLF di un file CSS contro LF di un blocco <style>): si normalizzano.
                        nomi.sort().forEach((p) => { s += p + ':' + cs.getPropertyValue(p).replace(/\\s+/g, ' ') + ';'; });
                        const r = el.getBoundingClientRect();
                        s += 'rect:' + [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 10) / 10).join(',');
                        out[base + '#' + conteggi[base]] = raw ? s : fnv(s);
                    });
                    return out;
                }, { corpo: sit.prepara.toString(), raw: !!process.env.IMPRONTA_RAW });
                risultato[schermo.nome + '/' + sit.nome] = impronte;
                // ripristino per la situazione successiva
                await page.evaluate(() => {
                    document.documentElement.classList.remove('holo-on');
                    ['activateModal', 'cardListPickerModal', 'surrenderModal'].forEach((id) => { const e = document.getElementById(id); if (e) e.classList.remove('open'); });
                    const p = document.getElementById('cardInfoPanel'); if (p) p.classList.remove('visible');
                });
            }
            await ctx.close();
        }
    } finally {
        await browser.close();
    }
    return risultato;
}

(async () => {
    const [modo, file] = process.argv.slice(2);
    if (!['scrivi', 'confronta'].includes(modo) || !file) {
        console.log('Uso: node tools/impronta-stili-duello.js scrivi|confronta <file.json>');
        process.exit(2);
    }
    const nuovo = await fotografa();
    if (modo === 'scrivi') {
        fs.writeFileSync(file, JSON.stringify(nuovo));
        const n = Object.values(nuovo).reduce((a, o) => a + Object.keys(o).length, 0);
        console.log(`Impronta scritta: ${Object.keys(nuovo).length} fotografie, ${n} elementi in ${path.resolve(file)}`);
        return;
    }
    const vecchio = JSON.parse(fs.readFileSync(file, 'utf8'));
    let differenze = 0;
    for (const chiave of new Set([...Object.keys(vecchio), ...Object.keys(nuovo)])) {
        const a = vecchio[chiave] || {}; const b = nuovo[chiave] || {};
        const diverse = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);
        if (diverse.length) {
            differenze += diverse.length;
            console.log(`DIVERSO in ${chiave}: ${diverse.length} elementi, es. ${diverse.slice(0, 4).join(' | ')}`);
        }
    }
    console.log(differenze === 0 ? 'Identico: nessuna differenza negli stili calcolati.' : `${differenze} differenze.`);
    process.exit(differenze === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
