// La mappa della Storia: si ingrandisce, si rimpicciolisce, e su telefono
// le informazioni si chiudono per lasciarle lo schermo.
// =====================================================================
// Due richieste esplicite: poter fare zoom sulla mappa, e che la mappa si
// estenda il più possibile su tutto lo schermo ("le info sulla campagna
// sono invasive a video così su mobile... fai magari un collapse").
//
// Le tre cose che questo spec tiene ferme, perché rompendosi non si
// vedrebbero se non provando a mano su un telefono:
//
//   1) i comandi dello zoom esistono e funzionano nei due versi, e il
//      punto del mondo che sta al centro dello sguardo ci RESTA dopo uno
//      zoom. Senza quest'ultima cosa ogni tocco del "+" sposta la vista
//      in un punto a caso e la mappa diventa inesplorabile;
//   2) rimpicciolendo non compaiono MAI zone vuote — né al minimo, né
//      scorrendo fino agli angoli, né dopo aver ruotato lo schermo.
//      È il punto più facile da sbagliare: lo zoom che fa entrare tutta
//      la mappa (`min` fra i due rapporti) lascia per forza due bande
//      vuote sul lato in eccesso, perché mappa e finestra non hanno mai
//      la stessa forma. Quello giusto è `max`, che copre;
//   3) su schermo stretto le informazioni sulla campagna partono chiuse e
//      la mappa si prende il resto, mentre su desktop il pulsante che le
//      chiude non esiste nemmeno — lì lo spazio non manca e sarebbe solo
//      un clic in più.
//
// `standalone`: serve storia.html a due dimensioni di finestra diverse,
// non la pagina del duello su cui lavora il resto della suite.
const path = require('path');

const CAMPAGNA_PREDEFINITA = 'forbiddenMemories';
/**
 * Per la ROTAZIONE serve un mondo ALTO e stretto: su una mappa
 * panoramica, ruotando il telefono in orizzontale il minimo che copre
 * SCENDE, lo zoom resta dov'è e il riadattamento non viene mai messo
 * alla prova — verificato disattivandolo: il test passava lo stesso.
 *
 * Quel mondo il test se lo COSTRUISCE (vedi più sotto, dove chiama
 * NodeMap.render con 1400x2600). Prima lo prendeva in prestito da una
 * campagna, e si è rotto due volte: Memorie Proibite è passata a
 * 3200x1800, e "Il Regno delle Ombre" è diventata una mappa panoramica
 * di aree. Questa costante resta solo per aprire la pagina su una
 * campagna qualunque.
 */
const CAMPAGNA_ALTA = 'anime';
const TELEFONO = { width: 393, height: 852 };
const TELEFONO_ORIZZONTALE = { width: 852, height: 393 };
const DESKTOP = { width: 1300, height: 900 };

/**
 * Vero se il mondo della mappa copre la finestra in ENTRAMBE le
 * direzioni. Se è più piccolo anche su un solo asse, su quel lato si
 * vede il fondo — ed è esattamente ciò che non deve accadere.
 */
function copre(page) {
    return page.evaluate(() => {
        const sc = document.querySelector('#mappaViewport .nm-scroll');
        const m = document.querySelector('#mappaViewport .nm-mondo').getBoundingClientRect();
        return m.width >= sc.clientWidth - 1 && m.height >= sc.clientHeight - 1;
    });
}

/**
 * Dove sta un nodo DENTRO il mondo (come frazione, quindi indipendente
 * dallo zoom) e quanto è grande il suo pallino a schermo.
 */
function misuraNodo(page, indice) {
    return page.evaluate((i) => {
        const vp = document.getElementById('mappaViewport');
        const mondo = vp.querySelector('.nm-mondo').getBoundingClientRect();
        const nodo = document.querySelectorAll('.nm-node')[i];
        const r = nodo.getBoundingClientRect();
        return {
            fx: Math.round(((r.left + r.width / 2) - mondo.left) / mondo.width * 10000) / 10000,
            fy: Math.round(((r.top + r.height / 2) - mondo.top) / mondo.height * 10000) / 10000,
            dot: Math.round(nodo.querySelector('.nm-dot').getBoundingClientRect().width)
        };
    }, indice);
}

/** I numeri veri, per un messaggio di errore che si capisca da solo. */
async function descriviCopertura(page, premessa) {
    const d = await page.evaluate(() => {
        const vp = document.getElementById('mappaViewport');
        const sc = vp.querySelector('.nm-scroll');
        const m = vp.querySelector('.nm-mondo').getBoundingClientRect();
        return {
            zoom: Math.round((vp.__nmZoom || 1) * 1000) / 1000,
            mondo: Math.round(m.width) + 'x' + Math.round(m.height),
            finestra: sc.clientWidth + 'x' + sc.clientHeight
        };
    });
    return `${premessa}: allo zoom ${d.zoom} il mondo è ${d.mondo} in una finestra ${d.finestra}`;
}

