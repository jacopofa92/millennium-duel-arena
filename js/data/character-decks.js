/**
 * character-decks.js — I mazzi dei Duellanti, uno per livello di difficoltà.
 * ------------------------------------------------------------------
 * Ogni Duellante ha TRE mazzi scritti per esteso — easy (Facile), medium
 * (Normale), hard (Difficile) — e non un mazzo base trasformato al volo.
 * Una versione precedente derivava Facile e Normale dal mazzo base con
 * scambi automatici: rispettava ogni regola scritta ma produceva mazzi
 * che nessuno avrebbe composto a mano (un Facile di Kaiba con tre
 * Armature Sakuretsu, pieno di mostri da Tributo e senza una sola carta
 * difensiva). Tre liste esplicite si leggono, si correggono a mano e si
 * vedono una per una da Creazione Deck ("Vedi Facile/Normale/Difficile").
 *
 * FEDELTÀ: ogni mazzo segue il mazzo vero del personaggio nell'anime o nel
 * gioco da cui viene (il commento sopra ciascuno dice cosa e perché), con
 * le carte che il gioco ha davvero — quando una carta canonica manca, al
 * suo posto c'è la più vicina per ruolo, e il commento lo dice.
 *
 * Ogni lista è { id, qty } (id = carta in data/cards.json, qty = copie,
 * massimo 3). `flagship` è la carta simbolo del personaggio: resta
 * identica in tutti e tre i livelli (richiesta dell'utente: il Mago Nero
 * di Yugi o il Drago Bianco di Kaiba non si toccano mai).
 *
 * Le regole che distinguono i tre livelli sono più sotto
 * (REGOLE_PER_LIVELLO/validaMazzoPersonaggio) e il test
 * tests/specs/mazzi-livello-facile.spec.js le verifica su ogni mazzo:
 * un Duellante nuovo va scritto rispettandole, o il test fallisce.
 */
