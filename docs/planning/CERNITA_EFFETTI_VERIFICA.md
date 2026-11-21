# Verifica per esecuzione del bacino degli effetti

Generato da `node tools/cernita-effetti.js --verifica --partite 1500 --seme 880000`.

Il bacino (gruppi A + B della cernita, 538 carte) e' stato giocato in **due mondi** con gli stessi mazzi e gli stessi semi:
1. il gioco com'e';
2. il **mondo del clone**: nel database restano solo le carte del bacino, con **id nuovi e nomi inventati**; le carte Yu-Gi-Oh only non esistono.
Entrambi i posti sono l'IA al livello Difficile; i mazzi sono 40 carte del bacino pescate a caso (14 mostri Liv. 1-4, 4 Liv. 5-6, 2 Liv. 7+, 11 Magie, 9 Trappole).

## Risultato
- Coppie di partite: **1500**; **identiche** nei due mondi (stesso registro riga per riga, stesso esito, turno e Life Points): **1499**.
- Partite **diverse**: **1**; partite interrotte da un errore: 0; arrivate al limite di turni: 48.
- Errori lanciati dalle carte: **2**; invarianti rotte: **0**.
- Carte con un effetto che **non sono mai partite** nel mondo del clone: **69** su 466.

## Carte che si comportano diversamente nei due mondi (piu' partite diverse in cui il loro effetto ha contato diversamente)
- 7 Buco Nero (1)
- 35 Mostro Resuscitato (1)
- 158 Venditore di Bare (1)
- 346 Legione Demone Giullare (1)
- 390 Pomodoro Mistico (1)
- 407 Domanda (1)
- 466 L'Occhio della Verità (1)
- 570 Ookazi (1)
- 685 Distruzione Infuocata (1)
- 693 Manta del Fato Incedente (1)
- 1117 Uomo Cobra Sakuzy (1)

Nota: una differenza puo' venire anche dall'**IA**, che in alcuni punti guarda id e nomi (vedi `CERNITA_EFFETTI_GENERICI.md`), non solo dalla carta.

## Prime partite diverse
- seme 880553, riga 451
  - originale: 🪦 Tombarolo usa Domanda dal Cimitero dell'avversario come se fosse in mano!
  - travestito: 🪦 Tombarolo usa Buco Nero dal Cimitero dell'avversario come se fosse in mano!
  - carte con conteggi diversi: 407 Domanda, 7 Buco Nero, 693 Manta del Fato Incedente, 346 Legione Demone Giullare, 1117 Uomo Cobra Sakuzy, 158 Venditore di Bare, 570 Ookazi, 466 L'Occhio della Verità

## Effetti mai partiti nel mondo del clone
- 95 Frecce Anti-Magia (spell/quick-play; ganci: activate)
- 104 Drago Revolver (monster; ganci: activate)
- 111 Anima Furente (spell/quick-play; ganci: activate)
- 137 Soldato-Cannone (monster; ganci: activate)
- 143 Mura del Castello (trap/normal; ganci: activate)
- 144 Tartaruga Catapulta (monster; ganci: activate)
- 150 Chiron il Saggio (monster; ganci: activate)
- 166 Maledizione del Demone (spell/normal; ganci: activate)
- 194 Illusionista dagli Occhi Oscuri (monster; ganci: onFlip)
- 199 Esplosione a Onde Soniche (spell/normal; ganci: activate)
- 201 Buco Dimensionale (spell/normal; ganci: activate)
- 221 Ectoplasmatore (spell/continuous; ganci: activate, onEndPhase)
- 227 Risucchio di Energia (trap/normal; ganci: activate)
- 238 Giara di Fibra (monster; ganci: onFlip)
- 244 Crepuscolo a Cinque Stelle (spell/normal; ganci: activate)
- 255 Azzardo (trap/normal; ganci: activate)
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
- 780 Ninja Signora Yae (monster/effect; ganci: activate)
- 796 Tiranno Super Conduttore (monster/effect; ganci: activate)
- 813 Benedizione di Sebek (spell/quick-play; ganci: activate)
- 847 Duplicazione di Macchine (spell/normal; ganci: activate)
- 853 Attaccati! (trap/normal; ganci: activate)
- 863 Dadociclope (monster; ganci: activate)
- 885 Quiz Invertito (spell/normal; ganci: activate)
- 886 Metamorfosi (spell/normal; ganci: activate)
- 891 Paura Oscura (monster/effect; ganci: onDestroy, onSTDestroyed, onBanished, onReturnedToHandSelf)
- 901 La Vergine Clemente (monster/effect; ganci: activate)
- 1029 Mascelle della Trattativa Oscura (monster/flip; ganci: onFlip)
- 1046 Ameba (monster; ganci: onControlChangedToOpponent)
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
- 1100 Piccolo Spadaccino di Aile (monster; ganci: activate)
- 1102 Unità Scagliapietra (monster; ganci: activate)
- 1107 Bazoo il Mangia-Anima (monster; ganci: activate)
- 1110 Mummia Errante (monster; ganci: activate)
- 1112 Spiritello Silvestre (monster; ganci: activate)
- 1136 Principessa Serpentina (monster; ganci: onReturnedToDeckSelf)
- 1283 Conto alla Rovescia Finale (spell/normal; ganci: activate)

Un effetto "mai partito" non e' per forza rotto: puo' richiedere uno scenario che le partite a caso non creano. Va guardato a mano.

## Errori
- originale seme 880292: [CardEffects] Maschera del Maledetto (onStandbyPhase) ha lanciato un errore, l'effetto è stato saltato: TypeError: Cannot read properties of null (reading 'card') <-     at equippedTarget (js/engine/card-effects.js:783:7
- travestito seme 880292: [CardEffects] Zq0295x (onStandbyPhase) ha lanciato un errore, l'effetto è stato saltato: TypeError: Cannot read properties of null (reading 'card') <-     at equippedTarget (js/engine/card-effects.js:783:77) <-     at Ob
