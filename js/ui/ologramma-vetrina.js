/**
 * ologramma-vetrina.js — "Vedi ologramma": un mostro mostrato come proiezione, a tutto schermo, fuori dal duello.
 * ------------------------------------------------------------------------------------------------------------
 * Lo apre la scheda carta condivisa (js/ui/card-detail.js) per i mostri, solo nelle pagine che caricano questo
 * file (oggi la Cartoteca). Riusa lo STESSO disegno degli ologrammi del duello (js/ui/monster-hologram-webgl.js:
 * scanner d'ingresso, glitch, aberrazione, profondita', base luminosa) dandogli un rettangolo grande invece di quello
 * di uno slot; per questo il livello `#monsterHologramLayer` va portato SOPRA la vetrina finche' e' aperta.
 *
 * Non dipende dall'impostazione degli ologrammi del duello: chi preme il pulsante lo vuole vedere.
 * Dove il WebGL non si puo' usare (file://, movimento ridotto, guasto) si ripiega su una proiezione in CSS
 * (illustrazione tinta, scanline e base), che si vede comunque.
 */
(function () {
    'use strict';

    const UID = 'vetrina';
    let sfondo = null;
    let palco = null;
    let osservaResize = null;

    function rettangolo() {
        const r = palco.getBoundingClientRect();
        return { left: r.left, top: r.top, w: r.width, h: r.height };
    }

    function ridisegna(card) {
        const GL = window.MonsterHologramGL;
        if (!GL || !palco) return false;
        return GL.aggiorna([{ uid: UID, owner: 'player', card: card, rect: rettangolo() }]);
    }

    function chiudi() {
        if (!sfondo) return;
        const s = sfondo;
        sfondo = null;
        if (osservaResize) { window.removeEventListener('resize', osservaResize); osservaResize = null; }
        if (window.MonsterHologramGL) {
            MonsterHologramGL.aggiorna([]);
            const livello = document.getElementById('monsterHologramLayer');
            if (livello) livello.style.zIndex = '';
        }
        s.classList.remove('ov-aperta');
        setTimeout(() => s.remove(), 180);
        palco = null;
    }

    function apri(card) {
        if (sfondo || !card) return;
        sfondo = document.createElement('div');
        sfondo.className = 'ov-vetrina';
        sfondo.setAttribute('role', 'dialog');
        sfondo.setAttribute('aria-label', 'Ologramma di ' + card.name);

        palco = document.createElement('div');
        palco.className = 'ov-palco';
        const titolo = document.createElement('div');
        titolo.className = 'ov-titolo';
        titolo.textContent = card.name;
        const suggerimento = document.createElement('div');
        suggerimento.className = 'ov-suggerimento';
        suggerimento.textContent = 'Tocca per chiudere';
        sfondo.appendChild(titolo);
        sfondo.appendChild(palco);
        sfondo.appendChild(suggerimento);
        sfondo.addEventListener('click', chiudi);
        document.body.appendChild(sfondo);
        requestAnimationFrame(() => { if (sfondo) sfondo.classList.add('ov-aperta'); });

        // Il livello degli ologrammi sta sopra la pagina ma sotto i modali: qui deve stare sopra la vetrina.
        const GL = window.MonsterHologramGL;
        const conGl = !!GL && ridisegna(card);
        if (conGl) {
            const livello = document.getElementById('monsterHologramLayer');
            if (livello) livello.style.zIndex = '760';
            osservaResize = () => { if (sfondo) ridisegna(card); };
            window.addEventListener('resize', osservaResize);
        } else {
            // Ripiego senza WebGL: la stessa idea in CSS.
            const fig = document.createElement('div');
            fig.className = 'ov-css';
            const img = document.createElement('img');
            img.alt = '';
            img.src = typeof window.getCardImagePath === 'function' ? getCardImagePath(card) : '';
            const scan = document.createElement('div');
            scan.className = 'ov-css-scan';
            fig.appendChild(img);
            fig.appendChild(scan);
            palco.appendChild(fig);
        }
    }

    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !sfondo) return;
        e.stopPropagation();
        chiudi();
    }, true);

    window.OlogrammaVetrina = { apri: apri, chiudi: chiudi, aperta: () => !!sfondo };
})();
