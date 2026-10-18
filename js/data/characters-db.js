/**
 * characters-db.js — Database dei Duellanti sfidabili in "Duello Libero"
 * ------------------------------------------------------------------
 * Ogni personaggio ha un nome, un titolo/soprannome, un'immagine
 * (con fallback grafico se il file manca, stessa convenzione già usata
 * per le immagini delle carte in game-flow.js) e una "series", che dice
 * da quale gioco/saga viene:
 *   'main'             — l'anime originale (Duelist Kingdom, Battle City)
 *   'forbiddenMemories' — il videogioco PS1 "Yu-Gi-Oh! Forbidden Memories"
 *   'extra'            — fuori-canone/fan-made (es. l'easter egg Giacobbo)
 *   'special'          — avversari speciali che non appartengono a una
 *                         saga vera e propria (es. "Te Stesso")
 *
 * Il record vittorie/sconfitte vive nel salvataggio unificato del
 * giocatore (vedi js/save-manager.js), così resta persistente tra una
 * sessione e l'altra insieme a nome giocatore e deck.
 *
 * `duelTrack` (facoltativo) — il TEMA DI DUELLO del personaggio: quando
 * lo si affronta suona sempre quello, in qualunque torneo e a qualunque
 * turno, invece della traccia prevista per quella fase. Richiesta
 * esplicita dell'utente per Kaiba ("nei tornei voglio che abbia sempre la
 * sua musica di duello"), estesa a Pegasus che era già trattato allo
 * stesso modo in due tornei su tre.
 *
 * `duelTrackSempre: true` (facoltativo, insieme a `duelTrack`) — il tema
 * vale in OGNI duello di Torneo e di Storia contro quel personaggio, e
 * vince su qualunque musica richiesta dall'URL (tappa della Storia,
 * torneo): lo applica la pagina del duello stessa (duelMonstersCore.html).
 * NON in Duello Libero, dove la musica la sceglie il giocatore nel menu.
 * Senza questo flag `duelTrack` lo leggono solo le pagine dei tornei.
 * Richiesta esplicita dell'utente per i due Yugi ("usalo sempre se
 * l'avversario è un Yugi qualsiasi", poi "in duello libero no").
 *
 * `duelTrackAutomatico: true` estende lo stesso principio a tutti i modi
 * senza scelta musicale (Storia, Tornei, Torre, Rivincite e Puzzle). Non
 * prevale mai in Duello Libero, Sandbox o Multiplayer. Una rara eccezione
 * narrativa si dichiara in `duelTrackEscludiTappe`.
 *
 * Sta QUI, nell'anagrafica, e non nelle pagine dei tornei come le
 * battute: una battuta cambia col contesto (lo stesso personaggio parla
 * diversamente al Cancello del Castello e in cima alla Torre Kaiba), il
 * tema musicale no — è del personaggio, e prima viveva copiato in tre
 * file con tre valori diversi fra loro.
 */
