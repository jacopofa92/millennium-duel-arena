// Su mobile (verticale e orizzontale) i badge del campo, cioè ATK/DEF
// sotto i mostri e il contatore delle pile Deck/Cimitero/Extra Deck, non
// devono finire su carte di ALTRE caselle né su altri badge. Fra le righe
// del campo ci sono pochi pixel e i badge appesi fuori dalla casella ci
// cadevano sopra (segnalato dall'utente, 2026-10-16). Vedi il blocco
// @media (max-width: 900px) sotto .field-pile-badge in duelMonstersCore.html.
// Si controlla la PROPRIETÀ ("nessuna sovrapposizione"), non le misure, così
// un ritocco futuro alle dimensioni non rompe il test per forza.
const { openDuel, freezeNaturalGameLoop } = require('../helpers/harness');

const SCHERMI = [
    { nome: 'verticale 393', width: 393, height: 852 },
    { nome: 'verticale 360', width: 360, height: 780 },
    { nome: 'orizzontale 844', width: 844, height: 390 }
];

module.exports = {
    name: 'Badge del campo: niente sovrapposizioni su mobile',
    standalone: true,
    async run({ browser, assert }) {
        for (const schermo of SCHERMI) {
            const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: schermo.width, height: schermo.height } });
            const page = await context.newPage();
            try {
                await openDuel(page);
                await freezeNaturalGameLoop(page);
                // Vedi tests/README.md: la sequenza d'inizio turno è ancora in
                // corso al caricamento, si aspetta che arrivi in Main.
                await page.waitForFunction(() => gameState.currentPlayer === 'player' && gameState.phase === 'main1', null, { timeout: 15000 });
                await page.waitForTimeout(600);
                const conflitti = await page.evaluate(() => {
                    const make = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
                    const mostri = cardDatabase.filter((c) => c.type === 'monster' && !c.extraDeck).slice(0, 6).map((c) => c.id);
                    const m = (i, uid, pos, coperto) => ({ card: make(mostri[i], uid), position: pos, isFaceDown: !!coperto });
                    const coperta = (uid) => ({ card: make(40, uid), isFaceDown: true });
                    // Campo pieno: ogni mostro ha un vicino a destra e una
                    // Magia/Trappola sotto, il caso peggiore per i badge.
                    gameState.playerMonsterField = [m(0, 'a', 'attack'), m(1, 'b', 'defense', true), m(2, 'c', 'attack'), m(3, 'd', 'defense'), m(4, 'e', 'attack')];
                    gameState.botMonsterField = [m(0, 'ba', 'attack'), m(2, 'bb', 'attack'), m(5, 'bc', 'attack'), m(3, 'bd', 'defense'), m(4, 'be', 'attack')];
                    gameState.playerSTField = ['s1', 's2', 's3', 's4', 's5'].map(coperta);
                    gameState.botSTField = [coperta('t1'), null, coperta('t3'), null, null];
                    gameState.playerGraveyard = [make(40, 'g1'), make(40, 'g2')];
                    gameState.botGraveyard = [make(40, 'g3')];
                    updateUI();
                    const rect = (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, slot: e.closest('.field-slot'), w: b.width }; };
                    const badges = [...document.querySelectorAll('.field-stats-badge')]
                        .filter((e) => e.getBoundingClientRect().width > 0)
                        .map((e) => {
                            const misura = { testo: e.textContent.trim(), ...rect(e) };
                            const propriaCarta = e.classList.contains('field-pile-badge')
                                ? null : e.closest('.field-slot').querySelector(':scope > .card');
                            if (propriaCarta) {
                                const c = propriaCarta.getBoundingClientRect();
                                misura.bordoCarta = c.bottom;
                                misura.distanzaDalBordo = misura.y - c.bottom;
                            }
                            return misura;
                        });
                    const carte = [...document.querySelectorAll('.field-slot .card, .field-slot .deck-preview')]
                        .filter((e) => e.getBoundingClientRect().width > 0).map(rect);
                    const area = (a, c) => Math.max(0, Math.min(a.r, c.r) - Math.max(a.x, c.x)) * Math.max(0, Math.min(a.b, c.b) - Math.max(a.y, c.y));
                    const esito = [];
                    badges.forEach((b, i) => {
                        badges.slice(i + 1).forEach((c) => { if (area(b, c) > 1) esito.push(`badge "${b.testo}" su badge "${c.testo}"`); });
                        carte.forEach((c) => { if (c.slot !== b.slot && area(b, c) > 1) esito.push(`badge "${b.testo}" su una carta di un'altra casella`); });
                        // Con gli ologrammi (holo-on, scelta dell'utente 2026-10-25) i numeri si impilano e salgono
                        // sulla parte bassa della carta: restano però SOTTO il suo bordo superiore e non toccano altre caselle.
                        const holo = document.documentElement.classList.contains('holo-on');
                        const troppoAlto = holo && b.bordoCarta !== undefined && b.distanzaDalBordo < -40;
                        if (troppoAlto || (!holo && b.bordoCarta !== undefined && (b.distanzaDalBordo < -0.6 || b.distanzaDalBordo > 3))) {
                            esito.push(`badge "${b.testo}" non è appena sotto la propria carta (distanza ${b.distanzaDalBordo.toFixed(1)}px)`);
                        }
                    });
                    // Due scelte esplicite dell'utente (2026-10-16): ATK/DEF
                    // su UNA riga, mai su due; e nessuna pillola né bordo,
                    // solo i numeri in rilievo.
                    const stile = [...document.querySelectorAll('.field-stats-badge')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => {
                        const cs = getComputedStyle(e);
                        const r = e.getBoundingClientRect();
                        return {
                            testo: e.textContent.trim(),
                            // Con gli ologrammi sul telefono le due cifre sono impilate (vedi sopra): altezza fino a ~3 corpi.
                            unaRiga: r.height < parseFloat(cs.fontSize) * (document.documentElement.classList.contains('holo-on') && !e.classList.contains('field-pile-badge') ? 3.2 : 1.6),
                            senzaBox: (cs.backgroundColor === 'rgba(0, 0, 0, 0)' || cs.backgroundColor === 'transparent')
                                && parseFloat(cs.borderTopWidth) === 0 && cs.boxShadow === 'none'
                        };
                    });
                    stile.forEach((s) => {
                        if (!s.unaRiga) esito.push(`badge "${s.testo}" va su più righe`);
                        if (!s.senzaBox) esito.push(`badge "${s.testo}" ha ancora sfondo, bordo o ombra a box`);
                    });
                    return { esito, quanti: badges.length };
                });
                assert(conflitti.quanti >= 10, `${schermo.nome}: attesi almeno 10 badge in campo, trovati ${conflitti.quanti}`);
                assert(conflitti.esito.length === 0, `${schermo.nome}: badge sovrapposti -> ${conflitti.esito.slice(0, 5).join('; ')}`);
            } finally {
                await context.close();
            }
        }
    }
};
