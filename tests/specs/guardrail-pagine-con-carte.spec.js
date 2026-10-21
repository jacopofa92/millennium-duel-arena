// Analisi statica, nessun duello coinvolto.
//
// Una carta ha UN solo aspetto, quello di js/ui/card-renderer.js vestito da
// js/ui/card.css. Una pagina che carica uno script che disegna carte
// (createCardElement) senza caricare anche quei due file non dà errore: la
// carta esce senza stile, o lo script ripiega su un disegno suo — come
// faceva la carta in premio della Storia e dei tornei, che aveva una
// cornice e un dorso propri e cercava le illustrazioni non Yu-Gi-Oh nella
// cartella sbagliata. Questo controllo lo impedisce per ogni pagina,
// comprese quelle che verranno.
//
// (index.html non ha più viste fuse: ogni schermata è una pagina propria.)
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');
const RENDERER = 'js/ui/card-renderer.js';
const STILE = 'js/ui/card.css';
// La carta "viva" (CartaViva in card-renderer.js) segue il giroscopio
// tramite js/ui/inclinazione.js: senza, non dà errore ma sul telefono la
// carta grande smette di seguire l'inclinazione.
const INCLINAZIONE = 'js/ui/inclinazione.js';
// Il catalogo delle illustrazioni alternative: getCardImagePath lo interroga per
// scegliere il file da mostrare. Senza, una pagina mostrerebbe sempre
// l'originale e il bollino delle alternative non comparirebbe: nessun errore.
const ARTWORK = 'js/data/artwork-alternativi.js';

function caricatiDa(html) {
    const percorsi = new Set();
    for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) percorsi.add(m[1]);
    for (const m of html.matchAll(/<link[^>]*\shref="([^"]+\.css)"/g)) percorsi.add(m[1]);
    // Elenchi di file caricati al volo: qualunque stringa 'js/....js|css'.
    for (const m of html.matchAll(/['"](js\/[\w\-/.]+\.(?:js|css))['"]/g)) percorsi.add(m[1]);
    return percorsi;
}

module.exports = {
    name: 'Guardrail: ogni pagina che disegna carte carica renderer e card.css',
    standalone: true,
    async run(t) {
        const pagine = fs.readdirSync(RADICE).filter((f) => f.endsWith('.html'));
        const problemi = [];
        let controllate = 0;
        for (const pagina of pagine) {
            const caricati = caricatiDa(fs.readFileSync(path.join(RADICE, pagina), 'utf8'));
            const disegnano = [...caricati].filter((p) => {
                if (!p.endsWith('.js') || p === RENDERER) return false;
                const file = path.join(RADICE, p);
                return fs.existsSync(file) && /\bcreateCardElement\s*\(/.test(fs.readFileSync(file, 'utf8'));
            });
            if (!disegnano.length) continue;
            controllate++;
            const mancano = [RENDERER, STILE, INCLINAZIONE, ARTWORK].filter((p) => !caricati.has(p));
            if (mancano.length) problemi.push(`${pagina}: disegna carte (${disegnano.join(', ')}) ma non carica ${mancano.join(' e ')}`);
        }
        // Erano 7 quando il controllo è nato (duello, Cartoteca, Creazione
        // Deck, menu, Negozio, Storia e i tornei con la carta in premio...):
        // la soglia sta un po' sotto, serve solo a capire se il controllo ha
        // smesso di leggere le pagine.
        t.assert(controllate >= 6, `attese almeno 6 pagine che disegnano carte, trovate ${controllate}: il controllo non legge più le pagine?`);
        t.assert(!problemi.length, problemi.join('\n'));
    }
};
