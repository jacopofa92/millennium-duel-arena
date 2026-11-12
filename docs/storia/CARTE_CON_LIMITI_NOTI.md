# Carte con limiti noti e meccanismi generici

> Archivio spostato da CLAUDE.md il 2026-11-12 senza tagli, per alleggerire il contesto caricato a ogni sessione. Contenuto storico: cercare qui con grep, non leggere per intero.


## Carte con limiti noti (da riprendere)

**Fonte di verità: `grep missingEffectNote data/cards.json`, e nient'altro.**
0 risultati (erano 55 dopo la revisione completa descritta più sopra,
poi 52 contati di nuovo; chiuse in tre giri 142/511/512/899, poi
420/523/772/880/901/1040/1043/1113/1114/1121, poi tutte le 17 della
famiglia A, poi 873 con la scelta di chi subisce, poi le 6 della
famiglia C con le scelte che la battaglia aspetta, poi 761 e 890 col
censimento dei ritorni in mano e degli spostamenti dal Cimitero, poi
dieci note sulla copertura del checkpoint di targeting con l'audit
1.0.37, poi 882 con le carte usabili da entrambi (1.0.38), poi
396/459/1059 con la finestra di priorità (1.0.39) — vedi il bullet
«Meccanismi generici per i missingEffectNote» qui sopra e l'aggiornamento
1.0.35 sulla regola di `onAttackDeclare`). Questa
sezione è solo una mappa per orientarsi: ogni carta porta la propria
nota per esteso, con il motivo preciso. **Non ricopiare qui i motivi** —
è così che le due copie sono andate alla deriva l'ultima volta.

Le note sono scritte per non invecchiare: dicono cosa la carta NON fa,
mai l'elenco di cosa è stato aggiunto nel tempo, e non contengono
censimenti (niente "coperto da N carte": quei numeri crescono ad ogni
carta nuova e nessuno li aggiorna — si dice dove contarli).

Tre famiglie, da non confondere.

**A — scostamento reale ancora aperto: nessuna carta.** Le ultime 17
sono state chiuse insieme (spec `note-carte-chiuse-4.spec.js`). Una carta
nuova che finisse qui va trattata cercando prima un meccanismo esistente:
vedi l'elenco nel bullet «Meccanismi generici per i missingEffectNote».

La "scelta di chi SUBISCE l'effetto" ha ora il suo meccanismo:
`victimChoosesDiscard(ctx, victimOwner, options, onDiscarded)`
(card-effects.js) — picker obbligatorio per il giocatore, la carta meno
utile per il bot, e in Multiplayer sceglie il client della vittima (sulla
sua mano vera) e allinea l'altro con la propria fotografia di stato.
**Usarlo per ogni futura carta "l'avversario scarta 1 carta a sua
scelta"** (761, 873; spec `scelta-di-chi-subisce.spec.js`).

**B — implementata, il limite è del motore: nessuna carta.** Le ultime tre
(192, 235, 622) sono state chiuse con immunità transazionale delle Spirit
Message e targeting attendibile con scelta via `Decisioni`.

*Carte usabili da "uno dei due giocatori"* (chiuso in 1.0.38):
`def.usableByEitherPlayer` rende una carta SCOPERTA sul Terreno di chi la
controlla candidata come risposta anche per il suo avversario
(`findTriggerCandidates`, zona 'stAltrui': non viene consumata, e il ctx
del link ha `owner` = chi risponde e paga, `cardOwner` = chi la
controlla). Nata per Oppressione Reale (id 882); in Multiplayer la
decisione viaggia come ogni altra risposta (riconosciuta per uid).

