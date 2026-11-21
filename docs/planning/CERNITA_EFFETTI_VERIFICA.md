# Verifica per esecuzione del bacino degli effetti

Generato da `node tools/cernita-effetti.js --verifica --partite 1500 --seme 880000`.

Il bacino (gruppi A + B della cernita, 539 carte) e' stato giocato in **due mondi** con gli stessi mazzi e gli stessi semi:
1. il gioco com'e';
2. il **mondo del clone**: nel database restano solo le carte del bacino, con **id nuovi e nomi inventati**; le carte Yu-Gi-Oh only non esistono.
Entrambi i posti sono l'IA al livello Difficile; i mazzi sono 40 carte del bacino pescate a caso (14 mostri Liv. 1-4, 4 Liv. 5-6, 2 Liv. 7+, 11 Magie, 9 Trappole).

## Risultato
- Coppie di partite: **1500**; **identiche** nei due mondi (stesso registro riga per riga, stesso esito, turno e Life Points): **1498**.
- Partite **diverse**: **2**; partite interrotte da un errore: 0; arrivate al limite di turni: 51.
- Errori lanciati dalle carte: **0**; invarianti rotte: **0**.
- Carte con un effetto che **non sono mai partite** nel mondo del clone: **66** su 467.

## Carte che si comportano diversamente nei due mondi (piu' partite diverse in cui il loro effetto ha contato diversamente)
- 7 Buco Nero (1)
- 100 Armatura Guida d'Attacco (1)
- 195 Annulla Carta Magia (1)
- 219 Tornado di Polvere (1)
- 225 Luce dell'Elfo (1)
- 272 Carità Graziosa (1)
- 276 Predatore delle Tombe (1)
- 300 Corno del Paradiso (1)
- 445 Dadi del Teschio (1)
- 451 Scambio di Anime (1)
- 452 Rilascio delle Anime (1)
- 465 Le Truppe A. (1)
- 471 L'Amazzone Scorbutica (1)
- 503 Waboku (1)
- 601 Uccello Sonico (1)
- 707 Legame Gravitazionale (1)
- 818 Onda d'Urto Sismica (1)
- 1106 Bambino Vampiro (1)

Nota: una differenza puo' venire anche dall'**IA**, che in alcuni punti guarda id e nomi (vedi `CERNITA_EFFETTI_GENERICI.md`), non solo dalla carta.

## Prime partite diverse
- seme 880472, riga 580
  - originale: 🦠 Virus Infetta-Tribù scarta Spirito delle Fiamme, dichiara "Alpini" e distrugge 0 mostri!
  - travestito: 🦠 Virus Infetta-Tribù scarta Spirito delle Fiamme, dichiara "Bestia" e distrugge 0 mostri!
  - carte con conteggi diversi: 
- seme 880922, riga 199
  - originale: 🛡️ Hai attivato Legame Gravitazionale in risposta!
  - travestito: 🛡️ Hai attivato Predatore delle Tombe in risposta!
  - carte con conteggi diversi: 7 Buco Nero, 707 Legame Gravitazionale, 276 Predatore delle Tombe, 471 L'Amazzone Scorbutica, 503 Waboku, 225 Luce dell'Elfo, 195 Annulla Carta Magia, 451 Scambio di Anime

