// Ogni url(...) relativo di un file .css punta a un file che esiste, risolto a partire dalla cartella DEL CSS.
//
// Perche': un url() dentro un foglio di stile e' relativo al foglio, non alla pagina. Quando un blocco <style> viene
// spostato in js/ui/ (come il CSS del duello, 1.6.43) un `url('images/...')` smette di funzionare in silenzio: nessun
// errore, solo uno sfondo che non c'e' piu'. Era gia' successo con duello-libero.css alla 1.4.55 e il guardrail delle
// immagini non guarda i CSS (cerca le stringhe `images/...` partendo dalla radice).
//
// Analisi statica, nessun browser. Si ignorano data:, http(s):, frammenti (#id, usati dai riferimenti SVG) e
// gli url() dentro i commenti.
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const SALTA = /(^|\/)(node_modules|\.git|android|vendor|dist|graphify-out)(\/|$)/;

function cammina(dir, f) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        const rel = path.relative(RADICE, p).replace(/\\/g, '/');
        if (SALTA.test(rel)) continue;
        if (e.isDirectory()) cammina(p, f); else f(p, rel, e.name);
    }
}

module.exports = {
    standalone: true,
    name: 'Guardrail: gli url() relativi dei file .css puntano a file che esistono (relativi al CSS)',
    async run(t) {
        const rotti = [];
        let controllati = 0;
        cammina(RADICE, (p, rel, nome) => {
            if (!/\.css$/.test(nome)) return;
            const testo = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
            for (const m of testo.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
                const url = m[2].trim();
                if (/^(data:|https?:|\/\/|#)/i.test(url)) continue;
                const pulito = url.split(/[?#]/)[0];
                if (!pulito) continue;
                controllati++;
                const assoluto = pulito.startsWith('/') ? path.join(RADICE, pulito) : path.resolve(path.dirname(p), pulito);
                if (!fs.existsSync(assoluto)) rotti.push(`${rel}: url(${url})`);
            }
        });
        t.assert(controllati > 0, 'Il guardrail deve trovare almeno un url() da controllare (altrimenti non guarda nulla)');
        t.assert(rotti.length === 0, `url() che non portano a un file (${rotti.length}), es. ${rotti.slice(0, 5).join(' | ')}`);
    }
};