module.exports = {
    name: 'Storia: zoom della mappa, e su telefono le informazioni si chiudono',
    standalone: true,
    async run({ browser, assert }) {
        const RADICE = path.join(__dirname, '..', '..');
        const url = 'file:///' + RADICE.replace(/\\/g, '/') + '/storia.html';

        /**
         * Apre la mappa di una campagna a una data dimensione di finestra.
         * `campagna` serve perché la prova sulla rotazione ha bisogno di un
         * mondo ALTO — vedi lì il perché.
         */
        async function apri(viewport, dettagliAperti, campagna) {
            const CAMPAGNA = campagna || CAMPAGNA_PREDEFINITA;
            const context = await browser.newContext({ viewport: viewport, serviceWorkers: 'block' });
            await context.addInitScript((aperti) => {
                window.AUTH_GATE_SKIP = true;
                try {
                    // La preferenza del collapse vive in localStorage: si
                    // parte da uno stato noto invece di ereditare quello
                    // lasciato da un'esecuzione precedente.
                    //
                    // UNA VOLTA SOLA, però: addInitScript gira ad OGNI
                    // navigazione, ricaricamenti compresi, e riazzerando
                    // la preferenza ad ogni giro renderebbe impossibile
                    // provare proprio che sopravvive a un ricaricamento.
                    //
                    // Il segno "già fatto" sta in window.name, non in
                    // sessionStorage: sulle pagine aperte da file, Chromium
                    // su Linux (dove gira la suite di GitHub) non garantiva
                    // che sessionStorage sopravvivesse al ricaricamento, lo
                    // script ripartiva e rimetteva "chiuso" proprio prima
                    // della verifica. window.name resta alla scheda.
                    if (window.name === '__statoInizialeImpostato') return;
                    window.name = '__statoInizialeImpostato';
                    if (aperti === null) localStorage.removeItem('ygoStoriaDettagliAperti');
                    else localStorage.setItem('ygoStoriaDettagliAperti', aperti ? '1' : '0');
                } catch (e) { /* niente */ }
            }, dettagliAperti === undefined ? null : dettagliAperti);
            const page = await context.newPage();
            await page.goto(url);
            await page.waitForFunction(() => !!(window.StoryProgress && window.SaveManager), null, { timeout: 15000 });
            await page.evaluate((campagna) => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                // Un progresso a metà strada, non un numero alto a caso:
                // la campagna anime è passata da 26 tappe sciolte a 7
                // aree, e un `completate: 16` la dava per finita — nessun
                // nodo corrente, e questo test restava in attesa di uno
                // che non sarebbe mai comparso.
                SaveManager.setStoryState(campagna, { completate: 3 });
            }, CAMPAGNA);
            await page.goto(url + '?campaign=' + CAMPAGNA);
            await page.waitForSelector('.nm-node--corrente', { timeout: 15000 });
            await page.waitForTimeout(600);
            return { context: context, page: page };
        }

        // ----------------------------------------------------------------
        // 1) e 2): lo zoom, su desktop
        // ----------------------------------------------------------------
        let sessione = await apri(DESKTOP);
        try {
            const page = sessione.page;

            const iniziale = await page.evaluate(() => {
                const vp = document.getElementById('mappaViewport');
                return {
                    zoom: vp.__nmZoom,
                    pulsanti: vp.querySelectorAll('.nm-zoom-btn').length,
                    valore: (vp.querySelector('.nm-zoom-valore') || {}).textContent
                };
            });
            assert(iniziale.pulsanti === 3,
                `I comandi dello zoom devono essere tre (−, +, tutta la mappa): trovati ${iniziale.pulsanti}`);
            assert(iniziale.zoom === 1,
                `La mappa deve aprirsi a grandezza naturale, come è sempre stata: zoom ${iniziale.zoom}`);
            assert(iniziale.valore === '100%', `L'etichetta deve dire 100%, dice "${iniziale.valore}"`);

            // Il punto del mondo al centro dello sguardo, prima e dopo.
            const centroDelMondo = () => page.evaluate(() => {
                const vp = document.getElementById('mappaViewport');
                const sc = vp.querySelector('.nm-scroll');
                const z = vp.__nmZoom || 1;
                return {
                    zoom: z,
                    x: (sc.scrollLeft + sc.clientWidth / 2) / z,
                    y: (sc.scrollTop + sc.clientHeight / 2) / z
                };
            });

            const prima = await centroDelMondo();
            await page.evaluate(() => document.querySelectorAll('#mappaViewport .nm-zoom-btn')[1].click());
            await page.waitForTimeout(150);
            const dopoPiu = await centroDelMondo();
            assert(dopoPiu.zoom > prima.zoom,
                `Il pulsante "+" deve ingrandire: da ${prima.zoom} a ${dopoPiu.zoom}`);
            // Qualche pixel di scarto è inevitabile (gli scroll sono interi).
            assert(Math.abs(dopoPiu.x - prima.x) < 3 && Math.abs(dopoPiu.y - prima.y) < 3,
                `Ingrandendo, il punto al centro deve restare lo stesso: era (${Math.round(prima.x)}, ${Math.round(prima.y)}), ora (${Math.round(dopoPiu.x)}, ${Math.round(dopoPiu.y)})`);

            await page.evaluate(() => document.querySelectorAll('#mappaViewport .nm-zoom-btn')[0].click());
            await page.waitForTimeout(150);
            const dopoMeno = await centroDelMondo();
            assert(Math.abs(dopoMeno.zoom - prima.zoom) < 0.01,
                `"−" dopo "+" deve riportare allo zoom di partenza: ${dopoMeno.zoom} contro ${prima.zoom}`);

            // Rimpicciolendo all'osso non deve comparire vuoto. Si insiste
            // ben oltre il necessario: il limite deve reggere da sé, non
            // grazie al fatto che nessuno ci prova abbastanza.
            for (let i = 0; i < 12; i++) {
                await page.evaluate(() => document.querySelectorAll('#mappaViewport .nm-zoom-btn')[0].click());
            }
            await page.evaluate(() => document.querySelectorAll('#mappaViewport .nm-zoom-btn')[2].click());
            await page.waitForTimeout(250);
            assert(await copre(page), await descriviCopertura(page,
                'Rimpicciolendo al minimo la mappa deve continuare a coprire tutta la finestra'));

            // E nemmeno scorrendo fino all'angolo opposto.
            const angolo = await page.evaluate(() => {
                const vp = document.getElementById('mappaViewport');
                const sc = vp.querySelector('.nm-scroll');
                sc.scrollLeft = 99999;
                sc.scrollTop = 99999;
                const mondo = vp.querySelector('.nm-mondo').getBoundingClientRect();
                const box = sc.getBoundingClientRect();
                return {
                    destra: Math.round(box.right - mondo.right),
                    basso: Math.round(box.bottom - mondo.bottom)
                };
            });
            assert(angolo.destra <= 1 && angolo.basso <= 1,
                `Scorrendo fino all'angolo non deve restare scoperto nulla: ${angolo.destra}px a destra, ${angolo.basso}px in basso`);

            // --- i nodi restano agganciati alla mappa, e leggibili ------
            // Le tappe sono posate sui luoghi veri della mappa disegnata
            // (il palazzo dove c'è il palazzo), quindi la loro posizione
            // RELATIVA al mondo non deve muoversi di nulla con lo zoom:
            // se si muovesse, un nodo finirebbe nel deserto invece che
            // sulla montagna. Si guarda la frazione, non i pixel.
            const alMinimo = await misuraNodo(page, 0);
            await page.evaluate(() => {
                document.querySelectorAll('#mappaViewport .nm-zoom-btn')[1].click();
                document.querySelectorAll('#mappaViewport .nm-zoom-btn')[1].click();
            });
            await page.waitForTimeout(250);
            const ingrandito = await misuraNodo(page, 0);
            assert(Math.abs(alMinimo.fx - ingrandito.fx) < 0.002 && Math.abs(alMinimo.fy - ingrandito.fy) < 0.002,
                `Ingrandendo, un nodo deve restare sullo stesso punto della mappa: era (${alMinimo.fx}, ${alMinimo.fy}), ora (${ingrandito.fx}, ${ingrandito.fy})`);

            // E rimpicciolendo non deve diventare un puntino: i nodi si
            // ri-scalano in senso opposto allo zoom (vedi node-map.js).
            // Senza, al minimo il pallino scendeva da 56px a 20 — né
            // leggibile né toccabile proprio nella vista d'insieme.
            assert(alMinimo.dot >= 28,
                `Al minimo dello zoom un nodo resta troppo piccolo per essere toccato: ${alMinimo.dot}px`);
            assert(ingrandito.dot < alMinimo.dot * 4,
                `Ingrandendo, i nodi non devono gonfiarsi quanto la mappa: da ${alMinimo.dot}px a ${ingrandito.dot}px`);
        } finally {
            await sessione.context.close();
        }

        // ----------------------------------------------------------------
        // 3) il collapse: c'è su telefono, non su desktop
        // ----------------------------------------------------------------
        sessione = await apri(TELEFONO);
        try {
            const page = sessione.page;
            const chiuso = await page.evaluate(() => {
                const vp = document.getElementById('mappaViewport');
                return {
                    toggleVisibile: document.getElementById('mappaToggle').offsetParent !== null,
                    dettagliVisibili: document.getElementById('mappaDettagli').offsetParent !== null,
                    riassunto: document.getElementById('mappaToggleTesto').textContent,
                    mappaH: vp.getBoundingClientRect().height,
                    finestraH: window.innerHeight,
                    paginaScorre: document.documentElement.scrollHeight - document.documentElement.clientHeight
                };
            });
            assert(chiuso.toggleVisibile, 'Su telefono il pulsante che apre/chiude le informazioni deve esserci');
            assert(!chiuso.dettagliVisibili,
                'Su telefono le informazioni sulla campagna devono partire CHIUSE: erano invasive');
            assert(/Cap\. \d+\/\d+/.test(chiuso.riassunto) && /\d+\/\d+ tappe$/.test(chiuso.riassunto),
                `Chiuse, deve restare un riassunto con capitolo e avanzamento: "${chiuso.riassunto}"`);
            assert(chiuso.mappaH > chiuso.finestraH * 0.7,
                `Con le informazioni chiuse la mappa deve prendersi quasi tutto lo schermo: ${Math.round(chiuso.mappaH)}px su ${chiuso.finestraH}`);
            assert(chiuso.paginaScorre === 0,
                `La pagina non deve scorrere: la mappa si adatta a quello che c'è (scarto ${chiuso.paginaScorre}px)`);

            // Aprendole, la mappa cede spazio ma resta la parte principale.
            await page.click('#mappaToggle');
            await page.waitForTimeout(300);
            const aperto = await page.evaluate(() => ({
                dettagliVisibili: document.getElementById('mappaDettagli').offsetParent !== null,
                mappaH: document.getElementById('mappaViewport').getBoundingClientRect().height
            }));
            assert(aperto.dettagliVisibili, 'Il pulsante deve aprire le informazioni');
            // Dal 1.4.172 le informazioni sono un PANNELLO SOPRA la mappa: non la spingono giu', quindi la mappa non cambia altezza.
            assert(Math.abs(aperto.mappaH - chiuso.mappaH) < 2,
                'Il pannello delle informazioni si apre SOPRA la mappa: non deve cambiarne l\'altezza (era ' + Math.round(chiuso.mappaH) + ', ora ' + Math.round(aperto.mappaH) + ')');

            // La scelta si ricorda.
            await page.reload();
            await page.waitForSelector('.nm-node--corrente', { timeout: 15000 });
            await page.waitForTimeout(500);
            const dopoRicarica = await page.evaluate(() => document.getElementById('mappaDettagli').offsetParent !== null);
            assert(dopoRicarica, 'La scelta di tenere aperte le informazioni deve sopravvivere a un ricaricamento');
        } finally {
            await sessione.context.close();
        }

        // ----------------------------------------------------------------
        // Rotazione dello schermo
        // ----------------------------------------------------------------
        // Ruotando, la finestra cambia forma e con essa lo zoom minimo che
        // evita il vuoto: uno zoom che in verticale copriva tutto, in
        // orizzontale può lasciare scoperte le fasce laterali. La mappa
        // deve rialzarsi da sola.
        sessione = await apri(TELEFONO, undefined, CAMPAGNA_ALTA);
        try {
            const page = sessione.page;
            // La mappa ALTA se la costruisce il test, invece di sperare che
            // una campagna ce l'abbia. Questa prova è l'unica che ha
            // bisogno di un mondo più alto che largo, ed è già stata rotta
            // una volta dal mondo di una campagna cambiato sotto
            // (Memorie Proibite, passata a 3200x1800) e una seconda dal
            // Regno delle Ombre, diventato una mappa panoramica di aree.
            // Rifarla dipendere da un terzo candidato vorrebbe dire
            // aspettare la terza volta: quello che si sta provando è
            // `adattaAllaFinestra` di js/ui/node-map.js, non la forma di
            // una campagna.
            await page.evaluate(() => {
                NodeMap.render('#mappaViewport', {
                    nodi: [
                        { id: 'a', x: 200, y: 200, label: 'A', stato: 'fatta' },
                        { id: 'b', x: 700, y: 1400, label: 'B', stato: 'corrente' },
                        { id: 'c', x: 300, y: 2400, label: 'C', stato: 'bloccata' }
                    ],
                    larghezza: 1400,
                    altezza: 2600
                });
            });
            await page.waitForTimeout(300);
            await page.evaluate(() => document.querySelectorAll('#mappaViewport .nm-zoom-btn')[2].click());
            await page.waitForTimeout(200);
            assert(await copre(page), await descriviCopertura(page, 'In verticale, al minimo'));
            const zoomVerticale = await page.evaluate(() => document.getElementById('mappaViewport').__nmZoom);

            await page.setViewportSize(TELEFONO_ORIZZONTALE);
            // Il riadattamento è volutamente ritardato (il browser riporta
            // le nuove dimensioni in due tempi dopo una rotazione).
            await page.waitForTimeout(700);
            assert(await copre(page), await descriviCopertura(page, 'Dopo aver ruotato in orizzontale'));
            // Su un mondo alto la rotazione OBBLIGA lo zoom a salire: è il
            // caso in cui il riadattamento serve davvero, ed è quello che
            // questo controllo mette alla prova.
            const zoomOrizzontale = await page.evaluate(() => document.getElementById('mappaViewport').__nmZoom);
            assert(zoomOrizzontale > zoomVerticale,
                `Su un mondo alto, ruotando in orizzontale lo zoom deve rialzarsi fin dove serve a non scoprire nulla: era ${zoomVerticale}, è ${zoomOrizzontale}`);

            await page.setViewportSize(TELEFONO);
            await page.waitForTimeout(700);
            assert(await copre(page), await descriviCopertura(page, 'Tornando in verticale'));

            // E lo zoom non deve MAI essere finito sotto il minimo che
            // quella finestra richiede: è il modo diretto di dire "non
            // sono comparse zone vuote", senza passare da quanto è
            // cambiato il numero.
            const sottoIlMinimo = await page.evaluate(() => {
                const vp = document.getElementById('mappaViewport');
                const sc = vp.querySelector('.nm-scroll');
                const mondo = vp.querySelector('.nm-mondo').getBoundingClientRect();
                const minimo = Math.max(sc.clientWidth / (mondo.width / vp.__nmZoom),
                    sc.clientHeight / (mondo.height / vp.__nmZoom));
                return { zoom: vp.__nmZoom, minimo: minimo };
            });
            assert(sottoIlMinimo.zoom >= sottoIlMinimo.minimo - 0.001,
                `Dopo le rotazioni lo zoom (${sottoIlMinimo.zoom}) è sotto il minimo che copre (${sottoIlMinimo.minimo})`);

            // In orizzontale il collapse deve esserci comunque: un telefono
            // ruotato è LARGO 852px — fuori da qualunque limite di
            // larghezza — ma alto 393, e lì l'intestazione si mangiava
            // quasi tutto lo schermo.
            await page.setViewportSize(TELEFONO_ORIZZONTALE);
            await page.waitForTimeout(500);
            const orizzontale = await page.evaluate(() => ({
                toggleVisibile: document.getElementById('mappaToggle').offsetParent !== null,
                mappaH: document.getElementById('mappaViewport').getBoundingClientRect().height,
                finestraH: window.innerHeight
            }));
            assert(orizzontale.toggleVisibile,
                'Anche con il telefono in orizzontale le informazioni devono potersi chiudere: lì manca l\'altezza, non la larghezza');
            assert(orizzontale.mappaH > orizzontale.finestraH * 0.6,
                `In orizzontale la mappa deve restare la parte principale: ${Math.round(orizzontale.mappaH)}px su ${orizzontale.finestraH}`);
        } finally {
            await sessione.context.close();
        }

        // Su desktop vale la stessa barra + pannello (dal 1.4.172): il pulsante c'e' e le informazioni partono chiuse, sopra la mappa.
        sessione = await apri(DESKTOP, false);
        try {
            const desktop = await sessione.page.evaluate(() => ({
                toggleVisibile: document.getElementById('mappaToggle').offsetParent !== null,
                dettagliVisibili: document.getElementById('mappaDettagli').offsetParent !== null
            }));
            assert(desktop.toggleVisibile, 'Su desktop la barra delle informazioni deve esserci');
            assert(!desktop.dettagliVisibili, 'Su desktop le informazioni devono partire chiuse (pannello sopra la mappa)');
            await sessione.page.click('#mappaToggle');
            await sessione.page.waitForTimeout(300);
            const aperto = await sessione.page.evaluate(() => document.getElementById('mappaDettagli').offsetParent !== null);
            assert(aperto, 'Il pulsante deve aprire il pannello anche su desktop');
        } finally {
            await sessione.context.close();
        }    }
};
