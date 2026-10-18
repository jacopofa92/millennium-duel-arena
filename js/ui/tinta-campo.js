// @ts-check
/**
 * tinta-campo.js — il colore dell'arena, per le caselle del campo.
 * =====================================================================
 * Richiesta dell'utente: caselle "coerenti coi vari sfondi terreno dei
 * duelli". Le caselle sono solo un'ombra sull'arena (vedi .field-slot in
 * duelMonstersCore.html); il colore che caratterizza l'arena dà la tinta
 * all'alone sotto il mouse e al contorno che compare durante la zoomata
 * d'ingresso. Questo file trova quel colore e lo scrive come variabile CSS
 * (--campo-tinta) sull'elemento <html>.
 *
 * Da dove arriva il colore:
 *   1. js/data/tinte-campi.js, pre-calcolato per ogni arena di
 *      images/fields/mobile/ — l'unico modo che funzioni anche aprendo il
 *      gioco da file (file://), dove il browser non lascia leggere i pixel
 *      di un'immagine;
 *   2. per un'arena nuova che lì manca, lo si legge al momento
 *      dall'immagine (online e nell'APK si può), con lo stesso criterio:
 *      la tinta più presente fra i colori vivi, non la media (che
 *      verrebbe sempre grigio-marrone);
 *   3. se nemmeno questo si può, un oro tenue neutro.
 *
 * L'arena si legge dallo sfondo del <body>, che è dove la pagina la mette:
 * così vale per ogni modo di sceglierla (Duello Libero, Storia, Torneo,
 * Multiplayer) senza che nessuno debba avvisare questo file. Un
 * osservatore riapplica il colore se lo sfondo cambia a duello aperto.
 */
(function () {
    'use strict';

    const NEUTRO = [190, 165, 120];

    function fileDellArena() {
        const bg = getComputedStyle(document.body).backgroundImage || '';
        const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
        return m ? { url: m[1], file: decodeURIComponent(m[1].split('/').pop()) } : null;
    }

    /** La tinta dominante di un'immagine, o null se non si può leggere (file://). */
    function leggiTinta(url) {
        return new Promise((risolvi) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const c = document.createElement('canvas');
                    c.width = 48; c.height = 27;
                    const g = c.getContext('2d');
                    g.drawImage(img, 0, 0, c.width, c.height);
                    const d = g.getImageData(0, 0, c.width, c.height).data;
                    const bins = Array.from({ length: 24 }, () => ({ peso: 0, r: 0, g: 0, b: 0 }));
                    for (let i = 0; i < d.length; i += 4) {
                        const r = d[i], gg = d[i + 1], b = d[i + 2];
                        const max = Math.max(r, gg, b), min = Math.min(r, gg, b);
                        const v = max / 255, s = max ? (max - min) / max : 0;
                        if (s < 0.18 || v < 0.15) continue;
                        let h = max === r ? ((gg - b) / (max - min)) % 6 : max === gg ? (b - r) / (max - min) + 2 : (r - gg) / (max - min) + 4;
                        h = (h * 60 + 360) % 360;
                        const bin = bins[Math.floor(h / 15)];
                        const peso = s * v;
                        bin.peso += peso; bin.r += r * peso; bin.g += gg * peso; bin.b += b * peso;
                    }
                    const migliore = bins.reduce((a, b) => (b.peso > a.peso ? b : a));
                    risolvi(migliore.peso ? [migliore.r / migliore.peso, migliore.g / migliore.peso, migliore.b / migliore.peso].map(Math.round) : null);
                } catch (e) {
                    risolvi(null); // canvas "contaminato" su file://: si usa il ripiego
                }
            };
            img.onerror = () => risolvi(null);
            img.src = url;
        });
    }

    function scrivi(rgb) {
        document.documentElement.style.setProperty('--campo-tinta', `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`);
    }

    let ultimo = null;
    function applica() {
        const arena = fileDellArena();
        if (!arena || arena.file === ultimo) return;
        ultimo = arena.file;
        const nota = window.TINTE_CAMPI && window.TINTE_CAMPI[arena.file];
        if (nota) { scrivi(nota); return; }
        scrivi(NEUTRO);
        leggiTinta(arena.url).then((rgb) => { if (rgb && ultimo === arena.file) scrivi(rgb); });
    }

    function avvia() {
        applica();
        new MutationObserver(applica).observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    if (document.body) avvia(); else document.addEventListener('DOMContentLoaded', avvia, { once: true });

    window.TintaCampo = { applica: applica };
})();