const characterDatabase = [
    // ===== PRIMA SERIE — ordine scelto esplicitamente dall'utente, non
    // raggruppato per arco narrativo (Duelist Kingdom/Battle City/amici di
    // Domino City come prima): non modificare quest'ordine senza una
    // richiesta esplicita, è come l'utente vuole che appaia il roster. =====
    { id: 'yugiMuto', name: 'Yugi Muto', title: 'Il Re dei Giochi', image: 'images/characters/yugiMuto.jpg', series: 'main', duelTrack: "59. King of Games - Yugi's Final Duel.mp3", duelTrackSempre: true },
    { id: 'solomonMuto', name: 'Solomon Muto', title: 'Il Nonno Collezionista', image: 'images/characters/solomonMuto.jpg', series: 'main' },
    { id: 'tea', name: 'Téa Gardner', title: "La Voce dell'Amicizia", image: 'images/characters/teaGardner.jpg', series: 'main' },
    { id: 'joey', name: 'Joey Wheeler', title: 'Il Duellante di Strada', image: 'images/characters/joeyWheeler.jpg', series: 'main' },
    { id: 'yamiYugi', name: 'Yami Yugi', title: 'Il Faraone', image: 'images/characters/yamiYugi.jpg', series: 'main', duelTrack: "59. King of Games - Yugi's Final Duel.mp3", duelTrackSempre: true },
    { id: 'kaiba', name: 'Seto Kaiba', title: 'Presidente della Kaiba Corporation', image: 'images/characters/setoKaiba.jpg', series: 'main', duelTrack: '32. Seto Kaiba (Tournament Final).mp3' },
    { id: 'rex', name: 'Rex Raptor', title: 'Domatore di Dinosauri', image: 'images/characters/rexRaptor.jpg', series: 'main' },
    { id: 'weevil', name: 'Weevil Underwood', title: 'Maestro degli Insetti', image: 'images/characters/weevilUnderwood.jpg', series: 'main' },
    { id: 'mako', name: 'Mako Tsunami', title: 'Il Duellante dei Mari', image: 'images/characters/makoTsunami.jpg', series: 'main' },
    { id: 'panik', name: 'Panik', title: 'L\'Illusionista di Pegasus', image: 'images/characters/panik.jpg', series: 'main' },
    { id: 'bonz', name: 'Bonz', title: 'La Guida del Cimitero', image: 'images/characters/bonz.jpg', series: 'main' },
    { id: 'paradoxBrothers', name: 'Fratelli Paradosso', title: 'I Guardiani del Labirinto', image: 'images/characters/paradoxBrothers.jpg', series: 'main' },
    { id: 'mai', name: 'Mai Valentine', title: 'La Regina delle Trappole', image: 'images/characters/maiValentine.jpg', series: 'main' },
    { id: 'bandit_keith', name: 'Bandit Keith', title: 'Il Duellante Imbroglione', image: 'images/characters/banditKeith.jpg', series: 'main' },
    { id: 'pegasus', name: 'Maximillion Pegasus', title: 'Creatore del Duel Monsters', image: 'images/characters/maximillionPegasus.jpg', series: 'main', duelTrack: '57. Duel of Shadows – The Millennium Mind.mp3', duelTrackAutomatico: true, duelTrackEscludiTappe: ['anime-1-pegasus-video'] },
    { id: 'tristan', name: 'Tristan Taylor', title: "L'Amico Leale", image: 'images/characters/tristanTaylor.jpg', series: 'main' },
    { id: 'serenity', name: 'Serenity Wheeler', title: 'La Sorella di Joey', image: 'images/characters/serenityWheeler.jpg', series: 'main' },
    { id: 'duke', name: 'Duke Devlin', title: 'Il Creatore di Dungeon Dice Monsters', image: 'images/characters/dukeDevlin.jpg', series: 'main' },
    { id: 'espaRoba', name: 'Espa Roba', title: 'Il Duellante Psichico', image: 'images/characters/espaRoba.jpg', series: 'main' },
    { id: 'arkana', name: 'Arkana', title: 'Il Prestigiatore Oscuro', image: 'images/characters/arkana.jpg', series: 'main' },
    // Rare Hunters di Battle City. I ritratti sono placeholder intenzionali:
    // il renderer mostra il fallback finché i quattro JPG non saranno aggiunti.
    { id: 'seeker', name: 'Seeker', title: 'Il Cacciatore di Exodia', image: 'images/characters/seeker.jpg', series: 'main' },
    { id: 'strings', name: 'Strings', title: 'Il Burattino Silenzioso', image: 'images/characters/strings.jpg', series: 'main' },
    { id: 'lumis', name: 'Lumis', title: 'La Maschera della Luce', image: 'images/characters/lumis.jpg', series: 'main' },
    { id: 'umbra', name: 'Umbra', title: "La Maschera dell'Oscurità", image: 'images/characters/umbra.jpg', series: 'main' },
    { id: 'bakura', name: 'Ryo Bakura', title: 'Il Duellante Oscuro', image: 'images/characters/yamiBakura.jpg', series: 'main' },
    { id: 'ishizu', name: 'Ishizu Ishtar', title: 'Guardiana della collana del millennio', image: 'images/characters/ishizuIshtar.jpg', series: 'main' },
    { id: 'odion', name: 'Odion', title: 'Il Guardiano di Marik', image: 'images/characters/odion.jpg', series: 'main' },
    { id: 'marik', name: 'Marik Ishtar', title: 'Il Padrone delle Ombre', image: 'images/characters/yamiMarik.jpg', series: 'main', duelTrack: '58. Yugi vs. Marik – Wrath of the Shadow Realm.mp3', duelTrackAutomatico: true },
    // --- Il Mondo Virtuale (dopo Battle City Parte 1) ---
    // Noah, Gozaburo e i Big Five: erano l'unico pezzo della prima serie
    // senza nessuno da affrontare, e infatti la campagna si fermava a
    // Battle City. RIMOSSI da questo elenco Dartz/Alister/Valon/Rafael
    // (Il Risveglio dei Draghi) e Zigfried/Leon (il Gran Premio KC): pur
    // essendo andati in onda nella stessa serie giapponese, l'utente ha
    // chiesto esplicitamente che la Storia restasse SOLO il percorso
    // Regno dei Duellanti → Battle City I → Mondo Virtuale → Battle City
    // II → viaggio nel passato — vedi js/data/story-campaigns.js. Non
    // avendo più nessuna tappa che li usi, quei sei personaggi sono stati
    // tolti anche da qui: lasciarli nel roster di Duello Libero senza che
    // nessuna Storia/Torneo li rendesse più sbloccabili li avrebbe
    // condannati a restare bloccati per sempre (vedi
    // js/data/character-unlocks.js: si sblocca SOLO vincendo in un
    // Torneo o nella Storia).
    { id: 'noah', name: 'Noah Kaiba', title: 'Il Ragazzo del Mondo Virtuale', image: 'images/characters/noah.jpg', series: 'main' },
    { id: 'gansley', name: 'Gansley', title: 'Il Burattinaio della Rete', image: 'images/characters/gansley.jpg', series: 'main' },
    { id: 'johnson', name: 'Johnson', title: "Il Cacciatore della Giungla Virtuale", image: 'images/characters/johnson.jpg', series: 'main' },
    { id: 'nesbitt', name: 'Nesbitt', title: 'La Furia del Cantiere', image: 'images/characters/nesbitt.jpg', series: 'main' },
    { id: 'crump', name: 'Crump', title: "La Linea di Montaggio", image: 'images/characters/crump.jpg', series: 'main' },
    { id: 'lector', name: 'Lector', title: "L'Illusionista dei Cinque", image: 'images/characters/lector.jpg', series: 'main' },
    { id: 'gozaburo', name: 'Gozaburo Kaiba', title: 'Il Padrone della KaibaCorp', image: 'images/characters/gozaburo.jpg', series: 'main' },
    // ===== Yu-Gi-Oh! Forbidden Memories (PS1, 2002) =====
    // L'antico Egitto e il torneo moderno del videogioco: personaggi
    // esclusivi di questo gioco (le controparti dell'antico Egitto di
    // Yugi/Joey/Téa/Kaiba si chiamano Atem/Jono/Teana/Sacerdote Seto), più
    // il cast originale della sua trama (Simon Muran, Heishin, DarkNite) e
    // i guardiani del dungeon del Labirinto (i Maghi elementali/Sebek/Neku,
    // vedi il blocco qui sotto). "Duel Master K" è stato rimosso da questo
    // elenco su richiesta esplicita dell'utente.
    { id: 'simonMuran', name: 'Simon Muran', title: 'Il Tutore del Principe', image: 'images/characters/simonMuran.jpg', series: 'forbiddenMemories' },
    { id: 'jono', name: 'Jono', title: 'L\'Amico d\'Infanzia del Principe', image: 'images/characters/jono.jpg', series: 'forbiddenMemories' },
    { id: 'teana', name: 'Teana', title: 'L\'Amica d\'Infanzia del Principe', image: 'images/characters/teana.jpg', series: 'forbiddenMemories' },
    { id: 'priestSeto', name: 'Sacerdote Seto', title: 'Il Sommo Sacerdote', image: 'images/characters/priestSeto.jpg', series: 'forbiddenMemories' },
    { id: 'shadi', name: 'Shadi', title: 'Il Guardiano dell\'Equilibrio', image: 'images/characters/shadi.jpg', series: 'forbiddenMemories' },
    { id: 'priestessIsis', name: 'Sacerdotessa Isis', title: 'La Veggente della collana del millennio', image: 'images/characters/priestessIsis.jpg', series: 'forbiddenMemories' },
    // Mage Soldier: il soldato-mago di Heishin che il principe affronta per
    // primo al ritorno in Egitto. Il ritratto è un segnaposto a tema, allo
    // stesso nome di file che userà quello vero.
    { id: 'mageSoldier', name: 'Mage Soldier', title: 'Il Soldato-Mago di Heishin', image: 'images/characters/mageSoldier.jpg', series: 'forbiddenMemories' },
    // I 7 Maghi elementali del Labirinto (+ Sebek e Neku): i guardiani del
    // dungeon di Forbidden Memories tra il Cancello e i veri boss finali
    // qui sotto — richiesti esplicitamente dall'utente, posizionati subito
    // dopo Sacerdotessa Isis e prima di Heishin. Nessuna immagine reale
    // ancora disponibile per questi 13 (stesso caso già esistente per
    // "Duel Master K" prima di essere rimosso da questo elenco — vedi
    // js/data/character-decks.js): il gioco ricade già da solo su
    // un'icona generica quando il file non esiste, nessun problema.
    { id: 'oceanMage', name: 'Ocean Mage', title: 'Il Mago dell\'Oceano', image: 'images/characters/oceanMage.jpg', series: 'forbiddenMemories' },
    { id: 'highMageSecmeton', name: 'High Mage Secmeton', title: 'Il Sommo Mago dei Mari', image: 'images/characters/highMageSecmeton.jpg', series: 'forbiddenMemories' },
    { id: 'forestMage', name: 'Forest Mage', title: 'Il Mago della Foresta', image: 'images/characters/forestMage.jpg', series: 'forbiddenMemories' },
    { id: 'highMageAnubisius', name: 'High Mage Anubisius', title: 'Il Sommo Mago delle Tombe', image: 'images/characters/highMageAnubisius.jpg', series: 'forbiddenMemories' },
    { id: 'mountainMage', name: 'Mountain Mage', title: 'Il Mago della Montagna', image: 'images/characters/mountainMage.jpg', series: 'forbiddenMemories' },
    { id: 'highMageAtenza', name: 'High Mage Atenza', title: 'Il Sommo Mago dei Draghi', image: 'images/characters/highMageAtenza.jpg', series: 'forbiddenMemories' },
    { id: 'desertMage', name: 'Desert Mage', title: 'Il Mago del Deserto', image: 'images/characters/desertMage.jpg', series: 'forbiddenMemories' },
    { id: 'highMageMartis', name: 'High Mage Martis', title: 'Il Sommo Mago delle Rovine', image: 'images/characters/highMageMartis.jpg', series: 'forbiddenMemories' },
    { id: 'meadowMage', name: 'Meadow Mage', title: 'Il Mago del Prato', image: 'images/characters/meadowMage.jpg', series: 'forbiddenMemories' },
    { id: 'highMageKepura', name: 'High Mage Kepura', title: 'Il Sommo Mago della Luce', image: 'images/characters/highMageKepura.jpg', series: 'forbiddenMemories' },
    { id: 'labyrinthMage', name: 'Labyrinth Mage', title: 'Il Mago del Labirinto', image: 'images/characters/labyrinthMage.jpg', series: 'forbiddenMemories' },
    { id: 'sebek', name: 'Sebek', title: 'Il Guardiano Coccodrillo', image: 'images/characters/sebek.jpg', series: 'forbiddenMemories' },
    { id: 'neku', name: 'Neku', title: 'L\'Ultimo Guardiano', image: 'images/characters/neku.jpg', series: 'forbiddenMemories' },
    { id: 'heishin', name: 'Heishin', title: 'L\'Usurpatore del Trono', image: 'images/characters/heishin.jpg', series: 'forbiddenMemories', duelTrack: '57. Duel of Shadows – The Millennium Mind.mp3', duelTrackAutomatico: true },
    { id: 'darkNite', name: 'DarkNite', title: 'Lo Spirito di Nitemare', image: 'images/characters/darkNite.jpg', series: 'forbiddenMemories', duelTrack: '58. Yugi vs. Marik – Wrath of the Shadow Realm.mp3', duelTrackAutomatico: true },
    { id: 'nitemare', name: 'Nitemare', title: 'L\'Incubo Finale', image: 'images/characters/nitemare.jpg', series: 'forbiddenMemories', duelTrack: '58. Yugi vs. Marik – Wrath of the Shadow Realm.mp3', duelTrackAutomatico: true },
    // "Te Stesso": un avversario speciale che dà il tuo stesso deck salvato
    // al bot, invece di un mazzo a tema fisso — vedi resetGameState() in
    // js/engine/game-flow.js, che riconosce questo id come caso speciale.
    { id: 'mirror', name: 'Te Stesso', title: 'Il Tuo Riflesso', image: 'images/characters/mirror.jpg', series: 'main' },
    { id: 'robertoGiacobbo', name: 'Roberto Giacobbo I', title: 'Divinità egizia', image: 'images/characters/rg.jpg', series: 'extra' },
    { id: 'albertoAngela', name: 'Imperator Alberto Angela', title: 'Signore dell\'Eterna Roma', image: 'images/characters/albertoAngela.jpg', series: 'extra' },
    { id: 'alessandroBarbero', name: 'Ser Alessandro Barbero', title: 'Maestro delle Cronache', image: 'images/characters/alessandroBarbero.jpg', series: 'extra' },

    // ===== Grande Guerra — comandi austro-ungarici =====
    // Gli avversari della campagna WW1 (js/data/story-campaigns.js). Sono
    // qui e non in un file a parte perché il roster è uno solo: Modalità
    // Storia, Duello Libero e Sfide leggono tutti da qui, e un secondo
    // elenco parallelo finirebbe per divergere.
    //
    // Non hanno ancora un ritratto sotto images/characters/: la mappa e il
    // duello ricadono da soli sull'icona quando l'immagine manca, quindi
    // aggiungerne uno dopo non richiede di toccare nient'altro.
    { id: 'ww1_boroevic', name: 'Svetozar Boroević', title: 'Il Leone dell\'Isonzo', image: 'images/characters/ww1_boroevic.jpg', series: 'ww1' },
    { id: 'ww1_conrad', name: 'Conrad von Hötzendorf', title: 'Capo di Stato Maggiore', image: 'images/characters/ww1_conrad.jpg', series: 'ww1' },
    { id: 'ww1_eugenio', name: 'Arciduca Eugenio d\'Asburgo', title: 'Comandante del Fronte Sud-Ovest', image: 'images/characters/ww1_eugenio.jpg', series: 'ww1' },
    { id: 'ww1_brumowski', name: 'Godwin von Brumowski', title: 'Asso Imperiale', image: 'images/characters/ww1_brumowski.jpg', series: 'ww1' },
    { id: 'ww1_arigi', name: 'Julius Arigi', title: 'Il Sergente Volante', image: 'images/characters/ww1_arigi.jpg', series: 'ww1' },
    { id: 'ww1_kaiserjager', name: 'Kaiserjäger Tirolese', title: 'La Guardia dell\'Imperatore', image: 'images/characters/ww1_kaiserjager.jpg', series: 'ww1' }
];