const characterDeckDatabase = {
    // Yugi Muto: il mazzo del Regno dei Duellanti ereditato dal nonno — mostri
    // Normali TERRA/OSCURITÀ (Guerriero Celtico, Gaia, Castoro Guerriero, Zanna d'Argento,
    // Soldato di Pietra Gigante), Mago Nero come colonna portante e le cinque parti di
    // Exodia, con le sue carte simbolo Spada Rivelatrice, Cerchio Ammaliante e Moltiplicazione.
    // Difficile aggiunge il Guerriero Nero Supremo (rituale) e la Maga Oscura di Battle City.
    // Facile toglie Exodia (una vittoria istantanea non è da livello facile).
    yugiMuto: {
        flagship: 2, // Mago Nero — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 2, qty: 3 }, // Mago Nero
                { id: 109, qty: 3 }, // Castoro Guerriero
                { id: 444, qty: 2 }, // Zanna d'Argento
                { id: 237, qty: 2 }, // Folletto Selvaggio Feroce
                { id: 391, qty: 3 }, // Elfa Mistica
                { id: 261, qty: 2 }, // Soldato di Pietra Gigante
                { id: 22, qty: 3 }, // Kuriboh
                { id: 115, qty: 1 }, // Gran Scudo Gardna
                { id: 367, qty: 2 }, // Cimitero dei Mammut
                { id: 4, qty: 1 }, // Guerriero Celtico
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 620, qty: 1 }, // Cerchio Ammaliante
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 386, qty: 1 }, // Moltiplicazione
                { id: 363, qty: 1 }, // Cappelli Magici
                { id: 206, qty: 1 }, // Vaso Cattura-Drago
                { id: 263, qty: 1 }, // Dono dell'Elfa Mistica
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 503, qty: 1 }, // Waboku
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 474, qty: 1 }, // Mille Coltelli
                { id: 546, qty: 1 } // Dian Keto la Maestra delle Cure
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 2, qty: 3 }, // Mago Nero
                { id: 4, qty: 2 }, // Guerriero Celtico
                { id: 14, qty: 1 }, // Gaia il Cavaliere Feroce
                { id: 15, qty: 1 }, // Maledizione del Drago
                { id: 109, qty: 2 }, // Castoro Guerriero
                { id: 237, qty: 1 }, // Folletto Selvaggio Feroce
                { id: 391, qty: 2 }, // Elfa Mistica
                { id: 261, qty: 1 }, // Soldato di Pietra Gigante
                { id: 13, qty: 1 }, // Teschio Evocato
                { id: 22, qty: 2 }, // Kuriboh
                { id: 115, qty: 1 }, // Gran Scudo Gardna
                { id: 28, qty: 1 }, // Mago del Tempo
                { id: 41, qty: 1 }, // Testa Proibita
                { id: 42, qty: 1 }, // Braccio Sx del Proibito
                { id: 11, qty: 1 }, // Braccio Dx Del Proibito
                { id: 44, qty: 1 }, // Gamba Sx del Proibito
                { id: 43, qty: 1 }, // Gamba Dx del Proibito
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 620, qty: 1 }, // Cerchio Ammaliante
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 147, qty: 1 }, // Cambio di Cuore
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 386, qty: 1 }, // Moltiplicazione
                { id: 363, qty: 1 }, // Cappelli Magici
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 7, qty: 1 }, // Buco Nero
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 206, qty: 1 }, // Vaso Cattura-Drago
                { id: 474, qty: 1 }, // Mille Coltelli
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 263, qty: 1 } // Dono dell'Elfa Mistica
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 2, qty: 3 }, // Mago Nero
                { id: 4, qty: 2 }, // Guerriero Celtico
                { id: 14, qty: 1 }, // Gaia il Cavaliere Feroce
                { id: 15, qty: 1 }, // Maledizione del Drago
                { id: 109, qty: 1 }, // Castoro Guerriero
                { id: 237, qty: 1 }, // Folletto Selvaggio Feroce
                { id: 391, qty: 1 }, // Elfa Mistica
                { id: 261, qty: 1 }, // Soldato di Pietra Gigante
                { id: 13, qty: 1 }, // Teschio Evocato
                { id: 22, qty: 2 }, // Kuriboh
                { id: 28, qty: 1 }, // Mago del Tempo
                { id: 41, qty: 1 }, // Testa Proibita
                { id: 42, qty: 1 }, // Braccio Sx del Proibito
                { id: 11, qty: 1 }, // Braccio Dx Del Proibito
                { id: 44, qty: 1 }, // Gamba Sx del Proibito
                { id: 43, qty: 1 }, // Gamba Dx del Proibito
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 620, qty: 1 }, // Cerchio Ammaliante
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 147, qty: 1 }, // Cambio di Cuore
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 386, qty: 1 }, // Moltiplicazione
                { id: 363, qty: 1 }, // Cappelli Magici
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 7, qty: 1 }, // Buco Nero
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 206, qty: 1 }, // Vaso Cattura-Drago
                { id: 474, qty: 1 }, // Mille Coltelli
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 55, qty: 1 }, // Guerriero Nero Supremo
                { id: 56, qty: 1 }, // Rito del Guerriero Nero
                { id: 188, qty: 1 }, // Maga Oscura
                { id: 382, qty: 1 } // Forza dello Specchio
            ],
            extra: []
        }
    },

    // Yami Yugi, dalle finali di Battle City: Mago Nero e Maga Oscura, Buster
    // Blader (per il Paladino Oscuro), Gazelle e Berfomet (per la Chimera), Kuriboh con
    // Moltiplicazione, Gran Scudo Gardna, i Guerrieri Magnetici, il Guerriero Nero Supremo;
    // Spada Rivelatrice, Cappelli Magici, Mille Coltelli, Attacco Magico Oscuro, Dimensione
    // Magica, Pietra del Saggio, Anello della Distruzione. Difficile aggiunge Slifer il Drago
    // del Cielo (una copia, come nell'anime) e il Mago del Caos Nero.
    yamiYugi: {
        flagship: 2, // Mago Nero — la singola copia canonica resta in tutti e tre i livelli
        easy: {
            main: [
                { id: 2, qty: 1 }, // Mago Nero — Yugi ne possiede una sola copia nell'anime
                { id: 261, qty: 2 }, // Soldato di Pietra Gigante
                { id: 22, qty: 3 }, // Kuriboh
                { id: 115, qty: 2 }, // Gran Scudo Gardna
                { id: 4, qty: 1 }, // Guerriero Celtico
                { id: 391, qty: 3 }, // Elfa Mistica
                { id: 109, qty: 2 }, // Castoro Guerriero
                { id: 532, qty: 1 }, // Gazelle, Re delle Bestie Mitiche
                { id: 194, qty: 2 }, // Illusionista dagli Occhi Oscuri
                { id: 237, qty: 2 }, // Folletto Selvaggio Feroce
                { id: 444, qty: 2 }, // Zanna d'Argento
                { id: 8, qty: 2 }, // Spada Rivelatrice
                { id: 363, qty: 1 }, // Cappelli Magici
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 386, qty: 1 }, // Moltiplicazione
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 620, qty: 1 }, // Cerchio Ammaliante
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 503, qty: 1 }, // Waboku
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 263, qty: 1 }, // Dono dell'Elfa Mistica
                { id: 474, qty: 1 }, // Mille Coltelli
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 439, qty: 1 } // Incantesimo Ombra
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 2, qty: 1 }, // Mago Nero — una copia, sostenuta dalle carte dedicate sotto
                { id: 261, qty: 1 }, // Soldato di Pietra Gigante
                { id: 712, qty: 1 }, // Guardiano Celtico Sgradito
                { id: 188, qty: 1 }, // Maga Oscura
                { id: 20, qty: 1 }, // Buster Blader
                { id: 532, qty: 1 }, // Gazelle, Re delle Bestie Mitiche
                { id: 533, qty: 1 }, // Berfomet
                { id: 22, qty: 2 }, // Kuriboh
                { id: 115, qty: 1 }, // Gran Scudo Gardna
                { id: 4, qty: 2 }, // Guerriero Celtico
                { id: 85, qty: 1 }, // Alpha il Guerriero Magnetico
                { id: 112, qty: 1 }, // Beta il Guerriero Magnetico
                { id: 391, qty: 1 }, // Elfa Mistica
                { id: 738, qty: 1 }, // Mago Comando del Caos
                { id: 13, qty: 1 }, // Teschio Evocato
                { id: 55, qty: 1 }, // Guerriero Nero Supremo
                { id: 109, qty: 1 }, // Castoro Guerriero
                { id: 194, qty: 1 }, // Illusionista dagli Occhi Oscuri
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 363, qty: 1 }, // Cappelli Magici
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 7, qty: 1 }, // Buco Nero
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 147, qty: 1 }, // Cambio di Cuore
                { id: 474, qty: 1 }, // Mille Coltelli
                { id: 748, qty: 1 }, // Attacco Magico Oscuro
                { id: 362, qty: 1 }, // Dimensione Magica
                { id: 386, qty: 1 }, // Moltiplicazione
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 430, qty: 1 }, // Pietra del Saggio
                { id: 56, qty: 1 }, // Rito del Guerriero Nero
                { id: 38, qty: 1 }, // Fusione
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 419, qty: 1 }, // Anello della Distruzione
                { id: 620, qty: 1 } // Cerchio Ammaliante
            ],
            extra: [
                { id: 189, qty: 1 }, // Paladino Oscuro
                { id: 149, qty: 1 } // Chimera la Bestia Mitica Volante
            ]
        },
        hard: {
            main: [
                { id: 2, qty: 1 }, // Mago Nero — una copia, come nell'anime
                { id: 261, qty: 1 }, // Soldato di Pietra Gigante
                { id: 712, qty: 1 }, // Guardiano Celtico Sgradito
                { id: 188, qty: 1 }, // Maga Oscura
                { id: 20, qty: 1 }, // Buster Blader
                { id: 532, qty: 1 }, // Gazelle, Re delle Bestie Mitiche
                { id: 533, qty: 1 }, // Berfomet
                { id: 22, qty: 2 }, // Kuriboh
                { id: 115, qty: 1 }, // Gran Scudo Gardna
                { id: 85, qty: 1 }, // Alpha il Guerriero Magnetico
                { id: 112, qty: 1 }, // Beta il Guerriero Magnetico
                { id: 391, qty: 1 }, // Elfa Mistica
                { id: 738, qty: 1 }, // Mago Comando del Caos
                { id: 13, qty: 1 }, // Teschio Evocato
                { id: 55, qty: 1 }, // Guerriero Nero Supremo
                { id: 109, qty: 1 }, // Castoro Guerriero
                { id: 194, qty: 1 }, // Illusionista dagli Occhi Oscuri
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 363, qty: 1 }, // Cappelli Magici
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 7, qty: 1 }, // Buco Nero
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 147, qty: 1 }, // Cambio di Cuore
                { id: 474, qty: 1 }, // Mille Coltelli
                { id: 748, qty: 1 }, // Attacco Magico Oscuro
                { id: 362, qty: 1 }, // Dimensione Magica
                { id: 386, qty: 1 }, // Moltiplicazione
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 430, qty: 1 }, // Pietra del Saggio
                { id: 56, qty: 1 }, // Rito del Guerriero Nero
                { id: 38, qty: 1 }, // Fusione
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 419, qty: 1 }, // Anello della Distruzione
                { id: 620, qty: 1 }, // Cerchio Ammaliante
                { id: 31, qty: 1 }, // Slifer il Drago del Cielo
                { id: 854, qty: 1 }, // Mago del Caos Nero
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 187, qty: 1 } // Rito della Magia Oscura
            ],
            extra: [
                { id: 189, qty: 1 }, // Paladino Oscuro
                { id: 149, qty: 1 } // Chimera la Bestia Mitica Volante
            ]
        }
    },

    // Seto Kaiba, mazzo di Battle City: i tre Drago Bianco Occhi Blu con il
    // Signore dei D. e Il Flauto per Evocare Draghi, Predone Vorse, Saggi il Pagliaccio
    // Oscuro, La Jinn, Kaiser Sea Horse, Drago Lancia, Drago della Dimensione Diversa, Kaiser
    // Glider, Uomo Giudice, e la linea dei cannoni Union — Cannone Testa X, Testa di Drago Y,
    // Carro Armato Metallico Z, con Cannone Drago XY/XYZ nell'Extra Deck (presenti da Normale
    // in su, richiesta esplicita). Carte simbolo: Controllore Nemico, Stop Difesa,
    // Trasportatore di Materia Interdimensionale, Nega Attacco. Difficile aggiunge Obelisk e
    // difese migliori, ma conserva due Signore/Flauti: l'audit Custom ha mostrato che sommare
    // anche il pacchetto Rituale rendeva troppe mani inutilizzabili. Facile tiene i Draghi
    // Bianchi ma senza cannoni e senza Flauto, con i suoi mostri deboli del Regno dei
    // Duellanti (Gigante Un Occhio, Cavaliere Mistico, Saggi).
    kaiba: {
        flagship: 1, // Drago Bianco Occhi Blu — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 1, qty: 3 }, // Drago Bianco Occhi Blu
                { id: 353, qty: 3 }, // Signore dei D.
                { id: 431, qty: 3 }, // Saggi il Pagliaccio Oscuro
                { id: 298, qty: 3 }, // Gigante Un Occhio
                { id: 389, qty: 3 }, // Cavaliere Mistico
                { id: 198, qty: 1 }, // Drago della Dimensione Diversa
                { id: 106, qty: 2 }, // Bue da Battaglia
                { id: 428, qty: 1 }, // Ryu-Kishin Potenziato
                { id: 321, qty: 1 }, // Kaiser Sea Horse
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 69, qty: 1 }, // Stop Difesa
                { id: 226, qty: 1 }, // Controllore del Nemico
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 312, qty: 1 }, // Trasportatore di Materia Interdimensionale
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 631, qty: 1 }, // Megamorfosi
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 607, qty: 1 }, // Tifone dello Spazio Mistico
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 1, qty: 3 }, // Drago Bianco Occhi Blu
                { id: 353, qty: 2 }, // Signore dei D.
                { id: 502, qty: 2 }, // Predone Vorse
                { id: 431, qty: 1 }, // Saggi il Pagliaccio Oscuro
                { id: 335, qty: 1 }, // La Jinn il Genio Mistico della Lampada
                { id: 510, qty: 2 }, // Cannone Testa X
                { id: 513, qty: 2 }, // Testa di Drago Y
                { id: 515, qty: 2 }, // Carro Armato Metallico Z
                { id: 321, qty: 1 }, // Kaiser Sea Horse
                { id: 454, qty: 1 }, // Drago Lancia
                { id: 198, qty: 1 }, // Drago della Dimensione Diversa
                { id: 320, qty: 1 }, // Kaiser Glider
                { id: 298, qty: 1 }, // Gigante Un Occhio
                { id: 389, qty: 1 }, // Cavaliere Mistico
                { id: 317, qty: 1 }, // Uomo Giudice
                { id: 578, qty: 2 }, // Il Flauto per Evocare Draghi
                { id: 38, qty: 1 }, // Fusione
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 226, qty: 2 }, // Controllore del Nemico
                { id: 69, qty: 1 }, // Stop Difesa
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 631, qty: 1 }, // Megamorfosi
                { id: 312, qty: 1 }, // Trasportatore di Materia Interdimensionale
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 607, qty: 1 } // Tifone dello Spazio Mistico
            ],
            extra: [
                { id: 29, qty: 1 }, // Drago Bianco Definitivo
                { id: 511, qty: 1 }, // Cannone Drago XY
                { id: 512, qty: 1 } // Cannone Drago XYZ
            ]
        },
        hard: {
            main: [
                { id: 1, qty: 3 }, // Drago Bianco Occhi Blu
                { id: 353, qty: 2 }, // Signore dei D.
                { id: 502, qty: 2 }, // Predone Vorse
                { id: 335, qty: 1 }, // La Jinn il Genio Mistico della Lampada
                { id: 510, qty: 2 }, // Cannone Testa X
                { id: 513, qty: 2 }, // Testa di Drago Y
                { id: 515, qty: 2 }, // Carro Armato Metallico Z
                { id: 321, qty: 1 }, // Kaiser Sea Horse
                { id: 454, qty: 1 }, // Drago Lancia
                { id: 198, qty: 1 }, // Drago della Dimensione Diversa
                { id: 320, qty: 1 }, // Kaiser Glider
                { id: 1263, qty: 1 }, // Luce Autentica — promossa dall'audit finale: rende piu' presente il Drago Bianco senza caricare il deck di supporti moderni
                { id: 578, qty: 2 }, // Il Flauto per Evocare Draghi
                { id: 38, qty: 1 }, // Fusione
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 226, qty: 2 }, // Controllore del Nemico
                { id: 69, qty: 1 }, // Stop Difesa
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 631, qty: 1 }, // Megamorfosi
                { id: 312, qty: 1 }, // Trasportatore di Materia Interdimensionale
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 607, qty: 1 }, // Tifone dello Spazio Mistico
                { id: 30, qty: 1 } // Obelisk il Tormentatore
            ],
            extra: [
                { id: 29, qty: 1 }, // Drago Bianco Definitivo
                { id: 511, qty: 1 }, // Cannone Drago XY
                { id: 512, qty: 1 } // Cannone Drago XYZ
            ]
        }
    },

    // Joey Wheeler, mazzo di Battle City: Drago Nero Occhi Rossi, i Guerrieri
    // "da strada" (Gearfried, Guerriero Pantera, Assalitore con l'Ascia, Ascia Tigre,
    // Spadaccino di Landstar, Cavaliere Hayabusa, Forza d'Attacco Goblin), Masaki e Signore
    // delle Fiamme per lo Spadaccino di Fuoco, Mago del Tempo e Cucciolo di Drago per il Drago
    // dei Mille, e il suo "mazzo d'azzardo": Dado Aggraziato, Dado Teschio, Ragno della
    // Roulette, Azzardo, Scatola delle Fate. Jinzo e il Pescatore Leggendario sono le carte
    // vinte a Espa Roba e a Mako. Niente Guerriero Celtico, Buster Blader, Gaia o Kuriboh:
    // sono carte di Yugi. Difficile aggiunge Gilford il Fulmine e Gearfried il Maestro di Spada.
    joey: {
        flagship: 12, // Drago Nero Occhi Rossi — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 12, qty: 3 }, // Drago Nero Occhi Rossi
                { id: 27, qty: 3 }, // Cucciolo di Drago
                { id: 28, qty: 1 }, // Mago del Tempo
                { id: 463, qty: 2 }, // Spadaccino di Landstar
                { id: 294, qty: 2 }, // Cavaliere Hayabusa
                { id: 369, qty: 2 }, // Masaki lo Spadaccino Leggendario
                { id: 539, qty: 2 }, // Signore delle Fiamme
                { id: 108, qty: 2 }, // Guerriero da Battaglia
                { id: 477, qty: 2 }, // Ascia Tigre
                { id: 422, qty: 1 }, // Grotta dell'Orco di Roccia #1
                { id: 83, qty: 1 }, // Spada di Alligatore
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 232, qty: 1 }, // Scatola delle Fate
                { id: 445, qty: 1 }, // Dado Teschio
                { id: 333, qty: 1 }, // Kunai con Catena
                { id: 440, qty: 1 }, // Scudo e Spada
                { id: 432, qty: 1 }, // Salamandra
                { id: 38, qty: 1 }, // Fusione
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 273, qty: 1 }, // Dado Aggraziato
                { id: 262, qty: 1 }, // Turbine Gigante
                { id: 276, qty: 1 }, // Tombarolo
                { id: 503, qty: 1 }, // Waboku
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 143, qty: 1 } // Mura del Castello
            ],
            extra: [
                { id: 84, qty: 1 } // Drago Spada di Alligatore
            ]
        },
        medium: {
            main: [
                { id: 12, qty: 3 }, // Drago Nero Occhi Rossi
                { id: 16, qty: 2 }, // Gearfried il Cavaliere di Ferro
                { id: 399, qty: 1 }, // Guerriero Pantera
                { id: 101, qty: 2 }, // Assalitore con l'Ascia
                { id: 879, qty: 1 }, // Il Pescatore Leggendario
                { id: 17, qty: 1 }, // Jinzo
                { id: 83, qty: 1 }, // Spada di Alligatore
                { id: 477, qty: 1 }, // Ascia Tigre
                { id: 369, qty: 1 }, // Masaki lo Spadaccino Leggendario
                { id: 539, qty: 1 }, // Signore delle Fiamme
                { id: 27, qty: 2 }, // Cucciolo di Drago
                { id: 28, qty: 1 }, // Mago del Tempo
                { id: 463, qty: 1 }, // Spadaccino di Landstar
                { id: 294, qty: 1 }, // Cavaliere Hayabusa
                { id: 269, qty: 1 }, // Forza d'Attacco Goblin
                { id: 256, qty: 1 }, // Garoozis
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 38, qty: 1 }, // Fusione
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 262, qty: 1 }, // Turbine Gigante
                { id: 440, qty: 1 }, // Scudo e Spada
                { id: 432, qty: 1 }, // Salamandra
                { id: 273, qty: 1 }, // Dado Aggraziato
                { id: 445, qty: 1 }, // Dado Teschio
                { id: 425, qty: 1 }, // Ragno della Roulette
                { id: 333, qty: 1 }, // Kunai con Catena
                { id: 255, qty: 1 }, // Azzardo
                { id: 276, qty: 1 }, // Tombarolo
                { id: 232, qty: 1 }, // Scatola delle Fate
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 } // Nega Attacco
            ],
            extra: [
                { id: 58, qty: 1 }, // Spadaccino di Fuoco
                { id: 84, qty: 1 }, // Drago Spada di Alligatore
                { id: 473, qty: 1 } // Drago dei Mille
            ]
        },
        hard: {
            main: [
                { id: 12, qty: 3 }, // Drago Nero Occhi Rossi
                { id: 1253, qty: 1 }, // Drago Metallo Nero — singola copia promossa dall'audit finale
                { id: 16, qty: 2 }, // Gearfried il Cavaliere di Ferro
                { id: 399, qty: 1 }, // Guerriero Pantera
                { id: 101, qty: 2 }, // Assalitore con l'Ascia
                { id: 879, qty: 1 }, // Il Pescatore Leggendario
                { id: 17, qty: 1 }, // Jinzo
                { id: 83, qty: 1 }, // Spada di Alligatore
                { id: 477, qty: 1 }, // Ascia Tigre
                { id: 369, qty: 1 }, // Masaki lo Spadaccino Leggendario
                { id: 539, qty: 1 }, // Signore delle Fiamme
                { id: 27, qty: 2 }, // Cucciolo di Drago
                { id: 28, qty: 2 }, // Mago del Tempo
                { id: 269, qty: 1 }, // Forza d'Attacco Goblin
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 38, qty: 1 }, // Fusione
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 262, qty: 1 }, // Turbine Gigante
                { id: 440, qty: 1 }, // Scudo e Spada
                { id: 432, qty: 1 }, // Salamandra
                { id: 273, qty: 1 }, // Dado Aggraziato
                { id: 445, qty: 1 }, // Dado Teschio
                { id: 425, qty: 1 }, // Ragno della Roulette
                { id: 333, qty: 1 }, // Kunai con Catena
                { id: 255, qty: 1 }, // Azzardo
                { id: 276, qty: 1 }, // Tombarolo
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 267, qty: 1 }, // Gilford il Fulmine
                { id: 258, qty: 1 }, // Gearfried il Maestro di Spada
                { id: 415, qty: 1 } // Vincoli Recisi
            ],
            extra: [
                { id: 58, qty: 1 }, // Spadaccino di Fuoco
                { id: 84, qty: 1 }, // Drago Spada di Alligatore
                { id: 473, qty: 1 } // Drago dei Mille
            ]
        }
    },

    // Mai Valentine: le Lady Arpia — Sorelle Lady Arpia via Egotista Elegante,
    // Drago da Compagnia delle Arpie, Arpia Cyber, Cucciolo di Drago dell'Arpia, con Scudo
    // Cyber, Terreno di Caccia, Formazione della Fenice, Scintilla dell'Estasi Triangolare,
    // Piumino delle Arpie; da Battle City le Amazzoni, Muro dello Specchio e Scudo con Braccio
    // Magico.
    mai: {
        flagship: 290, // Sorelle Lady Arpia — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 290, qty: 2 }, // Sorelle Lady Arpia
                { id: 288, qty: 3 }, // Lady Arpia
                { id: 782, qty: 2 }, // Lady Arpia 1
                { id: 783, qty: 2 }, // Lady Arpia 2
                { id: 784, qty: 2 }, // Lady Arpia 3
                { id: 775, qty: 3 }, // Ragazza Arpia
                { id: 786, qty: 2 }, // Cucciolo di Drago dell'Arpia
                { id: 916, qty: 2 }, // Kurama
                { id: 90, qty: 1 }, // Amazzone Spadaccina
                { id: 778, qty: 1 }, // Faccia di Uccello
                { id: 787, qty: 2 }, // Egoista Elegante
                { id: 175, qty: 1 }, // Scudo Cyber
                { id: 788, qty: 1 }, // Terreno di Caccia delle Arpie
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 383, qty: 1 }, // Muro dello Specchio
                { id: 819, qty: 1 }, // Scudo con Braccio Magico
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 292, qty: 1 }, // Tempesta di Piume delle Arpie
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 595, qty: 1 } // Il Guardiano Affidabile
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 290, qty: 2 }, // Sorelle Lady Arpia
                { id: 288, qty: 3 }, // Lady Arpia
                { id: 782, qty: 1 }, // Lady Arpia 1
                { id: 783, qty: 1 }, // Lady Arpia 2
                { id: 784, qty: 1 }, // Lady Arpia 3
                { id: 293, qty: 1 }, // Drago da Compagnia delle Arpie
                { id: 786, qty: 1 }, // Cucciolo di Drago dell'Arpia
                { id: 172, qty: 2 }, // Arpia Cyber
                { id: 90, qty: 2 }, // Amazzone Spadaccina
                { id: 86, qty: 1 }, // Amazzone Maestra delle Catene
                { id: 87, qty: 2 }, // Amazzone Combattente
                { id: 775, qty: 2 }, // Ragazza Arpia
                { id: 778, qty: 1 }, // Faccia di Uccello
                { id: 787, qty: 2 }, // Egoista Elegante
                { id: 175, qty: 1 }, // Scudo Cyber
                { id: 788, qty: 1 }, // Terreno di Caccia delle Arpie
                { id: 289, qty: 1 }, // Lady Arpia Formazione della Fenice
                { id: 789, qty: 1 }, // Scintilla dell'Estasi Triangolare
                { id: 291, qty: 1 }, // Piumino delle Arpie
                { id: 383, qty: 1 }, // Muro dello Specchio
                { id: 88, qty: 1 }, // Arciere delle Amazzoni
                { id: 790, qty: 1 }, // Festa Isterica
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 819, qty: 1 }, // Scudo con Braccio Magico
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 292, qty: 1 }, // Tempesta di Piume delle Arpie
                { id: 434, qty: 1 } // Capro Espiatorio
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 290, qty: 2 }, // Sorelle Lady Arpia
                { id: 288, qty: 3 }, // Lady Arpia
                { id: 782, qty: 1 }, // Lady Arpia 1
                { id: 783, qty: 1 }, // Lady Arpia 2
                { id: 784, qty: 1 }, // Lady Arpia 3
                { id: 293, qty: 1 }, // Drago da Compagnia delle Arpie
                { id: 786, qty: 1 }, // Cucciolo di Drago dell'Arpia
                { id: 172, qty: 3 }, // Arpia Cyber
                { id: 90, qty: 2 }, // Amazzone Spadaccina
                { id: 86, qty: 1 }, // Amazzone Maestra delle Catene
                { id: 87, qty: 1 }, // Amazzone Combattente
                { id: 775, qty: 1 }, // Ragazza Arpia
                { id: 778, qty: 1 }, // Faccia di Uccello
                { id: 787, qty: 3 }, // Egoista Elegante
                { id: 175, qty: 1 }, // Scudo Cyber
                { id: 788, qty: 1 }, // Terreno di Caccia delle Arpie
                { id: 289, qty: 1 }, // Lady Arpia Formazione della Fenice
                { id: 789, qty: 1 }, // Scintilla dell'Estasi Triangolare
                { id: 291, qty: 1 }, // Piumino delle Arpie
                { id: 383, qty: 1 }, // Muro dello Specchio
                { id: 88, qty: 1 }, // Arciere delle Amazzoni
                { id: 790, qty: 1 }, // Festa Isterica
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 292, qty: 1 }, // Tempesta di Piume delle Arpie
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 7, qty: 1 } // Buco Nero
            ],
            extra: []
        }
    },

    // Maximillion Pegasus: il Mondo dei Toon (Drago Toon Occhi Blu, Teschio
    // Evocato Toon, Sirena Toon, Alligatore Toon, Stregone Mascherato Toon, Manga Ryu-Ran) e
    // l'Idolo dai Mille Occhi con Abbandonato per la Restrizione dai Mille Occhi; Coniglio
    // Oscuro, Suonatore di Draghi, Mago Senza Volto Illusionista, Drago Pappagallo, Vaso
    // Cattura-Drago, Maschera Toon e L'Occhio della Verità (il suo Occhio del Millennio).
    pegasus: {
        flagship: 123, // Drago Toon Occhi Blu — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 123, qty: 2 }, // Drago Toon Occhi Blu
                { id: 481, qty: 3 }, // Alligatore Toon
                { id: 483, qty: 2 }, // Stregone Mascherato Toon
                { id: 190, qty: 3 }, // Coniglio Oscuro
                { id: 209, qty: 3 }, // Suonatore di Draghi
                { id: 475, qty: 2 }, // Idolo dai Mille Occhi
                { id: 328, qty: 3 }, // Kiseitai
                { id: 484, qty: 2 }, // Sirena Toon
                { id: 202, qty: 1 }, // Bambola della Rovina
                { id: 487, qty: 2 }, // Mondo dei Toon
                { id: 482, qty: 1 }, // Maschera Toon
                { id: 485, qty: 1 }, // Riavvolgimento Toon
                { id: 206, qty: 1 }, // Vaso Cattura-Drago
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 123, qty: 2 }, // Drago Toon Occhi Blu
                { id: 486, qty: 1 }, // Teschio Evocato Toon
                { id: 484, qty: 3 }, // Sirena Toon
                { id: 481, qty: 2 }, // Alligatore Toon
                { id: 606, qty: 1 }, // Manga Ryu-Ran
                { id: 483, qty: 2 }, // Stregone Mascherato Toon
                { id: 190, qty: 3 }, // Coniglio Oscuro
                { id: 475, qty: 1 }, // Idolo dai Mille Occhi
                { id: 416, qty: 1 }, // Abbandonato
                { id: 202, qty: 1 }, // Bambola della Rovina
                { id: 306, qty: 1 }, // Mago Senza Volto Illusionista
                { id: 400, qty: 1 }, // Drago Pappagallo
                { id: 487, qty: 3 }, // Mondo dei Toon
                { id: 482, qty: 2 }, // Maschera Toon
                { id: 485, qty: 1 }, // Riavvolgimento Toon
                { id: 116, qty: 1 }, // Rito dell'Illusione Nera
                { id: 206, qty: 1 }, // Vaso Cattura-Drago
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 38, qty: 1 }, // Fusione
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: [
                { id: 476, qty: 1 } // Restrizione dai Mille Occhi
            ]
        },
        hard: {
            main: [
                { id: 123, qty: 2 }, // Drago Toon Occhi Blu
                { id: 486, qty: 1 }, // Teschio Evocato Toon
                { id: 484, qty: 3 }, // Sirena Toon
                { id: 481, qty: 2 }, // Alligatore Toon
                { id: 606, qty: 1 }, // Manga Ryu-Ran
                { id: 483, qty: 2 }, // Stregone Mascherato Toon
                { id: 190, qty: 2 }, // Coniglio Oscuro
                { id: 475, qty: 2 }, // Idolo dai Mille Occhi
                { id: 416, qty: 1 }, // Abbandonato
                { id: 306, qty: 1 }, // Mago Senza Volto Illusionista
                { id: 487, qty: 3 }, // Mondo dei Toon
                { id: 1266, qty: 1 }, // Regno Toon — singola copia promossa dall'audit finale, senza sostituire il piano storico
                { id: 482, qty: 2 }, // Maschera Toon
                { id: 485, qty: 2 }, // Riavvolgimento Toon
                { id: 116, qty: 1 }, // Rito dell'Illusione Nera
                { id: 206, qty: 1 }, // Vaso Cattura-Drago
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 38, qty: 1 }, // Fusione
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 466, qty: 1 }, // L'Occhio della Verità
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 820, qty: 1 } // Nega Attacco
            ],
            extra: [
                { id: 476, qty: 1 } // Restrizione dai Mille Occhi
            ]
        }
    },

    // Yami Bakura, mazzo "occulto" di Battle City: Necropaura Oscura (evocata
    // bandendo tre Demoni), Destiny Board con i quattro Spirit Message e il Santuario Oscuro,
    // Spirito Legato alla Terra, Cavaliere Senza Testa, Cappello Magico Bianco, Germe Gigante,
    // Ectoplasmatore, Venditore di Bare e Cambio di Cuore. Facile toglie la Destiny Board
    // (una vittoria alternativa non è da livello facile).
    bakura: {
        flagship: 891, // Necropaura Oscura — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 891, qty: 2 }, // Necropaura Oscura
                { id: 984, qty: 3 }, // Spirito Legato alla Terra
                { id: 591, qty: 3 }, // Cappello Magico Bianco
                { id: 259, qty: 3 }, // Germe Gigante
                { id: 25, qty: 3 }, // Ryu Kishin
                { id: 564, qty: 2 }, // Titano Oscuro del Terrore
                { id: 299, qty: 2 }, // Diavoletto Cornuto
                { id: 988, qty: 1 }, // Cavaliere Senza Testa
                { id: 542, qty: 1 }, // Fantasma Arguto
                { id: 158, qty: 1 }, // Venditore di Bare
                { id: 147, qty: 1 }, // Cambio di Cuore
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 136, qty: 1 }, // Richiamo degli Infestati
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 875, qty: 1 }, // Libro della Luna
                { id: 607, qty: 1 } // Tifone dello Spazio Mistico
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 891, qty: 2 }, // Necropaura Oscura
                { id: 984, qty: 2 }, // Spirito Legato alla Terra
                { id: 988, qty: 2 }, // Cavaliere Senza Testa
                { id: 1041, qty: 1 }, // Demone Minore
                { id: 591, qty: 2 }, // Cappello Magico Bianco
                { id: 259, qty: 2 }, // Germe Gigante
                { id: 1118, qty: 1 }, // Sovrano Oscuro Ha Des
                { id: 25, qty: 2 }, // Ryu Kishin
                { id: 428, qty: 1 }, // Ryu-Kishin Potenziato
                { id: 589, qty: 1 }, // Grande Occhio
                { id: 542, qty: 1 }, // Fantasma Arguto
                { id: 299, qty: 1 }, // Diavoletto Cornuto
                { id: 564, qty: 1 }, // Titano Oscuro del Terrore
                { id: 433, qty: 1 }, // Sangan
                { id: 866, qty: 1 }, // Destiny Board
                { id: 867, qty: 1 }, // Spirit Message "I"
                { id: 868, qty: 1 }, // Spirit Message "N"
                { id: 869, qty: 1 }, // Spirit Message "A"
                { id: 870, qty: 1 }, // Spirit Message "L"
                { id: 192, qty: 1 }, // Santuario Oscuro
                { id: 221, qty: 1 }, // Ectoplasmatore
                { id: 158, qty: 1 }, // Venditore di Bare
                { id: 147, qty: 1 }, // Cambio di Cuore
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 136, qty: 1 }, // Richiamo degli Infestati
                { id: 272, qty: 1 } // Carità Aggraziata
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 891, qty: 2 }, // Necropaura Oscura
                { id: 984, qty: 2 }, // Spirito Legato alla Terra
                { id: 988, qty: 2 }, // Cavaliere Senza Testa
                { id: 1041, qty: 2 }, // Demone Minore
                { id: 591, qty: 2 }, // Cappello Magico Bianco
                { id: 259, qty: 2 }, // Germe Gigante
                { id: 1118, qty: 2 }, // Sovrano Oscuro Ha Des
                { id: 25, qty: 2 }, // Ryu Kishin
                { id: 428, qty: 1 }, // Ryu-Kishin Potenziato
                { id: 589, qty: 1 }, // Grande Occhio
                { id: 542, qty: 1 }, // Fantasma Arguto
                { id: 433, qty: 1 }, // Sangan
                { id: 866, qty: 1 }, // Destiny Board
                { id: 867, qty: 1 }, // Spirit Message "I"
                { id: 868, qty: 1 }, // Spirit Message "N"
                { id: 869, qty: 1 }, // Spirit Message "A"
                { id: 870, qty: 1 }, // Spirit Message "L"
                { id: 192, qty: 1 }, // Santuario Oscuro
                { id: 221, qty: 1 }, // Ectoplasmatore
                { id: 158, qty: 1 }, // Venditore di Bare
                { id: 147, qty: 1 }, // Cambio di Cuore
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 136, qty: 1 }, // Richiamo degli Infestati
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: []
        }
    },

    // Marik Ishtar: il suo mazzo di Battle City — Helpoemer, Gil Garth, Newdoria,
    // Bowganian, Jeroid Oscuro, Opticlops, Pomodoro Mistico, con Offerta Suprema, Gabbia
    // d'Acciaio dell'Incubo, Fuori Gioco e Controllo Mentale (il controllo della Verga del
    // Millennio). Il Drago Alato di Ra solo in Difficile, una copia. Niente Drago Nero Occhi
    // Rossi né Jinzo: sono di Joey ed Espa Roba.
    marik: {
        flagship: 1123, // Helpoemer — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 1123, qty: 2 }, // Helpoemer
                { id: 129, qty: 2 }, // Bowganian
                { id: 186, qty: 3 }, // Jeroid Oscuro
                { id: 25, qty: 3 }, // Ryu Kishin
                { id: 328, qty: 2 }, // Kiseitai
                { id: 1054, qty: 2 }, // Tirapiedi Alato
                { id: 564, qty: 2 }, // Titano Oscuro del Terrore
                { id: 914, qty: 2 }, // Re della Nebbia
                { id: 390, qty: 1 }, // Pomodoro Mistico
                { id: 1114, qty: 1 }, // Lupo Bicefalo
                { id: 750, qty: 1 }, // Gabbia d'Acciaio dell'Incubo
                { id: 130, qty: 1 }, // Controllo Mentale
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 136, qty: 1 }, // Richiamo degli Infestati
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 559, qty: 1 }, // Offerta Suprema
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 1123, qty: 2 }, // Helpoemer
                { id: 265, qty: 2 }, // Gil Garth
                { id: 1086, qty: 1 }, // Newdoria
                { id: 129, qty: 2 }, // Bowganian
                { id: 186, qty: 2 }, // Jeroid Oscuro
                { id: 627, qty: 1 }, // Opticlops
                { id: 390, qty: 1 }, // Pomodoro Mistico
                { id: 1114, qty: 1 }, // Lupo Bicefalo
                { id: 1041, qty: 1 }, // Demone Minore
                { id: 991, qty: 1 }, // Il Conte della Fine
                { id: 25, qty: 2 }, // Ryu Kishin
                { id: 564, qty: 1 }, // Titano Oscuro del Terrore
                { id: 1054, qty: 1 }, // Tirapiedi Alato
                { id: 328, qty: 1 }, // Kiseitai
                { id: 542, qty: 1 }, // Fantasma Arguto
                { id: 559, qty: 1 }, // Offerta Suprema
                { id: 750, qty: 1 }, // Gabbia d'Acciaio dell'Incubo
                { id: 216, qty: 1 }, // Fuori Gioco
                { id: 130, qty: 1 }, // Controllo Mentale
                { id: 450, qty: 1 }, // Demolizione dell'Anima
                { id: 136, qty: 1 }, // Richiamo degli Infestati
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 451, qty: 1 } // Scambio di Anime
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 1123, qty: 2 }, // Helpoemer
                { id: 265, qty: 2 }, // Gil Garth
                { id: 1086, qty: 1 }, // Newdoria
                { id: 129, qty: 2 }, // Bowganian
                { id: 186, qty: 2 }, // Jeroid Oscuro
                { id: 627, qty: 1 }, // Opticlops
                { id: 390, qty: 1 }, // Pomodoro Mistico
                { id: 1114, qty: 1 }, // Lupo Bicefalo
                { id: 1041, qty: 2 }, // Demone Minore
                { id: 991, qty: 1 }, // Il Conte della Fine
                { id: 25, qty: 2 }, // Ryu Kishin
                { id: 564, qty: 1 }, // Titano Oscuro del Terrore
                { id: 542, qty: 1 }, // Fantasma Arguto
                { id: 559, qty: 1 }, // Offerta Suprema
                { id: 750, qty: 1 }, // Gabbia d'Acciaio dell'Incubo
                { id: 216, qty: 1 }, // Fuori Gioco
                { id: 130, qty: 1 }, // Controllo Mentale
                { id: 450, qty: 1 }, // Demolizione dell'Anima
                { id: 136, qty: 1 }, // Richiamo degli Infestati
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 1273, qty: 1 }, // Canto Antico — singola copia promossa dall'audit finale per rendere Ra realmente giocabile
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 472, qty: 1 }, // Il Drago Alato di Ra
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 7, qty: 1 } // Buco Nero
            ],
            extra: []
        }
    },

    // Mako Tsunami: il mare — Balena Fortezza (rituale, la sua carta simbolo), Il
    // Pescatore Leggendario, Kairyu-Shin, Grande Squalo Bianco, Pesce dai 7 Colori, Medusa,
    // Bugroth Anfibio MK-3, Seadra Spinoso, con Umi e Muro del Tornado.
    mako: {
        flagship: 252, // Balena Fortezza — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 252, qty: 2 }, // Balena Fortezza
                { id: 314, qty: 3 }, // Medusa
                { id: 247, qty: 3 }, // Pesce Volante
                { id: 582, qty: 2 }, // Tartaruga Isola
                { id: 907, qty: 2 }, // Sirena Incantatrice
                { id: 250, qty: 2 }, // Pinguino Volante
                { id: 904, qty: 2 }, // Stella Marina Corazzata
                { id: 926, qty: 2 }, // Acqua Radicale
                { id: 951, qty: 1 }, // Tongyo
                { id: 279, qty: 1 }, // Grande Squalo Bianco
                { id: 253, qty: 2 }, // Giuramento della Balena Fortezza
                { id: 497, qty: 1 }, // Umi
                { id: 489, qty: 1 }, // Muro del Tornado
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 704, qty: 1 }, // Salvataggio
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 875, qty: 1 }, // Libro della Luna
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 252, qty: 2 }, // Balena Fortezza
                { id: 879, qty: 1 }, // Il Pescatore Leggendario
                { id: 319, qty: 1 }, // Kairyu-Shin
                { id: 279, qty: 2 }, // Grande Squalo Bianco
                { id: 583, qty: 1 }, // Pesce dai 7 Colori
                { id: 314, qty: 2 }, // Medusa
                { id: 699, qty: 1 }, // Bugroth Anfibio MK-3
                { id: 928, qty: 1 }, // Seadra Spinoso
                { id: 247, qty: 2 }, // Pesce Volante
                { id: 951, qty: 2 }, // Tongyo
                { id: 701, qty: 1 }, // Cavaliere Sirena
                { id: 692, qty: 1 }, // Guerriero del Serpente Marino dell'Oscurità
                { id: 582, qty: 1 }, // Tartaruga Isola
                { id: 907, qty: 1 }, // Sirena Incantatrice
                { id: 260, qty: 1 }, // Gigantesco Serpente di Mare Rosso
                { id: 253, qty: 2 }, // Giuramento della Balena Fortezza
                { id: 497, qty: 1 }, // Umi
                { id: 489, qty: 1 }, // Muro del Tornado
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 79, qty: 1 }, // Un Oceano Leggendario
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 704, qty: 1 } // Salvataggio
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 252, qty: 2 }, // Balena Fortezza
                { id: 879, qty: 1 }, // Il Pescatore Leggendario
                { id: 319, qty: 2 }, // Kairyu-Shin
                { id: 279, qty: 2 }, // Grande Squalo Bianco
                { id: 583, qty: 2 }, // Pesce dai 7 Colori
                { id: 314, qty: 2 }, // Medusa
                { id: 699, qty: 1 }, // Bugroth Anfibio MK-3
                { id: 928, qty: 1 }, // Seadra Spinoso
                { id: 247, qty: 2 }, // Pesce Volante
                { id: 951, qty: 2 }, // Tongyo
                { id: 701, qty: 1 }, // Cavaliere Sirena
                { id: 692, qty: 1 }, // Guerriero del Serpente Marino dell'Oscurità
                { id: 260, qty: 1 }, // Gigantesco Serpente di Mare Rosso
                { id: 253, qty: 2 }, // Giuramento della Balena Fortezza
                { id: 497, qty: 1 }, // Umi
                { id: 489, qty: 1 }, // Muro del Tornado
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 79, qty: 1 }, // Un Oceano Leggendario
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 91, qty: 1 } // Bestia Anfibia
            ],
            extra: []
        }
    },

    // Weevil Underwood: Insetti — la linea Falena Piccola / Bozzolo
    // dell'Evoluzione / Grande Falena (Falena Perfetta in Difficile), Larva Mostruosa,
    // Insetto di Base, Ago Killer, Leghul, Kumootoko, Gokibore, Cavaliere Scarafaggio,
    // Kamakiri Volante, Insetto Divoratore, con Barriera d'Insetti e le armature laser.
    weevil: {
        flagship: 52, // Grande Falena — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 52, qty: 2 }, // Grande Falena
                { id: 522, qty: 3 }, // Falena Piccola
                { id: 157, qty: 2 }, // Bozzolo dell'Evoluzione
                { id: 105, qty: 3 }, // Insetto di Base
                { id: 325, qty: 2 }, // Ago Killer
                { id: 345, qty: 2 }, // Leghul
                { id: 915, qty: 2 }, // Kumootoko
                { id: 270, qty: 2 }, // Gokibore
                { id: 156, qty: 2 }, // Cavaliere Scarafaggio
                { id: 323, qty: 1 }, // Kamakiriman
                { id: 248, qty: 1 }, // Kamakiri Volante #1
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 309, qty: 1 }, // Armatura Insetto con Cannone Laser
                { id: 340, qty: 1 }, // Armatura Cannone Laser
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 52, qty: 2 }, // Grande Falena
                { id: 522, qty: 2 }, // Falena Piccola
                { id: 157, qty: 2 }, // Bozzolo dell'Evoluzione
                { id: 50, qty: 1 }, // Larva Mostruosa
                { id: 105, qty: 2 }, // Insetto di Base
                { id: 325, qty: 2 }, // Ago Killer
                { id: 295, qty: 1 }, // Scarabeo Ercole
                { id: 23, qty: 1 }, // Insetto Divoratore
                { id: 345, qty: 2 }, // Leghul
                { id: 915, qty: 1 }, // Kumootoko
                { id: 248, qty: 2 }, // Kamakiri Volante #1
                { id: 270, qty: 1 }, // Gokibore
                { id: 156, qty: 1 }, // Cavaliere Scarafaggio
                { id: 403, qty: 1 }, // Cavalletta d'Emergenza
                { id: 310, qty: 2 }, // Barriera d'Insetti
                { id: 309, qty: 2 }, // Armatura Insetto con Cannone Laser
                { id: 340, qty: 1 }, // Armatura Cannone Laser
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 503, qty: 1 }, // Waboku
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 143, qty: 1 } // Mura del Castello
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 52, qty: 2 }, // Grande Falena
                { id: 522, qty: 2 }, // Falena Piccola
                { id: 157, qty: 2 }, // Bozzolo dell'Evoluzione
                { id: 50, qty: 1 }, // Larva Mostruosa
                { id: 105, qty: 1 }, // Insetto di Base
                { id: 325, qty: 2 }, // Ago Killer
                { id: 295, qty: 1 }, // Scarabeo Ercole
                { id: 23, qty: 2 }, // Insetto Divoratore
                { id: 345, qty: 2 }, // Leghul
                { id: 915, qty: 1 }, // Kumootoko
                { id: 248, qty: 2 }, // Kamakiri Volante #1
                { id: 270, qty: 1 }, // Gokibore
                { id: 403, qty: 1 }, // Cavalletta d'Emergenza
                { id: 310, qty: 2 }, // Barriera d'Insetti
                { id: 309, qty: 2 }, // Armatura Insetto con Cannone Laser
                { id: 340, qty: 1 }, // Armatura Cannone Laser
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 1124, qty: 1 }, // Falena Perfetta
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 218, qty: 1 } // Verme del Dungeon
            ],
            extra: []
        }
    },

    // Rex Raptor: Dinosauri — Re Rex a Due Teste, Uraby, Megazowler, Braccio di
    // Spada del Drago e Drago Serpente della Notte del Regno dei Duellanti, e il suo mazzo di
    // Waking the Dragons: Tiranno Nero, Driceratopo Oscuro, Testa di Martello Iper,
    // Gilasaurus, Bebè Cerasauro, Grande Pillola Evolutiva e Mondo Giurassico.
    rex: {
        flagship: 801, // Tiranno Nero — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 801, qty: 2 }, // Tiranno Nero
                { id: 809, qty: 3 }, // Bebè Cerasauro
                { id: 491, qty: 3 }, // Trakodon
                { id: 266, qty: 2 }, // Gilasaurus
                { id: 367, qty: 2 }, // Cimitero dei Mammut
                { id: 936, qty: 2 }, // Sovrano Oscuro Bibocca
                { id: 805, qty: 2 }, // Ptera Nero
                { id: 806, qty: 2 }, // Stego Nero
                { id: 495, qty: 1 }, // Re Rex a Due Teste
                { id: 561, qty: 1 }, // Uraby
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 812, qty: 1 }, // Mondo Giurassico
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 549, qty: 1 }, // Rinforzi
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 823, qty: 1 }, // Scavo Fossile
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 801, qty: 2 }, // Tiranno Nero
                { id: 799, qty: 1 }, // Driceratopo Oscuro
                { id: 436, qty: 1 }, // Drago Serpente della Notte
                { id: 374, qty: 2 }, // Megazowler
                { id: 495, qty: 2 }, // Re Rex a Due Teste
                { id: 561, qty: 2 }, // Uraby
                { id: 461, qty: 1 }, // Braccio di Spada del Drago
                { id: 800, qty: 2 }, // Testa di Martello Iper
                { id: 266, qty: 2 }, // Gilasaurus
                { id: 809, qty: 2 }, // Bebè Cerasauro
                { id: 491, qty: 1 }, // Trakodon
                { id: 798, qty: 1 }, // Sabersaurus
                { id: 803, qty: 1 }, // Idrogeddon
                { id: 810, qty: 2 }, // Grande Pillola Evolutiva
                { id: 812, qty: 1 }, // Mondo Giurassico
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 823, qty: 1 }, // Scavo Fossile
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 549, qty: 1 } // Rinforzi
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 801, qty: 2 }, // Tiranno Nero
                { id: 799, qty: 2 }, // Driceratopo Oscuro
                { id: 436, qty: 2 }, // Drago Serpente della Notte
                { id: 374, qty: 2 }, // Megazowler
                { id: 495, qty: 2 }, // Re Rex a Due Teste
                { id: 561, qty: 2 }, // Uraby
                { id: 461, qty: 1 }, // Braccio di Spada del Drago
                { id: 800, qty: 2 }, // Testa di Martello Iper
                { id: 266, qty: 2 }, // Gilasaurus
                { id: 809, qty: 1 }, // Bebè Cerasauro
                { id: 798, qty: 1 }, // Sabersaurus
                { id: 803, qty: 1 }, // Idrogeddon
                { id: 810, qty: 2 }, // Grande Pillola Evolutiva
                { id: 812, qty: 1 }, // Mondo Giurassico
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 823, qty: 1 }, // Scavo Fossile
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 815, qty: 1 } // Istinto di Caccia
            ],
            extra: []
        }
    },

    // Bandit Keith: Macchine da guerra — Drago Barile, Slot Machine, Ragno
    // Lanciatore, Zoa e Metalzoa via Metalmorfosi, Alligatore Cyber-Tecnologico, Sfera
    // Esplosiva, Macchina a Pendolo, MechanicalChaser, con Rimozione del Limitatore, Macchina
    // del Tempo, Richiamo degli Infestati e i Sette Attrezzi del Bandito. I cannoni X/Y/Z non
    // sono suoi: sono di Kaiba.
    bandit_keith: {
        flagship: 104, // Drago Barile — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 104, qty: 2 }, // Drago Barile
                { id: 264, qty: 3 }, // Lupo Giga-Tech
                { id: 170, qty: 3 }, // Comandante Cyber
                { id: 960, qty: 2 }, // Lumaca Meccanica
                { id: 274, qty: 2 }, // Gradius
                { id: 1122, qty: 2 }, // Scorpione d'Acciaio
                { id: 257, qty: 2 }, // Golem Meccanico la Fortezza Mobile
                { id: 223, qty: 1 }, // Tartaruga Elettromagnetica
                { id: 120, qty: 2 }, // Sfera Esplosiva
                { id: 137, qty: 1 }, // Soldato Cannone
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 358, qty: 1 }, // Fabbrica di Conversione Meccanica
                { id: 350, qty: 1 }, // Rimozione del Limitatore
                { id: 478, qty: 1 }, // Macchina del Tempo
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 104, qty: 2 }, // Drago Barile
                { id: 447, qty: 1 }, // Slot Machine
                { id: 34, qty: 1 }, // Ragno Lanciatore
                { id: 520, qty: 1 }, // Zoa
                { id: 377, qty: 1 }, // Metalzoa
                { id: 177, qty: 1 }, // Alligatore Cyber-Tecnologico
                { id: 120, qty: 2 }, // Sfera Esplosiva
                { id: 401, qty: 1 }, // Macchina a Pendolo
                { id: 373, qty: 2 }, // MechanicalChaser
                { id: 137, qty: 2 }, // Soldato Cannone
                { id: 281, qty: 1 }, // Bugroth l'Assalitore Terrestre
                { id: 394, qty: 1 }, // Carro Armato Oni T-34
                { id: 264, qty: 2 }, // Lupo Giga-Tech
                { id: 174, qty: 1 }, // Predone Cyber
                { id: 176, qty: 1 }, // Soldato Cyber del Mondo Oscuro
                { id: 376, qty: 1 }, // Metalmorfosi
                { id: 350, qty: 1 }, // Rimozione del Limitatore
                { id: 478, qty: 1 }, // Macchina del Tempo
                { id: 358, qty: 1 }, // Fabbrica di Conversione Meccanica
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 136, qty: 1 }, // Richiamo degli Infestati
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 577, qty: 1 } // Giusto Dessert
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 104, qty: 2 }, // Drago Barile
                { id: 447, qty: 2 }, // Slot Machine
                { id: 34, qty: 2 }, // Ragno Lanciatore
                { id: 520, qty: 1 }, // Zoa
                { id: 377, qty: 1 }, // Metalzoa
                { id: 177, qty: 2 }, // Alligatore Cyber-Tecnologico
                { id: 120, qty: 2 }, // Sfera Esplosiva
                { id: 401, qty: 1 }, // Macchina a Pendolo
                { id: 373, qty: 2 }, // MechanicalChaser
                { id: 137, qty: 2 }, // Soldato Cannone
                { id: 281, qty: 1 }, // Bugroth l'Assalitore Terrestre
                { id: 394, qty: 1 }, // Carro Armato Oni T-34
                { id: 174, qty: 1 }, // Predone Cyber
                { id: 176, qty: 1 }, // Soldato Cyber del Mondo Oscuro
                { id: 376, qty: 1 }, // Metalmorfosi
                { id: 350, qty: 1 }, // Rimozione del Limitatore
                { id: 478, qty: 1 }, // Macchina del Tempo
                { id: 358, qty: 1 }, // Fabbrica di Conversione Meccanica
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 136, qty: 1 }, // Richiamo degli Infestati
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 382, qty: 1 } // Forza dello Specchio
            ],
            extra: []
        }
    },

    // Panik: il Castello delle Illusioni Oscure e le tenebre del Regno dei
    // Duellanti — Demoni e Zombie (Mietitore delle Carte, Pumpking, Chimera Oscura, Guardiano
    // di Metallo, Re di Yamimakai, Ryu Kishin, Versago, Panda Scatenato per la fusione Barox),
    // con Yami, Coro del Santuario, Mura del Castello e Scambio di Anime.
    panik: {
        flagship: 142, // Castello delle Illusioni Oscure — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 142, qty: 2 }, // Castello delle Illusioni Oscure
                { id: 25, qty: 3 }, // Ryu Kishin
                { id: 500, qty: 2 }, // Versago il Distruttore
                { id: 529, qty: 2 }, // Panda Scatenato
                { id: 180, qty: 2 }, // Assalitore Oscuro
                { id: 563, qty: 2 }, // Terra il Terribile
                { id: 914, qty: 2 }, // Re della Nebbia
                { id: 355, qty: 2 }, // Signore di Zemia
                { id: 237, qty: 1 }, // Folletto Selvaggio Feroce
                { id: 428, qty: 1 }, // Ryu-Kishin Potenziato
                { id: 211, qty: 1 }, // Drago Zombie
                { id: 557, qty: 2 }, // Yami
                { id: 151, qty: 2 }, // Coro del Santuario
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 38, qty: 1 }, // Fusione
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 451, qty: 1 }, // Scambio di Anime
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 439, qty: 1 } // Incantesimo Ombra
            ],
            extra: [
                { id: 103, qty: 1 } // Barox
            ]
        },
        medium: {
            main: [
                { id: 142, qty: 2 }, // Castello delle Illusioni Oscure
                { id: 410, qty: 1 }, // Mietitore delle Carte
                { id: 406, qty: 1 }, // Pumpking il Re dei Fantasmi
                { id: 182, qty: 1 }, // Chimera Oscura
                { id: 375, qty: 1 }, // Guardiano di Metallo
                { id: 327, qty: 1 }, // Re di Yamimakai
                { id: 25, qty: 2 }, // Ryu Kishin
                { id: 428, qty: 2 }, // Ryu-Kishin Potenziato
                { id: 500, qty: 1 }, // Versago il Distruttore
                { id: 529, qty: 1 }, // Panda Scatenato
                { id: 211, qty: 1 }, // Drago Zombie
                { id: 180, qty: 1 }, // Assalitore Oscuro
                { id: 355, qty: 1 }, // Signore di Zemia
                { id: 237, qty: 1 }, // Folletto Selvaggio Feroce
                { id: 299, qty: 1 }, // Diavoletto Cornuto
                { id: 563, qty: 1 }, // Terra il Terribile
                { id: 914, qty: 1 }, // Re della Nebbia
                { id: 557, qty: 2 }, // Yami
                { id: 451, qty: 2 }, // Scambio di Anime
                { id: 38, qty: 1 }, // Fusione
                { id: 151, qty: 2 }, // Coro del Santuario
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 793, qty: 1 } // Armatura Sakuretsu
            ],
            extra: [
                { id: 103, qty: 1 } // Barox
            ]
        },
        hard: {
            main: [
                { id: 142, qty: 2 }, // Castello delle Illusioni Oscure
                { id: 410, qty: 1 }, // Mietitore delle Carte
                { id: 406, qty: 2 }, // Pumpking il Re dei Fantasmi
                { id: 182, qty: 1 }, // Chimera Oscura
                { id: 375, qty: 1 }, // Guardiano di Metallo
                { id: 327, qty: 2 }, // Re di Yamimakai
                { id: 25, qty: 2 }, // Ryu Kishin
                { id: 428, qty: 2 }, // Ryu-Kishin Potenziato
                { id: 500, qty: 1 }, // Versago il Distruttore
                { id: 529, qty: 1 }, // Panda Scatenato
                { id: 211, qty: 1 }, // Drago Zombie
                { id: 180, qty: 1 }, // Assalitore Oscuro
                { id: 355, qty: 1 }, // Signore di Zemia
                { id: 237, qty: 1 }, // Folletto Selvaggio Feroce
                { id: 299, qty: 1 }, // Diavoletto Cornuto
                { id: 557, qty: 2 }, // Yami
                { id: 451, qty: 2 }, // Scambio di Anime
                { id: 38, qty: 1 }, // Fusione
                { id: 151, qty: 1 }, // Coro del Santuario
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: [
                { id: 103, qty: 1 } // Barox
            ]
        }
    },

    // Bonz: Zombie — Drago Zombie, Zombie Corazzato, Zombie Pagliaccio del Regno
    // dei Duellanti con i mostri che Bandit Keith gli fa rianimare (Drago Strisciante, Zanki,
    // Clown del Sogno) grazie a Richiamo degli Infestati e Pumpking; da Battle City il Grande
    // Mammut di Goldfine e la Gabbia d'Acciaio dell'Incubo.
    bonz: {
        flagship: 211, // Drago Zombie — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 211, qty: 2 }, // Drago Zombie
                { id: 526, qty: 3 }, // Skull Servant
                { id: 155, qty: 2 }, // Zombie Pagliaccio
                { id: 464, qty: 2 }, // La 13ª Tomba
                { id: 180, qty: 2 }, // Assalitore Oscuro
                { id: 108, qty: 2 }, // Guerriero da Battaglia
                { id: 531, qty: 2 }, // Clown del Sogno
                { id: 547, qty: 2 }, // Fantasma Magico
                { id: 1106, qty: 1 }, // Vampire Baby
                { id: 1053, qty: 1 }, // Cavallo dell'Incubo
                { id: 1052, qty: 1 }, // Des Lacooda
                { id: 136, qty: 1 }, // Richiamo degli Infestati
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 750, qty: 1 }, // Gabbia d'Acciaio dell'Incubo
                { id: 38, qty: 1 }, // Fusione
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 251, qty: 1 }, // Sepoltura Sciocca
                { id: 875, qty: 1 }, // Libro della Luna
                { id: 439, qty: 1 } // Incantesimo Ombra
            ],
            extra: [
                { id: 521, qty: 1 } // Guerriero Zombie
            ]
        },
        medium: {
            main: [
                { id: 211, qty: 2 }, // Drago Zombie
                { id: 99, qty: 2 }, // Zombie Corazzato
                { id: 155, qty: 2 }, // Zombie Pagliaccio
                { id: 470, qty: 2 }, // Capelli di Serpente
                { id: 406, qty: 1 }, // Pumpking il Re dei Fantasmi
                { id: 164, qty: 1 }, // Drago Strisciante
                { id: 516, qty: 1 }, // Zanki
                { id: 531, qty: 1 }, // Clown del Sogno
                { id: 526, qty: 2 }, // Skull Servant
                { id: 108, qty: 1 }, // Guerriero da Battaglia
                { id: 464, qty: 1 }, // La 13ª Tomba
                { id: 547, qty: 1 }, // Fantasma Magico
                { id: 437, qty: 1 }, // Spettro Ombra
                { id: 657, qty: 1 }, // Maestro Kyonshee
                { id: 180, qty: 1 }, // Assalitore Oscuro
                { id: 136, qty: 2 }, // Richiamo degli Infestati
                { id: 750, qty: 1 }, // Gabbia d'Acciaio dell'Incubo
                { id: 38, qty: 1 }, // Fusione
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 251, qty: 1 }, // Sepoltura Sciocca
                { id: 503, qty: 1 }, // Waboku
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 669, qty: 1 } // Libro della Vita
            ],
            extra: [
                { id: 278, qty: 1 }, // Grande Mammut di Goldfine
                { id: 521, qty: 1 } // Guerriero Zombie
            ]
        },
        hard: {
            main: [
                { id: 211, qty: 2 }, // Drago Zombie
                { id: 99, qty: 2 }, // Zombie Corazzato
                { id: 155, qty: 2 }, // Zombie Pagliaccio
                { id: 470, qty: 2 }, // Capelli di Serpente
                { id: 406, qty: 2 }, // Pumpking il Re dei Fantasmi
                { id: 164, qty: 1 }, // Drago Strisciante
                { id: 516, qty: 1 }, // Zanki
                { id: 526, qty: 2 }, // Skull Servant
                { id: 108, qty: 1 }, // Guerriero da Battaglia
                { id: 464, qty: 1 }, // La 13ª Tomba
                { id: 547, qty: 1 }, // Fantasma Magico
                { id: 437, qty: 1 }, // Spettro Ombra
                { id: 657, qty: 1 }, // Maestro Kyonshee
                { id: 136, qty: 3 }, // Richiamo degli Infestati
                { id: 750, qty: 1 }, // Gabbia d'Acciaio dell'Incubo
                { id: 38, qty: 1 }, // Fusione
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 251, qty: 1 }, // Sepoltura Sciocca
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 669, qty: 1 }, // Libro della Vita
                { id: 663, qty: 1 }, // Ryu Kokki
                { id: 382, qty: 1 } // Forza dello Specchio
            ],
            extra: [
                { id: 278, qty: 1 }, // Grande Mammut di Goldfine
                { id: 521, qty: 1 } // Guerriero Zombie
            ]
        }
    },

    // Odion: il mazzo di Trappole con cui finge di essere Marik — Soldato Cinetico
    // (l'unico suo mostro che l'anime mostri e che il gioco abbia), mostri Flip che
    // recuperano Trappole (Maschera dell'Oscurità, Un Gatto di Malaugurio), la trappola-mostro
    // Roccaforte e Maschera della Restrizione. Il gioco non ha Apophis né Serket.
    odion: {
        flagship: 326, // Soldato Cinetico — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 326, qty: 2 }, // Soldato Cinetico
                { id: 764, qty: 3 }, // Statua Guardiana
                { id: 602, qty: 3 }, // Maschera dell'Oscurità
                { id: 1027, qty: 3 }, // Un Gatto di Malaugurio
                { id: 759, qty: 3 }, // Sentinella Golem
                { id: 556, qty: 2 }, // Maestro delle Trappole
                { id: 375, qty: 1 }, // Guardiano di Metallo
                { id: 1116, qty: 1 }, // Uomo con Wdjat
                { id: 849, qty: 1 }, // Roccaforte la Fortezza Mobile
                { id: 371, qty: 1 }, // Maschera della Restrizione
                { id: 383, qty: 1 }, // Muro dello Specchio
                { id: 478, qty: 1 }, // Macchina del Tempo
                { id: 136, qty: 1 }, // Richiamo degli Infestati
                { id: 819, qty: 1 }, // Scudo con Braccio Magico
                { id: 333, qty: 1 }, // Kunai con Catena
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 } // Dian Keto la Maestra delle Cure
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 326, qty: 2 }, // Soldato Cinetico
                { id: 375, qty: 2 }, // Guardiano di Metallo
                { id: 410, qty: 2 }, // Mietitore delle Carte
                { id: 764, qty: 2 }, // Statua Guardiana
                { id: 556, qty: 2 }, // Maestro delle Trappole
                { id: 602, qty: 2 }, // Maschera dell'Oscurità
                { id: 1027, qty: 2 }, // Un Gatto di Malaugurio
                { id: 1116, qty: 1 }, // Uomo con Wdjat
                { id: 759, qty: 1 }, // Sentinella Golem
                { id: 849, qty: 1 }, // Roccaforte la Fortezza Mobile
                { id: 371, qty: 1 }, // Maschera della Restrizione
                { id: 792, qty: 1 }, // Bara Oscura
                { id: 383, qty: 1 }, // Muro dello Specchio
                { id: 478, qty: 1 }, // Macchina del Tempo
                { id: 136, qty: 1 }, // Richiamo degli Infestati
                { id: 819, qty: 1 }, // Scudo con Braccio Magico
                { id: 333, qty: 1 }, // Kunai con Catena
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 448, qty: 1 }, // Giudizio Solenne
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 434, qty: 1 } // Capro Espiatorio
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 326, qty: 2 }, // Soldato Cinetico
                { id: 375, qty: 3 }, // Guardiano di Metallo
                { id: 410, qty: 2 }, // Mietitore delle Carte
                { id: 764, qty: 1 }, // Statua Guardiana
                { id: 556, qty: 2 }, // Maestro delle Trappole
                { id: 602, qty: 2 }, // Maschera dell'Oscurità
                { id: 1027, qty: 2 }, // Un Gatto di Malaugurio
                { id: 1116, qty: 2 }, // Uomo con Wdjat
                { id: 849, qty: 1 }, // Roccaforte la Fortezza Mobile
                { id: 371, qty: 1 }, // Maschera della Restrizione
                { id: 792, qty: 1 }, // Bara Oscura
                { id: 383, qty: 1 }, // Muro dello Specchio
                { id: 478, qty: 1 }, // Macchina del Tempo
                { id: 136, qty: 1 }, // Richiamo degli Infestati
                { id: 819, qty: 1 }, // Scudo con Braccio Magico
                { id: 333, qty: 1 }, // Kunai con Catena
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 448, qty: 1 }, // Giudizio Solenne
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 419, qty: 1 } // Anello della Distruzione
            ],
            extra: []
        }
    },

    // Ishizu Ishtar: Fate e visioni del futuro — il gioco non ha le sue fate
    // (Mudora, Keldo, Kelbek, Agido, Zolga), quindi Fate LUCE della stessa indole attorno
    // alla Carta del Ritorno Sicuro, sua carta simbolo, e al Telescopio Antico come "vista
    // del futuro" della Collana del Millennio.
    ishizu: {
        flagship: 562, // Gyakutenno Megami — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 562, qty: 2 }, // Gyakutenno Megami
                { id: 925, qty: 3 }, // Raggio e Temperatura
                { id: 982, qty: 3 }, // Bio-Mago
                { id: 443, qty: 2 }, // Amicizia Splendente
                { id: 458, qty: 2 }, // Spirito dell'Arpa
                { id: 391, qty: 2 }, // Elfa Mistica
                { id: 402, qty: 2 }, // Piccola Angela
                { id: 1074, qty: 2 }, // Hoshiningen
                { id: 442, qty: 1 }, // Abisso Splendente
                { id: 234, qty: 1 }, // Dono della Fata
                { id: 141, qty: 1 }, // Carta del Ritorno Sicuro
                { id: 576, qty: 1 }, // Telescopio Antico
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 151, qty: 1 }, // Coro del Santuario
                { id: 546, qty: 2 }, // Dian Keto la Maestra delle Cure
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 148, qty: 1 }, // Scudo Lustro Giallo
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 562, qty: 2 }, // Gyakutenno Megami
                { id: 217, qty: 2 }, // Strega Oscura Dunames
                { id: 442, qty: 2 }, // Abisso Splendente
                { id: 443, qty: 2 }, // Amicizia Splendente
                { id: 458, qty: 2 }, // Spirito dell'Arpa
                { id: 234, qty: 2 }, // Dono della Fata
                { id: 203, qty: 1 }, // Doma l'Angelo del Silenzio
                { id: 949, qty: 1 }, // Ocubeam
                { id: 1001, qty: 1 }, // Sacerdote di Asura
                { id: 1092, qty: 2 }, // Senju delle Mille Mani
                { id: 925, qty: 1 }, // Raggio e Temperatura
                { id: 982, qty: 1 }, // Bio-Mago
                { id: 391, qty: 1 }, // Elfa Mistica
                { id: 141, qty: 1 }, // Carta del Ritorno Sicuro
                { id: 555, qty: 1 }, // Ultima Volontà
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 576, qty: 1 }, // Telescopio Antico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 448, qty: 1 }, // Giudizio Solenne
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 503, qty: 2 }, // Waboku
                { id: 151, qty: 1 }, // Coro del Santuario
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 595, qty: 1 } // Il Guardiano Affidabile
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 562, qty: 2 }, // Gyakutenno Megami
                { id: 217, qty: 2 }, // Strega Oscura Dunames
                { id: 442, qty: 2 }, // Abisso Splendente
                { id: 443, qty: 2 }, // Amicizia Splendente
                { id: 458, qty: 2 }, // Spirito dell'Arpa
                { id: 234, qty: 2 }, // Dono della Fata
                { id: 203, qty: 2 }, // Doma l'Angelo del Silenzio
                { id: 949, qty: 1 }, // Ocubeam
                { id: 1001, qty: 1 }, // Sacerdote di Asura
                { id: 1092, qty: 2 }, // Senju delle Mille Mani
                { id: 391, qty: 1 }, // Elfa Mistica
                { id: 141, qty: 1 }, // Carta del Ritorno Sicuro
                { id: 555, qty: 1 }, // Ultima Volontà
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 576, qty: 1 }, // Telescopio Antico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 448, qty: 1 }, // Giudizio Solenne
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 503, qty: 2 }, // Waboku
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 954, qty: 1 }, // Strega Oscura
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 7, qty: 1 } // Buco Nero
            ],
            extra: []
        }
    },

    // Espa Roba: il finto "sensitivo" di Battle City — Jinzo potenziato
    // dall'Amplificatore, Jinzo #7, Kappa Psichico, Predone Cyber, e le carte con cui "legge"
    // l'avversario (Telescopio Antico, La Spia Inesperta, L'Occhio della Verità). Exodia
    // non è suo: è di Yugi.
    espaRoba: {
        flagship: 17, // Jinzo — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 17, qty: 2 }, // Jinzo
                { id: 1009, qty: 3 }, // Jinzo #7
                { id: 963, qty: 3 }, // Kappa Psichico
                { id: 960, qty: 2 }, // Lumaca Meccanica
                { id: 170, qty: 2 }, // Comandante Cyber
                { id: 264, qty: 2 }, // Lupo Giga-Tech
                { id: 274, qty: 2 }, // Gradius
                { id: 223, qty: 1 }, // Tartaruga Elettromagnetica
                { id: 941, qty: 1 }, // Mago del Disco
                { id: 174, qty: 1 }, // Predone Cyber
                { id: 1122, qty: 1 }, // Scorpione d'Acciaio
                { id: 92, qty: 1 }, // Amplificatore
                { id: 576, qty: 1 }, // Telescopio Antico
                { id: 575, qty: 1 }, // La Spia Inesperta
                { id: 466, qty: 1 }, // L'Occhio della Verità
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 631, qty: 1 } // Megamorfosi
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 17, qty: 2 }, // Jinzo
                { id: 1009, qty: 3 }, // Jinzo #7
                { id: 963, qty: 2 }, // Kappa Psichico
                { id: 174, qty: 2 }, // Predone Cyber
                { id: 176, qty: 2 }, // Soldato Cyber del Mondo Oscuro
                { id: 941, qty: 1 }, // Mago del Disco
                { id: 373, qty: 1 }, // MechanicalChaser
                { id: 401, qty: 1 }, // Macchina a Pendolo
                { id: 480, qty: 1 }, // Divoratempo
                { id: 264, qty: 2 }, // Lupo Giga-Tech
                { id: 394, qty: 1 }, // Carro Armato Oni T-34
                { id: 223, qty: 1 }, // Tartaruga Elettromagnetica
                { id: 171, qty: 1 }, // Falco Cyber
                { id: 92, qty: 1 }, // Amplificatore
                { id: 576, qty: 1 }, // Telescopio Antico
                { id: 575, qty: 1 }, // La Spia Inesperta
                { id: 466, qty: 1 }, // L'Occhio della Verità
                { id: 130, qty: 1 }, // Controllo Mentale
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 631, qty: 1 }, // Megamorfosi
                { id: 358, qty: 1 }, // Fabbrica di Conversione Meccanica
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 599, qty: 1 } // Sette Attrezzi del Bandito
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 17, qty: 2 }, // Jinzo
                { id: 1009, qty: 2 }, // Jinzo #7
                { id: 963, qty: 2 }, // Kappa Psichico
                { id: 174, qty: 2 }, // Predone Cyber
                { id: 176, qty: 2 }, // Soldato Cyber del Mondo Oscuro
                { id: 941, qty: 1 }, // Mago del Disco
                { id: 373, qty: 1 }, // MechanicalChaser
                { id: 401, qty: 2 }, // Macchina a Pendolo
                { id: 480, qty: 2 }, // Divoratempo
                { id: 264, qty: 1 }, // Lupo Giga-Tech
                { id: 394, qty: 1 }, // Carro Armato Oni T-34
                { id: 223, qty: 1 }, // Tartaruga Elettromagnetica
                { id: 171, qty: 1 }, // Falco Cyber
                { id: 92, qty: 1 }, // Amplificatore
                { id: 576, qty: 1 }, // Telescopio Antico
                { id: 466, qty: 1 }, // L'Occhio della Verità
                { id: 130, qty: 1 }, // Controllo Mentale
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 631, qty: 1 }, // Megamorfosi
                { id: 358, qty: 1 }, // Fabbrica di Conversione Meccanica
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 350, qty: 1 } // Rimozione del Limitatore
            ],
            extra: []
        }
    },

    // Arkana: il Mago Nero "rubato" (lui ne ha più copie, a differenza di Yugi),
    // Mille Coltelli, Cappelli Magici, Tifone dello Spazio Mistico, Catena di Distruzione,
    // Distruzione di Carte — e al posto del Pagliaccio Oscuro Peten, che il gioco non ha,
    // pagliacci e illusionisti della stessa pasta (Saggi, Legion, Mago Senza Volto).
    arkana: {
        flagship: 2, // Mago Nero — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 2, qty: 2 }, // Mago Nero
                { id: 431, qty: 3 }, // Saggi il Pagliaccio Oscuro
                { id: 169, qty: 3 }, // Tenda degli Oscuri
                { id: 924, qty: 2 }, // Nemuriko
                { id: 1010, qty: 2 }, // Lampada Mistica
                { id: 737, qty: 2 }, // Mago Apprendista
                { id: 743, qty: 2 }, // Maga Oscura Curran
                { id: 194, qty: 1 }, // Illusionista dagli Occhi Oscuri
                { id: 346, qty: 2 }, // Legion il Giullare Demoniaco
                { id: 554, qty: 1 }, // Stregone dei Dannati
                { id: 474, qty: 1 }, // Mille Coltelli
                { id: 363, qty: 1 }, // Cappelli Magici
                { id: 607, qty: 1 }, // Tifone dello Spazio Mistico
                { id: 138, qty: 1 }, // Distruzione di Carte
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 2, qty: 2 }, // Mago Nero
                { id: 346, qty: 2 }, // Legion il Giullare Demoniaco
                { id: 431, qty: 2 }, // Saggi il Pagliaccio Oscuro
                { id: 306, qty: 1 }, // Mago Senza Volto Illusionista
                { id: 554, qty: 2 }, // Stregone dei Dannati
                { id: 995, qty: 1 }, // Il Gentiluomo Illusorio
                { id: 733, qty: 1 }, // Stregone Eradicatore Oscuro
                { id: 743, qty: 1 }, // Maga Oscura Curran
                { id: 169, qty: 2 }, // Tenda degli Oscuri
                { id: 924, qty: 1 }, // Nemuriko
                { id: 744, qty: 1 }, // Mago a Fuoco Rapido
                { id: 736, qty: 1 }, // Abile Mago Oscuro
                { id: 194, qty: 1 }, // Illusionista dagli Occhi Oscuri
                { id: 737, qty: 1 }, // Mago Apprendista
                { id: 1010, qty: 1 }, // Lampada Mistica
                { id: 474, qty: 1 }, // Mille Coltelli
                { id: 363, qty: 1 }, // Cappelli Magici
                { id: 607, qty: 1 }, // Tifone dello Spazio Mistico
                { id: 146, qty: 1 }, // Catena di Distruzione
                { id: 138, qty: 1 }, // Distruzione di Carte
                { id: 362, qty: 1 }, // Dimensione Magica
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 599, qty: 1 } // Sette Attrezzi del Bandito
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 2, qty: 2 }, // Mago Nero
                { id: 346, qty: 2 }, // Legion il Giullare Demoniaco
                { id: 431, qty: 2 }, // Saggi il Pagliaccio Oscuro
                { id: 306, qty: 1 }, // Mago Senza Volto Illusionista
                { id: 554, qty: 2 }, // Stregone dei Dannati
                { id: 995, qty: 1 }, // Il Gentiluomo Illusorio
                { id: 733, qty: 2 }, // Stregone Eradicatore Oscuro
                { id: 743, qty: 1 }, // Maga Oscura Curran
                { id: 169, qty: 2 }, // Tenda degli Oscuri
                { id: 744, qty: 1 }, // Mago a Fuoco Rapido
                { id: 736, qty: 2 }, // Abile Mago Oscuro
                { id: 194, qty: 1 }, // Illusionista dagli Occhi Oscuri
                { id: 737, qty: 1 }, // Mago Apprendista
                { id: 474, qty: 1 }, // Mille Coltelli
                { id: 363, qty: 1 }, // Cappelli Magici
                { id: 607, qty: 1 }, // Tifone dello Spazio Mistico
                { id: 146, qty: 1 }, // Catena di Distruzione
                { id: 138, qty: 1 }, // Distruzione di Carte
                { id: 362, qty: 1 }, // Dimensione Magica
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 7, qty: 1 } // Buco Nero
            ],
            extra: []
        }
    },

    // Fratelli Paradosso: il Guardiano del Cancello (Sanga del Tuono, Kazejin e
    // Suijin), il Muro del Labirinto con Labirinto Magico per il Wall Shadow, e Jirai Gumo —
    // il mazzo del duello nel labirinto del Regno dei Duellanti.
    paradoxBrothers: {
        flagship: 33, // Il Guardiano del Cancello — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 33, qty: 1 }, // Il Guardiano del Cancello
                { id: 538, qty: 1 }, // Sanga del Tuono
                { id: 324, qty: 1 }, // Kazejin
                { id: 71, qty: 1 }, // Suijin
                { id: 535, qty: 3 }, // Guardia del Labirinto
                { id: 536, qty: 3 }, // Protettrice del Trono
                { id: 261, qty: 3 }, // Soldato di Pietra Gigante
                { id: 603, qty: 2 }, // Muka Muka
                { id: 765, qty: 2 }, // Verme Medusa
                { id: 54, qty: 2 }, // Muro d'Illusione
                { id: 905, qty: 1 }, // Roccia Dissolvente
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 333, qty: 1 }, // Kunai con Catena
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 38, qty: 1 }, // Fusione
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 875, qty: 1 }, // Libro della Luna
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 151, qty: 1 } // Coro del Santuario
            ],
            extra: [
                { id: 268, qty: 1 } // Giltia il Cavaliere D.
            ]
        },
        medium: {
            main: [
                { id: 33, qty: 1 }, // Il Guardiano del Cancello
                { id: 538, qty: 1 }, // Sanga del Tuono
                { id: 324, qty: 1 }, // Kazejin
                { id: 71, qty: 1 }, // Suijin
                { id: 337, qty: 2 }, // Muro del Labirinto
                { id: 857, qty: 1 }, // Wall Shadow
                { id: 316, qty: 2 }, // Jirai Gumo
                { id: 261, qty: 2 }, // Soldato di Pietra Gigante
                { id: 535, qty: 2 }, // Guardia del Labirinto
                { id: 536, qty: 2 }, // Protettrice del Trono
                { id: 603, qty: 2 }, // Muka Muka
                { id: 765, qty: 1 }, // Verme Medusa
                { id: 54, qty: 2 }, // Muro d'Illusione
                { id: 364, qty: 1 }, // Labirinto Magico
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 333, qty: 1 }, // Kunai con Catena
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 38, qty: 1 }, // Fusione
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 503, qty: 1 }, // Waboku
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 595, qty: 1 } // Il Guardiano Affidabile
            ],
            extra: [
                { id: 268, qty: 1 } // Giltia il Cavaliere D.
            ]
        },
        hard: {
            main: [
                { id: 33, qty: 1 }, // Il Guardiano del Cancello
                { id: 538, qty: 2 }, // Sanga del Tuono
                { id: 324, qty: 2 }, // Kazejin
                { id: 71, qty: 2 }, // Suijin
                { id: 337, qty: 2 }, // Muro del Labirinto
                { id: 857, qty: 1 }, // Wall Shadow
                { id: 316, qty: 2 }, // Jirai Gumo
                { id: 261, qty: 2 }, // Soldato di Pietra Gigante
                { id: 535, qty: 2 }, // Guardia del Labirinto
                { id: 536, qty: 2 }, // Protettrice del Trono
                { id: 603, qty: 2 }, // Muka Muka
                { id: 765, qty: 1 }, // Verme Medusa
                { id: 364, qty: 1 }, // Labirinto Magico
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 333, qty: 1 }, // Kunai con Catena
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 38, qty: 1 }, // Fusione
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 382, qty: 1 } // Forza dello Specchio
            ],
            extra: [
                { id: 268, qty: 1 } // Giltia il Cavaliere D.
            ]
        }
    },

    // Tristan Taylor: le poche carte che l'anime gli mostra — Comandante Cyber,
    // Guardiano di Lava e Guardiano della Palude, e Super Roboyarou (Roboyarou + Robolady),
    // il suo Deck Master nel Mondo Virtuale — più Macchine da combattimento dello stesso
    // stampo.
    tristan: {
        flagship: 343, // Guardiano di Lava — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 343, qty: 2 }, // Guardiano di Lava
                { id: 527, qty: 3 }, // Roboyarou
                { id: 528, qty: 3 }, // Robolady
                { id: 170, qty: 3 }, // Comandante Cyber
                { id: 264, qty: 2 }, // Lupo Giga-Tech
                { id: 298, qty: 2 }, // Gigante Un Occhio
                { id: 274, qty: 2 }, // Gradius
                { id: 176, qty: 1 }, // Soldato Cyber del Mondo Oscuro
                { id: 171, qty: 1 }, // Falco Cyber
                { id: 960, qty: 1 }, // Lumaca Meccanica
                { id: 38, qty: 1 }, // Fusione
                { id: 358, qty: 1 }, // Fabbrica di Conversione Meccanica
                { id: 631, qty: 1 }, // Megamorfosi
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 875, qty: 1 }, // Libro della Luna
                { id: 599, qty: 1 } // Sette Attrezzi del Bandito
            ],
            extra: [
                { id: 73, qty: 1 } // Super Roboyarou
            ]
        },
        medium: {
            main: [
                { id: 343, qty: 2 }, // Guardiano di Lava
                { id: 74, qty: 2 }, // Guardiano della Palude
                { id: 527, qty: 2 }, // Roboyarou
                { id: 528, qty: 2 }, // Robolady
                { id: 170, qty: 2 }, // Comandante Cyber
                { id: 176, qty: 2 }, // Soldato Cyber del Mondo Oscuro
                { id: 394, qty: 1 }, // Carro Armato Oni T-34
                { id: 281, qty: 1 }, // Bugroth l'Assalitore Terrestre
                { id: 171, qty: 1 }, // Falco Cyber
                { id: 174, qty: 1 }, // Predone Cyber
                { id: 298, qty: 1 }, // Gigante Un Occhio
                { id: 101, qty: 1 }, // Assalitore con l'Ascia
                { id: 264, qty: 1 }, // Lupo Giga-Tech
                { id: 467, qty: 1 }, // Il Demone Megacyber
                { id: 38, qty: 1 }, // Fusione
                { id: 631, qty: 1 }, // Megamorfosi
                { id: 358, qty: 1 }, // Fabbrica di Conversione Meccanica
                { id: 350, qty: 1 }, // Rimozione del Limitatore
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 503, qty: 1 }, // Waboku
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: [
                { id: 73, qty: 1 } // Super Roboyarou
            ]
        },
        hard: {
            main: [
                { id: 343, qty: 2 }, // Guardiano di Lava
                { id: 74, qty: 2 }, // Guardiano della Palude
                { id: 527, qty: 2 }, // Roboyarou
                { id: 528, qty: 2 }, // Robolady
                { id: 170, qty: 2 }, // Comandante Cyber
                { id: 176, qty: 2 }, // Soldato Cyber del Mondo Oscuro
                { id: 394, qty: 1 }, // Carro Armato Oni T-34
                { id: 281, qty: 1 }, // Bugroth l'Assalitore Terrestre
                { id: 171, qty: 1 }, // Falco Cyber
                { id: 174, qty: 1 }, // Predone Cyber
                { id: 101, qty: 2 }, // Assalitore con l'Ascia
                { id: 467, qty: 2 }, // Il Demone Megacyber
                { id: 38, qty: 1 }, // Fusione
                { id: 631, qty: 1 }, // Megamorfosi
                { id: 358, qty: 1 }, // Fabbrica di Conversione Meccanica
                { id: 350, qty: 1 }, // Rimozione del Limitatore
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 177, qty: 1 }, // Alligatore Cyber-Tecnologico
                { id: 382, qty: 1 } // Forza dello Specchio
            ],
            extra: [
                { id: 73, qty: 1 } // Super Roboyarou
            ]
        }
    },

    // Téa Gardner: Fate e Incantatrici — la Maga Oscura (il suo Deck Master nel
    // Mondo Virtuale), Amicizia/Abisso Splendente, Piccola Angela, Amante Felice, Maga della
    // Fede, Strega Oscura Dunames — con le sue carte d'affetto: Waboku, Spostamento, Dian Keto
    // e Scudo Lustro Giallo.
    tea: {
        flagship: 188, // Maga Oscura — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 188, qty: 2 }, // Maga Oscura
                { id: 443, qty: 3 }, // Amicizia Splendente
                { id: 391, qty: 3 }, // Elfa Mistica
                { id: 458, qty: 2 }, // Spirito dell'Arpa
                { id: 402, qty: 3 }, // Piccola Angela
                { id: 287, qty: 2 }, // Amante Felice
                { id: 588, qty: 2 }, // Maga della Fede
                { id: 1074, qty: 2 }, // Hoshiningen
                { id: 442, qty: 1 }, // Abisso Splendente
                { id: 234, qty: 1 }, // Dono della Fata
                { id: 503, qty: 2 }, // Waboku
                { id: 622, qty: 1 }, // Spostamento
                { id: 546, qty: 2 }, // Dian Keto la Maestra delle Cure
                { id: 148, qty: 1 }, // Scudo Lustro Giallo
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 151, qty: 1 }, // Coro del Santuario
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 } // Il Guardiano Affidabile
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 188, qty: 2 }, // Maga Oscura
                { id: 217, qty: 2 }, // Strega Oscura Dunames
                { id: 442, qty: 2 }, // Abisso Splendente
                { id: 443, qty: 2 }, // Amicizia Splendente
                { id: 391, qty: 2 }, // Elfa Mistica
                { id: 458, qty: 2 }, // Spirito dell'Arpa
                { id: 234, qty: 2 }, // Dono della Fata
                { id: 402, qty: 2 }, // Piccola Angela
                { id: 287, qty: 1 }, // Amante Felice
                { id: 588, qty: 1 }, // Maga della Fede
                { id: 1074, qty: 1 }, // Hoshiningen
                { id: 203, qty: 1 }, // Doma l'Angelo del Silenzio
                { id: 562, qty: 1 }, // Gyakutenno Megami
                { id: 503, qty: 2 }, // Waboku
                { id: 622, qty: 1 }, // Spostamento
                { id: 546, qty: 2 }, // Dian Keto la Maestra delle Cure
                { id: 148, qty: 1 }, // Scudo Lustro Giallo
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 151, qty: 1 }, // Coro del Santuario
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 143, qty: 1 } // Mura del Castello
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 188, qty: 2 }, // Maga Oscura
                { id: 217, qty: 2 }, // Strega Oscura Dunames
                { id: 442, qty: 2 }, // Abisso Splendente
                { id: 443, qty: 2 }, // Amicizia Splendente
                { id: 391, qty: 2 }, // Elfa Mistica
                { id: 458, qty: 2 }, // Spirito dell'Arpa
                { id: 234, qty: 2 }, // Dono della Fata
                { id: 402, qty: 2 }, // Piccola Angela
                { id: 588, qty: 1 }, // Maga della Fede
                { id: 203, qty: 1 }, // Doma l'Angelo del Silenzio
                { id: 562, qty: 2 }, // Gyakutenno Megami
                { id: 503, qty: 2 }, // Waboku
                { id: 622, qty: 1 }, // Spostamento
                { id: 546, qty: 2 }, // Dian Keto la Maestra delle Cure
                { id: 148, qty: 1 }, // Scudo Lustro Giallo
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 954, qty: 1 }, // Strega Oscura
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 448, qty: 1 } // Giudizio Solenne
            ],
            extra: []
        }
    },

    // Serenity Wheeler: Fate ed Elfe gentili e carte di cura — Elfa Mistica,
    // Piccola Angela, Maga della Fede, Amicizia Splendente, con una dea (Gyakutenno Megami) al
    // posto della Dea dal Terzo Occhio del Mondo Virtuale, che il gioco non ha.
    serenity: {
        flagship: 562, // Gyakutenno Megami — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 562, qty: 1 }, // Gyakutenno Megami
                { id: 391, qty: 3 }, // Elfa Mistica
                { id: 402, qty: 3 }, // Piccola Angela
                { id: 443, qty: 2 }, // Amicizia Splendente
                { id: 588, qty: 2 }, // Maga della Fede
                { id: 338, qty: 2 }, // Dama della Fede
                { id: 458, qty: 2 }, // Spirito dell'Arpa
                { id: 287, qty: 2 }, // Amante Felice
                { id: 1074, qty: 2 }, // Hoshiningen
                { id: 234, qty: 1 }, // Dono della Fata
                { id: 93, qty: 1 }, // Antico Elfo
                { id: 546, qty: 2 }, // Dian Keto la Maestra delle Cure
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 819, qty: 1 }, // Scudo con Braccio Magico
                { id: 148, qty: 1 }, // Scudo Lustro Giallo
                { id: 151, qty: 1 }, // Coro del Santuario
                { id: 263, qty: 1 }, // Dono dell'Elfa Mistica
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 40, qty: 1 } // Buco Trappola
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 562, qty: 1 }, // Gyakutenno Megami
                { id: 217, qty: 2 }, // Strega Oscura Dunames
                { id: 442, qty: 2 }, // Abisso Splendente
                { id: 443, qty: 2 }, // Amicizia Splendente
                { id: 391, qty: 3 }, // Elfa Mistica
                { id: 93, qty: 2 }, // Antico Elfo
                { id: 234, qty: 2 }, // Dono della Fata
                { id: 402, qty: 2 }, // Piccola Angela
                { id: 588, qty: 1 }, // Maga della Fede
                { id: 338, qty: 1 }, // Dama della Fede
                { id: 458, qty: 2 }, // Spirito dell'Arpa
                { id: 878, qty: 1 }, // Angelo Splendente
                { id: 1065, qty: 1 }, // Fata Danzante
                { id: 546, qty: 2 }, // Dian Keto la Maestra delle Cure
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 819, qty: 1 }, // Scudo con Braccio Magico
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 263, qty: 1 }, // Dono dell'Elfa Mistica
                { id: 148, qty: 1 }, // Scudo Lustro Giallo
                { id: 151, qty: 1 } // Coro del Santuario
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 562, qty: 1 }, // Gyakutenno Megami
                { id: 217, qty: 2 }, // Strega Oscura Dunames
                { id: 442, qty: 2 }, // Abisso Splendente
                { id: 443, qty: 2 }, // Amicizia Splendente
                { id: 391, qty: 3 }, // Elfa Mistica
                { id: 93, qty: 2 }, // Antico Elfo
                { id: 234, qty: 2 }, // Dono della Fata
                { id: 402, qty: 1 }, // Piccola Angela
                { id: 588, qty: 1 }, // Maga della Fede
                { id: 458, qty: 2 }, // Spirito dell'Arpa
                { id: 878, qty: 1 }, // Angelo Splendente
                { id: 1065, qty: 1 }, // Fata Danzante
                { id: 546, qty: 2 }, // Dian Keto la Maestra delle Cure
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 819, qty: 1 }, // Scudo con Braccio Magico
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 148, qty: 1 }, // Scudo Lustro Giallo
                { id: 954, qty: 1 }, // Strega Oscura
                { id: 203, qty: 1 }, // Doma l'Angelo del Silenzio
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 7, qty: 1 } // Buco Nero
            ],
            extra: []
        }
    },

    // Duke Devlin: i dadi del suo Dungeon Dice Monsters — Orgoth l'Implacabile
    // (la sua carta simbolo), Dicelops, Dado Aggraziato, Dado Teschio, Dado di Evocazione,
    // Dado Dimensionale, Prigione dei Dadi — e i ninja del Mondo Virtuale, dove il suo Deck
    // Master era il Ninja d'Assalto.
    duke: {
        flagship: 395, // Orgoth l'Implacabile — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 395, qty: 2 }, // Orgoth l'Implacabile
                { id: 780, qty: 3 }, // Ninja Signora Yae
                { id: 318, qty: 2 }, // Kagemusha della Fiamma Blu
                { id: 586, qty: 2 }, // Uomo Karate
                { id: 1120, qty: 3 }, // Il Cacciatore dalle 7 Armi
                { id: 717, qty: 2 }, // Mataza il Fulminatore
                { id: 604, qty: 2 }, // Ninja Armato
                { id: 1022, qty: 2 }, // Scarpe Mordaci
                { id: 459, qty: 1 }, // Ninja d'Assalto
                { id: 988, qty: 1 }, // Cavaliere Senza Testa
                { id: 273, qty: 2 }, // Dado Aggraziato
                { id: 460, qty: 1 }, // Dado di Evocazione
                { id: 197, qty: 1 }, // Prigione dei Dadi
                { id: 200, qty: 1 }, // Dado Dimensionale
                { id: 445, qty: 2 }, // Dado Teschio
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 546, qty: 1 } // Dian Keto la Maestra delle Cure
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 395, qty: 2 }, // Orgoth l'Implacabile
                { id: 863, qty: 2 }, // Dicelops
                { id: 459, qty: 2 }, // Ninja d'Assalto
                { id: 720, qty: 1 }, // Gran Maestro Ninja Sasuke
                { id: 780, qty: 2 }, // Ninja Signora Yae
                { id: 604, qty: 1 }, // Ninja Armato
                { id: 613, qty: 2 }, // Lama Oscura
                { id: 1055, qty: 1 }, // Samurai Sasuke
                { id: 586, qty: 1 }, // Uomo Karate
                { id: 318, qty: 1 }, // Kagemusha della Fiamma Blu
                { id: 930, qty: 1 }, // Cavaliere Succubo
                { id: 988, qty: 1 }, // Cavaliere Senza Testa
                { id: 717, qty: 1 }, // Mataza il Fulminatore
                { id: 1120, qty: 2 }, // Il Cacciatore dalle 7 Armi
                { id: 460, qty: 2 }, // Dado di Evocazione
                { id: 273, qty: 2 }, // Dado Aggraziato
                { id: 200, qty: 1 }, // Dado Dimensionale
                { id: 197, qty: 1 }, // Prigione dei Dadi
                { id: 445, qty: 2 }, // Dado Teschio
                { id: 794, qty: 1 }, // Arte Ninjitsu della Trasformazione
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 503, qty: 1 }, // Waboku
                { id: 600, qty: 1 } // Trappola Fasulla
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 395, qty: 2 }, // Orgoth l'Implacabile
                { id: 863, qty: 2 }, // Dicelops
                { id: 459, qty: 2 }, // Ninja d'Assalto
                { id: 720, qty: 2 }, // Gran Maestro Ninja Sasuke
                { id: 780, qty: 2 }, // Ninja Signora Yae
                { id: 604, qty: 1 }, // Ninja Armato
                { id: 613, qty: 2 }, // Lama Oscura
                { id: 1055, qty: 1 }, // Samurai Sasuke
                { id: 930, qty: 2 }, // Cavaliere Succubo
                { id: 988, qty: 1 }, // Cavaliere Senza Testa
                { id: 717, qty: 1 }, // Mataza il Fulminatore
                { id: 1120, qty: 2 }, // Il Cacciatore dalle 7 Armi
                { id: 460, qty: 2 }, // Dado di Evocazione
                { id: 273, qty: 2 }, // Dado Aggraziato
                { id: 200, qty: 1 }, // Dado Dimensionale
                { id: 197, qty: 1 }, // Prigione dei Dadi
                { id: 445, qty: 2 }, // Dado Teschio
                { id: 794, qty: 1 }, // Arte Ninjitsu della Trasformazione
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 793, qty: 1 } // Armatura Sakuretsu
            ],
            extra: []
        }
    },

    // Solomon Muto: il duellante "della vecchia scuola" — mostri Normali classici
    // (Gaia, Maledizione del Drago, Guerriero Celtico, Antico Elfo, Castoro Guerriero) e
    // Trappole prudenti. Niente Mago Nero ed Exodia: sono le carte che ha passato a Yugi.
    solomonMuto: {
        flagship: 14, // Gaia il Cavaliere Feroce — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 14, qty: 2 }, // Gaia il Cavaliere Feroce
                { id: 109, qty: 3 }, // Castoro Guerriero
                { id: 444, qty: 2 }, // Zanna d'Argento
                { id: 27, qty: 3 }, // Cucciolo di Drago
                { id: 108, qty: 2 }, // Guerriero da Battaglia
                { id: 261, qty: 2 }, // Soldato di Pietra Gigante
                { id: 391, qty: 2 }, // Elfa Mistica
                { id: 97, qty: 2 }, // Armaill
                { id: 126, qty: 1 }, // Pinguino Fulmine
                { id: 4, qty: 1 }, // Guerriero Celtico
                { id: 93, qty: 1 }, // Antico Elfo
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 263, qty: 1 }, // Dono dell'Elfa Mistica
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 38, qty: 1 }, // Fusione
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 14, qty: 2 }, // Gaia il Cavaliere Feroce
                { id: 15, qty: 1 }, // Maledizione del Drago
                { id: 4, qty: 2 }, // Guerriero Celtico
                { id: 93, qty: 2 }, // Antico Elfo
                { id: 260, qty: 1 }, // Gigantesco Serpente di Mare Rosso
                { id: 98, qty: 1 }, // Lucertola Corazzata
                { id: 83, qty: 1 }, // Spada di Alligatore
                { id: 101, qty: 1 }, // Assalitore con l'Ascia
                { id: 109, qty: 2 }, // Castoro Guerriero
                { id: 444, qty: 1 }, // Zanna d'Argento
                { id: 27, qty: 2 }, // Cucciolo di Drago
                { id: 108, qty: 1 }, // Guerriero da Battaglia
                { id: 337, qty: 1 }, // Muro del Labirinto
                { id: 106, qty: 1 }, // Bue da Battaglia
                { id: 261, qty: 1 }, // Soldato di Pietra Gigante
                { id: 391, qty: 1 }, // Elfa Mistica
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 38, qty: 1 }, // Fusione
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 263, qty: 1 }, // Dono dell'Elfa Mistica
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: [
                { id: 254, qty: 1 }, // Gaia il Campione dei Draghi
                { id: 84, qty: 1 } // Drago Spada di Alligatore
            ]
        },
        hard: {
            main: [
                { id: 14, qty: 2 }, // Gaia il Cavaliere Feroce
                { id: 15, qty: 2 }, // Maledizione del Drago
                { id: 4, qty: 2 }, // Guerriero Celtico
                { id: 93, qty: 2 }, // Antico Elfo
                { id: 260, qty: 1 }, // Gigantesco Serpente di Mare Rosso
                { id: 98, qty: 1 }, // Lucertola Corazzata
                { id: 83, qty: 1 }, // Spada di Alligatore
                { id: 101, qty: 1 }, // Assalitore con l'Ascia
                { id: 109, qty: 2 }, // Castoro Guerriero
                { id: 444, qty: 1 }, // Zanna d'Argento
                { id: 27, qty: 2 }, // Cucciolo di Drago
                { id: 337, qty: 1 }, // Muro del Labirinto
                { id: 106, qty: 1 }, // Bue da Battaglia
                { id: 261, qty: 1 }, // Soldato di Pietra Gigante
                { id: 391, qty: 1 }, // Elfa Mistica
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 38, qty: 1 }, // Fusione
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 382, qty: 1 } // Forza dello Specchio
            ],
            extra: [
                { id: 254, qty: 1 }, // Gaia il Campione dei Draghi
                { id: 84, qty: 1 } // Drago Spada di Alligatore
            ]
        }
    },

    // Simon Muran, il precettore del principe: Incantatori ed Elfe, la magia
    // che insegna (Maga Oscura, Elfa Mistica, Il Mistico Severo, Neo lo Spadaccino Magico) —
    // uno dei primi avversari di Forbidden Memories.
    simonMuran: {
        flagship: 188, // Maga Oscura — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 188, qty: 2 }, // Maga Oscura
                { id: 391, qty: 3 }, // Elfa Mistica
                { id: 458, qty: 2 }, // Spirito dell'Arpa
                { id: 54, qty: 3 }, // Muro d'Illusione
                { id: 338, qty: 2 }, // Dama della Fede
                { id: 924, qty: 2 }, // Nemuriko
                { id: 169, qty: 2 }, // Tenda degli Oscuri
                { id: 304, qty: 2 }, // Hurricail
                { id: 93, qty: 1 }, // Antico Elfo
                { id: 550, qty: 1 }, // Il Mistico Severo
                { id: 557, qty: 1 }, // Yami
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 263, qty: 1 }, // Dono dell'Elfa Mistica
                { id: 546, qty: 2 }, // Dian Keto la Maestra delle Cure
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 188, qty: 2 }, // Maga Oscura
                { id: 391, qty: 3 }, // Elfa Mistica
                { id: 458, qty: 2 }, // Spirito dell'Arpa
                { id: 54, qty: 2 }, // Muro d'Illusione
                { id: 93, qty: 2 }, // Antico Elfo
                { id: 550, qty: 2 }, // Il Mistico Severo
                { id: 551, qty: 2 }, // Neo lo Spadaccino Magico
                { id: 234, qty: 1 }, // Dono della Fata
                { id: 424, qty: 2 }, // Bambola Canaglia
                { id: 338, qty: 1 }, // Dama della Fede
                { id: 306, qty: 1 }, // Mago Senza Volto Illusionista
                { id: 554, qty: 1 }, // Stregone dei Dannati
                { id: 557, qty: 1 }, // Yami
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 263, qty: 1 }, // Dono dell'Elfa Mistica
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 188, qty: 2 }, // Maga Oscura
                { id: 391, qty: 3 }, // Elfa Mistica
                { id: 458, qty: 2 }, // Spirito dell'Arpa
                { id: 54, qty: 2 }, // Muro d'Illusione
                { id: 93, qty: 1 }, // Antico Elfo
                { id: 550, qty: 2 }, // Il Mistico Severo
                { id: 551, qty: 2 }, // Neo lo Spadaccino Magico
                { id: 234, qty: 1 }, // Dono della Fata
                { id: 424, qty: 2 }, // Bambola Canaglia
                { id: 306, qty: 2 }, // Mago Senza Volto Illusionista
                { id: 554, qty: 1 }, // Stregone dei Dannati
                { id: 557, qty: 1 }, // Yami
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 738, qty: 1 }, // Mago Comando del Caos
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 448, qty: 1 } // Giudizio Solenne
            ],
            extra: []
        }
    },

    // Jono, l'amico del principe (il Joey dell'antico Egitto): uno degli avversari
    // più facili di Forbidden Memories, con Guerrieri e Bestie-Guerriero Normali di poco
    // conto (Bue da Battaglia, Castoro Guerriero, Ascia Tigre, Cavaliere Mistico).
    jono: {
        flagship: 106, // Bue da Battaglia — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 106, qty: 2 }, // Bue da Battaglia
                { id: 109, qty: 3 }, // Castoro Guerriero
                { id: 108, qty: 3 }, // Guerriero da Battaglia
                { id: 477, qty: 2 }, // Ascia Tigre
                { id: 298, qty: 2 }, // Gigante Un Occhio
                { id: 389, qty: 2 }, // Cavaliere Mistico
                { id: 318, qty: 2 }, // Kagemusha della Fiamma Blu
                { id: 97, qty: 2 }, // Armaill
                { id: 296, qty: 1 }, // Eroe dell'Est
                { id: 567, qty: 1 }, // Orco dell'Ombra Nera
                { id: 101, qty: 1 }, // Assalitore con l'Ascia
                { id: 580, qty: 1 }, // Sogen
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 2 }, // Dian Keto la Maestra delle Cure
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 106, qty: 2 }, // Bue da Battaglia
                { id: 107, qty: 1 }, // Toro da Battaglia
                { id: 109, qty: 2 }, // Castoro Guerriero
                { id: 108, qty: 2 }, // Guerriero da Battaglia
                { id: 477, qty: 2 }, // Ascia Tigre
                { id: 298, qty: 2 }, // Gigante Un Occhio
                { id: 389, qty: 2 }, // Cavaliere Mistico
                { id: 256, qty: 1 }, // Garoozis
                { id: 318, qty: 1 }, // Kagemusha della Fiamma Blu
                { id: 296, qty: 1 }, // Eroe dell'Est
                { id: 97, qty: 1 }, // Armaill
                { id: 463, qty: 1 }, // Spadaccino di Landstar
                { id: 567, qty: 1 }, // Orco dell'Ombra Nera
                { id: 101, qty: 1 }, // Assalitore con l'Ascia
                { id: 580, qty: 1 }, // Sogen
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 313, qty: 1 }, // Rinvigorimento
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 546, qty: 1 } // Dian Keto la Maestra delle Cure
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 106, qty: 2 }, // Bue da Battaglia
                { id: 107, qty: 2 }, // Toro da Battaglia
                { id: 109, qty: 2 }, // Castoro Guerriero
                { id: 108, qty: 2 }, // Guerriero da Battaglia
                { id: 477, qty: 2 }, // Ascia Tigre
                { id: 298, qty: 2 }, // Gigante Un Occhio
                { id: 389, qty: 2 }, // Cavaliere Mistico
                { id: 256, qty: 2 }, // Garoozis
                { id: 296, qty: 1 }, // Eroe dell'Est
                { id: 463, qty: 1 }, // Spadaccino di Landstar
                { id: 567, qty: 1 }, // Orco dell'Ombra Nera
                { id: 101, qty: 1 }, // Assalitore con l'Ascia
                { id: 580, qty: 1 }, // Sogen
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 313, qty: 1 }, // Rinvigorimento
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 427, qty: 1 } // Rude Kaiser
            ],
            extra: []
        }
    },

    // Mage Soldier, il soldato-mago di Heishin (Forbidden Memories): la
    // ronda che ferma il principe appena tornato in Egitto. Incantatori e
    // Guerrieri armati di magia, con Distruttore il Guerriero Magico come
    // carta simbolo. Stessa ossatura di Magie/Trappole dei mazzi del passato.
    mageSoldier: {
        flagship: 131, // Distruttore, il Guerriero Magico — stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 131, qty: 2 }, // Distruttore, il Guerriero Magico
                { id: 591, qty: 3 }, // Cappello Magico Bianco
                { id: 242, qty: 2 }, // Stregone di Fuoco
                { id: 338, qty: 3 }, // Dama della Fede
                { id: 508, qty: 2 }, // Strega della Foresta Nera
                { id: 1038, qty: 2 }, // Evocatore di Illusioni
                { id: 431, qty: 2 }, // Saggi il Pagliaccio Oscuro
                { id: 737, qty: 2 }, // Mago Apprendista
                { id: 108, qty: 2 }, // Guerriero da Battaglia
                { id: 304, qty: 1 }, // Hurricail
                { id: 539, qty: 1 }, // Signore delle Fiamme
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 2 }, // Dian Keto la Maestra delle Cure
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: [
                // Evocatore di Illusioni ha finalmente un bersaglio reale;
                // i materiali sono gia' entrambi nel Main Deck.
                { id: 387, qty: 1 } // Re dei Musicisti
            ]
        },
        medium: {
            main: [
                { id: 131, qty: 2 }, // Distruttore, il Guerriero Magico
                { id: 744, qty: 1 }, // Mago a Fuoco Rapido
                { id: 742, qty: 2 }, // Mago dell'Esplosione
                { id: 554, qty: 1 }, // Stregone dei Dannati
                { id: 551, qty: 2 }, // Neo lo Spadaccino Magico
                { id: 591, qty: 2 }, // Cappello Magico Bianco
                { id: 338, qty: 2 }, // Dama della Fede
                { id: 508, qty: 2 }, // Strega della Foresta Nera
                { id: 242, qty: 2 }, // Stregone di Fuoco
                { id: 1038, qty: 1 }, // Evocatore di Illusioni
                { id: 108, qty: 2 }, // Guerriero da Battaglia
                { id: 431, qty: 1 }, // Saggi il Pagliaccio Oscuro
                { id: 304, qty: 1 }, // Hurricail
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 313, qty: 1 }, // Rinvigorimento
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 546, qty: 1 } // Dian Keto la Maestra delle Cure
            ],
            extra: [
                { id: 387, qty: 1 } // Re dei Musicisti
            ]
        },
        hard: {
            main: [
                { id: 131, qty: 2 }, // Distruttore, il Guerriero Magico
                { id: 551, qty: 2 }, // Neo lo Spadaccino Magico
                { id: 744, qty: 2 }, // Mago a Fuoco Rapido
                { id: 742, qty: 2 }, // Mago dell'Esplosione
                { id: 1066, qty: 1 }, // Elfa Oscura
                // Abile Mago Oscuro senza Mago Nero era una linea morta.
                // Cerbero conserva i Segnalini Magia e premia davvero le
                // numerose Magie del livello Difficile.
                { id: 734, qty: 2 }, // Bestia Mitica Cerbero
                { id: 554, qty: 2 }, // Stregone dei Dannati
                { id: 550, qty: 1 }, // Il Mistico Severo
                { id: 591, qty: 2 }, // Cappello Magico Bianco
                { id: 338, qty: 2 }, // Dama della Fede
                { id: 108, qty: 2 }, // Guerriero da Battaglia
                { id: 242, qty: 2 }, // Stregone di Fuoco
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 313, qty: 1 }, // Rinvigorimento
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 382, qty: 1 } // Forza dello Specchio
            ],
            extra: []
        }
    },

    // Teana, l'amica del principe (la Téa dell'antico Egitto): Elfe e Fate
    // gentili (Elfi Gemelli, Elfa Mistica, Spirito dell'Arpa, Piccola Angela), una delle
    // avversarie più morbide di Forbidden Memories.
    teana: {
        flagship: 24, // Elfi Gemelli — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 24, qty: 3 }, // Elfi Gemelli
                { id: 391, qty: 3 }, // Elfa Mistica
                { id: 458, qty: 2 }, // Spirito dell'Arpa
                { id: 402, qty: 3 }, // Piccola Angela
                { id: 925, qty: 2 }, // Raggio e Temperatura
                { id: 982, qty: 2 }, // Bio-Mago
                { id: 338, qty: 2 }, // Dama della Fede
                { id: 54, qty: 2 }, // Muro d'Illusione
                { id: 93, qty: 1 }, // Antico Elfo
                { id: 234, qty: 1 }, // Dono della Fata
                { id: 151, qty: 1 }, // Coro del Santuario
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 546, qty: 2 }, // Dian Keto la Maestra delle Cure
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 225, qty: 1 }, // Luce dell'Elfo
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 24, qty: 3 }, // Elfi Gemelli
                { id: 391, qty: 2 }, // Elfa Mistica
                { id: 458, qty: 2 }, // Spirito dell'Arpa
                { id: 54, qty: 2 }, // Muro d'Illusione
                { id: 93, qty: 2 }, // Antico Elfo
                { id: 234, qty: 2 }, // Dono della Fata
                { id: 402, qty: 2 }, // Piccola Angela
                { id: 442, qty: 2 }, // Abisso Splendente
                { id: 443, qty: 1 }, // Amicizia Splendente
                { id: 338, qty: 1 }, // Dama della Fede
                { id: 550, qty: 1 }, // Il Mistico Severo
                { id: 925, qty: 1 }, // Raggio e Temperatura
                { id: 982, qty: 1 }, // Bio-Mago
                { id: 151, qty: 1 }, // Coro del Santuario
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 225, qty: 1 } // Luce dell'Elfo
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 24, qty: 3 }, // Elfi Gemelli
                { id: 391, qty: 2 }, // Elfa Mistica
                { id: 458, qty: 2 }, // Spirito dell'Arpa
                { id: 54, qty: 2 }, // Muro d'Illusione
                { id: 93, qty: 2 }, // Antico Elfo
                { id: 234, qty: 2 }, // Dono della Fata
                { id: 402, qty: 2 }, // Piccola Angela
                { id: 442, qty: 2 }, // Abisso Splendente
                { id: 443, qty: 1 }, // Amicizia Splendente
                { id: 338, qty: 1 }, // Dama della Fede
                { id: 550, qty: 1 }, // Il Mistico Severo
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 225, qty: 1 }, // Luce dell'Elfo
                { id: 188, qty: 1 }, // Maga Oscura
                { id: 954, qty: 1 }, // Strega Oscura
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 448, qty: 1 } // Giudizio Solenne
            ],
            extra: []
        }
    },

    // Il Sacerdote Seto: Draghi e i Drago Bianco Occhi Blu, come il suo
    // discendente — con il Signore dei D. e i draghi minori del Forbidden Memories.
    priestSeto: {
        flagship: 1, // Drago Bianco Occhi Blu — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 1, qty: 3 }, // Drago Bianco Occhi Blu
                { id: 353, qty: 3 }, // Signore dei D.
                { id: 431, qty: 3 }, // Saggi il Pagliaccio Oscuro
                { id: 534, qty: 2 }, // Drago con Scudo
                { id: 1050, qty: 2 }, // Drago della Truppa
                { id: 993, qty: 2 }, // Soldato Lucertola
                { id: 404, qty: 2 }, // Drago Nero Pece
                { id: 507, qty: 2 }, // Drago Alato, Guardiano della Fortezza #1
                { id: 331, qty: 1 }, // Drago Koumori
                { id: 596, qty: 1 }, // Montagna
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 597, qty: 1 }, // Tesoro del Drago
                { id: 69, qty: 1 }, // Stop Difesa
                { id: 875, qty: 1 }, // Libro della Luna
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 1, qty: 3 }, // Drago Bianco Occhi Blu
                { id: 15, qty: 2 }, // Maledizione del Drago
                { id: 320, qty: 1 }, // Kaiser Glider
                { id: 321, qty: 2 }, // Kaiser Sea Horse
                { id: 502, qty: 2 }, // Predone Vorse
                { id: 454, qty: 2 }, // Drago Lancia
                { id: 429, qty: 1 }, // Ryu-Ran
                { id: 353, qty: 2 }, // Signore dei D.
                { id: 507, qty: 2 }, // Drago Alato, Guardiano della Fortezza #1
                { id: 331, qty: 1 }, // Drago Koumori
                { id: 118, qty: 1 }, // Drago di Fuoco delle Terre Nere
                { id: 431, qty: 1 }, // Saggi il Pagliaccio Oscuro
                { id: 534, qty: 1 }, // Drago con Scudo
                { id: 578, qty: 1 }, // Il Flauto per Evocare Draghi
                { id: 596, qty: 1 }, // Montagna
                { id: 597, qty: 1 }, // Tesoro del Drago
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 38, qty: 1 }, // Fusione
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 69, qty: 1 }, // Stop Difesa
                { id: 226, qty: 1 } // Controllore del Nemico
            ],
            extra: [
                { id: 29, qty: 1 } // Drago Bianco Definitivo
            ]
        },
        hard: {
            main: [
                { id: 1, qty: 3 }, // Drago Bianco Occhi Blu
                { id: 15, qty: 2 }, // Maledizione del Drago
                { id: 320, qty: 2 }, // Kaiser Glider
                { id: 321, qty: 2 }, // Kaiser Sea Horse
                { id: 502, qty: 2 }, // Predone Vorse
                { id: 454, qty: 2 }, // Drago Lancia
                { id: 429, qty: 2 }, // Ryu-Ran
                { id: 353, qty: 2 }, // Signore dei D.
                { id: 507, qty: 2 }, // Drago Alato, Guardiano della Fortezza #1
                { id: 331, qty: 1 }, // Drago Koumori
                { id: 118, qty: 1 }, // Drago di Fuoco delle Terre Nere
                { id: 578, qty: 1 }, // Il Flauto per Evocare Draghi
                { id: 596, qty: 1 }, // Montagna
                { id: 597, qty: 1 }, // Tesoro del Drago
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 38, qty: 1 }, // Fusione
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 226, qty: 1 }, // Controllore del Nemico
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 37, qty: 1 } // Folgore Fulminante
            ],
            extra: [
                { id: 29, qty: 1 } // Drago Bianco Definitivo
            ]
        }
    },

    // Shadi, il custode della Chiave del Millennio: le Sfingi (Hieracosfinge,
    // Criosfinge, Sfinge Guardiana, fino a Exxod) e le statue di roccia a guardia del
    // santuario, con L'Occhio della Verità per chi legge nell'anima.
    shadi: {
        flagship: 760, // Hieracosfinge — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 760, qty: 2 }, // Hieracosfinge
                { id: 764, qty: 3 }, // Statua Guardiana
                { id: 759, qty: 3 }, // Sentinella Golem
                { id: 755, qty: 2 }, // Maharaghi
                { id: 754, qty: 2 }, // Grande Spirito
                { id: 261, qty: 2 }, // Soldato di Pietra Gigante
                { id: 765, qty: 2 }, // Verme Medusa
                { id: 762, qty: 2 }, // Cannoni Intercettori Moai
                { id: 1116, qty: 1 }, // Uomo con Wdjat
                { id: 766, qty: 1 }, // Falena della Sabbia
                { id: 767, qty: 1 }, // Canyon
                { id: 769, qty: 1 }, // Ombre Mutevoli
                { id: 466, qty: 1 }, // L'Occhio della Verità
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 771, qty: 1 }, // Prova del Viandante
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 760, qty: 2 }, // Hieracosfinge
                { id: 761, qty: 2 }, // Criosfinge
                { id: 756, qty: 2 }, // Sfinge Guardiana
                { id: 753, qty: 1 }, // Exxod, Maestro della Guardia
                { id: 757, qty: 2 }, // Gigantes
                { id: 764, qty: 2 }, // Statua Guardiana
                { id: 754, qty: 1 }, // Grande Spirito
                { id: 755, qty: 1 }, // Maharaghi
                { id: 759, qty: 1 }, // Sentinella Golem
                { id: 758, qty: 1 }, // Statua di Pietra degli Aztechi
                { id: 1116, qty: 1 }, // Uomo con Wdjat
                { id: 261, qty: 2 }, // Soldato di Pietra Gigante
                { id: 766, qty: 1 }, // Falena della Sabbia
                { id: 762, qty: 1 }, // Cannoni Intercettori Moai
                { id: 767, qty: 1 }, // Canyon
                { id: 769, qty: 1 }, // Ombre Mutevoli
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 771, qty: 1 }, // Prova del Viandante
                { id: 466, qty: 1 }, // L'Occhio della Verità
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 503, qty: 1 }, // Waboku
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 426, qty: 1 }, // Decreto Reale
                { id: 595, qty: 1 } // Il Guardiano Affidabile
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 760, qty: 2 }, // Hieracosfinge
                { id: 761, qty: 2 }, // Criosfinge
                { id: 756, qty: 3 }, // Sfinge Guardiana
                { id: 753, qty: 2 }, // Exxod, Maestro della Guardia
                { id: 757, qty: 3 }, // Gigantes
                { id: 764, qty: 2 }, // Statua Guardiana
                { id: 754, qty: 1 }, // Grande Spirito
                { id: 755, qty: 1 }, // Maharaghi
                { id: 759, qty: 1 }, // Sentinella Golem
                { id: 1116, qty: 1 }, // Uomo con Wdjat
                { id: 261, qty: 2 }, // Soldato di Pietra Gigante
                { id: 762, qty: 1 }, // Cannoni Intercettori Moai
                { id: 767, qty: 1 }, // Canyon
                { id: 769, qty: 1 }, // Ombre Mutevoli
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 771, qty: 1 }, // Prova del Viandante
                { id: 466, qty: 1 }, // L'Occhio della Verità
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 426, qty: 1 }, // Decreto Reale
                { id: 382, qty: 1 } // Forza dello Specchio
            ],
            extra: []
        }
    },

    // La Sacerdotessa Isis, custode della Collana del Millennio: Fate e Streghe
    // di luce, con la Carta del Ritorno Sicuro e il Telescopio Antico della preveggenza.
    priestessIsis: {
        flagship: 954, // Strega Oscura — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 954, qty: 2 }, // Strega Oscura
                { id: 458, qty: 3 }, // Spirito dell'Arpa
                { id: 391, qty: 3 }, // Elfa Mistica
                { id: 402, qty: 3 }, // Piccola Angela
                { id: 54, qty: 2 }, // Muro d'Illusione
                { id: 338, qty: 2 }, // Dama della Fede
                { id: 925, qty: 2 }, // Raggio e Temperatura
                { id: 443, qty: 1 }, // Amicizia Splendente
                { id: 93, qty: 1 }, // Antico Elfo
                { id: 442, qty: 1 }, // Abisso Splendente
                { id: 151, qty: 1 }, // Coro del Santuario
                { id: 141, qty: 1 }, // Carta del Ritorno Sicuro
                { id: 576, qty: 1 }, // Telescopio Antico
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 546, qty: 2 }, // Dian Keto la Maestra delle Cure
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 148, qty: 1 }, // Scudo Lustro Giallo
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 954, qty: 2 }, // Strega Oscura
                { id: 217, qty: 2 }, // Strega Oscura Dunames
                { id: 458, qty: 3 }, // Spirito dell'Arpa
                { id: 391, qty: 2 }, // Elfa Mistica
                { id: 54, qty: 2 }, // Muro d'Illusione
                { id: 93, qty: 2 }, // Antico Elfo
                { id: 234, qty: 2 }, // Dono della Fata
                { id: 402, qty: 1 }, // Piccola Angela
                { id: 442, qty: 1 }, // Abisso Splendente
                { id: 338, qty: 1 }, // Dama della Fede
                { id: 443, qty: 1 }, // Amicizia Splendente
                { id: 949, qty: 1 }, // Ocubeam
                { id: 151, qty: 1 }, // Coro del Santuario
                { id: 141, qty: 1 }, // Carta del Ritorno Sicuro
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 448, qty: 1 }, // Giudizio Solenne
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 576, qty: 1 }, // Telescopio Antico
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 148, qty: 1 } // Scudo Lustro Giallo
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 954, qty: 2 }, // Strega Oscura
                { id: 217, qty: 2 }, // Strega Oscura Dunames
                { id: 458, qty: 3 }, // Spirito dell'Arpa
                { id: 391, qty: 2 }, // Elfa Mistica
                { id: 54, qty: 2 }, // Muro d'Illusione
                { id: 93, qty: 2 }, // Antico Elfo
                { id: 234, qty: 2 }, // Dono della Fata
                { id: 442, qty: 1 }, // Abisso Splendente
                { id: 443, qty: 1 }, // Amicizia Splendente
                { id: 949, qty: 1 }, // Ocubeam
                { id: 141, qty: 1 }, // Carta del Ritorno Sicuro
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 448, qty: 1 }, // Giudizio Solenne
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 576, qty: 1 }, // Telescopio Antico
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 562, qty: 1 }, // Gyakutenno Megami
                { id: 203, qty: 1 }, // Doma l'Angelo del Silenzio
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 7, qty: 1 } // Buco Nero
            ],
            extra: []
        }
    },

    // Il Mago dell'Oceano, primo santuario: il terreno Umi e i suoi mostri
    // (Acquatico, Pesce, Serpente Marino, Tuono).
    oceanMage: {
        flagship: 319, // Kairyu-Shin — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 319, qty: 2 }, // Kairyu-Shin
                { id: 592, qty: 2 }, // Soldato Pinguino
                { id: 907, qty: 3 }, // Sirena Incantatrice
                { id: 951, qty: 1 }, // Tongyo
                { id: 989, qty: 2 }, // Grongo Fulminante
                { id: 126, qty: 2 }, // Pinguino Fulmine
                { id: 926, qty: 2 }, // Acqua Radicale
                { id: 983, qty: 2 }, // Boneheimer
                { id: 966, qty: 2 }, // Doppia Lunga Verga #2
                { id: 703, qty: 1 }, // Pescatore Ispido
                { id: 582, qty: 1 }, // Tartaruga Isola
                { id: 497, qty: 1 }, // Umi
                { id: 79, qty: 1 }, // Un Oceano Leggendario
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 791, qty: 1 }, // Coro Acquatico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 704, qty: 1 }, // Salvataggio
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 319, qty: 2 }, // Kairyu-Shin
                { id: 940, qty: 2 }, // Abitante degli Abissi
                { id: 921, qty: 1 }, // Misairuzame
                { id: 279, qty: 2 }, // Grande Squalo Bianco
                { id: 703, qty: 2 }, // Pescatore Ispido
                { id: 951, qty: 1 }, // Tongyo
                { id: 907, qty: 2 }, // Sirena Incantatrice
                { id: 592, qty: 2 }, // Soldato Pinguino
                { id: 693, qty: 1 }, // Manta Perforante Strisciante
                { id: 321, qty: 1 }, // Kaiser Sea Horse
                { id: 583, qty: 1 }, // Pesce dai 7 Colori
                { id: 945, qty: 1 }, // Hyosube
                { id: 126, qty: 1 }, // Pinguino Fulmine
                { id: 989, qty: 1 }, // Grongo Fulminante
                { id: 497, qty: 1 }, // Umi
                { id: 79, qty: 1 }, // Un Oceano Leggendario
                { id: 871, qty: 1 }, // Terraformazione
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 503, qty: 1 }, // Waboku
                { id: 791, qty: 1 }, // Coro Acquatico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 704, qty: 1 }, // Salvataggio
                { id: 143, qty: 1 } // Mura del Castello
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 319, qty: 2 }, // Kairyu-Shin
                { id: 940, qty: 2 }, // Abitante degli Abissi
                { id: 921, qty: 2 }, // Misairuzame
                { id: 279, qty: 2 }, // Grande Squalo Bianco
                { id: 703, qty: 2 }, // Pescatore Ispido
                { id: 951, qty: 1 }, // Tongyo
                { id: 907, qty: 2 }, // Sirena Incantatrice
                { id: 592, qty: 2 }, // Soldato Pinguino
                { id: 693, qty: 1 }, // Manta Perforante Strisciante
                { id: 321, qty: 2 }, // Kaiser Sea Horse
                { id: 583, qty: 1 }, // Pesce dai 7 Colori
                { id: 126, qty: 1 }, // Pinguino Fulmine
                { id: 497, qty: 1 }, // Umi
                { id: 79, qty: 1 }, // Un Oceano Leggendario
                { id: 871, qty: 1 }, // Terraformazione
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 791, qty: 1 }, // Coro Acquatico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 704, qty: 1 }, // Salvataggio
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 928, qty: 1 } // Seadra Spinoso
            ],
            extra: []
        }
    },

    // L'Alto Mago Secmeton, santuario dell'Oceano: Umi al completo, con i mostri
    // d'acqua più grossi del Forbidden Memories.
    highMageSecmeton: {
        flagship: 91, // Bestia Anfibia — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 91, qty: 2 }, // Bestia Anfibia
                { id: 907, qty: 3 }, // Sirena Incantatrice
                { id: 250, qty: 2 }, // Pinguino Volante
                { id: 314, qty: 2 }, // Medusa
                { id: 582, qty: 2 }, // Tartaruga Isola
                { id: 904, qty: 2 }, // Stella Marina Corazzata
                { id: 926, qty: 2 }, // Acqua Radicale
                { id: 931, qty: 2 }, // Il Furioso Re del Mare
                { id: 703, qty: 1 }, // Pescatore Ispido
                { id: 321, qty: 1 }, // Kaiser Sea Horse
                { id: 1088, qty: 1 }, // Cavaliere Pinguino
                { id: 497, qty: 1 }, // Umi
                { id: 489, qty: 1 }, // Muro del Tornado
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 791, qty: 1 }, // Coro Acquatico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 704, qty: 1 }, // Salvataggio
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 91, qty: 2 }, // Bestia Anfibia
                { id: 319, qty: 1 }, // Kairyu-Shin
                { id: 940, qty: 2 }, // Abitante degli Abissi
                { id: 921, qty: 2 }, // Misairuzame
                { id: 702, qty: 1 }, // Mobius il Monarca del Gelo
                { id: 279, qty: 2 }, // Grande Squalo Bianco
                { id: 703, qty: 2 }, // Pescatore Ispido
                { id: 321, qty: 2 }, // Kaiser Sea Horse
                { id: 1103, qty: 1 }, // Spirito dell'Acqua
                { id: 701, qty: 1 }, // Cavaliere Sirena
                { id: 692, qty: 1 }, // Guerriero del Serpente Marino dell'Oscurità
                { id: 583, qty: 1 }, // Pesce dai 7 Colori
                { id: 907, qty: 1 }, // Sirena Incantatrice
                { id: 958, qty: 1 }, // Gyojin dell'Alta Marea
                { id: 497, qty: 1 }, // Umi
                { id: 79, qty: 1 }, // Un Oceano Leggendario
                { id: 871, qty: 1 }, // Terraformazione
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 489, qty: 1 }, // Muro del Tornado
                { id: 791, qty: 1 }, // Coro Acquatico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 704, qty: 1 }, // Salvataggio
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 91, qty: 2 }, // Bestia Anfibia
                { id: 319, qty: 2 }, // Kairyu-Shin
                { id: 940, qty: 2 }, // Abitante degli Abissi
                { id: 921, qty: 2 }, // Misairuzame
                { id: 702, qty: 2 }, // Mobius il Monarca del Gelo
                { id: 279, qty: 2 }, // Grande Squalo Bianco
                { id: 703, qty: 2 }, // Pescatore Ispido
                { id: 321, qty: 2 }, // Kaiser Sea Horse
                { id: 1103, qty: 1 }, // Spirito dell'Acqua
                { id: 701, qty: 1 }, // Cavaliere Sirena
                { id: 692, qty: 1 }, // Guerriero del Serpente Marino dell'Oscurità
                { id: 583, qty: 2 }, // Pesce dai 7 Colori
                { id: 497, qty: 1 }, // Umi
                { id: 79, qty: 1 }, // Un Oceano Leggendario
                { id: 871, qty: 1 }, // Terraformazione
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 489, qty: 1 }, // Muro del Tornado
                { id: 791, qty: 1 }, // Coro Acquatico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 382, qty: 1 } // Forza dello Specchio
            ],
            extra: []
        }
    },

    // Il Mago della Foresta: il terreno Foresta e i suoi mostri (Insetto, Bestia,
    // Pianta, Bestia-Guerriero). Prima era un mazzo Zombie, estraneo al suo santuario.
    forestMage: {
        flagship: 953, // L'Antico della Foresta Profonda — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 953, qty: 2 }, // L'Antico della Foresta Profonda
                { id: 368, qty: 3 }, // Pianta Mangiauomini
                { id: 105, qty: 3 }, // Insetto di Base
                { id: 444, qty: 2 }, // Zanna d'Argento
                { id: 280, qty: 2 }, // Griffore
                { id: 565, qty: 2 }, // Maestro e Allievo
                { id: 917, qty: 2 }, // Larvas
                { id: 923, qty: 2 }, // Pecora Mistica #2
                { id: 909, qty: 1 }, // Erbafuoco
                { id: 532, qty: 1 }, // Gazelle, Re delle Bestie Mitiche
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 313, qty: 1 }, // Rinvigorimento
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 875, qty: 1 }, // Libro della Luna
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 953, qty: 2 }, // L'Antico della Foresta Profonda
                { id: 952, qty: 1 }, // Trent
                { id: 347, qty: 2 }, // Leogun
                { id: 532, qty: 2 }, // Gazelle, Re delle Bestie Mitiche
                { id: 114, qty: 2 }, // Insetto Gigante
                { id: 248, qty: 2 }, // Kamakiri Volante #1
                { id: 280, qty: 2 }, // Griffore
                { id: 973, qty: 1 }, // Girochin Kuwagata
                { id: 574, qty: 1 }, // Bestia Pallida
                { id: 444, qty: 1 }, // Zanna d'Argento
                { id: 368, qty: 1 }, // Pianta Mangiauomini
                { id: 565, qty: 1 }, // Maestro e Allievo
                { id: 325, qty: 1 }, // Ago Killer
                { id: 996, qty: 1 }, // Lupo Portascure
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 503, qty: 1 }, // Waboku
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 309, qty: 1 }, // Armatura Insetto con Cannone Laser
                { id: 313, qty: 1 }, // Rinvigorimento
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 595, qty: 1 } // Il Guardiano Affidabile
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 953, qty: 2 }, // L'Antico della Foresta Profonda
                { id: 952, qty: 2 }, // Trent
                { id: 347, qty: 2 }, // Leogun
                { id: 532, qty: 2 }, // Gazelle, Re delle Bestie Mitiche
                { id: 114, qty: 2 }, // Insetto Gigante
                { id: 248, qty: 2 }, // Kamakiri Volante #1
                { id: 280, qty: 2 }, // Griffore
                { id: 973, qty: 2 }, // Girochin Kuwagata
                { id: 574, qty: 1 }, // Bestia Pallida
                { id: 444, qty: 1 }, // Zanna d'Argento
                { id: 325, qty: 1 }, // Ago Killer
                { id: 996, qty: 1 }, // Lupo Portascure
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 309, qty: 1 }, // Armatura Insetto con Cannone Laser
                { id: 313, qty: 1 }, // Rinvigorimento
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 985, qty: 1 }, // Imperatrice Mantide
                { id: 382, qty: 1 } // Forza dello Specchio
            ],
            extra: []
        }
    },

    // L'Alto Mago Anubisius, santuario della Foresta: nel gioco originale i suoi
    // assi sono la Grande Falena e la Falena Perfetta, portate al massimo dal terreno
    // Foresta, insieme agli altri Insetti e Bestie. Prima era un mazzo di Guardiani della
    // Tomba, che non gli appartiene.
    highMageAnubisius: {
        flagship: 1124, // Falena Perfetta — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 1124, qty: 1 }, // Falena Perfetta
                { id: 522, qty: 3 }, // Falena Piccola
                { id: 157, qty: 3 }, // Bozzolo dell'Evoluzione
                { id: 105, qty: 3 }, // Insetto di Base
                { id: 345, qty: 2 }, // Leghul
                { id: 915, qty: 2 }, // Kumootoko
                { id: 325, qty: 2 }, // Ago Killer
                { id: 156, qty: 2 }, // Cavaliere Scarafaggio
                { id: 114, qty: 1 }, // Insetto Gigante
                { id: 248, qty: 1 }, // Kamakiri Volante #1
                { id: 309, qty: 1 }, // Armatura Insetto con Cannone Laser
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 313, qty: 1 }, // Rinvigorimento
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 1124, qty: 1 }, // Falena Perfetta
                { id: 52, qty: 2 }, // Grande Falena
                { id: 522, qty: 2 }, // Falena Piccola
                { id: 157, qty: 2 }, // Bozzolo dell'Evoluzione
                { id: 50, qty: 1 }, // Larva Mostruosa
                { id: 985, qty: 1 }, // Imperatrice Mantide
                { id: 295, qty: 2 }, // Scarabeo Ercole
                { id: 973, qty: 1 }, // Girochin Kuwagata
                { id: 114, qty: 2 }, // Insetto Gigante
                { id: 248, qty: 2 }, // Kamakiri Volante #1
                { id: 953, qty: 1 }, // L'Antico della Foresta Profonda
                { id: 347, qty: 1 }, // Leogun
                { id: 323, qty: 1 }, // Kamakiriman
                { id: 270, qty: 1 }, // Gokibore
                { id: 309, qty: 1 }, // Armatura Insetto con Cannone Laser
                { id: 340, qty: 1 }, // Armatura Cannone Laser
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 503, qty: 1 }, // Waboku
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 313, qty: 1 }, // Rinvigorimento
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 595, qty: 1 } // Il Guardiano Affidabile
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 1124, qty: 1 }, // Falena Perfetta
                { id: 52, qty: 2 }, // Grande Falena
                { id: 522, qty: 2 }, // Falena Piccola
                { id: 157, qty: 2 }, // Bozzolo dell'Evoluzione
                { id: 50, qty: 1 }, // Larva Mostruosa
                { id: 985, qty: 2 }, // Imperatrice Mantide
                { id: 295, qty: 2 }, // Scarabeo Ercole
                { id: 973, qty: 1 }, // Girochin Kuwagata
                { id: 114, qty: 2 }, // Insetto Gigante
                { id: 248, qty: 2 }, // Kamakiri Volante #1
                { id: 953, qty: 2 }, // L'Antico della Foresta Profonda
                { id: 347, qty: 1 }, // Leogun
                { id: 309, qty: 1 }, // Armatura Insetto con Cannone Laser
                { id: 340, qty: 1 }, // Armatura Cannone Laser
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 313, qty: 1 }, // Rinvigorimento
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 23, qty: 1 }, // Insetto Divoratore
                { id: 382, qty: 1 } // Forza dello Specchio
            ],
            extra: []
        }
    },

    // Il Mago della Montagna: il terreno Montagna e i suoi mostri (Drago, Bestia
    // Alata, Tuono). Prima era un mazzo di Rocce, che sono del Deserto.
    mountainMage: {
        flagship: 400, // Drago Pappagallo — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 400, qty: 2 }, // Drago Pappagallo
                { id: 916, qty: 3 }, // Kurama
                { id: 946, qty: 3 }, // Megasfera di Tuono
                { id: 937, qty: 2 }, // Tyhone
                { id: 934, qty: 2 }, // Bestia a Filo Teso
                { id: 534, qty: 2 }, // Drago con Scudo
                { id: 181, qty: 2 }, // Pipistrello Oscuro
                { id: 948, qty: 2 }, // Niwatori
                { id: 331, qty: 1 }, // Drago Koumori
                { id: 939, qty: 1 }, // Corona dalle Ali Blu
                { id: 596, qty: 1 }, // Montagna
                { id: 871, qty: 1 }, // Terraformazione
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 400, qty: 2 }, // Drago Pappagallo
                { id: 629, qty: 1 }, // Drago Splendente #2
                { id: 964, qty: 2 }, // Uccello Regina
                { id: 939, qty: 2 }, // Corona dalle Ali Blu
                { id: 937, qty: 2 }, // Tyhone
                { id: 331, qty: 2 }, // Drago Koumori
                { id: 946, qty: 2 }, // Megasfera di Tuono
                { id: 934, qty: 1 }, // Bestia a Filo Teso
                { id: 118, qty: 1 }, // Drago di Fuoco delle Terre Nere
                { id: 572, qty: 1 }, // Uccello Rosso Teschio
                { id: 916, qty: 1 }, // Kurama
                { id: 585, qty: 1 }, // Esploratore del Cielo
                { id: 967, qty: 1 }, // Tyhone #2
                { id: 507, qty: 1 }, // Drago Alato, Guardiano della Fortezza #1
                { id: 596, qty: 1 }, // Montagna
                { id: 871, qty: 1 }, // Terraformazione
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 503, qty: 1 }, // Waboku
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 597, qty: 1 }, // Tesoro del Drago
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 212, qty: 1 } // Furia del Drago
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 400, qty: 2 }, // Drago Pappagallo
                { id: 629, qty: 2 }, // Drago Splendente #2
                { id: 964, qty: 2 }, // Uccello Regina
                { id: 939, qty: 2 }, // Corona dalle Ali Blu
                { id: 937, qty: 2 }, // Tyhone
                { id: 331, qty: 2 }, // Drago Koumori
                { id: 946, qty: 1 }, // Megasfera di Tuono
                { id: 934, qty: 1 }, // Bestia a Filo Teso
                { id: 118, qty: 1 }, // Drago di Fuoco delle Terre Nere
                { id: 572, qty: 1 }, // Uccello Rosso Teschio
                { id: 585, qty: 2 }, // Esploratore del Cielo
                { id: 967, qty: 1 }, // Tyhone #2
                { id: 507, qty: 1 }, // Drago Alato, Guardiano della Fortezza #1
                { id: 596, qty: 1 }, // Montagna
                { id: 871, qty: 1 }, // Terraformazione
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 597, qty: 1 }, // Tesoro del Drago
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 212, qty: 1 }, // Furia del Drago
                { id: 785, qty: 1 }, // Joe l'Uomo Uccello Veloce
                { id: 382, qty: 1 } // Forza dello Specchio
            ],
            extra: []
        }
    },

    // L'Alto Mago Atenza, santuario della Montagna: Draghi pesanti — Drago
    // Tricorno, Drago Nero Occhi Rossi con il Drago Meteora per il Drago Nero Meteora — e
    // Bestie Alate.
    highMageAtenza: {
        flagship: 932, // Drago Tricorno — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 932, qty: 1 }, // Drago Tricorno
                { id: 937, qty: 3 }, // Tyhone
                { id: 534, qty: 2 }, // Drago con Scudo
                { id: 1050, qty: 2 }, // Drago della Truppa
                { id: 993, qty: 2 }, // Soldato Lucertola
                { id: 946, qty: 2 }, // Megasfera di Tuono
                { id: 916, qty: 2 }, // Kurama
                { id: 404, qty: 2 }, // Drago Nero Pece
                { id: 331, qty: 1 }, // Drago Koumori
                { id: 507, qty: 1 }, // Drago Alato, Guardiano della Fortezza #1
                { id: 198, qty: 1 }, // Drago della Dimensione Diversa
                { id: 27, qty: 1 }, // Cucciolo di Drago
                { id: 596, qty: 1 }, // Montagna
                { id: 871, qty: 1 }, // Terraformazione
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 597, qty: 1 }, // Tesoro del Drago
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 932, qty: 1 }, // Drago Tricorno
                { id: 12, qty: 2 }, // Drago Nero Occhi Rossi
                { id: 629, qty: 1 }, // Drago Splendente #2
                { id: 400, qty: 2 }, // Drago Pappagallo
                { id: 785, qty: 1 }, // Joe l'Uomo Uccello Veloce
                { id: 939, qty: 2 }, // Corona dalle Ali Blu
                { id: 331, qty: 2 }, // Drago Koumori
                { id: 585, qty: 1 }, // Esploratore del Cielo
                { id: 572, qty: 2 }, // Uccello Rosso Teschio
                { id: 198, qty: 1 }, // Drago della Dimensione Diversa
                { id: 937, qty: 2 }, // Tyhone
                { id: 507, qty: 1 }, // Drago Alato, Guardiano della Fortezza #1
                { id: 1125, qty: 1 }, // Drago Meteora
                { id: 946, qty: 1 }, // Megasfera di Tuono
                { id: 596, qty: 1 }, // Montagna
                { id: 871, qty: 1 }, // Terraformazione
                { id: 80, qty: 1 }, // Un Battito d'Ali del Drago Gigante
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 597, qty: 1 }, // Tesoro del Drago
                { id: 212, qty: 1 }, // Furia del Drago
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 38, qty: 1 } // Fusione
            ],
            extra: [
                { id: 1126, qty: 1 } // Drago Nero Meteora
            ]
        },
        hard: {
            main: [
                { id: 932, qty: 1 }, // Drago Tricorno
                { id: 12, qty: 2 }, // Drago Nero Occhi Rossi
                { id: 629, qty: 2 }, // Drago Splendente #2
                { id: 400, qty: 2 }, // Drago Pappagallo
                { id: 785, qty: 1 }, // Joe l'Uomo Uccello Veloce
                { id: 939, qty: 2 }, // Corona dalle Ali Blu
                { id: 331, qty: 2 }, // Drago Koumori
                { id: 585, qty: 1 }, // Esploratore del Cielo
                { id: 572, qty: 2 }, // Uccello Rosso Teschio
                { id: 198, qty: 1 }, // Drago della Dimensione Diversa
                { id: 937, qty: 1 }, // Tyhone
                { id: 507, qty: 1 }, // Drago Alato, Guardiano della Fortezza #1
                { id: 1125, qty: 1 }, // Drago Meteora
                { id: 596, qty: 1 }, // Montagna
                { id: 871, qty: 1 }, // Terraformazione
                { id: 80, qty: 1 }, // Un Battito d'Ali del Drago Gigante
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 597, qty: 1 }, // Tesoro del Drago
                { id: 212, qty: 1 }, // Furia del Drago
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 38, qty: 1 }, // Fusione
                { id: 1, qty: 1 }, // Drago Bianco Occhi Blu
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 37, qty: 1 } // Folgore Fulminante
            ],
            extra: [
                { id: 1126, qty: 1 } // Drago Nero Meteora
            ]
        }
    },

    // Il Mago del Deserto: il terreno delle Terre Desolate e i suoi mostri
    // (Zombie, Dinosauro, Roccia) — mummie, spiriti della polvere, rocce. Prima era un mazzo
    // di Bestie Alate, che sono della Montagna.
    desertMage: {
        flagship: 659, // Spirito della Polvere Oscura — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 659, qty: 2 }, // Spirito della Polvere Oscura
                { id: 1052, qty: 3 }, // Des Lacooda
                { id: 1020, qty: 3 }, // Mummia Velenosa
                { id: 660, qty: 2 }, // Tartaruga della Piramide
                { id: 491, qty: 2 }, // Trakodon
                { id: 936, qty: 2 }, // Sovrano Oscuro Bibocca
                { id: 990, qty: 2 }, // Dama Sferica
                { id: 905, qty: 2 }, // Roccia Dissolvente
                { id: 1110, qty: 1 }, // Mummia Errante
                { id: 1090, qty: 1 }, // Guardiano Reale
                { id: 670, qty: 1 }, // Richiamo della Mummia
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 769, qty: 1 }, // Ombre Mutevoli
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 659, qty: 2 }, // Spirito della Polvere Oscura
                { id: 1071, qty: 2 }, // Mummia dall'Ascia Gigante
                { id: 1110, qty: 2 }, // Mummia Errante
                { id: 1090, qty: 2 }, // Guardiano Reale
                { id: 1052, qty: 2 }, // Des Lacooda
                { id: 927, qty: 1 }, // Pietra di Sabbia
                { id: 571, qty: 2 }, // Golem Distruttore
                { id: 561, qty: 2 }, // Uraby
                { id: 491, qty: 1 }, // Trakodon
                { id: 1020, qty: 1 }, // Mummia Velenosa
                { id: 660, qty: 1 }, // Tartaruga della Piramide
                { id: 211, qty: 1 }, // Drago Zombie
                { id: 936, qty: 1 }, // Sovrano Oscuro Bibocca
                { id: 670, qty: 1 }, // Richiamo della Mummia
                { id: 669, qty: 1 }, // Libro della Vita
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 503, qty: 1 }, // Waboku
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 769, qty: 1 }, // Ombre Mutevoli
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 136, qty: 1 } // Richiamo degli Infestati
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 659, qty: 2 }, // Spirito della Polvere Oscura
                { id: 1071, qty: 3 }, // Mummia dall'Ascia Gigante
                { id: 1110, qty: 2 }, // Mummia Errante
                { id: 1090, qty: 2 }, // Guardiano Reale
                { id: 1052, qty: 1 }, // Des Lacooda
                { id: 927, qty: 1 }, // Pietra di Sabbia
                { id: 571, qty: 2 }, // Golem Distruttore
                { id: 561, qty: 2 }, // Uraby
                { id: 491, qty: 1 }, // Trakodon
                { id: 660, qty: 1 }, // Tartaruga della Piramide
                { id: 211, qty: 1 }, // Drago Zombie
                { id: 936, qty: 1 }, // Sovrano Oscuro Bibocca
                { id: 670, qty: 1 }, // Richiamo della Mummia
                { id: 669, qty: 1 }, // Libro della Vita
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 769, qty: 1 }, // Ombre Mutevoli
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 136, qty: 1 }, // Richiamo degli Infestati
                { id: 799, qty: 1 }, // Driceratopo Oscuro
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 374, qty: 1 } // Megazowler
            ],
            extra: []
        }
    },

    // L'Alto Mago Martis, santuario del Deserto: Zombie e Dinosauri pesanti — la
    // Disperazione dall'Oscurità, Ryu Kokki, le mummie. Prima era un mazzo di Macchine (con
    // due fusioni infilate per errore nel mazzo principale).
    highMageMartis: {
        flagship: 662, // Disperazione dall'Oscurità — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 662, qty: 1 }, // Disperazione dall'Oscurità
                { id: 1052, qty: 3 }, // Des Lacooda
                { id: 1020, qty: 3 }, // Mummia Velenosa
                { id: 660, qty: 2 }, // Tartaruga della Piramide
                { id: 491, qty: 2 }, // Trakodon
                { id: 990, qty: 2 }, // Dama Sferica
                { id: 905, qty: 2 }, // Roccia Dissolvente
                { id: 1106, qty: 2 }, // Vampire Baby
                { id: 1053, qty: 1 }, // Cavallo dell'Incubo
                { id: 1110, qty: 1 }, // Mummia Errante
                { id: 1090, qty: 1 }, // Guardiano Reale
                { id: 670, qty: 1 }, // Richiamo della Mummia
                { id: 669, qty: 1 }, // Libro della Vita
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 662, qty: 1 }, // Disperazione dall'Oscurità
                { id: 663, qty: 2 }, // Ryu Kokki
                { id: 659, qty: 1 }, // Spirito della Polvere Oscura
                { id: 799, qty: 1 }, // Driceratopo Oscuro
                { id: 374, qty: 1 }, // Megazowler
                { id: 1071, qty: 2 }, // Mummia dall'Ascia Gigante
                { id: 1090, qty: 2 }, // Guardiano Reale
                { id: 1110, qty: 2 }, // Mummia Errante
                { id: 571, qty: 2 }, // Golem Distruttore
                { id: 757, qty: 1 }, // Gigantes
                { id: 561, qty: 2 }, // Uraby
                { id: 666, qty: 1 }, // Doppio Coston
                { id: 667, qty: 1 }, // Mummia Rigenerante
                { id: 1052, qty: 1 }, // Des Lacooda
                { id: 670, qty: 1 }, // Richiamo della Mummia
                { id: 669, qty: 1 }, // Libro della Vita
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 503, qty: 1 }, // Waboku
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 136, qty: 1 }, // Richiamo degli Infestati
                { id: 769, qty: 1 }, // Ombre Mutevoli
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 478, qty: 1 } // Macchina del Tempo
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 662, qty: 1 }, // Disperazione dall'Oscurità
                { id: 663, qty: 2 }, // Ryu Kokki
                { id: 659, qty: 1 }, // Spirito della Polvere Oscura
                { id: 799, qty: 2 }, // Driceratopo Oscuro
                { id: 374, qty: 1 }, // Megazowler
                { id: 1071, qty: 2 }, // Mummia dall'Ascia Gigante
                { id: 1090, qty: 2 }, // Guardiano Reale
                { id: 1110, qty: 2 }, // Mummia Errante
                { id: 571, qty: 2 }, // Golem Distruttore
                { id: 757, qty: 1 }, // Gigantes
                { id: 561, qty: 2 }, // Uraby
                { id: 666, qty: 1 }, // Doppio Coston
                { id: 670, qty: 1 }, // Richiamo della Mummia
                { id: 669, qty: 1 }, // Libro della Vita
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 503, qty: 1 }, // Waboku
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 136, qty: 1 }, // Richiamo degli Infestati
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 478, qty: 1 }, // Macchina del Tempo
                { id: 801, qty: 1 }, // Tiranno Nero
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 419, qty: 1 } // Anello della Distruzione
            ],
            extra: []
        }
    },

    // Il Mago della Prateria: il terreno Sogen e i suoi Guerrieri e
    // Bestie-Guerriero; nel gioco originale è anche quello che lascia cadere Gaia il
    // Cavaliere Feroce, la Maledizione del Drago e il Mago Nero. Prima era un mazzo di Fate.
    meadowMage: {
        flagship: 14, // Gaia il Cavaliere Feroce — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 14, qty: 2 }, // Gaia il Cavaliere Feroce
                { id: 109, qty: 3 }, // Castoro Guerriero
                { id: 298, qty: 3 }, // Gigante Un Occhio
                { id: 477, qty: 2 }, // Ascia Tigre
                { id: 573, qty: 2 }, // D. Human
                { id: 108, qty: 2 }, // Guerriero da Battaglia
                { id: 97, qty: 2 }, // Armaill
                { id: 296, qty: 2 }, // Eroe dell'Est
                { id: 330, qty: 1 }, // Kojikocy
                { id: 944, qty: 1 }, // Hibikime
                { id: 580, qty: 1 }, // Sogen
                { id: 871, qty: 1 }, // Terraformazione
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 14, qty: 2 }, // Gaia il Cavaliere Feroce
                { id: 15, qty: 2 }, // Maledizione del Drago
                { id: 2, qty: 1 }, // Mago Nero
                { id: 256, qty: 2 }, // Garoozis
                { id: 106, qty: 2 }, // Bue da Battaglia
                { id: 477, qty: 2 }, // Ascia Tigre
                { id: 330, qty: 2 }, // Kojikocy
                { id: 996, qty: 2 }, // Lupo Portascure
                { id: 573, qty: 2 }, // D. Human
                { id: 109, qty: 1 }, // Castoro Guerriero
                { id: 298, qty: 1 }, // Gigante Un Occhio
                { id: 944, qty: 1 }, // Hibikime
                { id: 580, qty: 1 }, // Sogen
                { id: 871, qty: 1 }, // Terraformazione
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 503, qty: 1 }, // Waboku
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 38, qty: 1 }, // Fusione
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: [
                { id: 254, qty: 1 } // Gaia il Campione dei Draghi
            ]
        },
        hard: {
            main: [
                { id: 14, qty: 2 }, // Gaia il Cavaliere Feroce
                { id: 15, qty: 2 }, // Maledizione del Drago
                { id: 2, qty: 2 }, // Mago Nero
                { id: 256, qty: 2 }, // Garoozis
                { id: 106, qty: 2 }, // Bue da Battaglia
                { id: 477, qty: 2 }, // Ascia Tigre
                { id: 330, qty: 2 }, // Kojikocy
                { id: 996, qty: 2 }, // Lupo Portascure
                { id: 573, qty: 2 }, // D. Human
                { id: 944, qty: 1 }, // Hibikime
                { id: 580, qty: 1 }, // Sogen
                { id: 871, qty: 1 }, // Terraformazione
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 38, qty: 1 }, // Fusione
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 107, qty: 1 }, // Toro da Battaglia
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 427, qty: 1 } // Rude Kaiser
            ],
            extra: [
                { id: 254, qty: 1 } // Gaia il Campione dei Draghi
            ]
        }
    },

    // L'Alto Mago Kepura, santuario della Prateria: nel gioco originale il suo
    // asso è il Guardiano del Cancello, con molti Draghi (Gaia, Maledizione del Drago, Drago
    // Meteora) e i Guerrieri del terreno Sogen. Prima era un mazzo di Fate.
    highMageKepura: {
        flagship: 33, // Il Guardiano del Cancello — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 33, qty: 1 }, // Il Guardiano del Cancello
                { id: 538, qty: 1 }, // Sanga del Tuono
                { id: 324, qty: 1 }, // Kazejin
                { id: 71, qty: 1 }, // Suijin
                { id: 109, qty: 3 }, // Castoro Guerriero
                { id: 298, qty: 3 }, // Gigante Un Occhio
                { id: 108, qty: 2 }, // Guerriero da Battaglia
                { id: 97, qty: 2 }, // Armaill
                { id: 296, qty: 2 }, // Eroe dell'Est
                { id: 573, qty: 2 }, // D. Human
                { id: 477, qty: 1 }, // Ascia Tigre
                { id: 330, qty: 1 }, // Kojikocy
                { id: 944, qty: 1 }, // Hibikime
                { id: 580, qty: 1 }, // Sogen
                { id: 871, qty: 1 }, // Terraformazione
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 } // Dian Keto la Maestra delle Cure
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 33, qty: 1 }, // Il Guardiano del Cancello
                { id: 538, qty: 1 }, // Sanga del Tuono
                { id: 324, qty: 1 }, // Kazejin
                { id: 71, qty: 1 }, // Suijin
                { id: 14, qty: 2 }, // Gaia il Cavaliere Feroce
                { id: 15, qty: 2 }, // Maledizione del Drago
                { id: 1125, qty: 1 }, // Drago Meteora
                { id: 996, qty: 2 }, // Lupo Portascure
                { id: 330, qty: 2 }, // Kojikocy
                { id: 106, qty: 2 }, // Bue da Battaglia
                { id: 477, qty: 1 }, // Ascia Tigre
                { id: 109, qty: 1 }, // Castoro Guerriero
                { id: 573, qty: 1 }, // D. Human
                { id: 944, qty: 1 }, // Hibikime
                { id: 298, qty: 1 }, // Gigante Un Occhio
                { id: 580, qty: 1 }, // Sogen
                { id: 871, qty: 1 }, // Terraformazione
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 38, qty: 1 }, // Fusione
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 503, qty: 1 } // Waboku
            ],
            extra: [
                { id: 254, qty: 1 } // Gaia il Campione dei Draghi
            ]
        },
        hard: {
            main: [
                { id: 33, qty: 1 }, // Il Guardiano del Cancello
                { id: 538, qty: 1 }, // Sanga del Tuono
                { id: 324, qty: 1 }, // Kazejin
                { id: 71, qty: 1 }, // Suijin
                { id: 14, qty: 2 }, // Gaia il Cavaliere Feroce
                { id: 15, qty: 2 }, // Maledizione del Drago
                { id: 1125, qty: 1 }, // Drago Meteora
                { id: 996, qty: 2 }, // Lupo Portascure
                { id: 330, qty: 2 }, // Kojikocy
                { id: 106, qty: 2 }, // Bue da Battaglia
                { id: 477, qty: 1 }, // Ascia Tigre
                { id: 573, qty: 1 }, // D. Human
                { id: 944, qty: 1 }, // Hibikime
                { id: 580, qty: 1 }, // Sogen
                { id: 871, qty: 1 }, // Terraformazione
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 38, qty: 1 }, // Fusione
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 2, qty: 1 }, // Mago Nero
                { id: 12, qty: 1 }, // Drago Nero Occhi Rossi
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 37, qty: 1 } // Folgore Fulminante
            ],
            extra: [
                { id: 254, qty: 1 }, // Gaia il Campione dei Draghi
                { id: 1126, qty: 1 } // Drago Nero Meteora
            ]
        }
    },

    // Il Mago del Labirinto: il Muro del Labirinto con il Labirinto Magico per il
    // Wall Shadow, Guardia del Labirinto e Protettrice del Trono, e gli Incantatori delle
    // tenebre sotto Yami.
    labyrinthMage: {
        flagship: 857, // Wall Shadow — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 857, qty: 1 }, // Wall Shadow
                { id: 535, qty: 3 }, // Guardia del Labirinto
                { id: 536, qty: 3 }, // Protettrice del Trono
                { id: 737, qty: 2 }, // Mago Apprendista
                { id: 1111, qty: 2 }, // Apprendista Strega
                { id: 194, qty: 2 }, // Illusionista dagli Occhi Oscuri
                { id: 924, qty: 2 }, // Nemuriko
                { id: 169, qty: 2 }, // Tenda degli Oscuri
                { id: 337, qty: 1 }, // Muro del Labirinto
                { id: 346, qty: 1 }, // Legion il Giullare Demoniaco
                { id: 550, qty: 1 }, // Il Mistico Severo
                { id: 364, qty: 1 }, // Labirinto Magico
                { id: 557, qty: 1 }, // Yami
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 363, qty: 1 }, // Cappelli Magici
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 } // Dian Keto la Maestra delle Cure
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 857, qty: 1 }, // Wall Shadow
                { id: 337, qty: 2 }, // Muro del Labirinto
                { id: 535, qty: 2 }, // Guardia del Labirinto
                { id: 536, qty: 2 }, // Protettrice del Trono
                { id: 306, qty: 1 }, // Mago Senza Volto Illusionista
                { id: 736, qty: 2 }, // Abile Mago Oscuro
                { id: 740, qty: 1 }, // Stregone del Caos
                { id: 188, qty: 1 }, // Maga Oscura
                { id: 346, qty: 2 }, // Legion il Giullare Demoniaco
                { id: 737, qty: 2 }, // Mago Apprendista
                { id: 550, qty: 1 }, // Il Mistico Severo
                { id: 194, qty: 1 }, // Illusionista dagli Occhi Oscuri
                { id: 353, qty: 1 }, // Signore dei D.
                { id: 1127, qty: 1 }, // Campanella Cerimoniale
                { id: 364, qty: 1 }, // Labirinto Magico
                { id: 557, qty: 1 }, // Yami
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 503, qty: 1 }, // Waboku
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 363, qty: 1 } // Cappelli Magici
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 857, qty: 1 }, // Wall Shadow
                { id: 337, qty: 2 }, // Muro del Labirinto
                { id: 535, qty: 2 }, // Guardia del Labirinto
                { id: 536, qty: 2 }, // Protettrice del Trono
                { id: 306, qty: 1 }, // Mago Senza Volto Illusionista
                { id: 736, qty: 2 }, // Abile Mago Oscuro
                { id: 740, qty: 1 }, // Stregone del Caos
                { id: 188, qty: 1 }, // Maga Oscura
                { id: 346, qty: 2 }, // Legion il Giullare Demoniaco
                { id: 737, qty: 2 }, // Mago Apprendista
                { id: 550, qty: 1 }, // Il Mistico Severo
                { id: 194, qty: 1 }, // Illusionista dagli Occhi Oscuri
                { id: 364, qty: 2 }, // Labirinto Magico
                { id: 557, qty: 1 }, // Yami
                { id: 127, qty: 1 }, // Libro delle Arti Segrete
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 363, qty: 1 }, // Cappelli Magici
                { id: 2, qty: 1 }, // Mago Nero
                { id: 738, qty: 1 }, // Mago Comando del Caos
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 448, qty: 1 } // Giudizio Solenne
            ],
            extra: []
        }
    },

    // Il Guardiano Sebek, dal nome del dio coccodrillo: Rettili e Dinosauri — il
    // Guardiano Grarl con la sua Ascia di Gravità, Krokodilus, i guerrieri lucertola — e la
    // Benedizione di Sebek.
    sebek: {
        flagship: 284, // Guardiano Grarl — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 284, qty: 2 }, // Guardiano Grarl
                { id: 332, qty: 3 }, // Krokodilus
                { id: 906, qty: 3 }, // Lucertola Sbavante
                { id: 1117, qty: 2 }, // Cobraman Sakuzy
                { id: 1030, qty: 2 }, // Barattolo Cobra
                { id: 809, qty: 2 }, // Bebè Cerasauro
                { id: 491, qty: 2 }, // Trakodon
                { id: 806, qty: 2 }, // Stego Nero
                { id: 98, qty: 1 }, // Lucertola Corazzata
                { id: 938, qty: 1 }, // Antico Guerriero Lucertola
                { id: 277, qty: 2 }, // Ascia di Gravità - Grarl
                { id: 813, qty: 1 }, // Benedizione di Sebek
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 284, qty: 2 }, // Guardiano Grarl
                { id: 332, qty: 2 }, // Krokodilus
                { id: 98, qty: 2 }, // Lucertola Corazzata
                { id: 938, qty: 2 }, // Antico Guerriero Lucertola
                { id: 1117, qty: 1 }, // Cobraman Sakuzy
                { id: 1030, qty: 1 }, // Barattolo Cobra
                { id: 495, qty: 2 }, // Re Rex a Due Teste
                { id: 799, qty: 1 }, // Driceratopo Oscuro
                { id: 801, qty: 1 }, // Tiranno Nero
                { id: 798, qty: 2 }, // Sabersaurus
                { id: 803, qty: 1 }, // Idrogeddon
                { id: 561, qty: 1 }, // Uraby
                { id: 266, qty: 1 }, // Gilasaurus
                { id: 185, qty: 1 }, // Folletto Oscuro
                { id: 277, qty: 2 }, // Ascia di Gravità - Grarl
                { id: 812, qty: 1 }, // Mondo Giurassico
                { id: 813, qty: 1 }, // Benedizione di Sebek
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 816, qty: 1 }, // Istinto di Sopravvivenza
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 284, qty: 2 }, // Guardiano Grarl
                { id: 332, qty: 2 }, // Krokodilus
                { id: 98, qty: 2 }, // Lucertola Corazzata
                { id: 938, qty: 2 }, // Antico Guerriero Lucertola
                { id: 495, qty: 2 }, // Re Rex a Due Teste
                { id: 799, qty: 2 }, // Driceratopo Oscuro
                { id: 801, qty: 2 }, // Tiranno Nero
                { id: 798, qty: 2 }, // Sabersaurus
                { id: 803, qty: 1 }, // Idrogeddon
                { id: 561, qty: 1 }, // Uraby
                { id: 266, qty: 1 }, // Gilasaurus
                { id: 185, qty: 1 }, // Folletto Oscuro
                { id: 277, qty: 2 }, // Ascia di Gravità - Grarl
                { id: 812, qty: 1 }, // Mondo Giurassico
                { id: 813, qty: 1 }, // Benedizione di Sebek
                { id: 848, qty: 1 }, // Vaso dell'Avarizia
                { id: 635, qty: 1 }, // Vaso dell'Ingordigia
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 7, qty: 1 }, // Buco Nero
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 818, qty: 1 } // Onda Sismica
            ],
            extra: []
        }
    },

    // Il Guardiano Neku: Guerrieri pesanti — il Soldato del Fulgore Nero
    // (rituale), Gearfried e il suo Maestro di Spada, Freed, gli Spadaccini Mistici, Lama
    // Oscura — con Sogen e le Forze A.
    neku: {
        flagship: 616, // Soldato del Fulgore Nero — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 616, qty: 1 }, // Soldato del Fulgore Nero
                { id: 710, qty: 3 }, // Guerriera delle Terre Desolate
                { id: 714, qty: 3 }, // Capitano Predone
                { id: 369, qty: 2 }, // Masaki lo Spadaccino Leggendario
                { id: 318, qty: 2 }, // Kagemusha della Fiamma Blu
                { id: 296, qty: 2 }, // Eroe dell'Est
                { id: 108, qty: 2 }, // Guerriero da Battaglia
                { id: 912, qty: 2 }, // Armatura Dura
                { id: 535, qty: 1 }, // Guardia del Labirinto
                { id: 713, qty: 1 }, // Cavaliere Comandante
                { id: 504, qty: 1 }, // Guerriero Dai Grepher
                { id: 617, qty: 1 }, // Rito del Fulgore Nero
                { id: 580, qty: 1 }, // Sogen
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 616, qty: 1 }, // Soldato del Fulgore Nero
                { id: 888, qty: 1 }, // Freed il Generale Senza Rivali
                { id: 613, qty: 2 }, // Lama Oscura
                { id: 16, qty: 2 }, // Gearfried il Cavaliere di Ferro
                { id: 258, qty: 1 }, // Gearfried il Maestro di Spada
                { id: 6, qty: 1 }, // Cavaliere Oscuro
                { id: 718, qty: 1 }, // Spadaccino Mistico LV2
                { id: 719, qty: 1 }, // Spadaccino Mistico LV4
                { id: 865, qty: 1 }, // Spadaccino Mistico LV6
                { id: 504, qty: 3 }, // Guerriero Dai Grepher
                { id: 713, qty: 1 }, // Cavaliere Comandante
                { id: 639, qty: 2 }, // Drago Splendente
                { id: 855, qty: 1 }, // Paladino del Drago Oscuro
                { id: 710, qty: 1 }, // Guerriera delle Terre Desolate
                { id: 714, qty: 1 }, // Capitano Predone
                { id: 617, qty: 1 }, // Rito del Fulgore Nero
                { id: 415, qty: 1 }, // Vincoli Recisi
                { id: 580, qty: 1 }, // Sogen
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 724, qty: 1 }, // Rinforzo dell'Esercito
                { id: 725, qty: 1 }, // Il Guerriero Ritorna in Vita
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 465, qty: 1 }, // Le Forze A.
                { id: 503, qty: 1 } // Waboku
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 616, qty: 1 }, // Soldato del Fulgore Nero
                { id: 888, qty: 1 }, // Freed il Generale Senza Rivali
                { id: 613, qty: 2 }, // Lama Oscura
                { id: 16, qty: 2 }, // Gearfried il Cavaliere di Ferro
                { id: 258, qty: 1 }, // Gearfried il Maestro di Spada
                { id: 6, qty: 2 }, // Cavaliere Oscuro
                { id: 718, qty: 2 }, // Spadaccino Mistico LV2
                { id: 719, qty: 1 }, // Spadaccino Mistico LV4
                { id: 865, qty: 1 }, // Spadaccino Mistico LV6
                { id: 504, qty: 3 }, // Guerriero Dai Grepher
                { id: 713, qty: 1 }, // Cavaliere Comandante
                { id: 639, qty: 2 }, // Drago Splendente
                { id: 855, qty: 1 }, // Paladino del Drago Oscuro
                { id: 617, qty: 1 }, // Rito del Fulgore Nero
                { id: 415, qty: 1 }, // Vincoli Recisi
                { id: 580, qty: 1 }, // Sogen
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 724, qty: 1 }, // Rinforzo dell'Esercito
                { id: 725, qty: 1 }, // Il Guerriero Ritorna in Vita
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 465, qty: 1 }, // Le Forze A.
                { id: 267, qty: 1 }, // Gilford il Fulmine
                { id: 382, qty: 1 } // Forza dello Specchio
            ],
            extra: []
        }
    },

    // Heishin, il gran sacerdote traditore, con la Verga del Millennio: Demoni e
    // potenza oscura — Teschio Evocato con il Drago Nero Occhi Rossi per il Drago Nero del
    // Teschio, Zoa e Metalzoa, Zera il Mant — e il Controllo Mentale della Verga.
    heishin: {
        flagship: 13, // Teschio Evocato — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 13, qty: 2 }, // Teschio Evocato
                { id: 25, qty: 3 }, // Ryu Kishin
                { id: 237, qty: 2 }, // Folletto Selvaggio Feroce
                { id: 94, qty: 2 }, // Lampada Antica
                { id: 355, qty: 2 }, // Signore di Zemia
                { id: 334, qty: 2 }, // Kuribandit
                { id: 564, qty: 2 }, // Titano Oscuro del Terrore
                { id: 914, qty: 2 }, // Re della Nebbia
                { id: 299, qty: 1 }, // Diavoletto Cornuto
                { id: 428, qty: 1 }, // Ryu-Kishin Potenziato
                { id: 542, qty: 1 }, // Fantasma Arguto
                { id: 557, qty: 1 }, // Yami
                { id: 130, qty: 1 }, // Controllo Mentale
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 875, qty: 1 }, // Libro della Luna
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 13, qty: 2 }, // Teschio Evocato
                { id: 12, qty: 1 }, // Drago Nero Occhi Rossi
                { id: 520, qty: 1 }, // Zoa
                { id: 518, qty: 1 }, // Zera il Mant
                { id: 237, qty: 2 }, // Folletto Selvaggio Feroce
                { id: 428, qty: 2 }, // Ryu-Kishin Potenziato
                { id: 502, qty: 2 }, // Predone Vorse
                { id: 327, qty: 1 }, // Re di Yamimakai
                { id: 6, qty: 1 }, // Cavaliere Oscuro
                { id: 335, qty: 2 }, // La Jinn il Genio Mistico della Lampada
                { id: 94, qty: 1 }, // Lampada Antica
                { id: 355, qty: 1 }, // Signore di Zemia
                { id: 627, qty: 1 }, // Opticlops
                { id: 182, qty: 1 }, // Chimera Oscura
                { id: 334, qty: 1 }, // Kuribandit
                { id: 517, qty: 1 }, // Rituale di Zera
                { id: 38, qty: 1 }, // Fusione
                { id: 557, qty: 1 }, // Yami
                { id: 619, qty: 1 }, // Zona Plasma Mistica
                { id: 130, qty: 1 }, // Controllo Mentale
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 376, qty: 1 } // Metalmorfosi
            ],
            extra: [
                { id: 102, qty: 1 } // Drago Nero del Teschio
            ]
        },
        hard: {
            main: [
                { id: 13, qty: 2 }, // Teschio Evocato
                { id: 12, qty: 2 }, // Drago Nero Occhi Rossi
                { id: 520, qty: 1 }, // Zoa
                { id: 518, qty: 1 }, // Zera il Mant
                { id: 237, qty: 2 }, // Folletto Selvaggio Feroce
                { id: 428, qty: 2 }, // Ryu-Kishin Potenziato
                { id: 502, qty: 2 }, // Predone Vorse
                { id: 327, qty: 1 }, // Re di Yamimakai
                { id: 6, qty: 1 }, // Cavaliere Oscuro
                { id: 335, qty: 2 }, // La Jinn il Genio Mistico della Lampada
                { id: 355, qty: 1 }, // Signore di Zemia
                { id: 627, qty: 1 }, // Opticlops
                { id: 182, qty: 1 }, // Chimera Oscura
                { id: 517, qty: 1 }, // Rituale di Zera
                { id: 38, qty: 1 }, // Fusione
                { id: 557, qty: 1 }, // Yami
                { id: 619, qty: 1 }, // Zona Plasma Mistica
                { id: 130, qty: 1 }, // Controllo Mentale
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 376, qty: 1 }, // Metalmorfosi
                { id: 377, qty: 1 }, // Metalzoa
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 17, qty: 1 } // Jinzo
            ],
            extra: [
                { id: 102, qty: 1 } // Drago Nero del Teschio
            ]
        }
    },

    // DarkNite, l'ultimo avversario di Forbidden Memories: Draghi e Demoni del
    // potere più alto — il Drago Berserk evocato col Patto col Sovrano Oscuro, Drago Nero
    // Occhi Rossi e Drago Meteora per il Drago Nero Meteora, Drago Tricorno, Teschio Evocato,
    // Zera il Mant.
    darkNite: {
        flagship: 110, // Drago Berserk — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 110, qty: 2 }, // Drago Berserk
                { id: 932, qty: 1 }, // Drago Tricorno
                { id: 534, qty: 3 }, // Drago con Scudo
                { id: 1050, qty: 2 }, // Drago della Truppa
                { id: 993, qty: 2 }, // Soldato Lucertola
                { id: 404, qty: 2 }, // Drago Nero Pece
                { id: 642, qty: 2 }, // Cucciolo del Drago Nero
                { id: 25, qty: 2 }, // Ryu Kishin
                { id: 181, qty: 2 }, // Pipistrello Oscuro
                { id: 493, qty: 1 }, // Behemoth a Due Teste
                { id: 331, qty: 1 }, // Drago Koumori
                { id: 78, qty: 1 }, // Patto col Sovrano Oscuro
                { id: 251, qty: 1 }, // Sepoltura Sciocca
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 110, qty: 2 }, // Drago Berserk
                { id: 12, qty: 2 }, // Drago Nero Occhi Rossi
                { id: 1125, qty: 1 }, // Drago Meteora
                { id: 932, qty: 1 }, // Drago Tricorno
                { id: 13, qty: 1 }, // Teschio Evocato
                { id: 518, qty: 1 }, // Zera il Mant
                { id: 436, qty: 1 }, // Drago Serpente della Notte
                { id: 493, qty: 2 }, // Behemoth a Due Teste
                { id: 331, qty: 2 }, // Drago Koumori
                { id: 502, qty: 2 }, // Predone Vorse
                { id: 335, qty: 2 }, // La Jinn il Genio Mistico della Lampada
                { id: 642, qty: 1 }, // Cucciolo del Drago Nero
                { id: 613, qty: 1 }, // Lama Oscura
                { id: 428, qty: 1 }, // Ryu-Kishin Potenziato
                { id: 78, qty: 2 }, // Patto col Sovrano Oscuro
                { id: 517, qty: 1 }, // Rituale di Zera
                { id: 38, qty: 1 }, // Fusione
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 600, qty: 1 }, // Trappola Fasulla
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 251, qty: 1 }, // Sepoltura Sciocca
                { id: 503, qty: 1 } // Waboku
            ],
            extra: [
                { id: 1126, qty: 1 }, // Drago Nero Meteora
                { id: 102, qty: 1 } // Drago Nero del Teschio
            ]
        },
        hard: {
            main: [
                { id: 110, qty: 2 }, // Drago Berserk
                { id: 12, qty: 2 }, // Drago Nero Occhi Rossi
                { id: 1125, qty: 1 }, // Drago Meteora
                { id: 932, qty: 2 }, // Drago Tricorno
                { id: 13, qty: 1 }, // Teschio Evocato
                { id: 518, qty: 1 }, // Zera il Mant
                { id: 436, qty: 1 }, // Drago Serpente della Notte
                { id: 493, qty: 2 }, // Behemoth a Due Teste
                { id: 331, qty: 2 }, // Drago Koumori
                { id: 502, qty: 2 }, // Predone Vorse
                { id: 335, qty: 2 }, // La Jinn il Genio Mistico della Lampada
                { id: 642, qty: 1 }, // Cucciolo del Drago Nero
                { id: 78, qty: 2 }, // Patto col Sovrano Oscuro
                { id: 517, qty: 1 }, // Rituale di Zera
                { id: 38, qty: 1 }, // Fusione
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 251, qty: 1 }, // Sepoltura Sciocca
                { id: 503, qty: 1 }, // Waboku
                { id: 638, qty: 1 }, // Drago Oscurità Occhi Rossi
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 409, qty: 1 } // Raigeki
            ],
            extra: [
                { id: 1126, qty: 1 }, // Drago Nero Meteora
                { id: 102, qty: 1 } // Drago Nero del Teschio
            ]
        }
    },

    // Roberto Giacobbo I, "Divinità egizia": il boss easter egg della campagna
    // Freedom. Il Drago Alato di Ra è la sua carta simbolo (una copia in ogni livello), e
    // intorno le carte più potenti del gioco a piacimento, con un tocco di misteri egizi
    // (Cavaliere Mistico di Sciacallo, Uomo con Wdjat, Necrovalley, L'Occhio della Verità).
    // Nella Storia si affronta in Difficile.
    robertoGiacobbo: {
        flagship: 472, // Il Drago Alato di Ra — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 472, qty: 1 }, // Il Drago Alato di Ra
                { id: 660, qty: 3 }, // Tartaruga della Piramide
                { id: 1052, qty: 3 }, // Des Lacooda
                { id: 1020, qty: 3 }, // Mummia Velenosa
                { id: 764, qty: 2 }, // Statua Guardiana
                { id: 754, qty: 2 }, // Grande Spirito
                { id: 758, qty: 2 }, // Statua di Pietra degli Aztechi
                { id: 762, qty: 2 }, // Cannoni Intercettori Moai
                { id: 1116, qty: 1 }, // Uomo con Wdjat
                { id: 321, qty: 1 }, // Kaiser Sea Horse
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 890, qty: 1 }, // Necrovalley
                { id: 576, qty: 1 }, // Telescopio Antico
                { id: 466, qty: 1 }, // L'Occhio della Verità
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 875, qty: 1 }, // Libro della Luna
                { id: 439, qty: 1 } // Incantesimo Ombra
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 472, qty: 1 }, // Il Drago Alato di Ra
                { id: 1, qty: 2 }, // Drago Bianco Occhi Blu
                { id: 12, qty: 1 }, // Drago Nero Occhi Rossi
                { id: 13, qty: 1 }, // Teschio Evocato
                { id: 17, qty: 1 }, // Jinzo
                { id: 2, qty: 1 }, // Mago Nero
                { id: 1109, qty: 1 }, // Cavaliere Mistico di Sciacallo
                { id: 502, qty: 2 }, // Predone Vorse
                { id: 16, qty: 2 }, // Gearfried il Cavaliere di Ferro
                { id: 1116, qty: 2 }, // Uomo con Wdjat
                { id: 321, qty: 2 }, // Kaiser Sea Horse
                { id: 22, qty: 1 }, // Kuriboh
                { id: 433, qty: 1 }, // Sangan
                { id: 660, qty: 2 }, // Tartaruga della Piramide
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 7, qty: 1 }, // Buco Nero
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 890, qty: 1 }, // Necrovalley
                { id: 576, qty: 1 }, // Telescopio Antico
                { id: 466, qty: 1 }, // L'Occhio della Verità
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 559, qty: 1 }, // Offerta Suprema
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 503, qty: 1 } // Waboku
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 472, qty: 1 }, // Il Drago Alato di Ra
                { id: 1, qty: 2 }, // Drago Bianco Occhi Blu
                { id: 12, qty: 2 }, // Drago Nero Occhi Rossi
                { id: 13, qty: 1 }, // Teschio Evocato
                { id: 17, qty: 1 }, // Jinzo
                { id: 2, qty: 1 }, // Mago Nero
                { id: 1109, qty: 1 }, // Cavaliere Mistico di Sciacallo
                { id: 502, qty: 2 }, // Predone Vorse
                { id: 16, qty: 2 }, // Gearfried il Cavaliere di Ferro
                { id: 1116, qty: 2 }, // Uomo con Wdjat
                { id: 321, qty: 2 }, // Kaiser Sea Horse
                { id: 22, qty: 1 }, // Kuriboh
                { id: 433, qty: 1 }, // Sangan
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 7, qty: 1 }, // Buco Nero
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 599, qty: 1 }, // Sette Attrezzi del Bandito
                { id: 890, qty: 1 }, // Necrovalley
                { id: 576, qty: 1 }, // Telescopio Antico
                { id: 466, qty: 1 }, // L'Occhio della Verità
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 559, qty: 1 }, // Offerta Suprema
                { id: 267, qty: 1 }, // Gilford il Fulmine
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 409, qty: 1 } // Raigeki
            ],
            extra: []
        }
    },

    // ww1_kaiserjager: mazzo della Grande Guerra — CONGELATO su richiesta esplicita
    // dell'utente ("quelli della ww1 NON TOCCARLI"): i tre livelli sono
    // ESATTAMENTE quelli che il gioco produceva prima di questa riscrittura,
    // e le regole dei livelli qui sotto non si applicano. Non ritoccarli
    // senza una richiesta esplicita.
    // Alberto Angela: una legione imperiale ordinata attorno a comandanti,
    // veterani e difese monumentali. Facile rappresenta le reclute e le mura;
    // Medio schiera una vera formazione; Difficile combina ricerca, recupero
    // dei Guerrieri ed equipaggiamenti sotto Gilford la Leggenda.
    albertoAngela: {
        flagship: 709, // Gilford la Leggenda
        easy: {
            main: [
                { id: 709, qty: 1 }, { id: 714, qty: 3 }, { id: 713, qty: 2 },
                { id: 369, qty: 3 }, { id: 296, qty: 3 }, { id: 108, qty: 3 },
                { id: 710, qty: 2 }, { id: 957, qty: 2 }, { id: 1090, qty: 2 },
                { id: 580, qty: 1 }, { id: 465, qty: 1 }, { id: 344, qty: 2 },
                { id: 148, qty: 1 }, { id: 8, qty: 1 }, { id: 820, qty: 2 },
                { id: 503, qty: 3 }, { id: 143, qty: 2 }, { id: 595, qty: 1 },
                { id: 546, qty: 1 }, { id: 35, qty: 1 }, { id: 36, qty: 1 },
                { id: 40, qty: 1 }, { id: 875, qty: 1 }
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 709, qty: 1 }, { id: 888, qty: 1 }, { id: 714, qty: 3 },
                { id: 713, qty: 2 }, { id: 16, qty: 2 }, { id: 504, qty: 2 },
                { id: 957, qty: 1 }, { id: 1090, qty: 1 }, { id: 710, qty: 2 },
                { id: 712, qty: 2 }, { id: 119, qty: 1 }, { id: 115, qty: 1 },
                { id: 580, qty: 1 }, { id: 465, qty: 2 }, { id: 724, qty: 1 },
                { id: 725, qty: 1 }, { id: 344, qty: 1 }, { id: 722, qty: 1 },
                { id: 148, qty: 1 }, { id: 8, qty: 1 }, { id: 820, qty: 1 },
                { id: 503, qty: 1 }, { id: 143, qty: 1 }, { id: 819, qty: 1 },
                { id: 35, qty: 1 }, { id: 36, qty: 1 }, { id: 272, qty: 1 },
                { id: 40, qty: 1 }, { id: 793, qty: 1 }, { id: 646, qty: 1 },
                { id: 875, qty: 1 }, { id: 559, qty: 1 }
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 709, qty: 1 }, { id: 888, qty: 2 }, { id: 267, qty: 1 },
                { id: 714, qty: 3 }, { id: 713, qty: 2 }, { id: 16, qty: 2 },
                { id: 504, qty: 2 }, { id: 719, qty: 2 }, { id: 718, qty: 2 },
                { id: 865, qty: 1 }, { id: 115, qty: 1 }, { id: 119, qty: 2 },
                { id: 710, qty: 1 }, { id: 580, qty: 1 }, { id: 465, qty: 2 },
                { id: 724, qty: 2 }, { id: 725, qty: 1 }, { id: 722, qty: 1 },
                { id: 726, qty: 1 }, { id: 35, qty: 1 }, { id: 36, qty: 1 },
                { id: 272, qty: 1 }, { id: 40, qty: 1 }, { id: 793, qty: 1 },
                { id: 382, qty: 1 }, { id: 646, qty: 1 }, { id: 503, qty: 1 },
                { id: 875, qty: 1 }, { id: 820, qty: 1 }
            ],
            extra: []
        }
    },

    // Alessandro Barbero: un ordine cavalleresco costruito sulla corte di
    // Regina, Re e Jack. Salendo di difficoltà aumentano coesione, armi e
    // accesso alla fusione del Cavaliere Joker Arcano, senza perdere il tema.
    alessandroBarbero: {
        flagship: 1280, // Cavaliere del Re
        easy: {
            main: [
                { id: 1280, qty: 2 }, { id: 1279, qty: 2 }, { id: 389, qty: 1 },
                { id: 4, qty: 1 }, { id: 712, qty: 1 }, { id: 369, qty: 3 },
                { id: 294, qty: 3 }, { id: 108, qty: 3 }, { id: 296, qty: 2 },
                { id: 1100, qty: 2 }, { id: 344, qty: 2 },
                { id: 580, qty: 1 }, { id: 465, qty: 1 }, { id: 8, qty: 1 },
                { id: 820, qty: 2 }, { id: 503, qty: 3 }, { id: 143, qty: 2 },
                { id: 595, qty: 1 }, { id: 148, qty: 1 }, { id: 35, qty: 1 },
                { id: 36, qty: 1 }, { id: 272, qty: 1 }, { id: 40, qty: 1 },
                { id: 875, qty: 1 }, { id: 546, qty: 1 }
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 1280, qty: 2 }, { id: 1279, qty: 3 }, { id: 1281, qty: 2 },
                { id: 888, qty: 1 }, { id: 713, qty: 2 }, { id: 714, qty: 2 },
                { id: 119, qty: 2 }, { id: 6, qty: 1 }, { id: 14, qty: 1 },
                { id: 115, qty: 1 }, { id: 712, qty: 2 }, { id: 38, qty: 2 },
                { id: 724, qty: 2 }, { id: 725, qty: 1 }, { id: 580, qty: 1 },
                { id: 465, qty: 1 }, { id: 344, qty: 1 }, { id: 726, qty: 1 },
                { id: 8, qty: 1 }, { id: 820, qty: 1 }, { id: 503, qty: 1 },
                { id: 819, qty: 1 }, { id: 35, qty: 1 }, { id: 36, qty: 1 },
                { id: 272, qty: 1 }, { id: 40, qty: 1 }, { id: 793, qty: 1 },
                { id: 646, qty: 1 }, { id: 875, qty: 1 }, { id: 559, qty: 1 }
            ],
            extra: [{ id: 1282, qty: 2 }]
        },
        hard: {
            main: [
                { id: 1280, qty: 2 }, { id: 1279, qty: 3 }, { id: 1281, qty: 3 },
                { id: 888, qty: 2 }, { id: 713, qty: 2 }, { id: 714, qty: 2 },
                { id: 119, qty: 2 }, { id: 16, qty: 2 }, { id: 14, qty: 1 },
                { id: 267, qty: 1 }, { id: 38, qty: 3 }, { id: 724, qty: 2 },
                { id: 725, qty: 2 }, { id: 580, qty: 1 }, { id: 465, qty: 1 },
                { id: 726, qty: 1 }, { id: 722, qty: 1 }, { id: 503, qty: 2 },
                { id: 35, qty: 1 }, { id: 36, qty: 1 }, { id: 272, qty: 1 },
                { id: 40, qty: 1 }, { id: 793, qty: 1 }, { id: 382, qty: 1 },
                { id: 646, qty: 1 }
            ],
            extra: [{ id: 1282, qty: 3 }]
        }
    },

    ww1_kaiserjager: {
        congelato: true,
        easy: {
            main: [
                { id: 1234, qty: 3 }, // Kaiserjäger Tirolese
                { id: 1235, qty: 3 }, // Standschütze
                { id: 1237, qty: 3 }, // Landwehr Ungherese
                { id: 1238, qty: 3 }, // Mitragliere Schwarzlose
                { id: 1230, qty: 3 }, // Obice Skoda da 100
                { id: 1236, qty: 2 }, // Sturmtruppen, Reparto d'Assalto
                { id: 1242, qty: 3 }, // Caverne del Carso
                { id: 1241, qty: 2 }, // Aquila Bicipite
                { id: 1244, qty: 2 }, // Ospedale da Campo k.u.k.
                { id: 1245, qty: 2 }, // Il Comunicato di Vienna
                { id: 1249, qty: 3 }, // Reticolato Imperiale
                { id: 1247, qty: 2 }, // Sbarramento dello Skoda
                { id: 1246, qty: 2 }, // Gas di Flitsch
                { id: 1248, qty: 2 }, // Caporetto, la Rotta
                { id: 1210, qty: 3 }, // Fante del Regio Esercito
                { id: 1214, qty: 2 } // Mitragliere
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 1234, qty: 3 }, // Kaiserjäger Tirolese
                { id: 1235, qty: 3 }, // Standschütze
                { id: 1237, qty: 3 }, // Landwehr Ungherese
                { id: 1238, qty: 3 }, // Mitragliere Schwarzlose
                { id: 1239, qty: 3 }, // Ulano
                { id: 1230, qty: 3 }, // Obice Skoda da 100
                { id: 1226, qty: 2 }, // Hansa-Brandenburg D.I
                { id: 1236, qty: 2 }, // Sturmtruppen, Reparto d'Assalto
                { id: 1242, qty: 3 }, // Caverne del Carso
                { id: 1241, qty: 2 }, // Aquila Bicipite
                { id: 1244, qty: 2 }, // Ospedale da Campo k.u.k.
                { id: 1245, qty: 2 }, // Il Comunicato di Vienna
                { id: 1249, qty: 3 }, // Reticolato Imperiale
                { id: 1247, qty: 2 }, // Sbarramento dello Skoda
                { id: 1246, qty: 2 }, // Gas di Flitsch
                { id: 1248, qty: 2 } // Caporetto, la Rotta
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 1234, qty: 3 }, // Kaiserjäger Tirolese
                { id: 1235, qty: 3 }, // Standschütze
                { id: 1237, qty: 3 }, // Landwehr Ungherese
                { id: 1238, qty: 3 }, // Mitragliere Schwarzlose
                { id: 1239, qty: 3 }, // Ulano
                { id: 1230, qty: 3 }, // Obice Skoda da 100
                { id: 1226, qty: 2 }, // Hansa-Brandenburg D.I
                { id: 1236, qty: 2 }, // Sturmtruppen, Reparto d'Assalto
                { id: 1242, qty: 3 }, // Caverne del Carso
                { id: 1241, qty: 2 }, // Aquila Bicipite
                { id: 1244, qty: 2 }, // Ospedale da Campo k.u.k.
                { id: 1245, qty: 2 }, // Il Comunicato di Vienna
                { id: 1249, qty: 3 }, // Reticolato Imperiale
                { id: 1247, qty: 2 }, // Sbarramento dello Skoda
                { id: 1246, qty: 2 }, // Gas di Flitsch
                { id: 1248, qty: 2 } // Caporetto, la Rotta
            ],
            extra: []
        }
    },

    // ww1_arigi: mazzo della Grande Guerra — CONGELATO su richiesta esplicita
    // dell'utente ("quelli della ww1 NON TOCCARLI"): i tre livelli sono
    // ESATTAMENTE quelli che il gioco produceva prima di questa riscrittura,
    // e le regole dei livelli qui sotto non si applicano. Non ritoccarli
    // senza una richiesta esplicita.
    ww1_arigi: {
        congelato: true,
        easy: {
            main: [
                { id: 1226, qty: 1 }, // Hansa-Brandenburg D.I
                { id: 1227, qty: 3 }, // Albatros D.III (Oeffag)
                { id: 1239, qty: 3 }, // Ulano
                { id: 1234, qty: 2 }, // Kaiserjäger Tirolese
                { id: 1237, qty: 2 }, // Landwehr Ungherese
                { id: 1238, qty: 3 }, // Mitragliere Schwarzlose
                { id: 1241, qty: 3 }, // Aquila Bicipite
                { id: 1240, qty: 2 }, // Strafexpedition
                { id: 1243, qty: 2 }, // Ordine di Boroevic
                { id: 1245, qty: 2 }, // Il Comunicato di Vienna
                { id: 1247, qty: 3 }, // Sbarramento dello Skoda
                { id: 1249, qty: 2 }, // Reticolato Imperiale
                { id: 1244, qty: 2 }, // Ospedale da Campo k.u.k.
                { id: 1246, qty: 3 }, // Gas di Flitsch
                { id: 1210, qty: 3 }, // Fante del Regio Esercito
                { id: 1214, qty: 3 }, // Mitragliere
                { id: 1235, qty: 1 } // Standschütze
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 1228, qty: 3 }, // Julius Arigi
                { id: 1226, qty: 3 }, // Hansa-Brandenburg D.I
                { id: 1227, qty: 3 }, // Albatros D.III (Oeffag)
                { id: 1239, qty: 3 }, // Ulano
                { id: 1234, qty: 2 }, // Kaiserjäger Tirolese
                { id: 1236, qty: 2 }, // Sturmtruppen, Reparto d'Assalto
                { id: 1237, qty: 2 }, // Landwehr Ungherese
                { id: 1238, qty: 3 }, // Mitragliere Schwarzlose
                { id: 1241, qty: 3 }, // Aquila Bicipite
                { id: 1240, qty: 2 }, // Strafexpedition
                { id: 1243, qty: 2 }, // Ordine di Boroevic
                { id: 1245, qty: 2 }, // Il Comunicato di Vienna
                { id: 1247, qty: 3 }, // Sbarramento dello Skoda
                { id: 1249, qty: 2 }, // Reticolato Imperiale
                { id: 1244, qty: 2 }, // Ospedale da Campo k.u.k.
                { id: 1246, qty: 3 } // Gas di Flitsch
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 1228, qty: 3 }, // Julius Arigi
                { id: 1226, qty: 3 }, // Hansa-Brandenburg D.I
                { id: 1227, qty: 3 }, // Albatros D.III (Oeffag)
                { id: 1239, qty: 3 }, // Ulano
                { id: 1234, qty: 2 }, // Kaiserjäger Tirolese
                { id: 1236, qty: 3 }, // Sturmtruppen, Reparto d'Assalto
                { id: 1237, qty: 2 }, // Landwehr Ungherese
                { id: 1238, qty: 2 }, // Mitragliere Schwarzlose
                { id: 1241, qty: 3 }, // Aquila Bicipite
                { id: 1240, qty: 2 }, // Strafexpedition
                { id: 1243, qty: 2 }, // Ordine di Boroevic
                { id: 1245, qty: 2 }, // Il Comunicato di Vienna
                { id: 1247, qty: 3 }, // Sbarramento dello Skoda
                { id: 1249, qty: 2 }, // Reticolato Imperiale
                { id: 1244, qty: 2 }, // Ospedale da Campo k.u.k.
                { id: 1246, qty: 3 } // Gas di Flitsch
            ],
            extra: []
        }
    },

    // ww1_brumowski: mazzo della Grande Guerra — CONGELATO su richiesta esplicita
    // dell'utente ("quelli della ww1 NON TOCCARLI"): i tre livelli sono
    // ESATTAMENTE quelli che il gioco produceva prima di questa riscrittura,
    // e le regole dei livelli qui sotto non si applicano. Non ritoccarli
    // senza una richiesta esplicita.
    ww1_brumowski: {
        congelato: true,
        easy: {
            main: [
                { id: 1225, qty: 1 }, // Godwin von Brumowski, Asso Imperiale
                { id: 1226, qty: 3 }, // Hansa-Brandenburg D.I
                { id: 1232, qty: 2 }, // Arciduca Eugenio d'Asburgo
                { id: 1239, qty: 3 }, // Ulano
                { id: 1234, qty: 2 }, // Kaiserjäger Tirolese
                { id: 1238, qty: 3 }, // Mitragliere Schwarzlose
                { id: 1241, qty: 3 }, // Aquila Bicipite
                { id: 1240, qty: 3 }, // Strafexpedition
                { id: 1243, qty: 2 }, // Ordine di Boroevic
                { id: 1245, qty: 2 }, // Il Comunicato di Vienna
                { id: 1247, qty: 3 }, // Sbarramento dello Skoda
                { id: 1246, qty: 3 }, // Gas di Flitsch
                { id: 1249, qty: 2 }, // Reticolato Imperiale
                { id: 1210, qty: 3 }, // Fante del Regio Esercito
                { id: 1214, qty: 3 }, // Mitragliere
                { id: 1235, qty: 2 } // Standschütze
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 1225, qty: 1 }, // Godwin von Brumowski, Asso Imperiale
                { id: 1227, qty: 3 }, // Albatros D.III (Oeffag)
                { id: 1228, qty: 3 }, // Julius Arigi
                { id: 1226, qty: 3 }, // Hansa-Brandenburg D.I
                { id: 1232, qty: 1 }, // Arciduca Eugenio d'Asburgo
                { id: 1236, qty: 3 }, // Sturmtruppen, Reparto d'Assalto
                { id: 1239, qty: 3 }, // Ulano
                { id: 1234, qty: 2 }, // Kaiserjäger Tirolese
                { id: 1238, qty: 3 }, // Mitragliere Schwarzlose
                { id: 1241, qty: 3 }, // Aquila Bicipite
                { id: 1240, qty: 3 }, // Strafexpedition
                { id: 1243, qty: 2 }, // Ordine di Boroevic
                { id: 1245, qty: 2 }, // Il Comunicato di Vienna
                { id: 1247, qty: 3 }, // Sbarramento dello Skoda
                { id: 1246, qty: 3 }, // Gas di Flitsch
                { id: 1249, qty: 2 } // Reticolato Imperiale
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 1225, qty: 1 }, // Godwin von Brumowski, Asso Imperiale
                { id: 1227, qty: 3 }, // Albatros D.III (Oeffag)
                { id: 1228, qty: 3 }, // Julius Arigi
                { id: 1226, qty: 3 }, // Hansa-Brandenburg D.I
                { id: 1232, qty: 2 }, // Arciduca Eugenio d'Asburgo
                { id: 1236, qty: 3 }, // Sturmtruppen, Reparto d'Assalto
                { id: 1239, qty: 3 }, // Ulano
                { id: 1234, qty: 2 }, // Kaiserjäger Tirolese
                { id: 1238, qty: 2 }, // Mitragliere Schwarzlose
                { id: 1241, qty: 3 }, // Aquila Bicipite
                { id: 1240, qty: 3 }, // Strafexpedition
                { id: 1243, qty: 2 }, // Ordine di Boroevic
                { id: 1245, qty: 2 }, // Il Comunicato di Vienna
                { id: 1247, qty: 3 }, // Sbarramento dello Skoda
                { id: 1246, qty: 3 }, // Gas di Flitsch
                { id: 1249, qty: 2 } // Reticolato Imperiale
            ],
            extra: []
        }
    },

    // ww1_conrad: mazzo della Grande Guerra — CONGELATO su richiesta esplicita
    // dell'utente ("quelli della ww1 NON TOCCARLI"): i tre livelli sono
    // ESATTAMENTE quelli che il gioco produceva prima di questa riscrittura,
    // e le regole dei livelli qui sotto non si applicano. Non ritoccarli
    // senza una richiesta esplicita.
    ww1_conrad: {
        congelato: true,
        easy: {
            main: [
                { id: 1232, qty: 2 }, // Arciduca Eugenio d'Asburgo
                { id: 1229, qty: 1 }, // Mörser Skoda da 305
                { id: 1230, qty: 3 }, // Obice Skoda da 100
                { id: 1237, qty: 3 }, // Landwehr Ungherese
                { id: 1235, qty: 3 }, // Standschütze
                { id: 1238, qty: 3 }, // Mitragliere Schwarzlose
                { id: 1234, qty: 2 }, // Kaiserjäger Tirolese
                { id: 1240, qty: 3 }, // Strafexpedition
                { id: 1242, qty: 3 }, // Caverne del Carso
                { id: 1243, qty: 2 }, // Ordine di Boroevic
                { id: 1245, qty: 2 }, // Il Comunicato di Vienna
                { id: 1248, qty: 3 }, // Caporetto, la Rotta
                { id: 1246, qty: 3 }, // Gas di Flitsch
                { id: 1249, qty: 2 }, // Reticolato Imperiale
                { id: 1244, qty: 1 }, // Ospedale da Campo k.u.k.
                { id: 1210, qty: 3 }, // Fante del Regio Esercito
                { id: 1214, qty: 1 } // Mitragliere
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 1233, qty: 3 }, // Conrad von Hötzendorf
                { id: 1232, qty: 2 }, // Arciduca Eugenio d'Asburgo
                { id: 1229, qty: 2 }, // Mörser Skoda da 305
                { id: 1230, qty: 3 }, // Obice Skoda da 100
                { id: 1237, qty: 3 }, // Landwehr Ungherese
                { id: 1235, qty: 3 }, // Standschütze
                { id: 1238, qty: 3 }, // Mitragliere Schwarzlose
                { id: 1234, qty: 2 }, // Kaiserjäger Tirolese
                { id: 1240, qty: 3 }, // Strafexpedition
                { id: 1242, qty: 3 }, // Caverne del Carso
                { id: 1243, qty: 2 }, // Ordine di Boroevic
                { id: 1245, qty: 2 }, // Il Comunicato di Vienna
                { id: 1248, qty: 3 }, // Caporetto, la Rotta
                { id: 1246, qty: 3 }, // Gas di Flitsch
                { id: 1249, qty: 2 }, // Reticolato Imperiale
                { id: 1244, qty: 1 } // Ospedale da Campo k.u.k.
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 1233, qty: 3 }, // Conrad von Hötzendorf
                { id: 1232, qty: 2 }, // Arciduca Eugenio d'Asburgo
                { id: 1229, qty: 2 }, // Mörser Skoda da 305
                { id: 1230, qty: 3 }, // Obice Skoda da 100
                { id: 1237, qty: 3 }, // Landwehr Ungherese
                { id: 1235, qty: 3 }, // Standschütze
                { id: 1238, qty: 3 }, // Mitragliere Schwarzlose
                { id: 1234, qty: 2 }, // Kaiserjäger Tirolese
                { id: 1240, qty: 3 }, // Strafexpedition
                { id: 1242, qty: 3 }, // Caverne del Carso
                { id: 1243, qty: 2 }, // Ordine di Boroevic
                { id: 1245, qty: 2 }, // Il Comunicato di Vienna
                { id: 1248, qty: 3 }, // Caporetto, la Rotta
                { id: 1246, qty: 3 }, // Gas di Flitsch
                { id: 1249, qty: 2 }, // Reticolato Imperiale
                { id: 1244, qty: 1 } // Ospedale da Campo k.u.k.
            ],
            extra: []
        }
    },

    // ww1_eugenio: mazzo della Grande Guerra — CONGELATO su richiesta esplicita
    // dell'utente ("quelli della ww1 NON TOCCARLI"): i tre livelli sono
    // ESATTAMENTE quelli che il gioco produceva prima di questa riscrittura,
    // e le regole dei livelli qui sotto non si applicano. Non ritoccarli
    // senza una richiesta esplicita.
    ww1_eugenio: {
        congelato: true,
        easy: {
            main: [
                { id: 1230, qty: 3 }, // Obice Skoda da 100
                { id: 1231, qty: 1 }, // Svetozar Boroevic, il Leone dell'Isonzo
                { id: 1234, qty: 3 }, // Kaiserjäger Tirolese
                { id: 1239, qty: 1 }, // Ulano
                { id: 1237, qty: 2 }, // Landwehr Ungherese
                { id: 1240, qty: 3 }, // Strafexpedition
                { id: 1241, qty: 2 }, // Aquila Bicipite
                { id: 1243, qty: 3 }, // Ordine di Boroevic
                { id: 1244, qty: 2 }, // Ospedale da Campo k.u.k.
                { id: 1247, qty: 3 }, // Sbarramento dello Skoda
                { id: 1249, qty: 3 }, // Reticolato Imperiale
                { id: 1248, qty: 2 }, // Caporetto, la Rotta
                { id: 1245, qty: 2 }, // Il Comunicato di Vienna
                { id: 1238, qty: 3 }, // Mitragliere Schwarzlose
                { id: 1210, qty: 3 }, // Fante del Regio Esercito
                { id: 1214, qty: 3 }, // Mitragliere
                { id: 1235, qty: 1 } // Standschütze
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 1232, qty: 3 }, // Arciduca Eugenio d'Asburgo
                { id: 1229, qty: 3 }, // Mörser Skoda da 305
                { id: 1230, qty: 3 }, // Obice Skoda da 100
                { id: 1231, qty: 1 }, // Svetozar Boroevic, il Leone dell'Isonzo
                { id: 1236, qty: 3 }, // Sturmtruppen, Reparto d'Assalto
                { id: 1234, qty: 3 }, // Kaiserjäger Tirolese
                { id: 1239, qty: 2 }, // Ulano
                { id: 1237, qty: 2 }, // Landwehr Ungherese
                { id: 1240, qty: 3 }, // Strafexpedition
                { id: 1241, qty: 2 }, // Aquila Bicipite
                { id: 1243, qty: 3 }, // Ordine di Boroevic
                { id: 1244, qty: 2 }, // Ospedale da Campo k.u.k.
                { id: 1247, qty: 3 }, // Sbarramento dello Skoda
                { id: 1249, qty: 3 }, // Reticolato Imperiale
                { id: 1248, qty: 2 }, // Caporetto, la Rotta
                { id: 1245, qty: 2 } // Il Comunicato di Vienna
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 1232, qty: 3 }, // Arciduca Eugenio d'Asburgo
                { id: 1229, qty: 3 }, // Mörser Skoda da 305
                { id: 1230, qty: 3 }, // Obice Skoda da 100
                { id: 1231, qty: 1 }, // Svetozar Boroevic, il Leone dell'Isonzo
                { id: 1236, qty: 3 }, // Sturmtruppen, Reparto d'Assalto
                { id: 1234, qty: 3 }, // Kaiserjäger Tirolese
                { id: 1239, qty: 2 }, // Ulano
                { id: 1237, qty: 2 }, // Landwehr Ungherese
                { id: 1240, qty: 3 }, // Strafexpedition
                { id: 1241, qty: 2 }, // Aquila Bicipite
                { id: 1243, qty: 3 }, // Ordine di Boroevic
                { id: 1244, qty: 2 }, // Ospedale da Campo k.u.k.
                { id: 1247, qty: 3 }, // Sbarramento dello Skoda
                { id: 1249, qty: 3 }, // Reticolato Imperiale
                { id: 1248, qty: 2 }, // Caporetto, la Rotta
                { id: 1245, qty: 2 } // Il Comunicato di Vienna
            ],
            extra: []
        }
    },

    // ww1_boroevic: mazzo della Grande Guerra — CONGELATO su richiesta esplicita
    // dell'utente ("quelli della ww1 NON TOCCARLI"): i tre livelli sono
    // ESATTAMENTE quelli che il gioco produceva prima di questa riscrittura,
    // e le regole dei livelli qui sotto non si applicano. Non ritoccarli
    // senza una richiesta esplicita.
    ww1_boroevic: {
        congelato: true,
        easy: {
            main: [
                { id: 1225, qty: 1 }, // Godwin von Brumowski, Asso Imperiale
                { id: 1232, qty: 1 }, // Arciduca Eugenio d'Asburgo
                { id: 1229, qty: 3 }, // Mörser Skoda da 305
                { id: 1230, qty: 2 }, // Obice Skoda da 100
                { id: 1234, qty: 2 }, // Kaiserjäger Tirolese
                { id: 1237, qty: 2 }, // Landwehr Ungherese
                { id: 1242, qty: 3 }, // Caverne del Carso
                { id: 1240, qty: 2 }, // Strafexpedition
                { id: 1243, qty: 3 }, // Ordine di Boroevic
                { id: 1248, qty: 3 }, // Caporetto, la Rotta
                { id: 1247, qty: 2 }, // Sbarramento dello Skoda
                { id: 1246, qty: 2 }, // Gas di Flitsch
                { id: 1249, qty: 2 }, // Reticolato Imperiale
                { id: 1238, qty: 3 }, // Mitragliere Schwarzlose
                { id: 1210, qty: 3 }, // Fante del Regio Esercito
                { id: 1214, qty: 3 }, // Mitragliere
                { id: 1235, qty: 3 } // Standschütze
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 1231, qty: 2 }, // Svetozar Boroevic, il Leone dell'Isonzo
                { id: 1225, qty: 1 }, // Godwin von Brumowski, Asso Imperiale
                { id: 1232, qty: 3 }, // Arciduca Eugenio d'Asburgo
                { id: 1229, qty: 3 }, // Mörser Skoda da 305
                { id: 1233, qty: 3 }, // Conrad von Hötzendorf
                { id: 1236, qty: 3 }, // Sturmtruppen, Reparto d'Assalto
                { id: 1227, qty: 2 }, // Albatros D.III (Oeffag)
                { id: 1230, qty: 2 }, // Obice Skoda da 100
                { id: 1234, qty: 2 }, // Kaiserjäger Tirolese
                { id: 1237, qty: 2 }, // Landwehr Ungherese
                { id: 1242, qty: 3 }, // Caverne del Carso
                { id: 1240, qty: 2 }, // Strafexpedition
                { id: 1243, qty: 3 }, // Ordine di Boroevic
                { id: 1248, qty: 3 }, // Caporetto, la Rotta
                { id: 1247, qty: 2 }, // Sbarramento dello Skoda
                { id: 1246, qty: 2 }, // Gas di Flitsch
                { id: 1249, qty: 2 } // Reticolato Imperiale
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 1231, qty: 2 }, // Svetozar Boroevic, il Leone dell'Isonzo
                { id: 1225, qty: 1 }, // Godwin von Brumowski, Asso Imperiale
                { id: 1232, qty: 3 }, // Arciduca Eugenio d'Asburgo
                { id: 1229, qty: 3 }, // Mörser Skoda da 305
                { id: 1233, qty: 3 }, // Conrad von Hötzendorf
                { id: 1236, qty: 3 }, // Sturmtruppen, Reparto d'Assalto
                { id: 1227, qty: 2 }, // Albatros D.III (Oeffag)
                { id: 1230, qty: 2 }, // Obice Skoda da 100
                { id: 1234, qty: 2 }, // Kaiserjäger Tirolese
                { id: 1237, qty: 2 }, // Landwehr Ungherese
                { id: 1242, qty: 3 }, // Caverne del Carso
                { id: 1240, qty: 2 }, // Strafexpedition
                { id: 1243, qty: 3 }, // Ordine di Boroevic
                { id: 1248, qty: 3 }, // Caporetto, la Rotta
                { id: 1247, qty: 2 }, // Sbarramento dello Skoda
                { id: 1246, qty: 2 }, // Gas di Flitsch
                { id: 1249, qty: 2 } // Reticolato Imperiale
            ],
            extra: []
        }
    },

    // Noah Kaiba: i Mostri Spirito del duello contro Yugi (Hino-Kagu-Tsuchi,
    // Drago Yamata, Soldato di Susa, Sacerdote di Asura, Otohime, Yata-Garasu...) con la
    // Benedizione di Sebek per guadagnare Life Points ad ogni colpo, e il suo "mazzo della
    // Creazione" contro Seto (Chiron il Mago, l'era dei dinosauri, l'era glaciale con Ondata
    // Gelida e Cimitero dei Mammut). Prima era un doppione del mazzo di Kaiba.
    noah: {
        flagship: 1004, // Hino-Kagu-Tsuchi — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 1004, qty: 1 }, // Hino-Kagu-Tsuchi
                { id: 1005, qty: 3 }, // Coniglio Bianco di Inaba
                { id: 1006, qty: 3 }, // Otohime
                { id: 1002, qty: 3 }, // Fushi No Tori
                { id: 884, qty: 2 }, // Yata-Garasu
                { id: 367, qty: 2 }, // Cimitero dei Mammut
                { id: 936, qty: 2 }, // Sovrano Oscuro Bibocca
                { id: 805, qty: 2 }, // Ptera Nero
                { id: 1001, qty: 1 }, // Sacerdote di Asura
                { id: 806, qty: 1 }, // Stego Nero
                { id: 813, qty: 2 }, // Benedizione di Sebek
                { id: 159, qty: 1 }, // Ondata Gelida
                { id: 812, qty: 1 }, // Mondo Giurassico
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 546, qty: 2 }, // Dian Keto la Maestra delle Cure
                { id: 611, qty: 1 }, // Giavellotto Incantato
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 1004, qty: 1 }, // Hino-Kagu-Tsuchi
                { id: 1008, qty: 1 }, // Drago Yamata
                { id: 1007, qty: 2 }, // Soldato di Susa
                { id: 1001, qty: 2 }, // Sacerdote di Asura
                { id: 1003, qty: 1 }, // Grande Naso Lungo
                { id: 1002, qty: 2 }, // Fushi No Tori
                { id: 1005, qty: 2 }, // Coniglio Bianco di Inaba
                { id: 1006, qty: 2 }, // Otohime
                { id: 884, qty: 1 }, // Yata-Garasu
                { id: 150, qty: 2 }, // Chiron il Mago
                { id: 801, qty: 1 }, // Tiranno Nero
                { id: 367, qty: 1 }, // Cimitero dei Mammut
                { id: 266, qty: 2 }, // Gilasaurus
                { id: 813, qty: 2 }, // Benedizione di Sebek
                { id: 159, qty: 1 }, // Ondata Gelida
                { id: 812, qty: 1 }, // Mondo Giurassico
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 611, qty: 1 }, // Giavellotto Incantato
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 1004, qty: 1 }, // Hino-Kagu-Tsuchi
                { id: 1008, qty: 2 }, // Drago Yamata
                { id: 1007, qty: 2 }, // Soldato di Susa
                { id: 1001, qty: 2 }, // Sacerdote di Asura
                { id: 1003, qty: 2 }, // Grande Naso Lungo
                { id: 1002, qty: 2 }, // Fushi No Tori
                { id: 1005, qty: 1 }, // Coniglio Bianco di Inaba
                { id: 1006, qty: 1 }, // Otohime
                { id: 884, qty: 1 }, // Yata-Garasu
                { id: 150, qty: 2 }, // Chiron il Mago
                { id: 801, qty: 1 }, // Tiranno Nero
                { id: 367, qty: 1 }, // Cimitero dei Mammut
                { id: 266, qty: 2 }, // Gilasaurus
                { id: 813, qty: 2 }, // Benedizione di Sebek
                { id: 159, qty: 1 }, // Ondata Gelida
                { id: 812, qty: 1 }, // Mondo Giurassico
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 611, qty: 1 }, // Giavellotto Incantato
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 490, qty: 1 } // Tributo Torrenziale
            ],
            extra: []
        }
    },

    // Gozaburo Kaiba: Exodia Necross, evocata con il Patto con Exodia dopo aver
    // mandato al Cimitero le cinque parti del Proibito (Sepoltura Sciocca, Carità Aggraziata,
    // Distruzione di Carte), difesa a muro nel frattempo — l'anime mostra solo queste carte
    // del suo mazzo.
    gozaburo: {
        flagship: 230, // Exodia Necross — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 230, qty: 1 }, // Exodia Necross
                { id: 41, qty: 1 }, // Testa Proibita
                { id: 42, qty: 1 }, // Braccio Sx del Proibito
                { id: 11, qty: 1 }, // Braccio Dx Del Proibito
                { id: 44, qty: 1 }, // Gamba Sx del Proibito
                { id: 43, qty: 1 }, // Gamba Dx del Proibito
                { id: 54, qty: 3 }, // Muro d'Illusione
                { id: 433, qty: 3 }, // Sangan
                { id: 508, qty: 2 }, // Strega della Foresta Nera
                { id: 115, qty: 2 }, // Gran Scudo Gardna
                { id: 984, qty: 2 }, // Spirito Legato alla Terra
                { id: 428, qty: 1 }, // Ryu-Kishin Potenziato
                { id: 375, qty: 1 }, // Guardiano di Metallo
                { id: 161, qty: 1 }, // Patto con Exodia
                { id: 251, qty: 2 }, // Sepoltura Sciocca
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 750, qty: 1 }, // Gabbia d'Acciaio dell'Incubo
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 875, qty: 1 }, // Libro della Luna
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 230, qty: 1 }, // Exodia Necross
                { id: 41, qty: 1 }, // Testa Proibita
                { id: 42, qty: 1 }, // Braccio Sx del Proibito
                { id: 11, qty: 1 }, // Braccio Dx Del Proibito
                { id: 44, qty: 1 }, // Gamba Sx del Proibito
                { id: 43, qty: 1 }, // Gamba Dx del Proibito
                { id: 115, qty: 2 }, // Gran Scudo Gardna
                { id: 54, qty: 2 }, // Muro d'Illusione
                { id: 433, qty: 2 }, // Sangan
                { id: 508, qty: 2 }, // Strega della Foresta Nera
                { id: 337, qty: 2 }, // Muro del Labirinto
                { id: 984, qty: 1 }, // Spirito Legato alla Terra
                { id: 375, qty: 1 }, // Guardiano di Metallo
                { id: 467, qty: 1 }, // Il Demone Megacyber
                { id: 428, qty: 1 }, // Ryu-Kishin Potenziato
                { id: 161, qty: 1 }, // Patto con Exodia
                { id: 251, qty: 2 }, // Sepoltura Sciocca
                { id: 138, qty: 1 }, // Distruzione di Carte
                { id: 272, qty: 2 }, // Carità Aggraziata
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 503, qty: 1 }, // Waboku
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 750, qty: 1 }, // Gabbia d'Acciaio dell'Incubo
                { id: 595, qty: 1 } // Il Guardiano Affidabile
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 230, qty: 1 }, // Exodia Necross
                { id: 41, qty: 1 }, // Testa Proibita
                { id: 42, qty: 1 }, // Braccio Sx del Proibito
                { id: 11, qty: 1 }, // Braccio Dx Del Proibito
                { id: 44, qty: 1 }, // Gamba Sx del Proibito
                { id: 43, qty: 1 }, // Gamba Dx del Proibito
                { id: 115, qty: 2 }, // Gran Scudo Gardna
                { id: 54, qty: 2 }, // Muro d'Illusione
                { id: 433, qty: 2 }, // Sangan
                { id: 508, qty: 2 }, // Strega della Foresta Nera
                { id: 337, qty: 2 }, // Muro del Labirinto
                { id: 375, qty: 2 }, // Guardiano di Metallo
                { id: 467, qty: 2 }, // Il Demone Megacyber
                { id: 161, qty: 1 }, // Patto con Exodia
                { id: 251, qty: 2 }, // Sepoltura Sciocca
                { id: 138, qty: 1 }, // Distruzione di Carte
                { id: 272, qty: 2 }, // Carità Aggraziata
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 750, qty: 1 }, // Gabbia d'Acciaio dell'Incubo
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 130, qty: 1 } // Controllo Mentale
            ],
            extra: []
        }
    },

    // Gansley (Big Five), nella forma del suo Deck Master Guerriero degli Abissi:
    // un mazzo di controllo con molti mostri d'acqua sotto Umi. Il potere del Deck Master
    // ("Buco Riflettore": annulla un attacco e rimanda il danno) è reso con Nega Attacco e
    // Cilindro Magico.
    gansley: {
        flagship: 1068, // Guerriero degli Abissi — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 1068, qty: 2 }, // Guerriero degli Abissi
                { id: 239, qty: 3 }, // Piovra Demoniaca
                { id: 314, qty: 3 }, // Medusa
                { id: 582, qty: 2 }, // Tartaruga Isola
                { id: 907, qty: 2 }, // Sirena Incantatrice
                { id: 904, qty: 2 }, // Stella Marina Corazzata
                { id: 935, qty: 2 }, // Tigre Tartaruga
                { id: 959, qty: 2 }, // Bestia Liquida
                { id: 505, qty: 1 }, // Water Omotics
                { id: 955, qty: 1 }, // Kraken di Fuoco
                { id: 497, qty: 1 }, // Umi
                { id: 489, qty: 1 }, // Muro del Tornado
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 2 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 704, qty: 1 }, // Salvataggio
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 1068, qty: 2 }, // Guerriero degli Abissi
                { id: 955, qty: 2 }, // Kraken di Fuoco
                { id: 958, qty: 2 }, // Gyojin dell'Alta Marea
                { id: 279, qty: 2 }, // Grande Squalo Bianco
                { id: 962, qty: 1 }, // Octoberser
                { id: 940, qty: 1 }, // Abitante degli Abissi
                { id: 239, qty: 2 }, // Piovra Demoniaca
                { id: 314, qty: 2 }, // Medusa
                { id: 505, qty: 1 }, // Water Omotics
                { id: 582, qty: 1 }, // Tartaruga Isola
                { id: 945, qty: 1 }, // Hyosube
                { id: 692, qty: 1 }, // Guerriero del Serpente Marino dell'Oscurità
                { id: 956, qty: 1 }, // Tartaruga Gigante che si Nutre di Fiamme
                { id: 907, qty: 1 }, // Sirena Incantatrice
                { id: 497, qty: 1 }, // Umi
                { id: 489, qty: 1 }, // Muro del Tornado
                { id: 79, qty: 1 }, // Un Oceano Leggendario
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 704, qty: 1 }, // Salvataggio
                { id: 595, qty: 1 } // Il Guardiano Affidabile
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 1068, qty: 2 }, // Guerriero degli Abissi
                { id: 955, qty: 2 }, // Kraken di Fuoco
                { id: 958, qty: 2 }, // Gyojin dell'Alta Marea
                { id: 279, qty: 2 }, // Grande Squalo Bianco
                { id: 962, qty: 2 }, // Octoberser
                { id: 940, qty: 2 }, // Abitante degli Abissi
                { id: 239, qty: 2 }, // Piovra Demoniaca
                { id: 314, qty: 2 }, // Medusa
                { id: 505, qty: 1 }, // Water Omotics
                { id: 945, qty: 1 }, // Hyosube
                { id: 692, qty: 2 }, // Guerriero del Serpente Marino dell'Oscurità
                { id: 956, qty: 1 }, // Tartaruga Gigante che si Nutre di Fiamme
                { id: 497, qty: 1 }, // Umi
                { id: 489, qty: 1 }, // Muro del Tornado
                { id: 79, qty: 1 }, // Un Oceano Leggendario
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 704, qty: 1 }, // Salvataggio
                { id: 382, qty: 1 } // Forza dello Specchio
            ],
            extra: []
        }
    },

    // Johnson (Big Five), l'avvocato nella forma dell'Uomo Giudice: Guerrieri e
    // carte "da tribunale" — Giudizio Solenne, Decreto Reale, Maschera della Restrizione,
    // Maledizione di Anubis — per il processo a Joey nel Mondo Virtuale.
    johnson: {
        flagship: 317, // Uomo Giudice — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 317, qty: 2 }, // Uomo Giudice
                { id: 296, qty: 3 }, // Eroe dell'Est
                { id: 108, qty: 3 }, // Guerriero da Battaglia
                { id: 435, qty: 2 }, // Soldato della Scienza
                { id: 369, qty: 2 }, // Masaki lo Spadaccino Leggendario
                { id: 535, qty: 2 }, // Guardia del Labirinto
                { id: 573, qty: 2 }, // D. Human
                { id: 536, qty: 2 }, // Protettrice del Trono
                { id: 330, qty: 1 }, // Kojikocy
                { id: 944, qty: 1 }, // Hibikime
                { id: 426, qty: 1 }, // Decreto Reale
                { id: 655, qty: 1 }, // Maledizione di Anubis
                { id: 580, qty: 1 }, // Sogen
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 317, qty: 2 }, // Uomo Giudice
                { id: 943, qty: 1 }, // Garnecia Elefantis
                { id: 504, qty: 2 }, // Guerriero Dai Grepher
                { id: 330, qty: 2 }, // Kojikocy
                { id: 516, qty: 1 }, // Zanki
                { id: 541, qty: 1 }, // Ansatsu
                { id: 573, qty: 2 }, // D. Human
                { id: 944, qty: 2 }, // Hibikime
                { id: 101, qty: 1 }, // Assalitore con l'Ascia
                { id: 296, qty: 2 }, // Eroe dell'Est
                { id: 108, qty: 1 }, // Guerriero da Battaglia
                { id: 435, qty: 1 }, // Soldato della Scienza
                { id: 369, qty: 1 }, // Masaki lo Spadaccino Leggendario
                { id: 535, qty: 1 }, // Guardia del Labirinto
                { id: 448, qty: 1 }, // Giudizio Solenne
                { id: 426, qty: 1 }, // Decreto Reale
                { id: 371, qty: 1 }, // Maschera della Restrizione
                { id: 655, qty: 1 }, // Maledizione di Anubis
                { id: 69, qty: 1 }, // Stop Difesa
                { id: 580, qty: 1 }, // Sogen
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 724, qty: 1 } // Rinforzo dell'Esercito
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 317, qty: 2 }, // Uomo Giudice
                { id: 943, qty: 2 }, // Garnecia Elefantis
                { id: 504, qty: 2 }, // Guerriero Dai Grepher
                { id: 330, qty: 2 }, // Kojikocy
                { id: 516, qty: 1 }, // Zanki
                { id: 541, qty: 2 }, // Ansatsu
                { id: 573, qty: 2 }, // D. Human
                { id: 944, qty: 2 }, // Hibikime
                { id: 101, qty: 1 }, // Assalitore con l'Ascia
                { id: 296, qty: 2 }, // Eroe dell'Est
                { id: 108, qty: 1 }, // Guerriero da Battaglia
                { id: 369, qty: 1 }, // Masaki lo Spadaccino Leggendario
                { id: 448, qty: 1 }, // Giudizio Solenne
                { id: 426, qty: 1 }, // Decreto Reale
                { id: 371, qty: 1 }, // Maschera della Restrizione
                { id: 655, qty: 1 }, // Maledizione di Anubis
                { id: 580, qty: 1 }, // Sogen
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 344, qty: 1 }, // Spada Leggendaria
                { id: 724, qty: 1 }, // Rinforzo dell'Esercito
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 7, qty: 1 } // Buco Nero
            ],
            extra: []
        }
    },

    // Nesbitt (Big Five), nella forma del Cavaliere Robotico: Macchine attorno al
    // Re Macchina, con Notte Meccanica per trasformare in Macchine anche i mostri avversari e
    // Ordini d'Attacco Finali a costringerli in Posizione d'Attacco (l'anime usa "Corto
    // Circuito", che il gioco non ha).
    nesbitt: {
        flagship: 359, // Re Macchina — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 359, qty: 2 }, // Re Macchina
                { id: 960, qty: 3 }, // Lumaca Meccanica
                { id: 264, qty: 3 }, // Lupo Giga-Tech
                { id: 170, qty: 3 }, // Comandante Cyber
                { id: 274, qty: 2 }, // Gradius
                { id: 1122, qty: 2 }, // Scorpione d'Acciaio
                { id: 257, qty: 2 }, // Golem Meccanico la Fortezza Mobile
                { id: 137, qty: 1 }, // Soldato Cannone
                { id: 994, qty: 1 }, // Cavaliere Robotico
                { id: 223, qty: 1 }, // Tartaruga Elettromagnetica
                { id: 153, qty: 1 }, // Notte Meccanica
                { id: 358, qty: 1 }, // Fabbrica di Conversione Meccanica
                { id: 350, qty: 1 }, // Rimozione del Limitatore
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 847, qty: 1 }, // Duplicazione Meccanica
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 359, qty: 2 }, // Re Macchina
                { id: 994, qty: 2 }, // Cavaliere Robotico
                { id: 957, qty: 1 }, // Guardiano della Sala del Trono
                { id: 137, qty: 2 }, // Soldato Cannone
                { id: 960, qty: 2 }, // Lumaca Meccanica
                { id: 978, qty: 1 }, // Grotta dell'Orco d'Acciaio #2
                { id: 929, qty: 1 }, // Grotta dell'Orco d'Acciaio #1
                { id: 975, qty: 2 }, // Overdrive
                { id: 987, qty: 1 }, // Soldato Gadget
                { id: 480, qty: 1 }, // Divoratempo
                { id: 264, qty: 2 }, // Lupo Giga-Tech
                { id: 997, qty: 1 }, // Inpachi
                { id: 675, qty: 1 }, // Tartaruga UFO
                { id: 394, qty: 1 }, // Carro Armato Oni T-34
                { id: 153, qty: 2 }, // Notte Meccanica
                { id: 358, qty: 1 }, // Fabbrica di Conversione Meccanica
                { id: 350, qty: 1 }, // Rimozione del Limitatore
                { id: 851, qty: 1 }, // Metalmorfosi Rara
                { id: 847, qty: 1 }, // Duplicazione Meccanica
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 240, qty: 1 }, // Ordini d'Attacco Finali
                { id: 646, qty: 1 } // Tempesta Pesante
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 359, qty: 2 }, // Re Macchina
                { id: 994, qty: 2 }, // Cavaliere Robotico
                { id: 957, qty: 1 }, // Guardiano della Sala del Trono
                { id: 137, qty: 2 }, // Soldato Cannone
                { id: 960, qty: 2 }, // Lumaca Meccanica
                { id: 978, qty: 2 }, // Grotta dell'Orco d'Acciaio #2
                { id: 929, qty: 1 }, // Grotta dell'Orco d'Acciaio #1
                { id: 975, qty: 2 }, // Overdrive
                { id: 987, qty: 2 }, // Soldato Gadget
                { id: 480, qty: 1 }, // Divoratempo
                { id: 264, qty: 2 }, // Lupo Giga-Tech
                { id: 997, qty: 1 }, // Inpachi
                { id: 153, qty: 2 }, // Notte Meccanica
                { id: 358, qty: 1 }, // Fabbrica di Conversione Meccanica
                { id: 350, qty: 1 }, // Rimozione del Limitatore
                { id: 851, qty: 1 }, // Metalmorfosi Rara
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 240, qty: 1 }, // Ordini d'Attacco Finali
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 177, qty: 1 } // Alligatore Cyber-Tecnologico
            ],
            extra: []
        }
    },

    // Crump (Big Five), nella forma di Pinguino Incubo: il suo mazzo Pinguini/ACQUA
    // del duello sugli iceberg contro Téa — Gigantesco Serpente di Mare Rosso e Pinguino Volante
    // (che l'anime gli mostra potenziati dal Deck Master), Soldato Pinguino, Cavaliere Pinguino,
    // con Umi e l'Ondata Gelida del mare ghiacciato.
    crump: {
        flagship: 260, // Gigantesco Serpente di Mare Rosso — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 260, qty: 2 }, // Gigantesco Serpente di Mare Rosso
                { id: 1088, qty: 3 }, // Cavaliere Pinguino
                { id: 126, qty: 3 }, // Pinguino Fulmine
                { id: 250, qty: 3 }, // Pinguino Volante
                { id: 592, qty: 1 }, // Soldato Pinguino
                { id: 582, qty: 2 }, // Tartaruga Isola
                { id: 935, qty: 2 }, // Tigre Tartaruga
                { id: 904, qty: 1 }, // Stella Marina Corazzata
                { id: 247, qty: 1 }, // Pesce Volante
                { id: 945, qty: 1 }, // Hyosube
                { id: 958, qty: 1 }, // Gyojin dell'Alta Marea
                { id: 497, qty: 1 }, // Umi
                { id: 159, qty: 1 }, // Ondata Gelida
                { id: 791, qty: 1 }, // Coro Acquatico
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 704, qty: 1 }, // Salvataggio
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 260, qty: 2 }, // Gigantesco Serpente di Mare Rosso
                { id: 592, qty: 3 }, // Soldato Pinguino
                { id: 1088, qty: 2 }, // Cavaliere Pinguino
                { id: 250, qty: 2 }, // Pinguino Volante
                { id: 126, qty: 2 }, // Pinguino Fulmine
                { id: 956, qty: 1 }, // Tartaruga Gigante che si Nutre di Fiamme
                { id: 702, qty: 1 }, // Mobius il Monarca del Gelo
                { id: 582, qty: 2 }, // Tartaruga Isola
                { id: 940, qty: 1 }, // Abitante degli Abissi
                { id: 583, qty: 1 }, // Pesce dai 7 Colori
                { id: 935, qty: 1 }, // Tigre Tartaruga
                { id: 928, qty: 1 }, // Seadra Spinoso
                { id: 958, qty: 1 }, // Gyojin dell'Alta Marea
                { id: 497, qty: 1 }, // Umi
                { id: 159, qty: 1 }, // Ondata Gelida
                { id: 79, qty: 1 }, // Un Oceano Leggendario
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 791, qty: 1 }, // Coro Acquatico
                { id: 704, qty: 1 }, // Salvataggio
                { id: 595, qty: 1 } // Il Guardiano Affidabile
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 260, qty: 2 }, // Gigantesco Serpente di Mare Rosso
                { id: 592, qty: 3 }, // Soldato Pinguino
                { id: 1088, qty: 2 }, // Cavaliere Pinguino
                { id: 250, qty: 2 }, // Pinguino Volante
                { id: 126, qty: 2 }, // Pinguino Fulmine
                { id: 956, qty: 1 }, // Tartaruga Gigante che si Nutre di Fiamme
                { id: 702, qty: 2 }, // Mobius il Monarca del Gelo
                { id: 582, qty: 1 }, // Tartaruga Isola
                { id: 940, qty: 1 }, // Abitante degli Abissi
                { id: 583, qty: 1 }, // Pesce dai 7 Colori
                { id: 928, qty: 1 }, // Seadra Spinoso
                { id: 958, qty: 1 }, // Gyojin dell'Alta Marea
                { id: 497, qty: 1 }, // Umi
                { id: 159, qty: 1 }, // Ondata Gelida
                { id: 79, qty: 1 }, // Un Oceano Leggendario
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 791, qty: 1 }, // Coro Acquatico
                { id: 704, qty: 1 }, // Salvataggio
                { id: 692, qty: 1 }, // Guerriero del Serpente Marino dell'Oscurità
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 419, qty: 1 } // Anello della Distruzione
            ],
            extra: []
        }
    },

    // Leichter (Big Five), nella forma di Jinzo: il mazzo di blocco e Life Points
    // del duello contro Kaiba — Jinzo che spegne le Trappole, Iniezione della Fata Giglio che
    // paga Life Points per diventare enorme, e il Cancellatore di Magie al posto dell'Ordine
    // Imperiale (che il gioco non ha) per spegnere anche le Magie; Offerta Suprema, Messaggero
    // della Pace e carte che bruciano Life Points.
    lector: {
        flagship: 17, // Jinzo — carta simbolo: stessa quantità in tutti e tre i livelli
        easy: {
            main: [
                { id: 17, qty: 2 }, // Jinzo
                { id: 1009, qty: 3 }, // Jinzo #7
                { id: 960, qty: 3 }, // Lumaca Meccanica
                { id: 274, qty: 2 }, // Gradius
                { id: 129, qty: 2 }, // Bowganian
                { id: 170, qty: 2 }, // Comandante Cyber
                { id: 1122, qty: 2 }, // Scorpione d'Acciaio
                { id: 223, qty: 1 }, // Tartaruga Elettromagnetica
                { id: 174, qty: 1 }, // Predone Cyber
                { id: 941, qty: 1 }, // Mago del Disco
                { id: 264, qty: 1 }, // Lupo Giga-Tech
                { id: 559, qty: 1 }, // Offerta Suprema
                { id: 546, qty: 2 }, // Dian Keto la Maestra delle Cure
                { id: 297, qty: 1 }, // Hinotama
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 2 }, // Nega Attacco
                { id: 434, qty: 2 }, // Capro Espiatorio
                { id: 503, qty: 1 }, // Waboku
                { id: 143, qty: 2 }, // Mura del Castello
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 1 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 595, qty: 1 }, // Il Guardiano Affidabile
                { id: 439, qty: 1 }, // Incantesimo Ombra
                { id: 631, qty: 1 }, // Megamorfosi
                { id: 875, qty: 1 } // Libro della Luna
            ],
            extra: []
        },
        medium: {
            main: [
                { id: 17, qty: 2 }, // Jinzo
                { id: 889, qty: 2 }, // Iniezione della Fata Giglio
                { id: 455, qty: 1 }, // Cancellatore di Magie
                { id: 1009, qty: 2 }, // Jinzo #7
                { id: 480, qty: 1 }, // Divoratempo
                { id: 960, qty: 2 }, // Lumaca Meccanica
                { id: 174, qty: 2 }, // Predone Cyber
                { id: 223, qty: 1 }, // Tartaruga Elettromagnetica
                { id: 176, qty: 2 }, // Soldato Cyber del Mondo Oscuro
                { id: 941, qty: 1 }, // Mago del Disco
                { id: 373, qty: 1 }, // MechanicalChaser
                { id: 401, qty: 1 }, // Macchina a Pendolo
                { id: 274, qty: 1 }, // Gradius
                { id: 129, qty: 1 }, // Bowganian
                { id: 559, qty: 1 }, // Offerta Suprema
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 577, qty: 1 }, // Giusto Dessert
                { id: 297, qty: 1 }, // Hinotama
                { id: 158, qty: 1 }, // Venditore di Bare
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 143, qty: 1 }, // Mura del Castello
                { id: 631, qty: 1 }, // Megamorfosi
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 880, qty: 1 } // Messaggero della Pace
            ],
            extra: []
        },
        hard: {
            main: [
                { id: 17, qty: 2 }, // Jinzo
                { id: 889, qty: 2 }, // Iniezione della Fata Giglio
                { id: 455, qty: 1 }, // Cancellatore di Magie
                { id: 1009, qty: 1 }, // Jinzo #7
                { id: 480, qty: 2 }, // Divoratempo
                { id: 960, qty: 2 }, // Lumaca Meccanica
                { id: 174, qty: 2 }, // Predone Cyber
                { id: 223, qty: 1 }, // Tartaruga Elettromagnetica
                { id: 176, qty: 2 }, // Soldato Cyber del Mondo Oscuro
                { id: 941, qty: 1 }, // Mago del Disco
                { id: 373, qty: 1 }, // MechanicalChaser
                { id: 401, qty: 2 }, // Macchina a Pendolo
                { id: 129, qty: 1 }, // Bowganian
                { id: 559, qty: 1 }, // Offerta Suprema
                { id: 546, qty: 1 }, // Dian Keto la Maestra delle Cure
                { id: 577, qty: 1 }, // Giusto Dessert
                { id: 158, qty: 1 }, // Venditore di Bare
                { id: 35, qty: 1 }, // Rinascita del Mostro
                { id: 36, qty: 2 }, // Vaso dell'Avidità
                { id: 272, qty: 1 }, // Carità Aggraziata
                { id: 40, qty: 1 }, // Buco Trappola
                { id: 793, qty: 1 }, // Armatura Sakuretsu
                { id: 7, qty: 1 }, // Buco Nero
                { id: 8, qty: 1 }, // Spada Rivelatrice
                { id: 820, qty: 1 }, // Nega Attacco
                { id: 10, qty: 1 }, // Cilindro Magico
                { id: 434, qty: 1 }, // Capro Espiatorio
                { id: 631, qty: 1 }, // Megamorfosi
                { id: 646, qty: 1 }, // Tempesta Pesante
                { id: 880, qty: 1 }, // Messaggero della Pace
                { id: 382, qty: 1 }, // Forza dello Specchio
                { id: 707, qty: 1 } // Legame di Gravità
            ],
            extra: []
        }
    }
};

