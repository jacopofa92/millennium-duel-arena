// Le scene della Storia sono intermezzi a dialoghi, e una tappa già fatta
// non può far avanzare due volte.
// =====================================================================
// Le scene erano un riquadro fermo con tutto il testo insieme e un
// pulsante "Avanti". Ora usano lo stesso componente degli intermezzi dei
// tornei (js/ui/story-cutscene.js): luogo sullo sfondo, ritratto di chi
// parla, una battuta alla volta che si scrive e avanza al tocco.
//
// Questo spec sorveglia le tre cose che, rompendosi, non si vedrebbero
// subito:
//
//   1) la scena si apre DAVVERO come intermezzo, con il nome di chi parla
//      — anche quando quella voce non è un personaggio del roster (la
//      Storia ne è piena: "Il Bollettino", "La troupe", "Il Principe").
//      Prima quel nome andava perso e la battuta diventava narratore;
//   2) quando il ritratto non esiste compare il SIGILLO col simbolo della
//      tappa, non un cerchio vuoto. Oggi tutti i personaggi hanno almeno
//      un ritratto PROVVISORIO generato, quindi il caso non capita più da
//      solo: qui si provoca, puntando la voce del roster a un file che
//      non c'è. Il meccanismo serve comunque — è quello che copre ogni
//      personaggio aggiunto prima della sua arte;
//   3) una tappa GIÀ SUPERATA si può rifare — una scena si rilegge, un
//      duello si rigioca — ma NON fa avanzare la storia. È il punto che
//      costa caro se si rompe: rivincere una tappa vecchia sbloccherebbe
//      la successiva senza averla giocata, e si arriverebbe in fondo alla
//      campagna rigiocando sempre la stessa.
//
// `standalone` perché serve storia.html, non la pagina del duello su cui
// lavora il resto della suite.
const path = require('path');

/** La campagna con più materiale su cui provare, e una scena come prima tappa. */
const CAMPAGNA = 'forbiddenMemories';

/**
 * Quante battute deve avere come minimo una tappa di sola storia. Non è
 * un numero sacro: è la soglia sotto la quale l'intermezzo smette di
 * essere una scena e torna a essere una didascalia — che è esattamente
 * quello che l'utente ha chiesto di correggere.
 */
const BATTUTE_MINIME = 4;

/**
 * Chiude una scena andando avanti finché non sparisce.
 *
 * NON "premi Invio quattordici volte e poi aspetta": sotto il carico
 * della suite completa il testo si scrive più lentamente, e un numero
 * fisso di pressioni può finire prima delle battute — lasciando il test
 * ad aspettare una scena che è ancora lì, con un messaggio d'errore
 * (timeout di waitForFunction) che non dice nemmeno dove fosse arrivato.
 * Qui si va avanti finché serve, entro un tetto generoso, e se non basta
 * si dice a che punto era.
 */
async function chiudiScena(page, assert, dove) {
    const scadenza = Date.now() + 25000;
    let ultimo = null;
    while (Date.now() < scadenza) {
        ultimo = await page.evaluate(() => {
            const s = document.querySelector('.sc-scena');
            if (!s) return { presente: false };
            return {
                presente: true,
                // Mentre si chiude perde `is-visibile` ma resta nel DOM
                // per la dissolvenza: premere in quella finestra manderebbe
                // il tasto al nodo rimasto a fuoco sotto la scena.
                visibile: s.classList.contains('is-visibile'),
                chi: (s.querySelector('.sc-chi') || {}).textContent || '',
                testo: ((s.querySelector('.sc-testo') || {}).textContent || '').slice(0, 40)
            };
        });
        if (!ultimo.presente) return;
        if (ultimo.visibile) await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
    }
    assert(false, `La scena non si è chiusa (${dove}) — ultimo stato: ${JSON.stringify(ultimo)}`);
}

