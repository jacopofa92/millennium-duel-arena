/**
 * challenges-db.js — Catalogo delle Sfide (obiettivi da completare
 * giocando, vedi sfide.html). Solo dati statici, nessuna logica di
 * tracking qui: quella vive in js/challenges/challenge-tracker.js, che
 * fa il matching generico type+match invece di avere una funzione
 * dedicata per ogni singola sfida — stesso principio di separazione
 * dati/motore già usato per characters-db.js/cards-db.js.
 *
 * Ogni sfida ha un `type` che dice A COSA si aggancia:
 *   - 'defeatCharacter': N vittorie contro un personaggio specifico di
 *     Duello Libero/Storia (match: { characterId }, id da
 *     js/data/characters-db.js) — incrementata in js/duel-session.js
 *     (funzione finish()), MAI contro il Bot generico del Duello Demo
 *     (che non ha un characterId).
 *   - 'winDuels': N Duelli vinti in totale, contro qualunque avversario
 *     reale (match: {}) — stesso punto di aggancio di 'defeatCharacter'.
 *   - 'summonMonster': N Evocazioni (Normali O Speciali, sommate insieme)
 *     di una carta specifica per id (match: { cardId }, id da
 *     data/cards.json) del solo giocatore umano — incrementata nel
 *     dispatcher condiviso ON_NORMAL_SUMMON/ON_SPECIAL_SUMMON in
 *     js/engine/duel-engine.js.
 *   - 'activateCard': N attivazioni riuscite di una Magia/Trappola/effetto
 *     per id (match: { cardId }), sempre del solo giocatore —
 *     finishActivateCard in js/engine/duel-engine.js, cioè il punto in cui
 *     l'attivazione è davvero andata a buon fine e non solo tentata.
 *   - 'winInstantly': N vittorie per condizione alternativa
 *     (match: { kind: 'exodia' | 'destinyBoard' | 'flyingElephant' }) —
 *     triggerInstantWin in js/engine/game-flow.js, da cui passano TUTTE.
 *   - 'perfectWin': N duelli vinti senza perdere un solo Life Point
 *     (match: {}) — js/duel-session.js, accanto a 'winDuels'.
 *   - 'completeTournament': N tornei portati a termine
 *     (match: { tournamentId }, oppure {} per "uno qualsiasi") —
 *     Rewards.forTournament, l'unico punto attraversato da tutte e tre le
 *     pagine torneo.
 *   - 'winMillenniumItem': un Oggetto del Millennio vinto
 *     (match: { itemId }, oppure {} per "uno qualsiasi") — dentro
 *     Rewards.forDuel, dove l'Oggetto viene registrato.
 *
 * AGGIUNGERNE UNA con un `type` già esistente non richiede di toccare
 * nulla fuori da questo file: il tracker fa il matching generico
 * type+match. Un type NUOVO costa una sola chiamata a
 * ChallengeTracker.recordProgress nel punto giusto del motore — e va
 * messa in un punto UNICO già attraversato da tutti i casi, come quelli
 * elencati qui sopra, non in ogni pagina che potrebbe provocarlo.
 *
 * `reward` è ciò che il giocatore riceve completando la sfida: una mappa
 * valuta -> quantità (le valute sono quelle di js/save-manager.js:
 * credits, starChips, locatorCards, millenniumCards). Lo legge
 * `Rewards.forChallenge` (js/economy/rewards.js), che è anche l'unico
 * punto che accredita davvero — nessuna pagina assegna valute per conto
 * proprio, vedi la regola in testa a quel file. `null` significa
 * "nessun premio", non "premio da decidere".
 *
 * COME SONO TARATI I NUMERI, per non doverlo riscoprire aggiungendone
 * una nuova. Il metro di paragone è l'economia già esistente: un duello
 * vinto vale 60-90 crediti, la prima vittoria del giorno 150, completare
 * un torneo 1200 (raddoppiati la prima volta). Una Sfida è un traguardo
 * UNA TANTUM e di lungo periodo, quindi deve valere più di un duello ma
 * restare sotto un torneo — che è la cosa più impegnativa del gioco.
 * Le valute rare (Stelle, Locazione, Millennio) compaiono solo sulle
 * sfide davvero lunghe o simboliche: se le desse anche la più facile,
 * i tornei perderebbero la loro ragione d'essere.
 */
