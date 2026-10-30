// @ts-check
/**
 * missions-db.js — Il pool delle MISSIONI a rotazione (sfide.html).
 * =====================================================================
 * Una Sfida (js/data/challenges-db.js) è un traguardo UNA TANTUM: si
 * completa e resta completata per sempre. Una MISSIONE appartiene invece
 * a un periodo — un giorno o una settimana — e quando quel periodo
 * finisce sparisce, che sia stata completata o no.
 *
 * Sono in un file a parte proprio per questo: hanno un ciclo di vita
 * diverso, un progresso conservato altrove (SaveManager.getMissionProgress,
 * che si azzera da sé al cambio di periodo) e premi tarati su un altro
 * metro. Tenerle nello stesso elenco delle Sfide avrebbe voluto dire un
 * campo "ma questa scade" su ogni voce, e due regole diverse nascoste
 * dentro un solo array.
 *
 * COME RUOTANO. Le GIORNALIERE sono 4 e sono sempre le stesse 4 (il pool
 * giornaliero ne contiene esattamente quante ne servono): obiettivi
 * generici, alla portata di chiunque — anche di chi ha appena cominciato —
 * che si azzerano ogni giorno. Le SETTIMANALI sono 10 sorteggiate da un
 * pool più ampio e specifico (carte, Duellanti, tornei), con lo STESSO
 * meccanismo che il Negozio usa per le carte del giorno
 * (js/economy/shop-catalog.js): un seme ricavato dalla chiave del periodo
 * secondo il SERVER, non dall'orologio del dispositivo. Due giocatori
 * nella stessa settimana vedono le stesse missioni, e spostare l'ora del
 * telefono non ne fa comparire di nuove.
 *
 * `scope` dice dove può finire una missione:
 *   'daily'   solo fra le giornaliere — generiche, da una sessione di
 *             gioco breve, SENZA richiedere una carta o un Duellante
 *             precisi (un giocatore nuovo non li ha).
 *   'weekly'  solo fra le settimanali — più lunghe e specifiche, ma mai
 *             tali da richiedere di giocare tutti i giorni.
 *   'both'    va bene in entrambe, con target diverso (vedi `target` e
 *             `targetWeekly`). Oggi nessuna: le giornaliere sono le 4
 *             generiche qui sotto.
 *
 * Il `type` e il `match` sono ESATTAMENTE quelli delle Sfide, e passano
 * dallo stesso tracker: una missione nuova con un type già esistente non
 * richiede una riga di motore. È il motivo per cui qui non compare nessun
 * obiettivo esotico — tutto ciò che il gioco sa già contare, e nient'altro.
 *
 * I PREMI sono volutamente piccoli in confronto a una Sfida. Le 4
 * giornaliere valgono 700 crediti in tutto se si completano tutte; le 10
 * settimanali, in una settimana giocata con continuità, qualche migliaio di
 * crediti e una manciata di valute rare. Servono a dare un motivo per
 * accendere il gioco oggi, non a sostituire i tornei.
 */