module.exports = {
    name: 'Storia: scene cinematiche, sigillo al posto del ritratto mancante, e nessun doppio avanzamento',
    standalone: true,
    async run({ browser, assert }) {
        const RADICE = path.join(__dirname, '..', '..');
        const url = 'file:///' + RADICE.replace(/\\/g, '/') + '/storia.html';
        const context = await browser.newContext({
            viewport: { width: 1000, height: 900 },
            serviceWorkers: 'block'
        });
        await context.addInitScript(() => {
            window.AUTH_GATE_SKIP = true;
            // "Alti" accende anche la polvere dorata: qui interessa solo
            // che accenderla non rompa nulla.
            try { localStorage.setItem('ygoVideoDetail', 'alti'); } catch (e) { /* niente */ }
        });
        const page = await context.newPage();
        const erroriPagina = [];
        page.on('pageerror', (e) => erroriPagina.push(e.message));

        try {
            await page.goto(url);
            await page.waitForFunction(() => !!(window.StoryProgress && window.StoryCutscene && window.SaveManager), null, { timeout: 15000 });

            // Un salvataggio e un punto di partenza deterministici: la
            // prima tappa del capitolo dei Cinque Maghi è una scena, e
            // chi parla (High Mage Secmeton) non ha il ritratto su disco.
            const partenza = await page.evaluate((campagna) => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                const tappe = StoryProgress.getTappe(campagna);
                const i = tappe.findIndex((t) => t.id === 'fm-4-scena-ocean');
                const separazioni = (StoryProgress.getCampaign(campagna).separazioni || []).map((s) => s.id);
                // Stato costruito sul catalogo ATTUALE: senza i timbri la
                // nuova migrazione lo tratterebbe correttamente come un
                // vecchio save precedente agli intermezzi e lo sposterebbe.
                SaveManager.setStoryState(campagna, { completate: i, separazioni });
                return { indice: i, totale: tappe.length };
            }, CAMPAGNA);
            assert(partenza.indice > 0, 'Non trovata la scena di partenza fm-4-scena-ocean nel catalogo');

            await page.goto(url + '?campaign=' + CAMPAGNA);
            await page.waitForSelector('.nm-node--corrente', { timeout: 15000 });

            // Si toglie il ritratto a chi parla in questa scena, puntandolo
            // a un file che non esiste: è l'unico modo di provare il
            // ripiego adesso che ogni personaggio ha almeno un ritratto
            // provvisorio generato. Si tocca solo la copia in memoria del
            // roster, niente sul disco.
            await page.evaluate(() => {
                const pg = characterDatabase.find((c) => c.id === 'highMageSecmeton');
                if (pg) pg.image = 'images/characters/__non_esiste__.jpg';
            });

            // --- 1) la scena si apre come intermezzo -------------------
            // Attese da 25 secondi, non 10: sulla macchina di GitHub (Linux,
            // più lenta, con la polvere dorata di "Alti" accesa) 10 secondi
            // non bastavano e il test falliva solo lì — lo hanno mostrato le
            // annotazioni dei test falliti (vedi tests/run-all.js).
            await page.click('.nm-node--corrente');
            await page.waitForSelector('.sc-scena', { timeout: 25000 });
            // Il cartello d'apertura dura un attimo prima del dialogo.
            await page.waitForFunction(() => {
                const el = document.querySelector('.sc-chi');
                return !!(el && el.textContent.trim());
            }, null, { timeout: 25000 });

            // Il sigillo compare quando l'immagine FALLISCE il caricamento,
            // che è un evento asincrono: leggerlo subito dopo la comparsa
            // del nome lo coglierebbe prima che il browser si sia accorto
            // del file mancante.
            await page.waitForFunction(() => !!document.querySelector('.sc-ritratto.is-sigillo'), null, { timeout: 25000 });

            const scena = await page.evaluate(() => {
                const s = document.querySelector('.sc-scena');
                return {
                    chi: s.querySelector('.sc-chi').textContent.trim(),
                    narratore: s.querySelector('.sc-box').classList.contains('is-narratore'),
                    sigillo: !!s.querySelector('.sc-ritratto.is-sigillo'),
                    simbolo: ((s.querySelector('.sc-sigillo') || {}).textContent || '').trim() || ((s.querySelector('.sc-sigillo .emoji-tema--arena')) ? '🌊' : ''),
                    polvere: !!s.querySelector('.sc-polvere'),
                    lato: s.querySelector('.sc-ritratto').classList.contains('sc-ritratto--sx')
                        || s.querySelector('.sc-ritratto').classList.contains('sc-ritratto--dx'),
                    progresso: (s.querySelector('.sc-progresso') || {}).textContent || ''
                };
            });
            assert(scena.chi === 'High Mage Secmeton',
                `Il nome di chi parla dovrebbe essere "High Mage Secmeton", trovato "${scena.chi}"`);
            assert(!scena.narratore, 'Una battuta con un nome non deve essere resa come voce narrante');

            // --- 2) sigillo al posto del ritratto mancante -------------
            assert(scena.sigillo,
                'Senza il file del ritratto deve comparire il sigillo, non un cerchio vuoto');
            assert(scena.simbolo === '🌊',
                `Il sigillo deve portare il simbolo della tappa (🌊), trovato "${scena.simbolo}"`);
            assert(scena.polvere, 'Con i Dettagli video su "Alti" la scena deve avere la polvere dorata');
            assert(scena.lato, 'Una voce deve essere messa in scena su un lato, non sempre al centro');
            assert(/^1 \/ \d+$/.test(scena.progresso),
                `Il dialogo deve mostrare l'avanzamento della conversazione: "${scena.progresso}"`);

            // Il canvas della polvere deve avere una dimensione VERA: se
            // nasce prima che la scena entri nel documento resta di un
            // pixel, e stirato al 100% diventa una lastra d'oro piena.
            const polvere = await page.evaluate(() => {
                const c = document.querySelector('.sc-polvere');
                return { w: c.width, h: c.height };
            });
            assert(polvere.w > 100 && polvere.h > 100,
                `Il canvas della polvere è ${polvere.w}x${polvere.h}: nato prima che la scena avesse dimensioni`);

            // --- la scena si chiude e fa avanzare ----------------------
            const prima = await page.evaluate((c) => SaveManager.getStoryState(c).completate, CAMPAGNA);
            // Si avanza a tastiera: un click sulla scena mentre si sta
            // chiudendo colpirebbe un elemento che si sta staccando.
            await chiudiScena(page, assert, 'prima lettura della scena');
            const dopo = await page.evaluate((c) => SaveManager.getStoryState(c).completate, CAMPAGNA);
            assert(dopo === prima + 1,
                `Una scena letta deve far avanzare di una tappa sola: da ${prima} a ${dopo}`);

            // --- 3) le tappe già fatte si rifanno, ma non fanno avanzare -
            // Una scena si rilegge, un duello si RIGIOCA (richiesta
            // esplicita: "devo poter rigiocare i livelli nella storia").
            // La cosa da sorvegliare non è più "il duello è bloccato" ma
            // "rifarlo non muove la storia": rivincere una tappa già
            // superata sbloccherebbe la successiva senza giocarla.
            await page.waitForSelector('.nm-node--corrente', { timeout: 25000 });
            const cliccabili = await page.evaluate(() => {
                const fatti = Array.from(document.querySelectorAll('.nm-node--fatta'));
                return {
                    fattiTotali: fatti.length,
                    fattiApribili: fatti.filter((n) => !n.disabled).length
                };
            });
            assert(cliccabili.fattiTotali > 0 && cliccabili.fattiApribili === cliccabili.fattiTotali,
                `Ogni tappa già superata deve potersi rifare: ${cliccabili.fattiApribili} su ${cliccabili.fattiTotali}`);

            // Il duello di una tappa rigiocata deve portare il segno fino
            // al ritorno, altrimenti la mappa non saprebbe distinguerlo da
            // una tappa giocata per la prima volta.
            const urlRigiocata = await page.evaluate((campagna) => {
                const tappa = StoryProgress.getTappeConStato(campagna)
                    .filter((t) => t.kind === 'duel' && t.stato === 'fatta')[0];
                return tappa ? StoryProgress.urlDuello(campagna, tappa, { rigiocata: true }) : null;
            }, CAMPAGNA);
            assert(urlRigiocata && /[?&]replay=1(&|$)/.test(urlRigiocata),
                `L'URL di una tappa rigiocata deve dirlo: "${urlRigiocata}"`);

            // E rivincerla non deve muovere la storia di una tappa.
            const primaDiRigiocare = await page.evaluate((c) => SaveManager.getStoryState(c).completate, CAMPAGNA);
            await page.evaluate((campagna) => {
                sessionStorage.setItem('ygoLastDuelOutcome', JSON.stringify({
                    mode: 'story', campaignId: campagna, rigiocata: true,
                    playerWon: true, opponentId: 'oceanMage', timestamp: Date.now()
                }));
            }, CAMPAGNA);
            await page.reload();
            await page.waitForSelector('.nm-node--corrente', { timeout: 15000 });
            await page.waitForTimeout(500);
            const dopoRigiocata = await page.evaluate((c) => SaveManager.getStoryState(c).completate, CAMPAGNA);
            assert(dopoRigiocata === primaDiRigiocare,
                `Rivincere una tappa già superata NON deve far avanzare la campagna: da ${primaDiRigiocare} a ${dopoRigiocata}`);
            const avvisoRigiocata = await page.evaluate(() => (document.querySelector('.avviso') || {}).textContent || '');
            assert(/rigiocat/i.test(avvisoRigiocata),
                `La mappa deve dire che era una rigiocata, altrimenti sembra che la vittoria non sia stata contata: "${avvisoRigiocata}"`);

            // Rileggere una scena già vista non deve toccare il progresso.
            //
            // La SCENA si sceglie per indice, non prendendo "la prima
            // tappa fatta cliccabile": da quando anche i duelli superati
            // si rigiocano, quella sarebbe potuta essere un duello, e
            // cliccarlo porta via dalla pagina invece di aprire una
            // scena — un test che aspetta un riquadro che non arriverà
            // mai. I nodi sono disegnati nell'ordine delle tappe, quindi
            // l'indice della tappa è l'indice del nodo.
            const primaDiRileggere = await page.evaluate((c) => SaveManager.getStoryState(c).completate, CAMPAGNA);
            const indiceScena = await page.evaluate((campagna) => {
                const t = StoryProgress.getTappeConStato(campagna)
                    .find((x) => x.kind === 'scene' && x.stato === 'fatta');
                return t ? t.indice : -1;
            }, CAMPAGNA);
            assert(indiceScena >= 0, 'Nessuna scena già vista da rileggere: il test non proverebbe nulla');
            await page.evaluate((i) => document.querySelectorAll('.nm-node')[i].click(), indiceScena);
            await page.waitForSelector('.sc-scena', { timeout: 25000 });
            await chiudiScena(page, assert, 'rilettura di una scena gia vista');
            const dopoRilettura = await page.evaluate((c) => SaveManager.getStoryState(c).completate, CAMPAGNA);
            assert(dopoRilettura === primaDiRileggere,
                `Rileggere una scena già vista non deve far avanzare: da ${primaDiRileggere} a ${dopoRilettura}`);

            // --- Le scene hanno il respiro di una scena ----------------
            // Richiesta esplicita: le tappe di sola storia devono essere
            // un po' più lunghe. Due battute non sono un intermezzo, sono
            // una didascalia — e il cartello d'apertura più il ritratto
            // costano più tempo del testo che introducono. La soglia vale
            // per OGNI campagna, perché è lì che il taglio corto si
            // rifarebbe vivo: scrivendone una nuova, copiando la forma di
            // una vecchia.
            const corte = await page.evaluate((minimo) => {
                const fuori = [];
                StoryProgress.getCampaigns().forEach((c) => {
                    StoryProgress.getTappe(c.id).forEach((t) => {
                        if (t.kind === 'scene' && (t.testo || []).length < minimo) {
                            fuori.push(`${t.id} (${(t.testo || []).length})`);
                        }
                    });
                });
                return fuori;
            }, BATTUTE_MINIME);
            assert(corte.length === 0,
                `Ogni scena deve avere almeno ${BATTUTE_MINIME} battute: ` + corte.join(', '));

            assert(erroriPagina.length === 0, 'Errori JS in pagina: ' + erroriPagina.join(' | '));
        } finally {
            await context.close();
        }
    }
};
