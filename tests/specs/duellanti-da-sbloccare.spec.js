// In Duello Libero i Duellanti si guadagnano.
// =====================================================================
// All'inizio se ne hanno due (Yugi Muto e suo nonno Solomon); gli altri
// si sbloccano battendoli per la prima volta in un Torneo o nella
// Modalità Storia.
//
// Le due cose da sorvegliare sono opposte fra loro, e nessuna delle due
// si nota giocando distrattamente:
//   - se il blocco smette di valere, il gioco sembra funzionare
//     benissimo: semplicemente la Storia non regala più niente, e nessuno
//     se ne accorge finché non lo si va a cercare;
//   - se lo sblocco smette di scattare, un giocatore vince un torneo
//     intero e resta con due Duellanti, che è molto peggio.
// Vanno quindi provate tutte e due, e in particolare che a sbloccare
// siano SOLO le modalità giuste.
//
// `standalone`: serve la pagina del Duello Libero, non quella del duello.
const path = require('path');

module.exports = {
    standalone: true,
    name: 'Duello Libero: i Duellanti si sbloccano vincendo in Torneo o nella Storia',
    async run(t) {
        const RADICE = path.join(__dirname, '..', '..');
        const url = 'file:///' + path.join(RADICE, 'duello-libero.html').replace(/\\/g, '/');
        const page = await t.browser.newPage({ viewport: { width: 1280, height: 950 } });
        const erroriPagina = [];
        page.on('pageerror', (e) => erroriPagina.push(e.message));
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; });

        try {
            await page.goto(url);
            await page.waitForFunction(() => !!(window.CharacterUnlocks && window.SaveManager && typeof characterDatabase !== 'undefined'),
                null, { timeout: 20000 });
            await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                // Nessun amministratore: è il caso del giocatore vero, ed
                // è l'unico in cui il blocco esiste.
                if (!window.CloudSync) window.CloudSync = {};
                CloudSync.isAdmin = function () { return false; };
            });

            // --- Si parte da due, e sono quei due --------------------
            const inizio = await page.evaluate(() => {
                const sbloccati = characterDatabase.filter((c) => CharacterUnlocks.sbloccato(c.id)).map((c) => c.id);
                return { sbloccati: sbloccati, totale: characterDatabase.length };
            });
            // Alberto Angela e Alessandro Barbero sono iniziali per scelta dell'utente (2026-10-21).
            assertUguali(t, inizio.sbloccati, ['albertoAngela', 'alessandroBarbero', 'yugiMuto', 'solomonMuto'],
                'All\'inizio devono essere sfidabili solo Yugi Muto, Solomon Muto, Alberto Angela e Alessandro Barbero');
            t.assert(inizio.totale > 10,
                `Il roster deve essere molto più lungo dei due iniziali, altrimenti non c'è niente da sbloccare (${inizio.totale})`);

            // --- La griglia lo mostra, non lo nasconde ---------------
            // Un Duellante bloccato resta VISIBILE: sparire dalla griglia
            // non direbbe al giocatore che c'è qualcosa da guadagnare.
            const griglia = await page.evaluate(() => ({
                totali: document.querySelectorAll('.cube').length,
                bloccati: document.querySelectorAll('.cube--bloccato').length
            }));
            t.assert(griglia.totali === inizio.totale,
                `Ogni Duellante deve comparire nella griglia, anche bloccato (${griglia.totali} su ${inizio.totale})`);
            t.assert(griglia.bloccati === inizio.totale - inizio.sbloccati.length,
                `Tutti tranne gli iniziali devono risultare bloccati (${griglia.bloccati})`);

            // --- Un bloccato non lancia un duello --------------------
            // Si clicca quello che il giocatore vedrebbe, e si controlla
            // che la modale della difficoltà NON si apra: è lì che
            // comincia il duello.
            await page.click('.cube--bloccato');
            await page.waitForTimeout(400);
            const modale = await page.evaluate(() => {
                const m = document.getElementById('diffModal');
                return !!(m && getComputedStyle(m).display !== 'none');
            });
            t.assert(!modale, 'Cliccando un Duellante bloccato non deve aprirsi la scelta della difficoltà');

            // --- Solo Torneo e Storia sbloccano ----------------------
            const modalita = await page.evaluate(() => ({
                torneo: CharacterUnlocks.modalitaSblocca('tournament'),
                storia: CharacterUnlocks.modalitaSblocca('story'),
                libero: CharacterUnlocks.modalitaSblocca('free'),
                demo: CharacterUnlocks.modalitaSblocca('sandbox'),
                online: CharacterUnlocks.modalitaSblocca('multiplayer')
            }));
            t.assert(modalita.torneo && modalita.storia, 'Torneo e Storia devono sbloccare');
            t.assert(!modalita.libero && !modalita.demo && !modalita.online,
                `Nessun'altra modalità deve sbloccare: ${JSON.stringify(modalita)}`);

            // --- Vincere sblocca, e una volta sola -------------------
            const dopo = await page.evaluate(() => {
                const primaVolta = CharacterUnlocks.sblocca('kaiba');
                const seconda = CharacterUnlocks.sblocca('kaiba');
                return {
                    primaVolta: primaVolta,
                    seconda: seconda,
                    oraSbloccato: CharacterUnlocks.sbloccato('kaiba'),
                    altriFermi: CharacterUnlocks.sbloccato('pegasus'),
                    salvato: SaveManager.getUnlockedCharacters()
                };
            });
            t.assert(dopo.primaVolta, 'La prima vittoria deve sbloccare il Duellante');
            t.assert(!dopo.seconda,
                'La seconda volta non è uno sblocco: chi chiama deve poter annunciare "nuovo Duellante" solo la prima volta');
            t.assert(dopo.oraSbloccato, 'Sbloccato una volta, deve restare sfidabile');
            t.assert(!dopo.altriFermi, 'Sbloccarne uno non deve sbloccare gli altri');
            assertUguali(t, dopo.salvato, ['kaiba'],
                'Nel salvataggio finiscono solo quelli guadagnati, non i due di partenza');

            // --- E la griglia se ne accorge --------------------------
            const dopoRender = await page.evaluate(() => {
                renderCubes();
                return document.querySelectorAll('.cube--bloccato').length;
            });
            t.assert(dopoRender === griglia.bloccati - 1,
                `Dopo uno sblocco i bloccati devono essere uno in meno (${dopoRender} invece di ${griglia.bloccati - 1})`);

            // --- L'amministratore ne è fuori -------------------------
            const admin = await page.evaluate(() => {
                CloudSync.isAdmin = function () { return true; };
                const bloccati = characterDatabase.filter((c) => !CharacterUnlocks.sbloccato(c.id));
                return { bloccati: bloccati.length, attivo: CharacterUnlocks.attivo() };
            });
            t.assert(admin.bloccati === 0 && !admin.attivo,
                `Per un amministratore non dev'esserci nessun blocco (${admin.bloccati} ancora bloccati)`);

            t.assert(erroriPagina.length === 0, 'Errori JS in pagina: ' + erroriPagina.join(' | '));
        } finally {
            await page.close();
        }

        // --- E adesso la metà che conta di più ----------------------
        // Tutto quanto sopra prova la REGOLA; questo prova che qualcuno
        // la applichi davvero a fine duello. Sono due cose diverse, ed è
        // la seconda a lasciare un giocatore con due Duellanti dopo un
        // torneo intero se si rompe. Duello vero su duelMonstersCore.html
        // (?autowin=1 lo chiude con una vittoria passando da endDuel()
        // come una vittoria normale), non un finish() sintetico.
        const duello = await t.browser.newPage({ viewport: { width: 1200, height: 900 } });
        try {
            await duello.addInitScript(() => { window.AUTH_GATE_SKIP = true; });
            const base = 'file:///' + path.join(RADICE, 'duelMonstersCore.html').replace(/\\/g, '/');
            await duello.goto(base + '?mode=story&campaign=anime&character=mako&difficulty=Medio&autowin=1');
            await duello.waitForFunction(() => sessionStorage.getItem('ygoLastDuelOutcome') !== null,
                null, { timeout: 60000 });
            const esito = await duello.evaluate(() => ({
                vinto: JSON.parse(sessionStorage.getItem('ygoLastDuelOutcome')).playerWon,
                sbloccati: SaveManager.getUnlockedCharacters(),
                sfidabile: CharacterUnlocks.sbloccato('mako')
            }));
            t.assert(esito.vinto === true, 'Il duello di prova deve chiudersi con una vittoria');
            t.assert(esito.sbloccati.indexOf('mako') !== -1,
                `Vincendo nella Storia il Duellante dev'essere sbloccato nel salvataggio: [${esito.sbloccati}]`);
            t.assert(esito.sfidabile, 'E da lì in poi dev\'essere sfidabile in Duello Libero');
        } finally {
            await duello.close();
        }
    }
};

/** Confronto di due elenchi come INSIEMI: l'ordine qui non è parte della regola. */
function assertUguali(t, avuti, attesi, messaggio) {
    const a = avuti.slice().sort().join(',');
    const b = attesi.slice().sort().join(',');
    t.assert(a === b, `${messaggio} — trovati [${a}] invece di [${b}]`);
}
