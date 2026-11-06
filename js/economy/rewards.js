/**
 * js/economy/rewards.js — TUTTI I PREMI DEL GIOCO, IN UN POSTO SOLO
 * =====================================================================
 * Ogni cosa che il giocatore guadagna — duelli liberi, tornei, bonus,
 * drop rari — è decisa qui. Nessuna pagina assegna valute per conto
 * proprio: chiamano `Rewards.forDuel(...)` / `Rewards.forTournament(...)`,
 * ricevono l'elenco di quello che è stato assegnato e lo mostrano.
 *
 * REGOLA DI PROGETTO, richiesta esplicita dell'utente: «specifica nei
 * vari punti eventuali regole, drop, x2, prima vittoria, se no l'utente
 * non capisce come mai riceve cose a caso».
 * Per questo ogni singola voce di premio porta con sé la PROPRIA
 * spiegazione (`rule`), scritta per il giocatore e non per chi programma.
 * Il riepilogo di fine duello non mostra "+150 crediti" e basta: mostra
 * «Prima vittoria di oggi · +150» e, per un drop, «Fortuna: 6% a
 * vittoria». Se una voce non sa spiegarsi da sola, non deve esistere.
 *
 * L'EQUILIBRIO in due righe: i crediti si guadagnano ovunque e comprano
 * le carte del giorno e le buste; le altre tre valute arrivano quasi solo
 * dai tornei e ognuna apre una porta che i crediti non aprono (vedi
 * makeDefaultCurrency in js/save-manager.js). Cinque freni tengono il
 * ritmo: il bonus giornaliero premia la costanza invece della maratona,
 * i rendimenti calano dopo la quinta vittoria del giorno, la difficolta'
 * determina davvero il ritmo del farming, i mazzi si comprano una
 * volta sola e la rotazione del Negozio mette comunque un tetto a quanto
 * si può comprare in un giorno.
 */
