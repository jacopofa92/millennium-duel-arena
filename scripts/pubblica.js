#!/usr/bin/env node
/**
 * pubblica.js — Prepara in `dist/` la copia del gioco da mettere online.
 * =====================================================================
 * Il progetto su cui si lavora resta com'è: niente build, file leggibili e
 * commentati, apribili con doppio click. La versione MINIFICATA esiste solo
 * qui, al momento della pubblicazione, e non si modifica mai a mano (si
 * rigenera ogni volta da zero).
 *
 * Cosa fa:
 *  - copia SOLO ciò che serve al gioco, da un ELENCO DI COSE CHE ENTRANO
 *    (ENTRANO qui sotto), non da un elenco di cose escluse: un documento,
 *    un test o uno strumento nuovo resta fuori senza che nessuno debba
 *    ricordarsi di escluderlo;
 *  - minifica i .js file per file con esbuild, SENZA unirli e senza toccare
 *    i nomi di primo livello: le pagine caricano gli script in fila con
 *    <script src> e i file si chiamano fra loro per nome (initGame,
 *    DuelEngine, CardEffects...). esbuild, senza `format` e senza bundle,
 *    rinomina solo le variabili interne alle funzioni — proprio ciò che
 *    serve. Spariscono TUTTI i commenti, compresi quelli "legali": i
 *    commenti generosi di questo progetto spiegano come funziona ogni
 *    cosa, ed è la prima cosa da non pubblicare;
 *  - minifica i .css, e nelle pagine .html toglie i commenti e minifica i
 *    blocchi <script> e <style> in linea (il resto dell'HTML resta com'è:
 *    comprimere gli spazi dell'HTML rischierebbe di cambiare l'aspetto di
 *    testi e pulsanti, per un guadagno minimo);
 *  - NON produce source map: permetterebbero di ricostruire il codice
 *    leggibile, cioè l'opposto di quello che si vuole;
 *  - controlla che ogni file elencato nella cache del Service Worker
 *    (APP_SHELL in sw.js) esista nella copia: uno mancante farebbe fallire
 *    l'installazione del Service Worker sul telefono di chi gioca.
 *
 * Uso: `node scripts/pubblica.js` (oppure `npm run pubblica`). La verifica
 * che la copia funzioni sta in scripts/verifica-pubblicazione.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const RADICE = path.join(__dirname, '..');
const DIST = path.join(RADICE, 'dist');

// Cosa entra nella copia pubblicata. Le pagine .html della radice entrano
// tutte (sono il gioco); le cartelle qui sotto per intero. Tutto il resto
// della radice (documenti, audit, test, strumenti, server, script di
// sviluppo, APK, file di prova) resta fuori.
const FILE_RADICE = ['manifest.json', 'sw.js', 'app-status.json'];   // app-status.json: lo legge l'APK all'avvio (manutenzione / versione minima), vedi docs/apk/STATO_APP.md
const CARTELLE = ['js', 'images', 'audio', 'video', 'assets'];

// File già minificati da chi li distribuisce: si copiano come sono.
const GIA_MINIFICATI = /(^|\/)js\/vendor\/|\.min\.js$/;

const conteggio = { js: 0, css: 0, html: 0, copiati: 0, primaByte: 0, dopoByte: 0 };

function svuota(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
}

function minificaJs(codice, nome) {
    return esbuild.transformSync(codice, {
        loader: 'js',
        minify: true,
        legalComments: 'none',
        charset: 'utf8',
        sourcefile: nome
    }).code;
}

function minificaCss(codice, nome) {
    return esbuild.transformSync(codice, {
        loader: 'css',
        minify: true,
        legalComments: 'none',
        charset: 'utf8',
        sourcefile: nome
    }).code;
}

/**
 * Nelle pagine: via i commenti HTML, e minificati gli script/stili in
 * linea. Uno <script> con un `type` che non è JavaScript (es. JSON) si
 * lascia com'è. Un errore di minificazione ferma tutto: meglio non
 * pubblicare che pubblicare una pagina rotta.
 */
