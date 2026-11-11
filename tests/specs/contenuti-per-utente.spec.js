const path = require('path');
const fs = require('fs');
const { crea } = require('../../js/cloud/content-access');
const { creaFintoCloud } = require('../helpers/finto-cloud');
const ROOT = path.join(__dirname, '../..');
const url = (f) => 'file:///' + path.join(ROOT, f).replace(/\\/g, '/');

module.exports = {
    name: 'Contenuti per utente: permessi indipendenti, cataloghi, deck conservati, link e cache per account',
    standalone: true,
    async run({ browser, assert }) {
        const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cards.json'), 'utf8'));
        const guerra = cards.find((c) => c.origin === 'ww1');
        const base = cards.find((c) => !c.origin || c.origin === 'yu-gi-oh');
        const flags = { ww1: false, ww2: false, extra: false };
        const access = crea((p) => flags[p], { carte: () => cards.concat([{ id: 999999, name: 'Prova WW2', origin: 'ww2' }]) });
        assert(access.carta(base) && !access.carta(guerra), 'Base disponibile e WW1 bloccata');
        assert(!access.personaggio('robertoGiacobbo') && !access.personaggio('ww1_boroevic'), 'Extra e WW1 non selezionabili');
        assert(!access.campagna('freedom') && !access.campagna('ww2') && access.campagna('anime'), 'Campagne indipendenti');
        assert(!access.campo('images/fields/grande%47uerraCampoDiBattagliaGiorno.jpg'), 'Nome campo codificato non aggira il controllo');
        assert(access.carteVietate({ main: [{ id: guerra.id, qty: 1, origin: 'yu-gi-oh' }] }).length === 1, 'Origin del deck non sostituisce il catalogo canonico');
        flags.ww1 = true;
        assert(access.carta(guerra) && !access.carta(999999) && !access.campagna('freedom'), 'WW1 non abilita WW2 o Extra');

        const { cloud, collega } = creaFintoCloud();
        const profilo = { id: 'utente-prova', email: 'giocatore@prova.it', status: 'approved', is_admin: false, content_ww1: false, content_ww2: false, content_extra: false };
        cloud.profili = [profilo];
        cloud.profili.push({ id: 'altro-utente', email: 'altro@prova.it', status: 'approved', is_admin: false, content_ww1: false, content_ww2: false, content_extra: false });
        const context = await browser.newContext({ viewport: { width: 412, height: 900 }, serviceWorkers: 'block' });
        await collega(context, { utenti: [{ id: 'utente-prova', email: 'giocatore@prova.it' }, { id: 'altro-utente', email: 'altro@prova.it' }] });
        const page = await context.newPage();
        try {
            await page.goto(url('creazione-deck.html'));
            await page.waitForFunction(() => window.SaveManager && window.Contenuti && window.CloudSync);
            await page.evaluate(() => CloudSync.waitForUser().then(() => CloudSync.ensureApprovedSession()));
            const dato = await page.evaluate(({ id }) => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Contenuti');
                const save = SaveManager.load();
                save.collection[id] = 2;
                save.decks.push({ id: 'ww1-salvato', name: 'WW1 conservato', main: [{ id, qty: 2 }], extra: [] });
                save.activeDeckId = 'ww1-salvato';
                save.content_ww1 = true; // Un import NON può concedere privilegi.
                localStorage.setItem('yugiohDuelArenaSave', JSON.stringify(save));
                localStorage.setItem('ygoContentAccess:altro-utente', JSON.stringify({ ww1: true, ww2: true, extra: true, is_admin: true }));
                const prima = SaveManager.getOwnedCount(id);
                SaveManager.addOwnedCards(id, 1);
                return { prima, dopo: SaveManager.getOwnedCount(id), accesso: CloudSync.hasContent('ww1'), vietate: Contenuti.carteVietate(SaveManager.getActiveDeck()).length };
            }, { id: guerra.id });
            assert(dato.prima === 2 && dato.dopo === 2 && !dato.accesso && dato.vietate === 1, 'Deck e carte conservati senza acquisizioni o permessi ereditati: ' + JSON.stringify(dato));
            await page.reload();
            await page.waitForSelector('.deck-card-sub.invalid');
            assert(await page.locator('#myDecksGrid').textContent().then((t) => t.includes('non utilizzabile')), 'Deck salvato segnalato come non utilizzabile');

            await page.goto(url('storia.html') + '?campaign=ww1');
            await page.waitForSelector('#contenuto-non-abilitato', { timeout: 8000 }).catch(() => { throw new Error('Storia WW1: blocco assente, URL=' + page.url()); });
            const campagne = await page.evaluate(() => StoryProgress.getCampaigns().map((c) => c.id));
            assert(!campagne.includes('ww1') && !campagne.includes('ww2') && !campagne.includes('freedom') && campagne.includes('anime'), 'Solo le campagne abilitate sono elencate');
            await page.goto(url('duelMonstersCore.html') + '?mode=free&character=ww1_boroevic&origin=all');
            await page.waitForSelector('#contenuto-non-abilitato', { timeout: 8000 }).catch(() => { throw new Error('Duello WW1: blocco assente, URL=' + page.url()); });

            profilo.content_ww1 = true;
            await page.goto(url('creazione-deck.html'));
            await page.waitForFunction(() => window.CloudSync && CloudSync.hasContent('ww1'));
            await page.waitForTimeout(300); // una sola ricarica all'arrivo dei nuovi permessi
            await page.waitForFunction(() => window.CloudSync && CloudSync.hasContent('ww1'));
            const riattivato = await page.evaluate((id) => ({ copie: SaveManager.getOwnedCount(id), vietate: Contenuti.carteVietate(SaveManager.getActiveDeck()).length, ww2: CloudSync.hasContent('ww2'), extra: CloudSync.hasContent('extra') }), guerra.id);
            assert(riattivato.copie === 2 && riattivato.vietate === 0 && !riattivato.ww2 && !riattivato.extra, 'Riabilitazione senza perdita dati o concessioni ad altri pacchetti');

            cloud.profiliOffline = true;
            await page.reload();
            await page.waitForFunction(() => window.CloudSync && window.Contenuti && CloudSync.getUser());
            const offline = await page.evaluate(async () => ({ approvato: await CloudSync.ensureApprovedSession(), ww1: CloudSync.hasContent('ww1'), ww2: CloudSync.hasContent('ww2'), extra: CloudSync.hasContent('extra') }));
            assert(offline.approvato && offline.ww1 && !offline.ww2 && !offline.extra, 'Offline usa soltanto gli ultimi permessi confermati di questo account');
            cloud.profiliOffline = false;
            await page.evaluate(() => localStorage.setItem('__fintoUtente', 'altro-utente'));
            await page.reload();
            await page.waitForTimeout(350);
            await page.waitForFunction(() => window.CloudSync && CloudSync.getUser() && CloudSync.getUser().id === 'altro-utente');
            await page.evaluate(() => CloudSync.ensureApprovedSession());
            assert(!await page.evaluate(() => CloudSync.hasContent('ww1')), 'Cambio account non eredita la cache del precedente');
            assert(!await page.evaluate((id) => Contenuti.carta(id), guerra.id), 'Il catalogo applica i permessi del nuovo account');
        } finally { await context.close(); }
    }
};