// Rare Hunters di Battle City. Le liste restano esplicite per livello come
// il resto del roster: Seeker accelera Exodia; Strings costruisce il ciclo
// Melma/Carte Infinite e riceve Slifer solo a Difficile; Lumis privilegia
// Magie/Trappole Maschera, mentre Umbra schiera più mostri per il Rituale.
characterDeckDatabase.seeker = {
    flagship: 41,
    easy: { main: [
        { id: 41, qty: 1 }, { id: 11, qty: 1 }, { id: 42, qty: 1 }, { id: 43, qty: 1 }, { id: 44, qty: 1 },
        { id: 54, qty: 3 }, { id: 261, qty: 3 }, { id: 391, qty: 3 }, { id: 115, qty: 2 },
        { id: 257, qty: 3 }, { id: 758, qty: 3 }, { id: 759, qty: 3 }, { id: 433, qty: 2 },
        { id: 8, qty: 2 }, { id: 750, qty: 2 }, { id: 503, qty: 2 }, { id: 143, qty: 2 },
        { id: 36, qty: 1 }, { id: 272, qty: 1 }, { id: 35, qty: 1 }, { id: 307, qty: 1 }, { id: 141, qty: 1 }
    ], extra: [] },
    medium: { main: [
        { id: 41, qty: 1 }, { id: 11, qty: 1 }, { id: 42, qty: 1 }, { id: 43, qty: 1 }, { id: 44, qty: 1 },
        { id: 54, qty: 3 }, { id: 261, qty: 3 }, { id: 115, qty: 2 }, { id: 257, qty: 3 },
        { id: 758, qty: 3 }, { id: 433, qty: 2 }, { id: 508, qty: 2 },
        { id: 8, qty: 2 }, { id: 750, qty: 2 }, { id: 503, qty: 2 }, { id: 143, qty: 2 },
        { id: 36, qty: 2 }, { id: 272, qty: 2 }, { id: 307, qty: 1 }, { id: 141, qty: 1 },
        { id: 35, qty: 1 }, { id: 820, qty: 1 }, { id: 620, qty: 1 }
    ], extra: [] },
    hard: { main: [
        { id: 41, qty: 1 }, { id: 11, qty: 1 }, { id: 42, qty: 1 }, { id: 43, qty: 1 }, { id: 44, qty: 1 },
        { id: 54, qty: 3 }, { id: 115, qty: 2 }, { id: 257, qty: 2 }, { id: 758, qty: 3 },
        { id: 433, qty: 3 }, { id: 508, qty: 3 },
        { id: 8, qty: 1 }, { id: 750, qty: 2 }, { id: 503, qty: 1 },
        { id: 36, qty: 3 }, { id: 272, qty: 3 }, { id: 307, qty: 2 }, { id: 141, qty: 2 },
        { id: 35, qty: 1 }, { id: 820, qty: 1 }, { id: 409, qty: 1 },
        { id: 7, qty: 1 }, { id: 10, qty: 1 }
    ], extra: [] }
};

