// La carta Settata (coperta) in WebGL: un riflesso sul dorso e un lampo quando si scopre
// (js/ui/monster-hologram-webgl.js + monster-hologram.js, `syncSettate`).
//   - c'e' per ogni carta VISIVAMENTE coperta sul Terreno (mostro in Difesa coperta, Magia/Trappola Set, di entrambi i lati),
//     solo con "Dettagli video: Alti", e non per le carte scoperte;
//   - funziona anche su file:// (nessuna texture), a differenza degli ologrammi;
//   - e' IDENTICO per ogni carta: il modulo non riceve il tipo ne' l'identita' (altrimenti il colore tradirebbe una Trappola);
//   - quando una carta si scopre parte un lampo; se la carta sparisce (distrutta) no;
//   - si disegna davvero (alpha > 0 sul canvas, sul dorso e non lontano).
const path = require('path');

const RADICE = path.join(__dirname, '..', '..');

async function apri(browser, livello) {
    const context = await browser.newContext({ viewport: { width: 900, height: 800 }, serviceWorkers: 'block' });
    await context.addInitScript((lv) => {
        window.AUTH_GATE_SKIP = true; window.DUEL_FAST_OPENING = true; window.DUEL_RPS_SKIP = true;
        try { localStorage.setItem('ygoVideoDetail', lv); localStorage.setItem('ygoVideoDetailScelto', '1'); } catch (e) { /* noop */ }
    }, livello);
    const page = await context.newPage();
    const errori = [];
    page.on('pageerror', (e) => errori.push(e.message));
    await page.goto('file:///' + RADICE.replace(/\\/g, '/') + '/duelMonstersCore.html');
    await page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.playerHand && gameState.playerHand.length > 0 && window.MonsterHolograms && window.MonsterHologramGL, null, { timeout: 30000 });
    await page.waitForTimeout(1200);
    return { context, page, errori };
}

/** Un Terreno di prova: due mostri coperti (uno per lato), una Magia e una Trappola Set, un mostro scoperto. */
async function allestisci(page) {
    await page.evaluate(() => {
        const mk = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
        const magia = cardDatabase.find((c) => c.type === 'spell' && c.subtype === 'normal');
        const trappola = cardDatabase.find((c) => c.type === 'trap');
        gameState.currentPlayer = 'player';
        gameState.playerMonsterField = [null, { card: mk(1, 's1'), position: 'defense', isFaceDown: true }, { card: mk(7, 's2'), position: 'attack', isFaceDown: false }, null, null];
        gameState.botMonsterField = [null, { card: mk(4, 's3'), position: 'defense', isFaceDown: true }, null, null, null];
        gameState.playerSTField = [{ card: { ...magia, uid: 's4' }, isFaceDown: true }, { card: { ...trappola, uid: 's5' }, isFaceDown: true }, null, null, null];
        gameState.botSTField = [null, null, null, null, null];
        updateUI();
    });
}