(function () {
    'use strict';

    // ================================================================
    // TABELLE — i numeri dell'economia, tutti qui e da nessun'altra parte
    // ================================================================

    /**
     * Crediti per un duello VINTO, per difficoltà dell'avversario.
     * "Facile" (deck avversario indebolito, richiesta esplicita
     * dell'utente — vedi i mazzi `easy` in js/data/character-decks.js)
     * paga meno di Medio: senza questa riga un duello Facile non
     * comparirebbe affatto in questa tabella e WIN_CREDITS[o.difficulty]
     * varrebbe `undefined`, cioè ZERO crediti per aver vinto — bug reale
     * preso controllando ogni punto che legge `opts.difficulty`, non
     * giocando un duello (il sintomo sarebbe stato silenzioso: nessun
     * errore, solo un premio di vittoria mancante).
     */
    const WIN_CREDITS = { Facile: 30, Medio: 50, Difficile: 80 };
    /** Crediti per un duello PERSO: pochi, ma mai zero — un duello giocato non è tempo buttato. */
    const LOSS_CREDITS = 15;
    /** Bonus una tantum alla prima vittoria della giornata: premia il tornare ogni giorno, non il giocare venti duelli di fila. */
    const FIRST_WIN_OF_DAY_BONUS = 100;
    /** Dalla N-esima vittoria del giorno in poi i crediti valgono la metà (freno al grind). */
    const DIMINISHING_AFTER_WINS = 5;
    const DIMINISHING_FACTOR = 0.5;

    /**
     * Drop rari dei duelli liberi: valute che altrimenti verrebbero solo
     * dai tornei. Probabilità basse di proposito — devono essere una bella
     * sorpresa, non una fonte di reddito: a questi tassi servono in media
     * ~17 vittorie per una Stella e ~125 per una Carta del Millennio.
     * Si tirano SOLO su una vittoria, e al massimo uno per duello (vedi
     * rollDrop): due premi rari insieme sembrerebbero un errore.
     */
    const STAR_DROP_CHANCE = { Facile: 0.02, Medio: 0.05, Difficile: 0.09 };
    const STAR_MILESTONE_EVERY = 10;
    const STAR_MILESTONE_REWARD = { Facile: 1, Medio: 2, Difficile: 3 };
    const DROPS = [
        { currency: 'starChips', amount: 1, chanceByDifficulty: STAR_DROP_CHANCE, icon: '⭐', nome: 'Stella dell\'Esagono' },
        { currency: 'locatorCards', amount: 1, chance: 0.03, icon: '🃏', nome: 'Carta Locazione' },
        { currency: 'millenniumCards', amount: 1, chance: 0.008, icon: '🔱', nome: 'Carta del Millennio' }
    ];

    /** Crediti per ogni duello vinto DENTRO un torneo: più alti di un duello libero, perché lì si rischia l'eliminazione. */
    const TOURNAMENT_DUEL_CREDITS = 120;

    /**
     * Premio per aver COMPLETATO un torneo. Ogni torneo versa soprattutto
     * la valuta che apre la "sua" porta del Negozio, così rigiocarne uno
     * invece di un altro ha davvero un senso:
     *   Regno dei Duellanti -> Stelle    -> i mazzi
     *   Battle City         -> Locazione -> la busta Leggendaria
     *   Torneo Kaiba        -> Millennio -> la carta rara del giorno a colpo sicuro
     */
    const TOURNAMENT_COMPLETION = {
        // starChips allineate a PREZZI_MAZZI.starter.stelleBase
        // (js/economy/shop-catalog.js): una vittoria al Regno dei
        // Duellanti deve bastare a comprare il PRIMO Starter Deck, come
        // sempre — un valore scollegato da quel prezzo si disallinea alla
        // prima volta che i mazzi vengono ritoccati (successo esattamente
        // una volta, corretto qui).
        duelistKingdom: {
            credits: { Facile: 650, Medio: 825, Difficile: 1000 },
            starChips: { Facile: 14, Medio: 19, Difficile: 24 }
        },
        battleCity: {
            credits: { Facile: 650, Medio: 825, Difficile: 1000 },
            starChips: { Facile: 3, Medio: 5, Difficile: 8 },
            locatorCards: { Facile: 1, Medio: 2, Difficile: 3 }
        },
        kaibaTournament: {
            credits: { Facile: 650, Medio: 825, Difficile: 1000 },
            starChips: { Facile: 3, Medio: 5, Difficile: 8 },
            millenniumCards: { Facile: 1, Medio: 1, Difficile: 2 }
        }
    };

    /**
     * Bonus UNA TANTUM alla prima vittoria assoluta del torneo. Non e' un
     * moltiplicatore: raddoppiare il premio Difficile rendeva proprio la
     * modalita' piu' redditizia una scorciatoia enorme. Il bonus fisso
     * conserva il momento speciale e garantisce che il primo Regno a
     * Facile dia 18 Stelle, cioe' il prezzo del primo Starter acquistabile.
     */
    const FIRST_COMPLETION_BONUS = {
        duelistKingdom: { credits: 500, starChips: 4 },
        battleCity: { credits: 500, locatorCards: 1 },
        kaibaTournament: { credits: 500, millenniumCards: 1 }
    };

    /**
     * Le valute che un torneo NON paga, e che quindi non si possono
     * vincere giocandolo. Battle City e Kaiba pagano anche poche Stelle:
     * la loro identita' resta nella valuta primaria, ma non sono piu'
     * percorsi morti per chi sta risparmiando per un mazzo.
     *
     * Vive in una tabella a parte invece che come uno zero dentro
     * TOURNAMENT_COMPLETION perche' "questo torneo non paga in Stelle" e'
     * una REGOLA, non un importo — e una regola va detta al giocatore.
     * forTournament la trasforma in una riga di spiegazione, cosi' chi
     * ricorda premi diversi da prima capisce subito cosa e' cambiato
     * invece di pensare a un premio perduto (stesso principio del resto
     * del file: se una voce non sa spiegarsi da sola, non deve esistere).
     *
     * Le due tabelle non devono mai sovrapporsi — una valuta elencata qui
     * e insieme pagata li' sopra sarebbe una contraddizione silenziosa.
     * Ci pensa tests/specs/oggetti-millennio.spec.js.
     */
    const TOURNAMENT_EXCLUDED = {
        duelistKingdom: ['locatorCards', 'millenniumCards'],
        battleCity: ['millenniumCards'],
        kaibaTournament: ['locatorCards']
    };

    /**
     * GLI OGGETTI DEL MILLENNIO — i soli premi del gioco che non sono una
     * valuta.
     *
     * Ne esiste una copia sola ciascuno: la domanda non e' "quanti ne ho"
     * ma "ce l'ho", quindi non passano da addCurrency e non si accumulano
     * (vedi SaveManager.addMillenniumItem). Si vincono solo battendo IL
     * personaggio che lo porta, e solo dentro i tornei in cui quel
     * personaggio ha senso trovarlo — al 5%, cioe' abbastanza di rado da
     * restare un colpo di fortuna raccontabile.
     *
     * `tornei` e' la parte che fa il lavoro: l'Occhio si prende da Pegasus
     * nel Regno dei Duellanti o al Torneo Kaiba, mai a Battle City, dove
     * Pegasus non c'entra nulla.
     */
    const MILLENNIUM_ITEMS = {
        millenniumEye: {
            icon: '👁️', nome: 'Occhio del Millennio',
            daChi: 'pegasus', nomeChi: 'Pegasus',
            tornei: ['duelistKingdom', 'kaibaTournament']
        },
        millenniumRod: {
            icon: '🪄', nome: 'Bastone del Millennio',
            daChi: 'marik', nomeChi: 'Marik',
            tornei: ['battleCity', 'kaibaTournament']
        },
        millenniumNecklace: {
            icon: '📿', nome: 'Collana del Millennio',
            daChi: 'ishizu', nomeChi: 'Ishizu',
            tornei: ['battleCity', 'kaibaTournament']
        }
    };
    /** Probabilita' di ogni Oggetto del Millennio, a vittoria contro il suo portatore. */
    const MILLENNIUM_ITEM_CHANCE = 0.05;
    // Nota sui numeri: in ogni riga la valuta "di quel torneo" deve
    // risultare anche la PIÙ ABBONDANTE, non solo quella tematica — un
    // primo giro dava al Torneo Kaiba 4 Stelle contro 3 Carte del
    // Millennio, e a colpo d'occhio sembrava un torneo che paga in Stelle
    // come il Regno. L'identità di un premio si legge dai numeri, non
    // dalle intenzioni.
    const CURRENCY_META = {
        credits: { icon: '💰', nome: 'Crediti' },
        starChips: { icon: '⭐', nome: 'Stelle dell\'Esagono' },
        locatorCards: { icon: '🃏', nome: 'Carte Locazione' },
        millenniumCards: { icon: '🔱', nome: 'Carte del Millennio' }
    };

    // ================================================================
    // Assegnazione
    // ================================================================

    function dayKey() {
        return (window.ServerDate && ServerDate.dayKey()) || new Date().toISOString().slice(0, 10);
    }

    /** Una voce di premio: quanto, e SOPRATTUTTO perché. `rule` è il testo mostrato al giocatore. */
    function voce(currency, amount, rule) {
        const meta = CURRENCY_META[currency] || { icon: '•', nome: currency };
        return { currency: currency, amount: amount, icon: meta.icon, nome: meta.nome, rule: rule };
    }

    /**
     * Una voce SENZA importo: spiega perché un premio che il giocatore si
     * aspettava NON è arrivato. Stesso principio delle voci vere ("ogni
     * premio dice da quale regola nasce"), applicato al caso opposto — un
     * elenco premi che si limita a restare vuoto sembra un difetto del
     * gioco, non una regola. La schermata di fine duello
     * (js/ui/duel-cinematics.js) la disegna come riga di sola spiegazione.
     */
    function nota(icon, rule) {
        return { nota: true, icon: icon, rule: rule };
    }

    /** Tira i drop rari: al massimo uno per duello, il primo che esce nell'ordine della tabella. */
    function rollDrop(difficulty) {
        // UN SOLO tiro con soglie cumulative, non un tiro per carta in fila:
        // con la sequenza (Stella, poi Locazione, poi Millennio) ogni tiro
        // successivo vedeva solo cio' che la Stella aveva lasciato, quindi
        // piu' la difficolta' era alta (Stella 9%) MENO uscivano Locazione e
        // Millennio — l'opposto di quanto ci si aspetta. Cosi' ogni premio
        // esce esattamente con la probabilita' scritta in tabella.
        const r = Math.random();
        let soglia = 0;
        for (let i = 0; i < DROPS.length; i++) {
            const chance = DROPS[i].chanceByDifficulty
                ? (DROPS[i].chanceByDifficulty[difficulty] || 0)
                : DROPS[i].chance;
            soglia += chance;
            if (r < soglia) return Object.assign({}, DROPS[i], { chance: chance });
        }
        return null;
    }

    /**
     * L'Oggetto del Millennio eventualmente in palio battendo
     * `characterId` dentro `tournamentId`, oppure null. Non tira ancora i
     * dadi: separare "cosa sarebbe in palio" da "e' uscito" permette di
     * saltare il sorteggio quando non c'e' niente da vincere, ed e' anche
     * l'unica forma verificabile senza dipendere dal caso.
     */
    function millenniumItemInPalio(tournamentId, characterId) {
        if (!tournamentId || !characterId) return null;
        const id = Object.keys(MILLENNIUM_ITEMS).find((k) => {
            const item = MILLENNIUM_ITEMS[k];
            return item.daChi === characterId && item.tornei.indexOf(tournamentId) !== -1;
        });
        if (!id) return null;
        // Gia' vinto: non si ritira. Un secondo Occhio del Millennio non
        // vorrebbe dire nulla, e toglierebbe valore al primo.
        if (window.SaveManager && SaveManager.ownsMillenniumItem(id)) return null;
        return Object.assign({ id: id }, MILLENNIUM_ITEMS[id]);
    }

    /**
     * Premi di fine duello. Torna SEMPRE un elenco di voci già assegnate
     * al salvataggio, ognuna con la propria spiegazione — chi chiama deve
     * solo mostrarle.
     *
     * `opts.won`        vero se il giocatore ha vinto (un pareggio non è una vittoria)
     * `opts.difficulty` 'Facile' | 'Medio' | 'Difficile' — senza, nessun credito (Duello Demo, Multiplayer)
     * `opts.inTournament` vero se il duello faceva parte di un torneo
     * `opts.tournamentId` quale torneo ('duelistKingdom'|'battleCity'|
     *   'kaibaTournament'), e `opts.opponentId` chi si è appena battuto:
     *   servono SOLO agli Oggetti del Millennio, che dipendono da
     *   entrambi. Senza, semplicemente non escono.
     * `opts.abbandono` vero se il giocatore si è ritirato invece di
     *   giocare fino alla fine: niente premio di partecipazione (vedi sotto)
     */
    function forDuel(opts) {
        const o = opts || {};
        const rewards = [];
        if (!window.SaveManager) return rewards;

        const giorno = dayKey();
        const prima = SaveManager.getDailyEconomy(giorno);

        if (!o.won) {
            // Anche perdendo si porta a casa qualcosa: serve a non far
            // sentire "sprecato" un duello lungo, ma è poco abbastanza da
            // non rendere conveniente perdere di proposito.
            // Chi ABBANDONA invece non prende nulla: il premio di
            // partecipazione paga l'aver giocato il duello fino in fondo,
            // e senza questa distinzione il modo più veloce di guadagnare
            // crediti sarebbe aprire un duello e arrendersi subito, in
            // pochi secondi e senza giocare una sola carta.
            if (o.difficulty && !o.abbandono) {
                SaveManager.addCurrency('credits', LOSS_CREDITS);
                rewards.push(voce('credits', LOSS_CREDITS, 'Premio di partecipazione (anche perdendo)'));
            } else if (o.difficulty && o.abbandono) {
                rewards.push(nota('🏳️', 'Duello abbandonato: niente premio di partecipazione'));
            }
            return rewards;
        }

        const conteggio = SaveManager.recordDailyWin(giorno);
        const vittoriaNumero = conteggio.wins;

        if (o.inTournament) {
            SaveManager.addCurrency('credits', TOURNAMENT_DUEL_CREDITS);
            rewards.push(voce('credits', TOURNAMENT_DUEL_CREDITS, 'Duello di torneo vinto'));
        } else if (o.difficulty) {
            const base = WIN_CREDITS[o.difficulty] || 0;
            if (base > 0) {
                // I rendimenti calano DOPO la soglia: la quinta vittoria di
                // giornata vale ancora pieno, la sesta metà.
                const ridotto = vittoriaNumero > DIMINISHING_AFTER_WINS;
                const importo = ridotto ? Math.round(base * DIMINISHING_FACTOR) : base;
                SaveManager.addCurrency('credits', importo);
                rewards.push(voce('credits', importo, ridotto
                    ? `Vittoria n.${vittoriaNumero} di oggi — oltre la ${DIMINISHING_AFTER_WINS}ª i crediti valgono la metà`
                    // Il nome MOSTRATO del livello, non quello interno:
                    // prima qui c'era un "Difficile altrimenti Normale", nato
                    // quando Facile non esisteva, e una vittoria a Facile
                    // veniva spiegata come "Normale" — la regola raccontata
                    // non era quella applicata (40 crediti, non 60).
                    : `Vittoria (${{ Facile: 'Facile', Medio: 'Normale', Difficile: 'Difficile' }[o.difficulty] || 'Normale'})`));
            }
        }

        // Il bonus giornaliero vale per QUALUNQUE prima vittoria del
        // giorno, torneo compreso: premia l'esserci, non la modalità.
        if (vittoriaNumero === 1) {
            SaveManager.addCurrency('credits', FIRST_WIN_OF_DAY_BONUS);
            rewards.push(voce('credits', FIRST_WIN_OF_DAY_BONUS, 'Prima vittoria di oggi'));
        }

        // Drop raro: solo fuori dai tornei, che hanno già i propri premi
        // grossi garantiti e non devono anche vincere alla lotteria.
        if (!o.inTournament && o.difficulty) {
            const traguardo = SaveManager.recordFreeWinMilestone
                ? SaveManager.recordFreeWinMilestone(o.difficulty, STAR_MILESTONE_EVERY)
                : null;
            if (traguardo && traguardo.completed > 0) {
                const stelle = (STAR_MILESTONE_REWARD[traguardo.difficulty] || 0) * traguardo.completed;
                if (stelle > 0) {
                    SaveManager.addCurrency('starChips', stelle);
                    rewards.push(voce('starChips', stelle,
                        `${STAR_MILESTONE_EVERY} vittorie fuori dai tornei a difficolta' ${traguardo.difficulty === 'Medio' ? 'Normale' : traguardo.difficulty}`));
                }
            }
            const drop = rollDrop(o.difficulty);
            if (drop) {
                SaveManager.addCurrency(drop.currency, drop.amount);
                rewards.push(voce(drop.currency, drop.amount,
                    `Ritrovamento fortunato — ${Math.round(drop.chance * 1000) / 10}% a ogni vittoria`));
            }
        }

        // Oggetto del Millennio: l'esatto contrario del drop qui sopra —
        // SOLO dentro un torneo, e solo battendo chi lo porta. Non e' una
        // lotteria che gira sempre: e' il modo in cui quel personaggio,
        // in quel torneo, puo' cedere la sua cosa piu' preziosa.
        if (o.inTournament) {
            const item = millenniumItemInPalio(o.tournamentId, o.opponentId);
            if (item && Math.random() < MILLENNIUM_ITEM_CHANCE) {
                const registrato = SaveManager.addMillenniumItem(item.id, {
                    fromCharacter: o.opponentId,
                    tournamentId: o.tournamentId
                });
                if (registrato) {
                    rewards.push({
                        currency: null, item: item.id, amount: 1,
                        icon: item.icon, nome: item.nome,
                        rule: `Strappato a ${item.nomeChi} — ${Math.round(MILLENNIUM_ITEM_CHANCE * 100)}% battendolo in torneo`
                    });
                    if (window.ChallengeTracker) {
                        ChallengeTracker.recordProgress('winMillenniumItem', { itemId: item.id });
                    }
                }
            }
        }
        // Le acquisizioni speciali (Exodia, Carte Dio e traguardi composti)
        // ricevono la stessa vittoria già validata qui. L'autowin admin usa
        // intenzionalmente questo percorso: per decisione di progetto conta.
        if (window.CardAcquisition) {
            rewards.push(...CardAcquisition.onDuelWin(o));
        }
        return rewards;
    }

    /**
     * Premi per un torneo COMPLETATO (vinto fino in fondo). Il livello
     * controlla ogni importo; `firstTime` aggiunge il bonus fisso del
     * torneo, senza moltiplicare il premio piu' ricco del Difficile.
     */
    function forTournament(tournamentId, firstTime, difficulty) {
        const tabella = TOURNAMENT_COMPLETION[tournamentId];
        const rewards = [];
        if (!tabella || !window.SaveManager) return rewards;
        const livello = difficulty === 'Facile' || difficulty === 'Difficile' ? difficulty : 'Medio';
        Object.keys(tabella).forEach((currency) => {
            const valori = tabella[currency];
            const importo = typeof valori === 'number' ? valori : (valori[livello] || 0);
            if (importo <= 0) return;
            SaveManager.addCurrency(currency, importo);
            rewards.push(voce(currency, importo, `Torneo vinto a difficolta' ${livello === 'Medio' ? 'Normale' : livello}`));
        });
        if (firstTime) {
            const bonus = FIRST_COMPLETION_BONUS[tournamentId] || {};
            Object.keys(bonus).forEach((currency) => {
                const importo = bonus[currency];
                if (importo <= 0) return;
                SaveManager.addCurrency(currency, importo);
                rewards.push(voce(currency, importo, 'Prima vittoria assoluta di questo torneo'));
            });
        }
        // Poi si DICE cosa questo torneo non paga. Senza questa riga il
        // giocatore vedrebbe solo un premio piu' magro di quanto ricorda,
        // e non saprebbe che e' una regola e non una perdita.
        (TOURNAMENT_EXCLUDED[tournamentId] || []).forEach((currency) => {
            const meta = CURRENCY_META[currency];
            if (!meta) return;
            rewards.push(nota(meta.icon, `${meta.nome}: non si vincono in questo torneo`));
        });
        // Sfide di tipo 'completeTournament': questa funzione gira una
        // volta sola per ogni torneo portato a termine, ed e' l'unico
        // punto attraversato da tutte e tre le pagine torneo.
        if (window.ChallengeTracker) {
            ChallengeTracker.recordProgress('completeTournament', { tournamentId: tournamentId, difficulty: difficulty });
        }
        if (window.CardAcquisition) rewards.push(...CardAcquisition.onTournamentWin(tournamentId, difficulty));
        // A Difficile ogni torneo completato regala UNA illustrazione alternativa a caso dal suo bacino
        // (js/data/artwork-alternativi.js): ad ogni giro, finche' il bacino non e' finito.
        if (difficulty === 'Difficile' && window.ArtworkAlternativi) {
            rewards.push(...ArtworkAlternativi.premiaDaFonte('torneo:' + tournamentId, `Torneo vinto a difficoltà Difficile`));
        }
        return rewards;
    }

    /**
     * Premio per una campagna della Modalità Storia portata a termine
     * (js/data/story-campaigns.js, campo `premioFinale`).
     *
     * Chi paga UNA VOLTA SOLA non è questa funzione ma chi la chiama
     * (StoryProgress.riscuotiPremioFinale, che segna la campagna come
     * già premiata): qui si accredita e basta, esattamente come
     * forTournament/forChallenge. È la stessa divisione di sempre —
     * questo file sa quanto vale una cosa, non quante volte spetta.
     */
    /**
     * `livello` (facoltativo): il livello di difficoltà a cui la storia è
     * stata finita, `{ nome, moltiplicatorePremio }` (vedi LIVELLI in
     * js/story/story-progress.js). Il premio del catalogo vale a Facile;
     * a Normale e Difficile si moltiplica, e la spiegazione lo DICE — un
     * premio più grosso senza il perché sembrerebbe un errore di conto.
     */
    function forStoryCampaign(campagna, livello) {
        const rewards = [];
        if (!campagna || !campagna.premioFinale || !window.SaveManager) return rewards;
        const fattore = (livello && livello.moltiplicatorePremio) || 1;
        const spiegazione = livello
            ? `Campagna completata a ${livello.nome} — ${campagna.nome}`
                + (fattore !== 1 ? ` (premio ×${String(fattore).replace('.', ',')})` : '')
            : `Campagna completata — ${campagna.nome}`;
        Object.keys(campagna.premioFinale).forEach((currency) => {
            const importo = Math.round((campagna.premioFinale[currency] || 0) * fattore);
            if (!importo || importo <= 0) return;
            SaveManager.addCurrency(currency, importo);
            rewards.push(voce(currency, importo, spiegazione));
        });
        return rewards;
    }

    /** Stelle dell'Esagono per ogni ARCO NARRATIVO della Storia anime completato la prima volta (a qualunque difficolta'). */
    const STELLE_PER_ARCO_STORIA = 3;
    /** Crediti per ogni arco, insieme alle Stelle (richiesta dell'utente). */
    const CREDITI_PER_ARCO_STORIA = 350;

    /**
     * Premio per un ARCO NARRATIVO (un capitolo/area della Storia anime) completato la prima volta, a qualunque livello.
     * Come forStoryCampaign: accredita e torna le voci con la spiegazione; "una volta sola per arco" lo garantisce chi
     * chiama (StoryProgress.pagaStelleArco, che tiene il registro degli archi gia' pagati).
     */
    function forStoryArc(campagna, capitolo) {
        const rewards = [];
        if (!window.SaveManager) return rewards;
        const spiegazione = `Arco narrativo completato — ${capitolo && capitolo.nome ? capitolo.nome : (campagna && campagna.nome) || 'Storia'}`;
        SaveManager.addCurrency('starChips', STELLE_PER_ARCO_STORIA);
        rewards.push(voce('starChips', STELLE_PER_ARCO_STORIA, spiegazione));
        SaveManager.addCurrency('credits', CREDITI_PER_ARCO_STORIA);
        rewards.push(voce('credits', CREDITI_PER_ARCO_STORIA, spiegazione));
        return rewards;
    }

    /** Premio del Raid cooperativo (Multiplayer, "Assalto al Boss"), per chi ha il Boss a zero con la sua barra (richiesta dell'utente). */
    const CREDITI_RAID = 500;
    const STELLE_RAID = 2;
    /** Quante volte al giorno il Raid vinto paga (la giornata e' quella del server, come le altre regole giornaliere). */
    const RAID_AL_GIORNO = 2;

    /**
     * Premio per il Raid VINTO: sostituisce quello di un Duello Libero normale (che e' pensato per un duello 1 contro 1 e
     * non e' il motivo per cui si fa un Raid). Paga chi e' ancora in piedi quando la barra comune arriva a zero; chi era
     * gia' a terra ha perso il suo duello e non prende nulla (come un duello perso). Un abbandono non paga: vale come ovunque.
     * Accredita e torna le voci, ciascuna con la sua spiegazione.
     */
    function forRaid(opts) {
        const rewards = [];
        if (!window.SaveManager) return rewards;
        const o = opts || {};
        // Al giorno se ne riscuote un numero limitato (richiesta dell'utente: 2): oltre, la vittoria conta per record e Sfide ma
        // non paga, e la schermata finale lo dice invece di restare vuota.
        const giorno = dayKey();
        const riscosse = Number(SaveManager.getDailyEconomy(giorno).raidWins) || 0;
        if (riscosse >= RAID_AL_GIORNO) {
            rewards.push(nota('🐉', `Premio del Raid già riscosso ${RAID_AL_GIORNO} volte oggi: torna domani`));
            return rewards;
        }
        SaveManager.recordDailyRaidWin(giorno);
        const spiegazione = `Raid cooperativo vinto${o.bossNome ? ': ' + o.bossNome : ''}`;
        SaveManager.addCurrency('credits', CREDITI_RAID);
        rewards.push(voce('credits', CREDITI_RAID, spiegazione));
        SaveManager.addCurrency('starChips', STELLE_RAID);
        rewards.push(voce('starChips', STELLE_RAID, spiegazione));
        return rewards;
    }

    /**
     * Premio per una Sfida appena COMPLETATA (js/data/challenges-db.js,
     * campo `reward` — lì c'è anche la nota su come sono tarati i numeri).
     *
     * Stesso contratto di forDuel/forTournament: accredita e torna
     * l'elenco di ciò che ha dato, ogni voce con la propria spiegazione.
     * Chi chiama deve solo mostrarle.
     *
     * Il nome della sfida entra nella spiegazione, e non è un vezzo: il
     * banner può comparire in mezzo a un duello, anche molte partite dopo
     * l'ultima volta che il giocatore ha guardato la pagina Sfide — senza
     * il nome si vedrebbero dei crediti arrivare dal nulla.
     *
     * Torna un elenco vuoto per una sfida senza premio (`reward: null`),
     * senza rompere nulla: il chiamante mostra il banner comunque.
     */
    function forChallenge(def) {
        const rewards = [];
        if (!def || !def.reward || !window.SaveManager) return rewards;
        Object.keys(def.reward).forEach((currency) => {
            if (currency === 'cards' || currency === 'unlockPacks') return;
            const importo = def.reward[currency];
            if (!importo || importo <= 0) return;
            SaveManager.addCurrency(currency, importo);
            rewards.push(voce(currency, importo, `Sfida completata — ${def.label}`));
        });
        (def.reward.cards || []).forEach((entry) => {
            const id = Number(entry.id || entry.cardId);
            const qty = Math.max(1, Number(entry.qty) || 1);
            const prima = SaveManager.getOwnedCount(id);
            const dopo = SaveManager.addOwnedCards(id, qty);
            if (dopo > prima) {
                const premio = { cardId: id, amount: dopo - prima, icon: '🃏', nome: entry.nome || `Carta #${id}`, rule: `Sfida completata — ${def.label}` };
                rewards.push(premio);
                if (window.CardDropAnimation) CardDropAnimation.enqueue(premio);
                else if (window.CardAcquisition && typeof CardAcquisition.persistAnimation === 'function') CardAcquisition.persistAnimation(premio);
            }
        });
        (def.reward.unlockPacks || []).forEach((packId) => {
            if (!window.CardAcquisition || !CardAcquisition.unlockPack(packId, def.id)) return;
            rewards.push({ amount: 1, icon: '🔓', nome: 'pacchetto sbloccato', rule: `${packId} — Sfida completata: ${def.label}` });
        });
        return rewards;
    }

    /**
     * Quanto DAREBBE una sfida, senza accreditare niente: serve alla
     * pagina Sfide per mostrare il premio PRIMA che sia stato vinto.
     *
     * Deliberatamente separata da forChallenge invece di aggiungerle un
     * parametro "non pagare": una funzione che a volte accredita e a
     * volte no è esattamente il tipo di cosa che, chiamata per sbaglio
     * nel ramo sbagliato, regala valuta a ogni ridisegno di una pagina.
     */
    function previewChallenge(def) {
        if (!def || !def.reward) return [];
        const out = Object.keys(def.reward)
            .filter((currency) => currency !== 'cards' && currency !== 'unlockPacks' && def.reward[currency] > 0)
            .map((currency) => voce(currency, def.reward[currency], `Premio di "${def.label}"`));
        (def.reward.cards || []).forEach((entry) => out.push({ cardId: entry.id || entry.cardId, amount: entry.qty || 1, icon: '🃏', nome: entry.nome || `Carta #${entry.id || entry.cardId}`, rule: `Premio di "${def.label}"` }));
        (def.reward.unlockPacks || []).forEach((packId) => out.push({ amount: 1, icon: '🔓', nome: 'pacchetto sbloccato', rule: `${packId} — Premio di "${def.label}"` }));
        return out;
    }

    /**
     * Anteprima di cosa paga una VITTORIA fuori dai tornei (Duello Libero,
     * Tag Team locale) al livello `difficulty` ('Facile'|'Medio'|'Difficile').
     * Legge le STESSE costanti di forDuel, quindi non puo' andare alla
     * deriva. Non assegna nulla: solo lettura (anche dello stato di oggi,
     * che dice se la prossima vittoria e' la prima o e' gia' a meta' premio).
     *
     * Le probabilita' dei ritrovamenti sono quelle di tabella: rollDrop fa un
     * solo tiro a soglie cumulative, quindi coincidono con quelle vere.
     */
    function preview(difficulty) {
        const base = WIN_CREDITS[difficulty] || 0;
        const giorno = dayKey();
        let vittorieOggi = 0;
        try { vittorieOggi = window.SaveManager ? (SaveManager.getDailyEconomy(giorno).wins || 0) : 0; } catch (e) { /* noop */ }
        const prossima = vittorieOggi + 1;
        const ridotta = prossima > DIMINISHING_AFTER_WINS;
        const drops = DROPS.map((d) => ({
            currency: d.currency, icon: d.icon, nome: d.nome,
            chance: d.chanceByDifficulty ? (d.chanceByDifficulty[difficulty] || 0) : d.chance
        }));
        return {
            difficulty: difficulty,
            crediti: ridotta ? Math.round(base * DIMINISHING_FACTOR) : base,
            creditiPieni: base,
            ridotta: ridotta,
            vittorieOggi: vittorieOggi,
            primaDelGiorno: prossima === 1,
            bonusPrimaDelGiorno: FIRST_WIN_OF_DAY_BONUS,
            soglia: DIMINISHING_AFTER_WINS,
            perdita: LOSS_CREDITS,
            traguardoOgni: STAR_MILESTONE_EVERY,
            traguardoStelle: STAR_MILESTONE_REWARD[difficulty] || 0,
            drops: drops
        };
    }

    /** Percentuale leggibile: 9% -> "9%", 0,78% -> "0,8%". */
    function percento(p) {
        const v = p * 100;
        const t = v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
        return t.replace('.', ',') + '%';
    }

    /**
     * L'anteprima come HTML (stile in js/economy/rewards.css, classe
     * .rw-anteprima). `contesto` e' una frase corta che dice a quale modalita'
     * si riferisce; l'elenco e' lo stesso per tutte quelle che passano da
     * forDuel. Sicuro con innerHTML: tutto testo scritto in questo file.
     */
    const NOME_LIVELLO = { Facile: 'Facile', Medio: 'Normale', Difficile: 'Difficile' };
    const stelle = (n) => `${n} ${n === 1 ? 'Stella' : 'Stelle'}`;
    // Le emoji dei premi diventano le icone a tema del gioco (js/ui/icon-library.js): le stesse del Profilo,
    // quindi Crediti, Stelle, Locazione e Millennio hanno lo stesso disegno ovunque. L'emoji resta come
    // contenuto di ripiego (se la pagina non carica la libreria, o per un'emoji senza icona).
    const ICONE_TEMA = {
        '💰': 'coin', '⭐': 'star', '🃏': 'map', '🔱': 'eye', '👁️': 'eye',
        '🌅': 'medal', '🎯': 'target', '🏹': 'target', '🤝': 'defensePos', '⚔️': 'attackPos',
        '📅': 'arena', '🗼': 'tower', '🎁': 'shop', '🖼️': 'collection', '🧩': 'puzzle',
        '🎓': 'rules', 'ℹ️': 'rules', '🗺️': 'map', '👑': 'crown', '🏆': 'tournament',
        '🏟️': 'arena', '✨': 'star'
    };
    /** Il segnaposto <span data-icon> per un'emoji (Icons.hydrate lo sostituisce con l'SVG); l'emoji se non ha icona. */
    function icona(emoji) {
        const nome = ICONE_TEMA[emoji];
        return nome ? `<span class="icon" data-icon="${nome}">${emoji}</span>` : emoji;
    }
    /** Trasforma i segnaposto dentro `el` nelle icone vere. Da chiamare dopo aver messo nell'elemento l'HTML di questo file. */
    function idrata(el) {
        if (el && window.Icons && Icons.hydrate) Icons.hydrate(el);
    }

    /** Una riga dell'elenco premi: icona + testo (HTML scritto qui, mai input dell'utente). */
    function riga(icon, html, classe) {
        return `<li${classe ? ` class="${classe}"` : ''}><span class="rw-ico">${icona(icon)}</span><span>${html}</span></li>`;
    }
    /** Il riquadro: titolo facoltativo + elenco di righe gia' pronte. */
    function riquadro(titolo, righe) {
        return `<div class="rw-anteprima">${titolo ? `<div class="rw-titolo">${titolo}</div>` : ''}<ul>${righe.join('')}</ul></div>`;
    }

    /** Le righe di un duello VINTO al livello `difficulty` (crediti, bonus del giorno, Stelle ogni 10, ritrovamenti, sconfitta). */
    function righeVittoria(difficulty) {
        const p = preview(difficulty);
        const nomeLivello = NOME_LIVELLO[difficulty] || 'Normale';
        const righe = [];
        righe.push(riga('💰', `<b>+${p.crediti} crediti</b> per ogni vittoria a ${nomeLivello}${p.ridotta ? ` <em>(oggi sei oltre la ${p.soglia}ª vittoria: valgono la metà, base ${p.creditiPieni})</em>` : ` <em>(dalla ${p.soglia + 1}ª vittoria del giorno la metà)</em>`}`));
        righe.push(p.primaDelGiorno
            ? riga('🌅', `<b>+${p.bonusPrimaDelGiorno} crediti</b> in più: sarebbe la tua prima vittoria di oggi`)
            : riga('🌅', `Bonus prima vittoria del giorno (+${p.bonusPrimaDelGiorno}) già preso oggi`));
        righe.push(riga('🎯', `<b>+${stelle(p.traguardoStelle)}</b> ogni ${p.traguardoOgni} vittorie a ${nomeLivello}`));
        p.drops.forEach((d) => righe.push(riga(d.icon, `${d.nome}: <b>${percento(d.chance)}</b> a ogni vittoria`)));
        righe.push(riga('🤝', `Se perdi: +${p.perdita} crediti. Se abbandoni: niente. Ritrovamenti: al massimo uno per duello.`, 'rw-nota'));
        return righe;
    }

    /** Come righeVittoria, ma per le modalita' dove il livello cambia (o si sceglie dopo): i tre livelli in una riga sola. */
    function righeVittoriaTuttiILivelli() {
        const liv = ['Facile', 'Medio', 'Difficile'];
        const per = (f) => liv.map((l) => `${f(l)} ${NOME_LIVELLO[l]}`).join(' · ');
        const p = preview('Medio');
        const righe = [];
        righe.push(riga('💰', `Ogni vittoria: <b>${per((l) => '+' + WIN_CREDITS[l])}</b> crediti <em>(dalla ${p.soglia + 1}ª vittoria del giorno la metà)</em>`));
        righe.push(p.primaDelGiorno
            ? riga('🌅', `<b>+${p.bonusPrimaDelGiorno} crediti</b> in più la prima vittoria di oggi`)
            : riga('🌅', `Bonus prima vittoria del giorno (+${p.bonusPrimaDelGiorno}) già preso oggi`));
        righe.push(riga('🎯', `Ogni ${STAR_MILESTONE_EVERY} vittorie allo stesso livello: <b>${liv.map((l) => '+' + STAR_MILESTONE_REWARD[l]).join('/')} Stelle</b> (Facile/Normale/Difficile)`));
        righe.push(riga('⭐', `Stella dell'Esagono: <b>${liv.map((l) => percento(STAR_DROP_CHANCE[l])).join(' / ')}</b> a ogni vittoria (Facile/Normale/Difficile)`));
        DROPS.filter((d) => !d.chanceByDifficulty).forEach((d) => righe.push(riga(d.icon, `${d.nome}: <b>${percento(d.chance)}</b> a ogni vittoria`)));
        righe.push(riga('🤝', `Se perdi: +${LOSS_CREDITS} crediti. Se abbandoni: niente. Ritrovamenti: al massimo uno per duello.`, 'rw-nota'));
        return righe;
    }

    function previewHtml(difficulty, contesto, senzaTitolo) {
        return riquadro(senzaTitolo ? '' : `Premi in caso di vittoria${contesto ? ' · ' + contesto : ''}`, righeVittoria(difficulty));
    }

    // ---- Premi PROPRI delle modalita' (oltre a quelli di un duello) -------------------------------
    // I numeri che hanno una costante nel loro modulo restano li' (js/data/caccia-db.js, settimana-db.js,
    // torre-db.js): qui si LEGGONO. Quelli che vivevano come numeri nel codice di una modalita' (Puzzle,
    // Tutorial) vivono ora qui, e le modalita' li chiedono a Rewards.
    const PUZZLE_CREDITI_BASE = 60;
    const PUZZLE_CREDITI_PER_DIFFICOLTA = 40;
    const TUTORIAL_CREDITI = 200;
    /** Crediti per la PRIMA soluzione di un puzzle di difficolta' 1..3. */
    function puzzleCrediti(difficolta) { return PUZZLE_CREDITI_BASE + PUZZLE_CREDITI_PER_DIFFICOLTA * (difficolta || 1); }

    /**
     * Il riquadro "Premi di questa modalita'" per `id`: 'caccia' | 'settimana' | 'rivincite' | 'torre' |
     * 'puzzle' | 'tutorial' | 'storia' | 'torneo' (con `opzioni.torneo` = id del torneo). Dice cosa paga la
     * modalita' IN PIU' e, dove vale, il premio normale di un duello vinto. Torna '' per un id sconosciuto
     * o se manca il database della modalita' (la pagina non lo ha caricato).
     */
    function modalitaHtml(id, opzioni) {
        const o = opzioni || {};
        const n = (x) => Number(x).toLocaleString('it-IT');
        const speciali = [];
        let standard = null;
        let titolo = '';
        if (id === 'caccia') {
            const db = window.cacciaDatabase;
            if (!db) return '';
            titolo = 'Premi della Caccia al Boss';
            const p = db.premio;
            speciali.push(riga('🏹', `Prima caccia vinta della settimana: <b>+${n(p.crediti)} crediti</b> e <b>+${stelle(p.stelle)}</b>, più <b>+${stelle(p.bonusVeloce.stelle)}</b> extra se vinci entro ${p.bonusVeloce.entroTurni} turni. Una volta a settimana.`));
            standard = () => riga('⚔️', `Come ogni duello, a ${NOME_LIVELLO[db.livello] || db.livello}:`, 'rw-sottotitolo').concat(righeVittoria(db.livello).join(''));
        } else if (id === 'settimana') {
            const db = window.settimanaDatabase;
            if (!db) return '';
            titolo = 'Premi del Duello della Settimana';
            const livelli = ['Facile', 'Medio', 'Difficile'];
            const premio = (l) => { const x = db.premi[l]; return `${n(x.crediti)}${x.stelle ? ` + ${stelle(x.stelle)}` : ''}`; };
            speciali.push(riga('📅', `Prima vittoria della settimana a ogni livello: <b>${livelli.map((l) => `${NOME_LIVELLO[l]} ${premio(l)}`).join(' · ')}</b> (crediti). Una volta a settimana per livello.`));
            standard = () => righeVittoriaTuttiILivelli().join('');
        } else if (id === 'rivincite') {
            titolo = 'Premi delle Rivincite';
            speciali.push(riga('⚔️', 'Nessun premio in più: vincere una Rivincita assegna la <b>medaglia</b> di quel livello, che resta nella schermata Rivincite.'));
            standard = () => righeVittoriaTuttiILivelli().join('');
        } else if (id === 'torre') {
            const db = window.torreDatabase;
            if (!db) return '';
            titolo = 'Premi della Torre dei Duellanti';
            const fasce = db.fasce.map((f) => `piani ${f.daPiano}–${f.aPiano} ${NOME_LIVELLO[f.livello] || f.livello}`).join(' · ');
            speciali.push(riga('🗼', `Il livello cresce con i piani (${fasce}); i Boss dei piani ${Object.keys(db.boss).join(', ')} hanno il loro. Ogni piano vinto paga come un duello a quel livello.`));
            speciali.push(riga('🎁', `Dopo ogni piano scegli fra <b>Ristoro</b> (+${db.recuperoLp} Life Point) e un <b>oggetto</b> per la scalata.`));
            speciali.push(riga('🖼️', 'Illustrazioni alternative di alcune carte: una a sorte superando il piano 15 e una conquistando la Torre, finché ne restano da sbloccare.'));
            standard = () => righeVittoriaTuttiILivelli().join('');
        } else if (id === 'raid') {
            titolo = 'Premi dell\'Assalto al Boss';
            speciali.push(riga('🗼', `Boss a zero sulla barra comune e tu ancora in piedi: <b>+${CREDITI_RAID} crediti</b> e <b>+${stelle(STELLE_RAID)}</b>, fino a <b>${RAID_AL_GIORNO} volte al giorno</b>. Oltre, la vittoria conta per record e Sfide ma non paga.`));
            speciali.push(riga('ℹ️', 'Questo premio prende il posto di quello di un Duello Libero: niente bonus della prima vittoria, Stelle ogni 10 vittorie o ritrovamenti.'));
            speciali.push(riga('🤝', `Se eri già a terra quando il Boss cade, o perdi: +${LOSS_CREDITS} crediti di partecipazione. Se abbandoni: niente.`, 'rw-nota'));
        } else if (id === 'puzzle') {
            titolo = 'Premi dei Puzzle';
            speciali.push(riga('🧩', `Prima soluzione di un puzzle: <b>+${puzzleCrediti(1)}</b> (difficoltà 1) · <b>+${puzzleCrediti(2)}</b> (difficoltà 2) · <b>+${puzzleCrediti(3)}</b> (difficoltà 3) crediti. Rifarlo non paga di nuovo.`));
            speciali.push(riga('⭐', 'Le stelle del puzzle sono un voto, non una valuta: tre al primo tentativo, due entro il terzo.'));
            speciali.push(riga('ℹ️', 'Un puzzle non è un duello vero: niente premio di vittoria, bonus del giorno o ritrovamenti.', 'rw-nota'));
        } else if (id === 'tutorial') {
            titolo = 'Premi del Tutorial';
            speciali.push(riga('🎓', `Prima lezione completata: <b>+${TUTORIAL_CREDITI} crediti</b>, una volta sola.`));
            speciali.push(riga('ℹ️', 'Le altre lezioni non pagano, e una lezione non è un duello vero: niente premio di vittoria o ritrovamenti.', 'rw-nota'));
        } else if (id === 'storia') {
            titolo = 'Premi della Storia';
            speciali.push(riga('🗺️', `Ogni arco narrativo completato la prima volta, a qualsiasi livello: <b>+${stelle(STELLE_PER_ARCO_STORIA)}</b> e <b>+${CREDITI_PER_ARCO_STORIA} crediti</b>.`));
            speciali.push(riga('👑', 'Fine della campagna: premio finale <b>×1 a Facile, ×1,5 a Normale, ×2 a Difficile</b>, pagato una volta per livello (la Grande Guerra ha un solo livello).'));
            speciali.push(riga('🖼️', 'A Difficile, alcune tappe regalano un\'illustrazione alternativa di una carta, una volta sola.'));
            standard = () => riga('⚔️', 'Ogni duello vinto paga come in Duello Libero, al livello della storia:', 'rw-sottotitolo').concat(righeVittoriaTuttiILivelli().join(''));
        } else if (id === 'torneo') {
            const t = TOURNAMENT_COMPLETION[o.torneo];
            if (!t) return '';
            titolo = 'Premi del torneo';
            const liv = ['Facile', 'Medio', 'Difficile'];
            const per = (valori) => liv.map((l) => `${valori[l]} ${NOME_LIVELLO[l]}`).join(' · ');
            speciali.push(riga('🏆', `Torneo completato: <b>${per(t.credits)}</b> crediti`));
            Object.keys(t).filter((c) => c !== 'credits').forEach((c) => {
                const meta = CURRENCY_META[c] || { icon: '•', nome: c };
                speciali.push(riga(meta.icon, `<b>${per(t[c])}</b> ${meta.nome}`));
            });
            const b = FIRST_COMPLETION_BONUS[o.torneo] || {};
            const bonus = Object.keys(b).map((c) => `+${b[c]} ${(CURRENCY_META[c] || { nome: c }).nome}`);
            if (bonus.length) speciali.push(riga('✨', `La prima volta in assoluto, in più: <b>${bonus.join(', ')}</b>`));
            speciali.push(riga('🏟️', `Ogni duello vinto dentro il torneo: <b>+${TOURNAMENT_DUEL_CREDITS} crediti</b>. Qui non escono ritrovamenti.`));
            const inPalio = Object.keys(MILLENNIUM_ITEMS).map((k) => MILLENNIUM_ITEMS[k]).filter((it) => it.tornei.indexOf(o.torneo) !== -1);
            if (inPalio.length) {
                speciali.push(riga('👁️', `Oggetti del Millennio in palio: ${inPalio.map((it) => `${it.icon} ${it.nome} (battendo ${it.nomeChi})`).join(', ')}. <b>${Math.round(MILLENNIUM_ITEM_CHANCE * 100)}%</b> ogni volta; una copia sola per oggetto.`));
            }
        } else {
            return '';
        }
        const righe = speciali.slice();
        if (standard) righe.push(standard());
        return riquadro(titolo, righe);
    }

    /**
     * Mette in `destinazione` (elemento o selettore) un <details> richiudibile "Premi di questa modalita'"
     * col contenuto di modalitaHtml. Non fa nulla se l'id non ha premi da mostrare. Chiuso di default:
     * c'e' per chi lo cerca, senza allungare la pagina.
     */
    function montaPremiModalita(destinazione, id, opzioni) {
        const el = typeof destinazione === 'string' ? document.querySelector(destinazione) : destinazione;
        if (!el) return;
        const html = modalitaHtml(id, opzioni);
        if (!html) { el.hidden = true; return; }
        el.hidden = false;
        el.innerHTML = `<details class="rw-modo"><summary>${icona('🎁')} Premi di questa modalità</summary>${html}</details>`;
        idrata(el);
    }

    /**
     * Il testo delle regole, per la schermata che le spiega (Negozio e
     * riepilogo premi). Sta qui e non nelle pagine così non può andare
     * alla deriva rispetto ai numeri veri: se cambia una costante qui
     * sopra, cambia anche la spiegazione.
     */
    function rulesSummary() {
        return [
            { icon: '💰', titolo: 'Duello vinto', testo: `+${WIN_CREDITS.Facile} crediti contro un avversario Facile, +${WIN_CREDITS.Medio} contro uno Normale, +${WIN_CREDITS.Difficile} contro uno Difficile.` },
            { icon: '🤝', titolo: 'Duello perso', testo: `+${LOSS_CREDITS} crediti lo stesso: un duello giocato non è mai tempo buttato.` },
            { icon: '🌅', titolo: 'Prima vittoria del giorno', testo: `+${FIRST_WIN_OF_DAY_BONUS} crediti una volta al giorno. Premia il tornare spesso, non il giocare venti duelli di fila.` },
            { icon: '📉', titolo: 'Rendimenti decrescenti', testo: `Dalla ${DIMINISHING_AFTER_WINS + 1}ª vittoria della giornata i crediti valgono la metà.` },
            { icon: '🎯', titolo: 'Traguardo vittorie', testo: `Ogni ${STAR_MILESTONE_EVERY} vittorie fuori dai tornei: +${STAR_MILESTONE_REWARD.Facile}/+${STAR_MILESTONE_REWARD.Medio}/+${STAR_MILESTONE_REWARD.Difficile} Stelle a Facile/Normale/Difficile. Ogni livello conserva il proprio contatore.` },
            { icon: '🎲', titolo: 'Ritrovamenti fortunati', testo: `⭐ Stella: ${Math.round(STAR_DROP_CHANCE.Facile * 100)}% a Facile, ${Math.round(STAR_DROP_CHANCE.Medio * 100)}% a Normale, ${Math.round(STAR_DROP_CHANCE.Difficile * 100)}% a Difficile · 🃏 Carta Locazione 3% · 🔱 Carta del Millennio 0,8%. Solo fuori dai tornei e mai piu' di uno per duello.` },
            { icon: '🏟️', titolo: 'Duelli di torneo', testo: `+${TOURNAMENT_DUEL_CREDITS} crediti per ogni duello vinto dentro un torneo: lì si rischia l'eliminazione.` },
            { icon: '🏆', titolo: 'Torneo completato', testo: 'Ogni torneo paga soprattutto la propria valuta: molte Stelle nel Regno, Carte Locazione a Battle City e Carte del Millennio al Torneo Kaiba. Battle City e Kaiba danno anche 3/5/8 Stelle a Facile/Normale/Difficile.' },
            { icon: '👁️', titolo: 'Oggetti del Millennio', testo: `I soli premi che non sono una valuta, e ne esiste una copia sola ciascuno: ${Object.keys(MILLENNIUM_ITEMS).map((k) => `${MILLENNIUM_ITEMS[k].icon} ${MILLENNIUM_ITEMS[k].nome} da ${MILLENNIUM_ITEMS[k].nomeChi}`).join(' · ')}. ${Math.round(MILLENNIUM_ITEM_CHANCE * 100)}% ogni volta che batti chi lo porta, e solo dentro un torneo dove ha senso incontrarlo. Una volta vinto non esce più.` },
            { icon: '✨', titolo: 'Prima vittoria di un torneo', testo: 'La prima vittoria assoluta aggiunge un bonus fisso: +500 crediti e +4 Stelle nel Regno, +1 Carta Locazione a Battle City oppure +1 Carta del Millennio al Torneo Kaiba. Non raddoppia il premio della difficolta\'.' },
            { icon: '🎯', titolo: 'Sfide completate', testo: 'Ogni Sfida paga UNA VOLTA sola, quando la completi: da 100 crediti per la prima vittoria fino a 1000 per le 50. Le più lunghe o simboliche danno anche valute rare — Slifer in campo vale una Carta del Millennio.' },
            { icon: '📈', titolo: 'I mazzi rincarano', testo: 'Ogni Starter o Structure Deck che compri fa salire il prezzo del successivo dello stesso tipo (contatori separati), e servono anche Carte Locazione o Carte del Millennio (dal secondo Starter, già dal primo Structure), in quantità che cresce ulteriormente con altri acquisti. Costano sempre Stelle e Crediti insieme — i numeri esatti sono nella pagina del Negozio.' }
        ];
    }

    /**
     * Il riepilogo premi come HTML, condiviso da chiunque debba mostrarlo
     * (le tre pagine torneo, e in futuro qualunque altra schermata che
     * assegni premi) — così la forma resta una sola e non va alla deriva
     * fra una pagina e l'altra. Lo stile vive in js/economy/rewards.css.
     * Sicuro da inserire con innerHTML: icone, nomi e regole sono tutti
     * testo scritto in questo file, mai input dell'utente.
     */
    function summaryHtml(rewards, titolo) {
        const voci = rewards || [];
        if (voci.length === 0) return '';
        // Una `nota` non ha importo ne' nome (vedi nota() sopra): spiega
        // perche' un premio NON e' arrivato. Disegnarla con lo stesso
        // stampo di una voce vera produrrebbe "+undefined undefined" —
        // ed e' esattamente quello che succedeva prima che forTournament
        // cominciasse a emetterne.
        return `<div class="reward-summary">
            <div class="reward-summary-title">${titolo || 'Ricompense'}</div>
            ${voci.map((r) => (r.nota ? `
                <div class="reward-row reward-row--nota">
                    <span class="reward-icon">${r.icon}</span>
                    <span class="reward-text">
                        <span class="reward-rule">${r.rule}</span>
                    </span>
                </div>` : `
                <div class="reward-row">
                    <span class="reward-icon">${r.icon}</span>
                    <span class="reward-text">
                        <span class="reward-amount">+${r.amount} ${r.nome}</span>
                        <span class="reward-rule">${r.rule}</span>
                    </span>
                </div>`)).join('')}
        </div>`;
    }

    window.Rewards = {
        // Tabelle esposte in sola lettura di fatto (nessun chiamante le
        // modifica): servono agli strumenti di audit per calcolare il
        // farming leggendo gli stessi numeri del gioco, senza ricopiarli.
        WIN_CREDITS: WIN_CREDITS,
        LOSS_CREDITS: LOSS_CREDITS,
        FIRST_WIN_OF_DAY_BONUS: FIRST_WIN_OF_DAY_BONUS,
        DIMINISHING_AFTER_WINS: DIMINISHING_AFTER_WINS,
        DIMINISHING_FACTOR: DIMINISHING_FACTOR,
        TOURNAMENT_DUEL_CREDITS: TOURNAMENT_DUEL_CREDITS,
        forDuel: forDuel,
        forTournament: forTournament,
        forChallenge: forChallenge,
        forStoryCampaign: forStoryCampaign,
        forStoryArc: forStoryArc,
        forRaid: forRaid,
        CREDITI_RAID: CREDITI_RAID,        STELLE_RAID: STELLE_RAID,
        RAID_AL_GIORNO: RAID_AL_GIORNO,
        STELLE_PER_ARCO_STORIA: STELLE_PER_ARCO_STORIA,
        CREDITI_PER_ARCO_STORIA: CREDITI_PER_ARCO_STORIA,
        previewChallenge: previewChallenge,
        preview: preview,
        previewHtml: previewHtml,
        modalitaHtml: modalitaHtml,
        montaPremiModalita: montaPremiModalita,
        idrata: idrata,
        icona: icona,
        puzzleCrediti: puzzleCrediti,
        TUTORIAL_CREDITI: TUTORIAL_CREDITI,
        _rollDrop: rollDrop, // solo per i test (tests/specs/premi-anteprima-duello-libero-e-tag.spec.js)
        rulesSummary: rulesSummary,
        summaryHtml: summaryHtml,
        CURRENCY_META: CURRENCY_META,
        TOURNAMENT_COMPLETION: TOURNAMENT_COMPLETION,
        FIRST_COMPLETION_BONUS: FIRST_COMPLETION_BONUS,
        TOURNAMENT_EXCLUDED: TOURNAMENT_EXCLUDED,
        MILLENNIUM_ITEMS: MILLENNIUM_ITEMS,
        MILLENNIUM_ITEM_CHANCE: MILLENNIUM_ITEM_CHANCE,
        millenniumItemInPalio: millenniumItemInPalio,
        STAR_DROP_CHANCE: STAR_DROP_CHANCE,
        STAR_MILESTONE_EVERY: STAR_MILESTONE_EVERY,
        STAR_MILESTONE_REWARD: STAR_MILESTONE_REWARD
    };
})();