characterDeckDatabase.strings = {
    flagship: 1089,
    easy: { main: [
        { id: 1089, qty: 3 }, { id: 302, qty: 3 }, { id: 509, qty: 3 }, { id: 765, qty: 3 },
        { id: 582, qty: 3 }, { id: 96, qty: 3 }, { id: 391, qty: 3 }, { id: 433, qty: 2 }, { id: 602, qty: 2 },
        { id: 8, qty: 1 }, { id: 750, qty: 2 }, { id: 503, qty: 2 }, { id: 143, qty: 2 },
        { id: 141, qty: 2 }, { id: 307, qty: 2 }, { id: 36, qty: 1 }, { id: 272, qty: 1 },
        { id: 35, qty: 1 }, { id: 820, qty: 1 }
    ], extra: [] },
    medium: { main: [
        { id: 1089, qty: 3 }, { id: 302, qty: 3 }, { id: 509, qty: 3 }, { id: 765, qty: 2 },
        { id: 582, qty: 2 }, { id: 96, qty: 2 }, { id: 391, qty: 2 }, { id: 433, qty: 2 }, { id: 602, qty: 2 },
        { id: 8, qty: 1 }, { id: 750, qty: 2 }, { id: 503, qty: 2 }, { id: 143, qty: 1 },
        { id: 141, qty: 3 }, { id: 307, qty: 1 }, { id: 36, qty: 2 }, { id: 272, qty: 2 },
        { id: 35, qty: 1 }, { id: 820, qty: 1 }, { id: 38, qty: 2 }, { id: 6, qty: 1 }
    ], extra: [{ id: 303, qty: 2 }] },
    hard: { main: [
        { id: 31, qty: 1 }, { id: 1089, qty: 3 }, { id: 302, qty: 3 }, { id: 509, qty: 3 },
        { id: 765, qty: 2 }, { id: 582, qty: 2 }, { id: 96, qty: 2 }, { id: 433, qty: 2 }, { id: 602, qty: 2 },
        { id: 8, qty: 1 }, { id: 750, qty: 2 }, { id: 503, qty: 1 }, { id: 141, qty: 3 },
        { id: 307, qty: 3 }, { id: 36, qty: 2 }, { id: 272, qty: 2 }, { id: 35, qty: 1 },
        { id: 820, qty: 1 }, { id: 38, qty: 1 }, { id: 6, qty: 1 }, { id: 7, qty: 1 }, { id: 10, qty: 1 }
    ], extra: [{ id: 303, qty: 3 }] }
};

