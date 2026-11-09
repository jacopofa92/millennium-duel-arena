'use strict';
/**
 * Calcola l'elenco dei file consegnabili SENZA accesso (vedi worker/gate.mjs e la funzione scriviElencoPubblico in
 * pubblica.js): index.html, i file che index.html carica con <script src> / <link href> (percorsi locali) e i file di
 * servizio. Sta in un modulo a parte perche' lo usano sia la pubblicazione sia lo spec che controlla che il motore del
 * duello resti riservato.
 */
const fs = require('fs');
const path = require('path');

/** @param {string} radice  @returns {string[]} percorsi che iniziano per "/" */
function elencoPubblico(radice) {
    const html = fs.readFileSync(path.join(radice, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const voci = new Set(['/index.html', '/manifest.json', '/sw.js', '/app-status.json']);
    for (const m of html.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)) {
        const v = m[1];
        if (/^(https?:|data:|\/\/|mailto:|javascript:)/i.test(v)) continue;
        voci.add('/' + v.replace(/^\.?\//, ''));
    }
    return Array.from(voci).sort();
}

module.exports = { elencoPubblico };
