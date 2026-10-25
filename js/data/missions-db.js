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

    // --- Settimanali: duelli ------------------------------------------
    {
        id: 'm-win-duels', icon: '⚔️', scope: 'weekly',
        label: 'Sul campo', description: 'Vinci {n} Duelli',
        type: 'winDuels', match: {},
        target: 15,
        reward: { credits: 900, starChips: 1 }
    },
    {
        id: 'm-perfect-win', icon: '🛡️', scope: 'weekly',
        label: 'Senza un graffio', description: 'Vinci {n} Duelli senza perdere un solo Life Point',
        type: 'perfectWin', match: {},
        target: 4,
        reward: { credits: 1200, starChips: 1, locatorCards: 1 }
    },
    {
        id: 'm-tournament', icon: '🏆', scope: 'weekly',
        label: 'Fino in fondo', description: 'Porta a termine {n} tornei',
        type: 'completeTournament', match: {},
        target: 1, targetWeekly: 2,
        reward: { credits: 800 }, rewardWeekly: { credits: 1600, starChips: 2 }
    },

    // --- Evocazioni: un tema diverso per ogni missione ---------------
    // Il `match` con un ELENCO di id accetta una qualunque di quelle
    // carte: senza, l'unico modo di scrivere "evoca un Drago" sarebbe
    // sceglierne uno e mentire nella descrizione.
    {
        id: 'm-summon-blue-eyes', icon: '🐉', scope: 'weekly',
        label: 'Il Drago Bianco', description: 'Evoca {n} volte il Drago Bianco Occhi Blu',
        type: 'summonMonster', match: { cardId: 1 },
        target: 1, targetWeekly: 4,
        reward: { credits: 300 }, rewardWeekly: { credits: 1000, starChips: 1 }
    },
    {
        id: 'm-summon-dark-magician', icon: '🪄', scope: 'weekly',
        label: 'Il Mago Nero', description: 'Evoca {n} volte il Mago Nero',
        type: 'summonMonster', match: { cardId: 2 },
        target: 1, targetWeekly: 4,
        reward: { credits: 300 }, rewardWeekly: { credits: 1000, starChips: 1 }
    },
    {
        id: 'm-summon-red-eyes', icon: '🔥', scope: 'weekly',
        label: 'Occhi Rossi', description: 'Evoca {n} volte il Drago Nero Occhi Rossi',
        type: 'summonMonster', match: { cardId: 3 },
        target: 1, targetWeekly: 4,
        reward: { credits: 300 }, rewardWeekly: { credits: 1000, starChips: 1 }
    },
    {
        id: 'm-summon-kuriboh', icon: '🟤', scope: 'weekly',
        label: 'Piccolo aiuto', description: 'Evoca {n} volte Kuriboh',
        type: 'summonMonster', match: { cardId: 19 },
        target: 3,
        reward: { credits: 700 }
    },
    {
        id: 'm-summon-god', icon: '⚡', scope: 'weekly',
        label: 'Il potere degli Dei', description: 'Evoca {n} volte un Dio Egizio',
        type: 'summonMonster', match: { cardId: [30, 31, 472] },
        target: 1, targetWeekly: 2,
        reward: { credits: 900, millenniumCards: 1 }, rewardWeekly: { credits: 1800, millenniumCards: 1 }
    },

    // --- Duellanti da battere ---------------------------------------
    {
        id: 'm-beat-kaiba', icon: '🧊', scope: 'weekly',
        label: 'Contro il Presidente', description: 'Sconfiggi Seto Kaiba {n} volte',
        type: 'defeatCharacter', match: { characterId: 'kaiba' },
        target: 1, targetWeekly: 3,
        reward: { credits: 350 }, rewardWeekly: { credits: 1100, starChips: 1 }
    },
    {
        id: 'm-beat-joey', icon: '🎲', scope: 'weekly',
        label: 'Il migliore amico', description: 'Sconfiggi Joey Wheeler {n} volte',
        type: 'defeatCharacter', match: { characterId: 'joey' },
        target: 2,
        reward: { credits: 800 }
    },
    {
        id: 'm-beat-pegasus', icon: '👁️', scope: 'weekly',
        label: 'L\'Occhio del creatore', description: 'Sconfiggi Maximillion Pegasus {n} volte',
        type: 'defeatCharacter', match: { characterId: 'pegasus' },
        target: 1, targetWeekly: 3,
        reward: { credits: 400 }, rewardWeekly: { credits: 1200, starChips: 1 }
    },
    {
        id: 'm-beat-marik', icon: '🔱', scope: 'weekly',
        label: 'Il Padrone delle Ombre', description: 'Sconfiggi Marik Ishtar {n} volte',
        type: 'defeatCharacter', match: { characterId: 'marik' },
        target: 1, targetWeekly: 3,
        reward: { credits: 400 }, rewardWeekly: { credits: 1300, starChips: 1, locatorCards: 1 }
    },

    // --- Magie e Trappole -------------------------------------------
    {
        id: 'm-activate-pot', icon: '🏺', scope: 'weekly',
        label: 'Avidità', description: 'Attiva {n} volte Vaso dell\'Avidità',
        type: 'activateCard', match: { cardId: 36 },
        target: 2, targetWeekly: 8,
        reward: { credits: 250 }, rewardWeekly: { credits: 800 }
    },
    {
        id: 'm-activate-dark-hole', icon: '🕳️', scope: 'weekly',
        label: 'Tabula rasa', description: 'Attiva {n} volte Buco Nero',
        type: 'activateCard', match: { cardId: 7 },
        target: 1, targetWeekly: 5,
        reward: { credits: 250 }, rewardWeekly: { credits: 800 }
    },
    {
        id: 'm-activate-mirror', icon: '🪞', scope: 'weekly',
        label: 'Riflesso', description: 'Attiva {n} volte Forza Riflessa',
        type: 'activateCard', match: { cardId: 382 },
        target: 1, targetWeekly: 5,
        reward: { credits: 250 }, rewardWeekly: { credits: 800 }
    },
    {
        id: 'm-activate-swords', icon: '🗡️', scope: 'weekly',
        label: 'Luce rivelatrice', description: 'Attiva {n} volte Spada Rivelatrice',
        type: 'activateCard', match: { cardId: 8 },
        target: 3,
        reward: { credits: 700 }
    },

    // --- I colpi grossi, solo settimanali ---------------------------
    {
        id: 'm-exodia', icon: '🧩', scope: 'weekly',
        label: 'Il Proibito', description: 'Vinci {n} volte assemblando Exodia',
        type: 'winInstantly', match: { kind: 'exodia' },
        target: 1,
        reward: { credits: 2000, millenniumCards: 2 }
    },
    {
        id: 'm-millennium', icon: '🏅', scope: 'weekly',
        label: 'Un altro Oggetto', description: 'Vinci {n} Oggetti del Millennio',
        type: 'winMillenniumItem', match: {},
        target: 1,
        reward: { credits: 1000, millenniumCards: 1 }
    }
];

/** @type {any} */ (window).missionsDatabase = missionsDatabase;