characterDeckDatabase.lumis = {
    flagship: 167,
    easy: { main: [
        { id: 167, qty: 1 }, { id: 602, qty: 3 }, { id: 483, qty: 3 }, { id: 644, qty: 2 },
        { id: 54, qty: 3 }, { id: 391, qty: 3 }, { id: 261, qty: 3 }, { id: 433, qty: 2 },
        { id: 168, qty: 1 }, { id: 370, qty: 3 }, { id: 371, qty: 2 }, { id: 372, qty: 3 },
        { id: 8, qty: 2 }, { id: 750, qty: 2 }, { id: 503, qty: 2 }, { id: 143, qty: 2 },
        { id: 820, qty: 1 }, { id: 36, qty: 1 }, { id: 272, qty: 1 }
    ], extra: [] },
    medium: { main: [
        { id: 167, qty: 1 }, { id: 602, qty: 3 }, { id: 483, qty: 3 }, { id: 644, qty: 3 },
        { id: 54, qty: 2 }, { id: 391, qty: 2 }, { id: 261, qty: 2 }, { id: 433, qty: 2 },
        { id: 168, qty: 2 }, { id: 370, qty: 3 }, { id: 371, qty: 3 }, { id: 372, qty: 3 },
        { id: 8, qty: 1 }, { id: 750, qty: 2 }, { id: 503, qty: 1 }, { id: 143, qty: 1 },
        { id: 820, qty: 1 }, { id: 36, qty: 2 }, { id: 272, qty: 1 }, { id: 35, qty: 1 }, { id: 620, qty: 1 }
    ], extra: [] },
    hard: { main: [
        { id: 167, qty: 1 }, { id: 602, qty: 3 }, { id: 483, qty: 3 }, { id: 644, qty: 3 },
        { id: 54, qty: 2 }, { id: 433, qty: 2 }, { id: 508, qty: 2 },
        { id: 168, qty: 3 }, { id: 370, qty: 3 }, { id: 371, qty: 3 }, { id: 372, qty: 3 },
        { id: 8, qty: 1 }, { id: 750, qty: 1 }, { id: 503, qty: 1 }, { id: 820, qty: 1 },
        { id: 36, qty: 2 }, { id: 272, qty: 2 }, { id: 35, qty: 1 }, { id: 620, qty: 1 },
        { id: 7, qty: 1 }, { id: 10, qty: 1 }
    ], extra: [] }
};

