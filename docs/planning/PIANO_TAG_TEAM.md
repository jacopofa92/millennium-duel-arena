# Piano di lavoro: Tag Team (2v2 e 2v1)

Stato: **proposta, nessuna riga di codice scritta**. Data: 2026-10-30.
Scritto per chi riprenderà il lavoro (l'autore o una sessione futura di Claude) senza il contesto della chat.

## 1. Obiettivo

Giocare a squadre: due duellanti per lato (2v2) oppure due contro un avversario più forte (2v1),
con la possibilità che il compagno sia l'IA. Il lavoro si fa **senza duplicare il motore** e
**senza cambiare le regole delle carte**.

### Decisione di architettura (già discussa con l'autore)

- **Non si crea un secondo motore.** Una copia vorrebbe dire correggere ogni bug due volte (il
  progetto ha già sofferto di deriva fra pagine duplicate) e non risolverebbe il vero vincolo:
  le carte conoscono solo due lati, `'player'` e `'bot'`.
- **Il Tag Team è una variante di regole** caricata come plugin sullo stesso motore, scelta per
  duello con un parametro (`?mode=tag`), come Puzzle, Torre, Settimana e Caccia al Boss
  (`js/modes/`, avvolgono `preparaManiIniziali`, registrano le loro voci in `window.ModalitaDuello`).
- **Un "lato" resta un posto solo** (`player` o `bot`), ma è composto da due **membri**.
  Campo, Life Point e Cimitero sono del lato; mano e Mazzo sono del membro che gioca.
  Questo evita di insegnare a oltre mille carte l'esistenza di un terzo e quarto posto.
- **Il motore si tocca solo se serve e solo in modo additivo**, con punti di aggancio generici.
  Ogni aggancio va annunciato all'autore prima di scriverlo (la regola "le modalità non toccano il
  motore" esiste per proteggere le regole delle carte, non per vietare un aggancio neutro).

### Quando riconsiderare la scelta

Una copia del motore (o un lavoro serio sui quattro posti) avrebbe senso solo se servissero **quattro
campi distinti** o un ordine di turno a quattro (A1, B1, A2, B2) con carte che reagiscono a ogni
singolo giocatore. Non è l'obiettivo di questo piano. Se un giorno lo diventasse, il lavoro delle
fasi 1-2 sarebbe comunque il punto di partenza.

## 2. Decisioni aperte (da chiudere con l'autore PRIMA della fase 1)

| # | Domanda | Opzioni | Effetto |
|---|---------|---------|---------|
| D1 | Life Point | un totale per lato (consigliato, 8000 o 12000) / uno per membro | cambia `checkGameOver` e la barra LP |
| D2 | Scambio fra membri | libero una volta a turno / obbligato a ogni turno / solo su richiesta in Main Phase 1 | cambia interfaccia e IA |
| D3 | Cimitero ed Extra Deck | condivisi per lato (consigliato) / separati | cambia le carte che pescano dal Cimitero |
| D4 | Pescata | solo il membro attivo pesca / ognuno pesca all'inizio del suo turno | cambia il ritmo del duello |
| D5 | Il compagno è | sempre IA / umano o IA a scelta | cambia la fase 3 |
| D6 | Mazzi | ognuno porta il proprio / mazzo a specchio fornito | si appoggia sul Duello a Specchio già presente |

### Decisioni prese dall'autore (2026-10-30)

- **D1** Life Point: ENTRAMBE le opzioni, scelte come regola prima del duello (mai a metà partita):
  "uno per membro" o "un totale per lato". Con il totale, D7 vale sul totale.
- **D2** Scambio: ENTRAMBE le opzioni, regola scelta prima del duello: "obbligato" (i due membri si
  alternano a ogni turno del lato) o "libero". Il libero va inteso come SCELTA di chi gioca all'inizio
  del proprio turno, mai uno scambio a metà turno. Si implementa dopo l'obbligato (costo più alto:
  decisione sincronizzata in rete e logica dell'IA).
- **D3** Cimitero: **condiviso** (rivisto lo stesso giorno: il separato era il punto più rischioso per
  il motore e per la rete). Di conseguenza **D9 non serve più** e di una conseguenza qui sotto va letta
  senza il Cimitero: con il membro attivo cambiano solo mano, Mazzo e (se D1 è "per membro") Life Point.
- **D4** Pescata: solo il membro attivo.
- **D4** confermata dall'autore.
- **D5** Compagno: il compagno umano esiste SOLO in Multiplayer (fase 3). In locale il compagno è
  sempre l'IA. Non esiste il gioco in due sullo stesso dispositivo.
- **D6** Mazzi: ognuno porta il proprio. Nessuna opzione a specchio (tolta dall'autore).
- **D7** Perde il lato quando ENTRAMBI i membri sono a 0 Life Point. Il superstite gioca ogni turno
  (lo scambio obbligato salta). Vale solo con D1 "per membro".
- **D8** Ogni membro controlla SOLO i propri mostri (attacco, Tributo, cambio Posizione, effetti).
  I mostri del compagno restano sul campo: occupano caselle, difendono, si possono attaccare.
  Costo tecnico: ogni carta porta il membro che l'ha Evocata (agganci da verificare in fase 0).

Conseguenza di D1-D3: del lato condiviso restano **solo il campo** (mostri e Magie/Trappole) e la
zona Terreno. Il resto cambia con il membro attivo: mano, Mazzo, Life Point e Cimitero. Lo scambio
quindi fa girare più stato di quanto previsto in origine. Un attacco diretto colpisce i Life Point del
membro attivo del lato avversario.

### Decisioni nuove aperte (nate dalle scelte sopra)

| # | Domanda | Valore di partenza proposto |
|---|---------|-----------------------------|
| D7 | DECISA (entrambi a 0, vedi sopra) | - |
| D8 | DECISA (solo i propri, vedi sopra) | - |
| D10 | DECISA: i mostri di un membro eliminato (D7) vanno nel Cimitero condiviso | - |
| D11 | DECISA: ognuno ha le PROPRIE caselle. Lettura da CONFERMARE: tutto il campo (mostri, Magie/Trappole, Terreno) appartiene al membro e viene messo da parte allo scambio, come mano e Mazzo. Il motore vede sempre un solo campo da 5 caselle; il campo del compagno in panchina è al sicuro e non attaccabile. D8 diventa automatica (nessun controllo per carta). Alternativa scartata per costo: dieci caselle per lato, entrambe visibili e attaccabili. | - |
| D12 | Chi sta "davanti" sul lato avversario e subisce gli attacchi? (con lettura A di D11 gli attacchi non hanno scelta di bersaglio fra i due membri) | il membro che ha giocato per ultimo, finché il suo lato non ricomincia e fa lo scambio. Esempio 2v2, ordine G1 G3 G2 G4: G1 attacca G3 (turno 1), G2 attacca ancora G3 (turno 3), poi G4 attacca G2 (turno 4), e così via. L'alternativa è che stia davanti chi giocherà il turno successivo. AGGIORNAMENTO dell'autore: chi attacca SCEGLIE chi affrontare all'inizio del proprio turno (una volta, prima della Main Phase 1). Fattibile con la lettura A scambiando anche il lato avversario; la regola "ultimo che ha giocato" resta solo come valore predefinito (IA e scelta saltata). Serve un pannello con i soli dati pubblici dei due avversari |
| D13 | Concentrare sempre lo stesso bersaglio (rilevante con D1 "per membro": l'altro membro resta intatto in panchina). Quanto limitarlo? | DECISA dall'autore (opzione 2): massimo 2 turni di fila sullo stesso membro finché l'altro è vivo. Alternative offribili come regola della stanza: libero, obbligo di alternare, automatico (chi ha giocato per ultimo) |
| D9 | SUPERATA dal Cimitero condiviso (D3). Era: un mostro distrutto va nel Cimitero di chi lo ha Evocato o del membro attivo? | di chi lo ha Evocato (richiede di segnare ogni carta col suo membro; è il punto più rischioso, vedi fase 0) |

## 3. Fasi

Ogni fase si chiude con: spec dedicati verdi, `npm run check`, impronta di identità del motore
invariata (vedi 5), nota in `CLAUDE.md`, versione e cache aggiornate. **La suite completa si lancia
solo quando lo dice l'autore.**

### Fase 0: sondaggio (S)

Nessuna modifica. Si risponde con evidenze, non con ipotesi:

1. Dove il motore legge mano, Mazzo, Cimitero e LP del lato: `gameState.playerHand`, `playerDeck`,
   `playerGraveyard`, `playerLP` (e i gemelli `bot...`) e gli accessori di `js/engine/tavolo.js`.
   Domanda chiave: **lo scambio di mano e Mazzo si può fare scambiando il contenuto di quegli array
   dalla variante, senza toccare il motore?** Se sì, la fase 1 non ha aggiunte al motore.
2. Quali carte reagiscono a "scartata dalla mano", "pescata", "Mazzo vuoto" in modi che lo scambio
   potrebbe far scattare per errore (es. Roc dalla Valle della Foschia, id 781).
3. Come `changeTurn` e gli eventi di `EventiDuello` permettono di agganciare "inizio turno del lato".
4. Cosa succede con il Mazzo vuoto di un membro (sconfitta del lato o solo del membro).

Uscita: un paragrafo in questo file ("Esito della fase 0") con le risposte e l'elenco esatto degli
eventuali agganci nel motore.

### Fase 1: staffetta contro l'IA, un solo giocatore (M)

Il prototipo giocabile. Un lato (il tuo) ha due membri: tu e un compagno IA. L'avversario è un
Duellante normale.

- File nuovi, tutti fuori da `js/engine/`: `js/modes/tag.js` (regole della variante),
  `js/modes/tag-mode.js` (registrazione in `ModalitaDuello`), `js/data/tag-db.js` (coppie
  proposte, regole D1-D6), `tag.html` (scelta compagno e avversario), `js/ui/tag-panel.js/.css`
  (pannello "in panchina" e pulsante scambio).
- Scambio: all'inizio di ogni turno del lato si decide chi gioca (D2). Mano e Mazzo del membro
  uscente vengono messi da parte, quelli dell'entrante diventano `gameState.playerHand/playerDeck`.
- Compagno IA: quando tocca a lui il posto si imposta come controllato dall'IA con
  `Tavolo.imposta`, poi torna alla persona. L'IA (`js/ai/`) è già scritta per giocare da qualsiasi posto.
- Premi: soli Crediti, come le altre modalità; mai premi per duelli abbandonati.
- Voce nel menu Duelli (gruppo Allenamento o nuovo gruppo) e riga in `PAGINE` di `tab-bar.js`.
- Spec: scambio corretto di mano e Mazzo, Life Point condivisi, Mazzo vuoto, vittoria e sconfitta
  del lato, il compagno IA gioca davvero un turno, il guardrail `guardrail-modalita-fuori-dal-motore`.

Uscita: si gioca un duello intero 2v1 (tu + IA contro un Duellante) dall'inizio alla fine senza errori.

### Fase 2: 2v2 contro l'IA e Boss a squadre (M)

- Anche l'avversario è un lato a due membri (due Duellanti del roster, ognuno col suo mazzo).
- 2v1 contro un Boss rinforzato (più LP, una pescata in più), riusando i dati del Raid
  (`js/data/raid-db.js`).
- Strumento di prova: estensione di `tools/duello-senza-testa.js` per duelli a squadre IA contro IA,
  per misurare il bilanciamento come per la matrice completa (`tools/audit-matrice-completa.js`).
- Bilanciamento: verifica che lo scambio non regali un vantaggio sistematico al lato che comincia.

Uscita: curva di vittorie plausibile su un campione di partite senza testa, nessuno stallo.

### Fase 3: 2v1 e 2v2 in Multiplayer, con compagni umani (L)

**Obiettivo confermato dall'autore (2026-10-30):** si vogliono sia il 2v1 sia il 2v2 in Multiplayer,
con persone vere. Non è più "da valutare se farlo", ma "da progettare bene dopo le fasi 1-2".
Cosa resta da decidere è il COME (varianti A e B sotto). Le fasi 1-2 servono a fissare prima le
regole del tag team contro l'IA, così il lavoro di rete parte da regole già provate.

- Variante A, **due persone sullo stesso lato in rete**: serve una stanza da tre o quattro posti.
  Il relay (`server/server.js`) accetta solo tipi di messaggio noti e **Render ha i minuti di build
  esauriti**: i messaggi nuovi devono viaggiare come campo in più di un tipo esistente, come il Raid
  (`ready` con campo `raid`). Va deciso se basta.
- Variante B, **co-op come il Raid**: ognuno gioca il proprio duello contro lo stesso avversario con
  una barra LP comune. È già provata e non richiede il relay nuovo.
- Il passo comune (`js/engine/passo-comune.js`) oggi sincronizza due client. Con tre o quattro
  serve una progettazione a parte: **fermarsi e riscrivere il piano** prima di toccarla.

Uscita: decisione scritta (A, B o nessuna) con i costi misurati.

## 3bis. Esito della fase 0 (2026-10-30)

**Metodo.** Uno script elenca ogni proprietà di `gameState` usata in `js/` e negli script delle pagine
(155 campi e 64 forme di chiave costruita `gameState[...]`). I campi sono stati classificati leggendo
`resetGameState` e `changeTurn` (`js/engine/fasi.js` 155-693), `recomputeStaticEffects`
(`js/engine/duel-engine.js` 5111-5500) e i processi ritardati (`duel-engine.js` 2680-3026). Lo script
è riscrivibile in pochi minuti: cerca `gameState.<nome>` e `gameState[<espressione>]` e conta i file.

### Risposte alle domande della fase 0

1. **Lo scambio si fa senza toccare il motore.** Le zone di un posto si leggono sempre come
   `gameState[posto + 'Campo']` (accessori di `js/engine/tavolo.js` o chiavi costruite), quindi basta
   riassegnare quelle proprietà. Nei punti esaminati non risultano riferimenti conservati da un turno
   all'altro (da confermare con lo spec della fase 1). **Il Cimitero non va mai sostituito**: il suo
   `push` è decorato per array (`_banishRedirectInstalled`, `duel-engine.js` 5179-5198), e con il
   Cimitero condiviso non serve.
   - Campi per membro, da scambiare: `Hand`, `Deck`, `DeckCount`, `ExtraDeck`, `MonsterField`,
     `STField`, `FieldSpell`, `LP` (solo con D1 "per membro"), più `personaggioPerPosto[posto]` e
     `livelloIA[posto]` (identità e livello dell'IA del membro, letti dai playbook).
2. **Nessuna carta scatta per errore**, se lo scambio riassegna le proprietà senza passare da pescata,
   scarto o rimescolo: nessun trigger parte.
3. **Il momento giusto esiste.** `changeTurn` emette l'evento `orologio` (`fasi.js` 624) una volta
   sola: dopo il cambio di `currentPlayer`, la scadenza degli effetti "fino al tuo prossimo turno" e il
   turno saltato, e prima dell'azzeramento di `hasAttacked`/`canChangePosition` sul campo di turno
   (646-668) e della pescata. È però un evento pensato per l'interfaccia (vedi A1).
4. **Life Point a 0 e Mazzo vuoto chiudono il duello subito** (`checkGameOver`, `fasi.js` 1556-1572;
   pescata, 919-932). Con D7 serve un aggancio (A3).

La scelta del bersaglio di D12 può aprirsi all'inizio del turno: le transizioni di fase
(`schedulePhaseTransition`, `fasi.js` 39) aspettano già che le scelte aperte si chiudano, quindi la Main
Phase 1 non parte prima. In Multiplayer la scelta viaggia con `Decisioni`.

### Classificazione dello stato

| Gruppo | Esempi | Cosa serve |
|--------|--------|------------|
| Ricalcolati a ogni ridisegno (29) | `atkDefBonus`, `cannotAttackUids`, `trapsNegatedFor`, `revealedFor` | niente: seguono da soli il campo attivo |
| Azzerati a ogni cambio turno (~26) | `hasNormalSummoned`, `usedIgnitionThisTurn`, `noDamageFor` | niente: lo scambio avviene a turno nuovo |
| Per lato, durano più turni | `coldWaveActiveFor`, `skipDrawFor`, `skipNextTurnFor`, `skipMainPhase1For`, `lockedMonsterZonesFor`, `lockedSTZonesFor`, `pendingMaharaghiPeekFor`, `contoAllaRovescia`, `orgoth*`/`untilOpponentTurn*` | restano del LATO (vedi D16); le zone bloccate vanno verificate con uno spec |
| Per uid, durano | `cannotBeTributedUids`, `negatedEffectsForeverUids`, `blockedCardUids`, `orgothAtkDefBonus` | niente: seguono la carta anche in panchina |
| Globali | `turn`, `phase`, `currentPlayer`, `chain`, `gameOver`, selezioni in sospeso | niente; lo scambio si fa solo a duello fermo |

### Rischi trovati

- **R1, legami fra i due lati.** Una Carta Equipaggiamento agganciata a un mostro avversario finisce
  nel Cimitero se il bersaglio non è più nella sua casella (`duel-engine.js` 5402-5455). Incantesimo
  Ombra (439, `card-effects-3.js` 2764) e Cerchio Ammaliante (620, `card-effects-4.js` 2879) fanno lo
  stesso nel proprio `static()`. Quando il lato del bersaglio scambia membro, queste carte verrebbero
  distrutte. I legami sul proprio lato (136, 688, 838, Arte Ninjitsu, Scavo Fossile) vanno in panchina
  insieme al loro mostro e non danno problemi.
- **R2, effetti ritardati per uid.** Distruzione ritardata (`duel-engine.js` 2870-2888),
  autodistruzione a fine fase, Sfera Esplosiva: se il mostro è in panchina quando scattano, la voce si
  perde in silenzio e il mostro sfugge.
- **R3, ritorni ritardati** (in mano, dal Cimitero, dal bando, alla Standby: `fasi.js` 966-968):
  arrivano al membro che gioca in quel momento, non a quello della carta.
- **R4, carte che tornano "al proprietario"** (mano, Mazzo, Extra Deck): il motore conosce il lato, non
  il membro, quindi finiscono al membro attivo.
- **R5, Multiplayer.** Gli uid deterministici del passo comune usano un prefisso per posto
  (`js/data/cards-db.js` 396): ogni membro deve avere un prefisso suo.
- **Nessun rischio** per il controllo temporaneo: il mostro torna nella End Phase dello stesso turno
  (`fasi.js` 1287), prima di ogni scambio.

### Soluzioni proposte

Nella variante, senza toccare il motore:
- **V1** scambio per riassegnazione delle proprietà per membro; mai il Cimitero.
- **V2** ogni carta segnata con il suo membro quando si costruisce il mazzo (campo `membro`). Allo
  scambio, le carte in mano/Mazzo/Extra Deck del membro uscente che appartengono all'altro gli vengono
  riconsegnate (copre R4 e R3 per la mano). I mostri rianimati dal Cimitero condiviso restano a chi li
  ha rianimati.
- **V3** voci ritardate per uid che riguardano carte in panchina: messe da parte allo scambio e
  restituite al rientro del membro, con il conto fermo (R2).

Agganci nel motore, da approvare (elenco in sezione 6): A1, A2, A3.

### Decisioni nuove emerse

| # | Domanda | Proposta |
|---|---------|----------|
| D14 | DECISA: zona Bandite condivisa come il Cimitero | - |
| D15 | DECISA: se un membro arriva a 0 a metà turno avversario (D7) il compagno entra SUBITO, così davanti c'è sempre un membro vivo | - |
| D16 | Effetti che colpiscono "un giocatore" per più turni (salta la pescata, Ondata Gelida, salta il turno): valgono per il lato o per il membro colpito? | DECISA dall'autore: valgono solo per il MEMBRO colpito, non per il lato. Conseguenza: le mappe "per posto" che durano più turni (salta la pescata, Ondata Gelida, zone bloccate, ecc.) vanno messe da parte e ripristinate insieme al membro, quindi anche loro entrano nello scambio. Elenco completo da fare con uno spec. Confermato dall'autore. Per "salta il tuo prossimo turno" il turno del membro colpito è PERSO (come nel 1v1): il compagno non gioca al suo posto |
| D17 | DECISA: Mazzo vuoto di un membro = eliminato come a 0 Life Point | - |

### Verdetto

Fattibile come variante. Servono al massimo tre agganci additivi nel motore, ciascuno con una risposta
predefinita che lascia il 1v1 identico; due dei tre hanno un'alternativa senza aggancio. Non verificati
in questa fase: il passo comune a più client (fase 3), la semantica precisa delle zone bloccate,
l'IA che cambia playbook allo scambio di `personaggioPerPosto`.

## 3ter. Stato della fase 1 (2026-10-31, branch `feature/tag-team`, versione 1.4.188)

**Fatto.**
- Agganci nel motore A1, A2, A3 (vedi sezione 6). Prova d'identità: le 60 partite senza testa danno
  un'impronta IDENTICA a prima; fra 413 funzioni e 870 carte cambiano solo `changeTurn`,
  `checkGameOver` e `DuelEngine.recomputeStaticEffects`, nessuna carta.
- Variante in file nuovi: `js/modes/tag.js` (regole, senza interfaccia), `js/modes/tag-mode.js`
  (duello e interfaccia), `js/data/tag-db.js` (numeri ed elenchi), `tag.html` (scelta di compagno,
  avversario, livello e regola dei Life Point), stile in `js/modes/modes.css`. Voce "Tag Team" in
  Duelli › Allenamento, barra in basso, Service Worker.
- Regole attive: D1 (entrambe le opzioni), D2 obbligato, D3/D14 Cimitero e Bandite condivisi, D4, D5
  (compagno IA), D6, D7, D10, D11 lettura A, D12 predefinita (l'avversario attacca chi ha giocato per
  ultimo), D15, D16 (15 mappe per membro, elenco sorvegliato dallo spec), D17, V1, V2, V3.
- Interfaccia: nome e ritratto del riquadro dei Life Point seguono chi gioca, i Life Point si allineano
  senza conteggio animato allo scambio, velo sui click durante il turno del compagno IA, riquadro della
  squadra (sul telefono una pillola apribile, posizionata misurando le sovrapposizioni).
- Spec `tag-team-fase1` (duello vero lasciato giocare, ogni regola a duello fermo, Life Point
  condivisi, Mazzo vuoto, classificazione statica delle mappe), verificato al contrario su A2 e A3.
  Guardrail `guardrail-modalita-fuori-dal-motore` esteso al Tag Team.

**Scelte fatte durante il lavoro, da confermare con l'autore.**
- **D18 (provvisoria):** un membro che arriva a 0 Life Point durante il PROPRIO turno (per esempio un
  Cilindro Magico che rimanda il danno a chi attacca) esce al cambio turno, non subito: un turno già
  cominciato non passa di mano a metà, perché l'IA che lo sta giocando continuerebbe a muovere su uno
  stato cambiato sotto di lei. Nel turno avversario invece entra subito (D15), tra una battaglia e
  l'altra.
- **Avvolgimento di `Comandi.esegui`:** `tag.js` lo avvolge a runtime, solo in modalità tag, per contare
  gli attacchi in corso (non cambia nessun comando). Serve a D15. È un'eccezione dichiarata nel
  guardrail delle modalità e va approvata.
- **Mazzo vuoto (D17) senza aggancio:** lo controlla la variante all'inizio del turno, prima della
  pescata; A3 resta solo sui Life Point. Se entrambi i Mazzi sono vuoti decide il motore come sempre.
- **Mazzo e IA del compagno:** mazzo Normale del personaggio, IA Difficile (`tagDatabase.compagno`).
- **Premi:** quelli di un duello normale contro quell'avversario. Con due mazzi contro uno il Tag Team
  è più facile: da rivedere nella fase 2 con il bilanciamento.

**Non fatto in questa fase.**
- D2 "libero" (scelta di chi gioca a inizio turno).
- D12 scelta del bersaglio e D13: servono quando anche l'avversario è una squadra (fase 2).
- V3 copre le distruzioni ritardate, l'autodistruzione, la Sfera Esplosiva e il bando temporaneo; le
  altre voci ritardate per uid (Necrofear, Cappelli Magici, buff alla Standby) non sono messe da parte.
- Prova sul telefono vero.

## 4. Rischi

| Rischio | Gravità | Mitigazione |
|---------|---------|-------------|
| Carte che reagiscono a pesca, scarto o Mazzo vuoto scattano per errore allo scambio | alta | scambiare i contenuti senza passare dalle funzioni che emettono eventi; spec con le carte citate in 3 |
| Divergenza fra i due client in Multiplayer (fase 3) | alta | non toccare il passo comune senza riscrivere il piano; duello gemello come prova |
| Il motore cambia senza volerlo | media | impronta del registro e 60 partite senza testa prima e dopo (vedi 5) |
| Interfaccia affollata su telefono | media | pannello "in panchina" compatto; provarlo sul telefono vero con la procedura di `CLAUDE.md` |
| La modalità si trasforma in una copia del motore per piccoli cambi | media | ogni aggancio nel motore va giustificato per iscritto qui sotto |
| Costo del compagno IA (turni lenti) | bassa | usa l'IA esistente; misurare il tempo dei turni |

## 5. Prove di identità del motore

Il tag non deve cambiare nessun'altra modalità. Prima di ogni merge:

1. Impronta del registro effetti (822 carte, hook e testo sorgente di ogni funzione) prima e dopo, stessa
   tecnica del refactor di `card-effects.js`: zero differenze.
2. Le 60 partite del duello senza testa (`tools/duello-senza-testa.js`): impronta uguale a quella di prima.
3. Spec toccati e a rischio per nome (`node tests/run-all.js <parte-del-nome>`), non la suite completa.

## 6. Elenco degli agganci nel motore (da compilare)

Ogni aggancio deve avere: file e funzione, motivo, perché è opt-in, quale spec lo copre.
Stato: **approvati dall'autore il 2026-10-30 e scritti il 2026-10-31** (fase 1). A1 e A2 con aggancio
nel motore (non le alternative senza aggancio); A3 approvato.
Differenze rispetto alla proposta: A1 sta subito dopo il cambio di `currentPlayer` (non accanto a
`orologio`), perché con D16 anche le scadenze "fino al tuo prossimo turno" e il turno saltato vanno
lette sullo stato del membro che entra; A3 sta solo in `checkGameOver` (il Mazzo vuoto lo gestisce la
variante a inizio turno, vedi 3ter).

- **A1, evento di regola "inizio turno".** `js/engine/fasi.js`, `changeTurn`, accanto all'emissione di
  `orologio` (riga 624); più una voce nell'elenco `EVENTI` di `js/engine/eventi-duello.js`. Motivo: la
  variante scambia i membri esattamente lì. Opt-in: senza ascoltatori un evento non fa nulla. Spec: lo
  scambio avviene prima dell'azzeramento dei flag e della pescata. *Alternativa senza aggancio:*
  ascoltare `orologio`, con uno spec che sorvegli la sua posizione in `changeTurn`.
- **A2, legami sospesi.** `js/engine/duel-engine.js`, `recomputeStaticEffects`, nel ciclo delle
  Magie/Trappole (righe 5392-5459): una carta il cui bersaglio (`equippedToUid` o `targetUid`) è in
  panchina viene saltata, senza pulizia e senza `static()`, come già si fa per `equipInScelta`. Un solo
  punto: copre tutte le Equip, 439 e 620 senza toccare le carte. Opt-in: l'insieme degli uid in panchina
  è vuoto fuori dal tag. Spec: un Equip su un mostro avversario sopravvive allo scambio e riprende effetto
  al rientro. *Alternativa senza aggancio:* regola del tag "un legame con un mostro che va in panchina si
  interrompe", con la carta al Cimitero; più semplice, ma punisce chi l'ha giocata.
- **A3, sconfitta del lato.** `js/engine/fasi.js`, `checkGameOver` (righe 1556-1572) e pescata a Mazzo
  vuoto (919-932): una domanda al canale (`EventiDuello.chiedi('lato-sconfitto', true, posto, motivo)`)
  prima di `endDuel`. Risposta predefinita "sì": fuori dal tag nulla cambia. Nel tag la variante elimina
  il membro (D10, D17) e fa entrare il compagno (D15). Necessaria solo con D1 "per membro" e per D17.
  Spec: 1v1 invariato; nel tag, primo membro a 0 non chiude il duello, secondo sì.

## 7. Cosa non è in questo piano

- Il Tag Team a quattro posti con quattro campi.
- Carte nuove con effetti legati al Tag Team (si aggiungerebbe un'altra decisione al piano).
- Modifiche al relay o a Render, a meno che la fase 3 lo richieda e l'autore lo approvi.

## 8. Diario

- 2026-10-31: fase 1 implementata sul branch `feature/tag-team` (sezione 3ter). Da confermare: D18 e
  l'avvolgimento di `Comandi.esegui`.
- 2026-10-30: l'autore approva A1, A2 (con aggancio) e A3; chiude D14-D17. Fase 0 CHIUSA, nessuna decisione aperta.
- 2026-10-30: fase 0 completata (sezione 3bis). Proposti gli agganci A1-A3; nate D14-D17.
- 2026-10-30: l'autore propone la scelta del bersaglio (membro avversario) a inizio turno; compatibile con la lettura A.
- 2026-10-30: l'autore chiude D1-D6 (vedi sezione 2). Nascono D7-D9.
- 2026-10-30: l'autore conferma che vuole il 2v1 e il 2v2 anche in Multiplayer (fase 3 è un obiettivo).
- 2026-10-30: piano scritto. Decisione presa con l'autore: nessun secondo motore, variante come plugin.
  Prossimo passo: chiudere D1-D6 e fare la fase 0.
