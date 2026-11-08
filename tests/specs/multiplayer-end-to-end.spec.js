// Multiplayer end-to-end: DUE client veri, il server di stanze vero.
// =====================================================================
// Fino a qui il Multiplayer era l'unica parte del progetto senza alcuna
// rete di sicurezza automatica: ogni modifica al protocollo si poteva
// verificare solo aprendo due browser a mano. Questo test chiude quel
// buco — e non simula nulla del relay: avvia server/server.js come vero
// sottoprocesso e apre due pagine su multiplayer.html, che fanno lobby,
// stanza e duello esattamente come due giocatori reali.
//
// `standalone: true` (vedi tests/run-all.js): questo spec non vuole la
// pagina già aperta sul duello che ricevono tutti gli altri — se la
// costruisce da sé, due volte.
//
// SERVE UN SERVER HTTP: mp-lobby.js carica l'arena con
// `fetch('duelMonstersCore.html')`, e su file:// quella fetch è bloccata
// dal browser. Vedi tests/helpers/local-servers.js.
//
// Cosa verifica, in ordine: indirizzi e risveglio del relay;
// accoppiamento in stanza; impostazioni scelte dall'host; barriera dei due
// "Pronto"; avvio obbligatorio a passo comune con stato identico e mani
// vere su entrambi i motori; resa comunicata come vittoria.
const { startStaticServer, startRoomServer } = require('../helpers/local-servers');