characterDeckDatabase.umbra = {
    flagship: 167,
    easy: { main: [
        { id: 167, qty: 1 }, { id: 602, qty: 3 }, { id: 483, qty: 2 }, { id: 644, qty: 3 },
        { id: 54, qty: 3 }, { id: 391, qty: 3 }, { id: 261, qty: 3 }, { id: 433, qty: 2 },
        { id: 758, qty: 3 }, { id: 759, qty: 3 },
        { id: 168, qty: 1 }, { id: 370, qty: 2 }, { id: 371, qty: 2 }, { id: 372, qty: 2 },
        { id: 8, qty: 2 }, { id: 503, qty: 2 }, { id: 143, qty: 2 }, { id: 820, qty: 1 }
    ], extra: [] },
    medium: { main: [
        { id: 167, qty: 1 }, { id: 602, qty: 3 }, { id: 483, qty: 2 }, { id: 644, qty: 3 },
        { id: 54, qty: 2 }, { id: 261, qty: 2 }, { id: 433, qty: 2 }, { id: 758, qty: 3 }, { id: 759, qty: 3 },
        { id: 168, qty: 2 }, { id: 370, qty: 2 }, { id: 371, qty: 2 }, { id: 372, qty: 2 },
        { id: 8, qty: 1 }, { id: 750, qty: 2 }, { id: 503, qty: 1 }, { id: 143, qty: 1 },
        { id: 820, qty: 1 }, { id: 36, qty: 2 }, { id: 272, qty: 2 }, { id: 35, qty: 1 }
    ], extra: [] },
    hard: { main: [
        { id: 167, qty: 1 }, { id: 602, qty: 3 }, { id: 483, qty: 2 }, { id: 644, qty: 3 },
        { id: 54, qty: 2 }, { id: 433, qty: 2 }, { id: 508, qty: 2 }, { id: 758, qty: 2 }, { id: 759, qty: 2 },
        { id: 168, qty: 3 }, { id: 370, qty: 2 }, { id: 371, qty: 2 }, { id: 372, qty: 2 },
        { id: 8, qty: 1 }, { id: 750, qty: 2 }, { id: 503, qty: 1 }, { id: 820, qty: 1 },
        { id: 36, qty: 2 }, { id: 272, qty: 2 }, { id: 35, qty: 1 }, { id: 7, qty: 1 }, { id: 10, qty: 1 }
    ], extra: [] }
};

