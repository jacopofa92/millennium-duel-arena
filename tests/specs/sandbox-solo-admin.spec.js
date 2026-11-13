// Il Duello Sandbox è solo per l'amministratore (richiesta dell'utente):
//  - nel menu di index.html la voce è marcata `soloAdmin` e il disegno del
//    sottomenu la filtra;
//  - aprendo duello-sandbox.html a mano, chi non è amministratore torna al
//    menu, e l'amministratore entra.
// L'account si finge sostituendo i metodi di CloudSync nel momento in cui
// lo script vero lo pubblica (stesso trucco di editor-mappa-scrive-sul-file):
// una sostituzione dopo il caricamento arriverebbe tardi, perché il
// controllo parte subito.
const path = require('path');
const fs = require('fs');

const RADICE = path.join(__dirname, '..', '..');
const URL = 'file:///' + path.join(RADICE, 'duello-sandbox.html').replace(/\\/g, '/');

async function apriCome(t, admin) {
    const page = await t.browser.newPage();
    await page.addInitScript((admin) => {
        let vero;
        Object.defineProperty(window, 'CloudSync', {
            configurable: true,
            get() { return vero; },
            set(v) {
                vero = v;
                if (!v) return;
                v.available = true;
                v.waitForUser = () => Promise.resolve({ id: 'utente-di-prova' });
                v.ensureApprovedSession = () => Promise.resolve(true);
                v.isAdmin = () => admin;
            }
        });
    }, admin);
    await page.goto(URL);
    await page.waitForTimeout(1500);
    return page;
}

module.exports = {
    standalone: true,
    name: 'Duello Sandbox: voce e pagina visibili solo all\'amministratore',
    async run(t) {
        const indice = fs.readFileSync(path.join(RADICE, 'index.html'), 'utf8');
        t.assert(/label: 'Demo Duello Sandbox'[^\n]*soloAdmin: true/.test(indice),
            'La voce del Sandbox nel menu deve essere marcata soloAdmin');
        // Le voci passano anche dal filtro dei contenuti opzionali: controlla
        // che la condizione soloAdmin resti parte del filtro complessivo.
        t.assert(/\.filter\(\(\w+\) => \(!\w+\.soloAdmin \|\| admin\) &&/.test(indice),
            'Il sottomenu deve filtrare le voci soloAdmin per chi non è amministratore');

        let page = await apriCome(t, false);
        try {
            t.assert(/index\.html/.test(page.url()), `Chi non è amministratore torna al menu (url: ${page.url()})`);
        } finally { await page.close(); }

        page = await apriCome(t, true);
        try {
            t.assert(/duello-sandbox\.html/.test(page.url()), `L'amministratore resta sulla pagina (url: ${page.url()})`);
            const visibile = await page.evaluate(() => getComputedStyle(document.documentElement).visibility !== 'hidden');
            t.assert(visibile, 'Per l\'amministratore la pagina deve essere visibile');
        } finally { await page.close(); }
    }
};
