// Tavola del Destino: campo nel Regno delle Ombre e lettere D-E-A-T-H di fumo sopra le carte scoperte
// (js/ui/tavola-del-destino.js). Si usano solo due carte, perche' con tutte e cinque scatta la vittoria.
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'Tavola del Destino: velo scuro e lettere di fumo sulle carte scoperte, sparisce con le carte',
    async run({ page, assert }) {
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        await openDuel(page);
        await page.waitForFunction(() => !!window.TavolaDestino);
        await page.waitForTimeout(500);

        const a = await page.evaluate(async () => {
            const metti = (id, i, coperta) => {
                const c = Object.assign({}, cardDatabase.find((x) => x.id === id), { uid: 'td' + id });
                gameState.playerSTField[i] = { card: c, isFaceDown: !!coperta };
            };
            const stato = () => ({
                velo: !!document.getElementById('tavolaDestinoLayer'),
                tela: !!document.getElementById('tavolaDestinoFumo'),
                testi: document.querySelectorAll('#tavolaDestinoTesti .td-lettera').length,
                lettere: TavolaDestino.lettere().map((l) => l.lettera).join('')
            });
            const nessuna = (TavolaDestino.sync(), stato());
            // Una coperta non conta: la lettera non si rivela
            metti(866, 0, true); TavolaDestino.sync();
            const coperta = stato();
            // Ripiego ("Normali"): velo e lettere di testo
            window.TAVOLA_DESTINO_FUMO_OFF = true;
            metti(866, 0, false); metti(867, 1, false); updateUI();
            const testo = stato();
            // Fumo ("Alti"): una tela, nessun testo
            window.TAVOLA_DESTINO_FUMO_OFF = false;
            window.VideoQuality = Object.assign({}, window.VideoQuality, { isAlti: () => true });
            TavolaDestino.sync();
            await new Promise((s) => setTimeout(s, 400));
            const fumo = stato();
            const z = getComputedStyle(document.getElementById('tavolaDestinoLayer')).zIndex;
            const gz = getComputedStyle(document.querySelector('.game-container')).zIndex;
            // Tolte le carte, ogni traccia sparisce
            gameState.playerSTField[0] = null; gameState.playerSTField[1] = null;
            TavolaDestino.sync();
            return { nessuna, coperta, testo, fumo, dopo: stato(), z, gz };
        });
        assert(!a.nessuna.velo && !a.coperta.velo, `Senza carte scoperte non c'e' nulla: ${JSON.stringify(a)}`);
        assert(a.testo.velo && a.testo.testi === 2 && a.testo.lettere === 'DE', `Velo e lettere D, E (ripiego): ${JSON.stringify(a.testo)}`);
        assert(a.fumo.velo && a.fumo.tela && a.fumo.testi === 0, `Con i Dettagli Alti c'e' la tela del fumo: ${JSON.stringify(a.fumo)}`);
        assert(Number(a.z) < Number(a.gz), `Il velo sta sotto le carte: ${JSON.stringify({ z: a.z, gz: a.gz })}`);
        assert(!a.dopo.velo && !a.dopo.tela && a.dopo.testi === 0, `Tolte le carte sparisce tutto: ${JSON.stringify(a.dopo)}`);
        assert(errori.length === 0, `Errori: ${errori.join(' | ')}`);
    }
};
