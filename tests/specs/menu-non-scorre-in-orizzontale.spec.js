// I menu non devono poter scorrere in orizzontale.
// =====================================================================
// Segnalato dall'utente: "ho dello scroll fastidioso nei vari menu che
// compare ogni tanto anche se in realtà non serve (e lo fa in
// orizzontale che non ha senso), specialmente se entro nella voce
// duelli".
//
// Misurato: la pagina diventava davvero scorrevole di lato, fino a 17px
// su una finestra da 393px. Il colpevole non era nulla di visibile —
// era `.menu-logo-eyecatch`, la "✦" sopra il titolo. Essendo un div
// normale la sua scatola era larga quanto tutto il blocco del logo, e
// l'animazione `menuEyecatchPulse` la scala a 1.18: uno scale vale
// sull'intera scatola, non sul glifo, quindi quella scatola invisibile
// sporgeva di una decina di px per lato oltre il bordo dello schermo.
// Comparendo e sparendo col battito dell'animazione (2,4s), lo scroll
// sembrava apparire "ogni tanto" e senza motivo; e siccome il logo c'è
// in ogni schermata del menu, si vedeva anche nei sottomenu — da cui
// l'impressione che fosse legato alla voce "Duelli".
//
// Risolto con `display: inline-block`, che fa avvolgere la scatola al
// glifo. Questo spec tiene ferma la PROPRIETÀ ("il menu non scorre di
// lato"), non i numeri: un futuro ritocco all'animazione o al logo non
// deve poter riaprire il buco in silenzio.
//
// Campionare nel tempo invece di guardare una sola volta è essenziale e
// non è prudenza: l'animazione passa per 1.18 solo a metà di ogni
// ciclo, quindi un controllo istantaneo preso nel momento sbagliato
// avrebbe dato "tutto a posto" con il difetto ancora lì.
//
// `standalone` perché serve index.html (e una finestra stretta), mentre
// il resto della suite lavora sulla pagina del duello già aperta.
const path = require('path');

const LARGHEZZA = 393;
const ALTEZZA = 852;
// Un pixel di tolleranza per gli arrotondamenti del layout: sotto quella
// soglia nessuna barra di scorrimento compare davvero.
const TOLLERANZA_PX = 1;
const SECONDI_DI_CAMPIONAMENTO = 3;

/**
 * Tiene d'occhio la larghezza del documento per qualche secondo e
 * restituisce il momento PEGGIORE, con gli elementi che in quell'istante
 * uscivano dai bordi — ordinati dal più esterno, che è quasi sempre il
 * responsabile vero (un figlio sporge perché sporge il padre).
 */
async function peggiorSbordoOrizzontale(page, secondi) {
    return page.evaluate(async (durata) => {
        const de = document.documentElement;
        let peggio = { extra: 0, colpevoli: [] };
        const inizio = performance.now();
        while (performance.now() - inizio < durata) {
            const extra = de.scrollWidth - de.clientWidth;
            if (extra > peggio.extra) {
                const limite = de.clientWidth;
                const colpevoli = [];
                document.querySelectorAll('body *').forEach((el) => {
                    const stile = getComputedStyle(el);
                    if (stile.display === 'none' || stile.visibility === 'hidden') return;
                    const r = el.getBoundingClientRect();
                    if (r.width === 0 && r.height === 0) return;
                    if (r.right <= limite + 1 && r.left >= -1) return;
                    let profondita = 0;
                    let nodo = el;
                    while (nodo.parentElement) { profondita++; nodo = nodo.parentElement; }
                    colpevoli.push({
                        sel: el.tagName.toLowerCase()
                            + (el.id ? '#' + el.id : '')
                            + (el.className ? '.' + String(el.className).trim().split(/\s+/).slice(0, 3).join('.') : ''),
                        left: Math.round(r.left),
                        right: Math.round(r.right),
                        profondita
                    });
                });
                colpevoli.sort((a, b) => a.profondita - b.profondita);
                peggio = { extra, colpevoli: colpevoli.slice(0, 4) };
            }
            await new Promise((risolvi) => requestAnimationFrame(risolvi));
        }
        return peggio;
    }, secondi * 1000);
}

