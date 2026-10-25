# Matrice completa di bilanciamento (deck x duellanti x livelli)

Data: 2026-10-25. Strumento: `tools/audit-matrice-completa.js`. Dati grezzi: `reports/matrix/matrice-completa.jsonl` (una riga per coppia deck/duellante), riassunto `reports/matrix/MATRICE_COMPLETA.json`.

## Metodo

Ognuno dei 17 deck del giocatore (16 Starter/Structure Deck di Yu-Gi-Oh piu' il deck `Custom`, impronta `e1909a556263c979`, 40 carte nel Main Deck e 3 nell'Extra) ha giocato 50 duelli contro ognuno dei 61 duellanti a Facile, Medio e Difficile: **155.550 duelli**. La Grande Guerra (3 deck del giocatore e 6 duellanti congelati) e' fuori, come negli audit precedenti. Il deck del giocatore e' sempre pilotato dall'IA **Difficile**; cambia solo il livello dell'avversario (deck e IA, come nel gioco). Per la stessa coppia i semi sono identici ai tre livelli, e il risultato non dipende dal numero di processi paralleli (verificato).

La percentuale e' quella delle **vittorie del giocatore**: piu' e' alta, piu' l'avversario e' facile. Nessuna partita con errori delle carte o invarianti rotti; un solo duello su 155.550 ha raggiunto il limite di turni.

