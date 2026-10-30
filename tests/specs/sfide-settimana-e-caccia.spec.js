// Sfide e titoli del Duello della Settimana e della Caccia al Boss, e il pool delle missioni settimanali "da giocatore medio".
// Le Sfide avanzano dagli stessi agganci delle modalita' (settimana-mode.js, caccia-mode.js) tramite ChallengeTracker.recordProgress.
const { openDuel } = require('../helpers/harness');

module.exports = {
    name: 'Sfide e titoli delle modalita\' a rotazione; missioni settimanali alla portata di tutti',
    async run({ page, assert }) {
        await openDuel(page);
        await page.waitForFunction(() => !!window.ChallengeTracker && !!window.missionsDatabase && !!window.challengesDatabase);

        const r = await page.evaluate(() => {
            const sfide = challengesDatabase.filter((c) => c.modalita === 'settimana' || c.modalita === 'caccia');
            const tipi = Array.from(new Set(sfide.map((c) => c.type)));
            // Una missione settimanale non puo' chiedere una carta o un Duellante precisi (un giocatore medio non li ha)
            const settimanali = missionsDatabase.filter((m) => m.scope === 'weekly');
            const specifiche = settimanali.filter((m) => m.match && (m.match.cardId !== undefined || m.match.characterId !== undefined)).map((m) => m.id);
            const esotiche = settimanali.filter((m) => ['winInstantly', 'winMillenniumItem', 'puzzleSolved', 'torreCompleted'].includes(m.type)).map((m) => m.id);
            return { n: sfide.length, tipi, nSett: settimanali.length, specifiche, esotiche, giornaliere: missionsDatabase.filter((m) => m.scope === 'daily').length };
        });
        assert(r.n === 9, `Nove Sfide dedicate alle due modalita': ${JSON.stringify(r)}`);
        assert(r.specifiche.length === 0, `Nessuna missione settimanale chiede carte o Duellanti precisi: ${r.specifiche}`);
        assert(r.esotiche.length === 0, `Nessuna missione settimanale esotica: ${r.esotiche}`);
        assert(r.nSett >= 8, `Il pool settimanale deve bastare a 8 missioni (${r.nSett})`);

        // Avanzamento: una vittoria alla Settimana a Difficile completa "prima" e "difficile"; tre livelli completano "tripletta"
        const av = await page.evaluate(() => {
            const ascolta = (id) => { const p = SaveManager.getChallengeProgress(id); return { n: p.count, fatta: !!p.completed }; };
            ChallengeTracker.recordProgress('settimanaWin', { livello: 'Difficile' });
            ChallengeTracker.recordProgress('settimanaTutti', {});
            ChallengeTracker.recordProgress('cacciaWin', { turni: 4 });
            ChallengeTracker.recordProgress('cacciaVeloce', { turni: 4 });
            return {
                prima: ascolta('settimana-prima'), diff: ascolta('settimana-difficile'), tripletta: ascolta('settimana-tutti-i-livelli'),
                caccia: ascolta('caccia-prima'), veloce: ascolta('caccia-veloce'), cinque: ascolta('caccia-cinque')
            };
        });
        assert(av.prima.fatta && av.diff.fatta && av.tripletta.fatta, `Le Sfide della Settimana avanzano: ${JSON.stringify(av)}`);
        assert(av.caccia.fatta && av.veloce.fatta && av.cinque.n === 1 && !av.cinque.fatta, `Le Sfide della Caccia avanzano (cinque a 1 su 5): ${JSON.stringify(av)}`);

        // Titoli: ogni titolo nuovo esiste e richiede una Sfida che esiste (il file dei titoli non e' caricato dal duello: si legge qui)
        const fs = require('fs'); const path = require('path');
        const testoTitoli = fs.readFileSync(path.join(__dirname, '../../js/data/titles-db.js'), 'utf8');
        const titoli = new Function('window', testoTitoli + '; return titoliSpecialiDatabase;')({});
        const idSfide = await page.evaluate(() => challengesDatabase.map((c) => c.id));
        const nuovi = ['t-settimana-5', 't-settimana-20', 't-settimana-tripletta', 't-caccia-1', 't-caccia-veloce', 't-caccia-10'];
        nuovi.forEach((id) => {
            const tt = titoli.find((x) => x.id === id);
            assert(!!tt, `Manca il titolo ${id}`);
            assert((tt.richiede.sfide || []).every((s) => idSfide.indexOf(s) !== -1), `Il titolo ${id} punta a una Sfida che non esiste: ${JSON.stringify(tt.richiede)}`);
        });    }
};