function descriviColpevoli(peggio) {
    if (!peggio.colpevoli.length) return '(nessun elemento identificato)';
    return peggio.colpevoli
        .map((c) => `${c.sel} [${c.left}..${c.right}]`)
        .join(' | ');
}

module.exports = {
    name: 'I menu non scorrono in orizzontale (logo, menu principale, sottomenu Duelli)',
    standalone: true,
    async run({ browser, assert }) {
        const RADICE = path.join(__dirname, '..', '..');
        const url = 'file:///' + RADICE.replace(/\\/g, '/') + '/index.html';
        const context = await browser.newContext({
            viewport: { width: LARGHEZZA, height: ALTEZZA },
            isMobile: true,
            hasTouch: true,
            serviceWorkers: 'block'
        });
        const page = await context.newPage();

        try {
            await page.goto(url);
            await page.waitForTimeout(2600);

            // Il menu vive dietro il gate di accesso, che qui non può
            // essere superato davvero (serve un account approvato online):
            // lo si scavalca chiamando showMenu(), che è esattamente ciò
            // che il gate fa quando l'accesso va a buon fine. E serve un
            // salvataggio, altrimenti il menu mostra solo tre voci e la
            // voce "Duelli" non esiste nemmeno.
            await page.evaluate(() => {
                const splash = document.getElementById('splashScreen');
                if (splash) splash.style.display = 'none';
                if (window.SaveManager && !SaveManager.hasSave()) SaveManager.createNew('Tester');
                if (typeof window.showMenu === 'function') window.showMenu();
            });
            await page.waitForTimeout(600);

            const voci = await page.$$eval('#menuShell .menu-item', (els) => els.map((el) => el.textContent.replace(/\s+/g, ' ').trim()));
            assert(
                voci.some((v) => /Duelli/i.test(v)),
                `Il menu completo non è stato raggiunto: voci trovate = ${JSON.stringify(voci)}`
            );

            const menu = await peggiorSbordoOrizzontale(page, SECONDI_DI_CAMPIONAMENTO);
            assert(
                menu.extra <= TOLLERANZA_PX,
                `Il menu principale scorre in orizzontale di ${menu.extra}px: ${descriviColpevoli(menu)}`
            );

            // Si entra nel sottomenu cliccando la voce per davvero, non
            // forzando lo stato interno: è il percorso dell'utente.
            const entrato = await page.evaluate(() => {
                const voce = Array.from(document.querySelectorAll('#menuShell .menu-item'))
                    .find((el) => /Duelli/i.test(el.textContent));
                if (!voce) return false;
                voce.click();
                return true;
            });
            assert(entrato, 'Non è stato possibile cliccare la voce "Duelli" del menu');
            await page.waitForTimeout(600);

            const sottovoci = await page.$$eval('#menuShell .menu-item', (els) => els.map((el) => el.textContent.replace(/\s+/g, ' ').trim()));
            assert(
                sottovoci.some((v) => /Allenamento/i.test(v)),   // dal 1.4.160 le voci stanno in tre sottomenu (Campagna, Sfide a rotazione, Allenamento)
                `Il sottomenu Duelli non si è aperto: voci = ${JSON.stringify(sottovoci)}`
            );

            const sottomenu = await peggiorSbordoOrizzontale(page, SECONDI_DI_CAMPIONAMENTO);
            assert(
                sottomenu.extra <= TOLLERANZA_PX,
                `Il sottomenu Duelli scorre in orizzontale di ${sottomenu.extra}px: ${descriviColpevoli(sottomenu)}`
            );
        } finally {
            await context.close();
        }
    }
};