module.exports = {
    name: 'Carta Settata in WebGL: riflesso sul dorso, uguale per tutte, lampo alla rivelazione',
    standalone: true,
    async run({ browser, assert }) {
        // --- Dettagli Alti ---
        {
            const { context, page, errori } = await apri(browser, 'alti');
            try {
                await allestisci(page);
                await page.waitForFunction(() => MonsterHologramGL.settateAttive() === 4, null, { timeout: 10000 });
                const s = await page.evaluate(() => ({
                    n: MonsterHologramGL.settateAttive(), campi: MonsterHologramGL.campiSettata(),
                    canvas: !!document.querySelector('#monsterHologramLayer > canvas'), guasto: MonsterHologramGL.guasto()
                }));
                assert(s.n === 4 && s.canvas && !s.guasto, `4 carte coperte (2 mostri, Magia, Trappola) brillano, il mostro scoperto no: ${JSON.stringify(s)}`);
                // L'effetto non porta l'identita' della carta: solo dove sta e un seme casuale.
                const vietati = s.campi.filter((c) => /card|tipo|type|id|uid|nome|name|subtype/i.test(c));
                assert(vietati.length === 0, `Il modulo non deve conoscere cosa e' la carta coperta: ${JSON.stringify(s.campi)}`);

                // Si disegna davvero: dopo un fotogramma c'e' alpha sul dorso della carta e non in un angolo vuoto.
                const px = await page.evaluate(() => new Promise((resolve) => {
                    const canvas = document.querySelector('#monsterHologramLayer > canvas');
                    const gl = canvas.getContext('webgl');
                    const el = document.querySelector('#playerFieldBoard .field-slot[data-type="monster"] .card.face-down');
                    const r = el.getBoundingClientRect();
                    const k = canvas.width / window.innerWidth;
                    const conta = (x, y, w, h) => {
                        const n = Math.max(1, Math.floor(w * k)); const m = Math.max(1, Math.floor(h * k));
                        const buf = new Uint8Array(n * m * 4);
                        gl.readPixels(Math.floor(x * k), Math.floor(canvas.height - (y + h) * k), n, m, gl.RGBA, gl.UNSIGNED_BYTE, buf);
                        let c = 0; for (let i = 3; i < buf.length; i += 4) if (buf[i] > 8) c++;
                        return c;
                    };
                    // Dopo ogni callback di fotogramma si legge il canvas (il buffer vale fino alla presentazione): si tiene il massimo.
                    const orig = window.requestAnimationFrame.bind(window);
                    let frames = 0; let massimo = 0; let angolo = 0;
                    window.requestAnimationFrame = (cb) => orig((t) => {
                        cb(t);
                        massimo = Math.max(massimo, conta(r.left - 6, r.top - 6, r.width + 12, r.height + 12));
                        angolo = Math.max(angolo, conta(0, 0, 40, 40));
                        if (++frames === 60) resolve({ sulDorso: massimo, angolo: angolo });
                    });
                }));
                assert(px.sulDorso > 40, `Il riflesso/bordo si vede sul dorso della carta (pixel accesi: ${px.sulDorso})`);
                assert(px.angolo === 0, `E non in un angolo vuoto dello schermo (${px.angolo})`);

                // Una carta si scopre: lampo. Una sparisce (distrutta): nessun lampo.
                await page.evaluate(() => { gameState.playerMonsterField[1].isFaceDown = false; updateUI(); });
                await page.waitForFunction(() => MonsterHologramGL.lampiAttivi() >= 1, null, { timeout: 5000 });
                assert(await page.evaluate(() => MonsterHologramGL.settateAttive()) === 3, 'dopo la rivelazione restano 3 carte coperte');
                await page.waitForFunction(() => MonsterHologramGL.lampiAttivi() === 0, null, { timeout: 5000 });
                await page.evaluate(() => { gameState.playerSTField[1] = null; updateUI(); });
                await page.waitForFunction(() => MonsterHologramGL.settateAttive() === 2, null, { timeout: 5000 });
                assert(await page.evaluate(() => MonsterHologramGL.lampiAttivi()) === 0, 'una carta coperta che sparisce non fa nessun lampo');

                // Il movimento ridotto la spegne (e svuota).
                await page.evaluate(() => { window.SETTATA_WEBGL_OFF = true; gameState.playerSTField[1] = { card: { ...cardDatabase.find((c) => c.type === 'trap'), uid: 's9' }, isFaceDown: true }; updateUI(); });
                await page.waitForTimeout(300);
                assert(await page.evaluate(() => MonsterHologramGL.settateAttive()) === 2, 'con SETTATA_WEBGL_OFF non se ne aggiungono altre');
                assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
            } finally { await context.close(); }
        }

        // --- Dettagli Normali: niente ---
        {
            const { context, page, errori } = await apri(browser, 'normali');
            try {
                await allestisci(page);
                await page.waitForTimeout(600);
                const s = await page.evaluate(() => ({ n: MonsterHologramGL.settateAttive(), canvas: !!document.querySelector('#monsterHologramLayer > canvas') }));
                assert(s.n === 0, `Con "Normali" nessuna carta coperta brilla: ${JSON.stringify(s)}`);
                assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
            } finally { await context.close(); }
        }
    }
};
