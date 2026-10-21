// Guardrail statico (nessun duello): ogni carta il cui TESTO sceglie come
// bersaglio un mostro deve far passare quel bersaglio dal checkpoint di
// targeting condiviso (ctx.declareTarget, duel-engine.js).
//
// È ciò che regge le carte che reagiscono al targeting — Gran Scudo Gardna,
// Signore dei D., Mago Comando del Caos, Bastone del Silenzio, Fushioh
// Richie, i Dei Egizi... — che vedono solo gli effetti passati di lì.
// L'audit 1.0.37 ne ha trovate una trentina che lo saltavano, e le ha
// sistemate; questo test impedisce che una carta nuova, scritta copiando
// una vecchia, riapra il buco in silenzio.
//
// Una carta è a posto se il suo blocco register (o una funzione che chiama)
// usa una delle forme del checkpoint: ctx.declareTarget,
// ctx.destroyTargetedMonster, l'opzione `dichiara: true` di
// chooseFieldCardTarget, equipToChosenTarget o attachUnionMonster (che la
// passano da sé). Altrimenti deve stare in ECCEZIONI col suo motivo.
const fs = require('fs');
const path = require('path');

const RADICE = path.resolve(__dirname, '..', '..');
const FORME = /\.declareTarget\(|\.declareTargetWaiting\(|\.destroyTargetedMonster\(|\bdichiara:\s*true\b|\bequipToChosenTarget\(|\battachUnionMonster\(|\bchooseFieldTargetsInSequence\(/;

// Ogni motivo è una categoria: aggiungere un id a una categoria sbagliata
// per far passare il test è esattamente ciò che questo file deve impedire.
const MOTIVI = {
    cimitero: 'bersaglia carte nel CIMITERO: il checkpoint copre solo i mostri sul Terreno',
    attacco: 'riguarda il bersaglio di un ATTACCO, non di un effetto',
    reazione: 'È una carta che REAGISCE al checkpoint (o ne è il floodgate), non un effetto che bersaglia',
    magiaTrappola: 'bersaglia una Magia/Trappola: il checkpoint copre solo i mostri'
};
const ECCEZIONI = {
    cimitero: [136, 523, 621, 633, 656, 669, 704, 725, 818, 823, 837, 848, 853, 891, 899, 1080, 1250, 1252],
    attacco: [322, 425, 469, 606, 664, 679, 713, 714, 760],
    reazione: [235, 353, 423, 636, 652, 689, 738, 851, 865, 1039, 1129, 1130, 1257, 1263, 1266, 1282],
    magiaTrappola: [647]
};

module.exports = {
    name: 'Guardrail: ogni effetto che bersaglia un mostro passa dal checkpoint di targeting',
    standalone: true,
    async run(t) {
        const cards = JSON.parse(fs.readFileSync(path.join(RADICE, 'data', 'cards.json'), 'utf8'));
        const arr = Array.isArray(cards) ? cards : cards.cards;
        const dir = path.join(RADICE, 'js', 'engine');
        const sorgente = fs.readdirSync(dir).filter((f) => /^card-effects.*\.js$/.test(f))
            .map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

        const chiudi = (da) => {
            let depth = 0;
            for (let j = da; j < sorgente.length; j++) {
                if (sorgente[j] === '{') depth++;
                else if (sorgente[j] === '}') { depth--; if (depth === 0) return j; }
            }
            return -1;
        };
        const blocco = (id) => {
            const m = new RegExp(`register\\(${id},\\s*\\{`).exec(sorgente);
            if (!m) return null;
            const fine = chiudi(m.index + m[0].length - 1);
            return fine === -1 ? null : sorgente.slice(m.index, fine + 1);
        };
        // Le funzioni d'appoggio che usano il checkpoint: una carta che ne
        // chiama una è coperta (es. attivaControlloMentale, tsukuyomiEffect).
        const funzioniCoperte = new Set();
        const reFn = /function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;
        let mf;
        while ((mf = reFn.exec(sorgente))) {
            const fine = chiudi(mf.index + mf[0].length - 1);
            if (fine !== -1 && FORME.test(sorgente.slice(mf.index, fine + 1))) funzioniCoperte.add(mf[1]);
        }
        const coperto = (testo) => FORME.test(testo)
            || [...funzioniCoperte].some((nome) => new RegExp(`\\b${nome}\\(`).test(testo));

        const eccettuate = new Map();
        Object.entries(ECCEZIONI).forEach(([motivo, ids]) => ids.forEach((id) => eccettuate.set(id, motivo)));

        const scoperte = [];
        let controllate = 0;
        for (const c of arr) {
            if (!c.effect) continue;
            // "Bersaglieri" (Grande Guerra) non è un bersaglio.
            const frasi = c.effect.match(/[^.]*\bbersagli(?!eri)[^.]*/gi);
            if (!frasi || !/mostr/i.test(frasi.join(' '))) continue;
            const b = blocco(c.id);
            if (!b) continue; // carta senza effetto registrato: non è affare di questo test
            controllate++;
            if (coperto(b)) continue;
            if (eccettuate.has(c.id)) continue;
            scoperte.push(`${c.id} ${c.name}: ${frasi.join(' ').trim().slice(0, 120)}`);
        }
        t.assert(controllate > 50, `Il guardrail deve trovare le carte che bersagliano (ne ha trovate ${controllate}): se sono sparite, è cambiato il formato dei testi e il test va aggiornato`);
        t.assert(scoperte.length === 0,
            `Carte che bersagliano un mostro senza passare dal checkpoint di targeting — usare \`dichiara: true\` in chooseFieldCardTarget, ctx.declareTarget o ctx.destroyTargetedMonster, oppure, se davvero non serve, aggiungere l'id alla categoria giusta di ECCEZIONI (${Object.values(MOTIVI).join(' / ')}):\n  ${scoperte.join('\n  ')}`);
    }
};
