// L'attesa del relay deve restare in pagina e adattarsi ai telefoni, ma
// avere una vera identità KaibaCorp invece di una riga di testo generica.
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'Multiplayer: console KaibaCorp responsive durante il risveglio del server',
    async run(t) {
        const root = path.join(__dirname, '..', '..');
        const js = fs.readFileSync(path.join(root, 'js/multiplayer/mp-lobby.js'), 'utf8');
        const css = fs.readFileSync(path.join(root, 'js/ui/mp-lobby.css'), 'utf8');
        ['mp-term-emblem', 'mp-term-state', 'mp-term-stages', 'mp-term-meta', 'mp-term-circuit']
            .forEach((marker) => t.assert(js.includes(marker), `${marker} deve essere montato dalla console`));
        t.assert(js.includes("querySelectorAll('i')") && js.includes("classList.toggle('is-on'"),
            'La sequenza di handshake deve avanzare insieme ai messaggi reali di attesa');
        ['.mp-term-console', '.mp-term-emblem', '.mp-term-stages', '@media (max-width: 540px)', 'orientation: landscape', 'prefers-reduced-motion']
            .forEach((marker) => t.assert(css.includes(marker), `${marker} deve essere coperto dallo stile`));
        const fx = fs.readFileSync(path.join(root, 'js/multiplayer/mp-term-fx.js'), 'utf8');
        t.assert(fx.includes('MpTermFx') && fx.includes('WEBGL_lose_context') && fx.includes('prefers-reduced-motion'), 'Lo sfondo WebGL della console si spegne da solo e rispetta il movimento ridotto');
        t.assert(js.includes('accessoConcesso') && js.includes('connessioneRifiutata') && js.includes('MpTermFx.monta'), 'La console annuncia accesso concesso / rifiutato e monta lo sfondo');
        t.assert(css.includes('.mp-term.is-ok') && css.includes('.mp-term.is-err') && css.includes('.mp-term-gl'), 'Stili di esito e di sfondo presenti');
        t.assert(css.includes('#mpStatus .mp-term { background: none') && !/\.mp-term-gl \{[^}]*position: fixed/.test(css),
            'Nessun riquadro e niente a tutto schermo: l\'effetto sta dentro la console, dietro le righe di testo');
        t.assert(!/\.mp-term-emblem::(before|after)/.test(css), 'L\'emblema KC non ha piu\' i due rettangoli che ruotano');
        t.assert(!js.includes('class="modal') && !js.includes('showModal'), 'Il risveglio del server non deve tornare a essere un modale');
    }
};
