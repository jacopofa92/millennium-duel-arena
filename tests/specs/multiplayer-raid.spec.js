// Multiplayer: RAID COOPERATIVO (regola della stanza, js/multiplayer/mp-lobby.js + mp-raid.js).
// Ognuno duella da solo contro lo stesso Boss; il danno dell'uno scala la barra dell'altro e viceversa.
// `standalone: true`: due pagine e un relay vero.
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

const BOSS = 'kaiba';

module.exports = {
    name: 'Multiplayer: raid cooperativo, la barra del Boss e\' una sola',
    standalone: true,
    async run({ browser, assert }) {
        const statics = await startStaticServer();
        const room = await startRoomServer();
        const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
        const errori = [];
        try {
            const apri = async (etichetta) => {
                const page = await context.newPage();
                page.on('pageerror', (e) => errori.push(`[${etichetta}] ${e.message}`));
                await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.DUEL_RPS_SKIP = true; window.DUEL_FAST_OPENING = true; });
                await page.goto(statics.origin + '/multiplayer.html', { waitUntil: 'load' });
                await page.waitForSelector('#mpCreateBtn');
                await page.waitForFunction(() => { const el = document.getElementById('pageLoader'); return !el || el.classList.contains('page-loader-hidden'); }, { timeout: 15000 });
                await page.evaluate(() => { const a = document.querySelector('.mp-advanced'); if (a) a.open = true; });
                await page.fill('#mpServerUrl', room.wsUrl);
                return page;
            };
            const host = await apri('host');
            const ospite = await apri('ospite');

            await host.click('#mpCreateBtn');
            await host.waitForFunction(() => { const el = document.getElementById('mpRoomCodeValue'); return el && /^[A-Z0-9]{5}$/.test(el.textContent.trim()); }, { timeout: 15000 });
            const codice = (await host.textContent('#mpRoomCodeValue')).trim();
            await ospite.click('#mpTabJoin');
            await ospite.fill('#mpJoinCode', codice);
            await ospite.click('#mpJoinBtn');
            await host.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
            await ospite.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });

            // L'ospite non puo' toccare la regola; l'host la accende.
            const bloccato = await ospite.evaluate(() => document.getElementById('mpRaidOn').disabled);
            assert(bloccato, 'L\'ospite vede il raid in sola lettura');
            await host.check('#mpRaidOn');
            await host.selectOption('#mpRaidBoss', BOSS);
            await ospite.waitForFunction((id) => document.getElementById('mpRaidOn').checked && document.getElementById('mpRaidBoss').value === id, BOSS, { timeout: 10000 });

            await host.click('#mpReadyBtn');
            await ospite.click('#mpReadyBtn');

            const pronto = (page) => page.waitForFunction(() => typeof gameState !== 'undefined' && gameState.botLP > 0 && !!document.getElementById('mpRaidBar') && window.MP_RAID === true, null, { timeout: 90000 });
            await Promise.all([pronto(host), pronto(ospite)]);
            const lp = (page) => page.evaluate(() => gameState.botLP);
            // Dopo il primo giro del controllo la barra comune e' piena su entrambi.
            await host.waitForFunction(() => gameState.botLP === 16000, null, { timeout: 10000 });
            await ospite.waitForFunction(() => gameState.botLP === 16000, null, { timeout: 10000 });

            // L'host colpisce il Boss per 3000: la barra dell'ospite scende uguale.
            await host.evaluate(() => { gameState.botLP -= 3000; });
            await ospite.waitForFunction(() => gameState.botLP === 13000, null, { timeout: 10000 });
            // L'ospite colpisce per 2000: scende anche quella dell'host, e nessuno dei due ricontano i colpi dell'altro.
            await ospite.evaluate(() => { gameState.botLP -= 2000; });
            await host.waitForFunction(() => gameState.botLP === 11000, null, { timeout: 10000 });
            await new Promise((r) => setTimeout(r, 1500));
            assert((await lp(host)) === 11000 && (await lp(ospite)) === 11000, `Barra comune uguale: ${await lp(host)} / ${await lp(ospite)}`);
            // CAMPO DEL COMPAGNO (sola lettura): l'ospite mette un mostro scoperto, uno coperto e ha carte in mano; l'host
            // le guarda dal tasto col ritratto del compagno.
            await ospite.evaluate(() => {
                const mod = cardDatabase.find((c) => c.type === 'monster' && !c.extraDeck && c.attack > 0);
                gameState.playerMonsterField[0] = { card: Object.assign({}, mod, { uid: 'prova-a' }), position: 'attack', isFaceDown: false };
                gameState.playerMonsterField[1] = { card: Object.assign({}, mod, { uid: 'prova-b' }), position: 'defense', isFaceDown: true };
                window.__nomeProva = mod.name;
                window.__manoProva = gameState.playerHand.length;
            });
            const nomeProva = await ospite.evaluate(() => window.__nomeProva);
            const manoProva = await ospite.evaluate(() => window.__manoProva);
            await host.waitForSelector('.mpr-tasto', { timeout: 5000 });
            await host.click('.mpr-tasto');
            await host.waitForFunction(() => document.querySelectorAll('#mpRaidCampo .mpr-giocatore .mpr-slot .card').length >= 2, null, { timeout: 8000 });
            const visto = await host.evaluate(() => {
                const pannello = document.getElementById('mpRaidCampo');
                const blocchi = Array.from(pannello.querySelectorAll('.mpr-blocco'));
                return {
                    nome: pannello.querySelector('.mpr-nome-giocatore').textContent,
                    ordine: blocchi.map((b) => b.className.includes('mpr-boss') ? 'boss' : 'giocatore'),
                    carte: pannello.querySelectorAll('.mpr-giocatore .mpr-riga--mostro .mpr-slot .card').length,
                    inMano: pannello.querySelectorAll('.mpr-giocatore .mpr-mano-carta').length,
                    leggibili: pannello.querySelectorAll('.mpr-giocatore .mpr-leggibile').length,
                    uidDelDuello: !!pannello.querySelector('[data-uid]:not([data-uid^="raid-"])')
                };
            });
            assert(visto.nome && visto.nome.length > 0, 'Il pannello mostra il nome del giocatore');
            assert(visto.ordine[0] === 'boss' && visto.ordine[1] === 'giocatore', `Boss in alto, giocatore in basso: ${visto.ordine}`);
            assert(visto.carte === 2, `Il pannello mostra le due carte del compagno: ${visto.carte}`);
            assert(visto.inMano === manoProva, `Le carte in mano compaiono col dorso: ${visto.inMano} su ${manoProva}`);
            assert(visto.leggibili === 2, `Anche la carta coperta del compagno si puo' leggere: ${visto.leggibili}`);
            assert(!visto.uidDelDuello, 'Il pannello non contiene carte con uid del duello');
            // Un tocco sulla carta COPERTA apre l'informazione con il suo nome.
            await host.click('#mpRaidCampo .mpr-giocatore .mpr-riga--mostro .mpr-slot:nth-child(2)');
            const info = await host.evaluate(() => (document.querySelector('#mpRaidCampo .mpr-info') || {}).textContent || '');
            assert(info.includes(nomeProva) && info.includes('coperta'), `Info della carta coperta: ${info.slice(0, 80)}`);
            // Chiuso, il pannello sparisce dal DOM e non lascia carte in giro.
            await host.click('#mpRaidCampo .mpr-chiudi');
            const rimasto = await host.evaluate(() => !!document.getElementById('mpRaidCampo'));
            assert(!rimasto, 'Il pannello si chiude e sparisce dal DOM');
            const suoCampo = await host.evaluate(() => gameState.playerMonsterField.filter(Boolean).length);
            assert(suoCampo === 0, `Il campo dell'host non e' stato toccato: ${suoCampo}`);
            // Un compagno scorretto (totale enorme, negativo, non intero) non azzera ne' cura il Boss oltre la barra.
            await ospite.evaluate(() => { MpRaid.ricevi({ kind: 'raid', tipo: 'colpo', inflitti: -5000 }); MpRaid.ricevi({ kind: 'raid', tipo: 'colpo', inflitti: 1.5 }); });
            const dopoNegativo = await ospite.evaluate(() => gameState.botLP);
            assert(dopoNegativo <= 16000 && dopoNegativo >= 0, `Totale negativo ignorato oltre la barra: ${dopoNegativo}`);
            await ospite.evaluate(() => MpRaid.ricevi({ kind: 'raid', tipo: 'colpo', inflitti: 99999999 }));
            const dopoEnorme = await ospite.evaluate(() => gameState.botLP);
            assert(dopoEnorme >= 0 && dopoEnorme <= 16000, `Totale enorme contenuto nella barra: ${dopoEnorme}`);
            // PREMIO: la vittoria del Raid paga 500 Crediti e 2 Stelle dell'Esagono (e non il premio di un Duello Libero).
            const prima = await host.evaluate(() => { const c = SaveManager.getCurrency(); return { crediti: c.credits, stelle: c.starChips }; });
            await host.evaluate(() => { gameState.botLP = 0; if (typeof updateUI === 'function') updateUI(); });
            await host.waitForSelector('#duelOutcomeOverlay', { timeout: 30000 });
            const dopo = await host.evaluate(() => { const c = SaveManager.getCurrency(); return { crediti: c.credits, stelle: c.starChips, testo: document.getElementById('duelOutcomeOverlay').textContent }; });
            // Altre cose possono pagare nello stesso momento (Sfide e missioni completate dalla vittoria): qui si controlla che
            // il premio del Raid ci sia, intero, e che sia spiegato; non che sia l'unico accredito.
            assert(dopo.crediti - prima.crediti >= 500, `Il Raid paga almeno 500 crediti: ${prima.crediti} -> ${dopo.crediti}`);
            assert(dopo.stelle - prima.stelle >= 2, `Il Raid paga almeno 2 Stelle dell'Esagono: ${prima.stelle} -> ${dopo.stelle}`);
            const righe = (dopo.testo.match(/Raid cooperativo vinto/g) || []).length;
            assert(righe === 2, `La schermata finale mostra le due voci (crediti e Stelle) col loro motivo: ${righe}`);
            assert(!/Premio di partecipazione|Prima vittoria di oggi/.test(dopo.testo), 'Il premio di un Duello Libero normale non si somma a quello del Raid');
            // LIMITE GIORNALIERO: 2 al giorno. La prima e' appena stata pagata dal duello; la seconda paga, la terza no (e lo dice).
            const limite = await host.evaluate(() => {
                const conta = (voci) => voci.filter((v) => !v.nota).length;
                const c0 = SaveManager.getCurrency().credits;
                const seconda = Rewards.forRaid({ bossNome: 'Prova' });
                const c1 = SaveManager.getCurrency().credits;
                const terza = Rewards.forRaid({ bossNome: 'Prova' });
                const c2 = SaveManager.getCurrency().credits;
                return { pagate: [conta(seconda), conta(terza)], crediti: [c1 - c0, c2 - c1], notaTerza: terza.some((v) => v.nota && /gi. riscosso/i.test(v.rule)), giorno: Rewards.RAID_AL_GIORNO };
            });
            assert(limite.giorno === 2 && limite.pagate[0] === 2 && limite.crediti[0] === 500, `La seconda vittoria del giorno paga ancora: ${JSON.stringify(limite)}`);
            assert(limite.pagate[1] === 0 && limite.crediti[1] === 0 && limite.notaTerza, `La terza no, e lo spiega: ${JSON.stringify(limite)}`);            assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);        } finally {
            await context.close();
            await room.close();
            await statics.close();
        }
    }
};
