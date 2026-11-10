# Premi dei tornei — verifica del 10 novembre 2026

Fonte: `js/economy/rewards.js`, `forVictory` e `forTournament`. Le tre pagine
torneo passano `state.difficulty` alla liquidazione finale. Il livello interno
`Medio` viene presentato al giocatore come **Normale**.

## Premio ripetibile per completamento

| Torneo | Difficoltà | Crediti | Stelle del profilo | Carte Locazione | Carte del Millennio |
|---|---|---:|---:|---:|---:|
| Regno dei Duellanti | Facile | 650 | 14 | 0 | 0 |
| Regno dei Duellanti | Normale | 825 | 19 | 0 | 0 |
| Regno dei Duellanti | Difficile | 1000 | 24 | 0 | 0 |
| Battle City | Facile | 650 | 3 | 1 | 0 |
| Battle City | Normale | 825 | 5 | 2 | 0 |
| Battle City | Difficile | 1000 | 8 | 3 | 0 |
| Kaiba | Facile | 650 | 3 | 0 | 1 |
| Kaiba | Normale | 825 | 5 | 0 | 1 |
| Kaiba | Difficile | 1000 | 8 | 0 | 2 |

Questi importi sono il premio finale: ai crediti va sommato **120 × duelli
vinti** durante quella partecipazione. I 120 crediti sono uguali nelle tre
difficoltà e non vengono dimezzati dalla soglia giornaliera delle vittorie
libere. Le Stelle usate per entrare nel castello del Regno sono un contatore
del torneo: non costituiscono un ulteriore premio del profilo.

## Bonus e ricompense aggiuntive

- Prima vittoria assoluta del singolo torneo, una volta in totale fra tutte
  le difficoltà: Regno +500 crediti e +4 Stelle; Battle City +500 crediti e
  +1 Carta Locazione; Kaiba +500 crediti e +1 Carta del Millennio.
- Prima vittoria della giornata: +100 crediti, anche quando avviene in torneo.
- Sconfitta portata a termine: 15 crediti di partecipazione; abbandono: zero.
  Non viene assegnato il premio finale del torneo perso.
- Completamento a Difficile: una illustrazione alternativa dal bacino del
  torneo, finché ne rimangono da sbloccare.
- Oggetti del Millennio: probabilità del 5% battendo il portatore nel torneo
  previsto. Occhio da Pegasus nel Regno o Kaiba; Bastone da Marik a Battle
  City o Kaiba; Collana da Ishizu a Battle City o Kaiba. Ogni oggetto è unico,
  distinto dalle Carte del Millennio che sono una valuta.
- Sfide e imprese carte possono aggiungere i propri premi. In particolare
  tre Battle City a Difficile contribuiscono allo sblocco di Ra insieme agli
  altri requisiti di storia e vittorie contro Marik; un torneo da solo non
  garantisce quella carta.
- I ritrovamenti casuali di valute dei duelli liberi sono esclusi dai tornei.

## Valutazione

La crescita del premio finale esiste: da Facile a Difficile i crediti salgono
del 54% circa, le Stelle del Regno del 71%, le Carte Locazione di Battle City
triplicano e le Carte del Millennio di Kaiba raddoppiano. Il bonus prima
vittoria resta fisso, quindi non moltiplica il vantaggio del Difficile.

Due punti da considerare per un eventuale ritocco: i 120 crediti per duello
non premiano la difficoltà; a Kaiba Facile e Normale danno entrambi una Carta
del Millennio. Per chi cerca soprattutto crediti all'ora o quella valuta,
Facile può risultare conveniente se conclude i duelli molto più rapidamente.
I premi finali da soli non consentono di misurare il farming orario: servono
durata media, numero di scontri e frequenza delle eliminazioni per torneo.
Questa verifica non modifica gli importi e non simula tempi non misurati.
