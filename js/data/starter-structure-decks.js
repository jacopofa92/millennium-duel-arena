/**
 * starter-structure-decks.js — Catalogo degli Starter Deck e Structure
 * Deck "acquistabili" (in futuro, dal Negozio — vedi negozio.html).
 * ------------------------------------------------------------------
 * Ogni voce è un mazzo precostituito di sola lettura, nello stesso
 * formato { main: [{id,qty}], extra: [{id,qty}] } dei deck dei
 * personaggi (js/data/character-decks.js) — da Creazione Deck, se posseduto,
 * può essere clonato nella propria collezione esattamente come un deck
 * di un Duellante.
 *
 * Il possesso si stabilisce acquistando dal Negozio (vedi
 * SaveManager.ownsPack/addOwnedPack in save-manager.js): nessun
 * pacchetto è posseduto di default, quindi ogni voce qui sotto compare
 * "bloccata" in Creazione Deck finché non la si compra davvero.
 *
 * SCHELETRO: questi sono i veri Starter Deck / Structure Deck usciti
 * nel TCG occidentale (nomi, codici e anno reali), ma le liste carte
 * (main/extra) sono ancora vuote apposta — le compileremo carta per
 * carta in un secondo momento. Finché main/extra restano vuoti il
 * pacchetto resta comunque "bloccato" a schermo (Main: 0 · Extra: 0),
 * quindi non c'è alcun rischio di clonare un mazzo vuoto nel frattempo.
 */
