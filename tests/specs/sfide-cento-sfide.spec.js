// "Il Conto alla Rovescia": completare 100 Sfide (di qualunque sezione) dà la carta segreta 1283, una copia sola.
//  - il progresso della Sfida E' il numero di Sfide completate, e si aggiorna a ogni completamento;
//  - a 100 paga una volta sola: la carta (limit 1, nessuna copia in piu' neanche ripetendo) e le valute;
//  - chi aveva gia' 100 Sfide prima che esistesse la riceve aprendo la pagina Sfide;
//  - la carta resta fuori da buste e rotazioni, e la scheda dice come ottenerla;
//  - le Sfide nuove (Tag Team, Tutorial, imprese, buste) esistono e il totale rende le 100 raggiungibili.
module.exports = {
    name: 'Sfide: cento Sfide completate danno il Conto alla Rovescia Finale, una copia sola',
    async run(t) {
        const r = await t.evaluate(() => {
            if (!SaveManager.hasSave()) SaveManager.createNew('Prova');
            const save = SaveManager.load();
            save.challenges = {}; save.collection = {}; SaveManager.touch(save);
            const meta = challengesDatabase.find((c) => c.type === 'sfideCompletate');
            const altre = challengesDatabase.filter((c) => c.type !== 'sfideCompletate');
            const completa = (c) => SaveManager.setChallengeProgress(c.id, { count: c.target, completed: true, completedAt: 'x' });
            const copie = () => SaveManager.getOwnedCount(1283);
            // 99 completate: la meta e' a 99/100 e non ha pagato
            altre.slice(0, 99).forEach(completa);
            const v99 = ChallengeTracker.getAllWithProgress().find((c) => c.id === meta.id);
            const a99 = { count: v99.count, completata: v99.completed, copie: copie() };
            // la 100ª completata con un evento vero (non a mano): paga
            const cento = altre[99];
            const prima = SaveManager.getCurrency();
            // completa la numero 100 dal tracker: si porta a target-1 e poi un evento
            SaveManager.setChallengeProgress(cento.id, { count: cento.target - 1, completed: false, completedAt: null });
            const params = Object.assign({}, cento.match);
            ChallengeTracker.recordProgress(cento.type, params);
            const dopo = ChallengeTracker.getAllWithProgress().find((c) => c.id === meta.id);
            const a100 = { count: dopo.count, completata: dopo.completed, copie: copie(), soldi: SaveManager.getCurrency().credits - prima.credits };
            // ripetere non paga di nuovo e non da' una seconda copia
            ChallengeTracker.recordProgress(cento.type, params);
            ChallengeTracker.getAllWithProgress();
            const ripetuta = { copie: copie(), soldi: SaveManager.getCurrency().credits - prima.credits };
            // retroattivo: nuovo salvataggio con 100 gia' completate, mai riconciliato
            const s2 = SaveManager.load(); s2.challenges = {}; s2.collection = {}; SaveManager.touch(s2);
            altre.slice(0, 100).forEach(completa);
            const retro = ChallengeTracker.getAllWithProgress().find((c) => c.id === meta.id);
            const aRetro = { completata: retro.completed, copie: copie() };
            return {
                a99, a100, ripetuta, aRetro,
                limite: cardDatabase.find((c) => c.id === 1283).limit,
                totale: challengesDatabase.length,
                nuove: ['tagWin', 'tagWinSenzaKo', 'tutorialLezione', 'winLowLp', 'winFast', 'packOpened'].map((tipo) => challengesDatabase.filter((c) => c.type === tipo).length),
                tutorialTarget: Math.max(...challengesDatabase.filter((c) => c.type === 'tutorialLezione').map((c) => c.target)),
                lezioniMenu: null
            };
        });
        t.assert(r.a99.count === 99 && !r.a99.completata && r.a99.copie === 0, `A 99 Sfide la meta e' a 99/100 e non ha pagato: ${JSON.stringify(r.a99)}`);
        t.assert(r.a100.completata && r.a100.copie === 1 && r.a100.soldi >= 3000, `A 100 Sfide paga la carta e le valute: ${JSON.stringify(r.a100)}`);
        t.assert(r.ripetuta.copie === 1 && r.ripetuta.soldi === r.a100.soldi, `Una sola copia, e il premio non si ripaga: ${JSON.stringify(r.ripetuta)}`);
        t.assert(r.aRetro.completata && r.aRetro.copie === 1, `Chi aveva gia' 100 Sfide la riceve aprendo la pagina: ${JSON.stringify(r.aRetro)}`);
        t.assert(r.limite === 1, `La carta e' limitata a 1 copia: ${r.limite}`);
        // La carta resta fuori da buste e rotazioni (SECRET_IDS) e la scheda dice come ottenerla (SOURCES): si leggono i sorgenti,
        // perche' questa pagina di prova non carica ne' card-rarity.js ne' card-acquisition.js.
        const fs = require('fs'); const path = require('path');
        const rarita = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'data', 'card-rarity.js'), 'utf8');
        const acquisizione = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'economy', 'card-acquisition.js'), 'utf8');
        t.assert(/SECRET_IDS = new Set\(\[[^\]]*\b1283\b/.test(rarita), 'La carta resta fuori da buste e rotazioni (SECRET_IDS)');
        t.assert(/1283: 'Completa 100 Sfide/.test(acquisizione), 'La scheda dice come si ottiene');
        t.assert(r.totale >= 150, `Il catalogo ha abbastanza Sfide per rendere le 100 raggiungibili (${r.totale})`);
        t.assert(r.nuove.every((n) => n >= 1), `Le famiglie nuove di Sfide esistono: ${JSON.stringify(r.nuove)}`);
        t.assert(r.tutorialTarget === 13, `"Tutte le lezioni" = 13 lezioni (le 12 del duello e le regole del Tag): ${r.tutorialTarget}`);
    }
};
