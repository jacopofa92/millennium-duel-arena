// Le Sfide pagano, e pagano UNA VOLTA SOLA.
// =====================================================================
// Fino a questa modifica ogni Sfida aveva `reward: null`: il giocatore
// completava l'obiettivo, vedeva il banner "Sfida completata!" e non
// riceveva nulla — una promessa non mantenuta, l'unico buco della lista
// dei lavori che un giocatore potesse vedere a occhio nudo.
//
// Il rischio serio di questa feature non è che il premio non arrivi (te
// ne accorgi subito), è che arrivi PIÙ DI UNA VOLTA: le sfide si
// agganciano a eventi che si ripetono per loro natura — ogni vittoria,
// ogni Evocazione — e un premio che si ripaga ad ogni evento successivo
// distruggerebbe l'economia senza che nessuno se ne accorga finché i
// numeri non diventano assurdi. È il caso che questo spec sorveglia con
// più insistenza.
//
// Gira sulla pagina del duello, non su sfide.html, e non è un ripiego:
// è lì che le sfide si completano davvero durante una partita, e quella
// pagina carica tutti e tre i pezzi (rewards, tracker, banner).
module.exports = {
    name: 'Sfide: il premio viene accreditato, e una volta sola',
    async run(t) {
        const esito = await t.evaluate(() => {
            // Salvataggio pulito: una sfida già completata in un altro
            // spec (o in una sessione precedente del browser) falserebbe
            // ogni conteggio qui sotto.
            Object.keys(localStorage)
                .filter((k) => /ygo|duelArena/i.test(k))
                .forEach((k) => localStorage.removeItem(k));

            // Dal 1.4.91 una missione giornaliera generica ("vinci un duello") si completa con la
            // stessa vittoria e paga per conto suo: qui si misurano solo le SFIDE, quindi le
            // missioni si tolgono dal catalogo per la durata del test (le prova un altro spec).
            if (window.missionsDatabase) window.missionsDatabase.length = 0;

            const partenza = SaveManager.getCurrency().credits;

            // 'win-1' si completa con UNA vittoria e paga 100 crediti.
            ChallengeTracker.recordProgress('winDuels', {});
            const dopoPrima = SaveManager.getCurrency().credits;

            // Il banner si legge QUI, subito dopo la vera completazione:
            // è il percorso reale (tracker -> banner), non una chiamata a
            // mano a ChallengeBanner.show. Un primo tentativo mostrava un
            // banner sintetico DOPO le altre prove e leggeva invece
            // quello ancora a schermo della sfida precedente — le sfide
            // si accodano una alla volta, non si sovrappongono.
            const bannerEl = document.getElementById('challengeBanner');
            const vociBanner = bannerEl
                ? [...bannerEl.querySelectorAll('.challenge-banner-reward')].map((n) => n.textContent.trim())
                : [];

            // Altre tre vittorie: la sfida è già completata. win-10 e
            // win-50 sono ancora lontane, quindi nessun altro premio deve
            // entrare in gioco.
            ChallengeTracker.recordProgress('winDuels', {});
            ChallengeTracker.recordProgress('winDuels', {});
            ChallengeTracker.recordProgress('winDuels', {});
            const dopoAltre = SaveManager.getCurrency().credits;

            // Una sfida con valuta RARA, per provare che non si paghi
            // solo in crediti: Slifer vale 500 crediti + 1 Carta del
            // Millennio.
            const millennioPrima = SaveManager.getCurrency().millenniumCards;
            ChallengeTracker.recordProgress('summonMonster', { cardId: 31 });
            const dopoSlifer = SaveManager.getCurrency();

            return {
                pagatoDallaPrima: dopoPrima - partenza,
                pagatoDalleAltreTre: dopoAltre - dopoPrima,
                creditiDaSlifer: dopoSlifer.credits - dopoAltre,
                millennioDaSlifer: dopoSlifer.millenniumCards - millennioPrima,
                vociBanner: vociBanner,
                // Ogni sfida del catalogo deve avere un premio dichiarato:
                // `reward: null` significa "nessun premio", ed è una scelta
                // legittima, ma oggi non dovrebbe valere per nessuna.
                senzaPremio: window.challengesDatabase.filter((c) => !c.reward).map((c) => c.id)
            };
        });

        t.assert(esito.pagatoDallaPrima === 100,
            `Completare "Prima Vittoria" deve accreditare 100 crediti (accreditati: ${esito.pagatoDallaPrima})`);
        t.assert(esito.pagatoDalleAltreTre === 0,
            `Una sfida già completata NON deve pagare di nuovo ad ogni evento successivo ` +
            `(altre 3 vittorie hanno accreditato ${esito.pagatoDalleAltreTre} crediti): è il modo in cui questa ` +
            `feature romperebbe l'economia senza farsi notare`);
        t.assert(esito.creditiDaSlifer === 500 && esito.millennioDaSlifer === 1,
            `Evocare Slifer deve pagare 500 crediti e 1 Carta del Millennio ` +
            `(accreditati: ${esito.creditiDaSlifer} crediti, ${esito.millennioDaSlifer} Millennio)`);
        t.assert(esito.senzaPremio.length === 0,
            `Ogni Sfida del catalogo deve dichiarare un premio — senza: ${JSON.stringify(esito.senzaPremio)}`);

        // Il banner deve DIRE cosa è stato dato: un premio che arriva
        // senza spiegazione è indistinguibile da un numero che cambia da
        // solo nel Profilo.
        t.assert(esito.vociBanner.length === 1 && esito.vociBanner[0].includes('100'),
            `Il banner della sfida appena completata deve mostrarne il premio ` +
            `(rilevato: ${JSON.stringify(esito.vociBanner)})`);
    }
};