*Spostamenti dal Cimitero e Necrovalley* (chiuso in 1.0.36): ogni
effetto che toglie una carta dal Cimitero scrivendolo a mano
(`grave.splice/pop/shift`) deve chiamare prima
`ctx.graveyardMoveNegated(<di chi è il Cimitero>)` — i passaggi
condivisi (specialSummon da 'graveyard', searchGraveyardWithChoice,
banishFromGraveyard, le rinascite a tempo) lo fanno da soli. Lo
sorveglia `guardrail-necrovalley.spec.js`: una carta nuova che lo
dimentica fa fallire la suite. Attenzione a una rianimazione dal
Cimitero dell'AVVERSARIO: specialSummon controlla il Cimitero di chi
Evoca, quindi lì il controllo va fatto a mano sul Cimitero giusto (come
in Rinascita del Mostro id 35).
*Ritorni in mano*: ogni mostro che torna dal Terreno in mano passa da
`ACTIONS.returnMonsterToHand` (censimento 1.0.36, nessuna eccezione
rimasta), che lo rimanda nella mano del PROPRIETARIO (`slot.originalOwner`)
e non di chi lo controlla.

*Checkpoint di targeting* (`ctx.declareTarget`, `duel-engine.js`, nato
per id 115) — **coperto ovunque dall'audit 1.0.37**: ogni effetto il cui
testo sceglie come bersaglio un mostro sul Terreno ci passa, in una di
tre forme — `ctx.declareTarget`, `ctx.destroyTargetedMonster`
("distruggi 1 mostro bersaglio") o l'opzione `dichiara: true` di
`chooseFieldCardTarget` (la più comoda: dichiara il bersaglio scelto e
segue un eventuale reindirizzamento; la usano anche
`equipToChosenTarget` e `attachUnionMonster`, quindi ogni Magia
Equipaggiamento e ogni Union). Due guardrail: 
`guardrail-bersagli-dichiarati.spec.js` incrocia il TESTO delle carte
("bersaglio" + "mostro") col loro codice, con un elenco chiuso di
eccezioni per categoria (bersagli nel Cimitero, bersaglio di un
attacco, carte che reagiscono al checkpoint, bersagli Magia/Trappola);
`targeting-checkpoint-guardrail.spec.js` è un ratchet sul numero di
chiamate. **Una carta nuova che bersaglia un mostro deve passare di lì,
o la suite fallisce.** Il percorso storico resta sincrono; per reazioni
che richiedono una decisione esiste `ctx.declareTargetWaiting`, protetto
dal guardrail `guardrail-targeting-attendibile.spec.js`.

*Finestra di priorità per gli Effetti Veloci* (chiuso in 1.0.39, su
richiesta esplicita): `DuelEngine.openPriorityWindow(chi, momento, onDone)`
dà a chi NON è di turno un momento per un Effetto Veloce anche quando
nessuno ha attivato nulla — in TRE punti del turno, non ad ogni cambio
fase: Standby (`enterStandbyPhase` per il giocatore, `botTurn` per il
bot), inizio Battle Phase (`enterBattlePhase`; il bot aspetta con
`waitForPriorityWindow` prima di attaccare, `executeAttack` rifiuta
mentre è aperta) e fine turno (`passaIlTurnoDopoLaPriorita`). Candidati:
gli stessi Effetti Veloci offerti in risposta a una Catena (mostri e
Magie/Trappole scoperte con `canRespondAsQuickEffect`, mano con
`canRespondFromHand`) — **non** le Trappole coperte né le Magie Veloci
in mano, apposta, per non trasformare ogni passaggio di fase in una
domanda. Senza candidati `onDone` parte SUBITO e in modo sincrono, quindi
un duello senza queste carte scorre esattamente come prima. Un rifiuto
non si ripropone nello stesso turno (`gameState.quickEffectsDeclined`).
Il bot ci usa solo le carte che lo dichiarano utili
(`def.botInFinestraDiPriorita`, booleano o funzione(ctx)). **In
Multiplayer (1.0.41)** decide il client di chi NON è di turno e l'altro
aspetta: la decisione viaggia come `chain-response` con un campo
`priorityKey` (turno:momento:ordine), su una coda per CHIAVE separata da
quella della Catena, e chi risponde la manda SEMPRE, anche "passo". La
Standby dell'avversario la apre `applyRemotePhase('standby')`; Battle
Phase e fine turno passano già dalle stesse funzioni sui due client.
`nextPhase`/`endTurn`/lo stepper delle fasi rifiutano mentre una
finestra è aperta (chi è di turno, in Multiplayer, non ha un modale
davanti). **Il relay (`server/server.js`) accetta solo un elenco chiuso di
tipi di messaggio** (`GAME_ACTION_KINDS`): un tipo nuovo viene scartato
in silenzio, e qui significava 30 secondi di attesa ad ogni finestra. Per
un nuovo messaggio, o si riusa un tipo esistente con un campo in più (come
qui), o si aggiunge il tipo al server e lo si ridistribuisce.
Spec: `multiplayer-finestra-di-priorita.spec.js`.