/**
 * Ritratti ALTERNATIVI di un personaggio, validi solo in un contesto: lo
 * stesso Kaiba ha un aspetto diverso nel Regno dei Duellanti e nel Torneo
 * della Kaiba Corporation di Forbidden Memories. Il contesto è l'id del
 * torneo (lo stesso di DuelSession/tournament-dialogues). Chi non è qui —
 * Duello Libero, Battle City, ogni altro torneo — usa il ritratto del
 * roster. Per la Storia lo stesso si ottiene col campo `avatar` della
 * singola tappa (js/data/story-campaigns.js).
 */
const CHARACTER_IMAGE_VARIANTS = {
    duelistKingdom: { kaiba: 'images/characters/setoKaiba_duelist_Kingdom.png' },
    kaibaTournament: { kaiba: 'images/characters/setoKaiba_forbiddenMemories.png' }
};

/** La mappa { idPersonaggio: ritratto } valida in un contesto (vuota se non ce ne sono). */
function getCharacterImageVariants(contextId) {
    return CHARACTER_IMAGE_VARIANTS[contextId] || {};
}

/**
 * Percorso della figura scontornata/pedina corrispondente a un ritratto.
 * Il nome del FILE e' la chiave (non sempre coincide con l'id del roster).
 * I ritratti pieni restano in `character.image` esclusivamente per la griglia
 * del Duello Libero; il resto dell'interfaccia passa da questa funzione.
 */