## Effetti mai partiti nel mondo del clone
- 104 Drago Revolver (monster; ganci: activate)
- 111 Anima Furente (spell/quick-play; ganci: activate)
- 137 Soldato-Cannone (monster; ganci: activate)
- 144 Tartaruga Catapulta (monster; ganci: activate)
- 150 Chiron il Saggio (monster; ganci: activate)
- 199 Esplosione a Onde Soniche (spell/normal; ganci: activate)
- 200 Dado Dimensionale (spell/normal; ganci: activate)
- 221 Ectoplasmatore (spell/continuous; ganci: activate, onEndPhase)
- 227 Risucchio di Energia (trap/normal; ganci: activate)
- 238 Giara di Fibra (monster; ganci: onFlip)
- 241 Principessa del Fuoco (monster; ganci: onGainLifePoints)
- 244 Crepuscolo a Cinque Stelle (spell/normal; ganci: activate)
- 257 Golem-Ingranaggio, la Fortezza Movente (monster; ganci: activate)
- 312 Teletrasportatore (trap/normal; ganci: activate)
- 351 Piccola-Guardialata (monster; ganci: activate)
- 362 Dimensione Magica (spell/quick-play; ganci: activate)
- 363 Cappelli Magici (trap/normal; ganci: activate)
- 371 Maschera della Restrizione (trap/continuous; ganci: activate)
- 376 Metalmorfosi (trap/normal; ganci: activate)
- 384 Recupera-Mostri (spell/quick-play; ganci: activate)
- 395 Orgoth l'Implacabile (monster; ganci: activate)
- 405 Anima Oscura Posseduta (monster; ganci: activate)
- 418 Ritorno del Condannato (spell/normal; ganci: activate, onEndPhase)
- 420 Anello del Magnetismo (spell/equip; ganci: activate)
- 496 Ala Tiranna (trap/normal; ganci: activate, onEndPhase)
- 501 Cannone Virus (trap/normal; ganci: activate)
- 523 Guardiano Eatos (monster; ganci: activate)
- 586 Uomo Karate (monster; ganci: activate)
- 621 Soldato di Riserva (trap/normal; ganci: activate)
- 634 Luce dell'Intervento (trap/continuous; ganci: activate)
- 652 La Perla di Drago (trap/continuous; ganci: activate)
- 654 Disturba Trappola (trap/counter; ganci: activate)
- 680 Giovane Promessa del Baseball (monster/effect; ganci: activate)
- 715 Forza Esiliata (monster/effect; ganci: activate)
- 740 Stregone del Chaos (monster/effect; ganci: activate)
- 761 Criosfinge (monster/effect; ganci: onAnyMonsterReturnedToHand)
- 780 Ninja Signora Yae (monster/effect; ganci: activate)
- 796 Tiranno Super Conduttore (monster/effect; ganci: activate)
- 813 Benedizione di Sebek (spell/quick-play; ganci: activate)
- 853 Attaccati! (trap/normal; ganci: activate)
- 863 Dadociclope (monster; ganci: activate)
- 885 Quiz Invertito (spell/normal; ganci: activate)
- 886 Metamorfosi (spell/normal; ganci: activate)
- 891 Paura Oscura (monster/effect; ganci: onDestroy, onSTDestroyed, onBanished, onReturnedToHandSelf)
- 901 La Vergine Clemente (monster/effect; ganci: activate)
- 1046 Ameba (monster; ganci: onControlChangedToOpponent)
- 1047 Griggle (monster; ganci: onControlChangedToOpponent)
- 1054 Servo Alato (monster; ganci: activate)
- 1058 Tuorlo Mucoso (monster; ganci: onDealsBattleDamage)
- 1062 Giocoliere Devastante (monster; ganci: activate)
- 1063 Sentinella Porpora (monster; ganci: activate)
- 1069 Fata Guardiana (monster; ganci: activate)
- 1071 Mummia con Ascia Gigante (monster; ganci: activate)
- 1073 Ali Grigie (monster; ganci: activate)
- 1075 Jowgen lo Spiritualista (monster; ganci: activate)
- 1081 Signora Pantera (monster; ganci: activate)
- 1083 Fata Isterica (monster; ganci: activate)
- 1088 Cavaliere Pinguino (monster; ganci: onSentToGraveyardFromDeck)
- 1095 Spirito della Brezza (monster; ganci: onStandbyPhase)
- 1100 Piccolo Spadaccino di Aile (monster; ganci: activate)
- 1102 Unità Scagliapietra (monster; ganci: activate)
- 1107 Bazoo il Mangia-Anima (monster; ganci: activate)
- 1110 Mummia Errante (monster; ganci: activate)
- 1112 Spiritello Silvestre (monster; ganci: activate)
- 1136 Principessa Serpentina (monster; ganci: onReturnedToDeckSelf)
- 1283 Conto alla Rovescia Finale (spell/normal; ganci: activate)

Un effetto "mai partito" non e' per forza rotto: puo' richiedere uno scenario che le partite a caso non creano. Va guardato a mano.

## Errori
(nessuno)
