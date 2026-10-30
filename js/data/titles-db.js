// @ts-check
/**
 * titles-db.js — I TITOLI SPECIALI del duellante (Profilo, js/ui/profile-hero.js).
 * =====================================================================
 * Il Profilo ha due tipi di titolo:
 *  - la SCALA, da "Duellante novizio" in su, che sale coi punti (vittorie,
 *    tornei, storie) ed è definita in profile-hero.js;
 *  - questi, i titoli SPECIALI: ognuno premia una cosa precisa fatta nel
 *    gioco ("Faraone Supremo" per chi ha finito la storia del Regno delle
 *    Ombre a Difficile) e il giocatore sceglie quale mostrare sotto il nome.
 *
 * COME SI SBLOCCANO. Mai da uno stato che si può azzerare: "Ricomincia" in
 * una storia rimette `finita` a falso, e un titolo che sparisce al primo
 * "Ricomincia" non sarebbe un titolo. Ogni condizione guarda quindi le SFIDE
 * (js/data/challenges-db.js), che una volta completate lo restano per sempre
 * (`save.challenges[id].completed`). Per avere un titolo nuovo basta che
 * esista una Sfida che dice la stessa cosa — e se non esiste si scrive prima
 * lei, così il traguardo compare anche nella pagina Sfide.
 *
 * `richiede` ha UNA di queste forme:
 *   { sfide: ['id', ...] }                    tutte quelle Sfide completate
 *   { prefisso: 'defeat-', almeno: 15 }       almeno N Sfide il cui id comincia così
 *   { prefisso: 'defeat-', tutte: true }      TUTTE le Sfide con quel prefisso
 *
 * Un `id` di titolo si salva (save.player.titoloScelto): una volta dato non
 * si cambia né si riusa per altro. `come` è la frase che il Profilo scrive
 * sotto un titolo ancora bloccato: deve dire cosa fare, non solo il nome.
 */