function getCharacterPawnImage(image) {
    if (!image) return null;
    if (/\/pedine\//.test(image)) return image;
    const nome = String(image).split(/[\\/]/).pop().replace(/\.[a-z0-9]+(?:\?.*)?$/i, '');
    return nome ? 'images/characters/pedine/' + nome + '.png' : null;
}

/** La pedina di un personaggio in un contesto: variante se c'è, altrimenti roster. */
function getCharacterImageFor(characterId, contextId) {
    const variante = getCharacterImageVariants(contextId)[characterId];
    if (variante) return getCharacterPawnImage(variante);
    const c = characterDatabase.find((x) => x.id === characterId);
    return getCharacterPawnImage(c && c.image);
}

function getCharacterRecord(characterId) {
    if (window.SaveManager) return SaveManager.getRecord(characterId);
    // Fallback difensivo se save-manager.js non è caricato su questa pagina.
    try {
        const raw = localStorage.getItem('duelArenaRecord_' + characterId);
        if (raw) return JSON.parse(raw);
    } catch (e) { /* noop */ }
    return { wins: 0, losses: 0 };
}

// `difficulty` (facoltativo): il livello del duello ('Facile'/'Medio'/
// 'Difficile'). Per ogni vittoria si tiene il PIÙ ALTO battuto
// (record.migliore), che il Duello Libero mostra come medaglia. Un record
// vecchio non lo ha: semplicemente niente medaglia finché non si rivince.
const LIVELLI_RECORD = ['Facile', 'Medio', 'Difficile'];
function recordCharacterResult(characterId, won, difficulty) {
    const record = getCharacterRecord(characterId);
    if (won) record.wins += 1; else record.losses += 1;
    const livello = LIVELLI_RECORD.indexOf(difficulty);
    if (won && livello !== -1 && livello > LIVELLI_RECORD.indexOf(record.migliore)) record.migliore = difficulty;
    if (window.SaveManager) {
        SaveManager.setRecord(characterId, record);
    } else {
        try {
            localStorage.setItem('duelArenaRecord_' + characterId, JSON.stringify(record));
        } catch (e) { /* noop */ }
    }
    return record;
}