module.exports = {
    name: 'Multiplayer end-to-end: due client attraverso il server di stanze',
    standalone: true,
    async run({ browser, assert }) {
        const statics = await startStaticServer();
        const room = await startRoomServer();
        // serviceWorkers: 'block' — sw.js non deve poter servire una
        // versione in cache di duelMonstersCore.html a metà test: qui
        // conta sempre il file su disco, quello appena modificato.
        const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' });
        const pageErrors = [];

        try {
            const openLobby = async (label) => {
                const page = await context.newPage();
                page.on('pageerror', (err) => pageErrors.push(`[${label}] ${err.message}`));
                // Stessi due opt-out di tests/helpers/harness.js#openDuel, per
                // le stesse ragioni: nessun account Supabase in questa suite,
                // e nessuna morra cinese da cliccare (in Multiplayer chi
                // comincia lo decide comunque il server, vedi MP_startingRole).
                await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.SALA_CLASSICA = true; window.DUEL_RPS_SKIP = true; });
                await page.goto(statics.origin + '/multiplayer.html', { waitUntil: 'load' });
                await page.waitForSelector('#mpCreateBtn');
                // Il velo di caricamento condiviso (js/ui/page-loader.js) copre
                // la pagina per almeno 1s: cliccare sotto di lui fallirebbe.
                await page.waitForFunction(() => {
                    const el = document.getElementById('pageLoader');
                    return !el || el.classList.contains('page-loader-hidden');
                }, { timeout: 15000 });
                // L'indirizzo del server vive dentro un <details> chiuso (non
                // si tocca nell'uso normale): va aperto, o il campo non è
                // visibile e fill() aspetterebbe invano.
                await page.evaluate(() => {
                    const avanzate = document.querySelector('.mp-advanced');
                    if (avanzate) avanzate.open = true;
                });
                await page.fill('#mpServerUrl', room.wsUrl);
                return page;
            };

            const pageA = await openLobby('A');
            const pageB = await openLobby('B');

            // --- 0) Raggiungere il server pubblico ------------------------
            // Due comportamenti che in partita non si vedono mai ma che in
            // produzione decidono se il gioco parte: la promozione a wss://
            // (una pagina HTTPS, com'è quella pubblicata, non può aprire un
            // socket in chiaro) e la pazienza alla prima connessione (il
            // server gratuito dorme e ci mette un minuto a tornare su).
            const urls = await pageA.evaluate(() => ({
                promossoDaHttps: DuelNetwork.normalizeServerUrl('ws://esempio.onrender.com', true),
                localeLasciatoInChiaro: DuelNetwork.normalizeServerUrl('ws://localhost:8787', true),
                senzaSchemaSuHttps: DuelNetwork.normalizeServerUrl('esempio.onrender.com', true),
                senzaSchemaInLocale: DuelNetwork.normalizeServerUrl('localhost:8787', false),
                giaSicuro: DuelNetwork.normalizeServerUrl('wss://esempio.onrender.com', true)
            }));
            assert(urls.promossoDaHttps === 'wss://esempio.onrender.com', `Da una pagina HTTPS un indirizzo in chiaro va promosso a wss:// (ottenuto: ${urls.promossoDaHttps})`);
            assert(urls.localeLasciatoInChiaro === 'ws://localhost:8787', `Un server locale non ha un certificato: deve restare in chiaro (ottenuto: ${urls.localeLasciatoInChiaro})`);
            assert(urls.senzaSchemaSuHttps === 'wss://esempio.onrender.com', `Un indirizzo incollato senza schema deve prenderne uno adatto alla pagina (ottenuto: ${urls.senzaSchemaSuHttps})`);
            assert(urls.senzaSchemaInLocale === 'ws://localhost:8787', `Fuori da HTTPS lo schema scelto resta ws:// (ottenuto: ${urls.senzaSchemaInLocale})`);
            assert(urls.giaSicuro === 'wss://esempio.onrender.com', 'Un indirizzo già wss:// non va toccato');

            // Porta chiusa = il caso "server addormentato" visto dal client.
            // Budget accorciato apposta: il test verifica che si INSISTA
            // annunciandolo, non che si aspetti davvero un minuto e mezzo.
            const waking = await pageA.evaluate(() => new Promise((resolve) => {
                const annunci = [];
                DuelNetwork.on('connect-waking', (info) => annunci.push(info.attempt));
                DuelNetwork.connect('ws://127.0.0.1:9', { totalTimeoutMs: 14000 })
                    .then(() => resolve({ annunci, errore: null }))
                    .catch((err) => resolve({ annunci, errore: err.message }));
            }));
            assert(waking.annunci.length >= 2, `Una connessione che non risponde deve essere ritentata, non abbandonata al primo colpo (annunci di risveglio: ${JSON.stringify(waking.annunci)})`);
            assert(waking.annunci[0] === 1 && waking.annunci[1] === 2, `Gli annunci devono numerare i tentativi (ottenuto: ${JSON.stringify(waking.annunci)})`);
            assert(!!waking.errore, 'Esaurito il budget, la connessione deve comunque fallire con un errore invece di restare appesa per sempre');

            // --- Stanza: A crea, B entra col codice ---------------------
            await pageA.click('#mpCreateBtn');
            await pageA.waitForFunction(() => {
                const el = document.getElementById('mpRoomCodeValue');
                return el && /^[A-Z0-9]{5}$/.test(el.textContent.trim());
            }, { timeout: 15000 });
            const code = (await pageA.textContent('#mpRoomCodeValue')).trim();
            assert(code.length === 5, `Il server deve assegnare un codice stanza di 5 caratteri (ricevuto: "${code}")`);

            // --- Sala d'attesa: chi crea sceglie arena e musica -----------
            // Le sceglie l'host e valgono per ENTRAMBI: è il punto centrale
            // della sala d'attesa, e senza una verifica qui nessuno si
            // accorgerebbe che la scelta non arriva dall'altra parte.
            const ARENA = 'rovine_1.jpg';
            const MUSICA = '31. Finals.mp3';
            // 'all' e non il default 'yu-gi-oh': una scelta che coincide col
            // default non dimostrerebbe che ha viaggiato davvero.
            const CARTE = 'all';
            // Arena, musica e carte ammesse si scelgono nella finestra del riquadro "Arena e musica" (js/multiplayer/mp-scelte.js).
            await pageA.click('#mpSetup .mp-tessera');
            await pageA.waitForSelector('.ds-field[data-file="' + ARENA + '"]');
            await pageA.click('.ds-field[data-file="' + ARENA + '"]');
            await pageA.click('.ds-track[data-file="' + MUSICA + '"]');
            await pageA.click('.ds-origin[data-origin="' + CARTE + '"]');
            const sceltoDaHost = await pageA.evaluate(() => ({
                campo: document.querySelector('.ds-field[aria-pressed="true"]').dataset.file,
                musica: document.querySelector('.ds-track[aria-pressed="true"]').dataset.file,
                postiOccupati: document.getElementById('mpOccupancy').textContent
            }));
            assert(sceltoDaHost.campo === ARENA, `L'arena cliccata deve risultare selezionata (ottenuto: ${sceltoDaHost.campo})`);
            assert(sceltoDaHost.musica === MUSICA, `La traccia cliccata deve risultare selezionata (ottenuto: ${sceltoDaHost.musica})`);
            assert(sceltoDaHost.postiOccupati === '1', 'Prima che arrivi l\'avversario la stanza deve dirsi occupata da 1 duellante');
            await pageA.click('.mp-modale-fatto');   // la finestra delle scelte si richiude, lasciando liberi gli altri pulsanti

            await pageB.click('#mpTabJoin');
            await pageB.fill('#mpJoinCode', code);
            await pageB.click('#mpJoinBtn');

            // --- "Pronto": il duello parte quando lo dicono ENTRAMBI -----
            // Non basta più che la stanza si riempia (prima partiva da sé
            // un conto alla rovescia): chi entrava si ritrovava dentro al
            // duello mentre stava ancora scegliendo il mazzo. La barra
            // compare solo a stanza piena, quindi aspettarla è anche il
            // modo di sapere che i due si sono trovati.
            await pageA.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });
            await pageB.waitForSelector('#mpReadyBar:not([hidden])', { timeout: 20000 });

            // Con UNO solo pronto il duello non deve cominciare: è tutto il
            // senso di questa schermata.
            await pageA.click('#mpReadyBtn');
            await pageA.waitForTimeout(1200);
            const partitoConUnoSolo = await pageA.evaluate(() => window.MULTIPLAYER_MODE === true);
            assert(!partitoConUnoSolo, 'Con un solo duellante pronto il duello non deve partire');
            const avversarioVedeIlPronto = await pageB.evaluate(
                () => document.getElementById('mpReadyOpp').classList.contains('is-pronto')
            );
            assert(avversarioVedeIlPronto, 'Il "Pronto" di un lato deve accendersi anche sullo schermo dell\'altro');

            await pageB.click('#mpReadyBtn');

            // --- Arena caricata e duello avviato su ENTRAMBI ------------
            // Dopo il conto alla rovescia c'è la morra cinese, che qui è
            // saltata da DUEL_RPS_SKIP (vedi openLobby): in quel caso chi
            // comincia resta la decisione del server, com'era prima.
            const arenaReady = (page) => page.waitForFunction(
                () => window.MULTIPLAYER_MODE === true
                    && typeof gameState !== 'undefined' && typeof DuelEngine !== 'undefined'
                    && Array.isArray(gameState.playerHand) && gameState.playerHand.length >= 5
                    && !!document.getElementById('playerHand'),
                { timeout: 40000 }
            );
            await Promise.all([arenaReady(pageA), arenaReady(pageB)]);

            // L'arena e la musica scelte da chi ha creato la stanza devono
            // valere per ENTRAMBI: è la ragione per cui quelle scelte
            // viaggiano sulla rete invece di restare locali.
            for (const [etichetta, page] of [['host', pageA], ['ospite', pageB]]) {
                const ambiente = await page.evaluate(() => {
                    const audio = document.getElementById('bgMusicAudio');
                    return {
                        sfondo: document.body.style.backgroundImage,
                        traccia: audio ? decodeURIComponent(audio.getAttribute('src') || '') : '',
                        carteAmmesse: window.DuelSession ? window.DuelSession.allowedOrigin : null
                    };
                });
                assert(ambiente.sfondo.includes(ARENA), `${etichetta}: il duello deve svolgersi nell'arena scelta (sfondo: ${ambiente.sfondo || 'nessuno'})`);
                assert(ambiente.traccia.includes(MUSICA), `${etichetta}: deve suonare la musica scelta (traccia: ${ambiente.traccia || 'nessuna'})`);
                assert(ambiente.carteAmmesse === CARTE, `${etichetta}: la regola sulle carte ammesse deve valere per entrambi (ottenuto: ${ambiente.carteAmmesse})`);
            }

            for (const page of [pageA, pageB]) {
                try { await page.click('.di-skip', { timeout: 4000 }); } catch (e) { /* nessuna intro da saltare */ }
            }

            // Chi comincia lo decide il server al momento dell'accoppiamento:
            // il test non lo dà per scontato, lo chiede.
            const aStarts = await pageA.evaluate(() => window.MP_startingRole === 'player');
            const bStarts = await pageB.evaluate(() => window.MP_startingRole === 'player');
            assert(aStarts !== bStarts, 'Il server deve assegnare il primo turno a UNO solo dei due client');
            const actor = aStarts ? pageA : pageB;      // chi gioca le mosse
            const watcher = aStarts ? pageB : pageA;    // chi deve vederle arrivare

            // La cascata naturale di apertura (draw -> standby -> main1) si
            // esegue su entrambi i motori. Il comando viaggia nel passo
            // comune e i nomi dei posti restano specchiati.
            await actor.waitForFunction(() => gameState.phase === 'main1' && gameState.currentPlayer === 'player', { timeout: 25000 });
            await watcher.waitForFunction(() => gameState.phase === 'main1' && gameState.currentPlayer === 'bot', { timeout: 25000 });
            const avvio = await Promise.all([actor, watcher].map((page) => page.evaluate(() => ({
                passoComune: window.MP_PASSO_COMUNE === true && PassoComune.attivo(),
                manoAvversariaVera: gameState.botHand.every((c) => c && c.id !== -1 && c.name !== '???'),
                impronta: PassoComune.impronta()
            }))));
            assert(avvio.every((x) => x.passoComune), 'Il duello deve usare obbligatoriamente il passo comune');
            assert(avvio.every((x) => x.manoAvversariaVera), 'Entrambi i motori devono avere la mano vera dell\'altro posto');
            assert(avvio[0].impronta === avvio[1].impronta,
                `I due motori devono partire allineati: ${avvio[0].impronta} contro ${avvio[1].impronta}`);

            // --- Resa: l'esito deve arrivare all'avversario ---------------
            // DuelSession.finish naviga via dalla pagina ~900ms dopo la fine
            // del duello: neutralizzata su ENTRAMBI i lati perché il test
            // possa leggere l'esito. È l'unica cosa stubbata in tutto lo
            // spec, e sta a valle del protocollo (non lo tocca).
            for (const page of [actor, watcher]) {
                await page.evaluate(() => {
                    window.DuelSession.finish = function (playerWon) { window.__mpEndResult = playerWon; };
                });
            }
            await actor.click('#surrenderBtn');
            await actor.click('#surrenderConfirmBtn');
            await watcher.waitForFunction(() => gameState.gameOver === true, { timeout: 15000 });
            // endDuel lascia passare ~900ms prima di dichiarare l'esito a
            // DuelSession.finish: si aspetta il segnale vero, non quel tempo.
            const waitOutcome = (page) => page.waitForFunction(() => window.__mpEndResult !== undefined, { timeout: 15000 });
            await Promise.all([waitOutcome(watcher), waitOutcome(actor)]);
            const outcome = await watcher.evaluate(() => window.__mpEndResult);
            assert(outcome === true, `Chi resta in piedi deve ricevere una VITTORIA (ricevuto: ${JSON.stringify(outcome)})`);
            const actorOutcome = await actor.evaluate(() => window.__mpEndResult);
            assert(actorOutcome === false, `Chi si arrende deve registrare una SCONFITTA (ricevuto: ${JSON.stringify(actorOutcome)})`);

            assert(pageErrors.length === 0, `Errori JS non gestiti durante il duello multiplayer: ${pageErrors.join(' | ')}`);
        } finally {
            await context.close();
            await room.close();
            await statics.close();
        }
    }
};