Starter e Structure Deck non sono oggetto di bilanciamento: sono liste storiche immutabili e qui servono come campioni di forza diversa. Per le tabelle per duellante si usa il **riferimento**: i 15 deck senza `Custom` (un deck molto sopra gli altri) e senza Starter Pegasus (la debolezza Toon e' nota). Le percentuali del giocatore sono quindi basse a Difficile per costruzione: conta la forma delle curve, non il valore assoluto.

## Risultato globale

| Livello | Tutti i deck | Riferimento (15 deck) |
|---|---:|---:|
| Facile | 69,4% | 69,3% |
| Medio | 41,7% | 40,7% |
| Difficile | 28,7% | 27,2% |

La scala e' coerente: da Facile a Medio il giocatore perde 27,7 punti, da Medio a Difficile altri 13: il secondo passo e' piu' corto del primo, ed e' dove si concentrano le anomalie qui sotto. I turni medi scendono da 20,6 (Facile) a 17,7 (Medio) e 16,4 (Difficile): a Difficile si perde (e si vince) prima.

## I deck del giocatore

| Deck | Facile | Medio | Difficile | Media |
|---|---:|---:|---:|---:|
| Custom (deck del giocatore) | 96,3% | 82,2% | 69,6% | 82,7% |
| SD3 Blaze of Destruction | 81,5% | 59% | 45,6% | 62% |
| SD6 Spellcaster's Judgment | 82,3% | 56% | 36,4% | 58,2% |
| SD4 Fury from the Deep | 77,5% | 54% | 42,4% | 58% |
| Starter Yugi Evolution (SYE) | 80,5% | 48,7% | 31,2% | 53,5% |
| SD5 Warrior's Triumph | 78,2% | 50,3% | 31,5% | 53,3% |
| SD9 Dinosaur's Rage | 79,1% | 45,8% | 28,7% | 51,2% |
| SD8 Lord of the Storm | 75,8% | 41,4% | 25,9% | 47,7% |
| SD2 Zombie Madness | 58,6% | 43,2% | 33,1% | 45% |
| Starter Kaiba Evolution (SKE) | 72,9% | 36,9% | 22% | 43,9% |
| Starter Yugi (SDY) | 72% | 34,1% | 21,2% | 42,4% |
| Starter Kaiba (SDK) | 68% | 30,6% | 19,5% | 39,4% |
| SD7 Invincible Fortress | 61,6% | 33,9% | 21,4% | 39% |
| SD1 Dragon's Roar | 54,7% | 33,2% | 22,3% | 36,7% |
| SD10 Machine Revolt | 49% | 22% | 12,7% | 27,9% |
| Starter Joey (SDJ) | 47,6% | 21,7% | 13,6% | 27,6% |
| Starter Pegasus (SDP, Toon) | 43,3% | 16,7% | 11,3% | 23,8% |

`Custom` vince **82,7%** in media, circa 20 punti sopra il migliore dei deck storici (SD3, 62,0%) e oltre tre volte il peggiore (Starter Pegasus, 23,8%): conferma che e' un buon deck "da giocatore evoluto", non un campione neutrale. Con 0 vittorie su 50 a Difficile si trovano soprattutto gli Starter piu' deboli (Joey, Pegasus) e SD10 contro i duellanti piu' tosti: e' atteso e coerente con la loro forza.

## I duellanti

Vittorie del giocatore (riferimento, 15 deck x 50 duelli = 750 per cella), ordinate dal piu' duro al piu' facile a Difficile. "F-M" e "M-D" sono i salti in punti fra livelli vicini: un livello ben scalato toglie almeno una decina di punti ad ogni passo.

| Duellante | Facile | Medio | Difficile | F-M | M-D |
|---|---:|---:|---:|---:|---:|
| nitemare | 74,7% | 26,1% | 2,8% | 48,6 | 23,3 |
| heishin | 58,4% | 19,5% | 7,2% | 38,9 | 12,3 |
| highMageSecmeton | 58,4% | 21,1% | 14,1% | 37,3 | 7 |
| teana | 61,3% | 32,1% | 14,8% | 29,2 | 17,3 |
| nesbitt | 53,3% | 18,8% | 14,9% | 34,5 | 3,9 |
| mako | 73,2% | 28,7% | 15,6% | 44,5 | 13,1 |
| neku | 71,2% | 20,4% | 15,6% | 50,8 | 4,8 |
| gozaburo | 82% | 59,3% | 16% | 22,7 | 43,3 |
| albertoAngela | 60,1% | 23,1% | 16,1% | 37 | 7 |
| marik | 53,7% | 22,8% | 16,9% | 30,9 | 5,9 |
| priestSeto | 58,5% | 26,4% | 17,2% | 32,1 | 9,2 |
| crump | 63,5% | 34,3% | 17,3% | 29,2 | 17 |
| robertoGiacobbo | 69,6% | 20,3% | 18,3% | 49,3 | 2 |
| bakura | 71,5% | 41,3% | 18,7% | 30,2 | 22,6 |
| sebek | 81,5% | 29,3% | 19,3% | 52,2 | 10 |
| simonMuran | 66,3% | 33,6% | 19,7% | 32,7 | 13,9 |
| mountainMage | 71,6% | 36,8% | 20,1% | 34,8 | 16,7 |
| darkNite | 75,7% | 25,3% | 20,5% | 50,4 | 4,8 |
| espaRoba | 69,7% | 31,7% | 21,3% | 38 | 10,4 |
| highMageKepura | 62% | 33,5% | 22% | 28,5 | 11,5 |
| highMageMartis | 59,7% | 38,9% | 22,1% | 20,8 | 16,8 |
| desertMage | 51,6% | 33,3% | 22,1% | 18,3 | 11,2 |
| kaiba | 57,3% | 28,5% | 22,5% | 28,8 | 6 |
| mai | 53,5% | 35,7% | 22,8% | 17,8 | 12,9 |
| mageSoldier | 81,6% | 49,6% | 23,2% | 32 | 26,4 |
| rex | 62,1% | 37,1% | 23,3% | 25 | 13,8 |
| duke | 68% | 41,3% | 23,7% | 26,7 | 17,6 |
| shadi | 47,7% | 42,5% | 23,9% | 5,2 | 18,6 |
| alessandroBarbero | 70,5% | 31,2% | 23,9% | 39,3 | 7,3 |
| solomonMuto | 70,5% | 43,7% | 24,1% | 26,8 | 19,6 |
| paradoxBrothers | 52,3% | 36% | 24,4% | 16,3 | 11,6 |
| gansley | 76,5% | 39,9% | 24,7% | 36,6 | 15,2 |
| oceanMage | 75,9% | 36,7% | 24,8% | 39,2 | 11,9 |
| arkana | 72,3% | 52,8% | 25,5% | 19,5 | 27,3 |
| johnson | 71,1% | 41,1% | 25,5% | 30 | 15,6 |
| tristan | 84,8% | 48,5% | 26% | 36,3 | 22,5 |
| tea | 68,1% | 40,4% | 26,3% | 27,7 | 14,1 |
| forestMage | 80,4% | 46,9% | 26,5% | 33,5 | 20,4 |
| serenity | 77,5% | 50,3% | 26,9% | 27,2 | 23,4 |
| bandit_keith | 61,7% | 33,7% | 28,3% | 28 | 5,4 |
| pegasus | 47,6% | 28,8% | 28,3% | 18,8 | 0,5 |
| ishizu | 64,7% | 50,8% | 28,5% | 13,9 | 22,3 |
| priestessIsis | 62,9% | 50,8% | 28,5% | 12,1 | 22,3 |
| yamiYugi | 68,1% | 34,4% | 28,7% | 33,7 | 5,7 |
| bonz | 79,9% | 41,9% | 29,1% | 38 | 12,8 |
| noah | 83,9% | 46,8% | 29,1% | 37,1 | 17,7 |
| highMageAtenza | 71,1% | 32,1% | 29,3% | 39 | 2,8 |
| meadowMage | 74,9% | 37,9% | 30,7% | 37 | 7,2 |
| labyrinthMage | 87,9% | 49,5% | 30,9% | 38,4 | 18,6 |
| panik | 74,4% | 41,7% | 32,8% | 32,7 | 8,9 |
| jono | 75,3% | 51,5% | 34% | 23,8 | 17,5 |
| yugiMuto | 58,8% | 49,5% | 34,5% | 9,3 | 15 |
| lector | 65,5% | 43,3% | 36,3% | 22,2 | 7 |
| joey | 74,5% | 35,2% | 37,6% | 39,3 | -2,4 |
| highMageAnubisius | 81,1% | 52,1% | 42,1% | 29 | 10 |
| odion | 71,6% | 68,5% | 48,9% | 3,1 | 19,6 |
| weevil | 87,3% | 72,5% | 52% | 14,8 | 20,5 |
| strings | 85,3% | 74,4% | 55,5% | 10,9 | 18,9 |
| umbra | 74% | 73,3% | 64,7% | 0,7 | 8,6 |
| seeker | 75,6% | 76,1% | 64,8% | -0,5 | 11,3 |
| lumis | 82,7% | 80% | 72,4% | 2,7 | 7,6 |

## Anomalie

1. **Difficile quasi imbattibile**: `nitemare` (2,8%) e `heishin` (7,2%). Anche `Custom` fa solo il 12% e il 24%. Sono i due unici duellanti sotto il 10% con i deck di riferimento.
2. **Difficile troppo facile (almeno 45%)**: `lumis` (72,4%), `seeker` (64,8%), `umbra` (64,7%), `strings` (55,5%), `weevil` (52,0%), `odion` (48,9%). I primi tre sono anche **piatti**: Facile, Medio e Difficile quasi uguali (Lumis 82,7 / 80,0 / 72,4; Seeker 75,6 / 76,1 / 64,8; Umbra 74,0 / 73,3 / 64,7). Lo avevano gia' indicato l'audit della Storia e quello dei duellanti principali.
3. **Medio -> Difficile con poco salto (meno di 8 punti)** su 17 duellanti: i piu' marcati sono `joey` (Difficile **piu' facile di Medio**: 35,2% -> 37,6%, l'unico caso invertito), `pegasus` (28,8 -> 28,3), `highMageAtenza` (32,1 -> 29,3), `robertoGiacobbo` (20,3 -> 18,3), `neku` (20,4 -> 15,6), `nesbitt` (18,8 -> 14,9), `darkNite` (25,3 -> 20,5). In molti il salto Facile -> Medio e' invece enorme (30-50 punti): Medio e' gia' quasi al livello di Difficile.
4. **Facile -> Medio piatto**: `seeker`, `umbra`, `lumis`, `odion` e `shadi` hanno meno di 8 punti fra Facile e Medio (Seeker -0,5, Umbra +0,7).
5. **Facile gia' duro (meno di 55%)**: `pegasus` 47,6%, `shadi` 47,7%, `desertMage` 51,6%, `paradoxBrothers` 52,3%, `nesbitt` 53,3%, `mai` 53,5%, `marik` 53,7%. Contro i mazzi di riferimento un Duellante a Facile non dovrebbe piu' vincere della meta'.
6. **Facile banale (almeno 85%)**: `labyrinthMage` 87,9%, `weevil` 87,3%, `strings` 85,3%.
7. **Dipendenza dal deck**: alcuni duellanti si battono solo con il deck "giusto" a Difficile (`weevil`: 16% con Starter Joey, 86% con SD3; `gozaburo`: 0% con Starter Joey, 54% con SD3; `odion`: 22% con SD10, 82% con SD3; `umbra`: 32% con SD2, 88% con Starter Yugi Evolution). E' normale per un duello a tema, ma conferma che Weevil, Odion e Umbra Difficili restano alla portata di molti deck.

## Cosa non dice questa matrice

- Il giocatore e' un'IA Difficile con un deck fisso: misura la forza dei deck avversari, non l'esperienza di un giocatore vero (che sceglie meglio le risposte alle Trappole, ma sbaglia piu' spesso).
- 50 partite per deck e livello danno un'incertezza di circa +/-7 punti per cella; le medie per duellante (750 partite) di circa +/-3,5. Le differenze di pochi punti non vanno lette come difetti.
- Non si e' toccato nessun deck: questo documento e' la fotografia, non una correzione.

## Suggerimenti, in ordine di priorita'

1. Rendere piu' dura la scala di **Lumis, Seeker, Umbra** (Facile < Medio < Difficile con salti di almeno 10 punti): sono i tre piu' piatti e i tre piu' facili a Difficile.
2. Rialzare **Difficile** per Strings, Weevil, Odion e per i casi con Difficile quasi uguale a Medio (Joey, Pegasus, Atenza, Neku, Nesbitt, Dark Nite).
3. Allentare un po' **Nitemare** e **Heishin** a Difficile, e abbassare il Facile di Pegasus, Shadi, Marik, Mai, Paradox Brothers, Desert Mage e Nesbitt.
4. Rifare la matrice dopo ogni ritocco: costa circa 35 minuti.