const starterStructureDeckDatabase = [
    // --- Starter Deck -------------------------------------------------
    {
        packId: 'starter_sdy_yugi',
        kind: 'starter',
        name: 'Starter Deck: Yugi (SDY)',
        year: 2002,
        // Carta stampata sul fronte della "deck box" in creazione-deck.html
        // (vedi resolveCoverCard lì): senza questo campo verrebbe scelto da
        // solo il mostro con l'ATK più alto del mazzo, che non è sempre la
        // carta SIMBOLO del personaggio — qui lo è invece per scelta
        // esplicita dell'utente.
        coverCardId: 2, // Mago Nero

        description: 'Il primo mazzo di Yugi Muto: Mago Nero ed Elfo Mistico in prima linea, pensato per chi muove i primi passi nel gioco.',
        // Lista reale delle 50 carte della versione Nord Americana (SDY-001
        // -> SDY-050, 2002) — nessun duplicato, un solo esemplare di
        // ciascuna. Verificata carta per carta contro il database di
        // questo progetto: 31 già presenti (2 con effetto corretto in
        // questa stessa sessione: Buco Trappola id 40, Rimuovi Magia id
        // 195), 19 aggiunte apposta con id 541-559.
        main: [
            { id: 391, qty: 1 }, // SDY-001 Elfo Mistico / Mystical Elf
            { id: 237, qty: 1 }, // SDY-002 Demone Selvaggio / Feral Imp
            { id: 507, qty: 1 }, // SDY-003 Drago Alato #1
            { id: 13, qty: 1 },  // SDY-004 Teschio Evocato / Summoned Skull
            { id: 109, qty: 1 }, // SDY-005 Castoro Guerriero / Beaver Warrior
            { id: 2, qty: 1 },   // SDY-006 Mago Nero / Dark Magician (Ultra Rare)
            { id: 14, qty: 1 },  // SDY-007 Gaia il Cavaliere
            { id: 15, qty: 1 },  // SDY-008 Anatema del Drago / Curse of Dragon
            { id: 4, qty: 1 },   // SDY-009 Guardiano Celtico / Celtic Guardian
            { id: 367, qty: 1 }, // SDY-010 Mammuth delle Tombe / Mammoth Graveyard
            { id: 279, qty: 1 }, // SDY-011 Mega Squalo Bianco / Great White
            { id: 444, qty: 1 }, // SDY-012 Zanna d'Argento / Silver Fang
            { id: 261, qty: 1 }, // SDY-013 Soldato di Pietra / Giant Soldier of Stone
            { id: 211, qty: 1 }, // SDY-014 Drago Zombie / Dragon Zombie
            { id: 203, qty: 1 }, // SDY-015 Doma Angelo Silente
            { id: 541, qty: 1 }, // SDY-016 Ansatsu
            { id: 542, qty: 1 }, // SDY-017 Spettro Oscuro / Witty Phantom
            { id: 543, qty: 1 }, // SDY-018 Sferra-Artigli / Claw Reacher
            { id: 544, qty: 1 }, // SDY-019 Clown Mistico / Mystic Clown
            { id: 545, qty: 1 }, // SDY-020 Spada Distruttrice
            { id: 127, qty: 1 }, // SDY-021 Libro di Arti Ascose / Book of Secret Arts
            { id: 7, qty: 1 },   // SDY-022 Buco Nero / Dark Hole
            { id: 546, qty: 1 }, // SDY-023 Dian Keto il Curatore
            { id: 93, qty: 1 },  // SDY-024 Elfo Antico / Ancient Elf
            { id: 547, qty: 1 }, // SDY-025 Fatasma Magico / Magical Ghost
            { id: 243, qty: 1 }, // SDY-026 Faglia / Fissure
            { id: 40, qty: 1 },  // SDY-027 Buco Trappola / Trap Hole
            { id: 548, qty: 1 }, // SDY-028 Duplice Attacco / Two-Pronged Attack
            { id: 195, qty: 1 }, // SDY-029 Annulla Carta Magia / De-Spell
            { id: 35, qty: 1 },  // SDY-030 Mostro Resuscitato / Monster Reborn
            { id: 549, qty: 1 }, // SDY-031 Rinforzi / Reinforcements
            { id: 147, qty: 1 }, // SDY-032 Cambiare Idea / Change of Heart
            { id: 550, qty: 1 }, // SDY-033 Il Mistico / The Stern Mystic
            { id: 54, qty: 1 },  // SDY-034 Muro Illusorio / Wall of Illusion
            { id: 551, qty: 1 }, // SDY-035 Neo lo Spadaccino Magico
            { id: 552, qty: 1 }, // SDY-036 Barone Malaspada / Baron of the Fiend Sword
            { id: 553, qty: 1 }, // SDY-037 Forziere Mangia-Uomini / Man-Eating Treasure Chest
            { id: 554, qty: 1 }, // SDY-038 Stregone dei Dannati / Sorcerer of the Doomed
            { id: 555, qty: 1 }, // SDY-039 Ultimo Desiderio / Last Will
            { id: 503, qty: 1 }, // SDY-040 Waboku
            { id: 451, qty: 1 }, // SDY-041 Scambio di Anime / Soul Exchange (Super Rare)
            { id: 138, qty: 1 }, // SDY-042 Distruggi-Carte / Card Destruction (Super Rare)
            { id: 556, qty: 1 }, // SDY-043 Maestro di Trappola / Trap Master
            { id: 206, qty: 1 }, // SDY-044 Cattura-Draghi / Dragon Capture Jar
            { id: 557, qty: 1 }, // SDY-045 Yami
            { id: 23, qty: 1 },  // SDY-046 Insetto Mangia-Uomini / Man-Eater Bug
            { id: 558, qty: 1 }, // SDY-047 Inverti Trappola / Reverse Trap
            { id: 417, qty: 1 }, // SDY-048 Rimuovi Trappola / Remove Trap
            { id: 143, qty: 1 }, // SDY-049 Mura del Castello / Castle Walls
            { id: 559, qty: 1 }  // SDY-050 Ultima Offerta / Ultimate Offering
        ],
        extra: []
    },
    {
        packId: 'starter_sdk_kaiba',
        kind: 'starter',
        name: 'Starter Deck: Kaiba (SDK)',
        year: 2002,
        coverCardId: 1, // Drago Bianco Occhi Blu (vedi coverCardId su SDY)

        description: 'Il mazzo di Seto Kaiba, costruito sulla forza bruta dei Draghi e sull\'ombra del Drago Bianco Occhi Blu.',
        // Lista reale delle 50 carte della versione Nord Americana (SDK-001
        // -> SDK-050, 2002) — nessun duplicato. Verificata carta per carta
        // (nome, ATK/DEF, testo di flavor dove disponibile) contro il
        // database di questo progetto: 26 già presenti, 22 aggiunte
        // apposta con id 560-581 (id 353 "Signore di D." già presente ma
        // con effetto ancora non implementato, come altre carte simili).
        main: [
            { id: 1, qty: 1 },   // SDK-001 Drago Bianco Occhi Blu / Blue-Eyes White Dragon
            { id: 298, qty: 1 }, // SDK-002 Gigante Hitotsu-Me / Hitotsu-Me Giant
            { id: 25, qty: 1 },  // SDK-003 Ryu Kishin
            { id: 560, qty: 1 }, // SDK-004 Verme Bestiale / The Wicked Worm Beast
            { id: 106, qty: 1 }, // SDK-005 Ascia da Guerra / Battle Ox
            { id: 331, qty: 1 }, // SDK-006 Drago Koumori / Koumori Dragon
            { id: 317, qty: 1 }, // SDK-007 Il Giudicatore / Judge Man
            { id: 424, qty: 1 }, // SDK-008 Bambola Mortale / Rogue Doll
            { id: 330, qty: 1 }, // SDK-009 Kojikocy
            { id: 561, qty: 1 }, // SDK-010 Uraby
            { id: 562, qty: 1 }, // SDK-011 Gyakutenno Megami
            { id: 389, qty: 1 }, // SDK-012 Centauro Mistico / Mystic Horseman
            { id: 563, qty: 1 }, // SDK-013 Terra il Terribile
            { id: 564, qty: 1 }, // SDK-014 Titano del Terrore
            { id: 180, qty: 1 }, // SDK-015 Assalitore Oscuro / Dark Assailant
            { id: 565, qty: 1 }, // SDK-016 Maestro ed Esperto / Master & Expert
            { id: 566, qty: 1 }, // SDK-017 Guerriero Sconosciuto / Unknown Warrior of Fiend
            { id: 544, qty: 1 }, // SDK-018 Clown Mistico / Mystic Clown
            { id: 567, qty: 1 }, // SDK-019 Orco delle Ombre Nere / Ogre of the Black Shadow
            { id: 568, qty: 1 }, // SDK-020 Energia Oscura / Dark Energy
            { id: 313, qty: 1 }, // SDK-021 Rinvigorimento / Invigoration
            { id: 7, qty: 1 },   // SDK-022 Buco Nero / Dark Hole
            { id: 570, qty: 1 }, // SDK-023 Ookazi
            { id: 428, qty: 1 }, // SDK-024 Ryu-Kishin Potenziato / Ryu-Kishin Powered
            { id: 6, qty: 1 },   // SDK-025 Spada in Agguato / Swordstalker
            { id: 335, qty: 1 }, // SDK-026 Genio della Lampada
            { id: 427, qty: 1 }, // SDK-027 Kaiser la Bestia
            { id: 571, qty: 1 }, // SDK-028 Golem Distruttore / Destroyer Golem
            { id: 572, qty: 1 }, // SDK-029 Uccello Teschio Rosso / Skull Red Bird
            { id: 573, qty: 1 }, // SDK-030 Guerriero D. Umano
            { id: 574, qty: 1 }, // SDK-031 Bestia Pallida / Pale Beast
            { id: 243, qty: 1 }, // SDK-032 Faglia / Fissure
            { id: 40, qty: 1 },  // SDK-033 Buco Trappola / Trap Hole
            { id: 548, qty: 1 }, // SDK-034 Duplice Attacco / Two-Pronged Attack
            { id: 195, qty: 1 }, // SDK-035 Annulla Carta Magia / De-Spell
            { id: 35, qty: 1 },  // SDK-036 Mostro Resuscitato / Monster Reborn
            { id: 575, qty: 1 }, // SDK-037 Spia Inesperta / The Inexperienced Spy
            { id: 549, qty: 1 }, // SDK-038 Rinforzi / Reinforcements
            { id: 576, qty: 1 }, // SDK-039 Antico Telescopio / Ancient Telescope
            { id: 577, qty: 1 }, // SDK-040 L'hai Voluto tu! / Just Desserts
            { id: 353, qty: 1 }, // SDK-041 Signore di D. / Lord of D. (già presente, effetto ancora non implementato)
            { id: 578, qty: 1 }, // SDK-042 Flauto Evoca-Draghi / The Flute of Summoning Dragon
            { id: 579, qty: 1 }, // SDK-043 Burattinaio Misterioso / Mysterious Puppeteer
            { id: 556, qty: 1 }, // SDK-044 Maestro di Trappola / Trap Master
            { id: 580, qty: 1 }, // SDK-045 Sogen
            { id: 581, qty: 1 }, // SDK-046 Hane-Hane
            { id: 558, qty: 1 }, // SDK-047 Inverti Trappola / Reverse Trap
            { id: 417, qty: 1 }, // SDK-048 Rimuovi Trappola / Remove Trap
            { id: 143, qty: 1 }, // SDK-049 Mura del Castello / Castle Walls
            { id: 559, qty: 1 }  // SDK-050 Ultima Offerta / Ultimate Offering
        ],
        extra: []
    },
    {
        packId: 'starter_sdj_joey',
        kind: 'starter',
        name: 'Starter Deck: Joey (SDJ)',
        year: 2003,
        description: 'Il mazzo di Joey Wheeler, aggressivo e diretto, con Guerrieri in prima linea e il fedele Drago Nero Occhi Rossi.',
        // Lista reale delle 50 carte della versione Nord Americana (SDJ-001
        // -> SDJ-050, 2003) — nessun duplicato. Verificata carta per carta
        // contro il database di questo progetto: 31 già presenti, 19
        // aggiunte apposta con id 582-600 (id 600 "Trappola Finta" con
        // effetto ancora non implementato, troppo trasversale per questo
        // motore). "Spadaccino Fiammeggiante" per Flame Swordsman era un
        // doppione (ex id 524) di una carta già presente (id 58, già
        // collegata all'Extra Deck): unificate, l'effetto reale mancante
        // (danno extra se distrugge in battaglia) è stato aggiunto a id 58.
        main: [
            { id: 12, qty: 1 },  // SDJ-001 Drago Nero Occhi Rossi / Red-Eyes Black Dragon
            { id: 463, qty: 1 }, // SDJ-002 Spadaccino di Landstar / Swordsman of Landstar
            { id: 27, qty: 1 },  // SDJ-003 Cucciolo di Drago / Baby Dragon
            { id: 458, qty: 1 }, // SDJ-004 Spirito dell'Arpa / Spirit of the Harp
            { id: 582, qty: 1 }, // SDJ-005 Tarta-Isola / Island Turtle
            { id: 539, qty: 1 }, // SDJ-006 Signore delle Fiamme / Flame Manipulator
            { id: 369, qty: 1 }, // SDJ-007 Masaki lo Spadaccino Leggendario
            { id: 583, qty: 1 }, // SDJ-008 Pesce dei 7 Colori / 7 Colored Fish
            { id: 98, qty: 1 },  // SDJ-009 Lucertola Corazzata / Armored Lizard
            { id: 584, qty: 1 }, // SDJ-010 Soldato di Fuoco #1 / Darkfire Soldier #1
            { id: 585, qty: 1 }, // SDJ-011 Scout del Cielo / Sky Scout
            { id: 16, qty: 1 },  // SDJ-012 Gearfried il Cavaliere di Ferro / Gearfried the Iron Knight
            { id: 586, qty: 1 }, // SDJ-013 Uomo Karate / Karate Man
            { id: 587, qty: 1 }, // SDJ-014 Milus il Raggiante
            { id: 28, qty: 1 },  // SDJ-015 Stregone del Tempo / Time Wizard
            { id: 365, qty: 1 }, // SDJ-016 Maha Vailo
            { id: 588, qty: 1 }, // SDJ-017 Mago della Fede / Magician of Faith
            { id: 589, qty: 1 }, // SDJ-018 Grande Occhio / Big Eye
            { id: 433, qty: 1 }, // SDJ-019 Sangan
            { id: 590, qty: 1 }, // SDJ-020 Principessa di Tsurugi / Princess of Tsurugi
            { id: 591, qty: 1 }, // SDJ-021 Bianco Cappello Magico / White Magical Hat
            { id: 592, qty: 1 }, // SDJ-022 Soldato Pinguino / Penguin Soldier
            // SDJ-023 Drago dei Mille e SDJ-024 Spadaccino di Fuoco sono
            // Mostri Fusione: vanno nell'array extra qui sotto, non main
            // (stessa convenzione di js/data/character-decks.js).
            { id: 594, qty: 1 }, // SDJ-025 Nuzzler Malevolo / Malevolent Nuzzler
            { id: 7, qty: 1 },   // SDJ-026 Buco Nero / Dark Hole
            { id: 546, qty: 1 }, // SDJ-027 Dian Keto il Curatore
            { id: 243, qty: 1 }, // SDJ-028 Faglia / Fissure
            { id: 195, qty: 1 }, // SDJ-029 Annulla Carta Magia / De-Spell
            { id: 147, qty: 1 }, // SDJ-030 Cambiare Idea / Change of Heart
            { id: 121, qty: 1 }, // SDJ-031 Blocca-Attacco / Block Attack
            { id: 262, qty: 1 }, // SDJ-032 Ritorno Totale / Giant Trunade
            { id: 595, qty: 1 }, // SDJ-033 Guardiano Affidabile / The Reliable Guardian
            { id: 417, qty: 1 }, // SDJ-034 Rimuovi Trappola / Remove Trap
            { id: 35, qty: 1 },  // SDJ-035 Mostro Resuscitato / Monster Reborn
            { id: 38, qty: 1 },  // SDJ-036 Fusione / Polymerization
            { id: 596, qty: 1 }, // SDJ-037 Montagna / Mountain
            { id: 597, qty: 1 }, // SDJ-038 Tesoro del Drago / Dragon Treasure
            { id: 598, qty: 1 }, // SDJ-039 Riposo Eterno / Eternal Rest
            { id: 440, qty: 1 }, // SDJ-040 Scudo e Spada / Shield & Sword
            { id: 434, qty: 1 }, // SDJ-041 Capro Espiatorio / Scapegoat
            { id: 577, qty: 1 }, // SDJ-042 L'hai Voluto tu! / Just Desserts
            { id: 40, qty: 1 },  // SDJ-043 Buco Trappola / Trap Hole
            { id: 549, qty: 1 }, // SDJ-044 Rinforzi / Reinforcements
            { id: 143, qty: 1 }, // SDJ-045 Mura del Castello / Castle Walls
            { id: 503, qty: 1 }, // SDJ-046 Waboku
            { id: 559, qty: 1 }, // SDJ-047 Ultima Offerta / Ultimate Offering
            { id: 599, qty: 1 }, // SDJ-048 I Sette Attrezzi del Bandito / Seven Tools of the Bandit
            { id: 600, qty: 1 }, // SDJ-049 Trappola Finta / Fake Trap
            { id: 558, qty: 1 }  // SDJ-050 Inverti Trappola / Reverse Trap
        ],
        extra: [
            { id: 473, qty: 1 }, // SDJ-023 Drago Millenario / Thousand Dragon
            { id: 58, qty: 1 }   // SDJ-024 Spadaccino di Fuoco / Flame Swordsman
        ]
    },
    {
        packId: 'starter_sdp_pegasus',
        kind: 'starter',
        name: 'Starter Deck: Pegasus (SDP)',
        year: 2003,
        coverCardId: 416, // Abbandono / Relinquished (vedi coverCardId su SDY)

        description: 'Il mazzo di Maximillion Pegasus, incentrato sul Mondo Toon e sui suoi bizzarri mostri "cartoon".',
        main: [
            { id: 416, qty: 1 }, // SDP-001 Abbandono / Relinquished
            { id: 412, qty: 1 }, // SDP-002 Ragazza Arciere / Red Archery Girl
            { id: 429, qty: 1 }, // SDP-003 Ryu-Ran
            { id: 306, qty: 1 }, // SDP-004 Mago Senza Volto Illusionista / Illusionist Faceless Mage
            { id: 424, qty: 1 }, // SDP-005 Bambola Mortale / Rogue Doll
            { id: 561, qty: 1 }, // SDP-006 Uraby
            { id: 261, qty: 1 }, // SDP-007 Giant Soldier of Stone
            { id: 96, qty: 1 },  // SDP-008 Mago delle Acque
            { id: 481, qty: 1 }, // SDP-009 Alligatore Toon / Toon Alligator
            { id: 581, qty: 1 }, // SDP-010 Hane-Hane
            { id: 601, qty: 1 }, // SDP-011 Uccello Sonico / Sonic Bird
            { id: 315, qty: 1 }, // SDP-012 Bomba a Tempo / Jigen Bakudan
            { id: 602, qty: 1 }, // SDP-013 Maschera dell'Oscurità / Mask of Darkness
            { id: 508, qty: 1 }, // SDP-014 Strega della Foresta Nera / Witch of the Black Forest
            { id: 23, qty: 1 },  // SDP-015 Insetto Mangia-Uomini / Man-Eater Bug
            { id: 603, qty: 1 }, // SDP-016 Muka Muka
            { id: 531, qty: 1 }, // SDP-017 Clown del Sogno / Dream Clown
            { id: 604, qty: 1 }, // SDP-018 Ninja Armato / Armed Ninja
            { id: 605, qty: 1 }, // SDP-019 Esploratore-Ombra di Hiro / Hiro's Shadow Scout
            { id: 123, qty: 1 }, // SDP-020 Drago Toon Occhi Blu / Blue-Eyes Toon Dragon
            { id: 486, qty: 1 }, // SDP-021 Teschio Evocato Toon / Toon Summoned Skull
            { id: 606, qty: 1 }, // SDP-022 Manga Ryu-Ran
            { id: 484, qty: 1 }, // SDP-023 Sirena Toon / Toon Mermaid
            { id: 487, qty: 1 }, // SDP-024 Mondo Toon / Toon World
            { id: 117, qty: 1 }, // SDP-025 Pendente Nero / Black Pendant
            { id: 7, qty: 1 },   // SDP-026 Buco Nero / Dark Hole
            { id: 546, qty: 1 }, // SDP-027 Dian Keto il Curatore
            { id: 243, qty: 1 }, // SDP-028 Faglia / Fissure
            { id: 195, qty: 1 }, // SDP-029 Annulla Carta Magia / De-Spell
            { id: 147, qty: 1 }, // SDP-030 Cambiare Idea / Change of Heart
            { id: 69, qty: 1 },  // SDP-031 Blocca Difesa / Stop Defense
            { id: 607, qty: 1 }, // SDP-032 Tifone Spaziale Mistico / Mystical Space Typhoon
            { id: 608, qty: 1 }, // SDP-033 Corsa Avventata / Rush Recklessly
            { id: 417, qty: 1 }, // SDP-034 Rimuovi Trappola / Remove Trap
            { id: 35, qty: 1 },  // SDP-035 Mostro Resuscitato / Monster Reborn
            { id: 609, qty: 1 }, // SDP-036 Liberazione dell'Anima / Soul Release
            { id: 557, qty: 1 }, // SDP-037 Yami
            { id: 116, qty: 1 }, // SDP-038 Rito Illusione Nera / Black Illusion Ritual
            { id: 420, qty: 1 }, // SDP-039 Anello del Magnetismo / Ring of Magnetism
            { id: 272, qty: 1 }, // SDP-040 Carità Graziosa / Graceful Charity
            { id: 40, qty: 1 },  // SDP-041 Buco Trappola / Trap Hole
            { id: 549, qty: 1 }, // SDP-042 Reinforcements
            { id: 143, qty: 1 }, // SDP-043 Mura del Castello / Castle Walls
            { id: 503, qty: 1 }, // SDP-044 Waboku
            { id: 599, qty: 1 }, // SDP-045 I Sette Attrezzi del Bandito / Seven Tools of the Bandit
            { id: 559, qty: 1 }, // SDP-046 Ultima Offerta / Ultimate Offering
            { id: 610, qty: 1 }, // SDP-047 Goblin Ladro / Robbin' Goblin
            { id: 361, qty: 1 }, // SDP-048 Disturbo Magico / Magic Jammer
            { id: 611, qty: 1 }, // SDP-049 Lancia Incantata / Enchanted Javelin
            { id: 612, qty: 1 }  // SDP-050 Ali di Grifone / Gryphon Wing
        ],
        extra: []
    },
    {
        packId: 'starter_sye_yugi_evolution',
        kind: 'starter',
        name: 'Starter Deck: Yugi Evolution (SYE)',
        year: 2004,
        description: 'Versione aggiornata del mazzo di Yugi, con carte più recenti a supporto di Mago Nero e Ragazza Maga Nera.',
        main: [
            { id: 2, qty: 1 },   // SYE-001 Mago Nero / Dark Magician
            { id: 391, qty: 1 }, // SYE-002 Elfo Mistico / Mystical Elf
            { id: 237, qty: 1 }, // SYE-003 Demone Selvaggio / Feral Imp
            { id: 507, qty: 1 }, // SYE-004 Drago Alato #1
            { id: 13, qty: 1 },  // SYE-005 Teschio Evocato / Summoned Skull
            { id: 109, qty: 1 }, // SYE-006 Castoro Guerriero / Beaver Warrior
            { id: 14, qty: 1 },  // SYE-007 Gaia il Cavaliere / Gaia The Fierce Knight
            { id: 4, qty: 1 },   // SYE-008 Guardiano Celtico / Celtic Guardian
            { id: 279, qty: 1 }, // SYE-009 Mega Squalo Bianco / Great White
            { id: 261, qty: 1 }, // SYE-010 Giant Soldier of Stone
            { id: 544, qty: 1 }, // SYE-011 Clown Mistico / Mystic Clown
            { id: 551, qty: 1 }, // SYE-012 Neo lo Spadaccino Magico / Neo the Magic Swordsman
            { id: 532, qty: 1 }, // SYE-013 Gazelle, Re delle Bestie Mitiche
            { id: 504, qty: 1 }, // SYE-014 Guerriero Dai Grepher / Warrior Dai Grepher
            { id: 613, qty: 1 }, // SYE-015 Lama Oscura / Dark Blade
            { id: 54, qty: 1 },  // SYE-016 Muro Illusorio / Wall of Illusion
            { id: 23, qty: 1 },  // SYE-017 Insetto Mangia-Uomini / Man-Eater Bug
            { id: 433, qty: 1 }, // SYE-018 Sangan
            { id: 22, qty: 1 },  // SYE-019 Kuriboh
            { id: 614, qty: 1 }, // SYE-020 Ratto Gigante / Giant Rat
            { id: 601, qty: 1 }, // SYE-021 Uccello Sonico / Sonic Bird
            { id: 625, qty: 1 }, // SYE-022 Zombyra l'Oscuro / Zombyra the Dark
            { id: 615, qty: 1 }, // SYE-023 Biblioteca Reale Magica / Royal Magical Library
            { id: 616, qty: 1 }, // SYE-024 Soldato del Fulgore Nero / Black Luster Soldier
            { id: 617, qty: 1 }, // SYE-025 Rito del Fulgore Nero / Black Luster Ritual
            { id: 7, qty: 1 },   // SYE-026 Buco Nero / Dark Hole
            { id: 546, qty: 1 }, // SYE-027 Dian Keto il Curatore
            { id: 243, qty: 1 }, // SYE-028 Faglia / Fissure
            { id: 35, qty: 1 },  // SYE-029 Mostro Resuscitato / Monster Reborn
            { id: 147, qty: 1 }, // SYE-030 Cambiare Idea / Change of Heart
            { id: 555, qty: 1 }, // SYE-031 Ultimo Desiderio / Last Will
            { id: 138, qty: 1 }, // SYE-032 Distruggi-Carte / Card Destruction
            { id: 417, qty: 1 }, // SYE-033 Rimuovi Trappola / Remove Trap
            { id: 595, qty: 1 }, // SYE-034 Guardiano Affidabile / The Reliable Guardian
            { id: 618, qty: 1 }, // SYE-035 Ascia di Distruzione / Axe of Despair
            { id: 594, qty: 1 }, // SYE-036 Nuzzler Malevolo / Malevolent Nuzzler
            { id: 607, qty: 1 }, // SYE-037 Tifone Spaziale Mistico / Mystical Space Typhoon
            { id: 619, qty: 1 }, // SYE-038 Zona Mistica del Plasma / Mystic Plasma Zone
            { id: 8, qty: 1 },   // SYE-039 Spada Rivelatrice / Swords of Revealing Light
            { id: 36, qty: 1 },  // SYE-040 Anfora dell'Avidità / Pot of Greed
            { id: 40, qty: 1 },  // SYE-041 Buco Trappola / Trap Hole
            { id: 503, qty: 1 }, // SYE-042 Waboku
            { id: 361, qty: 1 }, // SYE-043 Disturbo Magico / Magic Jammer
            { id: 599, qty: 1 }, // SYE-044 I Sette Attrezzi del Bandito / Seven Tools of the Bandit
            { id: 620, qty: 1 }, // SYE-045 Cerchio Incantatore / Spellbinding Circle
            { id: 466, qty: 1 }, // SYE-046 L'Occhio della Verità / The Eye of Truth
            { id: 621, qty: 1 }, // SYE-047 Soldato di Riserva / Backup Soldier
            { id: 622, qty: 1 }, // SYE-048 Spostamento / Shift
            { id: 623, qty: 1 }, // SYE-049 Sparizione / Disappear
            { id: 624, qty: 1 }  // SYE-050 Frattura Raigeki / Raigeki Break
        ],
        extra: []
    },
    {
        packId: 'starter_ske_kaiba_evolution',
        kind: 'starter',
        name: 'Starter Deck: Kaiba Evolution (SKE)',
        year: 2004,
        description: 'Versione aggiornata del mazzo di Kaiba, con nuovo supporto per i Draghi e per il Drago Bianco Occhi Blu.',
        main: [
            { id: 1, qty: 1 },   // SKE-001 Drago Bianco Occhi Blu / Blue-Eyes White Dragon
            { id: 106, qty: 1 }, // SKE-002 Ascia da Guerra / Battle Ox
            { id: 331, qty: 1 }, // SKE-003 Drago Koumori / Koumori Dragon
            { id: 424, qty: 1 }, // SKE-004 Bambola Mortale / Rogue Doll
            { id: 330, qty: 1 }, // SKE-005 Kojikocy
            { id: 561, qty: 1 }, // SKE-006 Uraby
            { id: 389, qty: 1 }, // SKE-007 Centauro Mistico / Mystic Horseman (id 626 "Uomo Cavallo Mistico" era un doppione della stessa carta, rimosso da data/cards.json)
            { id: 428, qty: 1 }, // SKE-008 Ryu-Kishin Potenziato / Ryu-Kishin Powered
            { id: 335, qty: 1 }, // SKE-009 Genio della Lampada
            { id: 572, qty: 1 }, // SKE-010 Uccello Teschio Rosso / Skull Red Bird
            { id: 305, qty: 1 }, // SKE-011 Hyozanryu
            { id: 627, qty: 1 }, // SKE-012 Opticlops
            { id: 628, qty: 1 }, // SKE-013 Il Drago Abitante nella Caverna
            { id: 629, qty: 1 }, // SKE-014 Drago Avido #2 / Luster Dragon #2
            { id: 321, qty: 1 }, // SKE-015 Cavaliere Marino Kaiser / Kaiser Cavalluccio Marino
            { id: 353, qty: 1 }, // SKE-016 Signore di D. / Lord of D.
            { id: 579, qty: 1 }, // SKE-017 Marionettista Misterioso / Mysterious Puppeteer
            { id: 556, qty: 1 }, // SKE-018 Maestro di Trappola / Trap Master
            { id: 581, qty: 1 }, // SKE-019 Hane-Hane
            { id: 508, qty: 1 }, // SKE-020 Strega della Foresta Nera / Witch of the Black Forest
            { id: 390, qty: 1 }, // SKE-021 Pomodoro Mistico / Mystic Tomato
            { id: 360, qty: 1 }, // SKE-022 Bestia della Spada Folle / Mad Sword Beast
            { id: 630, qty: 1 }, // SKE-023 Spirito Ryu
            { id: 398, qty: 1 }, // SKE-024 Paladino del Drago Bianco / Paladin of White Dragon
            { id: 506, qty: 1 }, // SKE-025 Rituale del Drago Bianco / White Dragon Ritual
            { id: 570, qty: 1 }, // SKE-026 Ookazi
            { id: 243, qty: 1 }, // SKE-027 Faglia / Fissure
            { id: 195, qty: 1 }, // SKE-028 Annulla Carta Magia / De-Spell
            { id: 35, qty: 1 },  // SKE-029 Mostro Resuscitato / Monster Reborn
            { id: 575, qty: 1 }, // SKE-030 Spia Inesperta / The Inexperienced Spy
            { id: 578, qty: 1 }, // SKE-031 Flauto Evoca-Draghi / The Flute of Summoning Dragon
            { id: 147, qty: 1 }, // SKE-032 Cambiare Idea / Change of Heart
            { id: 451, qty: 1 }, // SKE-033 Scambio di Anime / Soul Exchange
            { id: 596, qty: 1 }, // SKE-034 Montagna / Mountain
            { id: 492, qty: 1 }, // SKE-035 Tributo al Dannato / Tribute to the Doomed
            { id: 608, qty: 1 }, // SKE-036 Corsa Avventata / Rush Recklessly
            { id: 631, qty: 1 }, // SKE-037 Megamorfosi / Megamorph
            { id: 632, qty: 1 }, // SKE-038 Nobiluomo dello Scambio / Nobleman of Crossout
            { id: 633, qty: 1 }, // SKE-039 Sepoltura Prematura / Premature Burial
            { id: 233, qty: 1 }, // SKE-040 Pioggia di Meteore Fatate / Fairy Meteor Crush
            { id: 439, qty: 1 }, // SKE-041 Magia Ombra / Shadow Spell
            { id: 40, qty: 1 },  // SKE-042 Buco Trappola / Trap Hole
            { id: 577, qty: 1 }, // SKE-043 L'hai Voluto tu! / Just Desserts
            { id: 263, qty: 1 }, // SKE-044 Dono dell'Elfo Mistico / Gift of The Mystical Elf
            { id: 219, qty: 1 }, // SKE-045 Tornado di Polvere / Dust Tornado
            { id: 634, qty: 1 }, // SKE-046 Luce dell'Intervento / Light of Intervention
            { id: 635, qty: 1 }, // SKE-047 Giara della Cupidigia / Jar of Greed
            { id: 636, qty: 1 }, // SKE-048 Terreno Riryoku / Riryoku Field
            { id: 134, qty: 1 }, // SKE-049 Soffio Incendiario / Burst Breath
            { id: 637, qty: 1 }  // SKE-050 Tribù D. / D. Tribe
        ],
        extra: []
    },
    {
        packId: 'starter_2006',
        kind: 'starter',
        name: 'Starter Deck 2006',
        year: 2006,
        description: 'Il mazzo introduttivo generico del 2006, pensato per insegnare le basi del gioco a chi inizia da zero.',
        main: [],
        extra: []
    },
    {
        // Primo mazzo del set storico WW1 (origin 'ww1' in data/cards.json,
        // una provenienza prevista dalla tassonomia fin dall'inizio ma mai
        // usata prima d'ora). Attenzione: le schermate di scelta del duello
        // filtrano per provenienza e partono da "Solo Yu-Gi-Oh!", quindi per
        // giocarlo va scelto "Solo WW1" oppure "Tutte le provenienze" —
        // altrimenti il controllo in js/duel-session.js lo blocca, ed e'
        // esattamente il comportamento voluto.
        packId: 'starter_ww1_regio_esercito',
        kind: 'starter',
        name: 'Starter Deck: Regio Esercito (WW1)',
        year: 1918,
        description: 'Fanteria, Alpini e Arditi tengono la linea mentre la Squadriglia degli Assi domina il cielo, con Francesco Baracca a guidarla.',
        coverCardId: 1200, // Francesco Baracca, Asso degli Assi
        // 40 carte: 21 Truppe, 11 Manovre, 8 Insidie (la provenienza 'ww1'
        // rinomina i tre tipi di carta — vedi CARD_ORIGIN_TERMS in
        // js/data/cards-db.js). Le carte non-vanilla usano gli effetti
        // componibili (effectTemplate), non registrazioni scritte a mano in
        // card-effects.js.
        // I Tipi Mostro sono quelli del set (CARD_ORIGIN_RACES, stesso file):
        // i corpi reali del Regio Esercito, non Guerriero/Macchina. Le quattro
        // TRUPPE APPIEDATE (Fanteria/Bersaglieri/Alpini/Arditi) sono l'insieme
        // che Ordine di Assalto, Trincea e Rinforzi dal Piave trattano come un
        // archetipo unico, tramite il filtro `races` degli effetti componibili.
        main: [
            // Aviazione
            { id: 1200, qty: 1 }, // Francesco Baracca, Asso degli Assi (la piu' forte del mazzo)
            { id: 1201, qty: 1 }, // Caproni Ca.3
            { id: 1202, qty: 2 }, // SPAD S.XIII
            { id: 1203, qty: 1 }, // Nieuport 11 "Bebe"
            // Artiglieria
            { id: 1204, qty: 1 }, // Cannone da 149/35
            // Comando (Fanteria/Bersaglieri/Alpini a seconda del corpo reale,
            // d'Annunzio fra gli aviatori per il Volo su Vienna)
            { id: 1205, qty: 1 }, // Armando Diaz
            { id: 1206, qty: 1 }, // Emanuele Filiberto, Duca d'Aosta
            { id: 1207, qty: 2 }, // Enrico Toti
            { id: 1208, qty: 1 }, // Cesare Battisti
            { id: 1209, qty: 1 }, // Gabriele d'Annunzio
            // Truppe appiedate
            { id: 1210, qty: 3 }, // Fante del Regio Esercito
            { id: 1211, qty: 2 }, // Bersagliere
            { id: 1212, qty: 2 }, // Alpino
            { id: 1213, qty: 1 }, // Arditi, Reparto d'Assalto
            { id: 1214, qty: 1 }, // Mitragliere
            // Manovre
            { id: 1215, qty: 1 }, // Il Bollettino della Vittoria (Limitata)
            { id: 1216, qty: 2 }, // Ordine di Assalto
            { id: 1217, qty: 2 }, // Trincea della Terza Armata
            { id: 1218, qty: 2 }, // Cavallino Rampante
            { id: 1219, qty: 2 }, // Rinforzi dal Piave
            { id: 1220, qty: 2 }, // Ospedale da Campo
            // Insidie
            { id: 1221, qty: 2 }, // Filo Spinato
            { id: 1222, qty: 2 }, // Contrattacco sul Grappa
            { id: 1223, qty: 2 }, // Sbarramento d'Artiglieria
            { id: 1224, qty: 2 }  // Gas Asfissiante
        ],
        extra: []
    },
    {
        // Controparte imperiale del mazzo qui sopra, nella STESSA
        // provenienza 'ww1' — e' il punto: con la restrizione "Solo WW1"
        // attiva i due si affrontano fra loro, cosa impossibile se ognuno
        // avesse avuto una provenienza propria.
        // Stessa taglia e stessa struttura del Regio Esercito (21 Truppe,
        // 11 Manovre, 8 Insidie) ma con un'indole diversa: meno bonus alle
        // truppe e piu' artiglieria, danno diretto e una carta che
        // ribalta il tavolo (Caporetto). I Tipi sono i corpi imperiali
        // (CARD_ORIGIN_RACES in js/data/cards-db.js); le tre APPIEDATE
        // imperiali — Landwehr, Kaiserjäger, Sturmtruppen — sono
        // l'archetipo che Strafexpedition, Caverne del Carso e Ordine di
        // Boroevic trattano insieme, col filtro `races` degli effetti
        // componibili. Artiglieria, Cavalleria e Aviazione sono invece
        // Tipi condivisi coi reparti italiani.
        packId: 'starter_ww1_kuk',
        kind: 'starter',
        name: 'Starter Deck: k.u.k. Armee (WW1)',
        year: 1917,
        description: 'Kaiserjäger e Landwehr trincerati nelle caverne del Carso, i mortai Skoda a martellare le linee e Brumowski a spazzare il cielo.',
        coverCardId: 1225, // Godwin von Brumowski, Asso Imperiale
        boxColor: 'acciaio', // il grigio-lucertola delle uniformi imperiali
        main: [
            // Aviazione
            { id: 1225, qty: 1 }, // Godwin von Brumowski (la piu' forte del mazzo)
            { id: 1226, qty: 2 }, // Hansa-Brandenburg D.I
            { id: 1227, qty: 1 }, // Albatros D.III (Oeffag)
            { id: 1228, qty: 1 }, // Julius Arigi
            // Artiglieria
            { id: 1229, qty: 1 }, // Mörser Skoda da 305
            { id: 1230, qty: 2 }, // Obice Skoda da 100
            // Comando
            { id: 1231, qty: 1 }, // Svetozar Boroevic
            { id: 1232, qty: 1 }, // Arciduca Eugenio d'Asburgo
            { id: 1233, qty: 1 }, // Conrad von Hötzendorf
            // Truppe appiedate imperiali
            { id: 1234, qty: 2 }, // Kaiserjäger Tirolese
            { id: 1235, qty: 2 }, // Standschütze
            { id: 1236, qty: 1 }, // Sturmtruppen, Reparto d'Assalto
            { id: 1237, qty: 2 }, // Landwehr Ungherese
            { id: 1238, qty: 2 }, // Mitragliere Schwarzlose
            // Cavalleria
            { id: 1239, qty: 1 }, // Ulano
            // Manovre
            { id: 1240, qty: 2 }, // Strafexpedition
            { id: 1241, qty: 2 }, // Aquila Bicipite
            { id: 1242, qty: 2 }, // Caverne del Carso
            { id: 1243, qty: 2 }, // Ordine di Boroevic
            { id: 1244, qty: 2 }, // Ospedale da Campo k.u.k.
            { id: 1245, qty: 1 }, // Il Comunicato di Vienna (Limitata)
            // Insidie
            { id: 1246, qty: 2 }, // Gas di Flitsch
            { id: 1247, qty: 2 }, // Sbarramento dello Skoda
            { id: 1248, qty: 1 }, // Caporetto, la Rotta (Limitata)
            { id: 1249, qty: 3 }  // Reticolato Imperiale
        ],
        extra: []
    },

    // --- Structure Deck -------------------------------------------------
    {
        packId: 'structure_sd1_dragons_roar',
        kind: 'structure',
        name: 'Structure Deck: Dragon\'s Roar (SD1)',
        year: 2005,
        description: 'Mazzo tematico dedicato ai mostri Tipo Drago e alla loro potenza distruttiva.',
        // CORREZIONE di fedeltà: tutte e 28 le quantità reali confermate
        // via ricerca mirata (stesso motivo/stesso metodo di Zombie
        // Madness qui sopra — 28 codici set, ma il prodotto fisico arriva
        // a 40 carte con più copie di alcune). A differenza di Zombie
        // Madness, qui tutte e 28 le quantità sono state trovate da
        // fonte diretta, nessuna stima.
        main: [
            { id: 638, qty: 1 }, // SD1-EN001 Drago Oscuro Occhi Rossi / Red-Eyes Darkness Dragon
            { id: 12, qty: 1 },  // SD1-EN002 Drago Nero Occhi Rossi / Red-Eyes Black Dragon
            { id: 639, qty: 2 }, // SD1-EN003 Drago Avido / Luster Dragon
            { id: 493, qty: 1 }, // SD1-EN004 Behemoth Bifronte / Twin-Headed Behemoth
            { id: 640, qty: 2 }, // SD1-EN005 Drago Armato LV3 / Armed Dragon LV3
            { id: 641, qty: 2 }, // SD1-EN006 Drago Armato LV5 / Armed Dragon LV5
            { id: 642, qty: 1 }, // SD1-EN007 Cucciolo di Occhi-Rossi / Black Dragon's Chick
            { id: 643, qty: 1 }, // SD1-EN008 Drago Elementale / Element Dragon
            { id: 644, qty: 3 }, // SD1-EN009 Drago Mascherato / Masked Dragon
            { id: 645, qty: 1 }, // SD1-EN010 Strappa Possesso / Snatch Steal
            { id: 607, qty: 1 }, // SD1-EN011 Tifone Spaziale Mistico / Mystical Space Typhoon
            { id: 632, qty: 2 }, // SD1-EN012 Nobiluomo dello Scambio / Nobleman of Crossout
            { id: 633, qty: 1 }, // SD1-EN013 Sepoltura Prematura / Premature Burial
            { id: 8, qty: 1 },   // SD1-EN014 Spada Rivelatrice / Swords of Revealing Light
            { id: 36, qty: 1 },  // SD1-EN015 Anfora dell'Avidità / Pot of Greed
            { id: 646, qty: 1 }, // SD1-EN016 Tempesta Potente / Heavy Storm
            { id: 647, qty: 3 }, // SD1-EN017 Distruzione Schiacciante / Stamping Destruction
            { id: 648, qty: 2 }, // SD1-EN018 Scambio-Creature / Creature Swap
            { id: 649, qty: 2 }, // SD1-EN019 Ricarica / Reload
            { id: 650, qty: 1 }, // SD1-EN020 Il Cimitero nella Quarta Dimensione
            { id: 136, qty: 1 }, // SD1-EN021 Richiamo del Posseduto / Call of the Haunted
            { id: 651, qty: 1 }, // SD1-EN022 Cessate il Fuoco / Ceasefire
            { id: 652, qty: 1 }, // SD1-EN023 La Perla di Drago / The Dragon's Bead
            { id: 212, qty: 2 }, // SD1-EN024 Rabbia del Drago / Dragon's Rage
            { id: 653, qty: 1 }, // SD1-EN025 Cupidigia Insaziabile / Reckless Greed
            { id: 312, qty: 2 }, // SD1-EN026 Teletrasportatore
            { id: 654, qty: 1 }, // SD1-EN027 Disturba Trappola / Trap Jammer
            { id: 655, qty: 1 }  // SD1-EN028 Maledizione di Anubis / Curse of Anubis
        ],
        extra: []
    },
    {
        packId: 'structure_sd2_zombie_madness',
        kind: 'structure',
        name: 'Structure Deck: Zombie Madness (SD2)',
        year: 2005,
        description: 'Mazzo tematico dedicato ai mostri Tipo Zombie e alla loro capacità di risorgere dal Cimitero.',
        // CORREZIONE di fedeltà: prima ogni codice SD2-EN001/028 aveva
        // qty:1 (un solo esemplare ciascuno, 28 carte totali) — corretto
        // perché è la convenzione giusta per uno STARTER Deck del 2002
        // (SDY/SDK/SDJ/SKE, vedi i commenti su quei mazzi più sopra: 50
        // carte reali tutte diverse), ma SBAGLIATA per uno STRUCTURE Deck
        // del 2005 in poi come questo: il prodotto fisico reale arriva a
        // 40 carte usando più copie di alcune delle 28 (es. 3x Tartaruga
        // della Piramide). Quantità confermate via ricerca mirata
        // (fonti: Yugipedia/Fandom, irraggiungibili direttamente per il
        // fetch automatico ma citate nei risultati di ricerca) per 22
        // delle 28 carte; le 6 rimanenti Magie generiche/staple
        // (Tifone dello Spazio Mistico, Grande Tornado, Nobile del
        // Depistaggio, Tempesta Pesante, Ricarica — 1 copia ciascuna,
        // valore di default più comune per questo tipo di carta in uno
        // Structure Deck — e Carta del Ritorno Sicuro, portata a 2 per
        // far quadrare il totale a 40) non sono state confermate da una
        // fonte diretta: se in futuro si trova la lista ufficiale
        // completa, va usata quella al posto di questa stima.
        main: [
            { id: 656, qty: 1 }, // SD2-EN001 Genesi Vampira / Vampire Genesis
            { id: 657, qty: 1 }, // SD2-EN002 Maestro Kyonshee / Master Kyonshee
            { id: 658, qty: 1 }, // SD2-EN003 Signore dei Vampiri / Vampire Lord
            { id: 659, qty: 1 }, // SD2-EN004 Spirito Polvere Oscura / Dark Dust Spirit
            { id: 660, qty: 3 }, // SD2-EN005 Tartaruga Piramide / Pyramid Turtle
            { id: 661, qty: 1 }, // SD2-EN006 Spirito Mietitore / Spirit Reaper
            { id: 662, qty: 2 }, // SD2-EN007 Disperazione dall'Oscurità / Despair from the Dark
            { id: 663, qty: 2 }, // SD2-EN008 Ryu Kokki
            { id: 664, qty: 1 }, // SD2-EN009 Torre d'Ossa Assorbi-Anima / Soul-Absorbing Bone Tower
            { id: 665, qty: 1 }, // SD2-EN010 Lady Vampira / Vampire Lady
            { id: 666, qty: 1 }, // SD2-EN011 Doppio Coston / Double Coston
            { id: 667, qty: 2 }, // SD2-EN012 Mummia Rigenerante / Regenerating Mummy
            { id: 645, qty: 1 }, // SD2-EN013 Strappa Possesso / Snatch Steal
            { id: 607, qty: 1 }, // SD2-EN014 Tifone Spaziale Mistico / Mystical Space Typhoon (quantità NON confermata, presunta 1x)
            { id: 668, qty: 1 }, // SD2-EN015 Grande Tornado / Giant Trunade (quantità NON confermata, presunta 1x)
            { id: 632, qty: 1 }, // SD2-EN016 Nobiluomo dello Scambio / Nobleman of Crossout (quantità NON confermata, presunta 1x)
            { id: 36, qty: 1 },  // SD2-EN017 Anfora dell'Avidità / Pot of Greed
            { id: 141, qty: 2 }, // SD2-EN018 Carta del Ritorno Sicuro / Card of Safe Return (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 646, qty: 1 }, // SD2-EN019 Tempesta Potente / Heavy Storm (quantità NON confermata, presunta 1x)
            { id: 648, qty: 2 }, // SD2-EN020 Scambio-Creature / Creature Swap
            { id: 669, qty: 2 }, // SD2-EN021 Libro della Vita / Book of Life
            { id: 670, qty: 3 }, // SD2-EN022 Richiamo della Mummia / Call of the Mummy
            { id: 649, qty: 1 }, // SD2-EN023 Ricarica / Reload (quantità NON confermata, presunta 1x)
            { id: 219, qty: 1 }, // SD2-EN024 Tornado di Polvere / Dust Tornado
            { id: 490, qty: 1 }, // SD2-EN025 Tributo Torrenziale / Torrential Tribute
            { id: 361, qty: 1 }, // SD2-EN026 Disturbo Magico / Magic Jammer
            { id: 653, qty: 1 }, // SD2-EN027 Cupidigia Insaziabile / Reckless Greed
            { id: 671, qty: 3 }  // SD2-EN028 Dispositivo di Salvataggio Obbligatorio / Compulsory Evacuation Device
        ],
        extra: []
    },
    {
        packId: 'structure_sd3_blaze_of_destruction',
        kind: 'structure',
        name: 'Structure Deck: Blaze of Destruction (SD3)',
        year: 2005,
        description: 'Mazzo tematico dedicato ai mostri Tipo Fuoco e agli effetti di danno diretto.',
        // CORREZIONE di fedeltà, stesso motivo di SD1/SD2 qui sopra — 31
        // quantità confermate via ricerca mirata su 29, le ultime 2
        // (Vaso dell'Ingordigia e Tornado di Polvere, portate a 2 invece
        // di 1) sono una stima per far quadrare il totale a 40, non un
        // dato confermato da fonte diretta.
        main: [
            { id: 672, qty: 1 }, // SD3-EN001 Imperatore della Fiamma Infernale / Infernal Flame Emperor
            { id: 673, qty: 1 }, // SD3-EN002 Grande Angus / Great Angus
            { id: 674, qty: 1 }, // SD3-EN003 Inpachi Fiammeggiante / Blazing Inpachi
            { id: 675, qty: 3 }, // SD3-EN004 Tartaruga UFO / UFO Turtle
            { id: 676, qty: 1 }, // SD3-EN005 Piccola Chimera / Little Chimera
            { id: 677, qty: 2 }, // SD3-EN006 Inferno
            { id: 678, qty: 1 }, // SD3-EN007 Zombie Fuso / Molten Zombie
            { id: 679, qty: 2 }, // SD3-EN008 Drago Ondata Solare / Solar Flare Dragon
            { id: 680, qty: 2 }, // SD3-EN009 Giovane Promessa del Baseball / Ultimate Baseball Kid
            { id: 681, qty: 1 }, // SD3-EN010 Folletto della Fiamma Infuriato / Raging Flame Sprite
            { id: 682, qty: 1 }, // SD3-EN011 Thestalos il Monarca della Tempesta di Fuoco
            { id: 683, qty: 1 }, // SD3-EN012 L'Anima di Gaia il Combustibile Collettivo
            { id: 684, qty: 1 }, // SD3-EN013 Volpe di Fuoco / Fox Fire
            { id: 645, qty: 1 }, // SD3-EN014 Strappa Possesso / Snatch Steal
            { id: 607, qty: 1 }, // SD3-EN015 Tifone Spaziale Mistico / Mystical Space Typhoon
            { id: 685, qty: 2 }, // SD3-EN016 Distruzione Infuocata / Molten Destruction
            { id: 632, qty: 1 }, // SD3-EN017 Nobiluomo dello Scambio / Nobleman of Crossout
            { id: 633, qty: 1 }, // SD3-EN018 Sepoltura Prematura / Premature Burial
            { id: 36, qty: 1 },  // SD3-EN019 Anfora dell'Avidità / Pot of Greed
            { id: 492, qty: 1 }, // SD3-EN020 Tributo al Dannato / Tribute to the Doomed
            { id: 646, qty: 1 }, // SD3-EN021 Tempesta Potente / Heavy Storm
            { id: 686, qty: 1 }, // SD3-EN022 Camera Oscura dell'Incubo / Dark Room of Nightmare
            { id: 649, qty: 1 }, // SD3-EN023 Ricarica / Reload
            { id: 687, qty: 1 }, // SD3-EN024 Livello Limite - Area B / Level Limit - Area B
            { id: 688, qty: 1 }, // SD3-EN025 Amuleto del Comando / Necklace of Command
            { id: 378, qty: 1 }, // SD3-EN026 Meteora Della Morte / Meteor of Destruction
            { id: 219, qty: 2 }, // SD3-EN027 Tornado di Polvere / Dust Tornado (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 136, qty: 1 }, // SD3-EN028 Richiamo del Posseduto / Call of the Haunted
            { id: 635, qty: 2 }, // SD3-EN029 Giara della Cupidigia / Jar of Greed (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 689, qty: 1 }, // SD3-EN030 Scudo Magico Tipo-8 / Spell Shield Type-8
            { id: 690, qty: 2 }  // SD3-EN031 Ritorno di Fiamma / Backfire
        ],
        extra: []
    },
    {
        packId: 'structure_sd4_fury_from_the_deep',
        kind: 'structure',
        name: 'Structure Deck: Fury from the Deep (SD4)',
        year: 2005,
        description: 'Mazzo tematico dedicato ai mostri Tipo Pesce e Serpente di Mare e al controllo del campo tramite "Umi".',
        // CORREZIONE di fedeltà, stesso motivo di SD1/SD2/SD3 qui sopra.
        // Confermato via ricerca mirata: 17 mostri/15 Magie/8 Trappole
        // (40 totali) — le quantità dei 14 mostri e di "Un Oceano
        // Leggendario" sono confermate da fonte diretta; le altre 3
        // (Ricarica, Colpo di Martello, Tributo Torrenziale, tutte
        // portate a 2) sono una stima per far quadrare Magie/Trappole ai
        // conteggi confermati, non un dato confermato carta per carta.
        main: [
            { id: 691, qty: 1 }, // SD4-EN001 Signore Drago Oceanico - Neo-Daedalus
            { id: 583, qty: 1 }, // SD4-EN002 Pesce dei 7 Colori / 7 Colored Fish
            { id: 692, qty: 1 }, // SD4-EN003 Guerriero del Serpente Marino dell'Oscurità
            { id: 694, qty: 1 }, // SD4-EN004 Pesce Luna Spaziale / Space Mambo
            { id: 695, qty: 3 }, // SD4-EN005 Madre Grizzly / Mother Grizzly
            { id: 696, qty: 1 }, // SD4-EN006 Stellone / Star Boy
            { id: 697, qty: 1 }, // SD4-EN007 Virus Infetta-Tribù / Tribe-Infecting Virus
            { id: 698, qty: 2 }, // SD4-EN008 Fenrir
            { id: 699, qty: 1 }, // SD4-EN009 Bugroth Anfibio MK-3 / Amphibious Bugroth MK-3
            { id: 700, qty: 1 }, // SD4-EN010 Levia-Dragon - Daedalus
            { id: 701, qty: 1 }, // SD4-EN011 Sirena Cavaliere / Mermaid Knight
            { id: 702, qty: 1 }, // SD4-EN012 Mobius il Monarca Glaciale
            { id: 703, qty: 1 }, // SD4-EN013 Rana-Pescatrice Barbuta / Unshaven Angler
            { id: 693, qty: 1 }, // SD4-EN014 Manta del Fato Incedente / Creeping Doom Manta
            { id: 645, qty: 1 }, // SD4-EN015 Strappa Possesso / Snatch Steal
            { id: 607, qty: 1 }, // SD4-EN016 Tifone Spaziale Mistico / Mystical Space Typhoon
            { id: 633, qty: 1 }, // SD4-EN017 Sepoltura Prematura / Premature Burial
            { id: 36, qty: 1 },  // SD4-EN018 Anfora dell'Avidità / Pot of Greed
            { id: 646, qty: 1 }, // SD4-EN019 Tempesta Potente / Heavy Storm
            { id: 79, qty: 3 },  // SD4-EN020 Un Oceano Leggendario / A Legendary Ocean
            { id: 648, qty: 1 }, // SD4-EN021 Scambio-Creature / Creature Swap
            { id: 649, qty: 2 }, // SD4-EN022 Ricarica / Reload (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 704, qty: 1 }, // SD4-EN023 Salvataggio / Salvage
            { id: 705, qty: 2 }, // SD4-EN024 Lancio del Martello / Hammer Shot (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 706, qty: 1 }, // SD4-EN025 Piccola Onda Grande Onda / Big Wave Small Wave
            { id: 219, qty: 1 }, // SD4-EN026 Tornado di Polvere / Dust Tornado
            { id: 136, qty: 1 }, // SD4-EN027 Richiamo del Posseduto / Call of the Haunted
            { id: 707, qty: 1 }, // SD4-EN028 Legame Gravitazionale / Gravity Bind
            { id: 489, qty: 1 }, // SD4-EN029 Muro Tornado / Tornado Wall
            { id: 490, qty: 2 }, // SD4-EN030 Tributo Torrenziale / Torrential Tribute (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 689, qty: 1 }, // SD4-EN031 Scudo Magico Tipo-8 / Spell Shield Type-8
            { id: 708, qty: 1 }  // SD4-EN032 Xing Zhen Hu
        ],
        extra: []
    },
    {
        packId: 'structure_sd5_warriors_triumph',
        kind: 'structure',
        name: 'Structure Deck: Warrior\'s Triumph (SD5)',
        year: 2006,
        description: 'Mazzo tematico dedicato ai mostri Tipo Guerriero e alle Magie/Trappole di supporto diretto.',
        // CORREZIONE di fedeltà, stesso motivo dei mazzi precedenti.
        // Confermato via ricerca mirata solo Capitano Predone (2 copie);
        // le altre 3 copie mancanti per arrivare a 40 (Rinforzo
        // dell'Esercito, Grande Tornado, Interferenza Magica, tutte
        // portate a 2) sono una stima, non un dato confermato — il
        // rendimento delle ricerche mirate è stato più basso per questo
        // mazzo rispetto ai precedenti.
        main: [
            { id: 709, qty: 1 }, // SD5-EN001 Gilford la Leggenda / Gilford the Legend
            { id: 710, qty: 1 }, // SD5-EN002 Signora Guerriera delle Terre Desolate / Warrior Lady of the Wasteland
            { id: 613, qty: 1 }, // SD5-EN003 Lama Oscura / Dark Blade
            { id: 269, qty: 1 }, // SD5-EN004 Forza d'Attacco Goblin / Goblin Attack Force
            { id: 16, qty: 1 },  // SD5-EN005 Gearfried il Cavaliere di Ferro
            { id: 711, qty: 1 }, // SD5-EN006 Gaia il Cavaliere del Vento Oscuro / Swift Gaia the Fierce Knight
            { id: 712, qty: 1 }, // SD5-EN007 Guardia Celtica Riaddestrata / Obnoxious Celtic Guard
            { id: 713, qty: 1 }, // SD5-EN008 Cavaliere Comandante / Command Knight
            { id: 714, qty: 2 }, // SD5-EN009 Capitano Saccheggiatore / Marauding Captain
            { id: 715, qty: 1 }, // SD5-EN010 Forza Esiliata / Exiled Force
            { id: 716, qty: 1 }, // SD5-EN011 Signora Guerriera D.D. / D.D. Warrior Lady
            { id: 717, qty: 1 }, // SD5-EN012 Mataza l'Assassino Fulmineo / Mataza the Zapper
            { id: 718, qty: 1 }, // SD5-EN013 Spadaccino Mistico LV2 / Mystic Swordsman LV2
            { id: 719, qty: 1 }, // SD5-EN014 Spadaccino Mistico LV4 / Mystic Swordsman LV4
            { id: 720, qty: 1 }, // SD5-EN015 Sasuke Maestro Ninja / Ninja Grandmaster Sasuke
            { id: 258, qty: 1 }, // SD5-EN016 Spadaccino Sacro - Gearfried il Cavaliere di Ferro
            { id: 721, qty: 1 }, // SD5-EN017 Ben Kei - Samurai Armato / Armed Samurai - Ben Kei
            { id: 722, qty: 1 }, // SD5-EN018 Spada Divina - Lama della Fenice / Divine Sword - Phoenix Blade
            { id: 645, qty: 1 }, // SD5-EN019 Strappa Possesso / Snatch Steal
            { id: 607, qty: 1 }, // SD5-EN020 Tifone Spaziale Mistico / Mystical Space Typhoon
            { id: 668, qty: 2 }, // SD5-EN021 Grande Tornado / Giant Trunade (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 723, qty: 1 }, // SD5-EN022 Lama Fulminea / Lightning Blade
            { id: 646, qty: 1 }, // SD5-EN023 Tempesta Potente / Heavy Storm
            { id: 724, qty: 2 }, // SD5-EN024 Rinforzi dell'Esercito / Reinforcement of the Army (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 725, qty: 1 }, // SD5-EN025 Il Guerriero Sopravvissuto / The Warrior Returning Alive
            { id: 726, qty: 1 }, // SD5-EN026 Spada-Fusione Lama Murasame / Fusion Sword Murasame Blade
            { id: 727, qty: 1 }, // SD5-EN027 Flamberga Spezza-Malvagi - Baou / Wicked-Breaking Flamberge - Baou
            { id: 728, qty: 1 }, // SD5-EN028 Fata della Sorgente / Fairy of the Spring
            { id: 649, qty: 1 }, // SD5-EN029 Ricarica / Reload
            { id: 729, qty: 1 }, // SD5-EN030 Fulmine Boltex / Lightning Vortex
            { id: 730, qty: 1 }, // SD5-EN031 Spade Mistificatrici / Swords of Concealing Light
            { id: 415, qty: 1 }, // SD5-EN032 Rimozione della Restrizione / Release Restraint
            { id: 136, qty: 1 }, // SD5-EN033 Richiamo del Posseduto / Call of the Haunted
            { id: 361, qty: 2 }, // SD5-EN034 Disturbo Magico / Magic Jammer (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 426, qty: 1 }, // SD5-EN035 Decreto Reale / Royal Decree
            { id: 732, qty: 1 }  // SD5-EN036 Esplosione a Catena / Blast with Chain
        ],
        extra: []
    },
    {
        packId: 'structure_sd6_spellcasters_judgment',
        kind: 'structure',
        name: 'Structure Deck: Spellcaster\'s Judgment (SD6)',
        year: 2006,
        description: 'Mazzo tematico dedicato ai mostri Tipo Incantatore, con Mago Nero e Ragazza Maga Nera come punte di diamante.',
        // CORREZIONE di fedeltà, stesso motivo dei mazzi precedenti.
        // Confermate via ricerca mirata Abile Mago Oscuro/Mago
        // Apprendista/Maga della Fede (2 copie ciascuna); la quarta
        // copia mancante per arrivare a 40 (Biblioteca Magica Reale,
        // portata a 2) è una stima, non un dato confermato.
        main: [
            { id: 733, qty: 1 }, // SD6-EN001 Stregone Oscuro Eradicatore / Dark Eradicator Warlock
            { id: 734, qty: 1 }, // SD6-EN002 Cerbero Mitica Bestia / Mythical Beast Cerberus
            { id: 2, qty: 1 },   // SD6-EN003 Mago Nero / Dark Magician
            { id: 24, qty: 1 },  // SD6-EN004 Elfi Gemelli / Gemini Elf
            { id: 588, qty: 2 }, // SD6-EN005 Mago della Fede / Magician of Faith
            { id: 736, qty: 2 }, // SD6-EN006 Abile Mago Nero / Skilled Dark Magician
            { id: 737, qty: 2 }, // SD6-EN007 Mago Apprendista / Apprentice Magician
            { id: 738, qty: 1 }, // SD6-EN008 Mago Ordine del Chaos / Chaos Command Magician
            { id: 131, qty: 1 }, // SD6-EN009 Breaker il Guerriero Magico / Breaker the Magical Warrior
            { id: 615, qty: 2 }, // SD6-EN010 Biblioteca Reale Magica / Royal Magical Library (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 739, qty: 1 }, // SD6-EN011 Tsukuyomi
            { id: 740, qty: 1 }, // SD6-EN012 Stregone del Chaos / Chaos Sorcerer
            { id: 741, qty: 1 }, // SD6-EN013 Maga Bianca Pikeru / White Magician Pikeru
            { id: 742, qty: 1 }, // SD6-EN014 Mago del Sangue / Blast Magician
            { id: 743, qty: 1 }, // SD6-EN015 Curran Maga d'Ebano / Ebon Magician Curran
            { id: 744, qty: 1 }, // SD6-EN016 Mago Fuoco-Rapido / Rapid-Fire Magician
            { id: 745, qty: 1 }, // SD6-EN017 Esplosione Magica / Magical Blast
            { id: 607, qty: 1 }, // SD6-EN018 Tifone Spaziale Mistico / Mystical Space Typhoon
            { id: 632, qty: 1 }, // SD6-EN019 Nobiluomo dello Scambio / Nobleman of Crossout
            { id: 633, qty: 1 }, // SD6-EN020 Sepoltura Prematura / Premature Burial
            { id: 8, qty: 1 },   // SD6-EN021 Spada Rivelatrice / Swords of Revealing Light
            { id: 746, qty: 1 }, // SD6-EN022 Potere del Mago / Mage Power
            { id: 646, qty: 1 }, // SD6-EN023 Tempesta Potente / Heavy Storm
            { id: 747, qty: 1 }, // SD6-EN024 Onda di Diffusione / Diffusion Wave-Motion
            { id: 649, qty: 1 }, // SD6-EN025 Ricarica / Reload
            { id: 748, qty: 1 }, // SD6-EN026 Attacco Mago Nero / Dark Magic Attack
            { id: 749, qty: 1 }, // SD6-EN027 Assorbimento Magico / Spell Absorption
            { id: 729, qty: 1 }, // SD6-EN028 Fulmine Boltex / Lightning Vortex
            { id: 362, qty: 1 }, // SD6-EN029 Dimensione Magica / Magical Dimension
            { id: 388, qty: 1 }, // SD6-EN030 Scatola Magica / Mystic Box
            { id: 750, qty: 1 }, // SD6-EN031 Gabbia d'Acciaio dell'Incubo / Nightmare's Steelcage
            { id: 136, qty: 1 }, // SD6-EN032 Richiamo del Posseduto / Call of the Haunted
            { id: 689, qty: 1 }, // SD6-EN033 Scudo Magico Tipo-8 / Spell Shield Type-8
            { id: 751, qty: 1 }, // SD6-EN034 Pietra del Potere Nero-Pece / Pitch-Black Power Stone
            { id: 752, qty: 1 }, // SD6-EN035 Ira Divina / Divine Wrath
            { id: 10, qty: 1 }   // SD6-EN036 Cilindro Magico / Magic Cylinder
        ],
        extra: []
    },
    {
        packId: 'structure_sd7_invincible_fortress',
        kind: 'structure',
        name: 'Structure Deck: Invincible Fortress (SD7)',
        year: 2006,
        // Exxod è la SD7-EN001, la carta di punta con cui il mazzo è
        // venduto: la scelta automatica (mostro con l'ATK più alto)
        // pescava un altro mostro, vedi coverCardId su SDY.
        coverCardId: 753, // Exxod, Maestro della Guardia

        description: 'Mazzo tematico difensivo, costruito attorno a mostri resistenti e a Trappole di controllo del campo.',
        // CORREZIONE di fedeltà, stesso motivo dei mazzi precedenti.
        // Confermate via ricerca mirata Ratto Gigante (3 copie) e
        // Gigantes (2 copie); le altre 5 copie mancanti per arrivare a
        // 40 (Waboku, Goblin Ladro, Avidità Sconsiderata, Dispositivo di
        // Evacuazione Forzata, Drenaggio Magico, tutte portate a 2) sono
        // una stima, non un dato confermato — il rendimento delle
        // ricerche mirate è stato basso per questo mazzo.
        main: [
            { id: 753, qty: 1 }, // SD7-EN001 Exxod, Maestro della Guardia
            { id: 754, qty: 1 }, // SD7-EN002 Grande Spirito / Great Spirit
            { id: 614, qty: 3 }, // SD7-EN003 Ratto Gigante / Giant Rat
            { id: 755, qty: 1 }, // SD7-EN004 Maharaghi
            { id: 756, qty: 1 }, // SD7-EN005 Sfinge Guardiana / Guardian Sphinx
            { id: 757, qty: 2 }, // SD7-EN006 Gigantes
            { id: 758, qty: 1 }, // SD7-EN007 Statua di Pietra degli Aztechi / Stone Statue of the Aztecs
            { id: 759, qty: 1 }, // SD7-EN008 Golem Guardiano / Golem Sentry
            { id: 760, qty: 1 }, // SD7-EN009 Hieracosfinge / Hieracosphinx
            { id: 761, qty: 1 }, // SD7-EN010 Criosfinge / Criosphinx
            { id: 762, qty: 1 }, // SD7-EN011 Cannoni d'Intercettazione Moai / Moai Interceptor Cannons
            { id: 763, qty: 1 }, // SD7-EN012 Drago Megaroccia / Megarock Dragon
            { id: 764, qty: 1 }, // SD7-EN013 Statua Guardiana / Guardian Statue
            { id: 765, qty: 1 }, // SD7-EN014 Verme Medusa / Medusa Worm
            { id: 766, qty: 1 }, // SD7-EN015 Falena di Sabbia / Sand Moth
            { id: 767, qty: 1 }, // SD7-EN016 Canyon
            { id: 607, qty: 1 }, // SD7-EN017 Tifone Spaziale Mistico / Mystical Space Typhoon
            { id: 633, qty: 1 }, // SD7-EN018 Sepoltura Prematura / Premature Burial
            { id: 8, qty: 1 },   // SD7-EN019 Spada Rivelatrice / Swords of Revealing Light
            { id: 440, qty: 1 }, // SD7-EN020 Scudo e Spada / Shield & Sword
            { id: 768, qty: 1 }, // SD7-EN021 Maglio Magico / Magical Mallet
            { id: 705, qty: 1 }, // SD7-EN022 Lancio del Martello / Hammer Shot
            { id: 221, qty: 1 }, // SD7-EN023 Ectoplasmatore / Ectoplasmer
            { id: 130, qty: 1 }, // SD7-EN024 Controllo della Mente / Brain Control
            { id: 769, qty: 1 }, // SD7-EN025 Ombre Danzanti / Shifting Shadows
            { id: 503, qty: 2 }, // SD7-EN026 Waboku (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 559, qty: 1 }, // SD7-EN027 Ultima Offerta / Ultimate Offering
            { id: 770, qty: 2 }, // SD7-EN028 Risucchio Magico / Magic Drain (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 610, qty: 2 }, // SD7-EN029 Goblin Ladro / Robbin' Goblin (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 771, qty: 2 }, // SD7-EN030 Prova del Viaggiatore / Ordeal of a Traveler (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 653, qty: 2 }, // SD7-EN031 Cupidigia Insaziabile / Reckless Greed (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 671, qty: 1 }  // SD7-EN032 Dispositivo di Salvataggio Obbligatorio / Compulsory Evacuation Device
        ],
        extra: []
    },
    {
        packId: 'structure_sd8_lord_of_the_storm',
        kind: 'structure',
        name: 'Structure Deck: Lord of the Storm (SD8)',
        year: 2007,
        description: 'Mazzo tematico dedicato ai mostri Tipo Bestia Alata e agli effetti legati all\'Attributo VENTO.',
        // CORREZIONE di fedeltà, stesso motivo dei mazzi precedenti — per
        // questo mazzo la ricerca mirata non ha restituito alcuna
        // quantità confermata (fonti irraggiungibili per il fetch
        // diretto, nessun frammento utile nei risultati testuali): le 4
        // copie extra per arrivare a 40 (Anatra Sonica, Mosca Lama,
        // Faccia di Uccello, Egoista Elegante, tutte portate a 2) sono
        // una stima interamente non confermata.
        main: [
            { id: 772, qty: 1 }, // SD8-EN001 Simorgh, Volatile della Divinità
            { id: 773, qty: 1 }, // SD8-EN002 Proiettile Sonico / Sonic Shooter
            { id: 774, qty: 2 }, // SD8-EN003 Papera Sonica / Sonic Duck (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 775, qty: 1 }, // SD8-EN004 Ragazza Arpia / Harpie Girl
            { id: 776, qty: 1 }, // SD8-EN005 Guerriero di Ardesia / Slate Warrior
            { id: 248, qty: 1 }, // SD8-EN006 Kamakiri Volante #1 / Flying Kamakiri #1
            { id: 290, qty: 1 }, // SD8-EN007 Sorelle Arpie / Harpie Lady Sisters
            { id: 777, qty: 2 }, // SD8-EN008 Volama / Bladefly (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 778, qty: 2 }, // SD8-EN009 Faccia da Uccello / Birdface (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 779, qty: 1 }, // SD8-EN010 Silpheed
            { id: 780, qty: 1 }, // SD8-EN011 Ninja Signora Yae / Lady Ninja Yae
            { id: 781, qty: 1 }, // SD8-EN012 Roc dalla Valle della Nebbia / Roc from the Valley of Haze
            { id: 782, qty: 1 }, // SD8-EN013 Lady Arpia 1 / Harpie Lady 1
            { id: 783, qty: 1 }, // SD8-EN014 Lady Arpia 2 / Harpie Lady 2
            { id: 784, qty: 1 }, // SD8-EN015 Lady Arpia 3 / Harpie Lady 3
            { id: 785, qty: 1 }, // SD8-EN016 Joe Veloce Uomo Alato / Swift Birdman Joe
            { id: 786, qty: 1 }, // SD8-EN017 Cucciolo di Drago delle Arpie / Harpie's Pet Baby Dragon
            { id: 138, qty: 1 }, // SD8-EN018 Distruggi-Carte / Card Destruction
            { id: 607, qty: 1 }, // SD8-EN019 Tifone Spaziale Mistico / Mystical Space Typhoon
            { id: 632, qty: 1 }, // SD8-EN020 Nobiluomo dello Scambio / Nobleman of Crossout
            { id: 787, qty: 2 }, // SD8-EN021 Egotista Elegante / Elegant Egotist (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 646, qty: 1 }, // SD8-EN022 Tempesta Potente / Heavy Storm
            { id: 649, qty: 1 }, // SD8-EN023 Ricarica / Reload
            { id: 788, qty: 1 }, // SD8-EN024 Terreno di Caccia delle Arpie / Harpies' Hunting Ground
            { id: 789, qty: 1 }, // SD8-EN025 Scintilla d'Estasi Triangolare / Triangle Ecstasy Spark
            { id: 729, qty: 1 }, // SD8-EN026 Fulmine Boltex / Lightning Vortex
            { id: 790, qty: 1 }, // SD8-EN027 Festa Isterica / Hysteric Party
            { id: 791, qty: 1 }, // SD8-EN028 Coro Acquatico / Aqua Chorus
            { id: 219, qty: 1 }, // SD8-EN029 Tornado di Polvere / Dust Tornado
            { id: 136, qty: 1 }, // SD8-EN030 Richiamo del Posseduto / Call of the Haunted
            { id: 361, qty: 1 }, // SD8-EN031 Disturbo Magico / Magic Jammer
            { id: 792, qty: 1 }, // SD8-EN032 Bara Oscura / Dark Coffin
            { id: 653, qty: 1 }, // SD8-EN033 Cupidigia Insaziabile / Reckless Greed
            { id: 793, qty: 1 }, // SD8-EN034 Armatura Sakuretsu / Sakuretsu Armor
            { id: 794, qty: 1 }, // SD8-EN035 Arte della Trasformazione Ninjitsu / Ninjitsu Art of Transformation
            { id: 795, qty: 1 }  // SD8-EN036 Attacco Icaro / Icarus Attack
        ],
        extra: []
    },
    {
        packId: 'structure_sd9_dinosaurs_rage',
        kind: 'structure',
        name: 'Structure Deck: Dinosaur\'s Rage (SD9)',
        year: 2007,
        description: 'Mazzo tematico dedicato ai mostri Tipo Dinosauro e alla loro forza d\'attacco brutale.',
        // CORREZIONE di fedeltà, stesso motivo dei mazzi precedenti.
        // Confermate via ricerca mirata Idrogeddon e Gilasaurus (2 copie
        // ciascuna); le altre 2 copie mancanti per arrivare a 40
        // (Ossigeddon, Grande Pillola Evolutiva, portate a 2) sono una
        // stima, non un dato confermato.
        main: [
            { id: 796, qty: 1 }, // SD09-EN001 Tiranno Super Conduttore / Super Conductor Tyranno
            { id: 797, qty: 1 }, // SD09-EN002 Kabazauls
            { id: 798, qty: 1 }, // SD09-EN003 Sabersaurus
            { id: 360, qty: 1 }, // SD09-EN004 Bestia della Spada Folle / Mad Sword Beast
            { id: 266, qty: 2 }, // SD09-EN005 Gilasaurus
            { id: 799, qty: 1 }, // SD09-EN006 Triceratopo Oscuro / Dark Driceratops
            { id: 800, qty: 1 }, // SD09-EN007 Iper Testa-Martello / Hyper Hammerhead
            { id: 801, qty: 1 }, // SD09-EN008 Tiranno Oscuro / Black Tyranno
            { id: 802, qty: 1 }, // SD09-EN009 Infinità Tiranno / Tyranno Infinity
            { id: 803, qty: 2 }, // SD09-EN010 Idrogeddon / Hydrogeddon
            { id: 804, qty: 2 }, // SD09-EN011 Ossigeddon / Oxygeddon (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 805, qty: 1 }, // SD09-EN012 Pterodattilo Nero / Black Ptera
            { id: 806, qty: 1 }, // SD09-EN013 Stegosauro Oscuro / Black Stego
            { id: 807, qty: 1 }, // SD09-EN014 Tirannosauro Finale / Ultimate Tyranno
            { id: 808, qty: 1 }, // SD09-EN015 Uovo Giurassico Miracoloso / Miracle Jurassic Egg
            { id: 809, qty: 1 }, // SD09-EN016 Bebè Cerasauro / Babycerasaurus
            { id: 810, qty: 2 }, // SD09-EN017 Pillola dell'Evoluzione Gigante / Big Evolution Pill (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 811, qty: 1 }, // SD09-EN018 Spazzata di Coda / Tail Swipe
            { id: 812, qty: 1 }, // SD09-EN019 Mondo Giurassico / Jurassic World
            { id: 813, qty: 1 }, // SD09-EN020 Benedizione di Sebek / Sebek's Blessing
            { id: 421, qty: 1 }, // SD09-EN021 Riryoku
            { id: 814, qty: 1 }, // SD09-EN022 Controllo Mesmerico / Mesmeric Control
            { id: 607, qty: 1 }, // SD09-EN023 Tifone Spaziale Mistico / Mystical Space Typhoon
            { id: 631, qty: 1 }, // SD09-EN024 Megamorfosi / Megamorph
            { id: 646, qty: 1 }, // SD09-EN025 Tempesta Potente / Heavy Storm
            { id: 729, qty: 1 }, // SD09-EN026 Fulmine Boltex / Lightning Vortex
            { id: 768, qty: 1 }, // SD09-EN027 Maglio Magico / Magical Mallet
            { id: 815, qty: 1 }, // SD09-EN028 Istinto di Caccia / Hunting Instinct
            { id: 816, qty: 1 }, // SD09-EN029 Istinto di Sopravvivenza / Survival Instinct
            { id: 817, qty: 1 }, // SD09-EN030 Eruzione Vulcanica / Volcanic Eruption
            { id: 818, qty: 1 }, // SD09-EN031 Onda d'Urto Sismica / Seismic Shockwave
            { id: 819, qty: 1 }, // SD09-EN032 Scudo da Braccio Magico / Magical Arm Shield
            { id: 820, qty: 1 }, // SD09-EN033 Annulla Attacco / Negate Attack
            { id: 821, qty: 1 }, // SD09-EN034 Goblin Fuori dalla Padella / Goblin Out of the Frying Pan
            { id: 822, qty: 1 }, // SD09-EN035 Malfunzionamento / Malfunction
            { id: 823, qty: 1 }  // SD09-EN036 Scavo Fossile / Fossil Excavation
        ],
        extra: []
    },
    {
        packId: 'structure_sd10_machine_revolt',
        kind: 'structure',
        name: 'Structure Deck: Machine Re-Volt (SD10)',
        year: 2007,
        description: 'Mazzo tematico dedicato ai mostri Tipo Macchina e alle loro combinazioni Union.',
        // CORREZIONE di fedeltà, stesso motivo dei mazzi precedenti — per
        // questo mazzo la ricerca mirata non ha restituito alcuna
        // quantità confermata: le 3 copie extra per arrivare a 40
        // (MechanicalChaser, Ingranaggio Antico, Esplosivo Ingranaggio
        // Antico, tutte portate a 2) sono una stima interamente non
        // confermata.
        main: [
            { id: 824, qty: 1 }, // SD10-EN001 Drago Gadjiltron-Ingranaggio Antico / Ancient Gear Gadjiltron Dragon
            { id: 825, qty: 1 }, // SD10-EN002 Chimera Gadjiltron-Ingranaggio Antico / Ancient Gear Gadjiltron Chimera
            { id: 826, qty: 1 }, // SD10-EN003 Ingegnere-Ingranaggio Antico / Ancient Gear Engineer
            { id: 827, qty: 1 }, // SD10-EN004 Soldato Accensione - Dinamo del Terrore / Boot-Up Soldier - Dread Dynamo
            { id: 373, qty: 2 }, // SD10-EN005 MechanicalChaser (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 828, qty: 1 }, // SD10-EN006 Congegno Verde / Green Gadget
            { id: 829, qty: 1 }, // SD10-EN007 Congegno Rosso / Red Gadget
            { id: 830, qty: 1 }, // SD10-EN008 Congegno Giallo / Yellow Gadget
            { id: 137, qty: 1 }, // SD10-EN009 Soldato-Cannone / Cannon Soldier
            { id: 257, qty: 1 }, // SD10-EN010 Golem-Ingranaggio, la Fortezza Movente / Gear Golem the Moving Fortress
            { id: 831, qty: 1 }, // SD10-EN011 Piattaforma di Supporto per Mezzi Pesanti / Heavy Mech Support Platform
            { id: 832, qty: 1 }, // SD10-EN012 Golem-Ingranaggio Antico / Ancient Gear Golem
            { id: 833, qty: 1 }, // SD10-EN013 Bestia-Ingranaggio Antico / Ancient Gear Beast
            { id: 834, qty: 1 }, // SD10-EN014 Soldato-Ingranaggio Antico / Ancient Gear Soldier
            { id: 835, qty: 2 }, // SD10-EN015 Ingranaggio Antico / Ancient Gear (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 836, qty: 1 }, // SD10-EN016 Cannone-Ingranaggio Antico / Ancient Gear Cannon
            { id: 837, qty: 1 }, // SD10-EN017 Laboratorio-Ingranaggio Antico / Ancient Gear Workshop
            { id: 838, qty: 1 }, // SD10-EN018 Carro Armato-Ingranaggio Antico / Ancient Gear Tank
            { id: 839, qty: 2 }, // SD10-EN019 Esplosivo-Ingranaggio Antico / Ancient Gear Explosive (quantità NON confermata, stimata per far quadrare il totale a 40)
            { id: 840, qty: 1 }, // SD10-EN020 Pugno-Ingranaggio Antico / Ancient Gear Fist
            { id: 841, qty: 1 }, // SD10-EN021 Fabbrica-Ingranaggio Antico / Ancient Gear Factory
            { id: 842, qty: 1 }, // SD10-EN022 Trivella-Ingranaggio Antico / Ancient Gear Drill
            { id: 843, qty: 1 }, // SD10-EN023 Castello-Ingranaggio Antico / Ancient Gear Castle
            { id: 607, qty: 1 }, // SD10-EN024 Tifone Spaziale Mistico / Mystical Space Typhoon
            { id: 350, qty: 1 }, // SD10-EN025 Rimozione di Limite / Limiter Removal
            { id: 646, qty: 1 }, // SD10-EN026 Tempesta Potente / Heavy Storm
            { id: 226, qty: 1 }, // SD10-EN027 Controlla-Avversario / Enemy Controller
            { id: 846, qty: 1 }, // SD10-EN028 Cambio-Arma / Weapon Change
            { id: 847, qty: 1 }, // SD10-EN029 Duplicazione di Macchine / Machine Duplication
            { id: 848, qty: 1 }, // SD10-EN030 Giara dell'Avarizia / Pot of Avarice
            { id: 849, qty: 1 }, // SD10-EN031 Roccaforte della Fortezza Movente / Stronghold the Moving Fortress
            { id: 559, qty: 1 }, // SD10-EN032 Ultima Offerta / Ultimate Offering
            { id: 793, qty: 1 }, // SD10-EN033 Armatura Sakuretsu / Sakuretsu Armor
            { id: 850, qty: 1 }, // SD10-EN034 Micro Raggio / Micro Ray
            { id: 851, qty: 1 }, // SD10-EN035 Metamorfosi Rara / Rare Metalmorph
            { id: 852, qty: 1 }, // SD10-EN036 Fuoco di Copertura / Covering Fire
            { id: 853, qty: 1 }  // SD10-EN037 Attaccati! / Roll Out!
        ],
        extra: []
    },

    // --- Grande Guerra ---------------------------------------------------
    // Non e' un prodotto reale del gioco vero come tutti quelli qui sopra:
    // e' il mazzo con cui si gioca la campagna della Grande Guerra
    // (js/data/story-campaigns.js), che accetta SOLO carte del set WW1 di
    // schieramento italiano. Senza, quella campagna sarebbe dichiarata e
    // ingiocabile: nessun giocatore ha un mazzo del genere per caso.
    //
    // 40 carte esatte dalle 25 italiane disponibili — le copie arrivano a
    // 3 per forza, con 25 carte e 40 slot.
    {
        packId: 'ww1_regio_esercito',
        kind: 'structure',
        name: 'Regio Esercito (Grande Guerra)',
        year: 1918,
        coverCardId: 1205, // Armando Diaz, Duca della Vittoria
        description: 'Il mazzo del fronte italiano: fanteria, Alpini, Bersaglieri e Arditi, con Baracca e Diaz a guidarli. Serve per giocare la campagna della Grande Guerra, che non accetta carte di altri set né dello schieramento avversario.',
        main: [
            { id: 1205, qty: 1 },  // Armando Diaz — il comandante
            { id: 1200, qty: 1 },  // Francesco Baracca — l'asso
            { id: 1206, qty: 2 },  // Emanuele Filiberto, Duca d'Aosta
            { id: 1201, qty: 2 },  // Caproni Ca.3
            { id: 1204, qty: 2 },  // Cannone da 149/35
            { id: 1209, qty: 2 },  // Gabriele d'Annunzio
            { id: 1213, qty: 3 },  // Arditi
            { id: 1207, qty: 2 },  // Enrico Toti
            { id: 1202, qty: 2 },  // SPAD S.XIII
            { id: 1203, qty: 2 },  // Nieuport 11
            { id: 1211, qty: 3 },  // Bersagliere
            { id: 1212, qty: 3 },  // Alpino
            { id: 1208, qty: 2 },  // Cesare Battisti
            { id: 1210, qty: 3 },  // Fante del Regio Esercito
            { id: 1214, qty: 1 },  // Mitragliere
            { id: 1217, qty: 2 },  // Trincea della Terza Armata
            { id: 1216, qty: 1 },  // Ordine di Assalto
            { id: 1218, qty: 1 },  // Cavallino Rampante
            { id: 1219, qty: 1 },  // Rinforzi dal Piave
            { id: 1215, qty: 1 },  // Il Bollettino della Vittoria
            { id: 1220, qty: 1 },  // Ospedale da Campo
            { id: 1222, qty: 1 },  // Contrattacco sul Grappa
            { id: 1223, qty: 1 }   // Sbarramento d'Artiglieria
        ],
        extra: []
    }
];

function getStarterStructureDeck(packId) {
    return starterStructureDeckDatabase.find((d) => d.packId === packId) || null;
}