const titoliSpecialiDatabase = [
    // --- Il Regno delle Ombre (la storia dell'anime) -------------------
    { id: 't-anime-fine', gruppo: 'Storie', nome: 'Erede del Puzzle', come: 'Completa la storia del Regno delle Ombre',
        richiede: { sfide: ['storia-anime-fine'] } },
    { id: 't-anime-normale', gruppo: 'Storie', nome: 'Custode del Millennio', come: 'Completa la storia del Regno delle Ombre a Normale',
        richiede: { sfide: ['storia-anime-normale'] } },
    { id: 't-anime-difficile', gruppo: 'Storie', nome: 'Faraone Supremo', come: 'Completa la storia del Regno delle Ombre a Difficile',
        richiede: { sfide: ['storia-anime-difficile'] } },
    { id: 't-anime-tutti', gruppo: 'Storie', nome: 'Signore delle Ombre', come: 'Completa il Regno delle Ombre a tutti e tre i livelli',
        richiede: { sfide: ['storia-anime-tre-livelli'] } },

    // --- Memorie Proibite ---------------------------------------------
    { id: 't-fm-fine', gruppo: 'Storie', nome: 'Apprendista Stregone', come: 'Completa Memorie Proibite',
        richiede: { sfide: ['storia-fm-fine'] } },
    { id: 't-fm-normale', gruppo: 'Storie', nome: 'Guardiano dei Santuari', come: 'Completa Memorie Proibite a Normale',
        richiede: { sfide: ['storia-forbiddenMemories-normale'] } },
    { id: 't-fm-difficile', gruppo: 'Storie', nome: 'Gran Maestro del Labirinto', come: 'Completa Memorie Proibite a Difficile',
        richiede: { sfide: ['storia-forbiddenMemories-difficile'] } },
    { id: 't-fm-tutti', gruppo: 'Storie', nome: 'Arcimago Antico', come: 'Completa Memorie Proibite a tutti e tre i livelli',
        richiede: { sfide: ['storia-forbiddenMemories-tre-livelli'] } },

    // --- Freedom: La Corona del Millennio ------------------------------
    { id: 't-freedom-fine', gruppo: 'Storie', nome: 'Esploratore della Corona', come: 'Completa Freedom: La Corona del Millennio',
        richiede: { sfide: ['storia-freedom-fine'] } },
    { id: 't-freedom-normale', gruppo: 'Storie', nome: 'Custode della Corona', come: 'Completa Freedom a Normale',
        richiede: { sfide: ['storia-freedom-normale'] } },
    { id: 't-freedom-difficile', gruppo: 'Storie', nome: 'Signore della Corona', come: 'Completa Freedom a Difficile',
        richiede: { sfide: ['storia-freedom-difficile'] } },
    { id: 't-freedom-tutti', gruppo: 'Storie', nome: 'Re del Millennio', come: 'Completa Freedom a tutti e tre i livelli',
        richiede: { sfide: ['storia-freedom-tre-livelli'] } },

    // --- Grande Guerra (senza livelli) ---------------------------------
    { id: 't-ww1-piave', gruppo: 'Storie', nome: 'Soldato del Piave', come: 'Arriva al Piave nella Grande Guerra',
        richiede: { sfide: ['storia-ww1-piave'] } },
    { id: 't-ww1-fine', gruppo: 'Storie', nome: 'Eroe di Vittorio Veneto', come: 'Completa la Grande Guerra',
        richiede: { sfide: ['storia-ww1-fine'] } },

    // --- Tornei ---------------------------------------------------------
    { id: 't-torneo-regno', gruppo: 'Tornei', nome: 'Campione del Regno dei Duellanti', come: 'Porta a termine il torneo del Regno dei Duellanti',
        richiede: { sfide: ['tournament-duelistKingdom-1'] } },
    { id: 't-torneo-battlecity', gruppo: 'Tornei', nome: 'Campione di Battle City', come: 'Porta a termine il torneo di Battle City',
        richiede: { sfide: ['tournament-battleCity-1'] } },
    { id: 't-torneo-kaiba', gruppo: 'Tornei', nome: 'Vincitore del Torneo Kaiba', come: 'Porta a termine il torneo di Kaiba',
        richiede: { sfide: ['tournament-kaiba-1'] } },
    { id: 't-torneo-tre', gruppo: 'Tornei', nome: 'Trionfatore dei Tre Tornei', come: 'Porta a termine tutti e tre i tornei',
        richiede: { sfide: ['tournament-duelistKingdom-1', 'tournament-battleCity-1', 'tournament-kaiba-1'] } },
    { id: 't-torneo-veterano', gruppo: 'Tornei', nome: 'Veterano dei Tornei', come: 'Porta a termine 15 tornei',
        richiede: { sfide: ['tournament-any-15'] } },
    { id: 't-torneo-imperatore', gruppo: 'Tornei', nome: 'Imperatore dei Tornei', come: 'Porta a termine 30 tornei',
        richiede: { sfide: ['tournament-any-30'] } },

    // --- Modalità: Torre, Puzzle, Rivincite ----------------------------
    { id: 't-torre-10', gruppo: 'Modalità', nome: 'Scalatore della Torre', come: 'Raggiungi il piano 10 della Torre dei Duellanti',
        richiede: { sfide: ['torre-piano-10'] } },
    { id: 't-torre-fine', gruppo: 'Modalità', nome: 'Conquistatore della Torre', come: 'Conquista la Torre dei Duellanti',
        richiede: { sfide: ['torre-conquistata'] } },
    { id: 't-torre-tre', gruppo: 'Modalità', nome: 'Sovrano della Torre', come: 'Conquista la Torre 3 volte',
        richiede: { sfide: ['torre-conquistata-3'] } },
    { id: 't-puzzle-tutti', gruppo: 'Modalità', nome: 'Risolutore di Enigmi', come: 'Risolvi tutti i Puzzle',
        richiede: { sfide: ['puzzle-tutti'] } },
    { id: 't-puzzle-perfetto', gruppo: 'Modalità', nome: 'Mente Perfetta', come: 'Risolvi tutti i Puzzle con tre stelle',
        richiede: { sfide: ['puzzle-tre-stelle-tutti'] } },
    { id: 't-rivincite-tutte', gruppo: 'Modalità', nome: 'Collezionista di Rivincite', come: 'Ottieni tutte le medaglie delle Rivincite',
        richiede: { sfide: ['rivincita-tutte-medaglie'] } },
    { id: 't-rivincite-difficili', gruppo: 'Modalità', nome: 'Vendicatore Implacabile', come: 'Vinci dieci Rivincite a Difficile',
        richiede: { sfide: ['rivincita-tutte-difficile'] } },

    // --- Modalità a rotazione: Duello della Settimana e Caccia al Boss ---
    { id: 't-settimana-5', gruppo: 'Modalità', nome: 'Fedele alla Regola', come: 'Vinci 5 Duelli della Settimana',
        richiede: { sfide: ['settimana-cinque'] } },
    { id: 't-settimana-20', gruppo: 'Modalità', nome: 'Custode delle Regole', come: 'Vinci 20 Duelli della Settimana',
        richiede: { sfide: ['settimana-venti'] } },
    { id: 't-settimana-tripletta', gruppo: 'Modalità', nome: 'Maestro della Settimana', come: 'Prendi i premi di tutti e 3 i livelli nella stessa settimana',
        richiede: { sfide: ['settimana-tutti-i-livelli'] } },
    { id: 't-caccia-1', gruppo: 'Modalità', nome: 'Cacciatore di Boss', come: 'Sconfiggi un Boss nella Caccia al Boss',
        richiede: { sfide: ['caccia-prima'] } },
    { id: 't-caccia-veloce', gruppo: 'Modalità', nome: 'Cacciatore Fulmineo', come: 'Sconfiggi un Boss entro 5 turni',
        richiede: { sfide: ['caccia-veloce'] } },
    { id: 't-caccia-10', gruppo: 'Modalità', nome: 'Cacciatore Leggendario', come: 'Sconfiggi 10 Boss nella Caccia al Boss',
        richiede: { sfide: ['caccia-dieci'] } },

    // --- Traguardi di gioco --------------------------------------------
    { id: 't-vittorie-100', gruppo: 'Traguardi', nome: 'Centurione', come: 'Vinci 100 Duelli',
        richiede: { sfide: ['win-100'] } },
    { id: 't-vittorie-500', gruppo: 'Traguardi', nome: 'Immortale dell\'Arena', come: 'Vinci 500 Duelli',
        richiede: { sfide: ['win-500'] } },
    { id: 't-perfette-20', gruppo: 'Traguardi', nome: 'Senza Macchia', come: 'Vinci 20 Duelli senza perdere un Life Point',
        richiede: { sfide: ['perfect-win-20'] } },
    { id: 't-perfette-50', gruppo: 'Traguardi', nome: 'Intoccabile', come: 'Vinci 50 Duelli senza perdere un Life Point',
        richiede: { sfide: ['perfect-win-50'] } },
    { id: 't-exodia', gruppo: 'Traguardi', nome: 'Il Proibito', come: 'Vinci assemblando Exodia',
        richiede: { sfide: ['win-exodia-1'] } },
    { id: 't-destino', gruppo: 'Traguardi', nome: 'Il Destino Compiuto', come: 'Vinci con Destiny Board',
        richiede: { sfide: ['win-destiny-board-1'] } },
    { id: 't-elefante', gruppo: 'Traguardi', nome: 'Domatore di Elefanti Volanti', come: 'Vinci con l\'Elefante Volante',
        richiede: { sfide: ['win-flying-elephant-1'] } },
    { id: 't-istantanee', gruppo: 'Traguardi', nome: 'Vincitore Istantaneo', come: 'Vinci 10 volte con una vittoria speciale',
        richiede: { sfide: ['win-instantly-10'] } },
    { id: 't-dei', gruppo: 'Traguardi', nome: 'Evocatore degli Dei', come: 'Evoca tutti e tre i Dei Egizi',
        richiede: { sfide: ['summon-three-gods'] } },
    { id: 't-oggetti', gruppo: 'Traguardi', nome: 'Portatore del Millennio', come: 'Ottieni tutti e tre gli Oggetti del Millennio',
        richiede: { sfide: ['item-all-three'] } },

    // --- Duellanti battuti ---------------------------------------------
    { id: 't-rivale-kaiba', gruppo: 'Duellanti', nome: 'Rivale di Kaiba', come: 'Sconfiggi Seto Kaiba 10 volte',
        richiede: { sfide: ['defeat-kaiba-10'] } },
    { id: 't-sfidante-faraone', gruppo: 'Duellanti', nome: 'Sfidante del Faraone', come: 'Sconfiggi Yami Yugi 10 volte',
        richiede: { sfide: ['defeat-yamiYugi-10'] } },
    { id: 't-nemesi-kaiba', gruppo: 'Duellanti', nome: 'Nemesi di Kaiba', come: 'Sconfiggi Kaiba 100 volte a Difficile',
        richiede: { sfide: ['carta-kaiba-drago-bianco-100'] } },
    { id: 't-cacciatore', gruppo: 'Duellanti', nome: 'Cacciatore di Duellanti', come: 'Completa 15 Sfide "Sconfiggi" contro Duellanti diversi',
        richiede: { prefisso: 'defeat-', almeno: 15 } },
    { id: 't-definitivo', gruppo: 'Duellanti', nome: 'Il Duellante Definitivo', come: 'Completa tutte le Sfide "Sconfiggi" contro i Duellanti',
        richiede: { prefisso: 'defeat-', tutte: true } }
];

/** @type {any} */ (window).titoliSpecialiDatabase = titoliSpecialiDatabase;
