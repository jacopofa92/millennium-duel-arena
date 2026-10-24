// DUE (e tre) ACCOUNT SULLO STESSO DISPOSITIVO: nessun progresso deve perdersi, mescolarsi o finire sul cloud sbagliato.
//
// Il salvataggio locale e' uno solo per dispositivo; i salvataggi veri stanno sul cloud, uno per account. Qui si prova,
// con un cloud finto a piu' utenti (tests/helpers/finto-cloud.js, `utenti`) e le STESSE funzioni che usa il gate di
// index.html, ogni modo in cui il cambio di account puo' far male:
//   1) uno stesso NOME giocatore non conta nulla: l'identita' e' l'account (due "Mario" restano due profili);
//   2) chi entra non eredita i progressi di chi e' uscito, e non li carica sul proprio cloud;
//   3) i progressi di chi esce NON arrivati sul cloud (e le sue carte inventate) restano e RITORNANO quando rientra;
//   4) una scrittura tardiva di un'altra scheda (il salvataggio di A mentre e' collegato B) non finisce sul cloud di B;
//   5) un salvataggio di cui nessuno sa di chi sia non sovrascrive mai un cloud che esiste;
//   6) la copia di sicurezza di un account non si vede e non si applica da un altro;
//   7) se non c'e' posto per tenere la copia ci si ferma: il salvataggio di chi esce non si tocca e non si carica.
const path = require('path');
const { creaFintoCloud } = require('../helpers/finto-cloud.js');

const RADICE = path.join(__dirname, '..', '..');
const INDEX = 'file:///' + path.join(RADICE, 'index.html').replace(/\\/g, '/');
const A = { id: 'acc-A', email: 'a@prova.it' };
const B = { id: 'acc-B', email: 'b@prova.it' };
const C = { id: 'acc-C', email: 'c@prova.it' };