// Nel finale di Forbidden Memories DarkNite rivela la vera forma Nitemare.
// Prima i due duelli puntavano allo stesso id e quindi allo stesso mazzo.
// La copia profonda rende i tre livelli indipendenti: il futuro superboss
// Nitemare puo' essere bilanciato senza alterare il primo scontro DarkNite.
characterDeckDatabase.nitemare = JSON.parse(JSON.stringify(characterDeckDatabase.darkNite));

// Bilanciamento mirato dei soli avversari Difficili. Le liste Facile e
// Medio restano intatte: qui si sostituiscono carte a parita' di totale,
// senza alterare Starter/Structure o introdurre bonus nascosti nel motore.
function ritoccaDeckHard(personaggio, rimosse, aggiunte) {
    const main = characterDeckDatabase[personaggio].hard.main;
    Object.entries(rimosse).forEach(([idTesto, qty]) => {
        const id = Number(idTesto);
        const voce = main.find((c) => c.id === id);
        if (!voce || voce.qty < qty) throw new Error(`Ritocco ${personaggio}: impossibile rimuovere ${qty}x ${id}`);
        voce.qty -= qty;
    });
    for (let i = main.length - 1; i >= 0; i--) if (main[i].qty === 0) main.splice(i, 1);
    Object.entries(aggiunte).forEach(([idTesto, qty]) => {
        const id = Number(idTesto);
        const voce = main.find((c) => c.id === id);
        if (voce) voce.qty += qty;
        else main.push({ id, qty });
    });
    if (main.reduce((totale, c) => totale + c.qty, 0) !== 40) {
        throw new Error(`Ritocco ${personaggio}: il Main Deck non contiene 40 carte`);
    }
}

