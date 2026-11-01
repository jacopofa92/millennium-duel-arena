// Il catalogo delle Sfide non contiene traguardi impossibili.
// =====================================================================
// Una sfida che punta a un personaggio, una carta, un torneo o un
// Oggetto che non esistono non fallisce mai in modo rumoroso: resta
// semplicemente ferma a 0 per sempre, e il giocatore ci perde tempo
// sopra senza capire perche'. E' il tipo di difetto che un refuso
// introduce in silenzio, quindi vale la pena controllarlo a ogni giro.
//
// Controlla anche che ogni `type` del catalogo sia davvero registrato da
// qualche parte nel motore: un tipo scritto qui ma mai chiamato con
// ChallengeTracker.recordProgress e' esattamente la stessa cosa, una
// sfida che non puo' avanzare.
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'Catalogo Sfide: nessun traguardo impossibile, nessun tipo mai registrato',
    async run(t) {
        const dati = await t.evaluate(() => {
            const db = window.challengesDatabase || [];
            // `characterDatabase` e `cardDatabase` sono dichiarati con
            // `const` a livello di script: sono global veri ma NON
            // proprieta' di window, quindi vanno nominati direttamente.
            const pg = typeof characterDatabase !== 'undefined' ? characterDatabase : [];
            const carte = typeof cardDatabase !== 'undefined' ? cardDatabase : [];
            return {
                sfide: db.map((d) => ({ id: d.id, type: d.type, match: d.match, target: d.target, reward: d.reward, label: d.label })),
                personaggi: pg.map((c) => c.id),
                carte: carte.map((c) => c.id),
                tornei: Object.keys((window.Rewards && Rewards.TOURNAMENT_COMPLETION) || {}),
                oggetti: Object.keys((window.Rewards && Rewards.MILLENNIUM_ITEMS) || {})
            };
        });

        t.assert(dati.sfide.length >= 60,
            `Il catalogo deve contenere molte sfide (rilevate ${dati.sfide.length})`);
        t.assert(dati.personaggi.length > 0 && dati.carte.length > 0,
            'La pagina del duello deve avere caricato personaggi e carte per poter validare il catalogo');

        // --- Nessun id ripetuto ---------------------------------------
        // Due sfide con lo stesso id condividerebbero il progresso, quindi
        // completarne una completerebbe anche l'altra.
        const visti = {};
        const ripetuti = [];
        dati.sfide.forEach((s) => {
            if (visti[s.id]) ripetuti.push(s.id);
            visti[s.id] = true;
        });
        t.assert(ripetuti.length === 0, `Id di sfida ripetuti: ${ripetuti.join(', ')}`);

        // --- Ogni bersaglio deve esistere -----------------------------
        const elenco = (v) => (Array.isArray(v) ? v : [v]);
        const guasti = [];
        dati.sfide.forEach((s) => {
            const m = s.match || {};
            if (m.characterId !== undefined) {
                elenco(m.characterId).forEach((id) => {
                    if (dati.personaggi.indexOf(id) === -1) guasti.push(`${s.id}: personaggio inesistente "${id}"`);
                });
            }
            if (m.cardId !== undefined) {
                elenco(m.cardId).forEach((id) => {
                    if (dati.carte.indexOf(id) === -1) guasti.push(`${s.id}: carta inesistente ${id}`);
                });
            }
            if (m.tournamentId !== undefined) {
                elenco(m.tournamentId).forEach((id) => {
                    if (dati.tornei.indexOf(id) === -1) guasti.push(`${s.id}: torneo inesistente "${id}"`);
                });
            }
            if (m.itemId !== undefined) {
                elenco(m.itemId).forEach((id) => {
                    if (dati.oggetti.indexOf(id) === -1) guasti.push(`${s.id}: Oggetto del Millennio inesistente "${id}"`);
                });
            }
            if (!(s.target > 0)) guasti.push(`${s.id}: target non valido (${s.target})`);
        });
        t.assert(guasti.length === 0, `Sfide impossibili da completare:\n  ${guasti.join('\n  ')}`);

        // --- Ogni tipo dev'essere davvero registrato dal motore --------
        // Si legge il sorgente invece di fidarsi di un elenco scritto a
        // mano: un tipo nuovo aggiunto al catalogo e dimenticato nel
        // motore viene beccato qui.
        // Si scandaglia TUTTO js/, non un elenco di quattro file scritto a
        // mano: quell'elenco aveva gia' mancato un punto di registrazione
        // legittimo (il tipo 'storyProgress', che parte da
        // js/story/story-progress.js) e bocciato il catalogo per un
        // aggancio che invece c'era. Un guardrail che legge i sorgenti
        // deve seguire il codice quando il codice si sposta, altrimenti
        // la sua prossima bocciatura e' un falso allarme che costa piu'
        // tempo del difetto che dovrebbe trovare.
        const radice = path.join(__dirname, '..', '..');
        const sorgenti = (function raccogli(dir) {
            return fs.readdirSync(dir, { withFileTypes: true }).reduce((acc, voce) => {
                const completo = path.join(dir, voce.name);
                if (voce.isDirectory()) return acc.concat(raccogli(completo));
                return voce.name.endsWith('.js') ? acc.concat(fs.readFileSync(completo, 'utf8')) : acc;
            }, []);
        }(path.join(radice, 'js'))).join('\n');
        const tipiRegistrati = new Set();
        const re = /recordProgress\(\s*'([^']+)'/g;
        let m2;
        while ((m2 = re.exec(sorgenti))) tipiRegistrati.add(m2[1]);
        const tipiCatalogo = [...new Set(dati.sfide.map((s) => s.type))];
        // 'sfideCompletate' non si registra con un evento: il suo progresso E' il numero di Sfide completate (riconciliaMeta in
        // challenge-tracker.js), controllato dal suo spec (sfide-cento-sfide).
        const orfani = tipiCatalogo.filter((tipo) => tipo !== 'sfideCompletate' && !tipiRegistrati.has(tipo));
        t.assert(orfani.length === 0,
            `Tipi di sfida che il motore non registra mai (resterebbero fermi a 0): ${orfani.join(', ')}`);

        // --- Le Sfide delle storie chiedono tappe che esistono --------
        // Il `target` di una sfida 'storyProgress' è un numero di tappe
        // scritto a mano, e una campagna cambia forma nel tempo (un'area
        // nuova, un capitolo riscritto). Una sfida che chiede più tappe di
        // quante la campagna ne abbia resta ferma a un passo dalla fine per
        // sempre, senza che nulla lo segnali: è successo davvero, con
        // "Completa Memorie Proibite" a 41 su 40 e il Regno delle Ombre a
        // 26 quando si potevano contare solo le sue 5 aree.
        //
        // Il conteggio è lo STESSO di js/story/story-progress.js: dentro
        // un'AREA conta ogni tappa, un TORNEO conta una volta sola. Il
        // catalogo si legge dal file (la pagina del duello non lo carica).
        const vm = require('vm');
        const sandbox = {};
        sandbox.window = sandbox;
        vm.createContext(sandbox);
        vm.runInContext(fs.readFileSync(path.join(radice, 'js', 'data', 'story-campaigns.js'), 'utf8')
            .replace(/^const storyCampaignsDatabase/m, 'var storyCampaignsDatabase'), sandbox);
        const tappeContabili = {};
        (sandbox.storyCampaignsDatabase || []).forEach((c) => {
            tappeContabili[c.id] = (c.capitoli || []).reduce((s, cap) => s + (cap.tappe || [])
                .reduce((s2, tp) => s2 + (tp.kind === 'area' ? (tp.tappe || []).length : 1), 0), 0);
        });
        const storieImpossibili = dati.sfide
            .filter((s) => s.type === 'storyProgress')
            .filter((s) => !(s.target <= (tappeContabili[(s.match || {}).campaignId] || 0)))
            .map((s) => `${s.id}: chiede ${s.target} tappe, la campagna "${(s.match || {}).campaignId}" ne ha ${tappeContabili[(s.match || {}).campaignId] || 0}`);
        t.assert(storieImpossibili.length === 0,
            `Sfide delle storie impossibili da completare:\n  ${storieImpossibili.join('\n  ')}`);

        // --- I premi restano dentro la scala dichiarata ----------------
        // La regola sta in testa a challenges-db.js: una Sfida vale piu'
        // di un duello (60-90 crediti) e meno di un torneo (1200).
        //
        // Il tetto si applica solo ai tipi in cui il progresso si macina
        // giocando (un duello, un'Evocazione, un'attivazione): li' il
        // `target` dice davvero quanto e' lunga. Per gli altri no — un
        // Oggetto del Millennio esce al 5% battendo una persona sola in
        // un torneo preciso, quindi "target: 3" e' una vita, non tre
        // partite. Un primo giro di questo controllo usava `target` per
        // tutti e bocciava proprio quella sfida: il numero era giusto,
        // era il metro sbagliato.
        const A_CONSUMO = ['winDuels', 'summonMonster', 'activateCard', 'defeatCharacter', 'perfectWin'];
        const fuoriScala = dati.sfide.filter((s) => A_CONSUMO.indexOf(s.type) !== -1
            && s.reward && s.reward.credits > 1200 && s.target < 100);
        t.assert(fuoriScala.length === 0,
            `Sfide che pagano piu' di un torneo senza chiedere abbastanza in cambio: ${fuoriScala.map((s) => s.id).join(', ')}`);

        // --- I nuovi tipi avanzano davvero ----------------------------
        // Non basta che il catalogo sia coerente: si prova che una
        // registrazione faccia salire il contatore e che il match a
        // ELENCO (quello dei tre Dei Egizi) accetti ognuno dei tre.
        const avanzamento = await t.evaluate(() => {
            const leggi = (id) => SaveManager.getChallengeProgress(id).count || 0;
            const prima = {
                perfetta: leggi('perfect-win-1'),
                exodia: leggi('win-exodia-1'),
                dei: leggi('summon-three-gods')
            };
            ChallengeTracker.recordProgress('perfectWin', {});
            ChallengeTracker.recordProgress('winInstantly', { kind: 'exodia' });
            // Tre carte diverse, tutte valide per la stessa sfida.
            ChallengeTracker.recordProgress('summonMonster', { cardId: 31 });
            ChallengeTracker.recordProgress('summonMonster', { cardId: 30 });
            ChallengeTracker.recordProgress('summonMonster', { cardId: 472 });
            return {
                perfetta: leggi('perfect-win-1') - prima.perfetta,
                exodia: leggi('win-exodia-1') - prima.exodia,
                dei: leggi('summon-three-gods') - prima.dei,
                // Una sfida di tipo diverso non dev'essere toccata da
                // questi eventi: il matching e' per type, non "tutto".
                estraneo: leggi('win-1')
            };
        });
        t.assert(avanzamento.perfetta === 1, `'perfectWin' deve far avanzare la sua sfida (rilevato +${avanzamento.perfetta})`);
        t.assert(avanzamento.exodia === 1, `'winInstantly' con kind exodia deve far avanzare la sua sfida (rilevato +${avanzamento.exodia})`);
        t.assert(avanzamento.dei === 3,
            `Il match a elenco deve accettare tutti e tre i Dei Egizi (rilevato +${avanzamento.dei} invece di +3)`);
        t.assert(avanzamento.estraneo === 0,
            'Una sfida di tipo diverso non dev\'essere toccata: il matching e\' per tipo, non indiscriminato');
    }
};
