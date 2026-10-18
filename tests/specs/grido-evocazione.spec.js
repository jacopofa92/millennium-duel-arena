// Il grido di Evocazione (js/ui/grido-evocazione.js, dati in
// js/data/gridi-evocazione.js): il duellante annuncia la sua carta simbolo
// PRIMA che venga Evocata. Si controlla il contratto, non l'aspetto:
//  - i dati: ogni voce punta a una carta vera, e Kaiba ha lo stesso grido in
//    tutti i suoi aspetti;
//  - Evocazione Normale: la carta resta in mano finché dura la scena, poi
//    arriva in campo (il flusso standard riparte da solo);
//  - Evocazione Speciale: la scena c'è, la carta è già in campo (la regola è
//    sincrona), e la parte visiva aspetta;
//  - niente grido per un Set, per un duellante senza voce, per la stessa
//    carta una seconda volta, e un tocco la salta.
const { openDuel, freezeNaturalGameLoop } = require('../helpers/harness');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'Grido di Evocazione: il duellante annuncia la carta simbolo prima della sua Evocazione',
    standalone: true,
    async run({ browser, assert }) {
        const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1400, height: 900 } });
        const page = await context.newPage();
        try {
            await openDuel(page);
            await freezeNaturalGameLoop(page);
            await page.waitForFunction(() => gameState.currentPlayer === 'player' && gameState.phase === 'main1', null, { timeout: 15000 });

            // --- I dati ---
            const dati = await page.evaluate(() => {
                const manca = GRIDI_EVOCAZIONE.filter((v) => !cardDatabase.some((c) => c.id === v.carta)).map((v) => v.carta);
                const lunghe = GRIDI_EVOCAZIONE.filter((v) => v.grido.length > 62).map((v) => v.grido);
                const coppie = new Set(); const doppie = [];
                GRIDI_EVOCAZIONE.forEach((v) => v.chi.forEach((c) => { const k = c + ':' + v.carta; if (coppie.has(k)) doppie.push(k); coppie.add(k); }));
                return {
                    manca, lunghe, doppie,
                    kaiba: ['setoKaiba.jpg', 'setoKaiba_duelist_Kingdom.png', 'kaibaV2.png'].map((f) => trovaGridoEvocazione('images/characters/' + f, 1)),
                    nessuno: trovaGridoEvocazione('images/characters/mirror.jpg', 1),
                    // I tre Duellanti Extra hanno la voce per la loro carta simbolo.
                    extra: [['rg.jpg', 472], ['albertoAngela.jpg', 709], ['alessandroBarbero.jpg', 1280]].map(([file, carta]) => trovaGridoEvocazione('images/characters/' + file, carta)),
                    personaggi: Array.from(new Set(GRIDI_EVOCAZIONE.flatMap((v) => v.chi).map((chi) => chi === 'kaiba' ? 'setoKaiba' : chi)))
                };
            });
            assert(dati.manca.length === 0, `gridi che puntano a carte inesistenti: ${dati.manca}`);
            assert(dati.lunghe.length === 0, `gridi troppo lunghi per un telefono: ${dati.lunghe}`);
            assert(dati.doppie.length === 0, `due gridi per lo stesso duellante e la stessa carta: ${dati.doppie}`);
            assert(dati.kaiba.every((g) => g && g === dati.kaiba[0]), 'Kaiba deve avere lo stesso grido in tutti i suoi aspetti');
            assert(dati.nessuno === null, 'un duellante senza voce non deve avere un grido');
            assert(dati.extra.every((g) => !!g), 'Giacobbo, Angela e Barbero devono avere il grido della loro carta simbolo: ' + JSON.stringify(dati.extra));
            const pedineMancanti = dati.personaggi.filter((nome) => !fs.existsSync(path.join(process.cwd(), 'images', 'characters', 'pedine-esclamazione', nome + '.png')));
            assert(pedineMancanti.length === 0, `mancano pose di esclamazione per: ${pedineMancanti.join(', ')}`);

            // --- Evocazione Normale ---
            const normale = await page.evaluate(async () => {
                window.GRIDO_EVOCAZIONE_FORZA = true;
                DuelSession.player = { ...DuelSession.player, name: 'Yugi Muto', image: 'images/characters/yugiMuto.jpg' };
                DuelSession.opponent = { ...DuelSession.opponent, name: 'Seto Kaiba', image: 'images/characters/setoKaiba.jpg' };
                const maga = { ...cardDatabase.find((c) => c.id === 188), uid: 'k1' };
                gameState.playerHand.push(maga);
                summonMonster(maga, 0, 'attack', gameState.playerHand.length - 1);
                await new Promise((r) => setTimeout(r, 900));
                const durante = { scena: !!document.getElementById('gridoEvocazione'), inCampo: !!gameState.playerMonsterField[0], inMano: gameState.playerHand.includes(maga) };
                // Si vede il personaggio giusto col suo grido.
                durante.testo = ((document.querySelector('#gridoEvocazione .ge-grido') || {}).textContent || '').trim();
                const figura = document.querySelector('#gridoEvocazione .ge-figura');
                durante.figura = figura ? figura.getAttribute('src') : '';
                await new Promise((r) => setTimeout(r, 2800));
                return { durante, dopo: { scena: !!document.getElementById('gridoEvocazione'), inCampo: !!gameState.playerMonsterField[0] } };
            });
            assert(normale.durante.scena, 'durante l\'Evocazione Normale la scena del grido deve essere a schermo');
            assert(normale.durante.inMano && !normale.durante.inCampo, 'la carta deve restare in mano finché dura il grido');
            assert(normale.durante.testo === 'Maga Oscura, rispondi alla mia chiamata!', `grido sbagliato: ${normale.durante.testo}`);
            assert(/pedine-esclamazione\/yugiMuto\.png$/.test(normale.durante.figura || ''), `il grido deve usare la posa di esclamazione: ${normale.durante.figura}`);
            assert(!normale.dopo.scena && normale.dopo.inCampo, 'finito il grido la carta deve arrivare in campo col flusso standard');

            // --- Stessa carta una seconda volta: niente scena ---
            const secondo = await page.evaluate(async () => {
                let fatto = false;
                GridoEvocazione.mostra({ posto: 'player', carta: { ...cardDatabase.find((c) => c.id === 188), uid: 'k2' } }, () => { fatto = true; });
                await new Promise((r) => setTimeout(r, 200));
                return { fatto, scena: !!document.getElementById('gridoEvocazione') };
            });
            assert(secondo.fatto && !secondo.scena, 'lo stesso grido non si ripete nello stesso duello');

            // --- Evocazione Speciale dell'avversario: carta già in campo, scena a schermo ---
            const speciale = await page.evaluate(async () => {
                const drago = { ...cardDatabase.find((c) => c.id === 1), uid: 'dd' };
                DuelEngine.actions.specialSummon.call({ owner: 'bot' }, 'bot', drago, 0, 'attack', 'hand');
                const subito = { inCampo: !!gameState.botMonsterField[0] };
                await new Promise((r) => setTimeout(r, 800));
                const scena = document.getElementById('gridoEvocazione');
                const out = { ...subito, scena: !!scena, contatore: FX.isCinematicPlaying() };
                // Un tocco la salta.
                scena.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                await new Promise((r) => setTimeout(r, 400));
                out.dopoTocco = !!document.getElementById('gridoEvocazione');
                return out;
            });
            assert(speciale.inCampo, 'nella Special Summon lo stato è già cambiato quando parte il grido');
            assert(speciale.scena, 'la Special Summon deve mostrare il grido');
            assert(speciale.contatore, 'la scena deve segnarsi come cinematica in corso (il bot aspetta)');
            assert(!speciale.dopoTocco, 'un tocco deve saltare la scena');

            // --- Set coperto e duellante senza voce: nessuna scena, e fatto subito ---
            const niente = await page.evaluate(async () => {
                const kaiser = { ...cardDatabase.find((c) => c.id === 2), uid: 'mn' };
                let fattoA = false;
                // Il bot ha Kaiba: per il Mago Nero non c'è una voce.
                GridoEvocazione.mostra({ posto: 'bot', carta: kaiser }, () => { fattoA = true; });
                await new Promise((r) => setTimeout(r, 150));
                return { fattoA, scena: !!document.getElementById('gridoEvocazione') };
            });
            assert(niente.fattoA && !niente.scena, 'senza una voce per quella carta il flusso deve ripartire subito');
        } finally {
            await context.close();
        }
    }
};
