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
 * COME RUOTANO. Ogni giorno se ne sorteggiano 3, ogni settimana 10 —
 * dallo STESSO meccanismo che il Negozio usa per le carte del giorno
 * (js/economy/shop-catalog.js): un seme ricavato dalla chiave del periodo
 * secondo il SERVER, non dall'orologio del dispositivo. Due giocatori
 * nello stesso giorno vedono le stesse missioni, e spostare l'ora del
 * telefono non ne fa comparire di nuove.
 *
 * `scope` dice dove può finire una missione:
 *   'daily'   solo fra le giornaliere — obiettivi da una sessione di
 *             gioco, raggiungibili in mezz'ora.
 *   'weekly'  solo fra le settimanali — più lunghi, ma mai tali da
 *             richiedere di giocare tutti i giorni.
 *   'both'    va bene in entrambe, con target diverso (vedi `target` e
 *             `targetWeekly`).
 *
 * Il `type` e il `match` sono ESATTAMENTE quelli delle Sfide, e passano
 * dallo stesso tracker: una missione nuova con un type già esistente non
 * richiede una riga di motore. È il motivo per cui qui non compare nessun
 * obiettivo esotico — tutto ciò che il gioco sa già contare, e nient'altro.
 *
 * I PREMI sono volutamente piccoli in confronto a una Sfida. Il conto è
 * questo: 3 giornaliere al giorno più 10 settimanali fanno, in una
 * settimana giocata con continuità, circa 4.000-5.000 crediti e una
 * manciata di valute rare — cioè poco più di un mazzo Structure. Servono
 * a dare un motivo per accendere il gioco oggi, non a sostituire i tornei.
 */
const missionsDatabase = [
    // --- Duelli, il pane quotidiano ---------------------------------
    {
        id: 'm-win-duels', icon: '⚔️', scope: 'both',
        label: 'Sul campo', description: 'Vinci {n} Duelli',
        type: 'winDuels', match: {},
        target: 3, targetWeekly: 15,
        reward: { credits: 250 }, rewardWeekly: { credits: 900, starChips: 1 }
    },
    {
        id: 'm-perfect-win', icon: '🛡️', scope: 'both',
        label: 'Senza un graffio', description: 'Vinci {n} Duelli senza perdere un solo Life Point',
        type: 'perfectWin', match: {},
        target: 1, targetWeekly: 4,
        reward: { credits: 400 }, rewardWeekly: { credits: 1200, starChips: 1, locatorCards: 1 }
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
        id: 'm-summon-blue-eyes', icon: '🐉', scope: 'both',
        label: 'Il Drago Bianco', description: 'Evoca {n} volte il Drago Bianco Occhi Blu',
        type: 'summonMonster', match: { cardId: 1 },
        target: 1, targetWeekly: 4,
        reward: { credits: 300 }, rewardWeekly: { credits: 1000, starChips: 1 }
    },
    {
        id: 'm-summon-dark-magician', icon: '🪄', scope: 'both',
        label: 'Il Mago Nero', description: 'Evoca {n} volte il Mago Nero',
        type: 'summonMonster', match: { cardId: 2 },
        target: 1, targetWeekly: 4,
        reward: { credits: 300 }, rewardWeekly: { credits: 1000, starChips: 1 }
    },
    {
        id: 'm-summon-red-eyes', icon: '🔥', scope: 'both',
        label: 'Occhi Rossi', description: 'Evoca {n} volte il Drago Nero Occhi Rossi',
        type: 'summonMonster', match: { cardId: 3 },
        target: 1, targetWeekly: 4,
        reward: { credits: 300 }, rewardWeekly: { credits: 1000, starChips: 1 }
    },
    {
        id: 'm-summon-kuriboh', icon: '🟤', scope: 'daily',
        label: 'Piccolo aiuto', description: 'Evoca {n} volte Kuriboh',
        type: 'summonMonster', match: { cardId: 19 },
        target: 1,
        reward: { credits: 200 }
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
        id: 'm-beat-kaiba', icon: '🧊', scope: 'both',
        label: 'Contro il Presidente', description: 'Sconfiggi Seto Kaiba {n} volte',
        type: 'defeatCharacter', match: { characterId: 'kaiba' },
        target: 1, targetWeekly: 3,
        reward: { credits: 350 }, rewardWeekly: { credits: 1100, starChips: 1 }
    },
    {
        id: 'm-beat-joey', icon: '🎲', scope: 'daily',
        label: 'Il migliore amico', description: 'Sconfiggi Joey Wheeler {n} volte',
        type: 'defeatCharacter', match: { characterId: 'joey' },
        target: 1,
        reward: { credits: 250 }
    },
    {
        id: 'm-beat-pegasus', icon: '👁️', scope: 'both',
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
        id: 'm-activate-pot', icon: '🏺', scope: 'both',
        label: 'Avidità', description: 'Attiva {n} volte Vaso dell\'Avidità',
        type: 'activateCard', match: { cardId: 36 },
        target: 2, targetWeekly: 8,
        reward: { credits: 250 }, rewardWeekly: { credits: 800 }
    },
    {
        id: 'm-activate-dark-hole', icon: '🕳️', scope: 'both',
        label: 'Tabula rasa', description: 'Attiva {n} volte Buco Nero',
        type: 'activateCard', match: { cardId: 7 },
        target: 1, targetWeekly: 5,
        reward: { credits: 250 }, rewardWeekly: { credits: 800 }
    },
    {
        id: 'm-activate-mirror', icon: '🪞', scope: 'both',
        label: 'Riflesso', description: 'Attiva {n} volte Forza dello Specchio',
        type: 'activateCard', match: { cardId: 382 },
        target: 1, targetWeekly: 5,
        reward: { credits: 250 }, rewardWeekly: { credits: 800 }
    },
    {
        id: 'm-activate-swords', icon: '🗡️', scope: 'daily',
        label: 'Luce rivelatrice', description: 'Attiva {n} volte Spada Rivelatrice',
        type: 'activateCard', match: { cardId: 8 },
        target: 1,
        reward: { credits: 200 }
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