const missionsDatabase = [
    // --- Le 4 GIORNALIERE: generiche, alla portata di tutti ----------
    // Nessuna chiede una carta, un Duellante o un mazzo preciso: contano
    // qualunque duello, qualunque mostro, qualunque Magia/Trappola. Un
    // giocatore al primo giorno le completa tutte giocando UN duello
    // normale (si evocano e si attivano carte comunque), e la prima è
    // volutamente la più facile: conta anche una sconfitta.
    {
        id: 'm-daily-play', icon: '🎴', scope: 'daily',
        label: 'In campo', description: 'Gioca {n} Duello fino alla fine',
        type: 'playDuel', match: {},
        target: 1,
        reward: { credits: 150 }
    },
    {
        id: 'm-daily-win', icon: '⚔️', scope: 'daily',
        label: 'Una vittoria', description: 'Vinci {n} Duello',
        type: 'winDuels', match: {},
        target: 1,
        reward: { credits: 250 }
    },
    {
        id: 'm-daily-summon', icon: '🐲', scope: 'daily',
        label: 'Chiama i mostri', description: 'Evoca {n} mostri',
        type: 'summonMonster', match: {},
        target: 3,
        reward: { credits: 150 }
    },
    {
        id: 'm-daily-spelltrap', icon: '✨', scope: 'daily',
        label: 'Magia e inganno', description: 'Attiva {n} carte Magia o Trappola',
        type: 'activateCard', match: { cardType: ['spell', 'trap'] },
        target: 2,
        reward: { credits: 150 }
    },

    // --- Le SETTIMANALI: 8 estratte da questo pool di 9 --------------
    // Regola (richiesta dell'utente, 2026-10-30): come le giornaliere, devono essere alla portata di un giocatore MEDIO.
    // Quindi niente carte o Duellanti precisi (Obelisco, Drago Bianco, Kaiba, Exodia: chi non li ha non puo' finirle),
    // niente Oggetti del Millennio, niente traguardi che si fanno una volta sola nella vita (puzzle, Torre). Solo cio' che
    // si conta giocando normalmente: duelli giocati e vinti, mostri evocati, Magie e Trappole attivate, qualche Duellante
    // battuto. I numeri sono tarati su UNA settimana di gioco normale (qualche duello al giorno), non su una maratona.
    {
        id: 'm-w-play', icon: '🎴', scope: 'weekly',
        label: 'Sempre in campo', description: 'Gioca {n} Duelli fino alla fine',
        type: 'playDuel', match: {},
        target: 10,
        reward: { credits: 600 }
    },
    {
        id: 'm-w-win', icon: '⚔️', scope: 'weekly',
        label: 'Sul campo', description: 'Vinci {n} Duelli',
        type: 'winDuels', match: {},
        target: 6,
        reward: { credits: 800, starChips: 1 }
    },
    {
        id: 'm-w-defeat', icon: '🏅', scope: 'weekly',
        label: 'Avversari battuti', description: 'Sconfiggi {n} Duellanti',
        type: 'defeatCharacter', match: {},
        target: 4,
        reward: { credits: 700, starChips: 1 }
    },
    {
        id: 'm-w-summon', icon: '🐲', scope: 'weekly',
        label: 'Esercito di mostri', description: 'Evoca {n} mostri',
        type: 'summonMonster', match: {},
        target: 25,
        reward: { credits: 500 }
    },
    {
        id: 'm-w-spelltrap', icon: '✨', scope: 'weekly',
        label: 'Magia e inganno', description: 'Attiva {n} carte Magia o Trappola',
        type: 'activateCard', match: { cardType: ['spell', 'trap'] },
        target: 15,
        reward: { credits: 500 }
    },
    {
        id: 'm-w-spell', icon: '📜', scope: 'weekly',
        label: 'Maestro di Magie', description: 'Attiva {n} carte Magia',
        type: 'activateCard', match: { cardType: ['spell'] },
        target: 8,
        reward: { credits: 400 }
    },
    {
        id: 'm-w-trap', icon: '🪤', scope: 'weekly',
        label: 'Tendi la trappola', description: 'Attiva {n} carte Trappola',
        type: 'activateCard', match: { cardType: ['trap'] },
        target: 4,
        reward: { credits: 400 }
    },
    {
        id: 'm-w-perfect', icon: '🛡️', scope: 'weekly',
        label: 'Senza un graffio', description: 'Vinci {n} Duello senza perdere un solo Life Point',
        type: 'perfectWin', match: {},
        target: 1,
        reward: { credits: 700, starChips: 1 }
    },
    {
        id: 'm-w-tournament', icon: '🏆', scope: 'weekly',
        label: 'Fino in fondo', description: 'Porta a termine {n} torneo',
        type: 'completeTournament', match: {},
        target: 1,
        reward: { credits: 900, starChips: 1 }
    }
];

/** @type {any} */ (window).missionsDatabase = missionsDatabase;