const challengesDatabase = [
    // --- Sconfiggi un Duellante N volte (Duello Libero) ---
    {
        id: 'defeat-yugi-5',
        icon: '🃏',
        label: 'Il Re dei Giochi',
        description: 'Sconfiggi Yugi Muto 5 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'yugiMuto' },
        target: 5,
        reward: { credits: 400, starChips: 2 }
    },
    {
        id: 'defeat-kaiba-10',
        icon: '🐉',
        label: 'Il Presidente Battuto',
        description: 'Sconfiggi Seto Kaiba 10 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'kaiba' },
        target: 10,
        reward: { credits: 700, starChips: 4 }
    },
    {
        id: 'defeat-pegasus-5',
        icon: '👁️',
        label: 'Occhio del Millennio',
        description: 'Sconfiggi Maximillion Pegasus 5 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'pegasus' },
        target: 5,
        reward: { credits: 400, starChips: 2 }
    },
    {
        id: 'defeat-marik-5',
        icon: '🌑',
        label: 'Padrone delle Ombre',
        description: 'Sconfiggi Marik Ishtar 5 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'marik' },
        target: 5,
        reward: { credits: 400, starChips: 2 }
    },
    {
        id: 'defeat-joey-5',
        icon: '🎲',
        label: 'Più Fortuna che Bravura',
        description: 'Sconfiggi Joey Wheeler 5 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'joey' },
        target: 5,
        reward: { credits: 300 }
    },
    {
        id: 'defeat-mai-5',
        icon: '🦋',
        label: 'Il Profumo delle Carte',
        description: 'Sconfiggi Mai Valentine 5 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'mai' },
        target: 5,
        reward: { credits: 300 }
    },
    {
        id: 'defeat-bakura-5',
        icon: '💍',
        label: 'L\'Anello del Millennio',
        description: 'Sconfiggi Ryo Bakura 5 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'bakura' },
        target: 5,
        reward: { credits: 350 }
    },
    {
        id: 'defeat-ishizu-3',
        icon: '📿',
        label: 'Contro la Profezia',
        description: 'Sconfiggi Ishizu Ishtar 3 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'ishizu' },
        target: 3,
        reward: { credits: 350 }
    },
    {
        id: 'defeat-yamiYugi-10',
        icon: '👑',
        label: 'Battere il Faraone',
        description: 'Sconfiggi Yami Yugi 10 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'yamiYugi' },
        target: 10,
        reward: { credits: 800, starChips: 4 }
    },
    {
        id: 'defeat-bandit-keith-5',
        icon: '🇺🇸',
        label: 'Niente Trucchi',
        description: 'Sconfiggi Bandit Keith 5 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'bandit_keith' },
        target: 5,
        reward: { credits: 300 }
    },
    {
        id: 'defeat-rex-weevil-5',
        icon: '🦖',
        label: 'Il Cacciatore di Dinosauri',
        description: 'Sconfiggi Rex Raptor 5 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'rex' },
        target: 5,
        reward: { credits: 250 }
    },
    {
        id: 'defeat-weevil-5',
        icon: '🐛',
        label: 'Disinfestazione',
        description: 'Sconfiggi Weevil Underwood 5 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'weevil' },
        target: 5,
        reward: { credits: 250 }
    },
    {
        id: 'defeat-mako-5',
        icon: '🌊',
        label: 'Pesca Grossa',
        description: 'Sconfiggi Mako Tsunami 5 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'mako' },
        target: 5,
        reward: { credits: 250 }
    },
    {
        id: 'defeat-panik-3',
        icon: '🕯️',
        label: 'Nessuna Paura',
        description: 'Sconfiggi Panik 3 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'panik' },
        target: 3,
        reward: { credits: 250 }
    },
    {
        id: 'defeat-bonz-3',
        icon: '💀',
        label: 'Riposino in Pace',
        description: 'Sconfiggi Bonz 3 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'bonz' },
        target: 3,
        reward: { credits: 250 }
    },
    {
        id: 'defeat-paradox-3',
        icon: '🧱',
        label: 'Il Labirinto Risolto',
        description: 'Sconfiggi i Fratelli Paradosso 3 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'paradoxBrothers' },
        target: 3,
        reward: { credits: 300 }
    },
    {
        id: 'defeat-heishin-3',
        icon: '🏛️',
        label: 'L\'Usurpatore',
        description: 'Sconfiggi Heishin 3 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'heishin' },
        target: 3,
        reward: { credits: 450, locatorCards: 1 }
    },
    {
        id: 'defeat-darknite-1',
        icon: '😈',
        label: 'Oltre l\'Ultimo Duellante',
        description: 'Sconfiggi DarkNite',
        type: 'defeatCharacter',
        match: { characterId: 'darkNite' },
        target: 1,
        reward: { credits: 700, millenniumCards: 1 }
    },
    {
        id: 'defeat-priestSeto-3',
        icon: '🔺',
        label: 'Il Sacerdote del Passato',
        description: 'Sconfiggi il Sacerdote Seto 3 volte in Duello Libero',
        type: 'defeatCharacter',
        match: { characterId: 'priestSeto' },
        target: 3,
        reward: { credits: 400 }
    },
    {
        id: 'defeat-mirror-1',
        icon: '🪞',
        label: 'Conosci Te Stesso',
        description: 'Sconfiggi Te Stesso',
        type: 'defeatCharacter',
        match: { characterId: 'mirror' },
        target: 1,
        reward: { credits: 400, starChips: 1 }
    },

    // --- Evoca una carta specifica N volte (qualunque modalità) ---
    {
        id: 'summon-blue-eyes-5',
        icon: '🐲',
        label: 'Drago Leggendario',
        description: 'Evoca il Drago Bianco Occhi Blu 5 volte',
        type: 'summonMonster',
        match: { cardId: 1 },
        target: 5,
        reward: { credits: 300 }
    },
    {
        id: 'summon-dark-magician-5',
        icon: '🧙',
        label: 'Il Mago di Yugi',
        description: 'Evoca il Mago Nero 5 volte',
        type: 'summonMonster',
        match: { cardId: 2 },
        target: 5,
        reward: { credits: 300 }
    },
    {
        id: 'summon-red-eyes-3',
        icon: '🔥',
        label: 'Fiamma Scarlatta',
        description: 'Evoca il Drago Nero Occhi Rossi 3 volte',
        type: 'summonMonster',
        match: { cardId: 12 },
        target: 3,
        reward: { credits: 250 }
    },
    {
        id: 'summon-exodia-head-3',
        icon: '🧩',
        label: 'Il Proibito',
        description: 'Evoca la Exodia il Proibito 3 volte',
        type: 'summonMonster',
        match: { cardId: 41 },
        target: 3,
        reward: { credits: 250, locatorCards: 1 }
    },
    {
        id: 'summon-jinzo-3',
        icon: '🤖',
        label: 'Silenzio delle Trappole',
        description: 'Evoca Jinzo 3 volte',
        type: 'summonMonster',
        match: { cardId: 17 },
        target: 3,
        reward: { credits: 250 }
    },
    {
        id: 'summon-kuriboh-5',
        icon: '🟤',
        label: 'Piccolo Peloso',
        description: 'Evoca Kuriboh 5 volte',
        type: 'summonMonster',
        match: { cardId: 22 },
        target: 5,
        reward: { credits: 200 }
    },
    {
        id: 'summon-slifer-1',
        icon: '⚡',
        label: 'Un Dio in Campo',
        description: 'Evoca Slifer il Drago del Cielo',
        type: 'summonMonster',
        match: { cardId: 31 },
        target: 1,
        reward: { credits: 500, millenniumCards: 1 }
    },
    {
        id: 'summon-obelisk-1',
        icon: '🗿',
        label: 'Il Tormentatore',
        description: 'Evoca Obelisk il Tormentatore',
        type: 'summonMonster',
        match: { cardId: 30 },
        target: 1,
        reward: { credits: 500, millenniumCards: 1 }
    },
    {
        id: 'summon-ra-1',
        icon: '☀️',
        label: 'Il Drago Alato',
        description: 'Evoca Il Drago Alato di Ra',
        type: 'summonMonster',
        match: { cardId: 472 },
        target: 1,
        reward: { credits: 500, millenniumCards: 1 }
    },
    {
        id: 'summon-three-gods',
        icon: '🔺',
        label: 'Il Cielo, la Terra e il Sole',
        description: 'Evoca 3 volte un Dio Egizio (Slifer, Obelisk o Ra)',
        type: 'summonMonster',
        // Elenco, non un id solo: vale una qualunque delle tre Evocazioni
        // (vedi matchesDef in js/challenges/challenge-tracker.js).
        match: { cardId: [31, 30, 472] },
        target: 3,
        reward: { credits: 900, millenniumCards: 2 }
    },
    {
        id: 'summon-blue-eyes-ultimate-1',
        icon: '🐉',
        label: 'Le Tre Teste',
        description: 'Evoca il Drago Occhi Blu Finale',
        type: 'summonMonster',
        match: { cardId: 29 },
        target: 1,
        reward: { credits: 600, starChips: 2 }
    },
    {
        id: 'summon-dark-magician-chaos-1',
        icon: '🌀',
        label: 'Magia del Caos',
        description: 'Evoca il Mago del Chaos Oscuro',
        type: 'summonMonster',
        match: { cardId: 854 },
        target: 1,
        reward: { credits: 500, locatorCards: 1 }
    },
    {
        id: 'summon-exodia-necross-1',
        icon: '⛓️',
        label: 'Ciò che Torna',
        description: 'Evoca Exodia Necross',
        type: 'summonMonster',
        match: { cardId: 230 },
        target: 1,
        reward: { credits: 600, millenniumCards: 1 }
    },
    {
        id: 'summon-blue-eyes-20',
        icon: '🐲',
        label: 'Il Mazzo di Kaiba',
        description: 'Evoca il Drago Bianco Occhi Blu 20 volte',
        type: 'summonMonster',
        match: { cardId: 1 },
        target: 20,
        reward: { credits: 900, starChips: 4 }
    },
    {
        id: 'summon-dark-magician-20',
        icon: '🧙',
        label: 'Fedele al Mago',
        description: 'Evoca il Mago Nero 20 volte',
        type: 'summonMonster',
        match: { cardId: 2 },
        target: 20,
        reward: { credits: 900, starChips: 4 }
    },
    {
        id: 'summon-kuriboh-20',
        icon: '🟤',
        label: 'Una Palla di Pelo alla Volta',
        description: 'Evoca Kuriboh 20 volte',
        type: 'summonMonster',
        match: { cardId: 22 },
        target: 20,
        reward: { credits: 500, locatorCards: 1 }
    },
    {
        id: 'summon-flying-elephant-1',
        icon: '🐘',
        label: 'Ma Esiste Davvero?',
        description: 'Evoca l\'Elefante Volante',
        type: 'summonMonster',
        match: { cardId: 246 },
        target: 1,
        reward: { credits: 400 }
    },

    // --- Attiva una carta N volte (Magie, Trappole, effetti) ---
    {
        id: 'activate-dark-hole-10',
        icon: '🕳️',
        label: 'Tabula Rasa',
        description: 'Attiva Buco Nero 10 volte',
        type: 'activateCard',
        match: { cardId: 7 },
        target: 10,
        reward: { credits: 350 }
    },
    {
        id: 'activate-mirror-force-5',
        icon: '🛡️',
        label: 'Rimandato al Mittente',
        description: 'Attiva Forza Riflessa 5 volte',
        type: 'activateCard',
        match: { cardId: 382 },
        target: 5,
        reward: { credits: 350 }
    },
    {
        id: 'activate-magic-cylinder-5',
        icon: '🎩',
        label: 'Il Tuo Stesso Attacco',
        description: 'Attiva Cilindro Magico 5 volte',
        type: 'activateCard',
        match: { cardId: 10 },
        target: 5,
        reward: { credits: 350 }
    },
    {
        id: 'activate-monster-reborn-10',
        icon: '♻️',
        label: 'Seconda Vita',
        description: 'Attiva Mostro Resuscitato 10 volte',
        type: 'activateCard',
        match: { cardId: 35 },
        target: 10,
        reward: { credits: 350 }
    },
    {
        id: 'activate-pot-of-greed-10',
        icon: '🏺',
        label: 'Ma Cosa Fa Questa Carta?',
        description: 'Attiva Vaso dell\'Avidità 10 volte',
        type: 'activateCard',
        match: { cardId: 36 },
        target: 10,
        reward: { credits: 300 }
    },
    {
        id: 'activate-harpies-feather-duster-5',
        icon: '🪶',
        label: 'Campo Ripulito',
        description: 'Attiva Tempesta di Piume dell\'Arpia 5 volte',
        type: 'activateCard',
        match: { cardId: 292 },
        target: 5,
        reward: { credits: 350 }
    },
    {
        id: 'activate-destiny-board-1',
        icon: '🔮',
        label: 'La Prima Lettera',
        description: 'Attiva Tavola del Destino',
        type: 'activateCard',
        match: { cardId: 866 },
        target: 1,
        reward: { credits: 400, locatorCards: 1 }
    },

    // --- Vittorie per condizione alternativa ---
    {
        id: 'win-exodia-1',
        icon: '🧩',
        label: 'Exodia, Obliteralo!',
        description: 'Vinci un Duello riunendo i 5 pezzi di Exodia',
        type: 'winInstantly',
        match: { kind: 'exodia' },
        target: 1,
        reward: { credits: 800, millenniumCards: 1 }
    },
    {
        id: 'win-destiny-board-1',
        icon: '👻',
        label: 'F-I-N-A-L-E',
        description: 'Vinci un Duello completando Tavola del Destino',
        type: 'winInstantly',
        match: { kind: 'destinyBoard' },
        target: 1,
        reward: { credits: 800, millenniumCards: 1 }
    },
    {
        id: 'win-flying-elephant-1',
        icon: '🐘',
        label: 'La Vittoria più Assurda',
        description: 'Vinci un Duello con l\'Elefante Volante',
        type: 'winInstantly',
        match: { kind: 'flyingElephant' },
        target: 1,
        reward: { credits: 800, millenniumCards: 1 }
    },
    {
        id: 'win-instantly-5',
        icon: '✨',
        label: 'Mai per Vie Normali',
        description: 'Vinci 5 Duelli per condizione alternativa, in qualunque modo',
        type: 'winInstantly',
        match: {},
        target: 5,
        reward: { credits: 1000, millenniumCards: 2 }
    },

    // --- Vittorie senza subire danni ---
    {
        id: 'perfect-win-1',
        icon: '💎',
        label: 'Senza un Graffio',
        description: 'Vinci un Duello con tutti e 8000 i Life Points intatti',
        type: 'perfectWin',
        match: {},
        target: 1,
        reward: { credits: 400 }
    },
    {
        id: 'perfect-win-5',
        icon: '💎',
        label: 'Intoccabile',
        description: 'Vinci 5 Duelli senza perdere un solo Life Point',
        type: 'perfectWin',
        match: {},
        target: 5,
        reward: { credits: 700, starChips: 3 }
    },
    {
        id: 'perfect-win-20',
        icon: '💎',
        label: 'Muro Invalicabile',
        description: 'Vinci 20 Duelli senza perdere un solo Life Point',
        type: 'perfectWin',
        match: {},
        target: 20,
        reward: { credits: 1000, millenniumCards: 1 }
    },

    // --- Tornei ---
    {
        id: 'tournament-duelistKingdom-1',
        icon: '🏝️',
        label: 'Il Regno Conquistato',
        description: 'Completa il Regno dei Duellanti',
        type: 'completeTournament',
        match: { tournamentId: 'duelistKingdom' },
        target: 1,
        reward: { credits: 600, starChips: 3 }
    },
    {
        id: 'tournament-battleCity-1',
        icon: '🏙️',
        label: 'Campione di Battle City',
        description: 'Completa Battle City',
        type: 'completeTournament',
        match: { tournamentId: 'battleCity' },
        target: 1,
        reward: { credits: 600, locatorCards: 3 }
    },
    {
        id: 'tournament-kaiba-1',
        icon: '🎮',
        label: 'Il Campionato di Kaiba',
        description: 'Completa il Torneo Kaiba',
        type: 'completeTournament',
        match: { tournamentId: 'kaibaTournament' },
        target: 1,
        reward: { credits: 600, millenniumCards: 2 }
    },
    {
        id: 'tournament-any-5',
        icon: '🏟️',
        label: 'Habitué dei Tornei',
        description: 'Completa 5 tornei, di qualunque tipo',
        type: 'completeTournament',
        match: {},
        target: 5,
        reward: { credits: 1000, starChips: 3, locatorCards: 3 }
    },
    {
        id: 'tournament-any-15',
        icon: '🏟️',
        label: 'Nato per Vincere',
        description: 'Completa 15 tornei, di qualunque tipo',
        type: 'completeTournament',
        match: {},
        target: 15,
        reward: { credits: 2000, millenniumCards: 3 }
    },

    // --- Oggetti del Millennio ---
    {
        id: 'item-eye',
        icon: '👁️',
        label: 'L\'Occhio di Pegasus',
        description: 'Vinci l\'Occhio del Millennio',
        type: 'winMillenniumItem',
        match: { itemId: 'millenniumEye' },
        target: 1,
        reward: { credits: 800, millenniumCards: 1 }
    },
    {
        id: 'item-rod',
        icon: '🪄',
        label: 'Il Bastone di Marik',
        description: 'Vinci il Bastone del Millennio',
        type: 'winMillenniumItem',
        match: { itemId: 'millenniumRod' },
        target: 1,
        reward: { credits: 800, millenniumCards: 1 }
    },
    {
        id: 'item-necklace',
        icon: '📿',
        label: 'La Collana di Ishizu',
        description: 'Vinci la Collana del Millennio',
        type: 'winMillenniumItem',
        match: { itemId: 'millenniumNecklace' },
        target: 1,
        reward: { credits: 800, millenniumCards: 1 }
    },
    {
        id: 'item-all-three',
        icon: '🔱',
        label: 'Collezionista del Millennio',
        description: 'Vinci tutti e tre gli Oggetti del Millennio',
        type: 'winMillenniumItem',
        match: {},
        target: 3,
        reward: { credits: 2000, millenniumCards: 3 }
    },

    // --- Traguardi generali ---
    {
        id: 'win-1',
        icon: '🏆',
        label: 'Prima Vittoria',
        description: 'Vinci il tuo primo Duello',
        type: 'winDuels',
        match: {},
        target: 1,
        reward: { credits: 100 }
    },
    {
        id: 'win-10',
        icon: '🏆',
        label: 'Duellante Esperto',
        description: 'Vinci 10 Duelli',
        type: 'winDuels',
        match: {},
        target: 10,
        reward: { credits: 300 }
    },
    {
        id: 'win-25',
        icon: '🏆',
        label: 'Habitué dell\'Arena',
        description: 'Vinci 25 Duelli',
        type: 'winDuels',
        match: {},
        target: 25,
        reward: { credits: 600, starChips: 2 }
    },
    {
        id: 'win-50',
        icon: '🏆',
        label: 'Leggenda dell\'Arena',
        description: 'Vinci 50 Duelli',
        type: 'winDuels',
        match: {},
        target: 50,
        reward: { credits: 1000, starChips: 5 }
    },
    {
        id: 'win-100',
        icon: '👑',
        label: 'Cento Duelli',
        description: 'Vinci 100 Duelli',
        type: 'winDuels',
        match: {},
        target: 100,
        reward: { credits: 2000, starChips: 5, millenniumCards: 2 }
    },
    {
        id: 'win-250',
        icon: '🌟',
        label: 'Il Duellante Definitivo',
        description: 'Vinci 250 Duelli',
        type: 'winDuels',
        match: {},
        target: 250,
        reward: { credits: 4000, starChips: 10, locatorCards: 10, millenniumCards: 5 }
    },

    // =================================================================
    // SECONDA ONDATA DI SFIDE GENERICHE
    // =================================================================
    // Queste voci usano esclusivamente tipi già registrati dal motore.
    // Sono generate da tabelle per mantenere leggibili catalogo e premi:
    // ogni elemento produce comunque una Sfida indipendente e persistente.
    ...[
        ['solomonMuto', 'solomon', '📖', 'La Lezione del Nonno', 'Sconfiggi Solomon Muto 3 volte', 3, 300],
        ['tea', 'tea', '🌸', 'La Forza dell’Amicizia', 'Sconfiggi Téa Gardner 3 volte', 3, 250],
        ['tristan', 'tristan', '🤝', 'Amici e Rivali', 'Sconfiggi Tristan Taylor 3 volte', 3, 250],
        ['duke', 'duke', '🎲', 'Il Re dei Dadi', 'Sconfiggi Duke Devlin 3 volte', 3, 300],
        ['espaRoba', 'espa-roba', '🔮', 'Oltre la Lettura della Mente', 'Sconfiggi Espa Roba 5 volte', 5, 350],
        ['arkana', 'arkana', '🎭', 'Il Prestigiatore Smascherato', 'Sconfiggi Arkana 5 volte', 5, 350],
        ['seeker', 'seeker', '🧩', 'Il Cacciatore Cacciato', 'Sconfiggi Seeker 5 volte', 5, 400],
        ['strings', 'strings', '🕸️', 'Taglia i Fili', 'Sconfiggi Strings 5 volte', 5, 400],
        ['lumis', 'lumis', '☀️', 'Spezza la Maschera della Luce', 'Sconfiggi Lumis 5 volte', 5, 400],
        ['umbra', 'umbra', '🌑', 'Spezza la Maschera dell’Oscurità', 'Sconfiggi Umbra 5 volte', 5, 400],
        ['odion', 'odion', '⚱️', 'Il Guardiano Caduto', 'Sconfiggi Odion 5 volte', 5, 400],
        ['noah', 'noah', '💾', 'Disconnesso', 'Sconfiggi Noah Kaiba 5 volte', 5, 450],
        ['gansley', 'gansley', '🧠', 'Il Primo dei Cinque', 'Sconfiggi Gansley 3 volte', 3, 300],
        ['johnson', 'johnson', '⚖️', 'Sentenza Ribaltata', 'Sconfiggi Johnson 3 volte', 3, 300],
        ['nesbitt', 'nesbitt', '🔧', 'Macchina Fuori Uso', 'Sconfiggi Nesbitt 3 volte', 3, 300],
        ['crump', 'crump', '🐧', 'Gelo Spezzato', 'Sconfiggi Crump 3 volte', 3, 300],
        ['lector', 'lector', '🕴️', 'L’Ultimo dei Cinque', 'Sconfiggi Lector 3 volte', 3, 300],
        ['gozaburo', 'gozaburo', '🏢', 'Caduta della KaibaCorp', 'Sconfiggi Gozaburo Kaiba 5 volte', 5, 500]
    ].map(([characterId, slug, icon, label, description, target, credits]) => ({
        id: `defeat-${slug}-${target}`,
        icon, label, description,
        type: 'defeatCharacter', match: { characterId }, target,
        reward: { credits }
    })),

    ...[
        [13, 'summoned-skull', '💀', 'Fulmine Demoniaco', 'Evoca Teschio Evocato 5 volte', 5, 300],
        [16, 'gearfried', '⚔️', 'Il Cavaliere di Ferro', 'Evoca Gearfried il Cavaliere di Ferro 5 volte', 5, 300],
        [20, 'buster-blader', '🗡️', 'Distruttore di Draghi', 'Evoca Combattente delle Lame 5 volte', 5, 350],
        [33, 'gate-guardian', '🚪', 'Il Guardiano Riunito', 'Evoca Guardiano del Cancello', 1, 500],
        [52, 'great-moth', '🦋', 'Metamorfosi Completa', 'Evoca Grande Falena 3 volte', 3, 350],
        [123, 'toon-blue-eyes', '📺', 'Drago da Fumetto', 'Evoca Drago Toon Occhi Blu 3 volte', 3, 350],
        [167, 'masked-beast', '🎭', 'La Bestia dietro la Maschera', 'Evoca La Bestia Mascherata 3 volte', 3, 350],
        [172, 'cyber-harpie', '🪶', 'Arpia Potenziata', 'Evoca Cyber Lady Arpia 5 volte', 5, 300],
        [290, 'harpie-sisters', '🪽', 'Tre Arpie, un Solo Attacco', 'Evoca Sorelle Arpie 3 volte', 3, 350],
        [512, 'xyz-dragon-cannon', '🤖', 'X, Y e Z', 'Evoca XYZ-Cannone Drago 3 volte', 3, 450],
        [857, 'wall-shadow', '🧱', 'Ombra nel Labirinto', 'Evoca Muro-Ombra 3 volte', 3, 350],
        [879, 'legendary-fisherman', '🎣', 'Leggenda del Mare', 'Evoca Pescatore Leggendario 5 volte', 5, 300]
    ].map(([cardId, slug, icon, label, description, target, credits]) => ({
        id: `summon-${slug}-${target}`,
        icon, label, description,
        type: 'summonMonster', match: { cardId }, target,
        reward: { credits }
    })),

    ...[
        [8, 'swords-revealing', '⚔️', 'Luce che Ferma il Tempo', 'Attiva Spada Rivelatrice 5 volte', 5, 300],
        [38, 'fusion', '🌀', 'Due Mostri, una Leggenda', 'Attiva Fusione 10 volte', 10, 400],
        [40, 'trap-hole', '🕳️', 'Caduta Improvvisa', 'Attiva Buco Trappola 5 volte', 5, 250],
        [128, 'bottomless-trap-hole', '⬛', 'Senza Fondo', 'Attiva Buco Trappola Senza Fine 5 volte', 5, 300],
        [136, 'call-haunted', '👻', 'Richiamo dall’Oltretomba', 'Attiva Richiamo del Posseduto 5 volte', 5, 300],
        [219, 'dust-tornado', '🌪️', 'Vento di Distruzione', 'Attiva Tornado di Polvere 5 volte', 5, 300],
        [291, 'harpies-duster', '🪶', 'Un Campo Immacolato', 'Attiva Spolverino dell\'Arpia 5 volte', 5, 350],
        [409, 'raigeki', '⚡', 'Giudizio del Fulmine', 'Attiva Raigeki 10 volte', 10, 400],
        [503, 'waboku', '🛡️', 'Nessun Danno', 'Attiva Waboku 5 volte', 5, 300],
        [448, 'solemn-judgment', '⚖️', 'Giudizio Solenne', 'Attiva Giudizio Solenne 5 volte', 5, 400]
    ].map(([cardId, slug, icon, label, description, target, credits]) => ({
        id: `activate-${slug}-${target}`,
        icon, label, description,
        type: 'activateCard', match: { cardId }, target,
        reward: { credits }
    })),

    {
        id: 'perfect-win-50', icon: '✨', label: 'Duel Disk Immacolato',
        description: 'Vinci 50 Duelli senza perdere un solo Life Point',
        type: 'perfectWin', match: {}, target: 50,
        reward: { credits: 1200, starChips: 5 }
    },
    {
        id: 'win-instantly-10', icon: '🌠', label: 'Maestro delle Vittorie Alternative',
        description: 'Vinci 10 Duelli per condizione alternativa',
        type: 'winInstantly', match: {}, target: 10,
        reward: { credits: 1600, millenniumCards: 3 }
    },
    {
        id: 'tournament-any-30', icon: '🏟️', label: 'Veterano dei Tornei',
        description: 'Completa 30 tornei',
        type: 'completeTournament', match: {}, target: 30,
        reward: { credits: 3000, starChips: 8, locatorCards: 5 }
    },
    {
        id: 'win-500', icon: '👑', label: 'Re dei Cinquecento Duelli',
        description: 'Vinci 500 Duelli',
        type: 'winDuels', match: {}, target: 500,
        reward: { credits: 6000, starChips: 15, locatorCards: 10, millenniumCards: 8 }
    },

    // =================================================================
    // SFIDE DELLE STORIE — una sezione per campagna
    // =================================================================
    // Hanno `sezione: 'storia'` e un `campaignId`: sfide.html le raggruppa
    // sotto la campagna a cui appartengono invece di mescolarle alle
    // generiche, perché rispondono a una domanda diversa — "quanto sono
    // avanti in QUESTA storia", non "quanto ho giocato".
    //
    // Il tipo 'storyProgress' conta le tappe superate di una campagna
    // (match: { campaignId }), e si aggancia in js/story/story-progress.js
    // (contaTappaPerLeSfide): ogni tappa superata, scena o duello che
    // sia. `target` è quindi un numero di tappe. Una campagna fatta di
    // AREE (l'anime) conta le tappe DENTRO le aree, non i nodi della mappa
    // grande: il Regno delle Ombre ne ha 45. Si contano solo nella
    // prima partita (a Facile): rigiocare a Normale e Difficile non le
    // ricalcola (vedi contaTappaPerLeSfide). Un TORNEO invece vale una
    // tappa sola. Aggiungendo tappe a una campagna, ricontare qui.
    //
    // I premi salgono con la campagna e non con la fatica del singolo
    // passo: arrivare a metà di una storia vale poco più di qualche
    // duello, finirla vale come un torneo — che è la cosa più impegnativa
    // del gioco, e il metro con cui tutto il resto è tarato.
    {
        id: 'storia-anime-meta', sezione: 'storia', campaignId: 'anime',
        icon: '🧩', label: 'Il Regno delle Ombre: a metà strada',
        description: 'Supera 20 tappe de Il Regno delle Ombre',
        type: 'storyProgress', match: { campaignId: 'anime' },
        target: 20, reward: { credits: 700, starChips: 1 }
    },
    {
        id: 'storia-anime-fine', sezione: 'storia', campaignId: 'anime',
        icon: '👑', label: 'Il Duello Cerimoniale',
        description: 'Completa Il Regno delle Ombre (a Facile, la prima partita)',
        type: 'storyProgress', match: { campaignId: 'anime' },
        target: 45, reward: { credits: 2000, starChips: 4, millenniumCards: 2 }
    },
    {
        id: 'storia-fm-presente', sezione: 'storia', campaignId: 'forbiddenMemories',
        icon: '🏺', label: 'Cinquemila anni dopo',
        description: 'Arriva al presente in Memorie Proibite',
        type: 'storyProgress', match: { campaignId: 'forbiddenMemories' },
        target: 9, reward: { credits: 600 }
    },
    {
        id: 'storia-fm-maghi', sezione: 'storia', campaignId: 'forbiddenMemories',
        icon: '🔮', label: 'I Cinque Maghi Guerrieri',
        description: 'Supera 28 tappe di Memorie Proibite',
        type: 'storyProgress', match: { campaignId: 'forbiddenMemories' },
        target: 28, reward: { credits: 1200, starChips: 2, locatorCards: 1 }
    },
    {
        id: 'storia-fm-fine', sezione: 'storia', campaignId: 'forbiddenMemories',
        icon: '🌑', label: 'Le memorie ritrovate',
        description: 'Completa Memorie Proibite (a Facile, la prima partita)',
        type: 'storyProgress', match: { campaignId: 'forbiddenMemories' },
        target: 40, reward: { credits: 2500, starChips: 4, millenniumCards: 3 }
    },
    {
        id: 'storia-freedom-corridoio', sezione: 'storia', campaignId: 'freedom',
        icon: '🎥', label: 'Oltre la crepa',
        description: 'Supera 8 tappe di Freedom',
        type: 'storyProgress', match: { campaignId: 'freedom' },
        target: 8, reward: { credits: 600 }
    },
    {
        id: 'storia-freedom-fine', sezione: 'storia', campaignId: 'freedom',
        icon: '👑', label: 'La Corona del Millennio',
        description: 'Completa Freedom (a Facile, la prima partita)',
        type: 'storyProgress', match: { campaignId: 'freedom' },
        target: 16, reward: { credits: 1800, starChips: 3, millenniumCards: 2 }
    },
    {
        id: 'storia-ww1-piave', sezione: 'storia', campaignId: 'ww1',
        icon: '🌊', label: 'Di qua dal Piave',
        description: 'Arriva alla difesa del Piave nella Grande Guerra',
        type: 'storyProgress', match: { campaignId: 'ww1' },
        target: 14, reward: { credits: 700, starChips: 1 }
    },
    {
        id: 'storia-ww1-fine', sezione: 'storia', campaignId: 'ww1',
        icon: '🎖️', label: 'Il Bollettino della Vittoria',
        description: 'Completa la Grande Guerra',
        type: 'storyProgress', match: { campaignId: 'ww1' },
        target: 23, reward: { credits: 2000, starChips: 4, locatorCards: 2, millenniumCards: 1 }
    },

    // --- Carte firma e vittorie istantanee: una sola ricompensa ---------
    // Il matching include la difficoltà ricevuta dal punto unico di fine
    // duello. Queste carte aprono poi la loro presenza (rarissima) nelle
    // rotazioni: prima del traguardo non sono comprabili.
    {
        id: 'carta-kaiba-drago-bianco-50', icon: '🐉', label: 'Il Drago di Kaiba',
        description: 'Sconfiggi Seto Kaiba 50 volte a Difficile',
        type: 'defeatCharacter', match: { characterId: 'kaiba', difficulty: 'Difficile' }, target: 50,
        reward: { cards: [{ id: 1, qty: 1, nome: 'Drago Bianco Occhi Blu' }] }
    },
    {
        id: 'carta-kaiba-drago-bianco-100', icon: '🐉', label: 'Tre Draghi, un solo padrone',
        description: 'Sconfiggi Seto Kaiba 100 volte a Difficile',
        type: 'defeatCharacter', match: { characterId: 'kaiba', difficulty: 'Difficile' }, target: 100,
        reward: { cards: [{ id: 1, qty: 1, nome: 'Drago Bianco Occhi Blu' }] }
    },
    {
        id: 'carta-yugi-mago-nero-50', icon: '🪄', label: 'Il mago definitivo',
        description: 'Sconfiggi Yugi o Yami Yugi 50 volte a Difficile',
        type: 'defeatCharacter', match: { characterId: ['yugiMuto', 'yamiYugi'], difficulty: 'Difficile' }, target: 50,
        reward: { cards: [{ id: 2, qty: 1, nome: 'Mago Nero' }] }
    },
    {
        id: 'carta-yugi-mago-nero-100', icon: '🪄', label: 'Legame col Mago Nero',
        description: 'Sconfiggi Yugi o Yami Yugi 100 volte a Difficile',
        type: 'defeatCharacter', match: { characterId: ['yugiMuto', 'yamiYugi'], difficulty: 'Difficile' }, target: 100,
        reward: { cards: [{ id: 2, qty: 1, nome: 'Mago Nero' }] }
    },
    {
        id: 'carta-joey-occhi-rossi-50', icon: '🔥', label: 'Il potenziale degli Occhi Rossi',
        description: 'Sconfiggi Joey 50 volte a Difficile',
        type: 'defeatCharacter', match: { characterId: 'joey', difficulty: 'Difficile' }, target: 50,
        reward: { cards: [{ id: 12, qty: 1, nome: 'Drago Nero Occhi Rossi' }] }
    },
    {
        id: 'carta-pegasus-elefante-25', icon: '🐘', label: 'La vittoria impossibile',
        description: 'Sconfiggi Pegasus 25 volte a Difficile',
        type: 'defeatCharacter', match: { characterId: 'pegasus', difficulty: 'Difficile' }, target: 25,
        reward: { cards: [{ id: 246, qty: 1, nome: 'Elefante Volante' }] }
    },
    {
        id: 'carta-pegasus-toon-50', icon: '📖', label: 'Il drago del Mondo Toon',
        description: 'Sconfiggi Pegasus 50 volte a Difficile',
        type: 'defeatCharacter', match: { characterId: 'pegasus', difficulty: 'Difficile' }, target: 50,
        reward: { cards: [{ id: 123, qty: 1, nome: 'Drago Toon Occhi Blu' }] }
    },
    {
        id: 'carta-mai-piumino-50', icon: '🪶', label: 'La tempesta delle Arpie',
        description: 'Sconfiggi Mai 50 volte a Difficile',
        type: 'defeatCharacter', match: { characterId: 'mai', difficulty: 'Difficile' }, target: 50,
        reward: { cards: [{ id: 291, qty: 1, nome: 'Spolverino dell\'Arpia' }] }
    },
    {
        id: 'carta-bakura-destiny-board-25', icon: '💀', label: 'Il messaggio del destino',
        description: 'Sconfiggi Bakura 25 volte a Difficile',
        type: 'defeatCharacter', match: { characterId: 'bakura', difficulty: 'Difficile' }, target: 25,
        reward: { cards: [{ id: 866, qty: 1, nome: 'Tavola del Destino' }] }
    },

    // --- I livelli: completa a Normale, a Difficile, e tutti e tre -------
    // Richiesta dell'utente ("completa in facile, media e difficile"). La
    // Facile ce l'ha già ogni campagna: è la sfida "Completa …" qui sopra,
    // che conta le tappe della prima partita. Queste due forme nuove si
    // registrano in js/story/story-progress.js (segnaStoriaCompletataPerLeSfide)
    // quando una partita finisce; solo per le campagne CON livelli (la
    // Grande Guerra non li ha). Si generano da una tabella invece di
    // scriverle a mano una per una: sono nove voci uguali tranne che per
    // la campagna, e una campagna nuova con i livelli ne vuole una riga.
    ...[
        { campaignId: 'anime', nome: 'Il Regno delle Ombre', icona: '🧩', scala: 1.2 },
        { campaignId: 'forbiddenMemories', nome: 'Memorie Proibite', icona: '🏺', scala: 1.2 },
        { campaignId: 'freedom', nome: 'Freedom', icona: '🎥', scala: 1 }
    ].reduce((voci, c) => {
        // I premi salgono col livello: Normale un po' sopra la Facile,
        // Difficile quasi il doppio, e tutti e tre come il traguardo più
        // grosso di quella storia. `scala` alza un po' le due storie lunghe.
        const r = (n) => Math.round(n * c.scala / 50) * 50;
        const s = (n) => Math.max(1, Math.round(n * c.scala));
        return voci.concat([
            {
                id: `storia-${c.campaignId}-normale`, sezione: 'storia', campaignId: c.campaignId,
                icon: '🥈', label: `${c.nome}: Normale`,
                description: `Completa ${c.nome} a livello Normale`,
                type: 'storyCompleted', match: { campaignId: c.campaignId, livello: 'normale' },
                target: 1, reward: { credits: r(2500), starChips: s(5), locatorCards: s(1) }
            },
            {
                id: `storia-${c.campaignId}-difficile`, sezione: 'storia', campaignId: c.campaignId,
                icon: '🥇', label: `${c.nome}: Difficile`,
                description: `Completa ${c.nome} a livello Difficile`,
                type: 'storyCompleted', match: { campaignId: c.campaignId, livello: 'difficile' },
                target: 1, reward: { credits: r(3500), starChips: s(7), locatorCards: s(2), millenniumCards: s(2) }
            },
            {
                id: `storia-${c.campaignId}-tre-livelli`, sezione: 'storia', campaignId: c.campaignId,
                icon: c.icona, label: `${c.nome}: leggenda completa`,
                description: `Completa ${c.nome} a Facile, Normale e Difficile`,
                type: 'storyAllLevels', match: { campaignId: c.campaignId },
                target: 1, reward: { credits: r(5000), starChips: s(10), locatorCards: s(3), millenniumCards: s(3) }
            }
        ]);
    }, []),

    // =================================================================
    // SFIDE DELLE MODALITÀ — Puzzle, Rivincite, Torre dei Duellanti
    // =================================================================
    // `sezione: 'modalita'` e `modalita: <id>`: sfide.html le mostra nella
    // sezione "Modalità", un gruppo per modalità. Premi SOLO in crediti, per
    // scelta esplicita dell'utente: i premi speciali di queste modalità
    // (carte nuove) arriveranno più avanti.
    //
    // Puzzle (js/modes/puzzle-mode.js):
    //   'puzzleSolved'      la PRIMA volta che un puzzle viene risolto
    //                       (match: { puzzleId } o {} per "uno qualsiasi");
    //   'puzzleThreeStars'  la prima volta che un puzzle arriva a tre stelle.
    // Il traguardo "tutti" vale il numero di puzzle in js/data/puzzles-db.js
    // (8): aggiungendo puzzle va alzato qui, e lo spec modalita-puzzle lo
    // controlla.
    {
        id: 'puzzle-primo', sezione: 'modalita', modalita: 'puzzle',
        icon: '🧩', label: 'Il primo enigma',
        description: 'Risolvi un puzzle',
        type: 'puzzleSolved', match: {}, target: 1,
        reward: { credits: 150 }
    },
    {
        id: 'puzzle-quattro', sezione: 'modalita', modalita: 'puzzle',
        icon: '🧠', label: 'Mente da duellante',
        description: 'Risolvi 4 puzzle diversi',
        type: 'puzzleSolved', match: {}, target: 4,
        reward: { credits: 350 }
    },
    {
        id: 'puzzle-tutti', sezione: 'modalita', modalita: 'puzzle',
        icon: '🔺', label: 'Il Puzzle completato',
        description: 'Risolvi tutti i puzzle',
        type: 'puzzleSolved', match: {}, target: 12,
        reward: { credits: 700 }
    },
    {
        id: 'puzzle-tre-stelle', sezione: 'modalita', modalita: 'puzzle',
        icon: '⭐', label: 'Al primo colpo',
        description: 'Risolvi un puzzle al primo tentativo (tre stelle)',
        type: 'puzzleThreeStars', match: {}, target: 1,
        reward: { credits: 200 }
    },
    {
        id: 'puzzle-tre-stelle-tutti', sezione: 'modalita', modalita: 'puzzle',
        icon: '🌟', label: 'Nessun errore',
        description: 'Porta tutti i puzzle a tre stelle',
        type: 'puzzleThreeStars', match: {}, target: 12,
        reward: { credits: 900 }
    },

    // Rivincite (js/modes/rivincita-mode.js):
    //   'rivincitaWon'  una MEDAGLIA nuova, cioè una Rivincita vinta per la
    //                   prima volta a un certo livello (match: { rivincitaId,
    //                   difficulty }, o {} per "una qualsiasi"). Rivincere lo
    //                   stesso duello allo stesso livello non conta di nuovo.
    // Le medaglie in tutto sono 3 per ogni voce di js/data/rivincite-db.js
    // (10 voci, quindi 30): aggiungendo Rivincite vanno alzati i traguardi
    // "tutte", e lo spec modalita-rivincite lo controlla.
    {
        id: 'rivincita-prima', sezione: 'modalita', modalita: 'rivincite',
        icon: '⚔️', label: 'Nei loro panni',
        description: 'Vinci una Rivincita',
        type: 'rivincitaWon', match: {}, target: 1,
        reward: { credits: 150 }
    },
    {
        id: 'rivincita-dieci-medaglie', sezione: 'modalita', modalita: 'rivincite',
        icon: '🏅', label: 'Collezione di medaglie',
        description: 'Ottieni 10 medaglie nelle Rivincite (una per Rivincita e livello)',
        type: 'rivincitaWon', match: {}, target: 10,
        reward: { credits: 450 }
    },
    {
        id: 'rivincita-difficile', sezione: 'modalita', modalita: 'rivincite',
        icon: '🥇', label: 'Come nell\'anime',
        description: 'Vinci una Rivincita a livello Difficile',
        type: 'rivincitaWon', match: { difficulty: 'Difficile' }, target: 1,
        reward: { credits: 300 }
    },
    {
        id: 'rivincita-tutte-difficile', sezione: 'modalita', modalita: 'rivincite',
        icon: '👑', label: 'La storia riscritta',
        description: 'Vinci tutte le Rivincite a livello Difficile',
        type: 'rivincitaWon', match: { difficulty: 'Difficile' }, target: 10,
        reward: { credits: 1000 }
    },
    {
        id: 'rivincita-tutte-medaglie', sezione: 'modalita', modalita: 'rivincite',
        icon: '🏆', label: 'Ogni duello, ogni livello',
        description: 'Ottieni tutte le medaglie delle Rivincite',
        type: 'rivincitaWon', match: {}, target: 30,
        reward: { credits: 1400 }
    },

    // Torre dei Duellanti (js/modes/torre.js, torre-mode.js):
    //   'torreFloor'      un piano vinto in una scalata (match: { piano });
    //   'torreBoss'       un boss battuto (match: { piano } o {});
    //   'torreCompleted'  la Torre conquistata, tutti i piani in una scalata.
    {
        id: 'torre-piano-5', sezione: 'modalita', modalita: 'torre',
        icon: '🗼', label: 'Il primo boss',
        description: 'Supera il piano 5 della Torre dei Duellanti',
        type: 'torreFloor', match: { piano: 5 }, target: 1,
        reward: { credits: 200 }
    },
    {
        id: 'torre-piano-10', sezione: 'modalita', modalita: 'torre',
        icon: '🗼', label: 'A metà della Torre',
        description: 'Supera il piano 10 della Torre dei Duellanti',
        type: 'torreFloor', match: { piano: 10 }, target: 1,
        reward: { credits: 450 }
    },
    {
        id: 'torre-piano-15', sezione: 'modalita', modalita: 'torre',
        icon: '🌑', label: 'Oltre le Ombre',
        description: 'Supera il piano 15 della Torre dei Duellanti',
        type: 'torreFloor', match: { piano: 15 }, target: 1,
        reward: { credits: 750 }
    },
    {
        id: 'torre-boss-10', sezione: 'modalita', modalita: 'torre',
        icon: '👑', label: 'Cacciatore di boss',
        description: 'Batti 10 boss della Torre, in qualunque scalata',
        type: 'torreBoss', match: {}, target: 10,
        reward: { credits: 800 }
    },
    {
        id: 'torre-conquistata', sezione: 'modalita', modalita: 'torre',
        icon: '🏔️', label: 'In cima alla Torre',
        description: 'Conquista la Torre dei Duellanti: tutti i piani in una sola scalata',
        type: 'torreCompleted', match: {}, target: 1,
        reward: { credits: 1500 }
    },
    {
        id: 'torre-conquistata-3', sezione: 'modalita', modalita: 'torre',
        icon: '🏆', label: 'Re della Torre',
        description: 'Conquista la Torre dei Duellanti 3 volte',
        type: 'torreCompleted', match: {}, target: 3,
        reward: { credits: 2500 }
    }
];

window.challengesDatabase = challengesDatabase;
