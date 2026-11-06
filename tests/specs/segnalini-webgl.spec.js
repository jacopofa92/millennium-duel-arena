// I segnalini sulle carte (card.counters): in BASSO, CENTRATI sulla carta, e disegnati in WebGL (js/ui/segnalini-webgl.js).
// Il badge DOM resta (invisibile) e fissa posizione e numero; senza WebGL / spento / "Normali" vale il disco d'oro CSS, nella stessa
// posizione. Un guasto (contesto perso) restituisce i badge al CSS senza perdere i numeri.
module.exports = {
    name: 'Segnalini: in basso al centro della carta, in WebGL con ripiego CSS',
    async run(t) {
        await t.evaluate(() => {
            if (typeof clearPhaseTransitionTimeout === 'function') clearPhaseTransitionTimeout();
            localStorage.setItem('ygoVideoDetail', 'alti'); localStorage.setItem('ygoVideoDetailScelto', '1');
            const mostri = cardDatabase.filter((c) => c.type === 'monster' && !c.extraDeck).slice(0, 3);
            gameState.playerSTField = [null, null, null, null, null];
            gameState.botSTField = [null, null, null, null, null];
            gameState.playerMonsterField = [
                { card: { ...mostri[0], uid: 'sg1', counters: 3 }, position: 'attack', isFaceDown: false, hasAttacked: false },
                { card: { ...mostri[1], uid: 'sg2', counters: 12 }, position: 'defense', isFaceDown: false, hasAttacked: false },
                { card: { ...mostri[2], uid: 'sg3', counters: 0 }, position: 'attack', isFaceDown: false, hasAttacked: false }, null, null];
            window.SEGNALINI_WEBGL_OFF = false;
            updateUI();
        });
        await t.page.waitForTimeout(600);
        const lettura = () => t.evaluate(() => ({
            gl: !!(window.SegnaliniGL && SegnaliniGL.attivo()),
            classe: document.documentElement.classList.contains('segnalini-gl'),
            errore: window.SEGNALINI_GL_ERRORE || null,
            livelli: document.querySelectorAll('#segnaliniLayer').length,
            badge: [...document.querySelectorAll('.field-counter-badge')].map((e) => {
                const r = e.getBoundingClientRect();
                const c = e.parentElement.querySelector('.card').getBoundingClientRect();
                return { n: e.textContent, dx: Math.round(r.left + r.width / 2 - (c.left + c.width / 2)), cy: Math.round(r.top + r.height / 2), cartaCy: Math.round(c.top + c.height / 2), cartaBasso: Math.round(c.bottom), opacita: getComputedStyle(e).opacity };
            })
        }));

        let r = await lettura();
        t.assert(r.badge.length === 2, `un badge per ogni carta con segnalini (la carta a zero non ne ha): ${JSON.stringify(r.badge)}`);
        t.assert(r.badge.every((b) => Math.abs(b.dx) <= 2), `i badge sono CENTRATI sulla carta: ${JSON.stringify(r.badge)}`);
        t.assert(r.badge.every((b) => b.cy > b.cartaCy && b.cy <= b.cartaBasso), `e stanno nella parte BASSA della carta: ${JSON.stringify(r.badge)}`);
        t.assert(r.gl && r.classe && r.livelli === 1 && !r.errore, `con Dettagli Alti i segnalini sono in WebGL (un solo livello): ${JSON.stringify({ gl: r.gl, classe: r.classe, livelli: r.livelli, errore: r.errore })}`);
        t.assert(r.badge.every((b) => b.opacita === '0'), 'il badge DOM e\' invisibile mentre c\'e\' la versione WebGL');

        // Spento a mano: torna il disco CSS, nella stessa posizione, e il livello sparisce (il contesto si rilascia).
        await t.evaluate(() => { window.SEGNALINI_WEBGL_OFF = true; updateUI(); });
        r = await lettura();
        t.assert(!r.gl && !r.classe && r.livelli === 0, `spento, il livello WebGL non c'e' piu': ${JSON.stringify({ gl: r.gl, classe: r.classe, livelli: r.livelli })}`);
        t.assert(r.badge.every((b) => b.opacita === '1' && Math.abs(b.dx) <= 2), `il disco CSS e' visibile e centrato: ${JSON.stringify(r.badge)}`);

        // Un numero che cambia aggiorna il badge e il WebGL riparte senza errori.
        await t.evaluate(() => { window.SEGNALINI_WEBGL_OFF = false; gameState.playerMonsterField[0].card.counters = 5; updateUI(); });
        await t.page.waitForTimeout(400);
        r = await lettura();
        t.assert(r.gl && r.badge.some((b) => b.n === '5') && !r.errore, `riacceso, mostra il nuovo numero: ${JSON.stringify(r.badge)}`);

        // Finiti i segnalini il livello si smonta.
        await t.evaluate(() => { gameState.playerMonsterField.forEach((s) => { if (s) s.card.counters = 0; }); updateUI(); });
        await t.page.waitForTimeout(200);
        r = await lettura();
        t.assert(!r.gl && r.livelli === 0 && r.badge.length === 0, `senza segnalini il livello WebGL e' rilasciato: ${JSON.stringify({ gl: r.gl, livelli: r.livelli })}`);
    }
};
