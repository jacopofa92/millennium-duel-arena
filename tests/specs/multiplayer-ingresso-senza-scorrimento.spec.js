// Multiplayer: la schermata d'ingresso (Crea stanza / Entra con codice, e il formato nel Tag) sta TUTTA nello schermo e la pagina non scorre,
// a ogni modalita' e a ogni misura di telefono, in verticale e in orizzontale (richiesta dell'utente). Il contenuto deve anche starci davvero:
// se fosse piu' alto dello spazio fra la fotocamera e la barra in basso verrebbe tagliato dal blocco dello scorrimento.
const path = require('path');
const url = (m) => 'file:///' + path.join(__dirname, '..', '..', 'multiplayer.html').replace(/\\/g, '/') + '?modo=' + m;

module.exports = {
    name: 'Multiplayer: l\'ingresso non scorre e il contenuto ci sta, in ogni modalita e misura',
    standalone: true,
    async run({ browser, assert }) {
        for (const [w, h] of [[393, 852], [360, 640], [412, 915], [852, 393], [1366, 768]]) {
            for (const modo of ['duello', 'specchio', 'raid', 'tag']) {
                const mob = w < 900;
                const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, serviceWorkers: 'block' });
                await ctx.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.SALA_CLASSICA = true; });
                const page = await ctx.newPage();
                try {
                    await page.goto(url(modo));
                    await page.waitForSelector('#mpCreateBtn', { timeout: 20000 });
                    await page.waitForTimeout(1800);
                    const r = await page.evaluate(() => {
                        const lobby = document.getElementById('mpLobby').getBoundingClientRect();
                        const wrap = document.getElementById('mpLobbyScreen').getBoundingClientRect();
                        return { sh: document.documentElement.scrollHeight, ih: innerHeight, alto: Math.round(lobby.height), spazio: Math.round(wrap.height) };
                    });
                    assert(r.sh <= r.ih + 1, `${w}x${h} ${modo}: la pagina scorre (${r.sh} > ${r.ih})`);
                    assert(r.alto <= r.spazio, `${w}x${h} ${modo}: il contenuto (${r.alto}px) non ci sta nello spazio (${r.spazio}px)`);
                } finally { await ctx.close(); }
            }
        }
    }
};
