// Duello Libero: dove si sblocca ogni Duellante, e la barra in cima.
//  - Gli avversari dei tornei in js/data/character-unlocks.js sono una COPIA
//    degli elenchi scritti nelle pagine dei tornei: qui si confrontano, così
//    un avversario aggiunto a un torneo non resta fuori dai suggerimenti (e
//    uno tolto non resta suggerito per sempre).
//  - Sulla carta di un bloccato c'è dove sbloccarlo, prima le strade
//    sicure (Storia, tornei a elenco fisso), il Torneo Kaiba per ultimo.
//  - Barra con conteggio, filtri per serie e ricerca, nella pagina a sé e
//    nella vista del menu (componente condiviso js/ui/scelta-duellante.js).
//  - Medaglia del livello più alto battuto (record.migliore).
const path = require('path');
const fs = require('fs');
const RADICE = path.join(__dirname, '..', '..');

function elenco(sorgente, nome) {
    const m = sorgente.match(new RegExp(nome + "\\s*=\\s*(?:senzaFinalisti\\()?\\[([^\\]]*)\\]"));
    if (!m) return null;
    return (m[1].match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
}

module.exports = {
    standalone: true,
    name: 'Duello Libero: luoghi di sblocco allineati ai tornei, barra con filtri e ricerca, medaglia',
    async run(t) {
        // --- Elenchi dei tornei allineati alle pagine -------------------
        const regno = fs.readFileSync(path.join(RADICE, 'torneo-regno-duellanti.html'), 'utf8');
        const bc = fs.readFileSync(path.join(RADICE, 'torneo-battle-city.html'), 'utf8');
        const attesoRegno = elenco(regno, 'ROSTER_IDS').concat(['kaiba', 'pegasus']);
        const boss = (bc.match(/BOSS_ID\s*=\s*'([^']+)'/) || [])[1];
        const attesoBc = elenco(bc, 'PRELIM_IDS').concat(elenco(bc, 'HUNTER_IDS'), ['kaiba', boss]);
        t.assert(attesoRegno.length > 2 && attesoBc.length > 4, 'Gli elenchi dei tornei devono essere leggibili dalle loro pagine');

        const page = await t.browser.newPage({ viewport: { width: 1280, height: 900 } });
        const errori = [];
        page.on('pageerror', (e) => errori.push(e.message));
        await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.PAGE_LOADER_SKIP = true; });
        try {
            await page.goto('file:///' + path.join(RADICE, 'duello-libero.html').replace(/\\/g, '/'));
            await page.waitForFunction(() => !!window.SaveManager && !!window.CharacterUnlocks);
            const tornei = await page.evaluate(() => CharacterUnlocks.TORNEI.filter((x) => x.avversari).map((x) => ({ nome: x.nome, avversari: x.avversari })));
            const ugualeA = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
            const r = tornei.find((x) => x.nome === 'Regno dei Duellanti');
            const b = tornei.find((x) => x.nome === 'Battle City');
            t.assert(r && ugualeA(r.avversari, attesoRegno), `Regno dei Duellanti allineato alla pagina: ${JSON.stringify({ copia: r && r.avversari, pagina: attesoRegno })}`);
            t.assert(b && ugualeA(b.avversari, attesoBc), `Battle City allineato alla pagina: ${JSON.stringify({ copia: b && b.avversari, pagina: attesoBc })}`);

            // --- La pagina a sé ------------------------------------------
            await page.evaluate(() => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Tester');
                const s = SaveManager.load();
                s.records = { yugiMuto: { wins: 3, losses: 1, migliore: 'Difficile' } };
                s.unlockedCharacters = [];
                localStorage.setItem('yugiohDuelArenaSave', JSON.stringify(s));
            });
            await page.reload();
            await page.waitForSelector('.sd-barra .sd-conta strong');
            const pagina = await page.evaluate(() => ({
                conta: document.querySelector('.sd-conta strong').textContent,
                attesi: String(CharacterUnlocks.INIZIALI.length + CharacterUnlocks.EXTRA_DISPONIBILI.length),
                bonz: document.querySelector('.cube[data-id="bonz"] .cube-locked').textContent.replace(/\s+/g, ' ').trim(),
                medaglia: (document.querySelector('.cube[data-id="yugiMuto"] .sd-medaglia') || {}).textContent || '',
                bonzFrase: CharacterUnlocks.comeSbloccare(characterDatabase.find((c) => c.id === 'bonz'))
            }));
            t.assert(pagina.conta === pagina.attesi, `All'inizio sono sbloccati solo quelli di partenza (iniziali + extra disponibili = ${pagina.attesi}): ${pagina.conta}`);
            t.assert(/Storia:/.test(pagina.bonz), `Sulla carta di un bloccato c'è dove sbloccarlo, a cominciare dalla Storia: ${pagina.bonz}`);
            t.assert(/Regno dei Duellanti/.test(pagina.bonzFrase) && /Torneo Kaiba \(a sorteggio\)\.$/.test(pagina.bonzFrase),
                `La frase completa elenca tutti i luoghi, il Torneo Kaiba per ultimo: ${pagina.bonzFrase}`);
            t.assert(/Difficile/i.test(pagina.medaglia), `Medaglia del livello più alto battuto: ${pagina.medaglia}`);

            await page.fill('[data-sd="cerca"]', 'tea');
            const trovati = await page.evaluate(() => [...document.querySelectorAll('.cube:not([hidden])')].map((c) => c.dataset.id));
            t.assert(trovati.includes('tea') && trovati.length < 5, `La ricerca ignora maiuscole e accenti ("tea" trova Téa): ${JSON.stringify(trovati)}`);
            await page.fill('[data-sd="cerca"]', '');
            await page.locator('.sd-chip', { hasText: 'Forbidden Memories' }).click();
            const sezioni = await page.evaluate(() => [...document.querySelectorAll('.series-section:not([hidden])')].map((s) => s.dataset.serie));
            t.assert(sezioni.length === 1 && sezioni[0] === 'forbiddenMemories', `Il filtro per serie lascia solo quella serie: ${JSON.stringify(sezioni)}`);

            // Il menu non ha piu' una copia della schermata: Duello Libero e' UNA pagina (duello-libero.html).
            t.assert(!require('fs').readFileSync(require('path').join(RADICE, 'index.html'), 'utf8').includes('id="view-duello-libero"'), 'index.html non deve contenere una seconda copia di Duello Libero');
            t.assert(errori.length === 0, `Nessun errore in pagina: ${JSON.stringify(errori)}`);
        } finally {
            await page.close();
        }
    }
};