module.exports = {
    name: 'Due account sullo stesso dispositivo: niente perdite, mescolanze o sovrascritture',
    standalone: true,
    async run({ browser, assert }) {
        const { cloud, collega } = creaFintoCloud();
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
        await collega(ctx, { utenti: [A, B, C] });
        const page = await ctx.newPage();
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        try {
            await page.goto(INDEX);
            await page.waitForFunction(() => !!(window.SaveManager && window.CloudSync && window.CustomCards));
            await page.waitForTimeout(600);

            // Le due operazioni del gate (afterGateSignIn) e dell'uscita (logoutAndShowGate), scritte una volta sola.
            await page.evaluate(() => {
                window.__entra = async (email, nome) => {
                    await CloudSync.signIn(email, 'x');
                    const cloud = await CloudSync.fetchCloudSave();
                    if (cloud) {
                        const v = CloudSync.confrontaSalvataggi(cloud);
                        if (v.scelta === 'cloud') { await CloudSync.pullSave(); await CloudSync.pullCustomCards(); return 'scaricato'; }
                        if (v.scelta === 'locale') { await CloudSync.pushSave(); await CloudSync.pushCustomCards(); return 'caricato'; }
                        return 'uguale';
                    }
                    if (!SaveManager.hasSave()) SaveManager.createNew(nome);
                    await CloudSync.pushSave(); await CloudSync.pushCustomCards();
                    return 'creato';
                };
                window.__esci = async (senzaPush) => {
                    if (!senzaPush) { try { await CloudSync.pushSave(); await CloudSync.pushCustomCards(); } catch (e) { /* si esce comunque */ } }
                    await CloudSync.signOut();
                };
                window.__crediti = () => (SaveManager.hasSave() ? SaveManager.load().currency.credits : null);
            });
            const crediti = () => page.evaluate(() => window.__crediti());
            const creditiCloud = (id) => { const r = cloud.saves[id]; return r && r.data.currency ? r.data.currency.credits : null; };
            const carteCloud = (id) => (cloud.custom_cards[id] || []).map((c) => c.name);
            const entra = (acc, nome) => page.evaluate(([e, n]) => window.__entra(e, n), [acc.email, nome || 'Mario']);
            const esci = (senzaPush) => page.evaluate((s) => window.__esci(s), !!senzaPush);

            // ---------- 1) Due account con lo STESSO nome: due profili, nessun passaggio ----------
            assert(await entra(A) === 'creato', 'A: primo accesso, profilo creato');
            await page.evaluate(() => SaveManager.addCurrency('credits', 1000));
            const creditiA = await crediti();
            await page.evaluate(() => CloudSync.pushSave());
            assert(creditiCloud(A.id) === creditiA, `A ha caricato i suoi crediti: ${creditiCloud(A.id)} vs ${creditiA}`);
            await esci();

            assert(await entra(B) === 'creato', 'B: primo accesso, deve CREARE un profilo suo, non ereditare quello di A');
            const nomeB = await page.evaluate(() => SaveManager.load().player.name);
            assert(nomeB === 'Mario', `B si chiama Mario come A: ${nomeB}`);
            const creditiBIniziali = await crediti();
            assert(creditiBIniziali !== creditiA, `B NON ha ereditato i crediti di A (${creditiBIniziali} vs ${creditiA})`);
            assert(creditiCloud(A.id) === creditiA, `il cloud di A e' intatto: ${creditiCloud(A.id)}`);
            assert(creditiCloud(B.id) === creditiBIniziali, `il cloud di B ha il profilo di B: ${creditiCloud(B.id)}`);
            const copiaA = await page.evaluate(() => (CloudSync.copieDiAltriAccount()['acc-A'] || {}).data);
            assert(copiaA && copiaA.currency.credits === creditiA, 'i dati di A sono rimasti, messi da parte');
            await page.evaluate(() => SaveManager.addCurrency('credits', 300));
            const creditiB = await crediti();
            await esci();

            // ---------- 2) Rientra A: ritrova il suo, e il cloud di B non si tocca ----------
            await entra(A);
            assert(await crediti() === creditiA, `A ritrova i suoi crediti: ${await crediti()} vs ${creditiA}`);
            assert(creditiCloud(B.id) === creditiB, `il cloud di B non e' stato toccato: ${creditiCloud(B.id)} vs ${creditiB}`);
            assert(creditiCloud(A.id) === creditiA, 'il cloud di A e\' intatto');

            // ---------- 3) Progressi di A MAI arrivati sul cloud (e una carta inventata), poi esce senza caricare ----------
            await page.evaluate(() => {
                SaveManager.addCurrency('credits', 5000);
                CustomCards.add({ name: 'Drago di A', type: 'monster', attack: 1000, defense: 1000, level: 4 });
            });
            const creditiANonSync = await crediti();
            assert(creditiCloud(A.id) === creditiA, 'prima dell\'uscita il cloud di A non ha ancora i 5000');
            await esci(true);

            await entra(B);
            assert(await crediti() === creditiB, `B ritrova il suo, non quello di A: ${await crediti()} vs ${creditiB}`);
            assert(creditiCloud(B.id) === creditiB, 'il cloud di B resta suo');
            const carteDiB = await page.evaluate(() => CustomCards.list().map((c) => c.name));
            assert(carteDiB.length === 0, `B non vede le carte inventate di A: ${JSON.stringify(carteDiB)}`);
            assert(carteCloud(B.id).length === 0, 'e il cloud di B non riceve le carte di A');
            const copia3 = await page.evaluate(() => CloudSync.copieDiAltriAccount()['acc-A']);
            assert(copia3 && copia3.data.currency.credits === creditiANonSync, 'i progressi di A mai sincronizzati sono conservati');
            assert(copia3.customCards && copia3.customCards.some((c) => c.name === 'Drago di A'), 'anche la carta inventata di A e\' conservata');
            await esci();

            await entra(A);
            assert(await crediti() === creditiANonSync, `A RITROVA i progressi che non erano arrivati sul cloud: ${await crediti()} vs ${creditiANonSync}`);
            assert((await page.evaluate(() => CustomCards.list().map((c) => c.name))).includes('Drago di A'), 'e la sua carta inventata');
            await page.evaluate(() => CloudSync.pushSave());
            assert(creditiCloud(A.id) === creditiANonSync, `che ora arrivano sul suo cloud: ${creditiCloud(A.id)}`);
            assert(creditiCloud(B.id) === creditiB, 'senza toccare il cloud di B');
            await esci();

            // ---------- 4) Cicli ripetuti con lo stesso nome: nessuna mescolanza ----------
            let attesoA = await (async () => { await entra(A); return crediti(); })();
            await esci();
            let attesoB = await (async () => { await entra(B); return crediti(); })();
            await esci();
            for (let i = 1; i <= 3; i++) {
                await entra(A); await page.evaluate((n) => SaveManager.addCurrency('credits', n), 100 * i); attesoA += 100 * i;
                assert(await crediti() === attesoA, `ciclo ${i}: A ha ${await crediti()} invece di ${attesoA}`);
                await esci();
                await entra(B); await page.evaluate((n) => SaveManager.addCurrency('credits', n), 7 * i); attesoB += 7 * i;
                assert(await crediti() === attesoB, `ciclo ${i}: B ha ${await crediti()} invece di ${attesoB}`);
                await esci();
            }
            assert(creditiCloud(A.id) === attesoA && creditiCloud(B.id) === attesoB, `cloud finali: A ${creditiCloud(A.id)}/${attesoA}, B ${creditiCloud(B.id)}/${attesoB}`);

            // ---------- 5) Una scrittura tardiva di un'altra scheda: A sul dispositivo mentre e' collegato B ----------
            await entra(A);
            const istantaneaA = await page.evaluate(() => localStorage.getItem('yugiohDuelArenaSave'));
            await esci();
            await entra(B);
            await page.evaluate((snap) => localStorage.setItem('yugiohDuelArenaSave', snap), istantaneaA); // la scheda di A scrive tardi
            const esitoTardivo = await page.evaluate(() => CloudSync.pushSave().then(() => 'caricato', (e) => e.code || e.message));
            assert(esitoTardivo === 'SALVATAGGIO_DI_ALTRO_ACCOUNT', `la scrittura tardiva di A non va sul cloud di B: ${esitoTardivo}`);
            assert(creditiCloud(B.id) === attesoB, `il cloud di B e' intatto: ${creditiCloud(B.id)} vs ${attesoB}`);
            assert((await page.evaluate(() => CloudSync.copieDiAltriAccount()['acc-A'])), 'e la scrittura tardiva di A e\' conservata fra le copie di A');
            await esci();

            // ---------- 6) Salvataggio SENZA proprietario (nato prima di queste regole) contro un cloud che esiste ----------
            await entra(A);
            await page.evaluate(() => {
                const s = JSON.parse(localStorage.getItem('yugiohDuelArenaSave'));
                delete s.accountId;
                s.currency.credits = 99999; // il piu' nuovo e il piu' ricco: con la vecchia regola avrebbe vinto
                s.player.lastSaved = new Date(Date.now() + 3600000).toISOString();
                localStorage.setItem('yugiohDuelArenaSave', JSON.stringify(s));
                localStorage.removeItem('ygoProprietarioSalvataggio');
                localStorage.removeItem('ygoCloudBase');
                // il segnale di chi sarebbe stato presunto non deve esserci
            });
            await page.evaluate(() => { window.__fintoUtenteCorrente = 'x'; });
            // Si esce SENZA l'etichetta che signOut metterebbe: si toglie con la mano, come un salvataggio vecchio.
            await page.evaluate(() => { CloudSync.signOut(); });
            await page.evaluate(() => {
                const s = JSON.parse(localStorage.getItem('yugiohDuelArenaSave'));
                delete s.accountId;
                localStorage.setItem('yugiohDuelArenaSave', JSON.stringify(s));
                localStorage.removeItem('ygoProprietarioSalvataggio');
                localStorage.removeItem('ygoCloudBase');
            });
            await entra(B);
            assert(await crediti() === attesoB, `B col cloud: il salvataggio senza proprietario NON vince (${await crediti()} vs ${attesoB})`);
            assert(creditiCloud(B.id) === attesoB, 'e non e\' stato caricato sul cloud di B');
            const sconosciuta = await page.evaluate(() => CloudSync.copieDiAltriAccount()['sconosciuto']);
            assert(sconosciuta && sconosciuta.data.currency.credits === 99999, 'ma resta in una copia');
            // Senza cloud (account C nuovo): quello stesso salvataggio senza proprietario diventa suo, nessuna perdita.
            await esci();
            assert(await entra(C) === 'creato', 'C: primo accesso');
            await esci();

            // ---------- 7) La copia di sicurezza e' di UN account: B non vede e non applica quella di A ----------
            await entra(A);
            await page.evaluate(() => CloudSync.conservaCopiaDi(SaveManager.load()));
            assert(await page.evaluate(() => !!CloudSync.copiaDivergente()), 'A ha la sua copia di sicurezza');
            await esci();
            await entra(B);
            assert(await page.evaluate(() => CloudSync.copiaDivergente()) === null, 'B NON vede la copia di sicurezza di A');
            await page.evaluate(() => CloudSync.conservaCopiaDi(SaveManager.load()));
            await esci();
            await entra(A);
            const copiaDiA = await page.evaluate(() => { const c = CloudSync.copiaDivergente(); return c ? c.data.currency.credits : null; });
            assert(copiaDiA === attesoA, `A ritrova la SUA copia, non quella di B (${copiaDiA} vs ${attesoA})`);
            await esci();

            // ---------- 8) Niente posto per la copia: ci si ferma, senza toccare ne' caricare nulla ----------
            await entra(A);
            await page.evaluate(() => SaveManager.addCurrency('credits', 11));
            const creditiAPrima = await crediti();
            await page.evaluate(() => CloudSync.signOut());
            await page.evaluate(() => {
                const orig = Storage.prototype.setItem;
                window.__ripristinaSetItem = () => { Storage.prototype.setItem = orig; };
                Storage.prototype.setItem = function (k, v) {
                    if (k === 'ygoSalvataggiDiAltriAccount') throw new Error('QuotaExceededError');
                    return orig.call(this, k, v);
                };
            });
            const esitoSpazio = await page.evaluate(async () => {
                try { await window.__entra('b@prova.it', 'Mario'); return 'entrato'; } catch (e) { return e.code || e.message; }
            });
            assert(esitoSpazio === 'SPAZIO_ESAURITO', `senza posto per la copia ci si ferma: ${esitoSpazio}`);
            assert(await crediti() === creditiAPrima, 'il salvataggio di A e\' ancora li');
            assert(creditiCloud(B.id) === attesoB, `il cloud di B non e' stato toccato: ${creditiCloud(B.id)}`);
            await page.evaluate(() => window.__ripristinaSetItem());

            await page.evaluate(() => window.__ripristinaSetItem());
            await esci();

            // ---------- 9) STATISTICHE E PROGRESSI: vittorie, sconfitte, Sfide, tornei, collezione, sblocchi ----------
            // Tutto cio' che e' progresso sta dentro il salvataggio: qui si dimostra che attraversa il cambio account
            // identico, sia quando si esce caricando sia quando si esce SENZA (rete assente), e che non si mescola.
            await page.evaluate(() => {
                const SEZIONI = ['records', 'challenges', 'missions', 'tournamentStats', 'tournaments', 'collection', 'ownedPacks',
                    'unlockedCharacters', 'millenniumItems', 'story', 'artworks', 'economyProgress', 'currency', 'decks'];
                const ordina = (v) => (Array.isArray(v) ? v.map(ordina)
                    : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { o[k] = ordina(v[k]); return o; }, {}) : v);
                window.__improntaDi = (save) => JSON.stringify(ordina(SEZIONI.reduce((o, k) => { o[k] = save[k]; return o; }, {})));
                window.__impronta = () => window.__improntaDi(SaveManager.load());
                window.__gioca = (n) => {
                    SaveManager.setRecord('yugiMuto', { wins: 5 + n, losses: 2 + n });
                    SaveManager.setRecord('kaiba', { wins: n, losses: 3 * n });
                    SaveManager.setChallengeProgress('winDuels-1', { count: 4 + n, completed: n > 2, completedAt: null });
                    SaveManager.incrementTournamentStat('duelistKingdom', 'attempts');
                    SaveManager.addOwnedCards(7, 1);
                    SaveManager.unlockCharacter('joey' + n);
                    SaveManager.addMillenniumItem('puzzle' + n, { wonAt: 'oggi' });
                    SaveManager.addCurrency('stars', n);
                };
            });
            const impronta = () => page.evaluate(() => window.__impronta());
            const improntaCloud = (id) => page.evaluate(([dati]) => window.__improntaDi(dati), [cloud.saves[id].data]);

            await entra(A);
            await page.evaluate(() => window.__gioca(1));
            const statA1 = await impronta();
            await esci();                               // esce CARICANDO
            await entra(B);
            await page.evaluate(() => window.__gioca(2));
            const statB1 = await impronta();
            assert(statB1 !== statA1, 'le statistiche di B sono diverse da quelle di A');
            assert(await page.evaluate(() => SaveManager.getRecord('yugiMuto').wins) === 7, 'B ha le sue vittorie (5+2), non quelle di A');
            await esci();
            await entra(A);
            assert(await impronta() === statA1, 'A ritrova ESATTAMENTE statistiche e progressi di prima (uscito caricando)');
            assert(await improntaCloud(A.id) === statA1, 'e il cloud di A ha le stesse statistiche');

            // ora A gioca ancora e esce SENZA caricare: nulla deve andare perso ne' passare a B
            await page.evaluate(() => window.__gioca(3));
            const statA2 = await impronta();
            await esci(true);
            await entra(B);
            assert(await impronta() === statB1, 'B ritrova esattamente le sue statistiche, senza quelle non caricate di A');
            assert(await page.evaluate(() => SaveManager.getRecord('yugiMuto').wins) === 7, 'e le vittorie di B non sono cambiate');
            assert(await improntaCloud(B.id) === statB1, 'il cloud di B non ha ricevuto niente di A');
            await esci();
            await entra(A);
            assert(await impronta() === statA2, 'A ritrova anche le statistiche che non erano arrivate sul cloud');
            await page.evaluate(() => CloudSync.pushSave());
            assert(await improntaCloud(A.id) === statA2, 'e adesso sono sul suo cloud');
            assert(await page.evaluate(() => SaveManager.getRecord('yugiMuto').wins) === 8 && await page.evaluate(() => SaveManager.getRecord('kaiba').losses) === 9, 'vittorie e sconfitte di A: 5+3 e 3*3');
            await esci();
            // ---------- 10) Profilo AZZERATO altrove mentre A era uscito con progressi non caricati: non risorgono ----------
            await entra(A);
            await page.evaluate(() => window.__gioca(4));
            await esci(true);
            await entra(B);
            await esci();
            const adessoAzzera = new Date(Date.now() + 5000).toISOString();
            cloud.saves[A.id] = { data: { azzeratoIl: adessoAzzera }, updated_at: adessoAzzera };
            await entra(A);
            assert(await page.evaluate(() => SaveManager.getRecord('yugiMuto').wins) === 0, 'dopo un azzeramento le vittorie di prima non risorgono dalla copia');
            assert(await page.evaluate(() => !CloudSync.copieDiAltriAccount()['acc-A']), 'e la copia di prima si butta');
            await esci();
            assert(errori.length === 0, `Errori di pagina: ${errori.join(' | ')}`);
        } finally {
            await ctx.close();
        }
    }
};