*Fotografie di stato e campi relativi a chi guarda* (1.0.43, trovato col
controllo Multiplayer successivo): dentro una carta i valori 'player'/
'bot' (`equippedToOwner`, `targetOwner`, `_relinquishedFromOwner`, ...)
sono relativi a chi la manda. `applyStateResync` (multiplayer.js) ora li
scambia in ogni campo il cui nome finisce per "Owner" (`traduciStato`):
prima una Carta Equipaggiamento del mittente, di qua, puntava al Terreno
sbagliato e `recomputeStaticEffects` la scartava — la Spada di Orichalcos
finiva nel Cimitero su un client solo. La fotografia trasmette ora anche
`originalOwner` del mostro (di chi è davvero un mostro rubato), e
`resolveRemoteChoice` usa la copia LOCALE di una carta già in campo invece
di quella arrivata col messaggio. **Un campo nuovo che memorizza un
proprietario va chiamato `...Owner`**, così la traduzione lo copre da sola.
Spec: `multiplayer-equip-e-fotografia.spec.js`.
Due difetti chiusi insieme: un mostro che usa il suo Effetto Veloce in
risposta ora risulta "già usato nel turno" (`segnaUsoEffettoMostro`), e
la carta che apre una Catena non viene più riproposta come risposta a
sé stessa (la Spada 396, il cui "una volta per turno" scatta alla
risoluzione, lo faceva). Spec: `finestra-di-priorita.spec.js`.

*Carte che promettono una scelta e scelgono da sole* (giro 1.0.40): un
audit che incrocia il TESTO (una parola di scelta: "scegli", "bersaglio",
"a tua scelta") col CODICE (nessun helper di scelta, e un `find`/
`findIndex`/`[0]`/`sort` su una zona) ne ha trovate 21; tolti i falsi
positivi (bersaglio obbligato, effetti passivi, helper chiamato da una
funzione fuori dal blocco `register`) ne restavano 7, tutte chiuse: 548,
289, 220, 881, 742, 792, 363 (`scelte-che-mancavano-2.spec.js`). Nuovo
helper `chooseFieldTargetsInSequence(ctx, passi, onDone)` per "scegli N
bersagli sul Terreno" uno alla volta, ciascuno col checkpoint e il numero
totale di bersagli: **usarlo per ogni carta futura di quella forma**. Una
scelta che spetta all'AVVERSARIO si fa con `chooseOption({ chooser })` o
con `chooseFieldCardTarget` su un contesto della vittima
(`DuelEngine.makeContext(vittima, ...)`), come in Bara Oscura (792).

**C — la scelta la fa il motore, non il giocatore: nessuna carta.** Le
ultime sei (100, 883, 885, 889, 895, 1120) sono state chiuse con
`callCardHandlerWaiting`/`attendiScelta` e `chooseOption` (vedi
l'aggiornamento 1.0.35 sulla regola di `onAttackDeclare`). Anche 235 e
622 ora usano il checkpoint attendibile `ctx.declareTargetWaiting`.
