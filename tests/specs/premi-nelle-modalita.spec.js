const path = require('path');
const fs = require('fs');

// Ogni modalita' dice cosa paga PRIMA di giocarla (Rewards.modalitaHtml). I numeri si leggono da Rewards
// e dai database delle modalita': un premio cambiato li' deve cambiare anche qui, senza ritocchi alle pagine.
const RADICE = path.join(__dirname, '..', '..');
const url = (f) => 'file:///' + path.join(RADICE, f).replace(/\\/g, '/');

async function pagina(t, file, preparazione) {
    const page = await t.browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errori = [];
    page.on('pageerror', (e) => errori.push(e.message));
    await page.addInitScript(() => { window.AUTH_GATE_SKIP = true; window.SALA_CLASSICA = true; });
    if (preparazione) {
        await page.goto(url('index.html'));
        await page.evaluate(preparazione);
    }
    await page.goto(url(file));
    return { page, errori };
}

module.exports = {
    standalone: true,
    name: 'Premi dichiarati in ogni modalita (Puzzle, Rivincite, Torre, Caccia, Settimana, Tutorial, Storia, Tornei)',
    async run(t) {
        const verifica = async (file, selettore, attesi, preparazione, nome) => {
            const { page, errori } = await pagina(t, file, preparazione);
            try {
                await page.waitForSelector(selettore, { state: 'attached', timeout: 15000 });
                const testo = await page.evaluate((s) => Array.from(document.querySelectorAll(s)).map((e) => e.textContent).join(' | '), selettore);
                const calcolati = await page.evaluate(attesi);
                calcolati.forEach((frammento) => t.assert(testo.includes(frammento), `${nome}: manca "${frammento}" in: ${testo.slice(0, 400)}`));
                // Icone a tema del gioco (js/ui/icon-library.js), non le emoji di sistema: ogni riga ha il suo SVG.
                const senzaIcona = await page.evaluate((s) => Array.from(document.querySelectorAll(s + ' .rw-ico'))
                    .filter((e) => !e.querySelector('svg.themed-icon')).map((e) => e.textContent), selettore);
                t.assert(senzaIcona.length === 0, `${nome}: righe con l'emoji al posto dell'icona a tema: ${senzaIcona.join(' ')}`);
                t.assert(errori.length === 0, `${nome}: errori in pagina ${errori.join('; ')}`);
            } finally { await page.close(); }
        };
        const n = (x) => `Number(${x}).toLocaleString('it-IT')`;

        await verifica('puzzle.html', '#premiModalita .rw-anteprima',
            () => [1, 2, 3].map((d) => '+' + Rewards.puzzleCrediti(d)).concat(['non è un duello vero']),
            null, 'Puzzle');

        await verifica('tutorial.html', '#premiModalita .rw-anteprima',
            () => ['+' + Rewards.TUTORIAL_CREDITI + ' crediti'], null, 'Tutorial');

        await verifica('caccia-boss.html', '#premio .rw-anteprima',
            () => {
                const p = cacciaDatabase.premio;
                return ['+' + Number(p.crediti).toLocaleString('it-IT') + ' crediti', 'Stelle', 'entro ' + p.bonusVeloce.entroTurni + ' turni',
                    '+' + Rewards.WIN_CREDITS[cacciaDatabase.livello] + ' crediti'];
            }, null, 'Caccia');

        await verifica('settimana.html', '#premiModalita .rw-anteprima',
            () => ['Facile ' + settimanaDatabase.premi.Facile.crediti, 'Una volta a settimana per livello',
                '+' + Rewards.WIN_CREDITS.Facile + ' ', '+' + Rewards.WIN_CREDITS.Difficile + ' '], null, 'Settimana');

        await verifica('rivincite.html', '#premiModalita .rw-anteprima',
            () => ['medaglia', '+' + Rewards.WIN_CREDITS.Medio + ' '],
            () => { if (!SaveManager.hasSave()) SaveManager.createNew('Rivale'); SaveManager.setStoryState('anime', { finita: true }); }, 'Rivincite');

        await verifica('torre.html', '#premiModalita .rw-anteprima',
            () => ['piani 1–4 Facile', 'Ristoro', 'piano 15', '+1 Carta Locazione', '+1 Carta del Millennio', 'piano 20'],
            () => {
                if (!SaveManager.hasSave()) SaveManager.createNew('Scalatore');
                const s = SaveManager.getCardAcquisitionState();
                s.completedChapters = s.completedChapters || {};
                s.completedChapters.regno = true;
                SaveManager.setCardAcquisitionState(s);
            }, 'Torre');

        await verifica('storia.html', '#premiModalita .rw-anteprima',
            () => ['+' + Rewards.CREDITI_PER_ARCO_STORIA + ' crediti', '×1,5', '+' + Rewards.WIN_CREDITS.Facile + ' '],
            () => { if (!SaveManager.hasSave()) SaveManager.createNew('Narratore'); }, 'Storia');

        // Tornei: un riquadro richiudibile per ognuno, con i premi della sua tabella.
        await verifica('tornei.html', '#premiTornei details',
            () => {
                const T = Rewards.TOURNAMENT_COMPLETION;
                return ['Premi · ', String(T.duelistKingdom.credits.Difficile) + ' Difficile', 'Occhio del Millennio',
                    'Carte del Millennio', '+' + Rewards.TOURNAMENT_DUEL_CREDITS + ' crediti'];
            },
            () => { if (!SaveManager.hasSave()) SaveManager.createNew('Torneista'); }, 'Tornei');

        // Assalto al Boss (Multiplayer): i numeri sono quelli con cui forRaid paga davvero.
        await verifica('multiplayer.html?modo=raid', '#mpPremiModo .rw-anteprima',
            () => ['+' + Rewards.CREDITI_RAID + ' crediti', Rewards.STELLE_RAID + ' Stelle', Rewards.RAID_AL_GIORNO + ' volte al giorno',
                '+' + Rewards.LOSS_CREDITS + ' crediti di partecipazione', Math.round(Rewards.RAID_CONTRIBUTO_MINIMO * 100) + '%',
                '+' + Rewards.RAID_PREMI[2].crediti + ' crediti', 'prima volta'],
            null, 'Raid');
        // Duello e Specchio online (stessa tabella), Tag Team in rete: ognuno dichiara i suoi premi prima di aprire la stanza.
        await verifica('multiplayer.html?modo=duello', '#mpPremiModo .rw-anteprima',
            () => ['+' + Rewards.ONLINE.VITTORIA + ' crediti', 'Ogni ' + Rewards.ONLINE.STELLA_OGNI + ' vittorie online',
                '+' + Rewards.ONLINE.SCONFITTA + ' crediti di partecipazione', Rewards.ONLINE.TURNI_MINIMI + ' turni tuoi'],
            null, 'Duello online');
        await verifica('multiplayer.html?modo=specchio', '#mpPremiModo .rw-anteprima',
            () => ['Specchio', '+' + Rewards.ONLINE.VITTORIA + ' crediti'], null, 'Specchio online');
        await verifica('multiplayer.html?modo=tag', '#mpPremiModo .rw-anteprima',
            () => ['+' + Rewards.ONLINE.TAG_PERSONE + ' crediti', '+' + Rewards.ONLINE.TAG_BOSS + ' crediti',
                'fino a ' + Rewards.ONLINE.TAG_STELLE_AL_GIORNO + ' Stelle al giorno'], null, 'Tag online');
        // La riga di riassunto e' SEMPRE visibile (come "Premi della vittoria a Normale" in Duello Libero), prima ancora di aprire l'elenco.
        {
            const { page } = await pagina(t, 'multiplayer.html?modo=duello', null);
            try {
                await page.waitForSelector('#mpPremiModo summary', { timeout: 15000 });
                const riga = await page.evaluate(() => document.querySelector('#mpPremiModo summary').textContent);
                t.assert(/Premi della vittoria/.test(riga) && riga.includes('+50 crediti'), `riassunto non visibile o senza cifre: ${riga}`);
            } finally { await page.close(); }
        }

        // I due numeri che stavano nel codice delle modalita' devono ora venire da Rewards (nessuna copia a mano).
        const puzzle = fs.readFileSync(path.join(RADICE, 'js', 'modes', 'puzzle-mode.js'), 'utf8');
        t.assert(puzzle.includes('Rewards.puzzleCrediti'), 'puzzle-mode.js deve leggere i crediti da Rewards.puzzleCrediti');
        t.assert(!/60 \+ 40 \*/.test(puzzle), 'puzzle-mode.js non deve ricopiare la formula dei crediti');
        const tut = fs.readFileSync(path.join(RADICE, 'js', 'tutorial', 'tutorial-duel.js'), 'utf8');
        t.assert(tut.includes('Rewards.TUTORIAL_CREDITI'), 'tutorial-duel.js deve leggere il premio da Rewards.TUTORIAL_CREDITI');
    }
};