function minificaHtml(html, nome) {
    let out = html.replace(/<!--[\s\S]*?-->/g, '');
    out = out.replace(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi, (tutto, attributi, corpo) => {
        attributi = attributi || '';
        if (/\ssrc\s*=/.test(attributi) || !corpo.trim()) return tutto;
        const tipo = (attributi.match(/\stype\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
        if (tipo && !/^(text\/javascript|application\/javascript|module)$/i.test(tipo)) return tutto;
        return `<script${attributi}>${minificaJs(corpo, nome + ' (script in linea)')}</script>`;
    });
    out = out.replace(/<style(\s[^>]*)?>([\s\S]*?)<\/style>/gi, (tutto, attributi, corpo) => {
        if (!corpo.trim()) return tutto;
        return `<style${attributi || ''}>${minificaCss(corpo, nome + ' (stile in linea)')}</style>`;
    });
    return out;
}

function elaboraFile(sorgente, destinazione, relativo) {
    fs.mkdirSync(path.dirname(destinazione), { recursive: true });
    const estensione = path.extname(sorgente).toLowerCase();
    const percorso = relativo.split(path.sep).join('/');
    if (['.js', '.css', '.html'].indexOf(estensione) !== -1 && !GIA_MINIFICATI.test(percorso)) {
        const testo = fs.readFileSync(sorgente, 'utf8');
        let risultato;
        if (estensione === '.js') { risultato = minificaJs(testo, percorso); conteggio.js++; }
        else if (estensione === '.css') { risultato = minificaCss(testo, percorso); conteggio.css++; }
        else { risultato = minificaHtml(testo, percorso); conteggio.html++; }
        conteggio.primaByte += Buffer.byteLength(testo);
        conteggio.dopoByte += Buffer.byteLength(risultato);
        fs.writeFileSync(destinazione, risultato, 'utf8');
    } else {
        fs.copyFileSync(sorgente, destinazione);
        conteggio.copiati++;
    }
}

function elaboraCartella(relativa) {
    const sorgente = path.join(RADICE, relativa);
    if (!fs.existsSync(sorgente)) return;
    for (const voce of fs.readdirSync(sorgente, { withFileTypes: true })) {
        const rel = path.join(relativa, voce.name);
        if (voce.isDirectory()) elaboraCartella(rel);
        else elaboraFile(path.join(RADICE, rel), path.join(DIST, rel), rel);
    }
}

/** Ogni voce di APP_SHELL (sw.js) deve esistere nella copia. */
function controllaCacheServiceWorker() {
    const sw = fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8');
    const blocco = sw.match(/const APP_SHELL\s*=\s*\[([\s\S]*?)\];/);
    if (!blocco) throw new Error('APP_SHELL non trovato in sw.js: il controllo della cache non si può fare');
    // Via i commenti prima di leggere i nomi: dentro l'elenco ce ne sono,
    // e una parola fra virgolette in un commento ("Duello Demo") sembrava
    // un file.
    const elenco = blocco[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const voci = [...elenco.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]).filter((v) => v !== './' && v !== '');
    const mancanti = voci.filter((v) => !fs.existsSync(path.join(DIST, v)));
    if (mancanti.length) {
        throw new Error(`File elencati nella cache del Service Worker ma assenti dalla copia pubblicata:\n  ${mancanti.join('\n  ')}`);
    }
    return voci.length;
}

function main() {
    const inizio = Date.now();
    svuota(DIST);
    for (const f of fs.readdirSync(RADICE)) {
        // Le pagine che iniziano per "_" sono prove di sviluppo (senza gate di accesso): mai online.
        if (f.charAt(0) !== '_' && (f.toLowerCase().endsWith('.html') || FILE_RADICE.indexOf(f) !== -1)) {
            elaboraFile(path.join(RADICE, f), path.join(DIST, f), f);
        }
    }
    CARTELLE.forEach(elaboraCartella);
    const voci = controllaCacheServiceWorker();
    const kb = (n) => Math.round(n / 1024).toLocaleString('it-IT') + ' KB';
    console.log(`Copia pubblicata pronta in dist/ (${((Date.now() - inizio) / 1000).toFixed(1)}s)`);
    console.log(`  minificati: ${conteggio.js} JS, ${conteggio.css} CSS, ${conteggio.html} HTML — da ${kb(conteggio.primaByte)} a ${kb(conteggio.dopoByte)}`);
    console.log(`  copiati senza modifiche: ${conteggio.copiati} file (immagini, audio, video, font, librerie già minificate)`);
    console.log(`  cache del Service Worker: ${voci} voci, tutte presenti`);
}

try {
    main();
} catch (err) {
    console.error('Pubblicazione NON preparata:', err.message);
    process.exit(1);
}
