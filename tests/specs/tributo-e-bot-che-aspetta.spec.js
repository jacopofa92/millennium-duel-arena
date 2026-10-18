// Tre difetti segnalati giocando, un solo spec:
//
//  1) Un'Evocazione Tributo non si può Settare: sacrificare mostri e metterlo
//     coperto in Difesa non è permesso (a meno che la carta lo dica). Vale per
//     chiunque Evochi: persona, IA, comando arrivato dall'altro client.
//  2) Drago Mascherato: chi controlla la Summon sceglie la Posizione, e un
//     mostro in Difesa scelto così resta SCOPERTO (Special Summon).
//  3) Il bot aspetta le scelte del giocatore: se un attacco fa partire una
//     scelta (Drago Mascherato che cerca nel Deck), il bot NON attacca finché non
//     ha finito, e poi decide il bersaglio sul campo com'è ADESSO (il mostro
//     appena comparso, non un attacco diretto deciso prima).
const { openDuel, freezeNaturalGameLoop } = require('../helpers/harness');

module.exports = {
    name: 'Tributo non si Setta, Drago Mascherato sceglie la Posizione, il bot aspetta le scelte del giocatore',
    standalone: true,
    async run({ browser, assert }) {
        const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1400, height: 900 } });
        const page = await context.newPage();
        try {
            await openDuel(page);
            // freezeNaturalGameLoop spegne botPerformAttacks: qui serve quello vero.
            await page.evaluate(() => { window.__botAttacchiVeri = botPerformAttacks; });
            await freezeNaturalGameLoop(page);
            await page.evaluate(() => { window.botPerformAttacks = window.__botAttacchiVeri; });
            await page.waitForFunction(() => gameState.currentPlayer === 'player' && gameState.phase === 'main1', null, { timeout: 15000 });
            await page.waitForTimeout(1200);

            // ---------- 1) Tributo + Difesa ----------
            const tributo = await page.evaluate(async () => {
                const mk = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
                const out = {};
                const svuota = () => {
                    ['playerMonsterField', 'botMonsterField', 'playerSTField', 'botSTField'].forEach((k) => { gameState[k] = [null, null, null, null, null]; });
                };
                for (const posto of ['player', 'bot']) {
                    svuota();
                    gameState.hasNormalSummoned = false;
                    const campo = posto === 'player' ? gameState.playerMonsterField : gameState.botMonsterField;
                    const mano = posto === 'player' ? gameState.playerHand : gameState.botHand;
                    campo[0] = { card: mk(4, 'a-' + posto), position: 'attack', isFaceDown: false };
                    campo[1] = { card: mk(4, 'b-' + posto), position: 'attack', isFaceDown: false };
                    const drago = mk(1, 'bianco-' + posto);
                    mano.push(drago);
                    await new Promise((resolve) => {
                        Comandi.esegui(posto, { tipo: 'tributa', indici: [0, 1], perCarta: drago.uid, attesaMs: 0 }, {
                            dopo: () => {
                                Comandi.esegui(posto, { tipo: 'evoca', carta: drago.uid, mano: mano.indexOf(drago), casella: 0, posizione: 'defense' }, { alTermine: resolve });
                            }
                        });
                    });
                    await new Promise((r) => setTimeout(r, 1500));
                    const s = campo.find((x) => x && x.card.uid === drago.uid);
                    out[posto] = s ? { posizione: s.position, coperto: s.isFaceDown } : null;
                }
                // Controllo: SENZA Tributo, il Set in Difesa resta possibile.
                svuota();
                const piccolo = mk(4, 'piccolo');
                gameState.botHand.push(piccolo);
                gameState.hasNormalSummoned = false;
                await new Promise((resolve) => {
                    Comandi.esegui('bot', { tipo: 'evoca', carta: piccolo.uid, mano: gameState.botHand.indexOf(piccolo), casella: 3, posizione: 'defense' }, { alTermine: resolve });
                });
                await new Promise((r) => setTimeout(r, 1500));
                const sp = gameState.botMonsterField.find((x) => x && x.card.uid === 'piccolo');
                out.senzaTributo = sp ? { posizione: sp.position, coperto: sp.isFaceDown } : null;
                return out;
            });
            assert(tributo.player && tributo.player.posizione === 'attack' && !tributo.player.coperto, 'persona: Tributo + Difesa deve diventare Attacco scoperto: ' + JSON.stringify(tributo.player));
            assert(tributo.bot && tributo.bot.posizione === 'attack' && !tributo.bot.coperto, 'IA: Tributo + Difesa deve diventare Attacco scoperto: ' + JSON.stringify(tributo.bot));
            if (tributo.senzaTributo) {
                assert(tributo.senzaTributo.posizione === 'defense' && tributo.senzaTributo.coperto, 'senza Tributo il Set in Difesa resta possibile: ' + JSON.stringify(tributo.senzaTributo));
            }

            // ---------- 2) e 3) Drago Mascherato e il bot che aspetta ----------
            await page.evaluate(() => {
                const mk = (id, uid) => ({ ...cardDatabase.find((c) => c.id === id), uid });
                ['playerMonsterField', 'botMonsterField', 'playerSTField', 'botSTField'].forEach((k) => { gameState[k] = [null, null, null, null, null]; });
                gameState.playerMonsterField[1] = { card: mk(644, 'mask'), position: 'attack', isFaceDown: false, hasAttacked: false };
                gameState.botMonsterField[0] = { card: mk(1, 'bd1'), position: 'attack', isFaceDown: false, hasAttacked: false };
                gameState.botMonsterField[2] = { card: mk(12, 'bd2'), position: 'attack', isFaceDown: false, hasAttacked: false };
                const draghi = cardDatabase.filter((c) => c.type === 'monster' && c.race === 'Drago' && c.attack <= 1500 && c.id !== 644).slice(0, 3).map((c, i) => ({ ...c, uid: 'dr' + i }));
                gameState.playerDeck = draghi.concat(gameState.playerDeck || []);
                gameState.turn = 5; gameState.currentPlayer = 'bot'; gameState.phase = 'battle';
                // Si registra OGNI attacco del bot: istante, bersaglio e se il giocatore aveva una scelta aperta.
                window.__attacchi = [];
                const vera = window.resolveAttack;
                window.resolveAttack = function (posto, attaccante, bersaglio, fine) {
                    window.__attacchi.push({ t: performance.now(), posto, attaccante, bersaglio, sceltaAperta: !!document.querySelector('.modal-backdrop.open, #quickPopover') });
                    return vera.apply(this, arguments);
                };
                updateUI();
                window.__finito = false;
                botPerformAttacks(0, null, 'bot').then(() => { window.__finito = true; });
            });
            // Il "giocatore": quando compare la scelta aspetta un po' (il bot deve restare fermo), poi sceglie.
            const t = { scelta: null, posizione: null };
            const limite = Date.now() + 45000;
            while (Date.now() < limite) {
                await page.waitForTimeout(200);
                if (!t.scelta && await page.locator('.modal-backdrop.open .card').count()) {
                    t.scelta = await page.evaluate(() => ({ t: performance.now(), attacchiPrima: window.__attacchi.length }));
                    await page.waitForTimeout(3000);
                    t.attacchiDurante = await page.evaluate(() => window.__attacchi.length);
                    await page.locator('.modal-backdrop.open .card').first().click();
                }
                if (t.scelta && !t.posizione && await page.locator('#quickPopover .quick-popover-btn.defense').count()) {
                    t.posizione = await page.evaluate(() => ({ t: performance.now(), attacchi: window.__attacchi.length }));
                    await page.waitForTimeout(1500);
                    t.attacchiDuranteLaPosizione = await page.evaluate(() => window.__attacchi.length);
                    await page.locator('#quickPopover .quick-popover-btn.defense').click();
                }
                if (await page.evaluate(() => window.__finito)) break;
            }
            const r = await page.evaluate(() => ({
                attacchi: window.__attacchi,
                finito: window.__finito,
                nuovo: gameState.playerMonsterField.map((s, i) => (s ? { i, nome: s.card.name, pos: s.position, coperto: s.isFaceDown, sp: !!s.wasSpecialSummoned } : null)).filter(Boolean)
            }));
            assert(t.scelta, 'la scelta del Drago non è comparsa');
            assert(t.attacchiDurante === t.scelta.attacchiPrima, `il bot ha attaccato mentre il giocatore sceglieva il Drago (${t.scelta.attacchiPrima} -> ${t.attacchiDurante})`);
            assert(t.posizione, 'la scelta della Posizione non è comparsa: il giocatore deve poter scegliere Attacco o Difesa');
            assert(t.attacchiDuranteLaPosizione === t.posizione.attacchi, 'il bot ha attaccato mentre il giocatore sceglieva la Posizione');
            assert(r.attacchi.every((a) => !a.sceltaAperta), 'un attacco del bot è partito con una scelta del giocatore aperta');
            assert(r.attacchi.length === 2, `il bot doveva fare 2 attacchi, ne ha fatti ${r.attacchi.length}`);
            const nuovo = r.nuovo.find((x) => x.sp);
            // Il Drago Mascherato sceglie anche la Posizione: Difesa SCOPERTA (Special Summon).
            if (nuovo) assert(nuovo.pos === 'defense' && nuovo.coperto === false, 'il Drago Special Summonato in Difesa deve restare scoperto: ' + JSON.stringify(nuovo));
            // Il secondo attacco guarda il campo com'è ADESSO: c'è il nuovo mostro, quindi non è un attacco diretto.
            assert(r.attacchi[1].bersaglio !== -1 && r.attacchi[1].bersaglio !== null && r.attacchi[1].bersaglio !== undefined, 'il secondo attacco doveva colpire il mostro comparso, non il giocatore direttamente: ' + JSON.stringify(r.attacchi[1]));
        } finally {
            await context.close();
        }
    }
};