// Yugi usa i cercatori per proteggere e riunire Exodia, invece di pescare
// troppi mostri normali deboli. Rimane il giovane Yugi del mazzo del nonno.
ritoccaDeckHard('yugiMuto',
    { 109: 1, 237: 1, 391: 1, 28: 1, 206: 1, 143: 1, 55: 1, 56: 1 },
    { 433: 2, 508: 2, 409: 1, 503: 1, 36: 1, 820: 1 });

// Bakura accelera la strategia Demone/Destiny Board e dispone di una sola
// rimozione globale aggiuntiva, senza trasformarsi in un mazzo generico.
ritoccaDeckHard('bakura',
    { 25: 2, 591: 2, 984: 2 },
    { 259: 1, 1118: 1, 192: 1, 409: 1, 503: 1, 36: 1 });

// Gozaburo sacrifica quattro muri/attaccanti per rendere affidabile il vero
// piano mostrato nell'anime: spedire i cinque pezzi e chiamare Necross.
ritoccaDeckHard('gozaburo',
    { 337: 2, 375: 2 },
    { 409: 2, 36: 1, 272: 1 });

// Noah concentra il livello Difficile sui Mostri Spirito del suo duello,
// riducendo il frammento preistorico della sua simulazione virtuale.
ritoccaDeckHard('noah',
    { 367: 1, 266: 2, 150: 2, 1002: 2, 1006: 1 },
    { 1007: 1, 1001: 1, 884: 1, 409: 1, 503: 1, 36: 1, 272: 1, 147: 1 });

// Heishin e' il penultimo grande ostacolo: piu' potere Demone e controllo,
// ma conserva una distanza netta dalla forma finale di Nitemare.
ritoccaDeckHard('heishin',
    { 237: 2, 428: 2, 12: 2, 518: 1, 517: 1, 38: 1 },
    { 409: 2, 36: 2, 272: 2, 130: 2, 503: 1 });

// Nitemare e' volutamente il superboss assoluto. Parte dal tema
// Drago/Demone di DarkNite, ma la forma finale elimina quasi tutti i mostri
// intermedi e porta al limite legale pescata, rinascita e rimozione.
ritoccaDeckHard('nitemare',
    { 12: 2, 1125: 1, 932: 2, 13: 1, 518: 1, 436: 1, 331: 2, 642: 1, 38: 1, 517: 1 },
    { 493: 1, 502: 1, 335: 1, 36: 2, 272: 2, 409: 1, 17: 2, 130: 3 });

// ================================================================
// REGOLE DEI TRE LIVELLI — verificate carta per carta su ogni mazzo
// ================================================================
// Scritte qui, accanto ai mazzi, e non solo nei test: sono la
// definizione di cosa vuol dire "Facile", "Normale" e "Difficile" in
// questo gioco, e chi aggiunge un Duellante deve poterle leggere e
// rispettare senza andare a cercarle altrove. Il test
// tests/specs/mazzi-livello-facile.spec.js chiama validaMazzoPersonaggio
// su OGNI mazzo di OGNI personaggio: un mazzo che le viola non passa.
//
// Nascono da una correzione esplicita dell'utente, dopo che una prima
// versione (trasformazioni automatiche del mazzo base) aveva prodotto
// un Facile di Kaiba con tre Armature Sakuretsu, pieno di mostri da
// Tributo e senza carte difensive: "per tutti i deck facili evita carte
// che distruggono mostri, al massimo 1 copia di una carta che distrugge",
// mostri scarsi in prevalenza, niente 1800/1900, e carte come Spada
// Rivelatrice e Nega Attacco al posto di Forza dello Specchio.
//
// ECCEZIONE: i mazzi marcati `congelato: true` (quelli della Grande
// Guerra) restano come sono per richiesta esplicita dell'utente e non
// sono soggetti a queste regole.

/**
 * Carte che DISTRUGGONO MOSTRI, per effetto (Magie, Trappole e mostri
 * con un effetto di distruzione). Elenco scritto a mano, non dedotto dal
 * testo: una regola "contiene distrugg" sbaglia in entrambi i sensi
 * (Piumino delle Arpie distrugge solo Magie/Trappole; il Ragno della
 * Roulette distrugge l'attaccante solo con un 6 su sei facce e resta
 * fuori di proposito). Quando si aggiunge una carta di rimozione al
 * dataset, va aggiunta anche qui.
 */
const CARTE_CHE_DISTRUGGONO_MOSTRI = [
    7, 23, 28, 37, 40, 77, 100, 104, 128, 132, 134, 146, 173, 210, 220, 228, 229,
    243, 267, 289, 300, 315, 366, 382, 388, 409, 419, 448, 453, 474, 490, 492, 498,
    548, 598, 624, 632, 641, 663, 697, 705, 715, 718, 720, 729, 793, 795, 817,
    1024, 1033, 1055, 1057, 1075, 1077, 1078, 1086, 1102, 1200, 1222, 1248
];

/**
 * Carte DIFENSIVE non distruttive: fermano o ammorbidiscono un attacco,
 * riducono l'ATK, alzano la DEF, curano. Sono la risposta che il livello
 * Facile usa al posto delle rimozioni (la Spada Rivelatrice è la prima
 * della lista: l'utente l'ha chiesta esplicitamente).
 */
const CARTE_DIFENSIVE = [
    8, 820, 503, 143, 434, 439, 620, 595, 875, 383, 232, 445, 622, 819, 750, 312,
    333, 849, 489, 546, 148, 151, 611, 263, 655, 206
];

/** Le quattro rimozioni generiche più forti: mai più di 1 copia ciascuna, a nessun livello. */
const RIMOZIONI_GENERICHE = [7, 10, 40, 382];

/** Gli Dei Egizi, e a chi appartengono (una copia, solo in Difficile). */
const CARTE_DIVINE = [30, 31, 472];
const DIVINITA_DEL_PERSONAGGIO = { kaiba: 30, yamiYugi: 31, strings: 31, marik: 472 };
/**
 * Chi il Dio lo è: Roberto Giacobbo I ("Divinità egizia", il boss
 * easter egg della campagna Freedom) ha Ra come carta simbolo, quindi
 * una copia in OGNI livello — non solo in Difficile.
 */
const DIVINITA_IN_OGNI_LIVELLO = { robertoGiacobbo: 472 };

const SPADA_RIVELATRICE = 8;
const NEGA_ATTACCO = 820;

const REGOLE_PER_LIVELLO = {
    easy: {
        maxDistrugge: 1,
        maxGrossi: 4,
        minDifensive: 4,
        // Forza dello Specchio, Cilindro Magico, Legame di Gravità,
        // Messaggero della Pace, Tributo Torrenziale: troppo punitive per
        // chi sta imparando.
        vietate: [382, 10, 707, 880, 490],
        atkVietati: [1800, 1900],
        deboliPrevalenti: true,
        serveSpadaRivelatrice: true
    },
    medium: {
        maxDistrugge: 3,
        maxGrossi: 9,
        minDifensive: 2,
        vietate: [382],
        serveUnaTra: [SPADA_RIVELATRICE, NEGA_ATTACCO]
    },
    hard: {
        maxDistrugge: 6,
        maxGrossi: 11,
        minDifensive: 1
    }
};

/** Sotto (o a) questo ATK un mostro conta come "debole": "800, 1300 ecc", parole dell'utente. */
const ATK_MOSTRO_DEBOLE = 1300;

/**
 * Controlla UN mazzo di UN personaggio a UN livello. `cercaCarta(id)`
 * torna la carta (così la funzione va bene sia nel gioco sia negli
 * script Node). Torna { problemi: [...], stat: {...} }.
 */
function validaMazzoPersonaggio(personaggioId, livello, mazzo, flagshipId, cercaCarta) {
    const problemi = [];
    const regole = REGOLE_PER_LIVELLO[livello];
    const main = mazzo.main || [];
    const extra = mazzo.extra || [];
    const carta = (id) => cercaCarta(id);

    const totale = main.reduce((s, e) => s + e.qty, 0);
    if (totale !== 40) problemi.push(`il mazzo ha ${totale} carte invece di 40`);

    const origini = {};
    main.forEach((e) => {
        const c = carta(e.id);
        if (!c) { problemi.push(`id ${e.id} inesistente`); return; }
        if (e.qty < 1 || e.qty > 3) problemi.push(`${c.name}: ${e.qty} copie`);
        if (c.extraDeck) problemi.push(`${c.name} è una carta da Extra Deck ma sta nel mazzo principale`);
        const o = c.origin || 'yu-gi-oh';
        origini[o] = (origini[o] || 0) + e.qty;
    });
    extra.forEach((e) => {
        const c = carta(e.id);
        if (!c) { problemi.push(`extra: id ${e.id} inesistente`); return; }
        if (!c.extraDeck) problemi.push(`extra: ${c.name} non è una carta da Extra Deck`);
    });
    const origine = Object.keys(origini).sort((a, b) => origini[b] - origini[a])[0] || 'yu-gi-oh';
    if (Object.keys(origini).length > 1) problemi.push(`mescola carte di set diversi (${Object.keys(origini).join(', ')})`);

    const qty = (id) => main.filter((e) => e.id === id).reduce((s, e) => s + e.qty, 0);
    const soglia = ATK_MOSTRO_DEBOLE;
    let mostri = 0, deboli = 0, forti = 0, grossi = 0, distrugge = 0, difensive = 0;
    main.forEach((e) => {
        const c = carta(e.id);
        if (!c) return;
        if (c.type === 'monster') {
            mostri += e.qty;
            if ((c.level || 0) >= 5) grossi += e.qty;
            if (e.id !== flagshipId) {
                if ((c.attack || 0) <= soglia) deboli += e.qty; else forti += e.qty;
                if (regole.atkVietati && regole.atkVietati.includes(c.attack)) problemi.push(`${c.name} ha ${c.attack} ATK (vietato a questo livello)`);
            }
        }
        if (CARTE_CHE_DISTRUGGONO_MOSTRI.includes(e.id) && e.id !== flagshipId) distrugge += e.qty;
        if (CARTE_DIFENSIVE.includes(e.id)) difensive += e.qty;
    });

    RIMOZIONI_GENERICHE.forEach((id) => { if (qty(id) > 1) problemi.push(`${carta(id).name} in ${qty(id)} copie (massimo 1)`); });
    if (flagshipId && qty(flagshipId) === 0) problemi.push('manca la carta simbolo del personaggio');

    const divinaAttesa = DIVINITA_IN_OGNI_LIVELLO[personaggioId]
        || (livello === 'hard' ? DIVINITA_DEL_PERSONAGGIO[personaggioId] : undefined);
    CARTE_DIVINE.forEach((id) => {
        const q = qty(id);
        if (id === divinaAttesa) { if (q !== 1) problemi.push(`serve esattamente 1 ${carta(id).name} (ne ha ${q})`); }
        else if (q > 0) problemi.push(`${carta(id).name} non appartiene a questo mazzo/livello`);
    });

    if (distrugge > regole.maxDistrugge) problemi.push(`${distrugge} carte che distruggono mostri (massimo ${regole.maxDistrugge})`);
    if (grossi > regole.maxGrossi) problemi.push(`${grossi} mostri di Livello 5+ (massimo ${regole.maxGrossi})`);
    if (difensive < regole.minDifensive) problemi.push(`solo ${difensive} carte difensive (minimo ${regole.minDifensive})`);
    (regole.vietate || []).forEach((id) => { if (qty(id) > 0) problemi.push(`${carta(id).name} vietata a questo livello`); });
    if (regole.deboliPrevalenti && forti > 0 && deboli <= forti) problemi.push(`mostri deboli non prevalenti (${deboli} deboli contro ${forti} più forti)`);
    if (origine === 'yu-gi-oh') {
        if (regole.serveSpadaRivelatrice && qty(SPADA_RIVELATRICE) === 0) problemi.push('manca la Spada Rivelatrice');
        if (regole.serveUnaTra && !regole.serveUnaTra.some((id) => qty(id) > 0)) problemi.push('manca sia la Spada Rivelatrice sia Nega Attacco');
    }

    return { problemi: problemi, stat: { totale, mostri, deboli, forti, grossi, distrugge, difensive, origine } };
}

/**
 * Il mazzo di un Duellante al livello richiesto ('easy', 'medium',
 * 'hard' — vedi gameState.botDifficulty in js/engine/game-flow.js).
 * Senza livello (o con uno sconosciuto) torna il Normale. null se il
 * Duellante non ha un mazzo (es. 'mirror', che usa il mazzo del giocatore).
 */
function getCharacterDeck(characterId, difficulty) {
    const personaggio = characterDeckDatabase[characterId];
    if (!personaggio) return null;
    const livello = (difficulty === 'easy' || difficulty === 'hard') ? difficulty : 'medium';
    return personaggio[livello];
}

/** Somma tutte le quantità di una lista { id, qty } */
function deckListCount(list) {
    return (list || []).reduce((sum, entry) => sum + entry.qty, 0);
}
