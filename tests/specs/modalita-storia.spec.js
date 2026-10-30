// Modalità Storia: si avanza vincendo, e solo vincendo.
// =====================================================================
// `standalone`: la Storia vive su una pagina sua (storia.html), non su
// quella del duello che la suite apre per tutti gli altri spec.
//
// La regola che vale la pena sorvegliare piu' di ogni altra e' la
// seconda: l'esito dell'ultimo duello arriva qui come una breadcrolla in
// sessionStorage, e va CONSUMATA. Senza, un semplice ricaricamento della
// pagina rifarebbe avanzare la campagna con lo stesso duello, e si
// arriverebbe in fondo senza giocare — un difetto che non si vede mai
// provando a mano, perche' a mano non si ricarica la pagina apposta.
const path = require('path');
const fs = require('fs');
const { liberaLaPagina } = require('../helpers/harness.js');

module.exports = {
    standalone: true,
    name: 'Modalità Storia: avanzamento, breadcrolla consumata, sconfitta innocua',
    async run(t) {
        const page = await t.browser.newPage({ viewport: { width: 1200, height: 900 } });
        const erroriPagina = [];
        page.on('pageerror', (e) => erroriPagina.push(e.message));
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });

        const RADICE = path.join(__dirname, '..', '..');
        const url = (q) => 'file:///' + path.join(RADICE, 'storia.html').replace(/\\/g, '/') + (q || '');
        const leggiProgresso = () => page.evaluate(() => {
            const save = JSON.parse(localStorage.getItem('yugiohDuelArenaSave') || '{}');
            return (save.story || {}).anime || { completate: 0 };
        });
        // Fa credere alla pagina di essere appena tornata da un duello.
        const tornaDaDuello = async (playerWon) => {
            await page.evaluate((vinto) => {
                sessionStorage.setItem('ygoLastDuelOutcome', JSON.stringify({
                    mode: 'story', campaignId: 'anime', playerWon: vinto, timestamp: Date.now()
                }));
            }, playerWon);
            await page.reload();
            await page.waitForSelector('.nm-node', { timeout: 20000 });
        };

        try {
            // --- L'elenco distingue le campagne pronte da quelle future --
            await page.goto(url());
            await page.waitForSelector('.campagna', { timeout: 20000 });
            // Confronto DERIVATO e non per posizione: "bloccata se e solo
            // se non ha tappe" resta vera aggiungendo campagne o
            // riordinandole, mentre "la prima è giocabile" si rompe al
            // primo cambiamento e non dice nulla di utile.
            const elenco = await page.evaluate(() => {
                const bloccate = [...document.querySelectorAll('.campagna')]
                    .map((c) => c.classList.contains('campagna--bloccata'));
                return StoryProgress.getCampaigns().map((c, i) => ({
                    id: c.id,
                    vuota: StoryProgress.getTappe(c.id).length === 0,
                    bloccata: bloccate[i]
                }));
            });
            t.assert(elenco.length >= 3, `Devono comparire tutte le campagne dichiarate (rilevate ${elenco.length})`);
            const incoerenti = elenco.filter((c) => c.vuota !== c.bloccata);
            t.assert(incoerenti.length === 0,
                `Una campagna dev'essere bloccata esattamente quando non ha tappe — dichiararla e non poterla giocare è più onesto che nasconderla, ma mostrarla giocabile e poi non farla partire no: ${JSON.stringify(incoerenti)}`);
            t.assert(elenco.some((c) => !c.vuota), 'Almeno una campagna dev\'essere giocabile');

            // --- Ogni duello punta a un personaggio che esiste ----------
            // Un characterId sbagliato non fallisce in modo rumoroso: manda
            // in un duello contro il vuoto, e si scopre solo arrivandoci.
            //
            // Il roster si legge dal FILE e non dalla pagina: storia.html
            // non carica characters-db.js (non gli serve, le etichette
            // della mappa stanno nel catalogo delle campagne), e caricarlo
            // solo per far girare un controllo sarebbe far pagare alla
            // pagina il costo del test.
            const rosterSrc = fs.readFileSync(path.join(RADICE, 'js', 'data', 'characters-db.js'), 'utf8');
            const idsRoster = [...rosterSrc.matchAll(/id: '([^']+)'/g)].map((m) => m[1]);
            t.assert(idsRoster.length > 20, `Il roster letto dal file sembra vuoto (${idsRoster.length} id)`);
            const tappeDuello = await page.evaluate(() => StoryProgress.getCampaigns().flatMap((c) =>
                StoryProgress.getTappe(c.id)
                    .filter((t) => t.kind === 'duel')
                    .map((t) => ({ campagna: c.id, tappa: t.id, characterId: t.characterId }))));
            const personaggiRotti = tappeDuello
                .filter((t) => idsRoster.indexOf(t.characterId) === -1)
                .map((t) => `${t.campagna}/${t.tappa}: "${t.characterId}"`);
            t.assert(personaggiRotti.length === 0,
                `Tappe che puntano a un personaggio inesistente: ${personaggiRotti.join(', ')}`);
            t.assert(tappeDuello.length > 25,
                `Le campagne scritte devono contenere parecchi duelli (rilevati ${tappeDuello.length})`);

            // --- Ogni faccia della Storia esiste davvero ----------------
            // Un ritratto che non carica non fa rumore: la mappa mostra il
            // cerchio col sigillo e la cutscene pure, quindi sembra una
            // scelta invece di un file mancante. Si controllano tutti i
            // personaggi che le campagne usano DAVVERO — come avversario di
            // una tappa, come voce di una scena o dentro un dialogo — non
            // l'intero roster, che contiene anche chi nelle storie non
            // compare.
            const facce = await page.evaluate(async () => {
                const usati = new Set();
                const guarda = (t) => {
                    if (t.characterId) usati.add(t.characterId);
                    if (t.chiId) usati.add(t.chiId);
                    (t.dialogo || []).forEach((b) => { if (b.chi) usati.add(b.chi); });
                };
                StoryProgress.getCampaigns().forEach((c) => (c.capitoli || []).forEach((cap) => cap.tappe.forEach((t) => {
                    guarda(t);
                    if (t.kind === 'torneo') (t.tappe || []).forEach(guarda);
                })));

                const rotti = [];
                for (const id of usati) {
                    const pg = StoryProgress.getPersonaggio(id);
                    if (!pg || !pg.image) { rotti.push(id + ' (nessuna immagine dichiarata)'); continue; }
                    const ok = await new Promise((res) => {
                        const i = new Image();
                        i.onload = () => res(true);
                        i.onerror = () => res(false);
                        i.src = pg.image;
                    });
                    if (!ok) rotti.push(id + ' -> ' + pg.image);
                }
                return { quanti: usati.size, rotti: rotti };
            });
            t.assert(facce.quanti > 30, `Pochi personaggi usati dalle storie (${facce.quanti})`);
            t.assert(facce.rotti.length === 0,
                'Personaggi della Storia senza ritratto: ' + facce.rotti.join(', '));

            // --- Sull'elenco si vede SOLO l'elenco ----------------------
            // Bug reale: `#vistaMappa { display: flex }` è un selettore di
            // id, quindi batteva per specificità il `display: none` che il
            // browser dà da sé a [hidden] — la vista mappa non si
            // nascondeva mai, e sotto le schede delle campagne restavano
            // appesi i suoi pezzi statici (i pulsanti "← Campagne" e
            // "Ricomincia", la barra dell'avanzamento). Si misura la
            // GEOMETRIA, non l'attributo: l'attributo era giusto anche
            // mentre il difetto c'era.
            const soloElenco = await page.evaluate(() => {
                const mappa = document.getElementById('vistaMappa');
                const r = mappa.getBoundingClientRect();
                return {
                    hidden: mappa.hidden,
                    altezza: Math.round(r.height),
                    // Cosa spunta sotto la fine dell'elenco delle campagne.
                    sottoLElenco: [...document.querySelectorAll('#vistaMappa button, #vistaMappa .avanzamento')]
                        .filter((e) => e.getBoundingClientRect().height > 0)
                        .map((e) => e.id || e.className)
                };
            });
            t.assert(soloElenco.hidden, 'Sull\'elenco delle campagne la vista mappa deve avere [hidden]');
            t.assert(soloElenco.altezza === 0 && soloElenco.sottoLElenco.length === 0,
                'Sull\'elenco delle campagne la vista mappa non deve occupare spazio: '
                + `alta ${soloElenco.altezza}px, pezzi ancora visibili: ${soloElenco.sottoLElenco.join(', ') || 'nessuno'}`);

            // --- La mappa apre sulla prima tappa, il resto e' coperto ----
            await page.goto(url('?campaign=anime'));
            await page.waitForSelector('.nm-node', { timeout: 20000 });
            const mappa = await page.evaluate(() => ({
                nodi: document.querySelectorAll('.nm-node').length,
                correnti: document.querySelectorAll('.nm-node--corrente').length,
                cliccabili: [...document.querySelectorAll('.nm-node')].filter((n) => !n.disabled).length,
                etichetteSvelate: [...document.querySelectorAll('.nm-node:not(.nm-node--bloccata) .nm-label')].map((l) => l.textContent)
            }));
            // La campagna anime è a DUE LIVELLI: la mappa grande porta un
            // nodo per arco della serie, e ogni nodo apre la mappa di
            // quell'arco. Si controllano entrambi i livelli, perché il
            // difetto che conta qui è "una macro-area vuota": un nodo che
            // si apre su una mappa senza niente dentro non fallisce in
            // modo rumoroso, ci si arriva e basta.
            const struttura = await page.evaluate(() => {
                const tappe = StoryProgress.getTappe('anime');
                const aree = tappe.filter((t) => t.kind === 'area');
                return {
                    tappeDiPrimoLivello: tappe.length,
                    aree: aree.length,
                    vuote: aree.filter((a) => !(a.tappe || []).length).length,
                    senzaMappa: aree.filter((a) => !a.mappa).length,
                    tappeInTutto: aree.reduce((s, a) => s + (a.tappe || []).length, 0)
                };
            });
            // Sei: il prologo a Domino City più i cinque archi della serie,
            // uno per isola. Il Castello di Pegasus NON è un'area: è la
            // seconda mappa dentro il Regno (vedi storia-aree-macro.spec.js).
            t.assert(struttura.aree === 6,
                `La campagna anime deve avere il prologo e i cinque archi della serie (rilevate ${struttura.aree} aree)`);
            t.assert(struttura.aree === struttura.tappeDiPrimoLivello,
                'Sulla mappa grande ci devono stare SOLO le aree: una tappa sciolta lì in mezzo non saprebbe dove collocarsi');
            t.assert(struttura.vuote === 0, `${struttura.vuote} aree non hanno nessuna tappa dentro`);
            t.assert(struttura.senzaMappa === 0, `${struttura.senzaMappa} aree non dichiarano la propria mappa`);
            t.assert(struttura.tappeInTutto > 30,
                `Le aree insieme devono contenere il racconto intero (rilevate ${struttura.tappeInTutto} tappe)`);
            t.assert(mappa.nodi === struttura.aree,
                `Sulla mappa grande dev'esserci un nodo per area (${mappa.nodi} nodi per ${struttura.aree} aree)`);
            t.assert(mappa.correnti === 1, `Dev'esserci ESATTAMENTE una tappa corrente (rilevate ${mappa.correnti})`);
            t.assert(mappa.cliccabili === 1,
                `Solo la tappa corrente dev'essere cliccabile: e' cio' che rende la Storia una storia invece di duelli a scelta libera (cliccabili ${mappa.cliccabili})`);
            t.assert(mappa.etichetteSvelate.length === 1,
                'Le tappe bloccate non devono rivelare chi ci aspetta');

            // --- Ogni campagna accetta solo le sue carte ----------------
            // Una campagna raccontata da una parte non si gioca con le
            // carte dell'altra: al Piave non si schierano i Kaiserjäger.
            // Il controllo sta in un punto solo, quindi si prova quello.
            const tema = await page.evaluate(() => {
                const ygo = { main: [{ id: 1, qty: 3 }, { id: 2, qty: 2 }], extra: [] };
                const misto = { main: [{ id: 1, qty: 3 }, { id: 1200, qty: 2 }], extra: [] };
                const italiano = { main: [{ id: 1200, qty: 2 }, { id: 1210, qty: 3 }], extra: [] };
                const austriaco = { main: [{ id: 1225, qty: 2 }, { id: 1234, qty: 3 }], extra: [] };
                const n = (camp, deck) => StoryProgress.carteNonAmmesse(camp, deck).length;
                return {
                    animeOk: n('anime', ygo),
                    animeMisto: n('anime', misto),
                    fmMisto: n('forbiddenMemories', misto),
                    ww1Italiano: n('ww1', italiano),
                    ww1Austriaco: n('ww1', austriaco),
                    ww1Ygo: n('ww1', ygo),
                    motivoFazione: StoryProgress.carteNonAmmesse('ww1', austriaco).map((c) => c.motivo)[0] || null,
                    descrizioneWw1: StoryProgress.descriviCarteAmmesse('ww1')
                };
            });
            t.assert(tema.animeOk === 0, 'Un mazzo Yu-Gi-Oh dev\'essere accettato dalle campagne Yu-Gi-Oh');
            t.assert(tema.animeMisto > 0 && tema.fmMisto > 0,
                'Il Regno delle Ombre e Memorie Proibite devono rifiutare le carte di altri set');
            t.assert(tema.ww1Italiano === 0, 'La Grande Guerra deve accettare un mazzo italiano del set WW1');
            t.assert(tema.ww1Austriaco > 0,
                'La Grande Guerra deve rifiutare lo schieramento austriaco: è raccontata dall\'altra parte del fronte');
            t.assert(/schieramento/.test(tema.motivoFazione || ''),
                `Il motivo del rifiuto deve dire che è una questione di schieramento, non solo di set (rilevato "${tema.motivoFazione}")`);
            t.assert(tema.ww1Ygo > 0, 'La Grande Guerra deve rifiutare anche le carte Yu-Gi-Oh');
            t.assert(/WW1/.test(tema.descrizioneWw1 || '') && /italiana/.test(tema.descrizioneWw1 || ''),
                `La regola dev'essere raccontabile al giocatore prima che ci sbatta contro: "${tema.descrizioneWw1}"`);

            // --- Una scena si supera leggendola -------------------------
            // La scena è un intermezzo a dialoghi (js/ui/story-cutscene.js),
            // non più un riquadro con un pulsante "Avanti": si avanza una
            // battuta alla volta, e la tappa si supera quando l'ultima è
            // stata letta. Si preme Invio invece di cliccare, perché un
            // click sulla scena mentre si sta chiudendo colpirebbe un
            // elemento che si sta staccando dal documento.
            // Le scene stanno DENTRO le aree, non più sulla mappa grande:
            // ci si entra prima. Il progresso da guardare è quindi quello
            // dell'area (`sotto`), non le tappe della campagna — la mappa
            // grande si muove solo quando un'area intera è finita.
            // L'area è la PRIMA (il prologo), cioè quella corrente di una
            // campagna appena cominciata.
            const leggiProgressoArea = () => page.evaluate(
                () => StoryProgress.getProgressoTorneo('anime', 'anime-area-prologo'));
            await page.goto(url('?campaign=anime&torneo=anime-area-prologo'));
            await page.waitForSelector('.nm-node--corrente', { timeout: 20000 });
            const primaScena = await leggiProgressoArea();
            await page.locator('.nm-node--corrente').click();
            await page.waitForSelector('.sc-scena', { timeout: 10000 });
            // Si va avanti FINCHÉ la scena non sparisce, invece di premere
            // un numero fisso di volte: sotto il carico della suite
            // completa il testo si scrive più lentamente, e un conteggio
            // indovinato può finire prima delle battute.
            const scadenzaScena = Date.now() + 25000;
            let statoScena = null;
            while (Date.now() < scadenzaScena) {
                statoScena = await page.evaluate(() => {
                    const s = document.querySelector('.sc-scena');
                    if (!s) return { presente: false };
                    return {
                        presente: true,
                        // Mentre si chiude resta nel DOM per la dissolvenza:
                        // premere lì manderebbe il tasto al nodo rimasto a
                        // fuoco sotto la scena, che la riaprirebbe.
                        visibile: s.classList.contains('is-visibile'),
                        testo: ((s.querySelector('.sc-testo') || {}).textContent || '').slice(0, 40)
                    };
                });
                if (!statoScena.presente) break;
                if (statoScena.visibile) await page.keyboard.press('Enter');
                await page.waitForTimeout(200);
            }
            t.assert(statoScena && !statoScena.presente,
                `La scena non si e' chiusa — ultimo stato: ${JSON.stringify(statoScena)}`);
            await page.waitForTimeout(400);
            const dopoScena = await leggiProgressoArea();
            t.assert(dopoScena === primaScena + 1,
                `Una scena si supera leggendola (da ${primaScena} a ${dopoScena} dentro l'area)`);
            // Si torna sulla mappa GRANDE: da qui in poi il test guarda la
            // campagna, e dentro un'area i suoi comandi non ci sono
            // (il pulsante "Ricomincia" è nascosto apposta — ricomincerebbe
            // l'intera campagna da dentro un suo pezzo).
            await page.goto(url('?campaign=anime'));
            await page.waitForSelector('.nm-node', { timeout: 20000 });

            // --- L'URL del duello porta tutto quello che serve ----------
            const href = await page.evaluate(() => StoryProgress.urlDuello('anime', StoryProgress.getTappaCorrente('anime')));
            t.assert(/mode=story/.test(href) && /campaign=anime/.test(href) && /character=/.test(href) && /difficulty=/.test(href),
                `L'URL del duello deve portare modalita', campagna, personaggio e difficolta': ${href}`);

            // --- La breadcrolla la SCRIVE davvero il duello -------------
            // Tutti i controlli qui sotto la scrivono a mano, quindi
            // provano il lettore e non lo scrittore. E' esattamente cosi'
            // che un `campaignId` mancante in js/duel-session.js e'
            // passato inosservato: la Storia non sarebbe mai avanzata
            // giocando davvero, e il test sarebbe restato verde.
            const duello = await t.browser.newPage({ viewport: { width: 1200, height: 900 } });
            try {
                await duello.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
                const urlDuello = 'file:///' + path.join(RADICE, 'duelMonstersCore.html').replace(/\\/g, '/')
                    + '?mode=story&campaign=anime&character=joey&difficulty=Medio&autowin=1';
                await duello.goto(urlDuello);
                await duello.waitForFunction(() => sessionStorage.getItem('ygoLastDuelOutcome') !== null,
                    null, { timeout: 60000 });
                const breadcrolla = JSON.parse(await duello.evaluate(() => sessionStorage.getItem('ygoLastDuelOutcome')));
                t.assert(breadcrolla.mode === 'story',
                    `Il duello deve dichiarare la modalità (rilevato ${breadcrolla.mode})`);
                t.assert(breadcrolla.campaignId === 'anime',
                    `Il duello deve dichiarare la CAMPAGNA, altrimenti storia.html non sa cosa far avanzare (rilevato ${JSON.stringify(breadcrolla.campaignId)})`);
                t.assert(breadcrolla.playerWon === true,
                    'Il duello deve dichiarare com\'è finito');
            } finally {
                await duello.close();
            }

            // --- Vincere fa avanzare... --------------------------------
            const primaDelDuello = await leggiProgresso();
            await tornaDaDuello(true);
            const dopoVittoria = await leggiProgresso();
            t.assert(dopoVittoria.completate === primaDelDuello.completate + 1,
                `Una vittoria deve far avanzare di una tappa (da ${primaDelDuello.completate} a ${dopoVittoria.completate})`);

            // --- ...ma una volta sola ----------------------------------
            const breadcrumb = await page.evaluate(() => sessionStorage.getItem('ygoLastDuelOutcome'));
            t.assert(breadcrumb === null, 'La breadcrolla dell\'esito dev\'essere consumata, non lasciata li\'');
            await page.reload();
            await page.waitForSelector('.nm-node', { timeout: 20000 });
            const dopoReload = await leggiProgresso();
            t.assert(dopoReload.completate === dopoVittoria.completate,
                `Ricaricare la pagina NON deve far avanzare di nuovo con lo stesso duello (da ${dopoVittoria.completate} a ${dopoReload.completate}): altrimenti si arriva in fondo alla campagna senza giocare`);

            // --- Perdere non fa arretrare ne' avanzare ------------------
            await tornaDaDuello(false);
            const dopoSconfitta = await leggiProgresso();
            t.assert(dopoSconfitta.completate === dopoVittoria.completate,
                `Una sconfitta lascia la tappa dov'era (rilevato ${dopoSconfitta.completate} invece di ${dopoVittoria.completate})`);
            const avviso = await page.evaluate(() => {
                const el = document.querySelector('.avviso');
                return el ? el.textContent : null;
            });
            t.assert(avviso && /pers/i.test(avviso),
                'Dopo una sconfitta la pagina deve dirlo: tornare a una mappa immutata senza spiegazioni sembra un difetto');

            // --- Un duello di un'ALTRA modalita' non tocca la Storia ----
            const primaEstraneo = await leggiProgresso();
            await page.evaluate(() => {
                sessionStorage.setItem('ygoLastDuelOutcome', JSON.stringify({
                    mode: 'tournament', tournamentId: 'duelistKingdom', playerWon: true, timestamp: Date.now()
                }));
            });
            await page.reload();
            await page.waitForSelector('.nm-node', { timeout: 20000 });
            const dopoEstraneo = await leggiProgresso();
            t.assert(dopoEstraneo.completate === primaEstraneo.completate,
                'Un duello di torneo non deve far avanzare la campagna');

            // --- Finire la campagna paga, una volta sola ----------------
            const premi = await page.evaluate(() => {
                const tappe = StoryProgress.getTappe('anime');
                // Col timbro: senza, un salvataggio così vecchio verrebbe azzerato.
                SaveManager.setStoryState('anime', {
                    completate: tappe.length, finita: true, premiata: false,
                    separazioni: storyCampaignsDatabase.find((c) => c.id === 'anime').separazioni.map((s) => s.id)
                });
                const prima = SaveManager.getCurrency().credits;
                const voci = StoryProgress.riscuotiPremioFinale('anime');
                const dopoPrimo = SaveManager.getCurrency().credits;
                const bis = StoryProgress.riscuotiPremioFinale('anime');
                const dopoSecondo = SaveManager.getCurrency().credits;
                return { voci: voci.length, guadagno: dopoPrimo - prima, bis: bis.length, guadagnoBis: dopoSecondo - dopoPrimo };
            });
            t.assert(premi.voci > 0 && premi.guadagno > 0,
                `Completare la campagna deve pagare (voci ${premi.voci}, crediti +${premi.guadagno})`);
            t.assert(premi.bis === 0 && premi.guadagnoBis === 0,
                'Il premio finale si riscuote una volta sola: la campagna resta rigiocabile, il premio no');

            // --- "Ricomincia" chiede prima di distruggere ----------------
            // Segnalato dall'utente insieme al ritorno sbagliato: quel
            // pulsante cancellava fino a quaranta tappe al primo tocco,
            // mentre i tornei una conferma ce l'hanno da sempre.
            // Il timbro `separazioni` dice che lo stato è già nella forma
            // di oggi: senza, verrebbe letto come un salvataggio di prima
            // del prologo e riportato in pari (3 diventerebbe 5). Si legge
            // dal catalogo, così non invecchia alla prossima area staccata.
            await page.evaluate(() => SaveManager.setStoryState('anime', {
                completate: 3, finita: false, premiata: true,
                separazioni: storyCampaignsDatabase.find((c) => c.id === 'anime').separazioni.map((s) => s.id)
            }));
            await page.reload();
            await page.waitForSelector('.nm-node', { timeout: 20000 });
            // Prima di cliccare: la schermata di caricamento (resta almeno
            // un secondo, vedi js/ui/page-loader.js) e il riquadro "Carta
            // ottenuta" dei premi appena riscossi qui sopra (arriva da una
            // coda salvata nella sessione, js/economy/card-drop-animation.js)
            // stanno SOPRA la pagina e si prendono il click. Nel gioco vero
            // li chiude il giocatore; qui li si aspetta e li si toglie.
            await liberaLaPagina(page);
            await page.evaluate(() => { const t = document.getElementById('mappaToggle'); if (t && t.getAttribute('aria-expanded') !== 'true') t.click(); });   // il pannello delle informazioni parte chiuso (1.4.172)
        await page.click('#btnRicomincia');
            await page.waitForTimeout(400);
            const conferma = await page.evaluate(() => ({
                pannello: !!document.querySelector('#scenaMount .scena'),
                testo: (document.querySelector('#scenaMount .scena-riga') || {}).textContent || '',
                completate: (JSON.parse(localStorage.getItem('yugiohDuelArenaSave') || '{}').story || {}).anime.completate
            }));
            t.assert(conferma.pannello, '"Ricomincia" deve chiedere conferma prima di cancellare i progressi');
            t.assert(conferma.completate === 3,
                `Finche' non si conferma, il progresso non si tocca (rilevato ${conferma.completate} invece di 3)`);
            t.assert(/3 tappe/.test(conferma.testo),
                `La domanda deve dire QUANTO si perde, non un generico "sei sicuro": "${conferma.testo}"`);

            await page.evaluate(() => [...document.querySelectorAll('#scenaMount .btn')]
                .find((b) => /Annulla/.test(b.textContent)).click());
            await page.waitForTimeout(300);
            const dopoAnnulla = await leggiProgresso();
            t.assert(dopoAnnulla.completate === 3,
                `"Annulla" deve lasciare tutto com'era (rilevato ${dopoAnnulla.completate})`);

            await liberaLaPagina(page);
            await page.evaluate(() => { const t = document.getElementById('mappaToggle'); if (t && t.getAttribute('aria-expanded') !== 'true') t.click(); });   // il pannello delle informazioni parte chiuso (1.4.172)
        await page.click('#btnRicomincia');
            await page.waitForTimeout(400);
            await page.evaluate(() => [...document.querySelectorAll('#scenaMount .btn')]
                .find((b) => /^Ricomincia$/.test(b.textContent.trim())).click());
            await page.waitForTimeout(400);
            const dopoConferma = await leggiProgresso();
            t.assert(dopoConferma.completate === 0,
                `Confermando, la campagna riparte da capo (rilevato ${dopoConferma.completate})`);
            t.assert(dopoConferma.premiata === true,
                'Ricominciare NON deve rimettere in palio il premio finale: sarebbe una fonte infinita di crediti');

            // --- Finito un duello si resta NELLA campagna ----------------
            // Segnalato dall'utente: "se vinco/perdo il duello nella
            // storia non mi deve buttare fuori". Il ritorno era
            // 'storia.html' senza la campagna, quindi ogni duello —
            // vinto o perso — rispediva all'elenco delle campagne, con la
            // mappa da riaprire a mano ogni volta.
            //
            // Si guarda il valore che la PAGINA DEL DUELLO calcola: è lì
            // che il difetto viveva, e controllarlo altrove proverebbe
            // solo che la Storia sa leggere il proprio URL.
            const urlDuelloStoria = 'file:///' + path.join(RADICE, 'duelMonstersCore.html').replace(/\\/g, '/')
                + '?mode=story&campaign=anime&character=solomonMuto&difficulty=Medio';
            await page.goto(urlDuelloStoria);
            await page.waitForFunction(() => !!window.DuelSession, null, { timeout: 25000 });
            const ritorno = await page.evaluate(() => ({
                mode: DuelSession.mode,
                campaignId: DuelSession.campaignId,
                returnUrl: DuelSession.returnUrl
            }));
            t.assert(ritorno.mode === 'story' && ritorno.campaignId === 'anime',
                `Il duello deve sapere di appartenere a una campagna: ${JSON.stringify(ritorno)}`);
            t.assert(/storia\.html\?campaign=anime/.test(ritorno.returnUrl),
                `A fine duello si deve tornare alla MAPPA della campagna, non all'elenco: "${ritorno.returnUrl}"`);

            t.assert(erroriPagina.length === 0, `Errori JS sulla pagina Storia: ${erroriPagina.join(' | ')}`);
        } finally {
            await page.close();
        }
    }
};
